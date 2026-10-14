import {
  PERSONAL_BASELINE_METRIC_DIRECTIONS,
  PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_ROLES,
} from '../../../lib/personalBaselineContract.js';

const CLSE_BASELINE_RECORD_SCHEMA_VERSION = 1;
export const CLSE_BASELINE_VERSION = 2;
export const CLSE_BASELINE_POLICY_VERSION = 'clse_same_grain_huber_v1';
export const CLSE_BASELINE_ROLE = PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE;
export const CLSE_BASELINE_DIRECTION = PERSONAL_BASELINE_METRIC_DIRECTIONS.HIGHER;
export const CLSE_BASELINE_GRAINS = Object.freeze({
  BUCKET_10S: PERSONAL_BASELINE_METRIC_GRAINS.BUCKET_10S,
  BUCKET_60S: PERSONAL_BASELINE_METRIC_GRAINS.BUCKET_60S,
});

export const CLSE_BASELINE_GRAIN_EVIDENCE_LIMITS = Object.freeze({
  [CLSE_BASELINE_GRAINS.BUCKET_10S]: Object.freeze({
    durationMs: 10_000,
    minimumActiveMs: 2_000,
  }),
  [CLSE_BASELINE_GRAINS.BUCKET_60S]: Object.freeze({
    durationMs: 60_000,
    minimumActiveMs: 30_000,
  }),
});

export const CLSE_BASELINE_FEATURES = Object.freeze([
  'tab_switch_rate',
  'nav_rate',
  'scroll_volatility',
  'seek_rate',
]);

const BASELINE_KEYS = Object.freeze([
  'schemaVersion',
  'id',
  'baseline_version',
  'policy_version',
  'role',
  'direction',
  'reset_epoch',
  'created_at',
  'updated_at',
  'profiles',
]);
const BASELINE_VALUE_KEYS = Object.freeze(
  BASELINE_KEYS.filter((key) => key !== 'schemaVersion' && key !== 'id'),
);
const PROFILE_KEYS = Object.freeze([
  'grain',
  'observed_days',
  'eligible_observations',
  'total_active_ms',
  'first_observed_at',
  'last_observed_at',
  'last_observed_date',
  'feature_stats',
]);
const FEATURE_STAT_KEYS = Object.freeze([
  'sample_count',
  'mean',
  'variance',
]);
const GRAIN_VALUES = Object.freeze(Object.values(CLSE_BASELINE_GRAINS));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function createEmptyFeatureStats() {
  return Object.fromEntries(CLSE_BASELINE_FEATURES.map((feature) => [
    feature,
    { sample_count: 0, mean: 0, variance: 0 },
  ]));
}

function createEmptyProfile(grain) {
  return {
    grain,
    observed_days: 0,
    eligible_observations: 0,
    total_active_ms: 0,
    first_observed_at: null,
    last_observed_at: null,
    last_observed_date: null,
    feature_stats: createEmptyFeatureStats(),
  };
}

export function createEmptyClseBaselineValue({ now = Date.now() } = {}) {
  if (!isPositiveInteger(now)) throw new Error('CLSE_BASELINE_CREATED_AT_INVALID');
  return {
    baseline_version: CLSE_BASELINE_VERSION,
    policy_version: CLSE_BASELINE_POLICY_VERSION,
    role: CLSE_BASELINE_ROLE,
    direction: CLSE_BASELINE_DIRECTION,
    reset_epoch: now,
    created_at: now,
    updated_at: now,
    profiles: GRAIN_VALUES.map(createEmptyProfile),
  };
}

function normalizeFeatureStat(value) {
  if (
    !hasExactKeys(value, FEATURE_STAT_KEYS)
    || !isNonNegativeInteger(value.sample_count)
    || !isNonNegativeNumber(value.mean)
    || !isNonNegativeNumber(value.variance)
  ) return null;
  return {
    sample_count: value.sample_count,
    mean: value.mean,
    variance: value.variance,
  };
}

function isNullableTimestamp(value) {
  return value === null || isNonNegativeInteger(value);
}

function isCalendarDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function normalizeProfile(value) {
  if (
    !hasExactKeys(value, PROFILE_KEYS)
    || !GRAIN_VALUES.includes(value.grain)
    || !isNonNegativeInteger(value.observed_days)
    || !isNonNegativeInteger(value.eligible_observations)
    || !isNonNegativeNumber(value.total_active_ms)
    || !isNullableTimestamp(value.first_observed_at)
    || !isNullableTimestamp(value.last_observed_at)
    || !hasExactKeys(value.feature_stats, CLSE_BASELINE_FEATURES)
  ) return null;

  const featureStats = Object.fromEntries(CLSE_BASELINE_FEATURES.map((feature) => [
    feature,
    normalizeFeatureStat(value.feature_stats[feature]),
  ]));
  if (Object.values(featureStats).some((entry) => !entry)) return null;

  const sampleCounts = Object.values(featureStats).map((entry) => entry.sample_count);
  const isEmpty = value.eligible_observations === 0;
  const evidenceLimits = CLSE_BASELINE_GRAIN_EVIDENCE_LIMITS[value.grain];
  if (
    sampleCounts.some((count) => count !== value.eligible_observations)
    || value.observed_days > value.eligible_observations
    || (isEmpty && (
      value.observed_days !== 0
      || value.total_active_ms !== 0
      || value.first_observed_at !== null
      || value.last_observed_at !== null
      || value.last_observed_date !== null
      || Object.values(featureStats).some((stats) => (
        stats.mean !== 0 || stats.variance !== 0
      ))
    ))
    || (!isEmpty && (
      value.observed_days === 0
      || value.total_active_ms <= 0
      || value.total_active_ms < (
        value.eligible_observations * evidenceLimits.minimumActiveMs
      )
      || value.total_active_ms > (
        value.eligible_observations * evidenceLimits.durationMs
      )
      || !isNonNegativeInteger(value.first_observed_at)
      || !isNonNegativeInteger(value.last_observed_at)
      || value.first_observed_at > value.last_observed_at
      || !isCalendarDateKey(value.last_observed_date)
    ))
  ) return null;

  return {
    grain: value.grain,
    observed_days: value.observed_days,
    eligible_observations: value.eligible_observations,
    total_active_ms: value.total_active_ms,
    first_observed_at: value.first_observed_at,
    last_observed_at: value.last_observed_at,
    last_observed_date: value.last_observed_date,
    feature_stats: featureStats,
  };
}

export function normalizeClseBaselineRow(row) {
  if (
    !hasExactKeys(row, BASELINE_KEYS)
    || row.schemaVersion !== CLSE_BASELINE_RECORD_SCHEMA_VERSION
    || row.id !== 'default'
    || row.baseline_version !== CLSE_BASELINE_VERSION
    || row.policy_version !== CLSE_BASELINE_POLICY_VERSION
    || row.role !== CLSE_BASELINE_ROLE
    || row.direction !== CLSE_BASELINE_DIRECTION
    || !isPositiveInteger(row.reset_epoch)
    || !isPositiveInteger(row.created_at)
    || !isPositiveInteger(row.updated_at)
    || row.updated_at < row.created_at
    || row.reset_epoch !== row.created_at
    || !Array.isArray(row.profiles)
    || row.profiles.length !== GRAIN_VALUES.length
  ) return null;

  const profiles = row.profiles.map(normalizeProfile);
  if (
    profiles.some((profile) => !profile)
    || new Set(profiles.map((profile) => profile.grain)).size !== GRAIN_VALUES.length
    || !GRAIN_VALUES.every((grain) => profiles.some((profile) => profile.grain === grain))
    || profiles.some((profile) => (
      profile.first_observed_at !== null
      && (
        profile.first_observed_at < row.created_at
        || profile.last_observed_at > row.updated_at
      )
    ))
  ) return null;
  profiles.sort((left, right) => (
    GRAIN_VALUES.indexOf(left.grain) - GRAIN_VALUES.indexOf(right.grain)
  ));

  return {
    schemaVersion: CLSE_BASELINE_RECORD_SCHEMA_VERSION,
    id: 'default',
    baseline_version: CLSE_BASELINE_VERSION,
    policy_version: CLSE_BASELINE_POLICY_VERSION,
    role: CLSE_BASELINE_ROLE,
    direction: CLSE_BASELINE_DIRECTION,
    reset_epoch: row.reset_epoch,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profiles,
  };
}

export function createClseBaselineRecord(command) {
  if (!hasExactKeys(command, BASELINE_VALUE_KEYS)) {
    throw new Error('CLSE_STORE_BASELINE_CONTRACT_INVALID');
  }
  const record = normalizeClseBaselineRow({
    schemaVersion: CLSE_BASELINE_RECORD_SCHEMA_VERSION,
    id: 'default',
    ...command,
  });
  if (!record) throw new Error('CLSE_STORE_BASELINE_CONTRACT_INVALID');
  return record;
}

export function toClseBaselineValue(row) {
  const canonical = normalizeClseBaselineRow(row);
  if (!canonical) throw new Error('CLSE_STORE_BASELINE_CONTRACT_INVALID');
  const { schemaVersion: _schemaVersion, id: _id, ...value } = canonical;
  return value;
}
