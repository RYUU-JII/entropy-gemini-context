import {
  FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT,
  FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION,
  FEED_TEMPO_PROFILE_PERSISTENCE,
  FEED_TEMPO_PROFILE_POLICY,
  buildFeedTempoCheckpointProfileKey,
  requireFeedTempoCheckpointProfile,
  requireFeedTempoProfileCheckpoint,
} from '../../../../platform/storage/model/FeedTempoProfileCheckpointContract.js';
import {
  FEED_TEMPO_CONTINUOUS_METRIC_GRAIN,
  FEED_TEMPO_INTERVENTION_STATES,
  FEED_TEMPO_METRIC_GRAIN,
  FEED_TEMPO_PROFILE_STATUSES,
  FEED_TEMPO_PROFILE_VERSION,
  FEED_TEMPO_REFERENCE_MODES,
  normalizeFeedTempoLearningEpisodeFact,
  normalizeFeedTempoSurface,
  resolveFeedTempoMetricGrain,
} from './feedTempoContracts.js';

const HUBER_CLIP_SIGMA = 3;
const ROBUST_WARMUP_WEIGHT = 5;
const STABLE_LEARNING_RATE = 0.08;
const MINIMUM_LOG_SIGMA = 0.12;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value) {
  return clamp(Number(value), 0, 1);
}

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function requireEvaluationTime(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('FEED_TEMPO_ADAPTIVE_MODEL_TIME_INVALID');
  }
  return value;
}

function decayFactor(elapsedMs, halfLifeMs) {
  if (elapsedMs <= 0) return 1;
  return 2 ** (-elapsedMs / halfLifeMs);
}

function getLogSigma(profile) {
  return Math.max(
    MINIMUM_LOG_SIGMA,
    Math.sqrt(Math.max(0, profile.logDwellVariance)),
  );
}

function sortRetainedSamples(samples, metricKey = 'dwellMs') {
  return [...samples].sort((left, right) => (
    (left.observedAt - right.observedAt)
    || (left[metricKey] - right[metricKey])
  ));
}

function weightedQuantile(samples, ratio, now, metricKey = 'dwellMs') {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const weighted = samples.map((sample) => ({
    value: sample[metricKey],
    weight: decayFactor(
      Math.max(0, now - sample.observedAt),
      FEED_TEMPO_PROFILE_POLICY.evidenceHalfLifeMs,
    ),
  })).sort((left, right) => left.value - right.value);
  const totalWeight = weighted.reduce((sum, sample) => sum + sample.weight, 0);
  if (!(totalWeight > 0)) return null;
  const target = totalWeight * ratio;
  let accumulated = 0;
  for (const sample of weighted) {
    accumulated += sample.weight;
    if (accumulated >= target) return sample.value;
  }
  return weighted[weighted.length - 1].value;
}

function resolveProfileStatus(profile) {
  if (
    !profile
    || profile.effectiveSampleWeight < FEED_TEMPO_PROFILE_POLICY.sparseSampleWeight
  ) {
    return FEED_TEMPO_PROFILE_STATUSES.SPARSE;
  }
  if (
    profile.effectiveSampleWeight >= FEED_TEMPO_PROFILE_POLICY.stableSampleWeight
    && profile.effectiveEpisodeWeight >= FEED_TEMPO_PROFILE_POLICY.stableEpisodeWeight
  ) {
    return FEED_TEMPO_PROFILE_STATUSES.STABLE;
  }
  return FEED_TEMPO_PROFILE_STATUSES.FORMING;
}

function projectProfileAt(profile, now) {
  const normalizedNow = requireEvaluationTime(now);
  const normalized = requireFeedTempoCheckpointProfile(profile, {
    checkpointUpdatedAt: Math.max(normalizedNow, profile.decayEvaluatedAt),
  });
  if (normalizedNow < normalized.decayEvaluatedAt) {
    throw new Error('FEED_TEMPO_ADAPTIVE_MODEL_DECAY_TIME_REGRESSION');
  }
  const factor = decayFactor(
    normalizedNow - normalized.decayEvaluatedAt,
    FEED_TEMPO_PROFILE_POLICY.evidenceHalfLifeMs,
  );
  return {
    ...normalized,
    surface: { ...normalized.surface },
    effectiveEpisodeWeight: normalized.effectiveEpisodeWeight * factor,
    effectiveSampleWeight: normalized.effectiveSampleWeight * factor,
    decayEvaluatedAt: normalizedNow,
    retainedSamples: normalized.retainedSamples.map((sample) => ({ ...sample })),
  };
}

function createEmptyProfileSummary(surface, {
  excludedEpisodeCount = 0,
  checkpointStateRevision = null,
} = {}) {
  const normalizedSurface = normalizeFeedTempoSurface(surface);
  const isContinuous = normalizedSurface.surfaceMode === 'continuous';
  return {
    version: FEED_TEMPO_PROFILE_VERSION,
    metricGrain: resolveFeedTempoMetricGrain(normalizedSurface),
    status: FEED_TEMPO_PROFILE_STATUSES.SPARSE,
    persistence: FEED_TEMPO_PROFILE_PERSISTENCE,
    surface: { ...normalizedSurface },
    episodeCount: 0,
    sampleCount: 0,
    effectiveEpisodeWeight: 0,
    effectiveSampleWeight: 0,
    firstObservedAt: 0,
    lastObservedAt: 0,
    decayEvaluatedAt: 0,
    freshnessConfidence: 0,
    adaptiveCenterDwellMs: isContinuous ? null : FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs,
    adaptiveCenterScreenfuls: FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls,
    observedMedianDwellMs: null,
    observedMedianScreenfuls: null,
    lowerQuartileDwellMs: null,
    upperQuartileDwellMs: null,
    logDwellMean: null,
    logDwellVariance: null,
    excludedEpisodeCount,
    checkpointStateRevision,
  };
}

export function summarizeFeedTempoAdaptiveProfile(profile, {
  now,
  excludedEpisodeCount = 0,
  checkpointStateRevision = null,
} = {}) {
  if (profile === null) {
    throw new Error('FEED_TEMPO_ADAPTIVE_PROFILE_SUMMARY_PROFILE_REQUIRED');
  }
  const projected = projectProfileAt(profile, now);
  const freshnessConfidence = decayFactor(
    Math.max(0, now - projected.lastObservedAt),
    FEED_TEMPO_PROFILE_POLICY.confidenceHalfLifeMs,
  );
  const isContinuous = projected.surface.surfaceMode === 'continuous';
  const observedMedian = weightedQuantile(
    projected.retainedSamples,
    0.5,
    now,
    isContinuous ? 'screenfuls' : 'dwellMs',
  );
  return {
    version: FEED_TEMPO_PROFILE_VERSION,
    metricGrain: resolveFeedTempoMetricGrain(projected.surface),
    status: resolveProfileStatus(projected),
    persistence: FEED_TEMPO_PROFILE_PERSISTENCE,
    surface: { ...projected.surface },
    episodeCount: projected.episodeCount,
    sampleCount: projected.sampleCount,
    effectiveEpisodeWeight: round(projected.effectiveEpisodeWeight),
    effectiveSampleWeight: round(projected.effectiveSampleWeight),
    firstObservedAt: projected.firstObservedAt,
    lastObservedAt: projected.lastObservedAt,
    decayEvaluatedAt: projected.decayEvaluatedAt,
    freshnessConfidence: round(freshnessConfidence),
    adaptiveCenterDwellMs: isContinuous ? null : projected.adaptiveCenterDwellMs,
    adaptiveCenterScreenfuls: projected.adaptiveCenterScreenfuls,
    observedMedianDwellMs: isContinuous ? null : observedMedian,
    observedMedianScreenfuls: isContinuous ? observedMedian : null,
    lowerQuartileDwellMs: isContinuous ? null : weightedQuantile(
      projected.retainedSamples,
      0.25,
      now,
    ),
    upperQuartileDwellMs: isContinuous ? null : weightedQuantile(
      projected.retainedSamples,
      0.75,
      now,
    ),
    logDwellMean: isContinuous ? null : round(projected.logDwellMean),
    logDwellVariance: isContinuous ? null : round(projected.logDwellVariance),
    excludedEpisodeCount,
    checkpointStateRevision,
  };
}

export function evaluateFeedTempoEpisodeAgainstProfile({
  fact: rawFact,
  profile = null,
  now,
} = {}) {
  const fact = normalizeFeedTempoLearningEpisodeFact(rawFact);
  const evaluatedAt = requireEvaluationTime(now);
  const projected = profile === null ? null : projectProfileAt(profile, evaluatedAt);
  if (projected && projected.key !== buildFeedTempoCheckpointProfileKey(fact.surface)) {
    throw new Error('FEED_TEMPO_ADAPTIVE_EVALUATION_SURFACE_MISMATCH');
  }
  const status = resolveProfileStatus(projected);
  const isContinuous = fact.surface.surfaceMode === 'continuous';
  const freshnessConfidence = projected
    ? decayFactor(
      Math.max(0, evaluatedAt - projected.lastObservedAt),
      FEED_TEMPO_PROFILE_POLICY.confidenceHalfLifeMs,
    )
    : 0;
  const maturityWeight = projected && status !== FEED_TEMPO_PROFILE_STATUSES.SPARSE
    ? clamp01(
      (
        projected.effectiveSampleWeight
        - FEED_TEMPO_PROFILE_POLICY.sparseSampleWeight
      )
      / (
        FEED_TEMPO_PROFILE_POLICY.stableSampleWeight
        - FEED_TEMPO_PROFILE_POLICY.sparseSampleWeight
      ),
    )
    : 0;
  const adaptiveWeight = maturityWeight * freshnessConfidence;

  let referenceDwellMs = isContinuous ? null : FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs;
  let referenceScreenfuls = FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls;
  const currentMedianDwellMs = isContinuous ? null : fact.medianDwellMs;
  const currentScreenfuls = fact.screenfulsConsumed;
  let amountRatio = null;
  let amountComparison = 'unavailable';
  let paceRatio = null;
  let fastnessZ = null;
  let direction = 'unknown';

  if (isContinuous) {
    const adaptiveCenterScreenfuls = projected
      ? projected.adaptiveCenterScreenfuls
      : FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls;
    const blendedReference = (
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls * (1 - adaptiveWeight)
    ) + (adaptiveCenterScreenfuls * adaptiveWeight);
    const minRef = (
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
      * FEED_TEMPO_PROFILE_POLICY.adaptiveContinuousMinRatio
    );
    const maxRef = (
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
      * FEED_TEMPO_PROFILE_POLICY.adaptiveContinuousMaxRatio
    );
    referenceScreenfuls = round(clamp(blendedReference, minRef, maxRef), 2);
    if (currentScreenfuls > 0) {
      amountRatio = currentScreenfuls / referenceScreenfuls;
      amountComparison = currentScreenfuls < referenceScreenfuls
        ? 'below_reference'
        : (currentScreenfuls > referenceScreenfuls ? 'above_reference' : 'at_reference');
    }
  } else {
    const adaptiveCenterDwellMs = projected
      ? projected.adaptiveCenterDwellMs
      : FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs;
    const blendedReferenceMs = (
      FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs * (1 - adaptiveWeight)
    ) + (adaptiveCenterDwellMs * adaptiveWeight);
    const minimumReference = (
      FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs
      * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMinRatio
    );
    const maximumReference = (
      FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs
      * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMaxRatio
    );
    referenceDwellMs = Math.round(clamp(
      blendedReferenceMs,
      minimumReference,
      maximumReference,
    ));
    paceRatio = currentMedianDwellMs === null
      ? null
      : referenceDwellMs / currentMedianDwellMs;
    fastnessZ = (
      currentMedianDwellMs !== null
      && projected
      && projected.effectiveSampleWeight >= 2
    )
      ? (
        projected.logDwellMean - Math.log1p(currentMedianDwellMs)
      ) / getLogSigma(projected)
      : null;
    if (paceRatio !== null) {
      if ((fastnessZ !== null && fastnessZ >= 1) || paceRatio >= 1.35) {
        direction = 'faster';
      } else if ((fastnessZ !== null && fastnessZ <= -1) || paceRatio <= 0.75) {
        direction = 'slower';
      } else {
        direction = 'typical';
      }
    }
  }

  const sampleConfidence = projected
    ? clamp01(
      projected.effectiveSampleWeight
      / FEED_TEMPO_PROFILE_POLICY.stableSampleWeight,
    )
    : 0;
  const episodeConfidence = projected
    ? clamp01(
      projected.effectiveEpisodeWeight
      / FEED_TEMPO_PROFILE_POLICY.stableEpisodeWeight,
    )
    : 0;
  const confidence = clamp01(
    Math.min(sampleConfidence, episodeConfidence)
    * freshnessConfidence
    * fact.measurementConfidence,
  );
  const reasons = [];
  if (isContinuous) reasons.push('continuous_pace_unmeasured');
  if (!isContinuous && currentMedianDwellMs === null) reasons.push('episode_dwell_unavailable');
  if (isContinuous && !(currentScreenfuls > 0)) reasons.push('episode_screenfuls_unavailable');
  if (status === FEED_TEMPO_PROFILE_STATUSES.SPARSE) {
    reasons.push('personal_profile_sparse');
  }
  if (projected && freshnessConfidence < 0.9999) {
    reasons.push('profile_confidence_decayed');
  }
  if (adaptiveWeight < 1) reasons.push('normative_anchor_active');
  if (direction === 'faster') reasons.push('dwell_below_reference');
  if (direction === 'slower') reasons.push('dwell_above_reference');
  if (direction === 'typical') reasons.push('dwell_within_reference');
  if (!isFeedTempoEpisodeEligibleForPersistence(fact)) {
    reasons.push('episode_excluded_from_observed_baseline');
  }

  const observedMedian = projected
    ? weightedQuantile(
      projected.retainedSamples,
      0.5,
      evaluatedAt,
      isContinuous ? 'screenfuls' : 'dwellMs',
    )
    : null;

  return Object.freeze({
    version: FEED_TEMPO_PROFILE_VERSION,
    metricGrain: resolveFeedTempoMetricGrain(fact.surface),
    evaluatedAt,
    profileKey: buildFeedTempoCheckpointProfileKey(fact.surface),
    status,
    referenceMode: adaptiveWeight > 0
      ? FEED_TEMPO_REFERENCE_MODES.BOUNDED_ADAPTIVE
      : FEED_TEMPO_REFERENCE_MODES.NORMATIVE_ONLY,
    referenceSource: adaptiveWeight > 0 ? 'domain_surface' : 'normative',
    referenceDwellMs,
    referenceScreenfuls: isContinuous ? referenceScreenfuls : null,
    adaptiveCenterScreenfuls: isContinuous
      ? (projected === null
        ? FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
        : projected.adaptiveCenterScreenfuls)
      : null,
    observedMedianDwellMs: isContinuous ? null : observedMedian,
    observedMedianScreenfuls: isContinuous ? observedMedian : null,
    currentMedianDwellMs,
    currentScreenfuls: isContinuous ? currentScreenfuls : null,
    amountRatio: amountRatio === null ? null : round(amountRatio, 4),
    amountComparison,
    paceRatio: paceRatio === null ? null : round(paceRatio, 4),
    fastnessZ: fastnessZ === null ? null : round(fastnessZ, 4),
    direction,
    confidence: round(confidence, 4),
    reasons: Object.freeze(reasons),
  });
}

export function isFeedTempoEpisodeEligibleForPersistence(rawFact) {
  const fact = normalizeFeedTempoLearningEpisodeFact(rawFact);
  const isPaged = fact.surface.surfaceMode === 'paged';
  const isContinuous = fact.surface.surfaceMode === 'continuous';
  if (!isPaged && !isContinuous) return false;
  if (fact.eligibleForObservedBaseline !== true) return false;
  if (fact.interventionState !== FEED_TEMPO_INTERVENTION_STATES.UNASSISTED) return false;
  if (fact.measurementConfidence < FEED_TEMPO_PROFILE_POLICY.minimumLearningConfidence) return false;
  if (isContinuous) {
    const screenfuls = Number(fact.screenfulsConsumed);
    return (
      Number.isFinite(screenfuls)
      && screenfuls >= FEED_TEMPO_PROFILE_POLICY.minimumScreenfuls
      && screenfuls <= FEED_TEMPO_PROFILE_POLICY.maximumScreenfuls
    );
  }
  return (
    fact.dwellSamplesMs.length > 0
    && fact.dwellSamplesMs.every((dwellMs) => (
      dwellMs >= FEED_TEMPO_PROFILE_POLICY.minimumDwellMs
      && dwellMs <= FEED_TEMPO_PROFILE_POLICY.maximumDwellMs
    ))
  );
}

function updateLogStatistics(profile, dwellMs, sampleWeight) {
  const value = Math.log1p(dwellMs);
  if (!(profile.effectiveSampleWeight > 0)) {
    profile.logDwellMean = value;
    profile.logDwellVariance = 0;
    profile.effectiveSampleWeight = sampleWeight;
    return;
  }
  const residual = value - profile.logDwellMean;
  const boundedResidual = profile.effectiveSampleWeight < ROBUST_WARMUP_WEIGHT
    ? residual
    : clamp(
      residual,
      -HUBER_CLIP_SIGMA * getLogSigma(profile),
      HUBER_CLIP_SIGMA * getLogSigma(profile),
    );
  const alpha = profile.effectiveSampleWeight < ROBUST_WARMUP_WEIGHT
    ? sampleWeight / (profile.effectiveSampleWeight + sampleWeight)
    : STABLE_LEARNING_RATE * sampleWeight;
  profile.logDwellMean += alpha * boundedResidual;
  profile.logDwellVariance = Math.max(0, (1 - alpha) * (
    profile.logDwellVariance + (alpha * boundedResidual * boundedResidual)
  ));
  profile.effectiveSampleWeight += sampleWeight;
}

function createProfileFromFact(fact, now) {
  return {
    key: buildFeedTempoCheckpointProfileKey(fact.surface),
    surface: { ...fact.surface },
    episodeCount: 0,
    sampleCount: 0,
    effectiveEpisodeWeight: 0,
    effectiveSampleWeight: 0,
    firstObservedAt: fact.endedAt,
    lastObservedAt: fact.endedAt,
    decayEvaluatedAt: now,
    logDwellMean: 0,
    logDwellVariance: 0,
    adaptiveCenterDwellMs: FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs,
    adaptiveCenterScreenfuls: FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls,
    retainedSamples: [],
  };
}

function applyEpisodeToProfile(profile, fact, now) {
  const next = profile
    ? projectProfileAt(profile, now)
    : createProfileFromFact(fact, now);
  const episodeWeight = fact.measurementConfidence;
  next.episodeCount += 1;
  next.effectiveEpisodeWeight += episodeWeight;
  next.firstObservedAt = Math.min(next.firstObservedAt, fact.endedAt);
  next.lastObservedAt = Math.max(next.lastObservedAt, fact.endedAt);
  next.decayEvaluatedAt = now;

  if (fact.surface.surfaceMode === 'continuous') {
    const screenfuls = fact.screenfulsConsumed;
    next.sampleCount += 1;
    // Checkpoint v2 retains this scaled amount encoding in its required dwell
    // fields. It is not elapsed time; public projections and amount learning
    // read screenfuls directly. Removing the encoding requires a schema cutover.
    const encodedAmount = Math.round(screenfuls * 1000);
    updateLogStatistics(next, encodedAmount, episodeWeight);
    next.retainedSamples.push({
      dwellMs: encodedAmount,
      screenfuls: round(screenfuls, 2),
      observedAt: fact.endedAt,
    });
    next.retainedSamples = sortRetainedSamples(next.retainedSamples, 'screenfuls');
    if (next.retainedSamples.length > FEED_TEMPO_PROFILE_POLICY.sampleRetention) {
      next.retainedSamples.splice(
        0,
        next.retainedSamples.length - FEED_TEMPO_PROFILE_POLICY.sampleRetention,
      );
    }
    const targetCenterScreenfuls = weightedQuantile(next.retainedSamples, 0.5, now, 'screenfuls');
    if (targetCenterScreenfuls === null) {
      throw new Error('FEED_TEMPO_CONTINUOUS_AMOUNT_SAMPLES_REQUIRED');
    }
    const currentCenter = next.adaptiveCenterScreenfuls;
    const maximumStep = Math.max(
      0.05,
      round(
        currentCenter
        * FEED_TEMPO_PROFILE_POLICY.maximumCenterStepRatio,
        3,
      ),
    );
    const boundedTarget = clamp(
      targetCenterScreenfuls,
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
      * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMinRatio,
      FEED_TEMPO_PROFILE_POLICY.normativeContinuousScreenfuls
      * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMaxRatio,
    );
    next.adaptiveCenterScreenfuls = round(clamp(
      boundedTarget,
      currentCenter - maximumStep,
      currentCenter + maximumStep,
    ), 2);
  } else {
    next.sampleCount += fact.dwellSamplesMs.length;
    fact.dwellSamplesMs.forEach((dwellMs) => {
      updateLogStatistics(next, dwellMs, episodeWeight);
      next.retainedSamples.push({
        dwellMs,
        screenfuls: null,
        observedAt: fact.endedAt,
      });
    });
    next.retainedSamples = sortRetainedSamples(next.retainedSamples);
    if (next.retainedSamples.length > FEED_TEMPO_PROFILE_POLICY.sampleRetention) {
      next.retainedSamples.splice(
        0,
        next.retainedSamples.length - FEED_TEMPO_PROFILE_POLICY.sampleRetention,
      );
    }
    const targetCenter = weightedQuantile(next.retainedSamples, 0.5, now);
    const maximumStep = Math.max(
      1,
      Math.round(
        next.adaptiveCenterDwellMs
        * FEED_TEMPO_PROFILE_POLICY.maximumCenterStepRatio,
      ),
    );
    const boundedTarget = clamp(
      targetCenter,
      Math.round(
        FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs
        * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMinRatio,
      ),
      Math.round(
        FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs
        * FEED_TEMPO_PROFILE_POLICY.adaptiveReferenceMaxRatio,
      ),
    );
    next.adaptiveCenterDwellMs = Math.round(clamp(
      boundedTarget,
      next.adaptiveCenterDwellMs - maximumStep,
      next.adaptiveCenterDwellMs + maximumStep,
    ));
  }

  next.effectiveEpisodeWeight = round(next.effectiveEpisodeWeight);
  next.effectiveSampleWeight = round(next.effectiveSampleWeight);
  next.logDwellMean = round(next.logDwellMean);
  next.logDwellVariance = round(next.logDwellVariance);
  return requireFeedTempoCheckpointProfile(next, {
    checkpointUpdatedAt: now,
  });
}

function sortProfiles(profiles) {
  return [...profiles].sort((left, right) => (
    (left.lastObservedAt - right.lastObservedAt)
    || left.key.localeCompare(right.key)
  ));
}

export function applyEligibleEpisodeToFeedTempoCheckpoint({
  checkpoint = null,
  profileEpoch,
  fact: rawFact,
  now,
} = {}) {
  const fact = normalizeFeedTempoLearningEpisodeFact(rawFact);
  const observedAt = requireEvaluationTime(now);
  if (!isFeedTempoEpisodeEligibleForPersistence(fact)) {
    throw new Error('FEED_TEMPO_PERSISTED_EPISODE_INELIGIBLE');
  }
  const current = checkpoint === null
    ? null
    : requireFeedTempoProfileCheckpoint(checkpoint, {
      expectedProfileEpoch: profileEpoch,
    });
  if (current && observedAt < current.updatedAt) {
    throw new Error('FEED_TEMPO_CHECKPOINT_UPDATE_TIME_REGRESSION');
  }
  const profileKey = buildFeedTempoCheckpointProfileKey(fact.surface);
  const currentProfile = current
    ? current.profiles.find((profile) => profile.key === profileKey) || null
    : null;
  const evaluation = evaluateFeedTempoEpisodeAgainstProfile({
    fact,
    profile: currentProfile,
    now: observedAt,
  });
  const nextProfile = applyEpisodeToProfile(
    currentProfile,
    fact,
    observedAt,
  );
  const retainedProfiles = current
    ? current.profiles.filter((profile) => profile.key !== profileKey)
    : [];
  retainedProfiles.push(nextProfile);
  let profiles = sortProfiles(retainedProfiles);
  if (profiles.length > FEED_TEMPO_PROFILE_POLICY.profileLimit) {
    profiles = profiles.slice(
      profiles.length - FEED_TEMPO_PROFILE_POLICY.profileLimit,
    );
  }
  const nextCheckpoint = requireFeedTempoProfileCheckpoint({
    contract: FEED_TEMPO_PROFILE_CHECKPOINT_CONTRACT,
    schemaVersion: FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    profileEpoch,
    stateRevision: current === null ? 0 : current.stateRevision + 1,
    createdAt: current === null ? observedAt : current.createdAt,
    updatedAt: observedAt,
    profiles: profiles.map((profile) => ({
      ...profile,
      surface: { ...profile.surface },
      retainedSamples: profile.retainedSamples.map((sample) => ({ ...sample })),
    })),
  }, { expectedProfileEpoch: profileEpoch });
  return Object.freeze({
    evaluation,
    checkpoint: nextCheckpoint,
    profileState: nextProfile,
    profile: Object.freeze(summarizeFeedTempoAdaptiveProfile(nextProfile, {
      now: observedAt,
      checkpointStateRevision: nextCheckpoint.stateRevision,
    })),
  });
}

export function restoreFeedTempoAdaptiveProfile({
  checkpoint = null,
  profileEpoch,
  surface,
  now,
} = {}) {
  const normalizedSurface = normalizeFeedTempoSurface(surface);
  const restoredAt = requireEvaluationTime(now);
  if (checkpoint === null) {
    return Object.freeze({
      checkpointFound: false,
      checkpointStateRevision: null,
      profileState: null,
      profile: Object.freeze(createEmptyProfileSummary(normalizedSurface)),
    });
  }
  const normalized = requireFeedTempoProfileCheckpoint(checkpoint, {
    expectedProfileEpoch: profileEpoch,
  });
  if (restoredAt < normalized.updatedAt) {
    throw new Error('FEED_TEMPO_CHECKPOINT_RESTORE_TIME_REGRESSION');
  }
  const key = buildFeedTempoCheckpointProfileKey(normalizedSurface);
  const storedProfile = normalized.profiles.find((profile) => profile.key === key) || null;
  if (storedProfile === null) {
    return Object.freeze({
      checkpointFound: true,
      checkpointStateRevision: normalized.stateRevision,
      profileState: null,
      profile: Object.freeze(createEmptyProfileSummary(normalizedSurface, {
        checkpointStateRevision: normalized.stateRevision,
      })),
    });
  }
  const profileState = requireFeedTempoCheckpointProfile(
    projectProfileAt(storedProfile, restoredAt),
    { checkpointUpdatedAt: restoredAt },
  );
  return Object.freeze({
    checkpointFound: true,
    checkpointStateRevision: normalized.stateRevision,
    profileState,
    profile: Object.freeze(summarizeFeedTempoAdaptiveProfile(profileState, {
      now: restoredAt,
      checkpointStateRevision: normalized.stateRevision,
    })),
  });
}
