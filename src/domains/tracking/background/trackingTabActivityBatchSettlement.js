import { createTrackingTabActivityObservation, requireRolloverObservationContext } from './trackingTabActivityObservation.js';
import { getHostname, ensureNumber } from '../../../lib/index.js';
import {
  isTrackableTabUrl,
  resolveTabActivityState,
  resolveBackgroundPressureElapsed,
  shouldTrackHostnameForBatch,
} from '../../stats/background/collection/tabActivityCollector.js';
import { resolveCollectionPolicySnapshot } from '../../settings/config/dataCollectionPolicy.js';
import { buildConsumptionEnvironment, buildGateEntryPresence } from './trackingConsumptionEnvironment.js';
import { resolveObservedForegroundTab } from './trackingForegroundObservation.js';
import {
  buildBackgroundDomainPressureMap,
  settleObservedForegroundSegment,
} from './trackingTabActivityBatchSettlementHelpers.js';
import {
  appendSampleHostname,
  cloneTabActivityBatchSummary,
  createEmptyTabActivityBatchSummary,
  isTrackableActiveTabCandidate,
  normalizeTabId,
} from './trackingTabActivityBatchDiagnostics.js';

export function createTrackingTabActivityBatchSettlement({
  consumptionLedger,
  resolveConsumptionScope,
  readWindow,
  settingsService,
  idleDetector,
  activeTabRuntimeState,
  statsCollector,
  resolveTimedFilteringMode,
  setActiveTabAudible,
  applyBackgroundTabTimeWithCollection,
  openForegroundTab,
  sealCurrentSegment,
  finalizeActiveSession,
  longGapLimitMs = 60 * 60 * 1000,
  queryTabs = async () => [],
  windowIdNone = -1,
  getExtensionId = () => '',
} = {}) {
  if (!consumptionLedger || typeof consumptionLedger.recordEnvironmentSnapshot !== 'function'
    || typeof resolveConsumptionScope !== 'function' || typeof readWindow !== 'function') throw new Error('TRACKING_CONSUMPTION_ENVIRONMENT_OWNER_REQUIRED');
  const observationOwner = createTrackingTabActivityObservation({
    queryTabs, readWindow, settingsService, idleDetector, consumptionLedger,
    activeTabRuntimeState, windowIdNone,
  });
  let lastTabActivityBatchSummary = null;

  function getLastTabActivityBatchSummary() {
    return cloneTabActivityBatchSummary(lastTabActivityBatchSummary);
  }

  async function settleTabActivityObservation(
    observation,
    nowOverride = null,
    { skipCacheLoad = false, dateStr = null, historicalBoundary = false, rolloverContext = null } = {},
  ) {
    const now = typeof nowOverride === 'number' ? nowOverride : Date.now();
    const snapshot = observationOwner.consume(observation, now, { historicalBoundary, rolloverContext });
    const { mediaReceipt, queriedTabs, focusedActiveTabs, consumptionFocusedWindow, idleState: idleStateNow } = snapshot;
    const observedAt = historicalBoundary && rolloverContext === null ? now : snapshot.observedAt;
    const extensionId = getExtensionId();
    const browserFocusedActiveTab = resolveObservedForegroundTab({
      tabs: queriedTabs, focusedActiveTabs, focusedWindow: consumptionFocusedWindow,
    });
    const browserFocusedActiveTabId = normalizeTabId(browserFocusedActiveTab?.id);
    const browserFocusedActiveHostname = getHostname(browserFocusedActiveTab?.url);
    const browserFocusedActiveTrackable = !!(
      browserFocusedActiveHostname
      && isTrackableTabUrl(browserFocusedActiveTab?.url, { extensionId })
    );
    const tabs = queriedTabs;
    await settingsService.ensureSettingsCache();
    const settingsCache = settingsService.getSettingsCache();
    const blockedUrls = settingsCache.blockedUrls;
    const collectionPolicy = resolveCollectionPolicySnapshot(settingsCache);
    const runtimeFocusedWindowId = activeTabRuntimeState.getFocusedWindowId();
    // These are projections of one browser observation. Share policy reads only
    // within this batch; consent filters and foreground fact settlement remain
    // independent, and the next observation must read canonical state again.
    const observedScopes = new Map();
    const resolveObservedScope = ({ hostname }) => {
      if (!observedScopes.has(hostname)) {
        observedScopes.set(hostname, resolveConsumptionScope({ hostname, settings: settingsCache, now }));
      }
      return observedScopes.get(hostname);
    };
    const consumptionEnvironment = await buildConsumptionEnvironment({
      tabs: queriedTabs, focusedActiveTabs,
      focusedWindow: consumptionFocusedWindow,
      now: observedAt, idleState: idleStateNow, settings: settingsCache, resolveScope: resolveObservedScope,
    });
    const gateEntryPresence = await buildGateEntryPresence({
      tabs: queriedTabs, focusedActiveTabs, focusedWindow: consumptionFocusedWindow,
      now: observedAt, idleState: idleStateNow, settings: settingsCache, resolveScope: resolveObservedScope,
    });
    const focusedWindowId = browserFocusedActiveTab === null ? null : browserFocusedActiveTab.windowId;
    let ensoMode = gateEntryPresence.presence === 'away' ? 'away' : 'unknown';
    if (browserFocusedActiveTab && browserFocusedActiveHostname) {
      const operationalScope = await resolveObservedScope({ hostname: browserFocusedActiveHostname });
      if (!operationalScope || typeof operationalScope.ok !== 'boolean' || typeof operationalScope.isBlockedDomain !== 'boolean') throw new Error('ENSO_CADENCE_SCOPE_INVALID');
      if (operationalScope.ok && operationalScope.isBlockedDomain) {
        ensoMode = ['active', 'idle'].includes(idleStateNow) ? 'consuming' : idleStateNow === 'locked' ? 'paused' : 'unknown';
      } else if (operationalScope.ok && gateEntryPresence.presence !== 'away') ensoMode = 'paused';
    }
    const ensoCadencePoint = { observedAt, tabId: browserFocusedActiveTabId, mode: ensoMode };
    const focusedActiveTabId = browserFocusedActiveTrackable ? browserFocusedActiveTabId : null;
    // Scope reads above can yield to settings/browser/foreground changes. Recheck
    // immediately before this batch's first mutation, never after a partial commit.
    observationOwner.assertCurrent(snapshot, now, { historicalBoundary });
    if (rolloverContext !== null) {
      // All fallible browser acquisition and scope validation precede closing
      // either cursor. From this point, failures are partial settlement failures,
      // never pre-mutation observation retries.
      await sealCurrentSegment({ now, reopen: false, reason: 'rollover_previous_day', skipCacheLoad, dateStr });
      await finalizeActiveSession(now, { skipCacheLoad, dateStr });
    }
    if (
      focusedWindowId !== runtimeFocusedWindowId
    ) {
      activeTabRuntimeState.setFocusedWindowId(focusedWindowId);
    }
    // No active-tab substitution when focus is absent or the inventories conflict.
    const focusUnavailableActiveTabId = null;
    const { activeElapsedMs: batchSummaryActiveElapsedMs } = await settleObservedForegroundSegment({
      now,
      tabs,
      activeTabRuntimeState,
      focusedActiveTabId,
      focusUnavailableActiveTabId,
      browserFocusedActiveTrackable,
      browserFocusedActiveTab,
      browserFocusedActiveTabId,
      idleStateNow,
      openForegroundTab,
      sealCurrentSegment,
      skipCacheLoad,
      dateStr,
    });
    const lastActiveTabId = activeTabRuntimeState.getLastActiveTabId();
    const batchSummary = createEmptyTabActivityBatchSummary({
      now,
      focusedWindowId,
      lastActiveTabId,
      focusUnavailableActiveTabId,
      focusedActiveTabId,
      focusedActiveWindowId: browserFocusedActiveTab?.windowId ?? null,
      focusedActiveHostname: browserFocusedActiveHostname,
      focusedActiveTrackable: browserFocusedActiveTrackable,
      idleStateNow,
      dataCollectionMode: settingsCache?.dataCollectionMode,
    });
    batchSummary.activeElapsedMs += batchSummaryActiveElapsedMs;
    batchSummary.tabsTotal = Array.isArray(tabs) ? tabs.length : 0;
    const activeCandidateIds = new Set(
      (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => isTrackableActiveTabCandidate(tab, { extensionId, windowIdNone }))
        .map((tab) => tab.id),
    );
    if (focusedActiveTabId !== null) activeCandidateIds.add(focusedActiveTabId);
    batchSummary.activeTabCandidates = activeCandidateIds.size;
    const resolveActivityStateForTab = (tab) => resolveTabActivityState(tab, {
      focusedWindowId,
      lastActiveTabId,
      focusUnavailableActiveTabId,
      focusedActiveTabId,
      windowIdNone,
    });
    const orderedTabs = (Array.isArray(tabs) ? [...tabs] : []).sort((left, right) => {
      const leftActive = resolveActivityStateForTab(left).isActive ? 1 : 0;
      const rightActive = resolveActivityStateForTab(right).isActive ? 1 : 0;
      return rightActive - leftActive;
    });
    const backgroundDomainPressure = buildBackgroundDomainPressureMap({
      tabs: orderedTabs,
      extensionId,
      settingsCache,
      now,
      resolveActivityStateForTab,
      collectionPolicy,
      activeTabRuntimeState,
      resolveTimedFilteringMode,
    });
    const settledBackgroundHostnames = new Set();

    await statsCollector.collectBatch({
      now,
      skipCacheLoad,
      dateStr,
    }, async (collection) => {
      for (const tab of orderedTabs) {
        const hostname = getHostname(tab.url);
        if (tab?.url) batchSummary.tabsWithUrl += 1;
        if (!hostname) {
          batchSummary.skipped.noHostname += 1;
          continue;
        }
        batchSummary.tabsWithHostname += 1;
        appendSampleHostname(batchSummary, hostname);
        if (!isTrackableTabUrl(tab.url, { extensionId })) {
          batchSummary.skipped.notTrackable += 1;
          continue;
        }
        batchSummary.trackableTabs += 1;
        if (!shouldTrackHostnameForBatch({
          hostname,
          settingsCache,
          now,
          resolveTimedFilteringMode,
        })) {
          batchSummary.skipped.policy += 1;
          continue;
        }
        batchSummary.policyAllowedTabs += 1;

        const activityState = resolveActivityStateForTab(tab);
        if (activityState.shouldSyncAudible) {
          await setActiveTabAudible(activityState.audible, now, {
            skipCacheLoad,
            dateStr,
          });
        }
        if (activityState.isActive) {
          batchSummary.activeClassifiedTabs += 1;
          continue;
        }

        if (settledBackgroundHostnames.has(hostname)) {
          batchSummary.backgroundDuplicateDomainTabs += 1;
          continue;
        }
        settledBackgroundHostnames.add(hostname);
        batchSummary.backgroundClassifiedTabs += 1;
        const lastActiveAt = activityState.tabId !== null
          ? activeTabRuntimeState.getTabLastActiveAt(activityState.tabId)
          : null;
        const backgroundPressure = backgroundDomainPressure.get(hostname) || {
          audible: activityState.audible,
          lastActiveAt,
        };
        const domainStateBefore = collection.ensureDomainTrackingState({
          hostname,
          now,
          collectionPolicy,
        });
        const domainLastTrackedTime = Math.max(
          ensureNumber(domainStateBefore?.lastTrackedTime),
          ensureNumber(domainStateBefore?.activeCommittedThroughAt),
        );
        const beforeActiveMs = Number(domainStateBefore?.domainData?.active) || 0;
        const beforeBackgroundMs = Number(domainStateBefore?.domainData?.background) || 0;

        await applyBackgroundTabTimeWithCollection(
          collection,
          hostname,
          now,
          blockedUrls,
          {
            idleOverride: activityState.idleOverride || backgroundPressure.audible,
            backgroundPressure: resolveBackgroundPressureElapsed({
              now,
              lastTrackedTime: domainLastTrackedTime,
              isActive: false,
              audible: backgroundPressure.audible,
              lastActiveAt: backgroundPressure.lastActiveAt,
            }),
            settingsCacheOverride: settingsCache,
            idleStateOverride: idleStateNow,
          },
        );

        const afterActiveMs = Number(domainStateBefore?.domainData?.active) || 0;
        const afterBackgroundMs = Number(domainStateBefore?.domainData?.background) || 0;
        const activeDelta = Math.max(0, afterActiveMs - beforeActiveMs);
        const backgroundDelta = Math.max(0, afterBackgroundMs - beforeBackgroundMs);
        batchSummary.activeElapsedMs += activeDelta;
        batchSummary.backgroundElapsedMs += backgroundDelta;

        if (activeDelta <= 0 && backgroundDelta <= 0) {
          const elapsed = now - ensureNumber(domainLastTrackedTime);
          if (domainStateBefore?.created) {
            batchSummary.initializedOnlyTabs += 1;
          } else if (elapsed > longGapLimitMs) {
            batchSummary.longGapSkippedTabs += 1;
          } else if (idleStateNow !== 'active' && !activityState.idleOverride) {
            batchSummary.idleBlockedTabs += 1;
          } else if (elapsed < 100) {
            batchSummary.tooSmallElapsedTabs += 1;
          }
        }
      }
    });
    await consumptionLedger.recordEnvironmentSnapshot(consumptionEnvironment, {
      receipt: mediaReceipt, settingsVersion: settingsService.getSettingsChangeVersion(),
    });
    lastTabActivityBatchSummary = batchSummary;
    return { gateEntryPresence, ensoCadencePoint, focusedWindowId, observationReceipt: mediaReceipt };
  }

  return {
    getLastTabActivityBatchSummary,
    prepareTabActivityObservation: () => observationOwner.acquire({ refreshIdle: true }),
    settleTabActivityObservation,
    prepareRolloverTabActivityObservation: (context) => observationOwner.acquire({ rolloverContext: context }),
    settleRolloverTabActivityObservation: (observation, context) => {
      const rolloverContext = requireRolloverObservationContext(context);
      if (typeof finalizeActiveSession !== 'function') throw new Error('TRACKING_ROLLOVER_SESSION_OWNER_REQUIRED');
      return settleTabActivityObservation(observation, rolloverContext.boundaryTs, {
        dateStr: rolloverContext.previousDateStr, skipCacheLoad: true, historicalBoundary: true, rolloverContext,
      });
    },
    // Explicit combined observations use cached idle; production tick/rollover
    // prepare before queue admission through their respective receipt seams.
    trackAllTabsBatch: async (nowOverride, options = {}) => settleTabActivityObservation(
      await observationOwner.acquire(), nowOverride, { ...options, historicalBoundary: true },
    ),
  };
}
