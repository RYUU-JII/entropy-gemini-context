import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import { normalizeNotificationRoute } from '../contracts/notificationRoutes.js';

const DEFAULT_NOTIFICATION_RUNTIME_STATE = Object.freeze({
  shownByDeliveryKey: Object.freeze({}),
  lastShownAtByKind: Object.freeze({}),
  contextByNotificationId: Object.freeze({}),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRuntimeTimestampMap(value, fieldName) {
  if (value === undefined) return {};
  if (!isPlainObject(value)) {
    throw new Error(`NOTIFICATION_STATE_FIELD_INVALID:${fieldName}`);
  }
  const next = {};
  Object.entries(value).forEach(([key, timestamp]) => {
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error(`NOTIFICATION_STATE_FIELD_INVALID:${fieldName}`);
    }
    const normalizedKey = key.trim();
    if (Object.prototype.hasOwnProperty.call(next, normalizedKey)) {
      throw new Error(`NOTIFICATION_STATE_FIELD_INVALID:${fieldName}`);
    }
    const numericTimestamp = Number(timestamp);
    if (!Number.isFinite(numericTimestamp) || numericTimestamp < 0) {
      throw new Error(`NOTIFICATION_STATE_FIELD_INVALID:${fieldName}`);
    }
    next[normalizedKey] = numericTimestamp;
  });
  return next;
}

function cloneNotificationRoute(value) {
  if (value === null || value === undefined) {
    throw new Error('NOTIFICATION_STATE_CONTEXT_ROUTE_REQUIRED');
  }
  const normalizedRoute = normalizeNotificationRoute(value);
  if (!normalizedRoute?.target) {
    throw new Error('NOTIFICATION_STATE_CONTEXT_ROUTE_INVALID');
  }
  return normalizedRoute;
}

function cloneNotificationContext(value, notificationId) {
  if (typeof notificationId !== 'string' || !notificationId.trim()) {
    throw new Error('NOTIFICATION_STATE_CONTEXT_INVALID');
  }
  if (!isPlainObject(value)) {
    throw new Error('NOTIFICATION_STATE_CONTEXT_INVALID');
  }
  const source = value;
  const kind = typeof source.kind === 'string' && source.kind.trim() ? source.kind.trim() : null;
  const deliveryKey = typeof source.deliveryKey === 'string' && source.deliveryKey.trim()
    ? source.deliveryKey.trim()
    : null;
  if (!kind || !deliveryKey) {
    throw new Error('NOTIFICATION_STATE_CONTEXT_INVALID');
  }
  return {
    kind,
    route: cloneNotificationRoute(source.route),
    deliveryKey,
  };
}

function cloneContextByNotificationId(value) {
  if (value === undefined) return {};
  if (!isPlainObject(value)) {
    throw new Error('NOTIFICATION_STATE_CONTEXT_MAP_INVALID');
  }
  const source = value;
  const next = {};
  Object.entries(source).forEach(([notificationId, context]) => {
    const normalizedNotificationId = typeof notificationId === 'string' && notificationId.trim()
      ? notificationId.trim()
      : null;
    if (!normalizedNotificationId) {
      throw new Error('NOTIFICATION_STATE_CONTEXT_INVALID');
    }
    if (Object.prototype.hasOwnProperty.call(next, normalizedNotificationId)) {
      throw new Error('NOTIFICATION_STATE_CONTEXT_INVALID');
    }
    next[normalizedNotificationId] = cloneNotificationContext(context, notificationId);
  });
  return next;
}

export function normalizeNotificationRuntimeState(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return {
      shownByDeliveryKey: {},
      lastShownAtByKind: {},
      contextByNotificationId: {},
    };
  }
  if (!isPlainObject(rawValue)) {
    throw new Error('NOTIFICATION_STATE_INVALID');
  }
  const source = rawValue;
  return {
    shownByDeliveryKey: cloneRuntimeTimestampMap(source.shownByDeliveryKey, 'shownByDeliveryKey'),
    lastShownAtByKind: cloneRuntimeTimestampMap(source.lastShownAtByKind, 'lastShownAtByKind'),
    contextByNotificationId: cloneContextByNotificationId(source.contextByNotificationId),
  };
}

export function createNotificationStateRepository({
  runtimeSessionRepository,
  sessionKey = STORAGE_SESSION_KEYS.NOTIFICATION_STATE,
} = {}) {
  if (!runtimeSessionRepository || typeof runtimeSessionRepository.get !== 'function' || typeof runtimeSessionRepository.set !== 'function') {
    throw new Error('NOTIFICATION_STATE_RUNTIME_SESSION_REPOSITORY_REQUIRED');
  }

  async function readState() {
    const session = await runtimeSessionRepository.get({
      [sessionKey]: DEFAULT_NOTIFICATION_RUNTIME_STATE,
    });
    return normalizeNotificationRuntimeState(session?.[sessionKey]);
  }

  async function writeState(nextState) {
    const normalized = normalizeNotificationRuntimeState(nextState);
    await runtimeSessionRepository.set({
      [sessionKey]: normalized,
    });
    return normalized;
  }

  async function mutateState(mutator) {
    const current = await readState();
    const next = typeof mutator === 'function' ? mutator(current) : current;
    return writeState(next);
  }

  return {
    sessionKey,
    readState,
    writeState,
    mutateState,
  };
}
