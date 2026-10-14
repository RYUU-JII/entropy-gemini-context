import {
    WorkerExecutionController,
    WorkerRequestClient,
    WorkerTaskQueue,
    WORKER_FALLBACK_POLICY,
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_EVENT_TYPE,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    WORKER_RUNTIME_SURFACE_IDS,
    WORKER_RUNTIME_TASK_TYPE,
    createWorkerRequestClientConfig,
    recordWorkerRuntimeEvent,
    requireWorkerRuntimeSurface,
} from '@/platform/workers/runtime/index.js';
import {
    resolveWorkerCanvasRuntimeAvailability,
} from '@/themes/core/rendering/workerCanvasRuntime.js';
import {
    ZEN_POND_WORKER_MESSAGE_TYPE,
    buildZenPondWorkerInitPayload,
    requireZenPondWorkerReadyPayload,
} from '../../renderers/worker/core/zenPondWorkerProtocol.js';
import { createZenPondControlChannelCoalescer } from '../../renderers/worker/core/createZenPondControlChannelCoalescer.js';
import {
    buildEnvironmentAuthorityInputProbe as buildEnvironmentAuthorityInputProbeCore,
    buildEnvironmentAuthoritySyncPayload as buildEnvironmentAuthoritySyncPayloadCore,
    buildSceneSessionInputProbe as buildSceneSessionInputProbeCore,
    buildSceneSessionSyncPayload as buildSceneSessionSyncPayloadCore,
    buildFishRosterInputProbe as buildFishRosterInputProbeCore,
    buildFishRosterSyncPayload as buildFishRosterSyncPayloadCore,
    buildRuntimeParamsInputProbe as buildRuntimeParamsInputProbeCore,
    buildRuntimeParamsSyncPayload as buildRuntimeParamsSyncPayloadCore,
    buildRuntimeTuningSnapshot as buildRuntimeTuningSnapshotCore,
    shouldRebuildSceneSessionPayload as shouldRebuildSceneSessionPayloadCore,
    shouldRebuildFishRosterPayload as shouldRebuildFishRosterPayloadCore,
    shouldRebuildRuntimeParamsPayload as shouldRebuildRuntimeParamsPayloadCore,
    shouldRebuildEnvironmentAuthorityPayload as shouldRebuildEnvironmentAuthorityPayloadCore,
} from '../../renderers/worker/core/zenPondWorkerControlPayload.js';
import {
    isObject,
    roundNumber,
    toOptionalFiniteNumber,
    toOptionalUid,
} from './sharedUtils.js';
import { normalizeMetrics, normalizeTopShadowProbe } from './metrics.js';
import { createZenPondFirstFrameAckGate } from './createZenPondFirstFrameAckGate.js';
import { createZenPondWorkerMessageBus } from './createZenPondWorkerMessageBus.js';
import { createZenPondWorkerRequestPipeline } from './internal/createZenPondWorkerRequestPipeline.js';
import { createZenPondWorkerPublicApi } from './internal/createZenPondWorkerPublicApi.js';
import {
    ZEN_HOME_RENDERER_CHANNEL,
} from '../../../runtime/worker/zenHomeRendererWorkerProtocol.js';
import {
    acquireZenHomeRendererWorkerChannel,
    getZenHomeRendererWorkerSessionSnapshot,
} from '../../../runtime/worker/ZenHomeRendererWorkerSession.js';

const ZEN_POND_WORKER_SURFACE = requireWorkerRuntimeSurface(WORKER_RUNTIME_SURFACE_IDS.ZEN_HOME_RENDERER);
export const ZEN_POND_WORKER_ID = ZEN_POND_WORKER_SURFACE.workerId;
const ZEN_POND_RUNTIME_CONTEXT = ZEN_POND_WORKER_SURFACE.context;
const ZEN_POND_RUNTIME_LANE = ZEN_POND_WORKER_SURFACE.lane;
const ZEN_POND_RUNTIME_PRIORITY = ZEN_POND_WORKER_SURFACE.priority;
const RESIZE_CANCEL_KEY = 'zen_pond:resize';
const VISIBILITY_CANCEL_KEY = 'zen_pond:visibility';
const INPUT_CANCEL_KEY = 'zen_pond:input';
const SCENE_SESSION_CANCEL_KEY = 'zen_pond:scene_session';
const ENVIRONMENT_AUTHORITY_CANCEL_KEY = 'zen_pond:environment_authority';
const RUNTIME_PARAMS_CANCEL_KEY = 'zen_pond:runtime_params';
const FISH_ROSTER_CANCEL_KEY = 'zen_pond:fish_roster';
const DEFAULT_INIT_TIMEOUT_MS = ZEN_POND_WORKER_SURFACE.initTimeoutMs;
const DEFAULT_REQUEST_TIMEOUT_MS = ZEN_POND_WORKER_SURFACE.requestTimeoutMs;
const DEFAULT_TELEMETRY_TIMEOUT_MS = 1000;
const DEFAULT_DISPOSE_ACK_TIMEOUT_MS = 120;
const DEFAULT_MAX_QUEUE_SIZE = 120;
const DEFAULT_FIRST_FRAME_ACK_TIMEOUT_MS = 10000;
const MAX_FISH_ROSTER_SYNC_COUNT = 72;
const MESSAGE_TYPE = ZEN_POND_WORKER_MESSAGE_TYPE;
export const ZEN_QUALITY_MODE_FULL = 'full';
const ZEN_POND_RUNTIME_DEBUG = false;
export const ZEN_POND_LOCK_RENDER_SIZE = false;
const FORCE_TOP_SHADOW_DEBUG_BLACKOUT = false;
export const WATER_EFFECTS_PROBE_AUTO_LOG_KEY = '__ZEN_POND_WATER_EFFECTS_PROBE_AUTO_LOG';
const ZEN_POND_CONTROL_PAYLOAD_TELEMETRY = false;

export const debugLog = (label, details = null) => {
    if (!ZEN_POND_RUNTIME_DEBUG) return;
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    console.log(`[ZenPondWorkerRenderer][debug] ${label}`, details || null);
};

export const buildRuntimeTuningSnapshot = (tuning = null) => buildRuntimeTuningSnapshotCore(tuning);

export const buildSceneSessionInputProbe = (options = {}) => buildSceneSessionInputProbeCore(options);

export const shouldRebuildSceneSessionPayload = (prevProbe = null, nextProbe = null) => (
    shouldRebuildSceneSessionPayloadCore(prevProbe, nextProbe)
);

export const buildRuntimeParamsInputProbe = (options = {}) => buildRuntimeParamsInputProbeCore(options);

export const buildEnvironmentAuthorityInputProbe = (options = {}) => (
    buildEnvironmentAuthorityInputProbeCore(options)
);

export const shouldRebuildRuntimeParamsPayload = (prevProbe = null, nextProbe = null) => (
    shouldRebuildRuntimeParamsPayloadCore(prevProbe, nextProbe)
);

export const shouldRebuildEnvironmentAuthorityPayload = (prevProbe = null, nextProbe = null) => (
    shouldRebuildEnvironmentAuthorityPayloadCore(prevProbe, nextProbe)
);

export const buildFishRosterInputProbe = (options = {}) => buildFishRosterInputProbeCore(options);

export const shouldRebuildFishRosterPayload = (prevProbe = null, nextProbe = null) => (
    shouldRebuildFishRosterPayloadCore(prevProbe, nextProbe)
);

export const recordControlPayloadTelemetry = ({
    channel = 'unknown',
    buildMs = 0,
    signature = '',
    sent = false,
    skippedByProbe = false,
} = {}) => {
    if (!ZEN_POND_CONTROL_PAYLOAD_TELEMETRY) return;
    recordWorkerRuntimeEvent({
        type: WORKER_RUNTIME_EVENT_TYPE.START,
        worker: ZEN_POND_WORKER_ID,
        taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_CONTROL,
        lane: ZEN_POND_RUNTIME_LANE,
        priority: WORKER_RUNTIME_PRIORITY.BACKGROUND,
        context: ZEN_POND_RUNTIME_CONTEXT,
        message: 'ZEN_POND_CONTROL_PAYLOAD_TELEMETRY',
        details: {
            channel,
            sent: sent === true,
            skippedByProbe: skippedByProbe === true,
            buildMs: roundNumber(buildMs, 4, 0),
            payloadBytes: typeof signature === 'string' ? signature.length : 0,
        },
    });
};

export const buildFishRosterSyncPayload = (options = {}) => buildFishRosterSyncPayloadCore(options, {
    maxFishRosterSyncCount: MAX_FISH_ROSTER_SYNC_COUNT,
});

export const buildSceneSessionSyncPayload = (options = {}) => buildSceneSessionSyncPayloadCore(options);

export const buildEnvironmentAuthoritySyncPayload = (options = {}) => (
    buildEnvironmentAuthoritySyncPayloadCore(options)
);

const resolveRuntimeQualityMode = (options = {}) => (
    typeof options?.qualityProfile?.qualityMode === 'string' && options.qualityProfile.qualityMode.trim()
        ? options.qualityProfile.qualityMode.trim()
        : ZEN_QUALITY_MODE_FULL
);

export const buildRuntimeParamsSyncPayload = (options = {}) => buildRuntimeParamsSyncPayloadCore(options, {
    zenQualityMode: resolveRuntimeQualityMode(options),
    includeEnvironmentAuthority: false,
});

export const buildInitialRuntimeParamsSyncPayload = (options = {}) => buildRuntimeParamsSyncPayloadCore(options, {
    zenQualityMode: resolveRuntimeQualityMode(options),
    includeEnvironmentAuthority: true,
});

export const resolveTopShadowDebugBlackoutFlag = () => {
    return FORCE_TOP_SHADOW_DEBUG_BLACKOUT === true;
};

export const withTopShadowDebugRuntimeParams = (snapshot = null, debugBlackoutOverride = null) => {
    if (!snapshot || !isObject(snapshot.payload)) return snapshot;
    const debugBlackout = typeof debugBlackoutOverride === 'boolean'
        ? debugBlackoutOverride
        : resolveTopShadowDebugBlackoutFlag();
    const payload = {
        ...snapshot.payload,
        toggles: {
            ...(isObject(snapshot.payload.toggles) ? snapshot.payload.toggles : {}),
            topShadowDebugBlackout: debugBlackout,
        },
    };
    const signatureBase = typeof snapshot.signature === 'string' ? snapshot.signature : '';
    const signature = `${signatureBase}|topShadow_debug_blackout:${debugBlackout ? 1 : 0}`;
    return {
        payload,
        signature,
    };
};

const resolveQueueEventType = (type) => {
    if (type === 'worker_fail') return WORKER_RUNTIME_EVENT_TYPE.FAIL;
    if (type === 'queue_dropped') return WORKER_RUNTIME_EVENT_TYPE.QUEUE_DROPPED;
    if (type === 'request_canceled') return WORKER_RUNTIME_EVENT_TYPE.CANCELED;
    if (type === 'queue_cleared') return WORKER_RUNTIME_EVENT_TYPE.QUEUE_CLEARED;
    return null;
};

const isFatalControlChannelError = (error) => {
    const message = String(error?.message || error || '').toUpperCase();
    if (!message) return false;
    return (
        message.includes('WORKER_UNAVAILABLE')
        || message.includes('WORKER_DISABLED')
        || message.includes('WORKER_RUNTIME_ERROR')
        || message.includes('WORKER_INIT_FAILED')
        || message.includes('ZEN_POND_RESIZE_FAILED')
    );
};

const resolveResponseShape = (value) => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
};

const createRendererResponseErrorPayload = ({
    code = 'ZEN_POND_RENDERER_RESPONSE_INVALID',
    message = 'Zen pond renderer worker response is invalid.',
    requestType = null,
    details = null,
} = {}) => ({
    code,
    message,
    details: {
        requestType: typeof requestType === 'string' && requestType.trim()
            ? requestType.trim()
            : null,
        ...(isObject(details) ? details : {}),
    },
});

const normalizeRendererErrorPayload = (value, requestType = null) => {
    if (isObject(value)) {
        return {
            ...value,
            details: {
                requestType: typeof requestType === 'string' && requestType.trim()
                    ? requestType.trim()
                    : null,
                ...(isObject(value.details) ? value.details : {}),
            },
        };
    }
    return createRendererResponseErrorPayload({
        code: 'ZEN_POND_RENDERER_RESPONSE_ERROR',
        message: String(value || 'ZEN_POND_RENDERER_RESPONSE_ERROR'),
        requestType,
    });
};

const resolveRendererResponse = ({ message = {}, requestType = '' } = {}) => {
    const type = String(message?.type || '');
    if (type === MESSAGE_TYPE.ERROR) {
        return {
            ok: false,
            error: normalizeRendererErrorPayload(message?.error, requestType),
        };
    }
    if (type === MESSAGE_TYPE.RESULT) {
        if (!isObject(message?.result)) {
            return {
                ok: false,
                error: createRendererResponseErrorPayload({
                    code: 'ZEN_POND_RENDERER_RESULT_INVALID',
                    message: 'Zen pond renderer worker returned malformed result.',
                    requestType,
                    details: {
                        expectedShape: 'object',
                        actualShape: resolveResponseShape(message?.result),
                    },
                }),
            };
        }
        return {
            ok: true,
            result: message.result,
        };
    }
    return {
        ok: false,
        error: createRendererResponseErrorPayload({
            code: 'ZEN_POND_RENDERER_MESSAGE_TYPE_INVALID',
            message: 'Zen pond renderer worker returned unsupported response type.',
            requestType,
            details: {
                receivedType: type || null,
            },
        }),
    };
};

const createWorkerRuntimeRecorder = ({
    taskType = WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_CONTROL,
    priority = ZEN_POND_RUNTIME_PRIORITY,
} = {}) => (
    {
        type = WORKER_RUNTIME_EVENT_TYPE.START,
        message = null,
        details = null,
    } = {},
) => {
    recordWorkerRuntimeEvent({
        type,
        worker: ZEN_POND_WORKER_ID,
        taskType,
        lane: ZEN_POND_RUNTIME_LANE,
        priority,
        context: ZEN_POND_RUNTIME_CONTEXT,
        message: typeof message === 'string' && message.trim() ? message : null,
        details: isObject(details) ? details : null,
    });
};

const toRuntimeError = (error, fallback = 'ZEN_POND_WORKER_RUNTIME_ERROR') => {
    const message = String(error?.message || error || fallback);
    const resolved = new Error(message);
    // Preserve the worker call site through this final main-thread wrapper.
    if (typeof error?.stack === 'string') resolved.stack = error.stack;
    if (typeof error?.code === 'string' && error.code.trim()) {
        resolved.code = error.code.trim();
    }
    if (isObject(error?.details)) {
        resolved.details = { ...error.details };
    }
    resolved.cause = error;
    return resolved;
};

const resolveWorkerRuntimeEventErrorMessage = (details = null) => {
    const raw = details?.error ?? details?.reason ?? null;
    if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
    }
    if (raw instanceof Error) {
        const msg = String(raw.message || '').trim();
        if (msg) return msg;
    }
    if (isObject(raw)) {
        try {
            const serialized = JSON.stringify(raw);
            if (serialized) return serialized;
        } catch (_) {
            // noop
        }
    }
    return String(raw || 'ZEN_POND_WORKER_RUNTIME_EVENT_ERROR');
};

export const recordHardWorkerFailure = (reason, details = null) => {
    const message = `ZEN_POND_WORKER_HARD_FAIL:${String(reason || 'unknown')}`;
    recordWorkerRuntimeEvent({
        type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
        worker: ZEN_POND_WORKER_ID,
        taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_INIT,
        lane: ZEN_POND_RUNTIME_LANE,
        priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        context: ZEN_POND_RUNTIME_CONTEXT,
        message,
        details: isObject(details) ? details : null,
    });
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
        const errorText = typeof details?.error === 'string' ? `: ${details.error}` : '';
        const stackText = typeof details?.stack === 'string' ? `\n${details.stack}` : '';
        // Chrome's extension error list flattens object arguments to [object Object].
        console.error(`[ZenPondWorkerRenderer] ${message}${errorText}${stackText}`, details || null);
    }
};

export const assertWorkerMountContract = (options = {}) => {
    const runtimeAvailability = resolveWorkerCanvasRuntimeAvailability({
        host: options?.backgroundHost,
        requireDocument: true,
        requireHost: true,
    });
    const hasWorker = runtimeAvailability.hasWorker;
    const hasOffscreenCanvas = runtimeAvailability.hasOffscreenCanvas;
    const hasDocument = runtimeAvailability.hasDocument;
    const hasBackgroundHost = runtimeAvailability.hasHost;
    const hasAnimationEnabledRef = isObject(options?.animationEnabledRef);
    const hasRosterSnapshotRef = isObject(options?.rosterSnapshotRef);
    const hasAppearanceMapRef = isObject(options?.appearanceMapRef);
    const hasEnvAuthorityRef = isObject(options?.envAuthorityRef);
    if (hasWorker && hasOffscreenCanvas && hasDocument && hasBackgroundHost) {
        if (
            hasAnimationEnabledRef
            && hasRosterSnapshotRef
            && hasAppearanceMapRef
            && hasEnvAuthorityRef
        ) {
            return options.backgroundHost;
        }
    }
    const missing = [];
    if (!hasWorker) missing.push('Worker');
    if (!hasOffscreenCanvas) missing.push('OffscreenCanvas');
    if (!hasDocument) missing.push('document');
    if (!hasBackgroundHost) missing.push('backgroundHost');
    if (!hasAnimationEnabledRef) missing.push('animationEnabledRef');
    if (!hasRosterSnapshotRef) missing.push('rosterSnapshotRef');
    if (!hasAppearanceMapRef) missing.push('appearanceMapRef');
    if (!hasEnvAuthorityRef) missing.push('envAuthorityRef');
    const details = {
        hasWorker,
        hasOffscreenCanvas,
        hasDocument,
        hasBackgroundHost,
        hasAnimationEnabledRef,
        hasRosterSnapshotRef,
        hasAppearanceMapRef,
        hasEnvAuthorityRef,
        missing,
    };
    recordHardWorkerFailure('strict_worker_mount_contract_violation', details);
    throw new Error(`ZEN_POND_WORKER_MOUNT_CONTRACT_VIOLATION:${missing.join(',') || 'unknown'}`);
};

export const createZenPondWorkerRuntimeClient = ({
    canvas = null,
    onReady = null,
    onError = null,
    onMetrics = null,
    onFirstFrameAck = null,
    onPresentationSceneFrameAck = null,
    onInvitationMembership = null,
    onStartupTimeline = null,
} = {}) => {
    const sessionId = `zen_pond_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    let sequence = 0;
    const runtime = {
        started: false,
        disposed: false,
        initPromise: null,
        latestMetrics: null,
        lastVisibilityRequest: null,
        capabilities: {
            supportsWorkerRaf: null,
            renderer: null,
        },
    };
    const runtimeDebug = (label, details = null) => {
        debugLog(`${label}`, {
            sessionId,
            ...(isObject(details) ? details : {}),
        });
    };

    const emitError = (error) => {
        const runtimeError = toRuntimeError(error);
        if (typeof onError === 'function') {
            onError(runtimeError);
        }
        return runtimeError;
    };

    const emitMetrics = (metrics) => {
        const normalized = normalizeMetrics(metrics);
        if (!normalized) return;
        runtime.latestMetrics = normalized;
        if (typeof onMetrics === 'function') {
            onMetrics(normalized);
        }
    };

    const ackGate = createZenPondFirstFrameAckGate({
        defaultTimeoutMs: DEFAULT_FIRST_FRAME_ACK_TIMEOUT_MS,
        onTimeout: (error) => {
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.TIMEOUT,
                worker: ZEN_POND_WORKER_ID,
                taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_INIT,
                lane: ZEN_POND_RUNTIME_LANE,
                priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
                context: ZEN_POND_RUNTIME_CONTEXT,
                message: error?.message || 'ZEN_POND_FIRST_FRAME_ACK_TIMEOUT',
            });
        },
    });

    let pondWorkerChannel = null;
    let requestClient = null;
    const acquirePondRenderWorker = () => {
        const workerChannel = acquireZenHomeRendererWorkerChannel({
            channel: ZEN_HOME_RENDERER_CHANNEL.POND,
        });
        pondWorkerChannel = workerChannel;
        const sessionSnapshot = getZenHomeRendererWorkerSessionSnapshot();
        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.START,
            worker: ZEN_POND_WORKER_ID,
            taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_INIT,
            lane: ZEN_POND_RUNTIME_LANE,
            priority: ZEN_POND_RUNTIME_PRIORITY,
            context: ZEN_POND_RUNTIME_CONTEXT,
            message: 'ZEN_POND_WORKER_ADMISSION_LEASE_ACQUIRED',
            details: {
                leaseId: sessionSnapshot.leaseId,
                channel: ZEN_HOME_RENDERER_CHANNEL.POND,
            },
        });
        return workerChannel;
    };
    const releasePondRenderWorker = (worker = null, meta = {}) => {
        const workerChannel = pondWorkerChannel;
        pondWorkerChannel = null;
        if (workerChannel) {
            const reason = typeof meta?.reason === 'string' ? meta.reason : 'pond_worker_disposed';
            const leaseId = getZenHomeRendererWorkerSessionSnapshot().leaseId;
            const released = workerChannel.terminate(reason);
            if (!released) return;
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.SUCCESS,
                worker: ZEN_POND_WORKER_ID,
                taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_TELEMETRY,
                lane: ZEN_POND_RUNTIME_LANE,
                priority: WORKER_RUNTIME_PRIORITY.BACKGROUND,
                context: ZEN_POND_RUNTIME_CONTEXT,
                message: 'ZEN_POND_WORKER_ADMISSION_LEASE_RELEASED',
                details: {
                    leaseId,
                    channel: ZEN_HOME_RENDERER_CHANNEL.POND,
                    reason,
                    released,
                },
            });
            return;
        }
        if (worker && typeof worker.terminate === 'function') {
            worker.terminate();
        }
    };

    requestClient = new WorkerRequestClient(createWorkerRequestClientConfig(
        WORKER_RUNTIME_SURFACE_IDS.ZEN_HOME_RENDERER,
        {
            taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_INIT,
            initMessage: { type: MESSAGE_TYPE.PING },
            initReadyTypes: [MESSAGE_TYPE.READY],
            responseResolver: resolveRendererResponse,
            requestTransferResolver: ({ type, payload }) => (
                String(type || '') === MESSAGE_TYPE.INIT_CANVAS && payload?.canvas
                    ? [payload.canvas]
                    : []
            ),
            onMessage: createZenPondWorkerMessageBus({
                messageType: MESSAGE_TYPE,
                workerId: ZEN_POND_WORKER_ID,
                waterEffectsProbeAutoLogKey: WATER_EFFECTS_PROBE_AUTO_LOG_KEY,
                isObject,
                normalizeTopShadowProbe,
                resolveWorkerRuntimeEventErrorMessage,
                recordWorkerRuntimeEvent,
                runtimeEventType: WORKER_RUNTIME_EVENT_TYPE,
                runtimeTaskType: WORKER_RUNTIME_TASK_TYPE,
                runtimeLane: WORKER_RUNTIME_LANE,
                runtimeLaneValue: ZEN_POND_RUNTIME_LANE,
                runtimePriority: WORKER_RUNTIME_PRIORITY,
                runtimeContext: WORKER_RUNTIME_CONTEXT,
                runtimeContextValue: ZEN_POND_RUNTIME_CONTEXT,
                runtimeDebug,
                ackGate,
                onFirstFrameAck,
                onPresentationSceneFrameAck,
                onInvitationMembership,
                emitError,
                onReady,
                getCapabilities: () => runtime.capabilities,
                setCapabilities: (nextCapabilities) => {
                    runtime.capabilities = nextCapabilities;
                },
                requireReadyPayload: requireZenPondWorkerReadyPayload,
            }),
            workerFactory: acquirePondRenderWorker,
            workerDisposer: releasePondRenderWorker,
        },
    ));

    const executionController = new WorkerExecutionController({
        workerId: ZEN_POND_WORKER_ID,
        fallbackPolicy: WORKER_FALLBACK_POLICY.STRICT,
        maxConsecutiveFailures: 2,
        circuitOpenMs: 8000,
        eventRecorder: createWorkerRuntimeRecorder(),
    });

    const taskQueue = new WorkerTaskQueue({
        concurrency: 1,
        maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
        onEvent: (event = {}) => {
            const eventType = resolveQueueEventType(event?.type);
            if (!eventType) return;
            recordWorkerRuntimeEvent({
                type: eventType,
                worker: ZEN_POND_WORKER_ID,
                taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_CONTROL,
                lane: ZEN_POND_RUNTIME_LANE,
                priority: ZEN_POND_RUNTIME_PRIORITY,
                context: ZEN_POND_RUNTIME_CONTEXT,
                message: typeof event?.message === 'string' ? event.message : null,
                details: event,
            });
        },
    });

    const handleControlChannelError = (error, meta = null) => {
        const message = String(error?.message || error || 'ZEN_POND_CONTROL_CHANNEL_ERROR');
        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
            worker: ZEN_POND_WORKER_ID,
            taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_POND_RENDER_CONTROL,
            lane: ZEN_POND_RUNTIME_LANE,
            priority: WORKER_RUNTIME_PRIORITY.BACKGROUND,
            context: ZEN_POND_RUNTIME_CONTEXT,
            message,
            details: isObject(meta)
                ? {
                    channelKey: typeof meta?.channelKey === 'string' ? meta.channelKey : null,
                    label: typeof meta?.descriptor?.label === 'string' ? meta.descriptor.label : null,
                }
                : null,
        });
        if (isFatalControlChannelError(error)) {
            emitError(error);
        }
    };

    const requestPipeline = createZenPondWorkerRequestPipeline({
        messageType: MESSAGE_TYPE,
        requestClient,
        executionController,
        taskQueue,
        createControlChannelCoalescer: createZenPondControlChannelCoalescer,
        sessionId,
        nextSequence: () => (++sequence),
        isObject,
        defaultRequestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
        getStarted: () => runtime.started === true,
        getDisposed: () => runtime.disposed === true,
        getLastVisibilityRequest: () => runtime.lastVisibilityRequest,
        setLastVisibilityRequest: (next) => {
            runtime.lastVisibilityRequest = next;
        },
        visibilityCancelKey: VISIBILITY_CANCEL_KEY,
        runtimeTaskType: WORKER_RUNTIME_TASK_TYPE,
        runtimePriority: WORKER_RUNTIME_PRIORITY,
        onTaskError: handleControlChannelError,
    });

    return createZenPondWorkerPublicApi({
        runtime,
        canvas,
        messageType: MESSAGE_TYPE,
        buildInitPayload: buildZenPondWorkerInitPayload,
        zenQualityModeFull: ZEN_QUALITY_MODE_FULL,
        defaultInitTimeoutMs: DEFAULT_INIT_TIMEOUT_MS,
        defaultFirstFrameAckTimeoutMs: DEFAULT_FIRST_FRAME_ACK_TIMEOUT_MS,
        defaultTelemetryTimeoutMs: DEFAULT_TELEMETRY_TIMEOUT_MS,
        defaultDisposeAckTimeoutMs: DEFAULT_DISPOSE_ACK_TIMEOUT_MS,
        runtimeTaskType: WORKER_RUNTIME_TASK_TYPE,
        runtimePriority: WORKER_RUNTIME_PRIORITY,
        isObject,
        toOptionalUid,
        toOptionalFiniteNumber,
        runtimeDebug,
        requestClient,
        runRequest: requestPipeline.runRequest,
        runLatest: requestPipeline.runLatest,
        createControlAckValidator: requestPipeline.createControlAckValidator,
        syncVisibilityState: requestPipeline.syncVisibilityState,
        clearControlCoalescer: requestPipeline.clearControlCoalescer,
        ackGate,
        onReady,
        emitError,
        emitMetrics,
        taskQueue,
        onStartupTimeline,
        cancelKey: {
            resize: RESIZE_CANCEL_KEY,
            input: INPUT_CANCEL_KEY,
            sceneSession: SCENE_SESSION_CANCEL_KEY,
            environmentAuthority: ENVIRONMENT_AUTHORITY_CANCEL_KEY,
            runtimeParams: RUNTIME_PARAMS_CANCEL_KEY,
            fishRoster: FISH_ROSTER_CANCEL_KEY,
        },
    });
};
