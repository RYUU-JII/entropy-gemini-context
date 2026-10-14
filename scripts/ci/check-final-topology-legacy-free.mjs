#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from '@babel/parser';

const rootDir = process.cwd();
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json']);

// Deployment asset paths and comments do not import app composition. Inspect
// actual module/worker references so the layer rule remains strict without
// treating a generated CSS output path as a dependency.
function readModuleReferences(source) {
  const references = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    let reference = null;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) reference = node.source;
    if (node.type === 'CallExpression' && (node.callee?.type === 'Import' || node.callee?.name === 'require')) reference = node.arguments[0];
    if (node.type === 'NewExpression' && ['URL', 'Worker', 'SharedWorker'].includes(node.callee?.name)) reference = node.arguments[0];
    if (reference?.type === 'StringLiteral') references.push(reference.value);
    if (reference?.type === 'TemplateLiteral') references.push(reference.quasis.map(part => part.value.raw).join('${}'));
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] }));
  return references;
}

const legacyPaths = [
  'src/entries',
  'src/features',
  'src/shared',
  'src/apps/dashboard/themeBridge',
  'src/apps/background/services/faviconUtils.js',
  'src/platform/messaging/contracts/bootPrewarmContract.js',
  'src/themes/components',
  'src/themes/shared',
  'src/themes/core/index.js',
  'src/themes/zen',
  'src/themes/index.js',
  'src/themes/ids.js',
  'src/themes/profile.js',
  'src/themes/registry.js',
  'src/themes/core/widgets/shared/sites/TargetPanelViewModel.js',
  'src/domains/tracking/background/NudgeManager.js',
  'src/domains/tracking/background/nudgeManagerCore.js',
  'src/domains/tracking/background/nudgeManagerSession.js',
  'src/domains/tracking/background/nudgeManagerShared.js',
  'src/domains/tracking/background/nudgeManagerGateState.js',
  'src/domains/tracking/background/nudgeManagerLeaseState.js',
  'src/domains/tracking/background/nudgeManagerAbortState.js',
  'src/domains/tracking/background/nudgeManagerTerminalState.js',
  'src/domains/tracking/background/nudgeManagerLifecycleState.js',
  'src/domains/tracking/background/nudgeManagerPendingState.js',
  'src/apps/background/services/runtime/TrackingAnalyticsCoordinator.js',
  'src/apps/background/services/runtime/BackgroundStorageSupportService.js',
];

const scanRoots = [
  'src',
  'tests',
];

const scanFiles = [
  'vite.config.js',
  'package.json',
];

const forbiddenTokens = [
  '@/entries',
  '@/features',
  '@/shared',
  '@/themes/ids',
  '@/themes/index',
  '@/themes/core/index',
  '@/themes/profile',
  '@/themes/registry',
  '@/themes/shared',
  '@/themes/zen',
  '@/apps/dashboard/themeBridge',
  'src/entries/',
  'src/features/',
  'src/shared/',
  'src/apps/dashboard/themeBridge/',
  'src/themes/components/',
  'src/themes/shared/',
  'src/themes/core/index.js',
  'src/themes/index.js',
  'src/themes/zen/',
  '/entries',
  'nudgeManagerCore.js',
  'nudgeManagerSession.js',
  'nudgeManagerShared.js',
  'nudgeManagerGateState.js',
  'nudgeManagerLeaseState.js',
  'nudgeManagerAbortState.js',
  'nudgeManagerTerminalState.js',
  'nudgeManagerLifecycleState.js',
  'nudgeManagerPendingState.js',
  'TrackingAnalyticsCoordinator.js',
  'BackgroundStorageSupportService.js',
];

const scopedForbiddenImports = [
  {
    rootPrefixes: ['src/domains/'],
    tokens: ['@/apps/', '/apps/'],
    message: 'domain code must not import app composition owners; inject a port or use the canonical platform/domain public seam.',
  },
  {
    rootPrefixes: ['src/themes/', 'src/ui-kit/'],
    tokens: ['@/apps/dashboard/', '/apps/dashboard/'],
    message: 'theme/ui-kit code must not import dashboard owners directly.',
  },
  {
    rootPrefixes: ['src/platform/messaging/'],
    tokens: ['/domains/', '/themes/'],
    message: 'platform messaging must remain transport-only and must not import business domain or theme policy.',
  },
  {
    rootPrefixes: ['src/themes/core/widgets/shared/sites/'],
    tokens: ['domains/stats/insights/contracts/weeklyObservationContract.js'],
    message: 'theme rule widgets must consume app-owned presentation DTOs instead of stats contracts.',
  },
];

async function pathExists(relativePath) {
  try {
    await fs.access(path.resolve(rootDir, relativePath));
    return true;
  } catch (_error) {
    return false;
  }
}

async function collectFiles(relativeDir) {
  const dirPath = path.resolve(rootDir, relativeDir);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'archive') continue;
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path.relative(rootDir, absolutePath).replaceAll(path.sep, '/')));
      continue;
    }
    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    files.push(path.relative(rootDir, absolutePath).replaceAll(path.sep, '/'));
  }
  return files;
}

const violations = [];

for (const legacyPath of legacyPaths) {
  if (await pathExists(legacyPath)) {
    violations.push(`${legacyPath}: legacy topology path must not exist.`);
  }
}

const filesToScan = [];
for (const root of scanRoots) {
  filesToScan.push(...await collectFiles(root));
}
for (const file of scanFiles) {
  if (await pathExists(file)) {
    filesToScan.push(file);
  }
}

for (const relativePath of filesToScan) {
  const text = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
  for (const token of forbiddenTokens) {
    if (text.includes(token)) {
      violations.push(`${relativePath}: forbidden legacy topology token "${token}" detected.`);
    }
  }
  for (const restriction of scopedForbiddenImports) {
    if (!restriction.rootPrefixes.some((prefix) => relativePath.startsWith(prefix))) continue;
    if (path.extname(relativePath) === '.json' || !restriction.tokens.some(token => text.includes(token))) continue;
    const references = readModuleReferences(text);
    for (const token of restriction.tokens) {
      if (references.some(reference => reference.includes(token))) {
        violations.push(`${relativePath}: ${restriction.message} Found "${token}".`);
      }
    }
  }
}

const bgEntry = 'src/apps/background/index.js';
if (await pathExists(bgEntry)) {
  const source = await fs.readFile(path.resolve(rootDir, bgEntry), 'utf8');
  if (!source.includes('startTrackingService();') || source.includes('createBackgroundAppKernel')) {
    violations.push(`${bgEntry}: background service-worker entry must remain a thin startTrackingService() facade.`);
  }
}

const trackingService = 'src/apps/background/services/TrackingService.js';
if (await pathExists(trackingService)) {
  const source = await fs.readFile(path.resolve(rootDir, trackingService), 'utf8');
  if (!source.includes('startBackgroundAppKernel();') || source.includes('createTrackingProtectionService')) {
    violations.push(`${trackingService}: TrackingService.js must remain a thin startBackgroundAppKernel() facade.`);
  }
}

if (violations.length > 0) {
  console.error('[final-topology-legacy-free] Contract violation detected:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('[final-topology-legacy-free] PASS: legacy roots and imports are fully removed.');
