import { resolveSitePullObservationState } from './sitePullObservationState.js';
import { buildSitePullEvidenceReadout } from './sitePullInterpretationEvidence.js';

export const SITE_PULL_INTERPRETATION_VERSION = 'site-pull-interpretation-v3';
const POLICY_PATTERN_IDS = new Set(['goal_exceeded', 'goal_exceeded_repeated', 'goal_missing', 'goal_kept']);
const STATE_PATTERN_IDS = new Set(['insufficient_data', 'steady', 'no_activity']);

function buildReadingPeriods(vector, observation) {
  const current = vector.baselineCurrentDateStr;
  if (typeof current !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(current)
    || !Array.isArray(vector.baselineSeries)) throw new Error('SITE_PULL_READING_PERIOD_SOURCE_INVALID');
  const period = (id, basis, entries, rangeRole = 'measurement') => ({
    id, basis, rangeRole, labelKey: `target_profile.reading_period_${id}`,
    startDateStr: entries.length ? entries[0].dateStr : null,
    endDateStr: entries.length ? entries.at(-1).dateStr : null,
    observedDayCount: entries.filter((entry) => entry.observed).length,
    windowDayCount: entries.length, includesCurrent: entries.some((entry) => entry.dateStr === current),
    coverageMeaning: 'observation_markers_not_capture_completeness',
  });
  const unpublished = (id) => ({ id, labelKey: `target_profile.reading_period_${id}`,
    basis: 'canonical_recent_trajectory', rangeRole: 'model_reference',
    startDateStr: null, endDateStr: null, observedDayCount: null, windowDayCount: null,
    includesCurrent: null, coverageMeaning: 'range_not_published' });
  return {
    today: period('today', 'calendar-day', [{ dateStr: current, observed: observation.todayObserved }]),
    weekly: period('weekly', 'current-inclusive-calendar-days', vector.weeklySeries),
    personal_reference: period('personal_reference', 'completed-calendar-history', vector.baselineSeries, 'source_history'),
    // The baseline owner publishes these model values, but not their full
    // date/provenance windows. Do not reconstruct that algorithm in the reader.
    recent_trajectory: unpublished('recent_trajectory'),
    trajectory_reference: unpublished('trajectory_reference'),
  };
}

function claimRole(item) {
  if (POLICY_PATTERN_IDS.has(item.patternId)) return 'policy';
  if (STATE_PATTERN_IDS.has(item.patternId)) return 'state';
  return item.claimVisibility === 'primary_claim' ? 'behavior' : 'supporting';
}

function sameList(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameMetric(left, right) {
  return left && ['id', 'field', 'labelKey', 'unit', 'period', 'value', 'status'].every((key) => left[key] === right[key])
    && left.provenance && ['patternId', 'family', 'kind', 'cohort'].every((key) => left.provenance[key] === right.provenance[key]);
}

function primaryMetrics(claim) {
  // Zero is valid disclosure data, but unrelated absent activity is not a
  // leading reason for this reading. A comparison's actual zero stays visible.
  return claim.metrics.filter((metric) => metric.status === 'observed'
    && (metric.value > 0 || metric.provenance.kind === 'model_reference')).slice(0, 2);
}

function requireReadingPeriods(periods, observation) {
  for (const id of ['today', 'weekly', 'personal_reference', 'recent_trajectory', 'trajectory_reference']) {
    const period = periods[id];
    if (!period || period.id !== id || period.labelKey !== `target_profile.reading_period_${id}`) {
      throw new Error('SITE_PULL_READING_PERIOD_INVALID');
    }
    if (id.includes('trajectory')) {
      if (period.basis !== 'canonical_recent_trajectory' || period.rangeRole !== 'model_reference'
        || period.coverageMeaning !== 'range_not_published'
        || ['startDateStr', 'endDateStr', 'observedDayCount', 'windowDayCount', 'includesCurrent'].some((key) => period[key] !== null)) {
        throw new Error('SITE_PULL_READING_PERIOD_INVALID');
      }
      continue;
    }
    const expectedBasis = { today: 'calendar-day', weekly: 'current-inclusive-calendar-days', personal_reference: 'completed-calendar-history' }[id];
    const validDate = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (period.basis !== expectedBasis
      || period.rangeRole !== (id === 'personal_reference' ? 'source_history' : 'measurement')
      || period.coverageMeaning !== 'observation_markers_not_capture_completeness'
      || !Number.isInteger(period.windowDayCount) || period.windowDayCount < 0
      || !Number.isInteger(period.observedDayCount) || period.observedDayCount < 0
      || period.observedDayCount > period.windowDayCount || typeof period.includesCurrent !== 'boolean'
      || (period.windowDayCount > 0 ? !validDate(period.startDateStr) || !validDate(period.endDateStr)
        || period.startDateStr > period.endDateStr : period.startDateStr !== null || period.endDateStr !== null)
      || (id === 'today' && (period.windowDayCount !== 1 || period.startDateStr !== period.endDateStr
        || period.observedDayCount !== Number(observation.todayObserved) || !period.includesCurrent))
      || (id === 'weekly' && (period.windowDayCount !== observation.windowDayCount || period.observedDayCount !== observation.observedWeeklyDays))
      || (id === 'personal_reference' && period.includesCurrent)) {
      throw new Error('SITE_PULL_READING_PERIOD_INVALID');
    }
  }
}

// Terminal interpretation: only this seam selects the detail headline. It is
// never an input to facts, scoring, baseline, or another detector.
export function buildSitePullInterpretation({ featureVector, feedbackSurfaces, hasInterventionFacts }) {
  const observation = resolveSitePullObservationState(featureVector);
  const claims = feedbackSurfaces.detail.map((item) => ({
    ...buildSitePullEvidenceReadout(item), role: claimRole(item),
    quality: item.decisionQuality ? { status: item.decisionQuality.status,
      nearBoundary: item.decisionQuality.nearBoundary, meaning: 'heuristic_evidence_quality' } : null,
  }));
  const candidates = claims.filter((item) => item.role === 'behavior');
  const primary = observation.status === 'activity'
    ? candidates.find((item) => item.metrics.some((entry) => entry.status === 'observed'
      && entry.value > 0 && entry.provenance.kind !== 'model_reference'))
    : null;
  const state = observation.status === 'observed_zero' ? 'observed_zero'
    : observation.status === 'missing' ? 'collecting' : 'unclassified';
  const headline = primary
    ? { kind: 'pattern', patternId: primary.patternId, surfaceItemId: primary.surfaceItemId, messageKey: primary.headlineKey }
    : { kind: 'state', state, messageKey: `target_profile.reading_state_${state === 'observed_zero' ? 'zero' : state}` };
  const expanded = observation.status === 'activity'
    ? [...(primary ? [primary] : []), ...claims.filter((item) => item !== primary
      && ['behavior', 'supporting'].includes(item.role)
      && item.metrics.some((metric) => metric.status === 'observed'))].slice(0, 3) : [];
  return {
    version: SITE_PULL_INTERPRETATION_VERSION,
    observation,
    headline,
    evidenceSurfaceItemIds: primary ? [primary.surfaceItemId] : [],
    reading: {
      periods: buildReadingPeriods(featureVector, observation),
      claims,
      primaryEvidenceIds: primary ? primaryMetrics(primary).map((entry) => entry.id) : [],
      expandedSurfaceItemIds: expanded.map((item) => item.surfaceItemId),
      policySurfaceItemIds: claims.filter((item) => item.role === 'policy').map((item) => item.surfaceItemId),
      unclassifiedReason: primary ? null : observation.status !== 'activity' ? observation.status
        : candidates.length ? candidates.some((item) => item.metrics.some((entry) => entry.status === 'observed'))
          ? 'claim_measurement_not_established' : 'claim_metrics_unavailable' : 'no_admitted_behavior_claim',
    },
    // The existing scalar blends policy with behavior. Keep it diagnosable,
    // but never publish it as a calibrated probability or pure behavior risk.
    score: {
      status: observation.status === 'missing' ? 'unavailable' : 'diagnostic_only',
      meaning: 'behavior_and_plan_friction',
      mode: hasInterventionFacts ? 'intervention_aware' : 'baseline',
    },
  };
}

export function requireSitePullInterpretation(profile) {
  const result = profile?.interpretation;
  if (result?.version !== SITE_PULL_INTERPRETATION_VERSION
    || !['missing', 'observed_zero', 'activity'].includes(result.observation?.status)
    || !['pattern', 'state'].includes(result.headline?.kind)
    || !Array.isArray(result.evidenceSurfaceItemIds)
    || !['unavailable', 'diagnostic_only'].includes(result.score?.status)) {
    throw new Error('SITE_PULL_INTERPRETATION_INVALID');
  }
  if (result.headline.kind === 'pattern'
    && !profile.feedbackSurfaces?.detail?.some((item) => (
      item.surfaceItemId === result.headline.surfaceItemId
      && item.patternId === result.headline.patternId && item.claimVisibility === 'primary_claim'
    ))) {
    throw new Error('SITE_PULL_HEADLINE_EVIDENCE_INVALID');
  }
  if (result.headline.kind === 'state'
    && !['collecting', 'observed_zero', 'unclassified'].includes(result.headline.state)) {
    throw new Error('SITE_PULL_HEADLINE_STATE_INVALID');
  }
  if (result.evidenceSurfaceItemIds.some((id) => !profile.feedbackSurfaces?.detail?.some((item) => item.surfaceItemId === id))) {
    throw new Error('SITE_PULL_INTERPRETATION_EVIDENCE_INVALID');
  }
  const reading = result.reading;
  if (!reading || !Array.isArray(reading.claims) || !reading.periods
    || !Array.isArray(reading.primaryEvidenceIds) || reading.primaryEvidenceIds.length > 2
    || !Array.isArray(reading.expandedSurfaceItemIds) || reading.expandedSurfaceItemIds.length > 3
    || !Array.isArray(reading.policySurfaceItemIds)
    || reading.claims.length !== profile.feedbackSurfaces.detail.length) throw new Error('SITE_PULL_READING_INVALID');
  requireReadingPeriods(reading.periods, result.observation);
  const seenClaims = new Set();
  const metrics = new Map();
  for (const claim of reading.claims) {
    const item = profile.feedbackSurfaces.detail.find((entry) => entry.surfaceItemId === claim.surfaceItemId);
    if (!item || seenClaims.has(claim.surfaceItemId) || claim.patternId !== item.patternId
      || claim.role !== claimRole(item) || !Array.isArray(claim.metrics)
      || !Array.isArray(claim.limitationKeys) || typeof claim.headlineKey !== 'string') {
      throw new Error('SITE_PULL_READING_CLAIM_INVALID');
    }
    const expected = buildSitePullEvidenceReadout(item);
    if (claim.headlineKey !== expected.headlineKey || claim.explanationKey !== expected.explanationKey
      || claim.metrics.length !== expected.metrics.length
      || claim.metrics.some((metric, index) => !sameMetric(metric, expected.metrics[index]))
      || !sameList(claim.limitationKeys, expected.limitationKeys)
      || !sameList(claim.caveats, expected.caveats)) {
      throw new Error('SITE_PULL_READING_PROVENANCE_INVALID');
    }
    const expectedQuality = item.decisionQuality ? { status: item.decisionQuality.status,
      nearBoundary: item.decisionQuality.nearBoundary, meaning: 'heuristic_evidence_quality' } : null;
    if (expectedQuality === null ? claim.quality !== null
      : !claim.quality || ['status', 'nearBoundary', 'meaning'].some((key) => claim.quality[key] !== expectedQuality[key])) {
      throw new Error('SITE_PULL_READING_QUALITY_INVALID');
    }
    seenClaims.add(claim.surfaceItemId);
    for (const metric of claim.metrics) {
      const raw = item.evidence[metric.field];
      if (metrics.has(metric.id) || !reading.periods[metric.period]
        || !['duration_ms', 'count', 'days'].includes(metric.unit)
        || !['observed', 'unavailable'].includes(metric.status)
        || (metric.status === 'observed' ? typeof metric.value !== 'number'
          || !Number.isFinite(metric.value) || metric.value < 0 || metric.value !== raw
          : metric.value !== null || (raw !== null && raw !== undefined))) {
        throw new Error('SITE_PULL_READING_EVIDENCE_INVALID');
      }
      metrics.set(metric.id, { ...metric, surfaceItemId: claim.surfaceItemId });
    }
  }
  const primary = reading.claims.find((item) => item.surfaceItemId === result.headline.surfaceItemId);
  const expectedState = result.observation.status === 'observed_zero' ? 'observed_zero'
    : result.observation.status === 'missing' ? 'collecting' : 'unclassified';
  if ((result.headline.kind === 'pattern' && (!primary || primary.role !== 'behavior'
    || result.headline.messageKey !== primary.headlineKey || reading.primaryEvidenceIds.length === 0
    || !sameList(reading.primaryEvidenceIds, primaryMetrics(primary).map((metric) => metric.id))))
    || (result.headline.kind === 'state' && (reading.primaryEvidenceIds.length !== 0
      || result.headline.state !== expectedState
      || result.headline.messageKey !== `target_profile.reading_state_${expectedState === 'observed_zero' ? 'zero' : expectedState}`))
    || (primary && (result.observation.status !== 'activity' || reading.expandedSurfaceItemIds[0] !== primary.surfaceItemId))
    || new Set(reading.primaryEvidenceIds).size !== reading.primaryEvidenceIds.length
    || reading.primaryEvidenceIds.some((id) => metrics.get(id)?.status !== 'observed'
      || metrics.get(id)?.surfaceItemId !== primary?.surfaceItemId)
    || reading.expandedSurfaceItemIds.some((id) => !reading.claims.some((item) => item.surfaceItemId === id
      && ['behavior', 'supporting'].includes(item.role)))
    || new Set(reading.expandedSurfaceItemIds).size !== reading.expandedSurfaceItemIds.length
    || reading.policySurfaceItemIds.some((id) => !reading.claims.some((item) => item.surfaceItemId === id && item.role === 'policy'))) {
    throw new Error('SITE_PULL_READING_SELECTION_INVALID');
  }
  return result;
}
