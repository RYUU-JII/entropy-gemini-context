import { projectCanonicalStoredSetting } from '../../../domains/settings/config/settingsCommandContract.js';
import { areValuesEqual } from '../internal/storageValueUtils.js';
import { markSettingsStoredContractFailure } from './SettingsProfileRecoveryContract.js';
import {
  SETTINGS_DOCUMENT_KEYS,
  flattenSettingsDocuments,
  requireSettingsDocument,
  resolveSettingsDocumentKey,
} from '../internal/chrome-storage/storageKeyRegistry.js';

// Value validation belongs to physical settings IO, not the boot-safe key registry.
// The projection is compared verbatim; it is never written back as a repair.
export function requireSettingsStoredValue(key, storedValue, documentKey = resolveSettingsDocumentKey(key)) {
  try {
    const canonical = projectCanonicalStoredSetting(key, storedValue);
    if (!areValuesEqual(canonical, storedValue)) throw new Error('SETTINGS_STORED_VALUE_NON_CANONICAL');
  } catch (cause) {
    const error = new Error('SETTINGS_STORED_VALUE_INVALID:' + key, { cause });
    error.code = 'SETTINGS_STORED_VALUE_INVALID';
    error.documentKey = documentKey;
    error.key = key;
    throw markSettingsStoredContractFailure(error);
  }
  return storedValue;
}

export function requireSettingsStoredDocument(documentKey, value) {
  try {
    requireSettingsDocument(documentKey, value);
  } catch (error) {
    error.code = Object.hasOwn(error, 'key') ? 'SETTINGS_DOCUMENT_KEY_INVALID' : 'SETTINGS_DOCUMENT_CONTRACT_INVALID';
    throw markSettingsStoredContractFailure(error);
  }
  for (const [key, storedValue] of Object.entries(value)) {
    requireSettingsStoredValue(key, storedValue, documentKey);
  }
  return value;
}

export function flattenStoredSettingsDocuments(documents) {
  for (const documentKey of SETTINGS_DOCUMENT_KEYS) {
    if (Object.hasOwn(documents, documentKey)) requireSettingsStoredDocument(documentKey, documents[documentKey]);
  }
  return flattenSettingsDocuments(documents);
}
