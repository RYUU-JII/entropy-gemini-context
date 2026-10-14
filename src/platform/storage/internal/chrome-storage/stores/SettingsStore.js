import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal,
} from '../localArea.js';
import {
  SETTINGS_DOCUMENT_KEYS,
  STORAGE_LOCAL_DOC_KEYS,
  resolveSettingsDocumentKey,
} from '../storageKeyRegistry.js';
import {
  flattenStoredSettingsDocuments as flattenSettingsDocuments,
  requireSettingsStoredDocument as requireSettingsDocument,
} from '../../../settings/settingsStoredValueContract.js';
import {
  areValuesEqual,
  isEmptyPlainObject,
  isPlainObject,
} from '../../storageValueUtils.js';
function readDocument(documents, documentKey) {
  if (!Object.prototype.hasOwnProperty.call(documents, documentKey)) return {};
  return { ...requireSettingsDocument(documentKey, documents[documentKey]) };
}

function uniqueValidDocumentKeys(documentKeys = []) {
  return Array.from(new Set(
    (Array.isArray(documentKeys) ? documentKeys : [])
      .filter((documentKey) => SETTINGS_DOCUMENT_KEYS.includes(documentKey))
  ));
}

function uniqueDocumentKeys(flatKeys = []) {
  return Array.from(new Set(
    (Array.isArray(flatKeys) ? flatKeys : [])
      .map((flatKey) => resolveSettingsDocumentKey(flatKey))
      .filter(Boolean)
  ));
}

async function writeSettingsDocuments(documents = {}, { removeMissing = false } = {}) {
  if (!isPlainObject(documents)) throw new Error('SETTINGS_DOCUMENT_CONTRACT_INVALID');
  const source = documents;
  for (const documentKey of Object.keys(source)) {
    if (!SETTINGS_DOCUMENT_KEYS.includes(documentKey)) throw new Error('SETTINGS_DOCUMENT_KEY_INVALID:' + documentKey);
  }
  const candidateKeys = uniqueValidDocumentKeys(Object.keys(source));
  const documentsToWrite = {};
  const documentsToRemove = [];

  candidateKeys.forEach((documentKey) => {
    const value = source[documentKey];
    if (isPlainObject(value)) {
      requireSettingsDocument(documentKey, value);
      documentsToWrite[documentKey] = { ...value };
      return;
    }
    if (value === null) {
      documentsToRemove.push(documentKey);
      return;
    }
    throw new Error('SETTINGS_DOCUMENT_CONTRACT_INVALID');
  });

  if (removeMissing) {
    SETTINGS_DOCUMENT_KEYS.forEach((documentKey) => {
      if (!Object.prototype.hasOwnProperty.call(source, documentKey)) {
        documentsToRemove.push(documentKey);
      }
    });
  }

  const uniqueRemovals = Array.from(new Set(documentsToRemove));
  if (uniqueRemovals.length > 0) {
    await removeChromeStorageLocal(uniqueRemovals);
  }
  if (Object.keys(documentsToWrite).length > 0) {
    await writeChromeStorageLocal(documentsToWrite);
  }

  return {
    written: Object.keys(documentsToWrite),
    removed: uniqueRemovals,
  };
}

async function setSettingsItems(items = {}) {
  if (!isPlainObject(items)) throw new Error('SETTINGS_ITEMS_CONTRACT_INVALID');
  const payload = items;
  const flatKeys = Object.keys(payload);
  for (const flatKey of flatKeys) {
    if (!resolveSettingsDocumentKey(flatKey)) throw new Error('SETTINGS_DOCUMENT_KEY_INVALID:' + flatKey);
  }
  if (!flatKeys.length) return { changedKeys: [], previousItems: {} };

  const documentKeys = uniqueDocumentKeys(flatKeys);
  const currentDocuments = await readChromeStorageLocal(documentKeys);
  const nextDocuments = {};
  const changedKeys = [];
  const previousItems = {};
  const changedDocumentKeys = new Set();
  const documentsToRemove = [];

  documentKeys.forEach((documentKey) => {
    nextDocuments[documentKey] = readDocument(currentDocuments, documentKey);
  });

  flatKeys.forEach((flatKey) => {
    const documentKey = resolveSettingsDocumentKey(flatKey);
    if (!documentKey) return;
    const nextDocument = nextDocuments[documentKey];
    const previous = Object.prototype.hasOwnProperty.call(nextDocument, flatKey)
      ? nextDocument[flatKey]
      : undefined;
    const nextValue = payload[flatKey];
    if (areValuesEqual(previous, nextValue)) return;
    changedKeys.push(flatKey);
    previousItems[flatKey] = previous;
    changedDocumentKeys.add(documentKey);
    if (typeof nextValue === 'undefined') {
      delete nextDocument[flatKey];
      return;
    }
    nextDocument[flatKey] = nextValue;
  });

  if (!changedKeys.length) return { changedKeys, previousItems };

  const documentsToWrite = {};
  changedDocumentKeys.forEach((documentKey) => {
    const nextDocument = nextDocuments[documentKey];
    if (isEmptyPlainObject(nextDocument)) {
      documentsToRemove.push(documentKey);
      return;
    }
    requireSettingsDocument(documentKey, nextDocument);
    documentsToWrite[documentKey] = nextDocument;
  });

  if (Object.keys(documentsToWrite).length > 0) {
    await writeChromeStorageLocal(documentsToWrite);
  }
  if (documentsToRemove.length > 0) {
    await removeChromeStorageLocal(documentsToRemove);
  }

  return { changedKeys, previousItems };
}

export class SettingsStore {
  #documentWriteQueue;

  constructor() {
    this.#documentWriteQueue = Promise.resolve();
  }

  static getInstance() {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  async get(defaults = {}) {
    if (defaults === null) {
      return this.getAll();
    }

    const requested = isPlainObject(defaults) ? defaults : {};
    const flatKeys = Object.keys(requested);
    if (!flatKeys.length) return {};

    const documentKeys = uniqueDocumentKeys(flatKeys);
    if (!documentKeys.length) {
      return { ...requested };
    }

    const documents = await readChromeStorageLocal(documentKeys);
    const flattened = flattenSettingsDocuments(documents);
    const resolved = {};

    flatKeys.forEach((flatKey) => {
      resolved[flatKey] = Object.prototype.hasOwnProperty.call(flattened, flatKey)
        ? flattened[flatKey]
        : requested[flatKey];
    });

    return resolved;
  }

  async getAll() {
    const documents = await readChromeStorageLocal(SETTINGS_DOCUMENT_KEYS);
    return flattenSettingsDocuments(documents);
  }

  async getDocuments(documentKeys = SETTINGS_DOCUMENT_KEYS) {
    const normalizedDocumentKeys = uniqueValidDocumentKeys(documentKeys);
    if (!normalizedDocumentKeys.length) return {};

    const documents = await readChromeStorageLocal(normalizedDocumentKeys);
    const resolved = {};
    normalizedDocumentKeys.forEach((documentKey) => {
      if (!Object.prototype.hasOwnProperty.call(documents, documentKey)) return;
      resolved[documentKey] = readDocument(documents, documentKey);
    });
    return resolved;
  }

  #enqueueDocumentWrite(operation) {
    const queuedOperation = this.#documentWriteQueue.then(() => operation());
    this.#documentWriteQueue = queuedOperation.catch(() => undefined);
    return queuedOperation;
  }

  writeDocuments(documents = {}, options = {}) {
    return this.#enqueueDocumentWrite(async () => {
      return writeSettingsDocuments(documents, options);
    });
  }

  set(items = {}) {
    return this.commitItems(items).then(({ changedKeys }) => changedKeys);
  }

  commitItems(items = {}) {
    return this.#enqueueDocumentWrite(async () => {
      return setSettingsItems(items);
    });
  }

  async clear() {
    await this.#enqueueDocumentWrite(() => removeChromeStorageLocal(SETTINGS_DOCUMENT_KEYS));
  }
}

export default SettingsStore;
