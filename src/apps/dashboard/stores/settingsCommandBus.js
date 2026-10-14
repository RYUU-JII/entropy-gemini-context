import { create } from 'zustand';
import { beginSettingsFlowTiming, endSettingsFlowTiming } from '../../../platform/diagnostics/settingsFlowTiming.js';
import { requireSettingsCommitAcknowledgement } from '../../../domains/settings/config/settingsCommitAcknowledgement.js';
import { collectSettingsPropagationRetryKeys } from '../../../domains/settings/config/settingsPropagationCommandContract.js';
import {
  assertSettingsCommandChannelKeys,
  assertSettingsCommandChannelPatch,
  mergeSettingsCommandPatches,
  requireSettingsCommandChannelContract,
  SETTINGS_COMMAND_CHANNEL_CONTRACTS,
  SETTINGS_COMMAND_CHANNELS,
} from '../../../domains/settings/config/settingsDashboardCommandContract.js';
import { applyDashboardSettingsPatch, isTransientSettingsApplyError } from './settingsClient.js';
import {
  retrySettingsPropagationViaRuntime,
  waitForSettingsPropagationViaRuntime,
} from '../../../platform/storage/settings/SettingsPropagationCommandService.js';
import {
  buildSettingsSyncAggregateState,
  buildSettingsSyncCommittedState,
  buildSettingsSyncSuccessState,
  SETTINGS_SYNC_STATUS,
  buildSettingsSyncErrorState,
  buildSettingsSyncRetryState,
  buildSettingsSyncSavingState,
  buildSettingsPropagationObservationErrorState,
  createSettingsSyncState,
} from './settingsSyncState.js';

const SETTINGS_QUEUE_CONTRACT = requireSettingsCommandChannelContract(
  SETTINGS_COMMAND_CHANNELS.PROTOCOL,
);
const SETTINGS_QUEUE_RETRY_BASE_DELAY_MS = SETTINGS_QUEUE_CONTRACT.retry.baseDelayMs;
const SETTINGS_QUEUE_RETRY_MAX_DELAY_MS = SETTINGS_QUEUE_CONTRACT.retry.maxDelayMs;
const SETTINGS_QUEUE_MAX_RETRIES = SETTINGS_QUEUE_CONTRACT.retry.maxRetries;
const SETTINGS_QUEUE_TRANSPORT_RETRY_COUNT = SETTINGS_QUEUE_CONTRACT.retry.transportRetryCount;
const SETTINGS_COMMAND_BUS_TEST_PROFILE_GENERATION = 'profile_epoch:settings-command-bus-test:v1';

const SETTINGS_COMMAND_BUS_PHASE = Object.freeze({
  UNBOUND: 'unbound',
  OPEN: 'open',
  QUIESCED: 'quiesced',
});

export { SETTINGS_COMMAND_CHANNELS };

const KNOWN_CHANNELS = Object.freeze(Object.keys(SETTINGS_COMMAND_CHANNEL_CONTRACTS));

function createChannelSyncStateMap() {
  return KNOWN_CHANNELS.reduce((accumulator, channel) => {
    accumulator[channel] = createSettingsSyncState();
    return accumulator;
  }, {});
}

function normalizeChannel(channel) {
  if (typeof channel !== 'string' || !channel.trim()) {
    return SETTINGS_COMMAND_CHANNELS.PROTOCOL;
  }
  const normalizedChannel = channel.trim();
  return requireSettingsCommandChannelContract(normalizedChannel).channel;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireChannelSyncMap(channelSync) {
  if (!isPlainObject(channelSync)) {
    const error = new Error('SETTINGS_COMMAND_BUS_CHANNEL_SYNC_MAP_INVALID');
    error.code = 'SETTINGS_COMMAND_BUS_CHANNEL_SYNC_MAP_INVALID';
    throw error;
  }
  return channelSync;
}

function requireChannelSyncState(channelSync, channel) {
  const syncMap = requireChannelSyncMap(channelSync);
  const syncState = syncMap[channel];
  if (!isPlainObject(syncState)) {
    const error = new Error('SETTINGS_COMMAND_BUS_CHANNEL_SYNC_STATE_MISSING');
    error.code = 'SETTINGS_COMMAND_BUS_CHANNEL_SYNC_STATE_MISSING';
    error.channel = channel;
    throw error;
  }
  return syncState;
}

function normalizePatch(patch = {}) {
  if (!isPlainObject(patch)) return {};
  return { ...patch };
}

function requireProfileGeneration(value) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.trim() !== value
  ) {
    throw new Error('SETTINGS_COMMAND_BUS_PROFILE_GENERATION_REQUIRED');
  }
  return value;
}

function createTerminalAdmissionError(profileGeneration) {
  const error = new Error('SETTINGS_COMMAND_BUS_PROFILE_MUTATION_QUIESCED');
  error.code = 'SETTINGS_COMMAND_BUS_PROFILE_MUTATION_QUIESCED';
  error.profileGeneration = profileGeneration;
  return error;
}

function normalizeKeys(keys = [], fallbackKeys = []) {
  const source = Array.isArray(keys) && keys.length > 0 ? keys : fallbackKeys;
  if (!Array.isArray(source)) return [];
  return Array.from(new Set(
    source
      .filter((key) => typeof key === 'string')
      .map((key) => key.trim())
      .filter(Boolean),
  ));
}

function hasPatchEntries(patch) {
  return isPlainObject(patch) && Object.keys(patch).length > 0;
}

function mergePatch(base = {}, next = {}) {
  return mergeSettingsCommandPatches(normalizePatch(base), normalizePatch(next));
}

function mergeKeys(base = [], next = []) {
  return normalizeKeys([
    ...normalizeKeys(base),
    ...normalizeKeys(next),
  ]);
}

function getRetryDelayMs(retryCount) {
  const normalizedRetryCount = Number.isFinite(Number(retryCount))
    ? Math.max(0, Math.floor(Number(retryCount)))
    : 0;
  return Math.min(
    SETTINGS_QUEUE_RETRY_MAX_DELAY_MS,
    SETTINGS_QUEUE_RETRY_BASE_DELAY_MS * (2 ** normalizedRetryCount),
  );
}

function summarizeCommands(commands = []) {
  let patch = {};
  const channelKeys = {};

  commands.forEach((command) => {
    if (!command || !hasPatchEntries(command.patch)) return;
    patch = mergePatch(patch, command.patch);
    channelKeys[command.channel] = mergeKeys(
      channelKeys[command.channel],
      command.pendingKeys,
    );
  });

  return {
    patch,
    channelKeys,
  };
}

const useSettingsCommandBusStore = create(() => ({
  channelSync: createChannelSyncStateMap(),
}));

function readChannelSync(channel) {
  const normalizedChannel = normalizeChannel(channel);
  return requireChannelSyncState(
    useSettingsCommandBusStore.getState().channelSync,
    normalizedChannel,
  );
}

function updateChannelSyncStates(channelUpdaters = {}) {
  const entries = Object.entries(channelUpdaters)
    .map(([channel, updater]) => [normalizeChannel(channel), updater])
    .filter(([, updater]) => typeof updater === 'function');
  if (entries.length === 0) return;

  useSettingsCommandBusStore.setState((state) => {
    const nextChannelSync = { ...requireChannelSyncMap(state.channelSync) };
    let changed = false;

    entries.forEach(([channel, updater]) => {
      const current = requireChannelSyncState(nextChannelSync, channel);
      const next = updater(current);
      if (next !== current) {
        nextChannelSync[channel] = next;
        changed = true;
      }
    });

    return changed ? { channelSync: nextChannelSync } : state;
  });
}

function publishCommandSync(channels = KNOWN_CHANNELS) {
  updateChannelSyncStates(Object.fromEntries([...new Set(channels)].map((channel) => [
    channel,
    () => buildSettingsSyncAggregateState(
      [...commandSyncRecords.values()]
        .filter((command) => command.channel === channel)
        .map((command) => ({ commandId: command.id, ...command.sync })),
      committedChannelSync[channel],
    ),
  ])));
}

function requirePropagationChangedKeys(propagation) {
  if (propagation === null || propagation === undefined) return [];
  if (!isPlainObject(propagation)
    || !Array.isArray(propagation.changedKeys)
    || propagation.changedKeys.length === 0
    || propagation.changedKeys.some((key) => typeof key !== 'string' || !key || key.trim() !== key)) {
    throw new Error('SETTINGS_PROPAGATION_ACK_INVALID');
  }
  return [...new Set(propagation.changedKeys)];
}

function clearAcknowledgedFailures(channel, acknowledgedKeys, currentCommandId, result, {
  propagationOnly = false,
} = {}) {
  for (const command of commandSyncRecords.values()) {
    if (command.channel !== channel || command.id === currentCommandId) continue;
    if (ownerCommands.has(command.id)) continue;
    if (![SETTINGS_SYNC_STATUS.ERROR, SETTINGS_SYNC_STATUS.APPLY_ERROR, SETTINGS_SYNC_STATUS.APPLYING]
      .includes(command.sync.status)) continue;
    const applyOperation = command.sync.status !== SETTINGS_SYNC_STATUS.ERROR;
    if (propagationOnly && !applyOperation) continue;
    if (applyOperation && (
      result.propagation?.status !== 'succeeded'
      || !Array.isArray(result.propagation.changedKeys)
      || !Number.isInteger(result.propagation.commitVersion)
      || result.propagation.commitVersion < command.sync.lastAckVersion
    )) continue;
    const covered = new Set(applyOperation
      ? acknowledgedKeys.filter((key) => result.propagation.changedKeys.includes(key))
      : acknowledgedKeys);
    const remainingPropagationKeys = applyOperation
      ? command.propagationKeys.filter((key) => !covered.has(key))
      : [];
    const remainingKeys = command.pendingKeys.filter((key) => !covered.has(key));
    if (remainingKeys.length === command.pendingKeys.length) continue;
    if (remainingKeys.length === 0
      || (applyOperation && remainingPropagationKeys.length === 0)) {
      commandSyncRecords.delete(command.id);
      continue;
    }
    command.pendingKeys = remainingKeys;
    if (applyOperation) command.propagationKeys = remainingPropagationKeys;
    if (command.patch) {
      command.patch = Object.fromEntries(Object.entries(command.patch).filter(([key]) => !covered.has(key)));
    }
    command.sync = {
      ...command.sync,
      pendingKeys: command.sync.pendingKeys.filter((key) => !covered.has(key)),
      dirtyKeys: command.sync.dirtyKeys.filter((key) => !covered.has(key)),
      lastAckKeys: command.sync.lastAckKeys.filter((key) => !covered.has(key)),
    };
  }
}

function registerCommandSync(command) {
  command.sync = buildSettingsSyncSavingState(command.pendingKeys);
  commandSyncRecords.set(command.id, command);
  publishCommandSync([command.channel]);
}

function markCommandsSaving(commands) {
  commands.forEach((command) => {
    command.sync = buildSettingsSyncSavingState(command.pendingKeys, command.sync);
  });
  publishCommandSync(commands.map((command) => command.channel));
}

function observeSettingsPropagationCompletion(command, receipt) {
  if (receipt?.status !== 'timed_out' || command.propagationKeys.length === 0) return;
  const observation = {};
  command.propagationObservation = observation;
  const isCurrent = () => commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.OPEN
    && commandBusProfileGeneration === command.profileGeneration
    && commandSyncRecords.get(command.id) === command
    && command.propagationObservation === observation;
  const completion = (async () => {
    let pendingReceipt = receipt;
    while (isCurrent()) {
      // The bounded command wait ended, not the canonical application task.
      // Join that same owner/task; this read never repeats the saved patch or effects.
      const propagation = await waitForSettingsPropagationViaRuntime(pendingReceipt, {
        expectedProfileGeneration: command.profileGeneration,
      });
      if (!isCurrent()) return;
      command.sync = buildSettingsSyncCommittedState({
        version: command.sync.lastAckVersion,
        keys: command.sync.lastAckKeys,
        propagation,
      }, command.sync);
      if (command.sync.status === SETTINGS_SYNC_STATUS.SYNCED) {
        clearAcknowledgedFailures(command.channel, command.pendingKeys, command.id, { propagation }, {
          propagationOnly: true,
        });
        commandSyncRecords.delete(command.id);
      }
      publishCommandSync([command.channel]);
      if (propagation.status !== 'timed_out') return;
      pendingReceipt = propagation;
    }
  })();
  void completion.catch((error) => {
    if (!isCurrent()) return;
    command.sync = buildSettingsPropagationObservationErrorState(error, command.sync);
    publishCommandSync([command.channel]);
  });
}

function markCommandsCommitted(commands, result) {
  const propagatedKeys = requirePropagationChangedKeys(result.propagation);
  commands.forEach((command) => {
    if (!commandSyncRecords.has(command.id)) return;
    clearAcknowledgedFailures(command.channel, command.pendingKeys, command.id, result);
    const propagationKeys = collectSettingsPropagationRetryKeys(command.pendingKeys)
      .filter((key) => propagatedKeys.includes(key));
    command.propagationKeys = propagationKeys;
    command.sync = buildSettingsSyncCommittedState({
      version: result.version,
      keys: command.pendingKeys,
      propagation: propagationKeys.length > 0 ? result.propagation : null,
    }, command.sync);
    if (command.sync.status === SETTINGS_SYNC_STATUS.SYNCED) commandSyncRecords.delete(command.id);
    else observeSettingsPropagationCompletion(command, result.propagation);
  });
  const channelKeys = {};
  commands.forEach((command) => {
    channelKeys[command.channel] = mergeKeys(channelKeys[command.channel], command.pendingKeys);
  });
  Object.entries(channelKeys).forEach(([channel, keys]) => {
    const committed = committedChannelSync[channel];
    if (Number(result.version) >= committed.lastAckVersion) {
      committedChannelSync[channel] = buildSettingsSyncSuccessState({ version: result.version, keys }, committed);
    }
  });
  publishCommandSync(commands.map((command) => command.channel));
}

function markCommandsFailed(commands, error) {
  commands.forEach((command) => {
    if (!commandSyncRecords.has(command.id)) return;
    command.sync = buildSettingsSyncErrorState(error, command.sync, { dirtyKeys: command.pendingKeys });
  });
  publishCommandSync(commands.map((command) => command.channel));
}

function describeSettingsCommandError(error) {
  return {
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
    missingKeys: normalizeKeys(error?.missingKeys).slice(0, 32),
    message: typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : String(error || 'UNKNOWN_ERROR'),
    name: typeof error?.name === 'string' && error.name.trim() ? error.name.trim() : null,
  };
}

function formatSettingsFlowLog(event, details = {}) {
  let serializedDetails;
  try {
    serializedDetails = JSON.stringify(details);
  } catch {
    serializedDetails = '{"error":"LOG_DETAILS_UNSERIALIZABLE"}';
  }
  return `[SETTINGS_FLOW][commandBus][${event}] ${serializedDetails}`;
}

let nextCommandId = 1;
let inFlight = false;
let retryCount = 0;
let retryTimerId = null;
let inFlightCommands = [];
let queuedCommands = [];
const commandSyncRecords = new Map();
const ownerCommands = new Map();
let committedChannelSync = createChannelSyncStateMap();
let commandBusPhase = SETTINGS_COMMAND_BUS_PHASE.UNBOUND;
let commandBusProfileGeneration = null;
let commandBusTerminalError = null;

function requireCommandBusAdmission() {
  if (
    commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.OPEN
    && commandBusProfileGeneration !== null
  ) {
    return commandBusProfileGeneration;
  }
  if (commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.QUIESCED) {
    throw commandBusTerminalError
      || createTerminalAdmissionError(commandBusProfileGeneration);
  }
  throw new Error('SETTINGS_COMMAND_BUS_PROFILE_GENERATION_NOT_BOUND');
}

function assertCommandBusAdmission(profileGeneration) {
  const currentProfileGeneration = requireCommandBusAdmission();
  if (currentProfileGeneration !== profileGeneration) {
    throw new Error('SETTINGS_COMMAND_BUS_PROFILE_GENERATION_CHANGED');
  }
}

function resolveBatchProfileGeneration(commands = []) {
  const generations = Array.from(new Set(commands.map((command) => (
    requireProfileGeneration(command?.profileGeneration)
  ))));
  if (generations.length !== 1) {
    throw new Error('SETTINGS_COMMAND_BUS_BATCH_PROFILE_GENERATION_MIXED');
  }
  return generations[0];
}

export function bindSettingsCommandBusToProfileGeneration(profileGeneration) {
  const normalizedProfileGeneration = requireProfileGeneration(profileGeneration);
  if (commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.UNBOUND) {
    commandBusProfileGeneration = normalizedProfileGeneration;
    commandBusPhase = SETTINGS_COMMAND_BUS_PHASE.OPEN;
    return Object.freeze({
      bound: true,
      reused: false,
      profileGeneration: normalizedProfileGeneration,
    });
  }
  if (
    commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.OPEN
    && commandBusProfileGeneration === normalizedProfileGeneration
  ) {
    return Object.freeze({
      bound: true,
      reused: true,
      profileGeneration: normalizedProfileGeneration,
    });
  }
  const error = new Error(
    commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.QUIESCED
      ? 'SETTINGS_COMMAND_BUS_PROFILE_MUTATION_QUIESCED'
      : 'SETTINGS_COMMAND_BUS_PROFILE_GENERATION_ALREADY_BOUND',
  );
  error.code = error.message;
  error.boundProfileGeneration = commandBusProfileGeneration;
  error.requestedProfileGeneration = normalizedProfileGeneration;
  throw error;
}

function buildPendingPatchForChannel(channel) {
  const normalizedChannel = normalizeChannel(channel);
  let patch = {};

  inFlightCommands.forEach((command) => {
    if (command?.channel !== normalizedChannel || !hasPatchEntries(command.patch)) return;
    patch = mergePatch(patch, command.patch);
  });

  queuedCommands.forEach((command) => {
    if (command?.channel !== normalizedChannel || !hasPatchEntries(command.patch)) return;
    patch = mergePatch(patch, command.patch);
  });

  return patch;
}

export function getSettingsCommandPendingPatch(channel) {
  return buildPendingPatchForChannel(channel);
}

export function assertSettingsCommandBusReadAdmission() {
  return requireCommandBusAdmission();
}

function clearRetryTimer() {
  if (retryTimerId !== null) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
}

export function quiesceSettingsCommandBusForProfileMutation({
  expectedProfileGeneration = null,
} = {}) {
  const normalizedExpectedProfileGeneration = expectedProfileGeneration === null
    ? null
    : requireProfileGeneration(expectedProfileGeneration);
  if (
    normalizedExpectedProfileGeneration !== null
    && commandBusProfileGeneration !== normalizedExpectedProfileGeneration
  ) {
    throw new Error('SETTINGS_COMMAND_BUS_PROFILE_GENERATION_STALE');
  }
  if (commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.QUIESCED) {
    return Object.freeze({
      quiesced: true,
      reused: true,
      profileGeneration: commandBusProfileGeneration,
    });
  }

  commandBusPhase = SETTINGS_COMMAND_BUS_PHASE.QUIESCED;
  commandBusTerminalError = createTerminalAdmissionError(commandBusProfileGeneration);
  clearRetryTimer();
  retryCount = 0;

  const unsettledCommands = [...inFlightCommands, ...queuedCommands, ...ownerCommands.values()];
  queuedCommands = [];
  inFlightCommands = [];
  ownerCommands.clear();
  unsettledCommands.forEach((command) => {
    command.reject?.(commandBusTerminalError);
  });
  markCommandsFailed(unsettledCommands, commandBusTerminalError);

  return Object.freeze({
    quiesced: true,
    reused: false,
    profileGeneration: commandBusProfileGeneration,
    rejectedCommandCount: unsettledCommands.length,
  });
}

function scheduleFlush(delayMs = 0) {
  clearRetryTimer();
  if (delayMs > 0) {
    retryTimerId = setTimeout(() => {
      retryTimerId = null;
      void flushSettingsCommandBus();
    }, delayMs);
    return;
  }
  queueMicrotask(() => {
    void flushSettingsCommandBus();
  });
}

function moveFailedCommandsIntoQueue(channels = []) {
  const targetChannels = new Set(channels.length > 0 ? channels.map(normalizeChannel) : KNOWN_CHANNELS);
  const failedCommands = [...commandSyncRecords.values()].filter((command) => (
    targetChannels.has(command.channel)
    && command.sync.status === SETTINGS_SYNC_STATUS.ERROR
    && hasPatchEntries(command.patch)
  ));
  failedCommands.forEach((failedCommand) => {
    commandSyncRecords.delete(failedCommand.id);
    const command = {
      id: nextCommandId++, channel: failedCommand.channel,
      patch: normalizePatch(failedCommand.patch), pendingKeys: [...failedCommand.pendingKeys],
      profileGeneration: requireCommandBusAdmission(), resolve: null, reject: null,
    };
    queuedCommands.push(command);
    registerCommandSync(command);
  });
  if (failedCommands.length > 0 && !inFlight) scheduleFlush(0);
  return failedCommands.length > 0;
}

export function retrySettingsCommand(channel = null) {
  requireCommandBusAdmission();
  if (channel) {
    return moveFailedCommandsIntoQueue([channel]);
  }
  return moveFailedCommandsIntoQueue();
}

export function retrySettingsPropagation(channel, commandId) {
  const normalizedChannel = normalizeChannel(channel);
  const profileGeneration = requireCommandBusAdmission();
  const command = commandSyncRecords.get(commandId);
  if (!command || command.channel !== normalizedChannel) {
    return Promise.reject(new Error('SETTINGS_PROPAGATION_RETRY_COMMAND_MISSING'));
  }
  if (command.propagationRetryPromise) return command.propagationRetryPromise;
  if (command.sync.status !== SETTINGS_SYNC_STATUS.APPLY_ERROR) {
    return Promise.reject(new Error('SETTINGS_PROPAGATION_RETRY_NOT_FAILED'));
  }
  const previousSync = command.sync;
  const retryKeys = collectSettingsPropagationRetryKeys(previousSync.lastAckKeys)
    .filter((key) => command.propagationKeys.includes(key));
  if (retryKeys.length === 0) {
    return Promise.reject(new Error('SETTINGS_PROPAGATION_RETRY_KEYS_INVALID'));
  }
  command.sync = { ...previousSync, status: SETTINGS_SYNC_STATUS.APPLYING, retryingPropagation: true };
  publishCommandSync([normalizedChannel]);
  const promise = new Promise((resolve, reject) => {
    command.reject = reject;
    ownerCommands.set(command.id, command);
    void retrySettingsPropagationViaRuntime(retryKeys, {
      expectedProfileGeneration: profileGeneration, timeoutMs: 20_000,
    }).then((result) => {
      assertCommandBusAdmission(profileGeneration);
      if (!result?.propagation || typeof result.propagation.status !== 'string') {
        throw new Error('SETTINGS_PROPAGATION_RETRY_RECEIPT_REQUIRED');
      }
      ownerCommands.delete(command.id);
      // Recovery applies the current owner snapshot. It never replays this
      // command's old settings patch, and only a succeeded receipt clears it.
      const nextSync = buildSettingsSyncCommittedState({
        version: result.version, keys: previousSync.lastAckKeys, propagation: result.propagation,
      }, previousSync);
      const committed = committedChannelSync[normalizedChannel];
      if (Number(result.version) >= committed.lastAckVersion) {
        committedChannelSync[normalizedChannel] = buildSettingsSyncSuccessState({
          version: result.version, keys: previousSync.lastAckKeys,
        }, committed);
      }
      if (nextSync.status === SETTINGS_SYNC_STATUS.SYNCED) {
        commandSyncRecords.delete(command.id);
        clearAcknowledgedFailures(normalizedChannel, retryKeys, command.id, result);
      } else {
        command.sync = nextSync;
      }
      publishCommandSync([normalizedChannel]);
      if (nextSync.status === SETTINGS_SYNC_STATUS.APPLYING) {
        observeSettingsPropagationCompletion(command, result.propagation);
      }
      resolve(result);
    }).catch((error) => {
      ownerCommands.delete(command.id);
      if (commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.OPEN && commandSyncRecords.has(command.id)) {
        command.sync = { ...previousSync, error: describeSettingsCommandError(error).message };
        publishCommandSync([normalizedChannel]);
      }
      reject(error);
    });
  });
  command.propagationRetryPromise = promise;
  void promise.then(() => { command.propagationRetryPromise = null; }, () => { command.propagationRetryPromise = null; });
  return promise;
}

export function getSettingsCommandSyncState(channel) {
  return readChannelSync(channel);
}

export function useSettingsCommandSync(channel) {
  const normalizedChannel = normalizeChannel(channel);
  // A channel entry is replaced atomically and is referentially stable between updates;
  // this selector returns that stored object rather than allocating a composite value.
  return useSettingsCommandBusStore((state) => requireChannelSyncState(
    state.channelSync,
    normalizedChannel,
  ));
}

export function useSettingsCommandChannelMap(selector) {
  return useSettingsCommandBusStore(selector);
}

export async function dispatchSettingsCommand({
  channel = SETTINGS_COMMAND_CHANNELS.PROTOCOL,
  patch = {},
  pendingKeys = [],
} = {}) {
  const normalizedChannel = normalizeChannel(channel);
  const nextPatch = mergeSettingsCommandPatches({}, normalizePatch(patch));
  assertSettingsCommandChannelPatch(normalizedChannel, nextPatch);
  if (!hasPatchEntries(nextPatch)) {
    return {
      changedKeys: [],
      version: null,
      patch: {},
      applied: {
        refreshed: false,
        syncScripts: false,
        broadcast: false,
      },
    };
  }
  const profileGeneration = requireCommandBusAdmission();

  const commandPendingKeys = mergeKeys(Object.keys(nextPatch), pendingKeys);
  assertSettingsCommandChannelKeys(normalizedChannel, commandPendingKeys);
  const command = {
    id: nextCommandId++,
    channel: normalizedChannel,
    patch: nextPatch,
    pendingKeys: commandPendingKeys,
    profileGeneration,
  };

  const promise = new Promise((resolve, reject) => {
    command.resolve = resolve;
    command.reject = reject;
  });

  queuedCommands.push(command);
  registerCommandSync(command);

  if (!inFlight) {
    scheduleFlush(0);
  }

  return promise;
}

export async function runSettingsChannelCommand({
  channel = SETTINGS_COMMAND_CHANNELS.PROTOCOL,
  pendingKeys = [],
  execute,
} = {}) {
  const normalizedChannel = normalizeChannel(channel);
  const dirtyKeys = normalizeKeys(pendingKeys);
  assertSettingsCommandChannelKeys(normalizedChannel, dirtyKeys);
  const profileGeneration = requireCommandBusAdmission();
  const command = {
    id: nextCommandId++, channel: normalizedChannel, pendingKeys: dirtyKeys, profileGeneration,
  };
  registerCommandSync(command);
  // Owner commands have their own execution owner, but share the same lifetime
  // receipts and terminal profile fence as queued generic settings commands.
  return new Promise((resolve, reject) => {
    command.reject = reject;
    ownerCommands.set(command.id, command);
    let execution;
    try {
      assertCommandBusAdmission(profileGeneration);
      if (typeof execute !== 'function') throw new Error('SETTINGS_COMMAND_EXECUTE_REQUIRED');
      execution = execute();
    } catch (error) {
      ownerCommands.delete(command.id);
      markCommandsFailed([command], error);
      reject(error);
      return;
    }
    void Promise.resolve(execution).then((result) => {
      const acknowledgementStarted = beginSettingsFlowTiming();
      assertCommandBusAdmission(profileGeneration);
      requireSettingsCommitAcknowledgement(result?.items, dirtyKeys);
      ownerCommands.delete(command.id);
      markCommandsCommitted([command], result);
      endSettingsFlowTiming('owner_ack_publication', acknowledgementStarted, { commandId: command.id });
      resolve(result);
    }).catch((error) => {
      ownerCommands.delete(command.id);
      if (commandBusPhase === SETTINGS_COMMAND_BUS_PHASE.OPEN) markCommandsFailed([command], error);
      reject(error);
    });
  });
}

export async function flushSettingsCommandBus() {
  if (inFlight || queuedCommands.length === 0) {
    return null;
  }

  const batch = queuedCommands;
  queuedCommands = [];
  inFlightCommands = batch;
  const { patch, channelKeys } = summarizeCommands(batch);
  const profileGeneration = resolveBatchProfileGeneration(batch);
  if (!hasPatchEntries(patch)) {
    inFlightCommands = [];
    return null;
  }

  inFlight = true;
  markCommandsSaving(batch);

  try {
    const result = await applyDashboardSettingsPatch(patch, {
      expectedProfileGeneration: profileGeneration,
      retryCount: SETTINGS_QUEUE_TRANSPORT_RETRY_COUNT,
      waitForPropagation: true,
      timeoutMs: 20_000,
    });
    if (
      commandBusPhase !== SETTINGS_COMMAND_BUS_PHASE.OPEN
      || commandBusProfileGeneration !== profileGeneration
    ) {
      inFlight = false;
      inFlightCommands = [];
      retryCount = 0;
      return null;
    }
    const acknowledgedPatch = requireSettingsCommitAcknowledgement(
      result?.committedItems,
      Object.values(channelKeys).flat(),
    );
    const resolvedResult = {
      ...result,
      patch: acknowledgedPatch,
    };
    inFlight = false;
    inFlightCommands = [];
    retryCount = 0;

    markCommandsCommitted(batch, resolvedResult);
    batch.forEach((command) => {
      command.resolve?.(resolvedResult);
    });

    if (queuedCommands.length > 0) {
      scheduleFlush(0);
    }
    return resolvedResult;
  } catch (error) {
    inFlight = false;
    const errorDetails = describeSettingsCommandError(error);

    if (
      commandBusPhase !== SETTINGS_COMMAND_BUS_PHASE.OPEN
      || commandBusProfileGeneration !== profileGeneration
    ) {
      inFlightCommands = [];
      retryCount = 0;
      return null;
    }

    if (
      isTransientSettingsApplyError(error?.code || error?.message || '')
      && retryCount < SETTINGS_QUEUE_MAX_RETRIES
    ) {
      retryCount += 1;
      queuedCommands = [...batch, ...queuedCommands];
      inFlightCommands = [];
      const nextRetryDelayMs = getRetryDelayMs(retryCount - 1);
      const retryAt = Date.now() + nextRetryDelayMs;
      console.warn(formatSettingsFlowLog('flush_retry_scheduled', {
        channels: Object.keys(channelKeys),
        patchKeys: Object.keys(patch),
        retryCount,
        retryDelayMs: nextRetryDelayMs,
        error: errorDetails,
      }));
      queuedCommands.forEach((command) => {
        command.sync = buildSettingsSyncRetryState(error, command.pendingKeys, { retryAt, retryCount }, command.sync);
      });
      publishCommandSync(queuedCommands.map((command) => command.channel));
      scheduleFlush(nextRetryDelayMs);
      return null;
    }

    retryCount = 0;
    inFlightCommands = [];
    console.error(formatSettingsFlowLog('flush_failed', {
      channels: Object.keys(channelKeys),
      patchKeys: Object.keys(patch),
      error: errorDetails,
    }));
    markCommandsFailed(batch, error);
    batch.forEach((command) => command.reject?.(error));

    if (queuedCommands.length > 0) scheduleFlush(0);

    return null;
  }
}

export function createSettingsCommandChannelClient(channel) {
  const contract = requireSettingsCommandChannelContract(channel);
  return Object.freeze({
    channel: contract.channel,
    dispatchPatch: (patch = {}, pendingKeys = []) => dispatchSettingsCommand({
      channel: contract.channel,
      patch,
      pendingKeys,
    }),
    getPendingPatch: () => getSettingsCommandPendingPatch(contract.channel),
    runOwnerCommand: ({ pendingKeys = [], execute } = {}) => runSettingsChannelCommand({
      channel: contract.channel,
      pendingKeys,
      execute,
    }),
  });
}

export function resetSettingsCommandBusForTesting({
  profileGeneration = SETTINGS_COMMAND_BUS_TEST_PROFILE_GENERATION,
} = {}) {
  clearRetryTimer();
  nextCommandId = 1;
  inFlight = false;
  retryCount = 0;
  inFlightCommands = [];
  queuedCommands = [];
  commandSyncRecords.clear();
  ownerCommands.clear();
  committedChannelSync = createChannelSyncStateMap();
  commandBusPhase = SETTINGS_COMMAND_BUS_PHASE.UNBOUND;
  commandBusProfileGeneration = null;
  commandBusTerminalError = null;
  useSettingsCommandBusStore.setState({
    channelSync: createChannelSyncStateMap(),
  });
  bindSettingsCommandBusToProfileGeneration(profileGeneration);
}
