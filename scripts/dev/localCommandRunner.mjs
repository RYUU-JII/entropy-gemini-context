import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildSpawnEnv } from './runtimeProfile.mjs';

const require = createRequire(import.meta.url);

function resolveCommandArgs(command, args) {
  if (command === 'node') return args;

  const entry = command === 'vite'
    ? ['vite/package.json', 'bin/vite.js']
    : command === 'vitest'
      ? ['vitest/package.json', 'vitest.mjs']
      : null;
  if (!entry) {
    throw new Error('LOCAL_COMMAND_NOT_ALLOWED: expected node, vite, or vitest.');
  }

  // Resolve from this checkout, rather than executing a PATH-selected .cmd shim.
  const packageDir = path.dirname(require.resolve(entry[0]));
  return [path.join(packageDir, entry[1]), ...args];
}

export function spawnLocalCommand(command, args, {
  cwd = process.cwd(),
  env = process.env,
  stdio = 'inherit',
} = {}) {
  return spawn(process.execPath, resolveCommandArgs(command, args), {
    cwd,
    env: buildSpawnEnv(env),
    shell: false,
    stdio,
    windowsHide: true,
  });
}
