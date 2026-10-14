function createSerializedTaskRunner() {
  let taskTail = Promise.resolve();

  return async (task) => {
    if (typeof task !== 'function') {
      throw new Error('BACKGROUND_MEMORY_PURGE_TASK_REQUIRED');
    }

    const runPromise = taskTail.then(async () => task());
    taskTail = runPromise.catch((error) => {
      console.warn('[BackgroundMemoryPurgeCoordinator] Queued task failed; continuing serialized queue:', {
        code: 'BACKGROUND_MEMORY_PURGE_TASK_FAILED',
        error: error?.message || String(error || 'BACKGROUND_MEMORY_PURGE_TASK_FAILED'),
      });
      return null;
    });
    return runPromise;
  };
}

function requireMemoryPurgeFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
}

export function createBackgroundMemoryPurgeCoordinator({
  cleanupBlockedHistory,
  syncBlockedBookmarks,
} = {}) {
  requireMemoryPurgeFunction(cleanupBlockedHistory, 'BACKGROUND_MEMORY_PURGE_CLEANUP_HISTORY_REQUIRED');
  requireMemoryPurgeFunction(syncBlockedBookmarks, 'BACKGROUND_MEMORY_PURGE_SYNC_BOOKMARKS_REQUIRED');

  const enqueueMutation = createSerializedTaskRunner();
  let activeBookmarkSync = null;
  let bookmarkSyncRerunRequested = false;

  return {
    cleanupBlockedHistory: async (options = {}) => enqueueMutation(() => cleanupBlockedHistory(options)),
    syncBlockedBookmarks: async () => {
      if (activeBookmarkSync) {
        bookmarkSyncRerunRequested = true;
        return activeBookmarkSync;
      }

      activeBookmarkSync = (async () => {
        let result = null;

        do {
          bookmarkSyncRerunRequested = false;
          result = await enqueueMutation(() => syncBlockedBookmarks());
        } while (bookmarkSyncRerunRequested);

        return result;
      })().finally(() => {
        activeBookmarkSync = null;
      });

      return activeBookmarkSync;
    },
  };
}

export default createBackgroundMemoryPurgeCoordinator;
