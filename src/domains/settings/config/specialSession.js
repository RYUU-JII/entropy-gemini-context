import { normalizeDomain } from '../../../lib/domain.js';

export const SPECIAL_SESSION_SCHEMA_VERSION = 1;

export const SPECIAL_SESSION_MODES = Object.freeze({
  ISOLATION: 'isolation',
});

export const SPECIAL_SESSION_DEFAULT_DURATION_MINUTES = 30;
export const SPECIAL_SESSION_MIN_DURATION_MINUTES = 5;
export const SPECIAL_SESSION_MAX_DURATION_MINUTES = 180;
export const SPECIAL_SESSION_DURATION_OPTIONS_MINUTES = Object.freeze([30, 60, 90]);

export const INACTIVE_SPECIAL_SESSION = Object.freeze({
  schemaVersion: SPECIAL_SESSION_SCHEMA_VERSION,
  active: false,
  id: null,
  mode: null,
  startedAt: null,
  endsAt: null,
  durationMinutes: 0,
  temporaryAllowedHosts: Object.freeze([]),
});

function normalizeTimestamp(value, fallback = 0) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

function createSpecialSessionId(now = Date.now()) {
  const safeNow = normalizeTimestamp(now, Date.now());
  return `special_${safeNow.toString(36)}`;
}

export function normalizeSpecialSessionMode(value, fallback = SPECIAL_SESSION_MODES.ISOLATION) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === SPECIAL_SESSION_MODES.ISOLATION) return raw;
  return fallback;
}

export function clampSpecialSessionDurationMinutes(value, fallback = SPECIAL_SESSION_DEFAULT_DURATION_MINUTES) {
  const fallbackMinutes = Math.max(
    SPECIAL_SESSION_MIN_DURATION_MINUTES,
    Math.min(SPECIAL_SESSION_MAX_DURATION_MINUTES, Math.floor(Number(fallback) || SPECIAL_SESSION_DEFAULT_DURATION_MINUTES)),
  );
  const minutes = Math.floor(Number(value));
  if (!Number.isFinite(minutes)) return fallbackMinutes;
  return Math.max(
    SPECIAL_SESSION_MIN_DURATION_MINUTES,
    Math.min(SPECIAL_SESSION_MAX_DURATION_MINUTES, minutes),
  );
}

export function normalizeSpecialSessionHosts(hosts = []) {
  const source = Array.isArray(hosts) ? hosts : [hosts];
  return Array.from(new Set(
    source
      .map((host) => normalizeDomain(host))
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

export function createSpecialSessionState(input = {}, { now = Date.now() } = {}) {
  const startedAt = normalizeTimestamp(input.startedAt, normalizeTimestamp(now, Date.now()));
  const durationMinutes = clampSpecialSessionDurationMinutes(input.durationMinutes);
  const endsAt = normalizeTimestamp(
    input.endsAt,
    startedAt + durationMinutes * 60_000,
  );
  const safeEndsAt = endsAt > startedAt
    ? endsAt
    : startedAt + durationMinutes * 60_000;

  return {
    schemaVersion: SPECIAL_SESSION_SCHEMA_VERSION,
    active: true,
    id: typeof input.id === 'string' && input.id.trim()
      ? input.id.trim()
      : createSpecialSessionId(startedAt),
    mode: SPECIAL_SESSION_MODES.ISOLATION,
    startedAt,
    endsAt: safeEndsAt,
    durationMinutes: Math.max(1, Math.round((safeEndsAt - startedAt) / 60_000)),
    temporaryAllowedHosts: normalizeSpecialSessionHosts(input.temporaryAllowedHosts),
  };
}

export function normalizeSpecialSessionState(rawState = null, { now = Date.now() } = {}) {
  if (rawState === null || typeof rawState === 'undefined') {
    return { ...INACTIVE_SPECIAL_SESSION, temporaryAllowedHosts: [] };
  }
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    throw new Error('SPECIAL_SESSION_CONTRACT_INVALID');
  }
  if (rawState.schemaVersion !== SPECIAL_SESSION_SCHEMA_VERSION) {
    throw new Error('SPECIAL_SESSION_VERSION_UNSUPPORTED');
  }
  if (rawState.active === false) {
    return { ...INACTIVE_SPECIAL_SESSION, temporaryAllowedHosts: [] };
  }
  if (rawState.active !== true || rawState.mode !== SPECIAL_SESSION_MODES.ISOLATION) {
    throw new Error('SPECIAL_SESSION_CONTRACT_INVALID');
  }

  const { startedAt, endsAt, id, durationMinutes, temporaryAllowedHosts } = rawState;
  if (!Number.isSafeInteger(startedAt) || startedAt <= 0
    || !Number.isSafeInteger(endsAt) || endsAt <= startedAt
    || typeof id !== 'string' || !id.trim() || id !== id.trim()
    || !Number.isFinite(durationMinutes) || durationMinutes <= 0
    || !Array.isArray(temporaryAllowedHosts)
    || temporaryAllowedHosts.some((host) => typeof host !== 'string' || normalizeDomain(host) !== host)
    || new Set(temporaryAllowedHosts).size !== temporaryAllowedHosts.length) {
    throw new Error('SPECIAL_SESSION_CONTRACT_INVALID');
  }
  if (!Number.isFinite(now) || now < 0) throw new Error('SPECIAL_SESSION_TIME_INVALID');
  const nowTs = now;

  if (endsAt <= nowTs) {
    return { ...INACTIVE_SPECIAL_SESSION, temporaryAllowedHosts: [] };
  }

  return {
    schemaVersion: SPECIAL_SESSION_SCHEMA_VERSION,
    active: true,
    id,
    mode: SPECIAL_SESSION_MODES.ISOLATION,
    startedAt,
    endsAt,
    durationMinutes,
    temporaryAllowedHosts: [...temporaryAllowedHosts],
  };
}

export function isSpecialSessionActive(rawState = null, options = {}) {
  return normalizeSpecialSessionState(rawState, options).active === true;
}

export function addTemporaryAllowedHostToSpecialSession(rawState, host, { now = Date.now() } = {}) {
  const session = normalizeSpecialSessionState(rawState, { now });
  if (!session.active) return session;
  const normalizedHost = normalizeDomain(host);
  if (!normalizedHost) return session;
  return {
    ...session,
    temporaryAllowedHosts: normalizeSpecialSessionHosts([
      ...session.temporaryAllowedHosts,
      normalizedHost,
    ]),
  };
}
