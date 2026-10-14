#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyQaErrorStatus,
} from '../qa/contracts/qaEvidenceContract.mjs';
import {
  QA_RUN_STATUSES,
} from '../qa/contracts/qaTargetContract.mjs';
import {
  runQaTarget,
} from '../qa/entropyQa.mjs';
import {
  createQaSignalCoordinator,
} from '../qa/runtime/qaSignalCoordinator.mjs';
import {
  listFeedHorizonQaTargets,
  resolveFeedHorizonQaMode,
  resolveFeedHorizonQaPreset,
} from './feedHorizonQaPresetCatalog.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '../..');
const DEFAULT_CONFIG_PATH = path.join(
  rootDir,
  '.artifacts',
  'entropy-qa.local.json',
);
const DEFAULT_HOLD_MS = 10_000;
const DEFAULT_DWELL_MS = 1_350;

function statusExitCode(status) {
  if (status === QA_RUN_STATUSES.PASS) return 0;
  if (status === QA_RUN_STATUSES.BLOCKED) return 2;
  if (status === QA_RUN_STATUSES.INCONCLUSIVE) return 3;
  return 1;
}

function parseInteger(value, code, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(`${code}:${String(value)}`);
  }
  return numeric;
}

export function parseFeedHorizonQaArgs(argv) {
  const options = {
    mode: null,
    target: null,
    configPath: DEFAULT_CONFIG_PATH,
    holdMs: DEFAULT_HOLD_MS,
    dwellMs: DEFAULT_DWELL_MS,
    rebuild: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--mode=')) {
      options.mode = resolveFeedHorizonQaMode(arg.slice('--mode='.length));
    } else if (arg.startsWith('--target=')) {
      options.target = resolveFeedHorizonQaPreset(arg.slice('--target='.length)).target;
    } else if (arg.startsWith('--config=')) {
      const configPath = arg.slice('--config='.length);
      if (!path.isAbsolute(configPath)) {
        throw new Error('FEED_HORIZON_QA_CONFIG_ABSOLUTE_REQUIRED');
      }
      options.configPath = path.normalize(configPath);
    } else if (arg.startsWith('--hold-ms=')) {
      options.holdMs = parseInteger(
        arg.slice('--hold-ms='.length),
        'FEED_HORIZON_QA_HOLD_MS_INVALID',
        0,
        30_000,
      );
    } else if (arg.startsWith('--dwell-ms=')) {
      options.dwellMs = parseInteger(
        arg.slice('--dwell-ms='.length),
        'FEED_HORIZON_QA_DWELL_MS_INVALID',
        900,
        7_000,
      );
    } else if (arg === '--rebuild') {
      options.rebuild = true;
    } else {
      throw new Error(`FEED_HORIZON_QA_ARGUMENT_UNKNOWN:${arg}`);
    }
  }
  if (!options.mode) throw new Error('FEED_HORIZON_QA_MODE_REQUIRED');
  if (!options.target) throw new Error('FEED_HORIZON_QA_TARGET_REQUIRED');
  return Object.freeze(options);
}

export async function runFeedHorizonQa(options, { signal = null } = {}) {
  const preset = resolveFeedHorizonQaPreset(options.target);
  return runQaTarget({
    rootDir,
    targetId: preset.qaTargetId,
    mode: options.mode,
    configPath: options.configPath,
    rawParameters: {
      'hold-ms': options.holdMs,
      'dwell-ms': options.dwellMs,
      rebuild: options.rebuild,
    },
    signal,
  });
}

async function main() {
  const options = parseFeedHorizonQaArgs(process.argv.slice(2));
  const signalCoordinator = createQaSignalCoordinator();
  try {
    const report = await runFeedHorizonQa(options, {
      signal: signalCoordinator.signal,
    });
    process.stdout.write(JSON.stringify({
      event: 'QA_RUN_COMPLETE',
      runId: report.runId,
      targetId: report.targetId,
      status: report.status,
      legacyEntrypoint: 'qa:feed-horizon',
    }) + '\n');
    process.exitCode = statusExitCode(report.status);
  } finally {
    signalCoordinator.dispose();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    const status = classifyQaErrorStatus(error);
    process.stderr.write(
      `[feed-horizon-qa] ${status} ${error?.stack || error?.message || error}\n`,
    );
    if (error?.message?.includes('FEED_HORIZON_QA_TARGET_UNSUPPORTED')) {
      process.stderr.write(
        `[feed-horizon-qa] targets=${listFeedHorizonQaTargets().join(',')}\n`,
      );
    }
    process.exitCode = statusExitCode(status);
  });
}
