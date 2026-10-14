export const AI_RESULT_STATUS = Object.freeze({
  OK: 'ok',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
});

export const AI_PREPARATION_STATUS = Object.freeze({
  OK: 'ok',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
});

function getRequestTaskId(request) {
  return typeof request?.taskId === 'string' ? request.taskId : '';
}

function cloneMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
}

function requireTimestamp(value, errorCode) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error(errorCode);
  }
  return timestamp;
}

export function createAiTaskOkResult({
  request,
  output,
  providerId,
  generatedAt,
  metadata = {},
} = {}) {
  return Object.freeze({
    status: AI_RESULT_STATUS.OK,
    taskId: getRequestTaskId(request),
    output,
    metadata: Object.freeze({
      ...cloneMetadata(metadata),
      providerId: providerId || '',
      generatedAt: requireTimestamp(generatedAt, 'AI_RESULT_GENERATED_AT_INVALID'),
    }),
  });
}

export function createAiTaskUnavailableResult({
  request,
  providerId,
  availability = null,
} = {}) {
  return Object.freeze({
    status: AI_RESULT_STATUS.UNAVAILABLE,
    taskId: getRequestTaskId(request),
    output: null,
    metadata: Object.freeze({
      providerId: providerId || availability?.providerId || '',
      availability,
    }),
  });
}

export function createAiTaskErrorResult({
  request,
  providerId,
  errorCode,
  message = '',
  details = null,
} = {}) {
  return Object.freeze({
    status: AI_RESULT_STATUS.ERROR,
    taskId: getRequestTaskId(request),
    output: null,
    error: Object.freeze({
      code: typeof errorCode === 'string' && errorCode ? errorCode : 'ai_task_failed',
      message: typeof message === 'string' ? message : '',
      details: details && typeof details === 'object' ? Object.freeze({ ...details }) : null,
    }),
    metadata: Object.freeze({
      providerId: providerId || '',
    }),
  });
}

export function createAiPreparationOkResult({
  taskId,
  providerId,
  preparedAt,
  metadata = {},
} = {}) {
  return Object.freeze({
    status: AI_PREPARATION_STATUS.OK,
    taskId: typeof taskId === 'string' ? taskId : '',
    metadata: Object.freeze({
      ...cloneMetadata(metadata),
      providerId: providerId || '',
      preparedAt: requireTimestamp(preparedAt, 'AI_PREPARATION_PREPARED_AT_INVALID'),
    }),
  });
}

export function createAiPreparationUnavailableResult({
  taskId,
  providerId,
  availability = null,
} = {}) {
  return Object.freeze({
    status: AI_PREPARATION_STATUS.UNAVAILABLE,
    taskId: typeof taskId === 'string' ? taskId : '',
    metadata: Object.freeze({
      providerId: providerId || availability?.providerId || '',
      availability,
    }),
  });
}

export function createAiPreparationErrorResult({
  taskId,
  providerId,
  errorCode,
  message = '',
  details = null,
} = {}) {
  return Object.freeze({
    status: AI_PREPARATION_STATUS.ERROR,
    taskId: typeof taskId === 'string' ? taskId : '',
    error: Object.freeze({
      code: typeof errorCode === 'string' && errorCode ? errorCode : 'ai_preparation_failed',
      message: typeof message === 'string' ? message : '',
      details: details && typeof details === 'object' ? Object.freeze({ ...details }) : null,
    }),
    metadata: Object.freeze({
      providerId: providerId || '',
    }),
  });
}
