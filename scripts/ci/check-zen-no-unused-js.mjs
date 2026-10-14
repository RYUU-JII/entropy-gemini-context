#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Use the installed CLI with the active Node runtime; a bare ESLint command
// resolves to a .cmd shim on Windows and cannot be spawned without a shell.
const eslintBin = fileURLToPath(new URL('bin/eslint.js', import.meta.resolve('eslint/package.json')));
const lintTargets = [
  'src/themes/plugins/zen/widgets/core/**/*.js',
  'src/platform/workers/**/*.js',
];
const lintArgs = [
  ...lintTargets,
  '--rule',
  'no-unused-vars: [2, {"argsIgnorePattern":"^_","varsIgnorePattern":"^_"}]',
];

const run = (args) => spawnSync(process.execPath, [eslintBin, ...args], {
  stdio: 'inherit',
  shell: false,
});

const versionResult = run(['--version']);
if (versionResult.status !== 0) {
  console.error('[check:zen:no-unused-js] ESLint is not available.');
  process.exit(versionResult.status ?? 1);
}

const lintResult = run(lintArgs);
process.exit(lintResult.status ?? 1);
