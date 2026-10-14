import {
  STATS_REENTRY_GAP_BUCKET_KEYS,
  requireStatsDomainCollectionObservation,
} from '../../contracts/statsContracts.js';
import {
  requireWeeklyObservationState,
  selectObservedWeeklyEntries,
} from '../contracts/weeklyObservationContract.js';
import {
  SITE_PULL_MINUTE_MS as MINUTE_MS,
  clamp01,
  countActiveHours,
  countVisitHours,
  durationNorm,
  maxValue,
  smooth01,
  sumVisits,
  toNumber,
} from './sitePullMath.js';

function normalizeReentryGapBuckets(source = {}) {
  const buckets = source && typeof source === 'object' ? source : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = Math.max(0, Math.floor(toNumber(buckets[key])));
    return result;
  }, {});
}

function sumReentryGapBuckets(source = {}) {
  const buckets = normalizeReentryGapBuckets(source);
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((sum, key) => sum + buckets[key], 0);
}

export function normalize24hSeries(values = []) {
  return Array.from({ length: 24 }, (_, hour) => toNumber(values?.[hour]));
}

export function normalize24hCountSeries(values = []) {
  return normalize24hSeries(values).map((value) => Math.max(0, Math.floor(value)));
}

export function normalizeWeeklySeries(values) {
  if (!Array.isArray(values)) {
    selectObservedWeeklyEntries(values, { source: 'sitePullFacts.weeklySeries' });
  }
  return values.map((entry, index) => {
    const collectionObservation = requireStatsDomainCollectionObservation(
      entry?.collectionObservation,
      { source: `sitePullFacts.weeklySeries[${index}].collectionObservation` },
    );
    const observed = requireWeeklyObservationState(entry, index, {
      source: 'sitePullFacts.weeklySeries',
    });
    if (observed !== collectionObservation.observed) {
      throw new Error(`SITE_PULL_WEEKLY_COLLECTION_RELATION_INVALID:${index}`);
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

export function normalizeSessionStats(source = {}) {
  return {
    count: Math.max(0, Math.floor(toNumber(source?.count))),
    totalMs: toNumber(source?.totalMs),
    shortCount: Math.max(0, Math.floor(toNumber(source?.shortCount))),
    longCount: Math.max(0, Math.floor(toNumber(source?.longCount))),
    maxMs: toNumber(source?.maxMs),
  };
}

export function normalizeBehaviorStats(source = {}) {
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

export function normalizeInterventionStats(source = {}) {
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

function hasEffectCounters(counters = {}) {
  return Object.values(normalizeEffectCounters(counters)).some((value) => value > 0);
}

export function normalizeInterventionEffectSummary(source = {}) {
  const all = normalizeEffectCounters(source?.all);
  const resistanceEligible = normalizeEffectCounters(source?.resistanceEligible);
  const effectivenessEligible = normalizeEffectCounters(source?.effectivenessEligible);
  const excludedFromResistance = normalizeEffectCounters(source?.excludedFromResistance);
  return {
    hasEffectFacts: Boolean(source?.hasEffectFacts) || hasEffectCounters(all),
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

function effectCountersToInterventionStats(counters = {}) {
  const normalized = normalizeEffectCounters(counters);
  return normalizeInterventionStats({
    frictionShown: normalized.shown,
    continued: normalized.continued,
    left: normalized.left,
    reenteredWithin5m: normalized.reenteredWithin5m,
    reenteredWithin30m: normalized.reenteredWithin30m,
    escapeClosed: normalized.escapeClosed,
  });
}

export function normalizeNavigationStats(source = {}) {
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
    hourlyCounts: normalize24hCountSeries(source?.hourlyCounts),
    hourlyReturnWithin10m: normalize24hCountSeries(source?.hourlyReturnWithin10m),
  };
}

export function normalizeTransitionEdges(values = []) {
  return Array.isArray(values) ? values.map(normalizeTransitionEdge).filter(Boolean) : [];
}

export function normalizeTransitionEdgeSeries(values = []) {
  return Array.isArray(values)
    ? values.map((entry, index) => ({
        dateStr: typeof entry?.dateStr === 'string' ? entry.dateStr : '',
        count: Math.max(0, Math.floor(toNumber(entry?.count))),
        returnWithin10m: Math.max(0, Math.floor(toNumber(entry?.returnWithin10m))),
        distinctEdgeCount: Math.max(0, Math.floor(toNumber(entry?.distinctEdgeCount))),
        topEdges: normalizeTransitionEdges(entry?.topEdges),
        observed: requireWeeklyObservationState(entry, index, {
          source: 'sitePullFacts.transitionEdgeSeries',
        }),
      }))
    : [];
}

function estimateShortSessionCount(todayHourly, todayHourlyVisits) {
  return normalize24hCountSeries(todayHourlyVisits).reduce((sum, visits, hour) => {
    if (visits <= 0) return sum;
    const activeMs = toNumber(todayHourly?.[hour]);
    const averageVisitMs = activeMs / visits;
    if (averageVisitMs > 0 && averageVisitMs < 2 * MINUTE_MS) return sum + visits;
    return sum;
  }, 0);
}

function estimateLongSessionBucketCount(todayHourly) {
  return normalize24hSeries(todayHourly)
    .filter((activeMs) => activeMs >= 20 * MINUTE_MS)
    .length;
}

export function buildSessionSummary(featureVector) {
  const measuredSessionStats = normalizeSessionStats(featureVector?.todaySessionStats);
  const weeklySessionStats = normalizeSessionStats(featureVector?.weeklySessionStats);
  const hasMeasuredSessionFacts = measuredSessionStats.count > 0 || weeklySessionStats.count > 0;
  if (hasMeasuredSessionFacts) {
    const averageSessionMs = measuredSessionStats.count > 0
      ? measuredSessionStats.totalMs / measuredSessionStats.count
      : 0;
    return {
      mode: 'measured_domain_sessions',
      hasMeasuredSessionFacts: true,
      hasEstimatedSessionFacts: false,
      measuredSessionCount: measuredSessionStats.count,
      measuredSessionTotalMs: measuredSessionStats.totalMs,
      measuredAverageSessionMs: averageSessionMs,
      shortSessionCount: measuredSessionStats.shortCount,
      longSessionCount: measuredSessionStats.longCount,
      maxSessionMs: measuredSessionStats.maxMs,
      weeklySessionCount: weeklySessionStats.count,
      weeklySessionTotalMs: weeklySessionStats.totalMs,
      weeklyShortSessionCount: weeklySessionStats.shortCount,
      weeklyLongSessionCount: weeklySessionStats.longCount,
      weeklyMaxSessionMs: weeklySessionStats.maxMs,
      confidence: 0.86,
    };
  }

  const todayHourly = normalize24hSeries(featureVector?.todayHourly);
  const todayHourlyVisits = normalize24hCountSeries(featureVector?.todayHourlyVisits);
  const hourlyVisitTotal = sumVisits(todayHourlyVisits);
  const todayVisits = Math.max(Math.floor(toNumber(featureVector?.todayVisits)), hourlyVisitTotal);
  const activeHoursToday = countActiveHours(todayHourly);
  const visitHoursToday = countVisitHours(todayHourlyVisits);
  const hasVisitFacts = todayVisits > 0 || hourlyVisitTotal > 0;
  const estimatedSessionCount = hasVisitFacts ? todayVisits : activeHoursToday;
  const todayTotalMs = toNumber(featureVector?.todayTotalMs);
  const estimatedAverageSessionMs = estimatedSessionCount > 0
    ? todayTotalMs / estimatedSessionCount
    : 0;
  const mode = hasVisitFacts
    ? 'estimated_from_hourly_visits'
    : activeHoursToday > 0
      ? 'estimated_from_hourly_usage'
      : 'unavailable';
  const visitCoverage = todayVisits > 0 ? clamp01(hourlyVisitTotal / todayVisits) : 0;
  const confidence = hasVisitFacts
    ? clamp01(
        0.35
        + (visitCoverage * 0.1)
        + (smooth01(visitHoursToday, 1, 6) * 0.07)
        + (durationNorm(todayTotalMs, 5, 60) * 0.08),
      )
    : activeHoursToday > 0
      ? clamp01(0.18 + (durationNorm(todayTotalMs, 5, 60) * 0.12))
      : 0;

  return {
    mode,
    hasMeasuredSessionFacts: false,
    hasEstimatedSessionFacts: estimatedSessionCount > 0,
    estimatedSessionCount,
    estimatedAverageSessionMs,
    estimatedShortSessionCount: hasVisitFacts
      ? estimateShortSessionCount(todayHourly, todayHourlyVisits)
      : 0,
    estimatedLongSessionBucketCount: estimateLongSessionBucketCount(todayHourly),
    maxHourlyActiveMs: maxValue(todayHourly),
    confidence: Number(confidence.toFixed(2)),
  };
}

export function buildBehaviorSummary(featureVector) {
  const today = normalizeBehaviorStats(featureVector?.todayBehaviorStats);
  const weekly = normalizeBehaviorStats(featureVector?.weeklyBehaviorStats);
  const explicitBehaviorFacts = featureVector?.todayBehaviorStats?.hasBehaviorFacts === true
    || featureVector?.weeklyBehaviorStats?.hasBehaviorFacts === true;
  const todayTotal = today.backgroundMediaMs
    + today.backgroundLingerMs
    + today.staleTabMs
    + sumReentryGapBuckets(today.reentryGapBuckets)
    + today.revisitWithin2m
    + today.revisitWithin5m
    + today.revisitWithin10m
    + today.switchIns
    + today.switchOuts
    + today.switchBackWithin10m
    + today.newTabEntrances
    + today.duplicateTabEntrances
    + today.highOpenTabEntrances
    + today.maxSameDomainOpenTabs
    + today.maxOpenTabs
    + today.scrollSpikeBursts
    + today.fastScrollBursts
    + today.feedAdvanceBursts
    + today.feedSkimSignals
    + today.shortMediaAttentionSignals
    + today.shortMediaWatchMs
    + today.maxFeedScreenfuls
    + today.maxFeedItemTransitions;
  const weeklyTotal = weekly.backgroundMediaMs
    + weekly.backgroundLingerMs
    + weekly.staleTabMs
    + sumReentryGapBuckets(weekly.reentryGapBuckets)
    + weekly.revisitWithin2m
    + weekly.revisitWithin5m
    + weekly.revisitWithin10m
    + weekly.switchIns
    + weekly.switchOuts
    + weekly.switchBackWithin10m
    + weekly.newTabEntrances
    + weekly.duplicateTabEntrances
    + weekly.highOpenTabEntrances
    + weekly.maxSameDomainOpenTabs
    + weekly.maxOpenTabs
    + weekly.scrollSpikeBursts
    + weekly.fastScrollBursts
    + weekly.feedAdvanceBursts
    + weekly.feedSkimSignals
    + weekly.shortMediaAttentionSignals
    + weekly.shortMediaWatchMs
    + weekly.maxFeedScreenfuls
    + weekly.maxFeedItemTransitions;
  const hasBehaviorFacts = explicitBehaviorFacts || todayTotal > 0 || weeklyTotal > 0;

  return {
    hasBehaviorFacts,
    backgroundMediaMs: today.backgroundMediaMs,
    backgroundLingerMs: today.backgroundLingerMs,
    staleTabMs: today.staleTabMs,
    revisitWithin2m: today.revisitWithin2m,
    revisitWithin5m: today.revisitWithin5m,
    revisitWithin10m: today.revisitWithin10m,
    reentryGapBuckets: today.reentryGapBuckets,
    switchIns: today.switchIns,
    switchOuts: today.switchOuts,
    switchBackWithin10m: today.switchBackWithin10m,
    newTabEntrances: today.newTabEntrances,
    duplicateTabEntrances: today.duplicateTabEntrances,
    highOpenTabEntrances: today.highOpenTabEntrances,
    maxSameDomainOpenTabs: today.maxSameDomainOpenTabs,
    maxOpenTabs: today.maxOpenTabs,
    scrollSpikeBursts: today.scrollSpikeBursts,
    fastScrollBursts: today.fastScrollBursts,
    feedAdvanceBursts: today.feedAdvanceBursts,
    feedSkimSignals: today.feedSkimSignals,
    shortMediaAttentionSignals: today.shortMediaAttentionSignals,
    shortMediaWatchMs: today.shortMediaWatchMs,
    maxFeedScreenfuls: today.maxFeedScreenfuls,
    maxFeedItemTransitions: today.maxFeedItemTransitions,
    weeklyBackgroundMediaMs: weekly.backgroundMediaMs,
    weeklyBackgroundLingerMs: weekly.backgroundLingerMs,
    weeklyStaleTabMs: weekly.staleTabMs,
    weeklyReentryGapBuckets: weekly.reentryGapBuckets,
    weeklyRevisitWithin2m: weekly.revisitWithin2m,
    weeklyRevisitWithin5m: weekly.revisitWithin5m,
    weeklyRevisitWithin10m: weekly.revisitWithin10m,
    weeklySwitchIns: weekly.switchIns,
    weeklySwitchOuts: weekly.switchOuts,
    weeklySwitchBackWithin10m: weekly.switchBackWithin10m,
    weeklyNewTabEntrances: weekly.newTabEntrances,
    weeklyDuplicateTabEntrances: weekly.duplicateTabEntrances,
    weeklyHighOpenTabEntrances: weekly.highOpenTabEntrances,
    weeklyMaxSameDomainOpenTabs: weekly.maxSameDomainOpenTabs,
    weeklyMaxOpenTabs: weekly.maxOpenTabs,
    weeklyScrollSpikeBursts: weekly.scrollSpikeBursts,
    weeklyFastScrollBursts: weekly.fastScrollBursts,
    weeklyFeedAdvanceBursts: weekly.feedAdvanceBursts,
    weeklyFeedSkimSignals: weekly.feedSkimSignals,
    weeklyShortMediaAttentionSignals: weekly.shortMediaAttentionSignals,
    weeklyShortMediaWatchMs: weekly.shortMediaWatchMs,
    weeklyMaxFeedScreenfuls: weekly.maxFeedScreenfuls,
    weeklyMaxFeedItemTransitions: weekly.maxFeedItemTransitions,
    confidence: hasBehaviorFacts ? 0.82 : 0,
  };
}

export function buildInterventionSummary(featureVector) {
  const rawToday = normalizeInterventionStats(featureVector?.todayInterventionStats);
  const rawWeekly = normalizeInterventionStats(featureVector?.weeklyInterventionStats);
  const todayEffectSummary = normalizeInterventionEffectSummary(featureVector?.todayInterventionEffectSummary);
  const weeklyEffectSummary = normalizeInterventionEffectSummary(featureVector?.weeklyInterventionEffectSummary);
  const hasFilteredInterventionFacts = todayEffectSummary.hasEffectFacts || weeklyEffectSummary.hasEffectFacts;
  const today = hasFilteredInterventionFacts
    ? effectCountersToInterventionStats(todayEffectSummary.resistanceEligible)
    : rawToday;
  const weekly = hasFilteredInterventionFacts
    ? effectCountersToInterventionStats(weeklyEffectSummary.resistanceEligible)
    : rawWeekly;
  const rawTodayTotal = rawToday.frictionShown
    + rawToday.continued
    + rawToday.left
    + rawToday.reenteredWithin5m
    + rawToday.reenteredWithin30m
    + rawToday.escapeClosed;
  const rawWeeklyTotal = rawWeekly.frictionShown
    + rawWeekly.continued
    + rawWeekly.left
    + rawWeekly.reenteredWithin5m
    + rawWeekly.reenteredWithin30m
    + rawWeekly.escapeClosed;
  const todayTotal = today.frictionShown
    + today.continued
    + today.left
    + today.reenteredWithin5m
    + today.reenteredWithin30m
    + today.escapeClosed;
  const weeklyTotal = weekly.frictionShown
    + weekly.continued
    + weekly.left
    + weekly.reenteredWithin5m
    + weekly.reenteredWithin30m
    + weekly.escapeClosed;
  const hasInterventionFacts = todayTotal > 0
    || weeklyTotal > 0
    || rawTodayTotal > 0
    || rawWeeklyTotal > 0
    || hasFilteredInterventionFacts;

  return {
    hasInterventionFacts,
    hasFilteredInterventionFacts,
    interventionFactsSource: hasFilteredInterventionFacts ? 'effect_resistance_eligible' : 'flat_stats',
    frictionShown: today.frictionShown,
    continued: today.continued,
    left: today.left,
    reenteredWithin5m: today.reenteredWithin5m,
    reenteredWithin30m: today.reenteredWithin30m,
    escapeClosed: today.escapeClosed,
    weeklyFrictionShown: weekly.frictionShown,
    weeklyContinued: weekly.continued,
    weeklyLeft: weekly.left,
    weeklyReenteredWithin5m: weekly.reenteredWithin5m,
    weeklyReenteredWithin30m: weekly.reenteredWithin30m,
    weeklyEscapeClosed: weekly.escapeClosed,
    rawFrictionShown: rawToday.frictionShown,
    rawContinued: rawToday.continued,
    rawLeft: rawToday.left,
    rawReenteredWithin5m: rawToday.reenteredWithin5m,
    rawReenteredWithin30m: rawToday.reenteredWithin30m,
    rawEscapeClosed: rawToday.escapeClosed,
    rawWeeklyFrictionShown: rawWeekly.frictionShown,
    rawWeeklyContinued: rawWeekly.continued,
    rawWeeklyLeft: rawWeekly.left,
    rawWeeklyReenteredWithin5m: rawWeekly.reenteredWithin5m,
    rawWeeklyReenteredWithin30m: rawWeekly.reenteredWithin30m,
    rawWeeklyEscapeClosed: rawWeekly.escapeClosed,
    effectSummary: {
      today: todayEffectSummary,
      weekly: weeklyEffectSummary,
    },
    confidence: hasInterventionFacts ? 0.88 : 0,
  };
}

export function buildNavigationSummary(featureVector) {
  const today = normalizeNavigationStats(featureVector?.todayNavigationStats);
  const weekly = normalizeNavigationStats(featureVector?.weeklyNavigationStats);
  const todayTotal = today.total
    + today.link
    + today.typed
    + today.reload
    + today.generated
    + today.keyword
    + today.formSubmit
    + today.startPage
    + today.autoBookmark
    + today.other
    + today.addressBar
    + today.forwardBack;
  const weeklyTotal = weekly.total
    + weekly.link
    + weekly.typed
    + weekly.reload
    + weekly.generated
    + weekly.keyword
    + weekly.formSubmit
    + weekly.startPage
    + weekly.autoBookmark
    + weekly.other
    + weekly.addressBar
    + weekly.forwardBack;
  const hasNavigationFacts = todayTotal > 0 || weeklyTotal > 0;

  return {
    hasNavigationFacts,
    total: today.total,
    link: today.link,
    typed: today.typed,
    reload: today.reload,
    generated: today.generated,
    keyword: today.keyword,
    formSubmit: today.formSubmit,
    startPage: today.startPage,
    autoBookmark: today.autoBookmark,
    other: today.other,
    addressBar: today.addressBar,
    forwardBack: today.forwardBack,
    weeklyTotal: weekly.total,
    weeklyTyped: weekly.typed,
    weeklyReload: weekly.reload,
    weeklyAddressBar: weekly.addressBar,
    confidence: hasNavigationFacts ? 0.84 : 0,
  };
}

export function buildTransitionEdgeSummary(featureVector) {
  const todayEdges = normalizeTransitionEdges(featureVector?.todayTransitionEdges);
  const weeklyEdges = normalizeTransitionEdges(featureVector?.weeklyTransitionEdges);
  const edgeSeries = normalizeTransitionEdgeSeries(featureVector?.transitionEdgeSeries);
  const weeklySource = weeklyEdges;
  const todayCount = todayEdges.reduce((sum, edge) => sum + edge.count, 0);
  const todayReturnWithin10m = todayEdges.reduce((sum, edge) => sum + edge.returnWithin10m, 0);
  const weeklyCount = weeklySource.reduce((sum, edge) => sum + edge.count, 0);
  const weeklyReturnWithin10m = weeklySource.reduce((sum, edge) => sum + edge.returnWithin10m, 0);
  const hasTransitionEdgeFacts = todayCount > 0 || weeklyCount > 0 || edgeSeries.some((entry) => entry.count > 0);

  return {
    hasTransitionEdgeFacts,
    todayCount,
    todayReturnWithin10m,
    todayDistinctEdgeCount: new Set(todayEdges.map((edge) => `${edge.fromDomain}|${edge.toDomain}`)).size,
    weeklyCount,
    weeklyReturnWithin10m,
    weeklyDistinctEdgeCount: new Set(weeklySource.map((edge) => `${edge.fromDomain}|${edge.toDomain}`)).size,
    topEdges: todayEdges
      .slice()
      .sort((left, right) => (right.count + (right.returnWithin10m * 0.75)) - (left.count + (left.returnWithin10m * 0.75))),
    weeklyTopEdges: weeklySource
      .slice()
      .sort((left, right) => (right.count + (right.returnWithin10m * 0.75)) - (left.count + (left.returnWithin10m * 0.75))),
    series: edgeSeries,
    confidence: hasTransitionEdgeFacts ? 0.86 : 0,
  };
}
