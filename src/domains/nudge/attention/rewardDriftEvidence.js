const DEFAULT_THRESHOLD = 3.2;
const DEFAULT_TIME_CONSTANT_MS = 15 * 60 * 1000;
const DEFAULT_IDLE_RESET_MS = 45 * 60 * 1000;
const DEFAULT_SCORE_CAP_MULTIPLIER = 1.35;
const TUNING_LIMITS = Object.freeze({
  threshold: Object.freeze([0.1, 20]),
  timeConstantMs: Object.freeze([1000, Number.POSITIVE_INFINITY]),
  idleResetMs: Object.freeze([1000, Number.POSITIVE_INFINITY]),
  scoreCapMultiplier: Object.freeze([1, 2]),
});
const CONFIDENCE_MASS_CAP = 8;
const INTERVAL_WEIGHT_ANCHORS = Object.freeze([
  Object.freeze([0, 0.12]),
  Object.freeze([2, 0.3]),
  Object.freeze([8, 0.75]),
  Object.freeze([20, 0.92]),
  Object.freeze([45, 1]),
  Object.freeze([90, 0.7]),
  Object.freeze([180, 0.4]),
  Object.freeze([360, 0.18]),
  Object.freeze([720, 0.05]),
  Object.freeze([1200, 0.03]),
]);

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeNow(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`REWARD_DRIFT_NOW_INVALID:${String(value)}`);
  }
  return numeric;
}

function normalizePositiveMs(value, fallback, limits) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric >= limits[0] ? numeric : fallback;
}

function assertRewardDriftEvidenceState(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('REWARD_DRIFT_EVIDENCE_STATE_REQUIRED');
  }
  if (evidence.version !== 1) {
    throw new Error(`REWARD_DRIFT_EVIDENCE_VERSION_INVALID:${String(evidence.version)}`);
  }
}

function resolveTuning(tuning = {}) {
  const rawThreshold = Number(tuning.threshold);
  const rawScoreCapMultiplier = Number(tuning.scoreCapMultiplier);
  const threshold = Number.isFinite(rawThreshold)
    ? clamp(rawThreshold, ...TUNING_LIMITS.threshold)
    : DEFAULT_THRESHOLD;
  const scoreCapMultiplier = Number.isFinite(rawScoreCapMultiplier)
    ? clamp(rawScoreCapMultiplier, ...TUNING_LIMITS.scoreCapMultiplier)
    : DEFAULT_SCORE_CAP_MULTIPLIER;
  return {
    threshold,
    timeConstantMs: normalizePositiveMs(tuning.timeConstantMs, DEFAULT_TIME_CONSTANT_MS, TUNING_LIMITS.timeConstantMs),
    idleResetMs: normalizePositiveMs(tuning.idleResetMs, DEFAULT_IDLE_RESET_MS, TUNING_LIMITS.idleResetMs),
    scoreCap: threshold * scoreCapMultiplier,
  };
}

// Strict runtime input boundary. The pure model owns all defaults, ranges and
// millisecond normalization, so equivalent omitted/explicit configuration is
// identical before an observation owner decides whether tuning changed.
export function copyRewardDriftTuning(tuning = {}) {
  if (!tuning || typeof tuning !== 'object' || Array.isArray(tuning)) {
    throw new Error('REWARD_DRIFT_TUNING_INVALID');
  }
  const copy = {};
  for (const [key, value] of Object.entries(tuning)) {
    const limits = Object.hasOwn(TUNING_LIMITS, key) ? TUNING_LIMITS[key] : null;
    if (!limits || !Number.isFinite(value) || value < limits[0] || value > limits[1]) {
      throw new Error(`REWARD_DRIFT_TUNING_INVALID:${key}`);
    }
    copy[key] = value;
  }
  const resolved = resolveTuning(copy);
  return Object.freeze({
    threshold: resolved.threshold,
    timeConstantMs: resolved.timeConstantMs,
    idleResetMs: resolved.idleResetMs,
    scoreCapMultiplier: Object.hasOwn(copy, 'scoreCapMultiplier')
      ? copy.scoreCapMultiplier : DEFAULT_SCORE_CAP_MULTIPLIER,
  });
}

function addConfidenceObservation(evidence, confidence) {
  const nextSampleMass = Math.max(0, Number(evidence.effectiveSampleMass) || 0) + 1;
  const nextConfidenceMass = Math.max(0, Number(evidence.confidenceMass) || 0) + confidence;
  if (nextSampleMass <= CONFIDENCE_MASS_CAP) {
    return {
      effectiveSampleMass: nextSampleMass,
      confidenceMass: nextConfidenceMass,
    };
  }
  const scale = CONFIDENCE_MASS_CAP / nextSampleMass;
  return {
    effectiveSampleMass: CONFIDENCE_MASS_CAP,
    confidenceMass: nextConfidenceMass * scale,
  };
}

export function getRewardIntervalBucket(intervalMs) {
  if (intervalMs === null || intervalMs === undefined || !Number.isFinite(Number(intervalMs))) {
    return 'baseline';
  }
  const seconds = Math.max(0, Number(intervalMs) / 1000);
  if (seconds < 2) return 'bounce';
  if (seconds < 8) return 'rapid_sampling';
  if (seconds < 20) return 'search_momentum';
  if (seconds < 45) return 'wandering';
  if (seconds < 90) return 'browse';
  if (seconds < 180) return 'settled';
  if (seconds < 360) return 'long_dwell';
  return 'new_context';
}

export function getRewardIntervalWeight(intervalMs) {
  const seconds = Math.max(0, Number(intervalMs) / 1000);
  const lastAnchor = INTERVAL_WEIGHT_ANCHORS.at(-1);
  if (seconds >= lastAnchor[0]) return lastAnchor[1];
  for (let index = 1; index < INTERVAL_WEIGHT_ANCHORS.length; index += 1) {
    const right = INTERVAL_WEIGHT_ANCHORS[index];
    if (seconds > right[0]) continue;
    const left = INTERVAL_WEIGHT_ANCHORS[index - 1];
    const linear = (seconds - left[0]) / (right[0] - left[0]);
    const smooth = linear * linear * (3 - (2 * linear));
    return left[1] + ((right[1] - left[1]) * smooth);
  }
  return lastAnchor[1];
}

function getRewardIntervalReason(intervalMs) {
  const bucket = getRewardIntervalBucket(intervalMs);
  if (bucket === 'bounce') return 'bounce_sampling';
  if (bucket === 'rapid_sampling') return 'rapid_reward_sampling';
  if (bucket === 'search_momentum') return 'search_momentum';
  if (bucket === 'wandering') return 'wandering_continuation';
  if (bucket === 'browse') return 'browse_continuation';
  if (bucket === 'settled') return 'settled_continuation';
  if (bucket === 'long_dwell') return 'long_dwell_continuation';
  return 'new_context_continuation';
}

function getBoundaryConfidenceWeight(confidence) {
  const normalized = clamp(confidence, 0, 1);
  return 0.2 + (0.8 * normalized);
}

function getRewardKindWeight(kind) {
  if (kind === 'reward_entry') return 1.05;
  if (kind === 'reward_continuation') return 1;
  throw new Error(`REWARD_DRIFT_BOUNDARY_KIND_INVALID:${String(kind)}`);
}

export function createRewardDriftEvidenceState({
  scopeKey = 'unknown',
  now = Date.now(),
} = {}) {
  const normalizedNow = normalizeNow(now);
  return {
    version: 1,
    scopeKey: String(scopeKey || 'unknown'),
    score: 0,
    firstRewardAt: 0,
    lastRewardAt: 0,
    lastProjectedAt: normalizedNow,
    lastIntervalMs: null,
    lastDelta: 0,
    lastReason: 'new_context',
    observationCount: 0,
    effectiveSampleMass: 0,
    confidenceMass: 0,
  };
}

export function projectRewardDriftEvidence(evidence, {
  now = Date.now(),
  threshold = DEFAULT_THRESHOLD,
  timeConstantMs = DEFAULT_TIME_CONSTANT_MS,
  idleResetMs = DEFAULT_IDLE_RESET_MS,
  scoreCapMultiplier = DEFAULT_SCORE_CAP_MULTIPLIER,
} = {}) {
  assertRewardDriftEvidenceState(evidence);
  const normalizedNow = normalizeNow(now);
  const tuning = resolveTuning({ threshold, timeConstantMs, idleResetMs, scoreCapMultiplier });
  const lastRewardAt = Math.max(0, Number(evidence.lastRewardAt) || 0);

  if (lastRewardAt > 0 && (normalizedNow - lastRewardAt) >= tuning.idleResetMs) {
    return {
      ...createRewardDriftEvidenceState({ scopeKey: evidence.scopeKey, now: normalizedNow }),
      lastReason: 'idle_reset',
    };
  }

  const lastProjectedAt = Math.max(0, Number(evidence.lastProjectedAt) || normalizedNow);
  const elapsedMs = Math.max(0, normalizedNow - lastProjectedAt);
  const rawScore = Math.max(0, Number(evidence.score) || 0);
  const decayedScore = rawScore > 0 && elapsedMs > 0
    ? rawScore * Math.exp(-elapsedMs / tuning.timeConstantMs)
    : rawScore;
  const decayFactor = elapsedMs > 0 ? Math.exp(-elapsedMs / tuning.timeConstantMs) : 1;

  return {
    ...evidence,
    score: decayedScore < 0.0001 ? 0 : Math.min(tuning.scoreCap, decayedScore),
    effectiveSampleMass: Math.max(0, Number(evidence.effectiveSampleMass) || 0) * decayFactor,
    confidenceMass: Math.max(0, Number(evidence.confidenceMass) || 0) * decayFactor,
    lastProjectedAt: normalizedNow,
  };
}

export function advanceRewardDriftEvidence(evidence, {
  now = Date.now(),
  kind,
  confidence = 0,
} = {}, tuning = {}) {
  const normalizedNow = normalizeNow(now);
  const resolvedTuning = resolveTuning(tuning);
  const projected = projectRewardDriftEvidence(evidence, {
    now: normalizedNow,
    ...resolvedTuning,
    scoreCapMultiplier: resolvedTuning.scoreCap / resolvedTuning.threshold,
  });
  const previousRewardAt = Math.max(0, Number(projected.lastRewardAt) || 0);
  const intervalMs = previousRewardAt > 0
    ? Math.max(0, normalizedNow - previousRewardAt)
    : null;
  const normalizedConfidence = clamp(confidence, 0, 1);
  const observationCount = Math.max(0, Math.round(Number(projected.observationCount) || 0));

  if (intervalMs === null) {
    return {
      ...projected,
      firstRewardAt: normalizedNow,
      lastRewardAt: normalizedNow,
      lastProjectedAt: normalizedNow,
      lastIntervalMs: null,
      lastDelta: 0,
      lastReason: projected.lastReason === 'idle_reset' ? 'idle_restart' : 'first_reward',
      observationCount: observationCount + 1,
    };
  }

  const delta = getRewardIntervalWeight(intervalMs)
    * getBoundaryConfidenceWeight(normalizedConfidence)
    * getRewardKindWeight(kind);
  const confidenceObservation = addConfidenceObservation(projected, normalizedConfidence);

  return {
    ...projected,
    score: Math.min(resolvedTuning.scoreCap, projected.score + delta),
    lastRewardAt: normalizedNow,
    lastProjectedAt: normalizedNow,
    lastIntervalMs: intervalMs,
    lastDelta: delta,
    lastReason: getRewardIntervalReason(intervalMs),
    observationCount: observationCount + 1,
    ...confidenceObservation,
  };
}

export function summarizeRewardDriftEvidence(evidence, {
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  assertRewardDriftEvidenceState(evidence);
  const rawThreshold = Number(threshold);
  const resolvedThreshold = Number.isFinite(rawThreshold)
    ? clamp(rawThreshold, ...TUNING_LIMITS.threshold)
    : DEFAULT_THRESHOLD;
  const observationCount = Math.max(0, Math.round(Number(evidence.observationCount) || 0));
  const behaviorLoad = clamp((Number(evidence.score) || 0) / resolvedThreshold, 0, 1);
  const effectiveSampleMass = Math.max(0, Number(evidence.effectiveSampleMass) || 0);
  const confidenceMass = Math.max(0, Number(evidence.confidenceMass) || 0);
  const sampleMaturity = clamp(effectiveSampleMass / 4, 0, 1);
  const confidenceMean = effectiveSampleMass > 0
    ? clamp(confidenceMass / effectiveSampleMass, 0, 1)
    : 0;
  const measurementConfidence = sampleMaturity * confidenceMean;
  const firstRewardAt = Math.max(0, Number(evidence.firstRewardAt) || 0);
  const lastRewardAt = Math.max(0, Number(evidence.lastRewardAt) || 0);
  const hasLastInterval = evidence.lastIntervalMs !== null
    && evidence.lastIntervalMs !== undefined
    && Number.isFinite(Number(evidence.lastIntervalMs));

  return Object.freeze({
    kind: 'reward_drift',
    observedAt: Math.max(0, Number(evidence.lastProjectedAt) || 0),
    lastRewardAt,
    activeMs: firstRewardAt > 0 && lastRewardAt >= firstRewardAt
      ? lastRewardAt - firstRewardAt
      : 0,
    score: Math.max(0, Number(evidence.score) || 0),
    threshold: resolvedThreshold,
    behaviorLoad: Number(behaviorLoad.toFixed(4)),
    measurementConfidence: Number(measurementConfidence.toFixed(4)),
    sampleCount: observationCount,
    effectiveSampleMass: Number(effectiveSampleMass.toFixed(4)),
    lastIntervalMs: hasLastInterval
      ? Number(evidence.lastIntervalMs)
      : null,
    lastIntervalBucket: getRewardIntervalBucket(evidence.lastIntervalMs),
    lastDelta: Math.max(0, Number(evidence.lastDelta) || 0),
    reason: evidence.lastReason || 'unknown',
  });
}
