import StatsFeaturePackStore from '../internal/indexeddb/stores/StatsFeaturePackStore.js';

export class StatsFeaturePackRepository {
  #statsFeaturePackStore;

  constructor({ statsFeaturePackStore = StatsFeaturePackStore.getInstance() } = {}) {
    this.#statsFeaturePackStore = statsFeaturePackStore;
  }

  static getInstance() {
    if (!StatsFeaturePackRepository.instance) {
      StatsFeaturePackRepository.instance = new StatsFeaturePackRepository();
    }
    return StatsFeaturePackRepository.instance;
  }

  pruneBefore(cutoffDateStr) {
    return this.#statsFeaturePackStore.pruneBefore(cutoffDateStr);
  }

  clearAll() {
    return this.#statsFeaturePackStore.clearAll();
  }
}

export default StatsFeaturePackRepository;
