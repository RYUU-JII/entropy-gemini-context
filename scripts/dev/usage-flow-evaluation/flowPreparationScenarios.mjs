// Visible, import-free physical recipes and review hypotheses. No product/model
// thresholds or prior classifier answers author these stories.
const phase = (untilMs, velocity, options = {}) => ({ untilMs, velocity, available: true,
  editorAvailable: true, focused: false, inputEveryMs: 0, inputBatch: 1,
  reverseEveryMs: 0, identityEveryMs: 0, ...options });
const recipe = (phases, options = {}) => ({ endMs: 240000, sampleEveryMs: 500,
  captureEveryMs: 1000, columns: 1, phases, ...options });
const writing = (inputEveryMs = 1000, inputBatch = 1) => recipe([
  phase(60000, 0.5), phase(180000, 0, { focused: true, inputEveryMs, inputBatch }),
  phase(200000, 0), phase(240000, 0.5),
]);
export function createFlowPreparationCorpus() {
  return [
    { id: 'continuous_exploration', input: recipe([phase(240000, 0.5)]), review: 'persistent_measured_progression' },
    { id: 'slow_exploration', input: recipe([phase(240000, 0.05)]), review: 'slow_progression_is_not_absent' },
    { id: 'purposeful_search_twin', input: recipe([phase(240000, 0.5)]), review: 'same_observations_cannot_reveal_purpose' },
    { id: 'long_writing_return', input: writing(), review: 'protect_writing_and_wait_for_renewed_progression' },
    { id: 'slow_writing_return', input: writing(15000), review: 'typing_speed_is_not_exploration_mass' },
    { id: 'batched_writing_return', input: writing(1000, 50), review: 'batch_volume_is_not_exploration_mass' },
    { id: 'thinking_in_editor', input: writing(0), review: 'focus_alone_protects_without_claiming_writing' },
    { id: 'writing_only', input: recipe([phase(240000, 0, { focused: true, inputEveryMs: 1000 })]), review: 'writing_alone_adds_no_feed_interest' },
    { id: 'focused_reference_scroll', input: recipe([phase(240000, 0.2,
      { focused: true, inputEveryMs: 5000, reverseEveryMs: 7000 })]), review: 'movement_can_coexist_with_protected_editing' },
    { id: 'repeated_switching', input: recipe(Array.from({ length: 16 }, (_, i) =>
      phase((i + 1) * 15000, i % 2 ? 0 : 0.5,
        i % 2 ? { focused: true, inputEveryMs: 1000 } : {}))), review: 'switches_do_not_earn_a_count_bonus' },
    { id: 'observation_gap_return', input: recipe([phase(60000, 0.5), phase(120000, 0.5,
      { available: false, editorAvailable: false }), phase(160000, 0), phase(240000, 0.5)]), review: 'recovery_without_movement_is_not_renewal' },
    { id: 'editor_unavailable', input: recipe([phase(240000, 0.5, { editorAvailable: false })]), review: 'unknown_writing_is_not_no_writing' },
    { id: 'retained_loss', input: recipe([phase(240000, 0.5)]), fixture: { capacity: 2 }, review: 'lost_evidence_withholds_policy' },
    { id: 'stationary', input: recipe([phase(240000, 0)]), review: 'time_alone_adds_no_exploration' },
    { id: 'isolated_return_then_idle', input: recipe([phase(120000, 0.5),
      phase(180000, 0, { focused: true, inputEveryMs: 1000 }), phase(180500, 0),
      phase(181000, 0.5), phase(240000, 0)]), review: 'single_return_does_not_become_more_urgent_while_stationary' },
  ];
}

export const FLOW_PREPARATION_REVIEW_TIMES = Object.freeze(
  [...Array.from({ length: 49 }, (_, i) => i * 5000), 181000].sort((a, b) => a - b));
