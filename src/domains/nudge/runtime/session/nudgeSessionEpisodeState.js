import {
  canTransitionPendingPhase,
  coercePositiveTs,
  coerceTabId,
  isLifecycleAuthorized,
  isValidKey,
  normalizeDebtMap,
  normalizeLeaseEntry,
  normalizePendingEntry,
  normalizeTerminalEntry,
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
} from './nudgeSessionShared.js';

function writePositiveTimestamp(map, key, now) {
  const previous = map[key];
  const next = coercePositiveTs(previous, now);
  if (previous === next) return false;
  map[key] = next;
  return true;
}

export async function markNudgeDayEpisodeCompleted(
  key,
  {
    now = Date.now(),
    runId = null,
    tabId = null,
  } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;

    const session = await getSession({
      [NUDGE_SESSION_KEYS.ACK]: {},
      [NUDGE_SESSION_KEYS.SHOWN]: {},
      [NUDGE_SESSION_KEYS.DEBT]: {},
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const nudgeAck = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK);
    const nudgeShown = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.SHOWN);
    const nudgeDebt = normalizeDebtMap(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT), now);
    const nudgePending = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const nudgeLease = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.LEASE);
    const nudgeTerminal = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL);

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
    })) return false;
    if (!canTransitionPendingPhase(
      pendingEntry.phase,
      NUDGE_PENDING_PHASES.EPISODE_COMPLETED,
    )) return false;
    if (pendingEntry.phase === NUDGE_PENDING_PHASES.EPISODE_COMPLETED) return true;

    let changed = false;
    changed = writePositiveTimestamp(nudgeAck, key, now) || changed;
    changed = writePositiveTimestamp(nudgeShown, key, now) || changed;

    if (nudgeDebt[key]) {
      delete nudgeDebt[key];
      changed = true;
    }
    nudgePending[key] = {
      ts: now,
      runId,
      tabId: coerceTabId(tabId, pendingEntry?.tabId ?? leaseEntry?.tabId ?? null),
      phase: NUDGE_PENDING_PHASES.EPISODE_COMPLETED,
      goalBinding: pendingEntry.goalBinding,
      ...(pendingEntry.deliveryForm ? { deliveryForm: pendingEntry.deliveryForm } : {}),
      ...(pendingEntry?.protocolClaim ? { protocolClaim: pendingEntry.protocolClaim } : {}),
      ...(pendingEntry?.hostname ? { hostname: pendingEntry.hostname } : {}),
    };
    changed = true;
    if (nudgeLease[key]) {
      delete nudgeLease[key];
      changed = true;
    }

    if (!changed) return false;

    await setSession({
      [NUDGE_SESSION_KEYS.ACK]: nudgeAck,
      [NUDGE_SESSION_KEYS.SHOWN]: nudgeShown,
      [NUDGE_SESSION_KEYS.DEBT]: nudgeDebt,
      [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
      [NUDGE_SESSION_KEYS.LEASE]: nudgeLease,
      [NUDGE_SESSION_KEYS.TERMINAL]: nudgeTerminal,
    });
    return true;
  });
}
