import BootstrapSnapshotStore, {
  DEFAULT_FRICTION_BOOTSTRAP_TTL_MS,
  FRICTION_BOOTSTRAP_CACHE_GENERATION,
  FRICTION_BOOTSTRAP_SCHEMA_VERSION,
  FRICTION_ROOT_VISUAL_SCHEMA_VERSION,
} from '../internal/chrome-storage/stores/BootstrapSnapshotStore.js';

export class BootstrapSnapshotRepository {
  static getInstance() {
    if (!BootstrapSnapshotRepository.instance) {
      BootstrapSnapshotRepository.instance = new BootstrapSnapshotRepository();
    }
    return BootstrapSnapshotRepository.instance;
  }

  constructor({ bootstrapSnapshotStore = BootstrapSnapshotStore.getInstance() } = {}) {
    this.bootstrapSnapshotStore = bootstrapSnapshotStore;
  }

  prepareCurrentCacheGeneration() {
    return this.bootstrapSnapshotStore.prepareCurrentCacheGeneration();
  }

  getFrictionSnapshot(options = {}) {
    return this.bootstrapSnapshotStore.getFrictionSnapshot(options);
  }

  getRootVisualSnapshot(options = {}) {
    return this.bootstrapSnapshotStore.getRootVisualSnapshot(options);
  }

  listRootVisualSnapshots(options = {}) {
    return this.bootstrapSnapshotStore.listRootVisualSnapshots(options);
  }

  listFrictionSnapshots(options = {}) {
    return this.bootstrapSnapshotStore.listFrictionSnapshots(options);
  }

  setFrictionSnapshot(snapshot) {
    return this.bootstrapSnapshotStore.setFrictionSnapshot(snapshot);
  }

  clearFrictionSnapshot(options = {}) {
    return this.bootstrapSnapshotStore.clearFrictionSnapshot(options);
  }
}

export {
  DEFAULT_FRICTION_BOOTSTRAP_TTL_MS,
  FRICTION_BOOTSTRAP_CACHE_GENERATION,
  FRICTION_BOOTSTRAP_SCHEMA_VERSION,
  FRICTION_ROOT_VISUAL_SCHEMA_VERSION,
};

export default BootstrapSnapshotRepository;
