import {
  SITE_PULL_MINUTE_MS,
  clamp,
  clamp01,
  durationNorm,
  smooth01,
  toNumber,
} from '../sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from '../personalBaselineMetrics.js';

export const SITE_PULL_SESSION_DEPTH_EVIDENCE_PROFILE_VERSION = 'site-pull-session-depth-evidence-profile-v2';

export const SITE_PULL_SESSION_DEPTH_STATUSES = Object.freeze({
  INSUFFICIENT_BASELINE: 'insufficient_session_baseline',
  MILD_DEPTH_LIFT: 'mild_session_depth_lift',
  CLEAR_DEPTH_SPIKE: 'clear_session_depth_spike',
  EXTREME_DEPTH_SPIKE: 'extreme_session_depth_spike',
});

const MIN_SESSION_CONFIDENCE = 0.35;
const MIN_SPIKE_SCORE = 0.6;
const EXTREME_SPIKE_SCORE = 0.82;
const RELATIVE_DEPTH_RATIO_CHANNEL = 1.5;
const ROBUST_Z_DEPTH_CHANNEL = 1.8;
const P90_DEPTH_RATIO_CHANNEL = 1.15;
const LONG_SESSION_RATE_LIFT_CHANNEL = 1.5;
const ABSOLUTE_DEPTH_MS = 60 * SITE_PULL_MINUTE_MS;

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function round3(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(Math.max(0, numeric).toFixed(3)) : 0;
}

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function buildCaveats({
  observedDays,
  sessionConfidence,
  todayMaxSessionMs,
  todayVsP75Ratio,
}) {
  const caveats = [];
  if (sessionConfidence < 0.55) caveats.push('session_baseline_forming');
  if (observedDays < 7) caveats.push('limited_baseline_days');
  if (todayMaxSessionMs < 20 * SITE_PULL_MINUTE_MS) caveats.push('short_absolute_session_depth');
  if (todayVsP75Ratio < 1.25) caveats.push('weak_relative_lift');
  return caveats;
}

function resolveStatus({
  score,
  sessionConfidence,
  todayMaxSessionMs,
  p75ReferenceMs,
  p90ReferenceMs,
  todayVsP75Ratio,
  robustZ,
}) {
  if (
    sessionConfidence < MIN_SESSION_CONFIDENCE
    || todayMaxSessionMs <= 0
    || p75ReferenceMs <= 0
  ) {
    return SITE_PULL_SESSION_DEPTH_STATUSES.INSUFFICIENT_BASELINE;
  }
  if (
    score >= EXTREME_SPIKE_SCORE
    || todayVsP75Ratio >= 2.2
    || (p90ReferenceMs > 0 && todayMaxSessionMs >= p90ReferenceMs * 1.35)
    || robustZ >= 2.6
  ) {
    return SITE_PULL_SESSION_DEPTH_STATUSES.EXTREME_DEPTH_SPIKE;
  }
  if (score >= MIN_SPIKE_SCORE) {
    return SITE_PULL_SESSION_DEPTH_STATUSES.CLEAR_DEPTH_SPIKE;
  }
  return SITE_PULL_SESSION_DEPTH_STATUSES.MILD_DEPTH_LIFT;
}

function buildSessionDepthChannels({
  todayMaxSessionMs,
  p75ReferenceMs,
  p90ReferenceMs,
  todayVsP75Ratio,
  robustZ,
  longSessionRateLift,
}) {
  const channelIds = [];
  if (todayVsP75Ratio >= RELATIVE_DEPTH_RATIO_CHANNEL) {
    channelIds.push('relative_depth_lift');
  }
  if (robustZ >= ROBUST_Z_DEPTH_CHANNEL) {
    channelIds.push('robust_z_depth_lift');
  }
  if (p90ReferenceMs > 0 && todayMaxSessionMs >= p90ReferenceMs * P90_DEPTH_RATIO_CHANNEL) {
    channelIds.push('p90_depth_breach');
  }
  if (longSessionRateLift >= LONG_SESSION_RATE_LIFT_CHANNEL) {
    channelIds.push('long_session_rate_lift');
  }
  if (todayMaxSessionMs >= ABSOLUTE_DEPTH_MS) {
    channelIds.push('absolute_depth');
  }
  if (p75ReferenceMs <= 0) {
    return [];
  }
  return channelIds;
}

export function buildSitePullSessionDepthEvidenceProfile({
  personalBaseline = null,
} = {}) {
  const maxSessionMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS,
  );
  const longSessionRateMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE,
  );
  const sessionCountMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT,
  );
  const longSessionCountMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT,
  );
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const todayMaxSessionMs = toNumber(maxSessionMetric?.currentValue);
  const medianReferenceMs = toNumber(maxSessionMetric?.stats?.median);
  const p75ReferenceMs = toNumber(maxSessionMetric?.stats?.p75Reference);
  const p90ReferenceMs = toNumber(maxSessionMetric?.stats?.p90Reference);
  const sessionConfidence = Math.min(clamp01(maxSessionMetric?.confidence), clamp01(metricScores?.sessionConfidence));
  const score = clamp01(metricScores?.sessionDepthAnomalyScore);
  const todayVsP75Ratio = toNumber(maxSessionMetric?.anomaly?.ratio);
  const robustZ = toNumber(maxSessionMetric?.anomaly?.robustZ);
  const observedDays = toCount(maxSessionMetric?.sample?.observedCount);
  const activeDays = toCount(maxSessionMetric?.sample?.positiveCount);
  const longSessionRate = clamp01(longSessionRateMetric?.currentValue);
  // Descriptive lift uses observed percentiles, never the scoring reference floor.
  const longSessionRateP75 = clamp01(longSessionRateMetric?.stats?.p75);
  const longSessionRateLift = longSessionRateP75 > 0
    ? longSessionRate / longSessionRateP75
    : null;
  const absoluteDepthScore = durationNorm(todayMaxSessionMs, 20, 120);
  const relativeDepthScore = clamp01(
    (smooth01(todayVsP75Ratio, 1.08, 2.4) * 0.52)
    + (smooth01(robustZ, 0.7, 2.6) * 0.28)
    + (p90ReferenceMs > 0 ? smooth01(todayMaxSessionMs - p90ReferenceMs, 0, p90ReferenceMs * 0.75) * 0.2 : 0),
  );
  const status = resolveStatus({
    score,
    sessionConfidence,
    todayMaxSessionMs,
    p75ReferenceMs,
    p90ReferenceMs,
    todayVsP75Ratio,
    robustZ,
  });
  const channelIds = buildSessionDepthChannels({
    todayMaxSessionMs,
    p75ReferenceMs,
    p90ReferenceMs,
    todayVsP75Ratio,
    robustZ,
    longSessionRateLift,
  });
  const hasCurrentMeasuredSession = maxSessionMetric?.currentObserved === true
    && toCount(sessionCountMetric?.currentValue) > 0 && todayMaxSessionMs > 0;
  const canEmitShadow = hasCurrentMeasuredSession && channelIds.length > 0
    && (status === SITE_PULL_SESSION_DEPTH_STATUSES.CLEAR_DEPTH_SPIKE
      || status === SITE_PULL_SESSION_DEPTH_STATUSES.EXTREME_DEPTH_SPIKE);

  return {
    version: SITE_PULL_SESSION_DEPTH_EVIDENCE_PROFILE_VERSION,
    status,
    canEmitShadow,
    score: clamp(score * 100, 0, 100),
    confidence: sessionConfidence,
    evidence: {
      todayMaxSessionMs,
      hasCurrentMeasuredSession,
      evidenceFamilyIds: hasCurrentMeasuredSession ? ['session_duration'] : [],
      maxSessionMedianMs: medianReferenceMs,
      maxSessionP75Ms: toNumber(maxSessionMetric?.stats?.p75),
      maxSessionP90Ms: toNumber(maxSessionMetric?.stats?.p90),
      maxSessionReferenceMs: p75ReferenceMs,
      maxSessionP90ReferenceMs: p90ReferenceMs,
      todayVsMaxSessionReferenceRatio: round3(todayVsP75Ratio),
      todayVsMaxSessionP75Ratio: toNumber(maxSessionMetric?.stats?.p75) > 0
        ? round3(todayMaxSessionMs / maxSessionMetric.stats.p75) : null,
      maxSessionRobustZ: Number(Math.max(0, robustZ).toFixed(3)),
      sessionDepthAnomalyScore: round4(score),
      sessionConfidence: round4(sessionConfidence),
      observedDays,
      activeDays,
      todaySessionCount: toCount(sessionCountMetric?.currentValue),
      todayLongSessionCount: toCount(longSessionCountMetric?.currentValue),
      todayLongSessionRate: round4(longSessionRate),
      longSessionRateP75: round4(longSessionRateP75),
      longSessionRateLift: longSessionRateLift === null ? null : round3(longSessionRateLift),
      absoluteDepthScore: round4(absoluteDepthScore),
      relativeDepthScore: round4(relativeDepthScore),
      sessionDepthChannelIds: channelIds,
      sessionDepthChannelCount: channelIds.length,
      sessionDepthVisible: canEmitShadow && channelIds.length > 0,
      spikeStatus: status,
      caveats: buildCaveats({
        observedDays,
        sessionConfidence,
        todayMaxSessionMs,
        todayVsP75Ratio,
      }),
    },
  };
}
