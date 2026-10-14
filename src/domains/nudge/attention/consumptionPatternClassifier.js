import {
  MEDIA_CONSUMPTION_EVIDENCE_KIND,
  MEDIA_CONSUMPTION_EVIDENCE_VERSION,
} from '../media/mediaConsumptionEvidence.js';

export const CONSUMPTION_PATTERN_PROFILE_VERSION = 1;

export const CONSUMPTION_PATTERN_MODES = Object.freeze({
  NEUTRAL: 'neutral',
  REWARD_WANDERING: 'reward_wandering',
  FEED_BINGE: 'feed_binge',
  AUDIBLE_MEDIA: 'audible_media',
  MIXED: 'mixed',
});

export const CONSUMPTION_PATTERN_INTERVENTIONS = Object.freeze({
  ENSO: 'enso',
  SUIKINKUTSU: 'suikinkutsu',
});

const BINGE_DETECTION_MAX_AGE_MS = 90_000;
const ACTIVE_SIGNAL_FLOOR = 0.35;
const DOMINANCE_DELTA = 0.08;
const MINIMUM_CANDIDATE_WEIGHT = 0.35;

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function smoothRange(value, start, end) {
  if (end <= start) return value >= end ? 1 : 0;
  const normalized = clamp01((Number(value) - start) / (end - start));
  return normalized * normalized * (3 - (2 * normalized));
}

function roundSignal(value) {
  return Number(clamp01(value).toFixed(4));
}

function requireBingeDetection(value, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('CONSUMPTION_PATTERN_BINGE_DETECTION_INVALID');
  }
  if (value.version !== 1) {
    throw new Error(
      `CONSUMPTION_PATTERN_BINGE_DETECTION_VERSION_INVALID:${String(value.version)}`,
    );
  }
  const evaluatedAt = normalizeNow(
    value.evaluatedAt,
    'CONSUMPTION_PATTERN_BINGE_DETECTION_TIMESTAMP_INVALID',
  );
  if (evaluatedAt > now) {
    throw new Error('CONSUMPTION_PATTERN_BINGE_DETECTION_FROM_FUTURE');
  }
  const pressure = Number(value.pressure);
  const confidence = Number(value.confidence);
  const rewardLoad = Number(value.channels?.reward?.load);
  const feedLoad = Number(value.channels?.feed?.load);
  if (
    !Number.isFinite(pressure)
    || !Number.isFinite(confidence)
    || !Number.isFinite(rewardLoad)
    || !Number.isFinite(feedLoad)
  ) {
    throw new Error('CONSUMPTION_PATTERN_BINGE_DETECTION_METRICS_INVALID');
  }
  return {
    evaluatedAt,
    pressure: clamp01(pressure),
    confidence: clamp01(confidence),
    rewardLoad: clamp01(rewardLoad),
    feedLoad: clamp01(feedLoad),
  };
}

function requireMediaEvidence(value, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('CONSUMPTION_PATTERN_MEDIA_EVIDENCE_INVALID');
  }
  if (
    value.version !== MEDIA_CONSUMPTION_EVIDENCE_VERSION
    || value.kind !== MEDIA_CONSUMPTION_EVIDENCE_KIND
  ) {
    throw new Error('CONSUMPTION_PATTERN_MEDIA_EVIDENCE_CONTRACT_INVALID');
  }
  const observedAt = normalizeNow(
    value.observedAt,
    'CONSUMPTION_PATTERN_MEDIA_EVIDENCE_TIMESTAMP_INVALID',
  );
  const validUntil = normalizeNow(
    value.validUntil,
    'CONSUMPTION_PATTERN_MEDIA_EVIDENCE_VALID_UNTIL_INVALID',
  );
  if (observedAt > now) {
    throw new Error('CONSUMPTION_PATTERN_MEDIA_EVIDENCE_FROM_FUTURE');
  }
  if (validUntil < observedAt) {
    throw new Error('CONSUMPTION_PATTERN_MEDIA_EVIDENCE_WINDOW_INVALID');
  }
  const sustainedPlaybackMs = normalizeNow(
    value.sustainedPlaybackMs,
    'CONSUMPTION_PATTERN_MEDIA_SUSTAINED_PLAYBACK_INVALID',
  );
  const audibleCandidateCount = normalizeNow(
    value.audibleCandidateCount,
    'CONSUMPTION_PATTERN_MEDIA_AUDIBLE_COUNT_INVALID',
  );
  return {
    observedAt,
    validUntil,
    sustainedPlaybackMs,
    audibleCandidateCount,
    audibleCandidate: value.audibleCandidate === true,
  };
}

function resolveBingeSignals(bingeDetection, now) {
  if (bingeDetection === null) {
    return {
      fresh: false,
      ageMs: null,
      rewardWandering: 0,
      feedBinge: 0,
      enso: 0,
    };
  }
  const detection = requireBingeDetection(bingeDetection, now);
  const ageMs = now - detection.evaluatedAt;
  if (ageMs >= BINGE_DETECTION_MAX_AGE_MS) {
    return {
      fresh: false,
      ageMs,
      rewardWandering: 0,
      feedBinge: 0,
      enso: 0,
    };
  }
  const freshness = Math.exp(-ageMs / BINGE_DETECTION_MAX_AGE_MS);
  const confidenceScale = 0.6 + (0.4 * detection.confidence);
  const rewardWandering = detection.rewardLoad * confidenceScale * freshness;
  const feedBinge = detection.feedLoad * confidenceScale * freshness;
  const enso = Math.max(
    rewardWandering,
    feedBinge,
    detection.pressure * confidenceScale * freshness,
  );
  return {
    fresh: true,
    ageMs,
    rewardWandering: roundSignal(rewardWandering),
    feedBinge: roundSignal(feedBinge),
    enso: roundSignal(enso),
  };
}

function resolveMediaSignals(mediaEvidence, now) {
  if (mediaEvidence === null) {
    return {
      fresh: false,
      ageMs: null,
      audibleMedia: 0,
      suikinkutsu: 0,
    };
  }
  const evidence = requireMediaEvidence(mediaEvidence, now);
  const ageMs = now - evidence.observedAt;
  const fresh = evidence.validUntil > now;
  if (
    !fresh
    || !evidence.audibleCandidate
    || evidence.audibleCandidateCount < 1
  ) {
    return {
      fresh,
      ageMs,
      audibleMedia: 0,
      suikinkutsu: 0,
    };
  }
  const sustainedMaturity = smoothRange(
    evidence.sustainedPlaybackMs,
    2_000,
    45_000,
  );
  const multiplicityLift = Math.min(
    0.1,
    Math.max(0, evidence.audibleCandidateCount - 1) * 0.04,
  );
  const audibleMedia = 0.45 + (0.45 * sustainedMaturity) + multiplicityLift;
  return {
    fresh: true,
    ageMs,
    audibleMedia: roundSignal(audibleMedia),
    suikinkutsu: roundSignal(audibleMedia),
  };
}

function resolvePatternMode(binge, media) {
  const behaviorActive = binge.enso >= ACTIVE_SIGNAL_FLOOR;
  const mediaActive = media.audibleMedia >= ACTIVE_SIGNAL_FLOOR;
  if (behaviorActive && mediaActive) return CONSUMPTION_PATTERN_MODES.MIXED;
  if (mediaActive) return CONSUMPTION_PATTERN_MODES.AUDIBLE_MEDIA;
  if (!behaviorActive) return CONSUMPTION_PATTERN_MODES.NEUTRAL;
  return binge.feedBinge >= binge.rewardWandering
    ? CONSUMPTION_PATTERN_MODES.FEED_BINGE
    : CONSUMPTION_PATTERN_MODES.REWARD_WANDERING;
}

function resolveWeight(signal) {
  return roundSignal(
    MINIMUM_CANDIDATE_WEIGHT
      + ((1 - MINIMUM_CANDIDATE_WEIGHT) * clamp01(signal)),
  );
}

function resolveDominantIntervention(ensoWeight, suikinkutsuWeight, {
  ensoActive,
  suikinkutsuActive,
}) {
  if (!ensoActive && !suikinkutsuActive) return 'none';
  if (ensoActive && !suikinkutsuActive) {
    return CONSUMPTION_PATTERN_INTERVENTIONS.ENSO;
  }
  if (!ensoActive && suikinkutsuActive) {
    return CONSUMPTION_PATTERN_INTERVENTIONS.SUIKINKUTSU;
  }
  if (Math.abs(ensoWeight - suikinkutsuWeight) < DOMINANCE_DELTA) {
    return 'balanced';
  }
  return ensoWeight > suikinkutsuWeight
    ? CONSUMPTION_PATTERN_INTERVENTIONS.ENSO
    : CONSUMPTION_PATTERN_INTERVENTIONS.SUIKINKUTSU;
}

export function classifyInterventionConsumptionPattern({
  bingeDetection = null,
  mediaEvidence = null,
  now = Date.now(),
} = {}) {
  const evaluatedAt = normalizeNow(
    now,
    'CONSUMPTION_PATTERN_NOW_INVALID',
  );
  const binge = resolveBingeSignals(bingeDetection, evaluatedAt);
  const media = resolveMediaSignals(mediaEvidence, evaluatedAt);
  const ensoWeight = resolveWeight(binge.enso);
  const suikinkutsuWeight = resolveWeight(media.suikinkutsu);
  const ensoActive = binge.enso >= ACTIVE_SIGNAL_FLOOR;
  const suikinkutsuActive = media.suikinkutsu >= ACTIVE_SIGNAL_FLOOR;

  return Object.freeze({
    version: CONSUMPTION_PATTERN_PROFILE_VERSION,
    evaluatedAt,
    mode: resolvePatternMode(binge, media),
    dominantIntervention: resolveDominantIntervention(
      ensoWeight,
      suikinkutsuWeight,
      { ensoActive, suikinkutsuActive },
    ),
    weights: Object.freeze({
      [CONSUMPTION_PATTERN_INTERVENTIONS.ENSO]: ensoWeight,
      [CONSUMPTION_PATTERN_INTERVENTIONS.SUIKINKUTSU]: suikinkutsuWeight,
    }),
    signals: Object.freeze({
      rewardWandering: binge.rewardWandering,
      feedBinge: binge.feedBinge,
      audibleMedia: media.audibleMedia,
      enso: binge.enso,
      suikinkutsu: media.suikinkutsu,
    }),
    evidence: Object.freeze({
      bingeFresh: binge.fresh,
      bingeAgeMs: binge.ageMs,
      mediaFresh: media.fresh,
      mediaAgeMs: media.ageMs,
    }),
  });
}

export default classifyInterventionConsumptionPattern;
