import { SOCIAL_METRIC_OPTION_KEYS } from '../../../../settings/config/socialMetricScope.js';

export const SOCIAL_METRIC_FILTER_KEYS = SOCIAL_METRIC_OPTION_KEYS;

export const ENGAGEMENT_FILTER_KEYS = new Set(['feedbackCounts', 'audienceCounts']);
export const EXPOSURE_FILTER_KEYS = new Set(['viewCounts', 'timeSignals']);
export const SOCIAL_METRIC_GROUPS = Object.freeze(['engagement', 'exposure']);

export function getMetricGroupForFilterKey(filterKey) {
  if (ENGAGEMENT_FILTER_KEYS.has(filterKey)) return 'engagement';
  if (EXPOSURE_FILTER_KEYS.has(filterKey)) return 'exposure';
  return null;
}
