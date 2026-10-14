import { PERSONAL_BASELINE_ROLES } from '../../../../lib/personalBaselineContract.js';
import {
  BASIC_RECENT_USAGE_WINDOW_DAYS,
  BASIC_TARGET_MAX_RECOMMENDED_MINUTES,
  BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES,
  BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE,
  BASIC_TARGET_RECOMMENDATION_VERSION,
  deriveBasicTargetRecommendationRelation,
  requireBasicRecentUsageTrajectory,
  requireBasicTargetRecommendationForTrajectory,
} from '../contracts/basicStrategyContextContract.js';

export const BASIC_STRATEGY_POLICY_DEFAULTS = Object.freeze({
  recentUsageWindowDays: BASIC_RECENT_USAGE_WINDOW_DAYS,
  recentUsageRole: PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
  recommendedTargetRole: PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE,
  normativeDefaultTargetMinutes: BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES,
  maxRecommendedTargetMinutes: BASIC_TARGET_MAX_RECOMMENDED_MINUTES,
  normativeDefaultSource: BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE,
  lifecyclePhase: 'stabilize',
  effectiveTargetSource: 'declared_target',
});

export function buildBasicTargetRecommendation({
  recentUsageTrajectory,
  todayMinutes = 0,
} = {}) {
  const trajectory = requireBasicRecentUsageTrajectory(recentUsageTrajectory);
  const relation = deriveBasicTargetRecommendationRelation({
    recentUsageAverageDailyMs: trajectory.averageDailyMs,
    currentPartialDayMinutes: todayMinutes,
  });

  return requireBasicTargetRecommendationForTrajectory({
    version: BASIC_TARGET_RECOMMENDATION_VERSION,
    role: PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE,
    referenceMode: relation.referenceMode,
    source: relation.source,
    inputRole: trajectory.role,
    inputVersion: trajectory.version,
    recentUsageAverageDailyMs: relation.recentUsageAverageDailyMs,
    currentPartialDayMinutes: relation.currentPartialDayMinutes,
    recommendedTargetMinutes: relation.recommendedTargetMinutes,
    uncappedRecommendedTargetMinutes: relation.uncappedRecommendedTargetMinutes,
    maxRecommendedTargetMinutes: BASIC_STRATEGY_POLICY_DEFAULTS.maxRecommendedTargetMinutes,
    capApplied: relation.capApplied,
    normativeDefaultTargetMinutes: BASIC_STRATEGY_POLICY_DEFAULTS.normativeDefaultTargetMinutes,
    normativeDefaultSource: BASIC_STRATEGY_POLICY_DEFAULTS.normativeDefaultSource,
    requiresUserReview: true,
    autoApply: false,
  }, trajectory);
}
