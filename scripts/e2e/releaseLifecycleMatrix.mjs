#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  admitQaExtensionBrowserChildExecution,
} from '../qa/contracts/qaBrowserChildExecutionContract.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../..');
const DEFAULT_DIST_DIR = 'dist-prod';
const DEFAULT_REPORT_DIR = '/tmp/entropy-release-lifecycle-matrix';

const DATA_LIFECYCLE_TEST_FILES = Object.freeze([
  'tests/backgroundMaintenanceCoordinator.test.js',
  'tests/backgroundStorageSnapshotService.test.js',
  'tests/storageSnapshotService.test.js',
  'tests/storageSnapshotCapability.test.js',
  'tests/mv3DataLifecycleEncryptedContract.test.js',
  'tests/mv3DataLifecycleCspContract.test.js',
  'tests/securityVaultQaFixture.test.js',
  'tests/cwsSecurityVaultPreparation.test.js',
  'tests/cwsHistoryCleanupLifecycleScenario.test.js',
  'tests/keyStore.test.js',
  'tests/settingsPersistenceCapability.test.js',
  'tests/cryptoService.test.js',
  'tests/hmacKeyContract.test.js',
  'tests/trackingMessageHandlerSecurity.test.js',
  'tests/indexedDbImportSnapshotHardening.test.js',
  'tests/personalBaselineDataLifecycle.integration.test.js',
  'tests/clseMaterializedBaselineLifecycle.integration.test.js',
]);

const NUDGE_LIFECYCLE_TEST_FILES = Object.freeze([
  'tests/nudgeSessionRuntimeContracts.test.js',
  'tests/nudgeSessionOwnerState.test.js',
  'tests/nudgeManagerConcurrencyContract.test.js',
  'tests/nudgeTerminalEffectCoordinator.test.js',
  'tests/protectionNudgeTeardownCoordinator.test.js',
  'tests/nudgeGameLifecycle.test.js',
  'tests/nudgeWindowBlurController.test.js',
  'tests/nudgeCyclePolicy.test.js',
  'tests/strategyEffectivenessTracker.test.js',
  'tests/trackingServiceBootstrap.test.js',
  'tests/protectionNudgeDispatchGate.test.js',
  'tests/protectionNudgeDispatchMessageBuilder.test.js',
  'tests/protectionNudgeDispatchRunner.test.js',
  'tests/protectionControllerNudgeDebugSpawn.test.js',
  'tests/sentinelProtocolHostSessionModel.test.js',
  'tests/supportDebugPolicy.test.js',
  'tests/trackingBrowserEventHandlers.test.js',
  'tests/trackingMessageHandlerNudgeLifecycleContract.test.js',
]);

function parseArgs(argv) {
  const options = {
    distDir: DEFAULT_DIST_DIR,
    reportDir: DEFAULT_REPORT_DIR,
    headless: true,
    keepTemp: false,
    sourceOnly: false,
    browserOnly: false,
  };
  for (const arg of argv) {
    if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else if (arg === '--source-only') {
      options.sourceOnly = true;
    } else if (arg === '--browser-only') {
      options.browserOnly = true;
    } else if (arg.startsWith('--dist=')) {
      options.distDir = arg.slice('--dist='.length);
    } else if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
    }
  }
  if (options.sourceOnly && options.browserOnly) {
    throw new Error('RELEASE_LIFECYCLE_MATRIX_MODE_CONFLICT');
  }
  return options;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function runStep(step) {
  const startedAt = Date.now();
  console.log(`[release-lifecycle-matrix] START ${step.id}`);
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });
  const durationMs = Date.now() - startedAt;
  const status = Number.isInteger(result.status) ? result.status : 1;
  const outcome = {
    id: step.id,
    status: status === 0 ? 'passed' : 'failed',
    exitCode: status,
    signal: result.signal || null,
    durationMs,
  };
  if (result.error) outcome.error = result.error.message;
  console.log(
    `[release-lifecycle-matrix] ${status === 0 ? 'PASS' : 'FAIL'} ${step.id} durationMs=${durationMs}`,
  );
  return outcome;
}

async function writeReport(report, reportDir) {
  const resolvedReportDir = path.resolve(rootDir, reportDir);
  await fs.mkdir(resolvedReportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(resolvedReportDir, `release-lifecycle-matrix-${stamp}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

async function main() {
  const options = admitQaExtensionBrowserChildExecution(
    parseArgs(process.argv.slice(2)),
  );
  const distPath = path.resolve(rootDir, options.distDir);
  if (!options.sourceOnly && !(await pathExists(path.join(distPath, 'manifest.json')))) {
    throw new Error(`RELEASE_LIFECYCLE_DIST_NOT_FOUND:${distPath}`);
  }

  const browserModeArg = options.headless ? '--headless' : '--headed';
  const keepTempArgs = options.keepTemp ? ['--keep-temp'] : [];
  const reportRoot = path.resolve(rootDir, options.reportDir);
  const sourceSteps = [
    {
      id: 'release-v1-baseline-contract',
      command: process.execPath,
      args: ['scripts/ci/check-release-v1-baseline.mjs'],
    },
    {
      id: 'storage-architecture-contract',
      command: process.execPath,
      args: ['scripts/ci/check-storage-architecture-boundaries.mjs'],
    },
    {
      id: 'personal-baseline-architecture-contract',
      command: process.execPath,
      args: ['scripts/ci/check-personal-baseline-architecture.mjs'],
    },
    {
      id: 'legacy-free-topology-contract',
      command: process.execPath,
      args: ['scripts/ci/check-final-topology-legacy-free.mjs'],
    },
    {
      id: 'background-nudge-owner-contract',
      command: process.execPath,
      args: ['scripts/ci/check-background-app-kernel-architecture.mjs'],
    },
    {
      id: 'nudge-session-lifecycle-tests',
      command: process.execPath,
      args: ['scripts/dev/run-fast-test-file.mjs', ...NUDGE_LIFECYCLE_TEST_FILES],
    },
    {
      id: 'storage-data-owner-chain-tests',
      command: process.execPath,
      args: ['scripts/dev/run-fast-test-file.mjs', ...DATA_LIFECYCLE_TEST_FILES],
    },
  ];
  const browserSteps = [
    {
      id: 'built-content-runtime-contract',
      command: process.execPath,
      args: ['scripts/ci/check-content-runtime-browser-like-contract.mjs', distPath],
    },
    {
      id: 'mv3-runtime-lifecycle',
      command: process.execPath,
      args: [
        'scripts/e2e/mv3LifecycleE2E.mjs',
        `--dist=${distPath}`,
        `--report-dir=${path.join(reportRoot, 'mv3-runtime')}`,
        browserModeArg,
        ...keepTempArgs,
      ],
    },
    {
      id: 'mv3-data-lifecycle',
      command: process.execPath,
      args: [
        'scripts/e2e/mv3DataLifecycleE2E.mjs',
        `--dist=${distPath}`,
        `--report-dir=${path.join(reportRoot, 'mv3-data')}`,
        browserModeArg,
        ...keepTempArgs,
      ],
    },
  ];
  const steps = options.sourceOnly
    ? sourceSteps
    : options.browserOnly
      ? browserSteps
      : [...sourceSteps, ...browserSteps];
  const outcomes = [];
  for (const step of steps) {
    const outcome = runStep(step);
    outcomes.push(outcome);
    if (outcome.status !== 'passed') break;
  }
  const passed = outcomes.length === steps.length
    && outcomes.every((outcome) => outcome.status === 'passed');
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: options.sourceOnly ? 'source-only' : options.browserOnly ? 'browser-only' : 'full',
    distDir: options.sourceOnly ? null : path.relative(rootDir, distPath),
    passed,
    expectedStepCount: steps.length,
    completedStepCount: outcomes.length,
    steps: outcomes,
  };
  const reportPath = await writeReport(report, options.reportDir);
  console.log(`[release-lifecycle-matrix] report=${reportPath}`);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[release-lifecycle-matrix] FAIL ${error?.stack || error}`);
  process.exitCode = 1;
});
