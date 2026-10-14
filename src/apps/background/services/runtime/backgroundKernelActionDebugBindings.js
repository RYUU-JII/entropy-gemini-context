import { buildBackgroundKernelTrackingRuntimeSnapshot } from './backgroundKernelTrackingRuntimeSnapshot.js';
import { readActiveNudgeOwnerForTab } from '../../../../domains/nudge/runtime/session/nudgeSessionOwnerState.js';

export function createBackgroundKernelActionDebugBindings({
  faviconService,
  bootPrewarmService,
  statsRuntimeService,
  tabTimeTracker,
  zenPairwiseGpService,
  contentScriptOrchestrator,
  maybeTriggerProtectionNudge,
  sentinelProtocolTimeline,
  browserPort,
} = {}) {
  return {
    supportDebug: {
      captureFaviconFromUrl: faviconService.captureFaviconFromUrl,
      captureTabFavicon: faviconService.captureTabFavicon,
      contentScriptOrchestrator,
      getBootPrewarmSnapshot: (options) => bootPrewarmService.getSnapshotForDashboard(options),
      getTrackingRuntimeState: () => buildBackgroundKernelTrackingRuntimeSnapshot({ statsRuntimeService, tabTimeTracker }),
      inspectFavicon: faviconService.inspectCache,
      maybeTriggerProtectionNudge,
      readActiveNudgeOwnerForTab,
      saveStatsCache: statsRuntimeService.saveStatsCache,
      sentinelProtocolTimeline,
      zenPairwiseGpService,
      browserPort,
    },
  };
}
