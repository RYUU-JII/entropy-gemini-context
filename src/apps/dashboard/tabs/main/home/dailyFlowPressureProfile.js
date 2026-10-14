import {
  findRollingPressureDomain,
  resolveRollingPressureActiveDayCount,
} from './rollingPressureEvidence.js';

const HOUR_COUNT = 24;

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeHour = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const hour = Math.floor(numeric);
  return hour >= 0 && hour < HOUR_COUNT ? hour : null;
};

// The rolling model stores weighted SUMS over the window (weights 1..0.4 sum
// to ~4.9 for 7 days). Presented as-is they read as absurd per-hour durations
// ("typical 2h 30m in one hour slot"), so divide by the sum of the weights
// actually in play to get a weighted per-day average — "a typical day".
function resolveTypicalDayDivisor(rollingPressure = null) {
  const periodWeightSum = (Array.isArray(rollingPressure?.periodWeights) ? rollingPressure.periodWeights : [])
    .reduce((sum, entry) => sum + Math.max(0, toNumber(entry?.weight)), 0);
  if (periodWeightSum > 0) return periodWeightSum;
  const configuredWeightSum = (Array.isArray(rollingPressure?.weightsByAge) ? rollingPressure.weightsByAge : [])
    .reduce((sum, weight) => sum + Math.max(0, toNumber(weight)), 0);
  return configuredWeightSum > 0 ? configuredWeightSum : 1;
}

export function buildDailyFlowPressureProfile({
  dailyFlow,
  rollingPressure = null,
  lensDomain = '',
} = {}) {
  const typicalDayDivisor = resolveTypicalDayDivisor(rollingPressure);
  const rollingHours = new Map(
    (Array.isArray(rollingPressure?.hourlyProfile?.hours) ? rollingPressure.hourlyProfile.hours : [])
      .map((entry) => [normalizeHour(entry?.hour), entry])
      .filter(([hour]) => hour !== null),
  );
  const selectedDomain = typeof lensDomain === 'string' ? lensDomain.trim().toLowerCase() : '';
  const selectedDomainEntry = findRollingPressureDomain(rollingPressure, selectedDomain);
  const selectedHours = new Map(
    (Array.isArray(selectedDomainEntry?.hourlyProfile) ? selectedDomainEntry.hourlyProfile : [])
      .map((entry) => [normalizeHour(entry?.hour), entry])
      .filter(([hour]) => hour !== null),
  );
  const sourceSeries = Array.isArray(dailyFlow?.series) && dailyFlow.series.length > 0
    ? dailyFlow.series
    : Array.from({ length: HOUR_COUNT }, (_, hour) => ({ hour }));
  const displayHours = sourceSeries.map((entry, index) => (
    normalizeHour(entry?.hour) ?? ((normalizeHour(dailyFlow?.startHour) ?? 0) + index) % HOUR_COUNT
  ));
  const series = displayHours.map((hour, index) => {
    const rollingHour = rollingHours.get(hour) || null;
    const selectedHour = selectedHours.get(hour) || null;
    return {
      displayIndex: index,
      hour,
      totalPressureMs: Math.max(0, toNumber(rollingHour?.weightedTotalMs)) / typicalDayDivisor,
      protectedPressureMs: Math.max(0, toNumber(rollingHour?.weightedProtectedMs)) / typicalDayDivisor,
      targetPressureMs: Math.max(0, toNumber(selectedHour?.weightedMs)) / typicalDayDivisor,
    };
  });

  // Per-domain typical rhythm, aligned to the same display order, so the strip
  // can ghost-preview a hovered koi's day without re-querying the stats layer.
  const domainSeries = {};
  for (const entry of Array.isArray(rollingPressure?.domains) ? rollingPressure.domains : []) {
    const domain = typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : '';
    if (!domain || !Array.isArray(entry?.hourlyProfile)) continue;
    const byHour = new Map(
      entry.hourlyProfile
        .map((hourEntry) => [normalizeHour(hourEntry?.hour), hourEntry])
        .filter(([hour]) => hour !== null),
    );
    const values = displayHours.map((hour) => (
      Math.max(0, toNumber(byHour.get(hour)?.weightedMs)) / typicalDayDivisor
    ));
    if (values.some((value) => value > 0)) domainSeries[domain] = values;
  }

  const maxTotalPressureMs = Math.max(0, ...series.map((entry) => entry.totalPressureMs));
  const maxProtectedPressureMs = Math.max(0, ...series.map((entry) => entry.protectedPressureMs));
  const maxTargetPressureMs = Math.max(0, ...series.map((entry) => entry.targetPressureMs));
  const hasAnyPressure = maxTotalPressureMs > 0 || maxProtectedPressureMs > 0 || maxTargetPressureMs > 0;
  const temporalPeriodCount = Number(rollingPressure?.temporal?.periodCount);
  const periodCount = Number.isFinite(temporalPeriodCount)
    ? Math.max(0, Math.floor(temporalPeriodCount))
    : (Array.isArray(rollingPressure?.periodWeights) ? rollingPressure.periodWeights.length : 0);

  return {
    basis: rollingPressure?.basis || null,
    windowDays: Math.max(0, Math.floor(toNumber(rollingPressure?.windowDays))),
    temporal: rollingPressure?.temporal || null,
    domain: selectedDomain,
    maxTotalPressureMs,
    maxProtectedPressureMs,
    maxTargetPressureMs,
    hasAnyPressure,
    evidence: {
      activeDayCount: resolveRollingPressureActiveDayCount(rollingPressure),
      selectedActiveDayCount: selectedDomainEntry
        ? Math.max(0, Math.floor(toNumber(selectedDomainEntry.activeDays)))
        : 0,
      periodCount,
    },
    series,
    domainSeries,
  };
}
