import { syncCLSEFromStoredSettings } from '../../../../domains/behavior/CLSEServiceClient.js';
import { permissionsContainsStrict } from '../../../../platform/chrome/ChromeService.js';
import HistoryCleanupActivationCheckpointRepository from '../../../../platform/storage/runtime/HistoryCleanupActivationCheckpointRepository.js';
import SettingsPropagationCheckpointRepository from '../../../../platform/storage/runtime/SettingsPropagationCheckpointRepository.js';
import { createBackgroundHistoryCleanupActivationReconciler } from './support/BackgroundHistoryCleanupActivationReconciler.js';
import { createBackgroundMemoryPurgeArtifactRunner } from './support/BackgroundMemoryPurgeArtifactRunner.js';
import { createBackgroundMemoryPurgeCoordinator } from './support/BackgroundMemoryPurgeCoordinator.js';
import { createBackgroundSettingsPropagationCoordinator } from './support/BackgroundSettingsPropagationCoordinator.js';
import { primeTrackingBoundaryForSettingsChange } from './support/BackgroundTrackingBoundaryAdapter.js';
import { createSettingsPropagationQaFixture } from '@settings-propagation-qa-fixture';

export function createBackgroundKernelSettingsPropagationBindings({
  settingsService,
  settingsCache,
  cleanupBlockedHistoryBase,
  cleanupRecentBlockedHistory,
  syncBlockedBookmarksBase,
  syncManagedContentScripts,
  broadcastSettingsUpdate,
  trackingProtectionService,
  primeActiveTrackingBoundary,
  runtimeSessionRepository,
  resetTabEvaporation,
  tabManagement,
  gateInterstitialController,
} = {}) {
  if (typeof resetTabEvaporation !== 'function') throw new Error('BACKGROUND_TAB_EVAPORATION_RESET_OWNER_REQUIRED');
  const memoryPurgeCoordinator = createBackgroundMemoryPurgeCoordinator({
    cleanupBlockedHistory: cleanupBlockedHistoryBase,
    syncBlockedBookmarks: syncBlockedBookmarksBase,
  });
  const cleanupBlockedHistory = memoryPurgeCoordinator.cleanupBlockedHistory;
  const syncBlockedBookmarks = memoryPurgeCoordinator.syncBlockedBookmarks;
  const cleanupBlockedHistoryForAutoPurge = () => cleanupBlockedHistory({ requireEnabledConsent: true });
  const historyCleanupActivationReconciler = (
    createBackgroundHistoryCleanupActivationReconciler({
      settingsService,
      settingsCache,
      hasHistoryPermission: () => permissionsContainsStrict({ permissions: ['history'] }),
      cleanupBlockedHistory,
      checkpointRepository: new HistoryCleanupActivationCheckpointRepository({
        runtimeSessionRepository,
      }),
    })
  );
  async function applyRuntimeSettingsAdapters({ changedKeys } = {}) {
    if (changedKeys.some(key => ['gateConfig', 'artifactControlState', 'blockedUrls', 'allowedUrls', 'filteringMode', 'relaxationSchedule'].includes(key))) {
      if (typeof gateInterstitialController?.refreshDetourSessions !== 'function') {
        throw new Error('GATE_DETOUR_SETTINGS_ADAPTER_REQUIRED');
      }
      await gateInterstitialController.refreshDetourSessions({ now: Date.now() });
    }
    if (changedKeys.some(key => ['blockedUrls', 'tabEvaporationForBlocked', 'tabEvaporationTimeoutMinutes', 'artifactControlState'].includes(key))) {
      await resetTabEvaporation();
    }
    await syncCLSEFromStoredSettings({ changedKeys });
    await primeTrackingBoundaryForSettingsChange({ changedKeys, primeActiveTrackingBoundary });
    if (changedKeys.some(key => ['tabManagement', 'artifactControlState', 'blockedUrls', 'allowedUrls', 'filteringMode', 'relaxationSchedule', 'permissionRefresh'].includes(key))) {
      if (!tabManagement) throw new Error('TAB_MANAGEMENT_SETTINGS_ADAPTER_REQUIRED');
      const result = await (changedKeys.includes('tabManagement') ? tabManagement.organizeOpenTabs() : tabManagement.refresh());
      if (result.status === 'failed') throw new Error(`TAB_MANAGEMENT_SETTINGS_APPLICATION_FAILED:${result.reason}`);
    }
  }

  const { run: runMemoryPurgeArtifactCleanup } = createBackgroundMemoryPurgeArtifactRunner({
    settingsService,
    settingsCache,
    resolveProtectionRuntime: trackingProtectionService.resolveProtectionRuntime,
    cleanupRecentBlockedHistory,
    syncBlockedBookmarks,
  });

  const propagationComposition = createSettingsPropagationQaFixture({ broadcastSettingsUpdate });
  const settingsPropagationCoordinator = createBackgroundSettingsPropagationCoordinator({
    refreshSettingsCache: () => settingsService.refreshSettingsCache(),
    applyRuntimeSettingsAdapters,
    cleanupBlockedHistory: cleanupBlockedHistoryForAutoPurge,
    syncBlockedBookmarks,
    syncManagedContentScripts,
    broadcastSettingsUpdate: propagationComposition.broadcastSettingsUpdate,
    checkpointRepository: new SettingsPropagationCheckpointRepository({
      sessionRepository: runtimeSessionRepository,
    }),
  });

  return {
    cleanupBlockedHistory,
    syncBlockedBookmarks,
    applyRuntimeSettingsAdapters,
    cleanupBlockedHistoryForAutoPurge,
    reconcileHistoryCleanupOnActivation: historyCleanupActivationReconciler.reconcile,
    reconcileHistoryCleanupAfterPermissionAdded: (
      historyCleanupActivationReconciler.reconcileAfterHistoryPermissionAdded
    ),
    runMemoryPurgeArtifactCleanup,
    settingsPropagationCoordinator,
    ...('settingsPropagationQaFixture' in propagationComposition
      ? { settingsPropagationQaFixture: propagationComposition.settingsPropagationQaFixture } : {}),
  };
}
