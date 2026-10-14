import { deriveWeeklyObservationSummary } from './weeklyObservationContract.js';

export function requireSiteGoalContext(context) {
  if (!context || !['activity-day', 'calendar-day'].includes(context.basis)
    || typeof context.observed !== 'boolean'
    || !['usageMs', 'observedDays', 'activeDays', 'overLimitDays'].every((key) => (
      typeof context[key] === 'number' && Number.isFinite(context[key]) && context[key] >= 0
    )) || !['observedDays', 'activeDays', 'overLimitDays'].every((key) => Number.isInteger(context[key]))
    || context.activeDays > context.observedDays || context.overLimitDays > context.activeDays) {
    throw new Error('SITE_GOAL_CONTEXT_INVALID');
  }
  return { basis: context.basis, observed: context.observed, usageMs: context.usageMs,
    observedDays: context.observedDays, activeDays: context.activeDays, overLimitDays: context.overLimitDays };
}

export function deriveSiteGoalMetrics(goalMinutes, context) {
  requireSiteGoalContext(context);
  if (!Number.isFinite(goalMinutes) || goalMinutes < 0) throw new Error('SITE_GOAL_MINUTES_INVALID');
  const goalMs = goalMinutes * 60_000;
  return {
    hasGoal: goalMs > 0, goalMinutes, goalMs,
    usageRatio: goalMs > 0 ? context.usageMs / goalMs : 0,
    remainingMs: goalMs > 0 ? Math.max(goalMs - context.usageMs, 0) : 0,
    overGoalMs: goalMs > 0 ? Math.max(context.usageMs - goalMs, 0) : 0,
  };
}

export function requireSiteGoalMetrics(goal) {
  const metrics = deriveSiteGoalMetrics(goal.goalMinutes, goal.context);
  for (const [key, value] of Object.entries(metrics)) {
    if (goal[key] !== value) throw new Error(`SITE_GOAL_METRICS_RELATION_INVALID:${key}`);
  }
  return metrics;
}

// A calendar-only source has no separate policy window; derive its context from
// that same declared source. A supplied activity context is never repaired.
export function resolveSiteGoalContext(featureVector) {
  if (Object.hasOwn(featureVector, 'goalContext')) return requireSiteGoalContext(featureVector.goalContext);
  const weekly = deriveWeeklyObservationSummary(featureVector.weeklySeries, { source: 'siteGoalContext.weeklySeries' });
  return requireSiteGoalContext({ basis: 'calendar-day', observed: featureVector.todayObserved,
    usageMs: featureVector.todayTotalMs, observedDays: weekly.observedDays,
    activeDays: weekly.activeDays, overLimitDays: weekly.overLimitDays });
}
