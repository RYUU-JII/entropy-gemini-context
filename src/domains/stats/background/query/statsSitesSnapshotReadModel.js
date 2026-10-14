import { buildSitesGlobalExposureAverage } from './sitesGlobalExposureAverageReadModel.js';
import { buildSitesCompletedActivityDays } from './sitesCompletedActivityDays.js';
import { getLocalDateStr } from '../../../../lib/index.js';
import {
  SCORE_SETUP_RECOMMENDATION_POLICY,
  buildStatsDashboardPolicyFingerprint,
  buildStatsDashboardPolicyInput,
  buildStatusDomainCandidatePool,
} from '../../analysis/index.js';
import {
  projectStatsDay,
  projectStatsWindow,
} from '../../projection/index.js';
import {
  STATS_EXPOSURE_READ_SOURCE,
  STATS_READ_MODEL_BASIS,
  createStatsExposureReadModel,
  requireStatsFactsRuntimeEpoch,
  requireStatsFactsRuntimeRevision,
} from '../contracts/statsReadModelContracts.js';
import { createSitesSiteDetailRevision } from '../../contracts/sitesSiteDetailContracts.js';
import { INSIGHTS_MODES } from '../../../settings/config/insightsMode.js';
import {
  SITES_OVERVIEW_DAYS,
  WINDOW_TOP_DOMAIN_COUNT,
  buildRhythmDayProjection,
  buildScoreSetupReadModel,
  buildSiteDetails,
  createStatsPolicyContext,
  getRecentDateStrings,
  normalizeAnalysisStats,
  resolveCycleWindowQuery,
  resolveEffectiveResetHour,
  resolveRhythmDayRange,
  toNumber,
} from './statsAnalysisQueryShared.js';
import {
  SITES_SITE_INTEL_DETAIL_STRATEGY,
  SITES_SITE_INTEL_DETAIL_TIER,
  buildRuleSiteIntel,
} from './statsSiteIntelReadModel.js';
import { attachScoreSetupRecentTrajectoryToDomainCandidates } from './statsSiteIntelReadModelHelpers.js';
import {
  buildSitesProtectedExposureDetails,
  buildSitesRegistryReadModel,
} from './statsSitesRegistryReadModel.js';
import { readAnalysisStatsRange } from './statsAnalysisStatsRange.js';
import { resolveSitesRecordingPolicy } from '../../../settings/config/dataCollectionPolicy.js';
import { resolveRecordingProjectionDomains } from './statsRecordingScope.js';

export const SITES_SNAPSHOT_CACHE_TTL_MS = 15_000;
export const SITES_SITE_INTEL_ANALYSIS_LIMIT = 48;

function buildSitesSiteIntelAnalysisPlan({
  entries = [],
  siteGoalMap = {},
  limit = SITES_SITE_INTEL_ANALYSIS_LIMIT,
} = {}) {
  const safeLimit = Math.max(0, Math.floor(toNumber(limit)));
  const rankedEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => typeof entry?.domain === 'string' && entry.domain && entry.recording.enabled)
    .map((entry) => ({
      entry,
      priority: entry.type === 'blocked'
        ? 0
        : entry.type === 'allowed'
          ? 1
          : toNumber(siteGoalMap?.[entry.domain]) > 0 ? 2 : 3,
      observedMs: toNumber(entry?.usage?.observedMs),
    }))
    .sort((left, right) => {
      const priorityDiff = left.priority - right.priority;
      if (priorityDiff !== 0) return priorityDiff;
      const observedDiff = right.observedMs - left.observedMs;
      if (observedDiff !== 0) return observedDiff;
      return left.entry.domain.localeCompare(right.entry.domain);
    });
  const analysisDomains = rankedEntries.slice(0, safeLimit).map(({ entry }) => entry.domain);
  return {
    analysisDomains,
    registryEntryCount: entries.length,
    deferredAnalysisCount: Math.max(0, rankedEntries.length - analysisDomains.length),
    analysisLimit: safeLimit,
  };
}

function buildProtectedExposureSeries({
  statsRange,
  dates = [],
  dayProjections = {},
  blockedTargets = [],
  allowedTargets = [],
  trackingExcludedUrls = [],
} = {}) {
  return (Array.isArray(dates) ? dates : []).map((dateStr) => {
    const projection = dayProjections?.[dateStr];
    const activeMs = buildSitesProtectedExposureDetails({
      statsRange,
      range: { startDateStr: dateStr, endDateStr: dateStr },
      blockedTargets,
      allowedTargets,
      trackingExcludedUrls,
    }).totalExposure;

    return {
      dateStr,
      activeMs,
      observed: projection?.hasStatsDay === true,
    };
  });
}

export function buildSitesSnapshotCycleCacheKey(cycleState, now = Date.now()) {
  const currentCycleStart = Number(cycleState?.currentCycleStart);
  const resetHour = resolveEffectiveResetHour(cycleState);
  const rhythmDayRange = resolveRhythmDayRange({ now, resetHour });
  return [
    Number.isFinite(currentCycleStart) ? currentCycleStart : 'none',
    resetHour,
    rhythmDayRange?.startDateStr || 'none',
    rhythmDayRange?.startHour ?? 'none',
    rhythmDayRange?.endDateStr || 'none',
    rhythmDayRange?.endHour ?? 'none',
    getLocalDateStr(now),
  ].join('|');
}

export function buildSitesSiteDetailRevision({
  statsRange,
  policyFingerprint,
  insightsMode,
  cycleState,
  now = Date.now(),
} = {}) {
  const canonicalStatsRange = readAnalysisStatsRange(statsRange);
  return createSitesSiteDetailRevision({
    factsRuntimeEpoch: requireStatsFactsRuntimeEpoch(canonicalStatsRange),
    factsRuntimeRevision: requireStatsFactsRuntimeRevision(canonicalStatsRange),
    policyFingerprint,
    insightsMode,
    cycleFingerprint: buildSitesSnapshotCycleCacheKey(cycleState, now),
  });
}

export function createSitesSnapshotCacheKey({
  daysBack,
  policyFingerprint,
  insightsMode,
  cycleState,
  now = Date.now(),
} = {}) {
  return [
    `days:${daysBack}`,
    `policy:${policyFingerprint}`,
    `insights:${insightsMode}`,
    `cycle:${buildSitesSnapshotCycleCacheKey(cycleState, now)}`,
  ].join('::');
}

export function readSitesSnapshotCache({
  cacheEntry,
  cacheKey,
  statsRange,
  now = Date.now(),
  cacheTtlMs = SITES_SNAPSHOT_CACHE_TTL_MS,
} = {}) {
  if (!cacheEntry || cacheTtlMs <= 0) return null;
  if (cacheEntry.cacheKey !== cacheKey) return null;
  if (cacheEntry.statsRange !== statsRange) return null;
  if (now - cacheEntry.cachedAtEpochMs > cacheTtlMs) return null;
  return cacheEntry.snapshot;
}

export function resolveSitesSnapshotCacheTtlMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return SITES_SNAPSHOT_CACHE_TTL_MS;
  return Math.floor(numeric);
}

function buildEmptySitesSnapshot(
  policyFingerprint,
  siteDetailRevision,
  now = Date.now(),
  insightsMode = INSIGHTS_MODES.OFF,
  globalExposureAverage,
) {
  return {
    policyBasis: 'current',
    policyFingerprint,
    siteDetailRevision,
    computedAtEpochMs: now,
    insightsMode,
    available: false,
    weeklyDates: [],
    window: {
      range: null,
      totals: null,
      domainTotals: [],
      siteDetails: {},
    },
    totalExposure: 0,
    globalExposureSeries: [],
    globalExposureAverage,
    siteDetails: {},
    observedSiteDetails: {},
    rawSiteDetails: {},
    siteRegistry: {
      usageBasis: 'activity-day-observed',
      protectionBasis: 'activity-day-charged',
      observedSiteDetails: {},
      entries: [],
      byDomain: {},
    },
    siteIntels: {},
    domainCandidates: [],
    scoreSetup: null,
    siteIntelBuildState: {
      pending: false,
      progress: 0,
      total: 0,
      fullDetailCount: 0,
      analysisDetailCount: 0,
      deferredAnalysisCount: 0,
      registryEntryCount: 0,
      analysisLimit: SITES_SITE_INTEL_ANALYSIS_LIMIT,
      strategy: SITES_SITE_INTEL_DETAIL_STRATEGY,
    },
  };
}

export function buildSitesSnapshot({
  statsRange,
  cycleSnapshot,
  cycleState = null,
  policyInput = {},
  insightsMode = INSIGHTS_MODES.OFF,
  now = Date.now(),
} = {}) {
  const dashboardPolicy = buildStatsDashboardPolicyInput(policyInput);
  const recording = resolveSitesRecordingPolicy(dashboardPolicy);
  const stats = normalizeAnalysisStats(statsRange);
  const recordingFilter = { domains: resolveRecordingProjectionDomains(stats, dashboardPolicy) };
  const policyContext = createStatsPolicyContext(dashboardPolicy);
  const policyFingerprint = buildStatsDashboardPolicyFingerprint(dashboardPolicy);
  const siteDetailRevision = buildSitesSiteDetailRevision({
    statsRange,
    policyFingerprint,
    insightsMode,
    cycleState,
    now,
  });
  const completedDays = buildSitesCompletedActivityDays({ stats, policyContext, cycleState, now, filter: recordingFilter });
  const globalExposureAverage = buildSitesGlobalExposureAverage({
    stats, policyContext, blockedTargets: dashboardPolicy.blockedUrls, cycleState, now,
    allowedTargets: dashboardPolicy.allowedUrls, trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
    completedDays,
  });
  if (recording.effectiveScope === 'off') {
    globalExposureAverage.averageMs = null;
    globalExposureAverage.observedDayCount = 0;
    globalExposureAverage.status = 'disabled';
  }
  const emptySnapshot = buildEmptySitesSnapshot(
    policyFingerprint,
    siteDetailRevision,
    now,
    insightsMode,
    globalExposureAverage,
  );
  const weeklyDates = getRecentDateStrings(SITES_OVERVIEW_DAYS, now);
  const scoreSetupDates = getRecentDateStrings(
    SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS + 1,
    now,
  ).slice(0, -1);
  const windowQuery = resolveCycleWindowQuery(cycleSnapshot);

  const windowProjection = windowQuery
    ? projectStatsWindow({
        statsRange: stats,
        policyContext,
        filter: recordingFilter,
        ...windowQuery,
      })
    : null;
  const windowSiteDetails = buildSiteDetails(windowProjection?.domainTotals);
  const todayDateStr = getLocalDateStr(now);
  const registryDayProjection = buildRhythmDayProjection({
    stats,
    policyContext,
    filter: recordingFilter,
    cycleState,
    now,
  });
  const rawSiteDetails = buildSiteDetails(registryDayProjection?.domainTotals);
  const blockedTargets = dashboardPolicy.blockedUrls;
  const allowedTargets = dashboardPolicy.allowedUrls;
  const blockedSet = new Set(blockedTargets);
  const allowedSet = new Set(allowedTargets);
  const protectedExposureDetails = !recording.globalCapAvailable
    ? { siteDetails: {}, totalExposure: 0 }
    : buildSitesProtectedExposureDetails({
    statsRange: stats,
    range: registryDayProjection.range,
    blockedTargets,
    allowedTargets,
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
  });
  const siteDetails = protectedExposureDetails.siteDetails;
  const totalExposure = protectedExposureDetails.totalExposure;
  const siteExposureReadModel = createStatsExposureReadModel({
    basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
    source: STATS_EXPOSURE_READ_SOURCE.REGISTRY_ACTIVITY_DAY,
    siteDetails,
    totalExposure,
    generatedAtEpochMs: now,
  });
  const siteGoalMap = dashboardPolicy.siteGoals;
  const requiredDayProjections = Object.fromEntries(
    Array.from(new Set([...weeklyDates, ...scoreSetupDates])).map((dateStr) => [
      dateStr,
      {
        ...projectStatsDay({
          statsRange: stats,
          dateStr,
          policyContext,
          filter: {
            ...recordingFilter,
            includeTopDomains: true,
            topN: WINDOW_TOP_DOMAIN_COUNT,
          },
        }),
        hasStatsDay: Boolean(stats?.dates?.[dateStr]),
      },
    ]),
  );
  const weeklyDayProjections = Object.fromEntries(
    weeklyDates.map((dateStr) => [dateStr, requiredDayProjections[dateStr]]),
  );
  const scoreSetupDayProjections = Object.fromEntries(
    scoreSetupDates.map((dateStr) => [dateStr, requiredDayProjections[dateStr]]),
  );
  const globalExposureSeries = buildProtectedExposureSeries({
    statsRange: stats,
    dates: weeklyDates,
    dayProjections: weeklyDayProjections,
    blockedTargets,
    allowedTargets,
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
  });
  const siteRegistry = buildSitesRegistryReadModel({
    recordingPolicy: dashboardPolicy,
    completedDays,
    rawSiteDetails,
    protectedSiteDetails: siteDetails,
    blockedTargets,
    allowedTargets,
    siteGoals: siteGoalMap,
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
  });
  const intelAnalysisPlan = buildSitesSiteIntelAnalysisPlan({
    entries: siteRegistry.entries,
    siteGoalMap,
  });
  const intelDomains = intelAnalysisPlan.analysisDomains;
  const siteIntels = Object.fromEntries(
    intelDomains.map((domain) => [
      domain,
      buildRuleSiteIntel(domain, {
        siteDetails: siteRegistry.observedSiteDetails,
        siteGoalMap,
        blockedSet,
        allowedSet,
        insightsMode,
        weeklyDates,
        weeklyDayProjections,
        currentDateStr: todayDateStr,
        detailTier: SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS,
        dataCollectionMode: dashboardPolicy.dataCollectionMode,
        todayProjectionOverride: {
          ...registryDayProjection,
          hasStatsDay: requiredDayProjections[todayDateStr]?.hasStatsDay === true,
          horizon: 'current_activity_day_so_far',
        },
        now,
      }),
    ]),
  );
  const scoreSetupDomainInsights = siteIntels;
  const domainCandidates = attachScoreSetupRecentTrajectoryToDomainCandidates({
    domainCandidates: buildStatusDomainCandidatePool({
      blockedUrls: blockedTargets,
      allowedUrls: allowedTargets,
      siteDetails: siteRegistry.observedSiteDetails,
      todaySiteDetails: siteRegistry.observedSiteDetails,
      domainInsights: scoreSetupDomainInsights,
      globalGoal: dashboardPolicy.globalGoal,
      siteGoals: siteGoalMap,
      trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
    }),
    dates: scoreSetupDates,
    dayProjections: scoreSetupDayProjections,
    currentDateStr: todayDateStr,
  });
  const scoreSetup = buildScoreSetupReadModel({
    coverage: null,
    domainCandidates,
    siteGoals: siteGoalMap,
  });

  return {
    ...emptySnapshot,
    recording,
    policyBasis: 'current',
    policyFingerprint,
    siteDetailRevision,
    computedAtEpochMs: now,
    insightsMode,
    available: true,
    weeklyDates,
    window: {
      range: windowProjection?.range || windowQuery,
      totals: windowProjection?.totals || null,
      domainTotals: Array.isArray(windowProjection?.domainTotals) ? windowProjection.domainTotals : [],
      siteDetails: windowSiteDetails,
    },
    registryDay: {
      dateStr: todayDateStr,
      basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
      range: registryDayProjection?.range || null,
      totals: registryDayProjection?.totals || null,
      domainTotals: Array.isArray(registryDayProjection?.domainTotals) ? registryDayProjection.domainTotals : [],
      siteDetails,
      observedSiteDetails: siteRegistry.observedSiteDetails,
      rawSiteDetails,
      hourlyBuckets: Array.isArray(registryDayProjection?.hourlyBuckets) ? registryDayProjection.hourlyBuckets : [],
    },
    siteExposureReadModel,
    siteDetailsBasis: siteExposureReadModel.basis,
    totalExposureBasis: siteExposureReadModel.basis,
    totalExposure,
    globalExposureSeries,
    globalExposureAverage,
    siteDetails,
    observedSiteDetails: siteRegistry.observedSiteDetails,
    rawSiteDetails,
    siteRegistry,
    siteIntels,
    domainCandidates,
    scoreSetup,
    siteIntelBuildState: {
      pending: false,
      progress: intelDomains.length,
      total: intelAnalysisPlan.registryEntryCount,
      fullDetailCount: 0,
      analysisDetailCount: intelDomains.length,
      deferredAnalysisCount: intelAnalysisPlan.deferredAnalysisCount,
      registryEntryCount: intelAnalysisPlan.registryEntryCount,
      analysisLimit: intelAnalysisPlan.analysisLimit,
      strategy: SITES_SITE_INTEL_DETAIL_STRATEGY,
    },
  };
}
