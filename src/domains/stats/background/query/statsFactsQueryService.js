import {
  ensureStatsRuntimeState,
  getStatsRuntimeEpochFor,
  getStatsRuntimeRevisionFor,
  invalidateStatsFactsRuntimeRangeCacheFor,
  isStatsRuntimeRevisionFor,
  setStatsFactsRuntimeRangeLastReadFor,
  summarizeStatsFactsRangeRead,
  summarizeStatsFactsRangeReadFailure,
} from '../runtime/statsRuntimeCache.js';
import {
  readStatsFactsRangeFromRepository,
  resolveStatsDaysBack,
} from './statsFactsRepositoryReadUtils.js';
import { getLocalDateStr } from '../../../../lib/index.js';
import { shiftDateStr } from '../../shared/dateMath.js';
import {
  attachDurableStatsFactsReadModel,
} from '../contracts/statsReadModelContracts.js';
import { STATS_RANGE_MAX_DAYS } from '../../contracts/statsContracts.js';
import { propagateNormalizedAnalysisStatsRange } from './statsAnalysisStatsRange.js';
import { reportRuntimeDiagnostic } from '../../../../platform/diagnostics/runtimeDiagnosticConsole.js';

const STATS_FACTS_CACHE_TTL_MS = 15_000;
const revisionInvalidationErrors = new WeakSet();

function createStatsFactsQueryError(code, message, cause = null) {
  const error = new Error(message || code);
  error.code = code;
  if (code === 'STATS_FACTS_QUERY_REVISION_CHANGED') revisionInvalidationErrors.add(error);
  if (cause) error.cause = cause;
  return error;
}

function warnStatsFactsQueryDiagnostic(code, error) {
  console.warn('[StatsFactsQueryService] stale range query ignored after invalidation', {
    code,
    error: error?.message || String(error || code),
  });
}

export function createStatsFactsQueryService({
  runtimeState,
  statsRepository,
  cacheTtlMs = STATS_FACTS_CACHE_TTL_MS,
  maxDaysStored = STATS_RANGE_MAX_DAYS,
} = {}) {
  if (
    !statsRepository
    || typeof statsRepository.getStatsRange !== 'function'
  ) {
    throw new Error('STATS_FACTS_QUERY_REPOSITORY_REQUIRED');
  }

  const runtime = ensureStatsRuntimeState(runtimeState);

  function resolveFactsRangeForSpan(range, span) {
    const baseSpan = Math.max(1, Math.floor(Number(range?.readModel?.spanDays) || span));
    if (baseSpan <= span) return range;

    if (runtime.statsFactsDerivedRangeCacheBase !== range) {
      runtime.statsFactsDerivedRangeCacheBase = range;
      runtime.statsFactsDerivedRangeCacheBySpan.clear();
    }
    if (runtime.statsFactsDerivedRangeCacheBySpan.has(span)) {
      return runtime.statsFactsDerivedRangeCacheBySpan.get(span);
    }

    const todayDateStr = getLocalDateStr();
    const cutoffDateStr = shiftDateStr(todayDateStr, -(span - 1)) || todayDateStr;
    const dates = Object.fromEntries(
      Object.entries(range?.dates || {}).filter(([dateStr]) => (
        dateStr >= cutoffDateStr && dateStr <= todayDateStr
      )),
    );
    const derivedRange = propagateNormalizedAnalysisStatsRange(
      range,
      attachDurableStatsFactsReadModel({ dates }, {
        spanDays: span,
        generatedAtEpochMs: range?.readModel?.generatedAtEpochMs,
        runtimeEpoch: range?.readModel?.runtimeEpoch,
        runtimeRevision: range?.readModel?.runtimeRevision,
      }),
    );
    runtime.statsFactsDerivedRangeCacheBySpan.set(span, derivedRange);
    return derivedRange;
  }

  function readCachedFactsRange({ span, revision, now }) {
    const cacheSpan = Number(runtime.statsFactsRangeCacheDaysBack) || 0;
    if (
      !runtime.statsFactsRangeCache
      || runtime.statsFactsRangeCacheRevision !== revision
      || cacheSpan < span
      || now - runtime.statsFactsRangeCacheAt >= cacheTtlMs
    ) {
      return null;
    }
    return resolveFactsRangeForSpan(runtime.statsFactsRangeCache, span);
  }

  async function readStatsFactsRangeAttempt(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw createStatsFactsQueryError(
        'STATS_FACTS_QUERY_OPTIONS_INVALID',
        'Stats facts range query options must be an object.',
      );
    }
    const hasExplicitDaysBack = Object.prototype.hasOwnProperty.call(options, 'daysBack');
    const daysBack = hasExplicitDaysBack ? options.daysBack : maxDaysStored;
    if (
      hasExplicitDaysBack
      && (
        daysBack === null
        || typeof daysBack === 'boolean'
        || (typeof daysBack === 'string' && daysBack.trim() === '')
        || !Number.isFinite(Number(daysBack))
      )
    ) {
      throw createStatsFactsQueryError(
        'STATS_FACTS_QUERY_DAYS_BACK_INVALID',
        'Stats facts range daysBack must be a finite number.',
      );
    }
    const now = Date.now();
    const revision = getStatsRuntimeRevisionFor(runtime);
    const span = resolveStatsDaysBack(daysBack, {
      fallbackDays: maxDaysStored,
      maxDays: maxDaysStored,
    });
    const promiseSpan = Number(runtime.statsFactsRangeCachePromiseDaysBack) || 0;
    const hasMatchingPromiseRevision = runtime.statsFactsRangeCachePromiseRevision === revision;

    if (runtime.statsFactsRangeCachePromise && !hasMatchingPromiseRevision) {
      runtime.statsFactsRangeCachePromise.catch((error) => {
        warnStatsFactsQueryDiagnostic('STALE_STATS_FACTS_RANGE_QUERY_FAILED', error);
      });
      invalidateStatsFactsRuntimeRangeCacheFor(runtime);
    }

    const cachedRange = readCachedFactsRange({ span, revision, now });
    if (cachedRange) return cachedRange;

    if (runtime.statsFactsRangeCachePromise && promiseSpan >= span) {
      const loaded = await runtime.statsFactsRangeCachePromise;
      if (!isStatsRuntimeRevisionFor(runtime, revision)) {
        throw createStatsFactsQueryError(
          'STATS_FACTS_QUERY_REVISION_CHANGED',
          'Stats facts range query was invalidated before the requested range could be returned.',
        );
      }
      return resolveFactsRangeForSpan(loaded, span);
    }

    if (runtime.statsFactsRangeCachePromise && promiseSpan < span) {
      const pendingPromise = runtime.statsFactsRangeCachePromise;
      try {
        await pendingPromise;
      } catch (error) {
        if (revisionInvalidationErrors.has(error)) throw error;
        throw createStatsFactsQueryError(
          'STATS_FACTS_RANGE_INFLIGHT_QUERY_FAILED',
          'A previous stats facts range query failed before a new range could be loaded.',
          error,
        );
      }
      if (!isStatsRuntimeRevisionFor(runtime, revision)) {
        throw createStatsFactsQueryError(
          'STATS_FACTS_QUERY_REVISION_CHANGED',
          'Stats facts range query was invalidated before the requested range could be loaded.',
        );
      }
      if (runtime.statsFactsRangeCachePromise === pendingPromise) {
        runtime.statsFactsRangeCachePromise = null;
        runtime.statsFactsRangeCachePromiseDaysBack = null;
        runtime.statsFactsRangeCachePromiseRevision = null;
      }
    }

    if (!runtime.statsFactsRangeCachePromise) {
      const promise = (async () => {
        const startedAt = Date.now();
        let loaded;
        try {
          loaded = await readStatsFactsRangeFromRepository({
            statsRepository,
            daysBack: span,
          });
        } catch (error) {
          if (isStatsRuntimeRevisionFor(runtime, revision)) {
            setStatsFactsRuntimeRangeLastReadFor(runtime, summarizeStatsFactsRangeReadFailure(error, {
              requestedDaysBack: daysBack,
              resolvedDaysBack: span,
              revision,
              startedAt,
              completedAt: Date.now(),
            }));
          }
          throw error;
        }
        const completedAt = Date.now();
        if (!isStatsRuntimeRevisionFor(runtime, revision)) {
          throw createStatsFactsQueryError(
            'STATS_FACTS_QUERY_REVISION_CHANGED',
            'Stats facts range query was invalidated before it could be cached.',
          );
        }

        if (!loaded || typeof loaded !== 'object') {
          throw createStatsFactsQueryError(
            'STATS_FACTS_QUERY_INVALID_RANGE',
            'Stats facts repository returned an invalid range payload.',
          );
        }
        setStatsFactsRuntimeRangeLastReadFor(runtime, summarizeStatsFactsRangeRead(loaded, {
          requestedDaysBack: daysBack,
          resolvedDaysBack: span,
          revision,
          startedAt,
          completedAt,
          hourlyReadDiagnostics: loaded.readDiagnostics?.hourly,
        }));
        const durableRange = { ...loaded };
        delete durableRange.readDiagnostics;
        runtime.statsFactsRangeCache = propagateNormalizedAnalysisStatsRange(
          loaded,
          attachDurableStatsFactsReadModel(durableRange, {
            spanDays: span,
            runtimeEpoch: getStatsRuntimeEpochFor(runtime),
            runtimeRevision: revision,
          }),
        );
        runtime.statsFactsRangeCacheDaysBack = span;
        runtime.statsFactsRangeCacheRevision = revision;
        runtime.statsFactsRangeCacheAt = Date.now();
        runtime.statsFactsDerivedRangeCacheBase = runtime.statsFactsRangeCache;
        runtime.statsFactsDerivedRangeCacheBySpan.clear();
        return runtime.statsFactsRangeCache;
      })();

      runtime.statsFactsRangeCachePromise = promise;
      runtime.statsFactsRangeCachePromiseDaysBack = span;
      runtime.statsFactsRangeCachePromiseRevision = revision;
      const clearPromise = () => {
        if (!isStatsRuntimeRevisionFor(runtime, revision)) return;
        if (runtime.statsFactsRangeCachePromise === promise) {
          runtime.statsFactsRangeCachePromise = null;
          runtime.statsFactsRangeCachePromiseDaysBack = null;
          runtime.statsFactsRangeCachePromiseRevision = null;
        }
      };
      promise.then(clearPromise, clearPromise);
    }

    const loaded = await runtime.statsFactsRangeCachePromise;
    if (!isStatsRuntimeRevisionFor(runtime, revision)) {
      throw createStatsFactsQueryError(
        'STATS_FACTS_QUERY_REVISION_CHANGED',
        'Stats facts range query was invalidated after loading.',
      );
    }

    return resolveFactsRangeForSpan(loaded, span);
  }

  async function getStatsFactsRange(options = {}) {
    try {
      return await readStatsFactsRangeAttempt(options);
    } catch (error) {
      if (!revisionInvalidationErrors.has(error)) throw error;
      reportRuntimeDiagnostic({
        scope: 'StatsFactsQueryService', severity: 'debug',
        event: 'range_read_restarted', code: 'STATS_FACTS_QUERY_REVISION_RETRY',
      });
      // Reacquire the same canonical read under its current revision once.
      // A second invalidation or any repository failure remains terminal.
      return readStatsFactsRangeAttempt(options);
    }
  }

  return {
    getStatsFactsRange,
  };
}
