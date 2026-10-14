// Visible development evidence authored from geometry, identity declarations,
// and time before reading the new item owner or any pressure implementation.
// Rectangles are inputs. Expected fractions and hold arithmetic are a separate
// oracle; neither expected values nor identity relations may drive acquisition.

const VIEWPORT = { left: 0, top: 0, width: 100, height: 100 };

function item(nodeHandle, contentHint, left = 0, top = 0, width = 100, height = 100) {
  return { nodeHandle, contentHint, rect: { left, top, width, height } };
}

function sample(atMs, items) {
  return { atMs, kind: 'sample', items };
}

function start(atMs = 0) {
  return { atMs, kind: 'lifecycle', command: 'start' };
}

function stop(atMs) {
  return { atMs, kind: 'lifecycle', command: 'stop' };
}

function point(afterStep, fractions, dominantNodeHandles, dominanceMargin, extra = {}) {
  return { afterStep, items: fractions.map(([nodeHandle, itemFraction, regionFraction]) => (
    { nodeHandle, itemFraction, regionFraction }
  )), dominantNodeHandles, dominanceMargin, ...extra };
}

function totals(itemFractionMs, regionFractionMs, sampledCoverageMs, extra = {}) {
  return { itemFractionMs, regionFractionMs, sampledCoverageMs,
    unavailableVisibleMs: 0, hiddenMs: 0, ...extra };
}

function reference(afterStep, nodeHandle) {
  return { afterStep, nodeHandle };
}

function relation(kind, references) {
  return { kind, references };
}

function story(id, family, layout, steps, expected, options = {}) {
  return { id, family,
    fixture: { viewport: VIEWPORT, region: VIEWPORT, layout, maxSampleHoldMs: 750,
      identityCapacity: 256, journalCapacity: 256, ...options },
    steps, expected };
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createFlowItemObservationCorpus() {
  const scenarios = [];

  scenarios.push(story('fractional_sampled_path', 'fractional_geometry', 'vertical_list', [
    start(),
    sample(0, [item('a', 'hint-a'), item('b', 'hint-b', 0, 100)]),
    sample(100, [item('a', 'hint-a', 0, -25), item('b', 'hint-b', 0, 75)]),
    sample(200, [item('a', 'hint-a', 0, -50), item('b', 'hint-b', 0, 50)]),
    sample(300, [item('a', 'hint-a', 0, -75), item('b', 'hint-b', 0, 25)]),
    sample(400, [item('a', 'hint-a', 0, -100), item('b', 'hint-b')]),
    stop(500),
  ], {
    samples: [
      point(1, [['a', 1, 1], ['b', 0, 0]], ['a'], 1),
      point(2, [['a', 0.75, 0.75], ['b', 0.25, 0.25]], ['a'], 0.5),
      point(3, [['a', 0.5, 0.5], ['b', 0.5, 0.5]], ['a', 'b'], 0),
      point(4, [['a', 0.25, 0.25], ['b', 0.75, 0.75]], ['b'], 0.5),
      point(5, [['a', 0, 0], ['b', 1, 1]], ['b'], 1),
    ],
    final: totals(500, 500, 500),
    perHintFractionMs: { 'hint-a': { item: 250, region: 250 }, 'hint-b': { item: 250, region: 250 } },
    notes: ['Five 100 ms sample holds are a piecewise estimate, not a continuous-motion integral.'],
  }));

  scenarios.push(story('return_to_retained_item', 'identity_return', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]), sample(100, [item('b', 'hint-b')]),
    sample(300, [item('a', 'hint-a')]), stop(400),
  ], {
    samples: [
      point(1, [['a', 1, 1]], ['a'], 1, { change: 'baseline', continuity: false }),
      point(2, [['b', 1, 1]], ['b'], 1, { change: 'single_item_change', continuity: true }),
      point(3, [['a', 1, 1]], ['a'], 1, { change: 'single_item_change', continuity: true,
        reenteredNodeHandles: ['a'] }),
    ],
    identityRelations: [relation('same_identity', [reference(1, 'a'), reference(3, 'a')])],
    final: totals(400, 400, 400),
    perHintFractionMs: { 'hint-a': { item: 200, region: 200 }, 'hint-b': { item: 200, region: 200 } },
    notes: ['Reappearance of a retained local identity does not establish rereading.'],
  }));

  scenarios.push(story('replacement_node_same_hint', 'identity_replacement', 'paged_item', [
    start(), sample(0, [item('old-node', 'same-hint')]),
    sample(100, [item('new-node', 'same-hint')]), stop(200),
  ], {
    samples: [point(2, [['new-node', 1, 1]], ['new-node'], 1,
      { change: 'unchanged', continuity: true, identityBasis: 'content_hint' })],
    identityRelations: [relation('same_identity', [reference(1, 'old-node'), reference(2, 'new-node')])],
    final: totals(200, 200, 200),
    perHintFractionMs: { 'same-hint': { item: 200, region: 200 } },
    notes: ['A stable hint is a surface-local declaration, not a verified global content ID.'],
  }));

  scenarios.push(story('recycled_node_changed_hint', 'identity_recycling', 'paged_item', [
    start(), sample(0, [item('recycled', 'hint-a')]),
    sample(100, [item('recycled', 'hint-b')]),
    sample(200, [item('recycled', 'hint-a')]), stop(300),
  ], {
    samples: [
      point(2, [['recycled', 1, 1]], ['recycled'], 1, { change: 'single_item_change', continuity: true }),
      point(3, [['recycled', 1, 1]], ['recycled'], 1,
        { change: 'single_item_change', continuity: true, reenteredNodeHandles: ['recycled'] }),
    ],
    identityRelations: [
      relation('different_identity', [reference(1, 'recycled'), reference(2, 'recycled')]),
      relation('same_identity', [reference(1, 'recycled'), reference(3, 'recycled')]),
    ],
    final: totals(300, 300, 300),
    perHintFractionMs: { 'hint-a': { item: 200, region: 200 }, 'hint-b': { item: 100, region: 100 } },
  }));

  scenarios.push(story('duplicate_hints_in_two_slots', 'identity_ambiguity', 'grid', [
    start(), sample(0, [item('left', 'duplicate', 0, 0, 50), item('right', 'duplicate', 50, 0, 50)]),
    sample(100, [item('right', 'duplicate', 50, 0, 50), item('left', 'duplicate', 0, 0, 50)]),
    stop(200),
  ], {
    samples: [
      point(1, [['left', 1, 0.5], ['right', 1, 0.5]], ['left', 'right'], 0,
        { identityBasis: 'ambiguous_hint' }),
      point(2, [['right', 1, 0.5], ['left', 1, 0.5]], ['left', 'right'], 0,
        { change: 'unchanged', continuity: true, identityBasis: 'ambiguous_hint' }),
    ],
    identityRelations: [
      relation('different_identity', [reference(1, 'left'), reference(1, 'right')]),
      relation('same_identity', [reference(1, 'left'), reference(2, 'left')]),
      relation('same_identity', [reference(1, 'right'), reference(2, 'right')]),
    ],
    final: totals(400, 200, 200),
    notes: ['Two full items occupy one region. Duplicate hints cannot collapse both slots into one item.'],
  }));

  scenarios.push(story('node_only_continuity_and_remount', 'identity_unavailable', 'paged_item', [
    start(), sample(0, [item('unkeyed-a', null)]), sample(100, [item('unkeyed-a', null)]),
    sample(200, [item('unkeyed-b', null)]), stop(300),
  ], {
    samples: [
      point(2, [['unkeyed-a', 1, 1]], ['unkeyed-a'], 1,
        { change: 'unchanged', continuity: true, identityBasis: 'node_only' }),
      point(3, [['unkeyed-b', 1, 1]], ['unkeyed-b'], 1,
        { change: 'visible_set_change', continuity: true, identityBasis: 'node_only' }),
    ],
    identityRelations: [
      relation('same_identity', [reference(1, 'unkeyed-a'), reference(2, 'unkeyed-a')]),
      relation('different_identity', [reference(2, 'unkeyed-a'), reference(3, 'unkeyed-b')]),
    ],
    final: totals(300, 300, 300),
    notes: ['A node-only remount cannot establish whether the underlying content is new.'],
  }));

  const grid = [item('tl', 'hint-tl', 0, 0, 50, 50), item('tr', 'hint-tr', 50, 0, 50, 50),
    item('bl', 'hint-bl', 0, 50, 50, 50), item('br', 'hint-br', 50, 50, 50, 50)];
  scenarios.push(story('four_equal_grid_cells', 'dominance_ties', 'grid', [
    start(), sample(0, grid), sample(100, [...grid].reverse()), stop(200),
  ], {
    samples: [
      point(1, [['tl', 1, 0.25], ['tr', 1, 0.25], ['bl', 1, 0.25], ['br', 1, 0.25]],
        ['bl', 'br', 'tl', 'tr'], 0),
      point(2, [['br', 1, 0.25], ['bl', 1, 0.25], ['tr', 1, 0.25], ['tl', 1, 0.25]],
        ['bl', 'br', 'tl', 'tr'], 0, { change: 'unchanged', continuity: true }),
    ],
    final: totals(800, 200, 200),
    notes: ['Input order cannot break an exact tie. No representative item is silently selected.'],
  }));

  scenarios.push(story('small_continuous_dominance_change', 'dominance_near_tie', 'grid', [
    start(), sample(0, [item('left', 'hint-l', 0, 0, 49.5), item('right', 'hint-r', 49.5, 0, 50.5)]),
    sample(100, [item('left', 'hint-l', 0, 0, 50.5), item('right', 'hint-r', 50.5, 0, 49.5)]),
    stop(200),
  ], {
    samples: [
      point(1, [['left', 1, 0.495], ['right', 1, 0.505]], ['right'], 0.01),
      point(2, [['left', 1, 0.505], ['right', 1, 0.495]], ['left'], 0.01,
        { change: 'unchanged', continuity: true }),
    ],
    final: totals(400, 200, 200),
    notes: ['A small positive area difference remains small evidence; it is not a content transition.'],
  }));

  scenarios.push(story('tall_card_and_small_full_card', 'area_denominators', 'grid', [
    start(), sample(0, [item('tall', 'hint-tall', 0, 0, 80, 400), item('small', 'hint-small', 80, 0, 20)]),
    stop(200),
  ], {
    samples: [point(1, [['tall', 0.25, 0.8], ['small', 1, 0.2]], ['tall'], 0.6)],
    final: totals(250, 200, 200),
    perHintFractionMs: { 'hint-tall': { item: 50, region: 160 }, 'hint-small': { item: 200, region: 40 } },
    notes: ['The largest visible area can belong to the item with the smaller item fraction.'],
  }));

  scenarios.push(story('two_axis_clipping', 'fractional_geometry', 'grid', [
    start(), sample(0, [item('corner', 'hint-corner', -50, -50)]), stop(200),
  ], {
    samples: [point(1, [['corner', 0.25, 0.25]], ['corner'], 0.25)],
    final: totals(50, 50, 200),
    notes: ['A 50 by 50 intersection of a 100 by 100 item is one quarter, not one half.'],
  }));

  scenarios.push(story('paged_transition_with_two_exposed_items', 'paged_dominance', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a'), item('b', 'hint-b', 0, 100)]),
    sample(100, [item('a', 'hint-a', 0, -50), item('b', 'hint-b', 0, 50)]),
    sample(200, [item('a', 'hint-a', 0, -100), item('b', 'hint-b')]), stop(300),
  ], {
    samples: [
      point(1, [['a', 1, 1], ['b', 0, 0]], ['a'], 1),
      point(2, [['a', 0.5, 0.5], ['b', 0.5, 0.5]], ['a', 'b'], 0,
        { change: 'visible_set_change', continuity: true }),
      point(3, [['a', 0, 0], ['b', 1, 1]], ['b'], 1,
        { change: 'visible_set_change', continuity: true }),
    ],
    final: totals(300, 300, 300),
    perHintFractionMs: { 'hint-a': { item: 150, region: 150 }, 'hint-b': { item: 150, region: 150 } },
    notes: ['A multi-item intermediate frame prevents a fabricated direct single-item replacement.'],
  }));

  scenarios.push(story('hidden_gap_then_sample', 'visibility_gap', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]),
    { atMs: 100, kind: 'visibility', visible: false },
    { atMs: 1000, kind: 'visibility', visible: true },
    sample(1100, [item('b', 'hint-b')]), stop(1200),
  ], {
    samples: [point(4, [['b', 1, 1]], ['b'], 1, { change: 'baseline', continuity: false })],
    final: totals(200, 200, 200, { unavailableVisibleMs: 100, hiddenMs: 900 }),
    perHintFractionMs: { 'hint-a': { item: 100, region: 100 }, 'hint-b': { item: 100, region: 100 } },
    notes: ['Hidden and newly visible unsampled time are not item exposure or observed rest.'],
  }));

  scenarios.push(story('expired_hold_then_new_item', 'sample_expiry', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]), sample(1000, [item('b', 'hint-b')]), stop(1100),
  ], {
    samples: [point(2, [['b', 1, 1]], ['b'], 1, { change: 'baseline', continuity: false })],
    final: totals(850, 850, 850, { unavailableVisibleMs: 250 }),
    perHintFractionMs: { 'hint-a': { item: 750, region: 750 }, 'hint-b': { item: 100, region: 100 } },
    notes: ['The earlier rectangle is held for at most 750 ms; the missing 250 ms is not interpolated.'],
  }));

  scenarios.push(story('programmatic_write_detected_later', 'programmatic_gap', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]),
    { atMs: 100, kind: 'programmatic_write', target: 'feed', to: 100, purpose: 'effect_adjustment' },
    { atMs: 150, kind: 'invalidate', reason: 'programmatic_scroll' },
    sample(200, [item('b', 'hint-b')]), stop(300),
  ], {
    samples: [point(4, [['b', 1, 1]], ['b'], 1, { change: 'baseline', continuity: false })],
    final: totals(250, 250, 250, { unavailableVisibleMs: 50 }),
    perHintFractionMs: { 'hint-a': { item: 150, region: 150 }, 'hint-b': { item: 100, region: 100 } },
    notes: ['Invalidation closes the estimate at detection, not an invented retroactive write timestamp.',
      'The known app write breaks continuity; the new sample still describes actual geometry.'],
  }));

  scenarios.push(story('scroll_hold_close_preserves_next_sample_relation', 'sample_hold_boundary', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]),
    { atMs: 100, kind: 'end_hold' }, sample(150, [item('b', 'hint-b')]), stop(250),
  ], {
    samples: [point(3, [['b', 1, 1]], ['b'], 1,
      { change: 'single_item_change', continuity: true, previousSampleAtMs: 0 })],
    final: totals(200, 200, 200, { unavailableVisibleMs: 50 }),
    notes: ['Closing a stale position hold after ordinary scrolling does not itself prove an identity gap.',
      'The between-sample identity relation is still not a user-attributed advance.'],
  }));

  scenarios.push(story('endpoint_stop_and_restart', 'lifecycle_epoch', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]), stop(100),
    start(1000), sample(1200, [item('a', 'hint-a')]), stop(1300),
  ], {
    samples: [point(4, [['a', 1, 1]], ['a'], 1, { change: 'baseline', continuity: false })],
    epochTotals: [
      { afterStep: 2, epoch: 1, ...totals(100, 100, 100) },
      { afterStep: 5, epoch: 2, ...totals(100, 100, 100, { unavailableVisibleMs: 200 }) },
    ],
    identityRelations: [relation('different_epoch_identity', [reference(1, 'a'), reference(4, 'a')])],
    notes: ['Stopped time is outside either active epoch; restart does not replay the previous epoch.'],
  }));

  scenarios.push(story('identity_retention_eviction', 'bounded_identity', 'paged_item', [
    start(), sample(0, [item('a', 'hint-a')]), sample(100, [item('b', 'hint-b')]),
    sample(200, [item('c', 'hint-c')]), sample(300, [item('a-remount', 'hint-a')]), stop(400),
  ], {
    samples: [point(4, [['a-remount', 1, 1]], ['a-remount'], 1, { reenteredNodeHandles: [] })],
    identityRelations: [relation('evicted_identity_not_recovered', [reference(1, 'a'), reference(4, 'a-remount')])],
    final: totals(400, 400, 400),
    notes: ['A two-entry retention budget cannot support lifetime deduplication after a third identity.'],
  }, { identityCapacity: 2 }));

  const journalSteps = [start()];
  for (let index = 0; index < 10; index += 1) {
    const label = index % 2 === 0 ? 'a' : 'b';
    journalSteps.push(sample(index * 100, [item(label, `hint-${label}`)]));
  }
  journalSteps.push(stop(1000), { atMs: 1000, kind: 'read_journal', afterSequence: 0 });
  scenarios.push(story('journal_overflow_is_explicit', 'bounded_journal', 'paged_item', journalSteps, {
    final: totals(1000, 1000, 1000),
    journal: { afterStep: 12, afterSequence: 0, retainedAtMost: 4,
      overflowRequired: true, cursorGapRequired: true, sequencesStrictlyIncreasing: true },
    notes: ['The oldest records exceed the authored capacity. A cursor gap must remain explicit.',
      'Dropped event history is not reconstructed from aggregate totals.'],
  }, { journalCapacity: 4 }));

  return deepFreeze({ version: 1, scenarios,
    design: {
      authority: 'visible_development_corpus', rawData: 'synthetic_geometry_and_opaque_identity',
      timeBasis: 'monotonic_milliseconds', expectedValues: 'manual_area_and_bounded_hold_arithmetic',
      identityScope: 'local_hints_and_nodes_not_verified_content',
      prohibitedClaims: ['consumed_items', 'read_items', 'gaze', 'intent', 'user_attributed_progression'],
      limits: ['Rectangles approximate geometric clipping, not paint or occlusion.',
        'Temporal fractions are bounded sample holds, not continuous visibility proof.',
        'Small retention and journal capacities are explicit synthetic resource configurations.'],
    } });
}
