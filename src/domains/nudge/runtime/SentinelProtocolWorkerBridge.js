import { normalizeWorkerStatsSnapshot } from '../nudge/index.js';
import {
  startSentinelWorkerRuntime,
  supportsSentinelWorkerRuntime,
} from '../nudge/nudgeGameRuntime.js';
import { createNudgeExtensionFrameWorkerRuntime } from './NudgeExtensionFrameWorkerRuntime.js';
import { createNudgePreparedWorkerRuntime } from './NudgePreparedWorkerRuntime.js';

export const SENTINEL_PROTOCOL_HOST_DEFAULT_WORKER_RUNTIME_HOST = 'extension_frame_worker';

export const SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS = Object.freeze({
  CONTENT_WORKER: 'content_worker',
  EXTENSION_FRAME_WORKER: SENTINEL_PROTOCOL_HOST_DEFAULT_WORKER_RUNTIME_HOST,
});

export function normalizeSentinelProtocolWorkerRuntimeHost(value) {
  return value === SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.CONTENT_WORKER
    ? SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.CONTENT_WORKER
    : SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER;
}

function createDefaultPreparedRuntime(options = {}) {
  return createNudgePreparedWorkerRuntime(options);
}

function createDefaultExtensionFrameRuntime(options = {}) {
  return createNudgeExtensionFrameWorkerRuntime(options);
}

export function createSentinelProtocolWorkerBridge({
  preparedWorkerRuntime = null,
  extensionFrameWorkerRuntime = null,
  createPreparedRuntime = createDefaultPreparedRuntime,
  createExtensionFrameRuntime = createDefaultExtensionFrameRuntime,
  runtimeOptions = {},
  preparedRuntimeOptions = runtimeOptions,
  extensionFrameRuntimeOptions = runtimeOptions,
  getMainRuntimeSnapshot = () => null,
  normalizeStatsSnapshot = normalizeWorkerStatsSnapshot,
} = {}) {
  const preparedRuntime = preparedWorkerRuntime || createPreparedRuntime(preparedRuntimeOptions);
  const extensionRuntime = extensionFrameWorkerRuntime || createExtensionFrameRuntime(extensionFrameRuntimeOptions);
  let runtimeHost = SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER;

  function isExtensionFrameWorkerRuntimeSelected() {
    return runtimeHost === SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER;
  }

  function getSelectedRuntime() {
    return isExtensionFrameWorkerRuntimeSelected()
      ? extensionRuntime
      : preparedRuntime;
  }

  function getActiveRuntime() {
    if (extensionRuntime?.isActive?.()) return extensionRuntime;
    if (preparedRuntime?.isActive?.()) return preparedRuntime;
    return null;
  }

  function supportsRuntime({ canvas = null } = {}) {
    if (isExtensionFrameWorkerRuntimeSelected()) {
      return extensionRuntime?.isSupported?.() === true;
    }
    return preparedRuntime?.isSurfaceActive?.() === true
      && supportsSentinelWorkerRuntime(canvas);
  }

  const bridge = {
    getRuntimeHost() {
      return runtimeHost;
    },

    setRuntimeHost(value) {
      runtimeHost = normalizeSentinelProtocolWorkerRuntimeHost(value);
      return runtimeHost;
    },

    resetRuntimeHost() {
      runtimeHost = SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER;
      return runtimeHost;
    },

    isExtensionFrameWorkerRuntimeSelected,
    getSelectedRuntime,
    getActiveRuntime,

    getResultName() {
      return isExtensionFrameWorkerRuntimeSelected()
        ? SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER
        : 'worker';
    },

    ensureRuntime() {
      const selectedRuntime = getSelectedRuntime();
      return selectedRuntime?.ensureRuntime?.() || selectedRuntime;
    },

    destroy() {
      preparedRuntime?.destroy?.();
      extensionRuntime?.destroy?.();
    },

    isActive() {
      return preparedRuntime?.isActive?.() === true || extensionRuntime?.isActive?.() === true;
    },

    hasReadySession() {
      return preparedRuntime?.isReady?.() === true || extensionRuntime?.isReady?.() === true;
    },

    supportsRuntime,

    getStatsSnapshot() {
      const mainSnapshot = getMainRuntimeSnapshot();
      return getActiveRuntime()?.getStatsSnapshot?.(mainSnapshot)
        || normalizeStatsSnapshot(mainSnapshot);
    },

    getTelemetrySnapshot() {
      return getActiveRuntime()?.getTelemetrySnapshot?.() || null;
    },

    getPreparedRuntimeStateOwner() {
      const runtime = preparedRuntime?.getRuntime?.({ ensure: false });
      if (!runtime || typeof runtime.getCoordinator !== 'function') return null;
      return runtime.getCoordinator({ ensure: false }) || null;
    },

    dispatchPreparedRuntimeEvent(type, payload = {}, { ensure = false } = {}) {
      if (!bridge.getPreparedRuntimeStateOwner()) return null;
      return preparedRuntime?.dispatch?.(type, payload, { ensure }) || null;
    },

    post(type, payload = null) {
      return getActiveRuntime()?.post?.(type, payload)
        || getSelectedRuntime()?.post?.(type, payload)
        || false;
    },

    waitForActive(options = {}) {
      const runtime = getActiveRuntime() || getSelectedRuntime();
      if (!runtime || typeof runtime.waitForActive !== 'function') {
        return Promise.resolve({
          ok: false,
          phase: 'rejected',
          runtime: bridge.getResultName(),
          requestId: 0,
          rejectReason: 'selected_worker_runtime_missing',
        });
      }
      return runtime.waitForActive(options);
    },

    activateSelectedRuntime({
      ensureWorkerRoot = null,
      overlayHost = null,
      canvas = null,
      scene = null,
      bounds = null,
      dpr = 1,
      activeThemeId = '',
      buildWorkerRuntimeConfig = () => ({}),
      buildWorkerProtocolProgress = () => ({}),
      runtimeContext = null,
      protocolStartAt = 0,
    } = {}) {
      if (isExtensionFrameWorkerRuntimeSelected()) {
        ensureWorkerRoot?.();
        overlayHost?.show?.();
        if (!supportsRuntime({ canvas })) {
          return {
            ok: false,
            phase: 'rejected',
            runtime: SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER,
            requestId: 0,
            rejectReason: 'extension_frame_worker_runtime_unsupported',
          };
        }
        const result = extensionRuntime?.activate?.({
          container: scene,
          bounds,
          dpr,
          themeId: activeThemeId,
          config: buildWorkerRuntimeConfig(),
          protocolProgress: buildWorkerProtocolProgress(),
          runtimeContext,
          protocolStartAt,
          mainSnapshot: getMainRuntimeSnapshot(),
        }) || {
          ok: false,
          phase: 'rejected',
          rejectReason: 'extension_frame_worker_runtime_missing',
        };
        return {
          ...result,
          runtime: SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER,
        };
      }

      return startSentinelWorkerRuntime({
        ensureRoot: ensureWorkerRoot,
        overlayHost,
        supportsWorkerRuntime: () => supportsRuntime({ canvas }),
        ensureWorkerRuntime: () => bridge.ensureRuntime(),
        canvas,
        bounds,
        activeThemeId,
        buildWorkerRuntimeConfig,
        buildWorkerProtocolProgress,
        protocolStartAt,
        getMainRuntimeSnapshot,
      });
    },
  };

  return bridge;
}
