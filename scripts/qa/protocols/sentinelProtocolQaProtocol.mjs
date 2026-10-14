import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  SENTINEL_PROTOCOL_QA_ACTIONS,
  SENTINEL_PROTOCOL_QA_CHANNEL,
} from '../../../src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js';
import {
  resolveGlobalSentinelEntryRuptureTimeline,
} from '../../../src/domains/nudge/nudge/nudgeGameGlobalSentinelProtocol.js';
import {
  ExtensionChromiumHarness,
  evaluate,
  sleep,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  defineEntropyQaAttachedArtifactStage,
  ENTROPY_QA_TRUSTED_PAGE_PATH,
} from '../../e2e/qaProfileArtifactSlot.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import {
  openEntropyAttachOnlyActivePage,
  proveEntropyAttachedArtifactRuntimeReadiness,
  readEntropyPostRefreshTrackingRuntimeReadiness,
  requireEntropyAttachedPageExecution,
} from './attachOnlyActivePageAdapter.mjs';
import {
  QaAttachedBrowserOsFocusGuard,
} from '../resources/QaAttachedBrowserOsFocusGuard.mjs';

const SENTINEL_STAGE_FRAME_START_TIMEOUT_MS = 2_000;
// Attach-only QA pages intentionally stay unfocused. Chromium can therefore
// leave seconds between compositor frames even while the worker-side ritual is
// healthy (the attached Global run observed 2.736 s). Keep the strict
// "captured after observation" contract, but allow that bounded background
// cadence without accepting a stale frame.
const SENTINEL_STAGE_FRAME_CAPTURE_TIMEOUT_MS = 4_000;
const SENTINEL_PROTOCOL_STOP_TIMEOUT_MS = 4_000;
const SENTINEL_GLOBAL_RIFT_POLL_MS = 100;
const SENTINEL_ROOM478_POLL_MS = 100;
const SENTINEL_ROOM478_PAGE_PATH = '/src/pages/room-478.html';
const SENTINEL_RENDER_PRESSURE_RANK = Object.freeze({
  normal: 0,
  pressure: 1,
  severe: 2,
});

function normalizeSnapshotString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeSnapshotFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function requireWebUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    throw new Error('QA_SENTINEL_URL_INVALID');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('QA_SENTINEL_URL_INVALID');
  }
  return url;
}

function createRequest(action, targetTabId, payload = {}) {
  return {
    channel: SENTINEL_PROTOCOL_QA_CHANNEL,
    action,
    requestId: `sentinel-qa:${randomUUID()}`,
    targetTabId,
    payload,
  };
}

async function sendTrustedRuntimeMessage(harness, request, options = undefined) {
  const delivery = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.runtime.sendMessage(${JSON.stringify(request)}, (response) => {
      resolve({
        error: chrome.runtime.lastError?.message || null,
        response: response || null,
      });
    });
  })`, options);
  if (delivery?.error) {
    throw new Error(`QA_SENTINEL_MESSAGE_FAILED:${delivery.error}`);
  }
  const response = delivery?.response;
  if (
    response?.channel !== request.channel
    || response?.action !== request.action
    || response?.requestId !== request.requestId
    || response?.success !== true
  ) {
    throw new Error(
      `QA_SENTINEL_ACTION_FAILED:${request.action}:${response?.error || 'response_invalid'}`,
    );
  }
  return response.result;
}

function formatSentinelStopError(error) {
  const name = typeof error?.name === 'string' && error.name.trim()
    ? error.name.trim()
    : 'Error';
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : '';
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : String(error || 'unknown');
  return [name, code, message].filter(Boolean).join(':').slice(0, 512);
}

function isSentinelStopReconcileError(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error || '');
  if (/^CDP_COMMAND_TIMEOUT:/u.test(message)) return true;
  if (/^CDP_WEBSOCKET_(?:CLOSED|NOT_OPEN)$/u.test(message)) return true;
  if (/(?:timed out|timeout|execution was terminated)/iu.test(message)) return true;
  return /(?:message port|message channel|connection|session|target|execution context).*(?:closed|disconnected|destroyed|not open)/iu.test(message)
    || /receiving end does not exist/iu.test(message)
    || /cannot find context with specified id/iu.test(message);
}

function normalizeSentinelStopResult(result, {
  reconciled = false,
  firstError = null,
} = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('QA_SENTINEL_STOP_RESULT_INVALID');
  }
  if (typeof result.stopped !== 'boolean') {
    throw new Error('QA_SENTINEL_STOP_STATE_INVALID');
  }
  return Object.freeze({
    ...result,
    stopped: result.stopped,
    reconciled: reconciled === true,
    firstError: reconciled === true ? firstError : null,
  });
}

async function sendSentinelStopAttempt(harness, targetTabId) {
  return sendTrustedRuntimeMessage(
    harness,
    createRequest(SENTINEL_PROTOCOL_QA_ACTIONS.STOP, targetTabId),
    { timeoutMs: SENTINEL_PROTOCOL_STOP_TIMEOUT_MS },
  );
}

export function createSentinelProtocolStopController({ harness, targetTabId } = {}) {
  if (!harness || typeof harness.evaluateInTrustedPage !== 'function') {
    throw new Error('QA_SENTINEL_STOP_HARNESS_REQUIRED');
  }
  if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) {
    throw new Error('QA_SENTINEL_STOP_TARGET_TAB_REQUIRED');
  }
  let settledResult = null;
  let terminalError = null;
  let inFlight = null;

  async function executeStop() {
    try {
      return normalizeSentinelStopResult(
        await sendSentinelStopAttempt(harness, targetTabId),
      );
    } catch (firstError) {
      if (!isSentinelStopReconcileError(firstError)) throw firstError;
      const firstErrorDiagnostic = formatSentinelStopError(firstError);
      try {
        return normalizeSentinelStopResult(
          await sendSentinelStopAttempt(harness, targetTabId),
          { reconciled: true, firstError: firstErrorDiagnostic },
        );
      } catch (secondError) {
        const reconcileError = new Error(
          `QA_SENTINEL_STOP_RECONCILE_FAILED:${formatSentinelStopError(secondError)}`,
          { cause: secondError },
        );
        reconcileError.code = 'QA_SENTINEL_STOP_RECONCILE_FAILED';
        reconcileError.firstError = firstErrorDiagnostic;
        throw reconcileError;
      }
    }
  }

  return Object.freeze({
    async stop() {
      if (settledResult) return settledResult;
      if (terminalError) throw terminalError;
      if (!inFlight) {
        inFlight = executeStop().then(
          (result) => {
            settledResult = result;
            return result;
          },
          (error) => {
            terminalError = error;
            throw error;
          },
        );
      }
      return inFlight;
    },
  });
}

export async function finalizeSentinelQaTerminalStop({
  stopController,
  terminalReached,
} = {}) {
  if (!stopController || typeof stopController.stop !== 'function') {
    throw new Error('QA_SENTINEL_STOP_CONTROLLER_REQUIRED');
  }
  const stopped = await stopController.stop();
  return Object.freeze({
    status: terminalReached === true
      ? QA_RUN_STATUSES.PASS
      : QA_RUN_STATUSES.INCONCLUSIVE,
    stopped,
  });
}

export function summarizeSentinelQaSnapshot(result) {
  const snapshot = result?.snapshot || null;
  const diagnostics = snapshot?.diagnostics || null;
  if (!snapshot || !diagnostics) {
    throw new Error('QA_SENTINEL_RUNTIME_SNAPSHOT_INVALID');
  }
  return Object.freeze({
    active: result.active === true,
    mode: result.mode || null,
    runtimeStage: snapshot.runtimeStage || null,
    runtimeMode: snapshot.runtimeMode || null,
    workerRuntimeActive: snapshot.workerRuntimeActive === true,
    liveCount: normalizeSnapshotFiniteNonNegative(diagnostics.liveCount),
    lastRuntimeError: snapshot.lastRuntimeError || null,
    protocolScope: diagnostics.protocolScope || null,
    protocolVariant: diagnostics.protocolVariant || null,
    protocolSystem: diagnostics.protocolSystem || null,
    scenePhase: diagnostics.scenePhase || null,
    siteFurinPhase: diagnostics.siteFurinPhase || null,
    siteFurinExitChoice: diagnostics.siteFurinExitChoice,
    siteFurinExitElapsedMs: diagnostics.siteFurinExitElapsedMs,
    siteFurinExitProgress: diagnostics.siteFurinExitProgress,
    siteFurinExitComplete: diagnostics.siteFurinExitComplete,
    siteFurinVisibleElapsedMs: diagnostics.siteFurinVisibleElapsedMs,
    siteFurinDurationMs: diagnostics.siteFurinDurationMs,
    siteFurinReady: diagnostics.siteFurinReady,
    siteFurinCompleted: diagnostics.siteFurinCompleted,
    siteFurinMediaHold: diagnostics.mediaHold,
    siteFurinScrollLocked: diagnostics.scrollLocked,
    globalSentinelGamePhase: diagnostics.globalSentinelGamePhase || null,
    globalSentinelEntryRevealProgress: normalizeSnapshotFiniteNonNegative(diagnostics.globalSentinelEntryRevealProgress),
    globalSentinelRhythmBeatIndex: diagnostics.globalSentinelRhythmBeatIndex,
    globalSentinelRhythmActIndex: diagnostics.globalSentinelRhythmActIndex,
    globalSentinelRhythmPhase: diagnostics.globalSentinelRhythmPhase,
    globalSentinelRhythmPhaseProgress: diagnostics.globalSentinelRhythmPhaseProgress,
    globalSentinelFracture: Number(diagnostics.globalSentinelFracture) || 0,
    globalSentinelDormantCount: Number(diagnostics.globalSentinelDormantCount) || 0,
    globalSentinelHitAftermathActiveCount:
      Number(diagnostics.globalSentinelHitAftermathActiveCount) || 0,
    globalSentinelHitAftermathPhase: diagnostics.globalSentinelHitAftermathPhase || null,
    globalSentinelHitAftermathProgress:
      Number(diagnostics.globalSentinelHitAftermathProgress) || 0,
    globalSentinelHitAftermathTerminal:
      diagnostics.globalSentinelHitAftermathTerminal === true,
    globalSentinelHitAftermathSerial:
      Number(diagnostics.globalSentinelHitAftermathSerial) || 0,
    globalSentinelRiftOpenProgress:
      Number(diagnostics.globalSentinelRiftOpenProgress) || 0,
    globalSentinelRiftInviteOpen:
      diagnostics.globalSentinelRiftInviteOpen === true,
    renderPressureLevel: normalizeSnapshotString(diagnostics.renderPressureLevel),
    renderBudgetPolicyId: normalizeSnapshotString(diagnostics.renderBudgetPolicyId),
    effectiveDpr: diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.effectiveDpr),
    renderFrameIntervalEmaMs:
      diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.renderFrameIntervalEmaMs),
    renderWorkTimeEmaMs:
      diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.renderWorkTimeEmaMs),
    frameWorkMs: diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.frameWorkMs),
    updateWorkMs: diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.updateWorkMs),
    renderWorkMs: diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.renderWorkMs),
    frameWorkP95Ms: diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.frameWorkP95Ms),
    frameWorkMaxMs: diagnostics.protocolScope === 'site' ? null : normalizeSnapshotFiniteNonNegative(diagnostics.frameWorkMaxMs),
  });
}

export function createSentinelRenderPerformanceEnvelopeAccumulator() {
  let sampleCount = 0;
  let highestPressureLevel = null;
  let minEffectiveDpr = null;
  let maxFrameWorkP95Ms = 0;
  let maxFrameWorkMaxMs = 0;
  let maxUpdateWorkMs = 0;
  let maxRenderWorkMs = 0;
  let maxFrameIntervalEmaMs = 0;
  let maxWorkTimeEmaMs = 0;

  return Object.freeze({
    record(snapshot) {
      if (snapshot?.protocolScope === 'site') return;
      sampleCount += 1;
      const pressureLevel = normalizeSnapshotString(snapshot?.renderPressureLevel);
      if (Object.hasOwn(SENTINEL_RENDER_PRESSURE_RANK, pressureLevel)) {
        const currentRank = highestPressureLevel === null
          ? -1
          : SENTINEL_RENDER_PRESSURE_RANK[highestPressureLevel];
        if (SENTINEL_RENDER_PRESSURE_RANK[pressureLevel] > currentRank) {
          highestPressureLevel = pressureLevel;
        }
      }
      const effectiveDpr = normalizeSnapshotFiniteNonNegative(snapshot?.effectiveDpr);
      if (effectiveDpr > 0) {
        minEffectiveDpr = minEffectiveDpr === null
          ? effectiveDpr
          : Math.min(minEffectiveDpr, effectiveDpr);
      }
      maxFrameWorkP95Ms = Math.max(
        maxFrameWorkP95Ms,
        normalizeSnapshotFiniteNonNegative(snapshot?.frameWorkP95Ms),
      );
      maxFrameWorkMaxMs = Math.max(
        maxFrameWorkMaxMs,
        normalizeSnapshotFiniteNonNegative(snapshot?.frameWorkMaxMs),
      );
      maxUpdateWorkMs = Math.max(
        maxUpdateWorkMs,
        normalizeSnapshotFiniteNonNegative(snapshot?.updateWorkMs),
      );
      maxRenderWorkMs = Math.max(
        maxRenderWorkMs,
        normalizeSnapshotFiniteNonNegative(snapshot?.renderWorkMs),
      );
      maxFrameIntervalEmaMs = Math.max(
        maxFrameIntervalEmaMs,
        normalizeSnapshotFiniteNonNegative(snapshot?.renderFrameIntervalEmaMs),
      );
      maxWorkTimeEmaMs = Math.max(
        maxWorkTimeEmaMs,
        normalizeSnapshotFiniteNonNegative(snapshot?.renderWorkTimeEmaMs),
      );
    },

    snapshot() {
      return Object.freeze({
        sampleCount,
        highestPressureLevel,
        minEffectiveDpr,
        maxFrameWorkP95Ms,
        maxFrameWorkMaxMs,
        maxUpdateWorkMs,
        maxRenderWorkMs,
        maxFrameIntervalEmaMs,
        maxWorkTimeEmaMs,
      });
    },
  });
}

async function readSnapshot(harness, targetTabId) {
  return summarizeSentinelQaSnapshot(await sendTrustedRuntimeMessage(
    harness,
    createRequest(SENTINEL_PROTOCOL_QA_ACTIONS.SNAPSHOT, targetTabId),
  ));
}

export function resolveSentinelQaStageKey(scope, snapshot) {
  if (scope === 'global') {
    const entryProgress = snapshot.globalSentinelEntryRevealProgress;
    if (snapshot.globalSentinelGamePhase === 'repair_race' && Number.isFinite(entryProgress) && entryProgress < 1) {
      const timeline = resolveGlobalSentinelEntryRuptureTimeline(entryProgress);
      return 'entry-' + timeline.stage + '-' + Math.floor(timeline.recoverySweep * 4);
    }
    const fractureBucket = Math.round(snapshot.globalSentinelFracture * 4) * 25;
    const aftermathActive = snapshot.globalSentinelHitAftermathActiveCount > 0;
    const aftermathProgress = Math.max(
      0,
      Math.min(1, Number(snapshot.globalSentinelHitAftermathProgress) || 0),
    );
    const aftermathState = aftermathActive
      ? [
        'aftermath',
        Math.max(0, Math.round(Number(snapshot.globalSentinelHitAftermathSerial) || 0)),
        snapshot.globalSentinelHitAftermathPhase || 'unknown',
        Math.min(100, Math.floor(aftermathProgress * 4) * 25),
        snapshot.globalSentinelHitAftermathTerminal ? 'terminal' : 'regular',
      ].join('-')
      : 'aftermath-idle';
    if (snapshot.scenePhase === 'rift') {
      const riftProgress = Math.max(
        0,
        Math.min(1, Number(snapshot.globalSentinelRiftOpenProgress) || 0),
      );
      const riftBucket = Math.min(100, Math.floor(riftProgress * 4) * 25);
      const inviteState = snapshot.globalSentinelRiftInviteOpen
        ? 'invite-open'
        : 'invite-closed';
      return `${snapshot.globalSentinelGamePhase || 'unknown'}-${fractureBucket}-${aftermathState}-rift-${riftBucket}-${inviteState}`;
    }
    return `${snapshot.globalSentinelGamePhase || 'unknown'}-${fractureBucket}-${aftermathState}-${snapshot.scenePhase || 'unknown'}`;
  }
  return `${snapshot.siteFurinPhase || 'unknown'}-${Math.floor(snapshot.siteFurinVisibleElapsedMs / 500) * 500}-${snapshot.scenePhase || 'unknown'}${snapshot.captureSettled ? '-settled' : ''}`;

}

function isTerminal(scope, snapshot) {
  return scope === 'global'
    ? snapshot.scenePhase === 'rift'
    : snapshot.siteFurinPhase === 'choice' && snapshot.siteFurinReady === true;
}

function normalizeFrameTime(value, fallback = Date.now()) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function createSentinelStageFrameRecorder({
  cdp,
  sessionId,
  now = Date.now,
  scheduleTimeout = (callback, delayMs) => setTimeout(callback, delayMs),
  clearScheduledTimeout = (timeoutId) => clearTimeout(timeoutId),
} = {}) {
  if (!cdp || typeof cdp.send !== 'function' || typeof cdp.subscribe !== 'function') {
    throw new Error('QA_SENTINEL_FRAME_STREAM_CDP_REQUIRED');
  }
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('QA_SENTINEL_FRAME_STREAM_SESSION_REQUIRED');
  }

  let started = false;
  let stopped = false;
  let pageStreamActive = false;
  let unsubscribe = null;
  let latestFrame = null;
  let frameSerial = 0;
  let streamError = null;
  const waiters = new Set();

  function rejectWaiters(error) {
    for (const waiter of waiters) {
      clearScheduledTimeout(waiter.timeoutId);
      waiter.reject(error);
    }
    waiters.clear();
  }

  function failStream(error) {
    if (streamError) return;
    streamError = error instanceof Error
      ? error
      : new Error(`QA_SENTINEL_FRAME_STREAM_FAILED:${String(error || 'unknown')}`);
    rejectWaiters(streamError);
  }

  function resolveWaiters(frame) {
    for (const waiter of [...waiters]) {
      if (frame.capturedAtMs <= waiter.afterMs) continue;
      waiters.delete(waiter);
      clearScheduledTimeout(waiter.timeoutId);
      waiter.resolve(frame);
    }
  }

  function handleFrame(event) {
    if (event?.sessionId !== sessionId || stopped) return;
    const frameSessionId = Number(event.params?.sessionId);
    const data = event.params?.data;
    if (!Number.isSafeInteger(frameSessionId) || frameSessionId < 0) {
      failStream(new Error('QA_SENTINEL_FRAME_STREAM_FRAME_SESSION_INVALID'));
      return;
    }
    void cdp.send('Page.screencastFrameAck', {
      sessionId: frameSessionId,
    }, sessionId).catch((error) => {
      failStream(new Error(
        `QA_SENTINEL_FRAME_STREAM_ACK_FAILED:${error?.message || String(error)}`,
      ));
    });
    if (typeof data !== 'string' || !data) {
      failStream(new Error('QA_SENTINEL_FRAME_STREAM_DATA_REQUIRED'));
      return;
    }
    frameSerial += 1;
    const capturedAtMs = normalizeFrameTime(now());
    latestFrame = Object.freeze({
      serial: frameSerial,
      data,
      capturedAtMs,
      capturedAt: new Date(capturedAtMs).toISOString(),
      browserTimestampSeconds: Number.isFinite(Number(event.params?.metadata?.timestamp))
        ? Number(event.params.metadata.timestamp)
        : null,
    });
    resolveWaiters(latestFrame);
  }

  function waitForFrameAfter(afterMs, timeoutMs) {
    if (streamError) return Promise.reject(streamError);
    if (stopped) return Promise.reject(new Error('QA_SENTINEL_FRAME_STREAM_STOPPED'));
    const normalizedAfterMs = normalizeFrameTime(afterMs, 0);
    if (latestFrame && latestFrame.capturedAtMs > normalizedAfterMs) {
      return Promise.resolve(latestFrame);
    }
    const boundedTimeoutMs = Math.max(1, Math.round(Number(timeoutMs) || 0));
    return new Promise((resolve, reject) => {
      const waiter = {
        afterMs: normalizedAfterMs,
        resolve,
        reject,
        timeoutId: null,
      };
      waiter.timeoutId = scheduleTimeout(() => {
        if (!waiters.delete(waiter)) return;
        reject(new Error(`QA_SENTINEL_FRAME_STREAM_TIMEOUT:${boundedTimeoutMs}`));
      }, boundedTimeoutMs);
      waiters.add(waiter);
    });
  }

  return Object.freeze({
    async start() {
      if (started) throw new Error('QA_SENTINEL_FRAME_STREAM_ALREADY_STARTED');
      started = true;
      unsubscribe = cdp.subscribe('Page.screencastFrame', handleFrame);
      try {
        await cdp.send('Page.startScreencast', {
          format: 'png',
          everyNthFrame: 1,
        }, sessionId);
        pageStreamActive = true;
        await waitForFrameAfter(0, SENTINEL_STAGE_FRAME_START_TIMEOUT_MS);
      } catch (error) {
        unsubscribe?.();
        unsubscribe = null;
        stopped = true;
        if (pageStreamActive) {
          try {
            await cdp.send('Page.stopScreencast', {}, sessionId);
          } catch (cleanupError) {
            throw new Error(
              `QA_SENTINEL_FRAME_STREAM_START_CLEANUP_FAILED:${error?.message || String(error)}`
              + `:${cleanupError?.message || String(cleanupError)}`,
            );
          }
          pageStreamActive = false;
        }
        throw error;
      }
    },

    async captureAfter(observedAtMs, {
      timeoutMs = SENTINEL_STAGE_FRAME_CAPTURE_TIMEOUT_MS,
    } = {}) {
      if (!started) throw new Error('QA_SENTINEL_FRAME_STREAM_NOT_STARTED');
      return waitForFrameAfter(observedAtMs, timeoutMs);
    },

    async stop() {
      if (stopped) return { stopped: false, frameCount: frameSerial };
      stopped = true;
      unsubscribe?.();
      unsubscribe = null;
      rejectWaiters(new Error('QA_SENTINEL_FRAME_STREAM_STOPPED'));
      if (pageStreamActive) {
        await cdp.send('Page.stopScreencast', {}, sessionId);
        pageStreamActive = false;
      }
      if (streamError) throw streamError;
      return { stopped: true, frameCount: frameSerial };
    },
  });
}

async function captureBufferedFrame(frameRecorder, outputPath, observedAtMs) {
  const frame = await frameRecorder.captureAfter(observedAtMs);
  await fs.writeFile(outputPath, Buffer.from(frame.data, 'base64'));
  return Object.freeze({
    screenshotAttachment: path.basename(outputPath),
    frameEvidence: Object.freeze({
      source: 'page_screencast',
      frameSerial: frame.serial,
      capturedAt: frame.capturedAt,
      captureLagMs: Math.max(0, frame.capturedAtMs - observedAtMs),
      browserTimestampSeconds: frame.browserTimestampSeconds,
    }),
  });
}

async function readSentinelSurfaceComposition(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const root = document.getElementById('friction-nudge-root');
    const shadow = root?.shadowRoot;
    const elements = [document.documentElement, document.body, root,
      shadow?.getElementById('nudgeScene'), shadow?.getElementById('nudgeCanvas'),
      shadow?.querySelector('iframe')];
    return elements.filter(Boolean).map(element => {
      const style = getComputedStyle(element);
      return { tag: element.tagName, id: element.id, classes: element.className,
        opacity: style.opacity, filter: style.filter, blend: style.mixBlendMode,
        fullscreenActive: Boolean(document.fullscreenElement),
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    });
  })()`, { awaitPromise: false, timeoutMs: 2_000 });
}

async function recordStage({
  scope,
  harness,
  page,
  snapshot,
  stages,
  seenStageKeys,
  renderPerformanceAccumulator = null,
  attachmentsDir,
  captureScreenshots,
  frameRecorder = null,
  evidence,
}) {
  renderPerformanceAccumulator?.record(snapshot);
  const key = resolveSentinelQaStageKey(scope, snapshot);
  if (seenStageKeys.has(key)) return false;
  seenStageKeys.add(key);
  const observedAtMs = Date.now();
  let screenshotAttachment = null;
  let frameEvidence = null;
  if (captureScreenshots) {
    if (!frameRecorder) {
      throw new Error('QA_SENTINEL_FRAME_STREAM_REQUIRED');
    }
    const safeKey = key.replace(/[^a-z0-9-]+/giu, '-').toLowerCase();
    const outputPath = path.join(
      attachmentsDir,
      `${String(stages.length).padStart(2, '0')}-${safeKey}.png`,
    );
    ({ screenshotAttachment, frameEvidence } = await captureBufferedFrame(
      frameRecorder,
      outputPath,
      observedAtMs,
    ));
  }
  const surfaceComposition = captureScreenshots && scope === 'global'
    ? await readSentinelSurfaceComposition(harness, page)
    : null;
  if (surfaceComposition) {
    const root = surfaceComposition.find(element => element.id === 'friction-nudge-root');
    // A human may already have entered Room 478 while its last frame was
    // captured. Destination readiness owns that absent-root case.
    if (root && Number(root.opacity) !== 1) {
      await evidence.event('QA_SENTINEL_SURFACE_COMPOSITION_FAILED', { key, surfaceComposition });
      throw new Error('QA_SENTINEL_ROOT_OPACITY_NOT_OPAQUE');
    }
  }
  const stage = Object.freeze({
    surfaceComposition,
    index: stages.length,
    key,
    observedAt: new Date(observedAtMs).toISOString(),
    screenshotAttachment,
    frameEvidence,
    snapshot,
  });
  stages.push(stage);
  await evidence.event('QA_SENTINEL_STAGE_OBSERVED', stage);
  process.stdout.write(`${JSON.stringify({
    status: 'SENTINEL_PROTOCOL_PROGRESS',
    scope,
    key,
    screenshotAttachment,
    snapshot,
  })}\n`);
  return true;
}

async function clickShadowButton(harness, page, buttonId) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(() => {
      const root = document.getElementById('friction-nudge-root');
      const button = root?.shadowRoot?.getElementById(${JSON.stringify(buttonId)});
      if (!button || button.disabled || button.hidden) return false;
      button.click();
      return true;
    })()`,
    { awaitPromise: false, timeoutMs: 2_000 },
  );
}

function isTransientSentinelPageNavigationError(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error || '');
  return /(?:execution context was destroyed|cannot find context with specified id|inspected target navigated or closed|CDP_COMMAND_TIMEOUT:Runtime\.evaluate)/iu.test(message);
}

async function readGlobalSentinelRoom478PageState(harness, page) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(() => {
      const root = document.querySelector('[data-room478-root]');
      const startupError = document.querySelector('[data-room478-startup-error]');
      return {
        href: location.href,
        readyState: document.readyState,
        rootReady: Boolean(root),
        room478Scene: root?.dataset?.room478Scene || null,
        stage: root?.dataset?.stage || null,
        phase: root?.dataset?.phase || null,
        startupError: startupError?.getAttribute('data-room478-startup-error') || null,
      };
    })()`,
    { awaitPromise: false, timeoutMs: 800, commandTimeoutMs: 1_000 },
  );
}

function parseRoom478Ratio(url, key) {
  const raw = url.searchParams.get(key);
  const value = Number(raw);
  return raw !== null && raw.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

export function resolveGlobalSentinelRoom478Readiness(pageState, {
  extensionId,
} = {}) {
  if (typeof extensionId !== 'string' || !extensionId.trim()) {
    throw new Error('QA_SENTINEL_ROOM478_EXTENSION_ID_REQUIRED');
  }
  let url;
  try {
    url = new URL(pageState?.href || '');
  } catch (_error) {
    return Object.freeze({ status: 'waiting', naturalHostStopObserved: false });
  }
  const expectedExtensionId = extensionId.trim();
  if (url.protocol !== 'chrome-extension:' || url.host !== expectedExtensionId) {
    if (['http:', 'https:', 'about:'].includes(url.protocol)) {
      return Object.freeze({ status: 'waiting', naturalHostStopObserved: false });
    }
    return Object.freeze({
      status: 'unexpected_navigation',
      naturalHostStopObserved: false,
      destinationPath: url.pathname,
    });
  }
  if (url.pathname !== SENTINEL_ROOM478_PAGE_PATH) {
    return Object.freeze({
      status: 'unexpected_navigation',
      naturalHostStopObserved: true,
      destinationPath: url.pathname,
    });
  }
  if (pageState?.startupError) {
    return Object.freeze({
      status: 'startup_failed',
      naturalHostStopObserved: true,
      destinationPath: url.pathname,
      startupError: String(pageState.startupError).slice(0, 160),
    });
  }

  const source = String(url.searchParams.get('source') || '').trim();
  const runId = String(url.searchParams.get('runId') || '').trim();
  const rawSeed = String(url.searchParams.get('seed') || '').trim();
  const seed = /^\d+$/u.test(rawSeed) ? Number(rawSeed) : Number.NaN;
  const originX = parseRoom478Ratio(url, 'originX');
  const originY = parseRoom478Ratio(url, 'originY');
  const handoffValid = source === 'global_sentinel_success'
    && runId.length > 0
    && Number.isSafeInteger(seed)
    && seed >= 0
    && seed <= 0x7fffffff
    && originX !== null
    && originY !== null;
  if (!handoffValid) {
    return Object.freeze({
      status: 'handoff_invalid',
      naturalHostStopObserved: true,
      destinationPath: url.pathname,
    });
  }

  const documentReady = pageState?.readyState === 'interactive'
    || pageState?.readyState === 'complete';
  const roomReady = documentReady
    && pageState?.rootReady === true
    && typeof pageState?.room478Scene === 'string'
    && pageState.room478Scene.length > 0
    && typeof pageState?.stage === 'string'
    && pageState.stage.length > 0
    && typeof pageState?.phase === 'string'
    && pageState.phase.length > 0;
  if (!roomReady) {
    return Object.freeze({
      status: 'loading',
      naturalHostStopObserved: true,
      destinationPath: url.pathname,
    });
  }
  return Object.freeze({
    status: 'ready',
    naturalHostStopObserved: true,
    destinationPath: url.pathname,
    source,
    runId,
    seed,
    origin: Object.freeze({ x: originX, y: originY }),
    scene: pageState.room478Scene,
    stage: pageState.stage,
    phase: pageState.phase,
  });
}

export async function awaitGlobalSentinelRiftReady({
  initialSnapshot = null,
  readRuntimeSnapshot,
  recordRuntimeSnapshot,
  sleepFor = sleep,
  now = Date.now,
  deadlineAtMs,
} = {}) {
  if (typeof readRuntimeSnapshot !== 'function') {
    throw new Error('QA_SENTINEL_GLOBAL_RIFT_SNAPSHOT_READER_REQUIRED');
  }
  if (typeof recordRuntimeSnapshot !== 'function') {
    throw new Error('QA_SENTINEL_GLOBAL_RIFT_SNAPSHOT_RECORDER_REQUIRED');
  }
  if (typeof sleepFor !== 'function' || typeof now !== 'function') {
    throw new Error('QA_SENTINEL_GLOBAL_RIFT_CLOCK_REQUIRED');
  }
  if (!Number.isFinite(deadlineAtMs)) {
    throw new Error('QA_SENTINEL_GLOBAL_RIFT_DEADLINE_REQUIRED');
  }

  let snapshot = initialSnapshot;
  while (now() <= deadlineAtMs) {
    if (!snapshot) snapshot = await readRuntimeSnapshot();
    await recordRuntimeSnapshot(snapshot);
    if (
      snapshot.scenePhase === 'rift'
      && snapshot.globalSentinelRiftInviteOpen === true
      && Number(snapshot.globalSentinelRiftOpenProgress) >= 1
    ) {
      return Object.freeze({ ready: true, snapshot });
    }
    if (now() >= deadlineAtMs) break;
    await sleepFor(Math.min(SENTINEL_GLOBAL_RIFT_POLL_MS, deadlineAtMs - now()));
    snapshot = await readRuntimeSnapshot();
  }
  return Object.freeze({ ready: false, snapshot });
}

export async function waitForGlobalSentinelRoom478Ready({
  extensionId,
  readPageState,
  onNaturalHostStopObserved = null,
  sleepFor = sleep,
  now = Date.now,
  deadlineAtMs,
} = {}) {
  if (typeof readPageState !== 'function') {
    throw new Error('QA_SENTINEL_ROOM478_PAGE_READER_REQUIRED');
  }
  if (typeof sleepFor !== 'function' || typeof now !== 'function') {
    throw new Error('QA_SENTINEL_ROOM478_CLOCK_REQUIRED');
  }
  if (!Number.isFinite(deadlineAtMs)) {
    throw new Error('QA_SENTINEL_ROOM478_DEADLINE_REQUIRED');
  }
  let naturalHostStopObserved = false;
  let lastStatus = 'waiting';
  while (now() <= deadlineAtMs) {
    let pageState;
    try {
      pageState = await readPageState();
    } catch (error) {
      if (!isTransientSentinelPageNavigationError(error)) throw error;
      if (now() >= deadlineAtMs) break;
      await sleepFor(Math.min(SENTINEL_ROOM478_POLL_MS, deadlineAtMs - now()));
      continue;
    }
    const readiness = resolveGlobalSentinelRoom478Readiness(pageState, { extensionId });
    lastStatus = readiness.status;
    if (readiness.naturalHostStopObserved && !naturalHostStopObserved) {
      naturalHostStopObserved = true;
      await onNaturalHostStopObserved?.(readiness);
    }
    if (readiness.status === 'ready') {
      return Object.freeze({ ready: true, naturalHostStopObserved, handoff: readiness });
    }
    if (readiness.status === 'startup_failed') {
      throw new Error(`QA_SENTINEL_ROOM478_STARTUP_FAILED:${readiness.startupError}`);
    }
    if (readiness.status === 'handoff_invalid') {
      throw new Error('QA_SENTINEL_ROOM478_HANDOFF_INVALID');
    }
    if (readiness.status === 'unexpected_navigation') {
      throw new Error(
        `QA_SENTINEL_GLOBAL_RIFT_NAVIGATION_UNEXPECTED:${readiness.destinationPath || 'unknown'}`,
      );
    }
    if (now() >= deadlineAtMs) break;
    await sleepFor(Math.min(SENTINEL_ROOM478_POLL_MS, deadlineAtMs - now()));
  }
  return Object.freeze({
    ready: false,
    naturalHostStopObserved,
    handoff: null,
    lastStatus,
  });
}

export async function driveGlobalProtocol(options) {
  const deadline = options.deadlineAtMs;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const sleepFor = typeof options.sleepFor === 'function' ? options.sleepFor : sleep;
  const clickGlobalAction = typeof options.clickGlobalAction === 'function'
    ? options.clickGlobalAction
    // This background contract exercises the semantic/windowed path. Native
    // fullscreen transitions belong to the operator-owned human setup, since
    // Chrome can raise its window when leaving fullscreen on navigation.
    : () => clickShadowButton(options.harness, options.page, 'nudgeGlobalSentinelAction');
  const readGlobalSnapshot = typeof options.readRuntimeSnapshot === 'function'
    ? options.readRuntimeSnapshot
    : () => readSnapshot(options.harness, options.targetTabId);
  const recordGlobalSnapshot = typeof options.recordRuntimeSnapshot === 'function'
    ? options.recordRuntimeSnapshot
    : (snapshot) => recordStage({ ...options, scope: 'global', snapshot });
  let snapshot = await readGlobalSnapshot();
  const attemptedBeats = new Set();
  let starterRequested = false;
  let starterRequestedAtMs = null;
  while (now() < deadline && !isTerminal('global', snapshot)) {
    if (snapshot.lastRuntimeError) throw new Error('QA_SENTINEL_RUNTIME_ERROR:' + snapshot.lastRuntimeError);
    const starter = snapshot.globalSentinelGamePhase === 'awaiting_start';
    if (starter && starterRequestedAtMs !== null && now() - starterRequestedAtMs >= 5_000) {
      throw new Error('QA_SENTINEL_START_INPUT_NOT_ACCEPTED');
    }
    const phaseProgress = snapshot.globalSentinelRhythmPhaseProgress;
    const beatKey = snapshot.globalSentinelRhythmActIndex + ':' + snapshot.globalSentinelRhythmBeatIndex;
    const contact = snapshot.globalSentinelRhythmPhase === 'active'
      && Number.isFinite(phaseProgress) && phaseProgress >= 0.36 && phaseProgress <= 0.62
      && snapshot.liveCount > 0 && !attemptedBeats.has(beatKey);
    if ((starter && !starterRequested) || contact) {
      const dispatched = await clickGlobalAction();
      if (dispatched !== false) {
        if (starter) {
          starterRequested = true;
          starterRequestedAtMs = now();
        }
        else attemptedBeats.add(beatKey);
      }
    }
    // Observe the production state machine; no copied tempo, shortened policy,
    // forced success or repeated input into a consumed contact window.
    await sleepFor(Math.min(140, Math.max(1, deadline - now())));
    snapshot = await readGlobalSnapshot();
    await recordGlobalSnapshot(snapshot);
  }
  return snapshot;
}

export async function driveSiteFurinWindGesture({ harness, page, cancel = false, sleepFor = sleep }) {
  const rect = await evaluate(harness.cdp, page.sessionId, `(() => {
    const wind = document.getElementById('friction-nudge-root')?.shadowRoot?.getElementById('nudgeFurinWind');
    if (!wind || wind.disabled) throw new Error('QA_SITE_FURIN_WIND_UNAVAILABLE');
    const rect = wind.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 40) throw new Error('QA_SITE_FURIN_WIND_SURFACE_INVALID');
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })()`);
  const start = { x: rect.x + rect.width * 0.3, y: rect.y + rect.height * 0.6 };
  const end = { x: rect.x + rect.width * 0.7, y: start.y };
  const send = payload => harness.cdp.send('Input.dispatchMouseEvent', payload, page.sessionId);
  await send({ type: 'mouseMoved', button: 'none', buttons: 0, ...start });
  await send({ type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...start });
  // The product owns pointer capture, displacement and intent. QA sends native
  // input over the real surface; it never calls onLeave or forces a resolution.
  for (let step = 1; step <= 6; step += 1) {
    await send({ type: 'mouseMoved', button: 'left', buttons: 1,
      x: start.x + (end.x - start.x) * step / 6, y: start.y });
    await sleepFor(24);
  }
  if (cancel) {
    for (const type of ['keyDown', 'keyUp']) {
      await harness.cdp.send('Input.dispatchKeyEvent', {
        type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27,
      }, page.sessionId);
    }
  }
  await send({ type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...end });
  return Object.freeze({ control: 'nudgeFurinWind', mechanism: 'native_pointer_sweep',
    displacementCssPx: end.x - start.x, cancelledWithEscape: cancel });
}

async function driveSiteProtocol(options) {
  let snapshot = await readSnapshot(options.harness, options.targetTabId);
  // Arrival exposes both choices; passive waiting never resolves the session.
  await sleep(3200);
  snapshot = await readSnapshot(options.harness, options.targetTabId);
  if (!snapshot.active || snapshot.siteFurinCompleted !== false || !snapshot.siteFurinReady
    || snapshot.siteFurinPhase !== 'choice') throw new Error('QA_SITE_FURIN_PASSIVE_COMPLETION');
  await recordStage({ ...options, scope:'site',snapshot });
  const cancelledSweep = await driveSiteFurinWindGesture({ harness: options.harness, page: options.page, cancel: true });
  snapshot = await readSnapshot(options.harness, options.targetTabId);
  if (!snapshot.active || snapshot.siteFurinExitChoice !== null || snapshot.siteFurinCompleted !== false) {
    throw new Error('QA_SITE_FURIN_SWEEP_CANCELLATION_FAILED');
  }
  await sleep(700);
  snapshot = { ...await readSnapshot(options.harness, options.targetTabId), captureSettled: true };
  await recordStage({ ...options, scope: 'site', snapshot });
  if (snapshot.liveCount !== 0 || snapshot.workerRuntimeActive || snapshot.siteFurinReady !== true
    || !snapshot.siteFurinMediaHold?.active || !snapshot.siteFurinScrollLocked) {
    throw new Error('QA_SITE_FURIN_OWNER_CONTRACT_FAILED');
  }
  const surface = await evaluate(options.harness.cdp, options.page.sessionId, `(() => {
    const root = document.getElementById('friction-nudge-root');
    const stage = root?.shadowRoot?.getElementById('nudgeFurinStage');
    const svg = stage?.querySelector('svg');
    const attachmentGaps = svg ? ['hanger','striker','paper','paper-leaf'].map(joint => {
      const node = svg.querySelector('[data-zen-furin-'+joint+'-motion]');
      const x = joint === 'paper-leaf' ? node.querySelector('rect').width.baseVal.value / 2 : 0;
      const point = new DOMPoint(x,0);
      const inverse = svg.getScreenCTM().inverse();
      const actual = point.matrixTransform(inverse.multiply(node.getScreenCTM()));
      const tied = point.matrixTransform(inverse.multiply(node.parentNode.getScreenCTM()));
      return {joint, gap:Math.hypot(actual.x-tied.x,actual.y-tied.y)};
    }) : [];
    return { attachmentGaps, svgCount: stage?.querySelectorAll('svg').length, inert: document.body.inert,
      overflow: getComputedStyle(document.documentElement).overflow,
      scrollX, scrollY, width: innerWidth, height: innerHeight };
  })()`);
  if (surface.attachmentGaps.length !== 4 || surface.attachmentGaps.some(({gap}) => !Number.isFinite(gap) || gap > 0.02)) throw new Error('QA_SITE_FURIN_ATTACHMENT_GAP');
  if (surface.svgCount !== 1 || !surface.inert || surface.overflow !== 'hidden') throw new Error('QA_SITE_FURIN_ISOLATION_FAILED');
  for (const x of [surface.width * 0.45, surface.width * 0.6]) {
    await options.harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'none', buttons: 0,
      x, y: surface.height * 0.42 }, options.page.sessionId);
    await sleep(80);
  }
  await options.harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x:surface.width*.6,
    y:surface.height*.42, deltaX:0, deltaY:850 }, options.page.sessionId);
  await sleep(160);
  const after = await readSnapshot(options.harness, options.targetTabId);
  const scroll = await evaluate(options.harness.cdp, options.page.sessionId, '({x:scrollX,y:scrollY})');
  if (scroll.x !== surface.scrollX || scroll.y !== surface.scrollY || after.siteFurinVisibleElapsedMs !== snapshot.siteFurinVisibleElapsedMs
    || after.siteFurinExitChoice !== null || after.siteFurinCompleted !== false) throw new Error('QA_SITE_FURIN_POINTER_SCROLL_CONTRACT_FAILED');
  await options.evidence.event('QA_SENTINEL_SITE_CHIME_VERIFIED', { surface, after, cancelledSweep,
    hoverButtons: 0, forcedProtocolOutcome: false });
  // Leave runs after capture/focus evidence and frame-stream shutdown below.
  if (options.exitChoice === 'leave') return snapshot;
  // Exercise the real explicit continue action; teardown must follow its ACK.
  if (!await clickShadowButton(options.harness, options.page, 'nudgeFurinContinue')) {
    throw new Error('QA_SITE_FURIN_CONTINUE_UNAVAILABLE');
  }
  const until = Date.now()+4000;
  let closed = false;
  while (Date.now()<until) {
    const state = await readSnapshot(options.harness, options.targetTabId);
    if (!state.active) { closed=true; break; }
    await sleep(100);
  }
  if (!closed) throw new Error('QA_SITE_FURIN_CONTINUE_NOT_RESOLVED');
  const released = await evaluate(options.harness.cdp, options.page.sessionId,
    '({rootPresent:!!document.getElementById("friction-nudge-root"),inert:document.body.inert})');
  if (released.rootPresent || released.inert) throw new Error('QA_SITE_FURIN_RELEASE_FAILED');
  await options.evidence.event('QA_SENTINEL_SITE_CONTINUE_RESOLVED', released);
  return snapshot;
}

async function observeHumanProtocol(options) {
  const deadline = options.deadlineAtMs;
  let snapshot = await readSnapshot(options.harness, options.targetTabId);
  while (Date.now() < deadline && !isTerminal(options.scope, snapshot)) {
    await sleep(250);
    snapshot = await readSnapshot(options.harness, options.targetTabId);
    await recordStage({ ...options, snapshot });
  }
  return snapshot;
}

async function writeStageManifest(attachmentsDir, payload) {
  const outputPath = path.join(attachmentsDir, 'sentinel-protocol-stages.json');
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return path.basename(outputPath);
}

export async function executeQaProtocol(context) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    attachmentsDir,
    initialWindowFocusAnchor,
    attachedBrowserOsFocusGuard,
    attachedBrowserOsFocusBaseline,
    registerCleanup,
    reportBrowserGpuCapability,
    recoveryJournal,
  } = context;
  if (!['human', 'agent'].includes(plan.mode)) throw new Error('QA_SENTINEL_MODE_INVALID');
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_SENTINEL_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'attach_only' || !browser.cdpEndpoint) {
    throw new Error('QA_SENTINEL_ATTACH_ONLY_BROWSER_REQUIRED');
  }
  if (!Number.isInteger(browser.baselinePageTargetCount)) {
    throw new Error('QA_SENTINEL_BASELINE_PAGE_COUNT_REQUIRED');
  }
  if (
    browser.baselinePageTargetCount === 0
    && initialWindowFocusAnchor?.status !== 'ready'
  ) {
    throw new Error('QA_SENTINEL_INITIAL_WINDOW_FOCUS_ANCHOR_REQUIRED');
  }
  const targetUrl = requireWebUrl(plan.parameters.url);
  const scope = plan.protocolOptions.protocolScope;
  const temporaryManifest = Object.freeze({
      requiredPermissions: ['scripting'],
      requiredHostPermissions: [`${targetUrl.origin}/*`],
  });
  const attachedArtifactStage = browser.lifecyclePolicy === 'managed'
    ? defineEntropyQaAttachedArtifactStage({
      browser,
      browserExecution: plan.browserExecution,
      sourceDir: artifact.path,
      artifactIdentity: {
        artifactId: artifact.id,
        inputDigest: artifact.inputDigest,
        buildId: artifact.buildId,
        releaseProfile: artifact.releaseProfile,
      },
      temporaryManifest,
    })
    : null;
  const qaArtifact = Object.freeze({
    slotDir: browser.extensionSlot,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
  });
  const harness = new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: qaArtifact.slotDir,
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint,
    expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage,
    keepTemp: false,
    qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory,
    tempPrefix: `entropy-sentinel-${scope}-qa-`,
    loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: browser.lifecyclePolicy === 'managed'
      ? proveEntropyAttachedArtifactRuntimeReadiness
      : null,
    recoveryJournal,
  });
  registerCleanup('sentinel_protocol_harness', () => harness.close().then(() => ({
    browserProcessPreserved: true,
  })));
  const osFocusGuard = plan.mode === 'agent'
    ? attachedBrowserOsFocusGuard || new QaAttachedBrowserOsFocusGuard({
      browser, nativeObservation: plan.browserObservation === 'document',
    })
    : null;
  const osFocusProof = attachedBrowserOsFocusBaseline
    ? [attachedBrowserOsFocusBaseline]
    : [];
  const recordOsFocusProof = async (receipt) => {
    if (!receipt) return;
    osFocusProof.push(receipt);
    await evidence.event(receipt.policy === 'native_observation'
      ? 'QA_BROWSER_OS_FOCUS_OBSERVED' : 'QA_BROWSER_OS_FOCUS_PRESERVED', receipt);
  };
  if (osFocusGuard && !attachedBrowserOsFocusBaseline) {
    await recordOsFocusProof(
      await osFocusGuard.observeBaseline('before_harness_start'),
    );
  }
  await harness.start();
  if (osFocusGuard) {
    await recordOsFocusProof(
      await osFocusGuard.assertPreserved('after_harness_start'),
    );
  }
  await reportBrowserGpuCapability(harness.gpuCapability);
  if (browser.lifecyclePolicy === 'managed') {
    await evidence.event('QA_MANAGED_EXTENSION_SLOT_ADMITTED', {
      environmentId: browser.environmentId,
      profileSlotId: browser.profileSlotId,
      action: harness.managedExtensionSlotAction,
      installMode: harness.extensionInstallMode,
      artifactSync: harness.attachedArtifactSyncReceipt,
    });
  }
  if (harness.uninstallExtensionOnClose) {
    throw new Error('QA_SENTINEL_EXTENSION_UNINSTALL_FORBIDDEN');
  }
  const postRefreshRuntimeReadiness = readEntropyPostRefreshTrackingRuntimeReadiness(harness);
  if (postRefreshRuntimeReadiness?.required === true) {
    await evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY', {
      protocol: 'sentinel_runtime',
      ...postRefreshRuntimeReadiness,
    });
  }
  const attachPageAdmission = await openEntropyAttachOnlyActivePage({
    harness,
    url: targetUrl.href,
    browserExecution: plan.browserExecution,
    observation: plan.browserObservation,
  });
  const { page, targetTab } = attachPageAdmission;
  const executionProof = [];
  const requireExecution = async (phase) => {
    let observation;
    try {
      observation = await requireEntropyAttachedPageExecution(harness, page, plan.browserObservation);
    } catch (error) {
      if (error?.code === 'QA_ATTACH_EXECUTION_UNAVAILABLE') {
        // The generic error envelope intentionally omits arbitrary diagnostics.
        // Preserve this owner's content-free native capability evidence here.
        await evidence.event('QA_SENTINEL_EXECUTION_UNAVAILABLE', {
          phase, ...error.diagnostics,
        });
      }
      throw error;
    }
    const receipt = { phase, observationPolicy: plan.browserObservation, ...observation };
    executionProof.push(receipt);
    await evidence.event('QA_SENTINEL_EXECUTION_OBSERVED', receipt);
  };
  await requireExecution('before_start');
  if (osFocusGuard) {
    await recordOsFocusProof(
      await osFocusGuard.assertPreserved('after_target_activation'),
    );
  }
  const targetTabId = Number(targetTab?.id);
  if (!Number.isInteger(targetTabId) || targetTabId < 0) {
    throw new Error('QA_SENTINEL_TARGET_TAB_REQUIRED');
  }

  const productDiagnostics = [];
  const unsubscribeDiagnostics = harness.cdp.subscribe('Runtime.consoleAPICalled', (event) => {
    if (event.sessionId !== page.sessionId || !['warning', 'error'].includes(event.params?.type)) return;
    const args = event.params.args || [];
    if (typeof args[0]?.value !== 'string' || !args[0].value.startsWith('[sentinel flare]')) return;
    productDiagnostics.push({
      message: args[0].value,
      details: args.slice(1).map(arg => arg.value ?? arg.preview?.properties?.map(property => ({
        name: property.name, value: property.value,
      })) ?? arg.description),
    });
  });
  registerCleanup('sentinel_protocol_diagnostics', async () => {
    unsubscribeDiagnostics();
    return { released: true, count: productDiagnostics.length };
  });

  let stageFrameRecorder = null;
  let frameRecorderStopRequired = false;
  if (plan.parameters.captureScreenshots) {
    stageFrameRecorder = createSentinelStageFrameRecorder({
      cdp: harness.cdp,
      sessionId: page.sessionId,
    });
    registerCleanup('sentinel_protocol_stage_frame_stream', async () => {
      if (!frameRecorderStopRequired) return { stopped: false };
      const result = await stageFrameRecorder.stop();
      frameRecorderStopRequired = false;
      return result;
    });
    await stageFrameRecorder.start();
    frameRecorderStopRequired = true;
  }

  const stopController = createSentinelProtocolStopController({
    harness,
    targetTabId,
  });
  let stopRequired = false;
  registerCleanup('sentinel_protocol_session', async () => {
    if (!stopRequired) return { stopped: false };
    const result = await stopController.stop();
    stopRequired = false;
    return result;
  });

  const started = await sendTrustedRuntimeMessage(
    harness,
    createRequest(SENTINEL_PROTOCOL_QA_ACTIONS.START, targetTabId, {
      protocolScope: scope,
      ...(scope === 'site' ? { deliveryForm: plan.parameters.deliveryForm } : {}),
      protocolIntensity: plan.parameters.intensityPercent / 100,
      hudVisible: plan.parameters.hudVisible,
    }),
  );
  stopRequired = true;
  if (started?.ok !== true) throw new Error('QA_SENTINEL_START_NOT_RENDERED');

  const stages = [];
  const seenStageKeys = new Set();
  const renderPerformanceAccumulator = createSentinelRenderPerformanceEnvelopeAccumulator();
  const deadlineAtMs = Date.now() + plan.parameters.timeoutMs;
  const runOptions = {
    scope,
    exitChoice: plan.parameters.exitChoice,
    harness,
    page,
    targetTabId,
    timeoutMs: plan.parameters.timeoutMs,
    deadlineAtMs,
    captureScreenshots: plan.parameters.captureScreenshots,
    frameRecorder: stageFrameRecorder,
    attachmentsDir,
    evidence,
    stages,
    seenStageKeys,
    renderPerformanceAccumulator,
  };
  const initialSnapshot = await readSnapshot(harness, targetTabId);
  await requireExecution('after_start');
  await recordStage({ ...runOptions, snapshot: initialSnapshot });

  if (plan.mode === 'human') {
    const privacyNote = plan.parameters.captureScreenshots
      ? '스크린샷 저장이 켜져 있어 현재 페이지 내용도 증거에 포함될 수 있습니다.'
      : '스크린샷은 저장하지 않고 구조화된 단계 진단만 기록합니다.';
    process.stdout.write(`${JSON.stringify({
      status: 'READY_FOR_HUMAN',
      scope,
      targetTabId,
      targetOrigin: targetUrl.origin,
      privacyNote,
      instructions: scope === 'global'
        ? [
          '새로 열린 탭을 활성화하고 중앙의 시작 koi를 선택합니다.',
          '활성화된 koi를 차례로 선택해 균열을 임계점까지 엽니다.',
          '균열이 완전히 열린 뒤 포털을 선택해 Room 478로 들어갑니다.',
          'Room 478 준비 완료까지 구조화된 stage evidence로 자동 기록됩니다.',
        ]
        : [
          '빈 탄자쿠와 바람 동작 안내가 표시되고 짧은 등장 흔들림이 가라앉습니다.',
          '풍경 주변을 누른 채 옆으로 쓸고 놓으면 글씨와 울림 뒤 현재 탭이 닫힙니다.',
          '계속 보기는 텍스트를 한 번 선택하며, 기다리거나 커서를 움직이는 것만으로 선택되지 않습니다.',
          '선택 화면까지 구조화된 단계 증거가 자동 기록됩니다.',
        ],
    })}\n`);
    await evidence.event('QA_SENTINEL_READY_FOR_HUMAN', {
      scope,
      targetTabId,
      targetOrigin: targetUrl.origin,
      captureScreenshots: plan.parameters.captureScreenshots,
      browserProcessPreserved: true,
    });
  }

  let finalSnapshot = plan.mode === 'agent'
    ? (scope === 'global'
      ? await driveGlobalProtocol(runOptions)
      : await driveSiteProtocol(runOptions))
    : await observeHumanProtocol(runOptions);
  let room478Handoff = null;
  let naturalGlobalStopObserved = false;
  let globalRiftActionInvoked = false;
  if (scope === 'global' && isTerminal('global', finalSnapshot)) {
    const riftReady = await awaitGlobalSentinelRiftReady({
      initialSnapshot: finalSnapshot,
      readRuntimeSnapshot: () => readSnapshot(harness, targetTabId),
      recordRuntimeSnapshot: (snapshot) => recordStage({
        ...runOptions,
        scope: 'global',
        snapshot,
      }),
      deadlineAtMs,
    });
    finalSnapshot = riftReady.snapshot;
    if (riftReady.ready) {
      if (plan.mode === 'agent') {
        // Preserve the ending for capture before testing the explicit handoff.
        await sleep(2200);
        finalSnapshot = await readSnapshot(harness, targetTabId);
        if (!finalSnapshot.active || finalSnapshot.liveCount > 0 || finalSnapshot.scenePhase !== 'rift') {
          throw new Error('QA_SENTINEL_ENDING_NOT_PRESERVED');
        }
        await evidence.event('QA_SENTINEL_ENDING_HELD', { durationMs: 2200, snapshot: finalSnapshot });
        globalRiftActionInvoked = await clickShadowButton(
          harness,
          page,
          'nudgeRiftInviteButton',
        );
        if (!globalRiftActionInvoked) {
          throw new Error('QA_SENTINEL_GLOBAL_RIFT_ACTION_UNAVAILABLE');
        }
        await evidence.event('QA_SENTINEL_GLOBAL_RIFT_ACTION_INVOKED', {
          action: 'overlay_semantic_rift_invite',
          riftOpenProgress: finalSnapshot.globalSentinelRiftOpenProgress,
          forcedProtocolOutcome: false,
        });
      } else {
        process.stdout.write(`${JSON.stringify({
          status: 'READY_FOR_GLOBAL_RIFT_ENTRY',
          targetTabId,
          instruction: '완전히 열린 포털을 선택해 Room 478로 들어갑니다.',
        })}\n`);
      }
      const roomNavigationRequestedAt = Date.now();
      const roomOutcome = await waitForGlobalSentinelRoom478Ready({
        extensionId: harness.extensionId,
        readPageState: async () => {
          const pageState = await readGlobalSentinelRoom478PageState(harness, page);
          if (globalRiftActionInvoked && /^https?:/u.test(pageState.href)
            && Date.now() - roomNavigationRequestedAt > 5_000) {
            const runtimeSnapshot = await readSnapshot(harness, targetTabId);
            await evidence.event('QA_SENTINEL_ROOM478_NAVIGATION_NOT_ACCEPTED', {
              pageState, runtimeSnapshot, productDiagnostics,
            });
            throw new Error('QA_SENTINEL_ROOM478_NAVIGATION_NOT_ACCEPTED');
          }
          return pageState;
        },
        onNaturalHostStopObserved: async (navigation) => {
          naturalGlobalStopObserved = true;
          stopRequired = false;
          await evidence.event('QA_SENTINEL_GLOBAL_NATURAL_STOP_OBSERVED', {
            mechanism: 'room_478_same_target_navigation',
            destinationPath: navigation.destinationPath,
            qaStopSent: false,
          });
        },
        deadlineAtMs,
      });
      naturalGlobalStopObserved = roomOutcome.naturalHostStopObserved;
      room478Handoff = roomOutcome.handoff;
      if (roomOutcome.ready) {
        await evidence.event('QA_SENTINEL_ROOM478_READY', room478Handoff);
      }
    }
  }
  const terminalReached = scope === 'global'
    ? room478Handoff?.status === 'ready'
    : isTerminal(scope, finalSnapshot);
  await requireExecution('completion');
  const renderPerformanceEnvelope = renderPerformanceAccumulator.snapshot();
  const manifestAttachment = await writeStageManifest(attachmentsDir, {
    schemaVersion: 2,
    scope,
    mode: plan.mode,
    deliveryForm: scope === 'site' ? plan.parameters.deliveryForm : 'full',
    executionProof,
    targetOrigin: targetUrl.origin,
    captureScreenshots: plan.parameters.captureScreenshots,
    terminalReached,
    globalRiftActionInvoked,
    naturalGlobalStopObserved,
    room478Handoff,
    renderPerformanceEnvelope,
    stages,
  });

  let frameStream = null;
  if (frameRecorderStopRequired) {
    frameStream = await stageFrameRecorder.stop();
    frameRecorderStopRequired = false;
  }

  let siteTabClosed = false;
  if (scope === 'site' && plan.mode === 'agent' && plan.parameters.exitChoice === 'leave' && terminalReached) {
    const gesture = await driveSiteFurinWindGesture({ harness, page });
    await evidence.event('QA_SENTINEL_SITE_LEAVE_GESTURE', { gesture, forcedProtocolOutcome: false });
    await waitForSiteFurinTabClosed({ harness, targetTabId });
    siteTabClosed = true;
    stopRequired = false;
    await evidence.event('QA_SENTINEL_SITE_TAB_CLOSED', { targetTabId, qaStopSent: false, qaTabRemovalSent: false });
  }
  const terminalStop = naturalGlobalStopObserved || siteTabClosed
    ? Object.freeze({
      status: terminalReached
        ? QA_RUN_STATUSES.PASS
        : QA_RUN_STATUSES.INCONCLUSIVE,
      stopped: Object.freeze({
        stopped: true,
        reconciled: false,
        firstError: null,
        mechanism: siteTabClosed ? 'product_site_furin_tab_close' : 'product_global_rift_handoff',
        qaStopSent: false,
      }),
    })
    : await finalizeSentinelQaTerminalStop({
      stopController,
      terminalReached,
    });
  stopRequired = false;
  if (osFocusGuard) {
    await recordOsFocusProof(
      await osFocusGuard.assertPreserved('after_protocol_completion'),
    );
  }

  return Object.freeze({
    status: terminalStop.status,
    protocol: 'sentinel_runtime',
    scope,
    deliveryForm: scope === 'site' ? plan.parameters.deliveryForm : 'full',
    siteTabClosed,
    exitChoice: scope === 'site' ? plan.parameters.exitChoice : null,
    executionProof,
    targetTabId,
    targetOrigin: targetUrl.origin,
    terminalReached,
    globalRiftActionInvoked,
    naturalGlobalStopObserved,
    room478Handoff,
    finalSnapshot,
    renderPerformanceEnvelope,
    stageCount: stages.length,
    stageManifestAttachment: manifestAttachment,
    screenshotsCaptured: plan.parameters.captureScreenshots,
    frameStream,
    stopped: terminalStop.stopped,
    initialWindowFocusAnchor,
    osFocusProof: Object.freeze([...osFocusProof]),
    browserProcessPreserved: true,
    targetAdmission: Object.freeze({
      ...attachPageAdmission.receipt,
      postRefreshRuntimeReadiness,
    }),
  });
}

export async function waitForSiteFurinTabClosed({ harness, targetTabId, now = Date.now, sleepFor = sleep }) {
  if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) throw new Error('QA_SITE_FURIN_TAB_ID_REQUIRED');
  const deadline = now() + 4_000;
  while (now() < deadline) {
    const state = await harness.evaluateInTrustedPage(`new Promise(resolve => {
      chrome.tabs.get(${JSON.stringify(targetTabId)}, tab => resolve({
        error: chrome.runtime.lastError?.message || null, tabId: tab?.id ?? null,
      }));
    })`);
    if (state?.error === `No tab with id: ${targetTabId}.` && state.tabId === null) return;
    if (state?.error || state?.tabId !== targetTabId) throw new Error(`QA_SITE_FURIN_CLOSE_PROOF_INVALID:${state?.error || 'identity'}`);
    await sleepFor(100);
  }
  throw new Error('QA_SITE_FURIN_LEAVE_TAB_STILL_OPEN');
}
