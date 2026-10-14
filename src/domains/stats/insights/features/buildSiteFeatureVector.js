import { assertSiteAnalysisSourceInput } from '../contracts/siteAnalysisInputContract.js';
import { deriveSiteGoalMetrics, resolveSiteGoalContext } from '../contracts/siteGoalContext.js';
import { hasSitePullInterventionResponse } from '../sitePull/sitePullInterventionFacts.js';
import {
  STATS_REENTRY_GAP_BUCKET_KEYS,
  requireStatsDomainCollectionObservation,
} from '../../contracts/statsContracts.js';
import {
  deriveWeeklyObservationSummary,
  requireWeeklyObservationState,
  selectObservedWeeklyEntries,
} from '../contracts/weeklyObservationContract.js';
import { normalizeSitePullBaselineSeriesSource } from '../sitePull/baselineSeriesSource.js';

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeReentryGapBuckets(source = {}) {
  const buckets = source && typeof source === 'object' ? source : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = Math.max(0, Math.floor(toNumber(buckets[key])));
    return result;
  }, {});
}

function sumReentryGapBuckets(entries = []) {
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.reentryGapBuckets?.[key]), 0);
    return result;
  }, {});
}

function computePeakIndex(values = []) {
  return values.reduce(
    (best, value, index) => (value > best.value ? { index, value } : best),
    { index: null, value: 0 },
  ).index;
}

function computeDominantWindow(values = [], windowSize = 3) {
  const safeValues = Array.isArray(values)
    ? values.map((value) => toNumber(value))
    : [];
  if (!safeValues.some((value) => value > 0)) return null;

  const safeWindowSize = Math.max(1, Math.min(safeValues.length, Math.floor(windowSize) || 1));
  let bestStart = 0;
  let bestTotal = -1;

  for (let index = 0; index <= safeValues.length - safeWindowSize; index += 1) {
    const total = safeValues
      .slice(index, index + safeWindowSize)
      .reduce((sum, value) => sum + value, 0);
    if (total > bestTotal) {
      bestStart = index;
      bestTotal = total;
    }
  }

  return {
    startHour: bestStart,
    endHour: bestStart + safeWindowSize,
    totalMs: Math.max(0, bestTotal),
  };
}

function normalize24hSeries(values = []) {
  return Array.from({ length: 24 }, (_, hour) => toNumber(values?.[hour]));
}

function normalize24hCountSeries(values = []) {
  return normalize24hSeries(values).map((value) => Math.max(0, Math.floor(value)));
}

function normalizeWeeklySeries(values) {
  if (!Array.isArray(values)) {
    selectObservedWeeklyEntries(values, { source: 'buildSiteFeatureVector.weeklySeries' });
  }
  return values.map((entry, index) => {
    const collectionObservation = requireStatsDomainCollectionObservation(
      entry?.collectionObservation,
      { source: `buildSiteFeatureVector.weeklySeries[${index}].collectionObservation` },
    );
    const observed = requireWeeklyObservationState(entry, index, {
      source: 'buildSiteFeatureVector.weeklySeries',
    });
    if (observed !== collectionObservation.observed) {
      throw new Error(`SITE_FEATURE_VECTOR_WEEKLY_COLLECTION_RELATION_INVALID:${index}`);
    }
    return {
      dateStr: typeof entry?.dateStr === 'string' ? entry.dateStr : '',
      label: typeof entry?.label === 'string' ? entry.label : '',
      collectionObservation,
      activeMs: toNumber(entry?.activeMs),
      visits: Math.max(0, Math.floor(toNumber(entry?.visits))),
      sessions: normalizeSessionStats(entry?.sessions),
      behavior: normalizeBehaviorStats(entry?.behavior),
      interventions: normalizeInterventionStats(entry?.interventions),
      navigation: normalizeNavigationStats(entry?.navigation),
      overLimit: Boolean(entry?.overLimit),
      observed,
    };
  });
}

function normalizeSessionStats(source = {}) {
  return {
    count: Math.max(0, Math.floor(toNumber(source?.count))),
    totalMs: toNumber(source?.totalMs),
    shortCount: Math.max(0, Math.floor(toNumber(source?.shortCount))),
    longCount: Math.max(0, Math.floor(toNumber(source?.longCount))),
    maxMs: toNumber(source?.maxMs),
  };
}

function normalizeBehaviorStats(source = {}) {
  return {
    backgroundMediaMs: toNumber(source?.backgroundMediaMs),
    backgroundLingerMs: toNumber(source?.backgroundLingerMs),
    staleTabMs: toNumber(source?.staleTabMs),
    revisitWithin2m: Math.max(0, Math.floor(toNumber(source?.revisitWithin2m))),
    revisitWithin5m: Math.max(0, Math.floor(toNumber(source?.revisitWithin5m))),
    revisitWithin10m: Math.max(0, Math.floor(toNumber(source?.revisitWithin10m))),
    reentryGapBuckets: normalizeReentryGapBuckets(source?.reentryGapBuckets),
    switchIns: Math.max(0, Math.floor(toNumber(source?.switchIns))),
    switchOuts: Math.max(0, Math.floor(toNumber(source?.switchOuts))),
    switchBackWithin10m: Math.max(0, Math.floor(toNumber(source?.switchBackWithin10m))),
    newTabEntrances: Math.max(0, Math.floor(toNumber(source?.newTabEntrances))),
    duplicateTabEntrances: Math.max(0, Math.floor(toNumber(source?.duplicateTabEntrances))),
    highOpenTabEntrances: Math.max(0, Math.floor(toNumber(source?.highOpenTabEntrances))),
    maxSameDomainOpenTabs: Math.max(0, Math.floor(toNumber(source?.maxSameDomainOpenTabs))),
    maxOpenTabs: Math.max(0, Math.floor(toNumber(source?.maxOpenTabs))),
    scrollSpikeBursts: Math.max(0, Math.floor(toNumber(source?.scrollSpikeBursts))),
    fastScrollBursts: Math.max(0, Math.floor(toNumber(source?.fastScrollBursts))),
    feedAdvanceBursts: Math.max(0, Math.floor(toNumber(source?.feedAdvanceBursts))),
    feedSkimSignals: Math.max(0, Math.floor(toNumber(source?.feedSkimSignals))),
    shortMediaAttentionSignals: Math.max(0, Math.floor(toNumber(source?.shortMediaAttentionSignals))),
    shortMediaWatchMs: Math.max(0, toNumber(source?.shortMediaWatchMs)),
    maxFeedScreenfuls: toNumber(source?.maxFeedScreenfuls),
    maxFeedItemTransitions: Math.max(0, Math.floor(toNumber(source?.maxFeedItemTransitions))),
  };
}

function normalizeInterventionStats(source = {}) {
  return {
    frictionShown: Math.max(0, Math.floor(toNumber(source?.frictionShown))),
    continued: Math.max(0, Math.floor(toNumber(source?.continued))),
    left: Math.max(0, Math.floor(toNumber(source?.left))),
    reenteredWithin5m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin5m))),
    reenteredWithin30m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin30m))),
    escapeClosed: Math.max(0, Math.floor(toNumber(source?.escapeClosed))),
  };
}

function normalizeEffectCounters(source = {}) {
  return {
    shown: Math.max(0, Math.floor(toNumber(source?.shown))),
    continued: Math.max(0, Math.floor(toNumber(source?.continued))),
    left: Math.max(0, Math.floor(toNumber(source?.left))),
    escapeClosed: Math.max(0, Math.floor(toNumber(source?.escapeClosed))),
    reentered: Math.max(0, Math.floor(toNumber(source?.reentered))),
    reenteredWithin5m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin5m))),
    reenteredWithin30m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin30m))),
    totalOutcomeLatencyMs: Math.max(0, Math.floor(toNumber(source?.totalOutcomeLatencyMs))),
    outcomeCount: Math.max(0, Math.floor(toNumber(source?.outcomeCount))),
  };
}

function normalizeInterventionEffectSummary(source = {}) {
  const all = normalizeEffectCounters(source?.all);
  const resistanceEligible = normalizeEffectCounters(source?.resistanceEligible);
  const effectivenessEligible = normalizeEffectCounters(source?.effectivenessEligible);
  const excludedFromResistance = normalizeEffectCounters(source?.excludedFromResistance);
  const hasEffectFacts = Boolean(source?.hasEffectFacts)
    || Object.values(all).some((value) => value > 0);
  return {
    hasEffectFacts,
    all,
    resistanceEligible,
    effectivenessEligible,
    excludedFromResistance,
    byInterventionClass: Array.isArray(source?.byInterventionClass) ? source.byInterventionClass.slice(0, 8) : [],
    byArtifact: Array.isArray(source?.byArtifact) ? source.byArtifact.slice(0, 16) : [],
    topReentryArtifact: source?.topReentryArtifact || null,
    topExitArtifact: source?.topExitArtifact || null,
  };
}

function normalizeNavigationStats(source = {}) {
  return {
    total: Math.max(0, Math.floor(toNumber(source?.total))),
    link: Math.max(0, Math.floor(toNumber(source?.link))),
    typed: Math.max(0, Math.floor(toNumber(source?.typed))),
    reload: Math.max(0, Math.floor(toNumber(source?.reload))),
    generated: Math.max(0, Math.floor(toNumber(source?.generated))),
    keyword: Math.max(0, Math.floor(toNumber(source?.keyword))),
    formSubmit: Math.max(0, Math.floor(toNumber(source?.formSubmit))),
    startPage: Math.max(0, Math.floor(toNumber(source?.startPage))),
    autoBookmark: Math.max(0, Math.floor(toNumber(source?.autoBookmark))),
    other: Math.max(0, Math.floor(toNumber(source?.other))),
    addressBar: Math.max(0, Math.floor(toNumber(source?.addressBar))),
    forwardBack: Math.max(0, Math.floor(toNumber(source?.forwardBack))),
  };
}

function normalizeTransitionEdge(source = {}) {
  const dateStr = typeof source?.dateStr === 'string' ? source.dateStr : '';
  const fromDomain = typeof source?.fromDomain === 'string' ? source.fromDomain.trim().toLowerCase() : '';
  const toDomain = typeof source?.toDomain === 'string' ? source.toDomain.trim().toLowerCase() : '';
  if (!fromDomain || !toDomain || fromDomain === toDomain) return null;
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : `${dateStr}|${fromDomain}|${toDomain}`,
    dateStr,
    fromDomain,
    toDomain,
    scopeDirection: source.scopeDirection === 'incoming' || source.scopeDirection === 'outgoing'
      ? source.scopeDirection : null,
    count: Math.max(0, Math.floor(toNumber(source?.count))),
    returnWithin10m: Math.max(0, Math.floor(toNumber(source?.returnWithin10m))),
    hourlyCounts: Array.from({ length: 24 }, (_, hour) => Math.max(0, Math.floor(toNumber(source?.hourlyCounts?.[hour])))),
    hourlyReturnWithin10m: Array.from({ length: 24 }, (_, hour) => Math.max(0, Math.floor(toNumber(source?.hourlyReturnWithin10m?.[hour])))),
  };
}

function normalizeTransitionEdges(values = []) {
  return Array.isArray(values) ? values.map(normalizeTransitionEdge).filter(Boolean) : [];
}

function normalizeTransitionEdgeSeries(values = []) {
  return Array.isArray(values)
    ? values.map((entry, index) => ({
        dateStr: typeof entry?.dateStr === 'string' ? entry.dateStr : '',
        count: Math.max(0, Math.floor(toNumber(entry?.count))),
        returnWithin10m: Math.max(0, Math.floor(toNumber(entry?.returnWithin10m))),
        distinctEdgeCount: Math.max(0, Math.floor(toNumber(entry?.distinctEdgeCount))),
        topEdges: normalizeTransitionEdges(entry?.topEdges),
        observed: requireWeeklyObservationState(entry, index, {
          source: 'buildSiteFeatureVector.transitionEdgeSeries',
        }),
      }))
    : [];
}

export function buildSiteFeatureVector({ intel } = {}) {
  assertSiteAnalysisSourceInput(intel, 'intel');
  const weeklySeries = normalizeWeeklySeries(intel?.weeklySeries);
  const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries, {
    source: 'buildSiteFeatureVector.weeklySeries',
  });
  const observedWeeklySeries = weeklyObservationSummary.observedEntries;
  const baselineSource = normalizeSitePullBaselineSeriesSource(intel || {}, {
    normalizeEntry: (entry) => normalizeWeeklySeries([entry])[0],
  });
  const baselineSeries = baselineSource.series;
  if (typeof intel?.todayObserved !== 'boolean') {
    throw new Error('SITE_FEATURE_VECTOR_TODAY_OBSERVED_INVALID');
  }
  const todayObserved = intel.todayObserved;
  const todayCollectionObservation = requireStatsDomainCollectionObservation(
    intel?.todayCollectionObservation,
    { source: 'buildSiteFeatureVector.todayCollectionObservation' },
  );
  if (todayObserved !== todayCollectionObservation.observed) {
    throw new Error('SITE_FEATURE_VECTOR_TODAY_COLLECTION_RELATION_INVALID');
  }
  const todayHourly = normalize24hSeries(intel?.todayHourly);
  const habitHourly = normalize24hSeries(intel?.habitHourly);
  const todayHourlyVisits = normalize24hCountSeries(intel?.todayHourlyVisits);
  const todayTotalSource = intel?.todayTotal;
  const todayTotal = todayTotalSource === undefined
    ? todayHourly.reduce((sum, value) => sum + value, 0)
    : toNumber(todayTotalSource);
  const todayVisitsSource = intel?.todayVisits;
  const todayVisits = todayVisitsSource === undefined
    ? todayHourlyVisits.reduce((sum, value) => sum + value, 0)
    : Math.floor(toNumber(todayVisitsSource));
  const goalMinutes = toNumber(intel?.limitMinutes);
  const goalMs = goalMinutes * 60_000;
  const goalContext = resolveSiteGoalContext({
    todayObserved, todayTotalMs: todayTotal, weeklySeries,
    ...(Object.hasOwn(intel, 'goalContext') ? { goalContext: intel.goalContext } : {}),
  });
  const { remainingMs, overGoalMs, usageRatio } = deriveSiteGoalMetrics(goalMinutes, goalContext);
  const weeklyTotal = weeklyObservationSummary.activeMsTotal;
  const weeklyVisitsSource = intel?.weeklyVisits;
  const weeklyVisits = weeklyVisitsSource === undefined
    ? Math.max(observedWeeklySeries.reduce((sum, entry) => sum + entry.visits, 0), todayVisits)
    : Math.floor(toNumber(weeklyVisitsSource));
  const todaySessionStats = normalizeSessionStats(intel?.todaySessionStats);
  const todayBehaviorStats = normalizeBehaviorStats(intel?.todayBehaviorStats);
  const todayInterventionStats = normalizeInterventionStats(intel?.todayInterventionStats);
  const todayInterventionEffectSummary = normalizeInterventionEffectSummary(intel?.todayInterventionEffectSummary);
  const todayNavigationStats = normalizeNavigationStats(intel?.todayNavigationStats);
  const todayTransitionEdges = normalizeTransitionEdges(intel?.todayTransitionEdges);
  const weeklyTransitionEdges = normalizeTransitionEdges(intel?.weeklyTransitionEdges);
  const transitionEdgeSeries = normalizeTransitionEdgeSeries(intel?.transitionEdgeSeries);
  const derivedWeeklySessionStats = {
    count: observedWeeklySeries.reduce((sum, entry) => sum + entry.sessions.count, 0),
    totalMs: observedWeeklySeries.reduce((sum, entry) => sum + entry.sessions.totalMs, 0),
    shortCount: observedWeeklySeries.reduce((sum, entry) => sum + entry.sessions.shortCount, 0),
    longCount: observedWeeklySeries.reduce((sum, entry) => sum + entry.sessions.longCount, 0),
    maxMs: Math.max(0, ...observedWeeklySeries.map((entry) => entry.sessions.maxMs)),
  };
  const weeklySessionStatsSource = intel?.weeklySessionStats;
  const weeklySessionStats = normalizeSessionStats(
    weeklySessionStatsSource === undefined ? derivedWeeklySessionStats : weeklySessionStatsSource,
  );
  const derivedWeeklyBehaviorStats = {
    backgroundMediaMs: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.backgroundMediaMs, 0),
    backgroundLingerMs: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.backgroundLingerMs, 0),
    staleTabMs: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.staleTabMs, 0),
    revisitWithin2m: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.revisitWithin2m, 0),
    revisitWithin5m: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.revisitWithin5m, 0),
    revisitWithin10m: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.revisitWithin10m, 0),
    reentryGapBuckets: sumReentryGapBuckets(observedWeeklySeries),
    switchIns: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.switchIns, 0),
    switchOuts: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.switchOuts, 0),
    switchBackWithin10m: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.switchBackWithin10m, 0),
    newTabEntrances: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.newTabEntrances, 0),
    duplicateTabEntrances: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.duplicateTabEntrances, 0),
    highOpenTabEntrances: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.highOpenTabEntrances, 0),
    maxSameDomainOpenTabs: Math.max(0, ...observedWeeklySeries.map((entry) => entry.behavior.maxSameDomainOpenTabs)),
    maxOpenTabs: Math.max(0, ...observedWeeklySeries.map((entry) => entry.behavior.maxOpenTabs)),
    scrollSpikeBursts: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.scrollSpikeBursts, 0),
    fastScrollBursts: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.fastScrollBursts, 0),
    feedAdvanceBursts: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.feedAdvanceBursts, 0),
    feedSkimSignals: observedWeeklySeries.reduce((sum, entry) => sum + entry.behavior.feedSkimSignals, 0),
    shortMediaAttentionSignals: observedWeeklySeries.reduce((sum, entry) => sum + toNumber(entry.behavior.shortMediaAttentionSignals), 0),
    shortMediaWatchMs: observedWeeklySeries.reduce((sum, entry) => sum + toNumber(entry.behavior.shortMediaWatchMs), 0),
    maxFeedScreenfuls: Math.max(0, ...observedWeeklySeries.map((entry) => entry.behavior.maxFeedScreenfuls)),
    maxFeedItemTransitions: Math.max(0, ...observedWeeklySeries.map((entry) => entry.behavior.maxFeedItemTransitions)),
  };
  const weeklyBehaviorStatsSource = intel?.weeklyBehaviorStats;
  const weeklyBehaviorStats = normalizeBehaviorStats(
    weeklyBehaviorStatsSource === undefined ? derivedWeeklyBehaviorStats : weeklyBehaviorStatsSource,
  );
  const derivedWeeklyInterventionStats = {
    frictionShown: observedWeeklySeries.reduce((sum, entry) => sum + entry.interventions.frictionShown, 0),
    continued: observedWeeklySeries.reduce((sum, entry) => sum + entry.interventions.continued, 0),
    left: observedWeeklySeries.reduce((sum, entry) => sum + entry.interventions.left, 0),
    reenteredWithin5m: observedWeeklySeries.reduce((sum, entry) => sum + entry.interventions.reenteredWithin5m, 0),
    reenteredWithin30m: observedWeeklySeries.reduce((sum, entry) => sum + entry.interventions.reenteredWithin30m, 0),
    escapeClosed: observedWeeklySeries.reduce((sum, entry) => sum + entry.interventions.escapeClosed, 0),
  };
  const weeklyInterventionStatsSource = intel?.weeklyInterventionStats;
  const weeklyInterventionStats = normalizeInterventionStats(
    weeklyInterventionStatsSource === undefined ? derivedWeeklyInterventionStats : weeklyInterventionStatsSource,
  );
  const weeklyInterventionEffectSummary = normalizeInterventionEffectSummary(intel?.weeklyInterventionEffectSummary);
  const derivedWeeklyNavigationStats = {
    total: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.total, 0),
    link: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.link, 0),
    typed: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.typed, 0),
    reload: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.reload, 0),
    generated: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.generated, 0),
    keyword: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.keyword, 0),
    formSubmit: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.formSubmit, 0),
    startPage: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.startPage, 0),
    autoBookmark: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.autoBookmark, 0),
    other: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.other, 0),
    addressBar: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.addressBar, 0),
    forwardBack: observedWeeklySeries.reduce((sum, entry) => sum + entry.navigation.forwardBack, 0),
  };
  const weeklyNavigationStatsSource = intel?.weeklyNavigationStats;
  const weeklyNavigationStats = normalizeNavigationStats(
    weeklyNavigationStatsSource === undefined ? derivedWeeklyNavigationStats : weeklyNavigationStatsSource,
  );
  const hasInterventionFacts = todayInterventionStats.frictionShown > 0
    || todayInterventionStats.continued > 0
    || todayInterventionStats.left > 0
    || todayInterventionStats.reenteredWithin5m > 0
    || todayInterventionStats.reenteredWithin30m > 0
    || todayInterventionStats.escapeClosed > 0
    || weeklyInterventionStats.frictionShown > 0
    || weeklyInterventionStats.continued > 0
    || weeklyInterventionStats.left > 0
    || weeklyInterventionStats.reenteredWithin5m > 0
    || weeklyInterventionStats.reenteredWithin30m > 0
    || weeklyInterventionStats.escapeClosed > 0;
  const hasNavigationFacts = todayNavigationStats.total > 0
    || todayNavigationStats.link > 0
    || todayNavigationStats.typed > 0
    || todayNavigationStats.reload > 0
    || todayNavigationStats.generated > 0
    || todayNavigationStats.keyword > 0
    || todayNavigationStats.formSubmit > 0
    || todayNavigationStats.startPage > 0
    || todayNavigationStats.autoBookmark > 0
    || todayNavigationStats.other > 0
    || todayNavigationStats.addressBar > 0
    || todayNavigationStats.forwardBack > 0
    || weeklyNavigationStats.total > 0;
  const weeklyAverageMs = weeklyObservationSummary.observedDays > 0
    ? weeklyObservationSummary.activeMsTotal / weeklyObservationSummary.observedDays
    : 0;
  const dominantTodayWindow = computeDominantWindow(todayHourly, 3);
  const dominantTodayShare = todayTotal > 0 && dominantTodayWindow
    ? dominantTodayWindow.totalMs / todayTotal
    : 0;

  return {
    domain: typeof intel?.domain === 'string' ? intel.domain : '',
    type: typeof intel?.type === 'string' ? intel.type : 'unmanaged',
    hasGoal: goalMinutes > 0,
    isProtectedTarget: intel?.type === 'blocked',
    hasAnyActivity: todayTotal > 0 || weeklyTotal > 0 || todayVisits > 0 || weeklyVisits > 0
      || todaySessionStats.count > 0 || weeklySessionStats.count > 0
      || hasSitePullInterventionResponse(todayInterventionStats)
      || hasSitePullInterventionResponse(weeklyInterventionStats) || hasNavigationFacts,
    hasVisitFacts: todayVisits > 0 || weeklyVisits > 0,
    hasNavigationFacts,
    hasWeeklyHistory: weeklyObservationSummary.activeDays > 0,
    historyDays: weeklyObservationSummary.activeDays,
    observedWeeklyDays: weeklyObservationSummary.observedDays,
    goalMinutes,
    goalMs,
    goalContext,
    todayObserved,
    todayCollectionObservation,
    todayTotalMs: todayTotal,
    todayVisits,
    weeklyTotalMs: weeklyTotal,
    weeklyVisits,
    todaySessionStats,
    weeklySessionStats,
    todayBehaviorStats,
    weeklyBehaviorStats,
    todayInterventionStats,
    weeklyInterventionStats,
    todayInterventionEffectSummary,
    weeklyInterventionEffectSummary,
    todayNavigationStats,
    todayTransitionEdges,
    weeklyNavigationStats,
    weeklyTransitionEdges,
    transitionEdgeSeries,
    weeklyAverageMs,
    remainingMs,
    overGoalMs,
    usageRatio,
    activeDays: weeklyObservationSummary.activeDays,
    streakDays: weeklyObservationSummary.streakDays,
    overLimitDays: weeklyObservationSummary.overLimitDays,
    activeHoursToday: todayHourly.filter((value) => value > 0).length,
    activeHoursHabit: habitHourly.filter((value) => value > 0).length,
    todayPeakHour: Number.isFinite(intel?.dailyPeakIndex)
      ? Math.max(0, Math.min(23, Number(intel.dailyPeakIndex)))
      : computePeakIndex(todayHourly),
    habitPeakHour: Number.isFinite(intel?.peakIndex)
      ? Math.max(0, Math.min(23, Number(intel.peakIndex)))
      : computePeakIndex(habitHourly),
    dominantTodayWindow,
    dominantTodayShare,
    weeklySeries,
    baselineSeries,
    baselineCurrentDateStr: baselineSource.currentDateStr,
    todayHourly,
    todayHourlyVisits,
    habitHourly,
  };
}
