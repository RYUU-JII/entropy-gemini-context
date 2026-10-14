import InterventionLedgerStore from '../internal/chrome-storage/session/InterventionLedgerStore.js';
import { STORAGE_SESSION_KEYS } from '../internal/chrome-storage/storageKeyRegistry.js';
import {
  INTERVENTION_LEDGER_CAPACITY,
  INTERVENTION_LEDGER_VERSION,
  createInterventionLedgerRecord,
  normalizeStoredInterventionLedgerRecord,
} from '../../../domains/protection/contracts/interventionLedgerContract.js';

const INTERVENTION_LEDGER_STORAGE_KEY = STORAGE_SESSION_KEYS.INTERVENTION_LEDGER;

const DEFAULT_INTERVENTION_LEDGER_STATE = Object.freeze({
  version: INTERVENTION_LEDGER_VERSION,
  sequence: 0,
  records: Object.freeze([]),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStoredState(rawState) {
  if (!isPlainObject(rawState)) return DEFAULT_INTERVENTION_LEDGER_STATE;
  const records = Array.isArray(rawState.records)
    ? rawState.records
      .map((entry) => normalizeStoredInterventionLedgerRecord(entry))
      .filter(Boolean)
    : [];
  const trimmed = records.length > INTERVENTION_LEDGER_CAPACITY
    ? records.slice(records.length - INTERVENTION_LEDGER_CAPACITY)
    : records;
  const storedSequence = Number(rawState.sequence);
  const highestRecordSequence = trimmed.reduce(
    (highest, record) => (record.sequence > highest ? record.sequence : highest),
    0,
  );
  const sequence = Number.isInteger(storedSequence) && storedSequence >= highestRecordSequence
    ? storedSequence
    : highestRecordSequence;

  return {
    version: INTERVENTION_LEDGER_VERSION,
    sequence,
    records: trimmed,
  };
}

export class InterventionLedgerRepository {
  static getInstance() {
    if (!InterventionLedgerRepository.instance) {
      InterventionLedgerRepository.instance = new InterventionLedgerRepository();
    }
    return InterventionLedgerRepository.instance;
  }

  constructor({ interventionLedgerStore = InterventionLedgerStore.getInstance() } = {}) {
    this.interventionLedgerStore = interventionLedgerStore;
    // Serializes read-modify-write cycles so concurrent appends cannot drop
    // records or reuse a sequence number.
    this.writeTail = Promise.resolve();
  }

  async readState() {
    const items = await this.interventionLedgerStore.get({
      [INTERVENTION_LEDGER_STORAGE_KEY]: DEFAULT_INTERVENTION_LEDGER_STATE,
    });
    return normalizeStoredState(items[INTERVENTION_LEDGER_STORAGE_KEY]);
  }

  /**
   * Appends one or more drafts as a single atomic revision. Sequence numbers are
   * allocated here so they stay monotonic across concurrent callers.
   */
  async append(drafts) {
    const draftList = Array.isArray(drafts) ? drafts : [drafts];
    if (!draftList.length) {
      throw new Error('INTERVENTION_LEDGER_APPEND_DRAFTS_REQUIRED');
    }

    const execution = this.writeTail
      .catch(() => undefined)
      .then(async () => {
        const currentState = await this.readState();
        let sequence = currentState.sequence;
        const appended = draftList.map((draft) => {
          sequence += 1;
          return createInterventionLedgerRecord({ ...draft, sequence });
        });
        const mergedRecords = [...currentState.records, ...appended];
        const records = mergedRecords.length > INTERVENTION_LEDGER_CAPACITY
          ? mergedRecords.slice(mergedRecords.length - INTERVENTION_LEDGER_CAPACITY)
          : mergedRecords;

        await this.interventionLedgerStore.set({
          [INTERVENTION_LEDGER_STORAGE_KEY]: {
            version: INTERVENTION_LEDGER_VERSION,
            sequence,
            records,
          },
        });
        return appended;
      });

    this.writeTail = execution.then(() => undefined, () => undefined);
    return execution;
  }

  async readRecent({ limit = INTERVENTION_LEDGER_CAPACITY, since = 0 } = {}) {
    const normalizedLimit = Number(limit);
    if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
      throw new Error('INTERVENTION_LEDGER_READ_LIMIT_INVALID');
    }
    const normalizedSince = Number(since);
    if (!Number.isInteger(normalizedSince) || normalizedSince < 0) {
      throw new Error('INTERVENTION_LEDGER_READ_SINCE_INVALID');
    }

    const state = await this.readState();
    const filtered = normalizedSince > 0
      ? state.records.filter((record) => record.at >= normalizedSince)
      : state.records;
    return filtered.length > normalizedLimit
      ? filtered.slice(filtered.length - normalizedLimit)
      : filtered;
  }

  async clearAll() {
    await this.interventionLedgerStore.remove([INTERVENTION_LEDGER_STORAGE_KEY]);
  }
}

export default InterventionLedgerRepository;
