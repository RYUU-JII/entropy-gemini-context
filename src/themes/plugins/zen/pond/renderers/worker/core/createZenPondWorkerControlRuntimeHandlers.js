import { commitZenPondViewportReflow } from './zenPondWorkerWorldSync.js';
import { recordZenPondRuntimeHealthEvent } from './zenPondWorkerRuntimeHealth.js';
import { requireZenPondWorkerInitPayload } from './zenPondWorkerProtocol.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const createZenPondWorkerControlRuntimeHandlers = ({
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
} = {}) => {
    if (typeof postMessage !== 'function') {
        throw new Error('ZEN_POND_WORKER_CONTROL_POST_MESSAGE_REQUIRED');
    }

    const handleInitCanvas = async (id, payload) => {
        requireZenPondWorkerInitPayload(payload);
        const modules = RUNTIME_MODULES;
        stopEngine(runtimeState, { keepData: false });
        resetRuntimeState(runtimeState);
        recordZenPondRuntimeHealthEvent(runtimeState, 'init_canvas_received', {
            active: payload?.active !== false,
        });
        runtimeState.active = payload?.active !== false;
        runtimeState.refs.animationEnabledRef.current = runtimeState.active;
        runtimeState.requiredFirstFrameFishCount = Math.max(
            0,
            Math.floor(Number(payload?.requiredFirstFrameFishCount) || 0),
        );
        const initCanvasResult = applyZenPondWorkerCanvasInit({
            state: runtimeState,
            payload,
            ensureCanvasEventSurface,
        });
        if (!initCanvasResult?.ok) {
            respondError(id, initCanvasResult?.reason || 'OFFSCREEN_CANVAS_UNAVAILABLE');
            return;
        }
        recordZenPondRuntimeHealthEvent(runtimeState, 'canvas_initialized', {
            width: runtimeState.width,
            height: runtimeState.height,
            dpr: runtimeState.dpr,
        });

        const initialRuntimeParams = {
            qualityMode: payload.qualityMode ?? ZEN_QUALITY_MODE_FULL,
            targetFps: Number.isFinite(Number(payload?.targetFps)) ? Number(payload.targetFps) : null,
            waterEffectsEnabled: payload?.waterEffectsEnabled,
            effectIntensityScale: Number(payload?.effectIntensityScale),
            ...(isObject(payload?.runtimeParams) ? payload.runtimeParams : {}),
        };
        applyRuntimeParams(modules, runtimeState, initialRuntimeParams);
        recordZenPondRuntimeHealthEvent(runtimeState, 'runtime_params_applied', {
            source: 'init_canvas',
            count: runtimeState.metrics?.runtimeParamSyncCount || 0,
        });
        if (runtimeState.refs?.frameStateRef?.current) {
            recordZenPondRuntimeHealthEvent(runtimeState, 'frame_state_ready', {
                source: 'init_canvas',
            });
        } else {
            recordZenPondRuntimeHealthEvent(runtimeState, 'frame_state_missing', {
                source: 'init_canvas',
            }, {
                captureStack: true,
                stackKey: 'frame_state_missing_after_init_runtime_params',
            });
        }
        applyFishRoster(modules, runtimeState, payload?.fishRoster, payload);

        const result = buildReadyPayload({
            qualityMode: runtimeState.qualityMode,
        });

        respondResult(id, result);
        postMessage({
            type: MESSAGE_TYPE.READY,
            ...result,
        });

        startEngineAsync(modules, runtimeState);
    };

    const handleResize = async (id, payload) => {
        if (!runtimeState.canvas) {
            respondResult(id, {
                width: runtimeState.viewportWidth,
                height: runtimeState.viewportHeight,
                worldWidth: runtimeState.width,
                worldHeight: runtimeState.height,
                dpr: runtimeState.dpr,
                ignored: true,
                reason: 'canvas_missing',
            });
            return;
        }

        try {
            const prevViewportWidth = Number(runtimeState.viewportWidth) || 0;
            const prevViewportHeight = Number(runtimeState.viewportHeight) || 0;
            const prevDpr = Number(runtimeState.dpr) || 1;
            applyZenPondWorkerCanvasResize({
                state: runtimeState,
                payload,
            });
            const didResize = (
                (Number(runtimeState.viewportWidth) || 0) !== prevViewportWidth
                || (Number(runtimeState.viewportHeight) || 0) !== prevViewportHeight
                || (Number(runtimeState.dpr) || 1) !== prevDpr
            );
            if (!runtimeState.started) {
                runtimeState.pendingViewportReflow = payload?.settled === true;
                respondResult(id, {
                    width: runtimeState.viewportWidth,
                    height: runtimeState.viewportHeight,
                    worldWidth: runtimeState.width,
                    worldHeight: runtimeState.height,
                    dpr: runtimeState.dpr,
                    didResize,
                    sceneResizeApplied: false,
                    deferred: true,
                    ack: buildControlAck({
                        payload,
                        channel: MESSAGE_TYPE.RESIZE,
                        applied: true,
                    }),
                });
                return;
            }
            let sceneResizeApplied = false;
            if (didResize && typeof runtimeState.scene?.setViewport === 'function') {
                sceneResizeApplied = runtimeState.scene.setViewport({
                    width: runtimeState.viewportWidth,
                    height: runtimeState.viewportHeight,
                    devicePixelRatio: runtimeState.dpr,
                }) === true;
            } else if (didResize && typeof runtimeState.scene?.resize === 'function') {
                sceneResizeApplied = runtimeState.scene.resize({
                    width: runtimeState.width,
                    height: runtimeState.height,
                    viewportWidth: runtimeState.viewportWidth,
                    viewportHeight: runtimeState.viewportHeight,
                    devicePixelRatio: runtimeState.dpr,
                }) === true;
            }

            const worldReflowApplied = payload?.settled === true
                ? commitZenPondViewportReflow(runtimeState) : false;
            respondResult(id, {
                width: runtimeState.viewportWidth,
                height: runtimeState.viewportHeight,
                worldWidth: runtimeState.width,
                worldHeight: runtimeState.height,
                dpr: runtimeState.dpr,
                didResize,
                sceneResizeApplied,
                worldReflowApplied,
                viewportReflowCount: runtimeState.metrics.viewportReflowCount,
                ack: buildControlAck({
                    payload,
                    channel: MESSAGE_TYPE.RESIZE,
                    applied: true,
                }),
            });
        } catch (error) {
            recordZenPondRuntimeHealthEvent(runtimeState, 'viewport_reflow_failed', { error: String(error?.message || error) });
            respondError(id, `ZEN_POND_RESIZE_FAILED:${String(error?.message || error)}`);
        }
    };

    const handleSetVisibility = (id, payload) => {
        runtimeState.active = payload?.active !== false;
        runtimeState.refs.animationEnabledRef.current = runtimeState.active;
        if (runtimeState.active) {
            runtimeState.runtimeStopLoop?.wake?.();
        }
        respondResult(id, {
            active: runtimeState.active,
            ack: buildControlAck({
                payload,
                channel: MESSAGE_TYPE.SET_VISIBILITY,
                applied: true,
            }),
        });
    };

    return {
        handleInitCanvas,
        handleResize,
        handleSetVisibility,
    };
};
