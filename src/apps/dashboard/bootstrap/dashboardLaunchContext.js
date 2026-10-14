import { DEFAULT_THEME_ID } from '../../../themes/core/ids.js';
import { resolvePageLocalStorageRef } from '../../../platform/browser/pageLocalStorage.js';
import {
  DASHBOARD_TAB_IDS,
  getDashboardDefaultTabId,
  resolvePolicyFallbackTabId,
} from '../tabs/registry.js';
import { normalizeDashboardTabRequest } from '../utils/dashboardRouteRequest.js';
import { readSiteRegistrationIntent } from '../../../lib/firstSiteRegistrationIntent.js';
import {
  resolveDashboardBootThemeId,
  resolveDashboardThemeLaunchHint,
} from './dashboardBootThemeContext.js';

export {
  resolveDashboardBootThemeId,
  resolveDashboardThemeLaunchHint,
};

export const DASHBOARD_ACTIVE_TAB_STORAGE_KEY = 'dashboardActiveTab';

function getStorage(storage) {
  if (storage && typeof storage.getItem === 'function') {
    return storage;
  }
  return resolvePageLocalStorageRef();
}

function getLocationSearch(search) {
  if (typeof search === 'string') return search;
  if (typeof window === 'undefined') return '';
  return window.location?.search || '';
}

function normalizeAllowedTabIds(allowedTabIds) {
  if (!Array.isArray(allowedTabIds) || allowedTabIds.length === 0) {
    return [...DASHBOARD_TAB_IDS];
  }
  return allowedTabIds.filter((tabId) => typeof tabId === 'string' && tabId);
}

function normalizeRouteIntent(value) {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return candidate === 'notifications'
    ? candidate
    : null;
}

function normalizeRouteSource(value) {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return candidate === 'notification'
    ? candidate
    : null;
}

function readStorageValue(key, storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage || typeof key !== 'string' || !key) return null;
  try {
    const value = targetStorage.getItem(key);
    return typeof value === 'string' ? value : null;
  } catch (_error) {
    return null;
  }
}

export function readDashboardRouteRequest({ search } = {}) {
  const routeSearch = getLocationSearch(search);
  const query = new URLSearchParams(routeSearch);
  const normalizedRequest = normalizeDashboardTabRequest(query.get('tab'), null);
  const registrationIntent = readSiteRegistrationIntent(routeSearch);
  if (registrationIntent !== null) {
    return { tabId: 'main', params: { registrationIntent } };
  }
  const domain = (query.get('domain') || '').trim().toLowerCase();
  const intent = normalizeRouteIntent(query.get('intent'));
  const source = normalizeRouteSource(query.get('source'));

  if (normalizedRequest.tabId === 'sites' && (domain || query.get('add') === 'true')) {
    return {
      tabId: 'sites',
      params: {
        domain,
        ...(query.get('add') === 'true' ? { add: true } : {}),
        recovery: (query.get('recovery') || '').trim() || null,
      },
    };
  }

  if (normalizedRequest.tabId === 'schedule' && (intent || source)) {
    return {
      tabId: 'schedule',
      params: {
        intent,
        source,
      },
    };
  }

  return normalizedRequest;
}

// Clearing a presented setup intent is a URL-only acknowledgement. It cannot
// register a domain, change permissions or write a progression milestone.
export function consumeDashboardSiteRegistrationRoute(intent, {
  history = typeof window === 'undefined' ? null : window.history,
  location = typeof window === 'undefined' ? null : window.location,
} = {}) {
  if (history === null || location === null) return false;
  const currentIntent = readSiteRegistrationIntent(location.search);
  if (currentIntent === null) return false;
  if (currentIntent.domain !== intent.domain) return false;
  const query = new URLSearchParams(location.search);
  query.delete('setup');
  query.delete('domain');
  query.delete('goalMinutes');
  const search = query.toString();
  history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  return true;
}

export function readPersistedDashboardTabHint({
  allowedTabIds = null,
  storage,
} = {}) {
  const rawValue = readStorageValue(DASHBOARD_ACTIVE_TAB_STORAGE_KEY, storage);
  if (!rawValue) return null;
  const { tabId } = normalizeDashboardTabRequest(rawValue);
  const safeAllowedTabIds = normalizeAllowedTabIds(allowedTabIds);
  return safeAllowedTabIds.includes(tabId) ? tabId : null;
}

export function writePersistedDashboardTabHint(tabId, { storage } = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return false;
  const normalizedTabId = normalizeDashboardTabRequest(tabId).tabId;
  try {
    targetStorage.setItem(DASHBOARD_ACTIVE_TAB_STORAGE_KEY, normalizedTabId);
    return true;
  } catch (_error) {
    return false;
  }
}

export function resolveDashboardInitialTabId({
  requestedTabId = null,
  allowedTabIds = null,
  preferredFallbackTabId = null,
  storage,
} = {}) {
  const safeAllowedTabIds = normalizeAllowedTabIds(allowedTabIds);
  if (!safeAllowedTabIds.length) {
    return getDashboardDefaultTabId();
  }

  const normalizedRequest = normalizeDashboardTabRequest(requestedTabId);
  if (safeAllowedTabIds.includes(normalizedRequest.tabId)) {
    return normalizedRequest.tabId;
  }

  const persistedTabId = readPersistedDashboardTabHint({
    allowedTabIds: safeAllowedTabIds,
    storage,
  });
  if (persistedTabId) return persistedTabId;

  return resolvePolicyFallbackTabId(safeAllowedTabIds, {
    preferredFallbackTabId,
  });
}

export function buildDashboardLaunchContext({
  allowedTabIds = null,
  preferredFallbackTabId = null,
  search,
  storage,
  prewarmSnapshot = null,
  fallbackThemeId = DEFAULT_THEME_ID,
} = {}) {
  const routeRequest = readDashboardRouteRequest({ search });
  const safeAllowedTabIds = normalizeAllowedTabIds(allowedTabIds);
  const targetTabId = resolveDashboardInitialTabId({
    requestedTabId: routeRequest.tabId,
    allowedTabIds: safeAllowedTabIds,
    preferredFallbackTabId,
    storage,
  });

  return {
    requestedTabId: routeRequest.tabId,
    requestedTabParams: routeRequest.params || null,
    targetTabId,
    targetTabParams: targetTabId === routeRequest.tabId ? (routeRequest.params || null) : null,
    targetThemeId: resolveDashboardBootThemeId({
      prewarmSnapshot,
      fallbackThemeId,
      storage,
    }),
  };
}

export function buildDashboardWarmupContext(options = {}) {
  const launchContext = buildDashboardLaunchContext(options);
  return {
    targetTabId: launchContext.targetTabId,
    targetTabParams: launchContext.targetTabParams,
    targetThemeId: launchContext.targetThemeId,
  };
}
