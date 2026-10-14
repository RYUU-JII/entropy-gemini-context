import { extractBaseDomainParts } from '../../../../lib/domain.js';

// Return lock (되돌림 울림): once a protected site has been entered and then
// fully left - its last real tab closed or navigated elsewhere - the same site
// stays closed for a fixed time. There is no decision to make while it is
// closed. It is per site, not browser-wide: other protected sites keep
// following shared entry approval.
export const GATE_RETURN_LOCK_MS = 15 * 60_000;
// Closing the last tab and restoring it at once is a slip, not a decision.
export const GATE_RETURN_LOCK_FORGIVE_MS = 10_000;
// A site counts as entered only after a real tab stayed on it this long. It
// keeps a Gate redirect (the tab leaves the site for the Gate page within a
// moment) from reading as entering and leaving.
export const GATE_RETURN_LOCK_ENTERED_DWELL_MS = 5_000;

const SITE_KEY_PATTERN = /^[a-z0-9.-]+$/;

function isTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * The site a protected hostname belongs to: its base domain, so the www, m.
 * and other subdomains of one site share a lock. Returns '' when the hostname
 * has no usable base.
 */
export function resolveGateReturnSiteKey(hostname) {
  const { baseLabel, tld } = extractBaseDomainParts(hostname);
  if (!baseLabel) return '';
  const siteKey = tld ? `${baseLabel}.${tld}` : baseLabel;
  return SITE_KEY_PATTERN.test(siteKey) ? siteKey : '';
}

export function createGateReturnLockState() {
  return { version: 1, observedAt: 0, present: {}, locks: {} };
}

function isSiteKey(value) {
  return typeof value === 'string' && value.length > 0 && SITE_KEY_PATTERN.test(value);
}

function isLock(value) {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return keys.length === 3 && ['presentSince', 'leftAt', 'until'].every((key) => keys.includes(key))
    && isTimestamp(value.presentSince) && isTimestamp(value.leftAt) && isTimestamp(value.until)
    && value.presentSince <= value.leftAt && value.leftAt < value.until;
}

export function requireGateReturnLockState(value) {
  const keys = value && typeof value === 'object' ? Object.keys(value) : [];
  if (keys.length !== 4 || !['version', 'observedAt', 'present', 'locks'].every((key) => keys.includes(key))
    || value.version !== 1 || !isTimestamp(value.observedAt)
    || !value.present || typeof value.present !== 'object' || Array.isArray(value.present)
    || !value.locks || typeof value.locks !== 'object' || Array.isArray(value.locks)
    || Object.entries(value.present).some(([siteKey, since]) => !isSiteKey(siteKey) || !isTimestamp(since))
    || Object.entries(value.locks).some(([siteKey, lock]) => !isSiteKey(siteKey) || !isLock(lock))) {
    throw new Error('GATE_RETURN_LOCK_STATE_INVALID');
  }
  return value;
}

/**
 * Folds one inventory of the sites that have a real (non-Gate) tab open into
 * the state. A site that disappears after being entered is locked; a site that
 * comes back within the forgive window has its lock withdrawn, as if it had
 * never left. While a site is locked its tabs are being turned away at the
 * Gate, so they are not counted as presence.
 */
export function observeGateReturnSitePresence(previous, { siteKeys, observedAt }) {
  requireGateReturnLockState(previous);
  if (!Array.isArray(siteKeys) || siteKeys.some((siteKey) => !isSiteKey(siteKey)) || !isTimestamp(observedAt)) {
    throw new Error('GATE_RETURN_LOCK_OBSERVATION_INVALID');
  }
  if (observedAt < previous.observedAt) return previous;

  const current = new Set(siteKeys);
  const present = {};
  const locks = {};
  for (const [siteKey, lock] of Object.entries(previous.locks)) {
    if (lock.until > observedAt) locks[siteKey] = lock;
  }
  for (const siteKey of current) {
    const lock = locks[siteKey];
    if (lock && observedAt - lock.leftAt <= GATE_RETURN_LOCK_FORGIVE_MS) {
      delete locks[siteKey];
      present[siteKey] = lock.presentSince;
    } else if (!lock) {
      present[siteKey] = previous.present[siteKey] ?? observedAt;
    }
  }
  for (const [siteKey, since] of Object.entries(previous.present)) {
    if (current.has(siteKey) || observedAt - since < GATE_RETURN_LOCK_ENTERED_DWELL_MS) continue;
    locks[siteKey] = { presentSince: since, leftAt: observedAt, until: observedAt + GATE_RETURN_LOCK_MS };
  }
  return requireGateReturnLockState({ version: 1, observedAt, present, locks });
}

/**
 * The lock that applies to a site now. A lock inside its forgive window does
 * not hold yet: reopening the site then withdraws it instead.
 */
export function resolveGateReturnLock(state, siteKey, now) {
  requireGateReturnLockState(state);
  if (!isTimestamp(now)) throw new Error('GATE_RETURN_LOCK_NOW_INVALID');
  const lock = isSiteKey(siteKey) ? state.locks[siteKey] : undefined;
  const active = Boolean(lock) && now >= lock.leftAt + GATE_RETURN_LOCK_FORGIVE_MS && now < lock.until;
  return Object.freeze({
    siteKey: isSiteKey(siteKey) ? siteKey : '',
    active,
    leftAt: active ? lock.leftAt : 0,
    until: active ? lock.until : 0,
    remainingMs: active ? lock.until - now : 0,
  });
}
