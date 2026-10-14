import {
  PERSONAL_BASELINE_STATUSES,
} from '../../lib/personalBaselineContract.js';
import {
  CLSE_BASELINE_DIRECTION,
  CLSE_BASELINE_FEATURES,
  CLSE_BASELINE_GRAINS,
  CLSE_BASELINE_POLICY_VERSION,
  CLSE_BASELINE_ROLE,
  CLSE_BASELINE_VERSION,
} from '../../platform/storage/clse/clseBaselineStorageContract.js';
import {
  CLSE_BASELINE_FEATURE_SCALE_FLOORS,
  CLSE_BASELINE_GRAIN_POLICIES,
  getCLSEBaselineFeatureSigma,
  resolveCLSEBaselineProfileState,
} from './clseBaselineStatePolicy.js';

const SUMMARY_KEYS = Object.freeze([
  'version',
  'policyVersion',
  'role',
  'direction',
  'resetEpoch',
  'createdAt',
  'updatedAt',
  'evaluatedAt',
  'status',
  'confidence',
  'profiles',
]);
const PROFILE_KEYS = Object.freeze([
  'grain',
  'status',
  'confidence',
  'evidence',
  'featureStats',
]);
const CONFIDENCE_KEYS = Object.freeze([
  'overall',
  'coverage',
  'exposure',
  'samples',
  'stability',
  'freshness',
]);
const EVIDENCE_KEYS = Object.freeze([
  'observedDays',
  'eligibleObservations',
  'totalActiveMs',
  'firstObservedAt',
  'lastObservedAt',
]);
const FEATURE_STAT_KEYS = Object.freeze(['sampleCount', 'mean', 'sigma']);
const GRAIN_VALUES = Object.freeze(Object.values(CLSE_BASELINE_GRAINS));
const STATUS_VALUES = Object.freeze(Object.values(PERSONAL_BASELINE_STATUSES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isUnitNumber(value) {
  return isNonNegativeNumber(value) && value <= 1;
}

function isNullableTimestamp(value) {
  return value === null || isNonNegativeInteger(value);
}

function aggregateStatus(profiles) {
  const statuses = profiles.map((profile) => profile.status);
  if (statuses.every((status) => status === PERSONAL_BASELINE_STATUSES.STABLE)) {
    return PERSONAL_BASELINE_STATUSES.STABLE;
  }
  if (statuses.some((status) => status !== PERSONAL_BASELINE_STATUSES.SPARSE)) {
    return PERSONAL_BASELINE_STATUSES.FORMING;
  }
  return PERSONAL_BASELINE_STATUSES.SPARSE;
}

function aggregateConfidence(profiles) {
  return Object.fromEntries(CONFIDENCE_KEYS.map((field) => [
    field,
    Math.min(...profiles.map((profile) => profile.confidence[field])),
  ]));
}

export function buildCLSEBaselineSummary(baseline, { evaluatedAt } = {}) {
  if (!isPositiveInteger(evaluatedAt)) {
    throw new Error('CLSE_BASELINE_SUMMARY_EVALUATED_AT_REQUIRED');
  }
  const profiles = baseline.profiles.map((profile) => {
    const projection = {
      grain: profile.grain,
      evidence: {
        observedDays: profile.observed_days,
        eligibleObservations: profile.eligible_observations,
        totalActiveMs: profile.total_active_ms,
        firstObservedAt: profile.first_observed_at,
        lastObservedAt: profile.last_observed_at,
      },
      featureStats: Object.fromEntries(CLSE_BASELINE_FEATURES.map((feature) => {
        const stats = profile.feature_stats[feature];
        return [feature, {
          sampleCount: stats.sample_count,
          mean: stats.mean,
          sigma: getCLSEBaselineFeatureSigma(feature, stats.variance),
        }];
      })),
    };
    const state = resolveCLSEBaselineProfileState(projection, evaluatedAt);
    return {
      grain: projection.grain,
      status: state.status,
      confidence: { ...state.confidence },
      evidence: projection.evidence,
      featureStats: projection.featureStats,
    };
  });
  const summary = {
    version: baseline.baseline_version,
    policyVersion: baseline.policy_version,
    role: baseline.role,
    direction: baseline.direction,
    resetEpoch: baseline.reset_epoch,
    createdAt: baseline.created_at,
    updatedAt: baseline.updated_at,
    evaluatedAt,
    status: aggregateStatus(profiles),
    confidence: aggregateConfidence(profiles),
    profiles,
  };
  return requireCanonicalCLSEBaselineSummary(summary);
}

function isCanonicalConfidence(value) {
  return hasExactKeys(value, CONFIDENCE_KEYS)
    && Object.values(value).every(isUnitNumber);
}

function isCanonicalFeatureStats(value, eligibleObservations) {
  if (!hasExactKeys(value, CLSE_BASELINE_FEATURES)) return false;
  return CLSE_BASELINE_FEATURES.every((feature) => {
    const stats = value[feature];
    return hasExactKeys(stats, FEATURE_STAT_KEYS)
      && isNonNegativeInteger(stats.sampleCount)
      && stats.sampleCount === eligibleObservations
      && isNonNegativeNumber(stats.mean)
      && isNonNegativeNumber(stats.sigma)
      && stats.sigma >= CLSE_BASELINE_FEATURE_SCALE_FLOORS[feature]
      && (
        eligibleObservations !== 0
        || (
          stats.mean === 0
          && stats.sigma === CLSE_BASELINE_FEATURE_SCALE_FLOORS[feature]
        )
      );
  });
}

function isCanonicalProfile(value, { createdAt, updatedAt, evaluatedAt }) {
  if (
    !hasExactKeys(value, PROFILE_KEYS)
    || !GRAIN_VALUES.includes(value.grain)
    || !STATUS_VALUES.includes(value.status)
    || !isCanonicalConfidence(value.confidence)
    || !hasExactKeys(value.evidence, EVIDENCE_KEYS)
  ) return false;
  const evidence = value.evidence;
  const evidenceLimits = CLSE_BASELINE_GRAIN_POLICIES[value.grain];
  const isEmpty = evidence.eligibleObservations === 0;
  return isNonNegativeInteger(evidence.observedDays)
    && isNonNegativeInteger(evidence.eligibleObservations)
    && evidence.observedDays <= evidence.eligibleObservations
    && isNonNegativeNumber(evidence.totalActiveMs)
    && isNullableTimestamp(evidence.firstObservedAt)
    && isNullableTimestamp(evidence.lastObservedAt)
    && (evidence.firstObservedAt === null) === (evidence.eligibleObservations === 0)
    && (evidence.lastObservedAt === null) === (evidence.eligibleObservations === 0)
    && (
      isEmpty
        ? evidence.observedDays === 0 && evidence.totalActiveMs === 0
        : evidence.observedDays > 0
          && evidence.totalActiveMs >= (
            evidence.eligibleObservations * evidenceLimits.minimumActiveMs
          )
          && evidence.totalActiveMs <= (
            evidence.eligibleObservations * evidenceLimits.durationMs
          )
    )
    && (
      evidence.firstObservedAt === null
      || (
        evidence.firstObservedAt >= createdAt
        && evidence.firstObservedAt <= evidence.lastObservedAt
      )
    )
    && (
      evidence.lastObservedAt === null
      || (
        evidence.lastObservedAt <= updatedAt
        && evidence.lastObservedAt <= evaluatedAt
      )
    )
    && isCanonicalFeatureStats(value.featureStats, evidence.eligibleObservations);
}

function hasCanonicalDerivedProfileState(profile, evaluatedAt) {
  try {
    const expected = resolveCLSEBaselineProfileState(profile, evaluatedAt);
    return profile.status === expected.status
      && CONFIDENCE_KEYS.every((field) => (
        profile.confidence[field] === expected.confidence[field]
      ));
  } catch (_) {
    return false;
  }
}

export function requireCanonicalCLSEBaselineSummary(
  value,
  errorCode = 'CLSE_BASELINE_SUMMARY_INVALID',
) {
  if (
    !hasExactKeys(value, SUMMARY_KEYS)
    || value.version !== CLSE_BASELINE_VERSION
    || value.policyVersion !== CLSE_BASELINE_POLICY_VERSION
    || value.role !== CLSE_BASELINE_ROLE
    || value.direction !== CLSE_BASELINE_DIRECTION
    || !isPositiveInteger(value.resetEpoch)
    || !isPositiveInteger(value.createdAt)
    || !isPositiveInteger(value.updatedAt)
    || !isPositiveInteger(value.evaluatedAt)
    || value.resetEpoch !== value.createdAt
    || value.updatedAt < value.createdAt
    || !STATUS_VALUES.includes(value.status)
    || !isCanonicalConfidence(value.confidence)
    || !Array.isArray(value.profiles)
    || value.profiles.length !== GRAIN_VALUES.length
    || value.profiles.some((profile) => !isCanonicalProfile(profile, value))
    || value.profiles.some((profile) => (
      !hasCanonicalDerivedProfileState(profile, value.evaluatedAt)
    ))
    || new Set(value.profiles.map((profile) => profile.grain)).size !== GRAIN_VALUES.length
    || !GRAIN_VALUES.every((grain) => value.profiles.some((profile) => profile.grain === grain))
    || value.status !== aggregateStatus(value.profiles)
    || CONFIDENCE_KEYS.some((field) => (
      value.confidence[field] !== aggregateConfidence(value.profiles)[field]
    ))
  ) {
    throw new Error(errorCode);
  }
  return {
    ...value,
    confidence: { ...value.confidence },
    profiles: value.profiles.map((profile) => ({
      ...profile,
      confidence: { ...profile.confidence },
      evidence: { ...profile.evidence },
      featureStats: Object.fromEntries(Object.entries(profile.featureStats).map(([
        feature,
        stats,
      ]) => [feature, { ...stats }])),
    })),
  };
}
