import { getLocalDateStr } from '../../../../../lib/index.js';
import DBManager from '../dbManager.js';
import { requireInterventionHistoryFacts } from '../../../../../domains/stats/contracts/interventionHistoryReceipt.js';
import { STORES } from '../dbConstants.js';
import {
  normalizeDailySummaryDateStr,
  normalizeStatsTransitionDomain,
  resolveStatsHourlyBucketStartTs,
  toFiniteTimestamp,
} from '../dbStatsNormalizers.js';
import {
  resolveInterventionEffectMetadata,
} from '../../../../../domains/stats/contracts/interventionEffectContracts.js';

export const INTERVENTION_EXPOSURE_SCHEMA_VERSION = 1;
export const INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION = 1;

const OUTCOME_SET = new Set(['shown', 'continued', 'left', 'escape_closed', 'reentered']);
const REENTRY_WITHIN_5M_EVENT = 'reentered_within_5m';
const REENTRY_WITHIN_30M_EVENT = 'reentered_within_30m';
const OUTCOME_EVENT_SET = new Set([
  ...OUTCOME_SET,
  REENTRY_WITHIN_5M_EVENT,
  REENTRY_WITHIN_30M_EVENT,
]);
const OUTCOME_EVENT_COUNTERS = Object.freeze({
  shown: 'shown',
  continued: 'continued',
  left: 'left',
  escape_closed: 'escapeClosed',
  reentered: 'reentered',
  [REENTRY_WITHIN_5M_EVENT]: 'reenteredWithin5m',
  [REENTRY_WITHIN_30M_EVENT]: 'reenteredWithin30m',
});
const OUTCOME_LATENCY_EVENT_SET = new Set(['continued', 'left', 'escape_closed', 'reentered']);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function areJsonValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areJsonValuesEqual(value, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && areJsonValuesEqual(left[key], right[key])
    ));
}

function createInterventionEffectStoreError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireStoredSchemaVersion(row, expectedVersion, errorCode) {
  if (!isPlainObject(row) || row.schemaVersion !== expectedVersion) {
    throw createInterventionEffectStoreError(errorCode);
  }
  return row;
}

function requireCanonicalStoredRow(row, normalizeRow, errorCode) {
  const normalized = normalizeRow(row);
  if (!normalized || !areJsonValuesEqual(row, normalized)) {
    throw createInterventionEffectStoreError(errorCode);
  }
  return normalized;
}

function toCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function normalizeString(value, {
  maxLength = 128,
  fallback = '',
  lowercase = false,
} = {}) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return fallback;
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

function normalizeArtifactId(value) {
  const normalized = normalizeString(value, { maxLength: 128 });
  return normalized.toLowerCase() === 'unknown' ? '' : normalized;
}

function normalizeId(value) {
  return normalizeString(value, { maxLength: 160 });
}

function normalizeLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function normalizeOutcome(value, fallback = '') {
  const normalized = normalizeString(value, { maxLength: 64, lowercase: true });
  return OUTCOME_SET.has(normalized) ? normalized : fallback;
}

function normalizeOutcomeEvent(value) {
  const normalized = normalizeString(value, { maxLength: 80, lowercase: true });
  return OUTCOME_EVENT_SET.has(normalized) ? normalized : '';
}

function normalizeRecordedOutcomeEvents({
  recordedOutcomeEvents,
  outcome,
  reenteredWithin5m = false,
  reenteredWithin30m = false,
} = {}) {
  const events = new Set();
  (Array.isArray(recordedOutcomeEvents) ? recordedOutcomeEvents : []).forEach((event) => {
    const normalizedEvent = normalizeOutcomeEvent(event);
    if (normalizedEvent) events.add(normalizedEvent);
  });

  const normalizedOutcome = normalizeOutcome(outcome, 'shown');
  if (normalizedOutcome) events.add(normalizedOutcome);
  if (reenteredWithin5m === true) events.add(REENTRY_WITHIN_5M_EVENT);
  if (reenteredWithin30m === true) events.add(REENTRY_WITHIN_30M_EVENT);
  events.add('shown');

  return Array.from(events).sort();
}

function normalizeStringList(values = [], { maxLength = 64, limit = 12 } = {}) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeString(value, { maxLength }))
      .filter(Boolean),
  )).slice(0, limit);
}

function dateStrFromTs(ts, fallback = null) {
  const timestamp = toFiniteTimestamp(ts);
  if (timestamp === null) return fallback;
  return getLocalDateStr(timestamp);
}

function buildEffectKey({
  dateStr,
  domain,
  artifactFamily,
  artifactId,
  gateKind,
  level,
} = {}) {
  const parts = [
    normalizeDailySummaryDateStr(dateStr),
    normalizeStatsTransitionDomain(domain),
    normalizeString(artifactFamily, { maxLength: 80 }),
    normalizeString(artifactId, { maxLength: 128 }),
    normalizeString(gateKind, { maxLength: 80 }),
    String(normalizeLevel(level)),
  ];
  if (parts.some((part) => !part)) return null;
  return parts.join('|');
}

export function normalizeInterventionExposureRow(row = {}) {
  if (!isPlainObject(row)) return null;
  if (row.schemaVersion !== INTERVENTION_EXPOSURE_SCHEMA_VERSION) return null;
  const exposureId = normalizeId(row.exposureId);
  const domain = normalizeStatsTransitionDomain(row.domain);
  const shownAt = toFiniteTimestamp(row.shownAt);
  const dateStr = normalizeDailySummaryDateStr(row.dateStr) || dateStrFromTs(shownAt);
  const artifactFamily = normalizeString(row.artifactFamily, { maxLength: 80 });
  const artifactId = normalizeArtifactId(row.artifactId);
  if (!exposureId || !domain || !dateStr || shownAt === null || !artifactFamily || !artifactId) return null;
  const outcome = normalizeOutcome(row.outcome, 'shown');
  const outcomeAt = toFiniteTimestamp(row.outcomeAt);
  const outcomeLatencyMs = outcomeAt !== null && shownAt > 0
    ? Math.max(0, outcomeAt - shownAt)
    : Math.max(0, Math.floor(Number(row.outcomeLatencyMs) || 0));
  const reenteredWithin5m = row.reenteredWithin5m === true;
  const reenteredWithin30m = row.reenteredWithin30m === true;
  const metadata = resolveInterventionEffectMetadata(row);
  const recordedEvents = normalizeRecordedOutcomeEvents({ recordedOutcomeEvents: row.recordedOutcomeEvents,
    outcome, reenteredWithin5m, reenteredWithin30m });
  const historyFacts = Object.hasOwn(row, 'historyFacts')
    ? requireInterventionHistoryFacts(row.historyFacts, shownAt, recordedEvents) : null;
  if (historyFacts) {
    const reentry = historyFacts.reentered;
    const elapsed = reentry ? reentry.at - reentry.shownAt : 0;
    if (historyFacts.shown.dateStr !== dateStr
      || reenteredWithin5m !== (elapsed > 0 && elapsed <= 300_000)
      || reenteredWithin30m !== (elapsed > 0 && elapsed <= 1_800_000)) {
      throw createInterventionEffectStoreError('INTERVENTION_HISTORY_FACTS_MISMATCH');
    }
  }

  return {
    exposureId,
    dateStr,
    domain,
    shownAt,
    gateKind: normalizeString(row.gateKind, { maxLength: 80 }),
    artifactFamily,
    artifactId,
    themeId: normalizeString(row.themeId, { maxLength: 80 }),
    rendererId: normalizeString(row.rendererId, { maxLength: 128 }),
    level: normalizeLevel(row.level),
    activeChildIds: normalizeStringList(row.activeChildIds),
    pressureSignals: normalizeStringList(row.pressureSignals),
    directTriggers: normalizeStringList(row.directTriggers),
    policyContextHash: normalizeString(row.policyContextHash, { maxLength: 128 }),
    ...metadata,
    outcomeReason: normalizeString(row.outcomeReason, { maxLength: 80 }),
    outcome,
    outcomeAt,
    outcomeLatencyMs,
    reenteredWithin5m,
    reenteredWithin30m,
    recordedOutcomeEvents: recordedEvents,
    ...(historyFacts ? { historyFacts } : {}),
    updatedAt: toFiniteTimestamp(row.updatedAt) ?? Date.now(),
    schemaVersion: INTERVENTION_EXPOSURE_SCHEMA_VERSION,
  };
}

function createHistoryFact(at, shownAt) {
  const dateStr = getLocalDateStr(at);
  return { at, shownAt, dateStr, bucketStartTs: resolveStatsHourlyBucketStartTs(dateStr, new Date(at).getHours()) };
}

export function mergeInterventionExposureOutcome(current = null, outcome = {}) {
  const base = normalizeInterventionExposureRow(current);
  if (!base) return null;
  const normalizedOutcome = normalizeOutcome(outcome.outcome);
  if (!normalizedOutcome || normalizedOutcome === 'shown') return base;
  const outcomeAt = toFiniteTimestamp(outcome.outcomeAt) ?? toFiniteTimestamp(outcome.now) ?? Date.now();
  if (outcomeAt < base.shownAt) {
    throw createInterventionEffectStoreError('INTERVENTION_OUTCOME_BEFORE_EXPOSURE');
  }
  // A replay cannot enrich or retime an already committed event. Old stored
  // rows without this capability remain readable, without invented receipts.
  if (Object.hasOwn(base, 'historyFacts') && Object.hasOwn(base.historyFacts, normalizedOutcome)) return base;
  const reentryAnchor = normalizedOutcome === 'reentered' && Object.hasOwn(outcome, 'shownAt') ? outcome.shownAt : base.shownAt;
  const reentryElapsed = outcomeAt - reentryAnchor;
  const hasHistoryFacts = Object.hasOwn(base, 'historyFacts');
  const latency = outcomeAt - base.shownAt;
  return normalizeInterventionExposureRow({
    ...base,
    ...(hasHistoryFacts ? { historyFacts: {
      ...base.historyFacts,
      [normalizedOutcome]: createHistoryFact(outcomeAt, reentryAnchor),
    } } : {}),
    outcome: normalizedOutcome,
    outcomeAt,
    outcomeLatencyMs: latency,
    reenteredWithin5m: base.reenteredWithin5m || (hasHistoryFacts
      ? normalizedOutcome === 'reentered' && reentryElapsed > 0 && reentryElapsed <= 300_000
      : outcome.reenteredWithin5m === true),
    reenteredWithin30m: base.reenteredWithin30m || (hasHistoryFacts
      ? normalizedOutcome === 'reentered' && reentryElapsed > 0 && reentryElapsed <= 1_800_000
      : outcome.reenteredWithin30m === true),
    updatedAt: outcomeAt,
  });
}

function createEmptyEffectCounters() {
  return {
    shown: 0,
    continued: 0,
    left: 0,
    escapeClosed: 0,
    reentered: 0,
    reenteredWithin5m: 0,
    reenteredWithin30m: 0,
    totalOutcomeLatencyMs: 0,
    outcomeCount: 0,
  };
}

export function normalizeInterventionEffectDailyRow(row = {}) {
  if (!isPlainObject(row)) return null;
  if (row.schemaVersion !== INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION) return null;
  const dateStr = normalizeDailySummaryDateStr(row.dateStr);
  const domain = normalizeStatsTransitionDomain(row.domain);
  const artifactFamily = normalizeString(row.artifactFamily, { maxLength: 80 });
  const artifactId = normalizeArtifactId(row.artifactId);
  const gateKind = normalizeString(row.gateKind, { maxLength: 80 });
  const level = normalizeLevel(row.level);
  const id = buildEffectKey({ dateStr, domain, artifactFamily, artifactId, gateKind, level });
  if (!id) return null;
  const metadata = resolveInterventionEffectMetadata({
    ...row,
    artifactFamily,
    artifactId,
    gateKind,
    level,
  });
  const counters = {
    ...createEmptyEffectCounters(),
    ...(isPlainObject(row.counters) ? row.counters : {}),
  };
  return {
    id,
    dateStr,
    domain,
    artifactFamily,
    artifactId,
    gateKind,
    level,
    interventionClass: metadata.interventionClass,
    resistanceEligible: metadata.resistanceEligible,
    effectivenessEligible: metadata.effectivenessEligible,
    severity: metadata.severity,
    holdDurationMs: metadata.holdDurationMs,
    levelRecipeVersion: metadata.levelRecipeVersion,
    artifactVector: metadata.artifactVector,
    strategyState: metadata.strategyState,
    intensityVector: metadata.intensityVector,
    counters: {
      shown: toCount(counters.shown),
      continued: toCount(counters.continued),
      left: toCount(counters.left),
      escapeClosed: toCount(counters.escapeClosed),
      reentered: toCount(counters.reentered),
      reenteredWithin5m: toCount(counters.reenteredWithin5m),
      reenteredWithin30m: toCount(counters.reenteredWithin30m),
      totalOutcomeLatencyMs: toCount(counters.totalOutcomeLatencyMs),
      outcomeCount: toCount(counters.outcomeCount),
    },
    updatedAt: toFiniteTimestamp(row.updatedAt) ?? Date.now(),
    schemaVersion: INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION,
  };
}

function resolveNewOutcomeEvents(current = null, next = null) {
  const previousExposure = normalizeInterventionExposureRow(current);
  const nextExposure = normalizeInterventionExposureRow(next);
  if (!nextExposure) return [];
  const previousEvents = new Set(previousExposure?.recordedOutcomeEvents || []);
  return nextExposure.recordedOutcomeEvents
    .filter((event) => !previousEvents.has(event));
}

function incrementDailyEffectRow(current = null, exposure = {}, outcomeEvents = ['shown']) {
  const normalizedExposure = normalizeInterventionExposureRow(exposure);
  if (!normalizedExposure) return null;
  const events = Array.from(new Set(
    (Array.isArray(outcomeEvents) ? outcomeEvents : [outcomeEvents])
      .map((event) => normalizeOutcomeEvent(event))
      .filter(Boolean),
  ));
  if (events.length === 0) return null;
  const base = normalizeInterventionEffectDailyRow(current) || normalizeInterventionEffectDailyRow({
    schemaVersion: INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION,
    dateStr: normalizedExposure.dateStr,
    domain: normalizedExposure.domain,
    artifactFamily: normalizedExposure.artifactFamily,
    artifactId: normalizedExposure.artifactId,
    gateKind: normalizedExposure.gateKind,
    level: normalizedExposure.level,
    counters: createEmptyEffectCounters(),
  });
  if (!base) return null;
  const counters = { ...base.counters };
  events.forEach((event) => {
    const counterKey = OUTCOME_EVENT_COUNTERS[event];
    if (!counterKey) return;
    counters[counterKey] += 1;
    if (OUTCOME_LATENCY_EVENT_SET.has(event)
      && normalizedExposure.outcome === event
      && normalizedExposure.outcomeLatencyMs > 0) {
      counters.totalOutcomeLatencyMs += toCount(normalizedExposure.outcomeLatencyMs);
      counters.outcomeCount += 1;
    }
  });
  return {
    ...base,
    ...resolveInterventionEffectMetadata(normalizedExposure),
    counters,
    updatedAt: Date.now(),
  };
}

export class InterventionEffectStore {
  #exposureOperationTails = new Map();

  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  static getInstance() {
    if (!InterventionEffectStore.instance) {
      InterventionEffectStore.instance = new InterventionEffectStore();
    }
    return InterventionEffectStore.instance;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw createInterventionEffectStoreError('INTERVENTION_EFFECT_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  #serializeExposureOperation(exposureId, task) {
    const previousTail = this.#exposureOperationTails.get(exposureId) || Promise.resolve();
    const operation = previousTail.then(task, task);
    const settledTail = operation.catch(() => undefined);
    this.#exposureOperationTails.set(exposureId, settledTail);
    void settledTail.then(() => {
      if (this.#exposureOperationTails.get(exposureId) === settledTail) {
        this.#exposureOperationTails.delete(exposureId);
      }
    });
    return operation;
  }

  async #commitExposureEffectMutation(exposureId, resolveMutation) {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([
        STORES.INTERVENTION_EXPOSURES,
        STORES.INTERVENTION_EFFECT_DAILY,
      ], 'readwrite');
      const exposureStore = tx.objectStore(STORES.INTERVENTION_EXPOSURES);
      const effectStore = tx.objectStore(STORES.INTERVENTION_EFFECT_DAILY);
      let result = null;
      let failed = false;

      const fail = (error, fallbackCode) => {
        if (failed) return;
        failed = true;
        const failure = error || new Error(fallbackCode);
        try {
          tx.abort?.();
        } catch {
          // The transaction may already be aborting because of a request error.
        }
        reject(failure);
      };

      tx.oncomplete = () => {
        if (!failed) resolve(result);
      };
      tx.onerror = () => fail(tx.error, 'INTERVENTION_EFFECT_MUTATION_FAILED');
      tx.onabort = () => fail(tx.error, 'INTERVENTION_EFFECT_MUTATION_ABORTED');

      const exposureRequest = exposureStore.get(exposureId);
      exposureRequest.onerror = () => fail(
        exposureRequest.error,
        'INTERVENTION_EXPOSURE_READ_FAILED',
      );
      exposureRequest.onsuccess = () => {
        if (failed) return;
        try {
          const storedExposure = typeof exposureRequest.result === 'undefined'
            ? null
            : exposureRequest.result;
          const currentExposure = storedExposure
            ? requireCanonicalStoredRow(
              requireStoredSchemaVersion(
                storedExposure,
                INTERVENTION_EXPOSURE_SCHEMA_VERSION,
                'INTERVENTION_EXPOSURE_STORED_VERSION_UNSUPPORTED',
              ),
              normalizeInterventionExposureRow,
              'INTERVENTION_EXPOSURE_STORED_ROW_INVALID',
            )
            : null;
          if (storedExposure && !currentExposure) {
            throw new Error('INTERVENTION_EXPOSURE_STORED_ROW_INVALID');
          }

          const mutation = resolveMutation(currentExposure);
          const nextExposure = mutation?.nextExposure || null;
          const outcomeEvents = Array.isArray(mutation?.outcomeEvents)
            ? mutation.outcomeEvents
            : [];
          result = mutation?.result || nextExposure || currentExposure;
          if (!nextExposure || outcomeEvents.length === 0) return;

          const effectId = buildEffectKey(nextExposure);
          if (!effectId) {
            throw new Error('INTERVENTION_EFFECT_KEY_REQUIRED');
          }
          const effectRequest = effectStore.get(effectId);
          effectRequest.onerror = () => fail(
            effectRequest.error,
            'INTERVENTION_EFFECT_DAILY_READ_FAILED',
          );
          effectRequest.onsuccess = () => {
            if (failed) return;
            try {
              const storedEffect = typeof effectRequest.result === 'undefined'
                ? null
                : effectRequest.result;
              const currentEffect = storedEffect
                ? requireCanonicalStoredRow(
                  requireStoredSchemaVersion(
                    storedEffect,
                    INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION,
                    'INTERVENTION_EFFECT_DAILY_STORED_VERSION_UNSUPPORTED',
                  ),
                  normalizeInterventionEffectDailyRow,
                  'INTERVENTION_EFFECT_DAILY_STORED_ROW_INVALID',
                )
                : null;
              if (storedEffect && !currentEffect) {
                throw new Error('INTERVENTION_EFFECT_DAILY_STORED_ROW_INVALID');
              }
              const nextEffect = normalizeInterventionEffectDailyRow(
                incrementDailyEffectRow(currentEffect, nextExposure, outcomeEvents),
              );
              if (!nextEffect) {
                throw new Error('INTERVENTION_EFFECT_DAILY_INCREMENT_FAILED');
              }

              exposureStore.put({
                ...nextExposure,
                updatedAt: toFiniteTimestamp(nextExposure.updatedAt) ?? Date.now(),
              });
              effectStore.put({
                ...nextEffect,
                updatedAt: toFiniteTimestamp(nextEffect.updatedAt) ?? Date.now(),
              });
              result = nextExposure;
            } catch (error) {
              fail(error, 'INTERVENTION_EFFECT_MUTATION_FAILED');
            }
          };
        } catch (error) {
          fail(error, 'INTERVENTION_EFFECT_MUTATION_FAILED');
        }
      };
    });
  }

  async readExposure(exposureId) {
    const normalizedExposureId = normalizeId(exposureId);
    if (!normalizedExposureId) {
      throw createInterventionEffectStoreError('INTERVENTION_EXPOSURE_ID_REQUIRED');
    }
    const db = await this.getDatabase();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.INTERVENTION_EXPOSURES, 'readonly');
      const store = tx.objectStore(STORES.INTERVENTION_EXPOSURES);
      const req = store.get(normalizedExposureId);
      req.onsuccess = () => resolve(
        typeof req.result === 'undefined' ? null : req.result,
      );
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    if (!row) return null;
    return requireCanonicalStoredRow(
      requireStoredSchemaVersion(
        row,
        INTERVENTION_EXPOSURE_SCHEMA_VERSION,
        'INTERVENTION_EXPOSURE_STORED_VERSION_UNSUPPORTED',
      ),
      normalizeInterventionExposureRow,
      'INTERVENTION_EXPOSURE_STORED_ROW_INVALID',
    );
  }

  async readEffectDaily(row = {}) {
    const id = buildEffectKey(row);
    if (!id) throw createInterventionEffectStoreError('INTERVENTION_EFFECT_KEY_REQUIRED');
    const db = await this.getDatabase();
    const stored = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.INTERVENTION_EFFECT_DAILY, 'readonly');
      const store = tx.objectStore(STORES.INTERVENTION_EFFECT_DAILY);
      const req = store.get(id);
      req.onsuccess = () => resolve(
        typeof req.result === 'undefined' ? null : req.result,
      );
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    if (!stored) return null;
    return requireCanonicalStoredRow(
      requireStoredSchemaVersion(
        stored,
        INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION,
        'INTERVENTION_EFFECT_DAILY_STORED_VERSION_UNSUPPORTED',
      ),
      normalizeInterventionEffectDailyRow,
      'INTERVENTION_EFFECT_DAILY_STORED_ROW_INVALID',
    );
  }

  async readEffectDailyRange({
    startDateStr,
    endDateStr,
    domain = null,
  } = {}) {
    const start = normalizeDailySummaryDateStr(startDateStr);
    const end = normalizeDailySummaryDateStr(endDateStr);
    const normalizedDomain = normalizeStatsTransitionDomain(domain);
    if (!start || !end) {
      throw createInterventionEffectStoreError('INTERVENTION_EFFECT_RANGE_REQUIRED');
    }
    if (domain !== null && typeof domain !== 'undefined' && !normalizedDomain) {
      throw createInterventionEffectStoreError('INTERVENTION_EFFECT_RANGE_DOMAIN_INVALID');
    }
    const db = await this.getDatabase();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.INTERVENTION_EFFECT_DAILY, 'readonly');
      const store = tx.objectStore(STORES.INTERVENTION_EFFECT_DAILY);
      const index = store.index('dateStr');
      const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
      const req = index.getAll(IDBKeyRange.bound(rangeStart, rangeEnd));
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });

    return rows
      .map((row) => {
        return requireCanonicalStoredRow(
          requireStoredSchemaVersion(
            row,
            INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION,
            'INTERVENTION_EFFECT_DAILY_STORED_VERSION_UNSUPPORTED',
          ),
          normalizeInterventionEffectDailyRow,
          'INTERVENTION_EFFECT_DAILY_STORED_ROW_INVALID',
        );
      })
      .filter((row) => !normalizedDomain || row.domain === normalizedDomain);
  }

  async #recordExposureOwned(exposure) {
    if (!exposure) return null;
    return this.#commitExposureEffectMutation(exposure.exposureId, (current) => {
      if (current) {
        return {
          result: current,
          nextExposure: null,
          outcomeEvents: [],
        };
      }
      return {
        result: exposure,
        nextExposure: exposure,
        outcomeEvents: ['shown'],
      };
    });
  }

  async recordExposure(row = {}) {
    const exposure = normalizeInterventionExposureRow({
      schemaVersion: INTERVENTION_EXPOSURE_SCHEMA_VERSION,
      ...row,
      outcome: 'shown',
      reenteredWithin5m: false,
      reenteredWithin30m: false,
    });
    if (!exposure) {
      throw createInterventionEffectStoreError('INTERVENTION_EXPOSURE_ROW_INVALID');
    }
    exposure.historyFacts = requireInterventionHistoryFacts({ shown: createHistoryFact(exposure.shownAt, exposure.shownAt) },
      exposure.shownAt, exposure.recordedOutcomeEvents);
    return this.#serializeExposureOperation(
      exposure.exposureId,
      () => this.#recordExposureOwned(exposure),
    );
  }

  async recordOutcome({ exposureId, outcome, now = Date.now(), ...rest } = {}) {
    const normalizedExposureId = normalizeId(exposureId);
    const normalizedOutcome = normalizeOutcome(outcome);
    const normalizedNow = toFiniteTimestamp(now);
    if (!normalizedExposureId) {
      throw createInterventionEffectStoreError('INTERVENTION_EXPOSURE_ID_REQUIRED');
    }
    if (!normalizedOutcome || normalizedOutcome === 'shown' || normalizedNow === null) {
      throw createInterventionEffectStoreError('INTERVENTION_OUTCOME_ROW_INVALID');
    }
    return this.#serializeExposureOperation(normalizedExposureId, () => (
      this.#commitExposureEffectMutation(normalizedExposureId, (current) => {
        if (!current) {
          throw createInterventionEffectStoreError('INTERVENTION_OUTCOME_EXPOSURE_REQUIRED');
        }
        const nextExposure = mergeInterventionExposureOutcome(current, {
          ...rest,
          outcome: normalizedOutcome,
          now: normalizedNow,
        });
        if (!nextExposure) {
          throw createInterventionEffectStoreError('INTERVENTION_OUTCOME_MERGE_FAILED');
        }
        const newOutcomeEvents = resolveNewOutcomeEvents(current, nextExposure);
        return {
          result: newOutcomeEvents.length > 0
            ? nextExposure
            : (normalizeInterventionExposureRow(current) || nextExposure),
          nextExposure,
          outcomeEvents: newOutcomeEvents,
        };
      })
    ));
  }

  getExposure(exposureId) {
    const normalizedExposureId = normalizeId(exposureId);
    if (!normalizedExposureId) {
      return Promise.reject(createInterventionEffectStoreError('INTERVENTION_EXPOSURE_ID_REQUIRED'));
    }
    return this.readExposure(normalizedExposureId);
  }

  getEffectsRange(options = {}) {
    return this.readEffectDailyRange(options);
  }

  async pruneExposuresBefore(cutoffTs) {
    const cutoff = toFiniteTimestamp(cutoffTs);
    if (cutoff === null) {
      throw createInterventionEffectStoreError('INTERVENTION_EXPOSURE_PRUNE_CUTOFF_REQUIRED');
    }
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.INTERVENTION_EXPOSURES, 'readwrite');
      const store = tx.objectStore(STORES.INTERVENTION_EXPOSURES);
      const index = store.index('shownAt');
      const req = index.openCursor(IDBKeyRange.upperBound(cutoff, true));
      let removed = 0;
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error);
    });
  }

  async pruneEffectsBefore(cutoffDateStr) {
    const normalizedDateStr = normalizeDailySummaryDateStr(cutoffDateStr);
    if (!normalizedDateStr) {
      throw createInterventionEffectStoreError('INTERVENTION_EFFECT_PRUNE_CUTOFF_REQUIRED');
    }
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.INTERVENTION_EFFECT_DAILY, 'readwrite');
      const store = tx.objectStore(STORES.INTERVENTION_EFFECT_DAILY);
      const index = store.index('dateStr');
      const req = index.openCursor(IDBKeyRange.upperBound(normalizedDateStr, true));
      let removed = 0;
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([
        STORES.INTERVENTION_EXPOSURES,
        STORES.INTERVENTION_EFFECT_DAILY,
      ], 'readwrite');
      const exposureReq = tx.objectStore(STORES.INTERVENTION_EXPOSURES).clear();
      const effectReq = tx.objectStore(STORES.INTERVENTION_EFFECT_DAILY).clear();
      exposureReq.onerror = () => reject(exposureReq.error);
      effectReq.onerror = () => reject(effectReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('INTERVENTION_EFFECT_CLEAR_ABORTED'));
    });
  }
}

export default InterventionEffectStore;
