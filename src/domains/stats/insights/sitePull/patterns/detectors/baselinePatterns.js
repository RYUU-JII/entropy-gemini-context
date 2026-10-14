import {
  SITE_PULL_PATTERN_CATEGORIES,
  createSitePullPatternSignal,
} from '../sitePullPatternContracts.js';
import {
  clamp01,
  toNumber,
} from '../patternUtils.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from '../../personalBaselineMetrics.js';
import {
  SITE_PULL_PERSONAL_BASELINE_STATUSES,
  resolveSitePullPersonalBaselinePolicyContext,
} from '../../personalBaselinePolicy.js';
import { requireSitePullDetectorEvidenceProfile } from './detectorEvidenceProfiles.js';

const MIN_PERSONAL_SPIKE_CONFIDENCE = 0.35;
const STABLE_PERSONAL_SPIKE_CONFIDENCE = 0.65;
const MIN_PERSONAL_SPIKE_SCORE = 0.65;
const FORMING_BASELINE_SPIKE_SCORE = 0.82;
const MIN_PERSONAL_SPIKE_TODAY_MS = 5 * 60_000;
const PERSONAL_SPIKE_RATIO_CHANNEL = 2;
const PERSONAL_SPIKE_ROBUST_Z_CHANNEL = 2;
const PERSONAL_SPIKE_P90_RATIO_CHANNEL = 1.15;

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function buildPersonalSpikeEvidence({ featureVector = {}, personalBaseline = null } = {}) {
  const policyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);
  const activeMsMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
  );
  const todayMs = activeMsMetric
    ? toNumber(activeMsMetric.currentValue)
    : toNumber(featureVector.todayTotalMs);
  const p75ReferenceMs = toNumber(activeMsMetric?.reference?.p75ReferenceMs);
  const p90ReferenceMs = toNumber(activeMsMetric?.reference?.p90ReferenceMs);
  const todayVsP75Ratio = toNumber(activeMsMetric?.anomaly?.ratio);
  const robustZ = toNumber(activeMsMetric?.anomaly?.robustZ);
  const confidence = clamp01(activeMsMetric?.confidence);
  const timeAnomalyScore = clamp01(activeMsMetric?.anomaly?.score);
  const observedDays = toCount(activeMsMetric?.sample?.observedCount);
  const activeDays = toCount(activeMsMetric?.sample?.positiveCount);
  const baselineStatus = policyContext
    ? policyContext.status
    : SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE;
  const channelIds = [];
  if (todayVsP75Ratio >= PERSONAL_SPIKE_RATIO_CHANNEL) {
    channelIds.push('relative_lift');
  }
  if (robustZ >= PERSONAL_SPIKE_ROBUST_Z_CHANNEL) {
    channelIds.push('robust_z_lift');
  }
  if (p90ReferenceMs > 0 && todayMs >= p90ReferenceMs * PERSONAL_SPIKE_P90_RATIO_CHANNEL) {
    channelIds.push('p90_breach');
  }
  const requiredScore = confidence >= STABLE_PERSONAL_SPIKE_CONFIDENCE
    ? MIN_PERSONAL_SPIKE_SCORE
    : FORMING_BASELINE_SPIKE_SCORE;
  const personalSpikeVisible = confidence >= MIN_PERSONAL_SPIKE_CONFIDENCE
    && timeAnomalyScore >= requiredScore
    && todayMs >= MIN_PERSONAL_SPIKE_TODAY_MS
    && channelIds.length > 0;
  const caveats = [];
  if (baselineStatus !== SITE_PULL_PERSONAL_BASELINE_STATUSES.STABLE) {
    caveats.push('baseline_forming');
  }
  if (observedDays < 14) caveats.push('short_baseline_window');
  if (activeDays < 5) caveats.push('sparse_active_baseline');
  if (todayMs < 30 * 60_000) caveats.push('modest_absolute_time');

  return {
    todayMs,
    medianDailyMs: toNumber(activeMsMetric?.stats?.medianDailyMs),
    p75ReferenceMs,
    p90ReferenceMs,
    todayVsP75Ratio,
    robustZ,
    timeAnomalyScore,
    confidence,
    baselineStatus,
    observedDays,
    activeDays,
    activeDayRate: observedDays > 0 ? clamp01(activeDays / observedDays) : 0,
    personalWeight: policyContext ? policyContext.personalWeight : 0,
    personalSpikeVisible,
    personalSpikeChannelIds: channelIds,
    personalSpikeChannelCount: channelIds.length,
    requiredTimeAnomalyScore: requiredScore,
    minTodayMs: MIN_PERSONAL_SPIKE_TODAY_MS,
    caveats,
  };
}

export function detectPersonalBaselinePatterns({
  featureVector,
  personalBaseline = null,
  sessionDepthEvidenceProfile = null,
}) {
  const signals = [];
  const personalSpikeEvidence = buildPersonalSpikeEvidence({ featureVector, personalBaseline });
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  if (personalSpikeEvidence.personalSpikeVisible) {
    signals.push(createSitePullPatternSignal({
      id: 'personal_spike',
      category: SITE_PULL_PATTERN_CATEGORIES.TIME,
      severity: 'warning',
      tone: 'warning',
      score: personalSpikeEvidence.timeAnomalyScore * 100,
      confidence: personalSpikeEvidence.confidence,
      evidence: personalSpikeEvidence,
      source: 'personal_baseline',
    }));
  }
  const visitMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT,
  );
  if (
    metricScores
    && clamp01(metricScores.visitConfidence) >= 0.35
    && clamp01(metricScores.visitAnomalyScore) >= 0.65
  ) {
    signals.push(createSitePullPatternSignal({
      id: 'visit_spike',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp01(metricScores.visitAnomalyScore) * 100,
      confidence: metricScores.visitConfidence,
      evidence: {
        todayVisits: Math.floor(toNumber(visitMetric.currentValue)),
        visitP75: toNumber(visitMetric.stats?.p75Reference),
        todayVsVisitP75Ratio: toNumber(visitMetric.anomaly?.ratio),
        confidence: clamp01(metricScores.visitConfidence),
      },
      source: 'personal_baseline',
    }));
  }
  const revisitCountMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT,
  );
  const revisitRateMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE,
  );
  if (
    metricScores
    && clamp01(metricScores.revisitConfidence) >= 0.35
    && clamp01(metricScores.revisitAnomalyScore) >= 0.55
  ) {
    signals.push(createSitePullPatternSignal({
      id: 'reentry_spike',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'warning',
      score: clamp01(metricScores.revisitAnomalyScore) * 100,
      confidence: metricScores.revisitConfidence,
      evidence: {
        todayRevisitWithin10m: Math.floor(toNumber(revisitCountMetric.currentValue)),
        revisitP75: toNumber(revisitCountMetric.stats?.p75Reference),
        todayRevisitRate: clamp01(revisitRateMetric.currentValue),
        revisitRateP75: toNumber(revisitRateMetric.stats?.p75Reference),
        confidence: clamp01(metricScores.revisitConfidence),
      },
      source: 'personal_baseline',
    }));
  }
  const switchBackMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT,
  );
  const switchInMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT,
  );
  const quickReturnRateMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE,
  );
  if (
    metricScores
    && clamp01(metricScores.loopConfidence) >= 0.35
    && clamp01(metricScores.quickReturnAnomalyScore) >= 0.55
  ) {
    signals.push(createSitePullPatternSignal({
      id: 'quick_return_loop',
      category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
      severity: 'watch',
      tone: 'warning',
      score: clamp01(metricScores.quickReturnAnomalyScore) * 100,
      confidence: metricScores.loopConfidence,
      evidence: {
        todaySwitchBackWithin10m: Math.floor(toNumber(switchBackMetric.currentValue)),
        todaySwitchIns: Math.floor(toNumber(switchInMetric.currentValue)),
        todayQuickReturnRate: clamp01(quickReturnRateMetric.currentValue),
        quickReturnRateP75: toNumber(quickReturnRateMetric.stats?.p75Reference),
        confidence: clamp01(metricScores.loopConfidence),
      },
      source: 'personal_baseline',
    }));
  }
  const switchChurnMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
  );
  if (
    metricScores
    && clamp01(metricScores.loopConfidence) >= 0.35
    && clamp01(metricScores.switchChurnAnomalyScore) >= 0.6
  ) {
    signals.push(createSitePullPatternSignal({
      id: 'switch_churn_loop',
      category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
      severity: 'watch',
      tone: 'neutral',
      score: clamp01(metricScores.switchChurnAnomalyScore) * 100,
      confidence: metricScores.loopConfidence,
      evidence: {
        todaySwitchChurn: Math.floor(toNumber(switchChurnMetric.currentValue)),
        switchChurnP75: toNumber(switchChurnMetric.stats?.p75Reference),
        todayVsSwitchChurnP75Ratio: toNumber(switchChurnMetric.anomaly?.ratio),
        confidence: clamp01(metricScores.loopConfidence),
      },
      source: 'personal_baseline',
    }));
  }
  const sessionDepthProfile = requireSitePullDetectorEvidenceProfile(
    sessionDepthEvidenceProfile,
    'session_depth',
  );
  if (sessionDepthProfile.canEmitShadow) {
    signals.push(createSitePullPatternSignal({
      id: 'session_depth_spike',
      category: SITE_PULL_PATTERN_CATEGORIES.IMMERSION,
      severity: 'watch',
      tone: 'warning',
      score: sessionDepthProfile.score,
      confidence: sessionDepthProfile.confidence,
      evidence: sessionDepthProfile.evidence,
      source: 'personal_baseline',
    }));
  }
  return signals;
}
