import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';

const PROBE_KEY = '__ENTROPY_QA_MAIN_RETURN_JOURNEY__';

export function requireMainReturnJourney({ enabled, surface, theme, resizeTo, firstVisionJourney }) {
  if (enabled !== true) return false;
  if (surface !== 'main' || theme !== 'zen' || resizeTo !== undefined || firstVisionJourney) {
    throw new Error('QA_MAIN_RETURN_REQUIRES_ZEN_MAIN_WITHOUT_RESIZE_OR_FIRST_VISION');
  }
  return true;
}

export function requireMainReturnSample(sample) {
  if (sample?.firstPaint?.sameCanvas !== true || sample?.after?.sameCanvas !== true) {
    throw new Error('QA_MAIN_RETURN_CANVAS_REPLACED');
  }
  if (sample.firstPaint.visibility !== 'visible' || !sample.firstPaint.canvasVisible
    || sample.after.visibility !== 'visible' || !sample.after.canvasVisible) {
    throw new Error('QA_MAIN_RETURN_CANVAS_NOT_VISIBLE');
  }
  if (!Number.isFinite(sample.beforeFrames) || !Number.isFinite(sample.after.sampleFrames)
    || sample.after.sampleFrames <= sample.beforeFrames) {
    throw new Error('QA_MAIN_RETURN_WORKER_NOT_ADVANCING');
  }
  return sample;
}

// This short-lived observation probe belongs only to the run-owned dashboard.
// Browser visibility is changed by the harness's exact-owned-tab activation,
// never by this probe or by emulating document/window focus.
function installMainReturnProbe(key) {
  if (Object.hasOwn(globalThis, key)) throw new Error('QA_MAIN_RETURN_PROBE_EXISTS');
  const selector = '[data-main-presentation-surface="pond"] canvas';
  const canvas = document.querySelector(selector);
  if (!canvas) throw new Error('QA_MAIN_RETURN_INITIAL_CANVAS_MISSING');
  const bonsaiSelector = '[data-main-presentation-surface="bonsai"] canvas';
  const bonsaiCanvas = document.querySelector(bonsaiSelector);
  if (!bonsaiCanvas) throw new Error('QA_MAIN_RETURN_INITIAL_BONSAI_CANVAS_MISSING');
  const activeTab = () => document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const read = () => {
    const current = document.querySelector(selector);
    const bounds = current?.getBoundingClientRect();
    return {
      atMs: performance.now(), visibility: document.visibilityState, activeTab: activeTab(),
      sameCanvas: current === canvas && canvas.isConnected,
      canvasConnected: canvas.isConnected,
      replacementCanvasPresent: Boolean(current && current !== canvas),
      canvasVisible: Boolean(current?.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        && current.width > 1 && current.height > 1 && bounds.width > 0 && bounds.height > 0),
      backingWidth: current?.width, backingHeight: current?.height,
      sameBonsaiCanvas: document.querySelector(bonsaiSelector) === bonsaiCanvas && bonsaiCanvas.isConnected,
      bonsaiVisible: bonsaiCanvas.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
    };
  };
  const wait = async (predicate, step) => {
    const started = performance.now();
    while (!predicate()) {
      if (performance.now() - started > 20000) throw new Error('QA_MAIN_RETURN_TIMEOUT:' + step);
      await pause(25);
    }
  };
  const metrics = async () => {
    const debug = globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG;
    if (typeof debug?.metrics !== 'function') throw new Error('QA_MAIN_RETURN_METRICS_UNAVAILABLE');
    const value = await debug.metrics();
    if (value?.error || !Number.isFinite(value?.sampleFrames)) throw new Error('QA_MAIN_RETURN_METRICS_INVALID');
    return { ...read(), sampleFrames: value.sampleFrames, viewport: value.viewport,
      runtimeHealth: value.runtimeHealth, workerMetrics: value.workerMetrics };
  };
  let requestId = null, deadlineId = null, pending = null, rejectPending = null;
  const cancelFrameWait = () => {
    if (requestId !== null) cancelAnimationFrame(requestId);
    if (deadlineId !== null) clearTimeout(deadlineId);
    requestId = null; deadlineId = null;
  };
  const prepareReturn = async kind => {
    if (pending) throw new Error('QA_MAIN_RETURN_ALREADY_PENDING');
    const before = await metrics();
    const startedAtMs = performance.now();
    let firstVisibleAtMs = null, visibleFrames = 0, blankRafCount = 0;
    pending = new Promise((resolve, reject) => {
      rejectPending = reject;
      deadlineId = setTimeout(() => {
        cancelFrameWait();
        reject(new Error('QA_MAIN_RETURN_PAINT_TIMEOUT'));
      }, 20000);
      const frame = () => {
        const state = read();
        if (!state.canvasConnected || state.replacementCanvasPresent) {
          cancelFrameWait(); reject(new Error('QA_MAIN_RETURN_CANVAS_REPLACED')); return;
        }
        if (state.visibility === 'visible' && state.activeTab === 'main') {
          if (state.sameCanvas && state.canvasVisible) {
            if (firstVisibleAtMs === null) firstVisibleAtMs = state.atMs;
            visibleFrames += 1;
          } else blankRafCount += 1;
          if (visibleFrames >= 2) {
            cancelFrameWait();
            resolve({ kind, startedAtMs, beforeFrames: before.sampleFrames,
              firstVisibleCanvasMs: firstVisibleAtMs - startedAtMs,
              paintOpportunityMs: state.atMs - startedAtMs, blankRafCount, firstPaint: state });
            return;
          }
        }
        requestId = requestAnimationFrame(frame);
      };
      requestId = requestAnimationFrame(frame);
    });
    // A cross-process tab activation can outlive the deadline. The pending
    // rejection is still consumed by takePaint(), without an unhandled event.
    pending.catch(() => {});
    return before;
  };
  const probe = {
    read, metrics, prepareReturn,
    async parkInternal() {
      if (activeTab() !== 'main' || document.visibilityState !== 'visible') throw new Error('QA_MAIN_RETURN_INITIAL_STATE_INVALID');
      const button = document.querySelector('.zen-garden-paper-edge[aria-expanded="false"]');
      if (!button) throw new Error('QA_MAIN_RETURN_SITES_CONTROL_MISSING');
      button.click();
      await wait(() => activeTab() === 'sites', 'sites');
      await pause(650);
      if (!read().canvasConnected) throw new Error('QA_MAIN_RETURN_PARKED_CANVAS_DISCONNECTED');
      if (!read().sameBonsaiCanvas || !read().bonsaiVisible) throw new Error('QA_MAIN_RETURN_PATHWAYS_BONSAI_NOT_RETAINED');
      return metrics();
    },
    async returnInternal(kind) {
      if (activeTab() !== 'sites') throw new Error('QA_MAIN_RETURN_SITES_NOT_ACTIVE');
      await prepareReturn(kind);
      const button = document.querySelector('.zen-garden-paper-edge[aria-expanded="true"]');
      if (!button) throw new Error('QA_MAIN_RETURN_MAIN_CONTROL_MISSING');
      button.click();
    },
    async parkSidebar(tab, { waitForArtifactReady = true, dwellMs = 2000 } = {}) {
      if (!['tools', 'schedule'].includes(tab) || activeTab() !== 'main') throw new Error('QA_MAIN_RETURN_SIDEBAR_ORIGIN_INVALID');
      const button = document.querySelector('#dashboard-sidebar button[data-tab="' + tab + '"]');
      if (!button || button.disabled) throw new Error('QA_MAIN_RETURN_SIDEBAR_CONTROL_MISSING:' + tab);
      button.click();
      await wait(() => activeTab() === tab, tab);
      if (tab === 'tools' && waitForArtifactReady) await wait(() => document.querySelector('canvas[data-zen-artifact-engine="gallery"]')?.dataset.zenArtifactEngineStatus === 'ready', 'artifact-ready');
      if (dwellMs > 0) await pause(dwellMs);
      const departure = { atMs: performance.now(), activeTab: activeTab(), waitForArtifactReady, dwellMs,
        artifactStatus: tab === 'tools'
          ? document.querySelector('canvas[data-zen-artifact-engine="gallery"]')?.dataset.zenArtifactEngineStatus ?? 'absent'
          : null };
      if (!canvas.isConnected) throw new Error('QA_MAIN_RETURN_PARKED_CANVAS_DISCONNECTED');
      return { ...await metrics(), departure };
    },
    async returnSidebar(kind) {
      if (!['tools', 'schedule'].includes(activeTab())) throw new Error('QA_MAIN_RETURN_SIDEBAR_NOT_ACTIVE');
      await prepareReturn(kind);
      const button = document.querySelector('#dashboard-sidebar button[data-tab="main"]');
      if (!button || button.disabled) throw new Error('QA_MAIN_RETURN_MAIN_CONTROL_MISSING');
      button.click();
    },
    async waitVisibility(visibility) {
      await wait(() => document.visibilityState === visibility, visibility);
      return read();
    },
    async takePaint() {
      if (!pending) throw new Error('QA_MAIN_RETURN_NOT_PREPARED');
      try { return await pending; } finally { pending = null; rejectPending = null; }
    },
    async waitProgress(beforeFrames) {
      const started = performance.now();
      let snapshot;
      do {
        snapshot = await metrics();
        if (!snapshot.sameCanvas) throw new Error('QA_MAIN_RETURN_CANVAS_REPLACED');
        if (snapshot.visibility !== 'visible') throw new Error('QA_MAIN_RETURN_DOCUMENT_HIDDEN');
        if (snapshot.sampleFrames > beforeFrames) return snapshot;
        await pause(100);
      } while (performance.now() - started < 20000);
      throw new Error('QA_MAIN_RETURN_WORKER_NOT_ADVANCING');
    },
    dispose() {
      cancelFrameWait();
      rejectPending?.(new Error('QA_MAIN_RETURN_DISPOSED'));
      if (globalThis[key] !== probe) throw new Error('QA_MAIN_RETURN_PROBE_OWNERSHIP_LOST');
      delete globalThis[key];
    },
  };
  globalThis[key] = probe;
  return read();
}

export async function runDashboardMainReturnJourney({ harness, page, signal, capture, record, browserAwayMs }) {
  if (!Number.isInteger(browserAwayMs) || browserAwayMs < 10000 || browserAwayMs > 600000) {
    throw new Error('QA_MAIN_RETURN_AWAY_DURATION_INVALID');
  }
  const samples = [], activations = [], tabStates = [];
  let otherPage = null, installed = false, step = 'install', primaryError = null;
  const call = (method, ...args) => evaluate(harness.cdp, page.sessionId,
    `globalThis[${JSON.stringify(PROBE_KEY)}][${JSON.stringify(method)}](...${JSON.stringify(args)})`,
    { timeoutMs: 25000 });
  const collectReturn = async kind => {
    const sample = await call('takePaint');
    // This image follows the observed paint opportunity; screenshot transport
    // is not claimed to capture the exact first compositor frame.
    sample.screenshot = await capture(kind);
    sample.after = await call('waitProgress', sample.beforeFrames);
    samples.push(sample);
    requireMainReturnSample(sample);
  };
  const readTabPair = async (stage, expectedMainActive = null) => {
    const tabs = await Promise.all([harness.resolveTabForPage(page), harness.resolveTabForPage(otherPage)]);
    const [main, away] = tabs.map(tab => ({ tabId: tab.id, windowId: tab.windowId, active: tab.active }));
    const receipt = { stage, main, away, windowFocusRequested: false };
    tabStates.push(receipt);
    if (main.tabId !== page.tabId || away.tabId !== otherPage.tabId || main.tabId === away.tabId
      || !Number.isInteger(main.windowId) || main.windowId !== away.windowId) {
      throw new Error('QA_MAIN_RETURN_TAB_WINDOW_MISMATCH');
    }
    if (expectedMainActive !== null && (main.active !== expectedMainActive || away.active !== !expectedMainActive)) {
      throw new Error('QA_MAIN_RETURN_TAB_ACTIVATION_MISMATCH');
    }
    return receipt;
  };
  try {
    await evaluate(harness.cdp, page.sessionId,
      `(${installMainReturnProbe.toString()})(${JSON.stringify(PROBE_KEY)})`);
    installed = true;
    for (let index = 1; index <= 3; index += 1) {
      signal?.throwIfAborted();
      step = 'internal-return-' + index;
      const parked = await call('parkInternal');
      await call('returnInternal', step);
      await collectReturn(step);
      samples.at(-1).parked = parked;
    }
    // Leave the newly selected surface before its artifact readiness gate or
    // settled dwell, then prove that the retained Main renderer still resumes.
    for (const [index, tab] of ['tools', 'schedule', 'tools'].entries()) {
      signal?.throwIfAborted();
      step = 'rapid-sidebar-return-' + (index + 1) + '-' + tab;
      const parked = await call('parkSidebar', tab, { waitForArtifactReady: false, dwellMs: 0 });
      await call('returnSidebar', step);
      await collectReturn(step);
      samples.at(-1).parked = parked;
    }
    for (const [index, tab] of ['tools', 'schedule', 'tools'].entries()) {
      signal?.throwIfAborted();
      step = 'sidebar-return-' + (index + 1) + '-' + tab;
      const parked = await call('parkSidebar', tab);
      await call('returnSidebar', step);
      await collectReturn(step);
      samples.at(-1).parked = parked;
    }
    // One additional target is owned and closed by the existing harness. Both
    // activations change only the selected browser tab, never OS/window focus.
    step = 'browser-return';
    signal?.throwIfAborted();
    otherPage = await harness.openPage('about:blank', { active: false, sameWindowAs: page });
    await readTabPair('before-away', true);
    activations.push(await harness.activateOwnedEphemeralPageWithoutWindowFocus(otherPage));
    await readTabPair('after-away', false);
    const hidden = await call('waitVisibility', 'hidden');
    let remainingAwayMs = browserAwayMs;
    while (remainingAwayMs > 0) {
      signal?.throwIfAborted();
      const interval = Math.min(remainingAwayMs, 30000);
      await sleep(interval);
      remainingAwayMs -= interval;
    }
    signal?.throwIfAborted();
    const parked = await call('prepareReturn', step);
    const observedHiddenMs = parked.atMs - hidden.atMs;
    if (parked.visibility !== 'hidden' || !Number.isFinite(observedHiddenMs) || observedHiddenMs < browserAwayMs) {
      throw new Error('QA_MAIN_RETURN_HIDDEN_DWELL_NOT_OBSERVED');
    }
    activations.push(await harness.activateOwnedEphemeralPageWithoutWindowFocus(page));
    await readTabPair('after-return', true);
    await collectReturn(step);
    samples.at(-1).hidden = hidden;
    samples.at(-1).parked = parked;
    const browserSample = samples.at(-1);
    browserSample.requestedAwayMs = browserAwayMs;
    browserSample.observedHiddenMs = observedHiddenMs;
    browserSample.sustainedProgress = [];
    let previous = browserSample.after;
    for (let index = 1; index <= 2; index += 1) {
      step = 'browser-return-sustained-' + index;
      signal?.throwIfAborted();
      await sleep(10000);
      const after = await call('waitProgress', previous.sampleFrames);
      requireMainReturnSample({ firstPaint: browserSample.firstPaint, beforeFrames: previous.sampleFrames, after });
      browserSample.sustainedProgress.push(after);
      previous = after;
    }
    browserSample.sustainedScreenshot = await capture('browser-return-sustained');
    const result = { samples, activations, tabStates, browserAwayMs,
      timingScope: 'Probe preparation immediately before Garden mode/sidebar DOM click or harness tab activation to observed visible Pond canvas and second rAF, including dispatch overhead; retained Bonsai canvas identity and Worker sample progression. Blank rAF counts are observations, not a zero-blank-frame acceptance threshold. Not FPS, native input latency, exact first compositor frame, or physical display latency.' };
    await record(result);
    return result;
  } catch (error) {
    primaryError = error;
    const diagnostic = { step, samples, activations, tabStates, error: error.message };
    if (otherPage) {
      try { await readTabPair('failure'); }
      catch (inspectionError) { diagnostic.tabInspectionError = inspectionError.message; }
    }
    if (installed) {
      try { diagnostic.page = await call('read'); }
      catch (inspectionError) { diagnostic.inspectionError = inspectionError.message; }
    }
    error.diagnostic = diagnostic;
    await record(diagnostic);
    throw error;
  } finally {
    const cleanupErrors = [];
    if (otherPage) {
      try { await harness.closePage(otherPage); }
      catch (error) { cleanupErrors.push(error); }
    }
    if (installed) {
      try { await call('dispose'); }
      catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) {
      const error = new AggregateError(primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors,
        'QA_MAIN_RETURN_CLEANUP_FAILED', { cause: primaryError || cleanupErrors[0] });
      if (primaryError?.diagnostic) error.diagnostic = primaryError.diagnostic;
      throw error;
    }
  }
}
