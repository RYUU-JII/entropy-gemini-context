import { rankSitePullPatternsForPresentation } from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_ROLES,
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
  SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
} from './sitePullPatternFeedbackSpec.js';
import {
  SITE_PULL_FEEDBACK_CONSUMER_IDS,
  SITE_PULL_FEEDBACK_SURFACE_INVENTORY_KINDS,
  SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION,
  listSitePullFeedbackSurfaceInventoryRows,
} from './sitePullFeedbackSurfaceInventory.js';
import { presentSitePullPatterns } from './sitePullPatternPresenter.js';

export const SITE_PULL_FEEDBACK_SURFACE_PRESENTER_VERSION =
  'site-pull-feedback-surface-presenter-v1';

export const SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY = Object.freeze({
  VISIBLE: 'visible',
  DIAGNOSTIC: 'diagnostic',
});

export const SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY = Object.freeze({
  PRIMARY: 'primary_claim',
  SUPPORTING: 'supporting_evidence',
  DIAGNOSTIC: 'diagnostic_only',
});

const { BADGE, DETAIL, RECAP, DIAGNOSTIC } = SITE_PULL_PATTERN_FEEDBACK_SURFACES;
const { SUPPORTING_EVIDENCE } = SITE_PULL_PATTERN_FEEDBACK_ROLES;
const { DOMAIN_PATTERN } = SITE_PULL_FEEDBACK_SURFACE_INVENTORY_KINDS;

const DEFAULT_SURFACE_LIMITS = Object.freeze({
  [BADGE]: 6,
  [DETAIL]: 12,
  [RECAP]: 12,
  [DIAGNOSTIC]: 48,
});

const DOMAIN_CONSUMER_BY_SURFACE = Object.freeze({
  [BADGE]: SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_BADGE,
  [DETAIL]: SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_DETAIL,
  [RECAP]: SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_RECAP,
  [DIAGNOSTIC]: SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_DIAGNOSTIC,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function requireKnownSurface(surface) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SURFACE_LIMITS, surface)) {
    const error = new Error('SITE_PULL_FEEDBACK_SURFACE_INVALID');
    error.code = 'SITE_PULL_FEEDBACK_SURFACE_INVALID';
    throw error;
  }
  return surface;
}

function toBoundedLimit(surface, limit) {
  const defaultLimit = DEFAULT_SURFACE_LIMITS[surface];
  const resolved = limit === undefined ? defaultLimit : Number(limit);
  return Math.max(0, Math.floor(Number.isFinite(resolved) ? resolved : defaultLimit));
}

function resolvePatternInput(patternInput, surface) {
  if (Array.isArray(patternInput)) return patternInput;
  if (Array.isArray(patternInput?.patterns)) return patternInput.patterns;
  if (surface === BADGE && Array.isArray(patternInput?.presentationPatterns)) {
    return patternInput.presentationPatterns;
  }
  return [];
}

let domainInventoryRowMap = null;

function buildDomainInventoryRowMap() {
  if (domainInventoryRowMap) return domainInventoryRowMap;
  domainInventoryRowMap = new Map(
    listSitePullFeedbackSurfaceInventoryRows({ includeAggregatePatterns: false })
      .filter((row) => row.kind === DOMAIN_PATTERN)
      .map((row) => [row.id, row]),
  );
  return domainInventoryRowMap;
}

function supportsSurface(row, surface) {
  return asArray(row?.surfaces).includes(surface);
}

function surfaceConsumerId(surface) {
  return DOMAIN_CONSUMER_BY_SURFACE[surface] || null;
}

function itemVisibility(surface) {
  return surface === DIAGNOSTIC
    ? SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.DIAGNOSTIC
    : SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.VISIBLE;
}

function claimVisibility(row, surface) {
  if (surface === DIAGNOSTIC) {
    return SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.DIAGNOSTIC;
  }
  if (row?.role === SUPPORTING_EVIDENCE) {
    return SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.SUPPORTING;
  }
  return SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.PRIMARY;
}

function dedupeByPatternId(patterns = []) {
  const seen = new Set();
  return patterns.filter((pattern) => {
    if (!pattern?.id || seen.has(pattern.id)) return false;
    seen.add(pattern.id);
    return true;
  });
}

function rankPatternsForSurface(patternInput, surface) {
  const patterns = resolvePatternInput(patternInput, surface);
  if (surface === BADGE) {
    return presentSitePullPatterns(patterns, { surface }).presentationPatterns;
  }
  return rankSitePullPatternsForPresentation(patterns);
}

function buildSurfaceItem(pattern, row, { surface }) {
  const consumerId = surfaceConsumerId(surface);
  const surfaceVisibility = itemVisibility(surface);
  return {
    id: pattern.id,
    surfaceItemId: `${pattern.id}:${surface}`,
    version: SITE_PULL_FEEDBACK_SURFACE_PRESENTER_VERSION,
    inventoryVersion: SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION,
    feedbackSurfacePolicyVersion: SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
    patternId: pattern.id,
    kind: row.kind,
    surface,
    visibility: surfaceVisibility,
    surfaceVisibility,
    claimVisibility: claimVisibility(row, surface),
    consumerId,
    consumerIds: consumerId ? [consumerId] : [],
    role: row.role,
    feedbackScope: row.feedbackScope,
    recommendationFamily: row.recommendationFamily,
    aggregationHint: row.aggregationHint,
    userValue: row.userValue,
    decisionRequired: row.decisionRequired === true,
    slot: row.slot,
    group: row.group,
    rank: row.rank,
    level: pattern.level || row.level,
    polarity: pattern.polarity || row.polarity,
    category: pattern.category || null,
    severity: pattern.severity || null,
    tone: pattern.tone || null,
    score: Number(pattern.score) || 0,
    confidence: Number(pattern.confidence) || 0,
    source: pattern.source || null,
    componentIds: asArray(pattern.componentIds),
    supportingPatternIds: asArray(pattern.supportingPatternIds),
    suppresses: asArray(pattern.suppresses),
    evidence: pattern.evidence || {},
    recommendedAction: pattern.recommendedAction || null,
    calibration: pattern.calibration || null,
    decisionQuality: pattern.calibration?.decisionQuality || null,
    ...(Array.isArray(pattern.sourceList) ? { sourceList: pattern.sourceList } : {}),
    ...(Number.isFinite(Number(pattern.mergedSignalCount))
      ? { mergedSignalCount: Math.max(1, Math.floor(Number(pattern.mergedSignalCount))) }
      : {}),
  };
}

export function buildSitePullDomainFeedbackItems(patternInput = [], {
  surface = BADGE,
  limit,
} = {}) {
  const resolvedSurface = requireKnownSurface(surface);
  const boundedLimit = toBoundedLimit(resolvedSurface, limit);
  if (boundedLimit === 0) return [];

  const rowMap = buildDomainInventoryRowMap();
  return buildFeedbackItemsFromRankedPatterns(
    rankPatternsForSurface(patternInput, resolvedSurface),
    rowMap,
    { surface: resolvedSurface, limit: boundedLimit },
  );
}

function buildFeedbackItemsFromRankedPatterns(patterns, rowMap, { surface, limit }) {
  return dedupeByPatternId(patterns)
    .map((pattern) => {
      const row = rowMap.get(pattern.id);
      return row && supportsSurface(row, surface)
        ? buildSurfaceItem(pattern, row, { surface })
        : null;
    })
    .filter(Boolean)
    .slice(0, limit);
}

export function buildSitePullDomainFeedbackSurfaceModel(patternInput = [], {
  limits = {},
} = {}) {
  const patterns = resolvePatternInput(patternInput, DETAIL);
  const rankedPatterns = rankSitePullPatternsForPresentation(patterns);
  const badgePatterns = presentSitePullPatterns(patterns, { surface: BADGE }).presentationPatterns;
  const rowMap = buildDomainInventoryRowMap();
  const buildSurface = (surface, sourcePatterns) => buildFeedbackItemsFromRankedPatterns(
    sourcePatterns,
    rowMap,
    {
      surface,
      limit: toBoundedLimit(surface, limits?.[surface]),
    },
  );

  return {
    badge: buildSurface(BADGE, badgePatterns),
    detail: buildSurface(DETAIL, rankedPatterns),
    recap: buildSurface(RECAP, rankedPatterns),
    diagnostic: buildSurface(DIAGNOSTIC, rankedPatterns),
  };
}

export function buildSitePullDomainBadgeFeedbackItems(patternInput = [], options = {}) {
  return buildSitePullDomainFeedbackItems(patternInput, {
    ...options,
    surface: BADGE,
  });
}

export function buildSitePullDomainDetailFeedbackItems(patternInput = [], options = {}) {
  return buildSitePullDomainFeedbackItems(patternInput, {
    ...options,
    surface: DETAIL,
  });
}

export function buildSitePullDomainRecapFeedbackCandidates(patternInput = [], options = {}) {
  return buildSitePullDomainFeedbackItems(patternInput, {
    ...options,
    surface: RECAP,
  });
}

export function buildSitePullDomainDiagnosticFeedbackRows(patternInput = [], options = {}) {
  return buildSitePullDomainFeedbackItems(patternInput, {
    ...options,
    surface: DIAGNOSTIC,
  });
}
