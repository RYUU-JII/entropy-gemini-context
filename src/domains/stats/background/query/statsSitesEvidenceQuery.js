import {
  SITE_PULL_BASELINE_READ_DAYS,
  getRecentDateStrings,
} from './statsAnalysisQueryShared.js';

function createStatsSitesEvidenceError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireInterventionEffectReader(reader) {
  if (typeof reader !== 'function') {
    throw createStatsSitesEvidenceError('STATS_ANALYSIS_QUERY_INTERVENTION_EFFECTS_REQUIRED');
  }
  return reader;
}

function requireInterventionEffectList(value) {
  if (!Array.isArray(value)) {
    throw createStatsSitesEvidenceError('STATS_ANALYSIS_QUERY_INTERVENTION_EFFECTS_INVALID');
  }
  return value;
}

export function getStatsSitesInterventionEvidenceBaselineRange(now = Date.now()) {
  const dates = getRecentDateStrings(SITE_PULL_BASELINE_READ_DAYS, now);
  return { startDateStr: dates[0], endDateStr: dates[dates.length - 1] };
}

export async function readStatsSitesInterventionEvidenceRange({
  getInterventionEffectsRange,
  now = Date.now(),
} = {}) {
  const readInterventionEffectsRange = requireInterventionEffectReader(getInterventionEffectsRange);
  const range = getStatsSitesInterventionEvidenceBaselineRange(now);
  return requireInterventionEffectList(await readInterventionEffectsRange(range));
}
