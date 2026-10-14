import {
  resolveDashboardTabRequestForNotificationRoute,
} from '../../../../domains/notifications/contracts/notificationRoutes.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireBrowserPortMethod(browserPort, methodName) {
  if (typeof browserPort?.[methodName] !== 'function') {
    throw new Error(`BACKGROUND_NOTIFICATION_CLICK_BROWSER_PORT_METHOD_REQUIRED:${methodName}`);
  }
  return browserPort[methodName];
}

function appendRouteParams(query, routeParams) {
  if (routeParams == null) return;
  if (!isPlainObject(routeParams)) {
    throw new Error('BACKGROUND_NOTIFICATION_CLICK_ROUTE_PARAMS_INVALID');
  }
  const normalizedKeys = new Set();
  Object.entries(routeParams).forEach(([key, value]) => {
    const normalizedKey = normalizeNonEmptyString(key);
    if (!normalizedKey || !['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error('BACKGROUND_NOTIFICATION_CLICK_ROUTE_PARAMS_INVALID');
    }
    if (normalizedKeys.has(normalizedKey)) {
      throw new Error('BACKGROUND_NOTIFICATION_CLICK_ROUTE_PARAMS_INVALID');
    }
    normalizedKeys.add(normalizedKey);
    query.set(normalizedKey, String(value));
  });
}

export function buildDashboardNotificationQuery({ tabId = null, routeParams = null } = {}) {
  const normalizedTabId = normalizeNonEmptyString(tabId);
  if (!normalizedTabId) {
    throw new Error('BACKGROUND_NOTIFICATION_CLICK_ROUTE_INVALID:tab');
  }

  const query = new URLSearchParams();
  query.set('tab', normalizedTabId);
  appendRouteParams(query, routeParams);
  return `?${query.toString()}`;
}

function resolveNotificationRouteRequest(context = {}) {
  const routeRequest = resolveDashboardTabRequestForNotificationRoute(context?.route);
  if (!routeRequest?.tabId) {
    throw new Error('BACKGROUND_NOTIFICATION_CLICK_ROUTE_INVALID');
  }
  return routeRequest;
}

export function createNotificationClickAction({ browserPort } = {}) {
  const runtimeGetURL = requireBrowserPortMethod(browserPort, 'runtimeGetURL');
  const tabsCreate = requireBrowserPortMethod(browserPort, 'tabsCreate');

  return async function openNotificationClickAction(context = {}) {
    const routeRequest = resolveNotificationRouteRequest(context);
    const query = buildDashboardNotificationQuery({
      tabId: routeRequest.tabId,
      routeParams: routeRequest.params,
    });
    const url = runtimeGetURL(`src/pages/dashboard.html${query}`);
    if (!normalizeNonEmptyString(url)) {
      throw new Error('BACKGROUND_NOTIFICATION_CLICK_URL_UNAVAILABLE');
    }

    const tab = await tabsCreate({
      url: url.trim(),
    });
    if (!isPlainObject(tab)) {
      throw new Error('BACKGROUND_NOTIFICATION_CLICK_TAB_CREATE_FAILED');
    }
    return true;
  };
}
