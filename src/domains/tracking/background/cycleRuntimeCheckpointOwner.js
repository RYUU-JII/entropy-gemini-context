import {
  createCycleCheckpointRecord,
  toCycleCheckpointValue,
} from '../../../platform/storage/runtime/cycleStateStorageContracts.js';

function createCycleCheckpointOwnerError(code, cause = null, details = {}) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireCheckpointStore(cycleRuntimeStore) {
  if (
    !cycleRuntimeStore
    || typeof cycleRuntimeStore.readOptional !== 'function'
    || typeof cycleRuntimeStore.set !== 'function'
  ) {
    throw new Error('CYCLE_RUNTIME_CHECKPOINT_STORE_REQUIRED');
  }
  return cycleRuntimeStore;
}

function cloneCheckpoint(value) {
  return toCycleCheckpointValue(createCycleCheckpointRecord(value));
}

function requireSynchronousCheckpointProposal(prepare, currentCheckpoint) {
  if (typeof prepare !== 'function') {
    throw new Error('CYCLE_RUNTIME_CHECKPOINT_PREPARE_REQUIRED');
  }
  const proposed = prepare(cloneCheckpoint(currentCheckpoint));
  if (proposed && typeof proposed.then === 'function') {
    throw new Error('CYCLE_RUNTIME_CHECKPOINT_PREPARE_ASYNC_FORBIDDEN');
  }
  return cloneCheckpoint(proposed);
}

export function createCycleRuntimeCheckpointOwner({
  cycleRuntimeStore,
} = {}) {
  const resolvedStore = requireCheckpointStore(cycleRuntimeStore);
  let checkpointState = null;
  let initialized = false;
  let revision = 0;
  let lifecycleEpoch = 0;
  let writeTail = Promise.resolve();

  function enqueueWrite(task) {
    const run = writeTail.then(task, task);
    writeTail = run.catch(() => undefined);
    return run;
  }

  function getSnapshot() {
    if (!initialized || !checkpointState) {
      throw new Error('CYCLE_RUNTIME_CHECKPOINT_NOT_INITIALIZED');
    }
    return cloneCheckpoint(checkpointState);
  }

  function getRevision() {
    return revision;
  }

  async function writeSnapshot({
    actionReason,
    admittedEpoch,
    snapshot,
  }) {
    if (admittedEpoch !== lifecycleEpoch) {
      throw createCycleCheckpointOwnerError('CYCLE_RUNTIME_CHECKPOINT_MUTATION_STALE', null, {
        actionReason,
        admittedEpoch,
        currentEpoch: lifecycleEpoch,
      });
    }
    const canonicalSnapshot = cloneCheckpoint(snapshot);
    let committed;
    try {
      committed = await resolvedStore.set(canonicalSnapshot);
    } catch (cause) {
      throw createCycleCheckpointOwnerError('CYCLE_RUNTIME_CHECKPOINT_COMMIT_FAILED', cause, {
        actionReason,
        revision,
      });
    }
    if (!committed || typeof committed !== 'object' || Array.isArray(committed)) {
      throw createCycleCheckpointOwnerError('CYCLE_RUNTIME_CHECKPOINT_COMMIT_ACK_INVALID', null, {
        actionReason,
        revision,
      });
    }
    checkpointState = cloneCheckpoint(committed);
    initialized = true;
    revision += 1;
    return {
      checkpoint: cloneCheckpoint(checkpointState),
      revision,
    };
  }

  function hydrate({
    createDefault,
    reset = false,
  } = {}) {
    if (typeof createDefault !== 'function') {
      return Promise.reject(new Error('CYCLE_RUNTIME_CHECKPOINT_BOOTSTRAP_OWNER_REQUIRED'));
    }
    const admittedEpoch = ++lifecycleEpoch;
    return enqueueWrite(async () => {
      if (!reset) {
        let optional;
        try {
          optional = await resolvedStore.readOptional();
        } catch (cause) {
          throw createCycleCheckpointOwnerError('CYCLE_RUNTIME_CHECKPOINT_HYDRATION_FAILED', cause, {
            revision,
          });
        }
        if (optional?.found === true) {
          checkpointState = cloneCheckpoint(optional.value);
          initialized = true;
          revision += 1;
          return {
            bootstrapped: false,
            checkpoint: cloneCheckpoint(checkpointState),
            revision,
          };
        }
        if (optional?.found !== false) {
          throw createCycleCheckpointOwnerError('CYCLE_RUNTIME_CHECKPOINT_OPTIONAL_READ_INVALID', null, {
            revision,
          });
        }
      }

      const committed = await writeSnapshot({
        actionReason: reset
          ? 'cycle_runtime_checkpoint_reset'
          : 'cycle_runtime_checkpoint_bootstrap',
        admittedEpoch,
        snapshot: createDefault(),
      });
      return {
        ...committed,
        bootstrapped: true,
      };
    });
  }

  function commitMutation({
    actionReason = 'cycle_runtime_checkpoint_mutation',
    prepare,
  } = {}) {
    const admittedEpoch = lifecycleEpoch;
    return enqueueWrite(async () => {
      if (!initialized || !checkpointState) {
        throw new Error('CYCLE_RUNTIME_CHECKPOINT_NOT_INITIALIZED');
      }
      const snapshot = requireSynchronousCheckpointProposal(prepare, checkpointState);
      return writeSnapshot({
        actionReason,
        admittedEpoch,
        snapshot,
      });
    });
  }

  function drain() {
    return writeTail;
  }

  return {
    commitMutation,
    drain,
    getRevision,
    getSnapshot,
    hydrate,
  };
}

export default createCycleRuntimeCheckpointOwner;
