import { create } from 'zustand';
import {
  runtimeSendMessage,
} from '../../../platform/messaging/runtime/runtimeMessaging.js';
import ClseSettingsQueryService from '../../../platform/storage/clse/ClseSettingsQueryService.js';
import { CLSE_CONSTANTS } from '../../../domains/behavior/clseSchema.js';
import {
  CLSE_ALERT_COOLDOWN_DEFAULT_MS,
  CLSE_ALERT_COOLDOWN_KEY,
  normalizeCLSEAlertCooldown,
  normalizeCLSESensitivityScale,
} from '../../../domains/behavior/clseSettings.js';
import {
  requireCanonicalCLSEControlSnapshot,
  requireCanonicalCLSEStatusSnapshot,
} from '../../../domains/behavior/clseStatusContract.js';
import { resolveBootPrewarmSection } from '../bootstrap/bootPrewarmSnapshot.js';
import {
  dispatchClseSettingsPatch,
} from './clseSettingsClient.js';

const CLSE_FLAG_KEY = CLSE_CONSTANTS.FEATURE_FLAG_KEY;
const CLSE_SENSITIVITY_KEY = CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY;
const clseSettingsQueryService = ClseSettingsQueryService.getInstance();

let initializePromise = null;
let storageSyncBound = false;
let storageSyncListener = null;
let storageSyncUnsubscribe = null;
const pendingClseMutationsByKey = new Map();
const CLSE_STATE_FIELD_BY_KEY = Object.freeze({
  [CLSE_FLAG_KEY]: 'isEnabled',
  [CLSE_SENSITIVITY_KEY]: 'sensitivityScale',
  [CLSE_ALERT_COOLDOWN_KEY]: 'alertCooldownMs',
});
const clseCommitRevisionsByKey = new Map(
  Object.keys(CLSE_STATE_FIELD_BY_KEY).map((key) => [key, 0]),
);
let nextClseReadRequestId = 0;
let latestClseReadRequestId = 0;

function toLoadError(error, fallbackMessage = 'CLSE_STATUS_READ_FAILED') {
  if (error instanceof Error) return error;
  if (typeof error === 'string' && error.trim()) {
    return new Error(error.trim());
  }
  return new Error(fallbackMessage);
}

function failClseLoad(set, error, fallbackMessage) {
  const loadError = toLoadError(error, fallbackMessage);
  set({ loaded: false, loadError });
  return loadError;
}

async function refreshStatusAfterFailedWrite(get, primaryError) {
  try {
    await get().refreshStatus();
  } catch (refreshError) {
    console.warn('[useCLSEStore] Failed to refresh CLSE status after settings write failure:', {
      primaryError: primaryError?.message || String(primaryError || 'CLSE_SETTINGS_WRITE_FAILED'),
      refreshError: refreshError?.message || String(refreshError || 'CLSE_STATUS_REFRESH_FAILED'),
    });
  }
}

function toStatusPatch(status, errorCode = 'CLSE_STATUS_INVALID') {
  const resolvedStatus = requireCanonicalCLSEStatusSnapshot(status, errorCode);
  return {
    isEnabled: resolvedStatus.isEnabled,
    sensitivityScale: resolvedStatus.sensitivityScale,
    alertCooldownMs: resolvedStatus.alertCooldownMs,
  };
}

function toStatusPatchFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const patch = {};

  if (Object.prototype.hasOwnProperty.call(snapshot, CLSE_FLAG_KEY)) {
    patch.isEnabled = !!snapshot[CLSE_FLAG_KEY];
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, CLSE_SENSITIVITY_KEY)) {
    patch.sensitivityScale = normalizeCLSESensitivityScale(snapshot[CLSE_SENSITIVITY_KEY]);
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, CLSE_ALERT_COOLDOWN_KEY)) {
    patch.alertCooldownMs = normalizeCLSEAlertCooldown(snapshot[CLSE_ALERT_COOLDOWN_KEY]);
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function readCommittedClseState(state) {
  return {
    isEnabled: !!state?.isEnabled,
    sensitivityScale: normalizeCLSESensitivityScale(state?.sensitivityScale),
    alertCooldownMs: normalizeCLSEAlertCooldown(state?.alertCooldownMs),
  };
}

function beginClseStatusRead() {
  const requestId = ++nextClseReadRequestId;
  latestClseReadRequestId = requestId;
  return {
    requestId,
    commitRevisions: Object.fromEntries(
      Object.keys(CLSE_STATE_FIELD_BY_KEY).map((key) => [
        key,
        clseCommitRevisionsByKey.get(key) || 0,
      ]),
    ),
  };
}

function markClseSettingCommitted(key) {
  clseCommitRevisionsByKey.set(key, (clseCommitRevisionsByKey.get(key) || 0) + 1);
}

function requireCommittedClseStatusPatch(result, requiredKey) {
  const committedItems = result?.committedItems;
  if (
    !committedItems
    || typeof committedItems !== 'object'
    || Array.isArray(committedItems)
    || !Object.prototype.hasOwnProperty.call(committedItems, requiredKey)
  ) {
    const error = new Error('CLSE_SETTINGS_COMMIT_ACK_INVALID');
    error.code = 'CLSE_SETTINGS_COMMIT_ACK_INVALID';
    error.requiredKey = requiredKey;
    throw error;
  }
  const patch = toStatusPatchFromSnapshot(committedItems);
  if (!patch) {
    throw new Error('CLSE_SETTINGS_COMMIT_ACK_INVALID');
  }
  return patch;
}

function applyStatusPatch(set, patch, { loaded = true } = {}) {
  if (!patch || typeof patch !== 'object') return null;
  set((state) => ({
    ...state,
    ...(Object.prototype.hasOwnProperty.call(patch, 'isEnabled') ? { isEnabled: !!patch.isEnabled } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'sensitivityScale') ? { sensitivityScale: normalizeCLSESensitivityScale(patch.sensitivityScale) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'alertCooldownMs') ? { alertCooldownMs: normalizeCLSEAlertCooldown(patch.alertCooldownMs) } : {}),
    loaded: loaded ? true : state.loaded,
    loadError: null,
  }));
  return patch;
}

function applyClseStatusRead(set, get, status, readContext, errorCode) {
  const statusPatch = toStatusPatch(status, errorCode);
  if (readContext?.requestId !== latestClseReadRequestId) {
    return readCommittedClseState(get());
  }

  const nextPatch = {};
  Object.entries(CLSE_STATE_FIELD_BY_KEY).forEach(([key, field]) => {
    if (
      (clseCommitRevisionsByKey.get(key) || 0)
      === (readContext?.commitRevisions?.[key] || 0)
    ) {
      nextPatch[field] = statusPatch[field];
    }
  });
  applyStatusPatch(set, nextPatch);
  return readCommittedClseState(get());
}

function runCommittedClseMutation({ key, requestedValue, execute }) {
  const pendingMutation = pendingClseMutationsByKey.get(key);
  if (pendingMutation && Object.is(pendingMutation.requestedValue, requestedValue)) {
    return pendingMutation.promise;
  }

  const promise = Promise.resolve().then(execute);
  pendingClseMutationsByKey.set(key, { requestedValue, promise });
  const clearIfCurrent = () => {
    if (pendingClseMutationsByKey.get(key)?.promise === promise) {
      pendingClseMutationsByKey.delete(key);
    }
  };
  void promise.then(clearIfCurrent, clearIfCurrent);
  return promise;
}

export const useCLSEStore = create((set, get) => ({
  isEnabled: false,
  sensitivityScale: CLSE_CONSTANTS.SENSITIVITY_SCALE_DEFAULT || 1,
  alertCooldownMs: CLSE_ALERT_COOLDOWN_DEFAULT_MS,
  loaded: false,
  loadError: null,

  initialize: async (bootContext = null) => {
    bindStorageSync();
    if (get().loaded) return get().isEnabled;
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      const prewarm = resolveBootPrewarmSection(bootContext, 'clse');
      if (prewarm) {
        let patch;
        try {
          patch = requireCanonicalCLSEControlSnapshot(
            prewarm,
            'CLSE_PREWARM_STATUS_INVALID',
          );
        } catch (error) {
          throw failClseLoad(set, error, 'CLSE_PREWARM_STATUS_INVALID');
        }
        applyStatusPatch(set, patch);
        return !!patch.isEnabled;
      }

      const readContext = beginClseStatusRead();
      let status;
      try {
        status = await runtimeSendMessage({ type: 'CLSE_GET_STATUS' });
      } catch (error) {
        throw failClseLoad(set, error, 'CLSE_STATUS_READ_FAILED');
      }
      let patch;
      try {
        patch = applyClseStatusRead(set, get, status, readContext, 'CLSE_STATUS_INVALID');
      } catch (error) {
        throw failClseLoad(set, error, 'CLSE_STATUS_INVALID');
      }
      return !!patch.isEnabled;
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },

  refreshStatus: async () => {
    bindStorageSync();
    const readContext = beginClseStatusRead();
    let status;
    try {
      status = await runtimeSendMessage({ type: 'CLSE_GET_STATUS' });
    } catch (error) {
      throw failClseLoad(set, error, 'CLSE_STATUS_REFRESH_FAILED');
    }
    let patch;
    try {
      patch = applyClseStatusRead(set, get, status, readContext, 'CLSE_STATUS_INVALID');
    } catch (error) {
      throw failClseLoad(set, error, 'CLSE_STATUS_INVALID');
    }
    return !!patch.isEnabled;
  },

  setEnabled: async (enabled) => {
    bindStorageSync();
    const requested = !!enabled;
    const pendingMutation = pendingClseMutationsByKey.get(CLSE_FLAG_KEY);
    if (!pendingMutation && get().isEnabled === requested) {
      return get().isEnabled;
    }
    return runCommittedClseMutation({
      key: CLSE_FLAG_KEY,
      requestedValue: requested,
      execute: async () => {
        try {
          const result = await dispatchClseSettingsPatch(
            { [CLSE_FLAG_KEY]: requested },
            [CLSE_FLAG_KEY],
          );
          const committedPatch = requireCommittedClseStatusPatch(result, CLSE_FLAG_KEY);
          markClseSettingCommitted(CLSE_FLAG_KEY);
          applyStatusPatch(set, committedPatch);
        } catch (error) {
          await refreshStatusAfterFailedWrite(get, error);
          throw error;
        }
        return get().isEnabled;
      },
    });
  },

  setSensitivityScale: async (scale) => {
    bindStorageSync();
    const requested = normalizeCLSESensitivityScale(scale);
    const pendingMutation = pendingClseMutationsByKey.get(CLSE_SENSITIVITY_KEY);
    if (!pendingMutation && get().sensitivityScale === requested) {
      return get().sensitivityScale;
    }
    return runCommittedClseMutation({
      key: CLSE_SENSITIVITY_KEY,
      requestedValue: requested,
      execute: async () => {
        try {
          const result = await dispatchClseSettingsPatch(
            { [CLSE_SENSITIVITY_KEY]: requested },
            [CLSE_SENSITIVITY_KEY],
          );
          const committedPatch = requireCommittedClseStatusPatch(result, CLSE_SENSITIVITY_KEY);
          markClseSettingCommitted(CLSE_SENSITIVITY_KEY);
          applyStatusPatch(set, committedPatch);
        } catch (error) {
          await refreshStatusAfterFailedWrite(get, error);
          throw error;
        }
        return get().sensitivityScale;
      },
    });
  },

  setAlertCooldownMs: async (cooldownMs) => {
    bindStorageSync();
    const requested = normalizeCLSEAlertCooldown(cooldownMs);
    const pendingMutation = pendingClseMutationsByKey.get(CLSE_ALERT_COOLDOWN_KEY);
    if (!pendingMutation && get().alertCooldownMs === requested) {
      return get().alertCooldownMs;
    }
    return runCommittedClseMutation({
      key: CLSE_ALERT_COOLDOWN_KEY,
      requestedValue: requested,
      execute: async () => {
        try {
          const result = await dispatchClseSettingsPatch(
            { [CLSE_ALERT_COOLDOWN_KEY]: requested },
            [CLSE_ALERT_COOLDOWN_KEY],
          );
          const committedPatch = requireCommittedClseStatusPatch(result, CLSE_ALERT_COOLDOWN_KEY);
          markClseSettingCommitted(CLSE_ALERT_COOLDOWN_KEY);
          applyStatusPatch(set, committedPatch);
        } catch (error) {
          await refreshStatusAfterFailedWrite(get, error);
          throw error;
        }
        return get().alertCooldownMs;
      },
    });
  },
}));

function bindStorageSync() {
  if (storageSyncBound) return;
  storageSyncListener = (snapshot) => {
    const patch = toStatusPatchFromSnapshot(snapshot);
    if (!patch) return;
    Object.entries(CLSE_STATE_FIELD_BY_KEY).forEach(([key, field]) => {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        markClseSettingCommitted(key);
      }
    });
    applyStatusPatch(useCLSEStore.setState, patch);
  };
  const unbind = clseSettingsQueryService.subscribeSnapshot(storageSyncListener, {
    defaults: {
      [CLSE_FLAG_KEY]: false,
      [CLSE_SENSITIVITY_KEY]: CLSE_CONSTANTS.SENSITIVITY_SCALE_DEFAULT || 1,
      [CLSE_ALERT_COOLDOWN_KEY]: CLSE_ALERT_COOLDOWN_DEFAULT_MS,
    },
  });
  if (typeof unbind === 'function') {
    storageSyncUnsubscribe = unbind;
    storageSyncBound = true;
  } else {
    storageSyncListener = null;
  }
}

function unbindStorageSync() {
  if (!storageSyncBound || !storageSyncListener) return;
  storageSyncUnsubscribe?.();
  storageSyncListener = null;
  storageSyncUnsubscribe = null;
  storageSyncBound = false;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unbindStorageSync();
    initializePromise = null;
  });
}
