import { createBackgroundStorageSnapshotService } from './support/BackgroundStorageSnapshotService.js';

export function createBackgroundKernelStorageSnapshotBindings({
  workerRuntimeEventCapability,
  statsRuntimeService,
  tabTimeTracker,
  runtimeSessionRepository,
  profileMutationCoordinator,
  settingsService,
  storageSnapshotCapability,
  frictionBootstrapCoordinator,
  runCLSEStorageSnapshotImport,
  createZenProfileGenerationState,
} = {}) {
  return createBackgroundStorageSnapshotService({
    workerRuntimeEventCapability,
    runTerminalStatsReset: statsRuntimeService.runTerminalProfileMutationReset,
    runTerminalTrackingReset: tabTimeTracker.runTerminalProfileMutationReset,
    runtimeSessionRepository,
    profileMutationCoordinator,
    settingsService,
    storageSnapshotCapability,
    clearBootstrapSnapshots: (reason) => frictionBootstrapCoordinator.clearAll(reason),
    runCLSEStorageSnapshotImport,
    createZenProfileGenerationState,
  });
}
