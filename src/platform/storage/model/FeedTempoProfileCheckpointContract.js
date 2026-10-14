export const FEED_TEMPO_PROFILE_CHECKPOINT_KEY = (
  'feed_tempo_adaptive_profile_checkpoint_v1'
);
export const FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT = (
  'feed_tempo_adaptive_profile_checkpoint_v1'
);
export const FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION = 2;
export const FEED_TEMPO_PROFILE_PERSISTENCE = 'indexeddb_checkpoint';

export const FEED_TEMPO_PROFILE_POLICY = Object.freeze({
  normativePagedDwellMs: 5_000,
  normativeContinuousScreenfuls: 16.0,
  adaptiveReferenceMinRatio: 0.75,
  adaptiveReferenceMaxRatio: 1.25,
  adaptiveContinuousMinRatio: 0.60,
  adaptiveContinuousMaxRatio: 1.60,
  evidenceHalfLifeMs: 30 * 24 * 60 * 60 * 1000,
  confidenceHalfLifeMs: 7 * 24 * 60 * 60 * 1000,
  maximumCenterStepRatio: 0.04,
  sparseSampleWeight: 12,
  stableSampleWeight: 50,
  stableEpisodeWeight: 3,
  profileLimit: 16,
  sampleRetention: 128,
  minimumDwellMs: 250,
  maximumDwellMs: 5 * 60 * 1000,
  minimumScreenfuls: 0.5,
  maximumScreenfuls: 50.0,
  minimumLearningConfidence: 0.5,
});

const CHECKPOINT_KEYS = Object.freeze([
  'contract',
  'schemaVersion',
  'profileEpoch',
  'stateRevision',
  'createdAt',
  'updatedAt',
  'profiles',
]);
const PROFILE_KEYS = Object.freeze([
  'key',
  'surface',
  'episodeCount',
  'sampleCount',
  'effectiveEpisodeWeight',
  'effectiveSampleWeight',
  'firstObservedAt',
  'lastObservedAt',
  'decayEvaluatedAt',
  'logDwellMean',
  'logDwellVariance',
  'adaptiveCenterDwellMs',
  'adaptiveCenterScreenfuls',
  'retainedSamples',
]);
const SURFACE_KEYS = Object.freeze([
  'profileId',
  'semanticSurfaceId',
  'surfaceMode',
  'contentClass',
]);
const SAMPLE_KEYS = Object.freeze(['dwellMs', 'screenfuls', 'observedAt']);
const CONTENT_FREE_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const METRIC_GRAIN = 'paged_item_dwell';

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function requireTimestamp(value, errorCode) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function requireFiniteNumber(value, errorCode, { minimum = 0 } = {}) {
  if (!Number.isFinite(value) || value < minimum) throw new Error(errorCode);
  return value;
}

function requireContentFreeCode(value, errorCode) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || !CONTENT_FREE_CODE_PATTERN.test(value)
  ) {
    throw new Error(errorCode);
  }
  return value.toLowerCase();
}

function requireProfileEpoch(value, errorCode) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(errorCode);
  }
  return value;
}

function requireStateRevision(value, errorCode) {
  return requireNonNegativeInteger(value, errorCode);
}

function cloneSurface(surface) {
  if (!hasExactKeys(surface, SURFACE_KEYS)) {
    throw new Error('FEED_TEMPO_CHECKPOINT_SURFACE_INVALID');
  }
  const normalized = {
    profileId: requireContentFreeCode(
      surface.profileId,
      'FEED_TEMPO_CHECKPOINT_PROFILE_ID_INVALID',
    ),
    semanticSurfaceId: requireContentFreeCode(
      surface.semanticSurfaceId,
      'FEED_TEMPO_CHECKPOINT_SEMANTIC_SURFACE_ID_INVALID',
    ),
    surfaceMode: requireContentFreeCode(
      surface.surfaceMode,
      'FEED_TEMPO_CHECKPOINT_SURFACE_MODE_INVALID',
    ),
    contentClass: requireContentFreeCode(
      surface.contentClass,
      'FEED_TEMPO_CHECKPOINT_CONTENT_CLASS_INVALID',
    ),
  };
  if (!['paged', 'continuous'].includes(normalized.surfaceMode)) {
    throw new Error('FEED_TEMPO_CHECKPOINT_SURFACE_UNSUPPORTED');
  }
  return normalized;
}

export function buildFeedTempoCheckpointProfileKey(surface) {
  const normalized = cloneSurface(surface);
  const metricGrain = normalized.surfaceMode === 'continuous'
    ? 'continuous_session_screenfuls'
    : METRIC_GRAIN;
  return [
    metricGrain,
    normalized.profileId,
    normalized.semanticSurfaceId,
    normalized.surfaceMode,
    normalized.contentClass,
  ].join('|');
}

function cloneRetainedSample(sample, {
  firstObservedAt,
  lastObservedAt,
  previousObservedAt,
  isContinuous = false,
} = {}) {
  if (!hasExactKeys(sample, SAMPLE_KEYS)) {
    throw new Error('FEED_TEMPO_CHECKPOINT_SAMPLE_INVALID');
  }
  const dwellMs = requireNonNegativeInteger(
    sample.dwellMs,
    'FEED_TEMPO_CHECKPOINT_SAMPLE_DWELL_INVALID',
  );
  let screenfuls = null;
  if (isContinuous) {
    screenfuls = requireFiniteNumber(
      sample.screenfuls,
      'FEED_TEMPO_CHECKPOINT_SAMPLE_SCREENFULS_INVALID',
    );
    if (
      screenfuls < FEED_TEMPO_PROFILE_POLICY.minimumScreenfuls
      || screenfuls > FEED_TEMPO_PROFILE_POLICY.maximumScreenfuls
    ) {
      throw new Error('FEED_TEMPO_CHECKPOINT_SAMPLE_SCREENFULS_OUT_OF_RANGE');
    }
  } else if (
    dwellMs < FEED_TEMPO_PROFILE_POLICY.minimumDwellMs
    || dwellMs > FEED_TEMPO_PROFILE_POLICY.maximumDwellMs
  ) {
    throw new Error('FEED_TEMPO_CHECKPOINT_SAMPLE_DWELL_OUT_OF_RANGE');
  }
  const observedAt = requireTimestamp(
    sample.observedAt,
    'FEED_TEMPO_CHECKPOINT_SAMPLE_TIMESTAMP_INVALID',
  );
  if (
    observedAt < firstObservedAt
    || observedAt > lastObservedAt
    || observedAt < previousObservedAt
  ) {
    throw new Error('FEED_TEMPO_CHECKPOINT_SAMPLE_ORDER_INVALID');
  }
  return { dwellMs, screenfuls, observedAt };
}

export function requireFeedTempoCheckpointProfile(profile, {
  checkpointUpdatedAt = Number.MAX_SAFE_INTEGER,
} = {}) {
  if (!hasExactKeys(profile, PROFILE_KEYS)) {
    throw new Error('FEED_TEMPO_CHECKPOINT_PROFILE_INVALID');
  }
  const surface = cloneSurface(profile.surface);
  const isContinuous = surface.surfaceMode === 'continuous';
  const key = buildFeedTempoCheckpointProfileKey(surface);
  if (profile.key !== key) {
    throw new Error('FEED_TEMPO_CHECKPOINT_PROFILE_KEY_MISMATCH');
  }
  const episodeCount = requireNonNegativeInteger(
    profile.episodeCount,
    'FEED_TEMPO_CHECKPOINT_EPISODE_COUNT_INVALID',
  );
  const sampleCount = requireNonNegativeInteger(
    profile.sampleCount,
    'FEED_TEMPO_CHECKPOINT_SAMPLE_COUNT_INVALID',
  );
  if (episodeCount < 1 || sampleCount < 1) {
    throw new Error('FEED_TEMPO_CHECKPOINT_EMPTY_PROFILE_FORBIDDEN');
  }
  const effectiveEpisodeWeight = requireFiniteNumber(
    profile.effectiveEpisodeWeight,
    'FEED_TEMPO_CHECKPOINT_EPISODE_WEIGHT_INVALID',
  );
  const effectiveSampleWeight = requireFiniteNumber(
    profile.effectiveSampleWeight,
    'FEED_TEMPO_CHECKPOINT_SAMPLE_WEIGHT_INVALID',
  );
  if (
    effectiveEpisodeWeight > episodeCount
    || effectiveSampleWeight > sampleCount
  ) {
    throw new Error('FEED_TEMPO_CHECKPOINT_WEIGHT_EXCEEDS_COUNT');
  }
  const firstObservedAt = requireTimestamp(
    profile.firstObservedAt,
    'FEED_TEMPO_CHECKPOINT_FIRST_OBSERVED_INVALID',
  );
  const lastObservedAt = requireTimestamp(
    profile.lastObservedAt,
    'FEED_TEMPO_CHECKPOINT_LAST_OBSERVED_INVALID',
  );
  const decayEvaluatedAt = requireTimestamp(
    profile.decayEvaluatedAt,
    'FEED_TEMPO_CHECKPOINT_DECAY_EVALUATED_INVALID',
  );
  if (
    firstObservedAt > lastObservedAt
    || lastObservedAt > decayEvaluatedAt
    || decayEvaluatedAt > checkpointUpdatedAt
  ) {
    throw new Error('FEED_TEMPO_CHECKPOINT_PROFILE_TIME_ORDER_INVALID');
  }
  const logDwellMean = requireFiniteNumber(
    profile.logDwellMean,
    'FEED_TEMPO_CHECKPOINT_LOG_MEAN_INVALID',
  );
  const logDwellVariance = requireFiniteNumber(
    profile.logDwellVariance,
    'FEED_TEMPO_CHECKPOINT_LOG_VARIANCE_INVALID',
  );
  const adaptiveCenterDwellMs = requireNonNegativeInteger(
    profile.adaptiveCenterDwellMs,
    'FEED_TEMPO_CHECKPOINT_ADAPTIVE_CENTER_INVALID',
  );
  const adaptiveCenterScreenfuls = requireFiniteNumber(
    profile.adaptiveCenterScreenfuls,
    'FEED_TEMPO_CHECKPOINT_ADAPTIVE_SCREENFULS_INVALID',
  );
  if (isContinuous) {
    const minScreenfuls = (
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
      * FEED_TEMPO_PROFILE_POLICY.adaptiveContinuousMinRatio
    );
    const maxScreenfuls = (
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
      * FEED_TEMPO_PROFILE_POLICY.adaptiveContinuousMaxRatio
    );
    if (adaptiveCenterScreenfuls < minScreenfuls || adaptiveCenterScreenfuls > maxScreenfuls) {
      throw new Error('FEED_TEMPO_CHECKPOINT_ADAPTIVE_SCREENFULS_OUT_OF_RANGE');
    }
  } else {
    const minimumCenter = Math.round(
      FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs
      * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMinRatio,
    );
    const maximumCenter = Math.round(
      FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs
      * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMaxRatio,
    );
    if (
      adaptiveCenterDwellMs < minimumCenter
      || adaptiveCenterDwellMs > maximumCenter
    ) {
      throw new Error('FEED_TEMPO_CHECKPOINT_ADAPTIVE_CENTER_OUT_OF_RANGE');
    }
  }
  if (
    !Array.isArray(profile.retainedSamples)
    || profile.retainedSamples.length < 1
    || profile.retainedSamples.length > FEED_TEMPO_PROFILE_POLICY.sampleRetention
    || profile.retainedSamples.length > sampleCount
  ) {
    throw new Error('FEED_TEMPO_CHECKPOINT_RETAINED_SAMPLES_INVALID');
  }
  let previousObservedAt = 0;
  const retainedSamples = profile.retainedSamples.map((sample) => {
    const normalized = cloneRetainedSample(sample, {
      firstObservedAt,
      lastObservedAt,
      previousObservedAt,
      isContinuous,
    });
    previousObservedAt = normalized.observedAt;
    return normalized;
  });
  return Object.freeze({
    key,
    surface: Object.freeze(surface),
    episodeCount,
    sampleCount,
    effectiveEpisodeWeight,
    effectiveSampleWeight,
    firstObservedAt,
    lastObservedAt,
    decayEvaluatedAt,
    logDwellMean,
    logDwellVariance,
    adaptiveCenterDwellMs,
    adaptiveCenterScreenfuls,
    retainedSamples: Object.freeze(retainedSamples.map(Object.freeze)),
  });
}

export function requireFeedTempoProfileCheckpoint(value, {
  expectedProfileEpoch = null,
} = {}) {
  if (!hasExactKeys(value, CHECKPOINT_KEYS)) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_INVALID');
  }
  if (value.contract !== FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT_INVALID');
  }
  if (value.schemaVersion !== FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_INVALID');
  }
  const profileEpoch = requireProfileEpoch(
    value.profileEpoch,
    'FEED_TEMPO_PROFILE_CHECKPOINT_EPOCH_INVALID',
  );
  if (expectedProfileEpoch !== null && profileEpoch !== expectedProfileEpoch) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_EPOCH_MISMATCH');
  }
  const stateRevision = requireStateRevision(
    value.stateRevision,
    'FEED_TEMPO_PROFILE_CHECKPOINT_REVISION_INVALID',
  );
  const createdAt = requireTimestamp(
    value.createdAt,
    'FEED_TEMPO_PROFILE_CHECKPOINT_CREATED_AT_INVALID',
  );
  const updatedAt = requireTimestamp(
    value.updatedAt,
    'FEED_TEMPO_PROFILE_CHECKPOINT_UPDATED_AT_INVALID',
  );
  if (createdAt > updatedAt) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_TIME_ORDER_INVALID');
  }
  if (
    !Array.isArray(value.profiles)
    || value.profiles.length < 1
    || value.profiles.length > FEED_TEMPO_PROFILE_POLICY.profileLimit
  ) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_PROFILES_INVALID');
  }
  const seenKeys = new Set();
  let previousProfile = null;
  const profiles = value.profiles.map((profile) => {
    const normalized = requireFeedTempoCheckpointProfile(profile, {
      checkpointUpdatedAt: updatedAt,
    });
    if (seenKeys.has(normalized.key)) {
      throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_PROFILE_DUPLICATE');
    }
    seenKeys.add(normalized.key);
    if (
      previousProfile
      && (
        normalized.lastObservedAt < previousProfile.lastObservedAt
        || (
          normalized.lastObservedAt === previousProfile.lastObservedAt
          && normalized.key < previousProfile.key
        )
      )
    ) {
      throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_PROFILE_ORDER_INVALID');
    }
    previousProfile = normalized;
    return normalized;
  });
  return Object.freeze({
    contract: FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT,
    schemaVersion: FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    profileEpoch,
    stateRevision,
    createdAt,
    updatedAt,
    profiles: Object.freeze(profiles),
  });
}

export function createFeedTempoProfileCheckpoint({
  profileEpoch,
  now,
  stateRevision = 0,
  profiles = [],
} = {}) {
  return requireFeedTempoProfileCheckpoint({
    contract: FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT,
    schemaVersion: FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    profileEpoch,
    stateRevision,
    createdAt: now,
    updatedAt: now,
    profiles,
  }, { expectedProfileEpoch: profileEpoch });
}

export function rebaseFeedTempoProfileCheckpoint(
  checkpoint,
  targetProfileEpoch,
) {
  const normalized = requireFeedTempoProfileCheckpoint(checkpoint);
  const profileEpoch = requireProfileEpoch(
    targetProfileEpoch,
    'FEED_TEMPO_PROFILE_CHECKPOINT_REBASE_EPOCH_INVALID',
  );
  return requireFeedTempoProfileCheckpoint({
    ...normalized,
    profileEpoch,
    profiles: normalized.profiles.map((profile) => ({
      ...profile,
      surface: { ...profile.surface },
      retainedSamples: profile.retainedSamples.map((sample) => ({ ...sample })),
    })),
  }, { expectedProfileEpoch: profileEpoch });
}

export function isFeedTempoProfileCheckpointKey(key) {
  return key === FEED_TEMPO_PROFILE_CHECKPOINT_KEY;
}
