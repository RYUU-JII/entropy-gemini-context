export const FEED_CONSUMPTION_VALIDATION_VERSION = 1;

const OPPORTUNITY_STATES = new Set(['measured', 'armed_idle', 'insufficient']);
const SURFACE_MODES = new Set(['continuous', 'paged', 'hybrid']);
const INTENT_KINDS = new Set(['wheel', 'scroll', 'keydown', 'touch', 'pointer', 'unknown']);
const PAGED_CONFIRMATION_REASONS = new Set([
  'intent_immediate',
  'intent_settle',
  'scroll_settle',
  'mutation_immediate',
  'mutation_settle',
  'media_play_settle',
  'baseline_sync',
  'baseline_settle',
  'gesture_deadline',
  'unknown',
]);
const WINNER_IDENTITY_SOURCES = new Set([
  'content_key',
  'media_revision',
  'node_token',
  'unknown',
]);
const OPAQUE_ITEM_TOKEN_PATTERN = /^item-[a-f0-9]{8}$/u;
const FEED_STEP_ID_PATTERN = /^feed-step-([1-9]\d*)$/u;

function finiteNonNegative(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function finiteTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function readFeedStepGestureSequence(stepId) {
  const match = FEED_STEP_ID_PATTERN.exec(String(stepId || ''));
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

function readEventGestureSequence(event) {
  const sequence = Number(event?.gestureSequence);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function roundMetric(value, digits = 6) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values, percentileValue) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index];
}

function normalizeOracleSample(sample) {
  if (!sample || typeof sample !== 'object' || sample.state !== 'measured') return null;
  return {
    dominantToken: typeof sample.dominantToken === 'string' && sample.dominantToken
      ? sample.dominantToken
      : null,
    dominantIdentitySource: typeof sample.dominantIdentitySource === 'string'
      ? sample.dominantIdentitySource
      : null,
    dominantActiveMedia: typeof sample.dominantActiveMedia === 'boolean'
      ? sample.dominantActiveMedia
      : null,
    dominantScore: Number.isFinite(Number(sample.dominantScore))
      ? Number(sample.dominantScore)
      : null,
    candidateCount: Math.max(0, Math.round(Number(sample.candidateCount) || 0)),
    scrollTop: finiteNonNegative(sample.scrollTop),
    scrollHeight: finiteNonNegative(sample.scrollHeight),
    clientHeight: finiteNonNegative(sample.clientHeight),
  };
}

export function classifyFeedConsumptionOpportunity({
  stepId,
  surfaceMode,
  before,
  after,
  startedAt,
  finishedAt,
  minimumProgressRatio = 0.2,
} = {}) {
  if (typeof stepId !== 'string' || !stepId) {
    throw new Error('FEED_CONSUMPTION_STEP_ID_REQUIRED');
  }
  if (!SURFACE_MODES.has(surfaceMode)) {
    throw new Error(`FEED_CONSUMPTION_SURFACE_MODE_INVALID:${String(surfaceMode || '')}`);
  }
  const normalizedBefore = normalizeOracleSample(before);
  const normalizedAfter = normalizeOracleSample(after);
  const normalizedStartedAt = finiteTimestamp(startedAt);
  const normalizedFinishedAt = finiteTimestamp(finishedAt);
  if (
    !normalizedBefore
    || !normalizedAfter
    || normalizedStartedAt === null
    || normalizedFinishedAt === null
    || normalizedFinishedAt < normalizedStartedAt
  ) {
    return {
      version: FEED_CONSUMPTION_VALIDATION_VERSION,
      stepId,
      state: 'insufficient',
      reason: 'oracle_sample_unavailable',
      startedAt: normalizedStartedAt,
      finishedAt: normalizedFinishedAt,
      evidence: null,
    };
  }

  const dominantChanged = !!(
    normalizedBefore.dominantToken
    && normalizedAfter.dominantToken
    && normalizedBefore.dominantToken !== normalizedAfter.dominantToken
  );
  const scrollDelta = Math.max(0, normalizedAfter.scrollTop - normalizedBefore.scrollTop);
  const progressRatio = ratio(
    scrollDelta,
    Math.max(1, normalizedBefore.clientHeight, normalizedAfter.clientHeight),
  );
  const candidateDelta = normalizedAfter.candidateCount - normalizedBefore.candidateCount;
  const progressed = progressRatio !== null
    && progressRatio >= Math.max(0.01, Number(minimumProgressRatio) || 0.2);
  const hasPagedIdentity = !!(
    normalizedBefore.dominantToken
    && normalizedAfter.dominantToken
  );

  if (
    (surfaceMode === 'paged' || surfaceMode === 'hybrid')
    && !hasPagedIdentity
    && !(surfaceMode === 'hybrid' && progressed)
  ) {
    return {
      version: FEED_CONSUMPTION_VALIDATION_VERSION,
      stepId,
      state: 'insufficient',
      reason: 'oracle_dominant_item_unavailable',
      startedAt: normalizedStartedAt,
      finishedAt: normalizedFinishedAt,
      evidence: {
        dominantChanged: false,
        beforeDominantToken: normalizedBefore.dominantToken,
        afterDominantToken: normalizedAfter.dominantToken,
        beforeDominantIdentitySource: normalizedBefore.dominantIdentitySource,
        afterDominantIdentitySource: normalizedAfter.dominantIdentitySource,
        beforeDominantActiveMedia: normalizedBefore.dominantActiveMedia,
        afterDominantActiveMedia: normalizedAfter.dominantActiveMedia,
        scrollDelta,
        progressRatio,
        candidateDelta,
      },
    };
  }

  const opportunityMeasured = surfaceMode === 'paged'
    ? dominantChanged
    : surfaceMode === 'continuous'
      ? progressed
      : dominantChanged || progressed;

  return {
    version: FEED_CONSUMPTION_VALIDATION_VERSION,
    stepId,
    state: opportunityMeasured ? 'measured' : 'armed_idle',
    reason: opportunityMeasured
      ? dominantChanged ? 'dominant_item_changed' : 'viewport_progressed'
      : 'bounded_input_did_not_advance',
    startedAt: normalizedStartedAt,
    finishedAt: normalizedFinishedAt,
    evidence: {
      dominantChanged,
      beforeDominantToken: normalizedBefore.dominantToken,
      afterDominantToken: normalizedAfter.dominantToken,
      beforeDominantIdentitySource: normalizedBefore.dominantIdentitySource,
      afterDominantIdentitySource: normalizedAfter.dominantIdentitySource,
      beforeDominantActiveMedia: normalizedBefore.dominantActiveMedia,
      afterDominantActiveMedia: normalizedAfter.dominantActiveMedia,
      scrollDelta,
      progressRatio,
      candidateDelta,
    },
  };
}

function normalizeOpportunityActions(actionResults) {
  return (Array.isArray(actionResults) ? actionResults : [])
    .map((result) => result?.opportunity)
    .filter((opportunity) => (
      opportunity
      && typeof opportunity.stepId === 'string'
      && OPPORTUNITY_STATES.has(opportunity.state)
      && finiteTimestamp(opportunity.startedAt) !== null
      && finiteTimestamp(opportunity.finishedAt) !== null
    ))
    .sort((left, right) => left.startedAt - right.startedAt);
}

function normalizeAdvanceEvents(ledger) {
  const source = Array.isArray(ledger?.recentAdvanceEvents)
    ? ledger.recentAdvanceEvents
    : Array.isArray(ledger?.recentEvents) ? ledger.recentEvents : [];
  return source
    .filter((event) => (
      event?.type === 'advance'
      && finiteTimestamp(event.ts) !== null
      && event.direction !== 'backward'
    ))
    .map((event) => {
      const normalized = {
        ts: finiteTimestamp(event.ts),
        direction: typeof event.direction === 'string' ? event.direction : null,
        surfaceMode: typeof event.surfaceMode === 'string' ? event.surfaceMode : null,
        source: typeof event.source === 'string' ? event.source : null,
      };
      if (!PAGED_CONFIRMATION_REASONS.has(event.confirmationReason)) return normalized;
      return {
        ...normalized,
        gestureSequence: Math.max(0, Math.round(Number(event.gestureSequence) || 0)),
        gestureKind: INTENT_KINDS.has(event.gestureKind) ? event.gestureKind : 'unknown',
        confirmationReason: event.confirmationReason,
        confirmationDelayMs: finiteNonNegative(event.confirmationDelayMs),
        previousWinnerToken: OPAQUE_ITEM_TOKEN_PATTERN.test(event.previousWinnerToken)
          ? event.previousWinnerToken
          : null,
        winnerToken: OPAQUE_ITEM_TOKEN_PATTERN.test(event.winnerToken)
          ? event.winnerToken
          : null,
        winnerActiveMedia: event.winnerActiveMedia === true,
        winnerIdentitySource: WINNER_IDENTITY_SOURCES.has(event.winnerIdentitySource)
          ? event.winnerIdentitySource
          : 'unknown',
        activeVideoChanged: event.activeVideoChanged === true,
      };
    })
    .sort((left, right) => left.ts - right.ts);
}

function normalizeDominantScans(ledger) {
  return (Array.isArray(ledger?.recentDominantScans) ? ledger.recentDominantScans : [])
    .filter((event) => event?.type === 'dominant_scan' && finiteTimestamp(event.ts) !== null)
    .map((event) => ({
      ts: finiteTimestamp(event.ts),
      winnerFound: event.winnerFound === true,
      winnerToken: typeof event.winnerToken === 'string' && event.winnerToken
        ? event.winnerToken
        : null,
      winnerActiveMedia: event.winnerActiveMedia === true,
      candidateCount: finiteNonNegative(event.candidateCount),
      rawCandidateCount: finiteNonNegative(event.rawCandidateCount),
      nestedCandidateCount: finiteNonNegative(event.nestedCandidateCount),
    }))
    .sort((left, right) => left.ts - right.ts);
}

export function createFeedConsumptionCostEvidence(ledger = null) {
  const counters = ledger?.counters && typeof ledger.counters === 'object'
    ? ledger.counters
    : {};
  const dominantScanCount = finiteNonNegative(counters.dominantScanCount);
  const dominantScanTotalMs = finiteNonNegative(counters.dominantScanTotalMs);
  const dominantCandidateCount = finiteNonNegative(counters.dominantCandidateCount);
  const dominantRawCandidateCount = finiteNonNegative(counters.dominantRawCandidateCount);
  const dominantNestedCandidateCount = finiteNonNegative(
    counters.dominantNestedCandidateCount,
  );
  const mutationScanCount = finiteNonNegative(counters.mutationScanCount);
  const mutationScanTotalMs = finiteNonNegative(counters.mutationScanTotalMs);
  const pagedScanScheduledCount = finiteNonNegative(counters.pagedScanScheduledCount);
  return {
    measurementState: ledger?.state || 'unavailable',
    dominantScanCount,
    dominantScanTotalMs: roundMetric(dominantScanTotalMs),
    dominantScanAverageMs: roundMetric(ratio(dominantScanTotalMs, dominantScanCount)),
    dominantCandidateCount,
    dominantCandidateAverage: roundMetric(ratio(
      dominantCandidateCount,
      dominantScanCount,
    )),
    dominantRawCandidateCount,
    dominantNestedCandidateCount,
    dominantNestedCandidateRatio: roundMetric(ratio(
      dominantNestedCandidateCount,
      dominantRawCandidateCount,
    )),
    mutationScanCount,
    mutationScanTotalMs: roundMetric(mutationScanTotalMs),
    mutationScanAverageMs: roundMetric(ratio(mutationScanTotalMs, mutationScanCount)),
    mutationCandidateCount: finiteNonNegative(counters.mutationCandidateCount),
    geometryReadCount: finiteNonNegative(counters.geometryReadCount),
    pagedScanScheduledCount,
    pagedScanCoalescedCount: finiteNonNegative(counters.pagedScanCoalescedCount),
    pagedScanExecutedCount: finiteNonNegative(counters.pagedScanExecutedCount),
    pagedTransitionSuppressedCount: finiteNonNegative(
      counters.pagedTransitionSuppressedCount,
    ),
    pagedBaselineReconciledCount: finiteNonNegative(
      counters.pagedBaselineReconciledCount,
    ),
    pagedScanCoalescingRatio: roundMetric(ratio(
      finiteNonNegative(counters.pagedScanCoalescedCount),
      pagedScanScheduledCount,
    )),
  };
}

export function matchFeedConsumptionJourney({
  actionResults = [],
  ledger = null,
  leadMs = 80,
  tailMs = 260,
} = {}) {
  const opportunities = normalizeOpportunityActions(actionResults);
  const oracleProbeCosts = (Array.isArray(actionResults) ? actionResults : [])
    .map((result) => finiteTimestamp(result?.oracleProbe?.totalMs))
    .filter((value) => value !== null);
  const cost = {
    ...createFeedConsumptionCostEvidence(ledger),
    oracleProbeSampleCount: (Array.isArray(actionResults) ? actionResults : []).reduce(
      (total, result) => total + finiteNonNegative(result?.oracleProbe?.sampleCount),
      0,
    ),
    oracleProbeTotalMs: roundMetric(
      oracleProbeCosts.reduce((total, value) => total + value, 0),
    ),
  };
  if (!ledger || ledger.state === 'inactive') {
    return {
      version: FEED_CONSUMPTION_VALIDATION_VERSION,
      state: 'unavailable',
      reason: 'feed_flow_ledger_unavailable',
      counts: null,
      latencyMs: null,
      steps: [],
      cost,
    };
  }
  if (opportunities.length === 0) {
    return {
      version: FEED_CONSUMPTION_VALIDATION_VERSION,
      state: 'unavailable',
      reason: 'feed_opportunity_actions_unavailable',
      counts: null,
      latencyMs: null,
      steps: [],
      cost,
    };
  }
  const advanceRetention = ledger?.advanceRetention
    && typeof ledger.advanceRetention === 'object'
    ? ledger.advanceRetention
    : ledger?.retention;
  if (finiteNonNegative(advanceRetention?.droppedEventCount) > 0) {
    return {
      version: FEED_CONSUMPTION_VALIDATION_VERSION,
      state: 'insufficient',
      reason: 'feed_flow_ledger_retention_incomplete',
      counts: null,
      latencyMs: null,
      steps: [],
      cost,
    };
  }

  const events = normalizeAdvanceEvents(ledger);
  const dominantTimeline = normalizeDominantScans(ledger);
  const claimedEventIndexes = new Set();
  const latencies = [];
  const steps = opportunities.map((opportunity, index) => {
    const expectedGestureSequence = readFeedStepGestureSequence(opportunity.stepId);
    const windowStart = Math.max(0, opportunity.startedAt - Math.max(0, leadMs));
    const nextStartedAt = finiteTimestamp(opportunities[index + 1]?.startedAt);
    const windowEnd = nextStartedAt === null
      ? opportunity.finishedAt + Math.max(0, tailMs)
      : Math.max(windowStart, nextStartedAt - 1);
    const confirmationWindowEnd = opportunity.finishedAt + Math.max(0, tailMs);
    const matchingEventIndexes = events.flatMap((event, eventIndex) => (
      !claimedEventIndexes.has(eventIndex)
      && (
        readEventGestureSequence(event) !== null
          ? expectedGestureSequence !== null
            && readEventGestureSequence(event) === expectedGestureSequence
          : event.ts >= windowStart && event.ts <= windowEnd
      )
        ? [eventIndex]
        : []
    ));
    matchingEventIndexes.forEach((eventIndex) => claimedEventIndexes.add(eventIndex));
    const eventCount = matchingEventIndexes.length;
    const latencyMs = eventCount > 0
      ? Math.max(0, events[matchingEventIndexes[0]].ts - opportunity.startedAt)
      : null;
    if (latencyMs !== null) latencies.push(latencyMs);
    const matchedGestureSequences = matchingEventIndexes.map((eventIndex) => (
      readEventGestureSequence(events[eventIndex])
    ));
    const sequencedEventCount = matchedGestureSequences.filter(
      (sequence) => sequence !== null,
    ).length;
    const earlyConfirmationCount = matchingEventIndexes.filter(
      (eventIndex) => events[eventIndex].ts < windowStart,
    ).length;
    const lateConfirmationCount = matchingEventIndexes.filter(
      (eventIndex) => events[eventIndex].ts > confirmationWindowEnd,
    ).length;
    return {
      stepId: opportunity.stepId,
      opportunityState: opportunity.state,
      opportunityStartedAt: opportunity.startedAt,
      opportunityFinishedAt: opportunity.finishedAt,
      windowStart,
      windowEnd,
      confirmationWindowEnd,
      expectedGestureSequence,
      detectorEventCount: eventCount,
      detectorEventTimestamps: matchingEventIndexes.map((eventIndex) => (
        events[eventIndex].ts
      )),
      detectorEventGestureSequences: matchedGestureSequences,
      correlationMode: eventCount === 0
        ? null
        : sequencedEventCount === eventCount
          ? 'gesture_sequence'
          : sequencedEventCount === 0 ? 'temporal_window' : 'mixed',
      classification: opportunity.state === 'measured'
        ? eventCount === 0 ? 'false_negative' : eventCount === 1 ? 'true_positive' : 'duplicate'
        : opportunity.state === 'armed_idle'
          ? eventCount === 0 ? 'true_idle' : 'false_positive'
          : 'insufficient',
      latencyMs,
      confirmationTiming: {
        state: eventCount === 0
          ? 'unobserved'
          : earlyConfirmationCount + lateConfirmationCount > 0
            ? 'out_of_bounds'
            : 'within_bound',
        earlyCount: earlyConfirmationCount,
        lateCount: lateConfirmationCount,
        violationCount: earlyConfirmationCount + lateConfirmationCount,
      },
    };
  });

  const measuredSteps = steps.filter((step) => step.opportunityState === 'measured');
  const armedIdleSteps = steps.filter((step) => step.opportunityState === 'armed_idle');
  const truePositiveCount = measuredSteps.filter(
    (step) => step.detectorEventCount >= 1,
  ).length;
  const falseNegativeCount = measuredSteps.filter(
    (step) => step.detectorEventCount === 0,
  ).length;
  const duplicateCount = measuredSteps.reduce(
    (total, step) => total + Math.max(0, step.detectorEventCount - 1),
    0,
  );
  const falsePositiveFromIdle = armedIdleSteps.reduce(
    (total, step) => total + step.detectorEventCount,
    0,
  );
  const journeyStart = Math.max(0, opportunities[0].startedAt - Math.max(0, leadMs));
  const journeyEnd = opportunities.at(-1).finishedAt + Math.max(0, tailMs);
  const unmatchedJourneyEventIndexes = events.flatMap((event, eventIndex) => (
    !claimedEventIndexes.has(eventIndex)
    && event.ts >= journeyStart
    && event.ts <= journeyEnd
      ? [eventIndex]
      : []
  ));
  const unmatchedJourneyEvents = unmatchedJourneyEventIndexes.length;
  const falsePositiveCount = falsePositiveFromIdle + unmatchedJourneyEvents;
  const insufficientStepCount = steps.filter(
    (step) => step.opportunityState === 'insufficient',
  ).length;
  const detectorEventIndexes = new Set([
    ...claimedEventIndexes,
    ...unmatchedJourneyEventIndexes,
  ]);
  const confirmationTiming = steps.reduce((summary, step) => ({
    earlyCount: summary.earlyCount + step.confirmationTiming.earlyCount,
    lateCount: summary.lateCount + step.confirmationTiming.lateCount,
    violationCount: summary.violationCount + step.confirmationTiming.violationCount,
  }), {
    earlyCount: 0,
    lateCount: 0,
    violationCount: 0,
  });
  const counts = {
    opportunityCount: measuredSteps.length,
    armedIdleCount: armedIdleSteps.length,
    insufficientStepCount,
    detectorEventCount: detectorEventIndexes.size,
    truePositiveCount,
    falseNegativeCount,
    falsePositiveCount,
    duplicateCount,
  };
  const hasCorrectnessFailure = (
    falseNegativeCount > 0
    || falsePositiveCount > 0
    || duplicateCount > 0
  );
  const hasConfirmationTimingFailure = confirmationTiming.violationCount > 0;
  const state = measuredSteps.length === 0
    ? hasCorrectnessFailure || hasConfirmationTimingFailure
      ? 'broken'
      : insufficientStepCount > 0 ? 'insufficient' : 'armed_idle'
    : hasCorrectnessFailure || hasConfirmationTimingFailure
      ? 'broken'
      : insufficientStepCount > 0 ? 'insufficient' : 'measured';

  return {
    version: FEED_CONSUMPTION_VALIDATION_VERSION,
    state,
    reason: state === 'measured'
      ? 'opportunities_matched_exactly_once'
      : state === 'armed_idle'
        ? 'bounded_inputs_produced_no_independent_opportunity'
        : state === 'insufficient'
          ? 'one_or_more_opportunity_steps_insufficient'
          : hasCorrectnessFailure
            ? 'opportunity_detector_mismatch'
            : 'detector_confirmation_timing_out_of_bounds',
    counts: {
      ...counts,
      precision: roundMetric(ratio(
        truePositiveCount,
        truePositiveCount + falsePositiveCount + duplicateCount,
      )),
      recall: roundMetric(ratio(
        truePositiveCount,
        truePositiveCount + falseNegativeCount,
      )),
    },
    latencyMs: {
      average: roundMetric(average(latencies)),
      p95: percentile(latencies, 0.95),
      maximum: latencies.length > 0 ? Math.max(...latencies) : null,
    },
    confirmationTiming: {
      state: detectorEventIndexes.size === 0
        ? 'unobserved'
        : hasConfirmationTimingFailure ? 'out_of_bounds' : 'within_bound',
      ...confirmationTiming,
    },
    detectorTimeline: events,
    dominantTimeline,
    steps,
    cost,
  };
}
