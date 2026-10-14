#!/usr/bin/env node

import {
  assessCurrentRuntime,
  describeRuntimeRequirement,
} from './runtimeProfile.mjs';
import { spawnLocalCommand } from './localCommandRunner.mjs';

const runtime = assessCurrentRuntime();
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('[run-local-command] Missing command to run.');
  process.exit(1);
}

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

let child;
try {
  child = spawnLocalCommand(command, args);
} catch (error) {
  console.error(`[run-local-command] ${error.message}`);
  process.exit(1);
}

child.once('error', (error) => {
  console.error(`[run-local-command] ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
