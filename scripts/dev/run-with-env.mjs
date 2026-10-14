#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { buildSpawnEnv } from './runtimeProfile.mjs';

const args = process.argv.slice(2);
const separator = args.indexOf('--');
if (separator < 1) throw new Error('RUN_WITH_ENV_ASSIGNMENTS_REQUIRED');
const env = buildSpawnEnv(process.env);
for (const assignment of args.splice(0, separator + 1).slice(0, -1)) {
  const match = assignment.match(/^([A-Za-z_][A-Za-z0-9_]*)=([^\r\n]*)$/u);
  if (!match) throw new Error('RUN_WITH_ENV_ASSIGNMENT_INVALID');
  env[match[1]] = match[2];
}
const command = args.shift();
if (command === 'npm') {
  if (!process.env.npm_execpath) throw new Error('RUN_WITH_ENV_NPM_CLI_REQUIRED');
  args.unshift(process.env.npm_execpath);
} else if (command !== 'node') {
  throw new Error('RUN_WITH_ENV_NODE_OR_NPM_REQUIRED');
}
const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
child.once('error', (error) => { console.error(error); process.exitCode = 1; });
child.once('exit', (code, signal) => {
  if (signal) { process.kill(process.pid, signal); return; }
  process.exitCode = code ?? 1;
});
