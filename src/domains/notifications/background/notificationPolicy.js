import { requireCanonicalNotificationsConfig } from '../../settings/config/notificationsConfig.js';
import { NOTIFICATION_KINDS } from '../contracts/notificationTypes.js';

const VALID_NOTIFICATION_KINDS = new Set(Object.values(NOTIFICATION_KINDS));

function hasBeenShown(runtimeState, deliveryKey) {
  return !!runtimeState?.shownByDeliveryKey?.[deliveryKey];
}

function requirePolicyDescriptor(descriptor) {
  const kind = typeof descriptor?.kind === 'string' && descriptor.kind.trim()
    ? descriptor.kind.trim()
    : null;
  if (!VALID_NOTIFICATION_KINDS.has(kind)) {
    throw new Error('NOTIFICATION_POLICY_DESCRIPTOR_INVALID');
  }
  return {
    kind,
  };
}

export function shouldDispatchNotification({
  descriptor,
  event,
  notificationsConfig,
  runtimeState,
} = {}) {
  const resolvedConfig = requireCanonicalNotificationsConfig(
    notificationsConfig,
    'NOTIFICATION_POLICY_CONFIG_INVALID',
  );
  const resolvedDescriptor = requirePolicyDescriptor(descriptor);
  if (resolvedDescriptor.kind === NOTIFICATION_KINDS.JOURNEY && !resolvedConfig.journey.enabled) {
    return { allowed: false, reason: 'journey_alert_disabled', delayMs: 0 };
  }
  const appliedWindow = event?.appliedTransition === true && event.source === 'schedule';
  const explicitWindowOptIn = appliedWindow && (event.notificationMode === 'both'
    || (event.notificationMode === 'end' && resolvedDescriptor.kind === NOTIFICATION_KINDS.SESSION_END))
    && [NOTIFICATION_KINDS.SESSION_START, NOTIFICATION_KINDS.SESSION_END].includes(resolvedDescriptor.kind);
  const explicitJourneyOptIn = resolvedDescriptor.kind === NOTIFICATION_KINDS.JOURNEY
    && resolvedConfig.journey.enabled;
  if (appliedWindow && (event.notificationMode === 'none'
    || (event.notificationMode === 'end' && resolvedDescriptor.kind === NOTIFICATION_KINDS.SESSION_START))) {
    return { allowed: false, reason: 'window_alert_disabled', delayMs: 0 };
  }
  if (!resolvedConfig.enabled && !explicitWindowOptIn && !explicitJourneyOptIn) {
    return { allowed: false, reason: 'notifications_disabled', delayMs: 0 };
  }

  const deliveryKey = typeof event?.deliveryKey === 'string' && event.deliveryKey.trim()
    ? event.deliveryKey.trim()
    : null;
  if (!deliveryKey) {
    return { allowed: false, reason: 'missing_delivery_key', delayMs: 0 };
  }
  if (hasBeenShown(runtimeState, deliveryKey)) {
    return { allowed: false, reason: 'already_shown', delayMs: 0 };
  }

  if (resolvedDescriptor.kind === NOTIFICATION_KINDS.SESSION_START) {
    return explicitWindowOptIn || resolvedConfig.sessionStart.enabled
      ? { allowed: true, reason: 'ok', delayMs: 0 }
      : { allowed: false, reason: 'session_start_disabled', delayMs: 0 };
  }

  if (resolvedDescriptor.kind === NOTIFICATION_KINDS.SESSION_END) {
    return explicitWindowOptIn || resolvedConfig.sessionEnd.enabled
      ? { allowed: true, reason: 'ok', delayMs: 0 }
      : { allowed: false, reason: 'session_end_disabled', delayMs: 0 };
  }

  if (resolvedDescriptor.kind === NOTIFICATION_KINDS.GLOBAL_CAP) {
    return { allowed: true, reason: 'ok', delayMs: 0 };
  }
  if (resolvedDescriptor.kind === NOTIFICATION_KINDS.JOURNEY) {
    return { allowed: true, reason: 'ok', delayMs: 0 };
  }

  throw new Error('NOTIFICATION_POLICY_DESCRIPTOR_INVALID');
}
