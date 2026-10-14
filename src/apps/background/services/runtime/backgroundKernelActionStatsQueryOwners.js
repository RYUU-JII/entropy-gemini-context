function requireActionStatsOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function requireActionStatsFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

export function createActionStatsQueryOwners({
  statsAnalysisQueryService,
  statsTrendQueryService,
  tabTimeTracker,
  faviconService,
  getPrecisionRawData,
} = {}) {
  requireActionStatsOwnerMethod(
    tabTimeTracker,
    'getLastDomainUrl',
    'BACKGROUND_ACTION_STATS_TAB_TIME_TRACKER_REQUIRED',
  );
  return {
    tabTimeTracker,
    getCachedFaviconData: requireActionStatsOwnerMethod(
      faviconService,
      'getCachedFaviconData',
      'BACKGROUND_ACTION_STATS_FAVICON_OWNER_REQUIRED',
    ),
    getAnalysisBootstrapSnapshot: requireActionStatsOwnerMethod(
      statsAnalysisQueryService,
      'getAnalysisBootstrapSnapshot',
      'BACKGROUND_ACTION_STATS_ANALYSIS_OWNER_REQUIRED',
    ),
    getCycleProjection: requireActionStatsOwnerMethod(
      statsAnalysisQueryService,
      'getCycleProjection',
      'BACKGROUND_ACTION_STATS_ANALYSIS_OWNER_REQUIRED',
    ),
    getStatusSnapshot: requireActionStatsOwnerMethod(
      statsAnalysisQueryService,
      'getStatusSnapshot',
      'BACKGROUND_ACTION_STATS_ANALYSIS_OWNER_REQUIRED',
    ),
    getSitesSnapshot: requireActionStatsOwnerMethod(
      statsAnalysisQueryService,
      'getSitesSnapshot',
      'BACKGROUND_ACTION_STATS_ANALYSIS_OWNER_REQUIRED',
    ),
    getSitesSiteDetail: requireActionStatsOwnerMethod(
      statsAnalysisQueryService,
      'getSitesSiteDetail',
      'BACKGROUND_ACTION_STATS_ANALYSIS_OWNER_REQUIRED',
    ),
    getTrendSummary: requireActionStatsOwnerMethod(
      statsTrendQueryService,
      'getTrendSummary',
      'BACKGROUND_ACTION_STATS_TREND_OWNER_REQUIRED',
    ),
    getDomainSeries: requireActionStatsOwnerMethod(
      statsTrendQueryService,
      'getDomainSeries',
      'BACKGROUND_ACTION_STATS_TREND_OWNER_REQUIRED',
    ),
    getPrecisionRawData: requireActionStatsFunction(
      getPrecisionRawData,
      'BACKGROUND_ACTION_STATS_PRECISION_RAW_OWNER_REQUIRED',
    ),
  };
}
