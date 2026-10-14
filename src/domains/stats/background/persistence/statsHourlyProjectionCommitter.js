import { getLocalDateStr } from '../../../../lib/index.js';
import {
  STATS_HOURLY_BUCKET_STATUS,
  buildHourlyBucketFromDay,
  prepareStatsDayForHourlyMaterialization,
} from './statsBucketMaterializer.js';

function normalizeHour(value) {
  const numeric = Math.floor(Number(value));
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 23) return null;
  return numeric;
}

function normalizeHours(hours = []) {
  const source = Array.isArray(hours) ? hours : [hours];
  return Array.from(new Set(
    source
      .map(normalizeHour)
      .filter((hour) => hour !== null),
  )).sort((left, right) => left - right);
}

function normalizeSealedThroughHour(value) {
  const hour = Math.floor(Number(value));
  if (!Number.isInteger(hour)) return -1;
  if (hour < -1) return -1;
  if (hour > 23) return 23;
  return hour;
}

function listClosedHours(startHour, endHour) {
  const start = Number.isFinite(Number(startHour)) ? Math.max(0, Math.floor(Number(startHour))) : 0;
  const end = Number.isFinite(Number(endHour)) ? Math.min(23, Math.floor(Number(endHour))) : -1;
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function createMaterializationMetrics() {
  return {
    dayNormalizations: 0,
    preparedDayUses: 0,
    domainsVisited: 0,
    transitionEdgesVisited: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fullDomainScans: 0,
    selectiveDomainScans: 0,
    fullTransitionEdgeScans: 0,
    selectiveTransitionEdgeScans: 0,
  };
}

function hasEnumerableKey(value) {
  if (!value || typeof value !== 'object') return false;
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  }
  return false;
}

function hasStatsHourBucketFacts(bucket) {
  if (!bucket) return false;
  const hasDomainDelta = hasEnumerableKey(bucket.domainsDelta);
  const hasTotalsDelta = (
    bucket.feedHistoryReceipts?.length > 0
    || bucket.interventionHistoryReceipts?.length > 0
    || Object.hasOwn(bucket, 'feedHistoryResetAt')
    || Number(bucket.totalsDelta?.totalActive) > 0
    || Number(bucket.totalsDelta?.totalBackground) > 0
    || Number(bucket.sessionsDelta?.count) > 0
    || Number(bucket.sessionsDelta?.totalMs) > 0
    || bucket.sessionsDelta?.lastCommit !== null
    || Object.values(bucket.switchesDelta).some((value) => Number(value) > 0)
    || hasEnumerableKey(bucket.transitionEdgesDelta)
  );
  return hasDomainDelta || hasTotalsDelta;
}

function normalizeDirtyHourScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  const normalizeKeys = (keys) => Array.from(new Set(
    (Array.isArray(keys) ? keys : [])
      .filter((key) => typeof key === 'string' && key),
  ));
  return {
    fullDomains: scope.fullDomains === true,
    fullTransitionEdges: scope.fullTransitionEdges === true,
    domainKeys: normalizeKeys(scope.domainKeys),
    transitionEdgeKeys: normalizeKeys(scope.transitionEdgeKeys),
  };
}

function createFullDirtyHourScope() {
  return {
    fullDomains: true,
    fullTransitionEdges: true,
    domainKeys: [],
    transitionEdgeKeys: [],
  };
}

export function buildStatsHourBucketsForRange(
  dateStr,
  dayData,
  startHour,
  endHour,
  sealedAt = Date.now(),
  { status, materializationMetrics = null } = {},
) {
  const buckets = [];
  const normalizedStartHour = Number.isFinite(Number(startHour)) ? Math.max(0, Math.floor(Number(startHour))) : 0;
  const normalizedEndHour = Number.isFinite(Number(endHour)) ? Math.min(23, Math.floor(Number(endHour))) : 23;
  if (normalizedEndHour < normalizedStartHour) return buckets;
  const preparedDay = prepareStatsDayForHourlyMaterialization(dayData, {
    now: sealedAt,
    materializationMetrics,
  });

  for (let hour = normalizedStartHour; hour <= normalizedEndHour; hour += 1) {
    const bucket = buildHourlyBucketFromDay({
      dateStr,
      hour,
      dayData: preparedDay,
      sealedAt,
      status,
      materializationMetrics,
    });
    if (!bucket) continue;
    if (!hasStatsHourBucketFacts(bucket)) continue;
    buckets.push(bucket);
  }

  return buckets;
}

function listCommittedHours(buckets = []) {
  return normalizeHours(
    (Array.isArray(buckets) ? buckets : [])
      .map((bucket) => bucket?.hour),
  );
}

export function createStatsHourlyProjectionCommitter({
  statsAggregateRepository,
} = {}) {
  const aggregateStore = statsAggregateRepository;
  const upsertHourlyFactBuckets = aggregateStore?.upsertHourlyFactBuckets;
  const finalizeHistoricalDayFacts = aggregateStore?.finalizeHistoricalDayFacts;
  const finalizeRecoveredHistoricalDayFacts = aggregateStore
    ?.finalizeRecoveredHistoricalDayFacts;
  if (
    !aggregateStore
    || typeof upsertHourlyFactBuckets !== 'function'
    || typeof finalizeHistoricalDayFacts !== 'function'
    || typeof finalizeRecoveredHistoricalDayFacts !== 'function'
  ) {
    throw new Error('STATS_HOURLY_PROJECTION_COMMITTER_REPOSITORY_REQUIRED');
  }
  const materializedHourCache = new Map();

  function materializeCurrentDayHour({
    dateStr,
    dayData,
    hour,
    now,
    status,
    dirtyScope,
    metrics,
  }) {
    const cacheKey = `${dateStr}:${hour}`;
    const cached = materializedHourCache.get(cacheKey);
    const canReuse = cached?.dayData === dayData && !!cached?.bucket;
    const scope = normalizeDirtyHourScope(dirtyScope);
    const rebuildAll = !canReuse;
    const fullDomains = rebuildAll || scope?.fullDomains === true;
    const fullTransitionEdges = rebuildAll || scope?.fullTransitionEdges === true;

    if (canReuse) metrics.cacheHits += 1;
    else metrics.cacheMisses += 1;
    if (fullDomains) metrics.fullDomainScans += 1;
    else metrics.selectiveDomainScans += 1;
    if (fullTransitionEdges) metrics.fullTransitionEdgeScans += 1;
    else metrics.selectiveTransitionEdgeScans += 1;

    const bucket = buildHourlyBucketFromDay({
      dateStr,
      hour,
      dayData,
      sealedAt: now,
      status,
      domainKeys: fullDomains ? null : (scope?.domainKeys || []),
      transitionEdgeKeys: fullTransitionEdges ? null : (scope?.transitionEdgeKeys || []),
      baseDomainsDelta: fullDomains ? null : cached.bucket.domainsDelta,
      baseTransitionEdgesDelta: fullTransitionEdges
        ? null
        : cached.bucket.transitionEdgesDelta,
      materializationMetrics: metrics,
    });
    if (!bucket) {
      materializedHourCache.delete(cacheKey);
      return null;
    }
    materializedHourCache.set(cacheKey, { bucket, dayData });
    if (!hasStatsHourBucketFacts(bucket)) return null;
    // Commits are serialized and the store consumes this prepared bucket in
    // the synchronous transaction-put turn. Reuse the cache-owned maps instead
    // of copying the entire domain graph for a one-domain patch.
    return bucket;
  }

  function clearMaterializedDate(dateStr) {
    const prefix = `${dateStr}:`;
    Array.from(materializedHourCache.keys()).forEach((key) => {
      if (key.startsWith(prefix)) materializedHourCache.delete(key);
    });
  }

  async function commitCurrentDayProjection({
    dateStr,
    dayData,
    dirtyHours = [],
    dirtyHourScopes = {},
    sealedThroughHour = -1,
    now = Date.now(),
    closeUnfinalizedDay = false,
  } = {}) {
    const metrics = createMaterializationMetrics();
    const preparedDay = prepareStatsDayForHourlyMaterialization(dayData, {
      now,
      materializationMetrics: metrics,
    });
    const currentHour = closeUnfinalizedDay ? 24 : new Date(now).getHours();
    const maxClosedHour = Math.max(-1, currentHour - 1);
    const normalizedSealedThroughHour = normalizeSealedThroughHour(sealedThroughHour);
    const newlyClosedHours = listClosedHours(normalizedSealedThroughHour + 1, maxClosedHour);
    const dirtyClosedHours = normalizeHours(dirtyHours).filter((hour) => hour <= maxClosedHour);
    const sealedHours = normalizeHours([
      ...newlyClosedHours,
      ...dirtyClosedHours,
    ]);
    const dirtyHourSet = new Set(normalizeHours(dirtyHours));
    // The current open row is a recovery checkpoint, not a save heartbeat.
    // Rewriting it when only a closed hour changed (or for a clean forced
    // drain) pays IndexedDB's O(full row) structured-clone cost for no new
    // facts. Persist it only when this hour is part of the mutation set.
    const openHours = dirtyHourSet.has(currentHour) ? [currentHour] : [];
    const resolveDirtyScope = (hour) => {
      if (!dirtyHourSet.has(hour)) return null;
      return normalizeDirtyHourScope(dirtyHourScopes?.[hour]) || createFullDirtyHourScope();
    };
    const buckets = [];
    sealedHours.forEach((hour) => {
      const bucket = materializeCurrentDayHour({
        dateStr,
        dayData: preparedDay,
        hour,
        now,
        status: STATS_HOURLY_BUCKET_STATUS.SEALED,
        dirtyScope: resolveDirtyScope(hour),
        metrics,
      });
      if (bucket) buckets.push(bucket);
    });
    openHours.forEach((hour) => {
      const bucket = materializeCurrentDayHour({
        dateStr,
        dayData: preparedDay,
        hour,
        now,
        status: STATS_HOURLY_BUCKET_STATUS.OPEN,
        dirtyScope: resolveDirtyScope(hour),
        metrics,
      });
      if (bucket) buckets.push(bucket);
    });

    if (buckets.length > 0) {
      await upsertHourlyFactBuckets.call(aggregateStore, buckets);
    }

    const committedHours = listCommittedHours(buckets);
    return {
      dateStr,
      committedHours,
      didWriteFacts: buckets.length > 0,
      persistedBucketCount: buckets.length,
      sealedThroughHour: Math.max(normalizedSealedThroughHour, maxClosedHour),
      status: dateStr === getLocalDateStr(now) ? 'current_day' : 'current_projection',
      materialization: metrics,
    };
  }

  async function commitHistoricalDayProjection({
    dateStr,
    dayData,
    now = Date.now(),
    sourceHourlyRevision = 0,
  } = {}) {
    const metrics = createMaterializationMetrics();
    const hourlyBuckets = buildStatsHourBucketsForRange(dateStr, dayData, 0, 23, now, {
      status: STATS_HOURLY_BUCKET_STATUS.SEALED,
      materializationMetrics: metrics,
    });
    await finalizeHistoricalDayFacts.call(aggregateStore, {
      hourlyBuckets,
      dailySummary: {
        dateStr,
        dayData,
        finalizedAt: now,
        sourceHourlyRevision,
      },
    });

    const result = {
      dateStr,
      committedHours: listCommittedHours(hourlyBuckets),
      // The atomic finalizer always writes the canonical daily summary, even
      // when the day has no hourly facts.
      didWriteFacts: true,
      persistedBucketCount: hourlyBuckets.length,
      sealedThroughHour: 23,
      status: 'historical_day',
      materialization: metrics,
    };
    clearMaterializedDate(dateStr);
    return result;
  }

  async function commitRecoveredHistoricalDayProjection({
    dateStr,
    dayData,
    hourlyBuckets,
    now = Date.now(),
    sourceHourlyRevision = 0,
  } = {}) {
    const committedHours = listCommittedHours(hourlyBuckets);
    const finalizeResult = await finalizeRecoveredHistoricalDayFacts.call(aggregateStore, {
      hourlyBuckets,
      dailySummary: {
        dateStr,
        dayData,
        finalizedAt: now,
        sourceHourlyRevision,
      },
    });
    const hourlyBucketCount = Number(finalizeResult?.hourlyBucketCount);
    const reusedHourlyBucketCount = Number(finalizeResult?.reusedHourlyBucketCount);
    const sealedUpdatedBucketCount = Number(finalizeResult?.sealedUpdatedBucketCount);
    if (
      finalizeResult?.dateStr !== dateStr
      || !Number.isInteger(hourlyBucketCount)
      || hourlyBucketCount !== committedHours.length
      || !Number.isInteger(reusedHourlyBucketCount)
      || reusedHourlyBucketCount < 0
      || !Number.isInteger(sealedUpdatedBucketCount)
      || sealedUpdatedBucketCount < 0
      || reusedHourlyBucketCount + sealedUpdatedBucketCount !== hourlyBucketCount
    ) {
      throw new Error('STATS_HOURLY_PROJECTION_RECOVERY_FINALIZE_RESULT_INVALID');
    }

    clearMaterializedDate(dateStr);
    return {
      dateStr,
      committedHours,
      // Recovery finalization always installs the missing daily summary. The
      // hourly write count may still be zero when every row was already sealed.
      didWriteFacts: true,
      persistedBucketCount: sealedUpdatedBucketCount,
      reusedHourlyBucketCount,
      sealedUpdatedBucketCount,
      sealedThroughHour: 23,
      status: 'recovered_historical_day',
      materialization: createMaterializationMetrics(),
    };
  }

  return {
    commitCurrentDayProjection,
    commitUnfinalizedDayProjection: (options) => commitCurrentDayProjection({
      ...options,
      closeUnfinalizedDay: true,
    }),
    commitHistoricalDayProjection,
    commitRecoveredHistoricalDayProjection,
  };
}
