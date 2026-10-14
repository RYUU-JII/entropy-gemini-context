import { getLocalDateStr } from '../../../lib/index.js';
import { shiftDateStr } from '../../stats/shared/dateMath.js';
import {
  BASIC_RECENT_USAGE_TRAJECTORY_VERSION,
  BASIC_RECENT_USAGE_WINDOW_DAYS,
  requireBasicRecentUsageTrajectory,
  resolveBasicRecentUsageStatus,
} from '../strategy/contracts/basicStrategyContextContract.js';
import {
  PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_ROLES,
} from '../../../lib/personalBaselineContract.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireNow(now) {
  if (typeof now !== 'number' || !Number.isFinite(now) || now < 0) {
    throw new Error('BASIC_RECENT_USAGE_NOW_INVALID');
  }
  return now;
}

function requireThresholdMs(thresholdMs) {
  if (typeof thresholdMs !== 'number' || !Number.isFinite(thresholdMs) || thresholdMs < 0) {
    throw new Error('BASIC_RECENT_USAGE_THRESHOLD_INVALID');
  }
  return thresholdMs;
}

function normalizeHostname(hostname) {
  const normalized = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!normalized) throw new Error('BASIC_RECENT_USAGE_HOSTNAME_REQUIRED');
  return normalized;
}

function shiftLocalCalendarDate(now, offsetDays) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return getLocalDateStr(date.getTime());
}

export function getBasicRecentUsageDateWindow(now, statsRange = null) {
  const normalizedNow = requireNow(now);
  if (statsRange?.basis === 'activity-day') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(statsRange.dateStr)) throw new Error('BASIC_RECENT_USAGE_ACTIVITY_DATE_INVALID');
    return {
      currentDateStr: statsRange.dateStr,
      completedDateStrs: Array.from({ length: BASIC_RECENT_USAGE_WINDOW_DAYS }, (_, index) => (
        shiftDateStr(statsRange.dateStr, index - BASIC_RECENT_USAGE_WINDOW_DAYS)
      )),
    };
  }
  const currentDateStr = getLocalDateStr(normalizedNow);
  const completedDateStrs = Array.from(
    { length: BASIC_RECENT_USAGE_WINDOW_DAYS },
    (_, index) => shiftLocalCalendarDate(
      normalizedNow,
      index - BASIC_RECENT_USAGE_WINDOW_DAYS,
    ),
  );
  return {
    currentDateStr,
    completedDateStrs,
  };
}

function readStatsDates(statsRange) {
  if (statsRange === null || statsRange === undefined) return {};
  if (!isPlainObject(statsRange) || !isPlainObject(statsRange.dates)) {
    throw new Error('BASIC_RECENT_USAGE_STATS_RANGE_INVALID');
  }
  return statsRange.dates;
}

function readObservedDomainActiveMs({ dates, dateStr, hostname }) {
  if (!Object.prototype.hasOwnProperty.call(dates, dateStr)) {
    return { observed: false, activeMs: null };
  }

  const day = dates[dateStr];
  if (!isPlainObject(day) || !isPlainObject(day.domains)) {
    throw new Error(`BASIC_RECENT_USAGE_DAY_FACT_INVALID:${dateStr}`);
  }
  if (!Object.prototype.hasOwnProperty.call(day.domains, hostname)) {
    return { observed: true, activeMs: 0 };
  }

  const domain = day.domains[hostname];
  if (!isPlainObject(domain)
    || typeof domain.active !== 'number'
    || !Number.isFinite(domain.active)
    || domain.active < 0) {
    throw new Error(`BASIC_RECENT_USAGE_DOMAIN_ACTIVE_FACT_INVALID:${dateStr}:${hostname}`);
  }
  return { observed: true, activeMs: domain.active };
}

export function buildBasicProtectionRecentUsageTrajectory({
  statsRange = null,
  hostname = '',
  now,
  thresholdMs = 0,
} = {}) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedThresholdMs = requireThresholdMs(thresholdMs);
  const dates = readStatsDates(statsRange);
  const { currentDateStr, completedDateStrs } = getBasicRecentUsageDateWindow(now, statsRange);
  const observations = completedDateStrs.map((dateStr) => {
    const fact = readObservedDomainActiveMs({
      dates,
      dateStr,
      hostname: normalizedHostname,
    });
    return {
      dateStr,
      observed: fact.observed,
      activeMs: fact.activeMs,
      exceeded: fact.observed
        && normalizedThresholdMs > 0
        && fact.activeMs > normalizedThresholdMs,
    };
  });
  const observed = observations.filter((observation) => observation.observed);
  const observedDays = observed.length;
  const activeTotalMs = observed.reduce((sum, observation) => sum + observation.activeMs, 0);

  return requireBasicRecentUsageTrajectory({
    version: BASIC_RECENT_USAGE_TRAJECTORY_VERSION,
    role: PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
    grain: PERSONAL_BASELINE_METRIC_GRAINS.DAY,
    status: resolveBasicRecentUsageStatus(observedDays),
    provenance: {
      source: 'stats_dates_domain_active',
      windowBasis: statsRange?.basis === 'activity-day' ? 'completed_activity_days' : 'completed_calendar_days',
      excludeCurrent: true,
    },
    window: {
      currentDateStr,
      startDateStr: completedDateStrs[0],
      endDateStr: completedDateStrs[completedDateStrs.length - 1],
      targetDays: BASIC_RECENT_USAGE_WINDOW_DAYS,
    },
    evidence: {
      observedDays,
      missingDays: BASIC_RECENT_USAGE_WINDOW_DAYS - observedDays,
      zeroDays: observed.filter((observation) => observation.activeMs === 0).length,
      positiveDays: observed.filter((observation) => observation.activeMs > 0).length,
      exceededDays: observed.filter((observation) => observation.exceeded).length,
      thresholdMs: normalizedThresholdMs,
    },
    averageDailyMs: observedDays > 0 ? activeTotalMs / observedDays : null,
    observations,
  });
}
