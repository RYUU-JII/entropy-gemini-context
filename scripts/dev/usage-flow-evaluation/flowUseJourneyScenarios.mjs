// Product hypotheses authored before executing this journey evaluation. Prior
// production code and earlier findings were known: this is not a blinded or
// empirical human dataset. No implementation/default/QA imports supply answers.
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const FIXTURE = { id: 'authored-use-lane', viewport: { width: 720, height: 800 },
  feed: { initialScrollTop: 0, clientHeight: 800, scrollHeight: 19200, itemCount: 40, itemHeight: 480 } };

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function traversal({ until, gaps, from = 0, initial = 0, distance = 800, virtualized = true }) {
  const steps = [];
  let atMs = from; let position = initial;
  let supplied = Math.max(40, Math.ceil((initial + 800) / 480) + 24);
  for (let index = 0; ; index += 1) {
    atMs += gaps[index % gaps.length];
    if (atMs > until) break;
    position += typeof distance === 'number' ? distance : distance[index % distance.length];
    const needed = Math.ceil((position + 800) / 480) + 24;
    const appendCount = Math.max(0, needed - supplied);
    supplied += appendCount;
    steps.push({ atMs, kind: 'movement', to: position, appendCount,
      trimBeforeIndex: virtualized ? Math.max(0, Math.floor(position / 480) - 8) : 0 });
  }
  return steps;
}
function writing(from, until, period = 4000) {
  const steps = [{ atMs: from, kind: 'focus', active: true }];
  for (let atMs = from; atMs <= until; atMs += period) {
    steps.push({ atMs, kind: 'input', mode: (atMs - from) % (period * 3) === 0 ? 'composition' : 'typing', count: 4 });
  }
  return steps;
}
function scenario(id, family, endMs, steps, preparation, observableDescription, narrative) {
  return { id, family, narrative,
    input: { fixture: FIXTURE, endMs,
      steps: [...steps, { atMs: endMs, kind: 'tick' }].sort((a, b) => a.atMs - b.atMs) },
    expected: { preparation,
      observableDescription,
      forbiddenClaims: ['unwanted_consumption', 'addiction', 'productive_use', 'same_draft_identity'],
      patternOutput: 'temporal_description_required_for_future_model_not_supplied_by_current_decision_dto' } };
}
const withhold = (endMs) => ({ kind: 'withhold', fromMs: 0, untilMs: endMs });
// These broad review windows are provisional product choices, not calibrated
// optimal timings or copies of sensing/cooldown constants. Early readiness and
// late/missing readiness are findings; tests must not turn them into execution errors.
const sustainedWindow = { kind: 'window', earliestMs: 2 * MINUTE, latestMs: 8 * MINUTE };

export function createFlowUseJourneyCorpus() {
  const sustained = traversal({ until: 10 * MINUTE, gaps: [2200] });
  const scenarios = [
    scenario('sustained_traversal', 'forward_rhythm', 10 * MINUTE, sustained, sustainedWindow,
      ['sustained_forward_progression'], 'Repeated forward exploration without an observed editing or reverse phase.'),
    scenario('fast_traversal', 'forward_rhythm', 10 * MINUTE,
      traversal({ until: 10 * MINUTE, gaps: [650] }), sustainedWindow,
      ['sustained_forward_progression', 'short_inter_advance_intervals'], 'A faster traversal of the same kind of feed.'),
    scenario('irregular_traversal', 'forward_rhythm', 10 * MINUTE,
      traversal({ until: 10 * MINUTE, gaps: [1000, 1600, 2800, 1100, 4200, 900] }), sustainedWindow,
      ['sustained_forward_progression', 'variable_inter_advance_intervals'], 'Forward exploration with naturally uneven intervals.'),
    scenario('brief_visit', 'brief_use', 90 * SECOND,
      traversal({ until: 90 * SECOND, gaps: [3000], distance: 600 }), withhold(90 * SECOND),
      ['brief_forward_progression'], 'A bounded short visit; no durable habit should be inferred from this alone.'),
    scenario('slow_dwell', 'dwell_dominant', 12 * MINUTE,
      traversal({ until: 12 * MINUTE, gaps: [24000], distance: 400 }), withhold(12 * MINUTE),
      ['sparse_forward_progression', 'long_inter_advance_intervals'], 'Slow movement with long stable intervals; reading itself is unobserved.'),
    scenario('comparison_backtracking', 'revisiting', 12 * MINUTE,
      traversal({ until: 12 * MINUTE, gaps: [6000, 8000, 5000, 9000], distance: [800, -600, 800, -600] }), withhold(12 * MINUTE),
      ['repeated_direction_reversal', 'net_forward_progression'], 'Moving forward and back while comparing nearby items.'),
    scenario('long_editor', 'writing', 8 * MINUTE, writing(0, 8 * MINUTE), withhold(8 * MINUTE),
      ['sustained_editing_activity', 'no_feed_displacement'], 'Sustained composition without moving the feed.'),
    scenario('editor_thinking_and_reference_scroll', 'mixed_writing', 12 * MINUTE,
      [...writing(0, 12 * MINUTE, 60000),
        ...traversal({ until: 12 * MINUTE, gaps: [8000], distance: 120 })], withhold(12 * MINUTE),
      ['intermittent_editing_activity', 'editor_focus_retained', 'low_rate_forward_progression'],
      'An editor stays focused across thinking gaps and small reference movements; a draft identity is not observable.'),
    scenario('traversal_then_editor', 'mixed_writing', 10 * MINUTE,
      [...traversal({ until: 2 * MINUTE, gaps: [2200] }), ...writing(2 * MINUTE, 10 * MINUTE)], withhold(10 * MINUTE),
      ['forward_progression_then_editing', 'editing_without_new_feed_displacement'],
      'A short exploration becomes sustained editing; old accumulated movement must not become a new opportunity during editing.'),
    scenario('hidden_then_brief_return', 'visibility', 9 * MINUTE,
      [...traversal({ until: 2 * MINUTE, gaps: [2200] }),
        { atMs: 2 * MINUTE, kind: 'visibility', visible: false },
        { atMs: 8 * MINUTE, kind: 'visibility', visible: true },
        ...traversal({ from: 8 * MINUTE, until: 9 * MINUTE, gaps: [3000], initial: 43200, distance: 600 })],
      withhold(9 * MINUTE), ['visible_progression_then_hidden_gap_then_brief_return'],
      'Hidden time must not supply additional observed use or a ready opportunity on return.'),
    scenario('append_only_traversal', 'structure_variation', 10 * MINUTE,
      traversal({ until: 10 * MINUTE, gaps: [2200], virtualized: false }), sustainedWindow,
      ['sustained_forward_progression'], 'The same travel geometry, retaining previous offscreen DOM cards.'),
    scenario('purpose_narrative_twin', 'identifiability', 10 * MINUTE, sustained, sustainedWindow,
      ['sustained_forward_progression'], 'The author imagines purposeful research; that imagined intention changes no observable input.'),
  ];
  return freeze({ version: 1, authority: 'visible_product_hypotheses_not_human_ground_truth',
    scenarios, relations: [
      { id: 'narrative_cannot_change_decision', kind: 'identical_observations',
        scenarioIds: ['sustained_traversal', 'purpose_narrative_twin'] },
      { id: 'retained_dom_changes_measurement_support', kind: 'structure_diagnostic',
        scenarioIds: ['sustained_traversal', 'append_only_traversal'] },
    ], scope: { substrate: 'one_authored_instagram_root_feed',
      actuation: 'real_endpoint_until_first_exposure_then_predeclared_censoring',
      labeling: 'capability_audit_no_invented_pattern_adapter',
      sites: 'no_history_projection_or_site_habit_accuracy_claim' } });
}
