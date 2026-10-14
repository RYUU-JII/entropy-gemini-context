import ClseStore from '../internal/indexeddb/stores/ClseStore.js';

export class ClseRepository {
  static getInstance() {
    if (!ClseRepository.instance) {
      ClseRepository.instance = new ClseRepository();
    }
    return ClseRepository.instance;
  }

  constructor({ clseStore = ClseStore.getInstance() } = {}) {
    this.clseStore = clseStore;
    this.baselineEpochWriteTail = Promise.resolve();
  }

  enqueueBaselineEpochWrite(operation) {
    if (typeof operation !== 'function') {
      throw new Error('CLSE_REPOSITORY_BASELINE_EPOCH_OPERATION_REQUIRED');
    }
    const pending = this.baselineEpochWriteTail.then(operation);
    this.baselineEpochWriteTail = pending.catch(() => undefined);
    return pending;
  }

  runSnapshotEpochOperation(operation) {
    return this.enqueueBaselineEpochWrite(operation);
  }

  flushBaselineEpochWrites() {
    return this.baselineEpochWriteTail;
  }

  init() {
    return this.clseStore.init();
  }

  getBaseline() {
    return this.clseStore.getBaseline();
  }

  setBaseline(baseline) {
    return this.enqueueBaselineEpochWrite(() => this.clseStore.setBaseline(baseline));
  }

  resetBaseline(baseline, options = {}) {
    return this.enqueueBaselineEpochWrite(() => (
      this.clseStore.resetBaseline(baseline, options)
    ));
  }

  addAggressionLog(entry) {
    return this.enqueueBaselineEpochWrite(() => this.clseStore.addAggressionLog(entry));
  }

  getAggressionLogs(options = {}) {
    return this.clseStore.getAggressionLogs(options);
  }

  addBucket60s(bucket) {
    return this.clseStore.addBucket60s(bucket);
  }

  getBuckets60s(options = {}) {
    return this.clseStore.getBuckets60s(options);
  }

  getFirstBucket60s(options = {}) {
    return this.clseStore.getFirstBucket60s(options);
  }

  addBucket5min(bucket) {
    return this.clseStore.addBucket5min(bucket);
  }

  getBuckets5min(options = {}) {
    return this.clseStore.getBuckets5min(options);
  }

  addDailySummary(summary) {
    return this.clseStore.addDailySummary(summary);
  }

  getDailySummaries(options = {}) {
    return this.clseStore.getDailySummaries(options);
  }

  addLoopEvent(event) {
    return this.clseStore.addLoopEvent(event);
  }

  getLoopEvents(options = {}) {
    return this.clseStore.getLoopEvents(options);
  }

  pruneBefore(cutoffTs) {
    return this.enqueueBaselineEpochWrite(() => this.clseStore.pruneBefore(cutoffTs));
  }

  pruneTiers(options = {}) {
    return this.enqueueBaselineEpochWrite(() => this.clseStore.pruneTiers(options));
  }

  clear() {
    return this.enqueueBaselineEpochWrite(() => this.clseStore.clear());
  }
}

export default ClseRepository;
