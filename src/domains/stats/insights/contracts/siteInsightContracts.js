import {
  INSIGHTS_MODES,
  normalizeInsightsMode,
} from '../../../settings/config/insightsMode.js';

export const SITE_INSIGHT_ENGINE_VERSION = 'site-insight-v1';

export const SITE_INSIGHT_DEPTHS = Object.freeze({
  FACTS: 'facts',
  BASIC: 'basic',
  PRECISION: 'precision',
});

export const SITE_INSIGHT_SEVERITIES = Object.freeze({
  CRITICAL: 'critical',
  WARNING: 'warning',
  NEUTRAL: 'neutral',
  POSITIVE: 'positive',
});

export const SITE_INSIGHT_FAMILIES = Object.freeze({
  BASELINE: 'baseline',
  LIMIT: 'limit',
  TREND: 'trend',
  TIMING: 'timing',
  RECOVERY: 'recovery',
});

export const SITE_INSIGHT_PATTERN_IDS = Object.freeze({
  GOAL_MISSING: 'goal_missing',
  OVER_TARGET: 'over_target',
  NEAR_LIMIT: 'near_limit',
  RISING_VS_BASELINE: 'rising_vs_baseline',
  CLUSTERED_PEAK: 'clustered_peak',
  QUIET: 'quiet',
});

export const SITE_INSIGHT_ACTION_IDS = Object.freeze({
  DEFINE_GOAL: 'define_goal',
  REVIEW_GOAL: 'review_goal',
  WATCH_WINDOW: 'watch_window',
  HOLD_COURSE: 'hold_course',
});

export function resolveSiteInsightDepth(insightsMode) {
  const normalized = normalizeInsightsMode(insightsMode, INSIGHTS_MODES.OFF);
  if (normalized === INSIGHTS_MODES.PRECISION) return SITE_INSIGHT_DEPTHS.PRECISION;
  if (normalized === INSIGHTS_MODES.BASIC) return SITE_INSIGHT_DEPTHS.BASIC;
  return SITE_INSIGHT_DEPTHS.FACTS;
}
