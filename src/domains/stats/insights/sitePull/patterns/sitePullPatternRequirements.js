import { SITE_PULL_PATTERN_LEVELS } from './sitePullPatternContracts.js';
import { resolveSitePullObservationState } from '../sitePullObservationState.js';
import { getSitePullPatternDefinition } from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_EVIDENCE_STATUS,
  isSitePullEvidenceStatusAtLeast,
} from './sitePullCheckingEvidenceProfile.js';
import { SITE_PULL_BACKGROUND_RESIDENCY_STATUSES } from './sitePullBackgroundResidencyEvidenceProfile.js';
import { SITE_PULL_CONTENT_FLOW_STATUSES } from './sitePullContentFlowEvidenceProfile.js';
import { SITE_PULL_CONTROLLED_BRIEF_STATUSES } from './sitePullControlledBriefEvidenceProfile.js';
import { SITE_PULL_INTERVENTION_OUTCOME_STATUSES } from './sitePullInterventionOutcomeEvidenceProfile.js';
import { SITE_PULL_ROUTE_PRESSURE_STATUSES } from './sitePullRoutePressureEvidenceProfile.js';
import { SITE_PULL_TAB_CONTEXT_STATUSES } from './sitePullTabContextEvidenceProfile.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
} from '../personalBaselineMetrics.js';
import { countObservedWeeklyEntries } from '../../contracts/weeklyObservationContract.js';

export const SITE_PULL_PATTERN_REQUIREMENTS_VERSION = 'site-pull-pattern-requirements-v1';

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function personalBaselineObservedDays(context) {
  const personalBaseline = context?.personalBaseline;
  if (personalBaseline === null || personalBaseline === undefined) return 0;
  const activeMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
  );
  const sample = activeMetric.sample;
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
    throw new Error('SITE_PULL_PATTERN_REQUIREMENT_PERSONAL_BASELINE_SAMPLE_MISSING:active_ms');
  }
  const observedDays = Number(sample.observedCount);
  if (!Number.isFinite(observedDays)) {
    throw new Error('SITE_PULL_PATTERN_REQUIREMENT_PERSONAL_BASELINE_SAMPLE_INVALID:active_ms.observedCount');
  }
  return Math.max(0, Math.floor(observedDays));
}

function evidenceNumber(pattern, key) {
  return toNumber(pattern?.evidence?.[key]);
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function textIn(value, allowed = []) {
  return typeof value === 'string' && allowed.includes(value);
}

const CHECKING_PROFILE_PATTERN_KEYS = Object.freeze({
  checking_pattern: 'checkingLoop',
  checking_pattern_proxy: 'checkingLoop',
  quick_return_loop: 'quickReturn',
  switch_churn_loop: 'switchChurn',
  session_fragmentation: 'sessionFragmentation',
  habitual_entry: 'habitualEntry',
  reload_checking: 'reloadChecking',
  new_tab_loop: 'newTabLoop',
  duplicate_tab_entry: 'duplicateTabEntry',
  tab_hoarding_context: 'tabHoardingContext',
});

function hasPattern(context, id) {
  return Boolean(context?.patternIndex?.has(id));
}

function hasOnlyPattern(context, id) {
  if (!context?.patternIndex) return true;
  const ids = [...context.patternIndex.keys()].filter(Boolean);
  return ids.length === 1 && ids[0] === id;
}

function subscoreAtLeast(context, key, threshold) {
  return toNumber(context?.subscores?.[key]) >= threshold;
}

function subscoreAtMost(context, key, threshold) {
  return toNumber(context?.subscores?.[key]) <= threshold;
}

function hasAnyActivity(context) {
  const featureVector = context?.featureVector || {};
  return Boolean(featureVector.hasAnyActivity)
    || toNumber(featureVector.todayTotalMs) > 0
    || toNumber(featureVector.weeklyTotalMs) > 0;
}

function hasUsageFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  if (coverage.hasUsageFacts === true) return true;
  const usage = context?.facts?.usage || {};
  return toNumber(usage.todayTotalMs) > 0 || toNumber(usage.weeklyTotalMs) > 0;
}

function hasHourlyFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  return coverage.hasHourlyFacts === true;
}

function hasWeeklyFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  if (coverage.hasWeeklyFacts === true) return true;
  const usage = context?.facts?.usage || {};
  return countObservedWeeklyEntries(usage.weeklySeries, {
    source: 'sitePullPatternRequirements.weeklySeries',
  }) > 0;
}

function hasVisitFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  if (coverage.hasEntryFacts === true) return true;
  const entry = context?.facts?.entry || {};
  return entry.hasVisitFacts === true
    || toNumber(entry.todayVisits) > 0
    || toNumber(entry.weeklyVisits) > 0
    || (Array.isArray(entry.todayHourlyVisits)
      && entry.todayHourlyVisits.some((value) => toNumber(value) > 0));
}

function hasSessionFacts(context) {
  const session = context?.facts?.session || {};
  return context?.facts?.dataCoverage?.hasSessionFacts === true
    || context?.facts?.dataCoverage?.hasEstimatedSessionFacts === true
    || session.hasMeasuredSessionFacts === true
    || session.hasEstimatedSessionFacts === true;
}

function hasBehaviorFacts(context) {
  return context?.facts?.dataCoverage?.hasBehaviorFacts === true
    || context?.facts?.behavior?.hasBehaviorFacts === true;
}

function hasNavigationFacts(context) {
  return context?.facts?.dataCoverage?.hasNavigationFacts === true
    || context?.facts?.navigation?.hasNavigationFacts === true;
}

function hasTransitionEdgeFacts(context) {
  return context?.facts?.dataCoverage?.hasTransitionEdgeFacts === true
    || context?.facts?.transitionEdges?.hasTransitionEdgeFacts === true;
}

function hasInterventionFacts(context) {
  return context?.facts?.dataCoverage?.hasInterventionFacts === true
    || context?.facts?.intervention?.hasInterventionFacts === true;
}

function missingUnless(condition, failure) {
  return condition ? [] : [failure];
}

function evidenceProfileStatus(pattern, context) {
  const explicitStatus = pattern?.evidence?.evidenceStatus;
  if (hasText(explicitStatus)) return explicitStatus;
  const profileKey = CHECKING_PROFILE_PATTERN_KEYS[pattern?.id];
  if (!profileKey) return null;
  const status = context?.checkingEvidenceProfile?.[profileKey]?.status;
  return hasText(status) ? status : null;
}

function candidateEvidenceStatusRequirement(pattern, context) {
  const status = evidenceProfileStatus(pattern, context);
  if (!status) return [];
  return missingUnless(
    isSitePullEvidenceStatusAtLeast(status, SITE_PULL_EVIDENCE_STATUS.CANDIDATE),
    'evidenceStatus>=candidate',
  );
}

function hasGoalExceededSignal(pattern, context) {
  return (
    Boolean(context?.featureVector?.hasGoal)
    && toNumber(context?.featureVector?.usageRatio) >= 1
  ) || evidenceNumber(pattern, 'usageRatio') >= 1;
}

function hasProtectedTargetActivity(context) {
  const featureVector = context?.featureVector || {};
  return !featureVector.hasGoal
    && Boolean(featureVector.isProtectedTarget)
    && Boolean(featureVector.hasAnyActivity);
}

function hasGoalKeptMeaningfulProgress(pattern, context) {
  return pattern?.evidence?.meaningfulGoalProgress === true
    || toNumber(pattern?.evidence?.meaningfulGoalProgressScore) >= 1
    || toNumber(pattern?.evidence?.todayMs) >= 30_000
    || toNumber(pattern?.evidence?.usageRatio) >= 0.05
    || toNumber(context?.featureVector?.todayTotalMs) >= 30_000
    || toNumber(context?.featureVector?.usageRatio) >= 0.05;
}

function hasVisibleTimePressure(pattern, context) {
  return pattern?.evidence?.timePressureVisible === true
    || context?.timePressureEvidenceProfile?.canEmitVisible === true
    || toNumber(pattern?.evidence?.timePressureChannelCount) >= 1
    || toNumber(context?.timePressureEvidenceProfile?.evidence?.timePressureChannelCount) >= 1
    || subscoreAtLeast(context, 'timePressure', 0.7);
}

function hasVisiblePersonalSpike(pattern) {
  return pattern?.evidence?.personalSpikeVisible === true
    || (
      evidenceNumber(pattern, 'confidence') >= 0.35
      && evidenceNumber(pattern, 'timeAnomalyScore') >= 0.65
      && evidenceNumber(pattern, 'personalSpikeChannelCount') >= 1
    );
}

function hasImmersionAbsorptionSupport(pattern) {
  return evidenceNumber(pattern, 'absorptionSupportChannelCount') >= 1
    || evidenceNumber(pattern, 'consumptionContinuityScore') >= 0.32
    || evidenceNumber(pattern, 'returnContextScore') >= 0.48;
}

function hasSessionDepthSpikeEvidence(pattern) {
  return pattern?.evidence?.sessionDepthVisible === true
    || evidenceNumber(pattern, 'sessionDepthChannelCount') >= 1
    || evidenceNumber(pattern, 'sessionDepthAnomalyScore') >= 0.6;
}

function hasCheckingContext(pattern) {
  return evidenceNumber(pattern, 'todayVisits') > 0
    && (
      evidenceNumber(pattern, 'visitHoursToday') > 0
      || evidenceNumber(pattern, 'activeHoursToday') > 0
    );
}

function hasQuickReturnEvidence(pattern) {
  return evidenceNumber(pattern, 'todaySwitchBackWithin10m') >= 2
    && evidenceNumber(pattern, 'todaySwitchIns') >= 3;
}

function hasSwitchChurnEvidence(pattern) {
  return evidenceNumber(pattern, 'todaySwitchChurn') >= 8;
}

function hasBaselineSource(pattern) {
  return pattern?.source === 'personal_baseline';
}

function hasComposerSource(pattern) {
  return pattern?.source === 'pattern_composer';
}

function hasTransitionSource(pattern) {
  return pattern?.source === 'transition_edges';
}

function hasCompositeSource(pattern) {
  return hasComposerSource(pattern);
}

function patternRequirement(check) {
  return Object.freeze({ check });
}

export const SITE_PULL_PATTERN_REQUIREMENTS = Object.freeze({
  no_activity: patternRequirement((_pattern, context) => (
    [
      ...missingUnless(context?.featureVector?.hasAnyActivity === false, 'featureVector.hasAnyActivity=false'),
      ...missingUnless(resolveSitePullObservationState(context.featureVector).status === 'observed_zero', 'observed zero'),
    ]
  )),
  insufficient_data: patternRequirement((pattern, context) => [
    ...missingUnless(pattern?.source === 'rule', 'source=rule'),
    ...missingUnless(hasAnyActivity(context)
      || resolveSitePullObservationState(context.featureVector).status === 'missing', 'activity or unobserved context'),
    ...missingUnless(toNumber(context?.confidence ?? pattern.confidence) < 0.35, 'confidence<0.35'),
    ...missingUnless(pattern?.evidence?.stateReason === 'insufficient_data', 'stateReason=insufficient_data'),
  ]),
  steady: patternRequirement((pattern, context) => [
    ...missingUnless(pattern?.source === 'rule', 'source=rule'),
    ...missingUnless(hasAnyActivity(context), 'activity context'),
    ...missingUnless(toNumber(context?.confidence ?? pattern?.evidence?.confidence) >= 0.35, 'confidence>=0.35'),
    ...missingUnless(pattern?.evidence?.stateReason === 'no_detector_patterns', 'stateReason=no_detector_patterns'),
    ...missingUnless(evidenceNumber(pattern, 'detectorSignalCount') === 0, 'detectorSignalCount=0'),
    ...missingUnless(hasOnlyPattern(context, 'steady'), 'no other patterns'),
  ]),
  goal_exceeded: patternRequirement((pattern, context) => (
    missingUnless(hasGoalExceededSignal(pattern, context), 'goal usageRatio>=1')
  )),
  goal_exceeded_repeated: patternRequirement((pattern, context) => [
    ...missingUnless(hasCompositeSource(pattern), 'source=pattern_composer'),
    ...missingUnless(hasPattern(context, 'goal_exceeded'), 'component goal_exceeded'),
    ...missingUnless(evidenceNumber(pattern, 'overLimitDays') >= 3, 'evidence.overLimitDays>=3'),
  ]),
  goal_missing: patternRequirement((pattern, context) => [
    ...missingUnless(hasProtectedTargetActivity(context), 'protected target activity without goal'),
    ...missingUnless(
      evidenceNumber(pattern, 'activityEvidenceCount') >= 1
      || toNumber(context?.featureVector?.todayTotalMs) > 0
      || toNumber(context?.featureVector?.weeklyTotalMs) > 0,
      'activity evidence',
    ),
  ]),
  goal_kept: patternRequirement((pattern, context) => [
    ...missingUnless(
      (
        Boolean(context?.featureVector?.hasGoal)
        && toNumber(context?.featureVector?.usageRatio) > 0
        && toNumber(context?.featureVector?.usageRatio) < 0.75
      ) || (
        evidenceNumber(pattern, 'usageRatio') > 0
        && evidenceNumber(pattern, 'usageRatio') < 0.75
      ),
      'goal usageRatio between 0 and 0.75',
    ),
    ...missingUnless(hasGoalKeptMeaningfulProgress(pattern, context), 'meaningful goal progress'),
  ]),
  time_heavy_today: patternRequirement((pattern, context) => [
    ...missingUnless(hasUsageFacts(context), 'usage facts'),
    ...missingUnless(hasVisibleTimePressure(pattern, context), 'visible time pressure channel'),
    ...missingUnless(evidenceNumber(pattern, 'todayMs') > 0, 'evidence.todayMs>0'),
    ...missingUnless(hasText(pattern?.evidence?.timePressureStatus), 'evidence.timePressureStatus'),
  ]),
  personal_spike: patternRequirement((pattern) => [
    ...missingUnless(hasBaselineSource(pattern), 'source=personal_baseline'),
    ...missingUnless(hasVisiblePersonalSpike(pattern), 'visible personal spike evidence'),
    ...missingUnless(evidenceNumber(pattern, 'todayMs') > 0, 'evidence.todayMs>0'),
    ...missingUnless(evidenceNumber(pattern, 'p75ReferenceMs') > 0, 'evidence.p75ReferenceMs>0'),
  ]),
  deep_immersion: patternRequirement((pattern, context) => [
    ...missingUnless(
      hasHourlyFacts(context) || hasSessionFacts(context),
      'hourly or session facts',
    ),
    ...missingUnless(
      hasBehaviorFacts(context) || hasNavigationFacts(context) || hasInterventionFacts(context),
      'behavior, navigation, or intervention facts',
    ),
    ...missingUnless(evidenceNumber(pattern, 'sustainedBlockMs') >= 30 * 60_000, 'evidence.sustainedBlockMs>=30m'),
    ...missingUnless(evidenceNumber(pattern, 'durationConcentrationScore') >= 0.42, 'evidence.durationConcentrationScore>=0.42'),
    ...missingUnless(evidenceNumber(pattern, 'absorptionScore') >= 0.58, 'evidence.absorptionScore>=0.58'),
    ...missingUnless(hasImmersionAbsorptionSupport(pattern), 'same-day movement or return context'),
  ]),
  focused_block: patternRequirement((pattern, context) => [
    ...missingUnless(
      hasSessionFacts(context) && pattern.evidence?.hasMeasuredSessionFacts === true,
      'current measured session facts',
    ),
    ...missingUnless(evidenceNumber(pattern, 'sustainedBlockMs') >= 20 * 60_000, 'evidence.sustainedBlockMs>=20m'),
    ...missingUnless(evidenceNumber(pattern, 'blockShare') >= 0.55, 'evidence.blockShare>=0.55'),
  ]),
  session_depth_spike: patternRequirement((pattern) => [
    ...missingUnless(hasBaselineSource(pattern), 'source=personal_baseline'),
    ...missingUnless(hasSessionDepthSpikeEvidence(pattern), 'visible session depth evidence'),
    ...missingUnless(evidenceNumber(pattern, 'todayMaxSessionMs') > 0, 'evidence.todayMaxSessionMs>0'),
    ...missingUnless(evidenceNumber(pattern, 'maxSessionReferenceMs') > 0, 'evidence.maxSessionReferenceMs>0'),
    ...missingUnless(evidenceNumber(pattern, 'sessionDepthAnomalyScore') >= 0.6, 'evidence.sessionDepthAnomalyScore>=0.6'),
    ...missingUnless(hasText(pattern?.evidence?.spikeStatus), 'evidence.spikeStatus'),
  ]),
  checking_pattern: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasVisitFacts(context), 'visit facts'),
    ...missingUnless(subscoreAtLeast(context, 'checkingLoop', 0.4), 'subscore.checkingLoop>=0.4'),
    ...missingUnless(hasCheckingContext(pattern), 'visit-backed checking evidence'),
  ]),
  checking_pattern_proxy: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(!hasVisitFacts(context), 'no visit facts'),
    ...missingUnless(hasHourlyFacts(context), 'hourly facts'),
    ...missingUnless(subscoreAtLeast(context, 'checkingLoop', 0.55), 'subscore.checkingLoop>=0.55'),
    ...missingUnless(evidenceNumber(pattern, 'activeHoursToday') > 0, 'evidence.activeHoursToday>0'),
  ]),
  visit_spike: patternRequirement((pattern) => [
    ...missingUnless(hasBaselineSource(pattern), 'source=personal_baseline'),
    ...missingUnless(evidenceNumber(pattern, 'todayVisits') > 0, 'evidence.todayVisits>0'),
  ]),
  reentry_spike: patternRequirement((pattern) => [
    ...missingUnless(hasBaselineSource(pattern), 'source=personal_baseline'),
    ...missingUnless(evidenceNumber(pattern, 'todayRevisitWithin10m') > 0, 'evidence.todayRevisitWithin10m>0'),
  ]),
  quick_return_loop: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasBehaviorFacts(context) || hasBaselineSource(pattern), 'behavior facts or personal baseline source'),
    ...missingUnless(hasQuickReturnEvidence(pattern), 'quick return switch evidence'),
  ]),
  switch_churn_loop: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasBehaviorFacts(context) || hasBaselineSource(pattern), 'behavior facts or personal baseline source'),
    ...missingUnless(hasSwitchChurnEvidence(pattern), 'evidence.todaySwitchChurn>=8'),
  ]),
  checking_carousel: patternRequirement((pattern, context) => [
    ...missingUnless(hasCompositeSource(pattern), 'source=pattern_composer'),
    ...missingUnless(evidenceNumber(pattern, 'primaryCheckingPressureScore') >= 1, 'evidence.primaryCheckingPressureScore>=1'),
    ...missingUnless(
      evidenceNumber(pattern, 'corroboratingEvidenceFamilyCount') >= 2,
      'evidence.corroboratingEvidenceFamilyCount>=2',
    ),
  ]),
  session_fragmentation: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasSessionFacts(context) && pattern.evidence?.hasMeasuredSessionFacts === true, 'measured session facts'),
    ...missingUnless(evidenceNumber(pattern, 'sessionCount') >= 6, 'evidence.sessionCount>=6'),
    ...missingUnless(evidenceNumber(pattern, 'shortSessionCount') >= 4, 'evidence.shortSessionCount>=4'),
  ]),
  controlled_brief_check: patternRequirement((pattern, context) => [
    ...missingUnless(hasUsageFacts(context) && hasSessionFacts(context), 'usage and session facts'),
    ...missingUnless(pattern.evidence?.hasMeasuredSessionFacts === true, 'current measured session facts'),
    ...missingUnless(evidenceNumber(pattern, 'todayMs') >= 2 * 60_000
      && evidenceNumber(pattern, 'todayMs') <= 12 * 60_000, 'evidence.todayMs between 2m and 12m'),
    ...missingUnless(evidenceNumber(pattern, 'visitOrSessionCount') >= 1
      && evidenceNumber(pattern, 'visitOrSessionCount') <= 3, 'brief visit/session count'),
    ...missingUnless(evidenceNumber(pattern, 'averageSessionMs') > 0
      && evidenceNumber(pattern, 'averageSessionMs') <= 5 * 60_000, 'measured average between 0 and 5m'),
    ...missingUnless(evidenceNumber(pattern, 'maxSessionMs') > 0
      && evidenceNumber(pattern, 'maxSessionMs') <= 5 * 60_000, 'measured maximum between 0 and 5m'),
    ...missingUnless(evidenceNumber(pattern, 'controlledBriefScore') >= 0.62, 'evidence.controlledBriefScore>=0.62'),
    ...missingUnless(textIn(pattern.evidence?.controlledBriefStatus, [
      SITE_PULL_CONTROLLED_BRIEF_STATUSES.BRIEF_CHECK_OBSERVED,
      SITE_PULL_CONTROLLED_BRIEF_STATUSES.BRIEF_CHECK_WITH_RETURNS,
    ]), 'observed brief status'),
  ]),
  domain_pair_loop: patternRequirement((pattern, context) => [
    ...missingUnless(hasTransitionEdgeFacts(context), 'transition edge facts'),
    ...missingUnless(hasTransitionSource(pattern), 'source=transition_edges'),
    ...missingUnless(hasText(pattern?.evidence?.fromDomain), 'evidence.fromDomain'),
    ...missingUnless(hasText(pattern?.evidence?.toDomain), 'evidence.toDomain'),
    ...missingUnless(evidenceNumber(pattern, 'count') >= 2, 'evidence.count>=2'),
    ...missingUnless(evidenceNumber(pattern, 'pairLoopScore') >= 0.3, 'evidence.pairLoopScore>=0.3'),
  ]),
  protected_route_return: patternRequirement((pattern, context) => [
    ...missingUnless(hasTransitionEdgeFacts(context), 'transition edge facts'),
    ...missingUnless(hasTransitionSource(pattern), 'source=transition_edges'),
    ...missingUnless(hasText(pattern?.evidence?.targetDomain), 'evidence.targetDomain'),
    ...missingUnless(hasText(pattern?.evidence?.fromDomain), 'evidence.fromDomain'),
    ...missingUnless(evidenceNumber(pattern, 'count') >= 3, 'evidence.count>=3'),
    ...missingUnless(evidenceNumber(pattern, 'returnWithin10m') >= 2, 'evidence.returnWithin10m>=2'),
    ...missingUnless(evidenceNumber(pattern, 'protectedReturnScore') >= 0.55, 'evidence.protectedReturnScore>=0.55'),
    ...missingUnless(
      textIn(pattern?.evidence?.routeStatus, [
        SITE_PULL_ROUTE_PRESSURE_STATUSES.PROTECTED_ROUTE_RETURN,
        SITE_PULL_ROUTE_PRESSURE_STATUSES.PROTECTED_ROUTE_CAROUSEL,
      ]),
      'evidence.routeStatus protected return',
    ),
  ]),
  loop_route_hint: patternRequirement((pattern) => [
    ...missingUnless(hasCompositeSource(pattern), 'source=pattern_composer'),
    ...missingUnless(evidenceNumber(pattern, 'count') >= 6, 'evidence.count>=6'),
    ...missingUnless(evidenceNumber(pattern, 'distinctEdgeCount') >= 3, 'evidence.distinctEdgeCount>=3'),
    ...missingUnless(evidenceNumber(pattern, 'routePressureScore') >= 0.55, 'evidence.routePressureScore>=0.55'),
    ...missingUnless(
      textIn(pattern?.evidence?.routeStatus, [
        SITE_PULL_ROUTE_PRESSURE_STATUSES.MULTI_EDGE_ROUTE_LOOP,
        SITE_PULL_ROUTE_PRESSURE_STATUSES.PROTECTED_ROUTE_CAROUSEL,
      ]),
      'evidence.routeStatus route loop',
    ),
  ]),
  habitual_entry: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasNavigationFacts(context), 'navigation facts'),
    ...missingUnless(evidenceNumber(pattern, 'typedEntrances') >= 2, 'evidence.typedEntrances>=2'),
  ]),
  reload_checking: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasNavigationFacts(context), 'navigation facts'),
    ...missingUnless(evidenceNumber(pattern, 'reloads') >= 2, 'evidence.reloads>=2'),
  ]),
  new_tab_loop: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasBehaviorFacts(context), 'behavior facts'),
    ...missingUnless(evidenceNumber(pattern, 'newTabEntrances') >= 2, 'evidence.newTabEntrances>=2'),
  ]),
  duplicate_tab_entry: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasBehaviorFacts(context), 'behavior facts'),
    ...missingUnless(evidenceNumber(pattern, 'duplicateTabEntrances') >= 2, 'evidence.duplicateTabEntrances>=2'),
    ...missingUnless(evidenceNumber(pattern, 'maxSameDomainOpenTabs') >= 2, 'evidence.maxSameDomainOpenTabs>=2'),
  ]),
  tab_queue_pattern: patternRequirement((pattern) => (
    missingUnless(
      hasCompositeSource(pattern)
      && evidenceNumber(pattern, 'tabQueueScore') >= 0.58
      && (
        evidenceNumber(pattern, 'tabQueueChannelCount') >= 2
        || pattern?.evidence?.strongSameDomainQueue === true
      )
      && textIn(pattern?.evidence?.tabContextStatus, [
        SITE_PULL_TAB_CONTEXT_STATUSES.NEW_TAB_QUEUE,
        SITE_PULL_TAB_CONTEXT_STATUSES.SAME_DOMAIN_TAB_QUEUE,
      ]),
      'source=pattern_composer with tab queue profile',
    )
  )),
  tab_hoarding_context: patternRequirement((pattern, context) => [
    ...candidateEvidenceStatusRequirement(pattern, context),
    ...missingUnless(hasBehaviorFacts(context), 'behavior facts'),
    ...missingUnless(
      evidenceNumber(pattern, 'highOpenTabEntrances') >= 2
      || evidenceNumber(pattern, 'maxOpenTabs') >= 20,
      'tab hoarding context evidence',
    ),
  ]),
  background_residency: patternRequirement((pattern, context) => [
    ...missingUnless(hasBehaviorFacts(context), 'behavior facts'),
    ...missingUnless(evidenceNumber(pattern, 'backgroundResidencyScore') >= 0.58, 'evidence.backgroundResidencyScore>=0.58'),
    ...missingUnless(
      evidenceNumber(pattern, 'todayBackgroundResidencyMs') >= 15 * 60_000
      || evidenceNumber(pattern, 'weeklyBackgroundResidencyMs') >= 90 * 60_000
      || evidenceNumber(pattern, 'staleTabMs') >= 8 * 60_000
      || evidenceNumber(pattern, 'backgroundMediaMs') >= 20 * 60_000,
      'background residency duration support',
    ),
    ...missingUnless(
      textIn(pattern?.evidence?.backgroundResidencyStatus, [
        SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.BACKGROUND_LINGER_OBSERVED,
        SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.STALE_BACKGROUND_RESIDENCY,
        SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.BACKGROUND_MEDIA_RESIDENCY,
        SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.RECURRING_BACKGROUND_RESIDENCY,
        SITE_PULL_BACKGROUND_RESIDENCY_STATUSES.WEEKLY_BACKGROUND_OBSERVED,
      ]),
      'evidence.backgroundResidencyStatus visible',
    ),
  ]),
  feed_skimming: patternRequirement((pattern, context) => [
    ...missingUnless(hasBehaviorFacts(context), 'behavior facts'),
    ...missingUnless(evidenceNumber(pattern, 'feedSkimSignals') >= 1, 'evidence.feedSkimSignals>=1'),
    ...missingUnless(evidenceNumber(pattern, 'skimScore') >= 0.25, 'evidence.skimScore>=0.25'),
  ]),
  feed_loop_pattern: patternRequirement((pattern) => (
    missingUnless(
      hasCompositeSource(pattern)
      && (
        evidenceNumber(pattern, 'contentFlowScore') >= 0.58
        && evidenceNumber(pattern, 'corroboratingEvidenceFamilyCount') >= 2
        && textIn(pattern?.evidence?.contentFlowStatus, [
          SITE_PULL_CONTENT_FLOW_STATUSES.FEED_SUPPLY_CONTEXT,
        ])
      ),
      'source=pattern_composer with independent content-flow evidence families',
    )
  )),
  fast_scroll_bursts: patternRequirement((pattern, context) => [
    ...missingUnless(hasBehaviorFacts(context), 'behavior facts'),
    ...missingUnless(
      pattern?.evidence?.scrollVelocityChannel === true
      && evidenceNumber(pattern, 'scrollVelocityScore') >= 0.25,
      'scroll velocity context',
    ),
  ]),
  daily_habit: patternRequirement((pattern, context) => [
    ...missingUnless(hasWeeklyFacts(context), 'weekly facts'),
    ...missingUnless(evidenceNumber(pattern, 'activeDays') >= 4, 'evidence.activeDays>=4'),
    ...missingUnless(evidenceNumber(pattern, 'weeklyDays') >= 5, 'observed weekly days>=5'),
    ...missingUnless(evidenceNumber(pattern, 'habitConsistencyScore') >= 0.62, 'evidence.habitConsistencyScore>=0.62'),
    ...missingUnless(
      textIn(pattern?.evidence?.habitStatus, [
        'daily_touchpoint',
        'consistent_daily_habit',
      ]),
      'evidence.habitStatus=visible_habit_status',
    ),
  ]),
  rising_trend: patternRequirement((pattern, context) => [
    ...missingUnless(hasWeeklyFacts(context) || personalBaselineObservedDays(context) >= 5, 'weekly or baseline facts'),
    ...missingUnless(evidenceNumber(pattern, 'trendPressureScore') >= 0.6, 'evidence.trendPressureScore>=0.6'),
    ...missingUnless(evidenceNumber(pattern, 'comparisonDays') === 7, 'complete seven-day comparison'),
    ...missingUnless(
      textIn(pattern?.evidence?.trendPressureStatus, [
        'recent_rise_observed',
        'sustained_rising_trend',
        'personal_trend_shift',
      ]),
      'evidence.trendPressureStatus=visible_trend_status',
    ),
    ...missingUnless(
      evidenceNumber(pattern, 'trendRatio') > 1
      || evidenceNumber(pattern, 'personalTrendAnomalyScore') >= 0.65,
      'trend pressure support evidence',
    ),
  ]),
  late_night: patternRequirement((pattern, context) => [
    ...missingUnless(hasHourlyFacts(context), 'hourly facts'),
    ...missingUnless(subscoreAtLeast(context, 'circadianRisk', 0.55), 'subscore.circadianRisk>=0.55'),
    ...missingUnless(evidenceNumber(pattern, 'nightMsToday') > 0, 'evidence.nightMsToday>0'),
    ...missingUnless(hasText(pattern?.evidence?.nightPressureStatus), 'evidence.nightPressureStatus'),
  ]),
  late_night_binge: patternRequirement((pattern, context) => [
    ...missingUnless(hasCompositeSource(pattern), 'source=pattern_composer'),
    ...missingUnless(hasPattern(context, 'late_night'), 'component late_night'),
    ...missingUnless(evidenceNumber(pattern, 'nightMsToday') >= 15 * 60_000, 'evidence.nightMsToday>=15m'),
    ...missingUnless(
      evidenceNumber(pattern, 'nightPressureScore') >= 0.62,
      'evidence.nightPressureScore>=0.62',
    ),
    ...missingUnless(hasText(pattern?.evidence?.nightPressureStatus), 'evidence.nightPressureStatus'),
    ...missingUnless(
      evidenceNumber(pattern, 'durationPressureScore') >= 0.5
      || evidenceNumber(pattern, 'durationContextScore') >= 0.45,
      'late-night pressure support evidence',
    ),
  ]),
  intervention_resistance_loop: patternRequirement((pattern, context) => [
    ...missingUnless(hasInterventionFacts(context), 'intervention facts'),
    ...missingUnless(hasCompositeSource(pattern), 'source=pattern_composer'),
    ...missingUnless(hasPattern(context, 'intervention_reentry'), 'component intervention_reentry'),
    ...missingUnless(evidenceNumber(pattern, 'frictionShown') >= 2, 'evidence.frictionShown>=2'),
    ...missingUnless(evidenceNumber(pattern, 'reenteredWithin30m') >= 2, 'evidence.reenteredWithin30m>=2'),
    ...missingUnless(evidenceNumber(pattern, 'repeatedReentryPressure') > 0, 'evidence.repeatedReentryPressure'),
    ...missingUnless(
      textIn(pattern?.evidence?.interventionOutcomeStatus, [
        SITE_PULL_INTERVENTION_OUTCOME_STATUSES.REPEATED_INTERVENTION_REENTRY,
      ]),
      'evidence.interventionOutcomeStatus resistance',
    ),
  ]),
  intervention_reentry: patternRequirement((pattern, context) => [
    ...missingUnless(hasInterventionFacts(context), 'intervention facts'),
    ...missingUnless(
      evidenceNumber(pattern, 'interventionReentryScore') >= 55
      || evidenceNumber(pattern, 'todayRepeatedReentryPressure') > 0
      || evidenceNumber(pattern, 'weeklyRepeatedReentryPressure') > 0,
      'intervention resistance score or repeated reentry pressure',
    ),
    ...missingUnless(
      textIn(pattern?.evidence?.interventionOutcomeStatus, [
        SITE_PULL_INTERVENTION_OUTCOME_STATUSES.INTERVENTION_REENTRY_OBSERVED,
        SITE_PULL_INTERVENTION_OUTCOME_STATUSES.REPEATED_INTERVENTION_REENTRY,
        SITE_PULL_INTERVENTION_OUTCOME_STATUSES.MIXED_INTERVENTION_OUTCOME,
      ]),
      'evidence.interventionOutcomeStatus reentry',
    ),
    ...missingUnless(
      evidenceNumber(pattern, 'frictionShown') > 0
      && (
        evidenceNumber(pattern, 'reenteredWithin5m') > 0
        || evidenceNumber(pattern, 'reenteredWithin30m') > 0
      ),
      'intervention reentry evidence',
    ),
  ]),
  intervention_recovery: patternRequirement((pattern, context) => [
    ...missingUnless(hasInterventionFacts(context), 'intervention facts'),
    ...missingUnless(evidenceNumber(pattern, 'frictionShown') > 0, 'evidence.frictionShown>0'),
    ...missingUnless(evidenceNumber(pattern, 'left') >= 2, 'evidence.left>=2'),
    ...missingUnless(
      textIn(pattern?.evidence?.interventionOutcomeStatus, [
        SITE_PULL_INTERVENTION_OUTCOME_STATUSES.INTERVENTION_LEAVE_OBSERVED,
      ]),
      'evidence.interventionOutcomeStatus recovery',
    ),
  ]),
});

export function getSitePullPatternRequirement(id) {
  return SITE_PULL_PATTERN_REQUIREMENTS[id] || null;
}

function buildRejectedPattern(pattern, reason, failures = []) {
  return {
    id: pattern?.id || '',
    source: pattern?.source || null,
    level: pattern?.level || null,
    category: pattern?.category || null,
    reason,
    failures,
  };
}

export function rejectSitePullPattern(pattern, reason, failures = []) {
  return buildRejectedPattern(pattern, reason, failures);
}

export function validateSitePullPatternSignal(pattern, context = {}) {
  if (!pattern?.id) {
    return {
      valid: false,
      rejection: buildRejectedPattern(pattern, 'missing_pattern_id', ['id']),
    };
  }
  if (!getSitePullPatternDefinition(pattern.id)) {
    return {
      valid: false,
      rejection: buildRejectedPattern(pattern, 'unknown_pattern_definition', ['definition']),
    };
  }
  const requirement = getSitePullPatternRequirement(pattern.id);
  if (!requirement) {
    return {
      valid: false,
      rejection: buildRejectedPattern(pattern, 'missing_pattern_requirement', ['requirement']),
    };
  }
  const failures = requirement.check(pattern, context).filter(Boolean);
  return {
    valid: failures.length === 0,
    rejection: failures.length > 0
      ? buildRejectedPattern(pattern, 'requirements_failed', failures)
      : null,
  };
}

export function validateSitePullPatternSignals(patterns = [], context = {}) {
  const validPatterns = [];
  const rejectedPatterns = [];
  (Array.isArray(patterns) ? patterns : []).forEach((pattern) => {
    const result = validateSitePullPatternSignal(pattern, context);
    if (result.valid) {
      validPatterns.push(pattern);
    } else if (result.rejection) {
      rejectedPatterns.push(result.rejection);
    }
  });
  return { validPatterns, rejectedPatterns };
}

export function rejectsDetectorCompositePattern(pattern) {
  return pattern?.level === SITE_PULL_PATTERN_LEVELS.COMPOSITE
    && pattern?.source !== 'pattern_composer';
}
