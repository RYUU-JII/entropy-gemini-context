import {
  clamp01,
  countVisitHours,
  ratioNorm,
  smooth01,
  toCount,
  toNumber,
} from '../sitePullMath.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import {
  SITE_PULL_AGGREGATE_COST_CLASSES,
  SITE_PULL_AGGREGATE_PATTERN_SCOPES,
  SITE_PULL_AGGREGATE_PLAN_STATUSES,
  buildSitePullAggregatePatternPlan,
} from './sitePullAggregatePatternSpec.js';

export const SITE_PULL_AGGREGATE_ANALYSIS_VERSION = 'site-pull-aggregate-analysis-v1';
export const SITE_PULL_PROTECTED_CHECKING_PRESSURE_VERSION =
  'site-pull-protected-checking-pressure-v1';

export const SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES = Object.freeze({
  DISABLED: 'disabled',
  INSUFFICIENT_DATA: 'insufficient_data',
  OBSERVED: 'observed',
  ELEVATED: 'elevated',
  STRONG: 'strong',
});

const PROTECTED_CHECKING_PATTERN_ID = 'protected_checking_pressure';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function compactNumber(value) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(4)) : 0;
}

function compactScore(value) {
  return Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
}

function compactIdList(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function createAggregateInputError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function resolveAggregateSitePullFacts(domain, intel = {}) {
  const facts = intel?.sitePullFacts;
  if (facts === null || facts === undefined) return null;
  if (!isPlainObject(facts) || typeof facts.version !== 'string' || facts.version.length === 0) {
    throw createAggregateInputError('SITE_PULL_AGGREGATE_FACTS_INVALID', { domain });
  }
  return facts;
}

function normalizeProtectedDomains(protectedDomains = []) {
  return compactIdList(asArray(protectedDomains)
    .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
    .filter(Boolean));
}

function sum24h(left = [], right = []) {
  return Array.from({ length: 24 }, (_, hour) => (
    toCount(left?.[hour]) + toCount(right?.[hour])
  ));
}

function hasPersonalBaseline(facts = {}) {
  return facts?.dataCoverage?.hasPersonalBaselineFacts === true;
}

function compactDomainCheckingRow(domain, intel = {}) {
  const facts = resolveAggregateSitePullFacts(domain, intel);
  const entryVisitSummary = resolveSitePullEntryVisitSummary({ facts });
  const behavior = facts?.behavior || {};
  const temporal = facts?.temporalEvidence || {};
  const todayVisits = entryVisitSummary.todayVisits;
  const weeklyVisits = Math.max(entryVisitSummary.weeklyVisits, todayVisits);
  const todayHourlyVisits = asArray(entryVisitSummary.todayHourlyVisits).length === 24
    ? entryVisitSummary.todayHourlyVisits.map(toCount)
    : Array(24).fill(0);
  const visitHourCount = entryVisitSummary.visitHoursToday;
  const switchIns = toCount(behavior.switchIns);
  const switchOuts = toCount(behavior.switchOuts);
  const switchBackWithin10m = toCount(behavior.switchBackWithin10m);
  const revisitWithin10m = toCount(behavior.revisitWithin10m);
  const quickReturnEvents = Math.max(switchBackWithin10m, revisitWithin10m);
  const switchChurn = switchIns + switchOuts;
  const activeMs = toNumber(facts?.usage?.todayTotalMs);
  const checkingScore = Math.max(
    smooth01(todayVisits, 4, 12) * 0.3,
    0,
  )
    + (ratioNorm(quickReturnEvents / Math.max(todayVisits, 1), 0.12, 0.55) * 0.3)
    + (ratioNorm(switchChurn / Math.max(todayVisits, 1), 0.6, 2.4) * 0.25)
    + (smooth01(visitHourCount, 2, 6) * 0.15);

  return {
    domain,
    hasFacts: !!facts?.version,
    hasEntryFacts: entryVisitSummary.hasVisitFacts,
    hasBehaviorFacts: behavior.hasBehaviorFacts === true,
    hasPersonalBaseline: hasPersonalBaseline(facts),
    activeMs,
    todayVisits,
    weeklyVisits,
    todayHourlyVisits,
    visitHourCount,
    revisitWithin10m,
    switchIns,
    switchOuts,
    switchBackWithin10m,
    switchChurn,
    quickReturnEvents,
    quickReturnRate: compactNumber(quickReturnEvents / Math.max(todayVisits, 1)),
    switchChurnPerVisit: compactNumber(switchChurn / Math.max(todayVisits, 1)),
    checkingScore: compactNumber(clamp01(checkingScore)),
    visiblePatternIds: [],
    badgeIds: [],
    reentryIntervalProfile: temporal?.metrics?.reentryIntervalProfile || null,
  };
}

function buildAggregateDataFamilyDiagnostics(rows = []) {
  const hasAnyProtected = rows.length > 0;
  const hasAnyActivity = rows.some((row) => row.activeMs > 0 || row.todayVisits > 0 || row.weeklyVisits > 0);
  const entryRows = rows.filter((row) => row.hasEntryFacts);
  const behaviorRows = rows.filter((row) => row.hasBehaviorFacts);
  const baselineRows = rows.filter((row) => row.hasPersonalBaseline);
  const weeklyRows = rows.filter((row) => row.weeklyVisits > 0 || row.activeMs > 0);
  const noProtectedReason = hasAnyProtected ? null : 'protected domains unavailable';
  const noActivityReason = hasAnyActivity ? null : 'protected activity unavailable';

  return [
    {
      family: 'usage',
      status: hasAnyActivity ? 'available' : 'not_applicable',
      reason: noActivityReason || 'protected usage available',
    },
    {
      family: 'entry',
      status: entryRows.length > 0 ? 'available' : hasAnyProtected ? 'unavailable' : 'not_applicable',
      reason: entryRows.length > 0 ? 'protected entry facts available' : noProtectedReason || 'protected entry facts unavailable',
    },
    {
      family: 'behavior',
      status: behaviorRows.length > 0 ? 'available' : hasAnyProtected ? 'unavailable' : 'not_applicable',
      reason: behaviorRows.length > 0 ? 'protected behavior facts available' : noProtectedReason || 'protected behavior facts unavailable',
      permissionKey: 'contentBehavior',
      permissionGranted: behaviorRows.length > 0,
    },
    {
      family: 'weekly',
      status: weeklyRows.length > 0 ? 'available' : hasAnyProtected ? 'unavailable' : 'not_applicable',
      reason: weeklyRows.length > 0 ? 'protected weekly context available' : noProtectedReason || 'protected weekly context unavailable',
    },
    {
      family: 'personal_baseline',
      status: baselineRows.length > 0 ? 'available' : hasAnyProtected ? 'unavailable' : 'not_applicable',
      reason: baselineRows.length > 0 ? 'protected personal baselines available' : noProtectedReason || 'protected personal baselines sparse',
    },
  ];
}

function resolveProtectedCheckingStatus({ planCandidate, score, rows }) {
  if (!planCandidate || planCandidate.executionStatus !== 'ready') {
    return SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.DISABLED;
  }
  const hasBehaviorRows = rows.some((row) => row.hasBehaviorFacts);
  const totalVisits = rows.reduce((sum, row) => sum + row.todayVisits, 0);
  if (!hasBehaviorRows || totalVisits < 3) {
    return SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.INSUFFICIENT_DATA;
  }
  if (score >= 78) return SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.STRONG;
  if (score >= 58) return SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.ELEVATED;
  return SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.OBSERVED;
}

function buildProtectedCheckingPressure({ plan, protectedRows }) {
  const candidate = asArray(plan?.candidates)
    .find((entry) => entry?.id === PROTECTED_CHECKING_PATTERN_ID) || null;
  const activeRows = protectedRows.filter((row) => row.activeMs > 0 || row.todayVisits > 0 || row.weeklyVisits > 0);
  const behaviorRows = activeRows.filter((row) => row.hasBehaviorFacts);
  const todayHourlyVisits = activeRows.reduce(
    (sum, row) => sum24h(sum, row.todayHourlyVisits),
    Array(24).fill(0),
  );
  const todayVisits = activeRows.reduce((sum, row) => sum + row.todayVisits, 0);
  const weeklyVisits = activeRows.reduce((sum, row) => sum + row.weeklyVisits, 0);
  const activeMs = activeRows.reduce((sum, row) => sum + row.activeMs, 0);
  const revisitWithin10m = activeRows.reduce((sum, row) => sum + row.revisitWithin10m, 0);
  const switchIns = activeRows.reduce((sum, row) => sum + row.switchIns, 0);
  const switchOuts = activeRows.reduce((sum, row) => sum + row.switchOuts, 0);
  const switchBackWithin10m = activeRows.reduce((sum, row) => sum + row.switchBackWithin10m, 0);
  const switchChurn = switchIns + switchOuts;
  const quickReturnEvents = Math.max(revisitWithin10m, switchBackWithin10m);
  const visitHourCount = countVisitHours(todayHourlyVisits);
  const domainBreadth = activeRows.filter((row) => row.todayVisits > 0).length;
  const scoringDomainCount = Math.max(domainBreadth, activeRows.length, 1);
  const topDomains = activeRows
    .map((row) => ({
      domain: row.domain,
      activeMs: compactNumber(row.activeMs),
      todayVisits: row.todayVisits,
      weeklyVisits: row.weeklyVisits,
      visitHourCount: row.visitHourCount,
      revisitWithin10m: row.revisitWithin10m,
      switchChurn: row.switchChurn,
      switchBackWithin10m: row.switchBackWithin10m,
      checkingScore: row.checkingScore,
      badgeIds: row.badgeIds,
    }))
    .sort((left, right) => (
      right.checkingScore - left.checkingScore
      || right.todayVisits - left.todayVisits
      || right.activeMs - left.activeMs
      || left.domain.localeCompare(right.domain)
    ))
    .slice(0, 5);
  const channelScores = {
    visitPressure: smooth01(todayVisits, 5, 18),
    quickReturnPressure: ratioNorm(quickReturnEvents / Math.max(todayVisits, 1), 0.12, 0.5)
      * smooth01(quickReturnEvents, 1, 6),
    switchChurnPressure: ratioNorm(switchChurn / Math.max(todayVisits, 1), 0.75, 2.5)
      * smooth01(switchChurn, 4, 24),
    spreadPressure: smooth01(visitHourCount, 2, 7),
    domainBreadth: smooth01(domainBreadth, 1, 4),
    domainIntensity: topDomains.reduce((best, row) => Math.max(best, row.checkingScore), 0),
  };
  const score01 = clamp01(
    (channelScores.visitPressure * 0.22)
    + (channelScores.quickReturnPressure * 0.24)
    + (channelScores.switchChurnPressure * 0.22)
    + (channelScores.spreadPressure * 0.14)
    + (channelScores.domainBreadth * 0.1)
    + (channelScores.domainIntensity * 0.08),
  );
  const baselineSupport = activeRows.length > 0
    ? activeRows.filter((row) => row.hasPersonalBaseline).length / activeRows.length
    : 0;
  const behaviorCoverage = activeRows.length > 0 ? behaviorRows.length / activeRows.length : 0;
  const confidence = clamp01(
    0.28
    + (behaviorCoverage * 0.32)
    + (smooth01(todayVisits, 3, 12) * 0.14)
    + (smooth01(visitHourCount, 1, 5) * 0.1)
    + (baselineSupport * 0.08)
    + (candidate?.limitedByBaselineData ? 0 : 0.08),
  );
  const score = compactScore(score01 * 100);
  const caveats = [
    candidate?.limitedByBaselineData ? 'personal_or_weekly_baseline_limited' : null,
    behaviorCoverage < 1 ? 'some_protected_domains_lack_behavior_facts' : null,
    activeRows.length <= 1 ? 'single_protected_domain_dominates_aggregate' : null,
  ].filter(Boolean);

  return {
    id: PROTECTED_CHECKING_PATTERN_ID,
    version: SITE_PULL_PROTECTED_CHECKING_PRESSURE_VERSION,
    status: resolveProtectedCheckingStatus({ planCandidate: candidate, score, rows: activeRows }),
    scope: SITE_PULL_AGGREGATE_PATTERN_SCOPES.PROTECTED_SET,
    score,
    confidence: compactNumber(confidence),
    recommendationFamily: candidate?.recommendationFamily || 'checking_cooldown',
    outputSurfaces: asArray(candidate?.outputSurfaces),
    evidence: {
      protectedDomainCount: protectedRows.length,
      analyzedDomainCount: activeRows.length,
      behaviorDomainCount: behaviorRows.length,
      activeDomainCount: activeRows.filter((row) => row.activeMs > 0).length,
      todayVisits,
      weeklyVisits,
      todayActiveMs: compactNumber(activeMs),
      visitHourCount,
      revisitWithin10m,
      switchIns,
      switchOuts,
      switchBackWithin10m,
      switchChurn,
      quickReturnEvents,
      quickReturnRate: compactNumber(quickReturnEvents / Math.max(todayVisits, 1)),
      switchChurnPerVisit: compactNumber(switchChurn / Math.max(todayVisits, 1)),
      averageVisitsPerActiveDomain: compactNumber(todayVisits / Math.max(scoringDomainCount, 1)),
      channelScores: Object.fromEntries(
        Object.entries(channelScores).map(([key, value]) => [key, compactNumber(value)]),
      ),
      topDomains,
    },
    caveats,
    planCandidate: candidate ? {
      executionStatus: candidate.executionStatus,
      reason: candidate.reason,
      dataFamilies: candidate.dataFamilies,
      baselineDataFamilies: candidate.baselineDataFamilies,
      missingDataFamilies: candidate.missingDataFamilies,
      missingBaselineDataFamilies: candidate.missingBaselineDataFamilies,
      costClass: candidate.costClass,
    } : null,
  };
}

function buildSummary(results = []) {
  const visibleResults = results.filter((result) => (
    result.status === SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.ELEVATED
    || result.status === SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.STRONG
  ));
  const topResult = [...results].sort((left, right) => (
    toNumber(right.score) - toNumber(left.score)
    || toNumber(right.confidence) - toNumber(left.confidence)
  ))[0] || null;

  return {
    resultCount: results.length,
    visibleResultCount: visibleResults.length,
    visiblePatternIds: visibleResults.map((result) => result.id),
    topPatternId: topResult?.id || null,
    topStatus: topResult?.status || null,
    topScore: topResult ? topResult.score : 0,
  };
}

export function buildSitePullAggregateAnalysis({
  siteIntels = {},
  protectedDomains = [],
  enabled = true,
  requestedPatternIds = [PROTECTED_CHECKING_PATTERN_ID],
  costBudget = SITE_PULL_AGGREGATE_COST_CLASSES.MODERATE,
} = {}) {
  const normalizedProtectedDomains = normalizeProtectedDomains(protectedDomains);
  const protectedRows = normalizedProtectedDomains.map((domain) => (
    compactDomainCheckingRow(domain, siteIntels?.[domain] || {})
  ));
  const dataFamilyDiagnostics = buildAggregateDataFamilyDiagnostics(protectedRows);
  const plan = buildSitePullAggregatePatternPlan({
    enabled,
    requestedPatternIds,
    costBudget,
    dataFamilyDiagnostics,
  });
  const results = [];

  if (
    enabled === true
    && plan.status !== SITE_PULL_AGGREGATE_PLAN_STATUSES.DISABLED
    && asArray(requestedPatternIds).includes(PROTECTED_CHECKING_PATTERN_ID)
  ) {
    results.push(buildProtectedCheckingPressure({ plan, protectedRows }));
  }

  return {
    version: SITE_PULL_AGGREGATE_ANALYSIS_VERSION,
    enabled: enabled === true,
    requestedPatternIds: asArray(requestedPatternIds),
    costBudget,
    plan,
    dataFamilyDiagnostics,
    summary: buildSummary(results),
    patterns: results,
  };
}
