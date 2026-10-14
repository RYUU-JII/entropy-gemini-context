function createSiteIntelEvidenceError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function requireTransitionEdgeIndex(index) {
  if (!(index?.byDomain instanceof Map) || !(index?.observedDates instanceof Set)) {
    throw createSiteIntelEvidenceError('STATS_RULE_SITE_INTEL_TRANSITION_EDGE_INDEX_REQUIRED');
  }
  return index;
}

export function requireInterventionEffectIndex(index) {
  if (!(index?.byDomainDate instanceof Map)) {
    throw createSiteIntelEvidenceError('STATS_RULE_SITE_INTEL_INTERVENTION_EFFECT_INDEX_REQUIRED');
  }
  return index;
}
