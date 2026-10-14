import { requireGoalEpisodeBinding, areGoalEpisodeBindingsEqual } from '../goalEpisodeBinding.js';
import { normalizePendingEntry, NUDGE_PENDING_PHASES, requireNudgeCancellationReason } from './nudgeSessionCore.js';
import { getSession, setSession, withNudgeSessionLock } from './nudgeSessionStore.js';
import { NUDGE_SESSION_KEYS, readNudgeSessionMap } from './nudgeSessionShared.js';

const UNSERVED = new Set([NUDGE_PENDING_PHASES.DISPATCHING, NUDGE_PENDING_PHASES.ENTRY_WAITING,
  NUDGE_PENDING_PHASES.ENTRY_CANCELLING]);

export function readUnservedGoalEpisodes({ tabId = null } = {}) {
  return withNudgeSessionLock(async () => {
    const session = await getSession({ [NUDGE_SESSION_KEYS.PENDING]: {} });
    return Object.entries(readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING)).flatMap(([key, raw]) => {
      const pending = normalizePendingEntry(raw);
      if (!pending || !UNSERVED.has(pending.phase) || (tabId !== null && pending.tabId !== tabId)) return [];
      if (pending.goalBinding.key !== key) throw new Error('NUDGE_GOAL_CANCELLATION_KEY_MISMATCH');
      return [{ goalBinding: pending.goalBinding, phase: pending.phase,
        ...(pending.phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING ? { cancellationReason: pending.cancellationReason } : {}) }];
    });
  });
}

/** Close admission before awaiting physical cleanup. Ownership survives a failed
 * cleanup and the next normal ingress retries the same cancellation. */
export function markNudgeGoalCancelling(value, { reason } = {}) {
  const binding = requireGoalEpisodeBinding(value);
  requireNudgeCancellationReason(reason);
  return withNudgeSessionLock(async () => {
    const session = await getSession({ [NUDGE_SESSION_KEYS.PENDING]: {} });
    const map = readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING);
    const pending = normalizePendingEntry(map[binding.key]);
    if (!pending || !areGoalEpisodeBindingsEqual(pending.goalBinding, binding) || !UNSERVED.has(pending.phase)) return null;
    const cancellationReason = pending.phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING ? pending.cancellationReason : reason;
    if (pending.phase !== NUDGE_PENDING_PHASES.ENTRY_CANCELLING) {
      map[binding.key] = { ...pending, phase: NUDGE_PENDING_PHASES.ENTRY_CANCELLING, cancellationReason };
      await setSession({ [NUDGE_SESSION_KEYS.PENDING]: map });
    }
    return Object.freeze({ goalBinding: pending.goalBinding, reason: cancellationReason });
  });
}
