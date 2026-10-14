import { resolveSiteGoalContext } from '../../contracts/siteGoalContext.js';
import {
  SITE_PULL_PATTERN_CATEGORIES,
  createSitePullPatternSignal,
} from './sitePullPatternContracts.js';
import {
  clamp,
  clamp01,
  toNumber,
} from './patternUtils.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import { resolveSitePullSessionShape } from './sitePullSessionFactSource.js';

export const SITE_PULL_PATTERN_COMPOSER_VERSION = 'site-pull-pattern-composer-v2';

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireComposerEvidenceProfile(profile, profileId) {
  if (isObjectRecord(profile)) return profile;
  throw new Error(`SITE_PULL_COMPOSER_EVIDENCE_PROFILE_MISSING:${profileId}`);
}

function indexPatterns(patternSignals) {
  const index = new Map();
  (Array.isArray(patternSignals) ? patternSignals : []).forEach((pattern) => {
    if (pattern?.id && !index.has(pattern.id)) {
      index.set(pattern.id, pattern);
    }
  });
  return index;
}

function composeGoalExceededRepeated({ patternIndex, featureVector }) {
  const goalExceeded = patternIndex.get('goal_exceeded');
  if (!goalExceeded || !featureVector?.hasGoal) return null;
  const goalContext = resolveSiteGoalContext(featureVector);
  const overLimitDays = goalContext.overLimitDays;
  if (overLimitDays < 3) return null;
  const activeDays = goalContext.activeDays;
  return createSitePullPatternSignal({
    id: 'goal_exceeded_repeated',
    category: SITE_PULL_PATTERN_CATEGORIES.PLAN,
    severity: 'danger',
    tone: 'danger',
    score: clamp(65 + (overLimitDays * 6), 0, 96),
    confidence: 0.9,
    evidence: {
      ...goalExceeded.evidence,
      overLimitDays,
      activeDays,
      overLimitShare: activeDays > 0 ? Number((overLimitDays / activeDays).toFixed(4)) : 0,
    },
    recommendedAction: { type: 'goal_reflection', actionId: 'enable_goal_pause' },
    source: 'pattern_composer',
  });
}

function composeCheckingCarousel({ patternIndex, facts = {}, checkingEvidenceProfile }) {
  if (patternIndex.has('no_activity')) return null;
  const profile = requireComposerEvidenceProfile(checkingEvidenceProfile, 'checking');
  const entry = resolveSitePullEntryVisitSummary({ facts });
  const session = resolveSitePullSessionShape(facts);
  const behavior = facts.behavior || {};
  const navigation = facts.navigation || {};
  const candidate = (item) => item?.status === 'candidate' || item?.status === 'strong';
  const support = (item) => candidate(item) || item?.status === 'weak';
  const groups = [
    { familyId: 'attention_switching', entries: [profile.quickReturn, profile.switchChurn],
      measured: behavior.hasBehaviorFacts === true && (behavior.switchIns > 0 || behavior.switchOuts > 0) },
    { familyId: 'entry_distribution', entries: [profile.distributedVisits, profile.checkingLoop], measured: entry.todayVisits > 0 },
    { familyId: 'session_shape', entries: [profile.shortSessionLoop, profile.sessionFragmentation],
      measured: session.hasMeasuredSessionFacts },
    { familyId: 'navigation_entry', entries: [profile.habitualEntry, profile.reloadChecking], measured: navigation.total > 0 },
  ].filter((group) => group.measured && group.entries.some(support));
  const primaryGroups = groups.filter((group) => group.entries.some(candidate));
  if (groups.length < 2 || primaryGroups.length === 0) return null;
  const familyIds = groups.map((group) => group.familyId);
  // These dimensions can describe the same visits. Summarize their maximum;
  // neither route aliases nor personal-baseline outputs add a second vote.
  const score = Math.max(...groups.flatMap((group) => group.entries.filter(support)
    .map((item) => clamp01(item.strength)))) * 100;
  const primaryIds = [...new Set(primaryGroups.flatMap((group) => group.entries.filter(candidate).map((item) => item.id)))];
  return createSitePullPatternSignal({
    id: 'checking_carousel', category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
    severity: 'watch', tone: 'neutral', score, confidence: 0.62,
    evidence: {
      todayVisits: entry.todayVisits, visitHourCount: entry.visitHoursToday,
      todaySwitchChurn: toNumber(behavior.switchIns) + toNumber(behavior.switchOuts),
      todaySwitchBackWithin10m: toNumber(behavior.switchBackWithin10m),
      todayShortSessionCount: session.hasMeasuredSessionFacts ? session.shortSessionCount : 0,
      directEntryCount: toNumber(navigation.typed), reloadCount: toNumber(navigation.reload),
      primaryCheckingPressureScore: primaryGroups.length, primaryCheckingPressureIds: primaryIds,
      checkingCoreSignalCount: groups.length, corroboratingEvidenceFamilyIds: familyIds,
      corroboratingEvidenceFamilyCount: familyIds.length,
      corroborationMode: 'current_observation_dimensions', compositionBasis: 'day_cooccurrence',
      evidenceWindow: 'today', temporalAssociation: 'day_cooccurrence', orderedSequenceObserved: false,
      quickReturnSupport: support(profile.quickReturn), switchChurnSupport: support(profile.switchChurn),
      habitualEntrySupport: support(profile.habitualEntry), reloadCheckingSupport: support(profile.reloadChecking),
      sessionFragmentationSupport: session.hasMeasuredSessionFacts && support(profile.sessionFragmentation),
      distributedVisitSupport: support(profile.distributedVisits), routePivotSupport: false,
      confidence: 0.62, caveats: ['observation_dimensions_may_share_events', 'day_cooccurrence_not_ordered_loop'],
    }, source: 'pattern_composer',
  });
}

function composeLoopRouteHint({ routePressureEvidenceProfile }) {
  const profile = requireComposerEvidenceProfile(routePressureEvidenceProfile, 'route_pressure');
  if (!profile.routeLoop.canEmitComposite) return null;
  const evidence = profile.evidence;
  return createSitePullPatternSignal({
    id: 'loop_route_hint', category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
    severity: 'watch', tone: 'neutral', score: profile.routeLoop.strength * 100,
    confidence: profile.confidence,
    evidence: { ...evidence, count: evidence.todayCount, distinctEdgeCount: evidence.todayDistinctEdgeCount,
      returnWithin10m: evidence.todayReturnWithin10m }, source: 'pattern_composer',
  });
}

function composeTabQueuePattern({ tabContextEvidenceProfile = null }) {
  const profile = tabContextEvidenceProfile;
  if (!profile?.canEmitTabQueueComposite) return null;
  return createSitePullPatternSignal({
    id: 'tab_queue_pattern',
    category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
    severity: 'watch',
    tone: 'neutral',
    score: clamp(profile.score * 100, 0, 100),
    confidence: profile.confidence,
    evidence: profile.evidence,
    source: 'pattern_composer',
  });
}

function composeLateNightBinge({ patternIndex, nightPressureEvidenceProfile }) {
  if (!patternIndex.has('late_night')) return null;
  const profile = requireComposerEvidenceProfile(nightPressureEvidenceProfile, 'night_pressure');
  if (!profile.canEmitBinge) return null;
  return createSitePullPatternSignal({
    id: 'late_night_binge', category: SITE_PULL_PATTERN_CATEGORIES.CIRCADIAN,
    severity: 'neutral', tone: 'neutral', score: profile.score, confidence: profile.confidence,
    evidence: profile.evidence, recommendedAction: null, source: 'pattern_composer',
  });
}

function composeInterventionResistanceLoop({ patternIndex, interventionOutcomeEvidenceProfile }) {
  if (!patternIndex.has('intervention_reentry')) return null;
  const profile = requireComposerEvidenceProfile(interventionOutcomeEvidenceProfile, 'intervention_outcome');
  if (!profile.resistance.canSupportComposite) return null;
  return createSitePullPatternSignal({
    id: 'intervention_resistance_loop', category: SITE_PULL_PATTERN_CATEGORIES.INTERVENTION,
    severity: 'watch', tone: 'neutral', score: profile.resistance.strength * 100,
    confidence: profile.confidence, evidence: profile.resistance.evidence,
    recommendedAction: null, source: 'pattern_composer',
  });
}

function composeFeedLoopPattern({ contentFlowEvidenceProfile = null }) {
  const profile = contentFlowEvidenceProfile;
  if (!profile?.canEmitFeedLoopComposite) {
    return null;
  }
  return createSitePullPatternSignal({
    id: 'feed_loop_pattern',
    category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
    severity: 'watch',
    tone: 'neutral',
    score: clamp(profile.score * 100, 0, 100),
    confidence: profile.confidence,
    evidence: profile.evidence,
    source: 'pattern_composer',
  });
}

export function composeSitePullCompositePatterns(patternSignals = [], context = {}) {
  const patternIndex = indexPatterns(patternSignals);
  return [
    composeGoalExceededRepeated({ patternIndex, ...context }),
    composeCheckingCarousel({ patternIndex, ...context }),
    composeLoopRouteHint({ patternIndex, ...context }),
    composeTabQueuePattern({ patternIndex, ...context }),
    composeLateNightBinge({ patternIndex, ...context }),
    composeInterventionResistanceLoop({ patternIndex, ...context }),
    composeFeedLoopPattern({ patternIndex, ...context }),
  ].filter(Boolean);
}
