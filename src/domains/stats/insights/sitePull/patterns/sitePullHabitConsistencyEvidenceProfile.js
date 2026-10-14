import {
  SITE_PULL_MINUTE_MS,
  average,
  clamp,
  clamp01,
  durationNorm,
  maxRollingSum,
  smooth01,
  standardDeviation,
  toNumber,
} from '../sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
} from '../personalBaselineMetrics.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import {
  countTrailingObservedActiveDays,
  selectObservedWeeklyEntries,
} from '../../contracts/weeklyObservationContract.js';

export const SITE_PULL_HABIT_CONSISTENCY_EVIDENCE_PROFILE_VERSION = 'site-pull-habit-consistency-evidence-profile-v2';

export const SITE_PULL_HABIT_CONSISTENCY_STATUSES = Object.freeze({
  INSUFFICIENT_HABIT_EVIDENCE: 'insufficient_habit_evidence',
  DAILY_TOUCHPOINT: 'daily_touchpoint',
  CONSISTENT_DAILY_HABIT: 'consistent_daily_habit',
});

const MIN_VISIBLE_HABIT_SCORE = 0.62;
const MIN_VISIBLE_ACTIVE_DAYS = 4;
const PERSONAL_BASELINE_CONFIDENCE = 0.35;

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function round3(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(Math.max(0, numeric).toFixed(3)) : 0;
}

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function resolvePersonalBaselineActivityShape(personalBaseline = null) {
  const activeMsMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
  );
  const observedDays = toCount(activeMsMetric?.sample?.observedCount);
  const activeDays = toCount(activeMsMetric?.sample?.positiveCount);
  return {
    activeDays,
    activeDayRate: observedDays > 0 ? activeDays / observedDays : 0,
    confidence: clamp01(activeMsMetric?.confidence),
  };
}

function countActiveDays(entries = []) {
  return entries.filter((entry) => entry.activeMs > 0).length;
}

function computeVolumeConsistencyScore(values = []) {
  const activeValues = values.filter((value) => toNumber(value) > 0);
  if (activeValues.length <= 1) return activeValues.length === 1 ? 0.35 : 0;
  const mean = average(activeValues);
  const std = standardDeviation(activeValues);
  const cv = mean > 0 ? std / mean : 999;
  return clamp01(1 - clamp01(cv / 1.25));
}

function computeVisitRegularityScore(entries = []) {
  const visitValues = entries.map((entry) => toCount(entry.visits));
  const activeVisitDays = visitValues.filter((value) => value > 0).length;
  if (activeVisitDays <= 0) return 0;
  const visitDayRate = entries.length > 0 ? activeVisitDays / entries.length : 0;
  const activeVisitValues = visitValues.filter((value) => value > 0);
  const mean = average(activeVisitValues);
  const std = standardDeviation(activeVisitValues);
  const cv = mean > 0 ? std / mean : 999;
  const consistency = activeVisitValues.length > 1 ? clamp01(1 - clamp01(cv / 1.4)) : 0.35;
  return clamp01((visitDayRate * 0.62) + (consistency * 0.38));
}

function resolveStatus({ activeDays, habitConsistencyScore, streakDays, weeklyDays }) {
  if (weeklyDays < 5 || activeDays < MIN_VISIBLE_ACTIVE_DAYS || habitConsistencyScore < 0.45) {
    return SITE_PULL_HABIT_CONSISTENCY_STATUSES.INSUFFICIENT_HABIT_EVIDENCE;
  }
  return activeDays >= 5 || streakDays >= 4
    ? SITE_PULL_HABIT_CONSISTENCY_STATUSES.CONSISTENT_DAILY_HABIT
    : SITE_PULL_HABIT_CONSISTENCY_STATUSES.DAILY_TOUCHPOINT;
}

function buildCaveats({
  activeDayAverageMs,
  baselineConfidence,
  weeklyDays,
}) {
  const caveats = [];
  if (weeklyDays < 7) caveats.push('partial_week_window');
  if (activeDayAverageMs > 0 && activeDayAverageMs < 5 * SITE_PULL_MINUTE_MS) {
    caveats.push('low_volume_habit');
  }
  caveats.push('frequency_not_intent', 'hourly_aggregate_not_daily_recurrence');
  if (clamp01(baselineConfidence) < PERSONAL_BASELINE_CONFIDENCE) {
    caveats.push('personal_baseline_not_authoritative');
  }
  return caveats;
}

export function buildSitePullHabitConsistencyEvidenceProfile({
  featureVector = {},
  subscores = {},
  facts = null,
  personalBaseline = null,
} = {}) {
  const weeklyCalendarEntries = Array.isArray(featureVector.weeklySeries)
    ? featureVector.weeklySeries.slice(-7)
    : featureVector.weeklySeries;
  const weeklyEntries = selectObservedWeeklyEntries(weeklyCalendarEntries, {
    source: 'sitePullHabitConsistency.weeklySeries',
  })
    .map((entry) => ({
      activeMs: toNumber(entry?.activeMs),
      visits: toCount(entry?.visits),
    }))
    .slice(-7);
  const weeklyDays = weeklyEntries.length;
  const activeDays = countActiveDays(weeklyEntries);
  const streakDays = countTrailingObservedActiveDays(weeklyCalendarEntries, {
    source: 'sitePullHabitConsistency.weeklySeries',
  });
  const weeklyTotalMs = weeklyEntries.reduce((total, entry) => total + entry.activeMs, 0);
  const weeklyAverageMs = weeklyDays > 0 ? weeklyTotalMs / weeklyDays : 0;
  const activeDayAverageMs = activeDays > 0 ? weeklyTotalMs / activeDays : 0;
  const activeDayRate = weeklyDays > 0 ? activeDays / weeklyDays : 0;
  const streakRate = weeklyDays > 0 ? streakDays / weeklyDays : 0;
  const activeValues = weeklyEntries.map((entry) => entry.activeMs);
  const volumeConsistencyScore = computeVolumeConsistencyScore(activeValues);
  const visitRegularityScore = computeVisitRegularityScore(weeklyEntries);
  const habitPeakShare = weeklyTotalMs > 0
    ? maxRollingSum(featureVector.habitHourly, 3) / weeklyTotalMs
    : 0;
  const habitPeakScore = smooth01(habitPeakShare, 0.25, 0.65);
  const baselineActivityShape = resolvePersonalBaselineActivityShape(personalBaseline);
  const usagePresenceScore = clamp01(
    (durationNorm(weeklyTotalMs, 10, 120) * 0.54)
    + (durationNorm(activeDayAverageMs, 2, 20) * 0.46),
  );
  const structuralConsistencyScore = clamp01(
    (activeDayRate * 0.43)
    + (streakRate * 0.25)
    + (volumeConsistencyScore * 0.2)
    + (visitRegularityScore * 0.12),
  );
  const habitRegularityScore = clamp01(subscores.habitRegularity);
  const baselineConsistencyScore = baselineActivityShape.confidence >= PERSONAL_BASELINE_CONFIDENCE
    ? clamp01(
      (clamp01(baselineActivityShape.activeDayRate) * 0.72)
      + (smooth01(baselineActivityShape.activeDays, 4, 20) * 0.28),
    )
    : 0;
  const habitConsistencyScore = clamp01(Math.max(
    habitRegularityScore,
    (structuralConsistencyScore * 0.78) + (usagePresenceScore * 0.22),
    baselineConsistencyScore * 0.82,
  ));
  const entryVisitSummary = resolveSitePullEntryVisitSummary({
    facts,
  });
  const status = resolveStatus({
    activeDays,
    habitConsistencyScore,
    weeklyDays,
    streakDays,
  });
  const canEmitVisible = Boolean(
    weeklyDays >= 5 && habitConsistencyScore >= MIN_VISIBLE_HABIT_SCORE
    && activeDays >= MIN_VISIBLE_ACTIVE_DAYS
    && status !== SITE_PULL_HABIT_CONSISTENCY_STATUSES.INSUFFICIENT_HABIT_EVIDENCE
  );
  const confidence = clamp01(
    0.46
    + (weeklyDays >= 5 ? 0.12 : 0)
    + (activeDays >= MIN_VISIBLE_ACTIVE_DAYS ? 0.1 : 0)
    + (streakDays >= 3 ? 0.06 : 0)
    + (volumeConsistencyScore * 0.05)
    + (habitConsistencyScore * 0.08)
    + (baselineConsistencyScore > 0 ? 0.05 : 0),
  );

  return {
    version: SITE_PULL_HABIT_CONSISTENCY_EVIDENCE_PROFILE_VERSION,
    status,
    canEmitVisible,
    score: clamp(habitConsistencyScore * 100, 0, 100),
    confidence,
    evidence: {
      weeklyDays,
      activeDays,
      streakDays,
      activeDayRate: round3(activeDayRate),
      streakRate: round3(streakRate),
      weeklyTotalMs,
      weeklyAverageMs,
      activeDayAverageMs,
      weeklyVisits: entryVisitSummary.weeklyVisits,
      todayVisits: entryVisitSummary.todayVisits,
      volumeConsistencyScore: round4(volumeConsistencyScore),
      visitRegularityScore: round4(visitRegularityScore),
      habitPeakShare: round3(habitPeakShare),
      habitPeakScore: round4(habitPeakScore),
      usagePresenceScore: round4(usagePresenceScore),
      structuralConsistencyScore: round4(structuralConsistencyScore),
      habitRegularityScore: round4(habitRegularityScore),
      baselineConsistencyScore: round4(baselineConsistencyScore),
      habitConsistencyScore: round4(habitConsistencyScore),
      habitStatus: status,
      intentAssessment: 'not_observed',
      timeOfDayRecurrence: 'not_available_from_hourly_aggregate',
      evidenceFamilyIds: ['daily_usage'],
      caveats: buildCaveats({
        activeDayAverageMs,
        baselineConfidence: baselineActivityShape.confidence,
        weeklyDays,
      }),
    },
  };
}
