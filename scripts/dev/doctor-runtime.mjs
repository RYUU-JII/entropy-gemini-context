#!/usr/bin/env node

import { assessCurrentRuntime, shouldUseLinuxTmp } from './runtimeProfile.mjs';

const runtime = assessCurrentRuntime();
const usingMountedWindowsTmp = shouldUseLinuxTmp(process.env);

console.log(`repo: ${runtime.repoRoot}`);
console.log(`current node: ${runtime.currentNode}`);
if (runtime.minimumNode) {
  console.log(`minimum node: ${runtime.minimumNode}`);
}
if (runtime.preferredNode) {
  console.log(`project .nvmrc preference: ${runtime.preferredNode}`);
}
console.log(`supported runtime: ${runtime.isSupported ? 'yes' : 'no'}`);
console.log(`.nvmrc preference match: ${runtime.matchesPreferred ? 'yes' : 'no'}`);
console.log(`TMPDIR: ${process.env.TMPDIR || ''}`);
console.log(`TMP: ${process.env.TMP || ''}`);
console.log(`TEMP: ${process.env.TEMP || ''}`);
console.log(`mounted windows temp detected: ${usingMountedWindowsTmp ? 'yes' : 'no'}`);

if (!runtime.isSupported) {
  console.error('[runtime] Fix with: source "$HOME/.nvm/nvm.sh" && nvm use');
  process.exit(1);
}
