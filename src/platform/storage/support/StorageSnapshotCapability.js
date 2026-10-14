import * as storageSnapshotService from '../internal/storageSnapshotService.js';

function requireStorageSnapshotCapabilityOwner(ownerFn, errorCode) {
  if (typeof ownerFn !== 'function') {
    throw new Error(errorCode);
  }
  return ownerFn;
}

export class StorageSnapshotCapability {
  static getInstance() {
    if (!StorageSnapshotCapability.instance) {
      StorageSnapshotCapability.instance = new StorageSnapshotCapability();
    }
    return StorageSnapshotCapability.instance;
  }

  constructor({
    exportStorageSnapshot = storageSnapshotService.exportStorageSnapshot,
    importStorageSnapshot = storageSnapshotService.importStorageSnapshot,
    preflightStorageSnapshot = storageSnapshotService.preflightStorageSnapshot,
    getStorageSnapshotFormat = storageSnapshotService.getStorageSnapshotFormat,
  } = {}) {
    this.exportStorageSnapshot = requireStorageSnapshotCapabilityOwner(
      exportStorageSnapshot,
      'STORAGE_SNAPSHOT_CAPABILITY_EXPORT_OWNER_REQUIRED',
    );
    this.importStorageSnapshot = requireStorageSnapshotCapabilityOwner(
      importStorageSnapshot,
      'STORAGE_SNAPSHOT_CAPABILITY_IMPORT_OWNER_REQUIRED',
    );
    this.preflightStorageSnapshot = requireStorageSnapshotCapabilityOwner(
      preflightStorageSnapshot,
      'STORAGE_SNAPSHOT_CAPABILITY_PREFLIGHT_OWNER_REQUIRED',
    );
    this.getStorageSnapshotFormat = requireStorageSnapshotCapabilityOwner(
      getStorageSnapshotFormat,
      'STORAGE_SNAPSHOT_CAPABILITY_FORMAT_OWNER_REQUIRED',
    );
  }

  async exportSnapshot(options = {}) {
    return this.exportStorageSnapshot(options);
  }

  async importSnapshot(snapshot, options = {}) {
    return this.importStorageSnapshot(snapshot, options);
  }

  preflightImport(snapshot, options = {}) {
    return this.preflightStorageSnapshot(snapshot, options);
  }

  getFormat() {
    return this.getStorageSnapshotFormat();
  }
}

export default StorageSnapshotCapability;
