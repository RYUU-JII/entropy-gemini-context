import { toPublicPersonalBaseline } from '../personalBaseline.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import {
  SITE_PULL_PATTERN_CATEGORIES,
  createSitePullPatternSignal,
} from './sitePullPatternContracts.js';
import { rankSitePullPatternsForPresentation } from './sitePullPatternDefinitions.js';
import { buildSitePullPatternLayers } from './sitePullPatternLayers.js';
import { buildSitePullBackgroundResidencyEvidenceProfile } from './sitePullBackgroundResidencyEvidenceProfile.js';
import { buildSitePullCheckingEvidenceProfile } from './sitePullCheckingEvidenceProfile.js';
import { buildSitePullContentFlowEvidenceProfile } from './sitePullContentFlowEvidenceProfile.js';
import { buildSitePullControlledBriefEvidenceProfile } from './sitePullControlledBriefEvidenceProfile.js';
import { buildSitePullHabitConsistencyEvidenceProfile } from './sitePullHabitConsistencyEvidenceProfile.js';
import { buildSitePullImmersionEvidenceProfile } from './sitePullImmersionEvidenceProfile.js';
import { buildSitePullInterventionOutcomeEvidenceProfile } from './sitePullInterventionOutcomeEvidenceProfile.js';
import { buildSitePullNightPressureEvidenceProfile } from './sitePullNightPressureEvidenceProfile.js';
import { buildSitePullRoutePressureEvidenceProfile } from './sitePullRoutePressureEvidenceProfile.js';
import { buildSitePullSessionDepthEvidenceProfile } from './sitePullSessionDepthEvidenceProfile.js';
import { buildSitePullSustainedBlockEvidenceProfile } from './sitePullSustainedBlockEvidenceProfile.js';
import { buildSitePullTabContextEvidenceProfile } from './sitePullTabContextEvidenceProfile.js';
import { buildSitePullTimePressureEvidenceProfile } from './sitePullTimePressureEvidenceProfile.js';
import { buildSitePullTrendPressureEvidenceProfile } from './sitePullTrendPressureEvidenceProfile.js';
import { toNumber } from './patternUtils.js';
import {
  detectDataPatterns,
  detectPlanPatterns,
  detectSubscorePatterns,
} from './detectors/dataPlanPatterns.js';
import { detectPersonalBaselinePatterns } from './detectors/baselinePatterns.js';
import {
  detectCheckingPatterns,
  detectTransitionEdgePatterns,
} from './detectors/checkingRoutePatterns.js';
import { detectNavigationAndFlowPatterns } from './detectors/navigationFlowPatterns.js';
import { detectSessionShapePatterns } from './detectors/sessionShapePatterns.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
  resolveSitePullPatternFeedbackSurfacePolicy,
} from './sitePullPatternFeedbackSpec.js';

export {
  SITE_PULL_AGGREGATE_ANALYSIS_VERSION,
  SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES,
  SITE_PULL_PROTECTED_CHECKING_PRESSURE_VERSION,
  buildSitePullAggregateAnalysis,
} from './sitePullAggregateAnalysis.js';
export {
  SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY,
  SITE_PULL_AGGREGATE_FEEDBACK_ROLES,
  SITE_PULL_AGGREGATE_FEEDBACK_SURFACES,
  SITE_PULL_AGGREGATE_FEEDBACK_VERSION,
  SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY,
  buildSitePullAggregateFeedbackItems,
  requireSitePullAggregateFeedbackSurface,
} from './sitePullAggregateFeedback.js';
export {
  SITE_PULL_BACKGROUND_RESIDENCY_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_BACKGROUND_RESIDENCY_STATUSES,
  buildSitePullBackgroundResidencyEvidenceProfile,
} from './sitePullBackgroundResidencyEvidenceProfile.js';
export {
  SITE_PULL_CHECKING_COUNTER_AUTHORITY,
  SITE_PULL_CHECKING_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_EVIDENCE_STATUS,
  buildSitePullCheckingEvidenceProfile,
  isSitePullEvidenceStatusAtLeast,
} from './sitePullCheckingEvidenceProfile.js';
export {
  SITE_PULL_CONTENT_FLOW_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_CONTENT_FLOW_STATUSES,
  buildSitePullContentFlowEvidenceProfile,
} from './sitePullContentFlowEvidenceProfile.js';
export {
  SITE_PULL_CONTROLLED_BRIEF_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_CONTROLLED_BRIEF_STATUSES,
  buildSitePullControlledBriefEvidenceProfile,
} from './sitePullControlledBriefEvidenceProfile.js';
export {
  SITE_PULL_PATTERN_CALIBRATION,
  SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY,
  SITE_PULL_PATTERN_CALIBRATION_VERSION,
  SITE_PULL_PATTERN_CALIBRATION_VISIBILITY,
  calibrateSitePullPatternSignal,
  calibrateSitePullPatternSignals,
  getSitePullPatternCalibration,
} from './sitePullPatternCalibration.js';
export {
  SITE_PULL_PATTERN_CALIBRATION_AUDIT_VERSION,
  SITE_PULL_PATTERN_CALIBRATION_DECISION_HINTS,
  SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY_POLICY,
  SITE_PULL_PATTERN_CALIBRATION_VISIBILITY_FEEDBACK_POLICY,
  SITE_PULL_PATTERN_DECISION_GATES,
  SITE_PULL_PATTERN_TUNING_SURFACES,
  buildSitePullPatternCalibrationAuditReport,
} from './sitePullPatternCalibrationAudit.js';
export {
  SITE_PULL_PATTERN_THRESHOLD_AUDIT_VERSION,
  SITE_PULL_PATTERN_THRESHOLD_SPECS,
  SITE_PULL_THRESHOLD_GATE_TYPES,
  SITE_PULL_THRESHOLD_SHAPES,
  SITE_PULL_THRESHOLD_STAGES,
  buildSitePullPatternThresholdAuditReport,
} from './sitePullPatternThresholdAudit.js';
export {
  SITE_PULL_PATTERN_CATEGORIES,
  SITE_PULL_PATTERN_ENGINE_VERSION,
  SITE_PULL_PATTERN_LEVELS,
  SITE_PULL_PATTERN_POLARITIES,
} from './sitePullPatternContracts.js';
export {
  SITE_PULL_AGGREGATE_ANALYSIS_METHODS,
  SITE_PULL_AGGREGATE_BASELINE_MODES,
  SITE_PULL_AGGREGATE_CANDIDATE_PLAN_STATUSES,
  SITE_PULL_AGGREGATE_COST_CLASSES,
  SITE_PULL_AGGREGATE_ENTITY_PROJECTIONS,
  SITE_PULL_AGGREGATE_PATTERN_SCOPES,
  SITE_PULL_AGGREGATE_PATTERN_SPECS,
  SITE_PULL_AGGREGATE_PATTERN_SPEC_VERSION,
  SITE_PULL_AGGREGATE_PLAN_STATUSES,
  SITE_PULL_AGGREGATE_SIGNAL_FAMILIES,
  SITE_PULL_AGGREGATE_TIME_AXES,
  buildSitePullAggregatePatternPlan,
  getSitePullAggregatePatternSpec,
  listSitePullAggregatePatternSpecs,
} from './sitePullAggregatePatternSpec.js';
export {
  SITE_PULL_PATTERN_DEFINITIONS,
  SITE_PULL_PATTERN_DEFINITION_VERSION,
  getSitePullPatternDefinition,
} from './sitePullPatternDefinitions.js';
export {
  SITE_PULL_PATTERN_FEEDBACK_ROLES,
  SITE_PULL_PATTERN_FEEDBACK_SCOPES,
  SITE_PULL_PATTERN_FEEDBACK_SPEC,
  SITE_PULL_PATTERN_FEEDBACK_SPEC_VERSION,
  SITE_PULL_PATTERN_FEEDBACK_SURFACE_AUDIT_VERSION,
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
  SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
  SITE_PULL_PATTERN_RECOMMENDATION_FAMILIES,
  buildSitePullPatternFeedbackSurfaceAudit,
  getSitePullPatternFeedbackSpec,
  listSitePullPatternFeedbackSurfaceRows,
  listSitePullPatternFeedbackDecisionQueue,
  resolveSitePullPatternFeedbackSurfacePolicy,
  requireSitePullPatternFeedbackSurface,
  supportsSitePullPatternFeedbackSurface,
} from './sitePullPatternFeedbackSpec.js';
export {
  SITE_PULL_FEEDBACK_CONSUMER_IDS,
  SITE_PULL_FEEDBACK_SURFACE_INVENTORY_AUDIT_VERSION,
  SITE_PULL_FEEDBACK_SURFACE_INVENTORY_KINDS,
  SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION,
  buildSitePullFeedbackSurfaceInventory,
  buildSitePullFeedbackSurfaceInventoryAudit,
  listSitePullFeedbackSurfaceInventoryRows,
} from './sitePullFeedbackSurfaceInventory.js';
export {
  SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY,
  SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY,
  SITE_PULL_FEEDBACK_SURFACE_PRESENTER_VERSION,
  buildSitePullDomainBadgeFeedbackItems,
  buildSitePullDomainDetailFeedbackItems,
  buildSitePullDomainDiagnosticFeedbackRows,
  buildSitePullDomainFeedbackItems,
  buildSitePullDomainFeedbackSurfaceModel,
  buildSitePullDomainRecapFeedbackCandidates,
} from './sitePullFeedbackSurfacePresenter.js';
export {
  SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SCOPES,
  SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SOURCES,
  SITE_PULL_HABIT_FEEDBACK_CANDIDATE_VERSION,
  buildSitePullHabitFeedbackCandidateModel,
  buildSitePullHabitFeedbackCandidates,
} from './sitePullHabitFeedbackCandidates.js';
export {
  SITE_PULL_PATTERN_COMPOSER_VERSION,
  composeSitePullCompositePatterns,
} from './sitePullPatternComposer.js';
export {
  SITE_PULL_PATTERN_LAYER_VERSION,
  buildSitePullPatternLayers,
} from './sitePullPatternLayers.js';
export {
  SITE_PULL_PATTERN_PRESENTATION_GROUP_LIMITS,
  SITE_PULL_PATTERN_PRESENTATION_SURFACE_LIMITS,
  SITE_PULL_PATTERN_PRESENTER_VERSION,
  presentSitePullPatterns,
} from './sitePullPatternPresenter.js';
export {
  SITE_PULL_PATTERN_DECISION_QUALITY_STATUSES,
  SITE_PULL_PATTERN_DECISION_QUALITY_VERSION,
  buildSitePullPatternDecisionQuality,
} from './sitePullPatternDecisionQuality.js';
export {
  SITE_PULL_AUXILIARY_EVIDENCE_COVERAGE_VERSION,
  SITE_PULL_PATTERN_DIAGNOSTIC_VERSION,
  assertSitePullPatternDiagnosticDataFamily,
  buildSitePullPatternDiagnosticReport,
} from './sitePullPatternDiagnostics.js';
export {
  SITE_PULL_PATTERN_SCENARIO_MATRIX,
  SITE_PULL_PATTERN_SCENARIO_MATRIX_VERSION,
  SITE_PULL_PATTERN_SHADOW_DIAGNOSTIC_VERSION,
  buildSitePullPatternShadowReport,
} from './sitePullPatternScenarioMatrix.js';
export {
  SITE_PULL_HABIT_CONSISTENCY_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_HABIT_CONSISTENCY_STATUSES,
  buildSitePullHabitConsistencyEvidenceProfile,
} from './sitePullHabitConsistencyEvidenceProfile.js';
export {
  SITE_PULL_SUSTAINED_BLOCK_INTERPRETATIONS,
  SITE_PULL_SUSTAINED_BLOCK_PROFILE_VERSION,
  buildSitePullSustainedBlockEvidenceProfile,
} from './sitePullSustainedBlockEvidenceProfile.js';
export {
  SITE_PULL_TAB_CONTEXT_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_TAB_CONTEXT_STATUSES,
  buildSitePullTabContextEvidenceProfile,
} from './sitePullTabContextEvidenceProfile.js';
export {
  SITE_PULL_IMMERSION_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_IMMERSION_STATUSES,
  buildSitePullImmersionEvidenceProfile,
} from './sitePullImmersionEvidenceProfile.js';
export {
  SITE_PULL_INTERVENTION_OUTCOME_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_INTERVENTION_OUTCOME_STATUSES,
  buildSitePullInterventionOutcomeEvidenceProfile,
} from './sitePullInterventionOutcomeEvidenceProfile.js';
export {
  SITE_PULL_NIGHT_PRESSURE_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_NIGHT_PRESSURE_STATUSES,
  buildSitePullNightPressureEvidenceProfile,
} from './sitePullNightPressureEvidenceProfile.js';
export {
  SITE_PULL_ROUTE_PRESSURE_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_ROUTE_PRESSURE_STATUSES,
  buildSitePullRoutePressureEvidenceProfile,
} from './sitePullRoutePressureEvidenceProfile.js';
export {
  SITE_PULL_SESSION_DEPTH_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_SESSION_DEPTH_STATUSES,
  buildSitePullSessionDepthEvidenceProfile,
} from './sitePullSessionDepthEvidenceProfile.js';
export {
  SITE_PULL_TIME_PRESSURE_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_TIME_PRESSURE_STATUSES,
  buildSitePullTimePressureEvidenceProfile,
} from './sitePullTimePressureEvidenceProfile.js';
export {
  SITE_PULL_TREND_PRESSURE_EVIDENCE_PROFILE_VERSION,
  SITE_PULL_TREND_PRESSURE_STATUSES,
  buildSitePullTrendPressureEvidenceProfile,
} from './sitePullTrendPressureEvidenceProfile.js';
export {
  SITE_PULL_PATTERN_REQUIREMENTS,
  SITE_PULL_PATTERN_REQUIREMENTS_VERSION,
  getSitePullPatternRequirement,
  rejectSitePullPattern,
  rejectsDetectorCompositePattern,
  validateSitePullPatternSignal,
  validateSitePullPatternSignals,
} from './sitePullPatternRequirements.js';

function pushSignal(signals, signal) {
  if (!signal?.id) return;
  signals.push(signal);
}

function resolveEntryVisitSummary({ facts = null } = {}) {
  return resolveSitePullEntryVisitSummary({
    facts,
  });
}

function buildSteadyPattern({
  featureVector = {},
  facts = null,
  confidence = 0,
  detectorSignalCount = 0,
} = {}) {
  const todayMs = toNumber(featureVector.todayTotalMs);
  const { todayVisits } = resolveEntryVisitSummary({ facts });
  const weeklyTotalMs = toNumber(featureVector.weeklyTotalMs);
  const activeDays = Math.floor(toNumber(featureVector.activeDays));
  return createSitePullPatternSignal({
    id: 'steady',
    category: SITE_PULL_PATTERN_CATEGORIES.STEADY,
    severity: 'positive',
    tone: 'positive',
    score: 20,
    confidence: 0.7,
    evidence: {
      hasAnyActivity: Boolean(featureVector.hasAnyActivity),
      todayMs,
      todayVisits,
      weeklyTotalMs,
      activeDays,
      confidence: toNumber(confidence),
      confidenceThreshold: 0.35,
      detectorSignalCount,
      stateReason: 'no_detector_patterns',
      interpretation: 'no_strong_pattern_visible',
    },
    recommendedAction: { type: 'maintain', actionId: 'hold_course' },
    source: 'rule',
  });
}

function collectSitePullDetectorSignals({
  featureVector,
  subscores = {},
  confidence = 0,
  facts = null,
  personalBaseline = null,
  checkingEvidenceProfile = null,
  controlledBriefEvidenceProfile = null,
  timePressureEvidenceProfile = null,
  trendPressureEvidenceProfile = null,
  habitConsistencyEvidenceProfile = null,
  nightPressureEvidenceProfile = null,
  routePressureEvidenceProfile = null,
  sustainedBlockEvidenceProfile = null,
  immersionEvidenceProfile = null,
  sessionDepthEvidenceProfile = null,
  interventionOutcomeEvidenceProfile = null,
  backgroundResidencyEvidenceProfile = null,
  contentFlowEvidenceProfile = null,
  tabContextEvidenceProfile = null,
} = {}) {
  const dataSignals = detectDataPatterns({ featureVector, confidence, facts });
  if (dataSignals.some((signal) => signal.id === 'no_activity'
    || signal.evidence.dataQualityStatus === 'unobserved')) {
    return dataSignals;
  }

  const signals = [];
  [
    ...dataSignals,
    ...detectPlanPatterns({ featureVector, facts }),
    ...detectPersonalBaselinePatterns({
      featureVector,
      personalBaseline,
      sessionDepthEvidenceProfile,
    }),
    ...detectSubscorePatterns({
      featureVector,
      subscores,
      facts,
      personalBaseline,
      checkingEvidenceProfile,
      timePressureEvidenceProfile,
      trendPressureEvidenceProfile,
      habitConsistencyEvidenceProfile,
      nightPressureEvidenceProfile,
      sustainedBlockEvidenceProfile,
      immersionEvidenceProfile,
      interventionOutcomeEvidenceProfile,
    }),
    ...detectCheckingPatterns({
      featureVector,
      subscores,
      facts,
      personalBaseline,
      checkingEvidenceProfile,
    }),
    ...detectTransitionEdgePatterns({ featureVector, facts, routePressureEvidenceProfile }),
    ...detectNavigationAndFlowPatterns({
      featureVector,
      facts,
      checkingEvidenceProfile,
      backgroundResidencyEvidenceProfile,
      contentFlowEvidenceProfile,
      tabContextEvidenceProfile,
    }),
    ...detectSessionShapePatterns({
      featureVector,
      subscores,
      facts,
      personalBaseline,
      checkingEvidenceProfile,
      controlledBriefEvidenceProfile,
      routePressureEvidenceProfile,
      sustainedBlockEvidenceProfile,
      timePressureEvidenceProfile,
      interventionOutcomeEvidenceProfile,
    }),
  ].forEach((signal) => pushSignal(signals, signal));

  if (signals.length === 0) {
    signals.push(buildSteadyPattern({
      featureVector,
      facts,
      confidence,
      detectorSignalCount: signals.length,
    }));
  }

  return signals;
}

export function evaluateSitePullPatternLayers(options = {}) {
  const tabContextEvidenceProfile = options.tabContextEvidenceProfile
    || buildSitePullTabContextEvidenceProfile(options);
  const checkingEvidenceProfile = options.checkingEvidenceProfile
    || buildSitePullCheckingEvidenceProfile({ ...options, tabContextEvidenceProfile });
  const timePressureEvidenceProfile = options.timePressureEvidenceProfile
    || buildSitePullTimePressureEvidenceProfile(options);
  const trendPressureEvidenceProfile = options.trendPressureEvidenceProfile
    || buildSitePullTrendPressureEvidenceProfile({
      ...options,
      personalBaseline: options.personalBaseline,
    });
  const habitConsistencyEvidenceProfile = options.habitConsistencyEvidenceProfile
    || buildSitePullHabitConsistencyEvidenceProfile(options);
  const sustainedBlockEvidenceProfile = options.sustainedBlockEvidenceProfile
    || buildSitePullSustainedBlockEvidenceProfile(options);
  const nightPressureEvidenceProfile = options.nightPressureEvidenceProfile
    || buildSitePullNightPressureEvidenceProfile(options);
  const routePressureEvidenceProfile = options.routePressureEvidenceProfile
    || buildSitePullRoutePressureEvidenceProfile(options);
  const controlledBriefEvidenceProfile = options.controlledBriefEvidenceProfile
    || buildSitePullControlledBriefEvidenceProfile(options);
  const immersionEvidenceProfile = options.immersionEvidenceProfile
    || buildSitePullImmersionEvidenceProfile({
      ...options,
      sustainedBlockEvidenceProfile,
    });
  const sessionDepthEvidenceProfile = options.sessionDepthEvidenceProfile
    || buildSitePullSessionDepthEvidenceProfile(options);
  const interventionOutcomeEvidenceProfile = options.interventionOutcomeEvidenceProfile
    || buildSitePullInterventionOutcomeEvidenceProfile(options);
  const backgroundResidencyEvidenceProfile = options.backgroundResidencyEvidenceProfile
    || buildSitePullBackgroundResidencyEvidenceProfile(options);
  const contentFlowEvidenceProfile = options.contentFlowEvidenceProfile
    || buildSitePullContentFlowEvidenceProfile(options);
  const context = {
    ...options,
    checkingEvidenceProfile,
    controlledBriefEvidenceProfile,
    timePressureEvidenceProfile,
    trendPressureEvidenceProfile,
    habitConsistencyEvidenceProfile,
    nightPressureEvidenceProfile,
    routePressureEvidenceProfile,
    sustainedBlockEvidenceProfile,
    immersionEvidenceProfile,
    sessionDepthEvidenceProfile,
    interventionOutcomeEvidenceProfile,
    backgroundResidencyEvidenceProfile,
    contentFlowEvidenceProfile,
    tabContextEvidenceProfile,
  };
  return buildSitePullPatternLayers(collectSitePullDetectorSignals(context), context);
}

export function evaluateSitePullPatterns(options = {}) {
  return evaluateSitePullPatternLayers(options).patterns;
}

export function buildSitePullBadges(patternSignals = [], { limit = 6 } = {}) {
  return rankSitePullPatternsForPresentation(patternSignals)
    .filter((signal) => (
      resolveSitePullPatternFeedbackSurfacePolicy(signal, {
        surface: SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE,
      }).allowed
    ))
    .map((signal) => ({
      id: signal.id,
      severity: signal.severity,
      tone: signal.tone,
      level: signal.level,
      polarity: signal.polarity,
      componentIds: signal.componentIds,
      supportingPatternIds: signal.supportingPatternIds || [],
      suppresses: signal.suppresses,
      presentation: signal.presentation,
      evidence: signal.evidence || {},
      patternId: signal.id,
      category: signal.category,
      score: signal.score,
      confidence: signal.confidence,
      source: signal.source,
      recommendedAction: signal.recommendedAction || null,
      calibration: signal.calibration || null,
      ...(Array.isArray(signal.sourceList) ? { sourceList: signal.sourceList } : {}),
      ...(Number.isFinite(Number(signal.mergedSignalCount))
        ? { mergedSignalCount: Math.max(1, Math.floor(Number(signal.mergedSignalCount))) }
        : {}),
    }))
    .slice(0, Math.max(1, Math.floor(Number(limit) || 6)));
}

export function buildSitePullPatternContext({
  featureVector,
  facts,
} = {}) {
  const entryVisitSummary = resolveEntryVisitSummary({ facts });
  return {
    hasVisitFacts: entryVisitSummary.hasVisitFacts,
    factsVersion: facts?.version || null,
  };
}
