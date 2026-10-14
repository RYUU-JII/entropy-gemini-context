import {
  parseLocalDateParts,
  shiftDateStr,
} from '../../shared/dateMath.js';
import { SITE_PULL_PERSONAL_BASELINE_POLICY } from './personalBaselinePolicy.js';

const SITE_PULL_BASELINE_SOURCE_VERSION = 'site-pull-baseline-series-source-v1';
export const SITE_PULL_BASELINE_SOURCE_TARGET_DAYS = (
  SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays
);

function hasOwn(value, key) {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, key);
}

function createBaselineSourceError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function normalizeSitePullBaselineSeriesSource(source, {
  normalizeEntry = (entry) => ({ ...entry }),
} = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw createBaselineSourceError('SITE_PULL_BASELINE_SOURCE_INVALID');
  }
  if (!hasOwn(source, 'baselineSeries')) {
    throw createBaselineSourceError('SITE_PULL_BASELINE_SERIES_MISSING');
  }
  if (!hasOwn(source, 'baselineCurrentDateStr')) {
    throw createBaselineSourceError('SITE_PULL_BASELINE_CURRENT_DATE_MISSING');
  }
  if (!Array.isArray(source.baselineSeries)) {
    throw createBaselineSourceError('SITE_PULL_BASELINE_SERIES_INVALID');
  }
  const currentDateStr = source.baselineCurrentDateStr;
  if (typeof currentDateStr !== 'string' || !parseLocalDateParts(currentDateStr)) {
    throw createBaselineSourceError('SITE_PULL_BASELINE_CURRENT_DATE_INVALID');
  }
  if (source.baselineSeries.length === 0) {
    return {
      version: SITE_PULL_BASELINE_SOURCE_VERSION,
      currentDateStr,
      targetDays: SITE_PULL_BASELINE_SOURCE_TARGET_DAYS,
      windowBasis: 'completed_calendar_day',
      excludeCurrent: true,
      series: [],
    };
  }
  if (source.baselineSeries.length !== SITE_PULL_BASELINE_SOURCE_TARGET_DAYS) {
    throw createBaselineSourceError('SITE_PULL_BASELINE_SERIES_LENGTH_INVALID', {
      expected: SITE_PULL_BASELINE_SOURCE_TARGET_DAYS,
      actual: source.baselineSeries.length,
    });
  }

  const series = source.baselineSeries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw createBaselineSourceError(`SITE_PULL_BASELINE_ENTRY_INVALID:${index}`);
    }
    const expectedDateStr = shiftDateStr(
      currentDateStr,
      -(SITE_PULL_BASELINE_SOURCE_TARGET_DAYS - index),
    );
    if (typeof entry.dateStr !== 'string' || !parseLocalDateParts(entry.dateStr)) {
      throw createBaselineSourceError(`SITE_PULL_BASELINE_DATE_INVALID:${index}`);
    }
    if (entry.dateStr !== expectedDateStr) {
      throw createBaselineSourceError(`SITE_PULL_BASELINE_DATE_RANGE_INVALID:${index}`, {
        expectedDateStr,
        actualDateStr: entry.dateStr,
      });
    }
    if (typeof entry.observed !== 'boolean') {
      throw createBaselineSourceError(`SITE_PULL_BASELINE_OBSERVED_INVALID:${index}`);
    }
    if (entry.observed) {
      if (typeof entry.activeMs !== 'number'
        || !Number.isFinite(entry.activeMs)
        || entry.activeMs < 0) {
        throw createBaselineSourceError(`SITE_PULL_BASELINE_ACTIVE_MS_INVALID:${index}`);
      }
    } else if (entry.activeMs !== null) {
      throw createBaselineSourceError(`SITE_PULL_BASELINE_MISSING_ACTIVE_MS_INVALID:${index}`);
    }
    const normalizedEntry = normalizeEntry(entry);
    if (!normalizedEntry || typeof normalizedEntry !== 'object' || Array.isArray(normalizedEntry)) {
      throw createBaselineSourceError(`SITE_PULL_BASELINE_NORMALIZED_ENTRY_INVALID:${index}`);
    }
    return {
      ...normalizedEntry,
      dateStr: entry.dateStr,
      activeMs: entry.observed ? entry.activeMs : null,
      observed: entry.observed,
    };
  });

  return {
    version: SITE_PULL_BASELINE_SOURCE_VERSION,
    currentDateStr,
    targetDays: SITE_PULL_BASELINE_SOURCE_TARGET_DAYS,
    windowBasis: 'completed_calendar_day',
    excludeCurrent: true,
    series,
  };
}
