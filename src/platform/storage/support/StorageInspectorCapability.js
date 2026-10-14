import IndexedDbInspector from '../internal/indexeddb/IndexedDbInspector.js';
import EventLogRepository from '../logs/EventLogRepository.js';

export {
  STORAGE_SUPPORT_SESSION_KEYS,
} from '../internal/chrome-storage/storageSupportContracts.js';
export { STORAGE_SUPPORT_TASKS } from './storageSupportTaskContract.js';

function requireStorageInspectorCapabilityOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function requireStorageInspectorPlainObject(value, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireStorageInspectorArray(value, errorCode) {
  if (!Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireStorageInspectorNonNegativeInteger(value, errorCode) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(errorCode);
  }
  return Math.floor(numeric);
}

export class StorageInspectorCapability {
  constructor({
    indexedDbInspector = IndexedDbInspector.getInstance(),
    eventLogRepository = EventLogRepository.getInstance(),
  } = {}) {
    this.getIndexedDbOverviewOwner = requireStorageInspectorCapabilityOwnerMethod(
      indexedDbInspector,
      'getOverview',
      'STORAGE_INSPECTOR_CAPABILITY_INDEXED_DB_OWNER_REQUIRED',
    );
    this.getBufferedLogCountOwner = requireStorageInspectorCapabilityOwnerMethod(
      eventLogRepository,
      'getBufferedCount',
      'STORAGE_INSPECTOR_CAPABILITY_EVENT_LOG_OWNER_REQUIRED',
    );
  }

  static getInstance() {
    if (!StorageInspectorCapability.instance) {
      StorageInspectorCapability.instance = new StorageInspectorCapability();
    }
    return StorageInspectorCapability.instance;
  }

  async getIndexedDbOverview() {
    const overview = requireStorageInspectorPlainObject(
      await this.getIndexedDbOverviewOwner(),
      'STORAGE_INSPECTOR_CAPABILITY_INDEXED_DB_OVERVIEW_INVALID',
    );
    return {
      ...overview,
      stores: requireStorageInspectorArray(
        overview.stores,
        'STORAGE_INSPECTOR_CAPABILITY_INDEXED_DB_STORES_INVALID',
      ),
      bufferedLogCount: requireStorageInspectorNonNegativeInteger(
        this.getBufferedLogCountOwner(),
        'STORAGE_INSPECTOR_CAPABILITY_BUFFERED_LOG_COUNT_INVALID',
      ),
    };
  }
}

export default StorageInspectorCapability;
