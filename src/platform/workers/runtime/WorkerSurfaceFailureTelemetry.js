import {
    WORKER_RUNTIME_EVENT_TYPE,
    recordWorkerRuntimeEvent,
} from './WorkerTelemetry.js';
import {
    createWorkerRuntimeEventBase,
    requireWorkerRuntimeSurface,
} from './WorkerRuntimeRegistry.js';

const isObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
);

const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);

export const resolveWorkerRuntimeFailureReason = (
    error,
    fallback = 'worker_runtime_error',
) => {
    const direct = safeString(error, null);
    if (direct) return direct;
    const message = safeString(error?.message, null);
    if (message) return message;
    const code = safeString(error?.code, null);
    if (code) return code;
    const type = safeString(error?.type, null);
    const filename = safeString(error?.filename, null);
    if (type && filename) {
        const line = Number.isFinite(Number(error?.lineno))
            ? `:${Number(error.lineno)}`
            : '';
        const column = Number.isFinite(Number(error?.colno))
            ? `:${Number(error.colno)}`
            : '';
        return `${type}:${filename}${line}${column}`;
    }
    if (type) return type;
    return fallback;
};

export const attachWorkerRuntimeSurfaceFailureDetails = (
    error,
    details,
    propertyName = 'workerRuntimeSurfaceFailureDetails',
) => {
    if (isObject(error) && Object.isExtensible(error) && safeString(propertyName, null)) {
        error[propertyName] = details;
    }
    return error;
};

export const recordWorkerRuntimeSurfaceFailure = ({
    surfaceId,
    stage = 'control',
    reason = 'worker_runtime_error',
    workerMessageType = null,
    error = null,
    missing = null,
    details = null,
    messagePrefix = 'WORKER_RUNTIME_SURFACE_FAIL',
    taskKey = null,
    taskType = null,
    eventType = WORKER_RUNTIME_EVENT_TYPE.FAIL,
} = {}) => {
    const surface = requireWorkerRuntimeSurface(surfaceId);
    const normalizedStage = safeString(stage, 'control');
    const normalizedReason = safeString(reason, 'worker_runtime_error');
    const requestedTaskType = safeString(taskType, null);
    const eventBase = createWorkerRuntimeEventBase(surface.id, {
        taskKey: safeString(taskKey, null)
            || (normalizedStage === 'init' ? 'init' : (requestedTaskType ? 'default' : 'control')),
    });
    const resolvedTaskType = requestedTaskType || eventBase.taskType;
    const failureDetails = {
        surfaceId: surface.id,
        surfaceStatus: surface.status,
        surfaceKind: surface.kind,
        degradationMode: surface.degradationMode,
        degraded: true,
        stage: normalizedStage,
        reason: normalizedReason,
        ...(isObject(details) ? details : {}),
    };
    const messageType = safeString(workerMessageType, null);
    if (messageType) failureDetails.workerMessageType = messageType;
    if (Array.isArray(missing) && missing.length > 0) {
        failureDetails.missing = missing.slice();
    }
    const errorCode = safeString(error?.code, null);
    if (errorCode) failureDetails.errorCode = errorCode;

    recordWorkerRuntimeEvent({
        type: eventType,
        ...eventBase,
        taskType: resolvedTaskType,
        message: `${safeString(messagePrefix, 'WORKER_RUNTIME_SURFACE_FAIL')}:${normalizedReason}`,
        details: failureDetails,
    });
    return failureDetails;
};

export const recordWorkerRuntimeSurfaceFallback = (options = {}) => (
    recordWorkerRuntimeSurfaceFailure({
        ...options,
        eventType: WORKER_RUNTIME_EVENT_TYPE.FALLBACK_USED,
        messagePrefix: options?.messagePrefix || 'WORKER_RUNTIME_SURFACE_FALLBACK',
    })
);
