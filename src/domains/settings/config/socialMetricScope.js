export const SOCIAL_METRIC_SCOPES = Object.freeze({
  REACTIONS: 'reactions',
  REACTIONS_AND_VIEWS: 'reactions_and_views',
  ALL_COMPARISON: 'all_comparison',
});

export const DEFAULT_SOCIAL_METRIC_SCOPE = SOCIAL_METRIC_SCOPES.REACTIONS;

export const SOCIAL_METRIC_OPTION_KEYS = Object.freeze([
  'feedbackCounts',
  'viewCounts',
  'timeSignals',
  'audienceCounts',
]);

const SOCIAL_METRIC_SCOPE_SET = new Set(Object.values(SOCIAL_METRIC_SCOPES));

const SOCIAL_METRIC_OPTIONS_BY_SCOPE = Object.freeze({
  [SOCIAL_METRIC_SCOPES.REACTIONS]: Object.freeze({
    feedbackCounts: true,
    viewCounts: false,
    audienceCounts: false,
  }),
  [SOCIAL_METRIC_SCOPES.REACTIONS_AND_VIEWS]: Object.freeze({
    feedbackCounts: true,
    viewCounts: true,
    audienceCounts: false,
  }),
  [SOCIAL_METRIC_SCOPES.ALL_COMPARISON]: Object.freeze({
    feedbackCounts: true,
    viewCounts: true,
    audienceCounts: true,
  }),
});

export function normalizeSocialMetricScope(value) {
  if (!SOCIAL_METRIC_SCOPE_SET.has(value)) {
    throw new Error(`SOCIAL_METRIC_SCOPE_INVALID:${value || 'missing'}`);
  }
  return value;
}

export function buildSocialMetricOptionsForScope(scope, { timeSignals = false } = {}) {
  const normalizedScope = normalizeSocialMetricScope(scope);
  return {
    ...SOCIAL_METRIC_OPTIONS_BY_SCOPE[normalizedScope],
    timeSignals: timeSignals === true,
  };
}

export function resolveSocialMetricScope(options = {}) {
  if (options.audienceCounts === true) return SOCIAL_METRIC_SCOPES.ALL_COMPARISON;
  if (options.viewCounts === true) return SOCIAL_METRIC_SCOPES.REACTIONS_AND_VIEWS;
  return SOCIAL_METRIC_SCOPES.REACTIONS;
}
