import DBManager from '../dbManager.js';
import { STORES } from '../dbConstants.js';
import {
  filterStatsHourlyBucketRowsForDateRangeRead,
  filterStatsHourlyBucketRowsForRead,
  normalizeDailySummaryDateStr,
  normalizeStatsHourlyBucketReadRow,
  normalizeStatsHourlyBucketStatus,
  normalizeStatsHour,
  resolveStatsHourlyBucketDateRangeReadRequest,
  resolveStatsHourlyBucketReadRequest,
  toFiniteTimestamp,
} from '../dbStatsNormalizers.js';
import {
  STATS_SCHEMA_VERSION,
  normalizeStatsDateStr,
  normalizeStatsDay,
} from '../../../../../domains/stats/contracts/statsContracts.js';
import {
  consumePreparedStatsHourlyBucket,
} from '../../../../../domains/stats/contracts/statsPreparedHourlyBucketRegistry.js';

const STATS_HOURLY_DIAGNOSTIC_SAMPLE_LIMIT = 8;
const STATS_HOURLY_DIAGNOSTIC_DATE_LIMIT = 14;
const STATS_HOURLY_DIAGNOSTIC_DOMAIN_LIMIT = 64;
const STATS_HOURLY_DIAGNOSTIC_TOP_DOMAINS_PER_DATE = 8;

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

function createStatsHourlyReadError(code, diagnostics = null) {
  const error = new Error(code);
  error.code = code;
  if (diagnostics) error.diagnostics = diagnostics;
  return error;
}

function createStatsAggregateStoreError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeStatsAggregateDateKeys(values, {
  startDateStr,
  endDateStr,
  errorCode,
} = {}) {
  if (!Array.isArray(values)) {
    throw createStatsAggregateStoreError(errorCode);
  }
  const seen = new Set();
  const normalized = values.map((value) => {
    const dateStr = normalizeDailySummaryDateStr(value);
    if (
      !dateStr
      || dateStr !== value
      || dateStr < startDateStr
      || dateStr > endDateStr
      || seen.has(dateStr)
    ) {
      throw createStatsAggregateStoreError(errorCode);
    }
    seen.add(dateStr);
    return dateStr;
  });
  return normalized.sort((left, right) => left.localeCompare(right));
}

function normalizeStatsDailySummaryRow(row, { expectedDateStr = null } = {}) {
  if (!isPlainObject(row)) {
    throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_ROW_INVALID');
  }
  const dateStr = normalizeStatsDateStr(row.dateStr, null);
  const finalizedAt = toFiniteTimestamp(row.finalizedAt);
  const sourceHourlyRevision = Number(row.sourceHourlyRevision);
  if (
    !dateStr
    || (expectedDateStr && dateStr !== expectedDateStr)
    || !isPlainObject(row.dayData)
    || finalizedAt === null
    || !Number.isFinite(sourceHourlyRevision)
    || sourceHourlyRevision < 0
  ) {
    throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_ROW_INVALID');
  }
  let dayData = null;
  try {
    dayData = normalizeStatsDay(row.dayData, { now: finalizedAt });
  } catch (cause) {
    const error = createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_ROW_INVALID');
    error.cause = cause;
    throw error;
  }
  const normalized = {
    dateStr,
    finalizedAt,
    sourceHourlyRevision: Math.floor(sourceHourlyRevision),
    dayData,
  };
  if (!areJsonValuesEqual(row, normalized)) {
    throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_ROW_INVALID');
  }
  return normalized;
}

function normalizeStatsDailyWriteSummary({
  dateStr,
  dayData,
  finalizedAt,
  sourceHourlyRevision,
} = {}) {
  const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
  const normalizedFinalizedAt = toFiniteTimestamp(finalizedAt);
  const normalizedSourceRevision = Number(sourceHourlyRevision);
  if (
    !normalizedDateStr
    || !isPlainObject(dayData)
    || normalizedFinalizedAt === null
    || !Number.isFinite(normalizedSourceRevision)
    || normalizedSourceRevision < 0
  ) {
    throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_SUMMARY_INVALID');
  }
  const summaryDay = normalizeStatsDay(dayData);
  // Receipts belong to the hourly source rows. A finalized daily read index
  // retains aggregate numbers, not another copy of the deduplication ledger.
  delete summaryDay.interventionHistoryReceipts;
  return {
    dateStr: normalizedDateStr,
    dayData: summaryDay,
    finalizedAt: normalizedFinalizedAt,
    sourceHourlyRevision: Math.floor(normalizedSourceRevision),
  };
}

function toDiagnosticCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function toDiagnosticMs(value) {
  return Math.max(0, Number(value) || 0);
}

function normalizeDiagnosticDomain(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function scoreStatsHourlyDiagnosticUsage(entry = {}) {
  return (
    toDiagnosticMs(entry.activeMs)
    + toDiagnosticMs(entry.backgroundMs)
    + toDiagnosticMs(entry.totalMs)
    + (toDiagnosticCount(entry.visits) * 1000)
  );
}

function createStatsHourlyDiagnosticTotals() {
  return {
    activeMs: 0,
    backgroundMs: 0,
    totalMs: 0,
    visits: 0,
  };
}

function addStatsHourlyDiagnosticTotals(target, source = {}) {
  target.activeMs += toDiagnosticMs(source.activeMs);
  target.backgroundMs += toDiagnosticMs(source.backgroundMs);
  target.totalMs += toDiagnosticMs(source.totalMs);
  target.visits += toDiagnosticCount(source.visits);
}

function pickTopStatsHourlyDiagnosticDomains(domainMap, limit) {
  return Array.from(domainMap.values())
    .sort((left, right) => scoreStatsHourlyDiagnosticUsage(right) - scoreStatsHourlyDiagnosticUsage(left))
    .slice(0, limit)
    .map((entry) => {
      const { dateKeys, ...rest } = entry;
      return {
        ...rest,
        dateKeys: dateKeys instanceof Set
          ? Array.from(dateKeys).sort((left, right) => String(right).localeCompare(String(left))).slice(0, STATS_HOURLY_DIAGNOSTIC_DATE_LIMIT)
          : undefined,
      };
    });
}

function summarizeStatsHourlyDiagnosticDomainDelta(domain, delta = {}) {
  const activeMs = toDiagnosticMs(delta?.active);
  const backgroundMs = toDiagnosticMs(delta?.background);
  const totalMs = toDiagnosticMs(delta?.totalMs || activeMs + backgroundMs);
  const visits = toDiagnosticCount(delta?.visits);
  return {
    domain,
    activeMs,
    backgroundMs,
    totalMs,
    visits,
  };
}

function summarizeStatsHourlyReadRows(rows = []) {
  const domainTotals = new Map();
  const totals = createStatsHourlyDiagnosticTotals();
  let rowsWithUsage = 0;
  let rowsWithDomainDelta = 0;

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const domainSummaries = Object.entries(isPlainObject(row?.domainsDelta) ? row.domainsDelta : {})
      .map(([domain, delta]) => {
        const normalizedDomain = normalizeDiagnosticDomain(domain);
        return normalizedDomain
          ? summarizeStatsHourlyDiagnosticDomainDelta(normalizedDomain, delta)
          : null;
      })
      .filter(Boolean);
    const rowTotals = {
      activeMs: toDiagnosticMs(row?.totalsDelta?.totalActive),
      backgroundMs: toDiagnosticMs(row?.totalsDelta?.totalBackground),
      totalMs: toDiagnosticMs(row?.totalsDelta?.totalActive)
        + toDiagnosticMs(row?.totalsDelta?.totalBackground),
      visits: domainSummaries.reduce((sum, entry) => sum + toDiagnosticCount(entry.visits), 0),
    };
    const hasUsage = scoreStatsHourlyDiagnosticUsage(rowTotals) > 0
      || domainSummaries.some((entry) => scoreStatsHourlyDiagnosticUsage(entry) > 0);

    addStatsHourlyDiagnosticTotals(totals, rowTotals);
    if (domainSummaries.length > 0) rowsWithDomainDelta += 1;
    if (hasUsage) rowsWithUsage += 1;

    domainSummaries.forEach((entry) => {
      if (!domainTotals.has(entry.domain)) {
        domainTotals.set(entry.domain, {
          domain: entry.domain,
          ...createStatsHourlyDiagnosticTotals(),
          rowCount: 0,
        });
      }
      const current = domainTotals.get(entry.domain);
      addStatsHourlyDiagnosticTotals(current, entry);
      current.rowCount += 1;
    });
  });

  return {
    rowCount: Array.isArray(rows) ? rows.length : 0,
    rowsWithUsage,
    rowsWithDomainDelta,
    totals,
    topDomains: pickTopStatsHourlyDiagnosticDomains(domainTotals, STATS_HOURLY_DIAGNOSTIC_TOP_DOMAINS_PER_DATE),
  };
}

function buildStatsHourlyRangeReadDiagnostics({
  requestedStartDateStr,
  requestedEndDateStr,
  startDateStr,
  endDateStr,
  rawRows = [],
  normalizedRows = [],
  readStrategy = 'unknown',
  readIndexName = null,
  startedAt = Date.now(),
  completedAt = Date.now(),
} = {}) {
  const normalizedStartDateStr = normalizeDailySummaryDateStr(startDateStr);
  const normalizedEndDateStr = normalizeDailySummaryDateStr(endDateStr);
  const raw = Array.isArray(rawRows) ? rawRows : [];
  const returnedRows = Array.isArray(normalizedRows) ? normalizedRows : [];
  // The bounded range reader has already normalized every candidate exactly
  // once. Reuse that canonical row set for diagnostics instead of walking each
  // nested domain graph through the strict validator and summarizer again.
  const rangeSummary = summarizeStatsHourlyReadRows(returnedRows);
  return {
    schemaVersion: 1,
    queryKind: 'date_range',
    requestedDateStr: null,
    dateStr: null,
    requestedStartDateStr: typeof requestedStartDateStr === 'string' ? requestedStartDateStr : null,
    requestedEndDateStr: typeof requestedEndDateStr === 'string' ? requestedEndDateStr : null,
    startDateStr: normalizedStartDateStr,
    endDateStr: normalizedEndDateStr,
    startHour: 0,
    endHour: 23,
    startedAt,
    completedAt,
    durationMs: Math.max(0, completedAt - startedAt),
    readStrategy,
    readIndexName,
    candidateRowCount: raw.length,
    rawRowCount: raw.length,
    rawNormalizedRowCount: returnedRows.length,
    rawRejectedRowCount: Math.max(0, raw.length - returnedRows.length),
    rawRangeMatchedRowCount: returnedRows.length,
    rawDateMatchedRowCount: returnedRows.length,
    rawHourMatchedRowCount: returnedRows.length,
    returnedRowCount: returnedRows.length,
    rawRangeMatched: rangeSummary,
    rawDateMatched: rangeSummary,
    returned: rangeSummary,
  };
}

function normalizeStatsHourlyWriteBucket(bucket) {
  if (bucket?.schemaVersion !== STATS_SCHEMA_VERSION) {
    throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_HOURLY_BUCKET_CANONICAL_REQUIRED');
  }
  // The stats materializer is the sole registrar for this out-of-band marker.
  // Its output is already canonical; rewalking every domain checkpoint here
  // would turn a one-domain hot update back into O(total domains).
  if (consumePreparedStatsHourlyBucket(bucket)) return bucket;
  const normalizedBucket = normalizeStatsHourlyBucketReadRow(bucket);
  if (!normalizedBucket) {
    throw createStatsAggregateStoreError(
      'STATS_AGGREGATE_STORE_HOURLY_BUCKET_CANONICAL_REQUIRED',
    );
  }
  return normalizedBucket;
}

export class StatsAggregateStore {
  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  static getInstance() {
    if (!StatsAggregateStore.instance) {
      StatsAggregateStore.instance = new StatsAggregateStore();
    }
    return StatsAggregateStore.instance;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('STATS_AGGREGATE_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async getHourlyBuckets({ dateStr, startHour, endHour } = {}) {
    const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
    if (!normalizedDateStr) return Promise.resolve([]);
    const readRequest = resolveStatsHourlyBucketReadRequest({
      dateStr: normalizedDateStr,
      startHour,
      endHour,
    });
    if (!readRequest) return [];

    if (readRequest.empty) {
      return [];
    }

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_HOURLY, 'readonly');
      const store = tx.objectStore(STORES.STATS_HOURLY);
      const index = store.index(readRequest.indexName);
      const query = readRequest.indexName === 'dateHour'
        ? IDBKeyRange.bound(readRequest.lowerBound, readRequest.upperBound)
        : readRequest.key;
      const req = index.getAll(query);

      req.onsuccess = () => {
        try {
          const rawRows = Array.isArray(req.result) ? req.result : [];
          const rows = filterStatsHourlyBucketRowsForRead(rawRows, {
            dateStr: readRequest.dateStr,
            startHour,
            endHour,
          });
          if (rows.length !== rawRows.length) {
            reject(createStatsHourlyReadError('STATS_AGGREGATE_STORE_HOURLY_ROW_INVALID'));
            return;
          }
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      req.onerror = () => reject(req.error || new Error('STATS_AGGREGATE_STORE_HOURLY_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_HOURLY_READ_FAILED'));
    });
  }

  async readHistoricalMaterializationDateIndex({ startDateStr, endDateStr } = {}) {
    const readRequest = resolveStatsHourlyBucketDateRangeReadRequest({
      startDateStr,
      endDateStr,
    });
    if (!readRequest) {
      throw createStatsAggregateStoreError(
        'STATS_AGGREGATE_STORE_HISTORICAL_MATERIALIZATION_RANGE_REQUIRED',
      );
    }

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.STATS_HOURLY, STORES.STATS_DAILY], 'readonly');
      const hourlyDateIndex = tx.objectStore(STORES.STATS_HOURLY).index('dateStr');
      const dailyStore = tx.objectStore(STORES.STATS_DAILY);
      const dailyFinalizedAtIndex = dailyStore.index('finalizedAt');
      const dateRange = IDBKeyRange.bound(
        readRequest.startDateStr,
        readRequest.endDateStr,
      );
      const hourlyDateStrs = [];
      let dailyDateStrs = null;
      let finalizedDailyDateStrs = null;
      let hourlyReadCompleted = false;
      let finalizedDailyReadCompleted = false;
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      tx.oncomplete = () => {
        if (settled) return;
        if (
          !hourlyReadCompleted
          || !finalizedDailyReadCompleted
          || !Array.isArray(dailyDateStrs)
          || !Array.isArray(finalizedDailyDateStrs)
        ) {
          rejectOnce(createStatsAggregateStoreError(
            'STATS_AGGREGATE_STORE_HISTORICAL_MATERIALIZATION_INDEX_INVALID',
          ));
          return;
        }
        try {
          const normalizedHourlyDateStrs = normalizeStatsAggregateDateKeys(hourlyDateStrs, {
            startDateStr: readRequest.startDateStr,
            endDateStr: readRequest.endDateStr,
            errorCode: 'STATS_AGGREGATE_STORE_HISTORICAL_HOURLY_DATE_KEY_INVALID',
          });
          const normalizedDailyDateStrs = normalizeStatsAggregateDateKeys(dailyDateStrs, {
            startDateStr: readRequest.startDateStr,
            endDateStr: readRequest.endDateStr,
            errorCode: 'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_DATE_KEY_INVALID',
          });
          const normalizedFinalizedDailyDateStrs = normalizeStatsAggregateDateKeys(
            finalizedDailyDateStrs.filter((dateStr) => (
              typeof dateStr === 'string'
              && dateStr >= readRequest.startDateStr
              && dateStr <= readRequest.endDateStr
            )),
            {
              startDateStr: readRequest.startDateStr,
              endDateStr: readRequest.endDateStr,
              errorCode: 'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_KEY_INVALID',
            },
          );
          const finalizedDailyDateSet = new Set(normalizedFinalizedDailyDateStrs);
          if (normalizedDailyDateStrs.some((dateStr) => !finalizedDailyDateSet.has(dateStr))) {
            throw createStatsAggregateStoreError(
              'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_INVALID',
            );
          }
          settled = true;
          resolve({
            startDateStr: readRequest.startDateStr,
            endDateStr: readRequest.endDateStr,
            hourlyDateStrs: normalizedHourlyDateStrs,
            dailyDateStrs: normalizedDailyDateStrs,
          });
        } catch (error) {
          rejectOnce(error);
        }
      };
      tx.onerror = () => rejectOnce(
        tx.error
          || new Error('STATS_AGGREGATE_STORE_HISTORICAL_MATERIALIZATION_INDEX_READ_FAILED'),
      );
      tx.onabort = () => rejectOnce(
        tx.error
          || new Error('STATS_AGGREGATE_STORE_HISTORICAL_MATERIALIZATION_INDEX_READ_ABORTED'),
      );

      const hourlyReq = hourlyDateIndex.openKeyCursor(dateRange, 'nextunique');
      hourlyReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          hourlyReadCompleted = true;
          return;
        }
        hourlyDateStrs.push(cursor.key);
        cursor.continue();
      };
      hourlyReq.onerror = () => rejectOnce(
        hourlyReq.error
          || new Error('STATS_AGGREGATE_STORE_HISTORICAL_HOURLY_DATE_INDEX_READ_FAILED'),
      );

      const dailyReq = dailyStore.getAllKeys(dateRange);
      dailyReq.onsuccess = () => {
        dailyDateStrs = dailyReq.result;
      };
      dailyReq.onerror = () => rejectOnce(
        dailyReq.error
          || new Error('STATS_AGGREGATE_STORE_HISTORICAL_DAILY_DATE_INDEX_READ_FAILED'),
      );

      // `stats_daily` presence alone is not a trustworthy commit marker. The
      // canonical atomic finalizer always writes a finite `finalizedAt`, which
      // creates an entry in this existing index. Intersect the two key-only
      // views so a partial/malformed daily row fails at bootstrap without
      // cloning its large day payload.
      finalizedDailyDateStrs = [];
      const finalizedDailyReq = dailyFinalizedAtIndex.openKeyCursor();
      finalizedDailyReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          finalizedDailyReadCompleted = true;
          return;
        }
        const dateStr = cursor.primaryKey;
        if (
          typeof dateStr === 'string'
          && dateStr >= readRequest.startDateStr
          && dateStr <= readRequest.endDateStr
        ) {
          if (
            normalizeDailySummaryDateStr(dateStr) !== dateStr
            || typeof cursor.key !== 'number'
            || !Number.isFinite(cursor.key)
          ) {
            rejectOnce(createStatsAggregateStoreError(
              'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_KEY_INVALID',
            ));
            return;
          }
          finalizedDailyDateStrs.push(dateStr);
        }
        cursor.continue();
      };
      finalizedDailyReq.onerror = () => rejectOnce(
        finalizedDailyReq.error
          || new Error('STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_READ_FAILED'),
      );
    });
  }

  async readHourlyBucketsRange({ startDateStr, endDateStr } = {}) {
    const readRequest = resolveStatsHourlyBucketDateRangeReadRequest({
      startDateStr,
      endDateStr,
    });
    if (!readRequest) {
      throw new Error('STATS_AGGREGATE_STORE_HOURLY_RANGE_REQUIRED');
    }

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const tx = db.transaction(STORES.STATS_HOURLY, 'readonly');
      const store = tx.objectStore(STORES.STATS_HOURLY);
      const index = store.index(readRequest.indexName);
      const query = IDBKeyRange.bound(readRequest.lowerBound, readRequest.upperBound);
      const req = index.getAll(query);

      req.onsuccess = () => {
        const rows = filterStatsHourlyBucketRowsForDateRangeRead(req.result, readRequest);
        const diagnostics = buildStatsHourlyRangeReadDiagnostics({
          requestedStartDateStr: startDateStr,
          requestedEndDateStr: endDateStr,
          startDateStr: readRequest.startDateStr,
          endDateStr: readRequest.endDateStr,
          rawRows: req.result,
          normalizedRows: rows,
          readStrategy: readRequest.readStrategy,
          readIndexName: readRequest.indexName,
          startedAt,
          completedAt: Date.now(),
        });
        if (diagnostics.rawRejectedRowCount > 0) {
          reject(createStatsHourlyReadError(
            'STATS_AGGREGATE_STORE_HOURLY_RANGE_ROW_INVALID',
            diagnostics,
          ));
          return;
        }
        resolve({ buckets: rows, diagnostics });
      };
      req.onerror = () => reject(req.error || new Error('STATS_AGGREGATE_STORE_HOURLY_RANGE_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_HOURLY_RANGE_READ_FAILED'));
    });
  }

  async getHourlyLedgerDiagnostics({
    sampleLimit = STATS_HOURLY_DIAGNOSTIC_SAMPLE_LIMIT,
    dateLimit = STATS_HOURLY_DIAGNOSTIC_DATE_LIMIT,
    domainLimit = STATS_HOURLY_DIAGNOSTIC_DOMAIN_LIMIT,
    topDomainsPerDate = STATS_HOURLY_DIAGNOSTIC_TOP_DOMAINS_PER_DATE,
  } = {}) {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_HOURLY, 'readonly');
      const store = tx.objectStore(STORES.STATS_HOURLY);
      const req = store.getAll();

      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        const dateBuckets = new Map();
        const domainTotals = new Map();
        const sampleRows = [];
        let rowsWithDateStr = 0;
        let rowsMissingDateStr = 0;
        let rowsWithDomainDelta = 0;
        let rowsWithUsage = 0;

        const resolveDateBucket = (row) => {
          const rawDateStr = typeof row?.dateStr === 'string' ? row.dateStr.trim() : null;
          const rowDateStr = normalizeDailySummaryDateStr(rawDateStr);
          if (rowDateStr) rowsWithDateStr += 1;
          else rowsMissingDateStr += 1;
          const dateKey = rowDateStr || rawDateStr || '__missing__';
          if (!dateBuckets.has(dateKey)) {
            dateBuckets.set(dateKey, {
              dateKey,
              dateStr: rowDateStr,
              rawDateStr,
              rowCount: 0,
              rowsWithUsage: 0,
              rowsWithDomainDelta: 0,
              hours: new Set(),
              statuses: {},
              totals: createStatsHourlyDiagnosticTotals(),
              domains: new Map(),
            });
          }
          return dateBuckets.get(dateKey);
        };

        rows.forEach((row) => {
          const bucket = resolveDateBucket(row);
          const hour = normalizeStatsHour(row?.hour);
          const status = normalizeStatsHourlyBucketStatus(row?.status) || 'invalid';
          const domainsDelta = isPlainObject(row?.domainsDelta) ? row.domainsDelta : {};
          const domainSummaries = Object.entries(domainsDelta)
            .map(([domain, delta]) => {
              const normalizedDomain = normalizeDiagnosticDomain(domain);
              return normalizedDomain
                ? summarizeStatsHourlyDiagnosticDomainDelta(normalizedDomain, delta)
                : null;
            })
            .filter(Boolean);
          const totals = {
            activeMs: toDiagnosticMs(row?.totalsDelta?.totalActive),
            backgroundMs: toDiagnosticMs(row?.totalsDelta?.totalBackground),
            totalMs: toDiagnosticMs(row?.totalsDelta?.totalActive)
              + toDiagnosticMs(row?.totalsDelta?.totalBackground),
            visits: domainSummaries.reduce((sum, entry) => sum + toDiagnosticCount(entry.visits), 0),
          };
          const hasDomainDelta = domainSummaries.length > 0;
          const hasUsage = scoreStatsHourlyDiagnosticUsage(totals) > 0
            || domainSummaries.some((entry) => scoreStatsHourlyDiagnosticUsage(entry) > 0);

          bucket.rowCount += 1;
          if (hour !== null) bucket.hours.add(hour);
          bucket.statuses[status] = toDiagnosticCount(bucket.statuses[status]) + 1;
          addStatsHourlyDiagnosticTotals(bucket.totals, totals);
          if (hasDomainDelta) {
            rowsWithDomainDelta += 1;
            bucket.rowsWithDomainDelta += 1;
          }
          if (hasUsage) {
            rowsWithUsage += 1;
            bucket.rowsWithUsage += 1;
          }

          domainSummaries.forEach((entry) => {
            if (!bucket.domains.has(entry.domain)) {
              bucket.domains.set(entry.domain, {
                domain: entry.domain,
                ...createStatsHourlyDiagnosticTotals(),
                rowCount: 0,
              });
            }
            if (!domainTotals.has(entry.domain)) {
              domainTotals.set(entry.domain, {
                domain: entry.domain,
                ...createStatsHourlyDiagnosticTotals(),
                rowCount: 0,
                dateKeys: new Set(),
              });
            }
            const dateDomain = bucket.domains.get(entry.domain);
            const globalDomain = domainTotals.get(entry.domain);
            addStatsHourlyDiagnosticTotals(dateDomain, entry);
            addStatsHourlyDiagnosticTotals(globalDomain, entry);
            dateDomain.rowCount += 1;
            globalDomain.rowCount += 1;
            globalDomain.dateKeys.add(bucket.dateStr || bucket.rawDateStr || bucket.dateKey);
          });

          sampleRows.push({
            dateStr: bucket.dateStr,
            rawDateStr: bucket.rawDateStr,
            hour,
            status,
            bucketStartTs: toFiniteTimestamp(row?.bucketStartTs),
            sealedAt: toFiniteTimestamp(row?.sealedAt),
            updatedAt: toFiniteTimestamp(row?.updatedAt),
            totals,
            domainCount: domainSummaries.length,
            topDomains: domainSummaries
              .sort((left, right) => scoreStatsHourlyDiagnosticUsage(right) - scoreStatsHourlyDiagnosticUsage(left))
              .slice(0, topDomainsPerDate),
          });
        });

        const sortedDateBuckets = Array.from(dateBuckets.values())
          .sort((left, right) => {
            if (left.dateStr && right.dateStr) return right.dateStr.localeCompare(left.dateStr);
            if (left.dateStr) return -1;
            if (right.dateStr) return 1;
            return String(right.rawDateStr || '').localeCompare(String(left.rawDateStr || ''));
          })
          .slice(0, Math.max(1, Math.floor(Number(dateLimit) || STATS_HOURLY_DIAGNOSTIC_DATE_LIMIT)))
          .map((bucket) => ({
            dateKey: bucket.dateKey,
            dateStr: bucket.dateStr,
            rawDateStr: bucket.rawDateStr,
            rowCount: bucket.rowCount,
            rowsWithUsage: bucket.rowsWithUsage,
            rowsWithDomainDelta: bucket.rowsWithDomainDelta,
            hours: Array.from(bucket.hours).sort((left, right) => left - right),
            statuses: bucket.statuses,
            totals: { ...bucket.totals },
            topDomains: pickTopStatsHourlyDiagnosticDomains(bucket.domains, topDomainsPerDate),
          }));

        resolve({
          schemaVersion: 1,
          totalRows: rows.length,
          rowsWithDateStr,
          rowsMissingDateStr,
          rowsWithUsage,
          rowsWithDomainDelta,
          dateBuckets: sortedDateBuckets,
          domainTotals: pickTopStatsHourlyDiagnosticDomains(
            domainTotals,
            Math.max(1, Math.floor(Number(domainLimit) || STATS_HOURLY_DIAGNOSTIC_DOMAIN_LIMIT)),
          ),
          sampleRows: sampleRows
            .sort((left, right) => {
              const leftTs = toFiniteTimestamp(left.updatedAt) ?? toFiniteTimestamp(left.bucketStartTs) ?? 0;
              const rightTs = toFiniteTimestamp(right.updatedAt) ?? toFiniteTimestamp(right.bucketStartTs) ?? 0;
              return rightTs - leftTs;
            })
            .slice(0, Math.max(1, Math.floor(Number(sampleLimit) || STATS_HOURLY_DIAGNOSTIC_SAMPLE_LIMIT))),
        });
      };
      req.onerror = () => reject(req.error || new Error('STATS_AGGREGATE_STORE_HOURLY_LEDGER_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_HOURLY_LEDGER_READ_FAILED'));
    });
  }

  async upsertHourlyFactBuckets(buckets = []) {
    if (!Array.isArray(buckets)) {
      throw new Error('STATS_AGGREGATE_STORE_HOURLY_BUCKETS_ARRAY_REQUIRED');
    }
    if (buckets.length === 0) return 0;
    const db = await this.getDatabase();
    const rows = buckets.map((bucket) => normalizeStatsHourlyWriteBucket(bucket));

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_HOURLY, 'readwrite');
      const store = tx.objectStore(STORES.STATS_HOURLY);
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(rows.length);
      };
      tx.onerror = () => rejectOnce(
        tx.error || new Error('STATS_AGGREGATE_STORE_HOURLY_WRITE_FAILED'),
      );
      tx.onabort = () => rejectOnce(
        tx.error || new Error('STATS_AGGREGATE_STORE_HOURLY_WRITE_ABORTED'),
      );

      try {
        rows.forEach((bucket) => store.put(bucket));
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // A synchronous IndexedDB failure may already have inactivated the transaction.
        }
        rejectOnce(error);
      }
    });
  }

  async finalizeHistoricalDayFacts({ hourlyBuckets, dailySummary } = {}) {
    if (!Array.isArray(hourlyBuckets)) {
      throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_HISTORICAL_HOURLY_BUCKETS_REQUIRED');
    }
    const db = await this.getDatabase();
    const rows = hourlyBuckets.map((bucket) => normalizeStatsHourlyWriteBucket(bucket));
    const dailyRow = normalizeStatsDailyWriteSummary(dailySummary);
    const committedHours = new Set();
    const committedBucketStarts = new Set();

    rows.forEach((row) => {
      if (row.dateStr !== dailyRow.dateStr || row.status !== 'sealed') {
        throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_HISTORICAL_FACTS_MISMATCH');
      }
      if (committedHours.has(row.hour) || committedBucketStarts.has(row.bucketStartTs)) {
        throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_HISTORICAL_BUCKET_DUPLICATE');
      }
      committedHours.add(row.hour);
      committedBucketStarts.add(row.bucketStartTs);
    });

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.STATS_HOURLY, STORES.STATS_DAILY], 'readwrite');
      const hourlyStore = tx.objectStore(STORES.STATS_HOURLY);
      const dailyStore = tx.objectStore(STORES.STATS_DAILY);
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve({
          dateStr: dailyRow.dateStr,
          hourlyBucketCount: rows.length,
        });
      };
      tx.onerror = () => rejectOnce(
        tx.error || new Error('STATS_AGGREGATE_STORE_HISTORICAL_FINALIZE_FAILED'),
      );
      tx.onabort = () => rejectOnce(
        tx.error || new Error('STATS_AGGREGATE_STORE_HISTORICAL_FINALIZE_ABORTED'),
      );

      try {
        rows.forEach((row) => hourlyStore.put(row));
        dailyStore.put(dailyRow);
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // The transaction may already be inactive after a synchronous IndexedDB failure.
        }
        rejectOnce(error);
      }
    });
  }

  async finalizeRecoveredHistoricalDayFacts({ hourlyBuckets, dailySummary } = {}) {
    if (!Array.isArray(hourlyBuckets) || hourlyBuckets.length === 0) {
      throw createStatsAggregateStoreError(
        'STATS_AGGREGATE_STORE_RECOVERY_HOURLY_BUCKETS_REQUIRED',
      );
    }
    const dailyRow = normalizeStatsDailyWriteSummary(dailySummary);
    const expectedRows = hourlyBuckets.map((bucket) => {
      const row = normalizeStatsHourlyBucketReadRow(bucket);
      if (!row) {
        throw createStatsAggregateStoreError(
          'STATS_AGGREGATE_STORE_RECOVERY_HOURLY_ROW_INVALID',
        );
      }
      return row;
    });
    const expectedHours = new Set();
    const expectedBucketStarts = new Set();
    expectedRows.forEach((row) => {
      if (row.dateStr !== dailyRow.dateStr) {
        throw createStatsAggregateStoreError(
          'STATS_AGGREGATE_STORE_RECOVERY_FACTS_MISMATCH',
        );
      }
      if (expectedHours.has(row.hour) || expectedBucketStarts.has(row.bucketStartTs)) {
        throw createStatsAggregateStoreError(
          'STATS_AGGREGATE_STORE_RECOVERY_BUCKET_DUPLICATE',
        );
      }
      expectedHours.add(row.hour);
      expectedBucketStarts.add(row.bucketStartTs);
    });
    expectedRows.sort((left, right) => left.bucketStartTs - right.bucketStartTs);

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.STATS_HOURLY, STORES.STATS_DAILY], 'readwrite');
      const hourlyStore = tx.objectStore(STORES.STATS_HOURLY);
      const dailyStore = tx.objectStore(STORES.STATS_DAILY);
      let hourlyReadCompleted = false;
      let dailyReadCompleted = false;
      let finalizationStarted = false;
      let settled = false;
      let storedHourlyRows = null;
      let storedDailyRow = null;
      let reusedHourlyBucketCount = 0;
      let sealedUpdatedBucketCount = 0;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error) => {
        try {
          tx.abort();
        } catch {
          // The transaction may already be inactive after an IndexedDB failure.
        }
        rejectOnce(error);
      };
      const finishRecovery = () => {
        if (
          finalizationStarted
          || !hourlyReadCompleted
          || !dailyReadCompleted
          || settled
        ) return;
        finalizationStarted = true;
        if (storedDailyRow !== null) {
          abortWith(createStatsAggregateStoreError(
            'STATS_AGGREGATE_STORE_RECOVERY_DAILY_ALREADY_FINALIZED',
          ));
          return;
        }

        if (!Array.isArray(storedHourlyRows)) {
          abortWith(createStatsAggregateStoreError(
            'STATS_AGGREGATE_STORE_RECOVERY_HOURLY_READ_RESULT_INVALID',
          ));
          return;
        }
        const currentRows = storedHourlyRows
          .map((row) => normalizeStatsHourlyBucketReadRow(row));
        if (
          currentRows.some((row) => !row)
          || currentRows.length !== expectedRows.length
        ) {
          abortWith(createStatsAggregateStoreError(
            'STATS_AGGREGATE_STORE_RECOVERY_HOURLY_FACTS_CHANGED',
          ));
          return;
        }
        currentRows.sort((left, right) => left.bucketStartTs - right.bucketStartTs);
        if (!areJsonValuesEqual(currentRows, expectedRows)) {
          abortWith(createStatsAggregateStoreError(
            'STATS_AGGREGATE_STORE_RECOVERY_HOURLY_FACTS_CHANGED',
          ));
          return;
        }

        const rowsToSeal = currentRows
          .filter((row) => row.status === 'open')
          .map((row) => {
            const sealedAt = Math.max(row.updatedAt, dailyRow.finalizedAt);
            return normalizeStatsHourlyWriteBucket({
              ...row,
              status: 'sealed',
              sealedAt,
              updatedAt: sealedAt,
            });
          });
        reusedHourlyBucketCount = currentRows.length - rowsToSeal.length;
        sealedUpdatedBucketCount = rowsToSeal.length;

        try {
          rowsToSeal.forEach((row) => hourlyStore.put(row));
          dailyStore.put(dailyRow);
        } catch (error) {
          abortWith(error);
        }
      };

      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve({
          dateStr: dailyRow.dateStr,
          hourlyBucketCount: expectedRows.length,
          reusedHourlyBucketCount,
          sealedUpdatedBucketCount,
        });
      };
      tx.onerror = () => rejectOnce(
        tx.error || new Error('STATS_AGGREGATE_STORE_RECOVERY_FINALIZE_FAILED'),
      );
      tx.onabort = () => rejectOnce(
        tx.error || new Error('STATS_AGGREGATE_STORE_RECOVERY_FINALIZE_ABORTED'),
      );

      const hourlyReq = hourlyStore.index('dateStr').getAll(dailyRow.dateStr);
      hourlyReq.onsuccess = () => {
        storedHourlyRows = hourlyReq.result;
        hourlyReadCompleted = true;
        finishRecovery();
      };
      hourlyReq.onerror = () => abortWith(
        hourlyReq.error || new Error('STATS_AGGREGATE_STORE_RECOVERY_HOURLY_READ_FAILED'),
      );
      const dailyReq = dailyStore.get(dailyRow.dateStr);
      dailyReq.onsuccess = () => {
        storedDailyRow = typeof dailyReq.result === 'undefined'
          ? null
          : dailyReq.result;
        dailyReadCompleted = true;
        finishRecovery();
      };
      dailyReq.onerror = () => abortWith(
        dailyReq.error || new Error('STATS_AGGREGATE_STORE_RECOVERY_DAILY_READ_FAILED'),
      );
    });
  }

  async getDailySummary(dateStr) {
    const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
    if (!normalizedDateStr) {
      throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_DATE_REQUIRED');
    }
    const db = await this.getDatabase();
    const summary = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_DAILY, 'readonly');
      const store = tx.objectStore(STORES.STATS_DAILY);
      const req = store.get(normalizedDateStr);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('STATS_AGGREGATE_STORE_DAILY_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_DAILY_READ_FAILED'));
    });
    if (!summary) return null;
    return normalizeStatsDailySummaryRow(summary, { expectedDateStr: normalizedDateStr });
  }

  async getDailySummariesRange({ startDateStr, endDateStr } = {}) {
    const start = normalizeStatsDateStr(startDateStr, null);
    const end = normalizeStatsDateStr(endDateStr, null);
    if (!start || !end) {
      throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_DAILY_RANGE_REQUIRED');
    }
    const db = await this.getDatabase();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.STATS_DAILY, 'readonly');
      const store = tx.objectStore(STORES.STATS_DAILY);

      const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
      const req = store.getAll(IDBKeyRange.bound(rangeStart, rangeEnd));

      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error || new Error('STATS_AGGREGATE_STORE_DAILY_RANGE_READ_FAILED'));
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_DAILY_RANGE_READ_FAILED'));
    });

    return (Array.isArray(rows) ? rows : []).map((row) => normalizeStatsDailySummaryRow(row));
  }

  async pruneBefore(cutoffDateStr) {
    const normalizedDateStr = normalizeStatsDateStr(cutoffDateStr, null);
    if (!normalizedDateStr) {
      throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_PRUNE_CUTOFF_REQUIRED');
    }

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.STATS_DAILY, STORES.STATS_HOURLY], 'readwrite');
      const dailyStore = tx.objectStore(STORES.STATS_DAILY);
      const hourlyStore = tx.objectStore(STORES.STATS_HOURLY);
      const dailyReq = dailyStore.openCursor(IDBKeyRange.upperBound(normalizedDateStr, true));
      const hourlyReq = hourlyStore
        .index('dateStr')
        .openCursor(IDBKeyRange.upperBound(normalizedDateStr, true));
      let dailyRemoved = 0;
      let hourlyRemoved = 0;

      dailyReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        cursor.delete();
        dailyRemoved += 1;
        cursor.continue();
      };
      hourlyReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        cursor.delete();
        hourlyRemoved += 1;
        cursor.continue();
      };
      dailyReq.onerror = () => reject(dailyReq.error || new Error('STATS_AGGREGATE_STORE_DAILY_PRUNE_FAILED'));
      hourlyReq.onerror = () => reject(hourlyReq.error || new Error('STATS_AGGREGATE_STORE_HOURLY_PRUNE_FAILED'));
      tx.oncomplete = () => resolve({ dailyRemoved, hourlyRemoved });
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_PRUNE_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_PRUNE_ABORTED'));
    });
  }

  async clearAll({ resetHourlyBucket = null } = {}) {
    const resetRow = resetHourlyBucket === null ? null : normalizeStatsHourlyWriteBucket(resetHourlyBucket);
    if (resetRow && (!normalizeStatsHourlyBucketReadRow(resetRow)
      || !Object.hasOwn(resetRow, 'feedHistoryResetAt')
      || Object.hasOwn(resetRow, 'feedHistoryReceipts') || Object.hasOwn(resetRow, 'interventionHistoryReceipts')
      || Object.keys(resetRow.domainsDelta).length > 0)) {
      throw createStatsAggregateStoreError('STATS_AGGREGATE_STORE_RESET_BUCKET_INVALID');
    }
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.STATS_DAILY, STORES.STATS_HOURLY], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_CLEAR_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('STATS_AGGREGATE_STORE_CLEAR_ABORTED'));
      try {
        const dailyReq = tx.objectStore(STORES.STATS_DAILY).clear();
        const hourlyReq = tx.objectStore(STORES.STATS_HOURLY).clear();
        if (resetRow) tx.objectStore(STORES.STATS_HOURLY).put(resetRow);
        dailyReq.onerror = () => reject(dailyReq.error || new Error('STATS_AGGREGATE_STORE_CLEAR_FAILED'));
        hourlyReq.onerror = () => reject(hourlyReq.error || new Error('STATS_AGGREGATE_STORE_CLEAR_FAILED'));
      } catch (error) {
        try { tx.abort(); } catch { /* The transaction may already be inactive. */ }
        reject(error);
      }
    });
  }
}

export default StatsAggregateStore;
