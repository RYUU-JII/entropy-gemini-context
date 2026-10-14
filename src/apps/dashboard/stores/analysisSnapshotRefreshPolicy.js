import { STATS_EVENT_TYPES } from '../../../domains/stats/contracts/statsEvents.js';

export const ANALYSIS_PROJECTION_STATS_EVENT_FRESHNESS_MS = 60_000;

export const ANALYSIS_PROJECTION_REFRESH_REASON = Object.freeze({
  BOOTSTRAP: 'bootstrap',
  EXPLICIT: 'explicit',
  POLICY_CHANGE: 'policy_change',
  STATS_COMMITTED: STATS_EVENT_TYPES.COMMITTED,
  STATS_ROLLOVER: STATS_EVENT_TYPES.ROLLOVER,
});

const normalizeTimestamp = (value) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? timestamp
    : 0;
};

const normalizeFreshnessMs = (value) => {
  const freshnessMs = Number(value);
  return Number.isFinite(freshnessMs) && freshnessMs > 0
    ? Math.floor(freshnessMs)
    : ANALYSIS_PROJECTION_STATS_EVENT_FRESHNESS_MS;
};

export function createAnalysisProjectionRefreshState({
  freshnessMs = ANALYSIS_PROJECTION_STATS_EVENT_FRESHNESS_MS,
  lastRefreshAtMs = 0,
  deferredStatsEventCount = 0,
  lastDeferredAtMs = 0,
  lastReason = null,
} = {}) {
  return Object.freeze({
    freshnessMs: normalizeFreshnessMs(freshnessMs),
    lastRefreshAtMs: normalizeTimestamp(lastRefreshAtMs),
    deferredStatsEventCount: Math.max(0, Math.floor(Number(deferredStatsEventCount) || 0)),
    lastDeferredAtMs: normalizeTimestamp(lastDeferredAtMs),
    lastReason: typeof lastReason === 'string' && lastReason ? lastReason : null,
  });
}

export function markAnalysisProjectionRefreshed(
  state = createAnalysisProjectionRefreshState(),
  {
    now = Date.now(),
    reason = ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT,
  } = {},
) {
  return createAnalysisProjectionRefreshState({
    freshnessMs: state?.freshnessMs,
    lastRefreshAtMs: normalizeTimestamp(now) || Date.now(),
    deferredStatsEventCount: 0,
    lastDeferredAtMs: 0,
    lastReason: typeof reason === 'string' && reason ? reason : ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT,
  });
}

export function resolveAnalysisProjectionRefreshDecision(
  state = createAnalysisProjectionRefreshState(),
  {
    force = false,
    throttle = false,
    now = Date.now(),
    reason = ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT,
  } = {},
) {
  const freshnessMs = normalizeFreshnessMs(state?.freshnessMs);
  const lastRefreshAtMs = normalizeTimestamp(state?.lastRefreshAtMs);
  const requestAtMs = normalizeTimestamp(now) || Date.now();
  const normalizedReason = typeof reason === 'string' && reason
    ? reason
    : ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT;
  const ageMs = lastRefreshAtMs > 0 ? Math.max(0, requestAtMs - lastRefreshAtMs) : null;
  const nextAllowedAtMs = lastRefreshAtMs > 0 ? lastRefreshAtMs + freshnessMs : requestAtMs;

  if (force === true) {
    return Object.freeze({
      shouldRefresh: true,
      deferred: false,
      reason: normalizedReason,
      refreshReason: 'forced',
      requestAtMs,
      lastRefreshAtMs,
      ageMs,
      nextAllowedAtMs,
      freshnessMs,
    });
  }

  const throttleStatsEvent = throttle === true
    && normalizedReason === ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED;
  if (!throttleStatsEvent || lastRefreshAtMs === 0 || ageMs >= freshnessMs) {
    const refreshReason = !throttleStatsEvent
      ? 'unthrottled'
      : (lastRefreshAtMs === 0 ? 'no_prior_refresh' : 'freshness_window_elapsed');
    return Object.freeze({
      shouldRefresh: true,
      deferred: false,
      reason: normalizedReason,
      refreshReason,
      requestAtMs,
      lastRefreshAtMs,
      ageMs,
      nextAllowedAtMs,
      freshnessMs,
    });
  }

  return Object.freeze({
    shouldRefresh: false,
    deferred: true,
    reason: normalizedReason,
    refreshReason: 'fresh_within_stats_event_window',
    requestAtMs,
    lastRefreshAtMs,
    ageMs,
    nextAllowedAtMs,
    freshnessMs,
  });
}

export function markAnalysisProjectionRefreshDeferred(
  state = createAnalysisProjectionRefreshState(),
  decision = null,
) {
  return createAnalysisProjectionRefreshState({
    freshnessMs: state?.freshnessMs,
    lastRefreshAtMs: state?.lastRefreshAtMs,
    deferredStatsEventCount: Math.max(0, Math.floor(Number(state?.deferredStatsEventCount) || 0)) + 1,
    lastDeferredAtMs: normalizeTimestamp(decision?.requestAtMs),
    lastReason: typeof decision?.reason === 'string' && decision.reason
      ? decision.reason
      : state?.lastReason,
  });
}
