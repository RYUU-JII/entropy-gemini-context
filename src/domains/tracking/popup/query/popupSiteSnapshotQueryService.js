import { isAdaptiveFrictionFeatureKey } from '../../../settings/config/adaptiveFrictionProfiles.js';
import { requireFrictionIntensityBand } from '../../../settings/config/frictionIntensityBands.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import {
  getHostname,
  isHostnameInList,
  requireConcreteOriginPermissions,
} from '../../../../lib/index.js';
import { shiftDateStr } from '../../../stats/shared/dateMath.js';
import { resolveActivityDayWindow } from '../../../stats/shared/activityDay.js';
import {
  buildEmptyPopupSiteSnapshot,
  normalizePopupSiteSnapshot,
} from '../contracts/popupSiteSnapshot.js';
import {
  FILTER_EXECUTION_SOURCES,
  normalizeFilterExecutionSource,
} from '../../../protection/contracts/filterExecutionContracts.js';
import { normalizeInterventionPlan } from '../../../protection/contracts/protectionContracts.js';

const DEFAULT_POPUP_STATS_DAYS = 7;
const HIDDEN_DIAGNOSTIC_FILTER_KEYS = new Set([
  'socialEngagement',
  'socialExposure',
]);

function isSupportedPopupUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolvePopupSiteScope(request = {}) {
  const pageUrl = typeof request?.pageUrl === 'string'
    ? request.pageUrl.trim()
    : typeof request?.url === 'string'
      ? request.url.trim()
      : '';
  const derivedHostname = normalizeDomain(request?.hostname || request?.domain || getHostname(pageUrl) || '');
  const supported = !!derivedHostname && isSupportedPopupUrl(pageUrl || `https://${derivedHostname}`);

  return {
    pageUrl,
    hostname: derivedHostname,
    supported,
  };
}

function resolveProtectionArtifacts(runtime = null) {
  const artifacts = runtime?.plan?.artifacts && typeof runtime.plan.artifacts === 'object'
    ? runtime.plan.artifacts
    : {};

  const activeArtifacts = [];
  const standbyArtifacts = [];

  Object.entries(artifacts).forEach(([artifactId, state]) => {
    if (state === 'engaged') {
      activeArtifacts.push(artifactId);
      return;
    }
    if (state === 'armed') {
      standbyArtifacts.push(artifactId);
    }
  });

  return { activeArtifacts, standbyArtifacts };
}

function resolveProtectionFilters(plan = null) {
  const filterPlan = plan?.filterPlan && typeof plan.filterPlan === 'object'
    ? plan.filterPlan
    : {};

  return Object.entries(filterPlan)
    .filter(([key, entry]) => !!entry?.isActive && !HIDDEN_DIAGNOSTIC_FILTER_KEYS.has(key))
    .map(([key, entry]) => ({
      key,
      band: isAdaptiveFrictionFeatureKey(key) ? requireFrictionIntensityBand(entry.band) : null,
      source: normalizeFilterExecutionSource(
        entry.executionSource,
        FILTER_EXECUTION_SOURCES.USER_CONFIG,
      ),
      policyLevel: Number.isFinite(Number(entry.policyLevel)) ? Number(entry.policyLevel) : null,
      policyApplied: entry.policyApplied === true,
      runtimeArtifactId: typeof entry.runtimeArtifactId === 'string' ? entry.runtimeArtifactId : '',
    }));
}

function normalizeStatsDaysBack(value, fallback = DEFAULT_POPUP_STATS_DAYS) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
}

function requirePermissionSnapshot(snapshot) {
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || Array.isArray(snapshot)
    || !Array.isArray(snapshot.permissions)
    || !Array.isArray(snapshot.origins)
  ) {
    throw new Error('POPUP_SITE_SNAPSHOT_QUERY_PERMISSIONS_RESULT_INVALID');
  }
  return {
    permissions: snapshot.permissions,
    origins: requireConcreteOriginPermissions(
      snapshot.origins,
      'POPUP_SITE_PERMISSION_ORIGIN_CONTRACT_INVALID',
    ),
  };
}

function requireStatsFactsRange(statsRange) {
  if (
    !statsRange
    || typeof statsRange !== 'object'
    || Array.isArray(statsRange)
    || !statsRange.dates
    || typeof statsRange.dates !== 'object'
    || Array.isArray(statsRange.dates)
  ) {
    throw new Error('POPUP_SITE_SNAPSHOT_QUERY_FACTS_RESULT_INVALID');
  }
  return statsRange;
}

export function createPopupSiteSnapshotQueryService({
  getProtectionRuntimeSnapshot,
  getGrantedPermissions,
  getActivityDayUsageRange,
  settingsCache,
  settingsService,
  readSiteRegistrationJourney,
  statsDaysBack = DEFAULT_POPUP_STATS_DAYS,
} = {}) {
  if (typeof getActivityDayUsageRange !== 'function') {
    throw new Error('POPUP_SITE_SNAPSHOT_QUERY_ACTIVITY_DAY_REQUIRED');
  }
  if (typeof readSiteRegistrationJourney !== 'function') {
    throw new Error('POPUP_SITE_REGISTRATION_JOURNEY_OWNER_REQUIRED');
  }
  if (typeof settingsService?.ensureSettingsCache !== 'function') {
    throw new Error('POPUP_SITE_SNAPSHOT_QUERY_SETTINGS_REQUIRED');
  }
  if (typeof getGrantedPermissions !== 'function') {
    throw new Error('POPUP_SITE_SNAPSHOT_QUERY_PERMISSIONS_REQUIRED');
  }
  if (typeof getProtectionRuntimeSnapshot !== 'function') {
    throw new Error('POPUP_SITE_SNAPSHOT_QUERY_PROTECTION_RUNTIME_REQUIRED');
  }

  const resolvedStatsDaysBack = normalizeStatsDaysBack(statsDaysBack);

  async function getPopupSiteSnapshot({ request } = {}) {
    await settingsService.ensureSettingsCache();

    const scope = resolvePopupSiteScope(request);
    const registrationJourney = await readSiteRegistrationJourney();
    if (!scope.supported) {
      return normalizePopupSiteSnapshot({
        ...buildEmptyPopupSiteSnapshot(),
        capturedAt: Date.now(),
        site: scope,
        access: { ...buildEmptyPopupSiteSnapshot().access,
          requiresDashboardRegistration: registrationJourney.requiresDashboardRegistration,
          sitesManagementVisible: registrationJourney.sitesManagementVisible },
      });
    }

    const capturedAt = Date.now();
    const [statsRangeResult, runtime] = await Promise.all([
      getActivityDayUsageRange({ now: capturedAt, daysBack: resolvedStatsDaysBack }),
      getProtectionRuntimeSnapshot({ hostname: scope.hostname }),
    ]);
    const statsRange = requireStatsFactsRange(statsRangeResult);
    if (statsRange.basis !== 'activity-day') throw new Error('POPUP_SITE_SNAPSHOT_QUERY_ACTIVITY_DAY_BASIS_REQUIRED');
    if (!Number.isInteger(statsRange.resetHour)) throw new Error('POPUP_SITE_SNAPSHOT_QUERY_RESET_HOUR_REQUIRED');
    const activityDay = resolveActivityDayWindow({ now: capturedAt, resetHour: statsRange.resetHour });
    const todayDateStr = statsRange.dateStr;
    if (todayDateStr !== activityDay.startDateStr) throw new Error('POPUP_SITE_SNAPSHOT_QUERY_ACTIVITY_DAY_MISMATCH');
    const todayStats = statsRange.dates[todayDateStr] || null;
    const hasTodayStats = !!todayStats;
    const windowDates = Array.from({ length: resolvedStatsDaysBack }, (_, index) => shiftDateStr(todayDateStr, -index));
    const totalWindowMs = windowDates.reduce((sum, date) => sum + (statsRange.dates[date]?.domains[scope.hostname]?.active ?? 0), 0);
    const todayMs = todayStats?.domains[scope.hostname]?.active ?? 0;
    const trackedTodayMs = todayStats?.totals.totalActive ?? 0;
    const activePlan = runtime?.plan && typeof runtime.plan === 'object'
      ? normalizeInterventionPlan(runtime.plan)
      : null;
    const { activeArtifacts, standbyArtifacts } = resolveProtectionArtifacts(runtime);
    const activeFilters = resolveProtectionFilters(activePlan);
    const blockedUrls = Array.isArray(settingsCache?.blockedUrls) ? settingsCache.blockedUrls : [];
    const allowedUrls = Array.isArray(settingsCache?.allowedUrls) ? settingsCache.allowedUrls : [];
    const siteGoals = settingsCache?.siteGoals && typeof settingsCache.siteGoals === 'object'
      ? settingsCache.siteGoals
      : {};
    const granted = requirePermissionSnapshot(await getGrantedPermissions());
    const origins = granted.origins;
    const managedSiteCount = new Set([...blockedUrls, ...allowedUrls]).size;

    return normalizePopupSiteSnapshot({
      capturedAt,
      refreshAt: activityDay.nextStartEpochMs,
      site: scope,
      metrics: {
        dateStr: todayDateStr,
        hasTodayStats,
        todayMs,
        weeklyAverageDailyMs: totalWindowMs / resolvedStatsDaysBack,
        trackedTodayMs,
        shareOfTracked: trackedTodayMs > 0 ? todayMs / trackedTodayMs : 0,
      },
      protection: {
        isProtected: isHostnameInList(scope.hostname, blockedUrls),
        goalMinutes: Math.max(0, Math.floor(Number(siteGoals[scope.hostname] || 0))),
        level: Number(activePlan?.state?.level || 1),
        reasons: Array.isArray(activePlan?.state?.reasons) ? activePlan.state.reasons : [],
        activeFilters,
        activeArtifacts,
        standbyArtifacts,
      },
      access: {
        permissionMode: 'selective',
        managedSiteCount,
        requiresDashboardRegistration: registrationJourney.requiresDashboardRegistration,
        sitesManagementVisible: registrationJourney.sitesManagementVisible,
      },
    });
  }

  return {
    getPopupSiteSnapshot,
  };
}
