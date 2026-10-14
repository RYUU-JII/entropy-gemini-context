import {
  buildTerminalEntry,
  coerceTabId,
  isValidKey,
  isValidRunId,
  normalizeDebtEntry,
  normalizeDebtMap,
  normalizeLeaseEntry,
  normalizePendingEntry,
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
  resolveNudgeHostnameFromDayKey,
} from '../../nudge/runtime/session/nudgeSessionShared.js';
import { hasFurinDailyPresentation, readFurinDailyReceipt } from '../../nudge/runtime/session/furinDailyPolicy.js';

export async function abortNudgesForTab(
  tabId,
  {
    reason = 'tab_transition',
    now = Date.now(),
    runIds = null,
    mutationFence = null,
  } = {},
) {
  if (runIds !== null && (!Array.isArray(runIds) || runIds.some((id) => !isValidRunId(id)))) {
    throw new Error('NUDGE_TAB_ABORT_RUN_IDS_INVALID');
  }
  if (mutationFence !== null && typeof mutationFence?.assertCurrent !== 'function') {
    throw new Error('NUDGE_TAB_ABORT_MUTATION_FENCE_INVALID');
  }
  return withNudgeSessionLock(async () => {
    mutationFence?.assertCurrent('nudge_tab_abort_lock_admitted');
    const normalizedTabId = coerceTabId(tabId, null);
    if (normalizedTabId === null) {
      return {
        changed: false,
        abortedCount: 0,
        debtAppliedCount: 0,
        clearedPendingCount: 0,
        clearedLeaseCount: 0,
        outboxEnqueuedCount: 0,
        pendingOutboxCount: 0,
        terminalEffectsPending: false,
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
    const dailyReceipt = await readFurinDailyReceipt();
    mutationFence?.assertCurrent('nudge_tab_abort_facts_read');
    const nudgeDebt = normalizeDebtMap(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT), now);
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);
    const terminalOutbox = normalizeNudgeTerminalOutboxMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL_OUTBOX),
    );

    const keys = new Set([
      ...Object.keys(nudgePending),
      ...Object.keys(nudgeLease),
    ]);

    let changedPending = false;
    let changedLease = false;
    let changedDebt = false;
    let changedTerminal = false;
    let changedTerminalOutbox = false;
    let abortedCount = 0;
    let debtAppliedCount = 0;
    let clearedPendingCount = 0;
    let clearedLeaseCount = 0;
    let outboxEnqueuedCount = 0;

    keys.forEach((key) => {
      if (!isValidKey(key)) return;
      const pending = normalizePendingEntry(nudgePending[key], now);
      const lease = normalizeLeaseEntry(nudgeLease[key], now);
      const pendingMatches = pending?.tabId === normalizedTabId;
      const leaseMatches = lease?.tabId === normalizedTabId;
      if (!pendingMatches && !leaseMatches) return;
      if (
        pending
        && lease
        && (
          pending.runId !== lease.runId
          || pending.tabId !== lease.tabId
        )
      ) {
        throw new Error(`NUDGE_TAB_ABORT_RUN_OWNER_CONFLICT:${key}`);
      }
      const terminalRunId = pending?.runId || lease?.runId || null;
      if (!isValidRunId(terminalRunId)) {
        throw new Error(`NUDGE_TAB_ABORT_RUN_OWNER_INVALID:${key}`);
      }
      if (runIds !== null && !runIds.includes(terminalRunId)) return;

      const outboxReplay = resolveNudgeTerminalOutboxReplay(terminalOutbox[terminalRunId], {
        key,
        runId: terminalRunId,
        tabId: normalizedTabId,
        status: 'aborted',
      });
      if (outboxReplay?.outcome === 'conflict') {
        throw new Error(`NUDGE_TAB_ABORT_TERMINAL_OUTBOX_CONFLICT:${terminalRunId}`);
      }
      const terminalHostname = pending?.hostname || resolveNudgeHostnameFromDayKey(key);
      if (!terminalHostname) {
        throw new Error(`NUDGE_TAB_ABORT_HOSTNAME_OWNER_REQUIRED:${key}:${terminalRunId}`);
      }

      let cleared = false;

      if (Object.prototype.hasOwnProperty.call(nudgePending, key)) {
        delete nudgePending[key];
        changedPending = true;
        clearedPendingCount += 1;
        cleared = true;
      }

      if (Object.prototype.hasOwnProperty.call(nudgeLease, key)) {
        delete nudgeLease[key];
        changedLease = true;
        clearedLeaseCount += 1;
        cleared = true;
      }

      if (!cleared) return;
      abortedCount += 1;

      const terminal = buildTerminalEntry({
        runId: terminalRunId,
        status: 'aborted',
        endedAt: now,
        goalBinding: pending?.goalBinding ?? null,
      });
      if (terminal) {
        nudgeTerminal[key] = {
          ...terminal,
          reason: typeof reason === 'string' && reason ? reason : 'tab_transition',
        };
        changedTerminal = true;
      }

      if (!outboxReplay) {
        terminalOutbox[terminalRunId] = buildNudgeTerminalOutboxEntry({
          key,
          runId: terminalRunId,
          tabId: normalizedTabId,
          status: 'aborted',
          reason,
          hostname: terminalHostname,
          committedAt: now,
        });
        changedTerminalOutbox = true;
        outboxEnqueuedCount += 1;
      }

      if (nudgeAck[key] || nudgeShown[key]
        || (pending && [NUDGE_PENDING_PHASES.PRESENTED, NUDGE_PENDING_PHASES.EPISODE_COMPLETED].includes(pending.phase))
        || hasFurinDailyPresentation(dailyReceipt, key)) {
        if (Object.hasOwn(nudgeDebt, key)) { delete nudgeDebt[key]; changedDebt = true; }
        return;
      }

      const previousDebt = normalizeDebtEntry(nudgeDebt[key], now);
      const protocolClaim = pending?.protocolClaim || previousDebt?.protocolClaim || null;
      const nextDebt = {
        createdAt: previousDebt?.createdAt || now,
        updatedAt: now,
        reason: typeof reason === 'string' && reason ? reason : 'tab_transition',
        ...(protocolClaim ? { protocolClaim } : {}),
      };

      const changedEntry = !previousDebt
        || previousDebt.updatedAt !== nextDebt.updatedAt
        || previousDebt.reason !== nextDebt.reason
        || previousDebt.createdAt !== nextDebt.createdAt
        || JSON.stringify(previousDebt.protocolClaim || null) !== JSON.stringify(nextDebt.protocolClaim || null);

      nudgeDebt[key] = nextDebt;
      if (changedEntry) {
        changedDebt = true;
        debtAppliedCount += 1;
      }
    });

    if (
      changedPending
      || changedLease
      || changedDebt
      || changedTerminal
      || changedTerminalOutbox
    ) {
      const patch = {};
      if (changedPending) patch[NUDGE_SESSION_KEYS.PENDING] = nudgePending;
      if (changedLease) patch[NUDGE_SESSION_KEYS.LEASE] = nudgeLease;
      if (changedDebt) patch[NUDGE_SESSION_KEYS.DEBT] = nudgeDebt;
      if (changedTerminal) patch[NUDGE_SESSION_KEYS.TERMINAL] = nudgeTerminal;
      if (changedTerminalOutbox) {
        patch[NUDGE_SESSION_KEYS.TERMINAL_OUTBOX] = pruneNudgeTerminalOutboxMap(
          terminalOutbox,
          now,
        );
      }
      mutationFence?.assertCurrent('nudge_tab_abort_before_commit');
      await setSession(patch);
    }

    const pendingOutboxCount = Object.values(terminalOutbox)
      .filter((entry) => (
        entry.state === 'pending'
        && entry.tabId === normalizedTabId
      ))
      .length;
    return {
      changed: changedPending
        || changedLease
        || changedDebt
        || changedTerminal
        || changedTerminalOutbox,
      abortedCount,
      debtAppliedCount,
      clearedPendingCount,
      clearedLeaseCount,
      outboxEnqueuedCount,
      pendingOutboxCount,
      terminalEffectsPending: pendingOutboxCount > 0,
    };
  });
}
