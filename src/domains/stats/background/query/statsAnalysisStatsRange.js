import { normalizeStatsRange } from '../../contracts/statsContracts.js';
import {
  isStatsRangeNormalized,
  markStatsRangeNormalized,
} from '../contracts/statsNormalizedRangeRegistry.js';

const analysisStatsRangeTokens = new WeakMap();
const analysisStatsRangeTokensByRange = new WeakMap();

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireStatsRange(value) {
  if (!isRecord(value) || !isRecord(value.dates)) {
    throw createAnalysisStatsRangeError('STATS_ANALYSIS_STATS_RANGE_INVALID');
  }
  return value;
}

function createAnalysisStatsRangeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function registerNormalizedAnalysisStatsRange(statsRange) {
  const range = requireStatsRange(statsRange);
  return markStatsRangeNormalized(range);
}

export function normalizeAnalysisStatsRangeAtBoundary(statsRange) {
  const range = requireStatsRange(statsRange);
  if (isStatsRangeNormalized(range)) return range;
  return registerNormalizedAnalysisStatsRange(normalizeStatsRange(range));
}

export function propagateNormalizedAnalysisStatsRange(sourceRange, derivedRange) {
  const target = requireStatsRange(derivedRange);
  if (isRecord(sourceRange) && isStatsRangeNormalized(sourceRange)) {
    const sourceDates = sourceRange.dates;
    const preservesNormalizedDateGraph = Object.entries(target.dates).every(
      ([dateStr, day]) => (
        Object.prototype.hasOwnProperty.call(sourceDates, dateStr)
        && sourceDates[dateStr] === day
      ),
    );
    if (!preservesNormalizedDateGraph) {
      throw createAnalysisStatsRangeError('STATS_ANALYSIS_DERIVED_RANGE_INVALID');
    }
    markStatsRangeNormalized(target);
  }
  return target;
}

export function prepareAnalysisStatsRange(statsRange) {
  if (isRecord(statsRange) && analysisStatsRangeTokens.has(statsRange)) {
    return statsRange;
  }

  const range = requireStatsRange(statsRange);
  const normalizedRange = isStatsRangeNormalized(range)
    ? range
    : normalizeAnalysisStatsRangeAtBoundary(range);
  const existingToken = analysisStatsRangeTokensByRange.get(normalizedRange);
  if (existingToken) return existingToken;

  // The token is query-local capability state. The facts graph stays unchanged
  // and serializing the token cannot accidentally serialize the graph.
  const token = Object.freeze({});
  analysisStatsRangeTokens.set(token, normalizedRange);
  analysisStatsRangeTokensByRange.set(normalizedRange, token);
  return token;
}

export function readAnalysisStatsRange(statsRangeOrToken) {
  if (isRecord(statsRangeOrToken) && analysisStatsRangeTokens.has(statsRangeOrToken)) {
    return analysisStatsRangeTokens.get(statsRangeOrToken);
  }
  return analysisStatsRangeTokens.get(prepareAnalysisStatsRange(statsRangeOrToken));
}
