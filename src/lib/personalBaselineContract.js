export const PERSONAL_BASELINE_ROLES = Object.freeze({
  OBSERVED_BASELINE: 'observed_baseline',
  RECENT_TRAJECTORY: 'recent_trajectory',
  ADAPTIVE_REFERENCE: 'adaptive_reference',
  NORMATIVE_ANCHOR: 'normative_anchor',
});

export const PERSONAL_BASELINE_STATUSES = Object.freeze({
  SPARSE: 'sparse',
  FORMING: 'forming',
  STABLE: 'stable',
});

export const PERSONAL_BASELINE_REFERENCE_MODES = Object.freeze({
  NORMATIVE_ONLY: 'normative_only',
  BOUNDED_ADAPTIVE: 'bounded_adaptive',
});

export const PERSONAL_BASELINE_METRIC_GRAINS = Object.freeze({
  DAY: 'day',
  BUCKET_10S: 'bucket_10s',
  BUCKET_60S: 'bucket_60s',
  PAGED_ITEM_DWELL: 'paged_item_dwell',
  CONTINUOUS_SESSION_SCREENFULS: 'continuous_session_screenfuls',
});

export const PERSONAL_BASELINE_METRIC_DIRECTIONS = Object.freeze({
  HIGHER: 'higher',
});
