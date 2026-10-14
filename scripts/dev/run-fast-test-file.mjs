#!/usr/bin/env node

import {
  assessCurrentRuntime,
  describeRuntimeRequirement,
} from './runtimeProfile.mjs';
import { classifyFastTestFile } from './fastTestProfile.mjs';
import { spawnLocalCommand } from './localCommandRunner.mjs';

const runtime = assessCurrentRuntime();
const rawFiles = process.argv.slice(2);

if (!runtime.isSupported) {
  const requirementLines = describeRuntimeRequirement(runtime)
    .map((line) => `[runtime] ${line}`);
  console.error(
    [
      `[runtime] Unsupported Node.js runtime: found ${runtime.currentNode}.`,
      ...requirementLines,
      '[runtime] Run `source "$HOME/.nvm/nvm.sh" && nvm use` before local workflow commands.',
    ].join('\n'),
  );
  process.exit(1);
}

if (rawFiles.length === 0) {
  console.error('[test:file:fast] Provide at least one test file path.');
  process.exit(1);
}

const groups = {
  logic: [],
  dom: [],
  full: [],
};

for (const file of rawFiles) {
  groups[classifyFastTestFile(file)].push(String(file));
}

const runs = [
  {
    files: groups.logic,
    args: ['vitest', 'run', '--config', 'vitest.fast.logic.config.js'],
  },
  {
    files: groups.dom,
    args: ['vitest', 'run', '--config', 'vitest.fast.dom.config.js'],
  },
  {
    files: groups.full,
    args: ['vitest', 'run'],
  },
].filter((entry) => entry.files.length > 0);

for (const run of runs) {
  const exitCode = await new Promise((resolve) => {
    const child = spawnLocalCommand(run.args[0], [...run.args.slice(1), ...run.files]);

    child.once('error', (error) => {
      console.error(`[test:file:fast] ${error.message}`);
      resolve(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
