import {
    WORKER_RUNTIME_SURFACE_IDS,
    attachWorkerRuntimeSurfaceFailureDetails,
    recordWorkerRuntimeSurfaceFailure,
    resolveWorkerRuntimeFailureReason,
} from '@/platform/workers/runtime/index.js';
import {
    createRetainedCanvasControllerRegistry,
    createThemeWorkerRenderController,
    resolveWorkerCanvasMetrics,
} from '@/themes/core/rendering/workerCanvasRuntime.js';
import {
    ZEN_BONSAI_WORKER_PROTOCOL_VERSION,
    ZEN_BONSAI_WORKER_MESSAGE_TYPE as MESSAGE_TYPE,
    requireZenBonsaiInputSignature,
    requireZenBonsaiMaterializationKey,
    requireZenBonsaiWorkerProtocolVersion,
    resolveZenBonsaiWorkerRendererLabel,
} from './zenBonsaiWorkerProtocol.js';
import {
    ZEN_HOME_RENDERER_CHANNEL,
} from './zenHomeRendererWorkerProtocol.js';
import {
    acquireZenHomeRendererWorkerChannel,
} from './ZenHomeRendererWorkerSession.js';

const CONTROLLER_REGISTRY = createRetainedCanvasControllerRegistry();

const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const isObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
);

const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};

export const resolveZenBonsaiWorkerCanvasMetrics = ({
    width,
    height,
    pixelRatio,
} = {}) => resolveWorkerCanvasMetrics({ width, height, pixelRatio });

const recordZenBonsaiWorkerFailure = ({
    renderBackend = 'canvas2d',
    stage = 'control',
    reason = 'worker_error',
    workerMessageType = null,
    workerPayload = null,
    error = null,
} = {}) => {
    const details = {
        renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
    };
    if (isObject(workerPayload)) {
        details.workerPayload = { ...workerPayload };
    }
    return recordWorkerRuntimeSurfaceFailure({
        surfaceId: WORKER_RUNTIME_SURFACE_IDS.ZEN_HOME_RENDERER,
        stage,
        reason,
        workerMessageType,
        error,
        details,
        messagePrefix: 'ZEN_BONSAI_WORKER_RENDERER_FAIL',
    });
};

const createZenBonsaiWorkerRendererController = ({
    canvas,
    width,
    height,
    pixelRatio,
    renderBackend = 'canvas2d',
    onRenderDebugEvent = null,
    onFirstFrameReady = null,
    onBloomPresentationComplete = null,
} = {}) => {
    let callbacks = { onRenderDebugEvent, onFirstFrameReady, onBloomPresentationComplete };
    let lastSceneSignature = '';
    const mountStartedAtMs = nowPerfMs();
    let controllerCreatedAtMs = 0;
    let workerReadyAtMs = 0;
    let workerChannel = null;
    let renderController = null;

    const buildClientTiming = (atMs = nowPerfMs()) => ({
        controllerCreateMs: controllerCreatedAtMs > 0
            ? roundMs(controllerCreatedAtMs - mountStartedAtMs)
            : null,
        mountToWorkerReadyMs: workerReadyAtMs > 0
            ? roundMs(workerReadyAtMs - mountStartedAtMs)
            : null,
        workerReadyToFrameMessageMs: workerReadyAtMs > 0
            ? roundMs(atMs - workerReadyAtMs)
            : null,
        mountToFrameMessageMs: roundMs(atMs - mountStartedAtMs),
    });

    renderController = createThemeWorkerRenderController({
        canvas,
        createWorker() {
            workerChannel = acquireZenHomeRendererWorkerChannel({
                channel: ZEN_HOME_RENDERER_CHANNEL.BONSAI,
            });
            return workerChannel;
        },
        disposeWorker(_worker, { reason = 'renderer_dispose' } = {}) {
            const activeChannel = workerChannel;
            workerChannel = null;
            activeChannel?.terminate(reason);
        },
        width,
        height,
        pixelRatio,
        initPayload: {
            renderBackend,
            protocolVersion: ZEN_BONSAI_WORKER_PROTOCOL_VERSION,
        },
        messageType: MESSAGE_TYPE,
        availabilityErrorCode: 'ZEN_BONSAI_WORKER_RENDERER_UNAVAILABLE',
        onMessage(event) {
            const message = event?.data || {};
            if (message.type === MESSAGE_TYPE.BLOOM_PRESENTATION_COMPLETE) {
                callbacks.onBloomPresentationComplete?.(message.payload);
                return;
            }
            if (message?.type === MESSAGE_TYPE.READY) {
                const payload = message.payload || {};
                requireZenBonsaiWorkerProtocolVersion(payload.protocolVersion);
                const readyAtMs = nowPerfMs();
                workerReadyAtMs = readyAtMs;
                if (typeof callbacks.onRenderDebugEvent === 'function') {
                    callbacks.onRenderDebugEvent({
                        channel: 'main',
                        status: 'worker_ready',
                        reason: 'worker_ready',
                        renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                        timestamp: Date.now(),
                        ...payload,
                        clientTiming: buildClientTiming(readyAtMs),
                    });
                }
                return;
            }
            if (message?.type === MESSAGE_TYPE.FRAME_RENDERED) {
                const payload = message.payload || {};
                const bonsaiMaterializationKey = requireZenBonsaiMaterializationKey(
                    payload.bonsaiMaterializationKey,
                );
                const inputSignature = requireZenBonsaiInputSignature(payload.inputSignature);
                const frameMessageAtMs = nowPerfMs();
                if (typeof callbacks.onRenderDebugEvent === 'function') {
                    callbacks.onRenderDebugEvent({
                        channel: 'main',
                        status: 'rendered',
                        reason: 'rendered',
                        renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                        timestamp: Date.now(),
                        ...payload,
                        bonsaiMaterializationKey,
                        inputSignature,
                        clientTiming: buildClientTiming(frameMessageAtMs),
                    });
                }
                if (typeof callbacks.onFirstFrameReady === 'function') {
                    callbacks.onFirstFrameReady({
                        reason: 'worker_first_frame_ack',
                        firstFrameAcked: true,
                        renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                        timestamp: Date.now(),
                        ...payload,
                        bonsaiMaterializationKey,
                        inputSignature,
                        clientTiming: buildClientTiming(frameMessageAtMs),
                    });
                }
                return;
            }
            if (message?.type === MESSAGE_TYPE.ERROR) {
                const reason = resolveWorkerRuntimeFailureReason(message?.payload?.reason, 'worker_error');
                const failureDetails = recordZenBonsaiWorkerFailure({
                    renderBackend,
                    stage: workerReadyAtMs > 0 ? 'control' : 'init',
                    reason,
                    workerMessageType: MESSAGE_TYPE.ERROR,
                    workerPayload: message?.payload,
                });
                if (typeof callbacks.onRenderDebugEvent === 'function') {
                    callbacks.onRenderDebugEvent({
                        channel: 'main',
                        status: 'error',
                        reason,
                        timestamp: Date.now(),
                        ...failureDetails,
                    });
                }
            }
        },
        onError(error) {
            const reason = resolveWorkerRuntimeFailureReason(error, 'worker_error');
            const failureDetails = recordZenBonsaiWorkerFailure({
                renderBackend,
                stage: workerReadyAtMs > 0 ? 'control' : 'init',
                reason,
                workerMessageType: 'worker.onerror',
                error,
            });
            if (typeof callbacks.onRenderDebugEvent === 'function') {
                callbacks.onRenderDebugEvent({
                    channel: 'main',
                    status: 'error',
                    reason,
                    timestamp: Date.now(),
                    ...failureDetails,
                });
            }
        },
    });
    controllerCreatedAtMs = nowPerfMs();

    const api = {
        canvas,
        retain(nextCallbacks = {}) {
            renderController.retain();
            callbacks = {
                ...callbacks,
                ...nextCallbacks,
            };
            return api;
        },
        isDisposed() {
            return renderController.isDisposed();
        },
        updateCallbacks(nextCallbacks = {}) {
            callbacks = {
                ...callbacks,
                ...nextCallbacks,
            };
        },
        resize({ width: nextWidth, height: nextHeight, pixelRatio: nextPixelRatio } = {}) {
            return renderController.resize({
                width: nextWidth,
                height: nextHeight,
                pixelRatio: nextPixelRatio,
            });
        },
        setActive(active) {
            return renderController.setActive(active);
        },
        updateBloomPresentation(presentation, identity) {
            return renderController.post(MESSAGE_TYPE.BLOOM_PRESENTATION, {
                presentation,
                sceneCommitKey: identity.sceneCommitKey,
                bonsaiMaterializationKey: requireZenBonsaiMaterializationKey(identity.bonsaiMaterializationKey),
                inputSignature: requireZenBonsaiInputSignature(identity.inputSignature),
            });
        },
        updateScene(scenePayload = {}, options = {}) {
            const bonsaiMaterializationKey = requireZenBonsaiMaterializationKey(
                scenePayload?.bonsaiMaterializationKey,
            );
            const inputSignature = requireZenBonsaiInputSignature(scenePayload?.inputSignature);
            const signature = typeof scenePayload?.sceneSignature === 'string'
                ? scenePayload.sceneSignature
                : '';
            const sceneCommitKey = typeof scenePayload?.sceneCommitKey === 'string'
                ? scenePayload.sceneCommitKey
                : '';
            const runtimeSignature = typeof scenePayload?.workerRuntimeSignature === 'string'
                ? scenePayload.workerRuntimeSignature
                : '';
            const dispatchSignature = [
                signature ? `scene:${signature}` : '',
                `scene_commit:${sceneCommitKey || 'none'}`,
                `materialization:${bonsaiMaterializationKey}`,
                `input:${inputSignature}`,
                runtimeSignature ? `worker_runtime:${runtimeSignature}` : '',
                scenePayload?.alphaObservationRequest?.requestId
                    ? `alpha_observation:${scenePayload.alphaObservationRequest.requestId}`
                    : '',
            ].filter(Boolean).join('|');
            const force = options?.force === true;
            if (!force && dispatchSignature && dispatchSignature === lastSceneSignature) {
                return false;
            }
            const sent = renderController.post(MESSAGE_TYPE.SCENE, {
                ...scenePayload,
                bonsaiMaterializationKey,
                inputSignature,
            });
            if (sent) {
                lastSceneSignature = dispatchSignature;
            }
            return sent;
        },
        dispose(options = {}) {
            renderController.dispose(options);
        },
    };

    CONTROLLER_REGISTRY.set(canvas, api);
    return api;
};

export const mountZenBonsaiWorkerRenderer = (options = {}) => {
    const canvas = options?.canvas || null;
    try {
        return CONTROLLER_REGISTRY.retainOrCreate({
            canvas,
            retainController: (existing) => existing.retain({
                onRenderDebugEvent: options?.onRenderDebugEvent || null,
                onFirstFrameReady: options?.onFirstFrameReady || null,
                onBloomPresentationComplete: options?.onBloomPresentationComplete || null,
            }),
            createController: () => createZenBonsaiWorkerRendererController(options),
        });
    } catch (error) {
        const reason = resolveWorkerRuntimeFailureReason(error, 'zen_bonsai_worker_mount_failed');
        const failureDetails = recordZenBonsaiWorkerFailure({
            renderBackend: options?.renderBackend || 'canvas2d',
            stage: 'init',
            reason,
            workerMessageType: 'mount',
            error,
        });
        attachWorkerRuntimeSurfaceFailureDetails(
            error,
            failureDetails,
            'zenBonsaiWorkerFailureDetails',
        );
        throw error;
    }
};
