import RuntimeLanguageStore from '../internal/chrome-storage/stores/RuntimeLanguageStore.js';

export class RuntimeLanguageRepository {
  constructor({
    runtimeLanguageStore = RuntimeLanguageStore.getInstance(),
  } = {}) {
    this.runtimeLanguageStore = runtimeLanguageStore;
  }

  static getInstance() {
    if (!RuntimeLanguageRepository.instance) {
      RuntimeLanguageRepository.instance = new RuntimeLanguageRepository();
    }
    return RuntimeLanguageRepository.instance;
  }

  get(fallback = 'en') {
    return this.runtimeLanguageStore.get(fallback);
  }

  subscribe(listener, options = {}) {
    return this.runtimeLanguageStore.subscribe(listener, options);
  }
}

export default RuntimeLanguageRepository;
