import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';

const DEFAULT_MESSAGE_LIMIT = 12;
const SLOW_RESPONSE_THRESHOLD_MS = 1_000;
const SAFE_RUNTIME_ROUTE_PHASES = new Set([
  'readiness_started',
  'readiness_settled',
  'capture_started',
  'capture_settled',
  'acquire_started',
  'acquire_settled',
  'handler_started',
  'handler_returned',
]);
const SAFE_RUNTIME_ACTIONS = new Set([
  MESSAGE_ACTIONS.GET_SETTINGS,
  MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
  MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT,
  MESSAGE_ACTIONS.GET_ANALYSIS_BOOTSTRAP_SNAPSHOT,
  MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT,
  MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT,
  MESSAGE_ACTIONS.INTERVENTION_ADMISSION,
]);
const SAFE_RUNTIME_ERROR_CODES = new Set([
  'BACKGROUND_RUNTIME_MESSAGE_HANDLER_THROWN',
  'BACKGROUND_PROFILE_GENERATION_BOOT_SETTLEMENT_NOT_REPORTED',
  'BACKGROUND_DASHBOARD_BOOT_READINESS_NOT_REPORTED',
  'PROFILE_GENERATION_BOOT_SETTLEMENT_FAILED',
  'DASHBOARD_BOOT_READINESS_FAILED',
  'SERVICE_INIT_FAILED',
  'SERVICE_NOT_HANDLED_ASYNC',
]);

function defaultNow() {
  return Date.now();
}

function createDefaultGenerationId() {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_RANDOMNESS_REQUIRED');
  }
  const words = new Uint32Array(2);
  globalThis.crypto.getRandomValues(words);
  const fixedWidthEpoch = Array.from(
    words,
    (word) => word.toString(16).padStart(8, '0'),
  ).join('');
  return `sw_${fixedWidthEpoch}`;
}

function requireEpochMs(value) {
  const epochMs = Number(value);
  if (!Number.isFinite(epochMs) || epochMs < 0) {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_CLOCK_INVALID');
  }
  return epochMs;
}

function normalizeRuntimeAction(message) {
  const action = typeof message?.action === 'string' ? message.action : '';
  if (SAFE_RUNTIME_ACTIONS.has(action)) return action;
  if (action) return 'OTHER_ACTION';
  if (message?.type === MESSAGE_TYPES.CONTENT_FLOW_SIGNAL) return MESSAGE_TYPES.CONTENT_FLOW_SIGNAL;
  return typeof message?.type === 'string' && message.type ? 'TYPED_MESSAGE' : 'UNTYPED_MESSAGE';
}

function normalizeResponseError(payload) {
  const error = typeof payload?.error === 'string' ? payload.error.trim() : '';
  if (!error) return null;
  return SAFE_RUNTIME_ERROR_CODES.has(error) ? error : 'NONCANONICAL_ERROR';
}

function cloneRecord(record) {
  if (!record) return null;
  return record.routePhases
    ? { ...record, routePhases: { ...record.routePhases } }
    : { ...record };
}

export function createBackgroundServiceWorkerWakeTelemetry({
  now = defaultNow,
  createGenerationId = createDefaultGenerationId,
  messageLimit = DEFAULT_MESSAGE_LIMIT,
} = {}) {
  if (typeof now !== 'function') {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_CLOCK_REQUIRED');
  }
  if (typeof createGenerationId !== 'function') {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_GENERATION_FACTORY_REQUIRED');
  }
  const resolvedMessageLimit = Number(messageLimit);
  if (!Number.isInteger(resolvedMessageLimit) || resolvedMessageLimit < 1 || resolvedMessageLimit > 32) {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_MESSAGE_LIMIT_INVALID');
  }
  const generationId = createGenerationId();
  if (typeof generationId !== 'string' || !/^sw_[0-9a-f]{16}$/.test(generationId)) {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_GENERATION_INVALID');
  }

  const telemetryInstalledAtEpochMs = requireEpochMs(now());
  const milestones = Object.create(null);
  const messages = [];
  const recentMessages = [];
  const slowMessages = [];
  const retainedMessages = new Map();
  let messageSequence = 0;
  let droppedMessageCount = 0;

  function markMilestone(name, { status = 'ready', errorCode = null } = {}) {
    if (typeof name !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(name)) {
      throw new Error('BACKGROUND_WAKE_TELEMETRY_MILESTONE_INVALID');
    }
    if (milestones[name]) return milestones[name];
    const atEpochMs = requireEpochMs(now());
    const record = Object.freeze({
      name,
      status,
      errorCode: normalizeResponseError({ error: errorCode }),
      atEpochMs,
      sinceTelemetryInstallMs: Math.max(0, atEpochMs - telemetryInstalledAtEpochMs),
    });
    milestones[name] = record;
    return record;
  }

  function pruneRetainedMessages() {
    const retainedSequences = new Set(
      [...messages, ...recentMessages, ...slowMessages].map((record) => record.sequence),
    );
    for (const sequence of retainedMessages.keys()) {
      if (!retainedSequences.has(sequence)) retainedMessages.delete(sequence);
    }
  }

  function appendBoundedRecord(records, record) {
    records.push(record);
    if (records.length > resolvedMessageLimit) records.shift();
  }

  function beginRuntimeMessage(message) {
    const arrivedAtEpochMs = requireEpochMs(now());
    const record = {
      sequence: ++messageSequence,
      wakeClass: messageSequence === 1 ? 'cold' : 'warm',
      action: normalizeRuntimeAction(message),
      arrivedAtEpochMs,
      sinceTelemetryInstallMs: Math.max(0, arrivedAtEpochMs - telemetryInstalledAtEpochMs),
      respondedAtEpochMs: null,
      responseLatencyMs: null,
      responseStatus: 'pending',
      responseError: null,
      routePhases: Object.create(null),
      routePhaseError: null,
    };
    if (messages.length < resolvedMessageLimit) messages.push(record);
    else droppedMessageCount += 1;
    appendBoundedRecord(recentMessages, record);
    pruneRetainedMessages();
    retainedMessages.set(record.sequence, record);
    return record.sequence;
  }

  function markRuntimeMessagePhase(sequence, phase) {
    if (!SAFE_RUNTIME_ROUTE_PHASES.has(phase)) {
      throw new Error('BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_INVALID');
    }
    const record = retainedMessages.get(sequence);
    if (!record) return null;
    if (Object.hasOwn(record.routePhases, phase)) return record.routePhases[phase];
    const atEpochMs = requireEpochMs(now());
    record.routePhases[phase] = atEpochMs;
    return atEpochMs;
  }

  function markRuntimeMessagePhaseFailure(sequence) {
    const record = retainedMessages.get(sequence);
    if (!record) return null;
    record.routePhaseError = 'BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_FAILED';
    return record.routePhaseError;
  }

  function finishRuntimeMessage(sequence, payload) {
    if (!Number.isInteger(sequence)) return null;
    const record = retainedMessages.get(sequence);
    if (!record || record.respondedAtEpochMs !== null) return record || null;
    const respondedAtEpochMs = requireEpochMs(now());
    record.respondedAtEpochMs = respondedAtEpochMs;
    record.responseLatencyMs = Math.max(0, respondedAtEpochMs - record.arrivedAtEpochMs);
    record.responseStatus = payload?.success === false ? 'failed' : 'responded';
    record.responseError = normalizeResponseError(payload);
    if (record.responseLatencyMs >= SLOW_RESPONSE_THRESHOLD_MS) {
      appendBoundedRecord(slowMessages, record);
      pruneRetainedMessages();
    }
    return record;
  }

  function snapshot() {
    return {
      schemaVersion: 1,
      generationId,
      telemetryInstalledAtEpochMs,
      milestones: Object.fromEntries(
        Object.entries(milestones).map(([name, record]) => [name, cloneRecord(record)]),
      ),
      messages: messages.map(cloneRecord),
      recentMessages: recentMessages.map(cloneRecord),
      slowMessages: slowMessages.map(cloneRecord),
      messageLimit: resolvedMessageLimit,
      droppedMessageCount,
    };
  }

  markMilestone('kernel_created');

  return Object.freeze({
    generationId,
    markMilestone,
    beginRuntimeMessage,
    markRuntimeMessagePhase,
    markRuntimeMessagePhaseFailure,
    finishRuntimeMessage,
    snapshot,
  });
}

export function installBackgroundServiceWorkerWakeTelemetry(options = {}) {
  const telemetry = createBackgroundServiceWorkerWakeTelemetry(options);
  Object.defineProperty(globalThis, '__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({ snapshot: telemetry.snapshot }),
  });
  return telemetry;
}

export function observeBackgroundRuntimeMessageHandler({ handler, telemetry } = {}) {
  if (typeof handler !== 'function') {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_MESSAGE_HANDLER_REQUIRED');
  }
  if (
    !telemetry
    || typeof telemetry.beginRuntimeMessage !== 'function'
    || typeof telemetry.finishRuntimeMessage !== 'function'
    || typeof telemetry.markRuntimeMessagePhase !== 'function'
    || typeof telemetry.markRuntimeMessagePhaseFailure !== 'function'
  ) {
    throw new Error('BACKGROUND_WAKE_TELEMETRY_OWNER_REQUIRED');
  }
  return (message, sender, sendResponse) => {
    const sequence = telemetry.beginRuntimeMessage(message);
    const reportRoutePhase = (phase) => {
      try {
        return telemetry.markRuntimeMessagePhase(sequence, phase);
      } catch {
        // Diagnostic failure is worker-local evidence, never routing authority.
        return telemetry.markRuntimeMessagePhaseFailure(sequence);
      }
    };
    const observedSendResponse = (payload) => {
      telemetry.finishRuntimeMessage(sequence, payload);
      return sendResponse?.(payload);
    };
    try {
      return handler(message, sender, observedSendResponse, reportRoutePhase);
    } catch (error) {
      telemetry.finishRuntimeMessage(sequence, {
        success: false,
        error: 'BACKGROUND_RUNTIME_MESSAGE_HANDLER_THROWN',
      });
      throw error;
    }
  };
}
