import { STATS_RANGE_MAX_DAYS } from '../../contracts/statsContracts.js';

const DEFAULT_MAX_DAYS_STORED = STATS_RANGE_MAX_DAYS;

function isPrecisionPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePrecisionObject(value) {
  return isPrecisionPlainObject(value) ? value : {};
}

function normalizePrecisionCollection(value) {
  return isPrecisionPlainObject(value) ? value : null;
}

function hasPrecisionRawDomainData(domainData = null) {
  if (!isPrecisionPlainObject(domainData)) return false;
  const behavior = normalizePrecisionObject(domainData.behavior);
  const navigation = normalizePrecisionObject(domainData.navigation);
  const collection = normalizePrecisionCollection(domainData.collection);
  const hasCollection = !!collection?.precisionInsightsMode;
  const hasBehavior = Object.values(behavior).some((value) => Number(value) > 0);
  const hasNavigation = Object.values(navigation).some((value) => Number(value) > 0);
  return hasCollection || hasBehavior || hasNavigation;
}

function normalizeDaysBack(daysBack, maxDaysStored = DEFAULT_MAX_DAYS_STORED) {
  const maxDays = Number.isFinite(Number(maxDaysStored))
    ? Math.max(1, Math.floor(Number(maxDaysStored)))
    : DEFAULT_MAX_DAYS_STORED;
  return Number.isFinite(Number(daysBack))
    ? Math.max(1, Math.min(maxDays, Math.floor(Number(daysBack))))
    : maxDays;
}

function requirePrecisionStatsRange(statsRange) {
  if (
    !isPrecisionPlainObject(statsRange)
    || !isPrecisionPlainObject(statsRange.dates)
  ) {
    const error = new Error('PRECISION_RAW_DATA_QUERY_INVALID_STATS_RANGE');
    error.code = 'PRECISION_RAW_DATA_QUERY_INVALID_STATS_RANGE';
    throw error;
  }
  return statsRange;
}

export function projectPrecisionRawData(statsRange = {}, { daysBack = DEFAULT_MAX_DAYS_STORED } = {}) {
  const dates = isPrecisionPlainObject(statsRange?.dates) ? statsRange.dates : {};
  const rows = Object.entries(dates)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateStr, dayData]) => {
      const domains = isPrecisionPlainObject(dayData?.domains) ? dayData.domains : {};
      const domainRows = Object.entries(domains)
        .filter(([, domainData]) => hasPrecisionRawDomainData(domainData))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([domain, domainData]) => ({
          domain,
          collection: normalizePrecisionCollection(domainData.collection),
          behavior: normalizePrecisionObject(domainData.behavior),
          navigation: normalizePrecisionObject(domainData.navigation),
          sessions: normalizePrecisionObject(domainData.sessions),
        }));
      return { dateStr, domains: domainRows };
    })
    .filter((entry) => entry.domains.length > 0);

  return {
    generatedAt: new Date().toISOString(),
    daysBack,
    summary: {
      days: rows.length,
      domains: rows.reduce((sum, entry) => sum + entry.domains.length, 0),
    },
    dates: rows,
  };
}

export function createPrecisionRawDataQueryService({
  statsRuntimeService,
  maxDaysStored = DEFAULT_MAX_DAYS_STORED,
} = {}) {
  if (!statsRuntimeService || typeof statsRuntimeService.getStatsFactsRange !== 'function') {
    throw new Error('PRECISION_RAW_DATA_QUERY_STATS_RUNTIME_REQUIRED');
  }

  async function getPrecisionRawData({ daysBack = maxDaysStored } = {}) {
    const span = normalizeDaysBack(daysBack, maxDaysStored);
    const statsRange = await statsRuntimeService.getStatsFactsRange({ daysBack: span });
    return projectPrecisionRawData(requirePrecisionStatsRange(statsRange), { daysBack: span });
  }

  return { getPrecisionRawData };
}
