import RuntimeSessionStore from '../stores/RuntimeSessionStore.js';
import {
  resolveSessionStorageKey,
  STORAGE_SESSION_KEYS,
} from '../storageKeyRegistry.js';

const ALLOWED_NUDGE_SESSION_KEYS = new Set([
  STORAGE_SESSION_KEYS.NUDGE_PENDING,
  STORAGE_SESSION_KEYS.NUDGE_DEBT,
  STORAGE_SESSION_KEYS.NUDGE_LEASE,
  STORAGE_SESSION_KEYS.NUDGE_TERMINAL,
  STORAGE_SESSION_KEYS.NUDGE_TERMINAL_OUTBOX,
  STORAGE_SESSION_KEYS.NUDGE_SHOWN,
  STORAGE_SESSION_KEYS.NUDGE_ACK,
]);

function isAllowedNudgeSessionKey(key) {
  const canonicalKey = resolveSessionStorageKey(key);
  return !!canonicalKey && ALLOWED_NUDGE_SESSION_KEYS.has(canonicalKey);
}

function filterDefaults(defaults = {}) {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return {};
  return Object.entries(defaults).reduce((acc, [key, value]) => {
    if (isAllowedNudgeSessionKey(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function filterKeys(keys) {
  const sourceKeys = Array.isArray(keys) ? keys : [keys];
  return sourceKeys.filter((key) => isAllowedNudgeSessionKey(key));
}

export class NudgeSessionStore {
  static getInstance() {
    if (!NudgeSessionStore.instance) {
      NudgeSessionStore.instance = new NudgeSessionStore();
    }
    return NudgeSessionStore.instance;
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

export default NudgeSessionStore;
