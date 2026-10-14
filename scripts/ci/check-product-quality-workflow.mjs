#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const workflowPath = '.github/workflows/quality-gate.yml';
const workflowsDir = '.github/workflows';
const immutableActionRefPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^@\s]+)?@[0-9a-f]{40}$/;

function fail(message) {
  console.error(`[product-quality-workflow] FAIL: ${message}`);
  process.exit(1);
}

const source = await fs.readFile(path.resolve(rootDir, workflowPath), 'utf8').catch((error) => {
  fail(`${workflowPath} is required: ${error?.message || error}`);
});

const workflowEntries = await fs.readdir(path.resolve(rootDir, workflowsDir), {
  recursive: true,
  withFileTypes: true,
}).catch((error) => {
  fail(`${workflowsDir} is required: ${error?.message || error}`);
});

for (const entry of workflowEntries) {
  if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;

  const absolutePath = path.join(entry.parentPath, entry.name);
  const relativePath = path.relative(rootDir, absolutePath);
  const workflowSource = await fs.readFile(absolutePath, 'utf8');
  const actionReferences = [...workflowSource.matchAll(/^\s*uses:\s*['"]?([^'"#\s]+)['"]?/gm)];

  for (const [, actionReference] of actionReferences) {
    if (actionReference.startsWith('./')) continue;
    if (!immutableActionRefPattern.test(actionReference)) {
      fail(`${relativePath} must pin external action "${actionReference}" to an immutable 40-character commit SHA`);
    }
  }
}

[
  'pull_request:',
  'push:',
  '- main',
  'permissions:',
  'contents: read',
  'cancel-in-progress: true',
  'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
  'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
  'node-version-file: .nvmrc',
  'cache: npm',
  'npm ci',
  'npm run gate:product',
].forEach((token) => {
  if (!source.includes(token)) fail(`${workflowPath} must include "${token}"`);
});

console.log('[product-quality-workflow] PASS');
