import {
  STATS_CATEGORY_IDS,
  createEmptyDomainBehaviorStats,
  createEmptyDomainCollectionStats,
  createEmptyDomainInterventionStats,
  createEmptyDomainNavigationStats,
  createEmptyDomainSessionStats,
  createEmptyCategoryTotals,
  createEmptyHourlyRollup,
  STATS_SCHEMA_VERSION,
  normalizeHourlyReentryGapBuckets,
  normalizeReentryGapBuckets,
  requireStatsSessionCommitCursor,
  normalizeStatsDomainKey,
  requireStatsProtectedActiveFacts,
} from '../../contracts/statsContracts.js';

export const HOURLY_BUCKET_COUNT = 24;

// The collector owns mutable, normalized runtime records. These out-of-band
// markers keep repeat mutations from rebuilding every 24-slot array while
// leaving the persisted StatsDay/Domain shapes unchanged.
const preparedDayScaffolds = new WeakSet();
const preparedDomainScaffolds = new WeakSet();

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function registerPreparedStatsDayScaffoldGraph(dayData) {
  if (!isPlainObject(dayData) || !isPlainObject(dayData.domains)) {
    throw new Error('STATS_PREPARED_SCAFFOLD_GRAPH_INVALID');
  }
  preparedDayScaffolds.add(dayData);
  Object.values(dayData.domains).forEach((domainData) => {
    if (isPlainObject(domainData)) preparedDomainScaffolds.add(domainData);
  });
  return dayData;
}

export function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toNonNegative(value, fallback = 0) {
  return Math.max(0, toSafeNumber(value, fallback));
}

export function normalizeStatsCategoryId(categoryId) {
  if (typeof categoryId !== 'string') return 'other';
  const normalized = categoryId.trim().toLowerCase();
  return STATS_CATEGORY_IDS.includes(normalized) ? normalized : 'other';
}

function normalizeCategoryTotals(rawByCategory) {
  const source = isPlainObject(rawByCategory) ? rawByCategory : {};
  const next = createEmptyCategoryTotals();

  for (const categoryId of STATS_CATEGORY_IDS) {
    const categorySource = isPlainObject(source[categoryId]) ? source[categoryId] : {};
    next[categoryId] = {
      active: toNonNegative(categorySource.active, 0),
      background: toNonNegative(categorySource.background, 0),
    };
  }

  return next;
}

export function ensureArray24(raw) {
  const out = Array(HOURLY_BUCKET_COUNT).fill(0);
  if (Array.isArray(raw)) {
    for (let i = 0; i < HOURLY_BUCKET_COUNT; i += 1) {
      out[i] = toNonNegative(raw[i], 0);
    }
    return out;
  }
  if (isPlainObject(raw)) {
    for (let i = 0; i < HOURLY_BUCKET_COUNT; i += 1) {
      out[i] = toNonNegative(raw[i] ?? raw[String(i)], 0);
    }
  }
  return out;
}

export function ensureIntegerArray24(raw) {
  return ensureArray24(raw).map((value) => Math.max(0, Math.floor(value)));
}

function ensureDomainSessionStats(rawSessions) {
  const source = isPlainObject(rawSessions) ? rawSessions : {};
  const next = createEmptyDomainSessionStats();
  next.count = Math.max(0, Math.floor(toSafeNumber(source.count, 0)));
  next.totalMs = toNonNegative(source.totalMs, 0);
  next.shortCount = Math.max(0, Math.floor(toSafeNumber(source.shortCount, 0)));
  next.longCount = Math.max(0, Math.floor(toSafeNumber(source.longCount, 0)));
  next.maxMs = toNonNegative(source.maxMs, 0);
  next.hourlyCount = ensureIntegerArray24(source.hourlyCount);
  next.hourlyTotalMs = ensureArray24(source.hourlyTotalMs);
  next.hourlyShortCount = ensureIntegerArray24(source.hourlyShortCount);
  next.hourlyLongCount = ensureIntegerArray24(source.hourlyLongCount);
  next.hourlyMaxMs = ensureArray24(source.hourlyMaxMs);
  return next;
}

function ensureDomainBehaviorStats(rawBehavior) {
  const source = isPlainObject(rawBehavior) ? rawBehavior : {};
  const next = createEmptyDomainBehaviorStats();
  next.backgroundMediaMs = toNonNegative(source.backgroundMediaMs, 0);
  next.backgroundLingerMs = toNonNegative(source.backgroundLingerMs, 0);
  next.staleTabMs = toNonNegative(source.staleTabMs, 0);
  next.revisitWithin2m = Math.max(0, Math.floor(toSafeNumber(source.revisitWithin2m, 0)));
  next.revisitWithin5m = Math.max(0, Math.floor(toSafeNumber(source.revisitWithin5m, 0)));
  next.revisitWithin10m = Math.max(0, Math.floor(toSafeNumber(source.revisitWithin10m, 0)));
  next.reentryGapBuckets = normalizeReentryGapBuckets(source.reentryGapBuckets);
  next.switchIns = Math.max(0, Math.floor(toSafeNumber(source.switchIns, 0)));
  next.switchOuts = Math.max(0, Math.floor(toSafeNumber(source.switchOuts, 0)));
  next.switchBackWithin10m = Math.max(0, Math.floor(toSafeNumber(source.switchBackWithin10m, 0)));
  next.newTabEntrances = Math.max(0, Math.floor(toSafeNumber(source.newTabEntrances, 0)));
  next.duplicateTabEntrances = Math.max(0, Math.floor(toSafeNumber(source.duplicateTabEntrances, 0)));
  next.highOpenTabEntrances = Math.max(0, Math.floor(toSafeNumber(source.highOpenTabEntrances, 0)));
  next.maxSameDomainOpenTabs = Math.max(0, Math.floor(toSafeNumber(source.maxSameDomainOpenTabs, 0)));
  next.maxOpenTabs = Math.max(0, Math.floor(toSafeNumber(source.maxOpenTabs, 0)));
  next.scrollSpikeBursts = Math.max(0, Math.floor(toSafeNumber(source.scrollSpikeBursts, 0)));
  next.fastScrollBursts = Math.max(0, Math.floor(toSafeNumber(source.fastScrollBursts, 0)));
  next.feedPressureSignals = Math.max(0, Math.floor(toSafeNumber(source.feedPressureSignals, 0)));
  next.feedInterruptSignals = Math.max(0, Math.floor(toSafeNumber(source.feedInterruptSignals, 0)));
  next.feedAdvanceBursts = Math.max(0, Math.floor(toSafeNumber(source.feedAdvanceBursts, 0)));
  next.feedSkimSignals = Math.max(0, Math.floor(toSafeNumber(source.feedSkimSignals, 0)));
  next.shortMediaAttentionSignals = Math.max(0, Math.floor(toSafeNumber(source.shortMediaAttentionSignals, 0)));
  next.shortMediaWatchMs = toNonNegative(source.shortMediaWatchMs, 0);
  next.maxFeedScreenfuls = toNonNegative(source.maxFeedScreenfuls, 0);
  next.maxFeedItemTransitions = Math.max(0, Math.floor(toSafeNumber(source.maxFeedItemTransitions, 0)));
  next.hourlyBackgroundMediaMs = ensureArray24(source.hourlyBackgroundMediaMs);
  next.hourlyBackgroundLingerMs = ensureArray24(source.hourlyBackgroundLingerMs);
  next.hourlyStaleTabMs = ensureArray24(source.hourlyStaleTabMs);
  next.hourlyRevisitWithin2m = ensureIntegerArray24(source.hourlyRevisitWithin2m);
  next.hourlyRevisitWithin5m = ensureIntegerArray24(source.hourlyRevisitWithin5m);
  next.hourlyRevisitWithin10m = ensureIntegerArray24(source.hourlyRevisitWithin10m);
  next.hourlyReentryGapBuckets = normalizeHourlyReentryGapBuckets(source.hourlyReentryGapBuckets);
  next.hourlySwitchIns = ensureIntegerArray24(source.hourlySwitchIns);
  next.hourlySwitchOuts = ensureIntegerArray24(source.hourlySwitchOuts);
  next.hourlySwitchBackWithin10m = ensureIntegerArray24(source.hourlySwitchBackWithin10m);
  next.hourlyNewTabEntrances = ensureIntegerArray24(source.hourlyNewTabEntrances);
  next.hourlyDuplicateTabEntrances = ensureIntegerArray24(source.hourlyDuplicateTabEntrances);
  next.hourlyHighOpenTabEntrances = ensureIntegerArray24(source.hourlyHighOpenTabEntrances);
  next.hourlyMaxSameDomainOpenTabs = ensureIntegerArray24(source.hourlyMaxSameDomainOpenTabs);
  next.hourlyMaxOpenTabs = ensureIntegerArray24(source.hourlyMaxOpenTabs);
  next.hourlyScrollSpikeBursts = ensureIntegerArray24(source.hourlyScrollSpikeBursts);
  next.hourlyFastScrollBursts = ensureIntegerArray24(source.hourlyFastScrollBursts);
  next.hourlyFeedPressureSignals = ensureIntegerArray24(source.hourlyFeedPressureSignals);
  next.hourlyFeedInterruptSignals = ensureIntegerArray24(source.hourlyFeedInterruptSignals);
  next.hourlyFeedAdvanceBursts = ensureIntegerArray24(source.hourlyFeedAdvanceBursts);
  next.hourlyFeedSkimSignals = ensureIntegerArray24(source.hourlyFeedSkimSignals);
  next.hourlyShortMediaAttentionSignals = ensureIntegerArray24(source.hourlyShortMediaAttentionSignals);
  next.hourlyShortMediaWatchMs = ensureArray24(source.hourlyShortMediaWatchMs);
  next.hourlyMaxFeedScreenfuls = ensureArray24(source.hourlyMaxFeedScreenfuls);
  next.hourlyMaxFeedItemTransitions = ensureIntegerArray24(source.hourlyMaxFeedItemTransitions);
  next.lastVisitAt = toNonNegative(source.lastVisitAt, 0);
  next.lastEntryAt = toNonNegative(source.lastEntryAt, 0);
  next.lastExitAt = toNonNegative(source.lastExitAt, 0);
  next.lastTabContextAt = toNonNegative(source.lastTabContextAt, 0);
  next.lastContentFlowAt = toNonNegative(source.lastContentFlowAt, 0);
  return next;
}

function ensureDomainInterventionStats(rawInterventions) {
  const source = isPlainObject(rawInterventions) ? rawInterventions : {};
  const next = createEmptyDomainInterventionStats();
  next.frictionShown = Math.max(0, Math.floor(toSafeNumber(source.frictionShown, 0)));
  next.continued = Math.max(0, Math.floor(toSafeNumber(source.continued, 0)));
  next.left = Math.max(0, Math.floor(toSafeNumber(source.left, 0)));
  next.reenteredWithin5m = Math.max(0, Math.floor(toSafeNumber(source.reenteredWithin5m, 0)));
  next.reenteredWithin30m = Math.max(0, Math.floor(toSafeNumber(source.reenteredWithin30m, 0)));
  next.escapeClosed = Math.max(0, Math.floor(toSafeNumber(source.escapeClosed, 0)));
  next.hourlyFrictionShown = ensureIntegerArray24(source.hourlyFrictionShown);
  next.hourlyContinued = ensureIntegerArray24(source.hourlyContinued);
  next.hourlyLeft = ensureIntegerArray24(source.hourlyLeft);
  next.hourlyReenteredWithin5m = ensureIntegerArray24(source.hourlyReenteredWithin5m);
  next.hourlyReenteredWithin30m = ensureIntegerArray24(source.hourlyReenteredWithin30m);
  next.hourlyEscapeClosed = ensureIntegerArray24(source.hourlyEscapeClosed);
  next.lastShownAt = toNonNegative(source.lastShownAt, 0);
  next.lastContinuedAt = toNonNegative(source.lastContinuedAt, 0);
  next.lastLeftAt = toNonNegative(source.lastLeftAt, 0);
  next.lastReenteredAt = toNonNegative(source.lastReenteredAt, 0);
  return next;
}

function ensureDomainNavigationStats(rawNavigation) {
  const source = isPlainObject(rawNavigation) ? rawNavigation : {};
  const next = createEmptyDomainNavigationStats();
  next.total = Math.max(0, Math.floor(toSafeNumber(source.total, 0)));
  next.link = Math.max(0, Math.floor(toSafeNumber(source.link, 0)));
  next.typed = Math.max(0, Math.floor(toSafeNumber(source.typed, 0)));
  next.reload = Math.max(0, Math.floor(toSafeNumber(source.reload, 0)));
  next.generated = Math.max(0, Math.floor(toSafeNumber(source.generated, 0)));
  next.keyword = Math.max(0, Math.floor(toSafeNumber(source.keyword, 0)));
  next.formSubmit = Math.max(0, Math.floor(toSafeNumber(source.formSubmit, 0)));
  next.startPage = Math.max(0, Math.floor(toSafeNumber(source.startPage, 0)));
  next.autoBookmark = Math.max(0, Math.floor(toSafeNumber(source.autoBookmark, 0)));
  next.other = Math.max(0, Math.floor(toSafeNumber(source.other, 0)));
  next.addressBar = Math.max(0, Math.floor(toSafeNumber(source.addressBar, 0)));
  next.forwardBack = Math.max(0, Math.floor(toSafeNumber(source.forwardBack, 0)));
  next.hourlyTotal = ensureIntegerArray24(source.hourlyTotal);
  next.hourlyLink = ensureIntegerArray24(source.hourlyLink);
  next.hourlyTyped = ensureIntegerArray24(source.hourlyTyped);
  next.hourlyReload = ensureIntegerArray24(source.hourlyReload);
  next.hourlyGenerated = ensureIntegerArray24(source.hourlyGenerated);
  next.hourlyKeyword = ensureIntegerArray24(source.hourlyKeyword);
  next.hourlyFormSubmit = ensureIntegerArray24(source.hourlyFormSubmit);
  next.hourlyStartPage = ensureIntegerArray24(source.hourlyStartPage);
  next.hourlyAutoBookmark = ensureIntegerArray24(source.hourlyAutoBookmark);
  next.hourlyOther = ensureIntegerArray24(source.hourlyOther);
  next.hourlyAddressBar = ensureIntegerArray24(source.hourlyAddressBar);
  next.hourlyForwardBack = ensureIntegerArray24(source.hourlyForwardBack);
  next.lastNavigationAt = toNonNegative(source.lastNavigationAt, 0);
  return next;
}

function ensureDomainCollectionStats(rawCollection, now = Date.now()) {
  const source = isPlainObject(rawCollection) ? rawCollection : {};
  const fallback = createEmptyDomainCollectionStats(now);
  const firstCapturedAt = toNonNegative(source.firstCapturedAt, fallback.firstCapturedAt);
  const lastCapturedAt = toNonNegative(source.lastCapturedAt, firstCapturedAt);
  return {
    firstCapturedAt,
    lastCapturedAt,
    dataCollectionMode: typeof source.dataCollectionMode === 'string' && source.dataCollectionMode.trim()
      ? source.dataCollectionMode.trim()
      : null,
    precisionInsightsMode: typeof source.precisionInsightsMode === 'string' && source.precisionInsightsMode.trim()
      ? source.precisionInsightsMode.trim()
      : null,
  };
}

function ensureHourlyRollup(rawHourlyRollup) {
  const source = isPlainObject(rawHourlyRollup) ? rawHourlyRollup : {};
  const next = createEmptyHourlyRollup();

  next.active = ensureArray24(source.active);
  next.background = ensureArray24(source.background);

  const byCategory = isPlainObject(source.byCategory) ? source.byCategory : {};
  for (const categoryId of STATS_CATEGORY_IDS) {
    const categorySource = isPlainObject(byCategory[categoryId]) ? byCategory[categoryId] : {};
    next.byCategory[categoryId] = {
      active: ensureArray24(categorySource.active),
      background: ensureArray24(categorySource.background),
    };
  }

  const sessions = isPlainObject(source.sessions) ? source.sessions : {};
  next.sessions = {
    count: ensureIntegerArray24(sessions.count),
    totalMs: ensureArray24(sessions.totalMs),
  };

  const switches = isPlainObject(source.switches) ? source.switches : {};
  next.switches = {
    toBlocked: ensureIntegerArray24(switches.toBlocked),
    toAllowed: ensureIntegerArray24(switches.toAllowed),
    toUnmanaged: ensureIntegerArray24(switches.toUnmanaged),
    internal: ensureIntegerArray24(switches.internal),
  };

  return next;
}

export function ensureDayScaffold(dayData) {
  if (preparedDayScaffolds.has(dayData)) return dayData;
  if (Object.hasOwn(dayData, 'schemaVersion') && dayData.schemaVersion !== STATS_SCHEMA_VERSION) {
    throw new Error('STATS_DAY_VERSION_UNSUPPORTED');
  }
  dayData.schemaVersion = STATS_SCHEMA_VERSION;
  if (!isPlainObject(dayData.domains)) dayData.domains = {};
  if (!isPlainObject(dayData.totals)) {
    dayData.totals = { totalActive: 0, totalBackground: 0, blockedActive: 0, blockedBackground: 0 };
  } else {
    dayData.totals.totalActive = toNonNegative(dayData.totals.totalActive, 0);
    dayData.totals.totalBackground = toNonNegative(dayData.totals.totalBackground, 0);
    dayData.totals.blockedActive = toNonNegative(dayData.totals.blockedActive, 0);
    dayData.totals.blockedBackground = toNonNegative(dayData.totals.blockedBackground, 0);
  }
  if (!isPlainObject(dayData.switches)) {
    dayData.switches = { toBlocked: 0, toAllowed: 0, toUnmanaged: 0, internal: 0 };
  } else {
    dayData.switches.toBlocked = Math.max(0, Math.floor(toSafeNumber(dayData.switches.toBlocked, 0)));
    dayData.switches.toAllowed = Math.max(0, Math.floor(toSafeNumber(dayData.switches.toAllowed, 0)));
    dayData.switches.toUnmanaged = Math.max(0, Math.floor(toSafeNumber(dayData.switches.toUnmanaged, 0)));
    dayData.switches.internal = Math.max(0, Math.floor(toSafeNumber(dayData.switches.internal, 0)));
  }
  if (!isPlainObject(dayData.sessions)) {
    dayData.sessions = { count: 0, totalMs: 0, lastCommit: null };
  } else {
    dayData.sessions.count = Math.max(0, Math.floor(toSafeNumber(dayData.sessions.count, 0)));
    dayData.sessions.totalMs = toNonNegative(dayData.sessions.totalMs, 0);
    dayData.sessions.lastCommit = requireStatsSessionCommitCursor(dayData.sessions.lastCommit);
  }
  if (!isPlainObject(dayData.transitionEdges)) {
    throw new Error('STATS_TRANSITION_EDGES_REQUIRED');
  }
  dayData.byCategory = normalizeCategoryTotals(dayData.byCategory);
  dayData.hourlyRollup = ensureHourlyRollup(dayData.hourlyRollup);
  preparedDayScaffolds.add(dayData);
  return dayData;
}

export function ensureStatsDayRecord(statsCache, dateStr, { createEmptyDayStats }) {
  if (!isPlainObject(statsCache)) return null;
  if (!isPlainObject(statsCache.dates)) statsCache.dates = {};
  if (!isPlainObject(statsCache.dates[dateStr])) {
    statsCache.dates[dateStr] = typeof createEmptyDayStats === 'function'
      ? createEmptyDayStats()
      : {
          domains: {},
          totals: {},
          switches: {},
          sessions: {},
          transitionEdges: {},
        };
  }
  const dayData = statsCache.dates[dateStr];
  ensureDayScaffold(dayData);
  return dayData;
}

export function ensureDomainScaffold(domainData, now = Date.now()) {
  if (preparedDomainScaffolds.has(domainData)) return domainData;
  requireStatsProtectedActiveFacts(domainData);
  domainData.active = toNonNegative(domainData.active, 0);
  domainData.background = toNonNegative(domainData.background, 0);
  domainData.visits = Math.max(0, Math.floor(toSafeNumber(domainData.visits, 0)));
  domainData.hourly = ensureArray24(domainData.hourly);
  domainData.hourlyActive = ensureArray24(domainData.hourlyActive);
  domainData.hourlyBackground = ensureArray24(domainData.hourlyBackground);
  domainData.hourlyVisits = ensureIntegerArray24(domainData.hourlyVisits);
  domainData.sessions = ensureDomainSessionStats(domainData.sessions);
  domainData.behavior = ensureDomainBehaviorStats(domainData.behavior);
  domainData.interventions = ensureDomainInterventionStats(domainData.interventions);
  domainData.navigation = ensureDomainNavigationStats(domainData.navigation);
  domainData.collection = ensureDomainCollectionStats(domainData.collection, now);
  const activeCommittedThroughAt = (
    domainData.activeCommittedThroughAt !== null
    && typeof domainData.activeCommittedThroughAt !== 'undefined'
    && typeof domainData.activeCommittedThroughAt !== 'boolean'
    && !(typeof domainData.activeCommittedThroughAt === 'string' && domainData.activeCommittedThroughAt.trim() === '')
  ) ? Number(domainData.activeCommittedThroughAt) : NaN;
  domainData.activeCommittedThroughAt = Number.isFinite(activeCommittedThroughAt)
    && activeCommittedThroughAt >= 0
    ? activeCommittedThroughAt
    : null;
  domainData.lastTrackedTime = toSafeNumber(domainData.lastTrackedTime, toSafeNumber(now, Date.now()));
  preparedDomainScaffolds.add(domainData);
  return domainData;
}

export function ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now = Date.now() } = {}) {
  ensureDayScaffold(dayData);
  if (!hostname || typeof hostname !== 'string') {
    return { domainData: null, created: false };
  }
  const key = normalizeStatsDomainKey(hostname);
  if (!key) return { domainData: null, created: false };

  let created = false;
  if (!isPlainObject(dayData.domains[key])) {
    dayData.domains[key] = typeof createEmptyDomainStats === 'function'
      ? createEmptyDomainStats(now)
      : {
        active: 0,
        protectedActive: 0,
        background: 0,
        visits: 0,
        hourly: Array(HOURLY_BUCKET_COUNT).fill(0),
        hourlyActive: Array(HOURLY_BUCKET_COUNT).fill(0),
        hourlyProtectedActive: Array(HOURLY_BUCKET_COUNT).fill(0),
        hourlyBackground: Array(HOURLY_BUCKET_COUNT).fill(0),
        hourlyVisits: Array(HOURLY_BUCKET_COUNT).fill(0),
        activeCommittedThroughAt: null,
        lastTrackedTime: toSafeNumber(now, Date.now()),
      };
    created = true;
  }

  const domainData = dayData.domains[key];
  ensureDomainScaffold(domainData, now);
  return { domainData, created, hostname: key };
}

export function touchDomainTrackPoint({
  dayData,
  hostname,
  now = Date.now(),
  createEmptyDomainStats,
} = {}) {
  if (!isPlainObject(dayData)) return { touched: false, created: false };
  const { domainData, created } = ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now });
  if (!domainData) return { touched: false, created: false };
  domainData.lastTrackedTime = toSafeNumber(now, Date.now());
  return { touched: true, created };
}
