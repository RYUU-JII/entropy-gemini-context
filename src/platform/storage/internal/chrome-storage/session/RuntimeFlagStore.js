import RuntimeSessionStore from '../stores/RuntimeSessionStore.js';
import {
  resolveSessionStorageKey,
  STORAGE_SESSION_KEYS,
} from '../storageKeyRegistry.js';

const ALLOWED_RUNTIME_FLAG_KEYS = new Set([
  STORAGE_SESSION_KEYS.GLOBAL_CAP_STATE,
  STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME,
  STORAGE_SESSION_KEYS.SCHEDULE_STATE,
  STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP,
  STORAGE_SESSION_KEYS.SPECIAL_SESSION,
]);

function isAllowedRuntimeFlagKey(key) {
  const canonicalKey = resolveSessionStorageKey(key);
  return !!canonicalKey && ALLOWED_RUNTIME_FLAG_KEYS.has(canonicalKey);
}

function filterDefaults(defaults = {}) {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return {};
  return Object.entries(defaults).reduce((acc, [key, value]) => {
    if (isAllowedRuntimeFlagKey(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function filterKeys(keys) {
  const sourceKeys = Array.isArray(keys) ? keys : [keys];
  return sourceKeys.filter((key) => isAllowedRuntimeFlagKey(key));
}

export class RuntimeFlagStore {
  static getInstance() {
    if (!RuntimeFlagStore.instance) {
      RuntimeFlagStore.instance = new RuntimeFlagStore();
    }
    return RuntimeFlagStore.instance;
  }

  constructor({ sessionStore = RuntimeSessionStore.getInstance() } = {}) {
    this.sessionStore = sessionStore;
  }

  get(defaults = {}) {
    const requestedDefaults = filterDefaults(defaults);
    if (!Object.keys(requestedDefaults).length) return Promise.resolve({});
    return this.sessionStore.get(requestedDefaults);
  }

  set(items = {}) {
    const payload = filterDefaults(items);
    if (!Object.keys(payload).length) return Promise.resolve();
    return this.sessionStore.set(payload);
  }

  remove(keys) {
    const removals = filterKeys(keys);
    if (!removals.length) return Promise.resolve();
    return this.sessionStore.remove(removals);
  }
}

export default RuntimeFlagStore;
