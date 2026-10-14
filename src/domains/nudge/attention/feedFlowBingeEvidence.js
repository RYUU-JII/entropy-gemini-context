import { normalizeFeedFlowLoopSignals } from '../feed-flow/contracts/feedFlowLoopSignals.js';

const CONTINUOUS_PROGRESS_ANCHOR = 8;
const PAGED_PROGRESS_ANCHOR = 6;
const FEED_MATURITY_MIN_MS = 4000;
const FEED_MATURITY_FULL_MS = 30000;
const FEED_IDLE_GRACE_MS = 10000;
const FEED_IDLE_TIME_CONSTANT_MS = 45000;
const RESUMED_BURST_PAUSE_RISE_START_MS = 8000;
const RESUMED_BURST_PAUSE_RISE_END_MS = 16000;
const RESUMED_BURST_PAUSE_FADE_START_MS = 45000;
const RESUMED_BURST_PAUSE_FADE_END_MS = 90000;
const RESUMED_BURST_MAX_LIFT_BY_SURFACE = Object.freeze({
  continuous: 0.04,
  hybrid: 0.08,
  paged: 0.12,
});

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeCount(value) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeNow(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`FEED_BINGE_EVIDENCE_NOW_INVALID:${String(value)}`);
  }
  return numeric;
}

function smoothRange(value, start, end) {
  if (end <= start) return value >= end ? 1 : 0;
  const normalized = clamp01((Number(value) - start) / (end - start));
  return normalized * normalized * (3 - (2 * normalized));
}

function resolveSurfaceMode(snapshot, loopSignals) {
  const raw = typeof snapshot?.surfaceMode === 'string' && snapshot.surfaceMode
    ? snapshot.surfaceMode
    : loopSignals.context.surfaceMode;
  return typeof raw === 'string' && raw ? raw.toLowerCase() : 'unknown';
}

function resolveActiveMs(snapshot, progression) {
  const startedAt = normalizeNumber(snapshot?.startedAt);
  const lastAdvanceAt = normalizeNumber(snapshot?.lastAdvanceAt);
  const timestampDuration = startedAt > 0 && lastAdvanceAt >= startedAt
    ? lastAdvanceAt - startedAt
    : 0;
  return Math.max(timestampDuration, normalizeNumber(progression.burstDurationMs));
}

function resolveProgression({
  surfaceMode,
  screenfulsConsumed,
  itemTransitions,
  activeMs,
}) {
  const continuousAbsolute = clamp01(screenfulsConsumed / CONTINUOUS_PROGRESS_ANCHOR);
  const pagedAbsolute = clamp01(itemTransitions / PAGED_PROGRESS_ANCHOR);
  const activeMinutes = Math.max(activeMs / 60000, 1 / 60);
  const continuousRate = clamp01((screenfulsConsumed / activeMinutes) / 8);
  const pagedRate = clamp01((itemTransitions / activeMinutes) / 5);

  if (surfaceMode === 'continuous') {
    return {
      forwardEquivalent: screenfulsConsumed,
      absoluteLoad: continuousAbsolute,
      rateLoad: continuousRate,
      behaviorLoad: (continuousAbsolute * 0.78) + (continuousRate * 0.22),
    };
  }
  if (surfaceMode === 'paged') {
    return {
      forwardEquivalent: itemTransitions,
      absoluteLoad: pagedAbsolute,
      rateLoad: pagedRate,
      behaviorLoad: (pagedAbsolute * 0.78) + (pagedRate * 0.22),
    };
  }

  const hybridContinuous = (continuousAbsolute * 0.78) + (continuousRate * 0.22);
  const hybridPaged = (pagedAbsolute * 0.78) + (pagedRate * 0.22);
  const modeConfidence = surfaceMode === 'hybrid' ? 1 : 0.72;
  return {
    forwardEquivalent: Math.max(screenfulsConsumed, itemTransitions),
    absoluteLoad: Math.max(continuousAbsolute, pagedAbsolute),
    rateLoad: Math.max(continuousRate, pagedRate),
    behaviorLoad: Math.max(hybridContinuous, hybridPaged) * modeConfidence,
  };
}

function resolveNoveltyLoad({ surfaceMode, freshItemsSeen, freshItemRate, itemTransitions }) {
  const freshCountLoad = clamp01(freshItemsSeen / 12);
  const freshRateLoad = clamp01(freshItemRate / 1.5);
  const pagedTransitionProxy = surfaceMode === 'paged' || surfaceMode === 'hybrid'
    ? clamp01(itemTransitions / PAGED_PROGRESS_ANCHOR) * 0.7
    : 0;
  return Math.max(
    (freshCountLoad * 0.72) + (freshRateLoad * 0.28),
    pagedTransitionProxy,
  );
}

function resolveRhythmLoad(medianDwellMs) {
  if (
    medianDwellMs === null
    || medianDwellMs === undefined
    || !Number.isFinite(Number(medianDwellMs))
  ) return 0;
  const dwellMs = Math.max(0, Number(medianDwellMs));
  if (dwellMs < 400) return 0.25;
  if (dwellMs < 1200) return 0.25 + (0.6 * ((dwellMs - 400) / 800));
  if (dwellMs <= 5000) return 1;
  if (dwellMs < 12000) return 1 - (0.65 * ((dwellMs - 5000) / 7000));
  return 0.1;
}

function resolvePersistence({ advanceCount, rapidAdvanceStreak }) {
  const forwardRatio = clamp01(rapidAdvanceStreak / Math.max(advanceCount, 4));
  return {
    behaviorLoad: forwardRatio,
    forwardRatio: clamp01(forwardRatio),
  };
}

function resolveResumedBurstAmplification({
  surfaceMode,
  advanceCount,
  rapidAdvanceStreak,
  completedPauseMs,
  interstitialBackwardAdvanceCount,
}) {
  const prePauseAdvanceCount = Math.max(0, advanceCount - rapidAdvanceStreak);
  const pauseEntry = smoothRange(
    completedPauseMs,
    RESUMED_BURST_PAUSE_RISE_START_MS,
    RESUMED_BURST_PAUSE_RISE_END_MS,
  );
  const pauseContinuity = 1 - smoothRange(
    completedPauseMs,
    RESUMED_BURST_PAUSE_FADE_START_MS,
    RESUMED_BURST_PAUSE_FADE_END_MS,
  );
  const prePauseMaturity = smoothRange(prePauseAdvanceCount, 2, 4);
  const resumedMaturity = smoothRange(rapidAdvanceStreak, 2, 3);
  const signal = clamp01(
    pauseEntry
      * pauseContinuity
      * prePauseMaturity
      * resumedMaturity
      * (interstitialBackwardAdvanceCount === 0 ? 1 : 0),
  );
  const maxLift = RESUMED_BURST_MAX_LIFT_BY_SURFACE[surfaceMode] || 0;
  return {
    signal,
    lift: signal * maxLift,
    maxLift,
    prePauseAdvanceCount,
    resumedAdvanceCount: rapidAdvanceStreak,
    completedPauseMs,
    interstitialBackwardAdvanceCount,
  };
}

function resolveRecentActionRelief(intentionality, now) {
  const timestamps = [
    intentionality.recentClickThroughAt,
    intentionality.recentInputFocusAt,
    intentionality.recentTypingAt,
    intentionality.recentSelectionAt,
  ].map((value) => normalizeNumber(value)).filter((value) => value > 0);
  if (timestamps.length === 0) return 0;
  const latestAt = Math.max(...timestamps);
  const ageMs = Math.max(0, now - latestAt);
  return Math.exp(-ageMs / 20000) * 0.16;
}

function resolveMediaRelief(media, now) {
  const latestMediaAt = Math.max(
    normalizeNumber(media.recentMediaPlayAt),
    normalizeNumber(media.recentMediaPauseAt),
  );
  const recentMediaRatio = latestMediaAt > 0
    ? Math.exp(-Math.max(0, now - latestMediaAt) / 30000)
    : 0;
  return recentMediaRatio * 0.14;
}

function resolveSupplyLoad(supply, now) {
  if (supply.initialized !== true) return 0;
  const lastStepAt = normalizeNumber(supply.lastStepAt);
  const freshness = lastStepAt > 0
    ? Math.exp(-Math.max(0, now - lastStepAt) / 15000)
    : 0;
  const structuralLoad = Math.max(
    clamp01(normalizeNumber(supply.loopPressure) / 3),
    clamp01(supply.demandRatio),
    clamp01(supply.lastBottomReachRatio) * 0.75,
  );
  return structuralLoad * freshness;
}

function resolveChannels({
  advanceCount,
  freshItemsSeen,
  medianDwellMs,
  supplyLoad,
}) {
  const channels = [];
  if (advanceCount > 0) channels.push('progression');
  if (freshItemsSeen > 0) channels.push('novelty');
  if (
    medianDwellMs !== null
    && medianDwellMs !== undefined
    && Number.isFinite(Number(medianDwellMs))
  ) channels.push('rhythm');
  if (supplyLoad > 0.05) channels.push('supply');
  return channels;
}

export function projectFeedFlowBingeEvidence(snapshot = {}, {
  now = Date.now(),
} = {}) {
  const normalizedNow = normalizeNow(now);
  const loopSignals = normalizeFeedFlowLoopSignals(snapshot?.loopSignals);
  const progressionSignals = loopSignals.progression;
  const noveltySignals = loopSignals.novelty;
  const rhythmSignals = loopSignals.rhythm;
  const surfaceMode = resolveSurfaceMode(snapshot, loopSignals);
  const contentClass = loopSignals.context.contentClass;
  const advanceCount = Math.max(
    normalizeCount(snapshot?.advanceCount),
    normalizeCount(progressionSignals.advanceCount),
  );
  const rapidAdvanceStreak = Math.max(
    normalizeCount(snapshot?.rapidAdvanceStreak),
    normalizeCount(progressionSignals.rapidAdvanceStreak),
  );
  const screenfulsConsumed = Math.max(
    normalizeNumber(snapshot?.screenfulsConsumed),
    normalizeNumber(progressionSignals.screenfulsConsumed),
  );
  const itemTransitions = Math.max(
    normalizeCount(snapshot?.itemTransitions),
    normalizeCount(progressionSignals.itemTransitions),
  );
  const freshItemsSeen = Math.max(
    normalizeCount(snapshot?.freshItemsSeen),
    normalizeCount(noveltySignals.freshItemsSeen),
  );
  const freshItemRate = Math.max(
    normalizeNumber(noveltySignals.freshItemRate),
    advanceCount > 0 ? freshItemsSeen / advanceCount : 0,
  );
  const hasSnapshotMedianDwell = snapshot?.medianDwellMs !== null
    && snapshot?.medianDwellMs !== undefined
    && Number.isFinite(Number(snapshot.medianDwellMs));
  const medianDwellMs = hasSnapshotMedianDwell
    ? Math.max(0, Number(snapshot.medianDwellMs))
    : rhythmSignals.medianDwellMs;
  const activeMs = resolveActiveMs(snapshot, progressionSignals);
  const lastAdvanceAt = normalizeNumber(snapshot?.lastAdvanceAt);
  const idleAgeMs = lastAdvanceAt > 0 ? Math.max(0, normalizedNow - lastAdvanceAt) : 0;
  const activityFreshness = lastAdvanceAt <= 0
    ? 0
    : (idleAgeMs <= FEED_IDLE_GRACE_MS
      ? 1
      : Math.exp(-(idleAgeMs - FEED_IDLE_GRACE_MS) / FEED_IDLE_TIME_CONSTANT_MS));
  const sampleMaturity = smoothRange(advanceCount, 2, 8);
  const durationMaturity = smoothRange(activeMs, FEED_MATURITY_MIN_MS, FEED_MATURITY_FULL_MS);
  const maturity = (sampleMaturity * 0.55) + (durationMaturity * 0.45);
  const progression = resolveProgression({
    surfaceMode,
    screenfulsConsumed,
    itemTransitions,
    activeMs,
  });
  const noveltyLoad = resolveNoveltyLoad({
    surfaceMode,
    freshItemsSeen,
    freshItemRate,
    itemTransitions,
  });
  const rhythmLoad = resolveRhythmLoad(medianDwellMs);
  const persistence = resolvePersistence({
    advanceCount,
    rapidAdvanceStreak,
  });
  const completedPauseMs = Math.max(
    normalizeNumber(snapshot?.maxPauseMs),
    rhythmSignals.maxPauseMs,
  );
  const interstitialBackwardAdvanceCount = normalizeCount(
    snapshot?.interstitialBackwardAdvanceCount,
  );
  const resumedBurst = resolveResumedBurstAmplification({
    surfaceMode,
    advanceCount,
    rapidAdvanceStreak,
    completedPauseMs,
    interstitialBackwardAdvanceCount,
  });
  const supplyLoad = resolveSupplyLoad(loopSignals.supply, normalizedNow);
  const crossSignalCore = clamp01(
    (progression.behaviorLoad * 0.55)
    + (noveltyLoad * 0.25)
    + (rhythmLoad * 0.2),
  );
  const sustainedProgressionFloor = progression.absoluteLoad * 0.82;
  const coreLoad = Math.max(crossSignalCore, sustainedProgressionFloor);
  const maturedCoreLoad = coreLoad * (0.22 + (0.78 * maturity));
  const supplyLift = maturedCoreLoad > 0.3
    ? supplyLoad * 0.12 * smoothRange(maturedCoreLoad, 0.3, 0.7)
    : 0;
  const actionRelief = resolveRecentActionRelief(loopSignals.intentionality, normalizedNow);
  const mediaRelief = resolveMediaRelief(loopSignals.media, normalizedNow);
  const observedPauseMs = Math.max(
    completedPauseMs,
    idleAgeMs,
  );
  const longPauseRelief = smoothRange(
    observedPauseMs,
    5000,
    20000,
  ) * 0.1;
  const deliberateRelief = Math.min(
    0.28,
    actionRelief + mediaRelief + longPauseRelief,
  );
  const eligibleSurface = contentClass !== 'document' && surfaceMode !== 'document';
  const behaviorLoad = eligibleSurface
    ? clamp01(
      maturedCoreLoad + supplyLift + resumedBurst.lift - deliberateRelief,
    ) * activityFreshness
    : 0;
  const channels = resolveChannels({
    advanceCount,
    freshItemsSeen,
    medianDwellMs,
    supplyLoad,
  });
  const surfaceConfidence = Math.max(
    clamp01(snapshot?.confidence),
    clamp01(loopSignals.context.surfaceConfidence),
  );
  const channelCoverage = clamp01(channels.length / 4);
  const repeatedObservationCertainty = maturity * (0.55 + (0.45 * channelCoverage));
  const repeatedObservationLift = repeatedObservationCertainty * 0.65;
  const measurementConfidence = eligibleSurface
    ? (1 - ((1 - surfaceConfidence) * (1 - repeatedObservationLift))) * activityFreshness
    : 0;

  return Object.freeze({
    kind: 'feed_flow',
    observedAt: normalizedNow,
    lastAdvanceAt,
    burstId: typeof snapshot?.burstId === 'string' ? snapshot.burstId : '',
    surfaceMode,
    eligibleSurface,
    activeMs: Math.round(activeMs),
    sampleCount: advanceCount,
    behaviorLoad: Number(behaviorLoad.toFixed(4)),
    measurementConfidence: Number(clamp01(measurementConfidence).toFixed(4)),
    baseReliability: Number(surfaceConfidence.toFixed(4)),
    repeatedObservationCertainty: Number(repeatedObservationCertainty.toFixed(4)),
    maturity: Number(clamp01(maturity).toFixed(4)),
    activityFreshness: Number(clamp01(activityFreshness).toFixed(4)),
    channels: Object.freeze(channels),
    components: Object.freeze({
      progression: Number(clamp01(progression.behaviorLoad).toFixed(4)),
      sustainedProgressionFloor: Number(clamp01(sustainedProgressionFloor).toFixed(4)),
      novelty: Number(clamp01(noveltyLoad).toFixed(4)),
      rhythm: Number(clamp01(rhythmLoad).toFixed(4)),
      persistence: Number(clamp01(persistence.behaviorLoad).toFixed(4)),
      resumedBurst: Number(resumedBurst.signal.toFixed(4)),
      supply: Number(clamp01(supplyLoad).toFixed(4)),
    }),
    amplification: Object.freeze({
      resumedBurst: Number(resumedBurst.lift.toFixed(4)),
      resumedBurstMax: Number(resumedBurst.maxLift.toFixed(4)),
    }),
    relief: Object.freeze({
      deliberate: Number(deliberateRelief.toFixed(4)),
      action: Number(actionRelief.toFixed(4)),
      media: Number(mediaRelief.toFixed(4)),
      longPause: Number(longPauseRelief.toFixed(4)),
      observedPauseMs: Math.round(observedPauseMs),
    }),
    measurements: Object.freeze({
      forwardEquivalent: Number(progression.forwardEquivalent.toFixed(4)),
      progressionAbsoluteLoad: Number(clamp01(progression.absoluteLoad).toFixed(4)),
      progressionRateLoad: Number(clamp01(progression.rateLoad).toFixed(4)),
      freshItemsSeen,
      freshItemRate: Number(freshItemRate.toFixed(4)),
      forwardRatio: Number(persistence.forwardRatio.toFixed(4)),
      completedPauseMs: Math.round(resumedBurst.completedPauseMs),
      interstitialBackwardAdvanceCount: resumedBurst.interstitialBackwardAdvanceCount,
      prePauseAdvanceCount: resumedBurst.prePauseAdvanceCount,
      resumedAdvanceCount: resumedBurst.resumedAdvanceCount,
      medianDwellMs: medianDwellMs !== null
        && medianDwellMs !== undefined
        && Number.isFinite(Number(medianDwellMs))
        ? Math.round(Number(medianDwellMs))
        : null,
    }),
  });
}

export default projectFeedFlowBingeEvidence;
