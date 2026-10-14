import { getLocalDateStr } from '../../../../lib/index.js';
import {
  DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS,
  SCORE_LEDGER_SCORING_MODE,
  SCORE_SETUP_RECOMMENDATION_POLICY,
  buildRollingPressureReadModel,
  buildStatsAnalysisGoals,
  buildStatsDashboardPolicyFingerprint,
  buildStatsDashboardPolicyInput,
  buildStatusDomainCandidatePool,
  buildUsageBaselines,
  calculateDigitalWellnessBreakdown,
  finalizeScoreDailyOutcome,
} from '../../analysis/index.js';
import {
  projectStatsDay,
  projectStatsWindow,
} from '../../projection/index.js';
import { STATS_READ_MODEL_BASIS } from '../contracts/statsReadModelContracts.js';
import { INSIGHTS_MODES } from '../../../settings/config/insightsMode.js';
import { DATA_COLLECTION_MODES } from '../../../settings/config/dataCollectionPolicy.js';
import {
  STATUS_OVERVIEW_DAYS,
  STATUS_TOP_DOMAIN_COUNT,
  WINDOW_TOP_DOMAIN_COUNT,
  buildActivityDayPeriodSeries,
  projectActivityDayPeriodSeries,
  buildRhythmDayProjection,
  buildScoreSetupReadModel,
  buildSiteDetails,
  createStatsPolicyContext,
  getRecentDateStrings,
  isTrackingExcludedDomain,
  normalizeAnalysisStats,
  resolveCycleWindowQuery,
  resolveEffectiveResetHour,
  toNumber,
} from './statsAnalysisQueryShared.js';
import {
  SITES_SITE_INTEL_DETAIL_TIER,
  buildRuleSiteIntel,
} from './statsSiteIntelReadModel.js';
import { attachScoreSetupRecentTrajectoryToDomainCandidates } from './statsSiteIntelReadModelHelpers.js';
import { normalizeSiteInterventionStats } from './statsSiteIntelMetricStats.js';
import {
  buildEmptyStatusHabitFeedback,
  buildStatusHabitFeedback,
  buildVisibleDomainSelection,
} from './statsStatusVisibleDomainReadModel.js';
import {
  requireCanonicalStatsStatusSnapshot,
} from '../../contracts/statsStatusSnapshotContract.js';

function buildCriteriaCoveredActiveMs({
  totalActiveMs = 0,
  todayProtectedMs = 0,
  todaySiteDetails = {},
  blockedSet = new Set(),
  siteGoalMap = {},
  globalGoal = 0,
} = {}) {
  const total = Math.max(0, toNumber(totalActiveMs));
  if (total <= 0) return 0;

  let covered = Math.max(0, toNumber(globalGoal) > 0 ? toNumber(todayProtectedMs) : 0);
  Object.keys(siteGoalMap).forEach((domain) => {
    if (!domain || toNumber(siteGoalMap?.[domain]) <= 0) return;
    if (toNumber(globalGoal) > 0 && blockedSet.has(domain)) return;
    covered += Math.max(0, toNumber(todaySiteDetails?.[domain]));
  });

  return Math.min(total, covered);
}

function buildEmptyStatusSnapshot(
  policyFingerprint,
  now = Date.now(),
  insightsMode = INSIGHTS_MODES.OFF,
) {
  const visibleDomainSelection = buildVisibleDomainSelection();
  return requireCanonicalStatsStatusSnapshot({
    policyBasis: 'current',
    policyFingerprint,
    computedAtEpochMs: now,
    insightsMode,
    available: false,
    overviewDates: [],
    window: {
      range: null,
      totals: null,
      domainTotals: [],
      siteDetails: {},
    },
    currentActivityDay: {
      dateStr: getLocalDateStr(now),
      activityDateStr: getLocalDateStr(now),
      basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
      horizon: 'current_activity_day_so_far',
      totals: null,
      domainTotals: [],
      siteDetails: {},
      hourlyBuckets: [],
    },
    domainInsights: {},
    domainCandidates: [],
    visibleDomainCandidates: [],
    visibleDomainSelection,
    pressureRailReadiness: visibleDomainSelection.pressureRailReadiness,
    habitFeedback: buildEmptyStatusHabitFeedback(now),
    rollingPressure: null,
    metrics: {
      todayActiveMs: 0,
      todayProtectedMs: 0,
      weeklyProtectedAverageMs: 0,
      dailyScore: 100,
      dailyDisplayScore: null,
      dailyScoringMode: SCORE_LEDGER_SCORING_MODE.QUIET,
      scoreCriteriaCoverage: null,
      scoreSetup: null,
      signalCount: 0,
      totalBlockedDuration: 0,
      dailyLimitPercent: 0,
      trackedDateCount: 0,
      activeProtectionDayCount: 0,
      protectedVisitCount: 0,
      frictionSuccessCount: 0,
      todayFrictionSuccessCount: 0,
      todayProtectedVisitCount: 0,
      dailyOutcome: null,
    },
  });
}

function buildProtectedCultivationMetrics({
  managedDomains = [],
  overviewDates = [],
  weeklyDayProjections = {},
} = {}) {
  const managedSet = new Set(
    (Array.isArray(managedDomains) ? managedDomains : [])
      .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
      .filter(Boolean),
  );
  if (managedSet.size <= 0) {
    return {
      activeProtectionDayCount: 0,
      protectedVisitCount: 0,
      frictionSuccessCount: 0,
    };
  }

  let activeProtectionDayCount = 0;
  let protectedVisitCount = 0;
  let frictionSuccessCount = 0;

  (Array.isArray(overviewDates) ? overviewDates : []).forEach((dateStr) => {
    const projection = weeklyDayProjections?.[dateStr];
    const domainTotals = Array.isArray(projection?.domainTotals) ? projection.domainTotals : [];
    let activeDay = false;

    domainTotals.forEach((entry) => {
      const domain = typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : '';
      if (!domain || !managedSet.has(domain)) return;

      const activeMs = Math.max(0, toNumber(entry?.activeMs));
      const visits = Math.max(0, Math.floor(toNumber(entry?.visits)));
      const interventions = normalizeSiteInterventionStats(entry?.interventions);
      protectedVisitCount += visits;
      frictionSuccessCount += Math.max(0, interventions.frictionShown - interventions.continued);
      if (activeMs > 0 || visits > 0) {
        activeDay = true;
      }
    });

    if (activeDay) {
      activeProtectionDayCount += 1;
    }
  });

  return {
    activeProtectionDayCount,
    protectedVisitCount,
    frictionSuccessCount,
  };
}

function buildTodayPracticeMetrics({
  managedDomains = [],
  projection = null,
} = {}) {
  const managedSet = new Set(
    (Array.isArray(managedDomains) ? managedDomains : [])
      .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
      .filter(Boolean),
  );
  let frictionSuccessCount = 0;
  let protectedVisitCount = 0;
  const domainTotals = Array.isArray(projection?.domainTotals) ? projection.domainTotals : [];
  domainTotals.forEach((entry) => {
    const domain = typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : '';
    if (!domain || !managedSet.has(domain)) return;
    const interventions = normalizeSiteInterventionStats(entry?.interventions);
    frictionSuccessCount += Math.max(0, interventions.frictionShown - interventions.continued);
    protectedVisitCount += Math.max(0, Math.floor(toNumber(entry?.visits)));
  });
  return { frictionSuccessCount, protectedVisitCount };
}

function hasCompleteStatsDateCoverage(period = null, statsDateSet = new Set()) {
  const startDateStr = period?.range?.startDateStr;
  const endDateStr = period?.range?.endDateStr;
  if (typeof startDateStr !== 'string' || typeof endDateStr !== 'string') return false;
  if (!statsDateSet.has(startDateStr)) return false;
  return startDateStr === endDateStr || statsDateSet.has(endDateStr);
}

function attachRollingPressurePeriodEvidence(entry, statsDateSet) {
  const observed = hasCompleteStatsDateCoverage(entry?.period, statsDateSet);
  if (entry?.period?.current || observed) {
    return {
      ...entry,
      evidence: { observed },
    };
  }

  return {
    ...entry,
    projection: {
      ...entry.projection,
      totals: null,
      buckets: [],
      domainTotals: [],
      hourlyBuckets: [],
    },
    evidence: { observed: false },
  };
}

export function buildStatusSnapshot({
  statsRange,
  cycleSnapshot,
  cycleState = null,
  policyInput = {},
  insightsMode = INSIGHTS_MODES.OFF,
  now = Date.now(),
} = {}) {
  const stats = normalizeAnalysisStats(statsRange);
  const dashboardPolicy = buildStatsDashboardPolicyInput(policyInput);
  const policyContext = createStatsPolicyContext(dashboardPolicy);
  const goals = buildStatsAnalysisGoals(dashboardPolicy);
  const policyFingerprint = buildStatsDashboardPolicyFingerprint(dashboardPolicy);
  const overviewDates = getRecentDateStrings(STATUS_OVERVIEW_DAYS, now);
  const scoreSetupDates = getRecentDateStrings(
    SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS + 1,
    now,
  ).slice(0, -1);
  const emptySnapshot = buildEmptyStatusSnapshot(policyFingerprint, now, insightsMode);
  const statsDateKeys = Object.keys(stats?.dates || {}).sort((left, right) => left.localeCompare(right));
  const statsDateSet = new Set(statsDateKeys);
  const todayStr = getLocalDateStr(now);
  const resetHour = resolveEffectiveResetHour(cycleState);
  const calendarTodayProjection = projectStatsDay({
    statsRange: stats,
    dateStr: todayStr,
    policyContext,
    filter: {
      includeTopDomains: true,
      topN: STATUS_TOP_DOMAIN_COUNT,
    },
  });
  const rhythmDayProjection = buildRhythmDayProjection({
    stats,
    policyContext,
    cycleState,
    now,
  });
  const calendarToday = {
    dateStr: todayStr,
    basis: STATS_READ_MODEL_BASIS.CALENDAR_DAY,
    horizon: 'calendar_today',
    range: calendarTodayProjection?.range || null,
    totals: calendarTodayProjection?.totals || null,
    domainTotals: Array.isArray(calendarTodayProjection?.domainTotals)
      ? calendarTodayProjection.domainTotals
      : [],
    siteDetails: buildSiteDetails(calendarTodayProjection?.domainTotals),
    hourlyBuckets: Array.isArray(calendarTodayProjection?.hourlyBuckets)
      ? calendarTodayProjection.hourlyBuckets
      : [],
  };
  const currentActivityDayProjection = {
    dateStr: rhythmDayProjection?.range?.startDateStr || todayStr,
    activityDateStr: rhythmDayProjection?.range?.startDateStr || todayStr,
    basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
    horizon: 'current_activity_day_so_far',
    hasStatsDay: statsDateSet.has(todayStr),
    resetHour: rhythmDayProjection?.resetHour ?? resetHour,
    range: rhythmDayProjection?.range || null,
    totals: rhythmDayProjection?.totals || calendarTodayProjection?.totals || null,
    domainTotals: Array.isArray(rhythmDayProjection?.domainTotals)
      ? rhythmDayProjection.domainTotals
      : (Array.isArray(calendarTodayProjection?.domainTotals) ? calendarTodayProjection.domainTotals : []),
    hourlyBuckets: Array.isArray(rhythmDayProjection?.hourlyBuckets)
      ? rhythmDayProjection.hourlyBuckets
      : (Array.isArray(calendarTodayProjection?.hourlyBuckets) ? calendarTodayProjection.hourlyBuckets : []),
  };
  const todayProjection = currentActivityDayProjection;
  const todaySiteDetails = buildSiteDetails(todayProjection?.domainTotals);
  const weeklyDayProjections = Object.fromEntries(
    overviewDates.map((dateStr) => {
      const projection = dateStr === todayStr
        ? calendarTodayProjection
        : projectStatsDay({
            statsRange: stats,
            dateStr,
            policyContext,
            filter: {
              includeTopDomains: true,
              topN: STATUS_TOP_DOMAIN_COUNT,
            },
          });
      return [
        dateStr,
        {
          ...projection,
          hasStatsDay: statsDateSet.has(dateStr),
        },
      ];
    }),
  );
  const scoreSetupDayProjections = Object.fromEntries(
    scoreSetupDates.map((dateStr) => [
      dateStr,
      {
        ...(weeklyDayProjections?.[dateStr] || projectStatsDay({
          statsRange: stats,
          dateStr,
          policyContext,
          filter: {
            includeTopDomains: true,
            topN: STATUS_TOP_DOMAIN_COUNT,
          },
        })),
        hasStatsDay: statsDateSet.has(dateStr),
      },
    ]),
  );
  const windowQuery = resolveCycleWindowQuery(cycleSnapshot);
  const windowProjection = windowQuery
    ? projectStatsWindow({
        statsRange: stats,
        policyContext,
        filter: {
          includeTopDomains: true,
          topN: WINDOW_TOP_DOMAIN_COUNT,
        },
        ...windowQuery,
      })
    : null;
  const siteDetails = buildSiteDetails(windowProjection?.domainTotals);
  const blockedTargets = dashboardPolicy.blockedUrls;
  const blockedSet = new Set(blockedTargets);
  const allowedTargets = dashboardPolicy.allowedUrls;
  const allowedSet = new Set(allowedTargets);
  const siteGoalMap = dashboardPolicy.siteGoals;
  const rollingPressurePeriods = buildActivityDayPeriodSeries({
    now,
    resetHour,
    count: DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS + 1,
  });
  const rollingPressurePeriodProjections = projectActivityDayPeriodSeries({
    stats,
    policyContext,
    periods: rollingPressurePeriods,
    filter: {
      includeTopDomains: true,
      topN: STATUS_TOP_DOMAIN_COUNT,
    },
  }).map((entry) => attachRollingPressurePeriodEvidence(entry, statsDateSet));
  const rollingPressure = buildRollingPressureReadModel({
    periodProjections: rollingPressurePeriodProjections,
    blockedUrls: blockedTargets,
    allowedUrls: allowedTargets,
    siteGoals: siteGoalMap,
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
  });
  const managedCultivationDomains = Array.from(new Set([
    ...blockedTargets,
    ...Object.keys(siteGoalMap).filter((domain) => toNumber(siteGoalMap?.[domain]) > 0),
  ]));
  const todayActiveMs = toNumber(todayProjection?.totals?.activeMs);
  const todayProtectedMs = toNumber(todayProjection?.totals?.byCategory?.blocked?.activeMs);
  const weeklyProtectedAverageMs = overviewDates.length > 0
    ? overviewDates.reduce(
        (acc, dateStr) => acc + toNumber(weeklyDayProjections?.[dateStr]?.totals?.byCategory?.blocked?.activeMs),
        0,
      ) / overviewDates.length
    : 0;
  const criteriaCoveredActiveMs = buildCriteriaCoveredActiveMs({
    totalActiveMs: todayActiveMs,
    todayProtectedMs,
    todaySiteDetails,
    blockedSet,
    siteGoalMap,
    globalGoal: dashboardPolicy.globalGoal,
  });
  const metrics = {
    totalActive: todayActiveMs,
    blockedActive: todayProtectedMs,
    unmanagedActive: toNumber(todayProjection?.totals?.byCategory?.other?.activeMs),
    criteriaCoveredActiveMs,
    totalSessions: toNumber(todayProjection?.totals?.sessions?.count),
    totalSwitches: todayProjection?.totals?.switches || {
      toBlocked: 0,
      toAllowed: 0,
      toUnmanaged: 0,
      internal: 0,
    },
    siteDetails: todaySiteDetails,
  };
  const usageBaselines = buildUsageBaselines({
    stats,
    blockedUrls: blockedTargets,
    siteLimits: dashboardPolicy.siteGoals,
    now,
  });
  const dailyScoring = calculateDigitalWellnessBreakdown(metrics, {
    ...goals,
    siteLimits: dashboardPolicy.siteGoals,
    usageBaselines,
  });
  const {
    score: dailyScore,
    displayScore: dailyDisplayScore,
    scoringMode: dailyScoringMode,
    criteriaCoverage: scoreCriteriaCoverage,
  } = dailyScoring;
  const signalCount = blockedTargets.reduce(
    (acc, domain) => (toNumber(siteDetails?.[domain]) > 0 ? acc + 1 : acc),
    0,
  );
  const totalBlockedDuration = Object.entries(siteDetails).reduce(
    (acc, [domain, activeMs]) => acc + (blockedSet.has(domain) ? toNumber(activeMs) : 0),
    0,
  );
  const globalGoalMs = Math.max(0, toNumber(dashboardPolicy.globalGoal)) * 60_000;
  const dailyLimitPercent = globalGoalMs > 0
    ? Math.min((totalBlockedDuration / globalGoalMs) * 100, 100)
    : 0;
  const domainNames = Array.from(
    new Set([
      ...Object.keys(siteDetails),
      ...Object.keys(todaySiteDetails),
      ...(Array.isArray(rollingPressure?.domains)
        ? rollingPressure.domains.map((entry) => entry.domain)
        : []),
      ...blockedTargets,
      ...allowedTargets,
    ]),
  ).filter((domain) => !isTrackingExcludedDomain(domain, dashboardPolicy.trackingExcludedUrls));
  const domainInsights = Object.fromEntries(
    domainNames.map((domain) => {
      const intel = buildRuleSiteIntel(domain, {
        siteDetails: todaySiteDetails,
        siteGoalMap,
        blockedSet,
        allowedSet,
        insightsMode,
        weeklyDates: overviewDates,
        weeklyDayProjections,
        currentDateStr: todayStr,
        detailTier: SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS,
        dataCollectionMode: dashboardPolicy.dataCollectionMode,
        todayProjectionOverride: currentActivityDayProjection,
        now,
      });
      return [
        domain,
        {
          domain,
          windowActiveMs: toNumber(siteDetails?.[domain]),
          todayActiveMs: toNumber(todaySiteDetails?.[domain]),
          todayHourlyActiveMs: intel.todayHourly,
          weeklySeries: intel.weeklySeries,
          weeklyTotal: intel.weeklyTotal,
          activeDays: intel.activeDays,
          overLimitDays: intel.overLimitDays,
          limitMinutes: intel.limitMinutes,
          status: intel.type,
          analysis: intel.analysis,
          primaryInsight: intel.primaryInsight,
        },
      ];
    }),
  );
  const domainCandidates = attachScoreSetupRecentTrajectoryToDomainCandidates({
    domainCandidates: buildStatusDomainCandidatePool({
      blockedUrls: blockedTargets,
      allowedUrls: allowedTargets,
      siteDetails,
      todaySiteDetails,
      domainInsights,
      globalGoal: dashboardPolicy.globalGoal,
      siteGoals: siteGoalMap,
      trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
      rollingPressure,
      includeUnmanaged: dashboardPolicy.dataCollectionMode === DATA_COLLECTION_MODES.ALL_SITES_MINIMAL,
    }),
    dates: scoreSetupDates,
    dayProjections: scoreSetupDayProjections,
    currentDateStr: todayStr,
  });
  const visibleDomainSelection = buildVisibleDomainSelection({
    domainCandidates,
    rollingPressure,
  });
  const habitFeedback = buildStatusHabitFeedback({
    visibleDomainCandidates: visibleDomainSelection.candidates,
    rollingPressure,
    now,
  });
  const scoreSetup = buildScoreSetupReadModel({
    coverage: scoreCriteriaCoverage,
    domainCandidates,
    siteGoals: siteGoalMap,
  });
  const cultivationMetrics = buildProtectedCultivationMetrics({
    managedDomains: managedCultivationDomains,
    overviewDates,
    weeklyDayProjections,
  });
  const todayPracticeMetrics = buildTodayPracticeMetrics({
    managedDomains: managedCultivationDomains,
    projection: todayProjection,
  });
  const dailyOutcome = finalizeScoreDailyOutcome(dailyScoring.scoreSummary?.outcomeBasis, {
    practiceCount: todayPracticeMetrics.frictionSuccessCount,
    protectedVisitCount: todayPracticeMetrics.protectedVisitCount,
  });

  return requireCanonicalStatsStatusSnapshot({
    ...emptySnapshot,
    policyBasis: 'current',
    policyFingerprint,
    computedAtEpochMs: now,
    insightsMode,
    available: statsDateKeys.length > 0 || !!windowQuery,
    overviewDates,
    window: {
      range: windowProjection?.range || windowQuery,
      totals: windowProjection?.totals || null,
      domainTotals: Array.isArray(windowProjection?.domainTotals) ? windowProjection.domainTotals : [],
      siteDetails,
    },
    currentActivityDay: {
      ...currentActivityDayProjection,
      siteDetails: todaySiteDetails,
    },
    calendarToday,
    domainInsights,
    domainCandidates,
    visibleDomainCandidates: visibleDomainSelection.candidates,
    visibleDomainSelection,
    pressureRailReadiness: visibleDomainSelection.pressureRailReadiness,
    habitFeedback,
    rollingPressure,
    metrics: {
      todayActiveMs,
      todayProtectedMs,
      weeklyProtectedAverageMs,
      dailyScore,
      dailyDisplayScore,
      dailyScoringMode,
      scoreCriteriaCoverage,
      scoreSetup,
      scoreLedger: dailyScoring.ledger,
      scoreSummary: dailyScoring.scoreSummary,
      scoreInsights: dailyScoring.scoreInsights,
      signalCount,
      totalBlockedDuration,
      dailyLimitPercent,
      trackedDateCount: statsDateKeys.length,
      activeProtectionDayCount: cultivationMetrics.activeProtectionDayCount,
      protectedVisitCount: cultivationMetrics.protectedVisitCount,
      frictionSuccessCount: cultivationMetrics.frictionSuccessCount,
      todayFrictionSuccessCount: todayPracticeMetrics.frictionSuccessCount,
      todayProtectedVisitCount: todayPracticeMetrics.protectedVisitCount,
      dailyOutcome,
    },
  });
}
