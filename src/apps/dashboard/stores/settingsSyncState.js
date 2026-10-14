import { requireSiteRegistrationRejectionDetails } from '../../../domains/progression/contracts/siteRegistrationRejection.js';

export const SETTINGS_SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  SAVING: 'saving',
  DIRTY: 'dirty',
  SYNCED: 'synced',
  APPLYING: 'applying',
  APPLY_ERROR: 'apply_error',
  ERROR: 'error',
});

function normalizePendingKeys(keys = []) {
  if (!Array.isArray(keys)) return [];
  return Array.from(new Set(
    keys
      .filter((key) => typeof key === 'string')
      .map((key) => key.trim())
      .filter(Boolean)
  ));
}

export function formatSettingsSyncError(error) {
  if (!error) return 'SETTINGS_SYNC_FAILED';
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error?.code === 'string' && error.code.trim()) return error.code.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  return 'SETTINGS_SYNC_FAILED';
}

export function createSettingsSyncState() {
  return {
    status: SETTINGS_SYNC_STATUS.IDLE,
    error: null,
    siteRegistrationRejection: null,
    pendingKeys: [],
    dirtyKeys: [],
    retryScheduledAt: null,
    retryCount: 0,
    lastSyncedAt: null,
    lastAckVersion: 0,
    lastAckKeys: [],
    propagationTaskId: null,
    propagationStatus: null,
    propagationFailures: [],
    retryingPropagation: false,
    operations: [],
  };
}

function normalizePropagation(propagation) {
  if (!propagation || typeof propagation !== 'object' || Array.isArray(propagation)) return null;
  return {
    status: typeof propagation.status === 'string' && propagation.status.trim()
      ? propagation.status.trim()
      : null,
    taskId: Number.isInteger(propagation.taskId) && propagation.taskId > 0
      ? propagation.taskId
      : null,
    failures: Array.isArray(propagation.failures)
      ? propagation.failures.filter((failure) => failure && typeof failure === 'object')
      : [],
  };
}

function formatPropagationError(propagation) {
  const firstFailure = propagation?.failures?.[0];
  return formatSettingsSyncError(
    firstFailure?.error?.code
      || firstFailure?.error?.message
      || 'SETTINGS_PROPAGATION_FAILED',
  );
}

function buildCommittedFields({ version = null, keys = [] } = {}, current) {
  return {
    lastAckVersion: Number.isFinite(Number(version))
      ? Math.max(0, Math.floor(Number(version)))
      : current.lastAckVersion,
    lastAckKeys: normalizePendingKeys(keys),
  };
}

export function buildSettingsSyncSavingState(keys = [], current = createSettingsSyncState()) {
  return {
    ...current,
    status: SETTINGS_SYNC_STATUS.SAVING,
    error: null,
    siteRegistrationRejection: null,
    pendingKeys: normalizePendingKeys(keys),
    dirtyKeys: [],
    retryScheduledAt: null,
    propagationTaskId: null,
    propagationStatus: null,
    propagationFailures: [],
    retryingPropagation: false,
  };
}

export function buildSettingsSyncRetryState(
  error,
  keys = [],
  { retryAt = null, retryCount = 0 } = {},
  current = createSettingsSyncState(),
) {
  return {
    ...current,
    status: SETTINGS_SYNC_STATUS.DIRTY,
    error: formatSettingsSyncError(error),
    pendingKeys: [],
    dirtyKeys: normalizePendingKeys(keys),
    retryScheduledAt: Number.isFinite(retryAt) ? retryAt : null,
    retryCount: Number.isFinite(retryCount) ? Math.max(0, Math.floor(retryCount)) : 0,
    propagationTaskId: null,
    propagationStatus: null,
    propagationFailures: [],
    retryingPropagation: false,
  };
}

export function buildSettingsSyncSuccessState(
  {
    version = null,
    keys = [],
  } = {},
  current = createSettingsSyncState(),
) {
  return {
    ...current,
    status: SETTINGS_SYNC_STATUS.SYNCED,
    error: null,
    siteRegistrationRejection: null,
    pendingKeys: [],
    dirtyKeys: [],
    retryScheduledAt: null,
    retryCount: 0,
    lastSyncedAt: Date.now(),
    ...buildCommittedFields({ version, keys }, current),
    propagationTaskId: null,
    propagationStatus: 'succeeded',
    propagationFailures: [],
    retryingPropagation: false,
  };
}

export function buildSettingsSyncCommittedState(
  {
    version = null,
    keys = [],
    propagation = null,
  } = {},
  current = createSettingsSyncState(),
) {
  const normalizedPropagation = normalizePropagation(propagation);
  if (!normalizedPropagation || normalizedPropagation.status === 'succeeded') {
    return buildSettingsSyncSuccessState({ version, keys }, current);
  }

  const shared = {
    ...current,
    ...buildCommittedFields({ version, keys }, current),
    pendingKeys: [],
    dirtyKeys: [],
    retryScheduledAt: null,
    retryCount: 0,
    propagationTaskId: normalizedPropagation.taskId,
    propagationStatus: normalizedPropagation.status,
    propagationFailures: normalizedPropagation.failures,
    retryingPropagation: false,
  };
  if (['failed', 'schedule_failed'].includes(normalizedPropagation.status)) {
    return {
      ...shared,
      status: SETTINGS_SYNC_STATUS.APPLY_ERROR,
      error: formatPropagationError(normalizedPropagation),
    };
  }
  return {
    ...shared,
    status: SETTINGS_SYNC_STATUS.APPLYING,
    error: null,
  };
}

export function buildSettingsPropagationObservationErrorState(error, current) {
  return {
    ...current,
    status: SETTINGS_SYNC_STATUS.APPLY_ERROR,
    error: formatSettingsSyncError(error),
    propagationStatus: 'observation_failed',
    propagationFailures: [{
      stage: 'completion_observation',
      error: { code: formatSettingsSyncError(error) },
    }],
    retryingPropagation: false,
  };
}

export function buildSettingsSyncErrorState(
  error,
  current = createSettingsSyncState(),
  { dirtyKeys = [] } = {},
) {
  return {
    ...current,
    status: SETTINGS_SYNC_STATUS.ERROR,
    error: formatSettingsSyncError(error),
    siteRegistrationRejection: requireSiteRegistrationRejectionDetails(error),
    pendingKeys: [],
    dirtyKeys: normalizePendingKeys(dirtyKeys),
    retryScheduledAt: null,
    propagationTaskId: null,
    propagationStatus: null,
    propagationFailures: [],
    retryingPropagation: false,
  };
}

// Channel status is a projection of individual command lifetimes. Completing
// one command cannot acknowledge, erase, or change another command's intent.
export function buildSettingsSyncAggregateState(operations, committed = createSettingsSyncState()) {
  const saving = operations.filter((operation) => operation.status === SETTINGS_SYNC_STATUS.SAVING);
  const retrying = operations.filter((operation) => operation.status === SETTINGS_SYNC_STATUS.DIRTY);
  const failures = operations.filter((operation) => operation.status === SETTINGS_SYNC_STATUS.ERROR);
  const applyFailures = operations.filter((operation) => operation.status === SETTINGS_SYNC_STATUS.APPLY_ERROR);
  const applying = operations.filter((operation) => operation.status === SETTINGS_SYNC_STATUS.APPLYING);
  const latestFailure = failures.at(-1);
  const propagation = applyFailures.at(-1) || applying.at(-1);
  const retryTimes = retrying.map((operation) => operation.retryScheduledAt).filter(Number.isFinite);
  return {
    ...committed,
    status: saving.length > 0 ? SETTINGS_SYNC_STATUS.SAVING
      : retrying.length > 0 ? SETTINGS_SYNC_STATUS.DIRTY
        : latestFailure ? SETTINGS_SYNC_STATUS.ERROR
          : applyFailures.length > 0 ? SETTINGS_SYNC_STATUS.APPLY_ERROR
            : applying.length > 0 ? SETTINGS_SYNC_STATUS.APPLYING
              : committed.status,
    error: latestFailure?.error || propagation?.error || retrying.at(-1)?.error || null,
    pendingKeys: normalizePendingKeys(saving.flatMap((operation) => operation.pendingKeys)),
    dirtyKeys: normalizePendingKeys([...retrying, ...failures].flatMap((operation) => operation.dirtyKeys)),
    retryScheduledAt: retryTimes.length > 0 ? Math.min(...retryTimes) : null,
    retryCount: retrying.length > 0 ? Math.max(...retrying.map((operation) => operation.retryCount)) : 0,
    propagationTaskId: propagation ? propagation.propagationTaskId : committed.propagationTaskId,
    propagationStatus: propagation ? propagation.propagationStatus : committed.propagationStatus,
    propagationFailures: [...applyFailures, ...applying].flatMap((operation) => operation.propagationFailures),
    operations,
    retryingPropagation: operations.some((operation) => operation.retryingPropagation === true),
  };
}
