#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const workflowPath = '.github/workflows/mv3-lifecycle-nightly.yml';

const fail = (message) => {
  console.error(`[mv3-nightly-workflow] FAIL: ${message}`);
  process.exit(1);
};

const source = await fs.readFile(path.resolve(rootDir, workflowPath), 'utf8').catch((error) => {
  fail(`${workflowPath} is required: ${error?.message || error}`);
});

[
  'schedule:',
  'workflow_dispatch:',
  'permissions:',
  'contents: read',
  'npm ci',
  'npx playwright install --with-deps chromium',
  'npm run build:chrome',
  'npm run verify:release-lifecycle -- --dist=dist-prod',
  '--report-dir=.artifacts/ci/mv3-lifecycle',
  'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
  'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
  'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2',
  'if: always()',
].forEach((token) => {
  if (!source.includes(token)) fail(`${workflowPath} must include "${token}"`);
});

console.log('[mv3-nightly-workflow] PASS');
