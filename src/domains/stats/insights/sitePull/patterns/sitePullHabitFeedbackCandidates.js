import {
  SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY,
  SITE_PULL_AGGREGATE_FEEDBACK_SURFACES,
  SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY,
  buildSitePullAggregateFeedbackItems,
  requireSitePullAggregateFeedbackSurface,
} from './sitePullAggregateFeedback.js';
import {
  SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY,
  SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY,
} from './sitePullFeedbackSurfacePresenter.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_SCOPES,
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
} from './sitePullPatternFeedbackSpec.js';

export const SITE_PULL_HABIT_FEEDBACK_CANDIDATE_VERSION =
  'site-pull-habit-feedback-candidates-v1';

export const SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SOURCES = Object.freeze({
  DOMAIN_RECAP: 'domain_recap',
  AGGREGATE_RECAP: 'aggregate_recap',
});

export const SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SCOPES = Object.freeze({
  DOMAIN: 'domain',
  PROTECTED_SET: 'protected_set',
  GLOBAL: 'global',
  TEMPORAL_RECAP: 'temporal_recap',
});

const { DOMAIN_RECAP, AGGREGATE_RECAP } = SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SOURCES;
const { DOMAIN, PROTECTED_SET, GLOBAL } = SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SCOPES;
const USER_VISIBLE_SOURCE_SURFACES = new Set([
  SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP,
  SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.SITES_OVERVIEW,
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toConfidence(value) {
  return Math.max(0, Math.min(1, toNumber(value)));
}

function toScore(value) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value))));
}

function compactObject(value) {
  return isPlainObject(value) ? { ...value } : {};
}

function compactDomain(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function createHabitFeedbackCandidateError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function sourceSurface(surface) {
  const resolvedSurface = requireSitePullAggregateFeedbackSurface(surface);
  if (!USER_VISIBLE_SOURCE_SURFACES.has(resolvedSurface)) {
    throw createHabitFeedbackCandidateError('SITE_PULL_HABIT_FEEDBACK_SOURCE_SURFACE_NOT_VISIBLE', {
      surface: resolvedSurface,
    });
  }
  return resolvedSurface;
}

function normalizeDomainProfileRows(domainProfiles = []) {
  if (Array.isArray(domainProfiles)) {
    return domainProfiles
      .map((entry) => {
        const profile = entry;
        const domain = compactDomain(entry?.domain || profile?.domain);
        return domain && profile ? { domain, profile } : null;
      })
      .filter(Boolean);
  }

  if (!isPlainObject(domainProfiles)) return [];

  return Object.entries(domainProfiles)
    .map(([domainKey, value]) => {
      const profile = value;
      const domain = compactDomain(value?.domain || profile?.domain || domainKey);
      return domain && profile ? { domain, profile } : null;
    })
    .filter(Boolean);
}

function surfaceItems(profile = {}, surface = SITE_PULL_PATTERN_FEEDBACK_SURFACES.RECAP) {
  return asArray(profile?.feedbackSurfaces?.[surface]);
}

function statusWeight(status) {
  if (status === 'strong') return 12;
  if (status === 'elevated') return 7;
  return 0;
}

function roleWeight(role) {
  if (role === 'user_feedback') return 6;
  if (role === 'positive_reinforcement') return 4;
  if (role === 'recap_context') return 4;
  if (role === 'supporting_evidence') return 2;
  return 0;
}

function rankPenalty(rank) {
  const numeric = Number(rank);
  return Number.isFinite(numeric) ? numeric * 0.02 : 0;
}

function candidatePriority({
  score,
  confidence,
  source,
  role,
  status,
  rank,
} = {}) {
  const sourceBoost = source === AGGREGATE_RECAP ? 4 : 0;
  const priority = toScore(score)
    + (toConfidence(confidence) * 12)
    + sourceBoost
    + roleWeight(role)
    + statusWeight(status)
    - rankPenalty(rank);
  return Math.round(Math.max(0, priority) * 100) / 100;
}

function aggregateScope(item = {}) {
  if (item.feedbackScope) return item.feedbackScope;
  if (item.patternId === 'protected_checking_pressure') return PROTECTED_SET;
  return GLOBAL;
}

function aggregateEntityId(scope) {
  if (scope === PROTECTED_SET) return 'protected_set';
  if (scope === SITE_PULL_PATTERN_FEEDBACK_SCOPES.TEMPORAL_RECAP) return 'temporal_recap';
  return 'global';
}

function aggregateClaimVisibility(surface) {
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.SITES_OVERVIEW) {
    return SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.PRIMARY;
  }
  if (surface === SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP) {
    return SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.RECAP_CONTEXT;
  }
  return null;
}

function requireCandidateSourceItem(item = {}, {
  expectedSurface,
  expectedVisibility,
  expectedSurfaceVisibility,
  expectedClaimVisibilities = [],
  source,
} = {}) {
  if (item.surface !== expectedSurface) {
    throw createHabitFeedbackCandidateError(
      source === AGGREGATE_RECAP
        ? 'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_SURFACE_MISMATCH'
        : 'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_SURFACE_MISMATCH',
      {
        expectedSurface,
        itemSurface: item.surface || null,
      },
    );
  }
  if (item.visibility !== expectedVisibility) {
    throw createHabitFeedbackCandidateError(
      source === AGGREGATE_RECAP
        ? 'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_VISIBILITY_INVALID'
        : 'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_VISIBILITY_INVALID',
      {
        expectedVisibility,
        itemVisibility: item.visibility || null,
      },
    );
  }
  if (item.surfaceVisibility !== expectedSurfaceVisibility) {
    throw createHabitFeedbackCandidateError(
      source === AGGREGATE_RECAP
        ? 'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_SURFACE_VISIBILITY_INVALID'
        : 'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_SURFACE_VISIBILITY_INVALID',
      {
        expectedSurfaceVisibility,
        itemSurfaceVisibility: item.surfaceVisibility || null,
      },
    );
  }
  if (
    expectedClaimVisibilities.length > 0
    && !expectedClaimVisibilities.includes(item.claimVisibility)
  ) {
    throw createHabitFeedbackCandidateError(
      source === AGGREGATE_RECAP
        ? 'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_CLAIM_VISIBILITY_INVALID'
        : 'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_CLAIM_VISIBILITY_INVALID',
      {
        expectedClaimVisibilities,
        itemClaimVisibility: item.claimVisibility || null,
      },
    );
  }
}

function buildDomainCandidate(item = {}, {
  domain,
  surface,
} = {}) {
  const patternId = item.patternId || item.id || '';
  if (!patternId || !domain) return null;
  requireCandidateSourceItem(item, {
    expectedSurface: surface,
    expectedVisibility: SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.VISIBLE,
    expectedSurfaceVisibility: SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.VISIBLE,
    expectedClaimVisibilities: [
      SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.PRIMARY,
      SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.SUPPORTING,
    ],
    source: DOMAIN_RECAP,
  });

  const score = toScore(item.score);
  const confidence = toConfidence(item.confidence);
  const source = DOMAIN_RECAP;
  const priority = candidatePriority({
    score,
    confidence,
    source,
    role: item.role,
    status: item.status,
    rank: item.rank,
  });

  return {
    id: `${source}:${domain}:${patternId}`,
    version: SITE_PULL_HABIT_FEEDBACK_CANDIDATE_VERSION,
    source,
    sourceSurface: surface,
    scope: DOMAIN,
    feedbackScope: item.feedbackScope || DOMAIN,
    entityId: domain,
    entityLabel: domain,
    patternId,
    surfaceItemId: item.surfaceItemId || null,
    role: item.role || null,
    recommendationFamily: item.recommendationFamily || null,
    priority,
    rank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : null,
    score,
    confidence,
    tone: item.tone || null,
    status: item.status || null,
    visibility: item.visibility,
    surfaceVisibility: item.surfaceVisibility,
    claimVisibility: item.claimVisibility,
    evidenceSummary: compactObject(item.evidenceSummary || item.evidence),
    recommendedAction: item.recommendedAction || null,
    display: {
      kind: 'target_behavior_pattern',
      patternId,
      surfaceItemId: item.surfaceItemId || null,
    },
  };
}

function buildAggregateCandidate(item = {}, {
  surface,
} = {}) {
  const patternId = item.patternId || item.id || '';
  if (!patternId) return null;
  requireCandidateSourceItem(item, {
    expectedSurface: surface,
    expectedVisibility: SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.VISIBLE,
    expectedSurfaceVisibility: SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.VISIBLE,
    expectedClaimVisibilities: [aggregateClaimVisibility(surface)].filter(Boolean),
    source: AGGREGATE_RECAP,
  });

  const scope = aggregateScope(item);
  const score = toScore(item.score);
  const confidence = toConfidence(item.confidence);
  const source = AGGREGATE_RECAP;
  const priority = candidatePriority({
    score,
    confidence,
    source,
    role: item.role,
    status: item.status,
    rank: item.rank,
  });

  return {
    id: `${source}:${aggregateEntityId(scope)}:${patternId}`,
    version: SITE_PULL_HABIT_FEEDBACK_CANDIDATE_VERSION,
    source,
    sourceSurface: surface,
    scope,
    feedbackScope: scope,
    entityId: aggregateEntityId(scope),
    entityLabel: aggregateEntityId(scope),
    patternId,
    role: item.role || null,
    recommendationFamily: item.recommendationFamily || null,
    priority,
    rank: null,
    score,
    confidence,
    tone: item.severity || null,
    status: item.status || null,
    visibility: item.visibility,
    surfaceVisibility: item.surfaceVisibility,
    claimVisibility: item.claimVisibility,
    evidenceSummary: compactObject(item.evidenceSummary),
    recommendedAction: item.recommendedAction || null,
    display: {
      kind: 'aggregate_feedback_keys',
      titleKey: item.titleKey || null,
      titleParams: compactObject(item.titleParams),
      bodyKey: item.bodyKey || null,
      bodyParams: compactObject(item.bodyParams),
      topDomainsKey: item.topDomainsKey || null,
      topDomainsParams: compactObject(item.topDomainsParams),
      evidenceChips: asArray(item.evidenceChips).map((chip) => ({
        id: chip.id,
        labelKey: chip.labelKey,
        labelParams: compactObject(chip.labelParams),
      })),
    },
  };
}

function dedupeCandidates(candidates = []) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.id || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}

function sortCandidates(candidates = []) {
  return [...candidates].sort((left, right) => (
    right.priority - left.priority
    || right.score - left.score
    || right.confidence - left.confidence
    || left.id.localeCompare(right.id)
  ));
}

function increment(target, key) {
  if (!key) return;
  target[key] = (target[key] || 0) + 1;
}

function summarizeCandidates(candidates = []) {
  return candidates.reduce((summary, candidate) => {
    summary.total += 1;
    increment(summary.bySource, candidate.source);
    increment(summary.byScope, candidate.scope);
    increment(summary.byRecommendationFamily, candidate.recommendationFamily);
    return summary;
  }, {
    total: 0,
    bySource: {},
    byScope: {},
    byRecommendationFamily: {},
  });
}

export function buildSitePullHabitFeedbackCandidateModel({
  domainProfiles = [],
  aggregateAnalysis = null,
  aggregateFeedbackItems = null,
  surface = SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP,
  limit = 12,
  includeDomainCandidates = true,
  includeAggregateCandidates = true,
} = {}) {
  const resolvedSurface = sourceSurface(surface);
  const boundedLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (boundedLimit === 0) {
    return {
      version: SITE_PULL_HABIT_FEEDBACK_CANDIDATE_VERSION,
      sourceSurface: resolvedSurface,
      candidates: [],
      summary: summarizeCandidates([]),
    };
  }

  const domainCandidates = includeDomainCandidates && resolvedSurface === SITE_PULL_PATTERN_FEEDBACK_SURFACES.RECAP
    ? normalizeDomainProfileRows(domainProfiles)
      .flatMap(({ domain, profile }) => surfaceItems(profile, SITE_PULL_PATTERN_FEEDBACK_SURFACES.RECAP)
        .map((item) => buildDomainCandidate(item, {
          domain,
          surface: resolvedSurface,
        })))
      .filter(Boolean)
    : [];
  const aggregateItems = Array.isArray(aggregateFeedbackItems)
    ? aggregateFeedbackItems
    : buildSitePullAggregateFeedbackItems(aggregateAnalysis, {
      surface: resolvedSurface,
      limit: boundedLimit,
    });
  const aggregateCandidates = includeAggregateCandidates
    ? aggregateItems.map((item) => buildAggregateCandidate(item, {
      surface: resolvedSurface,
    })).filter(Boolean)
    : [];
  const candidates = sortCandidates(dedupeCandidates([
    ...aggregateCandidates,
    ...domainCandidates,
  ])).slice(0, boundedLimit);

  return {
    version: SITE_PULL_HABIT_FEEDBACK_CANDIDATE_VERSION,
    sourceSurface: resolvedSurface,
    candidates,
    summary: summarizeCandidates(candidates),
  };
}

export function buildSitePullHabitFeedbackCandidates(options = {}) {
  return buildSitePullHabitFeedbackCandidateModel(options).candidates;
}
