import { buildSiteFeatureVector } from '../features/buildSiteFeatureVector.js';
import { assertSiteAnalysisSourceInput } from '../contracts/siteAnalysisInputContract.js';
import { deriveSiteGoalMetrics, requireSiteGoalContext, requireSiteGoalMetrics, resolveSiteGoalContext } from '../contracts/siteGoalContext.js';
import { hasSitePullInterventionResponse } from './sitePullInterventionFacts.js';
import { requireStatsDomainCollectionObservation } from '../../contracts/statsContracts.js';
import {
  deriveWeeklyObservationSummary,
} from '../contracts/weeklyObservationContract.js';
import { normalizeSitePullBaselineSeriesSource } from './baselineSeriesSource.js';
import { buildPersonalBaseline } from './personalBaseline.js';
import { toPublicPersonalBaseline } from './personalBaselinePublicContract.js';
import {
  SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES,
  buildSitePullTemporalEvidence,
} from './temporalEvidence.js';
import {
  projectSitePullRecentTrajectory,
  resolveSitePullPersonalBaselinePolicyContext,
} from './personalBaselinePolicy.js';
import {
  SITE_PULL_MINUTE_MS as MINUTE_MS,
  countActiveHours,
  countVisitHours,
  sumVisits,
  toNumber,
} from './sitePullMath.js';
import {
  buildBehaviorSummary,
  buildInterventionSummary,
  buildNavigationSummary,
  buildSessionSummary,
  buildTransitionEdgeSummary,
  normalize24hCountSeries,
  normalize24hSeries,
  normalizeBehaviorStats,
  normalizeInterventionEffectSummary,
  normalizeInterventionStats,
  normalizeNavigationStats,
  normalizeSessionStats,
  normalizeTransitionEdgeSeries,
  normalizeTransitionEdges,
  normalizeWeeklySeries,
} from './sitePullFactSummaries.js';

export const SITE_PULL_FACTS_VERSION = 'site-pull-facts-v2';

function hasExplicitInput(value) {
  return value !== null && value !== undefined;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function createSitePullFactsInputError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireTodayObserved(source, field = 'todayObserved') {
  if (!hasOwn(source, field) || typeof source[field] !== 'boolean') {
    throw createSitePullFactsInputError('SITE_PULL_TODAY_OBSERVED_INVALID', { field });
  }
  return source[field];
}

function requireTodayCollectionObservation(source, field = 'todayCollectionObservation') {
  if (!hasOwn(source, field)) {
    throw createSitePullFactsInputError('SITE_PULL_TODAY_COLLECTION_OBSERVATION_MISSING', {
      field,
    });
  }
  return requireStatsDomainCollectionObservation(source[field], {
    source: `sitePull.${field}`,
  });
}

function requireTodayCollectionObservationRelation(todayObserved, collectionObservation) {
  if (todayObserved !== collectionObservation.observed) {
    throw createSitePullFactsInputError('SITE_PULL_TODAY_COLLECTION_RELATION_INVALID');
  }
}

function requireTodayObservationRelation(todayObserved, personalBaseline) {
  if (!hasExplicitInput(personalBaseline)) return;
  if (!isPlainObject(personalBaseline)
    || typeof personalBaseline.currentObserved !== 'boolean'
    || personalBaseline.currentObserved !== todayObserved) {
    throw createSitePullFactsInputError('SITE_PULL_TODAY_OBSERVED_RELATION_INVALID');
  }
}

function requireWeeklyUsageRelation(usage, {
  observedWeeklyDays,
  weeklyTotalMs,
  weeklyAverageMs,
  activeDays,
  historyDays,
  streakDays,
  overLimitDays,
}) {
  const expected = {
    observedWeeklyDays,
    weeklyTotalMs,
    weeklyAverageMs,
    activeDays,
    historyDays,
    streakDays,
    overLimitDays,
  };
  const invalidField = Object.entries(expected).find(([field, expectedValue]) => (
    !hasOwn(usage, field)
    || typeof usage[field] !== 'number'
    || !Number.isFinite(usage[field])
    || usage[field] !== expectedValue
  ));
  if (invalidField) {
    throw createSitePullFactsInputError('SITE_PULL_WEEKLY_USAGE_RELATION_INVALID', {
      field: invalidField[0],
      expected: invalidField[1],
      actual: usage?.[invalidField[0]],
    });
  }
}

function requireWeeklyCoverageRelation(facts, observedWeeklyDays, { required = false } = {}) {
  if (!hasOwn(facts, 'dataCoverage')) {
    if (!required) return;
    throw createSitePullFactsInputError('SITE_PULL_WEEKLY_COVERAGE_RELATION_INVALID', {
      field: 'dataCoverage',
    });
  }
  const coverage = facts.dataCoverage;
  const expected = observedWeeklyDays > 0;
  if (!isPlainObject(coverage) || coverage.hasWeeklyFacts !== expected) {
    throw createSitePullFactsInputError('SITE_PULL_WEEKLY_COVERAGE_RELATION_INVALID', {
      field: 'hasWeeklyFacts',
      expected,
      actual: coverage?.hasWeeklyFacts,
    });
  }
}

export function assertSitePullFactsInputAuthority({
  facts = null,
  featureVector = null,
  intel = null,
} = {}) {
  assertSiteAnalysisSourceInput(facts, 'facts');
  assertSiteAnalysisSourceInput(intel, 'intel');
  assertSiteAnalysisSourceInput(featureVector, 'featureVector');
  if (!hasExplicitInput(facts)) return;
  if (!isPlainObject(facts)) {
    throw createSitePullFactsInputError('SITE_PULL_FACTS_INPUT_INVALID');
  }
  if (Object.hasOwn(facts, 'featureVector')) {
    throw createSitePullFactsInputError('SITE_PULL_FACTS_REDUNDANT_FEATURE_VECTOR');
  }

  const conflictingInputs = [
    hasExplicitInput(featureVector) ? 'featureVector' : null,
    hasExplicitInput(intel) ? 'intel' : null,
  ].filter(Boolean);
  if (conflictingInputs.length > 0) {
    throw createSitePullFactsInputError('SITE_PULL_FACTS_INPUT_AUTHORITY_CONFLICT', {
      conflictingInputs,
    });
  }
}

function assertSitePullFactBuildInput({
  intel = null,
  featureVector = null,
} = {}) {
  assertSiteAnalysisSourceInput(intel, 'intel');
  assertSiteAnalysisSourceInput(featureVector, 'featureVector');
  if (hasExplicitInput(intel) && hasExplicitInput(featureVector)) {
    throw createSitePullFactsInputError('SITE_PULL_FACTS_INPUT_AUTHORITY_CONFLICT');
  }
  if (hasExplicitInput(featureVector)) {
    if (!isPlainObject(featureVector)) {
      throw createSitePullFactsInputError('SITE_PULL_FACTS_FEATURE_VECTOR_INPUT_INVALID');
    }
    return;
  }

  if (!isPlainObject(intel)) {
    throw createSitePullFactsInputError('SITE_PULL_FACTS_BUILD_INPUT_MISSING');
  }
}

export function buildFeatureVectorFromSitePullFacts(facts = {}) {
  const usage = facts?.usage || {};
  const goal = facts?.goal || {};
  const entry = facts?.entry || {};
  const session = facts?.session || {};
  const behavior = facts?.behavior || {};
  const intervention = facts?.intervention || {};
  const navigation = facts?.navigation || {};
  const transitionEdges = facts?.transitionEdges || {};
  const target = facts?.target || {};
  const weeklySeries = normalizeWeeklySeries(usage.weeklySeries);
  const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries, {
    source: 'sitePullFacts.usage.weeklySeries',
  });
  const baselineSource = normalizeSitePullBaselineSeriesSource(usage, {
    normalizeEntry: (entryItem) => normalizeWeeklySeries([entryItem])[0],
  });
  const baselineSeries = baselineSource.series;
  const goalContext = requireSiteGoalContext(goal.context);
  const todayObserved = requireTodayObserved(usage);
  const todayCollectionObservation = requireTodayCollectionObservation(usage);
  requireTodayCollectionObservationRelation(todayObserved, todayCollectionObservation);
  requireTodayObservationRelation(todayObserved, facts?.personalBaseline);
  const observedWeeklyDays = weeklyObservationSummary.observedDays;
  const weeklyTotalMs = weeklyObservationSummary.activeMsTotal;
  const weeklyAverageMs = observedWeeklyDays > 0 ? weeklyTotalMs / observedWeeklyDays : 0;
  const activeDays = weeklyObservationSummary.activeDays;
  const streakDays = weeklyObservationSummary.streakDays;
  const overLimitDays = weeklyObservationSummary.overLimitDays;
  requireWeeklyUsageRelation(usage, {
    observedWeeklyDays,
    weeklyTotalMs,
    weeklyAverageMs,
    activeDays,
    historyDays: activeDays,
    streakDays,
    overLimitDays,
  });
  requireWeeklyCoverageRelation(facts, observedWeeklyDays);
  const goalMetrics = requireSiteGoalMetrics(goal);
  const { goalMinutes, goalMs } = goalMetrics;
  const todayTotalMs = toNumber(usage.todayTotalMs);
  const todayHourly = normalize24hSeries(usage.todayHourly);
  const habitHourly = normalize24hSeries(usage.habitHourly);
  const todayHourlyVisits = normalize24hCountSeries(entry.todayHourlyVisits);
  const entryTodayVisitsSource = hasOwn(entry, 'todayVisits') ? entry.todayVisits : undefined;
  const todayVisits = entryTodayVisitsSource === undefined
    ? sumVisits(todayHourlyVisits)
    : Math.floor(toNumber(entryTodayVisitsSource));
  const entryWeeklyVisitsSource = hasOwn(entry, 'weeklyVisits') ? entry.weeklyVisits : undefined;
  const weeklyVisits = entryWeeklyVisitsSource === undefined
    ? todayVisits
    : Math.floor(toNumber(entryWeeklyVisitsSource));
  const trajectoryProjection = isPlainObject(facts?.personalBaseline?.recentTrajectory)
    ? projectSitePullRecentTrajectory(facts.personalBaseline.recentTrajectory)
    : {};

  return {
    domain: typeof facts?.domain === 'string' ? facts.domain : '',
    type: typeof target.type === 'string' ? target.type : 'unmanaged',
    hasGoal: goalMetrics.hasGoal,
    isProtectedTarget: Boolean(target.isProtectedTarget),
    hasAnyActivity: todayTotalMs > 0
      || weeklyTotalMs > 0
      || todayVisits > 0 || weeklyVisits > 0 || session.measuredSessionCount > 0 || session.weeklySessionCount > 0
      || Boolean(behavior.hasBehaviorFacts)
      || hasSitePullInterventionResponse(intervention)
      || Boolean(navigation.hasNavigationFacts),
    hasVisitFacts: Boolean(entry.hasVisitFacts) || todayVisits > 0,
    hasWeeklyHistory: weeklyObservationSummary.activeDays > 0,
    historyDays: activeDays,
    observedWeeklyDays,
    goalMinutes,
    goalMs,
    goalContext,
    todayObserved,
    todayCollectionObservation,
    todayTotalMs,
    todayVisits,
    weeklyTotalMs,
    weeklyVisits,
    todaySessionStats: normalizeSessionStats({
      count: session.measuredSessionCount,
      totalMs: session.measuredSessionTotalMs,
      shortCount: session.shortSessionCount,
      longCount: session.longSessionCount,
      maxMs: session.maxSessionMs,
    }),
    weeklySessionStats: normalizeSessionStats({
      count: session.weeklySessionCount,
      totalMs: session.weeklySessionTotalMs,
      shortCount: session.weeklyShortSessionCount,
      longCount: session.weeklyLongSessionCount,
      maxMs: session.weeklyMaxSessionMs,
    }),
    todayBehaviorStats: normalizeBehaviorStats(behavior),
    weeklyBehaviorStats: normalizeBehaviorStats({
      backgroundMediaMs: behavior.weeklyBackgroundMediaMs,
      backgroundLingerMs: behavior.weeklyBackgroundLingerMs,
      staleTabMs: behavior.weeklyStaleTabMs,
      reentryGapBuckets: behavior.weeklyReentryGapBuckets,
      revisitWithin2m: behavior.weeklyRevisitWithin2m,
      revisitWithin5m: behavior.weeklyRevisitWithin5m,
      revisitWithin10m: behavior.weeklyRevisitWithin10m,
      switchIns: behavior.weeklySwitchIns,
      switchOuts: behavior.weeklySwitchOuts,
      switchBackWithin10m: behavior.weeklySwitchBackWithin10m,
      newTabEntrances: behavior.weeklyNewTabEntrances,
      duplicateTabEntrances: behavior.weeklyDuplicateTabEntrances,
      highOpenTabEntrances: behavior.weeklyHighOpenTabEntrances,
      maxSameDomainOpenTabs: behavior.weeklyMaxSameDomainOpenTabs,
      maxOpenTabs: behavior.weeklyMaxOpenTabs,
      scrollSpikeBursts: behavior.weeklyScrollSpikeBursts,
      fastScrollBursts: behavior.weeklyFastScrollBursts,
      feedAdvanceBursts: behavior.weeklyFeedAdvanceBursts,
      feedSkimSignals: behavior.weeklyFeedSkimSignals,
      shortMediaAttentionSignals: behavior.weeklyShortMediaAttentionSignals,
      shortMediaWatchMs: behavior.weeklyShortMediaWatchMs,
      maxFeedScreenfuls: behavior.weeklyMaxFeedScreenfuls,
      maxFeedItemTransitions: behavior.weeklyMaxFeedItemTransitions,
    }),
    todayInterventionStats: normalizeInterventionStats(intervention),
    weeklyInterventionStats: normalizeInterventionStats({
      frictionShown: intervention.weeklyFrictionShown,
      continued: intervention.weeklyContinued,
      left: intervention.weeklyLeft,
      reenteredWithin5m: intervention.weeklyReenteredWithin5m,
      reenteredWithin30m: intervention.weeklyReenteredWithin30m,
      escapeClosed: intervention.weeklyEscapeClosed,
    }),
    todayInterventionEffectSummary: normalizeInterventionEffectSummary(intervention.effectSummary?.today),
    weeklyInterventionEffectSummary: normalizeInterventionEffectSummary(intervention.effectSummary?.weekly),
    todayNavigationStats: normalizeNavigationStats(navigation),
    weeklyNavigationStats: normalizeNavigationStats({
      total: navigation.weeklyTotal,
      typed: navigation.weeklyTyped,
      reload: navigation.weeklyReload,
      addressBar: navigation.weeklyAddressBar,
    }),
    todayTransitionEdges: normalizeTransitionEdges(transitionEdges.topEdges),
    weeklyTransitionEdges: normalizeTransitionEdges(transitionEdges.weeklyTopEdges),
    transitionEdgeSeries: normalizeTransitionEdgeSeries(transitionEdges.series),
    weeklyAverageMs,
    ...trajectoryProjection,
    remainingMs: goalMetrics.remainingMs,
    overGoalMs: goalMetrics.overGoalMs,
    usageRatio: goalMetrics.usageRatio,
    activeDays,
    streakDays,
    overLimitDays,
    activeHoursToday: countActiveHours(todayHourly),
    activeHoursHabit: countActiveHours(habitHourly),
    todayPeakHour: Number.isFinite(usage.todayPeakHour) ? usage.todayPeakHour : null,
    habitPeakHour: Number.isFinite(usage.habitPeakHour) ? usage.habitPeakHour : null,
    dominantTodayWindow: usage.dominantTodayWindow || null,
    dominantTodayShare: toNumber(usage.dominantTodayShare),
    weeklySeries,
    baselineSeries,
    baselineCurrentDateStr: baselineSource.currentDateStr,
    todayHourly,
    todayHourlyVisits,
    habitHourly,
  };
}

export function resolveSitePullFeatureVector({
  facts = null,
  intel = null,
  featureVector = null,
} = {}) {
  assertSitePullFactsInputAuthority({ facts, intel, featureVector });
  if (hasExplicitInput(featureVector)) {
    assertSitePullFactBuildInput({ featureVector });
    const resolvedTodayObserved = requireTodayObserved(featureVector);
    const collectionObservation = requireTodayCollectionObservation(featureVector);
    requireTodayCollectionObservationRelation(resolvedTodayObserved, collectionObservation);
    return featureVector;
  }
  if (facts && typeof facts === 'object') return buildFeatureVectorFromSitePullFacts(facts);
  assertSitePullFactBuildInput({ intel, featureVector });
  return buildSiteFeatureVector({ intel });
}

export function buildSitePullFacts({
  intel = null,
  featureVector = null,
  options = {},
} = {}) {
  assertSitePullFactBuildInput({ intel, featureVector });
  const resolvedFeatureVector = featureVector || buildSiteFeatureVector({ intel });
  const todayObserved = requireTodayObserved(resolvedFeatureVector);
  const todayCollectionObservation = requireTodayCollectionObservation(resolvedFeatureVector);
  requireTodayCollectionObservationRelation(todayObserved, todayCollectionObservation);
  const todayHourly = normalize24hSeries(resolvedFeatureVector.todayHourly);
  const habitHourly = normalize24hSeries(resolvedFeatureVector.habitHourly);
  const todayHourlyVisits = normalize24hCountSeries(resolvedFeatureVector.todayHourlyVisits);
  const weeklySeries = normalizeWeeklySeries(resolvedFeatureVector.weeklySeries);
  const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries, {
    source: 'buildSitePullFacts.weeklySeries',
  });
  const observedWeeklyDays = weeklyObservationSummary.observedDays;
  const weeklyTotalMs = weeklyObservationSummary.activeMsTotal;
  const weeklyAverageMs = observedWeeklyDays > 0 ? weeklyTotalMs / observedWeeklyDays : 0;
  const activeDays = weeklyObservationSummary.activeDays;
  const streakDays = weeklyObservationSummary.streakDays;
  const overLimitDays = weeklyObservationSummary.overLimitDays;
  const baselineSource = normalizeSitePullBaselineSeriesSource(resolvedFeatureVector, {
    normalizeEntry: (entryItem) => normalizeWeeklySeries([entryItem])[0],
  });
  const baselineSeries = baselineSource.series;
  const featureTodayVisitsSource = hasOwn(resolvedFeatureVector, 'todayVisits')
    ? resolvedFeatureVector.todayVisits
    : undefined;
  const todayVisits = featureTodayVisitsSource === undefined
    ? sumVisits(todayHourlyVisits)
    : Math.floor(toNumber(featureTodayVisitsSource));
  const featureWeeklyVisitsSource = hasOwn(resolvedFeatureVector, 'weeklyVisits')
    ? resolvedFeatureVector.weeklyVisits
    : undefined;
  const weeklyVisits = featureWeeklyVisitsSource === undefined
    ? todayVisits
    : Math.floor(toNumber(featureWeeklyVisitsSource));
  const hasEntryFacts = Boolean(resolvedFeatureVector.hasVisitFacts) || todayVisits > 0 || weeklyVisits > 0;
  const session = buildSessionSummary({
    ...resolvedFeatureVector,
    todayObserved,
    todayHourly,
    todayHourlyVisits,
  });
  const behavior = buildBehaviorSummary(resolvedFeatureVector);
  const intervention = buildInterventionSummary(resolvedFeatureVector);
  const navigation = buildNavigationSummary(resolvedFeatureVector);
  const transitionEdges = buildTransitionEdgeSummary(resolvedFeatureVector);
  const personalBaseline = buildPersonalBaseline(resolvedFeatureVector);
  const goalContext = resolveSiteGoalContext(resolvedFeatureVector);
  const recentTrajectoryProjection = projectSitePullRecentTrajectory(
    personalBaseline.recentTrajectory,
  );
  const sitePullFeatureVector = {
    ...resolvedFeatureVector,
    hasWeeklyHistory: activeDays > 0,
    historyDays: activeDays,
    observedWeeklyDays,
    weeklyTotalMs,
    weeklyAverageMs,
    activeDays,
    streakDays,
    overLimitDays,
    ...recentTrajectoryProjection,
  };
  const personalBaselinePolicyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);
  const temporalEvidence = buildSitePullTemporalEvidence(sitePullFeatureVector, {
    entry: {
      todayVisits,
      weeklyVisits,
      todayHourlyVisits,
      visitHoursToday: countVisitHours(todayHourlyVisits),
    },
    session,
    behavior,
    intervention,
    navigation,
    transitionEdges,
  }, {
    sourceMode: SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACT_DRAFT,
  });

  return {
    version: SITE_PULL_FACTS_VERSION,
    domain: resolvedFeatureVector.domain || '',
    target: {
      type: resolvedFeatureVector.type || 'unmanaged',
      isProtectedTarget: Boolean(resolvedFeatureVector.isProtectedTarget),
    },
    usage: {
      todayObserved,
      todayCollectionObservation,
      todayTotalMs: toNumber(resolvedFeatureVector.todayTotalMs),
      weeklyTotalMs,
      weeklyAverageMs,
      observedWeeklyDays,
      recentAverageMs: recentTrajectoryProjection.recentAverageMs,
      baselineAverageMs: recentTrajectoryProjection.baselineAverageMs,
      activeDays,
      streakDays,
      overLimitDays,
      historyDays: activeDays,
      todayPeakHour: resolvedFeatureVector.todayPeakHour,
      habitPeakHour: resolvedFeatureVector.habitPeakHour,
      trendRole: recentTrajectoryProjection.trendRole,
      hasTrendComparison: recentTrajectoryProjection.hasTrendComparison,
      trendRatio: recentTrajectoryProjection.trendRatio,
      trendDirection: recentTrajectoryProjection.trendDirection,
      dominantTodayWindow: resolvedFeatureVector.dominantTodayWindow || null,
      dominantTodayShare: toNumber(resolvedFeatureVector.dominantTodayShare),
      weeklySeries,
      baselineSeries,
      baselineCurrentDateStr: baselineSource.currentDateStr,
      todayHourly,
      habitHourly,
    },
    goal: {
      context: goalContext,
      ...deriveSiteGoalMetrics(toNumber(resolvedFeatureVector.goalMinutes), goalContext),
    },
    entry: {
      hasVisitFacts: hasEntryFacts,
      todayVisits,
      weeklyVisits,
      todayHourlyVisits,
      visitHoursToday: countVisitHours(todayHourlyVisits),
    },
    session,
    behavior,
    intervention,
    navigation,
    transitionEdges,
    temporalEvidence,
    personalBaseline,
    dataCoverage: {
      collectionObservation: todayCollectionObservation,
      hasUsageFacts: todayObserved || observedWeeklyDays > 0,
      hasWeeklyFacts: observedWeeklyDays > 0,
      hasHourlyFacts: todayObserved,
      hasGoalFacts: Boolean(resolvedFeatureVector.hasGoal),
      hasEntryFacts,
      hasSessionFacts: Boolean(session.hasMeasuredSessionFacts),
      hasEstimatedSessionFacts: Boolean(session.hasEstimatedSessionFacts),
      hasBehaviorFacts: Boolean(behavior.hasBehaviorFacts),
      hasInterventionFacts: Boolean(intervention.hasInterventionFacts),
      hasNavigationFacts: Boolean(navigation.hasNavigationFacts),
      hasTransitionEdgeFacts: Boolean(transitionEdges.hasTransitionEdgeFacts),
      hasTemporalEvidence: Boolean(temporalEvidence),
      hasPersonalBaselineFacts: personalBaselinePolicyContext.hasPersonalBaselineFacts,
      personalBaselineStatus: personalBaselinePolicyContext.status,
      dataCollectionMode: options?.dataCollectionMode || null,
      permissionCoverage: {
        webNavigation: Boolean(navigation.hasNavigationFacts),
        measuredSessions: Boolean(session.hasMeasuredSessionFacts),
        contentBehavior: Boolean(behavior.hasBehaviorFacts),
        interventions: Boolean(intervention.hasInterventionFacts),
      },
    },
  };
}

export function toPublicSitePullFacts(facts = null) {
  if (!isPlainObject(facts)) {
    throw createSitePullFactsInputError('SITE_PULL_FACTS_PUBLIC_INPUT_INVALID');
  }
  assertSitePullFactsInputAuthority({ facts });
  const publicFacts = { ...facts };
  if (publicFacts.personalBaseline) {
    publicFacts.personalBaseline = toPublicPersonalBaseline(publicFacts.personalBaseline);
  }
  const publicFeatureVector = buildFeatureVectorFromSitePullFacts(publicFacts);
  requireWeeklyCoverageRelation(publicFacts, publicFeatureVector.observedWeeklyDays, {
    required: true,
  });
  return publicFacts;
}
