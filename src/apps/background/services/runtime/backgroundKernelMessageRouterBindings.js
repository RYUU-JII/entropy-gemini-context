import { createBackgroundMessageRouter } from './BackgroundMessageRouter.js';
import { createBehaviorTelemetryRecorder } from '../../../../domains/stats/background/collection/behaviorTelemetryRecorder.js';
import VideoSkipPoolWriteCoordinator from '../../../../platform/storage/runtime/VideoSkipPoolWriteCoordinator.js';
import { BUILD_ENABLE_VIDEO_SKIP_COOLDOWN } from '../../../../platform/build/releaseCapabilities.js';
import { createNudgeFrameHostCapabilityBroker } from '../../../../domains/nudge/runtime/frame-host/NudgeFrameHostCapabilityBroker.js';

export function createBackgroundKernelMessageRouterBindings({
  statsRuntimeService, statsCollector, runtimeSessionRepository,
  keyMaterialRepository,
  resumeVaultBootstrap,
  profileMutationActionHandlers,
  handleActionMessage,
  popupBlockFlow,
  settingsService,
  settingsCache,
  bootstrapSnapshotRepository,
  runtimeLanguageRepository,
  settingsPropagationQaFixture,
  bootPrewarmService,
  clseRepository,
  prepareFeedFlowSnapshot,
  commitFeedFlowSnapshot,
  recordContentFlowStats,
  sendProtectionUpdate,
  contentScriptOrchestrator,
  contentRuntimeDiagnostics,
  contentProtectionSync,
  progressionService,
  guidanceService,
  profileGenerationReadiness,
  feedTopologyPersistentCertificationService,
  getInitPromise,
  getDashboardBootReadinessPromise,
  getProfileGenerationBootSettlementPromise,
  readProfileMutationLifecycle,
  profileMutationRuntimeGate,
  workerRuntimeEventCapability,
  gateInterstitialController,
  browserPort,
  getTrackingRuntimeState,
  readConsumptionQaSnapshot,
  releaseGateEntryApprovalForQa,
  maybeTriggerProtectionNudge,
  requestTabClosure,
} = {}) {
  if (
    !contentScriptOrchestrator
    || typeof contentScriptOrchestrator.executeVideoSkipMainWorldCommand !== 'function'
  ) {
    throw new Error('VIDEO_SKIP_MAIN_WORLD_ORCHESTRATOR_OWNER_REQUIRED');
  }
  const behaviorTelemetryRecorder = createBehaviorTelemetryRecorder({
    recordContentFlowStats,
  });
  const videoSkipPoolWriteCoordinator = BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
    ? VideoSkipPoolWriteCoordinator.getInstance()
    : null;
  const nudgeFrameHostCapability = createNudgeFrameHostCapabilityBroker();

  return createBackgroundMessageRouter({
    securityVault: { repository: keyMaterialRepository, resumeBootstrap: resumeVaultBootstrap },
    profileMutationActionHandlers,
    popupBlock: {
      progressionService,
      popupBlockFlow,
      settingsService,
      settingsCache,
    },
    clse: {
      bootPrewarmService,
      applyCLSESettingsPatch: ({ items, sender, actionReason }) => settingsService.applySettingsChange({
        actionReason,
        items,
        sender,
        persist: true,
        emitSettingsUpdated: false,
        invalidateFilterCache: false,
        refreshForBroadcast: false,
        reportBroadcastAsRefresh: false,
      }),
      clseRepository,
    },
    trackingRuntime: {
      prepareFeedFlowSnapshot,
      commitFeedFlowSnapshot,
      recordContentFlowSignal: behaviorTelemetryRecorder.recordContentFlowSignal,
      recordContentFlowFromFeedSnapshot: behaviorTelemetryRecorder.recordContentFlowFromFeedSnapshot,
      sendProtectionUpdate,
      contentScriptOrchestrator,
      contentRuntimeDiagnostics,
      contentProtectionSync,
      browserPort,
    },
    progression: {
      progressionService,
    },
    guidance: { guidanceService },
    profileGenerationReadiness,
    feedTopologyPersistentCertificationService,
    videoSkipPoolWrite: {
      ...(BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
        ? { mergeVideoSkipPool: (snapshot) => videoSkipPoolWriteCoordinator.merge(snapshot) }
        : {}),
      executeVideoSkipMainWorldCommand: (request) => (
        contentScriptOrchestrator.executeVideoSkipMainWorldCommand(request)
      ),
    },
    nudgeFrameHostCapability,
    buildCapabilityRoutes: {
      statsRuntimeService, statsCollector, settingsService, runtimeSessionRepository, readProfileMutationLifecycle,
      settingsPropagationQaFixture,
      browserPort,
      contentScriptOrchestrator,
      gateInterstitialController,
      getTrackingRuntimeState,
      readConsumptionQaSnapshot,
      releaseGateEntryApprovalForQa,
      maybeTriggerProtectionNudge,
      requestTabClosure,
    },
    handleActionMessage,
    getInitPromise,
    getDashboardBootReadinessPromise,
    getProfileGenerationBootSettlementPromise,
    readProfileMutationLifecycle,
    profileMutationRuntimeGate,
    workerRuntimeEventCapability,
    contentBootstrapSnapshot: { bootstrapSnapshotRepository, runtimeLanguageRepository },
  });
}
