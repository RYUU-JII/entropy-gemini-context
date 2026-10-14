import { getLocalDateStr, isHostnameInList } from '../../../../lib/index.js';
import {
  parseLocalDateParts,
  shiftDateStr,
} from '../../shared/dateMath.js';
import {
  DAY_MS,
  buildScoreSetupRecommendations,
  buildStatsAnalysisGoals,
  buildStatsAnalysisPolicyFingerprint,
  buildStatsAnalysisPolicyInput,
  buildStatsDashboardPolicyInput,
  calculateCycleStats,
  calculateYesterdayFocusScore,
  USAGE_BASELINE_POLICY,
} from '../../analysis/index.js';
import {
  createStatsPolicyContext,
  projectStatsWindow,
} from '../../projection/index.js';
import { STATS_READ_MODEL_BASIS } from '../contracts/statsReadModelContracts.js';
import {
  DEFAULT_ACTIVITY_DAY_RESET_HOUR,
  resolveActivityDayWindow,
} from '../../shared/activityDay.js';
import { resolveStatsDaysBack } from './statsFactsRepositoryReadUtils.js';
import { SITE_PULL_BASELINE_SOURCE_TARGET_DAYS } from '../../insights/sitePull/baselineSeriesSource.js';
import { readAnalysisStatsRange } from './statsAnalysisStatsRange.js';

const DEFAULT_CYCLE_WINDOW_DAYS = 7;
const DEFAULT_CYCLE_ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const DEFAULT_CYCLE_WAKE_WINDOW_HOURS = 3;
const DEFAULT_CYCLE_RESET_HOUR = DEFAULT_ACTIVITY_DAY_RESET_HOUR;
const DEFAULT_YESTERDAY_PROJECTION_DAYS = 10;

export const STATUS_OVERVIEW_DAYS = 7;
export const STATUS_SNAPSHOT_EVIDENCE_DAYS = USAGE_BASELINE_POLICY.windowDays + 1;
export const SITES_OVERVIEW_DAYS = 7;
export const SITE_PULL_BASELINE_DAYS = SITE_PULL_BASELINE_SOURCE_TARGET_DAYS;
export const SITE_PULL_BASELINE_READ_DAYS = SITE_PULL_BASELINE_DAYS + 1;
export const STATUS_TOP_DOMAIN_COUNT = 16;
export const WINDOW_TOP_DOMAIN_COUNT = 8;

export function cloneCycleState(value) {
  return value && typeof value === 'object' ? { ...value } : null;
}

export function normalizeAnalysisStats(value) {
  return readAnalysisStatsRange(value);
}

export function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clampHour(value, fallback = DEFAULT_CYCLE_RESET_HOUR) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(23, Math.max(0, Math.floor(numeric)));
}

export function resolveEffectiveResetHour(cycleState) {
  const policyHour = Number(cycleState?.resetPolicy?.effectiveResetHour);
  if (Number.isFinite(policyHour)) return clampHour(policyHour);
  const directHour = Number(cycleState?.effectiveResetHour);
  if (Number.isFinite(directHour)) return clampHour(directHour);
  return DEFAULT_CYCLE_RESET_HOUR;
}

export function isTrackingExcludedDomain(domain, trackingExcludedUrls = []) {
  return isHostnameInList(domain, trackingExcludedUrls);
}

export function normalizeDomainKey(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function isPolicyOverrideObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function createInvalidPolicyOverrideError() {
  const error = new Error('STATS_POLICY_OVERRIDE_INVALID');
  error.code = 'STATS_POLICY_OVERRIDE_INVALID';
  return error;
}

function createStatsQueryContractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function normalizePolicyOverride(policyInput = null, fallback = null) {
  if (policyInput !== null && typeof policyInput !== 'undefined') {
    if (!isPolicyOverrideObject(policyInput)) {
      throw createInvalidPolicyOverrideError();
    }
    return buildStatsDashboardPolicyInput(policyInput);
  }
  if (fallback !== null && typeof fallback !== 'undefined') {
    if (!isPolicyOverrideObject(fallback)) {
      throw createInvalidPolicyOverrideError();
    }
    return buildStatsDashboardPolicyInput(fallback);
  }
  return buildStatsDashboardPolicyInput({});
}

export function normalizeOptionalStatsCycleState(
  value,
  code = 'STATS_QUERY_CYCLE_STATE_INVALID',
) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createStatsQueryContractError(code);
  }
  return value;
}

export async function readOptionalStatsCycleState(
  getCycleState,
  {
    now = Date.now(),
    code = 'STATS_QUERY_CYCLE_STATE_INVALID',
  } = {},
) {
  return normalizeOptionalStatsCycleState(
    await Promise.resolve(getCycleState({ now })),
    code,
  );
}

export async function readRequiredStatsSettingsSnapshot(
  getSettingsSnapshot,
  code = 'STATS_QUERY_SETTINGS_SNAPSHOT_REQUIRED',
) {
  const settingsSnapshot = await Promise.resolve(getSettingsSnapshot());
  if (
    !settingsSnapshot
    || typeof settingsSnapshot !== 'object'
    || Array.isArray(settingsSnapshot)
  ) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return settingsSnapshot;
}

export function resolveProjectionDaysBack(cycleState, maxDaysStored, now = Date.now()) {
  const cycleStart = Number(cycleState?.currentCycleStart);
  if (!Number.isFinite(cycleStart) || cycleStart <= 0) {
    return resolveStatsDaysBack(DEFAULT_YESTERDAY_PROJECTION_DAYS, {
      fallbackDays: DEFAULT_YESTERDAY_PROJECTION_DAYS,
      maxDays: maxDaysStored,
    });
  }

  const elapsedDays = Math.max(1, Math.ceil((now - cycleStart) / DAY_MS));
  return resolveStatsDaysBack(elapsedDays + 1, {
    fallbackDays: elapsedDays + 1,
    maxDays: maxDaysStored,
  });
}

export function resolveReadModelDaysBack(cycleState, maxDaysStored, minimumDays, now = Date.now()) {
  const projectionDaysBack = resolveProjectionDaysBack(cycleState, maxDaysStored, now);
  return resolveStatsDaysBack(Math.max(minimumDays, projectionDaysBack), {
    fallbackDays: Math.max(minimumDays, projectionDaysBack),
    maxDays: maxDaysStored,
  });
}

export function buildCycleProjection({
  statsRange,
  cycleState,
  settingsSnapshot,
  policyInput = null,
  now = Date.now(),
} = {}) {
  const stats = normalizeAnalysisStats(statsRange);
  const siteLists = buildStatsAnalysisPolicyInput(
    normalizePolicyOverride(policyInput, settingsSnapshot),
  );
  const goals = buildStatsAnalysisGoals(siteLists);
  const blockedUrls = siteLists.blockedUrls;
  const policyFingerprint = buildStatsAnalysisPolicyFingerprint(siteLists);

  let cycleSnapshot = null;
  if (cycleState?.currentCycleStart) {
    cycleSnapshot = calculateCycleStats(
      stats,
      blockedUrls,
      cycleState.currentCycleStart,
      now,
      { goals, siteLists },
    );
  } else {
    cycleSnapshot = calculateYesterdayFocusScore(stats, blockedUrls, {
      windowDays: DEFAULT_CYCLE_WINDOW_DAYS,
      deltaWeight: 0.5,
      activeThresholdMs: DEFAULT_CYCLE_ACTIVE_THRESHOLD_MS,
      wakeWindowHours: DEFAULT_CYCLE_WAKE_WINDOW_HOURS,
      goals,
      siteLists,
      requireWakeActivity: true,
    });
  }

  if (!cycleSnapshot || typeof cycleSnapshot !== 'object') {
    return {
      policyBasis: 'current',
      policyFingerprint,
      computedAtEpochMs: now,
      available: false,
    };
  }

  return {
    ...cycleSnapshot,
    policyBasis: 'current',
    policyFingerprint,
    computedAtEpochMs: now,
    available: true,
  };
}

export function resolveCycleWindowQuery(cycleSnapshot) {
  const cycleWindow = cycleSnapshot?.window;
  if (!cycleWindow || typeof cycleWindow !== 'object') return null;

  const startDateStr = cycleWindow.startDateStr;
  const endDateStr = cycleWindow.endDateStr;

  if (!startDateStr || !endDateStr) return null;

  const startHour = cycleWindow.startHour;
  const endHour = cycleWindow.endHour;
  if (
    !Number.isInteger(startHour)
    || startHour < 0
    || startHour > 23
    || !Number.isInteger(endHour)
    || endHour < 0
    || endHour > 23
  ) return null;
  return { startDateStr, endDateStr, startHour, endHour };
}

export function resolveRhythmDayRange({
  now = Date.now(),
  resetHour = DEFAULT_CYCLE_RESET_HOUR,
} = {}) {
  return resolveActivityDayWindow({ now, resetHour });
}

function buildActivityDayRangeForDateStr(activityDateStr, resetHour) {
  const parts = parseLocalDateParts(activityDateStr);
  if (!parts) return null;
  const boundaryHour = clampHour(resetHour);
  const start = new Date(parts.year, parts.month - 1, parts.day, boundaryHour, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setHours(end.getHours() + 23);
  return {
    basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
    activityDateStr,
    resetHour: boundaryHour,
    startDateStr: getLocalDateStr(start.getTime()),
    endDateStr: getLocalDateStr(end.getTime()),
    startHour: boundaryHour,
    endHour: Math.max(0, Math.min(23, Math.floor(end.getHours()))),
    startEpochMs: start.getTime(),
    endEpochMs: end.getTime(),
  };
}

export function buildActivityDayPeriodSeries({
  now = Date.now(),
  resetHour = DEFAULT_CYCLE_RESET_HOUR,
  count = 7,
} = {}) {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const currentRange = resolveRhythmDayRange({ now, resetHour });
  const currentActivityDateStr = currentRange.startDateStr;
  return Array.from({ length: safeCount }, (_, index) => {
    const ageDays = safeCount - 1 - index;
    const activityDateStr = shiftDateStr(currentActivityDateStr, -ageDays);
    const range = activityDateStr ? buildActivityDayRangeForDateStr(activityDateStr, resetHour) : null;
    const resolvedResetHour = range?.resetHour ?? clampHour(resetHour);
    if (!range) {
      return {
        basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
        activityDateStr: null,
        ageDays,
        resetHour: resolvedResetHour,
        current: false,
        range: null,
      };
    }
    return {
      basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
      activityDateStr,
      ageDays,
      resetHour: range.resetHour,
      current: ageDays === 0,
      range,
    };
  });
}

export function projectActivityDayPeriodSeries({
  stats,
  policyContext,
  periods = [],
  filter = {},
} = {}) {
  return (Array.isArray(periods) ? periods : []).map((period) => {
    const range = period?.range;
    if (!range || !period?.activityDateStr) {
      return {
        period,
        projection: {
          totals: null,
          domainTotals: [],
          hourlyBuckets: [],
        },
      };
    }
    const projection = projectStatsWindow({
      statsRange: stats,
      policyContext,
      filter,
      startDateStr: range.startDateStr,
      endDateStr: range.endDateStr,
      startHour: range.startHour,
      endHour: range.endHour,
    });
    return {
      period,
      projection: {
        ...projection,
        basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
        resetHour: range.resetHour,
        range: {
          ...(projection?.range || {}),
          basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
          activityDateStr: period.activityDateStr,
          resetHour: range.resetHour,
          startEpochMs: range.startEpochMs,
          endEpochMs: range.endEpochMs,
        },
        hourlyBuckets: Array.isArray(projection?.buckets) ? projection.buckets : [],
      },
    };
  });
}

export function buildSiteDetails(domainTotals = []) {
  const details = {};
  (Array.isArray(domainTotals) ? domainTotals : []).forEach((entry) => {
    const domain = typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : '';
    if (!domain) return;
    details[domain] = toNumber(entry?.activeMs);
  });
  return details;
}

export function buildRhythmDayProjection({
  stats,
  policyContext,
  cycleState,
  filter = {},
  now = Date.now(),
} = {}) {
  const resetHour = resolveEffectiveResetHour(cycleState);
  const range = resolveRhythmDayRange({ now, resetHour });
  const projection = projectStatsWindow({
    statsRange: stats,
    policyContext,
    filter: {
      ...(filter && typeof filter === 'object' ? filter : {}),
      includeTopDomains: true,
      topN: STATUS_TOP_DOMAIN_COUNT,
    },
    startDateStr: range.startDateStr,
    endDateStr: range.endDateStr,
    startHour: range.startHour,
    endHour: range.endHour,
  });
  const domainTotals = Array.isArray(projection?.domainTotals) ? projection.domainTotals : [];

  return {
    basis: STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
    resetHour,
    range: {
      ...(projection?.range || {}),
      startEpochMs: range.startEpochMs,
      endEpochMs: range.endEpochMs,
    },
    totals: projection?.totals || null,
    domainTotals,
    siteDetails: buildSiteDetails(domainTotals),
    hourlyBuckets: Array.isArray(projection?.buckets) ? projection.buckets : [],
  };
}

export function getRecentDateStrings(days, now = Date.now()) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 1));
  const base = new Date(now);
  return Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (safeDays - 1 - index));
    return getLocalDateStr(date.getTime());
  });
}

export function buildScoreSetupReadModel({
  coverage = null,
  domainCandidates = [],
  siteGoals = {},
} = {}) {
  return {
    coverage,
    recommendations: buildScoreSetupRecommendations({
      domainCandidates,
      siteGoals,
    }),
  };
}

export { createStatsPolicyContext };
