import { addFlowMass, recoverFlowPressure, flowRecoveryTimeMs,
  FLOW_CANDIDATE_CONFIG, validateFlowCandidateConfig } from './continuousFlowCandidate.mjs';

const COVERAGE_KEYS = ['sampledCoverageMs', 'unavailableVisibleMs', 'unsupportedVisibleMs', 'hiddenMs'];
const COUNTERS = [...COVERAGE_KEYS, 'unknownForwardScreenfuls', 'unknownBackwardScreenfuls',
  'acceptedScrollEvents', 'unmeasuredScrollEvents', 'nestedOrOutsideScrollEvents',
  'programmaticAffectedScrollEvents', 'programmaticContinuityGaps',
  'unobservedDisplacements', 'visibleSetChanges', 'identityDiscontinuities'];
const STATUSES = ['stopped', 'sampled', 'stale', 'hidden', 'unsupported', 'unavailable'];
const TIMINGS = ['accounting_right_edge', 'previous_capture_edge'];
const EVENT_COUNTERS = COUNTERS.filter((key) => !COVERAGE_KEYS.includes(key)
  && !['unknownForwardScreenfuls', 'unknownBackwardScreenfuls'].includes(key));
const fail = (detail) => { throw new Error(`FLOW_MEASURED_PRESSURE_INVALID:${detail}`); };
function number(value, key) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
    || value > Number.MAX_SAFE_INTEGER) fail(key);
}
function exactKeys(value, keys, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(detail);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key)
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail(detail);
}
function validateFrame(frame) {
  exactKeys(frame, ['ownerId', 'at', 'observation'], 'frame_keys');
  if (typeof frame.ownerId !== 'string' || !frame.ownerId.trim()) fail('owner_id');
  number(frame.at, 'capture_time');
  const observation = frame.observation;
  if (!observation || observation.version !== 1 || typeof observation.active !== 'boolean'
    || !STATUSES.includes(observation.status)
    || observation.coverageBasis !== 'bounded_geometry_sample_hold'
    || observation.capabilities?.consumptionTransitions !== 'unsupported'
    || observation.capabilities?.userAttribution !== 'unavailable') fail('observation_contract');
  for (const key of ['epoch', 'sequence', 'sampleCount']) {
    if (!Number.isSafeInteger(observation[key]) || observation[key] < 0) fail(key);
  }
  for (const key of COUNTERS) number(observation[key], key);
  for (const key of EVENT_COUNTERS) if (!Number.isSafeInteger(observation[key])) fail(`event_count:${key}`);
  if ((observation.status === 'stopped') !== !observation.active) fail('activity_status');
  if (observation.at === null) {
    if (observation.active || observation.sequence !== 0 || COUNTERS.some((key) => observation[key] !== 0)) {
      fail('uninitialized_observation');
    }
  } else {
    number(observation.at, 'accounting_time');
    if (observation.at > frame.at) fail('accounting_after_capture');
  }
  if (typeof observation.maxSampleHoldMs !== 'number' || observation.maxSampleHoldMs <= 0
    || !Number.isFinite(observation.maxSampleHoldMs)) fail('sample_hold');
}

/** Evaluation-only use of actual cumulative sensor displacement, never a
 * confirmed-advance DTO, classifier confidence or a live admission signal.
 * A capture interval can hide many arrival times. The two placement conventions
 * expose that sensitivity; neither is claimed to bound every possible path.
 */
export function replayMeasuredFlowPressure(trace, {
  config = FLOW_CANDIDATE_CONFIG, timing = 'accounting_right_edge',
} = {}) {
  exactKeys(trace, ['version', 'clockBasis', 'startMs', 'endMs', 'frames'], 'trace_keys');
  number(trace.startMs, 'start_time'); number(trace.endMs, 'end_time');
  if (trace.version !== 1 || trace.clockBasis !== 'shared_monotonic_milliseconds'
    || trace.endMs < trace.startMs || trace.endMs - trace.startMs > 86_400_000
    || !Array.isArray(trace.frames) || trace.frames.length === 0 || trace.frames.length > 100_000) fail('trace');
  validateFlowCandidateConfig(config);
  if (!TIMINGS.includes(timing)) fail('timing');
  const segments = [];
  const seenOwners = new Set();
  const diagnostics = { ambiguousArrivalWindows: 0, maxArrivalWindowMs: 0,
    exactCallbackDeltas: 0, duplicateReadings: 0, boundaries: [] };
  let previous = null;
  let segment = null;
  let memory = 0;
  let massAt = trace.startMs;

  function projection(at) {
    const pressure = recoverFlowPressure(memory, at - massAt, config);
    return { at, pressure, remainingRecoveryMs: flowRecoveryTimeMs(pressure, config),
      observedForwardUnits: segment.observedForwardUnits, observedBackwardUnits: segment.observedBackwardUnits };
  }
  function finish(at) {
    segment.endAt = at;
    segment.terminal = projection(at);
    segment.accountingEndAt = previous.observation.at;
    segment.unaccountedTailMs = previous.observation.at === null ? at - segment.startAt
      : Math.max(0, at - Math.max(segment.startAt, previous.observation.at));
  }

  for (const [index, frame] of trace.frames.entries()) {
    validateFrame(frame);
    if (frame.at < (previous?.at ?? trace.startMs) || frame.at > trace.endMs) fail('capture_order');
    const current = frame.observation;
    const sameOwner = previous !== null && previous.ownerId === frame.ownerId;
    if (sameOwner && current.epoch < previous.observation.epoch) fail('epoch_reversed');
    const boundary = !sameOwner || current.epoch !== previous.observation.epoch;
    if (boundary) {
      if (segment) finish(frame.at);
      if (!sameOwner) {
        if (seenOwners.has(frame.ownerId)) fail('owner_reentry_requires_separate_trace');
        seenOwners.add(frame.ownerId);
      }
      if (previous) diagnostics.boundaries.push({ at: frame.at,
        reason: sameOwner ? 'epoch_changed' : 'owner_replaced',
        unallocatedForwardDelta: sameOwner && current.unknownForwardScreenfuls >= previous.observation.unknownForwardScreenfuls
          ? current.unknownForwardScreenfuls - previous.observation.unknownForwardScreenfuls : null });
      segment = { ownerId: frame.ownerId, epoch: current.epoch, startAt: frame.at, endAt: null,
        accountingStartAt: current.at, accountingEndAt: null,
        baselineAccountingLagMs: current.at === null ? null : frame.at - current.at,
        baselineCounters: Object.fromEntries(COUNTERS.map((key) => [key, current[key]])),
        observedForwardUnits: 0, observedBackwardUnits: 0,
        coverage: Object.fromEntries(COVERAGE_KEYS.map((key) => [key, 0])), curve: [], terminal: null };
      segments.push(segment);
      memory = 0; massAt = frame.at;
      segment.curve.push({ ...projection(frame.at), frameIndex: index, observationAt: current.at,
        kind: 'baseline', addedForwardUnits: 0, arrival: null, sensorStatus: current.status });
    } else {
      const prior = previous.observation;
      if (!prior.active && current.active) fail('restart_without_new_epoch');
      if (current.at === null ? prior.at !== null : prior.at !== null && current.at < prior.at) fail('accounting_reversed');
      if (current.sequence < prior.sequence || current.sampleCount < prior.sampleCount) fail('sequence_reversed');
      if (current.sequence === prior.sequence && current.at !== prior.at) fail('accounting_without_owner_event');
      if (current.sequence > prior.sequence && current.at < previous.at) fail('event_before_previous_capture');
      const delta = Object.fromEntries(COUNTERS.map((key) => {
        if (current[key] < prior[key]) fail(`counter_reversed:${key}`);
        return [key, current[key] - prior[key]];
      }));
      if (current.sequence === prior.sequence && COUNTERS.some((key) => delta[key] !== 0)) fail('counter_without_owner_event');
      if (!prior.active && (current.sequence !== prior.sequence || current.at !== prior.at
        || COUNTERS.some((key) => delta[key] !== 0))) fail('inactive_owner_changed');
      const accountingElapsed = prior.active ? current.at - prior.at : 0;
      const accountedCoverage = COVERAGE_KEYS.reduce((total, key) => total + delta[key], 0);
      if (Math.abs(accountedCoverage - accountingElapsed) > Math.max(1e-6, accountingElapsed * 1e-9)) {
        fail('coverage_time_mismatch');
      }
      const mass = delta.unknownForwardScreenfuls;
      const backward = delta.unknownBackwardScreenfuls;
      const callbacks = delta.acceptedScrollEvents + delta.unmeasuredScrollEvents + delta.nestedOrOutsideScrollEvents;
      if (callbacks > current.sequence - prior.sequence) fail('callbacks_exceed_owner_events');
      if ((mass > 0 || backward > 0) && delta.acceptedScrollEvents < 1) fail('distance_without_scroll');
      if (delta.acceptedScrollEvents === 1 && mass > 0 && backward > 0) fail('one_scroll_two_directions');
      if (current.sequence === prior.sequence && current.sampleCount === prior.sampleCount) diagnostics.duplicateReadings += 1;
      for (const key of COVERAGE_KEYS) segment.coverage[key] += delta[key];
      segment.observedBackwardUnits += backward;
      let arrival = null;
      if (mass > 0) {
        const exact = current.sequence === prior.sequence + 1 && delta.acceptedScrollEvents === 1
          && current.sampleCount === prior.sampleCount && backward === 0;
        if (exact && !['sampled', 'stale'].includes(current.status)) fail('accepted_callback_without_sample');
        const earliestAt = exact ? current.at : previous.at;
        arrival = { earliestAt, latestAt: current.at, basis: exact ? 'single_owner_scroll_callback' : 'cumulative_capture_window' };
        if (exact) diagnostics.exactCallbackDeltas += 1;
        else {
          diagnostics.ambiguousArrivalWindows += 1;
          diagnostics.maxArrivalWindowMs = Math.max(diagnostics.maxArrivalWindowMs, current.at - earliestAt);
        }
        const at = timing === 'previous_capture_edge' ? earliestAt : current.at;
        memory = addFlowMass(recoverFlowPressure(memory, at - massAt, config), mass, config.massScale);
        massAt = at;
        segment.observedForwardUnits += mass;
      }
      segment.curve.push({ ...projection(frame.at), frameIndex: index, observationAt: current.at,
        kind: mass > 0 ? 'displacement' : 'read', addedForwardUnits: mass, arrival, sensorStatus: current.status });
    }
    previous = frame;
  }
  finish(trace.endMs);
  return {
    version: 1, config: { ...config }, timing, unit: 'scroller_height_displacement', source: 'unknown',
    itemTransitions: null, measurementConfidence: null,
    scope: { runtime: 'evaluation_only_no_runtime_consumer',
      pressureMeaning: 'bounded_memory_of_measured_forward_displacement_not_consumption',
      recoveryMeaning: 'wall_memory_aging_not_observed_rest',
      timingMeaning: 'placement_sensitivity_not_guaranteed_bounds',
      boundaryMeaning: 'independent_owner_epoch_segments_no_cross_segment_pressure_sum',
      coverageMeaning: 'owner_accounted_bounded_sample_hold_not_attention',
      itemMeaning: 'unsupported_visible_set_changes_are_not_item_transitions',
      inputMeaning: 'no_feed_mass_no_claim_of_writing_intent_or_draft_identity' },
    segments, diagnostics,
  };
}
