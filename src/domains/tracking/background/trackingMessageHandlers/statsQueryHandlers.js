import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import {
  requireSitesSiteDetailDomain,
  requireSitesSiteDetailQueryResult,
  requireSitesSiteDetailRevision,
} from '../../../stats/contracts/sitesSiteDetailContracts.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';

function statsQueryError(error, fallbackCode) {
  const diagnostics = error?.diagnostics && typeof error.diagnostics === 'object'
    ? error.diagnostics
    : null;
  return {
    success: false,
    error: {
      code: typeof error?.code === 'string' && error.code ? error.code : fallbackCode,
      message: typeof error?.message === 'string' && error.message
        ? error.message
        : String(error || fallbackCode),
      ...(diagnostics ? { diagnostics } : {}),
    },
  };
}

function requireStatsQueryFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function createStatsQueryResultError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function resolveStatsQueryDaysBack(request, maxDaysStored, {
  defaultWhenMissing = undefined,
  errorCode = 'STATS_QUERY_DAYS_BACK_INVALID',
} = {}) {
  if (!Object.prototype.hasOwnProperty.call(request || {}, 'daysBack')) {
    return defaultWhenMissing;
  }
  const value = request.daysBack;
  const isBlank = typeof value === 'string' && value.trim() === '';
  const numeric = Number(value);
  if (
    value === null
    || typeof value === 'boolean'
    || isBlank
    || !Number.isFinite(numeric)
  ) {
    throw createStatsQueryResultError(errorCode);
  }
  const maxDays = Number.isFinite(Number(maxDaysStored))
    ? Math.max(1, Math.floor(Number(maxDaysStored)))
    : Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.min(maxDays, Math.floor(numeric)));
}

function requireStatsQueryResultObject(value, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createStatsQueryResultError(errorCode);
  }
  return value;
}

function requireStatsQueryTabTimeTracker(tabTimeTracker) {
  if (typeof tabTimeTracker?.getLastDomainUrl !== 'function') {
    throw new Error('LAST_DOMAIN_URLS_OWNER_REQUIRED');
  }
  return tabTimeTracker;
}

export function createStatsQueryActionHandlers({
  maxDaysStored,
  tabTimeTracker,
  getCachedFaviconData,
  getAnalysisBootstrapSnapshot,
  getCycleProjection,
  getStatusSnapshot,
  getSitesSnapshot,
  getSitesSiteDetail,
  getTrendSummary,
  getDomainSeries,
  getPrecisionRawData,
} = {}) {
  const readLastDomainUrlOwner = requireStatsQueryTabTimeTracker(tabTimeTracker);
  const readCachedFaviconData = requireStatsQueryFunction(
    getCachedFaviconData,
    'FAVICON_QUERY_OWNER_REQUIRED',
  );
  const readAnalysisBootstrapSnapshot = requireStatsQueryFunction(
    getAnalysisBootstrapSnapshot,
    'ANALYSIS_BOOTSTRAP_QUERY_OWNER_REQUIRED',
  );
  const readCycleProjection = requireStatsQueryFunction(
    getCycleProjection,
    'CYCLE_PROJECTION_QUERY_OWNER_REQUIRED',
  );
  const readStatusSnapshot = requireStatsQueryFunction(
    getStatusSnapshot,
    'STATUS_SNAPSHOT_QUERY_OWNER_REQUIRED',
  );
  const readSitesSnapshot = requireStatsQueryFunction(
    getSitesSnapshot,
    'SITES_SNAPSHOT_QUERY_OWNER_REQUIRED',
  );
  const readSitesSiteDetail = requireStatsQueryFunction(
    getSitesSiteDetail,
    'SITES_SITE_DETAIL_QUERY_OWNER_REQUIRED',
  );
  const readTrendSummary = requireStatsQueryFunction(
    getTrendSummary,
    'TREND_SUMMARY_QUERY_OWNER_REQUIRED',
  );
  const readDomainSeries = requireStatsQueryFunction(
    getDomainSeries,
    'DOMAIN_SERIES_QUERY_OWNER_REQUIRED',
  );
  const readPrecisionRawData = requireStatsQueryFunction(
    getPrecisionRawData,
    'PRECISION_RAW_DATA_QUERY_OWNER_REQUIRED',
  );

  return {
    [MESSAGE_ACTIONS.GET_ANALYSIS_BOOTSTRAP_SNAPSHOT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const daysBack = resolveStatsQueryDaysBack(request, maxDaysStored, {
          defaultWhenMissing: maxDaysStored,
          errorCode: 'ANALYSIS_BOOTSTRAP_DAYS_BACK_INVALID',
        });
        const analysis = await readAnalysisBootstrapSnapshot({
          daysBack,
          policyInput: request?.policyInput,
          includeSitesSnapshot: request?.includeSitesSnapshot !== false,
        });
        return {
          success: true,
          analysis: requireStatsQueryResultObject(
            analysis,
            'ANALYSIS_BOOTSTRAP_QUERY_RESULT_INVALID',
          ),
        };
      },
      (error) => statsQueryError(error, 'ANALYSIS_QUERY_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_CYCLE_PROJECTION]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const projection = requireStatsQueryResultObject(
          await readCycleProjection({ policyInput: _request?.policyInput }),
          'CYCLE_PROJECTION_QUERY_RESULT_INVALID',
        );
        return { success: true, ...projection };
      },
      (error) => statsQueryError(error, 'CYCLE_PROJECTION_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_STATUS_SNAPSHOT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const snapshot = requireStatsQueryResultObject(
          await readStatusSnapshot({ policyInput: request?.policyInput }),
          'STATUS_SNAPSHOT_QUERY_RESULT_INVALID',
        );
        return { success: true, ...snapshot };
      },
      (error) => statsQueryError(error, 'STATUS_SNAPSHOT_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_SITES_SNAPSHOT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const snapshot = requireStatsQueryResultObject(
          await readSitesSnapshot({ policyInput: request?.policyInput }),
          'SITES_SNAPSHOT_QUERY_RESULT_INVALID',
        );
        return { success: true, ...snapshot };
      },
      (error) => statsQueryError(error, 'SITES_SNAPSHOT_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_SITES_SITE_DETAIL]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const snapshot = requireSitesSiteDetailQueryResult(requireStatsQueryResultObject(
          await readSitesSiteDetail({
            domain: requireSitesSiteDetailDomain(request?.domain),
            policyInput: request?.policyInput,
            siteDetailRevision: requireSitesSiteDetailRevision(request?.siteDetailRevision),
          }),
          'SITES_SITE_DETAIL_QUERY_RESULT_INVALID',
        ));
        return { success: true, ...snapshot };
      },
      (error) => statsQueryError(error, 'SITES_SITE_DETAIL_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_TREND_SUMMARY]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const daysBack = resolveStatsQueryDaysBack(request, maxDaysStored, {
          errorCode: 'TREND_SUMMARY_DAYS_BACK_INVALID',
        });
        const trendSummary = requireStatsQueryResultObject(
          await readTrendSummary({
            startDateStr: request?.startDateStr,
            endDateStr: request?.endDateStr,
            daysBack,
            groupBy: request?.groupBy,
            grain: request?.grain,
            basis: request?.basis,
            resetHour: request?.resetHour,
            temporal: request?.temporal,
            policyInput: request?.policyInput,
            filter: request?.filter,
          }),
          'TREND_SUMMARY_QUERY_RESULT_INVALID',
        );
        return { success: true, ...trendSummary };
      },
      (error) => statsQueryError(error, 'TREND_SUMMARY_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_DOMAIN_SERIES]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const daysBack = resolveStatsQueryDaysBack(request, maxDaysStored, {
          errorCode: 'DOMAIN_SERIES_DAYS_BACK_INVALID',
        });
        const domainSeries = requireStatsQueryResultObject(
          await readDomainSeries({
            domain: request?.domain,
            startDateStr: request?.startDateStr,
            endDateStr: request?.endDateStr,
            daysBack,
            bucket: request?.bucket,
            grain: request?.grain,
            basis: request?.basis,
            resetHour: request?.resetHour,
            temporal: request?.temporal,
            policyInput: request?.policyInput,
          }),
          'DOMAIN_SERIES_QUERY_RESULT_INVALID',
        );
        return { success: true, ...domainSeries };
      },
      (error) => statsQueryError(error, 'DOMAIN_SERIES_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_PRECISION_RAW_DATA]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const daysBack = resolveStatsQueryDaysBack(request, maxDaysStored, {
          defaultWhenMissing: maxDaysStored,
          errorCode: 'PRECISION_RAW_DATA_DAYS_BACK_INVALID',
        });
        const rawData = requireStatsQueryResultObject(
          await readPrecisionRawData({ daysBack }),
          'PRECISION_RAW_DATA_QUERY_RESULT_INVALID',
        );
        return { success: true, rawData };
      },
      (error) => statsQueryError(error, 'PRECISION_RAW_DATA_FAILED'),
    ),

    [MESSAGE_ACTIONS.GET_LAST_DOMAIN_URLS]: (request, _sender, sendResponse) => {
      const domains = Array.isArray(request?.domains) ? request.domains : [];
      const urls = {};
      for (const domain of domains) {
        const rawKey = normalizeDomain(domain);
        const key = rawKey ? rawKey.toLowerCase() : '';
        if (!key) continue;
        const url = readLastDomainUrlOwner.getLastDomainUrl(key);
        if (url) urls[domain] = url;
      }
      sendResponse({ success: true, urls });
      return false;
    },

    [MESSAGE_ACTIONS.GET_FAVICON_DATA]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const domain = request?.domain || request?.hostname || '';
        const dataUrl = await readCachedFaviconData(domain);
        if (typeof dataUrl !== 'string') {
          return { success: false, error: 'FAVICON_QUERY_INVALID_DATA_URL', dataUrl: '' };
        }
        return { success: true, dataUrl };
      },
      (error) => ({ success: false, error: error?.message || 'GET_FAVICON_DATA_FAILED', dataUrl: '' }),
    ),
  };
}
