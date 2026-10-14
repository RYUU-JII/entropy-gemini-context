export const NOTIFICATION_CAPABILITY_CODES = Object.freeze({
  READY: 'ready',
  API_UNAVAILABLE: 'api_unavailable',
});

function requireNotificationCapabilityPort(browserPort) {
  if (!browserPort || typeof browserPort !== 'object') {
    throw new Error('NOTIFICATION_CAPABILITY_BROWSER_PORT_REQUIRED');
  }
  [
    'notificationsCanCreate',
    'runtimeCanGetURL',
  ].forEach((methodName) => {
    if (typeof browserPort[methodName] !== 'function') {
      throw new Error(`NOTIFICATION_CAPABILITY_BROWSER_PORT_METHOD_REQUIRED:${methodName}`);
    }
  });
  return browserPort;
}

function requireBooleanCapabilityResult(value, methodName) {
  if (typeof value !== 'boolean') {
    throw new Error(`NOTIFICATION_CAPABILITY_BROWSER_PORT_RESULT_INVALID:${methodName}`);
  }
  return value;
}

function resolvePortCapability(browserPort) {
  const resolvedPort = requireNotificationCapabilityPort(browserPort);
  const canCreate = requireBooleanCapabilityResult(
    resolvedPort.notificationsCanCreate(),
    'notificationsCanCreate',
  );
  const canResolveUrl = requireBooleanCapabilityResult(
    resolvedPort.runtimeCanGetURL(),
    'runtimeCanGetURL',
  );
  return canCreate && canResolveUrl;
}

export function getNotificationCapabilityState({ browserPort } = {}) {
  const ready = resolvePortCapability(browserPort);
  return {
    ready,
    code: ready
      ? NOTIFICATION_CAPABILITY_CODES.READY
      : NOTIFICATION_CAPABILITY_CODES.API_UNAVAILABLE,
  };
}
