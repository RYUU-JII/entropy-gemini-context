// Product/physical review hypotheses, separate from the descriptive model.
// Findings do not invalidate execution and never tune a score or policy.
export function evaluateFlowTemporal(reports) {
  const get = (id, at = 90000) => {
    const row = reports.find((report) => report.id === id)?.output.rows.find((value) => value.at === at);
    if (!row) throw new Error(`FLOW_TEMPORAL_REVIEW_ROW_MISSING:${id}:${at}`);
    return row;
  };
  const fast = (id, at) => get(id, at).windows[0];
  const checks = [];
  const check = (id, satisfied) => checks.push({ id, status: satisfied ? 'satisfied' : 'finding' });
  check('forward_is_observed', fast('forward').observedForwardRate > 0 && fast('forward').observedBackwardRate === 0);
  check('both_directions_and_retained_returns', fast('backtracking').observedForwardRate > 0
    && fast('backtracking').observedBackwardRate > 0 && fast('backtracking').retainedIdentityReentryShare > 0);
  check('stationary_geometry_is_supported', fast('stationary').observedForwardRate === 0
    && fast('stationary').observedBackwardRate === 0 && fast('stationary').matchedVisibleAreaShare === 1);
  const stopped = get('forward_then_stationary');
  check('movement_to_stability', stopped.windows[0].observedForwardRate < stopped.windows[1].observedForwardRate
    && fast('forward_then_stationary').matchedVisibleAreaShare > fast('forward_then_stationary', 20000).matchedVisibleAreaShare);
  check('movement_to_editor', fast('forward_then_editor').editorFocusShare > fast('forward_then_editor', 20000).editorFocusShare
    && fast('forward_then_editor').inputRecency > 0
    && fast('forward_then_editor').observedForwardRate < fast('forward_then_editor', 20000).observedForwardRate);
  check('input_and_reference_can_coexist', fast('editor_reference').inputRecency > 0
    && fast('editor_reference').observedForwardRate > 0 && fast('editor_reference').observedBackwardRate > 0);
  check('gap_preserves_unavailability', !get('gap_then_stationary', 50000).currentGeometrySupported
    && !get('gap_then_stationary', 50000).editorAvailable
    && fast('gap_then_stationary', 50000).geometrySupport < fast('gap_then_stationary', 20000).geometrySupport);
  check('identity_changes_are_not_scroll', fast('identity_changes_without_scroll').observedForwardRate === 0
    && fast('identity_changes_without_scroll').observedBackwardRate === 0
    && fast('identity_changes_without_scroll').matchedVisibleAreaShare < 1);
  check('layout_does_not_multiply_displacement', fast('grid_forward').observedForwardRate === fast('forward').observedForwardRate);
  check('input_batch_does_not_multiply_engagement', JSON.stringify(get('large_input_batches').windows)
    === JSON.stringify(get('forward_then_editor').windows));
  check('narrative_cannot_change_evidence', JSON.stringify(get('purpose_narrative_twin')) === JSON.stringify(get('forward')));
  return { status: checks.some((value) => value.status === 'finding') ? 'findings' : 'descriptive_contracts_satisfied', checks };
}
