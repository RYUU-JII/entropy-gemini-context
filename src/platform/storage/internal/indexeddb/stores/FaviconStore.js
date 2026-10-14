import DBManager from '../dbManager.js';
import { STORES } from '../dbConstants.js';
import { normalizeDomain } from '../../../../../lib/domain.js';

function normalizeFaviconDomain(domain) {
  const normalized = normalizeDomain(domain);
  return normalized ? normalized.toLowerCase() : '';
}

export class FaviconStore {
  static getInstance() {
    if (!FaviconStore.instance) {
      FaviconStore.instance = new FaviconStore();
    }
    return FaviconStore.instance;
  }

  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('FAVICON_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async get(domain) {
    const key = normalizeFaviconDomain(domain);
    if (!key) return null;
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.FAVICONS, 'readonly');
      const store = tx.objectStore(STORES.FAVICONS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('FAVICON_STORE_READ_ABORTED'));
    });
  }

  async set(domain, dataUrl) {
    const key = normalizeFaviconDomain(domain);
    if (!key) return;
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.FAVICONS, 'readwrite');
      const store = tx.objectStore(STORES.FAVICONS);
      store.put({ domain: key, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('FAVICON_STORE_WRITE_ABORTED'));
    });
  }

  async getAll() {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.FAVICONS, 'readonly');
      const store = tx.objectStore(STORES.FAVICONS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('FAVICON_STORE_READ_ABORTED'));
    });
  }

  async clear() {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.FAVICONS, 'readwrite');
      const store = tx.objectStore(STORES.FAVICONS);
      const req = store.clear();
      tx.oncomplete = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('FAVICON_STORE_CLEAR_ABORTED'));
    });
  }
}

export default FaviconStore;
