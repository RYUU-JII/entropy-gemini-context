import {
  clamp,
  clamp01,
  toNumber,
} from '../sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from '../personalBaselineMetrics.js';
import {
  SITE_PULL_PERSONAL_TRAJECTORY_STATES,
  SITE_PULL_PERSONAL_BASELINE_STATUSES,
  requireSitePullRecentTrajectory,
  resolveSitePullPersonalBaselinePolicyContext,
} from '../personalBaselinePolicy.js';

export const SITE_PULL_TREND_PRESSURE_EVIDENCE_PROFILE_VERSION = 'site-pull-trend-pressure-evidence-profile-v3';

export const SITE_PULL_TREND_PRESSURE_STATUSES = Object.freeze({
  INSUFFICIENT_TREND_EVIDENCE: 'insufficient_trend_evidence',
  SINGLE_DAY_SPIKE_LIKE: 'single_day_spike_like',
  RECENT_RISE_OBSERVED: 'recent_rise_observed',
  SUSTAINED_RISING_TREND: 'sustained_rising_trend',
  PERSONAL_TREND_SHIFT: 'personal_trend_shift',
});

const MIN_TREND_SCORE = 0.6;
const PERSONAL_BASELINE_CONFIDENCE = 0.35;

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function computePersonalTrendScore({
  recentTrajectory = null,
  baselineConfidence = 0,
  personalWeight = 0,
} = {}) {
  if (clamp01(baselineConfidence) < PERSONAL_BASELINE_CONFIDENCE) return 0;
  return clamp01(
    clamp01(recentTrajectory?.risingScore)
    * (0.55 + (Math.min(0.7, personalWeight) * 0.45)),
  );
}

function resolveStatus({
  personalTrendScore,
  recentRiseScore,
  singleDaySpikeScore,
  trendPressureScore,
  trajectoryState,
  comparisonDays,
  recentActiveDays,
}) {
  if (singleDaySpikeScore >= 0.62) {
    return SITE_PULL_TREND_PRESSURE_STATUSES.SINGLE_DAY_SPIKE_LIKE;
  }
  if (
    trajectoryState === SITE_PULL_PERSONAL_TRAJECTORY_STATES.INSUFFICIENT
    || trendPressureScore < 0.45
    || comparisonDays < 7
  ) {
    return SITE_PULL_TREND_PRESSURE_STATUSES.INSUFFICIENT_TREND_EVIDENCE;
  }
  if (personalTrendScore >= 0.65) {
    return SITE_PULL_TREND_PRESSURE_STATUSES.PERSONAL_TREND_SHIFT;
  }
  if (
    trajectoryState === SITE_PULL_PERSONAL_TRAJECTORY_STATES.RISING
    && recentRiseScore >= 0.66
    && recentActiveDays >= 2
  ) {
    return SITE_PULL_TREND_PRESSURE_STATUSES.SUSTAINED_RISING_TREND;
  }
  if (recentRiseScore >= 0.55 && recentActiveDays >= 2) {
    return SITE_PULL_TREND_PRESSURE_STATUSES.RECENT_RISE_OBSERVED;
  }
  return SITE_PULL_TREND_PRESSURE_STATUSES.INSUFFICIENT_TREND_EVIDENCE;
}

function buildCaveats({
  baselineConfidence,
  recentTrajectory,
  baselineStatus,
}) {
  const caveats = Array.isArray(recentTrajectory?.caveats)
    ? [...recentTrajectory.caveats]
    : [];
  if (toCount(recentTrajectory?.comparisonDays) < 7) caveats.push('partial_trajectory_window');
  if (baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE) {
    caveats.push('personal_baseline_sparse');
  }
  if (clamp01(baselineConfidence) < PERSONAL_BASELINE_CONFIDENCE) {
    caveats.push('personal_baseline_not_authoritative');
  }
  return Array.from(new Set(caveats));
}

export function buildSitePullTrendPressureEvidenceProfile({
  subscores = {},
  personalBaseline = null,
} = {}) {
  const recentTrajectory = requireSitePullRecentTrajectory(personalBaseline);
  const activeMsMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
  );
  const activeStats = activeMsMetric.stats;
  const activeSample = activeMsMetric.sample;
  const activeAnomaly = activeMsMetric.anomaly;
  const trendAccelerationScore = clamp01(subscores.trendAcceleration);
  const recentRiseScore = clamp01(recentTrajectory.risingScore);
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const policyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);
  const baselineConfidence = clamp01(metricScores.timeConfidence);
  const personalWeight = policyContext.personalWeight;
  const personalTrendScore = computePersonalTrendScore({
    recentTrajectory,
    baselineConfidence,
    personalWeight,
  });
  const singleDaySpikeScore = clamp01(recentTrajectory.singleDaySpikeScore);
  const trendPressureScore = clamp01(
    Math.max(personalTrendScore, recentRiseScore, trendAccelerationScore)
    - (singleDaySpikeScore * 0.18),
  );
  const status = resolveStatus({
    personalTrendScore,
    recentRiseScore,
    singleDaySpikeScore,
    trendPressureScore,
    trajectoryState: recentTrajectory.state,
    comparisonDays: recentTrajectory.comparisonDays,
    recentActiveDays: recentTrajectory.recentActiveDays,
  });
  const canEmitVisible = Boolean(
    trendPressureScore >= MIN_TREND_SCORE
    && status !== SITE_PULL_TREND_PRESSURE_STATUSES.INSUFFICIENT_TREND_EVIDENCE
    && status !== SITE_PULL_TREND_PRESSURE_STATUSES.SINGLE_DAY_SPIKE_LIKE
  );
  const confidence = Math.min(clamp01(recentTrajectory.confidence), clamp01(
    0.48
    + (recentTrajectory.comparisonDays >= 5 ? 0.12 : 0)
    + (recentTrajectory.recentActiveDays >= 2 ? 0.08 : 0)
    + (clamp01(recentTrajectory.confidence) * 0.08)
    + (baselineConfidence >= PERSONAL_BASELINE_CONFIDENCE ? 0.06 : 0)
    + (trendPressureScore * 0.08)
    - (singleDaySpikeScore >= 0.62 ? 0.08 : 0),
  ));
  return {
    version: SITE_PULL_TREND_PRESSURE_EVIDENCE_PROFILE_VERSION,
    status,
    canEmitVisible,
    score: clamp(trendPressureScore * 100, 0, 100),
    confidence,
    evidence: {
      todayMs: recentTrajectory.todayMs,
      evidenceFamilyIds: ['daily_usage'],
      comparisonBasis: 'canonical_recent_trajectory',
      intentAssessment: 'not_observed',
      comparisonDays: recentTrajectory.comparisonDays,
      historyDays: toCount(activeSample.positiveCount),
      recentAverageMs: recentTrajectory.recentAverageMs,
      previousAverageMs: recentTrajectory.referenceMs,
      recentActiveDays: recentTrajectory.recentActiveDays,
      previousActiveDays: recentTrajectory.previousActiveDays,
      recentTotalMs: recentTrajectory.recentTotalMs,
      todayShareOfRecent: recentTrajectory.todayShareOfRecent,
      recentPreviousMaxMs: recentTrajectory.recentPreviousMaxMs,
      trendRatio: recentTrajectory.recentVsReferenceRatio,
      personalBaselineStatus: policyContext.status,
      baselineMedianMs: activeStats.medianDailyMs,
      baselineP75Ms: activeStats.p75DailyMs,
      baselineMadMs: activeStats.madMs,
      robustZ: Number(toNumber(activeAnomaly.robustZ).toFixed(3)),
      trajectoryConfidence: round4(recentTrajectory.confidence),
      trendAccelerationScore: round4(trendAccelerationScore),
      recentRiseScore: round4(recentRiseScore),
      personalTrendScore: round4(personalTrendScore),
      singleDaySpikeScore: round4(singleDaySpikeScore),
      trendPressureScore: round4(trendPressureScore),
      trendPressureStatus: status,
      baselineConfidence: round4(baselineConfidence),
      personalWeight: Number(personalWeight.toFixed(4)),
      personalTrendAnomalyScore: round4(recentTrajectory.risingScore),
      personalTrendRatio: recentTrajectory.recentVsReferenceRatio,
      caveats: buildCaveats({
        baselineConfidence,
        recentTrajectory,
        baselineStatus: policyContext.status,
      }),
    },
  };
}
