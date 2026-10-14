import {
  clamp,
  clamp01,
  smooth01,
  toNumber,
} from '../sitePullMath.js';
import { selectObservedWeeklyEntries } from '../../contracts/weeklyObservationContract.js';

export const SITE_PULL_BACKGROUND_RESIDENCY_EVIDENCE_PROFILE_VERSION =
  'site-pull-background-residency-evidence-profile-v2';

export const SITE_PULL_BACKGROUND_RESIDENCY_STATUSES = Object.freeze({
  INSUFFICIENT_BACKGROUND_RESIDENCY_EVIDENCE: 'insufficient_background_residency_evidence',
  BACKGROUND_LINGER_OBSERVED: 'background_linger_observed',
  STALE_BACKGROUND_RESIDENCY: 'stale_background_residency',
  BACKGROUND_MEDIA_RESIDENCY: 'background_media_residency',
  RECURRING_BACKGROUND_RESIDENCY: 'recurring_background_residency',
  WEEKLY_BACKGROUND_OBSERVED: 'weekly_background_observed',
});

const MIN_VISIBLE_SCORE = 0.58;

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function duration(value) {
  return Math.max(0, toNumber(value));
}

function summarizeWindow({
  backgroundMediaMs = 0,
  backgroundLingerMs = 0,
  staleTabMs = 0,
} = {}) {
  const mediaMs = duration(backgroundMediaMs);
  const lingerMs = duration(backgroundLingerMs);
  const staleMs = duration(staleTabMs);
  return {
    backgroundMediaMs: mediaMs,
    backgroundLingerMs: lingerMs,
    staleTabMs: staleMs,
    backgroundPressureSignalMs: mediaMs + lingerMs + staleMs,
    backgroundResidencyMs: Math.max(mediaMs, lingerMs, staleMs),
  };
}

function scoreTodayResidency({ today }) {
  return Math.max(
    smooth01(today.backgroundLingerMs, 10 * 60_000, 45 * 60_000),
    smooth01(today.staleTabMs, 5 * 60_000, 25 * 60_000),
    smooth01(today.backgroundMediaMs, 10 * 60_000, 45 * 60_000),
  );
}

function scoreWeeklyResidency(weekly) {
  return Math.max(
    smooth01(weekly.backgroundLingerMs, 45 * 60_000, 180 * 60_000),
    smooth01(weekly.staleTabMs, 20 * 60_000, 90 * 60_000),
    smooth01(weekly.backgroundMediaMs, 30 * 60_000, 180 * 60_000),
  );
}

function resolveStatus({
  hasBackgroundResidencyFacts,
  today,
  weekly,
  todayScore,
  weeklyScore,
  recurringBackgroundDays,
}) {
  if (!hasBackgroundResidencyFacts) {
    return SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.INSUFFICIENT_BACKGROUND_RESIDENCY_EVIDENCE;
  }
  if (today.staleTabMs >= 8 * 60_000 && todayScore >= 0.52) {
    return SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.STALE_BACKGROUND_RESIDENCY;
  }
  if (today.backgroundMediaMs >= 20 * 60_000 && todayScore >= 0.52) {
    return SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.BACKGROUND_MEDIA_RESIDENCY;
  }
  if (weekly.backgroundResidencyMs >= 90 * 60_000 && weeklyScore >= 0.58) {
    return recurringBackgroundDays >= 3
      ? SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.RECURRING_BACKGROUND_RESIDENCY
      : SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.WEEKLY_BACKGROUND_OBSERVED;
  }
  if (today.backgroundResidencyMs >= 10 * 60_000 || weekly.backgroundResidencyMs >= 45 * 60_000) {
    return SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.BACKGROUND_LINGER_OBSERVED;
  }
  return SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.INSUFFICIENT_BACKGROUND_RESIDENCY_EVIDENCE;
}

function buildCaveats({
  today,
  weekly,
  activeMs,
  hasBehaviorFacts,
}) {
  const caveats = ['tab_residency_not_attention', 'channel_maximum_not_unique_elapsed_time'];
  if (!hasBehaviorFacts) caveats.push('behavior_facts_unavailable');
  if (activeMs <= 0 && today.backgroundResidencyMs > 0) caveats.push('background_without_active_use');
  if (today.backgroundPressureSignalMs > today.backgroundResidencyMs) {
    caveats.push('overlapping_background_pressure_channels');
  }
  if (today.backgroundResidencyMs <= 0 && weekly.backgroundResidencyMs > 0) {
    caveats.push('weekly_only_background_residency');
  }
  if (weekly.backgroundPressureSignalMs > weekly.backgroundResidencyMs) {
    caveats.push('weekly_overlapping_background_pressure_channels');
  }
  return caveats;
}

export function buildSitePullBackgroundResidencyEvidenceProfile({
  featureVector = {},
  facts = {},
} = {}) {
  const behavior = Object.hasOwn(facts, 'behavior') ? facts.behavior : {};
  if (!behavior || typeof behavior !== 'object' || Array.isArray(behavior)) {
    throw new Error('SITE_PULL_BACKGROUND_BEHAVIOR_FACTS_INVALID');
  }
  const today = summarizeWindow(behavior);
  const observedDays = Array.isArray(featureVector.weeklySeries)
    ? selectObservedWeeklyEntries(featureVector.weeklySeries, { source: 'sitePullBackgroundResidency.weeklySeries' }) : [];
  const recurringBackgroundDays = observedDays.filter((day) => (
    summarizeWindow(day.behavior).backgroundResidencyMs >= 5 * 60_000
  )).length;
  const weekly = summarizeWindow({
    backgroundMediaMs: behavior.weeklyBackgroundMediaMs,
    backgroundLingerMs: behavior.weeklyBackgroundLingerMs,
    staleTabMs: behavior.weeklyStaleTabMs,
  });
  const activeMs = duration(featureVector.todayTotalMs);
  const hasBehaviorFacts = Boolean(behavior.hasBehaviorFacts)
    || today.backgroundPressureSignalMs > 0
    || weekly.backgroundPressureSignalMs > 0;
  const hasBackgroundResidencyFacts = today.backgroundResidencyMs > 0
    || weekly.backgroundResidencyMs > 0;
  const todayScore = scoreTodayResidency({ today, activeMs });
  const weeklyScore = scoreWeeklyResidency(weekly);
  const score = clamp01(Math.max(todayScore, weeklyScore * 0.88));
  const status = resolveStatus({
    hasBackgroundResidencyFacts,
    today,
    weekly,
    todayScore,
    weeklyScore,
    recurringBackgroundDays,
  });
  const activeToResidencyRatio = activeMs > 0 ? today.backgroundResidencyMs / activeMs : null;
  const canEmitAtomic = Boolean(
    hasBackgroundResidencyFacts
    && score >= MIN_VISIBLE_SCORE
    && status !== SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.INSUFFICIENT_BACKGROUND_RESIDENCY_EVIDENCE
    && (
      today.backgroundResidencyMs >= 15 * 60_000
      || today.staleTabMs >= 8 * 60_000
      || today.backgroundMediaMs >= 20 * 60_000
      || weekly.backgroundResidencyMs >= 90 * 60_000
    )
  );
  const caveats = buildCaveats({
    today,
    weekly,
    activeMs,
    hasBehaviorFacts,
  });

  const evidence = {
    backgroundResidencyStatus: status,
    evidenceWindow: [SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.RECURRING_BACKGROUND_RESIDENCY,
      SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.WEEKLY_BACKGROUND_OBSERVED].includes(status)
      || today.backgroundResidencyMs === 0 ? 'weekly' : 'today',
    backgroundResidencyScore: round4(score),
    todayBackgroundResidencyMs: Math.round(today.backgroundResidencyMs),
    todayBackgroundPressureSignalMs: Math.round(today.backgroundPressureSignalMs),
    backgroundMediaMs: Math.round(today.backgroundMediaMs),
    backgroundLingerMs: Math.round(today.backgroundLingerMs),
    staleTabMs: Math.round(today.staleTabMs),
    weeklyBackgroundResidencyMs: Math.round(weekly.backgroundResidencyMs),
    weeklyBackgroundPressureSignalMs: Math.round(weekly.backgroundPressureSignalMs),
    weeklyBackgroundMediaMs: Math.round(weekly.backgroundMediaMs),
    weeklyBackgroundLingerMs: Math.round(weekly.backgroundLingerMs),
    weeklyStaleTabMs: Math.round(weekly.staleTabMs),
    todayActiveMs: Math.round(activeMs),
    activeToResidencyRatio: activeToResidencyRatio === null ? null : Number(activeToResidencyRatio.toFixed(4)),
    recurringBackgroundDays, observedWeeklyDays: observedDays.length,
    recurrenceBasis: 'observed-daily-behavior', durationBasis: 'max_overlapping_tab_channels',
    evidenceFamilyIds: ['background_residency'], attentionAssessment: 'not_observed',
    todayScore: round4(todayScore),
    weeklyScore: round4(weeklyScore),
    hasBehaviorFacts,
    caveats,
  };

  return {
    version: SITE_PULL_BACKGROUND_RESIDENCY_EVIDENCE_PROFILE_VERSION,
    status,
    score: round4(score),
    confidence: hasBehaviorFacts ? 0.78 : 0.58,
    canEmitAtomic,
    evidence,
  };
}
