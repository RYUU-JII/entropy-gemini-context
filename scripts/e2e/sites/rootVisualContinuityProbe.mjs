import { createCanvas, loadImage } from '@napi-rs/canvas';

import {
  evaluate,
  sleep,
} from '../extensionChromiumHarness.mjs';

const ROOT_VISUAL_CONTINUITY_STATE_KEY = '__entropyQaRootVisualContinuityV1__';
const ROOT_VISUAL_CONTINUITY_PATCH_ID = 'entropy-qa-root-visual-continuity-patch-v1';
const ROOT_VISUAL_CONTINUITY_FRAME_LIMIT = 240;
const ROOT_VISUAL_CONTINUITY_START_TIMEOUT_MS = 5_000;

function roundRatio(value) {
  return Math.round(Number(value) * 10_000) / 10_000;
}

export function calculateCompositorChromaRatio({ red, green, blue } = {}) {
  const channels = [red, green, blue].map(Number);
  if (channels.some((value) => !Number.isFinite(value))) {
    throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_PIXEL_INVALID');
  }
  return roundRatio((Math.max(...channels) - Math.min(...channels)) / 255);
}

async function analyzeProbeFrame(data, geometry, maximumCompositorChromaRatio) {
  const image = await loadImage(Buffer.from(data, 'base64'));
  const scaleX = image.width / geometry.viewportWidth;
  const scaleY = image.height / geometry.viewportHeight;
  const sourceX = Math.max(0, Math.min(image.width - 1, Math.floor(geometry.x * scaleX)));
  const sourceY = Math.max(0, Math.min(image.height - 1, Math.floor(geometry.y * scaleY)));
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext('2d');
  context.drawImage(image, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  const chromaRatio = calculateCompositorChromaRatio({ red, green, blue });
  const signaturePresent = (
    alpha >= 250
    && red >= 60
    && red - green >= 20
    && Math.abs(green - blue) <= 20
  );
  return Object.freeze({
    red,
    green,
    blue,
    alpha,
    chromaRatio,
    signaturePresent,
    grayscaleHeld: signaturePresent && chromaRatio <= maximumCompositorChromaRatio,
  });
}

export function createRootVisualCompositorRecorder({
  cdp,
  sessionId,
  geometry,
  maximumCompositorChromaRatio,
  now = Date.now,
} = {}) {
  if (!cdp || typeof cdp.send !== 'function' || typeof cdp.subscribe !== 'function') {
    throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_CDP_REQUIRED');
  }
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_SESSION_REQUIRED');
  }

  let started = false;
  let stopped = false;
  let pageStreamActive = false;
  let unsubscribe = null;
  let decodedFrameCount = 0;
  let rawFrameCount = 0;
  let signatureFrameCount = 0;
  let leadingInvalidSignatureFrameCount = 0;
  let invalidSignatureFrameCount = 0;
  let aboveChromaFrameCount = 0;
  let maximumObservedChromaRatio = null;
  let firstViolation = null;
  let streamError = null;
  let decodeQueue = Promise.resolve();

  function recordError(error) {
    streamError ||= error instanceof Error
      ? error
      : new Error(`SITE_E2E_ROOT_VISUAL_COMPOSITOR_FAILED:${String(error || 'unknown')}`);
  }

  function handleFrame(event) {
    if (event?.sessionId !== sessionId || stopped) return;
    const frameSessionId = Number(event.params?.sessionId);
    const data = event.params?.data;
    if (!Number.isSafeInteger(frameSessionId) || frameSessionId < 0) {
      recordError(new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_FRAME_SESSION_INVALID'));
      return;
    }
    void cdp.send('Page.screencastFrameAck', {
      sessionId: frameSessionId,
    }, sessionId).catch((error) => {
      recordError(new Error(
        `SITE_E2E_ROOT_VISUAL_COMPOSITOR_ACK_FAILED:${error?.message || String(error)}`,
      ));
    });
    if (typeof data !== 'string' || !data) {
      recordError(new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_FRAME_DATA_REQUIRED'));
      return;
    }
    rawFrameCount += 1;
    const serial = rawFrameCount;
    if (serial > ROOT_VISUAL_CONTINUITY_FRAME_LIMIT) {
      recordError(new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_FRAME_LIMIT_EXCEEDED'));
      return;
    }
    const capturedAtMs = Number(now());
    decodeQueue = decodeQueue.then(async () => {
      const sample = await analyzeProbeFrame(
        data,
        geometry,
        maximumCompositorChromaRatio,
      );
      decodedFrameCount += 1;
      if (!sample.signaturePresent && signatureFrameCount === 0) {
        leadingInvalidSignatureFrameCount += 1;
        return;
      }
      if (sample.signaturePresent) {
        signatureFrameCount += 1;
        if (!sample.grayscaleHeld) aboveChromaFrameCount += 1;
        maximumObservedChromaRatio = maximumObservedChromaRatio === null
          ? sample.chromaRatio
          : Math.max(maximumObservedChromaRatio, sample.chromaRatio);
      } else {
        invalidSignatureFrameCount += 1;
      }
      if (!firstViolation && (!sample.signaturePresent || !sample.grayscaleHeld)) {
        firstViolation = Object.freeze({
          serial,
          capturedAtMs,
          chromaRatio: sample.chromaRatio,
          signaturePresent: sample.signaturePresent,
          grayscaleHeld: sample.grayscaleHeld,
        });
      }
    }).catch(recordError);
  }

  async function waitForArmedProbeFrame() {
    const deadline = Date.now() + ROOT_VISUAL_CONTINUITY_START_TIMEOUT_MS;
    while (signatureFrameCount === 0 && !streamError && Date.now() < deadline) {
      await sleep(25);
    }
    if (streamError) throw streamError;
    if (signatureFrameCount === 0) {
      throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_START_TIMEOUT');
    }
  }

  return Object.freeze({
    async start() {
      if (started) throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_ALREADY_STARTED');
      started = true;
      unsubscribe = cdp.subscribe('Page.screencastFrame', handleFrame);
      try {
        await cdp.send('Page.startScreencast', {
          format: 'png',
          everyNthFrame: 1,
        }, sessionId);
        pageStreamActive = true;
        await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const patch = document.getElementById(${JSON.stringify(ROOT_VISUAL_CONTINUITY_PATCH_ID)});
            if (!patch) throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_PATCH_REQUIRED');
            patch.style.transform = 'translateZ(0)';
            patch.getBoundingClientRect();
          })()`,
          awaitPromise: false,
          returnByValue: true,
        }, sessionId);
        await waitForArmedProbeFrame();
      } catch (error) {
        unsubscribe?.();
        unsubscribe = null;
        stopped = true;
        if (pageStreamActive) {
          await cdp.send('Page.stopScreencast', {}, sessionId).catch(() => {});
          pageStreamActive = false;
        }
        throw error;
      }
    },

    async stop() {
      if (!started) throw new Error('SITE_E2E_ROOT_VISUAL_COMPOSITOR_NOT_STARTED');
      if (!stopped) {
        if (pageStreamActive) {
          await cdp.send('Page.stopScreencast', {}, sessionId);
          pageStreamActive = false;
        }
        stopped = true;
        unsubscribe?.();
        unsubscribe = null;
      }
      await decodeQueue;
      if (streamError) throw streamError;
      return Object.freeze({
        source: 'in_memory_page_screencast_probe_pixel',
        frameCount: decodedFrameCount - leadingInvalidSignatureFrameCount,
        rawFrameCount: decodedFrameCount,
        leadingInvalidSignatureFrameCount,
        invalidSignatureFrameCount,
        aboveChromaFrameCount,
        maximumObservedChromaRatio: maximumObservedChromaRatio === null
          ? null
          : roundRatio(maximumObservedChromaRatio),
        maximumAllowedChromaRatio: maximumCompositorChromaRatio,
        firstViolation,
        persistedFrameCount: 0,
      });
    },
  });
}

async function findVisibleNavigationTarget(harness, page, action) {
  const deadline = Date.now() + action.routeTimeoutMs;
  while (Date.now() < deadline) {
    const target = await evaluate(harness.cdp, page.sessionId, `((input) => {
      const candidates = Array.from(document.querySelectorAll(input.targetSelector));
      const currentUrl = new URL(location.href);
      for (const candidate of candidates) {
        if (!(candidate instanceof HTMLAnchorElement)) continue;
        if (candidate.hasAttribute('download') || candidate.target === '_blank') continue;
        let url;
        try { url = new URL(candidate.href, location.href); }
        catch (_) { continue; }
        if (
          url.origin !== location.origin
          || !url.pathname.startsWith(input.expectedPathPrefix)
          || url.href === currentUrl.href
        ) continue;
        const rect = candidate.getBoundingClientRect();
        const visibleLeft = Math.max(0, rect.left);
        const visibleRight = Math.min(window.innerWidth, rect.right);
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        if (visibleRight - visibleLeft <= 4 || visibleBottom - visibleTop <= 4) continue;
        return {
          x: visibleLeft + ((visibleRight - visibleLeft) / 2),
          y: visibleTop + ((visibleBottom - visibleTop) / 2),
          destinationPath: url.pathname,
        };
      }
      return null;
    })(${JSON.stringify(action)})`, { timeoutMs: 2_000 }).catch(() => null);
    if (target) return target;
    await sleep(100);
  }
  return null;
}

async function startDocumentFrameProbe(harness, page, action) {
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const stateKey = ${JSON.stringify(ROOT_VISUAL_CONTINUITY_STATE_KEY)};
    const patchId = ${JSON.stringify(ROOT_VISUAL_CONTINUITY_PATCH_ID)};
    const previous = globalThis[stateKey];
    if (previous?.animationFrameId) cancelAnimationFrame(previous.animationFrameId);
    previous?.patch?.remove?.();

    const root = document.documentElement;
    if (!(root instanceof HTMLElement)) return { status: 'unavailable', reason: 'root_missing' };
    const patch = document.createElement('div');
    patch.id = patchId;
    patch.setAttribute('aria-hidden', 'true');
    Object.assign(patch.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      width: '64px',
      height: '64px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      background: 'rgb(255, 0, 0)',
      opacity: '1',
      mixBlendMode: 'normal',
      isolation: 'isolate',
      contain: 'strict',
      colorScheme: 'only light',
    });
    root.append(patch);

    const readGrayscaleStrength = (filterValue) => {
      const match = String(filterValue || '').match(/(?:^|\\s)grayscale\\(([-+]?\\d*\\.?\\d+)(%)?\\)/iu);
      if (!match) return null;
      const numeric = Number(match[1]);
      if (!Number.isFinite(numeric)) return null;
      return Math.max(0, Math.min(1, match[2] ? numeric / 100 : numeric));
    };
    const state = {
      patch,
      animationFrameId: null,
      initialTimeOrigin: performance.timeOrigin,
      initialPath: location.pathname,
      frameCount: 0,
      belowStrengthFrameCount: 0,
      missingFilterFrameCount: 0,
      minimumObservedStrength: null,
      maximumObservedStrength: null,
      filterChangeCount: 0,
      previousFilter: null,
      initialFilter: null,
      finalFilter: null,
      firstViolation: null,
      markerReattachCount: 0,
    };
    const sample = () => {
      if (!patch.isConnected) {
        document.documentElement.append(patch);
        state.markerReattachCount += 1;
      }
      const filter = getComputedStyle(root).filter;
      const strength = readGrayscaleStrength(filter);
      state.frameCount += 1;
      state.initialFilter ||= filter;
      state.finalFilter = filter;
      if (state.previousFilter !== null && state.previousFilter !== filter) {
        state.filterChangeCount += 1;
      }
      state.previousFilter = filter;
      if (strength === null) {
        state.missingFilterFrameCount += 1;
      } else {
        state.minimumObservedStrength = state.minimumObservedStrength === null
          ? strength
          : Math.min(state.minimumObservedStrength, strength);
        state.maximumObservedStrength = state.maximumObservedStrength === null
          ? strength
          : Math.max(state.maximumObservedStrength, strength);
        if (strength + 0.0005 < input.expectedGrayscaleStrength) {
          state.belowStrengthFrameCount += 1;
        }
      }
      if (
        !state.firstViolation
        && (strength === null || strength + 0.0005 < input.expectedGrayscaleStrength)
      ) {
        state.firstViolation = {
          frame: state.frameCount,
          pathname: location.pathname,
          strength,
          filter: String(filter).slice(0, 160),
          prepaintSuppressed:
            root.getAttribute('data-entropy-prepaint-suppressed') === '1',
        };
      }
      state.animationFrameId = requestAnimationFrame(sample);
    };
    globalThis[stateKey] = state;
    sample();
    return {
      status: 'started',
      initialPath: state.initialPath,
      initialTimeOrigin: state.initialTimeOrigin,
      initialFilter: state.initialFilter,
      initialGrayscaleStrength: readGrayscaleStrength(state.initialFilter),
      geometry: {
        x: 40,
        y: 40,
        viewportWidth: Math.max(1, window.innerWidth),
        viewportHeight: Math.max(1, window.innerHeight),
      },
    };
  })(${JSON.stringify(action)})`);
}

async function readDocumentFrameProbeState(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const state = globalThis[${JSON.stringify(ROOT_VISUAL_CONTINUITY_STATE_KEY)}];
    if (!state) return null;
    return {
      timeOrigin: performance.timeOrigin,
      pathname: location.pathname,
      frameCount: state.frameCount,
    };
  })()`);
}

async function finishDocumentFrameProbe(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const stateKey = ${JSON.stringify(ROOT_VISUAL_CONTINUITY_STATE_KEY)};
    const state = globalThis[stateKey];
    if (!state) return null;
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    state.patch?.remove?.();
    delete globalThis[stateKey];
    return {
      initialTimeOrigin: state.initialTimeOrigin,
      finalTimeOrigin: performance.timeOrigin,
      initialPath: state.initialPath,
      finalPath: location.pathname,
      frameCount: state.frameCount,
      belowStrengthFrameCount: state.belowStrengthFrameCount,
      missingFilterFrameCount: state.missingFilterFrameCount,
      minimumObservedStrength: state.minimumObservedStrength,
      maximumObservedStrength: state.maximumObservedStrength,
      filterChangeCount: state.filterChangeCount,
      initialFilter: state.initialFilter,
      finalFilter: state.finalFilter,
      firstViolation: state.firstViolation,
      markerReattachCount: state.markerReattachCount,
    };
  })()`);
}

async function cleanupDocumentFrameProbe(harness, page) {
  await evaluate(harness.cdp, page.sessionId, `(() => {
    const stateKey = ${JSON.stringify(ROOT_VISUAL_CONTINUITY_STATE_KEY)};
    const state = globalThis[stateKey];
    if (state?.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    state?.patch?.remove?.();
    document.getElementById(${JSON.stringify(ROOT_VISUAL_CONTINUITY_PATCH_ID)})?.remove?.();
    delete globalThis[stateKey];
  })()`, { timeoutMs: 2_000 }).catch(() => {});
}

async function dispatchTrustedNavigationClick(harness, page, target) {
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: target.x,
    y: target.y,
    button: 'left',
    clickCount: 1,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: target.x,
    y: target.y,
    button: 'left',
    clickCount: 1,
  }, page.sessionId);
}

async function performExtensionDisabledNavigationControl(harness, page, action, target) {
  const initial = await evaluate(harness.cdp, page.sessionId, `(() => ({
    timeOrigin: performance.timeOrigin,
    pathname: location.pathname,
  }))()`);
  if (initial.pathname !== action.expectedSourcePath) {
    return { status: 'unavailable', reason: 'control_source_route_mismatch' };
  }
  await dispatchTrustedNavigationClick(harness, page, target);
  const deadline = Date.now() + action.routeTimeoutMs;
  while (Date.now() < deadline) {
    const current = await evaluate(harness.cdp, page.sessionId, `(() => ({
      timeOrigin: performance.timeOrigin,
      pathname: location.pathname,
    }))()`).catch(() => null);
    if (!current || current.timeOrigin !== initial.timeOrigin) {
      return { status: 'unavailable', reason: 'control_navigation_replaced_document' };
    }
    if (
      current.pathname.startsWith(action.expectedPathPrefix)
      && current.pathname !== initial.pathname
    ) {
      return {
        status: 'performed',
        probeId: action.probeId,
        trustedInput: true,
        controlMode: 'extension_disabled_navigation_only',
        sameDocument: true,
        routeReached: true,
        destinationPath: current.pathname,
      };
    }
    await sleep(50);
  }
  return { status: 'unavailable', reason: 'control_same_document_route_timeout' };
}

export async function performRootVisualContinuityProbe(harness, page, action) {
  const target = await findVisibleNavigationTarget(harness, page, action);
  if (!target) {
    return { status: 'unavailable', reason: 'same_origin_navigation_target_unavailable' };
  }
  if (harness.extensionEnabled === false) {
    return performExtensionDisabledNavigationControl(harness, page, action, target);
  }

  const started = await startDocumentFrameProbe(harness, page, action);
  if (started?.status !== 'started') return started;
  if (started.initialPath !== action.expectedSourcePath) {
    await cleanupDocumentFrameProbe(harness, page);
    return { status: 'unavailable', reason: 'source_route_mismatch' };
  }
  if (
    !Number.isFinite(started.initialGrayscaleStrength)
    || started.initialGrayscaleStrength + 0.0005 < action.expectedGrayscaleStrength
  ) {
    await cleanupDocumentFrameProbe(harness, page);
    return {
      status: 'unavailable',
      reason: 'initial_root_grayscale_not_active',
      initialGrayscaleStrength: started.initialGrayscaleStrength ?? null,
    };
  }

  const compositor = createRootVisualCompositorRecorder({
    cdp: harness.cdp,
    sessionId: page.sessionId,
    geometry: started.geometry,
    maximumCompositorChromaRatio: action.maximumCompositorChromaRatio,
  });
  let compositorStarted = false;
  let compositorEvidence = null;
  try {
    await compositor.start();
    compositorStarted = true;
    await dispatchTrustedNavigationClick(harness, page, target);

    const deadline = Date.now() + action.routeTimeoutMs;
    let routeState = null;
    while (Date.now() < deadline) {
      routeState = await readDocumentFrameProbeState(harness, page).catch(() => null);
      if (!routeState || routeState.timeOrigin !== started.initialTimeOrigin) {
        return {
          status: 'unavailable',
          reason: 'navigation_replaced_document',
          destinationPath: target.destinationPath,
        };
      }
      if (
        routeState.pathname.startsWith(action.expectedPathPrefix)
        && routeState.pathname !== started.initialPath
      ) break;
      await sleep(50);
    }
    if (
      !routeState
      || !routeState.pathname.startsWith(action.expectedPathPrefix)
      || routeState.pathname === started.initialPath
    ) {
      return {
        status: 'unavailable',
        reason: 'same_document_route_timeout',
        destinationPath: target.destinationPath,
      };
    }

    await sleep(action.settleMs);
    compositorEvidence = await compositor.stop();
    compositorStarted = false;
    const documentFrames = await finishDocumentFrameProbe(harness, page);
    if (!documentFrames) {
      return { status: 'unavailable', reason: 'document_frame_probe_lost' };
    }
    if (
      documentFrames.frameCount < action.minimumAnimationFrameCount
      || compositorEvidence.frameCount < action.minimumCompositorFrameCount
    ) {
      return {
        status: 'unavailable',
        reason: 'continuity_probe_sample_floor_unmet',
        documentFrameCount: documentFrames.frameCount,
        compositorFrameCount: compositorEvidence.frameCount,
      };
    }
    if (compositorEvidence.invalidSignatureFrameCount > 0) {
      return {
        status: 'unavailable',
        reason: 'compositor_probe_signature_missing',
        documentFrames,
        compositor: compositorEvidence,
      };
    }

    const continuityHeld = (
      documentFrames.initialTimeOrigin === documentFrames.finalTimeOrigin
      && documentFrames.finalPath.startsWith(action.expectedPathPrefix)
      && documentFrames.belowStrengthFrameCount === 0
      && documentFrames.missingFilterFrameCount === 0
      && compositorEvidence.aboveChromaFrameCount === 0
    );
    return {
      status: 'performed',
      probeId: action.probeId,
      trustedInput: true,
      destinationPath: documentFrames.finalPath,
      sameDocument: documentFrames.initialTimeOrigin === documentFrames.finalTimeOrigin,
      routeReached: documentFrames.finalPath.startsWith(action.expectedPathPrefix),
      expectedGrayscaleStrength: action.expectedGrayscaleStrength,
      minimumAnimationFrameCount: action.minimumAnimationFrameCount,
      minimumCompositorFrameCount: action.minimumCompositorFrameCount,
      continuityHeld,
      documentFrames,
      compositor: compositorEvidence,
    };
  } finally {
    if (compositorStarted) await compositor.stop().catch(() => {});
    await cleanupDocumentFrameProbe(harness, page);
  }
}
