import { runtimeSendMessageReliable } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { getHostname } from '../../../lib/url.js';
import { parseHostnameFromNudgeKey } from './index.js';
import { NUDGE_GLOBAL_PROTOCOL_DAY_HOST } from '../runtime/session/nudgeSessionShared.js';

function waitForLifecycleRetry(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });
}

async function sendSentinelLifecycleMessage(
  action,
  key,
  payload = {},
  { timeoutMs = 180, retryDelaysMs = [] } = {},
) {
  if (!key) {
    return {
      ok: false,
      sent: false,
      action,
      key: '',
      response: null,
      error: 'MISSING_NUDGE_KEY',
    };
  }

  const sendOnce = async () => {
    try {
      const result = await runtimeSendMessageReliable(
        { action, key, ...payload },
        { timeoutMs },
      );
      if (result?.ok !== true) {
        return {
          ok: false,
          sent: false,
          action,
          key,
          response: result?.response || null,
          error: String(result?.error || 'LIFECYCLE_SEND_FAILED'),
        };
      }
      if (result?.response?.success === false) {
        return {
          ok: false,
          sent: true,
          action,
          key,
          response: result.response,
          error: String(result.response?.error || 'LIFECYCLE_RESPONSE_REJECTED'),
        };
      }
      return {
        ok: true,
        sent: true,
        action,
        key,
        response: result?.response || null,
        error: '',
      };
    } catch (error) {
      return {
        ok: false,
        sent: false,
        action,
        key,
        response: null,
        error: String(error?.message || error || 'LIFECYCLE_SEND_FAILED'),
      };
    }
  };

  const retryDelays = Array.isArray(retryDelaysMs)
    ? retryDelaysMs.filter((delay) => Number.isFinite(Number(delay)) && Number(delay) >= 0)
    : [];
  let lastResult = null;
  let attempts = 0;
  for (let attemptIndex = 0; attemptIndex <= retryDelays.length; attemptIndex += 1) {
    if (attemptIndex > 0) {
      await waitForLifecycleRetry(retryDelays[attemptIndex - 1]);
    }
    attempts = attemptIndex + 1;
    lastResult = await sendOnce();
    if (lastResult.ok) {
      return { ...lastResult, attempts: attemptIndex + 1 };
    }
    const retryable = lastResult.sent !== true
      || lastResult.response?.retryable === true;
    if (!retryable) break;
  }
  return { ...lastResult, attempts };
}

function normalizeLifecycleRunId(runId) {
  return typeof runId === 'string' && runId.trim() ? runId.trim() : '';
}

function isDebugLifecycleMode(mode) {
  return typeof mode === 'string' && mode.trim().toLowerCase() === 'debug';
}

function normalizeLifecycleDiagnosticPhase(phase) {
  return typeof phase === 'string' && phase.trim()
    ? phase.trim()
    : 'unknown';
}

function formatLifecycleDiagnosticValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value?.message || value);
}

function formatSentinelLifecycleDiagnostic(diagnostic) {
  const details = Object.entries(diagnostic)
    .filter(([key]) => key !== 'code')
    .map(([key, value]) => {
      const formattedValue = formatLifecycleDiagnosticValue(value);
      return formattedValue ? `${key}=${formattedValue}` : '';
    })
    .filter(Boolean)
    .join(' ');
  return details
    ? `[sentinel flare] ${diagnostic.code} ${details}`
    : `[sentinel flare] ${diagnostic.code}`;
}

export function reportSentinelLifecycleMessageFailure(
  phase,
  sendResult,
  consoleRef = console,
) {
  const normalizedPhase = normalizeLifecycleDiagnosticPhase(phase);
  const diagnostic = {
    code: `sentinel_flare_lifecycle_${normalizedPhase}_failed`,
    action: sendResult?.action || '',
    key: sendResult?.key || '',
    error: String(sendResult?.error || 'LIFECYCLE_SEND_FAILED'),
  };
  if (consoleRef && typeof consoleRef.warn === 'function') {
    consoleRef.warn(formatSentinelLifecycleDiagnostic(diagnostic));
  }
  return diagnostic;
}

function observeSentinelLifecycleSend(sendPromise, phase, consoleRef = console) {
  if (!sendPromise || typeof sendPromise.then !== 'function') return;
  sendPromise.then((result) => {
    if (result?.ok === true) return;
    reportSentinelLifecycleMessageFailure(phase, result, consoleRef);
  }, (error) => {
    reportSentinelLifecycleMessageFailure(phase, {
      error: String(error?.message || error || 'LIFECYCLE_SEND_FAILED'),
    }, consoleRef);
  });
}

function resolveCurrentHostname(activeNudgeKey) {
  const fromNudgeKey = parseHostnameFromNudgeKey(activeNudgeKey);
  if (fromNudgeKey && fromNudgeKey !== NUDGE_GLOBAL_PROTOCOL_DAY_HOST) {
    return fromNudgeKey;
  }
  const fromPageUrl = getHostname(globalThis?.location?.href || '');
  if (fromPageUrl) return fromPageUrl;
  return '';
}

export function bindSentinelLifecycleListeners({
  windowRef = window,
  lifecycleListenersBound = false,
  pageHideHandler = null,
  beforeUnloadHandler = null,
  onAbort = null,
} = {}) {
  if (lifecycleListenersBound) {
    return { lifecycleListenersBound, pageHideHandler, beforeUnloadHandler };
  }

  const nextPageHideHandler = () => {
    onAbort?.('pagehide');
  };
  const nextBeforeUnloadHandler = () => {
    onAbort?.('beforeunload');
  };

  windowRef.addEventListener('pagehide', nextPageHideHandler, true);
  windowRef.addEventListener('beforeunload', nextBeforeUnloadHandler, true);

  return {
    lifecycleListenersBound: true,
    pageHideHandler: nextPageHideHandler,
    beforeUnloadHandler: nextBeforeUnloadHandler,
  };
}

export function unbindSentinelLifecycleListeners({
  windowRef = window,
  lifecycleListenersBound = false,
  pageHideHandler = null,
  beforeUnloadHandler = null,
} = {}) {
  if (!lifecycleListenersBound) {
    return { lifecycleListenersBound, pageHideHandler, beforeUnloadHandler };
  }

  if (pageHideHandler) {
    windowRef.removeEventListener('pagehide', pageHideHandler, true);
  }
  if (beforeUnloadHandler) {
    windowRef.removeEventListener('beforeunload', beforeUnloadHandler, true);
  }

  return {
    lifecycleListenersBound: false,
    pageHideHandler: null,
    beforeUnloadHandler: null,
  };
}

export function markSentinelNudgePresented({
  lifecyclePresentedSent = false,
  activeNudgeKey = null,
  mode = 'auto',
  activeNudgeRunId = null,
  startedAtMs = 0,
  admissionLeaseId = null,
  goalBinding = null,
  consoleRef = console,
} = {}) {
  if (lifecyclePresentedSent) {
    return {
      lifecyclePresentedSent,
      queued: false,
      skipped: true,
      reason: 'already_presented',
      lifecycleSendPromise: null,
    };
  }
  if (isDebugLifecycleMode(mode)) {
    return {
      lifecyclePresentedSent: true,
      queued: false,
      skipped: true,
      reason: 'debug_lifecycle_local',
      lifecycleSendPromise: null,
    };
  }
  if (!activeNudgeKey) {
    return {
      lifecyclePresentedSent,
      queued: false,
      skipped: true,
      reason: 'missing_nudge_key',
      lifecycleSendPromise: null,
    };
  }
  const runId = normalizeLifecycleRunId(activeNudgeRunId);
  if (!runId) {
    return {
      lifecyclePresentedSent,
      queued: false,
      skipped: true,
      reason: 'missing_run_id',
      lifecycleSendPromise: null,
    };
  }

  const hostname = resolveCurrentHostname(activeNudgeKey);
  const lifecycleSendPromise = sendSentinelLifecycleMessage(
    MESSAGE_ACTIONS.NUDGE_PRESENTED,
    activeNudgeKey,
    {
      mode,
      runId,
      leaseId: admissionLeaseId,
      goalBinding,
      startedAt: startedAtMs || Date.now(),
      ...(hostname ? { hostname } : {}),
    },
    { timeoutMs: 180, retryDelaysMs: [90, 240] },
  );
  observeSentinelLifecycleSend(lifecycleSendPromise, 'presented', consoleRef);
  return {
    lifecyclePresentedSent: true,
    queued: true,
    skipped: false,
    reason: '',
    lifecycleSendPromise,
  };
}

export function markSentinelNudgeEpisodeAbsorbed({
  lifecycleEpisodeAbsorbedSent = false,
  activeNudgeKey = null,
  mode = 'auto',
  activeNudgeRunId = null,
  startedAtMs = 0,
  reason = 'site_furin_completed',
  consoleRef = console,
} = {}) {
  if (lifecycleEpisodeAbsorbedSent) {
    return {
      lifecycleEpisodeAbsorbedSent,
      queued: false,
      skipped: true,
      reason: 'already_absorbed',
      lifecycleSendPromise: null,
    };
  }
  if (isDebugLifecycleMode(mode)) {
    return {
      lifecycleEpisodeAbsorbedSent: true,
      queued: false,
      skipped: true,
      reason: 'debug_lifecycle_local',
      lifecycleSendPromise: null,
    };
  }
  if (!activeNudgeKey) {
    return {
      lifecycleEpisodeAbsorbedSent,
      queued: false,
      skipped: true,
      reason: 'missing_nudge_key',
      lifecycleSendPromise: null,
    };
  }
  const runId = normalizeLifecycleRunId(activeNudgeRunId);
  if (!runId) {
    return {
      lifecycleEpisodeAbsorbedSent,
      queued: false,
      skipped: true,
      reason: 'missing_run_id',
      lifecycleSendPromise: null,
    };
  }

  const durationMs = startedAtMs > 0 ? Math.max(0, Date.now() - startedAtMs) : 0;
  const hostname = resolveCurrentHostname(activeNudgeKey);
  const lifecycleSendPromise = sendSentinelLifecycleMessage(
    MESSAGE_ACTIONS.NUDGE_EPISODE_ABSORBED,
    activeNudgeKey,
    { reason, mode, runId, durationMs, ...(hostname ? { hostname } : {}) },
    { timeoutMs: 220 },
  );
  observeSentinelLifecycleSend(lifecycleSendPromise, 'episode_absorbed', consoleRef);
  return {
    lifecycleEpisodeAbsorbedSent: true,
    queued: true,
    skipped: false,
    reason: '',
    lifecycleSendPromise,
  };
}

export function markSentinelNudgeAborted({
  lifecycleFinalAction = null,
  activeNudgeKey = null,
  mode = 'auto',
  activeNudgeRunId = null,
  startedAtMs = 0,
  reason = 'aborted',
  consoleRef = console,
} = {}) {
  if (lifecycleFinalAction) {
    return {
      lifecycleFinalAction,
      queued: false,
      skipped: true,
      reason: 'already_finalized',
      lifecycleSendPromise: null,
    };
  }

  const nextLifecycleFinalAction = 'aborted';
  if (isDebugLifecycleMode(mode)) {
    return {
      lifecycleFinalAction: nextLifecycleFinalAction,
      queued: false,
      skipped: true,
      reason: 'debug_lifecycle_local',
      lifecycleSendPromise: null,
    };
  }
  if (!activeNudgeKey) {
    return {
      lifecycleFinalAction: nextLifecycleFinalAction,
      queued: false,
      skipped: true,
      reason: 'missing_nudge_key',
      lifecycleSendPromise: null,
    };
  }
  const runId = normalizeLifecycleRunId(activeNudgeRunId);
  if (!runId) {
    return {
      lifecycleFinalAction: nextLifecycleFinalAction,
      queued: false,
      skipped: true,
      reason: 'missing_run_id',
      lifecycleSendPromise: null,
    };
  }

  const durationMs = startedAtMs > 0 ? Math.max(0, Date.now() - startedAtMs) : 0;
  const hostname = resolveCurrentHostname(activeNudgeKey);
  const lifecycleSendPromise = sendSentinelLifecycleMessage(
    MESSAGE_ACTIONS.NUDGE_ABORTED,
    activeNudgeKey,
    { reason, mode, runId, durationMs, ...(hostname ? { hostname } : {}) },
    { timeoutMs: 120, retryDelaysMs: [90, 240] },
  );
  observeSentinelLifecycleSend(lifecycleSendPromise, 'aborted', consoleRef);

  return {
    lifecycleFinalAction: nextLifecycleFinalAction,
    queued: true,
    skipped: false,
    reason: '',
    lifecycleSendPromise,
  };
}

export async function markSentinelNudgeResolved({
  lifecycleFinalAction = null,
  activeNudgeKey = null,
  mode = 'auto',
  activeNudgeRunId = null,
  startedAtMs = 0,
  reason = 'resolved',
} = {}) {
  if (lifecycleFinalAction === 'resolved') {
    return {
      lifecycleFinalAction,
      resolved: true,
      sendResult: null,
      skipped: true,
      reason: 'already_resolved',
    };
  }
  if (lifecycleFinalAction === 'aborted') {
    return {
      lifecycleFinalAction,
      resolved: false,
      sendResult: null,
      skipped: true,
      reason: 'already_aborted',
    };
  }

  const nextLifecycleFinalAction = 'resolved';
  if (isDebugLifecycleMode(mode)) {
    return {
      lifecycleFinalAction: nextLifecycleFinalAction,
      resolved: true,
      sendResult: null,
      skipped: true,
      reason: 'debug_lifecycle_local',
    };
  }
  if (!activeNudgeKey) {
    return {
      lifecycleFinalAction: nextLifecycleFinalAction,
      resolved: true,
      sendResult: null,
      skipped: true,
      reason: 'missing_nudge_key',
    };
  }
  const runId = normalizeLifecycleRunId(activeNudgeRunId);
  if (!runId) {
    return {
      lifecycleFinalAction: nextLifecycleFinalAction,
      resolved: false,
      sendResult: null,
      skipped: true,
      reason: 'missing_run_id',
    };
  }

  const durationMs = startedAtMs > 0 ? Math.max(0, Date.now() - startedAtMs) : 0;
  const hostname = resolveCurrentHostname(activeNudgeKey);
  const sendResult = await sendSentinelLifecycleMessage(
    MESSAGE_ACTIONS.NUDGE_RESOLVED,
    activeNudgeKey,
    { reason, mode, runId, durationMs, hostname: hostname || undefined },
    { timeoutMs: 320, retryDelaysMs: [90, 240] },
  );

  return {
    lifecycleFinalAction: nextLifecycleFinalAction,
    resolved: sendResult.ok === true,
    sendResult,
    skipped: false,
    reason: '',
  };
}
