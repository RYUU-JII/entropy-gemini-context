import { getNudgeGateState } from '../../../../nudge/runtime/session/nudgeSessionGateState.js';
import {
  abortNudgeRunBeforePresentation,
  beginNudgeRun,
} from '../../../../nudge/runtime/session/nudgeSessionDispatchState.js';
import {
  isForegroundTab,
  toErrorMessage,
} from './ProtectionDispatchTransport.js';

function createSkip(reason, hostname, extra = {}) {
  return {
    ok: false,
    result: {
      dispatched: false,
      skipped: reason,
      hostname,
      ...extra,
    },
  };
}

function resolveBrowserPort(browserPort) {
  if (
    !browserPort
    || typeof browserPort.tabsGet !== 'function'
    || typeof browserPort.windowsGetLastFocused !== 'function'
  ) {
    throw new Error('PROTECTION_NUDGE_GATE_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

function failTriggerTarget(fieldName) {
  throw new Error(`PROTECTION_NUDGE_GATE_TRIGGER_TARGET_INVALID:${fieldName}`);
}

function requireTriggerTarget(triggerTarget) {
  if (triggerTarget === null || typeof triggerTarget !== 'object' || Array.isArray(triggerTarget)) {
    failTriggerTarget('target');
  }
  if (!Number.isInteger(triggerTarget.targetMs) || triggerTarget.targetMs < 0) {
    failTriggerTarget('targetMs');
  }
  if (
    !Number.isInteger(triggerTarget.observedMs) || triggerTarget.observedMs < 0
  ) {
    failTriggerTarget('observedMs');
  }
  return triggerTarget;
}

function requireDispatchBeginResult(beginResult) {
  if (beginResult === null || typeof beginResult !== 'object' || Array.isArray(beginResult)) {
    throw new Error('PROTECTION_NUDGE_GATE_BEGIN_RESULT_INVALID');
  }
  if (typeof beginResult.ok !== 'boolean') {
    throw new Error('PROTECTION_NUDGE_GATE_BEGIN_RESULT_INVALID');
  }
  if (!beginResult.ok && (typeof beginResult.reason !== 'string' || !beginResult.reason.trim())) {
    throw new Error('PROTECTION_NUDGE_GATE_BEGIN_FAILURE_REASON_REQUIRED');
  }
  return beginResult;
}

export function createProtectionNudgeDispatchGate({
  browserPort,
  recordDiagnostic,
} = {}) {
  if (typeof recordDiagnostic !== 'function') {
    throw new Error('PROTECTION_NUDGE_GATE_DIAGNOSTICS_REQUIRED');
  }

  const resolvedBrowserPort = resolveBrowserPort(browserPort);
  const dispatchInFlight = new Set();

  async function evaluateReadiness({
    force = false,
    tabId,
    hostname,
    key,
    now,
    triggerTarget,
    protocolClaim,
    timeline,
  } = {}) {
    if (force) {
      return {
        ok: true,
        hasDebt: false,
      };
    }

    const gate = await getNudgeGateState(key, { now });
    const hasDebt = gate.debt;
    const foreground = await isForegroundTab(tabId, resolvedBrowserPort, {
      onError: (error) => {
        recordDiagnostic('nudge_foreground_tab_lookup_failed', {
          tabId,
          hostname,
          error: toErrorMessage(error),
        });
      },
    });
    if (!foreground) {
      timeline?.skipped?.('background_tab');
      return createSkip('background_tab', hostname);
    }
    if (gate.pending) {
      timeline?.skipped?.('pending_nudge');
      return createSkip('pending_nudge', hostname);
    }
    if (!hasDebt) {
      if (gate.shown) {
        timeline?.skipped?.('already_shown');
        return createSkip('already_shown', hostname);
      }
    }
    const resolvedTriggerTarget = requireTriggerTarget(triggerTarget);
    const observedMs = resolvedTriggerTarget.observedMs;
    if (observedMs < resolvedTriggerTarget.targetMs) {
      timeline?.skipped?.('below_target');
      return createSkip('below_target', hostname, { observedMs, targetMs: resolvedTriggerTarget.targetMs });
    }

    return {
      ok: true,
      hasDebt,
      preempted: null,
      debtClaim: gate.debtClaim || null,
    };
  }

  function reserveInFlight({
    force = false,
    key,
    hostname,
    timeline,
  } = {}) {
    if (force) {
      return {
        ok: true,
        inFlightHeld: false,
      };
    }
    if (dispatchInFlight.has(key)) {
      timeline?.skipped?.('dispatch_in_flight');
      return createSkip('dispatch_in_flight', hostname);
    }
    dispatchInFlight.add(key);
    return {
      ok: true,
      inFlightHeld: true,
    };
  }

  async function beginDispatch({
    force = false,
    key,
    tabId,
    now,
    runId,
    protocolClaim = null,
    goalBinding = null,
    hostname,
    preempted = null,
    timeline,
  } = {}) {
    if (force) {
      return {
        ok: true,
        dispatchBegun: false,
        deliveryForm: 'full',
      };
    }

    if (preempted) throw new Error('NUDGE_ORDINARY_PREEMPTION_FORBIDDEN');

    const beginResult = requireDispatchBeginResult(await beginNudgeRun(key, {
      runId,
      tabId,
      now,
      protocolClaim,
      hostname,
      goalBinding,
    }));
    if (!beginResult.ok) {
      const reason = beginResult.reason.trim();
      timeline?.skipped?.(reason, { runId });
      return createSkip(reason, hostname, { runId });
    }
    return {
      ok: true,
      dispatchBegun: true,
      deliveryForm: beginResult.pending.deliveryForm,
    };
  }

  async function abortDispatchAfterFailure({
    dispatchBegun = false,
    key,
    runId,
    tabId,
    now = Date.now(),
    reason = 'dispatch_failed',
    requireAbortedRun = false,
  } = {}) {
    if (!dispatchBegun) return;
    try {
      const aborted = await abortNudgeRunBeforePresentation(key, { runId, now, reason });
      if (requireAbortedRun && aborted !== true) {
        throw new Error('PROTECTION_NUDGE_ENTRY_CANCEL_ABORT_UNCONFIRMED');
      }
    } catch (abortError) {
      recordDiagnostic('nudge_dispatch_abort_failed', {
        key,
        runId,
        tabId,
        error: toErrorMessage(abortError),
      });
      console.warn('[ProtectionNudgeDispatchGate] Failed to abort nudge session after dispatch error:', {
        key,
        runId,
        tabId,
        error: toErrorMessage(abortError),
      });
      if (requireAbortedRun) throw abortError;
    }
  }

  function finishInFlight({
    force = false,
    key,
  } = {}) {
    if (!force) {
      dispatchInFlight.delete(key);
    }
  }

  return {
    abortDispatchAfterFailure,
    beginDispatch,
    evaluateReadiness,
    finishInFlight,
    reserveInFlight,
  };
}
