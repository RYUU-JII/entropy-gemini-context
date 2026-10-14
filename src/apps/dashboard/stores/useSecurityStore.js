import { create } from 'zustand';

import {
  DEFAULT_SECURITY_SETTINGS,
  HIGH_SECURITY_MODE_KEY,
  MASTER_PASSCODE_KEY,
  RESET_GUARD_KEY,
  deriveDestructiveActionAuthPolicy,
  normalizeSecuritySettingsSnapshot,
  readSecuritySettings,
} from '../../../platform/storage/security/SecuritySettingsQueryService.js';
import {
  dispatchSecuritySettingsPatch,
} from './securitySettingsClient.js';

const DEFAULT_SECURITY_STATE = Object.freeze({
  masterPasscodeHash: DEFAULT_SECURITY_SETTINGS[MASTER_PASSCODE_KEY],
  requirePasscodeForReset: DEFAULT_SECURITY_SETTINGS[RESET_GUARD_KEY],
  highSecurityMode: DEFAULT_SECURITY_SETTINGS[HIGH_SECURITY_MODE_KEY],
});

let initializePromise = null;
const pendingSecurityMutationsByKey = new Map();
const SECURITY_STATE_FIELD_BY_KEY = Object.freeze({
  [MASTER_PASSCODE_KEY]: 'masterPasscodeHash',
  [RESET_GUARD_KEY]: 'requirePasscodeForReset',
  [HIGH_SECURITY_MODE_KEY]: 'highSecurityMode',
});
const securityCommitRevisionsByKey = new Map(
  Object.keys(SECURITY_STATE_FIELD_BY_KEY).map((key) => [key, 0]),
);
let nextSecurityReadRequestId = 0;
let latestSecurityReadRequestId = 0;

function normalizeMasterPasscodeHash(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeResetGuard(value) {
  return value !== false;
}

function beginSecuritySettingsRead() {
  const requestId = ++nextSecurityReadRequestId;
  latestSecurityReadRequestId = requestId;
  return {
    requestId,
    commitRevisions: Object.fromEntries(
      Object.keys(SECURITY_STATE_FIELD_BY_KEY).map((key) => [
        key,
        securityCommitRevisionsByKey.get(key) || 0,
      ]),
    ),
  };
}

function markSecuritySettingCommitted(key) {
  securityCommitRevisionsByKey.set(key, (securityCommitRevisionsByKey.get(key) || 0) + 1);
}

function applySecurityReadSnapshot(set, get, snapshot, readContext) {
  const security = normalizeSecuritySettingsSnapshot(snapshot);
  if (readContext?.requestId !== latestSecurityReadRequestId) {
    return readCommittedSecurityState(get());
  }

  const nextState = {};
  Object.entries(SECURITY_STATE_FIELD_BY_KEY).forEach(([key, field]) => {
    if (
      (securityCommitRevisionsByKey.get(key) || 0)
      === (readContext?.commitRevisions?.[key] || 0)
    ) {
      nextState[field] = security[field];
    }
  });

  set((state) => ({
    ...state,
    ...nextState,
    loaded: true,
  }));

  return readCommittedSecurityState(get());
}

function readCommittedSecurityState(state) {
  return normalizeSecuritySettingsSnapshot(state || {});
}

function runCommittedSecurityMutation({ key, requestedValue, execute }) {
  const pendingMutation = pendingSecurityMutationsByKey.get(key);
  if (pendingMutation && Object.is(pendingMutation.requestedValue, requestedValue)) {
    return pendingMutation.promise;
  }

  const promise = Promise.resolve().then(execute);
  pendingSecurityMutationsByKey.set(key, {
    requestedValue,
    promise,
  });

  const clearIfCurrent = () => {
    if (pendingSecurityMutationsByKey.get(key)?.promise === promise) {
      pendingSecurityMutationsByKey.delete(key);
    }
  };
  void promise.then(clearIfCurrent, clearIfCurrent);
  return promise;
}

export const useSecurityStore = create((set, get) => ({
  ...DEFAULT_SECURITY_STATE,
  loaded: false,

  initialize: async () => {
    if (get().loaded) return readCommittedSecurityState(get());
    if (initializePromise) return initializePromise;

    const readContext = beginSecuritySettingsRead();
    initializePromise = (async () => {
      const snapshot = await readSecuritySettings();
      return applySecurityReadSnapshot(set, get, snapshot, readContext);
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },

  refreshSecuritySettings: async () => {
    const readContext = beginSecuritySettingsRead();
    const snapshot = await readSecuritySettings();
    return applySecurityReadSnapshot(set, get, snapshot, readContext);
  },

  setMasterPasscodeHash: async (nextHash, authorization = null) => {
    const requested = normalizeMasterPasscodeHash(nextHash);
    const pendingMutation = pendingSecurityMutationsByKey.get(MASTER_PASSCODE_KEY);
    const committed = readCommittedSecurityState(get());
    if (!pendingMutation && committed.masterPasscodeHash === requested) {
      return committed.masterPasscodeHash;
    }

    return runCommittedSecurityMutation({
      key: MASTER_PASSCODE_KEY,
      requestedValue: requested,
      execute: async () => {
        const result = await dispatchSecuritySettingsPatch(
          { [MASTER_PASSCODE_KEY]: requested },
          [MASTER_PASSCODE_KEY],
          authorization,
        );
        const committedValue = normalizeSecuritySettingsSnapshot({
          [MASTER_PASSCODE_KEY]: result.patch[MASTER_PASSCODE_KEY],
        }).masterPasscodeHash;

        markSecuritySettingCommitted(MASTER_PASSCODE_KEY);
        set((state) => ({
          ...state,
          masterPasscodeHash: committedValue,
          loaded: true,
        }));

        return committedValue;
      },
    });
  },

  clearMasterPasscodeHash: async (authorization = null) => {
    return get().setMasterPasscodeHash('', authorization);
  },

  setRequirePasscodeForReset: async (nextValue, authorization = null) => {
    const requested = normalizeResetGuard(nextValue);
    const pendingMutation = pendingSecurityMutationsByKey.get(RESET_GUARD_KEY);
    const committed = readCommittedSecurityState(get());
    if (!pendingMutation && committed.requirePasscodeForReset === requested) {
      return committed.requirePasscodeForReset;
    }

    return runCommittedSecurityMutation({
      key: RESET_GUARD_KEY,
      requestedValue: requested,
      execute: async () => {
        const result = await dispatchSecuritySettingsPatch(
          { [RESET_GUARD_KEY]: requested },
          [RESET_GUARD_KEY],
          authorization,
        );
        const committedValue = normalizeSecuritySettingsSnapshot({
          [RESET_GUARD_KEY]: result.patch[RESET_GUARD_KEY],
        }).requirePasscodeForReset;

        markSecuritySettingCommitted(RESET_GUARD_KEY);
        set((state) => ({
          ...state,
          requirePasscodeForReset: committedValue,
          loaded: true,
        }));

        return committedValue;
      },
    });
  },

  setHighSecurityMode: async (nextValue, authorization = null) => {
    const requested = nextValue === true;
    const pendingMutation = pendingSecurityMutationsByKey.get(HIGH_SECURITY_MODE_KEY);
    const committed = readCommittedSecurityState(get());
    if (!pendingMutation && committed.highSecurityMode === requested) {
      return committed.highSecurityMode;
    }

    return runCommittedSecurityMutation({
      key: HIGH_SECURITY_MODE_KEY,
      requestedValue: requested,
      execute: async () => {
        const result = await dispatchSecuritySettingsPatch(
          { [HIGH_SECURITY_MODE_KEY]: requested },
          [HIGH_SECURITY_MODE_KEY],
          authorization,
        );
        const committedValue = normalizeSecuritySettingsSnapshot({
          [HIGH_SECURITY_MODE_KEY]: result.patch[HIGH_SECURITY_MODE_KEY],
        }).highSecurityMode;

        markSecuritySettingCommitted(HIGH_SECURITY_MODE_KEY);
        set((state) => ({
          ...state,
          highSecurityMode: committedValue,
          loaded: true,
        }));

        return committedValue;
      },
    });
  },

  getDestructiveActionAuthPolicy: async () => {
    if (!get().loaded) {
      await get().initialize();
    }

    return deriveDestructiveActionAuthPolicy(readCommittedSecurityState(get()));
  },
}));

export default useSecurityStore;
