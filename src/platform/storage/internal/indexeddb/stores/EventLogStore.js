import DBManager from '../dbManager.js';
import CryptoService from '../../../../security/CryptoService.js';
import {
  STORES,
} from '../dbConstants.js';
import { isIndexedDbReleaseV1ResetRequired } from '../indexedDbOpenFailure.js';

function toFiniteTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeLogEntry(logEntry) {
  if (!logEntry || typeof logEntry !== 'object' || Array.isArray(logEntry)) {
    throw new Error('EVENT_LOG_STORE_LOG_ENTRY_REQUIRED');
  }
  const timestamp = toFiniteTimestamp(logEntry.timestamp);
  if (timestamp === null) {
    throw new Error('EVENT_LOG_STORE_TIMESTAMP_REQUIRED');
  }
  return {
    ...logEntry,
    timestamp,
  };
}

export const EVENT_LOG_APPEND_BATCH_SIZE = 100;

function requireAppendBatchSize(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000) {
    throw new Error('EVENT_LOG_STORE_APPEND_BATCH_SIZE_INVALID');
  }
  return value;
}

export class EventLogStore {
  static getInstance() {
    if (!EventLogStore.instance) {
      EventLogStore.instance = new EventLogStore();
    }
    return EventLogStore.instance;
  }

  constructor({
    dbManager = DBManager.getInstance(),
    cryptoService = CryptoService.getInstance(),
    maxAppendBatchSize = EVENT_LOG_APPEND_BATCH_SIZE,
  } = {}) {
    this.dbManager = dbManager;
    this.cryptoService = cryptoService;
    this.terminalFailure = null;
    this.writeAdmissionOpen = true;
    this.operationTail = Promise.resolve();
    this.maxAppendBatchSize = requireAppendBatchSize(maxAppendBatchSize);
    this.pendingAppendEntries = [];
    this.appendDispatchScheduled = false;
  }

  enqueue(operation) {
    const queued = this.operationTail.then(operation, operation);
    this.operationTail = queued.catch(() => undefined);
    return queued;
  }

  assertWriteAdmission() {
    if (!this.writeAdmissionOpen) {
      throw new Error('EVENT_LOG_STORE_WRITE_ADMISSION_CLOSED');
    }
    if (this.terminalFailure) throw this.terminalFailure;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('EVENT_LOG_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async initCrypto() {
    if (
      !this.cryptoService
      || typeof this.cryptoService.init !== 'function'
      || typeof this.cryptoService.encryptBatch !== 'function'
    ) {
      throw new Error('EVENT_LOG_STORE_CRYPTO_SERVICE_REQUIRED');
    }
    await this.cryptoService.init();
  }

  async append(logEntry) {
    this.assertWriteAdmission();
    const normalizedLogEntry = normalizeLogEntry(logEntry);
    return new Promise((resolve, reject) => {
      this.pendingAppendEntries.push({
        logEntry: normalizedLogEntry,
        resolve,
        reject,
      });
      this.scheduleAppendDispatch();
    });
  }

  scheduleAppendDispatch() {
    if (this.appendDispatchScheduled) return;
    this.appendDispatchScheduled = true;
    queueMicrotask(() => {
      this.enqueuePendingAppendBatches();
    });
  }

  enqueuePendingAppendBatches() {
    this.appendDispatchScheduled = false;
    const pendingEntries = this.pendingAppendEntries.splice(0);
    if (pendingEntries.length === 0) return [];

    const tasks = [];
    for (let offset = 0; offset < pendingEntries.length; offset += this.maxAppendBatchSize) {
      const batch = pendingEntries.slice(offset, offset + this.maxAppendBatchSize);
      const task = this.enqueue(() => this.writeAppendBatch(
        batch.map((entry) => entry.logEntry),
      ));
      task.then(
        () => batch.forEach((entry) => entry.resolve()),
        (error) => batch.forEach((entry) => entry.reject(error)),
      );
      tasks.push(task);
    }
    return tasks;
  }

  async writeAppendBatch(logEntries) {
    if (!Array.isArray(logEntries) || logEntries.length === 0) {
      throw new Error('EVENT_LOG_STORE_APPEND_BATCH_REQUIRED');
    }
    if (this.terminalFailure) throw this.terminalFailure;
    try {
      await this.initCrypto();
      const encryptedEntries = await this.cryptoService.encryptBatch(logEntries);
      if (
        !Array.isArray(encryptedEntries)
        || encryptedEntries.length !== logEntries.length
      ) {
        throw new Error('EVENT_LOG_STORE_ENCRYPT_BATCH_INVALID');
      }
      const db = await this.getDatabase();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.LOGS, 'readwrite');
        const store = tx.objectStore(STORES.LOGS);
        encryptedEntries.forEach((entry) => store.add(entry));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('EVENT_LOG_STORE_WRITE_FAILED'));
        tx.onabort = () => reject(tx.error || new Error('EVENT_LOG_STORE_WRITE_ABORTED'));
      });
    } catch (error) {
      if (isIndexedDbReleaseV1ResetRequired(error)) {
        this.terminalFailure = error;
      }
      throw error;
    }
  }

  async flush() {
    this.assertWriteAdmission();
    this.enqueuePendingAppendBatches();
    return this.enqueue(async () => {});
  }

  async forceFlush() {
    return this.flush();
  }

  async pruneBefore(cutoffTs) {
    this.assertWriteAdmission();
    this.enqueuePendingAppendBatches();
    return this.enqueue(() => this.pruneBeforeInternal(cutoffTs));
  }

  async pruneBeforeInternal(cutoffTs) {
    const cutoff = toFiniteTimestamp(cutoffTs);
    if (cutoff === null) return 0;
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LOGS, 'readwrite');
      const store = tx.objectStore(STORES.LOGS);
      const index = store.index('timestamp');
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
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error);
    });
  }

  clear() {
    this.enqueuePendingAppendBatches();
    return this.enqueue(() => this.clearInternal());
  }

  async clearInternal() {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LOGS, 'readwrite');
      const store = tx.objectStore(STORES.LOGS);
      const req = store.clear();
      req.onerror = () => reject(req.error || new Error('EVENT_LOG_STORE_CLEAR_FAILED'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('EVENT_LOG_STORE_CLEAR_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('EVENT_LOG_STORE_CLEAR_ABORTED'));
    });
  }

  quiesceForProfileMutation() {
    this.writeAdmissionOpen = false;
    this.enqueuePendingAppendBatches();
    return this.operationTail.then(() => Object.freeze({ quiesced: true }));
  }

  resetForProfileMutation() {
    if (this.writeAdmissionOpen) {
      return Promise.reject(new Error('EVENT_LOG_STORE_PROFILE_RESET_REQUIRES_QUIESCE'));
    }
    return this.clear();
  }

  getBufferedCount() {
    return this.pendingAppendEntries.length;
  }
}

export default EventLogStore;
