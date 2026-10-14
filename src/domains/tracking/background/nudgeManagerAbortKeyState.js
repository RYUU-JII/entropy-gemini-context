import {
  buildTerminalEntry,
  isLifecycleAuthorized,
  isValidKey,
  isValidRunId,
  isValidTabId,
  markDebtWithSessionData,
  normalizeLeaseEntry,
  normalizePendingEntry,
  normalizeTerminalEntry,
  normalizeDebtMap,
  NUDGE_PENDING_PHASES,
} from '../../nudge/runtime/session/nudgeSessionCore.js';
import {
  buildNudgeTerminalOutboxEntry,
  normalizeNudgeTerminalOutboxMap,
  pruneNudgeTerminalOutboxMap,
  resolveNudgeTerminalOutboxReplay,
} from '../../nudge/runtime/session/nudgeTerminalOutboxContract.js';
import {
  getSession,
  setSession,
  withNudgeSessionLock,
} from '../../nudge/runtime/session/nudgeSessionStore.js';
import {
  NUDGE_SESSION_KEYS,
  readNudgeSessionMap,
} from '../../nudge/runtime/session/nudgeSessionShared.js';
import { hasFurinDailyPresentation, readFurinDailyReceipt } from '../../nudge/runtime/session/furinDailyPolicy.js';
import { requireGoalEpisodeBinding, areGoalEpisodeBindingsEqual } from '../../nudge/runtime/goalEpisodeBinding.js';

async function markNudgeAbortedForOwner(
  key,
  {
    reason = 'aborted',
    runId = null,
    tabId = null,
    now = Date.now(),
    durationMs = 0,
    hostname = '',
  } = {},
  cancellationBinding = null,
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key) || !isValidRunId(runId) || !isValidTabId(tabId)) {
      return {
        outcome: 'rejected',
        reason: 'INVALID_NUDGE_TERMINAL_OWNER',
        entry: null,
      };
    }

    const session = await getSession({
      [NUDGE_SESSION_KEYS.ACK]: {},
      [NUDGE_SESSION_KEYS.SHOWN]: {},
      [NUDGE_SESSION_KEYS.DEBT]: {},
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
      [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: {},
    });

    const nudgeAck = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK);
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);
    const terminalOutbox = normalizeNudgeTerminalOutboxMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL_OUTBOX),
    );

    const pendingEntry = normalizePendingEntry(nudgePending[key], now);
    const terminalEntry = normalizeTerminalEntry(nudgeTerminal[key], now);
    if (cancellationBinding !== null) {
      const bound = pendingEntry?.runId === runId ? pendingEntry.goalBinding : terminalEntry?.goalBinding;
      if (!bound || !areGoalEpisodeBindingsEqual(bound, cancellationBinding)) {
        return { outcome: 'rejected', reason: 'NUDGE_CANCELLATION_OWNER_CHANGED', entry: null };
      }
    }
    const replay = resolveNudgeTerminalOutboxReplay(terminalOutbox[runId], {
      key,
      runId,
      tabId,
      status: 'aborted',
    });
    if (replay) return replay;
    const leaseEntry = normalizeLeaseEntry(nudgeLease[key], now);
    if (cancellationBinding !== null && pendingEntry?.phase !== NUDGE_PENDING_PHASES.ENTRY_CANCELLING) {
      return { outcome: 'rejected', reason: 'NUDGE_CANCELLATION_PHASE_CHANGED', entry: null };
    }
    if (cancellationBinding !== null) reason = pendingEntry.cancellationReason;

    if (!isLifecycleAuthorized({
      runId,
      tabId,
      pendingEntry,
      leaseEntry,
      terminalEntry,
      now,
    })) {
      return {
        outcome: 'rejected',
        reason: 'NUDGE_TERMINAL_OWNER_UNAUTHORIZED',
        entry: null,
      };
    }

    if (pendingEntry.phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING && cancellationBinding === null) {
      return { outcome: 'cancellation_pending', reason: pendingEntry.cancellationReason, entry: null };
    }

    if (nudgePending[key]) {
      delete nudgePending[key];
    }
    if (nudgeLease[key]) {
      const lease = normalizeLeaseEntry(nudgeLease[key], now);
      if (!isValidRunId(runId) || !lease || lease.runId === runId) {
        delete nudgeLease[key];
      }
    }

    const terminal = buildTerminalEntry({
      runId,
      status: 'aborted',
      endedAt: now,
      goalBinding: pendingEntry?.goalBinding ?? null,
      reason,
    });
    if (terminal) {
      nudgeTerminal[key] = terminal;
    }

    const outboxEntry = buildNudgeTerminalOutboxEntry({
      key,
      runId,
      tabId,
      status: 'aborted',
      reason,
      durationMs,
      hostname,
      committedAt: now,
    });
    terminalOutbox[runId] = outboxEntry;

    const alreadyPresented = [NUDGE_PENDING_PHASES.PRESENTED, NUDGE_PENDING_PHASES.EPISODE_COMPLETED].includes(pendingEntry.phase)
      || !!readNudgeSessionMap(session, NUDGE_SESSION_KEYS.SHOWN)[key]
      || hasFurinDailyPresentation(await readFurinDailyReceipt(), key);
    const update = alreadyPresented ? {
      nudgeDebt: normalizeDebtMap(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT), now),
    } : await markDebtWithSessionData(key, {
      reason,
      now,
      sessionNudgeDebt: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT),
      sessionNudgeAck: nudgeAck,
      protocolClaim: pendingEntry?.protocolClaim || null,
    });
    if (alreadyPresented) delete update.nudgeDebt[key];

    await setSession({
      [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
      [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
      [NUDGE_SESSION_KEYS.DEBT]: update.nudgeDebt,
      [NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal,
      [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: pruneNudgeTerminalOutboxMap(terminalOutbox, now),
    });

    return {
      outcome: 'applied',
      reason: null,
      entry: outboxEntry,
    };
  });
}

export async function markNudgeAborted(key, options = {}) {
  return markNudgeAbortedForOwner(key, options);
}

// Only the goal invalidator enters after exact admission and document cleanup.
// The same full abort transaction retains debt/outbox/terminal semantics.
export async function completeNudgeGoalCancellation(value, { now = Date.now() } = {}) {
  const binding = requireGoalEpisodeBinding(value);
  return markNudgeAbortedForOwner(binding.key, { runId: binding.runId, tabId: binding.tabId,
    hostname: binding.hostname, now }, binding);
}
