import FeedBingeObservationWindow from '../../../src/domains/nudge/attention/FeedBingeObservationWindow.js';
import {
  classifyInterventionConsumptionPattern,
} from '../../../src/domains/nudge/attention/consumptionPatternClassifier.js';
import {
  resolveDopamineBingeDetection,
} from '../../../src/domains/nudge/attention/dopamineBingeDetector.js';
import {
  projectFeedFlowBingeEvidence,
} from '../../../src/domains/nudge/attention/feedFlowBingeEvidence.js';
import {
  createFeedConsumptionResearchCheckpoint,
  getFeedConsumptionResearchJourney,
  normalizeFeedConsumptionResearchCandidateThreshold,
  normalizeFeedConsumptionResearchReferenceDwellMs,
  normalizeFeedConsumptionResearchTimeScale,
} from './feedConsumptionResearchContract.mjs';
import {
  projectMatureSessionFeedAdmission,
} from './feedConsumptionResearchTiming.mjs';

const REPLAY_START_AT = 100_000;

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function createLoopSignals({
  surfaceMode,
  forwardIntentCount,
  backwardIntentCount,
  recentMediaPlayAt,
}) {
  const totalIntentCount = forwardIntentCount + backwardIntentCount;
  return {
    context: {
      surfaceMode,
      surfaceProfileId: `research_${surfaceMode}`,
      surfaceConfidence: 0.85,
      contentClass: surfaceMode === 'paged' ? 'short_video' : 'feed',
    },
    directionality: {
      forwardIntentCount,
      backwardIntentCount,
      backtrackRatio: totalIntentCount > 0
        ? backwardIntentCount / totalIntentCount
        : 0,
      revisitCount: backwardIntentCount,
    },
    media: {
      recentMediaPlayAt,
      recentMediaPauseAt: 0,
      sustainedMediaWatchMs: 0,
    },
  };
}

function createIsolatedFeedDecision(surfaceMode) {
  const capability = surfaceMode === 'paged' ? 'paged_hold' : 'anchored_continuous';
  return Object.freeze({
    readiness: Object.freeze({ status: 'ready', capability }),
    actuationSafety: Object.freeze({ status: 'safe', capability }),
  });
}

export function projectVirtualFeedTempoReference({
  surfaceMode,
  medianDwellMs,
  referenceDwellMs,
} = {}) {
  if (surfaceMode !== 'paged') {
    return Object.freeze({
      authority: 'research_only',
      applicable: false,
      reason: 'paged_item_dwell_only',
    });
  }
  const normalizedReference = normalizeFeedConsumptionResearchReferenceDwellMs(
    referenceDwellMs,
  );
  const dwell = medianDwellMs === null || medianDwellMs === undefined
    ? null
    : Math.max(0, Number(medianDwellMs));
  const paceRatio = dwell && Number.isFinite(dwell)
    ? normalizedReference / dwell
    : null;
  let direction = 'unknown';
  if (paceRatio !== null) {
    if (paceRatio >= 1.35) direction = 'faster';
    else if (paceRatio <= 0.75) direction = 'slower';
    else direction = 'typical';
  }
  return Object.freeze({
    authority: 'research_only',
    applicable: true,
    referenceMode: 'virtual_bounded_adaptive',
    referenceDwellMs: normalizedReference,
    currentMedianDwellMs: dwell === null ? null : Math.round(dwell),
    paceRatio: paceRatio === null ? null : round(paceRatio),
    direction,
    productionDetectorInfluence: false,
  });
}

function projectCheckpoint({
  observationWindow,
  journey,
  surfaceMode,
  step,
  index,
  now,
  candidateThreshold,
  referenceDwellMs,
  startedAt,
  driver,
}) {
  const observation = observationWindow.getSnapshot({ now });
  const evidence = projectFeedFlowBingeEvidence(observation, { now });
  const detection = resolveDopamineBingeDetection({
    feedEvidence: evidence,
    now,
    candidateThreshold,
  });
  const consumptionProfile = classifyInterventionConsumptionPattern({
    bingeDetection: detection,
    now,
  });
  const feedDecision = createIsolatedFeedDecision(surfaceMode);
  const matureSessionAdmission = projectMatureSessionFeedAdmission({
    surfaceMode,
    detection,
    feedDecision,
    now,
  });
  const personalReference = projectVirtualFeedTempoReference({
    surfaceMode,
    medianDwellMs: evidence.measurements?.medianDwellMs,
    referenceDwellMs,
  });
  return createFeedConsumptionResearchCheckpoint({
    index,
    journeyId: journey.id,
    surfaceMode,
    step,
    capturedAt: now,
    elapsedMs: now - startedAt,
    driver,
    observation,
    evidence,
    detection,
    consumptionProfile,
    feedDecision,
    admission: null,
    matureSessionAdmission,
    personalReference,
  });
}

export function replayFeedConsumptionJourney({
  journeyId,
  surfaceMode = 'paged',
  timeScale = 1,
  candidateThreshold = 0.78,
  referenceDwellMs = 5_000,
  startedAt = REPLAY_START_AT,
} = {}) {
  const journey = getFeedConsumptionResearchJourney(journeyId, { surfaceMode });
  const scale = normalizeFeedConsumptionResearchTimeScale(timeScale);
  const threshold = normalizeFeedConsumptionResearchCandidateThreshold(candidateThreshold);
  const reference = normalizeFeedConsumptionResearchReferenceDwellMs(referenceDwellMs);
  if (!Number.isSafeInteger(startedAt) || startedAt < 1) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_REPLAY_START_INVALID');
  }
  const observationWindow = new FeedBingeObservationWindow();
  const checkpoints = [];
  let now = startedAt;
  let previousDwellMs = 0;
  let forwardIntentCount = 0;
  let backwardIntentCount = 0;
  let recentMediaPlayAt = 0;

  journey.steps.forEach((step, index) => {
    if (step.kind === 'pause') {
      now += Math.round(step.durationMs * scale);
      checkpoints.push(projectCheckpoint({
        observationWindow,
        journey,
        surfaceMode,
        step,
        index,
        now,
        candidateThreshold: threshold,
        referenceDwellMs: reference,
        startedAt,
        driver: {
          source: 'deterministic_replay',
          state: 'pause_elapsed',
          requestedDurationMs: step.durationMs,
          actualDurationMs: Math.round(step.durationMs * scale),
        },
      }));
      previousDwellMs = 0;
      return;
    }
    now += Math.round(previousDwellMs * scale);
    if (step.direction === 'backward') backwardIntentCount += 1;
    else forwardIntentCount += 1;
    if (step.mediaEngaged) recentMediaPlayAt = now;
    observationWindow.recordAdvance({
      ts: now,
      direction: step.direction,
      surfaceMode,
      screenfulDelta: surfaceMode === 'continuous' ? 1 : 0,
      itemTransitionCount: surfaceMode === 'paged' ? 1 : 0,
      freshItemsSeen: step.direction === 'forward' ? 1 : 0,
      confidence: 0.85,
      loopSignals: createLoopSignals({
        surfaceMode,
        forwardIntentCount,
        backwardIntentCount,
        recentMediaPlayAt,
      }),
    });
    checkpoints.push(projectCheckpoint({
      observationWindow,
      journey,
      surfaceMode,
      step,
      index,
      now,
      candidateThreshold: threshold,
      referenceDwellMs: reference,
      startedAt,
      driver: {
        source: 'deterministic_replay',
        state: 'advance_confirmed',
        direction: step.direction,
        requestedDwellMs: step.dwellMs,
        scaledDwellMs: Math.round(step.dwellMs * scale),
      },
    }));
    previousDwellMs = step.dwellMs;
  });

  return Object.freeze({
    version: 1,
    source: 'deterministic_replay',
    journey,
    surfaceMode,
    timeScale: scale,
    candidateThreshold: threshold,
    referenceDwellMs: reference,
    startedAt,
    finishedAt: now,
    checkpoints: Object.freeze(checkpoints),
  });
}
