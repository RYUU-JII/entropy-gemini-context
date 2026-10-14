import { readFlowObservationTrace } from './flowObservationTraceReader.mjs';
import { addFlowMass, recoverFlowPressure, flowRecoveryTimeMs,
  FLOW_CANDIDATE_CONFIG, validateFlowCandidateConfig } from './continuousFlowCandidate.mjs';

// Pressure is one consumer of the shared retained-observation cursor contract.
// Geometry, gap records and interpretations still add no pressure mass.
export function replayJournalFlowPressure(trace, { config = FLOW_CANDIDATE_CONFIG } = {}) {
  const retained = readFlowObservationTrace(trace);
  validateFlowCandidateConfig(config);
  const diagnostics = retained.diagnostics;
  const segments = retained.segments.map((input) => {
    const { records, captures, ...baseline } = input;
    const segment = { ...baseline, complete: true, status: null, missingEvents: 0,
      observationGaps: 0, itemSamples: 0, knownForwardUnits: 0, knownBackwardUnits: 0,
      retainedSuffixStartAt: null, curve: [], terminal: null };
    let memory = 0;
    let memoryAt = input.startAt;
    function projection(at) {
      const pressure = recoverFlowPressure(memory, at - memoryAt, config);
      const recovery = flowRecoveryTimeMs(pressure, config);
      return { at, pressure: segment.complete ? pressure : null,
        remainingRecoveryMs: segment.complete ? recovery : null,
        retainedSuffixPressure: segment.complete ? null : pressure,
        retainedSuffixRemainingRecoveryMs: segment.complete ? null : recovery,
        knownForwardUnits: segment.knownForwardUnits, knownBackwardUnits: segment.knownBackwardUnits };
    }
    segment.curve.push({ ...projection(input.startAt), sequence: input.baselineSequence, kind: 'baseline' });
    for (const event of records) {
      if (event.kind === 'cursor_gap') {
        segment.complete = false;
        segment.missingEvents += event.missingEvents;
        segment.retainedSuffixStartAt = event.at;
        memory = 0; memoryAt = event.at;
        segment.curve.push({ ...projection(event.at), sequence: null, kind: 'cursor_gap' });
        continue;
      }
      const forward = event.kind === 'scroll_displacement' && event.direction === 'forward' ? event.screenfuls : 0;
      const backward = event.kind === 'scroll_displacement' && event.direction === 'backward' ? event.screenfuls : 0;
      if (forward > 0) {
        memory = addFlowMass(recoverFlowPressure(memory, event.at - memoryAt, config), forward, config.massScale);
        memoryAt = event.at;
        segment.knownForwardUnits += forward;
      }
      segment.knownBackwardUnits += backward;
      if (!Number.isFinite(segment.knownForwardUnits) || !Number.isFinite(segment.knownBackwardUnits)) {
        throw new Error('FLOW_JOURNAL_PRESSURE_INVALID:unit_overflow');
      }
      if (event.kind === 'observation_gap') segment.observationGaps += 1;
      if (event.kind === 'item_sample') segment.itemSamples += 1;
      segment.curve.push({ ...projection(event.at), sequence: event.sequence, kind: event.kind,
        addedForwardUnits: forward, addedBackwardUnits: backward });
    }
    segment.terminal = projection(input.endAt);
    segment.status = segment.complete ? 'complete_retained_events' : 'partial_missing_events';
    return segment;
  });
  return { version: 1, config: { ...config }, unit: 'scroller_height_displacement', source: 'unknown',
    itemTransitions: null, measurementConfidence: null,
    scope: { runtime: 'evaluation_only_no_runtime_consumer',
      entry: 'retained_accepted_scroll_journal_no_aggregate_counter_fallback',
      timingMeaning: 'producer_callback_time_and_sequence_not_capture_placement',
      pressureMeaning: 'bounded_memory_of_measured_forward_displacement_not_consumption',
      recoveryMeaning: 'wall_memory_aging_not_observed_rest',
      baselineMeaning: 'first_capture_watermark_excludes_all_preexisting_records',
      completenessMeaning: 'journal_events_after_baseline_not_measurement_or_attention_coverage',
      boundaryMeaning: 'independent_owner_epoch_segments_no_cross_segment_pressure_sum',
      lossMeaning: 'null_pressure_until_new_epoch_retained_suffix_is_a_separate_zero_origin_diagnostic',
      itemMeaning: 'item_samples_add_no_mass_and_do_not_establish_consumption' },
    segments, diagnostics };
}
