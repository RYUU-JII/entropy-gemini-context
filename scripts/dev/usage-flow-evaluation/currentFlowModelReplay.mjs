import FeedBurstMachine from '../../../src/domains/nudge/feed-flow/session/FeedBurstMachine.js';
import FeedFlowJudge from '../../../src/domains/nudge/feed-flow/judge/FeedFlowJudge.js';
import ContinuousAdvanceAdapter from '../../../src/domains/nudge/feed-flow/confirm/ContinuousAdvanceAdapter.js';
import { DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG } from '../enso-model-research/legacy-feed/ensoFeedHorizonRuntimeConfig.js';
import { validateFlowModelTrace } from './flowModelTraceContract.mjs';

export const CURRENT_FLOW_REPLAY_CONTRACT_VERSION = 'current-flow-model-replay-v1';
export { CURRENT_FLOW_MODEL_SOURCE_FILES } from './flowEvaluationSources.mjs';

function projectDecision(decision, machine, { at, eventIndex, eventKind, observationKind }) {
  const metrics = decision.metrics;
  const row = {
    at,
    eventIndex,
    eventKind,
    observationKind,
    // The machine retains episode accumulation after a burst closes, whereas
    // the judge receives the burst's projected loop signals. Preserve both;
    // substituting the getter into the judge would change production behavior.
    episodeDose: machine.episodeDose,
    episodeActiveMs: machine.episodeActiveMs,
    episodeFreshItemsSeen: machine.episodeFreshItems,
    decisionDose: metrics.dose,
    decisionEpisodeActiveMs: metrics.episodeActiveMs,
    decisionEpisodeFreshItemsSeen: metrics.episodeFreshItemsSeen,
    confidence: decision.confidence,
    detectorConfidence: decision.detectorConfidence,
    loopScore: decision.loopScore,
    state: decision.state,
    armed: decision.armed,
    opportunityReady: decision.opportunityReady,
    advanceCount: metrics.advanceCount,
    screenfulsConsumed: metrics.screenfulsConsumed,
    itemTransitions: metrics.itemTransitions,
    freshItemsSeen: metrics.freshItemsSeen,
    medianDwellMs: metrics.medianDwellMs,
    maxPauseMs: metrics.maxPauseMs,
    seamWaitedMs: decision.seam.waitedMs,
    seamRequiredGapMs: decision.seam.requiredGapMs,
    seamObservedGapMs: decision.seam.observedGapMs,
    inhibitors: [...decision.inhibitors],
    reasons: [...decision.reasons],
  };
  if (Object.values(row).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('CURRENT_FLOW_REPLAY_NON_FINITE_MODEL_OUTPUT');
  }
  return row;
}

/**
 * Synthetic, post-confirmation replay of the shipped burst/judge owners at the
 * default configuration, without intervention. This does not reproduce capture,
 * DOM confirmation, learned profiles, runtime admission, or a visible effect.
 *
 * A forward `advance` means an already confirmed advance at that boundary.
 * It requires at least one item transition for paged surfaces, or positive
 * screenful movement for continuous surfaces; a cross-unit value cannot replace
 * the mode's required progression measurement.
 * `quality` supplies its detector confidence; it is not an attention probability.
 * Trace source labels, availability, input and backward movement cannot be
 * translated into upstream intent/lifecycle signals by this adapter. They are
 * explicitly reported as unrepresented, not converted into reassuring zeroes.
 * Their timestamps still reconcile model expiry. Such reconciliation mutates
 * burst and judge state, including seam release after an expired burst projects
 * an empty episode identity. Adding an unsupported event can therefore change
 * later decisions solely by adding a clock boundary. Channel-effect comparisons
 * require matching reconciliation times; this is not a live polling simulator.
 *
 * Confirmed fresh-item novelty is not provided by this trace contract. The
 * replay supplies a declared fixed-zero test input, not observed absence of
 * novelty. In particular, continuous arming cannot be validated by this replay.
 *
 * Supply is probed independently at the actual continuous adapter with no recent
 * gesture and no pending movement. It is never inserted into the replay's advance
 * stream: DOM mutation identity and the coordinator's admission context are absent.
 */
export function replayCurrentFlowModel(trace) {
  validateFlowModelTrace(trace);
  const config = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG;
  const machine = new FeedBurstMachine({
    idleResetMs: config.sensing.idleResetMs,
  });
  const judge = new FeedFlowJudge({ runtimeConfig: config });
  const curve = [];
  const supplyProbes = [];
  const represented = new Set();
  const unrepresented = new Set();
  let confirmedForwardAdvanceEvents = 0;

  function append(at, eventIndex, eventKind, advanceEvent = null) {
    // This public owner method reconciles event-time expiry. Reuse its existing
    // canonical supply state; do not manufacture supply steps or a poll cadence.
    const snapshot = advanceEvent
      ? machine.recordAdvance(advanceEvent)
      : machine.updateSupplySignals(machine.getSnapshot().loopSignals.supply, { now: at });
    const observationKind = advanceEvent ? 'advance' : 'reconcile';
    const decision = judge.evaluate(snapshot, { now: at, observationKind });
    const row = projectDecision(decision, machine, { at, eventIndex, eventKind, observationKind });
    curve.push(row);
    return row;
  }

  append(trace.startMs, -1, 'start');
  trace.events.forEach((event, eventIndex) => {
    let advanceEvent = null;
    if (event.kind === 'advance') {
      unrepresented.add('source_provenance');
      if (event.direction === 'forward') {
        confirmedForwardAdvanceEvents += 1;
        represented.add('confirmed_forward_advancement');
        represented.add('detector_confidence');
        represented.add('advance_event_time');
        represented.add('production_burst_episode_accumulation');
        represented.add('production_judge_and_seam');
        advanceEvent = {
          ts: event.at,
          surfaceMode: trace.surfaceMode,
          direction: event.direction,
          confidence: event.quality,
          source: trace.surfaceMode === 'paged' ? 'dominant_item' : 'screenful',
          screenfulDelta: event.screenfuls,
          itemTransitionCount: event.itemTransitions,
          freshItemsSeen: 0,
        };
      } else {
        unrepresented.add('backward_intent');
      }
    } else if (event.kind === 'supply') {
      unrepresented.add('supply_to_full_runtime');
      if (trace.surfaceMode === 'continuous') {
        represented.add('isolated_continuous_supply_adapter');
        // Each probe is isolated: a fresh adapter makes the absence of a
        // measured pending displacement explicit instead of borrowing it.
        const candidate = new ContinuousAdvanceAdapter().recordProgress({
          ts: event.at,
          deltaY: 0,
          containerHeight: 1,
          freshItemsSeen: event.count,
          recentGesture: false,
        });
        supplyProbes.push({
          at: event.at,
          eventIndex,
          suppliedItems: event.count,
          recentGesture: false,
          emittedAdvanceCandidate: candidate !== null,
          screenfulDelta: candidate === null ? null : candidate.screenfulDelta,
          itemTransitionCount: candidate === null ? null : candidate.itemTransitionCount,
          freshItemsSeen: candidate === null ? null : candidate.freshItemsSeen,
          confidence: candidate === null ? null : candidate.confidence,
        });
      }
    } else if (event.kind === 'availability') {
      unrepresented.add('visibility_and_measurement_availability');
    } else {
      unrepresented.add('input_activity');
    }
    append(event.at, eventIndex, event.kind, advanceEvent);
  });
  const terminal = append(trace.endMs, trace.events.length, 'end');
  return {
    contractVersion: CURRENT_FLOW_REPLAY_CONTRACT_VERSION,
    runtimeConfigVersion: config.contractVersion,
    surfaceMode: trace.surfaceMode,
    evidence: {
      status: confirmedForwardAdvanceEvents > 0
        ? 'partial_confirmed_advance_replay'
        : 'no_confirmed_forward_advances',
      confirmedForwardAdvanceEvents,
      totalTraceEvents: trace.events.length,
    },
    scope: {
      entry: 'confirmed_advance_burst_and_judge',
      configuration: 'shipped_default_without_semantic_surface_override',
      intervention: 'disabled_no_decision_feedback',
      novelty: 'fixed_zero_test_input_unmeasured_no_transition_or_supply_conversion',
      continuousArmingValidation: trace.surfaceMode === 'continuous'
        ? 'unsupported_without_confirmed_fresh_item_novelty'
        : 'not_applicable',
      interval: 'half_open',
      nonAdvanceEvents: 'clock_reconciliation_only_except_isolated_supply_probe',
      reconciliationMutatesState: true,
      channelComparisonConstraint: 'matching_reconciliation_timestamps_required',
      silence: 'event_boundaries_and_trace_end_reconcile_expiry_without_consuming_seam_cadence',
      polling: 'no_implicit_periodic_sampling',
      supplyProbe: 'isolated_continuous_adapter_no_recent_gesture_no_pending_movement_no_coordinator_admission',
    },
    representedChannels: [...represented].sort(),
    unrepresentedChannels: [...unrepresented].sort(),
    curve,
    terminal,
    supplyProbes,
  };
}
