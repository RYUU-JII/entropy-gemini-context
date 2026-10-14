import { requireFeedHistoryReceipts, requireFeedHistoryResetAt } from './feedContentFlowReceipt.js';
import { assertFeedHistoryReceiptsCovered } from './feedContentFlowReceiptIntegrity.js';
import { requireActiveUsageIntervals } from './activeUsageIntervals.js';
import { requireInterventionHistoryReceipts, assertInterventionHistoryReceiptsCovered } from './interventionHistoryReceipt.js';

export const STATS_SCHEMA_VERSION = 2;
export const STATS_HOURLY_CURSOR_CHECKPOINT_VERSION = 1;
export const STATS_RANGE_DEFAULT_DAYS = 90;
export const STATS_RANGE_MAX_DAYS = 90;
export const STATS_HOURLY_BUCKETS = 24;
export const STATS_MIN_UTC_OFFSET_MINUTES = -14 * 60;
export const STATS_MAX_UTC_OFFSET_MINUTES = 14 * 60;
export const STATS_DOMAIN_COLLECTION_OBSERVATION_VERSION = 'stats-domain-collection-observation-v1';

const STATS_DOMAIN_COLLECTION_OBSERVATION_KEYS = Object.freeze([
  'dataCollectionModes',
  'firstCapturedAt',
  'lastCapturedAt',
  'observed',
  'precisionInsightsModes',
  'sourceDomainCount',
  'version',
]);

export const STATS_CATEGORY_IDS = Object.freeze([
  'blocked',
  // Managed remains a current analysis cohort rather than a stored SSOT rule category.
  'managed',
  'allowed',
  'other',
]);

export const STATS_SWITCH_KEYS = Object.freeze([
  'toBlocked',
  'toAllowed',
  'toUnmanaged',
  'internal',
]);

export const STATS_REENTRY_GAP_BUCKET_KEYS = Object.freeze([
  'visit0To2m',
  'visit2To5m',
  'visit5To10m',
  'visit10To30m',
  'visit30To120m',
  'switch0To2m',
  'switch2To5m',
  'switch5To10m',
  'switch10To30m',
  'switch30To120m',
]);

function createHourlyArray() {
  return Array(STATS_HOURLY_BUCKETS).fill(0);
}

export function createEmptyReentryGapBuckets() {
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {});
}

export function createEmptyHourlyReentryGapBuckets() {
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = createHourlyArray();
    return result;
  }, {});
}

export function normalizeReentryGapBuckets(rawBuckets) {
  const source = isPlainObject(rawBuckets) ? rawBuckets : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = toSafeCount(source[key], 0);
    return result;
  }, {});
}

export function normalizeHourlyReentryGapBuckets(rawBuckets) {
  const source = isPlainObject(rawBuckets) ? rawBuckets : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = normalizeHourlyArray(source[key]).map((value) => toSafeCount(value, 0));
    return result;
  }, {});
}

const DEFAULT_TOTALS = Object.freeze({
  totalActive: 0,
  totalBackground: 0,
  blockedActive: 0,
  blockedBackground: 0,
});

const DEFAULT_SESSIONS = Object.freeze({
  count: 0,
  totalMs: 0,
  lastCommit: null,
});

const DEFAULT_SWITCHES = Object.freeze({
  toBlocked: 0,
  toAllowed: 0,
  toUnmanaged: 0,
  internal: 0,
});

const RESERVED_STATS_DOMAIN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const STATS_TRANSITION_EDGE_RECORD_KEYS = Object.freeze([
  'fromDomain',
  'toDomain',
  'count',
  'returnWithin10m',
  'hourlyCounts',
  'hourlyReturnWithin10m',
]);

const STATS_TRANSITION_EDGE_DELTA_KEYS = Object.freeze([
  'fromDomain',
  'toDomain',
  'count',
  'returnWithin10m',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeNonNegative(value, fallback = 0) {
  return Math.max(0, toSafeNumber(value, fallback));
}

export function normalizeStatsDomainKey(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\.+$/g, '');
  if (
    !normalized
    || normalized.length > 253
    || RESERVED_STATS_DOMAIN_KEYS.has(normalized)
    || /[/?#\s|\\]/.test(normalized)
  ) return null;

  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    const address = normalized.slice(1, -1);
    return address.includes(':') && /^[0-9a-f:.]+$/.test(address) ? normalized : null;
  }

  if (!/^[a-z0-9._-]+$/.test(normalized) || normalized.startsWith('.') || normalized.includes('..')) {
    return null;
  }
  const labels = normalized.split('.');
  if (labels.some((label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) {
    return null;
  }
  return normalized;
}

export function buildStatsTransitionEdgeKey({ fromDomain, toDomain } = {}) {
  const normalizedFromDomain = normalizeStatsDomainKey(fromDomain);
  const normalizedToDomain = normalizeStatsDomainKey(toDomain);
  if (
    !normalizedFromDomain
    || !normalizedToDomain
    || normalizedFromDomain === normalizedToDomain
  ) return null;
  return `${normalizedFromDomain}|${normalizedToDomain}`;
}

function requireStatsTransitionEdgeHourlyCounts(value, errorCode) {
  if (
    !Array.isArray(value)
    || value.length !== STATS_HOURLY_BUCKETS
    || value.some((count) => !Number.isSafeInteger(count) || count < 0)
  ) {
    const error = new Error(errorCode);
    error.code = errorCode;
    throw error;
  }
  return [...value];
}

export function normalizeStatsTransitionEdges(rawEdges) {
  if (!isPlainObject(rawEdges)) {
    const error = new Error('STATS_TRANSITION_EDGES_REQUIRED');
    error.code = 'STATS_TRANSITION_EDGES_REQUIRED';
    throw error;
  }

  const normalized = {};
  Object.entries(rawEdges).forEach(([rawKey, rawEdge]) => {
    if (
      !isPlainObject(rawEdge)
      || Object.keys(rawEdge).length !== STATS_TRANSITION_EDGE_RECORD_KEYS.length
      || STATS_TRANSITION_EDGE_RECORD_KEYS.some((key) => !Object.hasOwn(rawEdge, key))
    ) {
      const error = new Error('STATS_TRANSITION_EDGE_RECORD_INVALID');
      error.code = 'STATS_TRANSITION_EDGE_RECORD_INVALID';
      throw error;
    }

    const fromDomain = normalizeStatsDomainKey(rawEdge.fromDomain);
    const toDomain = normalizeStatsDomainKey(rawEdge.toDomain);
    const edgeKey = buildStatsTransitionEdgeKey({ fromDomain, toDomain });
    const count = rawEdge.count;
    const returnWithin10m = rawEdge.returnWithin10m;
    const hourlyCounts = requireStatsTransitionEdgeHourlyCounts(
      rawEdge.hourlyCounts,
      'STATS_TRANSITION_EDGE_HOURLY_COUNTS_INVALID',
    );
    const hourlyReturnWithin10m = requireStatsTransitionEdgeHourlyCounts(
      rawEdge.hourlyReturnWithin10m,
      'STATS_TRANSITION_EDGE_HOURLY_RETURNS_INVALID',
    );

    if (
      !edgeKey
      || rawKey !== edgeKey
      || rawEdge.fromDomain !== fromDomain
      || rawEdge.toDomain !== toDomain
      || !Number.isSafeInteger(count)
      || count < 1
      || !Number.isSafeInteger(returnWithin10m)
      || returnWithin10m < 0
      || returnWithin10m > count
      || hourlyCounts.reduce((sum, value) => sum + value, 0) !== count
      || hourlyReturnWithin10m.reduce((sum, value) => sum + value, 0) !== returnWithin10m
      || hourlyReturnWithin10m.some((value, hour) => value > hourlyCounts[hour])
    ) {
      const error = new Error('STATS_TRANSITION_EDGE_RECORD_INVALID');
      error.code = 'STATS_TRANSITION_EDGE_RECORD_INVALID';
      throw error;
    }

    normalized[edgeKey] = {
      fromDomain,
      toDomain,
      count,
      returnWithin10m,
      hourlyCounts,
      hourlyReturnWithin10m,
    };
  });
  return normalized;
}

export function normalizeStatsTransitionEdgeDeltas(rawDeltas) {
  if (!isPlainObject(rawDeltas)) {
    const error = new Error('STATS_TRANSITION_EDGE_DELTAS_REQUIRED');
    error.code = 'STATS_TRANSITION_EDGE_DELTAS_REQUIRED';
    throw error;
  }

  const normalized = {};
  Object.entries(rawDeltas).forEach(([rawKey, rawDelta]) => {
    const fromDomain = normalizeStatsDomainKey(rawDelta?.fromDomain);
    const toDomain = normalizeStatsDomainKey(rawDelta?.toDomain);
    const edgeKey = buildStatsTransitionEdgeKey({ fromDomain, toDomain });
    if (
      !isPlainObject(rawDelta)
      || Object.keys(rawDelta).length !== STATS_TRANSITION_EDGE_DELTA_KEYS.length
      || STATS_TRANSITION_EDGE_DELTA_KEYS.some((key) => !Object.hasOwn(rawDelta, key))
      || !edgeKey
      || rawKey !== edgeKey
      || rawDelta.fromDomain !== fromDomain
      || rawDelta.toDomain !== toDomain
      || !Number.isSafeInteger(rawDelta.count)
      || rawDelta.count < 1
      || !Number.isSafeInteger(rawDelta.returnWithin10m)
      || rawDelta.returnWithin10m < 0
      || rawDelta.returnWithin10m > rawDelta.count
    ) {
      const error = new Error('STATS_TRANSITION_EDGE_DELTA_INVALID');
      error.code = 'STATS_TRANSITION_EDGE_DELTA_INVALID';
      throw error;
    }
    normalized[edgeKey] = {
      fromDomain,
      toDomain,
      count: rawDelta.count,
      returnWithin10m: rawDelta.returnWithin10m,
    };
  });
  return normalized;
}

function toSafeCount(value, fallback = 0) {
  return Math.max(0, Math.floor(toSafeNumber(value, fallback)));
}

function normalizeStatsCalendarDateStr(value) {
  let candidate = null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) candidate = trimmed;
    if (/^\d{8}$/.test(trimmed)) {
      candidate = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    }
  }

  if (candidate) {
    const [year, month, day] = candidate.split('-').map(Number);
    const calendarDate = new Date(0);
    calendarDate.setUTCHours(0, 0, 0, 0);
    calendarDate.setUTCFullYear(year, month - 1, day);
    if (
      calendarDate.getUTCFullYear() === year
      && calendarDate.getUTCMonth() === month - 1
      && calendarDate.getUTCDate() === day
    ) {
      return candidate;
    }
  }
  return null;
}

export function normalizeStatsDateStr(value, fallback = null) {
  return normalizeStatsCalendarDateStr(value) ?? normalizeStatsCalendarDateStr(fallback);
}

export function normalizeStatsUtcOffsetMinutes(value) {
  if (value === null || typeof value === 'undefined' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const offsetMinutes = Number(value);
  if (
    !Number.isInteger(offsetMinutes)
    || offsetMinutes < STATS_MIN_UTC_OFFSET_MINUTES
    || offsetMinutes > STATS_MAX_UTC_OFFSET_MINUTES
  ) return null;
  return offsetMinutes;
}

function resolveStatsCivilHourUtcTs(dateStr, hour) {
  const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
  const normalizedHour = Number(hour);
  if (!normalizedDateStr || !Number.isInteger(normalizedHour) || normalizedHour < 0 || normalizedHour > 23) {
    return null;
  }
  const [year, month, day] = normalizedDateStr.split('-').map(Number);
  const civilHour = new Date(0);
  civilHour.setUTCHours(normalizedHour, 0, 0, 0);
  civilHour.setUTCFullYear(year, month - 1, day);
  return civilHour.getTime();
}

export function resolveStatsHourlyBucketStartTs(dateStr, hour) {
  const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
  const normalizedHour = Number(hour);
  if (!normalizedDateStr || !Number.isInteger(normalizedHour) || normalizedHour < 0 || normalizedHour > 23) {
    return null;
  }
  const [year, month, day] = normalizedDateStr.split('-').map(Number);
  const bucketStart = new Date(year, month - 1, day, normalizedHour, 0, 0, 0);
  if (
    bucketStart.getFullYear() !== year
    || bucketStart.getMonth() !== month - 1
    || bucketStart.getDate() !== day
    || bucketStart.getHours() !== normalizedHour
  ) return null;
  const timestamp = bucketStart.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function deriveStatsHourlyBucketUtcOffsetMinutes({
  dateStr,
  hour,
  bucketStartTs,
} = {}) {
  const civilHourUtcTs = resolveStatsCivilHourUtcTs(dateStr, hour);
  if (
    bucketStartTs === null
    || typeof bucketStartTs === 'undefined'
    || typeof bucketStartTs === 'boolean'
    || (typeof bucketStartTs === 'string' && bucketStartTs.trim() === '')
  ) return null;
  const normalizedBucketStartTs = Number(bucketStartTs);
  if (civilHourUtcTs === null || !Number.isFinite(normalizedBucketStartTs)) return null;
  return normalizeStatsUtcOffsetMinutes(
    (civilHourUtcTs - normalizedBucketStartTs) / 60_000,
  );
}

export function isStatsHourlyBucketIdentityValid({
  dateStr,
  hour,
  bucketStartTs,
  bucketUtcOffsetMinutes,
} = {}) {
  const normalizedOffsetMinutes = normalizeStatsUtcOffsetMinutes(bucketUtcOffsetMinutes);
  if (normalizedOffsetMinutes === null) return false;
  return deriveStatsHourlyBucketUtcOffsetMinutes({
    dateStr,
    hour,
    bucketStartTs,
  }) === normalizedOffsetMinutes;
}

export function createEmptyCategoryTotals() {
  const byCategory = {};
  for (const id of STATS_CATEGORY_IDS) {
    byCategory[id] = { active: 0, background: 0 };
  }
  return byCategory;
}

export function createEmptyHourlyRollup() {
  const byCategory = {};
  for (const id of STATS_CATEGORY_IDS) {
    byCategory[id] = {
      active: createHourlyArray(),
      background: createHourlyArray(),
    };
  }

  const switches = {};
  for (const key of STATS_SWITCH_KEYS) {
    switches[key] = createHourlyArray();
  }

  return {
    active: createHourlyArray(),
    background: createHourlyArray(),
    byCategory,
    sessions: {
      count: createHourlyArray(),
      totalMs: createHourlyArray(),
    },
    switches,
  };
}

export function createEmptyDomainStats(now = Date.now()) {
  return {
    active: 0,
    protectedActive: 0,
    background: 0,
    visits: 0,
    hourly: Array(STATS_HOURLY_BUCKETS).fill(0),
    hourlyActive: Array(STATS_HOURLY_BUCKETS).fill(0),
    hourlyProtectedActive: Array(STATS_HOURLY_BUCKETS).fill(0),
    hourlyBackground: Array(STATS_HOURLY_BUCKETS).fill(0),
    hourlyVisits: Array(STATS_HOURLY_BUCKETS).fill(0),
    sessions: createEmptyDomainSessionStats(),
    behavior: createEmptyDomainBehaviorStats(),
    interventions: createEmptyDomainInterventionStats(),
    navigation: createEmptyDomainNavigationStats(),
    collection: createEmptyDomainCollectionStats(now),
    activeCommittedThroughAt: null,
    lastTrackedTime: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
  };
}

export function createEmptyDomainCollectionStats(now = Date.now()) {
  const timestamp = toSafeNumber(now, Date.now());
  return {
    firstCapturedAt: timestamp,
    lastCapturedAt: timestamp,
    dataCollectionMode: null,
    precisionInsightsMode: null,
  };
}

function createStatsDomainCollectionObservationError(code, source) {
  const error = new Error(source ? `${code}:${source}` : code);
  error.code = code;
  error.source = source;
  return error;
}

function normalizeCollectionModeList(values, field, source) {
  if (!Array.isArray(values)
    || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATION_INVALID',
      `${source}.${field}`,
    );
  }
  const normalized = Array.from(new Set(values.map((value) => value.trim()))).sort();
  if (normalized.length !== values.length
    || normalized.some((value, index) => value !== values[index])) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATION_INVALID',
      `${source}.${field}`,
    );
  }
  return normalized;
}

export function createUnobservedStatsDomainCollectionObservation() {
  return {
    version: STATS_DOMAIN_COLLECTION_OBSERVATION_VERSION,
    observed: false,
    sourceDomainCount: 0,
    firstCapturedAt: null,
    lastCapturedAt: null,
    dataCollectionModes: [],
    precisionInsightsModes: [],
  };
}

export function requireStatsDomainCollectionObservation(value, {
  source = 'statsDomainCollectionObservation',
} = {}) {
  if (!isPlainObject(value)) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATION_REQUIRED',
      source,
    );
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== STATS_DOMAIN_COLLECTION_OBSERVATION_KEYS.length
    || keys.some((key, index) => key !== STATS_DOMAIN_COLLECTION_OBSERVATION_KEYS[index])) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATION_INVALID',
      source,
    );
  }
  if (value.version !== STATS_DOMAIN_COLLECTION_OBSERVATION_VERSION
    || typeof value.observed !== 'boolean'
    || !Number.isInteger(value.sourceDomainCount)
    || value.sourceDomainCount < 0) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATION_INVALID',
      source,
    );
  }
  const dataCollectionModes = normalizeCollectionModeList(
    value.dataCollectionModes,
    'dataCollectionModes',
    source,
  );
  const precisionInsightsModes = normalizeCollectionModeList(
    value.precisionInsightsModes,
    'precisionInsightsModes',
    source,
  );
  if (!value.observed) {
    if (value.sourceDomainCount !== 0
      || value.firstCapturedAt !== null
      || value.lastCapturedAt !== null
      || dataCollectionModes.length > 0
      || precisionInsightsModes.length > 0) {
      throw createStatsDomainCollectionObservationError(
        'STATS_DOMAIN_COLLECTION_OBSERVATION_INVALID',
        source,
      );
    }
  } else if (value.sourceDomainCount <= 0
    || !Number.isFinite(value.firstCapturedAt)
    || value.firstCapturedAt < 0
    || !Number.isFinite(value.lastCapturedAt)
    || value.lastCapturedAt < value.firstCapturedAt) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATION_INVALID',
      source,
    );
  }
  return {
    version: value.version,
    observed: value.observed,
    sourceDomainCount: value.sourceDomainCount,
    firstCapturedAt: value.firstCapturedAt,
    lastCapturedAt: value.lastCapturedAt,
    dataCollectionModes,
    precisionInsightsModes,
  };
}

export function buildStatsDomainCollectionObservation(rawCollection, {
  source = 'domainStats.collection',
} = {}) {
  if (rawCollection === null || typeof rawCollection === 'undefined') {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_SOURCE_REQUIRED',
      source,
    );
  }
  if (!isPlainObject(rawCollection)) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_SOURCE_INVALID',
      source,
    );
  }
  const firstCapturedAt = Number(rawCollection.firstCapturedAt);
  const lastCapturedAt = Number(rawCollection.lastCapturedAt);
  if (!Number.isFinite(firstCapturedAt)
    || firstCapturedAt < 0
    || !Number.isFinite(lastCapturedAt)
    || lastCapturedAt < firstCapturedAt) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_SOURCE_INVALID',
      source,
    );
  }
  const dataCollectionMode = rawCollection.dataCollectionMode;
  const precisionInsightsMode = rawCollection.precisionInsightsMode;
  if ((dataCollectionMode !== null
      && (typeof dataCollectionMode !== 'string' || !dataCollectionMode.trim()))
    || (precisionInsightsMode !== null
      && (typeof precisionInsightsMode !== 'string' || !precisionInsightsMode.trim()))) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_SOURCE_INVALID',
      source,
    );
  }
  return requireStatsDomainCollectionObservation({
    version: STATS_DOMAIN_COLLECTION_OBSERVATION_VERSION,
    observed: true,
    sourceDomainCount: 1,
    firstCapturedAt,
    lastCapturedAt,
    dataCollectionModes: dataCollectionMode === null ? [] : [dataCollectionMode.trim()],
    precisionInsightsModes: precisionInsightsMode === null ? [] : [precisionInsightsMode.trim()],
  }, { source });
}

export function mergeStatsDomainCollectionObservations(observations, {
  source = 'statsDomainCollectionObservations',
} = {}) {
  if (!Array.isArray(observations)) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_OBSERVATIONS_INVALID',
      source,
    );
  }
  const observed = observations
    .map((value, index) => requireStatsDomainCollectionObservation(value, {
      source: `${source}[${index}]`,
    }))
    .filter((value) => value.observed);
  if (observed.length === 0) return createUnobservedStatsDomainCollectionObservation();
  return requireStatsDomainCollectionObservation({
    version: STATS_DOMAIN_COLLECTION_OBSERVATION_VERSION,
    observed: true,
    sourceDomainCount: observed.reduce((sum, value) => sum + value.sourceDomainCount, 0),
    firstCapturedAt: Math.min(...observed.map((value) => value.firstCapturedAt)),
    lastCapturedAt: Math.max(...observed.map((value) => value.lastCapturedAt)),
    dataCollectionModes: Array.from(new Set(
      observed.flatMap((value) => value.dataCollectionModes),
    )).sort(),
    precisionInsightsModes: Array.from(new Set(
      observed.flatMap((value) => value.precisionInsightsModes),
    )).sort(),
  }, { source });
}

export function createEmptyDomainSessionStats() {
  return {
    count: 0,
    totalMs: 0,
    shortCount: 0,
    longCount: 0,
    maxMs: 0,
    hourlyCount: createHourlyArray(),
    hourlyTotalMs: createHourlyArray(),
    hourlyShortCount: createHourlyArray(),
    hourlyLongCount: createHourlyArray(),
    hourlyMaxMs: createHourlyArray(),
  };
}

export function createEmptyDomainBehaviorStats() {
  return {
    backgroundMediaMs: 0,
    backgroundLingerMs: 0,
    staleTabMs: 0,
    revisitWithin2m: 0,
    revisitWithin5m: 0,
    revisitWithin10m: 0,
    reentryGapBuckets: createEmptyReentryGapBuckets(),
    switchIns: 0,
    switchOuts: 0,
    switchBackWithin10m: 0,
    newTabEntrances: 0,
    duplicateTabEntrances: 0,
    highOpenTabEntrances: 0,
    maxSameDomainOpenTabs: 0,
    maxOpenTabs: 0,
    scrollSpikeBursts: 0,
    fastScrollBursts: 0,
    feedPressureSignals: 0,
    feedInterruptSignals: 0,
    feedAdvanceBursts: 0,
    feedSkimSignals: 0,
    shortMediaAttentionSignals: 0,
    shortMediaWatchMs: 0,
    maxFeedScreenfuls: 0,
    maxFeedItemTransitions: 0,
    hourlyBackgroundMediaMs: createHourlyArray(),
    hourlyBackgroundLingerMs: createHourlyArray(),
    hourlyStaleTabMs: createHourlyArray(),
    hourlyRevisitWithin2m: createHourlyArray(),
    hourlyRevisitWithin5m: createHourlyArray(),
    hourlyRevisitWithin10m: createHourlyArray(),
    hourlyReentryGapBuckets: createEmptyHourlyReentryGapBuckets(),
    hourlySwitchIns: createHourlyArray(),
    hourlySwitchOuts: createHourlyArray(),
    hourlySwitchBackWithin10m: createHourlyArray(),
    hourlyNewTabEntrances: createHourlyArray(),
    hourlyDuplicateTabEntrances: createHourlyArray(),
    hourlyHighOpenTabEntrances: createHourlyArray(),
    hourlyMaxSameDomainOpenTabs: createHourlyArray(),
    hourlyMaxOpenTabs: createHourlyArray(),
    hourlyScrollSpikeBursts: createHourlyArray(),
    hourlyFastScrollBursts: createHourlyArray(),
    hourlyFeedPressureSignals: createHourlyArray(),
    hourlyFeedInterruptSignals: createHourlyArray(),
    hourlyFeedAdvanceBursts: createHourlyArray(),
    hourlyFeedSkimSignals: createHourlyArray(),
    hourlyShortMediaAttentionSignals: createHourlyArray(),
    hourlyShortMediaWatchMs: createHourlyArray(),
    hourlyMaxFeedScreenfuls: createHourlyArray(),
    hourlyMaxFeedItemTransitions: createHourlyArray(),
    lastVisitAt: 0,
    lastEntryAt: 0,
    lastExitAt: 0,
    lastTabContextAt: 0,
    lastContentFlowAt: 0,
  };
}

export function createEmptyDomainInterventionStats() {
  return {
    frictionShown: 0,
    continued: 0,
    left: 0,
    reenteredWithin5m: 0,
    reenteredWithin30m: 0,
    escapeClosed: 0,
    hourlyFrictionShown: createHourlyArray(),
    hourlyContinued: createHourlyArray(),
    hourlyLeft: createHourlyArray(),
    hourlyReenteredWithin5m: createHourlyArray(),
    hourlyReenteredWithin30m: createHourlyArray(),
    hourlyEscapeClosed: createHourlyArray(),
    lastShownAt: 0,
    lastContinuedAt: 0,
    lastLeftAt: 0,
    lastReenteredAt: 0,
  };
}

export function createEmptyDomainNavigationStats() {
  return {
    total: 0,
    link: 0,
    typed: 0,
    reload: 0,
    generated: 0,
    keyword: 0,
    formSubmit: 0,
    startPage: 0,
    autoBookmark: 0,
    other: 0,
    addressBar: 0,
    forwardBack: 0,
    hourlyTotal: createHourlyArray(),
    hourlyLink: createHourlyArray(),
    hourlyTyped: createHourlyArray(),
    hourlyReload: createHourlyArray(),
    hourlyGenerated: createHourlyArray(),
    hourlyKeyword: createHourlyArray(),
    hourlyFormSubmit: createHourlyArray(),
    hourlyStartPage: createHourlyArray(),
    hourlyAutoBookmark: createHourlyArray(),
    hourlyOther: createHourlyArray(),
    hourlyAddressBar: createHourlyArray(),
    hourlyForwardBack: createHourlyArray(),
    lastNavigationAt: 0,
  };
}

export function createEmptyStatsDay() {
  return {
    schemaVersion: STATS_SCHEMA_VERSION,
    domains: {},
    totals: { ...DEFAULT_TOTALS },
    byCategory: createEmptyCategoryTotals(),
    switches: { ...DEFAULT_SWITCHES },
    sessions: { ...DEFAULT_SESSIONS },
    transitionEdges: {},
    hourlyRollup: createEmptyHourlyRollup(),
  };
}

export function normalizeHourlyArray(raw) {
  const out = Array(STATS_HOURLY_BUCKETS).fill(0);
  if (Array.isArray(raw)) {
    for (let i = 0; i < STATS_HOURLY_BUCKETS; i += 1) {
      out[i] = toSafeNonNegative(raw[i], 0);
    }
    return out;
  }
  if (isPlainObject(raw)) {
    for (let i = 0; i < STATS_HOURLY_BUCKETS; i += 1) {
      out[i] = toSafeNonNegative(raw[i] ?? raw[String(i)], 0);
    }
  }
  return out;
}

export function normalizeTotals(rawTotals) {
  const src = isPlainObject(rawTotals) ? rawTotals : {};
  return {
    totalActive: toSafeNonNegative(src.totalActive, 0),
    totalBackground: toSafeNonNegative(src.totalBackground, 0),
    blockedActive: toSafeNonNegative(src.blockedActive, 0),
    blockedBackground: toSafeNonNegative(src.blockedBackground, 0),
  };
}

export function normalizeSwitches(rawSwitches) {
  const src = isPlainObject(rawSwitches) ? rawSwitches : {};
  return {
    toBlocked: Math.max(0, Math.floor(toSafeNumber(src.toBlocked, 0))),
    toAllowed: Math.max(0, Math.floor(toSafeNumber(src.toAllowed, 0))),
    toUnmanaged: Math.max(0, Math.floor(toSafeNumber(src.toUnmanaged, 0))),
    internal: Math.max(0, Math.floor(toSafeNumber(src.internal, 0))),
  };
}

export function normalizeSessions(rawSessions) {
  const src = isPlainObject(rawSessions) ? rawSessions : {};
  return {
    count: toSafeCount(src.count, 0),
    totalMs: toSafeNonNegative(src.totalMs, 0),
    lastCommit: requireStatsSessionCommitCursor(src.lastCommit),
  };
}

export function requireStatsSessionCommitCursor(rawCursor) {
  if (rawCursor === null || typeof rawCursor === 'undefined') return null;
  if (
    !isPlainObject(rawCursor)
    || Object.keys(rawCursor).length !== 2
    || !Object.hasOwn(rawCursor, 'sessionId')
    || !Object.hasOwn(rawCursor, 'endedAt')
    || typeof rawCursor.sessionId !== 'string'
    || !rawCursor.sessionId
    || rawCursor.sessionId.trim() !== rawCursor.sessionId
    || rawCursor.sessionId.length > 160
    || !Number.isSafeInteger(rawCursor.endedAt)
    || rawCursor.endedAt < 0
  ) {
    const error = new Error('STATS_SESSION_COMMIT_CURSOR_INVALID');
    error.code = 'STATS_SESSION_COMMIT_CURSOR_INVALID';
    throw error;
  }
  return {
    sessionId: rawCursor.sessionId,
    endedAt: rawCursor.endedAt,
  };
}

export function normalizeDomainSessionStats(rawSessions) {
  const src = isPlainObject(rawSessions) ? rawSessions : {};
  return {
    count: toSafeCount(src.count, 0),
    totalMs: toSafeNonNegative(src.totalMs, 0),
    shortCount: toSafeCount(src.shortCount, 0),
    longCount: toSafeCount(src.longCount, 0),
    maxMs: toSafeNonNegative(src.maxMs, 0),
    hourlyCount: normalizeHourlyArray(src.hourlyCount).map((value) => toSafeCount(value, 0)),
    hourlyTotalMs: normalizeHourlyArray(src.hourlyTotalMs),
    hourlyShortCount: normalizeHourlyArray(src.hourlyShortCount).map((value) => toSafeCount(value, 0)),
    hourlyLongCount: normalizeHourlyArray(src.hourlyLongCount).map((value) => toSafeCount(value, 0)),
    hourlyMaxMs: normalizeHourlyArray(src.hourlyMaxMs),
  };
}

export function normalizeDomainBehaviorStats(rawBehavior) {
  const src = isPlainObject(rawBehavior) ? rawBehavior : {};
  return {
    backgroundMediaMs: toSafeNonNegative(src.backgroundMediaMs, 0),
    backgroundLingerMs: toSafeNonNegative(src.backgroundLingerMs, 0),
    staleTabMs: toSafeNonNegative(src.staleTabMs, 0),
    revisitWithin2m: toSafeCount(src.revisitWithin2m, 0),
    revisitWithin5m: toSafeCount(src.revisitWithin5m, 0),
    revisitWithin10m: toSafeCount(src.revisitWithin10m, 0),
    reentryGapBuckets: normalizeReentryGapBuckets(src.reentryGapBuckets),
    switchIns: toSafeCount(src.switchIns, 0),
    switchOuts: toSafeCount(src.switchOuts, 0),
    switchBackWithin10m: toSafeCount(src.switchBackWithin10m, 0),
    newTabEntrances: toSafeCount(src.newTabEntrances, 0),
    duplicateTabEntrances: toSafeCount(src.duplicateTabEntrances, 0),
    highOpenTabEntrances: toSafeCount(src.highOpenTabEntrances, 0),
    maxSameDomainOpenTabs: toSafeCount(src.maxSameDomainOpenTabs, 0),
    maxOpenTabs: toSafeCount(src.maxOpenTabs, 0),
    scrollSpikeBursts: toSafeCount(src.scrollSpikeBursts, 0),
    fastScrollBursts: toSafeCount(src.fastScrollBursts, 0),
    feedPressureSignals: toSafeCount(src.feedPressureSignals, 0),
    feedInterruptSignals: toSafeCount(src.feedInterruptSignals, 0),
    feedAdvanceBursts: toSafeCount(src.feedAdvanceBursts, 0),
    feedSkimSignals: toSafeCount(src.feedSkimSignals, 0),
    shortMediaAttentionSignals: toSafeCount(src.shortMediaAttentionSignals, 0),
    shortMediaWatchMs: toSafeNonNegative(src.shortMediaWatchMs, 0),
    maxFeedScreenfuls: toSafeNonNegative(src.maxFeedScreenfuls, 0),
    maxFeedItemTransitions: toSafeCount(src.maxFeedItemTransitions, 0),
    hourlyBackgroundMediaMs: normalizeHourlyArray(src.hourlyBackgroundMediaMs),
    hourlyBackgroundLingerMs: normalizeHourlyArray(src.hourlyBackgroundLingerMs),
    hourlyStaleTabMs: normalizeHourlyArray(src.hourlyStaleTabMs),
    hourlyRevisitWithin2m: normalizeHourlyArray(src.hourlyRevisitWithin2m).map((value) => toSafeCount(value, 0)),
    hourlyRevisitWithin5m: normalizeHourlyArray(src.hourlyRevisitWithin5m).map((value) => toSafeCount(value, 0)),
    hourlyRevisitWithin10m: normalizeHourlyArray(src.hourlyRevisitWithin10m).map((value) => toSafeCount(value, 0)),
    hourlyReentryGapBuckets: normalizeHourlyReentryGapBuckets(src.hourlyReentryGapBuckets),
    hourlySwitchIns: normalizeHourlyArray(src.hourlySwitchIns).map((value) => toSafeCount(value, 0)),
    hourlySwitchOuts: normalizeHourlyArray(src.hourlySwitchOuts).map((value) => toSafeCount(value, 0)),
    hourlySwitchBackWithin10m: normalizeHourlyArray(src.hourlySwitchBackWithin10m).map((value) => toSafeCount(value, 0)),
    hourlyNewTabEntrances: normalizeHourlyArray(src.hourlyNewTabEntrances).map((value) => toSafeCount(value, 0)),
    hourlyDuplicateTabEntrances: normalizeHourlyArray(src.hourlyDuplicateTabEntrances).map((value) => toSafeCount(value, 0)),
    hourlyHighOpenTabEntrances: normalizeHourlyArray(src.hourlyHighOpenTabEntrances).map((value) => toSafeCount(value, 0)),
    hourlyMaxSameDomainOpenTabs: normalizeHourlyArray(src.hourlyMaxSameDomainOpenTabs).map((value) => toSafeCount(value, 0)),
    hourlyMaxOpenTabs: normalizeHourlyArray(src.hourlyMaxOpenTabs).map((value) => toSafeCount(value, 0)),
    hourlyScrollSpikeBursts: normalizeHourlyArray(src.hourlyScrollSpikeBursts).map((value) => toSafeCount(value, 0)),
    hourlyFastScrollBursts: normalizeHourlyArray(src.hourlyFastScrollBursts).map((value) => toSafeCount(value, 0)),
    hourlyFeedPressureSignals: normalizeHourlyArray(src.hourlyFeedPressureSignals).map((value) => toSafeCount(value, 0)),
    hourlyFeedInterruptSignals: normalizeHourlyArray(src.hourlyFeedInterruptSignals).map((value) => toSafeCount(value, 0)),
    hourlyFeedAdvanceBursts: normalizeHourlyArray(src.hourlyFeedAdvanceBursts).map((value) => toSafeCount(value, 0)),
    hourlyFeedSkimSignals: normalizeHourlyArray(src.hourlyFeedSkimSignals).map((value) => toSafeCount(value, 0)),
    hourlyShortMediaAttentionSignals: normalizeHourlyArray(src.hourlyShortMediaAttentionSignals).map((value) => toSafeCount(value, 0)),
    hourlyShortMediaWatchMs: normalizeHourlyArray(src.hourlyShortMediaWatchMs),
    hourlyMaxFeedScreenfuls: normalizeHourlyArray(src.hourlyMaxFeedScreenfuls),
    hourlyMaxFeedItemTransitions: normalizeHourlyArray(src.hourlyMaxFeedItemTransitions).map((value) => toSafeCount(value, 0)),
    lastVisitAt: toSafeNonNegative(src.lastVisitAt, 0),
    lastEntryAt: toSafeNonNegative(src.lastEntryAt, 0),
    lastExitAt: toSafeNonNegative(src.lastExitAt, 0),
    lastTabContextAt: toSafeNonNegative(src.lastTabContextAt, 0),
    lastContentFlowAt: toSafeNonNegative(src.lastContentFlowAt, 0),
  };
}

export function normalizeDomainInterventionStats(rawInterventions) {
  const src = isPlainObject(rawInterventions) ? rawInterventions : {};
  return {
    frictionShown: toSafeCount(src.frictionShown, 0),
    continued: toSafeCount(src.continued, 0),
    left: toSafeCount(src.left, 0),
    reenteredWithin5m: toSafeCount(src.reenteredWithin5m, 0),
    reenteredWithin30m: toSafeCount(src.reenteredWithin30m, 0),
    escapeClosed: toSafeCount(src.escapeClosed, 0),
    hourlyFrictionShown: normalizeHourlyArray(src.hourlyFrictionShown).map((value) => toSafeCount(value, 0)),
    hourlyContinued: normalizeHourlyArray(src.hourlyContinued).map((value) => toSafeCount(value, 0)),
    hourlyLeft: normalizeHourlyArray(src.hourlyLeft).map((value) => toSafeCount(value, 0)),
    hourlyReenteredWithin5m: normalizeHourlyArray(src.hourlyReenteredWithin5m).map((value) => toSafeCount(value, 0)),
    hourlyReenteredWithin30m: normalizeHourlyArray(src.hourlyReenteredWithin30m).map((value) => toSafeCount(value, 0)),
    hourlyEscapeClosed: normalizeHourlyArray(src.hourlyEscapeClosed).map((value) => toSafeCount(value, 0)),
    lastShownAt: toSafeNonNegative(src.lastShownAt, 0),
    lastContinuedAt: toSafeNonNegative(src.lastContinuedAt, 0),
    lastLeftAt: toSafeNonNegative(src.lastLeftAt, 0),
    lastReenteredAt: toSafeNonNegative(src.lastReenteredAt, 0),
  };
}

export function normalizeDomainNavigationStats(rawNavigation) {
  const src = isPlainObject(rawNavigation) ? rawNavigation : {};
  return {
    total: toSafeCount(src.total, 0),
    link: toSafeCount(src.link, 0),
    typed: toSafeCount(src.typed, 0),
    reload: toSafeCount(src.reload, 0),
    generated: toSafeCount(src.generated, 0),
    keyword: toSafeCount(src.keyword, 0),
    formSubmit: toSafeCount(src.formSubmit, 0),
    startPage: toSafeCount(src.startPage, 0),
    autoBookmark: toSafeCount(src.autoBookmark, 0),
    other: toSafeCount(src.other, 0),
    addressBar: toSafeCount(src.addressBar, 0),
    forwardBack: toSafeCount(src.forwardBack, 0),
    hourlyTotal: normalizeHourlyArray(src.hourlyTotal).map((value) => toSafeCount(value, 0)),
    hourlyLink: normalizeHourlyArray(src.hourlyLink).map((value) => toSafeCount(value, 0)),
    hourlyTyped: normalizeHourlyArray(src.hourlyTyped).map((value) => toSafeCount(value, 0)),
    hourlyReload: normalizeHourlyArray(src.hourlyReload).map((value) => toSafeCount(value, 0)),
    hourlyGenerated: normalizeHourlyArray(src.hourlyGenerated).map((value) => toSafeCount(value, 0)),
    hourlyKeyword: normalizeHourlyArray(src.hourlyKeyword).map((value) => toSafeCount(value, 0)),
    hourlyFormSubmit: normalizeHourlyArray(src.hourlyFormSubmit).map((value) => toSafeCount(value, 0)),
    hourlyStartPage: normalizeHourlyArray(src.hourlyStartPage).map((value) => toSafeCount(value, 0)),
    hourlyAutoBookmark: normalizeHourlyArray(src.hourlyAutoBookmark).map((value) => toSafeCount(value, 0)),
    hourlyOther: normalizeHourlyArray(src.hourlyOther).map((value) => toSafeCount(value, 0)),
    hourlyAddressBar: normalizeHourlyArray(src.hourlyAddressBar).map((value) => toSafeCount(value, 0)),
    hourlyForwardBack: normalizeHourlyArray(src.hourlyForwardBack).map((value) => toSafeCount(value, 0)),
    lastNavigationAt: toSafeNonNegative(src.lastNavigationAt, 0),
  };
}

export function normalizeCategoryTotals(rawByCategory) {
  const src = isPlainObject(rawByCategory) ? rawByCategory : {};
  const next = createEmptyCategoryTotals();

  for (const categoryId of STATS_CATEGORY_IDS) {
    const categoryValue = isPlainObject(src[categoryId]) ? src[categoryId] : {};
    next[categoryId] = {
      active: toSafeNonNegative(categoryValue.active, 0),
      background: toSafeNonNegative(categoryValue.background, 0),
    };
  }

  return next;
}

export function normalizeHourlyRollup(rawHourlyRollup) {
  const src = isPlainObject(rawHourlyRollup) ? rawHourlyRollup : {};
  const next = createEmptyHourlyRollup();

  next.active = normalizeHourlyArray(src.active);
  next.background = normalizeHourlyArray(src.background);

  const rawByCategory = isPlainObject(src.byCategory) ? src.byCategory : {};
  for (const categoryId of STATS_CATEGORY_IDS) {
    const categorySource = isPlainObject(rawByCategory[categoryId]) ? rawByCategory[categoryId] : {};
    next.byCategory[categoryId] = {
      active: normalizeHourlyArray(categorySource.active),
      background: normalizeHourlyArray(categorySource.background),
    };
  }

  const rawSessions = isPlainObject(src.sessions) ? src.sessions : {};
  next.sessions = {
    count: normalizeHourlyArray(rawSessions.count).map((value) => Math.max(0, Math.floor(value))),
    totalMs: normalizeHourlyArray(rawSessions.totalMs),
  };

  const rawSwitches = isPlainObject(src.switches) ? src.switches : {};
  for (const key of STATS_SWITCH_KEYS) {
    next.switches[key] = normalizeHourlyArray(rawSwitches[key]).map((value) => Math.max(0, Math.floor(value)));
  }

  return next;
}

export function requireStatsProtectedActive(value, active) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
    || typeof active !== 'number' || !Number.isFinite(active) || active < 0
    || value > active + 0.001) {
    const error = new Error('STATS_PROTECTED_ACTIVE_CONTRACT_INVALID');
    error.code = 'STATS_PROTECTED_ACTIVE_CONTRACT_INVALID';
    throw error;
  }
  return value;
}

export function requireStatsProtectedActiveFacts(domain) {
  if (!isPlainObject(domain)) throw new Error('STATS_PROTECTED_ACTIVE_CONTRACT_INVALID');
  const protectedActive = requireStatsProtectedActive(domain.protectedActive, domain.active);
  const hourly = domain.hourlyProtectedActive;
  if (!Array.isArray(hourly) || hourly.length !== STATS_HOURLY_BUCKETS
    || !Array.isArray(domain.hourlyActive) || domain.hourlyActive.length !== STATS_HOURLY_BUCKETS
    || Array.from(hourly).some((value, hour) => typeof value !== 'number' || !Number.isFinite(value) || value < 0
      || typeof domain.hourlyActive[hour] !== 'number' || !Number.isFinite(domain.hourlyActive[hour])
      || domain.hourlyActive[hour] < 0 || value > domain.hourlyActive[hour] + 0.001)
    || Math.abs(hourly.reduce((sum, value) => sum + value, 0) - protectedActive) > 0.001) {
    const error = new Error('STATS_PROTECTED_ACTIVE_HOURLY_CONTRACT_INVALID');
    error.code = 'STATS_PROTECTED_ACTIVE_HOURLY_CONTRACT_INVALID';
    throw error;
  }
  return { protectedActive, hourlyProtectedActive: [...hourly] };
}

export function normalizeDomainStats(rawDomain, { now = Date.now() } = {}) {
  const src = isPlainObject(rawDomain) ? rawDomain : {};
  const protectedFacts = requireStatsProtectedActiveFacts(src);
  const domain = createEmptyDomainStats(now);

  domain.active = toSafeNonNegative(src.active ?? src.activeMs, 0);
  domain.background = toSafeNonNegative(src.background ?? src.backgroundMs, 0);
  domain.visits = Math.max(0, Math.floor(toSafeNumber(src.visits, 0)));
  domain.hourly = normalizeHourlyArray(src.hourly);
  domain.hourlyActive = normalizeHourlyArray(src.hourlyActive);
  domain.protectedActive = protectedFacts.protectedActive;
  domain.hourlyProtectedActive = protectedFacts.hourlyProtectedActive;
  domain.hourlyBackground = normalizeHourlyArray(src.hourlyBackground);
  domain.hourlyVisits = normalizeHourlyArray(src.hourlyVisits).map((value) => Math.max(0, Math.floor(value)));
  domain.sessions = normalizeDomainSessionStats(src.sessions);
  domain.behavior = normalizeDomainBehaviorStats(src.behavior);
  domain.interventions = normalizeDomainInterventionStats(src.interventions);
  domain.navigation = normalizeDomainNavigationStats(src.navigation);
  domain.collection = normalizeDomainCollectionStats(src.collection);
  if (Object.hasOwn(src, 'activeUsageIntervals')) domain.activeUsageIntervals = requireActiveUsageIntervals(src.activeUsageIntervals);
  const activeCommittedThroughAt = (
    src.activeCommittedThroughAt !== null
    && typeof src.activeCommittedThroughAt !== 'undefined'
    && typeof src.activeCommittedThroughAt !== 'boolean'
    && !(typeof src.activeCommittedThroughAt === 'string' && src.activeCommittedThroughAt.trim() === '')
  ) ? Number(src.activeCommittedThroughAt) : NaN;
  domain.activeCommittedThroughAt = Number.isFinite(activeCommittedThroughAt)
    && activeCommittedThroughAt >= 0
    ? activeCommittedThroughAt
    : null;
  domain.lastTrackedTime = toSafeNumber(src.lastTrackedTime, toSafeNumber(now, Date.now()));

  return domain;
}

export function normalizeDomainCollectionStats(rawCollection) {
  if (!isPlainObject(rawCollection)) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_SOURCE_REQUIRED',
      'normalizeDomainCollectionStats',
    );
  }
  const firstCapturedAt = Number(rawCollection.firstCapturedAt);
  const lastCapturedAt = Number(rawCollection.lastCapturedAt);
  const dataCollectionMode = rawCollection.dataCollectionMode;
  const precisionInsightsMode = rawCollection.precisionInsightsMode;
  if (!Number.isFinite(firstCapturedAt)
    || firstCapturedAt < 0
    || !Number.isFinite(lastCapturedAt)
    || lastCapturedAt < firstCapturedAt
    || (dataCollectionMode !== null
      && (typeof dataCollectionMode !== 'string' || !dataCollectionMode.trim()))
    || (precisionInsightsMode !== null
      && (typeof precisionInsightsMode !== 'string' || !precisionInsightsMode.trim()))) {
    throw createStatsDomainCollectionObservationError(
      'STATS_DOMAIN_COLLECTION_SOURCE_INVALID',
      'normalizeDomainCollectionStats',
    );
  }
  return {
    firstCapturedAt,
    lastCapturedAt,
    dataCollectionMode: dataCollectionMode === null ? null : dataCollectionMode.trim(),
    precisionInsightsMode: precisionInsightsMode === null ? null : precisionInsightsMode.trim(),
  };
}

export function normalizeDomainMap(rawDomains, { now = Date.now() } = {}) {
  if (!isPlainObject(rawDomains)) return {};
  const map = {};
  for (const [hostnameRaw, value] of Object.entries(rawDomains)) {
    const hostname = normalizeStatsDomainKey(hostnameRaw);
    if (!hostname) continue;
    map[hostname] = normalizeDomainStats(value, { now });
  }
  return map;
}

export function normalizeStatsDay(rawDay, { now = Date.now() } = {}) {
  if (rawDay === null || typeof rawDay === 'undefined') {
    return createEmptyStatsDay();
  }
  if (!isPlainObject(rawDay)) {
    throw new Error('STATS_DAY_CONTRACT_INVALID');
  }
  if (rawDay.schemaVersion !== STATS_SCHEMA_VERSION) {
    throw new Error('STATS_DAY_VERSION_UNSUPPORTED');
  }

  const src = rawDay;

  const normalizedDay = {
    schemaVersion: STATS_SCHEMA_VERSION,
    domains: normalizeDomainMap(src.domains, { now }),
    totals: normalizeTotals(src.totals),
    byCategory: normalizeCategoryTotals(src.byCategory),
    switches: normalizeSwitches(src.switches),
    sessions: normalizeSessions(src.sessions),
    transitionEdges: normalizeStatsTransitionEdges(src.transitionEdges),
    hourlyRollup: normalizeHourlyRollup(src.hourlyRollup),
    ...(Object.hasOwn(src, 'feedHistoryReceipts')
      ? { feedHistoryReceipts: requireFeedHistoryReceipts(src.feedHistoryReceipts) }
      : {}),
    ...(Object.hasOwn(src, 'interventionHistoryReceipts')
      ? { interventionHistoryReceipts: requireInterventionHistoryReceipts(src.interventionHistoryReceipts) } : {}),
    ...(Object.hasOwn(src, 'feedHistoryResetAt')
      ? { feedHistoryResetAt: requireFeedHistoryResetAt(src.feedHistoryResetAt) }
      : {}),
  };
  if (Object.hasOwn(normalizedDay, 'feedHistoryReceipts')) {
    assertFeedHistoryReceiptsCovered(normalizedDay.feedHistoryReceipts, normalizedDay.domains);
  }
  if (Object.hasOwn(normalizedDay, 'interventionHistoryReceipts')) {
    assertInterventionHistoryReceiptsCovered(normalizedDay.interventionHistoryReceipts, normalizedDay.domains);
  }
  return normalizedDay;
}

export function normalizeStatsRange(rawRange, { now = Date.now() } = {}) {
  const srcDates = isPlainObject(rawRange?.dates) ? rawRange.dates : {};
  const dates = {};
  for (const [dateStrRaw, day] of Object.entries(srcDates)) {
    const dateStr = normalizeStatsDateStr(dateStrRaw, null);
    if (!dateStr) continue;
    dates[dateStr] = normalizeStatsDay(day, { now });
  }

  const next = {
    ...rawRange,
    dates,
  };

  // Preserve metadata that might have been calculated by worker
  if (rawRange?.summary) next.summary = { ...rawRange.summary };
  if (rawRange?.domainTotals) next.domainTotals = { ...rawRange.domainTotals };
  if (Array.isArray(rawRange?.trends)) next.trends = [...rawRange.trends];

  return next;
}
