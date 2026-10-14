import StatsAggregateRepository from '../../../../platform/storage/stats/StatsAggregateRepository.js';
import { getLocalDateStr } from '../../../../lib/index.js';
import {
  parseLocalDateParts,
  shiftDateStr,
} from '../../shared/dateMath.js';
import {
  STATS_RANGE_MAX_DAYS,
  createEmptyStatsDay,
  normalizeStatsDateStr,
  normalizeStatsDay,
} from '../../contracts/statsContracts.js';
import {
  buildStatsDayFromHourlyBuckets,
  buildHourlyBucketFromDay,
  resolveLastSealedHour,
} from './statsBucketMaterializer.js';
import { requireFeedHistoryResetAt } from '../../contracts/feedContentFlowReceipt.js';
import {
  resolveRetentionCutoffDateStr,
  STORAGE_RETENTION_DAYS,
} from '../../../../platform/storage/retention/storageRetentionPolicy.js';
import { markStatsRangeNormalized } from '../contracts/statsNormalizedRangeRegistry.js';

function createEmptyStatsRange() {
  return { dates: {} };
}

function throwStatsRepositoryError(errorCode) {
  const error = new Error(errorCode);
  error.code = errorCode;
  throw error;
}

function countCalendarDaysInclusive(startParts, endParts) {
  const startEpochDay = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endEpochDay = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  return Math.floor(Math.abs(endEpochDay - startEpochDay) / (24 * 60 * 60 * 1000)) + 1;
}

function resolveStatsRangeBounds({
  startDateStr,
  endDateStr,
  daysBack,
  todayDateStr = getLocalDateStr(),
  hasStartDateStr = typeof startDateStr !== 'undefined',
  hasEndDateStr = typeof endDateStr !== 'undefined',
  hasDaysBack = typeof daysBack !== 'undefined',
} = {}) {
  const normalizedToday = normalizeStatsDateStr(todayDateStr, getLocalDateStr());
  if (hasStartDateStr !== hasEndDateStr) {
    throwStatsRepositoryError('STATS_REPOSITORY_RANGE_BOUNDS_INCOMPLETE');
  }

  if (hasDaysBack) {
    const isBlank = typeof daysBack === 'string' && daysBack.trim() === '';
    const numericDaysBack = Number(daysBack);
    if (
      daysBack === null
      || typeof daysBack === 'boolean'
      || isBlank
      || !Number.isFinite(numericDaysBack)
    ) {
      throwStatsRepositoryError('STATS_REPOSITORY_RANGE_DAYS_BACK_INVALID');
    }
  }

  if (hasStartDateStr && hasEndDateStr) {
    const start = normalizeStatsDateStr(startDateStr, null);
    const end = normalizeStatsDateStr(endDateStr, null);
    const startParts = parseLocalDateParts(start);
    const endParts = parseLocalDateParts(end);
    if (!start || !end || !startParts || !endParts) {
      throwStatsRepositoryError('STATS_REPOSITORY_RANGE_DATE_INVALID');
    }
    if (countCalendarDaysInclusive(startParts, endParts) > STATS_RANGE_MAX_DAYS) {
      throwStatsRepositoryError('STATS_REPOSITORY_RANGE_SPAN_EXCEEDED');
    }

    return start <= end
      ? { startDateStr: start, endDateStr: end }
      : { startDateStr: end, endDateStr: start };
  }

  const spanDays = hasDaysBack
    ? Math.min(STATS_RANGE_MAX_DAYS, Math.max(1, Math.floor(Number(daysBack))))
    : STATS_RANGE_MAX_DAYS;
  return {
    startDateStr: shiftDateStr(normalizedToday, -(spanDays - 1)) || normalizedToday,
    endDateStr: normalizedToday,
  };
}

function requireStatsRepositoryAggregateMethod(aggregateRepository, methodName, errorCode) {
  if (!aggregateRepository || typeof aggregateRepository[methodName] !== 'function') {
    throwStatsRepositoryError(errorCode);
  }
  return aggregateRepository[methodName].bind(aggregateRepository);
}

function groupHourlyFactBucketsByDate(hourlyBuckets = []) {
  return (Array.isArray(hourlyBuckets) ? hourlyBuckets : []).reduce((grouped, bucket) => {
    const dateStr = normalizeStatsDateStr(bucket?.dateStr, null);
    if (!dateStr) return grouped;
    if (!grouped.has(dateStr)) grouped.set(dateStr, []);
    grouped.get(dateStr).push(bucket);
    return grouped;
  }, new Map());
}

function buildDayFromHourlyFactBuckets(dateStr, hourlyBuckets) {
  if (hourlyBuckets.length > 0) {
    return buildStatsDayFromHourlyBuckets(dateStr, hourlyBuckets);
  }

  return null;
}

function requireHourlyRangeReadResult(hourlyRead) {
  if (
    !hourlyRead
    || typeof hourlyRead !== 'object'
    || !Array.isArray(hourlyRead.buckets)
    || !hourlyRead.diagnostics
    || typeof hourlyRead.diagnostics !== 'object'
  ) {
    throwStatsRepositoryError('STATS_REPOSITORY_HOURLY_RANGE_RESULT_INVALID');
  }
  return hourlyRead;
}

function requireHistoricalMaterializationDateIndex(result, {
  startDateStr,
  endDateStr,
} = {}) {
  if (
    !result
    || typeof result !== 'object'
    || result.startDateStr !== startDateStr
    || result.endDateStr !== endDateStr
    || !Array.isArray(result.hourlyDateStrs)
    || !Array.isArray(result.dailyDateStrs)
  ) {
    throwStatsRepositoryError('STATS_REPOSITORY_HISTORICAL_MATERIALIZATION_INDEX_INVALID');
  }
  const requireDateStrs = (values) => {
    const seen = new Set();
    let previous = null;
    values.forEach((dateStr) => {
      if (
        normalizeStatsDateStr(dateStr, null) !== dateStr
        || dateStr < startDateStr
        || dateStr > endDateStr
        || seen.has(dateStr)
        || (previous !== null && dateStr <= previous)
      ) {
        throwStatsRepositoryError('STATS_REPOSITORY_HISTORICAL_MATERIALIZATION_INDEX_INVALID');
      }
      seen.add(dateStr);
      previous = dateStr;
    });
    return values;
  };
  requireDateStrs(result.hourlyDateStrs);
  requireDateStrs(result.dailyDateStrs);
  return result;
}

async function loadHistoricalDayFromMaterializedSummary(aggregateRepository, dateStr) {
  const dailySummary = await aggregateRepository.getDailySummary(dateStr);
  if (dailySummary?.dayData) {
    return normalizeStatsDay(dailySummary.dayData);
  }
  return null;
}

export function createStatsRepository(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'statsAggregateStore')) {
    throwStatsRepositoryError('STATS_REPOSITORY_DIRECT_AGGREGATE_STORE_UNSUPPORTED');
  }
  const {
    statsAggregateRepository = StatsAggregateRepository.getInstance(),
  } = options;
  const readHourlyBucketsRangeOwner = requireStatsRepositoryAggregateMethod(
    statsAggregateRepository,
    'readHourlyBucketsRange',
    'STATS_REPOSITORY_HOURLY_RANGE_READER_REQUIRED',
  );
  async function loadRuntimeDaySnapshot(dateStr) {
    const normalizedDateStr = normalizeStatsDateStr(dateStr, null);
    if (!normalizedDateStr) {
      return {
        dayData: normalizeStatsDay(null),
        sealedThroughHour: -1,
      };
    }

    const todayDateStr = getLocalDateStr();
    if (normalizedDateStr === todayDateStr) {
      const hourlyBuckets = await statsAggregateRepository.getHourlyBuckets({
        dateStr: normalizedDateStr,
      });
      const todayDay = buildDayFromHourlyFactBuckets(normalizedDateStr, hourlyBuckets);
      return {
        dayData: todayDay || normalizeStatsDay(null),
        sealedThroughHour: resolveLastSealedHour(hourlyBuckets),
      };
    }

    const historicalDay = await loadHistoricalDayFromMaterializedSummary(
      statsAggregateRepository,
      normalizedDateStr,
    );
    if (historicalDay) {
      return {
        dayData: historicalDay,
        sealedThroughHour: 23,
      };
    }

    // Only consult hourly facts when the canonical historical summary is
    // absent, so normal past-day reads stay on the compact daily index while
    // orphaned durable evidence still fails loudly.
    const orphanedHourlyBuckets = await statsAggregateRepository.getHourlyBuckets({
      dateStr: normalizedDateStr,
    });
    if (orphanedHourlyBuckets.length > 0) {
      throwStatsRepositoryError('STATS_REPOSITORY_HISTORICAL_DAILY_SUMMARY_REQUIRED');
    }
    return {
      dayData: normalizeStatsDay(null),
      sealedThroughHour: 23,
    };
  }

  return {
    loadRuntimeDaySnapshot,

    async readPendingHistoricalDayMaterializations({
      beforeDateStr,
      maxDays = STATS_RANGE_MAX_DAYS,
    } = {}) {
      const before = normalizeStatsDateStr(beforeDateStr, null);
      const numericMaxDays = Number(maxDays);
      if (!before || !Number.isFinite(numericMaxDays) || numericMaxDays < 1) {
        throwStatsRepositoryError('STATS_REPOSITORY_HISTORICAL_RECOVERY_RANGE_INVALID');
      }
      const boundedDays = Math.min(STATS_RANGE_MAX_DAYS, Math.max(1, Math.floor(numericMaxDays)));
      const endDateStr = shiftDateStr(before, -1);
      const startDateStr = shiftDateStr(before, -boundedDays);
      if (!startDateStr || !endDateStr) {
        throwStatsRepositoryError('STATS_REPOSITORY_HISTORICAL_RECOVERY_RANGE_INVALID');
      }

      const bounds = { startDateStr, endDateStr };
      const readHistoricalMaterializationDateIndexOwner = requireStatsRepositoryAggregateMethod(
        statsAggregateRepository,
        'readHistoricalMaterializationDateIndex',
        'STATS_REPOSITORY_HISTORICAL_MATERIALIZATION_INDEX_READER_REQUIRED',
      );
      const materializationIndex = requireHistoricalMaterializationDateIndex(
        await readHistoricalMaterializationDateIndexOwner(bounds),
        bounds,
      );
      const finalizedDates = new Set(materializationIndex.dailyDateStrs);
      const orphanDateStrs = materializationIndex.hourlyDateStrs
        .filter((dateStr) => !finalizedDates.has(dateStr));
      const pendingDays = [];
      // Recovery is cold-path work and can span the full retention window.
      // Keep payload reads serial so a damaged/missing daily index cannot fan
      // out into dozens of concurrent IndexedDB transactions at worker start.
      for (const dateStr of orphanDateStrs) {
        const buckets = await statsAggregateRepository.getHourlyBuckets({ dateStr });
        if (!Array.isArray(buckets) || buckets.length === 0) {
          throwStatsRepositoryError('STATS_REPOSITORY_HISTORICAL_RECOVERY_FACTS_CHANGED');
        }
        pendingDays.push({
          dateStr,
          hourlyBuckets: buckets,
          dayData: buildStatsDayFromHourlyBuckets(dateStr, buckets),
          sealedThroughHour: resolveLastSealedHour(buckets),
          sourceHourlyRevision: buckets.reduce((latest, bucket) => Math.max(
            latest,
            Number(bucket?.updatedAt) || Number(bucket?.bucketStartTs) || 0,
          ), 0),
        });
      }
      return {
        startDateStr,
        endDateStr,
        finalizedDateStrs: materializationIndex.dailyDateStrs,
        pendingDays,
      };
    },

    async getStatsRange(query = {}) {
      if (!query || typeof query !== 'object' || Array.isArray(query)) {
        throwStatsRepositoryError('STATS_REPOSITORY_RANGE_OPTIONS_INVALID');
      }
      const request = query;
      const { startDateStr, endDateStr, daysBack } = request;
      const todayDateStr = getLocalDateStr();
      const bounds = resolveStatsRangeBounds({
        startDateStr,
        endDateStr,
        daysBack,
        todayDateStr,
        hasStartDateStr: Object.prototype.hasOwnProperty.call(request, 'startDateStr'),
        hasEndDateStr: Object.prototype.hasOwnProperty.call(request, 'endDateStr'),
        hasDaysBack: Object.prototype.hasOwnProperty.call(request, 'daysBack'),
      });

      const nextRange = createEmptyStatsRange();
      const includesToday = bounds.startDateStr <= todayDateStr
        && bounds.endDateStr >= todayDateStr;
      const [dailyRows, hourlyRead] = await Promise.all([
        statsAggregateRepository.getDailySummariesRange(bounds),
        includesToday
          ? readHourlyBucketsRangeOwner({
            startDateStr: todayDateStr,
            endDateStr: todayDateStr,
          })
          : Promise.resolve(null),
      ]);
      if (includesToday) requireHourlyRangeReadResult(hourlyRead);
      dailyRows.forEach((row) => {
        if (!row?.dateStr || !row?.dayData) return;
        if (row.dateStr === todayDateStr) return;
        nextRange.dates[row.dateStr] = row.dayData;
      });

      const todayHourlyRows = includesToday
        ? groupHourlyFactBucketsByDate(hourlyRead.buckets).get(todayDateStr) || []
        : [];
      if (todayHourlyRows.length > 0) {
        nextRange.dates[todayDateStr] = buildStatsDayFromHourlyBuckets(
          todayDateStr,
          todayHourlyRows,
        );
      }

      return markStatsRangeNormalized({
        ...nextRange,
        readDiagnostics: {
          hourly: hourlyRead?.diagnostics || null,
        },
      });
    },

    async cleanupOldStatsDays(
      maxDays = STORAGE_RETENTION_DAYS.STATS_FACTS,
      { now = Date.now() } = {},
    ) {
      const cutoffDateStr = resolveRetentionCutoffDateStr({
        now,
        days: maxDays,
        fallbackDays: STORAGE_RETENTION_DAYS.STATS_FACTS,
      });
      const aggregateRemoved = await statsAggregateRepository.pruneBefore(cutoffDateStr);
      return (
        (Number(aggregateRemoved?.dailyRemoved) || 0) +
        (Number(aggregateRemoved?.hourlyRemoved) || 0)
      );
    },

    async clearAllStatsDays({ feedHistoryResetAt = null } = {}) {
      if (feedHistoryResetAt === null) {
        await statsAggregateRepository.clearAll();
      } else {
        const resetAt = requireFeedHistoryResetAt(feedHistoryResetAt);
        const resetHourlyBucket = buildHourlyBucketFromDay({
          dateStr: getLocalDateStr(resetAt), hour: new Date(resetAt).getHours(),
          dayData: { ...createEmptyStatsDay(), feedHistoryResetAt: resetAt },
          sealedAt: resetAt, status: 'open',
        });
        // Erasure and its replay fence share the same IndexedDB transaction.
        await statsAggregateRepository.clearAll({ resetHourlyBucket });
      }
      return true;
    },
  };
}
