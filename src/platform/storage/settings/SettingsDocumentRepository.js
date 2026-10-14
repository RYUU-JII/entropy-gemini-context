import SettingsStore from '../internal/chrome-storage/stores/SettingsStore.js';

export {
  SETTINGS_DOCUMENT_KEYS,
  STORAGE_LOCAL_DOC_KEYS,
} from '../internal/chrome-storage/storageKeyRegistry.js';

export class SettingsDocumentRepository {
  constructor({ settingsStore = SettingsStore.getInstance() } = {}) {
    this.settingsStore = settingsStore;
  }

  static getInstance() {
    if (!SettingsDocumentRepository.instance) {
      SettingsDocumentRepository.instance = new SettingsDocumentRepository();
    }
    return SettingsDocumentRepository.instance;
  }

  get(defaults = {}) {
    return this.settingsStore.get(defaults);
  }

  getAll() {
    return this.settingsStore.getAll();
  }

  set(items = {}) {
    return this.settingsStore.set(items);
  }

  commitItems(items = {}) {
    return this.settingsStore.commitItems(items);
  }

  getDocuments(documentKeys) {
    return this.settingsStore.getDocuments(documentKeys);
  }

  writeDocuments(documents = {}, options = {}) {
    return this.settingsStore.writeDocuments(documents, options);
  }

  clear() {
    return this.settingsStore.clear();
  }
}

export default SettingsDocumentRepository;
