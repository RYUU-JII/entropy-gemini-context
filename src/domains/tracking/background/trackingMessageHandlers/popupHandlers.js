import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { resolvePopupSiteScope } from '../../popup/query/popupSiteSnapshotQueryService.js';
import { hasOriginPermissionForDomain } from '../../../../lib/permissions.js';
import { createSiteRuleCommandService } from '../siteRuleCommandService.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';
import { buildSiteRegistrationRejectionResponse } from '../../../progression/contracts/siteRegistrationRejection.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requirePopupOwnerFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requirePopupSettingsService(settingsService) {
  if (
    !settingsService
    || typeof settingsService.ensureSettingsCache !== 'function'
    || typeof settingsService.applySettingsChange !== 'function'
  ) {
    throw new Error('POPUP_SETTINGS_SERVICE_REQUIRED');
  }
  return settingsService;
}

function requirePopupSettingsCache(settingsCache) {
  if (!settingsCache || typeof settingsCache !== 'object') {
    throw new Error('POPUP_SETTINGS_CACHE_REQUIRED');
  }
  return settingsCache;
}

function resolveSiteRuleService({ injectedSiteRuleService, settingsService }) {
  if (injectedSiteRuleService) {
    if (typeof injectedSiteRuleService.upsertSiteRule !== 'function') {
      throw new Error('POPUP_SITE_RULE_SERVICE_REQUIRED');
    }
    return injectedSiteRuleService;
  }
  return createSiteRuleCommandService({
    settingsService,
  });
}

function requirePopupPermissionSnapshot(snapshot) {
  if (
    !isPlainObject(snapshot)
    || !Array.isArray(snapshot.permissions)
    || !Array.isArray(snapshot.origins)
  ) {
    throw new Error('POPUP_PERMISSIONS_SNAPSHOT_INVALID');
  }
  return snapshot;
}

function requireFiniteNumberField(source, key, errorCode) {
  if (typeof source[key] !== 'number' || !Number.isFinite(source[key])) {
    throw new Error(errorCode);
  }
}

function requirePopupSiteSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw new Error('POPUP_SITE_SNAPSHOT_RESULT_INVALID');
  }
  const { site, metrics, protection, access } = snapshot;
  if (
    !isPlainObject(site)
    || !isPlainObject(metrics)
    || !isPlainObject(protection)
    || !isPlainObject(access)
  ) {
    throw new Error('POPUP_SITE_SNAPSHOT_RESULT_INVALID');
  }

  requireFiniteNumberField(snapshot, 'capturedAt', 'POPUP_SITE_SNAPSHOT_RESULT_INVALID');
  if (
    typeof site.pageUrl !== 'string'
    || typeof site.hostname !== 'string'
    || typeof site.supported !== 'boolean'
    || (site.supported && !site.hostname.trim())
  ) {
    throw new Error('POPUP_SITE_SNAPSHOT_RESULT_INVALID');
  }
  [
    'todayMs',
    'weeklyAverageDailyMs',
    'trackedTodayMs',
    'shareOfTracked',
  ].forEach((key) => requireFiniteNumberField(metrics, key, 'POPUP_SITE_SNAPSHOT_RESULT_INVALID'));
  if (
    typeof metrics.dateStr !== 'string'
    || typeof metrics.hasTodayStats !== 'boolean'
    || typeof protection.isProtected !== 'boolean'
    || !Array.isArray(protection.reasons)
    || !Array.isArray(protection.activeFilters)
    || !Array.isArray(protection.activeArtifacts)
    || !Array.isArray(protection.standbyArtifacts)
    || access.permissionMode !== 'selective'
    || typeof access.requiresDashboardRegistration !== 'boolean'
    || typeof access.sitesManagementVisible !== 'boolean'
  ) {
    throw new Error('POPUP_SITE_SNAPSHOT_RESULT_INVALID');
  }
  [
    'goalMinutes',
    'level',
  ].forEach((key) => requireFiniteNumberField(protection, key, 'POPUP_SITE_SNAPSHOT_RESULT_INVALID'));
  [
    'managedSiteCount',
  ].forEach((key) => requireFiniteNumberField(access, key, 'POPUP_SITE_SNAPSHOT_RESULT_INVALID'));

  return snapshot;
}

export function createPopupActionHandlers(context = {}) {
  const {
    getGrantedPermissions,
    getPopupSiteSnapshot,
    settingsCache,
    settingsService,
    siteRuleService: injectedSiteRuleService,
  } = context;
  const readGrantedPermissions = requirePopupOwnerFunction(
    getGrantedPermissions,
    'POPUP_PERMISSIONS_OWNER_REQUIRED',
  );
  const readPopupSiteSnapshot = requirePopupOwnerFunction(
    getPopupSiteSnapshot,
    'POPUP_SITE_SNAPSHOT_OWNER_REQUIRED',
  );
  const resolvedSettingsService = requirePopupSettingsService(settingsService);
  const resolvedSettingsCache = requirePopupSettingsCache(settingsCache);
  const siteRuleService = resolveSiteRuleService({
    injectedSiteRuleService,
    settingsService: resolvedSettingsService,
  });

  return {
    [MESSAGE_ACTIONS.GET_POPUP_SITE_SNAPSHOT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const snapshot = requirePopupSiteSnapshot(await readPopupSiteSnapshot({ request }));
        return { success: true, snapshot };
      },
      (error) => ({ success: false, error: error?.message || 'POPUP_SITE_SNAPSHOT_FAILED' }),
    ),

    [MESSAGE_ACTIONS.POPUP_PROTECT_SITE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (Object.hasOwn(request, 'goalMinutes')) throw new Error('POPUP_REGISTRATION_TIME_FORBIDDEN');
        await resolvedSettingsService.ensureSettingsCache();

        const scope = resolvePopupSiteScope(request);
        if (!scope.supported || !scope.hostname) {
          return { success: false, error: 'INVALID_DOMAIN' };
        }

        const firstSnapshot = requirePopupSiteSnapshot(await readPopupSiteSnapshot({ request: scope }));
        if (firstSnapshot.access.requiresDashboardRegistration && !firstSnapshot.protection.isProtected) {
          return { success: false, error: 'SITE_REGISTRATION_DASHBOARD_REQUIRED', domain: scope.hostname };
        }

        const granted = requirePopupPermissionSnapshot(await readGrantedPermissions());
        if (!hasOriginPermissionForDomain(granted.origins, scope.hostname)) {
          return {
            success: false,
            error: 'PERMISSION_MISSING',
            domain: scope.hostname,
          };
        }

        await siteRuleService.upsertSiteRule({
          domain: scope.hostname,
          type: 'blocked',
          sender,
          actionReason: 'popup_protect_site',
        });

        const snapshot = requirePopupSiteSnapshot(await readPopupSiteSnapshot({ request: scope }));

        return {
          success: true,
          domain: scope.hostname,
          snapshot,
        };
      },
      (error) => {
        const registrationRejection = buildSiteRegistrationRejectionResponse(error);
        if (registrationRejection !== null) return registrationRejection;
        return { success: false, error: error?.message || 'POPUP_PROTECT_SITE_FAILED' };
      },
    ),
  };
}
