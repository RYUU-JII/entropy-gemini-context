import { MAX_DAYS_STORED } from './backgroundKernelRuntimeConfig.js';
import { createPrecisionRawDataQueryService } from '../../../../domains/stats/background/query/precisionRawDataQueryService.js';
import { createActionStatsQueryOwners } from './backgroundKernelActionStatsQueryOwners.js';

export function createBackgroundKernelActionStatsBindings({
  statsRuntimeService,
  statsAnalysisQueryService,
  statsTrendQueryService,
  tabTimeTracker,
  faviconService,
} = {}) {
  const precisionRawDataQueryService = createPrecisionRawDataQueryService({
    statsRuntimeService,
    maxDaysStored: MAX_DAYS_STORED,
  });
  const actionStatsQueryOwners = createActionStatsQueryOwners({
    statsAnalysisQueryService,
    statsTrendQueryService,
    tabTimeTracker,
    faviconService,
    getPrecisionRawData: precisionRawDataQueryService.getPrecisionRawData,
  });

  return {
    statsQueries: {
      maxDaysStored: MAX_DAYS_STORED,
      ...actionStatsQueryOwners,
    },
  };
}
