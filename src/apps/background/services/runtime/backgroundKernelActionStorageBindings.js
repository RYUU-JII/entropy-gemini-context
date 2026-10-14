import { createConfirmMemoryPurgeHandler } from './backgroundKernelActionMemoryPurgeBindings.js';

export function createBackgroundKernelActionStorageBindings({
  storageSupportBindings,
  readProfileMutationLifecycle,
  statsRepository,
  cleanupBlockedHistory,
  previewBlockedHistory,
  previewBlockedBookmarks,
  exportBlockedBookmarksHtml,
  settingsService,
  tabTimeTracker,
  statsRuntimeService,
} = {}) {
  const {
    resetAnalyticsData,
    resetAppData,
    exportStorageSnapshot,
    importStorageSnapshot,
    getStorageInspectorSnapshot,
    runStorageSupportAction,
  } = storageSupportBindings;
  const confirmMemoryPurge = createConfirmMemoryPurgeHandler({
    cleanupBlockedHistory,
    settingsService,
  });

  return {
    storageSupport: {
      readProfileMutationLifecycle,
      clearAllStatsDays: () => statsRepository.clearAllStatsDays(),
      cleanupBlockedHistory,
      confirmMemoryPurge,
      exportStorageSnapshot,
      exportBlockedBookmarksHtml,
      getStorageInspectorSnapshot,
      importStorageSnapshot,
      previewBlockedBookmarks,
      previewBlockedHistory,
      resetAnalyticsData,
      resetAppData,
      runStorageSupportAction,
      tabTimeTracker,
      loadStatsCache: statsRuntimeService.loadStatsCache,
      runStatsReset: statsRuntimeService.runStatsReset,
    },
  };
}
