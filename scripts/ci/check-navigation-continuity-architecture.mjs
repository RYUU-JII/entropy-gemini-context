#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const label = 'navigation-continuity-architecture';

const files = {
  service: 'src/domains/tracking/background/NavigationContinuityService.js',
  state: 'src/domains/tracking/background/navigationContinuityState.js',
  checkpoint: 'src/domains/tracking/background/navigationContinuityCheckpoint.js',
  gateConsumer: 'src/domains/protection/background/runtime/GateRuntimeStateOwner.js',
  serviceTest: 'tests/navigationContinuityService.test.js',
  gateConsumerTest: 'tests/gateRuntimeStateOwner.test.js',
  stateTest: 'tests/navigationContinuityState.test.js',
};

function fail(message) {
  console.error(`[${label}] FAIL: ${message}`);
  process.exit(1);
}

async function readSource(relativePath) {
  return fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
}

function assertIncludes(source, file, tokens) {
  tokens.forEach((token) => {
    if (!source.includes(token)) {
      fail(`${file} must include navigation continuity token: ${token}`);
    }
  });
}

function assertExcludes(source, file, tokens) {
  tokens.forEach((token) => {
    if (source.includes(token)) {
      fail(`${file} must not include navigation continuity token: ${token}`);
    }
  });
}

async function main() {
  const serviceSource = await readSource(files.service);
  const stateSource = await readSource(files.state);
  const checkpointSource = await readSource(files.checkpoint);
  const gateConsumerSource = await readSource(files.gateConsumer);
  const serviceTestSource = await readSource(files.serviceTest);
  const gateConsumerTestSource = await readSource(files.gateConsumerTest);
  const stateTestSource = await readSource(files.stateTest);

  assertIncludes(serviceSource, files.service, [
    "from './navigationContinuityState.js'",
    'export const NAVIGATION_CONTINUITY_RELATIONS',
    'export function createNavigationContinuityService',
    'NAVIGATION_CONTINUITY_SESSION_STORE_REQUIRED',
    'NAVIGATION_CONTINUITY_SESSION_KEY_REQUIRED',
    'resolveTabCompleteVisitIntent',
    'buildForegroundContinuity',
    'at: normalizedNow',
    'readOptional(resolvedSessionKey)',
    'checkpointWriteTail.then(write, write)',
    "from './navigationContinuityCheckpoint.js'",
  ]);
  assertExcludes(serviceSource, files.service, [
    'function normalizePersistedNavigationEntry',
    'function normalizeHostState',
    'function selectRecentNavigationEntries',
    'function selectForegroundEvents',
    'const TAB_NAVIGATION_STATE_SCHEMA_VERSION',
    'const MAX_FOREGROUND_EVENT_ENTRIES',
    'failed to hydrate navigation continuity state',
    'failed to persist navigation continuity state',
    "console.warn('[NavigationContinuityService]",
    'sessionStore = null',
    'resolvedSessionStore.get({',
  ]);

  assertIncludes(stateSource, files.state, [
    'export const NEW_TAB_CONTEXT_WINDOW_MS',
    'export const TAB_NAVIGATION_STATE_TTL_MS',
    'export function normalizeCreatedTabEntry',
    'export function readLatestPersistedEntries',
    'export function normalizeHostState',
    'export function selectRecentNavigationEntries',
    'export function selectForegroundEvents',
    'export function buildEntryIntent',
  ]);
  assertExcludes(stateSource, files.state, [
    'STORAGE_SESSION_KEYS',
    'NAVIGATION_CONTINUITY_RELATIONS',
    'createNavigationContinuityService',
    'resolveTabCompleteVisitIntent',
    'buildForegroundContinuity',
    'sessionStore',
  ]);

  assertIncludes(checkpointSource, files.checkpoint, [
    'export function requireNavigationCheckpointReadResult',
    'export function requireNavigationContinuitySnapshot',
    'TAB_NAVIGATION_STATE_READ_INVALID',
    'TAB_NAVIGATION_STATE_CONTRACT_INVALID:',
    'completed[${index}]',
    'foregroundEvents[${index}]',
  ]);
  assertExcludes(checkpointSource, files.checkpoint, [
    'sessionStore',
    'createNavigationContinuityService',
  ]);

  assertIncludes(gateConsumerSource, files.gateConsumer, [
    'normalizeGateContinuityFacts',
    'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:hostname',
    'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:entryIntent',
    'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:at',
  ]);
  assertExcludes(gateConsumerSource, files.gateConsumer, [
    'continuity.hostname || normalizedHostname',
    'normalizeTabId(continuity.tabId, normalizedTabId)',
    'Number(continuity.at || now)',
  ]);

  assertIncludes(serviceTestSource, files.serviceTest, [
    'createNavigationContinuityService',
    'NAVIGATION_CONTINUITY_RELATIONS',
    'NAVIGATION_CONTINUITY_SESSION_STORE_REQUIRED',
    'NAVIGATION_CONTINUITY_SESSION_KEY_REQUIRED',
    'rejects.toThrow',
    'serializes snapshots captured at each persist invocation',
    'continues the checkpoint write lane after an older persist fails',
  ]);
  assertIncludes(gateConsumerTestSource, files.gateConsumerTest, [
    'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:entryIntent',
    'lastContinuityAt',
  ]);
  assertIncludes(stateTestSource, files.stateTest, [
    'readLatestPersistedEntries',
    'normalizeHostState',
    'selectForegroundEvents',
  ]);

  console.log(`[${label}] PASS: continuity decision service and state-shape helpers remain split.`);
}

main().catch((error) => {
  console.error(`[${label}] Unexpected error:`, error);
  process.exit(1);
});
