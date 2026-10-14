export function chooseRecommendedNudge(featureVector, subscores, riskBand) {
  if (!featureVector?.hasAnyActivity) {
    return { type: 'none', actionId: 'observe' };
  }
  if (!featureVector.hasGoal && featureVector.isProtectedTarget && featureVector.activeDays >= 1) {
    return { type: 'set_goal', actionId: 'set_daily_goal' };
  }
  if (subscores.interventionResistance >= 0.55) {
    return { type: 'friction_step_up', actionId: 'increase_friction' };
  }
  if (subscores.planFriction >= 0.7) {
    return { type: 'goal_reflection', actionId: 'enable_goal_pause' };
  }
  if (subscores.checkingLoop >= 0.65) {
    return { type: 'cooldown', actionId: 'enable_cooldown' };
  }
  if (subscores.immersionDepth >= 0.7) {
    return { type: 'session_checkin', actionId: 'enable_session_checkin' };
  }
  if (subscores.circadianRisk >= 0.6) {
    return { type: 'night_guard', actionId: 'enable_night_guard' };
  }
  if (subscores.trendAcceleration >= 0.6) {
    return { type: 'weekly_review', actionId: 'review_weekly_goal' };
  }
  if (riskBand === 'low') {
    return { type: 'maintain', actionId: 'hold_course' };
  }
  return { type: 'gentle_pause', actionId: 'confirm_intent' };
}
