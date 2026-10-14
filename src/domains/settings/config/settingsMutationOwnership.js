import {
  collectSettingsOwnerMutationKeys as collectRegisteredOwnerMutationKeys,
  collectSettingsKeysByContract,
} from './settingsCommandContract.js';

export const SETTINGS_OWNER_MUTATION_KEYS = Object.freeze(
  collectSettingsKeysByContract((contract) => (
    typeof contract.mutationOwner === 'string'
  )),
);

export function collectSettingsOwnerMutationKeys(items = {}) {
  return collectRegisteredOwnerMutationKeys(items);
}

export function assertGenericSettingsMutationAllowed(items = {}) {
  const ownerKeys = collectSettingsOwnerMutationKeys(items);
  if (ownerKeys.length === 0) return;
  const error = new Error('SETTINGS_OWNER_COMMAND_REQUIRED');
  error.code = 'SETTINGS_OWNER_COMMAND_REQUIRED';
  error.ownerKeys = ownerKeys;
  throw error;
}
