import RuntimeSessionStore from '../internal/chrome-storage/stores/RuntimeSessionStore.js';

export { STORAGE_SESSION_KEYS } from '../internal/chrome-storage/storageKeyRegistry.js';

export class RuntimeSessionRepository {
  constructor({ sessionStore = RuntimeSessionStore.getInstance() } = {}) {
    this.sessionStore = sessionStore;
  }

  static getInstance() {
    if (!RuntimeSessionRepository.instance) {
      RuntimeSessionRepository.instance = new RuntimeSessionRepository();
    }
    return RuntimeSessionRepository.instance;
  }

  get(defaults = {}) {
    return this.sessionStore.get(defaults);
  }

  readOptional(sessionKey) {
    return this.sessionStore.readOptional(sessionKey);
  }

  set(items = {}) {
    return this.sessionStore.set(items);
  }

  remove(keys) {
    return this.sessionStore.remove(keys);
  }
}

export default RuntimeSessionRepository;
