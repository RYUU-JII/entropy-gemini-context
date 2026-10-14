import { clipActiveUsageIntervals, requireActiveUsageIntervals } from '../../contracts/activeUsageIntervals.js';
import {
  STATS_CATEGORY_IDS,
  STATS_HOURLY_CURSOR_CHECKPOINT_VERSION,
  STATS_HOURLY_BUCKETS,
  STATS_REENTRY_GAP_BUCKET_KEYS,
  STATS_SCHEMA_VERSION,
  createEmptyDomainStats,
  STATS_SWITCH_KEYS,
  createEmptyCategoryTotals,
  createEmptyStatsDay,
  deriveStatsHourlyBucketUtcOffsetMinutes,
  isStatsHourlyBucketIdentityValid,
  normalizeStatsDateStr,
  normalizeStatsDay,
  normalizeStatsTransitionEdgeDeltas,
  requireStatsSessionCommitCursor,
  requireStatsProtectedActive,
  resolveStatsHourlyBucketStartTs,
} from '../../contracts/statsContracts.js';
import {
  registerPreparedStatsHourlyBucket,
} from '../../contracts/statsPreparedHourlyBucketRegistry.js';
import { requireFeedHistoryReceipts, requireFeedHistoryResetAt } from '../../contracts/feedContentFlowReceipt.js';
import { requireInterventionHistoryReceipts } from '../../contracts/interventionHistoryReceipt.js';
import {
  registerPreparedStatsDayScaffoldGraph,
} from '../aggregation/statsAggregateScaffold.js';

export const STATS_HOURLY_BUCKET_STATUS = Object.freeze({
  OPEN: 'open',
  SEALED: 'sealed',
});

// Runtime days are normalized once when they cross the repository boundary.
// Keeping the marker out-of-band avoids adding non-canonical fields to StatsDay
// while letting the hot hourly writer skip a full deep normalization per event.
const preparedStatsDays = new WeakSet();

function registerPreparedStatsDay(dayData) {
  registerPreparedStatsDayScaffoldGraph(dayData);
  preparedStatsDays.add(dayData);
  return dayData;
}

export function prepareStatsDayForHourlyMaterialization(dayData, {
  now = Date.now(),
  materializationMetrics = null,
} = {}) {
  if (isPlainObject(dayData) && preparedStatsDays.has(dayData)) return dayData;
  const normalizedDay = normalizeStatsDay(dayData, { now });
  registerPreparedStatsDay(normalizedDay);
  if (materializationMetrics && typeof materializationMetrics === 'object') {
    materializationMetrics.dayNormalizations = toSafeCount(
      materializationMetrics.dayNormalizations,
      0,
    ) + 1;
  }
  return normalizedDay;
}

function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toSafeCount(value, fallback = 0) {
  return Math.max(0, Math.floor(toSafeNumber(value, fallback)));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toOptionalTimestamp(value) {
  if (value === null || typeof value === 'undefined' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
}

function isTimestampInBucket(timestamp, dateStr, hour) {
  const value = toOptionalTimestamp(timestamp);
  if (value === null) return false;
  const date = new Date(value);
  const [year, month, day] = dateStr.split('-').map(Number);
  const isInsideBucket = date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour;
  if (isInsideBucket) return true;
  if (hour !== 23) return false;
  return value === new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();
}

function isCommitCursorInBucket(timestamp, dateStr, hour) {
  const value = toOptionalTimestamp(timestamp);
  if (value === null) return false;
  if (isTimestampInBucket(value, dateStr, hour)) return true;
  const [year, month, day] = dateStr.split('-').map(Number);
  return value === new Date(year, month - 1, day, hour + 1, 0, 0, 0).getTime();
}

function buildDomainCollectionCheckpoint(rawCollection, dateStr, hour) {
  if (!isPlainObject(rawCollection)) return null;
  const firstCapturedAt = toOptionalTimestamp(rawCollection.firstCapturedAt);
  const lastCapturedAt = toOptionalTimestamp(rawCollection.lastCapturedAt);
  if (firstCapturedAt === null || lastCapturedAt === null) return null;
  if (!isTimestampInBucket(lastCapturedAt, dateStr, hour)) return null;
  return {
    firstCapturedAt,
    lastCapturedAt,
    dataCollectionMode: typeof rawCollection.dataCollectionMode === 'string'
      ? rawCollection.dataCollectionMode
      : null,
    precisionInsightsMode: typeof rawCollection.precisionInsightsMode === 'string'
      ? rawCollection.precisionInsightsMode
      : null,
  };
}

const HOURLY_BUCKET_PAYLOAD_ERROR_CODES = Object.freeze({
  totalsDelta: 'STATS_HOURLY_BUCKET_totalsDelta_INVALID',
  byCategoryDelta: 'STATS_HOURLY_BUCKET_byCategoryDelta_INVALID',
  sessionsDelta: 'STATS_HOURLY_BUCKET_sessionsDelta_INVALID',
  switchesDelta: 'STATS_HOURLY_BUCKET_switchesDelta_INVALID',
  transitionEdgesDelta: 'STATS_HOURLY_BUCKET_transitionEdgesDelta_INVALID',
  domainsDelta: 'STATS_HOURLY_BUCKET_domainsDelta_INVALID',
});

function createStatsHourlyBucketError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireHourlyDomainCheckpoint(domainDelta) {
  if (!isPlainObject(domainDelta)) {
    const error = new Error('STATS_HOURLY_BUCKET_DOMAIN_DELTA_INVALID');
    error.code = 'STATS_HOURLY_BUCKET_DOMAIN_DELTA_INVALID';
    throw error;
  }
  if (!Object.prototype.hasOwnProperty.call(domainDelta, 'committedThroughAt')) {
    const error = new Error('STATS_HOURLY_BUCKET_DOMAIN_CURSOR_REQUIRED');
    error.code = 'STATS_HOURLY_BUCKET_DOMAIN_CURSOR_REQUIRED';
    throw error;
  }
  if (!Object.prototype.hasOwnProperty.call(domainDelta, 'activeCommittedThroughAt')) {
    const error = new Error('STATS_HOURLY_BUCKET_DOMAIN_ACTIVE_CURSOR_REQUIRED');
    error.code = 'STATS_HOURLY_BUCKET_DOMAIN_ACTIVE_CURSOR_REQUIRED';
    throw error;
  }
  if (!Object.prototype.hasOwnProperty.call(domainDelta, 'collection')) {
    const error = new Error('STATS_HOURLY_BUCKET_DOMAIN_COLLECTION_REQUIRED');
    error.code = 'STATS_HOURLY_BUCKET_DOMAIN_COLLECTION_REQUIRED';
    throw error;
  }
  requireStatsProtectedActive(domainDelta.protectedActive, domainDelta.active);
  return domainDelta;
}

function createInvalidHourlyBucketPayloadError(fieldName) {
  const code = HOURLY_BUCKET_PAYLOAD_ERROR_CODES[fieldName] || 'STATS_HOURLY_BUCKET_PAYLOAD_INVALID';
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireHourlyBucketPayload(bucket, fieldName) {
  const value = bucket?.[fieldName];
  if (!isPlainObject(value)) {
    throw createInvalidHourlyBucketPayloadError(fieldName);
  }
  return value;
}

function normalizeReentryGapBucketCounts(source = {}) {
  const buckets = source && typeof source === 'object' ? source : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = toSafeCount(buckets[key], 0);
    return result;
  }, {});
}

function sumReentryGapBuckets(source = {}) {
  const buckets = normalizeReentryGapBucketCounts(source);
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((total, key) => total + buckets[key], 0);
}

function hourlyReentryGapBuckets(source = {}, hour) {
  const hourlySource = source && typeof source === 'object' ? source.hourlyReentryGapBuckets : null;
  const hourlyBuckets = hourlySource && typeof hourlySource === 'object' ? hourlySource : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = toSafeCount(hourlyBuckets?.[key]?.[hour], 0);
    return result;
  }, {});
}

function normalizeHour(value) {
  const numeric = Math.floor(toSafeNumber(value, -1));
  if (numeric < 0 || numeric > 23) return null;
  return numeric;
}

export function normalizeStatsHourlyBucketStatus(value, fallback = STATS_HOURLY_BUCKET_STATUS.SEALED) {
  if (value === STATS_HOURLY_BUCKET_STATUS.OPEN) return STATS_HOURLY_BUCKET_STATUS.OPEN;
  if (value === STATS_HOURLY_BUCKET_STATUS.SEALED) return STATS_HOURLY_BUCKET_STATUS.SEALED;
  if (fallback === STATS_HOURLY_BUCKET_STATUS.OPEN) return STATS_HOURLY_BUCKET_STATUS.OPEN;
  if (fallback === STATS_HOURLY_BUCKET_STATUS.SEALED) return STATS_HOURLY_BUCKET_STATUS.SEALED;
  return null;
}

function createEmptySwitchDelta() {
  const switches = {};
  STATS_SWITCH_KEYS.forEach((key) => {
    switches[key] = 0;
  });
  return switches;
}

export function toStatsBucketStartTs(dateStr, hour) {
  const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
  const normalizedHour = normalizeHour(hour);
  if (!normalizedDateStr || normalizedHour === null) return null;
  return resolveStatsHourlyBucketStartTs(normalizedDateStr, normalizedHour);
}

export function buildHourlyBucketFromDay({
  dateStr,
  hour,
  dayData,
  sealedAt = Date.now(),
  status = STATS_HOURLY_BUCKET_STATUS.SEALED,
  domainKeys = null,
  transitionEdgeKeys = null,
  baseDomainsDelta = null,
  baseTransitionEdgesDelta = null,
  materializationMetrics = null,
} = {}) {
  const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
  const normalizedHour = normalizeHour(hour);
  if (!normalizedDateStr || normalizedHour === null) return null;

  const bucketStartTs = toStatsBucketStartTs(normalizedDateStr, normalizedHour);
  if (!Number.isFinite(bucketStartTs)) return null;
  const bucketUtcOffsetMinutes = deriveStatsHourlyBucketUtcOffsetMinutes({
    dateStr: normalizedDateStr,
    hour: normalizedHour,
    bucketStartTs,
  });
  if (bucketUtcOffsetMinutes === null) return null;

  const normalizedDay = prepareStatsDayForHourlyMaterialization(dayData, {
    now: sealedAt,
    materializationMetrics,
  });
  if (materializationMetrics && typeof materializationMetrics === 'object') {
    materializationMetrics.preparedDayUses = toSafeCount(
      materializationMetrics.preparedDayUses,
      0,
    ) + 1;
  }
  const normalizedStatus = normalizeStatsHourlyBucketStatus(status);
  const timestamp = toSafeNumber(sealedAt, Date.now());
  const byCategoryDelta = createEmptyCategoryTotals();
  STATS_CATEGORY_IDS.forEach((categoryId) => {
    byCategoryDelta[categoryId] = {
      active: toSafeNumber(normalizedDay.hourlyRollup?.byCategory?.[categoryId]?.active?.[normalizedHour], 0),
      background: toSafeNumber(normalizedDay.hourlyRollup?.byCategory?.[categoryId]?.background?.[normalizedHour], 0),
    };
  });

  const switchesDelta = createEmptySwitchDelta();
  STATS_SWITCH_KEYS.forEach((key) => {
    switchesDelta[key] = toSafeCount(normalizedDay.hourlyRollup?.switches?.[key]?.[normalizedHour], 0);
  });

  const sessionsDelta = {
    count: toSafeCount(normalizedDay.hourlyRollup?.sessions?.count?.[normalizedHour], 0),
    totalMs: toSafeNumber(normalizedDay.hourlyRollup?.sessions?.totalMs?.[normalizedHour], 0),
    lastCommit: isTimestampInBucket(
      normalizedDay.sessions?.lastCommit?.endedAt,
      normalizedDateStr,
      normalizedHour,
    ) ? requireStatsSessionCommitCursor(normalizedDay.sessions.lastCommit) : null,
  };

  const transitionEdgesDelta = isPlainObject(baseTransitionEdgesDelta)
    ? baseTransitionEdgesDelta
    : {};
  const selectedTransitionEdgeKeys = Array.isArray(transitionEdgeKeys)
    ? Array.from(new Set(transitionEdgeKeys.filter((key) => typeof key === 'string' && key)))
    : Object.keys(normalizedDay.transitionEdges);
  if (materializationMetrics && typeof materializationMetrics === 'object') {
    materializationMetrics.transitionEdgesVisited = toSafeCount(
      materializationMetrics.transitionEdgesVisited,
      0,
    ) + selectedTransitionEdgeKeys.length;
  }
  selectedTransitionEdgeKeys.forEach((edgeKey) => {
    const edge = normalizedDay.transitionEdges[edgeKey];
    if (!edge) {
      delete transitionEdgesDelta[edgeKey];
      return;
    }
    const count = edge.hourlyCounts[normalizedHour];
    if (count <= 0) {
      delete transitionEdgesDelta[edgeKey];
      return;
    }
    transitionEdgesDelta[edgeKey] = {
      fromDomain: edge.fromDomain,
      toDomain: edge.toDomain,
      count,
      returnWithin10m: edge.hourlyReturnWithin10m[normalizedHour],
    };
  });

  const domainsDelta = isPlainObject(baseDomainsDelta) ? baseDomainsDelta : {};
  const selectedDomainKeys = Array.isArray(domainKeys)
    ? Array.from(new Set(domainKeys.filter((key) => typeof key === 'string' && key)))
    : Object.keys(normalizedDay.domains || {});
  if (materializationMetrics && typeof materializationMetrics === 'object') {
    materializationMetrics.domainsVisited = toSafeCount(
      materializationMetrics.domainsVisited,
      0,
    ) + selectedDomainKeys.length;
  }
  selectedDomainKeys.forEach((hostname) => {
    const domainStats = normalizedDay.domains?.[hostname];
    if (!domainStats) {
      delete domainsDelta[hostname];
      return;
    }
    const rawDomainStats = isPlainObject(dayData?.domains?.[hostname])
      ? dayData.domains[hostname]
      : {};
    const rawLastTrackedTime = toOptionalTimestamp(rawDomainStats.lastTrackedTime);
    const committedThroughAt = isTimestampInBucket(
      rawLastTrackedTime,
      normalizedDateStr,
      normalizedHour,
    ) ? rawLastTrackedTime : null;
    const rawActiveCommittedThroughAt = toOptionalTimestamp(
      rawDomainStats.activeCommittedThroughAt,
    );
    const activeCommittedThroughAt = isCommitCursorInBucket(
      rawActiveCommittedThroughAt,
      normalizedDateStr,
      normalizedHour,
    ) ? rawActiveCommittedThroughAt : null;
    const collection = buildDomainCollectionCheckpoint(
      rawDomainStats.collection,
      normalizedDateStr,
      normalizedHour,
    );
    const active = toSafeNumber(domainStats?.hourlyActive?.[normalizedHour], 0);
    const protectedActive = requireStatsProtectedActive(domainStats.hourlyProtectedActive[normalizedHour], active);
    const background = toSafeNumber(domainStats?.hourlyBackground?.[normalizedHour], 0);
    const totalMs = toSafeNumber(domainStats?.hourly?.[normalizedHour], active + background);
    const visits = toSafeCount(domainStats?.hourlyVisits?.[normalizedHour], 0);
    const sessions = {
      count: toSafeCount(domainStats?.sessions?.hourlyCount?.[normalizedHour], 0),
      totalMs: toSafeNumber(domainStats?.sessions?.hourlyTotalMs?.[normalizedHour], 0),
      shortCount: toSafeCount(domainStats?.sessions?.hourlyShortCount?.[normalizedHour], 0),
      longCount: toSafeCount(domainStats?.sessions?.hourlyLongCount?.[normalizedHour], 0),
      maxMs: toSafeNumber(domainStats?.sessions?.hourlyMaxMs?.[normalizedHour], 0),
    };
    const behavior = {
      backgroundMediaMs: toSafeNumber(domainStats?.behavior?.hourlyBackgroundMediaMs?.[normalizedHour], 0),
      backgroundLingerMs: toSafeNumber(domainStats?.behavior?.hourlyBackgroundLingerMs?.[normalizedHour], 0),
      staleTabMs: toSafeNumber(domainStats?.behavior?.hourlyStaleTabMs?.[normalizedHour], 0),
      revisitWithin2m: toSafeCount(domainStats?.behavior?.hourlyRevisitWithin2m?.[normalizedHour], 0),
      revisitWithin5m: toSafeCount(domainStats?.behavior?.hourlyRevisitWithin5m?.[normalizedHour], 0),
      revisitWithin10m: toSafeCount(domainStats?.behavior?.hourlyRevisitWithin10m?.[normalizedHour], 0),
      reentryGapBuckets: hourlyReentryGapBuckets(domainStats?.behavior, normalizedHour),
      switchIns: toSafeCount(domainStats?.behavior?.hourlySwitchIns?.[normalizedHour], 0),
      switchOuts: toSafeCount(domainStats?.behavior?.hourlySwitchOuts?.[normalizedHour], 0),
      switchBackWithin10m: toSafeCount(domainStats?.behavior?.hourlySwitchBackWithin10m?.[normalizedHour], 0),
      newTabEntrances: toSafeCount(domainStats?.behavior?.hourlyNewTabEntrances?.[normalizedHour], 0),
      duplicateTabEntrances: toSafeCount(domainStats?.behavior?.hourlyDuplicateTabEntrances?.[normalizedHour], 0),
      highOpenTabEntrances: toSafeCount(domainStats?.behavior?.hourlyHighOpenTabEntrances?.[normalizedHour], 0),
      maxSameDomainOpenTabs: toSafeCount(domainStats?.behavior?.hourlyMaxSameDomainOpenTabs?.[normalizedHour], 0),
      maxOpenTabs: toSafeCount(domainStats?.behavior?.hourlyMaxOpenTabs?.[normalizedHour], 0),
      scrollSpikeBursts: toSafeCount(domainStats?.behavior?.hourlyScrollSpikeBursts?.[normalizedHour], 0),
      fastScrollBursts: toSafeCount(domainStats?.behavior?.hourlyFastScrollBursts?.[normalizedHour], 0),
      feedPressureSignals: toSafeCount(domainStats?.behavior?.hourlyFeedPressureSignals?.[normalizedHour], 0),
      feedInterruptSignals: toSafeCount(domainStats?.behavior?.hourlyFeedInterruptSignals?.[normalizedHour], 0),
      feedAdvanceBursts: toSafeCount(domainStats?.behavior?.hourlyFeedAdvanceBursts?.[normalizedHour], 0),
      feedSkimSignals: toSafeCount(domainStats?.behavior?.hourlyFeedSkimSignals?.[normalizedHour], 0),
      shortMediaAttentionSignals: toSafeCount(domainStats?.behavior?.hourlyShortMediaAttentionSignals?.[normalizedHour], 0),
      shortMediaWatchMs: toSafeNumber(domainStats?.behavior?.hourlyShortMediaWatchMs?.[normalizedHour], 0),
      maxFeedScreenfuls: toSafeNumber(domainStats?.behavior?.hourlyMaxFeedScreenfuls?.[normalizedHour], 0),
      maxFeedItemTransitions: toSafeCount(domainStats?.behavior?.hourlyMaxFeedItemTransitions?.[normalizedHour], 0),
      lastVisitAt: toSafeNumber(domainStats?.behavior?.lastVisitAt, 0),
      lastEntryAt: toSafeNumber(domainStats?.behavior?.lastEntryAt, 0),
      lastExitAt: toSafeNumber(domainStats?.behavior?.lastExitAt, 0),
      lastTabContextAt: toSafeNumber(domainStats?.behavior?.lastTabContextAt, 0),
      lastContentFlowAt: toSafeNumber(domainStats?.behavior?.lastContentFlowAt, 0),
    };
    const interventions = {
      frictionShown: toSafeCount(domainStats?.interventions?.hourlyFrictionShown?.[normalizedHour], 0),
      continued: toSafeCount(domainStats?.interventions?.hourlyContinued?.[normalizedHour], 0),
      left: toSafeCount(domainStats?.interventions?.hourlyLeft?.[normalizedHour], 0),
      reenteredWithin5m: toSafeCount(domainStats?.interventions?.hourlyReenteredWithin5m?.[normalizedHour], 0),
      reenteredWithin30m: toSafeCount(domainStats?.interventions?.hourlyReenteredWithin30m?.[normalizedHour], 0),
      escapeClosed: toSafeCount(domainStats?.interventions?.hourlyEscapeClosed?.[normalizedHour], 0),
      lastShownAt: toSafeNumber(domainStats?.interventions?.lastShownAt, 0),
      lastContinuedAt: toSafeNumber(domainStats?.interventions?.lastContinuedAt, 0),
      lastLeftAt: toSafeNumber(domainStats?.interventions?.lastLeftAt, 0),
      lastReenteredAt: toSafeNumber(domainStats?.interventions?.lastReenteredAt, 0),
    };
    const navigation = {
      total: toSafeCount(domainStats?.navigation?.hourlyTotal?.[normalizedHour], 0),
      link: toSafeCount(domainStats?.navigation?.hourlyLink?.[normalizedHour], 0),
      typed: toSafeCount(domainStats?.navigation?.hourlyTyped?.[normalizedHour], 0),
      reload: toSafeCount(domainStats?.navigation?.hourlyReload?.[normalizedHour], 0),
      generated: toSafeCount(domainStats?.navigation?.hourlyGenerated?.[normalizedHour], 0),
      keyword: toSafeCount(domainStats?.navigation?.hourlyKeyword?.[normalizedHour], 0),
      formSubmit: toSafeCount(domainStats?.navigation?.hourlyFormSubmit?.[normalizedHour], 0),
      startPage: toSafeCount(domainStats?.navigation?.hourlyStartPage?.[normalizedHour], 0),
      autoBookmark: toSafeCount(domainStats?.navigation?.hourlyAutoBookmark?.[normalizedHour], 0),
      other: toSafeCount(domainStats?.navigation?.hourlyOther?.[normalizedHour], 0),
      addressBar: toSafeCount(domainStats?.navigation?.hourlyAddressBar?.[normalizedHour], 0),
      forwardBack: toSafeCount(domainStats?.navigation?.hourlyForwardBack?.[normalizedHour], 0),
      lastNavigationAt: toSafeNumber(domainStats?.navigation?.lastNavigationAt, 0),
    };
    const hasSessions = sessions.count > 0 || sessions.totalMs > 0 || sessions.shortCount > 0 || sessions.longCount > 0 || sessions.maxMs > 0;
    const hasBehavior = behavior.revisitWithin2m > 0
      || behavior.backgroundMediaMs > 0
      || behavior.backgroundLingerMs > 0
      || behavior.staleTabMs > 0
      || sumReentryGapBuckets(behavior.reentryGapBuckets) > 0
      || behavior.revisitWithin5m > 0
      || behavior.revisitWithin10m > 0
      || behavior.switchIns > 0
      || behavior.switchOuts > 0
      || behavior.switchBackWithin10m > 0
      || behavior.newTabEntrances > 0
      || behavior.duplicateTabEntrances > 0
      || behavior.highOpenTabEntrances > 0
      || behavior.maxSameDomainOpenTabs > 0
      || behavior.maxOpenTabs > 0
      || behavior.scrollSpikeBursts > 0
      || behavior.fastScrollBursts > 0
      || behavior.feedPressureSignals > 0
      || behavior.feedInterruptSignals > 0
      || behavior.feedAdvanceBursts > 0
      || behavior.feedSkimSignals > 0
      || behavior.shortMediaAttentionSignals > 0
      || behavior.shortMediaWatchMs > 0
      || behavior.maxFeedScreenfuls > 0
      || behavior.maxFeedItemTransitions > 0;
    const hasInterventions = interventions.frictionShown > 0
      || interventions.continued > 0
      || interventions.left > 0
      || interventions.reenteredWithin5m > 0
      || interventions.reenteredWithin30m > 0
      || interventions.escapeClosed > 0;
    const hasNavigation = navigation.total > 0
      || navigation.link > 0
      || navigation.typed > 0
      || navigation.reload > 0
      || navigation.generated > 0
      || navigation.keyword > 0
      || navigation.formSubmit > 0
      || navigation.startPage > 0
      || navigation.autoBookmark > 0
      || navigation.other > 0
      || navigation.addressBar > 0
      || navigation.forwardBack > 0;
    if (
      active <= 0
      && background <= 0
      && totalMs <= 0
      && visits <= 0
      && !hasSessions
      && !hasBehavior
      && !hasInterventions
      && !hasNavigation
      && committedThroughAt === null
      && activeCommittedThroughAt === null
      && collection === null
    ) {
      delete domainsDelta[hostname];
      return;
    }
    domainsDelta[hostname] = {
      active,
      protectedActive,
      ...(Object.hasOwn(domainStats, 'activeUsageIntervals') ? {
        activeUsageIntervals: clipActiveUsageIntervals(domainStats.activeUsageIntervals, bucketStartTs, bucketStartTs + 3600000),
      } : {}),
      background,
      totalMs,
      visits,
      committedThroughAt,
      activeCommittedThroughAt,
      collection,
      sessions,
      behavior,
      interventions,
      navigation,
    };
  });

  const feedHistoryReceipts = Object.hasOwn(normalizedDay, 'feedHistoryReceipts')
    ? normalizedDay.feedHistoryReceipts.filter((receipt) => receipt.bucketStartTs === bucketStartTs)
    : [];
  const interventionHistoryReceipts = Object.hasOwn(normalizedDay, 'interventionHistoryReceipts')
    ? normalizedDay.interventionHistoryReceipts.filter(receipt => receipt.bucketStartTs === bucketStartTs) : [];
  return registerPreparedStatsHourlyBucket({
    bucketStartTs,
    bucketUtcOffsetMinutes,
    dateStr: normalizedDateStr,
    hour: normalizedHour,
    totalsDelta: {
      totalActive: toSafeNumber(normalizedDay.hourlyRollup?.active?.[normalizedHour], 0),
      totalBackground: toSafeNumber(normalizedDay.hourlyRollup?.background?.[normalizedHour], 0),
      blockedActive: toSafeNumber(byCategoryDelta.blocked?.active, 0),
      blockedBackground: toSafeNumber(byCategoryDelta.blocked?.background, 0),
    },
    byCategoryDelta,
    sessionsDelta,
    switchesDelta,
    transitionEdgesDelta,
    domainsDelta,
    ...(feedHistoryReceipts.length ? { feedHistoryReceipts: Object.freeze(feedHistoryReceipts) } : {}),
    ...(interventionHistoryReceipts.length ? { interventionHistoryReceipts: Object.freeze(interventionHistoryReceipts) } : {}),
    ...(Object.hasOwn(normalizedDay, 'feedHistoryResetAt')
      && isTimestampInBucket(normalizedDay.feedHistoryResetAt, normalizedDateStr, normalizedHour)
      ? { feedHistoryResetAt: normalizedDay.feedHistoryResetAt } : {}),
    cursorCheckpointVersion: STATS_HOURLY_CURSOR_CHECKPOINT_VERSION,
    schemaVersion: STATS_SCHEMA_VERSION,
    status: normalizedStatus,
    sealedAt: normalizedStatus === STATS_HOURLY_BUCKET_STATUS.SEALED ? timestamp : null,
    updatedAt: timestamp,
  });
}

export function resolveLastSealedHour(buckets = []) {
  let maxHour = -1;
  (Array.isArray(buckets) ? buckets : []).forEach((bucket) => {
    if (normalizeStatsHourlyBucketStatus(bucket?.status, null) !== STATS_HOURLY_BUCKET_STATUS.SEALED) return;
    const normalizedHour = normalizeHour(bucket?.hour);
    if (normalizedHour === null) return;
    if (normalizedHour > maxHour) {
      maxHour = normalizedHour;
    }
  });
  return maxHour;
}

function applyHourlyBucketToNormalizedDay(dayData, bucket) {
  if (bucket?.schemaVersion !== STATS_SCHEMA_VERSION) {
    throw createStatsHourlyBucketError('STATS_HOURLY_BUCKET_VERSION_UNSUPPORTED');
  }
  const hour = normalizeHour(bucket?.hour);
  if (hour === null || !isStatsHourlyBucketIdentityValid(bucket)) {
    throw createStatsHourlyBucketError('STATS_HOURLY_BUCKET_IDENTITY_INVALID');
  }
  requireHourlyBucketPayload(bucket, 'totalsDelta');
  Object.values(requireHourlyBucketPayload(bucket, 'domainsDelta')).forEach(requireHourlyDomainCheckpoint);

  const nextDay = dayData;
  if (Object.hasOwn(bucket, 'interventionHistoryReceipts')) {
    const receipts = requireInterventionHistoryReceipts(bucket.interventionHistoryReceipts, { bucketStartTs: bucket.bucketStartTs, dateStr: bucket.dateStr });
    nextDay.interventionHistoryReceipts = requireInterventionHistoryReceipts([
      ...(Object.hasOwn(nextDay, 'interventionHistoryReceipts') ? nextDay.interventionHistoryReceipts : []), ...receipts,
    ]);
  }
  if (Object.hasOwn(bucket, 'feedHistoryResetAt')) {
    nextDay.feedHistoryResetAt = requireFeedHistoryResetAt(bucket.feedHistoryResetAt, { bucketStartTs: bucket.bucketStartTs });
  }
  if (Object.hasOwn(bucket, 'feedHistoryReceipts')) {
    const receipts = requireFeedHistoryReceipts(bucket.feedHistoryReceipts, { bucketStartTs: bucket.bucketStartTs });
    nextDay.feedHistoryReceipts = requireFeedHistoryReceipts([
      ...(Object.hasOwn(nextDay, 'feedHistoryReceipts') ? nextDay.feedHistoryReceipts : []),
      ...receipts,
    ]);
  }
  const totalsDelta = requireHourlyBucketPayload(bucket, 'totalsDelta');
  nextDay.totals.totalActive += toSafeNumber(totalsDelta.totalActive, 0);
  nextDay.totals.totalBackground += toSafeNumber(totalsDelta.totalBackground, 0);
  nextDay.totals.blockedActive += toSafeNumber(totalsDelta.blockedActive, 0);
  nextDay.totals.blockedBackground += toSafeNumber(totalsDelta.blockedBackground, 0);

  nextDay.hourlyRollup.active[hour] += toSafeNumber(totalsDelta.totalActive, 0);
  nextDay.hourlyRollup.background[hour] += toSafeNumber(totalsDelta.totalBackground, 0);

  const byCategoryDelta = requireHourlyBucketPayload(bucket, 'byCategoryDelta');
  STATS_CATEGORY_IDS.forEach((categoryId) => {
    const categoryDelta = isPlainObject(byCategoryDelta[categoryId]) ? byCategoryDelta[categoryId] : {};
    const active = toSafeNumber(categoryDelta.active, 0);
    const background = toSafeNumber(categoryDelta.background, 0);
    nextDay.byCategory[categoryId].active += active;
    nextDay.byCategory[categoryId].background += background;
    nextDay.hourlyRollup.byCategory[categoryId].active[hour] += active;
    nextDay.hourlyRollup.byCategory[categoryId].background[hour] += background;
  });

  const sessionsDelta = requireHourlyBucketPayload(bucket, 'sessionsDelta');
  nextDay.sessions.count += toSafeCount(sessionsDelta.count, 0);
  nextDay.sessions.totalMs += toSafeNumber(sessionsDelta.totalMs, 0);
  nextDay.hourlyRollup.sessions.count[hour] += toSafeCount(sessionsDelta.count, 0);
  nextDay.hourlyRollup.sessions.totalMs[hour] += toSafeNumber(sessionsDelta.totalMs, 0);
  const sessionCommit = requireStatsSessionCommitCursor(sessionsDelta.lastCommit);
  const previousSessionCommit = requireStatsSessionCommitCursor(nextDay.sessions.lastCommit);
  if (
    sessionCommit
    && previousSessionCommit
    && sessionCommit.endedAt === previousSessionCommit.endedAt
    && sessionCommit.sessionId !== previousSessionCommit.sessionId
  ) {
    throw createStatsHourlyBucketError('STATS_SESSION_COMMIT_CURSOR_CONFLICT');
  }
  if (!previousSessionCommit || (sessionCommit && sessionCommit.endedAt > previousSessionCommit.endedAt)) {
    nextDay.sessions.lastCommit = sessionCommit;
  }

  const switchesDelta = requireHourlyBucketPayload(bucket, 'switchesDelta');
  STATS_SWITCH_KEYS.forEach((key) => {
    const delta = toSafeCount(switchesDelta[key], 0);
    nextDay.switches[key] += delta;
    nextDay.hourlyRollup.switches[key][hour] += delta;
  });

  Object.entries(normalizeStatsTransitionEdgeDeltas(bucket?.transitionEdgesDelta))
    .forEach(([edgeKey, delta]) => {
      if (!nextDay.transitionEdges[edgeKey]) {
        nextDay.transitionEdges[edgeKey] = {
          fromDomain: delta.fromDomain,
          toDomain: delta.toDomain,
          count: 0,
          returnWithin10m: 0,
          hourlyCounts: Array(STATS_HOURLY_BUCKETS).fill(0),
          hourlyReturnWithin10m: Array(STATS_HOURLY_BUCKETS).fill(0),
        };
      }
      const edge = nextDay.transitionEdges[edgeKey];
      edge.count += delta.count;
      edge.returnWithin10m += delta.returnWithin10m;
      edge.hourlyCounts[hour] += delta.count;
      edge.hourlyReturnWithin10m[hour] += delta.returnWithin10m;
    });

  Object.entries(requireHourlyBucketPayload(bucket, 'domainsDelta')).forEach(([hostname, rawDomainDelta]) => {
    const domainDelta = requireHourlyDomainCheckpoint(rawDomainDelta);
    const domainCreated = !nextDay.domains[hostname];
    const committedThroughAt = toOptionalTimestamp(domainDelta.committedThroughAt);
    const activeCommittedThroughAt = toOptionalTimestamp(
      domainDelta.activeCommittedThroughAt,
    );
    const collectionCheckpoint = isPlainObject(domainDelta?.collection)
      ? domainDelta.collection
      : null;
    const initialTimestamp = committedThroughAt
      ?? toOptionalTimestamp(collectionCheckpoint?.firstCapturedAt)
      ?? toOptionalTimestamp(bucket?.bucketStartTs)
      ?? Date.now();
    if (domainCreated) {
      nextDay.domains[hostname] = createEmptyDomainStats(initialTimestamp);
    }

    const domain = nextDay.domains[hostname];
    const active = toSafeNumber(domainDelta.active, 0);
    const protectedActive = requireStatsProtectedActive(domainDelta.protectedActive, active);
    const background = toSafeNumber(domainDelta.background, 0);
    const totalMs = toSafeNumber(domainDelta.totalMs, active + background);
    const visits = toSafeCount(domainDelta.visits, 0);

    if (collectionCheckpoint) {
      const firstCapturedAt = toOptionalTimestamp(collectionCheckpoint.firstCapturedAt);
      const lastCapturedAt = toOptionalTimestamp(collectionCheckpoint.lastCapturedAt);
      if (firstCapturedAt !== null && lastCapturedAt !== null) {
        const currentCollection = domain.collection || {};
        const hasCurrentCoverage = typeof currentCollection.dataCollectionMode === 'string'
          || typeof currentCollection.precisionInsightsMode === 'string';
        const currentLastCapturedAt = hasCurrentCoverage
          ? toOptionalTimestamp(currentCollection.lastCapturedAt)
          : null;
        domain.collection = {
          firstCapturedAt: hasCurrentCoverage
            ? Math.min(
                toOptionalTimestamp(currentCollection.firstCapturedAt) ?? firstCapturedAt,
                firstCapturedAt,
              )
            : firstCapturedAt,
          lastCapturedAt: Math.max(currentLastCapturedAt ?? 0, lastCapturedAt),
          dataCollectionMode: currentLastCapturedAt !== null && currentLastCapturedAt > lastCapturedAt
            ? currentCollection.dataCollectionMode ?? null
            : collectionCheckpoint.dataCollectionMode ?? null,
          precisionInsightsMode: currentLastCapturedAt !== null && currentLastCapturedAt > lastCapturedAt
            ? currentCollection.precisionInsightsMode ?? null
            : collectionCheckpoint.precisionInsightsMode ?? null,
        };
      }
    }

    domain.active += active;
    domain.protectedActive += protectedActive;
    domain.background += background;
    domain.visits += visits;
    domain.hourly[hour] += totalMs;
    domain.hourlyActive[hour] += active;
    domain.hourlyProtectedActive[hour] += protectedActive;
    domain.hourlyBackground[hour] += background;
    domain.hourlyVisits[hour] += visits;
    const sessions = domainDelta.sessions || {};
    const sessionCount = toSafeCount(sessions.count, 0);
    const sessionTotalMs = toSafeNumber(sessions.totalMs, 0);
    const sessionShortCount = toSafeCount(sessions.shortCount, 0);
    const sessionLongCount = toSafeCount(sessions.longCount, 0);
    const sessionMaxMs = toSafeNumber(sessions.maxMs, 0);
    domain.sessions.count += sessionCount;
    domain.sessions.totalMs += sessionTotalMs;
    domain.sessions.shortCount += sessionShortCount;
    domain.sessions.longCount += sessionLongCount;
    domain.sessions.maxMs = Math.max(domain.sessions.maxMs, sessionMaxMs);
    domain.sessions.hourlyCount[hour] += sessionCount;
    domain.sessions.hourlyTotalMs[hour] += sessionTotalMs;
    domain.sessions.hourlyShortCount[hour] += sessionShortCount;
    domain.sessions.hourlyLongCount[hour] += sessionLongCount;
    domain.sessions.hourlyMaxMs[hour] = Math.max(domain.sessions.hourlyMaxMs[hour], sessionMaxMs);

    const behavior = domainDelta.behavior || {};
    const backgroundMediaMs = toSafeNumber(behavior.backgroundMediaMs, 0);
    const backgroundLingerMs = toSafeNumber(behavior.backgroundLingerMs, 0);
    const staleTabMs = toSafeNumber(behavior.staleTabMs, 0);
    const revisitWithin2m = toSafeCount(behavior.revisitWithin2m, 0);
    const revisitWithin5m = toSafeCount(behavior.revisitWithin5m, 0);
    const revisitWithin10m = toSafeCount(behavior.revisitWithin10m, 0);
    const reentryGapBuckets = normalizeReentryGapBucketCounts(behavior.reentryGapBuckets);
    const switchIns = toSafeCount(behavior.switchIns, 0);
    const switchOuts = toSafeCount(behavior.switchOuts, 0);
    const switchBackWithin10m = toSafeCount(behavior.switchBackWithin10m, 0);
    const newTabEntrances = toSafeCount(behavior.newTabEntrances, 0);
    const duplicateTabEntrances = toSafeCount(behavior.duplicateTabEntrances, 0);
    const highOpenTabEntrances = toSafeCount(behavior.highOpenTabEntrances, 0);
    const maxSameDomainOpenTabs = toSafeCount(behavior.maxSameDomainOpenTabs, 0);
    const maxOpenTabs = toSafeCount(behavior.maxOpenTabs, 0);
    const scrollSpikeBursts = toSafeCount(behavior.scrollSpikeBursts, 0);
    const fastScrollBursts = toSafeCount(behavior.fastScrollBursts, 0);
    const feedPressureSignals = toSafeCount(behavior.feedPressureSignals, 0);
    const feedInterruptSignals = toSafeCount(behavior.feedInterruptSignals, 0);
    const feedAdvanceBursts = toSafeCount(behavior.feedAdvanceBursts, 0);
    const feedSkimSignals = toSafeCount(behavior.feedSkimSignals, 0);
    const shortMediaAttentionSignals = toSafeCount(behavior.shortMediaAttentionSignals, 0);
    const shortMediaWatchMs = toSafeNumber(behavior.shortMediaWatchMs, 0);
    const maxFeedScreenfuls = toSafeNumber(behavior.maxFeedScreenfuls, 0);
    const maxFeedItemTransitions = toSafeCount(behavior.maxFeedItemTransitions, 0);
    domain.behavior.backgroundMediaMs += backgroundMediaMs;
    domain.behavior.backgroundLingerMs += backgroundLingerMs;
    domain.behavior.staleTabMs += staleTabMs;
    domain.behavior.revisitWithin2m += revisitWithin2m;
    domain.behavior.revisitWithin5m += revisitWithin5m;
    domain.behavior.revisitWithin10m += revisitWithin10m;
    STATS_REENTRY_GAP_BUCKET_KEYS.forEach((key) => {
      domain.behavior.reentryGapBuckets[key] += reentryGapBuckets[key];
    });
    domain.behavior.switchIns += switchIns;
    domain.behavior.switchOuts += switchOuts;
    domain.behavior.switchBackWithin10m += switchBackWithin10m;
    domain.behavior.newTabEntrances += newTabEntrances;
    domain.behavior.duplicateTabEntrances += duplicateTabEntrances;
    domain.behavior.highOpenTabEntrances += highOpenTabEntrances;
    domain.behavior.maxSameDomainOpenTabs = Math.max(domain.behavior.maxSameDomainOpenTabs, maxSameDomainOpenTabs);
    domain.behavior.maxOpenTabs = Math.max(domain.behavior.maxOpenTabs, maxOpenTabs);
    domain.behavior.scrollSpikeBursts += scrollSpikeBursts;
    domain.behavior.fastScrollBursts += fastScrollBursts;
    domain.behavior.feedPressureSignals += feedPressureSignals;
    domain.behavior.feedInterruptSignals += feedInterruptSignals;
    domain.behavior.feedAdvanceBursts += feedAdvanceBursts;
    domain.behavior.feedSkimSignals += feedSkimSignals;
    domain.behavior.shortMediaAttentionSignals += shortMediaAttentionSignals;
    domain.behavior.shortMediaWatchMs += shortMediaWatchMs;
    domain.behavior.maxFeedScreenfuls = Math.max(domain.behavior.maxFeedScreenfuls, maxFeedScreenfuls);
    domain.behavior.maxFeedItemTransitions = Math.max(domain.behavior.maxFeedItemTransitions, maxFeedItemTransitions);
    domain.behavior.hourlyBackgroundMediaMs[hour] += backgroundMediaMs;
    domain.behavior.hourlyBackgroundLingerMs[hour] += backgroundLingerMs;
    domain.behavior.hourlyStaleTabMs[hour] += staleTabMs;
    domain.behavior.hourlyRevisitWithin2m[hour] += revisitWithin2m;
    domain.behavior.hourlyRevisitWithin5m[hour] += revisitWithin5m;
    domain.behavior.hourlyRevisitWithin10m[hour] += revisitWithin10m;
    STATS_REENTRY_GAP_BUCKET_KEYS.forEach((key) => {
      domain.behavior.hourlyReentryGapBuckets[key][hour] += reentryGapBuckets[key];
    });
    domain.behavior.hourlySwitchIns[hour] += switchIns;
    domain.behavior.hourlySwitchOuts[hour] += switchOuts;
    domain.behavior.hourlySwitchBackWithin10m[hour] += switchBackWithin10m;
    domain.behavior.hourlyNewTabEntrances[hour] += newTabEntrances;
    domain.behavior.hourlyDuplicateTabEntrances[hour] += duplicateTabEntrances;
    domain.behavior.hourlyHighOpenTabEntrances[hour] += highOpenTabEntrances;
    domain.behavior.hourlyMaxSameDomainOpenTabs[hour] = Math.max(domain.behavior.hourlyMaxSameDomainOpenTabs[hour], maxSameDomainOpenTabs);
    domain.behavior.hourlyMaxOpenTabs[hour] = Math.max(domain.behavior.hourlyMaxOpenTabs[hour], maxOpenTabs);
    domain.behavior.hourlyScrollSpikeBursts[hour] += scrollSpikeBursts;
    domain.behavior.hourlyFastScrollBursts[hour] += fastScrollBursts;
    domain.behavior.hourlyFeedPressureSignals[hour] += feedPressureSignals;
    domain.behavior.hourlyFeedInterruptSignals[hour] += feedInterruptSignals;
    domain.behavior.hourlyFeedAdvanceBursts[hour] += feedAdvanceBursts;
    domain.behavior.hourlyFeedSkimSignals[hour] += feedSkimSignals;
    domain.behavior.hourlyShortMediaAttentionSignals[hour] += shortMediaAttentionSignals;
    domain.behavior.hourlyShortMediaWatchMs[hour] += shortMediaWatchMs;
    domain.behavior.hourlyMaxFeedScreenfuls[hour] = Math.max(domain.behavior.hourlyMaxFeedScreenfuls[hour], maxFeedScreenfuls);
    domain.behavior.hourlyMaxFeedItemTransitions[hour] = Math.max(domain.behavior.hourlyMaxFeedItemTransitions[hour], maxFeedItemTransitions);
    domain.behavior.lastVisitAt = Math.max(domain.behavior.lastVisitAt, toSafeNumber(behavior.lastVisitAt, 0));
    domain.behavior.lastEntryAt = Math.max(domain.behavior.lastEntryAt, toSafeNumber(behavior.lastEntryAt, 0));
    domain.behavior.lastExitAt = Math.max(domain.behavior.lastExitAt, toSafeNumber(behavior.lastExitAt, 0));
    domain.behavior.lastTabContextAt = Math.max(domain.behavior.lastTabContextAt, toSafeNumber(behavior.lastTabContextAt, 0));
    domain.behavior.lastContentFlowAt = Math.max(domain.behavior.lastContentFlowAt, toSafeNumber(behavior.lastContentFlowAt, 0));

    const interventions = domainDelta.interventions || {};
    const frictionShown = toSafeCount(interventions.frictionShown, 0);
    const continued = toSafeCount(interventions.continued, 0);
    const left = toSafeCount(interventions.left, 0);
    const reenteredWithin5m = toSafeCount(interventions.reenteredWithin5m, 0);
    const reenteredWithin30m = toSafeCount(interventions.reenteredWithin30m, 0);
    const escapeClosed = toSafeCount(interventions.escapeClosed, 0);
    domain.interventions.frictionShown += frictionShown;
    domain.interventions.continued += continued;
    domain.interventions.left += left;
    domain.interventions.reenteredWithin5m += reenteredWithin5m;
    domain.interventions.reenteredWithin30m += reenteredWithin30m;
    domain.interventions.escapeClosed += escapeClosed;
    domain.interventions.hourlyFrictionShown[hour] += frictionShown;
    domain.interventions.hourlyContinued[hour] += continued;
    domain.interventions.hourlyLeft[hour] += left;
    domain.interventions.hourlyReenteredWithin5m[hour] += reenteredWithin5m;
    domain.interventions.hourlyReenteredWithin30m[hour] += reenteredWithin30m;
    domain.interventions.hourlyEscapeClosed[hour] += escapeClosed;
    domain.interventions.lastShownAt = Math.max(domain.interventions.lastShownAt, toSafeNumber(interventions.lastShownAt, 0));
    domain.interventions.lastContinuedAt = Math.max(domain.interventions.lastContinuedAt, toSafeNumber(interventions.lastContinuedAt, 0));
    domain.interventions.lastLeftAt = Math.max(domain.interventions.lastLeftAt, toSafeNumber(interventions.lastLeftAt, 0));
    domain.interventions.lastReenteredAt = Math.max(domain.interventions.lastReenteredAt, toSafeNumber(interventions.lastReenteredAt, 0));

    const navigation = domainDelta.navigation || {};
    const navigationTotal = toSafeCount(navigation.total, 0);
    const navigationLink = toSafeCount(navigation.link, 0);
    const navigationTyped = toSafeCount(navigation.typed, 0);
    const navigationReload = toSafeCount(navigation.reload, 0);
    const navigationGenerated = toSafeCount(navigation.generated, 0);
    const navigationKeyword = toSafeCount(navigation.keyword, 0);
    const navigationFormSubmit = toSafeCount(navigation.formSubmit, 0);
    const navigationStartPage = toSafeCount(navigation.startPage, 0);
    const navigationAutoBookmark = toSafeCount(navigation.autoBookmark, 0);
    const navigationOther = toSafeCount(navigation.other, 0);
    const navigationAddressBar = toSafeCount(navigation.addressBar, 0);
    const navigationForwardBack = toSafeCount(navigation.forwardBack, 0);
    domain.navigation.total += navigationTotal;
    domain.navigation.link += navigationLink;
    domain.navigation.typed += navigationTyped;
    domain.navigation.reload += navigationReload;
    domain.navigation.generated += navigationGenerated;
    domain.navigation.keyword += navigationKeyword;
    domain.navigation.formSubmit += navigationFormSubmit;
    domain.navigation.startPage += navigationStartPage;
    domain.navigation.autoBookmark += navigationAutoBookmark;
    domain.navigation.other += navigationOther;
    domain.navigation.addressBar += navigationAddressBar;
    domain.navigation.forwardBack += navigationForwardBack;
    domain.navigation.hourlyTotal[hour] += navigationTotal;
    domain.navigation.hourlyLink[hour] += navigationLink;
    domain.navigation.hourlyTyped[hour] += navigationTyped;
    domain.navigation.hourlyReload[hour] += navigationReload;
    domain.navigation.hourlyGenerated[hour] += navigationGenerated;
    domain.navigation.hourlyKeyword[hour] += navigationKeyword;
    domain.navigation.hourlyFormSubmit[hour] += navigationFormSubmit;
    domain.navigation.hourlyStartPage[hour] += navigationStartPage;
    domain.navigation.hourlyAutoBookmark[hour] += navigationAutoBookmark;
    domain.navigation.hourlyOther[hour] += navigationOther;
    domain.navigation.hourlyAddressBar[hour] += navigationAddressBar;
    domain.navigation.hourlyForwardBack[hour] += navigationForwardBack;
    domain.navigation.lastNavigationAt = Math.max(domain.navigation.lastNavigationAt, toSafeNumber(navigation.lastNavigationAt, 0));
    if (committedThroughAt !== null) {
      domain.lastTrackedTime = Math.max(
        toSafeNumber(domain.lastTrackedTime, 0),
        committedThroughAt,
      );
    }
    if (activeCommittedThroughAt !== null) {
      domain.activeCommittedThroughAt = Math.max(
        toSafeNumber(domain.activeCommittedThroughAt, 0),
        activeCommittedThroughAt,
      );
    }
    if (Object.hasOwn(domainDelta, 'activeUsageIntervals')) {
      const previous = Object.hasOwn(domain, 'activeUsageIntervals') ? domain.activeUsageIntervals : [];
      domain.activeUsageIntervals = requireActiveUsageIntervals([...previous, ...domainDelta.activeUsageIntervals].sort((a,b)=>a[0]-b[0]));
    }
  });

  return nextDay;
}

export function applyHourlyBucketToDay(dayData, bucket) {
  return registerPreparedStatsDay(
    applyHourlyBucketToNormalizedDay(normalizeStatsDay(dayData), bucket),
  );
}

export function buildStatsDayFromHourlyBuckets(dateStr, buckets = []) {
  const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
  if (!normalizedDateStr) {
    return registerPreparedStatsDay(createEmptyStatsDay());
  }

  const sortedBuckets = (Array.isArray(buckets) ? buckets : [])
    .filter((bucket) => normalizeStatsDateStr(bucket?.dateStr, null) === normalizedDateStr)
    .slice()
    .sort((a, b) => toSafeNumber(a?.hour, 0) - toSafeNumber(b?.hour, 0));

  let day = createEmptyStatsDay();
  sortedBuckets.forEach((bucket) => {
    day = applyHourlyBucketToNormalizedDay(day, bucket);
  });
  return registerPreparedStatsDay(day);
}
