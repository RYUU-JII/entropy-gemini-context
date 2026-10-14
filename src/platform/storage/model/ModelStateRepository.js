import ModelStateStore from '../internal/indexeddb/stores/ModelStateStore.js';

export class ModelStateRepository {
  static getInstance() {
    if (!ModelStateRepository.instance) {
      ModelStateRepository.instance = new ModelStateRepository();
    }
    return ModelStateRepository.instance;
  }

  constructor({ modelStateStore = ModelStateStore.getInstance() } = {}) {
    this.modelStateStore = modelStateStore;
  }

  get(defaults = {}) {
    void defaults;
    throw new Error('MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN');
  }

  getAll() {
    throw new Error('MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN');
  }

  set(entries = {}) {
    void entries;
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }

  getWithProfileEpoch(defaults = {}, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.getWithProfileEpoch !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_READ_UNAVAILABLE');
    }
    return this.modelStateStore.getWithProfileEpoch(defaults, options);
  }

  setWithProfileEpoch(entries = {}, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.setWithProfileEpoch !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_WRITE_UNAVAILABLE');
    }
    return this.modelStateStore.setWithProfileEpoch(entries, options);
  }

  bootstrapValueWithProfileEpoch(key, initialValue, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.bootstrapValueWithProfileEpoch !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_BOOTSTRAP_UNAVAILABLE');
    }
    return this.modelStateStore.bootstrapValueWithProfileEpoch(
      key,
      initialValue,
      options,
    );
  }

  initializeProfileGeneration(profileEpoch, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.initializeProfileGeneration !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_GENERATION_INITIALIZE_UNAVAILABLE');
    }
    return this.modelStateStore.initializeProfileGeneration(profileEpoch, options);
  }

  assertProfileGenerationInitialized(expectedProfileEpoch) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.assertProfileGenerationInitialized !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_GENERATION_ASSERT_UNAVAILABLE');
    }
    return this.modelStateStore.assertProfileGenerationInitialized(expectedProfileEpoch);
  }

  compareAndSetValue(key, options) {
    void key;
    void options;
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }

  getEntryWithProfileEpoch(key, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.getEntryWithProfileEpoch !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_READ_UNAVAILABLE');
    }
    return this.modelStateStore.getEntryWithProfileEpoch(key, options);
  }

  compareAndSetValueWithProfileEpoch(key, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.compareAndSetEntryWithProfileEpoch !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_CAS_UNAVAILABLE');
    }
    return this.modelStateStore.compareAndSetEntryWithProfileEpoch(key, options);
  }

  resetForProfileEpoch(resetId, options) {
    if (
      !this.modelStateStore
      || typeof this.modelStateStore.resetForProfileEpoch !== 'function'
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_RESET_UNAVAILABLE');
    }
    return this.modelStateStore.resetForProfileEpoch(resetId, options);
  }

  clear() {
    throw new Error('MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN');
  }
}

export default ModelStateRepository;
