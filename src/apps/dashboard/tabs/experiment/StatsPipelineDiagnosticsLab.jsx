import React, { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Database,
  FileJson,
  Loader2,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  permissionsGetAllStrict,
  runtimeSendMessage,
  tabsGet,
  tabsQuery,
} from '../../../../platform/chrome/ChromeService.js';
import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { readProtocolSettingsSnapshot } from '../../stores/protocolSettingsClient.js';

const ONE_MINUTE_TICK_ALARM_NAME = 'oneMinuteTick';
const IDLE_QUERY_INTERVAL_SECONDS = 60;
const MAX_TAB_SAMPLE_COUNT = 16;
const PREVIEW_MAX_LINES = 96;
const TICK_GAP_WATCH_MS = 2 * 60 * 1000;
const TICK_GAP_FAIL_MS = 10 * 60 * 1000;
const SAVE_LAG_WATCH_MS = 2 * 60 * 1000;
const SAVE_LAG_FAIL_MS = 10 * 60 * 1000;
const FACTS_DIAGNOSTIC_DAYS_BACK = 7;
const TARGET_DOMAIN_DIAGNOSTIC_DAYS_BACK = 3;
const MAX_TARGET_DOMAIN_COUNT = 6;
const FACTS_DIAGNOSTIC_TOP_DOMAIN_COUNT = 12;
const MAX_OBSERVATION_PREVIEW_COUNT = 8;

const BROWSER_SURFACE_ERROR_CODES = Object.freeze({
  ALARMS_GET_ALL_UNAVAILABLE: 'ALARMS_GET_ALL_UNAVAILABLE',
  IDLE_QUERY_STATE_UNAVAILABLE: 'IDLE_QUERY_STATE_UNAVAILABLE',
  WINDOWS_GET_LAST_FOCUSED_UNAVAILABLE: 'WINDOWS_GET_LAST_FOCUSED_UNAVAILABLE',
});

const DIAGNOSTIC_STAGE_STATUS = Object.freeze({
  PASS: 'pass',
  WATCH: 'watch',
  FAIL: 'fail',
});

const DIAGNOSTIC_STAGE_SEVERITY_RANK = Object.freeze({
  pass: 0,
  watch: 1,
  fail: 2,
});

const READ_BOUNDARY_SEQUENCE = Object.freeze([
  'runtime',
  'hourly',
  'repository',
  'facts',
  'read_model',
]);

const SETTINGS_DIAGNOSTIC_DEFAULTS = Object.freeze({
  dataCollectionMode: null,
  precisionInsightsMode: null,
  trackingExcludedUrls: [],
  blockedUrls: [],
  allowedUrls: [],
  siteGoals: {},
  protectionPresetAssignments: {},
});

function getRuntimeLastErrorMessage(extensionApi) {
  try {
    return extensionApi?.runtime?.lastError?.message || '';
  } catch (_error) {
    return '';
  }
}

function createBrowserSurfaceError(code, methodName) {
  return {
    error: code,
    unavailable: true,
    methodName,
  };
}

function getBrowserSurfaceErrorCode(value) {
  if (!value || typeof value !== 'object') return null;
  return typeof value.error === 'string' && value.error
    ? value.error
    : null;
}

function callExtensionCallback(target, methodName, args = [], {
  unavailableCode = `${String(methodName || 'callback').toUpperCase()}_UNAVAILABLE`,
} = {}) {
  const extensionApi = getExtensionApi();
  const method = target?.[methodName];
  if (typeof method !== 'function') {
    return Promise.resolve(createBrowserSurfaceError(unavailableCode, methodName));
  }

  return new Promise((resolve) => {
    try {
      method.call(target, ...args, (value) => {
        const errorMessage = getRuntimeLastErrorMessage(extensionApi);
        resolve(errorMessage ? { error: errorMessage } : value);
      });
    } catch (error) {
      resolve({ error: error?.message || String(error) });
    }
  });
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function toLocalDateStr(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDiagnosticActivityDateStr(nowMs = Date.now(), resetHour = 4) {
  const numericResetHour = Number(resetHour);
  const normalizedResetHour = Number.isFinite(numericResetHour)
    ? Math.min(23, Math.max(0, Math.trunc(numericResetHour)))
    : 4;
  const date = new Date(nowMs);
  if (Number.isNaN(date.getTime())) return toLocalDateStr(Date.now());
  date.setHours(normalizedResetHour, 0, 0, 0);
  if (date.getTime() > nowMs) {
    date.setDate(date.getDate() - 1);
  }
  return toLocalDateStr(date.getTime());
}

function msSince(nowMs, timestamp) {
  const normalizedTimestamp = toTimestamp(timestamp);
  const normalizedNow = toTimestamp(nowMs);
  if (!normalizedTimestamp || !normalizedNow) return null;
  return Math.max(0, normalizedNow - normalizedTimestamp);
}

function isAfter(left, right) {
  const leftTs = toTimestamp(left);
  const rightTs = toTimestamp(right);
  if (!leftTs) return false;
  if (!rightTs) return true;
  return leftTs > rightTs;
}

function normalizeHostname(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_error) {
    return '';
  }
}

function normalizeDiagnosticDomain(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return '';
  const hostname = normalizeHostname(raw);
  if (hostname) return hostname;

  const withoutWildcard = raw.replace(/^\*\./, '');
  const withoutScheme = withoutWildcard.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
  const hostPart = withoutScheme.split(/[/?#]/)[0].split('@').pop() || '';
  const withoutPort = hostPart.replace(/:\d+$/, '');
  return withoutPort.replace(/^www\./, '').trim();
}

function addTargetDomain(targets, domain) {
  const normalized = normalizeDiagnosticDomain(domain);
  if (!normalized) return;
  if (targets.includes(normalized)) return;
  if (targets.length >= MAX_TARGET_DOMAIN_COUNT) return;
  targets.push(normalized);
}

function addTargetDomains(targets, domains = []) {
  (Array.isArray(domains) ? domains : []).forEach((domain) => addTargetDomain(targets, domain));
}

function pickTopDomainKeys(siteDetails = {}, limit = MAX_TARGET_DOMAIN_COUNT) {
  return Object.entries(siteDetails || {})
    .map(([domain, activeMs]) => ({ domain, activeMs: toFiniteNumber(activeMs, 0) }))
    .filter((entry) => entry.domain)
    .sort((left, right) => right.activeMs - left.activeMs)
    .slice(0, limit)
    .map((entry) => entry.domain);
}

function summarizeTab(tab = null) {
  if (!tab || typeof tab !== 'object') return null;
  return {
    id: Number.isFinite(Number(tab.id)) ? Number(tab.id) : null,
    windowId: Number.isFinite(Number(tab.windowId)) ? Number(tab.windowId) : null,
    active: !!tab.active,
    audible: !!tab.audible,
    highlighted: !!tab.highlighted,
    discarded: !!tab.discarded,
    status: typeof tab.status === 'string' ? tab.status : '',
    hasUrl: typeof tab.url === 'string' && tab.url.trim().length > 0,
    hostname: normalizeHostname(tab.url),
    url: typeof tab.url === 'string' ? tab.url : '',
    title: typeof tab.title === 'string' ? tab.title : '',
  };
}

function unwrapStep(step) {
  return step?.ok ? step.value : null;
}

function resolveDiagnosticTargetDomains({
  requestedTarget = '',
  settings = null,
  browser = null,
  runtime = null,
  statusSnapshot = null,
  sitesSnapshot = null,
} = {}) {
  const targets = [];
  addTargetDomain(targets, requestedTarget);
  addTargetDomain(targets, runtime?.activeTabInfo?.hostname);
  addTargetDomain(targets, runtime?.lastTabActivityBatch?.focusedActiveHostname);
  addTargetDomains(targets, runtime?.lastTabActivityBatch?.sampleHostnames);
  addTargetDomains(targets, (browser?.activeTabs || []).map((tab) => tab?.hostname));
  addTargetDomain(targets, browser?.runtimeLastActiveTab?.hostname);
  addTargetDomains(targets, settings?.blockedUrls);
  addTargetDomains(targets, settings?.allowedUrls);
  addTargetDomains(targets, Object.keys(settings?.siteGoals || {}));
  addTargetDomains(targets, pickTopDomainKeys(sitesSnapshot?.siteDetails));
  addTargetDomains(targets, pickTopDomainKeys(statusSnapshot?.currentActivityDay?.siteDetails));
  return targets;
}

async function captureStep(name, run) {
  const startedAt = performance.now();
  try {
    const value = await run();
    return {
      name,
      ok: true,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      value,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      error: error?.message || String(error),
    };
  }
}

async function requestRuntimeAction(action, payload = {}) {
  const response = await runtimeSendMessage({ action, ...payload });
  if (response?.success !== true) {
    const rawError = response?.error;
    const message = typeof rawError === 'string'
      ? rawError
      : rawError?.message || rawError?.code || `${action}_FAILED`;
    throw new Error(message);
  }
  return response;
}

function buildDiagnosticPolicyInput(settings = null) {
  return settings && typeof settings === 'object' ? {
    blockedUrls: settings.blockedUrls,
    allowedUrls: settings.allowedUrls,
    filteringMode: settings.filteringMode,
    globalGoal: settings.globalGoal,
    siteGoals: settings.siteGoals,
    rulesMode: settings.rulesMode,
    trackingExcludedUrls: settings.trackingExcludedUrls,
  } : null;
}

async function requestFactsSummary(settings = null) {
  const policyInput = buildDiagnosticPolicyInput(settings);
  return requestRuntimeAction(MESSAGE_ACTIONS.GET_TREND_SUMMARY, {
    daysBack: FACTS_DIAGNOSTIC_DAYS_BACK,
    groupBy: 'day',
    basis: 'activity',
    filter: {
      includeTopDomains: true,
      topN: FACTS_DIAGNOSTIC_TOP_DOMAIN_COUNT,
    },
    ...(policyInput ? { policyInput } : {}),
  });
}

async function requestTargetDomainSeries(domain, settings = null) {
  const policyInput = buildDiagnosticPolicyInput(settings);
  return requestRuntimeAction(MESSAGE_ACTIONS.GET_DOMAIN_SERIES, {
    domain,
    daysBack: TARGET_DOMAIN_DIAGNOSTIC_DAYS_BACK,
    grain: 'hour',
    basis: 'activity',
    ...(policyInput ? { policyInput } : {}),
  });
}

function readDiagnosticSettingsSnapshot() {
  return readProtocolSettingsSnapshot(SETTINGS_DIAGNOSTIC_DEFAULTS);
}

function getStoreCount(storageInspectorSnapshot, storeName) {
  const stores = storageInspectorSnapshot?.indexedDb?.stores;
  if (!Array.isArray(stores)) return 0;
  const entry = stores.find((store) => store?.storeName === storeName);
  return Math.max(0, Math.floor(toFiniteNumber(entry?.count, 0)));
}

function getStatsHourlyLedger(storageInspectorSnapshot) {
  const ledger = storageInspectorSnapshot?.indexedDb?.statsHourly;
  return ledger && typeof ledger === 'object' ? ledger : null;
}

function getStatsHourlyLedgerDateBucket(ledger = null, dateStr = null) {
  if (!ledger || !dateStr || !Array.isArray(ledger.dateBuckets)) return null;
  return ledger.dateBuckets.find((bucket) => bucket?.dateStr === dateStr) || null;
}

function getStatsHourlyLedgerDomain(ledger = null, domain = null) {
  const normalizedDomain = normalizeDiagnosticDomain(domain);
  if (!ledger || !normalizedDomain || !Array.isArray(ledger.domainTotals)) return null;
  return ledger.domainTotals.find((entry) => normalizeDiagnosticDomain(entry?.domain) === normalizedDomain) || null;
}

function getTrendSummary(response) {
  return response?.trendSummary || null;
}

function getTrendTotals(response) {
  return getTrendSummary(response)?.totals || null;
}

function resolveSitesSnapshot(response) {
  return response?.sitesSnapshot || null;
}

function resolveStatusSnapshot(response) {
  return response?.statusSnapshot || null;
}

function getDomainSeriesResponse(step) {
  return step?.ok ? step.value : null;
}

function getDomainSeries(step) {
  return getDomainSeriesResponse(step)?.domainSeries || null;
}

function getDomainSeriesTotals(step) {
  return getDomainSeries(step)?.totals || null;
}

function hasDomainSeriesUsage(step) {
  const totals = getDomainSeriesTotals(step);
  return toFiniteNumber(totals?.activeMs, 0) > 0
    || toFiniteNumber(totals?.backgroundMs, 0) > 0
    || toFiniteNumber(totals?.totalMs, 0) > 0
    || toFiniteNumber(totals?.visits, 0) > 0;
}

function pickLastNonZeroDomainPoint(step) {
  const points = Array.isArray(getDomainSeries(step)?.points) ? getDomainSeries(step).points : [];
  return [...points].reverse().find((point) => (
    toFiniteNumber(point?.activeMs, 0) > 0
    || toFiniteNumber(point?.backgroundMs, 0) > 0
    || toFiniteNumber(point?.totalMs, 0) > 0
    || toFiniteNumber(point?.visits, 0) > 0
  )) || null;
}

function summarizeDomainSeriesActivityDate(step, activityDateStr) {
  const points = Array.isArray(getDomainSeries(step)?.points) ? getDomainSeries(step).points : [];
  const matchingPoints = points.filter((point) => (
    activityDateStr
    && (point?.activityDateStr || point?.dateStr || null) === activityDateStr
  ));
  const totals = matchingPoints.reduce((accumulator, point) => ({
    activeMs: accumulator.activeMs + toFiniteNumber(point?.activeMs, 0),
    backgroundMs: accumulator.backgroundMs + toFiniteNumber(point?.backgroundMs, 0),
    totalMs: accumulator.totalMs + toFiniteNumber(point?.totalMs, 0),
    visits: accumulator.visits + toFiniteNumber(point?.visits, 0),
  }), {
    activeMs: 0,
    backgroundMs: 0,
    totalMs: 0,
    visits: 0,
  });
  const nonZeroPoints = matchingPoints.filter((point) => (
    toFiniteNumber(point?.activeMs, 0) > 0
    || toFiniteNumber(point?.backgroundMs, 0) > 0
    || toFiniteNumber(point?.totalMs, 0) > 0
    || toFiniteNumber(point?.visits, 0) > 0
  )).length;
  const lastNonZeroPoint = [...matchingPoints].reverse().find((point) => (
    toFiniteNumber(point?.activeMs, 0) > 0
    || toFiniteNumber(point?.backgroundMs, 0) > 0
    || toFiniteNumber(point?.totalMs, 0) > 0
    || toFiniteNumber(point?.visits, 0) > 0
  )) || null;

  return {
    activityDateStr: activityDateStr || null,
    activeMs: totals.activeMs,
    backgroundMs: totals.backgroundMs,
    totalMs: totals.totalMs,
    visits: totals.visits,
    pointCount: matchingPoints.length,
    nonZeroPoints,
    hasUsage: totals.activeMs > 0 || totals.backgroundMs > 0 || totals.totalMs > 0 || totals.visits > 0,
    hasActiveUsage: totals.activeMs > 0,
    lastNonZeroPoint,
  };
}

function compactSitePullPatternDiagnostics(sitePullProfile = null) {
  const diagnostics = sitePullProfile?.patternDiagnostics || null;
  const temporalEvidence = sitePullProfile?.temporalEvidence || null;
  const patterns = Array.isArray(sitePullProfile?.patterns) ? sitePullProfile.patterns : [];
  const badges = Array.isArray(sitePullProfile?.badges) ? sitePullProfile.badges : [];
  const shadowReport = diagnostics?.shadowReport || null;
  const auxiliaryEvidenceCoverage = diagnostics?.auxiliaryEvidenceCoverage || null;
  const aggregateAnalysisPlan = diagnostics?.aggregateAnalysisPlan || null;
  const missingDataDiagnostics = Array.isArray(diagnostics?.missingDataDiagnostics)
    ? diagnostics.missingDataDiagnostics
    : [];
  const dataFamilyDiagnostics = Array.isArray(diagnostics?.dataFamilyDiagnostics)
    ? diagnostics.dataFamilyDiagnostics
    : [];
  const unavailableFamilies = dataFamilyDiagnostics
    .filter((entry) => entry?.status === 'unavailable' || entry?.status === 'partial')
    .map((entry) => ({
      family: entry.family || '',
      status: entry.status || '',
      reason: entry.reason || '',
      permissionKey: entry.permissionKey || null,
      permissionGranted: typeof entry.permissionGranted === 'boolean'
        ? entry.permissionGranted
        : null,
      skippedPatternIds: Array.isArray(entry.skippedPatternIds)
        ? entry.skippedPatternIds
        : [],
    }));

  if (
    !diagnostics
    && patterns.length <= 0
    && badges.length <= 0
    && missingDataDiagnostics.length <= 0
  ) {
    return null;
  }

  return {
    score: toFiniteNumber(sitePullProfile?.score, 0),
    riskBand: sitePullProfile?.riskBand || null,
    confidence: toFiniteNumber(sitePullProfile?.confidence, 0),
    badgeIds: badges.map((badge) => badge?.id).filter(Boolean),
    patternIds: patterns.map((pattern) => pattern?.id).filter(Boolean),
    visiblePatternIds: Array.isArray(diagnostics?.presentationPatternIds)
      ? diagnostics.presentationPatternIds
      : [],
    suppressedPatternIds: Array.isArray(diagnostics?.suppressedPatternIds)
      ? diagnostics.suppressedPatternIds
      : [],
    rejectedPatternIds: Array.isArray(diagnostics?.rejectedPatternIds)
      ? diagnostics.rejectedPatternIds
      : [],
    shadow: shadowReport ? {
      version: shadowReport.version || null,
      matrixVersion: shadowReport.matrixVersion || null,
      summary: shadowReport.summary || null,
      matchedVisibleScenarioIds: Array.isArray(shadowReport.matchedVisibleScenarioIds)
        ? shadowReport.matchedVisibleScenarioIds
        : [],
      matchedSuppressedScenarioIds: Array.isArray(shadowReport.matchedSuppressedScenarioIds)
        ? shadowReport.matchedSuppressedScenarioIds
        : [],
      missingDataScenarioIds: Array.isArray(shadowReport.missingDataScenarioIds)
        ? shadowReport.missingDataScenarioIds
        : [],
      conflictRows: Array.isArray(shadowReport.conflictRows) ? shadowReport.conflictRows : [],
    } : null,
    auxiliaryEvidence: auxiliaryEvidenceCoverage ? {
      version: auxiliaryEvidenceCoverage.version || null,
      summary: auxiliaryEvidenceCoverage.summary || null,
      profiles: Array.isArray(auxiliaryEvidenceCoverage.profiles)
        ? auxiliaryEvidenceCoverage.profiles.map((profile) => ({
          id: profile.id || '',
          status: profile.status || null,
          coverageStatus: profile.coverageStatus || null,
          dataFamilies: Array.isArray(profile.dataFamilies) ? profile.dataFamilies : [],
          missingDataFamilies: Array.isArray(profile.missingDataFamilies)
            ? profile.missingDataFamilies
            : [],
          limitedByMissingData: profile.limitedByMissingData === true,
          affectedPatternIds: Array.isArray(profile.affectedPatternIds) ? profile.affectedPatternIds : [],
          presentPatternIds: Array.isArray(profile.presentPatternIds) ? profile.presentPatternIds : [],
          skippedPatternIds: Array.isArray(profile.skippedPatternIds) ? profile.skippedPatternIds : [],
          capabilityFlags: Array.isArray(profile.capabilityFlags) ? profile.capabilityFlags : [],
          caveats: Array.isArray(profile.caveats) ? profile.caveats : [],
          emittingEntryIds: Array.isArray(profile.emittingEntryIds) ? profile.emittingEntryIds : [],
          supportingEntryIds: Array.isArray(profile.supportingEntryIds) ? profile.supportingEntryIds : [],
          observedEntryIds: Array.isArray(profile.observedEntryIds) ? profile.observedEntryIds : [],
        }))
        : [],
    } : null,
    aggregateAnalysis: aggregateAnalysisPlan ? {
      version: aggregateAnalysisPlan.version || null,
      status: aggregateAnalysisPlan.status || null,
      reason: aggregateAnalysisPlan.reason || null,
      executionEnabled: aggregateAnalysisPlan.executionEnabled === true,
      costBudget: aggregateAnalysisPlan.costBudget || null,
      summary: aggregateAnalysisPlan.summary || null,
      runnableCandidateIds: Array.isArray(aggregateAnalysisPlan.runnableCandidates)
        ? aggregateAnalysisPlan.runnableCandidates.map((candidate) => candidate?.id).filter(Boolean)
        : [],
      skippedCandidates: Array.isArray(aggregateAnalysisPlan.skippedCandidates)
        ? aggregateAnalysisPlan.skippedCandidates
        : [],
      candidates: Array.isArray(aggregateAnalysisPlan.candidates)
        ? aggregateAnalysisPlan.candidates.map((candidate) => ({
          id: candidate.id || '',
          enabled: candidate.enabled === true,
          executionStatus: candidate.executionStatus || null,
          reason: candidate.reason || null,
          scope: candidate.scope || null,
          timeAxes: Array.isArray(candidate.timeAxes) ? candidate.timeAxes : [],
          signalFamilies: Array.isArray(candidate.signalFamilies) ? candidate.signalFamilies : [],
          dataFamilies: Array.isArray(candidate.dataFamilies) ? candidate.dataFamilies : [],
          missingDataFamilies: Array.isArray(candidate.missingDataFamilies)
            ? candidate.missingDataFamilies
            : [],
          limitedByMissingData: candidate.limitedByMissingData === true,
          entityProjection: candidate.entityProjection || null,
          baselineModes: Array.isArray(candidate.baselineModes) ? candidate.baselineModes : [],
          analysisMethods: Array.isArray(candidate.analysisMethods) ? candidate.analysisMethods : [],
          recommendationFamily: candidate.recommendationFamily || null,
          costClass: candidate.costClass || null,
          costBudgetEligible: candidate.costBudgetEligible === true,
          defaultWindowDays: toFiniteNumber(candidate.defaultWindowDays, 0),
          maxLookbackDays: toFiniteNumber(candidate.maxLookbackDays, 0),
          topK: toFiniteNumber(candidate.topK, 0),
          boundedCandidateLimit: toFiniteNumber(candidate.boundedCandidateLimit, 0),
          outputSurfaces: Array.isArray(candidate.outputSurfaces) ? candidate.outputSurfaces : [],
        }))
        : [],
    } : null,
    temporal: temporalEvidence ? {
      version: temporalEvidence.version || null,
      basis: temporalEvidence.basis || null,
      todayActiveMs: toFiniteNumber(temporalEvidence.context?.today?.activeMs, 0),
      todayVisits: toFiniteNumber(temporalEvidence.context?.today?.visits, 0),
      todayActiveHours: toFiniteNumber(temporalEvidence.context?.today?.activeHours, 0),
      todayVisitHours: toFiniteNumber(temporalEvidence.context?.today?.visitHours, 0),
      reentryIntervalProfile: temporalEvidence.metrics?.reentryIntervalProfile || null,
      backgroundResidencyProfile: temporalEvidence.metrics?.backgroundResidencyProfile || null,
      cyclePositionProxy: temporalEvidence.metrics?.cyclePositionProxy || null,
    } : null,
    missingDataDiagnostics,
    unavailableFamilies,
    dataCoverage: sitePullProfile?.dataCoverage || null,
  };
}

function compactSitePullAggregateAnalysis(analysis = null) {
  if (!analysis || typeof analysis !== 'object') return null;
  return {
    version: analysis.version || null,
    enabled: analysis.enabled === true,
    requestedPatternIds: Array.isArray(analysis.requestedPatternIds) ? analysis.requestedPatternIds : [],
    costBudget: analysis.costBudget || null,
    summary: analysis.summary || null,
    plan: analysis.plan ? {
      version: analysis.plan.version || null,
      status: analysis.plan.status || null,
      reason: analysis.plan.reason || null,
      summary: analysis.plan.summary || null,
      runnableCandidateIds: Array.isArray(analysis.plan.runnableCandidates)
        ? analysis.plan.runnableCandidates.map((candidate) => candidate?.id).filter(Boolean)
        : [],
    } : null,
    patterns: Array.isArray(analysis.patterns)
      ? analysis.patterns.map((pattern) => ({
        id: pattern.id || '',
        status: pattern.status || null,
        scope: pattern.scope || null,
        score: toFiniteNumber(pattern.score, 0),
        confidence: toFiniteNumber(pattern.confidence, 0),
        recommendationFamily: pattern.recommendationFamily || null,
        caveats: Array.isArray(pattern.caveats) ? pattern.caveats : [],
        evidence: pattern.evidence ? {
          protectedDomainCount: toFiniteNumber(pattern.evidence.protectedDomainCount, 0),
          analyzedDomainCount: toFiniteNumber(pattern.evidence.analyzedDomainCount, 0),
          behaviorDomainCount: toFiniteNumber(pattern.evidence.behaviorDomainCount, 0),
          todayVisits: toFiniteNumber(pattern.evidence.todayVisits, 0),
          quickReturnEvents: toFiniteNumber(pattern.evidence.quickReturnEvents, 0),
          switchChurn: toFiniteNumber(pattern.evidence.switchChurn, 0),
          visitHourCount: toFiniteNumber(pattern.evidence.visitHourCount, 0),
          channelScores: pattern.evidence.channelScores || null,
          topDomains: Array.isArray(pattern.evidence.topDomains)
            ? pattern.evidence.topDomains.slice(0, 5)
            : [],
        } : null,
      }))
      : [],
  };
}

function buildTargetDomainFacts({
  targetDomains = [],
  domainSeriesSteps = [],
  statusSnapshot = null,
  sitesSnapshot = null,
  statsHourlyLedger = null,
  statsHourlyLedgerTodayDateStr = null,
  currentActivityDateStr = null,
} = {}) {
  return targetDomains.map((domain, index) => {
    const step = domainSeriesSteps[index] || null;
    const response = getDomainSeriesResponse(step);
    const series = response?.domainSeries || null;
    const totals = series?.totals || {};
    const currentActivity = summarizeDomainSeriesActivityDate(step, currentActivityDateStr);
    const siteIntel = sitesSnapshot?.siteIntels?.[domain] || null;
    const sitePull = compactSitePullPatternDiagnostics(siteIntel?.sitePullProfile || null);
    const sitesActiveMs = toFiniteNumber(sitesSnapshot?.siteDetails?.[domain], 0);
    const sitesRawActiveMs = toFiniteNumber(sitesSnapshot?.rawSiteDetails?.[domain], 0);
    const sitesDomainType = typeof siteIntel?.type === 'string' && siteIntel.type
      ? siteIntel.type
      : null;
    const statusTodayActiveMs = toFiniteNumber(statusSnapshot?.currentActivityDay?.siteDetails?.[domain], 0);
    const ledgerDomain = getStatsHourlyLedgerDomain(statsHourlyLedger, domain);
    const ledgerActiveMs = toFiniteNumber(ledgerDomain?.activeMs, 0);
    const ledgerBackgroundMs = toFiniteNumber(ledgerDomain?.backgroundMs, 0);
    const ledgerTotalMs = toFiniteNumber(ledgerDomain?.totalMs, 0);
    const ledgerVisits = toFiniteNumber(ledgerDomain?.visits, 0);
    const ledgerDateKeys = Array.isArray(ledgerDomain?.dateKeys) ? ledgerDomain.dateKeys : [];
    const ledgerHasUsage = ledgerActiveMs > 0 || ledgerBackgroundMs > 0 || ledgerTotalMs > 0 || ledgerVisits > 0;
    const ledgerHasActiveUsage = ledgerActiveMs > 0;
    const ledgerHasTodayUsage = !!(
      statsHourlyLedgerTodayDateStr
      && ledgerDateKeys.includes(statsHourlyLedgerTodayDateStr)
      && ledgerHasUsage
    );
    const ledgerHasTodayActiveUsage = !!(
      statsHourlyLedgerTodayDateStr
      && ledgerDateKeys.includes(statsHourlyLedgerTodayDateStr)
      && ledgerHasActiveUsage
    );
    const nonZeroPoints = Array.isArray(series?.points)
      ? series.points.filter((point) => (
        toFiniteNumber(point?.activeMs, 0) > 0
        || toFiniteNumber(point?.backgroundMs, 0) > 0
        || toFiniteNumber(point?.totalMs, 0) > 0
        || toFiniteNumber(point?.visits, 0) > 0
      )).length
      : 0;
    const durableUsage = hasDomainSeriesUsage(step);
    return {
      domain,
      step: compactStep(step),
      available: response?.available ?? null,
      basis: response?.basis || null,
      resetHour: response?.resetHour ?? null,
      window: {
        startDateStr: response?.startDateStr || null,
        endDateStr: response?.endDateStr || null,
        daysBack: TARGET_DOMAIN_DIAGNOSTIC_DAYS_BACK,
      },
      durableUsage,
      totals: {
        activeMs: toFiniteNumber(totals.activeMs, 0),
        backgroundMs: toFiniteNumber(totals.backgroundMs, 0),
        totalMs: toFiniteNumber(totals.totalMs, 0),
        visits: toFiniteNumber(totals.visits, 0),
      },
      ledger: ledgerDomain
        ? {
          activeMs: ledgerActiveMs,
          backgroundMs: ledgerBackgroundMs,
          totalMs: ledgerTotalMs,
          visits: ledgerVisits,
          rowCount: toFiniteNumber(ledgerDomain?.rowCount, 0),
          dateKeys: ledgerDateKeys,
          hasUsage: ledgerHasUsage,
          hasActiveUsage: ledgerHasActiveUsage,
          hasTodayUsage: ledgerHasTodayUsage,
          hasTodayActiveUsage: ledgerHasTodayActiveUsage,
        }
        : null,
      currentActivity,
      nonZeroPoints,
      lastNonZeroPoint: pickLastNonZeroDomainPoint(step),
      sitesActiveMs,
      sitesRawActiveMs,
      sitesDomainType,
      sitesProjectionExpected: sitesDomainType === 'blocked',
      statusTodayActiveMs,
      sitePull,
      projectedInSites: sitesActiveMs > 0,
      projectedInStatusToday: statusTodayActiveMs > 0,
    };
  });
}

function isSitesExposureTarget(entry = null) {
  return entry?.sitesProjectionExpected === true || entry?.sitesDomainType === 'blocked';
}

function hasSitesExposureProjectionGap(entry = null) {
  return !!(
    entry?.currentActivity?.hasActiveUsage
    && isSitesExposureTarget(entry)
    && !entry?.projectedInSites
  );
}

function hasSitesExposureOutsideCurrentDay(entry = null) {
  return !!(
    entry?.durableUsage
    && isSitesExposureTarget(entry)
    && !entry?.currentActivity?.hasActiveUsage
    && !entry?.projectedInSites
  );
}

function pickTopDomains(siteDetails = {}, limit = 8) {
  return Object.entries(siteDetails || {})
    .map(([domain, activeMs]) => ({ domain, activeMs: toFiniteNumber(activeMs, 0) }))
    .filter((entry) => entry.domain)
    .sort((left, right) => right.activeMs - left.activeMs)
    .slice(0, limit);
}

function createObservation(severity, code, detail = {}) {
  return { severity, code, detail };
}

function compactStep(step) {
  if (!step || typeof step !== 'object') {
    return {
      ok: false,
      durationMs: null,
      error: 'step_missing',
    };
  }
  return {
    ok: step.ok === true,
    durationMs: Number.isFinite(Number(step.durationMs)) ? Number(step.durationMs) : null,
    error: step.ok === true ? null : (step.error || 'step_failed'),
  };
}

function createCriticalPathStage(key, status, code, evidence = {}) {
  return {
    key,
    status,
    code,
    evidence,
  };
}

function pickWorseStage(left, right) {
  const leftRank = DIAGNOSTIC_STAGE_SEVERITY_RANK[left?.status] ?? 0;
  const rightRank = DIAGNOSTIC_STAGE_SEVERITY_RANK[right?.status] ?? 0;
  return rightRank > leftRank ? right : left;
}

function hasDiagnosticError(statsDiagnostics = null) {
  if (!statsDiagnostics || typeof statsDiagnostics !== 'object') return false;
  return Object.values(statsDiagnostics).some(Boolean);
}

function listDiagnosticErrorCodes(statsDiagnostics = null) {
  if (!statsDiagnostics || typeof statsDiagnostics !== 'object') return [];
  return Object.values(statsDiagnostics)
    .filter(Boolean)
    .map((entry) => entry?.code || entry?.message || 'STATS_RUNTIME_DIAGNOSTIC')
    .filter(Boolean);
}

function buildRuntimeHealthStage({
  runtime,
  nowMs,
} = {}) {
  const health = runtime?.statsRuntimeHealth || null;
  if (!health || health.available !== true) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.WATCH,
      'stats_runtime_health_missing',
      { healthAvailable: health?.available ?? false, reason: health?.reason || null },
    );
  }

  const tickGapMs = msSince(nowMs, health.lastTickCompletedAt);
  const activeSealGapMs = msSince(nowMs, health.lastActiveSealAt);
  const lastActiveSealWasApplied = health.lastActiveSealStatus === 'pass';
  const saveLagMs = lastActiveSealWasApplied && isAfter(health.lastActiveSealAt, health.lastSaveCompletedAt)
    ? msSince(nowMs, health.lastActiveSealAt)
    : 0;
  const lastTickFailedAfterSuccess = isAfter(health.lastTickFailedAt, health.lastTickCompletedAt);
  const lastSaveFailedAfterSuccess = isAfter(health.lastSaveFailedAt, health.lastSaveCompletedAt);

  if (health.lastHealthWriteError) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.FAIL,
      'stats_runtime_health_write_failed',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (lastTickFailedAfterSuccess) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.FAIL,
      'tick_failed',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (lastSaveFailedAfterSuccess) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.FAIL,
      'stats_save_failed',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (!toTimestamp(health.lastTickCompletedAt)) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.WATCH,
      'tick_not_completed_yet',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (tickGapMs > TICK_GAP_FAIL_MS) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.FAIL,
      'tick_gap_excessive',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (saveLagMs > SAVE_LAG_FAIL_MS) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.FAIL,
      'stats_save_after_seal_missing',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (tickGapMs > TICK_GAP_WATCH_MS) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.WATCH,
      'tick_gap_delayed',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }
  if (saveLagMs > SAVE_LAG_WATCH_MS) {
    return createCriticalPathStage(
      'runtime_health',
      DIAGNOSTIC_STAGE_STATUS.WATCH,
      'active_seal_not_saved',
      { health, tickGapMs, activeSealGapMs, saveLagMs },
    );
  }

  return createCriticalPathStage(
    'runtime_health',
    DIAGNOSTIC_STAGE_STATUS.PASS,
    'tick_health_current',
    { health, tickGapMs, activeSealGapMs, saveLagMs },
  );
}

function buildCriticalPath({
  browser,
  runtime,
  batch,
  settings,
  statsDiagnostics,
  statsHourlyRows,
  statsDailyRows,
  statsHourlyLedger = null,
  statusSnapshot,
  sitesSnapshot,
  factsSummary,
  targetDomainFacts = [],
  steps = {},
  nowMs = Date.now(),
}) {
  const activeTabCount = Array.isArray(browser?.activeTabs) ? browser.activeTabs.length : 0;
  const alarmsError = getBrowserSurfaceErrorCode(browser?.alarms);
  const hasTickAlarm = Array.isArray(browser?.alarms)
    && browser.alarms.some((alarm) => alarm?.name === ONE_MINUTE_TICK_ALARM_NAME);
  const policyAllowedTabs = toFiniteNumber(batch?.policyAllowedTabs, 0);
  const trackableTabs = toFiniteNumber(batch?.trackableTabs, 0);
  const activeClassifiedTabs = toFiniteNumber(batch?.activeClassifiedTabs, 0);
  const activeElapsedMs = toFiniteNumber(batch?.activeElapsedMs, 0);
  const backgroundElapsedMs = toFiniteNumber(batch?.backgroundElapsedMs, 0);
  const previousSettlement = runtime?.lastPreviousTabSettlement || null;
  const previousSettlementCode = typeof previousSettlement?.code === 'string' && previousSettlement.code
    ? previousSettlement.code
    : null;
  const settledActiveElapsedMs = previousSettlement?.status === 'pass'
    ? toFiniteNumber(previousSettlement?.elapsedMs, 0)
    : 0;
  const runtimeActiveElapsedMs = activeElapsedMs + settledActiveElapsedMs;
  const hasTrackableActiveSource = !!(
    batch?.focusedActiveTrackable
    || (
      batch?.focusUnavailableActiveTabId !== null
      && typeof batch?.focusUnavailableActiveTabId !== 'undefined'
    )
  );
  const todayActiveMs = toFiniteNumber(statusSnapshot?.metrics?.todayActiveMs, 0);
  const sitesSiteDetailsCount = Object.keys(sitesSnapshot?.siteDetails || {}).length;
  const runtimeStep = compactStep(steps.runtime);
  const statusStep = compactStep(steps.status);
  const sitesStep = compactStep(steps.sites);
  const factsSummaryStep = compactStep(steps.factsSummary);
  const trendTotals = getTrendTotals(factsSummary);
  const recentFactsActiveMs = toFiniteNumber(trendTotals?.activeMs, 0);
  const recentFactsBackgroundMs = toFiniteNumber(trendTotals?.backgroundMs, 0);
  const recentFactsTotalMs = toFiniteNumber(trendTotals?.totalMs, 0);
  const recentFactsTopDomainCount = Array.isArray(factsSummary?.trendSummary?.topDomains)
    ? factsSummary.trendSummary.topDomains.length
    : 0;
  const factsLastRead = runtime?.statsFactsCache?.lastRead || null;
  const factsLastReadActiveMs = toFiniteNumber(factsLastRead?.totals?.activeMs, 0);
  const factsLastReadTotalMs = toFiniteNumber(factsLastRead?.totals?.totalMs, 0);
  const factsLastReadTopDomainCount = Array.isArray(factsLastRead?.topDomains)
    ? factsLastRead.topDomains.length
    : 0;
  const factsHourlyRead = factsLastRead?.hourlyRead || null;
  const targetFacts = Array.isArray(targetDomainFacts) ? targetDomainFacts : [];
  const targetQueryFailed = targetFacts.some((entry) => entry?.step?.ok === false);
  const targetHasDurableUsage = targetFacts.some((entry) => entry?.durableUsage);
  const targetHasTodayHourlyLedgerUsage = targetFacts.some((entry) => entry?.ledger?.hasTodayUsage);
  const targetHasTodayHourlyLedgerActiveProjectionGap = targetFacts.some((entry) => (
    entry?.ledger?.hasTodayActiveUsage
    && !entry?.durableUsage
  ));
  const targetHasCurrentActivityActiveUsage = targetFacts.some((entry) => entry?.currentActivity?.hasActiveUsage);
  const targetHasSitesProjectionGap = targetFacts.some((entry) => hasSitesExposureProjectionGap(entry));
  const targetHasDurableUsageOutsideSitesDay = targetFacts.some((entry) => hasSitesExposureOutsideCurrentDay(entry));
  const runtimeFocusedHostname = normalizeDiagnosticDomain(batch?.focusedActiveHostname);
  const runtimeActiveHostname = normalizeDiagnosticDomain(runtime?.activeTabInfo?.hostname);
  const targetHasRuntimeOnlyUsage = targetFacts.some((entry) => (
    !entry?.durableUsage
    && entry?.domain
    && (
      entry.domain === runtimeFocusedHostname
      || entry.domain === runtimeActiveHostname
    )
    && runtimeActiveElapsedMs > 0
  ));
  const todayDateStr = factsSummary?.endDateStr || toLocalDateStr(nowMs);
  const todayHourlyBucket = getStatsHourlyLedgerDateBucket(statsHourlyLedger, todayDateStr);
  const latestHourlyBucket = Array.isArray(statsHourlyLedger?.dateBuckets)
    ? statsHourlyLedger.dateBuckets[0] || null
    : null;
  const hourlyLedgerRowsWithUsage = toFiniteNumber(statsHourlyLedger?.rowsWithUsage, 0);
  const hourlyLedgerRowsWithDomainDelta = toFiniteNumber(statsHourlyLedger?.rowsWithDomainDelta, 0);
  const stages = [];

  stages.push(createCriticalPathStage(
    'source',
    runtimeStep.ok === false
      ? DIAGNOSTIC_STAGE_STATUS.FAIL
      : alarmsError
        ? DIAGNOSTIC_STAGE_STATUS.FAIL
        : !hasTickAlarm
        ? DIAGNOSTIC_STAGE_STATUS.FAIL
        : activeTabCount <= 0
          ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : DIAGNOSTIC_STAGE_STATUS.PASS,
    runtimeStep.ok === false
      ? 'runtime_state_query_failed'
      : alarmsError
        ? 'tick_alarm_owner_unavailable'
        : !hasTickAlarm
        ? 'tick_alarm_missing'
        : activeTabCount <= 0
          ? 'active_tab_missing'
          : 'source_surface_ready',
    {
      runtimeStep,
      tickAlarm: !!hasTickAlarm,
      alarmsError,
      idleState: browser?.idleState || null,
      activeTabCount,
      lastFocusedWindowId: browser?.lastFocusedWindow?.id ?? null,
      focusedWindowId: runtime?.focusedWindowId ?? null,
      lastActiveTabId: runtime?.lastActiveTabId ?? null,
    },
  ));

  stages.push(buildRuntimeHealthStage({
    runtime,
    nowMs,
  }));

  stages.push(createCriticalPathStage(
    'policy',
    settings?.dataCollectionMode === 'off' || settings?.dataCollectionMode === 'disabled'
      ? DIAGNOSTIC_STAGE_STATUS.FAIL
      : batch && trackableTabs > 0 && policyAllowedTabs <= 0
        ? DIAGNOSTIC_STAGE_STATUS.FAIL
        : DIAGNOSTIC_STAGE_STATUS.PASS,
    settings?.dataCollectionMode === 'off' || settings?.dataCollectionMode === 'disabled'
      ? 'data_collection_disabled'
      : batch && trackableTabs > 0 && policyAllowedTabs <= 0
        ? 'policy_rejected_trackable_tabs'
        : 'collection_policy_allows_tracking',
    {
      dataCollectionMode: settings?.dataCollectionMode || null,
      precisionInsightsMode: settings?.precisionInsightsMode || null,
      trackableTabs,
      policyAllowedTabs,
      skippedPolicy: toFiniteNumber(batch?.skipped?.policy, 0),
      blockedCount: Array.isArray(settings?.blockedUrls) ? settings.blockedUrls.length : 0,
      excludedCount: Array.isArray(settings?.trackingExcludedUrls) ? settings.trackingExcludedUrls.length : 0,
    },
  ));

  stages.push(createCriticalPathStage(
    'classification',
    !batch
      ? DIAGNOSTIC_STAGE_STATUS.WATCH
      : hasTrackableActiveSource && policyAllowedTabs > 0 && activeClassifiedTabs <= 0
        ? DIAGNOSTIC_STAGE_STATUS.FAIL
        : hasTrackableActiveSource && runtimeActiveElapsedMs <= 0 && backgroundElapsedMs > 0
          ? DIAGNOSTIC_STAGE_STATUS.FAIL
          : !hasTrackableActiveSource && runtimeActiveElapsedMs <= 0 && backgroundElapsedMs > 0
            ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : DIAGNOSTIC_STAGE_STATUS.PASS,
    !batch
      ? 'tab_activity_batch_missing'
      : hasTrackableActiveSource && policyAllowedTabs > 0 && activeClassifiedTabs <= 0
        ? 'active_tab_not_classified'
        : hasTrackableActiveSource && runtimeActiveElapsedMs <= 0 && backgroundElapsedMs > 0
          ? 'tabs_classified_as_background'
          : !hasTrackableActiveSource && runtimeActiveElapsedMs <= 0 && backgroundElapsedMs > 0
            ? 'background_elapsed_without_trackable_active'
          : 'active_classifier_ready',
    {
      activeTabCount,
      activeClassifiedTabs,
      backgroundClassifiedTabs: toFiniteNumber(batch?.backgroundClassifiedTabs, 0),
      focusedActiveTabId: batch?.focusedActiveTabId ?? null,
      focusedActiveWindowId: batch?.focusedActiveWindowId ?? null,
      focusedActiveHostname: batch?.focusedActiveHostname ?? null,
      focusedActiveTrackable: batch?.focusedActiveTrackable ?? null,
      focusUnavailableActiveTabId: batch?.focusUnavailableActiveTabId ?? null,
      focusedWindowId: batch?.focusedWindowId ?? null,
      hasTrackableActiveSource,
      activeTabCandidates: toFiniteNumber(batch?.activeTabCandidates, 0),
      settledActiveElapsedMs,
    },
  ));

  const failedSettlementCode = previousSettlementCode
    ? previousSettlementCode
    : 'previous_tab_settlement_failed';
  const incompleteSettlementCode = previousSettlementCode
    ? previousSettlementCode
    : 'previous_tab_settlement_incomplete';
  const passedSettlementCode = previousSettlementCode
    ? previousSettlementCode
    : 'active_elapsed_recorded';

  stages.push(createCriticalPathStage(
    'runtime_mutation',
    previousSettlement?.status === 'fail'
      ? DIAGNOSTIC_STAGE_STATUS.FAIL
      : previousSettlement?.status === 'watch'
        ? DIAGNOSTIC_STAGE_STATUS.WATCH
        : !batch
      ? DIAGNOSTIC_STAGE_STATUS.WATCH
      : runtimeActiveElapsedMs > 0
        ? DIAGNOSTIC_STAGE_STATUS.PASS
        : toFiniteNumber(batch?.initializedOnlyTabs, 0) > 0
          ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : activeClassifiedTabs > 0
            ? DIAGNOSTIC_STAGE_STATUS.FAIL
            : DIAGNOSTIC_STAGE_STATUS.WATCH,
    previousSettlement?.status === 'fail'
      ? failedSettlementCode
      : previousSettlement?.status === 'watch'
        ? incompleteSettlementCode
        : previousSettlement?.status === 'pass'
          ? passedSettlementCode
        : !batch
      ? 'tab_activity_batch_missing'
      : runtimeActiveElapsedMs > 0
        ? 'active_elapsed_recorded'
        : toFiniteNumber(batch?.initializedOnlyTabs, 0) > 0
          ? 'first_tick_initialized_tabs_only'
          : activeClassifiedTabs > 0
            ? 'active_elapsed_not_applied'
            : 'no_active_elapsed_observed',
    {
      activeElapsedMs,
      settledActiveElapsedMs,
      runtimeActiveElapsedMs,
      backgroundElapsedMs,
      initializedOnlyTabs: toFiniteNumber(batch?.initializedOnlyTabs, 0),
      idleBlockedTabs: toFiniteNumber(batch?.idleBlockedTabs, 0),
      tooSmallElapsedTabs: toFiniteNumber(batch?.tooSmallElapsedTabs, 0),
      longGapSkippedTabs: toFiniteNumber(batch?.longGapSkippedTabs, 0),
      previousSettlement,
    },
  ));

  stages.push(createCriticalPathStage(
    'persistence',
    hasDiagnosticError(statsDiagnostics)
      ? DIAGNOSTIC_STAGE_STATUS.FAIL
      : statsHourlyRows > 0 && statsHourlyLedger?.error
        ? DIAGNOSTIC_STAGE_STATUS.WATCH
        : statsHourlyRows > 0 && statsHourlyLedger && hourlyLedgerRowsWithUsage <= 0
          ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : statsHourlyRows > 0 && statsHourlyLedger && !todayHourlyBucket
            ? DIAGNOSTIC_STAGE_STATUS.WATCH
            : statsHourlyRows > 0
        ? DIAGNOSTIC_STAGE_STATUS.PASS
        : runtimeActiveElapsedMs > 0
          ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : DIAGNOSTIC_STAGE_STATUS.WATCH,
    hasDiagnosticError(statsDiagnostics)
      ? 'stats_runtime_diagnostic_error'
      : statsHourlyRows > 0 && statsHourlyLedger?.error
        ? 'stats_hourly_ledger_inspection_failed'
        : statsHourlyRows > 0 && statsHourlyLedger && hourlyLedgerRowsWithUsage <= 0
          ? 'hourly_rows_without_usage_delta'
          : statsHourlyRows > 0 && statsHourlyLedger && !todayHourlyBucket
            ? 'hourly_rows_outside_today'
            : statsHourlyRows > 0
        ? 'durable_hourly_rows_present'
        : runtimeActiveElapsedMs > 0
          ? 'active_elapsed_not_yet_persisted'
          : 'stats_hourly_empty',
    {
      statsHourlyRows,
      statsDailyRows,
      diagnosticCodes: listDiagnosticErrorCodes(statsDiagnostics),
      hourlyLedger: statsHourlyLedger
        ? {
          error: statsHourlyLedger.error || null,
          totalRows: toFiniteNumber(statsHourlyLedger.totalRows, 0),
          rowsWithDateStr: toFiniteNumber(statsHourlyLedger.rowsWithDateStr, 0),
          rowsMissingDateStr: toFiniteNumber(statsHourlyLedger.rowsMissingDateStr, 0),
          rowsWithUsage: hourlyLedgerRowsWithUsage,
          rowsWithDomainDelta: hourlyLedgerRowsWithDomainDelta,
          todayDateStr,
          todayBucket: todayHourlyBucket
            ? {
              rowCount: todayHourlyBucket.rowCount,
              rowsWithUsage: todayHourlyBucket.rowsWithUsage,
              hours: todayHourlyBucket.hours,
              totals: todayHourlyBucket.totals,
              topDomains: todayHourlyBucket.topDomains,
            }
            : null,
          latestBucket: latestHourlyBucket
            ? {
              dateStr: latestHourlyBucket.dateStr,
              rawDateStr: latestHourlyBucket.rawDateStr,
              rowCount: latestHourlyBucket.rowCount,
              rowsWithUsage: latestHourlyBucket.rowsWithUsage,
              hours: latestHourlyBucket.hours,
              totals: latestHourlyBucket.totals,
              topDomains: latestHourlyBucket.topDomains,
            }
            : null,
        }
        : null,
    },
  ));

  stages.push(createCriticalPathStage(
    'facts_read',
    factsSummaryStep.ok === false
      ? DIAGNOSTIC_STAGE_STATUS.FAIL
      : recentFactsActiveMs > 0 || recentFactsBackgroundMs > 0 || recentFactsTotalMs > 0 || recentFactsTopDomainCount > 0
        ? DIAGNOSTIC_STAGE_STATUS.PASS
        : statsHourlyRows > 0
          ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : DIAGNOSTIC_STAGE_STATUS.WATCH,
    factsSummaryStep.ok === false
      ? 'facts_query_failed'
      : recentFactsActiveMs > 0 || recentFactsBackgroundMs > 0 || recentFactsTotalMs > 0 || recentFactsTopDomainCount > 0
        ? 'recent_durable_facts_present'
        : statsHourlyRows > 0
          ? 'durable_rows_outside_recent_window'
          : 'recent_durable_facts_empty',
    {
      factsSummaryStep,
      daysBack: FACTS_DIAGNOSTIC_DAYS_BACK,
      recentFactsActiveMs,
      recentFactsBackgroundMs,
      recentFactsTotalMs,
      recentFactsTopDomainCount,
      repositoryLastRead: factsLastRead
        ? {
          requestedDaysBack: factsLastRead.requestedDaysBack ?? null,
          resolvedDaysBack: factsLastRead.resolvedDaysBack ?? null,
          revision: factsLastRead.revision ?? null,
          dateCount: factsLastRead.dateCount ?? null,
          dateStrs: factsLastRead.dateStrs || [],
          totals: factsLastRead.totals || null,
          topDomains: Array.isArray(factsLastRead.topDomains)
            ? factsLastRead.topDomains
            : [],
          hourlyRead: factsHourlyRead
            ? {
              dateStr: factsHourlyRead.dateStr || null,
              rawRowCount: toFiniteNumber(factsHourlyRead.rawRowCount, 0),
              rawNormalizedRowCount: toFiniteNumber(factsHourlyRead.rawNormalizedRowCount, 0),
              rawRejectedRowCount: toFiniteNumber(factsHourlyRead.rawRejectedRowCount, 0),
              rawDateMatchedRowCount: toFiniteNumber(factsHourlyRead.rawDateMatchedRowCount, 0),
              rawHourMatchedRowCount: toFiniteNumber(factsHourlyRead.rawHourMatchedRowCount, 0),
              returnedRowCount: toFiniteNumber(factsHourlyRead.returnedRowCount, 0),
              returned: factsHourlyRead.returned || null,
            }
            : null,
        }
        : null,
    },
  ));

  stages.push(createCriticalPathStage(
    'target_domain',
    targetFacts.length <= 0
      ? DIAGNOSTIC_STAGE_STATUS.WATCH
      : targetQueryFailed
        ? DIAGNOSTIC_STAGE_STATUS.FAIL
        : targetHasSitesProjectionGap
          ? DIAGNOSTIC_STAGE_STATUS.FAIL
          : targetHasTodayHourlyLedgerActiveProjectionGap
            ? DIAGNOSTIC_STAGE_STATUS.FAIL
          : targetHasCurrentActivityActiveUsage
            ? DIAGNOSTIC_STAGE_STATUS.PASS
            : targetHasDurableUsageOutsideSitesDay
              ? DIAGNOSTIC_STAGE_STATUS.WATCH
          : targetHasDurableUsage
            ? DIAGNOSTIC_STAGE_STATUS.PASS
            : targetHasRuntimeOnlyUsage
              ? DIAGNOSTIC_STAGE_STATUS.WATCH
              : DIAGNOSTIC_STAGE_STATUS.WATCH,
    targetFacts.length <= 0
      ? 'target_domain_missing'
      : targetQueryFailed
        ? 'target_domain_query_failed'
        : targetHasSitesProjectionGap
          ? 'target_domain_facts_not_projected'
          : targetHasTodayHourlyLedgerActiveProjectionGap
            ? 'target_domain_hourly_ledger_not_projected'
          : targetHasCurrentActivityActiveUsage
            ? 'target_domain_durable_facts_present'
            : targetHasDurableUsageOutsideSitesDay
              ? 'target_domain_facts_outside_sites_day'
          : targetHasDurableUsage
            ? 'target_domain_durable_facts_present'
            : targetHasRuntimeOnlyUsage
              ? 'target_domain_runtime_only'
              : 'target_domain_not_in_durable_facts',
    {
      targets: targetFacts.map((entry) => ({
        domain: entry.domain,
        step: entry.step,
        durableUsage: entry.durableUsage,
        activeMs: entry.totals?.activeMs ?? 0,
        totalMs: entry.totals?.totalMs ?? 0,
        visits: entry.totals?.visits ?? 0,
        ledger: entry.ledger || null,
        currentActivity: entry.currentActivity || null,
        nonZeroPoints: entry.nonZeroPoints ?? 0,
        sitesActiveMs: entry.sitesActiveMs ?? 0,
        sitesRawActiveMs: entry.sitesRawActiveMs ?? 0,
        sitesDomainType: entry.sitesDomainType || null,
        sitesProjectionExpected: entry.sitesProjectionExpected === true,
        statusTodayActiveMs: entry.statusTodayActiveMs ?? 0,
        lastNonZeroPoint: entry.lastNonZeroPoint || null,
      })),
    },
  ));

  stages.push(createCriticalPathStage(
    'query_projection',
    statusStep.ok === false || sitesStep.ok === false
      ? DIAGNOSTIC_STAGE_STATUS.FAIL
      : targetHasSitesProjectionGap || (targetHasCurrentActivityActiveUsage && todayActiveMs <= 0 && sitesSiteDetailsCount <= 0)
        ? DIAGNOSTIC_STAGE_STATUS.FAIL
        : statsHourlyRows > 0 && todayActiveMs <= 0 && sitesSiteDetailsCount <= 0
          ? DIAGNOSTIC_STAGE_STATUS.WATCH
        : todayActiveMs > 0 || sitesSiteDetailsCount > 0
          ? DIAGNOSTIC_STAGE_STATUS.PASS
          : DIAGNOSTIC_STAGE_STATUS.WATCH,
    statusStep.ok === false || sitesStep.ok === false
      ? 'read_model_query_failed'
      : targetHasSitesProjectionGap || (targetHasCurrentActivityActiveUsage && todayActiveMs <= 0 && sitesSiteDetailsCount <= 0)
        ? 'durable_rows_not_projected'
        : statsHourlyRows > 0 && todayActiveMs <= 0 && sitesSiteDetailsCount <= 0
          ? 'read_models_empty'
        : todayActiveMs > 0 || sitesSiteDetailsCount > 0
          ? 'read_models_have_usage'
          : 'read_models_empty',
    {
      statusStep,
      sitesStep,
      todayActiveMs,
      sitesSiteDetailsCount,
      trackedDateCount: toFiniteNumber(statusSnapshot?.metrics?.trackedDateCount, 0),
      targetDomainWithCurrentActivityActiveUsageCount: targetFacts.filter((entry) => entry?.currentActivity?.hasActiveUsage).length,
    },
  ));

  stages.push(createCriticalPathStage(
    'dashboard_snapshot',
    statusSnapshot || sitesSnapshot ? DIAGNOSTIC_STAGE_STATUS.PASS : DIAGNOSTIC_STAGE_STATUS.FAIL,
    statusSnapshot || sitesSnapshot ? 'dashboard_snapshot_received' : 'dashboard_snapshot_missing',
    {
      hasStatusSnapshot: !!statusSnapshot,
      hasSitesSnapshot: !!sitesSnapshot,
      statusAvailable: statusSnapshot?.available ?? null,
      sitesAvailable: sitesSnapshot?.available ?? null,
    },
  ));

  return stages;
}

function choosePrimaryStage(stages = []) {
  return (Array.isArray(stages) ? stages : [])
    .reduce((best, stage) => pickWorseStage(best, stage), createCriticalPathStage(
      'unknown',
      DIAGNOSTIC_STAGE_STATUS.PASS,
      'pipeline_clear',
    ));
}

function buildCompactReport(report) {
  if (!report || typeof report !== 'object') return null;
  const diagnosis = report.diagnosis || {};
  const statusSnapshot = report.statusSnapshot || null;
  const sitesSnapshot = report.sitesSnapshot || null;
  const factsSummary = report.factsSummary || null;
  const browser = report.browser || null;
  const browserSurfaceErrors = {
    alarms: getBrowserSurfaceErrorCode(browser?.alarms),
    idleState: getBrowserSurfaceErrorCode(browser?.idleState),
    lastFocusedWindow: getBrowserSurfaceErrorCode(browser?.lastFocusedWindow),
  };
  const runtime = report.runtime || null;
  const statsHourlyLedger = getStatsHourlyLedger(report.storageInspector);
  return {
    reportType: `${report.reportType}.summary`,
    reportVersion: report.reportVersion,
    generatedAt: report.generatedAt,
    source: report.source,
    storageMutation: report.storageMutation,
    currentActivityDateStr: report.currentActivityDateStr || null,
    overall: diagnosis.overall || null,
    primaryStage: diagnosis.primaryStage || null,
    criticalPath: diagnosis.criticalPath || [],
    observations: diagnosis.observations || [],
    signals: diagnosis.signals || {},
    steps: Object.fromEntries(
      Object.entries(report.steps || {}).map(([key, step]) => [
        key,
        Array.isArray(step) ? step.map(compactStep) : compactStep(step),
      ]),
    ),
    sourceSurface: {
      errors: browserSurfaceErrors,
      idleState: browser?.idleState || null,
      activeTabs: Array.isArray(browser?.activeTabs)
        ? browser.activeTabs.map((tab) => ({
          id: tab.id,
          windowId: tab.windowId,
          hostname: tab.hostname,
          active: tab.active,
          audible: tab.audible,
        }))
        : [],
      lastFocusedWindow: browser?.lastFocusedWindow
        ? {
          id: browser.lastFocusedWindow.id ?? null,
          focused: browser.lastFocusedWindow.focused ?? null,
          activeTab: browser.lastFocusedWindow.activeTab
            ? {
              id: browser.lastFocusedWindow.activeTab.id,
              windowId: browser.lastFocusedWindow.activeTab.windowId,
              hostname: browser.lastFocusedWindow.activeTab.hostname,
              audible: browser.lastFocusedWindow.activeTab.audible,
            }
            : null,
        }
        : null,
    },
    runtimeClassifier: {
      focusedWindowId: runtime?.focusedWindowId ?? null,
      lastActiveTabId: runtime?.lastActiveTabId ?? null,
      activeTabInfo: runtime?.activeTabInfo || null,
      lastPreviousTabSettlement: runtime?.lastPreviousTabSettlement || null,
      lastTabActivityBatch: runtime?.lastTabActivityBatch || null,
      statsDiagnostics: runtime?.statsDiagnostics || null,
      statsFactsCache: runtime?.statsFactsCache || null,
      statsRuntimeHealth: runtime?.statsRuntimeHealth || null,
    },
    readModels: {
      status: {
        available: statusSnapshot?.available ?? null,
        todayActiveMs: toFiniteNumber(statusSnapshot?.metrics?.todayActiveMs, 0),
        todayProtectedMs: toFiniteNumber(statusSnapshot?.metrics?.todayProtectedMs, 0),
        trackedDateCount: toFiniteNumber(statusSnapshot?.metrics?.trackedDateCount, 0),
        topTodaySites: pickTopDomains(statusSnapshot?.currentActivityDay?.siteDetails, 8),
      },
      sites: {
        available: sitesSnapshot?.available ?? null,
        totalExposure: toFiniteNumber(sitesSnapshot?.totalExposure, 0),
        siteDetailsBasis: sitesSnapshot?.siteDetailsBasis || null,
        topSites: pickTopDomains(sitesSnapshot?.siteDetails, 8),
        sitePullAggregateAnalysis: compactSitePullAggregateAnalysis(
          sitesSnapshot?.sitePullAggregateAnalysis || null,
        ),
      },
    },
    durableFacts: {
      daysBack: FACTS_DIAGNOSTIC_DAYS_BACK,
      available: factsSummary?.available ?? null,
      startDateStr: factsSummary?.startDateStr || null,
      endDateStr: factsSummary?.endDateStr || null,
      basis: factsSummary?.basis || null,
      resetHour: factsSummary?.resetHour ?? null,
      totals: {
        activeMs: toFiniteNumber(factsSummary?.trendSummary?.totals?.activeMs, 0),
        backgroundMs: toFiniteNumber(factsSummary?.trendSummary?.totals?.backgroundMs, 0),
        totalMs: toFiniteNumber(factsSummary?.trendSummary?.totals?.totalMs, 0),
        sessions: toFiniteNumber(factsSummary?.trendSummary?.totals?.sessions?.count, 0),
      },
      topDomains: Array.isArray(factsSummary?.trendSummary?.topDomains)
        ? factsSummary.trendSummary.topDomains.slice(0, 8)
        : [],
    },
    hourlyLedger: statsHourlyLedger
      ? {
        error: statsHourlyLedger.error || null,
        totalRows: toFiniteNumber(statsHourlyLedger.totalRows, 0),
        rowsWithDateStr: toFiniteNumber(statsHourlyLedger.rowsWithDateStr, 0),
        rowsMissingDateStr: toFiniteNumber(statsHourlyLedger.rowsMissingDateStr, 0),
        rowsWithUsage: toFiniteNumber(statsHourlyLedger.rowsWithUsage, 0),
        rowsWithDomainDelta: toFiniteNumber(statsHourlyLedger.rowsWithDomainDelta, 0),
        dateBuckets: Array.isArray(statsHourlyLedger.dateBuckets)
          ? statsHourlyLedger.dateBuckets.slice(0, 6)
          : [],
        domainTotals: Array.isArray(statsHourlyLedger.domainTotals)
          ? statsHourlyLedger.domainTotals.slice(0, 12)
          : [],
        sampleRows: Array.isArray(statsHourlyLedger.sampleRows)
          ? statsHourlyLedger.sampleRows.slice(0, 6)
          : [],
      }
      : null,
    targetDomains: report.targetDomainFacts || [],
  };
}

function countLines(value) {
  if (!value) return 0;
  return String(value).split('\n').length;
}

function truncatePreview(value, maxLines = PREVIEW_MAX_LINES) {
  const lines = String(value || '').split('\n');
  if (lines.length <= maxLines) return value;
  return `${lines.slice(0, maxLines).join('\n')}\n...`;
}

function buildDiagnosis({
  settings,
  browser,
  runtimeState,
  storageInspector,
  statusResponse,
  sitesResponse,
  factsSummaryResponse,
  targetDomainFacts = [],
  steps = {},
  nowMs = Date.now(),
}) {
  const runtime = runtimeState?.runtime || null;
  const batch = runtime?.lastTabActivityBatch || null;
  const previousSettlement = runtime?.lastPreviousTabSettlement || null;
  const previousSettlementCode = typeof previousSettlement?.code === 'string' && previousSettlement.code
    ? previousSettlement.code
    : null;
  const failedSettlementCode = previousSettlementCode
    ? previousSettlementCode
    : 'previous_tab_settlement_failed';
  const incompleteSettlementCode = previousSettlementCode
    ? previousSettlementCode
    : 'previous_tab_settlement_incomplete';
  const settledActiveElapsedMs = previousSettlement?.status === 'pass'
    ? toFiniteNumber(previousSettlement?.elapsedMs, 0)
    : 0;
  const runtimeActiveElapsedMs = toFiniteNumber(batch?.activeElapsedMs, 0) + settledActiveElapsedMs;
  const statsDiagnostics = runtime?.statsDiagnostics || null;
  const statusSnapshot = resolveStatusSnapshot(statusResponse);
  const sitesSnapshot = resolveSitesSnapshot(sitesResponse);
  const factsSummary = factsSummaryResponse || null;
  const statsHourlyRows = getStoreCount(storageInspector?.snapshot, 'stats_hourly');
  const statsDailyRows = getStoreCount(storageInspector?.snapshot, 'stats_daily');
  const statsHourlyLedger = getStatsHourlyLedger(storageInspector?.snapshot);
  const todayDateStr = factsSummary?.endDateStr || toLocalDateStr(nowMs);
  const todayHourlyBucket = getStatsHourlyLedgerDateBucket(statsHourlyLedger, todayDateStr);
  const hourlyLedgerRowsWithUsage = toFiniteNumber(statsHourlyLedger?.rowsWithUsage, 0);
  const hourlyLedgerRowsWithDomainDelta = toFiniteNumber(statsHourlyLedger?.rowsWithDomainDelta, 0);
  const factsLastRead = runtime?.statsFactsCache?.lastRead || null;
  const factsLastReadActiveMs = toFiniteNumber(factsLastRead?.totals?.activeMs, 0);
  const factsLastReadTotalMs = toFiniteNumber(factsLastRead?.totals?.totalMs, 0);
  const factsLastReadTopDomainCount = Array.isArray(factsLastRead?.topDomains)
    ? factsLastRead.topDomains.length
    : 0;
  const factsHourlyRead = factsLastRead?.hourlyRead || null;
  const alarmsError = getBrowserSurfaceErrorCode(browser?.alarms);
  const idleStateError = getBrowserSurfaceErrorCode(browser?.idleState);
  const lastFocusedWindowError = getBrowserSurfaceErrorCode(browser?.lastFocusedWindow);
  const observations = [];
  const mode = settings?.dataCollectionMode || null;
  const criticalPath = buildCriticalPath({
    browser,
    runtime,
    batch,
    settings,
    statsDiagnostics,
    statsHourlyRows,
    statsDailyRows,
    statsHourlyLedger,
    statusSnapshot,
    sitesSnapshot,
    factsSummary,
    targetDomainFacts,
    steps,
    nowMs,
  });
  const primaryStage = choosePrimaryStage(criticalPath);

  if (alarmsError) {
    observations.push(createObservation('fail', 'tick_alarm_owner_unavailable', { error: alarmsError }));
  } else if (!Array.isArray(browser?.alarms) || !browser.alarms.some((alarm) => alarm?.name === ONE_MINUTE_TICK_ALARM_NAME)) {
    observations.push(createObservation('fail', 'tick_alarm_missing'));
  }
  if (lastFocusedWindowError) {
    observations.push(createObservation('watch', 'last_focused_window_owner_unavailable', {
      error: lastFocusedWindowError,
    }));
  }
  if (idleStateError) {
    observations.push(createObservation('watch', 'idle_state_owner_unavailable', {
      error: idleStateError,
    }));
  }
  if (mode === 'off' || mode === 'disabled') {
    observations.push(createObservation('fail', 'data_collection_disabled', { mode }));
  }
  if (!batch) {
    observations.push(createObservation('watch', 'tab_activity_batch_missing'));
  } else {
    const activeElapsedMs = toFiniteNumber(batch.activeElapsedMs, 0);
    const backgroundElapsedMs = toFiniteNumber(batch.backgroundElapsedMs, 0);
    if (toFiniteNumber(batch.tabsWithUrl, 0) <= 0) {
      observations.push(createObservation('fail', 'tab_urls_unavailable'));
    }
    if (toFiniteNumber(batch.policyAllowedTabs, 0) <= 0 && toFiniteNumber(batch.trackableTabs, 0) > 0) {
      observations.push(createObservation('fail', 'policy_rejected_trackable_tabs', {
        skippedPolicy: toFiniteNumber(batch?.skipped?.policy, 0),
      }));
    }
    if (toFiniteNumber(batch.idleBlockedTabs, 0) > 0 && runtimeActiveElapsedMs <= 0) {
      observations.push(createObservation('fail', 'idle_blocked_active_elapsed'));
    }
    const hasTrackableActiveSource = !!(
      batch?.focusedActiveTrackable
      || (
        batch?.focusUnavailableActiveTabId !== null
        && typeof batch?.focusUnavailableActiveTabId !== 'undefined'
      )
    );
    if (hasTrackableActiveSource && runtimeActiveElapsedMs <= 0 && backgroundElapsedMs > 0) {
      observations.push(createObservation('fail', 'tabs_classified_as_background', { backgroundElapsedMs }));
    } else if (!hasTrackableActiveSource && runtimeActiveElapsedMs <= 0 && backgroundElapsedMs > 0) {
      observations.push(createObservation('watch', 'background_elapsed_without_trackable_active', {
        backgroundElapsedMs,
        focusedActiveTrackable: batch?.focusedActiveTrackable ?? null,
        activeTabCandidates: toFiniteNumber(batch?.activeTabCandidates, 0),
      }));
    }
    if (runtimeActiveElapsedMs <= 0 && toFiniteNumber(batch.initializedOnlyTabs, 0) > 0) {
      observations.push(createObservation('watch', 'first_tick_initialized_tabs_only'));
    }
    if (runtimeActiveElapsedMs > 0) {
      observations.push(createObservation('pass', 'active_elapsed_recorded', {
        activeElapsedMs,
        settledActiveElapsedMs,
        runtimeActiveElapsedMs,
      }));
    }
  }
  if (previousSettlement?.status === 'fail') {
    observations.push(createObservation('fail', failedSettlementCode, previousSettlement));
  } else if (previousSettlement?.status === 'watch') {
    observations.push(createObservation('watch', incompleteSettlementCode, previousSettlement));
  }

  const runtimeHealth = runtime?.statsRuntimeHealth || null;
  const tickGapMs = msSince(nowMs, runtimeHealth?.lastTickCompletedAt);
  const activeSealGapMs = msSince(nowMs, runtimeHealth?.lastActiveSealAt);
  const lastActiveSealWasApplied = runtimeHealth?.lastActiveSealStatus === 'pass';
  const saveLagMs = lastActiveSealWasApplied && isAfter(runtimeHealth?.lastActiveSealAt, runtimeHealth?.lastSaveCompletedAt)
    ? msSince(nowMs, runtimeHealth?.lastActiveSealAt)
    : 0;
  if (!runtimeHealth || runtimeHealth.available !== true) {
    observations.push(createObservation('watch', 'stats_runtime_health_missing', {
      reason: runtimeHealth?.reason || null,
    }));
  } else {
    if (runtimeHealth.lastForegroundResumeIncident) {
      observations.push(createObservation('watch', 'foreground_resume_ambiguous_recorded', runtimeHealth.lastForegroundResumeIncident));
    }
    if (tickGapMs > TICK_GAP_FAIL_MS) {
      observations.push(createObservation('fail', 'tick_gap_excessive', { tickGapMs }));
    } else if (tickGapMs > TICK_GAP_WATCH_MS) {
      observations.push(createObservation('watch', 'tick_gap_delayed', { tickGapMs }));
    }
    if (saveLagMs > SAVE_LAG_FAIL_MS) {
      observations.push(createObservation('fail', 'stats_save_after_seal_missing', { saveLagMs }));
    } else if (saveLagMs > SAVE_LAG_WATCH_MS) {
      observations.push(createObservation('watch', 'active_seal_not_saved', { saveLagMs }));
    }
  }

  if (statsHourlyRows <= 0) {
    observations.push(createObservation('watch', 'stats_hourly_empty'));
  }

  const trendTotals = getTrendTotals(factsSummary);
  const recentFactsActiveMs = toFiniteNumber(trendTotals?.activeMs, 0);
  const recentFactsBackgroundMs = toFiniteNumber(trendTotals?.backgroundMs, 0);
  const recentFactsTotalMs = toFiniteNumber(trendTotals?.totalMs, 0);
  const recentFactsTopDomainCount = Array.isArray(factsSummary?.trendSummary?.topDomains)
    ? factsSummary.trendSummary.topDomains.length
    : 0;
  if (steps.factsSummary?.ok === false) {
    observations.push(createObservation('fail', 'facts_query_failed', compactStep(steps.factsSummary)));
  } else if (recentFactsActiveMs > 0 || recentFactsBackgroundMs > 0 || recentFactsTotalMs > 0 || recentFactsTopDomainCount > 0) {
    observations.push(createObservation('pass', 'recent_durable_facts_present', {
      recentFactsActiveMs,
      recentFactsBackgroundMs,
      recentFactsTotalMs,
      recentFactsTopDomainCount,
    }));
  } else if (statsHourlyRows > 0) {
    observations.push(createObservation('watch', 'durable_rows_outside_recent_window', {
      statsHourlyRows,
      daysBack: FACTS_DIAGNOSTIC_DAYS_BACK,
    }));
  } else {
    observations.push(createObservation('watch', 'recent_durable_facts_empty', {
      daysBack: FACTS_DIAGNOSTIC_DAYS_BACK,
    }));
  }

  const targetFacts = Array.isArray(targetDomainFacts) ? targetDomainFacts : [];
  targetFacts.forEach((entry) => {
    if (entry?.step?.ok === false) {
      observations.push(createObservation('fail', 'target_domain_query_failed', {
        domain: entry.domain,
        error: entry.step.error,
      }));
      return;
    }
    if (hasSitesExposureProjectionGap(entry)) {
      observations.push(createObservation('fail', 'target_domain_facts_not_projected', {
        domain: entry.domain,
        activeMs: entry.currentActivity?.activeMs ?? 0,
        totalMs: entry.currentActivity?.totalMs ?? 0,
        visits: entry.currentActivity?.visits ?? 0,
        activityDateStr: entry.currentActivity?.activityDateStr ?? null,
        sitesActiveMs: entry.sitesActiveMs ?? 0,
        sitesRawActiveMs: entry.sitesRawActiveMs ?? 0,
        sitesDomainType: entry.sitesDomainType || null,
      }));
    } else if (entry?.ledger?.hasTodayActiveUsage && !entry?.durableUsage) {
      observations.push(createObservation('fail', 'target_domain_hourly_ledger_not_projected', {
        domain: entry.domain,
        ledger: entry.ledger,
        domainSeriesActiveMs: entry.totals?.activeMs ?? 0,
        domainSeriesTotalMs: entry.totals?.totalMs ?? 0,
      }));
    } else if (hasSitesExposureOutsideCurrentDay(entry)) {
      observations.push(createObservation('watch', 'target_domain_facts_outside_sites_day', {
        domain: entry.domain,
        activeMs: entry.totals?.activeMs ?? 0,
        totalMs: entry.totals?.totalMs ?? 0,
        visits: entry.totals?.visits ?? 0,
        currentActivity: entry.currentActivity || null,
        sitesActiveMs: entry.sitesActiveMs ?? 0,
        sitesRawActiveMs: entry.sitesRawActiveMs ?? 0,
        sitesDomainType: entry.sitesDomainType || null,
      }));
    } else if (entry?.durableUsage) {
      observations.push(createObservation('pass', 'target_domain_durable_facts_present', {
        domain: entry.domain,
        activeMs: entry.totals?.activeMs ?? 0,
        totalMs: entry.totals?.totalMs ?? 0,
        visits: entry.totals?.visits ?? 0,
        currentActivity: entry.currentActivity || null,
        sitesActiveMs: entry.sitesActiveMs ?? 0,
        sitesRawActiveMs: entry.sitesRawActiveMs ?? 0,
        sitesDomainType: entry.sitesDomainType || null,
      }));
    }
  });
  if (targetFacts.length <= 0) {
    observations.push(createObservation('watch', 'target_domain_missing'));
  } else if (!targetFacts.some((entry) => entry?.durableUsage)) {
    observations.push(createObservation('watch', 'target_domain_not_in_durable_facts', {
      domains: targetFacts.map((entry) => entry.domain),
    }));
  }

  const todayActiveMs = toFiniteNumber(statusSnapshot?.metrics?.todayActiveMs, 0);
  const trackedDateCount = toFiniteNumber(statusSnapshot?.metrics?.trackedDateCount, 0);
  const sitesSiteDetailsCount = Object.keys(sitesSnapshot?.siteDetails || {}).length;

  if (todayActiveMs > 0 || sitesSiteDetailsCount > 0) {
    observations.push(createObservation('pass', 'read_models_have_usage', {
      todayActiveMs,
      sitesSiteDetailsCount,
    }));
  } else if (targetFacts.some((entry) => entry?.currentActivity?.hasActiveUsage)) {
    observations.push(createObservation('fail', 'durable_rows_not_projected', {
      statsHourlyRows,
      todayActiveMs,
      sitesSiteDetailsCount,
      targetDomainWithCurrentActivityActiveUsageCount: targetFacts.filter((entry) => entry?.currentActivity?.hasActiveUsage).length,
    }));
  } else if (statsHourlyRows > 0) {
    observations.push(createObservation('watch', 'read_models_empty', {
      statsHourlyRows,
      todayActiveMs,
      sitesSiteDetailsCount,
    }));
  }

  const failCount = observations.filter((entry) => entry.severity === 'fail').length;
  const watchCount = observations.filter((entry) => entry.severity === 'watch').length;
  const stageFailCount = criticalPath.filter((entry) => entry.status === DIAGNOSTIC_STAGE_STATUS.FAIL).length;
  const stageWatchCount = criticalPath.filter((entry) => entry.status === DIAGNOSTIC_STAGE_STATUS.WATCH).length;
  const normalizedFailCount = Math.max(failCount, stageFailCount);
  const normalizedWatchCount = Math.max(watchCount, stageWatchCount);

  return {
    overall: normalizedFailCount > 0 ? 'fail' : normalizedWatchCount > 0 ? 'watch' : 'pass',
    primaryStage,
    failCount: normalizedFailCount,
    watchCount: normalizedWatchCount,
    criticalPath,
    signals: {
      dataCollectionMode: mode,
      precisionInsightsMode: settings?.precisionInsightsMode || null,
      trackingExcludedCount: Array.isArray(settings?.trackingExcludedUrls) ? settings.trackingExcludedUrls.length : 0,
      blockedCount: Array.isArray(settings?.blockedUrls) ? settings.blockedUrls.length : 0,
      allowedCount: Array.isArray(settings?.allowedUrls) ? settings.allowedUrls.length : 0,
      idleState: browser?.idleState || null,
      activeTabCount: Array.isArray(browser?.activeTabs) ? browser.activeTabs.length : 0,
      statsHourlyRows,
      statsDailyRows,
      statsHourlyRowsWithUsage: hourlyLedgerRowsWithUsage,
      statsHourlyRowsWithDomainDelta: hourlyLedgerRowsWithDomainDelta,
      statsHourlyRowsMissingDateStr: toFiniteNumber(statsHourlyLedger?.rowsMissingDateStr, 0),
      statsHourlyTodayRows: toFiniteNumber(todayHourlyBucket?.rowCount, 0),
      statsHourlyTodayActiveMs: toFiniteNumber(todayHourlyBucket?.totals?.activeMs, 0),
      recentFactsActiveMs,
      recentFactsBackgroundMs,
      recentFactsTotalMs,
      recentFactsTopDomainCount,
      factsLastReadActiveMs,
      factsLastReadTotalMs,
      factsLastReadDateCount: toFiniteNumber(factsLastRead?.dateCount, 0),
      factsLastReadTopDomainCount,
      factsHourlyReadRawRows: toFiniteNumber(factsHourlyRead?.rawRowCount, 0),
      factsHourlyReadReturnedRows: toFiniteNumber(factsHourlyRead?.returnedRowCount, 0),
      todayActiveMs,
      trackedDateCount,
      sitesSiteDetailsCount,
      targetDomains: targetFacts.map((entry) => entry.domain),
      targetDomainWithDurableUsageCount: targetFacts.filter((entry) => entry?.durableUsage).length,
      targetDomainWithHourlyLedgerUsageCount: targetFacts.filter((entry) => entry?.ledger?.hasUsage).length,
      targetDomainWithTodayHourlyLedgerUsageCount: targetFacts.filter((entry) => entry?.ledger?.hasTodayUsage).length,
      targetDomainWithCurrentActivityUsageCount: targetFacts.filter((entry) => entry?.currentActivity?.hasUsage).length,
      targetDomainWithCurrentActivityActiveUsageCount: targetFacts.filter((entry) => entry?.currentActivity?.hasActiveUsage).length,
      targetDomainProjectedInSitesCount: targetFacts.filter((entry) => entry?.projectedInSites).length,
      targetDomainSitesProjectionExpectedCount: targetFacts.filter((entry) => isSitesExposureTarget(entry)).length,
      activeElapsedMs: toFiniteNumber(batch?.activeElapsedMs, 0),
      settledActiveElapsedMs,
      runtimeActiveElapsedMs,
      backgroundElapsedMs: toFiniteNumber(batch?.backgroundElapsedMs, 0),
      activeClassifiedTabs: toFiniteNumber(batch?.activeClassifiedTabs, 0),
      backgroundClassifiedTabs: toFiniteNumber(batch?.backgroundClassifiedTabs, 0),
      focusedActiveTabId: batch?.focusedActiveTabId ?? null,
      focusedActiveWindowId: batch?.focusedActiveWindowId ?? null,
      focusedActiveHostname: batch?.focusedActiveHostname ?? null,
      focusedActiveTrackable: batch?.focusedActiveTrackable ?? null,
      focusUnavailableActiveTabId: batch?.focusUnavailableActiveTabId ?? null,
      focusedWindowId: batch?.focusedWindowId ?? null,
      previousSettlementStatus: previousSettlement?.status ?? null,
      previousSettlementCode: previousSettlement?.code ?? null,
      policyAllowedTabs: toFiniteNumber(batch?.policyAllowedTabs, 0),
      tabsWithUrl: toFiniteNumber(batch?.tabsWithUrl, 0),
      statsDiagnosticCodes: listDiagnosticErrorCodes(statsDiagnostics),
      runtimeHealthAvailable: runtimeHealth?.available ?? false,
      lastAlarmSeenAt: runtimeHealth?.lastAlarmSeenAt ?? null,
      lastTickCompletedAt: runtimeHealth?.lastTickCompletedAt ?? null,
      lastActiveSealAt: runtimeHealth?.lastActiveSealAt ?? null,
      lastSaveCompletedAt: runtimeHealth?.lastSaveCompletedAt ?? null,
      tickGapMs,
      activeSealGapMs,
      saveLagMs,
      alarmsError,
      idleStateError,
      lastFocusedWindowError,
      foregroundResumeAmbiguousCount: toFiniteNumber(runtimeHealth?.counters?.foregroundResumeAmbiguous, 0),
    },
    observations,
  };
}

async function collectBrowserSnapshot(runtimeState) {
  const extensionApi = getExtensionApi();
  const [permissions, alarms, tabs, lastFocusedWindow, idleState] = await Promise.all([
    permissionsGetAllStrict(),
    callExtensionCallback(extensionApi?.alarms, 'getAll', [], {
      unavailableCode: BROWSER_SURFACE_ERROR_CODES.ALARMS_GET_ALL_UNAVAILABLE,
    }),
    tabsQuery({}),
    callExtensionCallback(extensionApi?.windows, 'getLastFocused', [{ populate: true }], {
      unavailableCode: BROWSER_SURFACE_ERROR_CODES.WINDOWS_GET_LAST_FOCUSED_UNAVAILABLE,
    }),
    callExtensionCallback(extensionApi?.idle, 'queryState', [IDLE_QUERY_INTERVAL_SECONDS], {
      unavailableCode: BROWSER_SURFACE_ERROR_CODES.IDLE_QUERY_STATE_UNAVAILABLE,
    }),
  ]);
  const activeTabs = (Array.isArray(tabs) ? tabs : [])
    .filter((tab) => tab?.active)
    .map(summarizeTab)
    .filter(Boolean);
  const focusedActiveTab = Array.isArray(lastFocusedWindow?.tabs)
    ? lastFocusedWindow.tabs.find((tab) => tab?.active)
    : null;
  const lastActiveTabId = runtimeState?.runtime?.lastActiveTabId;
  const runtimeLastActiveTab = Number.isFinite(Number(lastActiveTabId))
    ? summarizeTab(await tabsGet(Number(lastActiveTabId)))
    : null;

  return {
    permissions,
    alarms: Array.isArray(alarms)
      ? alarms.map((alarm) => ({
        name: alarm?.name || '',
        periodInMinutes: toFiniteNumber(alarm?.periodInMinutes, null),
        scheduledTime: toFiniteNumber(alarm?.scheduledTime, null),
      }))
      : alarms,
    idleState,
    tabCount: Array.isArray(tabs) ? tabs.length : null,
    activeTabs,
    runtimeLastActiveTab,
    tabSample: (Array.isArray(tabs) ? tabs : [])
      .slice(0, MAX_TAB_SAMPLE_COUNT)
      .map(summarizeTab)
      .filter(Boolean),
    lastFocusedWindow: lastFocusedWindow && !lastFocusedWindow.error
      ? {
        id: Number.isFinite(Number(lastFocusedWindow.id)) ? Number(lastFocusedWindow.id) : null,
        focused: !!lastFocusedWindow.focused,
        state: typeof lastFocusedWindow.state === 'string' ? lastFocusedWindow.state : '',
        activeTab: summarizeTab(focusedActiveTab),
      }
      : lastFocusedWindow,
  };
}

async function buildStatsPipelineReport({ targetDomain = '' } = {}) {
  const generatedAt = new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAt);
  const [
    settingsStep,
    runtimeStep,
    storageInspectorStep,
    statusStep,
    sitesStep,
  ] = await Promise.all([
    captureStep('settings_snapshot', () => readDiagnosticSettingsSnapshot()),
    captureStep('tracking_runtime_state', () => requestRuntimeAction(MESSAGE_ACTIONS.DEBUG_GET_TRACKING_RUNTIME_STATE)),
    captureStep('storage_inspector_snapshot', () => requestRuntimeAction(MESSAGE_ACTIONS.GET_STORAGE_INSPECTOR_SNAPSHOT)),
    captureStep('status_snapshot', () => requestRuntimeAction(MESSAGE_ACTIONS.GET_STATUS_SNAPSHOT)),
    captureStep('sites_snapshot', () => requestRuntimeAction(MESSAGE_ACTIONS.GET_SITES_SNAPSHOT)),
  ]);
  const browserStep = await captureStep(
    'browser_tracking_surface',
    () => collectBrowserSnapshot(unwrapStep(runtimeStep)),
  );
  const raw = {
    settings: unwrapStep(settingsStep),
    browser: unwrapStep(browserStep),
    runtimeState: unwrapStep(runtimeStep),
    storageInspector: unwrapStep(storageInspectorStep),
    statusResponse: unwrapStep(statusStep),
    sitesResponse: unwrapStep(sitesStep),
  };
  const targetDomains = resolveDiagnosticTargetDomains({
    requestedTarget: targetDomain,
    settings: raw.settings,
    browser: raw.browser,
    runtime: raw.runtimeState?.runtime || null,
    statusSnapshot: raw.statusResponse?.statusSnapshot || null,
    sitesSnapshot: raw.sitesResponse?.sitesSnapshot || null,
  });
  const [factsSummaryStep, ...domainSeriesSteps] = await Promise.all([
    captureStep('facts_summary', () => requestFactsSummary(raw.settings)),
    ...targetDomains.map((domain) => captureStep(
      `domain_series:${domain}`,
      () => requestTargetDomainSeries(domain, raw.settings),
    )),
  ]);
  const postQueryRuntimeStep = await captureStep(
    'tracking_runtime_state_after_facts_query',
    () => requestRuntimeAction(MESSAGE_ACTIONS.DEBUG_GET_TRACKING_RUNTIME_STATE),
  );
  const factsSummaryResponse = unwrapStep(factsSummaryStep);
  const runtimeStateForDiagnostics = unwrapStep(postQueryRuntimeStep) || raw.runtimeState;
  const currentActivityDateStr = resolveDiagnosticActivityDateStr(
    generatedAtMs,
    factsSummaryResponse?.resetHour ?? 4,
  );
  const targetDomainFacts = buildTargetDomainFacts({
    targetDomains,
    domainSeriesSteps,
    statusSnapshot: raw.statusResponse?.statusSnapshot || null,
    sitesSnapshot: raw.sitesResponse?.sitesSnapshot || null,
    statsHourlyLedger: getStatsHourlyLedger(raw.storageInspector?.snapshot),
    statsHourlyLedgerTodayDateStr: factsSummaryResponse?.endDateStr || toLocalDateStr(generatedAtMs),
    currentActivityDateStr,
  });

  return {
    reportType: 'entropy.stats_pipeline.live_diagnostics',
    reportVersion: 5,
    generatedAt,
    source: 'experiment_tab',
    storageMutation: false,
    currentActivityDateStr,
    readPath: [
      'settings_snapshot',
      'browser_tracking_surface',
      'DEBUG_GET_TRACKING_RUNTIME_STATE',
      'GET_STORAGE_INSPECTOR_SNAPSHOT',
      'GET_STATUS_SNAPSHOT',
      'GET_SITES_SNAPSHOT',
      'GET_TREND_SUMMARY',
      'GET_DOMAIN_SERIES',
      'DEBUG_GET_TRACKING_RUNTIME_STATE_AFTER_FACTS_QUERY',
    ],
    steps: {
      settings: settingsStep,
      browser: browserStep,
      runtime: runtimeStep,
      postQueryRuntime: postQueryRuntimeStep,
      storageInspector: storageInspectorStep,
      status: statusStep,
      sites: sitesStep,
      factsSummary: factsSummaryStep,
      domainSeries: domainSeriesSteps,
    },
    diagnosis: buildDiagnosis({
      ...raw,
      runtimeState: runtimeStateForDiagnostics,
      factsSummaryResponse,
      targetDomainFacts,
      steps: {
        settings: settingsStep,
        browser: browserStep,
        runtime: runtimeStep,
        postQueryRuntime: postQueryRuntimeStep,
        storageInspector: storageInspectorStep,
        status: statusStep,
        sites: sitesStep,
        factsSummary: factsSummaryStep,
        domainSeries: domainSeriesSteps,
      },
      nowMs: generatedAtMs,
    }),
    settings: raw.settings,
    browser: raw.browser,
    runtime: runtimeStateForDiagnostics?.runtime || null,
    runtimeBeforeFactsQuery: raw.runtimeState?.runtime || null,
    storageInspector: raw.storageInspector?.snapshot || null,
    statusSnapshot: raw.statusResponse?.statusSnapshot || null,
    sitesSnapshot: raw.sitesResponse?.sitesSnapshot || null,
    factsSummary: factsSummaryResponse,
    targetDomainInput: normalizeDiagnosticDomain(targetDomain),
    targetDomains,
    targetDomainFacts,
  };
}

function formatMs(value) {
  const numeric = toFiniteNumber(value, 0);
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}s`;
  return `${Math.round(numeric)}ms`;
}

function formatBytes(value) {
  const numeric = Math.max(0, toFiniteNumber(value, 0));
  if (numeric >= 1024 * 1024) return `${(numeric / (1024 * 1024)).toFixed(1)}MB`;
  if (numeric >= 1024) return `${(numeric / 1024).toFixed(1)}KB`;
  return `${Math.round(numeric)}B`;
}

function resolveStatusClassName(status) {
  if (status === DIAGNOSTIC_STAGE_STATUS.FAIL) {
    return 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-200';
  }
  if (status === DIAGNOSTIC_STAGE_STATUS.WATCH) {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200';
  }
  return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
}

function StatusIcon({ status }) {
  if (status === DIAGNOSTIC_STAGE_STATUS.FAIL) {
    return <AlertTriangle className="h-3.5 w-3.5" />;
  }
  if (status === DIAGNOSTIC_STAGE_STATUS.WATCH) {
    return <Activity className="h-3.5 w-3.5" />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

function createEvidence(label, value) {
  return {
    label,
    value: value === null || typeof value === 'undefined' || value === '' ? '--' : String(value),
  };
}

function buildStageEvidence(t, stage, signals = {}) {
  switch (stage?.key) {
    case 'source':
      return [
        createEvidence(getSignalLabel(t, 'mode'), signals.dataCollectionMode || '--'),
        createEvidence(getSignalLabel(t, 'focus'), signals.focusedWindowId ?? '--'),
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.active_tabs'), signals.activeTabCount ?? '--'),
      ];
    case 'runtime_health':
      return [
        createEvidence(getSignalLabel(t, 'health'), signals.runtimeHealthAvailable ? 'ok' : 'missing'),
        createEvidence(getSignalLabel(t, 'tick_gap'), signals.tickGapMs === null ? '--' : formatMs(signals.tickGapMs)),
        createEvidence(getSignalLabel(t, 'save_lag'), signals.saveLagMs === null ? '--' : formatMs(signals.saveLagMs)),
      ];
    case 'policy':
      return [
        createEvidence(getSignalLabel(t, 'mode'), signals.dataCollectionMode || '--'),
        createEvidence(getSignalLabel(t, 'policy'), signals.policyAllowedTabs ?? '--'),
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.excluded'), signals.trackingExcludedCount ?? 0),
      ];
    case 'classification':
      return [
        createEvidence(getSignalLabel(t, 'focused_active'), signals.focusedActiveTabId ?? '--'),
        createEvidence(getSignalLabel(t, 'classified'), `${signals.activeClassifiedTabs || 0}/${signals.backgroundClassifiedTabs || 0}`),
        createEvidence(getSignalLabel(t, 'candidate'), signals.focusUnavailableActiveTabId ?? '--'),
      ];
    case 'runtime_mutation':
      return [
        createEvidence(t('experiment.stats_pipeline_diagnostics.metric_elapsed'), formatMs(signals.runtimeActiveElapsedMs || 0)),
        createEvidence(getSignalLabel(t, 'settlement'), signals.previousSettlementCode || signals.previousSettlementStatus || '--'),
        createEvidence(getSignalLabel(t, 'seal_gap'), signals.activeSealGapMs === null ? '--' : formatMs(signals.activeSealGapMs)),
      ];
    case 'persistence':
      return [
        createEvidence(getSignalLabel(t, 'hourly_usage'), `${signals.statsHourlyRowsWithUsage || 0}/${signals.statsHourlyRows || 0}`),
        createEvidence(getSignalLabel(t, 'hourly_today'), formatMs(signals.statsHourlyTodayActiveMs || 0)),
        createEvidence(getSignalLabel(t, 'diagnostics'), signals.statsDiagnosticCodes?.length || 0),
      ];
    case 'facts_read':
      return [
        createEvidence(getSignalLabel(t, 'facts_active'), formatMs(signals.recentFactsActiveMs || 0)),
        createEvidence(getSignalLabel(t, 'facts_repo_rows'), `${signals.factsHourlyReadReturnedRows || 0}/${signals.factsHourlyReadRawRows || 0}`),
        createEvidence(getSignalLabel(t, 'facts_repo_active'), formatMs(signals.factsLastReadActiveMs || 0)),
      ];
    case 'target_domain':
      return [
        createEvidence(getSignalLabel(t, 'target'), Array.isArray(signals.targetDomains) && signals.targetDomains.length
          ? signals.targetDomains.slice(0, 2).join(', ')
          : '--'),
        createEvidence(getSignalLabel(t, 'target_ledger'), `${signals.targetDomainWithTodayHourlyLedgerUsageCount || 0}/${Array.isArray(signals.targetDomains) ? signals.targetDomains.length : 0}`),
        createEvidence(getSignalLabel(t, 'target_db'), `${signals.targetDomainWithDurableUsageCount || 0}/${Array.isArray(signals.targetDomains) ? signals.targetDomains.length : 0}`),
      ];
    case 'query_projection':
      return [
        createEvidence(t('experiment.stats_pipeline_diagnostics.metric_today'), formatMs(signals.todayActiveMs || 0)),
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.sites_sites'), signals.sitesSiteDetailsCount || 0),
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.tracked_dates'), signals.trackedDateCount || 0),
      ];
    case 'dashboard_snapshot':
      return [
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.status_snapshot'), stage?.evidence?.hasStatusSnapshot ? 'ok' : '--'),
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.sites_snapshot'), stage?.evidence?.hasSitesSnapshot ? 'ok' : '--'),
        createEvidence(t('experiment.stats_pipeline_diagnostics.evidence.available'), stage?.evidence?.statusAvailable === false || stage?.evidence?.sitesAvailable === false ? 'partial' : 'ok'),
      ];
    default:
      return [];
  }
}

function buildReadBoundaryRows(t, signals = null) {
  if (!signals) return [];
  const hourlyActiveMs = toFiniteNumber(signals.statsHourlyTodayActiveMs, 0);
  const repositoryActiveMs = toFiniteNumber(signals.factsLastReadActiveMs, 0);
  const factsActiveMs = toFiniteNumber(signals.recentFactsActiveMs, 0);
  const readModelActiveMs = toFiniteNumber(signals.todayActiveMs, 0);
  const hasHourlyUsage = hourlyActiveMs > 0 || toFiniteNumber(signals.statsHourlyRowsWithUsage, 0) > 0;
  const hasRepositoryUsage = repositoryActiveMs > 0 || toFiniteNumber(signals.factsLastReadTopDomainCount, 0) > 0;
  const hasFactsUsage = factsActiveMs > 0 || toFiniteNumber(signals.recentFactsTopDomainCount, 0) > 0;

  return READ_BOUNDARY_SEQUENCE.map((key) => {
    if (key === 'runtime') {
      return {
        key,
        label: t('experiment.stats_pipeline_diagnostics.boundary.runtime'),
        status: toFiniteNumber(signals.runtimeActiveElapsedMs, 0) > 0 ? 'pass' : 'watch',
        value: formatMs(signals.runtimeActiveElapsedMs || 0),
        meta: `${getSignalLabel(t, 'classified')} ${signals.activeClassifiedTabs || 0}/${signals.backgroundClassifiedTabs || 0}`,
      };
    }
    if (key === 'hourly') {
      return {
        key,
        label: t('experiment.stats_pipeline_diagnostics.boundary.hourly'),
        status: hasHourlyUsage ? 'pass' : 'watch',
        value: formatMs(hourlyActiveMs),
        meta: `${signals.statsHourlyRowsWithUsage || 0}/${signals.statsHourlyRows || 0} ${t('experiment.stats_pipeline_diagnostics.unit.rows')}`,
      };
    }
    if (key === 'repository') {
      return {
        key,
        label: t('experiment.stats_pipeline_diagnostics.boundary.repository'),
        status: hasHourlyUsage && !hasRepositoryUsage ? 'fail' : hasRepositoryUsage ? 'pass' : 'watch',
        value: formatMs(repositoryActiveMs),
        meta: `${signals.factsHourlyReadReturnedRows || 0}/${signals.factsHourlyReadRawRows || 0} ${t('experiment.stats_pipeline_diagnostics.unit.rows')}`,
      };
    }
    if (key === 'facts') {
      return {
        key,
        label: t('experiment.stats_pipeline_diagnostics.boundary.facts'),
        status: hasRepositoryUsage && !hasFactsUsage ? 'fail' : hasFactsUsage ? 'pass' : 'watch',
        value: formatMs(factsActiveMs),
        meta: `${signals.recentFactsTopDomainCount || 0} ${t('experiment.stats_pipeline_diagnostics.unit.domains')}`,
      };
    }
    return {
      key,
      label: t('experiment.stats_pipeline_diagnostics.boundary.read_model'),
      status: (hasRepositoryUsage || hasFactsUsage) && readModelActiveMs <= 0 && toFiniteNumber(signals.sitesSiteDetailsCount, 0) <= 0
        ? 'fail'
        : readModelActiveMs > 0 || toFiniteNumber(signals.sitesSiteDetailsCount, 0) > 0
          ? 'pass'
          : 'watch',
      value: formatMs(readModelActiveMs),
      meta: `${signals.sitesSiteDetailsCount || 0} ${t('experiment.stats_pipeline_diagnostics.unit.sites')}`,
    };
  });
}

function getObservationPreview(report) {
  const observations = report?.diagnosis?.observations;
  return Array.isArray(observations) ? observations.slice(0, MAX_OBSERVATION_PREVIEW_COUNT) : [];
}

function PipelineStageCard({ stage, index, total, signals, t }) {
  const evidence = buildStageEvidence(t, stage, signals);
  return (
    <div className={`rounded-lg border px-3 py-2 ${resolveStatusClassName(stage.status)}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase">
          <StatusIcon status={stage.status} />
          <span className="shrink-0 tabular-nums">{index + 1}/{total}</span>
          <span className="truncate">{getStageLabel(t, stage.key)}</span>
        </div>
        <span className="text-[10px] font-bold uppercase">{stage.status}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] font-medium opacity-90">
        {getCodeLabel(t, stage.code)}
      </div>
      {evidence.length > 0 ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {evidence.map((item) => (
            <div key={item.label} className="min-w-0 rounded-md bg-surface/55 px-2 py-1">
              <div className="truncate text-[9px] font-semibold uppercase opacity-65">
                {item.label}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-bold tabular-nums">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BoundaryRail({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="grid gap-2 md:grid-cols-5">
      {rows.map((row) => (
        <div key={row.key} className={`rounded-lg border px-3 py-2 ${resolveStatusClassName(row.status)}`}>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase">
            <StatusIcon status={row.status} />
            <span className="truncate">{row.label}</span>
          </div>
          <div className="mt-1 text-sm font-bold tabular-nums">
            {row.value}
          </div>
          <div className="mt-0.5 truncate text-[10px] font-semibold opacity-75">
            {row.meta}
          </div>
        </div>
      ))}
    </div>
  );
}

function resolveSitePullMatrixStatus(sitePull = null) {
  if (!sitePull) return 'watch';
  if (Array.isArray(sitePull.rejectedPatternIds) && sitePull.rejectedPatternIds.length > 0) {
    return 'fail';
  }
  if (
    Array.isArray(sitePull.missingDataDiagnostics)
    && sitePull.missingDataDiagnostics.length > 0
  ) {
    return 'watch';
  }
  return 'pass';
}

function formatSitePullMatrixValue(sitePull = null) {
  if (!sitePull) return '--';
  const badgeCount = Array.isArray(sitePull.badgeIds) ? sitePull.badgeIds.length : 0;
  const missingCount = Array.isArray(sitePull.missingDataDiagnostics)
    ? sitePull.missingDataDiagnostics.length
    : 0;
  return `${badgeCount}/${missingCount}`;
}

function TargetDomainMatrix({ rows, t }) {
  if (!Array.isArray(rows) || rows.length <= 0) {
    return (
      <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2 text-[11px] text-on-surface-muted">
        {t('experiment.stats_pipeline_diagnostics.target_empty')}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-on-surface/10">
      <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
        <thead className="bg-surface-sunken/70 text-[10px] uppercase text-on-surface-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.domain')}</th>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.ledger')}</th>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.repository')}</th>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.current_day')}</th>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.sites')}</th>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.patterns')}</th>
            <th className="px-3 py-2 font-semibold">{t('experiment.stats_pipeline_diagnostics.target_table.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-on-surface/10">
          {rows.map((row) => (
            <tr key={row.domain} className="text-on-surface">
              <td className="px-3 py-2 font-semibold">{row.domain}</td>
              <td className="px-3 py-2 tabular-nums">{formatMs(row.ledger?.activeMs || 0)}</td>
              <td className="px-3 py-2 tabular-nums">{formatMs(row.totals?.activeMs || 0)}</td>
              <td className="px-3 py-2 tabular-nums">{formatMs(row.currentActivity?.activeMs || 0)}</td>
              <td className="px-3 py-2 tabular-nums">{formatMs(row.sitesActiveMs || 0)}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums uppercase ${resolveStatusClassName(resolveSitePullMatrixStatus(row.sitePull))}`}>
                  {formatSitePullMatrixValue(row.sitePull)}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${resolveStatusClassName(row.projectedInSites || row.durableUsage ? 'pass' : row.ledger?.hasTodayActiveUsage ? 'fail' : 'watch')}`}>
                  {row.projectedInSites || row.durableUsage ? 'pass' : row.ledger?.hasTodayActiveUsage ? 'fail' : 'watch'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObservationList({ report, t }) {
  const observations = getObservationPreview(report);
  if (observations.length <= 0) return null;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {observations.map((observation, index) => (
        <div
          key={`${observation.code}:${index}`}
          className={`rounded-lg border px-3 py-2 ${resolveStatusClassName(observation.severity)}`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
            <StatusIcon status={observation.severity} />
            {observation.severity}
          </div>
          <div className="mt-1 text-[11px] font-semibold leading-snug">
            {getCodeLabel(t, observation.code)}
          </div>
        </div>
      ))}
    </div>
  );
}

function getStageLabel(t, key) {
  switch (key) {
    case 'source':
      return t('experiment.stats_pipeline_diagnostics.stage.source');
    case 'runtime_health':
      return t('experiment.stats_pipeline_diagnostics.stage.runtime_health');
    case 'policy':
      return t('experiment.stats_pipeline_diagnostics.stage.policy');
    case 'classification':
      return t('experiment.stats_pipeline_diagnostics.stage.classification');
    case 'runtime_mutation':
      return t('experiment.stats_pipeline_diagnostics.stage.runtime_mutation');
    case 'persistence':
      return t('experiment.stats_pipeline_diagnostics.stage.persistence');
    case 'facts_read':
      return t('experiment.stats_pipeline_diagnostics.stage.facts_read');
    case 'target_domain':
      return t('experiment.stats_pipeline_diagnostics.stage.target_domain');
    case 'query_projection':
      return t('experiment.stats_pipeline_diagnostics.stage.query_projection');
    case 'dashboard_snapshot':
      return t('experiment.stats_pipeline_diagnostics.stage.dashboard_snapshot');
    default:
      return t('experiment.stats_pipeline_diagnostics.stage.unknown');
  }
}

function getSignalLabel(t, key) {
  switch (key) {
    case 'mode':
      return t('experiment.stats_pipeline_diagnostics.signal.mode');
    case 'focus':
      return t('experiment.stats_pipeline_diagnostics.signal.focus');
    case 'focused_active':
      return t('experiment.stats_pipeline_diagnostics.signal.focused_active');
    case 'settlement':
      return t('experiment.stats_pipeline_diagnostics.signal.settlement');
    case 'candidate':
      return t('experiment.stats_pipeline_diagnostics.signal.candidate');
    case 'classified':
      return t('experiment.stats_pipeline_diagnostics.signal.classified');
    case 'policy':
      return t('experiment.stats_pipeline_diagnostics.signal.policy');
    case 'diagnostics':
      return t('experiment.stats_pipeline_diagnostics.signal.diagnostics');
    case 'hourly_usage':
      return t('experiment.stats_pipeline_diagnostics.signal.hourly_usage');
    case 'hourly_today':
      return t('experiment.stats_pipeline_diagnostics.signal.hourly_today');
    case 'tick_gap':
      return t('experiment.stats_pipeline_diagnostics.signal.tick_gap');
    case 'seal_gap':
      return t('experiment.stats_pipeline_diagnostics.signal.seal_gap');
    case 'save_lag':
      return t('experiment.stats_pipeline_diagnostics.signal.save_lag');
    case 'health':
      return t('experiment.stats_pipeline_diagnostics.signal.health');
    case 'facts_active':
      return t('experiment.stats_pipeline_diagnostics.signal.facts_active');
    case 'facts_domains':
      return t('experiment.stats_pipeline_diagnostics.signal.facts_domains');
    case 'facts_repo_active':
      return t('experiment.stats_pipeline_diagnostics.signal.facts_repo_active');
    case 'facts_repo_domains':
      return t('experiment.stats_pipeline_diagnostics.signal.facts_repo_domains');
    case 'facts_repo_rows':
      return t('experiment.stats_pipeline_diagnostics.signal.facts_repo_rows');
    case 'target':
      return t('experiment.stats_pipeline_diagnostics.signal.target');
    case 'target_db':
      return t('experiment.stats_pipeline_diagnostics.signal.target_db');
    case 'target_ledger':
      return t('experiment.stats_pipeline_diagnostics.signal.target_ledger');
    default:
      return t('experiment.stats_pipeline_diagnostics.stage.unknown');
  }
}

function getCodeLabel(t, code) {
  switch (code) {
    case 'tick_alarm_owner_unavailable':
      return t('experiment.stats_pipeline_diagnostics.code.tick_alarm_owner_unavailable');
    case 'tick_alarm_missing':
      return t('experiment.stats_pipeline_diagnostics.code.tick_alarm_missing');
    case 'last_focused_window_owner_unavailable':
      return t('experiment.stats_pipeline_diagnostics.code.last_focused_window_owner_unavailable');
    case 'idle_state_owner_unavailable':
      return t('experiment.stats_pipeline_diagnostics.code.idle_state_owner_unavailable');
    case 'runtime_state_query_failed':
      return t('experiment.stats_pipeline_diagnostics.code.runtime_state_query_failed');
    case 'active_tab_missing':
      return t('experiment.stats_pipeline_diagnostics.code.active_tab_missing');
    case 'source_surface_ready':
      return t('experiment.stats_pipeline_diagnostics.code.source_surface_ready');
    case 'stats_runtime_health_missing':
      return t('experiment.stats_pipeline_diagnostics.code.stats_runtime_health_missing');
    case 'stats_runtime_health_write_failed':
      return t('experiment.stats_pipeline_diagnostics.code.stats_runtime_health_write_failed');
    case 'tick_health_current':
      return t('experiment.stats_pipeline_diagnostics.code.tick_health_current');
    case 'tick_not_completed_yet':
      return t('experiment.stats_pipeline_diagnostics.code.tick_not_completed_yet');
    case 'tick_gap_delayed':
      return t('experiment.stats_pipeline_diagnostics.code.tick_gap_delayed');
    case 'tick_gap_excessive':
      return t('experiment.stats_pipeline_diagnostics.code.tick_gap_excessive');
    case 'tick_failed':
      return t('experiment.stats_pipeline_diagnostics.code.tick_failed');
    case 'stats_save_failed':
      return t('experiment.stats_pipeline_diagnostics.code.stats_save_failed');
    case 'active_seal_not_saved':
      return t('experiment.stats_pipeline_diagnostics.code.active_seal_not_saved');
    case 'stats_save_after_seal_missing':
      return t('experiment.stats_pipeline_diagnostics.code.stats_save_after_seal_missing');
    case 'foreground_resume_ambiguous_recorded':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_resume_ambiguous_recorded');
    case 'data_collection_disabled':
      return t('experiment.stats_pipeline_diagnostics.code.data_collection_disabled');
    case 'policy_rejected_trackable_tabs':
      return t('experiment.stats_pipeline_diagnostics.code.policy_rejected_trackable_tabs');
    case 'collection_policy_allows_tracking':
      return t('experiment.stats_pipeline_diagnostics.code.collection_policy_allows_tracking');
    case 'tab_urls_unavailable':
      return t('experiment.stats_pipeline_diagnostics.code.tab_urls_unavailable');
    case 'idle_blocked_active_elapsed':
      return t('experiment.stats_pipeline_diagnostics.code.idle_blocked_active_elapsed');
    case 'tab_activity_batch_missing':
      return t('experiment.stats_pipeline_diagnostics.code.tab_activity_batch_missing');
    case 'active_tab_not_classified':
      return t('experiment.stats_pipeline_diagnostics.code.active_tab_not_classified');
    case 'tabs_classified_as_background':
      return t('experiment.stats_pipeline_diagnostics.code.tabs_classified_as_background');
    case 'background_elapsed_without_trackable_active':
      return t('experiment.stats_pipeline_diagnostics.code.background_elapsed_without_trackable_active');
    case 'active_classifier_ready':
      return t('experiment.stats_pipeline_diagnostics.code.active_classifier_ready');
    case 'active_elapsed_recorded':
      return t('experiment.stats_pipeline_diagnostics.code.active_elapsed_recorded');
    case 'first_tick_initialized_tabs_only':
      return t('experiment.stats_pipeline_diagnostics.code.first_tick_initialized_tabs_only');
    case 'active_elapsed_not_applied':
      return t('experiment.stats_pipeline_diagnostics.code.active_elapsed_not_applied');
    case 'no_active_elapsed_observed':
      return t('experiment.stats_pipeline_diagnostics.code.no_active_elapsed_observed');
    case 'previous_tab_settlement_failed':
      return t('experiment.stats_pipeline_diagnostics.code.previous_tab_settlement_failed');
    case 'previous_tab_settlement_incomplete':
      return t('experiment.stats_pipeline_diagnostics.code.previous_tab_settlement_incomplete');
    case 'foreground_segment_closed':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_closed');
    case 'foreground_segment_missing':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_missing');
    case 'foreground_segment_tab_mismatch':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_tab_mismatch');
    case 'foreground_segment_not_started':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_not_started');
    case 'foreground_segment_non_positive_elapsed':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_non_positive_elapsed');
    case 'foreground_segment_policy_rejected':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_policy_rejected');
    case 'foreground_segment_no_change':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_no_change');
    case 'foreground_segment_resume_ambiguous':
      return t('experiment.stats_pipeline_diagnostics.code.foreground_segment_resume_ambiguous');
    case 'stats_runtime_diagnostic_error':
      return t('experiment.stats_pipeline_diagnostics.code.stats_runtime_diagnostic_error');
    case 'durable_hourly_rows_present':
      return t('experiment.stats_pipeline_diagnostics.code.durable_hourly_rows_present');
    case 'stats_hourly_ledger_inspection_failed':
      return t('experiment.stats_pipeline_diagnostics.code.stats_hourly_ledger_inspection_failed');
    case 'hourly_rows_without_usage_delta':
      return t('experiment.stats_pipeline_diagnostics.code.hourly_rows_without_usage_delta');
    case 'hourly_rows_outside_today':
      return t('experiment.stats_pipeline_diagnostics.code.hourly_rows_outside_today');
    case 'active_elapsed_not_yet_persisted':
      return t('experiment.stats_pipeline_diagnostics.code.active_elapsed_not_yet_persisted');
    case 'stats_hourly_empty':
      return t('experiment.stats_pipeline_diagnostics.code.stats_hourly_empty');
    case 'facts_query_failed':
      return t('experiment.stats_pipeline_diagnostics.code.facts_query_failed');
    case 'recent_durable_facts_present':
      return t('experiment.stats_pipeline_diagnostics.code.recent_durable_facts_present');
    case 'durable_rows_outside_recent_window':
      return t('experiment.stats_pipeline_diagnostics.code.durable_rows_outside_recent_window');
    case 'recent_durable_facts_empty':
      return t('experiment.stats_pipeline_diagnostics.code.recent_durable_facts_empty');
    case 'target_domain_missing':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_missing');
    case 'target_domain_query_failed':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_query_failed');
    case 'target_domain_facts_not_projected':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_facts_not_projected');
    case 'target_domain_hourly_ledger_not_projected':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_hourly_ledger_not_projected');
    case 'target_domain_facts_outside_sites_day':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_facts_outside_sites_day');
    case 'target_domain_durable_facts_present':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_durable_facts_present');
    case 'target_domain_runtime_only':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_runtime_only');
    case 'target_domain_not_in_durable_facts':
      return t('experiment.stats_pipeline_diagnostics.code.target_domain_not_in_durable_facts');
    case 'read_model_query_failed':
      return t('experiment.stats_pipeline_diagnostics.code.read_model_query_failed');
    case 'durable_rows_not_projected':
      return t('experiment.stats_pipeline_diagnostics.code.durable_rows_not_projected');
    case 'read_models_have_usage':
      return t('experiment.stats_pipeline_diagnostics.code.read_models_have_usage');
    case 'read_models_empty':
      return t('experiment.stats_pipeline_diagnostics.code.read_models_empty');
    case 'dashboard_snapshot_received':
      return t('experiment.stats_pipeline_diagnostics.code.dashboard_snapshot_received');
    case 'dashboard_snapshot_missing':
      return t('experiment.stats_pipeline_diagnostics.code.dashboard_snapshot_missing');
    case 'pipeline_clear':
      return t('experiment.stats_pipeline_diagnostics.code.pipeline_clear');
    default:
      return t('experiment.stats_pipeline_diagnostics.code.pipeline_clear');
  }
}

export default function StatsPipelineDiagnosticsLab() {
  const { t } = useAppTranslation('tools');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [targetDomain, setTargetDomain] = useState('');

  const rawReportText = useMemo(() => (
    report ? JSON.stringify(report, null, 2) : ''
  ), [report]);
  const summaryReport = useMemo(() => buildCompactReport(report), [report]);
  const summaryText = useMemo(() => (
    summaryReport ? JSON.stringify(summaryReport, null, 2) : ''
  ), [summaryReport]);
  const summaryPreviewText = useMemo(() => truncatePreview(summaryText), [summaryText]);
  const signals = report?.diagnosis?.signals || null;
  const criticalPath = report?.diagnosis?.criticalPath || [];
  const primaryStage = report?.diagnosis?.primaryStage || null;
  const rawLineCount = countLines(rawReportText);
  const summaryLineCount = countLines(summaryText);

  const runDiagnostics = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setFeedback('');
    try {
      const nextReport = await buildStatsPipelineReport({ targetDomain });
      setReport(nextReport);
      setFeedback(t('experiment.stats_pipeline_diagnostics.run_done'));
    } catch (error) {
      setFeedback(t('experiment.stats_pipeline_diagnostics.run_failed', {
        message: error?.message || String(error),
      }));
    } finally {
      setRunning(false);
    }
  }, [running, targetDomain, t]);

  const copySummaryReport = useCallback(async () => {
    if (!summaryText) {
      setFeedback(t('experiment.stats_pipeline_diagnostics.copy_empty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(summaryText);
      setFeedback(t('experiment.stats_pipeline_diagnostics.copy_done'));
    } catch (_error) {
      setFeedback(t('experiment.stats_pipeline_diagnostics.copy_failed'));
    }
  }, [summaryText, t]);

  const copyRawReport = useCallback(async () => {
    if (!rawReportText) {
      setFeedback(t('experiment.stats_pipeline_diagnostics.copy_empty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(rawReportText);
      setFeedback(t('experiment.stats_pipeline_diagnostics.copy_raw_done', {
        lines: rawLineCount,
      }));
    } catch (_error) {
      setFeedback(t('experiment.stats_pipeline_diagnostics.copy_failed'));
    }
  }, [rawLineCount, rawReportText, t]);

  const clearReport = useCallback(() => {
    setReport(null);
    setFeedback('');
  }, []);

  return (
    <div className="shrink-0 rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.stats_pipeline_diagnostics.eyebrow')}
          </p>
          <p className="text-sm font-bold text-on-surface">
            {t('experiment.stats_pipeline_diagnostics.title')}
          </p>
          <p className="mt-1 max-w-3xl text-[11px] leading-snug text-on-surface-muted">
            {t('experiment.stats_pipeline_diagnostics.desc')}
          </p>
        </div>
        <input
          type="text"
          value={targetDomain}
          onChange={(event) => setTargetDomain(event.target.value)}
          placeholder={t('experiment.stats_pipeline_diagnostics.target_placeholder')}
          aria-label={t('experiment.stats_pipeline_diagnostics.target_label')}
          className="min-w-[180px] max-w-full rounded-lg border border-on-surface/10 bg-surface-sunken px-3 py-2 text-[11px] font-semibold text-on-surface outline-hidden transition-colors placeholder:text-on-surface-muted/55 focus:border-accent/45 md:w-[240px]"
        />
        <button
          type="button"
          onClick={runDiagnostics}
          disabled={running}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[10px] font-semibold text-on-accent transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {running ? t('experiment.stats_pipeline_diagnostics.running') : t('experiment.stats_pipeline_diagnostics.run')}
        </button>
        <button
          type="button"
          onClick={copySummaryReport}
          disabled={!summaryText || running}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Clipboard className="h-3.5 w-3.5" />
          {t('experiment.stats_pipeline_diagnostics.copy')}
        </button>
        <button
          type="button"
          onClick={copyRawReport}
          disabled={!rawReportText || running}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FileJson className="h-3.5 w-3.5" />
          {t('experiment.stats_pipeline_diagnostics.copy_raw')}
        </button>
        <button
          type="button"
          onClick={clearReport}
          disabled={!report && !feedback}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('experiment.stats_pipeline_diagnostics.clear')}
        </button>
      </div>

      {feedback ? (
        <p className="mt-2 text-[10px] text-on-surface-muted">
          {feedback}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-on-surface-muted">
            <Activity className="h-3.5 w-3.5" />
            {t('experiment.stats_pipeline_diagnostics.metric_overall')}
          </div>
          <div className="mt-1 text-sm font-bold tabular-nums text-on-surface">
            {report?.diagnosis?.overall || '--'}
          </div>
        </div>
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.stats_pipeline_diagnostics.metric_elapsed')}
          </div>
          <div className="mt-1 text-sm font-bold tabular-nums text-on-surface">
            {signals ? formatMs(signals.runtimeActiveElapsedMs) : '--'}
          </div>
        </div>
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-on-surface-muted">
            <Database className="h-3.5 w-3.5" />
            {t('experiment.stats_pipeline_diagnostics.metric_hourly')}
          </div>
          <div className="mt-1 text-sm font-bold tabular-nums text-on-surface">
            {signals ? signals.statsHourlyRows : '--'}
          </div>
        </div>
        <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.stats_pipeline_diagnostics.metric_today')}
          </div>
          <div className="mt-1 text-sm font-bold tabular-nums text-on-surface">
            {signals ? formatMs(signals.todayActiveMs) : '--'}
          </div>
        </div>
      </div>

      {primaryStage ? (
        <div className={`mt-3 rounded-lg border px-3 py-2 ${resolveStatusClassName(primaryStage.status)}`}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase">
            <StatusIcon status={primaryStage.status} />
            {t('experiment.stats_pipeline_diagnostics.primary_stage')}
          </div>
          <div className="mt-1 text-sm font-bold">
            {getStageLabel(t, primaryStage.key)}
          </div>
          <div className="mt-1 text-[11px] font-medium opacity-90">
            {getCodeLabel(t, primaryStage.code)}
          </div>
        </div>
      ) : null}

      {criticalPath.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
                {t('experiment.stats_pipeline_diagnostics.stage_sequence')}
              </p>
              <p className="text-[11px] leading-snug text-on-surface-muted">
                {t('experiment.stats_pipeline_diagnostics.stage_sequence_desc')}
              </p>
            </div>
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {criticalPath.map((stage, index) => (
              <PipelineStageCard
                key={stage.key}
                stage={stage}
                index={index}
                total={criticalPath.length}
                signals={signals || {}}
                t={t}
              />
            ))}
          </div>
        </div>
      ) : null}

      {signals ? (
        <div className="mt-4">
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
              {t('experiment.stats_pipeline_diagnostics.boundary_title')}
            </p>
            <p className="text-[11px] leading-snug text-on-surface-muted">
              {t('experiment.stats_pipeline_diagnostics.boundary_desc')}
            </p>
          </div>
          <BoundaryRail rows={buildReadBoundaryRows(t, signals)} />
        </div>
      ) : null}

      {report ? (
        <div className="mt-4">
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
              {t('experiment.stats_pipeline_diagnostics.target_matrix')}
            </p>
            <p className="text-[11px] leading-snug text-on-surface-muted">
              {t('experiment.stats_pipeline_diagnostics.target_matrix_desc')}
            </p>
          </div>
          <TargetDomainMatrix rows={report.targetDomainFacts || []} t={t} />
        </div>
      ) : null}

      {report?.diagnosis?.observations?.length ? (
        <div className="mt-4">
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
              {t('experiment.stats_pipeline_diagnostics.observations')}
            </p>
            <p className="text-[11px] leading-snug text-on-surface-muted">
              {t('experiment.stats_pipeline_diagnostics.observations_desc')}
            </p>
          </div>
          <ObservationList report={report} t={t} />
        </div>
      ) : null}

      {summaryText ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-on-surface-muted">
          <span>{t('experiment.stats_pipeline_diagnostics.summary_size', {
            lines: summaryLineCount,
            bytes: formatBytes(summaryText.length),
          })}</span>
          <span>{t('experiment.stats_pipeline_diagnostics.raw_size', {
            lines: rawLineCount,
            bytes: formatBytes(rawReportText.length),
          })}</span>
        </div>
      ) : null}

      {summaryPreviewText ? (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.stats_pipeline_diagnostics.report_preview')}
          </p>
          <pre className="max-h-48 overflow-auto rounded-lg border border-on-surface/10 bg-surface-sunken/60 p-3 text-[10px] leading-relaxed text-on-surface-muted">
            {summaryPreviewText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
