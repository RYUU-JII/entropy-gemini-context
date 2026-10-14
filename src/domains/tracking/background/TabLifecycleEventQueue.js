function requireTabId(value) {
  const tabId = Number(value);
  if (!Number.isSafeInteger(tabId) || tabId < 0) {
    throw new Error('TAB_LIFECYCLE_EVENT_QUEUE_TAB_ID_INVALID');
  }
  return tabId;
}

function requireTask(value) {
  if (typeof value !== 'function') {
    throw new Error('TAB_LIFECYCLE_EVENT_QUEUE_TASK_REQUIRED');
  }
  return value;
}

export function createTabLifecycleEventQueue() {
  const tailByTabId = new Map();

  function enqueue(tabIdValue, taskValue) {
    const tabId = requireTabId(tabIdValue);
    const task = requireTask(taskValue);
    const previousTail = tailByTabId.get(tabId) || Promise.resolve();
    const scheduled = previousTail
      .catch(() => undefined)
      .then(task);
    const retainedTail = scheduled.catch(() => undefined);
    tailByTabId.set(tabId, retainedTail);
    void retainedTail.finally(() => {
      if (tailByTabId.get(tabId) === retainedTail) {
        tailByTabId.delete(tabId);
      }
    });
    return scheduled;
  }

  function getPendingTabCount() {
    return tailByTabId.size;
  }

  return Object.freeze({
    enqueue,
    getPendingTabCount,
  });
}

export default createTabLifecycleEventQueue;
