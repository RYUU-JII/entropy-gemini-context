// Authored physical layouts/actions and review hypotheses only. No model imports,
// score thresholds, labels, inferred endpoint readiness or detector fixtures.
export function createFlowTemporalDomCorpus() {
  const movement = [731, 1893, 2741, 4229, 5513, 6937, 8611, 10103].map((atMs, index) => ({
    kind: 'scroll', target: 'feed', atMs, to: Math.round(110 * (index + 1) ** 1.45),
  }));
  const writing = [11021, 11879, 13211, 14437, 16897, 18913].map((atMs) => ({
    kind: 'input', mode: 'composition', count: 1, atMs,
  }));
  const scenario = (id, layout, actions, expected) => ({ id, layout, actions,
    endMs: 20000, atMs: [5000, 10000, 15000, 20000], expected });
  return [
    scenario('irregular_list', 'list', [...movement, ...writing], { movement: true, editor: true, geometry: true }),
    scenario('irregular_grid', 'grid', [...movement, ...writing], { movement: true, editor: true, geometry: true }),
    scenario('variable_heights', 'variable', [...movement, ...writing], { movement: true, editor: true, geometry: true }),
    scenario('virtual_node_reuse', 'virtual', [...movement, ...writing], { movement: true, editor: true, geometry: true }),
    scenario('nested_comments', 'list', [...movement.map((step) => ({ ...step, target: 'comments' })), ...writing],
      { movement: false, editor: true, geometry: true }),
    scenario('writing_only', 'list', writing, { movement: false, editor: true, geometry: true }),
    scenario('writing_event_batches', 'list', writing.map((step) => ({ ...step, count: 8 })),
      { movement: false, editor: true, geometry: true }),
    scenario('ambiguous_region_with_editor', 'list', [...movement, ...writing,
      { kind: 'ambiguous', atMs: 14999 }].sort((a, b) => a.atMs - b.atMs),
      { movement: null, editor: true, geometry: false }),
    scenario('visibility_with_editor', 'list', [...movement, ...writing.filter((step) => step.atMs < 15000),
      { kind: 'visibility', visible: false, atMs: 15000 }], { movement: null, editor: false, geometry: false }),
    scenario('recovered_same_region', 'list', [...movement, ...writing.filter((step) => step.atMs < 12000 || step.atMs > 14500),
      { kind: 'visibility', visible: false, atMs: 12000 }, { kind: 'visibility', visible: true, atMs: 14500 }]
      .sort((a, b) => a.atMs - b.atMs), { movement: true, editor: true, geometry: true }),
    ...['replace_feed_region', 'replace_feed_scroller', 'route'].map((kind) => scenario(kind, 'list',
      [...movement, ...writing, { kind, atMs: 12000, ...(kind === 'route' ? { pathname: '/another-feed' } : {}) }]
        .sort((a, b) => a.atMs - b.atMs), { movement: false, editor: true, geometry: true })),
  ];
}

export function assessFlowTemporalDom(scenario, output) {
  const last = output.rows.at(-1);
  const window = last.windows[0];
  const checks = [
    { name: 'editor_availability', holds: last.editorAvailable === scenario.expected.editor },
    { name: 'geometry_availability', holds: last.currentGeometrySupported === scenario.expected.geometry },
    { name: 'input_evidence', holds: scenario.expected.editor ? window.inputRecency > 0 : window.inputRecency === null },
  ];
  if (scenario.expected.movement !== null) checks.push({ name: 'movement_units',
    holds: scenario.expected.movement ? window.observedForwardRate > 0
      : window.observedForwardRate === 0 && window.observedBackwardRate === 0 });
  return checks.map(({ name, holds }) => ({ name, status: holds ? 'consistent' : 'finding' }));
}
