import { normalizeDailySummaryDateStr } from '../dbStatsNormalizers.js';
import {
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_STATUSES,
} from '../../../../../lib/personalBaselineContract.js';
import {
  CLSE_BASELINE_GRAINS,
  createClseBaselineRecord,
  normalizeClseBaselineRow,
  toClseBaselineValue,
} from '../../../clse/clseBaselineStorageContract.js';

export {
  createClseBaselineRecord,
  normalizeClseBaselineRow,
  toClseBaselineValue,
};

export const CLSE_RECORD_SCHEMA_VERSION = 1;
const CLSE_AGGRESSION_LOG_SCHEMA_VERSION = 1;
export const CLSE_DAILY_SUMMARY_SCHEMA_VERSION = 1;

const BUCKET_60S_KEYS = Object.freeze([
  'schemaVersion',
  'ts_start',
  'duration_ms',
  'active_ms',
  'idle_ms',
  'tab_switch_count',
  'tab_open_count_avg',
  'visibility_change_count',
  'nav_count',
  'back_forward_count',
  'same_site_jump_count',
  'cross_site_jump_count',
  'scroll_event_count',
  'scroll_abs_delta_sum',
  'scroll_dir_change_count',
  'scroll_velocity_mean',
  'scroll_velocity_var',
  'content_add_count',
  'feed_item_add_count',
  'short_dwell_count',
  'media_seek_count',
  'media_rate_change_count',
  'media_pause_play_count',
  'peak_10s_tab_switch',
  'peak_10s_nav',
  'peak_10s_scroll_abs_delta',
]);
const BUCKET_5MIN_KEYS = Object.freeze([
  'schemaVersion',
  'ts_start',
  'duration_ms',
  'active_ms',
  'idle_ms',
  'tab_switch_rate_mean',
  'nav_rate_mean',
  'scroll_volatility_mean',
  'seek_rate_mean',
  'peak_60s_load_index',
  'time_in_load_spike_ms',
  'time_in_sustained_load_ms',
  'loop_detected_count',
]);
const LOOP_EVENT_KEYS = Object.freeze([
  'schemaVersion',
  'ts',
  'event',
  'type',
  'site_key',
  'page_key',
  'repeat_count',
  'window_ms',
]);
const DAILY_SUMMARY_KEYS = Object.freeze([
  'dateStr',
  'schemaVersion',
  'source',
  'bucket60sCount',
  'bucket5minCount',
  'totals',
  'rates',
  'updatedAt',
]);
const DAILY_TOTAL_KEYS = Object.freeze([
  'activeMs',
  'idleMs',
  'tabSwitchCount',
  'navCount',
  'scrollEventCount',
  'scrollAbsDeltaSum',
  'mediaSeekCount',
  'loopDetectedCount',
  'loadSpikeMs',
  'sustainedLoadMs',
]);
const DAILY_RATE_KEYS = Object.freeze([
  'tabSwitchPerActiveMin',
  'navPerActiveMin',
  'mediaSeekPerActiveMin',
]);
const AGGRESSION_LOG_KEYS = Object.freeze([
  'schemaVersion',
  'ts',
  'bucket_ts',
  'type',
  'score',
  'aggressive_score',
  'meaningless_score',
  'metrics',
  'z_scores',
  'gate',
  'reference_mode',
  'baseline_status',
  'baseline_grain',
  'baseline_reset_epoch',
]);
const BASELINE_REFERENCE_MODE_VALUES = Object.freeze(
  Object.values(PERSONAL_BASELINE_REFERENCE_MODES),
);
const BASELINE_STATUS_VALUES = Object.freeze(Object.values(PERSONAL_BASELINE_STATUSES));
const AGGRESSION_SHAPES = Object.freeze({
  scroll: Object.freeze({
    metrics: Object.freeze([
      'intensity', 'eventRate', 'dirChangeRate', 'volatility', 'feedItems',
      'contentNodes', 'shortDwellRate', 'engagementCount',
    ]),
    zScores: Object.freeze(['scroll_volatility']),
    gate: Object.freeze(['activeMs', 'eventCount', 'pass']),
  }),
  nav: Object.freeze({
    metrics: Object.freeze([
      'navRate', 'backForwardRatio', 'sameSiteRatio', 'shortDwellRate',
      'engagementCount',
    ]),
    zScores: Object.freeze(['nav_rate']),
    gate: Object.freeze(['activeMs', 'navCount', 'pass']),
  }),
  tab: Object.freeze({
    metrics: Object.freeze([
      'switchRate', 'openTabs', 'visibilityRatio', 'shortDwellRate',
      'engagementCount',
    ]),
    zScores: Object.freeze(['tab_switch_rate']),
    gate: Object.freeze(['activeMs', 'switchCount', 'pass']),
  }),
  media: Object.freeze({
    metrics: Object.freeze(['seekRate', 'skimRatio', 'engagementCount']),
    zScores: Object.freeze(['seek_rate']),
    gate: Object.freeze(['activeMs', 'totalEvents', 'pass']),
  }),
});

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

function isUnitNumber(value) {
  return isNonNegativeNumber(value) && value <= 1;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function withoutSchemaVersion(keys) {
  return keys.filter((key) => key !== 'schemaVersion');
}

function createVersionedRecord(
  command,
  persistedKeys,
  normalizeRow,
  errorCode,
  schemaVersion = CLSE_RECORD_SCHEMA_VERSION,
) {
  if (!hasExactKeys(command, withoutSchemaVersion(persistedKeys))) {
    throw new Error(errorCode);
  }
  const record = normalizeRow({
    schemaVersion,
    ...command,
  });
  if (!record) throw new Error(errorCode);
  return record;
}

function normalizeNumericBucket(row, keys, durationMs) {
  if (
    !hasExactKeys(row, keys)
    || row.schemaVersion !== CLSE_RECORD_SCHEMA_VERSION
    || !isNonNegativeInteger(row.ts_start)
    || row.duration_ms !== durationMs
    || keys.some((key) => (
      key !== 'schemaVersion'
      && key !== 'ts_start'
      && key !== 'duration_ms'
      && !isNonNegativeNumber(row[key])
    ))
  ) return null;
  return { ...row };
}

export function normalizeClseBucket60sRow(row) {
  return normalizeNumericBucket(row, BUCKET_60S_KEYS, 60_000);
}

export function createClseBucket60sRecord(command) {
  return createVersionedRecord(
    command,
    BUCKET_60S_KEYS,
    normalizeClseBucket60sRow,
    'CLSE_STORE_BUCKET_60S_CONTRACT_INVALID',
  );
}

export function normalizeClseBucket5minRow(row) {
  return normalizeNumericBucket(row, BUCKET_5MIN_KEYS, 300_000);
}

export function createClseBucket5minRecord(command) {
  return createVersionedRecord(
    command,
    BUCKET_5MIN_KEYS,
    normalizeClseBucket5minRow,
    'CLSE_STORE_BUCKET_5MIN_CONTRACT_INVALID',
  );
}

export function normalizeClseLoopEventRow(row) {
  if (
    !hasExactKeys(row, LOOP_EVENT_KEYS)
    || row.schemaVersion !== CLSE_RECORD_SCHEMA_VERSION
    || !isPositiveInteger(row.ts)
    || row.event !== 'LOOP_DETECTED'
    || (row.type !== 'PAGE_LOOP_DETECTED' && row.type !== 'SITE_LOOP_DETECTED')
    || !isNonEmptyString(row.site_key)
    || !isPositiveInteger(row.repeat_count)
    || !isPositiveInteger(row.window_ms)
    || (row.type === 'PAGE_LOOP_DETECTED' && !isNonEmptyString(row.page_key))
    || (row.type === 'SITE_LOOP_DETECTED' && row.page_key !== null)
  ) return null;
  return { ...row };
}

export function createClseLoopEventRecord(command) {
  return createVersionedRecord(
    command,
    LOOP_EVENT_KEYS,
    normalizeClseLoopEventRow,
    'CLSE_STORE_LOOP_EVENT_CONTRACT_INVALID',
  );
}

export function normalizeClseAggressionLogRow(row) {
  const shape = isPlainObject(row) ? AGGRESSION_SHAPES[row.type] : null;
  const hasBoundedAdaptiveReference = row?.reference_mode
    === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE;
  if (
    !shape
    || !hasExactKeys(row, AGGRESSION_LOG_KEYS)
    || row.schemaVersion !== CLSE_AGGRESSION_LOG_SCHEMA_VERSION
    || !isPositiveInteger(row.ts)
    || !isPositiveInteger(row.bucket_ts)
    || row.ts < row.bucket_ts
    || !isUnitNumber(row.score)
    || !isUnitNumber(row.aggressive_score)
    || !isUnitNumber(row.meaningless_score)
    || !BASELINE_REFERENCE_MODE_VALUES.includes(row.reference_mode)
    || !BASELINE_STATUS_VALUES.includes(row.baseline_status)
    || row.baseline_grain !== CLSE_BASELINE_GRAINS.BUCKET_10S
    || !isPositiveInteger(row.baseline_reset_epoch)
    || row.bucket_ts < row.baseline_reset_epoch
    || (hasBoundedAdaptiveReference
      ? row.baseline_status !== PERSONAL_BASELINE_STATUSES.STABLE
      : row.baseline_status === PERSONAL_BASELINE_STATUSES.STABLE)
    || !hasExactKeys(row.metrics, shape.metrics)
    || !Object.values(row.metrics).every(isNonNegativeNumber)
    || !hasExactKeys(row.z_scores, shape.zScores)
    || !Object.values(row.z_scores).every((value) => (
      typeof value === 'number' && Number.isFinite(value)
    ))
    || (!hasBoundedAdaptiveReference && Object.values(row.z_scores).some((value) => value !== 0))
    || !hasExactKeys(row.gate, shape.gate)
    || row.gate.pass !== true
    || !shape.gate.filter((key) => key !== 'pass').every((key) => (
      isNonNegativeNumber(row.gate[key])
    ))
  ) return null;
  return {
    ...row,
    metrics: { ...row.metrics },
    z_scores: { ...row.z_scores },
    gate: { ...row.gate },
  };
}

export function createClseAggressionLogRecord(command) {
  return createVersionedRecord(
    command,
    AGGRESSION_LOG_KEYS,
    normalizeClseAggressionLogRow,
    'CLSE_STORE_AGGRESSION_LOG_CONTRACT_INVALID',
    CLSE_AGGRESSION_LOG_SCHEMA_VERSION,
  );
}

export function normalizeClseDailySummaryRow(row) {
  const dateStr = isPlainObject(row) ? normalizeDailySummaryDateStr(row.dateStr) : null;
  if (
    !hasExactKeys(row, DAILY_SUMMARY_KEYS)
    || row.schemaVersion !== CLSE_DAILY_SUMMARY_SCHEMA_VERSION
    || !dateStr
    || dateStr !== row.dateStr
    || row.source !== 'clse_rollup_v1'
    || !isNonNegativeInteger(row.bucket60sCount)
    || !isNonNegativeInteger(row.bucket5minCount)
    || !hasExactKeys(row.totals, DAILY_TOTAL_KEYS)
    || !Object.values(row.totals).every(isNonNegativeNumber)
    || !hasExactKeys(row.rates, DAILY_RATE_KEYS)
    || !Object.values(row.rates).every(isNonNegativeNumber)
    || !isPositiveInteger(row.updatedAt)
  ) return null;
  return {
    dateStr: row.dateStr,
    schemaVersion: CLSE_DAILY_SUMMARY_SCHEMA_VERSION,
    source: row.source,
    bucket60sCount: row.bucket60sCount,
    bucket5minCount: row.bucket5minCount,
    totals: { ...row.totals },
    rates: { ...row.rates },
    updatedAt: row.updatedAt,
  };
}
