import { getHostname } from '../../../lib/index.js';
import {
  isTrackableTabUrl,
  shouldTrackHostnameForBatch,
} from '../../stats/background/collection/tabActivityCollector.js';
import { normalizeTabId } from './trackingTabActivityBatchDiagnostics.js';

function hasOpenForegroundSegment(activeTabInfo) {
  const startedAt = activeTabInfo?.startedAt;
  return !!(
    activeTabInfo?.hostname
    && startedAt !== null
    && typeof startedAt !== 'undefined'
    && Number.isFinite(Number(startedAt))
  );
}

function earliestFiniteTime(left, right) {
  const hasLeftValue = left !== null && typeof left !== 'undefined' && left !== '';
  const hasRightValue = right !== null && typeof right !== 'undefined' && right !== '';
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const hasLeft = hasLeftValue && Number.isFinite(leftNumber);
  const hasRight = hasRightValue && Number.isFinite(rightNumber);
  if (hasLeft && hasRight) return Math.min(leftNumber, rightNumber);
  if (hasLeft) return leftNumber;
  if (hasRight) return rightNumber;
  return null;
}

export function buildBackgroundDomainPressureMap({
  tabs,
  extensionId,
  settingsCache,
  now,
  resolveActivityStateForTab,
  collectionPolicy,
  activeTabRuntimeState,
  resolveTimedFilteringMode,
}) {
  const backgroundByHostname = new Map();
  (Array.isArray(tabs) ? tabs : []).forEach((tab) => {
    const hostname = getHostname(tab?.url);
    if (!hostname) return;
    if (!isTrackableTabUrl(tab.url, { extensionId })) return;
    if (!shouldTrackHostnameForBatch({
      hostname,
      settingsCache,
      now,
      resolveTimedFilteringMode,
    })) {
      return;
    }
    const activityState = resolveActivityStateForTab(tab);
    if (activityState.isActive) return;
    const tabLastActiveAt = activityState.tabId !== null
      ? activeTabRuntimeState.getTabLastActiveAt(activityState.tabId)
      : null;
    const existing = backgroundByHostname.get(hostname) || {
      hostname,
      audible: false,
      lastActiveAt: null,
      tabCount: 0,
      collectionPolicy,
    };
    existing.audible = existing.audible || activityState.audible;
    existing.lastActiveAt = earliestFiniteTime(existing.lastActiveAt, tabLastActiveAt);
    existing.tabCount += 1;
    backgroundByHostname.set(hostname, existing);
  });
  return backgroundByHostname;
}

export async function settleObservedForegroundSegment({
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
  skipCacheLoad = false,
  dateStr = null,
}) {
  const activeTabInfoBeforeBatch = activeTabRuntimeState.getActiveTabInfo();
  const activeInfoTabIdBeforeBatch = normalizeTabId(activeTabInfoBeforeBatch?.tabId);
  const batchForegroundTabId = focusedActiveTabId !== null
    ? focusedActiveTabId
    : focusUnavailableActiveTabId;
  let activeElapsedMs = 0;

  if (hasOpenForegroundSegment(activeTabInfoBeforeBatch) && activeInfoTabIdBeforeBatch !== null) {
    const foregroundStayedOpen = activeInfoTabIdBeforeBatch === batchForegroundTabId;
    const diagnostic = await sealCurrentSegment({
      now,
      expectedTabId: activeInfoTabIdBeforeBatch,
      reason: foregroundStayedOpen
        ? 'track_all_tabs_batch_heartbeat'
        : 'track_all_tabs_batch_active_changed',
      ...(foregroundStayedOpen ? { reopen: true } : {}),
      skipCacheLoad,
      dateStr,
    });
    if (diagnostic?.status === 'pass') {
      activeElapsedMs += Number(diagnostic.elapsedMs) || 0;
    }
  }

  const activeInfoAfterSeal = activeTabRuntimeState.getActiveTabInfo();
  const activeInfoTabIdAfterSeal = normalizeTabId(activeInfoAfterSeal?.tabId);
  const focusUnavailableActiveTab = focusUnavailableActiveTabId !== null
    ? tabs.find((tab) => normalizeTabId(tab?.id) === focusUnavailableActiveTabId)
    : null;
  const observedForegroundTab = browserFocusedActiveTrackable
    ? browserFocusedActiveTab
    : focusUnavailableActiveTab;
  const observedForegroundTabId = browserFocusedActiveTrackable
    ? browserFocusedActiveTabId
    : focusUnavailableActiveTabId;

  if (
    observedForegroundTab
    && typeof openForegroundTab === 'function'
    && (
      activeInfoTabIdAfterSeal !== observedForegroundTabId
      || !hasOpenForegroundSegment(activeInfoAfterSeal)
    )
  ) {
    await openForegroundTab(observedForegroundTab, now, {
      foregroundObserved: idleStateNow === 'active' || !!observedForegroundTab.audible,
    });
  }

  return { activeElapsedMs };
}
