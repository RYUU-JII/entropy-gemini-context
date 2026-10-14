export const FEED_CONTENT_FLOW_COUNT_FIELDS = Object.freeze([
  'feedPressureSignals',
  'feedInterruptSignals',
  'feedAdvanceBursts',
  'feedSkimSignals',
]);
export const FEED_CONTENT_FLOW_MAX_FIELDS = Object.freeze([
  'maxFeedScreenfuls',
  'maxFeedItemTransitions',
]);
export const FEED_CONTENT_FLOW_STAT_FIELDS = Object.freeze([
  ...FEED_CONTENT_FLOW_COUNT_FIELDS,
  ...FEED_CONTENT_FLOW_MAX_FIELDS,
]);
// Civil-hour identity can cover repeated clock time at a backward DST change.
// Stored rows must not be reinterpreted in the reader's current timezone; three
// hours bounds this interval while admitting repeated hours and half-hour shifts.
export const FEED_CONTENT_FLOW_MAX_CIVIL_HOUR_SPAN_MS = 3 * 60 * 60 * 1000;
const HISTORY_FIELDS = Object.freeze([
  'producerId', 'bucketStartTs', 'startedAt', 'observedAt', 'sequence', 'stats',
]);
const PRODUCER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FEED_CONTENT_FLOW_PROGRESS_FIELDS = Object.freeze([
  'advanceCount', 'screenfulsConsumed', 'itemTransitions', 'freshItemsSeen',
]);

function requireExactFields(value, fields, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== fields.length
    || fields.some((field) => !Object.hasOwn(value, field))) {
    throw new Error(errorCode);
  }
}

export function getFeedContentFlowHourStart(observedAt) {
  if (!Number.isSafeInteger(observedAt) || observedAt < 0) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_OBSERVED_AT_INVALID');
  }
  const hour = new Date(observedAt);
  hour.setMinutes(0, 0, 0);
  const bucketStartTs = hour.getTime();
  if (!Number.isSafeInteger(bucketStartTs)) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_HOUR_INVALID');
  }
  return bucketStartTs;
}

export function requireFeedContentFlowHistory(value, { validateLocalHour = true } = {}) {
  requireExactFields(value, HISTORY_FIELDS, 'FEED_CONTENT_FLOW_HISTORY_SHAPE_INVALID');
  if (typeof value.producerId !== 'string' || !PRODUCER_ID_PATTERN.test(value.producerId)) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_PRODUCER_ID_INVALID');
  }
  if (typeof validateLocalHour !== 'boolean') {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_LOCAL_HOUR_VALIDATION_INVALID');
  }
  if (!Number.isSafeInteger(value.bucketStartTs) || value.bucketStartTs < 0
    || !Number.isSafeInteger(value.observedAt) || value.observedAt < 0
    || value.observedAt < value.bucketStartTs
    || (!validateLocalHour
      && value.observedAt >= value.bucketStartTs + FEED_CONTENT_FLOW_MAX_CIVIL_HOUR_SPAN_MS)) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_HOUR_INVALID');
  }
  if (validateLocalHour && value.bucketStartTs !== getFeedContentFlowHourStart(value.observedAt)) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_HOUR_MISMATCH');
  }
  if (!Number.isSafeInteger(value.startedAt) || value.startedAt < value.bucketStartTs
    || value.startedAt > value.observedAt) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_STARTED_AT_INVALID');
  }
  if (!Number.isSafeInteger(value.sequence) || value.sequence <= 0) {
    throw new Error('FEED_CONTENT_FLOW_HISTORY_SEQUENCE_INVALID');
  }
  requireExactFields(value.stats, FEED_CONTENT_FLOW_STAT_FIELDS, 'FEED_CONTENT_FLOW_HISTORY_STATS_SHAPE_INVALID');
  const stats = {};
  FEED_CONTENT_FLOW_STAT_FIELDS.forEach((field) => {
    const count = value.stats[field];
    const valid = field === 'maxFeedScreenfuls'
      ? typeof count === 'number' && Number.isFinite(count)
      : Number.isSafeInteger(count);
    if (!valid || count < 0) {
      throw new Error(`FEED_CONTENT_FLOW_HISTORY_STAT_INVALID:${field}`);
    }
    stats[field] = count;
  });
  return {
    producerId: value.producerId,
    bucketStartTs: value.bucketStartTs,
    startedAt: value.startedAt,
    observedAt: value.observedAt,
    sequence: value.sequence,
    stats,
  };
}

export function createEmptyFeedContentFlowStats() {
  return Object.fromEntries(FEED_CONTENT_FLOW_STAT_FIELDS.map((field) => [field, 0]));
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function buildContentFlowStatsFromFeedSnapshot(snapshot = null) {
  const metrics = snapshot?.metrics || {};
  const screenfuls = nonNegative(metrics.screenfulsConsumed);
  const transitions = Math.floor(nonNegative(metrics.itemTransitions));
  const dwell = metrics.medianDwellMs == null ? null : nonNegative(metrics.medianDwellMs);
  const burst = nonNegative(metrics.advanceCount) >= 3 || screenfuls >= 3 || transitions >= 4;
  const skim = (dwell !== null && dwell <= 4500 && transitions >= 4)
    || (screenfuls >= 5 && nonNegative(metrics.freshItemsSeen) >= 6
      && nonNegative(metrics.maxPauseMs) <= 3000);
  return {
    // Detector outputs remain diagnostic counters, never observational evidence.
    feedPressureSignals: snapshot?.state === 'pressure' ? 1 : 0,
    feedInterruptSignals: snapshot?.state === 'interrupt' ? 1 : 0,
    feedAdvanceBursts: burst ? 1 : 0,
    feedSkimSignals: skim ? 1 : 0,
    maxFeedScreenfuls: screenfuls,
    maxFeedItemTransitions: transitions,
  };
}

export function buildContentFlowStatsFromFeedSnapshotDelta(delta) {
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
    throw new Error('BEHAVIOR_TELEMETRY_FEED_DELTA_REQUIRED');
  }
  if (!delta.snapshot || typeof delta.snapshot !== 'object' || Array.isArray(delta.snapshot)) {
    throw new Error('BEHAVIOR_TELEMETRY_FEED_DELTA_SNAPSHOT_REQUIRED');
  }
  const snapshot = delta.snapshot;
  const previous = delta.previousSnapshot;
  const metricsRegressed = previous && FEED_CONTENT_FLOW_PROGRESS_FIELDS.some((field) => (
    nonNegative(snapshot.metrics?.[field]) < nonNegative(previous.metrics?.[field])
  ));
  const currentStats = buildContentFlowStatsFromFeedSnapshot(snapshot);
  const previousStats = previous && !metricsRegressed
    ? buildContentFlowStatsFromFeedSnapshot(previous)
    : createEmptyFeedContentFlowStats();
  const result = createEmptyFeedContentFlowStats();
  FEED_CONTENT_FLOW_COUNT_FIELDS.forEach((field) => {
    result[field] = currentStats[field] > 0 && previousStats[field] === 0 ? 1 : 0;
  });
  FEED_CONTENT_FLOW_MAX_FIELDS.forEach((field) => {
    result[field] = currentStats[field] > previousStats[field] ? currentStats[field] : 0;
  });
  return result;
}
