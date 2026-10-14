import { requireCanonicalNotificationsConfig } from '../../settings/config/notificationsConfig.js';
import { normalizeNotificationRoute } from '../contracts/notificationRoutes.js';
import {
  getNotificationDescriptorForEvent,
  requireNotificationDescriptor,
} from './notificationCatalog.js';
import { shouldDispatchNotification } from './notificationPolicy.js';
import { createNotificationStateRepository } from './notificationStateRepository.js';

const MISSING_I18N_LABEL_PREFIX = '[missing i18n:';

function requireNotificationTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('NOTIFICATION_CLOCK_RESULT_INVALID');
  }
  return Math.max(0, Math.floor(numeric));
}

function requireNotificationDeliveryKey(event = {}) {
  const deliveryKey = typeof event.deliveryKey === 'string' && event.deliveryKey.trim()
    ? event.deliveryKey.trim()
    : null;
  if (!deliveryKey) {
    throw new Error('NOTIFICATION_DELIVERY_KEY_REQUIRED');
  }
  return deliveryKey;
}

function buildNotificationId(kind = 'notification') {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('NOTIFICATION_ID_GENERATOR_REQUIRED');
  }
  const suffix = globalThis.crypto.randomUUID();
  return `entropy:notification:${kind}:${suffix}`;
}

function buildDescriptor(eventType) {
  const baseDescriptor = getNotificationDescriptorForEvent(eventType);
  if (!baseDescriptor) return null;
  return requireNotificationDescriptor(baseDescriptor, 'NOTIFICATION_DESCRIPTOR_INVALID');
}

function requireResolvedNotificationCopy(value, fieldName) {
  const copy = typeof value === 'string' && value.trim() ? value.trim() : null;
  if (!copy || copy.startsWith(MISSING_I18N_LABEL_PREFIX)) {
    throw new Error(`NOTIFICATION_COPY_INVALID:${fieldName}`);
  }
  return copy;
}

async function resolveNotificationCopy(descriptor, copyResolver) {
  const normalizedDescriptor = requireNotificationDescriptor(
    descriptor,
    'NOTIFICATION_DESCRIPTOR_INVALID',
  );
  const localized = await copyResolver(normalizedDescriptor);
  if (!localized || typeof localized !== 'object' || Array.isArray(localized)) {
    throw new Error('NOTIFICATION_COPY_RESULT_INVALID');
  }
  return {
    title: requireResolvedNotificationCopy(localized.title, 'title'),
    message: requireResolvedNotificationCopy(localized.message, 'message'),
  };
}

function resolveNotificationBrowserPort(browserPort) {
  const requiredMethods = [
    'notificationsCreate',
    'notificationsCanListen',
    'notificationsOnClickedAddListener',
    'notificationsOnClickedRemoveListener',
    'notificationsOnClosedAddListener',
    'notificationsOnClosedRemoveListener',
    'runtimeGetURL',
  ];
  const missingMethod = requiredMethods.find((methodName) => (
    typeof browserPort?.[methodName] !== 'function'
  ));
  if (missingMethod) {
    throw new Error(`NOTIFICATION_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
  }
  return browserPort;
}

function normalizeNotificationCapabilityResult(capability) {
  if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
    throw new Error('NOTIFICATION_CAPABILITY_RESULT_INVALID');
  }
  if (typeof capability.ready !== 'boolean') {
    throw new Error('NOTIFICATION_CAPABILITY_RESULT_INVALID');
  }
  if (typeof capability.code !== 'string' || !capability.code.trim()) {
    throw new Error('NOTIFICATION_CAPABILITY_RESULT_INVALID');
  }
  return {
    ready: capability.ready,
    code: capability.code.trim(),
  };
}

function requireListenerPortResult(result, errorCode) {
  if (result !== true) {
    throw new Error(errorCode);
  }
}

function normalizeNonEmptyString(value, errorCode) {
  const notificationId = typeof value === 'string' && value.trim() ? value.trim() : null;
  if (!notificationId) {
    throw new Error(errorCode);
  }
  return notificationId;
}

function requireClickActionResult(result) {
  if (typeof result !== 'boolean') {
    throw new Error('NOTIFICATION_CLICK_ACTION_RESULT_INVALID');
  }
  return result;
}

function requireNotificationFullInitGate(waitForFullInit) {
  if (typeof waitForFullInit !== 'function') {
    throw new Error('NOTIFICATION_FULL_INIT_GATE_REQUIRED');
  }
  return waitForFullInit;
}

async function createBrowserNotification(
  notificationId,
  descriptor,
  browserPort,
  resolveLocalizedCopy,
) {
  const iconUrl = normalizeNonEmptyString(
    browserPort.runtimeGetURL('icons/icon128.png'),
    'NOTIFICATION_ICON_URL_UNAVAILABLE',
  );
  const localized = await resolveNotificationCopy(descriptor, resolveLocalizedCopy);
  const result = await browserPort.notificationsCreate(notificationId, {
    type: 'basic',
    iconUrl,
    title: localized.title,
    message: localized.message,
    requireInteraction: descriptor.requireInteraction === true,
  });
  if (result?.error) {
    throw new Error(result.error);
  }
  const createdNotificationId = typeof result?.notificationId === 'string' && result.notificationId.trim()
    ? result.notificationId.trim()
    : null;
  if (!createdNotificationId) {
    throw new Error('NOTIFICATION_ID_UNAVAILABLE');
  }
  return createdNotificationId;
}

export function createNotificationService({
  runtimeSessionRepository,
  getNotificationsConfig,
  ensureNotificationsConfigReady,
  openNotificationClickAction,
  browserPort,
  resolveNotificationCapability,
  resolveLocalizedCopy,
  now,
} = {}) {
  if (typeof getNotificationsConfig !== 'function') {
    throw new Error('NOTIFICATION_CONFIG_READER_REQUIRED');
  }
  if (typeof ensureNotificationsConfigReady !== 'function') {
    throw new Error('NOTIFICATION_CONFIG_READY_OWNER_REQUIRED');
  }
  if (typeof openNotificationClickAction !== 'function') {
    throw new Error('NOTIFICATION_CLICK_ACTION_OWNER_REQUIRED');
  }
  if (typeof resolveNotificationCapability !== 'function') {
    throw new Error('NOTIFICATION_CAPABILITY_RESOLVER_REQUIRED');
  }
  if (typeof resolveLocalizedCopy !== 'function') {
    throw new Error('NOTIFICATION_COPY_RESOLVER_REQUIRED');
  }
  if (typeof now !== 'function') {
    throw new Error('NOTIFICATION_CLOCK_OWNER_REQUIRED');
  }

  const resolvedBrowserPort = resolveNotificationBrowserPort(browserPort);
  const stateRepository = createNotificationStateRepository({
    runtimeSessionRepository,
  });
  let listenersRegistered = false;
  let clickListener = null;
  let closeListener = null;
  let listenerFullInitGate = null;

  async function resolveNotificationsConfig() {
    await ensureNotificationsConfigReady();
    return requireCanonicalNotificationsConfig(
      getNotificationsConfig(),
      'NOTIFICATION_CONFIG_RESULT_INVALID',
    );
  }

  function resolveCapability() {
    return normalizeNotificationCapabilityResult(resolveNotificationCapability());
  }

  async function finalizeDispatch({ descriptor, deliveryKey }) {
    const eventNow = requireNotificationTimestamp(now());
    const requestedNotificationId = buildNotificationId(descriptor.kind);

    const notificationId = await createBrowserNotification(
      requestedNotificationId,
      descriptor,
      resolvedBrowserPort,
      resolveLocalizedCopy,
    );
    await stateRepository.mutateState((current) => ({
      ...current,
      shownByDeliveryKey: {
        ...current.shownByDeliveryKey,
        [deliveryKey]: eventNow,
      },
      lastShownAtByKind: {
        ...current.lastShownAtByKind,
        [descriptor.kind]: eventNow,
      },
      contextByNotificationId: {
        ...current.contextByNotificationId,
        [notificationId]: {
          kind: descriptor.kind,
          route: normalizeNotificationRoute(descriptor.route),
          deliveryKey,
        },
      },
    }));
    return {
      dispatched: true,
      notificationId,
      deliveryKey,
      kind: descriptor.kind,
    };
  }

  async function handleEvent(event = {}) {
    const descriptor = buildDescriptor(event?.type);
    if (!descriptor) {
      return { dispatched: false, reason: 'unsupported_event', deliveryKey: null };
    }

    const deliveryKey = requireNotificationDeliveryKey(event);
    const capability = resolveCapability();
    if (!capability.ready) {
      return {
        dispatched: false,
        reason: capability.code,
        deliveryKey,
        kind: descriptor.kind,
      };
    }

    const runtimeState = await stateRepository.readState();
    const decision = shouldDispatchNotification({
      descriptor,
      event: {
        ...event,
        deliveryKey,
      },
      notificationsConfig: await resolveNotificationsConfig(),
      runtimeState,
    });

    if (!decision.allowed) {
      return {
        dispatched: false,
        reason: decision.reason,
        deliveryKey,
        kind: descriptor.kind,
      };
    }

    return finalizeDispatch({
      descriptor,
      deliveryKey,
    });
  }

  async function handleClicked(notificationId) {
    const normalizedNotificationId = normalizeNonEmptyString(
      notificationId,
      'NOTIFICATION_CLICK_ID_INVALID',
    );
    const state = await stateRepository.readState();
    const context = state.contextByNotificationId?.[normalizedNotificationId];
    if (!context) return false;
    if (!context.route?.target) {
      throw new Error('NOTIFICATION_CLICK_CONTEXT_ROUTE_INVALID');
    }
    return requireClickActionResult(await openNotificationClickAction(context));
  }

  async function handleClosed(notificationId) {
    const normalizedNotificationId = normalizeNonEmptyString(
      notificationId,
      'NOTIFICATION_CLOSED_ID_INVALID',
    );
    await stateRepository.mutateState((current) => {
      if (!Object.prototype.hasOwnProperty.call(current.contextByNotificationId, normalizedNotificationId)) {
        return current;
      }
      const nextContext = { ...current.contextByNotificationId };
      delete nextContext[normalizedNotificationId];
      return {
        ...current,
        contextByNotificationId: nextContext,
      };
    });
  }

  function registerListeners({ waitForFullInit } = {}) {
    const fullInitGate = requireNotificationFullInitGate(waitForFullInit);
    if (listenersRegistered) {
      if (listenerFullInitGate !== fullInitGate) {
        throw new Error('NOTIFICATION_FULL_INIT_GATE_OWNER_MISMATCH');
      }
      return { registered: true, reused: true };
    }

    if (resolvedBrowserPort.notificationsCanListen() !== true) {
      return {
        registered: false,
        reused: false,
        reason: 'NOTIFICATION_LISTENER_API_UNAVAILABLE',
      };
    }

    const nextClickListener = (notificationId) => {
      return fullInitGate({
        label: 'notification_clicked',
        task: () => handleClicked(notificationId),
      });
    };
    requireListenerPortResult(
      resolvedBrowserPort.notificationsOnClickedAddListener(nextClickListener),
      'NOTIFICATION_CLICK_LISTENER_REGISTRATION_FAILED',
    );

    const nextCloseListener = (notificationId) => {
      return fullInitGate({
        label: 'notification_closed',
        task: () => handleClosed(notificationId),
      });
    };
    try {
      requireListenerPortResult(
        resolvedBrowserPort.notificationsOnClosedAddListener(nextCloseListener),
        'NOTIFICATION_CLOSE_LISTENER_REGISTRATION_FAILED',
      );
    } catch (error) {
      requireListenerPortResult(
        resolvedBrowserPort.notificationsOnClickedRemoveListener(nextClickListener),
        'NOTIFICATION_CLICK_LISTENER_ROLLBACK_FAILED',
      );
      throw error;
    }

    clickListener = nextClickListener;
    closeListener = nextCloseListener;
    listenerFullInitGate = fullInitGate;
    listenersRegistered = true;
    return { registered: true, reused: false };
  }

  async function dispose() {
    let removalError = null;
    if (clickListener) {
      const listener = clickListener;
      const removed = resolvedBrowserPort.notificationsOnClickedRemoveListener(listener);
      if (removed === true) {
        clickListener = null;
      } else {
        removalError = new Error('NOTIFICATION_CLICK_LISTENER_REMOVAL_FAILED');
      }
    }
    if (closeListener) {
      const listener = closeListener;
      const removed = resolvedBrowserPort.notificationsOnClosedRemoveListener(listener);
      if (removed === true) {
        closeListener = null;
      } else if (!removalError) {
        removalError = new Error('NOTIFICATION_CLOSE_LISTENER_REMOVAL_FAILED');
      }
    }
    if (!clickListener && !closeListener) {
      listenersRegistered = false;
      listenerFullInitGate = null;
    }
    if (removalError) {
      throw removalError;
    }
  }

  return {
    handleEvent,
    handleClicked,
    handleClosed,
    registerListeners,
    dispose,
  };
}
