export const DOPAMINE_BINGE_STATE = Object.freeze({
  QUIET: 'quiet',
  RISING: 'rising',
  ELEVATED: 'elevated',
  CANDIDATE: 'candidate',
});

const DEFAULT_CANDIDATE_THRESHOLD = 0.78;
const FEED_EVIDENCE_TIME_CONSTANT_MS = 90000;
const FEED_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000;

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeNow(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`DOPAMINE_BINGE_NOW_INVALID:${String(value)}`);
  }
  return numeric;
}

function resolveChannel(evidence, {
  now,
  expectedKind,
  decayTimeConstantMs = null,
  maxAgeMs = null,
} = {}) {
  if (!evidence || typeof evidence !== 'object') {
    return {
      present: false,
      behaviorLoad: 0,
      measurementConfidence: 0,
      ageMs: null,
      stale: false,
    };
  }
  if (evidence.kind !== expectedKind) {
    throw new Error(`DOPAMINE_BINGE_EVIDENCE_KIND_INVALID:${String(evidence.kind)}`);
  }
  const rawObservedAt = evidence.observedAt;
  const rawBehaviorLoad = evidence.behaviorLoad;
  const rawMeasurementConfidence = evidence.measurementConfidence;
  if (!Number.isFinite(rawObservedAt) || rawObservedAt < 0) {
    throw new Error(`DOPAMINE_BINGE_EVIDENCE_TIMESTAMP_INVALID:${String(evidence.observedAt)}`);
  }
  if (!Number.isFinite(rawBehaviorLoad) || !Number.isFinite(rawMeasurementConfidence)) {
    throw new Error(`DOPAMINE_BINGE_EVIDENCE_METRIC_INVALID:${expectedKind}`);
  }
  const observedAt = rawObservedAt;
  const ageMs = Math.max(0, now - observedAt);
  const hasMaxAge = maxAgeMs !== null && Number.isFinite(Number(maxAgeMs));
  const hasTimeConstant = decayTimeConstantMs !== null && Number.isFinite(Number(decayTimeConstantMs));
  const stale = hasMaxAge && ageMs >= Number(maxAgeMs);
  const freshness = stale
    ? 0
    : (hasTimeConstant && ageMs > 0
      ? Math.exp(-ageMs / Number(decayTimeConstantMs))
      : 1);
  return {
    present: true,
    behaviorLoad: clamp01(rawBehaviorLoad) * freshness,
    measurementConfidence: clamp01(rawMeasurementConfidence) * freshness,
    ageMs,
    stale,
  };
}

function resolveDominantChannel(rewardLoad, feedLoad) {
  if (rewardLoad <= 0 && feedLoad <= 0) return 'none';
  if (Math.abs(rewardLoad - feedLoad) <= 0.05) return 'balanced';
  return rewardLoad > feedLoad ? 'reward_drift' : 'feed_flow';
}

function resolveDetectionConfidence(reward, feed) {
  if (reward.behaviorLoad <= 0) return feed.measurementConfidence;
  if (feed.behaviorLoad <= 0) return reward.measurementConfidence;
  const balanced = Math.abs(reward.behaviorLoad - feed.behaviorLoad) <= 0.05;
  const rewardDominant = reward.behaviorLoad >= feed.behaviorLoad;
  const dominant = rewardDominant ? reward : feed;
  const corroborating = rewardDominant ? feed : reward;
  const baseConfidence = balanced
    ? Math.max(reward.measurementConfidence, feed.measurementConfidence)
    : dominant.measurementConfidence;
  const supportingConfidence = balanced
    ? Math.min(reward.measurementConfidence, feed.measurementConfidence)
    : corroborating.measurementConfidence;
  return clamp01(
    baseConfidence + (supportingConfidence * 0.22 * (1 - baseConfidence)),
  );
}

function resolveState(pressure, candidate) {
  if (candidate) return DOPAMINE_BINGE_STATE.CANDIDATE;
  if (pressure >= 0.55) return DOPAMINE_BINGE_STATE.ELEVATED;
  if (pressure >= 0.25) return DOPAMINE_BINGE_STATE.RISING;
  return DOPAMINE_BINGE_STATE.QUIET;
}

function resolveReasons({ reward, feed, candidate, confidence, pressure }) {
  const reasons = [];
  if (reward.behaviorLoad >= 0.55) reasons.push('reward_drift_elevated');
  if (feed.behaviorLoad >= 0.55) reasons.push('feed_flow_elevated');
  if (reward.behaviorLoad >= 0.35 && feed.behaviorLoad >= 0.35) {
    reasons.push('cross_channel_corroboration');
  }
  if (feed.stale) reasons.push('feed_evidence_expired');
  if (
    !candidate
    && pressure >= 0.25
    && (reward.present || feed.present)
    && confidence < 0.38
  ) reasons.push('measurement_confidence_low');
  if (candidate) reasons.push('runtime_nudge_candidate');
  if (pressure < 0.25) reasons.push('behavior_load_quiet');
  if (reasons.length === 0) reasons.push('behavior_load_below_candidate');
  return reasons;
}

export function resolveDopamineBingeDetection({
  rewardEvidence = null,
  feedEvidence = null,
  now = Date.now(),
  candidateThreshold = DEFAULT_CANDIDATE_THRESHOLD,
} = {}) {
  const normalizedNow = normalizeNow(now);
  const rawCandidateThreshold = Number(candidateThreshold);
  const threshold = Number.isFinite(rawCandidateThreshold)
    ? Math.max(0.55, Math.min(0.9, rawCandidateThreshold))
    : DEFAULT_CANDIDATE_THRESHOLD;
  const reward = resolveChannel(rewardEvidence, {
    now: normalizedNow,
    expectedKind: 'reward_drift',
  });
  const feed = resolveChannel(feedEvidence, {
    now: normalizedNow,
    expectedKind: 'feed_flow',
    decayTimeConstantMs: FEED_EVIDENCE_TIME_CONSTANT_MS,
    maxAgeMs: FEED_EVIDENCE_MAX_AGE_MS,
  });
  const dominantLoad = Math.max(reward.behaviorLoad, feed.behaviorLoad);
  const corroboratingLoad = Math.min(reward.behaviorLoad, feed.behaviorLoad);
  const corroborationLift = 0.2 * corroboratingLoad * (1 - dominantLoad);
  const pressure = clamp01(dominantLoad + corroborationLift);
  const confidence = resolveDetectionConfidence(reward, feed);
  const candidate = pressure >= threshold && confidence >= 0.38;
  const state = resolveState(pressure, candidate);

  return Object.freeze({
    version: 1,
    evaluatedAt: normalizedNow,
    state,
    candidate,
    threshold: Number(threshold.toFixed(4)),
    pressure: Number(pressure.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    dominantChannel: resolveDominantChannel(reward.behaviorLoad, feed.behaviorLoad),
    reasons: Object.freeze(resolveReasons({
      reward,
      feed,
      candidate,
      confidence,
      pressure,
    })),
    channels: Object.freeze({
      reward: Object.freeze({
        load: Number(reward.behaviorLoad.toFixed(4)),
        confidence: Number(reward.measurementConfidence.toFixed(4)),
      }),
      feed: Object.freeze({
        load: Number(feed.behaviorLoad.toFixed(4)),
        confidence: Number(feed.measurementConfidence.toFixed(4)),
        ageMs: feed.ageMs,
        stale: feed.stale,
      }),
    }),
  });
}

export default resolveDopamineBingeDetection;
