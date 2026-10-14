import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { runtimeSendMessageReliable } from '../../../platform/messaging/runtime/runtimeMessaging.js';
import { TAB_CLOSURE_OUTCOMES } from '../../protection/contracts/tabClosureContract.js';

export const ENSO_GATE_LEAVE_OUTCOMES = Object.freeze({
  CLOSED: 'closed',
  /** A higher intervention took the tab; leaving is now its business. */
  STOOD_DOWN: 'stood_down',
  REDIRECTED: 'redirected',
  FAILED: 'failed',
});


const ENSO_GATE_CLOSE_TIMEOUT_MS = 700;

function getErrorMessage(error, fallback = 'ENSO_GATE_NAVIGATION_FAILED') {
  return String(error?.message || error || fallback);
}

function getConsoleRef() {
  return typeof console === 'undefined' ? null : console;
}

function reportEnsoGateNavigationFailure(phase, error, consoleRef = getConsoleRef()) {
  const diagnostic = {
    phase,
    error: getErrorMessage(error),
  };
  consoleRef?.warn?.('[EnsoGateNavigation] leave navigation step failed', diagnostic);
  return diagnostic;
}

/**
 * Three outcomes, not two.
 *
 * `closed` and `failed` are the obvious ones. `refused` is the one that matters:
 * the background arbiter has told us a higher intervention already owns this
 * tab and is about to take it. Falling back to the escape redirect there would
 * navigate the tab out from under that intervention, which is the same
 * collision the arbiter exists to prevent - so a refusal means stand down.
 */
async function requestCurrentTabClose(admissionLease) {
  const result = await runtimeSendMessageReliable(
    {
      action: MESSAGE_ACTIONS.ENSO_GATE_CLOSE_CURRENT_TAB,
      reason: 'enso_gate_escape',
      admissionLease,
    },
    { timeoutMs: ENSO_GATE_CLOSE_TIMEOUT_MS },
  );
  if (!result?.ok) return { closed: false, refused: false, refusedBy: null };
  const response = result.response;
  if (response?.success === true) {
    return { closed: true, refused: false, refusedBy: null };
  }
  if (response?.outcome === TAB_CLOSURE_OUTCOMES.REFUSED) {
    return {
      closed: false,
      refused: true,
      refusedBy: typeof response.refusedBy === 'string' ? response.refusedBy : '',
    };
  }
  return { closed: false, refused: false, refusedBy: null };
}

export async function navigateAwayFromEnsoGate(
  _win = (typeof window === 'undefined' ? null : window),
  { consoleRef = getConsoleRef(), admissionLease = null } = {},
) {
  try {
    const closure = await requestCurrentTabClose(admissionLease);
    if (closure.closed) {
      return { outcome: ENSO_GATE_LEAVE_OUTCOMES.CLOSED, refusedBy: null };
    }
    if (closure.refused) {
      return {
        outcome: ENSO_GATE_LEAVE_OUTCOMES.STOOD_DOWN,
        refusedBy: closure.refusedBy,
      };
    }
  } catch (error) {
    reportEnsoGateNavigationFailure('tab_close', error, consoleRef);
  }
  return {
    // A transport failure is not authority to navigate a possibly replaced
    // intervention. The user retains the page and can choose an explicit exit.
    outcome: ENSO_GATE_LEAVE_OUTCOMES.FAILED,
    refusedBy: null,
  };
}
