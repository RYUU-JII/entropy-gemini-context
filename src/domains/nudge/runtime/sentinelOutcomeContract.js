export const SENTINEL_OUTCOME_REASONS = Object.freeze({
  SITE_STAY: 'stay',
  SITE_LEAVE: 'leave',
  GLOBAL_COLLAPSE_SUCCESS: 'global_sentinel_collapse_success',
  GLOBAL_RESYNC_FAILURE: 'global_sentinel_resync_failure',
});

export const GLOBAL_SENTINEL_OUTCOME_STATUS = Object.freeze({
  COLLAPSED: 'collapsed',
  RESYNCHRONIZED: 'resynchronized',
});

export const GLOBAL_SENTINEL_PROTECTION_MODE = Object.freeze({
  MAX_FILTER: 'max_filter',
  RELEASE: 'release',
});

export const GLOBAL_SENTINEL_RELEASE_MS = 15 * 60 * 1000;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeTimestamp(value, fallback = 0) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeDateStr(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? value.trim()
    : '';
}

export function normalizeSentinelOutcomeReason(reason) {
  const normalized = normalizeString(reason);
  if (normalized === SENTINEL_OUTCOME_REASONS.GLOBAL_COLLAPSE_SUCCESS) {
    return SENTINEL_OUTCOME_REASONS.GLOBAL_COLLAPSE_SUCCESS;
  }
  if (normalized === SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE) {
    return SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE;
  }
  if (normalized === SENTINEL_OUTCOME_REASONS.SITE_LEAVE) {
    return SENTINEL_OUTCOME_REASONS.SITE_LEAVE;
  }
  return SENTINEL_OUTCOME_REASONS.SITE_STAY;
}

export function isGlobalSentinelOutcomeReason(reason) {
  const normalized = normalizeSentinelOutcomeReason(reason);
  return normalized === SENTINEL_OUTCOME_REASONS.GLOBAL_COLLAPSE_SUCCESS
    || normalized === SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE;
}

export function createGlobalSentinelOutcomeState({
  reason = '',
  now = Date.now(),
  dateStr = '',
  runId = null,
  tabId = null,
} = {}) {
  const normalizedReason = normalizeSentinelOutcomeReason(reason);
  if (!isGlobalSentinelOutcomeReason(normalizedReason)) return null;

  const createdAt = normalizeTimestamp(now, Date.now());
  const isFailure = normalizedReason === SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE;
  const normalizedDateStr = normalizeDateStr(dateStr);
  if (!normalizedDateStr) return null;

  return {
    dateStr: normalizedDateStr,
    status: isFailure
      ? GLOBAL_SENTINEL_OUTCOME_STATUS.RESYNCHRONIZED
      : GLOBAL_SENTINEL_OUTCOME_STATUS.COLLAPSED,
    protectionMode: isFailure
      ? GLOBAL_SENTINEL_PROTECTION_MODE.RELEASE
      : GLOBAL_SENTINEL_PROTECTION_MODE.MAX_FILTER,
    reason: normalizedReason,
    createdAt,
    until: isFailure ? createdAt + GLOBAL_SENTINEL_RELEASE_MS : 0,
    runId: typeof runId === 'string' && runId.trim() ? runId.trim() : null,
    tabId: Number.isInteger(Number(tabId)) && Number(tabId) >= 0 ? Math.floor(Number(tabId)) : null,
  };
}

export function normalizeGlobalSentinelOutcomeState(raw = null, {
  now = Date.now(),
  dateStr = '',
} = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const normalizedDateStr = normalizeDateStr(raw.dateStr);
  const currentDateStr = normalizeDateStr(dateStr);
  if (!normalizedDateStr || (currentDateStr && normalizedDateStr !== currentDateStr)) {
    return null;
  }

  const protectionMode = normalizeString(raw.protectionMode);
  const status = normalizeString(raw.status);
  const createdAt = normalizeTimestamp(raw.createdAt, 0);
  if (!createdAt) return null;

  if (
    protectionMode === GLOBAL_SENTINEL_PROTECTION_MODE.RELEASE
    || status === GLOBAL_SENTINEL_OUTCOME_STATUS.RESYNCHRONIZED
  ) {
    const until = normalizeTimestamp(raw.until, 0);
    if (!until || normalizeTimestamp(now, Date.now()) >= until) return null;
    return {
      dateStr: normalizedDateStr,
      status: GLOBAL_SENTINEL_OUTCOME_STATUS.RESYNCHRONIZED,
      protectionMode: GLOBAL_SENTINEL_PROTECTION_MODE.RELEASE,
      reason: SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE,
      createdAt,
      until,
      runId: typeof raw.runId === 'string' && raw.runId.trim() ? raw.runId.trim() : null,
      tabId: Number.isInteger(Number(raw.tabId)) && Number(raw.tabId) >= 0 ? Math.floor(Number(raw.tabId)) : null,
    };
  }

  if (
    protectionMode === GLOBAL_SENTINEL_PROTECTION_MODE.MAX_FILTER
    || status === GLOBAL_SENTINEL_OUTCOME_STATUS.COLLAPSED
  ) {
    return {
      dateStr: normalizedDateStr,
      status: GLOBAL_SENTINEL_OUTCOME_STATUS.COLLAPSED,
      protectionMode: GLOBAL_SENTINEL_PROTECTION_MODE.MAX_FILTER,
      reason: SENTINEL_OUTCOME_REASONS.GLOBAL_COLLAPSE_SUCCESS,
      createdAt,
      until: 0,
      runId: typeof raw.runId === 'string' && raw.runId.trim() ? raw.runId.trim() : null,
      tabId: Number.isInteger(Number(raw.tabId)) && Number(raw.tabId) >= 0 ? Math.floor(Number(raw.tabId)) : null,
    };
  }

  return null;
}
