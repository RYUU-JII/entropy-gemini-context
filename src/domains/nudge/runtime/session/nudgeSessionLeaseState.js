import {
  buildLeaseEntry,
  isLeaseActive,
  isPendingEntryActive,
  isValidKey,
  isValidRunId,
  normalizeDebtEntry,
  normalizeLeaseEntry,
  normalizePendingEntry,
  NUDGE_LEASE_TTL_MS,
} from './nudgeSessionCore.js';
import {
  getSession,
  setSession,
  withNudgeSessionLock,
} from './nudgeSessionStore.js';
import {
  NUDGE_SESSION_KEYS,
  readNudgeSessionMap,
} from './nudgeSessionShared.js';

export async function acquireNudgeLease(
  key,
  { runId, tabId = null, now = Date.now(), ttlMs = NUDGE_LEASE_TTL_MS } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key) || !isValidRunId(runId)) {
      return { ok: false, reason: 'INVALID_LEASE_INPUT', lease: null };
    }

    const session = await getSession({ [NUDGE_SESSION_KEYS.LEASE]: {} });
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const current = normalizeLeaseEntry(nudgeLease[key], now);

    if (isLeaseActive(current, now) && current.runId !== runId) {
      return { ok: false, reason: 'LEASE_HELD', lease: current };
    }

    const next = buildLeaseEntry({ runId, tabId, now, ttlMs });
    nudgeLease[key] = next;
    await setSession({ [NUDGE_SESSION_KEYS.LEASE]: nudgeLease });
    return { ok: true, reason: 'ACQUIRED', lease: next };
  });
}

export async function releaseNudgeLease(key, { runId = null } = {}) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;
    const session = await getSession({ [NUDGE_SESSION_KEYS.LEASE]: {} });
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const current = normalizeLeaseEntry(nudgeLease[key], Date.now());
    if (!current) {
      if (nudgeLease[key]) {
        delete nudgeLease[key];
        await setSession({ [NUDGE_SESSION_KEYS.LEASE]: nudgeLease });
      }
      return false;
    }
    if (isValidRunId(runId) && current.runId !== runId) return false;
    delete nudgeLease[key];
    await setSession({ [NUDGE_SESSION_KEYS.LEASE]: nudgeLease });
    return true;
  });
}

export async function getNudgeLease(key, { now = Date.now() } = {}) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return null;
    const session = await getSession({ [NUDGE_SESSION_KEYS.LEASE]: {} });
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const lease = normalizeLeaseEntry(nudgeLease[key], now);
    if (!lease) {
      if (nudgeLease[key]) {
        delete nudgeLease[key];
        await setSession({ [NUDGE_SESSION_KEYS.LEASE]: nudgeLease });
      }
      return null;
    }
    if (!isLeaseActive(lease, now)) {
      delete nudgeLease[key];
      await setSession({ [NUDGE_SESSION_KEYS.LEASE]: nudgeLease });
      return null;
    }
    return lease;
  });
}

export async function isNudgeShown(key) {
  if (!isValidKey(key)) return false;
  const session = await getSession({ [NUDGE_SESSION_KEYS.SHOWN]: {} });
  return !!readNudgeSessionMap(session, NUDGE_SESSION_KEYS.SHOWN)[key];
}

export async function isNudgeResolved(key) {
  if (!isValidKey(key)) return false;
  const session = await getSession({ [NUDGE_SESSION_KEYS.ACK]: {} });
  return !!readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK)[key];
}

export async function isNudgePending(key, { now = Date.now() } = {}) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;
    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
    });
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const pending = normalizePendingEntry(nudgePending[key], now);

    if (!pending) {
      if (nudgePending[key]) {
        delete nudgePending[key];
        await setSession({ [NUDGE_SESSION_KEYS.PENDING]: nudgePending });
      }
      const lease = normalizeLeaseEntry(nudgeLease[key], now);
      return isLeaseActive(lease, now);
    }

    if (isPendingEntryActive(pending, now)) return true;

    delete nudgePending[key];
    const lease = normalizeLeaseEntry(nudgeLease[key], now);
    if (lease && (!isLeaseActive(lease, now) || !pending.runId || lease.runId === pending.runId)) {
      delete nudgeLease[key];
      await setSession({
        [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
        [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
      });
    } else {
      await setSession({ [NUDGE_SESSION_KEYS.PENDING]: nudgePending });
    }
    return false;
  });
}

export async function hasNudgeDebt(key) {
  if (!isValidKey(key)) return false;
  const session = await getSession({
    [NUDGE_SESSION_KEYS.DEBT]: {},
    [NUDGE_SESSION_KEYS.ACK]: {},
  });
  const nudgeAck = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK);
  if (nudgeAck[key]) return false;
  const entry = normalizeDebtEntry(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT)[key]);
  return !!entry;
}
