import {
  normalizeAudioDullingValue,
} from '../../../settings/config/audioDulling.js';

export const AUDIO_DULLING_QA_CHANNEL = 'entropy.audioDullingQa.v1';

export const AUDIO_DULLING_QA_ACTIONS = Object.freeze({
  PREPARE: 'QA_AUDIO_DULLING_PREPARE',
  INVITATION_PRESENTED: 'QA_AUDIO_DULLING_INVITATION_PRESENTED',
  INVITATION_ARRIVED: 'QA_AUDIO_DULLING_INVITATION_ARRIVED',
  INVITATION_EXPIRED: 'QA_AUDIO_DULLING_INVITATION_EXPIRED',
  UPDATE: 'QA_AUDIO_DULLING_UPDATE',
  SNAPSHOT: 'QA_AUDIO_DULLING_SNAPSHOT',
  STOP: 'QA_AUDIO_DULLING_STOP',
  CONTENT_MOUNT: 'QA_AUDIO_DULLING_CONTENT_MOUNT',
  CONTENT_STATUS: 'QA_AUDIO_DULLING_CONTENT_STATUS',
  CONTENT_SNAPSHOT: 'QA_AUDIO_DULLING_CONTENT_SNAPSHOT',
  CONTENT_REMOVE: 'QA_AUDIO_DULLING_CONTENT_REMOVE',
});

const ACTION_VALUES = new Set(Object.values(AUDIO_DULLING_QA_ACTIONS));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireRequestId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9:._-]{1,160}$/u.test(value)) {
    fail('AUDIO_DULLING_QA_REQUEST_ID_INVALID');
  }
  return value;
}

function requireTargetTabId(value) {
  const tabId = Number(value);
  if (!Number.isInteger(tabId) || tabId < 0) {
    fail('AUDIO_DULLING_QA_TARGET_TAB_ID_INVALID');
  }
  return tabId;
}

function normalizeBoundedDuration(value, {
  fallbackMs,
  minimum,
  maximum,
}) {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? Math.round(numeric) : fallbackMs;
  return Math.max(minimum, Math.min(maximum, resolved));
}

function normalizePayload(action, rawPayload) {
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? rawPayload
    : {};
  if (action === AUDIO_DULLING_QA_ACTIONS.PREPARE) {
    return Object.freeze({
      config: Object.freeze(normalizeAudioDullingValue(payload.config)),
      activationConfig: Object.freeze(
        normalizeAudioDullingValue(payload.activationConfig),
      ),
      revealDelayMs: normalizeBoundedDuration(payload.revealDelayMs, {
        fallbackMs: 0,
        minimum: 0,
        maximum: 600_000,
      }),
      invitationWindowMs: normalizeBoundedDuration(payload.invitationWindowMs, {
        fallbackMs: 10_000,
        minimum: 3_000,
        maximum: 30_000,
      }),
    });
  }
  if (action === AUDIO_DULLING_QA_ACTIONS.UPDATE) {
    return Object.freeze({
      config: Object.freeze(normalizeAudioDullingValue(payload.config)),
    });
  }
  if (action === AUDIO_DULLING_QA_ACTIONS.CONTENT_MOUNT) {
    return Object.freeze({
      config: Object.freeze(normalizeAudioDullingValue(payload.config)),
      revealDelayMs: normalizeBoundedDuration(payload.revealDelayMs, {
        fallbackMs: 0,
        minimum: 0,
        maximum: 600_000,
      }),
      invitationWindowMs: normalizeBoundedDuration(payload.invitationWindowMs, {
        fallbackMs: 10_000,
        minimum: 3_000,
        maximum: 30_000,
      }),
    });
  }
  if (action === AUDIO_DULLING_QA_ACTIONS.CONTENT_STATUS) {
    const status = typeof payload.status === 'string' ? payload.status.trim() : '';
    if (!status) fail('AUDIO_DULLING_QA_CONTENT_STATUS_REQUIRED');
    return Object.freeze({
      status,
      detail: typeof payload.detail === 'string' ? payload.detail.slice(0, 240) : '',
    });
  }
  return Object.freeze({});
}

export function isAudioDullingQaAction(action) {
  return ACTION_VALUES.has(action);
}

export function parseAudioDullingQaRequest(message, {
  requireTarget = true,
} = {}) {
  if (
    message?.channel !== AUDIO_DULLING_QA_CHANNEL
    || !isAudioDullingQaAction(message?.action)
  ) {
    fail('AUDIO_DULLING_QA_REQUEST_INVALID');
  }
  return Object.freeze({
    channel: AUDIO_DULLING_QA_CHANNEL,
    action: message.action,
    requestId: requireRequestId(message.requestId),
    targetTabId: requireTarget
      ? requireTargetTabId(message.targetTabId)
      : (
        message.targetTabId === null || message.targetTabId === undefined
          ? null
          : requireTargetTabId(message.targetTabId)
      ),
    payload: normalizePayload(message.action, message.payload),
  });
}

export function createAudioDullingQaResponse(request, {
  success,
  result = null,
  error = null,
} = {}) {
  if (typeof success !== 'boolean') {
    fail('AUDIO_DULLING_QA_RESPONSE_SUCCESS_REQUIRED');
  }
  return Object.freeze({
    channel: AUDIO_DULLING_QA_CHANNEL,
    action: request.action,
    requestId: request.requestId,
    targetTabId: request.targetTabId,
    success,
    result: success ? result : null,
    error: success ? null : (error || 'AUDIO_DULLING_QA_FAILED'),
  });
}
