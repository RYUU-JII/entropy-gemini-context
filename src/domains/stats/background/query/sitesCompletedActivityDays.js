import {
  buildActivityDayPeriodSeries,
  projectActivityDayPeriodSeries,
  resolveEffectiveResetHour,
  SITES_OVERVIEW_DAYS,
} from './statsAnalysisQueryShared.js';

export function hasSitesActivityObservation(entry) {
  return entry.collectionObservation.observed || entry.totalMs > 0 || entry.visits > 0;
}

export function buildSitesCompletedActivityDays({ stats, policyContext, cycleState, now, filter = {} }) {
  const resetHour = resolveEffectiveResetHour(cycleState);
  const periods = buildActivityDayPeriodSeries({ now, resetHour, count: SITES_OVERVIEW_DAYS + 1 })
    .filter((period) => !period.current);
  const entries = projectActivityDayPeriodSeries({ stats, policyContext, periods, filter });
  const observed = entries.filter(({ projection }) => projection.domainTotals.some(hasSitesActivityObservation));
  return {
    observed,
    window: {
      basis: 'completed-activity-days-recorded',
      observedDayCount: observed.length,
      windowDayCount: SITES_OVERVIEW_DAYS,
      windowStartDateStr: periods[0].activityDateStr,
      windowEndDateStr: periods[periods.length - 1].activityDateStr,
      resetHour,
    },
  };
}
