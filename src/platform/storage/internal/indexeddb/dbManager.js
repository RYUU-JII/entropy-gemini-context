import {
  DB_NAME,
  DB_VERSION,
} from './dbConstants.js';
import {
  assertIndexedDbV1Schema,
  applyIndexedDbV1Schema,
} from './dbSchema.js';
import {
  buildIndexedDbOpenFailure,
  isIndexedDbReleaseV1ResetRequired,
} from './indexedDbOpenFailure.js';

/**
 * EntropyDB Manager
 *
 * 주요 기능:
 * - IndexedDB connection lifecycle
 * - IndexedDB release-V1 schema open and first creation
 */

class DBManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.terminalFailure = null;
    this.connectionLifetime = 0;
  }

  static getInstance() {
    if (!DBManager.instance) DBManager.instance = new DBManager();
    return DBManager.instance;
  }

  terminateConnectionLifetime(reason = 'unknown') {
    if (!this.terminalFailure) {
      const normalizedReason = typeof reason === 'string' && reason.trim()
        ? reason.trim()
        : 'unknown';
      const failure = new Error(
        `INDEXED_DB_CONNECTION_LIFETIME_TERMINATED:${normalizedReason}`,
      );
      failure.code = 'INDEXED_DB_CONNECTION_LIFETIME_TERMINATED';
      failure.reason = normalizedReason;
      this.terminalFailure = failure;
      this.connectionLifetime += 1;
    }
    const database = this.db;
    this.db = null;
    this.initPromise = null;
    database?.close?.();
    return this.terminalFailure;
  }

  async init() {
    if (this.terminalFailure) throw this.terminalFailure;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await this._openDb();
    })().catch((error) => {
      this.initPromise = null;
      if (isIndexedDbReleaseV1ResetRequired(error)) {
        this.terminalFailure = error;
      }
      throw error;
    });
    return this.initPromise;
  }

  // ===========================================================
  // 2. Database handlers
  // ===========================================================

  async _openDb() {
    if (this.db) return;
    const openingLifetime = this.connectionLifetime;
    return new Promise((resolve, reject) => {
      let req;
      let settled = false;

      const failOpen = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        failOpen(buildIndexedDbOpenFailure(error));
        return;
      }

      req.onupgradeneeded = () => {
        if (this.terminalFailure || openingLifetime !== this.connectionLifetime) {
          req.transaction?.abort?.();
          failOpen(this.terminalFailure);
          return;
        }
        applyIndexedDbV1Schema({ db: req.result });
      };

      req.onsuccess = () => {
        if (
          settled
          || this.terminalFailure
          || openingLifetime !== this.connectionLifetime
        ) {
          req.result.close();
          failOpen(this.terminalFailure);
          return;
        }
        try {
          this.db = assertIndexedDbV1Schema(req.result);
        } catch (error) {
          req.result.close();
          failOpen(buildIndexedDbOpenFailure(error));
          return;
        }
        if (this.db) {
          const openedDatabase = this.db;
          this.db.onclose = () => {
            if (this.db === openedDatabase) {
              this.db = null;
              this.initPromise = null;
            }
          };
          this.db.onversionchange = () => {
            this.terminateConnectionLifetime('versionchange');
          };
        }
        settled = true;
        resolve();
      };

      req.onerror = () => failOpen(buildIndexedDbOpenFailure(
        req.error || new Error('INDEXED_DB_OPEN_FAILED'),
      ));
      req.onblocked = () => failOpen(new Error('INDEXED_DB_OPEN_BLOCKED'));
    });
  }

  async getDatabase() {
    await this.init();
    if (!this.db) {
      throw new Error('INDEXEDDB_DATABASE_UNAVAILABLE');
    }
    return this.db;
  }

}

export default DBManager;
