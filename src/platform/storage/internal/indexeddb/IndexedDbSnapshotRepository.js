import DBManager from './dbManager.js';
import ClseRepository from '../../clse/ClseRepository.js';
import {
  EXPORT_STORE_NAMES,
  EXPORT_STORE_TO_FIELD,
  STORES,
} from './dbConstants.js';
import {
  createEmptyExportSnapshot,
  preflightIndexedDbV1ImportSnapshot,
} from './dbImportSnapshot.js';
import {
  ZEN_THEME_MODEL_STATE_KEYS,
  requireZenThemeModelStateSnapshotValue,
} from '../../themes/zen/ZenThemeModelStateContract.js';
import {
  isModelStateDiscardableCacheKey,
  isModelStateSnapshotIncluded,
  rebaseModelStateSnapshotValue,
  readModelStateSnapshotProfileEpoch,
  requireModelStateSnapshotValue,
} from '../../model/ModelStateSnapshotContract.js';
import {
  FEED_TEMPO_PROFILE_CHECKPOINT_KEY,
} from '../../model/FeedTempoProfileCheckpointContract.js';
import {
  FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY,
} from '../../model/FeedTopologyCertificateCheckpointContract.js';
import {
  MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
  createModelStateProfileEpoch,
  normalizeModelStateProfileEpoch,
  requireModelStateProfileEpochId,
} from '../../model/ProfileEpochContract.js';

const PROFILE_AGGREGATE_KEY = ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE;
const MODEL_STATE_RECORD_KEYS = Object.freeze(['key', 'value', 'updatedAt']);

const isPlainObject = (value) => Boolean(
  value
  && typeof value === 'object'
  && !Array.isArray(value)
);

const requirePersistedModelStateRow = (row, { expectedKey = null } = {}) => {
  if (
    !isPlainObject(row)
    || Object.keys(row).length !== MODEL_STATE_RECORD_KEYS.length
    || MODEL_STATE_RECORD_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(row, key))
    || typeof row.key !== 'string'
    || !row.key
    || row.key.trim() !== row.key
    || (expectedKey !== null && row.key !== expectedKey)
    || row.value === null
    || typeof row.value === 'undefined'
    || !Number.isSafeInteger(row.updatedAt)
    || row.updatedAt < 0
  ) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_RECORD_INVALID');
  }
  return row;
};

const requirePersistedProfileEpochRow = (row) => {
  try {
    requirePersistedModelStateRow(row, {
      expectedKey: MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
    });
  } catch {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_ROW_INVALID');
  }
  return normalizeModelStateProfileEpoch(row.value).profileEpoch;
};

const requireUniquePersistedModelStateRowKeys = (rows) => {
  const seenKeys = new Set();
  rows.forEach((row) => {
    if (seenKeys.has(row.key)) {
      throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PRIMARY_KEY_DUPLICATE');
    }
    seenKeys.add(row.key);
  });
};

const inspectPersistedModelStateRows = (rows = []) => {
  if (!Array.isArray(rows)) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_ROWS_INVALID');
  }
  const normalizedRows = rows.map((row) => requirePersistedModelStateRow(row));
  requireUniquePersistedModelStateRowKeys(normalizedRows);
  const epochRows = normalizedRows.filter(
    (row) => row.key === MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
  );
  if (epochRows.length > 1) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_CARDINALITY_INVALID');
  }
  const profileEpoch = epochRows.length === 1
    ? requirePersistedProfileEpochRow(epochRows[0])
    : null;
  const featureRows = normalizedRows.filter(
    (row) => row.key !== MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
  );
  const includedRows = [];
  const discardableCacheKeys = [];
  featureRows.forEach((row) => {
    if (isModelStateDiscardableCacheKey(row.key)) {
      discardableCacheKeys.push(row.key);
      return;
    }
    if (!isModelStateSnapshotIncluded(row.key)) {
      throw new Error(`INDEXED_DB_SNAPSHOT_MODEL_STATE_BEHAVIOR_INVALID:${row.key}`);
    }
    requireModelStateSnapshotValue(row.key, row.value);
    includedRows.push(row);
  });
  if (featureRows.length > 0 && profileEpoch === null) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_MISSING');
  }
  const aggregateRow = includedRows.find((row) => row.key === PROFILE_AGGREGATE_KEY);
  if (profileEpoch !== null && !aggregateRow) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_AGGREGATE_MISSING');
  }
  if (aggregateRow && aggregateRow.value.profileEpoch !== profileEpoch) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_MISMATCH');
  }
  const mismatchedEpochRow = includedRows.find((row) => {
    const rowProfileEpoch = readModelStateSnapshotProfileEpoch(row.key, row.value);
    return rowProfileEpoch !== null && rowProfileEpoch !== profileEpoch;
  });
  if (mismatchedEpochRow?.key === FEED_TEMPO_PROFILE_CHECKPOINT_KEY) {
    throw new Error('INDEXED_DB_SNAPSHOT_FEED_TEMPO_PROFILE_EPOCH_MISMATCH');
  }
  if (mismatchedEpochRow?.key === FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY) {
    throw new Error('INDEXED_DB_SNAPSHOT_FEED_TOPOLOGY_PROFILE_EPOCH_MISMATCH');
  }
  if (mismatchedEpochRow) {
    throw new Error('INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_MISMATCH');
  }
  return Object.freeze({
    profileEpoch,
    aggregateRow: aggregateRow || null,
    includedRows: Object.freeze(includedRows),
    discardableCacheKeys: Object.freeze(discardableCacheKeys),
  });
};

const filterSnapshotModelStateRows = (rows = []) => {
  const inspection = inspectPersistedModelStateRows(rows);
  return [...inspection.includedRows];
};

const rebaseImportedModelStateRows = (rows, targetProfileEpoch, updatedAt) => (
  rows.map((row) => {
    const rebasedValue = rebaseModelStateSnapshotValue(
      row.key,
      row.value,
      targetProfileEpoch,
    );
    return rebasedValue === row.value
      ? row
      : {
        ...row,
        value: rebasedValue,
        updatedAt,
      };
  })
);

export class IndexedDbSnapshotRepository {
  static getInstance() {
    if (!IndexedDbSnapshotRepository.instance) {
      IndexedDbSnapshotRepository.instance = new IndexedDbSnapshotRepository();
    }
    return IndexedDbSnapshotRepository.instance;
  }

  constructor({
    dbManager = DBManager.getInstance(),
    clseRepository = ClseRepository.getInstance(),
  } = {}) {
    this.dbManager = dbManager;
    this.clseRepository = clseRepository;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('INDEXED_DB_SNAPSHOT_REPOSITORY_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async getStoreCounts() {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EXPORT_STORE_NAMES, 'readonly');
      const counts = {};

      let remaining = EXPORT_STORE_NAMES.length;
      let settled = false;

      const finish = () => {
        if (settled || remaining > 0) return;
        settled = true;
        resolve(counts);
      };

      EXPORT_STORE_NAMES.forEach((storeName) => {
        const req = tx.objectStore(storeName).count();
        req.onsuccess = () => {
          if (settled) return;
          counts[storeName] = Number(req.result) || 0;
          remaining -= 1;
          finish();
        };
        req.onerror = () => {
          if (settled) return;
          settled = true;
          const failure = new Error(`INDEXED_DB_STORE_COUNT_FAILED:${storeName}`);
          failure.code = 'INDEXED_DB_STORE_COUNT_FAILED';
          failure.storeName = storeName;
          if (req.error) failure.cause = req.error;
          reject(failure);
        };
      });

      tx.onerror = () => {
        if (settled) return;
        settled = true;
        reject(tx.error);
      };
      tx.onabort = () => {
        if (settled) return;
        settled = true;
        reject(tx.error || new Error('INDEXED_DB_STORE_COUNT_TRANSACTION_ABORTED'));
      };
    });
  }

  async exportSnapshot() {
    if (typeof this.clseRepository?.runSnapshotEpochOperation !== 'function') {
      throw new Error('INDEXED_DB_SNAPSHOT_CLSE_EPOCH_LANE_REQUIRED');
    }
    return this.clseRepository.runSnapshotEpochOperation(async () => {
      const db = await this.getDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(EXPORT_STORE_NAMES, 'readonly');
        const backup = createEmptyExportSnapshot();

        const getAll = (storeName) => (
          new Promise((res, rej) => {
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          })
        );

        Promise.all(EXPORT_STORE_NAMES.map((storeName) => getAll(storeName)))
          .then((results) => {
            EXPORT_STORE_NAMES.forEach((storeName, index) => {
              const fieldName = EXPORT_STORE_TO_FIELD[storeName];
              if (!fieldName) return;
              const rows = Array.isArray(results[index]) ? results[index] : [];
              backup[fieldName] = storeName === STORES.MODEL_STATE
                ? filterSnapshotModelStateRows(rows)
                : rows;
            });
            resolve(preflightIndexedDbV1ImportSnapshot(backup));
          })
          .catch(reject);
      });
    });
  }

  async importSnapshot(json, {
    mode = 'merge',
    targetProfileEpoch = null,
    targetProfileAggregate = null,
  } = {}) {
    if (mode !== 'merge' && mode !== 'replace') {
      throw new Error('INDEXED_DB_SNAPSHOT_IMPORT_MODE_INVALID');
    }
    const snapshot = preflightIndexedDbV1ImportSnapshot(json);
    requireUniquePersistedModelStateRowKeys(snapshot.modelState);
    const resolvedTargetProfileEpoch = requireModelStateProfileEpochId(
      targetProfileEpoch,
      'INDEXED_DB_SNAPSHOT_TARGET_PROFILE_EPOCH_REQUIRED',
    );
    if (targetProfileAggregate === null || typeof targetProfileAggregate === 'undefined') {
      throw new Error('INDEXED_DB_SNAPSHOT_TARGET_PROFILE_AGGREGATE_REQUIRED');
    }
    requireZenThemeModelStateSnapshotValue(
      PROFILE_AGGREGATE_KEY,
      targetProfileAggregate,
    );
    if (targetProfileAggregate.profileEpoch !== resolvedTargetProfileEpoch) {
      throw new Error('INDEXED_DB_SNAPSHOT_TARGET_PROFILE_AGGREGATE_EPOCH_MISMATCH');
    }
    const replace = mode === 'replace';
    const profileEpochUpdatedAt = Date.now();
    const targetProfileAggregateRow = {
      key: PROFILE_AGGREGATE_KEY,
      value: targetProfileAggregate,
      updatedAt: profileEpochUpdatedAt,
    };
    const importedModelStateRows = rebaseImportedModelStateRows(
      snapshot.modelState,
      resolvedTargetProfileEpoch,
      profileEpochUpdatedAt,
    );
    const hasImportedProfileAggregate = importedModelStateRows.some(
      (row) => row.key === PROFILE_AGGREGATE_KEY,
    );
    const importedModelStateKeys = new Set(
      importedModelStateRows.map((row) => row.key),
    );
    if (typeof this.clseRepository?.runSnapshotEpochOperation !== 'function') {
      throw new Error('INDEXED_DB_SNAPSHOT_CLSE_EPOCH_LANE_REQUIRED');
    }

    return this.clseRepository.runSnapshotEpochOperation(async () => {
      const db = await this.getDatabase();

      // Note: We do NOT overwrite the encryption key. The current browser keeps
      // the key in chrome.storage.local and uses it to decrypt imported logs.
      return new Promise((resolve, reject) => {
        const tx = db.transaction(EXPORT_STORE_NAMES, 'readwrite');
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
            // The transaction may already be aborting because a request failed.
          }
          rejectOnce(error);
        };

        const putAll = (storeName, items) => {
          const store = tx.objectStore(storeName);
          items.forEach((item) => store.put(item));
        };

        try {
          if (replace) {
            EXPORT_STORE_NAMES.forEach((storeName) => {
              tx.objectStore(storeName).clear();
            });
          } else if (snapshot.clseBaseline.length === 1) {
            // A merged baseline replaces its epoch-scoped diagnostic set. Keeping
            // pre-import logs would leave rows that reference a non-canonical epoch.
            tx.objectStore(STORES.CLSE_AGGRESSION_LOGS).clear();
          }

          const modelStateStore = tx.objectStore(STORES.MODEL_STATE);
          if (!replace) {
            const rowsRequest = modelStateStore.getAll();
            rowsRequest.onsuccess = () => {
              try {
                const inspection = inspectPersistedModelStateRows(rowsRequest.result);
                inspection.discardableCacheKeys.forEach((key) => {
                  modelStateStore.delete(key);
                });
                inspection.includedRows.forEach((row) => {
                  if (importedModelStateKeys.has(row.key)) return;
                  const rebasedValue = rebaseModelStateSnapshotValue(
                    row.key,
                    row.value,
                    resolvedTargetProfileEpoch,
                  );
                  if (rebasedValue !== row.value) {
                    modelStateStore.put({
                      ...row,
                      value: rebasedValue,
                      updatedAt: profileEpochUpdatedAt,
                    });
                  }
                });
                if (!hasImportedProfileAggregate && !inspection.aggregateRow) {
                  if (rowsRequest.result.length === 0) {
                    modelStateStore.put(targetProfileAggregateRow);
                  } else {
                    throw new Error(
                      'INDEXED_DB_SNAPSHOT_MODEL_STATE_PREPARED_AGGREGATE_FORBIDDEN',
                    );
                  }
                }
              } catch (error) {
                abortWith(error);
              }
            };
            rowsRequest.onerror = () => abortWith(rowsRequest.error);
          }

          modelStateStore.put({
            key: MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
            value: createModelStateProfileEpoch(resolvedTargetProfileEpoch),
            updatedAt: profileEpochUpdatedAt,
          });
          if (replace && !hasImportedProfileAggregate) {
            modelStateStore.put(targetProfileAggregateRow);
          }

          putAll(STORES.LOGS, snapshot.logs);
          putAll(STORES.STATS_HOURLY, snapshot.statsHourly);
          putAll(STORES.STATS_DAILY, snapshot.statsDaily);
          putAll(STORES.STATS_FEATURE_PACK_DAILY, snapshot.statsFeaturePackDaily);
          putAll(STORES.INTERVENTION_EXPOSURES, snapshot.interventionExposures);
          putAll(STORES.INTERVENTION_EFFECT_DAILY, snapshot.interventionEffectDaily);
          putAll(STORES.FAVICONS, snapshot.favicons);
          putAll(STORES.MODEL_STATE, importedModelStateRows);
          putAll(STORES.ZEN_ARTIFACTS, snapshot.zenArtifacts);
          putAll(STORES.CLSE_BUCKETS_60S, snapshot.clseBuckets60s);
          putAll(STORES.CLSE_BUCKETS_5MIN, snapshot.clseBuckets5min);
          putAll(STORES.CLSE_LOOP_EVENTS, snapshot.clseLoopEvents);
          putAll(STORES.CLSE_BASELINE, snapshot.clseBaseline);
          putAll(STORES.CLSE_AGGRESSION_LOGS, snapshot.clseAggressionLogs);
          putAll(STORES.CLSE_DAILY_SUMMARIES, snapshot.clseDailySummaries);
        } catch (error) {
          abortWith(error);
          return;
        }

        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve({
            mode: replace ? 'replace' : 'merge',
            imported: {
              logs: snapshot.logs.length,
              statsHourly: snapshot.statsHourly.length,
              statsDaily: snapshot.statsDaily.length,
              statsFeaturePackDaily: snapshot.statsFeaturePackDaily.length,
              interventionExposures: snapshot.interventionExposures.length,
              interventionEffectDaily: snapshot.interventionEffectDaily.length,
              favicons: snapshot.favicons.length,
              modelState: snapshot.modelState.length,
              zenArtifacts: snapshot.zenArtifacts.length,
              clseBuckets60s: snapshot.clseBuckets60s.length,
              clseBuckets5min: snapshot.clseBuckets5min.length,
              clseLoopEvents: snapshot.clseLoopEvents.length,
              clseBaseline: snapshot.clseBaseline.length,
              clseAggressionLogs: snapshot.clseAggressionLogs.length,
              clseDailySummaries: snapshot.clseDailySummaries.length,
            },
          });
        };
        tx.onerror = () => rejectOnce(tx.error);
        tx.onabort = () => rejectOnce(
          tx.error || new Error('INDEXED_DB_SNAPSHOT_IMPORT_ABORTED'),
        );
      });
    });
  }
}

export default IndexedDbSnapshotRepository;
