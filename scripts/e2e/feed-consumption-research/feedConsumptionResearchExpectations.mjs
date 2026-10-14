export const FEED_CONSUMPTION_RESEARCH_EXPECTATION_VERSION = 1;

const EXPECTATION_POLICIES = Object.freeze({
  skim_forward: Object.freeze({
    admissionRequirement: 'optional',
    earliestWindowKind: 'terminal_fraction',
    earliestWindowValue: 0.625,
    rationale: 'rapid rejection is ambiguous, but must not trigger prematurely',
  }),
  steady_forward: Object.freeze({
    admissionRequirement: 'required',
    earliestWindowKind: 'terminal_fraction',
    earliestWindowValue: 0.625,
    rationale: 'sustained forward consumption should become admissible near the terminal window',
  }),
  deliberate_watch: Object.freeze({
    admissionRequirement: 'forbidden',
    earliestWindowKind: 'none',
    earliestWindowValue: null,
    rationale: 'deliberate item watching must remain distinct from a binge trajectory',
  }),
  burst_pause_burst: Object.freeze({
    admissionRequirement: 'required',
    earliestWindowKind: 'after_pause',
    earliestWindowValue: null,
    rationale: 'a pause must not increase pressure, while a resumed burst may become admissible',
  }),
  revisit_deliberate: Object.freeze({
    admissionRequirement: 'optional',
    earliestWindowKind: 'after_last_backward',
    earliestWindowValue: null,
    directionalityRequired: true,
    rationale: 'reconsideration must be observed and must not itself cause an intervention',
  }),
});

function resolveEarliestCheckpoint(policy, points) {
  if (policy.earliestWindowKind === 'none') return null;
  if (policy.earliestWindowKind === 'terminal_fraction') {
    const position = Math.ceil((points.length - 1) * policy.earliestWindowValue);
    return points[position]?.index ?? null;
  }
  if (policy.earliestWindowKind === 'after_pause') {
    const pausePosition = points.findIndex((point) => point.stepKind === 'pause');
    return pausePosition >= 0 ? (points[pausePosition + 1]?.index ?? null) : null;
  }
  if (policy.earliestWindowKind === 'after_last_backward') {
    let backwardPosition = -1;
    points.forEach((point, index) => {
      if (point.stepKind === 'advance' && point.stepDirection === 'backward') {
        backwardPosition = index;
      }
    });
    return backwardPosition >= 0 ? (points[backwardPosition + 1]?.index ?? null) : null;
  }
  throw new Error(
    `FEED_CONSUMPTION_RESEARCH_EXPECTATION_WINDOW_UNKNOWN:${policy.earliestWindowKind}`,
  );
}

export function evaluateFeedConsumptionResearchExpectation(curve) {
  const policy = EXPECTATION_POLICIES[curve?.journeyId];
  if (!policy) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_EXPECTATION_JOURNEY_UNKNOWN:${String(curve?.journeyId || '')}`,
    );
  }
  const points = Array.isArray(curve?.points) ? curve.points : [];
  if (points.length === 0) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_EXPECTATION_POINTS_REQUIRED');
  }
  const earliestCheckpoint = resolveEarliestCheckpoint(policy, points);
  const projectedPoints = points.filter(
    (point) => point.matureSessionAdmissionStatus !== null,
  );
  const admittedPoints = projectedPoints.filter(
    (point) => point.matureSessionAdmissionStatus === 'admitted',
  );
  const firstAdmittedCheckpoint = admittedPoints[0]?.index ?? null;
  const reasons = [];

  if (projectedPoints.length !== points.length) {
    reasons.push('mature_session_projection_incomplete');
  }
  if (policy.admissionRequirement === 'required' && admittedPoints.length === 0) {
    reasons.push('expected_mature_session_admission_missing');
  }
  if (policy.admissionRequirement === 'forbidden' && admittedPoints.length > 0) {
    reasons.push('unexpected_mature_session_admission');
  }
  if (
    firstAdmittedCheckpoint !== null
    && earliestCheckpoint !== null
    && firstAdmittedCheckpoint < earliestCheckpoint
  ) {
    reasons.push('mature_session_admission_before_expected_window');
  }
  if (curve.timerOnlyInvariant !== true) {
    reasons.push('timer_only_pressure_increase');
  }
  if (
    policy.directionalityRequired === true
    && curve.directionalityEvidence?.captureStatus !== 'observed'
  ) {
    reasons.push('directionality_evidence_missing');
  }

  const mismatchReasons = reasons.filter(
    (reason) => reason !== 'mature_session_projection_incomplete',
  );
  const status = mismatchReasons.length > 0
    ? 'MISMATCH'
    : reasons.includes('mature_session_projection_incomplete')
      ? 'INSUFFICIENT_EVIDENCE'
      : 'MATCH';
  return Object.freeze({
    version: FEED_CONSUMPTION_RESEARCH_EXPECTATION_VERSION,
    authority: 'research_diagnostic_only',
    productionPolicyInfluence: false,
    status,
    journeyId: curve.journeyId,
    policy: Object.freeze({ ...policy }),
    expectedWindow: Object.freeze({
      earliestCheckpoint,
      latestCheckpoint: policy.admissionRequirement === 'forbidden'
        ? null
        : points.at(-1).index,
    }),
    observed: Object.freeze({
      projectedCheckpointCount: projectedPoints.length,
      firstAdmittedCheckpoint,
      admittedCheckpointCount: admittedPoints.length,
    }),
    reasons: Object.freeze(reasons),
  });
}

export function getFeedConsumptionResearchExpectationPolicy(journeyId) {
  const policy = EXPECTATION_POLICIES[journeyId];
  if (!policy) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_EXPECTATION_JOURNEY_UNKNOWN:${String(journeyId || '')}`,
    );
  }
  return policy;
}
