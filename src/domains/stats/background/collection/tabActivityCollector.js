import { shouldCollectDomainUsage } from '../../../settings/config/dataCollectionPolicy.js';

export const BACKGROUND_LINGER_THRESHOLD_MS = 2 * 60 * 1000;
export const STALE_TAB_THRESHOLD_MS = 7 * 60 * 1000;

export function isTrackableTabUrl(url, { extensionId = '' } = {}) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('chrome-extension://')) return false;
  if (extensionId && url.startsWith(`chrome-extension://${extensionId}`)) return false;
  return true;
}

export function shouldTrackHostnameForBatch({
  hostname,
  settingsCache,
} = {}) {
  return shouldCollectDomainUsage(hostname, settingsCache);
}

export function resolveTabActivityState(tab, {
  focusedWindowId = null,
  lastActiveTabId = null,
  focusUnavailableActiveTabId = null,
  focusedActiveTabId = null,
  windowIdNone = -1,
} = {}) {
  const tabId = tab?.id ?? null;
  const isWindowFocused = focusedWindowId !== null && focusedWindowId !== windowIdNone;
  const isBrowserFocusedActive = focusedActiveTabId !== null
    && tabId !== null
    && tabId === focusedActiveTabId;
  const isFocusedWindowActive = focusedActiveTabId === null
    && isWindowFocused
    && tab?.active
    && tab?.windowId === focusedWindowId;
  const isFocusUnavailableActive = !isWindowFocused
    && focusUnavailableActiveTabId !== null
    && tabId !== null
    && tabId === focusUnavailableActiveTabId;
  const isActive = !!(isBrowserFocusedActive || isFocusedWindowActive || isFocusUnavailableActive);
  const audible = !!tab?.audible;

  return {
    tabId,
    isActive,
    idleOverride: audible,
    shouldSyncAudible: isActive && tabId !== null && tabId === lastActiveTabId,
    audible,
  };
}

export function resolveBackgroundPressureElapsed({
  now,
  lastTrackedTime,
  isActive,
  audible = false,
  lastActiveAt = null,
  lingerThresholdMs = BACKGROUND_LINGER_THRESHOLD_MS,
  staleThresholdMs = STALE_TAB_THRESHOLD_MS,
} = {}) {
  const end = Number(now);
  const lastTracked = Number(lastTrackedTime);
  if (!Number.isFinite(end) || !Number.isFinite(lastTracked) || end <= lastTracked || isActive) {
    return { mediaMs: 0, lingerMs: 0, staleMs: 0 };
  }

  const inactiveAnchor = Number.isFinite(Number(lastActiveAt))
    ? Number(lastActiveAt)
    : lastTracked;
  const elapsedSince = (thresholdMs) => {
    const threshold = Math.max(0, Number(thresholdMs) || 0);
    const startsAt = Math.max(lastTracked, inactiveAnchor + threshold);
    return Math.max(0, end - startsAt);
  };

  return {
    mediaMs: audible ? end - lastTracked : 0,
    lingerMs: elapsedSince(lingerThresholdMs),
    staleMs: elapsedSince(staleThresholdMs),
  };
}
