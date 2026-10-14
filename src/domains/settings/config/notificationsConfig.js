export const DEFAULT_NOTIFICATIONS_CONFIG = Object.freeze({
  enabled: false,
  journey: Object.freeze({ enabled: false }),
  sessionStart: Object.freeze({
    enabled: false,
  }),
  sessionEnd: Object.freeze({
    enabled: false,
  }),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeNotificationsConfig(rawValue, { defaults } = {}) {
  const fallback = isPlainObject(defaults) ? defaults : DEFAULT_NOTIFICATIONS_CONFIG;
  const source = rawValue === null || typeof rawValue === 'undefined'
    ? fallback
    : rawValue;
  return requireCanonicalNotificationsConfig(source);
}

export function requireCanonicalNotificationsConfig(
  value,
  errorCode = 'NOTIFICATIONS_CONFIG_INVALID',
) {
  if (
    !isPlainObject(value)
    || Object.keys(value).length !== 4
    || !isPlainObject(value.journey)
    || Object.keys(value.journey).length !== 1
    || typeof value.journey.enabled !== 'boolean'
    || typeof value.enabled !== 'boolean'
    || !isPlainObject(value.sessionStart)
    || Object.keys(value.sessionStart).length !== 1
    || typeof value.sessionStart.enabled !== 'boolean'
    || !isPlainObject(value.sessionEnd)
    || Object.keys(value.sessionEnd).length !== 1
    || typeof value.sessionEnd.enabled !== 'boolean'
  ) {
    throw new Error(errorCode);
  }
  return {
    enabled: value.enabled,
    journey: { enabled: value.journey.enabled },
    sessionStart: {
      enabled: value.sessionStart.enabled,
    },
    sessionEnd: {
      enabled: value.sessionEnd.enabled,
    },
  };
}
