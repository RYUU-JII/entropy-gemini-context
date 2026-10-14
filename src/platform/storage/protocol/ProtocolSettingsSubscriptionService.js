import {
  addChromeStorageChangedListener,
  removeChromeStorageChangedListener,
} from '../internal/chrome-storage/storageChangeBus.js';
import {
  FLAT_KEY_TO_DOCUMENT,
  STORAGE_LOCAL_DOC_KEYS,
} from '../internal/chrome-storage/storageKeyRegistry.js';
import { areValuesEqual, isPlainObject } from '../internal/storageValueUtils.js';

const PROTOCOL_DOCUMENT_KEYS = new Set([
  STORAGE_LOCAL_DOC_KEYS.CORE,
  STORAGE_LOCAL_DOC_KEYS.RULES,
]);

const PROTOCOL_FLAT_SETTING_KEYS = new Set(
  Object.entries(FLAT_KEY_TO_DOCUMENT)
    .filter(([, documentKey]) => PROTOCOL_DOCUMENT_KEYS.has(documentKey))
    .map(([flatKey]) => flatKey),
);

function hasOwnProperty(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isProtocolSettingsStorageChange(changes = {}, areaName = '') {
  if (areaName !== 'local' || !changes || typeof changes !== 'object') return false;

  for (const documentKey of PROTOCOL_DOCUMENT_KEYS) {
    if (hasOwnProperty(changes, documentKey)) return true;
  }

  return Object.keys(changes).some((key) => PROTOCOL_FLAT_SETTING_KEYS.has(key));
}

export function resolveProtocolSettingsChangedKeys(changes = {}, areaName = '') {
  if (!isProtocolSettingsStorageChange(changes, areaName)) return [];
  const changedKeys = new Set();
  for (const [key, change] of Object.entries(changes)) {
    if (PROTOCOL_DOCUMENT_KEYS.has(key)) {
      for (const value of [change?.oldValue, change?.newValue]) {
        if (value !== undefined && !isPlainObject(value)) {
          throw new Error('PROTOCOL_SETTINGS_CHANGE_DOCUMENT_INVALID');
        }
      }
      const previous = change.oldValue === undefined ? {} : change.oldValue;
      const next = change.newValue === undefined ? {} : change.newValue;
      for (const flatKey of new Set([...Object.keys(previous), ...Object.keys(next)])) {
        if (FLAT_KEY_TO_DOCUMENT[flatKey] === key && !areValuesEqual(previous[flatKey], next[flatKey])) {
          changedKeys.add(flatKey);
        }
      }
    } else if (PROTOCOL_FLAT_SETTING_KEYS.has(key) && !areValuesEqual(change?.oldValue, change?.newValue)) {
      changedKeys.add(key);
    }
  }
  return [...changedKeys];
}

export function subscribeProtocolSettingsChanges(listener) {
  if (typeof listener !== 'function') return () => {};

  const handleStorageChange = (changes = {}, areaName = '') => {
    const changedKeys = resolveProtocolSettingsChangedKeys(changes, areaName);
    if (!changedKeys.length) return;
    listener({ changes, areaName, changedKeys });
  };

  const subscribed = addChromeStorageChangedListener(handleStorageChange);
  if (!subscribed) return () => {};

  return () => {
    removeChromeStorageChangedListener(handleStorageChange);
  };
}

export default subscribeProtocolSettingsChanges;
