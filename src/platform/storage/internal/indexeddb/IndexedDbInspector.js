import IndexedDbSnapshotRepository from './IndexedDbSnapshotRepository.js';
import StatsAggregateStore from './stores/StatsAggregateStore.js';

function normalizeStoreCounts(storeCounts = {}) {
  return Object.entries(storeCounts || {})
    .map(([storeName, count]) => ({
      storeName,
      count: Number(count) || 0,
    }))
    .sort((left, right) => left.storeName.localeCompare(right.storeName));
}

function requireIndexedDbInspectorOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    const error = new Error(errorCode);
    error.code = errorCode;
    throw error;
  }
  return owner[methodName].bind(owner);
}

export class IndexedDbInspector {
  static getInstance() {
    if (!IndexedDbInspector.instance) {
      IndexedDbInspector.instance = new IndexedDbInspector();
    }
    return IndexedDbInspector.instance;
  }

  constructor({
    indexedDbSnapshotRepository = IndexedDbSnapshotRepository.getInstance(),
    statsAggregateStore = StatsAggregateStore.getInstance(),
  } = {}) {
    this.getStoreCountsOwner = requireIndexedDbInspectorOwnerMethod(
      indexedDbSnapshotRepository,
      'getStoreCounts',
      'INDEXED_DB_INSPECTOR_STORE_COUNTS_OWNER_REQUIRED',
    );
    this.getHourlyLedgerDiagnosticsOwner = requireIndexedDbInspectorOwnerMethod(
      statsAggregateStore,
      'getHourlyLedgerDiagnostics',
      'INDEXED_DB_INSPECTOR_HOURLY_LEDGER_DIAGNOSTICS_OWNER_REQUIRED',
    );
  }

  async getOverview() {
    const storeCounts = await this.getStoreCountsOwner();
    let statsHourly = null;
    try {
      statsHourly = await this.getHourlyLedgerDiagnosticsOwner();
    } catch (error) {
      statsHourly = {
        error: error?.message || String(error),
      };
    }
    return {
      stores: normalizeStoreCounts(storeCounts),
      statsHourly,
    };
  }
}

export default IndexedDbInspector;
