export const DB_NAME = 'EntropyDB';
export const DB_VERSION = 1;
export const ENC_ALGO = 'AES-GCM';
export const DB_EXPORT_FORMAT_VERSION = 1;

export const STORES = {
  LOGS: 'usage_logs',
  STATS_HOURLY: 'stats_hourly',
  STATS_DAILY: 'stats_daily',
  STATS_FEATURE_PACK_DAILY: 'stats_feature_pack_daily',
  INTERVENTION_EXPOSURES: 'intervention_exposures',
  INTERVENTION_EFFECT_DAILY: 'intervention_effect_daily',
  FAVICONS: 'favicons',
  MODEL_STATE: 'model_state',
  ZEN_ARTIFACTS: 'zen_artifacts',
  CLSE_BUCKETS_60S: 'clse_buckets_60s',
  CLSE_BUCKETS_5MIN: 'clse_buckets_5min',
  CLSE_LOOP_EVENTS: 'clse_loop_events',
  CLSE_BASELINE: 'clse_baseline',
  CLSE_AGGRESSION_LOGS: 'clse_aggression_logs',
  CLSE_DAILY_SUMMARIES: 'clse_daily_summaries',
};

export const EXPORT_STORE_NAMES = Object.freeze([
  STORES.LOGS,
  STORES.STATS_HOURLY,
  STORES.STATS_DAILY,
  STORES.STATS_FEATURE_PACK_DAILY,
  STORES.INTERVENTION_EXPOSURES,
  STORES.INTERVENTION_EFFECT_DAILY,
  STORES.FAVICONS,
  STORES.MODEL_STATE,
  STORES.ZEN_ARTIFACTS,
  STORES.CLSE_BUCKETS_60S,
  STORES.CLSE_BUCKETS_5MIN,
  STORES.CLSE_LOOP_EVENTS,
  STORES.CLSE_BASELINE,
  STORES.CLSE_AGGRESSION_LOGS,
  STORES.CLSE_DAILY_SUMMARIES,
]);

export const EXPORT_STORE_TO_FIELD = Object.freeze({
  [STORES.LOGS]: 'logs',
  [STORES.STATS_HOURLY]: 'statsHourly',
  [STORES.STATS_DAILY]: 'statsDaily',
  [STORES.STATS_FEATURE_PACK_DAILY]: 'statsFeaturePackDaily',
  [STORES.INTERVENTION_EXPOSURES]: 'interventionExposures',
  [STORES.INTERVENTION_EFFECT_DAILY]: 'interventionEffectDaily',
  [STORES.FAVICONS]: 'favicons',
  [STORES.MODEL_STATE]: 'modelState',
  [STORES.ZEN_ARTIFACTS]: 'zenArtifacts',
  [STORES.CLSE_BUCKETS_60S]: 'clseBuckets60s',
  [STORES.CLSE_BUCKETS_5MIN]: 'clseBuckets5min',
  [STORES.CLSE_LOOP_EVENTS]: 'clseLoopEvents',
  [STORES.CLSE_BASELINE]: 'clseBaseline',
  [STORES.CLSE_AGGRESSION_LOGS]: 'clseAggressionLogs',
  [STORES.CLSE_DAILY_SUMMARIES]: 'clseDailySummaries',
});
