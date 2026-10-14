import {
  parseFilterSettingsFeatureChangedKey,
  toFilterSettingsFeatureChangedKey,
} from '../../protection/protocol/features/featureCatalog.js';

export const SETTINGS_PROPAGATION_QA_ACTIONS = Object.freeze({
  ARM: 'QA_SETTINGS_PROPAGATION_ARM',
  READ: 'QA_SETTINGS_PROPAGATION_READ',
  RELEASE: 'QA_SETTINGS_PROPAGATION_RELEASE',
});

export const SETTINGS_PROPAGATION_QA_LEASE_CONTRACT = 'settings_propagation_qa_lease_v1';
export const SETTINGS_PROPAGATION_QA_LEASE_TTL_MS = 45000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RUN_ID_PATTERN = /^\d{17}-[a-z0-9][a-z0-9-]{1,96}-[0-9a-f]{8}$/u;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const LEASE_STATUSES = new Set(['armed', 'holding', 'failing', 'released', 'superseded', 'expired']);

export function isSettingsPropagationQaFilterTaskChangedKeys(keys) {
  if (!Array.isArray(keys) || !keys.includes('filterSettings')
    || new Set(keys).size !== keys.length) return false;
  return keys.every(key => {
    if (key === 'filterSettings') return true;
    const featureKey = parseFilterSettingsFeatureChangedKey(key);
    return featureKey !== null && toFilterSettingsFeatureChangedKey(featureKey) === key;
  });
}

export function settingsPropagationQaError(suffix) {
  const code = `SETTINGS_PROPAGATION_QA_${suffix}`;
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireRecordKeys(value, keys, suffix) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) {
    throw settingsPropagationQaError(suffix);
  }
}

export function requireSettingsPropagationQaSeal({ nonce, profileKind, runId }) {
  if (typeof nonce !== 'string' || !UUID_PATTERN.test(nonce)
    || profileKind !== 'ephemeral'
    || typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
    throw settingsPropagationQaError('SEAL_INVALID');
  }
  return Object.freeze({ nonce, profileKind, runId });
}

export function parseSettingsPropagationQaFixtureRequest(message) {
  requireRecordKeys(message, ['action', 'requestId', 'payload'], 'REQUEST_INVALID');
  if (!Object.values(SETTINGS_PROPAGATION_QA_ACTIONS).includes(message.action)) {
    throw settingsPropagationQaError('ACTION_INVALID');
  }
  if (typeof message.requestId !== 'string' || !REQUEST_ID_PATTERN.test(message.requestId)) {
    throw settingsPropagationQaError('REQUEST_ID_INVALID');
  }
  const arm = message.action === SETTINGS_PROPAGATION_QA_ACTIONS.ARM;
  requireRecordKeys(message.payload, arm
    ? ['nonce', 'profileKind', 'runId', 'mode', 'keys']
    : ['nonce', 'profileKind', 'runId', 'leaseId'], 'PAYLOAD_INVALID');
  const seal = requireSettingsPropagationQaSeal(message.payload);
  if (arm) {
    if (!['hold', 'fail'].includes(message.payload.mode)) {
      throw settingsPropagationQaError('MODE_INVALID');
    }
    if (!Array.isArray(message.payload.keys) || message.payload.keys.length !== 1
      || message.payload.keys[0] !== 'filterSettings') {
      throw settingsPropagationQaError('KEYS_INVALID');
    }
  } else if (typeof message.payload.leaseId !== 'string'
    || !UUID_PATTERN.test(message.payload.leaseId)) {
    throw settingsPropagationQaError('LEASE_ID_INVALID');
  }
  return Object.freeze({
    action: message.action,
    requestId: message.requestId,
    payload: Object.freeze({
      ...seal,
      ...(arm
        ? { mode: message.payload.mode, keys: Object.freeze([...message.payload.keys]) }
        : { leaseId: message.payload.leaseId }),
    }),
  });
}

export function requireSettingsPropagationQaFixtureResponse(response, message) {
  const request = parseSettingsPropagationQaFixtureRequest(message);
  const ok = response?.ok;
  requireRecordKeys(response, ok === true
    ? ['ok', 'action', 'requestId', 'lease']
    : ['ok', 'action', 'requestId', 'error'], 'RESPONSE_INVALID');
  if (typeof ok !== 'boolean' || response.action !== request.action
    || response.requestId !== request.requestId) {
    throw settingsPropagationQaError('RESPONSE_INVALID');
  }
  if (!ok) {
    if (typeof response.error !== 'string' || !/^SETTINGS_PROPAGATION_QA_[A-Z_]{1,64}$/u.test(response.error)) {
      throw settingsPropagationQaError('RESPONSE_INVALID');
    }
    return response;
  }
  const lease = response.lease;
  requireRecordKeys(lease, ['contract', 'leaseId', 'mode', 'status', 'taskId', 'commitVersion',
    'changedKeys', 'attemptCount', 'armedAt', 'expiresAt'], 'RESPONSE_INVALID');
  const unbound = lease.taskId === null;
  if (lease.contract !== SETTINGS_PROPAGATION_QA_LEASE_CONTRACT
    || typeof lease.leaseId !== 'string' || !UUID_PATTERN.test(lease.leaseId)
    || !['hold', 'fail'].includes(lease.mode) || !LEASE_STATUSES.has(lease.status)
    || !(unbound || (Number.isSafeInteger(lease.taskId) && lease.taskId > 0))
    || !(unbound ? lease.commitVersion === null
      : Number.isSafeInteger(lease.commitVersion) && lease.commitVersion >= 0)
    || !Array.isArray(lease.changedKeys)
    || (unbound ? lease.changedKeys.length !== 0
      : !isSettingsPropagationQaFilterTaskChangedKeys(lease.changedKeys))
    || !Number.isSafeInteger(lease.attemptCount) || lease.attemptCount < 0
    || (unbound && lease.attemptCount !== 0)
    || (lease.status === 'armed' && !unbound)
    || (['holding', 'failing'].includes(lease.status) && (unbound || lease.attemptCount === 0))
    || (lease.status === 'holding' && lease.mode !== 'hold')
    || (lease.status === 'failing' && lease.mode !== 'fail')
    || !Number.isSafeInteger(lease.armedAt) || lease.armedAt <= 0
    || lease.expiresAt !== lease.armedAt + SETTINGS_PROPAGATION_QA_LEASE_TTL_MS
    || (request.action !== SETTINGS_PROPAGATION_QA_ACTIONS.ARM
      && lease.leaseId !== request.payload.leaseId)
    || (request.action === SETTINGS_PROPAGATION_QA_ACTIONS.ARM
      && (lease.mode !== request.payload.mode || lease.status !== 'armed'))) {
    throw settingsPropagationQaError('RESPONSE_INVALID');
  }
  return response;
}
