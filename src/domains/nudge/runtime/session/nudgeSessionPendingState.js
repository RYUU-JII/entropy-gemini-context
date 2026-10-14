import {
  buildLeaseEntry,
  buildTerminalEntry,
  coerceTabId,
  isValidKey,
  isValidRunId,
  markDebtWithSessionData,
  normalizeNudgeProtocolClaim,
  normalizeNudgeOwnerHostname,
  normalizeDebtMap,
  normalizeLeaseEntry,
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
import { requireSentinelFlareDeliveryForm } from '../sentinelFlareDeliveryForm.js';
import { requireGoalEpisodeBinding } from '../goalEpisodeBinding.js';

export async function markNudgePending(
  key,
  {
    runId = null,
    tabId = null,
    now = Date.now(),
    protocolClaim = null,
    hostname = '',
    deliveryForm = 'full',
    goalBinding = null,
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return;
    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);

    const existing = normalizePendingEntry(nudgePending[key], now);
    const resolvedRunId = isValidRunId(runId) ? runId : (existing?.runId || null);
    const resolvedTabId = coerceTabId(tabId, existing?.tabId ?? null);
    const resolvedProtocolClaim = normalizeNudgeProtocolClaim(
      protocolClaim || existing?.protocolClaim || null,
    );
    const resolvedHostname = normalizeNudgeOwnerHostname(hostname)
      || existing?.hostname
      || resolveNudgeHostnameFromDayKey(key);
    const terminal = resolvedRunId
      ? normalizeTerminalEntry(nudgeTerminal[key], now)
      : null;
    if (terminal && terminal.runId === resolvedRunId) return false;
    const binding = requireGoalEpisodeBinding(goalBinding);
    if (binding.key !== key || binding.runId !== resolvedRunId || binding.tabId !== resolvedTabId || binding.hostname !== resolvedHostname
      || (binding.purpose === 'global_goal' ? 'global' : 'site') !== resolvedProtocolClaim.protocolScope) {
      throw new Error('NUDGE_PENDING_GOAL_BINDING_MISMATCH');
    }
    nudgePending[key] = {
      ts: now,
      runId: resolvedRunId,
      tabId: resolvedTabId,
      phase: NUDGE_PENDING_PHASES.DISPATCHING,
      protocolClaim: resolvedProtocolClaim,
      goalBinding: binding,
      deliveryForm: requireSentinelFlareDeliveryForm(deliveryForm),
      ...(resolvedHostname ? { hostname: resolvedHostname } : {}),
    };

    if (resolvedRunId) {
      nudgeLease[key] = buildLeaseEntry({
        runId: resolvedRunId,
        tabId: resolvedTabId,
        now,
        ttlMs: NUDGE_LEASE_TTL_MS,
      });
      await setSession({
        [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
        [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
        [NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal,
      });
    } else {
      await setSession({
        [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
        [NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal,
      });
    }
    return true;
  });
}

export async function suppressNudgePendingForPreemption(
  key,
  {
    runId = null,
    now = Date.now(),
    reason = 'protocol_preempted',
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) {
      return {
        suppressed: false,
        runId: null,
        protocolClaim: null,
      };
    }
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
    const suppressedRunId = isValidRunId(runId)
      ? runId
      : (pending?.runId || lease?.runId || null);

    let changed = false;
    if (Object.prototype.hasOwnProperty.call(nudgePending, key)) {
      delete nudgePending[key];
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(nudgeLease, key)) {
      delete nudgeLease[key];
      changed = true;
    }
    if (suppressedRunId) {
      const terminal = buildTerminalEntry({
        runId: suppressedRunId,
        status: 'aborted',
        endedAt: now,
      });
      if (terminal) {
        nudgeTerminal[key] = {
          ...terminal,
          reason: typeof reason === 'string' && reason ? reason : 'protocol_preempted',
        };
        changed = true;
      }
    }

    if (changed) {
      await setSession({
        [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
        [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
        [NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal,
      });
    }

    return {
      suppressed: changed,
      runId: suppressedRunId,
      protocolClaim: pending?.protocolClaim || null,
    };
  });
}

export async function clearNudgePending(key, { runId = null, releaseLease = false } = {}) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return;
    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
    });
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);

    let changed = false;
    if (nudgePending[key]) {
      delete nudgePending[key];
      changed = true;
    }

    if (releaseLease && nudgeLease[key]) {
      const lease = normalizeLeaseEntry(nudgeLease[key], Date.now());
      if (!isValidRunId(runId) || !lease || lease.runId === runId) {
        delete nudgeLease[key];
        changed = true;
      }
    }

    if (!changed) return;
    if (releaseLease) {
      await setSession({
        [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
        [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
      });
    } else {
      await setSession({ [NUDGE_SESSION_KEYS.PENDING]: nudgePending });
    }
  });
}

export async function markNudgeDebt(
  key,
  {
    reason = 'aborted',
    now = Date.now(),
    protocolClaim = null,
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;
    const session = await getSession({
      [NUDGE_SESSION_KEYS.DEBT]: {},
      [NUDGE_SESSION_KEYS.ACK]: {},
    });
    const update = await markDebtWithSessionData(key, {
      reason,
      now,
      sessionNudgeDebt: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT),
      sessionNudgeAck: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK),
      protocolClaim,
    });
    if (!update.changed) return false;
    await setSession({ [NUDGE_SESSION_KEYS.DEBT]: update.nudgeDebt });
    return true;
  });
}

export async function clearNudgeDebt(key) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;
    const session = await getSession({ [NUDGE_SESSION_KEYS.DEBT]: {} });
    const nudgeDebt = normalizeDebtMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT),
      Date.now(),
    );
    if (!nudgeDebt[key]) return false;
    delete nudgeDebt[key];
    await setSession({ [NUDGE_SESSION_KEYS.DEBT]: nudgeDebt });
    return true;
  });
}
