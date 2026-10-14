import ZenArtifactStore, {
  ZEN_ARTIFACT_THEME_ID,
  ZEN_ARTIFACT_TYPE,
} from '../../internal/indexeddb/stores/ZenArtifactStore.js';

export { ZEN_ARTIFACT_THEME_ID, ZEN_ARTIFACT_TYPE };

export class ZenArtifactRepository {
  constructor({ artifactStore = ZenArtifactStore.getInstance() } = {}) {
    this.artifactStore = artifactStore;
  }

  static getInstance() {
    if (!ZenArtifactRepository.instance) {
      ZenArtifactRepository.instance = new ZenArtifactRepository();
    }
    return ZenArtifactRepository.instance;
  }

  getArtifact(id) {
    return this.artifactStore.getArtifact(id);
  }

  listArtifacts(options = {}) {
    return this.artifactStore.listArtifacts(options);
  }

  readArtifactCollection(options = {}) {
    return this.artifactStore.readArtifactCollection(options);
  }

  replaceArtifactCollectionForProfileGeneration(command = {}) {
    return this.artifactStore.replaceArtifactCollectionForProfileGeneration(command);
  }

  clearForProfileMutation() {
    return this.artifactStore.clearForProfileMutation();
  }
}

export default ZenArtifactRepository;
