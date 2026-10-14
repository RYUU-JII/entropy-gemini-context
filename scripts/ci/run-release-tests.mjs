#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectReleaseTestLane, RELEASE_TEST_LANE_ENV } from './releaseTestLane.mjs';

export function createReleaseTestExecution(rawArgs, { lane, env = process.env } = {}) {
  const researchMode = rawArgs.includes('--research');
  const coverageMode = rawArgs.includes('--coverage');
  const coverageCiMode = rawArgs.includes('--coverage-ci');
  const serialMode = rawArgs.includes('--serial');
  const passthroughArgs = rawArgs.filter((argument) => ![
    '--research',
    '--coverage',
    '--coverage-ci',
    '--serial',
  ].includes(argument));

  if (coverageMode && coverageCiMode) {
    throw new Error('RELEASE_TEST_LANE_COVERAGE_MODE_CONFLICT');
  }
  // Root/config overrides can prevent Vitest from loading the named lane config.
  // Cover negated long options, aliases, and bundled short options too.
  if (passthroughArgs.some((argument) => (
    /^--(?:no-)?(?:config|root|c|r)(?:=|$)|^-(?!-)[^=]*[cr]/u.test(argument)
  ))) {
    throw new Error('RELEASE_TEST_LANE_CONFIG_OVERRIDE_FORBIDDEN');
  }

  const collected = lane ?? collectReleaseTestLane();
  const selectedTests = researchMode ? collected.researchTests : collected.releaseTests;
  const hasWorkerOverride = passthroughArgs.some((argument) => /^--max(?:Workers|-workers)(?:=|$)/u.test(argument));
  const coverageArgs = coverageCiMode
    ? ['--coverage', '--coverage.reportOnFailure', '--coverage.reporter=text', '--coverage.reporter=json-summary',
      ...(hasWorkerOverride ? [] : ['--maxWorkers=2'])]
    : coverageMode
      ? ['--coverage']
      : [];
  return {
    laneName: researchMode ? 'detached-research' : 'release',
    selectedCount: selectedTests.length,
    releaseCount: collected.releaseTests.length,
    researchCount: collected.researchTests.length,
    args: [
      './scripts/dev/run-local-command.mjs',
      'vitest',
      'run',
      ...coverageArgs,
      ...(serialMode ? ['--no-file-parallelism'] : []),
      ...passthroughArgs,
    ],
    env: { ...env, [RELEASE_TEST_LANE_ENV]: researchMode ? 'research' : 'release' },
  };
}

function main() {
  const execution = createReleaseTestExecution(process.argv.slice(2));
  console.log(
    `[test-lane] ${execution.laneName}: selected=${execution.selectedCount} `
    + `release=${execution.releaseCount} research=${execution.researchCount}`,
  );

  const child = spawn(process.execPath, execution.args, {
    cwd: process.cwd(),
    env: execution.env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
