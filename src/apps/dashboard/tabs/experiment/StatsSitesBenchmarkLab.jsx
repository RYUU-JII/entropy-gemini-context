import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Gauge, Loader2, Play, RotateCcw } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { createStatsAnalysisQueryService } from '@/domains/stats/background/query/index.js';
import {
  STATS_FACTS_READ_BASIS,
  STATS_FACTS_RUNTIME_OVERLAY,
} from '@/domains/stats/background/contracts/statsReadModelContracts.js';
import {
  STATS_HOURLY_BUCKETS,
  STATS_SCHEMA_VERSION,
  createEmptyStatsDay,
} from '@/domains/stats/contracts/statsContracts.js';
import { DEFAULT_RULES_MODE } from '@/domains/settings/config/siteRules.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'protected-core-30d',
    days: 30,
    blockedCount: 12,
    allowedCount: 4,
    unmanagedCount: 12,
    baseMinutes: 12,
    minuteSpread: 24,
    hoursPerDomain: 2,
    activeStride: 2,
    cycleDays: 7,
  }),
  Object.freeze({
    id: 'sites-pro-mixed-30d',
    days: 30,
    blockedCount: 32,
    allowedCount: 18,
    unmanagedCount: 72,
    baseMinutes: 7,
    minuteSpread: 18,
    hoursPerDomain: 3,
    activeStride: 3,
    cycleDays: 10,
  }),
  Object.freeze({
    id: 'long-baseline-90d',
    days: 90,
    blockedCount: 24,
    allowedCount: 12,
    unmanagedCount: 48,
    baseMinutes: 6,
    minuteSpread: 16,
    hoursPerDomain: 2,
    activeStride: 4,
    cycleDays: 42,
  }),
  Object.freeze({
    id: 'wide-domain-stress-30d',
    days: 30,
    blockedCount: 48,
    allowedCount: 24,
    unmanagedCount: 160,
    baseMinutes: 4,
    minuteSpread: 14,
    hoursPerDomain: 2,
    activeStride: 3,
    cycleDays: 14,
  }),
]);

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getRuntimeMemorySnapshot() {
  if (typeof performance === 'undefined' || !performance.memory) {
    return null;
  }
  return {
    usedJSHeapSize: Number(performance.memory.usedJSHeapSize) || 0,
    totalJSHeapSize: Number(performance.memory.totalJSHeapSize) || 0,
    jsHeapSizeLimit: Number(performance.memory.jsHeapSizeLimit) || 0,
  };
}

function formatDateStr(timestamp) {
  const date = new Date(timestamp);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createHourlyArray() {
  return Array(STATS_HOURLY_BUCKETS).fill(0);
}

function createDomainList(prefix, count) {
  return Array.from({ length: Math.max(0, Math.floor(Number(count) || 0)) }, (_, index) => (
    `${prefix}-${String(index + 1).padStart(3, '0')}.bench.local`
  ));
}

function createRawDomainStats(now, domainIndex) {
  return {
    active: 0,
    background: 0,
    visits: 0,
    hourly: createHourlyArray(),
    hourlyActive: createHourlyArray(),
    hourlyBackground: createHourlyArray(),
    hourlyVisits: createHourlyArray(),
    sessions: {
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
    },
    behavior: {
      revisitWithin2m: domainIndex % 5 === 0 ? 1 : 0,
      revisitWithin5m: domainIndex % 7 === 0 ? 1 : 0,
      revisitWithin10m: domainIndex % 3 === 0 ? 1 : 0,
      switchIns: domainIndex % 4,
      switchOuts: domainIndex % 3,
      feedPressureSignals: domainIndex % 6 === 0 ? 2 : 0,
      hourlyRevisitWithin10m: createHourlyArray(),
      hourlySwitchIns: createHourlyArray(),
      hourlySwitchOuts: createHourlyArray(),
      hourlyFeedPressureSignals: createHourlyArray(),
    },
    interventions: {
      frictionShown: 0,
      continued: 0,
      left: 0,
      hourlyFrictionShown: createHourlyArray(),
      hourlyContinued: createHourlyArray(),
      hourlyLeft: createHourlyArray(),
    },
    navigation: {
      total: 0,
      link: 0,
      typed: 0,
      reload: 0,
      hourlyTotal: createHourlyArray(),
      hourlyLink: createHourlyArray(),
      hourlyTyped: createHourlyArray(),
      hourlyReload: createHourlyArray(),
    },
    collection: {
      firstCapturedAt: now,
      lastCapturedAt: now,
      dataCollectionMode: 'all_sites_minimal',
      precisionInsightsMode: 'protected_only',
    },
    lastTrackedTime: now,
  };
}

function addDomainUsageToDay({
  day,
  domain,
  category,
  domainIndex,
  dayIndex,
  now,
  scenario,
}) {
  const domainStats = createRawDomainStats(now, domainIndex);
  const hoursPerDomain = Math.max(1, Math.floor(Number(scenario.hoursPerDomain) || 1));
  const minuteSpread = Math.max(1, Math.floor(Number(scenario.minuteSpread) || 1));
  let totalActiveMs = 0;
  let totalVisits = 0;

  for (let slot = 0; slot < hoursPerDomain; slot += 1) {
    const hour = (domainIndex * 5 + dayIndex * 3 + slot * 7) % STATS_HOURLY_BUCKETS;
    const activeMs = (
      Math.max(1, Number(scenario.baseMinutes) || 1)
      + ((domainIndex * 7 + dayIndex * 11 + slot * 13) % minuteSpread)
    ) * MINUTE_MS;
    const visits = Math.max(1, Math.round(activeMs / (12 * MINUTE_MS)));
    const sessionCount = Math.max(1, Math.round(visits / 2));

    domainStats.active += activeMs;
    domainStats.visits += visits;
    domainStats.hourly[hour] += activeMs;
    domainStats.hourlyActive[hour] += activeMs;
    domainStats.hourlyVisits[hour] += visits;
    domainStats.sessions.count += sessionCount;
    domainStats.sessions.totalMs += activeMs;
    domainStats.sessions.longCount += activeMs >= 20 * MINUTE_MS ? 1 : 0;
    domainStats.sessions.shortCount += activeMs < 5 * MINUTE_MS ? 1 : 0;
    domainStats.sessions.maxMs = Math.max(domainStats.sessions.maxMs, activeMs);
    domainStats.sessions.hourlyCount[hour] += sessionCount;
    domainStats.sessions.hourlyTotalMs[hour] += activeMs;
    domainStats.sessions.hourlyLongCount[hour] += activeMs >= 20 * MINUTE_MS ? 1 : 0;
    domainStats.sessions.hourlyShortCount[hour] += activeMs < 5 * MINUTE_MS ? 1 : 0;
    domainStats.sessions.hourlyMaxMs[hour] = Math.max(domainStats.sessions.hourlyMaxMs[hour], activeMs);
    domainStats.behavior.hourlyRevisitWithin10m[hour] += domainIndex % 3 === 0 ? 1 : 0;
    domainStats.behavior.hourlySwitchIns[hour] += domainIndex % 4;
    domainStats.behavior.hourlySwitchOuts[hour] += domainIndex % 3;
    domainStats.behavior.hourlyFeedPressureSignals[hour] += domainIndex % 6 === 0 ? 1 : 0;
    domainStats.navigation.total += visits;
    domainStats.navigation.link += Math.max(0, visits - 1);
    domainStats.navigation.typed += 1;
    domainStats.navigation.hourlyTotal[hour] += visits;
    domainStats.navigation.hourlyLink[hour] += Math.max(0, visits - 1);
    domainStats.navigation.hourlyTyped[hour] += 1;

    if (category === 'blocked') {
      domainStats.interventions.frictionShown += 1;
      domainStats.interventions.continued += domainIndex % 2 === 0 ? 1 : 0;
      domainStats.interventions.left += domainIndex % 2 === 1 ? 1 : 0;
      domainStats.interventions.hourlyFrictionShown[hour] += 1;
      domainStats.interventions.hourlyContinued[hour] += domainIndex % 2 === 0 ? 1 : 0;
      domainStats.interventions.hourlyLeft[hour] += domainIndex % 2 === 1 ? 1 : 0;
    }

    day.hourlyRollup.active[hour] += activeMs;
    day.hourlyRollup.sessions.count[hour] += sessionCount;
    day.hourlyRollup.sessions.totalMs[hour] += activeMs;
    if (day.hourlyRollup.byCategory?.[category]) {
      day.hourlyRollup.byCategory[category].active[hour] += activeMs;
    }
    totalActiveMs += activeMs;
    totalVisits += visits;
  }

  day.domains[domain] = domainStats;
  day.totals.totalActive += totalActiveMs;
  if (category === 'blocked') day.totals.blockedActive += totalActiveMs;
  if (day.byCategory?.[category]) day.byCategory[category].active += totalActiveMs;
  day.sessions.count += domainStats.sessions.count;
  day.sessions.totalMs += domainStats.sessions.totalMs;
  day.switches.toBlocked += category === 'blocked' ? Math.max(0, Math.floor(totalVisits / 2)) : 0;
  day.switches.toAllowed += category === 'allowed' ? Math.max(0, Math.floor(totalVisits / 2)) : 0;
  day.switches.toUnmanaged += category === 'other' ? Math.max(0, Math.floor(totalVisits / 2)) : 0;
}

function shouldActivateDomain({ domainIndex, dayIndex, category, scenario }) {
  if (category === 'blocked') return true;
  const stride = Math.max(1, Math.floor(Number(scenario.activeStride) || 1));
  return (domainIndex + dayIndex) % stride === 0;
}

function buildSyntheticStatsRange(scenario, now) {
  const blockedDomains = createDomainList('blocked', scenario.blockedCount);
  const allowedDomains = createDomainList('allowed', scenario.allowedCount);
  const unmanagedDomains = createDomainList('open', scenario.unmanagedCount);
  const domainEntries = [
    ...blockedDomains.map((domain) => ({ domain, category: 'blocked' })),
    ...allowedDomains.map((domain) => ({ domain, category: 'allowed' })),
    ...unmanagedDomains.map((domain) => ({ domain, category: 'other' })),
  ];
  const dates = {};
  const domainDayTouches = new Set();
  let activeDomainHourTuples = 0;
  let totalActiveMs = 0;

  for (let dayOffset = scenario.days - 1; dayOffset >= 0; dayOffset -= 1) {
    const dayIndex = scenario.days - 1 - dayOffset;
    const dateStr = formatDateStr(now - (dayOffset * DAY_MS));
    const day = createEmptyStatsDay();
    day.schemaVersion = STATS_SCHEMA_VERSION;

    domainEntries.forEach((entry, domainIndex) => {
      if (!shouldActivateDomain({
        domainIndex,
        dayIndex,
        category: entry.category,
        scenario,
      })) {
        return;
      }
      addDomainUsageToDay({
        day,
        domain: entry.domain,
        category: entry.category,
        domainIndex,
        dayIndex,
        now,
        scenario,
      });
      domainDayTouches.add(`${dateStr}|${entry.domain}`);
      activeDomainHourTuples += Math.max(1, Math.floor(Number(scenario.hoursPerDomain) || 1));
      totalActiveMs += day.domains[entry.domain]?.active || 0;
    });

    dates[dateStr] = day;
  }

  return {
    statsRange: {
      dates,
      readModel: {
        basis: STATS_FACTS_READ_BASIS.DURABLE_HOURLY_AND_DAILY,
        runtimeOverlay: STATS_FACTS_RUNTIME_OVERLAY.DISABLED,
        spanDays: scenario.days,
        generatedAtEpochMs: now,
      },
    },
    policyInput: {
      blockedUrls: blockedDomains,
      allowedUrls: allowedDomains,
      trackingExcludedUrls: [],
      siteGoals: Object.fromEntries(blockedDomains.map((domain, index) => [
        domain,
        15 + (index % 6) * 5,
      ])),
      globalGoal: 120,
      filteringMode: 'blocklist',
      rulesMode: DEFAULT_RULES_MODE,
    },
    metadata: {
      days: scenario.days,
      totalDomains: domainEntries.length,
      blockedDomains: blockedDomains.length,
      allowedDomains: allowedDomains.length,
      unmanagedDomains: unmanagedDomains.length,
      activeDomainDays: domainDayTouches.size,
      estimatedCurrentHourlyRows: scenario.days * STATS_HOURLY_BUCKETS,
      estimatedPerDomainHourlyRows: activeDomainHourTuples,
      totalActiveMs,
    },
  };
}

function sliceStatsRangeByDaysBack(statsRange, daysBack) {
  const dates = statsRange?.dates && typeof statsRange.dates === 'object'
    ? statsRange.dates
    : {};
  const sortedDates = Object.keys(dates).sort();
  const requestedDays = Math.max(1, Math.floor(Number(daysBack) || sortedDates.length || 1));
  const selectedDates = sortedDates.slice(-Math.min(requestedDays, sortedDates.length));

  return {
    ...statsRange,
    dates: Object.fromEntries(selectedDates.map((dateStr) => [dateStr, dates[dateStr]])),
    readModel: {
      ...(statsRange?.readModel || {}),
      requestedDaysBack: requestedDays,
      spanDays: selectedDates.length,
    },
  };
}

function countActiveDomainHours(domainStats) {
  const hourly = Array.isArray(domainStats?.hourlyActive)
    ? domainStats.hourlyActive
    : domainStats?.hourly;
  if (!Array.isArray(hourly)) return 0;
  return hourly.reduce((count, value) => count + (Number(value) > 0 ? 1 : 0), 0);
}

function summarizeReturnedStatsRange({
  statsRange,
  policyInput,
  scenario,
  requestedDaysBack,
  generatedDays,
}) {
  const dates = statsRange?.dates && typeof statsRange.dates === 'object'
    ? statsRange.dates
    : {};
  const blockedSet = new Set(policyInput?.blockedUrls || []);
  const allowedSet = new Set(policyInput?.allowedUrls || []);
  const activeDomains = new Set();
  let activeDomainDays = 0;
  let estimatedPerDomainHourlyRows = 0;
  let totalActiveMs = 0;

  Object.values(dates).forEach((day) => {
    const dayDomains = day?.domains && typeof day.domains === 'object'
      ? day.domains
      : {};
    activeDomainDays += Object.keys(dayDomains).length;
    Object.entries(dayDomains).forEach(([domain, domainStats]) => {
      activeDomains.add(domain);
      estimatedPerDomainHourlyRows += countActiveDomainHours(domainStats);
    });
    const totalActive = Number(day?.totals?.totalActive);
    if (Number.isFinite(totalActive)) {
      totalActiveMs += totalActive;
    }
  });

  const blockedDomains = [...activeDomains].filter((domain) => blockedSet.has(domain)).length;
  const allowedDomains = [...activeDomains].filter((domain) => allowedSet.has(domain)).length;
  const unmanagedDomains = Math.max(0, activeDomains.size - blockedDomains - allowedDomains);
  const returnedDays = Object.keys(dates).length;

  return {
    days: returnedDays,
    generatedDays,
    requestedDaysBack,
    configuredTotalDomains: (
      Math.max(0, Math.floor(Number(scenario.blockedCount) || 0))
      + Math.max(0, Math.floor(Number(scenario.allowedCount) || 0))
      + Math.max(0, Math.floor(Number(scenario.unmanagedCount) || 0))
    ),
    activeUniqueDomains: activeDomains.size,
    blockedDomains,
    allowedDomains,
    unmanagedDomains,
    activeDomainDays,
    estimatedCurrentHourlyRows: returnedDays * STATS_HOURLY_BUCKETS,
    estimatedPerDomainHourlyRows,
    totalActiveMs,
  };
}

function summarizeSnapshot(snapshot) {
  const sitesSnapshot = snapshot?.sitesSnapshot || {};
  const siteIntelBuildState = sitesSnapshot.siteIntelBuildState || null;
  return {
    available: sitesSnapshot.available === true,
    siteDetailsCount: Object.keys(sitesSnapshot.siteDetails || {}).length,
    siteIntelsCount: Object.keys(sitesSnapshot.siteIntels || {}).length,
    siteIntelFullDetailCount: Number(siteIntelBuildState?.fullDetailCount) || 0,
    siteIntelSummaryDetailCount: Number(siteIntelBuildState?.summaryDetailCount) || 0,
    siteIntelDeferredDetailCount: Number(siteIntelBuildState?.deferredDetailCount) || 0,
    siteIntelFullDetailBudget: Number(siteIntelBuildState?.fullDetailBudget) || Number(siteIntelBuildState?.detailLimit) || null,
    siteIntelMandatoryFullDetailCount: Number(siteIntelBuildState?.mandatoryFullDetailCount) || 0,
    siteIntelBudgetedFullDetailCount: Number(siteIntelBuildState?.budgetedFullDetailCount) || 0,
    siteIntelDetailLimit: Number(siteIntelBuildState?.detailLimit) || null,
    siteIntelDetailStrategy: siteIntelBuildState?.strategy || null,
    domainCandidatesCount: Array.isArray(sitesSnapshot.domainCandidates)
      ? sitesSnapshot.domainCandidates.length
      : 0,
    scoreSetupReadyCount: Array.isArray(sitesSnapshot.scoreSetup?.recommendations?.ready)
      ? sitesSnapshot.scoreSetup.recommendations.ready.length
      : 0,
    totalExposureMs: Number(sitesSnapshot.totalExposure) || 0,
    siteDetailsBasis: sitesSnapshot.siteDetailsBasis || null,
    totalExposureBasis: sitesSnapshot.totalExposureBasis || null,
    siteExposureReadModel: sitesSnapshot.siteExposureReadModel || null,
    siteIntelBuildState,
  };
}

function classifyDuration(durationMs) {
  if (durationMs >= 1000) return 'high';
  if (durationMs >= 250) return 'watch';
  return 'ok';
}

async function yieldToBrowser() {
  await new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function runScenario(scenario, now) {
  await yieldToBrowser();
  const memoryBefore = getRuntimeMemorySnapshot();
  const generatedAt = nowMs();
  const synthetic = buildSyntheticStatsRange(scenario, now);
  const generatedMs = nowMs() - generatedAt;
  let requestedDaysBack = null;
  let returnedInputSummary = null;
  const returnedStatsRangesByDaysBack = new Map();
  const service = createStatsAnalysisQueryService({
    getStatsFactsRange: async ({ daysBack } = {}) => {
      requestedDaysBack = daysBack;
      const rangeKey = String(Math.max(1, Math.floor(Number(daysBack) || scenario.days || 1)));
      if (!returnedStatsRangesByDaysBack.has(rangeKey)) {
        returnedStatsRangesByDaysBack.set(rangeKey, sliceStatsRangeByDaysBack(synthetic.statsRange, daysBack));
      }
      const returnedStatsRange = returnedStatsRangesByDaysBack.get(rangeKey);
      returnedInputSummary = summarizeReturnedStatsRange({
        statsRange: returnedStatsRange,
        policyInput: synthetic.policyInput,
        scenario,
        requestedDaysBack,
        generatedDays: synthetic.metadata.days,
      });
      return returnedStatsRange;
    },
    getInterventionEffectsRange: async () => [],
    getCycleState: () => ({
      currentCycleStart: now - Math.max(1, Number(scenario.cycleDays) || 1) * DAY_MS,
      resetPolicy: {
        effectiveResetHour: 4,
      },
    }),
    getSettingsSnapshot: () => ({
      ...synthetic.policyInput,
      insightsMode: 'precision',
    }),
    maxDaysStored: 90,
  });

  const computedAt = nowMs();
  const snapshot = await service.getSitesSnapshot({
    policyInput: synthetic.policyInput,
  });
  const computeMs = nowMs() - computedAt;
  const cachedRepeatAt = nowMs();
  const cachedSnapshot = await service.getSitesSnapshot({
    policyInput: synthetic.policyInput,
  });
  const cachedRepeatMs = nowMs() - cachedRepeatAt;
  const memoryAfter = getRuntimeMemorySnapshot();
  const totalMs = generatedMs + computeMs + cachedRepeatMs;

  return {
    id: scenario.id,
    input: {
      ...(returnedInputSummary || synthetic.metadata),
      requestedDaysBack,
      cycleDays: scenario.cycleDays,
      hoursPerDomain: scenario.hoursPerDomain,
      activeStride: scenario.activeStride,
    },
    timingsMs: {
      generate: Number(generatedMs.toFixed(2)),
      computeSitesSnapshot: Number(computeMs.toFixed(2)),
      cachedRepeatSitesSnapshot: Number(cachedRepeatMs.toFixed(2)),
      total: Number(totalMs.toFixed(2)),
    },
    cache: {
      expectedRepeatHit: cachedSnapshot === snapshot,
      repeatedFactsRangeObjects: returnedStatsRangesByDaysBack.size,
    },
    durationClass: classifyDuration(computeMs),
    memory: memoryBefore && memoryAfter ? {
      before: memoryBefore,
      after: memoryAfter,
      usedDeltaBytes: memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize,
    } : null,
    output: summarizeSnapshot(snapshot),
  };
}

function buildReport(results, now) {
  const generatedAt = new Date(now).toISOString();
  return {
    reportType: 'entropy.sites_snapshot.synthetic_benchmark',
    reportVersion: 5,
    generatedAt,
    source: 'experiment_tab',
    readPath: 'getSitesSnapshot -> getStatsFactsRange(daysBack) -> buildSitesSnapshot',
    storageMutation: false,
    readModelContract: {
      factsBasis: STATS_FACTS_READ_BASIS.DURABLE_HOURLY_AND_DAILY,
      runtimeOverlay: STATS_FACTS_RUNTIME_OVERLAY.DISABLED,
      scenarioDataSource: 'synthetic_activity_day_projection',
      transitionEdgesSource: 'synthetic_empty_transition_edges',
      interventionEffectsSource: 'synthetic_empty_intervention_effects',
      syntheticProvider: 'days_back_sliced',
    },
    schemaDecisionSignals: {
      currentHourlyRowsField: 'results[].input.estimatedCurrentHourlyRows',
      perDomainHourlyRowsField: 'results[].input.estimatedPerDomainHourlyRows',
      computeLatencyField: 'results[].timingsMs.computeSitesSnapshot',
      cachedRepeatLatencyField: 'results[].timingsMs.cachedRepeatSitesSnapshot',
      memoryDeltaField: 'results[].memory.usedDeltaBytes',
      outputCoverageFields: [
        'results[].output.siteDetailsCount',
        'results[].output.siteIntelsCount',
        'results[].output.siteIntelFullDetailCount',
        'results[].output.siteIntelDeferredDetailCount',
        'results[].output.siteIntelMandatoryFullDetailCount',
        'results[].output.siteIntelBudgetedFullDetailCount',
        'results[].output.domainCandidatesCount',
      ],
    },
    scenarioCount: results.length,
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      language: typeof navigator !== 'undefined' ? navigator.language : null,
      memory: getRuntimeMemorySnapshot(),
    },
    summary: {
      slowestScenarioId: results.slice().sort((left, right) => (
        right.timingsMs.computeSitesSnapshot - left.timingsMs.computeSitesSnapshot
      ))[0]?.id || null,
      totalComputeMs: Number(results.reduce(
        (acc, result) => acc + Number(result.timingsMs.computeSitesSnapshot || 0),
        0,
      ).toFixed(2)),
      highCount: results.filter((result) => result.durationClass === 'high').length,
      watchCount: results.filter((result) => result.durationClass === 'watch').length,
    },
    results,
  };
}

function formatMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(numeric >= 100 ? 0 : 1)}ms`;
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return new Intl.NumberFormat().format(Math.round(numeric));
}

function getToneClass(durationClass) {
  if (durationClass === 'high') return 'border-rose-400/30 bg-rose-400/10 text-rose-100';
  if (durationClass === 'watch') return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
  return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';
}

function getScenarioLabel(t, scenarioId) {
  switch (scenarioId) {
    case 'protected-core-30d':
      return t('experiment.sites_benchmark.scenarios.protected-core-30d');
    case 'sites-pro-mixed-30d':
      return t('experiment.sites_benchmark.scenarios.sites-pro-mixed-30d');
    case 'long-baseline-90d':
      return t('experiment.sites_benchmark.scenarios.long-baseline-90d');
    case 'wide-domain-stress-30d':
      return t('experiment.sites_benchmark.scenarios.wide-domain-stress-30d');
    default:
      return scenarioId;
  }
}

export default function StatsSitesBenchmarkLab() {
  const { t } = useAppTranslation('tools');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [feedback, setFeedback] = useState('');

  const reportText = useMemo(() => (
    report ? JSON.stringify(report, null, 2) : ''
  ), [report]);

  const runBenchmarks = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setFeedback('');
    try {
      const now = Date.now();
      const results = [];
      for (const scenario of SCENARIOS) {
        results.push(await runScenario(scenario, now));
      }
      setReport(buildReport(results, now));
      setFeedback(t('experiment.sites_benchmark.run_done', { count: results.length }));
    } catch (error) {
      setFeedback(t('experiment.sites_benchmark.run_failed', {
        message: error?.message || String(error),
      }));
    } finally {
      setRunning(false);
    }
  }, [running, t]);

  const copyReport = useCallback(async () => {
    if (!reportText) {
      setFeedback(t('experiment.sites_benchmark.copy_empty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(reportText);
      setFeedback(t('experiment.sites_benchmark.copy_done'));
    } catch (error) {
      setFeedback(t('experiment.sites_benchmark.copy_failed'));
    }
  }, [reportText, t]);

  const clearReport = useCallback(() => {
    setReport(null);
    setFeedback('');
  }, []);

  const results = Array.isArray(report?.results) ? report.results : [];
  const summary = report?.summary || null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
              {t('experiment.sites_benchmark.eyebrow')}
            </p>
            <p className="text-sm font-bold text-on-surface">
              {t('experiment.sites_benchmark.title')}
            </p>
            <p className="mt-1 max-w-3xl text-[11px] leading-snug text-on-surface-muted">
              {t('experiment.sites_benchmark.desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={runBenchmarks}
            disabled={running}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[10px] font-semibold text-on-accent transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? t('experiment.sites_benchmark.running') : t('experiment.sites_benchmark.run')}
          </button>
          <button
            type="button"
            onClick={copyReport}
            disabled={!reportText || running}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Clipboard className="h-3.5 w-3.5" />
            {t('experiment.sites_benchmark.copy')}
          </button>
          <button
            type="button"
            onClick={clearReport}
            disabled={!report && !feedback}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('experiment.sites_benchmark.clear')}
          </button>
        </div>
        {feedback ? (
          <p className="mt-2 text-[10px] text-on-surface-muted">
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="grid shrink-0 gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.sites_benchmark.summary_total')}
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-on-surface">
            {summary ? formatMs(summary.totalComputeMs) : '--'}
          </div>
        </div>
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.sites_benchmark.summary_slowest')}
          </div>
          <div className="mt-1 truncate text-sm font-bold text-on-surface">
            {summary?.slowestScenarioId || '--'}
          </div>
        </div>
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.sites_benchmark.summary_flags')}
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-on-surface">
            {summary ? `${summary.watchCount}/${summary.highCount}` : '--'}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-on-surface/10 bg-surface/75 p-3">
        {results.length > 0 ? (
          <div className="grid gap-2 xl:grid-cols-2">
            {results.map((result) => (
              <div
                key={result.id}
                className="rounded-lg border border-on-surface/10 bg-surface-sunken/35 p-3"
              >
                <div className="flex items-start gap-2">
                  <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-on-surface">
                      {getScenarioLabel(t, result.id)}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-on-surface-muted sm:grid-cols-4">
                      <span>{t('experiment.sites_benchmark.metric_days')}: {formatCount(result.input.days)}</span>
                      <span>{t('experiment.sites_benchmark.metric_domains')}: {formatCount(result.input.configuredTotalDomains)}</span>
                      <span>{t('experiment.sites_benchmark.metric_intels')}: {formatCount(result.output.siteIntelFullDetailCount)} / {formatCount(result.output.siteIntelsCount)}</span>
                      <span>{t('experiment.sites_benchmark.metric_candidates')}: {formatCount(result.output.domainCandidatesCount)}</span>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${getToneClass(result.durationClass)}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {formatMs(result.timingsMs.computeSitesSnapshot)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-md bg-surface/55 px-2 py-1">
                    <div className="text-[9px] uppercase text-on-surface-muted">{t('experiment.sites_benchmark.metric_generate')}</div>
                    <div className="font-semibold tabular-nums text-on-surface">{formatMs(result.timingsMs.generate)}</div>
                  </div>
                  <div className="rounded-md bg-surface/55 px-2 py-1">
                    <div className="text-[9px] uppercase text-on-surface-muted">{t('experiment.sites_benchmark.metric_compute')}</div>
                    <div className="font-semibold tabular-nums text-on-surface">{formatMs(result.timingsMs.computeSitesSnapshot)}</div>
                  </div>
                  <div className="rounded-md bg-surface/55 px-2 py-1">
                    <div className="text-[9px] uppercase text-on-surface-muted">{t('experiment.sites_benchmark.metric_rows')}</div>
                    <div className="font-semibold tabular-nums text-on-surface">{formatCount(result.input.estimatedCurrentHourlyRows)} / {formatCount(result.input.estimatedPerDomainHourlyRows)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center text-center text-xs text-on-surface-muted">
            {running ? t('experiment.sites_benchmark.running_detail') : t('experiment.sites_benchmark.empty')}
          </div>
        )}
      </div>

      {reportText ? (
        <pre className="max-h-44 shrink-0 overflow-auto rounded-lg border border-on-surface/10 bg-surface-sunken/60 p-3 text-[10px] leading-relaxed text-on-surface-muted">
          {reportText}
        </pre>
      ) : null}
    </div>
  );
}
