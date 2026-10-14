import { requireStatsRuntimeEpoch } from '../../contracts/statsRuntimeEpochContracts.js';

const STATS_RUNTIME_EPOCH_BYTE_LENGTH = 16;

export function createStatsRuntimeEpoch({ cryptoOwner = globalThis.crypto } = {}) {
  if (!cryptoOwner || typeof cryptoOwner.getRandomValues !== 'function') {
    const error = new Error('STATS_RUNTIME_EPOCH_CRYPTO_OWNER_REQUIRED');
    error.code = 'STATS_RUNTIME_EPOCH_CRYPTO_OWNER_REQUIRED';
    throw error;
  }
  const bytes = new Uint8Array(STATS_RUNTIME_EPOCH_BYTE_LENGTH);
  cryptoOwner.getRandomValues.call(cryptoOwner, bytes);
  return requireStatsRuntimeEpoch(
    Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(''),
  );
}

function createEmptyStatsCache() {
  return { dates: {} };
}

function createEmptyCommitEventState() {
  return {
    status: 'success',
    error: null,
    dateStr: null,
    emittedAt: 0,
  };
}

export function summarizeStatsFactsRangeReadFailure(error, {
  requestedDaysBack = null,
  resolvedDaysBack = null,
  revision = null,
  startedAt = null,
  completedAt = Date.now(),
} = {}) {
  return {
    status: 'failed',
    error: {
      code: typeof error?.code === 'string' && error.code
        ? error.code
        : 'STATS_FACTS_RANGE_READ_FAILED',
      message: typeof error?.message === 'string' && error.message
        ? error.message
        : String(error || 'STATS_FACTS_RANGE_READ_FAILED'),
    },
    requestedDaysBack,
    resolvedDaysBack,
    revision,
    startedAt,
    completedAt,
    durationMs: Number.isFinite(startedAt) ? Math.max(0, completedAt - startedAt) : null,
    dateCount: 0,
    dateStrs: [],
    totals: { activeMs: 0, backgroundMs: 0, totalMs: 0 },
    topDomains: [],
    dates: [],
    hourlyRead: isPlainObject(error?.diagnostics) ? error.diagnostics : null,
  };
}

function createEmptyDiagnosticsState() {
  return {
    load: null,
    save: null,
    rollover: null,
    auxiliary: null,
  };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toSafeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeDiagnostic(error, {
  code = 'STATS_RUNTIME_ERROR',
  operation = 'runtime',
} = {}) {
  if (!error) return null;
  return {
    code: typeof error.code === 'string' && error.code ? error.code : code,
    operation,
    message: typeof error.message === 'string' && error.message
      ? error.message
      : String(error),
    at: Date.now(),
  };
}

function createEmptyDirtyHoursByDate() {
  return {};
}

function createEmptyDirtyHourScopesByDate() {
  return {};
}

function summarizeRangeDomains(dates) {
  const domainTotals = new Map();
  Object.values(dates).forEach((day) => {
    const domains = isPlainObject(day?.domains) ? day.domains : {};
    Object.entries(domains).forEach(([domain, stats]) => {
      const key = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
      if (!key) return;
      const current = domainTotals.get(key) || {
        domain: key,
        activeMs: 0,
        backgroundMs: 0,
        totalMs: 0,
        visits: 0,
        dateCount: 0,
      };
      const activeMs = toSafeNumber(stats?.active);
      const backgroundMs = toSafeNumber(stats?.background);
      current.activeMs += activeMs;
      current.backgroundMs += backgroundMs;
      current.totalMs += activeMs + backgroundMs;
      current.visits += toSafeNumber(stats?.visits);
      current.dateCount += 1;
      domainTotals.set(key, current);
    });
  });

  return Array.from(domainTotals.values())
    .sort((left, right) => right.totalMs - left.totalMs)
    .slice(0, 8);
}

export function summarizeStatsFactsRangeRead(range, {
  requestedDaysBack = null,
  resolvedDaysBack = null,
  revision = null,
  startedAt = null,
  completedAt = Date.now(),
  hourlyReadDiagnostics = null,
} = {}) {
  const dates = isPlainObject(range?.dates) ? range.dates : {};
  const dateSummaries = Object.entries(dates)
    .map(([dateStr, day]) => {
      const domains = isPlainObject(day?.domains) ? day.domains : {};
      const topDomains = Object.entries(domains)
        .map(([domain, stats]) => {
          const activeMs = toSafeNumber(stats?.active);
          const backgroundMs = toSafeNumber(stats?.background);
          return {
            domain,
            activeMs,
            backgroundMs,
            totalMs: activeMs + backgroundMs,
            visits: toSafeNumber(stats?.visits),
          };
        })
        .filter((entry) => entry.totalMs > 0 || entry.visits > 0)
        .sort((left, right) => right.totalMs - left.totalMs)
        .slice(0, 5);

      return {
        dateStr,
        activeMs: toSafeNumber(day?.totals?.totalActive),
        backgroundMs: toSafeNumber(day?.totals?.totalBackground),
        totalMs: toSafeNumber(day?.totals?.totalActive) + toSafeNumber(day?.totals?.totalBackground),
        domainCount: Object.keys(domains).length,
        topDomains,
      };
    })
    .sort((left, right) => left.dateStr.localeCompare(right.dateStr));

  const totals = dateSummaries.reduce((next, entry) => {
    next.activeMs += entry.activeMs;
    next.backgroundMs += entry.backgroundMs;
    next.totalMs += entry.totalMs;
    return next;
  }, {
    activeMs: 0,
    backgroundMs: 0,
    totalMs: 0,
  });

  return {
    requestedDaysBack,
    resolvedDaysBack,
    revision,
    startedAt,
    completedAt,
    durationMs: Number.isFinite(startedAt) ? Math.max(0, completedAt - startedAt) : null,
    dateCount: dateSummaries.length,
    dateStrs: dateSummaries.map((entry) => entry.dateStr),
    totals,
    topDomains: summarizeRangeDomains(dates),
    dates: dateSummaries,
    hourlyRead: hourlyReadDiagnostics && typeof hourlyReadDiagnostics === 'object'
      ? hourlyReadDiagnostics
      : null,
  };
}

export function createStatsRuntimeState(options = {}) {
  const hasInjectedRuntimeEpoch = Object.prototype.hasOwnProperty.call(options, 'runtimeEpoch');
  const runtimeEpoch = hasInjectedRuntimeEpoch
    ? requireStatsRuntimeEpoch(options.runtimeEpoch)
    : createStatsRuntimeEpoch({ cryptoOwner: options.cryptoOwner });
  return {
    runtimeEpoch,
    revision: 0,
    statsCache: createEmptyStatsCache(),
    statsDateStr: null,
    statsSealedThroughHour: -1,
    statsDirtyHoursByDate: createEmptyDirtyHoursByDate(),
    statsDirtyHourScopesByDate: createEmptyDirtyHourScopesByDate(),
    statsDiagnostics: createEmptyDiagnosticsState(),
    cacheLoaded: false,
    statsDirty: false,
    statsDirtyRevision: 0,
    statsSaveInFlight: null,
    statsLoadPromise: null,
    statsRolloverPromise: null,
    statsRolloverPendingPrime: null,
    statsFactsRangeCache: null,
    statsFactsRangeCacheDaysBack: null,
    statsFactsRangeCacheRevision: null,
    statsFactsRangeCacheAt: 0,
    statsFactsRangeCachePromise: null,
    statsFactsRangeCachePromiseDaysBack: null,
    statsFactsRangeCachePromiseRevision: null,
    statsFactsDerivedRangeCacheBase: null,
    statsFactsDerivedRangeCacheBySpan: new Map(),
    statsFactsRangeLastRead: null,
    rolloverLifecycle: null,
    commitEventState: createEmptyCommitEventState(),
  };
}

const runtimeState = createStatsRuntimeState();

export function ensureStatsRuntimeState(candidateState = null) {
  const state = candidateState && typeof candidateState === 'object'
    ? candidateState
    : runtimeState;
  const hasRuntimeEpoch = Object.prototype.hasOwnProperty.call(state, 'runtimeEpoch');
  const runtimeEpoch = hasRuntimeEpoch
    ? requireStatsRuntimeEpoch(state.runtimeEpoch)
    : createStatsRuntimeEpoch();
  state.runtimeEpoch = runtimeEpoch;
  const defaults = createStatsRuntimeState({ runtimeEpoch });

  for (const [key, value] of Object.entries(defaults)) {
    if (typeof state[key] === 'undefined') {
      state[key] = value;
    }
  }

  if (!state.statsCache || typeof state.statsCache !== 'object') {
    state.statsCache = createEmptyStatsCache();
  }
  if (!state.statsCache.dates || typeof state.statsCache.dates !== 'object') {
    state.statsCache.dates = {};
  }
  if (!state.commitEventState || typeof state.commitEventState !== 'object') {
    state.commitEventState = createEmptyCommitEventState();
  }
  if (!state.statsDiagnostics || typeof state.statsDiagnostics !== 'object') {
    state.statsDiagnostics = createEmptyDiagnosticsState();
  }
  if (!state.statsDirtyHoursByDate || typeof state.statsDirtyHoursByDate !== 'object') {
    state.statsDirtyHoursByDate = createEmptyDirtyHoursByDate();
  }
  if (!state.statsDirtyHourScopesByDate || typeof state.statsDirtyHourScopesByDate !== 'object') {
    state.statsDirtyHourScopesByDate = createEmptyDirtyHourScopesByDate();
  }
  if (typeof state.statsFactsRangeLastRead === 'undefined') {
    state.statsFactsRangeLastRead = null;
  }
  if (!(state.statsFactsDerivedRangeCacheBySpan instanceof Map)) {
    state.statsFactsDerivedRangeCacheBySpan = new Map();
  }

  return state;
}

export function getStatsRuntimeState() {
  return ensureStatsRuntimeState(runtimeState);
}

export function getStatsRuntimeRevision() {
  return getStatsRuntimeRevisionFor(runtimeState);
}

export function getStatsRuntimeEpoch() {
  return getStatsRuntimeEpochFor(runtimeState);
}

export function isStatsRuntimeRevision(revision) {
  return isStatsRuntimeRevisionFor(runtimeState, revision);
}

export function bumpStatsRuntimeRevision() {
  return bumpStatsRuntimeRevisionFor(runtimeState);
}

export function invalidateStatsFactsRuntimeRangeCache({ bumpRevision = false } = {}) {
  return invalidateStatsFactsRuntimeRangeCacheFor(runtimeState, { bumpRevision });
}

export function resetStatsRuntimeState({
  includeFactsRange = true,
  clearInflight = true,
} = {}) {
  return resetStatsRuntimeStateFor(runtimeState, { includeFactsRange, clearInflight });
}

export function getStatsRuntimeRevisionFor(candidateState) {
  const state = ensureStatsRuntimeState(candidateState);
  return Number(state.revision) || 0;
}

export function getStatsRuntimeEpochFor(candidateState) {
  const state = ensureStatsRuntimeState(candidateState);
  return requireStatsRuntimeEpoch(state.runtimeEpoch);
}

export function isStatsRuntimeRevisionFor(candidateState, revision) {
  return getStatsRuntimeRevisionFor(candidateState) === revision;
}

export function bumpStatsRuntimeRevisionFor(candidateState) {
  const state = ensureStatsRuntimeState(candidateState);
  state.revision = getStatsRuntimeRevisionFor(state) + 1;
  return state.revision;
}

export function invalidateStatsFactsRuntimeRangeCacheFor(
  candidateState,
  { bumpRevision = false } = {},
) {
  const state = ensureStatsRuntimeState(candidateState);
  state.statsFactsRangeCache = null;
  state.statsFactsRangeCacheDaysBack = null;
  state.statsFactsRangeCacheRevision = null;
  state.statsFactsRangeCacheAt = 0;
  state.statsFactsRangeCachePromise = null;
  state.statsFactsRangeCachePromiseDaysBack = null;
  state.statsFactsRangeCachePromiseRevision = null;
  state.statsFactsDerivedRangeCacheBase = null;
  state.statsFactsDerivedRangeCacheBySpan.clear();
  if (bumpRevision) {
    return bumpStatsRuntimeRevisionFor(state);
  }
  return getStatsRuntimeRevisionFor(state);
}

export function resetStatsRuntimeStateFor(
  candidateState,
  {
    includeFactsRange = true,
    clearInflight = true,
  } = {},
) {
  const state = ensureStatsRuntimeState(candidateState);
  state.statsCache = createEmptyStatsCache();
  state.statsDateStr = null;
  state.statsSealedThroughHour = -1;
  state.statsDirtyHoursByDate = createEmptyDirtyHoursByDate();
  state.statsDirtyHourScopesByDate = createEmptyDirtyHourScopesByDate();
  state.statsDiagnostics = createEmptyDiagnosticsState();
  state.cacheLoaded = false;
  state.statsDirty = false;
  state.statsDirtyRevision = 0;
  if (clearInflight) {
    state.statsSaveInFlight = null;
    state.statsLoadPromise = null;
    state.statsRolloverPromise = null;
    state.statsRolloverPendingPrime = null;
  }

  if (includeFactsRange) {
    state.statsFactsRangeCache = null;
    state.statsFactsRangeCacheDaysBack = null;
    state.statsFactsRangeCacheRevision = null;
    state.statsFactsRangeCacheAt = 0;
    state.statsFactsRangeCachePromise = null;
    state.statsFactsRangeCachePromiseDaysBack = null;
    state.statsFactsRangeCachePromiseRevision = null;
    state.statsFactsDerivedRangeCacheBase = null;
    state.statsFactsDerivedRangeCacheBySpan.clear();
  }

  return bumpStatsRuntimeRevisionFor(state);
}

export function clearStatsCommitEventState(candidateState) {
  const state = ensureStatsRuntimeState(candidateState);
  state.commitEventState = createEmptyCommitEventState();
  return state.commitEventState;
}

export function markStatsRuntimeDirty(candidateState) {
  const state = ensureStatsRuntimeState(candidateState);
  state.statsDirty = true;
  state.statsDirtyRevision = (Number(state.statsDirtyRevision) || 0) + 1;
  return state.statsDirtyRevision;
}

export function normalizeStatsDirtyHours(hours = []) {
  const source = Array.isArray(hours) ? hours : [hours];
  return Array.from(new Set(
    source
      .map((hour) => Math.floor(Number(hour)))
      .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23),
  )).sort((left, right) => left - right);
}

export function markStatsRuntimeDirtyHours(candidateState, dateStr, hours = []) {
  const state = ensureStatsRuntimeState(candidateState);
  const normalizedDateStr = typeof dateStr === 'string' && dateStr ? dateStr : state.statsDateStr;
  if (!normalizedDateStr) return [];
  const normalizedHours = normalizeStatsDirtyHours(hours);
  if (normalizedHours.length <= 0) return [];

  const existing = normalizeStatsDirtyHours(state.statsDirtyHoursByDate[normalizedDateStr]);
  state.statsDirtyHoursByDate[normalizedDateStr] = normalizeStatsDirtyHours([
    ...existing,
    ...normalizedHours,
  ]);
  return state.statsDirtyHoursByDate[normalizedDateStr];
}

export function getStatsRuntimeDirtyHours(candidateState, dateStr) {
  const state = ensureStatsRuntimeState(candidateState);
  const normalizedDateStr = typeof dateStr === 'string' && dateStr ? dateStr : state.statsDateStr;
  if (!normalizedDateStr) return [];
  return normalizeStatsDirtyHours(state.statsDirtyHoursByDate[normalizedDateStr]);
}

function normalizeDirtyScopeKeys(keys = []) {
  return Array.from(new Set(
    (Array.isArray(keys) ? keys : [])
      .filter((key) => typeof key === 'string' && key),
  )).sort();
}

function normalizeDirtyHourScope(scope, { full = false } = {}) {
  if (full || !scope || typeof scope !== 'object' || Array.isArray(scope)) {
    return {
      fullDomains: true,
      fullTransitionEdges: true,
      domainKeys: [],
      transitionEdgeKeys: [],
    };
  }
  return {
    fullDomains: scope.fullDomains === true,
    fullTransitionEdges: scope.fullTransitionEdges === true,
    domainKeys: normalizeDirtyScopeKeys(scope.domainKeys),
    transitionEdgeKeys: normalizeDirtyScopeKeys(scope.transitionEdgeKeys),
  };
}

function mergeDirtyHourScopes(previous, next) {
  const fullDomains = previous?.fullDomains === true || next.fullDomains === true;
  const fullTransitionEdges = previous?.fullTransitionEdges === true
    || next.fullTransitionEdges === true;
  return {
    fullDomains,
    fullTransitionEdges,
    domainKeys: fullDomains
      ? []
      : normalizeDirtyScopeKeys([
        ...(previous?.domainKeys || []),
        ...next.domainKeys,
      ]),
    transitionEdgeKeys: fullTransitionEdges
      ? []
      : normalizeDirtyScopeKeys([
        ...(previous?.transitionEdgeKeys || []),
        ...next.transitionEdgeKeys,
      ]),
  };
}

export function markStatsRuntimeDirtyHourScopes(
  candidateState,
  dateStr,
  hours = [],
  hourScopes = null,
) {
  const state = ensureStatsRuntimeState(candidateState);
  const normalizedDateStr = typeof dateStr === 'string' && dateStr ? dateStr : state.statsDateStr;
  if (!normalizedDateStr) return {};
  const normalizedHours = normalizeStatsDirtyHours(hours);
  if (normalizedHours.length <= 0) return {};
  const hasScopedInput = hourScopes && typeof hourScopes === 'object' && !Array.isArray(hourScopes);
  const currentByHour = state.statsDirtyHourScopesByDate[normalizedDateStr]
    && typeof state.statsDirtyHourScopesByDate[normalizedDateStr] === 'object'
    ? state.statsDirtyHourScopesByDate[normalizedDateStr]
    : {};

  normalizedHours.forEach((hour) => {
    const hasExactScope = hasScopedInput
      && Object.prototype.hasOwnProperty.call(hourScopes, hour);
    const nextScope = normalizeDirtyHourScope(
      hasExactScope ? hourScopes[hour] : null,
      { full: !hasExactScope },
    );
    currentByHour[hour] = mergeDirtyHourScopes(currentByHour[hour], nextScope);
  });
  state.statsDirtyHourScopesByDate[normalizedDateStr] = currentByHour;
  return getStatsRuntimeDirtyHourScopes(state, normalizedDateStr);
}

export function getStatsRuntimeDirtyHourScopes(candidateState, dateStr) {
  const state = ensureStatsRuntimeState(candidateState);
  const normalizedDateStr = typeof dateStr === 'string' && dateStr ? dateStr : state.statsDateStr;
  if (!normalizedDateStr) return {};
  const scopes = state.statsDirtyHourScopesByDate[normalizedDateStr];
  if (!scopes || typeof scopes !== 'object') return {};
  return Object.fromEntries(
    Object.entries(scopes).map(([hour, scope]) => [
      hour,
      normalizeDirtyHourScope(scope),
    ]),
  );
}

export function clearStatsRuntimeDirtyHourScopes(candidateState, dateStr, hours = []) {
  const state = ensureStatsRuntimeState(candidateState);
  const normalizedDateStr = typeof dateStr === 'string' && dateStr ? dateStr : state.statsDateStr;
  if (!normalizedDateStr) return {};
  const scopes = state.statsDirtyHourScopesByDate[normalizedDateStr];
  if (!scopes || typeof scopes !== 'object') return {};
  const normalizedHours = normalizeStatsDirtyHours(hours);
  if (normalizedHours.length <= 0) {
    delete state.statsDirtyHourScopesByDate[normalizedDateStr];
    return {};
  }
  normalizedHours.forEach((hour) => {
    delete scopes[hour];
  });
  if (Object.keys(scopes).length <= 0) {
    delete state.statsDirtyHourScopesByDate[normalizedDateStr];
    return {};
  }
  return getStatsRuntimeDirtyHourScopes(state, normalizedDateStr);
}

export function clearStatsRuntimeDirtyHours(candidateState, dateStr, hours = []) {
  const state = ensureStatsRuntimeState(candidateState);
  const normalizedDateStr = typeof dateStr === 'string' && dateStr ? dateStr : state.statsDateStr;
  if (!normalizedDateStr) return [];
  const existing = getStatsRuntimeDirtyHours(state, normalizedDateStr);
  if (existing.length <= 0) return [];
  const normalizedHours = normalizeStatsDirtyHours(hours);
  if (normalizedHours.length <= 0) {
    delete state.statsDirtyHoursByDate[normalizedDateStr];
    clearStatsRuntimeDirtyHourScopes(state, normalizedDateStr);
    return [];
  }
  const remove = new Set(normalizedHours);
  const remaining = existing.filter((hour) => !remove.has(hour));
  if (remaining.length > 0) {
    state.statsDirtyHoursByDate[normalizedDateStr] = remaining;
  } else {
    delete state.statsDirtyHoursByDate[normalizedDateStr];
  }
  clearStatsRuntimeDirtyHourScopes(state, normalizedDateStr, normalizedHours);
  return remaining;
}

export function markStatsRuntimeDirtyWithHours(
  candidateState,
  {
    dateStr = null,
    hours = [],
    hourScopes = null,
  } = {},
) {
  const version = markStatsRuntimeDirty(candidateState);
  markStatsRuntimeDirtyHours(candidateState, dateStr, hours);
  markStatsRuntimeDirtyHourScopes(candidateState, dateStr, hours, hourScopes);
  return version;
}

export function pruneStatsRuntimeDates(candidateState, keepDateStr = null) {
  const state = ensureStatsRuntimeState(candidateState);
  const keep = keepDateStr || state.statsDateStr;
  if (!keep) return;

  for (const dateStr of Object.keys(state.statsCache.dates)) {
    if (dateStr !== keep) {
      delete state.statsCache.dates[dateStr];
    }
  }
  for (const dateStr of Object.keys(state.statsDirtyHoursByDate)) {
    if (dateStr !== keep) {
      delete state.statsDirtyHoursByDate[dateStr];
    }
  }
  for (const dateStr of Object.keys(state.statsDirtyHourScopesByDate)) {
    if (dateStr !== keep) {
      delete state.statsDirtyHourScopesByDate[dateStr];
    }
  }
}

export function isStatsRuntimeCacheFresh(candidateState, dateStr) {
  const state = ensureStatsRuntimeState(candidateState);
  return (
    state.cacheLoaded &&
    state.statsDateStr === dateStr &&
    !!state.statsCache?.dates?.[dateStr] &&
    !state.statsDirty
  );
}

export function setStatsRuntimeDay(
  candidateState,
  {
    dateStr,
    dayData,
    sealedThroughHour = -1,
    cacheLoaded = true,
    statsDirty = false,
  } = {},
) {
  const state = ensureStatsRuntimeState(candidateState);
  state.statsCache = {
    dates: dateStr ? { [dateStr]: dayData } : {},
  };
  state.statsDateStr = dateStr || null;
  state.statsSealedThroughHour = Number.isFinite(Number(sealedThroughHour))
    ? Number(sealedThroughHour)
    : -1;
  state.cacheLoaded = !!cacheLoaded;
  state.statsDirty = !!statsDirty;
  state.statsDirtyHoursByDate = createEmptyDirtyHoursByDate();
  state.statsDirtyHourScopesByDate = createEmptyDirtyHourScopesByDate();
  return state;
}

export function setStatsRuntimeDiagnostic(candidateState, scope, error, options = {}) {
  const state = ensureStatsRuntimeState(candidateState);
  const key = typeof scope === 'string' && scope ? scope : 'load';
  state.statsDiagnostics[key] = normalizeDiagnostic(error, {
    code: options.code || `STATS_${key.toUpperCase()}_FAILED`,
    operation: options.operation || key,
  });
  return state.statsDiagnostics[key];
}

export function clearStatsRuntimeDiagnostic(candidateState, scope = null) {
  const state = ensureStatsRuntimeState(candidateState);
  if (typeof scope === 'string' && scope) {
    state.statsDiagnostics[scope] = null;
    return state.statsDiagnostics;
  }
  state.statsDiagnostics = createEmptyDiagnosticsState();
  return state.statsDiagnostics;
}

export function getStatsRuntimeDiagnostics(candidateState) {
  return ensureStatsRuntimeState(candidateState).statsDiagnostics;
}

export function setStatsFactsRuntimeRangeLastReadFor(candidateState, diagnostic = null) {
  const state = ensureStatsRuntimeState(candidateState);
  state.statsFactsRangeLastRead = diagnostic && typeof diagnostic === 'object'
    ? diagnostic
    : null;
  return state.statsFactsRangeLastRead;
}

export function getStatsFactsRuntimeRangeCacheDiagnostics(candidateState, { now = Date.now() } = {}) {
  const state = ensureStatsRuntimeState(candidateState);
  const cachedAt = Number(state.statsFactsRangeCacheAt) || 0;
  return {
    revision: getStatsRuntimeRevisionFor(state),
    hasCache: Boolean(state.statsFactsRangeCache),
    cacheDaysBack: state.statsFactsRangeCacheDaysBack ?? null,
    cacheRevision: state.statsFactsRangeCacheRevision ?? null,
    cacheAgeMs: cachedAt > 0 ? Math.max(0, now - cachedAt) : null,
    hasPromise: Boolean(state.statsFactsRangeCachePromise),
    promiseDaysBack: state.statsFactsRangeCachePromiseDaysBack ?? null,
    promiseRevision: state.statsFactsRangeCachePromiseRevision ?? null,
    lastRead: state.statsFactsRangeLastRead ?? null,
  };
}

export function getStatsRuntimeCache(candidateState) {
  return ensureStatsRuntimeState(candidateState).statsCache;
}

export function getStatsRuntimeDateStr(candidateState) {
  return ensureStatsRuntimeState(candidateState).statsDateStr;
}

export function getStatsRuntimeDateData(candidateState, dateStr) {
  return getStatsRuntimeCache(candidateState)?.dates?.[dateStr];
}
