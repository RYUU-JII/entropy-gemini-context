import { createBackgroundStorageInspectorService } from './support/BackgroundStorageInspectorService.js';

export function createBackgroundKernelStorageInspectorBindings({
  settingsDocumentRepository,
  keyMaterialRepository,
  runtimeSessionRepository,
  storageInspectorQueryService,
  statsRuntimeService,
  tabTimeTracker,
} = {}) {
  return createBackgroundStorageInspectorService({
    settingsDocumentRepository,
    keyMaterialRepository,
    runtimeSessionRepository,
    storageInspectorCapability: storageInspectorQueryService,
    getStatsCache: statsRuntimeService?.getStatsCache,
    TabTimeTracker: tabTimeTracker,
  });
}
