// Independently authored development stories. Inputs are physical DOM actions;
// expected values are distance/viewport and bounded-sample time arithmetic.
// No production model, pressure threshold, previous QA recipe or classifier is
// imported. These visible examples are development evidence, not held-out data.

const CAPABILITIES = Object.freeze({ consumptionTransitions: 'unsupported', userAttribution: 'unavailable' });

function fixture(id, { scale = 1, initialItems = 80 } = {}) {
  return { id, viewport: { width: 960 * scale, height: 600 * scale },
    feed: { itemHeight: 300 * scale, initialItems, initialScrollTop: 0 },
    surface: { hostname: 'x.com', pathname: '/home' } };
}

function facts(forward, backward, sampled, { unavailable = 0, hidden = 0, ...rest } = {}) {
  return { unknownForwardScreenfuls: forward, unknownBackwardScreenfuls: backward,
    sampledCoverageMs: sampled, unavailableVisibleMs: unavailable, hiddenMs: hidden,
    capabilities: CAPABILITIES, ...rest };
}

const start = () => [{ atMs: 0, kind: 'lifecycle', command: 'start' }, { atMs: 0, kind: 'sample' }];
const check = (afterStep, observation) => ({ afterStep, observation });

function story({ id, family, steps, final, checkpoints = [], initialItems, scale, captureStepIndices, note }) {
  return { id, family, fixture: fixture(id, { initialItems, scale }), steps,
    ...(captureStepIndices ? { captureStepIndices } : {}),
    expected: { checkpoints: [...checkpoints, check(steps.length - 1, final)],
      limitations: ['Displacement source is unknown; no reading or item-consumption claim.',
        'Coverage is the sensor\'s bounded geometry hold, not complete continuous observation.', note] } };
}

function physicalPath(scale = 1) {
  const steps = start();
  for (let index = 1; index <= 12; index += 1) {
    steps.push({ atMs: index * 250, kind: 'scroll', target: 'feed', to: index * 150 * scale });
    steps.push({ atMs: index * 250, kind: 'sample' });
  }
  return steps;
}

function stationarySteps(durationMs, { input = false } = {}) {
  const steps = start();
  for (let atMs = 500; atMs <= durationMs; atMs += 500) {
    if (input && atMs % 1000 === 0) {
      const mode = atMs % 17000 === 0 ? 'paste' : atMs % 6000 === 0 ? 'composition' : 'typing';
      steps.push({ atMs, kind: 'input', mode, count: mode === 'paste' ? 1 : 4 });
    }
    steps.push({ atMs, kind: 'sample' });
  }
  return steps;
}

function mixedSteps({ input = false } = {}) {
  const steps = start();
  for (let atMs = 500; atMs <= 30000; atMs += 500) {
    if (atMs % 1000 === 0) steps.push({ atMs, kind: 'scroll', target: 'feed', to: atMs * 0.12 });
    if (input && atMs % 1500 === 0) steps.push({ atMs, kind: 'input', mode: 'typing', count: 3 });
    steps.push({ atMs, kind: 'sample' });
  }
  return steps;
}

function programmaticSteps(purpose) {
  return [...start(),
    { atMs: 100, kind: 'programmatic_write', target: 'feed', to: 180, purpose },
    { atMs: 200, kind: 'scroll', target: 'feed', to: 300 },
    { atMs: 250, kind: 'sample' },
    { atMs: 350, kind: 'scroll', target: 'feed', to: 600 },
    { atMs: 500, kind: 'sample' }];
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createFlowMeasuredPressureCorpus() {
  const scenarios = [];
  for (const [id, scale] of [['physical_path', 1], ['physical_path_half', 0.5], ['physical_path_large', 1.75]]) {
    scenarios.push(story({ id, family: 'physical_scaling', scale, steps: physicalPath(scale),
      final: facts(3, 0, 3000, { acceptedScrollEvents: 12, status: 'sampled' }),
      note: 'Twelve forward movements each cover one quarter of a viewport; scaling pixels and viewport together preserves three screenfuls.' }));
  }
  scenarios.push(story({ id: 'physical_path_sparse_reader', family: 'reader_partition',
    steps: physicalPath(), captureStepIndices: [0, 1, 9, 17, 25],
    final: facts(3, 0, 3000, { acceptedScrollEvents: 12, status: 'sampled' }),
    note: 'Sensor delivery is identical to physical_path. Only the evaluation reader sees fewer checkpoints; inside-interval movement timing is less precise.' }));

  const expired = [...start(),
    { atMs: 100, kind: 'scroll', target: 'feed', to: 300 },
    { atMs: 1000, kind: 'scroll', target: 'feed', to: 900 },
    { atMs: 1100, kind: 'sample' },
    { atMs: 1200, kind: 'scroll', target: 'feed', to: 1200 },
    { atMs: 1400, kind: 'sample' }];
  scenarios.push(story({ id: 'expired_then_renewed', family: 'sample_gap', steps: expired,
    checkpoints: [check(3, facts(0.5, 0, 750, { unavailable: 250, status: 'stale', unmeasuredScrollEvents: 1 }))],
    final: facts(1, 0, 1050, { unavailable: 350, acceptedScrollEvents: 2, unmeasuredScrollEvents: 1 }),
    note: 'The initial hold ends at 750 ms; sampling resumes at 1100 ms. The 600 px gap is omitted, while two measured 300 px movements total one screenful.' }));
  const exactExpiry = [...start(),
    { atMs: 750, kind: 'scroll', target: 'feed', to: 300 },
    { atMs: 750, kind: 'sample' },
    { atMs: 850, kind: 'scroll', target: 'feed', to: 600 },
    { atMs: 1000, kind: 'sample' }];
  scenarios.push(story({ id: 'event_at_hold_end', family: 'sample_gap', steps: exactExpiry,
    checkpoints: [check(2, facts(0, 0, 750, { status: 'stale', unmeasuredScrollEvents: 1 }))],
    final: facts(0.5, 0, 1000, { acceptedScrollEvents: 1, unmeasuredScrollEvents: 1 }),
    note: 'A geometry hold uses a half-open interval. A scroll at 750 ms precedes the new sample at 750 ms and cannot borrow its future validity.' }));

  const hidden = [...start(),
    { atMs: 100, kind: 'scroll', target: 'feed', to: 300 },
    { atMs: 200, kind: 'visibility', visible: false },
    { atMs: 300, kind: 'scroll', target: 'feed', to: 900 },
    { atMs: 1200, kind: 'visibility', visible: true },
    { atMs: 1300, kind: 'sample' },
    { atMs: 1400, kind: 'scroll', target: 'feed', to: 1200 },
    { atMs: 1500, kind: 'sample' }];
  scenarios.push(story({ id: 'hidden_then_renewed', family: 'visibility', steps: hidden,
    checkpoints: [check(4, facts(0.5, 0, 200, { hidden: 100, status: 'hidden' })),
      check(5, facts(0.5, 0, 200, { hidden: 1000, status: 'unavailable' }))],
    final: facts(1, 0, 400, { hidden: 1000, unavailable: 100, acceptedScrollEvents: 2 }),
    note: 'Hidden time is 200..1200 ms; 1200..1300 ms is visible but unsampled. Hidden displacement is not caught up after resume.' }));

  for (const purpose of ['effect_adjustment', 'input_assistance']) {
    scenarios.push(story({ id: `known_write_${purpose}`, family: 'programmatic_gap', steps: programmaticSteps(purpose),
      checkpoints: [check(2, facts(0, 0, 0, { at: 0, status: 'sampled' })),
        check(3, facts(0, 0, 200, { status: 'unavailable', programmaticAffectedScrollEvents: 1 }))],
      final: facts(0.5, 0, 450, { unavailable: 50, acceptedScrollEvents: 1,
        programmaticAffectedScrollEvents: 1, programmaticContinuityGaps: 1 }),
      note: 'The 200 ms callback combines a known 180 px write and 120 px of unattributed movement. The whole interval is omitted; a new measured 300 px interval remains.' }));
  }
  const pollFirst = [...start(),
    { atMs: 100, kind: 'programmatic_write', target: 'feed', to: 300, purpose: 'effect_adjustment' },
    { atMs: 200, kind: 'sample' },
    { atMs: 300, kind: 'scroll', target: 'feed', to: 300 },
    { atMs: 400, kind: 'scroll', target: 'feed', to: 600 },
    { atMs: 500, kind: 'sample' }];
  scenarios.push(story({ id: 'known_write_sample_before_callback', family: 'programmatic_gap', steps: pollFirst,
    checkpoints: [check(4, facts(0, 0, 300, { acceptedScrollEvents: 0, programmaticContinuityGaps: 1 }))],
    final: facts(0.5, 0, 500, { acceptedScrollEvents: 1, programmaticAffectedScrollEvents: 0,
      programmaticContinuityGaps: 1, unobservedDisplacements: 0 }),
    note: 'A fresh sample measures the written position before its native callback; that callback has zero new displacement. The write time is not reconstructed as exact coverage.' }));

  const reread = [...start(),
    { atMs: 100, kind: 'scroll', target: 'feed', to: 600 }, { atMs: 250, kind: 'sample' },
    { atMs: 400, kind: 'scroll', target: 'feed', to: 300 }, { atMs: 500, kind: 'sample' },
    { atMs: 600, kind: 'scroll', target: 'feed', to: 600 }, { atMs: 750, kind: 'sample' }];
  scenarios.push(story({ id: 'forward_backward_reread', family: 'direction', steps: reread,
    final: facts(1.5, 0.5, 750, { acceptedScrollEvents: 3 }),
    note: 'Forward distance is 900 px and backward distance 300 px; net displacement is 600 px. Neither direction proves reading or new item consumption.' }));

  for (const input of [false, true]) {
    scenarios.push(story({ id: input ? 'long_editor_without_feed_motion' : 'stationary_visible_feed',
      family: 'editor_stationary', initialItems: 12, steps: stationarySteps(180000, { input }),
      final: facts(0, 0, 180000, { acceptedScrollEvents: 0 }),
      note: input ? 'Three minutes of typing, composition and paste preserve visible sampled geometry but supply no feed displacement.'
        : 'Three minutes of stationary geometry provide no evidence about whether the person is reading, thinking, or absent.' }));
    scenarios.push(story({ id: input ? 'editor_with_feed_motion' : 'feed_motion_without_editor',
      family: 'editor_mixed', initialItems: 20, steps: mixedSteps({ input }),
      final: facts(6, 0, 30000, { acceptedScrollEvents: 30 }),
      note: 'Thirty forward 120 px movements total 3600 px across 600 px viewports. Editor events neither create nor erase this physical observation.' }));
  }

  const other = [...start(),
    { atMs: 100, kind: 'scroll', target: 'other', to: 600 }, { atMs: 250, kind: 'sample' },
    { atMs: 300, kind: 'scroll', target: 'feed', to: 300 },
    { atMs: 400, kind: 'programmatic_write', target: 'other', to: 300, purpose: 'effect_adjustment' },
    { atMs: 450, kind: 'scroll', target: 'other', to: 600 }, { atMs: 500, kind: 'sample' },
    { atMs: 600, kind: 'scroll', target: 'feed', to: 600 }, { atMs: 750, kind: 'sample' }];
  scenarios.push(story({ id: 'separate_scrolling_surface', family: 'scroller_ownership', steps: other,
    final: facts(1, 0, 750, { acceptedScrollEvents: 2, nestedOrOutsideScrollEvents: 2,
      programmaticAffectedScrollEvents: 0, programmaticContinuityGaps: 0 }),
    note: 'A separate scroller moves and receives an app write. Its displacement and write revision do not belong to the feed scroller.' }));

  const identities = [...start(),
    { atMs: 100, kind: 'identity_change', itemIndex: 0, nextId: 'revision-a' }, { atMs: 250, kind: 'sample' },
    { atMs: 300, kind: 'identity_change', itemIndex: 0, nextId: 'revision-b' }, { atMs: 500, kind: 'sample' },
    { atMs: 600, kind: 'identity_change', itemIndex: 1, nextId: 'revision-c' }, { atMs: 750, kind: 'sample' },
    { atMs: 800, kind: 'identity_change', itemIndex: 1, nextId: 'revision-c' }, { atMs: 1000, kind: 'sample' }];
  scenarios.push(story({ id: 'stationary_identity_revisions', family: 'identity', steps: identities,
    final: facts(0, 0, 1000, { acceptedScrollEvents: 0, identityDiscontinuities: 3, visibleSetChanges: 3 }),
    note: 'Three item-level identity changes on visible stationary nodes are diagnostics. Reassigning the same identity adds none; identities never establish consumption transitions.' }));

  const restarted = [...start(),
    { atMs: 100, kind: 'scroll', target: 'feed', to: 600 },
    { atMs: 200, kind: 'lifecycle', command: 'stop' },
    { atMs: 500, kind: 'programmatic_write', target: 'feed', to: 1200, purpose: 'effect_adjustment' },
    { atMs: 600, kind: 'scroll', target: 'feed', to: 1800 },
    { atMs: 1000, kind: 'lifecycle', command: 'start' }, { atMs: 1000, kind: 'sample' },
    { atMs: 1100, kind: 'scroll', target: 'feed', to: 2100 }, { atMs: 1250, kind: 'sample' },
    { atMs: 1300, kind: 'lifecycle', command: 'stop' }];
  scenarios.push(story({ id: 'restart_new_epoch', family: 'lifecycle', steps: restarted,
    checkpoints: [check(3, facts(1, 0, 200, { epoch: 1, status: 'stopped' })),
      check(5, facts(1, 0, 200, { epoch: 1, status: 'stopped', at: 200 })),
      check(6, facts(0, 0, 0, { epoch: 2, status: 'unavailable' }))],
    final: facts(0.5, 0, 300, { epoch: 2, status: 'stopped', acceptedScrollEvents: 1 }),
    note: 'Stopping closes epoch 1 at 200 ms. Epoch 2 starts at 1000 ms from the current 1800 px position; stopped time and displacement are not caught up or subtracted as negative counters.' }));

  return deepFreeze({ version: 1, scenarios, relations: [
    { id: 'viewport_pixel_scaling', kind: 'equal_observation_totals',
      scenarioIds: ['physical_path', 'physical_path_half', 'physical_path_large'],
      fields: ['unknownForwardScreenfuls', 'unknownBackwardScreenfuls', 'sampledCoverageMs'],
      claim: 'Scaling all physical lengths together preserves displacement units and sample time.' },
    { id: 'reader_partition', kind: 'reader_partition_observation_equivalence',
      scenarioIds: ['physical_path', 'physical_path_sparse_reader'],
      fields: ['unknownForwardScreenfuls', 'unknownBackwardScreenfuls', 'sampledCoverageMs'],
      claim: 'The sensor facts are identical; pressure timing under sparse collection is diagnostic, with no exact pressure equality claim.' },
    { id: 'mechanical_purpose', kind: 'equal_observation_totals',
      scenarioIds: ['known_write_effect_adjustment', 'known_write_input_assistance'],
      fields: ['unknownForwardScreenfuls', 'unknownBackwardScreenfuls', 'sampledCoverageMs', 'unavailableVisibleMs'],
      claim: 'Both known write purposes close raw displacement continuity. Their legacy policy treatment may differ.' },
    { id: 'stationary_input', kind: 'equal_observation_totals',
      scenarioIds: ['stationary_visible_feed', 'long_editor_without_feed_motion'],
      fields: ['unknownForwardScreenfuls', 'unknownBackwardScreenfuls', 'sampledCoverageMs'],
      claim: 'Editor activity cannot fabricate feed movement.' },
    { id: 'mixed_input', kind: 'equal_observation_totals',
      scenarioIds: ['feed_motion_without_editor', 'editor_with_feed_motion'],
      fields: ['unknownForwardScreenfuls', 'unknownBackwardScreenfuls', 'sampledCoverageMs'],
      claim: 'The same feed movement remains observable while an editor is active.' },
  ], design: { authority: 'visible_development_corpus', pressureOracle: 'none',
    sampling: 'explicit_owner_samples', sparseCapture: 'reader_only',
    coverage: 'bounded_geometry_sample_hold', rawData: 'synthetic_dom_only' } });
}
