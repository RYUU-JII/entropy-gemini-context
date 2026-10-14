import {
  CYCLE_SETTINGS_KEY,
  createCycleSettingsRecord,
  readCycleSettingsRecord,
  toCycleSettingsValue,
} from '../../../platform/storage/runtime/cycleStateStorageContracts.js';

function createCyclePolicyOwnerError(code, cause = null, details = {}) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireSettingsService(settingsService) {
  if (
    !settingsService
    || typeof settingsService.commitSettingsMutation !== 'function'
    || typeof settingsService.ensureSettingsCache !== 'function'
    || typeof settingsService.refreshSettingsCache !== 'function'
    || typeof settingsService.getSettingsCache !== 'function'
  ) {
    throw new Error('CYCLE_RESET_POLICY_SETTINGS_SERVICE_REQUIRED');
  }
  return settingsService;
}

function readOptionalCycleSettings(cache = {}) {
  const storedRecord = cache?.[CYCLE_SETTINGS_KEY];
  if (typeof storedRecord === 'undefined') {
    return { found: false, value: undefined };
  }
  return {
    found: true,
    value: toCycleSettingsValue(readCycleSettingsRecord(storedRecord)),
  };
}

function cloneCycleSettings(value) {
  return toCycleSettingsValue(createCycleSettingsRecord(value));
}

function requireSynchronousPolicyProposal(prepare, currentSettings) {
  if (typeof prepare !== 'function') {
    throw new Error('CYCLE_RESET_POLICY_PREPARE_REQUIRED');
  }
  const proposed = prepare(currentSettings ? cloneCycleSettings(currentSettings) : null);
  if (proposed && typeof proposed.then === 'function') {
    throw new Error('CYCLE_RESET_POLICY_PREPARE_ASYNC_FORBIDDEN');
  }
  return cloneCycleSettings(proposed);
}

export function createCycleResetPolicySettingsOwner({
  settingsService,
} = {}) {
  const resolvedSettingsService = requireSettingsService(settingsService);
  let settingsState = null;
  let initialized = false;
  let revision = 0;
  let lifecycleEpoch = 0;
  let mutationTail = Promise.resolve();

  function enqueueMutation(task) {
    const run = mutationTail.then(task, task);
    mutationTail = run.catch(() => undefined);
    return run;
  }

  function getSnapshot() {
    if (!initialized || !settingsState) {
      throw new Error('CYCLE_RESET_POLICY_NOT_INITIALIZED');
    }
    return cloneCycleSettings(settingsState);
  }

  function getRevision() {
    return revision;
  }

  async function commitNow({
    actionReason,
    allowMissing = false,
    admittedEpoch,
    expectedRevision = null,
    prepare,
  }) {
    let result;
    try {
      result = await resolvedSettingsService.commitSettingsMutation({
        actionReason,
        prepare: (canonicalSettingsCache) => {
          if (admittedEpoch !== lifecycleEpoch) {
            throw createCyclePolicyOwnerError('CYCLE_RESET_POLICY_MUTATION_STALE', null, {
              actionReason,
              admittedEpoch,
              currentEpoch: lifecycleEpoch,
            });
          }
          if (expectedRevision !== null && expectedRevision !== revision) {
            throw createCyclePolicyOwnerError('CYCLE_RESET_POLICY_REVISION_STALE', null, {
              actionReason,
              expectedRevision,
              currentRevision: revision,
            });
          }

          const current = readOptionalCycleSettings(canonicalSettingsCache);
          if (!current.found && !allowMissing) {
            throw new Error('CYCLE_RESET_POLICY_MISSING');
          }
          const nextSettings = requireSynchronousPolicyProposal(
            prepare,
            current.found ? current.value : null,
          );
          return {
            [CYCLE_SETTINGS_KEY]: createCycleSettingsRecord(nextSettings),
          };
        },
        emitSettingsUpdated: false,
        invalidateFilterCache: false,
        refreshForBroadcast: false,
        reportBroadcastAsRefresh: false,
      });
    } catch (cause) {
      if (
        cause?.code === 'CYCLE_RESET_POLICY_MUTATION_STALE'
        || cause?.code === 'CYCLE_RESET_POLICY_REVISION_STALE'
      ) {
        throw cause;
      }
      throw createCyclePolicyOwnerError('CYCLE_RESET_POLICY_COMMIT_FAILED', cause, {
        actionReason,
        revision,
      });
    }

    const committedRecord = result?.committedItems?.[CYCLE_SETTINGS_KEY];
    if (typeof committedRecord === 'undefined') {
      throw createCyclePolicyOwnerError('CYCLE_RESET_POLICY_COMMIT_ACK_INVALID', null, {
        actionReason,
        revision,
      });
    }

    let committedSettings;
    try {
      committedSettings = toCycleSettingsValue(readCycleSettingsRecord(committedRecord));
    } catch (cause) {
      throw createCyclePolicyOwnerError('CYCLE_RESET_POLICY_COMMIT_ACK_INVALID', cause, {
        actionReason,
        revision,
      });
    }

    settingsState = committedSettings;
    initialized = true;
    revision += 1;
    return {
      changed: Array.isArray(result?.changedKeys)
        && result.changedKeys.includes(CYCLE_SETTINGS_KEY),
      revision,
      settings: cloneCycleSettings(settingsState),
    };
  }

  function hydrate({
    force = false,
    createDefault,
  } = {}) {
    if (typeof createDefault !== 'function') {
      return Promise.reject(new Error('CYCLE_RESET_POLICY_BOOTSTRAP_OWNER_REQUIRED'));
    }
    const admittedEpoch = ++lifecycleEpoch;
    return enqueueMutation(async () => {
      if (force) {
        await resolvedSettingsService.refreshSettingsCache();
      } else {
        await resolvedSettingsService.ensureSettingsCache();
      }

      const current = readOptionalCycleSettings(resolvedSettingsService.getSettingsCache());
      if (current.found) {
        settingsState = cloneCycleSettings(current.value);
        initialized = true;
        revision += 1;
        return {
          bootstrapped: false,
          revision,
          settings: cloneCycleSettings(settingsState),
        };
      }

      const committed = await commitNow({
        actionReason: 'cycle_reset_policy_bootstrap',
        allowMissing: true,
        admittedEpoch,
        prepare: () => createDefault(),
      });
      return {
        ...committed,
        bootstrapped: true,
      };
    });
  }

  function commitMutation({
    actionReason = 'cycle_reset_policy_mutation',
    allowMissing = false,
    expectedRevision = null,
    prepare,
  } = {}) {
    const admittedEpoch = lifecycleEpoch;
    return enqueueMutation(() => commitNow({
      actionReason,
      admittedEpoch,
      allowMissing,
      expectedRevision,
      prepare,
    }));
  }

  return {
    commitMutation,
    getRevision,
    getSnapshot,
    hydrate,
  };
}

export default createCycleResetPolicySettingsOwner;
