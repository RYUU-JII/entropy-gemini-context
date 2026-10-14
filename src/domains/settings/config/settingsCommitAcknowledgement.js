import {
  SETTINGS_COMMAND_KINDS,
  requireSettingsRuntimeCommandContract,
} from './settingsCommandContract.js';

export const SETTINGS_COMMIT_ACK_ERROR_CODE = 'SETTINGS_COMMIT_ACK_INVALID';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKeys(keys = []) {
  if (!Array.isArray(keys)) return [];
  return Array.from(new Set(
    keys
      .filter((key) => typeof key === 'string')
      .map((key) => key.trim())
      .filter(Boolean),
  ));
}

function createSettingsCommitAckError(errorCode, missingKeys = [], extra = {}) {
  const normalizedCode = typeof errorCode === 'string' && errorCode.trim()
    ? errorCode.trim()
    : SETTINGS_COMMIT_ACK_ERROR_CODE;
  const error = new Error(normalizedCode);
  error.code = normalizedCode;
  error.missingKeys = normalizeKeys(missingKeys);
  Object.assign(error, extra);
  return error;
}

export function createSettingsCommittedItems(items = {}) {
  if (!isPlainObject(items)) {
    throw createSettingsCommitAckError(SETTINGS_COMMIT_ACK_ERROR_CODE);
  }
  return { ...items };
}

export function buildSettingsOwnerCommandResponse(action, result = {}) {
  const contract = requireSettingsRuntimeCommandContract(action);
  if (contract.kind !== SETTINGS_COMMAND_KINDS.OWNER_COMMAND) {
    throw createSettingsCommitAckError(SETTINGS_COMMAND_ACK_ERROR_CODE, [], {
      action,
      field: 'action',
    });
  }
  const response = {
    success: true,
    items: createSettingsCommittedItems(result?.items),
    changedKeys: result?.changedKeys,
    version: result?.version,
    applied: {
      refreshed: result?.applied?.refreshed,
      syncScripts: result?.applied?.syncScripts,
      broadcast: result?.applied?.broadcast,
    },
  };
  contract.resultFields.forEach((field) => {
    response[field.name] = result?.[field.name];
  });
  if (isPlainObject(result?.propagation)) {
    response.propagation = { ...result.propagation };
  }
  return response;
}

export function requireSettingsCommitAcknowledgement(
  acknowledgedItems,
  pendingKeys = [],
  { errorCode = SETTINGS_COMMIT_ACK_ERROR_CODE } = {},
) {
  const requiredKeys = normalizeKeys(pendingKeys);
  if (!isPlainObject(acknowledgedItems)) {
    throw createSettingsCommitAckError(errorCode, requiredKeys);
  }

  const acknowledgedPatch = { ...acknowledgedItems };
  const missingKeys = requiredKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(acknowledgedPatch, key),
  );
  if (missingKeys.length > 0) {
    throw createSettingsCommitAckError(errorCode, missingKeys);
  }
  return acknowledgedPatch;
}

export function completeSettingsOwnerAcknowledgement({
  committedItems,
  requiredCommittedKeys = [],
  settingsSnapshot,
  acknowledgementKeys = [],
  errorCode = SETTINGS_COMMIT_ACK_ERROR_CODE,
} = {}) {
  const committedPatch = requireSettingsCommitAcknowledgement(
    committedItems,
    requiredCommittedKeys,
    { errorCode },
  );
  const requiredKeys = normalizeKeys(acknowledgementKeys);
  const snapshotKeys = requiredKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(committedPatch, key),
  );
  const missingSnapshotKeys = !isPlainObject(settingsSnapshot)
    ? snapshotKeys
    : snapshotKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(settingsSnapshot, key),
    );
  if (missingSnapshotKeys.length > 0) {
    throw createSettingsCommitAckError(errorCode, missingSnapshotKeys);
  }

  snapshotKeys.forEach((key) => {
    committedPatch[key] = settingsSnapshot[key];
  });
  return requireSettingsCommitAcknowledgement(committedPatch, requiredKeys, { errorCode });
}

export default requireSettingsCommitAcknowledgement;
