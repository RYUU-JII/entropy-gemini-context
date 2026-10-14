import { getHostname } from '../../../lib/index.js';
import { isTrackableTabUrl } from '../../stats/background/collection/tabActivityCollector.js';

export function normalizeTabId(tabId) {
  if (tabId === null || typeof tabId === 'undefined' || tabId === '') return null;
  const numericTabId = Number(tabId);
  return Number.isInteger(numericTabId) && numericTabId >= 0 ? numericTabId : null;
}

export function isTrackableActiveTabCandidate(tab, { extensionId = '', windowIdNone = -1 } = {}) {
  const tabId = normalizeTabId(tab?.id);
  if (tabId === null) return false;
  if (!tab?.active) return false;
  if (tab?.windowId === windowIdNone) return false;
  const hostname = getHostname(tab?.url);
  if (!hostname) return false;
  return isTrackableTabUrl(tab.url, { extensionId });
}

export function resolveFocusedActiveTabSnapshot(tabs, { windowIdNone = -1 } = {}) {
  const activeTabs = (Array.isArray(tabs) ? tabs : [])
    .filter((tab) => {
      const tabId = normalizeTabId(tab?.id);
      if (tabId === null) return false;
      if (!tab?.active) return false;
      return tab?.windowId !== windowIdNone;
    });
  return activeTabs.length === 1 ? activeTabs[0] : null;
}

export function mergeTabSnapshotsById(tabs = [], extraTabs = []) {
  const merged = [];
  const seen = new Set();
  for (const tab of [...(Array.isArray(tabs) ? tabs : []), ...(Array.isArray(extraTabs) ? extraTabs : [])]) {
    const tabId = normalizeTabId(tab?.id);
    if (tabId === null || seen.has(tabId)) continue;
    seen.add(tabId);
    merged.push(tab);
  }
  return merged;
}

export function createPreviousTabSettlementDiagnostic({
  status = 'skipped',
  code = 'previous_tab_not_settled',
  targetTabId = null,
  hostname = null,
  attemptedAt = Date.now(),
  elapsedMs = null,
  message = null,
} = {}) {
  return {
    status,
    code,
    targetTabId: normalizeTabId(targetTabId),
    hostname: typeof hostname === 'string' && hostname ? hostname : null,
    attemptedAt: Number.isFinite(Number(attemptedAt)) ? Number(attemptedAt) : null,
    elapsedMs: Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : null,
    message: typeof message === 'string' && message ? message : null,
  };
}

export function clonePreviousTabSettlementDiagnostic(diagnostic) {
  return diagnostic ? { ...diagnostic } : null;
}

export function resolveFocusUnavailableActiveTabId(tabs, {
  focusedWindowId = null,
  lastActiveTabId = null,
  activeTabInfo = null,
  windowIdNone = -1,
  extensionId = '',
} = {}) {
  if (focusedWindowId !== null && focusedWindowId !== windowIdNone) return null;

  const activeTabs = (Array.isArray(tabs) ? tabs : [])
    .filter((tab) => isTrackableActiveTabCandidate(tab, { extensionId, windowIdNone }));
  if (activeTabs.length === 0) return null;

  const activeInfoTabId = normalizeTabId(activeTabInfo?.tabId);
  const activeInfoStartedAt = activeTabInfo?.startedAt;
  if (
    activeInfoTabId !== null
    && Number.isFinite(activeInfoStartedAt)
    && activeTabs.some((tab) => normalizeTabId(tab.id) === activeInfoTabId)
  ) {
    return activeInfoTabId;
  }

  const lastActiveId = normalizeTabId(lastActiveTabId);
  if (
    lastActiveId !== null
    && activeTabs.some((tab) => normalizeTabId(tab.id) === lastActiveId)
  ) {
    return lastActiveId;
  }

  return activeTabs.length === 1 ? normalizeTabId(activeTabs[0].id) : null;
}

export function createEmptyTabActivityBatchSummary({
  now,
  focusedWindowId,
  lastActiveTabId,
  focusUnavailableActiveTabId,
  focusedActiveTabId,
  focusedActiveWindowId,
  focusedActiveHostname,
  focusedActiveTrackable,
  idleStateNow,
  dataCollectionMode,
} = {}) {
  return {
    generatedAtEpochMs: Date.now(),
    tickNowEpochMs: Number.isFinite(Number(now)) ? Number(now) : null,
    focusedWindowId: focusedWindowId ?? null,
    lastActiveTabId: normalizeTabId(lastActiveTabId),
    focusUnavailableActiveTabId: normalizeTabId(focusUnavailableActiveTabId),
    focusedActiveTabId: normalizeTabId(focusedActiveTabId),
    focusedActiveWindowId: focusedActiveWindowId ?? null,
    focusedActiveHostname: typeof focusedActiveHostname === 'string' && focusedActiveHostname
      ? focusedActiveHostname
      : null,
    focusedActiveTrackable: !!focusedActiveTrackable,
    idleState: typeof idleStateNow === 'string' ? idleStateNow : null,
    dataCollectionMode: typeof dataCollectionMode === 'string' ? dataCollectionMode : null,
    tabsTotal: 0,
    tabsWithUrl: 0,
    tabsWithHostname: 0,
    activeTabCandidates: 0,
    trackableTabs: 0,
    policyAllowedTabs: 0,
    activeClassifiedTabs: 0,
    backgroundClassifiedTabs: 0,
    initializedOnlyTabs: 0,
    idleBlockedTabs: 0,
    longGapSkippedTabs: 0,
    tooSmallElapsedTabs: 0,
    backgroundDuplicateDomainTabs: 0,
    activeElapsedMs: 0,
    backgroundElapsedMs: 0,
    skipped: { noHostname: 0, notTrackable: 0, policy: 0 },
    sampleHostnames: [],
  };
}

export function appendSampleHostname(summary, hostname) {
  if (!summary || !hostname) return;
  if (summary.sampleHostnames.length >= 8) return;
  if (summary.sampleHostnames.includes(hostname)) return;
  summary.sampleHostnames.push(hostname);
}

export function cloneTabActivityBatchSummary(summary) {
  return summary
    ? {
      ...summary,
      skipped: { ...summary.skipped },
      sampleHostnames: [...summary.sampleHostnames],
    }
    : null;
}
