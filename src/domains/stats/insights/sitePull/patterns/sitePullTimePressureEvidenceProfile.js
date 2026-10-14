import {
  SITE_PULL_MINUTE_MS,
  clamp01,
  durationNorm,
  ratioNorm,
  toNumber,
} from '../sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from '../personalBaselineMetrics.js';
import {
  requireSitePullRecentTrajectory,
  resolveSitePullPersonalBaselinePolicyContext,
} from '../personalBaselinePolicy.js';

export const SITE_PULL_TIME_PRESSURE_EVIDENCE_PROFILE_VERSION = 'site-pull-time-pressure-evidence-profile-v2';

export const SITE_PULL_TIME_PRESSURE_STATUSES = Object.freeze({
  INSUFFICIENT_USAGE: 'insufficient_time_pressure_evidence',
  ELEVATED_SO_FAR: 'elevated_time_so_far',
  HEAVY_TODAY: 'heavy_time_today',
  UNUSUALLY_HEAVY_FOR_YOU: 'unusually_heavy_for_you',
});

const MIN_VISIBLE_TIME_MS = 5 * SITE_PULL_MINUTE_MS;
const MIN_VISIBLE_TIME_PRESSURE = 0.7;
const ABSOLUTE_HEAVY_TIME_MS = 90 * SITE_PULL_MINUTE_MS;
const CONTEXTUAL_HEAVY_TIME_MS = 45 * SITE_PULL_MINUTE_MS;
const MIN_WEEKLY_LIFT_SCORE = 0.72;
const PERSONAL_SPIKE_SCORE = 0.65;
const PERSONAL_BASELINE_CONFIDENCE = 0.35;

function round3(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(Math.max(0, numeric).toFixed(3)) : 0;
}

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function computeTodayVsWeeklyRatio(todayMs, weeklyAverageMs) {
  if (weeklyAverageMs >= 5 * SITE_PULL_MINUTE_MS) return todayMs / weeklyAverageMs;
  return null;
}

function buildCaveats({
  baselineConfidence,
  hasWeeklyHistory,
  personalWeight,
  todayMs,
  weeklyAverageMs,
}) {
  const caveats = [];
  if (!hasWeeklyHistory || weeklyAverageMs <= 0) caveats.push('weekly_reference_unavailable');
  if (baselineConfidence < PERSONAL_BASELINE_CONFIDENCE || personalWeight <= 0.02) {
    caveats.push('personal_baseline_not_authoritative');
  }
  if (todayMs < 30 * SITE_PULL_MINUTE_MS) caveats.push('modest_absolute_time');
  return caveats;
}

function buildTimePressureChannels({
  timePressureScore,
  todayMs,
  todayAbsoluteScore,
  todayVsWeeklyScore,
  weeklyAverageMs,
}) {
  const channels = [];
  if (todayMs >= MIN_VISIBLE_TIME_MS && timePressureScore >= MIN_VISIBLE_TIME_PRESSURE) {
    channels.push('time_pressure_score');
  }
  if (todayMs >= ABSOLUTE_HEAVY_TIME_MS && todayAbsoluteScore >= 0.8) {
    channels.push('absolute_duration');
  }
  if (
    weeklyAverageMs >= MIN_VISIBLE_TIME_MS
    && todayMs >= CONTEXTUAL_HEAVY_TIME_MS
    && todayVsWeeklyScore >= MIN_WEEKLY_LIFT_SCORE
  ) {
    channels.push('weekly_lift');
  }
  return channels;
}

function resolveStatus({
  baselineConfidence,
  channelIds,
  personalTimeAnomalyScore,
  personalWeight,
  timePressureScore,
  todayMs,
}) {
  const channelSet = new Set(channelIds);
  if (todayMs <= 0 || (timePressureScore < 0.45 && channelSet.size === 0)) {
    return SITE_PULL_TIME_PRESSURE_STATUSES.INSUFFICIENT_USAGE;
  }
  if (
    channelSet.has('personal_baseline_lift')
    || (
      baselineConfidence >= PERSONAL_BASELINE_CONFIDENCE
      && personalWeight > 0.02
      && personalTimeAnomalyScore >= PERSONAL_SPIKE_SCORE
      && timePressureScore >= MIN_VISIBLE_TIME_PRESSURE
    )
  ) {
    return SITE_PULL_TIME_PRESSURE_STATUSES.UNUSUALLY_HEAVY_FOR_YOU;
  }
  if (
    timePressureScore >= MIN_VISIBLE_TIME_PRESSURE
    || channelSet.has('absolute_duration')
    || channelSet.has('weekly_lift')
  ) {
    return SITE_PULL_TIME_PRESSURE_STATUSES.HEAVY_TODAY;
  }
  return SITE_PULL_TIME_PRESSURE_STATUSES.ELEVATED_SO_FAR;
}

export function buildSitePullTimePressureEvidenceProfile({
  featureVector = {},
  subscores = {},
  personalBaseline = null,
} = {}) {
  const todayMs = toNumber(featureVector.todayTotalMs);
  const weeklyAverageMs = toNumber(featureVector.weeklyAverageMs);
  const recentTrajectory = personalBaseline === null || personalBaseline === undefined
    ? null
    : requireSitePullRecentTrajectory(personalBaseline);
  const recentAverageMs = toNumber(recentTrajectory?.recentAverageMs);
  const baselineAverageMs = toNumber(recentTrajectory?.referenceMs);
  const timePressureScore = clamp01(subscores.timePressure);
  const todayAbsoluteScore = durationNorm(todayMs, 5, 120);
  const weeklyAverageScore = durationNorm(weeklyAverageMs, 5, 90);
  const todayVsWeeklyRatio = computeTodayVsWeeklyRatio(todayMs, weeklyAverageMs);
  const todayVsWeeklyScore = weeklyAverageMs >= 5 * SITE_PULL_MINUTE_MS
    ? ratioNorm(todayVsWeeklyRatio, 1.1, 2.2)
    : durationNorm(todayMs, 10, 90) * 0.6;
  const activeMsMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
  );
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const policyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);
  const baselineConfidence = clamp01(metricScores?.timeConfidence);
  const personalWeight = policyContext ? policyContext.personalWeight : 0;
  const personalTimeAnomalyScore = clamp01(metricScores?.timeAnomalyScore);
  const trendAnomalyScore = clamp01(recentTrajectory?.risingScore);
  const channelIds = buildTimePressureChannels({
    timePressureScore,
    todayMs,
    todayAbsoluteScore,
    todayVsWeeklyScore,
    weeklyAverageMs,
  });
  if (baselineConfidence >= PERSONAL_BASELINE_CONFIDENCE && personalWeight > 0.02
    && personalTimeAnomalyScore >= PERSONAL_SPIKE_SCORE && todayMs >= MIN_VISIBLE_TIME_MS) {
    channelIds.push('personal_baseline_lift');
  }
  const status = resolveStatus({
    baselineConfidence,
    channelIds,
    personalTimeAnomalyScore,
    personalWeight,
    timePressureScore,
    todayMs,
  });
  const canEmitVisible = todayMs >= MIN_VISIBLE_TIME_MS
    && channelIds.length > 0
    && status !== SITE_PULL_TIME_PRESSURE_STATUSES.INSUFFICIENT_USAGE;
  const confidence = clamp01(
    0.58
    + (todayMs > 0 ? 0.08 : 0)
    + (featureVector.hasWeeklyHistory ? 0.06 : 0)
    + (baselineConfidence >= PERSONAL_BASELINE_CONFIDENCE ? 0.06 : 0)
    + (timePressureScore * 0.08),
  );

  return {
    version: SITE_PULL_TIME_PRESSURE_EVIDENCE_PROFILE_VERSION,
    status,
    canEmitVisible,
    score: timePressureScore * 100,
    confidence,
    evidence: {
      todayMs,
      usageBasis: 'calendar-day',
      weeklyReferenceBasis: 'current-inclusive-calendar-days',
      evidenceFamilyIds: ['active_usage'],
      weeklyAverageMs,
      recentAverageMs,
      baselineAverageMs,
      todayVsWeeklyRatio: todayVsWeeklyRatio === null ? null : round3(todayVsWeeklyRatio),
      todayAbsoluteScore: round4(todayAbsoluteScore),
      weeklyAverageScore: round4(weeklyAverageScore),
      todayVsWeeklyScore: round4(todayVsWeeklyScore),
      hasPersonalBaseline: baselineConfidence >= PERSONAL_BASELINE_CONFIDENCE,
      baselineConfidence: round4(baselineConfidence),
      personalWeight: Number(personalWeight.toFixed(4)),
      p75ReferenceMs: toNumber(activeMsMetric?.reference?.p75ReferenceMs),
      p90ReferenceMs: toNumber(activeMsMetric?.reference?.p90ReferenceMs),
      todayVsP75Ratio: round3(activeMsMetric?.anomaly?.ratio),
      personalTimeAnomalyScore: round4(personalTimeAnomalyScore),
      trendAnomalyScore: round4(trendAnomalyScore),
      timePressureScore: round4(timePressureScore),
      timePressureVisible: canEmitVisible,
      timePressureChannelIds: channelIds,
      timePressureChannelCount: channelIds.length,
      absoluteHeavyThresholdMs: ABSOLUTE_HEAVY_TIME_MS,
      contextualHeavyThresholdMs: CONTEXTUAL_HEAVY_TIME_MS,
      timePressureStatus: status,
      caveats: buildCaveats({
        baselineConfidence,
        hasWeeklyHistory: Boolean(featureVector.hasWeeklyHistory),
        personalWeight,
        todayMs,
        weeklyAverageMs,
      }),
    },
  };
}
