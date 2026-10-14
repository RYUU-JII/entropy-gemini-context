import {
  buildStatsDashboardPolicyFingerprint,
  buildStatsDashboardPolicyInput,
} from '../../analysis/index.js';
import { projectStatsDay } from '../../projection/index.js';
import { INSIGHTS_MODES } from '../../../settings/config/insightsMode.js';
import { resolveDomainUsageRecording, resolveTimeCapAvailability } from '../../../settings/config/dataCollectionPolicy.js';
import { getLocalDateStr } from '../../../../lib/time.js';
import { requireSitesSiteDetailDomain } from '../../contracts/sitesSiteDetailContracts.js';
import { requireFeedHistoryReceipts } from '../../contracts/feedContentFlowReceipt.js';
import { requireInterventionHistoryReceipts } from '../../contracts/interventionHistoryReceipt.js';
import {
  SITES_OVERVIEW_DAYS,
  SITE_PULL_BASELINE_DAYS,
  SITE_PULL_BASELINE_READ_DAYS,
  WINDOW_TOP_DOMAIN_COUNT,
  buildRhythmDayProjection,
  buildSiteDetails,
  createStatsPolicyContext,
  getRecentDateStrings,
  normalizeAnalysisStats,
  normalizeDomainKey,
} from './statsAnalysisQueryShared.js';
import {
  SITES_SITE_INTEL_DETAIL_TIER,
  buildRuleSiteIntel,
} from './statsSiteIntelReadModel.js';
import { buildInterventionEffectIndex } from './statsSiteInterventionEffects.js';
import { buildTransitionEdgeIndex } from './statsSiteTransitionEdges.js';
import {
  buildSitesProtectedExposureDetails,
  buildSitesPolicyOnlyRegistryEntry,
  buildSitesRegistryReadModel,
} from './statsSitesRegistryReadModel.js';
import { resolveSitesRegistryDomain, resolveSitesSelectionDomain } from '../../shared/sitesDomainScope.js';
import { buildSitesCompletedActivityDays } from './sitesCompletedActivityDays.js';
import { requireSiteGoalContext } from '../../insights/contracts/siteGoalContext.js';

function createSitesSiteDetailError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireEvidenceRange(value, errorCode) {
  if (!Array.isArray(value)) throw createSitesSiteDetailError(errorCode);
  return value;
}

export function resolveSitesSiteDetailProjectionDomains({
  statsRange,
  domain,
  blockedTargets,
  allowedTargets,
} = {}) {
  if (!Array.isArray(blockedTargets) || !Array.isArray(allowedTargets)) {
    throw createSitesSiteDetailError('STATS_SITES_SITE_DETAIL_MANAGED_TARGETS_REQUIRED');
  }
  const canonicalDomain = resolveSitesRegistryDomain(requireSitesSiteDetailDomain(domain), {
    blockedTargets,
    allowedTargets,
  });
  const matchingDomains = new Set([canonicalDomain]);
  const dates = statsRange?.dates && typeof statsRange.dates === 'object'
    ? Object.values(statsRange.dates)
    : [];
  dates.forEach((day) => {
    const domains = day?.domains && typeof day.domains === 'object' ? Object.keys(day.domains) : [];
    domains.forEach((candidate) => {
      const normalizedCandidate = normalizeDomainKey(candidate);
      if (normalizedCandidate && resolveSitesRegistryDomain(normalizedCandidate, {
        blockedTargets,
        allowedTargets,
      }) === canonicalDomain) {
        matchingDomains.add(normalizedCandidate);
      }
    });
  });
  return [
    canonicalDomain,
    ...Array.from(matchingDomains)
      .filter((candidate) => candidate !== canonicalDomain)
      .sort((left, right) => left.localeCompare(right)),
  ];
}

function scopeSitesSiteDetailStatsRange(statsRange, projectionDomains) {
  const domainSet = new Set(Array.isArray(projectionDomains) ? projectionDomains : []);
  const sourceDates = statsRange?.dates && typeof statsRange.dates === 'object'
    ? statsRange.dates
    : {};
  const dates = Object.fromEntries(Object.entries(sourceDates).map(([dateStr, day]) => {
    const sourceDomains = day?.domains && typeof day.domains === 'object' ? day.domains : {};
    const scopedDay = {
      ...day,
      transitionEdges: {},
      domains: Object.fromEntries(
        Object.entries(sourceDomains)
          .filter(([candidate]) => domainSet.has(normalizeDomainKey(candidate))),
      ),
    };
    // Provenance belongs to the same source domains as its facts. Retaining an
    // unrelated receipt would make the scoped range fail its integrity check.
    // Omit empty optional receipt fields; present empty feed receipts are invalid.
    if (Object.hasOwn(scopedDay, 'feedHistoryReceipts')) {
      const receipts = requireFeedHistoryReceipts(scopedDay.feedHistoryReceipts)
        .filter((receipt) => domainSet.has(receipt.hostname));
      if (receipts.length) scopedDay.feedHistoryReceipts = receipts;
      else delete scopedDay.feedHistoryReceipts;
    }
    if (Object.hasOwn(scopedDay, 'interventionHistoryReceipts')) {
      const receipts = requireInterventionHistoryReceipts(scopedDay.interventionHistoryReceipts)
        .filter((receipt) => domainSet.has(receipt.hostname));
      if (receipts.length) scopedDay.interventionHistoryReceipts = receipts;
      else delete scopedDay.interventionHistoryReceipts;
    }
    return [dateStr, scopedDay];
  }));
  return {
    ...(statsRange && typeof statsRange === 'object' ? statsRange : {}),
    dates,
  };
}

function buildDayProjectionMap({ dates, stats, policyContext, domains }) {
  return Object.fromEntries((Array.isArray(dates) ? dates : []).map((dateStr) => [
    dateStr,
    {
      ...projectStatsDay({
        statsRange: stats,
        dateStr,
        policyContext,
        filter: {
          domains,
          includeTopDomains: true,
          topN: WINDOW_TOP_DOMAIN_COUNT,
        },
      }),
      hasStatsDay: Boolean(stats?.dates?.[dateStr]),
    },
  ]));
}

export function buildSitesSiteDetail({
  domain,
  statsRange,
  cycleState = null,
  policyInput = {},
  insightsMode = INSIGHTS_MODES.OFF,
  interventionEffectsRange,
  now = Date.now(),
} = {}) {
  const requestedDomain = requireSitesSiteDetailDomain(domain);

  const dashboardPolicy = buildStatsDashboardPolicyInput(policyInput);
  const canonicalDomain = resolveSitesSelectionDomain(requestedDomain, dashboardPolicy);
  const recording = resolveDomainUsageRecording(canonicalDomain, dashboardPolicy);
  const capAvailability = resolveTimeCapAvailability(canonicalDomain, dashboardPolicy);
  if (!recording.enabled) {
    // A no-longer-listed selected domain still has a truthful policy response;
    // it must not need historical IO or become an analysis error.
    const registryEntry = buildSitesPolicyOnlyRegistryEntry(canonicalDomain, dashboardPolicy);
    return {
      requestedDomain, domain: canonicalDomain, mode: 'policy_only', recording, capAvailability,
      ruleScope: 'domain_and_subdomains',
      policyFingerprint: buildStatsDashboardPolicyFingerprint(dashboardPolicy),
      computedAtEpochMs: now, projectionScope: null, registryEntry, intel: null,
    };
  }

  const currentDateStr = getLocalDateStr(now);
  const weeklyDates = getRecentDateStrings(SITES_OVERVIEW_DAYS, now);
  const baselineSourceDates = getRecentDateStrings(SITE_PULL_BASELINE_READ_DAYS, now);
  const baselineDates = baselineSourceDates.slice(0, SITE_PULL_BASELINE_DAYS);
  const projectionDomains = resolveSitesSiteDetailProjectionDomains({
    statsRange,
    domain: canonicalDomain,
    blockedTargets: dashboardPolicy.blockedUrls,
    allowedTargets: dashboardPolicy.allowedUrls,
  });
  const transitionEdgeIndex = buildTransitionEdgeIndex(statsRange);
  const stats = normalizeAnalysisStats(scopeSitesSiteDetailStatsRange(statsRange, projectionDomains));
  const policyContext = createStatsPolicyContext(dashboardPolicy);
  const requiredDayProjections = buildDayProjectionMap({
    dates: Array.from(new Set([...baselineDates, ...weeklyDates])),
    stats,
    policyContext,
    domains: projectionDomains,
  });
  const baselineDayProjections = Object.fromEntries(
    baselineDates.map((dateStr) => [dateStr, requiredDayProjections[dateStr]]),
  );
  const weeklyDayProjections = Object.fromEntries(
    weeklyDates.map((dateStr) => [dateStr, requiredDayProjections[dateStr]]),
  );
  const registryDayProjection = buildRhythmDayProjection({
    stats,
    policyContext,
    cycleState,
    filter: {
      domains: projectionDomains,
    },
    now,
  });
  const rawSiteDetails = buildSiteDetails(registryDayProjection?.domainTotals);
  const protectedExposureDetails = buildSitesProtectedExposureDetails({
    statsRange: stats,
    range: registryDayProjection.range,
    blockedTargets: dashboardPolicy.blockedUrls,
    allowedTargets: dashboardPolicy.allowedUrls,
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
  });
  const registry = buildSitesRegistryReadModel({
    recordingPolicy: dashboardPolicy,
    rawSiteDetails,
    protectedSiteDetails: protectedExposureDetails.siteDetails,
    blockedTargets: dashboardPolicy.blockedUrls,
    allowedTargets: dashboardPolicy.allowedUrls,
    siteGoals: {
      ...dashboardPolicy.siteGoals,
      [canonicalDomain]: dashboardPolicy.siteGoals?.[canonicalDomain] || 0,
    },
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
  });
  const interventionEffectIndex = buildInterventionEffectIndex(requireEvidenceRange(
    interventionEffectsRange,
    'STATS_SITES_SITE_DETAIL_INTERVENTION_EFFECTS_REQUIRED',
  ));
  const blockedSet = new Set(dashboardPolicy.blockedUrls);
  const allowedSet = new Set(dashboardPolicy.allowedUrls);
  const completedActivityDays = buildSitesCompletedActivityDays({
    stats, policyContext, cycleState, now, filter: { domains: projectionDomains },
  });
  const goalMs = (dashboardPolicy.siteGoals[canonicalDomain] || 0) * 60_000;
  const completedPolicyUsage = completedActivityDays.observed.map(({ period }) => (
    buildSitesProtectedExposureDetails({ statsRange: stats, range: period.range, blockedTargets: dashboardPolicy.blockedUrls,
      allowedTargets: dashboardPolicy.allowedUrls, trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls })
      .siteDetails[canonicalDomain] || 0
  ));
  const goalContext = requireSiteGoalContext({
    basis: 'activity-day',
    observed: registryDayProjection.domainTotals.some((entry) => entry.collectionObservation.observed),
    usageMs: protectedExposureDetails.siteDetails[canonicalDomain] || 0,
    observedDays: completedPolicyUsage.length,
    activeDays: completedPolicyUsage.filter((value) => value > 0).length,
    overLimitDays: completedPolicyUsage.filter((value) => goalMs > 0 && value > goalMs).length,
  });
  const intel = buildRuleSiteIntel(canonicalDomain, {
    siteDetails: registry.observedSiteDetails,
    siteGoalMap: dashboardPolicy.siteGoals,
    blockedSet,
    allowedSet,
    insightsMode,
    weeklyDates,
    weeklyDayProjections,
    currentDateStr,
    baselineDates,
    baselineDayProjections,
    transitionEdgeIndex,
    interventionEffectIndex,
    detailTier: SITES_SITE_INTEL_DETAIL_TIER.FULL,
    dataCollectionMode: dashboardPolicy.dataCollectionMode,
    ownedDomains: projectionDomains,
    goalContext,
    now,
  });

  return {
    mode: 'analysis', recording, capAvailability,
    requestedDomain,
    domain: canonicalDomain,
    ruleScope: 'domain_and_subdomains',
    policyFingerprint: buildStatsDashboardPolicyFingerprint(dashboardPolicy),
    computedAtEpochMs: now,
    projectionScope: {
      kind: 'domain-root-and-subdomains',
      rootDomain: canonicalDomain,
      projectedDomainCount: projectionDomains.length,
    },
    registryEntry: registry.byDomain[canonicalDomain],
    intel,
  };
}
