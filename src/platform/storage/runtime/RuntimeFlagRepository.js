import RuntimeFlagStore from '../internal/chrome-storage/session/RuntimeFlagStore.js';

export { STORAGE_SESSION_KEYS } from '../internal/chrome-storage/storageKeyRegistry.js';

export class RuntimeFlagRepository {
  constructor({ runtimeFlagStore = RuntimeFlagStore.getInstance() } = {}) {
    this.runtimeFlagStore = runtimeFlagStore;
  }

  static getInstance() {
    if (!RuntimeFlagRepository.instance) {
      RuntimeFlagRepository.instance = new RuntimeFlagRepository();
    }
    return RuntimeFlagRepository.instance;
  }

  get(defaults = {}) {
    return this.runtimeFlagStore.get(defaults);
  }

  set(items = {}) {
    return this.runtimeFlagStore.set(items);
  }

  remove(keys) {
    return this.runtimeFlagStore.remove(keys);
  }
}

export default RuntimeFlagRepository;
