import { createBookmarkConcealManager } from '../../../../domains/tracking/background/BookmarkConcealManager.js';
import { createHistoryManager } from '../../../../domains/tracking/background/HistoryManager.js';
import { createTabEvaporationManager } from '../../../../domains/tracking/background/TabEvaporationManager.js';
import { TabEvaporationCheckpointRepository } from '../../../../platform/storage/runtime/TabEvaporationCheckpointRepository.js';
import { createBackgroundKernelHistoryBrowserPort } from './backgroundKernelHistoryBrowserPort.js';

export function createLazyBackgroundHistoryIntegrations() {
  let historyManagerPromise = null;
  let bookmarkManagerPromise = null;
  let tabEvaporationManagerPromise = null;
  let historyManager = null;
  let bookmarkManager = null;
  let tabEvaporationManager = null;
  const browserPort = createBackgroundKernelHistoryBrowserPort();

  function loadHistoryManager() {
    if (historyManager) return Promise.resolve(historyManager);
    historyManagerPromise ||= Promise.resolve()
      .then(() => {
        historyManager = createHistoryManager({ browserPort });
        return historyManager;
      })
      .catch((error) => {
        historyManagerPromise = null;
        console.error('[BackgroundKernelHistoryIntegrations] Failed to load history manager.', error);
        throw error;
      });
    return historyManagerPromise;
  }

  function loadBookmarkManager() {
    if (bookmarkManager) return Promise.resolve(bookmarkManager);
    bookmarkManagerPromise ||= Promise.resolve()
      .then(() => {
        bookmarkManager = createBookmarkConcealManager({ browserPort });
        return bookmarkManager;
      })
      .catch((error) => {
        bookmarkManagerPromise = null;
        console.error('[BackgroundKernelHistoryIntegrations] Failed to load bookmark conceal manager.', error);
        throw error;
      });
    return bookmarkManagerPromise;
  }

  function loadTabEvaporationManager() {
    if (tabEvaporationManager) return Promise.resolve(tabEvaporationManager);
    tabEvaporationManagerPromise ||= Promise.resolve()
      .then(() => {
        tabEvaporationManager = createTabEvaporationManager({ browserPort,
          checkpointRepository: new TabEvaporationCheckpointRepository() });
        return tabEvaporationManager;
      })
      .catch((error) => {
        tabEvaporationManagerPromise = null;
        console.error('[BackgroundKernelHistoryIntegrations] Failed to load tab evaporation manager.', error);
        throw error;
      });
    return tabEvaporationManagerPromise;
  }

  return {
    async scanBlockedHistory(...args) {
      return (await loadHistoryManager()).scanBlockedHistory(...args);
    },
    async cleanupBlockedHistory(...args) {
      return (await loadHistoryManager()).cleanupBlockedHistory(...args);
    },
    async cleanupRecentBlockedHistory(...args) {
      return (await loadHistoryManager()).cleanupRecentBlockedHistory(...args);
    },
    async previewBlockedHistory(...args) {
      return (await loadHistoryManager()).previewBlockedHistory(...args);
    },
    async maybeDeleteHistoryForUrl(...args) {
      return (await loadHistoryManager()).maybeDeleteHistoryForUrl(...args);
    },
    async previewBlockedBookmarks(...args) {
      return (await loadBookmarkManager()).previewBlockedBookmarks(...args);
    },
    async exportBlockedBookmarksHtml(...args) {
      return (await loadBookmarkManager()).exportBlockedBookmarksHtml(...args);
    },
    async syncBlockedBookmarks(...args) {
      return (await loadBookmarkManager()).syncBlockedBookmarks(...args);
    },
    async sweepStaleTabs(...args) {
      return (await loadTabEvaporationManager()).sweepStaleTabs(...args);
    },
    async resetTabEvaporation() {
      return (await loadTabEvaporationManager()).reset();
    },
  };
}
