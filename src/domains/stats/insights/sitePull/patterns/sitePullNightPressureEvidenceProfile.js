import {
  SITE_PULL_CORE_LATE_HOURS, SITE_PULL_MINUTE_MS, SITE_PULL_NIGHT_HOURS,
  clamp01, countActiveHours, durationNorm, smooth01, sumHours, toNumber,
} from '../sitePullMath.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import { selectObservedWeeklyEntries } from '../../contracts/weeklyObservationContract.js';

export const SITE_PULL_NIGHT_PRESSURE_EVIDENCE_PROFILE_VERSION = 'site-pull-night-pressure-evidence-profile-v2';
export const SITE_PULL_NIGHT_PRESSURE_STATUSES = Object.freeze({
  INSUFFICIENT_HOURLY_EVIDENCE: 'insufficient_night_pressure_evidence',
  NIGHT_USAGE_OBSERVED: 'night_usage_observed',
  LATE_NIGHT_CLUSTER: 'late_night_cluster',
  HEAVY_LATE_HOUR_USE: 'heavy_late_hour_use',
});
const MIN = SITE_PULL_MINUTE_MS;
const round4 = (value) => Number(clamp01(value).toFixed(4));

function hourlyShape(values) {
  if (values === undefined) return null;
  if (!Array.isArray(values) || values.length !== 24
    || values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
    throw new Error('SITE_PULL_NIGHT_HOURLY_FACTS_INVALID');
  }
  return values;
}

function cycleProxy(facts) {
  const value = facts.temporalEvidence?.metrics?.cyclePositionProxy;
  if (value === undefined) return { mode: 'unavailable' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SITE_PULL_NIGHT_CYCLE_FACTS_INVALID');
  // Preserve null; Number(null) would incorrectly invent midnight.
  return { ...value };
}

export function buildSitePullNightPressureEvidenceProfile({ featureVector = {}, subscores = {}, facts = {} } = {}) {
  const todayHourly = hourlyShape(featureVector.todayHourly);
  const habitHourly = hourlyShape(featureVector.habitHourly);
  const hasHourlyShape = todayHourly !== null;
  const entry = resolveSitePullEntryVisitSummary({ facts });
  const todayMs = toNumber(featureVector.todayTotalMs);
  const weeklyTotalMs = toNumber(featureVector.weeklyTotalMs);
  const weeklyDays = Array.isArray(featureVector.weeklySeries)
    ? selectObservedWeeklyEntries(featureVector.weeklySeries, { source: 'sitePullNightPressure.weeklySeries' }).length : 0;
  const nightMsToday = todayHourly ? sumHours(todayHourly, SITE_PULL_NIGHT_HOURS) : 0;
  const coreLateMsToday = todayHourly ? sumHours(todayHourly, SITE_PULL_CORE_LATE_HOURS) : 0;
  const nightMsHabit = habitHourly ? sumHours(habitHourly, SITE_PULL_NIGHT_HOURS) : 0;
  const coreLateMsHabit = habitHourly ? sumHours(habitHourly, SITE_PULL_CORE_LATE_HOURS) : 0;
  const nightAverageMs = habitHourly && weeklyDays > 0 ? nightMsHabit / weeklyDays : null;
  const todayVsHabitNightRatio = nightAverageMs >= 5 * MIN ? nightMsToday / nightAverageMs : null;
  const nightShareToday = todayMs > 0 ? clamp01(nightMsToday / todayMs) : 0;
  const nightShareHabit = weeklyTotalMs > 0 ? clamp01(nightMsHabit / weeklyTotalMs) : 0;
  const nightVisitCount = sumHours(entry.todayHourlyVisits, SITE_PULL_NIGHT_HOURS);
  const nightVisitHourCount = SITE_PULL_NIGHT_HOURS.filter((h) => entry.todayHourlyVisits[h] > 0).length;
  const nightActiveHourCount = todayHourly ? SITE_PULL_NIGHT_HOURS.filter((h) => todayHourly[h] >= MIN).length : 0;
  const coreLateActiveHourCount = todayHourly ? SITE_PULL_CORE_LATE_HOURS.filter((h) => todayHourly[h] >= MIN).length : 0;
  const nightDurationScore = durationNorm(nightMsToday, 10, 60);
  const coreLateScore = durationNorm(coreLateMsToday, 5, 45);
  const nightShareScore = smooth01(nightShareToday, 0.2, 0.65);
  const nightVisitSpreadScore = clamp01(smooth01(nightVisitHourCount, 1, 4) * 0.58 + smooth01(nightVisitCount, 1, 5) * 0.42);
  const durationPressureScore = clamp01(nightDurationScore * 0.44 + coreLateScore * 0.3
    + nightShareScore * 0.18 + nightVisitSpreadScore * 0.08);
  // Daytime volume/session length cannot establish prolonged use at night.
  const durationContextScore = durationNorm(nightMsToday, 15, 90);
  const nightPressureScore = clamp01(durationPressureScore * 0.75 + durationContextScore * 0.25);
  const circadianRiskScore = clamp01(subscores.circadianRisk);
  const status = !hasHourlyShape || nightMsToday <= 0
    ? SITE_PULL_NIGHT_PRESSURE_STATUSES.INSUFFICIENT_HOURLY_EVIDENCE
    : nightMsToday >= 30 * MIN && durationPressureScore >= 0.65
      ? SITE_PULL_NIGHT_PRESSURE_STATUSES.HEAVY_LATE_HOUR_USE
      : nightMsToday >= 15 * MIN ? SITE_PULL_NIGHT_PRESSURE_STATUSES.LATE_NIGHT_CLUSTER
        : SITE_PULL_NIGHT_PRESSURE_STATUSES.NIGHT_USAGE_OBSERVED;
  const proxy = cycleProxy(facts);
  return {
    version: SITE_PULL_NIGHT_PRESSURE_EVIDENCE_PROFILE_VERSION, status,
    canEmitAtomic: hasHourlyShape && nightMsToday >= 5 * MIN && circadianRiskScore >= 0.55,
    canEmitBinge: hasHourlyShape && nightMsToday >= 15 * MIN && nightPressureScore >= 0.62
      && (durationPressureScore >= 0.5 || durationContextScore >= 0.45),
    score: nightPressureScore * 100,
    confidence: hasHourlyShape ? (entry.hasVisitFacts ? 0.72 : 0.66) : 0,
    evidence: {
      nightWindowHours: [...SITE_PULL_NIGHT_HOURS], coreLateHours: [...SITE_PULL_CORE_LATE_HOURS],
      nightMsToday, coreLateMsToday, nightShareToday, nightActiveHourCount, coreLateActiveHourCount,
      nightVisitCount, nightVisitHourCount, nightMsHabit, coreLateMsHabit, nightShareHabit,
      nightAverageMs, weeklyDays, todayVsHabitNightRatio,
      nightReferenceBasis: 'current-inclusive-observed-calendar-days',
      recurringNightDays: null, sleepWindowAssessment: 'not_observed',
      nightDurationScore: round4(nightDurationScore), coreLateScore: round4(coreLateScore),
      nightShareScore: round4(nightShareScore), nightVisitSpreadScore: round4(nightVisitSpreadScore),
      durationPressureScore: round4(durationPressureScore), durationContextScore: round4(durationContextScore),
      durationContextBasis: 'night-window-only',
      circadianRiskScore: round4(circadianRiskScore), nightPressureScore: round4(nightPressureScore),
      nightPressureStatus: status, todayMs,
      activeHoursToday: todayHourly ? countActiveHours(todayHourly) : 0,
      visitHoursToday: entry.visitHoursToday, cyclePositionProxy: proxy,
      evidenceFamilyIds: ['night_window_usage'],
      caveats: ['fixed_clock_window_not_personal_sleep', 'weekly_hourly_aggregate_not_recurrence',
        ...(!hasHourlyShape ? ['hourly_facts_unavailable'] : []),
        ...(!entry.hasVisitFacts ? ['night_visit_facts_unavailable'] : []),
        ...(nightAverageMs === null || nightAverageMs < 5 * MIN ? ['weekly_night_reference_unavailable'] : []),
        ...(proxy.mode !== 'unavailable' ? ['cycle_position_hourly_proxy'] : [])],
    },
  };
}
