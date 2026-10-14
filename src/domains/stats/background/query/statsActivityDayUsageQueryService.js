import { createStatsPolicyContext, projectStatsWindow } from '../../projection/index.js';
import { resolveActivityDayWindow } from '../../shared/activityDay.js';
import { shiftDateStr } from '../../shared/dateMath.js';
import { normalizeAnalysisStatsRangeAtBoundary } from './statsAnalysisStatsRange.js';
import { projectSiteFurinReflection } from './siteFurinReflectionProjection.js';
import { buildStatsDashboardPolicyFingerprint } from '../../analysis/policySnapshot.js';
import { resolveRecordingProjectionDomains } from './statsRecordingScope.js';
import { projectProtectionBudgetWindow } from '../../projection/projectProtectionBudget.js';
import { resolveSitesRecordingPolicy } from '../../../settings/config/dataCollectionPolicy.js';

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireClassificationSettings(settings) {
  if (!isPlainObject(settings)) throw new Error('STATS_ACTIVITY_DAY_USAGE_SETTINGS_REQUIRED');
  for (const key of ['blockedUrls', 'allowedUrls', 'trackingExcludedUrls']) {
    if (!Array.isArray(settings[key])) {
      throw new Error(`STATS_ACTIVITY_DAY_USAGE_SETTINGS_INVALID:${key}`);
    }
  }
  if (typeof settings.filteringMode !== 'string' || !settings.filteringMode.trim()) {
    throw new Error('STATS_ACTIVITY_DAY_USAGE_SETTINGS_INVALID:filteringMode');
  }
  if (!isPlainObject(settings.siteRuleTimeline)) {
    throw new Error('STATS_ACTIVITY_DAY_USAGE_SETTINGS_INVALID:siteRuleTimeline');
  }
  return settings;
}

// Compact, disposable read model shared by protection and popup. Calendar/hourly
// facts remain authoritative; an activity-day range is never persisted as facts.
export function createStatsActivityDayUsageQueryService({ getStatsFactsRange, getCycleState, getSettingsSnapshot } = {}) {
  if (typeof getStatsFactsRange !== 'function' || typeof getCycleState !== 'function' || typeof getSettingsSnapshot !== 'function') {
    throw new Error('STATS_ACTIVITY_DAY_USAGE_OWNERS_REQUIRED');
  }
  let cached = null;

  async function getActivityDayUsageRange({ now = Date.now(), daysBack = 8 } = {}) {
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now).getTime())
      || !Number.isInteger(daysBack) || daysBack < 1 || daysBack > 30) {
      throw new Error('STATS_ACTIVITY_DAY_USAGE_QUERY_INVALID');
    }
    const cycleState = await getCycleState({ now });
    const resetHour = cycleState?.resetPolicy?.effectiveResetHour;
    if (!Number.isInteger(resetHour) || resetHour < 0 || resetHour > 23) {
      throw new Error('STATS_ACTIVITY_DAY_USAGE_RESET_HOUR_INVALID');
    }
    const settings = requireClassificationSettings(await getSettingsSnapshot());
    const recording = resolveSitesRecordingPolicy(settings);
    const policyContext = createStatsPolicyContext(settings);
    const policyKey = buildStatsDashboardPolicyFingerprint(settings);
    const facts = await getStatsFactsRange({ daysBack: daysBack + 1 });
    const window = resolveActivityDayWindow({ now, resetHour });
    const dateStr = window.startDateStr;
    if (cached?.facts === facts && cached.dateStr === dateStr && cached.resetHour === resetHour
      && cached.daysBack === daysBack && cached.policyKey === policyKey) return cached.result;

    const statsRange = normalizeAnalysisStatsRangeAtBoundary(facts);
    const filter = { domains: resolveRecordingProjectionDomains(statsRange, settings) };
    const dates = {};
    for (let offset = daysBack - 1; offset >= 0; offset -= 1) {
      const startDateStr = shiftDateStr(dateStr, -offset);
      const endDateStr = resetHour === 0 ? startDateStr : shiftDateStr(startDateStr, 1);
      const projection = projectStatsWindow({
        statsRange, policyContext, filter,
        startDateStr, endDateStr,
        startHour: resetHour, endHour: resetHour === 0 ? 23 : resetHour - 1,
      });
      const budget = projectProtectionBudgetWindow({
        statsRange, startDateStr, endDateStr,
        trackingExcludedUrls: settings.trackingExcludedUrls,
        startHour: resetHour, endHour: resetHour === 0 ? 23 : resetHour - 1,
      });
      const protectedActive = recording.globalCapAvailable ? budget.totalExposure : 0;
      // Missing collection evidence is not an observed zero-use day.
      const observed = projection.domainTotals.some((entry) => entry.collectionObservation.observed);
      if (!observed && projection.totals.totalMs === 0 && protectedActive === 0) continue;
      dates[startDateStr] = {
        domains: Object.fromEntries(projection.domainTotals.map((entry) => [entry.domain, {
          active: entry.activeMs, background: entry.backgroundMs,
          protectedActive: budget.byDomain[entry.domain],
          ...(offset === 0 ? { reflection: projectSiteFurinReflection({ statsRange,
            hostname:entry.domain, startAt:window.startEpochMs, observedAt:now, activeMs:budget.byDomain[entry.domain] }) } : {}),
        }])),
        totals: {
          totalActive: projection.totals.activeMs,
          totalBackground: projection.totals.backgroundMs,
          blockedActive: protectedActive,
        },
      };
    }
    const result = { basis: 'activity-day', resetHour, dateStr, dates };
    cached = { facts, dateStr, resetHour, daysBack, policyKey, result };
    return result;
  }
  return { getActivityDayUsageRange };
}
