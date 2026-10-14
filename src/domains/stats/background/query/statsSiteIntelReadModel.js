import { INSIGHTS_MODES } from '../../../settings/config/insightsMode.js';
import { buildSiteIntelTemporalContext } from '../../contracts/siteIntelTemporalContext.js';
import {
  DEFAULT_DATA_COLLECTION_MODE,
  normalizeDataCollectionMode,
} from '../../../settings/config/dataCollectionPolicy.js';
import {
  buildSiteInsightModel,
  buildSitePullFacts,
  computeSitePullProfile,
  resolveSitePullFeatureVector,
  toPublicSitePullFacts,
} from '../../insights/index.js';
import {
  toNumber,
} from './statsAnalysisQueryShared.js';
import {
  normalizeSiteBehaviorStats,
  normalizeSiteInterventionStats,
  normalizeSiteNavigationStats,
  normalizeSiteSessionStats,
  sumSiteBehaviorStats,
  sumSiteInterventionStats,
  sumSiteNavigationStats,
  sumSiteSessionStats,
} from './statsSiteIntelMetricStats.js';
import { getDomainInterventionEffectSummary } from './statsSiteInterventionEffects.js';
import {
  buildDomainTransitionEdgeSeries,
  getDomainTransitionEdges,
} from './statsSiteTransitionEdges.js';
import {
  buildDomainProjectionEntry,
  buildDomainProjectionHourly,
  buildDomainProjectionHourlyVisits,
  buildDomainProjectionSeries,
  buildSitePullBaselineProjectionSeries,
} from './statsSiteIntelReadModelHelpers.js';
import { parseLocalDateParts } from '../../shared/dateMath.js';
import {
  requireInterventionEffectIndex,
  requireTransitionEdgeIndex,
} from './statsSiteIntelEvidenceContract.js';
import { deriveWeeklyObservationSummary } from '../../insights/contracts/weeklyObservationContract.js';
import {
  createUnobservedStatsDomainCollectionObservation,
  requireStatsDomainCollectionObservation,
} from '../../contracts/statsContracts.js';
import {
  buildSitesSiteRecurringTimeEvidence,
  createUnloadedSitesSiteRecurringTimeEvidence,
} from './statsSiteRecurringTimeEvidence.js';
import { buildSitesSiteLongTermPatterns } from './statsSiteLongTermPatterns.js';
import { createUnloadedSiteLongTermPatterns } from '../../contracts/siteLongTermPatternContract.js';
import { buildSitesSiteTodayNotes } from './statsSiteTodayNotes.js';
import { createUnloadedSiteTodayNotes } from '../../contracts/siteTodayNotesContract.js';

export const SITES_SITE_INTEL_DETAIL_STRATEGY = 'analysis_index_selected_full_detail';
export const SITES_SITE_INTEL_TODAY_EVIDENCE_BASIS = 'calendar-date-set';
export const SITES_SITE_INTEL_DETAIL_TIER = Object.freeze({
  FULL: 'full',
  ANALYSIS: 'analysis',
  SUMMARY: 'summary',
});

function resolveSiteIntelDetailTier(detailTier) {
  if (detailTier === SITES_SITE_INTEL_DETAIL_TIER.SUMMARY) {
    return SITES_SITE_INTEL_DETAIL_TIER.SUMMARY;
  }
  if (detailTier === SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS) {
    return SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS;
  }
  return SITES_SITE_INTEL_DETAIL_TIER.FULL;
}

export function buildRuleSiteIntel(domain, {
  siteDetails,
  siteGoalMap,
  blockedSet,
  allowedSet,
  insightsMode = INSIGHTS_MODES.OFF,
  weeklyDates,
  weeklyDayProjections,
  currentDateStr,
  baselineDates = null,
  baselineDayProjections = null,
  transitionEdgeIndex = null,
  interventionEffectIndex = null,
  detailTier = SITES_SITE_INTEL_DETAIL_TIER.FULL,
  todayProjectionOverride = null,
  goalContext = null,
  dataCollectionMode = DEFAULT_DATA_COLLECTION_MODE,
  ownedDomains = null,
  now = Date.now(),
} = {}) {
  const resolvedDetailTier = resolveSiteIntelDetailTier(detailTier);
  const includeFullDetail = resolvedDetailTier === SITES_SITE_INTEL_DETAIL_TIER.FULL;
  const includeAnalysis = includeFullDetail || resolvedDetailTier === SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS;
  const resolvedTransitionEdgeIndex = includeFullDetail
    ? requireTransitionEdgeIndex(transitionEdgeIndex)
    : transitionEdgeIndex;
  const resolvedInterventionEffectIndex = includeFullDetail
    ? requireInterventionEffectIndex(interventionEffectIndex)
    : interventionEffectIndex;
  const ms = toNumber(siteDetails?.[domain]);
  const limit = toNumber(siteGoalMap?.[domain]);
  const goalMs = limit * 60_000;
  if (typeof currentDateStr !== 'string' || !parseLocalDateParts(currentDateStr)) {
    throw new Error('STATS_RULE_SITE_INTEL_CURRENT_DATE_REQUIRED');
  }
  if (!Array.isArray(weeklyDates) || !weeklyDates.includes(currentDateStr)) {
    throw new Error('STATS_RULE_SITE_INTEL_WEEKLY_CURRENT_DATE_MISSING');
  }
  const todayDateStr = currentDateStr;
  const overrideRange = todayProjectionOverride?.range && typeof todayProjectionOverride.range === 'object'
    ? todayProjectionOverride.range
    : null;
  const todayDateStrs = includeFullDetail ? [todayDateStr] : Array.from(new Set([
    overrideRange?.startDateStr,
    overrideRange?.endDateStr,
    todayDateStr,
  ].filter(Boolean)));

  const weeklySeries = buildDomainProjectionSeries({
    dates: weeklyDates,
    dayProjections: weeklyDayProjections,
    domain,
    goalMs,
  });
  const baselineSeries = includeFullDetail
    ? buildSitePullBaselineProjectionSeries({
        dates: baselineDates,
        dayProjections: baselineDayProjections,
        domain,
        goalMs,
        currentDateStr,
      })
    : [];
  const recurringTimeEvidence = includeFullDetail
    ? buildSitesSiteRecurringTimeEvidence({
        dates: baselineDates,
        dayProjections: baselineDayProjections,
        domain,
        currentDateStr,
      })
    : createUnloadedSitesSiteRecurringTimeEvidence();
  const longTermPatterns = includeFullDetail
    ? buildSitesSiteLongTermPatterns({
        dates: baselineDates,
        dayProjections: baselineDayProjections,
        domain,
        currentDateStr,
        recurringTimeEvidence,
      })
    : createUnloadedSiteLongTermPatterns();

  const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries, {
    source: 'buildRuleSiteIntel.weeklySeries',
  });
  const observedWeeklySeries = weeklyObservationSummary.observedEntries;
  const weeklyTotal = weeklyObservationSummary.activeMsTotal;
  const weeklyVisits = observedWeeklySeries.reduce(
    (acc, entry) => acc + Math.max(0, Math.floor(toNumber(entry.visits))),
    0,
  );
  const weeklySessionStats = sumSiteSessionStats(observedWeeklySeries);
  const weeklyBehaviorStats = sumSiteBehaviorStats(observedWeeklySeries);
  const weeklyInterventionStats = sumSiteInterventionStats(observedWeeklySeries);
  const weeklyNavigationStats = sumSiteNavigationStats(observedWeeklySeries);
  const todayInterventionEffectSummary = includeFullDetail
    ? getDomainInterventionEffectSummary(resolvedInterventionEffectIndex, domain, todayDateStrs, {
        ownedDomains,
      })
    : null;
  const weeklyInterventionEffectSummary = includeFullDetail
    ? getDomainInterventionEffectSummary(resolvedInterventionEffectIndex, domain, weeklyDates, {
        ownedDomains,
      })
    : null;
  const todayTransitionEdges = includeFullDetail
    ? getDomainTransitionEdges(resolvedTransitionEdgeIndex, domain, todayDateStrs, {
        ownedDomains,
      }).slice(0, 8)
    : [];
  const weeklyTransitionEdges = includeFullDetail
    ? getDomainTransitionEdges(resolvedTransitionEdgeIndex, domain, weeklyDates, {
        ownedDomains,
      }).slice(0, 24)
    : [];
  const transitionEdgeSeries = includeFullDetail
    ? buildDomainTransitionEdgeSeries(resolvedTransitionEdgeIndex, domain, baselineDates, {
        ownedDomains,
      })
    : [];
  const activeDays = weeklyObservationSummary.activeDays;
  const overLimitDays = weeklyObservationSummary.overLimitDays;
  const streakDays = weeklyObservationSummary.streakDays;

  // Full behavioral analysis compares calendar facts with calendar baselines.
  // The activity-day policy context is a separate input, never today's override.
  const todayProjection = includeFullDetail
    ? weeklyDayProjections?.[todayDateStr]
    : todayProjectionOverride || weeklyDayProjections?.[todayDateStr];
  const todayDomainEntry = buildDomainProjectionEntry(todayProjection, domain);
  const todayCollectionObservation = todayDomainEntry?.collectionObservation
    ? requireStatsDomainCollectionObservation(todayDomainEntry.collectionObservation, {
        source: `buildRuleSiteIntel.${domain}.todayCollectionObservation`,
      })
    : createUnobservedStatsDomainCollectionObservation();
  const todayObserved = todayCollectionObservation.observed;
  const rawTodayHourly = buildDomainProjectionHourly(todayProjection, domain);
  const todayHourly = Array.from({ length: 24 }, (_, hour) => Math.max(0, toNumber(rawTodayHourly?.[hour])));
  const rawTodayHourlyVisits = buildDomainProjectionHourlyVisits(todayProjection, domain, {
    preferDomainTotals: includeFullDetail || !todayProjectionOverride,
  });
  const todayHourlyVisits = Array.from({ length: 24 }, (_, hour) => (
    Math.max(0, Math.floor(toNumber(rawTodayHourlyVisits?.[hour])))
  ));
  const todayTotal = todayHourly.reduce((acc, value) => acc + value, 0);
  const todayVisits = todayHourlyVisits.reduce((acc, value) => acc + value, 0);
  const projectedTodaySessionStats = normalizeSiteSessionStats(todayDomainEntry?.sessions);
  const projectedTodayBehaviorStats = normalizeSiteBehaviorStats(todayDomainEntry?.behavior);
  const projectedTodayInterventionStats = normalizeSiteInterventionStats(todayDomainEntry?.interventions);
  const projectedTodayNavigationStats = normalizeSiteNavigationStats(todayDomainEntry?.navigation);
  const todaySessionStats = projectedTodaySessionStats;
  const todayBehaviorStats = projectedTodayBehaviorStats;
  const todayInterventionStats = projectedTodayInterventionStats;
  const todayNavigationStats = projectedTodayNavigationStats;
  const dailyPeakIndex = todayHourly.reduce(
    (best, value, index) => (value > best.value ? { index, value } : best),
    { index: null, value: 0 },
  ).index;

  const habitHourly = Array(24).fill(0);
  weeklyDates.forEach((dateStr) => {
    const hourly = buildDomainProjectionHourly(weeklyDayProjections?.[dateStr], domain);
    for (let hour = 0; hour < 24; hour += 1) {
      habitHourly[hour] += Math.max(0, toNumber(hourly[hour]));
    }
  });

  const peakIndex = habitHourly.reduce(
    (best, value, index) => (value > best.value ? { index, value } : best),
    { index: null, value: 0 },
  ).index;

  const baseIntel = {
    ...(goalContext === null ? {} : { goalContext }),
    domain,
    detailTier: resolvedDetailTier,
    totalMs: ms,
    limitMinutes: limit,
    overLimit: goalMs > 0 && ms > goalMs,
    type: blockedSet.has(domain) ? 'blocked' : allowedSet.has(domain) ? 'allowed' : 'unmanaged',
    weeklySeries,
    baselineSeries,
    baselineCurrentDateStr: currentDateStr,
    recurringTimeEvidence,
    longTermPatterns,
    weeklyTotal,
    weeklyVisits,
    weeklySessionStats,
    weeklyBehaviorStats,
    weeklyInterventionStats,
    todayInterventionEffectSummary,
    weeklyInterventionEffectSummary,
    weeklyNavigationStats,
    activeDays,
    overLimitDays,
    streakDays,
    todayObserved,
    todayCollectionObservation,
    todayTotal,
    todayVisits,
    todaySessionStats,
    todayBehaviorStats,
    todayInterventionStats,
    todayNavigationStats,
    todayTransitionEdges,
    todayTransitionEvidenceBasis: SITES_SITE_INTEL_TODAY_EVIDENCE_BASIS,
    todayInterventionEvidenceBasis: SITES_SITE_INTEL_TODAY_EVIDENCE_BASIS,
    todayEvidenceDateStrs: todayDateStrs,
    todayHourly,
    todayHourlyVisits,
    todayBasis: includeFullDetail ? 'calendar-day' : todayProjectionOverride?.basis || 'calendar-day',
    todayHorizon: includeFullDetail ? 'calendar_today' : todayProjectionOverride?.horizon || 'calendar_today',
    todayDateStr,
    todayDateStrs,
    todayRange: todayProjection?.range || null,
    weeklyTransitionEdges,
    transitionEdgeSeries,
    dailyPeakIndex,
    habitHourly,
    peakIndex,
    isReady: weeklyTotal > 0 || todayTotal > 0 || ms > 0,
  };

  if (!includeAnalysis) {
    return {
      ...baseIntel,
      todayNotes: createUnloadedSiteTodayNotes(),
      analysis: null,
      sitePullFacts: null,
      sitePullProfile: null,
      primaryInsight: null,
    };
  }

  if (!includeFullDetail) {
    const analysis = buildSiteInsightModel({
      intel: baseIntel,
      insightsMode,
    });
    return {
      ...baseIntel,
      todayNotes: createUnloadedSiteTodayNotes(),
      analysis,
      sitePullFacts: null,
      sitePullProfile: null,
      primaryInsight: analysis.primaryInsight,
    };
  }

  const sitePullDataCollectionMode = normalizeDataCollectionMode(
    dataCollectionMode,
    DEFAULT_DATA_COLLECTION_MODE,
  );
  const sitePullFacts = buildSitePullFacts({
    intel: baseIntel,
    options: {
      dataCollectionMode: sitePullDataCollectionMode,
    },
  });
  const sitePullProfile = computeSitePullProfile({
    facts: sitePullFacts,
    options: {
      dataCollectionMode: sitePullDataCollectionMode,
    },
  });
  const analysis = buildSiteInsightModel({
    featureVector: resolveSitePullFeatureVector({ facts: sitePullFacts }),
    recentTrajectory: sitePullFacts.personalBaseline.recentTrajectory,
    insightsMode,
  });
  const publicSitePullFacts = toPublicSitePullFacts(sitePullFacts);

  return {
    ...baseIntel,
    todayNotes: buildSitesSiteTodayNotes(baseIntel),
    analysis,
    sitePullFacts: {
      ...publicSitePullFacts,
      evidenceBasis: {
        transitionEdges: {
          today: SITES_SITE_INTEL_TODAY_EVIDENCE_BASIS,
          dateStrs: todayDateStrs,
        },
        interventionEffects: {
          today: SITES_SITE_INTEL_TODAY_EVIDENCE_BASIS,
          dateStrs: todayDateStrs,
        },
      },
    },
    sitePullProfile,
    temporalContext: buildSiteIntelTemporalContext(baseIntel),
    primaryInsight: analysis.primaryInsight,
  };
}
