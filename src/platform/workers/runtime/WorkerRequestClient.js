import {
    recordWorkerRuntimeEvent,
    WORKER_RUNTIME_EVENT_TYPE,
} from './WorkerTelemetry.js';
import { createAdmittedWorkerRuntimeSession } from './AdmittedWorkerRuntimeSession.js';
import {
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    resolveWorkerRuntimeContext,
    resolveWorkerRuntimeLane,
    resolveWorkerRuntimePriority,
} from './types.js';

const DEFAULT_INIT_TIMEOUT_MS = 3000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

const toNonEmptyString = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const toSafeNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const resolveEventLocation = (eventLike = null) => {
    if (!eventLike || typeof eventLike !== 'object') {
        return null;
    }
    const filename = toNonEmptyString(eventLike?.filename);
    const lineno = toSafeNumber(eventLike?.lineno);
    const colno = toSafeNumber(eventLike?.colno);
    if (!filename && lineno === null && colno === null) {
        return null;
    }

    if (filename) {
        let location = filename;
        if (lineno !== null) {
            location += `:${lineno}`;
            if (colno !== null) {
                location += `:${colno}`;
            }
        }
        return location;
    }

    if (lineno !== null && colno !== null) {
        return `line ${lineno}, col ${colno}`;
    }
    if (lineno !== null) {
        return `line ${lineno}`;
    }
    return `col ${colno}`;
};

const resolveErrorMessage = (error, fallback = 'WORKER_REQUEST_FAILED') => {
    const direct = toNonEmptyString(error);
    if (direct) {
        return direct;
    }

    if (error && typeof error === 'object') {
        const explicitMessage = toNonEmptyString(error?.message);
        if (explicitMessage) {
            return explicitMessage;
        }

        if (error?.error && error.error !== error) {
            const nested = resolveErrorMessage(error.error, '');
            if (toNonEmptyString(nested)) {
                return nested;
            }
        }

        const type = toNonEmptyString(error?.type);
        const location = resolveEventLocation(error);
        if (type && location) {
            return `${type} @ ${location}`;
        }
        if (type) {
            return type;
        }
        if (location) {
            return `WORKER_RUNTIME_ERROR @ ${location}`;
        }

        const asString = String(error);
        if (
            toNonEmptyString(asString)
            && asString !== '[object Event]'
            && asString !== '[object ErrorEvent]'
            && asString !== '[object Object]'
        ) {
            return asString;
        }
    }

    return fallback;
};
const cloneErrorDetails = (value) => (
    isPlainObject(value) ? { ...value } : null
);
const createStructuredWorkerRequestError = (
    error,
    {
        fallbackMessage = 'WORKER_REQUEST_FAILED',
    } = {},
) => {
    if (
        error instanceof Error
        && (
            (typeof error.code === 'string' && error.code.trim())
            || cloneErrorDetails(error?.details)
            || error?.cause
        )
    ) {
        return error;
    }

    const payload = isPlainObject(error)
        ? error
        : (isPlainObject(error?.error) ? error.error : null);
    const nextError = new Error(resolveErrorMessage(payload || error, fallbackMessage));
    const safeName = toNonEmptyString(payload?.name);
    if (safeName) {
        nextError.name = safeName;
    }
    const safeCode = toNonEmptyString(payload?.code);
    if (safeCode) {
        nextError.code = safeCode;
    }
    const safeDetails = cloneErrorDetails(payload?.details);
    if (safeDetails) {
        nextError.details = safeDetails;
    }
    if (payload?.cause) {
        nextError.cause = createStructuredWorkerRequestError(payload.cause, {
            fallbackMessage,
        });
    } else if (error instanceof Error) {
        nextError.cause = error;
    }
    return nextError;
};

const createWorkerUnavailableError = (reason = 'WORKER_UNAVAILABLE', details = {}) => {
    const normalizedReason = toNonEmptyString(reason) || 'WORKER_UNAVAILABLE';
    return createStructuredWorkerRequestError({
        code: 'WORKER_UNAVAILABLE',
        message: normalizedReason === 'WORKER_UNAVAILABLE'
            ? 'WORKER_UNAVAILABLE'
            : `WORKER_UNAVAILABLE:${normalizedReason}`,
        details: {
            reason: normalizedReason,
            ...details,
        },
    }, {
        fallbackMessage: 'WORKER_UNAVAILABLE',
    });
};

const toSafeTimeout = (value, fallback, minValue = 300) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.max(minValue, Math.floor(n));
};

const toSafeId = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    return Number(n);
};

const isPlainObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const normalizeTransferList = (value) => {
    if (!Array.isArray(value) || !value.length) {
        return [];
    }
    return value.filter((entry) => entry !== null && entry !== undefined);
};

const resolveTransferList = (resolver, meta = null) => {
    if (typeof resolver !== 'function') {
        return [];
    }
    try {
        return normalizeTransferList(resolver(meta || {}));
    } catch (error) {
        const wrapped = new Error(
            `WORKER_TRANSFER_RESOLVER_FAILED:${resolveErrorMessage(error, 'unknown')}`,
        );
        wrapped.cause = error;
        throw wrapped;
    }
};

const DEFAULT_RESPONSE_RESOLVER = ({ message = {} } = {}) => {
    const type = String(message?.type || '');
    if (type === 'ERROR') {
        return {
            ok: false,
            error: String(message?.error || 'WORKER_RESPONSE_ERROR'),
        };
    }
    if (Object.prototype.hasOwnProperty.call(message, 'results')) {
        return {
            ok: true,
            result: message.results,
        };
    }
    if (Object.prototype.hasOwnProperty.call(message, 'result')) {
        return {
            ok: true,
            result: message.result,
        };
    }
    return {
        ok: true,
        result: message,
    };
};

export class WorkerRequestClient {
    constructor(options = {}) {
        this.workerId = typeof options?.workerId === 'string' && options.workerId.trim()
            ? options.workerId.trim()
            : 'worker';
        this.surfaceId = toNonEmptyString(options?.surfaceId);
        this.surfaceStatus = toNonEmptyString(options?.surfaceStatus);
        this.surfaceKind = toNonEmptyString(options?.surfaceKind);
        this.degradationMode = toNonEmptyString(options?.degradationMode);
        this.activationFlagName = toNonEmptyString(options?.activationFlagName);
        this.context = resolveWorkerRuntimeContext(
            options?.context ?? WORKER_RUNTIME_CONTEXT.UI,
        );
        this.lane = resolveWorkerRuntimeLane(
            options?.lane ?? WORKER_RUNTIME_LANE.COMPUTE,
        );
        this.defaultPriority = resolveWorkerRuntimePriority(
            options?.priority ?? WORKER_RUNTIME_PRIORITY.BACKGROUND,
        );
        this.defaultTaskType = typeof options?.taskType === 'string' && options.taskType.trim()
            ? options.taskType.trim()
            : this.workerId;
        this.workerFactory = typeof options?.workerFactory === 'function'
            ? options.workerFactory
            : null;
        this.workerDisposer = typeof options?.workerDisposer === 'function'
            ? options.workerDisposer
            : null;
        this.admissionRequired = options?.admissionRequired === true;
        this.releaseAdmissionOnIdle = options?.releaseAdmissionOnIdle === true;
        this.admissionController = options?.admissionController;
        this.admissionMetadata = isPlainObject(options?.admissionMetadata)
            ? { ...options.admissionMetadata }
            : null;
        this.initMessage = isPlainObject(options?.initMessage) ? { ...options.initMessage } : null;
        this.initReadyTypes = Array.isArray(options?.initReadyTypes)
            ? options.initReadyTypes
                .filter((entry) => typeof entry === 'string' && entry.trim())
                .map((entry) => entry.trim())
            : ['READY'];
        this.initTimeoutMs = toSafeTimeout(
            options?.initTimeoutMs,
            DEFAULT_INIT_TIMEOUT_MS,
            400,
        );
        this.requestTimeoutMs = toSafeTimeout(
            options?.requestTimeoutMs,
            DEFAULT_REQUEST_TIMEOUT_MS,
            600,
        );
        this.responseResolver = typeof options?.responseResolver === 'function'
            ? options.responseResolver
            : DEFAULT_RESPONSE_RESOLVER;
        this.initTransferResolver = typeof options?.initTransferResolver === 'function'
            ? options.initTransferResolver
            : null;
        this.requestTransferResolver = typeof options?.requestTransferResolver === 'function'
            ? options.requestTransferResolver
            : null;
        this.onMessage = typeof options?.onMessage === 'function'
            ? options.onMessage
            : null;
        if (options.onLifecycleEvent !== undefined && typeof options.onLifecycleEvent !== 'function') {
            throw new Error('WORKER_LIFECYCLE_OBSERVER_INVALID');
        }
        this.onLifecycleEvent = options.onLifecycleEvent;
        this.worker = null;
        this.workerSession = null;
        this.workerReady = false;
        this.initPromise = null;
        this.resolveInit = null;
        this.initTimer = null;
        this.idleReleaseTimer = null;
        this.pending = new Map();
        this.requestId = 0;
        this.lastDisableReason = null;
    }

    createWorkerInstance() {
        if (!this.admissionRequired) {
            return this.workerFactory();
        }

        let workerSession = null;
        workerSession = createAdmittedWorkerRuntimeSession({
            surfaceId: this.surfaceId,
            createWorker: this.workerFactory,
            admissionController: this.admissionController,
            admissionMetadata: this.admissionMetadata || this.createRuntimeDetails({
                workerId: this.workerId,
                taskType: this.defaultTaskType,
                lane: this.lane,
                context: this.context,
            }),
            onRevoked: (details = {}) => {
                this.handleAdmissionRevoked(workerSession, details);
            },
        });
        this.workerSession = workerSession;
        return workerSession.worker;
    }

    createRuntimeDetails(details = {}) {
        const nextDetails = isPlainObject(details) ? { ...details } : {};
        if (this.surfaceId) {
            nextDetails.surfaceId = this.surfaceId;
        }
        if (this.surfaceStatus) {
            nextDetails.surfaceStatus = this.surfaceStatus;
        }
        if (this.surfaceKind) {
            nextDetails.surfaceKind = this.surfaceKind;
        }
        if (this.degradationMode) {
            nextDetails.degradationMode = this.degradationMode;
        }
        if (this.activationFlagName) {
            nextDetails.activationFlagName = this.activationFlagName;
        }
        return nextDetails;
    }

    isReady() {
        return Boolean(this.worker && this.workerReady);
    }

    // This opt-in observer owns no scheduling or lifetime decisions. Callers
    // receive local monotonic times; they must not mix clocks across realms.
    emitLifecycleEvent(stage, details = {}) {
        if (!this.onLifecycleEvent) return;
        this.onLifecycleEvent({
            stage,
            atMs: performance.now(),
            timeOriginMs: performance.timeOrigin,
            workerId: this.workerId,
            ...details,
        });
    }

    async init() {
        if (typeof Worker === 'undefined') {
            return this.markInitUnavailable('WORKER_API_UNAVAILABLE', {
                hasWorkerApi: false,
            });
        }
        if (!this.workerFactory) {
            return this.markInitUnavailable('WORKER_FACTORY_UNAVAILABLE', {
                hasWorkerFactory: false,
            });
        }
        if (this.worker && this.workerReady) {
            return true;
        }
        if (this.initPromise) {
            return this.initPromise;
        }

        this.lastDisableReason = null;
        let resolveInitPromise = null;
        const initPromise = new Promise((resolve) => {
            resolveInitPromise = resolve;
        });
        this.initPromise = initPromise;
        this.resolveInit = resolveInitPromise;

        let initStage = 'worker_factory';
        try {
            this.emitLifecycleEvent('init_start');
            this.worker = this.createWorkerInstance();
            this.worker.onmessage = (event) => this.handleMessage(event);
            this.worker.onerror = (event) => this.handleWorkerError(event);
            this.emitLifecycleEvent('worker_created');
            this.initTimer = setTimeout(() => {
                this.recordInitFailure('WORKER_INIT_TIMEOUT', {
                    timeoutMs: this.initTimeoutMs,
                });
                this.resolveInitIfNeeded(false);
                this.disable('WORKER_INIT_TIMEOUT');
            }, this.initTimeoutMs);
            if (this.initMessage) {
                const initMessage = { ...this.initMessage };
                initStage = 'init_transfer';
                const transfer = resolveTransferList(this.initTransferResolver, {
                    workerId: this.workerId,
                    message: initMessage,
                    context: this.context,
                });
                initStage = 'init_post_message';
                this.emitLifecycleEvent('init_post_start');
                if (transfer.length > 0) {
                    this.worker.postMessage(initMessage, transfer);
                } else {
                    this.worker.postMessage(initMessage);
                }
                this.emitLifecycleEvent('init_post_end');
            }
        } catch (error) {
            const reason = resolveErrorMessage(error, 'WORKER_INIT_FAILED');
            this.recordInitFailure(reason, {
                stage: typeof error?.code === 'string'
                    && error.code.startsWith('WORKER_RUNTIME_ADMISSION_')
                    ? 'worker_admission'
                    : initStage,
            });
            this.resolveInitIfNeeded(false);
            this.disable(reason);
        }

        return initPromise;
    }

    async request(type, payload = {}, options = {}) {
        this.cancelIdleAdmissionRelease();
        let ready;
        try {
            this.emitLifecycleEvent('request_start', { requestType: type, requestOptions: options, messageId: null });
            ready = await this.init();
        } catch (error) {
            this.disable(error);
            throw error;
        }
        this.cancelIdleAdmissionRelease();
        if (!ready || !this.worker || !this.workerReady) {
            throw createWorkerUnavailableError(this.lastDisableReason, this.createRuntimeDetails({
                ready: Boolean(ready),
                hasWorker: Boolean(this.worker),
                workerReady: Boolean(this.workerReady),
            }));
        }
        try {
            this.emitLifecycleEvent('request_initialized', { requestType: type, requestOptions: options, messageId: null });
        } catch (error) {
            this.disable(error);
            throw error;
        }
        const requestType = typeof type === 'string' && type.trim()
            ? type.trim()
            : 'UNKNOWN';
        const id = ++this.requestId;
        const minTimeoutMs = Number.isFinite(Number(options?.minTimeoutMs))
            && Number(options.minTimeoutMs) > 0
            ? Math.max(1, Math.floor(Number(options.minTimeoutMs)))
            : 600;
        const timeoutMs = toSafeTimeout(
            options?.timeoutMs,
            this.requestTimeoutMs,
            minTimeoutMs,
        );
        const priority = resolveWorkerRuntimePriority(
            options?.priority ?? this.defaultPriority,
        );
        const taskType = typeof options?.taskType === 'string' && options.taskType.trim()
            ? options.taskType.trim()
            : this.defaultTaskType;
        const startedAt = Date.now();
        const requestPayload = isPlainObject(payload) ? payload : {};

        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.START,
            worker: this.workerId,
            taskType,
            lane: this.lane,
            priority,
            context: this.context,
            details: this.createRuntimeDetails({
                requestType,
                timeoutMs,
            }),
        });

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (!this.pending.has(id)) {
                    return;
                }
                this.pending.delete(id);
                recordWorkerRuntimeEvent({
                    type: WORKER_RUNTIME_EVENT_TYPE.TIMEOUT,
                    worker: this.workerId,
                    taskType,
                    lane: this.lane,
                    priority,
                    context: this.context,
                    details: this.createRuntimeDetails({
                        requestType,
                        elapsedMs: Date.now() - startedAt,
                    }),
                });
                const timeoutError = new Error('WORKER_REQUEST_TIMEOUT');
                reject(timeoutError);
                if (this.admissionRequired) {
                    this.disable(timeoutError);
                }
            }, timeoutMs);

            this.pending.set(id, {
                id,
                resolve,
                reject,
                timeoutId,
                requestType,
                taskType,
                priority,
                startedAt,
                requestOptions: options,
            });

            try {
                const message = {
                    type: requestType,
                    id,
                    payload: requestPayload,
                };
                const transfer = resolveTransferList(this.requestTransferResolver, {
                    workerId: this.workerId,
                    id,
                    type: requestType,
                    payload: requestPayload,
                    taskType,
                    priority,
                    context: this.context,
                    requestOptions: options,
                });
                this.emitLifecycleEvent('request_post_start', { requestType, requestOptions: options, messageId: id });
                if (transfer.length > 0) {
                    this.worker.postMessage(message, transfer);
                } else {
                    this.worker.postMessage(message);
                }
                this.emitLifecycleEvent('request_post_end', { requestType, requestOptions: options, messageId: id });
            } catch (error) {
                clearTimeout(timeoutId);
                this.pending.delete(id);
                const structuredError = createStructuredWorkerRequestError(error, {
                    fallbackMessage: 'WORKER_REQUEST_FAILED',
                });
                recordWorkerRuntimeEvent({
                    type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
                    worker: this.workerId,
                    taskType,
                    lane: this.lane,
                    priority,
                    context: this.context,
                    message: structuredError.message,
                    details: this.createRuntimeDetails({
                        requestType,
                        errorCode: typeof structuredError.code === 'string'
                            ? structuredError.code
                            : null,
                    }),
                });
                reject(structuredError);
                this.scheduleIdleAdmissionRelease();
            }
        });
    }

    disable(reason = 'WORKER_DISABLED') {
        this.lastDisableReason = resolveErrorMessage(reason, 'WORKER_DISABLED');
        this.cancelIdleAdmissionRelease();
        this.resolveInitIfNeeded(false);
        this.rejectPendingRequests(reason);
        const workerSession = this.workerSession;
        const worker = this.worker;
        if (workerSession) {
            this.workerSession = null;
            this.worker = null;
            try {
                workerSession.terminate({
                    reason: this.lastDisableReason,
                });
            } catch (error) {
                this.recordTerminationFailure(error, this.lastDisableReason);
            }
        } else if (worker) {
            try {
                if (this.workerDisposer) {
                    this.workerDisposer(worker, {
                        reason,
                        workerId: this.workerId,
                        context: this.context,
                    });
                } else {
                    worker.terminate();
                }
            } catch (error) {
                this.recordTerminationFailure(error, reason);
            }
        }
        this.workerSession = null;
        this.worker = null;
        this.workerReady = false;
        this.initPromise = null;
        // Observer failure must be visible without preventing exact resource
        // release. This is diagnostics only, never a runtime recovery path.
        try {
            this.emitLifecycleEvent('disabled', { reason: this.lastDisableReason });
        } catch (error) {
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
                worker: this.workerId,
                taskType: this.defaultTaskType,
                lane: this.lane,
                priority: this.defaultPriority,
                context: this.context,
                message: resolveErrorMessage(error, 'WORKER_LIFECYCLE_OBSERVER_FAILED'),
                details: this.createRuntimeDetails({ stage: 'lifecycleObserver', phase: 'disabled' }),
            });
        }
    }

    recordTerminationFailure(error, reason) {
        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
            worker: this.workerId,
            taskType: this.defaultTaskType,
            lane: this.lane,
            priority: this.defaultPriority,
            context: this.context,
            message: resolveErrorMessage(error, 'WORKER_TERMINATE_FAILED'),
            details: this.createRuntimeDetails({ reason }),
        });
    }

    cancelIdleAdmissionRelease() {
        if (this.idleReleaseTimer === null) {
            return;
        }
        clearTimeout(this.idleReleaseTimer);
        this.idleReleaseTimer = null;
    }

    scheduleIdleAdmissionRelease() {
        if (
            !this.admissionRequired
            || !this.releaseAdmissionOnIdle
            || this.pending.size > 0
            || !this.workerSession?.isActive?.()
        ) {
            return;
        }
        this.cancelIdleAdmissionRelease();
        const scheduledSession = this.workerSession;
        this.idleReleaseTimer = setTimeout(() => {
            this.idleReleaseTimer = null;
            if (
                this.pending.size > 0
                || this.workerSession !== scheduledSession
                || !scheduledSession.isActive()
            ) {
                return;
            }
            this.releaseIdleWorkerSession(scheduledSession);
        }, 0);
    }

    releaseIdleWorkerSession(workerSession) {
        if (!workerSession || this.workerSession !== workerSession || this.pending.size > 0) {
            return false;
        }
        this.workerSession = null;
        this.worker = null;
        this.workerReady = false;
        this.initPromise = null;
        try {
            return workerSession.terminate({
                reason: 'worker_request_client_idle',
            });
        } catch (error) {
            this.recordTerminationFailure(error, 'worker_request_client_idle');
            return false;
        }
    }

    handleAdmissionRevoked(workerSession, details = {}) {
        if (!workerSession || this.workerSession !== workerSession) {
            return;
        }
        const admissionReason = toNonEmptyString(details?.reason) || 'unknown';
        const reason = `WORKER_RUNTIME_ADMISSION_REVOKED:${admissionReason}`;
        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
            worker: this.workerId,
            taskType: this.defaultTaskType,
            lane: this.lane,
            priority: this.defaultPriority,
            context: this.context,
            message: reason,
            details: this.createRuntimeDetails({
                ...(isPlainObject(details) ? details : {}),
                stage: 'admission_revoked',
                admissionReason,
            }),
        });
        this.lastDisableReason = reason;
        this.cancelIdleAdmissionRelease();
        this.resolveInitIfNeeded(false);
        this.rejectPendingRequests(reason);
        this.workerSession = null;
        this.worker = null;
        this.workerReady = false;
        this.initPromise = null;
    }

    markInitUnavailable(reason, details = {}) {
        const normalizedReason = toNonEmptyString(reason) || 'WORKER_UNAVAILABLE';
        this.lastDisableReason = normalizedReason;
        this.recordInitFailure(normalizedReason, details);
        return false;
    }

    recordInitFailure(reason, details = {}) {
        const normalizedReason = toNonEmptyString(reason) || 'WORKER_INIT_FAILED';
        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
            worker: this.workerId,
            taskType: this.defaultTaskType,
            lane: this.lane,
            priority: this.defaultPriority,
            context: this.context,
            message: normalizedReason,
            details: this.createRuntimeDetails({
                stage: 'init',
                ...details,
            }),
        });
    }

    handleMessage(event) {
        const message = event?.data && typeof event.data === 'object'
            ? event.data
            : {};
        const type = typeof message?.type === 'string' ? message.type : '';
        if (this.onMessage || this.onLifecycleEvent) {
            try {
                if (this.initReadyTypes.includes(type)) {
                    this.emitLifecycleEvent('init_ready_received', { message });
                } else {
                    const lifecycleId = toSafeId(message.id);
                    const lifecyclePending = lifecycleId === null ? null : this.pending.get(lifecycleId);
                    if (lifecyclePending && (type === 'RESULT' || type === 'ERROR')) {
                        this.emitLifecycleEvent('response_received', {
                            messageId: lifecycleId,
                            requestType: lifecyclePending.requestType,
                            requestOptions: lifecyclePending.requestOptions,
                            responseType: type,
                        });
                    }
                }
                this.onMessage?.({
                    message,
                    type,
                    event,
                    workerId: this.workerId,
                    context: this.context,
                });
            } catch (error) {
                const observerError = resolveErrorMessage(
                    error,
                    'WORKER_ONMESSAGE_OBSERVER_FAILED',
                );
                recordWorkerRuntimeEvent({
                    type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
                    worker: this.workerId,
                    taskType: this.defaultTaskType,
                    lane: this.lane,
                    priority: this.defaultPriority,
                    context: this.context,
                    message: observerError,
                    details: this.createRuntimeDetails({
                        stage: 'onMessage',
                        messageType: type,
                    }),
                });
                this.disable(observerError);
                return;
            }
        }

        if (this.initReadyTypes.includes(type)) {
            this.workerReady = true;
            this.resolveInitIfNeeded(true);
            this.scheduleIdleAdmissionRelease();
            return;
        }

        const id = toSafeId(message?.id);
        if (id === null) {
            return;
        }
        const pending = this.pending.get(id);
        if (!pending) {
            return;
        }
        let resolved;
        try {
            resolved = this.responseResolver({
                message,
                id,
                requestType: pending.requestType,
                taskType: pending.taskType,
                priority: pending.priority,
                requestOptions: pending.requestOptions,
            });
            if (resolved?.pending !== true) {
                this.emitLifecycleEvent('response_resolved', {
                    messageId: id,
                    requestType: pending.requestType,
                    requestOptions: pending.requestOptions,
                    responseType: type,
                });
            }
        } catch (error) {
            clearTimeout(pending.timeoutId);
            this.pending.delete(id);
            const elapsedMs = Date.now() - pending.startedAt;
            const structuredError = createStructuredWorkerRequestError(error, {
                fallbackMessage: 'WORKER_RESPONSE_RESOLVER_FAILED',
            });
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
                worker: this.workerId,
                taskType: pending.taskType,
                lane: this.lane,
                priority: pending.priority,
                context: this.context,
                message: structuredError.message,
                details: this.createRuntimeDetails({
                    requestType: pending.requestType,
                    elapsedMs,
                    errorCode: typeof structuredError.code === 'string'
                        ? structuredError.code
                        : null,
                }),
            });
            pending.reject(structuredError);
            this.scheduleIdleAdmissionRelease();
            return;
        }

        // Allow intermediate frames (e.g. progress events) without settling request.
        if (resolved?.pending === true) {
            return;
        }

        clearTimeout(pending.timeoutId);
        this.pending.delete(id);

        const elapsedMs = Date.now() - pending.startedAt;

        if (resolved?.ok === false) {
            const structuredError = createStructuredWorkerRequestError(resolved?.error, {
                fallbackMessage: 'WORKER_RESPONSE_ERROR',
            });
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
                worker: this.workerId,
                taskType: pending.taskType,
                lane: this.lane,
                priority: pending.priority,
                context: this.context,
                message: structuredError.message,
                details: this.createRuntimeDetails({
                    requestType: pending.requestType,
                    elapsedMs,
                    errorCode: typeof structuredError.code === 'string'
                        ? structuredError.code
                        : null,
                }),
            });
            pending.reject(structuredError);
            this.scheduleIdleAdmissionRelease();
            return;
        }

        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.SUCCESS,
            worker: this.workerId,
            taskType: pending.taskType,
            lane: this.lane,
            priority: pending.priority,
            context: this.context,
            details: this.createRuntimeDetails({
                requestType: pending.requestType,
                elapsedMs,
            }),
        });
        pending.resolve(resolved?.result);
        this.scheduleIdleAdmissionRelease();
    }

    handleWorkerError(event) {
        const message = resolveErrorMessage(
            event?.message || event,
            'WORKER_RUNTIME_ERROR',
        );
        recordWorkerRuntimeEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
            worker: this.workerId,
            taskType: this.defaultTaskType,
            lane: this.lane,
            priority: this.defaultPriority,
            context: this.context,
            message,
            details: this.createRuntimeDetails({
                stage: 'runtime_error',
            }),
        });
        this.disable(message);
    }

    resolveInitIfNeeded(value) {
        if (this.initTimer) {
            clearTimeout(this.initTimer);
            this.initTimer = null;
        }
        if (this.resolveInit) {
            this.resolveInit(Boolean(value));
            this.resolveInit = null;
        }
        if (!value) {
            this.initPromise = null;
        }
    }

    rejectPendingRequests(message) {
        const canceledError = createStructuredWorkerRequestError(message, {
            fallbackMessage: 'WORKER_REQUEST_CANCELED',
        });
        const canceledMessage = canceledError.message;
        const nowTs = Date.now();
        this.pending.forEach((pending) => {
            clearTimeout(pending.timeoutId);
            const elapsedMs = nowTs - Number(pending?.startedAt || nowTs);
            recordWorkerRuntimeEvent({
                type: WORKER_RUNTIME_EVENT_TYPE.CANCELED,
                worker: this.workerId,
                taskType: pending?.taskType || this.defaultTaskType,
                lane: this.lane,
                priority: pending?.priority || this.defaultPriority,
                context: this.context,
                message: canceledMessage,
                details: this.createRuntimeDetails({
                    requestType: pending?.requestType || null,
                    elapsedMs,
                }),
            });
            pending.reject(canceledError);
        });
        this.pending.clear();
    }
}
