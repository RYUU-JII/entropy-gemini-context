import { getHostname } from '../../../lib/index.js';
import { isTrackableTabUrl } from '../../stats/background/collection/tabActivityCollector.js';
import { createTrackingForegroundUsageLedger } from './trackingForegroundUsageLedger.js';
import { createTrackingTabActivityBatchSettlement } from './trackingTabActivityBatchSettlement.js';
import { createApplyBackgroundTabTimeWithCollection } from './trackingTabElapsedApplicator.js';

export function createTrackingTabActivitySettlement({
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
  if (typeof recordManagedProtectedVisit !== 'function') {
    throw new Error('TRACKING_TAB_ACTIVITY_ARTIFACT_DISCLOSURE_OWNER_REQUIRED');
  }
  const applyBackgroundTabTimeWithCollection = createApplyBackgroundTabTimeWithCollection({
    settingsService,
    idleDetector,
    shouldTrackHostname,
    resolveTimedFilteringMode,
    resolveStatsCategoryIdFromModeState,
    longGapLimitMs,
  });

  async function recordTabSwitch(fromHostname, toHostname, now) {
    if (!toHostname) return;
    await settingsService.ensureSettingsCache();
    const settingsCache = settingsService.getSettingsCache();

    if (!shouldTrackHostname(toHostname, settingsCache)) return;

    const isInternal = !!fromHostname && fromHostname === toHostname;
    let targetKey = 'internal';

    if (!isInternal) {
      const category = getSiteCategory(toHostname, settingsCache);
      if (category === 'blocked') targetKey = 'toBlocked';
      else if (category === 'allowed') targetKey = 'toAllowed';
      else targetKey = 'toUnmanaged';
    }

    await statsCollector.recordDaySwitch({
      switchKey: targetKey,
      fromHostname,
      toHostname,
      now,
    });

    return { targetKey };
  }

  async function calculateTabTime(
    hostname,
    now,
    isActive,
    blockedUrlsOverride = null,
    {
      idleOverride = false,
      skipCacheLoad = false,
      settingsCacheOverride = null,
      idleStateOverride = null,
    } = {},
  ) {
    if (isActive) return false;
    const { value } = await statsCollector.collectBatch({
      now,
      skipCacheLoad,
    }, (collection) => applyBackgroundTabTimeWithCollection(
      collection,
      hostname,
      now,
      blockedUrlsOverride,
      {
        idleOverride,
        settingsCacheOverride,
        idleStateOverride,
      },
    ));

    return !!value;
  }

  async function settleTabTime(
    url,
    isActive,
    isNewVisit = false,
    nowOverride = null,
    { idleOverride = false } = {},
  ) {
    const now = typeof nowOverride === 'number' ? nowOverride : Date.now();
    const hostname = getHostname(url);
    const extensionId = getExtensionId();
    if (!hostname || !isTrackableTabUrl(url, { extensionId }) || hostname === extensionId) return;
    await settingsService.ensureSettingsCache();
    const settingsCache = settingsService.getSettingsCache();
    if (!shouldTrackHostname(hostname, settingsCache)) return;
    activeTabRuntimeState.rememberLastDomainUrl(url);
    const managedProtectedVisit = isNewVisit
      && getSiteCategory(hostname, settingsCache, now) === 'blocked';

    if (isActive) {
      if (!isNewVisit) return false;
      let visitRecorded = false;
      const { value } = await statsCollector.collectBatch({
        now,
      }, (collection) => {
        visitRecorded = collection.recordDomainVisit({ hostname, now }) === true;
        return visitRecorded;
      });
      if (managedProtectedVisit && visitRecorded) {
        await recordManagedProtectedVisit({ hostname, atMs: now });
      }
      return !!value;
    }

    let visitRecorded = false;
    const { value } = await statsCollector.collectBatch({
      now,
    }, async (collection) => {
      let isChanged = await applyBackgroundTabTimeWithCollection(
        collection,
        hostname,
        now,
        null,
        {
          idleOverride,
          settingsCacheOverride: settingsCache,
        },
      );

      visitRecorded = isNewVisit && collection.recordDomainVisit({ hostname, now }) === true;
      if (visitRecorded) {
        isChanged = true;
      }

      return isChanged;
    });

    if (managedProtectedVisit && visitRecorded) {
      await recordManagedProtectedVisit({ hostname, atMs: now });
    }

    return !!value;
  }

  const foregroundUsageLedger = createTrackingForegroundUsageLedger({
    consumptionLedger,
    resolveConsumptionScope,
    settingsService,
    statsCollector,
    activeTabRuntimeState,
    domainSessionRuntimeState,
    idleDetector,
    shouldTrackHostname,
    resolveTimedFilteringMode,
    resolveStatsCategoryIdFromModeState,
    getExtensionId,
    statsRuntimeHealthLedger,
  });
  const tabActivityBatchSettlement = createTrackingTabActivityBatchSettlement({
    readWindow,
    consumptionLedger,
    resolveConsumptionScope,
    settingsService,
    idleDetector,
    activeTabRuntimeState,
    statsCollector,
    resolveTimedFilteringMode,
    setActiveTabAudible,
    applyBackgroundTabTimeWithCollection,
    openForegroundTab: foregroundUsageLedger.openForegroundTab,
    sealCurrentSegment: foregroundUsageLedger.sealCurrentSegment,
    finalizeActiveSession,
    longGapLimitMs,
    queryTabs,
    windowIdNone,
    getExtensionId,
  });

  return {
    calculateTabTime,
    getLastPreviousTabSettlementDiagnostic: foregroundUsageLedger.getLastPreviousTabSettlementDiagnostic,
    getLastTabActivityBatchSummary: tabActivityBatchSettlement.getLastTabActivityBatchSummary,
    openForegroundTab: foregroundUsageLedger.openForegroundTab,
    primeActiveTrackingBoundary: foregroundUsageLedger.primeActiveTrackingBoundary,
    primeNewDayAt: foregroundUsageLedger.primeNewDayAt,
    reconcileForegroundSegmentForObservedTab: foregroundUsageLedger.reconcileForegroundSegmentForObservedTab,
    recordActiveTabDuration: foregroundUsageLedger.sealActiveSegment,
    recordTabSwitch,
    sealActiveSegment: foregroundUsageLedger.sealActiveSegment,
    settlePreviousTab: foregroundUsageLedger.settlePreviousTab,
    settleTabTime,
    trackAllTabsBatch: tabActivityBatchSettlement.trackAllTabsBatch,
    prepareTabActivityObservation: tabActivityBatchSettlement.prepareTabActivityObservation,
    settleTabActivityObservation: tabActivityBatchSettlement.settleTabActivityObservation,
    prepareRolloverTabActivityObservation: tabActivityBatchSettlement.prepareRolloverTabActivityObservation,
    settleRolloverTabActivityObservation: tabActivityBatchSettlement.settleRolloverTabActivityObservation,
  };
}
