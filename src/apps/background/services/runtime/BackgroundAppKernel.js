import {
  configureCLSEProfileMutationRuntimeAdmission,
  initCLSE,
  quiesceCLSEForProfileMutation,
  recordCLSEShortDwell,
  runCLSEHeartbeat,
  runCLSEStorageSnapshotImport,
} from '../../../../domains/behavior/CLSEServiceClient.js';
import { createBackgroundKernelAnalyticsBindings } from './backgroundKernelAnalyticsBindings.js';
import { createBackgroundBehaviorPolicy } from './backgroundKernelBehaviorPolicy.js';
import { createBackgroundKernelBootstrapBindings } from './backgroundKernelBootstrapBindings.js';
import { createResolveClseContextHostname } from './backgroundKernelClseContext.js';
import { createBackgroundKernelContentScriptBindings } from './backgroundKernelContentScriptBindings.js';
import { createBackgroundKernelCoreServices, DEFAULT_FILTER_SETTINGS } from './backgroundKernelCoreServices.js';
import { createBackgroundKernelMessageBindings } from './backgroundKernelMessageBindings.js';
import { createWorkerRuntimeEventCapability } from '../../../../platform/storage/runtime/WorkerRuntimeEventCapability.js';
import { configureWorkerRuntimeEventPersistencePort } from '../../../../platform/storage/runtime/WorkerRuntimeEventRepository.js';
import { quiesceWorkerRuntimeTelemetryForProfileMutation } from '../../../../platform/workers/runtime/WorkerTelemetry.js';
import { createBackgroundKernelNudgeRuntimeBindings } from './backgroundKernelNudgeRuntimeBindings.js';
import { createBackgroundKernelNudgeTerminalEffectBindings } from './backgroundKernelNudgeTerminalEffectBindings.js';
import { createBackgroundKernelProtectionBindings } from './backgroundKernelProtectionBindings.js';
import { createBackgroundKernelRuntimeIntegrationBindings } from './backgroundKernelRuntimeIntegrationBindings.js';
import { createBackgroundKernelSettingsPropagationBindings } from './backgroundKernelSettingsPropagationBindings.js';
import { createBackgroundKernelStorageSupportBindings } from './backgroundKernelStorageSupportBindings.js';
import {
  createBackgroundKernelZenProfileGenerationInitializer,
  createBackgroundKernelZenProfileGenerationState,
} from './backgroundKernelZenProfileGenerationFactory.js';
import {
  createBackgroundKernelZenProfileGenerationReadiness,
} from './backgroundKernelZenProfileGenerationReadiness.js';
import { createFlushTacticalLogsWrapper } from './backgroundKernelTacticalLogs.js';
import { createBackgroundKernelTrackingRuntimeBindings } from './backgroundKernelTrackingRuntimeBindings.js';
import { createLazyBackgroundZenPairwiseGpService } from './backgroundKernelLazyZenPairwiseGpService.js';
import {
  createBackgroundKernelProfileMutationRuntimeGate,
} from './backgroundKernelProfileMutationBindings.js';
import {
  createBackgroundKernelProfileMutationRuntimeLifetimePort,
} from './backgroundKernelProfileMutationRuntimeLifetimePort.js';
import { callRequiredBackgroundKernelBridge } from './backgroundKernelBridgeGuards.js';
import {
  installBackgroundServiceWorkerWakeTelemetry,
  observeBackgroundRuntimeMessageHandler,
} from './support/BackgroundServiceWorkerWakeTelemetry.js';
import {
  createTrackingContentProtectionSync,
} from '../../../../domains/tracking/background/trackingContentProtectionSync.js';
import { createTrackingPolicyMutationOwner } from './support/BackgroundTrackingBoundaryAdapter.js';

export function createBackgroundAppKernel() {
  const serviceWorkerWakeTelemetry = installBackgroundServiceWorkerWakeTelemetry();
  let syncManagedContentScriptsBridge = null;
  let protectionNudgeStopBridge = null;
  let broadcastSettingsUpdateBridge = null;
  let scheduleNudgeTerminalOutboxDrainBridge = null, backgroundBootstrapCoordinator = null;
  let qualifiedDayFollowupAdmissionBridge = null;

  const syncManagedContentScriptsThroughBridge = (...args) => callRequiredBackgroundKernelBridge(syncManagedContentScriptsBridge, 'BACKGROUND_KERNEL_CONTENT_SCRIPT_SYNC_BRIDGE_UNINITIALIZED', args);
  const stopNudgeForTabThroughBridge = (...args) => callRequiredBackgroundKernelBridge(protectionNudgeStopBridge, 'BACKGROUND_KERNEL_PROTECTION_NUDGE_STOP_BRIDGE_UNINITIALIZED', args);
  const broadcastSettingsUpdateThroughBridge = (...args) => {
    if (typeof broadcastSettingsUpdateBridge === 'function') {
      return broadcastSettingsUpdateBridge(...args);
    }
  };
  const scheduleNudgeTerminalOutboxDrainThroughBridge = (...args) => callRequiredBackgroundKernelBridge(scheduleNudgeTerminalOutboxDrainBridge, 'BACKGROUND_KERNEL_NUDGE_TERMINAL_OUTBOX_BRIDGE_UNINITIALIZED', args);
  const getBootstrapInitPromiseThroughBridge = () => callRequiredBackgroundKernelBridge(backgroundBootstrapCoordinator && backgroundBootstrapCoordinator.getInitPromise, 'BACKGROUND_KERNEL_BOOTSTRAP_COORDINATOR_UNINITIALIZED');
  const getDashboardBootReadinessPromiseThroughBridge = () => callRequiredBackgroundKernelBridge(backgroundBootstrapCoordinator && backgroundBootstrapCoordinator.getDashboardBootReadinessPromise, 'BACKGROUND_KERNEL_BOOTSTRAP_COORDINATOR_UNINITIALIZED');
  const getProfileGenerationBootSettlementPromiseThroughBridge = () => callRequiredBackgroundKernelBridge(backgroundBootstrapCoordinator && backgroundBootstrapCoordinator.getProfileGenerationBootSettlementPromise, 'BACKGROUND_KERNEL_BOOTSTRAP_COORDINATOR_UNINITIALIZED');

  const {
    runtimeSessionRepository, profileResetLifecycleRepository,
    settingsDocumentRepository, settingsPersistence, runtimeLanguageRepository,
    keyMaterialRepository, modelStateRepository, zenModelRepository, zenArtifactRepository,
    feedTopologyPersistentCertificationService,
    faviconRepository, eventLogRepository, statsFeaturePackRepository,
    interventionEffectRepository, clseRepository, clseSettingsQueryService, clseSignalQueryService,
    storageInspectorQueryService, storageSnapshotCapability,
    runtimeFlagRepository, gateInterventionSessionRepository, interventionLedgerRepository,
    bootstrapSnapshotRepository,
    settingsService, settingsCache,
    statsRepository, statsRuntimeHealthLedger,
    statsRuntimeService, statsCollector, runtimeBrowserPort, siteInterventionStatsRecorder, idleDetector, trackingBrowserPort,
    statsAnalysisQueryService,
    statsTrendQueryService,
    progressionRepository,
    progressionService,
    guidanceService,
    artifactDisclosureBootstrap,
    tabTimeTracker,
    tacticalLogger,
    statsRetentionJob,
    cycleStateManager,
    bootPrewarmService,
    popupBlockFlow, faviconService, notificationService, sentinelProtocolTimeline, specialSessionRuntime,
  } = createBackgroundKernelCoreServices({
    syncManagedContentScripts: syncManagedContentScriptsThroughBridge,
    broadcastSettingsUpdate: broadcastSettingsUpdateThroughBridge,
    runQualifiedDayFollowup: (...args) => callRequiredBackgroundKernelBridge(qualifiedDayFollowupAdmissionBridge, 'BACKGROUND_KERNEL_GUIDANCE_ADMISSION_UNINITIALIZED', args),
  });
  settingsService.setTrackingPolicyMutationOwner(createTrackingPolicyMutationOwner({
    runStatsMutationBatch: statsRuntimeService.runStatsMutationBatch,
    sealActiveSegment: tabTimeTracker.recordActiveTabDuration,
    primeActiveTrackingBoundary: tabTimeTracker.primeActiveTrackingBoundary,
  }));
  const profileMutationRuntimeGate = createBackgroundKernelProfileMutationRuntimeGate({
    profileResetLifecycleRepository,
  });
  qualifiedDayFollowupAdmissionBridge = profileMutationRuntimeGate.runAdmitted.bind(profileMutationRuntimeGate);
  const profileMutationRuntimeLifetimePort = (
    createBackgroundKernelProfileMutationRuntimeLifetimePort()
  );
  const workerRuntimeEventCapability = createWorkerRuntimeEventCapability({
    runtimeAdmissionGate: profileMutationRuntimeGate,
    lifecycleRepository: profileResetLifecycleRepository,
    quiesceLocalTelemetry: quiesceWorkerRuntimeTelemetryForProfileMutation,
  });
  configureWorkerRuntimeEventPersistencePort({ request: workerRuntimeEventCapability.request });
  const initializeZenProfileGeneration = createBackgroundKernelZenProfileGenerationInitializer({
    modelStateRepository,
    profileResetLifecycleRepository,
    profileMutationRuntimeGate,
  });
  const profileGenerationReadiness = createBackgroundKernelZenProfileGenerationReadiness({
    modelStateRepository,
    profileResetLifecycleRepository,
    settingsService,
  });
  configureCLSEProfileMutationRuntimeAdmission({
    captureAdmission: profileMutationRuntimeGate.capture.bind(profileMutationRuntimeGate),
    runCapturedTask: profileMutationRuntimeGate.runCaptured.bind(profileMutationRuntimeGate),
  });
  const resolveClseContextHostname = createResolveClseContextHostname({ browserPort: runtimeBrowserPort });
  const { contentRuntimeDiagnostics, contentScriptOrchestrator } = createBackgroundKernelContentScriptBindings({
    settingsService, settingsCache, bootstrapSnapshotRepository,
  });

  const {
    reconcileNudgeDebtSession,
    sweepExpiredPendingNudges,
    abortNudgesForTab,
    markNudgePresented, markNudgeEpisodeCompleted, markNudgeResolved, markNudgeAborted,
    markNudgeTerminalOutboxStageFailed,
    markNudgeTerminalOutboxStageCompleted,
    readPendingNudgeTerminalOutboxEntries,
    nudgeWindowBlurController,
  } = createBackgroundKernelNudgeRuntimeBindings({
    settingsService,
    settingsCache,
    stopNudgeForTab: stopNudgeForTabThroughBridge,
  });
  const {
    protectionDispatcher,
    protectionRuntimeStateCoordinator,
    trackingProtectionService,
    gateInterstitialController,
    frictionBootstrapCoordinator,
    getGlobalCapState,
    getProtectionRuntimeSnapshot,
    refreshProtectionRuntimeSnapshot,
    interventionLedger,
    requestTabClosure,
    maybeTriggerProtectionNudge,
    sendProtectionUpdate,
    broadcastSettingsUpdate,
    configureSettingsPipeline,
    tabManagement,
  } = createBackgroundKernelProtectionBindings({
    profileResetLifecycleRepository,
    settingsService, settingsCache, runtimeFlagRepository, clseSignalQueryService,
    statsRuntimeService, cycleStateManager, tabTimeTracker, siteInterventionStatsRecorder,
    gateInterventionSessionRepository, interventionLedgerRepository, abortNudgesForTab,
    scheduleNudgeTerminalOutboxDrain: scheduleNudgeTerminalOutboxDrainThroughBridge,
    bootstrapSnapshotRepository,
    progressionService,
    runtimeLanguageRepository,
    defaultFilterSettings: DEFAULT_FILTER_SETTINGS,
    resolveClseContextHostname,
    contentRuntimeDiagnostics,
    contentScriptOrchestrator,
    sentinelProtocolTimeline,
    runtimeBrowserPort,
    runProfileMutationAdmittedTask: profileMutationRuntimeGate.runAdmittedLocal.bind(
      profileMutationRuntimeGate,
    ),
  });
  protectionNudgeStopBridge = protectionDispatcher.stopNudgeForTab.bind(protectionDispatcher);
  guidanceService.setGlobalCapStateReader(getGlobalCapState);
  broadcastSettingsUpdateBridge = broadcastSettingsUpdate;
  const contentProtectionSync = createTrackingContentProtectionSync({
    contentScriptOrchestrator,
    contentRuntimeDiagnostics,
    sendProtectionUpdate,
    captureProfileMutationRuntimeAdmission: profileMutationRuntimeGate.capture.bind(
      profileMutationRuntimeGate,
    ),
    runCapturedProfileMutationRuntimeTask: profileMutationRuntimeGate.runCaptured.bind(
      profileMutationRuntimeGate,
    ),
  });
  const zenPairwiseGpService = createLazyBackgroundZenPairwiseGpService({
    modelStateStore: zenModelRepository,
  });
  const flushTacticalLogsWrapper = createFlushTacticalLogsWrapper({
    tacticalLogger,
    getActiveTabInfo: () => tabTimeTracker.getActiveTabInfo(),
    buildBackgroundContext: tabTimeTracker.buildBackgroundContext,
    readFilterSettings: () => settingsService.getSettingsCache().filterSettings,
  });
  const {
    checkGlobalCapStatus,
    syncManagedContentScripts,
    checkScheduleStatus, endScheduleOccurrence, runManualSessionMutation, getSkippedOccurrenceId, getManualSession, applyScheduleRuntimeSettings,
    runNudgePendingSweep,
    cleanupBlockedHistory: cleanupBlockedHistoryBase,
    previewBlockedHistory, previewBlockedBookmarks, exportBlockedBookmarksHtml,
    cleanupRecentBlockedHistory, syncBlockedBookmarks: syncBlockedBookmarksBase,
    maybeDeleteHistoryForUrl,
    sweepStaleTabs,
    resetTabEvaporation,
  } = createBackgroundKernelRuntimeIntegrationBindings({
    hasPendingTabEvaporationSettings: () => settingsPropagationCoordinator.hasPendingRuntimeSettingsAdapters([
      'blockedUrls', 'tabEvaporationForBlocked', 'tabEvaporationTimeoutMinutes', 'artifactControlState',
    ]),
    settingsService,
    settingsCache,
    getGlobalCapState,
    broadcastSettingsUpdate,
    sweepExpiredPendingNudges,
    protectionDispatcher,
    runtimeFlagRepository,
    notificationService,
    contentScriptOrchestrator,
    browserPort: runtimeBrowserPort,
  });
  const backgroundBehaviorPolicy = createBackgroundBehaviorPolicy({
    settingsCache,
    getActiveHostname: () => tabTimeTracker.getActiveTabInfo()?.hostname ?? null,
    getSkippedOccurrenceId,
    getSpecialSessionState: getManualSession,
  });
  syncManagedContentScriptsBridge = syncManagedContentScripts;
  const {
    cleanupBlockedHistory, syncBlockedBookmarks,
    reconcileHistoryCleanupOnActivation,
    reconcileHistoryCleanupAfterPermissionAdded,
    runMemoryPurgeArtifactCleanup, settingsPropagationCoordinator, settingsPropagationQaFixture,
  } = createBackgroundKernelSettingsPropagationBindings({
    settingsService,
    settingsCache,
    cleanupBlockedHistoryBase,
    cleanupRecentBlockedHistory,
    syncBlockedBookmarksBase,
    syncManagedContentScripts,
    resetTabEvaporation,
    broadcastSettingsUpdate: applyScheduleRuntimeSettings,
    tabManagement,
    gateInterstitialController,
    trackingProtectionService,
    runtimeSessionRepository,
    primeActiveTrackingBoundary: async () => {
      const now = Date.now();
      await tabTimeTracker.primeActiveTrackingBoundary(now);
      await statsRuntimeService.saveStatsCache();
    },
  });
  const nudgeTerminalEffectCoordinator = createBackgroundKernelNudgeTerminalEffectBindings({
    settingsService, runtimeFlagRepository, trackingProtectionService,
    schedulePostCommitSettingsEffects: settingsPropagationCoordinator.schedulePostCommitEffects,
    readPendingEntries: readPendingNudgeTerminalOutboxEntries,
    markStageCompleted: markNudgeTerminalOutboxStageCompleted,
    markStageFailed: markNudgeTerminalOutboxStageFailed,
  });
  scheduleNudgeTerminalOutboxDrainBridge = nudgeTerminalEffectCoordinator.scheduleDrain;
  const backgroundKernelTrackingRuntimeBindings = createBackgroundKernelTrackingRuntimeBindings({
    tabTimeTracker,
    statsRuntimeService,
    checkScheduleStatus,
    checkGlobalCapStatus,
    trackingProtectionService,
    frictionBootstrapCoordinator,
    syncManagedContentScripts,
    maybeTriggerProtectionNudge,
    flushTacticalLogsWrapper,
    getInitPromise: getBootstrapInitPromiseThroughBridge,
    runProfileMutationAdmittedTask: profileMutationRuntimeGate.runAdmittedLocal.bind(
      profileMutationRuntimeGate,
    ),
    captureProfileMutationRuntimeAdmission: profileMutationRuntimeGate.capture.bind(
      profileMutationRuntimeGate,
    ),
    runCapturedProfileMutationRuntimeTask: profileMutationRuntimeGate.runCaptured.bind(
      profileMutationRuntimeGate,
    ),
    runNudgePendingSweep,
    clearNudgeWindowBlurTimer: () => nudgeWindowBlurController.clear(),
    cycleStateManager,
    backgroundBehaviorPolicy,
    recordCLSEShortDwell,
    faviconService,
    sendProtectionUpdate,
    handleWindowBlurNudgeAbort: async (tabId, now = Date.now()) => (
      nudgeWindowBlurController.handleWindowBlurAbort(tabId, now)
    ),
    maybeDeleteHistoryForUrl,
    cleanupRecentBlockedHistory, runMemoryPurgeArtifactCleanup,
    sweepStaleTabs,
    nudgeWindowBlurController,
    protectionDispatcher,
    gateInterstitialController,
    observeGateSitePresence: options => trackingProtectionService.observeGateSitePresence(options),
    protectionRuntimeStateCoordinator,
    contentScriptOrchestrator, waitForSettingsPropagationIdle: settingsPropagationCoordinator.waitForIdle,
    tacticalLogger,
    browserPort: trackingBrowserPort,
    runtimeSessionRepository,
    statsRuntimeHealthLedger,
    contentProtectionSync,
    runCLSEHeartbeat,
  });

  const analyticsRuntimeBindings = createBackgroundKernelAnalyticsBindings({
    statsTickRuntimeService: backgroundKernelTrackingRuntimeBindings.statsTickRuntimeService,
    nudgeWindowBlurController,
    onIdleStateChange: tabTimeTracker.onIdleStateChange,
    observeEnsoIdleState: backgroundKernelTrackingRuntimeBindings.observeEnsoIdleState,
    setupIdleDetection: idleDetector.setupIdleDetection,
    runProfileMutationAdmittedTask: profileMutationRuntimeGate.runAdmittedLocal.bind(
      profileMutationRuntimeGate,
    ),
    maybeDeleteHistoryForUrl,
  });

  configureSettingsPipeline({
    settingsService,
    schedulePostCommitSettingsEffects: settingsPropagationCoordinator.schedulePostCommitEffects,
    waitForPostCommitSettingsTask: settingsPropagationCoordinator.waitForTask,
    syncManagedContentScripts,
    invalidateBootPrewarmSnapshot: (reason) => bootPrewarmService.invalidate(reason),
  });
  const storageSupportBindings = createBackgroundKernelStorageSupportBindings({
    workerRuntimeEventCapability,
    statsRuntimeService,
    statsRepository,
    eventLogRepository,
    tabTimeTracker,
    setLastTrackedAt: analyticsRuntimeBindings.setLastTrackedAt,
    faviconRepository,
    statsFeaturePackRepository,
    interventionEffectRepository,
    settingsDocumentRepository,
    modelStateRepository,
    zenArtifactRepository,
    keyMaterialRepository,
    cycleStateManager,
    runtimeSessionRepository,
    profileResetLifecycleRepository,
    settingsService,
    settingsPropagationCoordinator,
    quiesceTrackingTickRunnerForProfileMutation:
      backgroundKernelTrackingRuntimeBindings.quiesceForProfileMutation,
    nudgeWindowBlurController,
    nudgeTerminalEffectCoordinator,
    quiesceCLSEForProfileMutation,
    checkGlobalCapStatus,
    bootPrewarmService,
    settingsPersistence,
    statsRetentionJob,
    storageInspectorQueryService,
    storageSnapshotCapability,
    frictionBootstrapCoordinator,
    progressionService,
    guidanceService,
    zenModelRepository,
    zenPairwiseGpService,
    profileMutationRuntimeGate,
    profileMutationRuntimeLifetimePort,
    runCLSEStorageSnapshotImport,
    getRuntimeReadinessPromise: getBootstrapInitPromiseThroughBridge,
    createZenProfileGenerationState: createBackgroundKernelZenProfileGenerationState,
  });
  const {
    combinedMessageHandler: baseCombinedMessageHandler,
    handleBuildCapabilityActionClicked,
  } = createBackgroundKernelMessageBindings({
    keyMaterialRepository,
    resumeVaultBootstrap: () => backgroundBootstrapCoordinator.resumeAfterVaultUnlock(),
    bootstrapSnapshotRepository, runtimeLanguageRepository,
    workerRuntimeEventCapability,
    settingsPropagationQaFixture,
    statsRuntimeService, statsCollector, runtimeSessionRepository, statsAnalysisQueryService, statsTrendQueryService,
    statsRepository, tabTimeTracker, settingsService, settingsCache,
    settingsPersistence,
    broadcastSettingsUpdate,
    schedulePostCommitSettingsEffects: settingsPropagationCoordinator.schedulePostCommitEffects,
    runtimeFlagRepository,
    getProtectionRuntimeSnapshot,
    refreshProtectionRuntimeSnapshot,
    interventionLedger,
    requestTabClosure,
    storageSupportBindings,
    cleanupBlockedHistory,
    previewBlockedHistory, previewBlockedBookmarks, exportBlockedBookmarksHtml,
    faviconService,
    bootPrewarmService,
    zenPairwiseGpService,
    tacticalLogger,
    cycleStateManager,
    markNudgeAborted, markNudgePresented, markNudgeEpisodeCompleted, markNudgeResolved,
    scheduleNudgeTerminalOutboxDrain: nudgeTerminalEffectCoordinator.scheduleDrain,
    trackingProtectionService,
    gateInterstitialController,
    popupBlockFlow,
    clseRepository,
    prepareFeedFlowSnapshot: trackingProtectionService.prepareFeedFlowSnapshot,
    commitFeedFlowSnapshot: trackingProtectionService.commitFeedFlowSnapshot,
    recordContentFlowStats: tabTimeTracker.recordContentFlow,
    sendProtectionUpdate,
    contentScriptOrchestrator,
    contentRuntimeDiagnostics,
    contentProtectionSync,
    maybeTriggerProtectionNudge,
    sentinelProtocolTimeline, specialSessionRuntime,
    checkScheduleStatus, endScheduleOccurrence, runManualSessionMutation,
    progressionService,
    guidanceService,
    profileGenerationReadiness,
    feedTopologyPersistentCertificationService,
    getInitPromise: getBootstrapInitPromiseThroughBridge, getDashboardBootReadinessPromise: getDashboardBootReadinessPromiseThroughBridge,
    getProfileGenerationBootSettlementPromise: getProfileGenerationBootSettlementPromiseThroughBridge,
    readProfileMutationLifecycle: profileResetLifecycleRepository.read.bind(
      profileResetLifecycleRepository,
    ),
    profileMutationRuntimeGate,
    browserPort: trackingBrowserPort,
  });
  const combinedMessageHandler = observeBackgroundRuntimeMessageHandler({
    handler: baseCombinedMessageHandler,
    telemetry: serviceWorkerWakeTelemetry,
  });

  backgroundBootstrapCoordinator = createBackgroundKernelBootstrapBindings({
    keyMaterialRepository,
    statsRetentionJob,
    statsRuntimeService,
    initializeClseLabs: initCLSE,
    rolloverLifecycle: analyticsRuntimeBindings.rolloverLifecycle,
    settingsService,
    initializeArtifactDisclosure: artifactDisclosureBootstrap.initialize,
    bootPrewarmService,
    reconcileNudgeDebtSession,
    runNudgePendingSweep,
    popupBlockFlow,
    reconcileHistoryCleanupOnActivation,
    reconcileHistoryCleanupAfterPermissionAdded,
    reconcileStartupContentScripts: settingsPropagationCoordinator.reconcileStartupContentScripts,
    invalidateContentPermissions: () => {
      protectionDispatcher.invalidateDispatchPermissionCaches();
      contentScriptOrchestrator.invalidatePermissions();
    },
    checkGlobalCapStatus,
    syncBlockedBookmarks,
    restoreSettingsPropagation: settingsPropagationCoordinator.restorePendingEffects,
    drainNudgeTerminalOutbox: nudgeTerminalEffectCoordinator.drainPendingEffects,
    setupIdleDetection: analyticsRuntimeBindings.setupIdleDetection,
    idleDetector,
    tabTimeTracker,
    cycleStateManager,
    faviconService,
    handleAlarm: backgroundKernelTrackingRuntimeBindings.handleAlarm,
    handleTabActivated: backgroundKernelTrackingRuntimeBindings.handleTabActivated,
    handleTabCreated: backgroundKernelTrackingRuntimeBindings.handleTabCreated,
    handleWindowFocusChanged: backgroundKernelTrackingRuntimeBindings.handleWindowFocusChanged,
    handleTabUpdated: backgroundKernelTrackingRuntimeBindings.handleTabUpdated,
    handleTabRemoved: backgroundKernelTrackingRuntimeBindings.handleTabRemoved,
    handleTabReplaced: backgroundKernelTrackingRuntimeBindings.handleTabReplaced,
    handleWebNavigationCommitted: backgroundKernelTrackingRuntimeBindings.handleWebNavigationCommitted,
    handleWebNavigationHistoryStateUpdated: backgroundKernelTrackingRuntimeBindings.handleWebNavigationHistoryStateUpdated,
    handleHistoryVisited: analyticsRuntimeBindings.handleHistoryVisited,
    handleBuildCapabilityActionClicked,
    combinedMessageHandler,
    notificationService,
    clearNudgeWindowBlurTimer: analyticsRuntimeBindings.clearNudgeWindowBlurTimer,
    flushTacticalLogsWrapper,
    eventLogRepository,
    profileResetLifecycleRepository,
    profileMutationRuntimeGate,
    initializeZenProfileGeneration,
    serviceWorkerWakeTelemetry,
    browserPort: trackingBrowserPort,
    tabManagement,
  });

  return {
    init: () => backgroundBootstrapCoordinator.init(),
    registerListeners: () => backgroundBootstrapCoordinator.registerListeners(),
    start: () => backgroundBootstrapCoordinator.start(),
  };
}

let backgroundAppKernelInstance = null;

export function getBackgroundAppKernel() {
  if (!backgroundAppKernelInstance) {
    backgroundAppKernelInstance = createBackgroundAppKernel();
  }
  return backgroundAppKernelInstance;
}

export function startBackgroundAppKernel() {
  return getBackgroundAppKernel().start();
}
