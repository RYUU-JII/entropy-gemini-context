#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { enforceSoftModuleBudget } from './architectureGuardUtils.mjs';

const rootDir = process.cwd();
const trackerPath = 'src/domains/tracking/background/TabTimeTracker.js';
const activeTabRuntimeStatePath = 'src/domains/tracking/background/trackingActiveTabRuntimeState.js';
const activeTabCheckpointPath = 'src/domains/tracking/background/trackingActiveTabCheckpoint.js';
const domainSessionRuntimeStatePath = 'src/domains/tracking/background/trackingDomainSessionRuntimeState.js';
const domainSessionCheckpointPath = 'src/domains/tracking/background/trackingDomainSessionCheckpoint.js';
const domainSessionCollectionAdmissionPath = 'src/domains/tracking/background/trackingDomainSessionCollectionAdmission.js';
const trackingStatsSettlementPath = 'src/domains/tracking/background/trackingStatsSettlement.js';
const sessionDurationRecorderPath = 'src/domains/tracking/background/trackingSessionDurationRecorder.js';
const statsAggregatorPath = 'src/domains/stats/background/aggregation/statsAggregator.js';
const statsCollectorPath = 'src/domains/stats/background/collection/statsCollector.js';
const statsBucketMaterializerPath = 'src/domains/stats/background/persistence/statsBucketMaterializer.js';
const dbStatsNormalizersPath = 'src/platform/storage/internal/indexeddb/dbStatsNormalizers.js';
const retiredRuntimeTickSettlementPath = 'src/domains/tracking/background/trackingRuntimeTickSettlement.js';
const dataCollectionPolicyPath = 'src/domains/settings/config/dataCollectionPolicy.js';
const backgroundElapsedApplicatorPath = 'src/domains/tracking/background/trackingTabElapsedApplicator.js';
const batchSettlementPath = 'src/domains/tracking/background/trackingTabActivityBatchSettlement.js';
const observationPath = 'src/domains/tracking/background/trackingTabActivityObservation.js';
const foregroundUsageLedgerPath = 'src/domains/tracking/background/trackingForegroundUsageLedger.js';
const foregroundSegmentSealerPath = 'src/domains/tracking/background/trackingForegroundSegmentSealer.js';
const tickRunnerPath = 'src/domains/tracking/background/trackingTickRunner.js';
const statsTickRuntimeServicePath = 'src/domains/stats/background/runtime/statsTickRuntimeService.js';
const statsRuntimeHealthLedgerPath = 'src/domains/stats/background/runtime/statsRuntimeHealthLedger.js';
const browserEventHandlersPath = 'src/domains/tracking/background/trackingBrowserEventHandlers.js';
const trackingServiceBootstrapPath = 'src/domains/tracking/background/trackingServiceBootstrap.js';
const popupBlockFlowPath = 'src/domains/tracking/background/trackingPopupBlockFlow.js';
const managedContentScriptSyncPath = 'src/domains/tracking/background/ManagedContentScriptSync.js';
const messageHandlerDir = 'src/domains/tracking/background/trackingMessageHandlers';
const nudgeCyclePolicyPath = 'src/domains/tracking/background/trackingMessagePolicies/nudgeCyclePolicy.js';
const requiredImports = [
  './trackingActiveTabRuntimeState.js',
  './trackingDomainSessionRuntimeState.js',
  './trackingDomainSessionCollectionAdmission.js',
  './trackingStatsSettlement.js',
  './trackingIdleLifecycle.js',
  './trackingScopePolicy.js',
];
const forbiddenImportTokens = [
  '../../settings/config/blockingPolicy.js',
  '../../settings/config/siteRules.js',
  '../../stats/background/collection/tabActivityCollector.js',
];
const forbiddenInlineTokens = [
  'function resolveStatsCategoryIdFromModeState(',
  'function resolveTimedFilteringMode(',
  'function shouldTrackHostname(',
  'function getSiteCategory(',
  'function onIdleStateChange(',
  'function setActiveTabAudible(',
];
const moduleBudgetConstraints = [
  { file: 'src/domains/tracking/background/TabTimeTracker.js', softLines: 300, maxFunctionDeclarations: 32, maxControlFlowTokens: 18, minLocalHelperImportsWhenOverSoft: 5 },
  { file: 'src/domains/tracking/background/trackingActiveTabRuntimeState.js', softLines: 300, maxFunctionDeclarations: 28, maxControlFlowTokens: 45 },
  { file: 'src/domains/tracking/background/trackingActiveTabCheckpoint.js', softLines: 130, maxFunctionDeclarations: 7, maxControlFlowTokens: 18 },
  { file: 'src/domains/tracking/background/trackingDomainSessionRuntimeState.js', softLines: 210, maxFunctionDeclarations: 21, maxControlFlowTokens: 30 },
  { file: 'src/domains/tracking/background/trackingDomainSessionCheckpoint.js', softLines: 145, maxFunctionDeclarations: 10, maxControlFlowTokens: 22 },
  { file: 'src/domains/tracking/background/trackingDomainSessionCollectionAdmission.js', softLines: 120, maxFunctionDeclarations: 4, maxControlFlowTokens: 10 },
  { file: 'src/domains/tracking/background/trackingIdleLifecycle.js', softLines: 80, maxFunctionDeclarations: 4, maxControlFlowTokens: 12 },
  { file: 'src/domains/tracking/background/trackingScopePolicy.js', softLines: 80, maxFunctionDeclarations: 5, maxControlFlowTokens: 12 },
  { file: 'src/domains/tracking/background/trackingStatsSettlement.js', softLines: 90, maxFunctionDeclarations: 1, maxControlFlowTokens: 2, minLocalHelperImportsWhenOverSoft: 2 },
  { file: 'src/domains/tracking/background/trackingTabActivitySettlement.js', softLines: 220, maxFunctionDeclarations: 6, maxControlFlowTokens: 14, minLocalHelperImportsWhenOverSoft: 3 },
  { file: 'src/domains/tracking/background/trackingForegroundUsageLedger.js', softLines: 280, maxFunctionDeclarations: 10, maxControlFlowTokens: 36 },
  { file: 'src/domains/tracking/background/trackingForegroundSegmentSealer.js', softLines: 210, maxFunctionDeclarations: 6, maxControlFlowTokens: 30 },
  { file: 'src/domains/tracking/background/trackingTabActivityBatchSettlement.js', softLines: 280, maxFunctionDeclarations: 4, maxControlFlowTokens: 24 },
  { file: 'src/domains/tracking/background/trackingSessionDurationRecorder.js', softLines: 40, maxFunctionDeclarations: 2, maxControlFlowTokens: 2 },
];

const fail = (message) => {
  console.error(`[tab-time-tracker-architecture] FAIL: ${message}`);
  process.exit(1);
};

const main = async () => {
  const trackerSource = await fs.readFile(path.resolve(rootDir, trackerPath), 'utf8');

  if (!trackerSource.includes('export function createTabTimeTracker(')) {
    fail(`${trackerPath} must export createTabTimeTracker().`);
  }

  for (const requiredImport of requiredImports) {
    if (!trackerSource.includes(requiredImport)) {
      fail(`${trackerPath} must import ${requiredImport} so owner logic stays decomposed.`);
    }
  }

  for (const forbiddenImportToken of forbiddenImportTokens) {
    if (trackerSource.includes(forbiddenImportToken)) {
      fail(`${trackerPath} must not directly import ${forbiddenImportToken}; route policy/collection logic through helper owners.`);
    }
  }

  for (const forbiddenInlineToken of forbiddenInlineTokens) {
    if (trackerSource.includes(forbiddenInlineToken)) {
      fail(`${trackerPath} must not define ${forbiddenInlineToken.replace('function ', '').replace('(', '()')} inline.`);
    }
  }

  const backgroundElapsedApplicatorSource = await fs.readFile(
    path.resolve(rootDir, backgroundElapsedApplicatorPath),
    'utf8',
  );
  const batchSettlementSource = await fs.readFile(path.resolve(rootDir, batchSettlementPath), 'utf8');
  const observationSource = await fs.readFile(path.resolve(rootDir, observationPath), 'utf8');
  const foregroundUsageLedgerSource = await fs.readFile(path.resolve(rootDir, foregroundUsageLedgerPath), 'utf8');
  const foregroundSegmentSealerSource = await fs.readFile(path.resolve(rootDir, foregroundSegmentSealerPath), 'utf8');
  const tickRunnerSource = await fs.readFile(path.resolve(rootDir, tickRunnerPath), 'utf8');
  const prepareIndex = tickRunnerSource.indexOf('await TabTimeTracker.prepareTabActivityObservation()');
  const mutationIndex = tickRunnerSource.indexOf('await runStatsMutationBatch(');
  if (prepareIndex < 0 || prepareIndex >= mutationIndex || tickRunnerSource.includes('TabTimeTracker.trackAllTabsBatch(')
    || !tickRunnerSource.includes('attempt < 2') || !tickRunnerSource.includes('error.beforeMutation !== true')) {
    fail(`${tickRunnerPath} must acquire outside the lane and bound pre-mutation reacquisition.`);
  }
  const statsTickRuntimeServiceSource = await fs.readFile(path.resolve(rootDir, statsTickRuntimeServicePath), 'utf8');
  const rolloverPrepareIndex = statsTickRuntimeServiceSource.indexOf('await TabTimeTracker.prepareRolloverTabActivityObservation(');
  const rolloverMutationIndex = statsTickRuntimeServiceSource.indexOf('await runStatsRolloverMutationBatch(');
  if (rolloverPrepareIndex < 0 || rolloverPrepareIndex >= rolloverMutationIndex
    || statsTickRuntimeServiceSource.includes('TabTimeTracker.trackAllTabsBatch(')
    || !statsTickRuntimeServiceSource.includes('attempt < 2')
    || !statsTickRuntimeServiceSource.includes('error.beforeMutation !== true')) {
    fail(`${statsTickRuntimeServicePath} must prepare rollover outside the mutation FIFO and bound pre-mutation retries.`);
  }
  const statsRuntimeHealthLedgerSource = await fs.readFile(path.resolve(rootDir, statsRuntimeHealthLedgerPath), 'utf8');
  const browserEventHandlersSource = await fs.readFile(path.resolve(rootDir, browserEventHandlersPath), 'utf8');
  const trackingServiceBootstrapSource = await fs.readFile(
    path.resolve(rootDir, trackingServiceBootstrapPath),
    'utf8',
  );
  const activeTabRuntimeStateSource = await fs.readFile(path.resolve(rootDir, activeTabRuntimeStatePath), 'utf8');
  const activeTabCheckpointSource = await fs.readFile(path.resolve(rootDir, activeTabCheckpointPath), 'utf8');
  const domainSessionRuntimeStateSource = await fs.readFile(path.resolve(rootDir, domainSessionRuntimeStatePath), 'utf8');
  const domainSessionCheckpointSource = await fs.readFile(path.resolve(rootDir, domainSessionCheckpointPath), 'utf8');
  const domainSessionCollectionAdmissionSource = await fs.readFile(
    path.resolve(rootDir, domainSessionCollectionAdmissionPath),
    'utf8',
  );
  const trackingStatsSettlementSource = await fs.readFile(path.resolve(rootDir, trackingStatsSettlementPath), 'utf8');
  const sessionDurationRecorderSource = await fs.readFile(path.resolve(rootDir, sessionDurationRecorderPath), 'utf8');
  const statsAggregatorSource = await fs.readFile(path.resolve(rootDir, statsAggregatorPath), 'utf8');
  const statsCollectorSource = await fs.readFile(path.resolve(rootDir, statsCollectorPath), 'utf8');
  const statsBucketMaterializerSource = await fs.readFile(path.resolve(rootDir, statsBucketMaterializerPath), 'utf8');
  const dbStatsNormalizersSource = await fs.readFile(path.resolve(rootDir, dbStatsNormalizersPath), 'utf8');
  const dataCollectionPolicySource = await fs.readFile(path.resolve(rootDir, dataCollectionPolicyPath), 'utf8');
  const popupBlockFlowSource = await fs.readFile(path.resolve(rootDir, popupBlockFlowPath), 'utf8');
  const managedContentScriptSyncSource = await fs.readFile(path.resolve(rootDir, managedContentScriptSyncPath), 'utf8');
  const nudgeCyclePolicySource = await fs.readFile(path.resolve(rootDir, nudgeCyclePolicyPath), 'utf8');
  const messageHandlerEntries = await fs.readdir(path.resolve(rootDir, messageHandlerDir));

  if (!backgroundElapsedApplicatorSource.includes('export function createApplyBackgroundTabTimeWithCollection(')) {
    fail(`${backgroundElapsedApplicatorPath} must expose a background-only elapsed applicator.`);
  }

  if (backgroundElapsedApplicatorSource.includes('createApplyTabTimeWithCollection')) {
    fail(`${backgroundElapsedApplicatorPath} must not expose the retired active/background elapsed applicator.`);
  }

  if (!backgroundElapsedApplicatorSource.includes('isActive: false,')) {
    fail(`${backgroundElapsedApplicatorPath} must record elapsed time as background-only.`);
  }

  if (!backgroundElapsedApplicatorSource.includes('activeCommittedThroughAt')) {
    fail(`${backgroundElapsedApplicatorPath} must exclude foreground-committed coverage from background elapsed.`);
  }

  if (batchSettlementSource.includes('applyTabTimeWithCollection')) {
    fail(`${batchSettlementPath} must use the background-only applicator; active elapsed is owned by trackingForegroundUsageLedger.`);
  }

  for (const token of ['new WeakMap()', 'observations.delete(receipt)', 'getObservationRevision()',
    'getCurrentIdleState()', 'beforeMutation = true', 'getLocalDateStr(snapshot.observedAt)',
    'TRACKING_ROLLOVER_OBSERVATION_CONTEXT_INVALID', 'TRACKING_ROLLOVER_OBSERVATION_CONTEXT_MISMATCH']) {
    if (!observationSource.includes(token)) fail(`${observationPath} lost observation ownership fence: ${token}`);
  }
  for (const token of ['observationOwner.consume(', 'observationOwner.assertCurrent(snapshot, now',
    'prepareTabActivityObservation:', 'settleTabActivityObservation',
    'prepareRolloverTabActivityObservation:', 'settleRolloverTabActivityObservation:']) {
    if (!batchSettlementSource.includes(token)) fail(`${batchSettlementPath} lost acquisition/settlement boundary: ${token}`);
  }
  if (batchSettlementSource.includes('await idleDetector.getIdleState(')) {
    fail(`${batchSettlementPath} must not refresh idle inside the stats mutation lane.`);
  }
  const rolloverSealIndex = batchSettlementSource.indexOf("reason: 'rollover_previous_day'");
  if (rolloverSealIndex < batchSettlementSource.indexOf('observationOwner.assertCurrent(snapshot, now')
    || rolloverSealIndex > batchSettlementSource.indexOf('await finalizeActiveSession(')) {
    fail(`${batchSettlementPath} must validate before closing the foreground and then finalize its session.`);
  }
  const elapsedApplicatorSource = await fs.readFile(path.resolve(rootDir, backgroundElapsedApplicatorPath), 'utf8');
  if (elapsedApplicatorSource.includes('idleDetector.getIdleState(')
    || !elapsedApplicatorSource.includes('idleDetector.getCurrentIdleState()')) {
    fail(`${backgroundElapsedApplicatorPath} must consume canonical idle state without recursive refresh.`);
  }

  if (!foregroundUsageLedgerSource.includes('./trackingForegroundSegmentSealer.js')) {
    fail(`${foregroundUsageLedgerPath} must delegate active-segment sealing to its named owner module.`);
  }

  [
    'TRACKING_FOREGROUND_USAGE_LEDGER_RUNTIME_HEALTH_REQUIRED',
    'recordActiveSealDiagnostic({ diagnostic })',
    'coveredByActiveCommitCursor',
    'result.appliedElapsedMs',
  ].forEach((token) => {
    if (!foregroundSegmentSealerSource.includes(token)) {
      fail(`${foregroundSegmentSealerPath} must keep active-seal runtime-health ownership explicit: missing ${token}`);
    }
  });

  [
    'statsRuntimeHealthLedger = null',
    'statsRuntimeHealthLedger?.',
    'recordActiveSealDiagnostic?.',
    'recordActiveTabDurationRef = async',
    'recordSessionDurationRef = async',
  ].forEach((token) => {
    if (
      trackerSource.includes(token)
      || foregroundUsageLedgerSource.includes(token)
      || foregroundSegmentSealerSource.includes(token)
    ) {
      fail(`TabTimeTracker foreground health paths must not revive nullable/optional runtime-health ownership: ${token}`);
    }
  });

  [
    'TAB_TIME_TRACKER_ACTIVE_DURATION_OWNER_REQUIRED',
    'TAB_TIME_TRACKER_SESSION_DURATION_OWNER_REQUIRED',
  ].forEach((token) => {
    if (!trackerSource.includes(token)) {
      fail(`${trackerPath} must keep active/session duration owner refs explicit: missing ${token}`);
    }
  });

  [
    'STATS_TICK_RUNTIME_SERVICE_MUTATION_BATCH_REQUIRED',
    'STATS_TICK_RUNTIME_SERVICE_ROLLOVER_MUTATION_BATCH_REQUIRED',
    'async function settlePreviousDayForRollover(',
    'async function primeLoadedDayForRollover(',
    'await runStatsRolloverMutationBatch(',
    'TabTimeTracker.primeNewDayAt(',
  ].forEach((token) => {
    if (!statsTickRuntimeServiceSource.includes(token)) {
      fail(`${statsTickRuntimeServicePath} must keep stats tick/rollover ownership explicit: missing ${token}`);
    }
  });
  if (/await\s+runStatsMutationBatch\(/u.test(statsTickRuntimeServiceSource)) {
    fail(`${statsTickRuntimeServicePath} rollover must use its dedicated admission path, never recursively enter ordinary stats admission`);
  }

  [
    'sessionStore',
    'tickMetrics',
    'lastTracked',
    'createEmptyTickBuffer',
    'handleRollover',
  ].forEach((token) => {
    if (statsTickRuntimeServiceSource.includes(token)) {
      fail(`${statsTickRuntimeServicePath} must not revive write-only tick checkpoint state: ${token}.`);
    }
  });

  try {
    await fs.access(path.resolve(rootDir, retiredRuntimeTickSettlementPath));
    fail(`${retiredRuntimeTickSettlementPath} must remain deleted.`);
  } catch (_error) {
    // Expected: the retired gap-compensation owner is gone.
  }

  [
    'applyGapCompensation',
    'lastTrackedAt',
    'trackingRuntimeTickSettlement',
  ].forEach((token) => {
    if (
      trackerSource.includes(token)
      || trackingStatsSettlementSource.includes(token)
      || sessionDurationRecorderSource.includes(token)
    ) {
      fail(`tracking settlement owners must not revive the retired gap-compensation API: ${token}.`);
    }
  });

  [
    "from './trackingSessionDurationRecorder.js'",
    'createTrackingSessionDurationRecorder({',
    '...trackingSessionDurationRecorder',
  ].forEach((token) => {
    if (!trackingStatsSettlementSource.includes(token)) {
      fail(`${trackingStatsSettlementPath} must compose the named session-duration owner: missing ${token}.`);
    }
  });
  if (!sessionDurationRecorderSource.includes('return statsCollector.recordDaySession({')) {
    fail(`${sessionDurationRecorderPath} must remain the narrow day-session recording owner.`);
  }

  [
    'TRACKING_DOMAIN_SESSION_COLLECTION_POLICY_OWNER_REQUIRED',
    'discardSessionIfCollectionPolicyRejects',
    'shouldTrackHostname(sessionCursor.hostname, settingsCache)',
    'domainSessionRuntimeState.resetState(sessionCursor.sessionId)',
  ].forEach((token) => {
    if (!domainSessionCollectionAdmissionSource.includes(token)) {
      fail(`${domainSessionCollectionAdmissionPath} must keep consent-aware session admission explicit: missing ${token}.`);
    }
  });

  [
    'Failed to persist runtime health',
    "console.warn('[StatsRuntimeHealthLedger]",
  ].forEach((token) => {
    if (statsRuntimeHealthLedgerSource.includes(token)) {
      fail(`${statsRuntimeHealthLedgerPath} must reject session write failures instead of hiding them behind ${token}.`);
    }
  });

  [
    'TRACKING_TICK_RUNNER_TACTICAL_FLUSH_REQUIRED',
    'TRACKING_TICK_RUNNER_MUTATION_BATCH_REQUIRED',
    'TRACKING_TICK_RUNNER_RUNTIME_HEALTH_REQUIRED',
    'TRACKING_TICK_RUNNER_BROWSER_PORT_REQUIRED',
    'flushTacticalLogsAndReport',
    'requireSuccess: true',
    'recordTickStarted({ source, at: ingressNow })',
    'await runStatsMutationBatch(async ({ now }) => {',
    'recordTickCompleted({',
    'recordTickFailed({ source, at: Date.now(), error })',
  ].forEach((token) => {
    if (!tickRunnerSource.includes(token)) {
      fail(`${tickRunnerPath} must keep tick flush and runtime-health owners explicit: missing ${token}`);
    }
  });

  [
    'tickRuntimeService ||',
    'getLastTrackedAt,',
    'replaceTickBuffer,',
    'createEmptyTickBuffer,',
    'cloneMetrics,',
    'flushTickMetricsBackup',
    'setLastTrackedAt',
    'flushTacticalLogsWrapper?.',
    'statsRuntimeHealthLedger?.',
    'browserPort?.tabsGet',
  ].forEach((token) => {
    if (tickRunnerSource.includes(token)) {
      fail(`${tickRunnerPath} must not revive retired individual tick-state dependency fallback: ${token}`);
    }
  });

  if (!browserEventHandlersSource.includes('TRACKING_BROWSER_EVENTS_TICK_RUNTIME_SERVICE_REQUIRED')) {
    fail(`${browserEventHandlersPath} must fail loudly when the canonical stats tick runtime service is missing.`);
  }

  [
    'TRACKING_BROWSER_EVENTS_RUNTIME_HEALTH_REQUIRED',
    'TRACKING_BROWSER_EVENTS_GATE_RUNTIME_STATE_OWNER_REQUIRED',
    'recordAlarmSeen({',
  ].forEach((token) => {
    if (!browserEventHandlersSource.includes(token)) {
      fail(`${browserEventHandlersPath} must keep alarm runtime-health ownership explicit: missing ${token}`);
    }
  });

  [
    'statsRuntimeHealthLedger = null',
    'statsRuntimeHealthLedger?.',
    'recordAlarmSeen?.',
    'noteGateForegroundTab?.',
    'noteGateActiveNavigation?.',
    'noteGateForegroundBlur?.',
    'noteGateTabClosed?.',
  ].forEach((token) => {
    if (browserEventHandlersSource.includes(token)) {
      fail(`${browserEventHandlersPath} must not revive nullable/optional runtime-health ownership: ${token}`);
    }
  });

  [
    'getCurrentTickBuffer,',
    'scheduleTickMetricsBackup,',
    'incrementMetric(',
  ].forEach((token) => {
    if (browserEventHandlersSource.includes(token)) {
      fail(`${browserEventHandlersPath} must not revive the retired secondary tick-metrics path: ${token}`);
    }
  });

  if (!domainSessionRuntimeStateSource.includes('TRACKING_DOMAIN_SESSION_DURATION_OWNER_REQUIRED')) {
    fail(`${domainSessionRuntimeStatePath} must fail loudly when active-session duration ownership is missing.`);
  }

  [
    'TRACKING_DOMAIN_SESSION_STATE_SESSION_STORE_REQUIRED',
    'TRACKING_DOMAIN_SESSION_STATE_KEY_REQUIRED',
    './trackingDomainSessionCheckpoint.js',
    'requireStoredDomainSession',
    'requireDomainSessionStoreReadResult',
    'readOptional(resolvedSessionDomainSessionKey)',
    'await resolvedSessionStore.set',
    'await resolvedSessionStore.remove',
    'checkpointMutationTail.then(task, task)',
    'createPendingDomainSessionCommit',
    'replayPendingSessionCommit',
  ].forEach((token) => {
    if (!domainSessionRuntimeStateSource.includes(token)) {
      fail(`${domainSessionRuntimeStatePath} must keep domain-session persistence ownership explicit: missing ${token}`);
    }
  });
  [
    'discardPendingCommitForDeprecatedDevClockMigration',
    'TRACKING_DEPRECATED_DEV_CLOCK_PENDING_COMMIT_REQUIRED',
  ].forEach((token) => {
    if (domainSessionRuntimeStateSource.includes(token) || trackerSource.includes(token)) {
      fail(`tracking domain-session owners must not revive the retired pending-commit discard seam: ${token}`);
    }
  });

  [
    'TRACKING_DOMAIN_SESSION_STATE_READ_INVALID',
    'TRACKING_DOMAIN_SESSION_STATE_INVALID',
    'TRACKING_DOMAIN_SESSION_PHASES',
    "ACTIVE: 'active'",
    "PENDING_COMMIT: 'pending_commit'",
    "'sessionId'",
    "'startedAt'",
    "'durationMs'",
    "'endedAt'",
    "'targetDateStr'",
    'requireDomainSessionStoreReadResult',
    'requireStoredDomainSession',
  ].forEach((token) => {
    if (!domainSessionCheckpointSource.includes(token)) {
      fail(`${domainSessionCheckpointPath} must validate persisted domain-session checkpoint shape: missing ${token}`);
    }
  });

  [
    'void sessionStore.set',
    'sessionStore.set({',
    'storedSession.lastSeenAt ?? null',
    'storedSession.sessionStartedAt ?? null',
    'storedSession.dwellMs ?? 0',
    'domainSessionState',
    'updateSessionDwell',
    'getSessionDwell',
    'getDomainSession(',
    'sessionGapMs',
    'lastSeenAt',
    'dwellMs',
  ].forEach((token) => {
    if (
      domainSessionRuntimeStateSource.includes(token)
      || trackerSource.includes(token)
      || foregroundSegmentSealerSource.includes(token)
    ) {
      fail(`tracking domain-session owners must not revive the retired dwell mirror or fire-and-forget persistence: ${token}`);
    }
  });

  [
    'getDomainSessionCursor',
    'getActiveSessionElapsedMs',
    'replayPendingSessionCommit',
  ].forEach((token) => {
    if (!trackerSource.includes(token)) {
      fail(`${trackerPath} must expose the exact domain-session cursor seam: missing ${token}`);
    }
  });

  [
    "requireBootstrapMethod(TabTimeTracker, 'replayPendingSessionCommit'",
    'await loadStatsCache(Date.now());',
    'await runStatsMutationBatch(',
    '() => TabTimeTracker.replayPendingSessionCommit({ skipCacheLoad: true })',
  ].forEach((token) => {
    if (!trackingServiceBootstrapSource.includes(token)) {
      fail(`${trackingServiceBootstrapPath} must replay pending domain sessions after installing the stats cache: missing ${token}`);
    }
  });
  [
    'deprecatedDevClock',
    'discardPendingCommitForDeprecatedDevClockMigration',
    'TRACKING_DEPRECATED_DEV_CLOCK_PENDING_COMMIT_DISCARDED',
  ].forEach((token) => {
    if (trackingServiceBootstrapSource.includes(token)) {
      fail(`${trackingServiceBootstrapPath} must fail loudly instead of reviving retired dev-clock recovery: ${token}`);
    }
  });
  const bootstrapLoadAt = trackingServiceBootstrapSource.indexOf('await loadStatsCache(Date.now());');
  const bootstrapReplayAt = trackingServiceBootstrapSource.indexOf(
    '() => TabTimeTracker.replayPendingSessionCommit({ skipCacheLoad: true })',
  );
  if (!(bootstrapLoadAt >= 0 && bootstrapReplayAt > bootstrapLoadAt)) {
    fail(`${trackingServiceBootstrapPath} must load the canonical stats day before replaying a pending domain session.`);
  }

  [
    'requireStoredDomainSession(sessionCommit)',
    'TRACKING_SESSION_DURATION_PENDING_COMMIT_REQUIRED',
    'sessionId',
    'startedAt',
    'endedAt',
    'targetDateStr',
  ].forEach((token) => {
    if (!sessionDurationRecorderSource.includes(token)) {
      fail(`${sessionDurationRecorderPath} must forward one exact pending session intent: missing ${token}`);
    }
  });

  [
    'export function recordSessionCommit(',
    'STATS_SESSION_COMMIT_ID_CONFLICT',
    'STATS_SESSION_COMMIT_OUT_OF_ORDER',
    'dayData.sessions.lastCommit = nextCommit',
  ].forEach((token) => {
    if (!statsAggregatorSource.includes(token)) {
      fail(`${statsAggregatorPath} must own durable session idempotency: missing ${token}`);
    }
  });
  if (!statsCollectorSource.includes('result.applied || result.duplicate')) {
    fail(`${statsCollectorPath} must retry durable projection for an already-applied pending session intent.`);
  }
  if (!statsBucketMaterializerSource.includes('normalizedDay.sessions?.lastCommit?.endedAt')) {
    fail(`${statsBucketMaterializerPath} must materialize the durable session commit cursor into its ending-hour bucket.`);
  }
  [
    'isReadableStatsHourlySessionDelta',
    "hasOwn(delta, 'lastCommit')",
    'requireStatsSessionCommitCursor(delta.lastCommit)',
  ].forEach((token) => {
    if (!dbStatsNormalizersSource.includes(token)) {
      fail(`${dbStatsNormalizersPath} must validate the exact hourly session commit cursor: missing ${token}`);
    }
  });

  [
    'TRACKING_ACTIVE_TAB_STATE_SESSION_STORE_REQUIRED',
    'TRACKING_ACTIVE_TAB_STATE_KEY_REQUIRED',
    'TRACKING_ACTIVE_TAB_STATE_IDLE_DETECTOR_REQUIRED',
    'TRACKING_ACTIVE_TAB_STATE_QUERY_TABS_REQUIRED',
    './trackingActiveTabCheckpoint.js',
    'readOptional(resolvedSessionActiveTabKey)',
    'activeTabCheckpointWriteTail.then(write, write)',
    'setActiveTabSegmentStartedAt',
  ].forEach((token) => {
    if (!activeTabRuntimeStateSource.includes(token)) {
      fail(`${activeTabRuntimeStatePath} must keep active-tab runtime ownership explicit: missing ${token}`);
    }
  });

  [
    'void sessionStore.set',
    'queryTabs = async () => []',
    'sessionStore.set({',
    'function getActiveTabInfo() {\n    return activeTabInfo;',
  ].forEach((token) => {
    if (activeTabRuntimeStateSource.includes(token)) {
      fail(`${activeTabRuntimeStatePath} must not hide missing owners or session persistence failures: ${token}`);
    }
  });

  [
    'TRACKING_ACTIVE_TAB_STATE_READ_INVALID',
    'TRACKING_ACTIVE_TAB_STATE_INVALID:',
    'requireActiveTabCheckpointReadResult',
    'requireStoredActiveTabCheckpoint',
  ].forEach((token) => {
    if (!activeTabCheckpointSource.includes(token)) {
      fail(`${activeTabCheckpointPath} must validate the exact current active-tab checkpoint: missing ${token}`);
    }
  });

  [
    'onDuration = async () => {}',
    'await onDuration({',
  ].forEach((token) => {
    if (domainSessionRuntimeStateSource.includes(token)) {
      fail(`${domainSessionRuntimeStatePath} must not hide active-session duration ownership behind no-op callbacks: ${token}`);
    }
  });

  if (dataCollectionPolicySource.includes('settings?.trackingScope')) {
    fail(`${dataCollectionPolicyPath} must not read the retired trackingScope field; release V1 accepts dataCollectionMode only.`);
  }

  if (dataCollectionPolicySource.includes('trackingScope:')) {
    fail(`${dataCollectionPolicyPath} must not emit derived trackingScope fields from collection policy snapshots.`);
  }

  if (popupBlockFlowSource.includes('settingsCache?.trackingScope')) {
    fail(`${popupBlockFlowPath} must use canonical dataCollectionMode for runtime policy decisions, not retired trackingScope.`);
  }

  if (
    !popupBlockFlowSource.includes('TRACKING_POPUP_BLOCK_FLOW_SITE_RULE_OWNER_REQUIRED')
    || !popupBlockFlowSource.includes('TRACKING_POPUP_BLOCK_FLOW_SITE_RULE_RESULT_INVALID')
    || !popupBlockFlowSource.includes('TRACKING_POPUP_BLOCK_FLOW_CONTENT_SCRIPT_SYNC_REQUIRED')
    || !popupBlockFlowSource.includes('TRACKING_POPUP_BLOCK_FLOW_PERMISSION_OWNER_REQUIRED')
    || !popupBlockFlowSource.includes('TRACKING_POPUP_BLOCK_FLOW_PERMISSION_RESULT_INVALID')
  ) {
    fail(`${popupBlockFlowPath} must fail loudly when popup site-rule, permission, or content-script sync owners are missing or malformed.`);
  }
  if (
    !popupBlockFlowSource.includes('let pendingPopupBlockMutationTail = Promise.resolve()')
    || !popupBlockFlowSource.includes('function enqueuePendingPopupBlockMutation')
  ) {
    fail(`${popupBlockFlowPath} must serialize popup queue read-modify-write operations through one rejection-resilient mutation lane.`);
  }

  [
    'applyPendingPopupProtectPatch',
    'syncManagedContentScripts = async',
    'permissionsGetAll',
    'granted?.permissions',
    'granted?.origins',
    'Failed to process pending popup domains:',
    'error: String(error?.message',
  ].forEach((token) => {
    if (popupBlockFlowSource.includes(token)) {
      fail(`${popupBlockFlowPath} must not hide popup protection owner failures behind no-op defaults: ${token}`);
    }
  });

  if (
    !managedContentScriptSyncSource.includes('MANAGED_CONTENT_SCRIPT_SCRIPTING_PERMISSION_OWNER_REQUIRED')
    || !managedContentScriptSyncSource.includes('MANAGED_CONTENT_SCRIPT_SCRIPTING_PERMISSION_RESULT_INVALID')
    || !managedContentScriptSyncSource.includes('MANAGED_CONTENT_SCRIPT_PERMISSION_SNAPSHOT_OWNER_REQUIRED')
    || !managedContentScriptSyncSource.includes('MANAGED_CONTENT_SCRIPT_PERMISSION_SNAPSHOT_INVALID')
  ) {
    fail(`${managedContentScriptSyncPath} must require explicit permission owners and reject malformed owner outputs.`);
  }

  [
    'permissionsContains',
    'permissionsGetAll',
    'granted?.origins',
  ].forEach((token) => {
    if (managedContentScriptSyncSource.includes(token)) {
      fail(`${managedContentScriptSyncPath} must not hide permission owner failures behind ChromeService defaults or optional snapshots: ${token}`);
    }
  });

  if (
    nudgeCyclePolicySource.includes('.catch(() => {})')
    || nudgeCyclePolicySource.includes('.catch(() => { })')
  ) {
    fail(`${nudgeCyclePolicyPath} must let nudge decision side-effect failures reach the handler warning boundary.`);
  }

  [
    'settingsService.commitSettingsMutation({',
    'prepare: (canonicalSettingsCache) =>',
    'normalizeSentinelStayDecisions(',
    'canonicalSettingsCache.sentinelStayDecisions',
    'existing.decidedAt >= nowTs',
    '...current',
  ].forEach((token) => {
    if (!nudgeCyclePolicySource.includes(token)) {
      fail(`${nudgeCyclePolicyPath} must derive stay decisions from the latest canonical cache inside the settings mutation lane: ${token}`);
    }
  });
  [
    'settingsService.ensureSettingsCache()',
    'settingsService.applySettingsChange({',
    'settingsCache.sentinelStayDecisions =',
    "changedKeys: ['sentinelStayDecisions']",
  ].forEach((token) => {
    if (nudgeCyclePolicySource.includes(token)) {
      fail(`${nudgeCyclePolicyPath} must not retain stale-cache RMW, manual cache writes, or non-protection stay-decision broadcasts: ${token}`);
    }
  });
  [
    'GLOBAL_SENTINEL_OUTCOME_PROPAGATION_OWNER_REQUIRED',
    'GLOBAL_SENTINEL_OUTCOME_PROPAGATION_RECEIPT_INVALID',
    'schedulePostCommitSettingsEffects({',
    "actionReason: 'global_sentinel_outcome'",
    '[STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME]',
    'shouldBroadcast: true',
    'waitForCompletion: false',
  ].forEach((token) => {
    if (!nudgeCyclePolicySource.includes(token)) {
      fail(`${nudgeCyclePolicyPath} must durably schedule the session-owned global Sentinel outcome through the settings propagation coordinator: ${token}`);
    }
  });
  if (nudgeCyclePolicySource.includes('broadcastSettingsUpdate')) {
    fail(`${nudgeCyclePolicyPath} must not bypass the durable coordinator with a direct global Sentinel outcome broadcast.`);
  }

  for (const entry of messageHandlerEntries) {
    if (!entry.endsWith('.js')) continue;
    const file = `${messageHandlerDir}/${entry}`;
    const source = await fs.readFile(path.resolve(rootDir, file), 'utf8');
    const silentFailurePatterns = [
      'sendResponse({ success: false });',
      'return { success: false };',
      '() => ({ success: false })',
      '=> ({ success: false })',
      '.catch(() => {})',
      '.catch(() => null)',
      'success: false, snapshot: null',
      "success: false, dataUrl: ''",
      'success: false, processed: 0',
    ];
    for (const pattern of silentFailurePatterns) {
      if (source.includes(pattern)) {
        fail(`${file} must include an explicit error code for runtime action failure responses: ${pattern}`);
      }
    }
  }

  for (const constraint of moduleBudgetConstraints) {
    const source = await fs.readFile(path.resolve(rootDir, constraint.file), 'utf8');
    enforceSoftModuleBudget({
      ...constraint,
      source,
      fail,
      label: 'tab-time-tracker-architecture',
    });
  }

  console.log('[tab-time-tracker-architecture] PASS: tracking runtime owners stay decomposed and TabTimeTracker remains a thin facade.');
};

main().catch((error) => {
  console.error('[tab-time-tracker-architecture] Unexpected error:', error);
  process.exit(1);
});
