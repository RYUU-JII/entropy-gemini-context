export const NOTIFICATION_ROUTE_TARGETS = Object.freeze({
  DASHBOARD_HOME: 'dashboard_home',
  DASHBOARD_SCHEDULE_NOTIFICATIONS: 'dashboard_schedule_notifications',
});

const VALID_NOTIFICATION_ROUTE_TARGETS = new Set(Object.values(NOTIFICATION_ROUTE_TARGETS));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRouteParams(value) {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) {
    throw new Error('NOTIFICATION_ROUTE_PARAMS_INVALID');
  }
  const next = {};
  Object.entries(value).forEach(([key, paramValue]) => {
    const normalizedKey = typeof key === 'string' && key.trim() ? key.trim() : null;
    if (!normalizedKey || !['string', 'number', 'boolean'].includes(typeof paramValue)) {
      throw new Error('NOTIFICATION_ROUTE_PARAMS_INVALID');
    }
    if (Object.prototype.hasOwnProperty.call(next, normalizedKey)) {
      throw new Error('NOTIFICATION_ROUTE_PARAMS_INVALID');
    }
    next[normalizedKey] = paramValue;
  });
  return Object.keys(next).length ? next : null;
}

function mergeRouteParams(...paramSets) {
  const next = {};
  paramSets.forEach((value) => {
    const params = cloneRouteParams(value);
    if (!params) return;
    Object.entries(params).forEach(([key, paramValue]) => {
      if (Object.prototype.hasOwnProperty.call(next, key) && next[key] !== paramValue) {
        throw new Error('NOTIFICATION_ROUTE_PARAMS_INVALID');
      }
      next[key] = paramValue;
    });
  });
  return Object.keys(next).length ? next : null;
}

export function normalizeNotificationRoute(value) {
  const source = isPlainObject(value) ? value : {};
  const target = typeof source.target === 'string' && VALID_NOTIFICATION_ROUTE_TARGETS.has(source.target.trim())
    ? source.target.trim()
    : null;
  if (target) {
    return {
      target,
      params: cloneRouteParams(source.params),
    };
  }
  return null;
}

export function buildNotificationRoute(target, params = null) {
  const route = normalizeNotificationRoute({
    target,
    params,
  });
  if (!route?.target) {
    throw new Error(`NOTIFICATION_ROUTE_TARGET_UNSUPPORTED:${String(target || '')}`);
  }
  return route;
}

export function resolveDashboardTabRequestForNotificationRoute(route) {
  const normalized = normalizeNotificationRoute(route);
  if (!normalized?.target) {
    return {
      tabId: null,
      params: null,
    };
  }

  if (normalized.target === NOTIFICATION_ROUTE_TARGETS.DASHBOARD_SCHEDULE_NOTIFICATIONS) {
    return {
      tabId: 'schedule',
      params: mergeRouteParams(normalized.params, {
        intent: 'notifications',
        source: 'notification',
      }),
    };
  }

  return {
    tabId: 'main',
    params: normalized.params,
  };
}
