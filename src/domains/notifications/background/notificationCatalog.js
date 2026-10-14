import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_KINDS,
} from '../contracts/notificationTypes.js';
import {
  buildNotificationRoute,
  normalizeNotificationRoute,
  NOTIFICATION_ROUTE_TARGETS,
} from '../contracts/notificationRoutes.js';

const VALID_NOTIFICATION_EVENT_TYPES = new Set(Object.values(NOTIFICATION_EVENT_TYPES));
const VALID_NOTIFICATION_KINDS = new Set(Object.values(NOTIFICATION_KINDS));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function throwDescriptorError(errorCode, detail) {
  throw new Error(`${errorCode}:${detail}`);
}

export const NOTIFICATION_DESCRIPTOR_BY_EVENT_TYPE = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.JOURNEY_STAGE_ADVANCED]: Object.freeze({
    kind: NOTIFICATION_KINDS.JOURNEY,
    titleKey: 'settings:notifications.journey_stage_advanced.title',
    messageKey: 'settings:notifications.journey_stage_advanced.body',
    route: buildNotificationRoute(NOTIFICATION_ROUTE_TARGETS.DASHBOARD_HOME),
    requireInteraction: false,
  }),
  [NOTIFICATION_EVENT_TYPES.ISOLATION_SESSION_STARTED]: Object.freeze({
    kind: NOTIFICATION_KINDS.SESSION_START,
    titleKey: 'settings:notifications.isolation_session_started.title',
    messageKey: 'settings:notifications.isolation_session_started.body',
    route: buildNotificationRoute(NOTIFICATION_ROUTE_TARGETS.DASHBOARD_HOME),
    requireInteraction: false,
  }),
  [NOTIFICATION_EVENT_TYPES.ISOLATION_SESSION_ENDED]: Object.freeze({
    kind: NOTIFICATION_KINDS.SESSION_END,
    titleKey: 'settings:notifications.isolation_session_ended.title',
    messageKey: 'settings:notifications.isolation_session_ended.body',
    route: buildNotificationRoute(NOTIFICATION_ROUTE_TARGETS.DASHBOARD_HOME),
    requireInteraction: false,
  }),
  [NOTIFICATION_EVENT_TYPES.GLOBAL_CAP_EXCEEDED]: Object.freeze({
    kind: NOTIFICATION_KINDS.GLOBAL_CAP,
    titleKey: 'settings:notifications.global_cap_exceeded.title',
    messageKey: 'settings:notifications.global_cap_exceeded.body',
    route: buildNotificationRoute(NOTIFICATION_ROUTE_TARGETS.DASHBOARD_HOME),
    requireInteraction: false,
  }),
  [NOTIFICATION_EVENT_TYPES.SCHEDULE_WINDOW_STARTED]: Object.freeze({
    kind: NOTIFICATION_KINDS.SESSION_START,
    titleKey: 'settings:notifications.schedule_window_started.title',
    messageKey: 'settings:notifications.schedule_window_started.body',
    route: buildNotificationRoute(NOTIFICATION_ROUTE_TARGETS.DASHBOARD_SCHEDULE_NOTIFICATIONS),
    requireInteraction: false,
  }),
  [NOTIFICATION_EVENT_TYPES.SCHEDULE_WINDOW_ENDED]: Object.freeze({
    kind: NOTIFICATION_KINDS.SESSION_END,
    titleKey: 'settings:notifications.schedule_window_ended.title',
    messageKey: 'settings:notifications.schedule_window_ended.body',
    route: buildNotificationRoute(NOTIFICATION_ROUTE_TARGETS.DASHBOARD_SCHEDULE_NOTIFICATIONS),
    requireInteraction: false,
  }),
});

export function requireNotificationDescriptor(
  value,
  errorCode = 'NOTIFICATION_DESCRIPTOR_INVALID',
) {
  if (!isPlainObject(value)) {
    throwDescriptorError(errorCode, 'shape');
  }

  const kind = normalizeNonEmptyString(value.kind);
  if (!VALID_NOTIFICATION_KINDS.has(kind)) {
    throwDescriptorError(errorCode, 'kind');
  }

  const titleKey = normalizeNonEmptyString(value.titleKey);
  if (!titleKey) {
    throwDescriptorError(errorCode, 'titleKey');
  }

  const messageKey = normalizeNonEmptyString(value.messageKey);
  if (!messageKey) {
    throwDescriptorError(errorCode, 'messageKey');
  }

  const route = normalizeNotificationRoute(value.route);
  if (!route?.target) {
    throwDescriptorError(errorCode, 'route');
  }

  if (typeof value.requireInteraction !== 'boolean') {
    throwDescriptorError(errorCode, 'requireInteraction');
  }

  const descriptor = {
    kind,
    titleKey,
    messageKey,
    route,
    requireInteraction: value.requireInteraction,
  };

  if (Object.prototype.hasOwnProperty.call(value, 'eventType')) {
    const eventType = normalizeNonEmptyString(value.eventType);
    if (!VALID_NOTIFICATION_EVENT_TYPES.has(eventType)) {
      throwDescriptorError(errorCode, 'eventType');
    }
    return {
      ...descriptor,
      eventType,
    };
  }

  return descriptor;
}

export function getNotificationDescriptorForEvent(eventType) {
  const normalizedEventType = normalizeNonEmptyString(eventType);
  if (!VALID_NOTIFICATION_EVENT_TYPES.has(normalizedEventType)) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(NOTIFICATION_DESCRIPTOR_BY_EVENT_TYPE, normalizedEventType)) {
    throw new Error(`NOTIFICATION_DESCRIPTOR_MISSING:${normalizedEventType}`);
  }
  return requireNotificationDescriptor({
    ...NOTIFICATION_DESCRIPTOR_BY_EVENT_TYPE[normalizedEventType],
    eventType: normalizedEventType,
  });
}
