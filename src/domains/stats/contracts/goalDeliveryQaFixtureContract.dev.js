export const GOAL_DELIVERY_QA_CHARGE_ACTION = 'QA_GOAL_DELIVERY_CHARGE';
export const GOAL_DELIVERY_QA_CHARGE_CONTRACT = 'goal_delivery_qa_charge_v1';
export const GOAL_DELIVERY_QA_MAX_DELTA_MS = 600000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RUN_ID = /^\d{17}-[a-z0-9][a-z0-9-]{1,96}-[0-9a-f]{8}$/u;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

export function goalDeliveryQaError(suffix) {
  const code = `GOAL_DELIVERY_QA_${suffix}`;
  return Object.assign(new Error(code), { code });
}

function requireKeys(value, keys, suffix) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw goalDeliveryQaError(suffix);
  }
}

export function requireGoalDeliveryQaDelta({ hostname, observedDeltaMs, protectedDeltaMs }) {
  if (!['youtube.com', 'tiktok.com'].includes(hostname)) throw goalDeliveryQaError('HOSTNAME_INVALID');
  if (!Number.isSafeInteger(observedDeltaMs) || observedDeltaMs <= 0 || observedDeltaMs > GOAL_DELIVERY_QA_MAX_DELTA_MS
    || !Number.isSafeInteger(protectedDeltaMs) || protectedDeltaMs < 0 || protectedDeltaMs > observedDeltaMs) {
    throw goalDeliveryQaError('DELTA_INVALID');
  }
}

export function parseGoalDeliveryQaFixtureRequest(message) {
  requireKeys(message, ['action', 'requestId', 'payload'], 'REQUEST_INVALID');
  if (message.action !== GOAL_DELIVERY_QA_CHARGE_ACTION) throw goalDeliveryQaError('ACTION_INVALID');
  if (typeof message.requestId !== 'string' || !REQUEST_ID.test(message.requestId)) throw goalDeliveryQaError('REQUEST_ID_INVALID');
  requireKeys(message.payload, ['nonce', 'profileKind', 'runId', 'execution', 'targetId', 'scope', 'profileGeneration',
    'hostname', 'observedDeltaMs', 'protectedDeltaMs'], 'PAYLOAD_INVALID');
  const payload = message.payload;
  if (typeof payload.nonce !== 'string' || !UUID.test(payload.nonce) || payload.profileKind !== 'ephemeral'
    || typeof payload.runId !== 'string' || !RUN_ID.test(payload.runId) || payload.execution !== 'owned-headless'
    || payload.targetId !== 'intervention/goal-ends' || payload.scope !== 'goal_delivery_functional') {
    throw goalDeliveryQaError('SEAL_INVALID');
  }
  if (typeof payload.profileGeneration !== 'string' || payload.profileGeneration.length < 1
    || payload.profileGeneration.length > 256 || payload.profileGeneration.trim() !== payload.profileGeneration) {
    throw goalDeliveryQaError('GENERATION_INVALID');
  }
  requireGoalDeliveryQaDelta(payload);
  return Object.freeze({ action: message.action, requestId: message.requestId, payload: Object.freeze({ ...payload }) });
}

export function requireGoalDeliveryQaFixtureResponse(response, message) {
  const request = parseGoalDeliveryQaFixtureRequest(message);
  if (response?.ok !== true || response.action !== request.action || response.requestId !== request.requestId) {
    throw goalDeliveryQaError('RESPONSE_INVALID');
  }
  requireKeys(response, ['ok', 'action', 'requestId', 'receipt'], 'RESPONSE_INVALID');
  const receipt = response.receipt;
  requireKeys(receipt, ['contract', 'synthetic', 'naturalConsumptionObserved', 'runId', 'profileGeneration',
    'hostname', 'observedDeltaMs', 'protectedDeltaMs', 'committedAt', 'calendarDateStr', 'before', 'after'], 'RESPONSE_INVALID');
  if (receipt.contract !== GOAL_DELIVERY_QA_CHARGE_CONTRACT || receipt.synthetic !== true
    || receipt.naturalConsumptionObserved !== false || receipt.runId !== request.payload.runId
    || receipt.profileGeneration !== request.payload.profileGeneration || receipt.hostname !== request.payload.hostname
    || receipt.observedDeltaMs !== request.payload.observedDeltaMs || receipt.protectedDeltaMs !== request.payload.protectedDeltaMs
    || !Number.isSafeInteger(receipt.committedAt) || receipt.committedAt <= 0
    || typeof receipt.calendarDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(receipt.calendarDateStr)) {
    throw goalDeliveryQaError('RESPONSE_INVALID');
  }
  for (const snapshot of [receipt.before, receipt.after]) {
    requireKeys(snapshot, ['observedActiveMs', 'protectedActiveMs', 'globalProtectedActiveMs'], 'RESPONSE_INVALID');
    if (Object.values(snapshot).some(value => !Number.isFinite(value) || value < 0)
      || snapshot.protectedActiveMs > snapshot.observedActiveMs) throw goalDeliveryQaError('RESPONSE_INVALID');
  }
  if (receipt.after.observedActiveMs !== receipt.before.observedActiveMs + receipt.observedDeltaMs
    || receipt.after.protectedActiveMs !== receipt.before.protectedActiveMs + receipt.protectedDeltaMs
    || receipt.after.globalProtectedActiveMs !== receipt.before.globalProtectedActiveMs + receipt.protectedDeltaMs) {
    throw goalDeliveryQaError('RESPONSE_INVALID');
  }
  return response;
}
