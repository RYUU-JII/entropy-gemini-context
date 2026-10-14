export const QA_SCENARIO_TAB_ACTIVATION_CHANNEL = 'entropy.qa.scenarioTabActivation.v1';
export const QA_SCENARIO_TAB_ACTIVATION_ACTION = 'DEBUG_QA_ACTIVATE_SCENARIO_TAB';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_REQUEST_ID_INVALID');
  }
  return value;
}

function normalizeTargetTabId(value) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_TARGET_TAB_INVALID');
  }
  return numeric;
}

export function parseQaScenarioTabActivationRequest(message) {
  if (!isRecord(message)) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_REQUEST_INVALID');
  }
  const keys = Object.keys(message).sort();
  if (keys.join(',') !== 'action,channel,focusWindow,requestId,targetTabId') {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_REQUEST_KEYS_INVALID');
  }
  if (message.channel !== QA_SCENARIO_TAB_ACTIVATION_CHANNEL) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_CHANNEL_INVALID');
  }
  if (message.action !== QA_SCENARIO_TAB_ACTIVATION_ACTION) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_ACTION_INVALID');
  }
  if (message.focusWindow !== false) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_OS_FOCUS_FORBIDDEN');
  }
  return Object.freeze({
    channel: QA_SCENARIO_TAB_ACTIVATION_CHANNEL,
    action: QA_SCENARIO_TAB_ACTIVATION_ACTION,
    requestId: normalizeRequestId(message.requestId),
    targetTabId: normalizeTargetTabId(message.targetTabId),
    focusWindow: false,
  });
}

export function createQaScenarioTabActivationRequest({ requestId, targetTabId } = {}) {
  return parseQaScenarioTabActivationRequest({
    channel: QA_SCENARIO_TAB_ACTIVATION_CHANNEL,
    action: QA_SCENARIO_TAB_ACTIVATION_ACTION,
    requestId,
    targetTabId,
    focusWindow: false,
  });
}

export function createQaScenarioTabActivationResponse(request, {
  success,
  result = null,
  error = null,
} = {}) {
  const normalized = parseQaScenarioTabActivationRequest(request);
  if (typeof success !== 'boolean') {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_SUCCESS_INVALID');
  }
  if (success && error !== null) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_ERROR_CONFLICT');
  }
  if (!success && (typeof error !== 'string' || !error.trim())) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_ERROR_REQUIRED');
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

export function requireQaScenarioTabActivationResponse(response, request) {
  const normalized = parseQaScenarioTabActivationRequest(request);
  if (!isRecord(response)) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_INVALID');
  }
  if (
    response.channel !== normalized.channel
    || response.action !== normalized.action
    || response.requestId !== normalized.requestId
    || response.targetTabId !== normalized.targetTabId
  ) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_MISMATCH');
  }
  if (typeof response.success !== 'boolean') {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_INVALID');
  }
  if (response.success && response.error !== null) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_ERROR_CONFLICT');
  }
  if (!response.success && (typeof response.error !== 'string' || !response.error.trim())) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_ERROR_REQUIRED');
  }
  if (!response.success && response.result !== null) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_RESPONSE_RESULT_CONFLICT');
  }
  return response;
}
