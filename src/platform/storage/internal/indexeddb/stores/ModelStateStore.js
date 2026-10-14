import DBManager from '../dbManager.js';
import { STORES } from '../dbConstants.js';
import { areValuesEqual, isPlainObject } from '../../storageValueUtils.js';
import {
  MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
  createModelStateProfileEpoch,
  normalizeModelStateProfileEpoch,
  requireModelStateProfileEpochId,
} from '../../../model/ProfileEpochContract.js';
import {
  PROFILE_COMPATIBILITY_RESET_REASONS,
  createProfileCompatibilityResetRequiredError,
} from '../../../model/ProfileCompatibilityContract.js';
import {
  ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY,
  requireZenBonsaiProfileAggregateStorageValue,
} from '../../../themes/zen/ZenBonsaiProfileAggregateStorageContract.js';
import {
  ZEN_THEME_MODEL_STATE_KEYS,
  requireZenThemeModelStateValue,
} from '../../../themes/zen/ZenThemeModelStateContract.js';

export const MODEL_STATE_CAS_OUTCOMES = Object.freeze({
  COMMITTED: 'committed',
  VERIFIED: 'verified',
  CONFLICT: 'conflict',
});

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const MODEL_STATE_RECORD_KEYS = Object.freeze(['key', 'value', 'updatedAt']);
const PROFILE_AGGREGATE_KEY = ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY;
const KOI_ROSTER_MEMORY_KEY = ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY;

const isStateRevision = (value) => Number.isSafeInteger(value) && value >= 0;

const requireModelStateKey = (key, errorCode = 'MODEL_STATE_KEY_INVALID') => {
  if (typeof key !== 'string' || !key || key.trim() !== key) {
    throw new Error(errorCode);
  }
  return key;
};

const requireFeatureModelStateKey = (key, errorCode = 'MODEL_STATE_KEY_INVALID') => {
  const normalized = requireModelStateKey(key, errorCode);
  if (normalized === MODEL_STATE_PROFILE_EPOCH_ROW_KEY) {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_ROW_RESERVED');
  }
  return normalized;
};

const requireGenericMutableModelStateKey = (
  key,
  errorCode = 'MODEL_STATE_KEY_INVALID',
) => {
  const normalized = requireFeatureModelStateKey(key, errorCode);
  if (normalized === PROFILE_AGGREGATE_KEY) {
    throw new Error('MODEL_STATE_PROFILE_AGGREGATE_TYPED_MUTATION_REQUIRED');
  }
  return normalized;
};

const requireStoredModelStateRecord = (
  entry,
  { expectedKey = null, errorCode = 'MODEL_STATE_RECORD_CONTRACT_INVALID' } = {},
) => {
  if (!isPlainObject(entry)) throw new Error(errorCode);
  const keys = Object.keys(entry);
  if (
    keys.length !== MODEL_STATE_RECORD_KEYS.length
    || MODEL_STATE_RECORD_KEYS.some((key) => !hasOwn(entry, key))
  ) throw new Error(errorCode);
  const key = requireModelStateKey(entry.key, errorCode);
  if (expectedKey !== null && key !== expectedKey) throw new Error(errorCode);
  if (entry.value === null || typeof entry.value === 'undefined') throw new Error(errorCode);
  if (!Number.isSafeInteger(entry.updatedAt) || entry.updatedAt < 0) throw new Error(errorCode);
  return entry;
};

const requireProfileAggregate = (value, profileEpoch, errorCode) => {
  let aggregate;
  try {
    aggregate = requireZenBonsaiProfileAggregateStorageValue(value);
  } catch (cause) {
    const error = new Error(errorCode);
    error.cause = cause;
    throw error;
  }
  if (aggregate.profileEpoch !== profileEpoch) {
    throw new Error(`${errorCode}_EPOCH_MISMATCH`);
  }
  return aggregate;
};

const requireProfileGenerationInitializeOptions = (options, profileEpoch) => {
  if (!isPlainObject(options)) {
    throw new Error('MODEL_STATE_PROFILE_GENERATION_INITIALIZE_OPTIONS_REQUIRED');
  }
  const optionKeys = Object.keys(options);
  if (optionKeys.length !== 1 || optionKeys[0] !== 'profileAggregate') {
    throw new Error('MODEL_STATE_PROFILE_GENERATION_INITIALIZE_OPTIONS_INVALID');
  }
  return requireProfileAggregate(
    options.profileAggregate,
    profileEpoch,
    'MODEL_STATE_PROFILE_GENERATION_INITIALIZE_AGGREGATE_INVALID',
  );
};

const requireProfileEpochResetInitialEntries = (options, profileEpoch) => {
  if (!isPlainObject(options)) {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_RESET_OPTIONS_REQUIRED');
  }
  const optionKeys = Object.keys(options);
  if (optionKeys.length !== 1 || optionKeys[0] !== 'initialEntries') {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_RESET_OPTIONS_INVALID');
  }
  if (!Array.isArray(options.initialEntries) || options.initialEntries.length !== 1) {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_RESET_EXACT_AGGREGATE_REQUIRED');
  }
  return options.initialEntries.map((entry) => {
    if (
      !isPlainObject(entry)
      || Object.keys(entry).length !== 2
      || !hasOwn(entry, 'key')
      || !hasOwn(entry, 'value')
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_RESET_INITIAL_ENTRY_INVALID');
    }
    const key = requireFeatureModelStateKey(
      entry.key,
      'MODEL_STATE_PROFILE_EPOCH_RESET_INITIAL_ENTRY_INVALID',
    );
    if (key !== PROFILE_AGGREGATE_KEY) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_RESET_EXACT_AGGREGATE_REQUIRED');
    }
    return Object.freeze({
      key,
      value: requireProfileAggregate(
        entry.value,
        profileEpoch,
        'MODEL_STATE_PROFILE_EPOCH_RESET_AGGREGATE_INVALID',
      ),
    });
  });
};

const requireExpectedStateRevision = (options) => {
  if (!hasOwn(options, 'expectedRevision')) {
    throw new Error('MODEL_STATE_CAS_EXPECTED_REVISION_REQUIRED');
  }
  const revision = options.expectedRevision;
  if (revision !== null && !isStateRevision(revision)) {
    throw new Error('MODEL_STATE_CAS_EXPECTED_REVISION_INVALID');
  }
  return revision;
};

const readCurrentStateRevision = (value) => {
  if (value === null) return null;
  if (!isPlainObject(value) || !hasOwn(value, 'stateRevision') || !isStateRevision(value.stateRevision)) {
    throw new Error('MODEL_STATE_CAS_CURRENT_REVISION_INVALID');
  }
  return value.stateRevision;
};

const requirePreparedNextValue = (value, expectedRevision) => {
  if (!isPlainObject(value)) {
    throw new Error('MODEL_STATE_CAS_NEXT_VALUE_REQUIRED');
  }
  if (!hasOwn(value, 'stateRevision') || !isStateRevision(value.stateRevision)) {
    throw new Error('MODEL_STATE_CAS_NEXT_REVISION_INVALID');
  }
  if (expectedRevision !== null && value.stateRevision <= expectedRevision) {
    throw new Error('MODEL_STATE_CAS_NEXT_REVISION_MUST_ADVANCE');
  }
  return value;
};

const createCompareAndSetResult = ({
  outcome,
  expectedRevision,
  observedRevision,
  latestRevision,
  latestValue,
}) => Object.freeze({
  outcome,
  matched: outcome !== MODEL_STATE_CAS_OUTCOMES.CONFLICT,
  written: outcome === MODEL_STATE_CAS_OUTCOMES.COMMITTED,
  expectedRevision,
  observedRevision,
  latestRevision,
  latestValue,
});

const createProfileEpochCompareAndSetResult = ({
  expectedProfileEpoch,
  observedProfileEpoch,
  latestProfileEpoch,
  ...casResult
}) => Object.freeze({
  ...createCompareAndSetResult(casResult),
  expectedProfileEpoch,
  observedProfileEpoch,
  latestProfileEpoch,
});

const requireExpectedProfileEpoch = (options) => {
  if (!hasOwn(options, 'expectedProfileEpoch')) {
    throw new Error('MODEL_STATE_CAS_EXPECTED_PROFILE_EPOCH_REQUIRED');
  }
  return options.expectedProfileEpoch === null
    ? null
    : requireModelStateProfileEpochId(
      options.expectedProfileEpoch,
      'MODEL_STATE_CAS_EXPECTED_PROFILE_EPOCH_INVALID',
    );
};

const readStoredProfileEpoch = (entry) => {
  if (entry === null || typeof entry === 'undefined') return null;
  const record = requireStoredModelStateRecord(entry, {
    expectedKey: MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
    errorCode: 'MODEL_STATE_PROFILE_EPOCH_RECORD_INVALID',
  });
  return normalizeModelStateProfileEpoch(record.value).profileEpoch;
};

const requireNextValueProfileEpoch = (nextValue, expectedProfileEpoch) => {
  if (!hasOwn(nextValue, 'profileEpoch')) {
    throw new Error('MODEL_STATE_CAS_NEXT_PROFILE_EPOCH_REQUIRED');
  }
  const nextProfileEpoch = requireModelStateProfileEpochId(
    nextValue.profileEpoch,
    'MODEL_STATE_CAS_NEXT_PROFILE_EPOCH_INVALID',
  );
  if (
    expectedProfileEpoch !== null
    && nextProfileEpoch !== expectedProfileEpoch
  ) {
    throw new Error('MODEL_STATE_CAS_NEXT_PROFILE_EPOCH_MISMATCH');
  }
  return nextProfileEpoch;
};

const createProfileEpochStaleError = ({ expectedProfileEpoch, observedProfileEpoch }) => {
  const error = new Error('MODEL_STATE_PROFILE_EPOCH_STALE');
  error.code = 'MODEL_STATE_PROFILE_EPOCH_STALE';
  error.expectedProfileEpoch = expectedProfileEpoch;
  error.observedProfileEpoch = observedProfileEpoch;
  return error;
};

const createProfileEpochBootstrapResetRequiredError = () => {
  return createProfileCompatibilityResetRequiredError({
    observedBaseline: null,
    reason: PROFILE_COMPATIBILITY_RESET_REASONS.PROFILE_HEADER_MISSING,
  });
};

const createProfileGenerationNotInitializedError = () => {
  const error = new Error('MODEL_STATE_PROFILE_GENERATION_NOT_INITIALIZED');
  error.code = 'MODEL_STATE_PROFILE_GENERATION_NOT_INITIALIZED';
  return error;
};

const requireInstalledProfileEpoch = ({
  expectedProfileEpoch,
  observedProfileEpoch,
  storedRecordCount,
  aggregateEntry,
  rejectStale = true,
}) => {
  if (observedProfileEpoch === null) {
    if (storedRecordCount !== 0) {
      throw createProfileEpochBootstrapResetRequiredError();
    }
    throw createProfileGenerationNotInitializedError();
  }
  if (aggregateEntry === null || typeof aggregateEntry === 'undefined') {
    throw new Error('MODEL_STATE_PROFILE_GENERATION_AGGREGATE_MISSING');
  }
  const aggregate = requireStoredModelStateRecord(aggregateEntry, {
    expectedKey: PROFILE_AGGREGATE_KEY,
    errorCode: 'MODEL_STATE_PROFILE_GENERATION_AGGREGATE_RECORD_INVALID',
  }).value;
  requireProfileAggregate(
    aggregate,
    observedProfileEpoch,
    'MODEL_STATE_PROFILE_GENERATION_EXISTING_AGGREGATE_INVALID',
  );
  if (rejectStale && !Object.is(observedProfileEpoch, expectedProfileEpoch)) {
    throw createProfileEpochStaleError({
      expectedProfileEpoch,
      observedProfileEpoch,
    });
  }
  return observedProfileEpoch;
};

export class ModelStateStore {
  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  static getInstance() {
    if (!ModelStateStore.instance) {
      ModelStateStore.instance = new ModelStateStore();
    }
    return ModelStateStore.instance;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('MODEL_STATE_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async getEntries(keys = []) {
    void keys;
    throw new Error('MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN');
  }

  async getEntriesWithProfileEpoch(keys = [], options = null) {
    if (!Array.isArray(keys)) throw new Error('MODEL_STATE_KEYS_INVALID');
    if (!isPlainObject(options)) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_READ_OPTIONS_REQUIRED');
    }
    const expectedProfileEpoch = requireExpectedProfileEpoch(options);
    const list = Array.from(new Set(keys.map((key) => requireFeatureModelStateKey(key))));
    if (!list.length) {
      return Object.freeze({ entries: Object.freeze({}), profileEpoch: expectedProfileEpoch });
    }

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readonly');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const profileAggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const recordCountRequest = store.count();
      const entryRequests = list.map((key) => ({ key, request: store.get(key) }));
      const result = {};
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      epochRequest.onsuccess = () => undefined;
      epochRequest.onerror = () => rejectOnce(epochRequest.error);
      profileAggregateRequest.onsuccess = () => undefined;
      profileAggregateRequest.onerror = () => rejectOnce(profileAggregateRequest.error);
      recordCountRequest.onsuccess = () => undefined;
      recordCountRequest.onerror = () => rejectOnce(recordCountRequest.error);
      entryRequests.forEach(({ key, request }) => {
        request.onsuccess = () => {
          try {
            const entry = request.result;
            if (entry !== null && typeof entry !== 'undefined') {
              result[key] = requireStoredModelStateRecord(entry, { expectedKey: key }).value;
            }
          } catch (error) {
            rejectOnce(error);
          }
        };
        request.onerror = () => rejectOnce(request.error);
      });
      tx.oncomplete = () => {
        if (settled) return;
        try {
          const profileEpoch = requireInstalledProfileEpoch({
            expectedProfileEpoch,
            observedProfileEpoch: readStoredProfileEpoch(epochRequest.result),
            storedRecordCount: recordCountRequest.result,
            aggregateEntry: profileAggregateRequest.result,
          });
          settled = true;
          resolve(Object.freeze({
            entries: Object.freeze({ ...result }),
            profileEpoch,
          }));
        } catch (error) {
          rejectOnce(error);
        }
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => {
        if (!settled) rejectOnce(tx.error || new Error('MODEL_STATE_PROFILE_EPOCH_READ_ABORTED'));
      };
    });
  }

  async getWithProfileEpoch(defaults = {}, options = null) {
    const requested = isPlainObject(defaults) ? defaults : {};
    const keys = Object.keys(requested);
    if (!keys.length) return {};
    const snapshot = await this.getEntriesWithProfileEpoch(keys, options);
    const resolved = {};
    keys.forEach((key) => {
      resolved[key] = Object.prototype.hasOwnProperty.call(snapshot.entries, key)
        ? snapshot.entries[key]
        : requested[key];
    });
    return resolved;
  }

  async initializeProfileGeneration(profileEpoch, options = null) {
    const requiredProfileEpoch = requireModelStateProfileEpochId(
      profileEpoch,
      'MODEL_STATE_PROFILE_GENERATION_INITIALIZE_EPOCH_INVALID',
    );
    const profileAggregate = requireProfileGenerationInitializeOptions(
      options,
      requiredProfileEpoch,
    );
    const koiRosterMemory = requireZenThemeModelStateValue(KOI_ROSTER_MEMORY_KEY, {});
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readwrite');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const aggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const koiRosterMemoryRequest = store.get(KOI_ROSTER_MEMORY_KEY);
      const recordCountRequest = store.count();
      let epochReady = false;
      let aggregateReady = false;
      let koiRosterMemoryReady = false;
      let recordCountReady = false;
      let result;
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error) => {
        try {
          tx.abort();
        } catch {
          // The transaction may already be aborting after validation failed.
        }
        rejectOnce(error);
      };
      const initializeWhenReady = () => {
        if (
          settled
          || result !== undefined
            || !epochReady
            || !aggregateReady
            || !koiRosterMemoryReady
          || !recordCountReady
        ) return;
        try {
          const epochEntry = epochRequest.result;
          const aggregateEntry = aggregateRequest.result;
          const observedProfileEpoch = readStoredProfileEpoch(epochEntry);
          const storedRecordCount = recordCountRequest.result;
          if (storedRecordCount === 0) {
            if (
              observedProfileEpoch !== null
              || (aggregateEntry !== null && typeof aggregateEntry !== 'undefined')
            ) {
              throw createProfileEpochBootstrapResetRequiredError();
            }
            const updatedAt = Date.now();
            store.put({
              key: MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
              value: createModelStateProfileEpoch(requiredProfileEpoch),
              updatedAt,
            });
            store.put(requireStoredModelStateRecord({
              key: PROFILE_AGGREGATE_KEY,
              value: profileAggregate,
              updatedAt,
            }));
            store.put(requireStoredModelStateRecord({
              key: KOI_ROSTER_MEMORY_KEY,
              value: koiRosterMemory,
              updatedAt,
            }));
            result = profileAggregate;
            return;
          }
          if (observedProfileEpoch === null) {
            throw createProfileEpochBootstrapResetRequiredError();
          }
          if (aggregateEntry === null || typeof aggregateEntry === 'undefined') {
            throw new Error('MODEL_STATE_PROFILE_GENERATION_AGGREGATE_MISSING');
          }
          const existingAggregate = requireStoredModelStateRecord(aggregateEntry, {
            expectedKey: PROFILE_AGGREGATE_KEY,
            errorCode: 'MODEL_STATE_PROFILE_GENERATION_AGGREGATE_RECORD_INVALID',
          }).value;
          requireProfileAggregate(
            existingAggregate,
            observedProfileEpoch,
            'MODEL_STATE_PROFILE_GENERATION_EXISTING_AGGREGATE_INVALID',
          );
          const existingKoiRosterMemory = koiRosterMemoryRequest.result;
          if (existingKoiRosterMemory === null || typeof existingKoiRosterMemory === 'undefined') {
            store.put(requireStoredModelStateRecord({
              key: KOI_ROSTER_MEMORY_KEY,
              value: koiRosterMemory,
              updatedAt: Date.now(),
            }));
          } else {
            requireZenThemeModelStateValue(
              KOI_ROSTER_MEMORY_KEY,
              requireStoredModelStateRecord(existingKoiRosterMemory, {
                expectedKey: KOI_ROSTER_MEMORY_KEY,
                errorCode: 'MODEL_STATE_PROFILE_GENERATION_KOI_ROSTER_RECORD_INVALID',
              }).value,
            );
          }
          if (!Object.is(observedProfileEpoch, requiredProfileEpoch)) {
            throw createProfileEpochStaleError({
              expectedProfileEpoch: requiredProfileEpoch,
              observedProfileEpoch,
            });
          }
          result = existingAggregate;
        } catch (error) {
          abortWith(error);
        }
      };

      epochRequest.onsuccess = () => {
        epochReady = true;
        initializeWhenReady();
      };
      aggregateRequest.onsuccess = () => {
        aggregateReady = true;
        initializeWhenReady();
      };
      koiRosterMemoryRequest.onsuccess = () => {
        koiRosterMemoryReady = true;
        initializeWhenReady();
      };
      recordCountRequest.onsuccess = () => {
        recordCountReady = true;
        initializeWhenReady();
      };
      epochRequest.onerror = () => abortWith(epochRequest.error);
      aggregateRequest.onerror = () => abortWith(aggregateRequest.error);
      koiRosterMemoryRequest.onerror = () => abortWith(koiRosterMemoryRequest.error);
      recordCountRequest.onerror = () => abortWith(recordCountRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => {
        if (!settled) rejectOnce(
          tx.error || new Error('MODEL_STATE_PROFILE_GENERATION_INITIALIZE_ABORTED'),
        );
      };
    });
  }

  async assertProfileGenerationInitialized(expectedProfileEpoch) {
    const requiredProfileEpoch = requireModelStateProfileEpochId(
      expectedProfileEpoch,
      'MODEL_STATE_PROFILE_GENERATION_ASSERT_EPOCH_INVALID',
    );
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readonly');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const aggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const recordCountRequest = store.count();
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      epochRequest.onsuccess = () => undefined;
      epochRequest.onerror = () => rejectOnce(epochRequest.error);
      aggregateRequest.onsuccess = () => undefined;
      aggregateRequest.onerror = () => rejectOnce(aggregateRequest.error);
      recordCountRequest.onsuccess = () => undefined;
      recordCountRequest.onerror = () => rejectOnce(recordCountRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        try {
          const profileEpoch = requireInstalledProfileEpoch({
            expectedProfileEpoch: requiredProfileEpoch,
            observedProfileEpoch: readStoredProfileEpoch(epochRequest.result),
            storedRecordCount: recordCountRequest.result,
            aggregateEntry: aggregateRequest.result,
          });
          const profileAggregate = requireStoredModelStateRecord(aggregateRequest.result, {
            expectedKey: PROFILE_AGGREGATE_KEY,
            errorCode: 'MODEL_STATE_PROFILE_GENERATION_AGGREGATE_RECORD_INVALID',
          }).value;
          settled = true;
          resolve(Object.freeze({ profileEpoch, profileAggregate }));
        } catch (error) {
          rejectOnce(error);
        }
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => {
        if (!settled) rejectOnce(
          tx.error || new Error('MODEL_STATE_PROFILE_GENERATION_ASSERT_ABORTED'),
        );
      };
    });
  }

  async setWithProfileEpoch(items = {}, options = null) {
    const payload = isPlainObject(items) ? items : {};
    if (!isPlainObject(options)) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_WRITE_OPTIONS_REQUIRED');
    }
    const expectedProfileEpoch = requireExpectedProfileEpoch(options);
    const keys = Object.keys(payload).map((key) => requireGenericMutableModelStateKey(key));
    if (!keys.length) return [];

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readwrite');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const profileAggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const recordCountRequest = store.count();
      const entryRequests = keys.map((key) => ({ key, request: store.get(key) }));
      let epochReady = false;
      let profileAggregateReady = false;
      let recordCountReady = false;
      let entriesReady = 0;
      let writesScheduled = false;
      let settled = false;
      let changedKeys = [];

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error) => {
        try {
          tx.abort();
        } catch {
          // The transaction may already be aborting after validation failed.
        }
        rejectOnce(error);
      };
      const scheduleWritesWhenReady = () => {
        if (
          settled
          || writesScheduled
          || !epochReady
          || !profileAggregateReady
          || !recordCountReady
          || entriesReady !== entryRequests.length
        ) {
          return;
        }
        try {
          const observedProfileEpoch = readStoredProfileEpoch(epochRequest.result);
          requireInstalledProfileEpoch({
            expectedProfileEpoch,
            observedProfileEpoch,
            storedRecordCount: recordCountRequest.result,
            aggregateEntry: profileAggregateRequest.result,
          });
          writesScheduled = true;
          const updatedAt = Date.now();
          changedKeys = entryRequests.reduce((changed, { key, request }) => {
            const currentEntry = request.result;
            const currentValue = currentEntry === null || typeof currentEntry === 'undefined'
              ? undefined
              : requireStoredModelStateRecord(currentEntry, { expectedKey: key }).value;
            const nextValue = payload[key];
            if (areValuesEqual(currentValue, nextValue)) return changed;
            changed.push(key);
            if (nextValue === undefined || nextValue === null) {
              store.delete(key);
            } else {
              store.put(requireStoredModelStateRecord({ key, value: nextValue, updatedAt }));
            }
            return changed;
          }, []);
        } catch (error) {
          abortWith(error);
        }
      };

      epochRequest.onsuccess = () => {
        epochReady = true;
        scheduleWritesWhenReady();
      };
      epochRequest.onerror = () => abortWith(epochRequest.error);
      profileAggregateRequest.onsuccess = () => {
        profileAggregateReady = true;
        scheduleWritesWhenReady();
      };
      profileAggregateRequest.onerror = () => abortWith(profileAggregateRequest.error);
      recordCountRequest.onsuccess = () => {
        recordCountReady = true;
        scheduleWritesWhenReady();
      };
      recordCountRequest.onerror = () => abortWith(recordCountRequest.error);
      entryRequests.forEach(({ request }) => {
        request.onsuccess = () => {
          entriesReady += 1;
          scheduleWritesWhenReady();
        };
        request.onerror = () => abortWith(request.error);
      });
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(changedKeys);
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => {
        if (!settled) rejectOnce(tx.error || new Error('MODEL_STATE_PROFILE_EPOCH_WRITE_ABORTED'));
      };
    });
  }

  async bootstrapValueWithProfileEpoch(key, initialValue, options = null) {
    const normalizedKey = requireGenericMutableModelStateKey(key);
    if (initialValue === null || typeof initialValue === 'undefined') {
      throw new Error('MODEL_STATE_BOOTSTRAP_VALUE_REQUIRED');
    }
    if (!isPlainObject(options)) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_BOOTSTRAP_OPTIONS_REQUIRED');
    }
    const expectedProfileEpoch = requireExpectedProfileEpoch(options);
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readwrite');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const profileAggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const recordCountRequest = store.count();
      const entryRequest = store.get(normalizedKey);
      let epochReady = false;
      let profileAggregateReady = false;
      let recordCountReady = false;
      let entryReady = false;
      let result;
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error) => {
        try {
          tx.abort();
        } catch {
          // The transaction may already be aborting after validation failed.
        }
        rejectOnce(error);
      };
      const bootstrapWhenReady = () => {
        if (
          settled
          || result !== undefined
          || !epochReady
          || !profileAggregateReady
          || !recordCountReady
          || !entryReady
        ) {
          return;
        }
        try {
          const observedProfileEpoch = readStoredProfileEpoch(epochRequest.result);
          requireInstalledProfileEpoch({
            expectedProfileEpoch,
            observedProfileEpoch,
            storedRecordCount: recordCountRequest.result,
            aggregateEntry: profileAggregateRequest.result,
          });
          const currentEntry = entryRequest.result;
          if (currentEntry !== null && typeof currentEntry !== 'undefined') {
            result = requireStoredModelStateRecord(currentEntry, {
              expectedKey: normalizedKey,
            }).value;
            return;
          }
          store.put({
            key: normalizedKey,
            value: initialValue,
            updatedAt: Date.now(),
          });
          result = initialValue;
        } catch (error) {
          abortWith(error);
        }
      };

      epochRequest.onsuccess = () => {
        epochReady = true;
        bootstrapWhenReady();
      };
      epochRequest.onerror = () => abortWith(epochRequest.error);
      profileAggregateRequest.onsuccess = () => {
        profileAggregateReady = true;
        bootstrapWhenReady();
      };
      profileAggregateRequest.onerror = () => abortWith(profileAggregateRequest.error);
      recordCountRequest.onsuccess = () => {
        recordCountReady = true;
        bootstrapWhenReady();
      };
      recordCountRequest.onerror = () => abortWith(recordCountRequest.error);
      entryRequest.onsuccess = () => {
        entryReady = true;
        bootstrapWhenReady();
      };
      entryRequest.onerror = () => abortWith(entryRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => {
        if (!settled) rejectOnce(
          tx.error || new Error('MODEL_STATE_PROFILE_EPOCH_BOOTSTRAP_ABORTED'),
        );
      };
    });
  }

  async putEntries(entries = []) {
    void entries;
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }

  async deleteEntries(keys = []) {
    void keys;
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }

  async compareAndSetEntry(key, options = null) {
    void key;
    void options;
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }

  async getEntryWithProfileEpoch(key, options = null) {
    const normalizedKey = requireFeatureModelStateKey(key);
    if (!isPlainObject(options)) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_READ_OPTIONS_REQUIRED');
    }
    const expectedProfileEpoch = requireExpectedProfileEpoch(options);
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readonly');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const entryRequest = store.get(normalizedKey);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const profileAggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const recordCountRequest = store.count();
      let entryReady = false;
      let epochReady = false;
      let profileAggregateReady = false;
      let recordCountReady = false;
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const resolveWhenReady = () => {
        if (
          settled
          || !entryReady
          || !epochReady
          || !profileAggregateReady
          || !recordCountReady
        ) return;
        try {
          const storedEntry = entryRequest.result;
          const found = storedEntry !== null && typeof storedEntry !== 'undefined';
          const value = found
            ? requireStoredModelStateRecord(storedEntry, {
              expectedKey: normalizedKey,
            }).value
            : null;
          const profileEpoch = requireInstalledProfileEpoch({
            expectedProfileEpoch,
            observedProfileEpoch: readStoredProfileEpoch(epochRequest.result),
            storedRecordCount: recordCountRequest.result,
            aggregateEntry: profileAggregateRequest.result,
          });
          settled = true;
          resolve(Object.freeze({ found, value, profileEpoch }));
        } catch (error) {
          rejectOnce(error);
        }
      };

      entryRequest.onsuccess = () => {
        entryReady = true;
        resolveWhenReady();
      };
      epochRequest.onsuccess = () => {
        epochReady = true;
        resolveWhenReady();
      };
      profileAggregateRequest.onsuccess = () => {
        profileAggregateReady = true;
        resolveWhenReady();
      };
      recordCountRequest.onsuccess = () => {
        recordCountReady = true;
        resolveWhenReady();
      };
      entryRequest.onerror = () => rejectOnce(entryRequest.error);
      epochRequest.onerror = () => rejectOnce(epochRequest.error);
      profileAggregateRequest.onerror = () => rejectOnce(profileAggregateRequest.error);
      recordCountRequest.onerror = () => rejectOnce(recordCountRequest.error);
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => rejectOnce(tx.error || new Error('MODEL_STATE_PROFILE_EPOCH_READ_ABORTED'));
    });
  }

  async compareAndSetEntryWithProfileEpoch(key, options = null) {
    const normalizedKey = requireFeatureModelStateKey(
      key,
      'MODEL_STATE_CAS_KEY_REQUIRED',
    );
    if (!isPlainObject(options)) {
      throw new Error('MODEL_STATE_CAS_OPTIONS_REQUIRED');
    }
    const expectedRevision = requireExpectedStateRevision(options);
    const expectedProfileEpoch = requireExpectedProfileEpoch(options);
    if (hasOwn(options, 'verifyOnly') && typeof options.verifyOnly !== 'boolean') {
      throw new Error('MODEL_STATE_CAS_VERIFY_ONLY_INVALID');
    }
    const verifyOnly = options.verifyOnly === true;
    if (hasOwn(options, 'assertCommitAllowed') && typeof options.assertCommitAllowed !== 'function') {
      throw new Error('MODEL_STATE_CAS_COMMIT_ADMISSION_INVALID');
    }
    if (verifyOnly && hasOwn(options, 'nextValue')) {
      throw new Error('MODEL_STATE_CAS_VERIFY_ONLY_NEXT_VALUE_FORBIDDEN');
    }
    const nextValue = verifyOnly
      ? null
      : requirePreparedNextValue(options.nextValue, expectedRevision);
    if (!verifyOnly) {
      requireNextValueProfileEpoch(nextValue, expectedProfileEpoch);
    }

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readwrite');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const entryRequest = store.get(normalizedKey);
      const epochRequest = store.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      const profileAggregateRequest = store.get(PROFILE_AGGREGATE_KEY);
      const recordCountRequest = store.count();
      let entryReady = false;
      let epochReady = false;
      let profileAggregateReady = false;
      let recordCountReady = false;
      let result = null;
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error) => {
        try {
          tx.abort();
        } catch {
          // The transaction may already be aborting because validation failed.
        }
        rejectOnce(error);
      };
      const compareAndWriteWhenReady = () => {
        if (
          settled
          || result !== null
          || !entryReady
          || !epochReady
          || !profileAggregateReady
          || !recordCountReady
        ) return;
        try {
          const currentEntry = entryRequest.result;
          const found = currentEntry !== null && typeof currentEntry !== 'undefined';
          const currentValue = found
            ? requireStoredModelStateRecord(currentEntry, {
              expectedKey: normalizedKey,
              errorCode: 'MODEL_STATE_CAS_CURRENT_REVISION_INVALID',
            }).value
            : null;
          const observedRevision = readCurrentStateRevision(currentValue);
          const observedProfileEpoch = readStoredProfileEpoch(epochRequest.result);
          requireInstalledProfileEpoch({
            expectedProfileEpoch,
            observedProfileEpoch,
            storedRecordCount: recordCountRequest.result,
            aggregateEntry: profileAggregateRequest.result,
            rejectStale: false,
          });
          if (
            !Object.is(observedProfileEpoch, expectedProfileEpoch)
            || !Object.is(observedRevision, expectedRevision)
          ) {
            result = createProfileEpochCompareAndSetResult({
              outcome: MODEL_STATE_CAS_OUTCOMES.CONFLICT,
              expectedRevision,
              observedRevision,
              latestRevision: observedRevision,
              latestValue: currentValue,
              expectedProfileEpoch,
              observedProfileEpoch,
              latestProfileEpoch: observedProfileEpoch,
            });
            return;
          }
          if (verifyOnly) {
            result = createProfileEpochCompareAndSetResult({
              outcome: MODEL_STATE_CAS_OUTCOMES.VERIFIED,
              expectedRevision,
              observedRevision,
              latestRevision: observedRevision,
              latestValue: currentValue,
              expectedProfileEpoch,
              observedProfileEpoch,
              latestProfileEpoch: observedProfileEpoch,
            });
            return;
          }

          // Purpose-specific admission is rechecked inside the transaction,
          // after database acquisition and reads, immediately before the write.
          if (options.assertCommitAllowed) {
            const admission = options.assertCommitAllowed();
            if (admission && typeof admission.then === 'function') {
              throw new Error('MODEL_STATE_CAS_COMMIT_ADMISSION_MUST_BE_SYNCHRONOUS');
            }
          }
          store.put({
            key: normalizedKey,
            value: nextValue,
            updatedAt: Date.now(),
          });
          result = createProfileEpochCompareAndSetResult({
            outcome: MODEL_STATE_CAS_OUTCOMES.COMMITTED,
            expectedRevision,
            observedRevision,
            latestRevision: nextValue.stateRevision,
            latestValue: nextValue,
            expectedProfileEpoch,
            observedProfileEpoch,
            latestProfileEpoch: observedProfileEpoch,
          });
        } catch (error) {
          abortWith(error);
        }
      };

      entryRequest.onsuccess = () => {
        entryReady = true;
        compareAndWriteWhenReady();
      };
      epochRequest.onsuccess = () => {
        epochReady = true;
        compareAndWriteWhenReady();
      };
      profileAggregateRequest.onsuccess = () => {
        profileAggregateReady = true;
        compareAndWriteWhenReady();
      };
      recordCountRequest.onsuccess = () => {
        recordCountReady = true;
        compareAndWriteWhenReady();
      };
      entryRequest.onerror = () => abortWith(entryRequest.error);
      epochRequest.onerror = () => abortWith(epochRequest.error);
      profileAggregateRequest.onerror = () => abortWith(profileAggregateRequest.error);
      recordCountRequest.onerror = () => abortWith(recordCountRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => {
        if (!settled) rejectOnce(tx.error || new Error('MODEL_STATE_PROFILE_EPOCH_CAS_ABORTED'));
      };
    });
  }

  async get(defaults = {}) {
    void defaults;
    throw new Error('MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN');
  }

  async getAll() {
    throw new Error('MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN');
  }

  async set(items = {}) {
    void items;
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }

  async clear() {
    throw new Error('MODEL_STATE_PROFILE_GENERATION_RESET_REQUIRED');
  }

  async resetForProfileEpoch(resetId, options = null) {
    const profileEpoch = requireModelStateProfileEpochId(
      resetId,
      'MODEL_STATE_PROFILE_EPOCH_RESET_ID_INVALID',
    );
    const initialEntries = requireProfileEpochResetInitialEntries(options, profileEpoch);
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MODEL_STATE, 'readwrite');
      const store = tx.objectStore(STORES.MODEL_STATE);
      const clearRequest = store.clear();
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      clearRequest.onsuccess = () => {
        try {
          const updatedAt = Date.now();
          store.put({
            key: MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
            value: createModelStateProfileEpoch(profileEpoch),
            updatedAt,
          });
          initialEntries.forEach(({ key, value }) => {
            store.put(requireStoredModelStateRecord({ key, value, updatedAt }));
          });
          store.put(requireStoredModelStateRecord({
            key: KOI_ROSTER_MEMORY_KEY,
            value: requireZenThemeModelStateValue(KOI_ROSTER_MEMORY_KEY, {}),
            updatedAt,
          }));
        } catch (error) {
          try {
            tx.abort();
          } catch {
            // The transaction may already be aborting because the write failed.
          }
          rejectOnce(error);
        }
      };
      clearRequest.onerror = () => rejectOnce(clearRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => rejectOnce(tx.error || new Error('MODEL_STATE_PROFILE_EPOCH_RESET_ABORTED'));
    });
    return profileEpoch;
  }
}

export default ModelStateStore;
