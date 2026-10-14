import {
  buildLeaseEntry,
  buildTerminalEntry,
  coerceTabId,
  isLeaseActive,
  isLifecycleAuthorized,
  isPendingEntryActive,
  isValidKey,
  isValidRunId,
  isValidTabId,
  normalizeLeaseEntry,
  normalizeNudgeProtocolClaim,
  normalizeNudgeOwnerHostname,
  normalizePendingEntry,
  normalizeTerminalEntry,
  NUDGE_LEASE_TTL_MS,
  NUDGE_PENDING_PHASES,
} from './nudgeSessionCore.js';
import {
  getSession,
  setSession,
  withNudgeSessionLock,
} from './nudgeSessionStore.js';
import {
  NUDGE_SESSION_KEYS,
  readNudgeSessionMap,
  resolveNudgeHostnameFromDayKey,
} from './nudgeSessionShared.js';
import { decideFurinDailyDelivery, furinDayFromKey, readFurinDailyReceipt } from './furinDailyPolicy.js';
import { requireGoalEpisodeBinding } from '../goalEpisodeBinding.js';

export async function beginNudgeRun(
  key,
  {
    runId,
    tabId = null,
    now = Date.now(),
    ttlMs = NUDGE_LEASE_TTL_MS,
    protocolClaim = null,
    hostname = '',
    goalBinding = null,
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key) || !isValidRunId(runId)) {
      return { ok: false, reason: 'INVALID_DISPATCH_INPUT', lease: null, pending: null };
    }
    if (!isValidTabId(tabId)) {
      return { ok: false, reason: 'INVALID_DISPATCH_TAB_ID', lease: null, pending: null };
    }
    const binding = requireGoalEpisodeBinding(goalBinding);
    if (binding.key !== key || binding.runId !== runId || binding.tabId !== tabId || binding.hostname !== normalizeNudgeOwnerHostname(hostname)
      || (binding.purpose === 'global_goal' ? 'global' : 'site') !== normalizeNudgeProtocolClaim(protocolClaim).protocolScope) {
      throw new Error('NUDGE_DISPATCH_GOAL_BINDING_MISMATCH');
    }

    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);
    const currentPending = normalizePendingEntry(nudgePending[key], now);
    const currentLease = normalizeLeaseEntry(nudgeLease[key], now);
    const terminal = normalizeTerminalEntry(nudgeTerminal[key], now);

    if (terminal?.runId === runId) {
      return { ok: false, reason: 'RUN_TERMINATED', lease: null, pending: null };
    }
    if (currentPending?.runId === runId || currentLease?.runId === runId) {
      return {
        ok: false,
        reason: 'RUN_ALREADY_BEGUN',
        lease: currentLease,
        pending: currentPending,
      };
    }
    if (currentPending?.runId && currentPending.runId !== runId) {
      return { ok: false, reason: 'PENDING_HELD', lease: null, pending: currentPending };
    }
    if (isLeaseActive(currentLease, now) && currentLease.runId !== runId) {
      return { ok: false, reason: 'LEASE_HELD', lease: currentLease, pending: currentPending };
    }

    const resolvedTabId = coerceTabId(tabId, null);
    const resolvedHostname = normalizeNudgeOwnerHostname(hostname)
      || resolveNudgeHostnameFromDayKey(key);
    const resolvedClaim = normalizeNudgeProtocolClaim(protocolClaim);
    const dateStr = furinDayFromKey(key);
    const daily = decideFurinDailyDelivery(await readFurinDailyReceipt(), {
      dateStr, hostname: resolvedHostname, protocolScope: resolvedClaim.protocolScope,
    });
    if (!daily.eligible) return { ok: false, reason: daily.reason, lease: null, pending: null };
    if (daily.deliveryForm === 'full' && Object.entries(nudgePending).some(([otherKey, raw]) => {
      if (otherKey === key || otherKey.split('|')[0] !== dateStr) return false;
      const other = normalizePendingEntry(raw, now);
      return other?.deliveryForm === 'full' && isPendingEntryActive(other, now);
    })) return { ok: false, reason: 'full_furin_pending', lease: null, pending: null };
    const pending = {
      ts: now,
      runId,
      tabId: resolvedTabId,
      phase: NUDGE_PENDING_PHASES.DISPATCHING,
      protocolClaim: resolvedClaim,
      goalBinding: binding,
      deliveryForm: daily.deliveryForm,
      ...(resolvedHostname ? { hostname: resolvedHostname } : {}),
    };
    const lease = buildLeaseEntry({ runId, tabId: resolvedTabId, now, ttlMs });
    nudgePending[key] = pending;
    nudgeLease[key] = lease;
    await setSession({
      [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
      [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
    });
    return { ok: true, reason: 'BEGUN', lease, pending };
  });
}

export async function abortNudgeRunBeforePresentation(
  key,
  {
    runId,
    now = Date.now(),
    reason = 'dispatch_failed',
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key) || !isValidRunId(runId)) return false;
    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);
    const pending = normalizePendingEntry(nudgePending[key], now);
    const lease = normalizeLeaseEntry(nudgeLease[key], now);
    const terminal = normalizeTerminalEntry(nudgeTerminal[key], now);

    if (terminal?.runId === runId) return false;
    if (pending?.runId && pending.runId !== runId) return false;
    if (lease?.runId && lease.runId !== runId) return false;
    // A transport failure is not proof that every cancelling producer cleaned.
    // The exact invalidator completion owner retains this phase's authority.
    if (pending?.phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING) return false;
    if (pending && ![NUDGE_PENDING_PHASES.DISPATCHING, NUDGE_PENDING_PHASES.ENTRY_WAITING,
      NUDGE_PENDING_PHASES.ENTRY_CANCELLING].includes(pending.phase)) return false;
    if (pending?.runId !== runId && lease?.runId !== runId) return false;

    if (pending?.runId === runId) delete nudgePending[key];
    if (lease?.runId === runId) delete nudgeLease[key];
    const nextTerminal = buildTerminalEntry({
      runId,
      status: 'aborted',
      endedAt: now,
      goalBinding: pending?.goalBinding ?? null,
    });
    if (nextTerminal) {
      nudgeTerminal[key] = {
        ...nextTerminal,
        reason: typeof reason === 'string' && reason ? reason : 'dispatch_failed',
      };
    }
    await setSession({
      [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
      [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
      [NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal,
    });
    return true;
  });
}

// Only the exact document-fenced NUDGE_START entry_waiting ACK admits this
// transition. It is owned waiting, not presentation: transport TTL no longer
// applies, and existing exact run/tab abort or actual paint ends the wait.
export async function markNudgeEntryWaiting(key, { runId, tabId, now = Date.now() } = {}) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key) || !isValidRunId(runId) || !isValidTabId(tabId)) return false;
    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {}, [NUDGE_SESSION_KEYS.LEASE]: {}, [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const pendingEntry = normalizePendingEntry(nudgePending[key], now);
    const leaseEntry = normalizeLeaseEntry(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE)[key], now);
    const terminalEntry = normalizeTerminalEntry(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL)[key], now);
    if (!isLifecycleAuthorized({ runId, tabId, pendingEntry, leaseEntry, terminalEntry, now })) return false;
    if (pendingEntry.phase !== NUDGE_PENDING_PHASES.DISPATCHING) {
      // Actual paint may win while the transport ACK is returning. Never
      // regress its phase or overwrite its real display receipt.
      return [NUDGE_PENDING_PHASES.ENTRY_WAITING, NUDGE_PENDING_PHASES.PRESENTED,
        NUDGE_PENDING_PHASES.EPISODE_COMPLETED].includes(pendingEntry.phase);
    }
    nudgePending[key] = { ...pendingEntry, phase: NUDGE_PENDING_PHASES.ENTRY_WAITING };
    await setSession({ [NUDGE_SESSION_KEYS.PENDING]: nudgePending });
    return true;
  });
}
