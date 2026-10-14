import {
  buildStatsDashboardPolicyFingerprint,
} from '../../analysis/index.js';
import { INSIGHTS_MODES, normalizeInsightsMode } from '../../../settings/config/insightsMode.js';
import {
  requireSitesSiteDetailDomain,
  requireSitesSiteDetailQueryResult,
  requireSitesSiteDetailRevision,
} from '../../contracts/sitesSiteDetailContracts.js';
import { SITE_PULL_BASELINE_READ_DAYS } from './statsAnalysisQueryShared.js';
import { resolveStatsDaysBack } from './statsFactsRepositoryReadUtils.js';
import { buildSitesSiteDetailRevision } from './statsSitesSnapshotReadModel.js';
import { getStatsSitesInterventionEvidenceBaselineRange } from './statsSitesEvidenceQuery.js';
import { buildSitesSiteDetail } from './statsSitesSiteDetailReadModel.js';
import { requireStatsFactsRuntimeRevision } from '../contracts/statsReadModelContracts.js';
import { resolveDomainUsageRecording } from '../../../settings/config/dataCollectionPolicy.js';
import { requireCurrentSitesPolicy, createSitesPolicyChangedError } from './sitesCurrentPolicy.js';

export const SITES_SITE_DETAIL_CACHE_TTL_MS = 5 * 60_000;
export const SITES_SITE_DETAIL_CACHE_MAX_ENTRIES = 12;
export const SITES_SITE_DETAIL_EVIDENCE_CACHE_TTL_MS = 5_000;
const SITES_SITE_DETAIL_EVIDENCE_CACHE_MAX_ENTRIES = 2;

function requireSitesSiteDetailOwner(owner, code) {
  if (typeof owner !== 'function') {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return owner;
}

function readCachedDetail({ cache, cacheKey, factsRevision, now, cacheTtlMs }) {
  if (cacheTtlMs <= 0) return null;
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (entry.factsRevision !== factsRevision || now - entry.cachedAtEpochMs >= cacheTtlMs) {
    cache.delete(cacheKey);
    return null;
  }
  cache.delete(cacheKey);
  cache.set(cacheKey, entry);
  return entry.snapshot;
}

function writeCachedDetail({ cache, cacheKey, factsRevision, snapshot, now, maxEntries }) {
  cache.delete(cacheKey);
  cache.set(cacheKey, {
    factsRevision,
    snapshot,
    cachedAtEpochMs: now,
  });
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function createInterventionEvidenceCacheKey(now) {
  const range = getStatsSitesInterventionEvidenceBaselineRange(now);
  return `${range.startDateStr}::${range.endDateStr}`;
}

function readCachedInterventionEvidence({ cache, cacheKey, now, cacheTtlMs }) {
  if (cacheTtlMs <= 0) return null;
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  const ageMs = now - entry.cachedAtEpochMs;
  if (ageMs < 0 || ageMs >= cacheTtlMs) {
    cache.delete(cacheKey);
    return null;
  }
  cache.delete(cacheKey);
  cache.set(cacheKey, entry);
  return entry.rows;
}

function writeCachedInterventionEvidence({ cache, cacheKey, rows, now }) {
  cache.delete(cacheKey);
  cache.set(cacheKey, { rows, cachedAtEpochMs: now });
  while (cache.size > SITES_SITE_DETAIL_EVIDENCE_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function requireInterventionEvidenceRows(rows) {
  if (!Array.isArray(rows)) {
    const error = new Error('STATS_SITES_SITE_DETAIL_INTERVENTION_EFFECTS_REQUIRED');
    error.code = 'STATS_SITES_SITE_DETAIL_INTERVENTION_EFFECTS_REQUIRED';
    throw error;
  }
  return rows;
}

export function createSitesSiteDetailQueryService({
  getStatsFactsRange,
  readCycleState,
  readSettingsSnapshot,
  readSitePullInterventionEvidenceRange,
  normalizePolicyOverride,
  maxDaysStored,
  cacheTtlMs = SITES_SITE_DETAIL_CACHE_TTL_MS,
  maxCacheEntries = SITES_SITE_DETAIL_CACHE_MAX_ENTRIES,
  evidenceCacheTtlMs = SITES_SITE_DETAIL_EVIDENCE_CACHE_TTL_MS,
} = {}) {
  const readStatsFactsRange = requireSitesSiteDetailOwner(
    getStatsFactsRange,
    'STATS_SITES_SITE_DETAIL_FACTS_OWNER_REQUIRED',
  );
  const readSitesCycleState = requireSitesSiteDetailOwner(
    readCycleState,
    'STATS_SITES_SITE_DETAIL_CYCLE_OWNER_REQUIRED',
  );
  const readRulesSettingsSnapshot = requireSitesSiteDetailOwner(
    readSettingsSnapshot,
    'STATS_SITES_SITE_DETAIL_SETTINGS_OWNER_REQUIRED',
  );
  const readSitesSitePullInterventionEvidenceRange = requireSitesSiteDetailOwner(
    readSitePullInterventionEvidenceRange,
    'STATS_SITES_SITE_DETAIL_INTERVENTION_EVIDENCE_OWNER_REQUIRED',
  );
  requireSitesSiteDetailOwner(
    normalizePolicyOverride,
    'STATS_SITES_SITE_DETAIL_POLICY_NORMALIZER_REQUIRED',
  );
  const cache = new Map();
  const inFlight = new Map();
  const interventionEvidenceCache = new Map();
  const interventionEvidenceInFlight = new Map();
  const numericCacheTtlMs = Number(cacheTtlMs);
  const numericMaxCacheEntries = Number(maxCacheEntries);
  const numericEvidenceCacheTtlMs = Number(evidenceCacheTtlMs);
  const resolvedCacheTtlMs = Number.isFinite(numericCacheTtlMs)
    ? Math.max(0, Math.floor(numericCacheTtlMs))
    : SITES_SITE_DETAIL_CACHE_TTL_MS;
  const resolvedMaxCacheEntries = Number.isFinite(numericMaxCacheEntries)
    ? Math.max(1, Math.floor(numericMaxCacheEntries))
    : SITES_SITE_DETAIL_CACHE_MAX_ENTRIES;
  const resolvedEvidenceCacheTtlMs = Number.isFinite(numericEvidenceCacheTtlMs)
    ? Math.max(0, Math.floor(numericEvidenceCacheTtlMs))
    : SITES_SITE_DETAIL_EVIDENCE_CACHE_TTL_MS;

  async function readSharedInterventionEvidenceRange(now) {
    const evidenceCacheKey = createInterventionEvidenceCacheKey(now);
    const cachedRows = readCachedInterventionEvidence({
      cache: interventionEvidenceCache,
      cacheKey: evidenceCacheKey,
      now,
      cacheTtlMs: resolvedEvidenceCacheTtlMs,
    });
    if (cachedRows) return cachedRows;

    const pending = interventionEvidenceInFlight.get(evidenceCacheKey);
    if (pending) return pending;

    const promise = (async () => {
      const rows = requireInterventionEvidenceRows(
        await readSitesSitePullInterventionEvidenceRange(now),
      );
      if (resolvedEvidenceCacheTtlMs > 0) {
        writeCachedInterventionEvidence({
          cache: interventionEvidenceCache,
          cacheKey: evidenceCacheKey,
          rows,
          now,
        });
      }
      return rows;
    })();
    interventionEvidenceInFlight.set(evidenceCacheKey, promise);
    try {
      return await promise;
    } finally {
      if (interventionEvidenceInFlight.get(evidenceCacheKey) === promise) {
        interventionEvidenceInFlight.delete(evidenceCacheKey);
      }
    }
  }

  async function getSitesSiteDetail({
    domain,
    policyInput = null,
    siteDetailRevision: requestedSiteDetailRevision,
  } = {}) {
    const requestedDomain = requireSitesSiteDetailDomain(domain);
    requireSitesSiteDetailRevision(requestedSiteDetailRevision);
    const now = Date.now();
    const settingsSnapshot = await readRulesSettingsSnapshot();
    const dashboardPolicy = requireCurrentSitesPolicy(policyInput, settingsSnapshot);
    const policyFingerprint = buildStatsDashboardPolicyFingerprint(dashboardPolicy);
    const insightsMode = normalizeInsightsMode(settingsSnapshot?.insightsMode, INSIGHTS_MODES.OFF);
    if (!resolveDomainUsageRecording(requestedDomain, dashboardPolicy).enabled) {
      if (!requestedSiteDetailRevision.includes(`::policy:${policyFingerprint}::insights:`)) {
        throw createSitesPolicyChangedError(policyFingerprint);
      }
      return requireSitesSiteDetailQueryResult({
        siteDetailRevision: requestedSiteDetailRevision,
        sitesSiteDetail: buildSitesSiteDetail({ domain: requestedDomain, policyInput: dashboardPolicy, insightsMode, now }),
      });
    }
    const daysBack = resolveStatsDaysBack(SITE_PULL_BASELINE_READ_DAYS, {
      fallbackDays: SITE_PULL_BASELINE_READ_DAYS,
      maxDays: maxDaysStored,
    });
    if (daysBack !== SITE_PULL_BASELINE_READ_DAYS) {
      const error = new Error('STATS_SITES_SITE_DETAIL_BASELINE_READ_SPAN_UNAVAILABLE');
      error.code = 'STATS_SITES_SITE_DETAIL_BASELINE_READ_SPAN_UNAVAILABLE';
      throw error;
    }
    const [statsRange, cycleState] = await Promise.all([
      readStatsFactsRange({ daysBack }),
      readSitesCycleState(now),
    ]);
    const factsRevision = requireStatsFactsRuntimeRevision(statsRange);
    const siteDetailRevision = buildSitesSiteDetailRevision({
      statsRange,
      policyFingerprint,
      insightsMode,
      cycleState,
      now,
    });
    const cacheKey = `${siteDetailRevision}::domain:${requestedDomain}`;
    const cachedSnapshot = readCachedDetail({
      cache,
      cacheKey,
      factsRevision,
      now,
      cacheTtlMs: resolvedCacheTtlMs,
    });
    if (cachedSnapshot) return cachedSnapshot;

    const pendingEntry = inFlight.get(cacheKey);
    if (pendingEntry?.factsRevision === factsRevision) return pendingEntry.promise;

    const promise = (async () => {
      const interventionEffectsRange = await readSharedInterventionEvidenceRange(now);
      const snapshot = requireSitesSiteDetailQueryResult({
        siteDetailRevision,
        sitesSiteDetail: buildSitesSiteDetail({
          domain: requestedDomain,
          statsRange,
          cycleState,
          policyInput: dashboardPolicy,
          insightsMode,
          interventionEffectsRange,
          now,
        }),
      });
      if (resolvedCacheTtlMs > 0) {
        writeCachedDetail({
          cache,
          cacheKey,
          factsRevision,
          snapshot,
          now,
          maxEntries: resolvedMaxCacheEntries,
        });
      }
      return snapshot;
    })();
    inFlight.set(cacheKey, { factsRevision, promise });
    try {
      return await promise;
    } finally {
      if (inFlight.get(cacheKey)?.promise === promise) inFlight.delete(cacheKey);
    }
  }

  return { getSitesSiteDetail };
}
