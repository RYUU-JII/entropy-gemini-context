export const SENTINEL_PROTOCOL_QA_CHANNEL = 'entropy.sentinel.qa.v1';

export const SENTINEL_PROTOCOL_QA_ACTIONS = Object.freeze({
  START: 'QA_SENTINEL_PROTOCOL_START',
  SNAPSHOT: 'QA_SENTINEL_PROTOCOL_SNAPSHOT',
  READ_GOAL_STATE: 'QA_SENTINEL_GOAL_STATE',
  STOP: 'QA_SENTINEL_PROTOCOL_STOP',
});

const ACTIONS = new Set(Object.values(SENTINEL_PROTOCOL_QA_ACTIONS));
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

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
  if (!isRecord(payload)) fail('SENTINEL_PROTOCOL_QA_PAYLOAD_INVALID');
  const keys = Object.keys(payload);
  if (action !== SENTINEL_PROTOCOL_QA_ACTIONS.START) {
    if (keys.length > 0) fail('SENTINEL_PROTOCOL_QA_PAYLOAD_KEYS_INVALID');
    return Object.freeze({});
  }
  if (keys.some((key) => !['protocolScope', 'protocolIntensity', 'hudVisible', 'deliveryForm'].includes(key))) {
    fail('SENTINEL_PROTOCOL_QA_PAYLOAD_KEYS_INVALID');
  }
  const protocolScope = payload.protocolScope;
  if (protocolScope !== 'site' && protocolScope !== 'global') {
    fail('SENTINEL_PROTOCOL_QA_SCOPE_INVALID');
  }
  if (payload.deliveryForm !== undefined
    && (protocolScope !== 'site' || !['full', 'brief'].includes(payload.deliveryForm))) {
    fail('SENTINEL_PROTOCOL_QA_DELIVERY_FORM_INVALID');
  }

  const protocolIntensity = Number(payload.protocolIntensity ?? 0.88);
  if (!Number.isFinite(protocolIntensity) || protocolIntensity < 0 || protocolIntensity > 1) {
    fail('SENTINEL_PROTOCOL_QA_INTENSITY_INVALID');
  }
  if (payload.hudVisible !== undefined && typeof payload.hudVisible !== 'boolean') {
    fail('SENTINEL_PROTOCOL_QA_HUD_INVALID');
  }
  return Object.freeze({
    protocolScope,
    ...(protocolScope === 'site' ? { deliveryForm: payload.deliveryForm === undefined ? 'full' : payload.deliveryForm } : {}),
    protocolIntensity,
    hudVisible: payload.hudVisible === true,
  });
}

export function parseSentinelProtocolQaRequest(message) {
  if (!isRecord(message)) fail('SENTINEL_PROTOCOL_QA_REQUEST_INVALID');
  if (message.channel !== SENTINEL_PROTOCOL_QA_CHANNEL) {
    fail('SENTINEL_PROTOCOL_QA_CHANNEL_INVALID');
  }
  if (!ACTIONS.has(message.action)) fail('SENTINEL_PROTOCOL_QA_ACTION_INVALID');
  if (typeof message.requestId !== 'string' || !REQUEST_ID_PATTERN.test(message.requestId)) {
    fail('SENTINEL_PROTOCOL_QA_REQUEST_ID_INVALID');
  }
  const targetTabId = Number(message.targetTabId);
  if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) {
    fail('SENTINEL_PROTOCOL_QA_TARGET_TAB_INVALID');
  }
  return Object.freeze({
    channel: SENTINEL_PROTOCOL_QA_CHANNEL,
    action: message.action,
    requestId: message.requestId,
    targetTabId,
    payload: normalizePayload(message.action, message.payload),
  });
}

export function createSentinelProtocolQaResponse(request, {
  success,
  result = null,
  error = null,
} = {}) {
  const normalized = parseSentinelProtocolQaRequest(request);
  if (typeof success !== 'boolean') fail('SENTINEL_PROTOCOL_QA_RESPONSE_SUCCESS_INVALID');
  if (success && error !== null) fail('SENTINEL_PROTOCOL_QA_RESPONSE_ERROR_CONFLICT');
  if (!success && (typeof error !== 'string' || !error.trim())) {
    fail('SENTINEL_PROTOCOL_QA_RESPONSE_ERROR_REQUIRED');
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
