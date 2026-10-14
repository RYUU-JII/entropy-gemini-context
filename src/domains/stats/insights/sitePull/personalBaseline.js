import {
  SITE_PULL_MINUTE_MS as MINUTE_MS,
  clamp01,
  toCount,
  toNumber,
} from './sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  buildSitePullPersonalBaselineMetricScores,
  buildSitePullPersonalBaselineMetricProfiles,
} from './personalBaselineMetrics.js';
import {
  SITE_PULL_PERSONAL_BASELINE_POLICY,
  SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
  buildSitePullAdaptiveReference,
  buildSitePullPersonalBaselinePolicySummary,
  buildSitePullRecentTrajectory,
  computeSitePullPersonalWeight,
  resolveSitePullPersonalBaselineStatus,
} from './personalBaselinePolicy.js';
import {
  SITE_PULL_PERSONAL_BASELINE_VERSION,
  toPublicPersonalBaseline,
} from './personalBaselinePublicContract.js';
import { normalizeSitePullBaselineSeriesSource } from './baselineSeriesSource.js';

export { SITE_PULL_PERSONAL_BASELINE_VERSION, toPublicPersonalBaseline };

const PERSONAL_BASELINE_TARGET_DAYS = SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays;
const ROBUST_SIGMA_FROM_MAD = SITE_PULL_PERSONAL_BASELINE_POLICY.robustStats.robustSigmaFromMad;
const ROBUST_STATS_OPTIONS = Object.freeze({
  robustSigmaFromMad: ROBUST_SIGMA_FROM_MAD,
  minTimeSigmaMs: SITE_PULL_PERSONAL_BASELINE_POLICY.robustStats.minTimeSigmaMs,
});
const INTERACTION_CONFIDENCE_OPTIONS = Object.freeze({
  targetDays: PERSONAL_BASELINE_TARGET_DAYS,
});

function normalizeSessionStats(source = {}) {
  return {
    count: toCount(source?.count),
    totalMs: toNumber(source?.totalMs),
    shortCount: toCount(source?.shortCount),
    longCount: toCount(source?.longCount),
    maxMs: toNumber(source?.maxMs),
  };
}

function normalizeBehaviorStats(source = {}) {
  return {
    revisitWithin10m: toCount(source?.revisitWithin10m),
    switchIns: toCount(source?.switchIns),
    switchOuts: toCount(source?.switchOuts),
    switchBackWithin10m: toCount(source?.switchBackWithin10m),
  };
}

function normalizeSeries(values = []) {
  return Array.isArray(values)
    ? values.map((entry) => ({
        dateStr: typeof entry?.dateStr === 'string' ? entry.dateStr : '',
        activeMs: toNumber(entry?.activeMs),
        visits: toCount(entry?.visits),
        sessions: normalizeSessionStats(entry?.sessions),
        behavior: normalizeBehaviorStats(entry?.behavior),
        observed: entry?.observed === true,
      }))
    : [];
}

function resolveBaselineEntries(featureVector = {}) {
  return normalizeSitePullBaselineSeriesSource(featureVector, {
    normalizeEntry: (entry) => normalizeSeries([entry])[0],
  }).series;
}

function materializeMetricBaselineEntries(entries) {
  if (entries.length > 0) return entries;
  return Array.from({ length: PERSONAL_BASELINE_TARGET_DAYS }, () => ({
    observed: false,
    activeMs: null,
  }));
}

export function buildPersonalBaseline(featureVector = {}) {
  const entries = resolveBaselineEntries(featureVector);
  const metricBaselineEntries = materializeMetricBaselineEntries(entries);
  if (typeof featureVector.todayObserved !== 'boolean') {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_CURRENT_OBSERVED_INVALID');
  }
  const currentObserved = featureVector.todayObserved;
  const todayVisitsSource = Object.hasOwn(featureVector, 'todayVisits')
    ? featureVector.todayVisits
    : undefined;
  const resolvedTodayVisits = todayVisitsSource === undefined
    ? Array.isArray(featureVector.todayHourlyVisits)
      ? featureVector.todayHourlyVisits.reduce((sum, value) => sum + toCount(value), 0)
      : 0
    : toCount(todayVisitsSource);
  const todayBehavior = normalizeBehaviorStats(featureVector.todayBehaviorStats);
  const todaySession = normalizeSessionStats(featureVector.todaySessionStats);
  const { metrics } = buildSitePullPersonalBaselineMetricProfiles({
    baselineEntries: metricBaselineEntries,
    currentObserved,
    todayActiveMs: toNumber(featureVector.todayTotalMs),
    todayVisits: resolvedTodayVisits,
    todayBehavior,
    todaySession,
    robustSigmaFromMad: ROBUST_SIGMA_FROM_MAD,
    timeStatsOptions: ROBUST_STATS_OPTIONS,
    confidenceOptions: INTERACTION_CONFIDENCE_OPTIONS,
  });
  const activeMsMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS];
  const observedDays = Math.floor(toNumber(activeMsMetric.sample.observedCount));
  const activeDays = Math.floor(toNumber(activeMsMetric.sample.positiveCount));
  const totalBaselineMs = toNumber(activeMsMetric.sample.valueTotal);
  const activeDayRate = observedDays > 0 ? activeDays / observedDays : 0;
  const p75ReferenceMs = toNumber(activeMsMetric.reference.p75ReferenceMs);
  const p90ReferenceMs = toNumber(activeMsMetric.reference.p90ReferenceMs);
  const confidence = Number(clamp01(activeMsMetric.confidence).toFixed(4));
  const visitMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT];
  const revisitCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT];
  const revisitRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE];
  const switchInMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT];
  const switchOutMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT];
  const switchBackMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT];
  const switchChurnMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT];
  const quickReturnRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE];
  const sessionCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT];
  const shortSessionCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT];
  const shortSessionRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE];
  const longSessionCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT];
  const longSessionRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE];
  const maxSessionMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS];
  const metricScores = buildSitePullPersonalBaselineMetricScores(metrics);
  const todayVisits = toCount(visitMetric.currentValue);
  const todayRevisitWithin10m = toCount(revisitCountMetric.currentValue);
  const todayRevisitRate = toNumber(revisitRateMetric.currentValue);
  const todaySwitchIns = toCount(switchInMetric.currentValue);
  const todaySwitchOuts = toCount(switchOutMetric.currentValue);
  const todaySwitchChurn = toCount(switchChurnMetric.currentValue);
  const todaySwitchBackWithin10m = toCount(switchBackMetric.currentValue);
  const todayQuickReturnRate = toNumber(quickReturnRateMetric.currentValue);
  const todaySessionCount = toCount(sessionCountMetric.currentValue);
  const todayShortSessionCount = toCount(shortSessionCountMetric.currentValue);
  const todayShortSessionRate = toNumber(shortSessionRateMetric.currentValue);
  const todayLongSessionCount = toCount(longSessionCountMetric.currentValue);
  const todayLongSessionRate = toNumber(longSessionRateMetric.currentValue);
  const visitConfidence = metricScores.visitConfidence;
  const revisitConfidence = metricScores.revisitConfidence;
  const loopConfidence = metricScores.loopConfidence;
  const sessionConfidence = metricScores.sessionConfidence;
  const visitAnomalyScore = metricScores.visitAnomalyScore;
  const revisitAnomalyScore = metricScores.revisitAnomalyScore;
  const switchChurnAnomalyScore = metricScores.switchChurnAnomalyScore;
  const quickReturnAnomalyScore = metricScores.quickReturnAnomalyScore;
  const shortSessionAnomalyScore = metricScores.shortSessionAnomalyScore;
  const sessionDepthAnomalyScore = metricScores.sessionDepthAnomalyScore;
  const timeAnomalyScore = metricScores.timeAnomalyScore;
  const personalWeight = Number(computeSitePullPersonalWeight(observedDays, confidence).toFixed(4));
  const status = resolveSitePullPersonalBaselineStatus(confidence);
  const recentTrajectory = buildSitePullRecentTrajectory({
    baselineEntries: entries,
    currentObserved,
    todayMs: toNumber(featureVector.todayTotalMs),
    p75ReferenceMs,
    p90ReferenceMs,
    confidence,
  });
  const adaptiveReference = buildSitePullAdaptiveReference({
    p75ReferenceMs,
    confidence,
    personalWeight,
    recentTrajectory,
  });

  return {
    version: SITE_PULL_PERSONAL_BASELINE_VERSION,
    policyVersion: SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
    policy: buildSitePullPersonalBaselinePolicySummary(),
    targetDays: PERSONAL_BASELINE_TARGET_DAYS,
    currentObserved,
    observedDays,
    activeDays,
    activeDayRate: Number(clamp01(activeDayRate).toFixed(3)),
    totalBaselineMs,
    medianDailyMs: activeMsMetric.stats.medianDailyMs,
    p75DailyMs: activeMsMetric.stats.p75DailyMs,
    p90DailyMs: activeMsMetric.stats.p90DailyMs,
    activeMedianMs: activeMsMetric.stats.activeMedianMs,
    activeP75Ms: activeMsMetric.stats.activeP75Ms,
    activeP90Ms: activeMsMetric.stats.activeP90Ms,
    p75ReferenceMs: activeMsMetric.reference.p75ReferenceMs,
    p90ReferenceMs: activeMsMetric.reference.p90ReferenceMs,
    madMs: activeMsMetric.stats.madMs,
    iqrMs: activeMsMetric.stats.iqrMs,
    robustSigmaMs: activeMsMetric.stats.robustSigmaMs,
    todayVsP75Ratio: Number(activeMsMetric.anomaly.ratio.toFixed(3)),
    robustZ: Number(activeMsMetric.anomaly.robustZ.toFixed(3)),
    timeAnomalyScore: Number(timeAnomalyScore.toFixed(4)),
    trendAnomalyScore: Number(clamp01(recentTrajectory.risingScore).toFixed(4)),
    todayVisits,
    visitMedian: visitMetric.stats.median,
    visitP75: visitMetric.stats.p75Reference,
    visitP90: visitMetric.stats.p90Reference,
    todayVsVisitP75Ratio: Number(visitMetric.anomaly.ratio.toFixed(3)),
    visitAnomalyScore: Number(visitAnomalyScore.toFixed(4)),
    visitConfidence: Number(visitConfidence.toFixed(4)),
    todayRevisitWithin10m,
    todayRevisitRate: Number(clamp01(todayRevisitRate).toFixed(4)),
    revisitMedian: revisitCountMetric.stats.median,
    revisitP75: revisitCountMetric.stats.p75Reference,
    revisitP90: revisitCountMetric.stats.p90Reference,
    revisitRateP75: revisitRateMetric.stats.p75Reference,
    todayVsRevisitP75Ratio: Number(revisitCountMetric.anomaly.ratio.toFixed(3)),
    revisitAnomalyScore: Number(revisitAnomalyScore.toFixed(4)),
    revisitConfidence: Number(revisitConfidence.toFixed(4)),
    todaySwitchIns,
    todaySwitchOuts,
    todaySwitchChurn,
    switchChurnMedian: switchChurnMetric.stats.median,
    switchChurnP75: switchChurnMetric.stats.p75Reference,
    switchChurnP90: switchChurnMetric.stats.p90Reference,
    todayVsSwitchChurnP75Ratio: Number(switchChurnMetric.anomaly.ratio.toFixed(3)),
    switchChurnAnomalyScore: Number(switchChurnAnomalyScore.toFixed(4)),
    todaySwitchBackWithin10m,
    todayQuickReturnRate: Number(clamp01(todayQuickReturnRate).toFixed(4)),
    quickReturnRateP75: quickReturnRateMetric.stats.p75Reference,
    quickReturnAnomalyScore: Number(quickReturnAnomalyScore.toFixed(4)),
    loopConfidence: Number(loopConfidence.toFixed(4)),
    todaySessionCount,
    todayShortSessionCount,
    todayShortSessionRate: Number(clamp01(todayShortSessionRate).toFixed(4)),
    shortSessionRateP75: shortSessionRateMetric.stats.p75Reference,
    shortSessionAnomalyScore: Number(shortSessionAnomalyScore.toFixed(4)),
    todayLongSessionCount,
    todayLongSessionRate: Number(clamp01(todayLongSessionRate).toFixed(4)),
    longSessionRateP75: longSessionRateMetric.stats.p75Reference,
    todayMaxSessionMs: toNumber(maxSessionMetric.currentValue),
    maxSessionMedianMs: maxSessionMetric.stats.median,
    maxSessionP75Ms: maxSessionMetric.stats.p75Reference,
    maxSessionP90Ms: maxSessionMetric.stats.p90Reference,
    todayVsMaxSessionP75Ratio: Number(maxSessionMetric.anomaly.ratio.toFixed(3)),
    maxSessionRobustZ: Number(maxSessionMetric.anomaly.robustZ.toFixed(3)),
    sessionDepthAnomalyScore: Number(sessionDepthAnomalyScore.toFixed(4)),
    sessionConfidence: Number(sessionConfidence.toFixed(4)),
    recentAverageMs: toNumber(recentTrajectory.recentAverageMs),
    baselineAverageMs: toNumber(recentTrajectory.referenceMs),
    trendRatio: Number(toNumber(recentTrajectory.recentVsReferenceRatio).toFixed(3)),
    confidence: Number(confidence.toFixed(4)),
    personalWeight: Number(personalWeight.toFixed(4)),
    status,
    metrics,
    recentTrajectory,
    adaptiveReference,
  };
}
