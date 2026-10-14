#!/usr/bin/env node

import { spawn } from 'node:child_process';

const [xvfbPath, width = '1280', height = '720', depth = '24'] = process.argv.slice(2);
if (!xvfbPath) {
  process.stderr.write('QA_MANAGED_XVFB_EXECUTABLE_REQUIRED\n');
  process.exit(1);
}

const xvfb = spawn(xvfbPath, [
  '-displayfd',
  '3',
  '-screen',
  '0',
  `${width}x${height}x${depth}`,
  '-nolisten',
  'tcp',
  '-noreset',
], {
  stdio: ['ignore', 'ignore', 'pipe', 'pipe'],
});

let settled = false;
let displayOutput = '';
let stderrOutput = '';
let terminating = false;

function terminate() {
  if (terminating) return;
  terminating = true;
  if (xvfb.exitCode === null && xvfb.signalCode === null) xvfb.kill('SIGTERM');
  setTimeout(() => {
    if (xvfb.exitCode === null && xvfb.signalCode === null) xvfb.kill('SIGKILL');
  }, 1_500).unref();
}

xvfb.stdio[3].setEncoding('utf8');
xvfb.stdio[3].on('data', (chunk) => {
  displayOutput += chunk;
  const line = displayOutput.split(/\r?\n/u)[0]?.trim();
  if (settled || !/^\d+$/u.test(line || '')) return;
  settled = true;
  process.stdout.write(`${JSON.stringify({ display: `:${line}`, xvfbPid: xvfb.pid })}\n`);
});

xvfb.stderr.setEncoding('utf8');
xvfb.stderr.on('data', (chunk) => {
  stderrOutput = `${stderrOutput}${chunk}`.slice(-4_000);
});

xvfb.on('error', (error) => {
  process.stderr.write(`QA_MANAGED_XVFB_START_FAILED:${error?.message || error}\n`);
  process.exit(1);
});

xvfb.on('exit', (code, signal) => {
  if (!terminating && !settled) {
    process.stderr.write(
      `QA_MANAGED_XVFB_EARLY_EXIT:${code ?? 'null'}:${signal || 'none'}:${stderrOutput}\n`,
    );
    process.exitCode = 1;
  }
  process.exit();
});

process.stdin.resume();
process.stdin.on('end', terminate);
process.stdin.on('close', terminate);
process.on('SIGINT', terminate);
process.on('SIGTERM', terminate);
