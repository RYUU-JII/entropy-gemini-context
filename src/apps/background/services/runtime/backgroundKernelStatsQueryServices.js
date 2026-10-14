import { createStatsAnalysisQueryService } from '../../../../domains/stats/background/query/statsAnalysisQueryService.js';
import { createStatsTrendQueryService } from '../../../../domains/stats/background/query/statsTrendQueryService.js';

export function createBackgroundKernelStatsQueryServices({
  getStatsFactsRange,
  getInterventionEffectsRange,
  getCycleState,
  getSettingsSnapshot,
} = {}) {
  if (typeof getInterventionEffectsRange !== 'function') {
    throw new Error('BACKGROUND_STATS_QUERY_INTERVENTION_EFFECTS_REQUIRED');
  }

  let statsAnalysisQueryServicePromise = null;
  let statsTrendQueryServicePromise = null;
  let statsAnalysisQueryServiceInstance = null;
  let statsTrendQueryServiceInstance = null;

  function getStatsAnalysisQueryService() {
    if (statsAnalysisQueryServiceInstance) return Promise.resolve(statsAnalysisQueryServiceInstance);
    statsAnalysisQueryServicePromise ||= Promise.resolve()
      .then(() => {
        statsAnalysisQueryServiceInstance = createStatsAnalysisQueryService({
          getStatsFactsRange,
          getInterventionEffectsRange,
          getCycleState,
          getSettingsSnapshot,
        });
        return statsAnalysisQueryServiceInstance;
      })
      .catch((error) => {
        statsAnalysisQueryServicePromise = null;
        console.error('[BackgroundStatsQueryServices] Failed to load analysis query service.', error);
        throw error;
      });
    return statsAnalysisQueryServicePromise;
  }

  function getStatsTrendQueryService() {
    if (statsTrendQueryServiceInstance) return Promise.resolve(statsTrendQueryServiceInstance);
    statsTrendQueryServicePromise ||= Promise.resolve()
      .then(() => {
        statsTrendQueryServiceInstance = createStatsTrendQueryService({
          getStatsFactsRange,
          getSettingsSnapshot,
          getCycleState,
        });
        return statsTrendQueryServiceInstance;
      })
      .catch((error) => {
        statsTrendQueryServicePromise = null;
        console.error('[BackgroundStatsQueryServices] Failed to load trend query service.', error);
        throw error;
      });
    return statsTrendQueryServicePromise;
  }

  const statsAnalysisQueryService = {
    async getAnalysisBootstrapSnapshot(...args) {
      const service = await getStatsAnalysisQueryService();
      return service.getAnalysisBootstrapSnapshot(...args);
    },
    async getCycleProjection(...args) {
      const service = await getStatsAnalysisQueryService();
      return service.getCycleProjection(...args);
    },
    async getStatusSnapshot(...args) {
      const service = await getStatsAnalysisQueryService();
      return service.getStatusSnapshot(...args);
    },
    async getSitesSnapshot(...args) {
      const service = await getStatsAnalysisQueryService();
      return service.getSitesSnapshot(...args);
    },
    async getSitesSiteDetail(...args) {
      const service = await getStatsAnalysisQueryService();
      return service.getSitesSiteDetail(...args);
    },
  };

  const statsTrendQueryService = {
    async getTrendSummary(...args) {
      const service = await getStatsTrendQueryService();
      return service.getTrendSummary(...args);
    },
    async getDomainSeries(...args) {
      const service = await getStatsTrendQueryService();
      return service.getDomainSeries(...args);
    },
  };

  return {
    statsAnalysisQueryService,
    statsTrendQueryService,
  };
}
