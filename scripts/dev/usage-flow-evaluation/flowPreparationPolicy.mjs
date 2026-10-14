import { interpretFlowTimeline, FLOW_TEMPORAL_CONFIG } from './flowTemporalInterpretation.mjs';
import { readFlowObservationTrace } from './flowObservationTraceReader.mjs';

// A visible policy choice in screenfuls, not learned behavior or a spawn threshold.
export const FLOW_PREPARATION_CONFIG = Object.freeze({ forwardMassScale: 12, renewalMassScale: 1 });

// This consumer has no state advanced by reads. All memory and timestamps come
// from the descriptive owner; judgments never return to its observation input.
export function evaluateFlowPreparation(input, config = FLOW_PREPARATION_CONFIG, temporalConfig = FLOW_TEMPORAL_CONFIG) {
  if (!config || Reflect.ownKeys(config).length !== 2) throw new Error('FLOW_PREPARATION_INVALID:config');
  const scales = {};
  for (const key of ['forwardMassScale', 'renewalMassScale']) {
    const descriptor = Object.getOwnPropertyDescriptor(config, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !Number.isFinite(descriptor.value) || descriptor.value <= 0) {
      throw new Error(`FLOW_PREPARATION_INVALID:${key}`);
    }
    scales[key] = descriptor.value;
  }
  const evidence = interpretFlowTimeline(input, temporalConfig);
  // Reuse the validated reader, not a second cursor implementation. Selecting
  // displacement after the policy's renewal boundary belongs to this consumer,
  // never to the neutral temporal descriptor or production observation journal.
  const retained = readFlowObservationTrace(input.feedTrace);
  const rows = evidence.rows.map((row) => {
    const [fast, slow] = row.windows;
    const rememberedForwardScreenfuls = slow.observedForwardRate * slow.timeConstantMs / 1000;
    const preparationInterest = row.retainedEventsComplete ? -Math.expm1(-rememberedForwardScreenfuls / scales.forwardMassScale) : null;
    const writingProtection = !row.editorAvailable ? null : row.editorFocused ? 1 : 0;
    const renewalAnchorAt = !row.editorAvailable ? null : Math.max(row.movementContinuitySinceAt,
      row.editorStateSinceAt, row.lastInputAt === null ? row.editorStateSinceAt : row.lastInputAt);
    // Same timestamp is deliberately insufficient: cross-channel order is not
    // known. Gaps, focus exit and later input require new measured progression.
    const renewedForwardEvidence = renewalAnchorAt === null ? null : !row.editorFocused
      && row.latestForwardAt !== null && row.latestForwardAt > renewalAnchorAt;
    const segment = retained.segments.findLast((value) => value.startAt <= row.at);
    const renewedForwardScreenfuls = renewalAnchorAt === null ? null : segment.records
      .filter((record) => record.kind === 'scroll_displacement' && record.direction === 'forward'
        && record.at > renewalAnchorAt && record.availableAt <= row.at)
      .reduce((mass, record) => mass + record.screenfuls * Math.exp(-(row.at - record.at) / fast.timeConstantMs), 0);
    const renewalWeight = renewedForwardScreenfuls === null ? null : -Math.expm1(-renewedForwardScreenfuls / scales.renewalMassScale);
    const forwardRecency = row.latestForwardAt === null ? 0 : Math.exp(-(row.at - row.latestForwardAt) / fast.timeConstantMs);
    const directionalShare = fast.observedForwardRate + fast.observedBackwardRate === 0 ? 0
      : fast.observedForwardRate / (fast.observedForwardRate + fast.observedBackwardRate);
    const withheld = [];
    if (!row.retainedEventsComplete) withheld.push('retained_history_incomplete');
    if (!row.currentGeometrySupported) withheld.push('geometry_unavailable');
    if (!row.editorAvailable) withheld.push('editor_unavailable');
    if (fast.geometrySupport === null || fast.editorSupport === null || writingProtection === null) withheld.push('window_support_unavailable');
    // Release protection through newly measured progression, not elapsed time.
    // In the absence of newly available displacement, both masses decay and the
    // directional ratio is constant. Idle time cannot amplify preparation.
    const opportunityWeight = withheld.length ? null : !renewedForwardEvidence ? 0
      : (1 - writingProtection) * renewalWeight * directionalShare;
    return { at: row.at, ownerId: row.ownerId, epoch: row.epoch,
      rememberedForwardScreenfuls, preparationInterest, writingProtection, renewalAnchorAt,
      renewedForwardScreenfuls, renewalWeight,
      renewedForwardEvidence, forwardRecency, directionalShare, opportunityWeight,
      preparationScore: opportunityWeight === null ? null : preparationInterest * opportunityWeight,
      withheld };
  });
  return { version: 1, authority: 'evaluation_only_preparation_policy', config: scales,
    evidence, rows, limitations: [
      'preparation_scores_are_policy_weights_not_probabilities_or_admission',
      'unknown_scroll_source_and_purpose_remain_unidentifiable',
      'focus_protection_does_not_establish_one_draft_or_work_intent',
      'recent_memory_is_bounded_not_browser_wide_habit_history',
      'no_switch_count_bonus_or_typing_volume_penalty',
      'cursor_loss_withholds_whole_segment_policy_until_a_new_baseline',
      'opportunity_requires_endpoint_safety_permissions_and_new_demand_before_runtime_use',
    ] };
}
