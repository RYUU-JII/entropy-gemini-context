import { requireInterventionHistoryReceipts, assertInterventionHistoryReceiptsCovered } from '../../../../domains/stats/contracts/interventionHistoryReceipt.js';
import {
  STATS_CATEGORY_IDS,
  STATS_SCHEMA_VERSION,
  STATS_HOURLY_CURSOR_CHECKPOINT_VERSION,
  STATS_REENTRY_GAP_BUCKET_KEYS,
  STATS_SWITCH_KEYS,
  deriveStatsHourlyBucketUtcOffsetMinutes,
  isStatsHourlyBucketIdentityValid,
  normalizeStatsDateStr,
  normalizeStatsDomainKey,
  normalizeStatsTransitionEdgeDeltas,
  normalizeStatsUtcOffsetMinutes,
  requireStatsSessionCommitCursor,
  resolveStatsHourlyBucketStartTs,
} from '../../../../domains/stats/contracts/statsContracts.js';
import { requireFeedHistoryReceipts, requireFeedHistoryResetAt } from '../../../../domains/stats/contracts/feedContentFlowReceipt.js';
import { assertFeedHistoryReceiptsCovered } from '../../../../domains/stats/contracts/feedContentFlowReceiptIntegrity.js';
import { requireActiveUsageIntervals, ACTIVE_USAGE_INTERVALS_PER_HOUR } from '../../../../domains/stats/contracts/activeUsageIntervals.js';

export {
  deriveStatsHourlyBucketUtcOffsetMinutes,
  isStatsHourlyBucketIdentityValid,
  resolveStatsHourlyBucketStartTs,
};

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const STATS_HOURLY_BUCKET_KEYS = Object.freeze([
  'bucketStartTs',
  'bucketUtcOffsetMinutes',
  'dateStr',
  'hour',
  'totalsDelta',
  'byCategoryDelta',
  'sessionsDelta',
  'switchesDelta',
  'transitionEdgesDelta',
  'domainsDelta',
  'cursorCheckpointVersion',
  'schemaVersion',
  'status',
  'sealedAt',
  'updatedAt',
]);

const STATS_HOURLY_TOTAL_DELTA_KEYS = Object.freeze([
  'totalActive',
  'totalBackground',
  'blockedActive',
  'blockedBackground',
]);

const STATS_HOURLY_CATEGORY_DELTA_KEYS = Object.freeze([
  'active',
  'background',
]);

const STATS_HOURLY_DOMAIN_DELTA_KEYS = Object.freeze([
  'active',
  'protectedActive',
  'background',
  'totalMs',
  'visits',
  'committedThroughAt',
  'activeCommittedThroughAt',
  'collection',
  'sessions',
  'behavior',
  'interventions',
  'navigation',
]);

const STATS_HOURLY_DOMAIN_COLLECTION_KEYS = Object.freeze([
  'firstCapturedAt',
  'lastCapturedAt',
  'dataCollectionMode',
  'precisionInsightsMode',
]);

const STATS_HOURLY_DOMAIN_SESSION_KEYS = Object.freeze([
  'count',
  'totalMs',
  'shortCount',
  'longCount',
  'maxMs',
]);

const STATS_HOURLY_DOMAIN_BEHAVIOR_NUMBER_KEYS = Object.freeze([
  'backgroundMediaMs',
  'backgroundLingerMs',
  'staleTabMs',
  'shortMediaWatchMs',
  'maxFeedScreenfuls',
  'lastVisitAt',
  'lastEntryAt',
  'lastExitAt',
  'lastTabContextAt',
  'lastContentFlowAt',
]);

const STATS_HOURLY_DOMAIN_BEHAVIOR_COUNT_KEYS = Object.freeze([
  'revisitWithin2m',
  'revisitWithin5m',
  'revisitWithin10m',
  'switchIns',
  'switchOuts',
  'switchBackWithin10m',
  'newTabEntrances',
  'duplicateTabEntrances',
  'highOpenTabEntrances',
  'maxSameDomainOpenTabs',
  'maxOpenTabs',
  'scrollSpikeBursts',
  'fastScrollBursts',
  'feedPressureSignals',
  'feedInterruptSignals',
  'feedAdvanceBursts',
  'feedSkimSignals',
  'shortMediaAttentionSignals',
  'maxFeedItemTransitions',
]);

const STATS_HOURLY_DOMAIN_BEHAVIOR_KEYS = Object.freeze([
  ...STATS_HOURLY_DOMAIN_BEHAVIOR_NUMBER_KEYS,
  ...STATS_HOURLY_DOMAIN_BEHAVIOR_COUNT_KEYS,
  'reentryGapBuckets',
]);

const STATS_HOURLY_DOMAIN_INTERVENTION_COUNT_KEYS = Object.freeze([
  'frictionShown',
  'continued',
  'left',
  'reenteredWithin5m',
  'reenteredWithin30m',
  'escapeClosed',
]);

const STATS_HOURLY_DOMAIN_INTERVENTION_TIMESTAMP_KEYS = Object.freeze([
  'lastShownAt',
  'lastContinuedAt',
  'lastLeftAt',
  'lastReenteredAt',
]);

const STATS_HOURLY_DOMAIN_INTERVENTION_KEYS = Object.freeze([
  ...STATS_HOURLY_DOMAIN_INTERVENTION_COUNT_KEYS,
  ...STATS_HOURLY_DOMAIN_INTERVENTION_TIMESTAMP_KEYS,
]);

const STATS_HOURLY_DOMAIN_NAVIGATION_COUNT_KEYS = Object.freeze([
  'total',
  'link',
  'typed',
  'reload',
  'generated',
  'keyword',
  'formSubmit',
  'startPage',
  'autoBookmark',
  'other',
  'addressBar',
  'forwardBack',
]);

const STATS_HOURLY_DOMAIN_NAVIGATION_KEYS = Object.freeze([
  ...STATS_HOURLY_DOMAIN_NAVIGATION_COUNT_KEYS,
  'lastNavigationAt',
]);

function hasExactOwnKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => hasOwn(value, key));
}

function isNonNegativeFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasValidFields(value, keys, predicate) {
  return keys.every((key) => predicate(value[key]));
}

function isReadableStatsHourlyTotalsDelta(delta) {
  return hasExactOwnKeys(delta, STATS_HOURLY_TOTAL_DELTA_KEYS)
    && hasValidFields(delta, STATS_HOURLY_TOTAL_DELTA_KEYS, isNonNegativeFiniteNumber);
}

function isReadableStatsHourlyCategoryDeltas(deltas) {
  return hasExactOwnKeys(deltas, STATS_CATEGORY_IDS)
    && STATS_CATEGORY_IDS.every((categoryId) => {
      const delta = deltas[categoryId];
      return hasExactOwnKeys(delta, STATS_HOURLY_CATEGORY_DELTA_KEYS)
        && hasValidFields(
          delta,
          STATS_HOURLY_CATEGORY_DELTA_KEYS,
          isNonNegativeFiniteNumber,
        );
    });
}

function isReadableStatsHourlySwitchDeltas(deltas) {
  return hasExactOwnKeys(deltas, STATS_SWITCH_KEYS)
    && hasValidFields(deltas, STATS_SWITCH_KEYS, isNonNegativeSafeInteger);
}

function isReadableStatsHourlyDomainCollection(collection) {
  if (collection === null) return true;
  if (!hasExactOwnKeys(collection, STATS_HOURLY_DOMAIN_COLLECTION_KEYS)) return false;
  const isCanonicalMode = (value) => value === null || (
    typeof value === 'string'
    && value.length > 0
    && value.trim() === value
  );
  return isNonNegativeFiniteNumber(collection.firstCapturedAt)
    && isNonNegativeFiniteNumber(collection.lastCapturedAt)
    && collection.lastCapturedAt >= collection.firstCapturedAt
    && isCanonicalMode(collection.dataCollectionMode)
    && isCanonicalMode(collection.precisionInsightsMode);
}

function isReadableStatsHourlyDomainSessions(sessions) {
  return hasExactOwnKeys(sessions, STATS_HOURLY_DOMAIN_SESSION_KEYS)
    && hasValidFields(sessions, ['count', 'shortCount', 'longCount'], isNonNegativeSafeInteger)
    && hasValidFields(sessions, ['totalMs', 'maxMs'], isNonNegativeFiniteNumber);
}

function isReadableStatsHourlyDomainBehavior(behavior) {
  return hasExactOwnKeys(behavior, STATS_HOURLY_DOMAIN_BEHAVIOR_KEYS)
    && hasValidFields(
      behavior,
      STATS_HOURLY_DOMAIN_BEHAVIOR_NUMBER_KEYS,
      isNonNegativeFiniteNumber,
    )
    && hasValidFields(
      behavior,
      STATS_HOURLY_DOMAIN_BEHAVIOR_COUNT_KEYS,
      isNonNegativeSafeInteger,
    )
    && hasExactOwnKeys(behavior.reentryGapBuckets, STATS_REENTRY_GAP_BUCKET_KEYS)
    && hasValidFields(
      behavior.reentryGapBuckets,
      STATS_REENTRY_GAP_BUCKET_KEYS,
      isNonNegativeSafeInteger,
    );
}

function isReadableStatsHourlyDomainInterventions(interventions) {
  return hasExactOwnKeys(interventions, STATS_HOURLY_DOMAIN_INTERVENTION_KEYS)
    && hasValidFields(
      interventions,
      STATS_HOURLY_DOMAIN_INTERVENTION_COUNT_KEYS,
      isNonNegativeSafeInteger,
    )
    && hasValidFields(
      interventions,
      STATS_HOURLY_DOMAIN_INTERVENTION_TIMESTAMP_KEYS,
      isNonNegativeFiniteNumber,
    );
}

function isReadableStatsHourlyDomainNavigation(navigation) {
  return hasExactOwnKeys(navigation, STATS_HOURLY_DOMAIN_NAVIGATION_KEYS)
    && hasValidFields(
      navigation,
      STATS_HOURLY_DOMAIN_NAVIGATION_COUNT_KEYS,
      isNonNegativeSafeInteger,
    )
    && isNonNegativeFiniteNumber(navigation.lastNavigationAt);
}

function isReadableStatsHourlyDomainDelta(delta) {
  const isNullableTimestamp = (value) => value === null || isNonNegativeFiniteNumber(value);
  const hasIntervals = isPlainObject(delta) && hasOwn(delta, 'activeUsageIntervals');
  if (hasIntervals) {
    const intervals = requireActiveUsageIntervals(delta.activeUsageIntervals);
    if (intervals.length > ACTIVE_USAGE_INTERVALS_PER_HOUR
      || intervals.reduce((sum,[a,b])=>sum+b-a,0) > delta.active + 0.001) return false;
  }
  return hasExactOwnKeys(delta, hasIntervals ? [...STATS_HOURLY_DOMAIN_DELTA_KEYS, 'activeUsageIntervals'] : STATS_HOURLY_DOMAIN_DELTA_KEYS)
    && hasValidFields(delta, ['active', 'protectedActive', 'background', 'totalMs'], isNonNegativeFiniteNumber)
    && delta.protectedActive <= delta.active + 0.001
    && isNonNegativeSafeInteger(delta.visits)
    && isNullableTimestamp(delta.committedThroughAt)
    && isNullableTimestamp(delta.activeCommittedThroughAt)
    && isReadableStatsHourlyDomainCollection(delta.collection)
    && isReadableStatsHourlyDomainSessions(delta.sessions)
    && isReadableStatsHourlyDomainBehavior(delta.behavior)
    && isReadableStatsHourlyDomainInterventions(delta.interventions)
    && isReadableStatsHourlyDomainNavigation(delta.navigation);
}

function isReadableStatsHourlySessionDelta(delta) {
  if (
    !isPlainObject(delta)
    || Object.keys(delta).length !== 3
    || !hasOwn(delta, 'count')
    || !hasOwn(delta, 'totalMs')
    || !hasOwn(delta, 'lastCommit')
    || !Number.isSafeInteger(delta.count)
    || delta.count < 0
    || !Number.isFinite(delta.totalMs)
    || delta.totalMs < 0
  ) return false;
  try {
    requireStatsSessionCommitCursor(delta.lastCommit);
    return true;
  } catch (_error) {
    return false;
  }
}

export function toFiniteTimestamp(value) {
  if (value === null || typeof value === 'undefined' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildTimestampRange(startTs, endTs) {
  const start = toFiniteTimestamp(startTs);
  const end = toFiniteTimestamp(endTs);
  if (start !== null && end !== null) return IDBKeyRange.bound(start, end);
  if (start !== null) return IDBKeyRange.lowerBound(start);
  if (end !== null) return IDBKeyRange.upperBound(end);
  return null;
}

export function normalizeDailySummaryDateStr(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const normalized = normalizeStatsDateStr(trimmed, null);
  return normalized === trimmed ? normalized : null;
}

export function normalizeStatsHour(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  const hour = numeric;
  if (hour < 0 || hour > 23) return null;
  return hour;
}

export function normalizeStatsHourlyBucketStatus(value) {
  if (value === 'open') return 'open';
  if (value === 'sealed') return 'sealed';
  return null;
}

export function normalizeStatsHourlyBucketReadRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const actualKeys = Object.keys(row);
  if (
    actualKeys.length !== STATS_HOURLY_BUCKET_KEYS.length
      + (hasOwn(row, 'feedHistoryReceipts') ? 1 : 0) + (hasOwn(row, 'feedHistoryResetAt') ? 1 : 0)
      + (hasOwn(row, 'interventionHistoryReceipts') ? 1 : 0)
    || STATS_HOURLY_BUCKET_KEYS.some((key) => !hasOwn(row, key))
  ) return null;
  const dateStr = normalizeDailySummaryDateStr(row.dateStr);
  const hour = normalizeStatsHour(row.hour);
  const bucketStartTs = toFiniteTimestamp(row.bucketStartTs);
  const bucketUtcOffsetMinutes = normalizeStatsUtcOffsetMinutes(row.bucketUtcOffsetMinutes);
  const status = normalizeStatsHourlyBucketStatus(row.status);
  const updatedAt = toFiniteTimestamp(row.updatedAt);
  const sealedAt = toFiniteTimestamp(row.sealedAt);
  let transitionEdgesDelta = null;
  let feedHistoryReceipts;
  let interventionHistoryReceipts;
  try {
    transitionEdgesDelta = normalizeStatsTransitionEdgeDeltas(row.transitionEdgesDelta);
    if (hasOwn(row, 'interventionHistoryReceipts')) {
      interventionHistoryReceipts = requireInterventionHistoryReceipts(row.interventionHistoryReceipts, { bucketStartTs: row.bucketStartTs, dateStr: row.dateStr });
      assertInterventionHistoryReceiptsCovered(interventionHistoryReceipts, row.domainsDelta);
    }
    if (hasOwn(row, 'feedHistoryReceipts')) {
      feedHistoryReceipts = requireFeedHistoryReceipts(row.feedHistoryReceipts, { bucketStartTs: row.bucketStartTs });
      assertFeedHistoryReceiptsCovered(feedHistoryReceipts, row.domainsDelta);
    }
    if (hasOwn(row, 'feedHistoryResetAt')) {
      requireFeedHistoryResetAt(row.feedHistoryResetAt, { bucketStartTs: row.bucketStartTs });
      if (feedHistoryReceipts?.some((receipt) => receipt.startedAt <= row.feedHistoryResetAt)) return null;
    }
  } catch (_error) {
    return null;
  }
  if (
    !dateStr
    || dateStr !== row.dateStr
    || hour === null
    || hour !== row.hour
    || bucketStartTs === null
    || bucketStartTs !== row.bucketStartTs
    || !hasOwn(row, 'bucketUtcOffsetMinutes')
    || bucketUtcOffsetMinutes === null
    || bucketUtcOffsetMinutes !== row.bucketUtcOffsetMinutes
    || !isStatsHourlyBucketIdentityValid({
      dateStr,
      hour,
      bucketStartTs,
      bucketUtcOffsetMinutes,
    })
    || !status
    || !isReadableStatsHourlyTotalsDelta(row.totalsDelta)
    || !isReadableStatsHourlyCategoryDeltas(row.byCategoryDelta)
    || !isReadableStatsHourlySessionDelta(row.sessionsDelta)
    || !isReadableStatsHourlySwitchDeltas(row.switchesDelta)
    || !transitionEdgesDelta
    || !isPlainObject(row.domainsDelta)
    || row.schemaVersion !== STATS_SCHEMA_VERSION
    || row.cursorCheckpointVersion !== STATS_HOURLY_CURSOR_CHECKPOINT_VERSION
    || updatedAt === null
    || updatedAt !== row.updatedAt
    || updatedAt < 0
    || (status === 'sealed'
      ? sealedAt === null || sealedAt !== row.sealedAt || sealedAt < 0
      : row.sealedAt !== null)
    || !Object.entries(row.domainsDelta).every(([domain, delta]) => (
      normalizeStatsDomainKey(domain) === domain
      && isReadableStatsHourlyDomainDelta(delta)
      && (!hasOwn(delta,'activeUsageIntervals') || delta.activeUsageIntervals.every(([start,end]) => start>=bucketStartTs && end<=bucketStartTs+3600000))
    ))
  ) return null;
  return {
    ...row,
    dateStr,
    hour,
    bucketStartTs,
    bucketUtcOffsetMinutes,
    status,
    sealedAt,
    updatedAt,
    transitionEdgesDelta,
    ...(feedHistoryReceipts ? { feedHistoryReceipts } : {}),
    ...(interventionHistoryReceipts ? { interventionHistoryReceipts } : {}),
  };
}

export function filterStatsHourlyBucketRowsForRead(
  rows = [],
  {
    dateStr,
    startHour = null,
    endHour = null,
  } = {},
) {
  const normalizedDateStr = normalizeDailySummaryDateStr(dateStr);
  if (!normalizedDateStr) return [];

  const normalizedStartHour = normalizeStatsHour(startHour);
  const normalizedEndHour = normalizeStatsHour(endHour);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeStatsHourlyBucketReadRow(row))
    .filter((row) => {
      if (!row || row.dateStr !== normalizedDateStr) return false;
      if (normalizedStartHour !== null && row.hour < normalizedStartHour) return false;
      if (normalizedEndHour !== null && row.hour > normalizedEndHour) return false;
      return true;
    })
    .sort((a, b) => {
      const hourDiff = a.hour - b.hour;
      if (hourDiff !== 0) return hourDiff;
      return a.bucketStartTs - b.bucketStartTs;
    });
}

export function filterStatsHourlyBucketRowsForDateRangeRead(
  rows = [],
  {
    startDateStr,
    endDateStr,
  } = {},
) {
  const normalizedStartDateStr = normalizeDailySummaryDateStr(startDateStr);
  const normalizedEndDateStr = normalizeDailySummaryDateStr(endDateStr);
  if (!normalizedStartDateStr || !normalizedEndDateStr) return [];

  const [rangeStartDateStr, rangeEndDateStr] = normalizedStartDateStr <= normalizedEndDateStr
    ? [normalizedStartDateStr, normalizedEndDateStr]
    : [normalizedEndDateStr, normalizedStartDateStr];

  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeStatsHourlyBucketReadRow(row))
    .filter((row) => (
      row
      && row.dateStr >= rangeStartDateStr
      && row.dateStr <= rangeEndDateStr
    ))
    .sort((left, right) => {
      const dateDiff = left.dateStr.localeCompare(right.dateStr);
      if (dateDiff !== 0) return dateDiff;
      const hourDiff = left.hour - right.hour;
      if (hourDiff !== 0) return hourDiff;
      return left.bucketStartTs - right.bucketStartTs;
    });
}

export function resolveStatsHourlyBucketDateRangeReadRequest({
  startDateStr,
  endDateStr,
} = {}) {
  const normalizedStartDateStr = normalizeDailySummaryDateStr(startDateStr);
  const normalizedEndDateStr = normalizeDailySummaryDateStr(endDateStr);
  if (!normalizedStartDateStr || !normalizedEndDateStr) return null;

  const [rangeStartDateStr, rangeEndDateStr] = normalizedStartDateStr <= normalizedEndDateStr
    ? [normalizedStartDateStr, normalizedEndDateStr]
    : [normalizedEndDateStr, normalizedStartDateStr];

  return {
    startDateStr: rangeStartDateStr,
    endDateStr: rangeEndDateStr,
    indexName: 'dateHour',
    lowerBound: [rangeStartDateStr, 0],
    upperBound: [rangeEndDateStr, 23],
    readStrategy: 'dateHour_index_date_range',
  };
}

export function resolveStatsHourlyBucketReadRequest({
  dateStr,
  startHour = null,
  endHour = null,
} = {}) {
  const normalizedDateStr = normalizeDailySummaryDateStr(dateStr);
  if (!normalizedDateStr) return null;

  const normalizedStartHour = normalizeStatsHour(startHour);
  const normalizedEndHour = normalizeStatsHour(endHour);
  if (normalizedStartHour !== null && normalizedEndHour !== null && normalizedStartHour > normalizedEndHour) {
    return {
      dateStr: normalizedDateStr,
      empty: true,
      indexName: 'dateHour',
      readStrategy: 'dateHour_empty_range',
      startHour: normalizedStartHour,
      endHour: normalizedEndHour,
    };
  }

  if (normalizedStartHour === null && normalizedEndHour === null) {
    return {
      dateStr: normalizedDateStr,
      empty: false,
      indexName: 'dateStr',
      key: normalizedDateStr,
      readStrategy: 'dateStr_index',
      startHour: null,
      endHour: null,
    };
  }

  const lowerHour = normalizedStartHour ?? 0;
  const upperHour = normalizedEndHour ?? 23;
  return {
    dateStr: normalizedDateStr,
    empty: false,
    indexName: 'dateHour',
    lowerBound: [normalizedDateStr, lowerHour],
    upperBound: [normalizedDateStr, upperHour],
    readStrategy: 'dateHour_index_range',
    startHour: normalizedStartHour,
    endHour: normalizedEndHour,
  };
}

export function normalizeStatsTransitionDomain(value) {
  return normalizeStatsDomainKey(value);
}
