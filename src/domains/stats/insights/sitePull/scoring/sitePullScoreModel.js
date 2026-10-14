import {
  SITE_PULL_CORE_LATE_HOURS,
  SITE_PULL_MINUTE_MS as MINUTE_MS,
  SITE_PULL_NIGHT_HOURS,
  average,
  clamp,
  clamp01,
  countActiveHours,
  durationNorm,
  hasHourlyData,
  maxRollingSum,
  ratioNorm,
  smooth01,
  standardDeviation,
  sumHours,
  toNumber,
} from '../sitePullMath.js';
import { buildSitePullNavigationIntentMetrics } from '../navigationIntentMetrics.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from '../personalBaselineMetrics.js';
import {
  SITE_PULL_PERSONAL_TRAJECTORY_STATES,
  requireSitePullRecentTrajectory,
  resolveSitePullPersonalBaselinePolicyContext,
} from '../personalBaselinePolicy.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import { selectObservedWeeklyEntries } from '../../contracts/weeklyObservationContract.js';
import { resolveSitePullContentFlowObservations } from '../sitePullContentFlowObservations.js';
import { resolveSiteGoalContext } from '../../contracts/siteGoalContext.js';
import { resolveSitePullInterventionCohortConfidence, resolveSitePullInterventionWindows, selectSitePullInterventionReentryWindow } from '../sitePullInterventionFacts.js';

export const SITE_PULL_MODEL_VERSION = 'site-pull-release-v5';

export const SITE_PULL_BASELINE_WEIGHTS = Object.freeze({
  timePressure: 22,
  planFriction: 20,
  checkingLoop: 12,
  immersionDepth: 15,
  habitRegularity: 13,
  trendAcceleration: 10,
  circadianRisk: 8,
});

export const SITE_PULL_INTERVENTION_AWARE_WEIGHTS = Object.freeze({
  timePressure: 18,
  planFriction: 18,
  checkingLoop: 16,
  immersionDepth: 13,
  habitRegularity: 12,
  trendAcceleration: 8,
  circadianRisk: 7,
  interventionResistance: 8,
});

export const SITE_PULL_FEATURE_IDS = Object.freeze({
  timePressure: 'time_pressure',
  planFriction: 'plan_friction',
  checkingLoop: 'checking_loop',
  immersionDepth: 'immersion_depth',
  habitRegularity: 'habit_regularity',
  trendAcceleration: 'trend_acceleration',
  circadianRisk: 'circadian_risk',
  interventionResistance: 'intervention_resistance',
});

function resolvePersonalBaselineScoringContext(personalBaseline = null) {
  return {
    activeMsMetric: getSitePullPersonalBaselineMetric(
      personalBaseline,
      SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
    ),
    metricScores: resolveSitePullPersonalBaselineMetricScores(personalBaseline),
    policyContext: resolveSitePullPersonalBaselinePolicyContext(personalBaseline),
    recentTrajectory: personalBaseline === null || personalBaseline === undefined
      ? null
      : requireSitePullRecentTrajectory(personalBaseline),
  };
}

function computeTimePressure(featureVector, personalBaselineContext = null) {
  if (!featureVector?.hasAnyActivity) return 0;

  const todayAbs = durationNorm(featureVector.todayTotalMs, 5, 120);
  const weeklyAverageAbs = durationNorm(featureVector.weeklyAverageMs, 5, 90);
  const todayVsWeekly = featureVector.weeklyAverageMs >= 5 * MINUTE_MS
    ? ratioNorm(featureVector.todayTotalMs / featureVector.weeklyAverageMs, 1.1, 2.2)
    : durationNorm(featureVector.todayTotalMs, 10, 90) * 0.6;

  const globalScore = clamp01(
    (todayAbs * 0.55)
    + (weeklyAverageAbs * 0.25)
    + (todayVsWeekly * 0.2),
  );

  const metricScores = personalBaselineContext?.metricScores;
  const policyContext = personalBaselineContext?.policyContext;
  const baselineConfidence = metricScores ? clamp01(metricScores.timeConfidence) : 0;
  const personalWeight = policyContext ? policyContext.personalWeight : 0;
  if (baselineConfidence < 0.2 || personalWeight <= 0.02) return globalScore;

  const personalScore = clamp01(
    (clamp01(metricScores?.timeAnomalyScore) * 0.62)
    + (todayAbs * 0.23)
    + (personalBaselineContext?.recentTrajectory?.state
      === SITE_PULL_PERSONAL_TRAJECTORY_STATES.INSUFFICIENT
      ? 0
      : clamp01(personalBaselineContext?.recentTrajectory?.risingScore) * 0.15),
  );
  const blendedScore = (globalScore * (1 - personalWeight)) + (personalScore * personalWeight);

  return clamp01(Math.max(globalScore * 0.75, blendedScore));
}

function computePlanFriction(featureVector, observedWeeklySeries) {
  if (!featureVector?.hasAnyActivity) return 0;
  const goalContext = resolveSiteGoalContext(featureVector);

  if (featureVector.hasGoal && featureVector.goalMs > 0) {
    const usageRatio = toNumber(featureVector.usageRatio);
    const goalToday = usageRatio <= 1
      ? 0.35 * smooth01(usageRatio, 0.75, 1)
      : 0.35 + (0.65 * smooth01(usageRatio, 1, 2));
    const overTimeNorm = smooth01(featureVector.overGoalMs, 0, featureVector.goalMs);
    const overLimitDayRate = goalContext.observedDays > 0
      ? clamp01(goalContext.overLimitDays / goalContext.observedDays)
      : 0;

    return clamp01(
      (goalToday * 0.6)
      + (overLimitDayRate * 0.25)
      + (overTimeNorm * 0.15),
    );
  }

  const activeDayRate = observedWeeklySeries.length > 0
    ? clamp01(toNumber(featureVector.activeDays) / observedWeeklySeries.length)
    : 0;
  const unplannedRepeat = (activeDayRate * 0.55)
    + (durationNorm(featureVector.weeklyAverageMs, 10, 60) * 0.45);

  return clamp01(featureVector.isProtectedTarget ? unplannedRepeat * 0.45 : unplannedRepeat * 0.2);
}

function computeCheckingLoopProxy(featureVector, observedWeeklySeries) {
  if (!featureVector?.hasAnyActivity) return 0;

  const activeHoursToday = countActiveHours(featureVector.todayHourly);
  const activeHoursHabit = countActiveHours(featureVector.habitHourly);
  const avgPerActiveHour = activeHoursToday > 0
    ? featureVector.todayTotalMs / activeHoursToday
    : 0;
  const manySmallBuckets = smooth01(activeHoursToday, 3, 9)
    * (1 - smooth01(avgPerActiveHour, 8 * MINUTE_MS, 25 * MINUTE_MS));
  const habitPeakShare = featureVector.weeklyTotalMs > 0
    ? maxRollingSum(featureVector.habitHourly, 3) / featureVector.weeklyTotalMs
    : 0;
  const habitSpread = smooth01(activeHoursHabit, 4, 12)
    * (1 - smooth01(habitPeakShare, 0.35, 0.75));
  const streakRate = observedWeeklySeries.length > 0
    ? clamp01(toNumber(featureVector.streakDays) / observedWeeklySeries.length)
    : 0;
  const evidenceGate = durationNorm(featureVector.todayTotalMs + featureVector.weeklyAverageMs, 5, 40);

  return clamp01(evidenceGate * (
    (manySmallBuckets * 0.5)
    + (habitSpread * 0.25)
    + (streakRate * 0.25)
  ));
}

function computeCheckingLoopWithVisits(
  featureVector,
  facts = null,
  personalBaselineContext = null,
  entryVisitSummary = null,
  observedWeeklySeries = [],
) {
  if (!featureVector?.hasAnyActivity) return 0;

  const proxyScore = computeCheckingLoopProxy(featureVector, observedWeeklySeries);
  const activeHoursToday = countActiveHours(featureVector.todayHourly);
  const visitShape = entryVisitSummary || resolveSitePullEntryVisitSummary({
    facts,
  });
  const visitHoursToday = visitShape.visitHoursToday;
  const todayVisits = visitShape.todayVisits;
  const avgPerVisitMs = todayVisits > 0 ? featureVector.todayTotalMs / todayVisits : 0;
  const visitDensity = activeHoursToday > 0
    ? smooth01(todayVisits / activeHoursToday, 2, 8)
    : smooth01(todayVisits, 3, 20);
  const shortVisitShape = smooth01(todayVisits, 3, 18)
    * (1 - smooth01(avgPerVisitMs, 8 * MINUTE_MS, 25 * MINUTE_MS));
  const visitSpread = smooth01(visitHoursToday, 2, 8);
  const behavior = facts?.behavior || {};
  const session = facts?.session || {};
  const transitionEdges = facts?.transitionEdges || {};
  const shortRevisitRate = todayVisits > 1
    ? toNumber(behavior.revisitWithin10m) / (todayVisits - 1)
    : 0;
  const switchIns = toNumber(behavior.switchIns);
  const switchOuts = toNumber(behavior.switchOuts);
  const switchChurn = switchIns + switchOuts;
  const quickReturnRate = switchIns > 0
    ? toNumber(behavior.switchBackWithin10m) / switchIns
    : 0;
  const switchChurnRate = todayVisits > 0 ? switchChurn / todayVisits : 0;
  const newTabRate = todayVisits > 0
    ? toNumber(behavior.newTabEntrances) / todayVisits
    : 0;
  const duplicateTabRate = todayVisits > 0
    ? toNumber(behavior.duplicateTabEntrances) / todayVisits
    : 0;
  const measuredSessionCount = toNumber(session.measuredSessionCount);
  const shortSessionRatio = measuredSessionCount > 0
    ? toNumber(session.shortSessionCount) / measuredSessionCount
    : 0;
  const navigationMetrics = buildSitePullNavigationIntentMetrics({ facts });
  const habitualEntryRate = navigationMetrics.directEntryShare;
  const reloadRate = navigationMetrics.reloadShare;
  const navigationLoopScore = clamp01(
    (smooth01(habitualEntryRate, 0.25, 0.75) * 0.6)
    + (smooth01(reloadRate, 0.15, 0.5) * 0.4),
  );
  const tabContextScore = clamp01(
    (smooth01(newTabRate, 0.15, 0.5) * 0.35)
    + (smooth01(duplicateTabRate, 0.15, 0.45) * 0.4)
    + (smooth01(toNumber(behavior.maxSameDomainOpenTabs), 2, 5) * 0.15)
    + (smooth01(toNumber(behavior.highOpenTabEntrances), 1, 5) * 0.1),
  );
  const contentFlow = resolveSitePullContentFlowObservations(behavior);
  const contentFlowScore = Math.max(
    smooth01(contentFlow.feedSkimSignals, 1, 5) * 0.3,
    smooth01(contentFlow.feedAdvanceBursts, 1, 6) * 0.25,
    smooth01(Math.max(contentFlow.fastScrollBursts, contentFlow.scrollSpikeBursts), 2, 10) * 0.15,
    smooth01(contentFlow.maxFeedScreenfuls, 3, 8) * 0.1,
  );
  const transitionEdgeReturnRate = toNumber(transitionEdges.todayCount) > 0
    ? toNumber(transitionEdges.todayReturnWithin10m) / toNumber(transitionEdges.todayCount)
    : 0;
  const transitionEdgeScore = transitionEdges.hasTransitionEdgeFacts
    ? clamp01(
        (smooth01(toNumber(transitionEdges.todayCount), 3, 18) * 0.34)
        + (smooth01(toNumber(transitionEdges.todayDistinctEdgeCount), 2, 8) * 0.22)
        + (smooth01(transitionEdgeReturnRate, 0.12, 0.55) * 0.34)
        + (smooth01(toNumber(transitionEdges.topEdges?.[0]?.count), 2, 8) * 0.1),
      )
    : 0;
  const switchLoopScore = clamp01(
    (smooth01(quickReturnRate, 0.15, 0.6) * smooth01(toNumber(behavior.switchBackWithin10m), 1, 4) * 0.58)
    + (smooth01(switchChurnRate, 0.8, 3) * smooth01(switchChurn, 3, 18) * 0.42),
  );
  // Visit returns, domain-switch returns and route returns can describe one
  // return event. Retain the strongest weighted projection, without an alias bonus.
  const returnFamilyScore = Math.max(
    smooth01(shortRevisitRate, 0.15, 0.6) * smooth01(toNumber(behavior.revisitWithin10m), 1, 4) * 0.2,
    switchLoopScore * 0.31,
    transitionEdgeScore * 0.12,
  );
  const evidenceGate = 0.75 + (durationNorm(featureVector.todayTotalMs + featureVector.weeklyAverageMs, 5, 40) * 0.25);
  const measuredLoopScore = clamp01(
    returnFamilyScore
    + (smooth01(shortSessionRatio, 0.25, 0.75) * smooth01(measuredSessionCount, 2, 6) * 0.18)
    + (visitDensity * 0.12)
    + (navigationLoopScore * 0.08)
    + (tabContextScore * 0.06)
    + (contentFlowScore * 0.05),
  );
  const hasMeasuredLoopFacts = Boolean(
    facts?.behavior?.hasBehaviorFacts
    || facts?.session?.hasMeasuredSessionFacts
    || facts?.navigation?.hasNavigationFacts,
  );

  const visitLoopScore = clamp01(evidenceGate * (
    (visitDensity * 0.35)
    + (shortVisitShape * 0.3)
    + (visitSpread * 0.2)
    + (proxyScore * 0.15)
  ));
  const metricScores = personalBaselineContext?.metricScores;
  const baselineLoopConfidence = Math.max(
    clamp01(metricScores?.visitConfidence),
    clamp01(metricScores?.revisitConfidence),
    clamp01(metricScores?.loopConfidence),
    clamp01(metricScores?.sessionConfidence) * 0.8,
  );
  const baselineLoopScore = clamp01(
    (clamp01(metricScores?.visitAnomalyScore) * 0.22)
    + Math.max(
      clamp01(metricScores?.revisitAnomalyScore) * 0.3,
      clamp01(metricScores?.quickReturnAnomalyScore) * 0.24,
      clamp01(metricScores?.switchChurnAnomalyScore) * 0.14,
    )
    + (clamp01(metricScores?.shortSessionAnomalyScore) * 0.1),
  );
  const policyContext = personalBaselineContext?.policyContext;
  const personalWeight = policyContext ? policyContext.personalWeight : 0;
  const baselineLift = baselineLoopConfidence >= 0.3
    ? baselineLoopScore * (0.65 + (personalWeight * 0.35))
    : 0;
  const resolvedVisitLoopScore = baselineLift > 0
    ? Math.max(visitLoopScore, baselineLift)
    : visitLoopScore;

  return hasMeasuredLoopFacts
    ? Math.max(resolvedVisitLoopScore, measuredLoopScore, baselineLift)
    : resolvedVisitLoopScore;
}

function computeCheckingLoop(
  featureVector,
  facts = null,
  personalBaselineContext = null,
  observedWeeklySeries = [],
) {
  const entryVisitSummary = resolveSitePullEntryVisitSummary({
    facts,
  });
  return entryVisitSummary.hasVisitFacts
    ? computeCheckingLoopWithVisits(
        featureVector,
        facts,
        personalBaselineContext,
        entryVisitSummary,
        observedWeeklySeries,
      )
    : computeCheckingLoopProxy(featureVector, observedWeeklySeries);
}

function computeImmersionDepth(featureVector, facts = null, personalBaselineContext = null) {
  if (!featureVector?.hasAnyActivity || featureVector.todayTotalMs <= 0) return 0;

  let immersionScore = 0;
  if (facts?.session?.hasMeasuredSessionFacts) {
    const session = facts.session;
    const sessionCount = toNumber(session.measuredSessionCount);
    const longSessionRatio = sessionCount > 0
      ? toNumber(session.longSessionCount) / sessionCount
      : 0;
    const focusShare = featureVector.dominantTodayShare;
    immersionScore = clamp01(
      (durationNorm(session.maxSessionMs, 20, 120) * 0.35)
      + (durationNorm(session.measuredAverageSessionMs, 10, 75) * 0.25)
      + (smooth01(longSessionRatio, 0.2, 0.7) * 0.2)
      + (smooth01(focusShare, 0.45, 0.85) * 0.2),
    );
  } else {
    const max3hTodayMs = maxRollingSum(featureVector.todayHourly, 3);
    const focusShare = featureVector.todayTotalMs > 0
      ? max3hTodayMs / featureVector.todayTotalMs
      : 0;
    const activeHoursToday = countActiveHours(featureVector.todayHourly);
    const fewLongBuckets = durationNorm(featureVector.todayTotalMs, 30, 150)
      * (1 - smooth01(activeHoursToday, 5, 12));

    immersionScore = clamp01(
      (durationNorm(max3hTodayMs, 20, 120) * 0.55)
      + (smooth01(focusShare, 0.45, 0.85) * 0.3)
      + (fewLongBuckets * 0.15),
    );
  }

  const metricScores = personalBaselineContext?.metricScores;
  const policyContext = personalBaselineContext?.policyContext;
  const baselineConfidence = metricScores ? clamp01(metricScores.sessionConfidence) : 0;
  if (baselineConfidence < 0.3) return immersionScore;

  const baselineDepth = clamp01(
    (clamp01(metricScores?.sessionDepthAnomalyScore) * 0.72)
    + (clamp01(metricScores?.timeAnomalyScore) * 0.28),
  ) * (0.6 + ((policyContext ? policyContext.personalWeight : 0) * 0.4));
  return clamp01(Math.max(immersionScore, baselineDepth));
}

function computeHabitRegularity(
  featureVector,
  personalBaselineContext = null,
  observedWeeklySeries = [],
) {
  if (!featureVector?.hasAnyActivity || featureVector.weeklyTotalMs <= 0) return 0;

  const dailyValues = observedWeeklySeries
    .map((entry) => toNumber(entry?.activeMs));
  const meanDaily = average(dailyValues);
  const stdDaily = standardDeviation(dailyValues);
  const cv = meanDaily > 0 ? stdDaily / meanDaily : 999;
  const dailyVolumeConsistency = meanDaily > 0 ? 1 - clamp01(cv / 1.25) : 0;
  const activeDayRate = dailyValues.length > 0
    ? clamp01(toNumber(featureVector.activeDays) / dailyValues.length)
    : 0;
  const streakRate = dailyValues.length > 0
    ? clamp01(toNumber(featureVector.streakDays) / dailyValues.length)
    : 0;
  const weeklyScore = clamp01(durationNorm(featureVector.weeklyTotalMs, 15, 180) * (
      (activeDayRate * 0.45)
      + (streakRate * 0.3)
      + (dailyVolumeConsistency * 0.25)
  ));

  const activeMsMetric = personalBaselineContext?.activeMsMetric;
  const baselineConfidence = activeMsMetric ? clamp01(activeMsMetric.confidence) : 0;
  if (baselineConfidence < 0.35) return weeklyScore;
  const observedDays = toNumber(activeMsMetric?.sample?.observedCount);
  const activeBaselineDays = toNumber(activeMsMetric?.sample?.positiveCount);
  const baselineActiveDayRate = observedDays > 0 ? activeBaselineDays / observedDays : 0;

  const baselineRegularity = clamp01(
    durationNorm(activeMsMetric?.sample?.valueTotal, 30, 600)
    * (
      (clamp01(baselineActiveDayRate) * 0.65)
      + (smooth01(activeBaselineDays, 4, 20) * 0.35)
    ),
  );
  const baselineWeight = Math.min(0.35, baselineConfidence * 0.35);
  return clamp01((weeklyScore * (1 - baselineWeight)) + (baselineRegularity * baselineWeight));
}

function computeTrendAcceleration(featureVector, personalBaselineContext = null) {
  if (!featureVector?.hasAnyActivity) return 0;
  const recentTrajectory = personalBaselineContext?.recentTrajectory;
  if (!recentTrajectory
    || recentTrajectory.state === SITE_PULL_PERSONAL_TRAJECTORY_STATES.INSUFFICIENT) return 0;
  return clamp01(recentTrajectory.risingScore)
    * (0.5 + ((personalBaselineContext?.policyContext?.personalWeight || 0) * 0.5));
}

function computeCircadianRisk(featureVector, options = {}) {
  if (!featureVector?.hasAnyActivity || !hasHourlyData(featureVector)) return 0;

  const nightHours = Array.isArray(options.nightHours) ? options.nightHours : SITE_PULL_NIGHT_HOURS;
  const coreLateHours = Array.isArray(options.coreLateHours) ? options.coreLateHours : SITE_PULL_CORE_LATE_HOURS;
  const nightMsToday = sumHours(featureVector.todayHourly, nightHours);
  const coreLateMsToday = sumHours(featureVector.todayHourly, coreLateHours);
  const nightShareToday = featureVector.todayTotalMs > 0
    ? nightMsToday / featureVector.todayTotalMs
    : 0;
  const nightMsHabit = sumHours(featureVector.habitHourly, nightHours);
  const nightShareHabit = featureVector.weeklyTotalMs > 0
    ? nightMsHabit / featureVector.weeklyTotalMs
    : 0;

  return clamp01(
    (durationNorm(nightMsToday, 5, 45) * 0.45)
    + (durationNorm(coreLateMsToday, 3, 30) * 0.25)
    + (smooth01(nightShareToday, 0.2, 0.6) * 0.2)
    + (smooth01(nightShareHabit, 0.1, 0.4) * 0.1),
  );
}

export function hasInterventionFacts(facts = null) {
  return computeInterventionResistance(facts) > 0;
}

function computeInterventionResistance(facts = null) {
  return selectSitePullInterventionReentryWindow(
    resolveSitePullInterventionWindows(facts?.intervention),
  ).score;
}

export function computeSubscores(featureVector, options, facts = null, personalBaseline = null) {
  const personalBaselineContext = resolvePersonalBaselineScoringContext(personalBaseline);
  const observedWeeklySeries = selectObservedWeeklyEntries(featureVector?.weeklySeries, {
    source: 'sitePullScoreModel.weeklySeries',
  });
  const subscores = {
    timePressure: computeTimePressure(featureVector, personalBaselineContext),
    planFriction: computePlanFriction(featureVector, observedWeeklySeries),
    checkingLoop: computeCheckingLoop(
      featureVector,
      facts,
      personalBaselineContext,
      observedWeeklySeries,
    ),
    immersionDepth: computeImmersionDepth(featureVector, facts, personalBaselineContext),
    habitRegularity: computeHabitRegularity(
      featureVector,
      personalBaselineContext,
      observedWeeklySeries,
    ),
    trendAcceleration: computeTrendAcceleration(featureVector, personalBaselineContext),
    circadianRisk: computeCircadianRisk(featureVector, options),
  };
  if (hasInterventionFacts(facts)) {
    subscores.interventionResistance = computeInterventionResistance(facts);
  }
  return subscores;
}

export function computeFeatureConfidences(featureVector, options = {}, facts = null, personalBaseline = null) {
  const personalBaselineContext = resolvePersonalBaselineScoringContext(personalBaseline);
  const weeklyDayCount = selectObservedWeeklyEntries(featureVector?.weeklySeries, {
    source: 'sitePullScoreModel.weeklySeries',
  }).length;
  const historyCoverage = clamp01(weeklyDayCount / 7);
  const activityEvidence = durationNorm(featureVector?.weeklyTotalMs, 10, 180);
  const metricScores = personalBaselineContext?.metricScores;
  const personalBaselineQuality = metricScores ? clamp01(metricScores.timeConfidence) : 0;
  const visitBaselineQuality = Math.max(
    clamp01(metricScores?.visitConfidence),
    clamp01(metricScores?.revisitConfidence),
    clamp01(metricScores?.loopConfidence),
  );
  const sessionBaselineQuality = clamp01(metricScores?.sessionConfidence);
  const hourlyQuality = hasHourlyData(featureVector) ? 1 : 0.4;
  const sessionQuality = facts?.session?.hasMeasuredSessionFacts
    ? 0.86
    : facts?.session?.hasEstimatedSessionFacts
      ? clamp01(toNumber(facts.session.confidence))
      : 0;
  const goalQuality = featureVector?.hasGoal ? 0.9 : featureVector?.isProtectedTarget ? 0.55 : 0.4;
  const collectionCoverageQuality = options?.dataCollectionMode === 'all_sites_minimal'
    ? 1
    : featureVector?.isProtectedTarget
      ? 0.9
      : 0.45;
  const interventionWindows = resolveSitePullInterventionWindows(facts?.intervention);
  const hasScoringInterventionFacts = selectSitePullInterventionReentryWindow(interventionWindows).score > 0;
  const interventionQuality = hasScoringInterventionFacts
    ? resolveSitePullInterventionCohortConfidence(interventionWindows) : 0;
  const entryVisitSummary = resolveSitePullEntryVisitSummary({
    facts,
  });
  const advancedFactCoverage = hasScoringInterventionFacts
    || facts?.behavior?.hasBehaviorFacts
    || facts?.navigation?.hasNavigationFacts
    || facts?.transitionEdges?.hasTransitionEdgeFacts
    ? 1
    : personalBaselineQuality >= 0.35 ? 0.94 : 0.88;

  return {
    timePressure: clamp01(
      0.5
      + (historyCoverage * 0.2)
      + (activityEvidence * 0.2)
      + (personalBaselineQuality * 0.1),
    ),
    planFriction: goalQuality,
    checkingLoop: entryVisitSummary.hasVisitFacts
      ? clamp01(
          0.55
          + (historyCoverage * 0.12)
          + (activityEvidence * 0.12)
          + (facts?.behavior?.hasBehaviorFacts ? 0.16 : 0)
          + (facts?.transitionEdges?.hasTransitionEdgeFacts ? 0.1 : 0)
          + (facts?.session?.hasMeasuredSessionFacts ? 0.1 : 0)
          + (facts?.navigation?.hasNavigationFacts ? 0.08 : 0)
          + (visitBaselineQuality * 0.08),
        )
      : clamp01(0.3 + (historyCoverage * 0.2) + (hourlyQuality * 0.2)),
    immersionDepth: clamp01(
      0.45
      + (hourlyQuality * 0.22)
      + (sessionQuality * 0.1)
      + (sessionBaselineQuality * 0.1),
    ),
    habitRegularity: clamp01(0.2 + (historyCoverage * 0.6) + (activityEvidence * 0.2)),
    trendAcceleration: Math.max(weeklyDayCount >= 5 ? 0.75 : 0.3, personalBaselineQuality * 0.7),
    circadianRisk: hourlyQuality >= 1 ? 0.75 : 0.35,
    interventionResistance: interventionQuality,
    overallParts: {
      historyCoverage,
      activityEvidence,
      featureCoverage: advancedFactCoverage,
      goalContextQuality: featureVector?.hasGoal ? 1 : featureVector?.isProtectedTarget ? 0.65 : 0.45,
      hourlyDataQuality: hourlyQuality,
      collectionCoverageQuality,
      sessionQuality,
      interventionQuality,
      personalBaselineQuality,
    },
  };
}

export function computeOverallConfidence(featureVector, featureConfidences) {
  const parts = featureConfidences.overallParts || {};
  if (!featureVector?.hasAnyActivity) {
    return clamp01(
      (toNumber(parts.featureCoverage) * 0.1)
      + (toNumber(parts.goalContextQuality) * 0.05)
      + (toNumber(parts.hourlyDataQuality) * 0.05)
      + (toNumber(parts.collectionCoverageQuality) * 0.05),
    );
  }

  const baseConfidence = clamp01(
    (toNumber(parts.historyCoverage) * 0.3)
    + (toNumber(parts.activityEvidence) * 0.2)
    + (toNumber(parts.featureCoverage) * 0.2)
    + (toNumber(parts.goalContextQuality) * 0.15)
    + (toNumber(parts.hourlyDataQuality) * 0.1)
    + (toNumber(parts.collectionCoverageQuality) * 0.05),
  );
  return clamp01(baseConfidence + (toNumber(parts.personalBaselineQuality) * 0.08));
}

export function computeRiskBand(score, confidence, hasAnyActivity) {
  if (!hasAnyActivity) return 'low';
  if (confidence < 0.35 && score < 30) return 'watch';
  if (score >= 75) return confidence < 0.4 ? 'elevated' : 'high';
  if (score >= 55) return 'elevated';
  if (score >= 30) return 'watch';
  return 'low';
}

export function resolveTone(riskBand) {
  if (riskBand === 'high') return 'danger';
  if (riskBand === 'elevated') return 'warning';
  if (riskBand === 'watch') return 'neutral';
  return 'positive';
}

export function outputSubscores(subscores) {
  return Object.fromEntries(
    Object.entries(subscores).map(([key, value]) => [key, Math.round(clamp01(value) * 100)]),
  );
}

export function resolveSitePullModelMetadata(facts = null) {
  const hasInterventionResistance = hasInterventionFacts(facts);
  return {
    hasInterventionResistance,
    weights: hasInterventionResistance
      ? SITE_PULL_INTERVENTION_AWARE_WEIGHTS
      : SITE_PULL_BASELINE_WEIGHTS,
    modelVersion: SITE_PULL_MODEL_VERSION,
  };
}
