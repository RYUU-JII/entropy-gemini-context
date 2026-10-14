import {
  SETTINGS_COMMAND_CHANNELS,
  SETTINGS_COMMAND_KINDS,
  SETTINGS_KEY_COMMAND_CONTRACTS,
} from './settingsCommandContract.js';

const SETTINGS_DASHBOARD_RETRY = Object.freeze({
  baseDelayMs: 250,
  maxDelayMs: 4000,
  maxRetries: 3,
  transportRetryCount: 0,
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function freezeList(values = []) {
  return Object.freeze(Array.from(new Set(values)));
}

export const SETTINGS_COMMAND_CHANNEL_CONTRACTS = Object.freeze(Object.fromEntries(
  Object.values(SETTINGS_COMMAND_CHANNELS).map((channel) => {
    const canonicalKeys = Object.entries(SETTINGS_KEY_COMMAND_CONTRACTS)
      .filter(([, contract]) => contract.channel === channel)
      .map(([key]) => key);
    const patchKeys = canonicalKeys.filter((key) => (
      SETTINGS_KEY_COMMAND_CONTRACTS[key].mutationOwner == null
    ));
    return [channel, Object.freeze({
      channel,
      kind: SETTINGS_COMMAND_KINDS.DASHBOARD_PATCH,
      canonicalKeys: freezeList(canonicalKeys),
      patchKeys: freezeList(patchKeys),
      retry: SETTINGS_DASHBOARD_RETRY,
      acknowledgement: Object.freeze({
        committedItemsField: 'committedItems',
        requireAllPendingKeys: true,
        requireAllSubmittedKeys: true,
      }),
      profileGeneration: 'dashboard_exact_generation',
    })];
  }),
));

export function requireSettingsCommandChannelContract(channel) {
  const normalizedChannel = typeof channel === 'string' ? channel.trim() : '';
  const contract = SETTINGS_COMMAND_CHANNEL_CONTRACTS[normalizedChannel];
  if (!contract) {
    throw new Error(`SETTINGS_COMMAND_CHANNEL_UNKNOWN:${normalizedChannel || String(channel)}`);
  }
  return contract;
}

function createForbiddenChannelKeysError(contract, forbiddenKeys) {
  const error = new Error('SETTINGS_COMMAND_CHANNEL_KEYS_FORBIDDEN');
  error.code = 'SETTINGS_COMMAND_CHANNEL_KEYS_FORBIDDEN';
  error.channel = contract.channel;
  error.forbiddenKeys = forbiddenKeys;
  return error;
}

export function assertSettingsCommandChannelPatch(channel, patch = {}) {
  const contract = requireSettingsCommandChannelContract(channel);
  const source = isPlainObject(patch) ? patch : {};
  const allowedKeys = new Set(contract.patchKeys);
  const forbiddenKeys = Object.keys(source).filter((key) => !allowedKeys.has(key));
  if (forbiddenKeys.length > 0) {
    throw createForbiddenChannelKeysError(contract, forbiddenKeys);
  }
  return source;
}

export function assertSettingsCommandChannelKeys(channel, keys = []) {
  const contract = requireSettingsCommandChannelContract(channel);
  const canonicalKeys = new Set(contract.canonicalKeys);
  const forbiddenKeys = Array.isArray(keys)
    ? keys.filter((key) => !canonicalKeys.has(key))
    : [];
  if (forbiddenKeys.length > 0) {
    throw createForbiddenChannelKeysError(contract, forbiddenKeys);
  }
  return keys;
}

export function mergeSettingsCommandPatches(previous = {}, next = {}) {
  const result = { ...previous };
  Object.entries(next).forEach(([key, value]) => {
    const mergePending = SETTINGS_KEY_COMMAND_CONTRACTS[key]?.mergePending;
    result[key] = typeof mergePending === 'function'
      ? mergePending(Object.hasOwn(previous, key) ? previous[key] : {}, value)
      : value;
  });
  return result;
}

export { SETTINGS_COMMAND_CHANNELS };
