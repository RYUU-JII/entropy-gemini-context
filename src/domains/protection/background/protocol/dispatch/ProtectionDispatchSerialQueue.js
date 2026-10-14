const issuedQueueErrors = new WeakSet();

function createQueueError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  issuedQueueErrors.add(error);
  return error;
}

export function isProtectionDispatchSerialQueueError(value) {
  return value instanceof Error && issuedQueueErrors.has(value);
}

function requireTabId(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createQueueError('PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_ID_INVALID');
  }
  return value;
}

function requireTask(task) {
  if (typeof task !== 'function') {
    throw createQueueError('PROTECTION_DISPATCH_SERIAL_QUEUE_TASK_REQUIRED');
  }
  return task;
}

function requireReason(value, errorCode) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw createQueueError(errorCode);
  }
  return value;
}

function requirePhase(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw createQueueError('PROTECTION_DISPATCH_SERIAL_FENCE_PHASE_INVALID');
  }
  return value;
}

function createState() {
  return {
    generation: 0,
    invalidationReason: null,
    invalidationTag: null,
    evictRequested: false,
    evictionFinalized: false,
    pendingCount: 0,
    tail: Promise.resolve(),
  };
}

export function createProtectionDispatchSerialQueue() {
  const stateByTab = new Map();
  const taskInvalidations = new WeakMap();

  function createTaskInvalidation(code, task, details) {
    const error = createQueueError(code, details);
    // Preserve exact task provenance and immutable evidence even after eviction.
    // Caller-thrown errors (including errors from another task/queue) cannot settle it.
    taskInvalidations.set(error, { task, evidence: Object.freeze({ code, ...details }) });
    return error;
  }

  function getTaskInvalidation(error, task) {
    const issued = taskInvalidations.get(error);
    return issued && issued.task === task ? issued.evidence : null;
  }

  function assertFenceCurrent(state, {
    tabId,
    generation,
    phase,
    task,
  }) {
    const resolvedPhase = requirePhase(phase);
    if (state.evictRequested) {
      throw createTaskInvalidation('PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED', task, {
        tabId,
        phase: resolvedPhase,
        reason: state.invalidationReason,
      });
    }
    if (state.generation !== generation) {
      throw createTaskInvalidation('PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED', task, {
        tabId,
        phase: resolvedPhase,
        reason: state.invalidationReason,
        invalidationTag: state.invalidationTag,
      });
    }
  }

  function enqueue(tabId, task) {
    const resolvedTabId = requireTabId(tabId);
    const resolvedTask = requireTask(task);
    const state = stateByTab.get(resolvedTabId) || createState();
    if (state.evictRequested) {
      return Promise.reject(createTaskInvalidation(
        'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED',
        resolvedTask,
        { tabId: resolvedTabId, phase: 'enqueue', reason: state.invalidationReason },
      ));
    }
    stateByTab.set(resolvedTabId, state);
    state.pendingCount += 1;
    const generation = state.generation;
    const fence = Object.freeze({
      assertCurrent: (phase) => assertFenceCurrent(state, {
        tabId: resolvedTabId,
        generation,
        phase,
        task: resolvedTask,
      }),
    });
    const execution = state.tail.then(() => {
      fence.assertCurrent('dequeued');
      return resolvedTask({ fence });
    });
    const tracked = execution.finally(() => {
      state.pendingCount -= 1;
      if (state.pendingCount < 0) {
        throw createQueueError('PROTECTION_DISPATCH_SERIAL_QUEUE_PENDING_COUNT_INVALID', {
          tabId: resolvedTabId,
        });
      }
      if (
        state.pendingCount === 0
        && (!state.evictRequested || state.evictionFinalized)
        && stateByTab.get(resolvedTabId) === state
      ) {
        stateByTab.delete(resolvedTabId);
      }
    });
    state.tail = tracked.then(() => undefined, () => undefined);
    return tracked;
  }

  function invalidateTab(tabId, { reason, invalidationTag = null } = {}) {
    const resolvedTabId = requireTabId(tabId);
    const resolvedReason = requireReason(
      reason,
      'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATION_REASON_INVALID',
    );
    if (
      invalidationTag !== null
      && (!Number.isSafeInteger(invalidationTag) || invalidationTag <= 0)
    ) {
      throw createQueueError('PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATION_TAG_INVALID');
    }
    const state = stateByTab.get(resolvedTabId);
    if (!state) return false;
    state.generation += 1;
    state.invalidationReason = resolvedReason;
    state.invalidationTag = invalidationTag;
    return true;
  }

  function closeTab(tabId, { reason } = {}) {
    const resolvedTabId = requireTabId(tabId);
    const resolvedReason = requireReason(
      reason,
      'PROTECTION_DISPATCH_SERIAL_QUEUE_EVICTION_REASON_INVALID',
    );
    const state = stateByTab.get(resolvedTabId) || createState();
    stateByTab.set(resolvedTabId, state);
    state.generation += 1;
    state.invalidationReason = resolvedReason;
    state.invalidationTag = null;
    state.evictRequested = true;
    state.evictionFinalized = false;
    return true;
  }

  function evictTab(tabId, { reason } = {}) {
    const resolvedTabId = requireTabId(tabId);
    const resolvedReason = requireReason(
      reason,
      'PROTECTION_DISPATCH_SERIAL_QUEUE_EVICTION_REASON_INVALID',
    );
    const state = stateByTab.get(resolvedTabId);
    if (!state) return false;
    if (!state.evictRequested) {
      state.generation += 1;
    }
    state.invalidationReason = resolvedReason;
    state.invalidationTag = null;
    state.evictRequested = true;
    state.evictionFinalized = true;
    if (state.pendingCount === 0) stateByTab.delete(resolvedTabId);
    return true;
  }

  return Object.freeze({
    closeTab,
    enqueue,
    evictTab,
    getTaskInvalidation,
    invalidateTab,
  });
}

export default createProtectionDispatchSerialQueue;
