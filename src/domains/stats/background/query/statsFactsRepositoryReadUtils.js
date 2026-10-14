import {
  STATS_RANGE_DEFAULT_DAYS,
  STATS_RANGE_MAX_DAYS,
} from '../../contracts/statsContracts.js';
import { normalizeAnalysisStatsRangeAtBoundary } from './statsAnalysisStatsRange.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createStatsRepositoryReadError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

export function resolveStatsDaysBack(
  daysBack,
  { fallbackDays = STATS_RANGE_DEFAULT_DAYS, maxDays = STATS_RANGE_MAX_DAYS } = {},
) {
  const fallback = Number.isFinite(Number(fallbackDays))
    ? Math.max(1, Math.floor(Number(fallbackDays)))
    : STATS_RANGE_DEFAULT_DAYS;
  const max = Number.isFinite(Number(maxDays))
    ? Math.max(1, Math.floor(Number(maxDays)))
    : STATS_RANGE_MAX_DAYS;
  const numeric = Number(daysBack);
  if (!Number.isFinite(numeric)) return Math.min(fallback, max);
  return Math.min(max, Math.max(1, Math.floor(numeric)));
}

export async function readStatsFactsRangeFromRepository({
  statsRepository,
  daysBack,
} = {}) {
  if (!statsRepository) {
    const error = new Error('STATS_QUERY_REPOSITORY_REQUIRED');
    error.code = 'STATS_QUERY_REPOSITORY_REQUIRED';
    throw error;
  }
  const span = resolveStatsDaysBack(daysBack);

  const range = await statsRepository.getStatsRange({ daysBack: span });
  if (!isPlainObject(range) || !isPlainObject(range.dates)) {
    throw createStatsRepositoryReadError(
      'STATS_QUERY_REPOSITORY_RANGE_INVALID',
      'Stats facts repository returned an invalid range payload.',
    );
  }
  return normalizeAnalysisStatsRangeAtBoundary(range);
}
