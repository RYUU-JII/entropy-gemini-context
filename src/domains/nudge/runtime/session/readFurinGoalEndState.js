import { getSession } from './nudgeSessionStore.js';
import { NUDGE_SESSION_KEYS, readNudgeSessionMap } from './nudgeSessionShared.js';
import { readFurinDailyReceipt } from './furinDailyPolicy.js';

/** Passive reads never enter the mutation lock or reconcile an owner. Durable
 * presentation commits before session state and outranks it in the projection. */
export async function readFurinGoalEndState() {
  const session = await getSession({
    [NUDGE_SESSION_KEYS.PENDING]: {},
    [NUDGE_SESSION_KEYS.TERMINAL]: {},
  });
  const dailyReceipt = await readFurinDailyReceipt();
  return {
    dailyReceipt,
    pending: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING),
    terminal: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL),
  };
}
