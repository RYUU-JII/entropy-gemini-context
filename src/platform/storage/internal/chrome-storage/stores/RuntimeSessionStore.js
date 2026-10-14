import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession,
} from '../sessionArea.js';
import {
  resolveSessionStorageKey,
} from '../storageKeyRegistry.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRequestedSessionKey(sessionKey) {
  const canonicalKey = resolveSessionStorageKey(sessionKey);
  if (canonicalKey) return canonicalKey;
  throw new Error('RUNTIME_SESSION_KEY_UNKNOWN');
}

function buildSessionGetDefaults(defaults = {}) {
  const requested = [];
  const queryDefaults = {};

  Object.entries(defaults).forEach(([requestedKey, fallback]) => {
    const storageKey = normalizeRequestedSessionKey(requestedKey);
    if (!storageKey) return;
    requested.push({ requestedKey, fallback, storageKey });
    queryDefaults[storageKey] = fallback;
  });

  return { requested, queryDefaults };
}

function resolveRequestedSessionValue(items = {}, storageKey, fallback) {
  if (storageKey && Object.prototype.hasOwnProperty.call(items || {}, storageKey)) {
    return items[storageKey];
  }
  return fallback;
}

export class RuntimeSessionStore {
  static getInstance() {
    if (!RuntimeSessionStore.instance) {
      RuntimeSessionStore.instance = new RuntimeSessionStore();
    }
    return RuntimeSessionStore.instance;
  }

  async get(defaults = {}) {
    const requestedDefaults = isPlainObject(defaults) ? defaults : {};
    const { requested, queryDefaults } = buildSessionGetDefaults(requestedDefaults);
    if (!requested.length) return {};

    const items = await readChromeStorageSession(queryDefaults);
    const resolved = {};

    requested.forEach(({ requestedKey, fallback, storageKey }) => {
      resolved[requestedKey] = resolveRequestedSessionValue(items, storageKey, fallback);
    });

    return resolved;
  }

  async readOptional(sessionKey) {
    const storageKey = normalizeRequestedSessionKey(sessionKey);
    const items = await readChromeStorageSession([storageKey]);
    const found = Object.prototype.hasOwnProperty.call(items || {}, storageKey);
    return {
      found,
      value: found ? items[storageKey] : undefined,
    };
  }

  async set(items = {}) {
    const payload = isPlainObject(items) ? items : {};
    const normalizedItems = {};

    Object.entries(payload).forEach(([requestedKey, value]) => {
      const storageKey = normalizeRequestedSessionKey(requestedKey);
      if (!storageKey) return;
      normalizedItems[storageKey] = value;
    });

    if (Object.keys(normalizedItems).length === 0) return;

    await writeChromeStorageSession(normalizedItems);
  }

  remove(keys) {
    const sourceKeys = Array.isArray(keys) ? keys : [keys];
    const removals = Array.from(new Set(
      sourceKeys.flatMap((requestedKey) => {
        const storageKey = normalizeRequestedSessionKey(requestedKey);
        if (!storageKey) return [];
        return [storageKey];
      })
    ));
    if (!removals.length) return Promise.resolve();
    return removeChromeStorageSession(removals);
  }
}

export default RuntimeSessionStore;
