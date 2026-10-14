import {
  SITE_INSIGHT_ACTION_IDS,
  SITE_INSIGHT_DEPTHS,
  SITE_INSIGHT_FAMILIES,
  SITE_INSIGHT_PATTERN_IDS,
  SITE_INSIGHT_SEVERITIES,
  resolveSiteInsightDepth,
} from '../contracts/siteInsightContracts.js';

function toMinutes(valueMs) {
  return Math.round((Number(valueMs) || 0) / 60_000);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function depthRank(depth) {
  if (depth === SITE_INSIGHT_DEPTHS.PRECISION) return 2;
  if (depth === SITE_INSIGHT_DEPTHS.BASIC) return 1;
  return 0;
}

function createSignal({
  id,
  family,
  severity,
  score,
  confidence,
  summaryCode = id,
  supportingFacts = [],
  recommendedAction = null,
  metadata = {},
} = {}) {
  return {
    id,
    family,
    severity,
    score: clamp(Number(score) || 0, 0, 100),
    confidence: clamp(Number(confidence) || 0, 0, 1),
    summaryCode,
    supportingFacts,
    recommendedAction,
    metadata,
  };
}

function evaluateOverTarget(featureVector) {
  if (!featureVector?.isProtectedTarget) return null;
  if (!featureVector?.hasGoal) return null;
  if (featureVector.overGoalMs <= 0) return null;

  return createSignal({
    id: SITE_INSIGHT_PATTERN_IDS.OVER_TARGET,
    family: SITE_INSIGHT_FAMILIES.LIMIT,
    severity: SITE_INSIGHT_SEVERITIES.CRITICAL,
    score: 82 + Math.min(18, featureVector.usageRatio * 10),
    confidence: 0.98,
    supportingFacts: [
      { id: 'over_goal_minutes', value: toMinutes(featureVector.overGoalMs), unit: 'minutes' },
      { id: 'goal_minutes', value: featureVector.goalMinutes, unit: 'minutes' },
    ],
    recommendedAction: {
      id: SITE_INSIGHT_ACTION_IDS.REVIEW_GOAL,
      currentGoalMinutes: featureVector.goalMinutes,
    },
    metadata: {
      usageRatio: featureVector.usageRatio,
    },
  });
}

function evaluateGoalMissing(featureVector) {
  if (!featureVector?.isProtectedTarget || featureVector?.hasGoal) return null;
  if (featureVector?.todayTotalMs <= 0 && !featureVector?.hasAnyActivity) return null;

  return createSignal({
    id: SITE_INSIGHT_PATTERN_IDS.GOAL_MISSING,
    family: SITE_INSIGHT_FAMILIES.LIMIT,
    severity: SITE_INSIGHT_SEVERITIES.NEUTRAL,
    score: 40,
    confidence: 0.82,
    supportingFacts: [
      { id: 'today_total_minutes', value: toMinutes(featureVector.todayTotalMs), unit: 'minutes' },
    ],
    recommendedAction: {
      id: SITE_INSIGHT_ACTION_IDS.DEFINE_GOAL,
    },
  });
}

function evaluateNearLimit(featureVector) {
  if (!featureVector?.isProtectedTarget || !featureVector?.hasGoal) return null;
  if (featureVector.overGoalMs > 0 || featureVector.remainingMs <= 0) return null;
  if (featureVector.remainingMs > 20 * 60_000) return null;

  return createSignal({
    id: SITE_INSIGHT_PATTERN_IDS.NEAR_LIMIT,
    family: SITE_INSIGHT_FAMILIES.LIMIT,
    severity: SITE_INSIGHT_SEVERITIES.WARNING,
    score: 70,
    confidence: 0.94,
    supportingFacts: [
      { id: 'remaining_minutes', value: toMinutes(featureVector.remainingMs), unit: 'minutes' },
      { id: 'today_total_minutes', value: toMinutes(featureVector.todayTotalMs), unit: 'minutes' },
    ],
    recommendedAction: {
      id: SITE_INSIGHT_ACTION_IDS.REVIEW_GOAL,
      currentGoalMinutes: featureVector.goalMinutes,
    },
  });
}

function evaluateRisingBaseline(featureVector) {
  if (!featureVector?.isProtectedTarget || !featureVector?.hasWeeklyHistory) return null;
  if (featureVector.historyDays < 3) return null;
  if (featureVector.trendDirection !== 'up') return null;
  if (featureVector.trendRatio < 1.15) return null;
  if (featureVector.recentAverageMs < 10 * 60_000) return null;

  return createSignal({
    id: SITE_INSIGHT_PATTERN_IDS.RISING_VS_BASELINE,
    family: SITE_INSIGHT_FAMILIES.TREND,
    severity: SITE_INSIGHT_SEVERITIES.WARNING,
    score: clamp(56 + ((featureVector.trendRatio - 1) * 24), 0, 84),
    confidence: clamp(0.68 + (featureVector.historyDays / 14), 0, 0.92),
    supportingFacts: [
      { id: 'recent_average_minutes', value: toMinutes(featureVector.recentAverageMs), unit: 'minutes' },
      { id: 'baseline_average_minutes', value: toMinutes(featureVector.baselineAverageMs), unit: 'minutes' },
    ],
    recommendedAction: {
      id: SITE_INSIGHT_ACTION_IDS.REVIEW_GOAL,
      currentGoalMinutes: featureVector.goalMinutes,
    },
    metadata: {
      trendRatio: featureVector.trendRatio,
    },
  });
}

function evaluateClusteredPeak(featureVector) {
  if (!featureVector?.isProtectedTarget) return null;
  if (!featureVector?.dominantTodayWindow || featureVector.todayTotalMs <= 0) return null;
  if (featureVector.dominantTodayWindow.totalMs < 20 * 60_000) return null;
  if (featureVector.dominantTodayShare < 0.45) return null;

  return createSignal({
    id: SITE_INSIGHT_PATTERN_IDS.CLUSTERED_PEAK,
    family: SITE_INSIGHT_FAMILIES.TIMING,
    severity: SITE_INSIGHT_SEVERITIES.WARNING,
    score: clamp(54 + (featureVector.dominantTodayShare * 40), 0, 78),
    confidence: 0.76,
    supportingFacts: [
      {
        id: 'dominant_window',
        value: {
          startHour: featureVector.dominantTodayWindow.startHour,
          endHour: featureVector.dominantTodayWindow.endHour,
        },
      },
      {
        id: 'dominant_window_share_percent',
        value: Math.round(featureVector.dominantTodayShare * 100),
        unit: 'percent',
      },
    ],
    recommendedAction: {
      id: SITE_INSIGHT_ACTION_IDS.WATCH_WINDOW,
      startHour: featureVector.dominantTodayWindow.startHour,
      endHour: featureVector.dominantTodayWindow.endHour,
    },
  });
}

function evaluateQuiet(featureVector) {
  if (!featureVector?.hasAnyActivity) return null;
  if (featureVector?.overGoalMs > 0) return null;
  if (featureVector?.trendDirection === 'up' && featureVector?.trendRatio >= 1.15) return null;

  const withinGoal = !featureVector.hasGoal || featureVector.usageRatio <= 0.7;
  if (!withinGoal) return null;

  return createSignal({
    id: SITE_INSIGHT_PATTERN_IDS.QUIET,
    family: SITE_INSIGHT_FAMILIES.RECOVERY,
    severity: SITE_INSIGHT_SEVERITIES.POSITIVE,
    score: 42,
    confidence: 0.7,
    supportingFacts: [
      { id: 'today_total_minutes', value: toMinutes(featureVector.todayTotalMs), unit: 'minutes' },
      { id: 'active_days', value: featureVector.activeDays, unit: 'days' },
    ],
    recommendedAction: {
      id: SITE_INSIGHT_ACTION_IDS.HOLD_COURSE,
    },
  });
}

const SITE_PATTERN_DETECTORS = Object.freeze([
  {
    id: SITE_INSIGHT_PATTERN_IDS.GOAL_MISSING,
    minDepth: SITE_INSIGHT_DEPTHS.FACTS,
    evaluate: evaluateGoalMissing,
  },
  {
    id: SITE_INSIGHT_PATTERN_IDS.OVER_TARGET,
    minDepth: SITE_INSIGHT_DEPTHS.FACTS,
    evaluate: evaluateOverTarget,
  },
  {
    id: SITE_INSIGHT_PATTERN_IDS.NEAR_LIMIT,
    minDepth: SITE_INSIGHT_DEPTHS.FACTS,
    evaluate: evaluateNearLimit,
  },
  {
    id: SITE_INSIGHT_PATTERN_IDS.RISING_VS_BASELINE,
    minDepth: SITE_INSIGHT_DEPTHS.BASIC,
    evaluate: evaluateRisingBaseline,
  },
  {
    id: SITE_INSIGHT_PATTERN_IDS.CLUSTERED_PEAK,
    minDepth: SITE_INSIGHT_DEPTHS.BASIC,
    evaluate: evaluateClusteredPeak,
  },
  {
    id: SITE_INSIGHT_PATTERN_IDS.QUIET,
    minDepth: SITE_INSIGHT_DEPTHS.FACTS,
    evaluate: evaluateQuiet,
  },
]);

export function evaluateSitePatterns({ featureVector, insightsMode } = {}) {
  const depth = resolveSiteInsightDepth(insightsMode);
  return SITE_PATTERN_DETECTORS
    .filter((detector) => depthRank(depth) >= depthRank(detector.minDepth))
    .map((detector) => detector.evaluate(featureVector))
    .filter(Boolean);
}
