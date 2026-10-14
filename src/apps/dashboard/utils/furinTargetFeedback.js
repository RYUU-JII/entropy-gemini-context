import {
  normalizeGlobalGoal,
  normalizeSiteGoals,
} from '../../../domains/settings/config/siteRules.js';

export const FURIN_TARGET_FEEDBACK_MODES = Object.freeze({
  GLOBAL_AND_SITE: 'global_and_site',
  GLOBAL_ONLY: 'global_only',
  SITE_ONLY: 'site_only',
  UNCONFIGURED: 'unconfigured',
});

const FURIN_TARGET_FEEDBACK_MODE_VALUES = new Set(
  Object.values(FURIN_TARGET_FEEDBACK_MODES),
);

function resolveFurinTargetFeedbackMode(globalTargetMinutes, siteTargetCount) {
  if (globalTargetMinutes > 0) {
    return siteTargetCount > 0
      ? FURIN_TARGET_FEEDBACK_MODES.GLOBAL_AND_SITE
      : FURIN_TARGET_FEEDBACK_MODES.GLOBAL_ONLY;
  }
  return siteTargetCount > 0
    ? FURIN_TARGET_FEEDBACK_MODES.SITE_ONLY
    : FURIN_TARGET_FEEDBACK_MODES.UNCONFIGURED;
}

export function assertFurinTargetFeedback(targetFeedback) {
  const mode = targetFeedback?.mode;
  if (!FURIN_TARGET_FEEDBACK_MODE_VALUES.has(mode)) {
    throw new Error(`FURIN_TARGET_FEEDBACK_MODE_INVALID:${String(mode)}`);
  }
  if (!Number.isInteger(targetFeedback.globalTargetMinutes) || targetFeedback.globalTargetMinutes < 0) {
    throw new Error('FURIN_TARGET_FEEDBACK_GLOBAL_TARGET_INVALID');
  }
  if (!Number.isInteger(targetFeedback.siteTargetCount) || targetFeedback.siteTargetCount < 0) {
    throw new Error('FURIN_TARGET_FEEDBACK_SITE_TARGET_COUNT_INVALID');
  }
  const expectedMode = resolveFurinTargetFeedbackMode(
    targetFeedback.globalTargetMinutes,
    targetFeedback.siteTargetCount,
  );
  if (mode !== expectedMode) {
    throw new Error(`FURIN_TARGET_FEEDBACK_MODE_INCONSISTENT:${mode}:${expectedMode}`);
  }
  return targetFeedback;
}

export function buildFurinTargetFeedback({
  globalGoal,
  siteGoals,
}) {
  if (globalGoal === undefined) {
    throw new Error('FURIN_TARGET_FEEDBACK_GLOBAL_GOAL_REQUIRED');
  }
  if (!siteGoals || typeof siteGoals !== 'object' || Array.isArray(siteGoals)) {
    throw new Error('FURIN_TARGET_FEEDBACK_SITE_GOALS_REQUIRED');
  }

  const globalTargetMinutes = normalizeGlobalGoal(globalGoal);
  const normalizedSiteGoals = normalizeSiteGoals(siteGoals);
  const siteTargetCount = Object.keys(normalizedSiteGoals).length;
  const mode = resolveFurinTargetFeedbackMode(globalTargetMinutes, siteTargetCount);

  return Object.freeze({
    mode,
    globalTargetMinutes,
    siteTargetCount,
  });
}
