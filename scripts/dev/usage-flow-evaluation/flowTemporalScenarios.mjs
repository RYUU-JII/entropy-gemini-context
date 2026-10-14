// Visible development recipes authored independently of model output. These
// describe physical sampling/input, not empirical intentions or optimal policy.
// No classifier, thresholds, fixtures or production config may enter this file.
const phase = (untilMs, velocity, options = {}) => ({ untilMs, velocity, available: true,
  editorAvailable: true, focused: false, inputEveryMs: 0, inputBatch: 1,
  reverseEveryMs: 0, identityEveryMs: 0, ...options });
const recipe = (phases, options = {}) => ({ endMs: 90000, sampleEveryMs: 250,
  captureEveryMs: 2000, columns: 1, phases, ...options });
export function createFlowTemporalCorpus() {
  return [
    { id: 'forward', input: recipe([phase(90000, 0.5)]), review: 'forward_displacement' },
    { id: 'backtracking', input: recipe([phase(90000, 0.5, { reverseEveryMs: 10000 })]), review: 'both_directions' },
    { id: 'stationary', input: recipe([phase(90000, 0)]), review: 'stable_sampled_geometry' },
    { id: 'forward_then_stationary', input: recipe([phase(30000, 0.5), phase(90000, 0)]), review: 'movement_to_stability' },
    { id: 'forward_then_editor', input: recipe([phase(30000, 0.5), phase(90000, 0,
      { focused: true, inputEveryMs: 1000 })]), review: 'movement_to_editor' },
    { id: 'editor_reference', input: recipe([phase(90000, 0.15,
      { focused: true, inputEveryMs: 3000, reverseEveryMs: 8000 })]), review: 'coexisting_input_and_movement' },
    { id: 'gap_then_stationary', input: recipe([phase(30000, 0.5), phase(60000, 0.5,
      { available: false, editorAvailable: false }), phase(90000, 0)]), review: 'gap_is_not_stationarity' },
    { id: 'identity_changes_without_scroll', input: recipe([phase(90000, 0, { identityEveryMs: 2000 })]), review: 'identity_is_not_movement' },
    { id: 'grid_forward', input: recipe([phase(90000, 0.5)], { columns: 4 }), review: 'layout_is_not_a_speed_multiplier' },
    { id: 'large_input_batches', input: recipe([phase(30000, 0.5), phase(90000, 0,
      { focused: true, inputEveryMs: 1000, inputBatch: 50 })]), review: 'input_volume_is_not_extra_engagement' },
    { id: 'purpose_narrative_twin', input: recipe([phase(90000, 0.5)]), review: 'purpose_is_unidentifiable' },
  ];
}
