import probeWorkerUrl from './nudgeRenderHostProbe.worker.js?worker&url';
import nudgeSwarmWorkerUrl from '../../domains/nudge/nudgeSwarm.worker.js?worker&url';
import {
  NUDGE_WORKER_MESSAGE,
  createWorkerMessage,
} from '../../domains/nudge/runtime/NudgeProtocol.js';
import {
  NUDGE_EXTENSION_FRAME_WORKER_PROBE,
  createFrameWorkerProbeEvent,
} from '../../domains/nudge/runtime/NudgeExtensionFrameWorkerProbeProtocol.js';
import { installAuthenticatedNudgeRenderHostChannel } from '../../domains/nudge/runtime/frame-host/NudgeRenderHostChannel.js';
import { resolveNudgeRenderHostThemeId } from '../../domains/nudge/runtime/frame-host/nudgeRenderHostThemeId.js';

const DEFAULT_WIDTH = 168;
const DEFAULT_HEIGHT = 112;
const DEFAULT_WORKER_SESSION_ID = 1;
const RENDER_MODE_NUDGE_SWARM = 'nudge_swarm';
const RENDER_MODE_PROBE = 'probe';
const FRAME_RUNTIME_MODE_PROBE = 'probe';
const FRAME_RUNTIME_MODE_PERSISTENT = 'runtime';
const FRAME_HOST_DEBUG_PROBES_ENABLED = (
  typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
    ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
    : true
);

let sessionId = null;
let worker = null;
let active = false;
let frameHostChannel = null;

function nowMs() {
  return typeof performance?.now === 'function' ? performance.now() : Date.now();
}

function getQueryParam(name) {
  try {
    return new URLSearchParams(globalThis.location.search).get(name);
  } catch (_) {
    return null;
  }
}

function normalizeDimension(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(8192, Math.round(numeric)));
}

function normalizeRenderMode(value) {
  return value === RENDER_MODE_PROBE ? RENDER_MODE_PROBE : RENDER_MODE_NUDGE_SWARM;
}

function resolveFrameRuntimeMode(payload = {}) {
  return payload.persistent === true || payload.runtimeMode === FRAME_RUNTIME_MODE_PERSISTENT
    ? FRAME_RUNTIME_MODE_PERSISTENT
    : FRAME_RUNTIME_MODE_PROBE;
}

function isFrameHostStartAllowed(payload = {}) {
  if (FRAME_HOST_DEBUG_PROBES_ENABLED) return true;
  return normalizeRenderMode(payload.renderMode) === RENDER_MODE_NUDGE_SWARM
    && resolveFrameRuntimeMode(payload) === FRAME_RUNTIME_MODE_PERSISTENT;
}

function resolveWorkerUrl(renderMode) {
  return renderMode === RENDER_MODE_PROBE ? probeWorkerUrl : nudgeSwarmWorkerUrl;
}

function resolveRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function extractNudgeWorkerPayload(message = {}) {
  if (message.payload && typeof message.payload === 'object') {
    return message.payload;
  }
  if (!message || typeof message !== 'object') return {};
  const { type: _type, sessionId: _sessionId, payload: _payload, ...payload } = message;
  return payload;
}

function normalizeDpr(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  return numeric;
}

function postHostEvent(phase, {
  payload = null,
  error = null,
} = {}) {
  frameHostChannel?.postEvent(phase, { payload, error });
}

function terminateWorker() {
  if (!worker) return;
  try {
    worker.terminate();
  } catch (_) {}
  worker = null;
}

function postWorkerMessage(type, payload = null) {
  if (!worker || typeof type !== 'string' || !type.trim()) return false;
  try {
    worker.postMessage(createWorkerMessage(type, payload, DEFAULT_WORKER_SESSION_ID));
    return true;
  } catch (error) {
    postHostError(`nudge_swarm_worker_post_failed:${String(error?.message || error)}`);
    return false;
  }
}

function postHostError(error, payload = null) {
  postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR, {
    payload,
    error: String(error?.message || error || 'frame_host_error'),
  });
  terminateWorker();
}

function applyDocumentStyle() {
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  // keep in lockstep with the embedding iframe element's color-scheme:
  // a mismatch makes the browser render this frame on an opaque canvas
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.style.background = 'transparent';
  document.documentElement.style.backgroundColor = 'transparent';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';
}

function setHostBackground(background) {
  document.documentElement.style.background = background;
  document.documentElement.style.backgroundColor = 'transparent';
  document.body.style.background = background;
  document.body.style.backgroundColor = 'transparent';
}

function applyProtocolHostPresentation() {
  setHostBackground('transparent');
}

function createCanvas({ width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.background = 'transparent';
  canvas.style.backgroundColor = 'transparent';
  document.body.appendChild(canvas);
  return canvas;
}

function buildSupportSnapshot(canvas = null, renderMode = RENDER_MODE_NUDGE_SWARM) {
  return {
    documentApi: typeof document !== 'undefined',
    workerApi: typeof Worker !== 'undefined',
    offscreenCanvasApi: typeof OffscreenCanvas !== 'undefined',
    canvasTransfer: typeof canvas?.transferControlToOffscreen === 'function',
    renderMode,
    workerUrl: resolveWorkerUrl(renderMode),
  };
}

function assertWorkerSupport(support) {
  if (!support.workerApi) {
    throw new Error('frame_host_worker_api_unavailable');
  }
  if (!support.offscreenCanvasApi) {
    throw new Error('frame_host_offscreen_canvas_unavailable');
  }
  if (!support.canvasTransfer) {
    throw new Error('frame_host_canvas_transfer_unavailable');
  }
}

function startPlaceholderProbe({ canvas, width, height, durationMs }) {
  const offscreenCanvas = canvas.transferControlToOffscreen();
  worker = new Worker(probeWorkerUrl, { type: 'module' });
  worker.onmessage = (event) => {
    const message = event?.data || {};
    if (message.type === NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR) {
      postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR, {
        payload: message.payload || null,
        error: message.error || 'probe_worker_error',
      });
      terminateWorker();
      return;
    }
    if (
      message.type === NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_READY
      || message.type === NUDGE_EXTENSION_FRAME_WORKER_PROBE.FIRST_FRAME
      || message.type === NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMPLETE
    ) {
      postHostEvent(message.type, {
        payload: message.payload || null,
      });
      if (message.type === NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMPLETE) {
        terminateWorker();
      }
    }
  };
  worker.onerror = (error) => {
    postHostError(String(error?.message || error?.type || error || 'probe_worker_error_event'));
  };
  worker.postMessage({
    type: 'INIT',
    canvas: offscreenCanvas,
    width,
    height,
    durationMs,
  }, [offscreenCanvas]);
}

function startNudgeSwarmProbe({ canvas, width, height, durationMs, payload }) {
  const startedAt = nowMs();
  const offscreenCanvas = canvas.transferControlToOffscreen();
  const runtimeContext = resolveRecord(payload.runtimeContext);
  const config = resolveRecord(payload.config);
  const runtimeMode = payload.persistent === true || payload.runtimeMode === FRAME_RUNTIME_MODE_PERSISTENT
    ? FRAME_RUNTIME_MODE_PERSISTENT
    : FRAME_RUNTIME_MODE_PROBE;
  const persistent = runtimeMode === FRAME_RUNTIME_MODE_PERSISTENT;
  const themeId = resolveNudgeRenderHostThemeId({ ...payload, runtimeContext, config });
  const dpr = normalizeDpr(payload.dpr);
  const bounds = { width, height };
  const protocolStartAt = Number(payload.protocolStartAt) || Date.now();
  const protocolProgress = resolveRecord(payload.protocolProgress);
  const requestId = Math.max(1, Math.round(Number(payload.requestId) || 1));
  let readyPayload = null;
  let latestStats = null;
  let latestSpawnStatus = null;
  let firstFramePosted = false;
  let completionTimer = null;

  const clearCompletionTimer = () => {
    if (completionTimer !== null) {
      globalThis.clearTimeout(completionTimer);
      completionTimer = null;
    }
  };
  const complete = () => {
    clearCompletionTimer();
    if (persistent) return;
    if (!firstFramePosted) {
      postHostError('nudge_swarm_frame_worker_no_rendered_frame', {
        renderMode: RENDER_MODE_NUDGE_SWARM,
        runtimeMode,
        ready: readyPayload,
        stats: latestStats,
        spawnStatus: latestSpawnStatus,
      });
      return;
    }
    postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMPLETE, {
      payload: {
        renderMode: RENDER_MODE_NUDGE_SWARM,
        runtimeMode,
        frameCount: latestStats?.frameCount ?? latestSpawnStatus?.frameCount ?? null,
        elapsedMs: Math.round((nowMs() - startedAt) * 10) / 10,
        supportsWorkerRaf: readyPayload?.supportsWorkerRaf ?? null,
        stats: latestStats,
        spawnStatus: latestSpawnStatus,
      },
    });
    postWorkerMessage(NUDGE_WORKER_MESSAGE.DEACTIVATE, null);
    terminateWorker();
  };
  const postFirstFrame = (source, details = {}) => {
    if (firstFramePosted) return;
    firstFramePosted = true;
    postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.FIRST_FRAME, {
      payload: {
        renderMode: RENDER_MODE_NUDGE_SWARM,
        runtimeMode,
        source,
        frameCount: details.frameCount ?? latestStats?.frameCount ?? latestSpawnStatus?.frameCount ?? null,
        elapsedMs: Math.round((nowMs() - startedAt) * 10) / 10,
        supportsWorkerRaf: readyPayload?.supportsWorkerRaf ?? null,
        stats: latestStats,
        spawnStatus: latestSpawnStatus,
      },
    });
  };

  worker = new Worker(nudgeSwarmWorkerUrl, { type: 'module' });
  worker.onmessage = (event) => {
    const message = event?.data || {};
    const workerPayload = extractNudgeWorkerPayload(message);
    if (message.type === NUDGE_WORKER_MESSAGE.READY) {
      readyPayload = workerPayload;
      postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_READY, {
        payload: {
          renderMode: RENDER_MODE_NUDGE_SWARM,
          runtimeMode,
          ...workerPayload,
        },
      });
      worker.postMessage(createWorkerMessage(NUDGE_WORKER_MESSAGE.ACTIVATE, {
        bounds,
        dpr,
        themeId,
        config,
        protocolStartAt,
        protocolProgress,
      }, DEFAULT_WORKER_SESSION_ID));
      if (!persistent || payload.forceSpawnOnStart === true) {
        worker.postMessage(createWorkerMessage(NUDGE_WORKER_MESSAGE.FORCE_SPAWN, {
          requestId,
          requestedAtMs: Date.now(),
          reason: persistent ? 'frame_worker_runtime_start' : 'frame_worker_probe',
          spawnHint: payload.spawnHint || null,
        }, DEFAULT_WORKER_SESSION_ID));
      }
      if (!persistent) {
        completionTimer = globalThis.setTimeout(complete, durationMs);
      }
      return;
    }

    if (message.type === NUDGE_WORKER_MESSAGE.STATS) {
      latestStats = workerPayload;
      postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_STATS, {
        payload: {
          renderMode: RENDER_MODE_NUDGE_SWARM,
          runtimeMode,
          ...workerPayload,
        },
      });
      if (Number(workerPayload.liveCount) > 0 || Number(workerPayload.renderedCount) > 0) {
        postFirstFrame('stats', workerPayload);
      }
      return;
    }

    if (message.type === NUDGE_WORKER_MESSAGE.SPAWN_STATUS) {
      latestSpawnStatus = workerPayload;
      postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.SPAWN_STATUS, {
        payload: {
          renderMode: RENDER_MODE_NUDGE_SWARM,
          runtimeMode,
          ...workerPayload,
        },
      });
      if (workerPayload.phase === 'rendered') {
        postFirstFrame('spawn_status', workerPayload);
      }
      return;
    }

    if (message.type === NUDGE_WORKER_MESSAGE.HIT_RESULT) {
      postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.HIT_RESULT, {
        payload: {
          renderMode: RENDER_MODE_NUDGE_SWARM,
          runtimeMode,
          ...workerPayload,
        },
      });
      return;
    }

    if (message.type === NUDGE_WORKER_MESSAGE.ERROR) {
      clearCompletionTimer();
      postHostError(workerPayload.error || 'nudge_swarm_worker_error', {
        renderMode: RENDER_MODE_NUDGE_SWARM,
        runtimeMode,
        workerMessage: message,
      });
    }
  };
  worker.onerror = (error) => {
    clearCompletionTimer();
    postHostError(String(error?.message || error?.type || error || 'nudge_swarm_worker_error_event'), {
      renderMode: RENDER_MODE_NUDGE_SWARM,
      runtimeMode,
      workerUrl: nudgeSwarmWorkerUrl,
    });
  };
  worker.postMessage(createWorkerMessage(NUDGE_WORKER_MESSAGE.INIT, {
    canvas: offscreenCanvas,
    bounds,
    dpr,
    themeId,
    config,
    protocolStartAt,
    protocolProgress,
  }, DEFAULT_WORKER_SESSION_ID), [offscreenCanvas]);
}

function startProbe(payload = {}) {
  const renderMode = normalizeRenderMode(payload.renderMode);
  const width = normalizeDimension(payload.width, DEFAULT_WIDTH);
  const height = normalizeDimension(payload.height, DEFAULT_HEIGHT);
  const runtimeMode = resolveFrameRuntimeMode(payload);
  const durationMs = runtimeMode === FRAME_RUNTIME_MODE_PERSISTENT
    ? 0
    : Math.max(300, Math.min(8000, Math.round(Number(payload.durationMs) || 2200)));
  if (renderMode === RENDER_MODE_NUDGE_SWARM) {
    applyProtocolHostPresentation();
  }
  const canvas = createCanvas({ width, height });
  const support = buildSupportSnapshot(canvas, renderMode);
  postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.HOST_STARTED, {
    payload: {
      renderMode,
      runtimeMode,
      width,
      height,
      durationMs,
      support,
    },
  });
  assertWorkerSupport(support);
  if (renderMode === RENDER_MODE_PROBE) {
    startPlaceholderProbe({ canvas, width, height, durationMs });
    return;
  }
  startNudgeSwarmProbe({ canvas, width, height, durationMs, payload });
}

function installCommandChannel() {
  frameHostChannel = installAuthenticatedNudgeRenderHostChannel({
    sessionId,
    onAuthenticatedStart(payload) {
      if (!isFrameHostStartAllowed(payload || {})) {
        postHostEvent(NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR, {
          error: 'frame_host_debug_probe_disabled',
        });
        return;
      }
      if (active) {
        throw new Error('frame_host_session_already_active');
      }
      active = true;
      try {
        startProbe(payload || {});
      } catch (error) {
        postHostError(String(error?.message || error || 'frame_host_start_failed'));
      }
    },
    onCommand(command, payload) {
      if (!active) return;
      if (command === NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_MESSAGE) {
        const resolvedPayload = payload && typeof payload === 'object' ? payload : {};
        postWorkerMessage(
          resolvedPayload.workerMessageType,
          resolvedPayload.workerPayload ?? null,
        );
        return;
      }
      if (command === NUDGE_EXTENSION_FRAME_WORKER_PROBE.DEACTIVATE) {
        postWorkerMessage(NUDGE_WORKER_MESSAGE.DEACTIVATE, null);
        terminateWorker();
        active = false;
      }
    },
  });
}

function boot() {
  sessionId = getQueryParam('session');
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('frame_host_session_required');
  }
  applyDocumentStyle();
  installCommandChannel();
  globalThis.parent?.postMessage(createFrameWorkerProbeEvent({
    phase: NUDGE_EXTENSION_FRAME_WORKER_PROBE.HOST_READY,
    sessionId,
    nonce: null,
    payload: {
      support: buildSupportSnapshot(null),
      renderMode: RENDER_MODE_NUDGE_SWARM,
      channelProtocol: 'message_port_v1',
    },
  }), '*');
}

boot();
