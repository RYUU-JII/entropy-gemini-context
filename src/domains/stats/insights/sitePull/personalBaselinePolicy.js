import {
  SITE_PULL_MINUTE_MS as MINUTE_MS,
  average,
  clamp,
  clamp01,
  durationNorm,
  ratioNorm,
  smooth01,
  toNumber,
} from './sitePullMath.js';
import {
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_ROLES,
  PERSONAL_BASELINE_STATUSES,
} from '../../../../lib/personalBaselineContract.js';

export const SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION = 'site-pull-personal-baseline-policy-v3';

const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

export const SITE_PULL_PERSONAL_BASELINE_ROLES = PERSONAL_BASELINE_ROLES;

export const SITE_PULL_PERSONAL_BASELINE_STATUSES = PERSONAL_BASELINE_STATUSES;

export const SITE_PULL_PERSONAL_TRAJECTORY_STATES = Object.freeze({
  INSUFFICIENT: 'insufficient',
  STEADY: 'steady',
  IMPROVING: 'improving',
  RISING: 'rising',
  VOLATILE: 'volatile',
  REBOUNDING: 'rebounding',
});

export const SITE_PULL_ADAPTIVE_REFERENCE_STATES = Object.freeze({
  SPARSE_ANCHORED: 'sparse_anchored',
  BASELINE_ANCHORED: 'baseline_anchored',
  GENTLY_TIGHTENED: 'gently_tightened',
  VOLATILITY_GUARDED: 'volatility_guarded',
  REBOUND_GUARDED: 'rebound_guarded',
});

export const SITE_PULL_PERSONAL_BASELINE_POLICY = Object.freeze({
  observedBaseline: Object.freeze({
    role: SITE_PULL_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE,
    targetDays: 30,
    excludeCurrentDay: true,
    minFormingConfidence: 0.35,
    minStableConfidence: 0.65,
    description: 'Observed personal baseline is descriptive history, not a goal or moral target.',
  }),
  robustStats: Object.freeze({
    robustSigmaFromMad: 1.4826,
    minTimeSigmaMs: 5 * MINUTE_MS,
  }),
  personalWeight: Object.freeze({
    cap: 0.7,
    description: 'Personal history can bend scoring, but it cannot fully replace general/product policy.',
  }),
  recentTrajectory: Object.freeze({
    role: SITE_PULL_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
    recentDays: 7,
    momentumDays: 3,
    minObservedDays: 7,
    minRecentObservedDays: 3,
    minMomentumObservedDays: 1,
    improvementRatio: 0.82,
    strongImprovementRatio: 0.62,
    risingRatio: 1.18,
    strongRisingRatio: 1.75,
    reboundTodayRatio: 1.15,
    volatileSpreadRatio: 0.55,
    description: 'Recent trajectory explains direction without mutating the observed baseline.',
  }),
  adaptiveReference: Object.freeze({
    role: SITE_PULL_PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE,
    minReferenceMs: 5 * MINUTE_MS,
    formingMaxTightenRatio: 0.08,
    stableMaxTightenRatio: 0.22,
    volatileMaxTightenRatio: 0.05,
    description: 'Adaptive reference is a bounded interpretation layer; it never writes back into baseline.',
  }),
  normativeAnchor: Object.freeze({
    role: SITE_PULL_PERSONAL_BASELINE_ROLES.NORMATIVE_ANCHOR,
    source: 'external_goal_or_product_policy',
    description: 'Healthy direction comes from goals/product policy, not from personal history alone.',
  }),
});

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function requirePolicyContextField(personalBaseline, fieldName) {
  if (!hasOwn(personalBaseline, fieldName)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_FIELD_MISSING:${fieldName}`);
  }
  return personalBaseline[fieldName];
}

function requirePolicyContextString(personalBaseline, fieldName) {
  const value = requirePolicyContextField(personalBaseline, fieldName);
  if (typeof value !== 'string' || value.length <= 0) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_FIELD_INVALID:${fieldName}`);
  }
  return value;
}

function requirePolicyContextNumber(personalBaseline, fieldName) {
  const numeric = Number(requirePolicyContextField(personalBaseline, fieldName));
  if (!Number.isFinite(numeric)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_FIELD_INVALID:${fieldName}`);
  }
  return numeric;
}

function requireRecentTrajectoryField(recentTrajectory, fieldName) {
  if (!hasOwn(recentTrajectory, fieldName)) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_FIELD_MISSING:${fieldName}`);
  }
  return recentTrajectory[fieldName];
}

function requireRecentTrajectoryString(recentTrajectory, fieldName) {
  const value = requireRecentTrajectoryField(recentTrajectory, fieldName);
  if (typeof value !== 'string' || value.length <= 0) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_FIELD_INVALID:${fieldName}`);
  }
  return value;
}

function requireRecentTrajectoryNumber(recentTrajectory, fieldName) {
  const numeric = Number(requireRecentTrajectoryField(recentTrajectory, fieldName));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_FIELD_INVALID:${fieldName}`);
  }
  return numeric;
}

function safeRatio(numerator, denominator) {
  const bottom = toNumber(denominator);
  if (bottom <= 0) return toNumber(numerator) > 0 ? 2 : 1;
  return toNumber(numerator) / bottom;
}

function normalizeActiveValues(entries = []) {
  return Array.isArray(entries)
    ? entries
      .filter((entry) => entry?.observed === true)
      .map((entry) => toNumber(entry?.activeMs))
    : [];
}

function meanAbsoluteDeviation(values = [], reference = average(values)) {
  if (!Array.isArray(values) || values.length <= 0) return 0;
  return average(values.map((value) => Math.abs(toNumber(value) - reference)));
}

function requirePolicyProjectionNumber(value, fieldName, { integer = false } = {}) {
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || (integer && !Number.isInteger(value))) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_POLICY_INPUT_INVALID:${fieldName}`);
  }
  return value;
}

function requirePolicyTrajectoryState(value) {
  if (!Object.values(SITE_PULL_PERSONAL_TRAJECTORY_STATES).includes(value)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_POLICY_INPUT_INVALID:trajectoryState');
  }
  return value;
}

function buildRecentTrajectoryCaveats({
  state,
  currentObserved,
  improvementScore,
  singleDaySpikeScore,
}) {
  const caveats = [];
  if (!currentObserved) caveats.push('current_day_unobserved');
  if (state === SITE_PULL_PERSONAL_TRAJECTORY_STATES.INSUFFICIENT) {
    caveats.push('trajectory_sample_not_authoritative');
  }
  if (state === SITE_PULL_PERSONAL_TRAJECTORY_STATES.VOLATILE) {
    caveats.push('recent_window_volatile');
  }
  if (state === SITE_PULL_PERSONAL_TRAJECTORY_STATES.REBOUNDING) {
    caveats.push('recent_improvement_rebounded_today');
  }
  if (improvementScore > 0) caveats.push('recent_improvement_does_not_rewrite_baseline');
  if (singleDaySpikeScore >= 0.62) caveats.push('single_day_spike_like');
  return caveats;
}

function sumActiveValues(values = []) {
  return values.reduce((total, value) => total + value, 0);
}

function countActiveValues(values = []) {
  return values.filter((value) => value > 0).length;
}

function computeSitePullSingleDaySpikeScore({
  todayMs,
  recentTotalMs,
  todayShareOfRecent,
  recentPreviousMaxMs,
  referenceMs,
  recentActiveDays,
}) {
  if (todayMs < 15 * MINUTE_MS || recentTotalMs <= 0) return 0;
  const dominanceScore = smooth01(todayShareOfRecent, 0.62, 0.82);
  const previousRecentQuietScore = 1 - ratioNorm(
    recentPreviousMaxMs / referenceMs,
    1.15,
    2.1,
  );
  const supportPenalty = 1 - smooth01(recentActiveDays, 2, 3);
  return clamp01(
    (dominanceScore * 0.55)
    + (previousRecentQuietScore * 0.25)
    + (supportPenalty * 0.2),
  );
}

export function getSitePullPersonalBaselinePolicy() {
  return SITE_PULL_PERSONAL_BASELINE_POLICY;
}

export function resolveSitePullPersonalBaselinePolicyContext(personalBaseline = null) {
  if (personalBaseline === null || personalBaseline === undefined) return null;
  if (!isObjectRecord(personalBaseline)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_INVALID');
  }

  const policyVersion = requirePolicyContextString(personalBaseline, 'policyVersion');
  const status = requirePolicyContextString(personalBaseline, 'status');
  if (!Object.values(SITE_PULL_PERSONAL_BASELINE_STATUSES).includes(status)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_STATUS_INVALID:${status}`);
  }

  const confidence = clamp01(requirePolicyContextNumber(personalBaseline, 'confidence'));
  const personalWeight = clamp(
    requirePolicyContextNumber(personalBaseline, 'personalWeight'),
    0,
    SITE_PULL_PERSONAL_BASELINE_POLICY.personalWeight.cap,
  );

  return {
    policyVersion,
    status,
    confidence,
    personalWeight,
    isSparse: status === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE,
    hasPersonalBaselineFacts: status !== SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE,
  };
}

export function resolveSitePullPersonalBaselineStatus(confidence) {
  const policy = SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline;
  const safeConfidence = clamp01(confidence);
  if (safeConfidence >= policy.minStableConfidence) return SITE_PULL_PERSONAL_BASELINE_STATUSES.STABLE;
  if (safeConfidence >= policy.minFormingConfidence) return SITE_PULL_PERSONAL_BASELINE_STATUSES.FORMING;
  return SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE;
}

export function computeSitePullPersonalWeight(observedDays, confidence) {
  const targetDays = SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays;
  const dayWeight = (smooth01(observedDays, 3, 7) * 0.15)
    + (smooth01(observedDays, 7, 14) * 0.2)
    + (smooth01(observedDays, 14, targetDays) * 0.35);
  return clamp(
    dayWeight * (0.55 + (clamp01(confidence) * 0.45)),
    0,
    SITE_PULL_PERSONAL_BASELINE_POLICY.personalWeight.cap,
  );
}

export function deriveSitePullRecentTrajectoryProjection({
  sampleDays,
  recentDays,
  momentumDays,
  comparisonDays,
  recentActiveDays,
  previousActiveDays,
  recentTotalMs,
  recentPreviousMaxMs,
  recentAverageMs,
  momentumAverageMs,
  priorAverageMs,
  recentMeanAbsoluteDeviationMs,
  currentObserved,
  todayMs,
  p75ReferenceMs,
  p90ReferenceMs,
  confidence,
} = {}) {
  const policy = SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory;
  if (typeof currentObserved !== 'boolean') {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_POLICY_INPUT_INVALID:currentObserved');
  }
  const resolvedSampleDays = requirePolicyProjectionNumber(sampleDays, 'sampleDays', { integer: true });
  const resolvedRecentDays = requirePolicyProjectionNumber(recentDays, 'recentDays', {
    integer: true,
  });
  const resolvedMomentumDays = requirePolicyProjectionNumber(momentumDays, 'momentumDays', {
    integer: true,
  });
  const resolvedComparisonDays = requirePolicyProjectionNumber(
    comparisonDays,
    'comparisonDays',
    { integer: true },
  );
  const resolvedRecentActiveDays = requirePolicyProjectionNumber(
    recentActiveDays,
    'recentActiveDays',
    { integer: true },
  );
  const resolvedPreviousActiveDays = requirePolicyProjectionNumber(
    previousActiveDays,
    'previousActiveDays',
    { integer: true },
  );
  const resolvedRecentTotalMs = requirePolicyProjectionNumber(recentTotalMs, 'recentTotalMs');
  const resolvedRecentPreviousMaxMs = requirePolicyProjectionNumber(
    recentPreviousMaxMs,
    'recentPreviousMaxMs',
  );
  const resolvedRecentAverageMs = requirePolicyProjectionNumber(
    recentAverageMs,
    'recentAverageMs',
  );
  const resolvedMomentumAverageMs = requirePolicyProjectionNumber(
    momentumAverageMs,
    'momentumAverageMs',
  );
  const resolvedPriorAverageMs = requirePolicyProjectionNumber(priorAverageMs, 'priorAverageMs');
  const resolvedRecentMeanAbsoluteDeviationMs = requirePolicyProjectionNumber(
    recentMeanAbsoluteDeviationMs,
    'recentMeanAbsoluteDeviationMs',
  );
  const resolvedTodayMs = requirePolicyProjectionNumber(todayMs, 'todayMs');
  const resolvedP75ReferenceMs = requirePolicyProjectionNumber(p75ReferenceMs, 'p75ReferenceMs');
  const resolvedP90ReferenceMs = requirePolicyProjectionNumber(p90ReferenceMs, 'p90ReferenceMs');
  const resolvedConfidence = requirePolicyProjectionNumber(confidence, 'confidence');
  const recentComparisonDays = Math.min(policy.momentumDays, resolvedComparisonDays);
  const previousComparisonDays = Math.min(
    4,
    Math.max(0, resolvedComparisonDays - (currentObserved ? 1 : 0)),
  );
  if (resolvedConfidence > 1
    || resolvedP75ReferenceMs > resolvedP90ReferenceMs
    || resolvedRecentDays > Math.min(policy.recentDays, resolvedSampleDays)
    || resolvedMomentumDays > Math.min(policy.momentumDays, resolvedRecentDays)
    || resolvedComparisonDays > Math.min(7, resolvedSampleDays + (currentObserved ? 1 : 0))
    || resolvedRecentActiveDays > recentComparisonDays
    || resolvedPreviousActiveDays > previousComparisonDays
    || resolvedRecentActiveDays + resolvedPreviousActiveDays > resolvedComparisonDays
    || (!currentObserved && resolvedTodayMs !== 0)
    || (currentObserved && resolvedRecentTotalMs < resolvedTodayMs)
    || resolvedRecentPreviousMaxMs > resolvedRecentTotalMs
      - (currentObserved ? resolvedTodayMs : 0)
    || (resolvedRecentTotalMs === 0 && (
      resolvedRecentActiveDays !== 0
      || resolvedRecentPreviousMaxMs !== 0
    ))
    || (resolvedRecentTotalMs > 0 && resolvedRecentActiveDays === 0)
    || (currentObserved && resolvedTodayMs > 0 && resolvedRecentActiveDays === 0)
    || (resolvedRecentPreviousMaxMs > 0 && resolvedRecentActiveDays === 0)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_POLICY_INPUT_RELATION_INVALID:recentTrajectory');
  }
  const referenceMs = Math.max(
    resolvedP75ReferenceMs,
    resolvedPriorAverageMs,
    SITE_PULL_PERSONAL_BASELINE_POLICY.adaptiveReference.minReferenceMs,
  );
  const recentVsReferenceRatio = safeRatio(resolvedRecentAverageMs, referenceMs);
  const momentumVsReferenceRatio = safeRatio(resolvedMomentumAverageMs, referenceMs);
  const todayVsReferenceRatio = currentObserved ? safeRatio(resolvedTodayMs, referenceMs) : 0;
  const spreadRatio = safeRatio(resolvedRecentMeanAbsoluteDeviationMs, referenceMs);
  const todayShareOfRecent = currentObserved && resolvedRecentTotalMs > 0
    ? resolvedTodayMs / resolvedRecentTotalMs
    : 0;
  const singleDaySpikeScore = currentObserved ? computeSitePullSingleDaySpikeScore({
    todayMs: resolvedTodayMs,
    recentTotalMs: resolvedRecentTotalMs,
    todayShareOfRecent,
    recentPreviousMaxMs: resolvedRecentPreviousMaxMs,
    referenceMs,
    recentActiveDays: resolvedRecentActiveDays,
  }) : 0;
  const volatilityScore = smooth01(spreadRatio, 0.18, policy.volatileSpreadRatio);
  const improvementRatio = Math.min(recentVsReferenceRatio, momentumVsReferenceRatio);
  const improvementScore = improvementRatio < policy.improvementRatio
    ? clamp01((policy.improvementRatio - improvementRatio)
      / Math.max(0.01, policy.improvementRatio - policy.strongImprovementRatio))
    : 0;
  const risingRatio = Math.max(recentVsReferenceRatio, momentumVsReferenceRatio);
  const risingScore = risingRatio > policy.risingRatio
    ? clamp01((risingRatio - policy.risingRatio)
      / Math.max(0.01, policy.strongRisingRatio - policy.risingRatio))
    : 0;
  const reboundScore = currentObserved
    && improvementScore >= 0.35
    && todayVsReferenceRatio > policy.reboundTodayRatio
    ? smooth01(
        todayVsReferenceRatio,
        policy.reboundTodayRatio,
        Math.max(1.9, safeRatio(resolvedP90ReferenceMs, referenceMs)),
      )
    : 0;
  const sampleConfidence = clamp01(
    (resolvedConfidence * 0.55)
    + (smooth01(resolvedSampleDays, policy.minObservedDays, policy.recentDays * 2) * 0.15)
    + (smooth01(resolvedRecentDays, policy.minRecentObservedDays, policy.recentDays) * 0.1)
    + (durationNorm(referenceMs, 5, 90) * 0.1)
    + ((1 - volatilityScore) * 0.1),
  );
  let state = SITE_PULL_PERSONAL_TRAJECTORY_STATES.STEADY;
  if (resolvedSampleDays < policy.minObservedDays
    || resolvedRecentDays < policy.minRecentObservedDays
    || resolvedMomentumDays < policy.minMomentumObservedDays
    || resolvedConfidence < 0.35) {
    state = SITE_PULL_PERSONAL_TRAJECTORY_STATES.INSUFFICIENT;
  } else if (reboundScore >= 0.45) {
    state = SITE_PULL_PERSONAL_TRAJECTORY_STATES.REBOUNDING;
  } else if (volatilityScore >= 0.7) {
    state = SITE_PULL_PERSONAL_TRAJECTORY_STATES.VOLATILE;
  } else if (improvementScore >= 0.4) {
    state = SITE_PULL_PERSONAL_TRAJECTORY_STATES.IMPROVING;
  } else if (risingScore >= 0.4) {
    state = SITE_PULL_PERSONAL_TRAJECTORY_STATES.RISING;
  }

  const caveats = buildRecentTrajectoryCaveats({
    state,
    currentObserved,
    improvementScore,
    singleDaySpikeScore,
  });

  return {
    version: SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
    role: SITE_PULL_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
    state,
    sampleDays: resolvedSampleDays,
    comparisonDays: resolvedComparisonDays,
    recentDays: resolvedRecentDays,
    momentumDays: resolvedMomentumDays,
    recentActiveDays: resolvedRecentActiveDays,
    previousActiveDays: resolvedPreviousActiveDays,
    recentTotalMs: resolvedRecentTotalMs,
    recentPreviousMaxMs: resolvedRecentPreviousMaxMs,
    currentObserved,
    todayMs: resolvedTodayMs,
    todayShareOfRecent: Number(todayShareOfRecent.toFixed(3)),
    singleDaySpikeScore: round4(singleDaySpikeScore),
    recentAverageMs: resolvedRecentAverageMs,
    momentumAverageMs: resolvedMomentumAverageMs,
    priorAverageMs: resolvedPriorAverageMs,
    recentMeanAbsoluteDeviationMs: resolvedRecentMeanAbsoluteDeviationMs,
    referenceMs,
    recentVsReferenceRatio: Number(recentVsReferenceRatio.toFixed(3)),
    momentumVsReferenceRatio: Number(momentumVsReferenceRatio.toFixed(3)),
    todayVsReferenceRatio: Number(todayVsReferenceRatio.toFixed(3)),
    improvementScore: round4(improvementScore),
    risingScore: round4(risingScore),
    reboundScore: round4(reboundScore),
    volatilityScore: round4(volatilityScore),
    confidence: round4(sampleConfidence),
    mutatesObservedBaseline: false,
    caveats,
  };
}

export function buildSitePullRecentTrajectory({
  baselineEntries = [],
  currentObserved,
  todayMs,
  p75ReferenceMs = 0,
  p90ReferenceMs = 0,
  confidence = 0,
} = {}) {
  const policy = SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory;
  if (typeof currentObserved !== 'boolean') {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_CURRENT_OBSERVED_INVALID');
  }
  const calendarEntries = Array.isArray(baselineEntries) ? baselineEntries : [];
  const values = normalizeActiveValues(calendarEntries);
  const recentCalendarEntries = calendarEntries.slice(-policy.recentDays);
  const momentumCalendarEntries = calendarEntries.slice(-policy.momentumDays);
  const priorCalendarEntries = calendarEntries.slice(
    0,
    Math.max(0, calendarEntries.length - policy.recentDays),
  );
  const recentValues = normalizeActiveValues(recentCalendarEntries);
  const momentumValues = normalizeActiveValues(momentumCalendarEntries);
  const priorValues = normalizeActiveValues(priorCalendarEntries);
  const recentAverageMs = average(recentValues);
  const resolvedTodayMs = currentObserved ? toNumber(todayMs) : 0;
  const comparisonHistoryEntries = calendarEntries.slice(-6);
  const recentPreviousEntries = comparisonHistoryEntries.slice(-2);
  const previousComparisonEntries = comparisonHistoryEntries.slice(
    0,
    Math.max(0, comparisonHistoryEntries.length - recentPreviousEntries.length),
  );
  const comparisonHistoryValues = normalizeActiveValues(comparisonHistoryEntries);
  const recentPreviousValues = normalizeActiveValues(recentPreviousEntries);
  const previousComparisonValues = normalizeActiveValues(previousComparisonEntries);
  const recentComparisonValues = currentObserved
    ? [...recentPreviousValues, resolvedTodayMs]
    : recentPreviousValues;
  return deriveSitePullRecentTrajectoryProjection({
    sampleDays: values.length,
    recentDays: recentValues.length,
    momentumDays: momentumValues.length,
    comparisonDays: comparisonHistoryValues.length + (currentObserved ? 1 : 0),
    recentActiveDays: countActiveValues(recentComparisonValues),
    previousActiveDays: countActiveValues(previousComparisonValues),
    recentTotalMs: sumActiveValues(recentComparisonValues),
    recentPreviousMaxMs: recentPreviousValues.reduce(
      (maximum, value) => Math.max(maximum, value),
      0,
    ),
    recentAverageMs,
    momentumAverageMs: average(momentumValues),
    priorAverageMs: average(priorValues),
    recentMeanAbsoluteDeviationMs: meanAbsoluteDeviation(recentValues, recentAverageMs),
    currentObserved,
    todayMs: resolvedTodayMs,
    p75ReferenceMs: toNumber(p75ReferenceMs),
    p90ReferenceMs: toNumber(p90ReferenceMs),
    confidence: clamp01(confidence),
  });
}

export function requireSitePullRecentTrajectory(personalBaseline = null) {
  if (!isObjectRecord(personalBaseline)) {
    throw new Error('SITE_PULL_RECENT_TRAJECTORY_BASELINE_INVALID');
  }
  const recentTrajectory = requirePolicyContextField(personalBaseline, 'recentTrajectory');
  if (!isObjectRecord(recentTrajectory)) {
    throw new Error('SITE_PULL_RECENT_TRAJECTORY_INVALID');
  }
  const role = requireRecentTrajectoryString(recentTrajectory, 'role');
  if (role !== SITE_PULL_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_ROLE_INVALID:${role}`);
  }
  const state = requireRecentTrajectoryString(recentTrajectory, 'state');
  if (!Object.values(SITE_PULL_PERSONAL_TRAJECTORY_STATES).includes(state)) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_STATE_INVALID:${state}`);
  }
  return recentTrajectory;
}

export function projectSitePullRecentTrajectory(recentTrajectory = null) {
  if (!isObjectRecord(recentTrajectory)) {
    throw new Error('SITE_PULL_RECENT_TRAJECTORY_PROJECTION_INPUT_INVALID');
  }
  const role = requireRecentTrajectoryString(recentTrajectory, 'role');
  if (role !== SITE_PULL_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_ROLE_INVALID:${role}`);
  }
  const state = requireRecentTrajectoryString(recentTrajectory, 'state');
  if (!Object.values(SITE_PULL_PERSONAL_TRAJECTORY_STATES).includes(state)) {
    throw new Error(`SITE_PULL_RECENT_TRAJECTORY_STATE_INVALID:${state}`);
  }
  const sampleDays = Math.floor(requireRecentTrajectoryNumber(recentTrajectory, 'sampleDays'));
  const confidence = clamp01(requireRecentTrajectoryNumber(recentTrajectory, 'confidence'));
  const recentAverageMs = requireRecentTrajectoryNumber(recentTrajectory, 'recentAverageMs');
  const referenceMs = requireRecentTrajectoryNumber(recentTrajectory, 'referenceMs');
  const trendRatio = requireRecentTrajectoryNumber(recentTrajectory, 'recentVsReferenceRatio');
  const hasTrendComparison = state !== SITE_PULL_PERSONAL_TRAJECTORY_STATES.INSUFFICIENT
    && sampleDays >= SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory.minObservedDays
    && confidence >= SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.minFormingConfidence;
  const trendDirection = !hasTrendComparison
    ? 'flat'
    : trendRatio >= SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory.risingRatio
      ? 'up'
      : trendRatio <= SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory.improvementRatio
        ? 'down'
        : 'flat';

  return {
    trendRole: role,
    hasTrendComparison,
    recentAverageMs,
    baselineAverageMs: referenceMs,
    trendRatio: Number(trendRatio.toFixed(3)),
    trendDirection,
  };
}

export function deriveSitePullAdaptiveReferenceProjection({
  p75ReferenceMs,
  confidence,
  personalWeight,
  trajectoryState,
  trajectoryImprovementScore,
  trajectoryConfidence,
} = {}) {
  const policy = SITE_PULL_PERSONAL_BASELINE_POLICY.adaptiveReference;
  const resolvedP75ReferenceMs = requirePolicyProjectionNumber(p75ReferenceMs, 'p75ReferenceMs');
  const resolvedConfidence = requirePolicyProjectionNumber(confidence, 'confidence');
  const resolvedPersonalWeight = requirePolicyProjectionNumber(personalWeight, 'personalWeight');
  const resolvedTrajectoryState = requirePolicyTrajectoryState(trajectoryState);
  const resolvedTrajectoryImprovementScore = requirePolicyProjectionNumber(
    trajectoryImprovementScore,
    'trajectoryImprovementScore',
  );
  const resolvedTrajectoryConfidence = requirePolicyProjectionNumber(
    trajectoryConfidence,
    'trajectoryConfidence',
  );
  if (resolvedConfidence > 1
    || resolvedPersonalWeight > SITE_PULL_PERSONAL_BASELINE_POLICY.personalWeight.cap
    || resolvedTrajectoryImprovementScore > 1
    || resolvedTrajectoryConfidence > 1) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_POLICY_INPUT_RELATION_INVALID:adaptiveReference');
  }
  const observedReferenceMs = Math.max(resolvedP75ReferenceMs, policy.minReferenceMs);
  const baselineStatus = resolveSitePullPersonalBaselineStatus(resolvedConfidence);
  let maxTightenRatio = baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.STABLE
    ? policy.stableMaxTightenRatio
    : policy.formingMaxTightenRatio;
  let state = SITE_PULL_ADAPTIVE_REFERENCE_STATES.BASELINE_ANCHORED;
  let tighteningPressure = 0;

  if (baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE) {
    maxTightenRatio = 0;
    state = SITE_PULL_ADAPTIVE_REFERENCE_STATES.SPARSE_ANCHORED;
  } else if (resolvedTrajectoryState === SITE_PULL_PERSONAL_TRAJECTORY_STATES.REBOUNDING) {
    maxTightenRatio = 0;
    state = SITE_PULL_ADAPTIVE_REFERENCE_STATES.REBOUND_GUARDED;
  } else if (resolvedTrajectoryState === SITE_PULL_PERSONAL_TRAJECTORY_STATES.VOLATILE) {
    maxTightenRatio = policy.volatileMaxTightenRatio;
    tighteningPressure = resolvedTrajectoryImprovementScore * 0.5;
    state = SITE_PULL_ADAPTIVE_REFERENCE_STATES.VOLATILITY_GUARDED;
  } else if (resolvedTrajectoryState === SITE_PULL_PERSONAL_TRAJECTORY_STATES.IMPROVING) {
    tighteningPressure = resolvedTrajectoryImprovementScore;
    state = SITE_PULL_ADAPTIVE_REFERENCE_STATES.GENTLY_TIGHTENED;
  }

  const tighteningRatio = clamp(
    tighteningPressure * maxTightenRatio * (0.55 + (resolvedPersonalWeight * 0.45)),
    0,
    maxTightenRatio,
  );
  const referenceMs = baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE
    ? policy.minReferenceMs
    : Math.max(
        policy.minReferenceMs,
        observedReferenceMs * (1 - tighteningRatio),
      );
  const caveats = [
    'adaptive_reference_not_observed_baseline',
    'observed_baseline_is_not_goal',
  ];
  if (state === SITE_PULL_ADAPTIVE_REFERENCE_STATES.GENTLY_TIGHTENED) {
    caveats.push('recent_improvement_acknowledged_bounded');
  }
  if (state === SITE_PULL_ADAPTIVE_REFERENCE_STATES.REBOUND_GUARDED) {
    caveats.push('rebound_prevents_fast_tightening');
  }
  if (state === SITE_PULL_ADAPTIVE_REFERENCE_STATES.VOLATILITY_GUARDED) {
    caveats.push('volatile_recent_window_limits_tightening');
  }

  return {
    version: SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
    role: SITE_PULL_PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE,
    referenceMode: baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE
      ? PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY
      : PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE,
    state,
    observedReferenceMs,
    referenceMs,
    tighteningRatio: Number(tighteningRatio.toFixed(4)),
    maxTightenRatio,
    confidence: round4(resolvedConfidence * (0.65 + (resolvedTrajectoryConfidence * 0.35))),
    mutatesObservedBaseline: false,
    caveats,
  };
}

export function buildSitePullAdaptiveReference({
  p75ReferenceMs = 0,
  confidence = 0,
  personalWeight = 0,
  recentTrajectory = null,
} = {}) {
  if (!isObjectRecord(recentTrajectory)) {
    throw new Error('SITE_PULL_ADAPTIVE_REFERENCE_RECENT_TRAJECTORY_INVALID');
  }
  return deriveSitePullAdaptiveReferenceProjection({
    p75ReferenceMs: toNumber(p75ReferenceMs),
    confidence: clamp01(confidence),
    personalWeight: clamp(
      personalWeight,
      0,
      SITE_PULL_PERSONAL_BASELINE_POLICY.personalWeight.cap,
    ),
    trajectoryState: recentTrajectory.state,
    trajectoryImprovementScore: toNumber(recentTrajectory.improvementScore),
    trajectoryConfidence: toNumber(recentTrajectory.confidence),
  });
}

export function buildSitePullPersonalBaselinePolicySummary() {
  const policy = SITE_PULL_PERSONAL_BASELINE_POLICY;
  return {
    version: SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
    observedBaselineRole: policy.observedBaseline.role,
    recentTrajectoryRole: policy.recentTrajectory.role,
    adaptiveReferenceRole: policy.adaptiveReference.role,
    normativeAnchorRole: policy.normativeAnchor.role,
    targetDays: policy.observedBaseline.targetDays,
    excludeCurrentDay: policy.observedBaseline.excludeCurrentDay,
    observedBaselineIsGoal: false,
    mutatesObservedBaseline: false,
    duplicateProductionPolicy: 'buildPersonalBaseline is the authority; downstream layers consume its public output.',
  };
}
