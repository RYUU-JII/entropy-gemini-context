import {
  SITE_PULL_PATTERN_CALIBRATION,
  SITE_PULL_PATTERN_CALIBRATION_VISIBILITY,
} from './sitePullPatternCalibration.js';
import { SITE_PULL_PATTERN_CALIBRATION_DECISION_HINTS } from './sitePullPatternCalibrationAudit.js';
import { SITE_PULL_PATTERN_DEFINITIONS } from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_SPEC,
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
} from './sitePullPatternFeedbackSpec.js';

export const SITE_PULL_PATTERN_THRESHOLD_AUDIT_VERSION = 'site-pull-pattern-threshold-audit-release-v1';

export const SITE_PULL_THRESHOLD_STAGES = Object.freeze({
  COLLECTION: 'collection',
  STORAGE_BUCKET: 'storage_bucket',
  SCORING_CURVE: 'scoring_curve',
  EVIDENCE_STATUS: 'evidence_status',
  REQUIREMENT_GATE: 'requirement_gate',
  CALIBRATION_GATE: 'calibration_gate',
  COMPOSITE_FUSION: 'composite_fusion',
  PRESENTATION_POLICY: 'presentation_policy',
});

export const SITE_PULL_THRESHOLD_SHAPES = Object.freeze({
  HARD_CUT: 'hard_cut',
  SMOOTH_CURVE: 'smooth_curve',
  STEPPED_STATUS: 'stepped_status',
  BUCKET_BOUNDARY: 'bucket_boundary',
  ROBUST_BASELINE: 'robust_baseline',
  SAMPLE_FLOOR: 'sample_floor',
  CONFIDENCE_FLOOR: 'confidence_floor',
  VISIBILITY_POLICY: 'visibility_policy',
  COMPOSITE_CONFIRMATION: 'composite_confirmation',
  CONTEXT_GATE: 'context_gate',
});

export const SITE_PULL_THRESHOLD_GATE_TYPES = Object.freeze({
  COLLECTION_COMPRESSION: 'collection_compression',
  SCORE_NORMALIZATION: 'score_normalization',
  LABEL_CANDIDATE: 'label_candidate',
  LABEL_REQUIREMENT: 'label_requirement',
  LABEL_CALIBRATION: 'label_calibration',
  PRESENTATION: 'presentation',
});

const {
  COLLECTION,
  STORAGE_BUCKET,
  SCORING_CURVE,
  EVIDENCE_STATUS,
  REQUIREMENT_GATE,
  CALIBRATION_GATE,
  COMPOSITE_FUSION,
  PRESENTATION_POLICY,
} = SITE_PULL_THRESHOLD_STAGES;

const {
  HARD_CUT,
  SMOOTH_CURVE,
  STEPPED_STATUS,
  BUCKET_BOUNDARY,
  ROBUST_BASELINE,
  SAMPLE_FLOOR,
  CONFIDENCE_FLOOR,
  VISIBILITY_POLICY,
  COMPOSITE_CONFIRMATION,
  CONTEXT_GATE,
} = SITE_PULL_THRESHOLD_SHAPES;

const {
  COLLECTION_COMPRESSION,
  SCORE_NORMALIZATION,
  LABEL_CANDIDATE,
  LABEL_REQUIREMENT,
  LABEL_CALIBRATION,
  PRESENTATION,
} = SITE_PULL_THRESHOLD_GATE_TYPES;

const { BADGE } = SITE_PULL_PATTERN_FEEDBACK_SURFACES;

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function freezeObject(value = {}) {
  return Object.freeze({ ...value });
}

function threshold({
  id,
  stage,
  shape,
  signal,
  gateType,
  source,
  unit = null,
  value = null,
  range = null,
  buckets = null,
  curveGroup = null,
  rationale = '',
  concerns = [],
  tuningSurface = 'threshold',
  owner = null,
} = {}) {
  return Object.freeze({
    id,
    stage,
    shape,
    signal,
    gateType,
    source,
    unit,
    value,
    range: range ? freezeObject(range) : null,
    buckets: buckets ? freezeArray(buckets.map(freezeObject)) : null,
    curveGroup,
    rationale,
    concerns: freezeArray(concerns),
    tuningSurface,
    owner,
  });
}

function patternThresholdSpec({ thresholds = [], notes = [] } = {}) {
  return Object.freeze({
    thresholds: freezeArray(thresholds),
    notes: freezeArray(notes),
  });
}

const REENTRY_BUCKETS = Object.freeze([
  { from: 0, to: 2, unit: 'minutes', label: '0-2m' },
  { from: 2, to: 5, unit: 'minutes', label: '2-5m' },
  { from: 5, to: 10, unit: 'minutes', label: '5-10m' },
  { from: 10, to: 30, unit: 'minutes', label: '10-30m' },
  { from: 30, to: 120, unit: 'minutes', label: '30-120m' },
]);

const SHARED_REENTRY_BUCKET_THRESHOLD = threshold({
  id: 'collection.reentry_gap_buckets',
  stage: STORAGE_BUCKET,
  shape: BUCKET_BOUNDARY,
  signal: 'reentryGapBuckets',
  gateType: COLLECTION_COMPRESSION,
  source: 'statsAggregator.resolveReentryGapBucketKey',
  unit: 'minutes',
  buckets: REENTRY_BUCKETS,
  curveGroup: 'reentry_interval',
  rationale: 'Stores interval shape without raw timestamp samples.',
  concerns: ['wide_tail_bucket_30_to_120m', 'not_lossless_event_history'],
  tuningSurface: 'collection',
});

const SHARED_SESSION_COLLECTION_THRESHOLD = threshold({
  id: 'collection.session_duration_classes',
  stage: COLLECTION,
  shape: HARD_CUT,
  signal: 'session.durationMs',
  gateType: COLLECTION_COMPRESSION,
  source: 'statsAggregator.incrementDomainSession',
  unit: 'minutes',
  value: { shortBelow: 2, longAtLeast: 20 },
  curveGroup: 'session_duration',
  rationale: 'Keeps compact short/long session counters; average/max duration still remain available.',
  concerns: ['short_session_boundary_is_hard_cut'],
  tuningSurface: 'collection',
});

const SHARED_TAB_COLLECTION_THRESHOLD = threshold({
  id: 'collection.high_open_tab_count',
  stage: COLLECTION,
  shape: HARD_CUT,
  signal: 'totalOpenTabs',
  gateType: COLLECTION_COMPRESSION,
  source: 'statsAggregator.recordDomainTabContext',
  unit: 'tabs',
  value: 12,
  curveGroup: 'tab_context_pressure',
  rationale: 'Captures coarse high-tab pressure while maxOpenTabs remains available for later thresholds.',
  concerns: ['single_browser_wide_tab_threshold'],
  tuningSurface: 'collection',
});

const SHARED_BACKGROUND_RESIDENCY_COLLECTION_THRESHOLD = threshold({
  id: 'collection.background_residency_pressure',
  stage: COLLECTION,
  shape: BUCKET_BOUNDARY,
  signal: 'backgroundPressure.elapsedMs',
  gateType: COLLECTION_COMPRESSION,
  source: 'trackingTabActivityBatchSettlementHelpers.buildBackgroundDomainPressureMap',
  unit: 'minutes',
  buckets: [
    { from: 0, to: 2, unit: 'minutes', label: 'ignored_linger_grace' },
    { from: 2, to: 7, unit: 'minutes', label: 'background_linger' },
    { from: 7, to: null, unit: 'minutes', label: 'stale_background' },
  ],
  curveGroup: 'background_residency',
  rationale: 'Aggregates background pressure per domain so same-domain background tabs do not multiply residency duration.',
  concerns: ['overlapping_pressure_channels', 'domain_level_background_dedupe_required'],
  tuningSurface: 'collection',
});

const SHARED_INTERVENTION_REENTRY_THRESHOLD = threshold({
  id: 'collection.intervention_reentry_windows',
  stage: COLLECTION,
  shape: BUCKET_BOUNDARY,
  signal: 'intervention.reentryElapsedMs',
  gateType: COLLECTION_COMPRESSION,
  source: 'statsAggregator.recordDomainIntervention',
  unit: 'minutes',
  buckets: [
    { from: 0, to: 5, unit: 'minutes', label: '0-5m' },
    { from: 5, to: 30, unit: 'minutes', label: '5-30m' },
  ],
  curveGroup: 'intervention_reentry',
  rationale: 'Separates immediate reentry from broader same-cycle resistance.',
  concerns: ['no_30_to_120m_intervention_tail'],
  tuningSurface: 'collection',
});

export const SITE_PULL_PATTERN_THRESHOLD_SPECS = Object.freeze({
  no_activity: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'state.no_activity.hasAnyActivity_false',
        stage: REQUIREMENT_GATE,
        shape: HARD_CUT,
        signal: 'featureVector.hasAnyActivity',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.no_activity',
        value: false,
        rationale: 'Exclusive state should stay simple and diagnosable.',
        tuningSurface: 'gate',
      }),
    ],
  }),
  insufficient_data: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'state.insufficient_data.activity_context',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'featureVector.hasAnyActivity|todayTotalMs|weeklyTotalMs',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.insufficient_data',
        value: { requiresActivity: true },
        curveGroup: 'data_quality',
        rationale: 'Low-confidence state still requires some activity signal; no-activity owns the empty case.',
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'state.insufficient_data.confidence',
        stage: REQUIREMENT_GATE,
        shape: HARD_CUT,
        signal: 'confidence',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.insufficient_data',
        value: { below: 0.35 },
        curveGroup: 'data_quality',
        rationale: 'Low confidence state is a gate, not a behavior claim.',
        tuningSurface: 'presentation',
      }),
      threshold({
        id: 'state.insufficient_data.reason_marker',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'pattern.evidence.stateReason',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.insufficient_data',
        value: 'insufficient_data',
        curveGroup: 'data_quality',
        rationale: 'Requires the detector-owned sparse-data marker instead of accepting arbitrary neutral labels.',
        tuningSurface: 'gate',
      }),
    ],
  }),
  steady: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'state.steady.confidence',
        stage: REQUIREMENT_GATE,
        shape: CONFIDENCE_FLOOR,
        signal: 'confidence',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.steady',
        value: { atLeast: 0.35 },
        curveGroup: 'steady_state',
        rationale: 'Steady is only shown when the model has enough confidence to say no strong pattern is visible.',
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'state.steady.detector_empty',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'pattern.evidence.detectorSignalCount|patternIndex',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.steady',
        value: { detectorSignalCount: 0, noOtherPatterns: true },
        curveGroup: 'steady_state',
        rationale: 'Prevents steady from coexisting with behavior labels or being injected without collector fallback evidence.',
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'state.steady.reason_marker',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'pattern.evidence.stateReason',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.steady',
        value: 'no_detector_patterns',
        curveGroup: 'steady_state',
        rationale: 'Keeps the label meaning limited to a collector fallback, not a generic health claim.',
        tuningSurface: 'copy',
      }),
    ],
  }),
  time_heavy_today: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'score.time_pressure.today_duration',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'todayTotalMs',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullScoreModel.computeTimePressure',
        unit: 'minutes',
        range: { low: 5, high: 120 },
        curveGroup: 'time_pressure',
        rationale: 'Absolute use time contributes gradually before label gates apply.',
      }),
      threshold({
        id: 'requirement.time_pressure_subscore',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'subscores.timePressure+timePressureChannelIds',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullPatternRequirements.time_heavy_today',
        value: {
          scoreAtLeast: 0.7,
          orChannels: [
            'time_pressure_score',
            'absolute_duration',
            'weekly_lift',
            'personal_baseline_lift',
          ],
        },
        curveGroup: 'time_pressure',
        concerns: ['in_progress_day_context'],
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'gate.time_pressure_profile.visible',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'todayMs+timePressureScore+timePressureStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullTimePressureEvidenceProfile',
        value: {
          todayAtLeastMinutes: 5,
          timePressureAtLeast: 0.7,
          absoluteDurationAtLeastMinutes: 90,
          contextualDurationAtLeastMinutes: 45,
          statuses: [
            'heavy_time_today',
            'unusually_heavy_for_you',
          ],
        },
        curveGroup: 'time_pressure',
        concerns: ['in_progress_day_context'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  personal_spike: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'baseline.personal_spike.robust_time_anomaly',
        stage: SCORING_CURVE,
        shape: ROBUST_BASELINE,
        signal: 'todayMs vs median/p75/p90/MAD',
        gateType: SCORE_NORMALIZATION,
        source: 'personalBaselineCore.buildPersonalBaselineMetricProfile:active_ms.anomaly',
        value: {
          confidenceAtLeast: 0.35,
          stableConfidenceAtLeast: 0.65,
          scoreAtLeast: 0.65,
          formingScoreAtLeast: 0.82,
          minTodayMinutes: 5,
        },
        curveGroup: 'personal_baseline_time',
        rationale: 'Personal spike should be a self-baseline anomaly, not just a large absolute duration.',
        tuningSurface: 'threshold',
      }),
      threshold({
        id: 'gate.personal_spike.channels',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'relative_lift+robust_z_lift+p90_breach',
        gateType: LABEL_REQUIREMENT,
        source: 'baselinePatterns.buildPersonalSpikeEvidence',
        value: {
          minChannelCount: 1,
          relativeLiftRatioAtLeast: 2,
          robustZAtLeast: 2,
          p90BreachRatioAtLeast: 1.15,
        },
        curveGroup: 'personal_baseline_time',
        concerns: ['forming_baseline_requires_stronger_score'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  checking_pattern: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'score.checking_loop.return_family',
        stage: SCORING_CURVE,
        shape: CONTEXT_GATE,
        signal: 'visit_return+switch_return+route_return',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullScoreModel.computeCheckingLoopWithVisits',
        value: {
          measuredCombination: 'max(weightedVisit,weightedSwitch,weightedRoute)',
          measuredWeights: { visit: 0.2, switch: 0.31, route: 0.12 },
          baselineCombination: 'max(weightedRevisit,weightedQuickReturn,weightedChurn)',
          baselineWeights: { revisit: 0.3, quickReturn: 0.24, churn: 0.14 },
          contentFlowCombination: 'max(weightedSkim,weightedAdvance,weightedScroll,weightedScreenfuls)',
        },
        curveGroup: 'checking_loop',
        rationale: 'Counters can project the same event; no additive alias or loop-synergy bonus.',
        concerns: ['conservative_overlap_bound_not_event_deduplication', 'weights_need_field_validation'],
      }),
      threshold({
        id: 'score.checking_loop.small_sample',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'returnCount+measuredSessionCount',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullScoreModel.computeCheckingLoopWithVisits',
        value: { returnCount: { low: 1, high: 4 }, measuredSessionCount: { low: 2, high: 6 } },
        curveGroup: 'checking_loop',
        rationale: 'A 1/1 return or 2/2 short-session ratio cannot saturate repeated-checking intensity.',
      }),
      threshold({
        id: 'score.checking_loop.visit_density',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'todayVisitsPerActiveHour',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullScoreModel.computeCheckingLoopWithVisits',
        range: { low: 2, high: 8 },
        curveGroup: 'checking_loop',
        rationale: 'Visit density is curved before status and requirement gates.',
      }),
      threshold({
        id: 'status.checking_loop.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'subscores.checkingLoop',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildCheckingLoopEvidence',
        value: { weak: 0.25, candidate: 0.4, strong: 0.7 },
        curveGroup: 'checking_loop',
      }),
    ],
  }),
  checking_pattern_proxy: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'status.checking_loop_proxy.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'subscores.checkingLoop',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildCheckingLoopEvidence',
        value: { weak: 0.4, candidate: 0.55, strong: 0.75 },
        curveGroup: 'checking_loop_proxy',
        concerns: ['proxy_requires_soft_copy'],
      }),
    ],
  }),
  reentry_spike: patternThresholdSpec({
    thresholds: [
      SHARED_REENTRY_BUCKET_THRESHOLD,
      threshold({
        id: 'baseline.reentry_anomaly',
        stage: SCORING_CURVE,
        shape: ROBUST_BASELINE,
        signal: 'personalBaseline.revisitAnomalyScore',
        gateType: SCORE_NORMALIZATION,
        source: 'personalBaseline.computeSitePullPersonalBaseline',
        value: { confidenceAtLeast: 0.35, anomalyAtLeast: 0.55 },
        curveGroup: 'reentry_interval',
        rationale: 'Baseline anomaly uses robust personal p75/p90/MAD-style references.',
      }),
    ],
  }),
  quick_return_loop: patternThresholdSpec({
    thresholds: [
      SHARED_REENTRY_BUCKET_THRESHOLD,
      threshold({
        id: 'status.quick_return.behavior_candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'impulseWeightedSwitchCount/switchIns',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildQuickReturnEvidence',
        value: {
          bucketWeights: {
            switch0To2m: 1,
            switch2To5m: 0.72,
            switch5To10m: 0.38,
            switch10To30m: 0.08,
            switch30To120m: 0.02,
          },
          weak: { impulseWeightedSwitchCount: 0.65, switchIns: 2 },
          candidate: { impulseWeightedSwitchCount: 1.2, switchIns: 3, weightedRate: 0.3 },
          strong: { impulseWeightedSwitchCount: 2.4, switchIns: 5, weightedRate: 0.45 },
          coarseCounterGate: { switchBackWithin10m: 2, switchIns: 3, rate: 0.3 },
          baselineCandidate: { scoreAtLeast: 0.55, confidenceAtLeast: 0.35, switchIns: 3, switchBackWithin10m: 2 },
          baselineStrong: { scoreAtLeast: 0.75, confidenceAtLeast: 0.5, switchIns: 5, switchBackWithin10m: 4 },
          compositeSupport: { switchIns: 2, switchBackWithin10m: 1 },
        },
        curveGroup: 'impulse_reentry',
        rationale: 'Treats quick return as an impulse primitive: immediate switch-backs carry more weight than later 5-10m returns.',
        concerns: ['coarse_counter_without_bucket_shape', 'bucket_weight_initial_values_need_field_validation'],
      }),
    ],
  }),
  switch_churn_loop: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'status.switch_churn.behavior_candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'switchIns+switchOuts per entrance',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildSwitchChurnEvidence',
        value: {
          weak: { switchChurn: 4, churnPerEntrance: 0.7 },
          candidate: { switchChurn: 8, churnPerEntrance: 1.2 },
          strong: { switchChurn: 12, churnPerEntrance: 1.8 },
        },
        curveGroup: 'switch_churn',
      }),
    ],
  }),
  checking_carousel: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'fusion.checking_carousel.core_support',
        stage: COMPOSITE_FUSION,
        shape: COMPOSITE_CONFIRMATION,
        signal: 'candidate_pressure+two_current_observation_dimensions',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullPatternComposer.composeCheckingCarousel',
        value: {
          requiredComponents: ['primary_checking_pressure'],
          currentDimensionAtLeast: 2,
          currentDimensionAnyOf: [
            'attention_switching',
            'entry_distribution',
            'session_shape',
            'navigation_entry',
          ],
          quickReturnRole: 'shadow_support_enhancer',
        },
        curveGroup: 'checking_carousel',
        rationale: 'Multiple current observation dimensions can describe the same events. Their maximum summarizes same-day use without claiming an ordered loop.',
        concerns: ['dimensions_may_share_events', 'fixed_confidence_needs_field_validation'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  session_fragmentation: patternThresholdSpec({
    thresholds: [
      SHARED_SESSION_COLLECTION_THRESHOLD,
      threshold({
        id: 'status.session_fragmentation.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'sessionCount+shortSessionCount+shortRate',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildSessionFragmentationEvidence',
        unit: 'mixed',
        value: {
          weak: { sessionCount: 4, shortSessionCount: 2, shortRate: 0.4 },
          candidate: { currentMeasuredSessionRequired: true, sessionCount: 6, shortSessionCount: 4, shortRate: 0.55 },
          strong: { currentMeasuredSessionRequired: true, sessionCount: 8, shortSessionCount: 6, shortRate: 0.7 },
        },
        curveGroup: 'session_fragmentation',
        concerns: ['multi_condition_step_gate'],
      }),
    ],
  }),
  deep_immersion: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.deep_immersion.duration_concentration',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'sustainedBlockMs+durationConcentrationScore+absorptionScore',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullImmersionEvidenceProfile',
        value: {
          currentMeasuredSessionRequired: true,
          todayAtLeastMinutes: 35,
          sustainedBlockAtLeastMinutes: 30,
          durationConcentrationAtLeast: 0.42,
          absorptionAtLeast: 0.58,
        },
        curveGroup: 'immersion_absorption_shape',
        concerns: ['multi_signal_gate'],
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'gate.deep_immersion.absorption_support',
        stage: COMPOSITE_FUSION,
        shape: CONTEXT_GATE,
        signal: 'absorptionSupportChannelIds',
        gateType: LABEL_REQUIREMENT,
        source: 'sitePullImmersionEvidenceProfile',
        value: {
          consumptionContinuityAtLeast: 0.32,
          returnContextAtLeast: 0.48,
          supportChannels: [
            'feed_continuity',
            'navigation_continuity',
            'same_day_returns',
          ],
          feedCountersAreSupportingEvidence: true,
        },
        curveGroup: 'immersion_absorption_support',
        concerns: ['feed_counter_site_dependent', 'day_level_context_not_linked_to_session', 'intent_not_observed'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  focused_block: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.focused_block.duration_and_share',
        stage: REQUIREMENT_GATE,
        shape: HARD_CUT,
        signal: 'sustainedBlockMs+blockShare',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullSustainedBlockEvidenceProfile',
        value: { currentMeasuredSessionRequired: true, todayAtLeastMinutes: 25, sustainedBlockAtLeastMinutes: 20, blockShareAtLeast: 0.55 },
        curveGroup: 'sustained_block_shape',
        concerns: ['contextual_label_hard_gate'],
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'fusion.focused_block.interpretation',
        stage: COMPOSITE_FUSION,
        shape: CONTEXT_GATE,
        signal: 'driftScore+switchChurn',
        gateType: PRESENTATION,
        source: 'sitePullSustainedBlockEvidenceProfile',
        value: {
          withSwitching: { driftAtLeast: 0.55, switchChurnAtLeast: 4 },
          valence: 'neutral', intentAssessment: 'not_observed',
        },
        curveGroup: 'focus_interpretation',
        concerns: ['same_day_context_not_session_sequence'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  session_depth_spike: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.session_depth_spike.personal_baseline',
        stage: REQUIREMENT_GATE,
        shape: ROBUST_BASELINE,
        signal: 'sessionDepthAnomalyScore+sessionConfidence+todayVsMaxSessionReferenceRatio',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullSessionDepthEvidenceProfile',
        value: {
          sessionConfidenceAtLeast: 0.35,
          currentMeasuredSessionRequired: true,
          sampleSource: 'max_session_ms',
          descriptiveLongSessionLiftRequiresPositiveObservedP75: true,
          anomalyScoreAtLeast: 0.6,
          minChannelCount: 1,
          relativeDepthRatioAtLeast: 1.5,
          robustZAtLeast: 1.8,
          p90BreachRatioAtLeast: 1.15,
          absoluteDepthAtLeastMinutes: 60,
          clearStatus: 'clear_session_depth_spike',
          extremeStatus: 'extreme_session_depth_spike',
        },
        curveGroup: 'session_depth_baseline',
        concerns: ['shadow_context_label', 'baseline_sample_sensitive'],
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'presentation.session_depth_spike.shadow',
        stage: PRESENTATION_POLICY,
        shape: VISIBILITY_POLICY,
        signal: 'calibration.visibility',
        gateType: PRESENTATION,
        source: 'sitePullPatternCalibration',
        value: 'shadow',
        curveGroup: 'presentation_visibility',
        rationale: 'Session-depth spikes are retained for recaps and supporting context without competing with primary daily badges.',
        concerns: ['not_primary_badge'],
        tuningSurface: 'presentation',
      }),
    ],
  }),
  controlled_brief_check: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.controlled_brief_check.profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'todayMs+visitOrSessionCount+controlledBriefScore+measuredSessionShape',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullControlledBriefEvidenceProfile',
        value: {
          todayMinutes: { min: 2, max: 12 },
          visitOrSessionCount: { min: 1, max: 3 },
          averageSessionAtMostMinutes: 5,
          controlledBriefScoreAtLeast: 0.62,
          currentMeasuredSessionRequired: true, averageSessionAboveZero: true,
          maxSessionAtMostMinutes: 5,
          statuses: ['brief_check_observed', 'brief_check_with_returns'],
        },
        curveGroup: 'controlled_brief_use',
        concerns: ['intent_not_observed', 'measured_session_required'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  habitual_entry: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'status.habitual_entry.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'typedEntrances/directEntryShare',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildNavigationEvidence',
        value: {
          weak: [
            { directEntryCount: 2, directEntryShare: 0.2 },
            { directEntryCount: 1, directEntryShare: 0.25 },
          ],
          candidate: [
            { directEntryCount: 3, directEntryShare: 0.35 },
            { directEntryCount: 2, directEntryShare: 0.55 },
          ],
          strong: [
            { directEntryCount: 5, directEntryShare: 0.45 },
            { directEntryCount: 4, directEntryShare: 0.65 },
          ],
        },
        curveGroup: 'navigation_entry',
      }),
    ],
  }),
  reload_checking: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'status.reload_checking.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'reloads/reloadShare',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildNavigationEvidence',
        value: {
          weak: [
            { reloads: 2, reloadShare: 0.15 },
            { reloads: 1, reloadShare: 0.3 },
          ],
          candidate: [
            { reloads: 3, reloadShare: 0.25 },
            { reloads: 2, reloadShare: 0.45 },
          ],
          strong: [
            { reloads: 5, reloadShare: 0.35 },
            { reloads: 4, reloadShare: 0.5 },
          ],
        },
        curveGroup: 'reload_checking',
      }),
    ],
  }),
  new_tab_loop: patternThresholdSpec({
    thresholds: [
      SHARED_TAB_COLLECTION_THRESHOLD,
      threshold({
        id: 'status.new_tab_loop.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'newTabEntrances/newTabShare',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildTabContextEvidence',
        value: {
          weak: { newTabEntrances: 1, share: 0.15 },
          candidate: { newTabEntrances: 2, share: 0.3 },
          strong: { newTabEntrances: 4, share: 0.5 },
        },
        curveGroup: 'tab_context',
      }),
    ],
  }),
  duplicate_tab_entry: patternThresholdSpec({
    thresholds: [
      SHARED_TAB_COLLECTION_THRESHOLD,
      threshold({
        id: 'status.duplicate_tab_entry.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'duplicateTabEntrances+maxSameDomainOpenTabs',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildTabContextEvidence',
        value: {
          weak: { duplicateTabEntrances: 1, maxSameDomainOpenTabs: 2 },
          candidate: { duplicateTabEntrances: 2, maxSameDomainOpenTabs: 2 },
          strong: { duplicateTabEntrances: 4, maxSameDomainOpenTabs: 3 },
        },
        curveGroup: 'tab_context',
      }),
    ],
  }),
  tab_queue_pattern: patternThresholdSpec({
    thresholds: [
      SHARED_TAB_COLLECTION_THRESHOLD,
      threshold({
        id: 'gate.tab_queue.profile',
        stage: COMPOSITE_FUSION,
        shape: CONTEXT_GATE,
        signal: 'tabQueueScore+tabQueueChannelCount+tabContextStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullTabContextEvidenceProfile',
        value: {
          tabQueueScoreAtLeast: 0.58,
          tabQueueChannelCountAtLeast: 2,
          allowsStrongSameDomainQueue: true,
          statuses: [
            'new_tab_queue',
            'same_domain_tab_queue',
          ],
        },
        curveGroup: 'tab_context_pressure',
        rationale: 'Summarizes site-specific tab observations by maximum strength. Browser-wide context is diagnostic only; queue intent is unknown.',
        concerns: ['browser_wide_context_is_support_only', 'new_tab_alone_is_ambiguous'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  tab_hoarding_context: patternThresholdSpec({
    thresholds: [
      SHARED_TAB_COLLECTION_THRESHOLD,
      threshold({
        id: 'status.tab_hoarding_context.candidate',
        stage: EVIDENCE_STATUS,
        shape: STEPPED_STATUS,
        signal: 'highOpenTabEntrances or maxOpenTabs',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullCheckingEvidenceProfile.buildTabContextEvidence',
        value: {
          weak: { highOpenTabEntrances: 1, maxOpenTabs: 12 },
          candidate: { highOpenTabEntrances: 2, maxOpenTabs: 20 },
          strong: { highOpenTabEntrances: 3, maxOpenTabs: 24 },
        },
        curveGroup: 'tab_context_pressure',
        concerns: ['browser_wide_context_label'],
      }),
    ],
  }),
  background_residency: patternThresholdSpec({
    thresholds: [
      SHARED_BACKGROUND_RESIDENCY_COLLECTION_THRESHOLD,
      threshold({
        id: 'gate.background_residency.profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'backgroundResidencyScore+maxChannelResidencyMs+status',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullBackgroundResidencyEvidenceProfile',
        value: {
          scoreAtLeast: 0.58,
          todayResidencyAtLeastMinutes: 15,
          weeklyResidencyAtLeastMinutes: 90,
          staleAtLeastMinutes: 8,
          mediaAtLeastMinutes: 20,
          visibleStatuses: [
            'background_linger_observed',
            'stale_background_residency',
            'background_media_residency',
            'recurring_background_residency', 'weekly_background_observed',
          ],
          recurringObservedDaysAtLeast: 3, recurringDailyChannelAtLeastMinutes: 5,
        },
        curveGroup: 'background_residency',
        rationale: 'Treats media, linger, and stale as overlapping pressure channels; intensity uses max(normalized channel). Duration is max(channel), not unique elapsed time or attention.',
        concerns: ['pressure_channels_are_not_additive_duration'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  feed_skimming: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'support.feed_skimming.content_flow_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'feedSkimSignals+skimScore',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullContentFlowEvidenceProfile',
        value: {
          feedSkimSignalsAtLeast: 1,
          skimScoreAtLeast: 0.25,
          visibility: 'shadow_support',
        },
        curveGroup: 'content_flow',
        rationale: 'Skimming is a descriptive feed progression projection and remains diagnostic support.',
        concerns: ['feed_counter_site_dependent', 'not_user_facing_standalone'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  feed_loop_pattern: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.feed_loop.content_flow_profile',
        stage: COMPOSITE_FUSION,
        shape: CONTEXT_GATE,
        signal: 'contentFlowScore+corroboratingEvidenceFamilyCount+contentFlowStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullContentFlowEvidenceProfile',
        value: {
          contentFlowScoreAtLeast: 0.58,
          corroboratingEvidenceFamilyCountAtLeast: 2,
          currentProducerFamilyCountAtMost: 1,
          statuses: [
            'feed_supply_context',
          ],
        },
        curveGroup: 'content_flow',
        rationale: 'A loop needs independent evidence families. Current supply, skim, and scroll projections share feed progression lineage, so the current producer cannot emit this composite.',
        concerns: ['feed_counter_site_dependent', 'requires_independent_evidence_families', 'current_feed_loop_evidence_insufficient'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  fast_scroll_bursts: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'support.fast_scroll.content_flow_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'scrollVelocityChannel+scrollVelocityScore',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullContentFlowEvidenceProfile',
        value: {
          scrollVelocityChannel: true,
          scrollVelocityScoreAtLeast: 0.25,
          visibility: 'shadow_support',
        },
        curveGroup: 'content_flow',
        rationale: 'Fast scrolling is ambiguous and shares lineage with feed progression, so it remains diagnostic support.',
        concerns: ['scroll_velocity_without_intent', 'not_user_facing_standalone'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  daily_habit: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'score.habit_regularity.weekly_shape',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'activeDayRate+streakRate+dailyVolumeConsistency',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullScoreModel.computeHabitRegularity',
        range: { weeklyTotalMinutesLow: 15, weeklyTotalMinutesHigh: 180 },
        curveGroup: 'habit_regularity',
      }),
      threshold({
        id: 'gate.daily_habit.habit_consistency_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'activeDays+habitConsistencyScore+habitStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullHabitConsistencyEvidenceProfile',
        value: {
          observedDaysAtLeast: 5, activeDaysAtLeast: 4,
          habitConsistencyAtLeast: 0.62,
          statuses: [
            'daily_touchpoint',
            'consistent_daily_habit',
          ],
        },
        curveGroup: 'habit_regularity',
        concerns: ['low_volume_habit', 'hourly_aggregate_not_daily_recurrence'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  rising_trend: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'score.trend_acceleration.ratio',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'recentTrajectory.risingScore',
        gateType: SCORE_NORMALIZATION,
        source: 'personalBaselinePolicy.buildSitePullRecentTrajectory',
        range: { lowRatio: 1.18, highRatio: 1.75 },
        curveGroup: 'temporal_trend',
        rationale: 'The canonical Site Pull recent trajectory is curved once before the final label gate.',
      }),
      threshold({
        id: 'gate.rising_trend.trend_pressure_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'trendPressureScore+trendPressureStatus+trendRatio+personalTrendAnomalyScore',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullTrendPressureEvidenceProfile',
        value: {
          trendPressureAtLeast: 0.6, comparisonDays: 7,
          singleDaySpikeVetoAtLeast: 0.62, confidenceCeiling: 'recentTrajectory.confidence',
          statuses: [
            'recent_rise_observed',
            'sustained_rising_trend',
            'personal_trend_shift',
          ],
          excludes: ['single_day_spike_like'],
        },
        curveGroup: 'temporal_trend',
        concerns: ['single_day_spike_like', 'partial_week_window'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  late_night: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'score.circadian_risk.night_usage',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'nightMsToday+nightShareToday',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullScoreModel.computeCircadianRisk',
        range: { nightMinutesLow: 5, nightMinutesHigh: 45, nightShareLow: 0.2, nightShareHigh: 0.6 },
        curveGroup: 'circadian_risk',
      }),
      threshold({
        id: 'gate.late_night.night_pressure_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'nightMsToday+circadianRiskScore+nightPressureStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullNightPressureEvidenceProfile',
        value: {
          nightAtLeastMinutes: 5,
          circadianRiskAtLeast: 0.55,
          statuses: [
            'night_usage_observed',
            'late_night_cluster',
            'heavy_late_hour_use',
          ],
        },
        curveGroup: 'night_pressure',
        concerns: ['fixed_clock_window_not_personal_sleep'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  late_night_binge: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.late_night_binge.night_pressure_profile',
        stage: COMPOSITE_FUSION,
        shape: CONTEXT_GATE,
        signal: 'nightPressureScore+durationPressureScore+durationContextScore',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullNightPressureEvidenceProfile',
        value: {
          nightAtLeastMinutes: 15,
          nightPressureAtLeast: 0.62, durationContextBasis: 'night-window-only',
          supportAnyOf: {
            durationPressureAtLeast: 0.5,
            durationContextAtLeast: 0.45,
          },
        },
        curveGroup: 'night_pressure',
        concerns: ['fixed_clock_window_not_personal_sleep', 'in_progress_day_context'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  protected_route_return: patternThresholdSpec({
    thresholds: [
      SHARED_REENTRY_BUCKET_THRESHOLD,
      threshold({
        id: 'gate.protected_route_return.route_pressure_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'incomingCount+incomingReturnWithin10m+protectedReturnScore+routeStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullRoutePressureEvidenceProfile',
        value: {
          incomingCountAtLeast: 3,
          incomingReturnWithin10mAtLeast: 2,
          protectedReturnScoreAtLeast: 0.55,
          statuses: ['protected_route_return', 'protected_route_carousel'],
        },
        curveGroup: 'transition_edges',
        concerns: ['transition_edge_sample_floor', 'target_direction_required'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  domain_pair_loop: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.domain_pair_loop.route_pressure_profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'topPairCount+topPairReturnWithin10m+pairLoopScore',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullRoutePressureEvidenceProfile',
        value: { topPairCountAtLeast: 2, pairLoopScoreAtLeast: 0.3 },
        curveGroup: 'transition_edges',
        concerns: ['pair_context_not_final_habit_claim'],
        tuningSurface: 'gate',
      }),
    ],
  }),
  loop_route_hint: patternThresholdSpec({
    thresholds: [
      threshold({
        id: 'gate.loop_route_hint.route_pressure_profile',
        stage: COMPOSITE_FUSION,
        shape: CONTEXT_GATE,
        signal: 'todayCount+todayDistinctEdgeCount+routePressureScore+routeStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullRoutePressureEvidenceProfile',
        value: {
          todayCountAtLeast: 6,
          todayDistinctEdgeCountAtLeast: 3,
          routePressureScoreAtLeast: 0.55,
          statuses: ['multi_edge_route_loop', 'protected_route_carousel'],
        },
        curveGroup: 'transition_edges',
        concerns: ['multi_edge_sample_floor', 'protected_return_may_dominate_presentation'],
        tuningSurface: 'fusion',
      }),
    ],
  }),
  intervention_reentry: patternThresholdSpec({
    thresholds: [
      SHARED_INTERVENTION_REENTRY_THRESHOLD,
      threshold({
        id: 'gate.intervention_reentry.profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'interventionOutcomeStatus+interventionReentryScore+selected reentry counts',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullInterventionOutcomeEvidenceProfile',
        value: {
          interventionReentryScoreAtLeast: 55,
          statuses: [
            'intervention_reentry_observed',
            'repeated_intervention_reentry',
            'mixed_intervention_outcome',
          ],
        },
        curveGroup: 'intervention_reentry',
        concerns: ['small_sample_reentry_may_be_contextual'],
        tuningSurface: 'gate',
      }),
      threshold({
        id: 'score.intervention_resistance.reentry',
        stage: SCORING_CURVE,
        shape: SMOOTH_CURVE,
        signal: 'selected_cohort reenteredWithin30m per frictionShown',
        gateType: SCORE_NORMALIZATION,
        source: 'sitePullInterventionFacts.computeSitePullInterventionReentryIntensity',
        range: {
          reentry30mRateLow: 0.15,
          reentry30mRateHigh: 0.8,
          todayMinimumShownAndReturns: 2,
          weeklyMinimumShown: 3,
        },
        curveGroup: 'intervention_reentry',
      }),
    ],
  }),
  intervention_recovery: patternThresholdSpec({
    thresholds: [
      SHARED_INTERVENTION_REENTRY_THRESHOLD,
      threshold({
        id: 'gate.intervention_recovery.profile',
        stage: REQUIREMENT_GATE,
        shape: CONTEXT_GATE,
        signal: 'today effectivenessEligible left count+interventionOutcomeStatus',
        gateType: LABEL_CANDIDATE,
        source: 'sitePullInterventionOutcomeEvidenceProfile',
        value: {
          todayShownAtLeast: 2, todayLeftAtLeast: 2,
          status: 'intervention_leave_observed',
        },
        curveGroup: 'intervention_recovery',
        concerns: ['followup_maturity_unavailable'],
      }),
    ],
  }),
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
    .sort();
}

function countBy(rows, key) {
  return rows.reduce((summary, row) => {
    const value = typeof row?.[key] === 'string' && row[key].length > 0
      ? row[key]
      : `missing:${key}`;
    summary[value] = (summary[value] || 0) + 1;
    return summary;
  }, {});
}

function normalizeThreshold(entry, { id, source = 'threshold_spec' }) {
  return {
    id: entry.id,
    patternId: id,
    stage: entry.stage,
    shape: entry.shape,
    gateType: entry.gateType,
    signal: entry.signal,
    unit: entry.unit,
    value: entry.value,
    range: entry.range,
    buckets: entry.buckets,
    curveGroup: entry.curveGroup,
    rationale: entry.rationale,
    concerns: asArray(entry.concerns),
    tuningSurface: entry.tuningSurface,
    source: entry.source || source,
    owner: entry.owner || null,
  };
}

function calibrationThresholds(id, calibration = {}) {
  const thresholds = [];
  if (Number(calibration.minConfidence) > 0) {
    thresholds.push(threshold({
      id: 'calibration.min_confidence',
      stage: CALIBRATION_GATE,
      shape: CONFIDENCE_FLOOR,
      signal: 'pattern.confidence',
      gateType: LABEL_CALIBRATION,
      source: 'sitePullPatternCalibration',
      value: { atLeast: calibration.minConfidence },
      curveGroup: 'label_calibration',
      tuningSurface: 'threshold',
    }));
  }
  if (Number(calibration.minSampleCount) > 0 && asArray(calibration.sampleKeys).length > 0) {
    thresholds.push(threshold({
      id: 'calibration.min_sample_count',
      stage: CALIBRATION_GATE,
      shape: SAMPLE_FLOOR,
      signal: calibration.sampleKeys.join('|'),
      gateType: LABEL_CALIBRATION,
      source: 'sitePullPatternCalibration',
      value: { atLeast: calibration.minSampleCount, mode: calibration.sampleMode || 'max' },
      curveGroup: 'label_calibration',
      tuningSurface: 'threshold',
    }));
  }
  if (calibration.visibility && calibration.visibility !== SITE_PULL_PATTERN_CALIBRATION_VISIBILITY.VISIBLE) {
    thresholds.push(threshold({
      id: 'calibration.visibility_policy',
      stage: PRESENTATION_POLICY,
      shape: VISIBILITY_POLICY,
      signal: 'calibration.visibility',
      gateType: PRESENTATION,
      source: 'sitePullPatternCalibration',
      value: calibration.visibility,
      curveGroup: 'presentation_visibility',
      tuningSurface: 'presentation',
    }));
  }
  return thresholds.map((entry) => normalizeThreshold(entry, {
    id,
    source: 'calibration_spec',
  }));
}

function feedbackSurfaceThresholds(id, feedbackSpec = null) {
  const surfaces = asArray(feedbackSpec?.surfaces);
  if (surfaces.length === 0 || surfaces.includes(BADGE)) return [];
  return [
    normalizeThreshold(threshold({
      id: 'feedback_surface.badge_policy',
      stage: PRESENTATION_POLICY,
      shape: VISIBILITY_POLICY,
      signal: 'feedback.surfaces',
      gateType: PRESENTATION,
      source: 'sitePullPatternFeedbackSpec',
      value: { badgeEligible: false, surfaces },
      curveGroup: 'presentation_surface',
      rationale: 'Feedback surface policy excludes this pattern from standalone badge presentation.',
      concerns: ['not_primary_badge'],
      tuningSurface: 'presentation',
    }), { id, source: 'feedback_surface_spec' }),
  ];
}

function compositeThresholds(id, definition = {}, decisionHint = {}) {
  if (definition?.level !== 'composite') return [];
  return [
    normalizeThreshold(threshold({
      id: 'definition.component_confirmation',
      stage: COMPOSITE_FUSION,
      shape: COMPOSITE_CONFIRMATION,
      signal: 'componentIds',
      gateType: LABEL_REQUIREMENT,
      source: 'sitePullPatternComposer/sitePullPatternDefinitions',
      value: { componentIds: asArray(definition.componentIds) },
      curveGroup: decisionHint.fusionMode || 'component_patterns',
      tuningSurface: 'fusion',
    }), { id, source: 'definition_component_spec' }),
  ];
}

function rowIssues({ row, thresholds }) {
  const issues = [];
  const hardLabelThresholds = thresholds.filter((entry) => (
    entry.shape === HARD_CUT
    && entry.gateType !== COLLECTION_COMPRESSION
  ));
  const smoothThresholds = thresholds.filter((entry) => entry.shape === SMOOTH_CURVE);
  const bucketThresholds = thresholds.filter((entry) => entry.shape === BUCKET_BOUNDARY);
  const hasWideBucket = bucketThresholds.some((entry) => asArray(entry.buckets).some((bucket) => (
    Number(bucket.to) > 0
    && Number(bucket.from) > 0
    && Number(bucket.to) / Number(bucket.from) >= 3
  )));
  if (hardLabelThresholds.length > 0 && smoothThresholds.length === 0 && row.level !== 'state') {
    issues.push({
      severity: 'warning',
      code: 'hard_label_gate_without_curve',
      message: `${row.id} has label hard cuts without an explicit companion scoring curve in the threshold matrix.`,
    });
  }
  if (hasWideBucket) {
    issues.push({
      severity: 'warning',
      code: 'wide_bucket_interval',
      message: `${row.id} uses a wide compressed bucket interval; copy should avoid exact interval claims.`,
    });
  }
  if (thresholds.length === 0 && row.level !== 'state') {
    issues.push({
      severity: 'warning',
      code: 'missing_threshold_spec',
      message: `${row.id} has no threshold entries in the audit matrix.`,
    });
  }
  const explicitConcerns = thresholds.flatMap((entry) => entry.concerns.map((code) => ({
    severity: 'note',
    code,
    message: `${row.id} threshold ${entry.id} records concern ${code}.`,
  })));
  return [...issues, ...explicitConcerns];
}

function buildThresholdRow({
  id,
  definition,
  calibration,
  decisionHint,
  feedbackSpec,
  thresholdSpec,
}) {
  const specThresholds = asArray(thresholdSpec?.thresholds).map((entry) => (
    normalizeThreshold(entry, { id })
  ));
  const feedbackSurfaces = asArray(feedbackSpec?.surfaces);
  const thresholds = [
    ...specThresholds,
    ...calibrationThresholds(id, calibration),
    ...feedbackSurfaceThresholds(id, feedbackSpec),
    ...compositeThresholds(id, definition, decisionHint),
  ];
  const row = {
    id,
    level: definition?.level || null,
    polarity: definition?.polarity || null,
    group: definition?.presentation?.group || null,
    sensitivity: calibration?.sensitivity || null,
    visibility: calibration?.visibility || null,
    decisionGate: decisionHint?.decisionGate || null,
    normalization: decisionHint?.normalization || null,
    spikeHandling: decisionHint?.spikeHandling || null,
    fusionMode: decisionHint?.fusionMode || null,
    feedbackRole: feedbackSpec?.role || null,
    feedbackSurfaces,
    badgeEligible: feedbackSpec ? feedbackSurfaces.includes(BADGE) : null,
    thresholdCount: thresholds.length,
    hardCutCount: thresholds.filter((entry) => entry.shape === HARD_CUT).length,
    smoothCurveCount: thresholds.filter((entry) => entry.shape === SMOOTH_CURVE).length,
    bucketCount: thresholds.filter((entry) => entry.shape === BUCKET_BOUNDARY).length,
    thresholdIds: thresholds.map((entry) => entry.id),
    curveGroups: uniqueSorted(thresholds.map((entry) => entry.curveGroup)),
    concerns: uniqueSorted(thresholds.flatMap((entry) => entry.concerns)),
    notes: asArray(thresholdSpec?.notes),
  };
  const issues = rowIssues({ row, thresholds });
  return {
    ...row,
    issueCodes: issues.map((entry) => entry.code),
    issues,
    thresholds,
  };
}

function buildReviewQueues(rows = []) {
  return {
    hardCuts: rows
      .filter((row) => row.issueCodes.includes('hard_label_gate_without_curve'))
      .map((row) => row.id),
    bucketIntervals: rows
      .filter((row) => row.issueCodes.includes('wide_bucket_interval'))
      .map((row) => row.id),
    explicitConcerns: rows
      .filter((row) => row.concerns.length > 0)
      .map((row) => row.id),
    missingSpecs: rows
      .filter((row) => row.issueCodes.includes('missing_threshold_spec'))
      .map((row) => row.id),
    presentation: rows
      .filter((row) => (
        (row.visibility && row.visibility !== SITE_PULL_PATTERN_CALIBRATION_VISIBILITY.VISIBLE)
        || row.badgeEligible === false
      ))
      .map((row) => row.id),
  };
}

export function buildSitePullPatternThresholdAuditReport({
  definitions = SITE_PULL_PATTERN_DEFINITIONS,
  calibrationSpecs = SITE_PULL_PATTERN_CALIBRATION,
  decisionHints = SITE_PULL_PATTERN_CALIBRATION_DECISION_HINTS,
  feedbackSpecs = SITE_PULL_PATTERN_FEEDBACK_SPEC,
  thresholdSpecs = SITE_PULL_PATTERN_THRESHOLD_SPECS,
} = {}) {
  const patternIds = uniqueSorted([
    ...Object.keys(definitions || {}),
    ...Object.keys(calibrationSpecs || {}),
    ...Object.keys(decisionHints || {}),
    ...Object.keys(feedbackSpecs || {}),
    ...Object.keys(thresholdSpecs || {}),
  ]);
  const rows = patternIds.map((id) => buildThresholdRow({
    id,
    definition: definitions[id] || null,
    calibration: calibrationSpecs[id] || null,
    decisionHint: decisionHints[id] || null,
    feedbackSpec: feedbackSpecs[id] || null,
    thresholdSpec: thresholdSpecs[id] || null,
  }));
  const thresholdRows = rows.flatMap((row) => row.thresholds);
  const issues = rows.flatMap((row) => row.issues.map((entry) => ({
    id: row.id,
    ...entry,
  })));
  const blockingIssues = issues.filter((entry) => entry.severity === 'error');

  return {
    version: SITE_PULL_PATTERN_THRESHOLD_AUDIT_VERSION,
    status: blockingIssues.length > 0 ? 'fail' : 'pass',
    summary: {
      patternCount: rows.length,
      thresholdCount: thresholdRows.length,
      blockingIssueCount: blockingIssues.length,
      warningIssueCount: issues.filter((entry) => entry.severity === 'warning').length,
      noteCount: issues.filter((entry) => entry.severity === 'note').length,
      byStage: countBy(thresholdRows, 'stage'),
      byShape: countBy(thresholdRows, 'shape'),
      byGateType: countBy(thresholdRows, 'gateType'),
      byDecisionGate: countBy(rows, 'decisionGate'),
    },
    rows,
    thresholdRows,
    issues,
    blockingIssues,
    reviewQueues: buildReviewQueues(rows),
  };
}
