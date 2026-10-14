export const SOCIAL_METRICS_CANDIDATE_PROVENANCE = Object.freeze({
  SELECTOR_ONLY: 'selector_only',
  SEMANTIC_ONLY: 'semantic_only',
  SELECTOR_SEMANTIC_OVERLAP: 'selector_semantic_overlap',
});

export const SOCIAL_METRICS_SELECTOR_DRIFT_PILOT = Object.freeze({
  siteId: 'youtube',
  filterKeys: Object.freeze([
    'feedbackCounts',
    'viewCounts',
    'timeSignals',
  ]),
  certificationEpochs: 3,
});

export const SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES = Object.freeze({
  X_ACTION_GROUP: 'x_action_group',
  INSTAGRAM_FEED_ACTION: 'instagram_feed_action',
  INSTAGRAM_REEL_ACTION: 'instagram_reel_action',
  INSTAGRAM_PROFILE_STATS: 'instagram_profile_stats',
  INSTAGRAM_GRID_OVERLAY: 'instagram_grid_overlay',
  INSTAGRAM_DIALOG: 'instagram_dialog',
});

export const SOCIAL_METRICS_SELECTOR_DRIFT_POLICIES = Object.freeze({
  youtube: SOCIAL_METRICS_SELECTOR_DRIFT_PILOT,
  x: Object.freeze({
    siteId: 'x',
    filterKeys: Object.freeze(['feedbackCounts', 'viewCounts']),
    surfaces: Object.freeze([SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.X_ACTION_GROUP]),
    certificationEpochs: 3,
  }),
  instagram: Object.freeze({
    siteId: 'instagram',
    filterKeys: Object.freeze(['feedbackCounts', 'audienceCounts']),
    surfaces: Object.freeze([
      SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_FEED_ACTION,
      SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_REEL_ACTION,
      SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_PROFILE_STATS,
      SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_GRID_OVERLAY,
      SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_DIALOG,
    ]),
    certificationEpochs: 3,
  }),
});

const CANDIDATE_PROVENANCE_VALUES = new Set(
  Object.values(SOCIAL_METRICS_CANDIDATE_PROVENANCE),
);

export function requireSocialMetricsCandidateProvenance(value) {
  if (!CANDIDATE_PROVENANCE_VALUES.has(value)) {
    throw new Error('SOCIAL_METRICS_CANDIDATE_PROVENANCE_INVALID');
  }
  return value;
}

export function isSocialMetricsSelectorDriftPilotDecision({
  siteId = null,
  matchedKey = null,
  provenance = null,
  surface = null,
} = {}) {
  const policy = SOCIAL_METRICS_SELECTOR_DRIFT_POLICIES[siteId] || null;
  if (!policy || !policy.filterKeys.includes(matchedKey)) return false;
  if (
    Array.isArray(policy.surfaces)
    && !policy.surfaces.includes(surface)
  ) return false;
  return provenance === SOCIAL_METRICS_CANDIDATE_PROVENANCE.SEMANTIC_ONLY;
}
