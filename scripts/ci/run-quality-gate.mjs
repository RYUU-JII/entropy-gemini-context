#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildCheckPlan } from './run-build-checks.mjs';

const npmStep = (name, script) => Object.freeze({
  name,
  script,
});
const buildChecksStep = (name, phase) => Object.freeze({
  ...npmStep(name, `profile:checks:${phase}`),
  phase,
});

const structuralSteps = Object.freeze([
  npmStep('zen-pond-static-assets', 'generate:zen:pond-static-assets'),
  npmStep('lint', 'lint'),
  buildChecksStep('structural-contracts', 'structural'),
  npmStep('zen-no-unused-js', 'check:zen:no-unused-js'),
]);

const releaseStructuralSteps = Object.freeze([
  npmStep('zen-pond-static-assets', 'generate:zen:pond-static-assets'),
  npmStep('lint', 'lint'),
  buildChecksStep('release-structural-contracts', 'release'),
  npmStep('zen-no-unused-js', 'check:zen:no-unused-js'),
]);

const artifactSteps = Object.freeze([
  npmStep('public-artifact', 'build:artifact'),
  npmStep('bundle-budget', 'check:bundle:budget'),
  npmStep('context-bundle-budget', 'check:bundle:context-budget'),
  npmStep(
    'zen-home-renderer-worker-artifact',
    'check:zen-home-renderer-worker:artifact-contract',
  ),
]);

const profiles = Object.freeze({
  structural: structuralSteps,
  product: Object.freeze([
    ...structuralSteps,
    ...artifactSteps,
    npmStep('release-tests', 'test'),
  ]),
  release: Object.freeze([
    ...releaseStructuralSteps,
    ...artifactSteps,
    npmStep('release-tests-with-coverage', 'test:coverage:ci'),
    npmStep('coverage-budget', 'check:coverage:budget'),
  ]),
  coverage: Object.freeze([
    npmStep('release-tests-with-coverage', 'test:coverage:ci'),
    npmStep('coverage-budget', 'check:coverage:budget'),
  ]),
  research: Object.freeze([
    npmStep('detached-research-tests', 'test:research'),
  ]),
  maintainability: Object.freeze([
    npmStep('line-budget', 'check:line:budget'),
  ]),
});

export function createQualityGatePlan(profile = 'product', {
  packageScripts = JSON.parse(
    fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ).scripts,
} = {}) {
  if (!Object.hasOwn(profiles, profile)) {
    throw new Error(`QUALITY_GATE_PROFILE_UNKNOWN:${profile}`);
  }
  const steps = profiles[profile].map((step) => {
    const command = packageScripts[step.script];
    if (typeof command !== 'string' || !command.trim()) {
      throw new Error(`QUALITY_GATE_SCRIPT_MISSING:${step.script}`);
    }
    if (!step.phase) return { ...step, command };
    // A nested plan must describe the phase the package command actually runs.
    if (command !== `node ./scripts/ci/run-build-checks.mjs --phase=${step.phase}`) {
      throw new Error(`QUALITY_GATE_PHASE_COMMAND_MISMATCH:${step.script}`);
    }
    return {
      ...step,
      command,
      checks: createBuildCheckPlan(step.phase, { packageScripts }).steps,
    };
  });
  return { schemaVersion: 1, kind: 'quality-gate', profile, steps };
}

export function runQualityGatePlan(plan, {
  spawn = spawnSync,
  platform = process.platform,
  env = process.env,
  logger = console,
} = {}) {
  if (platform === 'win32' && !env.npm_execpath) {
    throw new Error('QUALITY_GATE_NPM_CLI_REQUIRED');
  }
  const command = platform === 'win32' ? process.execPath : 'npm';
  logger.log(`[quality-gate:${plan.profile}] selected ${plan.steps.length} owned step(s).`);
  for (const step of plan.steps) {
    const args = platform === 'win32'
      ? [env.npm_execpath, 'run', step.script]
      : ['run', step.script];
    const startedAt = Date.now();
    logger.log(`[quality-gate:${plan.profile}] START ${step.name}: ${command} ${args.join(' ')}`);
    const result = spawn(command, args, { env, stdio: 'inherit' });
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);
    const status = Number.isInteger(result.status) ? result.status : 1;
    if (status !== 0) {
      if (result.error) logger.error(result.error);
      logger.error(
        `[quality-gate:${plan.profile}] FAIL ${step.name}: exit=${status} duration=${elapsedSec}s`,
      );
      return status;
    }
    logger.log(`[quality-gate:${plan.profile}] PASS ${step.name}: duration=${elapsedSec}s`);
  }
  logger.log(`[quality-gate:${plan.profile}] PASS: all owned checks succeeded.`);
  return 0;
}

function main(args) {
  const profileArgs = args.filter((arg) => arg.startsWith('--profile='));
  if (profileArgs.length > 1 || args.some((arg) => (
    !arg.startsWith('--profile=') && arg !== '--plan' && arg !== '--json'
  )) || (args.includes('--json') && !args.includes('--plan'))) {
    throw new Error('QUALITY_GATE_ARGUMENT_INVALID: use --profile=<profile> [--plan [--json]]');
  }
  const profile = profileArgs.length === 1 ? profileArgs[0].slice('--profile='.length) : 'product';
  const plan = createQualityGatePlan(profile);
  if (args.includes('--plan')) {
    console.log(args.includes('--json')
      ? JSON.stringify(plan, null, 2)
      : plan.steps.map((step, index) => `${index + 1}. ${step.script}`).join('\n'));
    return 0;
  }
  return runQualityGatePlan(plan);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`[quality-gate] ${error.message}`);
    process.exitCode = 1;
  }
}
