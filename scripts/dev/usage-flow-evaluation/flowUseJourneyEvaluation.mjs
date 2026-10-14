const fail = (detail) => { throw new Error(`FLOW_USE_JOURNEY_INVALID:${detail}`); };
const numeric = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const STATES = ['candidate', 'armed', 'opportunityReady', 'admitted', 'endpointActive'];

export function validateFlowUseJourneyInput(input) {
  if (!input || !numeric(input.endMs) || input.endMs < 1 || input.endMs > 3_600_000
    || !Array.isArray(input.steps) || input.steps.length > 20_000) fail('input');
  const f = input.fixture;
  if (!f || typeof f.id !== 'string' || !f.id || !f.viewport || !f.feed) fail('fixture');
  for (const value of [f.viewport.width, f.viewport.height, f.feed.clientHeight,
    f.feed.scrollHeight, f.feed.itemHeight, f.feed.itemCount]) {
    if (!numeric(value) || value <= 0) fail('geometry');
  }
  let previous = 0;
  for (const step of input.steps) {
    if (!step || !numeric(step.atMs) || step.atMs < previous || step.atMs > input.endMs) fail('step_time');
    previous = step.atMs;
    if (step.kind === 'movement') {
      if (!numeric(step.to) || !Number.isSafeInteger(step.appendCount) || step.appendCount < 0
        || !Number.isSafeInteger(step.trimBeforeIndex) || step.trimBeforeIndex < 0) fail('movement');
    } else if (step.kind === 'input') {
      if (!['typing', 'composition', 'paste'].includes(step.mode)
        || !Number.isSafeInteger(step.count) || step.count < 1 || step.count > 100) fail('input_event');
    } else if (step.kind === 'focus') {
      if (typeof step.active !== 'boolean') fail('focus');
    } else if (step.kind === 'visibility') {
      if (typeof step.visible !== 'boolean') fail('visibility');
    } else if (step.kind !== 'tick') fail('step_kind');
  }
}

export function projectFlowUseJourneyFrame({ atMs, snapshot, observation, editorFocused, visible }) {
  if (!numeric(atMs) || snapshot?.version !== 1 || observation?.version !== 1
    || typeof editorFocused !== 'boolean' || typeof visible !== 'boolean') fail('frame');
  const decision = snapshot.feedDecision;
  const optional = (object, key) => object === null ? null : object[key];
  for (const [object, keys] of [[decision, ['armed', 'opportunityReady']],
    [snapshot.admission, ['admitted']], [snapshot.endpoint, ['active']]]) {
    if (object === null) continue;
    if (!object || keys.some((key) => typeof object[key] !== 'boolean')) fail('decision_shape');
  }
  const metrics = decision === null ? null : decision.metrics;
  // The current runtime intentionally has no detector/pressure model. Retain
  // explicit unavailable columns for historical report comparison, not defaults.
  const row = { atMs, candidate: null,
    candidatePressure: null, armed: optional(decision, 'armed'),
    opportunityReady: optional(decision, 'opportunityReady'), admitted: snapshot.admission.admitted,
    endpointActive: snapshot.endpoint.active,
    dose: null, legacyScreenfuls: optional(metrics, 'screenfulsConsumed'),
    episodeActiveMs: null,
    inhibitors: optional(decision, 'inhibitors'), readiness: decision === null ? null : decision.readiness.status,
    safety: decision === null ? null : decision.actuationSafety.status,
    safetyReasons: decision === null ? null : [...decision.actuationSafety.reasons],
    blockers: [...snapshot.admission.reasons], endpointReasons: [...snapshot.endpoint.resolutionReasons],
    editorFocused, visible,
    sensor: { status: observation.status, reason: observation.reason,
      window: observation.geometry === null ? null : structuredClone(observation.geometry.window),
      forward: observation.unknownForwardScreenfuls, backward: observation.unknownBackwardScreenfuls,
      sampledCoverageMs: observation.sampledCoverageMs, unavailableVisibleMs: observation.unavailableVisibleMs,
      unsupportedVisibleMs: observation.unsupportedVisibleMs, hiddenMs: observation.hiddenMs,
      itemHoldMs: observation.itemObservation.sampledHoldMs,
      itemSetChanges: observation.itemObservation.sampledSetChanges,
      itemReentries: observation.itemObservation.reentryObservations } };
  for (const key of ['candidatePressure', 'dose', 'legacyScreenfuls', 'episodeActiveMs']) {
    if (row[key] !== null && !numeric(row[key])) fail(`metric:${key}`);
  }
  if (Object.values(row.sensor).some((value) => typeof value === 'number' && !numeric(value))) fail('sensor_metric');
  return structuredClone(row);
}

export function assessFlowUseJourney({ rows, completion }, expected) {
  if (!Array.isArray(rows) || rows.length === 0) fail('rows');
  let previous = -1;
  for (const row of rows) {
    if (!numeric(row.atMs) || row.atMs < previous || STATES.some((key) => ![true, false, null].includes(row[key]))) fail('row');
    previous = row.atMs;
  }
  if (!completion || typeof completion.censored !== 'boolean' || completion.atMs !== rows.at(-1).atMs) fail('completion');
  const first = Object.fromEntries(STATES.map((key) => [key, rows.find((row) => row[key] === true)?.atMs ?? null]));
  const preparationTimes = ['opportunityReady', 'admitted', 'endpointActive'].map((key) => first[key]).filter((at) => at !== null);
  const firstPreparationAt = preparationTimes.length ? Math.min(...preparationTimes) : null;
  const rule = expected.preparation;
  if (!Array.isArray(expected.observableDescription) || !Array.isArray(expected.forbiddenClaims)
    || !rule || (rule.kind === 'withhold' && (!numeric(rule.fromMs) || !numeric(rule.untilMs) || rule.untilMs < rule.fromMs))
    || (rule.kind === 'window' && (!numeric(rule.earliestMs) || !numeric(rule.latestMs) || rule.latestMs < rule.earliestMs))) fail('expectation');
  let preparation;
  if (rule.kind === 'withhold') {
    const violation = rows.find((row) => row.atMs >= rule.fromMs && row.atMs <= rule.untilMs
      && (row.opportunityReady === true || row.admitted === true || row.endpointActive === true));
    preparation = { status: violation ? 'finding' : completion.atMs < rule.untilMs ? 'not_evaluable' : 'satisfied',
      reason: violation ? 'preparation_in_protected_flow' : completion.atMs < rule.untilMs
        ? 'observation_ended_before_protected_window_end' : 'no_preparation_observed',
      firstViolationAt: violation?.atMs ?? null };
  } else if (rule.kind === 'window') {
    preparation = { status: firstPreparationAt === null || firstPreparationAt < rule.earliestMs
      || firstPreparationAt > rule.latestMs ? 'finding' : 'satisfied',
    reason: firstPreparationAt === null ? 'opportunity_not_observed'
      : firstPreparationAt < rule.earliestMs ? 'earlier_than_review_window'
        : firstPreparationAt > rule.latestMs ? 'later_than_review_window' : 'within_review_window' };
  } else fail('preparation_rule');
  return { first, firstPreparationAt, preparation,
    delivery: { status: first.endpointActive !== null ? 'endpoint_observed'
      : first.admitted !== null ? 'endpoint_unobserved_after_admission' : 'not_admitted',
    observedAfterFirstAdmissionMs: first.admitted === null ? null : completion.atMs - first.admitted },
    interpretation: { status: 'unsupported', reason: 'production_dto_has_no_temporal_usage_pattern_output',
      requestedDescriptions: [...expected.observableDescription], forbiddenClaims: [...expected.forbiddenClaims] },
    observation: { endAtMs: completion.atMs, censoredAtFirstEndpoint: completion.censored,
      decisionAvailableFrames: rows.filter((row) => row.armed !== null).length, frameCount: rows.length,
      noFeedDisplacementObserved: rows.at(-1).sensor.forward === 0 && rows.at(-1).sensor.backward === 0,
      finalSensor: rows.at(-1).sensor },
    terminal: rows.at(-1) };
}

export function assessFlowUseJourneyRelations(reports, relations) {
  return relations.map((relation) => {
    const selected = relation.scenarioIds.map((id) => reports.find((report) => report.id === id));
    if (selected.some((report) => !report || report.execution !== 'valid')) fail('relation_inputs');
    if (relation.kind === 'identical_observations') {
      const equal = selected.every((report) => JSON.stringify(report.rows) === JSON.stringify(selected[0].rows));
      return { ...relation, status: equal ? 'satisfied' : 'finding',
        reason: equal ? 'same_input_same_decision_timeline' : 'identical_input_timeline_diverged' };
    }
    if (relation.kind !== 'structure_diagnostic') fail('relation_kind');
    return { ...relation, status: 'diagnostic',
      note: 'Different DOM history changes observable support; no exact classifier equality is assumed.',
      outputs: selected.map((report) => ({ id: report.id, first: report.assessment.first,
        observation: report.assessment.observation })) };
  });
}
