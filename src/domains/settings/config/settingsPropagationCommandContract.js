import { collectSettingsKeysByContract } from './settingsCommandContract.js';
import { FULL_SETTINGS_RECONCILE_CHANGED_KEYS } from './settingsUpdateKeys.js';
import { isFilterSettingsFeatureChangedKey } from '../../protection/protocol/features/featureCatalog.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/contracts/messageTypes.js';

export const SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS = 15_000;
export const SETTINGS_PROPAGATION_DELIVERY_TIMEOUT_MS = 20_000;
const propagationKeys = new Set(FULL_SETTINGS_RECONCILE_CHANGED_KEYS);
const retryKeys = new Set(collectSettingsKeysByContract((contract, key) => (
  typeof contract.channel === 'string' && propagationKeys.has(key)
)));
const waitKeys = new Set(collectSettingsKeysByContract(() => true));
const WAIT_REQUEST_FIELDS = Object.freeze([
  'action', 'taskId', 'ownerEpoch', 'commitVersion', 'keys', 'expectedProfileGeneration',
]);
const PROPAGATION_APPLIED_FIELDS = Object.freeze([
  'refreshed', 'autoPurged', 'syncedBlockedBookmarks', 'runtimeAdapters', 'syncScripts', 'broadcast',
]);

function isCanonicalString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isWaitKeyList(value) {
  return isKeyList(value) && value.every((key) => waitKeys.has(key) || isFilterSettingsFeatureChangedKey(key));
}

function isWaitIdentity(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Number.isInteger(value.taskId) && value.taskId > 0
    && isCanonicalString(value.ownerEpoch)
    && Number.isInteger(value.commitVersion) && value.commitVersion >= 0
    && isWaitKeyList(keys);
}

function isKeyList(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((key) => typeof key === 'string' && key.length > 0 && key.trim() === key)
    && new Set(value).size === value.length;
}

export function collectSettingsPropagationRetryKeys(keys) {
  if (!Array.isArray(keys)) throw new Error('SETTINGS_PROPAGATION_KEYS_REQUIRED');
  return [...new Set(keys.filter((key) => retryKeys.has(key)))];
}

export function requireSettingsPropagationRetryKeys(value) {
  if (!Array.isArray(value) || value.length === 0
    || value.some((key) => typeof key !== 'string' || !retryKeys.has(key))) {
    throw new Error('SETTINGS_PROPAGATION_RETRY_KEYS_INVALID');
  }
  return [...new Set(value)];
}

export function requireSettingsPropagationRetryResult(value) {
  const propagation = value?.propagation;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.success !== 'boolean'
    || !Number.isInteger(value.version) || value.version < 0
    || !isKeyList(value.changedKeys)
    || !propagation || typeof propagation !== 'object' || Array.isArray(propagation)
    || !['succeeded', 'failed', 'timed_out', 'schedule_failed'].includes(propagation.status)
    || value.success !== (propagation.status === 'succeeded')
    || !isKeyList(propagation.changedKeys) || !Array.isArray(propagation.failures)
    || !Number.isInteger(propagation.commitVersion) || propagation.commitVersion < value.version
    || value.changedKeys.some((key) => !propagation.changedKeys.includes(key))
    || (propagation.status === 'schedule_failed'
      ? propagation.taskId !== null
      : !Number.isInteger(propagation.taskId) || propagation.taskId <= 0)
    || (propagation.status === 'succeeded' && propagation.failures.length !== 0)
    || propagation.failures.some((failure) => !failure || typeof failure !== 'object' || Array.isArray(failure))) {
    throw new Error('SETTINGS_PROPAGATION_RETRY_ACK_INVALID');
  }
  return value;
}

export function requireSettingsPropagationWaitReceipt(value) {
  if (!isWaitIdentity(value, value?.changedKeys)
    || !['scheduled', 'timed_out'].includes(value.status)) {
    throw new Error('SETTINGS_PROPAGATION_WAIT_RECEIPT_INVALID');
  }
  return value;
}

export function requireSettingsPropagationWaitRequest(value) {
  if (!isWaitIdentity(value, value?.keys)
    || value.action !== MESSAGE_ACTIONS.WAIT_SETTINGS_PROPAGATION
    || !isCanonicalString(value.expectedProfileGeneration)
    || Object.keys(value).length !== WAIT_REQUEST_FIELDS.length
    || Object.keys(value).some((key) => !WAIT_REQUEST_FIELDS.includes(key))) {
    throw new Error('SETTINGS_PROPAGATION_WAIT_REQUEST_INVALID');
  }
  return value;
}

export function requireSettingsPropagationWaitResult(value, requested) {
  const keys = requested && Object.hasOwn(requested, 'keys') ? requested.keys : requested?.changedKeys;
  if (!isWaitIdentity(requested, keys) || !isWaitIdentity(value, value?.changedKeys)
    || !['succeeded', 'failed', 'timed_out'].includes(value.status)
    || value.ownerEpoch !== requested.ownerEpoch
    || value.taskId < requested.taskId || value.commitVersion < requested.commitVersion
    || keys.some((key) => !value.changedKeys.includes(key))
    || !value.applied || typeof value.applied !== 'object' || Array.isArray(value.applied)
    || PROPAGATION_APPLIED_FIELDS.some((key) => typeof value.applied[key] !== 'boolean')
    || !Array.isArray(value.failures)
    || value.failures.some((failure) => !failure || typeof failure !== 'object' || Array.isArray(failure))
    || (value.status === 'failed' ? value.failures.length === 0 : value.failures.length !== 0)) {
    throw new Error('SETTINGS_PROPAGATION_WAIT_ACK_INVALID');
  }
  return value;
}
