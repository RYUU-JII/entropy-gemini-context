import { FEED_SURFACE_MODES } from '../registry/feedSurfaceProfiles.js';

export const FEED_STRUCTURE_LEARNER_VERSION = 'feed-structure-learner-v1';

export const FEED_STRUCTURE_LEARNING_STATES = Object.freeze({
  PENDING: 'pending',
  WARMING: 'warming',
  READY: 'ready',
  VOLATILE: 'volatile',
  INVALID: 'invalid',
});

const SURFACE_MODE_ORDER = Object.freeze([
  FEED_SURFACE_MODES.CONTINUOUS,
  FEED_SURFACE_MODES.PAGED,
  FEED_SURFACE_MODES.HYBRID,
  FEED_SURFACE_MODES.DOCUMENT,
  FEED_SURFACE_MODES.UNKNOWN,
]);

const FEED_SURFACE_MODE_SET = new Set([
  FEED_SURFACE_MODES.CONTINUOUS,
  FEED_SURFACE_MODES.PAGED,
  FEED_SURFACE_MODES.HYBRID,
]);

const SUPPORTED_OBSERVATION_FIELDS = new Set([
  'surfaceMode',
  'surfaceConfidence',
  'supplyStep',
  'demand',
  'normalizedStepSize',
  'appendIntervalMs',
  'dominantTransitionConfirmed',
  'virtualTurnover',
  'containerReset',
]);

const POLICY = Object.freeze({
  defaultWindowSize: 48,
  minWindowSize: 12,
  maxWindowSize: 96,
  knownMinSamples: 6,
  unknownMinSamples: 10,
  knownMinSurfaceSamples: 5,
  unknownMinSurfaceSamples: 8,
  minDynamicConfirmations: 3,
  minContainerSamples: 4,
  minRepeatedContainerResets: 2,
  minContainerStableTailSamples: 3,
  minSurfaceConfidence: 0.65,
  minSurfaceConsensus: 0.75,
  maxReadyResetRatio: 0.2,
  maxReadyRejectedRatio: 0.2,
  minReadyConfidence: 0.72,
  volatileMinSamples: 6,
  volatileResetRatio: 0.4,
  volatileSurfaceConsensus: 0.55,
  volatileStepCoefficient: 1.25,
  volatileIntervalCoefficient: 1.5,
  invalidMinSamples: 4,
  invalidRejectedRatio: 0.6,
  nonFeedMinSurfaceSamples: 5,
  nonFeedConsensus: 0.8,
  nonFeedConfidence: 0.75,
  maxNormalizedStepSize: 64,
  maxAppendIntervalMs: 600000,
});

const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function hasOwn(value, key) {
  return PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function isObjectRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round4(value) {
  return Number(value.toFixed(4));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round4(numerator / denominator) : null;
}

function summarizeNumbers(values) {
  if (values.length === 0) {
    return {
      count: 0,
      mean: null,
      variance: null,
      coefficientOfVariation: null,
    };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => {
    const delta = value - mean;
    return sum + (delta * delta);
  }, 0) / values.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return {
    count: values.length,
    mean: round4(mean),
    variance: round4(variance),
    coefficientOfVariation: round4(coefficientOfVariation),
  };
}

function appendRejection(rejections, reason) {
  if (!rejections.includes(reason)) rejections.push(reason);
}

function validateBoolean(observation, fieldName, rejections) {
  if (!hasOwn(observation, fieldName)) return;
  if (typeof observation[fieldName] !== 'boolean') {
    appendRejection(rejections, `${fieldName}_invalid`);
  }
}

function validateFiniteRange(observation, fieldName, min, max, rejections) {
  if (!hasOwn(observation, fieldName)) return;
  const value = observation[fieldName];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    appendRejection(rejections, `${fieldName}_invalid`);
  }
}

function normalizeObservation(observation) {
  if (!isObjectRecord(observation)) {
    return { accepted: false, rejectionReasons: ['observation_not_object'] };
  }

  const fields = Object.keys(observation);
  const rejections = [];
  if (fields.length === 0) appendRejection(rejections, 'observation_empty');
  if (fields.some((field) => !SUPPORTED_OBSERVATION_FIELDS.has(field))) {
    appendRejection(rejections, 'observation_field_unsupported');
  }

  const hasSurfaceMode = hasOwn(observation, 'surfaceMode');
  const hasSurfaceConfidence = hasOwn(observation, 'surfaceConfidence');
  if (hasSurfaceMode !== hasSurfaceConfidence) {
    appendRejection(rejections, 'surface_pair_incomplete');
  }
  if (hasSurfaceMode && !SURFACE_MODE_ORDER.includes(observation.surfaceMode)) {
    appendRejection(rejections, 'surfaceMode_invalid');
  }
  validateFiniteRange(observation, 'surfaceConfidence', 0, 1, rejections);

  validateBoolean(observation, 'supplyStep', rejections);
  validateBoolean(observation, 'demand', rejections);
  validateBoolean(observation, 'dominantTransitionConfirmed', rejections);
  validateBoolean(observation, 'virtualTurnover', rejections);
  validateBoolean(observation, 'containerReset', rejections);
  validateFiniteRange(
    observation,
    'normalizedStepSize',
    Number.MIN_VALUE,
    POLICY.maxNormalizedStepSize,
    rejections,
  );
  validateFiniteRange(
    observation,
    'appendIntervalMs',
    Number.MIN_VALUE,
    POLICY.maxAppendIntervalMs,
    rejections,
  );

  const hasSupplyMetric = hasOwn(observation, 'normalizedStepSize')
    || hasOwn(observation, 'appendIntervalMs');
  if ((observation.demand === true || hasSupplyMetric) && observation.supplyStep !== true) {
    appendRejection(rejections, 'supply_relationship_invalid');
  }

  if (rejections.length > 0) {
    return { accepted: false, rejectionReasons: rejections };
  }

  const normalized = { accepted: true };
  SUPPORTED_OBSERVATION_FIELDS.forEach((field) => {
    if (hasOwn(observation, field)) normalized[field] = observation[field];
  });
  return normalized;
}

function countTrue(records, fieldName) {
  return records.reduce((count, record) => count + (record[fieldName] === true ? 1 : 0), 0);
}

function countPresent(records, fieldName) {
  return records.reduce((count, record) => count + (hasOwn(record, fieldName) ? 1 : 0), 0);
}

function collectNumbers(records, fieldName) {
  return records
    .filter((record) => hasOwn(record, fieldName))
    .map((record) => record[fieldName]);
}

function countTrailingFalse(records, fieldName) {
  let count = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!hasOwn(record, fieldName)) continue;
    if (record[fieldName] === true) break;
    count += 1;
  }
  return count;
}

function buildModeReadout(surfaceRecords) {
  const modeCounts = Object.fromEntries(SURFACE_MODE_ORDER.map((mode) => [mode, 0]));
  surfaceRecords.forEach((record) => {
    modeCounts[record.surfaceMode] += 1;
  });

  const dominantSurfaceMode = surfaceRecords.length > 0
    ? SURFACE_MODE_ORDER.reduce((winner, mode) => (
      modeCounts[mode] > modeCounts[winner] ? mode : winner
    ), SURFACE_MODE_ORDER[0])
    : null;
  const dominantCount = dominantSurfaceMode === null ? 0 : modeCounts[dominantSurfaceMode];
  const feedSurfaceCount = surfaceRecords.reduce(
    (count, record) => count + (FEED_SURFACE_MODE_SET.has(record.surfaceMode) ? 1 : 0),
    0,
  );

  return {
    dominantSurfaceMode,
    modeCounts,
    consensusRatio: ratio(dominantCount, surfaceRecords.length),
    feedSurfaceRatio: ratio(feedSurfaceCount, surfaceRecords.length),
  };
}

function buildRejectionReadout(records) {
  const counts = new Map();
  records.forEach((record) => {
    if (record.accepted) return;
    record.rejectionReasons.forEach((reason) => {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((left, right) => (right[1] - left[1]) || left[0].localeCompare(right[0]))
    .map(([reason, count]) => ({ reason, count }));
}

function buildStatistics(records) {
  const acceptedRecords = records.filter((record) => record.accepted);
  const rejectedRecords = records.filter((record) => !record.accepted);
  const surfaceRecords = acceptedRecords.filter((record) => hasOwn(record, 'surfaceMode'));
  const mode = buildModeReadout(surfaceRecords);
  const surfaceConfidence = summarizeNumbers(collectNumbers(surfaceRecords, 'surfaceConfidence'));
  const normalizedStepSize = summarizeNumbers(collectNumbers(acceptedRecords, 'normalizedStepSize'));
  const appendIntervalMs = summarizeNumbers(collectNumbers(acceptedRecords, 'appendIntervalMs'));

  const supplyObservations = countPresent(acceptedRecords, 'supplyStep');
  const supplySteps = countTrue(acceptedRecords, 'supplyStep');
  const demandSteps = countTrue(acceptedRecords, 'demand');
  const transitionObservations = countPresent(acceptedRecords, 'dominantTransitionConfirmed');
  const confirmedTransitions = countTrue(acceptedRecords, 'dominantTransitionConfirmed');
  const virtualTurnoverObservations = countPresent(acceptedRecords, 'virtualTurnover');
  const virtualTurnovers = countTrue(acceptedRecords, 'virtualTurnover');
  const containerObservations = countPresent(acceptedRecords, 'containerReset');
  const containerResets = countTrue(acceptedRecords, 'containerReset');
  const containerStableTailSamples = countTrailingFalse(
    acceptedRecords,
    'containerReset',
  );
  // These flags can describe the same DOM change. Without independent sensor
  // provenance they form one evidence family, with at most one vote per record.
  const dynamicConfirmationCount = acceptedRecords.filter((record) => (
    record.supplyStep === true || record.dominantTransitionConfirmed === true
    || record.virtualTurnover === true
  )).length;

  const surfaceIsAuthoritative = mode.dominantSurfaceMode !== null
    && FEED_SURFACE_MODE_SET.has(mode.dominantSurfaceMode)
    && surfaceConfidence.mean >= POLICY.minSurfaceConfidence
    && mode.consensusRatio >= POLICY.minSurfaceConsensus;
  const corroboratingChannels = [
    surfaceIsAuthoritative,
    dynamicConfirmationCount >= 2,
  ].filter(Boolean).length;

  return {
    acceptedRecords,
    rejectedRecords,
    surfaceRecords,
    surfaceConfidence,
    normalizedStepSize,
    appendIntervalMs,
    mode,
    supplyObservations,
    supplySteps,
    demandSteps,
    transitionObservations,
    confirmedTransitions,
    virtualTurnoverObservations,
    virtualTurnovers,
    containerObservations,
    containerResets,
    containerStableTailSamples,
    dynamicConfirmationCount,
    corroboratingChannels,
    ratios: {
      rejected: ratio(rejectedRecords.length, records.length),
      supplyStep: ratio(supplySteps, supplyObservations),
      demand: ratio(demandSteps, supplySteps),
      transitionConfirmation: ratio(confirmedTransitions, transitionObservations),
      virtualTurnover: ratio(virtualTurnovers, virtualTurnoverObservations),
      containerReset: ratio(containerResets, containerObservations),
    },
  };
}

function requiresStableContainer(stats) {
  return stats.mode.dominantSurfaceMode !== FEED_SURFACE_MODES.PAGED;
}

function buildVolatilityReasons(stats) {
  const reasons = [];
  if (
    requiresStableContainer(stats)
    &&
    stats.containerObservations >= 4
    && stats.ratios.containerReset >= POLICY.volatileResetRatio
    && stats.containerStableTailSamples < POLICY.minContainerStableTailSamples
  ) {
    reasons.push('container_instability');
  }
  if (
    stats.surfaceRecords.length >= POLICY.volatileMinSamples
    && stats.mode.consensusRatio < POLICY.volatileSurfaceConsensus
  ) {
    reasons.push('surface_mode_instability');
  }
  if (
    stats.normalizedStepSize.count >= 5
    && stats.normalizedStepSize.coefficientOfVariation > POLICY.volatileStepCoefficient
  ) {
    reasons.push('step_size_instability');
  }
  if (
    stats.appendIntervalMs.count >= 5
    && stats.appendIntervalMs.coefficientOfVariation > POLICY.volatileIntervalCoefficient
  ) {
    reasons.push('append_cadence_instability');
  }
  return reasons;
}

function buildInvalidReasons(stats, windowSampleCount) {
  const reasons = [];
  if (
    windowSampleCount >= POLICY.invalidMinSamples
    && stats.ratios.rejected >= POLICY.invalidRejectedRatio
  ) {
    reasons.push('observation_quality_invalid');
  }
  if (
    stats.surfaceRecords.length >= POLICY.nonFeedMinSurfaceSamples
    && stats.mode.dominantSurfaceMode === FEED_SURFACE_MODES.DOCUMENT
    && stats.mode.consensusRatio >= POLICY.nonFeedConsensus
    && stats.surfaceConfidence.mean >= POLICY.nonFeedConfidence
  ) {
    reasons.push('non_feed_surface_confirmed');
  }
  return reasons;
}

function buildConfidence(stats, requirements) {
  if (stats.acceptedRecords.length === 0) return 0;

  const sampleCoverage = clamp01(stats.acceptedRecords.length / requirements.minSamples);
  const surfaceCoverage = clamp01(stats.surfaceRecords.length / requirements.minSurfaceSamples);
  const dominantModeIsFeed = FEED_SURFACE_MODE_SET.has(stats.mode.dominantSurfaceMode);
  const surfaceAuthority = dominantModeIsFeed
    ? (stats.surfaceConfidence.mean * stats.mode.consensusRatio)
    : 0;
  const dynamicCoverage = clamp01(
    stats.dynamicConfirmationCount / POLICY.minDynamicConfirmations,
  );
  const dynamicChannelCoverage = clamp01(Math.max(0, stats.corroboratingChannels - 1) / 2);
  const quality = 1 - (stats.ratios.rejected ?? 0);
  const containerStabilityRequired = requiresStableContainer(stats);
  const containerCoverage = containerStabilityRequired
    ? clamp01(stats.containerObservations / POLICY.minContainerSamples)
    : 1;

  const activeContainerInstability = (
    containerStabilityRequired
    && stats.containerStableTailSamples < POLICY.minContainerStableTailSamples
  )
    ? (stats.ratios.containerReset ?? 0)
    : 0;
  let instabilityPenalty = activeContainerInstability * 0.7;
  if (stats.normalizedStepSize.coefficientOfVariation > 1) {
    instabilityPenalty += Math.min(
      0.15,
      (stats.normalizedStepSize.coefficientOfVariation - 1) * 0.1,
    );
  }
  if (stats.appendIntervalMs.coefficientOfVariation > 1) {
    instabilityPenalty += Math.min(
      0.15,
      (stats.appendIntervalMs.coefficientOfVariation - 1) * 0.08,
    );
  }

  const evidenceConfidence = (sampleCoverage * 0.2)
    + (surfaceCoverage * 0.14)
    + (surfaceAuthority * 0.26)
    + (dynamicCoverage * 0.18)
    + (dynamicChannelCoverage * 0.08)
    + (quality * 0.08)
    + (containerCoverage * 0.06);
  return round4(clamp01(evidenceConfidence * (1 - Math.min(0.7, instabilityPenalty))));
}

function buildReadinessReasons(stats, requirements, confidence) {
  const reasons = [];
  const containerStabilityRequired = requiresStableContainer(stats);
  if (stats.acceptedRecords.length < requirements.minSamples) {
    reasons.push('insufficient_observations');
  }
  if (stats.surfaceRecords.length < requirements.minSurfaceSamples) {
    reasons.push('insufficient_surface_samples');
  }
  if (!FEED_SURFACE_MODE_SET.has(stats.mode.dominantSurfaceMode)) {
    reasons.push('surface_mode_unresolved');
  }
  if (stats.surfaceConfidence.mean === null || stats.surfaceConfidence.mean < POLICY.minSurfaceConfidence) {
    reasons.push('surface_confidence_low');
  }
  if (stats.mode.consensusRatio === null || stats.mode.consensusRatio < POLICY.minSurfaceConsensus) {
    reasons.push('surface_mode_unstable');
  }
  if (stats.dynamicConfirmationCount < POLICY.minDynamicConfirmations) {
    reasons.push('dynamic_evidence_missing');
  }
  if (stats.corroboratingChannels < 2) {
    reasons.push('independent_corroboration_missing');
  }
  if (
    containerStabilityRequired
    && stats.containerObservations < POLICY.minContainerSamples
  ) {
    reasons.push('container_stability_unproven');
  }
  if (
    containerStabilityRequired
    &&
    stats.containerResets >= POLICY.minRepeatedContainerResets
    && stats.ratios.containerReset !== null
    && stats.ratios.containerReset > POLICY.maxReadyResetRatio
    && stats.containerStableTailSamples < POLICY.minContainerStableTailSamples
  ) {
    reasons.push('container_reset_rate_high');
  }
  if (stats.ratios.rejected !== null && stats.ratios.rejected > POLICY.maxReadyRejectedRatio) {
    reasons.push('observation_quality_low');
  }
  if (confidence < POLICY.minReadyConfidence) reasons.push('confidence_low');
  return reasons;
}

function resolveState(stats, windowSampleCount, readinessReasons, volatilityReasons, invalidReasons) {
  if (invalidReasons.length > 0) return FEED_STRUCTURE_LEARNING_STATES.INVALID;
  if (
    stats.acceptedRecords.length >= POLICY.volatileMinSamples
    && volatilityReasons.length > 0
  ) {
    return FEED_STRUCTURE_LEARNING_STATES.VOLATILE;
  }
  if (readinessReasons.length === 0) return FEED_STRUCTURE_LEARNING_STATES.READY;

  const hasInitialEvidence = stats.acceptedRecords.length >= 3
    && (
      stats.mode.feedSurfaceRatio > 0
      || stats.dynamicConfirmationCount > 0
    );
  return windowSampleCount > 0 && hasInitialEvidence
    ? FEED_STRUCTURE_LEARNING_STATES.WARMING
    : FEED_STRUCTURE_LEARNING_STATES.PENDING;
}

export class FeedStructureLearner {
  constructor({
    knownProfile = false,
    windowSize = POLICY.defaultWindowSize,
  } = {}) {
    if (typeof knownProfile !== 'boolean') {
      throw new Error('FEED_STRUCTURE_LEARNER_KNOWN_PROFILE_INVALID');
    }
    if (
      !Number.isInteger(windowSize)
      || windowSize < POLICY.minWindowSize
      || windowSize > POLICY.maxWindowSize
    ) {
      throw new Error('FEED_STRUCTURE_LEARNER_WINDOW_SIZE_INVALID');
    }

    this._knownProfile = knownProfile;
    this._windowSize = windowSize;
    this._records = [];
  }

  reset() {
    this._records = [];
    return this.getSnapshot();
  }

  observe(observation) {
    this._records.push(normalizeObservation(observation));
    if (this._records.length > this._windowSize) this._records.shift();
    return this.getSnapshot();
  }

  getSnapshot() {
    const stats = buildStatistics(this._records);
    const requirements = {
      minSamples: this._knownProfile
        ? POLICY.knownMinSamples
        : POLICY.unknownMinSamples,
      minSurfaceSamples: this._knownProfile
        ? POLICY.knownMinSurfaceSamples
        : POLICY.unknownMinSurfaceSamples,
    };
    const confidence = buildConfidence(stats, requirements);
    const volatilityReasons = buildVolatilityReasons(stats);
    const invalidReasons = buildInvalidReasons(stats, this._records.length);
    const readinessReasons = buildReadinessReasons(stats, requirements, confidence);
    const state = resolveState(
      stats,
      this._records.length,
      readinessReasons,
      volatilityReasons,
      invalidReasons,
    );

    let reasons = readinessReasons;
    if (state === FEED_STRUCTURE_LEARNING_STATES.READY) reasons = ['structure_corroborated'];
    if (state === FEED_STRUCTURE_LEARNING_STATES.VOLATILE) reasons = volatilityReasons;
    if (state === FEED_STRUCTURE_LEARNING_STATES.INVALID) reasons = invalidReasons;

    return {
      version: FEED_STRUCTURE_LEARNER_VERSION,
      state,
      profileKind: this._knownProfile ? 'known' : 'unknown',
      confidence,
      reasons,
      sampleCount: stats.acceptedRecords.length,
      window: {
        sampleCount: this._records.length,
        capacity: this._windowSize,
      },
      requirements: {
        ...requirements,
        minDynamicConfirmations: POLICY.minDynamicConfirmations,
        minContainerSamples: POLICY.minContainerSamples,
        minRepeatedContainerResets: POLICY.minRepeatedContainerResets,
        minContainerStableTailSamples: POLICY.minContainerStableTailSamples,
        containerStabilityRequired: requiresStableContainer(stats),
      },
      sampleCounts: {
        accepted: stats.acceptedRecords.length,
        rejected: stats.rejectedRecords.length,
        surface: stats.surfaceRecords.length,
        supplyObservations: stats.supplyObservations,
        supplySteps: stats.supplySteps,
        demandSteps: stats.demandSteps,
        transitionObservations: stats.transitionObservations,
        confirmedTransitions: stats.confirmedTransitions,
        virtualTurnoverObservations: stats.virtualTurnoverObservations,
        virtualTurnovers: stats.virtualTurnovers,
        containerObservations: stats.containerObservations,
        containerResets: stats.containerResets,
        containerStableTailSamples: stats.containerStableTailSamples,
        dynamicConfirmations: stats.dynamicConfirmationCount,
        corroboratingChannels: stats.corroboratingChannels,
      },
      metrics: {
        dominantSurfaceMode: stats.mode.dominantSurfaceMode,
        surfaceModeCounts: stats.mode.modeCounts,
        surfaceConfidence: stats.surfaceConfidence,
        normalizedStepSize: stats.normalizedStepSize,
        appendIntervalMs: stats.appendIntervalMs,
        ratios: {
          surfaceConsensus: stats.mode.consensusRatio,
          feedSurface: stats.mode.feedSurfaceRatio,
          supplyStep: stats.ratios.supplyStep,
          demand: stats.ratios.demand,
          transitionConfirmation: stats.ratios.transitionConfirmation,
          virtualTurnover: stats.ratios.virtualTurnover,
          containerReset: stats.ratios.containerReset,
          rejected: stats.ratios.rejected,
        },
      },
      rejections: buildRejectionReadout(this._records),
    };
  }
}

export default FeedStructureLearner;
