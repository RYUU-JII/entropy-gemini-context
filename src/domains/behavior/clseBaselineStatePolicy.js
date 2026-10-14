import {
  PERSONAL_BASELINE_STATUSES,
} from '../../lib/personalBaselineContract.js';
import {
  CLSE_BASELINE_FEATURES,
  CLSE_BASELINE_GRAINS,
  CLSE_BASELINE_GRAIN_EVIDENCE_LIMITS,
} from '../../platform/storage/clse/clseBaselineStorageContract.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CLSE_BASELINE_FEATURE_SCALE_FLOORS = Object.freeze({
  tab_switch_rate: 0.02,
  nav_rate: 0.02,
  scroll_volatility: 1,
  seek_rate: 0.01,
});

export const CLSE_BASELINE_GRAIN_POLICIES = Object.freeze({
  [CLSE_BASELINE_GRAINS.BUCKET_10S]: Object.freeze({
    ...CLSE_BASELINE_GRAIN_EVIDENCE_LIMITS[CLSE_BASELINE_GRAINS.BUCKET_10S],
    forming: Object.freeze({ observedDays: 2, samples: 12, activeMs: 60_000 }),
    stable: Object.freeze({ observedDays: 5, samples: 60, activeMs: 300_000 }),
  }),
  [CLSE_BASELINE_GRAINS.BUCKET_60S]: Object.freeze({
    ...CLSE_BASELINE_GRAIN_EVIDENCE_LIMITS[CLSE_BASELINE_GRAINS.BUCKET_60S],
    forming: Object.freeze({ observedDays: 2, samples: 6, activeMs: 180_000 }),
    stable: Object.freeze({ observedDays: 5, samples: 30, activeMs: 900_000 }),
  }),
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function requireGrainPolicy(grain) {
  const policy = CLSE_BASELINE_GRAIN_POLICIES[grain];
  if (!policy) throw new Error(`CLSE_BASELINE_GRAIN_INVALID:${String(grain)}`);
  return policy;
}

function requireFeatureScaleFloor(feature) {
  const floor = CLSE_BASELINE_FEATURE_SCALE_FLOORS[feature];
  if (!CLSE_BASELINE_FEATURES.includes(feature) || floor === undefined) {
    throw new Error(`CLSE_BASELINE_FEATURE_INVALID:${String(feature)}`);
  }
  return floor;
}

export function getCLSEBaselineFeatureSigma(feature, variance) {
  const floor = requireFeatureScaleFloor(feature);
  if (typeof variance !== 'number' || !Number.isFinite(variance) || variance < 0) {
    throw new Error(`CLSE_BASELINE_FEATURE_VARIANCE_INVALID:${String(feature)}`);
  }
  return Math.sqrt(Math.max(variance, floor * floor));
}

function getMinimumFeatureSampleCount(profile) {
  return Math.min(...CLSE_BASELINE_FEATURES.map((feature) => (
    profile.featureStats[feature].sampleCount
  )));
}

function getProfileStability(profile, sampleCount) {
  if (sampleCount < 2) return 0;
  const total = CLSE_BASELINE_FEATURES.reduce((sum, feature) => {
    const stats = profile.featureStats[feature];
    const reference = Math.max(
      Math.abs(stats.mean),
      requireFeatureScaleFloor(feature),
    );
    return sum + (1 / (1 + (stats.sigma / reference)));
  }, 0);
  return total / CLSE_BASELINE_FEATURES.length;
}

function getFreshness(lastObservedAt, evaluatedAt) {
  if (lastObservedAt === null) return 0;
  if (lastObservedAt > evaluatedAt) {
    throw new Error('CLSE_BASELINE_PROFILE_FUTURE_EVIDENCE');
  }
  const age = evaluatedAt - lastObservedAt;
  if (age <= 2 * DAY_MS) return 1;
  return clamp01(1 - ((age - (2 * DAY_MS)) / (12 * DAY_MS)));
}

function meetsEvidenceTarget(profile, target, sampleCount) {
  return profile.evidence.observedDays >= target.observedDays
    && sampleCount >= target.samples
    && profile.evidence.totalActiveMs >= target.activeMs;
}

/**
 * Derive CLSE lifecycle state exclusively from the read profile's evidence.
 * `evaluatedAt` travels with the read DTO so validation is independent of the
 * receiver's wall clock.
 */
export function resolveCLSEBaselineProfileState(profile, evaluatedAt) {
  if (!Number.isSafeInteger(evaluatedAt) || evaluatedAt <= 0) {
    throw new Error('CLSE_BASELINE_EVALUATED_AT_INVALID');
  }
  const policy = requireGrainPolicy(profile?.grain);
  const sampleCount = getMinimumFeatureSampleCount(profile);
  const confidence = {
    coverage: clamp01(profile.evidence.observedDays / policy.stable.observedDays),
    exposure: clamp01(profile.evidence.totalActiveMs / policy.stable.activeMs),
    samples: clamp01(sampleCount / policy.stable.samples),
    stability: clamp01(getProfileStability(profile, sampleCount)),
    freshness: getFreshness(profile.evidence.lastObservedAt, evaluatedAt),
  };
  confidence.overall = (
    confidence.coverage
    + confidence.exposure
    + confidence.samples
    + confidence.stability
    + confidence.freshness
  ) / 5;

  const stable = confidence.freshness > 0
    && meetsEvidenceTarget(profile, policy.stable, sampleCount);
  const forming = meetsEvidenceTarget(profile, policy.forming, sampleCount);
  return {
    status: stable
      ? PERSONAL_BASELINE_STATUSES.STABLE
      : forming
        ? PERSONAL_BASELINE_STATUSES.FORMING
        : PERSONAL_BASELINE_STATUSES.SPARSE,
    confidence,
  };
}
