export const VIDEO_SKIP_CONTROL_SURFACE_QA_CHANNEL = 'entropy.video-skip-control-surface.qa.v1';

export const VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS = Object.freeze({
  START: 'QA_VIDEO_SKIP_CONTROL_SURFACE_START',
  SNAPSHOT: 'QA_VIDEO_SKIP_CONTROL_SURFACE_SNAPSHOT',
  STOP: 'QA_VIDEO_SKIP_CONTROL_SURFACE_STOP',
});

const ACTIONS = new Set(Object.values(VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS));
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePayload(action, rawPayload) {
  const payload = rawPayload === undefined || rawPayload === null ? {} : rawPayload;
  if (!isRecord(payload)) fail('VIDEO_SKIP_CONTROL_SURFACE_QA_PAYLOAD_INVALID');
  const allowedKeys = action === VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.START
    ? ['sessionId', 'mode']
    : ['sessionId'];
  if (Object.keys(payload).some((key) => !allowedKeys.includes(key))) {
    fail('VIDEO_SKIP_CONTROL_SURFACE_QA_PAYLOAD_KEYS_INVALID');
  }
  if (typeof payload.sessionId !== 'string' || !SESSION_ID_PATTERN.test(payload.sessionId)) {
    fail('VIDEO_SKIP_CONTROL_SURFACE_QA_SESSION_ID_INVALID');
  }
  if (action === VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.START) {
    if (payload.mode !== 'hard_block') {
      fail('VIDEO_SKIP_CONTROL_SURFACE_QA_MODE_INVALID');
    }
    return Object.freeze({ sessionId: payload.sessionId, mode: payload.mode });
  }
  return Object.freeze({ sessionId: payload.sessionId });
}

export function isVideoSkipControlSurfaceQaAction(action) {
  return ACTIONS.has(action);
}

export function parseVideoSkipControlSurfaceQaRequest(message) {
  if (!isRecord(message)) fail('VIDEO_SKIP_CONTROL_SURFACE_QA_REQUEST_INVALID');
  if (message.channel !== VIDEO_SKIP_CONTROL_SURFACE_QA_CHANNEL) {
    fail('VIDEO_SKIP_CONTROL_SURFACE_QA_CHANNEL_INVALID');
  }
  if (!ACTIONS.has(message.action)) fail('VIDEO_SKIP_CONTROL_SURFACE_QA_ACTION_INVALID');
  if (typeof message.requestId !== 'string' || !REQUEST_ID_PATTERN.test(message.requestId)) {
    fail('VIDEO_SKIP_CONTROL_SURFACE_QA_REQUEST_ID_INVALID');
  }
  const targetTabId = Number(message.targetTabId);
  if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) {
    fail('VIDEO_SKIP_CONTROL_SURFACE_QA_TARGET_TAB_INVALID');
  }
  return Object.freeze({
    channel: VIDEO_SKIP_CONTROL_SURFACE_QA_CHANNEL,
    action: message.action,
    requestId: message.requestId,
    targetTabId,
    payload: normalizePayload(message.action, message.payload),
  });
}

export function createVideoSkipControlSurfaceQaResponse(request, {
  success,
  result = null,
  error = null,
} = {}) {
  const normalized = parseVideoSkipControlSurfaceQaRequest(request);
  if (typeof success !== 'boolean') fail('VIDEO_SKIP_CONTROL_SURFACE_QA_RESPONSE_SUCCESS_INVALID');
  if (success && error !== null) fail('VIDEO_SKIP_CONTROL_SURFACE_QA_RESPONSE_ERROR_CONFLICT');
  if (!success && (typeof error !== 'string' || !error.trim())) {
    fail('VIDEO_SKIP_CONTROL_SURFACE_QA_RESPONSE_ERROR_REQUIRED');
  }
  return Object.freeze({
    channel: normalized.channel,
    action: normalized.action,
    requestId: normalized.requestId,
    targetTabId: normalized.targetTabId,
    success,
    result: success ? result : null,
    error: success ? null : error.trim(),
  });
}
