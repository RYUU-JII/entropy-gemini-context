import { runtimeSendMessageReliable } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  CONTENT_RECEIVER_CAPABILITY_VERSION,
} from '../../../platform/messaging/contentReceiverCapability.js';

export const CONTENT_BOOTSTRAP_STATE_KEY = '__entropyContentBootstrapState__';
export const CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY = '__entropyContentBootstrapAttemptLease__';
// Reporting deadline only: the underlying send runs with `timeoutMs: 0`, so a late
// acknowledgement still lands and still resolves the background's pending ready wait.
// Kept in step with CONTENT_SCRIPT_READY_TIMEOUT_MS so a slow-but-fine bootstrap is not
// reported as unacknowledged while the background is still legitimately waiting.
export const CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT_MS = 3_000;

function createContentBootstrapStateError(code, details = {}) {
  const error = new Error(code);
  error.name = 'ContentBootstrapStateError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function describeUnknownError(value, fallback = 'CONTENT_BOOTSTRAP_STATE_PUBLISH_FAILED') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value?.message === 'string' && value.message.trim()) return value.message.trim();
  if (typeof value?.error === 'string' && value.error.trim()) return value.error.trim();
  if (typeof value?.code === 'string' && value.code.trim()) return value.code.trim();
  if (value && typeof value === 'object') {
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch (_error) {
      // Fall through to the stable fallback below.
    }
  }
  return fallback;
}

function isTransientPublishFailure({ code = '', message = '' } = {}) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (normalizedCode === 'CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT') return true;
  if (normalizedCode === 'RUNTIME_UNAVAILABLE') return true;

  const normalizedMessage = String(message || '').trim().toLowerCase();
  return normalizedMessage.includes('extension context invalidated')
    || normalizedMessage.includes('context invalidated')
    || normalizedMessage.includes('runtime_unavailable')
    || normalizedMessage.includes('receiving end does not exist')
    || normalizedMessage.includes('message channel closed')
    || normalizedMessage.includes('message port closed')
    || normalizedMessage.includes('the tab was closed')
    || normalizedMessage.includes('no tab with id');
}

function writeBootstrapState(nextState) {
  globalThis[CONTENT_BOOTSTRAP_STATE_KEY] = nextState;
  if (typeof window !== 'undefined') {
    window[CONTENT_BOOTSTRAP_STATE_KEY] = nextState;
  }
  return nextState;
}

function writeBootstrapAttemptLease(attempt) {
  globalThis[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] = attempt;
  if (typeof window !== 'undefined') {
    window[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] = attempt;
  }
  return attempt;
}

export function readBootstrapState() {
  return globalThis[CONTENT_BOOTSTRAP_STATE_KEY]
    || (typeof window !== 'undefined' ? window[CONTENT_BOOTSTRAP_STATE_KEY] : null)
    || null;
}

export function readBootstrapAttemptLease() {
  return globalThis[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY]
    || (typeof window !== 'undefined' ? window[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] : null)
    || null;
}

function normalizeAttemptId(value) {
  const attemptId = Number(value);
  return Number.isInteger(attemptId) && attemptId > 0 ? attemptId : null;
}

function normalizeStartedAt(value) {
  const startedAt = Number(value);
  return Number.isFinite(startedAt) && startedAt > 0 ? Math.floor(startedAt) : null;
}

function validateBootstrapAttemptLease(attempt) {
  const attemptId = normalizeAttemptId(attempt?.attemptId);
  const startedAt = normalizeStartedAt(attempt?.startedAt);
  if (
    !attempt
    || attemptId === null
    || startedAt === null
    || !attempt.signal
    || typeof attempt.signal.aborted !== 'boolean'
    || typeof attempt.signal.addEventListener !== 'function'
    || typeof attempt.cancel !== 'function'
  ) {
    throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_ATTEMPT_LEASE_INVALID', {
      attemptId: attempt?.attemptId ?? null,
      startedAt: attempt?.startedAt ?? null,
    });
  }
  return attempt;
}

export function createContentBootstrapAttemptLease({
  attemptId,
  startedAt = Date.now(),
  replacesAttemptId = null,
  reason = 'document_start',
} = {}) {
  const normalizedAttemptId = normalizeAttemptId(attemptId);
  const normalizedStartedAt = normalizeStartedAt(startedAt);
  if (normalizedAttemptId === null || normalizedStartedAt === null) {
    throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_ATTEMPT_IDENTITY_INVALID', {
      attemptId: attemptId ?? null,
      startedAt: startedAt ?? null,
    });
  }
  const abortController = new AbortController();
  const lease = {
    attemptId: normalizedAttemptId,
    startedAt: normalizedStartedAt,
    replacesAttemptId: normalizeAttemptId(replacesAttemptId),
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'document_start',
    signal: abortController.signal,
    revokedAt: null,
    revokeReason: null,
    cancel(cancelReason = 'attempt_replaced') {
      if (abortController.signal.aborted) return false;
      lease.revokedAt = Date.now();
      lease.revokeReason = typeof cancelReason === 'string' && cancelReason.trim()
        ? cancelReason.trim()
        : 'attempt_replaced';
      abortController.abort(lease.revokeReason);
      return true;
    },
  };
  return lease;
}

export function activateBootstrapAttempt(attempt) {
  const nextAttempt = validateBootstrapAttemptLease(attempt);
  if (nextAttempt.signal.aborted) {
    throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_ATTEMPT_STALE', {
      phase: 'attempt_activation',
      attemptId: nextAttempt.attemptId,
    });
  }
  const currentAttempt = readBootstrapAttemptLease();
  if (currentAttempt === nextAttempt) return nextAttempt;
  if (currentAttempt && currentAttempt.signal?.aborted !== true) {
    throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_ATTEMPT_LEASE_CONFLICT', {
      currentAttemptId: currentAttempt.attemptId ?? null,
      nextAttemptId: nextAttempt.attemptId,
    });
  }
  return writeBootstrapAttemptLease(nextAttempt);
}

export function isBootstrapAttemptCurrent(attempt, { allowRevoked = false } = {}) {
  if (!attempt || readBootstrapAttemptLease() !== attempt) return false;
  return allowRevoked || attempt.signal?.aborted !== true;
}

export function assertBootstrapAttemptCurrent(attempt, phase, options = {}) {
  if (isBootstrapAttemptCurrent(attempt, options)) return attempt;
  throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_ATTEMPT_STALE', {
    phase,
    attemptId: attempt?.attemptId ?? null,
    currentAttemptId: readBootstrapAttemptLease()?.attemptId ?? null,
    aborted: attempt?.signal?.aborted === true,
  });
}

function setBootstrapState({
  status,
  attemptId,
  startedAt = null,
  receiverReadyAt = null,
  activeAt = null,
  failedAt = null,
  error = null,
  reason = null,
} = {}) {
  const nextStatus = typeof status === 'string' && status.trim() ? status.trim() : 'bootstrapping';
  const dispatchReady = nextStatus === 'receiver_ready' || nextStatus === 'active';
  return writeBootstrapState({
    status: nextStatus,
    attemptId,
    dispatchReady,
    receiverCapabilityVersion: dispatchReady
      ? CONTENT_RECEIVER_CAPABILITY_VERSION
      : null,
    active: nextStatus === 'active',
    startedAt,
    receiverReadyAt,
    activeAt,
    failedAt,
    error,
    reason,
  });
}

function describeBootstrapStatePublishError(error, status) {
  const details = error?.details && typeof error.details === 'object'
    ? { ...error.details }
    : {};
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : describeUnknownError(error);
  const message = (
    code === 'CONTENT_BOOTSTRAP_STATE_PUBLISH_FAILED'
    || code === 'CONTENT_BOOTSTRAP_STATE_PUBLISH_REJECTED'
  ) && typeof details.error === 'string' && details.error.trim()
    ? details.error.trim()
    : describeUnknownError(error);
  const transient = isTransientPublishFailure({ code, message });
  return {
    status: typeof status === 'string' && status.trim() ? status.trim() : null,
    code,
    message,
    details,
    transient,
    failedAt: Date.now(),
  };
}

function recordBootstrapStatePublishFailure(error, publishedState) {
  const current = readBootstrapState();
  if (!current || current !== publishedState) return false;
  writeBootstrapState({
    ...current,
    lastPublishError: describeBootstrapStatePublishError(error, publishedState.status),
  });
  return true;
}

async function sendBootstrapStateMessage(message, { timeoutMs = CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT_MS } = {}) {
  const safeTimeoutMs = Math.max(1, Math.round(Number(timeoutMs) || CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT_MS));
  let timeoutId = 0;
  try {
    const delivery = await Promise.race([
      runtimeSendMessageReliable(message, { timeoutMs: 0 }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createContentBootstrapStateError('CONTENT_BOOTSTRAP_STATE_PUBLISH_TIMEOUT', {
            status: message?.payload?.status || null,
            timeoutMs: safeTimeoutMs,
          }));
        }, safeTimeoutMs);
      }),
    ]);
    if (delivery?.ok === false) {
      throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_STATE_PUBLISH_FAILED', {
        status: message?.payload?.status || null,
        error: describeUnknownError(delivery?.error || delivery),
      });
    }
    const response = delivery?.ok === true ? delivery.response : delivery;
    if (response?.success === false) {
      throw createContentBootstrapStateError('CONTENT_BOOTSTRAP_STATE_PUBLISH_REJECTED', {
        status: message?.payload?.status || null,
        error: describeUnknownError(response?.error || response),
      });
    }
    return response;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function startBootstrapStatePublish(message, {
  attempt,
  publishedState,
  allowRevoked = false,
  ...options
} = {}) {
  const status = typeof message?.payload?.status === 'string'
    ? message.payload.status
    : null;
  try {
    assertBootstrapAttemptCurrent(attempt, `publish_${status}_before_send`, { allowRevoked });
  } catch (error) {
    if (error?.code === 'CONTENT_BOOTSTRAP_ATTEMPT_STALE') return;
    throw error;
  }
  void sendBootstrapStateMessage(message, options)
    .then(() => {
      assertBootstrapAttemptCurrent(attempt, `publish_${status}_after_send`, { allowRevoked });
    })
    .catch((error) => {
      if (error?.code === 'CONTENT_BOOTSTRAP_ATTEMPT_STALE') return;
      if (!recordBootstrapStatePublishFailure(error, publishedState)) return;
      const lastPublishError = readBootstrapState()?.lastPublishError || describeBootstrapStatePublishError(error, status);
      const payload = {
        status,
        code: lastPublishError.code,
        error: lastPublishError.message,
        transient: lastPublishError.transient === true,
      };
      if (lastPublishError.transient === true && typeof console.debug === 'function') {
        console.debug('[ContentBootstrapState] Bootstrap state publish was not acknowledged:', payload);
        return;
      }
      // chrome://extensions may stringify object arguments as [object Object].
      // Keep the rejection cause in the visible text as well as structured data.
      console.warn(
        `[ContentBootstrapState] Failed to publish bootstrap state: ${payload.code}; status=${status}; cause=${payload.error}`,
        payload,
      );
    });
}

export async function publishBootstrapState(status, patch = {}, {
  attempt,
  allowRevoked = false,
} = {}) {
  assertBootstrapAttemptCurrent(attempt, `commit_${status}`, { allowRevoked });
  const nextState = setBootstrapState({
    status,
    ...patch,
    attemptId: attempt.attemptId,
  });
  const url = typeof window !== 'undefined' && typeof window.location?.href === 'string'
    ? window.location.href
    : '';
  startBootstrapStatePublish({
    type: MESSAGE_TYPES.CONTENT_BOOTSTRAP_STATE,
    payload: {
      ...nextState,
      url,
    },
  }, {
    attempt,
    publishedState: nextState,
    allowRevoked,
  });
  assertBootstrapAttemptCurrent(attempt, `commit_${status}_after_send`, { allowRevoked });
  return nextState;
}

export async function revokeBootstrapAttempt(attempt, patch = {}, { publish = true } = {}) {
  if (typeof publish !== 'boolean') throw new Error('CONTENT_BOOTSTRAP_REVOKE_PUBLISH_INVALID');
  assertBootstrapAttemptCurrent(attempt, 'attempt_revoke');
  const reason = typeof patch?.reason === 'string' && patch.reason.trim()
    ? patch.reason.trim()
    : 'runtime_teardown';
  attempt.cancel(reason);
  assertBootstrapAttemptCurrent(attempt, 'attempt_revoke_commit', { allowRevoked: true });
  if (!publish) {
    return setBootstrapState({ ...patch, status: 'stale', attemptId: attempt.attemptId,
      startedAt: attempt.startedAt, reason });
  }
  return publishBootstrapState('stale', {
    ...patch,
    startedAt: attempt.startedAt,
    reason,
  }, {
    attempt,
    allowRevoked: true,
  });
}
