import { isDeepStrictEqual } from 'node:util';
import { validateFlowModelCorpus } from './evaluateFlowModel.mjs';
import { validateFlowModelTrace } from './flowModelTraceContract.mjs';
import {
  compareFlowTrajectories, diagnoseFlowProbes, selectLastFlowAdvance,
} from './flowModelDiagnostics.mjs';

const requireCondition = (condition, detail) => {
  if (!condition) throw new Error(`FLOW_CANDIDATE_COMPARISON_INVALID:${detail}`);
};

export function createFlowComparisonCorpus(baseline, challenge, { challengeUse = 'initial_evaluation' } = {}) {
  validateFlowModelCorpus(baseline);
  validateFlowModelCorpus(challenge);
  const developmentFamilies = new Set(baseline.scenarios.map((scenario) => scenario.family));
  requireCondition(challenge.scenarios.every((scenario) => scenario.split === 'held_out'
    && !developmentFamilies.has(scenario.family)), 'fresh_recipe_families_required');
  requireCondition(['initial_evaluation', 'reused_for_selection'].includes(challengeUse), 'challenge_use');
  const corpus = {
    version: 1,
    scenarios: [
      ...baseline.scenarios.map((scenario) => ({ ...scenario, split: 'development',
        priorSplit: scenario.split, evaluationOrigin: 'inspected_phase_one' })),
      ...challenge.scenarios.map((scenario) => ({ ...scenario,
        split: challengeUse === 'reused_for_selection' ? 'development' : scenario.split,
        priorSplit: scenario.split, evaluationOrigin: 'phase_two_challenge_recipe' })),
    ],
    relations: [...baseline.relations, ...challenge.relations],
    probes: [...baseline.probes, ...challenge.probes],
    design: { baseline: baseline.design, challenge: challenge.design, challengeUse,
      splitPolicy: 'Phase-two recipes were independently authored and frozen before the initial comparison. Once used for selection they are explicitly promoted to development, including when selection follows a structural audit.' },
  };
  validateFlowModelCorpus(corpus);
  return corpus;
}

function validateReplay(output, trace, model) {
  requireCondition(Array.isArray(output?.curve) && output.curve.length === trace.events.length + 2, 'curve');
  const expected = [
    { at: trace.startMs, eventIndex: -1, eventKind: 'start', observationKind: 'reconcile' },
    ...trace.events.map((event, eventIndex) => ({ at: event.at, eventIndex, eventKind: event.kind,
      observationKind: event.kind === 'advance' && event.direction === 'forward' ? 'advance' : 'reconcile' })),
    { at: trace.endMs, eventIndex: trace.events.length, eventKind: 'end', observationKind: 'reconcile' },
  ];
  output.curve.forEach((row, index) => {
    requireCondition(row && Object.entries(expected[index]).every(([key, value]) => row[key] === value), 'event_boundary');
    requireCondition(typeof row[model.metric] === 'number' && Number.isFinite(row[model.metric])
      && row[model.metric] >= 0, 'finite_model_metric');
    requireCondition(Object.values(row).every((value) => typeof value !== 'number' || Number.isFinite(value)), 'finite_output_fields');
    if (model.upperBound !== null) requireCondition(row[model.metric] <= model.upperBound, 'model_bound');
  });
  const terminal = output.curve.at(-1);
  requireCondition(isDeepStrictEqual(output.terminal, terminal), 'terminal');
  requireCondition(output.curve[0][model.metric] === 0, 'empty_initial_memory');
  const validChannels = (channels) => Array.isArray(channels)
    && channels.every((channel) => typeof channel === 'string' && channel.length > 0)
    && channels.length === new Set(channels).size;
  requireCondition(validChannels(output.representedChannels) && validChannels(output.unrepresentedChannels), 'channels');
  requireCondition(!output.representedChannels.some((channel) => output.unrepresentedChannels.includes(channel)), 'conflicting_channels');
  return output;
}

function responseSentinels(replay, metric) {
  // Directional mechanism requirements, not behavioral labels or fitted scores.
  // Keep the same seed and timestamps while changing confirmed native mass.
  const trace = (mass, endMs) => ({ version: 1, surfaceMode: 'continuous', startMs: 1000, endMs,
    events: [{ at: 1000, kind: 'advance', direction: 'forward', screenfuls: 0.25,
      itemTransitions: 0, quality: 1, source: 'user' },
    { at: 2000, kind: 'advance', direction: 'forward', screenfuls: mass,
      itemTransitions: 0, quality: 1, source: 'user' }] });
  const low = replay(trace(0.2, 2010));
  const high = replay(trace(0.4, 2010));
  const aged = replay(trace(0.4, 1_802_000));
  const quiet = replay({ version: 1, surfaceMode: 'continuous', startMs: 1000, endMs: 10_000,
    events: [{ at: 2000, kind: 'input', mode: 'typing' }] });
  return [
    { id: 'positive_confirmed_mass_has_response', passed: high.terminal[metric] > 0,
      values: [high.terminal[metric]] },
    { id: 'different_confirmed_mass_is_distinguishable', passed: high.terminal[metric] > low.terminal[metric],
      values: [low.terminal[metric], high.terminal[metric]] },
    { id: 'silence_can_reduce_retained_memory', passed: aged.terminal[metric] < high.terminal[metric],
      values: [high.terminal[metric], aged.terminal[metric]] },
    { id: 'input_without_advancement_adds_no_feed_memory', passed: quiet.curve.every((row) => row[metric] === 0),
      values: quiet.curve.map((row) => row[metric]) },
  ];
}

function evaluateModel(model, corpus) {
  let replayCount = 0;
  const replay = (trace) => {
    validateFlowModelTrace(trace);
    replayCount += 1;
    // Only facts cross this call. IDs, split, comparisons and oracle prose stay
    // in the evaluator, including adaptively selected continuity inputs.
    return validateReplay(model.replay(structuredClone(trace)), trace, model);
  };
  const records = new Map();
  const scenarios = corpus.scenarios.map((scenario) => {
    const output = replay(scenario.trace);
    records.set(scenario.id, { trace: scenario.trace, output, split: scenario.split });
    const last = selectLastFlowAdvance(output);
    return { id: scenario.id, family: scenario.family, split: scenario.split,
      lastAdvanceValue: last === null ? null : last[model.metric], terminalValue: output.terminal[model.metric],
      peakValue: Math.max(...output.curve.map((row) => row[model.metric])),
      representedChannels: output.representedChannels, unrepresentedChannels: output.unrepresentedChannels };
  });
  const relations = corpus.relations.map((relation) => {
    const a = records.get(relation.left);
    const b = records.get(relation.right);
    const unsupportedChannels = relation.requiredChannels.filter((channel) =>
      !a.output.representedChannels.includes(channel) || !b.output.representedChannels.includes(channel)
      || a.output.unrepresentedChannels.includes(channel) || b.output.unrepresentedChannels.includes(channel));
    const changedPoints = compareFlowTrajectories(a.output, b.output, a.trace, b.trace, [model.metric]);
    return { id: relation.id, dimension: relation.dimension, claim: relation.claim,
      expectation: relation.expectation, split: a.split === b.split ? a.split : 'mixed',
      status: unsupportedChannels.length > 0 ? 'unsupported'
        : relation.expectation === 'diagnostic_only' ? 'diagnostic'
          : changedPoints.length === 0 ? 'satisfied' : relation.claim === 'invariant' ? 'violated' : 'review',
      unsupportedChannels, changedPoints,
      terminalValues: [a.output.terminal[model.metric], b.output.terminal[model.metric]],
      terminalAbsoluteDifference: Math.abs(a.output.terminal[model.metric] - b.output.terminal[model.metric]),
    };
  });
  const probes = diagnoseFlowProbes({ probes: corpus.probes, records, replay, metrics: [model.metric] });
  const persistentJumps = probes.flatMap((probe) => probe.diagnostics
    .filter((diagnostic) => diagnostic.status === 'persistent_local_jump')
    .map((diagnostic) => ({ probeId: probe.id, parameter: probe.parameter, ...diagnostic })));
  const relationCounts = Object.fromEntries(['satisfied', 'violated', 'review', 'unsupported', 'diagnostic']
    .map((status) => [status, relations.filter((relation) => relation.status === status).length]));
  const positiveScenarios = scenarios.filter((scenario) => scenario.peakValue > 0).length;
  const sentinels = responseSentinels(replay, model.metric);
  const firstOutput = records.values().next().value.output;
  return {
    id: model.id, role: model.role, metric: model.metric, unit: model.unit, config: model.config,
    scope: firstOutput.scope,
    summary: { scenarios: scenarios.length, relationCounts, persistentJumpDiagnostics: persistentJumps.length,
      positiveScenarios, replayCount, failedResponseSentinels: sentinels.filter((sentinel) => !sentinel.passed).length,
      unrefinableProbeDiagnostics: probes.flatMap((probe) => probe.diagnostics).filter((diagnostic) => diagnostic.status === 'not_refinable').length },
    splits: Object.fromEntries(['development', 'held_out'].map((split) => [split, {
      scenarios: scenarios.filter((scenario) => scenario.split === split).length,
      relations: Object.fromEntries(Object.keys(relationCounts).map((status) => [status,
        relations.filter((relation) => relation.split === split && relation.status === status).length])),
    }])),
    scenarios, relations, probes, persistentJumps, responseSentinels: sentinels,
  };
}

export function compareFlowCandidates({ corpus, models }) {
  validateFlowModelCorpus(corpus);
  requireCondition(Array.isArray(models) && models.length >= 2, 'models_required');
  requireCondition(new Set(models.map((model) => model.id)).size === models.length, 'model_ids');
  for (const model of models) {
    requireCondition(typeof model.id === 'string' && typeof model.replay === 'function'
      && typeof model.metric === 'string' && typeof model.unit === 'string'
      && ['reference', 'control', 'candidate', 'sensitivity'].includes(model.role), 'model_contract');
    requireCondition(model.upperBound === null || (Number.isFinite(model.upperBound) && model.upperBound > 0), 'model_upper_bound');
  }
  requireCondition(models.filter((model) => model.role === 'candidate').length === 1, 'one_primary_candidate_required');
  const results = models.map((model) => evaluateModel(model, corpus));
  const candidateResults = results.filter((model) => model.role === 'candidate' || model.role === 'sensitivity');
  const unresolved = candidateResults.some((model) => model.summary.relationCounts.violated > 0
    || model.summary.relationCounts.review > 0 || model.summary.persistentJumpDiagnostics > 0
    || model.summary.failedResponseSentinels > 0);
  return {
    contractVersion: 'flow-candidate-comparison-v1', execution: 'complete',
    status: unresolved ? 'candidate_findings' : 'ready_for_integration_evaluation',
    scope: 'pressure_memory_candidate_comparison_no_runtime_cutover_no_intent_classifier',
    design: corpus.design,
    summary: { scenarios: corpus.scenarios.length,
      development: corpus.scenarios.filter((scenario) => scenario.split === 'development').length,
      heldOut: corpus.scenarios.filter((scenario) => scenario.split === 'held_out').length,
      models: models.length, families: new Set(corpus.scenarios.map((scenario) => scenario.family)).size },
    models: results,
    oracleReview: corpus.scenarios.map(({ id, oracle }) => ({ id, oracle })),
    limitations: [
      'The reference uses its own accumulated dose unit; candidates use bounded pressure. Absolute values and lower scores are not accuracy comparisons.',
      'No candidate emits an intent class, admission decision, or visible effect. Forward events are already confirmed facts at this seam.',
      'Provenance, visibility, actual writing context and novelty remain outside this pressure replay. Full input/supply relations stay unsupported.',
      'Adding input/supply read timestamps tests pressure-memory clock invariance only, not full channel integration.',
      'Different observation times discard temporal information. Temporal rebinning is diagnostic; no exact-equality claim or universal error tolerance is imposed.',
      'Continuity probes whose event shapes differ cannot be refined. They are not counted as continuity passes.',
      'The initial parameter set preceded challenge execution. Structural review selected an already-tested lower curvature; all inspected challenges are now development evidence, with no unseen-validation claim.',
    ],
  };
}
