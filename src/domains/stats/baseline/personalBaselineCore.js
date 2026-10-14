import {
  PERSONAL_BASELINE_METRIC_DIRECTIONS as STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS,
  PERSONAL_BASELINE_METRIC_GRAINS as STATS_PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_ROLES as STATS_PERSONAL_BASELINE_ROLES,
} from '../../../lib/personalBaselineContract.js';

export {
  STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS,
  STATS_PERSONAL_BASELINE_METRIC_GRAINS,
  STATS_PERSONAL_BASELINE_ROLES,
};

export const STATS_PERSONAL_BASELINE_CORE_VERSION = 'stats-personal-baseline-core-v3';
export const STATS_BASELINE_MINUTE_MS = 60_000;
export const STATS_BASELINE_TARGET_DAYS = 30;
export const STATS_BASELINE_ROBUST_SIGMA_FROM_MAD = 1.4826;
export const STATS_PERSONAL_BASELINE_METRIC_KINDS = Object.freeze({
  VALUE: 'value',
  RATIO: 'ratio',
  TIME: 'time',
});

const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function requireCanonicalString(source, fieldName, errorCode) {
  const value = source[fieldName];
  if (typeof value !== 'string' || value.length <= 0 || value.trim() !== value) {
    throw new Error(errorCode);
  }
  return value;
}

function requireMetricDescriptor(descriptor) {
  if (!isObjectRecord(descriptor)) {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_DESCRIPTOR_INVALID');
  }
  const id = requireCanonicalString(
    descriptor,
    'id',
    'STATS_PERSONAL_BASELINE_METRIC_ID_INVALID',
  );
  if (
    !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(id)
    || ['constructor', 'prototype'].includes(id)
  ) {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_ID_INVALID');
  }
  const allowedFields = new Set([
    'id',
    'kind',
    'family',
    'unit',
    'grain',
    'direction',
    'scope',
    'exposureUnit',
    'observations',
    'current',
    'metricVersion',
    'policyVersion',
    'provenance',
    'statsOptions',
    'anomalyOptions',
    'confidenceOptions',
    'confidenceGate',
  ]);
  const unexpectedField = Object.keys(descriptor).find((fieldName) => !allowedFields.has(fieldName));
  if (unexpectedField) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_DESCRIPTOR_FIELD_INVALID:${id}:${unexpectedField}`);
  }
  requireCanonicalString(
    descriptor,
    'family',
    `STATS_PERSONAL_BASELINE_METRIC_FAMILY_INVALID:${id}`,
  );
  requireCanonicalString(
    descriptor,
    'unit',
    `STATS_PERSONAL_BASELINE_METRIC_UNIT_INVALID:${id}`,
  );
  requireCanonicalString(
    descriptor,
    'scope',
    `STATS_PERSONAL_BASELINE_METRIC_SCOPE_INVALID:${id}`,
  );
  requireCanonicalString(
    descriptor,
    'exposureUnit',
    `STATS_PERSONAL_BASELINE_METRIC_EXPOSURE_UNIT_INVALID:${id}`,
  );
  if (!Array.isArray(descriptor.observations)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATIONS_INVALID:${id}`);
  }
  if (!hasOwn(descriptor, 'current')) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_CURRENT_MISSING:${id}`);
  }
  requireCanonicalString(
    descriptor,
    'metricVersion',
    `STATS_PERSONAL_BASELINE_METRIC_VERSION_INVALID:${id}`,
  );
  requireCanonicalString(
    descriptor,
    'policyVersion',
    `STATS_PERSONAL_BASELINE_POLICY_VERSION_INVALID:${id}`,
  );
  if (!isObjectRecord(descriptor.provenance)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_PROVENANCE_INVALID:${id}`);
  }
  return descriptor;
}

function requireMetricProvenance(provenance, id) {
  const allowedFields = new Set(['source', 'windowBasis', 'excludeCurrent', 'factsRevision']);
  const unexpectedField = Object.keys(provenance).find((fieldName) => !allowedFields.has(fieldName));
  if (unexpectedField) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_PROVENANCE_FIELD_INVALID:${id}:${unexpectedField}`);
  }
  const source = requireCanonicalString(
    provenance,
    'source',
    `STATS_PERSONAL_BASELINE_METRIC_PROVENANCE_SOURCE_INVALID:${id}`,
  );
  const windowBasis = requireCanonicalString(
    provenance,
    'windowBasis',
    `STATS_PERSONAL_BASELINE_METRIC_PROVENANCE_WINDOW_INVALID:${id}`,
  );
  if (typeof provenance.excludeCurrent !== 'boolean') {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_PROVENANCE_EXCLUSION_INVALID:${id}`);
  }
  const result = {
    source,
    windowBasis,
    excludeCurrent: provenance.excludeCurrent,
  };
  if (hasOwn(provenance, 'factsRevision')) {
    const factsRevision = provenance.factsRevision;
    const validString = typeof factsRevision === 'string'
      && factsRevision.length > 0
      && factsRevision.trim() === factsRevision;
    const validNumber = Number.isFinite(factsRevision) && factsRevision >= 0;
    if (!validString && !validNumber) {
      throw new Error(`STATS_PERSONAL_BASELINE_METRIC_PROVENANCE_REVISION_INVALID:${id}`);
    }
    result.factsRevision = factsRevision;
  }
  return result;
}

function resolveMetricKind(kind, id) {
  const value = kind;
  if (!Object.values(STATS_PERSONAL_BASELINE_METRIC_KINDS).includes(value)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_KIND_INVALID:${id}`);
  }
  return value;
}

function resolveMetricGrain(grain, id) {
  if (!Object.values(STATS_PERSONAL_BASELINE_METRIC_GRAINS).includes(grain)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_GRAIN_INVALID:${id}`);
  }
  return grain;
}

function resolveMetricDirection(direction, id) {
  if (!Object.values(STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS).includes(direction)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_DIRECTION_INVALID:${id}`);
  }
  return direction;
}

function requireFiniteNonNegative(value, errorCode) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

function requireMetricObservation(observation, id, index, kind) {
  const suffix = `${id}:${index}`;
  if (!isObjectRecord(observation)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_INVALID:${suffix}`);
  }
  const observationFields = ['observed', 'eligible', 'value', 'exposure'];
  if (
    Object.keys(observation).length !== observationFields.length
    || !observationFields.every((fieldName) => hasOwn(observation, fieldName))
  ) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_SHAPE_INVALID:${suffix}`);
  }
  if (typeof observation.observed !== 'boolean') {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_STATE_INVALID:${suffix}`);
  }
  if (typeof observation.eligible !== 'boolean') {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_ELIGIBILITY_INVALID:${suffix}`);
  }
  if (!observation.observed && observation.eligible) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_ELIGIBILITY_CONFLICT:${suffix}`);
  }
  const exposure = requireFiniteNonNegative(
    observation.exposure,
    `STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_EXPOSURE_INVALID:${suffix}`,
  );
  if (!observation.eligible && exposure !== 0) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_EXPOSURE_CONFLICT:${suffix}`);
  }
  if (observation.eligible && exposure <= 0) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_EXPOSURE_MISSING:${suffix}`);
  }
  if (!observation.eligible) {
    if (observation.value !== null) {
      throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_VALUE_INELIGIBLE:${suffix}`);
    }
    return {
      observed: observation.observed,
      eligible: false,
      value: null,
      exposure,
    };
  }

  const value = requireFiniteNonNegative(
    observation.value,
    `STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_VALUE_INVALID:${suffix}`,
  );
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO && value > 1) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_RATIO_INVALID:${suffix}`);
  }
  return {
    observed: true,
    eligible: true,
    value,
    exposure,
  };
}

function resolveMetricSample(observations) {
  const observed = observations.filter((observation) => observation.observed);
  const eligible = observed.filter((observation) => observation.eligible);
  const values = eligible.map((observation) => observation.value);
  const positiveCount = values.filter((value) => value > 0).length;
  const valueTotal = values.reduce((sum, value) => sum + value, 0);

  return {
    observedCount: observed.length,
    eligibleCount: eligible.length,
    ineligibleCount: observed.length - eligible.length,
    missingCount: observations.length - observed.length,
    exposureTotal: observed.reduce((sum, observation) => sum + observation.exposure, 0),
    positiveCount,
    valueTotal,
  };
}

function requireOptionNumber(options, fieldName, id, optionGroup, {
  min = 0,
  exclusiveMin = false,
  max = Infinity,
} = {}) {
  if (!hasOwn(options, fieldName)) return;
  const value = options[fieldName];
  const belowMin = exclusiveMin ? value <= min : value < min;
  if (typeof value !== 'number' || !Number.isFinite(value) || belowMin || value > max) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OPTION_INVALID:${id}:${optionGroup}.${fieldName}`);
  }
}

function resolveMetricOptions(source, fieldName, id, allowedFields) {
  if (!hasOwn(source, fieldName)) return {};
  const options = source[fieldName];
  if (!isObjectRecord(options)) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OPTIONS_INVALID:${id}:${fieldName}`);
  }
  const unexpectedField = Object.keys(options).find((key) => !allowedFields.includes(key));
  if (unexpectedField) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OPTION_FIELD_INVALID:${id}:${fieldName}.${unexpectedField}`);
  }
  return { ...options };
}

function resolveStatsOptions(source, kind, id) {
  const time = kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME;
  const options = resolveMetricOptions(
    source,
    'statsOptions',
    id,
    time
      ? ['robustSigmaFromMad', 'minTimeSigmaMs']
      : ['robustSigmaFromMad', 'minSigma', 'referenceFloor'],
  );
  requireOptionNumber(options, 'robustSigmaFromMad', id, 'statsOptions', {
    exclusiveMin: true,
  });
  if (time) {
    requireOptionNumber(options, 'minTimeSigmaMs', id, 'statsOptions', { exclusiveMin: true });
  } else {
    requireOptionNumber(options, 'minSigma', id, 'statsOptions', { exclusiveMin: true });
    requireOptionNumber(options, 'referenceFloor', id, 'statsOptions', { exclusiveMin: true });
  }
  return options;
}

function resolveAnomalyOptions(source, kind, id) {
  const allowedFields = kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.VALUE
    ? ['evidenceLow', 'evidenceHigh', 'lowRatio', 'highRatio']
    : [];
  const options = resolveMetricOptions(source, 'anomalyOptions', id, allowedFields);
  if (kind !== STATS_PERSONAL_BASELINE_METRIC_KINDS.VALUE) return options;
  requireOptionNumber(options, 'evidenceLow', id, 'anomalyOptions');
  requireOptionNumber(options, 'evidenceHigh', id, 'anomalyOptions');
  requireOptionNumber(options, 'lowRatio', id, 'anomalyOptions', {
    min: 1,
    exclusiveMin: true,
  });
  requireOptionNumber(options, 'highRatio', id, 'anomalyOptions', {
    min: 1,
    exclusiveMin: true,
  });
  const effectiveEvidenceLow = hasOwn(options, 'evidenceLow') ? options.evidenceLow : 1;
  const effectiveEvidenceHigh = hasOwn(options, 'evidenceHigh') ? options.evidenceHigh : 8;
  if (effectiveEvidenceHigh <= effectiveEvidenceLow) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OPTION_RANGE_INVALID:${id}:anomalyOptions.evidence`);
  }
  const effectiveLowRatio = hasOwn(options, 'lowRatio') ? options.lowRatio : 1.08;
  const effectiveHighRatio = hasOwn(options, 'highRatio') ? options.highRatio : 2.5;
  if (effectiveHighRatio <= effectiveLowRatio) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_OPTION_RANGE_INVALID:${id}:anomalyOptions.ratio`);
  }
  return options;
}

function resolveConfidenceOptions(source, id) {
  const options = resolveMetricOptions(
    source,
    'confidenceOptions',
    id,
    ['targetDays'],
  );
  requireOptionNumber(options, 'targetDays', id, 'confidenceOptions', {
    exclusiveMin: true,
  });
  return options;
}

function resolveConfidenceEvidence(sample, kind) {
  const isRatio = kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO;
  const isValue = kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.VALUE;
  return {
    observedDays: sample.eligibleCount,
    activeDays: isRatio ? sample.eligibleCount : sample.positiveCount,
    eventDays: isRatio ? sample.eligibleCount : sample.positiveCount,
    // Repeated observed zeroes are real evidence for count/value metrics. The
    // exposure total gives those observations weight without pretending that
    // an event occurred; positive values still contribute their true volume.
    eventTotal: isRatio
      ? sample.exposureTotal
      : isValue
        ? Math.max(sample.valueTotal, sample.exposureTotal)
        : sample.valueTotal,
  };
}

function computeMetricConfidence(kind, sample, stats, confidenceOptions) {
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME) {
    return computeBaselineConfidence({
      observedDays: sample.eligibleCount,
      activeDays: sample.positiveCount,
      totalBaselineMs: sample.valueTotal,
      typicalActiveMs: Math.max(stats.activeMedianMs, stats.activeP75Ms * 0.75),
      robustSigmaMs: stats.robustSigmaMs,
    }, confidenceOptions);
  }
  return computeInteractionConfidence(
    resolveConfidenceEvidence(sample, kind),
    confidenceOptions,
  );
}

function computeMetricReference(kind, sample, stats) {
  if (kind !== STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME) return {};
  const activeDayRate = sample.eligibleCount > 0
    ? sample.positiveCount / sample.eligibleCount
    : 0;
  const p75ReferenceMs = Math.max(
    stats.p75DailyMs,
    stats.activeMedianMs * clamp(activeDayRate + 0.25, 0.35, 1),
    STATS_BASELINE_MINUTE_MS,
  );
  return {
    p75ReferenceMs,
    p90ReferenceMs: Math.max(
      stats.p90DailyMs,
      stats.activeP75Ms * clamp(activeDayRate + 0.2, 0.35, 1),
      p75ReferenceMs,
    ),
  };
}

function resolveBoundedNumber(source, fieldName, id, errorFieldName) {
  const numeric = source[fieldName];
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_${errorFieldName}_INVALID:${id}`);
  }
  return numeric;
}

export function toBaselineNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1);
}

export function smooth01(value, low, high) {
  const numeric = Number(value);
  const start = Number(low);
  const end = Number(high);
  if (!Number.isFinite(numeric) || !Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) return numeric >= end ? 1 : 0;
  const t = clamp01((numeric - start) / (end - start));
  return t * t * (3 - (2 * t));
}

export function durationNorm(valueMs, lowMinutes, highMinutes, {
  minuteMs = STATS_BASELINE_MINUTE_MS,
} = {}) {
  return smooth01(
    toBaselineNumber(valueMs),
    lowMinutes * minuteMs,
    highMinutes * minuteMs,
  );
}

export function average(values = []) {
  if (!Array.isArray(values) || values.length <= 0) return 0;
  return values.reduce((sum, value) => sum + toBaselineNumber(value), 0) / values.length;
}

export function percentile(values = [], percentileValue = 0.5) {
  const sorted = (Array.isArray(values) ? values : [])
    .map(toBaselineNumber)
    .sort((a, b) => a - b);
  if (sorted.length <= 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const target = clamp01(percentileValue) * (sorted.length - 1);
  const lowerIndex = Math.floor(target);
  const upperIndex = Math.ceil(target);
  const fraction = target - lowerIndex;
  return sorted[lowerIndex] + ((sorted[upperIndex] - sorted[lowerIndex]) * fraction);
}

export function computeRobustStats(values = [], {
  robustSigmaFromMad = STATS_BASELINE_ROBUST_SIGMA_FROM_MAD,
  minuteMs = STATS_BASELINE_MINUTE_MS,
  minTimeSigmaMs = 5 * minuteMs,
} = {}) {
  const safeValues = (Array.isArray(values) ? values : []).map(toBaselineNumber);
  const activeValues = safeValues.filter((value) => value > 0);
  const medianDailyMs = percentile(safeValues, 0.5);
  const p25DailyMs = percentile(safeValues, 0.25);
  const p75DailyMs = percentile(safeValues, 0.75);
  const p90DailyMs = percentile(safeValues, 0.9);
  const activeMedianMs = percentile(activeValues, 0.5);
  const activeP75Ms = percentile(activeValues, 0.75);
  const activeP90Ms = percentile(activeValues, 0.9);
  const deviations = safeValues.map((value) => Math.abs(value - medianDailyMs));
  const madMs = percentile(deviations, 0.5);
  const iqrMs = Math.max(0, p75DailyMs - p25DailyMs);
  const robustSigmaMs = Math.max(
    madMs * robustSigmaFromMad,
    iqrMs / 1.349,
    activeMedianMs * 0.35,
    medianDailyMs * 0.5,
    minTimeSigmaMs,
  );

  return {
    medianDailyMs,
    p25DailyMs,
    p75DailyMs,
    p90DailyMs,
    activeMedianMs,
    activeP75Ms,
    activeP90Ms,
    madMs,
    iqrMs,
    robustSigmaMs,
  };
}

export function computeRobustValueStats(values = [], {
  robustSigmaFromMad = STATS_BASELINE_ROBUST_SIGMA_FROM_MAD,
  minSigma = 1,
  referenceFloor = 1,
} = {}) {
  const safeValues = (Array.isArray(values) ? values : []).map(toBaselineNumber);
  const positiveValues = safeValues.filter((value) => value > 0);
  const median = percentile(safeValues, 0.5);
  const p25 = percentile(safeValues, 0.25);
  const p75 = percentile(safeValues, 0.75);
  const p90 = percentile(safeValues, 0.9);
  const positiveMedian = percentile(positiveValues, 0.5);
  const positiveP75 = percentile(positiveValues, 0.75);
  const deviations = safeValues.map((value) => Math.abs(value - median));
  const mad = percentile(deviations, 0.5);
  const iqr = Math.max(0, p75 - p25);
  const sigma = Math.max(
    mad * robustSigmaFromMad,
    iqr / 1.349,
    positiveMedian * 0.35,
    minSigma,
  );
  const p75Reference = Math.max(p75, positiveMedian * 0.75, referenceFloor);
  const p90Reference = Math.max(p90, positiveP75, p75Reference);

  return {
    median,
    p25,
    p75,
    p90,
    positiveMedian,
    positiveP75,
    mad,
    iqr,
    sigma,
    p75Reference,
    p90Reference,
  };
}

export function computeBaselineConfidence({
  observedDays,
  activeDays,
  totalBaselineMs,
  typicalActiveMs,
  robustSigmaMs,
} = {}, {
  targetDays = STATS_BASELINE_TARGET_DAYS,
  minuteMs = STATS_BASELINE_MINUTE_MS,
} = {}) {
  const safeObservedDays = toBaselineNumber(observedDays);
  const safeActiveDays = toBaselineNumber(activeDays);
  if (safeObservedDays <= 0) return 0;

  const historyCoverage = clamp01(safeObservedDays / targetDays);
  const activeCoverage = smooth01(safeActiveDays, 2, 12);
  const volumeEvidence = durationNorm(totalBaselineMs, 20, 600, { minuteMs });
  const activeFloor = Math.max(toBaselineNumber(typicalActiveMs), 10 * minuteMs);
  const stability = safeActiveDays >= 3
    ? 1 - clamp01((toBaselineNumber(robustSigmaMs) / activeFloor) / 2)
    : 0.2 * activeCoverage;
  const shapeEvidence = safeObservedDays >= 7 ? 1 : smooth01(safeObservedDays, 3, 7);

  return clamp01(
    (historyCoverage * 0.3)
    + (activeCoverage * 0.25)
    + (volumeEvidence * 0.2)
    + (stability * 0.15)
    + (shapeEvidence * 0.1),
  );
}

export function computeInteractionConfidence({
  observedDays,
  activeDays,
  eventDays,
  eventTotal,
} = {}, {
  targetDays = STATS_BASELINE_TARGET_DAYS,
} = {}) {
  const safeObservedDays = toBaselineNumber(observedDays);
  if (safeObservedDays <= 0) return 0;

  const historyCoverage = clamp01(safeObservedDays / targetDays);
  const activeCoverage = smooth01(toBaselineNumber(activeDays), 2, 12);
  const eventCoverage = smooth01(toBaselineNumber(eventDays), 2, 10);
  const eventEvidence = smooth01(toBaselineNumber(eventTotal), 3, 60);
  return clamp01(
    (historyCoverage * 0.3)
    + (activeCoverage * 0.2)
    + (eventCoverage * 0.25)
    + (eventEvidence * 0.25),
  );
}

export function computeValueAnomaly({
  todayValue,
  median,
  p75Reference,
  p90Reference,
  sigma,
  evidenceLow = 1,
  evidenceHigh = 8,
  lowRatio = 1.08,
  highRatio = 2.5,
} = {}) {
  const today = toBaselineNumber(todayValue);
  if (today <= 0) return { score: 0, ratio: 0, robustZ: 0 };

  const denominator = Math.max(toBaselineNumber(p75Reference), 1);
  const ratio = today / denominator;
  const logRatio = Math.log((today + 1) / (denominator + 1));
  const logRatioScore = smooth01(logRatio, Math.log(lowRatio), Math.log(highRatio));
  const robustZ = (today - toBaselineNumber(median)) / Math.max(toBaselineNumber(sigma), 1);
  const robustZScore = smooth01(robustZ, 0.7, 2.6);
  const p90BreachScore = smooth01(
    today - toBaselineNumber(p90Reference),
    0,
    Math.max(3, toBaselineNumber(p90Reference) * 0.75),
  );
  const evidenceGate = smooth01(today, evidenceLow, evidenceHigh);
  const score = evidenceGate * (
    (logRatioScore * 0.45)
    + (robustZScore * 0.35)
    + (p90BreachScore * 0.2)
  );

  return {
    score: clamp01(score),
    ratio,
    robustZ,
  };
}

export function computeRatioAnomaly({
  todayRatio,
  median,
  p75Reference,
  p90Reference,
  sigma,
} = {}) {
  const today = clamp01(todayRatio);
  if (today <= 0) return { score: 0, ratio: 0, robustZ: 0 };

  const denominator = Math.max(toBaselineNumber(p75Reference), 0.05);
  const ratio = today / denominator;
  const ratioScore = smooth01(ratio, 1.15, 2.8);
  const robustZ = (today - toBaselineNumber(median)) / Math.max(toBaselineNumber(sigma), 0.05);
  const robustZScore = smooth01(robustZ, 0.7, 2.4);
  const p90BreachScore = smooth01(
    today - toBaselineNumber(p90Reference),
    0,
    Math.max(0.1, toBaselineNumber(p90Reference) * 0.75),
  );

  return {
    score: clamp01((ratioScore * 0.45) + (robustZScore * 0.35) + (p90BreachScore * 0.2)),
    ratio,
    robustZ,
  };
}

export function computeTimeAnomaly({
  todayMs,
  medianDailyMs,
  p75ReferenceMs,
  p90ReferenceMs,
  robustSigmaMs,
} = {}, {
  minuteMs = STATS_BASELINE_MINUTE_MS,
} = {}) {
  const today = toBaselineNumber(todayMs);
  if (today <= 0) return { score: 0, ratio: 0, robustZ: 0 };

  const denominator = Math.max(toBaselineNumber(p75ReferenceMs), minuteMs);
  const todayVsP75Ratio = today / denominator;
  const logRatio = Math.log((today + (5 * minuteMs)) / (denominator + (5 * minuteMs)));
  const logRatioScore = smooth01(logRatio, Math.log(1.08), Math.log(2.35));
  const robustZ = (today - toBaselineNumber(medianDailyMs)) / Math.max(
    toBaselineNumber(robustSigmaMs),
    5 * minuteMs,
  );
  const p90BreachScore = smooth01(
    today - toBaselineNumber(p90ReferenceMs),
    0,
    Math.max(20 * minuteMs, toBaselineNumber(p90ReferenceMs) * 0.6),
  );
  const evidenceGate = durationNorm(today, 3, 45, { minuteMs });
  const score = evidenceGate * (
    (logRatioScore * 0.45)
    + (smooth01(robustZ, 0.75, 2.6) * 0.35)
    + (p90BreachScore * 0.2)
  );

  return {
    score: clamp01(score),
    ratio: todayVsP75Ratio,
    robustZ,
  };
}

export function derivePersonalBaselineMetricAnomaly({
  kind,
  currentValue,
  currentEligible,
  stats = {},
  reference = {},
  anomalyOptions = {},
} = {}) {
  if (!Object.values(STATS_PERSONAL_BASELINE_METRIC_KINDS).includes(kind)) {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_ANOMALY_KIND_INVALID');
  }
  if (typeof currentEligible !== 'boolean') {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_ANOMALY_ELIGIBILITY_INVALID');
  }
  if (!currentEligible) return { score: 0, ratio: 0, robustZ: 0 };
  if (!Number.isFinite(currentValue) || currentValue < 0) {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_ANOMALY_CURRENT_INVALID');
  }
  if (!isObjectRecord(stats) || !isObjectRecord(reference) || !isObjectRecord(anomalyOptions)) {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_ANOMALY_CONTEXT_INVALID');
  }
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME) {
    return computeTimeAnomaly({
      ...anomalyOptions,
      todayMs: currentValue,
      medianDailyMs: stats.medianDailyMs,
      p75ReferenceMs: reference.p75ReferenceMs,
      p90ReferenceMs: reference.p90ReferenceMs,
      robustSigmaMs: stats.robustSigmaMs,
    });
  }
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO) {
    return computeRatioAnomaly({
      ...anomalyOptions,
      todayRatio: currentValue,
      ...stats,
    });
  }
  return computeValueAnomaly({
    ...anomalyOptions,
    todayValue: currentValue,
    ...stats,
  });
}

function requireFiniteProfileNumbers(value, id, path = 'profile') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`STATS_PERSONAL_BASELINE_METRIC_PROFILE_NUMBER_INVALID:${id}:${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => requireFiniteProfileNumbers(entry, id, `${path}.${index}`));
    return;
  }
  if (!isObjectRecord(value)) return;
  Object.entries(value).forEach(([key, entry]) => (
    requireFiniteProfileNumbers(entry, id, `${path}.${key}`)
  ));
}

export function buildPersonalBaselineMetricProfile(descriptor = {}) {
  const source = requireMetricDescriptor(descriptor);
  const kind = resolveMetricKind(source.kind, source.id);
  const grain = resolveMetricGrain(source.grain, source.id);
  const direction = resolveMetricDirection(source.direction, source.id);
  const provenance = requireMetricProvenance(source.provenance, source.id);
  const observations = source.observations.map((observation, index) => (
    requireMetricObservation(observation, source.id, index, kind)
  ));
  const current = requireMetricObservation(source.current, source.id, 'current', kind);
  const values = observations
    .filter((observation) => observation.observed && observation.eligible)
    .map((observation) => observation.value);
  const currentValue = current.eligible ? current.value : null;
  const statsOptions = resolveStatsOptions(source, kind, source.id);
  const anomalyOptions = resolveAnomalyOptions(source, kind, source.id);
  const confidenceOptions = resolveConfidenceOptions(source, source.id);
  const sample = resolveMetricSample(observations);
  const stats = kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME
    ? computeRobustStats(values, statsOptions)
    : computeRobustValueStats(values, statsOptions);
  const reference = computeMetricReference(kind, sample, stats);
  const anomaly = derivePersonalBaselineMetricAnomaly({
    kind,
    currentValue,
    currentEligible: current.eligible,
    stats,
    reference,
    anomalyOptions,
  });
  const confidence = computeMetricConfidence(kind, sample, stats, confidenceOptions);
  if (!hasOwn(source, 'confidenceGate')) {
    throw new Error(`STATS_PERSONAL_BASELINE_METRIC_CONFIDENCE_GATE_MISSING:${source.id}`);
  }
  const confidenceGate = resolveBoundedNumber(
    source,
    'confidenceGate',
    source.id,
    'CONFIDENCE_GATE',
  );
  const profile = {
    role: STATS_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE,
    coreVersion: STATS_PERSONAL_BASELINE_CORE_VERSION,
    metricVersion: source.metricVersion,
    policyVersion: source.policyVersion,
    id: source.id,
    kind,
    family: source.family,
    unit: source.unit,
    grain,
    direction,
    scope: source.scope,
    exposureUnit: source.exposureUnit,
    provenance,
    currentObserved: current.observed,
    currentValue,
    currentEligible: current.eligible,
    currentExposure: current.exposure,
    sample,
    stats,
    reference,
    anomaly,
    confidence,
    confidenceGate,
    anomalyScore: confidence >= confidenceGate ? anomaly.score : 0,
  };
  requireFiniteProfileNumbers(profile, source.id);
  return profile;
}

export function buildPersonalBaselineMetricProfileMap(descriptors = []) {
  if (!Array.isArray(descriptors)) {
    throw new Error('STATS_PERSONAL_BASELINE_METRIC_DESCRIPTORS_INVALID');
  }
  const profiles = {};
  descriptors.forEach((descriptor) => {
    const profile = buildPersonalBaselineMetricProfile(descriptor);
    if (hasOwn(profiles, profile.id)) {
      throw new Error(`STATS_PERSONAL_BASELINE_METRIC_ID_DUPLICATE:${profile.id}`);
    }
    profiles[profile.id] = profile;
  });
  return profiles;
}
