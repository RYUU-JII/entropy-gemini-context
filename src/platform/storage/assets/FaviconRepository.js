import FaviconStore from '../internal/indexeddb/stores/FaviconStore.js';
import { normalizeDomain } from '../../../lib/domain.js';

export class FaviconRepository {
  static getInstance() {
    if (!FaviconRepository.instance) {
      FaviconRepository.instance = new FaviconRepository();
    }
    return FaviconRepository.instance;
  }

  constructor({ faviconStore = FaviconStore.getInstance() } = {}) {
    this.faviconStore = faviconStore;
    this.revision = 0;
    this.mutationTail = Promise.resolve();
    this.listeners = new Set();
  }

  async getByDomain(domain) {
    await this.mutationTail;
    return this.faviconStore.get(domain);
  }

  getRevision() {
    return this.revision;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('FAVICON_CACHE_LISTENER_REQUIRED');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyChange(domain) {
    for (const listener of this.listeners) {
      // Persistence is already committed. Optional presentation notifications
      // cannot turn that commit into a failed write acknowledgement.
      Promise.resolve().then(() => listener({ domain })).catch((error) => {
        console.warn('[Favicon] Cache change notification failed', error);
      });
    }
  }

  enqueueMutation(operation) {
    const pending = this.mutationTail.then(operation);
    // Keep the queue open after failure; the caller still receives rejection.
    this.mutationTail = pending.catch(() => {});
    return pending;
  }

  saveDataUrl(domain, dataUrl, { expectedRevision = this.revision } = {}) {
    const key = normalizeDomain(domain);
    if (!key) return Promise.reject(new Error('FAVICON_CACHE_DOMAIN_REQUIRED'));
    return this.enqueueMutation(async () => {
      if (expectedRevision !== this.revision) return false;
      await this.faviconStore.set(key, dataUrl);
      this.notifyChange(key);
      return true;
    });
  }

  async getAll() {
    await this.mutationTail;
    return this.faviconStore.getAll();
  }

  clear() {
    // Invalidate captures already downloading before waiting for storage.
    this.revision += 1;
    return this.enqueueMutation(async () => {
      await this.faviconStore.clear();
      this.notifyChange(null);
    });
  }
}

export default FaviconRepository;
