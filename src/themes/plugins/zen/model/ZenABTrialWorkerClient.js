import { isZenExperimentalWorkerRuntimeEnabled } from './SakuraV2Runtime';
import {
    createZenWorkerError,
    createZenWorkerUnavailableError,
    normalizeZenWorkerErrorPayload,
    resolveZenWorkerErrorMessage,
} from './ZenWorkerError.js';
import {
    WorkerRequestClient,
    WorkerTaskQueue,
    recordWorkerRuntimeEvent,
    WORKER_RUNTIME_EVENT_TYPE,
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    WORKER_RUNTIME_SURFACE_IDS,
    WORKER_RUNTIME_TASK_TYPE,
    createWorkerRequestClientConfig,
    resolveWorkerRuntimePriority,
    requireWorkerRuntimeSurface,
} from '../../../../platform/workers/runtime/index.js';
import ZenAbTrialEvaluatorWorker from '@zen-ab-trial-worker';
import ZenModelRepository from '../state/ZenModelRepository.js';
import {
    createZenWorkerClientProfileGenerationLease,
    requireZenWorkerProfileGeneration,
    requireZenWorkerResponseProfileGeneration,
} from '../contracts/ZenWorkerProfileGenerationContract.js';

const ZEN_AB_TRIAL_WORKER_SURFACE = requireWorkerRuntimeSurface(WORKER_RUNTIME_SURFACE_IDS.ZEN_AB_TRIAL);
const DEFAULT_INIT_TIMEOUT_MS = ZEN_AB_TRIAL_WORKER_SURFACE.initTimeoutMs;
const DEFAULT_REQUEST_TIMEOUT_MS = ZEN_AB_TRIAL_WORKER_SURFACE.requestTimeoutMs;
const DEFAULT_MAX_QUEUE_SIZE = 160;
const MAX_CANCELED_TAGS = 64;
const ZEN_AB_TRIAL_RUNTIME_WORKER_ID = 'zen_ab_trial_runtime';

const resolveWorkerSupport = () => (
    typeof Worker !== 'undefined'
);
const createZenAbTrialEvaluatorWorker = () => {
    if (!isZenExperimentalWorkerRuntimeEnabled()) {
        throw new Error('ZEN_EXPERIMENTAL_WORKER_RUNTIME_DISABLED');
    }
    return new ZenAbTrialEvaluatorWorker();
};
const resolveRequestTag = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);
const isPlainObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);
const resolveValueShape = (value) => {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (value === null) {
        return 'null';
    }
    return typeof value;
};
const normalizeWorkerErrorPayload = (
    value,
    {
        fallbackCode = 'ZEN_AB_TRIAL_WORKER_REQUEST_FAILED',
        fallbackMessage = 'Zen A/B trial worker request failed.',
        details = null,
    } = {},
) => normalizeZenWorkerErrorPayload(value, {
    fallbackCode,
    fallbackMessage,
    details,
});
const createZenABTrialWorkerError = (
    value,
    {
        fallbackMessage = 'Zen A/B trial worker request failed.',
    } = {},
) => createZenWorkerError(value, {
    fallbackMessage,
});
const createZenABTrialWorkerUnavailableError = (reason, details = null) => (
    createZenWorkerUnavailableError({
        code: 'ZEN_AB_TRIAL_WORKER_UNAVAILABLE',
        message: reason,
        reason,
        surface: ZEN_AB_TRIAL_WORKER_SURFACE,
        details,
    })
);
const resolveErrorMessage = (error, fallback = 'ZEN_AB_TRIAL_WORKER_FAILED') => (
    resolveZenWorkerErrorMessage(error, fallback)
);
const resolveSafeTaskType = (value, fallback = WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);
const resolveSafePriority = (value, fallback = WORKER_RUNTIME_PRIORITY.INTERACTIVE) => (
    resolveWorkerRuntimePriority(value ?? fallback)
);
const resolveOptionalMessage = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);
const resolveQueueEventType = (value) => {
    if (value === 'worker_fail') return WORKER_RUNTIME_EVENT_TYPE.FAIL;
    if (value === 'queue_dropped') return WORKER_RUNTIME_EVENT_TYPE.QUEUE_DROPPED;
    if (value === 'request_canceled') return WORKER_RUNTIME_EVENT_TYPE.CANCELED;
    if (value === 'queue_cleared') return WORKER_RUNTIME_EVENT_TYPE.QUEUE_CLEARED;
    return null;
};
const createRequestCanceledError = (
    message = 'WORKER_TASK_CANCELED',
    code = 'WORKER_TASK_CANCELED',
) => {
    const error = new Error(resolveErrorMessage(message, 'WORKER_TASK_CANCELED'));
    error.code = code;
    return error;
};

const createRequestQueue = (onEvent = null) => new WorkerTaskQueue({
    concurrency: 1,
    maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
    onEvent: typeof onEvent === 'function' ? onEvent : undefined,
});

const resolveABTrialTaskType = (requestType) => (
    requestType === 'BUILD_SOBOL_COLD_START_POOL'
        ? WORKER_RUNTIME_TASK_TYPE.ZEN_COLD_START_POOL
        : WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL
);

const validateABTrialWorkerResult = ({
    result,
    requestType,
    resultKey,
    invalidCode,
    invalidMessage,
    expectedShape,
    details = null,
} = {}) => {
    const baseDetails = {
        requestType: resolveOptionalMessage(requestType),
        expectedShape,
        ...(
            details && typeof details === 'object'
                ? details
                : {}
        ),
    };
    if (!isPlainObject(result)) {
        return {
            ok: false,
            error: {
                code: 'ZEN_AB_TRIAL_WORKER_RESULT_INVALID',
                message: invalidMessage,
                details: {
                    ...baseDetails,
                    actualShape: resolveValueShape(result),
                },
            },
        };
    }
    if (!Array.isArray(result?.[resultKey])) {
        return {
            ok: false,
            error: {
                code: invalidCode,
                message: invalidMessage,
                details: {
                    ...baseDetails,
                    actualShape: resolveValueShape(result?.[resultKey]),
                },
            },
        };
    }
    return {
        ok: true,
        result,
    };
};

const requireABTrialWorkerResult = (options = {}) => {
    const validation = validateABTrialWorkerResult(options);
    if (validation.ok) {
        return validation.result;
    }
    throw createZenABTrialWorkerError(validation.error, {
        fallbackMessage: validation.error?.message || 'Zen A/B trial worker result is invalid.',
    });
};

export const resolveABTrialResponse = ({
    message = {},
    requestType = '',
    requestOptions = null,
} = {}) => {
    const type = String(message?.type || '');
    try {
        requireZenWorkerResponseProfileGeneration(
            message,
            requestOptions?.expectedProfileGeneration,
        );
    } catch (error) {
        return {
            ok: false,
            error: normalizeWorkerErrorPayload(error, {
                fallbackCode: 'ZEN_AB_TRIAL_WORKER_PROFILE_GENERATION_INVALID',
                fallbackMessage: 'Zen A/B trial worker returned an invalid profile generation.',
                details: {
                    requestType: resolveOptionalMessage(requestType),
                },
            }),
        };
    }
    if (type === 'ERROR') {
        return {
            ok: false,
            error: normalizeWorkerErrorPayload(
                message?.error,
                {
                    fallbackCode: 'ZEN_AB_TRIAL_WORKER_REQUEST_FAILED',
                    fallbackMessage: 'Zen A/B trial worker request failed.',
                    details: {
                        requestType: resolveOptionalMessage(requestType),
                    },
                },
            ),
        };
    }
    if (type === 'RESULT') {
        if (requestType === 'EVALUATE_TRIAL_BATCH') {
            return validateABTrialWorkerResult({
                result: message?.result,
                requestType,
                resultKey: 'entries',
                invalidCode: 'ZEN_AB_TRIAL_WORKER_RESULT_ENTRIES_INVALID',
                invalidMessage: 'Zen A/B trial worker returned malformed evaluation result.',
                expectedShape: '{ entries: Array }',
            });
        }
        if (requestType === 'BUILD_SOBOL_COLD_START_POOL') {
            return validateABTrialWorkerResult({
                result: message?.result,
                requestType,
                resultKey: 'pool',
                invalidCode: 'ZEN_AB_TRIAL_WORKER_RESULT_POOL_INVALID',
                invalidMessage: 'Zen A/B trial worker returned malformed cold-start result.',
                expectedShape: '{ pool: Array }',
            });
        }
        return {
            ok: true,
            result: message?.result ?? null,
        };
    }
    return {
        ok: false,
        error: normalizeWorkerErrorPayload(
            {
                code: 'ZEN_AB_TRIAL_WORKER_MESSAGE_TYPE_INVALID',
                message: 'Zen A/B trial worker returned an unsupported message type.',
                details: {
                    requestType: resolveOptionalMessage(requestType),
                    receivedType: type || null,
                },
            },
            {
                fallbackCode: 'ZEN_AB_TRIAL_WORKER_MESSAGE_TYPE_INVALID',
                fallbackMessage: 'Zen A/B trial worker returned an unsupported message type.',
            },
        ),
    };
};

export class ZenABTrialWorkerClient {
    constructor(options = {}) {
        const optionEnabled = options?.enabled !== false;
        const runtimeEnabled = isZenExperimentalWorkerRuntimeEnabled();
        this.enabled = optionEnabled && runtimeEnabled;
        this.disabledReason = this.enabled
            ? null
            : (
                optionEnabled
                    ? 'ZEN_EXPERIMENTAL_WORKER_RUNTIME_DISABLED'
                    : 'ZEN_AB_TRIAL_WORKER_DISABLED_BY_OPTIONS'
            );
        this.initTimeoutMs = Number.isFinite(options?.initTimeoutMs)
            ? Math.max(400, Math.floor(options.initTimeoutMs))
            : DEFAULT_INIT_TIMEOUT_MS;
        this.requestTimeoutMs = Number.isFinite(options?.requestTimeoutMs)
            ? Math.max(1500, Math.floor(options.requestTimeoutMs))
            : DEFAULT_REQUEST_TIMEOUT_MS;
        this.client = null;
        this.ready = false;
        this.requestId = 0;
        this.pending = new Map();
        this.pendingByTag = new Map();
        this.canceledTags = [];
        this.initPromise = null;
        this.lastUnavailableReason = null;
        this.workerAvailable = resolveWorkerSupport();
        this.profileGenerationOwner = options?.profileGenerationOwner || null;
        this.profileGenerationLease = null;
        this.requestQueue = createRequestQueue(
            (event = {}) => this.handleQueueEvent(event),
        );
    }

    resolveUnavailableReason(fallback = 'ZEN_AB_TRIAL_WORKER_NOT_READY') {
        const clientReason = this.client?.lastDisableReason;
        if (typeof clientReason === 'string' && clientReason.trim()) {
            return clientReason;
        }
        if (this.lastUnavailableReason) {
            return this.lastUnavailableReason;
        }
        if (this.disabledReason) {
            return this.disabledReason;
        }
        if (!this.workerAvailable) {
            return 'WORKER_API_UNAVAILABLE';
        }
        return fallback;
    }

    createUnavailableError(reason = null, details = null) {
        return createZenABTrialWorkerUnavailableError(
            resolveOptionalMessage(reason) || this.resolveUnavailableReason(),
            details,
        );
    }

    async init() {
        if (!this.enabled || !this.workerAvailable) {
            return false;
        }
        if (this.ready && this.client?.isReady()) {
            return true;
        }
        if (this.initPromise) {
            return this.initPromise;
        }

        const client = this.client || this.createRequestClient();
        this.client = client;
        const initPromise = this.initRequestClient(client);
        this.initPromise = initPromise;
        return initPromise.finally(() => {
            if (this.initPromise === initPromise) {
                this.initPromise = null;
            }
        });
    }

    async evaluateTrialBatch(payload = {}, options = {}) {
        const requestPayload = isPlainObject(payload)
            ? payload
            : {};
        const trials = Array.isArray(requestPayload?.trials)
            ? requestPayload.trials
            : [];
        const candidates = Array.isArray(requestPayload?.candidates)
            ? requestPayload.candidates
            : [];
        if (!trials.length && !candidates.length) {
            return { entries: [], candidates: [] };
        }

        const requestTag = resolveRequestTag(options?.requestTag || requestPayload?.requestTag);
        if (requestTag && this.isRequestTagCanceled(requestTag)) {
            return null;
        }

        return this.enqueueClientTask({
            taskId: 'eval',
            requestTag,
            priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
            taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL,
            run: async () => {
                const profileGeneration = await this.requireProfileGeneration();
                const isReady = await this.init();
                if (!isReady || !this.ready) {
                    throw this.createUnavailableError(null, {
                        requestType: 'EVALUATE_TRIAL_BATCH',
                    });
                }
                if (!this.client?.isReady()) {
                    throw this.createUnavailableError('ZEN_AB_TRIAL_WORKER_NOT_READY', {
                        requestType: 'EVALUATE_TRIAL_BATCH',
                    });
                }

                const useCandidateBatch = candidates.length > 0;
                const rawResult = await this.postRequest(
                    'EVALUATE_TRIAL_BATCH',
                    requestPayload,
                    {
                        ...options,
                        requestTag,
                        profileGeneration,
                    },
                );
                await this.requireProfileGeneration();
                if (requestTag && this.isRequestTagCanceled(requestTag)) {
                    return null;
                }
                const result = requireABTrialWorkerResult({
                    result: rawResult,
                    requestType: 'EVALUATE_TRIAL_BATCH',
                    resultKey: 'entries',
                    invalidCode: 'ZEN_AB_TRIAL_WORKER_RESULT_ENTRIES_INVALID',
                    invalidMessage: 'Zen A/B trial worker returned malformed evaluation result.',
                    expectedShape: '{ entries: Array }',
                });
                if (useCandidateBatch) {
                    requireABTrialWorkerResult({
                        result,
                        requestType: 'EVALUATE_TRIAL_BATCH',
                        resultKey: 'candidates',
                        invalidCode: 'ZEN_AB_TRIAL_WORKER_RESULT_CANDIDATES_INVALID',
                        invalidMessage: 'Zen A/B trial worker returned malformed candidate evaluation result.',
                        expectedShape: '{ candidates: Array }',
                    });
                }

                return {
                    entries: result.entries,
                    candidates: Array.isArray(result.candidates) ? result.candidates : [],
                };
            }
        });
    }

    async buildSobolColdStartPool(payload = {}, options = {}) {
        const requestPayload = isPlainObject(payload)
            ? payload
            : {};
        const requestTag = resolveRequestTag(options?.requestTag || requestPayload?.requestTag);
        if (requestTag && this.isRequestTagCanceled(requestTag)) {
            return null;
        }

        return this.enqueueClientTask({
            taskId: 'cold_start_pool',
            requestTag,
            dedupeKey: requestTag ? `cold_start_pool:${requestTag}` : null,
            priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
            taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_COLD_START_POOL,
            run: async () => {
                const profileGeneration = await this.requireProfileGeneration();
                const isReady = await this.init();
                if (!isReady || !this.ready) {
                    throw this.createUnavailableError(null, {
                        requestType: 'BUILD_SOBOL_COLD_START_POOL',
                    });
                }
                if (!this.client?.isReady()) {
                    throw this.createUnavailableError('ZEN_AB_TRIAL_WORKER_NOT_READY', {
                        requestType: 'BUILD_SOBOL_COLD_START_POOL',
                    });
                }
                const result = await this.postRequest(
                    'BUILD_SOBOL_COLD_START_POOL',
                    requestPayload,
                    {
                        ...options,
                        requestTag,
                        profileGeneration,
                    },
                );
                await this.requireProfileGeneration();
                return requireABTrialWorkerResult({
                    result,
                    requestType: 'BUILD_SOBOL_COLD_START_POOL',
                    resultKey: 'pool',
                    invalidCode: 'ZEN_AB_TRIAL_WORKER_RESULT_POOL_INVALID',
                    invalidMessage: 'Zen A/B trial worker returned malformed cold-start result.',
                    expectedShape: '{ pool: Array }',
                });
            },
        });
    }

    cancelTaggedRequests(requestTag, options = {}) {
        const normalizedTag = resolveRequestTag(requestTag);
        if (!normalizedTag) {
            return;
        }
        const reason = resolveErrorMessage(
            options?.reason,
            'ZEN_AB_TRIAL_REQUEST_CANCELED',
        );
        const hardCancel = options?.hard !== false;
        this.requestQueue.cancelByKey(normalizedTag, reason);
        this.rememberCanceledTag(normalizedTag);
        const pendingIds = Array.from(this.pendingByTag.get(normalizedTag) || []);
        const cancelError = createRequestCanceledError(reason);
        pendingIds.forEach((id) => {
            this.finalizeRequest(id, 'reject', cancelError);
        });
        this.pendingByTag.delete(normalizedTag);

        if (hardCancel && pendingIds.length > 0) {
            this.releaseRequestClient(reason);
        }
    }

    dispose() {
        this.rejectPendingRequests('ZEN_AB_TRIAL_WORKER_DISPOSED');
        this.requestQueue.clear('ZEN_AB_TRIAL_WORKER_DISPOSED');
        this.releaseRequestClient('ZEN_AB_TRIAL_WORKER_DISPOSED');
        this.pendingByTag.clear();
        this.canceledTags = [];
    }

    createRequestClient() {
        return new WorkerRequestClient(createWorkerRequestClientConfig(
            WORKER_RUNTIME_SURFACE_IDS.ZEN_AB_TRIAL,
            {
                workerFactory: createZenAbTrialEvaluatorWorker,
                initMessage: { type: 'PING' },
                initReadyTypes: ['READY'],
                initTimeoutMs: this.initTimeoutMs,
                requestTimeoutMs: this.requestTimeoutMs,
                responseResolver: resolveABTrialResponse,
            },
        ));
    }

    async initRequestClient(client) {
        try {
            const ready = await client.init();
            if (this.client !== client) {
                return false;
            }
            this.ready = Boolean(ready && client.isReady());
            if (!this.ready) {
                this.lastUnavailableReason = client.lastDisableReason
                    || 'ZEN_AB_TRIAL_CLIENT_INIT_UNAVAILABLE';
                this.releaseRequestClient('ZEN_AB_TRIAL_CLIENT_INIT_UNAVAILABLE');
                return false;
            }
            this.lastUnavailableReason = null;
            return true;
        } catch (error) {
            if (this.client === client) {
                this.lastUnavailableReason = resolveErrorMessage(
                    error,
                    'ZEN_AB_TRIAL_CLIENT_INIT_FAILED',
                );
                this.releaseRequestClient('ZEN_AB_TRIAL_CLIENT_INIT_FAILED');
            }
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
                worker: ZEN_AB_TRIAL_RUNTIME_WORKER_ID,
                taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL,
                lane: WORKER_RUNTIME_LANE.COMPUTE,
                priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
                context: WORKER_RUNTIME_CONTEXT.UI,
                message: resolveErrorMessage(error, 'ZEN_AB_TRIAL_CLIENT_INIT_FAILED'),
                details: {
                    stage: 'client_init',
                },
            });
            return false;
        }
    }

    postRequest(type, payload = {}, options = {}) {
        const client = this.client;
        if (!client || !this.ready || !client.isReady()) {
            return Promise.reject(this.createUnavailableError('ZEN_AB_TRIAL_WORKER_NOT_READY', {
                requestType: resolveOptionalMessage(type),
            }));
        }
        const requestTag = resolveRequestTag(options?.requestTag || payload?.requestTag);
        if (requestTag && this.isRequestTagCanceled(requestTag)) {
            return Promise.reject(new Error('ZEN_AB_TRIAL_REQUEST_CANCELED'));
        }

        const localRequestId = ++this.requestId;
        const timeoutMs = Number.isFinite(options?.timeoutMs)
            ? Math.max(600, Math.floor(options.timeoutMs))
            : this.requestTimeoutMs;
        const profileGeneration = requireZenWorkerProfileGeneration(
            options?.profileGeneration,
        );
        const safePayload = {
            ...(isPlainObject(payload) ? payload : {}),
            profileGeneration,
        };

        return new Promise((resolve, reject) => {
            this.pending.set(localRequestId, {
                resolve,
                reject,
                requestTag,
            });
            this.trackPendingTag(localRequestId, requestTag);

            client.request(
                type,
                safePayload,
                {
                    taskType: resolveABTrialTaskType(type),
                    priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
                    timeoutMs,
                    expectedProfileGeneration: profileGeneration,
                },
            ).then((result) => {
                if (!this.pending.has(localRequestId)) {
                    return;
                }
                this.finalizeRequest(localRequestId, 'resolve', result);
            }).catch((error) => {
                if (!this.pending.has(localRequestId)) {
                    return;
                }
                this.finalizeRequest(localRequestId, 'reject', error);
            });
        });
    }

    getProfileGenerationLease() {
        if (this.profileGenerationLease === null) {
            this.profileGenerationLease = createZenWorkerClientProfileGenerationLease({
                profileGenerationOwner: this.profileGenerationOwner
                    || ZenModelRepository.getInstance(),
            });
        }
        return this.profileGenerationLease;
    }

    requireProfileGeneration() {
        return this.getProfileGenerationLease().requireCurrent();
    }

    enqueueClientTask({
        taskId = 'task',
        requestTag = null,
        dedupeKey = null,
        priority = WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        taskType = WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL,
        run = null,
    } = {}) {
        if (typeof run !== 'function') {
            return Promise.reject(createZenABTrialWorkerError({
                code: 'ZEN_AB_TRIAL_TASK_RUNNER_INVALID',
                message: 'ZEN_AB_TRIAL_TASK_RUNNER_INVALID',
                details: {
                    taskId,
                    taskType,
                },
            }));
        }
        const normalizedTag = resolveRequestTag(requestTag);
        const normalizedDedupeKey = resolveRequestTag(dedupeKey);
        if (normalizedTag && this.isRequestTagCanceled(normalizedTag)) {
            return Promise.resolve(null);
        }
        return this.requestQueue.enqueue(
            {
                id: `${taskId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
                priority,
                cancelKey: normalizedTag,
                dedupeKey: normalizedDedupeKey,
                taskType,
            },
            async () => {
                if (normalizedTag && this.isRequestTagCanceled(normalizedTag)) {
                    return null;
                }
                return run();
            },
        );
    }

    finalizeRequest(id, status, value = null) {
        const pending = this.pending.get(id);
        if (!pending) {
            return;
        }
        this.pending.delete(id);
        this.untrackPendingTag(id, pending.requestTag);

        if (status === 'resolve') {
            pending.resolve(value);
            return;
        }
        pending.reject(createZenABTrialWorkerError(value, {
            fallbackMessage: 'ZEN_AB_TRIAL_WORKER_REQUEST_FAILED',
        }));
    }

    trackPendingTag(id, requestTag) {
        if (!requestTag) {
            return;
        }
        if (!this.pendingByTag.has(requestTag)) {
            this.pendingByTag.set(requestTag, new Set());
        }
        this.pendingByTag.get(requestTag).add(id);
    }

    untrackPendingTag(id, requestTag) {
        if (!requestTag || !this.pendingByTag.has(requestTag)) {
            return;
        }
        const tracked = this.pendingByTag.get(requestTag);
        tracked.delete(id);
        if (!tracked.size) {
            this.pendingByTag.delete(requestTag);
        }
    }

    isRequestTagCanceled(requestTag) {
        return Boolean(requestTag && this.canceledTags.includes(requestTag));
    }

    rememberCanceledTag(requestTag) {
        if (!requestTag) {
            return;
        }
        if (!this.canceledTags.includes(requestTag)) {
            this.canceledTags.push(requestTag);
            if (this.canceledTags.length > MAX_CANCELED_TAGS) {
                this.canceledTags = this.canceledTags.slice(-MAX_CANCELED_TAGS);
            }
        }
    }

    rejectPendingRequests(message) {
        const cancelError = createRequestCanceledError(message);
        Array.from(this.pending.keys()).forEach((id) => {
            this.finalizeRequest(id, 'reject', cancelError);
        });
    }

    releaseRequestClient(reason = 'ZEN_AB_TRIAL_WORKER_RELEASED') {
        const client = this.client;
        this.client = null;
        this.ready = false;
        this.initPromise = null;
        if (client) {
            client.disable(reason);
        }
    }

    handleQueueEvent(event = {}) {
        const mappedType = resolveQueueEventType(event?.type);
        if (!mappedType) {
            return;
        }
        const rawTask = event?.task && typeof event.task === 'object'
            ? event.task
            : null;
        const taskType = resolveSafeTaskType(
            rawTask?.taskType,
            WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL,
        );
        const priority = resolveSafePriority(
            rawTask?.priority,
            WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        );
        recordWorkerRuntimeEvent({
            type: mappedType,
            worker: ZEN_AB_TRIAL_RUNTIME_WORKER_ID,
            taskType,
            lane: WORKER_RUNTIME_LANE.COMPUTE,
            priority,
            context: WORKER_RUNTIME_CONTEXT.UI,
            message: resolveOptionalMessage(event?.message) || resolveOptionalMessage(event?.reason),
            details: {
                queueEventType: String(event?.type || 'unknown'),
                taskId: rawTask?.id || null,
                cancelKey: event?.cancelKey || rawTask?.cancelKey || null,
                errorCode: resolveOptionalMessage(event?.errorCode),
                count: Number.isFinite(Number(event?.count))
                    ? Math.max(0, Math.floor(Number(event.count)))
                    : 0,
            },
        });
    }

}
