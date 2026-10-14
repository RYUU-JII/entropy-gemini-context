#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  admitQaExtensionBrowserChildExecution,
} from '../qa/contracts/qaBrowserChildExecutionContract.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../..');
const runtimeHarnessPath = path.join(rootDir, 'scripts/perf/measureCwsRuntime.mjs');
const forwardedArgs = process.argv.slice(2);

function hasArg(prefix) {
  return forwardedArgs.some((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
}

function resolveEffectiveHeadless(args) {
  let headless = true;
  for (const arg of args) {
    if (arg === '--headless') headless = true;
    if (arg === '--headed' || arg === '--headed-software-gl') headless = false;
  }
  return headless;
}

const defaults = [
  '--lifecycle',
  ...(hasArg('--iterations') ? [] : ['--iterations=1']),
  ...(hasArg('--cards') ? [] : ['--cards=24']),
  ...(hasArg('--churn') ? [] : ['--churn=40']),
  ...(hasArg('--idle-ms') ? [] : ['--idle-ms=1000']),
  ...(hasArg('--settle-ms') ? [] : ['--settle-ms=250']),
  ...(hasArg('--report-dir') ? [] : ['--report-dir=/tmp/entropy-mv3-lifecycle-e2e']),
  ...(forwardedArgs.some((arg) => [
    '--headed',
    '--headless',
    '--headed-software-gl',
  ].includes(arg)) ? [] : ['--headless']),
];
const effectiveBrowserArgs = [...defaults, ...forwardedArgs];
const effectiveHeadless = resolveEffectiveHeadless(effectiveBrowserArgs);
const browserOptions = admitQaExtensionBrowserChildExecution({
  headless: effectiveHeadless,
  renderingRequirement: forwardedArgs.includes('--require-dashboard-visual-threshold')
    ? 'physical_gpu_required'
    : effectiveHeadless
      ? 'headless_ok'
      : 'headed_required',
});

const chromeBin = process.env.CHROME_BIN || chromium.executablePath();
const result = spawnSync(
  process.execPath,
  [runtimeHarnessPath, ...defaults, ...forwardedArgs],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      CHROME_BIN: chromeBin,
      QA_BROWSER_RENDERING_REQUIREMENT: browserOptions.renderingRequirement,
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error('[mv3-lifecycle-e2e] Failed to start Chromium harness:', result.error);
  process.exit(1);
}
if (result.signal) {
  console.error(`[mv3-lifecycle-e2e] Chromium harness terminated by ${result.signal}.`);
  process.exit(1);
}
process.exit(Number.isInteger(result.status) ? result.status : 1);
