const ACTIVE_TAB_CHECKPOINT_KEYS = Object.freeze([
  'tabId',
  'hostname',
  'startedAt',
  'audible',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidActiveTabCheckpoint(fieldName) {
  throw new Error(`TRACKING_ACTIVE_TAB_STATE_INVALID:${fieldName}`);
}

function requireCanonicalTabId(tabId) {
  if (tabId === null) return null;
  if (!Number.isSafeInteger(tabId) || tabId < 0) {
    invalidActiveTabCheckpoint('tabId');
  }
  return tabId;
}

function requireCanonicalHostname(hostname) {
  if (hostname === null) return null;
  if (
    typeof hostname !== 'string'
    || !hostname
    || hostname.trim() !== hostname
    || hostname.toLowerCase() !== hostname
  ) {
    invalidActiveTabCheckpoint('hostname');
  }
  return hostname;
}

function requireCanonicalStartedAt(startedAt) {
  if (startedAt === null) return null;
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) {
    invalidActiveTabCheckpoint('startedAt');
  }
  return startedAt;
}

export function createEmptyActiveTabCheckpoint() {
  return { tabId: null, hostname: null, startedAt: null, audible: false };
}

export function requireActiveTabCheckpointReadResult(result) {
  if (
    !isPlainObject(result)
    || Object.keys(result).length !== 2
    || !Object.hasOwn(result, 'found')
    || !Object.hasOwn(result, 'value')
    || typeof result.found !== 'boolean'
    || (result.found === false && typeof result.value !== 'undefined')
  ) {
    throw new Error('TRACKING_ACTIVE_TAB_STATE_READ_INVALID');
  }
  return result;
}

export function requireStoredActiveTabCheckpoint(rawValue) {
  if (!isPlainObject(rawValue)) {
    invalidActiveTabCheckpoint('record');
  }
  if (
    Object.keys(rawValue).length !== ACTIVE_TAB_CHECKPOINT_KEYS.length
    || ACTIVE_TAB_CHECKPOINT_KEYS.some((key) => !Object.hasOwn(rawValue, key))
  ) {
    invalidActiveTabCheckpoint('keys');
  }

  const tabId = requireCanonicalTabId(rawValue.tabId);
  const hostname = requireCanonicalHostname(rawValue.hostname);
  const startedAt = requireCanonicalStartedAt(rawValue.startedAt);
  if (typeof rawValue.audible !== 'boolean') {
    invalidActiveTabCheckpoint('audible');
  }
  if (
    (tabId === null && (hostname !== null || startedAt !== null || rawValue.audible !== false))
    || (hostname === null && startedAt !== null)
  ) {
    invalidActiveTabCheckpoint('state');
  }

  return {
    tabId,
    hostname,
    startedAt,
    audible: rawValue.audible,
  };
}
