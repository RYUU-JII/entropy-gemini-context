import { SITE_PULL_PATTERN_LEVELS } from './sitePullPatternContracts.js';
import { rankSitePullPatternsForPresentation } from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
  SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
  resolveSitePullPatternFeedbackSurfacePolicy,
} from './sitePullPatternFeedbackSpec.js';
import { SITE_PULL_IMMERSION_STATUSES } from './sitePullImmersionEvidenceProfile.js';

export const SITE_PULL_PATTERN_PRESENTER_VERSION = 'site-pull-pattern-presenter-release-v1';

const EXCLUSIVE_STATE_IDS = new Set(['no_activity']);
const FOCUSED_BLOCK_ID = 'focused_block';
const PERSONAL_SPIKE_ID = 'personal_spike';
const TIME_HEAVY_ID = 'time_heavy_today';

export const SITE_PULL_PATTERN_PRESENTATION_GROUP_LIMITS = Object.freeze({
  data: 1,
  plan: 1,
  time: 1,
  immersion: 2,
  focus: 1,
  checking: 2,
  route: 1,
  navigation: 2,
  tab_context: 2,
  content_flow: 1,
  habit: 1,
  trend: 1,
  circadian: 1,
  intervention: 1,
  steady: 1,
});

export const SITE_PULL_PATTERN_PRESENTATION_SURFACE_LIMITS = Object.freeze({
  [SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE]: 4,
});

function patternGroup(pattern) {
  return pattern?.presentation?.group || pattern?.category || 'general';
}

function patternSlot(pattern) {
  return pattern?.presentation?.slot || 'badge';
}

function indexPatterns(patterns) {
  const index = new Map();
  patterns.forEach((pattern) => {
    if (pattern?.id && !index.has(pattern.id)) {
      index.set(pattern.id, pattern);
    }
  });
  return index;
}

function recordSuppression(suppressions, pattern, { suppressedBy, reason }) {
  if (!pattern?.id || suppressions.has(pattern.id)) return;
  suppressions.set(pattern.id, {
    id: pattern.id,
    suppressedBy,
    reason,
    group: patternGroup(pattern),
    level: pattern.level || SITE_PULL_PATTERN_LEVELS.ATOMIC,
  });
}

function sharesEvidenceWindow(left, right) {
  const a = left.evidence?.evidenceWindow;
  const b = right.evidence?.evidenceWindow;
  return a === b;
}

function attachSupportingPatternIds(pattern, patternIndex) {
  if (pattern?.level !== SITE_PULL_PATTERN_LEVELS.COMPOSITE) return pattern;
  const supportingPatternIds = (Array.isArray(pattern.componentIds) ? pattern.componentIds : [])
    .filter((id) => id !== pattern.id && patternIndex.has(id) && sharesEvidenceWindow(pattern, patternIndex.get(id)));
  if (supportingPatternIds.length === 0) return pattern;
  return {
    ...pattern,
    supportingPatternIds,
  };
}

function applyStateExclusivity(rankedPatterns, suppressions) {
  const exclusiveState = rankedPatterns.find((pattern) => EXCLUSIVE_STATE_IDS.has(pattern.id));
  if (!exclusiveState) return;
  rankedPatterns.forEach((pattern) => {
    if (pattern.id !== exclusiveState.id) {
      recordSuppression(suppressions, pattern, {
        suppressedBy: exclusiveState.id,
        reason: 'state_exclusive',
      });
    }
  });
}

function applyShadowVisibilitySuppression(rankedPatterns, suppressions) {
  rankedPatterns.forEach((pattern) => {
    if (suppressions.has(pattern.id) || patternSlot(pattern) !== 'shadow') return;
    recordSuppression(suppressions, pattern, {
      suppressedBy: null,
      reason: 'calibration_shadow_only',
    });
  });
}

function applyFeedbackSurfacePolicy(rankedPatterns, suppressions, surface) {
  rankedPatterns.forEach((pattern) => {
    if (suppressions.has(pattern.id)) return;
    const policy = resolveSitePullPatternFeedbackSurfacePolicy(pattern, { surface });
    if (policy.allowed) return;
    recordSuppression(suppressions, pattern, {
      suppressedBy: null,
      reason: surface === SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE
        ? 'feedback_surface_not_badge'
        : 'feedback_surface_not_allowed',
    });
  });
}

function applyCompositeDominance(rankedPatterns, patternIndex, suppressions) {
  rankedPatterns
    .filter((pattern) => pattern.level === SITE_PULL_PATTERN_LEVELS.COMPOSITE)
    .forEach((composite) => {
      (Array.isArray(composite.componentIds) ? composite.componentIds : []).forEach((componentId) => {
        const component = patternIndex.get(componentId);
        if (!component || component.id === composite.id || !sharesEvidenceWindow(composite, component)) return;
        recordSuppression(suppressions, component, {
          suppressedBy: composite.id,
          reason: 'composite_dominance',
        });
      });
    });
}

function applyFocusedBlockContextPolicy(patternIndex, suppressions) {
  const focusedBlock = patternIndex.get(FOCUSED_BLOCK_ID);
  const detailed = patternIndex.get('deep_immersion');
  if (!focusedBlock || suppressions.has(focusedBlock.id) || !detailed || suppressions.has(detailed.id)) return;
  if ([SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_WITH_MOVEMENT,
    SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_WITH_RETURNS].includes(detailed.evidence?.immersionStatus)) {
    recordSuppression(suppressions, focusedBlock, { suppressedBy: detailed.id, reason: 'specific_session_context' });
  }
}

function applyTimePressureSpecificityPolicy(patternIndex, suppressions) {
  const timeHeavy = patternIndex.get(TIME_HEAVY_ID);
  const personalSpike = patternIndex.get(PERSONAL_SPIKE_ID);
  if (!timeHeavy || !personalSpike || suppressions.has(TIME_HEAVY_ID)) return;

  recordSuppression(suppressions, timeHeavy, {
    suppressedBy: PERSONAL_SPIKE_ID,
    reason: 'specific_time_context',
  });
}

function applySupportingContextSuppression(rankedPatterns, suppressions) {
  const visiblePrimaryByGroup = new Map();
  rankedPatterns.forEach((pattern) => {
    if (suppressions.has(pattern.id) || patternSlot(pattern) === 'supporting') return;
    const group = patternGroup(pattern);
    if (!visiblePrimaryByGroup.has(group)) {
      visiblePrimaryByGroup.set(group, pattern);
    }
  });

  rankedPatterns.forEach((pattern) => {
    if (suppressions.has(pattern.id) || patternSlot(pattern) !== 'supporting') return;
    const primary = visiblePrimaryByGroup.get(patternGroup(pattern));
    if (!primary || primary.id === pattern.id) return;
    recordSuppression(suppressions, pattern, {
      suppressedBy: primary.id,
      reason: 'supporting_context',
    });
  });
}

function applyGroupSlotLimits(rankedPatterns, suppressions, groupLimits) {
  const visibleByGroup = new Map();
  rankedPatterns.forEach((pattern) => {
    if (suppressions.has(pattern.id)) return;
    const group = patternGroup(pattern);
    const limit = Number.isFinite(Number(groupLimits[group]))
      ? Math.max(1, Math.floor(Number(groupLimits[group])))
      : 1;
    const selected = visibleByGroup.get(group) || [];
    if (selected.length >= limit) {
      recordSuppression(suppressions, pattern, {
        suppressedBy: selected[0]?.id || null,
        reason: 'group_slot_limit',
      });
      return;
    }
    selected.push(pattern);
    visibleByGroup.set(group, selected);
  });
}

function applyRecommendationFamilyBurden(rankedPatterns, suppressions, surface) {
  if (surface !== SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE) return;
  const visibleByRecommendationFamily = new Map();
  rankedPatterns.forEach((pattern) => {
    if (suppressions.has(pattern.id)) return;
    const policy = resolveSitePullPatternFeedbackSurfacePolicy(pattern, { surface });
    const family = policy.recommendationFamily;
    if (!family || family === 'none') return;
    const primary = visibleByRecommendationFamily.get(family);
    if (!primary) {
      visibleByRecommendationFamily.set(family, pattern);
      return;
    }
    recordSuppression(suppressions, pattern, {
      suppressedBy: primary.id,
      reason: 'recommendation_family_burden',
    });
  });
}

function applySurfaceLabelLimit(rankedPatterns, suppressions, surface, surfaceLimits) {
  const rawLimit = Number(surfaceLimits?.[surface]);
  if (!Number.isFinite(rawLimit)) return;
  const limit = Math.max(1, Math.floor(rawLimit));
  const visiblePatterns = rankedPatterns.filter((pattern) => !suppressions.has(pattern.id));
  visiblePatterns.slice(limit).forEach((pattern) => {
    recordSuppression(suppressions, pattern, {
      suppressedBy: null,
      reason: 'surface_label_limit',
    });
  });
}

export function presentSitePullPatterns(patterns = [], {
  groupLimits = SITE_PULL_PATTERN_PRESENTATION_GROUP_LIMITS,
  surface = SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE,
  surfaceLimits = SITE_PULL_PATTERN_PRESENTATION_SURFACE_LIMITS,
} = {}) {
  const rankedPatterns = rankSitePullPatternsForPresentation(patterns);
  const patternIndex = indexPatterns(rankedPatterns);
  const suppressions = new Map();

  applyStateExclusivity(rankedPatterns, suppressions);
  if (![...suppressions.values()].some((suppression) => suppression.reason === 'state_exclusive')) {
    applyShadowVisibilitySuppression(rankedPatterns, suppressions);
    applyFeedbackSurfacePolicy(rankedPatterns, suppressions, surface);
    applyCompositeDominance(rankedPatterns, patternIndex, suppressions);
    applyFocusedBlockContextPolicy(patternIndex, suppressions);
    applyTimePressureSpecificityPolicy(patternIndex, suppressions);
    applySupportingContextSuppression(rankedPatterns, suppressions);
    applyGroupSlotLimits(rankedPatterns, suppressions, groupLimits);
    applyRecommendationFamilyBurden(rankedPatterns, suppressions, surface);
    applySurfaceLabelLimit(rankedPatterns, suppressions, surface, surfaceLimits);
  }

  const presentationPatterns = rankedPatterns
    .filter((pattern) => !suppressions.has(pattern.id))
    .map((pattern) => attachSupportingPatternIds(pattern, patternIndex));
  const suppressedPatterns = [...suppressions.values()];

  return {
    version: SITE_PULL_PATTERN_PRESENTER_VERSION,
    presentationPatterns,
    suppressedPatterns,
    suppressedPatternIds: suppressedPatterns.map((suppression) => suppression.id),
    policy: {
      feedbackSurface: surface,
      feedbackSurfacePolicyVersion: SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
      groupLimits: { ...groupLimits },
      recommendationFamilyLimit: surface === SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE ? 1 : null,
      surfaceLimit: Number.isFinite(Number(surfaceLimits?.[surface]))
        ? Math.max(1, Math.floor(Number(surfaceLimits[surface])))
        : null,
    },
  };
}
