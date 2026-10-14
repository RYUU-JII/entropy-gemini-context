import {
  FLAT_KEY_TO_DOCUMENT,
  STORAGE_LOCAL_DOC_KEYS,
} from '../internal/chrome-storage/storageKeyRegistry.js';

export const SETTINGS_PROFILE_RECOVERY_CONTRACT = 'settings_profile_recovery_v1';
const RECOVERY_KEYS = Object.freeze([
  'contract', 'kind', 'failureCode', 'recoveryAction', 'documentKey', 'key',
]);
const RESETTABLE_DOCUMENTS = Object.freeze([
  STORAGE_LOCAL_DOC_KEYS.CORE, STORAGE_LOCAL_DOC_KEYS.RULES, STORAGE_LOCAL_DOC_KEYS.UI,
]);
const FAILURE_CODES = Object.freeze([
  'SETTINGS_STORED_VALUE_INVALID',
  'SETTINGS_DOCUMENT_KEY_INVALID',
  'SETTINGS_DOCUMENT_CONTRACT_INVALID',
]);
const ownedRecoveries = new WeakMap();

export function normalizeSettingsProfileRecovery(value) {
  const plainObject = value && typeof value === 'object'
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const keys = plainObject
    ? Object.keys(value).sort()
    : [];
  const expectedKeys = [...RECOVERY_KEYS].sort();
  const validKey = value?.failureCode === 'SETTINGS_DOCUMENT_CONTRACT_INVALID'
    ? value.key === null
    : typeof value?.key === 'string';
  const validOwner = value?.failureCode === 'SETTINGS_STORED_VALUE_INVALID'
    ? FLAT_KEY_TO_DOCUMENT[value.key] === value.documentKey
    : value?.failureCode !== 'SETTINGS_DOCUMENT_KEY_INVALID'
      || FLAT_KEY_TO_DOCUMENT[value.key] !== value.documentKey;
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
    || value.contract !== SETTINGS_PROFILE_RECOVERY_CONTRACT
    || value.kind !== 'settings_contract_reset'
    || value.recoveryAction !== 'full_reset'
    || !FAILURE_CODES.includes(value.failureCode)
    || !RESETTABLE_DOCUMENTS.includes(value.documentKey)
    || !validKey
    || !validOwner
  ) {
    throw new Error('SETTINGS_PROFILE_RECOVERY_CONTRACT_INVALID');
  }
  return Object.freeze(Object.fromEntries(RECOVERY_KEYS.map((key) => [key, value[key]])));
}

// Only physical settings validation calls this seam. Security corruption is
// deliberately excluded: reset must still read and enforce its security policy.
export function markSettingsStoredContractFailure(error) {
  if (
    !(error instanceof Error)
    || !FAILURE_CODES.includes(error.code)
    || !RESETTABLE_DOCUMENTS.includes(error.documentKey)
  ) return error;
  const recovery = normalizeSettingsProfileRecovery({
    contract: SETTINGS_PROFILE_RECOVERY_CONTRACT,
    kind: 'settings_contract_reset',
    failureCode: error.code,
    recoveryAction: 'full_reset',
    documentKey: error.documentKey,
    key: error.code === 'SETTINGS_DOCUMENT_CONTRACT_INVALID' ? null : error.key,
  });
  ownedRecoveries.set(error, recovery);
  return error;
}

// The trusted readiness response crosses realms, so its consumer validates the
// exact descriptor and outer code before recreating the owned Error receipt.
export function createSettingsProfileRecoveryResponseError(code, descriptor, details = {}) {
  const recovery = normalizeSettingsProfileRecovery(descriptor);
  if (code !== recovery.failureCode) {
    throw new Error('SETTINGS_PROFILE_RECOVERY_RESPONSE_MISMATCH');
  }
  const error = new Error(code);
  Object.assign(error, details, { code, settingsProfileRecovery: recovery });
  ownedRecoveries.set(error, recovery);
  return error;
}

export function resolveSettingsProfileRecovery(error) {
  if (!error || typeof error !== 'object') return null;
  const recovery = ownedRecoveries.get(error);
  if (!recovery) return null;
  if (error.code !== recovery.failureCode) {
    throw new Error('SETTINGS_PROFILE_RECOVERY_ERROR_MISMATCH');
  }
  return recovery;
}
