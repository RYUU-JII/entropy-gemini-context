import {
  PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_STATUSES,
} from '../../../../lib/personalBaselineContract.js';

export const FEED_TEMPO_EPISODE_VERSION = 2;
export const FEED_TEMPO_PROFILE_VERSION = 2;
export const FEED_TEMPO_SNAPSHOT_VERSION = 3;

export const FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS = 2_000;
export const FEED_TEMPO_DWELL_RETENTION_STRATEGY = 'ordered_tail';
export const FEED_TEMPO_DWELL_DISTRIBUTION_VERSION = 1;
export const FEED_TEMPO_DWELL_DISTRIBUTION_SEMANTICS = 'exclusive_upper_bound';
export const FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS = Object.freeze([
  500,
  1_000,
  2_000,
  3_000,
  4_500,
  8_000,
  15_000,
  30_000,
  60_000,
  120_000,
  300_001,
]);

export const FEED_TEMPO_STATES = Object.freeze({
  INACTIVE: 'inactive',
  ARMED_IDLE: 'armed_idle',
  INSUFFICIENT: 'insufficient',
  MEASURED: 'measured',
  INVALID: 'invalid',
});

export const FEED_TEMPO_PROFILE_STATUSES = PERSONAL_BASELINE_STATUSES;

export const FEED_TEMPO_REFERENCE_MODES = PERSONAL_BASELINE_REFERENCE_MODES;
export const FEED_TEMPO_METRIC_GRAIN = PERSONAL_BASELINE_METRIC_GRAINS.PAGED_ITEM_DWELL;
export const FEED_TEMPO_CONTINUOUS_METRIC_GRAIN =
  PERSONAL_BASELINE_METRIC_GRAINS.CONTINUOUS_SESSION_SCREENFULS;

export const FEED_TEMPO_INTERVENTION_STATES = Object.freeze({
  UNASSISTED: 'unassisted',
  CANDIDATE: 'candidate',
  EXPOSED: 'exposed',
});

export const FEED_TEMPO_COMPLETION_REASONS = Object.freeze([
  'idle_timeout',
  'visibility_hidden',
  'surface_change',
  'mode_change',
  'runtime_stop',
  'explicit_flush',
]);

const SURFACE_MODES = new Set(['continuous', 'paged', 'hybrid', 'document', 'unknown']);
const CONTENT_FREE_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const FEED_TEMPO_STATE_SET = new Set(Object.values(FEED_TEMPO_STATES));
const PROFILE_STATUS_SET = new Set(Object.values(FEED_TEMPO_PROFILE_STATUSES));
const REFERENCE_MODE_SET = new Set(Object.values(FEED_TEMPO_REFERENCE_MODES));
const REFERENCE_SOURCE_SET = new Set(['normative', 'domain_surface']);
const DIRECTION_SET = new Set(['unknown', 'faster', 'typical', 'slower']);
const AMOUNT_COMPARISON_SET = new Set([
  'unavailable',
  'below_reference',
  'at_reference',
  'above_reference',
]);
const METRIC_GRAIN_SET = new Set([
  FEED_TEMPO_METRIC_GRAIN,
  FEED_TEMPO_CONTINUOUS_METRIC_GRAIN,
]);
const COST_MEASUREMENT_STATE_SET = new Set(['armed_idle', 'measured']);
const CHECKPOINT_STATE_SET = new Set([
  'disabled',
  'inactive',
  'restoring',
  'ready',
  'updating',
  'failed',
]);
export const EPISODE_FACT_KEYS = Object.freeze([
  'version',
  'metricGrain',
  'surface',
  'startedAt',
  'endedAt',
  'completionReason',
  'interventionState',
  'transitionCount',
  'screenfulsConsumed',
  'eligibleDwellCount',
  'censoredDwellCount',
  'dwellEligibility',
  'retention',
  'censoring',
  'dwellSamplesMs',
  'dwellDistribution',
  'retainedActiveDwellMs',
  'totalActiveDwellMs',
  'medianDwellMs',
  'lowerQuartileDwellMs',
  'upperQuartileDwellMs',
  'rapidDwellThresholdMs',
  'rapidDwellCount',
  'rapidDwellShare',
  'transitionsPerMinute',
  'backwardIntentCount',
  'maximumBacktrackRatio',
  'revisitCount',
  'mediaEngagedMs',
  'measurementConfidence',
  'eligibleForObservedBaseline',
]);

function requireObject(value, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireExactKeys(value, expectedKeys, errorCode) {
  const source = requireObject(value, errorCode);
  const actual = Object.keys(source).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(errorCode);
  }
  return source;
}

export function createFeedTempoDwellDistribution() {
  return {
    version: FEED_TEMPO_DWELL_DISTRIBUTION_VERSION,
    bucketSemantics: FEED_TEMPO_DWELL_DISTRIBUTION_SEMANTICS,
    exclusiveUpperBoundsMs: [...FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS],
    counts: FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS.map(() => 0),
    overflowCount: 0,
  };
}

export function recordFeedTempoDwellInDistribution(distribution, dwellMs) {
  const value = Number(dwellMs);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('FEED_TEMPO_DWELL_DISTRIBUTION_SAMPLE_INVALID');
  }
  const bucketIndex = FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS.findIndex(
    (upperBoundMs) => value < upperBoundMs,
  );
  if (bucketIndex === -1) distribution.overflowCount += 1;
  else distribution.counts[bucketIndex] += 1;
  return distribution;
}

export function buildFeedTempoDwellDistribution(dwellSamplesMs) {
  if (!Array.isArray(dwellSamplesMs)) {
    throw new Error('FEED_TEMPO_DWELL_DISTRIBUTION_SAMPLES_REQUIRED');
  }
  const distribution = createFeedTempoDwellDistribution();
  dwellSamplesMs.forEach((dwellMs) => {
    recordFeedTempoDwellInDistribution(distribution, dwellMs);
  });
  return distribution;
}

export function requireFeedTempoTimestamp(value, errorCode = 'FEED_TEMPO_TIMESTAMP_INVALID') {
  const numeric = Math.round(Number(value));
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(errorCode);
  }
  return numeric;
}

export function requireFeedTempoNonNegativeNumber(
  value,
  errorCode = 'FEED_TEMPO_NUMBER_INVALID',
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(errorCode);
  }
  return numeric;
}

function requireFeedTempoBoolean(value, errorCode) {
  if (typeof value !== 'boolean') throw new Error(errorCode);
  return value;
}

function requireFeedTempoNonNegativeInteger(value, errorCode) {
  const numeric = requireFeedTempoNonNegativeNumber(value, errorCode);
  if (!Number.isSafeInteger(numeric)) throw new Error(errorCode);
  return numeric;
}

function requireFeedTempoEnum(value, allowed, errorCode) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${errorCode}:${String(value || '')}`);
  }
  return value;
}

function normalizeNullableNonNegativeNumber(value, errorCode, { integer = false } = {}) {
  if (value === null) return null;
  return integer
    ? requireFeedTempoNonNegativeInteger(value, errorCode)
    : requireFeedTempoNonNegativeNumber(value, errorCode);
}

function normalizeNullableSignedNumber(value, errorCode) {
  if (value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(errorCode);
  return numeric;
}

export function requireFeedTempoContentFreeCode(
  value,
  errorCode = 'FEED_TEMPO_CODE_INVALID',
) {
  if (typeof value !== 'string') throw new Error(errorCode);
  const normalized = value.trim().toLowerCase();
  if (!CONTENT_FREE_CODE_PATTERN.test(normalized)) throw new Error(errorCode);
  return normalized;
}

export function normalizeFeedTempoSurface(surface) {
  const source = requireObject(surface, 'FEED_TEMPO_SURFACE_REQUIRED');
  const surfaceMode = requireFeedTempoContentFreeCode(
    source.surfaceMode,
    'FEED_TEMPO_SURFACE_MODE_INVALID',
  );
  if (!SURFACE_MODES.has(surfaceMode)) {
    throw new Error(`FEED_TEMPO_SURFACE_MODE_INVALID:${surfaceMode}`);
  }
  return Object.freeze({
    profileId: requireFeedTempoContentFreeCode(
      source.profileId,
      'FEED_TEMPO_PROFILE_ID_INVALID',
    ),
    semanticSurfaceId: requireFeedTempoContentFreeCode(
      source.semanticSurfaceId,
      'FEED_TEMPO_SEMANTIC_SURFACE_ID_INVALID',
    ),
    surfaceMode,
    contentClass: requireFeedTempoContentFreeCode(
      source.contentClass || 'feed',
      'FEED_TEMPO_CONTENT_CLASS_INVALID',
    ),
  });
}

export function resolveFeedTempoMetricGrain(surface) {
  const mode = surface?.surfaceMode || 'paged';
  return mode === 'continuous'
    ? FEED_TEMPO_CONTINUOUS_METRIC_GRAIN
    : FEED_TEMPO_METRIC_GRAIN;
}

export function buildFeedTempoProfileKey(surface) {
  const normalized = normalizeFeedTempoSurface(surface);
  const metricGrain = resolveFeedTempoMetricGrain(normalized);
  return [
    metricGrain,
    normalized.profileId,
    normalized.semanticSurfaceId,
    normalized.surfaceMode,
    normalized.contentClass,
  ].join('|');
}

export function areFeedTempoSurfacesEqual(left, right) {
  if (!left || !right) return false;
  return buildFeedTempoProfileKey(left) === buildFeedTempoProfileKey(right);
}

export function requireFeedTempoCompletionReason(value) {
  if (!FEED_TEMPO_COMPLETION_REASONS.includes(value)) {
    throw new Error(`FEED_TEMPO_COMPLETION_REASON_INVALID:${String(value || '')}`);
  }
  return value;
}

export function requireFeedTempoInterventionState(value) {
  if (!Object.values(FEED_TEMPO_INTERVENTION_STATES).includes(value)) {
    throw new Error(`FEED_TEMPO_INTERVENTION_STATE_INVALID:${String(value || '')}`);
  }
  return value;
}

function normalizeDwellEligibility(rawEligibility) {
  const eligibility = requireExactKeys(
    rawEligibility,
    ['minimumInclusiveMs', 'maximumInclusiveMs'],
    'FEED_TEMPO_DIAGNOSTIC_DWELL_ELIGIBILITY_INVALID',
  );
  const minimumInclusiveMs = requireFeedTempoNonNegativeInteger(
    eligibility.minimumInclusiveMs,
    'FEED_TEMPO_DIAGNOSTIC_DWELL_MINIMUM_INVALID',
  );
  const maximumInclusiveMs = requireFeedTempoNonNegativeInteger(
    eligibility.maximumInclusiveMs,
    'FEED_TEMPO_DIAGNOSTIC_DWELL_MAXIMUM_INVALID',
  );
  if (minimumInclusiveMs < 1 || maximumInclusiveMs <= minimumInclusiveMs) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_RANGE_INVALID');
  }
  return { minimumInclusiveMs, maximumInclusiveMs };
}

function normalizeRetention(rawRetention) {
  const retention = requireExactKeys(
    rawRetention,
    ['strategy', 'capacity', 'retainedCount', 'droppedCount', 'coverageRatio'],
    'FEED_TEMPO_DIAGNOSTIC_RETENTION_INVALID',
  );
  if (retention.strategy !== FEED_TEMPO_DWELL_RETENTION_STRATEGY) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RETENTION_STRATEGY_INVALID');
  }
  const capacity = requireFeedTempoNonNegativeInteger(
    retention.capacity,
    'FEED_TEMPO_DIAGNOSTIC_RETENTION_CAPACITY_INVALID',
  );
  const retainedCount = requireFeedTempoNonNegativeInteger(
    retention.retainedCount,
    'FEED_TEMPO_DIAGNOSTIC_RETAINED_COUNT_INVALID',
  );
  const droppedCount = requireFeedTempoNonNegativeInteger(
    retention.droppedCount,
    'FEED_TEMPO_DIAGNOSTIC_DROPPED_COUNT_INVALID',
  );
  const coverageRatio = requireFeedTempoNonNegativeNumber(
    retention.coverageRatio,
    'FEED_TEMPO_DIAGNOSTIC_RETENTION_COVERAGE_INVALID',
  );
  if (capacity < 1 || retainedCount > capacity || coverageRatio > 1) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RETENTION_RANGE_INVALID');
  }
  return {
    strategy: FEED_TEMPO_DWELL_RETENTION_STRATEGY,
    capacity,
    retainedCount,
    droppedCount,
    coverageRatio,
  };
}

function normalizeCensoring(rawCensoring) {
  const censoring = requireExactKeys(
    rawCensoring,
    [
      'belowMinimumCount',
      'aboveMaximumCount',
      'multiTransitionCount',
      'trailingCount',
      'trailingObservedDwellMs',
    ],
    'FEED_TEMPO_DIAGNOSTIC_CENSORING_INVALID',
  );
  const normalized = {
    belowMinimumCount: requireFeedTempoNonNegativeInteger(
      censoring.belowMinimumCount,
      'FEED_TEMPO_DIAGNOSTIC_BELOW_MINIMUM_COUNT_INVALID',
    ),
    aboveMaximumCount: requireFeedTempoNonNegativeInteger(
      censoring.aboveMaximumCount,
      'FEED_TEMPO_DIAGNOSTIC_ABOVE_MAXIMUM_COUNT_INVALID',
    ),
    multiTransitionCount: requireFeedTempoNonNegativeInteger(
      censoring.multiTransitionCount,
      'FEED_TEMPO_DIAGNOSTIC_MULTI_TRANSITION_COUNT_INVALID',
    ),
    trailingCount: requireFeedTempoNonNegativeInteger(
      censoring.trailingCount,
      'FEED_TEMPO_DIAGNOSTIC_TRAILING_COUNT_INVALID',
    ),
    trailingObservedDwellMs: requireFeedTempoNonNegativeInteger(
      censoring.trailingObservedDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_TRAILING_DWELL_INVALID',
    ),
  };
  if (normalized.trailingCount > 1) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_TRAILING_COUNT_INVALID');
  }
  if (normalized.trailingCount === 0 && normalized.trailingObservedDwellMs !== 0) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_TRAILING_DWELL_WITHOUT_CENSOR');
  }
  return normalized;
}

function normalizeDwellDistribution(rawDistribution) {
  const distribution = requireExactKeys(
    rawDistribution,
    ['version', 'bucketSemantics', 'exclusiveUpperBoundsMs', 'counts', 'overflowCount'],
    'FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_INVALID',
  );
  if (distribution.version !== FEED_TEMPO_DWELL_DISTRIBUTION_VERSION) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_VERSION_INVALID');
  }
  if (distribution.bucketSemantics !== FEED_TEMPO_DWELL_DISTRIBUTION_SEMANTICS) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_SEMANTICS_INVALID');
  }
  if (
    !Array.isArray(distribution.exclusiveUpperBoundsMs)
    || distribution.exclusiveUpperBoundsMs.length
      !== FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS.length
    || distribution.exclusiveUpperBoundsMs.some(
      (value, index) => value !== FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS[index],
    )
  ) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_BOUNDS_INVALID');
  }
  if (
    !Array.isArray(distribution.counts)
    || distribution.counts.length !== FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS.length
  ) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_COUNTS_INVALID');
  }
  return {
    version: FEED_TEMPO_DWELL_DISTRIBUTION_VERSION,
    bucketSemantics: FEED_TEMPO_DWELL_DISTRIBUTION_SEMANTICS,
    exclusiveUpperBoundsMs: [...FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS],
    counts: distribution.counts.map((count) => requireFeedTempoNonNegativeInteger(
      count,
      'FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_COUNT_INVALID',
    )),
    overflowCount: requireFeedTempoNonNegativeInteger(
      distribution.overflowCount,
      'FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_OVERFLOW_INVALID',
    ),
  };
}

function validateEpisodeMeasurementConsistency(summary) {
  if (summary.retention.retainedCount + summary.retention.droppedCount
      !== summary.eligibleDwellCount) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RETENTION_COUNT_MISMATCH');
  }
  const expectedCoverage = summary.eligibleDwellCount > 0
    ? summary.retention.retainedCount / summary.eligibleDwellCount
    : 0;
  if (Math.abs(summary.retention.coverageRatio - expectedCoverage) > 1e-9) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RETENTION_COVERAGE_MISMATCH');
  }
  const censoredTotal = summary.censoring.belowMinimumCount
    + summary.censoring.aboveMaximumCount
    + summary.censoring.multiTransitionCount
    + summary.censoring.trailingCount;
  if (censoredTotal !== summary.censoredDwellCount) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_CENSORING_COUNT_MISMATCH');
  }
  const distributionTotal = summary.dwellDistribution.counts.reduce(
    (total, count) => total + count,
    summary.dwellDistribution.overflowCount,
  );
  if (distributionTotal !== summary.eligibleDwellCount) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_DISTRIBUTION_COUNT_MISMATCH');
  }
  if (
    summary.retainedActiveDwellMs > summary.totalActiveDwellMs
    || summary.rapidDwellCount > summary.eligibleDwellCount
  ) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_DWELL_AGGREGATE_RANGE_INVALID');
  }
  const expectedRapidShare = summary.eligibleDwellCount > 0
    ? summary.rapidDwellCount / summary.eligibleDwellCount
    : 0;
  if (Math.abs(summary.rapidDwellShare - expectedRapidShare) > 1e-9) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RAPID_SHARE_MISMATCH');
  }
}

export function cloneFeedTempoEpisodeFact(fact) {
  if (!fact || typeof fact !== 'object') return null;
  return {
    ...fact,
    surface: fact.surface ? { ...fact.surface } : null,
    dwellEligibility: fact.dwellEligibility ? { ...fact.dwellEligibility } : null,
    retention: fact.retention ? { ...fact.retention } : null,
    censoring: fact.censoring ? { ...fact.censoring } : null,
    dwellSamplesMs: Array.isArray(fact.dwellSamplesMs)
      ? [...fact.dwellSamplesMs]
      : [],
    dwellDistribution: fact.dwellDistribution
      ? {
          ...fact.dwellDistribution,
          exclusiveUpperBoundsMs: [...fact.dwellDistribution.exclusiveUpperBoundsMs],
          counts: [...fact.dwellDistribution.counts],
        }
      : null,
  };
}

export function summarizeFeedTempoEpisodeFact(fact) {
  if (!fact || typeof fact !== 'object') return null;
  const {
    dwellSamplesMs: _dwellSamplesMs,
    ...summary
  } = cloneFeedTempoEpisodeFact(fact);
  return summary;
}

function normalizeContentFreeCodeList(values, errorCode) {
  if (!Array.isArray(values)) throw new Error(errorCode);
  return Array.from(new Set(values.map((value) => (
    requireFeedTempoContentFreeCode(value, errorCode)
  ))));
}

function normalizeEpisodeSummary(rawFact) {
  if (rawFact === null) return null;
  const fact = requireObject(rawFact, 'FEED_TEMPO_DIAGNOSTIC_EPISODE_INVALID');
  if (fact.version !== FEED_TEMPO_EPISODE_VERSION) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_EPISODE_VERSION_INVALID');
  }
  const summary = {
    version: FEED_TEMPO_EPISODE_VERSION,
    metricGrain: requireFeedTempoEnum(
      fact.metricGrain,
      METRIC_GRAIN_SET,
      'FEED_TEMPO_DIAGNOSTIC_EPISODE_GRAIN_INVALID',
    ),
    surface: normalizeFeedTempoSurface(fact.surface),
    startedAt: requireFeedTempoTimestamp(
      fact.startedAt,
      'FEED_TEMPO_DIAGNOSTIC_EPISODE_STARTED_AT_INVALID',
    ),
    endedAt: requireFeedTempoTimestamp(
      fact.endedAt,
      'FEED_TEMPO_DIAGNOSTIC_EPISODE_ENDED_AT_INVALID',
    ),
    completionReason: requireFeedTempoCompletionReason(fact.completionReason),
    interventionState: requireFeedTempoInterventionState(fact.interventionState),
    transitionCount: requireFeedTempoNonNegativeInteger(
      fact.transitionCount,
      'FEED_TEMPO_DIAGNOSTIC_TRANSITION_COUNT_INVALID',
    ),
    screenfulsConsumed: fact.screenfulsConsumed !== undefined && fact.screenfulsConsumed !== null
      ? requireFeedTempoNonNegativeNumber(
          fact.screenfulsConsumed,
          'FEED_TEMPO_DIAGNOSTIC_SCREENFULS_INVALID',
        )
      : 0,
    eligibleDwellCount: requireFeedTempoNonNegativeInteger(
      fact.eligibleDwellCount,
      'FEED_TEMPO_DIAGNOSTIC_ELIGIBLE_DWELL_COUNT_INVALID',
    ),
    censoredDwellCount: requireFeedTempoNonNegativeInteger(
      fact.censoredDwellCount,
      'FEED_TEMPO_DIAGNOSTIC_CENSORED_DWELL_COUNT_INVALID',
    ),
    dwellEligibility: normalizeDwellEligibility(fact.dwellEligibility),
    retention: normalizeRetention(fact.retention),
    censoring: normalizeCensoring(fact.censoring),
    dwellDistribution: normalizeDwellDistribution(fact.dwellDistribution),
    retainedActiveDwellMs: requireFeedTempoNonNegativeInteger(
      fact.retainedActiveDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_RETAINED_DWELL_INVALID',
    ),
    totalActiveDwellMs: requireFeedTempoNonNegativeInteger(
      fact.totalActiveDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_TOTAL_DWELL_INVALID',
    ),
    medianDwellMs: normalizeNullableNonNegativeNumber(
      fact.medianDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_MEDIAN_DWELL_INVALID',
      { integer: true },
    ),
    lowerQuartileDwellMs: normalizeNullableNonNegativeNumber(
      fact.lowerQuartileDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_LOWER_DWELL_INVALID',
      { integer: true },
    ),
    upperQuartileDwellMs: normalizeNullableNonNegativeNumber(
      fact.upperQuartileDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_UPPER_DWELL_INVALID',
      { integer: true },
    ),
    rapidDwellThresholdMs: requireFeedTempoNonNegativeInteger(
      fact.rapidDwellThresholdMs,
      'FEED_TEMPO_DIAGNOSTIC_RAPID_DWELL_THRESHOLD_INVALID',
    ),
    rapidDwellCount: requireFeedTempoNonNegativeInteger(
      fact.rapidDwellCount,
      'FEED_TEMPO_DIAGNOSTIC_RAPID_DWELL_COUNT_INVALID',
    ),
    rapidDwellShare: requireFeedTempoNonNegativeNumber(
      fact.rapidDwellShare,
      'FEED_TEMPO_DIAGNOSTIC_RAPID_DWELL_SHARE_INVALID',
    ),
    transitionsPerMinute: requireFeedTempoNonNegativeNumber(
      fact.transitionsPerMinute,
      'FEED_TEMPO_DIAGNOSTIC_TRANSITIONS_PER_MINUTE_INVALID',
    ),
    backwardIntentCount: requireFeedTempoNonNegativeInteger(
      fact.backwardIntentCount,
      'FEED_TEMPO_DIAGNOSTIC_BACKWARD_INTENT_COUNT_INVALID',
    ),
    maximumBacktrackRatio: requireFeedTempoNonNegativeNumber(
      fact.maximumBacktrackRatio,
      'FEED_TEMPO_DIAGNOSTIC_BACKTRACK_RATIO_INVALID',
    ),
    revisitCount: requireFeedTempoNonNegativeInteger(
      fact.revisitCount,
      'FEED_TEMPO_DIAGNOSTIC_REVISIT_COUNT_INVALID',
    ),
    mediaEngagedMs: requireFeedTempoNonNegativeNumber(
      fact.mediaEngagedMs,
      'FEED_TEMPO_DIAGNOSTIC_MEDIA_ENGAGED_INVALID',
    ),
    measurementConfidence: requireFeedTempoNonNegativeNumber(
      fact.measurementConfidence,
      'FEED_TEMPO_DIAGNOSTIC_MEASUREMENT_CONFIDENCE_INVALID',
    ),
    eligibleForObservedBaseline: requireFeedTempoBoolean(
      fact.eligibleForObservedBaseline,
      'FEED_TEMPO_DIAGNOSTIC_BASELINE_ELIGIBILITY_INVALID',
    ),
  };
  if (summary.rapidDwellThresholdMs !== FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RAPID_DWELL_THRESHOLD_INVALID');
  }
  validateEpisodeMeasurementConsistency(summary);
  return summary;
}

export function normalizeFeedTempoLearningEpisodeFact(rawFact) {
  const fact = requireExactKeys(
    rawFact,
    EPISODE_FACT_KEYS,
    'FEED_TEMPO_LEARNING_EPISODE_SHAPE_INVALID',
  );
  const summary = normalizeEpisodeSummary(fact);
  if (summary.startedAt > summary.endedAt) {
    throw new Error('FEED_TEMPO_LEARNING_EPISODE_TIME_ORDER_INVALID');
  }
  if (!Array.isArray(fact.dwellSamplesMs)) {
    throw new Error('FEED_TEMPO_LEARNING_DWELL_SAMPLES_REQUIRED');
  }
  const dwellSamplesMs = fact.dwellSamplesMs.map((value) => {
    const dwellMs = requireFeedTempoNonNegativeInteger(
      value,
      'FEED_TEMPO_LEARNING_DWELL_SAMPLE_INVALID',
    );
    if (dwellMs < 1) {
      throw new Error('FEED_TEMPO_LEARNING_DWELL_SAMPLE_INVALID');
    }
    return dwellMs;
  });
  if (dwellSamplesMs.length !== summary.retention.retainedCount) {
    throw new Error('FEED_TEMPO_LEARNING_DWELL_COUNT_MISMATCH');
  }
  const retainedActiveDwellMs = dwellSamplesMs.reduce((total, dwellMs) => (
    total + dwellMs
  ), 0);
  if (retainedActiveDwellMs !== summary.retainedActiveDwellMs) {
    throw new Error('FEED_TEMPO_LEARNING_RETAINED_DWELL_MISMATCH');
  }
  if (summary.retention.droppedCount === 0
      && summary.totalActiveDwellMs !== retainedActiveDwellMs) {
    throw new Error('FEED_TEMPO_LEARNING_TOTAL_DWELL_MISMATCH');
  }
  if (summary.rapidDwellShare > 1) {
    throw new Error('FEED_TEMPO_LEARNING_RAPID_SHARE_INVALID');
  }
  if (
    summary.maximumBacktrackRatio > 1
    || summary.measurementConfidence > 1
  ) {
    throw new Error('FEED_TEMPO_LEARNING_CONFIDENCE_RANGE_INVALID');
  }
  return Object.freeze({
    ...summary,
    surface: Object.freeze({ ...summary.surface }),
    dwellSamplesMs: Object.freeze(dwellSamplesMs),
  });
}

function normalizeCurrentEpisode(rawEpisode) {
  if (rawEpisode === null) return null;
  const episode = requireObject(
    rawEpisode,
    'FEED_TEMPO_DIAGNOSTIC_CURRENT_EPISODE_INVALID',
  );
  const normalized = {
    surface: normalizeFeedTempoSurface(episode.surface),
    startedAt: requireFeedTempoTimestamp(
      episode.startedAt,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_STARTED_AT_INVALID',
    ),
    lastAdvanceAt: requireFeedTempoTimestamp(
      episode.lastAdvanceAt,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_LAST_ADVANCE_AT_INVALID',
    ),
    transitionCount: requireFeedTempoNonNegativeInteger(
      episode.transitionCount,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_TRANSITION_COUNT_INVALID',
    ),
    eligibleDwellCount: requireFeedTempoNonNegativeInteger(
      episode.eligibleDwellCount,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_ELIGIBLE_DWELL_COUNT_INVALID',
    ),
    censoredDwellCount: requireFeedTempoNonNegativeInteger(
      episode.censoredDwellCount,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_CENSORED_DWELL_COUNT_INVALID',
    ),
    dwellEligibility: normalizeDwellEligibility(episode.dwellEligibility),
    retention: normalizeRetention(episode.retention),
    censoring: normalizeCensoring(episode.censoring),
    dwellDistribution: normalizeDwellDistribution(episode.dwellDistribution),
    retainedActiveDwellMs: requireFeedTempoNonNegativeInteger(
      episode.retainedActiveDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_RETAINED_DWELL_INVALID',
    ),
    totalActiveDwellMs: requireFeedTempoNonNegativeInteger(
      episode.totalActiveDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_TOTAL_DWELL_INVALID',
    ),
    medianDwellMs: normalizeNullableNonNegativeNumber(
      episode.medianDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_MEDIAN_DWELL_INVALID',
      { integer: true },
    ),
    rapidDwellThresholdMs: requireFeedTempoNonNegativeInteger(
      episode.rapidDwellThresholdMs,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_RAPID_THRESHOLD_INVALID',
    ),
    rapidDwellCount: requireFeedTempoNonNegativeInteger(
      episode.rapidDwellCount,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_RAPID_COUNT_INVALID',
    ),
    rapidDwellShare: requireFeedTempoNonNegativeNumber(
      episode.rapidDwellShare,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_RAPID_SHARE_INVALID',
    ),
    interventionState: requireFeedTempoInterventionState(episode.interventionState),
  };
  if (normalized.rapidDwellThresholdMs !== FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_CURRENT_RAPID_THRESHOLD_INVALID');
  }
  validateEpisodeMeasurementConsistency(normalized);
  return normalized;
}

function normalizeTrajectory(rawTrajectory) {
  const trajectory = requireObject(
    rawTrajectory,
    'FEED_TEMPO_DIAGNOSTIC_TRAJECTORY_INVALID',
  );
  const counters = requireObject(
    trajectory.counters,
    'FEED_TEMPO_DIAGNOSTIC_COUNTERS_INVALID',
  );
  const normalizedCounters = Object.fromEntries([
    'confirmedAdvanceCount',
    'eligibleDwellCount',
    'droppedDwellCount',
    'censoredDwellCount',
    'finalizedEpisodeCount',
    'baselineEligibleEpisodeCount',
    'baselineExcludedEpisodeCount',
  ].map((key) => [
    key,
    requireFeedTempoNonNegativeInteger(
      counters[key],
      `FEED_TEMPO_DIAGNOSTIC_COUNTER_INVALID:${key}`,
    ),
  ]));
  return {
    state: requireFeedTempoEnum(
      trajectory.state,
      FEED_TEMPO_STATE_SET,
      'FEED_TEMPO_DIAGNOSTIC_TRAJECTORY_STATE_INVALID',
    ),
    active: requireFeedTempoBoolean(
      trajectory.active,
      'FEED_TEMPO_DIAGNOSTIC_TRAJECTORY_ACTIVE_INVALID',
    ),
    supported: requireFeedTempoBoolean(
      trajectory.supported,
      'FEED_TEMPO_DIAGNOSTIC_TRAJECTORY_SUPPORTED_INVALID',
    ),
    surface: trajectory.surface === null
      ? null
      : normalizeFeedTempoSurface(trajectory.surface),
    currentEpisode: normalizeCurrentEpisode(trajectory.currentEpisode),
    lastEpisode: normalizeEpisodeSummary(trajectory.lastEpisode),
    counters: normalizedCounters,
    idleTimeoutMs: requireFeedTempoNonNegativeInteger(
      trajectory.idleTimeoutMs,
      'FEED_TEMPO_DIAGNOSTIC_IDLE_TIMEOUT_INVALID',
    ),
    idleDeadlineAt: requireFeedTempoTimestamp(
      trajectory.idleDeadlineAt,
      'FEED_TEMPO_DIAGNOSTIC_IDLE_DEADLINE_INVALID',
    ),
  };
}

function normalizeProfile(rawProfile) {
  if (rawProfile === null) return null;
  const profile = requireObject(rawProfile, 'FEED_TEMPO_DIAGNOSTIC_PROFILE_INVALID');
  if (profile.version !== FEED_TEMPO_PROFILE_VERSION) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_PROFILE_VERSION_INVALID');
  }
  if (profile.persistence !== 'indexeddb_checkpoint') {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_PROFILE_PERSISTENCE_INVALID');
  }
  const surface = normalizeFeedTempoSurface(profile.surface);
  const isContinuous = surface.surfaceMode === 'continuous';
  if (profile.metricGrain !== resolveFeedTempoMetricGrain(surface)) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_PROFILE_GRAIN_INVALID');
  }
  if (isContinuous && [
    'adaptiveCenterDwellMs',
    'observedMedianDwellMs',
    'lowerQuartileDwellMs',
    'upperQuartileDwellMs',
    'logDwellMean',
    'logDwellVariance',
  ].some((key) => profile[key] !== null)) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_CONTINUOUS_DWELL_UNAVAILABLE');
  }
  return {
    version: FEED_TEMPO_PROFILE_VERSION,
    metricGrain: requireFeedTempoEnum(
      profile.metricGrain,
      METRIC_GRAIN_SET,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_GRAIN_INVALID',
    ),
    status: requireFeedTempoEnum(
      profile.status,
      PROFILE_STATUS_SET,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_STATUS_INVALID',
    ),
    persistence: 'indexeddb_checkpoint',
    surface,
    episodeCount: requireFeedTempoNonNegativeInteger(
      profile.episodeCount,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_EPISODE_COUNT_INVALID',
    ),
    sampleCount: requireFeedTempoNonNegativeInteger(
      profile.sampleCount,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_SAMPLE_COUNT_INVALID',
    ),
    effectiveEpisodeWeight: requireFeedTempoNonNegativeNumber(
      profile.effectiveEpisodeWeight,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_EFFECTIVE_EPISODE_WEIGHT_INVALID',
    ),
    effectiveSampleWeight: requireFeedTempoNonNegativeNumber(
      profile.effectiveSampleWeight,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_EFFECTIVE_SAMPLE_WEIGHT_INVALID',
    ),
    firstObservedAt: requireFeedTempoTimestamp(
      profile.firstObservedAt,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_FIRST_OBSERVED_AT_INVALID',
    ),
    lastObservedAt: requireFeedTempoTimestamp(
      profile.lastObservedAt,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_LAST_OBSERVED_AT_INVALID',
    ),
    decayEvaluatedAt: requireFeedTempoTimestamp(
      profile.decayEvaluatedAt,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_DECAY_EVALUATED_INVALID',
    ),
    freshnessConfidence: requireFeedTempoNonNegativeNumber(
      profile.freshnessConfidence,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_FRESHNESS_INVALID',
    ),
    adaptiveCenterDwellMs: isContinuous ? null : requireFeedTempoNonNegativeInteger(
      profile.adaptiveCenterDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_ADAPTIVE_CENTER_INVALID',
    ),
    adaptiveCenterScreenfuls: requireFeedTempoNonNegativeNumber(
      profile.adaptiveCenterScreenfuls,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_ADAPTIVE_SCREENFULS_INVALID',
    ),
    observedMedianDwellMs: normalizeNullableNonNegativeNumber(
      profile.observedMedianDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_MEDIAN_INVALID',
      { integer: true },
    ),
    observedMedianScreenfuls: normalizeNullableNonNegativeNumber(
      profile.observedMedianScreenfuls,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_SCREENFULS_MEDIAN_INVALID',
    ),
    lowerQuartileDwellMs: normalizeNullableNonNegativeNumber(
      profile.lowerQuartileDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_LOWER_INVALID',
      { integer: true },
    ),
    upperQuartileDwellMs: normalizeNullableNonNegativeNumber(
      profile.upperQuartileDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_UPPER_INVALID',
      { integer: true },
    ),
    logDwellMean: normalizeNullableNonNegativeNumber(
      profile.logDwellMean,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_LOG_MEAN_INVALID',
    ),
    logDwellVariance: normalizeNullableNonNegativeNumber(
      profile.logDwellVariance,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_LOG_VARIANCE_INVALID',
    ),
    excludedEpisodeCount: requireFeedTempoNonNegativeInteger(
      profile.excludedEpisodeCount,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_EXCLUDED_COUNT_INVALID',
    ),
    checkpointStateRevision: normalizeNullableNonNegativeNumber(
      profile.checkpointStateRevision,
      'FEED_TEMPO_DIAGNOSTIC_PROFILE_CHECKPOINT_REVISION_INVALID',
      { integer: true },
    ),
  };
}

function requireContinuousAmountEvaluation(evaluation) {
  for (const field of [
    'currentScreenfuls',
    'referenceScreenfuls',
    'amountRatio',
    'amountComparison',
  ]) {
    if (!Object.hasOwn(evaluation, field)) {
      throw new Error(`FEED_TEMPO_DIAGNOSTIC_AMOUNT_FIELD_REQUIRED:${field}`);
    }
  }
  const { currentScreenfuls, referenceScreenfuls, amountRatio, amountComparison } = evaluation;
  if (!Number.isFinite(currentScreenfuls) || currentScreenfuls < 0) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_CURRENT_SCREENFULS_INVALID');
  }
  if (!Number.isFinite(referenceScreenfuls) || referenceScreenfuls <= 0) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_REFERENCE_SCREENFULS_INVALID');
  }
  if (currentScreenfuls === 0) {
    if (amountRatio !== null || amountComparison !== 'unavailable') {
      throw new Error('FEED_TEMPO_DIAGNOSTIC_AMOUNT_PAIR_INVALID');
    }
    return;
  }
  if (!Number.isFinite(amountRatio) || amountRatio < 0) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_AMOUNT_RATIO_INVALID');
  }
  // A positive raw ratio can round to zero at the public four-decimal precision.
  // Comparison therefore follows observed amount, never the rounded ratio.
  const expectedRatio = Math.round((currentScreenfuls / referenceScreenfuls) * 10_000) / 10_000;
  const expectedComparison = currentScreenfuls < referenceScreenfuls
    ? 'below_reference'
    : (currentScreenfuls > referenceScreenfuls ? 'above_reference' : 'at_reference');
  if (amountRatio !== expectedRatio || amountComparison !== expectedComparison) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_AMOUNT_PAIR_INVALID');
  }
}

export function normalizeFeedTempoShadowEvaluation(rawEvaluation, surface) {
  if (rawEvaluation === null) return null;
  const evaluation = requireObject(
    rawEvaluation,
    'FEED_TEMPO_DIAGNOSTIC_EVALUATION_INVALID',
  );
  if (evaluation.version !== FEED_TEMPO_PROFILE_VERSION) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_EVALUATION_VERSION_INVALID');
  }
  if (!surface) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_EVALUATION_SURFACE_REQUIRED');
  }
  const normalizedSurface = normalizeFeedTempoSurface(surface);
  const isContinuous = normalizedSurface.surfaceMode === 'continuous';
  if (evaluation.metricGrain !== resolveFeedTempoMetricGrain(normalizedSurface)) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_EVALUATION_GRAIN_INVALID');
  }
  if (isContinuous && (
    evaluation.direction !== 'unknown'
    || [
      'referenceDwellMs',
      'observedMedianDwellMs',
      'currentMedianDwellMs',
      'paceRatio',
      'fastnessZ',
    ].some((key) => evaluation[key] !== null)
  )) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_CONTINUOUS_PACE_UNAVAILABLE');
  }
  if (isContinuous) requireContinuousAmountEvaluation(evaluation);
  if (!isContinuous && (
    evaluation.amountRatio !== null
    || evaluation.amountComparison !== 'unavailable'
  )) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_PAGED_AMOUNT_UNAVAILABLE');
  }
  return {
    version: FEED_TEMPO_PROFILE_VERSION,
    metricGrain: requireFeedTempoEnum(
      evaluation.metricGrain,
      METRIC_GRAIN_SET,
      'FEED_TEMPO_DIAGNOSTIC_EVALUATION_GRAIN_INVALID',
    ),
    evaluatedAt: requireFeedTempoTimestamp(
      evaluation.evaluatedAt,
      'FEED_TEMPO_DIAGNOSTIC_EVALUATED_AT_INVALID',
    ),
    profileKey: buildFeedTempoProfileKey(normalizedSurface),
    status: requireFeedTempoEnum(
      evaluation.status,
      PROFILE_STATUS_SET,
      'FEED_TEMPO_DIAGNOSTIC_EVALUATION_STATUS_INVALID',
    ),
    referenceMode: requireFeedTempoEnum(
      evaluation.referenceMode,
      REFERENCE_MODE_SET,
      'FEED_TEMPO_DIAGNOSTIC_REFERENCE_MODE_INVALID',
    ),
    referenceSource: requireFeedTempoEnum(
      evaluation.referenceSource,
      REFERENCE_SOURCE_SET,
      'FEED_TEMPO_DIAGNOSTIC_REFERENCE_SOURCE_INVALID',
    ),
    referenceDwellMs: isContinuous ? null : requireFeedTempoNonNegativeInteger(
      evaluation.referenceDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_REFERENCE_DWELL_INVALID',
    ),
    referenceScreenfuls: normalizeNullableNonNegativeNumber(
      evaluation.referenceScreenfuls,
      'FEED_TEMPO_DIAGNOSTIC_REFERENCE_SCREENFULS_INVALID',
    ),
    adaptiveCenterScreenfuls: normalizeNullableNonNegativeNumber(
      evaluation.adaptiveCenterScreenfuls,
      'FEED_TEMPO_DIAGNOSTIC_ADAPTIVE_SCREENFULS_INVALID',
    ),
    currentScreenfuls: normalizeNullableNonNegativeNumber(
      evaluation.currentScreenfuls,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_SCREENFULS_INVALID',
    ),
    observedMedianDwellMs: normalizeNullableNonNegativeNumber(
      evaluation.observedMedianDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_OBSERVED_MEDIAN_INVALID',
      { integer: true },
    ),
    observedMedianScreenfuls: normalizeNullableNonNegativeNumber(
      evaluation.observedMedianScreenfuls,
      'FEED_TEMPO_DIAGNOSTIC_OBSERVED_SCREENFULS_MEDIAN_INVALID',
    ),
    currentMedianDwellMs: normalizeNullableNonNegativeNumber(
      evaluation.currentMedianDwellMs,
      'FEED_TEMPO_DIAGNOSTIC_CURRENT_MEDIAN_INVALID',
      { integer: true },
    ),
    amountRatio: normalizeNullableNonNegativeNumber(
      evaluation.amountRatio,
      'FEED_TEMPO_DIAGNOSTIC_AMOUNT_RATIO_INVALID',
    ),
    amountComparison: requireFeedTempoEnum(
      evaluation.amountComparison,
      AMOUNT_COMPARISON_SET,
      'FEED_TEMPO_DIAGNOSTIC_AMOUNT_COMPARISON_INVALID',
    ),
    paceRatio: normalizeNullableNonNegativeNumber(
      evaluation.paceRatio,
      'FEED_TEMPO_DIAGNOSTIC_PACE_RATIO_INVALID',
    ),
    fastnessZ: normalizeNullableSignedNumber(
      evaluation.fastnessZ,
      'FEED_TEMPO_DIAGNOSTIC_FASTNESS_Z_INVALID',
    ),
    direction: requireFeedTempoEnum(
      evaluation.direction,
      DIRECTION_SET,
      'FEED_TEMPO_DIAGNOSTIC_DIRECTION_INVALID',
    ),
    confidence: requireFeedTempoNonNegativeNumber(
      evaluation.confidence,
      'FEED_TEMPO_DIAGNOSTIC_CONFIDENCE_INVALID',
    ),
    reasons: normalizeContentFreeCodeList(
      evaluation.reasons,
      'FEED_TEMPO_DIAGNOSTIC_REASON_INVALID',
    ),
  };
}

function normalizeCost(rawCost) {
  const cost = requireObject(rawCost, 'FEED_TEMPO_DIAGNOSTIC_COST_INVALID');
  return {
    measurementState: requireFeedTempoEnum(
      cost.measurementState,
      COST_MEASUREMENT_STATE_SET,
      'FEED_TEMPO_DIAGNOSTIC_COST_STATE_INVALID',
    ),
    operationCount: requireFeedTempoNonNegativeInteger(
      cost.operationCount,
      'FEED_TEMPO_DIAGNOSTIC_COST_OPERATION_COUNT_INVALID',
    ),
    advanceOperationCount: requireFeedTempoNonNegativeInteger(
      cost.advanceOperationCount,
      'FEED_TEMPO_DIAGNOSTIC_COST_ADVANCE_COUNT_INVALID',
    ),
    finalizedEpisodeCount: requireFeedTempoNonNegativeInteger(
      cost.finalizedEpisodeCount,
      'FEED_TEMPO_DIAGNOSTIC_COST_FINALIZED_COUNT_INVALID',
    ),
    totalMs: requireFeedTempoNonNegativeNumber(
      cost.totalMs,
      'FEED_TEMPO_DIAGNOSTIC_COST_TOTAL_INVALID',
    ),
    averageMs: requireFeedTempoNonNegativeNumber(
      cost.averageMs,
      'FEED_TEMPO_DIAGNOSTIC_COST_AVERAGE_INVALID',
    ),
    maximumMs: requireFeedTempoNonNegativeNumber(
      cost.maximumMs,
      'FEED_TEMPO_DIAGNOSTIC_COST_MAXIMUM_INVALID',
    ),
  };
}

function normalizeCheckpoint(rawCheckpoint) {
  const checkpoint = requireObject(
    rawCheckpoint,
    'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_INVALID',
  );
  if (
    checkpoint.mode !== 'persisted_shadow'
    || checkpoint.backend !== 'indexeddb_model_state'
  ) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_OWNER_INVALID');
  }
  return {
    mode: 'persisted_shadow',
    backend: 'indexeddb_model_state',
    state: requireFeedTempoEnum(
      checkpoint.state,
      CHECKPOINT_STATE_SET,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_STATE_INVALID',
    ),
    pendingOperationCount: requireFeedTempoNonNegativeInteger(
      checkpoint.pendingOperationCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_PENDING_INVALID',
    ),
    restoreCount: requireFeedTempoNonNegativeInteger(
      checkpoint.restoreCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_RESTORE_COUNT_INVALID',
    ),
    commitCount: requireFeedTempoNonNegativeInteger(
      checkpoint.commitCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_COMMIT_COUNT_INVALID',
    ),
    excludedEpisodeCount: requireFeedTempoNonNegativeInteger(
      checkpoint.excludedEpisodeCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_EXCLUDED_COUNT_INVALID',
    ),
    conflictCount: requireFeedTempoNonNegativeInteger(
      checkpoint.conflictCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_CONFLICT_COUNT_INVALID',
    ),
    failureCount: requireFeedTempoNonNegativeInteger(
      checkpoint.failureCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_FAILURE_COUNT_INVALID',
    ),
    roundTripCount: requireFeedTempoNonNegativeInteger(
      checkpoint.roundTripCount,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_ROUND_TRIP_COUNT_INVALID',
    ),
    roundTripTotalMs: requireFeedTempoNonNegativeNumber(
      checkpoint.roundTripTotalMs,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_ROUND_TRIP_TOTAL_INVALID',
    ),
    roundTripAverageMs: requireFeedTempoNonNegativeNumber(
      checkpoint.roundTripAverageMs,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_ROUND_TRIP_AVERAGE_INVALID',
    ),
    roundTripMaximumMs: requireFeedTempoNonNegativeNumber(
      checkpoint.roundTripMaximumMs,
      'FEED_TEMPO_DIAGNOSTIC_CHECKPOINT_ROUND_TRIP_MAXIMUM_INVALID',
    ),
    failure: checkpoint.failure ? 'feed_tempo_checkpoint_failure' : null,
  };
}

function normalizeResearchWriteFence(rawFence) {
  const fence = requireObject(
    rawFence,
    'FEED_TEMPO_DIAGNOSTIC_RESEARCH_WRITE_FENCE_INVALID',
  );
  if (fence.policy !== 'exclude_tainted_episode_from_checkpoint_commit') {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_RESEARCH_WRITE_FENCE_POLICY_INVALID');
  }
  return {
    active: requireFeedTempoBoolean(
      fence.active,
      'FEED_TEMPO_DIAGNOSTIC_RESEARCH_WRITE_FENCE_ACTIVE_INVALID',
    ),
    currentEpisodeTainted: requireFeedTempoBoolean(
      fence.currentEpisodeTainted,
      'FEED_TEMPO_DIAGNOSTIC_RESEARCH_WRITE_FENCE_TAINT_INVALID',
    ),
    suppressedEpisodeCount: requireFeedTempoNonNegativeInteger(
      fence.suppressedEpisodeCount,
      'FEED_TEMPO_DIAGNOSTIC_RESEARCH_WRITE_FENCE_COUNT_INVALID',
    ),
    policy: fence.policy,
  };
}

export function normalizeFeedTempoDiagnosticSnapshot(rawSnapshot) {
  const snapshot = requireObject(
    rawSnapshot,
    'FEED_TEMPO_DIAGNOSTIC_SNAPSHOT_REQUIRED',
  );
  if (snapshot.version !== FEED_TEMPO_SNAPSHOT_VERSION) {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_SNAPSHOT_VERSION_INVALID');
  }
  if (snapshot.mode !== 'observe_only') {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_MODE_INVALID');
  }
  if (snapshot.persistence !== 'indexeddb_checkpoint') {
    throw new Error('FEED_TEMPO_DIAGNOSTIC_PERSISTENCE_INVALID');
  }
  const trajectory = normalizeTrajectory(snapshot.trajectory);
  const surface = snapshot.surface === null
    ? null
    : normalizeFeedTempoSurface(snapshot.surface);
  const lastEpisode = normalizeEpisodeSummary(snapshot.lastEpisode);
  const evaluationSurface = lastEpisode?.surface || trajectory.lastEpisode?.surface || surface || null;
  return {
    version: FEED_TEMPO_SNAPSHOT_VERSION,
    mode: 'observe_only',
    persistence: 'indexeddb_checkpoint',
    state: requireFeedTempoEnum(
      snapshot.state,
      FEED_TEMPO_STATE_SET,
      'FEED_TEMPO_DIAGNOSTIC_STATE_INVALID',
    ),
    active: requireFeedTempoBoolean(
      snapshot.active,
      'FEED_TEMPO_DIAGNOSTIC_ACTIVE_INVALID',
    ),
    cost: normalizeCost(snapshot.cost),
    checkpoint: normalizeCheckpoint(snapshot.checkpoint),
    researchWriteFence: normalizeResearchWriteFence(snapshot.researchWriteFence),
    surface,
    trajectory,
    profile: normalizeProfile(snapshot.profile),
    shadowEvaluation: normalizeFeedTempoShadowEvaluation(
      snapshot.shadowEvaluation,
      evaluationSurface,
    ),
    lastEpisode,
    failure: snapshot.failure ? 'feed_tempo_runtime_failure' : null,
  };
}
