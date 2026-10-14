import {
  SITE_PULL_PATTERN_CATEGORIES,
  createSitePullPatternSignal,
} from '../sitePullPatternContracts.js';
import {
  clamp,
  clamp01,
  toNumber,
} from '../patternUtils.js';
import { resolveSitePullEntryVisitSummary } from '../../sitePullEntryFacts.js';
import { requireSitePullDetectorEvidenceProfile } from './detectorEvidenceProfiles.js';
import { resolveSitePullObservationState } from '../../sitePullObservationState.js';
import { resolveSiteGoalContext } from '../../../contracts/siteGoalContext.js';

const MIN_MEANINGFUL_GOAL_PROGRESS_MS = 30_000;
const DEFAULT_MEANINGFUL_GOAL_PROGRESS_MS = 2 * 60_000;
const MIN_MEANINGFUL_GOAL_PROGRESS_RATIO = 0.05;
const INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD = 0.35;

function goalMs(featureVector = {}) {
  return toNumber(featureVector.goalMs) || (toNumber(featureVector.goalMinutes) * 60_000);
}

function goalUsageRatio(featureVector = {}) {
  const targetMs = goalMs(featureVector);
  return targetMs > 0 ? resolveSiteGoalContext(featureVector).usageMs / targetMs : 0;
}

function meaningfulGoalProgress(featureVector = {}) {
  const todayMs = resolveSiteGoalContext(featureVector).usageMs;
  const ratio = goalUsageRatio(featureVector);
  if (todayMs <= 0 || ratio <= 0) return false;
  const durationFloor = meaningfulGoalProgressMs(featureVector);
  return todayMs >= durationFloor || ratio >= MIN_MEANINGFUL_GOAL_PROGRESS_RATIO;
}

function meaningfulGoalProgressMs(featureVector = {}) {
  const targetMs = goalMs(featureVector);
  return targetMs > 0
    ? Math.min(
      DEFAULT_MEANINGFUL_GOAL_PROGRESS_MS,
      Math.max(MIN_MEANINGFUL_GOAL_PROGRESS_MS, targetMs * 0.1),
    )
    : DEFAULT_MEANINGFUL_GOAL_PROGRESS_MS;
}

function meaningfulGoalProgressScore(featureVector = {}) {
  const todayMs = resolveSiteGoalContext(featureVector).usageMs;
  const ratio = goalUsageRatio(featureVector);
  const durationFloor = meaningfulGoalProgressMs(featureVector);
  return clamp01(Math.max(
    MIN_MEANINGFUL_GOAL_PROGRESS_RATIO > 0 ? ratio / MIN_MEANINGFUL_GOAL_PROGRESS_RATIO : 0,
    durationFloor > 0 ? todayMs / durationFloor : 0,
  ));
}

function resolveEntryVisitSummary({ facts = null } = {}) {
  return resolveSitePullEntryVisitSummary({
    facts,
  });
}

function planEvidence(featureVector = {}, facts = null) {
  const goalContext = resolveSiteGoalContext(featureVector);
  const targetMs = goalMs(featureVector);
  const usageRatio = goalUsageRatio(featureVector);
  const todayMs = goalContext.usageMs;
  const { todayVisits } = resolveEntryVisitSummary({ facts });
  const weeklyTotalMs = toNumber(featureVector.weeklyTotalMs);
  const activeDays = goalContext.activeDays;
  const overLimitDays = goalContext.overLimitDays;
  return {
    goalBasis: goalContext.basis,
    hasGoal: Boolean(featureVector.hasGoal),
    isProtectedTarget: Boolean(featureVector.isProtectedTarget),
    hasAnyActivity: Boolean(featureVector.hasAnyActivity),
    todayMs,
    todayVisits,
    weeklyTotalMs,
    goalMs: targetMs,
    goalMinutes: toNumber(featureVector.goalMinutes),
    usageRatio,
    overGoalMs: toNumber(featureVector.overGoalMs),
    activeDays,
    overLimitDays,
    overLimitShare: activeDays > 0 ? Number((overLimitDays / activeDays).toFixed(4)) : 0,
    meaningfulGoalProgress: meaningfulGoalProgress(featureVector),
    meaningfulGoalProgressMs: meaningfulGoalProgressMs(featureVector),
    meaningfulGoalProgressScore: meaningfulGoalProgressScore(featureVector),
    activityEvidenceCount: Math.max(
      todayMs > 0 ? 1 : 0,
      todayVisits,
      weeklyTotalMs > 0 ? 1 : 0,
      activeDays,
    ),
  };
}

function dataStateEvidence(featureVector = {}, facts = null) {
  const todayMs = toNumber(featureVector.todayTotalMs);
  const { todayVisits } = resolveEntryVisitSummary({ facts });
  const weeklyTotalMs = toNumber(featureVector.weeklyTotalMs);
  const activeDays = Math.floor(toNumber(featureVector.activeDays));
  const activityEvidenceCount = Math.max(
    todayMs > 0 ? 1 : 0,
    todayVisits,
    weeklyTotalMs > 0 ? 1 : 0,
    activeDays,
  );
  return {
    hasAnyActivity: Boolean(featureVector.hasAnyActivity),
    todayMs,
    todayVisits,
    weeklyTotalMs,
    activeDays,
    activityEvidenceCount,
    stateReason: featureVector?.hasAnyActivity ? 'activity_present' : 'no_activity',
  };
}

function insufficientDataEvidence(featureVector = {}, confidence = 0, facts = null) {
  const evidence = dataStateEvidence(featureVector, facts);
  const normalizedConfidence = clamp01(confidence);
  return {
    ...evidence,
    confidence: normalizedConfidence,
    confidenceThreshold: INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD,
    confidenceGap: Number(Math.max(0, INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD - normalizedConfidence).toFixed(4)),
    stateReason: 'insufficient_data',
    dataQualityStatus: normalizedConfidence < 0.2 ? 'very_sparse' : 'sparse',
  };
}

export function detectDataPatterns({ featureVector, confidence, facts = null }) {
  const evidence = dataStateEvidence(featureVector, facts);
  const observation = resolveSitePullObservationState(featureVector);
  if (observation.status === 'missing') {
    return [createSitePullPatternSignal({
      id: 'insufficient_data',
      category: SITE_PULL_PATTERN_CATEGORIES.DATA,
      severity: 'neutral', tone: 'neutral', confidence: 0,
      evidence: {
        ...evidence, ...observation,
        stateReason: 'insufficient_data', dataQualityStatus: 'unobserved',
      },
    })];
  }
  if (!featureVector?.hasAnyActivity) {
    return [createSitePullPatternSignal({
      id: 'no_activity',
      category: SITE_PULL_PATTERN_CATEGORIES.DATA,
      severity: 'neutral',
      tone: 'neutral',
      confidence: 1,
      evidence: { ...evidence, ...observation },
    })];
  }
  if (confidence < INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD) {
    return [createSitePullPatternSignal({
      id: 'insufficient_data',
      category: SITE_PULL_PATTERN_CATEGORIES.DATA,
      severity: 'neutral',
      tone: 'neutral',
      score: 30,
      confidence,
      evidence: insufficientDataEvidence(featureVector, confidence, facts),
    })];
  }
  return [];
}

export function detectPlanPatterns({ featureVector, facts = null }) {
  const signals = [];
  const evidence = planEvidence(featureVector, facts);
  if (evidence.hasGoal && evidence.usageRatio >= 1) {
    signals.push(createSitePullPatternSignal({
      id: 'goal_exceeded',
      category: SITE_PULL_PATTERN_CATEGORIES.PLAN,
      severity: 'warning',
      tone: evidence.usageRatio >= 1.5 ? 'danger' : 'warning',
      score: clamp(55 + (evidence.usageRatio * 18), 0, 92),
      confidence: 0.92,
      evidence,
      recommendedAction: { type: 'goal_reflection', actionId: 'enable_goal_pause' },
    }));
  }
  if (!evidence.hasGoal && evidence.isProtectedTarget && evidence.hasAnyActivity) {
    signals.push(createSitePullPatternSignal({
      id: 'goal_missing',
      category: SITE_PULL_PATTERN_CATEGORIES.PLAN,
      severity: 'neutral',
      tone: 'neutral',
      score: 35,
      confidence: 0.72,
      evidence,
      recommendedAction: { type: 'set_goal', actionId: 'set_daily_goal' },
    }));
  }
  if (
    evidence.hasGoal
    && evidence.usageRatio > 0
    && evidence.usageRatio < 0.75
    && evidence.meaningfulGoalProgress
  ) {
    signals.push(createSitePullPatternSignal({
      id: 'goal_kept',
      category: SITE_PULL_PATTERN_CATEGORIES.PLAN,
      severity: 'positive',
      tone: 'positive',
      score: 25,
      confidence: 0.86,
      evidence,
      recommendedAction: { type: 'maintain', actionId: 'hold_course' },
    }));
  }
  return signals;
}

export function detectSubscorePatterns({
  subscores,
  timePressureEvidenceProfile = null,
  trendPressureEvidenceProfile = null,
  habitConsistencyEvidenceProfile = null,
  nightPressureEvidenceProfile = null,
  immersionEvidenceProfile = null,
  interventionOutcomeEvidenceProfile = null,
}) {
  const signals = [];
  const timePressureProfile = requireSitePullDetectorEvidenceProfile(
    timePressureEvidenceProfile,
    'time_pressure',
  );
  if (timePressureProfile.canEmitVisible) {
    signals.push(createSitePullPatternSignal({
      id: 'time_heavy_today',
      category: SITE_PULL_PATTERN_CATEGORIES.TIME,
      severity: 'warning',
      tone: 'warning',
      score: timePressureProfile.score,
      confidence: timePressureProfile.confidence,
      evidence: timePressureProfile.evidence,
    }));
  }
  const immersionProfile = requireSitePullDetectorEvidenceProfile(immersionEvidenceProfile, 'immersion');
  if (immersionProfile.canEmitAtomic) {
    signals.push(createSitePullPatternSignal({
        id: 'deep_immersion',
        category: SITE_PULL_PATTERN_CATEGORIES.IMMERSION,
        severity: 'neutral',
        tone: 'neutral',
      score: immersionProfile.score,
      confidence: immersionProfile.confidence,
      evidence: immersionProfile.evidence,
        recommendedAction: null,
    }));
  }
  const trendPressureProfile = requireSitePullDetectorEvidenceProfile(
    trendPressureEvidenceProfile,
    'trend_pressure',
  );
  const habitConsistencyProfile = requireSitePullDetectorEvidenceProfile(
    habitConsistencyEvidenceProfile,
    'habit_consistency',
  );
  if (habitConsistencyProfile.canEmitVisible) {
    signals.push(createSitePullPatternSignal({
      id: 'daily_habit',
      category: SITE_PULL_PATTERN_CATEGORIES.HABIT,
      severity: 'watch',
      tone: 'neutral',
      score: habitConsistencyProfile.score,
      confidence: habitConsistencyProfile.confidence,
      evidence: habitConsistencyProfile.evidence,
    }));
  }
  if (trendPressureProfile.canEmitVisible) {
    signals.push(createSitePullPatternSignal({
        id: 'rising_trend',
        category: SITE_PULL_PATTERN_CATEGORIES.TREND,
        severity: 'neutral',
        tone: 'neutral',
      score: trendPressureProfile.score,
      confidence: trendPressureProfile.confidence,
      evidence: trendPressureProfile.evidence,
      recommendedAction: { type: 'weekly_review', actionId: 'review_weekly_goal' },
    }));
  }
  const nightPressureProfile = requireSitePullDetectorEvidenceProfile(nightPressureEvidenceProfile, 'night_pressure');
  if (nightPressureProfile.canEmitAtomic) {
    signals.push(createSitePullPatternSignal({
      id: 'late_night',
      category: SITE_PULL_PATTERN_CATEGORIES.CIRCADIAN,
      severity: 'watch',
      tone: 'neutral',
      score: Math.max(clamp01(subscores.circadianRisk) * 100, nightPressureProfile.score),
      confidence: nightPressureProfile.confidence,
      evidence: nightPressureProfile.evidence,
      recommendedAction: { type: 'night_guard', actionId: 'enable_night_guard' },
    }));
  }
  const interventionOutcomeProfile = requireSitePullDetectorEvidenceProfile(
    interventionOutcomeEvidenceProfile,
    'intervention_outcome',
  );
  if (interventionOutcomeProfile.canEmitReentryAtomic) {
    signals.push(createSitePullPatternSignal({
      id: 'intervention_reentry',
      category: SITE_PULL_PATTERN_CATEGORIES.INTERVENTION,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(interventionOutcomeProfile.reentry.strength * 100, 0, 100),
      confidence: interventionOutcomeProfile.confidence,
      evidence: interventionOutcomeProfile.reentry.evidence,
      recommendedAction: null,
    }));
  }
  return signals;
}
