import {
  normalizeFeedHorizonInspectionControl,
} from '../feed-horizon-inspection/feedHorizonInspectionContract.dev.js';
import {
  QA_AUTOMATION_HARNESS_PATH,
} from '../../../../platform/security/qaAutomationHarnessTrust.dev.js';

export const RUNTIME_DEBUGGER_AUTOMATION_CHANNEL = 'entropy.runtimeDebugger.automation.v1';
export const RUNTIME_DEBUGGER_AUTOMATION_HARNESS_PATH = QA_AUTOMATION_HARNESS_PATH;

export const RUNTIME_DEBUGGER_AUTOMATION_ACTIONS = Object.freeze({
  START: 'DEBUG_RUNTIME_SESSION_START',
  RESET: 'DEBUG_RUNTIME_SESSION_RESET',
  SNAPSHOT: 'DEBUG_RUNTIME_SESSION_SNAPSHOT',
  PROJECT_CONTENTION_WINDOW: 'DEBUG_RUNTIME_PROJECT_CONTENTION_WINDOW',
  REPORT: 'DEBUG_RUNTIME_SESSION_REPORT',
  SET_TERMINUS_DRY_RUN: 'DEBUG_RUNTIME_SET_TERMINUS_DRY_RUN',
  CONTROL_FEED_HORIZON_INSPECTION: 'DEBUG_RUNTIME_CONTROL_FEED_HORIZON_INSPECTION',
  SET_FEED_CONSUMPTION_RESEARCH: 'DEBUG_RUNTIME_SET_FEED_CONSUMPTION_RESEARCH',
  FORCE_ENSO_GATE: 'DEBUG_RUNTIME_FORCE_ENSO_GATE',
  DISMISS_ENSO_GATE: 'DEBUG_RUNTIME_DISMISS_ENSO_GATE',
  STOP: 'DEBUG_RUNTIME_SESSION_STOP',
});

const ACTION_SET = new Set(Object.values(RUNTIME_DEBUGGER_AUTOMATION_ACTIONS));
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const CAPTURE_KINDS = new Set(['live', 'reload']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_REQUEST_ID_INVALID');
  }
  return value;
}

function normalizeTargetTabId(value) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_INVALID');
  }
  return numeric;
}

function normalizeActionPayload(action, payload) {
  const payloadKeys = Object.keys(payload);
  if (action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.FORCE_ENSO_GATE) {
    if (payloadKeys.some((key) => key !== 'admissionMode')) throw new Error('RUNTIME_DEBUGGER_AUTOMATION_PAYLOAD_KEYS_INVALID');
    const admissionMode = payload.admissionMode === undefined ? 'manual' : payload.admissionMode;
    if (!['manual', 'ordinary'].includes(admissionMode)) throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ADMISSION_MODE_INVALID');
    return Object.freeze({ admissionMode });
  }
  if (action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START) {
    if (payloadKeys.some((key) => key !== 'captureKind')) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_PAYLOAD_KEYS_INVALID');
    }
    const captureKind = payload?.captureKind ?? 'live';
    if (!CAPTURE_KINDS.has(captureKind)) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CAPTURE_KIND_INVALID');
    }
    return Object.freeze({ captureKind });
  }
  if (action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_TERMINUS_DRY_RUN) {
    if (payloadKeys.length !== 1 || payloadKeys[0] !== 'enabled') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_PAYLOAD_KEYS_INVALID');
    }
    if (typeof payload.enabled !== 'boolean') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_TERMINUS_ENABLED_INVALID');
    }
    return Object.freeze({ enabled: payload.enabled });
  }
  if (action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_FEED_CONSUMPTION_RESEARCH) {
    if (payloadKeys.length !== 1 || payloadKeys[0] !== 'enabled') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_PAYLOAD_KEYS_INVALID');
    }
    if (typeof payload.enabled !== 'boolean') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_FEED_RESEARCH_ENABLED_INVALID');
    }
    return Object.freeze({ enabled: payload.enabled });
  }
  if (action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.CONTROL_FEED_HORIZON_INSPECTION) {
    return normalizeFeedHorizonInspectionControl(payload);
  }
  if (action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.PROJECT_CONTENTION_WINDOW) {
    if (
      payloadKeys.length !== 2
      || !payloadKeys.includes('startedAt')
      || !payloadKeys.includes('endedAt')
    ) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENTION_WINDOW_KEYS_INVALID');
    }
    const startedAt = Number(payload.startedAt);
    const endedAt = Number(payload.endedAt);
    if (
      !Number.isFinite(startedAt)
      || !Number.isFinite(endedAt)
      || startedAt < 0
      || endedAt < startedAt
      || endedAt - startedAt > 30_000
    ) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENTION_WINDOW_BOUNDS_INVALID');
    }
    return Object.freeze({ startedAt, endedAt });
  }
  if (payloadKeys.length > 0) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_PAYLOAD_KEYS_INVALID');
  }
  return Object.freeze({});
}

function requirePayload(value) {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_PAYLOAD_INVALID');
  }
  return value;
}

export function isRuntimeDebuggerAutomationAction(value) {
  return typeof value === 'string' && ACTION_SET.has(value);
}

export function parseRuntimeDebuggerAutomationRequest(message, {
  requireBackgroundRelay = false,
} = {}) {
  if (!isRecord(message)) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_REQUEST_INVALID');
  }
  if (message.channel !== RUNTIME_DEBUGGER_AUTOMATION_CHANNEL) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CHANNEL_INVALID');
  }
  if (!isRuntimeDebuggerAutomationAction(message.action)) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ACTION_INVALID');
  }
  if (requireBackgroundRelay && message.relay !== 'background') {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_BACKGROUND_RELAY_REQUIRED');
  }
  const payload = requirePayload(message.payload);
  return Object.freeze({
    channel: RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
    action: message.action,
    requestId: normalizeRequestId(message.requestId),
    targetTabId: normalizeTargetTabId(message.targetTabId),
    payload: normalizeActionPayload(message.action, payload),
  });
}

export function createRuntimeDebuggerAutomationContentRequest(request) {
  const normalized = parseRuntimeDebuggerAutomationRequest(request);
  return Object.freeze({
    ...normalized,
    relay: 'background',
  });
}

export function createRuntimeDebuggerAutomationResponse(request, {
  success,
  result = null,
  error = null,
} = {}) {
  const normalized = parseRuntimeDebuggerAutomationRequest(request, {
    requireBackgroundRelay: request?.relay === 'background',
  });
  if (typeof success !== 'boolean') {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_RESPONSE_SUCCESS_INVALID');
  }
  if (success && error !== null) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_RESPONSE_ERROR_CONFLICT');
  }
  if (!success && (typeof error !== 'string' || !error.trim())) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_RESPONSE_ERROR_REQUIRED');
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

export function requireRuntimeDebuggerAutomationResponse(response, request) {
  if (!isRecord(response)) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_RESPONSE_INVALID');
  }
  const normalized = parseRuntimeDebuggerAutomationRequest(request, {
    requireBackgroundRelay: request?.relay === 'background',
  });
  if (
    response.channel !== normalized.channel
    || response.action !== normalized.action
    || response.requestId !== normalized.requestId
    || response.targetTabId !== normalized.targetTabId
  ) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_RESPONSE_MISMATCH');
  }
  if (typeof response.success !== 'boolean') {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_RESPONSE_INVALID');
  }
  if (response.success && response.error !== null) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_RESPONSE_ERROR_CONFLICT');
  }
  if (!response.success && (typeof response.error !== 'string' || !response.error.trim())) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_RESPONSE_ERROR_REQUIRED');
  }
  if (!response.success && response.result !== null) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_RESPONSE_RESULT_CONFLICT');
  }
  return response;
}
