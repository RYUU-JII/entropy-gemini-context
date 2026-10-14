import { createZenPondWorkerControlRuntimeHandlers } from './createZenPondWorkerControlRuntimeHandlers.js';
import { createZenPondWorkerControlInputHandlers } from './createZenPondWorkerControlInputHandlers.js';
import { createZenPondWorkerControlSyncHandlers } from './createZenPondWorkerControlSyncHandlers.js';
import { createZenPondWorkerControlLifecycleHandlers } from './createZenPondWorkerControlLifecycleHandlers.js';

export const createZenPondWorkerControlHandlers = ({
    MESSAGE_TYPE,
    ZEN_QUALITY_MODE_FULL,
    runtimeState,
    RUNTIME_MODULES,
    applyZenPondWorkerCanvasInit,
    applyZenPondWorkerCanvasResize,
    ensureCanvasEventSurface,
    applySceneSession,
    applyEnvironmentAuthority,
    applyRuntimeParams,
    applyFishRoster,
    buildReadyPayload,
    buildControlAck,
    buildMetrics,
    remountEngine,
    stopEngine,
    resetRuntimeState,
    sessionGate,
    startEngineAsync,
    postMessage,
    respondResult,
    respondError,
} = {}) => {
    const runtimeHandlers = createZenPondWorkerControlRuntimeHandlers({
        MESSAGE_TYPE,
        ZEN_QUALITY_MODE_FULL,
        runtimeState,
        RUNTIME_MODULES,
        applyZenPondWorkerCanvasInit,
        applyZenPondWorkerCanvasResize,
        ensureCanvasEventSurface,
        applyRuntimeParams,
        applyFishRoster,
        buildReadyPayload,
        buildControlAck,
        startEngineAsync,
        postMessage,
        respondResult,
        respondError,
        stopEngine,
        resetRuntimeState,
        remountEngine,
    });

    const inputHandlers = createZenPondWorkerControlInputHandlers({
        MESSAGE_TYPE,
        runtimeState,
        buildControlAck,
        respondResult,
    });

    const syncHandlers = createZenPondWorkerControlSyncHandlers({
        MESSAGE_TYPE,
        runtimeState,
        RUNTIME_MODULES,
        applySceneSession,
        applyEnvironmentAuthority,
        applyRuntimeParams,
        applyFishRoster,
        buildControlAck,
        respondResult,
        remountEngine,
    });

    const lifecycleHandlers = createZenPondWorkerControlLifecycleHandlers({
        runtimeState,
        buildMetrics,
        respondResult,
        stopEngine,
        resetRuntimeState,
        sessionGate,
    });

    return {
        [MESSAGE_TYPE.INIT_CANVAS]: async ({ id, payload }) => runtimeHandlers.handleInitCanvas(id, payload),
        [MESSAGE_TYPE.RESIZE]: async ({ id, payload }) => runtimeHandlers.handleResize(id, payload),
        [MESSAGE_TYPE.SET_VISIBILITY]: ({ id, payload }) => runtimeHandlers.handleSetVisibility(id, payload),
        [MESSAGE_TYPE.LAND_PETALS]: ({ id, payload }) => inputHandlers.handleLandPetals(id, payload),
        [MESSAGE_TYPE.SET_INPUT_STATE]: ({ id, payload }) => inputHandlers.handleSetInputState(id, payload),
        [MESSAGE_TYPE.INJECT_DEBUG_SURFACE_DISTURBANCES]:
            ({ id, payload }) => (
                inputHandlers
                    .handleInjectDebugSurfaceDisturbances(
                        id,
                        payload,
                    )
            ),
        [MESSAGE_TYPE.SYNC_SCENE_SESSION]: async ({ id, payload }) => syncHandlers.handleSyncSceneSession(id, payload),
        [MESSAGE_TYPE.SYNC_ENVIRONMENT_AUTHORITY]: async ({ id, payload }) => (
            syncHandlers.handleSyncEnvironmentAuthority(id, payload)
        ),
        [MESSAGE_TYPE.SYNC_RUNTIME_PARAMS]: async ({ id, payload }) => syncHandlers.handleSyncRuntimeParams(id, payload),
        [MESSAGE_TYPE.SYNC_FISH_ROSTER]: async ({ id, payload }) => syncHandlers.handleSyncFishRoster(id, payload),
        [MESSAGE_TYPE.FLUSH_METRICS]: ({ id }) => lifecycleHandlers.handleFlushMetrics(id),
        [MESSAGE_TYPE.DISPOSE]: ({ id }) => lifecycleHandlers.handleDispose(id),
    };
};
