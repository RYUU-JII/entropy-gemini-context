import { GLOBAL_GOAL_MAX_MINUTES } from '@/domains/settings/config/siteRules.js';
import { requireSitesGlobalExposureAverage } from '@/domains/stats/contracts/sitesGlobalExposureAverageContract.js';

export const SITES_GLOBAL_CAP_VARIANTS = Object.freeze({
  STANDARD: 'standard',
  ZEN_STONE_CHANNEL: 'zen-stone-channel',
});

export const SITES_GLOBAL_CAP_SAVE_SETTLE_MS = 420;

export function clampGlobalGoalMinutes(value) {
  return Math.min(
    GLOBAL_GOAL_MAX_MINUTES,
    Math.max(0, Math.floor(Number(value) || 0)),
  );
}

export function requireGlobalGoalMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error('SITES_GLOBAL_GOAL_REQUIRED');
  }
  return clampGlobalGoalMinutes(minutes);
}

function requireExposureMs(value) {
  const exposureMs = Number(value);
  if (!Number.isFinite(exposureMs) || exposureMs < 0) {
    throw new Error('SITES_GLOBAL_EXPOSURE_REQUIRED');
  }
  return exposureMs;
}

function ratioPercent(value, maxValue) {
  if (maxValue <= 0) return 0;
  return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

export function buildSitesGlobalCapViewModel({
  totalExposure,
  globalExposureAverage,
  goalMinutes,
}) {
  const usedMs = requireExposureMs(totalExposure);
  const resolvedGoalMinutes = requireGlobalGoalMinutes(goalMinutes);
  const average = requireSitesGlobalExposureAverage(globalExposureAverage);
  const hasGoal = resolvedGoalMinutes > 0;
  const goalMs = resolvedGoalMinutes * 60_000;
  const averageMs = average.averageMs === null ? null : Number(average.averageMs);
  return {
    usedMs,
    goalMinutes: resolvedGoalMinutes,
    goalMs,
    hasGoal,
    averagePercent: averageMs === null ? null : ratioPercent(averageMs, GLOBAL_GOAL_MAX_MINUTES * 60_000),
    isAverageOverGoal: hasGoal && averageMs !== null && averageMs > goalMs,
    average: { ...average, averageMs },
  };
}

export function requireSitesGlobalCapVariant(variant) {
  if (!Object.values(SITES_GLOBAL_CAP_VARIANTS).includes(variant)) {
    throw new Error(`[SitesHud] Unsupported global cap variant '${variant}'.`);
  }
  return variant;
}
