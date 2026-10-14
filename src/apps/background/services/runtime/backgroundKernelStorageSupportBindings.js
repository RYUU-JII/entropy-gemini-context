import { createBackgroundKernelStorageInspectorBindings } from './backgroundKernelStorageInspectorBindings.js';
import { createBackgroundKernelStorageMaintenanceBindings } from './backgroundKernelStorageMaintenanceBindings.js';
import { createBackgroundKernelStorageSnapshotBindings } from './backgroundKernelStorageSnapshotBindings.js';
import { createBackgroundKernelProfileMutationCoordinator } from './backgroundKernelProfileMutationBindings.js';

export function createBackgroundKernelStorageSupportBindings({
  statsRuntimeService,
  statsRepository,
  eventLogRepository,
  tabTimeTracker,
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
  quiesceTrackingTickRunnerForProfileMutation,
  nudgeWindowBlurController,
  nudgeTerminalEffectCoordinator,
  quiesceCLSEForProfileMutation,
  checkGlobalCapStatus,
  bootPrewarmService,
  settingsPersistence,
  statsRetentionJob,
  storageInspectorQueryService,
  storageSnapshotCapability, frictionBootstrapCoordinator,
  progressionService,
  guidanceService,
  zenModelRepository,
  zenPairwiseGpService,
  profileMutationRuntimeGate,
  workerRuntimeEventCapability,
  profileMutationRuntimeLifetimePort,
  runCLSEStorageSnapshotImport,
  getRuntimeReadinessPromise,
  createZenProfileGenerationState,
} = {}) {
  if (
    !profileMutationRuntimeLifetimePort
    || typeof profileMutationRuntimeLifetimePort
      .completeProfileMutationRuntimeHandoff !== 'function'
  ) {
    throw new Error('BACKGROUND_STORAGE_PROFILE_MUTATION_RUNTIME_LIFETIME_PORT_REQUIRED');
  }
  const profileMutationCoordinator = createBackgroundKernelProfileMutationCoordinator({
    profileResetLifecycleRepository,
    progressionService,
    settingsService,
    settingsPropagationCoordinator,
    quiesceTrackingTickRunnerForProfileMutation,
    nudgeWindowBlurController,
    nudgeTerminalEffectCoordinator,
    quiesceCLSEForProfileMutation,
    tabTimeTracker,
    statsRuntimeService,
    cycleStateManager,
    eventLogRepository,
    zenModelRepository,
    zenPairwiseGpService,
    workerRuntimeEventCapability,
    runtimeAdmissionGate: profileMutationRuntimeGate,
    getRuntimeReadinessPromise,
  });
  const maintenanceCoordinator = createBackgroundKernelStorageMaintenanceBindings({
    workerRuntimeEventCapability,
    statsRuntimeService,
    statsRepository,
    eventLogRepository,
    tabTimeTracker,
    faviconRepository,
    statsFeaturePackRepository,
    interventionEffectRepository,
    settingsDocumentRepository,
    modelStateRepository,
    zenArtifactRepository,
    keyMaterialRepository,
    cycleStateManager,
    runtimeSessionRepository,
    profileMutationCoordinator,
    settingsService,
    checkGlobalCapStatus,
    bootPrewarmService,
    settingsPersistence,
    statsRetentionJob,
    frictionBootstrapCoordinator,
    progressionService,
    guidanceService,
    createZenProfileGenerationState,
  });
  const storageSnapshotService = createBackgroundKernelStorageSnapshotBindings({
    workerRuntimeEventCapability,
    statsRuntimeService,
    tabTimeTracker,
    runtimeSessionRepository,
    profileMutationCoordinator,
    settingsService,
    storageSnapshotCapability, frictionBootstrapCoordinator,
    runCLSEStorageSnapshotImport,
    createZenProfileGenerationState,
  });
  const storageInspectorService = createBackgroundKernelStorageInspectorBindings({
    settingsDocumentRepository,
    keyMaterialRepository,
    runtimeSessionRepository,
    storageInspectorQueryService,
    statsRuntimeService,
    tabTimeTracker,
  });

  return {
    resetAnalyticsData: maintenanceCoordinator.resetAnalyticsData,
    resetAppData: maintenanceCoordinator.resetAppData,
    exportStorageSnapshot: storageSnapshotService.exportStorageSnapshot,
    importStorageSnapshot: storageSnapshotService.importStorageSnapshot,
    getStorageInspectorSnapshot: storageInspectorService.getStorageInspectorSnapshot,
    runStorageSupportAction: maintenanceCoordinator.runStorageSupportAction,
    completeProfileMutationRuntimeHandoff: (
      profileMutationRuntimeLifetimePort.completeProfileMutationRuntimeHandoff.bind(
        profileMutationRuntimeLifetimePort,
      )
    ),
  };
}
