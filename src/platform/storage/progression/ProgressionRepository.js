import ProgressionStateStore from '../internal/chrome-storage/stores/ProgressionStateStore.js';

export class ProgressionRepository {
  constructor({ progressionStateStore = ProgressionStateStore.getInstance() } = {}) {
    this.progressionStateStore = progressionStateStore;
  }

  static getInstance() {
    if (!ProgressionRepository.instance) {
      ProgressionRepository.instance = new ProgressionRepository();
    }
    return ProgressionRepository.instance;
  }

  readState(options = {}) {
    return this.progressionStateStore.readState(options);
  }

  writeState(state = null, options = {}) {
    return this.progressionStateStore.writeState(state, options);
  }

  resetForProfileMutation(state, options = {}) {
    return this.progressionStateStore.resetForProfileMutation(state, options);
  }

  mutateState(mutator, options = {}) {
    return this.progressionStateStore.mutateState(mutator, options);
  }

  clear() {
    return this.progressionStateStore.clear();
  }
}

export default ProgressionRepository;
