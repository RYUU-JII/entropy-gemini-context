#!/usr/bin/env node

import {
  assessCurrentRuntime,
  describeRuntimeRequirement,
} from './runtimeProfile.mjs';

const runtime = assessCurrentRuntime();

if (runtime.isSupported) {
  process.exit(0);
}

const requirementLines = describeRuntimeRequirement(runtime)
  .map((line) => `[runtime] ${line}`);

console.error(
  [
    `[runtime] Unsupported Node.js runtime: found ${runtime.currentNode}.`,
    ...requirementLines,
    '[runtime] Run `source "$HOME/.nvm/nvm.sh" && nvm use` before build/test/dev commands.',
    '[runtime] Use `npm run doctor:runtime` for a full environment summary.',
  ].join('\n'),
);

process.exit(1);
