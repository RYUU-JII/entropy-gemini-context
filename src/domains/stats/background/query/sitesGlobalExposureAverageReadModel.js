import { buildSitesCompletedActivityDays } from './sitesCompletedActivityDays.js';
import { buildSitesProtectedExposureDetails } from './statsSitesRegistryReadModel.js';

// Observation is evidence inside the activity window, not the existence of a
// calendar-day container (which can contain only the current day's records).
export function buildSitesGlobalExposureAverage({ stats, policyContext, blockedTargets, allowedTargets, trackingExcludedUrls, cycleState, now,
  completedDays = buildSitesCompletedActivityDays({ stats, policyContext, cycleState, now }),
}) {
  const { observed, window } = completedDays;
  return {
    averageMs: observed.length === 0 ? null : observed.reduce((total, { period }) =>
      total + buildSitesProtectedExposureDetails({ statsRange: stats, range: period.range, blockedTargets, allowedTargets, trackingExcludedUrls }).totalExposure, 0) / observed.length,
    observedDayCount: observed.length,
    windowDayCount: window.windowDayCount,
    windowStartDateStr: window.windowStartDateStr,
    windowEndDateStr: window.windowEndDateStr,
    resetHour: window.resetHour,
  };
}
