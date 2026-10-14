import ClseSettingsStore from '../internal/chrome-storage/stores/ClseSettingsStore.js';

export class ClseSettingsQueryService {
  static getInstance() {
    if (!ClseSettingsQueryService.instance) {
      ClseSettingsQueryService.instance = new ClseSettingsQueryService();
    }
    return ClseSettingsQueryService.instance;
  }

  constructor({ clseSettingsStore = ClseSettingsStore.getInstance() } = {}) {
    this.clseSettingsStore = clseSettingsStore;
  }

  async getFeatureEnabled(fallback = false) {
    return this.clseSettingsStore.getFeatureEnabled(fallback);
  }

  subscribeFeatureEnabled(listener, options = {}) {
    return this.clseSettingsStore.subscribeFeatureEnabled(listener, options);
  }

  getSnapshot(defaults = {}) {
    return this.clseSettingsStore.getSnapshot(defaults);
  }

  subscribeSnapshot(listener, options = {}) {
    return this.clseSettingsStore.subscribeSnapshot(listener, options);
  }
}

export default ClseSettingsQueryService;
