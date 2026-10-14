import {
  PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_ROLES,
  PERSONAL_BASELINE_STATUSES,
} from '../../../lib/personalBaselineContract.js';

const MINUTE_MS = 60_000;
const DATE_STR_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const RECENT_TRAJECTORY_KEYS = Object.freeze([
  'version',
  'role',
  'status',
  'grain',
  'windowBasis',
  'windowDays',
  'excludeCurrent',
  'observedDays',
  'missingDays',
  'activeDays',
  'totalMs',
  'activeDayAverageMs',
  'observations',
]);
const RECENT_TRAJECTORY_OBSERVATION_KEYS = Object.freeze([
  'dateStr',
  'observed',
  'activeMs',
]);

export const SCORE_SETUP_RECOMMENDATION_POLICY_VERSION = 'score_setup_recent_active_days_v1';
export const SCORE_SETUP_RECENT_TRAJECTORY_VERSION = 'score_setup_recent_trajectory_v2';

export const SCORE_SETUP_RECOMMENDATION_STATUS = Object.freeze({
  READY: 'ready',
  OBSERVING: 'observing',
});

export const SCORE_SETUP_RECOMMENDATION_MODE = Object.freeze({
  REVIEW_DRAFT: 'review_draft',
  OBSERVE_ONLY: 'observe_only',
});

export const SCORE_SETUP_RECOMMENDATION_REASON = Object.freeze({
  SUFFICIENT_RECENT_TRAJECTORY: 'sufficient_recent_trajectory',
  INSUFFICIENT_ACTIVE_DAYS: 'insufficient_active_days',
  INSUFFICIENT_TOTAL_MINUTES: 'insufficient_total_minutes',
  INSUFFICIENT_ACTIVE_DAYS_AND_TOTAL_MINUTES: 'insufficient_active_days_and_total_minutes',
});

export const SCORE_SETUP_RECOMMENDATION_POLICY = Object.freeze({
  VERSION: SCORE_SETUP_RECOMMENDATION_POLICY_VERSION,
  RECENT_WINDOW_DAYS: 7,
  MIN_ACTIVE_DAYS: 3,
  MIN_TOTAL_MINUTES: 45,
  MAX_RECOMMENDATIONS: 5,
  TARGET_MULTIPLIER: 0.85,
  MIN_SUGGESTED_MINUTES: 10,
  MAX_SUGGESTED_MINUTES: 180,
  SUGGESTED_MINUTE_STEP: 5,
  CONFIDENCE_ACTIVE_DAYS_TARGET: 5,
  CONFIDENCE_TOTAL_MINUTES_TARGET: 180,
  CONFIDENCE_ACTIVE_DAYS_WEIGHT: 0.72,
  CONFIDENCE_TOTAL_MINUTES_WEIGHT: 0.28,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeDomain = (value) => (
  typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : ''
);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const roundNumber = (value, digits = 3, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric.toFixed(digits));
};

const requireExactKeys = (value, keys, errorCode) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(errorCode);
  }
};

const hasExactTrajectoryValue = (trajectory, canonical) => (
  RECENT_TRAJECTORY_KEYS.every((field) => {
    if (field !== 'observations') return Object.is(trajectory[field], canonical[field]);
    return trajectory.observations.length === canonical.observations.length
      && trajectory.observations.every((observation, index) => (
        RECENT_TRAJECTORY_OBSERVATION_KEYS.every((key) => (
          Object.is(observation[key], canonical.observations[index][key])
        ))
      ));
  })
);

const parseDateStr = (value, field) => {
  if (typeof value !== 'string' || !DATE_STR_PATTERN.test(value)) {
    throw new Error(`SCORE_SETUP_RECENT_TRAJECTORY_${field.toUpperCase()}_INVALID`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day) {
    throw new Error(`SCORE_SETUP_RECENT_TRAJECTORY_${field.toUpperCase()}_INVALID`);
  }
  return { value, epochMs: parsed.getTime() };
};

const resolveTrajectoryStatus = ({ activeDays, totalMs }) => {
  if (activeDays >= SCORE_SETUP_RECOMMENDATION_POLICY.MIN_ACTIVE_DAYS
    && totalMs / MINUTE_MS >= SCORE_SETUP_RECOMMENDATION_POLICY.MIN_TOTAL_MINUTES) {
    return PERSONAL_BASELINE_STATUSES.STABLE;
  }
  return activeDays > 0
    ? PERSONAL_BASELINE_STATUSES.FORMING
    : PERSONAL_BASELINE_STATUSES.SPARSE;
};

export function buildScoreSetupRecentTrajectory({
  observations,
  currentDateStr,
} = {}) {
  const currentDate = parseDateStr(currentDateStr, 'current_date');
  if (!Array.isArray(observations)
    || observations.length !== SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS) {
    throw new Error('SCORE_SETUP_RECENT_TRAJECTORY_WINDOW_INVALID');
  }

  let previousDateStr = '';
  let observedDays = 0;
  let activeDays = 0;
  let totalMs = 0;
  observations.forEach((observation, index) => {
    requireExactKeys(
      observation,
      RECENT_TRAJECTORY_OBSERVATION_KEYS,
      'SCORE_SETUP_RECENT_TRAJECTORY_OBSERVATION_SHAPE_INVALID',
    );
    const date = parseDateStr(observation.dateStr, `date_${index}`);
    const expectedEpochMs = currentDate.epochMs
      - ((SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS - index) * 86_400_000);
    if (date.epochMs !== expectedEpochMs
      || (previousDateStr && date.value <= previousDateStr)) {
      throw new Error('SCORE_SETUP_RECENT_TRAJECTORY_COMPLETED_DAY_ORDER_INVALID');
    }
    previousDateStr = date.value;
    if (typeof observation.observed !== 'boolean') {
      throw new Error('SCORE_SETUP_RECENT_TRAJECTORY_OBSERVED_INVALID');
    }
    const activeMs = observation.activeMs;
    if (observation.observed
      && (typeof activeMs !== 'number' || !Number.isFinite(activeMs) || activeMs < 0)) {
      throw new Error('SCORE_SETUP_RECENT_TRAJECTORY_ACTIVE_MS_INVALID');
    }
    if (!observation.observed && activeMs !== null) {
      throw new Error('SCORE_SETUP_RECENT_TRAJECTORY_MISSING_DAY_VALUE_INVALID');
    }
    if (!observation.observed) return;
    observedDays += 1;
    totalMs += activeMs;
    if (activeMs > 0) activeDays += 1;
  });

  return {
    version: SCORE_SETUP_RECENT_TRAJECTORY_VERSION,
    role: PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
    status: resolveTrajectoryStatus({ activeDays, totalMs }),
    grain: PERSONAL_BASELINE_METRIC_GRAINS.DAY,
    windowBasis: 'completed_day',
    windowDays: SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS,
    excludeCurrent: true,
    observedDays,
    missingDays: observations.length - observedDays,
    activeDays,
    totalMs,
    activeDayAverageMs: activeDays > 0 ? totalMs / activeDays : 0,
    observations: observations.map((observation) => ({
      dateStr: observation.dateStr,
      observed: observation.observed,
      activeMs: observation.activeMs,
    })),
  };
}

const roundToSuggestedMinuteStep = (minutes) => {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('SCORE_SETUP_DRAFT_INPUT_INVALID');
  }
  return clamp(
    Math.max(1, Math.round(
      numeric / SCORE_SETUP_RECOMMENDATION_POLICY.SUGGESTED_MINUTE_STEP,
    )) * SCORE_SETUP_RECOMMENDATION_POLICY.SUGGESTED_MINUTE_STEP,
    SCORE_SETUP_RECOMMENDATION_POLICY.MIN_SUGGESTED_MINUTES,
    SCORE_SETUP_RECOMMENDATION_POLICY.MAX_SUGGESTED_MINUTES,
  );
};

const requireTrajectoryNumber = (trajectory, field, domain, { integer = false } = {}) => {
  if (!hasOwn(trajectory, field)) {
    throw new Error(`SCORE_SETUP_CANDIDATE_TRAJECTORY_${field.toUpperCase()}_MISSING:${domain}`);
  }
  const value = trajectory[field];
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || (integer && !Number.isInteger(value))) {
    throw new Error(`SCORE_SETUP_CANDIDATE_TRAJECTORY_${field.toUpperCase()}_INVALID:${domain}`);
  }
  return value;
};

const requireScoreSetupRecentTrajectory = (candidate, domain) => {
  if (!hasOwn(candidate, 'scoreSetupRecentTrajectory')) {
    throw new Error(`SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_MISSING:${domain}`);
  }
  const trajectory = candidate.scoreSetupRecentTrajectory;
  if (!trajectory || typeof trajectory !== 'object' || Array.isArray(trajectory)) {
    throw new Error(`SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_INVALID:${domain}`);
  }
  requireExactKeys(
    trajectory,
    RECENT_TRAJECTORY_KEYS,
    `SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_SHAPE_INVALID:${domain}`,
  );
  if (trajectory.version !== SCORE_SETUP_RECENT_TRAJECTORY_VERSION
    || trajectory.role !== PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY
    || !Object.values(PERSONAL_BASELINE_STATUSES).includes(trajectory.status)
    || trajectory.grain !== PERSONAL_BASELINE_METRIC_GRAINS.DAY
    || trajectory.windowBasis !== 'completed_day'
    || trajectory.windowDays !== SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS
    || trajectory.excludeCurrent !== true) {
    throw new Error(`SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_IDENTITY_INVALID:${domain}`);
  }
  const observedDays = requireTrajectoryNumber(trajectory, 'observedDays', domain, { integer: true });
  const missingDays = requireTrajectoryNumber(trajectory, 'missingDays', domain, { integer: true });
  const activeDays = requireTrajectoryNumber(trajectory, 'activeDays', domain, { integer: true });
  const totalMs = requireTrajectoryNumber(trajectory, 'totalMs', domain);
  const activeDayAverageMs = requireTrajectoryNumber(trajectory, 'activeDayAverageMs', domain);
  const expectedStatus = resolveTrajectoryStatus({ activeDays, totalMs });
  if (observedDays + missingDays !== SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS
    || activeDays > observedDays
    || (activeDays === 0) !== (totalMs === 0)
    || Math.abs(activeDayAverageMs - (activeDays > 0 ? totalMs / activeDays : 0)) > 1e-6
    || trajectory.status !== expectedStatus) {
    throw new Error(`SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_RELATION_INVALID:${domain}`);
  }

  let canonicalTrajectory;
  try {
    const finalObservation = trajectory.observations.at(-1);
    const finalDate = parseDateStr(finalObservation?.dateStr, 'final_date');
    canonicalTrajectory = buildScoreSetupRecentTrajectory({
      observations: trajectory.observations,
      currentDateStr: new Date(finalDate.epochMs + 86_400_000).toISOString().slice(0, 10),
    });
  } catch (cause) {
    const error = new Error(`SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_EVIDENCE_INVALID:${domain}`);
    error.cause = cause;
    throw error;
  }
  if (!hasExactTrajectoryValue(trajectory, canonicalTrajectory)) {
    throw new Error(`SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_DERIVATION_MISMATCH:${domain}`);
  }
  return trajectory;
};

const resolveRecommendationReason = ({ activeDays, totalMinutes }) => {
  const hasEnoughActiveDays = activeDays >= SCORE_SETUP_RECOMMENDATION_POLICY.MIN_ACTIVE_DAYS;
  const hasEnoughTotalMinutes = totalMinutes >= SCORE_SETUP_RECOMMENDATION_POLICY.MIN_TOTAL_MINUTES;
  if (hasEnoughActiveDays && hasEnoughTotalMinutes) {
    return SCORE_SETUP_RECOMMENDATION_REASON.SUFFICIENT_RECENT_TRAJECTORY;
  }
  if (!hasEnoughActiveDays && !hasEnoughTotalMinutes) {
    return SCORE_SETUP_RECOMMENDATION_REASON.INSUFFICIENT_ACTIVE_DAYS_AND_TOTAL_MINUTES;
  }
  return hasEnoughActiveDays
    ? SCORE_SETUP_RECOMMENDATION_REASON.INSUFFICIENT_TOTAL_MINUTES
    : SCORE_SETUP_RECOMMENDATION_REASON.INSUFFICIENT_ACTIVE_DAYS;
};

const buildRecommendationProvenance = () => ({
  policyVersion: SCORE_SETUP_RECOMMENDATION_POLICY.VERSION,
  source: 'stats_dates_domain_active',
  via: 'sites_domain_candidate',
  sourceField: 'scoreSetupRecentTrajectory',
  sourceVersion: SCORE_SETUP_RECENT_TRAJECTORY_VERSION,
  windowDays: SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS,
  windowBasis: 'completed_day',
  excludeCurrent: true,
  aggregation: 'active_day_arithmetic_mean',
  inputRole: PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
  outputRole: PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE,
  requiresUserReview: true,
  autoApply: false,
});

const buildRecommendation = (candidate = {}) => {
  const domain = normalizeDomain(candidate?.domain);
  if (!domain) return null;

  const recentTrajectory = requireScoreSetupRecentTrajectory(candidate, domain);
  const activeDays = recentTrajectory.activeDays;
  const totalMinutes = recentTrajectory.totalMs / MINUTE_MS;
  const activeDayAverageMinutes = recentTrajectory.activeDayAverageMs / MINUTE_MS;
  const ready = recentTrajectory.status === PERSONAL_BASELINE_STATUSES.STABLE;
  const suggestedMinutes = ready
    ? roundToSuggestedMinuteStep(
      activeDayAverageMinutes * SCORE_SETUP_RECOMMENDATION_POLICY.TARGET_MULTIPLIER,
    )
    : null;
  const confidence = ready
    ? clamp(
      (Math.min(activeDays, SCORE_SETUP_RECOMMENDATION_POLICY.CONFIDENCE_ACTIVE_DAYS_TARGET)
        / SCORE_SETUP_RECOMMENDATION_POLICY.CONFIDENCE_ACTIVE_DAYS_TARGET
        * SCORE_SETUP_RECOMMENDATION_POLICY.CONFIDENCE_ACTIVE_DAYS_WEIGHT)
      + (Math.min(totalMinutes, SCORE_SETUP_RECOMMENDATION_POLICY.CONFIDENCE_TOTAL_MINUTES_TARGET)
        / SCORE_SETUP_RECOMMENDATION_POLICY.CONFIDENCE_TOTAL_MINUTES_TARGET
        * SCORE_SETUP_RECOMMENDATION_POLICY.CONFIDENCE_TOTAL_MINUTES_WEIGHT),
      0,
      1,
    )
    : 0;

  return {
    domain,
    role: PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE,
    status: ready
      ? SCORE_SETUP_RECOMMENDATION_STATUS.READY
      : SCORE_SETUP_RECOMMENDATION_STATUS.OBSERVING,
    referenceMode: ready
      ? PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE
      : PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY,
    workflowMode: ready
      ? SCORE_SETUP_RECOMMENDATION_MODE.REVIEW_DRAFT
      : SCORE_SETUP_RECOMMENDATION_MODE.OBSERVE_ONLY,
    reason: resolveRecommendationReason({ activeDays, totalMinutes }),
    provenance: buildRecommendationProvenance(),
    suggestedMinutes,
    activeDays,
    observedMinutes: roundNumber(totalMinutes, 1, 0),
    activeDayAverageMinutes: roundNumber(activeDayAverageMinutes, 1, 0),
    confidence: roundNumber(confidence, 3, 0),
    basis: 'recent_active_days',
  };
};

export function buildScoreSetupRecommendations({
  domainCandidates = [],
  siteGoals = {},
  includeUnmanaged = false,
  maxRecommendations = SCORE_SETUP_RECOMMENDATION_POLICY.MAX_RECOMMENDATIONS,
} = {}) {
  if (!Array.isArray(domainCandidates)) {
    throw new Error('SCORE_SETUP_DOMAIN_CANDIDATES_INVALID');
  }
  if (!siteGoals || typeof siteGoals !== 'object' || Array.isArray(siteGoals)) {
    throw new Error('SCORE_SETUP_SITE_GOALS_INVALID');
  }
  if (typeof maxRecommendations !== 'number'
    || !Number.isInteger(maxRecommendations)
    || maxRecommendations <= 0) {
    throw new Error('SCORE_SETUP_MAX_RECOMMENDATIONS_INVALID');
  }
  const seenDomains = new Set();
  domainCandidates.forEach((candidate, index) => {
    const domain = normalizeDomain(candidate?.domain);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !domain) {
      throw new Error(`SCORE_SETUP_DOMAIN_CANDIDATE_INVALID:${index}`);
    }
    if (typeof candidate.managed !== 'boolean') {
      throw new Error(`SCORE_SETUP_DOMAIN_CANDIDATE_MANAGED_INVALID:${domain}`);
    }
    if (seenDomains.has(domain)) {
      throw new Error(`SCORE_SETUP_DOMAIN_CANDIDATE_DUPLICATE:${domain}`);
    }
    seenDomains.add(domain);
  });
  const candidates = domainCandidates;
  const targetCount = maxRecommendations;
  const recommendations = candidates
    .filter((candidate) => {
      const domain = normalizeDomain(candidate?.domain);
      if (!domain || hasOwn(siteGoals, domain)) return false;
      if (candidate?.managed === true) return true;
      return includeUnmanaged === true;
    })
    .map(buildRecommendation)
    .filter(Boolean)
    .sort((left, right) => {
      if (right.status !== left.status) {
        return right.status === SCORE_SETUP_RECOMMENDATION_STATUS.READY ? 1 : -1;
      }
      const observedDiff = right.observedMinutes - left.observedMinutes;
      if (observedDiff !== 0) return observedDiff;
      const dayDiff = right.activeDays - left.activeDays;
      if (dayDiff !== 0) return dayDiff;
      return left.domain.localeCompare(right.domain);
    });
  const ready = recommendations
    .filter((entry) => entry.status === SCORE_SETUP_RECOMMENDATION_STATUS.READY)
    .slice(0, targetCount);
  const observing = recommendations
    .filter((entry) => entry.status === SCORE_SETUP_RECOMMENDATION_STATUS.OBSERVING)
    .slice(0, targetCount);

  return {
    policy: { ...SCORE_SETUP_RECOMMENDATION_POLICY },
    ready,
    observing,
    readyCount: ready.length,
    observingCount: observing.length,
    candidateCount: recommendations.length,
  };
}

export default buildScoreSetupRecommendations;
