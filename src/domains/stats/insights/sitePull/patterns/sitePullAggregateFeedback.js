import { SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES } from './sitePullAggregateAnalysis.js';

export const SITE_PULL_AGGREGATE_FEEDBACK_VERSION = 'site-pull-aggregate-feedback-v1';

export const SITE_PULL_AGGREGATE_FEEDBACK_SURFACES = Object.freeze({
  SITES_OVERVIEW: 'sites_overview',
  RECAP: 'recap',
  DIAGNOSTIC: 'diagnostic',
});

export const SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY = Object.freeze({
  VISIBLE: 'visible',
  DIAGNOSTIC: 'diagnostic',
  HIDDEN: 'hidden',
});

export const SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY = Object.freeze({
  PRIMARY: 'primary_claim',
  RECAP_CONTEXT: 'recap_context',
  DIAGNOSTIC: 'diagnostic_only',
});

export const SITE_PULL_AGGREGATE_FEEDBACK_ROLES = Object.freeze({
  USER_FEEDBACK: 'user_feedback',
  RECAP_CONTEXT: 'recap_context',
  DIAGNOSTIC: 'diagnostic',
});

const USER_VISIBLE_STATUSES = new Set([
  SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.ELEVATED,
  SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.STRONG,
]);

const PROTECTED_CHECKING_PATTERN_ID = 'protected_checking_pressure';

export const SITE_PULL_AGGREGATE_FEEDBACK_PATTERN_IDS = Object.freeze([
  PROTECTED_CHECKING_PATTERN_ID,
]);

const KNOWN_AGGREGATE_FEEDBACK_SURFACES = new Set(
  Object.values(SITE_PULL_AGGREGATE_FEEDBACK_SURFACES),
);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function requireSitePullAggregateFeedbackSurface(surface) {
  if (!KNOWN_AGGREGATE_FEEDBACK_SURFACES.has(surface)) {
    const error = new Error('SITE_PULL_AGGREGATE_FEEDBACK_SURFACE_INVALID');
    error.code = 'SITE_PULL_AGGREGATE_FEEDBACK_SURFACE_INVALID';
    throw error;
  }
  return surface;
}

function toCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function toScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function toConfidence(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function supportsSurface(pattern = {}, surface) {
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC) return true;
  return asArray(pattern.outputSurfaces).includes(surface);
}

function resolveVisibility(pattern = {}, surface) {
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC) {
    return SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.DIAGNOSTIC;
  }
  if (!supportsSurface(pattern, surface)) {
    return SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.HIDDEN;
  }
  return USER_VISIBLE_STATUSES.has(pattern.status)
    ? SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.VISIBLE
    : SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.HIDDEN;
}

function resolveRole(surface) {
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP) {
    return SITE_PULL_AGGREGATE_FEEDBACK_ROLES.RECAP_CONTEXT;
  }
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC) {
    return SITE_PULL_AGGREGATE_FEEDBACK_ROLES.DIAGNOSTIC;
  }
  return SITE_PULL_AGGREGATE_FEEDBACK_ROLES.USER_FEEDBACK;
}

function resolveClaimVisibility(surface) {
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP) {
    return SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.RECAP_CONTEXT;
  }
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC) {
    return SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.DIAGNOSTIC;
  }
  return SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.PRIMARY;
}

function compactTopDomains(topDomains = []) {
  return asArray(topDomains)
    .map((row) => {
      const domain = typeof row?.domain === 'string' ? row.domain.trim().toLowerCase() : '';
      if (!domain) return null;
      return {
        domain,
        todayVisits: toCount(row.todayVisits),
        quickReturnEvents: Math.max(toCount(row.revisitWithin10m), toCount(row.switchBackWithin10m)),
        switchChurn: toCount(row.switchChurn),
        checkingScore: Number(row.checkingScore) || 0,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function buildProtectedCheckingFeedback(pattern = {}, { surface }) {
  const evidence = pattern.evidence || {};
  const analyzedDomainCount = toCount(evidence.analyzedDomainCount);
  const todayVisits = toCount(evidence.todayVisits);
  const quickReturnEvents = toCount(evidence.quickReturnEvents);
  const switchChurn = toCount(evidence.switchChurn);
  const visitHourCount = toCount(evidence.visitHourCount);
  const topDomains = compactTopDomains(evidence.topDomains);
  const isStrong = pattern.status === SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.STRONG;
  const surfaceVisibility = resolveVisibility(pattern, surface);

  return {
    id: `${pattern.id}:${surface}`,
    patternId: pattern.id,
    version: SITE_PULL_AGGREGATE_FEEDBACK_VERSION,
    surface,
    role: resolveRole(surface),
    visibility: surfaceVisibility,
    surfaceVisibility,
    claimVisibility: resolveClaimVisibility(surface),
    status: pattern.status || SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.OBSERVED,
    severity: isStrong ? 'high' : 'watch',
    score: toScore(pattern.score),
    confidence: toConfidence(pattern.confidence),
    recommendationFamily: pattern.recommendationFamily || 'checking_cooldown',
    titleKey: 'aggregate_feedback.protected_checking_pressure.title',
    titleParams: {},
    bodyKey: isStrong
      ? 'aggregate_feedback.protected_checking_pressure.body_strong'
      : 'aggregate_feedback.protected_checking_pressure.body_elevated',
    bodyParams: {
      domains: analyzedDomainCount,
      visits: todayVisits,
      hours: visitHourCount,
      returns: quickReturnEvents,
      switches: switchChurn,
    },
    topDomains,
    topDomainsKey: topDomains.length > 0
      ? 'aggregate_feedback.protected_checking_pressure.top_domains'
      : null,
    topDomainsParams: topDomains.length > 0
      ? { domains: topDomains.map((row) => row.domain).join(', ') }
      : {},
    evidenceChips: [
      { id: 'domains', labelKey: 'aggregate_feedback.metric_domains', labelParams: { count: analyzedDomainCount } },
      { id: 'visits', labelKey: 'aggregate_feedback.metric_visits', labelParams: { count: todayVisits } },
      { id: 'hours', labelKey: 'aggregate_feedback.metric_hours', labelParams: { count: visitHourCount } },
      { id: 'returns', labelKey: 'aggregate_feedback.metric_returns', labelParams: { count: quickReturnEvents } },
      { id: 'switches', labelKey: 'aggregate_feedback.metric_switches', labelParams: { count: switchChurn } },
    ].filter((chip) => toCount(chip.labelParams.count) > 0),
    evidenceSummary: {
      protectedDomainCount: toCount(evidence.protectedDomainCount),
      analyzedDomainCount,
      behaviorDomainCount: toCount(evidence.behaviorDomainCount),
      todayVisits,
      quickReturnEvents,
      switchChurn,
      visitHourCount,
      topDomains,
    },
    caveats: asArray(pattern.caveats),
  };
}

function buildAggregateFeedbackItem(pattern = {}, { surface }) {
  if (pattern?.id === PROTECTED_CHECKING_PATTERN_ID) {
    return buildProtectedCheckingFeedback(pattern, { surface });
  }
  return null;
}

export function buildSitePullAggregateFeedbackItems(analysis = null, {
  surface = SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.SITES_OVERVIEW,
  limit = 3,
  includeHidden = false,
} = {}) {
  const resolvedSurface = requireSitePullAggregateFeedbackSurface(surface);
  const boundedLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!analysis || analysis.enabled !== true || boundedLimit === 0) return [];

  return asArray(analysis.patterns)
    .map((pattern) => buildAggregateFeedbackItem(pattern, { surface: resolvedSurface }))
    .filter((item) => item && (includeHidden || item.visibility !== SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.HIDDEN))
    .sort((left, right) => (
      right.score - left.score
      || right.confidence - left.confidence
      || left.patternId.localeCompare(right.patternId)
    ))
    .slice(0, boundedLimit);
}
