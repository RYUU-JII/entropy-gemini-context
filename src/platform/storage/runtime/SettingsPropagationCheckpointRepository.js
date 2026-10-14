import RuntimeSessionRepository, {
  STORAGE_SESSION_KEYS,
} from './RuntimeSessionRepository.js';

const CHECKPOINT_VERSION = 1;
const CHECKPOINT_STATUSES = new Set(['pending', 'failed']);
const STAGE_KEYS = Object.freeze([
  'refresh_cache',
  'auto_purge',
  'sync_blocked_bookmarks',
  'runtime_adapters',
  'managed_content_script_sync',
  'broadcast',
]);
const STAGE_FLAG_KEYS = Object.freeze([
  'shouldRefresh',
  'shouldAutoPurge',
  'shouldSyncBlockedBookmarks',
  'shouldRunRuntimeAdapters',
  'shouldSyncScripts',
  'shouldBroadcast',
]);
const TASK_KEYS = Object.freeze([
  'taskId',
  'commitVersion',
  'actionReason',
  'changedKeys',
  'retryCounts',
  'appliedStages',
  ...STAGE_FLAG_KEYS,
]);
const OUTCOME_APPLIED_STAGE_KEYS = Object.freeze({
  refreshed: 'refresh_cache',
  autoPurged: 'auto_purge',
  syncedBlockedBookmarks: 'sync_blocked_bookmarks',
  runtimeAdapters: 'runtime_adapters',
  syncScripts: 'managed_content_script_sync',
  broadcast: 'broadcast',
});
const STAGE_FLAG_BY_STAGE = Object.freeze(Object.fromEntries(
  STAGE_KEYS.map((stageKey, index) => [stageKey, STAGE_FLAG_KEYS[index]]),
));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createCheckpointError(field) {
  const error = new Error(`SETTINGS_PROPAGATION_CHECKPOINT_INVALID:${field}`);
  error.code = 'SETTINGS_PROPAGATION_CHECKPOINT_INVALID';
  error.field = field;
  return error;
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw createCheckpointError(field);
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw createCheckpointError(field);
  }
  return value;
}

function requireExactKeys(value, expectedKeys, field) {
  if (!isPlainObject(value)) throw createCheckpointError(field);
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw createCheckpointError(field);
  }
}

function requireStringArray(value, field) {
  if (!Array.isArray(value)) throw createCheckpointError(field);
  const normalized = value.map((entry) => {
    if (typeof entry !== 'string' || !entry.trim() || entry !== entry.trim()) {
      throw createCheckpointError(field);
    }
    return entry;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw createCheckpointError(field);
  }
  return normalized;
}

function normalizeRetryCounts(value, field) {
  requireExactKeys(value, STAGE_KEYS, field);
  return Object.fromEntries(STAGE_KEYS.map((stage) => [
    stage,
    requireNonNegativeInteger(value[stage], `${field}.${stage}`),
  ]));
}

function normalizeBooleanMap(value, field, keys) {
  requireExactKeys(value, keys, field);
  return Object.fromEntries(keys.map((key) => {
    if (typeof value[key] !== 'boolean') throw createCheckpointError(`${field}.${key}`);
    return [key, value[key]];
  }));
}

function normalizeTask(value) {
  requireExactKeys(value, TASK_KEYS, 'task');
  const task = {
    taskId: requirePositiveInteger(value.taskId, 'task.taskId'),
    commitVersion: value.commitVersion === null
      ? null
      : requireNonNegativeInteger(value.commitVersion, 'task.commitVersion'),
    actionReason: typeof value.actionReason === 'string'
      && value.actionReason.trim()
      && value.actionReason === value.actionReason.trim()
      ? value.actionReason
      : (() => { throw createCheckpointError('task.actionReason'); })(),
    changedKeys: requireStringArray(value.changedKeys, 'task.changedKeys'),
    retryCounts: normalizeRetryCounts(value.retryCounts, 'task.retryCounts'),
    appliedStages: normalizeBooleanMap(value.appliedStages, 'task.appliedStages', STAGE_KEYS),
  };
  STAGE_FLAG_KEYS.forEach((flagKey) => {
    if (typeof value[flagKey] !== 'boolean') {
      throw createCheckpointError(`task.${flagKey}`);
    }
    task[flagKey] = value[flagKey];
  });
  return task;
}

function normalizeFailure(value, index) {
  const field = `outcome.failures.${index}`;
  requireExactKeys(value, ['stage', 'retryCount', 'error'], field);
  if (!STAGE_KEYS.includes(value.stage)) throw createCheckpointError(`${field}.stage`);
  requireExactKeys(value.error, ['code', 'name', 'message'], `${field}.error`);
  const { error } = value;
  if (
    typeof error.message !== 'string'
    || !error.message.trim()
    || error.message !== error.message.trim()
    || (error.code !== null && (
      typeof error.code !== 'string'
      || !error.code.trim()
      || error.code !== error.code.trim()
    ))
    || (error.name !== null && (
      typeof error.name !== 'string'
      || !error.name.trim()
      || error.name !== error.name.trim()
    ))
  ) {
    throw createCheckpointError(`${field}.error`);
  }
  return {
    stage: value.stage,
    retryCount: requireNonNegativeInteger(value.retryCount, `${field}.retryCount`),
    error: {
      code: error.code,
      name: error.name,
      message: error.message,
    },
  };
}

function normalizeOutcome(value) {
  requireExactKeys(
    value,
    ['status', 'taskId', 'commitVersion', 'changedKeys', 'applied', 'failures'],
    'outcome',
  );
  if (value.status !== 'failed') {
    throw createCheckpointError('outcome');
  }
  if (!Array.isArray(value.failures) || value.failures.length === 0) {
    throw createCheckpointError('outcome.failures');
  }
  return {
    status: 'failed',
    taskId: requirePositiveInteger(value.taskId, 'outcome.taskId'),
    commitVersion: value.commitVersion === null
      ? null
      : requireNonNegativeInteger(value.commitVersion, 'outcome.commitVersion'),
    changedKeys: requireStringArray(value.changedKeys, 'outcome.changedKeys'),
    applied: normalizeBooleanMap(
      value.applied,
      'outcome.applied',
      Object.keys(OUTCOME_APPLIED_STAGE_KEYS),
    ),
    failures: value.failures.map(normalizeFailure),
  };
}

function requireFailedCheckpointConsistency(task, outcome) {
  if (outcome.taskId !== task.taskId) throw createCheckpointError('outcome.taskId');
  if (outcome.commitVersion !== task.commitVersion) {
    throw createCheckpointError('outcome.commitVersion');
  }
  if (
    outcome.changedKeys.length !== task.changedKeys.length
    || outcome.changedKeys.some((key, index) => key !== task.changedKeys[index])
  ) {
    throw createCheckpointError('outcome.changedKeys');
  }
  Object.entries(OUTCOME_APPLIED_STAGE_KEYS).forEach(([appliedKey, stageKey]) => {
    if (outcome.applied[appliedKey] !== task.appliedStages[stageKey]) {
      throw createCheckpointError(`outcome.applied.${appliedKey}`);
    }
  });
  const failureStages = new Set();
  outcome.failures.forEach((failure, index) => {
    if (failureStages.has(failure.stage)) {
      throw createCheckpointError(`outcome.failures.${index}.stage`);
    }
    failureStages.add(failure.stage);
    if (!task[STAGE_FLAG_BY_STAGE[failure.stage]]) {
      throw createCheckpointError(`outcome.failures.${index}.stage`);
    }
    if (failure.retryCount !== task.retryCounts[failure.stage]) {
      throw createCheckpointError(`outcome.failures.${index}.retryCount`);
    }
  });
}

export function normalizeSettingsPropagationCheckpoint(value) {
  requireExactKeys(value, ['version', 'status', 'task', 'outcome'], 'checkpoint');
  if (value.version !== CHECKPOINT_VERSION) throw createCheckpointError('version');
  if (!CHECKPOINT_STATUSES.has(value.status)) throw createCheckpointError('status');
  const checkpoint = {
    version: CHECKPOINT_VERSION,
    status: value.status,
    task: normalizeTask(value.task),
    outcome: null,
  };
  if (value.status === 'failed') {
    checkpoint.outcome = normalizeOutcome(value.outcome);
    requireFailedCheckpointConsistency(checkpoint.task, checkpoint.outcome);
  } else if (value.outcome !== null) {
    throw createCheckpointError('outcome');
  }
  return checkpoint;
}

export class SettingsPropagationCheckpointRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    if (
      !sessionRepository
      || typeof sessionRepository.readOptional !== 'function'
      || typeof sessionRepository.set !== 'function'
      || typeof sessionRepository.remove !== 'function'
    ) {
      throw new Error('SETTINGS_PROPAGATION_SESSION_REPOSITORY_REQUIRED');
    }
    this.sessionRepository = sessionRepository;
  }

  async read() {
    const optional = await this.sessionRepository.readOptional(
      STORAGE_SESSION_KEYS.SETTINGS_PROPAGATION,
    );
    requireExactKeys(optional, ['found', 'value'], 'storage_result');
    if (typeof optional.found !== 'boolean') {
      throw createCheckpointError('storage_result');
    }
    if (!optional.found) {
      if (optional.value !== undefined) throw createCheckpointError('storage_result');
      return null;
    }
    return normalizeSettingsPropagationCheckpoint(optional.value);
  }

  async writePending(task) {
    const checkpoint = normalizeSettingsPropagationCheckpoint({
      version: CHECKPOINT_VERSION,
      status: 'pending',
      task,
      outcome: null,
    });
    await this.sessionRepository.set({
      [STORAGE_SESSION_KEYS.SETTINGS_PROPAGATION]: checkpoint,
    });
    return checkpoint;
  }

  async writeFailed(task, outcome) {
    const checkpoint = normalizeSettingsPropagationCheckpoint({
      version: CHECKPOINT_VERSION,
      status: 'failed',
      task,
      outcome,
    });
    await this.sessionRepository.set({
      [STORAGE_SESSION_KEYS.SETTINGS_PROPAGATION]: checkpoint,
    });
    return checkpoint;
  }

  clear() {
    return this.sessionRepository.remove(STORAGE_SESSION_KEYS.SETTINGS_PROPAGATION);
  }
}

export default SettingsPropagationCheckpointRepository;
