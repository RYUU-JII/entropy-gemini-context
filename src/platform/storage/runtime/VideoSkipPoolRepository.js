import VideoSkipPoolStore from '../internal/chrome-storage/stores/VideoSkipPoolStore.js';
import VideoSkipPoolWriteTransport from './VideoSkipPoolWriteTransport.js';
import {
  VIDEO_SKIP_POOL_SCHEMA_VERSION,
  createDefaultVideoSkipPool,
  normalizeVideoSkipPoolSnapshot,
  serializeVideoSkipPool,
} from './videoSkipPoolContract.js';
import { isExtensionContextInvalidatedError } from '../../messaging/runtime/runtimeMessaging.js';

const DEFAULT_WRITE_THROTTLE_MS = 1000;
export { VIDEO_SKIP_POOL_SCHEMA_VERSION };

function normalizeWriteThrottleMs(value) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return DEFAULT_WRITE_THROTTLE_MS;
  }
  return Math.max(0, Math.floor(nextValue));
}

function getWindowRef() {
  return typeof window === 'undefined' ? null : window;
}

function getDocumentRef() {
  return typeof document === 'undefined' ? null : document;
}

function getTimerApi() {
  return typeof globalThis === 'undefined' ? null : globalThis;
}

export class VideoSkipPoolRepository {
  constructor({
    poolStore = VideoSkipPoolStore.getInstance(),
    poolWriter = VideoSkipPoolWriteTransport.getInstance(),
    storageWriteThrottleMs = DEFAULT_WRITE_THROTTLE_MS,
  } = {}) {
    if (!poolStore || typeof poolStore.get !== 'function' || typeof poolStore.subscribe !== 'function') {
      throw new Error('VIDEO_SKIP_POOL_STORE_REQUIRED');
    }
    if (!poolWriter || typeof poolWriter.merge !== 'function') {
      throw new Error('VIDEO_SKIP_POOL_WRITE_OWNER_REQUIRED');
    }

    this.poolStore = poolStore;
    this.poolWriter = poolWriter;
    this.storageWriteThrottleMs = normalizeWriteThrottleMs(storageWriteThrottleMs);

    this._pool = null;
    this._lastPoolPersistAt = 0;
    this._poolPersistTimer = null;
    this._unsubscribePoolStore = null;
    this._boundOnVisibilityChange = null;
    this._boundOnPageHide = null;
    this._onStateChange = null;
    this._onPersistError = null;
    this._persistWriteChain = Promise.resolve();
    this._persistWriteSequence = 0;
    this._extensionContextInvalidated = false;
  }

  setCallback(fn) {
    this._onStateChange = fn;
  }

  setErrorCallback(fn) {
    if (fn !== null && typeof fn !== 'function') {
      throw new Error('VIDEO_SKIP_POOL_PERSIST_ERROR_CALLBACK_INVALID');
    }
    this._onPersistError = fn;
  }

  get pool() {
    return this._ensurePool();
  }

  _ensurePool() {
    if (!this._pool) {
      this._pool = createDefaultVideoSkipPool();
    }
    return this._pool;
  }

  _markPoolUpdated() {
    const pool = this._ensurePool();
    const previousUpdatedAt = Math.max(0, Math.floor(Number(pool.updatedAt) || 0));
    pool.updatedAt = Math.max(Date.now(), previousUpdatedAt + 1);
    return pool;
  }

  touch({ immediate } = {}) {
    this._markPoolUpdated();
    return this.persist({ immediate });
  }

  modify(fn) {
    const pool = this._ensurePool();
    fn(pool);
    this._markPoolUpdated();
    return this.persist({ immediate: false });
  }

  _serializePool() {
    return serializeVideoSkipPool(this._ensurePool());
  }

  _applyPoolSnapshot(snapshot) {
    const normalized = normalizeVideoSkipPoolSnapshot(snapshot);
    const updatedAt = normalized.updatedAt;
    const nextCooldownUntil = normalized.cooldownUntil;
    const pool = this._ensurePool();
    const currentCooldownUntil = Math.max(0, Math.floor(Number(pool.cooldownUntil) || 0));
    const currentUpdatedAt = Math.max(0, Math.floor(Number(pool.updatedAt) || 0));
    const mergedCooldownUntil = Math.max(currentCooldownUntil, nextCooldownUntil);
    const mergedUpdatedAt = Math.max(currentUpdatedAt, updatedAt);
    const changed = (
      pool.cooldownUntil !== mergedCooldownUntil
      || pool.updatedAt !== mergedUpdatedAt
    );

    pool.cooldownUntil = mergedCooldownUntil;
    pool.updatedAt = mergedUpdatedAt;
    return {
      changed,
      storageRepairRequired: currentCooldownUntil > nextCooldownUntil,
    };
  }

  async restore() {
    const storedSnapshot = await this.poolStore.get();
    if (!storedSnapshot) return;
    const result = this._applyPoolSnapshot(storedSnapshot);
    if (result.changed) {
      this._notifyChange('restore');
    }
    if (result.storageRepairRequired) {
      this._markPoolUpdated();
      await this.persist({ immediate: true });
    }
  }

  persist({ immediate } = {}) {
    if (this._extensionContextInvalidated) return null;
    const now = Date.now();
    const timerApi = getTimerApi();

    if (
      !immediate
      && timerApi
      && typeof timerApi.setTimeout === 'function'
      && now - this._lastPoolPersistAt < this.storageWriteThrottleMs
    ) {
      if (this._poolPersistTimer) return null;
      const delay = Math.max(0, this.storageWriteThrottleMs - (now - this._lastPoolPersistAt));
      this._poolPersistTimer = timerApi.setTimeout(() => {
        this._poolPersistTimer = null;
        void this.persist({ immediate: true });
      }, delay);
      return null;
    }

    if (this._poolPersistTimer && timerApi && typeof timerApi.clearTimeout === 'function') {
      try {
        timerApi.clearTimeout(this._poolPersistTimer);
      } catch (_error) {
        // Best-effort timer cleanup only.
      }
      this._poolPersistTimer = null;
    }

    const preparedSnapshot = this._serializePool();
    const pool = this._ensurePool();
    pool.cooldownUntil = preparedSnapshot.cooldownUntil;
    pool.updatedAt = preparedSnapshot.updatedAt;
    this._lastPoolPersistAt = now;
    const writeSequence = this._persistWriteSequence + 1;
    this._persistWriteSequence = writeSequence;

    const writeContext = { snapshot: preparedSnapshot };
    const writePromise = this._persistWriteChain.then(async () => {
      const snapshot = this._serializePool();
      writeContext.snapshot = snapshot;
      const canonicalSnapshot = await this.poolWriter.merge(snapshot);
      const result = this._applyPoolSnapshot(canonicalSnapshot);
      if (result.changed) this._notifyChange('write_commit');
      return canonicalSnapshot;
    });
    this._persistWriteChain = writePromise.catch(() => undefined);
    void writePromise.catch((error) => {
      if (this._persistWriteSequence === writeSequence) {
        this._lastPoolPersistAt = 0;
      }
      const extensionContextInvalidated = isExtensionContextInvalidatedError(error);
      if (extensionContextInvalidated) this._abandonForInvalidatedExtensionContext();
      if (typeof this._onPersistError !== 'function') return;
      try {
        this._onPersistError(error, {
          snapshot: writeContext.snapshot,
          ...(extensionContextInvalidated ? { extensionContextInvalidated: true } : {}),
        });
      } catch (callbackError) {
        console.error('VIDEO_SKIP_POOL_PERSIST_ERROR_CALLBACK_FAILED', callbackError);
      }
    });
    return writePromise;
  }

  install() {
    if (!this._unsubscribePoolStore) {
      this._unsubscribePoolStore = this.poolStore.subscribe((nextSnapshot) => {
        const result = this._applyPoolSnapshot(nextSnapshot);
        if (result.changed) this._notifyChange('storage');

        const timerApi = getTimerApi();
        if (this._poolPersistTimer && timerApi && typeof timerApi.clearTimeout === 'function') {
          try {
            timerApi.clearTimeout(this._poolPersistTimer);
          } catch (_error) {
            // Best-effort timer cleanup only.
          }
          this._poolPersistTimer = null;
        }
        if (result.storageRepairRequired) {
          this._markPoolUpdated();
          void this.persist({ immediate: true });
        }
      });
    }

    const documentRef = getDocumentRef();
    if (documentRef && !this._boundOnVisibilityChange) {
      this._boundOnVisibilityChange = () => {
        if (documentRef.visibilityState === 'hidden') {
          void this.persist({ immediate: true });
        }
      };
      documentRef.addEventListener('visibilitychange', this._boundOnVisibilityChange);
    }

    const windowRef = getWindowRef();
    if (windowRef && !this._boundOnPageHide) {
      this._boundOnPageHide = () => {
        void this.persist({ immediate: true });
      };
      windowRef.addEventListener('pagehide', this._boundOnPageHide);
    }
  }

  _clearPersistTimer() {
    const timerApi = getTimerApi();
    if (this._poolPersistTimer && timerApi && typeof timerApi.clearTimeout === 'function') {
      try {
        timerApi.clearTimeout(this._poolPersistTimer);
      } catch (_error) {
        // Best-effort timer cleanup only.
      }
      this._poolPersistTimer = null;
    }
  }

  _detachPageListeners() {
    if (this._unsubscribePoolStore) {
      this._unsubscribePoolStore();
      this._unsubscribePoolStore = null;
    }

    const documentRef = getDocumentRef();
    if (documentRef && this._boundOnVisibilityChange) {
      documentRef.removeEventListener('visibilitychange', this._boundOnVisibilityChange);
      this._boundOnVisibilityChange = null;
    }

    const windowRef = getWindowRef();
    if (windowRef && this._boundOnPageHide) {
      windowRef.removeEventListener('pagehide', this._boundOnPageHide);
      this._boundOnPageHide = null;
    }
  }

  // The extension this repository belonged to is gone. Detach from the still-live page so
  // returning to the tab cannot schedule another write that can never land.
  _abandonForInvalidatedExtensionContext() {
    if (this._extensionContextInvalidated) return;
    this._extensionContextInvalidated = true;
    this._clearPersistTimer();
    this._detachPageListeners();
    this._onStateChange = null;
  }

  teardown() {
    this._clearPersistTimer();

    const flushPromise = this.persist({ immediate: true });

    this._detachPageListeners();

    this._onStateChange = null;
    if (flushPromise) {
      void flushPromise.then(
        () => {
          this._onPersistError = null;
        },
        () => {
          // Keep the diagnostics owner for an explicit teardown retry.
        }
      );
    } else {
      this._onPersistError = null;
    }
    return flushPromise;
  }

  _notifyChange(source) {
    if (typeof this._onStateChange === 'function') {
      this._onStateChange(this._ensurePool(), source);
    }
  }
}

export default VideoSkipPoolRepository;
