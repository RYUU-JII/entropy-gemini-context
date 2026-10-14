import {
  PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_ROLES,
  PERSONAL_BASELINE_STATUSES,
} from '../../../../lib/personalBaselineContract.js';

export const BASIC_RECENT_USAGE_TRAJECTORY_VERSION = 'basic-protection-recent-trajectory-v1';
export const BASIC_TARGET_RECOMMENDATION_VERSION = 'basic-target-recommendation-v2';
export const BASIC_RECENT_USAGE_WINDOW_DAYS = 7;
export const BASIC_RECENT_USAGE_FORMING_DAYS = 3;
export const BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES = 30;
export const BASIC_TARGET_MAX_RECOMMENDED_MINUTES = 180;

export const BASIC_TARGET_RECOMMENDATION_SOURCES = Object.freeze({
  NORMATIVE_DEFAULT: 'normative_default',
  RECENT_USAGE_TRAJECTORY: 'recent_usage_trajectory',
  CURRENT_PARTIAL_DAY: 'current_partial_day',
});
export const BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE = (
  BASIC_TARGET_RECOMMENDATION_SOURCES.NORMATIVE_DEFAULT
);

const RECOMMENDATION_SOURCE_SET = new Set(Object.values(BASIC_TARGET_RECOMMENDATION_SOURCES));

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isObjectRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isCanonicalDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function shiftDateStr(dateStr, offsetDays) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function numbersEqual(left, right) {
  if (left === right) return true;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * scale * 16;
}

function nullableNumbersEqual(left, right) {
  if (left === null || right === null) return left === right;
  return numbersEqual(left, right);
}

function toPositiveIntegerMinutes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const minutes = Math.floor(value);
  return minutes > 0 ? minutes : 0;
}

function resolveBasicUncappedTargetMinutes(anchorMinutes) {
  if (anchorMinutes <= 0) return BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES;
  if (anchorMinutes < 20) return 15;
  if (anchorMinutes < 45) return Math.round(anchorMinutes * 0.85);
  if (anchorMinutes < 90) return Math.round(anchorMinutes * 0.8);
  return Math.round(anchorMinutes * 0.75);
}

export function deriveBasicTargetRecommendationRelation({
  recentUsageAverageDailyMs,
  currentPartialDayMinutes,
} = {}) {
  if (recentUsageAverageDailyMs !== null
    && (typeof recentUsageAverageDailyMs !== 'number'
      || !Number.isFinite(recentUsageAverageDailyMs)
      || recentUsageAverageDailyMs < 0)) {
    throw new Error('BASIC_TARGET_RECOMMENDATION_RECENT_USAGE_AVERAGE_INVALID');
  }
  if (typeof currentPartialDayMinutes !== 'number'
    || !Number.isFinite(currentPartialDayMinutes)
    || currentPartialDayMinutes < 0) {
    throw new Error('BASIC_TARGET_RECOMMENDATION_TODAY_MINUTES_INVALID');
  }

  const recentUsageAnchorMinutes = toPositiveIntegerMinutes(
    recentUsageAverageDailyMs === null ? 0 : recentUsageAverageDailyMs / 60_000,
  );
  const currentPartialDayAnchorMinutes = toPositiveIntegerMinutes(currentPartialDayMinutes);
  const anchorMinutes = Math.max(
    recentUsageAnchorMinutes,
    currentPartialDayAnchorMinutes,
  );
  let source = BASIC_TARGET_RECOMMENDATION_SOURCES.NORMATIVE_DEFAULT;
  if (anchorMinutes > 0) {
    source = currentPartialDayAnchorMinutes > recentUsageAnchorMinutes
      ? BASIC_TARGET_RECOMMENDATION_SOURCES.CURRENT_PARTIAL_DAY
      : BASIC_TARGET_RECOMMENDATION_SOURCES.RECENT_USAGE_TRAJECTORY;
  }
  const uncappedRecommendedTargetMinutes = resolveBasicUncappedTargetMinutes(anchorMinutes);
  const recommendedTargetMinutes = Math.min(
    uncappedRecommendedTargetMinutes,
    BASIC_TARGET_MAX_RECOMMENDED_MINUTES,
  );
  return {
    recentUsageAverageDailyMs,
    currentPartialDayMinutes,
    source,
    referenceMode: source === BASIC_TARGET_RECOMMENDATION_SOURCES.NORMATIVE_DEFAULT
      ? PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY
      : PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE,
    recommendedTargetMinutes,
    uncappedRecommendedTargetMinutes,
    capApplied: recommendedTargetMinutes !== uncappedRecommendedTargetMinutes,
  };
}

export function resolveBasicRecentUsageStatus(observedDays) {
  if (observedDays >= BASIC_RECENT_USAGE_WINDOW_DAYS) return PERSONAL_BASELINE_STATUSES.STABLE;
  if (observedDays >= BASIC_RECENT_USAGE_FORMING_DAYS) return PERSONAL_BASELINE_STATUSES.FORMING;
  return PERSONAL_BASELINE_STATUSES.SPARSE;
}

export function requireBasicRecentUsageTrajectory(value) {
  if (!hasExactKeys(value, [
    'version',
    'role',
    'grain',
    'status',
    'provenance',
    'window',
    'evidence',
    'averageDailyMs',
    'observations',
  ])) throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_SHAPE_INVALID');
  if (value.version !== BASIC_RECENT_USAGE_TRAJECTORY_VERSION
    || value.role !== PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY
    || value.grain !== PERSONAL_BASELINE_METRIC_GRAINS.DAY) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_IDENTITY_INVALID');
  }
  if (!hasExactKeys(value.provenance, ['source', 'windowBasis', 'excludeCurrent'])
    || value.provenance.source !== 'stats_dates_domain_active'
    || !['completed_calendar_days', 'completed_activity_days'].includes(value.provenance.windowBasis)
    || value.provenance.excludeCurrent !== true) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_PROVENANCE_INVALID');
  }
  if (!hasExactKeys(value.window, [
    'currentDateStr',
    'startDateStr',
    'endDateStr',
    'targetDays',
  ])
    || !isCanonicalDateStr(value.window.currentDateStr)
    || !isCanonicalDateStr(value.window.startDateStr)
    || !isCanonicalDateStr(value.window.endDateStr)
    || value.window.targetDays !== BASIC_RECENT_USAGE_WINDOW_DAYS
    || value.window.startDateStr !== shiftDateStr(
      value.window.currentDateStr,
      -BASIC_RECENT_USAGE_WINDOW_DAYS,
    )
    || value.window.endDateStr !== shiftDateStr(value.window.currentDateStr, -1)) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_WINDOW_INVALID');
  }
  if (!Array.isArray(value.observations)
    || value.observations.length !== BASIC_RECENT_USAGE_WINDOW_DAYS) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_OBSERVATIONS_INVALID');
  }
  let observedDays = 0;
  let zeroDays = 0;
  let positiveDays = 0;
  let exceededDays = 0;
  let activeTotalMs = 0;
  value.observations.forEach((observation, index) => {
    if (!hasExactKeys(observation, ['dateStr', 'observed', 'activeMs', 'exceeded'])) {
      throw new Error(`BASIC_RECENT_USAGE_OBSERVATION_SHAPE_INVALID:${index}`);
    }
    const expectedDateStr = shiftDateStr(value.window.startDateStr, index);
    if (observation.dateStr !== expectedDateStr || typeof observation.observed !== 'boolean') {
      throw new Error(`BASIC_RECENT_USAGE_OBSERVATION_IDENTITY_INVALID:${index}`);
    }
    if (!observation.observed) {
      if (observation.activeMs !== null || observation.exceeded !== false) {
        throw new Error(`BASIC_RECENT_USAGE_OBSERVATION_MISSING_RELATION_INVALID:${index}`);
      }
      return;
    }
    if (typeof observation.activeMs !== 'number'
      || !Number.isFinite(observation.activeMs)
      || observation.activeMs < 0
      || typeof observation.exceeded !== 'boolean') {
      throw new Error(`BASIC_RECENT_USAGE_OBSERVATION_VALUE_INVALID:${index}`);
    }
    observedDays += 1;
    activeTotalMs += observation.activeMs;
    if (observation.activeMs === 0) zeroDays += 1;
    else positiveDays += 1;
    if (observation.exceeded) exceededDays += 1;
  });
  if (!hasExactKeys(value.evidence, [
    'observedDays',
    'missingDays',
    'zeroDays',
    'positiveDays',
    'exceededDays',
    'thresholdMs',
  ])) throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_EVIDENCE_SHAPE_INVALID');
  if (typeof value.evidence.thresholdMs !== 'number'
    || !Number.isFinite(value.evidence.thresholdMs)
    || value.evidence.thresholdMs < 0) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_THRESHOLD_INVALID');
  }
  const expectedExceededDays = value.observations.filter((observation) => (
    observation.observed
    && value.evidence.thresholdMs > 0
    && observation.activeMs > value.evidence.thresholdMs
  )).length;
  if (value.evidence.observedDays !== observedDays
    || value.evidence.missingDays !== BASIC_RECENT_USAGE_WINDOW_DAYS - observedDays
    || value.evidence.zeroDays !== zeroDays
    || value.evidence.positiveDays !== positiveDays
    || value.evidence.exceededDays !== exceededDays
    || exceededDays !== expectedExceededDays
    || value.status !== resolveBasicRecentUsageStatus(observedDays)) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_EVIDENCE_RELATION_INVALID');
  }
  const expectedAverageDailyMs = observedDays > 0 ? activeTotalMs / observedDays : null;
  if (expectedAverageDailyMs === null
    ? value.averageDailyMs !== null
    : typeof value.averageDailyMs !== 'number'
      || !Number.isFinite(value.averageDailyMs)
      || !numbersEqual(value.averageDailyMs, expectedAverageDailyMs)) {
    throw new Error('BASIC_RECENT_USAGE_TRAJECTORY_AVERAGE_RELATION_INVALID');
  }
  return value;
}

export function requireBasicTargetRecommendation(value) {
  if (!hasExactKeys(value, [
    'version',
    'role',
    'referenceMode',
    'source',
    'inputRole',
    'inputVersion',
    'recentUsageAverageDailyMs',
    'currentPartialDayMinutes',
    'recommendedTargetMinutes',
    'uncappedRecommendedTargetMinutes',
    'maxRecommendedTargetMinutes',
    'capApplied',
    'normativeDefaultTargetMinutes',
    'normativeDefaultSource',
    'requiresUserReview',
    'autoApply',
  ])) throw new Error('BASIC_TARGET_RECOMMENDATION_SHAPE_INVALID');
  if (value.version !== BASIC_TARGET_RECOMMENDATION_VERSION
    || value.role !== PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE
    || value.inputRole !== PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY
    || value.inputVersion !== BASIC_RECENT_USAGE_TRAJECTORY_VERSION
    || !RECOMMENDATION_SOURCE_SET.has(value.source)
    || !Number.isInteger(value.recommendedTargetMinutes)
    || value.recommendedTargetMinutes <= 0
    || !Number.isInteger(value.uncappedRecommendedTargetMinutes)
    || value.uncappedRecommendedTargetMinutes <= 0
    || !Number.isInteger(value.maxRecommendedTargetMinutes)
    || value.maxRecommendedTargetMinutes !== BASIC_TARGET_MAX_RECOMMENDED_MINUTES
    || typeof value.capApplied !== 'boolean'
    || !Number.isInteger(value.normativeDefaultTargetMinutes)
    || value.normativeDefaultTargetMinutes !== BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES
    || value.normativeDefaultSource !== BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE
    || value.requiresUserReview !== true
    || value.autoApply !== false) {
    throw new Error('BASIC_TARGET_RECOMMENDATION_IDENTITY_INVALID');
  }
  const normativeOnly = value.source === BASIC_TARGET_RECOMMENDATION_SOURCES.NORMATIVE_DEFAULT;
  const expected = deriveBasicTargetRecommendationRelation({
    recentUsageAverageDailyMs: value.recentUsageAverageDailyMs,
    currentPartialDayMinutes: value.currentPartialDayMinutes,
  });
  if (value.source !== expected.source
    || value.referenceMode !== expected.referenceMode
    || value.recommendedTargetMinutes !== expected.recommendedTargetMinutes
    || value.uncappedRecommendedTargetMinutes !== expected.uncappedRecommendedTargetMinutes
    || value.capApplied !== expected.capApplied
    || value.normativeDefaultTargetMinutes > value.maxRecommendedTargetMinutes
    || (normativeOnly
      && (value.uncappedRecommendedTargetMinutes !== value.normativeDefaultTargetMinutes
        || value.recommendedTargetMinutes !== value.normativeDefaultTargetMinutes
        || value.capApplied))) {
    throw new Error('BASIC_TARGET_RECOMMENDATION_RELATION_INVALID');
  }
  return value;
}

export function requireBasicTargetRecommendationForTrajectory(value, recentUsageTrajectory) {
  const trajectory = requireBasicRecentUsageTrajectory(recentUsageTrajectory);
  const recommendation = requireBasicTargetRecommendation(value);
  if (!nullableNumbersEqual(
    recommendation.recentUsageAverageDailyMs,
    trajectory.averageDailyMs,
  )) {
    throw new Error('BASIC_TARGET_RECOMMENDATION_TRAJECTORY_RELATION_INVALID');
  }
  return recommendation;
}
