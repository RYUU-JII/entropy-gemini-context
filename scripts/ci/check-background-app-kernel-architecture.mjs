#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  enforceSoftModuleBudget,
} from './architectureGuardUtils.mjs';
import { findGateOwnerFallbackViolations } from './gateOwnerFallbackContract.mjs';

const rootDir = process.cwd();
const kernelPath = 'src/apps/background/services/runtime/BackgroundAppKernel.js';
const helperImports = [
  "./backgroundKernelAnalyticsBindings.js",
  "./backgroundKernelTrackingRuntimeBindings.js",
  "./backgroundKernelClseContext.js",
  "./backgroundKernelBootstrapBindings.js",
  "./backgroundKernelCoreServices.js",
  "./backgroundKernelMessageBindings.js",
  "./backgroundKernelNudgeRuntimeBindings.js",
  "./backgroundKernelProtectionBindings.js",
  "./backgroundKernelRuntimeIntegrationBindings.js",
  "./backgroundKernelSettingsPropagationBindings.js",
  "./backgroundKernelStorageSupportBindings.js",
  "./backgroundKernelBehaviorPolicy.js",
  "./backgroundKernelTacticalLogs.js",
  "./backgroundKernelBridgeGuards.js",
  "./backgroundKernelProfileMutationBindings.js",
  "./backgroundKernelZenProfileGenerationFactory.js",
  "./backgroundKernelZenProfileGenerationReadiness.js",
  "./support/BackgroundServiceWorkerWakeTelemetry.js",
];
const forbiddenImportTokens = [
  'TrackingMessageHandler.js',
  'BackgroundMessageRouter.js',
  'ProtectionRuntimeCoordinator.js',
  'TrackingAnalyticsCoordinator.js',
  'BackgroundBootstrapCoordinator.js',
  'ProtectionDispatcher.js',
  'TrackingProtectionService.js',
  'FrictionBootstrapCoordinator.js',
  'ProtectionRuntimeInputProvider.js',
  'ProtectionRuntimeInputAssembler.js',
  'backgroundKernelRuntimeContracts.js',
  'backgroundKernelCoordinatorBindings.js',
  'HistoryManager.js',
  'NudgeManager.js',
  'ManagedContentScriptSync.js',
  'trackingRuntimeCoordinator.js',
  'nudgeDebtSessionReconciliation.js',
  'NudgeWindowBlurController.js',
];
const forbiddenHelperDefinitions = [
  'function createEmptyTickBuffer(',
  'function cloneMetrics(',
  'function mapWithConcurrency(',
  'function resolveRulesAwareFilteringMode(',
  'function flushTacticalLogsWrapper(',
  'function buildAppliedFrictionSnapshot(',
  'function buildFocusTabSnapshot(',
  'function captureSequenceSample(',
  'function finalizeSequence(',
];

const fail = (message) => {
  console.error(`[background-app-kernel-architecture] FAIL: ${message}`);
  process.exit(1);
};

async function listJsFilesUnder(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJsFilesUnder(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  }));
  return files.flat();
}

const main = async () => {
  const source = await fs.readFile(path.resolve(rootDir, kernelPath), 'utf8');
  const serviceWorkerWakeTelemetrySource = await fs.readFile(path.resolve(
    rootDir,
    'src/apps/background/services/runtime/support/BackgroundServiceWorkerWakeTelemetry.js',
  ), 'utf8');
  const backgroundBootstrapCoordinatorSource = await fs.readFile(path.resolve(
    rootDir,
    'src/apps/background/services/runtime/BackgroundBootstrapCoordinator.js',
  ), 'utf8');
  const serviceWorkerWakeTelemetryTestSource = await fs.readFile(path.resolve(
    rootDir,
    'tests/backgroundServiceWorkerWakeTelemetry.test.js',
  ), 'utf8');
  const backgroundRuntimeOwnersDoc = await fs.readFile(path.resolve(
    rootDir,
    'docs/system-architecture/05-background-runtime-owners.md',
  ), 'utf8');
  const backgroundKernelAdaptersSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelAdapters.js'), 'utf8');
  const echoMutationPolicySource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/runtime/echoArtifactMutationPolicy.js'), 'utf8');
  const backgroundKernelActionHandlerFactorySource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelActionHandlerFactory.js'), 'utf8');
  const backgroundKernelActionStatsBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelActionStatsBindings.js'), 'utf8');
  const backgroundKernelActionStatsQueryOwnersSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelActionStatsQueryOwners.js'), 'utf8');
  const analyticsBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelAnalyticsBindings.js'), 'utf8');
  const behaviorBrowserPortSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelBehaviorBrowserPort.js'), 'utf8');
  const behaviorPolicySource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelBehaviorPolicy.js'), 'utf8');
  const clseServiceClientSource = await fs.readFile(path.resolve(rootDir, 'src/domains/behavior/CLSEServiceClient.js'), 'utf8');
  const clseServiceSource = await fs.readFile(path.resolve(rootDir, 'src/domains/behavior/CLSEService.js'), 'utf8');
  const clseProfileMutationAdmissionSource = await fs.readFile(path.resolve(rootDir, 'src/domains/behavior/clseProfileMutationRuntimeAdmission.js'), 'utf8');
  const clseCollectorIndexSource = await fs.readFile(path.resolve(rootDir, 'src/domains/behavior/collectors/index.js'), 'utf8');
  const clseCollectorSources = Object.fromEntries(await Promise.all([
    'ActivityCollector.js',
    'ContentCollector.js',
    'MediaCollector.js',
    'NavCollector.js',
    'ScrollCollector.js',
    'TabCollector.js',
  ].map(async (fileName) => [
    fileName,
    await fs.readFile(path.resolve(rootDir, 'src/domains/behavior/collectors', fileName), 'utf8'),
  ])));
  const backgroundMessageRouterSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/BackgroundMessageRouter.js'), 'utf8');
  const bootstrapBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelBootstrapBindings.js'), 'utf8');
  const browserEventBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelBrowserEventBindings.js'), 'utf8');
  const browserEventListenerSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelBrowserEventListener.js'), 'utf8');
  const browserEventFailureFieldsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundBrowserEventFailureFields.js'), 'utf8');
  const bootstrapSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingServiceBootstrap.js'), 'utf8');
  const protectionDispatcherBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProtectionDispatcherBindings.js'), 'utf8');
  const protectionBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProtectionBindings.js'), 'utf8');
  const protectionBrowserPortSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js'), 'utf8');
  const protectionTabsQuerySource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProtectionTabsQuery.js'), 'utf8');
  const gateInterventionOwnerBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelGateInterventionOwnerBindings.js'), 'utf8');
  const protectionDispatcherSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/ProtectionDispatcher.js'), 'utf8');
  const protectionTabLifecycleLedgerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionTabLifecycleLedger.js'), 'utf8');
  const tabLifecycleEventQueueSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/TabLifecycleEventQueue.js'), 'utf8');
  const protectionAudioDullingDispatchBridgeSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionAudioDullingDispatchBridge.js'), 'utf8');
  const protectionDispatchPayloadBuilderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchPayloadBuilder.js'), 'utf8');
  const protectionDispatchPermissionGateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchPermissionGate.js'), 'utf8');
  const protectionDispatchPolicyPayloadSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchPolicyPayload.js'), 'utf8');
  const protectionDispatchSerialQueueSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js'), 'utf8');
  const protectionDispatchStateLedgerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchStateLedger.js'), 'utf8');
  const protectionDispatchTransportSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js'), 'utf8');
  const protectionEnvelopeContractSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/protocol/contracts/envelope.js'), 'utf8');
  const protectionEnvelopeBuilderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionEnvelopeBuilder.js'), 'utf8');
  const protectionGateDispatchBridgeSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionGateDispatchBridge.js'), 'utf8');
  const protectionNudgeDispatchContextSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js'), 'utf8');
  const protectionNudgeDispatchGateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchGate.js'), 'utf8');
  const nudgeSessionDispatchStateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/nudge/runtime/session/nudgeSessionDispatchState.js'), 'utf8');
  const nudgeTerminalOutboxContractSource = await fs.readFile(path.resolve(rootDir, 'src/domains/nudge/runtime/session/nudgeTerminalOutboxContract.js'), 'utf8');
  const nudgeTerminalOutboxStateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/nudge/runtime/session/nudgeTerminalOutboxState.js'), 'utf8');
  const nudgeManagerResolutionStateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/nudgeManagerResolutionState.js'), 'utf8');
  const nudgeManagerAbortKeyStateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/nudgeManagerAbortKeyState.js'), 'utf8');
  const nudgeManagerAbortTabStateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/nudgeManagerAbortTabState.js'), 'utf8');
  const nudgeTerminalEffectCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/NudgeTerminalEffectCoordinator.js'), 'utf8');
  const protectionNudgeTeardownCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeTeardownCoordinator.js'), 'utf8');
  const trackingServiceBootstrapSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingServiceBootstrap.js'), 'utf8');
  const protectionNudgeDispatchMessageBuilderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchMessageBuilder.js'), 'utf8');
  const protectionNudgeDispatchRunnerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js'), 'utf8');
  const protectionNudgeDispatchTimelineSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchTimeline.js'), 'utf8');
  const protectionRuntimeInputProviderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/ProtectionRuntimeInputProvider.js'), 'utf8');
  const protectionRuntimeInputAssemblerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/ProtectionRuntimeInputAssembler.js'), 'utf8');
  const protectionProtocolProjectionSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protectionProtocolProjection.js'), 'utf8');
  const protectionPolicyCompilerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/protocol/engine/ProtectionPolicyCompiler.js'), 'utf8');
  const protectionProfileResolverSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/ProfileResolver.js'), 'utf8');
  const trackingProtectionServiceSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/TrackingProtectionService.js'), 'utf8');
  const coreServicesSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelCoreServices.js'), 'utf8');
  const backgroundNotificationClickActionSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelNotificationClickAction.js'), 'utf8');
  const statsQueryServicesSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelStatsQueryServices.js'), 'utf8');
  const tacticalLogsWrapperSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelTacticalLogs.js'), 'utf8');
  const lazyGateInterstitialSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelLazyGateInterstitialController.js'), 'utf8');
  const gateInterstitialSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/GateInterstitialController.js'), 'utf8');
  const notificationServiceSource = await fs.readFile(path.resolve(rootDir, 'src/domains/notifications/background/NotificationService.js'), 'utf8');
  const notificationBrowserPortSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelNotificationBrowserPort.js'), 'utf8');
  const notificationCatalogSource = await fs.readFile(path.resolve(rootDir, 'src/domains/notifications/background/notificationCatalog.js'), 'utf8');
  const notificationStateRepositorySource = await fs.readFile(path.resolve(rootDir, 'src/domains/notifications/background/notificationStateRepository.js'), 'utf8');
  const notificationPolicySource = await fs.readFile(path.resolve(rootDir, 'src/domains/notifications/background/notificationPolicy.js'), 'utf8');
  const notificationCapabilitySource = await fs.readFile(path.resolve(rootDir, 'src/domains/notifications/capability/notificationCapability.js'), 'utf8');
  const notificationRoutesSource = await fs.readFile(path.resolve(rootDir, 'src/domains/notifications/contracts/notificationRoutes.js'), 'utf8');
  const clseContextSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelClseContext.js'), 'utf8');
  const protectionServiceBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProtectionServiceBindings.js'), 'utf8');
  const protectionRuntimeBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProtectionRuntimeBindings.js'), 'utf8');
  const protectionRuntimeCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/ProtectionRuntimeCoordinator.js'), 'utf8');
  const protectionRuntimeStateCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/ProtectionRuntimeStateCoordinator.js'), 'utf8');
  const feedFlowRuntimeStateOwnerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js'), 'utf8');
  const gateRuntimeStateOwnerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/GateRuntimeStateOwner.js'), 'utf8');
  const protectionRuntimeSnapshotStoreSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/ProtectionRuntimeSnapshotStore.js'), 'utf8');
  const protectionRuntimeSnapshotEventsSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/protectionRuntimeSnapshotEvents.js'), 'utf8');
  const runtimeSnapshotBuilderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/RuntimeSnapshotBuilder.js'), 'utf8');
  const envelopeAdapterSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/EnvelopeAdapter.js'), 'utf8');
  const prepaintVisualPlanCompilerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/PrepaintVisualPlanCompiler.js'), 'utf8');
  const frictionBootstrapSnapshotBuilderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/FrictionBootstrapSnapshotBuilder.js'), 'utf8');
  const frictionBootstrapCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/runtime/FrictionBootstrapCoordinator.js'), 'utf8');
  const audioDullingCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/domains/protection/background/audioDulling/AudioDullingCoordinator.js'), 'utf8');
  const statsEventBridgeSource = await fs.readFile(path.resolve(rootDir, 'src/domains/stats/background/contracts/statsEventBridge.js'), 'utf8');
  const statsRuntimeServiceSource = await fs.readFile(path.resolve(rootDir, 'src/domains/stats/background/runtime/statsRuntimeService.js'), 'utf8');
  const behaviorTelemetryRecorderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/stats/background/collection/behaviorTelemetryRecorder.js'), 'utf8');
  const clseMessageRoutesSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/messageRoutes/clseMessageRoutes.js'), 'utf8');
  const clseMessageHandlerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/CLSEMessageHandler.js'), 'utf8');
  const siteInterventionStatsRecorderSource = await fs.readFile(path.resolve(rootDir, 'src/domains/stats/background/collection/siteInterventionStatsRecorder.js'), 'utf8');
  const trackingRuntimeSnapshotSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelTrackingRuntimeSnapshot.js'), 'utf8');
  const trackingBrowserBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelTrackingBrowserBindings.js'), 'utf8');
  const trackingBrowserEventSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingBrowserEventHandlers.js'), 'utf8');
  const trackingRuntimeCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingRuntimeCoordinator.js'), 'utf8');
  const scheduleRuntimeCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/domains/schedule/background/scheduleRuntimeCoordinator.js'), 'utf8');
  const scheduleRuntimeStateSource = await fs.readFile(path.resolve(rootDir, 'src/domains/schedule/contracts/scheduleRuntimeState.js'), 'utf8');
  const statsQueryHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/statsQueryHandlers.js'), 'utf8');
  const popupHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/popupHandlers.js'), 'utf8');
  const protectionRuntimeHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/protectionRuntimeHandlers.js'), 'utf8');
  const actionSenderPolicySource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessagePolicies/actionSenderPolicy.js'), 'utf8');
  const storageSupportHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/storageSupportHandlers.js'), 'utf8');
  const supportActionHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/supportActionHandlers.js'), 'utf8');
  const supportDebugPolicySource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessagePolicies/supportDebugPolicy.js'), 'utf8');
  const settingsAccessPolicySource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessagePolicies/settingsAccessPolicy.js'), 'utf8');
  const settingsActionHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/settingsHandlers.js'), 'utf8');
  const nudgeCycleHandlersSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js'), 'utf8');
  const trackingMessageDependencyResolverSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageDependencyResolver.js'), 'utf8');
  const nudgeWindowBlurControllerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/NudgeWindowBlurController.js'), 'utf8');
  const tacticalLoggerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/TacticalIntelligenceLogger.js'), 'utf8');
  const backgroundSettingsPropagationCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundSettingsPropagationCoordinator.js'), 'utf8');
  const backgroundSettingsPropagationBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelSettingsPropagationBindings.js'), 'utf8');
  const backgroundMemoryPurgeCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundMemoryPurgeCoordinator.js'), 'utf8');
  const backgroundMemoryPurgeArtifactRunnerSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundMemoryPurgeArtifactRunner.js'), 'utf8');
  const backgroundMaintenanceCoordinatorSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js'), 'utf8');
  const backgroundStorageSnapshotServiceSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js'), 'utf8');
  const backgroundStorageInspectorServiceSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundStorageInspectorService.js'), 'utf8');
  const storageMaintenanceBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelStorageMaintenanceBindings.js'), 'utf8');
  const storageSnapshotBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelStorageSnapshotBindings.js'), 'utf8');
  const storageSupportBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js'), 'utf8');
  const storageInspectorBindingsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelStorageInspectorBindings.js'), 'utf8');
  const zenProfileGenerationFactorySource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelZenProfileGenerationFactory.js'), 'utf8');
  const zenProfileGenerationReadinessSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelZenProfileGenerationReadiness.js'), 'utf8');
  const profileGenerationMessageRoutesSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/messageRoutes/profileGenerationMessageRoutes.js'), 'utf8');
  const lazyHistoryIntegrationsSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelLazyHistoryIntegrations.js'), 'utf8');
  const historyBrowserPortSource = await fs.readFile(path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelHistoryBrowserPort.js'), 'utf8');
  const historyManagerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/HistoryManager.js'), 'utf8');
  const bookmarkConcealManagerSource = await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/BookmarkConcealManager.js'), 'utf8');
  const trackingBackgroundFiles = await listJsFilesUnder(path.resolve(rootDir, 'src/domains/tracking/background'));
  const behaviorFiles = await listJsFilesUnder(path.resolve(rootDir, 'src/domains/behavior'));
  enforceSoftModuleBudget({
    file: kernelPath,
    source,
    softLines: 320,
    maxFunctionDeclarations: 3,
    maxTopLevelFunctionDeclarations: 3,
    maxClassDeclarations: 0,
    maxControlFlowTokens: 4,
    minLocalHelperImportsWhenOverSoft: helperImports.length,
    fail,
    label: 'background-app-kernel-architecture',
  });

  [
    'createInitialZenBonsaiProfileGenerationAggregate',
    'requireZenBonsaiProfileAggregateStorageValue',
    'ZenBonsaiProfileGenerationGenesis.js',
    'ZenBonsaiProfileAggregateStorageContract.js',
    'BACKGROUND_ZEN_PROFILE_GENERATION_EPOCH_REQUIRED',
    'createBackgroundKernelZenProfileGenerationInitializer',
    'resolveProfileResetGeneration',
    'BACKGROUND_ZEN_PROFILE_GENERATION_MODEL_STATE_REPOSITORY_REQUIRED',
    'BACKGROUND_ZEN_PROFILE_GENERATION_LIFECYCLE_REPOSITORY_REQUIRED',
    'BACKGROUND_ZEN_PROFILE_GENERATION_RUNTIME_GATE_REQUIRED',
    'background_bootstrap:zen_profile_generation_initialize',
    'await assertWriteAdmission({ expectedResetId: resolvedProfileEpoch })',
    'await initializeProfileGeneration(resolvedProfileEpoch, { profileAggregate })',
    'BACKGROUND_ZEN_PROFILE_GENERATION_RESULT_EPOCH_MISMATCH',
    'modelStateInitialEntries',
  ].forEach((token) => {
    if (!zenProfileGenerationFactorySource.includes(token)) {
      fail(`backgroundKernelZenProfileGenerationFactory.js must prepare the canonical Zen profile generation payload (${token}).`);
    }
  });
  [
    'ZenThemeModelStateContract.js',
    'ZenBonsaiProfileAggregateModel.js',
    'ZenBonsaiClassic2LineageModel.js',
    'SakuraLatentParamApi',
  ].forEach((token) => {
    if (zenProfileGenerationFactorySource.includes(token)) {
      fail(`backgroundKernelZenProfileGenerationFactory.js must not import the mutable Zen lineage/render model graph (${token}).`);
    }
  });

  const profileAdmissionIndex = trackingServiceBootstrapSource.indexOf(
    'const profileMutationLifecycle = await waitForProfileMutationAdmission();',
  );
  const zenProfileGenerationIndex = trackingServiceBootstrapSource.indexOf(
    'await initializeZenProfileGeneration({',
  );
  const profileGenerationSettlementIndex = trackingServiceBootstrapSource.indexOf(
    'reportProfileGenerationBootSettled({',
  );
  const firstMutableBootstrapOwnerIndex = trackingServiceBootstrapSource.indexOf(
    "label: 'stats_runtime_health_init'",
  );
  if (
    profileAdmissionIndex < 0
    || zenProfileGenerationIndex <= profileAdmissionIndex
    || profileGenerationSettlementIndex <= zenProfileGenerationIndex
    || firstMutableBootstrapOwnerIndex <= profileGenerationSettlementIndex
  ) {
    fail('trackingServiceBootstrap.js must initialize the admitted Zen profile generation before any mutable bootstrap owner.');
  }
  if (trackingServiceBootstrapSource.includes('resolveProfileResetGeneration')) {
    fail('trackingServiceBootstrap.js must pass the admitted lifecycle through without interpreting storage generation semantics.');
  }
  [
    'assertProfileGenerationInitialized',
    'await assertWriteAdmission({ expectedResetId: requiredProfileGeneration })',
    'BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_EPOCH_MISMATCH',
  ].forEach((token) => {
    if (!zenProfileGenerationReadinessSource.includes(token)) {
      fail(`backgroundKernelZenProfileGenerationReadiness.js must prove exact lifecycle and ModelState generation readiness (${token}).`);
    }
  });
  [
    'MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS',
    'isTrustedExtensionPageSender(sender)',
    'expectedProfileGeneration: profileGeneration',
    'PROFILE_GENERATION_READINESS_RESULT_MISMATCH',
  ].forEach((token) => {
    if (!profileGenerationMessageRoutesSource.includes(token)) {
      fail(`profileGenerationMessageRoutes.js must expose the trusted exact-generation readiness handshake (${token}).`);
    }
  });
  const dashboardBootReadActions = backgroundMessageRouterSource.match(
    /const DASHBOARD_BOOT_READ_ACTIONS = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1] || '';
  const profileGenerationSettlementActions = backgroundMessageRouterSource.match(
    /const PROFILE_GENERATION_BOOT_SETTLEMENT_ACTIONS = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1] || '';
  if (!dashboardBootReadActions.includes('MESSAGE_ACTIONS.GET_SETTINGS')) {
    fail('GET_SETTINGS must wait on the settings-hydrated Dashboard boot-read milestone, not full startup catch-up.');
  }
  if (profileGenerationSettlementActions.includes('MESSAGE_ACTIONS.GET_SETTINGS')) {
    fail('GET_SETTINGS must retain settings hydration readiness instead of using only profile-generation settlement.');
  }
  if (dashboardBootReadActions.includes('GET_PROFILE_GENERATION_READINESS')) {
    fail('GET_PROFILE_GENERATION_READINESS must not depend on broad Dashboard boot readiness.');
  }
  if (!profileGenerationSettlementActions.includes('GET_PROFILE_GENERATION_READINESS')) {
    fail('GET_PROFILE_GENERATION_READINESS must wait on the dedicated profile-generation boot settlement barrier.');
  }
  const expectedProfileSettlementActions = [
    'GET_PROFILE_GENERATION_READINESS', 'INTERVENTION_ADMISSION',
    'ISSUE_NUDGE_FRAME_HOST_CAPABILITY', 'CONSUME_NUDGE_FRAME_HOST_CAPABILITY',
  ];
  const actualProfileSettlementActions = Array.from(
    profileGenerationSettlementActions.matchAll(/MESSAGE_ACTIONS\.(\w+)/g),
    match => match[1],
  );
  if (actualProfileSettlementActions.length !== expectedProfileSettlementActions.length
    || expectedProfileSettlementActions.some(action => !actualProfileSettlementActions.includes(action))) {
    fail('Profile boot settlement must own only the declared readiness/admission and two child frame-capability actions.');
  }
  for (const action of expectedProfileSettlementActions.slice(2)) {
    if (dashboardBootReadActions.includes(action)) {
      fail(`${action} must retain exact profile-generation settlement and captured admission, not settings boot readiness.`);
    }
  }

  if (!source.includes('export function createBackgroundAppKernel()')) {
    fail(`${kernelPath} must export createBackgroundAppKernel().`);
  }

  if (!source.includes('export function getBackgroundAppKernel()')) {
    fail(`${kernelPath} must export getBackgroundAppKernel().`);
  }

  if (!source.includes('export function startBackgroundAppKernel()')) {
    fail(`${kernelPath} must export startBackgroundAppKernel().`);
  }

  [
    'settingsService.setTrackingPolicyMutationOwner(createTrackingPolicyMutationOwner({',
    'runStatsMutationBatch: statsRuntimeService.runStatsMutationBatch',
    'sealActiveSegment: tabTimeTracker.recordActiveTabDuration',
    'primeActiveTrackingBoundary: tabTimeTracker.primeActiveTrackingBoundary',
  ].forEach((token) => {
    if (!source.includes(token)) {
      fail(`${kernelPath} must bind settings policy transitions to the existing Stats FIFO and foreground boundary owners: ${token}`);
    }
  });

  [
    'installBackgroundServiceWorkerWakeTelemetry()',
    'observeBackgroundRuntimeMessageHandler({',
    'telemetry: serviceWorkerWakeTelemetry',
  ].forEach((token) => {
    if (!source.includes(token)) {
      fail(`${kernelPath} must retain bounded service-worker wake observation: ${token}`);
    }
  });
  [
    "import { MESSAGE_ACTIONS, MESSAGE_TYPES }",
    'const DEFAULT_MESSAGE_LIMIT = 12',
    'const SLOW_RESPONSE_THRESHOLD_MS = 1_000',
    'const SAFE_RUNTIME_ROUTE_PHASES = new Set([',
    'const retainedMessages = new Map()',
    'pruneRetainedMessages()',
    'retainedMessages.delete(sequence)',
    'appendBoundedRecord(recentMessages, record)',
    'appendBoundedRecord(slowMessages, record)',
    'records.length > resolvedMessageLimit',
    'recentMessages: recentMessages.map(cloneRecord)',
    'slowMessages: slowMessages.map(cloneRecord)',
    'routePhases: { ...record.routePhases }',
    'SAFE_RUNTIME_ROUTE_PHASES.has(phase)',
    'BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_INVALID',
    'BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_FAILED',
    'routePhaseError: null',
    'telemetry.markRuntimeMessagePhaseFailure(sequence)',
    'MESSAGE_TYPES.CONTENT_FLOW_SIGNAL',
    'handler(message, sender, observedSendResponse, reportRoutePhase)',
    'readiness_started',
    'readiness_settled',
    'capture_started',
    'capture_settled',
    'acquire_started',
    'acquire_settled',
    'handler_started',
    'handler_returned',
    'resolvedMessageLimit > 32',
    'globalThis.crypto.getRandomValues(words)',
    "padStart(8, '0')",
    '/^sw_[0-9a-f]{16}$/',
    "Object.defineProperty(globalThis, '__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__'",
    'enumerable: false',
    'writable: false',
    'value: Object.freeze({ snapshot: telemetry.snapshot })',
    "return 'OTHER_ACTION'",
    "'TYPED_MESSAGE'",
    "'UNTYPED_MESSAGE'",
    'const SAFE_RUNTIME_ERROR_CODES = new Set([',
    'SAFE_RUNTIME_ERROR_CODES.has(error)',
  ].forEach((token) => {
    if (!serviceWorkerWakeTelemetrySource.includes(token)) {
      fail(`BackgroundServiceWorkerWakeTelemetry must retain bounded public contract token: ${token}`);
    }
  });
  const approvedWakeRoutePhases = [
    'readiness_started', 'readiness_settled', 'capture_started', 'capture_settled',
    'acquire_started', 'acquire_settled', 'handler_started', 'handler_returned',
  ];
  const wakeRoutePhaseDeclaration = serviceWorkerWakeTelemetrySource.match(
    /const SAFE_RUNTIME_ROUTE_PHASES = new Set\(\[([\s\S]*?)\]\);/u,
  );
  const declaredWakeRoutePhases = wakeRoutePhaseDeclaration
    ? Array.from(wakeRoutePhaseDeclaration[1].matchAll(/'([^']+)'/gu), ([, phase]) => phase)
    : [];
  if (
    JSON.stringify(declaredWakeRoutePhases) !== JSON.stringify(approvedWakeRoutePhases)
    || wakeRoutePhaseDeclaration[1].replaceAll(/'[^']+'|[\s,]/gu, '') !== ''
  ) {
    fail('BackgroundServiceWorkerWakeTelemetry route phases must stay on the exact closed static allowlist.');
  }
  [
    'Math.random(',
    'crypto.randomUUID?.(',
    'chrome.storage',
    'localStorage',
    'sessionStorage',
    'fetch(',
    'XMLHttpRequest',
    'sendBeacon(',
  ].forEach((token) => {
    if (serviceWorkerWakeTelemetrySource.includes(token)) {
      fail(`BackgroundServiceWorkerWakeTelemetry must not gain fallback, persistence, or network ownership: ${token}`);
    }
  });
  [
    'bootstrap_started',
    'sync_listeners_ready',
    'profile_generation_boot_settled',
    'dashboard_boot_read_ready',
    'full_init_ready',
    'full_init_failed',
  ].forEach((token) => {
    if (!backgroundBootstrapCoordinatorSource.includes(token)) {
      fail(`BackgroundBootstrapCoordinator missing wake milestone: ${token}`);
    }
  });
  [
    'exposes only approved snapshot fields and canonical action ids',
    "error: 'PRIVATE.EXAMPLE'",
    "not.toContain('PRIVATE.EXAMPLE')",
    "not.toContain('private.example')",
    "not.toContain('secret')",
    "toEqual([\n        'snapshot',\n      ])",
    "toBe('sw_000000010000002a')",
    'preserves the first twelve while recent and slow warm responses evict in bounded order',
    'retains slow completion order separately and drops evicted pending observations',
    'accepts only closed route-phase names and preserves their first epochs',
    'records a closed bounded phase failure without exposing diagnostic error text',
  ].forEach((token) => {
    if (!serviceWorkerWakeTelemetryTestSource.includes(token)) {
      fail(`wake telemetry privacy/public-surface test contract missing: ${token}`);
    }
  });
  [
    'Bounded Service-Worker Wake Diagnostics',
    '__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__.snapshot()',
    'sender, payload, URL, settings value',
    '20개 이상의 실패 없는 non-pausing sample',
    '`recentMessages`',
    '`slowMessages`',
    '`routePhases`',
    '`readiness_started`',
    '`readiness_settled`',
    '`capture_started`',
    '`capture_settled`',
    '`acquire_started`',
    '`acquire_settled`',
    '`handler_started`',
    '`handler_returned`',
    'BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_FAILED',
  ].forEach((token) => {
    if (!backgroundRuntimeOwnersDoc.includes(token)) {
      fail(`background runtime Active doc missing wake telemetry boundary: ${token}`);
    }
  });
  [
    'A supplied diagnostic callback must',
    'be nonthrowing',
    'eviction of that record from all retained lists or worker',
    'same owner; there is no alternate clock, persistence or route authority',
  ].forEach((token) => {
    if (!backgroundRuntimeOwnersDoc.includes(token)) {
      fail(`wake diagnostic failure seam must retain its explicit lifetime/nonthrowing boundary: ${token}`);
    }
  });

  if (/export\s+const\s+backgroundAppKernel\b/u.test(source)) {
    fail(`${kernelPath} must not eagerly export a module-scope kernel instance.`);
  }

  if (
    !source.includes('BACKGROUND_KERNEL_CONTENT_SCRIPT_SYNC_BRIDGE_UNINITIALIZED')
    || !source.includes('BACKGROUND_KERNEL_PROTECTION_NUDGE_STOP_BRIDGE_UNINITIALIZED')
    || !source.includes('BACKGROUND_KERNEL_NUDGE_TERMINAL_OUTBOX_BRIDGE_UNINITIALIZED')
    || !source.includes('BACKGROUND_KERNEL_BOOTSTRAP_COORDINATOR_UNINITIALIZED')
    || !source.includes('getDashboardBootReadinessPromiseThroughBridge')
  ) {
    fail(`${kernelPath} must fail loudly if composition-root bridges are called before wiring completes.`);
  }

  [
    'syncManagedContentScriptsBridge = async () => null',
    'backgroundBootstrapCoordinator?.getInitPromise?.() ?? null',
    'backgroundBootstrapCoordinator?.getDashboardBootReadinessPromise?.() ?? null',
    'getBackgroundBootstrapCoordinator: () => backgroundBootstrapCoordinator',
  ].forEach((token) => {
    if (source.includes(token)) {
      fail(`${kernelPath} must not hide uninitialized composition-root bridges behind no-op defaults: ${token}`);
    }
  });

  [
    'BACKGROUND_KERNEL_TRACKING_LAST_TRACKED_BRIDGE_UNINITIALIZED',
    'setTrackingLastTrackedAtBridge',
  ].forEach((token) => {
    if (source.includes(token)) {
      fail(`${kernelPath} must not revive the retired last-tracked checkpoint bridge: ${token}`);
    }
  });

  const factoryToken = 'export function createBackgroundAppKernel()';
  const factoryIndex = source.indexOf(factoryToken);
  if (factoryIndex < 0) {
    fail(`${kernelPath} must define createBackgroundAppKernel().`);
  }

  const preamble = source.slice(0, factoryIndex);
  if (/\.getInstance\(\)/u.test(preamble)) {
    fail(`${kernelPath} must not instantiate stores/services before createBackgroundAppKernel().`);
  }

  if (/configureTabTimeTracker\(/u.test(preamble)) {
    fail(`${kernelPath} must not configure TabTimeTracker at module scope.`);
  }

  for (const helperImport of helperImports) {
    if (!source.includes(helperImport)) {
      fail(`${kernelPath} must import ${helperImport} to keep helper logic out of the composition root.`);
    }
  }

  if (!bootstrapBindingsSource.includes("./backgroundKernelBrowserEventBindings.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelBootstrapBindings.js must import backgroundKernelBrowserEventBindings.js for browser event ports.');
  }
  if (!bootstrapBindingsSource.includes('profileMutationRuntimeGate')) {
    fail('backgroundKernelBootstrapBindings.js must wire the shared profile mutation runtime admission gate.');
  }
  if (!bootstrapBindingsSource.includes('initializeZenProfileGeneration')) {
    fail('backgroundKernelBootstrapBindings.js must wire the sole Zen profile generation bootstrap owner.');
  }
  [
    'createBackgroundKernelZenProfileGenerationInitializer({',
    'modelStateRepository,',
    'profileResetLifecycleRepository,',
    'profileMutationRuntimeGate,',
    'initializeZenProfileGeneration,',
  ].forEach((token) => {
    if (!source.includes(token)) {
      fail(`${kernelPath} must compose and wire the sole Zen profile generation bootstrap owner (${token}).`);
    }
  });
  if (!browserEventBindingsSource.includes('chromeApi?.tabs?.onReplaced, handleTabReplaced')) {
    fail('backgroundKernelBrowserEventBindings.js must register tabs.onReplaced with the canonical tracking handler.');
  }
  if (!browserEventBindingsSource.includes('./backgroundKernelBrowserEventListener.js')) {
    fail('backgroundKernelBrowserEventBindings.js must delegate ordinary event rejection observation to backgroundKernelBrowserEventListener.js.');
  }
  if (!browserEventBindingsSource.includes('runtimeOnMessageAddListener(combinedMessageHandler)')) {
    fail('backgroundKernelBrowserEventBindings.js must preserve the dedicated runtime.onMessage response contract.');
  }
  [
    'addExtensionListener(event, function observedBrowserEventListener',
    'listener.apply(this, args)',
    'Promise.resolve(result).catch',
    "event: 'listener_rejected'",
    "code: 'BACKGROUND_BROWSER_EVENT_LISTENER_REJECTED'",
    "event: 'listener_thrown'",
    "code: 'BACKGROUND_BROWSER_EVENT_LISTENER_THROWN'",
    './backgroundBrowserEventFailureFields.js',
    'createBrowserEventFailureFields(label, error)',
    'reportRuntimeDiagnostic({',
    'throw error',
  ].forEach((token) => {
    if (!browserEventListenerSource.includes(token)) {
      fail(`backgroundKernelBrowserEventListener.js must preserve observed fail-loud listener behavior: ${token}`);
    }
  });
  [
    "typeof error?.reason === 'string'",
    "typeof error?.phase === 'string'",
    'Number.isSafeInteger(error?.tabId)',
    'Number.isSafeInteger(error?.invalidationTag)',
  ].forEach((token) => {
    if (!browserEventFailureFieldsSource.includes(token)) {
      fail(`backgroundBrowserEventFailureFields.js must project bounded lifecycle context: ${token}`);
    }
  });

  if (!protectionDispatcherBindingsSource.includes("./backgroundKernelProtectionBrowserPort.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelProtectionDispatcherBindings.js must import backgroundKernelProtectionBrowserPort.js for protection browser ports.');
  }
  if (!protectionBrowserPortSource.includes("./backgroundKernelPermissionBrowserPort.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js must delegate permission API normalization to backgroundKernelPermissionBrowserPort.js.');
  }
  if (!protectionBrowserPortSource.includes("./backgroundKernelProtectionTabsQuery.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js must delegate strict tabs query validation to backgroundKernelProtectionTabsQuery.js.');
  }
  if (
    !/tabsSendMessage:\s*async\s*\(tabId,\s*message,\s*options\s*=\s*undefined(?:,|\))/.test(protectionBrowserPortSource)
    || !protectionBrowserPortSource.includes('args.push(options)')
    || !protectionBrowserPortSource.includes('INTERVENTION_CONTROL_PROBE_TIMEOUT')
  ) {
    fail('src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js must forward exact document message targets.');
  }
  if (/\b(?:getStatsCache|loadStatsCache)\b/.test(protectionDispatcherBindingsSource)
    || /\b(?:getStatsCache|loadStatsCache)\b/.test(protectionNudgeDispatchGateSource)) {
    fail('Protection dispatch must consume the canonical runtime activity-day projection, not restore a second stats-cache reader.');
  }
  [
    'PROTECTION_TABS_QUERY_UNAVAILABLE',
    'PROTECTION_TABS_QUERY_FAILED',
    'PROTECTION_TABS_QUERY_RESULT_INVALID',
    'TAB_ENTRY_NOT_PLAIN_OBJECT',
    'TAB_ID_INVALID',
    'Number.isInteger(tab.id)',
    'tab.id < 0',
  ].forEach((token) => {
    if (!protectionTabsQuerySource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelProtectionTabsQuery.js must preserve strict tab-target contract token ${token}.`);
    }
  });
  [
    'permissionsContains: (request = {}) => callChromeCallbackApi',
    'permissionsRequest: (request = {}) => callChromeCallbackApi',
    'permissionsContains: (request = {}) => callExtensionCallbackApi',
    'permissionsRequest: (request = {}) => callExtensionCallbackApi',
  ].forEach((token) => {
    if (protectionBrowserPortSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js must not hide permission API failures behind loose callback fallback token ${token}.`);
    }
  });

  if (!trackingBrowserBindingsSource.includes("./backgroundKernelTrackingBrowserPort.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelTrackingBrowserBindings.js must import backgroundKernelTrackingBrowserPort.js for tracking browser ports.');
  }
  if (trackingBrowserBindingsSource.includes('statsRuntimeHealthLedger = null')) {
    fail('src/apps/background/services/runtime/backgroundKernelTrackingBrowserBindings.js must pass the stats runtime health ledger explicitly.');
  }

  const trackingRuntimeBindingsCall = source.match(
    /createBackgroundKernelTrackingRuntimeBindings\(\{([\s\S]*?)\n  \}\);/u,
  );
  if (
    !trackingRuntimeBindingsCall
    || !/\bruntimeSessionRepository\s*,/u.test(trackingRuntimeBindingsCall[1])
  ) {
    fail('src/apps/background/services/runtime/BackgroundAppKernel.js must inject runtimeSessionRepository into tracking runtime bindings.');
  }

  if (!coreServicesSource.includes("./backgroundKernelNotificationBrowserPort.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must import backgroundKernelNotificationBrowserPort.js for notification browser ports.');
  }

  if (!coreServicesSource.includes("./backgroundKernelRuntimeMessageBrowserPort.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must import backgroundKernelRuntimeMessageBrowserPort.js for runtime message/worker ports.');
  }

  if (!coreServicesSource.includes("./backgroundKernelNotificationClickAction.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must import backgroundKernelNotificationClickAction.js for notification click routing.');
  }

  if (!coreServicesSource.includes("@/platform/browser/faviconFetch.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must import the canonical platform favicon fetch seam.');
  }

  const faviconServiceCall = coreServicesSource.match(
    /createFaviconService\(\{([\s\S]*?)\n  \}\);/u,
  );
  if (!faviconServiceCall || !/\bfetchFaviconDataUrl\s*,/u.test(faviconServiceCall[1])) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must inject the platform favicon fetch port into FaviconService.');
  }
  if (/\bcanFetchFaviconUrl\s*:/u.test(faviconServiceCall?.[1] || '')) {
    fail('Favicon capture is local-cache-only and must not reintroduce a remote host-permission fetch path.');
  }

  if (!coreServicesSource.includes('now: () => Date.now(),')) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must inject a notification service clock owner explicitly.');
  }

  if (!coreServicesSource.includes('BACKGROUND_CORE_SERVICES_CONTENT_SCRIPT_SYNC_REQUIRED')) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must require the content-script sync bridge explicitly.');
  }

  if (coreServicesSource.includes('syncManagedContentScripts = async () => null')) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must not default content-script sync to a no-op fallback.');
  }

  if (!lazyHistoryIntegrationsSource.includes("./backgroundKernelHistoryBrowserPort.js")) {
    fail('src/apps/background/services/runtime/backgroundKernelLazyHistoryIntegrations.js must import backgroundKernelHistoryBrowserPort.js for history/bookmark browser ports.');
  }

  for (const forbiddenImportToken of forbiddenImportTokens) {
    if (source.includes(forbiddenImportToken)) {
      fail(`${kernelPath} must not directly import ${forbiddenImportToken}; route it through a backgroundKernel* helper.`);
    }
  }

  for (const helperToken of forbiddenHelperDefinitions) {
    if (source.includes(helperToken)) {
      fail(`${kernelPath} must not define ${helperToken.replace('function ', '').replace('(', '()')} inline.`);
    }
  }

  for (const filePath of trackingBackgroundFiles) {
    const relativeFilePath = path.relative(rootDir, filePath);
    const fileSource = await fs.readFile(filePath, 'utf8');
    if (/\bchrome\./u.test(fileSource) || /typeof\s+chrome/u.test(fileSource) || /globalThis\.chrome/u.test(fileSource)) {
      fail(`${relativeFilePath} must receive browser ports instead of using chrome directly.`);
    }
  }

  for (const filePath of behaviorFiles) {
    const relativeFilePath = path.relative(rootDir, filePath);
    const fileSource = await fs.readFile(filePath, 'utf8');
    if (/\bchrome\./u.test(fileSource) || /typeof\s+chrome/u.test(fileSource) || /globalThis\.chrome/u.test(fileSource)) {
      fail(`${relativeFilePath} must receive browser ports instead of using chrome directly.`);
    }
  }

  if (/\bchrome\./u.test(bootstrapSource)) {
    fail('src/domains/tracking/background/trackingServiceBootstrap.js must receive browser event/read ports instead of using chrome.* directly.');
  }

  if (bootstrapSource.includes('runtimeOnMessageAddListener')) {
    fail('src/domains/tracking/background/trackingServiceBootstrap.js must not register runtime messages directly.');
  }

  const profileMutationIngressContracts = [
    {
      path: 'src/apps/background/services/runtime/BackgroundAppKernel.js',
      source,
      requiredTokens: [
        'configureCLSEProfileMutationRuntimeAdmission({',
        'captureAdmission: profileMutationRuntimeGate.capture.bind(profileMutationRuntimeGate)',
        'runCapturedTask: profileMutationRuntimeGate.runCaptured.bind(profileMutationRuntimeGate)',
      ],
    },
    {
      path: 'src/domains/behavior/CLSEServiceClient.js',
      source: clseServiceClientSource,
      requiredTokens: [
        'createCLSEProfileMutationRuntimeAdmission({',
        'captureAdmission,',
        'runCapturedTask,',
        'loadedCLSEService.configureCLSEProfileMutationRuntimeAdmission(',
      ],
    },
    {
      path: 'src/domains/behavior/clseProfileMutationRuntimeAdmission.js',
      source: clseProfileMutationAdmissionSource,
      requiredTokens: [
        'const admissionPromise = admissionOwner.captureAdmission({ label });',
        'admissionOwner.runCapturedTask({ admission, task: admittedTask })',
        'CLSE_PROFILE_MUTATION_RUNTIME_ADMISSION_REQUIRED',
        'export function runCLSEProfileMutationMessageIngress(',
        'responseOwner(response);',
        "reason: 'profile_mutation_admission_rejected'",
        "reason: 'collector_task_failed'",
        "reason: 'response_commit_failed'",
        'CLSE_PROFILE_MUTATION_RUNTIME_ADMISSION_FAILED',
        'CLSE_PROFILE_MUTATION_RUNTIME_TASK_FAILED',
        'CLSE_PROFILE_MUTATION_RUNTIME_RESPONSE_COMMIT_FAILED',
        'return true;',
      ],
    },
    {
      path: 'src/domains/behavior/CLSEService.js',
      source: clseServiceSource,
      requiredTokens: [
        "label: 'clse_heartbeat_alarm'",
        'task: () => enqueueCLSERuntimeStorageWork(() => handleHeartbeat(now))',
        'profileMutationRuntimeAdmission: requireCLSEProfileMutationRuntimeAdmission(',
      ],
    },
    {
      path: 'src/domains/behavior/collectors/index.js',
      source: clseCollectorIndexSource,
      requiredTokens: [
        'const profileMutationRuntimeAdmission = options.profileMutationRuntimeAdmission;',
        'profileMutationRuntimeAdmission,',
      ],
    },
    {
      path: 'src/domains/behavior/collectors/ActivityCollector.js',
      source: clseCollectorSources['ActivityCollector.js'],
      requiredTokens: [
        "'clse_activity_idle_state_changed'",
        "'clse_activity_window_focus_changed'",
        "label: 'clse_activity_heartbeat_settle'",
        "label: 'clse_activity_initial_state'",
        'this._mutationTail',
        'runCLSEProfileMutationIngress(',
      ],
    },
    {
      path: 'src/domains/behavior/collectors/TabCollector.js',
      source: clseCollectorSources['TabCollector.js'],
      requiredTokens: [
        "'clse_tab_activated'",
        "'clse_tab_created'",
        "'clse_tab_removed'",
        "'clse_tab_window_focus_changed'",
        'runCLSEProfileMutationIngress(',
      ],
    },
    {
      path: 'src/domains/behavior/collectors/NavCollector.js',
      source: clseCollectorSources['NavCollector.js'],
      requiredTokens: [
        "'clse_navigation_completed'",
        "'clse_navigation_history_state_updated'",
        "'clse_navigation_committed'",
        'await this._notifyNavigation(details.url);',
        'runCLSEProfileMutationIngress(',
      ],
    },
    ...[
      ['ContentCollector.js', 'clse_content_runtime_message'],
      ['MediaCollector.js', 'clse_media_runtime_message'],
      ['ScrollCollector.js', 'clse_scroll_runtime_message'],
    ].map(([fileName, admissionLabel]) => ({
      path: `src/domains/behavior/collectors/${fileName}`,
      source: clseCollectorSources[fileName],
      requiredTokens: [
        `label: '${admissionLabel}'`,
        'runCLSEProfileMutationMessageIngress(',
        'sendResponse,',
      ],
    })),
  ];

  const bestEffortDiagnosticContracts = [
    {
      path: 'src/apps/background/services/runtime/backgroundKernelAdapters.js',
      source: backgroundKernelAdaptersSource,
      requiredTokens: [
        'BACKGROUND_NUDGE_DEBT_SESSION_RECONCILIATION_REQUIRED',
        'BACKGROUND_NUDGE_DEBT_SWEEP_BASE_REQUIRED',
        'BACKGROUND_NUDGE_DEBT_ABORT_TAB_BASE_REQUIRED',
        'BACKGROUND_NUDGE_DEBT_RESOLVE_BASE_REQUIRED',
        'BACKGROUND_NUDGE_DEBT_ABORT_KEY_BASE_REQUIRED',
        'BACKGROUND_HISTORY_SETTINGS_SERVICE_REQUIRED',
        'BACKGROUND_HISTORY_SETTINGS_CACHE_REQUIRED',
        'BACKGROUND_HISTORY_BLOCKED_URLS_REQUIRED',
        'BACKGROUND_HISTORY_CLEANUP_TOGGLE_REQUIRED',
        'BACKGROUND_BOOKMARK_CONCEAL_TOGGLE_REQUIRED',
        'BACKGROUND_HISTORY_SCAN_OWNER_REQUIRED',
        'BACKGROUND_HISTORY_CLEANUP_OWNER_REQUIRED',
        'BACKGROUND_HISTORY_RECENT_CLEANUP_OWNER_REQUIRED',
        'BACKGROUND_HISTORY_PREVIEW_OWNER_REQUIRED',
        'BACKGROUND_BOOKMARK_PREVIEW_OWNER_REQUIRED',
        'BACKGROUND_BOOKMARK_EXPORT_OWNER_REQUIRED',
        'BACKGROUND_BOOKMARK_SYNC_OWNER_REQUIRED',
        'BACKGROUND_HISTORY_DELETE_OWNER_REQUIRED',
        'BACKGROUND_TAB_EVAPORATION_SWEEP_OWNER_REQUIRED',
        'BACKGROUND_TAB_EVAPORATION_PROPAGATION_OWNER_REQUIRED',
        'BACKGROUND_TAB_EVAPORATION_TIMEOUT_INVALID',
        'BACKGROUND_TAB_EVAPORATION_SETTINGS_VERSION_REQUIRED',
        'BACKGROUND_TAB_EVAPORATION_SETTINGS_VERSION_INVALID',
        'hasPendingTabEvaporationSettings()',
        'getSettingsChangeVersion() === version',
      ],
    },
    {
      path: 'src/domains/tracking/background/TabEvaporationManager.js',
      source: await fs.readFile(path.resolve(rootDir, 'src/domains/tracking/background/TabEvaporationManager.js'), 'utf8'),
      requiredTokens: [
        'TAB_EVAPORATION_POLICY_FENCE_REQUIRED',
        'TAB_EVAPORATION_CHECKPOINT_OWNER_REQUIRED',
        'TAB_EVAPORATION_RESET_PENDING',
        'epoch === generation && isCurrent()',
        'await browserPort.tabsGet(tab.id)',
        'live.lastAccessed !== entry.lastAccessed',
        'await checkpointRepository.clear()',
        'TAB_EVAPORATION_SWEEP_FAILED',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingServiceBootstrap.js',
      source: bootstrapSource,
      requiredTokens: [
        'TRACKING_BOOTSTRAP_STATS_RUNTIME_HEALTH_INIT_REQUIRED',
        'TRACKING_BOOTSTRAP_DASHBOARD_BOOT_READINESS_REPORTER_REQUIRED',
        'TRACKING_BOOTSTRAP_SETTINGS_PROPAGATION_RESTORE_REQUIRED',
        'await restoreSettingsPropagation()',
        'boot_prewarm_service_init',
        'reportDashboardBootReadReady({',
        'nudge_debt_session_reconciliation',
        'nudge_pending_init_sweep',
        'notification_service_suspend_dispose',
        'tactical_log_suspend_flush',
        'event_log_suspend_flush',
        'bookmark_neutralized_ceremony',
        'recordStatsRetentionDiagnostics',
        'TRACKING_BOOTSTRAP_STATS_RETENTION_RESULT_INVALID',
        'markerReadValid',
        'cleanupResultsValid',
        'statsCleanupValid',
        'stats_retention_marker_read',
        'stats_retention_stats_cleanup',
        'stats_retention_marker_write',
        'stats_retention_cleanup_task',
        "await runPostDashboardBootStage('idle', () => setupIdleDetection());",
        'const result = await task();',
        "reportPostDashboardBootStage(stage, { phase: 'settled', failed });",
        'requireSuccess: true',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelTacticalLogs.js',
      source: tacticalLogsWrapperSource,
      requiredTokens: [
        'BACKGROUND_TACTICAL_LOGGER_REQUIRED',
        'BACKGROUND_TACTICAL_LOG_ACTIVE_TAB_OWNER_REQUIRED',
        'BACKGROUND_TACTICAL_LOG_CONTEXT_OWNER_REQUIRED',
        'BACKGROUND_TACTICAL_LOG_FILTER_SETTINGS_OWNER_REQUIRED',
        'activeTabInfo: getActiveTabInfo()',
        'readFilterSettings,',
        'requireSuccess = false',
        'TACTICAL_LOG_FLUSH_FAILED',
        'return result',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelAnalyticsBindings.js',
      source: analyticsBindingsSource,
      requiredTokens: [
        'BACKGROUND_ANALYTICS_TICK_RUNTIME_REQUIRED',
        'BACKGROUND_ANALYTICS_NUDGE_WINDOW_BLUR_REQUIRED',
        'BACKGROUND_ANALYTICS_IDLE_STATE_OWNER_REQUIRED',
        'BACKGROUND_ANALYTICS_IDLE_SETUP_REQUIRED',
        'BACKGROUND_ANALYTICS_PROFILE_MUTATION_ADMISSION_REQUIRED',
        'BACKGROUND_ANALYTICS_HISTORY_DELETE_REQUIRED',
        "'primeLoadedDayForRollover'",
        "'resolveColdStartRecoveryDate'",
        "'runStatsMutationBatch'",
        "'settlePreviousDayForRollover'",
        'statsTickRuntimeService.primeLoadedDayForRollover(context)',
        'statsTickRuntimeService.resolveColdStartRecoveryDate(context)',
        'statsTickRuntimeService.settlePreviousDayForRollover(context)',
        'setupIdleDetection(handleIdleStateChange, {',
        'statsTickRuntimeService.runStatsMutationBatch(',
        'runAdmittedTask: runProfileMutationAdmittedTask',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelBehaviorPolicy.js',
      source: behaviorPolicySource,
      requiredTokens: [
        'BACKGROUND_BEHAVIOR_POLICY_SETTINGS_CACHE_REQUIRED',
        'BACKGROUND_BEHAVIOR_POLICY_ACTIVE_HOSTNAME_OWNER_REQUIRED',
        'isPrecisionInsightsSignalEnabledForHostname(getActiveHostname(), settingsCache, signalId)',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelBehaviorBrowserPort.js',
      source: behaviorBrowserPortSource,
      requiredTokens: [
        "typeof chromeApi?.runtime?.sendMessage !== 'function'",
        'chromeApi.runtime.sendMessage(message)',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelProtectionDispatcherBindings.js',
      source: protectionDispatcherBindingsSource,
      requiredTokens: [
        "import { createProtectionDispatcher } from '../../../../domains/protection/background/ProtectionDispatcher.js';",
        'protectionDispatcher: createProtectionDispatcher({',
        'runtimeLanguageStore: runtimeLanguageRepository',
        'resolveProtectionRuntime,',
        'getGlobalCapState,',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionTabLifecycleLedger.js',
      source: protectionTabLifecycleLedgerSource,
      requiredTokens: [
        'createProtectionTabUpdatedIngressReceipt({',
        'function noteCommitted({',
        'function noteHistory({',
        'function closeTab(',
        'if (!previous.removed) return false;',
        'function isTabUpdatedCurrent(receipt)',
      ],
    },
    {
      path: 'src/domains/tracking/background/TabLifecycleEventQueue.js',
      source: tabLifecycleEventQueueSource,
      requiredTokens: [
        'const tailByTabId = new Map();',
        'function enqueue(tabIdValue, taskValue)',
        '.catch(() => undefined)',
        '.then(task)',
      ],
    },
    {
      path: 'src/domains/protection/background/ProtectionDispatcher.js',
      source: protectionDispatcherSource,
      requiredTokens: [
        'PROTECTION_DISPATCHER_SETTINGS_OWNER_REQUIRED',
        'PROTECTION_DISPATCHER_SETTINGS_CACHE_REQUIRED',
        'PROTECTION_DISPATCHER_FILTER_SETTINGS_REQUIRED',
        'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
        'PROTECTION_DISPATCHER_CONTENT_DIAGNOSTICS_OWNER_REQUIRED',
        'PROTECTION_DISPATCHER_SENTINEL_TIMELINE_OWNER_REQUIRED',
        'const ensureSettingsCache = requireProtectionDispatcherOwnerMethod(',
        'const mergeNudgeConfig = requireProtectionDispatcherOwnerMethod(',
        'const contentScriptRuntime = resolveContentScriptOrchestratorOwner(contentScriptOrchestrator);',
        'const dispatchStateLedger = createProtectionDispatchStateLedger();',
        'const dispatchSerialQueue = createProtectionDispatchSerialQueue();',
        'const gateDispatchBridge = createProtectionGateDispatchBridge({',
        'gateDispatchBridge.refreshBootstrapStrict({ hostname, runtimeSnapshot, now, themePresentation, assertCurrent })',
        'COOLING_CURVE_BOOTSTRAP_SETTINGS_SUPERSEDED',
        'buildProtectionDispatchPayload({',
        'const nudgeDispatchRunner = createProtectionNudgeDispatchRunner({',
        'function captureDispatchAdmissionContext({',
        'async function prepareContentMutationTransaction(',
        'async function runProtectionUpdateTransaction(',
        "assertDispatchTransactionCurrent(tabId, transaction, 'before_stale_retry')",
        'forceSnapshot: true',
        'contentMutationFence: nudgeMutationFence',
        "contentMutationDisposition !== 'same_document_url_overtaken'",
        "error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'",
        'async function stopAndTerminalizeNudgeTransaction(',
        'dispatchSerialQueue.closeTab(tabId, { reason });',
        'dispatchSerialQueue.evictTab(tabId, { reason });',
        'const resolvedBrowserPort = resolveProtectionDispatcherBrowserPort(browserPort);',
        'const recordContentRuntimeDiagnosticOwner = requireProtectionDispatcherOwnerMethod(',
        'const recordSentinelTimelineOwner = requireProtectionDispatcherOwnerMethod(',
        'function classifyBroadcastTargetResult',
        'function buildBroadcastSummary',
        'function requireProtectionUpdateAcknowledgement',
        'throw createProvenPreAckHistoryCancellation(error, { tabId, transaction });',
        "gatePresentation.documentDisposition === 'redirected'",
        'function validateProtectionUpdateAcknowledgement',
        'PROTECTION_UPDATE_ACK_STALE',
        'PROTECTION_UPDATE_ACK_DOCUMENT_STALE',
        'PROTECTION_UPDATE_ACK_INVALID',
        "reason: 'content_ack_invalid'",
        'result.dispatchDocumentId',
        'bindToReadyDocument: true',
        'const sendResult = requireProtectionUpdateAcknowledgement(',
        'attemptedCount: outcomes.length',
        'acknowledgedCount',
        'failedCount: failures.length',
        'success: failures.length === 0',
        'PROTECTION_NUDGE_STOP_TARGET_NOT_ACKNOWLEDGED',
        'PROTECTION_NUDGE_STOP_ACK_INVALID',
        'settings_nudge_disabled',
        'MESSAGE_TYPES.NUDGE_STOP',
        '[SETTINGS_FLOW][ProtectionDispatcher][broadcast_complete]',
        'formatBroadcastSummary(summary)',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js',
      source: protectionDispatchSerialQueueSource,
      requiredTokens: [
        'export function createProtectionDispatchSerialQueue()',
        'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_ID_INVALID',
        'PROTECTION_DISPATCH_SERIAL_QUEUE_TASK_REQUIRED',
        'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED',
        'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED',
        'const execution = state.tail.then(() => {',
        "fence.assertCurrent('dequeued')",
        'state.tail = tracked.then(() => undefined, () => undefined);',
        'function invalidateTab(',
        'function closeTab(',
        'function evictTab(',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionAudioDullingDispatchBridge.js',
      source: protectionAudioDullingDispatchBridgeSource,
      requiredTokens: [
        'PROTECTION_AUDIO_DULLING_DISPATCH_DIAGNOSTICS_REQUIRED',
        'AUDIO_DULLING_COORDINATOR_UNAVAILABLE',
        'audio_dulling_stop_failed',
        'audio_dulling_reconcile_failed',
        'audioDullingCoordinator.startArmedTab',
        'audioDullingCoordinator.getTabState',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionGateDispatchBridge.js',
      source: protectionGateDispatchBridgeSource,
      requiredTokens: [
        'PROTECTION_GATE_DISPATCH_INTERSTITIAL_OWNER_REQUIRED',
        'PROTECTION_GATE_DISPATCH_BOOTSTRAP_OWNER_REQUIRED',
        'PROTECTION_GATE_DISPATCH_THEME_READER_REQUIRED',
        'PROTECTION_GATE_DISPATCH_DIAGNOSTICS_REQUIRED',
        'PROTECTION_GATE_DISPATCH_RUNTIME_SNAPSHOT_REQUIRED',
        'PROTECTION_GATE_DISPATCH_HOSTNAME_REQUIRED',
        'PROTECTION_GATE_DISPATCH_MUTATION_FENCE_REQUIRED',
        'PROTECTION_GATE_DISPATCH_MUTATION_FENCE_MUST_BE_SYNCHRONOUS',
        'PROTECTION_GATE_DISPATCH_DOCUMENT_DISPOSITION_INVALID',
        'PROTECTION_GATE_DISPATCH_PRESENTATION_HANDLED_REQUIRED',
        'PROTECTION_GATE_DISPATCH_REDIRECT_CONTRACT_INVALID',
        'PROTECTION_GATE_DISPATCH_INLINE_PRESENTATION_RETIRED',
        'requireGateRuntimeSnapshot',
        'requireGateHostname',
        'assertGateMutationFenceCurrent',
        "'gate_bridge_before_theme_resolution'",
        "'gate_bridge_after_theme_resolution'",
        'presentForRuntimeSnapshot',
        'refreshForRuntime',
        'async function refreshBootstrapStrict({',
        'PROTECTION_GATE_DISPATCH_BOOTSTRAP_FENCE_REQUIRED',
        "assertGateMutationFenceCurrent({ assertCurrent }, 'gate_bootstrap_before_refresh')",
        'return refreshFrictionBootstrap({ hostname: resolvedHostname, runtimeSnapshot: resolvedRuntimeSnapshot,',
        'now, themePresentation, assertCurrent });',
        'resolveGatekeeperTheme(themeId)',
        'friction_bootstrap_refresh_failed',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js',
      source: protectionDispatchTransportSource,
      requiredTokens: [
        'PROTECTION_DISPATCHER_BROWSER_PORT_REQUIRED',
        'PROTECTION_DISPATCH_CONTENT_READY_RESULT_INVALID',
        'PROTECTION_DISPATCH_CONTENT_READY_FAILURE_INVALID',
        'requireContentScriptReadyResult',
        'export async function ensureProtectionDispatchTransactionReady(',
        "throwIfProtectionDispatchAborted(dispatchAbortSignal, 'transaction_before_ready')",
        "throwIfProtectionDispatchAborted(dispatchAbortSignal, 'transaction_after_ready')",
        'export async function sendMessageWithRecovery(',
        'export function normalizeTabsSendMessageResult(',
        'orchestrator.ensureContentScriptReady(tabId, {',
        'orchestrator.markTabNavigated(tabId, {',
        'forceInject: true',
        'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID',
        "createDispatchDocumentIdentityError('expected', 'document_id_invalid')",
        "createDispatchDocumentIdentityError(phase, 'document_id_invalid')",
        'export function isProvenProtectionDispatchDocumentOvertaken(error, {',
        "error?.reason === 'expected_document_mismatch'",
        "'PROTECTION_DISPATCH_ADMISSION_DOCUMENT_MISMATCH'",
        "'PROTECTION_DISPATCH_TRANSACTION_DOCUMENT_MISMATCH'",
        'rawExpected !== rawExpected.trim()',
        'rawCurrent !== rawCurrent.trim()',
        'rawExpected === rawCurrent',
        'if (expectedDocumentId !== null && expected !== expectedDocumentId) return false;',
        'if (tabId !== null && error?.tabId !== tabId) return false;',
        'requireReadyContentDocumentId',
        'bindToReadyDocument = false',
        'frameId: 0',
        'documentId: dispatchDocumentId',
        'function enforcePostSendAbort',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchPermissionGate.js',
      source: protectionDispatchPermissionGateSource,
      requiredTokens: [
        'PROTECTION_DISPATCH_PERMISSION_GATE_BROWSER_PORT_REQUIRED',
        'PROTECTION_DISPATCH_PERMISSION_GATE_DIAGNOSTICS_REQUIRED',
        'PROTECTION_DISPATCH_PERMISSION_GATE_HOSTNAME_REQUIRED',
        'PROTECTION_DISPATCH_PERMISSION_GATE_URL_REQUIRED',
        'requirePermissionHostname',
        'requirePermissionScope',
        'buildExactOriginPatternForUrl',
        'dispatch_scripting_permission_lookup_failed',
        'dispatch_host_permission_lookup_failed',
        'PROTECTION_DISPATCH_PERMISSION_CHANGED',
        'PROTECTION_DISPATCH_PERMISSION_RECEIPT_REQUIRED',
        "assertRevisionCurrent(expectedRevision, 'scripting_permission_resolved')",
        "assertRevisionCurrent(expectedRevision, 'host_permission_resolved')",
        'admittedStates.set(state, expectedRevision)',
        'origins: [scope.originPattern]',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchPayloadBuilder.js',
      source: protectionDispatchPayloadBuilderSource,
      requiredTokens: [
        'export function buildProtectionDispatchPayload(',
        'PROTECTION_DISPATCH_PAYLOAD_HOSTNAME_REQUIRED',
        'PROTECTION_DISPATCH_PAYLOAD_URL_REQUIRED',
        'PROTECTION_DISPATCH_PAYLOAD_RUNTIME_SNAPSHOT_REQUIRED',
        'PROTECTION_DISPATCH_PAYLOAD_FIELD_INVALID',
        'requireDispatchSnapshot',
        'requireEnvelopeResult',
        'type: MESSAGE_TYPES.PROTECTION_UPDATE',
        './ProtectionDispatchPolicyPayload.js',
        'buildProtectionPolicyPayload(policy)',
        'function toTraceSignature(',
        'delete next.traceId',
        'normalizeIndicatorConfig(settingsCache.indicatorConfig)',
        'normalizeDebugConfig(settingsCache.debugConfig',
        'isPrecisionInsightsEnabledForHostname(resolvedHostname, settingsCache)',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchPolicyPayload.js',
      source: protectionDispatchPolicyPayloadSource,
      requiredTokens: [
        'PROTECTION_DISPATCH_POLICY_INVALID',
        'PROTECTION_DISPATCH_POLICY_FIELD_INVALID',
        'DEFAULT_PROTECTION_POLICY_PAYLOAD',
        'readPolicyNonNegativeInteger',
        'buildProtectionPolicyPayload',
      ],
    },
    {
      path: 'src/domains/protection/protocol/contracts/envelope.js',
      source: protectionEnvelopeContractSource,
      requiredTokens: [
        'export function pickEnvelopeFromMessage(request)',
        'return isPlainObject(request.envelope) ? request.envelope : null',
        'ENVELOPE_HOSTNAME_REQUIRED',
        'ENVELOPE_DOMAIN_CLASS_REQUIRED',
        'ENVELOPE_REVISION_REQUIRED',
        'ENVELOPE_ACTIVATION_REQUIRED',
        'ENVELOPE_FEATURE_ACTIVATION_REQUIRED',
        'ENVELOPE_FEATURE_ACTIVATION_ENABLED_INVALID',
        'ENVELOPE_COMPILED_FEATURES_REQUIRED',
        'ENVELOPE_FEATURE_REVISIONS_REQUIRED',
        'ENVELOPE_PATCH_REQUIRED',
        'ENVELOPE_PATCH_ACTIVATION_ENABLED_INVALID',
        'ENVELOPE_PATCH_BASE_REVISION_REQUIRED',
        'requireHostname',
        'requireDomainClassId',
        'requireNonNegativeInteger',
        'cloneActivation',
        'cloneFeatureRevisions',
        'validateActivationFeatureEntries',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionDispatchStateLedger.js',
      source: protectionDispatchStateLedgerSource,
      requiredTokens: [
        'export function createProtectionDispatchStateLedger()',
        'PROTECTION_DISPATCH_LEDGER_TAB_ID_INVALID',
        'PROTECTION_DISPATCH_LEDGER_SIGNATURE_INVALID',
        'PROTECTION_DISPATCH_LEDGER_ENVELOPE_RESULT_INVALID',
        'PROTECTION_DISPATCH_LEDGER_ENVELOPE_REVISION_INVALID',
        'PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_INVALID',
        'PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_REVISION_MISMATCH',
        'PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_DOMAIN_CLASS_INVALID',
        'PROTECTION_DISPATCH_LEDGER_PREVIOUS_ENVELOPE_INCOMPLETE',
        'PROTECTION_DISPATCH_LEDGER_CONTEXT_INVALID',
        'PROTECTION_DISPATCH_LEDGER_CONTEXT_HOSTNAME_INVALID',
        'PROTECTION_DISPATCH_LEDGER_CONTEXT_BLOCKED_FLAG_INVALID',
        'isKnownDomainClassId',
        'requireTabId',
        'requireSignature',
        'requireEnvelopeResult',
        'requireProtectionContext',
        'function getPreviousEnvelopeInput(',
        'function commitDispatchSuccess(',
        'function noteReceiverEnvelopeRevisionFloor(',
        'function rememberContext(',
        'function resetDispatchAttempt(',
        'function resetTab(',
        'function getLastProtectionContextByTab()',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionEnvelopeBuilder.js',
      source: protectionEnvelopeBuilderSource,
      requiredTokens: [
        'PROTECTION_ENVELOPE_DECISION_INVALID',
        'PROTECTION_ENVELOPE_HOSTNAME_REQUIRED',
        'PROTECTION_ENVELOPE_DOMAIN_CLASS_INVALID',
        'PROTECTION_ENVELOPE_DECISION_ACTIVATION_FEATURES_INVALID',
        'PROTECTION_ENVELOPE_DECISION_COMPILED_INVALID',
        'PROTECTION_ENVELOPE_DECISION_FEATURE_REVISIONS_INVALID',
        'PROTECTION_ENVELOPE_DECISION_TRACE_INVALID',
        'PROTECTION_ENVELOPE_DECISION_REVISION_INVALID',
        'PROTECTION_ENVELOPE_PREVIOUS_REVISION_INVALID',
        'PROTECTION_ENVELOPE_PREVIOUS_STATE_REVISION_INVALID',
        'PROTECTION_ENVELOPE_PREVIOUS_STATE_DOMAIN_CLASS_INVALID',
        'PROTECTION_ENVELOPE_PREVIOUS_STATE_ACTIVATION_FEATURES_INVALID',
        'PROTECTION_ENVELOPE_PREVIOUS_STATE_HASHES_INVALID',
        'FEATURE_KEY_SET',
        'isKnownDomainClassId',
        'requireHostname',
        'requireActivationState',
        'requireFeatureRevisionRecord',
        'requireDecisionTrace',
        'requireEnvelopeDecision',
        'requirePreviousEnvelopeState',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js',
      source: protectionNudgeDispatchContextSource,
      requiredTokens: [
        'PROTECTION_NUDGE_CONTEXT_LANGUAGE_STORE_REQUIRED',
        'PROTECTION_NUDGE_CONTEXT_BROWSER_PORT_REQUIRED',
        'PROTECTION_NUDGE_CONTEXT_THEME_READER_REQUIRED',
        'PROTECTION_NUDGE_CONTEXT_DIAGNOSTICS_REQUIRED',
        './ProtectionDispatchPolicyPayload.js',
        'buildProtectionPolicyPayload(resolvedRuntimeSnapshot.policy ?? null)',
        'PROTECTION_NUDGE_TRIGGER_RUNTIME_SNAPSHOT_REQUIRED',
        'PROTECTION_NUDGE_TRIGGER_CONFIG_REQUIRED',
        'PROTECTION_NUDGE_RECOVERY_CONFIG_REQUIRED',
        'PROTECTION_NUDGE_RECOVERY_RUNTIME_SNAPSHOT_REQUIRED',
        'PROTECTION_NUDGE_RECOVERY_HOSTNAME_REQUIRED',
        'PROTECTION_NUDGE_RECOVERY_PROTOCOL_PROFILE_REQUIRED',
        'function resolveNudgeTriggerCandidates(runtimeSnapshot, config)',
        "if (isGoalEndEnabled(config, 'site') && policy.siteGoalMinutes > 0)",
        'PROTECTION_NUDGE_TRIGGER_ACTIVITY_DAY_REQUIRED',
        "activityDay.basis !== 'activity-day'",
        "site = { targetMs: policy.siteGoalMinutes * 60_000, source: 'site_goal', observedMs: activityDay.activeMs }",
        "const global = isGoalEndEnabled(config, 'global') && policy.globalCapLimitMs > 0",
        "{ targetMs: policy.globalCapLimitMs, source: 'global_protocol', observedMs: policy.globalCapBlockedMs }",
        'global.observedMs >= global.targetMs && site.observedMs >= site.targetMs',
        "mode: 'combined_goals', coveredScopes: ['global', 'site']",
        'return [global, site].filter(candidate => candidate !== null)',
        'requireRecoveryProtocolScope',
        "params.set('tab', 'sites')",
        "params.set('domain', hostname)",
        "params.set('recovery', recoveryAction)",
        'nudge_runtime_language_store_read_failed',
        'nudge_runtime_ui_language_read_failed',
        'browserPort.runtimeGetURL',
        'resolveNudgeThemeVariant(themeId)',
      ],
    },
    {
      path: 'src/domains/nudge/runtime/session/nudgeSessionDispatchState.js',
      source: nudgeSessionDispatchStateSource,
      requiredTokens: [
        'export async function beginNudgeRun(',
        'export async function abortNudgeRunBeforePresentation(',
        'withNudgeSessionLock(async () => {',
        "reason: 'INVALID_DISPATCH_TAB_ID'",
        "reason: 'RUN_ALREADY_BEGUN'",
        'phase: NUDGE_PENDING_PHASES.DISPATCHING',
        'hostname: resolvedHostname',
        '[NUDGE_SESSION_KEYS.PENDING]: nudgePending',
        '[NUDGE_SESSION_KEYS.LEASE]: nudgeLease',
        'pending?.runId && pending.runId !== runId',
        'lease?.runId && lease.runId !== runId',
        'if (pending && ![NUDGE_PENDING_PHASES.DISPATCHING, NUDGE_PENDING_PHASES.ENTRY_WAITING,',
        'NUDGE_PENDING_PHASES.ENTRY_CANCELLING].includes(pending.phase)) return false',
        "status: 'aborted'",
      ],
    },
    {
      path: 'src/domains/nudge/runtime/session/nudgeTerminalOutboxContract.js',
      source: nudgeTerminalOutboxContractSource,
      requiredTokens: [
        'export function buildNudgeTerminalOutboxEntry(',
        'export function resolveNudgeTerminalOutboxReplay(',
        'requiredStages',
        'completedStages',
        'attempts',
        'lastFailure',
        'NUDGE_TERMINAL_OUTBOX_OWNER_CONFLICT',
      ],
    },
    {
      path: 'src/domains/nudge/runtime/session/nudgeTerminalOutboxState.js',
      source: nudgeTerminalOutboxStateSource,
      requiredTokens: [
        'export async function readPendingNudgeTerminalOutboxEntries()',
        'export async function markNudgeTerminalOutboxStageCompleted(',
        'export async function markNudgeTerminalOutboxStageFailed(',
        'withNudgeSessionLock(async () => {',
        '[NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]',
      ],
    },
    {
      path: 'src/domains/tracking/background/nudgeManagerResolutionState.js',
      source: nudgeManagerResolutionStateSource,
      requiredTokens: [
        'buildNudgeTerminalOutboxEntry({',
        'resolveNudgeTerminalOutboxReplay(terminalOutbox[runId]',
        '[NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal',
        '[NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: pruneNudgeTerminalOutboxMap(terminalOutbox, now)',
        "outcome: 'applied'",
      ],
    },
    {
      path: 'src/domains/tracking/background/nudgeManagerAbortKeyState.js',
      source: nudgeManagerAbortKeyStateSource,
      requiredTokens: [
        'buildNudgeTerminalOutboxEntry({',
        'resolveNudgeTerminalOutboxReplay(terminalOutbox[runId]',
        '[NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal',
        '[NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: pruneNudgeTerminalOutboxMap(terminalOutbox, now)',
        "outcome: 'applied'",
      ],
    },
    {
      path: 'src/domains/tracking/background/nudgeManagerAbortTabState.js',
      source: nudgeManagerAbortTabStateSource,
      requiredTokens: [
        'buildNudgeTerminalOutboxEntry({',
        'resolveNudgeTerminalOutboxReplay(terminalOutbox[terminalRunId]',
        'NUDGE_TAB_ABORT_RUN_OWNER_CONFLICT',
        'NUDGE_TAB_ABORT_TERMINAL_OUTBOX_CONFLICT',
        'NUDGE_TAB_ABORT_HOSTNAME_OWNER_REQUIRED',
        'patch[NUDGE_SESSION_KEYS.TERMINAL] = nudgeTerminal',
        '[NUDGE_SESSION_KEYS.TERMINAL_OUTBOX] = pruneNudgeTerminalOutboxMap(',
        'pendingOutboxCount',
        'entry.tabId === normalizedTabId',
        'terminalEffectsPending: pendingOutboxCount > 0',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeTeardownCoordinator.js',
      source: protectionNudgeTeardownCoordinatorSource,
      requiredTokens: [
        'PROTECTION_NUDGE_TEARDOWN_STOP_OWNER_REQUIRED',
        'PROTECTION_NUDGE_TEARDOWN_SESSION_OWNER_REQUIRED',
        'PROTECTION_NUDGE_TEARDOWN_EFFECT_SCHEDULER_REQUIRED',
        'PROTECTION_NUDGE_TEARDOWN_EFFECT_SCHEDULE_RECEIPT_INVALID',
        'terminalization?.terminalEffectsPending === true',
        'async function stopLiveTab(',
        'async function terminalizeGoneTab(',
      ],
    },
    {
      path: 'src/domains/tracking/background/NudgeTerminalEffectCoordinator.js',
      source: nudgeTerminalEffectCoordinatorSource,
      requiredTokens: [
        'export function createNudgeTerminalEffectCoordinator(',
        'NUDGE_TERMINAL_OUTBOX_STAGES.RECOVERY_TRACKING',
        'NUDGE_TERMINAL_OUTBOX_STAGES.GLOBAL_OUTCOME',
        'NUDGE_TERMINAL_OUTBOX_STAGES.STAY_DECISION',
        'markStageCompleted',
        'markStageFailed',
        'drainPendingEffects',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingServiceBootstrap.js',
      source: trackingServiceBootstrapSource,
      requiredTokens: [
        'TRACKING_BOOTSTRAP_NUDGE_TERMINAL_OUTBOX_DRAIN_REQUIRED',
        'TRACKING_BOOTSTRAP_PROFILE_MUTATION_ADMISSION_GATE_REQUIRED',
        'TRACKING_BOOTSTRAP_ZEN_PROFILE_GENERATION_INITIALIZER_REQUIRED',
        'TRACKING_BOOTSTRAP_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED',
        'const profileMutationLifecycle = await waitForProfileMutationAdmission();',
        'lifecycle: profileMutationLifecycle',
        'background_bootstrap_detached:${label}',
        "await runPostDashboardBootStage('managed_catchup', () => runDetachedBootstrapTask({\n            label: 'managed_content_script_service_sync'",
        "label: 'favicon_startup_capture'",
        'const notificationDisposeTask = runBestEffortBootstrapTask({',
        'await Promise.all([',
        "label: 'browser_event:runtime.onSuspend'",
        "label: 'nudge_terminal_outbox_restore'",
        'task: drainNudgeTerminalOutbox',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js',
      source: protectionNudgeDispatchRunnerSource,
      requiredTokens: [
        'export function createProtectionNudgeDispatchRunner(',
        'PROTECTION_NUDGE_DISPATCH_CONTEXT_REQUIRED',
        'PROTECTION_NUDGE_DISPATCH_CONTENT_RUNTIME_REQUIRED',
        'PROTECTION_NUDGE_DISPATCH_BROWSER_PORT_REQUIRED',
        'PROTECTION_NUDGE_DISPATCH_CONFIG_RESULT_REQUIRED',
        'PROTECTION_NUDGE_DISPATCH_CONFIG_FIELD_INVALID',
        'PROTECTION_NUDGE_DISPATCH_RUNTIME_SNAPSHOT_REQUIRED',
        'PROTECTION_NUDGE_DISPATCH_RUNTIME_FIELD_INVALID',
        'PROTECTION_NUDGE_DISPATCH_SEND_RESULT_INVALID',
        'PROTECTION_NUDGE_DISPATCH_SEND_FAILURE_INVALID',
        'requireNudgeConfig',
        'requireRuntimeDispatch',
        'requireNudgeSendResult',
        'const config = requireNudgeConfig(mergeNudgeConfig(settingsCache.nudgeConfig));',
        'config.enabled !== hasEnabledGoalEnd(config)',
        'const dispatchGate = createProtectionNudgeDispatchGate({',
        'const timeline = createProtectionNudgeDispatchTimeline({',
        'dispatchGate.evaluateReadiness({',
        'dispatchGate.reserveInFlight({',
        'dispatchGate.beginDispatch({',
        'dispatchBegun = begin.dispatchBegun;',
        "mutationFence?.assertCurrent('nudge_session_begun')",
        'buildProtectionNudgeStartMessage({',
        'timeline.nudgeDispatched({',
        'requireNudgeStartAcknowledgement(',
        'sendMessageWithRecovery(',
        'isSameDocumentUrlInvalidation(error)',
        "contentMutationDisposition = 'same_document_url_overtaken'",
        'entryCancelled = !force && dispatchBegun && isExactNudgeEntryCancellation(result);',
        'await dispatchGate.abortDispatchAfterFailure({',
        "reason: entryCancelled ? 'entry_cancelled' : 'dispatch_failed'",
        'requireAbortedRun: entryCancelled',
        "recordDiagnostic('nudge_entry_cancelled', { tabId, hostname, runId });",
        "timeline.skipped('entry_cancelled', { runId });",
        "console.debug('[ProtectionNudgeDispatchRunner] Entry candidate cancelled'",
        'timeline.failedDispatch({',
        'dispatchGate.finishInFlight({ force, key });',
        'dispatchContext.resolveNudgeTriggerCandidates(runtimeSnapshot, config)',
        'PROTECTION_NUDGE_TRIGGER_CANDIDATES_INVALID',
        'await readFurinDailyReceipt()',
        'const eligible = candidates.filter(candidate => force || decideFurinDailyDelivery(dailyReceipt, {',
        'triggerTarget = eligible.find(candidate => candidate.observedMs >= candidate.targetMs)',
        "!decideFurinDailyDelivery(dailyReceipt, { dateStr, hostname, protocolScope: 'site' }).eligible",
        'delete globalOnly.episode',
        ": 'protocol_target_unavailable'",
        'timeline.skipped(reason)',
        'nudge_dispatch_detached_failed',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchGate.js',
      source: protectionNudgeDispatchGateSource,
      requiredTokens: [
        'export function createProtectionNudgeDispatchGate(',
        'PROTECTION_NUDGE_GATE_BROWSER_PORT_REQUIRED',
        'PROTECTION_NUDGE_GATE_DIAGNOSTICS_REQUIRED',
        'PROTECTION_NUDGE_GATE_TRIGGER_TARGET_INVALID',
        'PROTECTION_NUDGE_GATE_BEGIN_RESULT_INVALID',
        'PROTECTION_NUDGE_GATE_BEGIN_FAILURE_REASON_REQUIRED',
        'requireTriggerTarget',
        'requireDispatchBeginResult',
        'const dispatchInFlight = new Set();',
        'getNudgeGateState(key, { now })',
        'isForegroundTab(tabId, resolvedBrowserPort',
        'recordDiagnostic(\'nudge_foreground_tab_lookup_failed\'',
        'const observedMs = resolvedTriggerTarget.observedMs;',
        'observedMs < resolvedTriggerTarget.targetMs',
        'beginNudgeRun(key, {',
        'const aborted = await abortNudgeRunBeforePresentation(key, { runId, now, reason });',
        'if (requireAbortedRun && aborted !== true)',
        'PROTECTION_NUDGE_ENTRY_CANCEL_ABORT_UNCONFIRMED',
        'if (requireAbortedRun) throw abortError;',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchMessageBuilder.js',
      source: protectionNudgeDispatchMessageBuilderSource,
      requiredTokens: [
        'export async function buildProtectionNudgeStartMessage(',
        'PROTECTION_NUDGE_MESSAGE_TRIGGER_TARGET_INVALID',
        'requireMessageTriggerTarget',
        'deriveSentinelFlareProtocolProfile({',
        'dispatchContext.normalizeSentinelFlareDebugOverrides(',
        'dispatchContext.buildRecoveryAwareNudgeConfig({',
        'type: force ? MESSAGE_TYPES.NUDGE_DEBUG_START : MESSAGE_TYPES.NUDGE_START',
        'protocolProfile',
        'runtimeContext',
      ],
    },
    {
      path: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchTimeline.js',
      source: protectionNudgeDispatchTimelineSource,
      requiredTokens: [
        'export function createProtectionNudgeDispatchTimeline(',
        'PROTECTION_NUDGE_TIMELINE_RECORDER_REQUIRED',
        'SENTINEL_PROTOCOL_TIMELINE_SOURCES.RUNTIME',
        "route: 'nudge_dispatch'",
        'function protectionSkipped(reason)',
        'function nudgeDispatched(',
        'function failedDispatch(',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelProtectionBindings.js',
      source: protectionBindingsSource,
      requiredTokens: [
        'createGateInterventionOwnerBindings(trackingProtectionService)',
        '...gateInterventionOwners',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelProtectionServiceBindings.js',
      source: protectionServiceBindingsSource,
      requiredTokens: [
        'BACKGROUND_PROTECTION_SERVICE_NUDGE_CONFIG_OWNER_REQUIRED',
        'mergeNudgeConfig',
        'runtimeStateCoordinator: protectionRuntimeStateCoordinator,\n    mergeNudgeConfig,',
      ],
    },
    {
      path: 'src/domains/protection/background/ProtectionRuntimeInputAssembler.js',
      source: protectionRuntimeInputAssemblerSource,
      requiredTokens: [
        'PROTECTION_RUNTIME_INPUT_ASSEMBLER_NUDGE_CONFIG_OWNER_REQUIRED',
        './protectionProtocolProjection.js',
        'resolveProtectionProtocolProjection(protocolState, normalizedHostname)',
        'mergeNudgeConfig,',
      ],
    },
    {
      path: 'src/domains/protection/background/protectionProtocolProjection.js',
      source: protectionProtocolProjectionSource,
      requiredTokens: [
        'PROTECTION_PROTOCOL_PROJECTION_STATE_INVALID',
        'PROTECTION_PROTOCOL_PROJECTION_SCOPES_INVALID',
        'PROTECTION_PROTOCOL_PROJECTION_SCOPE_INVALID',
        'PROTECTION_PROTOCOL_PROJECTION_TARGET_INVALID',
        'PROTECTION_PROTOCOL_PROJECTION_BUDGET_ROLE_INVALID',
        'resolveProtectionProtocolProjection',
        'resolveProtectionProtocolScopeProjection',
        'Object.prototype.hasOwnProperty.call(scopes, normalizedHostname)',
        'PROTOCOL_TARGET_SOURCE_VALUES.has(target.targetSource)',
      ],
    },
    {
      path: 'src/domains/protection/background/ProfileResolver.js',
      source: protectionProfileResolverSource,
      requiredTokens: [
        'PROTECTION_PROFILE_NUDGE_CONFIG_OWNER_REQUIRED',
        'PROTECTION_PROFILE_RESOLVER_NUDGE_CONFIG_OWNER_REQUIRED',
        './protectionProtocolProjection.js',
        'resolveProtectionProtocolScopeProjection(protocolScope)',
        'const nudgeConfig = mergeNudgeConfig(settingsSnapshot?.nudgeConfig);',
      ],
    },
    {
      path: 'src/domains/protection/background/TrackingProtectionService.js',
      source: trackingProtectionServiceSource,
      requiredTokens: [
        'TRACKING_PROTECTION_SERVICE_NUDGE_CONFIG_OWNER_REQUIRED',
        'TRACKING_PROTECTION_RUNTIME_STATE_COORDINATOR_METHOD_REQUIRED:',
        'requireTrackingProtectionRuntimeStateCoordinator(runtimeStateCoordinator)',
        "'prepareFeedFlowSnapshot'",
        "'commitFeedFlowSnapshot'",
        "'applyGateInterventionDecision'",
        "'recordGateInterventionShown'",
        'return runtimeStateCoordinator.applyGateInterventionDecision(payload)',
        'return runtimeStateCoordinator.recordGateInterventionShown(payload)',
        'const nudgeConfig = mergeNudgeConfig(settingsSnapshot?.nudgeConfig);',
      ],
    },
    {
      path: 'src/domains/protection/background/ProtectionRuntimeInputProvider.js',
      source: protectionRuntimeInputProviderSource,
      requiredTokens: [
        'getConsumptionFlowSnapshot',
        'projectGateConsumedContexts(consumptionFlow, now)',
        'projectProtectedConsumptionContext(consumptionFlow, now)',
        'resolveProtectedHostnameScope',
        'PROTECTION_RUNTIME_INPUT_SETTINGS_CACHE_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_INPUT_STATE_COORDINATOR_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_INPUT_CLSE_QUERY_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_INPUT_RUNTIME_FLAG_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_INPUT_RUNTIME_FLAG_SESSION_INVALID',
        'PROTECTION_RUNTIME_INPUT_GLOBAL_SENTINEL_OUTCOME_INVALID',
        'PROTECTION_RUNTIME_INPUT_SPECIAL_SESSION_INVALID',
        'PROTECTION_RUNTIME_INPUT_TABS_QUERY_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_INPUT_CLSE_QUERY_FAILED',
        'PROTECTION_RUNTIME_INPUT_GLOBAL_SENTINEL_READ_FAILED',
        'requireRuntimeFlagSessionResult',
        'readNullableRuntimeFlagObject',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelGateInterventionOwnerBindings.js',
      source: gateInterventionOwnerBindingsSource,
      requiredTokens: [
        'BACKGROUND_PROTECTION_GATE_DECISION_OWNER_REQUIRED',
        'BACKGROUND_PROTECTION_GATE_SHOWN_OWNER_REQUIRED',
        'applyGateInterventionDecision',
        'recordGateInterventionShown',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/ProtectionRuntimeStateCoordinator.js',
      source: protectionRuntimeStateCoordinatorSource,
      requiredTokens: [
        'FeedFlowRuntimeStateOwner.js',
        'GateRuntimeStateOwner.js',
        'createFeedFlowRuntimeStateOwner({',
        'createGateRuntimeStateOwner({ entryApprovalRepository, returnLockRepository })',
        'sourceLimit: feedFlowSourceLimit',
        'getFeedFlowSnapshot,',
        'prepareFeedFlowSnapshot,',
        'commitFeedFlowSnapshot,',
        'noteFeedFlowTabNavigation,',
        'noteFeedFlowTabClosed,',
        'PROTECTION_AGGRESSION_SIGNAL_CACHE_INVALID',
        'createEmptyAggressionSignalCacheSnapshot',
        'requireAggressionSignalCacheSnapshot',
        'cloneAggressionSignalCacheSnapshot',
        'noteGateForegroundTab,',
        'noteGateActiveNavigation,',
        'applyGateInterventionDecision,',
      ],
    },
    {
      path: 'src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js',
      source: feedFlowRuntimeStateOwnerSource,
      requiredTokens: [
        '../../contracts/feedFlowSnapshotBridge.js',
        'const feedFlowSourceByTabId = new Map()',
        'const invalidFeedFlowDocumentIdsByTabId = new Map()',
        'PROTECTION_FEED_FLOW_SOURCE_TAB_ID_INVALID',
        'PROTECTION_FEED_FLOW_SOURCE_DOCUMENT_ID_INVALID',
        'PROTECTION_FEED_FLOW_SOURCE_DOCUMENT_CHANGED',
        'PROTECTION_FEED_FLOW_SOURCE_HOST_CHANGED',
        'PROTECTION_FEED_FLOW_DUPLICATE_REVISION_CONFLICT',
        'PROTECTION_FEED_FLOW_PREPARATION_STALE',
        'PROTECTION_FEED_FLOW_SOURCE_CAPACITY_EXCEEDED',
        'hasEquivalentFeedContentMetrics',
        'expectedOrder',
        'evictExpiredEndedFeedFlowSource',
        'prepareFeedFlowSnapshot',
        'commitFeedFlowSnapshot',
        'noteFeedFlowTabNavigation',
        'noteFeedFlowTabClosed',
      ],
    },
    {
      path: 'src/domains/protection/background/runtime/GateRuntimeStateOwner.js',
      source: gateRuntimeStateOwnerSource,
      requiredTokens: [
        'GateEntryApprovalRepository.js',
        'gateEntryApprovalPolicy.js',
        'getGateEntryApproval',
        'observeGateEntryPresence',
        '../../../../lib/timeWindow.js',
        'const gateStateByHost = new Map()',
        'let gateForegroundScope = EMPTY_GATE_FOREGROUND_SCOPE',
        'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:hostname',
        'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:entryIntent',
        'cloneGateHostState',
        'noteGateForegroundTab',
        'noteGateActiveNavigation',
        'applyGateInterventionDecision',
        'recordGateInterventionShown',
        'getGateHostSnapshot',
      ],
    },
    {
      path: 'src/domains/protection/background/runtime/FrictionBootstrapSnapshotBuilder.js',
      source: frictionBootstrapSnapshotBuilderSource,
      requiredTokens: [
        'FRICTION_BOOTSTRAP_RUNTIME_SNAPSHOT_REQUIRED',
        'FRICTION_BOOTSTRAP_HOSTNAME_REQUIRED',
        'FRICTION_BOOTSTRAP_DISPATCH_REQUIRED',
        'FRICTION_BOOTSTRAP_ENVELOPE_RESULT_REQUIRED',
        'FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID',
        'FRICTION_BOOTSTRAP_FEATURE_ENTRY_INVALID',
        'FRICTION_BOOTSTRAP_GENERATED_AT_INVALID',
        'requireBootstrapRuntimeSnapshot',
        'requireBootstrapDispatch',
        'resolveCompiledFeatures',
        'resolveEnvelopeRevision',
      ],
    },
    {
      path: 'src/domains/protection/background/runtime/FrictionBootstrapCoordinator.js',
      source: frictionBootstrapCoordinatorSource,
      requiredTokens: [
        'FRICTION_BOOTSTRAP_REPOSITORY_REQUIRED',
        'FRICTION_BOOTSTRAP_REWRITE_INTERVAL_INVALID',
        'FRICTION_BOOTSTRAP_SNAPSHOT_INVALID',
        'FRICTION_BOOTSTRAP_WRITE_RESULT_INVALID',
        'requireBootstrapSnapshot',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelActionHandlerFactory.js',
      source: backgroundKernelActionHandlerFactorySource,
      requiredTokens: [
        'BACKGROUND_ACTION_TRACKING_PROTECTION_SERVICE_REQUIRED',
        'BACKGROUND_ACTION_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
        'getProtectionRuntimeTelemetryContext',
        'submitGateInterstitialDecision',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelActionStatsBindings.js',
      source: backgroundKernelActionStatsBindingsSource,
      requiredTokens: [
        'createActionStatsQueryOwners',
        '...actionStatsQueryOwners',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelActionStatsQueryOwners.js',
      source: backgroundKernelActionStatsQueryOwnersSource,
      requiredTokens: [
        'BACKGROUND_ACTION_STATS_TAB_TIME_TRACKER_REQUIRED',
        'BACKGROUND_ACTION_STATS_FAVICON_OWNER_REQUIRED',
        'BACKGROUND_ACTION_STATS_ANALYSIS_OWNER_REQUIRED',
        'BACKGROUND_ACTION_STATS_TREND_OWNER_REQUIRED',
        'BACKGROUND_ACTION_STATS_PRECISION_RAW_OWNER_REQUIRED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/BackgroundMessageRouter.js',
      source: backgroundMessageRouterSource,
      requiredTokens: [
        'BACKGROUND_MESSAGE_ROUTER_ACTION_HANDLER_REQUIRED',
        'BACKGROUND_MESSAGE_ROUTER_INIT_PROMISE_OWNER_REQUIRED',
        'BACKGROUND_MESSAGE_ROUTER_DASHBOARD_BOOT_READINESS_OWNER_REQUIRED',
        'BACKGROUND_MESSAGE_ROUTER_PROFILE_GENERATION_BOOT_SETTLEMENT_OWNER_REQUIRED',
        'DASHBOARD_BOOT_READ_ACTIONS',
        'PROFILE_GENERATION_BOOT_SETTLEMENT_ACTIONS',
        'PROFILE_MUTATION_CONTROL_ACTIONS',
        'BACKGROUND_MESSAGE_ROUTER_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED',
        'profileMutationRuntimeGate.acquireLocal({',
        'profileMutationRuntimeGate.capture({',
        'profileMutationRuntimeGate.acquireCaptured({ admission })',
        'getProfileGenerationBootSettlementPromise()',
        'PROFILE_GENERATION_BOOT_SETTLEMENT_PROMISE_INVALID',
        'PROFILE_MUTATION_RUNTIME_ADMISSION_FAILED',
        'MESSAGE_ACTIONS.RESET_APP_DATA',
        'MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT',
        'DASHBOARD_BOOT_READINESS_PROMISE_INVALID',
        'DASHBOARD_BOOT_READINESS_FAILED',
        'SERVICE_INIT_PROMISE_INVALID',
        'SERVICE_INIT_FAILED',
        'SERVICE_NOT_HANDLED_ASYNC',
        'function handleMessage(message, sender, sendResponse, reportRoutePhase)',
        "reportRoutePhase?.('readiness_started')",
        "reportRoutePhase('readiness_settled')",
        "reportRoutePhase?.('capture_started')",
        "reportRoutePhase('capture_settled')",
        "reportRoutePhase?.('acquire_started')",
        "reportRoutePhase?.('acquire_settled')",
        "reportRoutePhase?.('handler_started')",
        "reportRoutePhase?.('handler_returned')",
      ],
    },
    {
      path: 'src/apps/background/services/runtime/messageRoutes/clseMessageRoutes.js',
      source: clseMessageRoutesSource,
      requiredTokens: [
        'CLSE_MESSAGE_ROUTE_BOOT_PREWARM_OWNER_REQUIRED',
        'CLSE_MESSAGE_ROUTE_SETTINGS_PIPELINE_OWNER_REQUIRED',
        'const handleCLSEMessage = createCLSEMessageHandler({',
        'bootPrewarmService.invalidate(`clse:${type}`)',
      ],
    },
    {
      path: 'src/domains/tracking/background/CLSEMessageHandler.js',
      source: clseMessageHandlerSource,
      requiredTokens: [
        'CLSE_SETTINGS_PIPELINE_OWNER_REQUIRED',
        'CLSE_BUCKETS_QUERY_FAILED',
        'CLSE_AGGRESSION_LOGS_QUERY_FAILED',
        'CLSE_BUCKETS_QUERY_INVALID_RESULT',
        'CLSE_AGGRESSION_LOGS_QUERY_INVALID_RESULT',
        'requireCanonicalCLSEStatusSnapshot',
        'CLSE_STATUS_RESPONSE_INVALID',
        'CLSE_EVENTS_QUERY_INVALID_RESULT',
        'CLSE_SETTINGS_COMMIT_ACK_INVALID',
        'buildCommittedCLSEStatus',
      ],
    },
    {
      path: 'src/domains/tracking/background/TacticalIntelligenceLogger.js',
      source: tacticalLoggerSource,
      requiredTokens: [
        'TACTICAL_LOG_FLUSH_IN_FLIGHT',
        'TACTICAL_BACKGROUND_CONTEXT_OWNER_REQUIRED',
        'TACTICAL_BACKGROUND_CONTEXT_INVALID',
        'totalActiveTabs: bgContext.totalTabs',
        'ok: true',
        'ok: false',
        'skipped: true',
        'skipped: false',
      ],
    },
    {
      path: 'src/domains/stats/background/collection/behaviorTelemetryRecorder.js',
      source: behaviorTelemetryRecorderSource,
      requiredTokens: [
        'BEHAVIOR_TELEMETRY_RECORD_CONTENT_FLOW_REQUIRED',
        'resolvedRecordContentFlowStats({',
        'recordContentFlowSignal',
        'recordContentFlowFromFeedSnapshot',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingBrowserEventHandlers.js',
      source: trackingBrowserEventSource,
      requiredTokens: [
        'TRACKING_BROWSER_EVENTS_INIT_PROMISE_OWNER_REQUIRED',
        'TRACKING_BROWSER_EVENTS_INIT_PROMISE_INVALID',
        'TRACKING_BROWSER_EVENTS_TAB_TIME_TRACKER_REQUIRED',
        'TRACKING_BROWSER_EVENTS_RECENT_HISTORY_CLEANUP_REQUIRED',
        'TRACKING_BROWSER_EVENTS_MEMORY_PURGE_ARTIFACT_CLEANUP_REQUIRED',
        'TRACKING_BROWSER_EVENTS_CONTENT_SCRIPT_ORCHESTRATOR_REQUIRED',
        'TRACKING_BROWSER_EVENTS_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
        'TRACKING_BROWSER_EVENTS_PROTECTION_DISPATCHER_REQUIRED',
        'TRACKING_BROWSER_EVENTS_GATE_RUNTIME_STATE_OWNER_REQUIRED',
        'TRACKING_BROWSER_EVENTS_BROWSER_PORT_REQUIRED',
        'TRACKING_BROWSER_EVENTS_SESSION_STORE_REQUIRED',
        'TRACKING_BROWSER_EVENTS_TAB_NAVIGATION_STATE_KEY_REQUIRED',
        'TRACKING_BROWSER_EVENTS_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED',
        'TRACKING_BROWSER_EVENTS_PROFILE_MUTATION_RUNTIME_CAPTURE_REQUIRED',
        'TRACKING_BROWSER_EVENTS_PROFILE_MUTATION_RUNTIME_CAPTURED_RUNNER_REQUIRED',
        'resolvedRunProfileMutationAdmittedTask({',
        'createAdmittedBrowserEventHandler',
        'warnBestEffortBrowserEventFailure',
        'TAB_ACTIVATED_FAVICON_CAPTURE_FAILED',
        'terminalizeNudgesForTab',
        'revalidateNudgesForTab',
        'function evictRemovedTabRuntimeOwners(tabId, reason)',
        'protectionDispatcher.evictTab(tabId, { reason });',
        'contentScriptOrchestrator.evictTab(tabId);',
        "evictRemovedTabRuntimeOwners(tabId, 'tab_removed')",
        "evictRemovedTabRuntimeOwners(removedTabId, 'tab_replaced')",
        'stopNudgeForTab',
        'protectionDispatcher.markTabNavigated(details?.tabId, {',
        'protectionDispatcher.markTabUrlChanged(details?.tabId, {',
        'protectionDispatcher.captureTabUpdatedIngress(',
        'protectionDispatcher.isTabUpdatedIngressCurrent(',
        'tabLifecycleEventQueue.enqueue(tabId, runAdmittedHandler)',
        'contentScriptOrchestrator.refreshTabUrl(details?.tabId, {',
        'protectionDispatcher.invalidateTabForRemoval(tabId, { reason: \'tab_removed\' })',
        'protectionDispatcher.invalidateTabForRemoval(removedTabId, { reason: \'tab_replaced\' })',
        'await protectionDispatcher.revalidateNudgesForTab(tabId, { now });',
        "reason: 'tab_removed'",
        "reason: 'tab_replaced'",
        "reason: 'tab_switch'",
        'TAB_REMOVED_GATE_SESSION_REMOVE_FAILED',
        'TAB_REMOVED_TACTICAL_LOG_FLUSH_FAILED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelTrackingRuntimeSnapshot.js',
      source: trackingRuntimeSnapshotSource,
      requiredTokens: [
        'TRACKING_RUNTIME_SNAPSHOT_TAB_TIME_TRACKER_REQUIRED',
        'TRACKING_RUNTIME_SNAPSHOT_STATS_RUNTIME_REQUIRED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelProtectionRuntimeBindings.js',
      source: protectionRuntimeBindingsSource,
      requiredTokens: [
        'BACKGROUND_PROTECTION_RUNTIME_SETTINGS_SERVICE_REQUIRED',
        'BACKGROUND_PROTECTION_RUNTIME_TAB_TIME_TRACKER_REQUIRED',
        'settingsService.getSettingsCache()',
        'tabTimeTracker.getActiveTabInfo()',
      ],
    },
    {
      path: 'src/domains/tracking/background/NudgeWindowBlurController.js',
      source: nudgeWindowBlurControllerSource,
      requiredTokens: [
        'warnNudgeWindowBlurFailure',
        'NUDGE_WINDOW_BLUR_STOP_OWNER_REQUIRED',
        'WINDOW_BLUR_NUDGE_STOP_FAILED',
        'WINDOW_BLUR_GRACE_NUDGE_STOP_FAILED',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/supportActionHandlers.js',
      source: supportActionHandlersSource,
      requiredTokens: [
        'SUPPORT_FAVICON_PAGE_CAPTURE_OWNER_REQUIRED',
        'SUPPORT_FAVICON_TAB_CAPTURE_OWNER_REQUIRED',
        'SUPPORT_BOOT_PREWARM_OWNER_REQUIRED',
        'SUPPORT_TRACKING_RUNTIME_STATE_OWNER_REQUIRED',
        'SUPPORT_FAVICON_INSPECT_OWNER_REQUIRED',
        'SUPPORT_PAGE_URL_BINDING_OWNER_REQUIRED',
        'SUPPORT_NUDGE_DISPATCH_OWNER_REQUIRED',
        'SUPPORT_SENDER_TAB_URL_OWNER_REQUIRED',
        'SUPPORT_SAVE_STATS_OWNER_REQUIRED',
        'SUPPORT_BROWSER_PORT_OWNER_REQUIRED',
        'SUPPORT_CONTENT_ORCHESTRATOR_OWNER_REQUIRED',
        'SUPPORT_SENTINEL_TIMELINE_OWNER_REQUIRED',
        'ZEN_GP_SERVICE_OWNER_REQUIRED',
        'SUPPORT_CONTENT_READY_RESULT_INVALID',
        'SUPPORT_DEBUG_CONTENT_MESSAGE_RESULT_INVALID',
        'SUPPORT_DEBUG_CONTENT_RESPONSE_INVALID',
        'requireEnsureContentReadyResult',
        'requireDebugContentMessageResult',
        'SENDER_TAB_URL_UNAVAILABLE',
        'SENDER_TAB_URL_INVALID',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessagePolicies/supportDebugPolicy.js',
      source: supportDebugPolicySource,
      requiredTokens: [
        'SENDER_TAB_URL_OWNER_REQUIRED',
        'SENDER_TAB_URL_READ_FAILED',
        'SENDER_TAB_URL_INVALID',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/statsQueryHandlers.js',
      source: statsQueryHandlersSource,
      requiredTokens: [
        'LAST_DOMAIN_URLS_OWNER_REQUIRED',
        'FAVICON_QUERY_OWNER_REQUIRED',
        'FAVICON_QUERY_INVALID_DATA_URL',
        'ANALYSIS_BOOTSTRAP_QUERY_OWNER_REQUIRED',
        'CYCLE_PROJECTION_QUERY_OWNER_REQUIRED',
        'STATUS_SNAPSHOT_QUERY_OWNER_REQUIRED',
        'SITES_SNAPSHOT_QUERY_OWNER_REQUIRED',
        'TREND_SUMMARY_QUERY_OWNER_REQUIRED',
        'DOMAIN_SERIES_QUERY_OWNER_REQUIRED',
        'PRECISION_RAW_DATA_QUERY_OWNER_REQUIRED',
        'ANALYSIS_BOOTSTRAP_QUERY_RESULT_INVALID',
        'CYCLE_PROJECTION_QUERY_RESULT_INVALID',
        'STATUS_SNAPSHOT_QUERY_RESULT_INVALID',
        'SITES_SNAPSHOT_QUERY_RESULT_INVALID',
        'TREND_SUMMARY_QUERY_RESULT_INVALID',
        'DOMAIN_SERIES_QUERY_RESULT_INVALID',
        'PRECISION_RAW_DATA_QUERY_RESULT_INVALID',
        'requireStatsQueryResultObject',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/settingsHandlers.js',
      source: settingsActionHandlersSource,
      requiredTokens: [
        'SETTINGS_WRITE_AUTH_OWNER_REQUIRED',
        'SETTINGS_READ_PAYLOAD_OWNER_REQUIRED',
        'SETTINGS_REDACTION_OWNER_REQUIRED',
        'SETTINGS_SERVICE_OWNER_REQUIRED',
        'SETTINGS_READ_OWNER_REQUIRED',
        'SETTINGS_OPERATIONAL_TIMESTAMP_OWNER_REQUIRED',
        'SETTINGS_SITE_RULE_SERVICE_REQUIRED',
        'SETTINGS_PROTECTION_PRESET_SERVICE_REQUIRED',
        'redactSettingsPayload(committedItems, { writeAcknowledgement: true })',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessagePolicies/settingsAccessPolicy.js',
      source: settingsAccessPolicySource,
      requiredTokens: [
        'SENSITIVE_SETTINGS_WRITE_ACK_KEYS',
        'writeAcknowledgement === true',
        'SENSITIVE_SETTINGS_WRITE_ACK_KEYS.has(key)',
        'SENSITIVE_SETTINGS_KEYS.has(key) && !mayAcknowledgeSubmittedSecurityValue',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js',
      source: nudgeCycleHandlersSource,
      requiredTokens: [
        'GET_CYCLE_STATE_OWNER_REQUIRED',
        'NUDGE_RUN_ID_NORMALIZER_OWNER_REQUIRED',
        'NUDGE_TERMINAL_OUTBOX_DRAIN_OWNER_REQUIRED',
        'NUDGE_TERMINAL_OUTBOX_DRAIN_RECEIPT_INVALID',
        'GET_CYCLE_STATE_INVALID',
        'GET_CYCLE_STATE_UNAVAILABLE',
        'SET_RESET_HOUR_CYCLE_STATE_INVALID',
        'ACCEPT_RESET_RECOMMENDATION_CYCLE_STATE_INVALID',
        'DISMISS_RESET_RECOMMENDATION_CYCLE_STATE_INVALID',
        'NUDGE_PRESENTED_OWNER_REQUIRED',
        'NUDGE_RESOLVED_OWNER_REQUIRED',
        'NUDGE_ABORTED_OWNER_REQUIRED',
        'SET_RESET_HOUR_OWNER_REQUIRED',
        'ACCEPT_RESET_RECOMMENDATION_OWNER_REQUIRED',
        'DISMISS_RESET_RECOMMENDATION_OWNER_REQUIRED',
        'RECOVERY_PRESENTED_TRACKING_OWNER_REQUIRED',
        'NUDGE_CYCLE_BROWSER_PORT_OWNER_REQUIRED',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/popupHandlers.js',
      source: popupHandlersSource,
      requiredTokens: [
        'POPUP_PERMISSIONS_OWNER_REQUIRED',
        'POPUP_SITE_SNAPSHOT_OWNER_REQUIRED',
        'POPUP_PERMISSIONS_SNAPSHOT_INVALID',
        'POPUP_SITE_SNAPSHOT_RESULT_INVALID',
        'POPUP_SETTINGS_SERVICE_REQUIRED',
        'POPUP_SETTINGS_CACHE_REQUIRED',
        'POPUP_SITE_RULE_SERVICE_REQUIRED',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/protectionRuntimeHandlers.js',
      source: protectionRuntimeHandlersSource,
      requiredTokens: [
        'PROTECTION_RUNTIME_SCOPE_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_SNAPSHOT_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_TELEMETRY_CONTEXT_OWNER_REQUIRED',
        'PROTECTION_RUNTIME_REFRESH_OWNER_REQUIRED',
        'FILTER_INDICATOR_SETTINGS_SERVICE_REQUIRED',
        'FILTER_INDICATOR_SETTINGS_CACHE_REQUIRED',
        'FILTER_INDICATOR_ACTIVITY_DAY_USAGE_OWNER_REQUIRED',
        'FILTER_INDICATOR_SCHEDULE_OWNER_REQUIRED',
        'FILTER_INDICATOR_STATS_CACHE_INVALID',
        'FILTER_INDICATOR_STATS_DATE_UNAVAILABLE',
        'FILTER_INDICATOR_SETTINGS_FIELD_INVALID',
        'FILTER_INDICATOR_SCHEDULE_STATE_INVALID',
        'FILTER_INDICATOR_SCHEDULE_RESTRICTION_INVALID',
        'FILTER_INDICATOR_PROTOCOL_STATE_INVALID',
        'FILTER_INDICATOR_PROTOCOL_SCOPE_INVALID',
        'FILTER_INDICATOR_PROTOCOL_TARGET_INVALID',
        'requireFilterIndicatorSettingsMinutes',
        'requireFilterIndicatorScheduleState',
        'resolveFilterIndicatorProtocolTargetMinutes',
        'GATE_INTERSTITIAL_SESSION_OWNER_REQUIRED',
        'GATE_INTERSTITIAL_DECISION_OWNER_REQUIRED',
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingMessageHandlers/storageSupportHandlers.js',
      source: storageSupportHandlersSource,
      requiredTokens: [
        'STORAGE_SUPPORT_DESTRUCTIVE_AUTH_OWNER_REQUIRED',
        'STORAGE_SUPPORT_SETTINGS_READ_OWNER_REQUIRED',
        'STORAGE_SUPPORT_CLEAR_STATS_OWNER_REQUIRED',
        'STORAGE_SUPPORT_CLEANUP_HISTORY_OWNER_REQUIRED',
        'STORAGE_SUPPORT_CONFIRM_MEMORY_PURGE_OWNER_REQUIRED',
        'STORAGE_SUPPORT_EXPORT_SNAPSHOT_OWNER_REQUIRED',
        'STORAGE_SUPPORT_EXPORT_BOOKMARKS_OWNER_REQUIRED',
        'STORAGE_SUPPORT_INSPECTOR_OWNER_REQUIRED',
        'STORAGE_SUPPORT_IMPORT_SNAPSHOT_OWNER_REQUIRED',
        'STORAGE_SUPPORT_PREVIEW_BOOKMARKS_OWNER_REQUIRED',
        'STORAGE_SUPPORT_PREVIEW_HISTORY_OWNER_REQUIRED',
        'STORAGE_SUPPORT_RESET_ANALYTICS_OWNER_REQUIRED',
        'STORAGE_SUPPORT_RESET_APP_OWNER_REQUIRED',
        'STORAGE_SUPPORT_LOAD_STATS_OWNER_REQUIRED',
        'STORAGE_SUPPORT_RUN_STATS_RESET_OWNER_REQUIRED',
        'STORAGE_SUPPORT_RUN_ACTION_OWNER_REQUIRED',
        'STORAGE_SUPPORT_TAB_TIME_TRACKER_OWNER_REQUIRED',
        'RESET_ANALYTICS_RESULT_INVALID',
        'RESET_APP_RESULT_INVALID',
        'STORAGE_SNAPSHOT_EXPORT_RESULT_INVALID',
        'STORAGE_SNAPSHOT_IMPORT_RESULT_INVALID',
        'STORAGE_INSPECTOR_SNAPSHOT_INVALID',
        'STORAGE_SUPPORT_ACTION_RESULT_INVALID',
        'STORAGE_SUPPORT_ACTION_TASK_MISMATCH',
        'requireHistorySummaryItems',
        'requireBookmarkSummaryItems',
        'CLEANUP_BLOCKED_HISTORY_ITEMS_INVALID',
        'PREVIEW_BLOCKED_HISTORY_ITEMS_INVALID',
        'PREVIEW_BLOCKED_BOOKMARKS_ITEMS_INVALID',
        'EXPORT_BLOCKED_BOOKMARKS_HTML_RESULT_INVALID',
        'EXPORT_BLOCKED_BOOKMARKS_HTML_HTML_INVALID',
        'EXPORT_BLOCKED_BOOKMARKS_HTML_FILENAME_INVALID',
        'EXPORT_BLOCKED_BOOKMARKS_HTML_COUNT_INVALID',
        'EXPORT_BLOCKED_BOOKMARKS_HTML_DOMAINS_INVALID',
        'MEMORY_PURGE_CONFIRM_VERSION_INVALID',
        'MEMORY_PURGE_CONFIRM_APPLIED_INVALID',
        'PROFILE_MUTATION_RECOVERY_CONTRACT_INVALID',
        'resolveExpectedClosedResetId',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/ProtectionRuntimeCoordinator.js',
      source: protectionRuntimeCoordinatorSource,
      requiredTokens: [
        'warnProtectionRuntimeBestEffortFailure',
        'FRICTION_BOOTSTRAP_SNAPSHOT_CLEAR_FAILED',
        'PROTECTION_RUNTIME_TELEMETRY_CONTEXT_READ_FAILED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundSettingsPropagationCoordinator.js',
      source: backgroundSettingsPropagationCoordinatorSource,
      requiredTokens: [
        'SETTINGS_PROPAGATION_STAGE_DEFINITIONS',
        'validatePropagationHandlers',
        'SETTINGS_PROPAGATION_HANDLER_REQUIRED',
        'SETTINGS_PROPAGATION_CHECKPOINT_REPOSITORY_REQUIRED',
        'SETTINGS_BROADCAST_INCOMPLETE',
        'SETTINGS_BROADCAST_SUMMARY_INVALID',
        'validateBroadcastSummary',
        'buildBoundedBroadcastDiagnostic',
        'summary.success !== true',
        'checkpointRepository.writePending',
        'checkpointRepository.writeFailed',
        'checkpointRepository.clear',
        'persistOutstandingTask',
        'SETTINGS_PROPAGATION_STAGE_CHECKPOINT_FAILED',
        'requireSettingsPropagationContext',
        'processingExecution.controller.abort',
        'pendingTask = mergeTasks(task, pendingTask, { resetNextRetries: true })',
        '[SETTINGS_FLOW][postCommit][superseded]',
        'successorCommitVersion',
        'task.appliedStages[stage.key] === true',
        'await persistOutstandingTask(task)',
        'ensureCheckpointRestored',
        'await ensureCheckpointRestored()',
        'recoverableFailedTask',
        'const outcome = await waitForTask(restoration.taskId)',
        'schedulePostCommitEffects',
        'reconcileStartupContentScripts',
        'restorePendingEffects',
        'formatPropagationDiagnostic',
        '[SETTINGS_FLOW][postCommit][retry_scheduled]',
        '[SETTINGS_FLOW][postCommit][failed_retained]',
        '[SETTINGS_FLOW][postCommit][${stage.key}_failed]',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelSettingsPropagationBindings.js',
      source: backgroundSettingsPropagationBindingsSource,
      requiredTokens: [
        'SettingsPropagationCheckpointRepository',
        'createBackgroundSettingsPropagationCoordinator',
        'checkpointRepository: new SettingsPropagationCheckpointRepository({',
        'sessionRepository: runtimeSessionRepository',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/BackgroundAppKernel.js',
      source,
      requiredTokens: [
        'schedulePostCommitSettingsEffects: settingsPropagationCoordinator.schedulePostCommitEffects',
        'waitForPostCommitSettingsTask: settingsPropagationCoordinator.waitForTask',
        'restoreSettingsPropagation: settingsPropagationCoordinator.restorePendingEffects',
        'waitForSettingsPropagationIdle: settingsPropagationCoordinator.waitForIdle',
        'reconcileStartupContentScripts: settingsPropagationCoordinator.reconcileStartupContentScripts',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelNotificationClickAction.js',
      source: backgroundNotificationClickActionSource,
      requiredTokens: [
        'BACKGROUND_NOTIFICATION_CLICK_BROWSER_PORT_METHOD_REQUIRED',
        'BACKGROUND_NOTIFICATION_CLICK_ROUTE_INVALID',
        'BACKGROUND_NOTIFICATION_CLICK_ROUTE_PARAMS_INVALID',
        'BACKGROUND_NOTIFICATION_CLICK_URL_UNAVAILABLE',
        'BACKGROUND_NOTIFICATION_CLICK_TAB_CREATE_FAILED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMemoryPurgeCoordinator.js',
      source: backgroundMemoryPurgeCoordinatorSource,
      requiredTokens: [
        'BACKGROUND_MEMORY_PURGE_CLEANUP_HISTORY_REQUIRED',
        'BACKGROUND_MEMORY_PURGE_SYNC_BOOKMARKS_REQUIRED',
        'BACKGROUND_MEMORY_PURGE_TASK_FAILED',
        'Queued task failed; continuing serialized queue',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMemoryPurgeArtifactRunner.js',
      source: backgroundMemoryPurgeArtifactRunnerSource,
      requiredTokens: [
        'MEMORY_PURGE_ARTIFACT_RUNNER_RECENT_HISTORY_CLEANUP_REQUIRED',
        'MEMORY_PURGE_ARTIFACT_RUNNER_BOOKMARK_SYNC_REQUIRED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js',
      source: backgroundMaintenanceCoordinatorSource,
      requiredTokens: [
        'BACKGROUND_MAINTENANCE_TERMINAL_SETTINGS_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_CLEAR_BOOTSTRAP_SNAPSHOTS_REQUIRED',
        'BACKGROUND_MAINTENANCE_STATS_RESET_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_TERMINAL_STATS_RESET_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_TERMINAL_TRACKING_RESET_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_STATS_FEATURE_PACK_REPOSITORY_REQUIRED',
        'BACKGROUND_MAINTENANCE_INTERVENTION_EFFECT_REPOSITORY_REQUIRED',
        'BACKGROUND_MAINTENANCE_PROGRESSION_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_EVENT_LOG_PROFILE_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_PROFILE_MUTATION_COORDINATOR_REQUIRED',
        'BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_FACTORY_REQUIRED',
        'BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_STATE_INVALID',
        'initialEntries: profileGenerationState.modelStateInitialEntries',
        'mutate: () => Promise.resolve(runTerminalTrackingReset())',
        '.then(() => runTerminalStatsReset(async () => {',
        'BACKGROUND_MAINTENANCE_DOMAIN_HASH_REPAIR_RESULT_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_RESULT_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_REMOVED_DAYS_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_STATS_CLEANUP_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_CLEANUP_RESULTS_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_MARKER_READ_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_MARKER_INVALID',
        'settingsService.runExclusiveTerminalSettingsMutation({',
        'settingsService.runExclusiveExternalSettingsMutation({',
        "actionReason: 'ensure_domain_hash_artifacts'",
        'RESET_APP_RUNTIME_SESSION_REMOVE_FAILED',
        'CLEAR_RUNTIME_SESSION_REMOVE_SESSION_FAILED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js',
      source: backgroundStorageSnapshotServiceSource,
      requiredTokens: [
        'BACKGROUND_STORAGE_SNAPSHOT_IMPORT_RESULT_INVALID',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_SETTINGS_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_STATS_RESET_OWNER_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_TRACKING_RESET_OWNER_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_CLSE_IMPORT_LIFECYCLE_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_PROFILE_MUTATION_COORDINATOR_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_ZEN_PROFILE_GENERATION_FACTORY_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_ZEN_PROFILE_GENERATION_STATE_INVALID',
        'profileMutationCoordinator.runStableRead({',
        'profileMutationCoordinator.runExclusiveMutation({',
        'settingsService.runExclusiveTerminalSettingsMutation({',
        'runCLSEStorageSnapshotImport(async () => {',
        'mutate: () => Promise.resolve(runTerminalTrackingReset())',
        '.then(() => runTerminalStatsReset(async () => {',
        'targetProfileEpoch: resetLifecycle.resetId',
        'targetProfileAggregate: profileGenerationState.profileAggregate',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageInspectorService.js',
      source: backgroundStorageInspectorServiceSource,
      requiredTokens: [
        'BACKGROUND_STORAGE_INSPECTOR_SETTINGS_REPOSITORY_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_KEY_REPOSITORY_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_SESSION_REPOSITORY_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_STATS_RUNTIME_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_TAB_TIME_TRACKER_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_LOCAL_DOCUMENTS_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_KEY_ENTRIES_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_SESSION_ENTRIES_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_INDEXEDDB_OVERVIEW_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_STATS_CACHE_REQUIRED',
        'BACKGROUND_STORAGE_INSPECTOR_JSON_SIZE_ESTIMATE_FAILED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelNotificationBrowserPort.js',
      source: notificationBrowserPortSource,
      requiredTokens: [
        'CHROME_NOTIFICATIONS_UNAVAILABLE',
        'CHROME_NOTIFICATION_ID_UNAVAILABLE',
        'notificationsCanCreate',
        'notificationsCanListen',
        'runtimeCanGetURL',
        'callExtensionCallbackApiResult',
        'addExtensionListener',
        'removeExtensionListener',
      ],
    },
    {
      path: 'src/domains/notifications/background/NotificationService.js',
      source: notificationServiceSource,
      requiredTokens: [
        'NOTIFICATION_BROWSER_PORT_METHOD_REQUIRED',
        'NOTIFICATION_ICON_URL_UNAVAILABLE',
        'NOTIFICATION_CONFIG_READER_REQUIRED',
        'NOTIFICATION_CONFIG_READY_OWNER_REQUIRED',
        'NOTIFICATION_CONFIG_RESULT_INVALID',
        'NOTIFICATION_DESCRIPTOR_INVALID',
        'NOTIFICATION_COPY_INVALID',
        'NOTIFICATION_LISTENER_API_UNAVAILABLE',
        'NOTIFICATION_CLICK_LISTENER_REGISTRATION_FAILED',
        'NOTIFICATION_CLOSE_LISTENER_REGISTRATION_FAILED',
        'NOTIFICATION_CLICK_LISTENER_ROLLBACK_FAILED',
        'NOTIFICATION_CLICK_LISTENER_REMOVAL_FAILED',
        'NOTIFICATION_CLOSE_LISTENER_REMOVAL_FAILED',
        'NOTIFICATION_CLICK_ID_INVALID',
        'NOTIFICATION_CLOSED_ID_INVALID',
        'NOTIFICATION_CLICK_CONTEXT_ROUTE_INVALID',
        'NOTIFICATION_CLICK_ACTION_RESULT_INVALID',
        'NOTIFICATION_DELIVERY_KEY_REQUIRED',
        'NOTIFICATION_CLOCK_OWNER_REQUIRED',
        'NOTIFICATION_CLOCK_RESULT_INVALID',
        'requireNotificationDescriptor',
        'requireNotificationDeliveryKey',
        'requireNotificationTimestamp',
        'requireListenerPortResult',
        'notificationsCanListen',
        'requireCanonicalNotificationsConfig',
        'NOTIFICATION_CLICK_ACTION_OWNER_REQUIRED',
        'NOTIFICATION_CAPABILITY_RESOLVER_REQUIRED',
        'NOTIFICATION_CAPABILITY_RESULT_INVALID',
        'ensureNotificationsConfigReady()',
        'requireCanonicalNotificationsConfig(',
        'getNotificationsConfig()',
      ],
    },
    {
      path: 'src/domains/schedule/background/scheduleRuntimeCoordinator.js',
      source: scheduleRuntimeCoordinatorSource,
      requiredTokens: [
        'SCHEDULE_RUNTIME_OWNER_REQUIRED', 'SCHEDULE_RUNTIME_APPLY_FAILED',
        'SCHEDULE_RUNTIME_SKIP_INVALID', 'SCHEDULE_RUNTIME_CAP_INVALID',
        'SCHEDULE_RUNTIME_OCCURRENCE_CHANGED', 'SCHEDULE_RUNTIME_NOTIFICATION_RESULT_INVALID',
        'resolveScheduleRuntimePolicy', 'requireApplyResult', 'requireScheduleRuntimeState',
        'runManualSessionMutation', 'applyScheduleRuntimeSettings',
        'const result = tail.then(task)',
        'const previous = appliedState',
        'requireApplyResult(result)',
        'schemaVersion: 2, appliedAt: now, state: next',
        'appliedState = requireScheduleRuntimeState(next)',
        'await publishState({ type: SCHEDULE_RUNTIME_CHANGED',
        "cause !== 'clock'",
        'if (!previous',
      ],
    },
    {
      path: 'src/domains/schedule/contracts/scheduleRuntimeState.js',
      source: scheduleRuntimeStateSource,
      requiredTokens: [
        'SCHEDULE_RUNTIME_RESPONSE_INVALID',
        'export function requireScheduleRuntimeState(state)',
        "['protected', 'relaxation', 'isolation'].includes(state.mode)",
        "['base', 'schedule', 'manual'].includes(state.source)",
        "typeof state.capExceeded !== 'boolean'",
        "typeof state.isolationSession?.active !== 'boolean'",
      ],
    },
    {
      path: 'src/domains/tracking/background/trackingRuntimeCoordinator.js',
      source: trackingRuntimeCoordinatorSource,
      requiredTokens: [
        'TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_SERVICE_REQUIRED',
        'TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_RESULT_INVALID',
        'TRACKING_RUNTIME_COORDINATOR_SETTINGS_SERVICE_REQUIRED',
        'TRACKING_RUNTIME_COORDINATOR_SETTINGS_CACHE_REQUIRED',
        'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_OWNER_REQUIRED',
        'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_DATE_INVALID',
        'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_STATE_INVALID',
        'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_METRIC_INVALID',
        'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_SESSION_STATE_INVALID',
        'TRACKING_RUNTIME_COORDINATOR_RUNTIME_FLAG_SESSION_INVALID',
        'createScheduleRuntimeCoordinator',
        "import { createScheduleRuntimeCoordinator } from '../../schedule/background/scheduleRuntimeCoordinator.js'",
        'applyProtection: broadcastSettingsUpdate',
        'publishState: publishScheduleRuntimeState',
        'runManualSessionMutation',
        'applyScheduleRuntimeSettings',
        'TRACKING_RUNTIME_COORDINATOR_CONTENT_SCRIPT_SYNC_OWNER_REQUIRED',
        'TRACKING_RUNTIME_COORDINATOR_PROTECTION_DISPATCHER_REQUIRED',
        'TRACKING_RUNTIME_COORDINATOR_CONTENT_SCRIPT_SYNC_RESULT_INVALID',
        'requireNotificationService',
        'requireSettingsService',
        'requireSettingsCache',
        'requireGlobalCapState',
        'requireGlobalCapMetric',
        'normalizeGlobalCapRuntimeState',
        'requireRuntimeFlagSessionResult',
        'requireContentScriptRuntimeSync',
        'requireContentScriptSyncReport',
        'dispatchNotificationEvent',
      ],
    },
    {
      path: 'src/domains/notifications/background/notificationCatalog.js',
      source: notificationCatalogSource,
      requiredTokens: [
        'NOTIFICATION_DESCRIPTOR_INVALID',
        'NOTIFICATION_DESCRIPTOR_MISSING',
        'requireNotificationDescriptor',
        'normalizeNotificationRoute',
      ],
    },
    {
      path: 'src/domains/notifications/background/notificationStateRepository.js',
      source: notificationStateRepositorySource,
      requiredTokens: [
        'NOTIFICATION_STATE_INVALID',
        'NOTIFICATION_STATE_FIELD_INVALID',
        'NOTIFICATION_STATE_CONTEXT_INVALID',
        'NOTIFICATION_STATE_CONTEXT_ROUTE_REQUIRED',
        'NOTIFICATION_STATE_CONTEXT_ROUTE_INVALID',
      ],
    },
    {
      path: 'src/domains/notifications/background/notificationPolicy.js',
      source: notificationPolicySource,
      requiredTokens: [
        'NOTIFICATION_POLICY_CONFIG_INVALID',
        'NOTIFICATION_POLICY_DESCRIPTOR_INVALID',
        'requirePolicyDescriptor',
        'requireCanonicalNotificationsConfig',
      ],
    },
  ];
  for (const { path: filePath, source: ingressSource, requiredTokens } of profileMutationIngressContracts) {
    for (const token of requiredTokens) {
      if (!ingressSource.includes(token)) {
        fail(`${filePath} missing required profile-mutation ingress token ${token}.`);
      }
    }
  }
  for (const { path: filePath, source: diagnosticSource, requiredTokens } of bestEffortDiagnosticContracts) {
    if (
      diagnosticSource.includes('.catch(() => {})')
      || diagnosticSource.includes('.catch(() => { })')
      || diagnosticSource.includes('.catch(() => null)')
    ) {
      fail(`${filePath} must report best-effort failures instead of swallowing empty catches.`);
    }
    for (const token of requiredTokens) {
      if (!diagnosticSource.includes(token)) {
        fail(`${filePath} missing required best-effort diagnostic token ${token}.`);
      }
    }
  }
  const scheduleApplyIndex = scheduleRuntimeCoordinatorSource.indexOf('requireApplyResult(result);');
  const scheduleReceiptIndex = scheduleRuntimeCoordinatorSource.indexOf(
    'await runtimeFlagRepository.set({ [STORAGE_SESSION_KEYS.SCHEDULE_STATE]',
  );
  const scheduleAppliedStateIndex = scheduleRuntimeCoordinatorSource.indexOf(
    'appliedState = requireScheduleRuntimeState(next);',
  );
  const schedulePublishIndex = scheduleRuntimeCoordinatorSource.indexOf('await publishState({ type: SCHEDULE_RUNTIME_CHANGED');
  if (!(scheduleApplyIndex >= 0
    && scheduleApplyIndex < scheduleReceiptIndex
    && scheduleReceiptIndex < scheduleAppliedStateIndex
    && scheduleAppliedStateIndex < schedulePublishIndex)) {
    fail('scheduleRuntimeCoordinator must validate dispatcher success before its receipt, applied-state admission and publication.');
  }
  const nudgeBeginReceiptIndex = protectionNudgeDispatchRunnerSource.indexOf(
    'dispatchBegun = begin.dispatchBegun;',
  );
  const nudgeBeginFenceIndex = protectionNudgeDispatchRunnerSource.indexOf(
    "mutationFence?.assertCurrent('nudge_session_begun')",
  );
  if (
    nudgeBeginReceiptIndex < 0
    || nudgeBeginFenceIndex <= nudgeBeginReceiptIndex
  ) {
    fail('ProtectionNudgeDispatchRunner must retain the exact begin receipt before a mutation fence can fail so catch cleanup owns the new session.');
  }
  const nudgeEntryCancellationShape = protectionNudgeDispatchRunnerSource.slice(
    protectionNudgeDispatchRunnerSource.indexOf('function isExactNudgeEntryCancellation(result) {'),
    protectionNudgeDispatchRunnerSource.indexOf('function isSameDocumentUrlInvalidation(error) {'),
  );
  [
    'return result.ok === false',
    'isPlainObject(response)',
    'Reflect.ownKeys(response).length === 4',
    "['ok', 'phase', 'error', 'startResult'].every((key)",
    'Object.prototype.propertyIsEnumerable.call(response, key)',
    'response.ok === false',
    "response.phase === 'rejected'",
    "response.error === 'entry_cancelled'",
    'isPlainObject(startResult)',
    'Reflect.ownKeys(startResult).length === 2',
    "['ok', 'rejectReason'].every((key)",
    'Object.prototype.propertyIsEnumerable.call(startResult, key)',
    'startResult.ok === false',
    "startResult.rejectReason === 'entry_cancelled'",
  ].forEach((token) => {
    if (!nudgeEntryCancellationShape.includes(token)) {
      fail(`ProtectionNudgeDispatchRunner must classify entry cancellation only through the exact owned negative START acknowledgement: ${token}`);
    }
  });
  const nudgeFailureSettlement = protectionNudgeDispatchRunnerSource.slice(
    protectionNudgeDispatchRunnerSource.indexOf('    } catch (e) {'),
    protectionNudgeDispatchRunnerSource.indexOf('  function triggerDetached('),
  );
  if (!/await dispatchGate\.abortDispatchAfterFailure\(\{[^}]*dispatchBegun,[^}]*key,[^}]*runId,[^}]*requireAbortedRun: entryCancelled,[^}]*\}\);\s*if \(entryCancelled\)/u.test(nudgeFailureSettlement)
    || !/\} finally \{\s*dispatchGate\.finishInFlight\(\{ force, key \}\);/u.test(nudgeFailureSettlement)) {
    fail('ProtectionNudgeDispatchRunner must await the issued-run abort before its entry-cancelled skip, and release in-flight ownership in finally even when abort fails.');
  }
  const nudgeAbortSettlement = protectionNudgeDispatchGateSource.slice(
    protectionNudgeDispatchGateSource.indexOf('  async function abortDispatchAfterFailure({'),
    protectionNudgeDispatchGateSource.indexOf('  async function markEpisodeAbsorbedAfterDispatch({'),
  );
  if (!/if \(!dispatchBegun\) return;\s*try \{\s*const aborted = await abortNudgeRunBeforePresentation\(key, \{ runId, now, reason \}\);\s*if \(requireAbortedRun && aborted !== true\) \{\s*throw new Error\('PROTECTION_NUDGE_ENTRY_CANCEL_ABORT_UNCONFIRMED'\);/u.test(nudgeAbortSettlement)
    || !/catch \(abortError\) \{[\s\S]*recordDiagnostic\('nudge_dispatch_abort_failed',[\s\S]*if \(requireAbortedRun\) throw abortError;/u.test(nudgeAbortSettlement)) {
    fail('ProtectionNudgeDispatchGate must await the exact issued-run abort receipt and propagate failed or unconfirmed normal-cancellation cleanup.');
  }
  if (protectionDispatcherSource.includes('nudgeDispatchRunner.triggerDetached')) {
    fail('ProtectionDispatcher production dispatch must await nudge completion inside the per-tab content-mutation lane.');
  }
  if (protectionDispatcherBindingsSource.includes('createLazyBackgroundProtectionDispatcher')) {
    fail('backgroundKernelProtectionDispatcherBindings must construct the canonical Dispatcher eagerly so lifecycle ingress cannot be dropped before first dispatch.');
  }
  if (!backgroundSettingsPropagationCoordinatorSource.includes(
    "console.warn(\n          `[SETTINGS_FLOW][postCommit][${stage.key}_failed]",
  )) {
    fail('BackgroundSettingsPropagationCoordinator must record retryable stage attempts as warnings.');
  }
  if (backgroundSettingsPropagationCoordinatorSource.includes(
    "console.error(\n          `[SETTINGS_FLOW][postCommit][${stage.key}_failed]",
  )) {
    fail('BackgroundSettingsPropagationCoordinator must reserve console.error for terminal retained failures.');
  }
  if (!backgroundSettingsPropagationCoordinatorSource.includes(
    "console.warn(\n        `[SETTINGS_FLOW][postCommit][checkpoint_sync_failed]",
  )) {
    fail('BackgroundSettingsPropagationCoordinator must record retryable checkpoint writes as warnings.');
  }
  if (!backgroundSettingsPropagationCoordinatorSource.includes(
    '[SETTINGS_FLOW][postCommit][checkpoint_failed_retained]',
  )) {
    fail('BackgroundSettingsPropagationCoordinator must record terminal checkpoint failures as retained errors.');
  }
  if (backgroundSettingsPropagationCoordinatorSource.includes(
    "console.error(\n        `[SETTINGS_FLOW][postCommit][checkpoint_sync_failed]",
  )) {
    fail('BackgroundSettingsPropagationCoordinator must not classify a retryable checkpoint write as an extension error.');
  }
  [
    'feedFlowSourceByTabId',
    'invalidFeedFlowDocumentIdsByTabId',
    'normalizeFeedFlowSnapshot',
    'buildFeedContentFlowDelta',
    'PROTECTION_FEED_FLOW_',
  ].forEach((token) => {
    if (protectionRuntimeStateCoordinatorSource.includes(token)) {
      fail(`ProtectionRuntimeStateCoordinator.js must delegate FeedFlow mutable state instead of owning ${token}.`);
    }
  });
  [
    'gateStateByHost',
    'consumedProtectedContexts',
    'gateForegroundScope',
    'function normalizeGateContinuityFacts',
    'function normalizeGateHostState',
    'function recordConsumedProtectedContext',
    'PROTECTION_GATE_CONTINUITY_FACTS_INVALID:',
    'PROTECTION_GATE_CONTEXT_ENTRY_INVALID:',
    'getGateProtectedContextWindowMs',
    'GATE_CONTEXT_EVENT_LIMIT',
  ].forEach((token) => {
    if (protectionRuntimeStateCoordinatorSource.includes(token)) {
      fail(`ProtectionRuntimeStateCoordinator.js must delegate Gate mutable state instead of owning ${token}.`);
    }
  });
  [
    "typeof runtimeStateCoordinator.prepareFeedFlowSnapshot !== 'function'",
    "typeof runtimeStateCoordinator.commitFeedFlowSnapshot !== 'function'",
    "typeof runtimeStateCoordinator.applyGateInterventionDecision !== 'function'",
    "typeof runtimeStateCoordinator.recordGateInterventionShown !== 'function'",
  ].forEach((token) => {
    if (trackingProtectionServiceSource.includes(token)) {
      fail(`TrackingProtectionService.js must validate the complete runtime state port at construction instead of using call-time fallback ${token}.`);
    }
  });
  [
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js',
      source: backgroundMaintenanceCoordinatorSource,
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js',
      source: backgroundStorageSnapshotServiceSource,
    },
  ].forEach(({ path: filePath, source: terminalMutationSource }) => {
    if (terminalMutationSource.includes('mutate: async () => {')) {
      fail(`${filePath} terminal settings mutation owner must enter synchronously and return its promise chain.`);
    }
  });
  [
    'applyCLSESettingsPatch = null',
    'CLSE_SETTINGS_PIPELINE_UNAVAILABLE',
    'sendResponse({ buckets60s: [], events: [] });',
    'sendResponse({ logs: [] });',
    'let handleCLSEMessage = null',
    'getHandleCLSEMessage()',
    'bootPrewarmService?.invalidate',
  ].forEach((token) => {
    if (clseMessageHandlerSource.includes(token) || clseMessageRoutesSource.includes(token)) {
      fail(`CLSE message route/handler must not hide owner or read failures behind fallback token ${token}.`);
    }
  });
  if (tacticalLoggerSource.includes('if (isProcessing) return;')) {
    fail('src/domains/tracking/background/TacticalIntelligenceLogger.js must return an explicit in-flight tactical flush result instead of undefined.');
  }
  if (/\b(?:browserPort|tabsQuery)\b/u.test(tacticalLoggerSource)) {
    fail('TacticalIntelligenceLogger must consume the required tracking background context instead of issuing a second browser inventory read.');
  }
  [
    'Array.isArray(settingsCache.blockedUrls) ? settingsCache.blockedUrls : []',
    "typeof previewBlockedBookmarks !== 'function'",
    "typeof exportBlockedBookmarksHtml !== 'function'",
    "typeof cleanupRecentBlockedHistory !== 'function'",
    "typeof syncBlockedBookmarks !== 'function'",
    "return { html: '', filename: '', count: 0, domains: 0 };",
    'return { destroyed: [] };',
  ].forEach((token) => {
    if (backgroundKernelAdaptersSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelAdapters.js must require adapter owners instead of fallback token ${token}.`);
    }
  });

  if (!backgroundKernelAdaptersSource.includes('suppressed: isEchoArtifactMutationSuppressed(settingsCache)')
    || !bookmarkConcealManagerSource.includes("status: suppressed ? 'suppressed' : 'disabled'")) {
    fail('Echo bookmark admission must delegate disabled/suppressed synchronization to its required owner with an explicit skip result.');
  }
  if (!echoMutationPolicySource.includes('requireArtifactControlState(settings?.artifactControlState)')
    || !echoMutationPolicySource.includes('ECHO_ARTIFACT_MUTATION_CANCELLED')) {
    fail('Echo mutation admission must require canonical artifact control state and explicitly cancel superseded destructive work.');
  }

  const retiredBootstrapFallbacks = [
    'void bootPrewarmService.ensureWarm',
    "flushTacticalLogsWrapper({ reason: 'suspend' });",
    'Promise.resolve(eventLogStore.forceFlush())',
    "typeof syncBlockedBookmarks === 'function'",
    'popupBlockFlow.handlePermissionAdded?.',
    'popupBlockFlow.handlePermissionRemoved?.',
    'registerBrowserListeners?.',
    'notificationService?.',
  ];
  for (const token of retiredBootstrapFallbacks) {
    if (bootstrapSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingServiceBootstrap.js must not use retired bootstrap fallback token ${token}.`);
    }
  }

  [
    'tabTimeTracker?.getLastActiveTabId?.() ?? null',
    'tabTimeTracker?.getFocusedWindowId?.() ?? null',
    'tabTimeTracker?.getActiveTabInfo?.() ?? null',
    'tabTimeTracker?.getLastTabActivityBatchSummary?.() ?? null',
    'statsRuntimeService.getStatsFactsCacheDiagnostics?.() ?? null',
    'statsRuntimeService.getStatsRuntimeHealth?.() ?? null',
    "code: 'previous_tab_settlement_diagnostic_unavailable'",
  ].forEach((token) => {
    if (trackingRuntimeSnapshotSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelTrackingRuntimeSnapshot.js must require tracking runtime snapshot owners instead of optional fallback token ${token}.`);
    }
  });
  [
    'settingsDocumentRepository.getDocuments(',
    'keyMaterialRepository.getEntries(',
    'runtimeSessionRepository.get(',
    'storageInspectorCapability.getIndexedDbOverview(',
    'localDocuments?.[',
    'localKeyEntries?.[',
    'sessionEntries?.[',
    'statsCache?.dates',
    'TabTimeTracker.getLastActiveTabId()',
    'TabTimeTracker.getFocusedWindowId()',
  ].forEach((token) => {
    if (backgroundStorageInspectorServiceSource.includes(token)) {
      fail(`src/apps/background/services/runtime/support/BackgroundStorageInspectorService.js must validate storage inspector owners and outputs instead of using direct/optional fallback token ${token}.`);
    }
  });
  if (storageInspectorBindingsSource.includes('statsRuntimeService.getStatsCache')) {
    fail('src/apps/background/services/runtime/backgroundKernelStorageInspectorBindings.js must pass stats runtime accessors through the inspector owner validation seam.');
  }
  [
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js',
      source: backgroundMaintenanceCoordinatorSource,
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js',
      source: backgroundStorageSnapshotServiceSource,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js',
      source: storageSupportBindingsSource,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageMaintenanceBindings.js',
      source: storageMaintenanceBindingsSource,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSnapshotBindings.js',
      source: storageSnapshotBindingsSource,
    },
  ].forEach(({ path: filePath, source: ownerSource }) => {
    [
      'settingsService.refreshSettingsCache',
      'syncCLSEFromStoredSettings',
      'syncBlockedBookmarks',
      'syncManagedContentScripts',
      'broadcastSettingsUpdate',
    ].forEach((token) => {
      if (ownerSource.includes(token)) {
        fail(`${filePath} must route external settings reconciliation through SettingsService instead of manual effect token ${token}.`);
      }
    });
  });
  [
    {
      path: kernelPath,
      source,
      pattern: /createBackgroundKernelStorageSupportBindings\(\{[^}]*\brunCLSEStorageSnapshotImport,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js',
      source: storageSupportBindingsSource,
      pattern: /createBackgroundKernelStorageSnapshotBindings\(\{[^}]*\brunCLSEStorageSnapshotImport,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSnapshotBindings.js',
      source: storageSnapshotBindingsSource,
      pattern: /createBackgroundStorageSnapshotService\(\{[^}]*\brunCLSEStorageSnapshotImport,/u,
    },
  ].forEach(({ path: filePath, source: fileSource, pattern }) => {
    if (!pattern.test(fileSource)) {
      fail(`${filePath} must wire the build-selected CLSE snapshot lifecycle into storage import.`);
    }
  });
  [
    {
      path: kernelPath,
      source,
      pattern: /createBackgroundKernelStorageSupportBindings\(\{[^}]*\bcreateZenProfileGenerationState:/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js',
      source: storageSupportBindingsSource,
      pattern: /createBackgroundKernelStorageMaintenanceBindings\(\{[^}]*\bcreateZenProfileGenerationState,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageMaintenanceBindings.js',
      source: storageMaintenanceBindingsSource,
      pattern: /createBackgroundMaintenanceCoordinator\(\{[^}]*\bcreateZenProfileGenerationState,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js',
      source: storageSupportBindingsSource,
      pattern: /createBackgroundKernelStorageSnapshotBindings\(\{[^}]*\bcreateZenProfileGenerationState,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSnapshotBindings.js',
      source: storageSnapshotBindingsSource,
      pattern: /createBackgroundStorageSnapshotService\(\{[^}]*\bcreateZenProfileGenerationState,/u,
    },
  ].forEach(({ path: filePath, source: fileSource, pattern }) => {
    if (!pattern.test(fileSource)) {
      fail(`${filePath} must wire the canonical Zen profile generation factory into reset and snapshot import.`);
    }
  });
  [
    {
      path: kernelPath,
      source,
      pattern: /createBackgroundKernelStorageSupportBindings\(\{[^}]*\bprofileResetLifecycleRepository,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js',
      source: storageSupportBindingsSource,
      pattern: /createBackgroundKernelStorageSnapshotBindings\(\{[^}]*\bprofileMutationCoordinator,/u,
    },
    {
      path: 'src/apps/background/services/runtime/backgroundKernelStorageSnapshotBindings.js',
      source: storageSnapshotBindingsSource,
      pattern: /createBackgroundStorageSnapshotService\(\{[^}]*\bprofileMutationCoordinator,/u,
    },
  ].forEach(({ path: filePath, source: fileSource, pattern }) => {
    if (!pattern.test(fileSource)) {
      fail(`${filePath} must wire the profile mutation coordinator into storage snapshot import.`);
    }
  });
  [
    'statsFeaturePackRepository = null',
    'interventionEffectRepository = null',
    'statsFeaturePackRepository?.clearAll?.()',
    'interventionEffectRepository?.clearAll?.()',
    'progressionRepository?.clear?.()',
  ].forEach((token) => {
    if (backgroundMaintenanceCoordinatorSource.includes(token)) {
      fail(`src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js must require reset cleanup owners instead of optional fallback token ${token}.`);
    }
  });
  [
    'result || {}',
    '? { ...(result || {}), warnings }',
  ].forEach((token) => {
    if (backgroundStorageSnapshotServiceSource.includes(token)) {
      fail(`src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js must not repair malformed import results with fallback token ${token}.`);
    }
  });
  [
    'Array.isArray(result?.items) ? result.items : []',
    'Array.isArray(result?.changedKeys) ? result.changedKeys : []',
    'result?.applied || {',
    'return { success: true, snapshot };',
    'return { success: true, result };',
    'return { success: true, items };',
    'return { success: true, backup };',
  ].forEach((token) => {
    if (storageSupportHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/storageSupportHandlers.js must validate owner outputs instead of using fallback token ${token}.`);
    }
  });
  [
    "if (senderTabId === null) return '';",
    "return trustedSenderTabUrl ? trustedSenderTabUrl.toString() : '';",
    "return '';",
  ].forEach((token) => {
    if (supportDebugPolicySource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessagePolicies/supportDebugPolicy.js must preserve sender-tab URL failure reasons instead of using fallback token ${token}.`);
    }
  });
  [
    'permissionsGetAll',
    "from '../../../../platform/chrome/ChromeService.js'",
    'getGrantedPermissions =',
    "typeof settingsService?.ensureSettingsCache",
    'SETTINGS_CACHE_UNAVAILABLE',
    'POPUP_SITE_SNAPSHOT_UNAVAILABLE',
    'typeof getPopupSiteSnapshot ===',
    "typeof getGrantedPermissions !== 'function'",
    "typeof getPopupSiteSnapshot !== 'function'",
    'snapshot: null',
  ].forEach((token) => {
    if (popupHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/popupHandlers.js must require popup owners instead of using fallback token ${token}.`);
    }
  });
  [
    "from '../../../../platform/storage/settings/SettingsQueryService.js'",
    'readSettingsSnapshot: readSettings = readSettingsSnapshot',
    'updateOperationalTimestamp = () => {}',
    "typeof updateOperationalTimestamp !== 'function'",
    "typeof readSettings === 'function'",
    "Promise.reject(new Error('SETTINGS_READ_OWNER_REQUIRED'))",
    "typeof browserPort?.tabsQuery !== 'function'",
    "typeof browserPort?.tabsSendMessage !== 'function'",
    'NUDGE_CONFIG_UPDATED_TABS_QUERY_UNAVAILABLE',
    'TABS_SEND_MESSAGE_UNAVAILABLE',
    'let siteRuleService',
    'let protectionPresetService',
    'function getSiteRuleService',
    'function getProtectionPresetService',
    'MESSAGE_ACTIONS.NUDGE_CONFIG_UPDATED',
    'MESSAGE_TYPES.NUDGE_STOP',
    'tabsQuery',
    'tabsSendMessage',
    'mergeNudgeConfig',
  ].forEach((token) => {
    if (settingsActionHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/settingsHandlers.js must require settings owners instead of using fallback token ${token}.`);
    }
  });
  [
    'getZenClosedDayRecapSnapshot',
    'ZEN_CLOSED_DAY_RECAP',
    'tabTimeTracker?.getLastDomainUrl?.(key)',
    "typeof getAnalysisBootstrapSnapshot !== 'function'",
    "typeof getCycleProjection !== 'function'",
    "typeof getStatusSnapshot !== 'function'",
    "typeof getSitesSnapshot !== 'function'",
    "typeof getZenClosedDayRecapSnapshot !== 'function'",
    "typeof getTrendSummary !== 'function'",
    "typeof getDomainSeries !== 'function'",
    "typeof getPrecisionRawData !== 'function'",
    "typeof getCachedFaviconData !== 'function'",
    'ANALYSIS_QUERY_UNAVAILABLE',
    'CYCLE_PROJECTION_UNAVAILABLE',
    'STATUS_SNAPSHOT_UNAVAILABLE',
    'SITES_SNAPSHOT_UNAVAILABLE',
    'ZEN_CLOSED_DAY_RECAP_SNAPSHOT_UNAVAILABLE',
    'TREND_SUMMARY_UNAVAILABLE',
    'DOMAIN_SERIES_UNAVAILABLE',
    'PRECISION_RAW_DATA_UNAVAILABLE',
    'FAVICON_QUERY_UNAVAILABLE',
  ].forEach((token) => {
    if (statsQueryHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/statsQueryHandlers.js must not retain retired recap owners or optional stats-owner fallback token ${token}.`);
    }
  });
  [
    'REQUIRED_GROUPS',
    'readRequiredTrackingMessageDependencyGroup',
    'TRACKING_MESSAGE_POLICY_DEPENDENCIES_REQUIRED',
    'TRACKING_MESSAGE_POPUP_DOMAIN_DEPENDENCIES_REQUIRED',
    'TRACKING_MESSAGE_SUPPORT_DEBUG_DEPENDENCIES_REQUIRED',
  ].forEach((token) => {
    if (!trackingMessageDependencyResolverSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageDependencyResolver.js must require grouped dependency seams with token ${token}.`);
    }
  });
  [
    'dependencies.settingsService',
    'dependencies.settingsCache',
    'dependencies.browserPort',
    'dependencies.tabTimeTracker',
    'dependencies.getCachedFaviconData',
    'dependencies.getProtectionRuntimeSnapshot',
    'dependencies.popup ||',
    'dependencies.support ||',
    'dependencies.markNudgePresented',
    'dependencies.readZenMainPresentationLedger',
  ].forEach((token) => {
    if (trackingMessageDependencyResolverSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageDependencyResolver.js must not rebuild grouped dependencies from retired flat/alias input token ${token}.`);
    }
  });
  [
    'SETTINGS_PROPAGATION_HANDLER_MISSING',
    'createMissingStageHandlerError',
  ].forEach((token) => {
    if (backgroundSettingsPropagationCoordinatorSource.includes(token)) {
      fail(`src/apps/background/services/runtime/support/BackgroundSettingsPropagationCoordinator.js must validate stage handlers at construction instead of retrying missing-owner token ${token}.`);
    }
  });
  [
    'markNudgePresented?.',
    'markNudgeResolved?.',
    'markNudgeAborted?.',
    'getCycleState() || {}',
    'snapshot: {}',
    "typeof getCycleState === 'function' ? getCycleState() : {}",
    "if (typeof browserPort?.tabsCreate !== 'function') return false",
    "typeof normalizeNudgeRunId !== 'function'",
    "typeof getCycleState !== 'function'",
    "typeof browserPort?.runtimeGetURL !== 'function'",
    "typeof browserPort?.tabsCreate !== 'function'",
    "typeof browserPort?.tabsRemove !== 'function'",
    "typeof setResetHour !== 'function'",
    "typeof acceptResetRecommendation !== 'function'",
    "typeof dismissResetRecommendation !== 'function'",
    "typeof trackProtectionRecoveryPresented === 'function'",
    "typeof trackProtectionRecoveryResolved === 'function'",
    "typeof trackProtectionRecoveryAborted === 'function'",
    "typeof persistGlobalSentinelOutcomeDecision === 'function'",
    'NUDGE_RUN_ID_NORMALIZER_REQUIRED',
    'RESET_POLICY_UNAVAILABLE',
    'DASHBOARD_TAB_CREATE_UNAVAILABLE',
    'TABS_REMOVE_UNAVAILABLE',
  ].forEach((token) => {
    if (nudgeCycleHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js must require nudge-cycle owners at construction instead of using fallback token ${token}.`);
    }
  });
  [
    'hostname = \'\'',
    'isBlockedDomain = false',
    'isBlockedDomain: !!isBlockedDomain',
  ].forEach((token) => {
    if (protectionDispatchStateLedgerSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionDispatchStateLedger.js must validate remembered context instead of fallback token ${token}.`);
    }
  });
  [
    'if (!ensureResult?.ok)',
    'if (!retryEnsure?.ok)',
    "String(ensureResult?.error || ensureResult?.reason || 'CONTENT_NOT_READY')",
    "retryEnsure?.error || error",
  ].forEach((token) => {
    if (protectionDispatchTransportSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js must validate content-ready owner results instead of fallback token ${token}.`);
    }
  });
  [
    "String(hostname || '')",
    'if (!key) return null',
  ].forEach((token) => {
    if (protectionDispatchPermissionGateSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionDispatchPermissionGate.js must validate URL and hostname permission scopes instead of fallback token ${token}.`);
    }
  });
  [
    'Math.floor(Number(triggerTarget?.observedMs))',
    'Number.isFinite(explicitObservedMs)',
    'observedMs < triggerTarget.targetMs',
    'leaseResult?.ok',
    'leaseResult?.reason ||',
  ].forEach((token) => {
    if (protectionNudgeDispatchGateSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchGate.js must validate gate owner inputs instead of fallback token ${token}.`);
    }
  });
  [
    'Number(decision?.decisionRevision || 0)',
    'Number(previousRevision || 0) + 1',
    'Number.isFinite(Number(previousEnvelopeState.revision))',
    'previousEnvelopeState?.activation?.features || {}',
    'previousEnvelopeState?.compiledFeatures || {}',
    'previousEnvelopeState?.featureHashes || {}',
    'decision?.activation?.features || {}',
    'decision?.compiledFeatures || {}',
    'decision?.featureHashes || {}',
    'previousEnvelopeState?.activation?.main !== !!decision?.activation?.main',
    'main: !!decision?.activation?.main',
    '...(resolvedDecision.decisionTrace || {})',
  ].forEach((token) => {
    if (protectionEnvelopeBuilderSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionEnvelopeBuilder.js must validate envelope inputs instead of fallback token ${token}.`);
    }
  });
  [
    'envelopeResult?.revision || 0',
    'envelopeResult?.state || null',
    'lastEnvelopeStateByTab.get(key) || null',
    'lastEnvelopeRevisionByTab.get(key) || 0',
    'lastProtectionPayloadByTab.set(tabId, signature)',
    'lastEnvelopeRevisionByTab.set(tabId, resolvedEnvelopeResult.revision)',
    'lastEnvelopeStateByTab.set(tabId, resolvedEnvelopeResult.state)',
  ].forEach((token) => {
    if (protectionDispatchStateLedgerSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionDispatchStateLedger.js must validate committed envelope results instead of fallback token ${token}.`);
    }
  });
  [
    'runtimeSnapshot?.policy && typeof runtimeSnapshot.policy === \'object\'',
    'buildProtectionPolicyPayload(runtimeSnapshot?.policy ?? null)',
    'config?.thresholdMs',
    'resolvedConfig.thresholdMs',
    'policy.protocolTargetMinutes',
    'policy.referenceTargetMinutes',
    'coalesceWindowMs',
    'near_global_combined',
    "source: 'global_threshold'",
    'hostname = \'\'',
    'runtimeSnapshot = null',
    'protocolProfile?.protocolScope || \'site\'',
    '...(config || {})',
    'getSentinelFlareNudgeCopy(runtimeContext',
    'Math.floor(Number(runtimeSnapshot?.policy?.protocolTargetMinutes))',
    'Math.floor(Number(runtimeSnapshot?.policy?.referenceTargetMinutes))',
    "normalizeTargetSource(policy.protocolTargetSource, 'protocol_target')",
    "normalizeTargetSource(policy.referenceTargetSource, 'reference_target')",
    'Math.max(0, Math.floor(Number(runtimeSnapshot?.strategy?.recommendedTargetMinutes) || 0))',
    'Math.max(0, Math.floor(Number(runtimeSnapshot?.strategy?.declaredTargetMinutes) || 0))',
  ].forEach((token) => {
    if (protectionNudgeDispatchContextSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js must use ProtectionDispatchPolicyPayload.js instead of trigger-target fallback token ${token}.`);
    }
  });
  [
    'function requireRuntimePlan',
    'function requireRuntimeTrace',
    "failPayloadField('plan')",
    "failPayloadField('trace')",
  ].forEach((token) => {
    if (!protectionDispatchPayloadBuilderSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionDispatchPayloadBuilder.js must retain validated plan/trace payload token ${token}.`);
    }
  });
  [
    'hostname = \'\'',
    'runtimeSnapshot = null',
    'url = \'\'',
    'const dispatch = runtimeSnapshot?.dispatch || {}',
    'const envelopeResult = runtimeSnapshot?.envelopeResult || null',
    'const envelope = envelopeResult?.envelope || null',
    'isBlockedDomain: !!dispatch.isBlockedDomain',
    'blocked: !!dispatch.isBlockedDomain',
    'shouldApply: !!dispatch.shouldApply',
    'traceId: dispatch?.traceId || null',
    'if (!trace || typeof trace !== \'object\') return null',
    'plan: resolvedRuntimeSnapshot.plan || null',
    '...envelope,',
    '...(envelope || {})',
    'const policy = runtimeSnapshot?.policy || {}',
    'Number(policy.stepDelta) || 0',
    "policy.protocolBudgetRole || 'reference'",
    'Number(policy.protocolTargetMinutes) || 0',
    "policy.protocolTargetSource || 'none'",
    'Number(policy.referenceTargetMinutes) || 0',
    "policy.referenceTargetSource || 'none'",
    'policy.globalCapBlockedMs || 0',
    'policy.globalCapLimitMs || 0',
  ].forEach((token) => {
    if (protectionDispatchPayloadBuilderSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionDispatchPayloadBuilder.js must validate present policy snapshots instead of fallback token ${token}.`);
    }
  });
  [
    'Number(request.version) === PROTECTION_ENVELOPE_VERSION && isPlainObject(request.activation)',
    'return request;',
    'const safeRevision = Number.isFinite(Number(revision)) ? Number(revision) : 0',
    'const safeBaseRevision = Number.isFinite(Number(baseRevision)) ? Number(baseRevision) : -1',
    "hostname: typeof hostname === 'string' ? hostname : ''",
    "domainClassId: typeof domainClassId === 'string' ? domainClassId : ''",
    'main: !!activation?.main',
    'cloneRecord(activation?.features)',
    'cloneRecord(compiledFeatures)',
    'cloneRecord(featureRevisions)',
    'if (!isPlainObject(patch)) {\n    return {',
    'activationRemoves: Array.isArray(patch.activationRemoves)',
    'compiledRemoves: Array.isArray(patch.compiledRemoves)',
  ].forEach((token) => {
    if (protectionEnvelopeContractSource.includes(token)) {
      fail(`src/domains/protection/protocol/contracts/envelope.js must validate canonical envelope inputs instead of fallback token ${token}.`);
    }
  });
  [
    'protocolState?.scopes?.[normalizedHostname] || null',
    'protocolScope?.referenceTarget || null',
    'protocolScope?.activeTarget || null',
    'protocolActiveTarget?.targetMinutes',
    'protocolReferenceTarget?.targetMinutes',
    "typeof protocolReferenceTarget?.targetSource === 'string'",
    "typeof protocolActiveTarget?.targetSource === 'string'",
  ].forEach((token) => {
    if (protectionRuntimeInputAssemblerSource.includes(token)) {
      fail(`src/domains/protection/background/ProtectionRuntimeInputAssembler.js must use protectionProtocolProjection.js instead of fallback projection token ${token}.`);
    }
  });
  [
    'protocolScope?.referenceTarget?.targetMinutes',
    'protocolScope?.referenceTarget?.targetSource',
    'protocolScope?.activeTarget?.targetMinutes',
    'protocolScope?.activeTarget?.targetSource',
    "protocolScope?.budgetRole || 'reference'",
  ].forEach((token) => {
    if (protectionProfileResolverSource.includes(token)) {
      fail(`src/domains/protection/background/ProfileResolver.js must use protectionProtocolProjection.js instead of fallback protocol metadata token ${token}.`);
    }
  });
  [
    "const activeInfo = typeof tabTimeTracker?.getActiveTabInfo === 'function'",
    "hostname && typeof getProtectionRuntimeSnapshot === 'function'",
    "hostname && typeof refreshProtectionRuntimeSnapshot === 'function'",
    "typeof getProtectionRuntimeTelemetryContext !== 'function'",
    "typeof getStatsCache !== 'function'",
    "typeof getStatsDateStr !== 'function'",
    "typeof loadStatsCache !== 'function'",
    "typeof settingsService?.ensureSettingsCache !== 'function'",
    "getStatsDateStr() || getLocalDateStr(now)",
    "typeof getGateInterstitialSession !== 'function'",
    "typeof submitGateInterstitialDecision !== 'function'",
    'FILTER_INDICATOR_UNAVAILABLE',
    'GATE_INTERSTITIAL_UNAVAILABLE',
    'protocolState?.scopes?.[hostname] || null',
    'activeTarget?.targetMinutes',
    'referenceTarget?.targetMinutes',
    '!!schedule?.scheduleActive',
    '!!inScheduleBlock',
    'resolvedSettingsCache.globalGoal || 0',
  ].forEach((token) => {
    if (protectionRuntimeHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/protectionRuntimeHandlers.js must report missing protection runtime owners explicitly instead of using fallback token ${token}.`);
    }
  });
  [
    'settingsService.getSettingsCache()?.filterSettings || DEFAULT_FILTER_SETTINGS',
    'settingsService.getSettingsCache()?.notificationsConfig || {}',
    "tabTimeTracker.getActiveTabInfo()?.hostname || ''",
    'settingsService.getSettingsCache?.() || {}',
    'tabTimeTracker.getActiveTabInfo?.() ?? null',
  ].forEach((token) => {
    if (source.includes(token) || protectionRuntimeBindingsSource.includes(token)) {
      fail(`background kernel runtime bindings must require owner paths instead of optional fallback token ${token}.`);
    }
  });
  const dormantAudioReleaseWiringTokens = [
    'createProtectionAudioDullingDispatchBridge',
    'audioDullingCoordinator',
    'startAudioDullingCaptureForTab',
    'getAudioDullingTabState',
    'MESSAGE_ACTIONS.START_AUDIO_DULLING_CAPTURE',
    'MESSAGE_ACTIONS.GET_AUDIO_DULLING_CAPTURE_STATE',
  ];
  [
    ['src/domains/protection/background/ProtectionDispatcher.js', protectionDispatcherSource],
    ['src/apps/background/services/runtime/backgroundKernelProtectionDispatcherBindings.js', protectionDispatcherBindingsSource],
    ['src/domains/protection/background/protocol/dispatch/ProtectionTabLifecycleLedger.js', protectionTabLifecycleLedgerSource],
    ['src/apps/background/services/runtime/backgroundKernelProtectionRuntimeBindings.js', protectionRuntimeBindingsSource],
    ['src/apps/background/services/runtime/ProtectionRuntimeCoordinator.js', protectionRuntimeCoordinatorSource],
    ['src/domains/tracking/background/trackingMessageHandlers/protectionRuntimeHandlers.js', protectionRuntimeHandlersSource],
    ['src/domains/tracking/background/trackingMessagePolicies/actionSenderPolicy.js', actionSenderPolicySource],
  ].forEach(([filePath, fileSource]) => {
    dormantAudioReleaseWiringTokens.forEach((token) => {
      if (fileSource.includes(token)) {
        fail(`DORMANT_AUDIO_RELEASE_WIRING_FORBIDDEN:${filePath}:${token}`);
      }
    });
  });
  [
    'readFilterSettings = null',
    'return CONFIG_DEFAULT_FILTER_SETTINGS',
    'settingsService?.ensureSettingsCache',
    'settingsService?.getSettingsCache?.',
    'settingsService.ensureSettingsCache()',
    'settingsService.mergeNudgeConfig(',
    'contentScriptOrchestrator = null',
    'contentScriptOrchestrator?.',
    'orchestrator?.',
    'markTabNavigated?.',
    'getTabSession?.',
    'evictTab?.',
    ': { ok: true, reason: null }',
    'gateInterstitialController = null',
    'gateInterstitialController ?',
    'gateInterstitialController?.presentForRuntimeSnapshot?.',
    'frictionBootstrapCoordinator = null',
    'frictionBootstrapCoordinator?.refreshForRuntime',
    'EMPTY_BROWSER_PORT',
    'browserPort = EMPTY_BROWSER_PORT',
    'browserPort || EMPTY_BROWSER_PORT',
    "typeof browserPort?.permissionsContains !== 'function'",
    "typeof browserPort.windowsGetLastFocused !== 'function'",
    'contentRuntimeDiagnostics = null',
    'sentinelProtocolTimeline = null',
    'contentRuntimeDiagnostics ||',
    'sentinelProtocolTimeline ||',
  ].forEach((token) => {
    if (protectionDispatcherSource.includes(token)) {
      fail(`src/domains/protection/background/ProtectionDispatcher.js must require dispatcher owners instead of fallback token ${token}.`);
    }
  });
  [
    'trackingProtectionService?.applyGateInterventionDecision?.',
    'trackingProtectionService?.recordGateInterventionShown?.',
    'protectionServiceBindings.trackingProtectionService?.',
  ].forEach((token) => {
    if (protectionBindingsSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelProtectionBindings.js must require gate intervention owners instead of fallback token ${token}.`);
    }
  });
  if (!protectionBindingsSource.includes('BACKGROUND_PROTECTION_CONTENT_DIAGNOSTICS_REQUIRED')) {
    fail('src/apps/background/services/runtime/backgroundKernelProtectionBindings.js must require content runtime diagnostics before wiring gate intervention stats diagnostics.');
  }
  [
    'settingsService.mergeNudgeConfig?.bind(settingsService)',
  ].forEach((token) => {
    if (protectionServiceBindingsSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelProtectionServiceBindings.js must require the nudge-config merge owner instead of fallback token ${token}.`);
    }
  });
  [
    'mergeNudgeConfig = null',
    "typeof mergeNudgeConfig === 'function'",
    'settingsSnapshot?.nudgeConfig || {}',
  ].forEach((token) => {
    if (
      protectionRuntimeInputAssemblerSource.includes(token)
      || protectionProfileResolverSource.includes(token)
      || trackingProtectionServiceSource.includes(token)
    ) {
      fail(`protection runtime assembly must require the nudge-config merge owner instead of fallback token ${token}.`);
    }
  });
  [
    'readProtectionSettingsSnapshot',
    'RuntimeFlagRepository.getInstance()',
    'clseSignalQueryService?.getAggressionLogs?.',
    "typeof runtimeStateCoordinator.getFeedFlowSnapshot !== 'function'",
    "typeof runtimeStateCoordinator.getGateHostSnapshot === 'function'",
    "console.warn('[ProtectionRuntimeInputProvider] Failed to read CLSE aggression logs:",
    "console.warn('[ProtectionRuntimeInputProvider] Failed to read global sentinel outcome:",
    "console.warn('[ProtectionRuntimeInputProvider] Failed to count parallel host tabs:",
    'session?.[STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME] || null',
    'session?.[STORAGE_SESSION_KEYS.SPECIAL_SESSION]',
    'listTabs = async () => []',
    'getSessionDwell = () => 0',
    'getStatsCache = () => ({ dates: {} })',
    'loadStatsCache = async () => {}',
  ].forEach((token) => {
    if (protectionRuntimeInputProviderSource.includes(token)) {
      fail(`src/domains/protection/background/ProtectionRuntimeInputProvider.js must surface missing runtime owners instead of fallback token ${token}.`);
    }
  });
  [
    'function normalizeSignalCacheSnapshot',
    'scores: Array.isArray(source.scores)',
    '.filter((value) => Number.isFinite(value) && value >= 0)',
    'const source = entry && typeof entry ===',
    'Number(source.dwellMs) || 0',
    'normalizeConsumedProtectedContext(entry, normalizedNow)',
  ].forEach((token) => {
    if (
      protectionRuntimeStateCoordinatorSource.includes(token)
      || gateRuntimeStateOwnerSource.includes(token)
    ) {
      fail(`Gate runtime state must validate consumed context entries instead of fallback token ${token}.`);
    }
  });
  for (const token of ['consumedProtectedContexts', 'recordConsumedProtectedContext', 'getGateProtectedContextSnapshot']) {
    if (gateRuntimeStateOwnerSource.includes(token) || protectionRuntimeStateCoordinatorSource.includes(token)) {
      fail('Gate must read confirmed Tracking consumption through the projection, not own a second usage history.');
    }
  }
  [
    'PROTECTION_RUNTIME_SNAPSHOT_HOSTNAME_REQUIRED',
    'PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_REQUIRED',
    'PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_RESULT_REQUIRED',
    'PROTECTION_RUNTIME_SNAPSHOT_ENVELOPE_FIELD_INVALID:envelope.revision',
    'PROTECTION_RUNTIME_SNAPSHOT_SCOPE_FIELD_INVALID:domainClassId',
    'PROTECTION_RUNTIME_SNAPSHOT_DISPATCH_MISMATCH:shouldApply',
    'isKnownDomainClassId',
    'resolvedEnvelopeResult.state.compiledFeatures',
  ].forEach((token) => {
    if (!runtimeSnapshotBuilderSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/RuntimeSnapshotBuilder.js must retain validated runtime snapshot builder token ${token}.`);
    }
  });
  if (!trackingProtectionServiceSource.includes('revision: runtimeSnapshot.envelopeResult.revision')) {
    fail('src/domains/protection/background/TrackingProtectionService.js must record explicit runtime snapshot envelope revisions.');
  }
  [
    'envelopeResult?.state?.compiledFeatures',
    'envelopeResult?.envelope?.compiledFeatures',
    "if (!compiledFeatures || typeof compiledFeatures !== 'object') return normalizedPlan",
    'envelopeResult?.envelope?.trace || trace || null',
    '!!scope?.isBlockedDomain',
    '!!envelopeResult?.envelope?.activation?.main',
    'envelopeResult?.envelope?.domainClassId ||',
    'traceId: envelopeResult.envelope.trace.traceId || null',
    'scope: scope || null',
    'policy: policy || null',
    "strategy && typeof strategy === 'object' ?",
    "recovery && typeof recovery === 'object' ?",
    "effectiveness && typeof effectiveness === 'object' ?",
  ].forEach((token) => {
    if (runtimeSnapshotBuilderSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/RuntimeSnapshotBuilder.js must validate snapshot/envelope inputs instead of fallback token ${token}.`);
    }
  });
  if (trackingProtectionServiceSource.includes('runtimeSnapshot?.envelopeResult?.revision || 0')) {
    fail('src/domains/protection/background/TrackingProtectionService.js must not hide missing runtime snapshot revisions behind 0.');
  }
  if (trackingProtectionServiceSource.includes("domainClassId: 'global_sentinel_release'")) {
    fail('src/domains/protection/background/TrackingProtectionService.js must not write release reasons into domainClassId.');
  }
  [
    'ENVELOPE_ADAPTER_HOSTNAME_REQUIRED',
    'ENVELOPE_ADAPTER_REVISION_INVALID',
    'ENVELOPE_ADAPTER_PREVIOUS_REVISION_INVALID',
    'ENVELOPE_ADAPTER_DOMAIN_CLASS_INVALID',
    'ENVELOPE_ADAPTER_COMPILED_POLICY_FIELD_INVALID:compiledFeatures',
    'isKnownDomainClassId',
    'requireCompiledPolicyOutput',
  ].forEach((token) => {
    if (!envelopeAdapterSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/EnvelopeAdapter.js must retain envelope decision validation token ${token}.`);
    }
  });
  [
    "traceId: `upe:${hostname || 'unknown'}:${revision}`",
    'decisionRevision: revision',
    'const nextRevision = Math.max(Number(previousRevision || 0) + 1, 1)',
    'const resolvedDomainClassId = domainClassId || resolveDomainClassId',
  ].forEach((token) => {
    if (envelopeAdapterSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/EnvelopeAdapter.js must validate envelope identity instead of fallback token ${token}.`);
    }
  });
  [
    'PROTECTION_POLICY_COMPILER_REVISION_INVALID',
    'PROTECTION_POLICY_COMPILER_FILTERS_REQUIRED',
    'PROTECTION_POLICY_COMPILER_ACTIVATION_FEATURES_REQUIRED',
    'PROTECTION_POLICY_COMPILER_ACTIVATION_ENABLED_INVALID:',
  ].forEach((token) => {
    if (!protectionPolicyCompilerSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/engine/ProtectionPolicyCompiler.js must retain compiler input validation token ${token}.`);
    }
  });
  [
    'revision = 0',
    'filters?.[featureKey]',
    '!!activation?.features?.[featureKey]?.enabled',
    'featureRevisions[featureKey] = Number.isFinite(Number(revision))',
  ].forEach((token) => {
    if (protectionPolicyCompilerSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/engine/ProtectionPolicyCompiler.js must validate compiler inputs instead of fallback token ${token}.`);
    }
  });
  [
    'PROTECTION_RUNTIME_SNAPSHOT_STORE_HOSTNAME_REQUIRED',
    'PROTECTION_RUNTIME_SNAPSHOT_STORE_PLAN_REQUIRED',
    'PROTECTION_RUNTIME_SNAPSHOT_STORE_REVISION_INVALID',
    'PROTECTION_RUNTIME_SNAPSHOT_STORE_RECOVERY_INVALID',
  ].forEach((token) => {
    if (!protectionRuntimeSnapshotStoreSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/ProtectionRuntimeSnapshotStore.js must retain runtime snapshot cache validation token ${token}.`);
    }
  });
  if (!protectionRuntimeStateCoordinatorSource.includes('return runtimeSnapshotStore.set({')) {
    fail('ProtectionRuntimeStateCoordinator.js must return the validated runtime snapshot store write result directly.');
  }
  [
    'if (!normalizedHostname || !plan) {',
    'revision: Number(revision) || 0',
    'strategy: strategy ? normalizeStrategyDecision(strategy) : null',
    "recovery: recovery && typeof recovery === 'object' ? { ...recovery } : null",
    "effectiveness: effectiveness && typeof effectiveness === 'object' ? { ...effectiveness } : null",
  ].forEach((token) => {
    if (protectionRuntimeSnapshotStoreSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/ProtectionRuntimeSnapshotStore.js must validate runtime snapshot cache writes instead of fallback token ${token}.`);
    }
  });
  [
    'PREPAINT_VISUAL_HOST_INVALID',
    'PREPAINT_VISUAL_SCHEMA_VERSION_INVALID',
    'PREPAINT_VISUAL_SNAPSHOT_LIST_INVALID',
    'PREPAINT_VISUAL_TIMESTAMP_INVALID:',
    'PREPAINT_VISUAL_META_FIELD_INVALID:revision',
  ].forEach((token) => {
    if (!prepaintVisualPlanCompilerSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/PrepaintVisualPlanCompiler.js must retain current root-visual validation token ${token}.`);
    }
  });
  [
    'normalizeHostname(snapshot?.host?.hostname || snapshot?.hostname)',
    "Object.values(snapshots && typeof snapshots === 'object' ? snapshots : {})",
    'snapshot?.visualFilters || {}',
    'visualFilters.saturation || visualFilters.desaturation',
    'snapshot?.decision?.shouldApply !== true',
    'snapshot?.meta?.themeId || null',
    'snapshot?.meta?.styleVariant || null',
    'toFiniteNumber(snapshot?.meta?.revision, 0) || 0',
  ].forEach((token) => {
    if (prepaintVisualPlanCompilerSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/PrepaintVisualPlanCompiler.js must consume normalized root-visual snapshots instead of fallback token ${token}.`);
    }
  });
  [
    'AUDIO_DULLING_RUNTIME_SNAPSHOT_REQUIRED',
    'AUDIO_DULLING_RUNTIME_ENVELOPE_FIELD_INVALID:state.compiledFeatures',
    'AUDIO_DULLING_RUNTIME_FEATURE_FIELD_INVALID:audioDulling.isActive',
    'runtimeSnapshot.envelopeResult.state.compiledFeatures',
  ].forEach((token) => {
    if (!audioDullingCoordinatorSource.includes(token)) {
      fail(`src/domains/protection/background/audioDulling/AudioDullingCoordinator.js must retain runtime snapshot validation token ${token}.`);
    }
  });
  [
    'runtimeSnapshot?.envelopeResult?.state?.compiledFeatures',
    'runtimeSnapshot?.envelopeResult?.envelope?.compiledFeatures',
    'runtimeSnapshot?.compiledFeatures',
    'compiledFeatures?.audioDulling',
    '!!entry.isActive',
    'runtimeSnapshot?.dispatch?.shouldApply === true',
  ].forEach((token) => {
    if (audioDullingCoordinatorSource.includes(token)) {
      fail(`src/domains/protection/background/audioDulling/AudioDullingCoordinator.js must validate runtime audio state instead of fallback token ${token}.`);
    }
  });
  [
    'hostname = \'\'',
    'runtimeSnapshot = null',
    'hostname || runtimeSnapshot?.hostname',
    'if (!resolvedHostname || !runtimeSnapshot) return null',
    'runtimeSnapshot?.envelopeResult?.state?.compiledFeatures',
    'runtimeSnapshot?.envelopeResult?.envelope?.compiledFeatures',
    '?? 0',
    'Number.isFinite(Number(revision))',
  ].forEach((token) => {
    if (frictionBootstrapSnapshotBuilderSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/FrictionBootstrapSnapshotBuilder.js must validate runtime snapshot inputs instead of fallback token ${token}.`);
    }
  });
  [
    'runtimeSnapshot = null',
    'if (!snapshot) return null',
    'if (!writtenSnapshot) return null',
    'Number.isFinite(Number(now)) ? Number(now) : Date.now()',
    'Math.floor(Number(minRewriteIntervalMs) || 0)',
  ].forEach((token) => {
    if (frictionBootstrapCoordinatorSource.includes(token)) {
      fail(`src/domains/protection/background/runtime/FrictionBootstrapCoordinator.js must validate bootstrap snapshot results instead of fallback token ${token}.`);
    }
  });
  [
    'chromeApi?.runtime?.sendMessage?.(message);',
  ].forEach((token) => {
    if (behaviorBrowserPortSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelBehaviorBrowserPort.js must report unavailable runtime sendMessage instead of optional success token ${token}.`);
    }
  });
  [
    'const dispatchActionMessage = typeof handleActionMessage',
    ': () => false',
    "typeof getInitPromise === 'function' ? getInitPromise() : null",
    "typeof getDashboardBootReadinessPromise === 'function' ? getDashboardBootReadinessPromise() : null",
  ].forEach((token) => {
    if (backgroundMessageRouterSource.includes(token)) {
      fail(`src/apps/background/services/runtime/BackgroundMessageRouter.js must require router owners instead of fallback token ${token}.`);
    }
  });
  [
    "typeof getInitPromise === 'function' ? getInitPromise() : null",
    "typeof runMemoryPurgeArtifactCleanup !== 'function'",
    "typeof cleanupRecentBlockedHistory === 'function'",
    'TabTimeTracker.finalizeActiveSession?.',
    'TabTimeTracker.recordNavigationIntent?.',
    'TabTimeTracker.recordTabContext?.',
    'contentScriptOrchestrator?.markTabNavigated?.',
    'contentScriptOrchestrator?.evictTab?.',
    'gateInterstitialController?.handleTabNavigation?.',
    'gateInterstitialController?.removeTabSession?.',
    'noteGateActiveNavigation?.',
    'noteGateForegroundTab?.',
    'noteGateForegroundBlur?.',
    'noteGateTabClosed?.',
    'EMPTY_BROWSER_PORT',
    'browserPort = EMPTY_BROWSER_PORT',
    'sessionStore = null',
  ].forEach((token) => {
    if (trackingBrowserEventSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingBrowserEventHandlers.js must require browser event owners instead of fallback token ${token}.`);
    }
  });
  if (trackingBrowserEventSource.includes('abortNudgesForTab')) {
    fail('trackingBrowserEventHandlers.js must route nudge teardown through ProtectionDispatcher instead of direct abortNudgesForTab calls.');
  }
  [
    'getBackgroundBootstrapCoordinator',
    '?.getInitPromise?.() ?? null',
    'protectionRuntimeStateCoordinator?.',
    'sessionStore = null',
  ].forEach((token) => {
    if (trackingBrowserBindingsSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelTrackingBrowserBindings.js must receive explicit runtime owners instead of fallback token ${token}.`);
    }
  });
  [
    "typeof getActiveTabInfo === 'function' ? getActiveTabInfo() : null",
    "typeof readFilterSettings === 'function'",
    'readFilterSettings() || defaultFilterSettings',
    ': defaultFilterSettings',
    'defaultFilterSettings',
  ].forEach((token) => {
    if (tacticalLogsWrapperSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelTacticalLogs.js must require tactical log owners instead of fallback token ${token}.`);
    }
  });
  [
    "typeof recordBehaviorEvent !== 'function'",
    "typeof recordContentFlowStats !== 'function'",
  ].forEach((token) => {
    if (behaviorTelemetryRecorderSource.includes(token)) {
      fail(`src/domains/stats/background/collection/behaviorTelemetryRecorder.js must require behavior telemetry owners instead of fallback token ${token}.`);
    }
  });
  [
    'trackingProtectionService?.getProtectionRuntimeTelemetryContext?.',
    'gateInterstitialController?.getGateInterstitialSession',
    'gateInterstitialController?.submitGateInterstitialDecision',
  ].forEach((token) => {
    if (backgroundKernelActionHandlerFactorySource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelActionHandlerFactory.js must require action owners instead of fallback token ${token}.`);
    }
  });
  [
    'statsTrendQueryService?.getTrendSummary',
    'statsTrendQueryService?.getDomainSeries',
    'getCachedFaviconData: faviconService.getCachedFaviconData',
    'getAnalysisBootstrapSnapshot: statsAnalysisQueryService.getAnalysisBootstrapSnapshot',
  ].forEach((token) => {
    if (backgroundKernelActionStatsBindingsSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelActionStatsBindings.js must route stats query owners through the explicit owner helper instead of token ${token}.`);
    }
  });
  [
    'statsTickRuntimeService = null',
    'behaviorMetricsCollector = null',
    'nudgeWindowBlurController = null',
    'onIdleStateChange = null',
    'setupIdleDetection = null',
    'maybeDeleteHistoryForUrl = async () => {}',
    'statsTickRuntimeService?.',
    'behaviorMetricsCollector?.',
    'nudgeWindowBlurController?.',
    "typeof setupIdleDetection === 'function'",
  ].forEach((token) => {
    if (analyticsBindingsSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelAnalyticsBindings.js must require analytics owners instead of fallback token ${token}.`);
    }
  });
  [
    "getActiveHostname = () => ''",
  ].forEach((token) => {
    if (behaviorPolicySource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelBehaviorPolicy.js must require active hostname ownership instead of fallback token ${token}.`);
    }
  });
  [
    'getNotificationsConfig = () => ({})',
    'ensureNotificationsConfigReady = async () => {}',
    'openNotificationClickAction = async () => null',
    'resolveNotificationCapability = getNotificationCapabilityState',
    'ensureNotificationsConfigReady?.()',
    'getNotificationsConfig?.() || {}',
    'function buildDeliveryKey(',
    'event.sessionId.trim()',
    'event.windowKey.trim()',
    'now = () => Date.now()',
    'normalizeNonNegativeInteger',
    'fireAt: now()',
  ].forEach((token) => {
    if (notificationServiceSource.includes(token)) {
      fail(`src/domains/notifications/background/NotificationService.js must require notification runtime owners instead of fallback token ${token}.`);
    }
  });
  [
    'resolvedBrowserPort.notificationsOnClickedAddListener(clickListener);',
    'resolvedBrowserPort.notificationsOnClosedAddListener(closeListener);',
    'resolvedBrowserPort.notificationsOnClickedRemoveListener(clickListener);',
    'resolvedBrowserPort.notificationsOnClosedRemoveListener(closeListener);',
    'if (!context.route?.target) return false;',
    'return !!(await openNotificationClickAction(context));',
  ].forEach((token) => {
    if (notificationServiceSource.includes(token)) {
      fail(`src/domains/notifications/background/NotificationService.js must validate listener port results instead of discarding ${token}`);
    }
  });
  [
    'if (!url) return false',
    'return !!tab',
  ].forEach((token) => {
    if (coreServicesSource.includes(token) || backgroundNotificationClickActionSource.includes(token)) {
      fail(`notification click routing must throw explicit errors instead of fallback token ${token}.`);
    }
  });
  [
    'notificationService = null',
    'notificationService &&',
    "typeof notificationService.handleEvent === 'function'",
    '[TrackingRuntimeCoordinator] global cap notification failed:',
    '[TrackingRuntimeCoordinator] schedule start notification failed:',
    '[TrackingRuntimeCoordinator] schedule end notification failed:',
    "'unknown_day'",
    "'schedule_window'",
    'rawValue === true',
    '!!capState.exceeded',
    'occurredAt = Date.now()',
    'settingsCache?.globalCapNotifyOnExceeded === true',
    'session?.[globalCapSessionKey]',
    'capState?.blockedTodayMs || 0',
    'capState?.globalGoalMin || 0',
    'Array.isArray(result?.missingDomains) ? result.missingDomains : []',
    'result?.injectionSummary && typeof result.injectionSummary ===',
    'Number.isFinite(Number(injectionSummary?.attemptedCount))',
    'Number.isFinite(Number(injectionSummary?.successCount))',
    'Number.isFinite(Number(injectionSummary?.failureCount))',
    'result?.hasScripting === false',
  ].forEach((token) => {
    if (trackingRuntimeCoordinatorSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingRuntimeCoordinator.js must require runtime owner contracts instead of fallback token ${token}.`);
    }
  });
  [
    'tabTimeTracker?.resetState?.()',
    "typeof tabTimeTracker?.resetState !== 'function'",
    "typeof clearAllStatsDays !== 'function'",
    "typeof loadStatsCache !== 'function'",
    "typeof resetStatsState !== 'function'",
    "typeof resetAnalyticsData !== 'function'",
    "typeof resetAppData !== 'function'",
    "typeof exportStorageSnapshot !== 'function'",
    "typeof importStorageSnapshot !== 'function'",
    "typeof getStorageInspectorSnapshot !== 'function'",
    "typeof runStorageSupportAction !== 'function'",
    "typeof confirmMemoryPurge !== 'function'",
    "typeof previewBlockedHistory !== 'function'",
    "typeof previewBlockedBookmarks !== 'function'",
    "typeof exportBlockedBookmarksHtml !== 'function'",
    'RESET_HANDLER_UNAVAILABLE',
    'STORAGE_SNAPSHOT_UNAVAILABLE',
    'STORAGE_INSPECTOR_UNAVAILABLE',
    'STORAGE_SUPPORT_UNAVAILABLE',
    'MEMORY_PURGE_CONFIRM_UNAVAILABLE',
    'PREVIEW_BLOCKED_HISTORY_UNAVAILABLE',
    'PREVIEW_BLOCKED_BOOKMARKS_UNAVAILABLE',
    'EXPORT_BLOCKED_BOOKMARKS_HTML_UNAVAILABLE',
  ].forEach((token) => {
    if (storageSupportHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/storageSupportHandlers.js must require storage-support owners at construction instead of optional reset token ${token}.`);
    }
  });
  [
    'TRACKING_RUNTIME_STATE_UNAVAILABLE',
    'ZEN_GP_SERVICE_UNAVAILABLE',
    'FAVICON_CAPTURE_UNAVAILABLE',
    'DEBUG_REFRESH_FAVICONS_TABS_QUERY_UNAVAILABLE',
    'INSPECT_UNAVAILABLE',
    'BOOT_PREWARM_UNAVAILABLE',
    'CONTENT_RUNTIME_DIAGNOSTICS_UNAVAILABLE',
    'SENTINEL_PROTOCOL_TIMELINE_UNAVAILABLE',
    'CONTENT_ORCHESTRATOR_UNAVAILABLE',
    'DEBUG_DISPATCH_TABS_GET_UNAVAILABLE',
    'CONTENT_MESSAGE_PORT_UNAVAILABLE',
    'NUDGE_DISPATCH_UNAVAILABLE',
    'if (!ensureResult?.ok)',
    'response?.ok !== false',
    "response?.error || 'CONTENT_RESPONSE_NOT_OK'",
    "String(ensureResult?.error || ensureResult?.reason || 'CONTENT_NOT_READY')",
    "if (typeof saveStatsCache === 'function')",
  ].forEach((token) => {
    if (supportActionHandlersSource.includes(token)) {
      fail(`src/domains/tracking/background/trackingMessageHandlers/supportActionHandlers.js must require support action owners instead of using fallback token ${token}.`);
    }
  });
  [
    'cleanupBlockedHistory = async () => []',
    'syncBlockedBookmarks = async () => ({ destroyed: [] })',
  ].forEach((token) => {
    if (backgroundMemoryPurgeCoordinatorSource.includes(token)) {
      fail(`src/apps/background/services/runtime/support/BackgroundMemoryPurgeCoordinator.js must require concrete memory-purge owners instead of no-op default ${token}.`);
    }
  });
  [
    'cleanupRecentBlockedHistory = async () => []',
    'syncBlockedBookmarks = async () => ({ destroyed: [] })',
  ].forEach((token) => {
    if (backgroundMemoryPurgeArtifactRunnerSource.includes(token)) {
      fail(`src/apps/background/services/runtime/support/BackgroundMemoryPurgeArtifactRunner.js must require concrete memory-purge artifact owners instead of no-op default ${token}.`);
    }
  });

  if (/\bchrome\./u.test(protectionDispatcherSource) || protectionDispatcherSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/ProtectionDispatcher.js must receive browser ports instead of using chrome directly.');
  }

  [
    'audioDullingCoordinator.stopTab',
    'audioDullingCoordinator.reconcileTab',
    'audioDullingCoordinator.startArmedTab',
    'audioDullingCoordinator.getTabState',
    'gateInterstitialController.presentForRuntimeSnapshot',
    'frictionBootstrapCoordinator.refreshForRuntime',
    'resolveGatekeeperTheme(',
    'friction_bootstrap_refresh_failed',
    'lastProtectionPayloadByTab = new Map',
    'lastProtectionContextByTab = new Map',
    'lastEnvelopeRevisionByTab = new Map',
    'lastEnvelopeStateByTab = new Map',
    'normalizeIndicatorConfig(',
    'normalizeDebugConfig(',
    'isPrecisionInsightsEnabledForHostname(',
    'type: MESSAGE_TYPES.PROTECTION_UPDATE',
    'const signature = JSON.stringify',
    'function toTraceSignature(',
    'MESSAGE_TYPES.NUDGE_START',
    'deriveSentinelFlareProtocolProfile(',
    'SENTINEL_PROTOCOL_TIMELINE_PHASES',
    'SENTINEL_PROTOCOL_TIMELINE_SOURCES',
    'SENTINEL_PROTOCOL_TIMELINE_STATUSES',
    'getNudgeGateState(',
    'markNudgePending(',
    'acquireNudgeLease(',
    'releaseNudgeLease(',
    'createNudgeRunId(',
    'getNudgeDayKey(',
    'nudgeDispatchInFlight',
    'nudge_dispatch_detached_failed',
  ].forEach((token) => {
    if (protectionDispatcherSource.includes(token)) {
      fail(`src/domains/protection/background/ProtectionDispatcher.js must route ${token} through a dispatch owner module.`);
    }
  });

  [
    'const dispatchInFlight = new Set();',
    'MESSAGE_TYPES.NUDGE_START',
    'deriveSentinelFlareProtocolProfile(',
    'SENTINEL_PROTOCOL_TIMELINE_PHASES',
    'SENTINEL_PROTOCOL_TIMELINE_SOURCES',
    'SENTINEL_PROTOCOL_TIMELINE_STATUSES',
    'getNudgeGateState(',
    'isForegroundTab(',
    'markNudgePending(',
    'acquireNudgeLease(',
    'releaseNudgeLease(',
  ].forEach((token) => {
    if (protectionNudgeDispatchRunnerSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js must route ${token} through its gate/message/timeline owner modules.`);
    }
  });

  [
    'runtimeSnapshot?.dispatch?.isBlockedDomain',
    'runtimeSnapshot?.dispatch?.shouldApply',
    'runtimeSnapshot?.dispatch?.traceId || null',
    'if (!result?.ok)',
    'result?.error || new Error',
    'result.error || new Error',
    'NUDGE_SEND_FAILED',
    'result?.diagnostic',
  ].forEach((token) => {
    if (protectionNudgeDispatchRunnerSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js must validate runtime/send result shapes instead of fallback token ${token}.`);
    }
  });

  if (/\bchrome\./u.test(protectionAudioDullingDispatchBridgeSource) || protectionAudioDullingDispatchBridgeSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionAudioDullingDispatchBridge.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionGateDispatchBridgeSource) || protectionGateDispatchBridgeSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionGateDispatchBridge.js must receive browser ports instead of using chrome directly.');
  }

  [
    'runtimeSnapshot?.telemetryContext',
    'hostname = \'\'',
  ].forEach((token) => {
    if (protectionGateDispatchBridgeSource.includes(token)) {
      fail(`src/domains/protection/background/protocol/dispatch/ProtectionGateDispatchBridge.js must validate gate dispatch inputs instead of using ${token}.`);
    }
  });

  if (/\bchrome\./u.test(protectionDispatchTransportSource) || protectionDispatchTransportSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionDispatchTransport.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionDispatchPermissionGateSource) || protectionDispatchPermissionGateSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionDispatchPermissionGate.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionDispatchPayloadBuilderSource) || protectionDispatchPayloadBuilderSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionDispatchPayloadBuilder.js must build payloads without browser ports.');
  }

  if (/\bchrome\./u.test(protectionDispatchStateLedgerSource) || protectionDispatchStateLedgerSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionDispatchStateLedger.js must remain an in-memory ledger without browser ports.');
  }

  if (/\bchrome\./u.test(protectionDispatchSerialQueueSource) || protectionDispatchSerialQueueSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionDispatchSerialQueue.js must remain an in-memory causal lane without browser ports.');
  }

  if (/\bchrome\./u.test(protectionNudgeDispatchContextSource) || protectionNudgeDispatchContextSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionNudgeDispatchGateSource) || protectionNudgeDispatchGateSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchGate.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionNudgeDispatchMessageBuilderSource) || protectionNudgeDispatchMessageBuilderSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchMessageBuilder.js must build nudge messages without browser ports.');
  }

  if (protectionNudgeDispatchMessageBuilderSource.includes('triggerTarget?.source')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchMessageBuilder.js must validate trigger targets before reading source.');
  }

  if (/\bchrome\./u.test(protectionNudgeDispatchRunnerSource) || protectionNudgeDispatchRunnerSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionNudgeDispatchTimelineSource) || protectionNudgeDispatchTimelineSource.includes('typeof chrome')) {
    fail('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchTimeline.js must format timeline events without browser ports.');
  }

  if (/\bchrome\./u.test(gateInterstitialSource) || /typeof\s+chrome/u.test(gateInterstitialSource) || /globalThis\.chrome/u.test(gateInterstitialSource)) {
    fail('src/domains/protection/background/GateInterstitialController.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(lazyGateInterstitialSource) || /typeof\s+chrome/u.test(lazyGateInterstitialSource) || /globalThis\.chrome/u.test(lazyGateInterstitialSource)) {
    fail('src/apps/background/services/runtime/backgroundKernelLazyGateInterstitialController.js must receive browser ports instead of using chrome directly.');
  }

  [
    'GATE_INTERSTITIAL_DECISION_HANDLER_REQUIRED',
    'GATE_INTERSTITIAL_SHOWN_RECORDER_REQUIRED',
    'GATE_INTERSTITIAL_STATS_RECORDER_METHOD_REQUIRED',
    'GATE_INTERSTITIAL_DIAGNOSTICS_REQUIRED',
  ].forEach((token) => {
    if (!gateInterstitialSource.includes(token)) {
      fail(`src/domains/protection/background/GateInterstitialController.js missing gate owner visibility token ${token}.`);
    }
    if (!lazyGateInterstitialSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelLazyGateInterstitialController.js missing gate owner visibility token ${token}.`);
    }
  });

  [
    'gatePresentationTailsByTabId',
    'activeGatePresentationCounts',
    'navigationObservationFloor',
    'GATE_INTERSTITIAL_MUTATION_FENCE_REQUIRED',
    'GATE_INTERSTITIAL_MUTATION_FENCE_MUST_BE_SYNCHRONOUS',
    'assertGateMutationFenceCurrent',
    "'gate_controller_before_redirect_session_upsert'",
    "'gate_controller_before_redirect_tabs_update'",
    "documentDisposition: GATE_DOCUMENT_DISPOSITIONS.PRESERVED",
    "documentDisposition: GATE_DOCUMENT_DISPOSITIONS.REDIRECTED",
    'restoreStagedGateSessionAfterFailure',
    'readProtectedTabInventoryOwner',
    'refreshDetourSessions',
    'gateDocumentId',
    'beforeGateNavigation',
    "'gate_controller_after_group_release'",
    "reason: 'blocking_session_owned'",
  ].forEach((token) => {
    if (!gateInterstitialSource.includes(token)) {
      fail(`src/domains/protection/background/GateInterstitialController.js missing serialized Gate lifecycle token ${token}.`);
    }
  });

  if (gateInterstitialSource.includes('settlePreparedPresentation') || lazyGateInterstitialSource.includes('settlePreparedPresentation')) {
    fail('Gate controllers must not restore retired inline presentation settlement.');
  }

  [
    'recordGateInterventionShown = null',
    'interventionStatsRecorder = null',
    "typeof recordGateInterventionShown === 'function'",
    "typeof applyGateInterventionDecision !== 'function'",
    'GATE_INTERSTITIAL_DECISION_HANDLER_UNAVAILABLE',
    'const fn = recorder && typeof recorder[method] ===',
    'if (!fn) return Promise.resolve(false);',
    "console.warn('[GateInterstitialController] intervention stats record failed:",
  ].forEach((token) => {
    if (gateInterstitialSource.includes(token) || lazyGateInterstitialSource.includes(token)) {
      fail(`gate interstitial controllers must require owners instead of fallback token ${token}.`);
    }
  });
  for (const [file, gateSource, requireHistoryEffectGate] of [
    ['GateInterstitialController.js', gateInterstitialSource, true],
    ['backgroundKernelLazyGateInterstitialController.js', lazyGateInterstitialSource, false],
  ]) {
    const violations = findGateOwnerFallbackViolations(gateSource, { requireHistoryEffectGate });
    if (violations.length) fail(`${file} violates Gate owner/effect history boundaries: ${violations.join(', ')}.`);
  }

  if (/\bchrome\./u.test(notificationServiceSource) || /typeof\s+chrome/u.test(notificationServiceSource) || /globalThis\.chrome/u.test(notificationServiceSource)) {
    fail('src/domains/notifications/background/NotificationService.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(notificationCapabilitySource) || /typeof\s+chrome/u.test(notificationCapabilitySource) || /globalThis\.chrome/u.test(notificationCapabilitySource)) {
    fail('src/domains/notifications/capability/notificationCapability.js must receive browser ports or platform capability seams instead of using chrome directly.');
  }

  [
    'NOTIFICATION_CAPABILITY_BROWSER_PORT_REQUIRED',
    'NOTIFICATION_CAPABILITY_BROWSER_PORT_METHOD_REQUIRED',
    'NOTIFICATION_CAPABILITY_BROWSER_PORT_RESULT_INVALID',
    'requireBooleanCapabilityResult',
  ].forEach((token) => {
    if (!notificationCapabilitySource.includes(token)) {
      fail(`src/domains/notifications/capability/notificationCapability.js must include strict capability token ${token}.`);
    }
  });
  [
    'ChromeService.js',
    'hasChromeNotifications',
    'hasChromeRuntime',
  ].forEach((token) => {
    if (notificationCapabilitySource.includes(token)) {
      fail(`src/domains/notifications/capability/notificationCapability.js must not use platform fallback token ${token}; callers must provide browser ports.`);
    }
  });
  [
    'normalizeLegacyNotificationRoute',
    'normalizeLegacyTabId',
    "tabId === 'schedule'",
    "tabId === 'main'",
  ].forEach((token) => {
    if (notificationRoutesSource.includes(token)) {
      fail(`src/domains/notifications/contracts/notificationRoutes.js must not preserve legacy tab route fallback token ${token}.`);
    }
  });
  if (!notificationRoutesSource.includes('NOTIFICATION_ROUTE_TARGET_UNSUPPORTED')) {
    fail('src/domains/notifications/contracts/notificationRoutes.js must throw on unsupported builder targets.');
  }
  if (!notificationRoutesSource.includes('NOTIFICATION_ROUTE_PARAMS_INVALID')) {
    fail('src/domains/notifications/contracts/notificationRoutes.js must reject malformed params instead of dropping them.');
  }

  if (/\bchrome\./u.test(coreServicesSource) || /typeof\s+chrome/u.test(coreServicesSource) || /globalThis\.chrome/u.test(coreServicesSource)) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must use app-runtime browser ports instead of chrome directly.');
  }
  [
    'BACKGROUND_STATS_QUERY_INTERVENTION_EFFECTS_REQUIRED',
  ].forEach((token) => {
    if (!statsQueryServicesSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelStatsQueryServices.js must require Sites evidence query owner token ${token}.`);
    }
  });
  [
    'getInterventionEffectsRange = null',
  ].forEach((token) => {
    if (statsQueryServicesSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelStatsQueryServices.js must not preserve optional evidence reader fallback token ${token}.`);
    }
  });
  [
    ['src/apps/background/services/runtime/backgroundKernelCoreServices.js', coreServicesSource],
    [kernelPath, source],
    ['src/apps/background/services/runtime/backgroundKernelStorageSupportBindings.js', storageSupportBindingsSource],
    ['src/apps/background/services/runtime/backgroundKernelStorageMaintenanceBindings.js', storageMaintenanceBindingsSource],
    ['src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js', backgroundMaintenanceCoordinatorSource],
    ['src/apps/background/services/runtime/backgroundKernelStatsQueryServices.js', statsQueryServicesSource],
  ].forEach(([filePath, fileSource]) => {
    if (/statsTransitionEdgeRepository|getStatsTransitionEdgesRange|StatsTransitionEdgeRepository/u.test(fileSource)) {
      fail(`${filePath} must not reintroduce the retired standalone transition-edge repository wiring.`);
    }
  });

  if (/\bchrome\./u.test(clseContextSource) || /typeof\s+chrome/u.test(clseContextSource) || /globalThis\.chrome/u.test(clseContextSource)) {
    fail('src/apps/background/services/runtime/backgroundKernelClseContext.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionServiceBindingsSource) || /typeof\s+chrome/u.test(protectionServiceBindingsSource) || /globalThis\.chrome/u.test(protectionServiceBindingsSource)) {
    fail('src/apps/background/services/runtime/backgroundKernelProtectionServiceBindings.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(protectionRuntimeSnapshotEventsSource) || /typeof\s+chrome/u.test(protectionRuntimeSnapshotEventsSource) || /globalThis\.chrome/u.test(protectionRuntimeSnapshotEventsSource)) {
    fail('src/domains/protection/background/runtime/protectionRuntimeSnapshotEvents.js must receive browser ports instead of using chrome directly.');
  }

  if (!audioDullingCoordinatorSource.includes('AUDIO_DULLING_BROWSER_PORT_METHOD_REQUIRED')) {
    fail('src/domains/protection/background/audioDulling/AudioDullingCoordinator.js must validate injected browser port methods explicitly.');
  }

  [
    'createDefaultBrowserPort',
    'browserPort = createDefaultBrowserPort()',
    'runtimeSendMessage?.',
    'runtimeGetURL?.',
    'runtimeGetContexts?.',
    'offscreenCreateDocument?.',
    'permissionsContains?.',
    'permissionsRequest?.',
    'tabCaptureGetMediaStreamId?.',
  ].forEach((token) => {
    if (audioDullingCoordinatorSource.includes(token)) {
      fail(`src/domains/protection/background/audioDulling/AudioDullingCoordinator.js must require explicit dormant audio owners instead of fallback token ${token}.`);
    }
  });

  if (/\bchrome\./u.test(statsEventBridgeSource) || /typeof\s+chrome/u.test(statsEventBridgeSource) || /globalThis\.chrome/u.test(statsEventBridgeSource)) {
    fail('src/domains/stats/background/contracts/statsEventBridge.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(statsRuntimeServiceSource) || /typeof\s+chrome/u.test(statsRuntimeServiceSource) || /globalThis\.chrome/u.test(statsRuntimeServiceSource)) {
    fail('src/domains/stats/background/runtime/statsRuntimeService.js must receive browser ports instead of using chrome directly.');
  }

  if (!siteInterventionStatsRecorderSource.includes('SITE_INTERVENTION_EFFECT_REPOSITORY_REQUIRED')) {
    fail('src/domains/stats/background/collection/siteInterventionStatsRecorder.js must require the intervention effect repository explicitly.');
  }
  if (!siteInterventionStatsRecorderSource.includes('SITE_INTERVENTION_TELEMETRY_ADMISSION_OWNER_REQUIRED')) {
    fail('src/domains/stats/background/collection/siteInterventionStatsRecorder.js must require the current collection-admission owner explicitly.');
  }
  if (
    !coreServicesSource.includes('isInterventionTelemetryAdmitted: (hostname) => shouldCollectDomainUsage(')
    || !coreServicesSource.includes('settingsService.getSettingsCache()')
  ) {
    fail('src/apps/background/services/runtime/backgroundKernelCoreServices.js must gate intervention telemetry with the current canonical settings cache.');
  }

  [
    'interventionEffectRepository = null',
    '? interventionEffectRepository',
    'if (!effectRepository) return Promise.resolve(null);',
    "artifactId || payload.rendererId || payload.gatekeeperInterstitialRendererId || 'unknown'",
    "payload.rendererId || payload.gatekeeperInterstitialRendererId || 'unknown'",
    "console.warn('[SiteInterventionStatsRecorder] exposure record failed:",
    "console.warn('[SiteInterventionStatsRecorder] outcome record failed:",
  ].forEach((token) => {
    if (siteInterventionStatsRecorderSource.includes(token)) {
      fail(`src/domains/stats/background/collection/siteInterventionStatsRecorder.js must require effect repository ownership instead of fallback token ${token}.`);
    }
  });
  [
    "session.gatekeeperInterstitialRendererId || session.gatekeeperRendererId || 'unknown'",
    "session.gatekeeperInterstitialRendererId || session.gatekeeperRendererId || ''",
  ].forEach((token) => {
    if (gateInterstitialSource.includes(token)) {
      fail(`src/domains/protection/background/GateInterstitialController.js must pass canonical gate stats artifact identity instead of fallback token ${token}.`);
    }
  });

  if (/\bchrome\./u.test(trackingBrowserEventSource) || trackingBrowserEventSource.includes('typeof chrome')) {
    fail('src/domains/tracking/background/trackingBrowserEventHandlers.js must receive browser ports instead of using chrome directly.');
  }

  if (/\bchrome\./u.test(historyManagerSource) || historyManagerSource.includes('typeof chrome')) {
    fail('src/domains/tracking/background/HistoryManager.js must receive browser ports instead of using chrome directly.');
  }

  if (historyManagerSource.includes('EMPTY_HISTORY_BROWSER_PORT')) {
    fail('src/domains/tracking/background/HistoryManager.js must fail on missing browser ports instead of using an empty no-op port.');
  }

  if (!historyManagerSource.includes('HISTORY_BROWSER_PORT_METHOD_REQUIRED')) {
    fail('src/domains/tracking/background/HistoryManager.js must validate injected browser port methods explicitly.');
  }

  [
    "typeof browserPort?.historySearch !== 'function'",
    "typeof browserPort?.historyDeleteUrl !== 'function'",
  ].forEach((token) => {
    if (historyManagerSource.includes(token)) {
      fail(`src/domains/tracking/background/HistoryManager.js must rely on its validated browser port instead of fallback token ${token}.`);
    }
  });

  [
    'HISTORY_SEARCH_API_UNAVAILABLE',
    'HISTORY_SEARCH_API_FAILED',
    'HISTORY_SEARCH_INVALID_RESULT',
    'HISTORY_DELETE_API_UNAVAILABLE',
    'HISTORY_DELETE_API_FAILED',
    'BOOKMARK_TREE_API_UNAVAILABLE',
    'BOOKMARK_TREE_API_FAILED',
    'BOOKMARK_TREE_INVALID_RESULT',
    'BOOKMARK_REMOVE_API_UNAVAILABLE',
    'BOOKMARK_REMOVE_API_FAILED',
  ].forEach((token) => {
    if (!historyBrowserPortSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelHistoryBrowserPort.js missing API failure visibility token ${token}.`);
    }
  });

  [
    'callExtensionCallbackApi(chromeApi',
    'callChromeApi(',
    '], [], chromeApi?.history',
    '], null, chromeApi?.history',
    '], [], chromeApi?.bookmarks',
    '], null, chromeApi?.bookmarks',
  ].forEach((token) => {
    if (historyBrowserPortSource.includes(token)) {
      fail(`src/apps/background/services/runtime/backgroundKernelHistoryBrowserPort.js must surface history/bookmark API failures instead of fallback token ${token}.`);
    }
  });

  if (/\bchrome\./u.test(bookmarkConcealManagerSource) || bookmarkConcealManagerSource.includes('typeof chrome')) {
    fail('src/domains/tracking/background/BookmarkConcealManager.js must receive browser ports instead of using chrome directly.');
  }

  if (bookmarkConcealManagerSource.includes('EMPTY_BOOKMARK_BROWSER_PORT')) {
    fail('src/domains/tracking/background/BookmarkConcealManager.js must fail on missing browser ports instead of using an empty no-op port.');
  }

  if (!bookmarkConcealManagerSource.includes('BOOKMARK_BROWSER_PORT_METHOD_REQUIRED')) {
    fail('src/domains/tracking/background/BookmarkConcealManager.js must validate injected browser port methods explicitly.');
  }

  [
    'BOOKMARK_TREE_READ_FAILED',
    'BOOKMARK_REMOVE_FAILED',
  ].forEach((token) => {
    if (!bookmarkConcealManagerSource.includes(token)) {
      fail(`src/domains/tracking/background/BookmarkConcealManager.js missing bookmark failure visibility token ${token}.`);
    }
  });

  [
    'BOOKMARK_LEGACY_BACKUP_REPOSITORY_REQUIRED',
    'clearLegacyBackups',
    'hiddenBookmarkRepository?.clearLegacyBackups',
    'hiddenBookmarkRepository?.clear',
    "typeof browserPort?.bookmarksGetTree !== 'function'",
    'if (!isBookmarkApiAvailable(browserPort)) return [];',
  ].forEach((token) => {
    if (bookmarkConcealManagerSource.includes(token)) {
      fail(`src/domains/tracking/background/BookmarkConcealManager.js must surface bookmark owner/API failures instead of fallback token ${token}.`);
    }
  });

  const goalEndOwners = [
    ['src/apps/background/services/runtime/backgroundKernelGuidanceSettings.js', [
      'requireNudgeGoalEnds(settings.nudgeConfig?.goalEnds)',
      'nudgeConfig: normalizeStoredNudgeConfig(settings.nudgeConfig)',
    ]],
    ['src/domains/guidance/background/GuidanceService.js', [
      "isGoalEndEnabled(settings.nudgeConfig, 'global')",
      "isGoalEndEnabled(ctx.settings.nudgeConfig, 'global')",
      'ack.committedItems?.nudgeConfig?.goalEnds?.global !== true',
      'requireNudgeGoalEnds(ack.committedItems.nudgeConfig.goalEnds)',
    ]],
    ['src/domains/protection/background/ProfileResolver.js', [
      'mergedArtifacts.flare = { enabled: goalEndsEnabled, autoTrigger: goalEndsEnabled }',
      'applyArtifactControlStateToPreferences(mergedArtifacts, source?.artifactControlState)',
    ]],
  ];
  for (const [ownerPath, tokens] of goalEndOwners) {
    const ownerSource = await fs.readFile(path.resolve(rootDir, ownerPath), 'utf8');
    for (const token of tokens) {
      if (!ownerSource.includes(token)) fail(`${ownerPath}: missing canonical goal-end ownership ${token}.`);
    }
    if (/nudgeConfig\??\.enabled/u.test(ownerSource)) fail(`${ownerPath}: stored master activation must not replace independent goal-end preferences.`);
  }

  console.log('[background-app-kernel-architecture] PASS: BackgroundAppKernel.js stays on-demand and composition-root focused.');
};

main().catch((error) => {
  console.error('[background-app-kernel-architecture] Unexpected error:', error);
  process.exit(1);
});
