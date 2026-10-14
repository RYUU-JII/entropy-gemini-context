import WorkerRuntimeEventRepository, {
    WORKER_RUNTIME_EVENT_STORAGE_KEY,
} from '../../storage/runtime/WorkerRuntimeEventRepository.js';

const DEFAULT_STORAGE_KEY = WORKER_RUNTIME_EVENT_STORAGE_KEY;
const DEFAULT_MAX_EVENTS = 200;
const DEFAULT_PERSIST_DEBOUNCE_MS = 5000;
const MEMORY_STORE_KEY = '__worker_runtime_events__';

export { WORKER_RUNTIME_EVENT_STORAGE_KEY };

export const WORKER_RUNTIME_EVENT_TYPE = Object.freeze({
    START: 'worker_start',
    SUCCESS: 'worker_success',
    FAIL: 'worker_fail',
    TIMEOUT: 'worker_timeout',
    FALLBACK_USED: 'fallback_used',
    CIRCUIT_OPEN: 'circuit_open',
    RECOVER: 'recover',
    CANCELED: 'request_canceled',
    QUEUE_DROPPED: 'queue_dropped',
    QUEUE_CLEARED: 'queue_cleared',
});

const PERSISTED_RUNTIME_EVENT_TYPES = new Set([
    WORKER_RUNTIME_EVENT_TYPE.FAIL,
    WORKER_RUNTIME_EVENT_TYPE.TIMEOUT,
    WORKER_RUNTIME_EVENT_TYPE.FALLBACK_USED,
    WORKER_RUNTIME_EVENT_TYPE.CIRCUIT_OPEN,
    WORKER_RUNTIME_EVENT_TYPE.RECOVER,
    WORKER_RUNTIME_EVENT_TYPE.CANCELED,
    WORKER_RUNTIME_EVENT_TYPE.QUEUE_DROPPED,
    WORKER_RUNTIME_EVENT_TYPE.QUEUE_CLEARED,
]);

const now = () => Date.now();

const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);

const safeObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {}
);

const resolveMaxEvents = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return DEFAULT_MAX_EVENTS;
    }
    return Math.max(20, Math.floor(n));
};

const createEventId = (timestamp = now()) => (
    `${timestamp}_${Math.floor(Math.random() * 100000)}`
);

const resolveErrorMessage = (error, fallback = 'WORKER_TELEMETRY_PERSIST_FAILED') => {
    const direct = safeString(error, null);
    if (direct) {
        return direct;
    }
    const message = safeString(error?.message, null);
    if (message) {
        return message;
    }
    const code = safeString(error?.code, null);
    if (code) {
        return code;
    }
    return fallback;
};

const createRuntimeEvent = ({
    type = WORKER_RUNTIME_EVENT_TYPE.START,
    worker = 'unknown',
    taskType = 'unknown',
    lane = 'compute',
    priority = 'background',
    context = 'unknown',
    message = null,
    details = null,
    timestamp = now(),
} = {}) => {
    const ts = Number.isFinite(Number(timestamp)) ? Number(timestamp) : now();
    return {
        id: createEventId(ts),
        type: safeString(type, WORKER_RUNTIME_EVENT_TYPE.START),
        worker: safeString(worker, 'unknown'),
        taskType: safeString(taskType, 'unknown'),
        lane: safeString(lane, 'compute'),
        priority: safeString(priority, 'background'),
        context: safeString(context, 'unknown'),
        message: safeString(message, null),
        details: { ...safeObject(details) },
        timestamp: ts,
    };
};

const warnTelemetry = (message, error = null) => {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') {
        return;
    }
    if (error) {
        console.warn(`[WorkerTelemetry] ${message}`, error);
        return;
    }
    console.warn(`[WorkerTelemetry] ${message}`);
};

const readMemoryEvents = (maxEvents = DEFAULT_MAX_EVENTS) => {
    const memory = globalThis?.[MEMORY_STORE_KEY];
    return Array.isArray(memory)
        ? memory.slice(-maxEvents)
        : [];
};

const writeMemoryEvents = (events = []) => {
    const normalized = Array.isArray(events)
        ? events
        : [];
    globalThis[MEMORY_STORE_KEY] = normalized;
    return normalized;
};

const syncPersistedEvents = (persistedEventStore, events = [], {
    onFailure = null,
    onSuccess = null,
    storageKey = DEFAULT_STORAGE_KEY,
    admission,
} = {}) => {
    if (!persistedEventStore || typeof persistedEventStore !== 'object') {
        return Promise.resolve(null);
    }

    const operation = Array.isArray(events) && events.length > 0 ? 'set' : 'clear';
    return Promise.resolve().then(() => (
        Array.isArray(events) && events.length > 0
            ? persistedEventStore.set(events, { admission })
            : persistedEventStore.clear({ admission })
    )).then((result) => {
        if (typeof onSuccess === 'function') {
            onSuccess({
                operation,
                storageKey,
                eventCount: Array.isArray(events) ? events.length : 0,
            });
        }
        return result;
    }).catch((error) => {
        if (typeof onFailure === 'function') {
            onFailure(error, {
                operation,
                storageKey,
                eventCount: Array.isArray(events) ? events.length : 0,
            });
        }
        warnTelemetry('Failed to mirror runtime telemetry into the worker runtime event repository.', error);
        return null;
    });
};

const shouldPersistRuntimeEvent = (event = null) => (
    event
    && typeof event === 'object'
    && PERSISTED_RUNTIME_EVENT_TYPES.has(event.type)
);

const filterPersistableEvents = (events = []) => (
    (Array.isArray(events) ? events : [])
        .filter((entry) => entry && typeof entry === 'object')
        .filter((entry) => entry?.details?.memoryOnly !== true)
);

const scheduleDeferredSync = (callback, delayMs = DEFAULT_PERSIST_DEBOUNCE_MS) => {
    const delay = Math.max(250, Math.floor(Number(delayMs) || DEFAULT_PERSIST_DEBOUNCE_MS));
    const timerId = setTimeout(callback, delay);
    if (timerId && typeof timerId.unref === 'function') {
        timerId.unref();
    }
    return timerId;
};

export const createWorkerRuntimeTelemetryStore = ({
    storageKey = DEFAULT_STORAGE_KEY,
    maxEvents = DEFAULT_MAX_EVENTS,
    persistDebounceMs = DEFAULT_PERSIST_DEBOUNCE_MS,
    workerRuntimeEventRepository = null,
} = {}) => {
    const resolvedStorageKey = safeString(storageKey, DEFAULT_STORAGE_KEY);
    const resolvedMaxEvents = resolveMaxEvents(maxEvents);
    const resolvedPersistDebounceMs = Math.max(
        250,
        Math.floor(Number(persistDebounceMs) || DEFAULT_PERSIST_DEBOUNCE_MS),
    );
    const persistedEventStore = workerRuntimeEventRepository || new WorkerRuntimeEventRepository({
        storageKey: resolvedStorageKey,
        maxEvents: resolvedMaxEvents,
    });
    if (typeof persistedEventStore.captureWriteAdmission !== 'function') {
        throw new Error('WORKER_RUNTIME_EVENTS_ADMISSION_CAPTURE_REQUIRED');
    }
    let persistenceStatus = {
        ok: true,
        pending: false,
        storageKey: resolvedStorageKey,
        operation: null,
        eventCount: 0,
        lastError: null,
        lastFailureAt: 0,
        lastSuccessAt: 0,
    };
    let pendingPersistedEvents = null;
    let pendingPersistTimerId = null;
    let persistenceAdmission = null;
    let persistenceAdmissionOpen = true;
    let persistenceTail = Promise.resolve();

    const capturePersistenceAdmission = () => {
        if (!persistenceAdmission) {
            try {
                persistenceAdmission = Promise.resolve(persistedEventStore.captureWriteAdmission());
            } catch (error) {
                persistenceAdmission = Promise.reject(error);
            }
            void persistenceAdmission.catch(() => undefined);
        }
        return persistenceAdmission;
    };

    const readEvents = () => readMemoryEvents(resolvedMaxEvents);

    const readPersistenceStatus = () => ({ ...persistenceStatus });

    const appendMemoryOnlyEvent = (eventInput = {}) => {
        const current = readEvents();
        const next = [...current, createRuntimeEvent(eventInput)]
            .filter((entry) => entry && typeof entry === 'object')
            .slice(-resolvedMaxEvents);
        return writeMemoryEvents(next);
    };

    const markPersistenceSuccess = ({
        operation = null,
        eventCount = 0,
    } = {}) => {
        persistenceStatus = {
            ...persistenceStatus,
            ok: true,
            pending: false,
            operation,
            eventCount,
            lastError: null,
            lastSuccessAt: now(),
        };
    };

    const markPersistenceFailure = (error, {
        operation = null,
        eventCount = 0,
    } = {}) => {
        const failureAt = now();
        const message = resolveErrorMessage(error);
        persistenceStatus = {
            ...persistenceStatus,
            ok: false,
            pending: false,
            operation,
            eventCount,
            lastError: message,
            lastFailureAt: failureAt,
        };
        appendMemoryOnlyEvent({
            type: WORKER_RUNTIME_EVENT_TYPE.FAIL,
            worker: 'worker_runtime_telemetry',
            taskType: 'persist_worker_runtime_events',
            lane: 'compute',
            priority: 'background',
            context: 'platform',
            message,
            details: {
                stage: 'persist',
                storageKey: resolvedStorageKey,
                operation,
                eventCount,
                memoryOnly: true,
            },
            timestamp: failureAt,
        });
    };

    const flushPersistedEvents = () => {
        if (!persistenceAdmissionOpen) return Promise.resolve(null);
        const events = Array.isArray(pendingPersistedEvents)
            ? pendingPersistedEvents
            : readEvents();
        const persistableEvents = filterPersistableEvents(events);
        pendingPersistedEvents = null;
        if (pendingPersistTimerId !== null) {
            clearTimeout(pendingPersistTimerId);
        }
        pendingPersistTimerId = null;
        persistenceStatus = {
            ...persistenceStatus,
            pending: true,
            operation: persistableEvents.length > 0 ? 'set' : 'clear',
            eventCount: persistableEvents.length,
        };
        const admission = capturePersistenceAdmission();
        const pending = persistenceTail.then(() => syncPersistedEvents(persistedEventStore, persistableEvents, {
            storageKey: resolvedStorageKey, admission,
            onSuccess: markPersistenceSuccess, onFailure: markPersistenceFailure,
        }));
        persistenceTail = pending.then(() => undefined, () => undefined);
        return pending;
    };

    const schedulePersistedEvents = (events = []) => {
        pendingPersistedEvents = Array.isArray(events) ? events : [];
        if (pendingPersistTimerId !== null) return;
        pendingPersistTimerId = scheduleDeferredSync(
            flushPersistedEvents,
            resolvedPersistDebounceMs,
        );
    };

    const persistEvents = (events = []) => {
        const normalized = (Array.isArray(events) ? events : [])
            .filter((entry) => entry && typeof entry === 'object')
            .slice(-resolvedMaxEvents);
        writeMemoryEvents(normalized);
        if (!persistenceAdmissionOpen) return normalized;
        capturePersistenceAdmission();
        const latestEvent = normalized.length > 0 ? normalized[normalized.length - 1] : null;
        if (!normalized.length || shouldPersistRuntimeEvent(latestEvent)) {
            schedulePersistedEvents(normalized);
        }
        return normalized;
    };

    const recordEvent = ({
        type,
        worker,
        taskType,
        lane,
        priority,
        context,
        message,
        details,
        timestamp,
    } = {}) => {
        const event = createRuntimeEvent({
            type,
            worker,
            taskType,
            lane,
            priority,
            context,
            message,
            details,
            timestamp,
        });
        const current = readEvents();
        return persistEvents([...current, event]);
    };

    const clearEvents = () => (
        persistEvents([])
    );

    const clearPersistedEvents = () => {
        if (!persistenceAdmissionOpen) {
            return Promise.reject(new Error('WORKER_RUNTIME_EVENTS_WRITE_ADMISSION_CLOSED'));
        }
        if (pendingPersistTimerId !== null) clearTimeout(pendingPersistTimerId);
        pendingPersistTimerId = null;
        pendingPersistedEvents = null;
        const admission = capturePersistenceAdmission();
        const pending = persistenceTail.then(() => persistedEventStore.clear({ admission }));
        persistenceTail = pending.then(() => undefined, () => undefined);
        return pending;
    };

    const quiesceForProfileMutation = async () => {
        persistenceAdmissionOpen = false;
        if (pendingPersistTimerId !== null) clearTimeout(pendingPersistTimerId);
        pendingPersistTimerId = null;
        pendingPersistedEvents = null;
        await persistenceTail;
        if (persistenceAdmission) await Promise.allSettled([persistenceAdmission]);
        persistenceStatus = { ...persistenceStatus, pending: false };
        return Object.freeze({ quiesced: true });
    };

    return {
        storageKey: resolvedStorageKey,
        maxEvents: resolvedMaxEvents,
        readPersistedEvents: () => persistedEventStore.get(),
        flushPersistedEvents,
        readPersistenceStatus,
        readEvents,
        persistEvents,
        recordEvent,
        clearPersistedEvents,
        clearEvents,
        quiesceForProfileMutation,
    };
};

const defaultStore = createWorkerRuntimeTelemetryStore();

export const readPersistedWorkerRuntimeEvents = async () => defaultStore.readPersistedEvents();
export const readWorkerRuntimePersistenceStatus = () => defaultStore.readPersistenceStatus();
export const readWorkerRuntimeEvents = () => defaultStore.readEvents();
export const persistWorkerRuntimeEvents = (events = []) => defaultStore.persistEvents(events);
export const recordWorkerRuntimeEvent = (event = {}) => defaultStore.recordEvent(event);
export const clearPersistedWorkerRuntimeEvents = async () => defaultStore.clearPersistedEvents();
export const clearWorkerRuntimeEvents = () => defaultStore.clearEvents();
export const quiesceWorkerRuntimeTelemetryForProfileMutation = () => defaultStore.quiesceForProfileMutation();
