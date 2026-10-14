import {
  buildTerminalEntry,
  coercePositiveTs,
  isLifecycleAuthorized,
  isValidKey,
  isValidRunId,
  isValidTabId,
  normalizeDebtMap,
  normalizeLeaseEntry,
  normalizePendingEntry,
  normalizeTerminalEntry,
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

export async function markNudgeResolved(
  key,
  {
    runId = null,
    tabId = null,
    now = Date.now(),
    reason = 'resolved',
    durationMs = 0,
    hostname = '',
  } = {},
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
    const nudgeShown = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.SHOWN);
    const nudgeDebt = normalizeDebtMap(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT), now);
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);
    const terminalOutbox = normalizeNudgeTerminalOutboxMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL_OUTBOX),
    );

    const replay = resolveNudgeTerminalOutboxReplay(terminalOutbox[runId], {
      key,
      runId,
      tabId,
      status: 'resolved',
    });
    if (replay) return replay;

    const pendingEntry = normalizePendingEntry(nudgePending[key], now);
    const leaseEntry = normalizeLeaseEntry(nudgeLease[key], now);
    const terminalEntry = normalizeTerminalEntry(nudgeTerminal[key], now);
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
    if (![NUDGE_PENDING_PHASES.PRESENTED, NUDGE_PENDING_PHASES.EPISODE_COMPLETED].includes(pendingEntry.phase)) {
      return { outcome: 'rejected', reason: 'NUDGE_ENTRY_NOT_PRESENTED', entry: null };
    }

    nudgeAck[key] = coercePositiveTs(nudgeAck[key], now);
    nudgeShown[key] = coercePositiveTs(nudgeShown[key], now);
    if (nudgeDebt[key]) delete nudgeDebt[key];
    if (nudgePending[key]) delete nudgePending[key];

    if (nudgeLease[key]) {
      const lease = normalizeLeaseEntry(nudgeLease[key], now);
      if (!isValidRunId(runId) || !lease || lease.runId === runId) {
        delete nudgeLease[key];
      }
    }

    const terminal = buildTerminalEntry({
      runId,
      status: 'resolved',
      endedAt: now,
      goalBinding: pendingEntry.goalBinding,
      reason,
    });
    if (terminal) {
      nudgeTerminal[key] = terminal;
    }

    const outboxEntry = buildNudgeTerminalOutboxEntry({
      key,
      runId,
      tabId,
      status: 'resolved',
      reason,
      durationMs,
      hostname,
      committedAt: now,
    });
    terminalOutbox[runId] = outboxEntry;

    await setSession({
      [NUDGE_SESSION_KEYS.ACK]: nudgeAck,
      [NUDGE_SESSION_KEYS.SHOWN]: nudgeShown,
      [NUDGE_SESSION_KEYS.DEBT]: nudgeDebt,
      [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
      [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
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
