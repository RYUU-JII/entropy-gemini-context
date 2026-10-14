import { buildStatsDashboardPolicyFingerprint, buildStatsDashboardPolicyInput } from '../../analysis/index.js';
import { INSIGHTS_MODES, normalizeInsightsMode } from '../../../settings/config/insightsMode.js';
import { resolveStatsDaysBack } from './statsFactsRepositoryReadUtils.js';
import {
  SITES_OVERVIEW_DAYS,
  STATUS_SNAPSHOT_EVIDENCE_DAYS,
  buildCycleProjection,
  cloneCycleState,
  normalizePolicyOverride,
  readOptionalStatsCycleState,
  readRequiredStatsSettingsSnapshot,
  resolveProjectionDaysBack,
  resolveReadModelDaysBack,
} from './statsAnalysisQueryShared.js';
import { buildStatusSnapshot } from './statsStatusSnapshotReadModel.js';
import {
  SITES_SNAPSHOT_CACHE_TTL_MS,
  buildSitesSnapshot,
  createSitesSnapshotCacheKey,
  readSitesSnapshotCache,
  resolveSitesSnapshotCacheTtlMs,
} from './statsSitesSnapshotReadModel.js';
import { readStatsSitesInterventionEvidenceRange } from './statsSitesEvidenceQuery.js';
import { STATS_RANGE_MAX_DAYS } from '../../contracts/statsContracts.js';
import { createSitesSiteDetailQueryService } from './statsSitesSiteDetailQueryService.js';
import { prepareAnalysisStatsRange } from './statsAnalysisStatsRange.js';
import { requireCurrentSitesPolicy } from './sitesCurrentPolicy.js';

export function createStatsAnalysisQueryService({
  getStatsFactsRange,
  getInterventionEffectsRange,
  getCycleState,
  getSettingsSnapshot,
  maxDaysStored = STATS_RANGE_MAX_DAYS,
  sitesSnapshotCacheTtlMs = SITES_SNAPSHOT_CACHE_TTL_MS,
} = {}) {
  if (typeof getStatsFactsRange !== 'function') {
    throw new Error('STATS_ANALYSIS_QUERY_FACTS_RANGE_REQUIRED');
  }
  if (typeof getInterventionEffectsRange !== 'function') {
    throw new Error('STATS_ANALYSIS_QUERY_INTERVENTION_EFFECTS_REQUIRED');
  }
  if (typeof getCycleState !== 'function') {
    throw new Error('STATS_ANALYSIS_QUERY_CYCLE_REQUIRED');
  }
  if (typeof getSettingsSnapshot !== 'function') {
    throw new Error('STATS_ANALYSIS_QUERY_SETTINGS_REQUIRED');
  }

  const readCycleState = (now = Date.now()) => readOptionalStatsCycleState(getCycleState, {
    now,
    code: 'STATS_ANALYSIS_QUERY_CYCLE_STATE_INVALID',
  });
  const sitesSnapshotCacheTtl = resolveSitesSnapshotCacheTtlMs(sitesSnapshotCacheTtlMs);
  let sitesSnapshotCacheEntry = null;
  const readSettingsSnapshot = () => readRequiredStatsSettingsSnapshot(
    getSettingsSnapshot,
    'STATS_ANALYSIS_QUERY_SETTINGS_SNAPSHOT_REQUIRED',
  );
  const readSitePullInterventionEvidenceRange = (now = Date.now()) => (
    readStatsSitesInterventionEvidenceRange({
      getInterventionEffectsRange,
      now,
    })
  );
  const sitesSiteDetailQueryService = createSitesSiteDetailQueryService({
    getStatsFactsRange,
    readCycleState,
    readSettingsSnapshot,
    readSitePullInterventionEvidenceRange,
    normalizePolicyOverride,
    maxDaysStored,
  });

  async function getAnalysisBootstrapSnapshot({
    daysBack = maxDaysStored,
    policyInput = null,
    includeSitesSnapshot = true,
  } = {}) {
    const requestedSpan = resolveStatsDaysBack(daysBack, {
      fallbackDays: maxDaysStored,
      maxDays: maxDaysStored,
    });
    const statusEvidenceSpan = resolveStatsDaysBack(STATUS_SNAPSHOT_EVIDENCE_DAYS, {
      fallbackDays: STATUS_SNAPSHOT_EVIDENCE_DAYS,
      maxDays: maxDaysStored,
    });
    const span = Math.max(requestedSpan, statusEvidenceSpan);
    const now = Date.now();
    const shouldIncludeSitesSnapshot = includeSitesSnapshot !== false;
    const [statsRange, cycleState, settingsSnapshot] = await Promise.all([
      getStatsFactsRange({ daysBack: span }),
      readCycleState(now),
      readSettingsSnapshot(),
    ]);
    const insightsMode = normalizeInsightsMode(settingsSnapshot?.insightsMode, INSIGHTS_MODES.OFF);
    const resolvedPolicyInput = normalizePolicyOverride(policyInput, settingsSnapshot);
    const analysisStatsRange = prepareAnalysisStatsRange(statsRange);
    const cycleSnapshot = buildCycleProjection({
      statsRange: analysisStatsRange,
      cycleState,
      settingsSnapshot,
      policyInput: resolvedPolicyInput,
      now,
    });

    const snapshot = {
      cycleState: cloneCycleState(cycleState),
      cycleSnapshot,
      statusSnapshot: buildStatusSnapshot({
        statsRange: analysisStatsRange,
        cycleSnapshot,
        cycleState,
        policyInput: resolvedPolicyInput,
        insightsMode,
        now,
      }),
    };

    if (shouldIncludeSitesSnapshot) {
      snapshot.sitesSnapshot = buildSitesSnapshot({
        statsRange: analysisStatsRange,
        cycleSnapshot,
        cycleState,
        policyInput: requireCurrentSitesPolicy(policyInput, settingsSnapshot),
        insightsMode,
        now,
      });
    }

    return snapshot;
  }

  async function getCycleProjection({ policyInput = null } = {}) {
    const now = Date.now();
    const cycleState = await readCycleState(now);
    const daysBack = resolveProjectionDaysBack(cycleState, maxDaysStored, now);
    const [statsRange, settingsSnapshot] = await Promise.all([
      getStatsFactsRange({ daysBack }),
      readSettingsSnapshot(),
    ]);
    const analysisStatsRange = prepareAnalysisStatsRange(statsRange);

    return {
      cycleState: cloneCycleState(cycleState),
      cycleSnapshot: buildCycleProjection({
        statsRange: analysisStatsRange,
        cycleState,
        settingsSnapshot,
        policyInput,
        now,
      }),
    };
  }

  async function getStatusSnapshot({ policyInput = null } = {}) {
    const now = Date.now();
    const cycleState = await readCycleState(now);
    const daysBack = resolveReadModelDaysBack(
      cycleState,
      maxDaysStored,
      STATUS_SNAPSHOT_EVIDENCE_DAYS,
      now,
    );
    const [statsRange, settingsSnapshot] = await Promise.all([
      getStatsFactsRange({ daysBack }),
      readSettingsSnapshot(),
    ]);
    const insightsMode = normalizeInsightsMode(settingsSnapshot?.insightsMode, INSIGHTS_MODES.OFF);
    const resolvedPolicyInput = normalizePolicyOverride(policyInput, settingsSnapshot);
    const analysisStatsRange = prepareAnalysisStatsRange(statsRange);
    const cycleSnapshot = buildCycleProjection({
      statsRange: analysisStatsRange,
      cycleState,
      settingsSnapshot,
      policyInput: resolvedPolicyInput,
      now,
    });

    return {
      statusSnapshot: buildStatusSnapshot({
        statsRange: analysisStatsRange,
        cycleSnapshot,
        cycleState,
        policyInput: resolvedPolicyInput,
        insightsMode,
        now,
      }),
    };
  }

  async function getSitesSnapshot({ policyInput = null } = {}) {
    const now = Date.now();
    const cycleState = await readCycleState(now);
    const daysBack = resolveReadModelDaysBack(
      cycleState,
      maxDaysStored,
      SITES_OVERVIEW_DAYS + 2,
      now,
    );
    const [statsRange, settingsSnapshot] = await Promise.all([
      getStatsFactsRange({ daysBack }),
      readSettingsSnapshot(),
    ]);
    const insightsMode = normalizeInsightsMode(settingsSnapshot?.insightsMode, INSIGHTS_MODES.OFF);
    const resolvedPolicyInput = requireCurrentSitesPolicy(policyInput, settingsSnapshot);
    const dashboardPolicy = buildStatsDashboardPolicyInput(resolvedPolicyInput);
    const policyFingerprint = buildStatsDashboardPolicyFingerprint(dashboardPolicy);
    const cacheKey = createSitesSnapshotCacheKey({
      daysBack,
      policyFingerprint,
      insightsMode,
      cycleState,
      now,
    });
    const cachedSnapshot = readSitesSnapshotCache({
      cacheEntry: sitesSnapshotCacheEntry,
      cacheKey,
      statsRange,
      now,
      cacheTtlMs: sitesSnapshotCacheTtl,
    });
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const analysisStatsRange = prepareAnalysisStatsRange(statsRange);
    const cycleSnapshot = buildCycleProjection({
      statsRange: analysisStatsRange,
      cycleState,
      settingsSnapshot,
      policyInput: resolvedPolicyInput,
      now,
    });

    const snapshot = {
      sitesSnapshot: buildSitesSnapshot({
        statsRange: analysisStatsRange,
        cycleSnapshot,
        cycleState,
        policyInput: resolvedPolicyInput,
        insightsMode,
        now,
      }),
    };
    sitesSnapshotCacheEntry = {
      cacheKey,
      statsRange,
      cachedAtEpochMs: now,
      snapshot,
    };
    return snapshot;
  }

  return {
    getAnalysisBootstrapSnapshot,
    getCycleProjection,
    getStatusSnapshot,
    getSitesSnapshot,
    getSitesSiteDetail: sitesSiteDetailQueryService.getSitesSiteDetail,
  };
}
