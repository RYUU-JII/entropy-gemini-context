import {
  FEED_CONSUMPTION_RESEARCH_TRACE_VERSION,
  getFeedConsumptionResearchJourney,
} from './feedConsumptionResearchContract.mjs';
import {
  evaluateFeedConsumptionResearchExpectation,
  getFeedConsumptionResearchExpectationPolicy,
} from './feedConsumptionResearchExpectations.mjs';

export const FEED_CONSUMPTION_RESEARCH_COLLISION_LOAD_DELTA = 0.08;
export const FEED_CONSUMPTION_RESEARCH_COLLISION_STATE_SHARE = 0.8;
export const FEED_CONSUMPTION_RESEARCH_SENSITIVITY_THRESHOLDS = Object.freeze([
  0.68,
  0.78,
  0.88,
]);
export const FEED_CONSUMPTION_RESEARCH_REFERENCE_DWELL_VALUES = Object.freeze([
  3_750,
  5_000,
  6_250,
]);

function round(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeDirectionality(value = {}) {
  return Object.freeze({
    backwardIntentCount: Math.max(0, Math.round(Number(value.backwardIntentCount) || 0)),
    backtrackRatio: Math.max(0, Math.min(1, Number(value.backtrackRatio) || 0)),
    revisitCount: Math.max(0, Math.round(Number(value.revisitCount) || 0)),
  });
}

function rejectObservation(state, field, checkpointIndex = null) {
  const code = `FEED_CONSUMPTION_RESEARCH_OBSERVATION_${state.toUpperCase()}`;
  const error = new Error(`${code}:${field}`);
  error.code = code;
  error.details = Object.freeze({ state, field, checkpointIndex });
  throw error;
}

function requireObservationNumber(value, field, checkpointIndex, { count = false } = {}) {
  if (value === null || value === undefined) {
    rejectObservation('incomplete', field, checkpointIndex);
  }
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || (count && !Number.isSafeInteger(value))
    || (!count && value > 1)
  ) {
    rejectObservation('invalid', field, checkpointIndex);
  }
  return value;
}

function readCurvePoint(checkpoint) {
  const evidence = checkpoint?.model?.evidence;
  const detection = checkpoint?.model?.detection;
  if (!evidence || !detection) {
    rejectObservation('incomplete', !evidence ? 'model.evidence' : 'model.detection', checkpoint.index);
  }
  const measurement = (value, field, options) => requireObservationNumber(
    value, field, checkpoint.index, options,
  );
  const feedDecision = checkpoint.model.feedDecision;
  return Object.freeze({
    index: checkpoint.index,
    elapsedMs: checkpoint.elapsedMs,
    stepKind: checkpoint.step?.kind || null,
    stepDirection: checkpoint.step?.direction || null,
    behaviorLoad: measurement(evidence.behaviorLoad, 'model.evidence.behaviorLoad'),
    measurementConfidence: measurement(
      evidence.measurementConfidence, 'model.evidence.measurementConfidence',
    ),
    resumedBurstSignal: measurement(
      evidence.components?.resumedBurst, 'model.evidence.components.resumedBurst',
    ),
    resumedBurstLift: measurement(
      evidence.amplification?.resumedBurst, 'model.evidence.amplification.resumedBurst',
    ),
    interstitialBackwardAdvanceCount: measurement(
      evidence.measurements?.interstitialBackwardAdvanceCount,
      'model.evidence.measurements.interstitialBackwardAdvanceCount',
      { count: true },
    ),
    pressure: measurement(detection.pressure, 'model.detection.pressure'),
    detectionConfidence: measurement(detection.confidence, 'model.detection.confidence'),
    state: detection.state || null,
    candidate: detection.candidate === true,
    feedDecisionState: feedDecision?.state || null,
    feedDecisionCandidateState: feedDecision?.candidateState || null,
    observationDirectionality: normalizeDirectionality(
      checkpoint.observation?.loopSignals?.directionality,
    ),
    feedDecisionDirectionality: normalizeDirectionality(feedDecision?.metrics),
    feedDecisionBacktrackSignal: Array.isArray(feedDecision?.reasons)
      && feedDecision.reasons.includes('backtrack_signal_present'),
    admissionStatus: checkpoint.model.admission?.status || null,
    admissionReasons: Object.freeze(
      Array.isArray(checkpoint.model.admission?.reasons)
        ? [...checkpoint.model.admission.reasons]
        : [],
    ),
    matureSessionProjectionStatus: checkpoint.model.matureSessionAdmission?.status || null,
    matureSessionAdmissionStatus:
      checkpoint.model.matureSessionAdmission?.admission?.status || null,
    matureSessionAdmissionReasons: Object.freeze(
      Array.isArray(checkpoint.model.matureSessionAdmission?.admission?.reasons)
        ? [...checkpoint.model.matureSessionAdmission.admission.reasons]
        : [],
    ),
  });
}

function resolveTriggerOutcome(curve) {
  if (Number.isInteger(curve.firstActualAdmissionCheckpoint)) return 'production_admitted';
  if (Number.isInteger(curve.firstMatureSessionAdmissionCheckpoint)) {
    return 'mature_session_admitted';
  }
  if (Number.isInteger(curve.firstCandidateCheckpoint)) return 'candidate_only';
  return 'not_triggered';
}

function classifySemanticCollision({
  collision,
  effectiveTriggerCollision,
  terminalTriggerOutcomeSeparated,
  leftRequirement,
  rightRequirement,
}) {
  const opposed = new Set([leftRequirement, rightRequirement]);
  const policyRelationship = opposed.has('required') && opposed.has('forbidden')
    ? 'opposed'
    : leftRequirement === rightRequirement
      ? 'aligned'
      : 'optional_mixed';
  if (!collision) {
    return { policyRelationship, collisionClass: 'separated', actionability: 'none' };
  }
  if (terminalTriggerOutcomeSeparated || effectiveTriggerCollision === false) {
    return {
      policyRelationship,
      collisionClass: 'downstream_separated',
      actionability: 'none',
    };
  }
  if (effectiveTriggerCollision === null) {
    return {
      policyRelationship,
      collisionClass: 'decision_trajectory_unavailable',
      actionability: policyRelationship === 'opposed' ? 'review' : 'informational',
    };
  }
  if (policyRelationship === 'opposed') {
    return {
      policyRelationship,
      collisionClass: 'harmful_policy_collision',
      actionability: 'actionable',
    };
  }
  if (policyRelationship === 'optional_mixed') {
    return {
      policyRelationship,
      collisionClass: 'ambiguous_policy_overlap',
      actionability: 'review',
    };
  }
  return {
    policyRelationship,
    collisionClass: 'compatible_policy_overlap',
    actionability: 'informational',
  };
}

export function analyzeFeedConsumptionResearchCurve(trace) {
  if (!Array.isArray(trace?.checkpoints)) {
    rejectObservation('incomplete', 'checkpoints');
  }
  const checkpoints = trace.checkpoints;
  const journey = getFeedConsumptionResearchJourney(trace?.journey?.id || trace?.journeyId);
  if (checkpoints.length !== journey.steps.length) {
    rejectObservation('incomplete', 'checkpoints.length');
  }
  // Keep every declared step in the denominator. Dropping a missing point would
  // shorten expectation windows and turn unavailable measurements into a MATCH.
  const points = Array.from(checkpoints, (checkpoint, index) => {
    if (!checkpoint) rejectObservation('incomplete', 'checkpoint', index);
    if (checkpoint.index !== index) rejectObservation('invalid', 'checkpoint.index', index);
    return readCurvePoint(checkpoint);
  });
  const pauseTransitions = [];
  points.forEach((point, index) => {
    if (point.stepKind !== 'pause' || index === 0) return;
    const previous = points[index - 1];
    pauseTransitions.push({
      index: point.index,
      beforePressure: previous.pressure,
      afterPressure: point.pressure,
      pressureDelta: round(point.pressure - previous.pressure),
    });
  });
  const firstCandidate = points.find((point) => point.candidate) || null;
  const firstActualAdmission = points.find(
    (point) => point.admissionStatus === 'admitted',
  ) || null;
  const firstMatureSessionAdmission = points.find(
    (point) => point.matureSessionAdmissionStatus === 'admitted',
  ) || null;
  const timerOnlyIncreaseCount = pauseTransitions.filter(
    (transition) => transition.pressureDelta > 0.001,
  ).length;
  const requestedBackwardStepCount = checkpoints.filter(
    (checkpoint) => checkpoint?.step?.kind === 'advance'
      && checkpoint.step.direction === 'backward',
  ).length;
  const performedBackwardStepCount = checkpoints.filter(
    (checkpoint) => checkpoint?.step?.kind === 'advance'
      && checkpoint.step.direction === 'backward'
      && (
        checkpoint.driver?.action?.trustedInput === true
        || checkpoint.driver?.state === 'advance_confirmed'
      ),
  ).length;
  const measuredBackwardStepCount = checkpoints.filter(
    (checkpoint) => checkpoint?.step?.kind === 'advance'
      && checkpoint.step.direction === 'backward'
      && checkpoint.driver?.action?.opportunity?.state === 'measured',
  ).length;
  const maximumBackwardIntentCount = Math.max(...points.flatMap((point) => [
    point.observationDirectionality.backwardIntentCount,
    point.feedDecisionDirectionality.backwardIntentCount,
  ]));
  const maximumBacktrackRatio = Math.max(...points.flatMap((point) => [
    point.observationDirectionality.backtrackRatio,
    point.feedDecisionDirectionality.backtrackRatio,
  ]));
  const maximumRevisitCount = Math.max(...points.flatMap((point) => [
    point.observationDirectionality.revisitCount,
    point.feedDecisionDirectionality.revisitCount,
  ]));
  const backtrackSignalCheckpointCount = points.filter(
    (point) => point.feedDecisionBacktrackSignal,
  ).length;
  const backwardEvidenceObserved = maximumBackwardIntentCount > 0
    || maximumBacktrackRatio > 0
    || maximumRevisitCount > 0
    || backtrackSignalCheckpointCount > 0;
  const curve = {
    version: FEED_CONSUMPTION_RESEARCH_TRACE_VERSION,
    journeyId: trace?.journey?.id || trace?.journeyId || null,
    surfaceMode: trace?.surfaceMode || null,
    checkpointCount: points.length,
    meanBehaviorLoad: round(average(points.map((point) => point.behaviorLoad))),
    meanPressure: round(average(points.map((point) => point.pressure))),
    peakBehaviorLoad: round(Math.max(...points.map((point) => point.behaviorLoad))),
    peakPressure: round(Math.max(...points.map((point) => point.pressure))),
    peakResumedBurstLift: round(Math.max(...points.map((point) => point.resumedBurstLift))),
    resumedBurstCheckpointCount: points.filter(
      (point) => point.resumedBurstLift > 0,
    ).length,
    backtrackSuppressedResumeCheckpointCount: points.filter(
      (point) => point.interstitialBackwardAdvanceCount > 0
        && point.resumedBurstSignal === 0,
    ).length,
    finalBehaviorLoad: round(points.at(-1).behaviorLoad),
    finalPressure: round(points.at(-1).pressure),
    firstCandidateCheckpoint: firstCandidate?.index ?? null,
    firstActualAdmissionCheckpoint: firstActualAdmission?.index ?? null,
    firstMatureSessionAdmissionCheckpoint: firstMatureSessionAdmission?.index ?? null,
    candidateCheckpointShare: round(
      points.filter((point) => point.candidate).length / points.length,
    ),
    actualAdmissionCheckpointShare: round(
      points.filter((point) => point.admissionStatus === 'admitted').length / points.length,
    ),
    matureSessionAdmissionCheckpointShare: round(
      points.filter((point) => point.matureSessionAdmissionStatus === 'admitted').length
        / points.length,
    ),
    admissionTimingSeparation: firstActualAdmission
      ? 'production_admitted'
      : firstMatureSessionAdmission
        ? 'time_or_spawn_policy_constrained'
        : 'model_or_endpoint_not_admissible',
    stateSequence: Object.freeze(points.map((point) => point.state)),
    pauseTransitions: Object.freeze(pauseTransitions),
    timerOnlyIncreaseCount,
    timerOnlyInvariant: timerOnlyIncreaseCount === 0,
    directionalityEvidence: Object.freeze({
      requestedBackwardStepCount,
      performedBackwardStepCount,
      measuredBackwardStepCount,
      maximumBackwardIntentCount,
      maximumBacktrackRatio: round(maximumBacktrackRatio),
      maximumRevisitCount,
      backtrackSignalCheckpointCount,
      captureStatus: requestedBackwardStepCount === 0
        ? 'not_applicable'
        : (backwardEvidenceObserved ? 'observed' : 'missing'),
    }),
    points: Object.freeze(points),
  };
  return Object.freeze({
    ...curve,
    researchExpectation: evaluateFeedConsumptionResearchExpectation(curve),
  });
}

export function compareFeedConsumptionResearchCurves(left, right) {
  const leftAnalysis = left?.points ? left : analyzeFeedConsumptionResearchCurve(left);
  const rightAnalysis = right?.points ? right : analyzeFeedConsumptionResearchCurve(right);
  const count = Math.min(leftAnalysis.points.length, rightAnalysis.points.length);
  if (count < 1) throw new Error('FEED_CONSUMPTION_RESEARCH_CURVE_COMPARISON_EMPTY');
  const loadDeltas = [];
  const pressureDeltas = [];
  let equalStateCount = 0;
  let alignedDecisionStateCount = 0;
  let equalDecisionStateCount = 0;
  for (let index = 0; index < count; index += 1) {
    const leftPoint = leftAnalysis.points[index];
    const rightPoint = rightAnalysis.points[index];
    loadDeltas.push(Math.abs(leftPoint.behaviorLoad - rightPoint.behaviorLoad));
    pressureDeltas.push(Math.abs(leftPoint.pressure - rightPoint.pressure));
    if (leftPoint.state === rightPoint.state) equalStateCount += 1;
    if (leftPoint.feedDecisionState && rightPoint.feedDecisionState) {
      alignedDecisionStateCount += 1;
      if (leftPoint.feedDecisionState === rightPoint.feedDecisionState) {
        equalDecisionStateCount += 1;
      }
    }
  }
  const meanLoadDelta = average(loadDeltas);
  const meanPressureDelta = average(pressureDeltas);
  const equalStateShare = equalStateCount / count;
  const collision = (
    meanLoadDelta < FEED_CONSUMPTION_RESEARCH_COLLISION_LOAD_DELTA
    && equalStateShare >= FEED_CONSUMPTION_RESEARCH_COLLISION_STATE_SHARE
  );
  const equalDecisionStateShare = alignedDecisionStateCount > 0
    ? equalDecisionStateCount / alignedDecisionStateCount
    : null;
  const leftTriggerOutcome = resolveTriggerOutcome(leftAnalysis);
  const rightTriggerOutcome = resolveTriggerOutcome(rightAnalysis);
  const terminalTriggerOutcomeSeparated = leftTriggerOutcome !== rightTriggerOutcome;
  const alignedDecisionSeparationObserved = equalDecisionStateShare !== null
    && equalDecisionStateShare < FEED_CONSUMPTION_RESEARCH_COLLISION_STATE_SHARE;
  const effectiveTriggerCollision = equalDecisionStateShare === null
    ? null
    : collision
      && !alignedDecisionSeparationObserved
      && !terminalTriggerOutcomeSeparated;
  const leftRequirement = getFeedConsumptionResearchExpectationPolicy(
    leftAnalysis.journeyId,
  ).admissionRequirement;
  const rightRequirement = getFeedConsumptionResearchExpectationPolicy(
    rightAnalysis.journeyId,
  ).admissionRequirement;
  const semantic = classifySemanticCollision({
    collision,
    effectiveTriggerCollision,
    terminalTriggerOutcomeSeparated,
    leftRequirement,
    rightRequirement,
  });
  return Object.freeze({
    leftJourneyId: leftAnalysis.journeyId,
    rightJourneyId: rightAnalysis.journeyId,
    surfaceMode: leftAnalysis.surfaceMode === rightAnalysis.surfaceMode
      ? leftAnalysis.surfaceMode
      : 'mixed',
    alignedCheckpointCount: count,
    meanBehaviorLoadDelta: round(meanLoadDelta),
    meanPressureDelta: round(meanPressureDelta),
    equalStateShare: round(equalStateShare),
    collision,
    decisionStateAlignedCheckpointCount: alignedDecisionStateCount,
    equalDecisionStateShare: round(equalDecisionStateShare),
    leftTriggerOutcome,
    rightTriggerOutcome,
    terminalTriggerOutcomeSeparated,
    effectiveTriggerCollision,
    decisionSeparationObserved: collision
      && (alignedDecisionSeparationObserved || terminalTriggerOutcomeSeparated),
    leftAdmissionRequirement: leftRequirement,
    rightAdmissionRequirement: rightRequirement,
    policyRelationship: semantic.policyRelationship,
    semanticCollisionClass: semantic.collisionClass,
    semanticActionability: semantic.actionability,
    diagnosticThresholds: Object.freeze({
      maximumMeanBehaviorLoadDelta: FEED_CONSUMPTION_RESEARCH_COLLISION_LOAD_DELTA,
      minimumEqualStateShare: FEED_CONSUMPTION_RESEARCH_COLLISION_STATE_SHARE,
    }),
  });
}

export function analyzeFeedConsumptionResearchSuite(traces) {
  if (!Array.isArray(traces) || traces.length === 0) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_SUITE_TRACES_REQUIRED');
  }
  const curves = traces.map(analyzeFeedConsumptionResearchCurve);
  const comparisons = [];
  for (let leftIndex = 0; leftIndex < curves.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < curves.length; rightIndex += 1) {
      if (curves[leftIndex].surfaceMode !== curves[rightIndex].surfaceMode) continue;
      if (curves[leftIndex].journeyId === curves[rightIndex].journeyId) continue;
      comparisons.push(compareFeedConsumptionResearchCurves(
        curves[leftIndex],
        curves[rightIndex],
      ));
    }
  }
  return Object.freeze({
    version: FEED_CONSUMPTION_RESEARCH_TRACE_VERSION,
    curveCount: curves.length,
    curves: Object.freeze(curves),
    comparisons: Object.freeze(comparisons),
    collisions: Object.freeze(comparisons.filter((comparison) => comparison.collision)),
    semanticCollisions: Object.freeze(comparisons.filter(
      (comparison) => comparison.semanticActionability === 'actionable',
    )),
    semanticCollisionSummary: Object.freeze({
      actionableCount: comparisons.filter(
        (comparison) => comparison.semanticActionability === 'actionable',
      ).length,
      reviewCount: comparisons.filter(
        (comparison) => comparison.semanticActionability === 'review',
      ).length,
      informationalCount: comparisons.filter(
        (comparison) => comparison.semanticActionability === 'informational',
      ).length,
    }),
    timerOnlyViolationCount: curves.reduce(
      (sum, curve) => sum + curve.timerOnlyIncreaseCount,
      0,
    ),
    expectationSummary: Object.freeze({
      matchCount: curves.filter(
        (curve) => curve.researchExpectation.status === 'MATCH',
      ).length,
      mismatchCount: curves.filter(
        (curve) => curve.researchExpectation.status === 'MISMATCH',
      ).length,
      insufficientEvidenceCount: curves.filter(
        (curve) => curve.researchExpectation.status === 'INSUFFICIENT_EVIDENCE',
      ).length,
    }),
  });
}

export function projectFeedConsumptionResearchSensitivity(analysis, {
  candidateThresholds = FEED_CONSUMPTION_RESEARCH_SENSITIVITY_THRESHOLDS,
  referenceDwellMsValues = FEED_CONSUMPTION_RESEARCH_REFERENCE_DWELL_VALUES,
} = {}) {
  const curves = Array.isArray(analysis?.curves) ? analysis.curves : [];
  const thresholds = candidateThresholds.map((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0.55 || numeric > 0.9) {
      throw new Error(`FEED_CONSUMPTION_RESEARCH_SENSITIVITY_THRESHOLD_INVALID:${value}`);
    }
    return numeric;
  });
  const references = referenceDwellMsValues.map((value) => {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 3_750 || numeric > 6_250) {
      throw new Error(`FEED_CONSUMPTION_RESEARCH_SENSITIVITY_REFERENCE_INVALID:${value}`);
    }
    return numeric;
  });
  const detectorProjections = thresholds.map((threshold) => {
    const journeys = curves.map((curve) => {
      const candidatePoints = curve.points.filter((point) => (
        point.pressure >= threshold && point.detectionConfidence >= 0.38
      ));
      const admissionRequirement = getFeedConsumptionResearchExpectationPolicy(
        curve.journeyId,
      ).admissionRequirement;
      const candidateObserved = candidatePoints.length > 0;
      const requirementFit = admissionRequirement === 'required'
        ? (candidateObserved ? 'match' : 'required_candidate_missing')
        : admissionRequirement === 'forbidden'
          ? (candidateObserved ? 'forbidden_candidate_present' : 'match')
          : 'optional';
      return Object.freeze({
        journeyId: curve.journeyId,
        admissionRequirement,
        firstCandidateCheckpoint: candidatePoints[0]?.index ?? null,
        candidateCheckpointShare: round(candidatePoints.length / curve.points.length),
        requirementFit,
      });
    });
    return Object.freeze({
      candidateThreshold: round(threshold),
      journeys: Object.freeze(journeys),
      requiredCandidateMissingCount: journeys.filter(
        (journey) => journey.requirementFit === 'required_candidate_missing',
      ).length,
      forbiddenCandidatePresentCount: journeys.filter(
        (journey) => journey.requirementFit === 'forbidden_candidate_present',
      ).length,
    });
  });
  return Object.freeze({
    version: 1,
    authority: 'research_diagnostic_only',
    productionPolicyInfluence: false,
    detectorProjections: Object.freeze(detectorProjections),
    personalReferenceProjection: Object.freeze({
      referenceDwellMsValues: Object.freeze(references),
      applicableSurfaceModes: Object.freeze(['paged']),
      productionDetectorInfluence: false,
      detectorInvariant: true,
      reason: 'personal_reference_is_observational_until_explicit_product_promotion',
    }),
  });
}

export function createFeedConsumptionResearchMarkdownReport(analysis, {
  title = 'Feed Consumption Research',
} = {}) {
  const lines = [
    `# ${title}`,
    '',
    `- Curves: ${analysis.curveCount}`,
    `- Collision flags: ${analysis.collisions.length}`,
    `- Actionable semantic collisions: ${analysis.semanticCollisions?.length ?? 0}`,
    `- Timer-only pressure increases: ${analysis.timerOnlyViolationCount}`,
    `- Expectation matches: ${analysis.expectationSummary?.matchCount ?? 0}`,
    `- Expectation mismatches: ${analysis.expectationSummary?.mismatchCount ?? 0}`,
    `- Expectation insufficient: ${analysis.expectationSummary?.insufficientEvidenceCount ?? 0}`,
    '',
    '## Curves',
    '',
    '| Journey | Surface | Mean load | Peak load | Resume lift | Resume points | First candidate | Actual admit | Mature admit | Expectation | Backtrack evidence | Timer-only invariant |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |',
  ];
  analysis.curves.forEach((curve) => {
    lines.push(
      `| ${curve.journeyId} | ${curve.surfaceMode} | ${curve.meanBehaviorLoad}`
      + ` | ${curve.peakBehaviorLoad} | ${curve.peakResumedBurstLift}`
      + ` | ${curve.resumedBurstCheckpointCount}`
      + ` | ${curve.firstCandidateCheckpoint ?? '-'}`
      + ` | ${curve.firstActualAdmissionCheckpoint ?? '-'}`
      + ` | ${curve.firstMatureSessionAdmissionCheckpoint ?? '-'}`
      + ` | ${curve.researchExpectation.status}`
      + ` | ${curve.directionalityEvidence.captureStatus}`
      + ` | ${curve.timerOnlyInvariant ? 'yes' : 'no'} |`,
    );
  });
  lines.push('', '## Pairwise separation', '');
  if (analysis.comparisons.length === 0) {
    lines.push('- No comparable journey pairs.');
  } else {
    lines.push(
      '| Left | Right | Surface | Mean load delta | Equal state share | Collision | Semantic class | Actionability |',
      '| --- | --- | --- | ---: | ---: | --- | --- | --- |',
    );
    analysis.comparisons.forEach((comparison) => {
      lines.push(
        `| ${comparison.leftJourneyId} | ${comparison.rightJourneyId}`
        + ` | ${comparison.surfaceMode} | ${comparison.meanBehaviorLoadDelta}`
        + ` | ${comparison.equalStateShare} | ${comparison.collision ? 'yes' : 'no'}`
        + `${comparison.equalDecisionStateShare === null ? '' : `; decision share ${comparison.equalDecisionStateShare}`}`
        + ` | ${comparison.semanticCollisionClass}`
        + ` | ${comparison.semanticActionability} |`,
      );
    });
  }
  return `${lines.join('\n')}\n`;
}
