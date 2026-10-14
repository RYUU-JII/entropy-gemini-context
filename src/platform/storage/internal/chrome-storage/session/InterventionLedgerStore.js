import RuntimeSessionStore from '../stores/RuntimeSessionStore.js';
import {
  resolveSessionStorageKey,
  STORAGE_SESSION_KEYS,
} from '../storageKeyRegistry.js';

const ALLOWED_INTERVENTION_LEDGER_KEYS = new Set([
  STORAGE_SESSION_KEYS.INTERVENTION_LEDGER,
]);

function isAllowedInterventionLedgerKey(key) {
  const canonicalKey = resolveSessionStorageKey(key);
  return !!canonicalKey && ALLOWED_INTERVENTION_LEDGER_KEYS.has(canonicalKey);
}

function filterDefaults(defaults = {}) {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return {};
  return Object.entries(defaults).reduce((acc, [key, value]) => {
    if (isAllowedInterventionLedgerKey(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function filterKeys(keys) {
  const sourceKeys = Array.isArray(keys) ? keys : [keys];
  return sourceKeys.filter((key) => isAllowedInterventionLedgerKey(key));
}

export class InterventionLedgerStore {
  static getInstance() {
    if (!InterventionLedgerStore.instance) {
      InterventionLedgerStore.instance = new InterventionLedgerStore();
    }
    return InterventionLedgerStore.instance;
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

export default InterventionLedgerStore;
