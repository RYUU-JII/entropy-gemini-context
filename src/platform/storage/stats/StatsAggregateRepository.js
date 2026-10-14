import StatsAggregateStore from '../internal/indexeddb/stores/StatsAggregateStore.js';

function requireStatsAggregateStoreMethod(store, methodName, errorCode) {
  if (!store || typeof store[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return store[methodName].bind(store);
}

export class StatsAggregateRepository {
  constructor({ statsAggregateStore = StatsAggregateStore.getInstance() } = {}) {
    this.statsAggregateStore = statsAggregateStore;
    this.readHourlyBucketsRangeOwner = requireStatsAggregateStoreMethod(
      statsAggregateStore,
      'readHourlyBucketsRange',
      'STATS_AGGREGATE_REPOSITORY_HOURLY_RANGE_READER_REQUIRED',
    );
    this.finalizeHistoricalDayFactsOwner = requireStatsAggregateStoreMethod(
      statsAggregateStore,
      'finalizeHistoricalDayFacts',
      'STATS_AGGREGATE_REPOSITORY_HISTORICAL_FINALIZER_REQUIRED',
    );
    this.finalizeRecoveredHistoricalDayFactsOwner = requireStatsAggregateStoreMethod(
      statsAggregateStore,
      'finalizeRecoveredHistoricalDayFacts',
      'STATS_AGGREGATE_REPOSITORY_HISTORICAL_RECOVERY_FINALIZER_REQUIRED',
    );
    this.readHistoricalMaterializationDateIndexOwner = requireStatsAggregateStoreMethod(
      statsAggregateStore,
      'readHistoricalMaterializationDateIndex',
      'STATS_AGGREGATE_REPOSITORY_HISTORICAL_MATERIALIZATION_INDEX_READER_REQUIRED',
    );
  }

  static getInstance() {
    if (!StatsAggregateRepository.instance) {
      StatsAggregateRepository.instance = new StatsAggregateRepository();
    }
    return StatsAggregateRepository.instance;
  }

  getHourlyBuckets(options = {}) {
    return this.statsAggregateStore.getHourlyBuckets(options);
  }

  readHourlyBucketsRange(bounds = {}) {
    return this.readHourlyBucketsRangeOwner(bounds);
  }

  readHistoricalMaterializationDateIndex(bounds = {}) {
    return this.readHistoricalMaterializationDateIndexOwner(bounds);
  }

  upsertHourlyFactBuckets(buckets = []) {
    return this.statsAggregateStore.upsertHourlyFactBuckets(buckets);
  }

  finalizeHistoricalDayFacts(facts = {}) {
    return this.finalizeHistoricalDayFactsOwner(facts);
  }

  finalizeRecoveredHistoricalDayFacts(facts = {}) {
    return this.finalizeRecoveredHistoricalDayFactsOwner(facts);
  }

  getDailySummary(dateStr) {
    return this.statsAggregateStore.getDailySummary(dateStr);
  }

  getDailySummariesRange(bounds = {}) {
    return this.statsAggregateStore.getDailySummariesRange(bounds);
  }

  pruneBefore(cutoffDateStr) {
    return this.statsAggregateStore.pruneBefore(cutoffDateStr);
  }

  clearAll(options) {
    return this.statsAggregateStore.clearAll(options);
  }

}

export default StatsAggregateRepository;
