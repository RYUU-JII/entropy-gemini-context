import DBManager from '../dbManager.js';
import { STORES } from '../dbConstants.js';
import {
  normalizeDailySummaryDateStr,
  normalizeStatsTransitionDomain,
  toFiniteTimestamp,
} from '../dbStatsNormalizers.js';
import {
  normalizeStatsDay,
} from '../../../../../domains/stats/contracts/statsContracts.js';

export const STATS_FEATURE_PACK_DAILY_VERSION = 1;
export const STATS_FEATURE_PACK_SOURCE = 'stats_daily_v1';
const STATS_FEATURE_PACK_RECORD_KEYS = Object.freeze([
  'id',
  'dateStr',
  'domain',
  'schemaVersion',
  'featurePackVersion',
  'generatedAt',
  'sourceStatsRevision',
  'policyFingerprint',
  'permissionCoverage',
  'source',
  'features',
  'dataCoverage',
  'integrityHash',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createStatsFeaturePackStoreError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function toSeconds(value) {
  return Math.round(toNumber(value) / 1000);
}

function normalizeString(value, { maxLength = 128, fallback = '' } = {}) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return fallback;
  return trimmed;
}

function sparse24h(values = [], { seconds = false, integer = true } = {}) {
  const hours = [];
  const packedValues = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const raw = Array.isArray(values) ? values[hour] : values?.[hour];
    let value = seconds ? toSeconds(raw) : toNumber(raw);
    if (integer) value = Math.floor(value);
    if (value <= 0) continue;
    hours.push(hour);
    packedValues.push(value);
  }
  return hours.length > 0 ? { h: hours, v: packedValues } : null;
}

function pickCounts(source = {}, keys = []) {
  return keys.reduce((acc, key) => {
    const count = toCount(source?.[key]);
    if (count > 0) acc[key] = count;
    return acc;
  }, {});
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashStableJson(value) {
  const json = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function buildDomainFeaturePack({
  dateStr,
  domain,
  domainStats,
  generatedAt,
  sourceStatsRevision,
} = {}) {
  const normalizedDomain = normalizeStatsTransitionDomain(domain);
  const normalizedDateStr = normalizeDailySummaryDateStr(dateStr);
  if (!normalizedDateStr || !normalizedDomain || !isPlainObject(domainStats)) return null;

  const behavior = domainStats.behavior || {};
  const interventions = domainStats.interventions || {};
  const navigation = domainStats.navigation || {};
  const sessions = domainStats.sessions || {};
  const features = {
    usage: {
      activeSec: toSeconds(domainStats.active),
      backgroundSec: toSeconds(domainStats.background),
      visits: toCount(domainStats.visits),
      hourlyActiveSec: sparse24h(domainStats.hourlyActive, { seconds: true }),
      hourlyBackgroundSec: sparse24h(domainStats.hourlyBackground, { seconds: true }),
      hourlyVisits: sparse24h(domainStats.hourlyVisits),
    },
    sessions: {
      count: toCount(sessions.count),
      totalSec: toSeconds(sessions.totalMs),
      shortCount: toCount(sessions.shortCount),
      longCount: toCount(sessions.longCount),
      maxSec: toSeconds(sessions.maxMs),
      hourlyCount: sparse24h(sessions.hourlyCount),
      hourlyTotalSec: sparse24h(sessions.hourlyTotalMs, { seconds: true }),
      hourlyShortCount: sparse24h(sessions.hourlyShortCount),
      hourlyLongCount: sparse24h(sessions.hourlyLongCount),
    },
    behavior: {
      ...pickCounts(behavior, [
        'revisitWithin2m',
        'revisitWithin5m',
        'revisitWithin10m',
        'switchIns',
        'switchOuts',
        'switchBackWithin10m',
        'newTabEntrances',
        'duplicateTabEntrances',
        'highOpenTabEntrances',
        'scrollSpikeBursts',
        'fastScrollBursts',
        'feedPressureSignals',
        'feedInterruptSignals',
        'feedAdvanceBursts',
        'feedSkimSignals',
      ]),
      backgroundMediaSec: toSeconds(behavior.backgroundMediaMs),
      backgroundLingerSec: toSeconds(behavior.backgroundLingerMs),
      staleTabSec: toSeconds(behavior.staleTabMs),
      maxSameDomainOpenTabs: toCount(behavior.maxSameDomainOpenTabs),
      maxOpenTabs: toCount(behavior.maxOpenTabs),
      hourlyRevisitWithin10m: sparse24h(behavior.hourlyRevisitWithin10m),
      hourlySwitchBackWithin10m: sparse24h(behavior.hourlySwitchBackWithin10m),
      hourlyScrollSpikeBursts: sparse24h(behavior.hourlyScrollSpikeBursts),
      hourlyFastScrollBursts: sparse24h(behavior.hourlyFastScrollBursts),
      hourlyFeedPressureSignals: sparse24h(behavior.hourlyFeedPressureSignals),
    },
    interventions: {
      ...pickCounts(interventions, [
        'frictionShown',
        'continued',
        'left',
        'reenteredWithin5m',
        'reenteredWithin30m',
        'escapeClosed',
      ]),
      hourlyFrictionShown: sparse24h(interventions.hourlyFrictionShown),
      hourlyContinued: sparse24h(interventions.hourlyContinued),
      hourlyLeft: sparse24h(interventions.hourlyLeft),
      hourlyReenteredWithin5m: sparse24h(interventions.hourlyReenteredWithin5m),
      hourlyReenteredWithin30m: sparse24h(interventions.hourlyReenteredWithin30m),
    },
    navigation: {
      ...pickCounts(navigation, [
        'total',
        'link',
        'typed',
        'reload',
        'generated',
        'keyword',
        'formSubmit',
        'startPage',
        'autoBookmark',
        'other',
        'addressBar',
        'forwardBack',
      ]),
      hourlyTotal: sparse24h(navigation.hourlyTotal),
      hourlyReload: sparse24h(navigation.hourlyReload),
      hourlyAddressBar: sparse24h(navigation.hourlyAddressBar),
      hourlyForwardBack: sparse24h(navigation.hourlyForwardBack),
    },
    collectionCoverage: {
      dataCollectionMode: normalizeString(domainStats.collection?.dataCollectionMode, { maxLength: 64, fallback: null }),
      precisionInsightsMode: normalizeString(domainStats.collection?.precisionInsightsMode, { maxLength: 64, fallback: null }),
      firstCapturedAt: toFiniteTimestamp(domainStats.collection?.firstCapturedAt) ?? null,
      lastCapturedAt: toFiniteTimestamp(domainStats.collection?.lastCapturedAt) ?? null,
    },
  };

  const dataCoverage = {
    hasUsageFacts: features.usage.activeSec > 0 || features.usage.backgroundSec > 0,
    hasVisitFacts: features.usage.visits > 0,
    hasSessionFacts: features.sessions.count > 0,
    hasBehaviorFacts: Object.keys(features.behavior).some((key) => (
      key.startsWith('hourly') ? !!features.behavior[key] : Number(features.behavior[key]) > 0
    )),
    hasInterventionFacts: Object.keys(features.interventions).some((key) => (
      key.startsWith('hourly') ? !!features.interventions[key] : Number(features.interventions[key]) > 0
    )),
    hasNavigationFacts: toCount(features.navigation.total) > 0,
  };
  const source = {
    sourceType: STATS_FEATURE_PACK_SOURCE,
    sourceStatsRevision: Math.max(0, Math.floor(Number(sourceStatsRevision) || 0)),
    policyFingerprint: hashStableJson(features.collectionCoverage),
  };
  const integrityHash = hashStableJson({
    dateStr: normalizedDateStr,
    domain: normalizedDomain,
    version: STATS_FEATURE_PACK_DAILY_VERSION,
    source,
    features,
    dataCoverage,
  });

  return {
    id: `${normalizedDateStr}|${normalizedDomain}`,
    dateStr: normalizedDateStr,
    domain: normalizedDomain,
    schemaVersion: STATS_FEATURE_PACK_DAILY_VERSION,
    featurePackVersion: STATS_FEATURE_PACK_DAILY_VERSION,
    generatedAt: toFiniteTimestamp(generatedAt) ?? Date.now(),
    sourceStatsRevision: source.sourceStatsRevision,
    policyFingerprint: source.policyFingerprint,
    permissionCoverage: features.collectionCoverage,
    source,
    features,
    dataCoverage,
    integrityHash,
  };
}

export function buildDailyStatsFeaturePacks({
  dateStr,
  dayData,
  generatedAt = Date.now(),
  sourceStatsRevision = 0,
} = {}) {
  const normalizedDateStr = normalizeDailySummaryDateStr(dateStr);
  if (!normalizedDateStr || !isPlainObject(dayData)) {
    throw createStatsFeaturePackStoreError('STATS_FEATURE_PACK_SOURCE_DAY_INVALID');
  }
  const day = normalizeStatsDay(dayData);
  return Object.entries(day.domains || {})
    .map(([domain, domainStats]) => buildDomainFeaturePack({
      dateStr: normalizedDateStr,
      domain,
      domainStats,
      generatedAt,
      sourceStatsRevision,
    }))
    .filter(Boolean)
    .filter((pack) => (
      pack.dataCoverage.hasUsageFacts
      || pack.dataCoverage.hasVisitFacts
      || pack.dataCoverage.hasBehaviorFacts
      || pack.dataCoverage.hasInterventionFacts
      || pack.dataCoverage.hasNavigationFacts
    ));
}

export function normalizeStatsFeaturePackRow(row = {}) {
  if (!isPlainObject(row)) return null;
  if (
    Object.keys(row).length !== STATS_FEATURE_PACK_RECORD_KEYS.length
    || STATS_FEATURE_PACK_RECORD_KEYS.some(
      (key) => !Object.prototype.hasOwnProperty.call(row, key),
    )
    || row.schemaVersion !== STATS_FEATURE_PACK_DAILY_VERSION
    || row.featurePackVersion !== STATS_FEATURE_PACK_DAILY_VERSION
  ) return null;
  const dateStr = normalizeDailySummaryDateStr(row.dateStr);
  const domain = normalizeStatsTransitionDomain(row.domain);
  const generatedAt = toFiniteTimestamp(row.generatedAt);
  const sourceStatsRevision = Number(row.sourceStatsRevision);
  if (
    !dateStr
    || dateStr !== row.dateStr
    || !domain
    || domain !== row.domain
    || !isPlainObject(row.features)
    || !isPlainObject(row.permissionCoverage)
    || !isPlainObject(row.source)
    || !isPlainObject(row.dataCoverage)
    || generatedAt === null
    || generatedAt !== row.generatedAt
    || !Number.isFinite(sourceStatsRevision)
    || !Number.isSafeInteger(sourceStatsRevision)
    || sourceStatsRevision < 0
  ) return null;
  const normalized = {
    ...row,
    id: `${dateStr}|${domain}`,
    dateStr,
    domain,
    schemaVersion: STATS_FEATURE_PACK_DAILY_VERSION,
    featurePackVersion: STATS_FEATURE_PACK_DAILY_VERSION,
    generatedAt,
    sourceStatsRevision: Math.floor(sourceStatsRevision),
    policyFingerprint: normalizeString(row.policyFingerprint, { maxLength: 128, fallback: '' }),
    integrityHash: normalizeString(row.integrityHash, { maxLength: 128, fallback: '' }),
  };
  if (stableJson(row) !== stableJson(normalized)) return null;
  return normalized;
}

export class StatsFeaturePackStore {
  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  static getInstance() {
    if (!StatsFeaturePackStore.instance) {
      StatsFeaturePackStore.instance = new StatsFeaturePackStore();
    }
    return StatsFeaturePackStore.instance;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw createStatsFeaturePackStoreError('STATS_FEATURE_PACK_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async pruneBefore(cutoffDateStr) {
    const normalizedDateStr = normalizeDailySummaryDateStr(cutoffDateStr);
    if (!normalizedDateStr) {
      throw createStatsFeaturePackStoreError('STATS_FEATURE_PACK_PRUNE_CUTOFF_REQUIRED');
    }
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_FEATURE_PACK_DAILY, 'readwrite');
      const store = tx.objectStore(STORES.STATS_FEATURE_PACK_DAILY);
      const index = store.index('dateStr');
      const req = index.openCursor(IDBKeyRange.upperBound(normalizedDateStr, true));
      let removed = 0;
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_FEATURE_PACK_DAILY, 'readwrite');
      const store = tx.objectStore(STORES.STATS_FEATURE_PACK_DAILY);
      const req = store.clear();
      let settled = false;
      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const rejectOnce = (cause, fallbackCode) => {
        if (settled) return;
        settled = true;
        reject(cause || createStatsFeaturePackStoreError(fallbackCode));
      };
      req.onerror = () => rejectOnce(req.error, 'STATS_FEATURE_PACK_CLEAR_FAILED');
      tx.oncomplete = resolveOnce;
      tx.onerror = () => rejectOnce(tx.error, 'STATS_FEATURE_PACK_CLEAR_FAILED');
      tx.onabort = () => rejectOnce(tx.error, 'STATS_FEATURE_PACK_CLEAR_ABORTED');
    });
  }
}

export default StatsFeaturePackStore;
