import nudgeSwarmWorkerUrl from '../nudgeSwarm.worker.js?worker&url';
import {
  WORKER_RUNTIME_SURFACE_IDS,
  requireWorkerRuntimeSurface,
} from '../../../platform/workers/runtime/index.js';
import { NUDGE_WORKER_MESSAGE, createWorkerMessage } from './NudgeProtocol.js';
import {
  assertNudgeRuntimeThemeId,
  normalizeNudgeRuntimeContext,
} from './nudgeRuntimeContext.js';
import {
  createNudgeWorkerActivationError,
  createNudgeWorkerScriptSource,
} from './NudgeWorkerScriptSource.js';

const DEFAULT_PROBE_TIMEOUT_MS = 2200;
const DEFAULT_PROBE_CANVAS_SIZE = 96;
const PROBE_SESSION_ID = 1;
const CHROME_EXTENSION_PROTOCOL = 'chrome-extension:';
const NUDGE_CONTENT_WORKER_SURFACE = requireWorkerRuntimeSurface(
  WORKER_RUNTIME_SURFACE_IDS.NUDGE_CONTENT_SWARM,
);

function nowMs() {
  return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
}

function elapsedSince(startedAtMs) {
  return Math.max(0, Math.round((nowMs() - startedAtMs) * 10) / 10);
}

function getMessageText(error) {
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  return String(error || 'unknown');
}

function buildBaseProbe({
  surface = NUDGE_CONTENT_WORKER_SURFACE,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
} = {}) {
  return {
    ok: false,
    phase: 'created',
    runtime: 'worker_probe',
    surface: {
      id: surface.id,
      status: surface.status,
      kind: surface.kind,
      context: surface.context,
      lane: surface.lane,
      degradationMode: surface.degradationMode,
      activationFlagName: surface.activationFlagName || null,
      bypassedSurfaceForProbe: surface.status !== 'active',
    },
    support: {
      workerApi: typeof Worker !== 'undefined',
      offscreenCanvasApi: typeof OffscreenCanvas !== 'undefined',
      documentApi: typeof document !== 'undefined',
      canvasTransfer: false,
    },
    bootstrap: {
      mode: null,
      sourceUrl: null,
      workerUrl: null,
    },
    bootstrapAttempts: [],
    ready: null,
    activation: null,
    error: null,
    timeoutMs: Math.max(1, Math.round(Number(timeoutMs) || DEFAULT_PROBE_TIMEOUT_MS)),
    elapsedMs: 0,
  };
}

function finishProbe(probe, {
  ok = false,
  phase = probe.phase,
  error = null,
  startedAtMs,
  details = null,
} = {}) {
  return {
    ...probe,
    ok: ok === true,
    phase,
    error,
    details,
    elapsedMs: elapsedSince(startedAtMs),
  };
}

function resolveProbeConfig(config = null) {
  return config && typeof config === 'object'
    ? config
    : {};
}

function createProbeCanvas(size = DEFAULT_PROBE_CANVAS_SIZE) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('nudge_worker_probe_document_unavailable');
  }
  const canvas = document.createElement('canvas');
  const extent = Math.max(1, Math.round(Number(size) || DEFAULT_PROBE_CANVAS_SIZE));
  canvas.width = extent;
  canvas.height = extent;
  return canvas;
}

function createDefaultWorkerUrl() {
  return new URL(nudgeSwarmWorkerUrl, import.meta.url);
}

function resolveWorkerUrlValue(workerUrl) {
  const raw = typeof workerUrl === 'string'
    ? workerUrl.trim()
    : (typeof workerUrl?.href === 'string' ? workerUrl.href.trim() : '');
  if (!raw) {
    throw new Error('nudge_worker_probe_worker_url_required');
  }
  return new URL(raw);
}

function createDirectExtensionWorkerSource(workerUrl) {
  const resolvedUrl = resolveWorkerUrlValue(workerUrl);
  return {
    mode: 'direct_extension_module',
    sourceUrl: resolvedUrl.href,
    url: resolvedUrl.href,
    revoke: () => {},
  };
}

function shouldTryDirectExtensionWorkerSource(workerUrl, locationRef = globalThis.location) {
  if (workerUrl.protocol !== CHROME_EXTENSION_PROTOCOL) return false;
  const currentOrigin = typeof locationRef?.origin === 'string'
    ? locationRef.origin
    : '';
  if (!currentOrigin) return false;
  const workerOrigin = `${workerUrl.protocol}//${workerUrl.host}`;
  return currentOrigin !== workerOrigin;
}

function createWorkerSourceBuilders(workerUrl) {
  const resolvedUrl = resolveWorkerUrlValue(workerUrl);
  const builders = [
    () => createNudgeWorkerScriptSource(resolvedUrl),
  ];
  if (shouldTryDirectExtensionWorkerSource(resolvedUrl)) {
    builders.push(() => createDirectExtensionWorkerSource(resolvedUrl));
  }
  return builders;
}

function normalizeWorkerStatsMessage(message = null) {
  return {
    type: message?.type || null,
    renderPressureLevel: message?.renderPressureLevel || null,
    renderBudgetPolicyId: message?.renderBudgetPolicyId || null,
    liveCount: Number.isFinite(Number(message?.liveCount)) ? Number(message.liveCount) : null,
    totalSpawned: Number.isFinite(Number(message?.totalSpawned)) ? Number(message.totalSpawned) : null,
    totalSplitSpawned: Number.isFinite(Number(message?.totalSplitSpawned))
      ? Number(message.totalSplitSpawned)
      : null,
  };
}

function createActivatePayload({
  canvasSize,
  config,
  runtimeContext,
} = {}) {
  const extent = Math.max(1, Math.round(Number(canvasSize) || DEFAULT_PROBE_CANVAS_SIZE));
  return {
    bounds: {
      width: extent,
      height: extent,
    },
    dpr: 1,
    themeId: assertNudgeRuntimeThemeId(
      runtimeContext?.themeId,
      'nudge worker admission activate payload',
    ),
    config: resolveProbeConfig(config),
    protocolStartAt: Date.now(),
  };
}

function createAttemptResult({
  ok = false,
  phase = 'created',
  workerSource = null,
  ready = null,
  activation = null,
  error = null,
  details = null,
  startedAtMs,
} = {}) {
  return {
    ok: ok === true,
    phase,
    mode: workerSource?.mode || null,
    sourceUrl: workerSource?.sourceUrl || null,
    workerUrl: workerSource?.url || null,
    ready,
    activation,
    error,
    details,
    elapsedMs: elapsedSince(startedAtMs),
  };
}

function runSingleAdmissionAttempt({
  config,
  runtimeContext,
  timeoutMs,
  canvasSize,
  workerSourceBuilder,
} = {}) {
  const startedAtMs = nowMs();
  let timeoutId = null;
  let settled = false;
  let worker = null;
  let workerSource = null;
  let phase = 'created';
  let ready = null;
  let activation = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (worker) {
      try {
        worker.terminate();
      } catch (error) {
        void error;
      }
      worker = null;
    }
    if (workerSource?.revoke) {
      try {
        workerSource.revoke();
      } catch (error) {
        void error;
      }
    }
    workerSource = null;
  };

  return new Promise((resolve) => {
    const settle = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const settleFailure = ({
      nextPhase = phase,
      error = null,
      details = null,
    } = {}) => {
      settle(createAttemptResult({
        phase: nextPhase,
        workerSource,
        ready,
        activation,
        error,
        details,
        startedAtMs,
      }));
    };

    try {
      const canvas = createProbeCanvas(canvasSize);
      phase = 'canvas_created';
      if (typeof canvas.transferControlToOffscreen !== 'function') {
        settleFailure({
          nextPhase: 'canvas_transfer_unavailable',
          error: 'canvas.transferControlToOffscreen unavailable',
        });
        return;
      }

      workerSource = workerSourceBuilder();
      phase = 'worker_source_created';
      worker = new Worker(workerSource.url, { type: 'module' });
      phase = 'worker_constructed';

      worker.onmessage = (event) => {
        const message = event?.data || {};
        if (message?.type === NUDGE_WORKER_MESSAGE.READY) {
          phase = 'ready';
          ready = {
            type: message.type,
            renderPressureLevel: message.renderPressureLevel || null,
            renderBudgetPolicyId: message.renderBudgetPolicyId || null,
            liveCount: Number.isFinite(Number(message.liveCount)) ? Number(message.liveCount) : null,
            totalSpawned: Number.isFinite(Number(message.totalSpawned)) ? Number(message.totalSpawned) : null,
            totalSplitSpawned: Number.isFinite(Number(message.totalSplitSpawned))
              ? Number(message.totalSplitSpawned)
              : null,
          };
          try {
            worker.postMessage(createWorkerMessage(NUDGE_WORKER_MESSAGE.ACTIVATE, createActivatePayload({
              canvasSize,
              config,
              runtimeContext,
            }), PROBE_SESSION_ID));
            phase = 'activate_posted';
          } catch (error) {
            const activationError = createNudgeWorkerActivationError(error, workerSource);
            settleFailure({
              nextPhase: 'activate_post_failed',
              error: getMessageText(activationError),
              details: activationError.details || { reason: getMessageText(error) },
            });
          }
          return;
        }
        if (message?.type === NUDGE_WORKER_MESSAGE.STATS) {
          activation = normalizeWorkerStatsMessage(message);
          settle(createAttemptResult({
            ok: true,
            phase: 'activated',
            workerSource,
            ready,
            activation,
            startedAtMs,
          }));
          return;
        }
        if (message?.type === NUDGE_WORKER_MESSAGE.ERROR) {
          settleFailure({
            nextPhase: 'worker_error',
            error: String(message.error || 'worker_error'),
            details: message,
          });
        }
      };

      worker.onerror = (error) => {
        const activationError = createNudgeWorkerActivationError(error, workerSource);
        settleFailure({
          nextPhase: 'worker_error_event',
          error: getMessageText(activationError),
          details: activationError.details || null,
        });
      };

      timeoutId = globalThis.setTimeout(() => {
        settleFailure({
          nextPhase: phase === 'activate_posted' ? 'activate_timeout' : 'ready_timeout',
          error: phase === 'activate_posted'
            ? 'nudge_worker_probe_activate_timeout'
            : 'nudge_worker_probe_ready_timeout',
        });
      }, timeoutMs);

      const offscreenCanvas = canvas.transferControlToOffscreen();
      phase = 'offscreen_transferred';
      worker.postMessage(createWorkerMessage(NUDGE_WORKER_MESSAGE.INIT, {
        canvas: offscreenCanvas,
        bounds: {
          width: Math.max(1, Math.round(Number(canvasSize) || DEFAULT_PROBE_CANVAS_SIZE)),
          height: Math.max(1, Math.round(Number(canvasSize) || DEFAULT_PROBE_CANVAS_SIZE)),
        },
        dpr: 1,
        themeId: assertNudgeRuntimeThemeId(
          runtimeContext?.themeId,
          'nudge worker admission init payload',
        ),
        config: resolveProbeConfig(config),
        protocolStartAt: Date.now(),
      }, PROBE_SESSION_ID), [offscreenCanvas]);
      phase = 'init_posted';
    } catch (error) {
      const activationError = createNudgeWorkerActivationError(error, workerSource);
      settleFailure({
        nextPhase: 'probe_exception',
        error: getMessageText(activationError),
        details: activationError.details || { reason: getMessageText(error) },
      });
    }
  });
}

function applyAttemptToProbe(probe, attempt, {
  startedAtMs,
  attempts,
} = {}) {
  return finishProbe({
    ...probe,
    bootstrap: {
      mode: attempt?.mode || null,
      sourceUrl: attempt?.sourceUrl || null,
      workerUrl: attempt?.workerUrl || null,
    },
    bootstrapAttempts: attempts,
    ready: attempt?.ready || null,
    activation: attempt?.activation || null,
  }, {
    ok: attempt?.ok === true,
    phase: attempt?.phase || 'probe_exception',
    error: attempt?.error || null,
    startedAtMs,
    details: attempt?.details || null,
  });
}

export async function runNudgeWorkerAdmissionProbe({
  config = null,
  runtimeContext = null,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  canvasSize = DEFAULT_PROBE_CANVAS_SIZE,
  surface = NUDGE_CONTENT_WORKER_SURFACE,
  workerUrl = createDefaultWorkerUrl(),
} = {}) {
  const startedAtMs = nowMs();
  let probe = buildBaseProbe({ surface, timeoutMs });
  const attempts = [];

  try {
    const normalizedRuntimeContext = normalizeNudgeRuntimeContext(runtimeContext);
    if (!probe.support.workerApi) {
      return finishProbe(probe, {
        phase: 'worker_api_unavailable',
        error: 'Worker API unavailable',
        startedAtMs,
      });
    }
    if (!probe.support.offscreenCanvasApi) {
      return finishProbe(probe, {
        phase: 'offscreen_canvas_unavailable',
        error: 'OffscreenCanvas API unavailable',
        startedAtMs,
      });
    }

    const transferProbeCanvas = createProbeCanvas(canvasSize);
    probe = {
      ...probe,
      phase: 'canvas_created',
      support: {
        ...probe.support,
        canvasTransfer: typeof transferProbeCanvas.transferControlToOffscreen === 'function',
      },
    };

    if (!probe.support.canvasTransfer) {
      return finishProbe(probe, {
        phase: 'canvas_transfer_unavailable',
        error: 'canvas.transferControlToOffscreen unavailable',
        startedAtMs,
      });
    }

    const workerSourceBuilders = createWorkerSourceBuilders(workerUrl);
    let lastAttempt = null;
    for (const workerSourceBuilder of workerSourceBuilders) {
      lastAttempt = await runSingleAdmissionAttempt({
        config,
        runtimeContext: normalizedRuntimeContext,
        timeoutMs: probe.timeoutMs,
        canvasSize,
        workerSourceBuilder,
      });
      attempts.push(lastAttempt);
      if (lastAttempt.ok === true) {
        return applyAttemptToProbe(probe, lastAttempt, {
          startedAtMs,
          attempts,
        });
      }
    }

    return applyAttemptToProbe(probe, lastAttempt, {
      startedAtMs,
      attempts,
    });
  } catch (error) {
    const activationError = createNudgeWorkerActivationError(error, null);
    return finishProbe({
      ...probe,
      bootstrapAttempts: attempts,
    }, {
      phase: 'probe_exception',
      error: getMessageText(activationError),
      startedAtMs,
      details: activationError.details || { reason: getMessageText(error) },
    });
  }
}

export default runNudgeWorkerAdmissionProbe;
