import DBManager from '../dbManager.js';
import { STORES } from '../dbConstants.js';
import {
  normalizeDailySummaryDateStr,
  toFiniteTimestamp,
} from '../dbStatsNormalizers.js';
import {
  CLSE_DAILY_SUMMARY_SCHEMA_VERSION,
  createClseAggressionLogRecord,
  createClseBaselineRecord,
  createClseBucket5minRecord,
  createClseBucket60sRecord,
  createClseLoopEventRecord,
  normalizeClseAggressionLogRow,
  normalizeClseBaselineRow,
  normalizeClseBucket5minRow,
  normalizeClseBucket60sRow,
  normalizeClseDailySummaryRow,
  normalizeClseLoopEventRow,
  toClseBaselineValue,
} from './clseRecordContracts.js';

export {
  CLSE_DAILY_SUMMARY_SCHEMA_VERSION,
  normalizeClseDailySummaryRow,
};

function hasProvidedValue(value) {
  return value !== null && typeof value !== 'undefined';
}

function normalizeOptionalTimestamp(value, errorCode) {
  if (!hasProvidedValue(value)) return null;
  const timestamp = toFiniteTimestamp(value);
  if (timestamp === null) throw new Error(errorCode);
  return timestamp;
}

function buildTimestampRangeForRead({ startTs, endTs } = {}) {
  const start = normalizeOptionalTimestamp(startTs, 'CLSE_STORE_INVALID_START_TIMESTAMP');
  const end = normalizeOptionalTimestamp(endTs, 'CLSE_STORE_INVALID_END_TIMESTAMP');
  if (start !== null && end !== null) return IDBKeyRange.bound(start, end);
  if (start !== null) return IDBKeyRange.lowerBound(start);
  if (end !== null) return IDBKeyRange.upperBound(end);
  return null;
}

function normalizeOptionalDateStr(value, errorCode) {
  if (!hasProvidedValue(value)) return null;
  const dateStr = normalizeDailySummaryDateStr(value);
  if (!dateStr) throw new Error(errorCode);
  return dateStr;
}

function buildDateRangeForRead({ startDateStr, endDateStr } = {}) {
  const start = normalizeOptionalDateStr(startDateStr, 'CLSE_STORE_INVALID_START_DATE');
  const end = normalizeOptionalDateStr(endDateStr, 'CLSE_STORE_INVALID_END_DATE');
  if (start && end) {
    const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
    return IDBKeyRange.bound(rangeStart, rangeEnd);
  }
  if (start) return IDBKeyRange.lowerBound(start);
  if (end) return IDBKeyRange.upperBound(end);
  return null;
}

function isMissingIndexedDbRow(row) {
  return row === null || typeof row === 'undefined';
}

export class ClseStore {
  static getInstance() {
    if (!ClseStore.instance) {
      ClseStore.instance = new ClseStore();
    }
    return ClseStore.instance;
  }

  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  async init() {
    await this.getDatabase();
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('CLSE_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async putRow(storeName, row) {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_WRITE_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('CLSE_STORE_WRITE_ABORTED'));
    });
  }

  async readTimestampRows(storeName, indexName, options = {}, normalizeRow, errorCode) {
    const range = buildTimestampRangeForRead(options);
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = range ? store.index(indexName).getAll(range) : store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        const normalized = rows.map((row) => normalizeRow(row));
        if (normalized.some((row) => !row)) {
          reject(new Error(errorCode));
          return;
        }
        resolve(normalized);
      };
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_READ_FAILED'));
    });
  }

  async readTimestampRowsWithLimit(
    storeName,
    indexName,
    { startTs, endTs, limit } = {},
    normalizeRow,
    errorCode,
  ) {
    const range = buildTimestampRangeForRead({ startTs, endTs });
    const normalizedLimit = Number.isFinite(Number(limit))
      ? Math.max(0, Math.floor(Number(limit)))
      : null;
    if (normalizedLimit === 0) return [];
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = range ? index.openCursor(range) : index.openCursor();
      const results = [];
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(results);
      };

      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (!cursor) {
          finish();
          return;
        }
        const normalized = normalizeRow(cursor.value);
        if (!normalized) {
          settled = true;
          reject(new Error(errorCode));
          return;
        }
        results.push(normalized);
        if (normalizedLimit !== null && results.length >= normalizedLimit) {
          finish();
          return;
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_READ_FAILED'));
    });
  }

  async getByKey(storeName, key) {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(
        typeof req.result === 'undefined' ? null : req.result,
      );
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_READ_FAILED'));
    });
  }

  async deleteByKey(storeName, key) {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_DELETE_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('CLSE_STORE_DELETE_ABORTED'));
    });
  }

  async pruneTimestampStore(storeName, indexName, cutoffValue) {
    const cutoff = toFiniteTimestamp(cutoffValue);
    if (cutoff === null) return 0;
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.openCursor(IDBKeyRange.upperBound(cutoff, true));
      let removed = 0;

      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_PRUNE_FAILED'));
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_PRUNE_FAILED'));
    });
  }

  async pruneDailySummariesBefore(cutoffDateStr) {
    const cutoff = normalizeDailySummaryDateStr(cutoffDateStr);
    if (!cutoff) return 0;
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CLSE_DAILY_SUMMARIES, 'readwrite');
      const store = tx.objectStore(STORES.CLSE_DAILY_SUMMARIES);
      const req = store.openCursor(IDBKeyRange.upperBound(cutoff, true));
      let removed = 0;
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_PRUNE_DAILY_SUMMARY_FAILED'));
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_PRUNE_DAILY_SUMMARY_FAILED'));
    });
  }

  async clearStore(storeName) {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_CLEAR_FAILED'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_CLEAR_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('CLSE_STORE_CLEAR_ABORTED'));
    });
  }

  async runBaselineEpochTransaction(storeNames, operation, transactionErrorCode) {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      const baselineStore = tx.objectStore(STORES.CLSE_BASELINE);
      const request = baselineStore.get('default');
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        try {
          tx.abort?.();
        } catch (_) {
          // The explicit operation error remains the canonical failure.
        }
        reject(error);
      };

      request.onsuccess = () => {
        try {
          operation({
            tx,
            baselineStore,
            currentBaselineRow: request.result,
          });
        } catch (error) {
          fail(error);
        }
      };
      request.onerror = () => fail(
        request.error || new Error(transactionErrorCode),
      );
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onerror = () => fail(tx.error || new Error(transactionErrorCode));
      tx.onabort = () => fail(tx.error || new Error(transactionErrorCode));
    });
  }

  getBaseline() {
    return this.getByKey(STORES.CLSE_BASELINE, 'default').then((row) => {
      if (row === null) return null;
      const normalized = normalizeClseBaselineRow(row);
      if (!normalized) throw new Error('CLSE_STORE_BASELINE_CONTRACT_INVALID');
      return toClseBaselineValue(normalized);
    });
  }

  async setBaseline(baseline) {
    const baselineRecord = createClseBaselineRecord(baseline);
    return this.runBaselineEpochTransaction(
      [STORES.CLSE_BASELINE],
      ({ baselineStore, currentBaselineRow }) => {
        if (!isMissingIndexedDbRow(currentBaselineRow)) {
          const currentBaseline = normalizeClseBaselineRow(currentBaselineRow);
          if (!currentBaseline) {
            throw new Error('CLSE_STORE_BASELINE_CONTRACT_INVALID');
          }
          if (currentBaseline.reset_epoch !== baselineRecord.reset_epoch) {
            throw new Error('CLSE_STORE_BASELINE_RESET_EPOCH_MISMATCH');
          }
        }
        baselineStore.put(baselineRecord);
      },
      'CLSE_STORE_BASELINE_WRITE_FAILED',
    );
  }

  async resetBaseline(baseline, { expectedResetEpoch = null } = {}) {
    const baselineRecord = createClseBaselineRecord(baseline);
    if (
      expectedResetEpoch !== null
      && (!Number.isSafeInteger(expectedResetEpoch) || expectedResetEpoch <= 0)
    ) {
      throw new Error('CLSE_STORE_BASELINE_EXPECTED_RESET_EPOCH_INVALID');
    }
    return this.runBaselineEpochTransaction(
      [
        STORES.CLSE_BASELINE,
        STORES.CLSE_AGGRESSION_LOGS,
      ],
      ({ tx, baselineStore, currentBaselineRow }) => {
        const currentBaseline = isMissingIndexedDbRow(currentBaselineRow)
          ? null
          : normalizeClseBaselineRow(currentBaselineRow);
        if (expectedResetEpoch === null) {
          if (currentBaseline !== null) {
            throw new Error('CLSE_STORE_BASELINE_RESET_EPOCH_CONFLICT');
          }
        } else if (
          !currentBaseline
          || currentBaseline.reset_epoch !== expectedResetEpoch
          || baselineRecord.reset_epoch <= expectedResetEpoch
        ) {
          throw new Error('CLSE_STORE_BASELINE_RESET_EPOCH_CONFLICT');
        }
        baselineStore.put(baselineRecord);
        tx.objectStore(STORES.CLSE_AGGRESSION_LOGS).clear();
      },
      'CLSE_STORE_BASELINE_RESET_FAILED',
    );
  }

  async addAggressionLog(entry) {
    const aggressionRecord = createClseAggressionLogRecord(entry);
    return this.runBaselineEpochTransaction(
      [
        STORES.CLSE_BASELINE,
        STORES.CLSE_AGGRESSION_LOGS,
      ],
      ({ tx, currentBaselineRow }) => {
        if (isMissingIndexedDbRow(currentBaselineRow)) {
          throw new Error('CLSE_STORE_AGGRESSION_LOG_BASELINE_REQUIRED');
        }
        const currentBaseline = normalizeClseBaselineRow(currentBaselineRow);
        if (!currentBaseline) {
          throw new Error('CLSE_STORE_BASELINE_CONTRACT_INVALID');
        }
        if (currentBaseline.reset_epoch !== aggressionRecord.baseline_reset_epoch) {
          throw new Error('CLSE_STORE_AGGRESSION_LOG_RESET_EPOCH_MISMATCH');
        }
        tx.objectStore(STORES.CLSE_AGGRESSION_LOGS).put(aggressionRecord);
      },
      'CLSE_STORE_AGGRESSION_LOG_WRITE_FAILED',
    );
  }

  getAggressionLogs(options = {}) {
    return this.readTimestampRowsWithLimit(
      STORES.CLSE_AGGRESSION_LOGS,
      'ts',
      options,
      normalizeClseAggressionLogRow,
      'CLSE_STORE_AGGRESSION_LOG_CONTRACT_INVALID',
    );
  }

  async addBucket60s(bucket) {
    return this.putRow(
      STORES.CLSE_BUCKETS_60S,
      createClseBucket60sRecord(bucket),
    );
  }

  getBuckets60s(options = {}) {
    return this.readTimestampRows(
      STORES.CLSE_BUCKETS_60S,
      'ts_start',
      options,
      normalizeClseBucket60sRow,
      'CLSE_STORE_BUCKET_60S_CONTRACT_INVALID',
    );
  }

  async getFirstBucket60s({ startTs, endTs } = {}) {
    const rows = await this.readTimestampRowsWithLimit(
      STORES.CLSE_BUCKETS_60S,
      'ts_start',
      { startTs, endTs, limit: 1 },
      normalizeClseBucket60sRow,
      'CLSE_STORE_BUCKET_60S_CONTRACT_INVALID',
    );
    return rows.length === 0 ? null : rows[0];
  }

  async addBucket5min(bucket) {
    return this.putRow(
      STORES.CLSE_BUCKETS_5MIN,
      createClseBucket5minRecord(bucket),
    );
  }

  getBuckets5min(options = {}) {
    return this.readTimestampRows(
      STORES.CLSE_BUCKETS_5MIN,
      'ts_start',
      options,
      normalizeClseBucket5minRow,
      'CLSE_STORE_BUCKET_5MIN_CONTRACT_INVALID',
    );
  }

  async addDailySummary(summary) {
    const normalized = normalizeClseDailySummaryRow(summary);
    if (!normalized) throw new Error('CLSE_STORE_DAILY_SUMMARY_REQUIRED');
    return this.putRow(STORES.CLSE_DAILY_SUMMARIES, normalized);
  }

  async getDailySummaries(options = {}) {
    const range = buildDateRangeForRead(options);
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CLSE_DAILY_SUMMARIES, 'readonly');
      const store = tx.objectStore(STORES.CLSE_DAILY_SUMMARIES);
      const req = range ? store.getAll(range) : store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        const normalized = rows.map((row) => normalizeClseDailySummaryRow(row));
        if (normalized.some((row) => !row)) {
          reject(new Error('CLSE_STORE_DAILY_SUMMARY_CONTRACT_INVALID'));
          return;
        }
        resolve(normalized);
      };
      req.onerror = () => reject(req.error || new Error('CLSE_STORE_READ_DAILY_SUMMARY_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('CLSE_STORE_READ_DAILY_SUMMARY_FAILED'));
    });
  }

  async addLoopEvent(event) {
    return this.putRow(
      STORES.CLSE_LOOP_EVENTS,
      createClseLoopEventRecord(event),
    );
  }

  getLoopEvents(options = {}) {
    return this.readTimestampRows(
      STORES.CLSE_LOOP_EVENTS,
      'ts',
      options,
      normalizeClseLoopEventRow,
      'CLSE_STORE_LOOP_EVENT_CONTRACT_INVALID',
    );
  }

  pruneBefore(cutoffTs) {
    return this.pruneTiers({
      buckets60sBefore: cutoffTs,
      buckets5minBefore: cutoffTs,
      loopEventsBefore: cutoffTs,
      aggressionLogsBefore: cutoffTs,
    }).then(({ buckets60s, buckets5min, loopEvents, aggressionLogs }) => ({
      buckets60s,
      buckets5min,
      loopEvents,
      aggressionLogs,
    }));
  }

  async pruneTiers({
    buckets60sBefore = null,
    buckets5minBefore = null,
    loopEventsBefore = null,
    aggressionLogsBefore = null,
    dailySummariesBefore = null,
  } = {}) {
    const [
      buckets60s,
      buckets5min,
      loopEvents,
      aggressionLogs,
      dailySummaries,
    ] = await Promise.all([
      this.pruneTimestampStore(STORES.CLSE_BUCKETS_60S, 'ts_start', buckets60sBefore),
      this.pruneTimestampStore(STORES.CLSE_BUCKETS_5MIN, 'ts_start', buckets5minBefore),
      this.pruneTimestampStore(STORES.CLSE_LOOP_EVENTS, 'ts', loopEventsBefore),
      this.pruneTimestampStore(STORES.CLSE_AGGRESSION_LOGS, 'ts', aggressionLogsBefore),
      this.pruneDailySummariesBefore(dailySummariesBefore),
    ]);

    return { buckets60s, buckets5min, loopEvents, aggressionLogs, dailySummaries };
  }

  async clear() {
    await Promise.all([
      this.clearStore(STORES.CLSE_BUCKETS_60S),
      this.clearStore(STORES.CLSE_BUCKETS_5MIN),
      this.clearStore(STORES.CLSE_LOOP_EVENTS),
      this.clearStore(STORES.CLSE_BASELINE),
      this.clearStore(STORES.CLSE_AGGRESSION_LOGS),
      this.clearStore(STORES.CLSE_DAILY_SUMMARIES),
    ]);
    return true;
  }
}

export default ClseStore;
