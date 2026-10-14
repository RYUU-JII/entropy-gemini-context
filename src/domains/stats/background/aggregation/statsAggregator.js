import {
  STATS_REENTRY_GAP_BUCKET_KEYS,
  buildStatsTransitionEdgeKey,
  normalizeHourlyReentryGapBuckets,
  normalizeReentryGapBuckets,
  normalizeStatsDomainKey,
  requireStatsSessionCommitCursor,
} from '../../contracts/statsContracts.js';
import { appendActiveUsageInterval } from '../../contracts/activeUsageIntervals.js';
import {
  HOURLY_BUCKET_COUNT,
  ensureDayScaffold,
  ensureDomainRecord,
  isPlainObject,
  normalizeStatsCategoryId,
  toNonNegative,
  toSafeNumber,
} from './statsAggregateScaffold.js';

const SHORT_REVISIT_2M_MS = 2 * 60 * 1000;
const SHORT_REVISIT_5M_MS = 5 * 60 * 1000;
const SHORT_REVISIT_10M_MS = 10 * 60 * 1000;
const REENTRY_GAP_30M_MS = 30 * 60 * 1000;
const REENTRY_GAP_120M_MS = 120 * 60 * 1000;
const SHORT_SESSION_MS = 2 * 60 * 1000;
const LONG_SESSION_MS = 20 * 60 * 1000;
const INTERVENTION_REENTRY_5M_MS = 5 * 60 * 1000;
const INTERVENTION_REENTRY_30M_MS = 30 * 60 * 1000;
const HIGH_OPEN_TAB_COUNT = 12;

function resolveReentryGapBucketKey(prefix, gapMs) {
  const gap = toNonNegative(gapMs, 0);
  if (gap <= 0 || !['visit', 'switch'].includes(prefix)) return null;
  if (gap <= SHORT_REVISIT_2M_MS) return `${prefix}0To2m`;
  if (gap <= SHORT_REVISIT_5M_MS) return `${prefix}2To5m`;
  if (gap <= SHORT_REVISIT_10M_MS) return `${prefix}5To10m`;
  if (gap <= REENTRY_GAP_30M_MS) return `${prefix}10To30m`;
  if (gap <= REENTRY_GAP_120M_MS) return `${prefix}30To120m`;
  return null;
}

function incrementReentryGapBucket(behavior, bucketKey, hourIdx, count = 1) {
  if (!behavior || !STATS_REENTRY_GAP_BUCKET_KEYS.includes(bucketKey)) return false;
  const step = Math.max(0, Math.floor(toSafeNumber(count, 1)));
  if (step <= 0) return false;
  if (!isPlainObject(behavior.reentryGapBuckets)) {
    behavior.reentryGapBuckets = normalizeReentryGapBuckets(null);
  }
  behavior.reentryGapBuckets[bucketKey] = Math.max(
    0,
    Math.floor(toSafeNumber(behavior.reentryGapBuckets[bucketKey], 0)),
  ) + step;
  if (Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT) {
    if (!isPlainObject(behavior.hourlyReentryGapBuckets) || !Array.isArray(behavior.hourlyReentryGapBuckets[bucketKey])) {
      behavior.hourlyReentryGapBuckets = normalizeHourlyReentryGapBuckets(behavior.hourlyReentryGapBuckets);
    }
    behavior.hourlyReentryGapBuckets[bucketKey][hourIdx] += step;
  }
  return true;
}

function addElapsedByHour(startTs, endTs, applySlice) {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return;

  let cursor = startTs;
  while (cursor < endTs) {
    const cursorDate = new Date(cursor);
    const hourIdx = cursorDate.getHours();
    const nextHour = new Date(cursorDate);
    nextHour.setMinutes(60, 0, 0);
    const sliceEnd = Math.min(endTs, nextHour.getTime());
    const sliceMs = sliceEnd - cursor;
    if (sliceMs > 0) {
      applySlice(hourIdx, sliceMs);
    }
    cursor = sliceEnd;
  }
}

function addElapsedToHourly(domainData, startTs, endTs, isActive) {
  if (!isPlainObject(domainData)) return;
  addElapsedByHour(startTs, endTs, (hourIdx, sliceMs) => {
    domainData.hourly[hourIdx] += sliceMs;
    if (isActive) domainData.hourlyActive[hourIdx] += sliceMs;
    else domainData.hourlyBackground[hourIdx] += sliceMs;
  });
}

function resolveSessionCountHour(endTs, durationMs) {
  if (!Number.isFinite(endTs) || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const countAt = endTs - Math.min(1, durationMs);
  const hour = new Date(countAt).getHours();
  return Number.isInteger(hour) && hour >= 0 && hour < HOURLY_BUCKET_COUNT ? hour : null;
}

export function accumulateDomainElapsed({
  dayData,
  hostname,
  elapsedMs,
  isActive,
  recordActiveIntervals = false,
  now = Date.now(),
  startTs = null,
  isBlockedDomain = false,
  categoryId = 'other',
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) {
    return {
      applied: false,
      created: false,
      appliedElapsedMs: 0,
      appliedStartTs: null,
      coveredByActiveCommitCursor: false,
    };
  }
  const elapsed = toSafeNumber(elapsedMs, 0);
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return {
      applied: false,
      created: false,
      appliedElapsedMs: 0,
      appliedStartTs: null,
      coveredByActiveCommitCursor: false,
    };
  }

  const { domainData, created } = ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now });
  if (!domainData) {
    return {
      applied: false,
      created: false,
      appliedElapsedMs: 0,
      appliedStartTs: null,
      coveredByActiveCommitCursor: false,
    };
  }

  const endTs = toSafeNumber(now, Date.now());
  const requestedStart = Number.isFinite(Number(startTs)) ? Number(startTs) : endTs - elapsed;
  const rawActiveCommitCursor = domainData.activeCommittedThroughAt;
  const activeCommitCursor = (
    rawActiveCommitCursor !== null
    && typeof rawActiveCommitCursor !== 'undefined'
    && Number.isFinite(Number(rawActiveCommitCursor))
    && Number(rawActiveCommitCursor) >= 0
  ) ? Number(rawActiveCommitCursor) : null;
  const effectiveStart = isActive && activeCommitCursor !== null
    ? Math.max(requestedStart, activeCommitCursor)
    : requestedStart;
  const appliedElapsed = Math.max(0, endTs - effectiveStart);
  if (appliedElapsed <= 0) {
    return {
      applied: false,
      created,
      appliedElapsedMs: 0,
      appliedStartTs: effectiveStart,
      coveredByActiveCommitCursor: !!isActive
        && activeCommitCursor !== null
        && activeCommitCursor >= endTs,
    };
  }

  const timeType = isActive ? 'active' : 'background';
  domainData[timeType] += appliedElapsed;

  addElapsedToHourly(domainData, effectiveStart, endTs, !!isActive);

  // Protection charge is an admitted fact, independent of later rule/history
  // classification. Reuse the foreground commit cursor before charging it.
  if (isActive && isBlockedDomain) {
    domainData.protectedActive += appliedElapsed;
    addElapsedByHour(effectiveStart, endTs, (hourIdx, sliceMs) => {
      domainData.hourlyProtectedActive[hourIdx] += sliceMs;
    });
  }

  if (isActive) {
    if (recordActiveIntervals === true) {
      domainData.activeUsageIntervals = appendActiveUsageInterval(
        Object.hasOwn(domainData, 'activeUsageIntervals') ? domainData.activeUsageIntervals : [], effectiveStart, endTs,
      );
    }
    domainData.activeCommittedThroughAt = Math.max(activeCommitCursor ?? 0, endTs);
  } else {
    domainData.lastTrackedTime = endTs;
  }

  ensureDayScaffold(dayData);
  const totalKey = `total${timeType.charAt(0).toUpperCase() + timeType.slice(1)}`;
  dayData.totals[totalKey] = toNonNegative(dayData.totals[totalKey], 0) + appliedElapsed;
  const normalizedCategoryId = normalizeStatsCategoryId(categoryId);
  dayData.byCategory[normalizedCategoryId][timeType] += appliedElapsed;
  addElapsedByHour(effectiveStart, endTs, (hourIdx, sliceMs) => {
    dayData.hourlyRollup[timeType][hourIdx] += sliceMs;
    dayData.hourlyRollup.byCategory[normalizedCategoryId][timeType][hourIdx] += sliceMs;
  });
  if (isBlockedDomain) {
    const blockedKey = `blocked${timeType.charAt(0).toUpperCase() + timeType.slice(1)}`;
    dayData.totals[blockedKey] = toNonNegative(dayData.totals[blockedKey], 0) + appliedElapsed;
  }

  return {
    applied: true,
    created,
    appliedElapsedMs: appliedElapsed,
    appliedStartTs: effectiveStart,
    coveredByActiveCommitCursor: false,
  };
}

export function recordDomainBackgroundPressure({
  dayData,
  hostname,
  mediaMs = 0,
  lingerMs = 0,
  staleMs = 0,
  now = Date.now(),
  startTs = null,
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return { applied: false, created: false };
  const media = toNonNegative(mediaMs, 0);
  const linger = toNonNegative(lingerMs, 0);
  const stale = toNonNegative(staleMs, 0);
  if (media <= 0 && linger <= 0 && stale <= 0) return { applied: false, created: false };

  const { domainData, created } = ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now });
  if (!domainData) return { applied: false, created: false };

  const endTs = toSafeNumber(now, Date.now());
  const maxElapsed = Math.max(media, linger, stale);
  const effectiveStart = Number.isFinite(Number(startTs)) ? Number(startTs) : endTs - maxElapsed;
  const behavior = domainData.behavior;

  behavior.backgroundMediaMs += media;
  behavior.backgroundLingerMs += linger;
  behavior.staleTabMs += stale;

  const addPressureHours = (elapsedMs, hourlyTarget) => {
    if (elapsedMs <= 0) return;
    const pressureStart = Math.max(effectiveStart, endTs - elapsedMs);
    addElapsedByHour(pressureStart, endTs, (hourIdx, sliceMs) => {
      hourlyTarget[hourIdx] += sliceMs;
    });
  };

  addPressureHours(media, behavior.hourlyBackgroundMediaMs);
  addPressureHours(linger, behavior.hourlyBackgroundLingerMs);
  addPressureHours(stale, behavior.hourlyStaleTabMs);

  return { applied: true, created };
}

export function incrementDomainVisit({
  dayData,
  hostname,
  now = Date.now(),
  count = 1,
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const step = Math.max(0, Math.floor(toSafeNumber(count, 1)));
  if (step <= 0) return false;
  const { domainData } = ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now });
  if (!domainData) return false;
  const timestamp = toSafeNumber(now, Date.now());
  const previousVisitAt = toSafeNumber(domainData.behavior?.lastVisitAt, 0);
  const revisitGapMs = previousVisitAt > 0 ? timestamp - previousVisitAt : 0;
  const hourIdx = Number.isFinite(Number(timestamp)) ? new Date(Number(timestamp)).getHours() : null;
  const reentryBucketKey = resolveReentryGapBucketKey('visit', revisitGapMs);

  if (reentryBucketKey) {
    incrementReentryGapBucket(domainData.behavior, reentryBucketKey, hourIdx, step);
  }

  if (revisitGapMs > 0 && revisitGapMs <= SHORT_REVISIT_10M_MS) {
    domainData.behavior.revisitWithin10m += step;
    if (Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT) {
      domainData.behavior.hourlyRevisitWithin10m[hourIdx] += step;
    }
    if (revisitGapMs <= SHORT_REVISIT_5M_MS) {
      domainData.behavior.revisitWithin5m += step;
      if (Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT) {
        domainData.behavior.hourlyRevisitWithin5m[hourIdx] += step;
      }
    }
    if (revisitGapMs <= SHORT_REVISIT_2M_MS) {
      domainData.behavior.revisitWithin2m += step;
      if (Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT) {
        domainData.behavior.hourlyRevisitWithin2m[hourIdx] += step;
      }
    }
  }

  domainData.visits += step;
  if (Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT) {
    domainData.hourlyVisits[hourIdx] += step;
  }
  domainData.behavior.lastVisitAt = timestamp;
  return true;
}

export function recordDomainSwitch({
  dayData,
  fromHostname,
  toHostname,
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const timestamp = toSafeNumber(now, Date.now());
  const fromKey = typeof fromHostname === 'string' ? fromHostname.trim().toLowerCase() : '';
  const toKey = typeof toHostname === 'string' ? toHostname.trim().toLowerCase() : '';
  if (!toKey) return false;

  const hourIdx = Number.isFinite(timestamp) ? new Date(timestamp).getHours() : null;
  const canRecordHour = Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT;
  let changed = false;

  if (fromKey && fromKey !== toKey) {
    const { domainData: fromDomainData } = ensureDomainRecord(dayData, fromKey, {
      createEmptyDomainStats,
      now: timestamp,
    });
    if (fromDomainData) {
      fromDomainData.behavior.switchOuts += 1;
      fromDomainData.behavior.lastExitAt = timestamp;
      if (canRecordHour) {
        fromDomainData.behavior.hourlySwitchOuts[hourIdx] += 1;
      }
      changed = true;
    }
  }

  const { domainData: toDomainData } = ensureDomainRecord(dayData, toKey, {
    createEmptyDomainStats,
    now: timestamp,
  });
  if (!toDomainData) return changed;

  const previousExitAt = toSafeNumber(toDomainData.behavior.lastExitAt, 0);
  const switchBackGapMs = previousExitAt > 0 ? timestamp - previousExitAt : 0;
  const switchBackBucketKey = resolveReentryGapBucketKey('switch', switchBackGapMs);
  toDomainData.behavior.switchIns += 1;
  toDomainData.behavior.lastEntryAt = timestamp;
  if (canRecordHour) {
    toDomainData.behavior.hourlySwitchIns[hourIdx] += 1;
  }
  if (switchBackGapMs > 0 && switchBackGapMs <= SHORT_REVISIT_10M_MS) {
    toDomainData.behavior.switchBackWithin10m += 1;
    if (canRecordHour) {
      toDomainData.behavior.hourlySwitchBackWithin10m[hourIdx] += 1;
    }
  }
  if (switchBackBucketKey) {
    incrementReentryGapBucket(toDomainData.behavior, switchBackBucketKey, hourIdx, 1);
  }

  return true;
}

export function recordDomainTabContext({
  dayData,
  hostname,
  fromNewTab = false,
  sameDomainOpenTabs = 0,
  totalOpenTabs = 0,
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const sameDomainCount = Math.max(0, Math.floor(toSafeNumber(sameDomainOpenTabs, 0)));
  const totalTabCount = Math.max(0, Math.floor(toSafeNumber(totalOpenTabs, 0)));
  const hasSignal = Boolean(fromNewTab) || sameDomainCount > 0 || totalTabCount > 0;
  if (!hasSignal) return false;

  const timestamp = toSafeNumber(now, Date.now());
  const { domainData } = ensureDomainRecord(dayData, hostname, {
    createEmptyDomainStats,
    now: timestamp,
  });
  if (!domainData) return false;

  const hourIdx = Number.isFinite(timestamp) ? new Date(timestamp).getHours() : null;
  const canRecordHour = Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT;
  const behavior = domainData.behavior;

  if (fromNewTab) {
    behavior.newTabEntrances += 1;
    if (canRecordHour) behavior.hourlyNewTabEntrances[hourIdx] += 1;
  }
  if (sameDomainCount >= 2) {
    behavior.duplicateTabEntrances += 1;
    if (canRecordHour) behavior.hourlyDuplicateTabEntrances[hourIdx] += 1;
  }
  if (totalTabCount >= HIGH_OPEN_TAB_COUNT) {
    behavior.highOpenTabEntrances += 1;
    if (canRecordHour) behavior.hourlyHighOpenTabEntrances[hourIdx] += 1;
  }

  behavior.maxSameDomainOpenTabs = Math.max(behavior.maxSameDomainOpenTabs, sameDomainCount);
  behavior.maxOpenTabs = Math.max(behavior.maxOpenTabs, totalTabCount);
  behavior.lastTabContextAt = timestamp;
  if (canRecordHour) {
    behavior.hourlyMaxSameDomainOpenTabs[hourIdx] = Math.max(
      behavior.hourlyMaxSameDomainOpenTabs[hourIdx],
      sameDomainCount,
    );
    behavior.hourlyMaxOpenTabs[hourIdx] = Math.max(
      behavior.hourlyMaxOpenTabs[hourIdx],
      totalTabCount,
    );
  }

  return true;
}

export function recordDomainContentFlow({
  dayData,
  hostname,
  scrollSpikeBursts = 0,
  fastScrollBursts = 0,
  feedPressureSignals = 0,
  feedInterruptSignals = 0,
  feedAdvanceBursts = 0,
  feedSkimSignals = 0,
  shortMediaAttentionSignals = 0,
  shortMediaWatchMs = 0,
  maxFeedScreenfuls = 0,
  maxFeedItemTransitions = 0,
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;

  const deltas = {
    scrollSpikeBursts: Math.max(0, Math.floor(toSafeNumber(scrollSpikeBursts, 0))),
    fastScrollBursts: Math.max(0, Math.floor(toSafeNumber(fastScrollBursts, 0))),
    feedPressureSignals: Math.max(0, Math.floor(toSafeNumber(feedPressureSignals, 0))),
    feedInterruptSignals: Math.max(0, Math.floor(toSafeNumber(feedInterruptSignals, 0))),
    feedAdvanceBursts: Math.max(0, Math.floor(toSafeNumber(feedAdvanceBursts, 0))),
    feedSkimSignals: Math.max(0, Math.floor(toSafeNumber(feedSkimSignals, 0))),
    shortMediaAttentionSignals: Math.max(0, Math.floor(toSafeNumber(shortMediaAttentionSignals, 0))),
  };
  const durations = {
    shortMediaWatchMs: toNonNegative(shortMediaWatchMs, 0),
  };
  const maxes = {
    maxFeedScreenfuls: toNonNegative(maxFeedScreenfuls, 0),
    maxFeedItemTransitions: Math.max(0, Math.floor(toSafeNumber(maxFeedItemTransitions, 0))),
  };
  const hasSignal = Object.values(deltas).some((value) => value > 0)
    || Object.values(durations).some((value) => value > 0)
    || Object.values(maxes).some((value) => value > 0);
  if (!hasSignal) return false;

  const timestamp = toSafeNumber(now, Date.now());
  const { domainData } = ensureDomainRecord(dayData, hostname, {
    createEmptyDomainStats,
    now: timestamp,
  });
  if (!domainData) return false;

  const hourIdx = Number.isFinite(timestamp) ? new Date(timestamp).getHours() : null;
  const canRecordHour = Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT;
  const behavior = domainData.behavior;

  behavior.scrollSpikeBursts += deltas.scrollSpikeBursts;
  behavior.fastScrollBursts += deltas.fastScrollBursts;
  behavior.feedPressureSignals += deltas.feedPressureSignals;
  behavior.feedInterruptSignals += deltas.feedInterruptSignals;
  behavior.feedAdvanceBursts += deltas.feedAdvanceBursts;
  behavior.feedSkimSignals += deltas.feedSkimSignals;
  behavior.shortMediaAttentionSignals += deltas.shortMediaAttentionSignals;
  behavior.shortMediaWatchMs += durations.shortMediaWatchMs;
  behavior.maxFeedScreenfuls = Math.max(behavior.maxFeedScreenfuls, maxes.maxFeedScreenfuls);
  behavior.maxFeedItemTransitions = Math.max(
    behavior.maxFeedItemTransitions,
    maxes.maxFeedItemTransitions,
  );
  behavior.lastContentFlowAt = timestamp;

  if (canRecordHour) {
    behavior.hourlyScrollSpikeBursts[hourIdx] += deltas.scrollSpikeBursts;
    behavior.hourlyFastScrollBursts[hourIdx] += deltas.fastScrollBursts;
    behavior.hourlyFeedPressureSignals[hourIdx] += deltas.feedPressureSignals;
    behavior.hourlyFeedInterruptSignals[hourIdx] += deltas.feedInterruptSignals;
    behavior.hourlyFeedAdvanceBursts[hourIdx] += deltas.feedAdvanceBursts;
    behavior.hourlyFeedSkimSignals[hourIdx] += deltas.feedSkimSignals;
    behavior.hourlyShortMediaAttentionSignals[hourIdx] += deltas.shortMediaAttentionSignals;
    behavior.hourlyShortMediaWatchMs[hourIdx] += durations.shortMediaWatchMs;
    behavior.hourlyMaxFeedScreenfuls[hourIdx] = Math.max(
      behavior.hourlyMaxFeedScreenfuls[hourIdx],
      maxes.maxFeedScreenfuls,
    );
    behavior.hourlyMaxFeedItemTransitions[hourIdx] = Math.max(
      behavior.hourlyMaxFeedItemTransitions[hourIdx],
      maxes.maxFeedItemTransitions,
    );
  }

  return true;
}

export function incrementDaySwitch(dayData, switchKey, now = Date.now()) {
  if (!isPlainObject(dayData)) return false;
  ensureDayScaffold(dayData);
  const key = typeof switchKey === 'string' && switchKey.trim().length > 0 ? switchKey.trim() : 'internal';
  if (!Number.isFinite(Number(dayData.switches[key]))) {
    dayData.switches[key] = 0;
  }
  dayData.switches[key] += 1;
  const hourIdx = Number.isFinite(Number(now)) ? new Date(Number(now)).getHours() : null;
  if (Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT) {
    if (!Array.isArray(dayData.hourlyRollup.switches[key])) {
      dayData.hourlyRollup.switches[key] = Array(HOURLY_BUCKET_COUNT).fill(0);
    }
    dayData.hourlyRollup.switches[key][hourIdx] += 1;
  }
  return true;
}

function incrementStatsTransitionEdge({
  dayData,
  fromDomain,
  toDomain,
  returnWithin10m = false,
  now = Date.now(),
} = {}) {
  const edgeKey = buildStatsTransitionEdgeKey({ fromDomain, toDomain });
  if (!edgeKey) return false;
  const timestamp = toSafeNumber(now, Date.now());
  const hour = new Date(timestamp).getHours();
  if (!Number.isInteger(hour) || hour < 0 || hour >= HOURLY_BUCKET_COUNT) {
    throw new Error('STATS_TRANSITION_EDGE_HOUR_INVALID');
  }
  if (!dayData.transitionEdges[edgeKey]) {
    dayData.transitionEdges[edgeKey] = {
      fromDomain,
      toDomain,
      count: 0,
      returnWithin10m: 0,
      hourlyCounts: Array(HOURLY_BUCKET_COUNT).fill(0),
      hourlyReturnWithin10m: Array(HOURLY_BUCKET_COUNT).fill(0),
    };
  }
  const edge = dayData.transitionEdges[edgeKey];
  edge.count += 1;
  edge.hourlyCounts[hour] += 1;
  if (returnWithin10m) {
    edge.returnWithin10m += 1;
    edge.hourlyReturnWithin10m[hour] += 1;
  }
  return true;
}

export function recordStatsSwitch({
  dayData,
  switchKey,
  fromHostname = null,
  toHostname = null,
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const timestamp = toSafeNumber(now, Date.now());
  const fromDomain = normalizeStatsDomainKey(fromHostname);
  const toDomain = normalizeStatsDomainKey(toHostname);
  if (!toDomain) return false;

  const previousExitAt = toSafeNumber(
    dayData?.domains?.[toDomain]?.behavior?.lastExitAt,
    0,
  );
  const returnWithin10m = previousExitAt > 0
    && timestamp > previousExitAt
    && timestamp - previousExitAt <= SHORT_REVISIT_10M_MS;
  const dayChanged = incrementDaySwitch(dayData, switchKey, timestamp);
  const domainChanged = recordDomainSwitch({
    dayData,
    fromHostname: fromDomain,
    toHostname: toDomain,
    now: timestamp,
    createEmptyDomainStats,
  });

  if (fromDomain && fromDomain !== toDomain) {
    incrementStatsTransitionEdge({
      dayData,
      fromDomain,
      toDomain,
      returnWithin10m,
      now: timestamp,
    });
  }
  return Boolean(dayChanged || domainChanged);
}

export function incrementDaySession(dayData, durationMs, now = Date.now()) {
  if (!isPlainObject(dayData)) return false;
  const duration = toSafeNumber(durationMs, 0);
  if (!Number.isFinite(duration) || duration <= 0) return false;
  ensureDayScaffold(dayData);
  dayData.sessions.count += 1;
  dayData.sessions.totalMs += duration;
  const endTs = toSafeNumber(now, Date.now());
  const startTs = endTs - duration;
  addElapsedByHour(startTs, endTs, (hourIdx, sliceMs) => {
    dayData.hourlyRollup.sessions.totalMs[hourIdx] += sliceMs;
  });
  const countHour = resolveSessionCountHour(endTs, duration);
  if (Number.isInteger(countHour) && countHour >= 0 && countHour < HOURLY_BUCKET_COUNT) {
    dayData.hourlyRollup.sessions.count[countHour] += 1;
  }
  return true;
}

export function incrementDomainSession({
  dayData,
  hostname,
  durationMs,
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const duration = toSafeNumber(durationMs, 0);
  if (!Number.isFinite(duration) || duration <= 0) return false;
  const { domainData } = ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now });
  if (!domainData) return false;

  domainData.sessions.count += 1;
  domainData.sessions.totalMs += duration;
  domainData.sessions.maxMs = Math.max(toNonNegative(domainData.sessions.maxMs, 0), duration);

  const endTs = toSafeNumber(now, Date.now());
  const countHour = resolveSessionCountHour(endTs, duration);
  if (Number.isInteger(countHour) && countHour >= 0 && countHour < HOURLY_BUCKET_COUNT) {
    domainData.sessions.hourlyCount[countHour] += 1;
    domainData.sessions.hourlyMaxMs[countHour] = Math.max(
      toNonNegative(domainData.sessions.hourlyMaxMs[countHour], 0),
      duration,
    );
    if (duration < SHORT_SESSION_MS) {
      domainData.sessions.shortCount += 1;
      domainData.sessions.hourlyShortCount[countHour] += 1;
    }
    if (duration >= LONG_SESSION_MS) {
      domainData.sessions.longCount += 1;
      domainData.sessions.hourlyLongCount[countHour] += 1;
    }
  } else {
    if (duration < SHORT_SESSION_MS) domainData.sessions.shortCount += 1;
    if (duration >= LONG_SESSION_MS) domainData.sessions.longCount += 1;
  }

  const startTs = endTs - duration;
  addElapsedByHour(startTs, endTs, (hourIdx, sliceMs) => {
    domainData.sessions.hourlyTotalMs[hourIdx] += sliceMs;
  });

  return true;
}

export function recordSessionCommit({
  dayData,
  hostname,
  sessionId,
  startedAt,
  endedAt,
  durationMs,
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return { applied: false, duplicate: false };
  const normalizedHostname = normalizeStatsDomainKey(hostname);
  if (!normalizedHostname || normalizedHostname !== hostname) {
    const error = new Error('STATS_SESSION_COMMIT_HOSTNAME_INVALID');
    error.code = 'STATS_SESSION_COMMIT_HOSTNAME_INVALID';
    throw error;
  }
  if (
    !Number.isSafeInteger(startedAt)
    || startedAt < 0
    || !Number.isSafeInteger(endedAt)
    || endedAt <= startedAt
    || !Number.isSafeInteger(durationMs)
    || durationMs !== endedAt - startedAt
  ) {
    const error = new Error('STATS_SESSION_COMMIT_DURATION_INVALID');
    error.code = 'STATS_SESSION_COMMIT_DURATION_INVALID';
    throw error;
  }

  const nextCommit = requireStatsSessionCommitCursor({ sessionId, endedAt });
  ensureDayScaffold(dayData);
  const previousCommit = requireStatsSessionCommitCursor(dayData.sessions.lastCommit);
  if (previousCommit?.sessionId === nextCommit.sessionId) {
    if (previousCommit.endedAt !== nextCommit.endedAt) {
      const error = new Error('STATS_SESSION_COMMIT_ID_CONFLICT');
      error.code = 'STATS_SESSION_COMMIT_ID_CONFLICT';
      throw error;
    }
    return { applied: false, duplicate: true };
  }
  if (previousCommit && nextCommit.endedAt === previousCommit.endedAt) {
    const error = new Error('STATS_SESSION_COMMIT_CURSOR_CONFLICT');
    error.code = 'STATS_SESSION_COMMIT_CURSOR_CONFLICT';
    throw error;
  }
  if (previousCommit && nextCommit.endedAt < previousCommit.endedAt) {
    const error = new Error('STATS_SESSION_COMMIT_OUT_OF_ORDER');
    error.code = 'STATS_SESSION_COMMIT_OUT_OF_ORDER';
    throw error;
  }

  const { domainData } = ensureDomainRecord(dayData, normalizedHostname, {
    createEmptyDomainStats,
    now: endedAt,
  });
  if (!domainData) {
    const error = new Error('STATS_SESSION_COMMIT_DOMAIN_UNAVAILABLE');
    error.code = 'STATS_SESSION_COMMIT_DOMAIN_UNAVAILABLE';
    throw error;
  }
  const daySessionResult = incrementDaySession(dayData, durationMs, endedAt);
  const domainSessionResult = incrementDomainSession({
    dayData,
    hostname: normalizedHostname,
    durationMs,
    now: endedAt,
    createEmptyDomainStats,
  });
  if (!daySessionResult || !domainSessionResult) {
    const error = new Error('STATS_SESSION_COMMIT_APPLY_FAILED');
    error.code = 'STATS_SESSION_COMMIT_APPLY_FAILED';
    throw error;
  }
  dayData.sessions.lastCommit = nextCommit;
  return { applied: true, duplicate: false };
}

export function recordDomainIntervention({
  dayData,
  hostname,
  type,
  now = Date.now(),
  shownAt = null,
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
  const timestamp = toSafeNumber(now, Date.now());
  const { domainData } = ensureDomainRecord(dayData, hostname, {
    createEmptyDomainStats,
    now: timestamp,
  });
  if (!domainData) return false;

  const hourIdx = Number.isFinite(timestamp) ? new Date(timestamp).getHours() : null;
  const canRecordHour = Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT;
  const interventions = domainData.interventions;

  if (normalizedType === 'friction_shown' || normalizedType === 'shown') {
    interventions.frictionShown += 1;
    interventions.lastShownAt = timestamp;
    if (canRecordHour) interventions.hourlyFrictionShown[hourIdx] += 1;
    return true;
  }

  if (normalizedType === 'continued' || normalizedType === 'continue') {
    interventions.continued += 1;
    interventions.lastContinuedAt = timestamp;
    if (canRecordHour) interventions.hourlyContinued[hourIdx] += 1;
    return true;
  }

  if (normalizedType === 'left' || normalizedType === 'leave') {
    interventions.left += 1;
    interventions.lastLeftAt = timestamp;
    if (canRecordHour) interventions.hourlyLeft[hourIdx] += 1;
    return true;
  }

  if (normalizedType === 'escape_closed' || normalizedType === 'escape') {
    interventions.escapeClosed += 1;
    if (canRecordHour) interventions.hourlyEscapeClosed[hourIdx] += 1;
    return true;
  }

  if (normalizedType === 'reentered' || normalizedType === 'reentry') {
    const explicitShownAt = Number.isFinite(Number(shownAt)) ? Number(shownAt) : 0;
    const anchor = explicitShownAt
      || toSafeNumber(interventions.lastShownAt, 0)
      || toSafeNumber(interventions.lastContinuedAt, 0);
    const elapsed = anchor > 0 ? timestamp - anchor : 0;
    interventions.lastReenteredAt = timestamp;
    if (elapsed > 0 && elapsed <= INTERVENTION_REENTRY_30M_MS) {
      interventions.reenteredWithin30m += 1;
      if (canRecordHour) interventions.hourlyReenteredWithin30m[hourIdx] += 1;
      if (elapsed <= INTERVENTION_REENTRY_5M_MS) {
        interventions.reenteredWithin5m += 1;
        if (canRecordHour) interventions.hourlyReenteredWithin5m[hourIdx] += 1;
      }
    }
    return true;
  }

  return false;
}

function normalizeTransitionType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  switch (normalized) {
    case 'link':
      return 'link';
    case 'typed':
      return 'typed';
    case 'reload':
      return 'reload';
    case 'generated':
    case 'keyword_generated':
      return 'generated';
    case 'keyword':
      return 'keyword';
    case 'form_submit':
      return 'formSubmit';
    case 'start_page':
      return 'startPage';
    case 'auto_bookmark':
      return 'autoBookmark';
    default:
      return 'other';
  }
}

function normalizeTransitionQualifiers(value) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : '')).filter(Boolean)
    : [];
}

function navigationHourlyKeyForType(type) {
  switch (type) {
    case 'link':
      return 'hourlyLink';
    case 'typed':
      return 'hourlyTyped';
    case 'reload':
      return 'hourlyReload';
    case 'generated':
      return 'hourlyGenerated';
    case 'keyword':
      return 'hourlyKeyword';
    case 'formSubmit':
      return 'hourlyFormSubmit';
    case 'startPage':
      return 'hourlyStartPage';
    case 'autoBookmark':
      return 'hourlyAutoBookmark';
    default:
      return 'hourlyOther';
  }
}

export function recordDomainNavigationIntent({
  dayData,
  hostname,
  transitionType,
  transitionQualifiers = [],
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return false;
  const timestamp = toSafeNumber(now, Date.now());
  const { domainData } = ensureDomainRecord(dayData, hostname, {
    createEmptyDomainStats,
    now: timestamp,
  });
  if (!domainData) return false;

  const navigation = domainData.navigation;
  const typeKey = normalizeTransitionType(transitionType);
  const qualifiers = normalizeTransitionQualifiers(transitionQualifiers);
  const hourIdx = Number.isFinite(timestamp) ? new Date(timestamp).getHours() : null;
  const canRecordHour = Number.isInteger(hourIdx) && hourIdx >= 0 && hourIdx < HOURLY_BUCKET_COUNT;

  navigation.total += 1;
  navigation[typeKey] += 1;
  navigation.lastNavigationAt = timestamp;

  if (qualifiers.includes('from_address_bar')) {
    navigation.addressBar += 1;
  }
  if (qualifiers.includes('forward_back')) {
    navigation.forwardBack += 1;
  }

  if (canRecordHour) {
    navigation.hourlyTotal[hourIdx] += 1;
    navigation[navigationHourlyKeyForType(typeKey)][hourIdx] += 1;
    if (qualifiers.includes('from_address_bar')) {
      navigation.hourlyAddressBar[hourIdx] += 1;
    }
    if (qualifiers.includes('forward_back')) {
      navigation.hourlyForwardBack[hourIdx] += 1;
    }
  }

  return true;
}
