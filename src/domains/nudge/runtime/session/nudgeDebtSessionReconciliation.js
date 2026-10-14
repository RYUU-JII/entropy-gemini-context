import {
  normalizeDebtMap,
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

function buildUnresolvedDebtMap({
  sessionDebt = {},
  nudgeAck = {},
} = {}) {
  return Object.fromEntries(
    Object.entries(sessionDebt).filter(([key]) => !nudgeAck[key]),
  );
}

export async function reconcileNudgeDebtSession({
  getSessionFn = getSession,
  setSessionFn = setSession,
  withNudgeSessionLockFn = withNudgeSessionLock,
  now = Date.now(),
} = {}) {
  return withNudgeSessionLockFn(async () => {
    const session = await getSessionFn({
      [NUDGE_SESSION_KEYS.DEBT]: {},
      [NUDGE_SESSION_KEYS.ACK]: {},
    });
    const sessionDebt = normalizeDebtMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.DEBT),
      now,
    );
    const unresolvedDebt = buildUnresolvedDebtMap({
      sessionDebt,
      nudgeAck: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.ACK),
    });
    const changed = Object.keys(sessionDebt).length !== Object.keys(unresolvedDebt).length;

    if (changed) {
      await setSessionFn({
        [NUDGE_SESSION_KEYS.DEBT]: unresolvedDebt,
      });
    }

    return changed;
  });
}
