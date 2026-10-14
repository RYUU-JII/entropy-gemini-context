function createCommitQueueError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requirePositiveSafeInteger(value, errorCode) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(errorCode);
  }
  return value;
}

function requireErrorCodes(errorCodes) {
  const requiredKeys = [
    'timeout',
    'poisoned',
    'capacity',
    'activeKeyCapacity',
  ];
  if (
    !errorCodes
    || typeof errorCodes !== 'object'
    || requiredKeys.some((key) => typeof errorCodes[key] !== 'string' || !errorCodes[key])
  ) {
    throw new Error('BOUNDED_KEYED_COMMIT_QUEUE_ERROR_CODES_INVALID');
  }
  return errorCodes;
}

export function createBoundedKeyedCommitQueue({
  deadlineMs,
  maxDepth,
  maxActiveKeys,
  errorCodes,
  deadlineInvalidCode = 'BOUNDED_KEYED_COMMIT_QUEUE_DEADLINE_INVALID',
  activeKeyCapacityInvalidCode = 'BOUNDED_KEYED_COMMIT_QUEUE_ACTIVE_KEY_CAPACITY_INVALID',
  now = () => Date.now(),
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timerId) => clearTimeout(timerId),
} = {}) {
  const resolvedDeadlineMs = requirePositiveSafeInteger(deadlineMs, deadlineInvalidCode);
  const resolvedMaxDepth = requirePositiveSafeInteger(
    maxDepth,
    'BOUNDED_KEYED_COMMIT_QUEUE_DEPTH_INVALID',
  );
  const resolvedMaxActiveKeys = requirePositiveSafeInteger(
    maxActiveKeys,
    activeKeyCapacityInvalidCode,
  );
  const resolvedErrorCodes = requireErrorCodes(errorCodes);
  const queueByKey = new Map();

  function clearDeadline(entry) {
    if (entry.timeoutId === null) return;
    clearTimer(entry.timeoutId);
    entry.timeoutId = null;
  }

  function releaseQueue(key, state) {
    if (queueByKey.get(key) === state) {
      queueByKey.delete(key);
    }
  }

  function rejectPending(state, code) {
    const queuedEntries = state.pending.splice(0);
    queuedEntries.forEach((entry) => {
      clearDeadline(entry);
      entry.status = 'settled';
      entry.reject(createCommitQueueError(code));
    });
  }

  function releaseTimedOutRunning(key, state, entry) {
    if (state.runningEntry !== entry || entry.status !== 'timed_out') return;
    state.runningEntry = null;
    state.poisoned = false;
    releaseQueue(key, state);
  }

  function timeoutEntry(key, state, entry) {
    entry.timeoutId = null;

    if (entry.status === 'pending') {
      const pendingIndex = state.pending.indexOf(entry);
      if (pendingIndex < 0) return;
      state.pending.splice(pendingIndex, 1);
      entry.status = 'settled';
      entry.reject(createCommitQueueError(resolvedErrorCodes.timeout));
      drain(key, state);
      return;
    }

    if (entry.status !== 'running' || state.runningEntry !== entry) return;
    entry.status = 'timed_out';
    state.poisoned = true;
    entry.reject(createCommitQueueError(resolvedErrorCodes.timeout));
    rejectPending(state, resolvedErrorCodes.poisoned);
  }

  function settleRunning(key, state, entry, result) {
    if (entry.status === 'timed_out') {
      releaseTimedOutRunning(key, state, entry);
      return;
    }
    if (entry.status !== 'running' || state.runningEntry !== entry) return;

    clearDeadline(entry);
    if (now() >= entry.deadlineAt) {
      timeoutEntry(key, state, entry);
      releaseTimedOutRunning(key, state, entry);
      return;
    }

    entry.status = 'settled';
    state.runningEntry = null;
    if (result.ok) entry.resolve(result.value);
    else entry.reject(result.error);
    drain(key, state);
  }

  function drain(key, state) {
    if (state.runningEntry || state.poisoned) return;

    let entry = state.pending.shift();
    while (entry && (entry.status !== 'pending' || now() >= entry.deadlineAt)) {
      if (entry.status === 'pending') {
        clearDeadline(entry);
        entry.status = 'settled';
        entry.reject(createCommitQueueError(resolvedErrorCodes.timeout));
      }
      entry = state.pending.shift();
    }
    if (!entry) {
      releaseQueue(key, state);
      return;
    }

    entry.status = 'running';
    state.runningEntry = entry;
    Promise.resolve().then(entry.task).then(
      (value) => settleRunning(key, state, entry, { ok: true, value }),
      (error) => settleRunning(key, state, entry, { ok: false, error }),
    );
  }

  function run(key, task) {
    if (typeof task !== 'function') {
      throw new Error('BOUNDED_KEYED_COMMIT_QUEUE_TASK_REQUIRED');
    }
    let state = queueByKey.get(key);
    if (!state) {
      if (queueByKey.size >= resolvedMaxActiveKeys) {
        throw createCommitQueueError(resolvedErrorCodes.activeKeyCapacity);
      }
      state = { runningEntry: null, poisoned: false, pending: [] };
      queueByKey.set(key, state);
    }
    if (state.poisoned) {
      throw createCommitQueueError(resolvedErrorCodes.poisoned);
    }
    const depth = state.pending.length + (state.runningEntry ? 1 : 0);
    if (depth >= resolvedMaxDepth) {
      throw createCommitQueueError(resolvedErrorCodes.capacity);
    }

    const enqueuedAt = now();
    let entry;
    const operation = new Promise((resolve, reject) => {
      entry = {
        task,
        resolve,
        reject,
        status: 'pending',
        deadlineAt: enqueuedAt + resolvedDeadlineMs,
        timeoutId: null,
      };
    });
    state.pending.push(entry);
    try {
      entry.timeoutId = setTimer(
        () => timeoutEntry(key, state, entry),
        resolvedDeadlineMs,
      );
    } catch (error) {
      state.pending.pop();
      entry.status = 'settled';
      if (!state.runningEntry && state.pending.length === 0) {
        releaseQueue(key, state);
      }
      throw error;
    }
    drain(key, state);
    return operation;
  }

  return Object.freeze({ run });
}

export default createBoundedKeyedCommitQueue;
