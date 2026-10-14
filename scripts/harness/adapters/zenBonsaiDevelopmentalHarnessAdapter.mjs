import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  DEVELOPMENTAL_CONSERVED_AXIS_RESOURCE_PLAN_VERSION,
  DEVELOPMENTAL_AXIS_RESOURCE_PLAN_CONTRACT,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/axisResourceContract.mjs';
import {
  requireDevelopmentalCompiledStructuralAxisGraph,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/compileGraph.mjs';
import {
  DEVELOPMENTAL_ACTIVE_GROWTH_REQUEST_VERSION,
  DEVELOPMENTAL_ACTIVE_TREE_VERSION,
  DEVELOPMENTAL_GROWTH_REQUEST_CONTRACT,
  DEVELOPMENTAL_TREE_CONTRACT,
  requireDevelopmentalTree,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/contracts.mjs';
import {
  DEVELOPMENTAL_COVERAGE_DESCRIPTOR_CONTRACT,
  DEVELOPMENTAL_COVERAGE_DESCRIPTOR_VERSION,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/coverageDescriptor.mjs';
import {
  DEVELOPMENTAL_CANONICAL_ACTIVE_GROWTH_CYCLES,
  DEVELOPMENTAL_CANONICAL_SETTLING_CYCLES,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/developmentPhase.mjs';
import {
  DEVELOPMENTAL_CANDIDATE_EVIDENCE_CONTRACT,
  DEVELOPMENTAL_CANDIDATE_EVIDENCE_VERSION,
  requireDevelopmentalCandidateEvidence,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/evidence.mjs';
import {
  DEVELOPMENTAL_CORE_EVALUATION_CONTRACT,
  DEVELOPMENTAL_CORE_EVALUATION_VERSION,
  requireDevelopmentalCoreEvaluation,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/evaluation.mjs';
import {
  DEVELOPMENTAL_GROWTH_POLICY_CONTRACT,
  DEVELOPMENTAL_GROWTH_POLICY_VERSION,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/growthPolicy.mjs';
import {
  createDevelopmentalGrowthCohort,
  DEVELOPMENTAL_GROWTH_COHORT_CONTRACT,
  DEVELOPMENTAL_GROWTH_COHORT_VERSION,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/pipeline.mjs';
import {
  DEVELOPMENTAL_STRUCTURAL_NORMALITY_CONTRACT,
  DEVELOPMENTAL_STRUCTURAL_NORMALITY_VERSION,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/structuralNormalityAssessment.mjs';
import {
  DEVELOPMENTAL_STRUCTURAL_OBSERVATION_FACTS_CONTRACT,
  DEVELOPMENTAL_STRUCTURAL_OBSERVATION_FACTS_VERSION,
} from '../../dev/zen-bonsai-morphology-research/successor/developmental/structuralObservationFacts.mjs';
import {
  STRUCTURAL_AXIS_GRAPH_CONTRACT,
  STRUCTURAL_AXIS_GRAPH_VERSION,
} from '../../dev/zen-bonsai-morphology-research/successor/graph/contracts.mjs';
import {
  deriveUint32Seed,
} from '../../dev/zen-bonsai-morphology-research/successor/synthesis/random.mjs';
import {
  cloneProjectHarnessJsonData,
  createProjectHarnessPlanDigest,
  createProjectHarnessPlanEnvelope,
  createProjectHarnessResultEnvelope,
  normalizeProjectHarnessPlanDigest,
  normalizeProjectHarnessRequest,
  PROJECT_HARNESS_INTELLIGENCE_POLICY,
  PROJECT_HARNESS_RUNTIME_REVISION,
} from '../contracts/projectHarnessEnvelope.mjs';

export const ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID =
  'zen-bonsai-developmental';
export const ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION =
  'zen-bonsai-developmental-adapter@1';
export const ZEN_BONSAI_DEVELOPMENTAL_TARGET_ID =
  'bonsai/developmental/one-proposal-smoke';
export const ZEN_BONSAI_DEVELOPMENTAL_MODE = 'developmental_smoke';
export const ZEN_BONSAI_DEVELOPMENTAL_PRESET =
  'active-v10-one-proposal-v1';

const RESOURCE_CLAIM =
  'runtime:zen-bonsai-developmental-one-proposal';
const ESTIMATED_SECONDS = 5;
const GENERATION_OWNER =
  'self_organizing_axis_bud_growth_v16_phase_establishment';
const DIAGNOSTIC_REVIEW_REASON =
  'ZEN_BONSAI_DEVELOPMENTAL_DIAGNOSTIC_REVIEW';
const EXPECTED_ARTIFACT_NAMES = Object.freeze([
  'candidate.json',
  'manifest.json',
  'result.json',
]);

export const ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE = Object.freeze({
  seed: 548,
  kernelMode: 'physiological_v2',
  trainingPlanMode: 'combined',
  compositionFieldMode: 'none',
  lateralAllocationMode: 'history_aware_support_v3',
  axisResourceMode: 'hierarchical_conserved_meristem_v10',
  cohortSize: 1,
  archiveSize: 1,
  apicalControl: 0.68,
  lateralDrive: 0.58,
  trainingInfluence: 0.24,
  maximumOrder: 3,
  maximumAxes: 52,
  maximumInternodes: 320,
  yaw: 0,
});

export const ZEN_BONSAI_DEVELOPMENTAL_SOURCE_FILES = Object.freeze([
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/ablation/globalRankedLateralAllocator.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/ablation/legacyGrowthGesture.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/ablation/localRankedAxisResourcePlan.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/ablation/localRankedAxisResourceRuntime.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/archive.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisCycleObservation.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisEstablishmentCommitment.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisLateralDemand.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisProfileDiagnostics.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisResourceContract.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisResourcePlan.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisResourcePlanShape.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisResourceRuntime.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisResourceTraits.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisSuccessionPlan.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisSupportField.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/axisSupportResponse.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/budCompetence.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/budLifecycle.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/budLightEvaluation.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/budMaturationReserve.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/budOpportunity.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/budSinkAllocation.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/compileGraph.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/compositionField.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/contracts.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/coverageDescriptor.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/crownEstablishmentThroughput.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/developmentPhase.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/diagnosticMath.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/diagnosticSummaries.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/diagnostics.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/evaluation.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/evidence.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthCycle.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthEnvironment.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthExtension.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthInitialization.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthKernel.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthMath.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthPolicy.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthState.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/growthTraits.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/jointMeristemAction.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/juvenileLeaderEstablishment.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/lateralAllocation.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/lateralAllocationAudit.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/leaderDiagnostics.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/leaderSupportCadence.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/meristemOpportunityService.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/meristemTime.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/pipeline.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/projectionAmbiguity.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/spatialDiagnostics.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/structuralNormalityAssessment.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/structuralObservationFacts.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/trainingPlan.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/developmental/trainingRuntime.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/graph/contracts.mjs',
  'scripts/dev/zen-bonsai-morphology-research/successor/synthesis/random.mjs',
  'scripts/harness/adapters/zenBonsaiDevelopmentalHarnessAdapter.mjs',
  'tools/cx/harnesses/zen-bonsai-developmental.json',
]);

const SCOPE = Object.freeze({
  kind: 'developmental_one_proposal_smoke',
  oneProposal: true,
  canonicalLifecycle: Object.freeze({
    activeGrowthCycles: DEVELOPMENTAL_CANONICAL_ACTIVE_GROWTH_CYCLES,
    settlingCycles: DEVELOPMENTAL_CANONICAL_SETTLING_CYCLES,
  }),
  productionCutoverEvidence: false,
  visualQualityEvidence: false,
  productEligible: false,
  interpretation:
    'PASS proves execution and contracts; structural normality remains diagnostic.',
});

const TARGET = Object.freeze({
  id: ZEN_BONSAI_DEVELOPMENTAL_TARGET_ID,
  title: 'Zen bonsai developmental V10, one deterministic proposal',
  family: 'zen-bonsai-developmental-research',
  supportedModes: Object.freeze([ZEN_BONSAI_DEVELOPMENTAL_MODE]),
  preset: ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE,
  estimatedSeconds: ESTIMATED_SECONDS,
  resourceClaims: Object.freeze([RESOURCE_CLAIM]),
  scope: SCOPE,
});

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function serializeError(error) {
  return Object.freeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    code: typeof error?.code === 'string' ? error.code : '',
  });
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function readZenBonsaiDevelopmentalSourceSnapshot(rootDir) {
  const sourceRevision = execFileSync(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd: rootDir, encoding: 'utf8' },
  ).trim();
  if (!sourceRevision) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SOURCE_REVISION_REQUIRED');
  }
  const trackedStatus = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=no'],
    { cwd: rootDir, encoding: 'utf8' },
  ).trim();
  const aggregate = createHash('sha256');
  const files = [];
  for (const relativePath of ZEN_BONSAI_DEVELOPMENTAL_SOURCE_FILES) {
    const absolutePath = path.join(rootDir, relativePath);
    const stat = await fs.lstat(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail(
        'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SOURCE_FILE_INVALID',
        relativePath,
      );
    }
    const bytes = await fs.readFile(absolutePath);
    const digest = sha256(bytes);
    aggregate.update(relativePath);
    aggregate.update('\0');
    aggregate.update(digest);
    aggregate.update('\0');
    files.push(Object.freeze({
      path: relativePath,
      sha256: digest,
      bytes: bytes.length,
    }));
  }
  const sourceDigest = `sha256:${aggregate.digest('hex')}`;
  return Object.freeze({
    sourceRevision,
    sourceState: `snapshot:${sourceDigest}`,
    sourceDigest,
    trackedWorktreeDirty: trackedStatus.length > 0,
    files: Object.freeze(files),
    fileCount: files.length,
  });
}

function normalizeRequest(rawRequest) {
  const request = normalizeProjectHarnessRequest(rawRequest);
  if (request.targetId !== ZEN_BONSAI_DEVELOPMENTAL_TARGET_ID) {
    fail(
      'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_TARGET_UNSUPPORTED',
      request.targetId,
    );
  }
  if (request.mode !== ZEN_BONSAI_DEVELOPMENTAL_MODE) {
    fail(
      'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_MODE_UNSUPPORTED',
      request.mode,
    );
  }
  if (request.configPath !== null) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_CONFIG_PATH_FORBIDDEN');
  }
  const parameterKeys = Object.keys(request.parameters).sort();
  if (
    parameterKeys.length !== 1
    || parameterKeys[0] !== 'preset'
    || request.parameters.preset !== ZEN_BONSAI_DEVELOPMENTAL_PRESET
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_PRESET_INVALID');
  }
  return request;
}

async function compilePlan({
  rootDir,
  rawRequest,
  sourceSnapshotLoader,
}) {
  if (!path.isAbsolute(rootDir || '')) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_ROOT_ABSOLUTE_REQUIRED');
  }
  const request = normalizeRequest(rawRequest);
  const sourceSnapshot = await sourceSnapshotLoader(rootDir);
  const runRoot = path.join(
    rootDir,
    '.artifacts',
    'project-harness',
    'zen-bonsai-developmental',
    request.runId,
  );
  const attachmentsDir = path.join(runRoot, 'attachments');
  const configDigest = sha256(stableJson(
    ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE,
  ));
  const plan = Object.freeze({
    contractVersion: 1,
    targetId: request.targetId,
    mode: request.mode,
    runId: request.runId,
    rootDir,
    runRoot,
    resourceClaims: Object.freeze([RESOURCE_CLAIM]),
    estimatedCost: Object.freeze({
      estimatedSeconds: ESTIMATED_SECONDS,
      runAttempts: 1,
      retries: 0,
      modelCalls: 0,
      browserRuns: 0,
      builds: 0,
    }),
    scope: SCOPE,
    preset: Object.freeze({
      id: ZEN_BONSAI_DEVELOPMENTAL_PRESET,
      profile: ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE,
      configDigest,
      phaseFieldsOmitted: Object.freeze([
        'cycles',
        'activeGrowthCycles',
        'settlingCycles',
      ]),
    }),
    sourceSnapshot,
    outputOwnership: Object.freeze({
      owner: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
      reservation: 'exclusive_run_root',
      runRoot,
      attachmentsDir,
      expectedArtifactNames: EXPECTED_ARTIFACT_NAMES,
      candidate: path.join(attachmentsDir, 'candidate.json'),
      result: path.join(attachmentsDir, 'result.json'),
      manifest: path.join(attachmentsDir, 'manifest.json'),
      canonicalHarnessReport: path.join(runRoot, 'run.json'),
    }),
  });
  return Object.freeze({ request, plan });
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertEqual(actual, expected, code) {
  if (!isDeepStrictEqual(actual, expected)) fail(code);
}

function requireContract(value, {
  contract,
  version,
  code,
}) {
  if (value?.contract !== contract || value?.version !== version) {
    fail(
      code,
      `${String(value?.contract)}@${String(value?.version)}`,
    );
  }
  return value;
}

export function validateZenBonsaiDevelopmentalCohort(cohort) {
  requireContract(cohort, {
    contract: DEVELOPMENTAL_GROWTH_COHORT_CONTRACT,
    version: DEVELOPMENTAL_GROWTH_COHORT_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_COHORT_CONTRACT_INVALID',
  });
  if (
    !Array.isArray(cohort.entries)
    || !Array.isArray(cohort.rawPopulation)
    || cohort.entries.length !== 1
    || cohort.rawPopulation.length !== 1
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_COHORT_SIZE_INVALID');
  }
  const resolvedRequest = cohort.request;
  for (const [field, expected] of Object.entries(
    ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE,
  )) {
    if (!isDeepStrictEqual(resolvedRequest?.[field], expected)) {
      fail(
        'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_PROFILE_MISMATCH',
        field,
      );
    }
  }
  if (
    resolvedRequest.cycles !== (
      DEVELOPMENTAL_CANONICAL_ACTIVE_GROWTH_CYCLES
      + DEVELOPMENTAL_CANONICAL_SETTLING_CYCLES
    )
    || resolvedRequest.activeGrowthCycles
      !== DEVELOPMENTAL_CANONICAL_ACTIVE_GROWTH_CYCLES
    || resolvedRequest.settlingCycles
      !== DEVELOPMENTAL_CANONICAL_SETTLING_CYCLES
    || resolvedRequest.diagnosticIncompleteSettlement !== false
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_PHASE_INVALID');
  }

  const entry = cohort.entries[0];
  if (!isDeepStrictEqual(entry, cohort.rawPopulation[0])) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_POPULATION_MISMATCH');
  }
  const expectedProposalSeed = deriveUint32Seed(
    ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE.seed,
    'developmental-cohort',
    0,
  );
  if (
    entry.index !== 0
    || entry.seed !== expectedProposalSeed
    || entry.tree?.request?.seed !== expectedProposalSeed
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_PROPOSAL_SEED_INVALID');
  }

  const tree = requireDevelopmentalTree(entry.tree);
  requireContract(tree.request, {
    contract: DEVELOPMENTAL_GROWTH_REQUEST_CONTRACT,
    version: DEVELOPMENTAL_ACTIVE_GROWTH_REQUEST_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_REQUEST_CONTRACT_INVALID',
  });
  requireContract(tree, {
    contract: DEVELOPMENTAL_TREE_CONTRACT,
    version: DEVELOPMENTAL_ACTIVE_TREE_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_TREE_CONTRACT_INVALID',
  });
  requireContract(tree.semantics?.growthPolicy, {
    contract: DEVELOPMENTAL_GROWTH_POLICY_CONTRACT,
    version: DEVELOPMENTAL_GROWTH_POLICY_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_POLICY_CONTRACT_INVALID',
  });
  if (
    tree.semantics?.owner !== GENERATION_OWNER
    || tree.semantics?.productEligible !== false
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_GENERATION_OWNER_INVALID');
  }
  if (
    tree.cycleSummaries.length !== resolvedRequest.cycles + 1
    || tree.axisResourcePlans.length !== resolvedRequest.cycles
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_LIFECYCLE_INCOMPLETE');
  }
  tree.axisResourcePlans.forEach((resourcePlan, index) => {
    requireContract(resourcePlan, {
      contract: DEVELOPMENTAL_AXIS_RESOURCE_PLAN_CONTRACT,
      version: DEVELOPMENTAL_CONSERVED_AXIS_RESOURCE_PLAN_VERSION,
      code:
        'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_RESOURCE_PLAN_CONTRACT_INVALID',
    });
    if (resourcePlan.cycle !== index + 1) {
      fail(
        'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_RESOURCE_PLAN_SEQUENCE_INVALID',
      );
    }
  });

  const graph = requireDevelopmentalCompiledStructuralAxisGraph(
    entry.graph,
    {
      tree,
      cycle: tree.request.cycles,
      yaw: ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE.yaw,
    },
  );
  requireContract(graph, {
    contract: STRUCTURAL_AXIS_GRAPH_CONTRACT,
    version: STRUCTURAL_AXIS_GRAPH_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_GRAPH_CONTRACT_INVALID',
  });
  const evaluation = requireDevelopmentalCoreEvaluation(
    entry.evaluation,
    tree,
  );
  requireContract(evaluation, {
    contract: DEVELOPMENTAL_CORE_EVALUATION_CONTRACT,
    version: DEVELOPMENTAL_CORE_EVALUATION_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_EVALUATION_CONTRACT_INVALID',
  });
  const evidence = requireDevelopmentalCandidateEvidence(
    entry.evidence,
    { tree, graph, evaluation },
  );
  requireContract(evidence, {
    contract: DEVELOPMENTAL_CANDIDATE_EVIDENCE_CONTRACT,
    version: DEVELOPMENTAL_CANDIDATE_EVIDENCE_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_EVIDENCE_CONTRACT_INVALID',
  });

  const diagnostics = evaluation.structuralDiagnostics;
  requireContract(diagnostics?.structuralObservationFacts, {
    contract: DEVELOPMENTAL_STRUCTURAL_OBSERVATION_FACTS_CONTRACT,
    version: DEVELOPMENTAL_STRUCTURAL_OBSERVATION_FACTS_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_FACTS_CONTRACT_INVALID',
  });
  const normality = requireContract(diagnostics?.structuralNormality, {
    contract: DEVELOPMENTAL_STRUCTURAL_NORMALITY_CONTRACT,
    version: DEVELOPMENTAL_STRUCTURAL_NORMALITY_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_NORMALITY_CONTRACT_INVALID',
  });
  requireContract(diagnostics?.coverageDescriptor, {
    contract: DEVELOPMENTAL_COVERAGE_DESCRIPTOR_CONTRACT,
    version: DEVELOPMENTAL_COVERAGE_DESCRIPTOR_VERSION,
    code: 'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_COVERAGE_CONTRACT_INVALID',
  });
  if (
    diagnostics?.projectionDiagnostics?.status !== 'deferred'
    || cohort.semantics?.projectionDiagnostics
      !== 'deferred_until_explicit_request'
    || cohort.semantics?.generationOwner !== GENERATION_OWNER
    || cohort.semantics?.productEligible !== false
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SEMANTICS_INVALID');
  }
  if (
    graph.provenance?.sourceFingerprint !== tree.fingerprint
    || evaluation.provenance?.treeFingerprint !== tree.fingerprint
    || evidence.candidate?.treeFingerprint !== tree.fingerprint
    || evidence.candidate?.graphFingerprint !== graph.fingerprint
    || evidence.candidate?.morphologyFingerprint
      !== graph.morphologyFingerprint
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_PROVENANCE_INVALID');
  }

  const serializedCandidate = jsonClone({
    index: entry.index,
    seed: entry.seed,
    tree,
    graph,
    evaluation,
    evidence,
  });
  const clonedTree = requireDevelopmentalTree(serializedCandidate.tree);
  const clonedGraph = requireDevelopmentalCompiledStructuralAxisGraph(
    serializedCandidate.graph,
    {
      tree: clonedTree,
      cycle: clonedTree.request.cycles,
      yaw: ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE.yaw,
    },
  );
  const clonedEvaluation = requireDevelopmentalCoreEvaluation(
    serializedCandidate.evaluation,
    clonedTree,
  );
  requireDevelopmentalCandidateEvidence(
    serializedCandidate.evidence,
    {
      tree: clonedTree,
      graph: clonedGraph,
      evaluation: clonedEvaluation,
    },
  );
  assertEqual(
    serializedCandidate.tree.fingerprint,
    tree.fingerprint,
    'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SERIALIZED_TREE_DRIFT',
  );
  assertEqual(
    serializedCandidate.graph.fingerprint,
    graph.fingerprint,
    'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SERIALIZED_GRAPH_DRIFT',
  );
  assertEqual(
    serializedCandidate.evaluation.fingerprint,
    evaluation.fingerprint,
    'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SERIALIZED_EVALUATION_DRIFT',
  );
  assertEqual(
    serializedCandidate.evidence.fingerprint,
    evidence.fingerprint,
    'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_SERIALIZED_EVIDENCE_DRIFT',
  );

  const viableArchiveShortfall = Number(
    cohort.statistics?.viableArchive?.shortfall,
  );
  if (!Number.isSafeInteger(viableArchiveShortfall)) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_ARCHIVE_STATUS_INVALID');
  }
  const reasonCodes = [...normality.reasonCodes];
  const reviewRecommended = (
    normality.status !== 'viable'
    || reasonCodes.length > 0
    || viableArchiveShortfall > 0
  );
  return Object.freeze({
    candidate: serializedCandidate,
    proposalSeed: entry.seed,
    resolvedRequest: cloneProjectHarnessJsonData(
      resolvedRequest,
      'cohort.request',
    ),
    statistics: cloneProjectHarnessJsonData(
      cohort.statistics,
      'cohort.statistics',
    ),
    semantics: cloneProjectHarnessJsonData(
      cohort.semantics,
      'cohort.semantics',
    ),
    diagnostics: cloneProjectHarnessJsonData({
      structuralNormality: normality,
      structuralObservationFacts:
        diagnostics.structuralObservationFacts,
      coverageDescriptor: diagnostics.coverageDescriptor,
      counts: evaluation.counts,
      emergence: evaluation.emergence,
      longestMatureNakedRun:
        diagnostics.axisSupport.longestMatureNakedRun,
      matureNakedRunByOrder:
        diagnostics.axisSupport.matureNakedRunByOrder,
      leaderSupportRhythm:
        diagnostics.axisSupport.leaderSupportRhythm,
      axisResource: diagnostics.axisResource,
      projectionDiagnostics: diagnostics.projectionDiagnostics,
    }, 'cohort.diagnostics'),
    reviewRecommended,
    reasonCode: reviewRecommended ? DIAGNOSTIC_REVIEW_REASON : null,
  });
}

export function executeZenBonsaiDevelopmentalProposal() {
  const cohort = createDevelopmentalGrowthCohort({
    ...ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE,
  });
  return validateZenBonsaiDevelopmentalCohort(cohort);
}

async function writeFileAtomic(filePath, content) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.project-harness-${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.link(temporaryPath, filePath);
  } finally {
    await handle?.close().catch(() => {});
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function writeJsonAtomic(filePath, value) {
  const normalized = cloneProjectHarnessJsonData(value, filePath);
  await writeFileAtomic(
    filePath,
    `${JSON.stringify(normalized, null, 2)}\n`,
  );
}

async function reserveRunRoot(plan) {
  await fs.mkdir(path.dirname(plan.runRoot), { recursive: true });
  try {
    await fs.mkdir(plan.runRoot);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      fail(
        'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_RUN_ROOT_EXISTS',
        plan.runRoot,
      );
    }
    throw error;
  }
  await fs.mkdir(plan.outputOwnership.attachmentsDir);
  const probePath = path.join(plan.runRoot, `.probe-${randomUUID()}`);
  try {
    await fs.writeFile(probePath, '', { flag: 'wx', mode: 0o600 });
  } finally {
    await fs.rm(probePath, { force: true }).catch(() => {});
  }
}

async function acquireResourceLock(plan) {
  const lockRoot = path.join(
    plan.rootDir,
    '.artifacts',
    'project-harness',
    'locks',
  );
  await fs.mkdir(lockRoot, { recursive: true });
  const lockPath = path.join(
    lockRoot,
    'zen-bonsai-developmental-one-proposal.lock',
  );
  try {
    await fs.writeFile(
      lockPath,
      `${JSON.stringify({
        contractVersion: 1,
        runId: plan.runId,
        resourceClaim: RESOURCE_CLAIM,
        pid: process.pid,
      })}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    if (error?.code === 'EEXIST') {
      fail('PROJECT_HARNESS_RESOURCE_BUSY', RESOURCE_CLAIM);
    }
    throw error;
  }
  return Object.freeze({
    path: lockPath,
    async release() {
      await fs.rm(lockPath);
    },
  });
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = signal.reason instanceof Error
    ? signal.reason
    : new Error('PROJECT_HARNESS_ABORTED');
  if (!error.code) error.code = 'PROJECT_HARNESS_ABORTED';
  throw error;
}

async function readArtifactEvidence(plan) {
  const entries = await fs.readdir(
    plan.outputOwnership.attachmentsDir,
    { withFileTypes: true },
  );
  if (entries.some((entry) => !entry.isFile())) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_ARTIFACT_ENTRY_INVALID');
  }
  const names = entries.map((entry) => entry.name).sort();
  if (!isDeepStrictEqual(names, EXPECTED_ARTIFACT_NAMES)) {
    fail(
      'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_ARTIFACT_SET_MISMATCH',
      names.join(','),
    );
  }
  const artifacts = [];
  for (const name of names) {
    const artifactPath = path.join(
      plan.outputOwnership.attachmentsDir,
      name,
    );
    const bytes = await fs.readFile(artifactPath);
    artifacts.push(Object.freeze({
      name,
      path: artifactPath,
      sha256: sha256(bytes),
      bytes: bytes.length,
    }));
  }
  return Object.freeze(artifacts);
}

function requireProposalExecution(execution) {
  if (
    !execution
    || typeof execution !== 'object'
    || !execution.candidate
    || !execution.resolvedRequest
    || !execution.statistics
    || !execution.semantics
    || !execution.diagnostics
    || !Number.isSafeInteger(execution.proposalSeed)
    || typeof execution.reviewRecommended !== 'boolean'
    || (
      execution.reasonCode !== null
      && typeof execution.reasonCode !== 'string'
    )
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_EXECUTION_INVALID');
  }
  return execution;
}

async function publishDomainArtifacts(plan, execution) {
  const candidatePath = plan.outputOwnership.candidate;
  await writeJsonAtomic(candidatePath, Object.freeze({
    contract: 'entropy.zen.bonsai.developmental-one-proposal-candidate',
    version: 1,
    proposal: execution.candidate,
  }));
  const candidateBytes = await fs.readFile(candidatePath);
  const candidateEvidence = Object.freeze({
    name: 'candidate.json',
    sha256: sha256(candidateBytes),
    bytes: candidateBytes.length,
  });

  const manifest = Object.freeze({
    contract: 'entropy.zen.bonsai.developmental-one-proposal-manifest',
    version: 1,
    adapter: Object.freeze({
      id: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
      revision: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
      runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
    }),
    runId: plan.runId,
    targetId: plan.targetId,
    mode: plan.mode,
    environment: Object.freeze({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    }),
    source: plan.sourceSnapshot,
    configuration: Object.freeze({
      preset: ZEN_BONSAI_DEVELOPMENTAL_PRESET,
      profile: ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE,
      configDigest: plan.preset.configDigest,
      phaseFieldsOmitted: plan.preset.phaseFieldsOmitted,
    }),
    seeds: Object.freeze({
      outer: ZEN_BONSAI_DEVELOPMENTAL_FIXED_PROFILE.seed,
      proposal: execution.proposalSeed,
    }),
    scope: SCOPE,
  });
  const manifestPath = plan.outputOwnership.manifest;
  await writeJsonAtomic(manifestPath, manifest);
  const manifestBytes = await fs.readFile(manifestPath);
  const manifestEvidence = Object.freeze({
    name: 'manifest.json',
    sha256: sha256(manifestBytes),
    bytes: manifestBytes.length,
  });

  const domainResult = Object.freeze({
    contract: 'entropy.zen.bonsai.developmental-one-proposal-result',
    version: 1,
    status: 'PASS',
    targetId: plan.targetId,
    mode: plan.mode,
    runId: plan.runId,
    preset: ZEN_BONSAI_DEVELOPMENTAL_PRESET,
    reviewRecommended: execution.reviewRecommended,
    reasonCode: execution.reasonCode,
    request: execution.resolvedRequest,
    statistics: execution.statistics,
    semantics: execution.semantics,
    diagnostics: execution.diagnostics,
    artifacts: Object.freeze({
      candidate: candidateEvidence,
      manifest: manifestEvidence,
    }),
    interpretation: SCOPE.interpretation,
  });
  await writeJsonAtomic(plan.outputOwnership.result, domainResult);
  const artifacts = await readArtifactEvidence(plan);
  const artifactByName = new Map(
    artifacts.map((artifact) => [artifact.name, artifact]),
  );
  if (
    artifactByName.get(candidateEvidence.name)?.sha256
      !== candidateEvidence.sha256
    || artifactByName.get(manifestEvidence.name)?.sha256
      !== manifestEvidence.sha256
  ) {
    fail('PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_ARTIFACT_DIGEST_MISMATCH');
  }
  return Object.freeze({
    domainResult,
    artifacts,
  });
}

function classifyRunError(error, signal) {
  if (
    signal?.aborted
    || error?.name === 'AbortError'
    || error?.code === 'ABORT_ERR'
    || error?.code === 'PROJECT_HARNESS_ABORTED'
  ) {
    return 'INCONCLUSIVE';
  }
  if (error?.code === 'PROJECT_HARNESS_RESOURCE_BUSY') return 'BLOCKED';
  return 'FAIL';
}

async function executeFrozenPlan(plan, {
  signal,
  proposalExecutor,
}) {
  await reserveRunRoot(plan);
  const startedAt = Date.now();
  let lock = null;
  let proposal = null;
  let published = null;
  let runError = null;
  let status = 'FAIL';
  const cleanup = [];
  try {
    throwIfAborted(signal);
    lock = await acquireResourceLock(plan);
    throwIfAborted(signal);
    proposal = requireProposalExecution(await proposalExecutor());
    throwIfAborted(signal);
    published = await publishDomainArtifacts(plan, proposal);
    status = 'PASS';
  } catch (error) {
    runError = error;
    status = classifyRunError(error, signal);
  } finally {
    if (lock) {
      try {
        await lock.release();
        cleanup.push(Object.freeze({
          id: RESOURCE_CLAIM,
          status: 'released',
        }));
      } catch (error) {
        runError = error;
        status = 'FAIL';
        cleanup.push(Object.freeze({
          id: RESOURCE_CLAIM,
          status: 'failed',
          error: serializeError(error),
        }));
      }
    }
  }

  const durationMs = Math.max(0, Date.now() - startedAt);
  const terminalNeedsReview = (
    status === 'BLOCKED'
    || status === 'INCONCLUSIVE'
  );
  const reviewRecommended = (
    proposal?.reviewRecommended === true
    || terminalNeedsReview
  );
  const reasonCode = proposal?.reasonCode
    || (
      terminalNeedsReview
        ? (
            runError?.code
            || `PROJECT_HARNESS_${status}`
          )
        : null
    );
  const domainResult = Object.freeze({
    contractVersion: 1,
    target: Object.freeze({
      id: plan.targetId,
      mode: plan.mode,
      scope: SCOPE,
    }),
    source: Object.freeze({
      adapterRevision:
        ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
      runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
      snapshot: plan.sourceSnapshot,
      configDigest: plan.preset.configDigest,
    }),
    execution: Object.freeze({
      durationMs,
      runAttempts: 1,
      retries: 0,
      modelCalls: 0,
      browserRuns: 0,
      builds: 0,
      stdoutUsedForStatus: false,
    }),
    diagnostic: proposal
      ? Object.freeze({
          reviewRecommended: proposal.reviewRecommended,
          reasonCode: proposal.reasonCode,
          proposalSeed: proposal.proposalSeed,
          structuralNormality:
            proposal.diagnostics.structuralNormality,
          viableArchive: proposal.statistics.viableArchive,
          productEligible: proposal.semantics.productEligible,
        })
      : null,
    artifacts: published?.artifacts || Object.freeze([]),
    canonicalDomainResult: published
      ? Object.freeze({
          path: plan.outputOwnership.result,
          contract:
            published.domainResult.contract,
          version: published.domainResult.version,
        })
      : null,
  });
  const report = Object.freeze({
    contractVersion: 1,
    runId: plan.runId,
    targetId: plan.targetId,
    mode: plan.mode,
    status,
    durationMs,
    error: runError ? serializeError(runError) : null,
    reviewRecommended,
    reasonCode,
    scope: SCOPE,
    domainResult,
  });
  await writeJsonAtomic(
    path.join(plan.runRoot, 'cleanup.json'),
    Object.freeze({
      contractVersion: 1,
      runId: plan.runId,
      status: cleanup.some((entry) => entry.status === 'failed')
        ? 'failed'
        : 'complete',
      resources: Object.freeze(cleanup),
    }),
  );
  await writeFileAtomic(
    path.join(plan.runRoot, 'events.jsonl'),
    [
      JSON.stringify({
        contractVersion: 1,
        runId: plan.runId,
        type: 'DEVELOPMENTAL_ONE_PROPOSAL_STARTED',
      }),
      JSON.stringify({
        contractVersion: 1,
        runId: plan.runId,
        type: 'DEVELOPMENTAL_ONE_PROPOSAL_FINISHED',
        status,
        durationMs,
        reviewRecommended,
      }),
      '',
    ].join('\n'),
  );
  const reportPath = path.join(plan.runRoot, 'run.json');
  await writeJsonAtomic(reportPath, report);
  const reportBytes = await fs.readFile(reportPath);
  const envelope = createProjectHarnessResultEnvelope({
    adapterId: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
    adapterRevision:
      ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
    runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
    plan,
    planDigest: createProjectHarnessPlanDigest({
      adapterId: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
      adapterRevision:
        ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
      runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
      plan,
    }),
    report,
    reportEvidence: Object.freeze({
      path: reportPath,
      sha256: sha256(reportBytes),
    }),
  });
  return Object.freeze({
    ...envelope,
    reviewRecommended,
    reasonCode,
    domainResult,
  });
}

export function createZenBonsaiDevelopmentalHarnessAdapter({
  sourceSnapshotLoader = readZenBonsaiDevelopmentalSourceSnapshot,
  proposalExecutor = executeZenBonsaiDevelopmentalProposal,
} = {}) {
  return Object.freeze({
    id: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
    revision: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
    runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
    title: TARGET.title,
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,

    list() {
      return Object.freeze([TARGET]);
    },

    describe({ targetId } = {}) {
      if (targetId !== TARGET.id) {
        fail(
          'PROJECT_HARNESS_BONSAI_DEVELOPMENTAL_TARGET_UNSUPPORTED',
          targetId,
        );
      }
      return TARGET;
    },

    async plan({ rootDir, request: rawRequest } = {}) {
      const { request, plan } = await compilePlan({
        rootDir,
        rawRequest,
        sourceSnapshotLoader,
      });
      return createProjectHarnessPlanEnvelope({
        adapterId: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
        adapterRevision:
          ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
        runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
        request,
        plan,
      });
    },

    async run({
      rootDir,
      request: rawRequest,
      expectedPlanDigest,
      signal = null,
    } = {}) {
      const normalizedExpectedDigest = normalizeProjectHarnessPlanDigest(
        expectedPlanDigest,
      );
      const { plan } = await compilePlan({
        rootDir,
        rawRequest,
        sourceSnapshotLoader,
      });
      const actualPlanDigest = createProjectHarnessPlanDigest({
        adapterId: ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_ID,
        adapterRevision:
          ZEN_BONSAI_DEVELOPMENTAL_HARNESS_ADAPTER_REVISION,
        runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
        plan,
      });
      if (actualPlanDigest !== normalizedExpectedDigest) {
        fail(
          'PROJECT_HARNESS_PLAN_CHANGED',
          `${normalizedExpectedDigest}:${actualPlanDigest}`,
        );
      }
      return executeFrozenPlan(plan, {
        signal,
        proposalExecutor,
      });
    },

    classifyError(error) {
      return classifyRunError(error, null);
    },
  });
}

export const zenBonsaiDevelopmentalHarnessAdapter =
  createZenBonsaiDevelopmentalHarnessAdapter();
