// Product hypotheses are independent from policy implementation and coefficients.
// These relationships do not pretend to know a population's optimal timing.
export function assessFlowPreparation(cases) {
  const get = (id, at) => {
    const row = cases.find((entry) => entry.id === id)?.output.rows.find((value) => value.at === at);
    if (!row) throw new Error(`FLOW_PREPARATION_REVIEW_MISSING:${id}:${at}`);
    return row;
  };
  const checks = [];
  const check = (id, satisfied) => checks.push({ id, status: satisfied ? 'satisfied' : 'finding' });
  check('sustained_progression_builds_interest', get('continuous_exploration', 30000).preparationInterest
    < get('continuous_exploration', 60000).preparationInterest);
  check('slow_progression_builds_less_but_nonzero_interest', get('slow_exploration', 60000).preparationInterest > 0
    && get('slow_exploration', 60000).preparationInterest < get('continuous_exploration', 60000).preparationInterest);
  for (const id of ['long_writing_return', 'slow_writing_return', 'batched_writing_return', 'thinking_in_editor']) {
    check(`${id}_protected`, [60000, 90000, 150000, 175000].every((at) => get(id, at).preparationScore === 0));
    check(`${id}_blur_does_not_resume`, [180000, 190000, 195000].every((at) => get(id, at).preparationScore === 0));
    check(`${id}_renewed_progression_recovers`, get(id, 210000).preparationScore > 0
      && get(id, 240000).preparationScore > get(id, 210000).preparationScore);
  }
  check('writing_alone_does_not_build_interest', get('writing_only', 240000).preparationInterest === 0);
  check('focused_reference_movement_stays_protected', get('focused_reference_scroll', 240000).preparationInterest > 0
    && get('focused_reference_scroll', 240000).preparationScore === 0);
  check('typing_speed_does_not_change_exploration_interest', [60000, 150000, 240000].every((at) =>
    get('long_writing_return', at).preparationInterest === get('slow_writing_return', at).preparationInterest));
  check('same_time_batches_do_not_change_policy', JSON.stringify(cases.find((c) => c.id === 'long_writing_return').output.rows)
    === JSON.stringify(cases.find((c) => c.id === 'batched_writing_return').output.rows));
  check('switches_do_not_exceed_continuous_exploration', [30000, 60000, 120000, 240000].every((at) =>
    get('repeated_switching', at).preparationInterest < get('continuous_exploration', at).preparationInterest));
  check('each_observed_editor_interval_is_protected', [20000, 50000, 80000, 230000].every((at) =>
    get('repeated_switching', at).preparationScore === 0));
  check('observation_loss_withholds', get('observation_gap_return', 90000).preparationScore === null);
  check('geometry_recovery_without_progression_does_not_resume', [120000, 140000, 155000].every((at) =>
    get('observation_gap_return', at).preparationScore === 0));
  check('progression_after_recovery_can_prepare', get('observation_gap_return', 180000).preparationScore > 0);
  check('unavailable_editor_does_not_imply_safe_to_interrupt', get('editor_unavailable', 240000).preparationScore === null);
  check('cursor_loss_does_not_become_complete_policy', get('retained_loss', 240000).preparationScore === null
    && get('retained_loss', 240000).preparationInterest === null);
  check('stationary_time_is_not_exploration', get('stationary', 240000).preparationInterest === 0);
  check('isolated_return_does_not_grow_while_idle', get('isolated_return_then_idle', 185000).preparationScore
    <= get('isolated_return_then_idle', 181000).preparationScore);
  check('fictional_purpose_cannot_change_identical_evidence', JSON.stringify(cases.find((c) => c.id === 'continuous_exploration').output)
    === JSON.stringify(cases.find((c) => c.id === 'purposeful_search_twin').output));
  return { status: checks.some((c) => c.status === 'finding') ? 'findings' : 'preparation_contracts_satisfied', checks,
    unresolved: ['Purposeful search and compulsive exploration with identical observations remain indistinguishable.',
      'Editor focus protects conservatively, including an abandoned focused editor; one-draft identity is unobserved.',
      'Recent progression saturates; this candidate does not measure browser-wide habit or long-term attention spent.',
      'Reference breaks and switching may share observations. Optimal delay and actual endpoint timing remain unvalidated.'] };
}
