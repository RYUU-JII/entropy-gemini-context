export const TRACKING_DOMAIN_SESSION_PHASES = Object.freeze({
  ACTIVE: 'active',
  PENDING_COMMIT: 'pending_commit',
});

const ACTIVE_CURSOR_KEYS = Object.freeze([
  'hostname',
  'phase',
  'sessionId',
  'startedAt',
]);

const PENDING_COMMIT_CURSOR_KEYS = Object.freeze([
  ...ACTIVE_CURSOR_KEYS,
  'durationMs',
  'endedAt',
  'targetDateStr',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidDomainSessionCursor(fieldName) {
  const error = new Error(`TRACKING_DOMAIN_SESSION_STATE_INVALID:${fieldName}`);
  error.code = 'TRACKING_DOMAIN_SESSION_STATE_INVALID';
  throw error;
}

function requireExactKeys(value, expectedKeys) {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    invalidDomainSessionCursor('keys');
  }
}

function requireCanonicalText(value, fieldName, { lowercase = false, maxLength = Infinity } = {}) {
  if (
    typeof value !== 'string'
    || !value
    || value.trim() !== value
    || value.length > maxLength
    || (lowercase && value.toLowerCase() !== value)
  ) {
    invalidDomainSessionCursor(fieldName);
  }
  return value;
}

function requireTimestamp(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalidDomainSessionCursor(fieldName);
  }
  return value;
}

function requireTargetDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalidDomainSessionCursor('targetDateStr');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    invalidDomainSessionCursor('targetDateStr');
  }
  return value;
}

export function requireDomainSessionStoreReadResult(result) {
  if (
    !isPlainObject(result)
    || Object.keys(result).length !== 2
    || !Object.hasOwn(result, 'found')
    || !Object.hasOwn(result, 'value')
    || typeof result.found !== 'boolean'
    || (result.found === false && typeof result.value !== 'undefined')
  ) {
    throw new Error('TRACKING_DOMAIN_SESSION_STATE_READ_INVALID');
  }
  return result;
}

export function requireStoredDomainSession(rawValue) {
  if (!isPlainObject(rawValue)) {
    invalidDomainSessionCursor('record');
  }

  const phase = rawValue.phase;
  const expectedKeys = phase === TRACKING_DOMAIN_SESSION_PHASES.ACTIVE
    ? ACTIVE_CURSOR_KEYS
    : phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT
      ? PENDING_COMMIT_CURSOR_KEYS
      : null;
  if (!expectedKeys) invalidDomainSessionCursor('phase');
  requireExactKeys(rawValue, expectedKeys);

  const cursor = {
    phase,
    sessionId: requireCanonicalText(rawValue.sessionId, 'sessionId', { maxLength: 160 }),
    hostname: requireCanonicalText(rawValue.hostname, 'hostname', { lowercase: true }),
    startedAt: requireTimestamp(rawValue.startedAt, 'startedAt'),
  };
  if (phase === TRACKING_DOMAIN_SESSION_PHASES.ACTIVE) return cursor;

  const endedAt = requireTimestamp(rawValue.endedAt, 'endedAt');
  const durationMs = requireTimestamp(rawValue.durationMs, 'durationMs');
  if (endedAt <= cursor.startedAt || durationMs !== endedAt - cursor.startedAt) {
    invalidDomainSessionCursor('duration');
  }
  return {
    ...cursor,
    endedAt,
    durationMs,
    targetDateStr: requireTargetDateStr(rawValue.targetDateStr),
  };
}

export function createActiveDomainSessionCursor({
  sessionId,
  hostname,
  startedAt,
} = {}) {
  return requireStoredDomainSession({
    phase: TRACKING_DOMAIN_SESSION_PHASES.ACTIVE,
    sessionId,
    hostname,
    startedAt,
  });
}

export function createPendingDomainSessionCommit(activeCursor, {
  endedAt,
  targetDateStr,
} = {}) {
  const active = requireStoredDomainSession(activeCursor);
  if (active.phase !== TRACKING_DOMAIN_SESSION_PHASES.ACTIVE) {
    invalidDomainSessionCursor('activeCursor');
  }
  return requireStoredDomainSession({
    ...active,
    phase: TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT,
    endedAt,
    durationMs: endedAt - active.startedAt,
    targetDateStr,
  });
}
