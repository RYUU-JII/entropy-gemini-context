import {
  addChromeStorageChangedListener,
  removeChromeStorageChangedListener,
} from '../storageChangeBus.js';
import {
  readChromeStorageSession,
  writeChromeStorageSession,
} from '../sessionArea.js';
import { STORAGE_SESSION_KEYS } from '../storageKeyRegistry.js';

export const VIDEO_SKIP_POOL_STORAGE_KEY = STORAGE_SESSION_KEYS.VIDEO_SKIP_POOL;

export class VideoSkipPoolStore {
  static getInstance() {
    if (!VideoSkipPoolStore.instance) {
      VideoSkipPoolStore.instance = new VideoSkipPoolStore();
    }
    return VideoSkipPoolStore.instance;
  }

  async get() {
    const items = await readChromeStorageSession({
      [VIDEO_SKIP_POOL_STORAGE_KEY]: null,
    });
    return items?.[VIDEO_SKIP_POOL_STORAGE_KEY] ?? null;
  }

  set(snapshot = null) {
    return writeChromeStorageSession({
      [VIDEO_SKIP_POOL_STORAGE_KEY]: snapshot,
    });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    const handleStorageChange = (changes = {}, areaName) => {
      if (areaName && areaName !== 'session') return;
      if (!Object.prototype.hasOwnProperty.call(changes, VIDEO_SKIP_POOL_STORAGE_KEY)) {
        return;
      }

      const entry = changes[VIDEO_SKIP_POOL_STORAGE_KEY];
      listener(entry?.newValue ?? null, {
        previousValue: entry?.oldValue ?? null,
      });
    };

    const subscribed = addChromeStorageChangedListener(handleStorageChange);
    if (!subscribed) {
      return () => {};
    }
    return () => {
      removeChromeStorageChangedListener(handleStorageChange);
    };
  }
}

export default VideoSkipPoolStore;
