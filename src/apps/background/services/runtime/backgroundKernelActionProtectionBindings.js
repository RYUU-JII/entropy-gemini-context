import { permissionsGetAllStrict } from '../../../../platform/chrome/ChromeService.js';
import { createPopupSiteSnapshotQueryService } from '../../../../domains/tracking/popup/query/popupSiteSnapshotQueryService.js';
import { createStatsActivityDayUsageQueryService } from '../../../../domains/stats/background/query/statsActivityDayUsageQueryService.js';

export function createBackgroundKernelActionProtectionBindings({
  progressionService,
  getProtectionRuntimeSnapshot, getProtectionRuntimeTelemetryContext,
  getGateInterstitialSession,
  closeGateInterstitialProtectedTab,
  refreshProtectionRuntimeSnapshot,
  settingsCache, settingsService,
  submitGateInterstitialDecision,
  tabTimeTracker, statsRuntimeService, cycleStateManager,
  interventionLedger,
} = {}) {
  const activityDayUsageQuery = createStatsActivityDayUsageQueryService({
    getStatsFactsRange: statsRuntimeService.getStatsFactsRange,
    getCycleState: ({ now }) => cycleStateManager.flushPendingResetPolicy(now),
    getSettingsSnapshot: () => settingsService.getSettingsCache(),
  });
  const popupSiteSnapshotQueryService = createPopupSiteSnapshotQueryService({
    getProtectionRuntimeSnapshot,
    getActivityDayUsageRange: activityDayUsageQuery.getActivityDayUsageRange,
    getGrantedPermissions: permissionsGetAllStrict,
    settingsCache,
    settingsService,
    readSiteRegistrationJourney: () => progressionService.readSiteRegistrationJourney({
      protectedSiteCount: new Set(settingsCache.blockedUrls).size,
      allowedSiteCount: new Set(settingsCache.allowedUrls).size,
    }),
  });

  return {
    protectionRuntime: {
      getActivityDayUsageRange: activityDayUsageQuery.getActivityDayUsageRange,
      getProtectionRuntimeSnapshot,
      getProtectionRuntimeTelemetryContext,
      getGateInterstitialSession,
      closeGateInterstitialProtectedTab,
      refreshProtectionRuntimeSnapshot,
      settingsCache, settingsService,
      submitGateInterstitialDecision,
      tabTimeTracker,
      interventionLedger,
    },
    popupDomain: {
      getGrantedPermissions: permissionsGetAllStrict,
      getPopupSiteSnapshot: popupSiteSnapshotQueryService.getPopupSiteSnapshot,
      settingsCache, settingsService,
    },
  };
}
