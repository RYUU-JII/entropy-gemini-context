// Metadata only: CLIs load these manifests before importing model/evaluator
// code, then verify the same bytes again before publishing a successful report.
// Keep this file in every closure so manifest changes also invalidate a run.
const MANIFEST = 'scripts/dev/usage-flow-evaluation/flowEvaluationSources.mjs';
const SNAPSHOT = 'scripts/dev/usage-flow-evaluation/flowEvaluationSourceSnapshot.mjs';
const union = (...groups) => Object.freeze([...new Set(groups.flat())]);

// Complete direct/transitive source closure for the confirmed-advance replay.
// This does not claim coverage of surrounding live observation or actuation.
export const CURRENT_FLOW_MODEL_SOURCE_FILES = Object.freeze([
    'scripts/dev/usage-flow-evaluation/currentFlowModelReplay.mjs',
    'scripts/dev/usage-flow-evaluation/flowModelTraceContract.mjs',
    'src/domains/nudge/feed-flow/session/FeedBurstMachine.js',
    'src/domains/nudge/feed-flow/judge/FeedFlowJudge.js',
    'src/domains/nudge/feed-flow/judge/FeedHorizonSeamGate.js',
    'scripts/dev/enso-model-research/legacy-feed/ensoFeedHorizonRuntimeConfig.js',
    'src/domains/nudge/feed-flow/contracts/feedFlowLoopSignals.js',
    'src/domains/nudge/feed-flow/confirm/ContinuousAdvanceAdapter.js',
    MANIFEST,
]);

export const FLOW_CANDIDATE_SOURCE_FILES = Object.freeze([
    'scripts/dev/usage-flow-evaluation/continuousFlowCandidate.mjs',
    'scripts/dev/usage-flow-evaluation/flowModelTraceContract.mjs',
    MANIFEST,
]);

export const FLOW_BASELINE_SOURCE_FILES = union(CURRENT_FLOW_MODEL_SOURCE_FILES, [
    'scripts/dev/usage-flow-evaluation/flowModelScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/evaluateFlowModel.mjs',
    'scripts/dev/usage-flow-evaluation/flowModelDiagnostics.mjs',
    'scripts/dev/usage-flow-evaluation/runFlowModel.mjs',
    SNAPSHOT,
]);

export const FLOW_COMPARISON_SOURCE_FILES = union(CURRENT_FLOW_MODEL_SOURCE_FILES, FLOW_CANDIDATE_SOURCE_FILES, [
    'scripts/dev/usage-flow-evaluation/flowModelScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowCandidateScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/evaluateFlowModel.mjs',
    'scripts/dev/usage-flow-evaluation/flowModelDiagnostics.mjs',
    'scripts/dev/usage-flow-evaluation/compareFlowCandidates.mjs',
    'scripts/dev/usage-flow-evaluation/runFlowComparison.mjs',
    'scripts/dev/usage-flow-evaluation/flowCandidateRecoveryAudit.mjs',
    SNAPSHOT,
]);
