import { deriveWeeklyObservationSummary } from '../contracts/weeklyObservationContract.js';

// This state describes recorded evidence, not whole-day capture completeness.
export function resolveSitePullObservationState(featureVector) {
  if (typeof featureVector?.todayObserved !== 'boolean'
    || typeof featureVector?.hasAnyActivity !== 'boolean') {
    throw new Error('SITE_PULL_OBSERVATION_SOURCE_INVALID');
  }
  const weekly = deriveWeeklyObservationSummary(featureVector.weeklySeries, {
    source: 'sitePullObservationState.weeklySeries',
  });
  const hasObservations = featureVector.todayObserved || weekly.observedDays > 0;
  return {
    status: !hasObservations ? 'missing'
      : featureVector.hasAnyActivity ? 'activity' : 'observed_zero',
    todayObserved: featureVector.todayObserved,
    observedWeeklyDays: weekly.observedDays,
    windowDayCount: featureVector.weeklySeries.length,
  };
}
