import { execFile, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  MORPHOLOGY_EXPERIMENT_CONTRACT,
  MORPHOLOGY_EXPERIMENT_VERSION,
} from '../../dev/zen-bonsai-morphology-research/experiment/contract.mjs';
import {
  validateMorphologyExperimentResult,
} from '../../dev/zen-bonsai-morphology-research/experiment/resultSchema.mjs';
import {
  normalizeMorphologyExperimentConfig,
} from '../../dev/zen-bonsai-morphology-research/experiment/runExperiment.mjs';
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

export const ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID =
  'zen-bonsai-morphology';
export const ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION =
  'zen-bonsai-morphology-adapter@2';
export const ZEN_BONSAI_STRUCTURAL_SMOKE_TARGET_ID =
  'bonsai/morphology/structural-smoke-once';
export const ZEN_BONSAI_STRUCTURAL_SMOKE_MODE = 'structural_smoke';
export const ZEN_BONSAI_STRUCTURAL_SMOKE_PRESET =
  'contract-min-v1';

const RESOURCE_CLAIM = 'runtime:zen-bonsai-morphology-structural-smoke';
const ESTIMATED_SECONDS = 5;
const OBSERVED_GATE_REVIEW_REASON =
  'ZEN_BONSAI_STRUCTURAL_SMOKE_OBSERVED_GATE_FAIL';
const EXPERIMENT_CLI =
  'scripts/dev/zen-bonsai-morphology-research/experiment/cli.mjs';
const SOURCE_ROOTS = Object.freeze([
  'scripts/dev/zen-bonsai-morphology-research/experiment',
  'scripts/dev/zen-bonsai-morphology-research/kernel',
]);
const EXPECTED_ARTIFACT_NAMES = Object.freeze([
  'atlas-final.json',
  'atlas-initial.json',
  'coverage-collateral.csv',
  'feature-weights.csv',
  'held-out.csv',
  'image-audit-template.json',
  'morphology-safety.csv',
  'pairwise-evidence.csv',
  'pairwise-evidence.jsonl',
  'pathology-collateral.csv',
  'result.json',
  'result.schema.json',
  'structural-geometry-coverage.csv',
  'summary.md',
]);
const PRESET = Object.freeze({
  id: ZEN_BONSAI_STRUCTURAL_SMOKE_PRESET,
  targetId: 'natural_balance',
  experimentSeed: 0x1A2B3C4D,
  rounds: 8,
  candidatePoolSize: 4,
  trainingSeedCount: 4,
  heldOutSeedCount: 4,
  atlasCaseCount: 1,
  styleExplorationScale: 0.3,
});
const SCOPE = Object.freeze({
  kind: 'structural_smoke',
  oneLoop: true,
  productionCutoverEvidence: false,
  visualQualityEvidence: false,
  scientificSufficiency: 'not_established_by_small_sample_smoke',
  interpretation:
    'PASS records runner and artifact validity; observed gates remain diagnostics.',
});
const TARGET = Object.freeze({
  id: ZEN_BONSAI_STRUCTURAL_SMOKE_TARGET_ID,
  title: 'Zen bonsai structural smoke, one deterministic loop',
  family: 'zen-bonsai-structural-research',
  supportedModes: Object.freeze([ZEN_BONSAI_STRUCTURAL_SMOKE_MODE]),
  preset: PRESET,
  estimatedSeconds: ESTIMATED_SECONDS,
  resourceClaims: Object.freeze([RESOURCE_CLAIM]),
  scope: SCOPE,
});

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

async function listSourceFiles(rootDir) {
  const files = [];
  async function visit(relativeDirectory) {
    const absoluteDirectory = path.join(rootDir, relativeDirectory);
    const entries = await fs.readdir(absoluteDirectory, {
      withFileTypes: true,
    });
    for (const entry of entries.sort((left, right) => (
      left.name.localeCompare(right.name)
    ))) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        fail('PROJECT_HARNESS_BONSAI_SOURCE_SYMLINK_FORBIDDEN', relativePath);
      }
      if (entry.isDirectory()) {
        await visit(relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        fail('PROJECT_HARNESS_BONSAI_SOURCE_ENTRY_INVALID', relativePath);
      }
    }
  }
  for (const sourceRoot of SOURCE_ROOTS) await visit(sourceRoot);
  return files;
}

export async function readZenBonsaiMorphologySourceSnapshot(rootDir) {
  const sourceRevision = execFileSync(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd: rootDir, encoding: 'utf8' },
  ).trim();
  if (!sourceRevision) {
    fail('PROJECT_HARNESS_BONSAI_SOURCE_REVISION_REQUIRED');
  }
  const files = await listSourceFiles(rootDir);
  const aggregate = createHash('sha256');
  for (const relativePath of files) {
    const bytes = await fs.readFile(path.join(rootDir, relativePath));
    aggregate.update(relativePath);
    aggregate.update('\0');
    aggregate.update(sha256(bytes));
    aggregate.update('\0');
  }
  const sourceDigest = `sha256:${aggregate.digest('hex')}`;
  return Object.freeze({
    sourceRevision,
    sourceState: `snapshot:${sourceDigest}`,
    sourceDigest,
    sourceRoots: SOURCE_ROOTS,
    fileCount: files.length,
  });
}

function normalizeRequest(rawRequest) {
  const request = normalizeProjectHarnessRequest(rawRequest);
  if (request.targetId !== ZEN_BONSAI_STRUCTURAL_SMOKE_TARGET_ID) {
    fail('PROJECT_HARNESS_BONSAI_TARGET_UNSUPPORTED', request.targetId);
  }
  if (request.mode !== ZEN_BONSAI_STRUCTURAL_SMOKE_MODE) {
    fail('PROJECT_HARNESS_BONSAI_MODE_UNSUPPORTED', request.mode);
  }
  if (request.configPath !== null) {
    fail('PROJECT_HARNESS_BONSAI_CONFIG_PATH_FORBIDDEN');
  }
  const parameterKeys = Object.keys(request.parameters).sort();
  if (
    parameterKeys.length !== 1
    || parameterKeys[0] !== 'preset'
    || request.parameters.preset !== ZEN_BONSAI_STRUCTURAL_SMOKE_PRESET
  ) {
    fail('PROJECT_HARNESS_BONSAI_PRESET_INVALID');
  }
  return request;
}

function commandArgs({ attachmentsDir, sourceSnapshot }) {
  return Object.freeze([
    EXPERIMENT_CLI,
    '--target',
    PRESET.targetId,
    '--seed',
    String(PRESET.experimentSeed),
    '--rounds',
    String(PRESET.rounds),
    '--pool',
    String(PRESET.candidatePoolSize),
    '--training-seeds',
    String(PRESET.trainingSeedCount),
    '--held-out-seeds',
    String(PRESET.heldOutSeedCount),
    '--atlas-cases',
    String(PRESET.atlasCaseCount),
    '--style-exploration',
    String(PRESET.styleExplorationScale),
    '--source-revision',
    sourceSnapshot.sourceRevision,
    '--source-state',
    sourceSnapshot.sourceState,
    '--output',
    attachmentsDir,
  ]);
}

async function compilePlan({
  rootDir,
  rawRequest,
  sourceSnapshotLoader,
}) {
  if (!path.isAbsolute(rootDir || '')) {
    fail('PROJECT_HARNESS_BONSAI_ROOT_ABSOLUTE_REQUIRED');
  }
  const request = normalizeRequest(rawRequest);
  const sourceSnapshot = await sourceSnapshotLoader(rootDir);
  const runRoot = path.join(
    rootDir,
    '.artifacts',
    'project-harness',
    'zen-bonsai-structural-smoke',
    request.runId,
  );
  const attachmentsDir = path.join(runRoot, 'attachments');
  const experimentConfig = normalizeMorphologyExperimentConfig({
    targetId: PRESET.targetId,
    experimentSeed: PRESET.experimentSeed,
    rounds: PRESET.rounds,
    candidatePoolSize: PRESET.candidatePoolSize,
    trainingSeedCount: PRESET.trainingSeedCount,
    heldOutSeedCount: PRESET.heldOutSeedCount,
    atlasCaseCount: PRESET.atlasCaseCount,
    styleExplorationScale: PRESET.styleExplorationScale,
    provenance: {
      sourceRevision: sourceSnapshot.sourceRevision,
      sourceState: sourceSnapshot.sourceState,
    },
  });
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
    preset: PRESET,
    experimentContract: Object.freeze({
      id: MORPHOLOGY_EXPERIMENT_CONTRACT,
      version: MORPHOLOGY_EXPERIMENT_VERSION,
    }),
    experimentConfig,
    sourceSnapshot,
    command: Object.freeze({
      executable: process.execPath,
      args: commandArgs({ attachmentsDir, sourceSnapshot }),
      cwd: rootDir,
    }),
    outputOwnership: Object.freeze({
      owner: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID,
      reservation: 'exclusive_run_root',
      runRoot,
      attachmentsDir,
      expectedArtifactNames: EXPECTED_ARTIFACT_NAMES,
      canonicalExperimentResult: path.join(attachmentsDir, 'result.json'),
      canonicalHarnessReport: path.join(runRoot, 'run.json'),
    }),
  });
  return Object.freeze({ request, plan });
}

async function executeCommand(plan, { signal = null } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      plan.command.executable,
      plan.command.args,
      {
        cwd: plan.command.cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        signal,
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve(Object.freeze({
          exitCode: 0,
          stdoutBytes: Buffer.byteLength(stdout || ''),
          stderrBytes: Buffer.byteLength(stderr || ''),
        }));
      },
    );
  });
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
      fail('PROJECT_HARNESS_BONSAI_RUN_ROOT_EXISTS', plan.runRoot);
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
    'zen-bonsai-morphology-structural-smoke.lock',
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

async function readExperimentArtifacts(plan, validateResult) {
  const attachmentsDir = plan.outputOwnership.attachmentsDir;
  const entries = await fs.readdir(attachmentsDir, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile())) {
    fail('PROJECT_HARNESS_BONSAI_ARTIFACT_ENTRY_INVALID');
  }
  const actualNames = entries.map((entry) => entry.name).sort();
  if (!isDeepStrictEqual(actualNames, EXPECTED_ARTIFACT_NAMES)) {
    fail(
      'PROJECT_HARNESS_BONSAI_ARTIFACT_SET_MISMATCH',
      actualNames.join(','),
    );
  }
  const resultPath = plan.outputOwnership.canonicalExperimentResult;
  let result;
  try {
    result = JSON.parse(await fs.readFile(resultPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `PROJECT_HARNESS_BONSAI_RESULT_JSON_INVALID:${resultPath}`,
      { cause: error },
    );
  }
  validateResult(result);
  if (!isDeepStrictEqual(result.config, plan.experimentConfig)) {
    fail('PROJECT_HARNESS_BONSAI_RESULT_CONFIG_MISMATCH');
  }
  if (
    result.provenance.sourceRevision
      !== plan.sourceSnapshot.sourceRevision
    || result.provenance.sourceState !== plan.sourceSnapshot.sourceState
  ) {
    fail('PROJECT_HARNESS_BONSAI_RESULT_PROVENANCE_MISMATCH');
  }
  const artifacts = [];
  for (const name of actualNames) {
    const artifactPath = path.join(attachmentsDir, name);
    const bytes = await fs.readFile(artifactPath);
    artifacts.push(Object.freeze({
      name,
      path: artifactPath,
      sha256: sha256(bytes),
      bytes: bytes.length,
    }));
  }
  return Object.freeze({
    result,
    artifacts: Object.freeze(artifacts),
  });
}

function createGateSummary(result) {
  return Object.freeze({
    experimentId: result.experimentId,
    experimentResultFingerprint: result.resultFingerprint,
    overallStatus: result.overallStatus,
    biasGate: cloneProjectHarnessJsonData(result.biasGate, 'biasGate'),
    morphologySafetyGate: cloneProjectHarnessJsonData(
      result.morphologySafetyGate,
      'morphologySafetyGate',
    ),
    observedSample: Object.freeze({
      trainingRounds: PRESET.rounds,
      candidatePoolSize: PRESET.candidatePoolSize,
      trainingSeedCount: PRESET.trainingSeedCount,
      heldOutSeedCount: PRESET.heldOutSeedCount,
    }),
    scientificSufficiency: SCOPE.scientificSufficiency,
  });
}

function classifyRunError(error, signal) {
  if (
    signal?.aborted
    || error?.name === 'AbortError'
    || error?.code === 'ABORT_ERR'
  ) {
    return 'INCONCLUSIVE';
  }
  if (error?.code === 'PROJECT_HARNESS_RESOURCE_BUSY') return 'BLOCKED';
  return 'FAIL';
}

async function executeFrozenPlan(plan, {
  signal,
  commandRunner,
  resultValidator,
}) {
  await reserveRunRoot(plan);
  const startedAt = Date.now();
  let lock = null;
  let commandResult = null;
  let experiment = null;
  let runError = null;
  let status = 'FAIL';
  let reviewRecommended = false;
  let reasonCode = null;
  const cleanup = [];
  try {
    lock = await acquireResourceLock(plan);
    commandResult = await commandRunner(plan, { signal });
    experiment = await readExperimentArtifacts(plan, resultValidator);
    status = 'PASS';
    reviewRecommended = experiment.result.overallStatus !== 'pass';
    reasonCode = reviewRecommended ? OBSERVED_GATE_REVIEW_REASON : null;
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
  const gateSummary = experiment
    ? createGateSummary(experiment.result)
    : null;
  const domainResult = Object.freeze({
    contractVersion: 1,
    target: Object.freeze({
      id: plan.targetId,
      mode: plan.mode,
      scope: SCOPE,
    }),
    inputConfig: plan.experimentConfig,
    source: Object.freeze({
      adapterRevision: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION,
      runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
      experimentContract: plan.experimentContract,
      snapshot: plan.sourceSnapshot,
    }),
    execution: Object.freeze({
      command: plan.command,
      durationMs,
      runAttempts: 1,
      retries: 0,
      modelCalls: 0,
      stdoutUsedForStatus: false,
      stdoutBytes: commandResult?.stdoutBytes ?? 0,
      stderrBytes: commandResult?.stderrBytes ?? 0,
    }),
    artifacts: experiment?.artifacts || Object.freeze([]),
    gateSummary,
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
        type: 'STRUCTURAL_SMOKE_STARTED',
      }),
      JSON.stringify({
        contractVersion: 1,
        runId: plan.runId,
        type: 'STRUCTURAL_SMOKE_FINISHED',
        status,
        durationMs,
      }),
      '',
    ].join('\n'),
  );
  const reportPath = path.join(plan.runRoot, 'run.json');
  await writeJsonAtomic(reportPath, report);
  const reportBytes = await fs.readFile(reportPath);
  const envelope = createProjectHarnessResultEnvelope({
    adapterId: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID,
    adapterRevision: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION,
    runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
    plan,
    planDigest: createProjectHarnessPlanDigest({
      adapterId: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID,
      adapterRevision: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION,
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

export function createZenBonsaiMorphologyHarnessAdapter({
  sourceSnapshotLoader = readZenBonsaiMorphologySourceSnapshot,
  commandRunner = executeCommand,
  resultValidator = validateMorphologyExperimentResult,
} = {}) {
  return Object.freeze({
    id: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID,
    revision: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION,
    runtimeRevision: PROJECT_HARNESS_RUNTIME_REVISION,
    title: TARGET.title,
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,

    list() {
      return Object.freeze([TARGET]);
    },

    describe({ targetId } = {}) {
      if (targetId !== TARGET.id) {
        fail('PROJECT_HARNESS_BONSAI_TARGET_UNSUPPORTED', targetId);
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
        adapterId: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID,
        adapterRevision: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION,
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
        adapterId: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_ID,
        adapterRevision: ZEN_BONSAI_MORPHOLOGY_HARNESS_ADAPTER_REVISION,
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
        commandRunner,
        resultValidator,
      });
    },

    classifyError(error) {
      return classifyRunError(error, null);
    },
  });
}

export const zenBonsaiMorphologyHarnessAdapter =
  createZenBonsaiMorphologyHarnessAdapter();
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
