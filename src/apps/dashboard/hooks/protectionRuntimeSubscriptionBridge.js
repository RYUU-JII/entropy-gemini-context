import {
  runtimeOnMessageAddListener,
  runtimeOnMessageRemoveListener,
  runtimeSendMessage,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import {
  assertProtectionRuntimeSnapshotPayload,
  isProtectionRuntimeSnapshotMessage,
} from '../../../domains/protection/contracts/protectionRuntimeSnapshotBridge.js';

const DEFAULT_FALLBACK_POLL_MS = 15_000;
const DEFAULT_SNAPSHOT_FRESHNESS_MS = 15_000;

function normalizeRuntimeSnapshotError(error = null, action = '') {
  const actionPrefix = typeof action === 'string' && action.trim() ? `${action.trim()}:` : '';
  const rawError = typeof error === 'string' && error.trim()
    ? error.trim()
    : (
      typeof error?.code === 'string' && error.code.trim()
        ? error.code.trim()
        : (
          typeof error?.message === 'string' && error.message.trim()
            ? error.message.trim()
            : 'PROTECTION_RUNTIME_SNAPSHOT_READ_FAILED'
        )
    );
  if (actionPrefix && rawError.startsWith(actionPrefix)) return rawError;
  return `${actionPrefix}${rawError}`;
}

function normalizePollMs(value, fallback = DEFAULT_FALLBACK_POLL_MS) {
  const nextValue = Number(value);
  if (Number.isFinite(nextValue) && nextValue >= 0) {
    return Math.floor(nextValue);
  }
  return fallback;
}

function normalizeFreshnessMs(value, fallback = DEFAULT_SNAPSHOT_FRESHNESS_MS) {
  const nextValue = Number(value);
  if (Number.isFinite(nextValue) && nextValue >= 0) {
    return Math.floor(nextValue);
  }
  return fallback;
}

function getSnapshotSemanticKey(value) {
  if (!value) return '';
  return [
    value.scope?.host || '',
    value.scope?.tabId ?? '',
    value.scope?.source || '',
    value.runtime?.available === true ? '1' : '0',
    Number(value.runtime?.revision) || 0,
  ].join('|');
}

export function createProtectionRuntimeSubscriptionBridge({
  fallbackPollMs = DEFAULT_FALLBACK_POLL_MS,
} = {}) {
  const subscribers = new Set();
  const connections = new Map();
  let snapshot = null;
  let runtimeListener = null;
  let pollTimerId = null;
  let syncPromise = null;
  const requestPromises = new Map();
  let observationSequence = 0;
  let visibilityListener = null;
  let defaultPollMs = normalizePollMs(fallbackPollMs);
  let lastSnapshotObservedAtEpochMs = 0;
  let error = '';

  const emitChange = () => {
    subscribers.forEach((subscriber) => {
      subscriber();
    });
  };

  const setSnapshot = (nextSnapshot) => {
    const normalizedSnapshot = nextSnapshot || null;
    if (normalizedSnapshot) {
      lastSnapshotObservedAtEpochMs = Date.now();
    }
    if (getSnapshotSemanticKey(snapshot) === getSnapshotSemanticKey(normalizedSnapshot)) {
      return;
    }
    snapshot = normalizedSnapshot;
    emitChange();
  };

  const setError = (nextError) => {
    const normalizedError = typeof nextError === 'string' ? nextError : '';
    if (error === normalizedError) return;
    error = normalizedError;
    emitChange();
  };

  const requestSnapshot = (action) => {
    if (requestPromises.has(action)) return requestPromises.get(action);
    const requestSequence = ++observationSequence;
    const operation = (async () => {
    try {
      const response = await runtimeSendMessage({ action });
      if (requestSequence !== observationSequence) return snapshot;
      if (!response?.success) {
        setError(normalizeRuntimeSnapshotError(response?.error, action));
        return null;
      }
      if (!Object.prototype.hasOwnProperty.call(response, 'snapshot')) {
        throw new Error(`${action}:PROTECTION_RUNTIME_SNAPSHOT_MISSING`);
      }
      const nextSnapshot = response.snapshot || null;
      if (nextSnapshot) {
        assertProtectionRuntimeSnapshotPayload(nextSnapshot, action);
      }
      setError('');
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (nextError) {
      if (requestSequence !== observationSequence) return snapshot;
      setError(normalizeRuntimeSnapshotError(nextError, action));
      throw nextError;
    }
    })();
    requestPromises.set(action, operation);
    const clearRequest = () => {
      if (requestPromises.get(action) === operation) requestPromises.delete(action);
    };
    operation.then(clearRequest, clearRequest);
    return operation;
  };

  const readSnapshot = () => requestSnapshot(MESSAGE_ACTIONS.GET_PROTECTION_RUNTIME_SNAPSHOT);
  const refreshSnapshot = () => requestSnapshot(MESSAGE_ACTIONS.REFRESH_PROTECTION_RUNTIME_SNAPSHOT);

  const getEffectivePollMs = () => {
    const activePolls = Array.from(connections.values())
      .filter((value) => Number.isFinite(value) && value > 0);
    if (activePolls.length === 0) {
      return 0;
    }
    return Math.min(...activePolls);
  };

  const stopPolling = () => {
    if (pollTimerId !== null) {
      window.clearInterval(pollTimerId);
      pollTimerId = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    const intervalMs = getEffectivePollMs();
    if (intervalMs <= 0 || !isDocumentVisible()) {
      return;
    }
    pollTimerId = window.setInterval(() => {
      if (!isDocumentVisible()) return;
      void readSnapshot().catch(() => {});
    }, intervalMs);
  };

  const detachRuntimeListener = () => {
    if (!runtimeListener) return;
    runtimeOnMessageRemoveListener(runtimeListener);
    runtimeListener = null;
  };

  const attachRuntimeListener = () => {
    if (runtimeListener) return;
    const nextListener = (message) => {
      if (!isProtectionRuntimeSnapshotMessage(message)) return false;
      observationSequence += 1;
      setError('');
      setSnapshot(message.payload.snapshot);
      return false;
    };
    const attached = runtimeOnMessageAddListener(nextListener);
    if (!attached) return;
    runtimeListener = nextListener;
  };

  const syncSnapshot = ({
    snapshotFreshnessMs = DEFAULT_SNAPSHOT_FRESHNESS_MS,
  } = {}) => {
    const freshnessMs = normalizeFreshnessMs(snapshotFreshnessMs);
    if (
      snapshot
      && lastSnapshotObservedAtEpochMs > 0
      && (Date.now() - lastSnapshotObservedAtEpochMs) <= freshnessMs
    ) {
      return Promise.resolve(snapshot);
    }
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
      try {
        const cachedSnapshot = await readSnapshot();
        if (cachedSnapshot) {
          return cachedSnapshot;
        }
        return await refreshSnapshot();
      } catch (_) {
        return null;
      } finally {
        syncPromise = null;
      }
    })();
    return syncPromise;
  };

  const ensureConnected = ({ snapshotFreshnessMs } = {}) => {
    if (connections.size === 0) return;
    attachRuntimeListener();
    if (!visibilityListener && typeof document !== 'undefined') {
      visibilityListener = () => {
        startPolling();
        if (isDocumentVisible()) void syncSnapshot({ snapshotFreshnessMs });
      };
      document.addEventListener('visibilitychange', visibilityListener);
    }
    startPolling();
    if (isDocumentVisible()) void syncSnapshot({ snapshotFreshnessMs });
  };

  function isDocumentVisible() {
    return typeof document === 'undefined'
      || (document.hidden !== true && document.visibilityState !== 'hidden');
  }

  const detachVisibilityListener = () => {
    if (visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityListener);
    }
    visibilityListener = null;
  };

  return {
    getSnapshot() {
      return snapshot;
    },

    getError() {
      return error;
    },

    subscribe(subscriber) {
      if (typeof subscriber !== 'function') {
        return () => {};
      }
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },

    connect({
      fallbackPollMs: nextPollMs = defaultPollMs,
      snapshotFreshnessMs = DEFAULT_SNAPSHOT_FRESHNESS_MS,
    } = {}) {
      const token = Symbol('protection-runtime-connection');
      connections.set(token, normalizePollMs(nextPollMs, defaultPollMs));
      ensureConnected({ snapshotFreshnessMs });
      return () => {
        connections.delete(token);
        if (connections.size === 0) {
          stopPolling();
          detachRuntimeListener();
          detachVisibilityListener();
          syncPromise = null;
          return;
        }
        startPolling();
      };
    },

    configure({ fallbackPollMs: nextPollMs } = {}) {
      defaultPollMs = normalizePollMs(nextPollMs, defaultPollMs);
      if (connections.size > 0) {
        startPolling();
      }
    },

    readSnapshot,
    refreshSnapshot,

    resetForTests() {
      stopPolling();
      detachRuntimeListener();
      detachVisibilityListener();
      observationSequence += 1;
      requestPromises.clear();
      subscribers.clear();
      connections.clear();
      snapshot = null;
      lastSnapshotObservedAtEpochMs = 0;
      error = '';
      syncPromise = null;
      defaultPollMs = normalizePollMs(fallbackPollMs);
    },
  };
}

const defaultProtectionRuntimeSubscriptionBridge = createProtectionRuntimeSubscriptionBridge();

export function getProtectionRuntimeSubscriptionBridge() {
  return defaultProtectionRuntimeSubscriptionBridge;
}

export function resetProtectionRuntimeSubscriptionBridgeForTests() {
  defaultProtectionRuntimeSubscriptionBridge.resetForTests();
}
