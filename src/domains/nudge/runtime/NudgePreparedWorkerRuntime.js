import nudgeSwarmWorkerUrl from '../nudgeSwarm.worker.js?worker&url';
import { normalizeWorkerStatsSnapshot } from '../nudge/index.js';
import {
  WORKER_RUNTIME_SURFACE_IDS,
  WORKER_RUNTIME_SURFACE_STATUS,
  requireWorkerRuntimeSurface,
} from '../../../platform/workers/runtime/index.js';
import NudgeWorkerRuntimeAdapter from './NudgeWorkerRuntimeAdapter.js';

export const NUDGE_CONTENT_WORKER_SURFACE = requireWorkerRuntimeSurface(
  WORKER_RUNTIME_SURFACE_IDS.NUDGE_CONTENT_SWARM,
);

export function isNudgeContentWorkerSurfaceActive(surface = NUDGE_CONTENT_WORKER_SURFACE) {
  return surface?.status === WORKER_RUNTIME_SURFACE_STATUS.ACTIVE;
}

function resolveUnavailableReason(surface) {
  return isNudgeContentWorkerSurfaceActive(surface)
    ? 'runtime_unavailable'
    : 'worker_surface_disabled';
}

function createWorkerUnavailableOutcome(surface, phase = 'rejected') {
  return {
    ok: false,
    phase,
    runtime: 'worker',
    requestId: 0,
    rejectReason: resolveUnavailableReason(surface),
  };
}

function createDefaultNudgeWorkerUrl() {
  return new URL(nudgeSwarmWorkerUrl, import.meta.url);
}

export function createNudgePreparedWorkerRuntime({
  surface = NUDGE_CONTENT_WORKER_SURFACE,
  workerUrl = createDefaultNudgeWorkerUrl(),
  AdapterClass = NudgeWorkerRuntimeAdapter,
  onHitResult = null,
  onError = null,
  onStateChange = null,
} = {}) {
  let runtime = null;

  function isSurfaceActive() {
    return isNudgeContentWorkerSurfaceActive(surface);
  }

  function ensureRuntime() {
    if (!isSurfaceActive()) return null;
    if (!runtime) {
      runtime = new AdapterClass({
        workerUrl,
        onHitResult,
        onError,
        onStateChange,
      });
    }
    return runtime;
  }

  function getRuntime({ ensure = true } = {}) {
    return ensure ? ensureRuntime() : runtime;
  }

  function destroy() {
    runtime?.destroy?.();
    runtime = null;
  }

  function dispatch(type, payload = {}, { ensure = true } = {}) {
    const target = getRuntime({ ensure });
    if (!target) return null;
    return target.dispatch(type, payload, { ensure });
  }

  function post(type, payload = null) {
    return runtime?.post?.(type, payload) || false;
  }

  function activate(operation = {}) {
    const target = ensureRuntime();
    if (!target || typeof target.activate !== 'function') {
      return createWorkerUnavailableOutcome(surface);
    }
    return target.activate(operation);
  }

  function resize(payload = {}) {
    return ensureRuntime()?.resize?.(payload) || false;
  }

  function setConfig(config, protocolProgress = null) {
    return runtime?.setConfig?.(config, protocolProgress) || false;
  }

  function forceSpawn(spawnHint = null) {
    return runtime?.forceSpawn?.(spawnHint) || false;
  }

  function forceSpawnAndWait(spawnHint = null, options = {}) {
    const target = getRuntime({ ensure: false });
    if (!target || typeof target.forceSpawnAndWait !== 'function') {
      return Promise.resolve(createWorkerUnavailableOutcome(surface));
    }
    return target.forceSpawnAndWait(spawnHint, options);
  }

  function waitForActive(options = {}) {
    const target = getRuntime({ ensure: false });
    if (!target || typeof target.waitForActive !== 'function') {
      return Promise.resolve(createWorkerUnavailableOutcome(surface));
    }
    return target.waitForActive(options);
  }

  return {
    activate,
    destroy,
    dispatch,
    ensureRuntime,
    forceSpawn,
    forceSpawnAndWait,
    getStatsSnapshot: (fallback = null) => (
      runtime?.getStatsSnapshot?.(fallback) || normalizeWorkerStatsSnapshot(fallback)
    ),
    getTelemetrySnapshot: () => runtime?.getTelemetrySnapshot?.() || null,
    getRuntime,
    isActive: () => runtime?.isActive?.() || false,
    isReady: () => runtime?.isReady?.() || false,
    isSurfaceActive,
    post,
    resize,
    setConfig,
    waitForActive,
  };
}

export default createNudgePreparedWorkerRuntime;
