const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeDomain = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

export function findRollingPressureDomain(rollingPressure = null, domain = '') {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return null;
  return (Array.isArray(rollingPressure?.domains) ? rollingPressure.domains : [])
    .find((entry) => entry?.domain === normalizedDomain) || null;
}

export function resolveRollingPressureRecentTrajectory(rollingPressure = null, domain = '') {
  return findRollingPressureDomain(rollingPressure, domain)?.recentTrajectory || null;
}

export function projectRollingPressureRecentTrajectoryScalars(recentTrajectory = null) {
  const recentAverageMs = recentTrajectory?.reference?.weightedDailyAverageMs;
  const deltaMs = recentTrajectory?.comparison?.deltaMs;
  const hasReferenceState = recentTrajectory?.reference?.state === 'zero'
    || recentTrajectory?.reference?.state === 'positive';
  const hasReference = recentTrajectory?.current?.observed === true
    && hasReferenceState
    && Number.isFinite(recentAverageMs)
    && recentAverageMs >= 0
    && Number.isFinite(deltaMs);
  return {
    hasReference,
    recentAverageMs: hasReference ? recentAverageMs : null,
    deltaMs: hasReference ? deltaMs : null,
  };
}

export function resolveRollingPressureActiveDayCount(rollingPressure = null) {
  const activePeriodKeys = new Set();
  for (const domainEntry of Array.isArray(rollingPressure?.domains) ? rollingPressure.domains : []) {
    for (const [index, periodEntry] of (Array.isArray(domainEntry?.periodSeries) ? domainEntry.periodSeries : []).entries()) {
      if (Math.max(0, toNumber(periodEntry?.activeMs)) <= 0) continue;
      const activityDate = typeof periodEntry?.activityDateStr === 'string'
        ? periodEntry.activityDateStr.trim()
        : '';
      const ageDays = Number(periodEntry?.ageDays);
      activePeriodKeys.add(activityDate || (Number.isFinite(ageDays) ? `age:${ageDays}` : `index:${index}`));
    }
  }
  return activePeriodKeys.size;
}

export default resolveRollingPressureActiveDayCount;
