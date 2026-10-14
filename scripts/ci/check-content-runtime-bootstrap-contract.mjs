#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const fail = (message) => {
  console.error(`[content-runtime-bootstrap-contract] FAIL: ${message}`);
  process.exit(1);
};

const readUtf8 = async (relativePath) => (
  fs.readFile(path.resolve(rootDir, relativePath), 'utf8')
);

const findSourceCallers = async (token) => {
  const sourceRoot = path.resolve(rootDir, 'src');
  const entries = await fs.readdir(sourceRoot, { recursive: true });
  const callers = [];
  for (const entry of entries) {
    if (typeof entry !== 'string' || !entry.endsWith('.js')) continue;
    const relativePath = path.posix.join('src', entry.split(path.sep).join('/'));
    const source = await readUtf8(relativePath);
    if (source.includes(token)) callers.push(relativePath);
  }
  return callers;
};

const assertIncludes = (source, token, filePath) => {
  if (!source.includes(token)) {
    fail(`${filePath} must include "${token}"`);
  }
};

const assertExcludes = (source, token, filePath, message) => {
  if (source.includes(token)) {
    fail(message || `${filePath} must not include "${token}"`);
  }
};

const main = async () => {
  const bootstrapControllerPath = 'src/apps/content/bootstrapController.js';
  const bootstrapStatePath = 'src/apps/content/bootstrap/bootstrapState.js';
  const runtimeControlChannelPath = 'src/apps/content/bootstrap/runtimeControlChannel.js';
  const contentSidecarsPath = 'src/apps/content/bootstrap/contentSidecars.js';
  const bootstrapEntryPath = 'src/apps/content/bootstrap.js';
  const loaderPath = 'src/apps/content/loader.js';
  const protectionControllerPath = 'src/domains/protection/content/ProtectionController.js';
  const protectionRuntimeDiagnosticsPath =
    'src/domains/protection/content/runtime/protectionRuntimeDiagnostics.js';
  const bootstrapEarlyRuntimePath = 'src/domains/protection/content/bootstrapEarlyRuntime.js';
  const sessionRegistryPath = 'src/domains/tracking/background/TabContentSessionRegistry.js';
  const orchestratorPath = 'src/domains/tracking/background/ContentScriptOrchestrator.js';
  const managedContentScriptSyncPath =
    'src/domains/tracking/background/ManagedContentScriptSync.js';
  const orchestratorStatePath = 'src/domains/tracking/background/contentScriptOrchestratorState.js';
  const contentRuntimeDiagnosticsPath = 'src/domains/tracking/background/ContentRuntimeDiagnostics.js';
  const runtimeCoordinatorPath = 'src/domains/tracking/background/trackingRuntimeCoordinator.js';
  const backgroundMessageRouterPath = 'src/apps/background/services/runtime/BackgroundMessageRouter.js';
  const contentScriptBindingsPath = 'src/apps/background/services/runtime/backgroundKernelContentScriptBindings.js';
  const trackingServiceBootstrapPath = 'src/domains/tracking/background/trackingServiceBootstrap.js';
  const trackingContentRuntimePath =
    'src/domains/tracking/background/trackingContentRuntimeHandlers.js';
  const trackingContentProtectionSyncPath =
    'src/domains/tracking/background/trackingContentProtectionSync.js';
  const trackingBrowserEventsPath =
    'src/domains/tracking/background/trackingBrowserEventHandlers.js';
  const backgroundKernelPath = 'src/apps/background/services/runtime/BackgroundAppKernel.js';
  const protectionDispatcherBindingsPath =
    'src/apps/background/services/runtime/backgroundKernelProtectionDispatcherBindings.js';
  const protectionTabLifecycleLedgerPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionTabLifecycleLedger.js';
  const tabLifecycleEventQueuePath =
    'src/domains/tracking/background/TabLifecycleEventQueue.js';
  const protectionRuntimeCoordinatorPath =
    'src/apps/background/services/runtime/ProtectionRuntimeCoordinator.js';
  const protectionDispatcherPath =
    'src/domains/protection/background/ProtectionDispatcher.js';
  const protectionGateDispatchBridgePath =
    'src/domains/protection/background/protocol/dispatch/ProtectionGateDispatchBridge.js';
  const protectionDispatchTransportPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js';
  const protectionTabUpdatedDispatchProtocolPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionTabUpdatedDispatchProtocol.js';
  const protectionDispatchSerialQueuePath =
    'src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js';
  const protectionDispatchLifecyclePrimitivesPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionDispatchLifecyclePrimitives.js';
  const protectionDispatchSettlementProofsPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionDispatchSettlementProofs.js';
  const protectionLiveAdmissionReconciliationPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionLiveAdmissionReconciliation.js';
  const protectionDispatchSettlementDiagnosticsPath =
    'src/domains/protection/background/protocol/dispatch/ProtectionDispatchSettlementDiagnostics.js';
  const contentReceiverCapabilityPath =
    'src/platform/messaging/contentReceiverCapability.js';
  const siteRuntimeE2EPath = 'scripts/e2e/siteRuntimeE2E.mjs';
  const siteRuntimeBrowserPath = 'scripts/e2e/sites/siteRuntimeBrowser.mjs';
  const contentRuntimeTargetArchitecturePath =
    'docs/architecture/runtime/content-runtime-target-architecture.md';
  const protectionContentRuntimeBoundaryMapPath =
    'docs/architecture/repository/protection-content-runtime-boundary-map.md';
  const lifecycleHarnessPath = 'scripts/perf/measureCwsRuntime.mjs';
  const lifecycleWakeContractPath = 'scripts/perf/cwsServiceWorkerWakeContract.mjs';

  const bootstrapControllerSource = await readUtf8(bootstrapControllerPath);
  const bootstrapStateSource = await readUtf8(bootstrapStatePath);
  const runtimeControlChannelSource = await readUtf8(runtimeControlChannelPath);
  const contentSidecarsSource = await readUtf8(contentSidecarsPath);
  const bootstrapEntrySource = await readUtf8(bootstrapEntryPath);
  const loaderSource = await readUtf8(loaderPath);
  const protectionControllerSource = await readUtf8(protectionControllerPath);
  assertExcludes(
    protectionControllerSource,
    'MESSAGE_ACTIONS.GET_SETTINGS',
    protectionControllerPath,
    'Protection sidecars must consume indicator settings from the authoritative update, not a second settings bootstrap.',
  );
  const protectionRuntimeDiagnosticsSource = await readUtf8(
    protectionRuntimeDiagnosticsPath,
  );
  const bootstrapEarlyRuntimeSource = await readUtf8(bootstrapEarlyRuntimePath);
  const sessionRegistrySource = await readUtf8(sessionRegistryPath);
  const orchestratorSource = await readUtf8(orchestratorPath);
  const managedContentScriptSyncSource = await readUtf8(managedContentScriptSyncPath);
  const orchestratorStateSource = await readUtf8(orchestratorStatePath);
  const contentRuntimeDiagnosticsSource = await readUtf8(contentRuntimeDiagnosticsPath);
  const runtimeCoordinatorSource = await readUtf8(runtimeCoordinatorPath);
  const backgroundMessageRouterSource = await readUtf8(backgroundMessageRouterPath);
  const contentScriptBindingsSource = await readUtf8(contentScriptBindingsPath);
  const trackingServiceBootstrapSource = await readUtf8(trackingServiceBootstrapPath);
  // Permission revocation belongs to raw ingress, before the full-init FIFO.
  [
    'invalidateContentPermissions();',
    "createPermissionListener(\n        'permission_removed'",
    "createPermissionListener(\n        'permission_added'",
  ].forEach(token => assertIncludes(trackingServiceBootstrapSource, token, trackingServiceBootstrapPath));
  const permissionListenerStart = trackingServiceBootstrapSource.indexOf('const createPermissionListener =');
  const permissionRevoke = trackingServiceBootstrapSource.indexOf('invalidateContentPermissions();', permissionListenerStart);
  const permissionEnqueue = trackingServiceBootstrapSource.indexOf('return afterFullInit(permissions);', permissionListenerStart);
  if (permissionListenerStart < 0 || permissionRevoke <= permissionListenerStart || permissionEnqueue <= permissionRevoke) {
    fail('Content permission authority must be revoked before permission reconciliation enters full-init admission.');
  }
  [
    'function invalidatePermissions()',
    "cancelTabReadiness(tabId, 'permissions_changed')",
    "assertPermissionsCurrent('catch_up_settled')",
    "assertPermissionsCurrent('registration_settled')",
    'permissionRevision !== expectedPermissionRevision',
  ].forEach(token => assertIncludes(orchestratorSource, token, orchestratorPath));
  assertIncludes(managedContentScriptSyncSource, "assertPermissionsCurrent?.('registration_plan_ready')", managedContentScriptSyncPath);
  const trackingContentRuntimeSource = await readUtf8(trackingContentRuntimePath);
  const trackingContentProtectionSyncSource = await readUtf8(
    trackingContentProtectionSyncPath,
  );
  const trackingBrowserEventsSource = await readUtf8(trackingBrowserEventsPath);
  const backgroundKernelSource = await readUtf8(backgroundKernelPath);
  assertIncludes(backgroundKernelSource, 'protectionDispatcher.invalidateDispatchPermissionCaches();', backgroundKernelPath);
  assertIncludes(backgroundKernelSource, 'contentScriptOrchestrator.invalidatePermissions();', backgroundKernelPath);
  const protectionDispatcherBindingsSource = await readUtf8(
    protectionDispatcherBindingsPath,
  );
  const protectionTabLifecycleLedgerSource = await readUtf8(
    protectionTabLifecycleLedgerPath,
  );
  const tabLifecycleEventQueueSource = await readUtf8(tabLifecycleEventQueuePath);
  const protectionRuntimeCoordinatorSource = await readUtf8(
    protectionRuntimeCoordinatorPath,
  );
  const protectionGateDispatchBridgeSource = await readUtf8(
    protectionGateDispatchBridgePath,
  );
  const protectionDispatcherSource = await readUtf8(protectionDispatcherPath);
  const protectionDispatchTransportSource = await readUtf8(protectionDispatchTransportPath);
  [
    "contentMutationFence?.assertCurrent('transport_before_recovery')",
    "contentMutationFence?.assertCurrent('transport_after_recovery_ready')",
    "throwIfProtectionDispatchAborted(dispatchAbortSignal, 'before_recovery')",
  ].forEach(token => assertIncludes(protectionDispatchTransportSource, token, protectionDispatchTransportPath));
  const protectionTabUpdatedDispatchProtocolSource = await readUtf8(
    protectionTabUpdatedDispatchProtocolPath,
  );
  const protectionDispatchSerialQueueSource = await readUtf8(
    protectionDispatchSerialQueuePath,
  );
  const protectionDispatchLifecyclePrimitivesSource = await readUtf8(
    protectionDispatchLifecyclePrimitivesPath,
  );
  const protectionDispatchSettlementProofsSource = await readUtf8(
    protectionDispatchSettlementProofsPath,
  );
  const protectionLiveAdmissionReconciliationSource = await readUtf8(
    protectionLiveAdmissionReconciliationPath,
  );
  const protectionDispatchSettlementDiagnosticsSource = await readUtf8(
    protectionDispatchSettlementDiagnosticsPath,
  );
  const contentReceiverCapabilitySource = await readUtf8(contentReceiverCapabilityPath);
  const siteRuntimeE2ESource = await readUtf8(siteRuntimeE2EPath);
  const siteRuntimeBrowserSource = await readUtf8(siteRuntimeBrowserPath);
  const contentRuntimeTargetArchitectureSource = await readUtf8(
    contentRuntimeTargetArchitecturePath,
  );
  const protectionContentRuntimeBoundaryMapSource = await readUtf8(
    protectionContentRuntimeBoundaryMapPath,
  );
  const lifecycleHarnessSource = await readUtf8(lifecycleHarnessPath);
  const lifecycleWakeContractSource = await readUtf8(lifecycleWakeContractPath);

  assertIncludes(bootstrapControllerSource, "publishBootstrapState('receiver_ready'", bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, "publishBootstrapState('active'", bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'installProtectionRuntimeReceiver()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'startProtectionRuntimeSidecars()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'startTopFrameMediaDiagnostics()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'teardownProtectionRuntimeReceiver()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'teardownProtectionRuntimeSidecars()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'teardownTopFrameMediaDiagnostics()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'teardownCLSEAlertOverlay()', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'contentRuntimeEpoch', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'CONTENT_BOOTSTRAP_REENTRY_BLOCKED', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'await publishBootstrappingState(', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'waitForAttempt(contentSidecars.start(epoch)', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'assertEpochCurrent(epoch', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'finishPostReceiverBootstrap', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'bootstrap_receiver_ready_degraded', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'CONTENT_BOOTSTRAP_SIDECAR_EPOCH_STALE', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'receiver_ready_before_commit', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'receiver_ready_after_commit', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'CONTENT_BOOTSTRAP_ATTEMPT_STALE_NOOP', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, 'revokeBootstrapAttempt(attempt', bootstrapControllerPath);
  assertExcludes(
    bootstrapControllerSource,
    "publishBootstrapState('ready'",
    bootstrapControllerPath,
    `${bootstrapControllerPath} must not collapse receiver_ready back into ready.`,
  );
  assertExcludes(
    bootstrapControllerSource,
    'initProtectionController(',
    bootstrapControllerPath,
    `${bootstrapControllerPath} must not call the retired combined protection bootstrap entrypoint.`,
  );
  assertExcludes(
    bootstrapControllerSource,
    'runtimeLanguageSubscriptionInstalled',
    bootstrapControllerPath,
    `${bootstrapControllerPath} must use explicit unsubscribe-based language hydration teardown.`,
  );
  assertExcludes(
    bootstrapControllerSource,
    '.catch(() => null)',
    bootstrapControllerPath,
    `${bootstrapControllerPath} must not hide bootstrap state publish failures.`,
  );
  assertExcludes(
    bootstrapControllerSource,
    'return previous;',
    bootstrapControllerPath,
    `${bootstrapControllerPath} must reject active/fresh same-document re-entry instead of returning previous state.`,
  );
  assertExcludes(
    bootstrapControllerSource,
    "reason: 'bootstrap_active_degraded'",
    bootstrapControllerPath,
    `${bootstrapControllerPath} must not claim active when post-receiver sidecar activation failed.`,
  );

  assertIncludes(bootstrapStateSource, 'CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT_MS', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'Promise.race', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'createContentBootstrapAttemptLease', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'activateBootstrapAttempt', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'assertBootstrapAttemptCurrent', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'revokeBootstrapAttempt', bootstrapStatePath);
  assertIncludes(bootstrapStateSource, 'CONTENT_BOOTSTRAP_ATTEMPT_STALE', bootstrapStatePath);
  assertExcludes(
    bootstrapStateSource,
    '.catch(() => null)',
    bootstrapStatePath,
    `${bootstrapStatePath} must reject publish failures and timeouts.`,
  );
  assertExcludes(
    bootstrapStateSource,
    'catch (_) {',
    bootstrapStatePath,
    `${bootstrapStatePath} must not swallow bootstrap state read/write failures.`,
  );

  assertIncludes(runtimeControlChannelSource, 'CONTENT_RUNTIME_CONTROL_FLAG', runtimeControlChannelPath);
  assertIncludes(runtimeControlChannelSource, 'MESSAGE_TYPES.CONTENT_RUNTIME_PROBE', runtimeControlChannelPath);
  assertIncludes(runtimeControlChannelSource, 'ENTROPY_RUNTIME_BUILD_INFO.buildId', runtimeControlChannelPath);
  assertIncludes(runtimeControlChannelSource, 'readBootstrapState()', runtimeControlChannelPath);
  assertIncludes(runtimeControlChannelSource, 'receiverCapabilityVersion:', runtimeControlChannelPath);
  [
    'readBootstrapState()?.attemptId !== attemptId',
    'CONTENT_RUNTIME_TEARDOWN_IDENTITY_INVALID',
    '(async () => onTeardown(',
    '...acknowledgement, ok: true',
  ].forEach((token) => assertIncludes(runtimeControlChannelSource, token, runtimeControlChannelPath));
  assertExcludes(runtimeControlChannelSource, 'void onTeardown(', runtimeControlChannelPath);
  [
    '}, { documentId })',
    'ack.teardownId === teardownId',
    'ack.attemptId === attemptId',
    'await settleSessionReconciliation(',
    'CONTENT_SCRIPT_TEARDOWN_DOCUMENT_IDENTITY_REQUIRED',
    "ownedSession?.status === 'absent'",
    'documentId === null',
    'attemptId === null',
    'ownedSession.attemptCount === 0',
    "recordDiagnostic('teardown_not_required'",
    "disposition: 'runtime_absent'",
  ].forEach((token) => assertIncludes(orchestratorSource, token, orchestratorPath));
  assertIncludes(bootstrapControllerSource, 'return settleRuntimeCleanup([', bootstrapControllerPath);
  assertIncludes(bootstrapControllerSource, '() => clearProtectionRuntimeEffects()', bootstrapControllerPath);
  assertExcludes(
    bootstrapControllerSource,
    'clearResolvedFriction',
    bootstrapControllerPath,
    'Content bootstrap must clear compiled effects through the canonical registry, not a duplicate nudge facade.',
  );
  assertExcludes(
    bootstrapControllerSource,
    'StatusIndicator.teardown()',
    bootstrapControllerPath,
    'Protection sidecar teardown owns indicator cleanup; bootstrap must not invoke the same owner twice.',
  );
  assertIncludes(contentSidecarsSource, 'async function teardown()', contentSidecarsPath);
  assertExcludes(contentSidecarsSource, 'void faviconCaptureModulePromise', contentSidecarsPath);
  assertIncludes(
    orchestratorSource,
    "reason: 'receiver_capability_unavailable'",
    orchestratorPath,
  );
  assertExcludes(
    runtimeControlChannelSource,
    'catch (_) {',
    runtimeControlChannelPath,
    `${runtimeControlChannelPath} must not hide control-flag write failures.`,
  );

  assertIncludes(contentSidecarsSource, 'async function start(epoch)', contentSidecarsPath);
  assertIncludes(contentSidecarsSource, 'CONTENT_BOOTSTRAP_SIDECAR_EPOCH_STALE', contentSidecarsPath);
  assertIncludes(contentSidecarsSource, 'await Promise.all', contentSidecarsPath);
  assertExcludes(
    contentSidecarsSource,
    '.catch(() => {',
    contentSidecarsPath,
    `${contentSidecarsPath} must not hide sidecar import or teardown failures.`,
  );

  assertIncludes(
    protectionControllerSource,
    'export function installProtectionRuntimeReceiver()',
    protectionControllerPath,
  );
  assertIncludes(
    protectionControllerSource,
    'export function startProtectionRuntimeSidecars()',
    protectionControllerPath,
  );
  assertIncludes(
    protectionControllerSource,
    'export function teardownProtectionRuntimeReceiver()',
    protectionControllerPath,
  );
  assertIncludes(
    protectionControllerSource,
    'export async function teardownProtectionRuntimeSidecars()',
    protectionControllerPath,
  );
  for (const contract of ['PROTECTION_SIDECAR_CLEANUP_FAILED', 'PROTECTION_RECEIVER_OPERATION_CANCELLED', 'visualEffectBridgeAbort']) {
    assertIncludes(protectionControllerSource, contract, protectionControllerPath);
  }
  assertIncludes(
    protectionControllerSource,
    'recordProtectionRuntimeActivationAttempt({',
    protectionControllerPath,
  );
  assertIncludes(
    protectionControllerSource,
    'recordProtectionRuntimeActivationApplied({',
    protectionControllerPath,
  );
  const appliedDiagnosticsIndex = protectionControllerSource.indexOf(
    'recordProtectionRuntimeActivationApplied({',
  );
  const clearMutationIndex = protectionControllerSource.indexOf(
    'await clearProtectionRuntimeEffects();',
  );
  const effectMutationIndex = protectionControllerSource.indexOf(
    'await applyProtectionRuntimeEffectsCooperatively(activationPlan.filters',
  );
  if (clearMutationIndex < 0 || effectMutationIndex < 0
    || appliedDiagnosticsIndex <= Math.max(clearMutationIndex, effectMutationIndex)) {
    fail(
      `${protectionControllerPath} must commit applied activation diagnostics after effect mutation.`,
    );
  }
  [
    'runtimeAttempt: null',
    'export function recordProtectionRuntimeActivationAttempt(details = {})',
    'export function recordProtectionRuntimeActivationApplied(details = {})',
    "type: 'runtime_activation_attempt'",
    "type: 'runtime_activation_applied'",
    'runtimeAttempt: state.runtimeAttempt',
  ].forEach((token) => assertIncludes(
    protectionRuntimeDiagnosticsSource,
    token,
    protectionRuntimeDiagnosticsPath,
  ));
  assertExcludes(
    protectionControllerSource,
    'initProtectionController(',
    protectionControllerPath,
    `${protectionControllerPath} must not reintroduce initProtectionController().`,
  );

  assertIncludes(bootstrapEntrySource, 'export { bootstrapContentRuntime }', bootstrapEntryPath);
  assertExcludes(
    bootstrapEntrySource,
    'void bootstrapContentRuntime()',
    bootstrapEntryPath,
    `${bootstrapEntryPath} must stay as an explicit bootstrap export, not a side-effect-only entry.`,
  );

  assertIncludes(loaderSource, 'runBootstrapEntry(', loaderPath);
  assertIncludes(loaderSource, 'shouldAllowRebootstrap', loaderPath);
  assertIncludes(loaderSource, 'bootstrapContentRuntime', loaderPath);
  assertIncludes(loaderSource, 'createBootstrapAttemptLease', loaderPath);
  assertIncludes(loaderSource, 'existingAttemptLease.cancel(', loaderPath);
  assertIncludes(loaderSource, 'shouldAllowRebootstrap && existingLeaseMatchesState', loaderPath);
  assertIncludes(loaderSource, 'waitForAttempt(', loaderPath);
  assertIncludes(loaderSource, 'CONTENT_LOADER_ATTEMPT_STALE_NOOP', loaderPath);
  assertIncludes(loaderSource, 'bootstrapModule.bootstrapContentRuntime(attempt)', loaderPath);

  assertIncludes(bootstrapEarlyRuntimeSource, 'assertAttemptCurrent', bootstrapEarlyRuntimePath);
  assertIncludes(bootstrapEarlyRuntimeSource, "assertCurrent('snapshot_read')", bootstrapEarlyRuntimePath);
  assertIncludes(bootstrapEarlyRuntimeSource, "assertCurrent('effects_apply')", bootstrapEarlyRuntimePath);

  assertIncludes(sessionRegistrySource, 'waitForDispatchReady(', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'buildSessionKey(', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'sessionKey:', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, "return status === 'receiver_ready' || status === 'active';", sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'isStaleCrossDocumentUpdate', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'isOlderSameDocumentAttempt', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'isSameAttemptTerminalRegression', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'isMissingSameDocumentAttemptIdentity', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'shouldAdoptLoaderReinjectedAttemptIdentity', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'next.startedAt = normalizeEpochMs(payload.startedAt);', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'incomingStartedAt === previousStartedAt', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'normalizeEpochMs(previous?.startedAt) === incomingStartedAt', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'incomingAttemptId === previousAttemptId', sessionRegistryPath);
  assertIncludes(sessionRegistrySource, 'function refreshScope(', sessionRegistryPath);
  assertIncludes(orchestratorSource, 'tabContentSessionRegistry.refreshScope(', orchestratorPath);
  assertIncludes(orchestratorSource, 'async function recoverExistingContentRuntime(', orchestratorPath);
  assertIncludes(orchestratorSource, 'MESSAGE_TYPES.CONTENT_RUNTIME_PROBE', orchestratorPath);
  assertIncludes(orchestratorSource, "source: 'content_runtime_probe'", orchestratorPath);
  assertIncludes(orchestratorSource, "recordDiagnostic('existing_runtime_probe_recovered'", orchestratorPath);
  assertIncludes(orchestratorSource, 'normalizeUnboundDocumentProbeResult(', orchestratorPath);
  assertIncludes(managedContentScriptSyncSource, 'scriptingUpdateContentScripts([scriptConfig])', managedContentScriptSyncPath);
  assertIncludes(
    managedContentScriptSyncSource,
    'let catchUpReconciledDomainsCache = new Set();',
    managedContentScriptSyncPath,
  );
  assertIncludes(
    managedContentScriptSyncSource,
    '(domain) => !catchUpReconciledDomainsCache.has(domain)',
    managedContentScriptSyncPath,
  );
  assertIncludes(
    managedContentScriptSyncSource,
    'if (injectOpenTabs && applySucceeded)',
    managedContentScriptSyncPath,
  );
  assertIncludes(
    managedContentScriptSyncSource,
    "const requiresServiceInitCatchUp = reason === 'service_init';",
    managedContentScriptSyncPath,
  );
  assertIncludes(
    managedContentScriptSyncSource,
    'catchUpPlanDiagnostic = createCatchUpPlanDiagnostic({',
    managedContentScriptSyncPath,
  );
  assertExcludes(
    managedContentScriptSyncSource,
    'forceReRegister',
    managedContentScriptSyncPath,
    `${managedContentScriptSyncPath} must not turn an empty worker-local cache into unregister/register churn.`,
  );
  assertIncludes(orchestratorSource, 'function refreshTabUrl(', orchestratorPath);
  assertIncludes(orchestratorSource, "recordDiagnostic('session_url_refreshed'", orchestratorPath);
  [
    'validateCanonicalBootstrapMessage',
    'CONTENT_BOOTSTRAP_TOP_FRAME_REQUIRED',
    'CONTENT_BOOTSTRAP_DOCUMENT_ID_MISMATCH',
    'CONTENT_BOOTSTRAP_ATTEMPT_ID_REQUIRED',
    'protectionSync.reserve(protectionSync.createPlan(context, session))',
    'sendResponse(response);',
    'protectionSync.start(reservation);',
  ].forEach((token) => assertIncludes(
    trackingContentRuntimeSource,
    token,
    trackingContentRuntimePath,
  ));
  const validationIndex = trackingContentRuntimeSource.indexOf(
    'const context = validateCanonicalBootstrapMessage(request, sender);',
  );
  const sessionMutationIndex = trackingContentRuntimeSource.indexOf(
    'const session = noteContentBootstrapState(context.request, sender);',
  );
  if (validationIndex < 0 || sessionMutationIndex <= validationIndex) {
    fail(`${trackingContentRuntimePath} must validate sender/document identity before session mutation.`);
  }
  [
    'CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT_MS = 2_000',
    'CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_ATTEMPTS = 2',
    'CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_TABS = 128',
    'PROTECTION_UPDATE_BOOTSTRAP_OWNER_REASONS',
    "'protection_dispatch_transaction:dispatch_ready_retry'",
    "'protection_update:receiver_missing:dispatch_ready_retry'",
    'active_after_receiver_ready',
    'loader_reinjected',
    'attemptKey: `${sessionKey}:${attemptId}:${startedAt}`',
    'pendingRecords: new Set()',
    'captureAdmission({',
    'runCapturedTask({',
    'expectedDocumentId: reservation.plan.documentId',
    'bootstrap_protection_sync_timeout_pending',
    'bootstrap_protection_sync_retry_pending',
    'pendingSyncAttempt: queuedRetry.syncAttempt',
    'pendingStatus: queuedRetry.status',
    "reason: 'protection_update_bootstrap_owned'",
    'bootstrapOwnerReason: session.bootstrapOwnerReason',
    "reason: 'awaiting_owner_settlement'",
    'isProvenProtectionDispatchDocumentOvertaken(error, {',
    'function reportSupersededDocument(reservation, error)',
    "reservation.record.status = 'superseded';",
    "safeRecord('bootstrap_protection_sync_document_superseded'",
    "error?.code === 'CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE'",
    "error?.details?.reason === 'document_replaced'",
    'error.details.tabId === reservation.plan.tabId',
    'error.details.expectedDocumentId === reservation.plan.documentId',
    'error.details.currentDocumentId === error.details.currentDocumentId.trim()',
    'error.details.currentDocumentId !== reservation.plan.documentId',
    'currentDocumentId === currentDocumentId.trim()',
    "reason: 'context_changed'",
    'function invalidateTab(',
    'function evictTab(',
  ].forEach((token) => assertIncludes(
    trackingContentProtectionSyncSource,
    token,
    trackingContentProtectionSyncPath,
  ));
  const protectionUpdateOwnerReasonsStart = trackingContentProtectionSyncSource.indexOf(
    'const PROTECTION_UPDATE_BOOTSTRAP_OWNER_REASONS = new Set([',
  );
  const protectionUpdateOwnerReasonsEnd = trackingContentProtectionSyncSource.indexOf(
    ']);',
    protectionUpdateOwnerReasonsStart,
  );
  const protectionUpdateOwnerReasonsSource = trackingContentProtectionSyncSource.slice(
    protectionUpdateOwnerReasonsStart,
    protectionUpdateOwnerReasonsEnd,
  );
  [
    "'protection_dispatch_transaction'",
    "'protection_dispatch_transaction:dispatch_ready_retry'",
    "'protection_dispatch_transaction:receiver_missing'",
    "'protection_dispatch_transaction:receiver_missing:dispatch_ready_retry'",
    "'protection_update'",
    "'protection_update:dispatch_ready_retry'",
    "'protection_update:receiver_missing'",
    "'protection_update:receiver_missing:dispatch_ready_retry'",
  ].forEach((token) => {
    if (!protectionUpdateOwnerReasonsSource.includes(token)) {
      fail(`${trackingContentProtectionSyncPath} must keep the closed protection-update injection reason: ${token}`);
    }
  });
  [
    'bootstrapInjectionReason: null',
    'bootstrapInjectionGeneration: null',
    'bootstrapOwnerReason: null',
    'bootstrapInjectionReason: normalizeBootstrapInjectionReason(reason)',
    'bootstrapInjectionGeneration: nextAttemptCount',
    'function releaseBootstrapInjection(',
    'function failBootstrapInjection(',
    "releaseReason !== 'dispatch_ready_timeout'",
    'previous.bootstrapInjectionReason !== normalizedExpectedReason',
    'previous.bootstrapInjectionGeneration !== normalizedExpectedGeneration',
    'const loaderReinjectedDocumentIdentityCompatible = !previous.documentId',
    '&& loaderReinjectedDocumentIdentityCompatible',
    'next.bootstrapOwnerReason = next.bootstrapInjectionReason;',
  ].forEach((token) => assertIncludes(sessionRegistrySource, token, sessionRegistryPath));
  if (
    sessionRegistrySource.split('next.bootstrapOwnerReason = next.bootstrapInjectionReason;').length - 1 !== 2
    || sessionRegistrySource.includes('bootstrapOwnerReason: reason')
  ) {
    fail(`${sessionRegistryPath} must certify a bootstrap owner only at strict inject-to-ready integrations.`);
  }
  const injectionFailureOwnerStart = sessionRegistrySource.indexOf(
    'function failBootstrapInjection(',
  );
  const injectionFailureOwnerEnd = sessionRegistrySource.indexOf(
    'function noteBootstrapState(',
    injectionFailureOwnerStart,
  );
  const injectionFailureOwnerSource = sessionRegistrySource.slice(
    injectionFailureOwnerStart,
    injectionFailureOwnerEnd,
  );
  [
    'const normalizedExpectedReason = normalizeBootstrapInjectionReason(expectedReason);',
    'const normalizedExpectedGeneration = requireBootstrapInjectionGeneration(expectedGeneration);',
    'const normalizedUrl = requireBootstrapInjectionFailureUrl(url);',
    'const normalizedError = requireFailedBootstrapError({ error });',
    'const normalizedFailedAt = requireBootstrapInjectionFailedAt(failedAt);',
    'previous.bootstrapInjectionReason !== normalizedExpectedReason',
    'previous.bootstrapInjectionGeneration !== normalizedExpectedGeneration',
    'return skipSessionCommit;',
    'failed = true;',
    "status: 'failed'",
    'url: normalizeUrl(previous.url, normalizedUrl)',
    'bootstrapInjectionReason: null',
    'bootstrapInjectionGeneration: null',
    'bootstrapOwnerReason: null',
    'return Object.freeze({ failed, session });',
  ].forEach((token) => assertIncludes(
    injectionFailureOwnerSource,
    token,
    sessionRegistryPath,
  ));
  const injectionFailureReasonFence = injectionFailureOwnerSource.indexOf(
    'previous.bootstrapInjectionReason !== normalizedExpectedReason',
  );
  const injectionFailureGenerationFence = injectionFailureOwnerSource.indexOf(
    'previous.bootstrapInjectionGeneration !== normalizedExpectedGeneration',
  );
  const injectionFailureCommit = injectionFailureOwnerSource.indexOf('failed = true;');
  if (
    injectionFailureOwnerStart < 0
    || injectionFailureOwnerEnd <= injectionFailureOwnerStart
    || injectionFailureReasonFence < 0
    || injectionFailureGenerationFence < 0
    || injectionFailureCommit < 0
    || injectionFailureReasonFence >= injectionFailureCommit
    || injectionFailureGenerationFence >= injectionFailureCommit
  ) {
    fail(`${sessionRegistryPath} must reject a superseded injection failure before mutating session state.`);
  }
  assertExcludes(
    trackingContentProtectionSyncSource,
    ".startsWith('protection_update:')",
    trackingContentProtectionSyncPath,
    `${trackingContentProtectionSyncPath} must use the closed protection-update injection reason set.`,
  );
  assertExcludes(
    trackingContentProtectionSyncSource,
    'Promise.race',
    trackingContentProtectionSyncPath,
    `${trackingContentProtectionSyncPath} must keep the FIFO and profile lease fail-closed until the admitted dispatch settles.`,
  );
  const supersededReporterStart = trackingContentProtectionSyncSource.indexOf(
    'function reportSupersededDocument(reservation, error)',
  );
  const supersededReporterEnd = trackingContentProtectionSyncSource.indexOf(
    'function settleReservationError(reservation, error)',
    supersededReporterStart,
  );
  const supersededReporterSource = trackingContentProtectionSyncSource.slice(
    supersededReporterStart,
    supersededReporterEnd,
  );
  if (
    supersededReporterStart < 0
    || supersededReporterEnd <= supersededReporterStart
    || supersededReporterSource.includes('console.error')
  ) {
    fail(`${trackingContentProtectionSyncPath} must settle proven old-document supersession as a typed non-error diagnostic.`);
  }
  [
    "contentProtectionSync.invalidateTab(details?.tabId, {",
    "reason: 'web_navigation_committed'",
    'protectionDispatcher.markTabNavigated(details?.tabId, {',
    'protectionDispatcher.markTabUrlChanged(details?.tabId, {',
    'protectionDispatcher.captureTabUpdatedIngress(',
    'protectionDispatcher.isTabUpdatedIngressCurrent(',
    'tabLifecycleEventQueue.enqueue(tabId, runAdmittedHandler)',
    'consumeProtectionTabUpdatedDispatchOutcome(result, { receipt })',
    'isProtectionTabUpdatedDispatchOutcome(result)',
  'await ensoCadenceBridge?.settle(cadenceReceipt)',
  'const result = await handler(...args)',
  'await ensoCadenceBridge?.refresh(cadenceReceipt)',
    'contentScriptOrchestrator.refreshTabUrl(details?.tabId, {',
    "contentProtectionSync.evictTab(tabId, { reason: 'tab_removed' })",
    "protectionDispatcher.invalidateTabForRemoval(tabId, { reason: 'tab_removed' })",
    "contentProtectionSync.evictTab(removedTabId, { reason: 'tab_replaced' })",
    "protectionDispatcher.invalidateTabForRemoval(removedTabId, { reason: 'tab_replaced' })",
  ].forEach((token) => assertIncludes(
    trackingBrowserEventsSource,
    token,
    trackingBrowserEventsPath,
  ));
  [
    'function captureTabUpdatedIngress(tabId, {',
    'const sessionSnapshot = requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId);',
    'return tabLifecycleLedger.captureTabUpdated({',
    'observedSessionGeneration: hasReadySession',
    'function isTabUpdatedIngressCurrent(receipt) {',
  ].forEach((token) => assertIncludes(
    protectionDispatcherSource,
    token,
    protectionDispatcherPath,
  ));
  [
    'createProtectionTabUpdatedIngressReceipt({',
    'function noteCommitted({',
    'const proof = ingress.url && ingress.documentId',
    'invalidationTag: historyGeneration',
    'function getCommittedProof(tabIdValue) {',
    'function noteHistory({',
    'const generation = (previous?.historyGeneration || 0) + 1;',
    'function isTabUpdatedCurrent(receipt) {',
    'if (!previous.removed) return false;',
  ].forEach((token) => assertIncludes(
    protectionTabLifecycleLedgerSource,
    token,
    protectionTabLifecycleLedgerPath,
  ));
  const tabUpdatedCurrentStart = protectionTabLifecycleLedgerSource.indexOf(
    'function isTabUpdatedCurrent(receipt) {',
  );
  const tabUpdatedCurrentEnd = protectionTabLifecycleLedgerSource.indexOf(
    'function getSnapshot(tabIdValue) {',
    tabUpdatedCurrentStart,
  );
  const tabUpdatedCurrentSource = protectionTabLifecycleLedgerSource.slice(
    tabUpdatedCurrentStart,
    tabUpdatedCurrentEnd,
  );
  if (
    tabUpdatedCurrentStart < 0
    || tabUpdatedCurrentEnd <= tabUpdatedCurrentStart
  ) {
    fail(`${protectionTabLifecycleLedgerPath} must own tab-updated receipt currency in isTabUpdatedCurrent.`);
  } else {
    // A newer ledger entry may settle an older receipt, but only through a
    // branch that names the entry kind it is reasoning about: a tab_updated
    // entry proves currency by carrying the same URL across loading->complete,
    // and a committed entry proves it by carrying the same URL. The guard is on
    // the shape of that reasoning, not on one kind, so a kind added later still
    // has to state its own rule.
    [
      "if (latest.kind === 'tab_updated') {",
      "receipt.status === 'loading' && latest.status === 'complete'",
      "if (latest.kind === 'committed') {",
      'return latest.url === receipt.requestedUrl;',
    ].forEach((token) => assertIncludes(
      tabUpdatedCurrentSource,
      token,
      protectionTabLifecycleLedgerPath,
    ));
    const tabUpdatedCurrentStatements = tabUpdatedCurrentSource
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line !== '}');
    if (tabUpdatedCurrentStatements.at(-1) !== 'return false;') {
      fail(`${protectionTabLifecycleLedgerPath} must refuse receipt currency for any ledger entry kind isTabUpdatedCurrent does not explicitly recognize.`);
    }
  }
  [
    'const tailByTabId = new Map();',
    'const previousTail = tailByTabId.get(tabId) || Promise.resolve();',
    '.catch(() => undefined)',
    '.then(task)',
  ].forEach((token) => assertIncludes(
    tabLifecycleEventQueueSource,
    token,
    tabLifecycleEventQueuePath,
  ));
  assertExcludes(
    trackingBrowserEventsSource,
    'isProvenProtectionDispatchContextOvertaken',
    trackingBrowserEventsPath,
    `${trackingBrowserEventsPath} must not infer supersession from requested/session URL mismatch.`,
  );
  assertExcludes(
    trackingBrowserEventsSource,
    "canceled: 'protection_context_superseded'",
    trackingBrowserEventsPath,
    `${trackingBrowserEventsPath} must keep URL/context mismatches terminal.`,
  );
  [
    'isProvenProtectionDispatchHistoryContextOvertaken',
    'isProvenProtectionDispatchHistoryOvertookPendingTabUpdate',
    'isProvenProtectionDispatchPreAckHistoryCancellation',
    'isProvenProtectionDispatchDocumentOvertaken',
    'consumeSupersededProtectionHistoryContext',
    'consumeSupersededProtectionDocument',
  ].forEach((token) => assertExcludes(
    trackingBrowserEventsSource,
    token,
    trackingBrowserEventsPath,
    `${trackingBrowserEventsPath} must not classify lifecycle error shapes outside the exact dispatch settlement seam: ${token}`,
  ));
  const committedNavigationIngressStart = trackingBrowserEventsSource.indexOf(
    'handleWebNavigationCommitted: (details = {}) => {',
  );
  const committedNavigationIngressEnd = trackingBrowserEventsSource.indexOf(
    'handleWebNavigationHistoryStateUpdated:',
    committedNavigationIngressStart,
  );
  const committedNavigationIngressSource = trackingBrowserEventsSource.slice(
    committedNavigationIngressStart,
    committedNavigationIngressEnd,
  );
  const committedInvalidationIndex = committedNavigationIngressSource.indexOf(
    'contentProtectionSync.invalidateTab(details?.tabId, {',
  );
  const committedDispatcherInvalidationIndex = committedNavigationIngressSource.indexOf(
    'protectionDispatcher.markTabNavigated(details?.tabId, {',
  );
  const committedSessionInvalidationIndex = committedNavigationIngressSource.indexOf(
    'contentScriptOrchestrator.markTabNavigated(details?.tabId, {',
  );
  const committedAdmissionIndex = committedNavigationIngressSource.indexOf(
    'return admittedWebNavigationCommittedHandler(details);',
  );
  if (
    committedNavigationIngressStart < 0
    || committedNavigationIngressEnd <= committedNavigationIngressStart
    || committedInvalidationIndex < 0
    || committedDispatcherInvalidationIndex <= committedInvalidationIndex
    || committedSessionInvalidationIndex <= committedDispatcherInvalidationIndex
    || committedAdmissionIndex <= committedSessionInvalidationIndex
  ) {
    fail(`${trackingBrowserEventsPath} must invalidate catch-up, dispatcher, and content-session state together at committed-document ingress before init/profile admission.`);
  }
  const historyIngressStart = trackingBrowserEventsSource.indexOf(
    'handleWebNavigationHistoryStateUpdated: (details = {}) => {',
  );
  const historyIngressEnd = trackingBrowserEventsSource.indexOf(
    'handleTabCreated:',
    historyIngressStart,
  );
  const historyIngressSource = trackingBrowserEventsSource.slice(
    historyIngressStart,
    historyIngressEnd,
  );
  const historyDispatcherInvalidationIndex = historyIngressSource.indexOf(
    'protectionDispatcher.markTabUrlChanged(details?.tabId, {',
  );
  const historySessionRefreshIndex = historyIngressSource.indexOf(
    'contentScriptOrchestrator.refreshTabUrl(details?.tabId, {',
  );
  const historyAdmissionIndex = historyIngressSource.indexOf(
    'return admittedWebNavigationHistoryStateUpdatedHandler(details);',
  );
  if (
    historyIngressStart < 0
    || historyIngressEnd <= historyIngressStart
    || historyDispatcherInvalidationIndex < 0
    || historySessionRefreshIndex <= historyDispatcherInvalidationIndex
    || historyAdmissionIndex <= historySessionRefreshIndex
  ) {
    fail(`${trackingBrowserEventsPath} must invalidate prior-URL dispatch work and refresh the same-document session URL before History ingress admission.`);
  }
  const removedIngressStart = trackingBrowserEventsSource.indexOf('handleTabRemoved: (tabId) => {');
  const removedEvictionIndex = trackingBrowserEventsSource.indexOf(
    "contentProtectionSync.evictTab(tabId, { reason: 'tab_removed' });",
    removedIngressStart,
  );
  const removedAdmissionIndex = trackingBrowserEventsSource.indexOf(
    'return admittedTabRemovedHandler(tabId);',
    removedIngressStart,
  );
  const removedDispatcherCloseIndex = trackingBrowserEventsSource.indexOf(
    "protectionDispatcher.invalidateTabForRemoval(tabId, { reason: 'tab_removed' });",
    removedIngressStart,
  );
  const replacedIngressStart = trackingBrowserEventsSource.indexOf(
    'handleTabReplaced: (addedTabId, removedTabId) => {',
  );
  const replacedEvictionIndex = trackingBrowserEventsSource.indexOf(
    "contentProtectionSync.evictTab(removedTabId, { reason: 'tab_replaced' });",
    replacedIngressStart,
  );
  const replacedAdmissionIndex = trackingBrowserEventsSource.indexOf(
    'return admittedTabReplacedHandler(addedTabId, removedTabId);',
    replacedIngressStart,
  );
  const replacedDispatcherCloseIndex = trackingBrowserEventsSource.indexOf(
    "protectionDispatcher.invalidateTabForRemoval(removedTabId, { reason: 'tab_replaced' });",
    replacedIngressStart,
  );
  if (
    removedIngressStart < 0
    || removedEvictionIndex < removedIngressStart
    || removedDispatcherCloseIndex <= removedEvictionIndex
    || removedAdmissionIndex <= removedDispatcherCloseIndex
    || replacedIngressStart < 0
    || replacedEvictionIndex < replacedIngressStart
    || replacedDispatcherCloseIndex <= replacedEvictionIndex
    || replacedAdmissionIndex <= replacedDispatcherCloseIndex
  ) {
    fail(`${trackingBrowserEventsPath} must evict catch-up state and close dispatcher admission for removed/replaced tabs before init/profile admission.`);
  }
  [
    "contentProtectionSync.invalidateTab(details?.tabId, {",
    "contentProtectionSync.evictTab(tabId, { reason: 'tab_removed' });",
    "protectionDispatcher.invalidateTabForRemoval(tabId, { reason: 'tab_removed' });",
    "contentProtectionSync.evictTab(removedTabId, { reason: 'tab_replaced' });",
    "protectionDispatcher.invalidateTabForRemoval(removedTabId, { reason: 'tab_replaced' });",
  ].forEach((token) => {
    if (trackingBrowserEventsSource.split(token).length - 1 !== 1) {
      fail(`${trackingBrowserEventsPath} must execute lifecycle sync fencing exactly once at browser ingress: ${token}`);
    }
  });
  const removedOwnerCleanupStart = trackingBrowserEventsSource.indexOf(
    'function evictRemovedTabRuntimeOwners(tabId, reason) {',
  );
  const removedOwnerCleanupEnd = trackingBrowserEventsSource.indexOf(
    'async function handleTabRemoved(tabId) {',
    removedOwnerCleanupStart,
  );
  const removedOwnerCleanupSource = trackingBrowserEventsSource.slice(
    removedOwnerCleanupStart,
    removedOwnerCleanupEnd,
  );
  const removedOwnerDispatcherEvictionIndex = removedOwnerCleanupSource.indexOf(
    'protectionDispatcher.evictTab(tabId, { reason });',
  );
  const removedOwnerFinallyIndex = removedOwnerCleanupSource.indexOf('} finally {');
  const removedOwnerContentEvictionIndex = removedOwnerCleanupSource.indexOf(
    'contentScriptOrchestrator.evictTab(tabId);',
  );
  if (
    removedOwnerCleanupStart < 0
    || removedOwnerCleanupEnd <= removedOwnerCleanupStart
    || removedOwnerDispatcherEvictionIndex < 0
    || removedOwnerFinallyIndex <= removedOwnerDispatcherEvictionIndex
    || removedOwnerContentEvictionIndex <= removedOwnerFinallyIndex
  ) {
    fail(`${trackingBrowserEventsPath} must final-evict both the exact dispatcher lane and content session for removed/replaced tabs.`);
  }
  const admittedRemovedStart = trackingBrowserEventsSource.indexOf(
    'async function handleTabRemoved(tabId) {',
  );
  const updatedReaction = trackingBrowserEventsSource.slice(
    trackingBrowserEventsSource.indexOf('async function handleTabUpdated('),
    trackingBrowserEventsSource.indexOf('async function recordWebNavigationSignal('),
  );
  assertIncludes(updatedReaction, 'await protectionDispatcher.revalidateNudgesForTab(tabId, { now });', trackingBrowserEventsPath);
  assertExcludes(updatedReaction, 'terminalizeNudgesForTab', trackingBrowserEventsPath,
    'loading/complete must reconcile native document identity instead of assuming nudge departure.');
  [
    'async function revalidateNudgesForTab(',
    'PROTECTION_NUDGE_NAVIGATION_INGRESS_REQUIRED',
    'current.committedIngressSequence !== initial.committedIngressSequence',
    'nudgeTeardownCoordinator.reconcileLiveDocument(tabId,',
  ].forEach(token => assertIncludes(protectionDispatcherSource, token, protectionDispatcherPath));
  const admittedRemovedEnd = trackingBrowserEventsSource.indexOf(
    'async function handleTabReplaced(addedTabId, removedTabId) {',
    admittedRemovedStart,
  );
  const admittedRemovedSource = trackingBrowserEventsSource.slice(
    admittedRemovedStart,
    admittedRemovedEnd,
  );
  const removedTerminalizeIndex = admittedRemovedSource.indexOf(
    'await protectionDispatcher.terminalizeNudgesForTab(tabId, {',
  );
  const removedTerminalizationFinallyIndex = admittedRemovedSource.indexOf('} finally {');
  const removedFinalOwnerEvictionIndex = admittedRemovedSource.indexOf(
    "evictRemovedTabRuntimeOwners(tabId, 'tab_removed');",
  );
  if (
    admittedRemovedStart < 0
    || admittedRemovedEnd <= admittedRemovedStart
    || removedTerminalizeIndex < 0
    || removedTerminalizationFinallyIndex <= removedTerminalizeIndex
    || removedFinalOwnerEvictionIndex <= removedTerminalizationFinallyIndex
  ) {
    fail(`${trackingBrowserEventsPath} must terminalize an admitted removed tab before final dispatcher/content eviction.`);
  }
  const admittedReplacedStart = admittedRemovedEnd;
  const admittedReplacedEnd = trackingBrowserEventsSource.indexOf(
    'const createAdmittedBrowserEventHandler',
    admittedReplacedStart,
  );
  const admittedReplacedSource = trackingBrowserEventsSource.slice(
    admittedReplacedStart,
    admittedReplacedEnd,
  );
  const replacedTerminalizeIndex = admittedReplacedSource.indexOf(
    'await protectionDispatcher.terminalizeNudgesForTab(removedTabId, {',
  );
  const replacedTerminalizationFinallyIndex = admittedReplacedSource.indexOf('} finally {');
  const replacedFinalOwnerEvictionIndex = admittedReplacedSource.indexOf(
    "evictRemovedTabRuntimeOwners(removedTabId, 'tab_replaced');",
  );
  if (
    admittedReplacedStart < 0
    || admittedReplacedEnd <= admittedReplacedStart
    || replacedTerminalizeIndex < 0
    || replacedTerminalizationFinallyIndex <= replacedTerminalizeIndex
    || replacedFinalOwnerEvictionIndex <= replacedTerminalizationFinallyIndex
  ) {
    fail(`${trackingBrowserEventsPath} must terminalize an admitted replaced tab before final dispatcher/content eviction.`);
  }
  const admittedTabUpdatedBindingStart = trackingBrowserEventsSource.indexOf(
    'const admittedTabUpdatedHandler = createAdmittedBrowserEventHandler(',
  );
  const admittedTabUpdatedBindingEnd = trackingBrowserEventsSource.indexOf(
    'const admittedWebNavigationCommittedHandler',
    admittedTabUpdatedBindingStart,
  );
  const admittedTabUpdatedBindingSource = trackingBrowserEventsSource.slice(
    admittedTabUpdatedBindingStart,
    admittedTabUpdatedBindingEnd,
  );
  if (
    admittedTabUpdatedBindingStart < 0
    || admittedTabUpdatedBindingEnd <= admittedTabUpdatedBindingStart
    || admittedTabUpdatedBindingSource.includes('consumeSupersededProtection')
  ) {
    fail(`${trackingBrowserEventsPath} must keep the outer tabs.onUpdated admission wrapper free of lifecycle error-shape consumption.`);
  }
  const admittedRemovedBindingStart = trackingBrowserEventsSource.indexOf(
    'const admittedTabRemovedHandler = createAdmittedBrowserEventHandler(',
  );
  const admittedRemovedBindingEnd = trackingBrowserEventsSource.indexOf(
    'const admittedTabReplacedHandler = createAdmittedBrowserEventHandler(',
    admittedRemovedBindingStart,
  );
  const admittedRemovedBindingSource = trackingBrowserEventsSource.slice(
    admittedRemovedBindingStart,
    admittedRemovedBindingEnd,
  );
  const admittedReplacedBindingEnd = trackingBrowserEventsSource.indexOf(
    '\n\n    return {',
    admittedRemovedBindingEnd,
  );
  const admittedReplacedBindingSource = trackingBrowserEventsSource.slice(
    admittedRemovedBindingEnd,
    admittedReplacedBindingEnd,
  );
  if (
    admittedRemovedBindingStart < 0
    || admittedRemovedBindingEnd <= admittedRemovedBindingStart
    || admittedReplacedBindingEnd <= admittedRemovedBindingEnd
    || !admittedRemovedBindingSource.includes('onAdmissionRejected: (tabId) => {')
    || !admittedRemovedBindingSource.includes("evictRemovedTabRuntimeOwners(tabId, 'tab_removed');")
    || !admittedReplacedBindingSource.includes('onAdmissionRejected: (_addedTabId, removedTabId) => {')
    || !admittedReplacedBindingSource.includes("evictRemovedTabRuntimeOwners(removedTabId, 'tab_replaced');")
  ) {
    fail(`${trackingBrowserEventsPath} must final-evict exact dispatcher and content-session removal owners when profile admission rejects removed/replaced browser events.`);
  }
  [
    'const contentProtectionSync = createTrackingContentProtectionSync({',
    'captureProfileMutationRuntimeAdmission: profileMutationRuntimeGate.capture.bind(',
    'runCapturedProfileMutationRuntimeTask: profileMutationRuntimeGate.runCaptured.bind(',
    'contentProtectionSync,',
  ].forEach((token) => assertIncludes(backgroundKernelSource, token, backgroundKernelPath));
  const protectionBindingsIndex = backgroundKernelSource.indexOf(
    '} = createBackgroundKernelProtectionBindings({',
  );
  const protectionSyncIndex = backgroundKernelSource.indexOf(
    'const contentProtectionSync = createTrackingContentProtectionSync({',
  );
  if (protectionBindingsIndex < 0 || protectionSyncIndex <= protectionBindingsIndex) {
    fail(`${backgroundKernelPath} must create the catch-up singleton after the protection update owner exists.`);
  }
  [
    'expectedDocumentId: expectedDispatchDocumentId',
    'abortSignal: dispatchAbortSignal',
    "dispatchResult?.documentDisposition !== 'redirected'",
    "schedulePrepaintVisualContentScriptSync('prepaint_visual_after_dispatch')",
    'let prepaintSyncRequested = false;',
    'if (prepaintSyncTask) return true;',
    'for (let pass = 0; pass < 2 && prepaintSyncRequested; pass += 1)',
    "label: 'protection_runtime:prepaint_registration_sync'",
  ].forEach((token) => assertIncludes(
    protectionRuntimeCoordinatorSource,
    token,
    protectionRuntimeCoordinatorPath,
  ));
  [
    'const gateMutationFence = Object.freeze({',
    'const dispatchSerialQueue = createProtectionDispatchSerialQueue();',
    'const tabLifecycleLedger = createProtectionTabLifecycleLedger();',
    'function inspectDispatchAdmissionContext({',
    'function captureDispatchAdmissionContext({',
    'function assertExpectedDispatchDocument(',
    'lifecycleContext = {},',
    '...lifecycleContext,',
    'throw createOwnedDispatchLifecycleError(',
    "'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE'",
    "reason: 'same_document_history_overtaken'",
    'historyProof.previousUrl === requestedUrl',
    'historyProof.currentUrl === sessionUrl',
    'historyProof.documentId === documentId',
    'function markTabUrlChanged(tabId, {',
    "reason: 'web_navigation_history_state_updated'",
    'const history = tabLifecycleLedger.noteHistory({',
    'sessionReady: isDispatchReadyContentSession(session)',
    'invalidationTag: history.generation',
    'invalidationTag: committed.generation',
    "gatePresentationDisposition: 'not_started'",
    "contentDeliveryDisposition: 'not_started'",
    "ackDisposition: 'not_observed'",
    'async function prepareContentMutationTransaction(',
    'async function runProtectionUpdateTransaction(',
    "assertDispatchTransactionCurrent(tabId, transaction, 'before_stale_retry')",
    'forceSnapshot: true',
    'async function stopAndTerminalizeNudgeTransaction(',
    'dispatchSerialQueue.closeTab(tabId, { reason });',
    "disposition: 'protection_committed_navigation_superseded'",
    "error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'",
    "gatePresentation?.documentDisposition === 'redirected'",
    "'after_bootstrap_refresh'",
    'dispatchStateLedger.commitDispatchSuccess(tabId, {',
  ].forEach((token) => assertIncludes(protectionDispatcherSource, token, protectionDispatcherPath));
  [
    'session.documentId !== session.documentId.trim()',
  ].forEach((token) => assertIncludes(
    protectionDispatchLifecyclePrimitivesSource,
    token,
    protectionDispatchLifecyclePrimitivesPath,
  ));
  [
    'function createProvenPendingTabUpdateCommittedQueueInvalidation(error, receipt) {',
    "error?.reason !== 'web_navigation_committed'",
    'error.invalidationTag === committedProof.invalidationTag',
    'receipt.ingressSequence < committedProof.ingressSequence',
    "'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED'",
    "const PRE_ACK_HISTORY_CANCELLATION_PHASE =\n  'gate_mutation:gate_bridge_after_theme_resolution';",
    "transaction?.ensureSource !== 'session_dispatch_ready'",
    "createOwnedDispatchLifecycleError('PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED'",
  ].forEach((token) => assertIncludes(
    protectionDispatchSettlementProofsSource,
    token,
    protectionDispatchSettlementProofsPath,
  ));
  const protectionTransactionStart = protectionDispatcherSource.indexOf(
    'async function runProtectionUpdateTransaction(',
  );
  const protectionTransactionPermission = protectionDispatcherSource.indexOf(
    'const dispatchPermission = await dispatchPermissionGate.getState(',
    protectionTransactionStart,
  );
  const protectionTransactionReadiness = protectionDispatcherSource.indexOf(
    'const transaction = await prepareContentMutationTransaction(',
    protectionTransactionStart,
  );
  if (
    protectionTransactionStart < 0
    || protectionTransactionPermission <= protectionTransactionStart
    || protectionTransactionReadiness <= protectionTransactionPermission
  ) {
    fail(`${protectionDispatcherPath} must resolve explicit host/scripting permission before content readiness or injection.`);
  }
  const protectionAttemptStart = protectionDispatcherSource.indexOf(
    'async function sendProtectionUpdateAttempt(',
  );
  const protectionAttemptEnd = protectionDispatcherSource.indexOf(
    'async function runPermissionlessProtectionUpdateTransaction(',
    protectionAttemptStart,
  );
  const protectionAttemptSource = protectionDispatcherSource.slice(
    protectionAttemptStart,
    protectionAttemptEnd,
  );
  assertIncludes(protectionAttemptSource, 'dispatchPermissionGate.assertCurrent(dispatchPermission, phase)', protectionDispatcherPath);
  if (
    protectionAttemptStart < 0
    || protectionAttemptEnd <= protectionAttemptStart
    || protectionAttemptSource.includes('dispatchPermissionGate.getState(')
    || !protectionAttemptSource.includes('PROTECTION_DISPATCH_PERMISSION_ADMISSION_REQUIRED')
  ) {
    fail(`${protectionDispatcherPath} must consume the pre-read permission admission and must not defer permission lookup until after content readiness.`);
  }
  const nudgeTriggerStart = protectionDispatcherSource.indexOf(
    'async function maybeTriggerProtectionNudge(tabId, url, options = {})',
  );
  const nudgeTriggerPermission = protectionDispatcherSource.indexOf(
    'const dispatchPermission = await dispatchPermissionGate.getState(url, permissionNow);',
    nudgeTriggerStart,
  );
  const nudgeTriggerAdmission = protectionDispatcherSource.indexOf(
    'const admission = captureDispatchAdmissionContext({',
    nudgeTriggerStart,
  );
  if (
    nudgeTriggerStart < 0
    || nudgeTriggerPermission <= nudgeTriggerStart
    || nudgeTriggerAdmission <= nudgeTriggerPermission
  ) {
    fail(`${protectionDispatcherPath} must resolve ordinary nudge permission before content admission/readiness.`);
  }
  const nudgeStopStart = protectionDispatcherSource.indexOf(
    'async function stopNudgeForTab(tabId, {',
  );
  const nudgeStopPermission = protectionDispatcherSource.indexOf(
    'const dispatchPermission = await dispatchPermissionGate.getState(tab.url, now);',
    nudgeStopStart,
  );
  const nudgeStopAdmission = protectionDispatcherSource.indexOf(
    'let admission = null;',
    nudgeStopStart,
  );
  if (
    nudgeStopStart < 0
    || nudgeStopPermission <= nudgeStopStart
    || nudgeStopAdmission <= nudgeStopPermission
  ) {
    fail(`${protectionDispatcherPath} must resolve nudge-stop permission before content admission/readiness.`);
  }
  assertExcludes(
    protectionDispatcherSource,
    "new Error('PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE:after_send')",
    protectionDispatcherPath,
    `${protectionDispatcherPath} must not create an expected-document stale error without exact tab/document evidence.`,
  );
  const gateLegStart = protectionDispatcherSource.indexOf('async function runGateDispatchLeg({');
  const gateLegEnd = protectionDispatcherSource.indexOf('async function sendProtectionUpdateAttempt(', gateLegStart);
  const gateLeg = protectionDispatcherSource.slice(gateLegStart, gateLegEnd);
  ['assertAttemptCurrent(resolvedPhase)', 'acceptGateRedirectCommittedOvertake(error, resolvedPhase, {',
    'throw createProvenPreAckHistoryCancellation(error, { tabId, transaction });',
    "gatePresentation.documentDisposition === 'redirected'", 'await gateDispatchBridge.refreshBootstrap({',
    "documentDisposition: 'redirected'", "assertAttemptCurrent('after_gate', { abortPhase: 'gate_resolved' });",
  ].forEach(token => assertIncludes(gateLeg, token, protectionDispatcherPath));
  ['settlePreparedPresentation', 'requireGateSurfaceAcknowledgement', 'GATE_INTERVENTION_START', 'GATE_INTERVENTION_STOP']
    .forEach(token => assertExcludes(protectionDispatcherSource, token, protectionDispatcherPath,
      'Top-level Gate must not restore retired content-surface delivery or settlement.'));
  if (protectionDispatcherSource.split('prevalidatedAdmission: Object.freeze({').length - 1 !== 1) {
    fail(`${protectionDispatcherPath} must reuse the prepared transaction exactly once for ordinary content delivery.`);
  }
  [
    'export function createProtectionDispatchSerialQueue()',
    'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED',
    'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED',
    "fence.assertCurrent('dequeued')",
    'state.tail = tracked.then(() => undefined, () => undefined);',
    'function closeTab(',
    'function evictTab(',
    'invalidationTag: state.invalidationTag',
    'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATION_TAG_INVALID',
  ].forEach((token) => assertIncludes(
    protectionDispatchSerialQueueSource,
    token,
    protectionDispatchSerialQueuePath,
  ));
  const serialInvalidationStart = protectionDispatchSerialQueueSource.indexOf(
    'function invalidateTab(tabId, { reason, invalidationTag = null } = {}) {',
  );
  const serialInvalidationEnd = protectionDispatchSerialQueueSource.indexOf(
    'function closeTab(',
    serialInvalidationStart,
  );
  const serialInvalidationSource = protectionDispatchSerialQueueSource.slice(
    serialInvalidationStart,
    serialInvalidationEnd,
  );
  const serialTagValidationIndex = serialInvalidationSource.indexOf(
    'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATION_TAG_INVALID',
  );
  const serialStateLookupIndex = serialInvalidationSource.indexOf(
    'const state = stateByTab.get(resolvedTabId);',
  );
  if (
    serialInvalidationStart < 0
    || serialInvalidationEnd <= serialInvalidationStart
    || serialTagValidationIndex < 0
    || serialStateLookupIndex < 0
    || serialTagValidationIndex >= serialStateLookupIndex
  ) {
    fail(`${protectionDispatchSerialQueuePath} must validate History invalidation tags before the no-lane early return.`);
  }
  [
    'PROTECTION_GATE_DISPATCH_INLINE_PRESENTATION_RETIRED',
    "gatePresentation.documentDisposition === 'redirected' && !gatePresentation.handled",
  ].forEach((token) => assertIncludes(
    protectionGateDispatchBridgeSource,
    token,
    protectionGateDispatchBridgePath,
  ));
  const bridgeAfterThemeFenceIndex = protectionGateDispatchBridgeSource.indexOf(
    "'gate_bridge_after_theme_resolution'",
  );
  const bridgeControllerPresentationIndex = protectionGateDispatchBridgeSource.indexOf(
    'const gatePresentation = requireGatePresentation(await presentGateInterstitial({',
  );
  if (
    bridgeAfterThemeFenceIndex < 0
    || bridgeControllerPresentationIndex <= bridgeAfterThemeFenceIndex
  ) {
    fail(`${protectionGateDispatchBridgePath} must fence after theme resolution before the Gate controller can prepare a presentation.`);
  }
  const preAckHistoryProofStart = protectionDispatchSettlementProofsSource.indexOf(
    'function createProvenPreAckHistoryCancellation(error, {',
  );
  const preAckHistoryProofEnd = protectionDispatchSettlementProofsSource.indexOf(
    'function createProvenPendingTabUpdateHistoryQueueInvalidation(error, receipt) {',
    preAckHistoryProofStart,
  );
  const preAckHistoryProofSource = protectionDispatchSettlementProofsSource.slice(
    preAckHistoryProofStart,
    preAckHistoryProofEnd,
  );
  [
    "error?.phase !== PRE_ACK_HISTORY_CANCELLATION_PHASE",
    "transaction?.ensureSource !== 'session_dispatch_ready'",
    'error.invalidationTag !== historyProof.invalidationTag',
    'historyProof.invalidationTag !== historyProof.generation',
    'historyProof.documentId !== exactDocumentId',
    'currentDocumentId !== exactDocumentId',
    'historyProof.previousUrl !== exactRequestedUrl',
    'historyProof.currentUrl !== currentUrl',
  ].forEach((token) => {
    if (!preAckHistoryProofSource.includes(token)) {
      fail(`${protectionDispatchSettlementProofsPath} must keep exact pre-ACK History proof: ${token}`);
    }
  });
  const gateMutationFenceStart = protectionDispatcherSource.indexOf(
    'const gateMutationFence = Object.freeze({',
  );
  const gateBridgePresentIndex = protectionDispatcherSource.indexOf(
    '} = await gateDispatchBridge.present({',
    gateMutationFenceStart,
  );
  const gateMutationFenceSource = protectionDispatcherSource.slice(
    gateMutationFenceStart,
    gateBridgePresentIndex,
  );
  if (
    gateMutationFenceStart < 0
    || gateBridgePresentIndex <= gateMutationFenceStart
    || !gateMutationFenceSource.includes(
      'assertAttemptCurrent(resolvedPhase);',
    )
    || !gateMutationFenceSource.includes('createProvenPreAckHistoryCancellation(error, {')
  ) {
    fail(`${protectionDispatcherPath} must invoke exact pre-ACK History proof inside the Gate mutation fence before presentation starts.`);
  }
  const finalDocumentFenceIndex = protectionDispatcherSource.indexOf(
    "'after_bootstrap_refresh'",
  );
  const dispatchCommitIndex = protectionDispatcherSource.indexOf(
    'dispatchStateLedger.commitDispatchSuccess(tabId, {',
  );
  if (finalDocumentFenceIndex < 0 || dispatchCommitIndex <= finalDocumentFenceIndex) {
    fail(`${protectionDispatcherPath} must prove the exact document after bootstrap refresh before committing dispatch success.`);
  }
  [
    'export function createProtectionTabUpdatedIngressReceipt({',
    'export function claimProtectionTabUpdatedIngressReceipt(receipt, {',
    'export function createProtectionTabUpdatedDispatchOutcome(input = {})',
    'export function consumeProtectionTabUpdatedDispatchOutcome(value, {',
    'const issuedTabUpdatedIngressReceipts = new WeakSet();',
    'const claimedTabUpdatedIngressReceipts = new WeakSet();',
    'const issuedTabUpdatedOutcomes = new WeakMap();',
    'PROTECTION_TAB_UPDATED_SUPERSEDED_ERROR_CODES',
    'PROTECTION_TAB_UPDATED_OUTCOME_RECEIPT_MISMATCH',
    'PROTECTION_TAB_UPDATED_OUTCOME_REUSED',
    'observedSessionGeneration = null',
    'requireOptionalSessionGeneration(',
    "status !== 'applied' && status !== 'superseded'",
    "normalizedDisposition !== 'protection_applied'",
    "protection_delayed_tab_update_reconciled: Object.freeze([",
    "protection_same_document_url_superseded: Object.freeze([",
    "protection_committed_navigation_superseded: Object.freeze([",
    "'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED'",
    "'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH'",
    "'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_STALE'",
    "normalizedDisposition === 'protection_delayed_tab_update_reconciled'",
    "phase !== 'admission_capture'",
  ].forEach((token) => assertIncludes(
    protectionTabUpdatedDispatchProtocolSource,
    token,
    protectionTabUpdatedDispatchProtocolPath,
  ));
  [
    'requireExpectedContentDocumentId',
    'requireProtectionDispatchAbortSignal',
    'function requirePrevalidatedDispatchAdmission(value, {',
    'prevalidatedAdmission = null,',
    "source: 'transaction_dispatch_ready'",
    "reason: `${reason}:receiver_missing`",
    'forceInject: true',
    'export async function ensureProtectionDispatchTransactionReady(',
    "throwIfProtectionDispatchAborted(dispatchAbortSignal, 'transaction_before_ready')",
    "throwIfProtectionDispatchAborted(dispatchAbortSignal, 'transaction_after_ready')",
    'expected_document_mismatch',
    "createDispatchDocumentIdentityError('expected', 'document_id_invalid')",
    "createDispatchDocumentIdentityError(phase, 'document_id_invalid')",
    'value !== value.trim()',
    'export function isProvenProtectionDispatchDocumentOvertaken(error, {',
    "'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE'",
    "'PROTECTION_DISPATCH_ADMISSION_DOCUMENT_MISMATCH'",
    "'PROTECTION_DISPATCH_TRANSACTION_DOCUMENT_MISMATCH'",
    'rawExpected !== rawExpected.trim()',
    'rawCurrent !== rawCurrent.trim()',
    'rawExpected === rawCurrent',
    'if (!Number.isSafeInteger(error?.tabId) || error.tabId < 0) return false;',
    'if (expectedDocumentId !== null && expected !== expectedDocumentId) return false;',
    'if (tabId !== null && error?.tabId !== tabId) return false;',
    'export function isProvenProtectionDispatchHistoryContextOvertaken(error, {',
    'export function isProvenProtectionDispatchHistoryOvertookPendingTabUpdate(error, {',
    'export function isProvenProtectionDispatchPreAckHistoryCancellation(error, {',
    "error?.reason !== 'same_document_history_overtaken'",
    'ingressSequence <= error.historyIngressSequence',
    'ingressSequence >= error.historyIngressSequence',
    "status !== 'complete'",
    'eventRequestedUrl !== errorRequestedUrl',
    'errorRequestedUrl !== historyPreviousUrl',
    'sessionUrl !== historyCurrentUrl',
    'currentDocumentId === historyDocumentId',
    "error?.phase !== 'gate_mutation:gate_bridge_after_theme_resolution'",
    "error?.ensureSource !== 'session_dispatch_ready'",
    'error.cause.invalidationTag !== error.historyInvalidationTag',
    'documentId: dispatchDocumentId',
    'function enforcePostSendAbort',
  ].forEach((token) => assertIncludes(
    protectionDispatchTransportSource,
    token,
    protectionDispatchTransportPath,
  ));
  [
    'claimProtectionTabUpdatedIngressReceipt(options.tabUpdatedIngressReceipt',
    "'protection_tab_updated_dispatch_settled'",
    "'protection_tab_updated_dispatch_rejected'",
    'isOwnedDispatchLifecycleError(error)',
    'const committedProof = tabLifecycleLedger.getCommittedProof(receipt.tabId);',
    'createProtectionTabUpdatedDispatchOutcome({',
    'requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId)',
    "'after_content_send'",
    'const loadingReceiptWithoutReadyIdentity =',
    'error.currentSessionGeneration > error.transactionSessionGeneration',
    'replacementBefore.invalidDocumentIds?.includes?.(expectedDocumentId)',
    "diagnosticReason: 'exact_active_bootstrap_document_overtake'",
    "disposition: 'protection_same_document_url_superseded'",
    "diagnosticReason: 'exact_same_document_url_overtake'",
    'const loadingReceiptAdmissionExact =',
    'admissionDocumentId: expectedDocumentId',
    'const receiptUrlReachedByAdmission = loadingReceiptAdmissionExact',
    'error.admissionSessionGeneration > receiptGeneration',
    'async function inspectLoadingBootstrapDocumentReplacement(error, receipt) {',
    "diagnosticReason: 'exact_loading_bootstrap_document_overtake'",
    "diagnosticReason: 'exact_committed_navigation_overtake'",
    "disposition: 'protection_committed_navigation_superseded'",
  ].forEach((token) => assertIncludes(
    protectionDispatcherSource,
    token,
    protectionDispatcherPath,
  ));
  [
    'liveHistoryProof: tabLifecycleLedger.getHistoryProof(receipt.tabId),',
    'facts.liveHistoryProof.generation === error?.historyGeneration',
    'facts.liveHistoryProof.invalidationTag === error?.historyInvalidationTag',
    'facts.liveHistoryProof.invalidationTag === facts.liveHistoryProof.generation',
    'facts.liveHistoryProof.ingressSequence === error?.historyIngressSequence',
    'facts.liveHistoryProof.documentId === error?.historyDocumentId',
    'facts.liveHistoryProof.previousUrl === error?.historyPreviousUrl',
    'facts.liveHistoryProof.currentUrl === error?.historyCurrentUrl',
  ].forEach((token) => assertIncludes(
    protectionDispatcherSource,
    token,
    protectionDispatcherPath,
  ));
  [
    'async function inspectLiveAdmissionTabUpdateReconciliation(error, receipt) {',
    "error?.reason !== 'ready_session_url_mismatch'",
    "error?.phase !== 'admission_capture'",
    "error?.contentMutationDisposition !== 'not_started'",
    'const receiptHasNoReadyIdentity = receipt.observedSessionGeneration === null',
    "? 'receipt_ready_session'",
    ": (receiptHasNoReadyIdentity ? 'admission_ready_session' : null)",
    'error.sessionGeneration === receipt.observedSessionGeneration',
    'const correlation = ingressIdentitySource',
    'sessionGeneration: error.sessionGeneration',
    '|| !correlation',
    'const snapshotBefore = requireAtomicContentSessionSnapshot(',
    'liveTab = await browserPort.tabsGet(receipt.tabId);',
    'const snapshotAfter = requireAtomicContentSessionSnapshot(',
    'snapshotAfter.generation === snapshotBefore.generation',
    'liveTab?.id === receipt.tabId',
    'exactLiveTabUrl === exactErrorSessionUrl',
    'exactLiveTabUrl === exactRequestedUrl',
    "const pendingUrlValue = liveTab?.pendingUrl;",
    'exactPendingUrl === exactErrorSessionUrl',
    'exactPendingUrl === exactRequestedUrl',
    'const exactMonotonicReadyConvergence = snapshotAfter.generation',
    '> snapshotBefore.generation',
    "diagnosticReason: 'exact_ready_document_url_converged_during_live_lookup'",
    "disposition: 'protection_delayed_tab_update_reconciled'",
    "diagnosticReason: 'exact_live_tab_session_reconciliation'",
    'await contentScriptRuntime.refreshReadyDocumentUrlFromExactProbe({',
    'expectedGeneration: snapshotBefore.generation',
    'expectedDocumentId: correlation.documentId',
    'expectedUrl: exactErrorSessionUrl',
    'nextUrl: exactRequestedUrl',
    'recapturedAdmission = captureDispatchAdmissionContext({',
    'hasExactEnumerableKeys(refreshResult, [',
    'READY_DOCUMENT_URL_REFRESH_PROOF_FIELDS',
    "diagnosticReason: 'exact_ready_document_url_refreshed'",
    "diagnosticReason: 'exact_ready_document_url_refresh_converged'",
  ].forEach((token) => assertIncludes(
    protectionLiveAdmissionReconciliationSource,
    token,
    protectionLiveAdmissionReconciliationPath,
  ));
  [
    'const ERROR_DOCUMENT_ID_FIELDS = Object.freeze([',
    "'admissionDocumentId',",
    'documentIds[key] = resolveExactDispatchDocumentId(error?.[key]);',
    "typeof error?.code === 'string' ? error.code : 'UNCLASSIFIED_ERROR'",
    "eventIngressSequence < receiptIngressSequence ? 'before_receipt' : 'after_receipt'",
  ].forEach((token) => assertIncludes(
    protectionDispatchSettlementDiagnosticsSource,
    token,
    protectionDispatchSettlementDiagnosticsPath,
  ));
  const committedCancellationStart = protectionDispatchSettlementProofsSource.indexOf(
    'function createProvenPendingTabUpdateCommittedQueueInvalidation(error, receipt) {',
  );
  const committedCancellationEnd = protectionDispatchSettlementProofsSource.indexOf(
    'function createProvenSupersededNavigationQueueInvalidation(error, receipt) {',
    committedCancellationStart,
  );
  const committedCancellationSource = protectionDispatchSettlementProofsSource.slice(
    committedCancellationStart,
    committedCancellationEnd,
  );
  [
    'isProtectionDispatchSerialQueueError(error)',
    "error?.reason !== 'web_navigation_committed'",
    'error?.tabId !== receipt?.tabId',
    'receipt.ingressSequence < committedProof.ingressSequence',
    'error.invalidationTag === committedProof.invalidationTag',
    'committedProof.invalidationTag === committedProof.generation',
    "'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED'",
  ].forEach((token) => {
    if (!committedCancellationSource.includes(token)) {
      fail(`${protectionDispatchSettlementProofsPath} must require exact committed-navigation queue proof: ${token}`);
    }
  });
  const liveAdmissionInspectionStart = protectionLiveAdmissionReconciliationSource.indexOf(
    'function correlateLiveAdmissionReceipt(error, receipt) {',
  );
  const liveAdmissionInspectionEnd = protectionLiveAdmissionReconciliationSource.indexOf(
    'export default createProtectionLiveAdmissionReconciliation;',
    liveAdmissionInspectionStart,
  );
  const liveAdmissionInspectionSource = protectionLiveAdmissionReconciliationSource.slice(
    liveAdmissionInspectionStart,
    liveAdmissionInspectionEnd,
  );
  const liveAdmissionCheapCorrelationIndex = liveAdmissionInspectionSource.indexOf(
    'const correlation = ingressIdentitySource',
  );
  const liveAdmissionBeforeSnapshotIndex = liveAdmissionInspectionSource.indexOf(
    'const snapshotBefore = requireAtomicContentSessionSnapshot(',
  );
  const liveAdmissionTabsGetIndex = liveAdmissionInspectionSource.indexOf(
    'liveTab = await browserPort.tabsGet(receipt.tabId);',
  );
  const liveAdmissionAfterSnapshotIndex = liveAdmissionInspectionSource.indexOf(
    'const snapshotAfter = requireAtomicContentSessionSnapshot(',
  );
  const liveAdmissionPendingUrlIndex = liveAdmissionInspectionSource.indexOf(
    'const pendingUrlValue = liveTab?.pendingUrl;',
  );
  const liveAdmissionSettlementIndex = liveAdmissionInspectionSource.indexOf(
    "disposition: 'protection_delayed_tab_update_reconciled'",
  );
  const liveAdmissionRefreshIndex = liveAdmissionInspectionSource.indexOf(
    'await contentScriptRuntime.refreshReadyDocumentUrlFromExactProbe({',
  );
  const liveAdmissionRecaptureIndex = liveAdmissionInspectionSource.indexOf(
    'recapturedAdmission = captureDispatchAdmissionContext({',
  );
  if (
    liveAdmissionInspectionStart < 0
    || liveAdmissionInspectionEnd <= liveAdmissionInspectionStart
    || liveAdmissionCheapCorrelationIndex < 0
    || liveAdmissionBeforeSnapshotIndex <= liveAdmissionCheapCorrelationIndex
    || liveAdmissionTabsGetIndex <= liveAdmissionBeforeSnapshotIndex
    || liveAdmissionAfterSnapshotIndex <= liveAdmissionTabsGetIndex
    || liveAdmissionPendingUrlIndex <= liveAdmissionAfterSnapshotIndex
    || liveAdmissionSettlementIndex <= liveAdmissionPendingUrlIndex
    || liveAdmissionRefreshIndex <= liveAdmissionSettlementIndex
    || liveAdmissionRecaptureIndex <= liveAdmissionRefreshIndex
    || liveAdmissionInspectionSource.split('browserPort.tabsGet(').length - 1 !== 1
    || liveAdmissionInspectionSource.split(
      'contentScriptRuntime.refreshReadyDocumentUrlFromExactProbe(',
    ).length - 1 !== 1
  ) {
    fail(`${protectionLiveAdmissionReconciliationPath} must keep one exact live-tab lookup behind cheap receipt/error checks, preserve the L=session settlement, and place the exact-document URL refresh plus admission recapture behind immutable before/after session-generation fences.`);
  }
  const protectionSendStart = protectionDispatcherSource.indexOf(
    'async function sendProtectionUpdate(tabId, url, options = {}) {',
  );
  const protectionSendEnd = protectionDispatcherSource.indexOf(
    'async function maybeTriggerProtectionNudge(',
    protectionSendStart,
  );
  const protectionSendSource = protectionDispatcherSource.slice(
    protectionSendStart,
    protectionSendEnd,
  );
  const admissionCaptureIndex = protectionSendSource.indexOf(
    'admissionInspection = inspectDispatchAdmissionContext({',
  );
  const liveAdmissionCallIndex = protectionSendSource.indexOf(
    'await inspectLiveAdmissionTabUpdateReconciliation(',
  );
  const transactionEnqueueIndex = protectionSendSource.indexOf(
    'const dispatchResult = await dispatchSerialQueue.enqueue(',
  );
  if (
    protectionSendStart < 0
    || protectionSendEnd <= protectionSendStart
    || admissionCaptureIndex < 0
    || liveAdmissionCallIndex <= admissionCaptureIndex
    || transactionEnqueueIndex <= liveAdmissionCallIndex
    || !protectionSendSource.includes('if (inspection?.admission) {')
    || !protectionSendSource.includes("'protection_tab_updated_admission_url_reconciled'")
    || !protectionSendSource.includes("disposition: 'continued_to_protection_transaction'")
    || protectionSendSource.split(
      'inspectLiveAdmissionTabUpdateReconciliation(',
    ).length - 1 !== 1
  ) {
    fail(`${protectionDispatcherPath} must resolve live tab-update URL divergence explicitly before transaction enqueue.`);
  }
  const settlementCreatorSources = await findSourceCallers(
    'createProtectionTabUpdatedDispatchOutcome',
  );
  const allowedSettlementCreatorSources = new Set([
    protectionDispatcherPath,
    protectionTabUpdatedDispatchProtocolPath,
  ]);
  const unexpectedSettlementCreatorSource = settlementCreatorSources.find(
    (filePath) => !allowedSettlementCreatorSources.has(filePath),
  );
  if (unexpectedSettlementCreatorSource) {
    fail(`Only ProtectionDispatcher may create a tabs.onUpdated typed dispatch settlement; found ${unexpectedSettlementCreatorSource}.`);
  }
  const receiptClaimerSources = await findSourceCallers(
    'claimProtectionTabUpdatedIngressReceipt',
  );
  const allowedReceiptClaimerSources = new Set([
    protectionDispatcherPath,
    protectionTabUpdatedDispatchProtocolPath,
  ]);
  const unexpectedReceiptClaimerSource = receiptClaimerSources.find(
    (filePath) => !allowedReceiptClaimerSources.has(filePath),
  );
  if (unexpectedReceiptClaimerSource) {
    fail(`Only ProtectionDispatcher may claim a tabs.onUpdated ingress receipt; found ${unexpectedReceiptClaimerSource}.`);
  }
  const settlementConsumerSources = await findSourceCallers(
    'consumeProtectionTabUpdatedDispatchOutcome',
  );
  const allowedSettlementConsumerSources = new Set([
    trackingBrowserEventsPath,
    protectionTabUpdatedDispatchProtocolPath,
  ]);
  const unexpectedSettlementConsumerSource = settlementConsumerSources.find(
    (filePath) => !allowedSettlementConsumerSources.has(filePath),
  );
  if (unexpectedSettlementConsumerSource) {
    fail(`Only tracking tabs.onUpdated may consume a typed dispatch settlement; found ${unexpectedSettlementConsumerSource}.`);
  }
  assertExcludes(
    protectionDispatchTransportSource,
    'isProvenProtectionDispatchContextOvertaken',
    protectionDispatchTransportPath,
    `${protectionDispatchTransportPath} must not classify URL lag as lifecycle supersession.`,
  );
  const historyContextProofStart = protectionDispatchTransportSource.indexOf(
    'export function isProvenProtectionDispatchHistoryContextOvertaken(error, {',
  );
  const historyContextProofEnd = protectionDispatchTransportSource.indexOf(
    'export function requireExpectedContentDocumentId',
    historyContextProofStart,
  );
  const historyContextProofSource = protectionDispatchTransportSource.slice(
    historyContextProofStart,
    historyContextProofEnd,
  );
  [
    "error?.code !== 'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH'",
    "error?.reason !== 'same_document_history_overtaken'",
    'error.historyGeneration <= 0',
    'ingressSequence <= error.historyIngressSequence',
    "status !== 'complete'",
    'eventRequestedUrl !== errorRequestedUrl',
    'errorRequestedUrl !== historyPreviousUrl',
    'sessionUrl !== historyCurrentUrl',
    'historyPreviousUrl === historyCurrentUrl',
    'currentDocumentId === historyDocumentId',
  ].forEach((token) => {
    if (!historyContextProofSource.includes(token)) {
      fail(`${protectionDispatchTransportPath} must require exact monotonic History-context proof: ${token}`);
    }
  });
  const initialSendIndex = protectionDispatchTransportSource.indexOf(
    'const response = await sendTabMessage(',
  );
  const initialResponseNormalizationIndex = protectionDispatchTransportSource.indexOf(
    'const delivery = normalizeTabsSendMessageResult(response);',
    initialSendIndex,
  );
  const initialPostSendAbortIndex = protectionDispatchTransportSource.indexOf(
    'enforcePostSendAbort(',
    initialResponseNormalizationIndex,
  );
  if (
    initialSendIndex < 0
    || initialResponseNormalizationIndex <= initialSendIndex
    || initialPostSendAbortIndex <= initialResponseNormalizationIndex
  ) {
    fail(`${protectionDispatchTransportPath} must normalize the returned response before enforcing post-send abort.`);
  }
  assertExcludes(
    protectionControllerSource,
    'GateInterstitialSurface',
    protectionControllerPath,
    `${protectionControllerPath} must not restore the retired Detour content overlay.`,
  );
  [
    'documentId: typeof event?.documentId ===',
    'attemptId: Number.isSafeInteger(event?.attemptId)',
    'syncAttempt: Number.isSafeInteger(event?.syncAttempt)',
    'errorCode: typeof event?.errorCode ===',
    "'protection_tab_updated_admission_url_reconciled'",
    'liveTabUrlMatchesRequested: booleanOrNull(',
    'livePendingUrlMatchesRequested: booleanOrNull(',
    'probeDocumentMatches: booleanOrNull(',
    'sessionRefreshCommitted: booleanOrNull(',
    'recapturedAdmissionMatchesRequested: booleanOrNull(',
    'committedDocumentId: safeSiteE2EDiagnosticToken(',
    'committedGeneration: positiveSafeIntegerOrNull(',
    'committedIngressSequence: positiveSafeIntegerOrNull(',
    "committedIngressOrder: ['before_receipt', 'after_receipt'].includes(",
  ].forEach((token) => assertIncludes(siteRuntimeBrowserSource, token, siteRuntimeBrowserPath));
  [
    'const CONTENT_RUNTIME_SETTLEMENT_EVENT_NAMES = new Set([',
    "'protection_tab_updated_admission_url_reconciled'",
    "'protection_tab_updated_dispatch_settled'",
    "'protection_tab_updated_dispatch_rejected'",
    'contentRuntimeSettlementEvidence: contentRuntimeSettlementLedger.snapshot()',
  ].forEach((token) => assertIncludes(siteRuntimeE2ESource, token, siteRuntimeE2EPath));
  [
    '`trackingContentProtectionSync`',
    '`timeout_pending`',
    '`metrics.gateDocumentId`',
    '`ProtectionRuntimeInputProvider.readProtectedTabInventory({now})`',
    '`beforeGateNavigation(tabId)`',
    '반환된 response를 먼저',
    '실제 settle하기 전에는 FIFO/profile admission을 풀지 않는다.',
    'browser-event ingress',
    '`attemptId + startedAt`',
    '`bootstrap_protection_sync_document_superseded`',
    '`CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE:document_replaced`',
    'same-current/whitespace/malformed/missing identity',
    'Dispatcher는 listener registration 전에 eager 생성되고',
    '`ProtectionTabLifecycleLedger`가 raw removal 시점에 tombstone을 직접 기록한다.',
    '`documentDisposition: redirected`',
    '`bootstrapInjectionReason + bootstrapInjectionGeneration`',
    'terminal `dispatch_ready_timeout`',
    'wall-clock timestamp는 diagnostic metadata',
    'History certificate는 one-shot이 아니라 bounded multi-use다.',
    '`protection_committed_navigation_superseded`',
    '`protection_history_pending_tab_update_superseded`',
    '`PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED`',
    "`ensureSource === 'session_dispatch_ready'`",
    '`failBootstrapInjection`',
    '`failedCommitted:false`',
    'registry-global positive generation',
    '`ContentScriptOrchestrator.getTabSessionSnapshot()`',
    '`protection_delayed_tab_update_reconciled`',
    '`protection_same_document_url_superseded`',
    '`ContentScriptOrchestrator`가 exact `documentIds:[D]`',
    '`G + D + S -> R` URL-only CAS',
    'lexical admission catch',
  ].forEach((token) => assertIncludes(
    contentRuntimeTargetArchitectureSource,
    token,
    contentRuntimeTargetArchitecturePath,
  ));
  [
    'registry-global monotonic session generation with an atomic frozen snapshot',
    '`protection_committed_navigation_superseded`',
    '`createContentScriptOrchestrator().refreshReadyDocumentUrlFromExactProbe`',
    'registry commit is an exact generation+document+old-URL CAS',
    'exact idempotent convergence observation',
    'a fresh admission recapture binds to that generation',
  ].forEach((token) => assertIncludes(
    protectionContentRuntimeBoundaryMapSource,
    token,
    protectionContentRuntimeBoundaryMapPath,
  ));
  assertExcludes(
    contentRuntimeTargetArchitectureSource,
    '`AbortSignal`을 전파해 다음 document를 해제한다.',
    contentRuntimeTargetArchitecturePath,
    `${contentRuntimeTargetArchitecturePath} must not claim cooperative timeout releases an unsettled platform owner.`,
  );
  assertExcludes(
    sessionRegistrySource,
    'waitForReady(',
    sessionRegistryPath,
    `${sessionRegistryPath} must not reintroduce waitForReady().`,
  );

  [
    "import { createProtectionDispatcher } from '../../../../domains/protection/background/ProtectionDispatcher.js';",
    'protectionDispatcher: createProtectionDispatcher({',
    'runtimeLanguageStore: runtimeLanguageRepository',
  ].forEach((token) => assertIncludes(
    protectionDispatcherBindingsSource,
    token,
    protectionDispatcherBindingsPath,
  ));

  assertIncludes(orchestratorSource, 'contentScriptRegistrationSync', orchestratorPath);
  assertIncludes(orchestratorSource, 'waitForDispatchReady(', orchestratorPath);
  assertIncludes(orchestratorSource, 'dispatch_ready_timeout', orchestratorPath);
  assertIncludes(orchestratorSource, 'if (retryInjectResult.ok) {', orchestratorPath);
  assertIncludes(orchestratorSource, 'tabContentSessionRegistry.releaseBootstrapInjection(tabId, {', orchestratorPath);
  assertIncludes(orchestratorSource, 'expectedReason: retryInjectResult.bootstrapInjectionReason', orchestratorPath);
  assertIncludes(orchestratorSource, 'expectedGeneration: retryInjectResult.bootstrapInjectionGeneration', orchestratorPath);
  assertIncludes(orchestratorSource, "releaseReason: 'dispatch_ready_timeout'", orchestratorPath);
  assertIncludes(orchestratorSource, "recordDiagnostic('bootstrap_injection_owner_released'", orchestratorPath);
  assertIncludes(orchestratorSource, 'function requireBootstrapInjectionFailureResult(result)', orchestratorPath);
  assertIncludes(orchestratorSource, 'result.failed === true', orchestratorPath);
  assertIncludes(orchestratorSource, "result.session.status !== 'failed'", orchestratorPath);
  assertIncludes(orchestratorSource, 'result.session.bootstrapInjectionReason !== null', orchestratorPath);
  assertIncludes(orchestratorSource, 'result.session.bootstrapInjectionGeneration !== null', orchestratorPath);
  assertIncludes(orchestratorSource, 'result.session.bootstrapOwnerReason !== null', orchestratorPath);
  const injectionExecutionStart = orchestratorSource.indexOf(
    'async function injectContentScriptFiles(',
  );
  const injectionExecutionEnd = orchestratorSource.indexOf(
    'async function injectMediaFrameSidecar(',
    injectionExecutionStart,
  );
  const injectionExecutionSource = orchestratorSource.slice(
    injectionExecutionStart,
    injectionExecutionEnd,
  );
  [
    'tabContentSessionRegistry.failBootstrapInjection(tabId, {',
    'expectedReason: injectionSession.bootstrapInjectionReason',
    'expectedGeneration: injectionSession.bootstrapInjectionGeneration',
    'failedCommitted: failureResult.failed',
  ].forEach((token) => assertIncludes(injectionExecutionSource, token, orchestratorPath));
  if (injectionExecutionStart < 0 || injectionExecutionEnd <= injectionExecutionStart) {
    fail(`${orchestratorPath} must retain the exact loader injection execution owner slice.`);
  }
  assertExcludes(
    injectionExecutionSource,
    'tabContentSessionRegistry.noteBootstrapState(',
    orchestratorPath,
    `${orchestratorPath} must not commit loader execution failure through the unfenced bootstrap telemetry API.`,
  );
  assertIncludes(orchestratorSource, 'async function ensureCatchUpTabsReady(', orchestratorPath);
  assertIncludes(orchestratorSource, 'reason: normalizedReason,', orchestratorPath);
  assertIncludes(orchestratorSource, "'managed_sync_catch_up_plan_resolved'", orchestratorPath);
  assertIncludes(orchestratorSource, 'await ensureContentScriptReady(tabId, {', orchestratorPath);
  assertIncludes(orchestratorSource, 'CONTENT_SCRIPT_CATCH_UP_READY_RESULT_INVALID', orchestratorPath);
  assertIncludes(orchestratorSource, 'managed_sync_catch_up_readiness_failed', orchestratorPath);
  assertIncludes(orchestratorSource, 'recordManagedSyncFailure', orchestratorPath);
  assertIncludes(orchestratorSource, 'managed_sync_failed', orchestratorPath);
  assertIncludes(
    trackingServiceBootstrapSource,
    "await runPostDashboardBootStage('managed_catchup', () => runDetachedBootstrapTask({\n            label: 'managed_content_script_service_sync',\n            task: () => reconcileStartupContentScripts({ reason: 'service_init' }),",
    trackingServiceBootstrapPath,
  );
  assertIncludes(trackingServiceBootstrapSource, 'const result = await task();', trackingServiceBootstrapPath);
  assertIncludes(trackingServiceBootstrapSource, "reportPostDashboardBootStage(stage, { phase: 'settled', failed });", trackingServiceBootstrapPath);
  assertIncludes(
    runtimeCoordinatorSource,
    'contentScriptSync.syncManagedContentScripts({\n            injectOpenTabs,\n            reason,\n            propagationContext,',
    runtimeCoordinatorPath,
  );
  assertIncludes(runtimeCoordinatorSource, 'requireSettingsPropagationContext(propagationContext);', runtimeCoordinatorPath);
  assertIncludes(
    backgroundMessageRouterSource,
    'const FULL_INIT_PREREQUISITE_MESSAGE_TYPES = new Set([\n  MESSAGE_TYPES.CONTENT_BOOTSTRAP_STATE,',
    backgroundMessageRouterPath,
  );
  assertIncludes(
    backgroundMessageRouterSource,
    'FULL_INIT_PREREQUISITE_MESSAGE_TYPES.has(message?.type)',
    backgroundMessageRouterPath,
  );
  assertIncludes(
    lifecycleWakeContractSource,
    "event?.event === 'catch_up_readiness_completed'",
    lifecycleWakeContractPath,
  );
  assertIncludes(
    lifecycleHarnessSource,
    'MV3_LIFECYCLE_CATCH_UP_READINESS_EVENT_MISSING',
    lifecycleHarnessPath,
  );
  assertIncludes(orchestratorSource, "from './contentScriptOrchestratorState.js'", orchestratorPath);
  assertIncludes(orchestratorSource, 'const diagnostics = assertContentRuntimeDiagnostics(contentRuntimeDiagnostics);', orchestratorPath);
  assertIncludes(orchestratorSource, 'return diagnostics.record(event, payload);', orchestratorPath);
  assertIncludes(orchestratorSource, 'createInitialSyncSnapshot(scriptFiles, mediaFrameScriptFiles)', orchestratorPath);
  assertIncludes(orchestratorSource, 'normalizeSyncSnapshot(result, mediaFrameScriptFiles)', orchestratorPath);
  assertIncludes(orchestratorSource, 'requireInjectionSummary(lastSyncSnapshot.injectionSummary)', orchestratorPath);
  assertIncludes(orchestratorSource, 'normalizeScriptingExecuteErrorResult', orchestratorPath);
  assertIncludes(orchestratorSource, 'requireInjectionAttemptResult', orchestratorPath);
  assertIncludes(orchestratorSource, 'CONTENT_SCRIPT_INJECT_EXECUTE_RESULT_INVALID', orchestratorPath);
  assertIncludes(orchestratorSource, 'CONTENT_SCRIPT_MEDIA_FRAME_EXECUTE_RESULT_INVALID', orchestratorPath);
  assertIncludes(orchestratorSource, 'requireFailedSessionError', orchestratorPath);
  assertIncludes(orchestratorSource, 'CONTENT_SCRIPT_FAILED_SESSION_ERROR_REQUIRED', orchestratorPath);
  assertIncludes(orchestratorSource, 'requireLastSyncSnapshot(lastSyncSnapshot)', orchestratorPath);
  assertIncludes(orchestratorSource, 'CONTENT_SCRIPT_LAST_SYNC_SNAPSHOT_INVALID', orchestratorPath);
  assertIncludes(orchestratorSource, 'requireTabsSendMessageResult', orchestratorPath);
  assertIncludes(orchestratorSource, 'CONTENT_SCRIPT_TEARDOWN_MESSAGE_RESULT_INVALID', orchestratorPath);
  assertIncludes(sessionRegistrySource, 'TAB_CONTENT_SESSION_FAILED_ERROR_REQUIRED', sessionRegistryPath);
  [
    'const sessionGenerationByTab = new Map();',
    'let globalSessionGeneration = 0;',
    'function advanceSessionGeneration(tabId) {',
    'sessionGenerationByTab.set(tabId, nextGeneration);',
    'function readSessionSnapshot(tabId) {',
    'session: freezeSessionSnapshot(sessions.get(normalizedTabId) || null)',
    'function compareAndRefreshReadyDocumentUrl(tabId, {',
    "parsed.protocol !== 'http:' && parsed.protocol !== 'https:'",
    'parsed.href !== value',
    'currentGeneration === normalizedExpectedGeneration',
    'currentSession?.documentId === normalizedExpectedDocumentId',
    'currentSession?.url === normalizedExpectedUrl',
    'url: normalizedNextUrl',
    'compareAndRefreshReadyDocumentUrl,',
    'getSnapshot: readSessionSnapshot',
  ].forEach((token) => assertIncludes(sessionRegistrySource, token, sessionRegistryPath));
  const sessionCommitStart = sessionRegistrySource.indexOf(
    'function commitSession(tabId, nextSession) {',
  );
  const sessionReadStart = sessionRegistrySource.indexOf(
    'function readSession(tabId) {',
    sessionCommitStart,
  );
  const sessionCommitSource = sessionRegistrySource.slice(sessionCommitStart, sessionReadStart);
  const generationAdvanceIndex = sessionCommitSource.indexOf(
    'advanceSessionGeneration(normalizedTabId);',
  );
  const sessionSetIndex = sessionCommitSource.indexOf('sessions.set(normalizedTabId, next);');
  if (
    sessionCommitStart < 0
    || sessionReadStart <= sessionCommitStart
    || generationAdvanceIndex < 0
    || sessionSetIndex <= generationAdvanceIndex
    || sessionRegistrySource.split('advanceSessionGeneration(normalizedTabId);').length - 1 !== 1
  ) {
    fail(`${sessionRegistryPath} must mint the non-reusable session generation only at the canonical accepted commit owner before publication.`);
  }
  [
    'function getTabSessionSnapshot(tabId) {',
    'return tabContentSessionRegistry.getSnapshot(tabId);',
    'async function probeExactDocumentLocation({',
    'async function refreshReadyDocumentUrlFromExactProbe({',
    "hasExactEnumerableKeys(value, ['error', 'results'])",
    "hasExactEnumerableKeys(injection, ['documentId', 'frameId', 'result'])",
    'READY_DOCUMENT_URL_REFRESH_PROOF_FIELDS',
    'freezeReadyDocumentUrlRefreshProof(',
    'documentIds: [normalizedDocumentId]',
    'func: readCurrentDocumentLocationHref',
    'requireReadyDocumentLocationProbeResult(executeResult, {',
    'await probeExactDocumentLocation({',
    'tabContentSessionRegistry.compareAndRefreshReadyDocumentUrl(',
    "'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_CAS_CONFLICT'",
    'probeExactDocumentLocation,',
    'refreshReadyDocumentUrlFromExactProbe,',
    'getTabSessionSnapshot,',
  ].forEach((token) => assertIncludes(orchestratorSource, token, orchestratorPath));
  const readyDocumentProbeStart = orchestratorSource.indexOf(
    'async function probeExactDocumentLocation({',
  );
  const readyDocumentRefreshStart = orchestratorSource.indexOf(
    'async function refreshReadyDocumentUrlFromExactProbe({',
  );
  const readyDocumentRefreshEnd = orchestratorSource.indexOf(
    'function listTabSessions()',
    readyDocumentRefreshStart,
  );
  const readyDocumentRefreshSource = orchestratorSource.slice(
    readyDocumentRefreshStart,
    readyDocumentRefreshEnd,
  );
  const readyDocumentReaderStart = orchestratorSource.indexOf(
    'function readCurrentDocumentLocationHref() {',
  );
  const readyDocumentReaderEnd = orchestratorSource.indexOf(
    'const READY_DOCUMENT_URL_REFRESH_PROOF_FIELDS',
    readyDocumentReaderStart,
  );
  const readyDocumentReaderSource = orchestratorSource.slice(
    readyDocumentReaderStart,
    readyDocumentReaderEnd,
  ).trim();
  const readyDocumentProbeSource = orchestratorSource.slice(
    readyDocumentProbeStart,
    readyDocumentRefreshStart,
  );
  const readyDocumentExecuteIndex = readyDocumentProbeSource.indexOf(
    'executeResult = await scriptingExecuteScriptWithResults({',
  );
  const readyDocumentProbeCallIndex = readyDocumentRefreshSource.indexOf(
    'await probeExactDocumentLocation({',
  );
  const readyDocumentCasIndex = readyDocumentRefreshSource.indexOf(
    'tabContentSessionRegistry.compareAndRefreshReadyDocumentUrl(',
  );
  if (
    readyDocumentProbeStart < 0
    || readyDocumentRefreshStart < 0
    || readyDocumentRefreshStart <= readyDocumentProbeStart
    || readyDocumentRefreshEnd <= readyDocumentRefreshStart
    || readyDocumentExecuteIndex < 0
    || readyDocumentProbeCallIndex < 0
    || readyDocumentCasIndex <= readyDocumentProbeCallIndex
    || readyDocumentProbeSource.split('scriptingExecuteScriptWithResults(').length - 1 !== 1
    || readyDocumentRefreshSource.includes('scriptingExecuteScriptWithResults(')
    || readyDocumentReaderSource !== [
      'function readCurrentDocumentLocationHref() {',
      '  return globalThis.location.href;',
      '}',
    ].join('\n')
    || readyDocumentProbeSource.includes('frameIds:')
    || readyDocumentProbeSource.includes('allFrames:')
    || readyDocumentProbeSource.includes('files:')
    || readyDocumentProbeSource.includes('args:')
    || readyDocumentProbeSource.includes('world:')
    || readyDocumentProbeSource.includes('tabsGet(')
    || readyDocumentRefreshSource.includes('frameIds:')
    || readyDocumentRefreshSource.includes('allFrames:')
    || readyDocumentRefreshSource.includes('files:')
    || readyDocumentRefreshSource.includes('args:')
    || readyDocumentRefreshSource.includes('world:')
    || readyDocumentRefreshSource.includes('tabsGet(')
  ) {
    fail(`${orchestratorPath} must own one reusable read-only exact-document location probe and invoke it before the registry generation/document/URL CAS, without frame fallback or live-tab lookup.`);
  }
  const readyDocumentCasOwnerStart = sessionRegistrySource.indexOf(
    'function compareAndRefreshReadyDocumentUrl(tabId, {',
  );
  const readyDocumentCasCommitStart = sessionRegistrySource.indexOf(
    'commitSession(normalizedTabId, {',
    readyDocumentCasOwnerStart,
  );
  const readyDocumentCasCommitEnd = sessionRegistrySource.indexOf(
    'const refreshedSnapshot = readSessionSnapshot(normalizedTabId);',
    readyDocumentCasCommitStart,
  );
  const readyDocumentCasCommitSource = sessionRegistrySource.slice(
    readyDocumentCasCommitStart,
    readyDocumentCasCommitEnd,
  );
  if (
    readyDocumentCasOwnerStart < 0
    || readyDocumentCasCommitStart <= readyDocumentCasOwnerStart
    || readyDocumentCasCommitEnd <= readyDocumentCasCommitStart
    || !readyDocumentCasCommitSource.includes('...currentSession,')
    || !readyDocumentCasCommitSource.includes('url: normalizedNextUrl,')
    || !readyDocumentCasCommitSource.includes('updatedAt: Date.now(),')
    || readyDocumentCasCommitSource.includes('status:')
    || readyDocumentCasCommitSource.includes('attemptId:')
    || readyDocumentCasCommitSource.includes('bootstrapInjectionReason:')
    || readyDocumentCasCommitSource.includes('bootstrapInjectionGeneration:')
    || readyDocumentCasCommitSource.includes('bootstrapOwnerReason:')
    || readyDocumentCasCommitSource.includes('reason:')
  ) {
    fail(`${sessionRegistryPath} must keep the exact ready-document CAS URL-only while preserving lifecycle status, attempt, reason, and bootstrap ownership.`);
  }
  assertExcludes(
    orchestratorSource,
    'managedContentScriptSync',
    orchestratorPath,
    `${orchestratorPath} must depend on role-based contentScriptRegistrationSync, not the legacy concrete seam name.`,
  );
  assertExcludes(
    orchestratorSource,
    'bootstrap_timeout',
    orchestratorPath,
    `${orchestratorPath} must use dispatch_ready_timeout semantics.`,
  );
  assertExcludes(
    orchestratorSource,
    '.catch(() => null)',
    orchestratorPath,
    `${orchestratorPath} must report managed sync queue-tail failures before continuing the queue.`,
  );
  assertExcludes(
    orchestratorSource,
    'contentRuntimeDiagnostics = null',
    orchestratorPath,
    `${orchestratorPath} must require the content runtime diagnostics owner instead of accepting a null default.`,
  );
  assertExcludes(
    orchestratorSource,
    'contentRuntimeDiagnostics ||',
    orchestratorPath,
    `${orchestratorPath} must not skip diagnostics when the diagnostics owner is absent.`,
  );
  assertExcludes(
    orchestratorSource,
    'normalizeSyncSnapshot({},',
    orchestratorPath,
    `${orchestratorPath} must keep initial sync state separate from managed sync owner output normalization.`,
  );
  [
    'function createInitialSyncSnapshot',
    'function normalizeSyncSnapshot',
    'function normalizeCatchUpTargets',
    'function createCatchUpReadinessFailureError',
    'function assertContentRuntimeDiagnostics',
  ].forEach((token) => assertExcludes(
    orchestratorSource,
    token,
    orchestratorPath,
    `${orchestratorPath} must keep content-runtime state shape helpers in ${orchestratorStatePath}.`,
  ));

  assertIncludes(orchestratorStateSource, 'CONTENT_SCRIPT_SYNC_RESULT_INVALID', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'export function createInitialSyncSnapshot', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'export function normalizeSyncSnapshot', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'export function normalizeCatchUpTargets', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'export function createCatchUpReadinessFailureError', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'CONTENT_SCRIPT_CATCH_UP_READINESS_FAILED', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'export function requireInjectionSummary', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'requireSyncResultCatchUpTabs(source)', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'requireSyncResultMediaFrameSnapshot(source)', orchestratorStatePath);
  assertIncludes(orchestratorStateSource, 'export function assertContentRuntimeDiagnostics', orchestratorStatePath);
  assertExcludes(
    orchestratorStateSource,
    'export function normalizeSyncSnapshot(result = {}',
    orchestratorStatePath,
    `${orchestratorStatePath} must reject malformed sync owner results instead of defaulting them to empty snapshots.`,
  );
  assertExcludes(
    orchestratorStateSource,
    '? result.scriptFiles',
    orchestratorStatePath,
    `${orchestratorStatePath} must require managed sync scriptFiles instead of falling back to configured script files.`,
  );
  assertExcludes(
    orchestratorStateSource,
    'source.injectionSummary && typeof source.injectionSummary ===',
    orchestratorStatePath,
    `${orchestratorStatePath} must require managed sync injectionSummary instead of accepting null or malformed summaries.`,
  );
  assertExcludes(
    orchestratorStateSource,
    'Number(summary?.failureCount) || 0',
    orchestratorStatePath,
    `${orchestratorStatePath} must require catch-up failure summaries instead of falling back to zero failures.`,
  );
  assertExcludes(
    orchestratorStateSource,
    'normalizeMediaFrameSnapshot(source.mediaFrame',
    orchestratorStatePath,
    `${orchestratorStatePath} must require managed sync mediaFrame snapshots instead of filling missing owner output.`,
  );
  assertExcludes(
    orchestratorSource,
    'Number(lastSyncSnapshot.injectionSummary?.attemptedCount) || 0',
    orchestratorPath,
    `${orchestratorPath} must validate completed injection summaries before diagnostic reporting.`,
  );
  assertExcludes(
    orchestratorSource,
    'if (!injectResult?.ok)',
    orchestratorPath,
    `${orchestratorPath} must validate injection attempt results instead of optional-chaining them.`,
  );
  assertExcludes(
    orchestratorSource,
    "String(injectResult?.error || 'INJECT_FAILED')",
    orchestratorPath,
    `${orchestratorPath} must preserve validated injection errors instead of fallback-stringifying malformed results.`,
  );
  assertExcludes(
    orchestratorSource,
    "failedSession.error || 'CONTENT_BOOTSTRAP_FAILED'",
    orchestratorPath,
    `${orchestratorPath} must require failed session errors instead of inventing bootstrap failure fallbacks.`,
  );
  assertExcludes(
    orchestratorSource,
    "retryFailedSession.error || retryInjectResult.error || 'CONTENT_BOOTSTRAP_FAILED'",
    orchestratorPath,
    `${orchestratorPath} must require retry failed session errors instead of inventing bootstrap failure fallbacks.`,
  );
  assertExcludes(
    orchestratorSource,
    'Array.isArray(lastSyncSnapshot.registeredDomains)',
    orchestratorPath,
    `${orchestratorPath} must validate lastSyncSnapshot shape instead of falling back to empty registered domains.`,
  );
  assertExcludes(
    orchestratorSource,
    'lastSyncSnapshot.mediaFrame || {}',
    orchestratorPath,
    `${orchestratorPath} must validate mediaFrame snapshot shape instead of fallback-spreading empty objects.`,
  );
  assertExcludes(
    orchestratorSource,
    'Array.isArray(lastSyncSnapshot.catchUpTabs)',
    orchestratorPath,
    `${orchestratorPath} must validate catchUpTabs snapshot shape instead of fallback-cloning empty arrays.`,
  );
  assertExcludes(
    orchestratorSource,
    'response?.error || null',
    orchestratorPath,
    `${orchestratorPath} must validate teardown message results instead of optional error fallbacks.`,
  );
  assertExcludes(
    orchestratorSource,
    '!response?.error',
    orchestratorPath,
    `${orchestratorPath} must validate teardown message results before deriving ok state.`,
  );
  [
    'cancelTabReadiness',
    'waitForReadinessHandoff',
    'content_readiness_cancelled',
    'content_cleanup_pending',
    'reconcileCleanupDocument',
    'cleanup_document_replacement_refused',
    'cleanup_document_replaced',
    'after?.generation !== before.generation',
    'proof.documentId === expectedDocumentId',
    'CONTENT_SCRIPT_TEARDOWN_DOCUMENT_CHANGED',
    'signal: owner.controller.signal',
    'teardownAcknowledgements.set(result, Object.freeze({',
    'scopeRetirementsByTab.set(tabId, proof)',
    'snapshot?.generation !== proof.generation',
    'snapshot.session.attemptId !== proof.attemptId',
    'proof.url !== requestedUrl',
    'readContentScopeRetirement',
    'permissionRevision === teardownPermissionRevision',
    'scopeRetirementRevisionsByTab.get(tabId) === retirementRevision',
    'permissionRevision === proof.permissionRevision',
    'scopeRetirementRevisionsByTab.get(tabId) === proof.retirementRevision',
  ].forEach((token) => assertIncludes(orchestratorSource, token, orchestratorPath));
  [
    'contentScriptRuntime.readContentScopeRetirement(tabId, { url: transactionUrl })',
    "return { skipped: 'content_scope_retired' }",
  ].forEach((token) => assertIncludes(protectionDispatcherSource, token, protectionDispatcherPath));
  [
    'signal?.aborted',
    "signal?.removeEventListener('abort', abort)",
  ].forEach((token) => assertIncludes(sessionRegistrySource, token, sessionRegistryPath));
  assertIncludes(contentRuntimeDiagnosticsSource, 'CONTENT_RUNTIME_DIAGNOSTIC_EVENT_REQUIRED', contentRuntimeDiagnosticsPath);
  assertIncludes(
    bootstrapStateSource,
    'receiverCapabilityVersion',
    bootstrapStatePath,
  );
  assertIncludes(
    orchestratorSource,
    'createContentReceiverCapability',
    orchestratorPath,
  );
  assertIncludes(
    contentReceiverCapabilitySource,
    'sessionGeneration',
    contentReceiverCapabilityPath,
  );
  assertIncludes(
    protectionDispatchTransportSource,
    'recovered_capability_ack',
    protectionDispatchTransportPath,
  );
  [
    'retryDelaysMs',
    "throwIfProtectionDispatchAborted(dispatchAbortSignal, 'recovery_delay')",
    'await sleep(delayMs)',
  ].forEach((token) => assertExcludes(
    protectionDispatchTransportSource,
    token,
    protectionDispatchTransportPath,
    `${protectionDispatchTransportPath} must use receiver capability proof instead of time-based recovery retries.`,
  ));
  [
    'createProtectionTabUpdatedIngressReceipt',
    'claimProtectionTabUpdatedIngressReceipt',
    'createProtectionTabUpdatedDispatchOutcome',
    'consumeProtectionTabUpdatedDispatchOutcome',
  ].forEach((token) => assertIncludes(
    protectionTabUpdatedDispatchProtocolSource,
    token,
    protectionTabUpdatedDispatchProtocolPath,
  ));
  assertIncludes(
    protectionTabUpdatedDispatchProtocolSource,
    "status !== 'applied' && status !== 'superseded'",
    protectionTabUpdatedDispatchProtocolPath,
  );
  [
    'protection_committed_navigation_superseded',
    'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED',
  ].forEach((token) => assertIncludes(
    protectionTabUpdatedDispatchProtocolSource,
    token,
    protectionTabUpdatedDispatchProtocolPath,
  ));
  assertExcludes(
    protectionDispatchTransportSource,
    'createProtectionTabUpdatedIngressReceipt',
    protectionDispatchTransportPath,
    `${protectionDispatchTransportPath} must not re-own tabs.onUpdated receipt/outcome protocol state.`,
  );
  assertExcludes(
    contentRuntimeDiagnosticsSource,
    'if (!eventName) return null;',
    contentRuntimeDiagnosticsPath,
    `${contentRuntimeDiagnosticsPath} must reject unnamed diagnostic writes instead of returning null.`,
  );
  [
    'scriptingExecuteScript',
    'tabsSendMessage',
    'createContentScriptOrchestrator',
    'waitForDispatchReady',
    'teardownContentForTab',
  ].forEach((token) => assertExcludes(
    orchestratorStateSource,
    token,
    orchestratorStatePath,
    `${orchestratorStatePath} must not own injection, teardown, or dispatch-ready execution.`,
  ));

  assertIncludes(runtimeCoordinatorSource, 'contentScriptRuntimeSync', runtimeCoordinatorPath);
  assertExcludes(
    runtimeCoordinatorSource,
    'managedContentScriptSync',
    runtimeCoordinatorPath,
    `${runtimeCoordinatorPath} must not use the legacy managedContentScriptSync composition name.`,
  );

  assertIncludes(contentScriptBindingsSource, 'contentScriptRegistrationSync', contentScriptBindingsPath);
  assertExcludes(
    contentScriptBindingsSource,
    'managedContentScriptSync',
    contentScriptBindingsPath,
    `${contentScriptBindingsPath} must expose the registration seam by role, not by legacy concrete name.`,
  );

  console.log(
    '[content-runtime-bootstrap-contract] PASS: receiver_ready/active split and runtime owner seams stay intact.',
  );
};

main().catch((error) => {
  console.error('[content-runtime-bootstrap-contract] Unexpected error:', error);
  process.exit(1);
});
