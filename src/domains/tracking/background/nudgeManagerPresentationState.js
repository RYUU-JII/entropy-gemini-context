import {
  buildLeaseEntry,
  canTransitionPendingPhase,
  coerceTabId,
  isLifecycleAuthorized,
  isValidKey,
  isValidRunId,
  normalizeLeaseEntry,
  normalizePendingEntry,
  normalizeTerminalEntry,
  NUDGE_LEASE_TTL_MS,
  NUDGE_PENDING_PHASES,
} from '../../nudge/runtime/session/nudgeSessionCore.js';
import {
  getSession,
  setSession,
  withNudgeSessionLock,
} from '../../nudge/runtime/session/nudgeSessionStore.js';
import {
  NUDGE_SESSION_KEYS,
  readNudgeSessionMap,
} from '../../nudge/runtime/session/nudgeSessionShared.js';
import { recordFurinDailyPresentation } from '../../nudge/runtime/session/furinDailyPolicy.js';

export async function markNudgePresented(
  key,
  { runId = null, tabId = null, now = Date.now(), validatePresentation = null } = {},
) {
  return withNudgeSessionLock(async () => {
    if (!isValidKey(key)) return false;

    const session = await getSession({
      [NUDGE_SESSION_KEYS.SHOWN]: {},
      [NUDGE_SESSION_KEYS.PENDING]: {},
      [NUDGE_SESSION_KEYS.LEASE]: {},
      [NUDGE_SESSION_KEYS.TERMINAL]: {},
    });
    const nudgeShown = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.SHOWN);
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
    })) {
      return false;
    }
    if (!canTransitionPendingPhase(
      pendingEntry.phase,
      NUDGE_PENDING_PHASES.PRESENTED,
    )) return false;
    if (pendingEntry.goalBinding.key !== key) throw new Error('NUDGE_PRESENTATION_GOAL_KEY_MISMATCH');
    if (typeof validatePresentation !== 'function') throw new Error('NUDGE_PRESENTATION_VALIDATOR_REQUIRED');
    const authorization = await validatePresentation(pendingEntry.goalBinding);
    if (authorization?.accepted !== true) return false;
    if (pendingEntry.phase === NUDGE_PENDING_PHASES.PRESENTED) return true;

    // An actual host presentation is the daily cap, not an outcome ACK. Commit
    // the durable receipt first: a later session failure cannot repeat the UI.
    await recordFurinDailyPresentation(key, pendingEntry, now);

    if (!nudgeShown[key]) {
      nudgeShown[key] = now;
    }

    const resolvedRunId = isValidRunId(runId)
      ? runId
      : (pendingEntry?.runId || leaseEntry?.runId || null);
    const resolvedTabId = coerceTabId(
      tabId,
      pendingEntry?.tabId ?? leaseEntry?.tabId ?? null,
    );

    nudgePending[key] = {
      ts: now,
      runId: resolvedRunId,
      tabId: resolvedTabId,
      phase: NUDGE_PENDING_PHASES.PRESENTED,
      deliveryForm: pendingEntry.deliveryForm,
      goalBinding: pendingEntry.goalBinding,
      ...(pendingEntry?.protocolClaim ? { protocolClaim: pendingEntry.protocolClaim } : {}),
      ...(pendingEntry?.hostname ? { hostname: pendingEntry.hostname } : {}),
    };

    const patch = {
      [NUDGE_SESSION_KEYS.SHOWN]: nudgeShown,
      [NUDGE_SESSION_KEYS.PENDING]: nudgePending,
    };

    if (resolvedRunId) {
      nudgeLease[key] = buildLeaseEntry({
        runId: resolvedRunId,
        tabId: resolvedTabId,
        now,
        ttlMs: NUDGE_LEASE_TTL_MS,
      });
      patch[NUDGE_SESSION_KEYS.LEASE] = nudgeLease;
    }

    await setSession(patch);
    return true;
  });
}
