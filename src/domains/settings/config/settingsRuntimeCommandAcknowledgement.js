import {
  SETTINGS_ACK_FIELD_TYPES,
  SETTINGS_COMMAND_ACK_ERROR_CODE,
  SETTINGS_COMMAND_KINDS,
  requireSettingsRuntimeCommandContract,
} from './settingsCommandContract.js';
import { normalizeChangedKeys } from './settingsUpdateKeys.js';
import { parseBootstrapHostChangedKey } from './bootstrapSnapshotInvalidation.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createInvalidAcknowledgementError(action, field) {
  const error = new Error(SETTINGS_COMMAND_ACK_ERROR_CODE);
  error.code = SETTINGS_COMMAND_ACK_ERROR_CODE;
  error.action = action;
  error.field = field;
  error.missingKeys = [];
  return error;
}

function requireRuntimeAckField(response, field, action) {
  const value = response?.[field.name];
  if (value === undefined && field.optional === true) return undefined;
  if (field.type === SETTINGS_ACK_FIELD_TYPES.STRING) {
    if (typeof value === 'string' && value && value.trim() === value) return value;
  } else if (field.type === SETTINGS_ACK_FIELD_TYPES.ENUM) {
    if (typeof value === 'string' && field.values.includes(value)) return value;
  } else if (field.type === SETTINGS_ACK_FIELD_TYPES.NULLABLE_POSITIVE_INTEGER) {
    if (value === null || (Number.isInteger(value) && value > 0)) return value;
  } else if (field.type === SETTINGS_ACK_FIELD_TYPES.BOOLEAN) {
    if (typeof value === 'boolean') return value;
  } else if (field.type === SETTINGS_ACK_FIELD_TYPES.MATCHING_OBJECT) {
    if (isPlainObject(value) && value[field.objectField] === response?.[field.referenceField]) {
      return { ...value };
    }
  } else if (field.type === SETTINGS_ACK_FIELD_TYPES.SAME_AS_FIELD) {
    if (typeof value === 'string' && value && value.trim() === value
      && value === response?.[field.referenceField]) {
      return value;
    }
  }
  throw createInvalidAcknowledgementError(action, field.name);
}

function requireAppliedState(applied, { strict, action }) {
  if (isPlainObject(applied)
    && typeof applied.refreshed === 'boolean'
    && typeof applied.syncScripts === 'boolean'
    && typeof applied.broadcast === 'boolean') {
    return {
      refreshed: applied.refreshed,
      syncScripts: applied.syncScripts,
      broadcast: applied.broadcast,
    };
  }
  if (strict) throw createInvalidAcknowledgementError(action, 'applied');
  return { refreshed: false, syncScripts: false, broadcast: false };
}

export function requireSettingsRuntimeCommandAcknowledgement(action, response) {
  const contract = requireSettingsRuntimeCommandContract(action);
  const strict = contract.kind === SETTINGS_COMMAND_KINDS.OWNER_COMMAND;
  if (!isPlainObject(response) || response.success !== true) {
    throw createInvalidAcknowledgementError(action, 'success');
  }

  const committedItemsField = contract.acknowledgement.committedItemsField;
  if (!isPlainObject(response[committedItemsField])) {
    throw createInvalidAcknowledgementError(action, committedItemsField);
  }
  const committedItems = { ...response[committedItemsField] };
  const changedKeys = normalizeChangedKeys(response.changedKeys);
  if (strict && (!Array.isArray(response.changedKeys)
    || changedKeys.length !== response.changedKeys.length
    || changedKeys.some((key, index) => key !== response.changedKeys[index]))) {
    throw createInvalidAcknowledgementError(action, 'changedKeys');
  }
  if (contract.acknowledgement.requireChangedKeyItemCoverage) {
    for (const key of changedKeys) {
      let hostChange;
      try {
        hostChange = parseBootstrapHostChangedKey(key);
      } catch {
        throw createInvalidAcknowledgementError(action, committedItemsField);
      }
      // Host invalidation metadata describes a committed setting; it is not a
      // persisted item. Its physical setting must still be changed and acknowledged.
      const itemKey = hostChange ? hostChange.settingKey : key;
      if (!changedKeys.includes(itemKey) || !Object.prototype.hasOwnProperty.call(committedItems, itemKey)) {
        throw createInvalidAcknowledgementError(action, committedItemsField);
      }
    }
  }

  let version = null;
  if (strict) {
    if (response.version !== null && (!Number.isInteger(response.version) || response.version < 0)) {
      throw createInvalidAcknowledgementError(action, 'version');
    }
    version = response.version;
  } else if (Number.isFinite(Number(response.version))) {
    version = Math.max(0, Math.floor(Number(response.version)));
  }

  const result = {
    [committedItemsField]: committedItems,
    changedKeys,
    version,
    applied: requireAppliedState(response.applied, { strict, action }),
  };
  if (Object.prototype.hasOwnProperty.call(response, 'propagation')) {
    if (response.propagation === null && !strict) {
      result.propagation = null;
    } else if (isPlainObject(response.propagation)) {
      result.propagation = { ...response.propagation };
    } else if (strict) {
      throw createInvalidAcknowledgementError(action, 'propagation');
    }
  }
  contract.resultFields.forEach((field) => {
    result[field.name] = requireRuntimeAckField(response, field, action);
  });
  return result;
}

export function requireSettingsOwnerCommandAcknowledgement(action, response) {
  const contract = requireSettingsRuntimeCommandContract(action);
  if (contract.kind !== SETTINGS_COMMAND_KINDS.OWNER_COMMAND) {
    throw createInvalidAcknowledgementError(action, 'action');
  }
  return requireSettingsRuntimeCommandAcknowledgement(action, response);
}

export function buildSettingsOwnerNoopAcknowledgement(action, resultFields = {}) {
  return requireSettingsOwnerCommandAcknowledgement(action, {
    success: true,
    ...resultFields,
    items: {},
    changedKeys: [],
    version: null,
    applied: { refreshed: false, syncScripts: false, broadcast: false },
  });
}
