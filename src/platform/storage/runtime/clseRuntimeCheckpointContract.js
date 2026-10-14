import { isPlainObject } from '../internal/storageValueUtils.js';

export const CLSE_RUNTIME_CHECKPOINT_SCHEMA_VERSION = 1;

const CHECKPOINT_KEYS = Object.freeze([
  'schemaVersion',
  'updatedAt',
  'ringBuffer',
  'activity',
  'loopDetector',
  'timestamps',
]);
const RING_BUFFER_KEYS = Object.freeze([
  'size',
  'buckets',
  'currentBucket',
  'bucketStartTime',
]);
const ACTIVITY_KEYS = Object.freeze(['isActive', 'lastStateChange']);
const LOOP_DETECTOR_KEYS = Object.freeze([
  'recentPageVisits',
  'recentSiteVisits',
  'lastPageAlert',
  'lastSiteAlert',
]);
const TIMESTAMP_KEYS = Object.freeze([
  'lastSpikeAnalyzedTs',
  'lastRollup60sTs',
  'lastRollup5minTs',
  'lastPruneDayStart',
  'lastAggressionLoggedTs',
]);
const BUCKET_KEYS = Object.freeze([
  'ts_start',
  'duration_ms',
  'active_ms',
  'idle_ms',
  'tab_switch_count',
  'tab_open_count',
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
  'scroll_n',
  'content_add_count',
  'feed_item_add_count',
  'short_dwell_count',
  'media_seek_count',
  'media_rate_change_count',
  'media_pause_play_count',
]);
const BUCKET_SIZE_MS = 10_000;

function invalidCheckpoint(field) {
  throw new Error(`CLSE_RUNTIME_CHECKPOINT_INVALID:${field}`);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
}

function isCanonicalTimestamp(value, { nullable = false } = {}) {
  return (nullable && value === null)
    || (Number.isSafeInteger(value) && value >= 0);
}

function requireBucket(bucket, field) {
  if (!hasExactKeys(bucket, BUCKET_KEYS)) invalidCheckpoint(`${field}.keys`);
  if (!isCanonicalTimestamp(bucket.ts_start) || bucket.ts_start % BUCKET_SIZE_MS !== 0) {
    invalidCheckpoint(`${field}.ts_start`);
  }
  if (bucket.duration_ms !== BUCKET_SIZE_MS) invalidCheckpoint(`${field}.duration_ms`);
  for (const numericField of BUCKET_KEYS.slice(2)) {
    if (typeof bucket[numericField] !== 'number' || !Number.isFinite(bucket[numericField]) || bucket[numericField] < 0) {
      invalidCheckpoint(`${field}.${numericField}`);
    }
  }
  return bucket;
}

function requireVisitEntries(entries, field) {
  if (!Array.isArray(entries)) invalidCheckpoint(field);
  const keys = new Set();
  entries.forEach((entry, entryIndex) => {
    if (
      !Array.isArray(entry)
      || entry.length !== 2
      || typeof entry[0] !== 'string'
      || !entry[0]
      || entry[0].trim() !== entry[0]
      || !Array.isArray(entry[1])
      || entry[1].some((timestamp) => !isCanonicalTimestamp(timestamp))
      || keys.has(entry[0])
    ) {
      invalidCheckpoint(`${field}.${entryIndex}`);
    }
    keys.add(entry[0]);
  });
  return entries;
}

function requireAlertEntries(entries, field) {
  if (!Array.isArray(entries)) invalidCheckpoint(field);
  const keys = new Set();
  entries.forEach((entry, entryIndex) => {
    if (
      !Array.isArray(entry)
      || entry.length !== 2
      || typeof entry[0] !== 'string'
      || !entry[0]
      || entry[0].trim() !== entry[0]
      || !isCanonicalTimestamp(entry[1])
      || keys.has(entry[0])
    ) {
      invalidCheckpoint(`${field}.${entryIndex}`);
    }
    keys.add(entry[0]);
  });
  return entries;
}

export function assertValidClseRuntimeCheckpointRecord(record) {
  if (!hasExactKeys(record, CHECKPOINT_KEYS)) invalidCheckpoint('record_keys');
  if (record.schemaVersion !== CLSE_RUNTIME_CHECKPOINT_SCHEMA_VERSION) {
    invalidCheckpoint('schemaVersion');
  }
  if (!isCanonicalTimestamp(record.updatedAt)) {
    invalidCheckpoint('updatedAt');
  }
  if (!hasExactKeys(record.ringBuffer, RING_BUFFER_KEYS)) {
    invalidCheckpoint('ringBuffer.keys');
  }
  if (!Number.isSafeInteger(record.ringBuffer.size) || record.ringBuffer.size < 1 || record.ringBuffer.size > 360) {
    invalidCheckpoint('ringBuffer.size');
  }
  if (!Array.isArray(record.ringBuffer.buckets) || record.ringBuffer.buckets.length > record.ringBuffer.size) {
    invalidCheckpoint('ringBuffer.buckets');
  }
  record.ringBuffer.buckets.forEach((bucket, index) => requireBucket(bucket, `ringBuffer.buckets.${index}`));
  if (record.ringBuffer.currentBucket !== null) {
    requireBucket(record.ringBuffer.currentBucket, 'ringBuffer.currentBucket');
  }
  if (!isCanonicalTimestamp(record.ringBuffer.bucketStartTime)) {
    invalidCheckpoint('ringBuffer.bucketStartTime');
  }
  if (
    (record.ringBuffer.currentBucket === null && record.ringBuffer.bucketStartTime !== 0)
    || (
      record.ringBuffer.currentBucket !== null
      && record.ringBuffer.currentBucket.ts_start !== record.ringBuffer.bucketStartTime
    )
  ) {
    invalidCheckpoint('ringBuffer.currentBucket_state');
  }
  if (
    !hasExactKeys(record.activity, ACTIVITY_KEYS)
    || typeof record.activity.isActive !== 'boolean'
    || !isCanonicalTimestamp(record.activity.lastStateChange)
  ) {
    invalidCheckpoint('activity');
  }
  if (!hasExactKeys(record.loopDetector, LOOP_DETECTOR_KEYS)) {
    invalidCheckpoint('loopDetector.keys');
  }
  requireVisitEntries(record.loopDetector.recentPageVisits, 'loopDetector.recentPageVisits');
  requireVisitEntries(record.loopDetector.recentSiteVisits, 'loopDetector.recentSiteVisits');
  requireAlertEntries(record.loopDetector.lastPageAlert, 'loopDetector.lastPageAlert');
  requireAlertEntries(record.loopDetector.lastSiteAlert, 'loopDetector.lastSiteAlert');
  if (!hasExactKeys(record.timestamps, TIMESTAMP_KEYS)) {
    invalidCheckpoint('timestamps.keys');
  }
  for (const timestampField of TIMESTAMP_KEYS) {
    if (!isCanonicalTimestamp(record.timestamps[timestampField], { nullable: true })) {
      invalidCheckpoint(`timestamps.${timestampField}`);
    }
  }
  return true;
}

export function createClseRuntimeCheckpointRecord(input = {}) {
  if (!isPlainObject(input)) invalidCheckpoint('create_input');
  const allowedInputKeys = new Set([...CHECKPOINT_KEYS]);
  const unexpectedInputKey = Object.keys(input).find((key) => !allowedInputKeys.has(key));
  if (unexpectedInputKey) invalidCheckpoint(`create_input.${unexpectedInputKey}`);

  const {
    ringBuffer,
    activity,
    loopDetector,
    timestamps,
    schemaVersion = CLSE_RUNTIME_CHECKPOINT_SCHEMA_VERSION,
    updatedAt = Date.now(),
  } = input;
  if (
    !isPlainObject(ringBuffer)
    || !isPlainObject(activity)
    || !isPlainObject(loopDetector)
    || !isPlainObject(timestamps)
  ) {
    invalidCheckpoint('create_input');
  }
  const record = {
    schemaVersion,
    updatedAt,
    ringBuffer: {
      size: ringBuffer.size,
      buckets: ringBuffer.buckets,
      currentBucket: ringBuffer.currentBucket,
      bucketStartTime: ringBuffer.bucketStartTime,
    },
    activity: {
      isActive: activity.isActive,
      lastStateChange: activity.lastStateChange,
    },
    loopDetector: {
      recentPageVisits: loopDetector.recentPageVisits,
      recentSiteVisits: loopDetector.recentSiteVisits,
      lastPageAlert: loopDetector.lastPageAlert,
      lastSiteAlert: loopDetector.lastSiteAlert,
    },
    timestamps: {
      lastSpikeAnalyzedTs: timestamps.lastSpikeAnalyzedTs,
      lastRollup60sTs: timestamps.lastRollup60sTs,
      lastRollup5minTs: timestamps.lastRollup5minTs,
      lastPruneDayStart: timestamps.lastPruneDayStart,
      lastAggressionLoggedTs: timestamps.lastAggressionLoggedTs,
    },
  };

  assertValidClseRuntimeCheckpointRecord(record);
  return record;
}

export function toClseRuntimeCheckpointValue(record) {
  assertValidClseRuntimeCheckpointRecord(record);
  return Object.freeze({
    schemaVersion: record.schemaVersion,
    updatedAt: record.updatedAt,
    ringBuffer: Object.freeze({
      size: record.ringBuffer.size,
      buckets: Object.freeze(record.ringBuffer.buckets.map((bucket) => Object.freeze({ ...bucket }))),
      currentBucket: record.ringBuffer.currentBucket ? Object.freeze({ ...record.ringBuffer.currentBucket }) : null,
      bucketStartTime: record.ringBuffer.bucketStartTime,
    }),
    activity: Object.freeze({
      isActive: record.activity.isActive,
      lastStateChange: record.activity.lastStateChange,
    }),
    loopDetector: Object.freeze({
      recentPageVisits: Object.freeze(record.loopDetector.recentPageVisits.map(([key, timestamps]) => (
        Object.freeze([key, Object.freeze([...timestamps])])
      ))),
      recentSiteVisits: Object.freeze(record.loopDetector.recentSiteVisits.map(([key, timestamps]) => (
        Object.freeze([key, Object.freeze([...timestamps])])
      ))),
      lastPageAlert: Object.freeze(record.loopDetector.lastPageAlert.map((entry) => Object.freeze([...entry]))),
      lastSiteAlert: Object.freeze(record.loopDetector.lastSiteAlert.map((entry) => Object.freeze([...entry]))),
    }),
    timestamps: Object.freeze({
      lastSpikeAnalyzedTs: record.timestamps.lastSpikeAnalyzedTs,
      lastRollup60sTs: record.timestamps.lastRollup60sTs,
      lastRollup5minTs: record.timestamps.lastRollup5minTs,
      lastPruneDayStart: record.timestamps.lastPruneDayStart,
      lastAggressionLoggedTs: record.timestamps.lastAggressionLoggedTs,
    }),
  });
}
