import {
  buildTerminalEntry,
  isLeaseActive,
  isPendingEntryActive,
  isValidKey,
  normalizeDebtEntry,
  normalizeDebtMap,
  normalizeLeaseEntry,
  normalizeNudgeProtocolClaim,
  normalizePendingEntry,
  normalizeTerminalEntry,
  NUDGE_PENDING_PHASES,
  NUDGE_PENDING_TTL_MS,
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
import { hasFurinDailyPresentation, readFurinDailyReceipt } from './furinDailyPolicy.js';

async function sweepExpiredPendingNudgesInternal(
  {
    now = Date.now(),
    reason = 'pending_timeout',
    targetKeys = null,
  } = {},
) {
  const targetSet = Array.isArray(targetKeys)
    ? new Set(targetKeys.filter((key) => isValidKey(key)))
    : null;

  const session = await getSession({
    [NUDGE_SESSION_KEYS.PENDING]: {},
    [NUDGE_SESSION_KEYS.ACK]: {},
    [NUDGE_SESSION_KEYS.DEBT]: {},
    [NUDGE_SESSION_KEYS.LEASE]: {},
    [NUDGE_SESSION_KEYS.TERMINAL]: {},
  });

  const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
  const nudgeAck = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK);
  const nudgeDebt = normalizeDebtMap(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT), now);
  const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
  const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);

  let changedPending = false;
  let changedDebt = false;
  let changedLease = false;
  let changedTerminal = false;
  let promotedCount = 0;
  let expiredPendingCount = 0;
  let clearedLeaseCount = 0;
  const promotedKeys = [];

  Object.keys(nudgePending).forEach((key) => {
    if (targetSet && !targetSet.has(key)) return;
    const pending = normalizePendingEntry(nudgePending[key], now);
    if (!pending) {
      delete nudgePending[key];
      changedPending = true;
      return;
    }
    if (pending.phase !== NUDGE_PENDING_PHASES.DISPATCHING) return;
    if (now - pending.ts <= NUDGE_PENDING_TTL_MS) return;

    expiredPendingCount += 1;
    delete nudgePending[key];
    changedPending = true;

    if (!nudgeAck[key]) {
      const prev = normalizeDebtEntry(nudgeDebt[key], pending.ts);
      const protocolClaim = pending.protocolClaim || prev?.protocolClaim || null;
      nudgeDebt[key] = {
        createdAt: prev?.createdAt || pending.ts,
        updatedAt: now,
        reason: typeof reason === 'string' && reason ? reason : 'pending_timeout',
        ...(protocolClaim ? { protocolClaim } : {}),
      };
      changedDebt = true;
      promotedCount += 1;
      promotedKeys.push(key);
      const terminal = buildTerminalEntry({
        runId: pending.runId,
        status: 'aborted',
        endedAt: now,
      });
      if (terminal) {
        nudgeTerminal[key] = terminal;
        changedTerminal = true;
      }
    }

    const lease = normalizeLeaseEntry(nudgeLease[key], now);
    if (lease && (!isLeaseActive(lease, now) || !pending.runId || lease.runId === pending.runId)) {
      delete nudgeLease[key];
      changedLease = true;
      clearedLeaseCount += 1;
    }
  });

  Object.keys(nudgeLease).forEach((key) => {
    if (targetSet && !targetSet.has(key)) return;
    const lease = normalizeLeaseEntry(nudgeLease[key], now);
    if (!lease || !isLeaseActive(lease, now)) {
      delete nudgeLease[key];
      changedLease = true;
      clearedLeaseCount += 1;
    }
  });

  if (changedPending || changedDebt || changedLease || changedTerminal) {
    const patch = {};
    if (changedPending) patch[NUDGE_SESSION_KEYS.PENDING] = nudgePending;
    if (changedDebt) patch[NUDGE_SESSION_KEYS.DEBT] = nudgeDebt;
    if (changedLease) patch[NUDGE_SESSION_KEYS.LEASE] = nudgeLease;
    if (changedTerminal) patch[NUDGE_SESSION_KEYS.TERMINAL] = nudgeTerminal;
    await setSession(patch);
  }

  return {
    promotedCount,
    expiredPendingCount,
    clearedLeaseCount,
    promotedKeys,
    changed: changedPending || changedDebt || changedLease || changedTerminal,
  };
}

export async function sweepExpiredPendingNudges(
  {
    now = Date.now(),
    reason = 'pending_timeout',
    targetKeys = null,
  } = {},
) {
  return withNudgeSessionLock(() => sweepExpiredPendingNudgesInternal({
    now,
    reason,
    targetKeys,
  }));
}

export async function promoteExpiredPendingToDebt(
  key,
  {
    now = Date.now(),
    reason = 'pending_timeout',
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;
    const result = await sweepExpiredPendingNudgesInternal({
      now,
      reason,
      targetKeys: [key],
    });
    return result.promotedCount > 0;
  });
}

export async function getNudgeGateState(
  key,
  {
    now = Date.now(),
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) {
      return {
        pending: false,
        shown: false,
        resolved: false,
        debt: false,
        promotedToDebt: false,
        leaseRunId: null,
        pendingRunId: null,
        pendingClaim: null,
        debtClaim: null,
      };
    }

    const result = await sweepExpiredPendingNudgesInternal({
      now,
      reason: 'pending_timeout',
      targetKeys: [key],
    });

    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.SHOWN]: {},
      [NUDGE_SESSION_KEYS.ACK]: {},
      [NUDGE_SESSION_KEYS.DEBT]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
    });

    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeShown = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.SHOWN);
    const nudgeAck = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK);
    const nudgeDebt = normalizeDebtMap(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT), now);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);

    const pendingEntry = normalizePendingEntry(nudgePending[key], now);
    const leaseEntry = normalizeLeaseEntry(nudgeLease[key], now);
    const leaseActive = isLeaseActive(leaseEntry, now);
    const pendingActive = isPendingEntryActive(pendingEntry, now);
    const resolved = !!nudgeAck[key];
    const dailyPresented = hasFurinDailyPresentation(await readFurinDailyReceipt(), key);
    const shown = !!nudgeShown[key] || dailyPresented;
    const debtEntry = normalizeDebtEntry(nudgeDebt[key], now);
    const debt = !resolved && !shown && !!debtEntry;
    const pending = pendingActive || (!resolved && leaseActive);
    const activeRunId = pending
      ? pendingEntry?.runId || (leaseActive ? leaseEntry.runId : null)
      : null;
    const activeClaim = pending
      ? (pendingEntry?.protocolClaim || (leaseActive ? normalizeNudgeProtocolClaim(null) : null))
      : null;

    return {
      pending,
      shown,
      resolved,
      debt,
      promotedToDebt: result.promotedCount > 0,
      leaseRunId: leaseActive ? leaseEntry.runId : null,
      pendingRunId: activeRunId,
      pendingClaim: activeClaim,
      debtClaim: debtEntry?.protocolClaim || null,
    };
  });
}
