export const SITE_GOAL_INCREASE_CAP_MINUTES = 30;

function normalizeGoalMinutes(value) {
  const minutes = Math.floor(Number(value));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

export function resolveSiteGoalChange({
  currentMinutes = 0,
  requestedMinutes = 0,
  increaseCapMinutes = SITE_GOAL_INCREASE_CAP_MINUTES,
} = {}) {
  const currentGoalMinutes = normalizeGoalMinutes(currentMinutes);
  const requestedGoalMinutes = normalizeGoalMinutes(requestedMinutes);
  const capMinutes = Math.max(0, Math.floor(Number(increaseCapMinutes) || 0));

  if (requestedGoalMinutes <= 0 || currentGoalMinutes <= 0 || capMinutes <= 0) {
    return {
      currentMinutes: currentGoalMinutes,
      requestedMinutes: requestedGoalMinutes,
      appliedMinutes: requestedGoalMinutes,
      capped: false,
      capMinutes,
    };
  }

  const maxIncreaseMinutes = currentGoalMinutes + capMinutes;
  const appliedMinutes = Math.min(requestedGoalMinutes, maxIncreaseMinutes);

  return {
    currentMinutes: currentGoalMinutes,
    requestedMinutes: requestedGoalMinutes,
    appliedMinutes,
    capped: appliedMinutes !== requestedGoalMinutes,
    capMinutes,
  };
}
