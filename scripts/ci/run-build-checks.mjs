#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBuildCheckPlan } from './buildCheckManifest.mjs';

const readPackageScripts = () => JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).scripts;

export function createBuildCheckPlan(phase = 'prebuild', {
  packageScripts = readPackageScripts(),
} = {}) {
  return {
    schemaVersion: 1,
    kind: 'build-checks',
    phase,
    steps: getBuildCheckPlan(phase, { packageScripts }).map((check) => ({
      ...check,
      command: packageScripts[check.script],
    })),
  };
}

export function runBuildCheckPlan(plan, {
  spawn = spawnSync,
  platform = process.platform,
  env = process.env,
  logger = console,
} = {}) {
  for (const { script: scriptName, command: scriptCommand } of plan.steps) {
    const directNodeMatch = /^node\s+(\.\/[A-Za-z0-9_./-]+)$/u.exec(scriptCommand);
    // Windows cannot spawn a .cmd shim without a shell. Keep arguments separate
    // by invoking the npm CLI supplied by the owning npm lifecycle instead.
    const useNpmCli = !directNodeMatch && platform === 'win32';
    if (useNpmCli && !env.npm_execpath) {
      throw new Error('BUILD_CHECKS_NPM_CLI_REQUIRED');
    }
    const command = directNodeMatch || useNpmCli ? process.execPath : 'npm';
    const args = directNodeMatch
      ? [directNodeMatch[1]]
      : useNpmCli
        ? [env.npm_execpath, 'run', scriptName]
        : ['run', scriptName];
    const startedAt = Date.now();
    logger.log(`[build-checks:${plan.phase}] START ${scriptName}`);
    const result = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });
    const status = Number.isInteger(result.status) ? result.status : 1;
    const durationSec = ((Date.now() - startedAt) / 1000).toFixed(2);
    if (status !== 0) {
      if (result.error) logger.error(result.error);
      logger.error(
        `[build-checks:${plan.phase}] FAIL ${scriptName}: exit=${status} duration=${durationSec}s`,
      );
      return status;
    }
    logger.log(`[build-checks:${plan.phase}] PASS ${scriptName}: duration=${durationSec}s`);
  }
  return 0;
}

function main(args) {
  const phaseArgs = args.filter((arg) => arg.startsWith('--phase='));
  if (phaseArgs.length > 1 || args.some((arg) => (
    !arg.startsWith('--phase=') && arg !== '--plan' && arg !== '--json'
  )) || (args.includes('--json') && !args.includes('--plan'))) {
    throw new Error('BUILD_CHECKS_ARGUMENT_INVALID: use --phase=<phase> [--plan [--json]]');
  }
  const phase = phaseArgs.length === 1 ? phaseArgs[0].slice('--phase='.length) : 'prebuild';
  const plan = createBuildCheckPlan(phase);
  if (args.includes('--plan')) {
    console.log(args.includes('--json')
      ? JSON.stringify(plan, null, 2)
      : plan.steps.map((check, index) => `${index + 1}. ${check.script} [${check.category}]`).join('\n'));
    return 0;
  }
  return runBuildCheckPlan(plan);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`[build-checks] ${error.message}`);
    process.exitCode = 1;
  }
}
