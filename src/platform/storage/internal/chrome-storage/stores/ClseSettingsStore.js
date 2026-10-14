import {
  addChromeStorageChangedListener,
  removeChromeStorageChangedListener,
} from '../storageChangeBus.js';
import { STORAGE_LOCAL_DOC_KEYS } from '../storageKeyRegistry.js';
import SettingsStore from './SettingsStore.js';

const CLSE_FEATURE_FLAG_KEY = 'clse_enabled';
const CLSE_SENSITIVITY_SCALE_KEY = 'clse_sensitivity_scale';
const CLSE_ALERT_COOLDOWN_KEY = 'clse_alert_cooldown_ms';

function createClseSettingsContractError(key) {
  const error = new Error(`CLSE_SETTINGS_VALUE_CONTRACT_INVALID:${key}`);
  error.code = 'CLSE_SETTINGS_VALUE_CONTRACT_INVALID';
  error.key = key;
  return error;
}

function requireClseSettingValue(key, value) {
  if (key === CLSE_FEATURE_FLAG_KEY) {
    if (typeof value !== 'boolean') throw createClseSettingsContractError(key);
    return value;
  }
  if (key === CLSE_SENSITIVITY_SCALE_KEY) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw createClseSettingsContractError(key);
    }
    return value;
  }
  if (key === CLSE_ALERT_COOLDOWN_KEY) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw createClseSettingsContractError(key);
    }
    return value;
  }
  return value;
}

function resolveBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function extractFeatureFlagFromCoreDocument(documentValue) {
  if (!documentValue || typeof documentValue !== 'object' || Array.isArray(documentValue)) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(documentValue, CLSE_FEATURE_FLAG_KEY)) {
    return null;
  }
  return requireClseSettingValue(
    CLSE_FEATURE_FLAG_KEY,
    documentValue[CLSE_FEATURE_FLAG_KEY],
  );
}

export class ClseSettingsStore {
  static getInstance() {
    if (!ClseSettingsStore.instance) {
      ClseSettingsStore.instance = new ClseSettingsStore();
    }
    return ClseSettingsStore.instance;
  }

  constructor({
    settingsStore = SettingsStore.getInstance(),
  } = {}) {
    this.settingsStore = settingsStore;
  }

  async getFeatureEnabled(fallback = false) {
    const normalizedFallback = resolveBoolean(fallback, false);
    const snapshot = await this.getSnapshot({
      [CLSE_FEATURE_FLAG_KEY]: normalizedFallback,
    });
    return snapshot[CLSE_FEATURE_FLAG_KEY];
  }

  async setFeatureEnabled(enabled) {
    const normalized = requireClseSettingValue(CLSE_FEATURE_FLAG_KEY, enabled);
    await this.settingsStore.set({
      [CLSE_FEATURE_FLAG_KEY]: normalized,
    });
    return normalized;
  }

  async getSnapshot(defaults = {}) {
    const requested = defaults && typeof defaults === 'object' && !Array.isArray(defaults)
      ? { ...defaults }
      : {};
    const snapshot = await this.settingsStore.get(requested);
    Object.keys(requested).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(snapshot || {}, key)) {
        requireClseSettingValue(key, snapshot[key]);
      }
    });
    return snapshot;
  }

  subscribeSnapshot(listener, { emitCurrent = false, defaults = {} } = {}) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    const requested = defaults && typeof defaults === 'object' && !Array.isArray(defaults)
      ? { ...defaults }
      : {};
    const requestedKeys = new Set(Object.keys(requested));
    const relevantKeys = new Set([
      CLSE_FEATURE_FLAG_KEY,
      CLSE_SENSITIVITY_SCALE_KEY,
      CLSE_ALERT_COOLDOWN_KEY,
    ]);

    const projectSnapshot = (source = {}) => {
      const patch = {};
      Object.keys(requested).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          patch[key] = source[key];
        } else {
          patch[key] = requested[key];
        }
      });
      return patch;
    };

    const handleStorageChange = (changes = {}, areaName) => {
      if (areaName !== 'local') return;

      const patch = {};
      if (changes?.[STORAGE_LOCAL_DOC_KEYS.CORE]?.newValue) {
        const nextCoreDocument = changes[STORAGE_LOCAL_DOC_KEYS.CORE].newValue;
        relevantKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(nextCoreDocument, key)) {
            patch[key] = requireClseSettingValue(key, nextCoreDocument[key]);
          }
        });
      }

      if (!Object.keys(patch).some((key) => requestedKeys.has(key))) return;
      listener(projectSnapshot(patch));
    };

    addChromeStorageChangedListener(handleStorageChange);

    if (emitCurrent) {
      void this.getSnapshot(requested)
        .then((snapshot) => listener(projectSnapshot(snapshot)))
        .catch((error) => {
          console.error('[clse] Failed to hydrate CLSE settings snapshot from storage.', error);
        });
    }

    return () => {
      removeChromeStorageChangedListener(handleStorageChange);
    };
  }

  subscribeFeatureEnabled(listener, { emitCurrent = false, fallback = false } = {}) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    const normalizedFallback = resolveBoolean(fallback, false);
    const handleStorageChange = (changes = {}, areaName) => {
      if (areaName !== 'local') return;

      if (changes?.[STORAGE_LOCAL_DOC_KEYS.CORE]) {
        const nextValue = extractFeatureFlagFromCoreDocument(
          changes[STORAGE_LOCAL_DOC_KEYS.CORE]?.newValue,
        );
        const previousValue = extractFeatureFlagFromCoreDocument(
          changes[STORAGE_LOCAL_DOC_KEYS.CORE]?.oldValue,
        );
        if (nextValue !== null || previousValue !== null) {
          listener(nextValue ?? normalizedFallback);
        }
        return;
      }

    };

    addChromeStorageChangedListener(handleStorageChange);

    if (emitCurrent) {
      void this.getFeatureEnabled(normalizedFallback)
        .then((enabled) => listener(enabled))
        .catch((error) => {
          console.error('[clse] Failed to hydrate CLSE feature flag from storage.', error);
        });
    }

    return () => {
      removeChromeStorageChangedListener(handleStorageChange);
    };
  }
}

export default ClseSettingsStore;
