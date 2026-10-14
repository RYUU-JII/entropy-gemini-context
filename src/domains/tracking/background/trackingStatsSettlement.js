import { createTrackingSessionDurationRecorder } from './trackingSessionDurationRecorder.js';
import { createTrackingTabActivitySettlement } from './trackingTabActivitySettlement.js';

export function createTrackingStatsSettlement({
  consumptionLedger,
  resolveConsumptionScope,
  readWindow,
  settingsService,
  idleDetector,
  statsCollector,
  activeTabRuntimeState,
  domainSessionRuntimeState,
  finalizeActiveSession,
  shouldTrackHostname,
  getSiteCategory,
  resolveTimedFilteringMode,
  resolveStatsCategoryIdFromModeState,
  setActiveTabAudible,
  longGapLimitMs = 60 * 60 * 1000,
  queryTabs = async () => [],
  windowIdNone = -1,
  getExtensionId = () => '',
  statsRuntimeHealthLedger,
  recordManagedProtectedVisit,
} = {}) {
  const trackingSessionDurationRecorder = createTrackingSessionDurationRecorder({
    statsCollector,
  });
  const trackingTabActivitySettlement = createTrackingTabActivitySettlement({
    readWindow,
    consumptionLedger,
    resolveConsumptionScope,
    settingsService,
    idleDetector,
    statsCollector,
    activeTabRuntimeState,
    domainSessionRuntimeState,
    finalizeActiveSession,
    shouldTrackHostname,
    getSiteCategory,
    resolveTimedFilteringMode,
    resolveStatsCategoryIdFromModeState,
    setActiveTabAudible,
    longGapLimitMs,
    queryTabs,
    windowIdNone,
    getExtensionId,
    statsRuntimeHealthLedger,
    recordManagedProtectedVisit,
  });

  return {
    ...trackingSessionDurationRecorder,
    ...trackingTabActivitySettlement,
  };
}
