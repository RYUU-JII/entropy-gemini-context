export const CYCLE_SETTINGS_KEY = 'monitor_cycleSettings';
export const CYCLE_CHECKPOINT_SCHEMA_VERSION = 1;
export const CYCLE_SETTINGS_SCHEMA_VERSION = 1;

const CYCLE_CHECKPOINT_KEYS = Object.freeze([
  'schemaVersion',
  'currentCycleStart',
  'lastActivityAt',
  'previousCycleStats',
  'habitualWakeHour',
  'mode',
]);
const CYCLE_CHECKPOINT_COMMAND_KEYS = Object.freeze(
  CYCLE_CHECKPOINT_KEYS.filter((key) => key !== 'schemaVersion'),
);
const CYCLE_STATS_KEYS = Object.freeze([
  'startTime',
  'endTime',
  'duration',
  'vDay',
  'mode',
  'resetHourUsed',
]);
const CYCLE_SETTINGS_KEYS = Object.freeze(['schemaVersion', 'resetPolicy']);
const CYCLE_SETTINGS_COMMAND_KEYS = Object.freeze(['resetPolicy']);
const RESET_POLICY_KEYS = Object.freeze([
  'version',
  'mode',
  'stage',
  'effectiveResetHour',
  'manualResetHour',
  'bootstrapStartedAt',
  'recommendation',
  'pending',
  'cooldownUntil',
  'history',
]);
const RESET_RECOMMENDATION_KEYS = Object.freeze([
  'id',
  'candidateHour',
  'reliability',
  'basedOnDays',
  'createdAt',
]);
const RESET_PENDING_KEYS = Object.freeze([
  'nextHour',
  'acceptedAt',
  'applyAt',
  'reason',
]);
const RESET_HISTORY_KEYS = Object.freeze([
  'fromHour',
  'toHour',
  'decidedAt',
  'appliedAt',
  'reason',
]);
const RESET_MODES = new Set(['auto', 'manual']);
const RESET_STAGES = new Set(['bootstrap', 'adaptive']);
const RESET_RELIABILITIES = new Set(['LOW', 'MEDIUM', 'HIGH']);
const RESET_REASONS = new Set(['manual', 'adaptive', 'recommendation']);

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isPositiveTimestamp(value) {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeTimestamp(value) {
  return Number.isFinite(value) && value >= 0;
}

function isHour(value) {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

function cloneCycleStats(value, errorCode) {
  if (value === null) return null;
  if (
    !hasExactKeys(value, CYCLE_STATS_KEYS)
    || !isPositiveTimestamp(value.startTime)
    || !isPositiveTimestamp(value.endTime)
    || value.endTime < value.startTime
    || !Number.isFinite(value.duration)
    || value.duration < 0
    || value.duration !== value.endTime - value.startTime
    || typeof value.vDay !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.vDay)
    || value.mode !== 'fixed'
    || !isHour(value.resetHourUsed)
  ) {
    throw new Error(errorCode);
  }
  return { ...value };
}

function cloneResetRecommendation(value, errorCode) {
  if (value === null) return null;
  if (
    !hasExactKeys(value, RESET_RECOMMENDATION_KEYS)
    || typeof value.id !== 'string'
    || !value.id
    || !isHour(value.candidateHour)
    || !RESET_RELIABILITIES.has(value.reliability)
    || !Number.isInteger(value.basedOnDays)
    || value.basedOnDays < 0
    || !isPositiveTimestamp(value.createdAt)
  ) {
    throw new Error(errorCode);
  }
  return { ...value };
}

function cloneResetPending(value, errorCode) {
  if (value === null) return null;
  if (
    !hasExactKeys(value, RESET_PENDING_KEYS)
    || !isHour(value.nextHour)
    || !isPositiveTimestamp(value.acceptedAt)
    || !isPositiveTimestamp(value.applyAt)
    || value.applyAt < value.acceptedAt
    || !RESET_REASONS.has(value.reason)
  ) {
    throw new Error(errorCode);
  }
  return { ...value };
}

function cloneResetHistoryEntry(value, errorCode) {
  if (
    !hasExactKeys(value, RESET_HISTORY_KEYS)
    || !isHour(value.fromHour)
    || !isHour(value.toHour)
    || !isPositiveTimestamp(value.decidedAt)
    || !isPositiveTimestamp(value.appliedAt)
    || value.appliedAt < value.decidedAt
    || !RESET_REASONS.has(value.reason)
  ) {
    throw new Error(errorCode);
  }
  return { ...value };
}

function cloneResetPolicy(value, errorCode) {
  if (
    !hasExactKeys(value, RESET_POLICY_KEYS)
    || value.version !== 1
    || !RESET_MODES.has(value.mode)
    || !RESET_STAGES.has(value.stage)
    || !isHour(value.effectiveResetHour)
    || !isHour(value.manualResetHour)
    || !isPositiveTimestamp(value.bootstrapStartedAt)
    || !isNonNegativeTimestamp(value.cooldownUntil)
    || !Array.isArray(value.history)
    || value.history.length > 60
  ) {
    throw new Error(errorCode);
  }
  return {
    version: 1,
    mode: value.mode,
    stage: value.stage,
    effectiveResetHour: value.effectiveResetHour,
    manualResetHour: value.manualResetHour,
    bootstrapStartedAt: value.bootstrapStartedAt,
    recommendation: cloneResetRecommendation(value.recommendation, errorCode),
    pending: cloneResetPending(value.pending, errorCode),
    cooldownUntil: value.cooldownUntil,
    history: value.history.map((entry) => cloneResetHistoryEntry(entry, errorCode)),
  };
}

export function createCycleCheckpointRecord(value) {
  const errorCode = 'CYCLE_CHECKPOINT_CONTRACT_INVALID';
  if (!hasExactKeys(value, CYCLE_CHECKPOINT_COMMAND_KEYS)) {
    throw new Error(errorCode);
  }
  return readCycleCheckpointRecord({
    schemaVersion: CYCLE_CHECKPOINT_SCHEMA_VERSION,
    ...value,
  });
}

export function readCycleCheckpointRecord(value) {
  const errorCode = 'CYCLE_CHECKPOINT_CONTRACT_INVALID';
  if (!isPlainObject(value)) throw new Error(errorCode);
  if (value.schemaVersion !== CYCLE_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error('CYCLE_CHECKPOINT_VERSION_UNSUPPORTED');
  }
  if (
    !hasExactKeys(value, CYCLE_CHECKPOINT_KEYS)
    || !isPositiveTimestamp(value.currentCycleStart)
    || !isPositiveTimestamp(value.lastActivityAt)
    || !isHour(value.habitualWakeHour)
    || value.mode !== 'fixed'
  ) {
    throw new Error(errorCode);
  }
  return {
    schemaVersion: CYCLE_CHECKPOINT_SCHEMA_VERSION,
    currentCycleStart: value.currentCycleStart,
    lastActivityAt: value.lastActivityAt,
    previousCycleStats: cloneCycleStats(value.previousCycleStats, errorCode),
    habitualWakeHour: value.habitualWakeHour,
    mode: value.mode,
  };
}

export function toCycleCheckpointValue(record) {
  const canonical = readCycleCheckpointRecord(record);
  const { schemaVersion: _schemaVersion, ...value } = canonical;
  return value;
}

export function createCycleSettingsRecord(value) {
  const errorCode = 'CYCLE_SETTINGS_CONTRACT_INVALID';
  if (!hasExactKeys(value, CYCLE_SETTINGS_COMMAND_KEYS)) {
    throw new Error(errorCode);
  }
  return readCycleSettingsRecord({
    schemaVersion: CYCLE_SETTINGS_SCHEMA_VERSION,
    resetPolicy: value.resetPolicy,
  });
}

export function readCycleSettingsRecord(value) {
  const errorCode = 'CYCLE_SETTINGS_CONTRACT_INVALID';
  if (!isPlainObject(value)) throw new Error(errorCode);
  if (value.schemaVersion !== CYCLE_SETTINGS_SCHEMA_VERSION) {
    throw new Error('CYCLE_SETTINGS_VERSION_UNSUPPORTED');
  }
  if (!hasExactKeys(value, CYCLE_SETTINGS_KEYS)) {
    throw new Error(errorCode);
  }
  return {
    schemaVersion: CYCLE_SETTINGS_SCHEMA_VERSION,
    resetPolicy: cloneResetPolicy(value.resetPolicy, errorCode),
  };
}

export function toCycleSettingsValue(record) {
  const canonical = readCycleSettingsRecord(record);
  return { resetPolicy: canonical.resetPolicy };
}
