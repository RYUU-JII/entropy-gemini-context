import {
  isPrivilegedSettingsFlowSender,
  isTrustedExtensionTabSender,
} from '../../../../platform/security/senderTrust.js';
import { collectSettingsOwnerMutationKeys } from '../../../settings/config/settingsMutationOwnership.js';
import {
  collectSettingsKeysByContract,
  SETTINGS_SECURITY_KEYS,
} from '../../../settings/config/settingsCommandContract.js';

export const MASTER_PASSCODE_KEY = SETTINGS_SECURITY_KEYS.MASTER_PASSCODE;
export const RESET_GUARD_KEY = SETTINGS_SECURITY_KEYS.RESET_GUARD;
export const HIGH_SECURITY_MODE_KEY = SETTINGS_SECURITY_KEYS.HIGH_SECURITY_MODE;

const SENSITIVE_SETTINGS_KEYS = new Set(
  collectSettingsKeysByContract((contract) => contract.sensitiveRead),
);
const SENSITIVE_SETTINGS_WRITE_ACK_KEYS = new Set(
  collectSettingsKeysByContract((contract) => contract.privilegedWriteAcknowledgement),
);
const CONTENT_SCRIPT_ALLOWED_SETTINGS_WRITE_KEYS = new Set(
  collectSettingsKeysByContract((contract) => contract.contentWrite),
);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRequestedSettingKeys(keys) {
  if (!Array.isArray(keys)) return [];
  const unique = new Set();
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const trimmed = key.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

function buildSettingsReadPayload(request = {}) {
  const hasDefaults = Object.prototype.hasOwnProperty.call(request || {}, 'defaults');
  const defaults = hasDefaults ? request.defaults : {};
  const requestedKeys = normalizeRequestedSettingKeys(request?.keys);

  if (defaults === null) {
    if (requestedKeys.length > 0) {
      const payload = {};
      requestedKeys.forEach((key) => {
        payload[key] = undefined;
      });
      return { payload, requestedKeys, defaults: null };
    }
    return { payload: null, requestedKeys: [], defaults: null };
  }

  const resolvedDefaults = isPlainObject(defaults) ? defaults : {};
  const keys = requestedKeys.length > 0
    ? requestedKeys
    : Object.keys(resolvedDefaults);
  const payload = {};

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(resolvedDefaults, key)) {
      payload[key] = resolvedDefaults[key];
    } else {
      payload[key] = undefined;
    }
  });

  return {
    payload,
    requestedKeys: keys,
    defaults: resolvedDefaults,
  };
}

function redactSensitiveSettingsPayload(payload = {}, { writeAcknowledgement = false } = {}) {
  if (!isPlainObject(payload)) {
    return {
      safePayload: {},
      redactedDefaults: {},
      redactedKeys: [],
    };
  }

  const safePayload = {};
  const redactedDefaults = {};
  const redactedKeys = [];
  Object.entries(payload).forEach(([key, value]) => {
    const mayAcknowledgeSubmittedSecurityValue = writeAcknowledgement === true
      && SENSITIVE_SETTINGS_WRITE_ACK_KEYS.has(key);
    if (SENSITIVE_SETTINGS_KEYS.has(key) && !mayAcknowledgeSubmittedSecurityValue) {
      redactedDefaults[key] = value;
      redactedKeys.push(key);
      return;
    }
    safePayload[key] = value;
  });

  return { safePayload, redactedDefaults, redactedKeys };
}

function redactSensitiveSettingsMap(settings = {}) {
  if (!isPlainObject(settings)) return {};
  const next = { ...settings };
  SENSITIVE_SETTINGS_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      delete next[key];
    }
  });
  return next;
}

function authorizeSettingsWriteSender({ sender, items }) {
  if (isPrivilegedSettingsFlowSender(sender)) {
    const ownerKeys = collectSettingsOwnerMutationKeys(items);
    if (ownerKeys.length > 0) {
      return {
        authorized: false,
        error: 'SETTINGS_OWNER_COMMAND_REQUIRED',
        forbiddenKeys: ownerKeys,
      };
    }
    return { authorized: true, error: null, forbiddenKeys: [] };
  }
  if (!isTrustedExtensionTabSender(sender)) {
    return { authorized: false, error: 'SETTINGS_WRITE_FORBIDDEN', forbiddenKeys: [] };
  }

  const keys = isPlainObject(items) ? Object.keys(items) : [];
  const forbiddenKeys = keys.filter((key) => !CONTENT_SCRIPT_ALLOWED_SETTINGS_WRITE_KEYS.has(key));
  if (forbiddenKeys.length > 0) {
    return { authorized: false, error: 'SETTINGS_WRITE_FORBIDDEN', forbiddenKeys };
  }
  return { authorized: true, error: null, forbiddenKeys: [] };
}

export function createSettingsAccessPolicy() {
  return {
    authorizeSettingsWriteSender,
    buildSettingsReadPayload,
    redactSensitiveSettingsMap,
    redactSensitiveSettingsPayload,
  };
}
