#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const label = 'tracking-browser-events-architecture';

const files = {
  handlers: 'src/domains/tracking/background/trackingBrowserEventHandlers.js',
  tabContext: 'src/domains/tracking/background/trackingTabContextSnapshot.js',
  handlersTest: 'tests/trackingBrowserEventHandlers.test.js',
  tabContextTest: 'tests/trackingTabContextSnapshot.test.js',
  sealer: 'src/domains/tracking/background/trackingForegroundSegmentSealer.js',
  consumptionLedger: 'src/domains/tracking/background/TrackingConsumptionLedger.js',
  consumptionState: 'src/domains/tracking/background/trackingConsumptionFlowState.js',
  gateOwner: 'src/domains/protection/background/runtime/GateRuntimeStateOwner.js',
  inputProvider: 'src/domains/protection/background/ProtectionRuntimeInputProvider.js',
  batchSettlement: 'src/domains/tracking/background/trackingTabActivityBatchSettlement.js',
  activityObservation: 'src/domains/tracking/background/trackingTabActivityObservation.js',
  consumptionEnvironment: 'src/domains/tracking/background/trackingConsumptionEnvironment.js',
  foregroundObservation: 'src/domains/tracking/background/trackingForegroundObservation.js',
  consumptionContext: 'src/domains/behavior/consumption/consumptionContext.js',
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
      fail(`${file} must include tracking browser-event token: ${token}`);
    }
  });
}

function assertExcludes(source, file, tokens) {
  tokens.forEach((token) => {
    if (source.includes(token)) {
      fail(`${file} must not include tracking browser-event token: ${token}`);
    }
  });
}

async function main() {
  const handlersSource = await readSource(files.handlers);
  const tabContextSource = await readSource(files.tabContext);
  const handlersTestSource = await readSource(files.handlersTest);
  const tabContextTestSource = await readSource(files.tabContextTest);

  assertIncludes(handlersSource, files.handlers, [
    "from './trackingTabContextSnapshot.js'",
    'createTrackingBrowserEventHandlers',
    'recordWebNavigationSignal',
    'readTabContextSnapshot(browserPort',
    'TRACKING_BROWSER_EVENTS_SESSION_STORE_REQUIRED',
    'TRACKING_BROWSER_EVENTS_TAB_NAVIGATION_STATE_KEY_REQUIRED',
    'TRACKING_BROWSER_EVENTS_BROWSER_PORT_REQUIRED',
    'TRACKING_BROWSER_EVENTS_MUTATION_TIMESTAMP_REQUIRED',
    'runStatsMutationBatch(async (mutationContext)',
    'queueBestEffortBrowserEventTask',
    'warnBestEffortBrowserEventFailure',
    'return admittedWebNavigationCommittedHandler(details);',
    'return admittedTabRemovedHandler(tabId);',
    'return admittedTabReplacedHandler(addedTabId, removedTabId);',
  ]);
  assertExcludes(handlersSource, files.handlers, [
    'const EMPTY_BROWSER_PORT = Object.freeze',
    'async function readTabContextSnapshot',
    'failed to read tab context snapshot',
    'sessionStore = null',
    'browserPort = EMPTY_BROWSER_PORT',
    'browserEventSequenceTail',
    'enqueueBrowserEvent',
    'console.error(',
  ]);

  assertIncludes(tabContextSource, files.tabContext, [
    'export async function readTabContextSnapshot',
    'TRACKING_TAB_CONTEXT_BROWSER_PORT_REQUIRED',
    'tabsQuery({})',
    'sameDomainOpenTabs',
  ]);
  assertExcludes(tabContextSource, files.tabContext, [
    'export const EMPTY_BROWSER_PORT',
    'browserPort = EMPTY_BROWSER_PORT',
    'failed to read tab context snapshot',
    'console.warn',
    'return null',
    'createTrackingBrowserEventHandlers',
    'TabTimeTracker',
    'navigationContinuity',
    'sendProtectionUpdate',
    'maybeTriggerProtectionNudge',
    'recordNavigationIntent',
  ]);

  assertIncludes(handlersTestSource, files.handlersTest, [
    'createTrackingBrowserEventHandlers',
    'propagates activated-tab core failures without poisoning later browser events',
    'propagates focused-window core failures without poisoning later browser events',
    '.rejects.toBe(dispatchError)',
    '.rejects.toBe(windowReadError)',
    'invalidates pending content sync at committed-navigation ingress before bootstrap',
    'keeps lifecycle sync eviction even when profile admission rejects the removed tab',
    'keeps lifecycle sync eviction when profile admission rejects a replaced tab',
    'deletes completed visit history while protection is still pending',
    'deletes completed visit history even when its protection ingress was superseded',
    'reports history deletion failure while continuing the independent protection dispatch',
  ]);
  assertIncludes(tabContextTestSource, files.tabContextTest, [
    'readTabContextSnapshot',
    'TRACKING_TAB_CONTEXT_BROWSER_PORT_REQUIRED',
    'rejects.toThrow',
  ]);

  const [sealer, ledger, state, gate, provider] = await Promise.all([
    files.sealer, files.consumptionLedger, files.consumptionState, files.gateOwner, files.inputProvider,
  ].map(readSource));
  assertIncludes(sealer, files.sealer, ['await consumptionLedger.recordForegroundSegment(', 'coveredByActiveCommitCursor']);
  assertIncludes(ledger, files.consumptionLedger, ['reduceConsumptionSegment', 'await repository.write(', 'profileMutationAdmissionOwner.assertOpen()']);
  assertIncludes(provider, files.inputProvider, ['projectGateConsumedContexts(consumptionFlow, now)', 'projectProtectedConsumptionContext(consumptionFlow, now)', 'resolveProtectedHostnameScope']);
  assertExcludes(gate, files.gateOwner, ['consumedProtectedContexts', 'recordConsumedProtectedContext', 'getGateProtectedContextSnapshot']);
  for (const [source, file] of [[ledger, files.consumptionLedger], [state, files.consumptionState]]) {
    assertExcludes(source, file, ['setInterval(', 'setTimeout(', 'chrome.', 'tabsQuery(', 'localStorage', 'InterventionAdmission', 'statsCollector.']);
  }

  const [batch, environment, context, foreground, observation] = await Promise.all([
    files.batchSettlement, files.consumptionEnvironment, files.consumptionContext, files.foregroundObservation,
    files.activityObservation,
  ].map(readSource));
  assertIncludes(batch, files.batchSettlement, ['buildConsumptionEnvironment({', 'consumptionLedger.recordEnvironmentSnapshot(consumptionEnvironment,']);
  assertIncludes(observation, files.activityObservation, ['consumptionLedger.captureMediaObservation(settingsService.getSettingsChangeVersion())', 'observations.delete(receipt)', 'assertCurrent(snapshot, now, options)']);
  assertIncludes(environment, files.consumptionEnvironment, ['isDataCollectionConsentGranted(settings)', 'shouldCollectDomainUsage(hostname, settings)', 'await resolveScope(']);
  for (const [source, file] of [[batch, files.batchSettlement], [environment, files.consumptionEnvironment]]) {
    assertIncludes(source, file, ["from './trackingForegroundObservation.js'", 'resolveObservedForegroundTab({']);
  }
  assertIncludes(foreground, files.foregroundObservation, ['focusedWindow?.focused !== true', 'candidates.length !== 1', 'matches.length !== 1', 'tab.url !== candidate.url']);
  assertExcludes(batch, files.batchSettlement, ['resolveFocusUnavailableActiveTabId(', '?? runtimeFocusedWindowId']);
  assertExcludes(foreground, files.foregroundObservation, ['lastActiveTabId', 'Date.now(', 'tabsQuery(', 'chrome.', 'localStorage']);
  for (const [source, file] of [[environment, files.consumptionEnvironment], [context, files.consumptionContext]]) {
    assertExcludes(source, file, ['setInterval(', 'setTimeout(', 'Date.now(', 'chrome.', 'tabsQuery(', 'localStorage', 'addEventListener(', 'InterventionAdmission', 'statsCollector.', 'clse/']);
  }
  assertExcludes(context, files.consumptionContext, ['platform/storage/', 'repository.write(', 'sessionStore.']);

  console.log(`[${label}] PASS: browser observations and confirmed consumption retain their canonical owners.`);
}

main().catch((error) => {
  console.error(`[${label}] Unexpected error:`, error);
  process.exit(1);
});
