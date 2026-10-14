export const NEW_TAB_CONTEXT_WINDOW_MS = 30 * 1000;
export const TAB_NAVIGATION_STATE_TTL_MS = 30 * 60 * 1000;
export const TAB_NAVIGATION_STATE_SCHEMA_VERSION = 1;
export const MAX_TAB_NAVIGATION_STATE_ENTRIES = 64;
export const FOREGROUND_EVENT_WINDOW_MS = 60 * 60 * 1000;
export const MAX_FOREGROUND_EVENT_ENTRIES = 128;
export const MEDIA_CONTINUITY_WINDOW_MS = 10 * 60 * 1000;

export function normalizeTabId(tabId) {
  if (tabId === null || typeof tabId === 'undefined' || tabId === '') return null;
  const normalizedTabId = Number(tabId);
  return Number.isInteger(normalizedTabId) && normalizedTabId >= 0 ? normalizedTabId : null;
}

export function normalizeUrlForVisit(url) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch (_error) {
    return url;
  }
}

export function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

export function normalizeHostname(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

export function normalizeTransitionType(transitionType, fallback = null) {
  return typeof transitionType === 'string' && transitionType.trim()
    ? transitionType.trim()
    : fallback;
}

export function normalizeTransitionQualifiers(transitionQualifiers) {
  return Array.isArray(transitionQualifiers)
    ? transitionQualifiers.filter((qualifier) => typeof qualifier === 'string' && qualifier.trim())
    : [];
}

export function normalizeCreatedTabEntry(entry, now = Date.now()) {
  const source = typeof entry === 'object' && entry !== null
    ? entry
    : { createdAt: entry };
  const createdAt = normalizeTimestamp(source.createdAt, 0);
  if (createdAt <= 0 || Math.abs(normalizeTimestamp(now) - createdAt) > NEW_TAB_CONTEXT_WINDOW_MS) {
    return null;
  }
  return {
    createdAt,
    tabContextConsumed: source.tabContextConsumed === true,
  };
}

function normalizePersistedNavigationEntry(entry, timestampKey, now = Date.now()) {
  const tabId = normalizeTabId(entry?.tabId);
  const hostname = normalizeHostname(entry?.hostname);
  const timestamp = Number(entry?.[timestampKey]);
  if (tabId === null || !hostname || !Number.isFinite(timestamp)) return null;
  if (Math.abs(normalizeTimestamp(now) - timestamp) > TAB_NAVIGATION_STATE_TTL_MS) return null;

  const normalizedEntry = {
    tabId,
    hostname,
    normalizedUrl: normalizeUrlForVisit(entry?.normalizedUrl || ''),
    [timestampKey]: timestamp,
  };

  if (timestampKey === 'committedAt') {
    normalizedEntry.transitionType = normalizeTransitionType(entry?.transitionType);
    normalizedEntry.transitionQualifiers = normalizeTransitionQualifiers(entry?.transitionQualifiers);
  }
  if (timestampKey === 'completedAt') {
    normalizedEntry.visitIntentReason = typeof entry?.visitIntentReason === 'string'
      ? entry.visitIntentReason
      : null;
  }

  return normalizedEntry;
}

export function readLatestPersistedEntries(entries, timestampKey, now = Date.now()) {
  const latestByTabId = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const normalizedEntry = normalizePersistedNavigationEntry(entry, timestampKey, now);
    if (!normalizedEntry) return;
    const current = latestByTabId.get(normalizedEntry.tabId);
    if (!current || Number(normalizedEntry[timestampKey]) > Number(current[timestampKey])) {
      latestByTabId.set(normalizedEntry.tabId, normalizedEntry);
    }
  });
  return latestByTabId;
}

export function normalizeForegroundScope(scope = null) {
  const source = scope && typeof scope === 'object' ? scope : {};
  return {
    hostname: normalizeHostname(source.hostname || ''),
    tabId: normalizeTabId(source.tabId),
    activeAt: Math.max(0, Math.floor(Number(source.activeAt) || 0)),
  };
}

function normalizeEventTimes(values = [], now = Date.now(), windowMs = FOREGROUND_EVENT_WINDOW_MS) {
  const normalizedNow = normalizeTimestamp(now);
  return (Array.isArray(values) ? values : [])
    .map((value) => Math.max(0, Math.floor(Number(value) || 0)))
    .filter((value) => value > 0 && normalizedNow - value <= windowMs)
    .slice(-MAX_FOREGROUND_EVENT_ENTRIES);
}

export function normalizeHostState(snapshot = null, now = Date.now()) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    hostname: normalizeHostname(source.hostname || ''),
    lastForegroundAt: Math.max(0, Math.floor(Number(source.lastForegroundAt) || 0)),
    lastExitAt: Math.max(0, Math.floor(Number(source.lastExitAt) || 0)),
    lastTabId: normalizeTabId(source.lastTabId),
    lastUrl: typeof source.lastUrl === 'string' ? source.lastUrl : '',
    recentSwitchAts: normalizeEventTimes(source.recentSwitchAts, now),
    recentReturnAts: normalizeEventTimes(source.recentReturnAts, now),
    recentlyAudibleUntil: Math.max(0, Math.floor(Number(source.recentlyAudibleUntil) || 0)),
  };
}

export function selectRecentNavigationEntries(map, timestampKey) {
  return Array.from(map.values())
    .filter((entry) => Number.isFinite(Number(entry?.[timestampKey])))
    .sort((a, b) => Number(b[timestampKey]) - Number(a[timestampKey]))
    .slice(0, MAX_TAB_NAVIGATION_STATE_ENTRIES)
    .map((entry) => {
      const serialized = {
        tabId: entry.tabId,
        hostname: entry.hostname,
        normalizedUrl: normalizeUrlForVisit(entry.normalizedUrl || ''),
        [timestampKey]: Number(entry[timestampKey]),
      };
      if (timestampKey === 'committedAt') {
        serialized.transitionType = normalizeTransitionType(entry.transitionType);
        serialized.transitionQualifiers = normalizeTransitionQualifiers(entry.transitionQualifiers);
      }
      if (timestampKey === 'completedAt') {
        serialized.visitIntentReason = typeof entry.visitIntentReason === 'string'
          ? entry.visitIntentReason
          : null;
      }
      return serialized;
    });
}

export function selectCreatedTabEntries(map, now = Date.now()) {
  const timestamp = normalizeTimestamp(now);
  return Array.from(map.entries())
    .map(([tabId, entry]) => ({
      tabId,
      createdAt: Number(entry?.createdAt) || 0,
      tabContextConsumed: entry?.tabContextConsumed === true,
    }))
    .filter((entry) => entry.createdAt > 0 && timestamp - entry.createdAt <= NEW_TAB_CONTEXT_WINDOW_MS)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, MAX_TAB_NAVIGATION_STATE_ENTRIES);
}

export function selectHostEntries(map, now = Date.now()) {
  return Array.from(map.values())
    .map((entry) => normalizeHostState(entry, now))
    .filter((entry) => entry.hostname)
    .sort((a, b) => Number(b.lastForegroundAt || b.lastExitAt) - Number(a.lastForegroundAt || a.lastExitAt))
    .slice(0, MAX_TAB_NAVIGATION_STATE_ENTRIES);
}

export function selectForegroundEvents(events = [], now = Date.now()) {
  const normalizedNow = normalizeTimestamp(now);
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      hostname: normalizeHostname(event?.hostname || ''),
      tabId: normalizeTabId(event?.tabId),
      at: Math.max(0, Math.floor(Number(event?.at) || 0)),
    }))
    .filter((event) => event.hostname && event.at > 0 && normalizedNow - event.at <= FOREGROUND_EVENT_WINDOW_MS)
    .slice(-MAX_FOREGROUND_EVENT_ENTRIES);
}

export function buildEntryIntent(shouldRecordEntry, reason) {
  return {
    shouldRecordEntry: shouldRecordEntry === true,
    reason,
  };
}

export function hasActiveMediaSignal({
  audible = false,
  recentlyAudibleUntil = 0,
  now = Date.now(),
} = {}) {
  return audible === true
    || (Number(recentlyAudibleUntil) || 0) > normalizeTimestamp(now);
}
