import {
  isLeaseActive,
  isPendingEntryActive,
  normalizeLeaseEntry,
  normalizePendingEntry,
  normalizeTerminalEntry,
} from './nudgeSessionCore.js';
import {
  getSession,
  withNudgeSessionLock,
} from './nudgeSessionStore.js';
import {
  NUDGE_SESSION_KEYS,
  readNudgeSessionMap,
} from './nudgeSessionShared.js';

function isTargetTab(tabId, pendingEntry, leaseEntry) {
  return pendingEntry?.tabId === tabId || leaseEntry?.tabId === tabId;
}

export async function readActiveNudgeOwnerForTab(tabId, { now = Date.now() } = {}) {
  if (!Number.isInteger(tabId) || tabId < 0) {
    throw new Error('NUDGE_OWNER_TARGET_TAB_INVALID');
  }

  return withNudgeSessionLock(async () => {
    const session = await getSession({
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const pendingMap = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const leaseMap = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const terminalMap = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);
    const keys = new Set([...Object.keys(pendingMap), ...Object.keys(leaseMap)]);
    const owners = [];

    keys.forEach((key) => {
      const pending = normalizePendingEntry(pendingMap[key], now);
      const lease = normalizeLeaseEntry(leaseMap[key], now);
      const activePending = isPendingEntryActive(pending, now) ? pending : null;
      const activeLease = isLeaseActive(lease, now) ? lease : null;
      if (!activePending && !activeLease) return;
      if (!isTargetTab(tabId, activePending, activeLease)) return;

      const runId = activePending?.runId || activeLease?.runId || null;
      const terminal = normalizeTerminalEntry(terminalMap[key], now);
      if (runId && terminal?.runId === runId) return;

      owners.push({
        key,
        runId,
        tabId,
        phase: activePending?.phase || 'leased',
        goalBinding: activePending?.goalBinding ?? null,
      });
    });

    return {
      active: owners.length > 0,
      owners,
    };
  });
}
