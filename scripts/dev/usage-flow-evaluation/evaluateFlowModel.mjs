// Evaluation policy only. No metric, oracle, or refinement result is runtime input.
import {
  FLOW_MODEL_REFINEMENT_STEPS,
  compareFlowTrajectories,
  diagnoseFlowProbes,
  selectLastFlowAdvance,
} from './flowModelDiagnostics.mjs';

const CONTINUOUS_METRICS = ['episodeDose', 'decisionDose', 'confidence', 'loopScore'];
const COMPARED_METRICS = [
  ...CONTINUOUS_METRICS, 'episodeActiveMs', 'decisionEpisodeActiveMs',
  'seamRequiredGapMs', 'seamWaitedMs', 'state', 'armed', 'opportunityReady',
];

function requireCondition(condition, detail) {
  if (!condition) throw new Error(`FLOW_MODEL_EVALUATION_INVALID:${detail}`);
}

export function validateFlowModelCorpus(corpus) {
  requireCondition(corpus?.version === 1, 'corpus_version');
  requireCondition(Array.isArray(corpus.scenarios) && corpus.scenarios.length > 0, 'scenarios_required');
  requireCondition(Array.isArray(corpus.relations) && corpus.relations.length > 0, 'relations_required');
  requireCondition(Array.isArray(corpus.probes), 'probes_required');
  const ids = new Set();
  for (const scenario of corpus.scenarios) {
    requireCondition(typeof scenario.id === 'string' && scenario.id.length > 0 && !ids.has(scenario.id), 'scenario_id');
    ids.add(scenario.id);
    requireCondition(typeof scenario.family === 'string' && ['development', 'held_out'].includes(scenario.split), 'scenario_metadata');
    requireCondition(scenario.trace && scenario.oracle, 'trace_and_oracle_required');
  }
  const relationIds = new Set();
  for (const relation of corpus.relations) {
    requireCondition(typeof relation.id === 'string' && !relationIds.has(relation.id), 'relation_id');
    relationIds.add(relation.id);
    requireCondition(ids.has(relation.left) && ids.has(relation.right), 'relation_reference');
    requireCondition(['invariant', 'hypothesis'].includes(relation.claim)
      && ['equal_model_output', 'diagnostic_only'].includes(relation.expectation)
      && Array.isArray(relation.requiredChannels), 'relation_contract');
  }
  const probeIds = new Set();
  for (const probe of corpus.probes) {
    requireCondition(typeof probe.id === 'string' && !probeIds.has(probe.id), 'probe_id');
    probeIds.add(probe.id);
    requireCondition(Array.isArray(probe.values) && probe.values.length >= 2
      && probe.values.length === probe.scenarioIds?.length, 'probe_values');
    probe.values.forEach((value, index) => requireCondition(Number.isFinite(value)
      && (index === 0 || value > probe.values[index - 1])
      && ids.has(probe.scenarioIds[index]), 'probe_order_or_reference'));
  }
}

function validateOutput(output, trace) {
  requireCondition(Array.isArray(output?.curve) && output.curve.length === trace.events.length + 2
    && output.terminal && typeof output.terminal === 'object', 'model_curve');
  const validChannels = (channels) => Array.isArray(channels)
    && channels.every((channel) => typeof channel === 'string' && channel.length > 0)
    && new Set(channels).size === channels.length;
  requireCondition(validChannels(output.representedChannels) && validChannels(output.unrepresentedChannels)
    && !output.representedChannels.some((channel) => output.unrepresentedChannels.includes(channel))
    && Array.isArray(output.supplyProbes), 'model_coverage');
  const boundaries = [
    { at: trace.startMs, eventIndex: -1, eventKind: 'start', observationKind: 'reconcile' },
    ...trace.events.map((event, eventIndex) => ({ at: event.at, eventIndex, eventKind: event.kind,
      observationKind: event.kind === 'advance' && event.direction === 'forward' ? 'advance' : 'reconcile' })),
    { at: trace.endMs, eventIndex: trace.events.length, eventKind: 'end', observationKind: 'reconcile' },
  ];
  let previousAt = trace.startMs;
  output.curve.forEach((row, index) => {
    requireCondition(row && typeof row === 'object' && !Array.isArray(row), 'model_row');
    for (const metric of COMPARED_METRICS) {
      if (metric === 'state') requireCondition(['none', 'pressure', 'interrupt'].includes(row[metric]), `model_${metric}`);
      else if (['armed', 'opportunityReady'].includes(metric)) requireCondition(typeof row[metric] === 'boolean', `model_${metric}`);
      else requireCondition(typeof row[metric] === 'number' && Number.isFinite(row[metric])
        && row[metric] >= 0, `model_${metric}`);
    }
    requireCondition(row.confidence <= 1 && row.loopScore <= 1, 'model_normalized_metric');
    requireCondition(Number.isFinite(row.at) && row.at >= previousAt
      && row.at >= trace.startMs && row.at <= trace.endMs, 'model_time');
    previousAt = row.at;
    requireCondition(Object.entries(boundaries[index]).every(([key, value]) => row[key] === value), 'model_event_boundary');
    requireCondition(Object.values(row).every((value) => typeof value !== 'number' || Number.isFinite(value)), 'model_non_finite_value');
  });
  const finalRow = output.curve.at(-1);
  const terminalKeys = Object.keys(output.terminal);
  requireCondition(terminalKeys.length === Object.keys(finalRow).length
    && terminalKeys.every((key) => Object.hasOwn(finalRow, key)
      && (Array.isArray(finalRow[key])
        ? Array.isArray(output.terminal[key]) && finalRow[key].length === output.terminal[key].length
          && finalRow[key].every((value, index) => value === output.terminal[key][index])
        : finalRow[key] === output.terminal[key])), 'model_terminal');
  const expectedSupplyEvents = trace.surfaceMode === 'continuous'
    ? trace.events.map((event, index) => ({ event, index })).filter(({ event }) => event.kind === 'supply')
    : [];
  requireCondition(output.supplyProbes.length === expectedSupplyEvents.length, 'model_supply_probe_count');
  output.supplyProbes.forEach((probe, index) => {
    const expected = expectedSupplyEvents[index];
    requireCondition(probe && typeof probe === 'object' && !Array.isArray(probe)
      && probe.at === expected.event.at && probe.eventIndex === expected.index
      && probe.suppliedItems === expected.event.count && Number.isSafeInteger(probe.suppliedItems)
      && probe.suppliedItems >= 0 && probe.recentGesture === false
      && typeof probe.emittedAdvanceCandidate === 'boolean', 'model_supply_probe');
    for (const key of ['screenfulDelta', 'itemTransitionCount', 'freshItemsSeen', 'confidence']) {
      requireCondition(probe.emittedAdvanceCandidate
        ? typeof probe[key] === 'number' && Number.isFinite(probe[key]) && probe[key] >= 0
        : probe[key] === null, `model_supply_${key}`);
    }
    if (probe.emittedAdvanceCandidate) {
      requireCondition(Number.isSafeInteger(probe.itemTransitionCount)
        && Number.isSafeInteger(probe.freshItemsSeen) && probe.confidence <= 1, 'model_supply_candidate');
    }
  });
  return output;
}

const select = (row) => row === null ? null : Object.fromEntries(COMPARED_METRICS.map((key) => [key, row[key]]));

export function evaluateFlowModelCorpus({ corpus, replayTrace }) {
  validateFlowModelCorpus(corpus);
  requireCondition(typeof replayTrace === 'function', 'replay_required');
  let replayCount = 0;
  const replay = (trace) => {
    replayCount += 1;
    // This is the only model call seam. Metadata and evaluation output cannot
    // flow back into the model, even when refining a counterexample.
    return validateOutput(replayTrace(structuredClone(trace)), trace);
  };
  const records = new Map();
  const scenarios = corpus.scenarios.map((scenario) => {
    const output = replay(scenario.trace);
    records.set(scenario.id, { trace: scenario.trace, output, split: scenario.split });
    return {
      id: scenario.id, family: scenario.family, split: scenario.split,
      evidence: output.evidence, scope: output.scope,
      representedChannels: output.representedChannels, unrepresentedChannels: output.unrepresentedChannels,
      lastAdvance: select(selectLastFlowAdvance(output)), terminal: select(output.terminal),
      observedStates: [...new Set(output.curve.map((row) => row.state))],
      oracleReview: scenario.oracle,
    };
  });
  const relations = corpus.relations.map((relation) => {
    const left = records.get(relation.left);
    const right = records.get(relation.right);
    const unsupported = relation.requiredChannels.filter((channel) =>
      !left.output.representedChannels.includes(channel) || !right.output.representedChannels.includes(channel)
      || left.output.unrepresentedChannels.includes(channel) || right.output.unrepresentedChannels.includes(channel));
    const changedPoints = compareFlowTrajectories(left.output, right.output, left.trace, right.trace, COMPARED_METRICS);
    return {
      ...relation, split: left.split === right.split ? left.split : 'mixed',
      status: unsupported.length > 0 ? 'unsupported' : relation.expectation === 'diagnostic_only' ? 'diagnostic'
        : changedPoints.length === 0 ? 'satisfied'
        : relation.claim === 'invariant' ? 'violated' : 'review',
      unsupportedChannels: unsupported, changedPoints,
      endpoints: {
        left: { lastAdvance: select(selectLastFlowAdvance(left.output)), terminal: select(left.output.terminal) },
        right: { lastAdvance: select(selectLastFlowAdvance(right.output)), terminal: select(right.output.terminal) },
      },
    };
  });
  const probes = diagnoseFlowProbes({
    probes: corpus.probes, records, replay, metrics: CONTINUOUS_METRICS,
    discreteMetrics: ['state', 'armed', 'opportunityReady'],
  });
  const supplyCandidates = [...records].flatMap(([id, { output }]) => output.supplyProbes
    .filter((probe) => probe.emittedAdvanceCandidate)
    .map((probe) => ({ scenarioId: id, ...probe })));
  const relationCounts = Object.fromEntries(['satisfied', 'violated', 'review', 'unsupported', 'diagnostic']
    .map((status) => [status, relations.filter((relation) => relation.status === status).length]));
  const persistentJumps = probes.flatMap((probe) => probe.diagnostics
    .filter((diagnostic) => diagnostic.status === 'persistent_local_jump')
    .map((diagnostic) => ({ probeId: probe.id, parameter: probe.parameter, ...diagnostic })));
  const findings = relationCounts.violated + relationCounts.review + persistentJumps.length + (supplyCandidates.length > 0 ? 1 : 0);
  return {
    contractVersion: 'flow-model-evaluation-v1',
    execution: 'complete', status: findings > 0 ? 'findings' : 'no_findings_in_evaluated_scope',
    design: corpus.design,
    summary: {
      scenarios: scenarios.length,
      splits: Object.fromEntries(['development', 'held_out'].map((split) => [split, scenarios.filter((scenario) => scenario.split === split).length])),
      families: new Set(scenarios.map((scenario) => scenario.family)).size,
      relations: relationCounts, persistentJumpDiagnostics: persistentJumps.length,
      isolatedSupplyCandidates: supplyCandidates.length,
      noConfirmedAdvanceScenarios: scenarios.filter((scenario) => scenario.lastAdvance === null).length,
      replayCount,
    },
    scenarios, relations, probes, persistentJumps,
    supply: {
      status: supplyCandidates.length > 0 ? 'candidate_stage_review' : 'no_candidate_in_isolated_probes',
      candidates: supplyCandidates,
      inferenceLimit: 'An isolated adapter candidate is not a confirmed consumption event or an admitted intervention. Coordinator admission is not replayed.',
    },
    interpretation: {
      intentAccuracy: 'not_identifiable_from_fictional_narratives',
      oracleProse: 'review_only_not_automatically_scored',
      holdout: 'public_distinct_recipes_no_policy_fitted_in_baseline; promote_used_recipes_to_development_before_next_tuning',
      continuousNovelty: 'unmeasured; continuous arming negatives do not validate intervention policy',
      unsupportedChannels: 'not_counted_as_satisfied_or_as_behavioral_errors',
      refinement: `All nonzero adjacent continuous-output changes refined ${FLOW_MODEL_REFINEMENT_STEPS} times; nonlinear interpolation is limited to matching event shapes. Persistent flags require >=25% jump retention and >=0.1% of endpoint scale, solely for diagnostic review.`,
      discreteChanges: 'reported_separately_not_automatically_defects',
    },
  };
}
