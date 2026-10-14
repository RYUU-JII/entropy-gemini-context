import { SITE_PULL_PATTERN_LEVELS } from './sitePullPatternContracts.js';
import {
  SITE_PULL_PATTERN_CALIBRATION,
  SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY,
  SITE_PULL_PATTERN_CALIBRATION_VISIBILITY,
} from './sitePullPatternCalibration.js';
import { SITE_PULL_PATTERN_DEFINITIONS } from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_ROLES,
  SITE_PULL_PATTERN_FEEDBACK_SPEC,
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
} from './sitePullPatternFeedbackSpec.js';
import { SITE_PULL_PATTERN_REQUIREMENTS } from './sitePullPatternRequirements.js';

export const SITE_PULL_PATTERN_CALIBRATION_AUDIT_VERSION = 'site-pull-pattern-calibration-audit-release-v1';

export const SITE_PULL_PATTERN_DECISION_GATES = Object.freeze({
  STATE: 'state',
  SETUP_CONTEXT: 'setup_context',
  SUBSCORE_THRESHOLD: 'subscore_threshold',
  SAMPLE_THRESHOLD: 'sample_threshold',
  MULTI_SIGNAL_GATE: 'multi_signal_gate',
  PERSONAL_BASELINE_ANOMALY: 'personal_baseline_anomaly',
  COMPOSITE_FUSION: 'composite_fusion',
  NAVIGATION_GATE: 'navigation_gate',
  BEHAVIOR_GATE: 'behavior_gate',
  TRANSITION_EDGE_GATE: 'transition_edge_gate',
  CIRCADIAN_GATE: 'circadian_gate',
  INTERVENTION_GATE: 'intervention_gate',
  SUPPORTING_CONTEXT: 'supporting_context',
  PROXY_GATE: 'proxy_gate',
});

export const SITE_PULL_PATTERN_TUNING_SURFACES = Object.freeze({
  THRESHOLD: 'threshold',
  GATE: 'gate',
  FUSION: 'fusion',
  PRESENTATION: 'presentation',
  COPY: 'copy',
});

const {
  STATE,
  SETUP_CONTEXT,
  SUBSCORE_THRESHOLD,
  SAMPLE_THRESHOLD,
  MULTI_SIGNAL_GATE,
  PERSONAL_BASELINE_ANOMALY,
  COMPOSITE_FUSION,
  NAVIGATION_GATE,
  BEHAVIOR_GATE,
  TRANSITION_EDGE_GATE,
  CIRCADIAN_GATE,
  INTERVENTION_GATE,
  SUPPORTING_CONTEXT,
  PROXY_GATE,
} = SITE_PULL_PATTERN_DECISION_GATES;

const {
  THRESHOLD,
  GATE,
  FUSION,
  PRESENTATION,
  COPY,
} = SITE_PULL_PATTERN_TUNING_SURFACES;

const {
  CONSERVATIVE,
  CONTEXT,
  EXPLORATORY,
  NORMAL,
  STATE: STATE_SENSITIVITY,
} = SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY;

const { SHADOW, SUPPORTING, VISIBLE } = SITE_PULL_PATTERN_CALIBRATION_VISIBILITY;
const { SUPPORTING_EVIDENCE } = SITE_PULL_PATTERN_FEEDBACK_ROLES;
const { BADGE, DIAGNOSTIC } = SITE_PULL_PATTERN_FEEDBACK_SURFACES;

export const SITE_PULL_PATTERN_CALIBRATION_VISIBILITY_FEEDBACK_POLICY = Object.freeze({
  [VISIBLE]: Object.freeze({
    requiredRole: null,
    forbiddenSurfaces: freezeArray([]),
    requiredSurfaces: freezeArray([]),
  }),
  [SUPPORTING]: Object.freeze({
    requiredRole: SUPPORTING_EVIDENCE,
    forbiddenSurfaces: freezeArray([BADGE]),
    requiredSurfaces: freezeArray([DIAGNOSTIC]),
  }),
  [SHADOW]: Object.freeze({
    requiredRole: SUPPORTING_EVIDENCE,
    forbiddenSurfaces: freezeArray([BADGE]),
    requiredSurfaces: freezeArray([DIAGNOSTIC]),
  }),
});

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function decisionHint({
  decisionGate,
  normalization = 'local_detector_score',
  spikeHandling = 'none',
  fusionMode = 'none',
  tuningSurfaces = [THRESHOLD],
} = {}) {
  return Object.freeze({
    decisionGate,
    normalization,
    spikeHandling,
    fusionMode,
    tuningSurfaces: freezeArray(tuningSurfaces),
  });
}

export const SITE_PULL_PATTERN_CALIBRATION_DECISION_HINTS = Object.freeze({
  no_activity: decisionHint({
    decisionGate: STATE,
    normalization: 'exclusive_state',
    spikeHandling: 'not_applicable',
    tuningSurfaces: [GATE, COPY],
  }),
  insufficient_data: decisionHint({
    decisionGate: STATE,
    normalization: 'data_quality_state',
    spikeHandling: 'not_applicable',
    tuningSurfaces: [GATE, PRESENTATION, COPY],
  }),
  steady: decisionHint({
    decisionGate: STATE,
    normalization: 'fallback_state',
    spikeHandling: 'not_applicable',
    tuningSurfaces: [GATE, PRESENTATION, COPY],
  }),
  goal_exceeded: decisionHint({
    decisionGate: SAMPLE_THRESHOLD,
    normalization: 'goal_ratio',
    tuningSurfaces: [THRESHOLD, COPY],
  }),
  goal_exceeded_repeated: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'goal_ratio_plus_weekly_repeat_count',
    fusionMode: 'current_day_observation_dimensions',
    tuningSurfaces: [GATE, FUSION, PRESENTATION, COPY],
  }),
  goal_missing: decisionHint({
    decisionGate: SETUP_CONTEXT,
    normalization: 'setup_gap',
    tuningSurfaces: [GATE, PRESENTATION, COPY],
  }),
  goal_kept: decisionHint({
    decisionGate: STATE,
    normalization: 'goal_ratio',
    tuningSurfaces: [THRESHOLD, PRESENTATION, COPY],
  }),
  time_heavy_today: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'time_pressure_profile_strength',
    fusionMode: 'absolute_weekly_personal_usage',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  personal_spike: decisionHint({
    decisionGate: PERSONAL_BASELINE_ANOMALY,
    normalization: 'personal_baseline_relative',
    spikeHandling: 'robust_personal_baseline',
    tuningSurfaces: [THRESHOLD, GATE, COPY],
  }),
  deep_immersion: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'long_session_context_strength',
    fusionMode: 'measured_duration_with_same_day_movement_or_returns',
    spikeHandling: 'feed_counters_are_supporting_evidence',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  focused_block: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'sustained_block_shape',
    fusionMode: 'usage_session_behavior_context',
    tuningSurfaces: [GATE, FUSION, PRESENTATION, COPY],
  }),
  session_depth_spike: decisionHint({
    decisionGate: PERSONAL_BASELINE_ANOMALY,
    normalization: 'personal_session_baseline_relative',
    spikeHandling: 'robust_personal_baseline',
    fusionMode: 'shadow_evidence_for_recaps_and_immersion_context',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  checking_pattern: decisionHint({
    decisionGate: SUBSCORE_THRESHOLD,
    normalization: 'checking_loop_subscore',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  checking_pattern_proxy: decisionHint({
    decisionGate: PROXY_GATE,
    normalization: 'hourly_proxy_score',
    fusionMode: 'data_gap_proxy',
    tuningSurfaces: [GATE, PRESENTATION, COPY],
  }),
  visit_spike: decisionHint({
    decisionGate: PERSONAL_BASELINE_ANOMALY,
    normalization: 'personal_visit_baseline_relative',
    spikeHandling: 'robust_personal_baseline',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  reentry_spike: decisionHint({
    decisionGate: PERSONAL_BASELINE_ANOMALY,
    normalization: 'personal_reentry_baseline_relative',
    spikeHandling: 'robust_personal_baseline',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  quick_return_loop: decisionHint({
    decisionGate: SUPPORTING_CONTEXT,
    normalization: 'impulse_weighted_reentry',
    spikeHandling: 'baseline_optional',
    fusionMode: 'behavior_or_personal_baseline',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  switch_churn_loop: decisionHint({
    decisionGate: SAMPLE_THRESHOLD,
    normalization: 'count_and_visit_relative_rate',
    spikeHandling: 'baseline_optional',
    fusionMode: 'behavior_or_personal_baseline',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, COPY],
  }),
  checking_carousel: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'current_dimension_maximum',
    spikeHandling: 'component_confirmation',
    fusionMode: 'component_patterns',
    tuningSurfaces: [GATE, FUSION, PRESENTATION, COPY],
  }),
  session_fragmentation: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'session_count_shape',
    fusionMode: 'session_count_and_short_session_count',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  protected_route_return: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'route_pressure_protected_return_strength',
    spikeHandling: 'today_edge_required_with_weekly_context',
    fusionMode: 'incoming_edge_count_return_rate_route_status',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  domain_pair_loop: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'route_pressure_pair_loop_strength',
    spikeHandling: 'pair_concentration_context',
    fusionMode: 'top_pair_count_return_rate_concentration',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  loop_route_hint: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'route_pressure_multi_edge_strength',
    spikeHandling: 'today_edge_required_with_weekly_context',
    fusionMode: 'route_pressure_profile_rollup',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  habitual_entry: decisionHint({
    decisionGate: NAVIGATION_GATE,
    normalization: 'navigation_entry_share',
    tuningSurfaces: [THRESHOLD, GATE, COPY],
  }),
  reload_checking: decisionHint({
    decisionGate: NAVIGATION_GATE,
    normalization: 'reload_share',
    tuningSurfaces: [THRESHOLD, GATE, COPY],
  }),
  new_tab_loop: decisionHint({
    decisionGate: SUPPORTING_CONTEXT,
    normalization: 'new_tab_queue_support_score',
    fusionMode: 'tab_queue_profile_support',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  duplicate_tab_entry: decisionHint({
    decisionGate: SUPPORTING_CONTEXT,
    normalization: 'same_domain_tab_queue_support_score',
    fusionMode: 'tab_queue_profile_support',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  tab_queue_pattern: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'tab_queue_profile_strength',
    spikeHandling: 'requires_same_domain_context_plus_entry_support',
    fusionMode: 'site_tab_projection_maximum_browser_context_diagnostic',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  tab_hoarding_context: decisionHint({
    decisionGate: SUPPORTING_CONTEXT,
    normalization: 'browser_tab_context_support_score',
    fusionMode: 'tab_queue_profile_support',
    tuningSurfaces: [GATE, PRESENTATION, COPY],
  }),
  background_residency: decisionHint({
    decisionGate: BEHAVIOR_GATE,
    normalization: 'maximum_overlapping_tab_channel_intensity',
    spikeHandling: 'pressure_channels_are_not_summed_as_duration',
    fusionMode: 'media_linger_stale_today_weekly',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  feed_skimming: decisionHint({
    decisionGate: SUPPORTING_CONTEXT,
    normalization: 'feed_skim_support_score',
    fusionMode: 'content_flow_profile_support',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  feed_loop_pattern: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'content_flow_profile_strength',
    spikeHandling: 'requires_multiple_content_flow_channels_or_strong_supply',
    fusionMode: 'feed_supply_skim_scroll_pressure_profile',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  fast_scroll_bursts: decisionHint({
    decisionGate: SUPPORTING_CONTEXT,
    normalization: 'scroll_velocity_support_score',
    fusionMode: 'content_flow_profile_support',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  daily_habit: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'habit_consistency_profile_strength',
    fusionMode: 'active_days_streak_volume_visit_context',
    spikeHandling: 'low_volume_and_observation_coverage_caveats',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  rising_trend: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'trend_pressure_profile_strength',
    fusionMode: 'canonical_recent_trajectory_personal_baseline',
    spikeHandling: 'single_day_spike_veto_and_complete_comparison_window',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  late_night_binge: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'night_pressure_profile_strength',
    fusionMode: 'fixed_clock_window_duration_only',
    spikeHandling: 'no_personal_sleep_or_repeated_nights_claim',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
  late_night: decisionHint({
    decisionGate: CIRCADIAN_GATE,
    normalization: 'night_pressure_context',
    fusionMode: 'hourly_night_usage_profile',
    tuningSurfaces: [THRESHOLD, GATE, PRESENTATION, COPY],
  }),
  intervention_resistance_loop: decisionHint({
    decisionGate: COMPOSITE_FUSION,
    normalization: 'selected_cohort_reentry_intensity',
    spikeHandling: 'component_confirmation',
    fusionMode: 'single_family_repeated_exposure_return',
    tuningSurfaces: [GATE, FUSION, PRESENTATION, COPY],
  }),
  intervention_reentry: decisionHint({
    decisionGate: INTERVENTION_GATE,
    normalization: 'intervention_outcome_profile_reentry_strength',
    fusionMode: 'selected_window_reentry_rates',
    tuningSurfaces: [THRESHOLD, GATE, COPY],
  }),
  intervention_recovery: decisionHint({
    decisionGate: INTERVENTION_GATE,
    normalization: 'effectiveness_cohort_leave_count',
    spikeHandling: 'followup_maturity_not_inferred',
    fusionMode: 'today_leave_choice_observed',
    tuningSurfaces: [GATE, PRESENTATION, COPY],
  }),
  controlled_brief_check: decisionHint({
    decisionGate: MULTI_SIGNAL_GATE,
    normalization: 'measured_brevity_strength',
    spikeHandling: 'no_control_or_completed_exit_claim',
    fusionMode: 'measured_duration_and_count',
    tuningSurfaces: [THRESHOLD, GATE, FUSION, PRESENTATION, COPY],
  }),
});

export const SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY_POLICY = Object.freeze({
  [STATE_SENSITIVITY]: Object.freeze({
    minVisibleConfidence: 0,
    primaryVisibility: freezeArray([VISIBLE]),
    requiresSampleEvidence: false,
  }),
  [CONSERVATIVE]: Object.freeze({
    minVisibleConfidence: 0.35,
    primaryVisibility: freezeArray([VISIBLE]),
    requiresSampleEvidence: true,
  }),
  [NORMAL]: Object.freeze({
    minVisibleConfidence: 0.35,
    primaryVisibility: freezeArray([VISIBLE]),
    requiresSampleEvidence: true,
  }),
  [CONTEXT]: Object.freeze({
    minVisibleConfidence: 0.35,
    primaryVisibility: freezeArray([VISIBLE, SUPPORTING, SHADOW]),
    requiresSampleEvidence: true,
  }),
  [EXPLORATORY]: Object.freeze({
    minVisibleConfidence: 0.35,
    primaryVisibility: freezeArray([SUPPORTING, SHADOW]),
    requiresSampleEvidence: true,
  }),
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
    .sort();
}

function issue({ severity = 'warning', code, message }) {
  return { severity, code, message };
}

function isComposite(definition) {
  return definition?.level === SITE_PULL_PATTERN_LEVELS.COMPOSITE;
}

function isState(definition) {
  return definition?.level === SITE_PULL_PATTERN_LEVELS.STATE;
}

function isSetupGate(hint) {
  return hint?.decisionGate === SETUP_CONTEXT;
}

function requiresComponentFusion(hint) {
  return hint?.decisionGate === COMPOSITE_FUSION;
}

function buildRowIssues({
  id,
  definition,
  requirement,
  calibration,
  feedbackSpec,
  decisionHint: hint,
  policy,
}) {
  const issues = [];
  if (!definition) {
    issues.push(issue({
      severity: 'error',
      code: 'missing_definition',
      message: `${id} has no pattern definition.`,
    }));
  }
  if (!requirement) {
    issues.push(issue({
      severity: 'error',
      code: 'missing_requirement',
      message: `${id} has no requirement gate.`,
    }));
  }
  if (!calibration) {
    issues.push(issue({
      severity: 'error',
      code: 'missing_calibration',
      message: `${id} has no calibration spec.`,
    }));
  }
  if (!hint) {
    issues.push(issue({
      severity: 'error',
      code: 'missing_decision_hint',
      message: `${id} has no calibration decision hint.`,
    }));
  }
  if (!feedbackSpec) {
    issues.push(issue({
      severity: 'error',
      code: 'missing_feedback_spec',
      message: `${id} has no feedback surface spec for calibration visibility review.`,
    }));
  }
  if (!definition || !calibration || !hint || !policy || !feedbackSpec) return issues;

  const visibilityFeedbackPolicy =
    SITE_PULL_PATTERN_CALIBRATION_VISIBILITY_FEEDBACK_POLICY[calibration.visibility] || null;
  const feedbackSurfaces = asArray(feedbackSpec.surfaces);
  if (
    visibilityFeedbackPolicy?.requiredRole
    && feedbackSpec.role !== visibilityFeedbackPolicy.requiredRole
  ) {
    issues.push(issue({
      severity: 'error',
      code: 'non_visible_feedback_role',
      message: `${id} is ${calibration.visibility} calibration but feedback role is ${feedbackSpec.role}.`,
    }));
  }
  visibilityFeedbackPolicy?.forbiddenSurfaces.forEach((surface) => {
    if (!feedbackSurfaces.includes(surface)) return;
    issues.push(issue({
      severity: 'error',
      code: 'non_visible_badge_surface',
      message: `${id} is ${calibration.visibility} calibration but exposes ${surface}.`,
    }));
  });
  visibilityFeedbackPolicy?.requiredSurfaces.forEach((surface) => {
    if (feedbackSurfaces.includes(surface)) return;
    issues.push(issue({
      severity: 'error',
      code: 'non_visible_missing_diagnostic_surface',
      message: `${id} is ${calibration.visibility} calibration but lacks ${surface} visibility.`,
    }));
  });

  if (
    calibration.sensitivity === EXPLORATORY
    && calibration.visibility === VISIBLE
  ) {
    issues.push(issue({
      severity: 'error',
      code: 'exploratory_primary_visibility',
      message: `${id} is exploratory but can render as a primary visible label.`,
    }));
  }

  if (!policy.primaryVisibility.includes(calibration.visibility)) {
    issues.push(issue({
      severity: 'warning',
      code: 'visibility_outside_sensitivity_policy',
      message: `${id} visibility is unusual for ${calibration.sensitivity} sensitivity.`,
    }));
  }

  if (
    calibration.visibility === VISIBLE
    && Number(calibration.minConfidence) < policy.minVisibleConfidence
  ) {
    issues.push(issue({
      severity: 'warning',
      code: 'low_visible_min_confidence',
      message: `${id} visible minimum confidence is below its sensitivity policy.`,
    }));
  }

  if (
    policy.requiresSampleEvidence
    && !isComposite(definition)
    && !isSetupGate(hint)
    && asArray(calibration.sampleKeys).length === 0
  ) {
    issues.push(issue({
      severity: 'warning',
      code: 'missing_sample_evidence',
      message: `${id} has no sample evidence keys for calibration.`,
    }));
  }

  if (
    isComposite(definition)
    && asArray(definition.componentIds).length === 0
  ) {
    issues.push(issue({
      severity: 'error',
      code: 'composite_without_components',
      message: `${id} is composite but has no component IDs.`,
    }));
  }

  if (
    isComposite(definition)
    && !requiresComponentFusion(hint)
  ) {
    issues.push(issue({
      severity: 'warning',
      code: 'composite_without_fusion_gate',
      message: `${id} is composite but its decision hint is not a fusion gate.`,
    }));
  }

  if (
    !isState(definition)
    && calibration.scoreMeaning === 'local_intensity'
  ) {
    issues.push(issue({
      severity: 'warning',
      code: 'generic_score_meaning',
      message: `${id} keeps a generic score meaning, which weakens user-facing explanations.`,
    }));
  }

  if (
    asArray(calibration.sampleKeys).length > 1
    && hint.fusionMode === 'none'
  ) {
    issues.push(issue({
      severity: 'warning',
      code: 'multi_sample_without_fusion_mode',
      message: `${id} combines multiple sample keys but has no fusion mode hint.`,
    }));
  }

  return issues;
}

function buildRow({
  id,
  definitions,
  requirements,
  calibrationSpecs,
  feedbackSpecs,
  decisionHints,
}) {
  const definition = definitions[id] || null;
  const requirement = requirements[id] || null;
  const calibration = calibrationSpecs[id] || null;
  const feedbackSpec = feedbackSpecs[id] || null;
  const decisionHintEntry = decisionHints[id] || null;
  const policy = SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY_POLICY[calibration?.sensitivity] || null;
  const issues = buildRowIssues({
    id,
    definition,
    requirement,
    calibration,
    feedbackSpec,
    decisionHint: decisionHintEntry,
    policy,
  });
  const feedbackSurfaces = asArray(feedbackSpec?.surfaces);

  return {
    id,
    level: definition?.level || null,
    polarity: definition?.polarity || null,
    group: definition?.presentation?.group || null,
    visibility: calibration?.visibility || null,
    sensitivity: calibration?.sensitivity || null,
    scoreMeaning: calibration?.scoreMeaning || null,
    minConfidence: calibration?.minConfidence ?? null,
    minScore: calibration?.minScore ?? null,
    minEvidenceStrength: calibration?.minEvidenceStrength ?? null,
    sampleKeys: asArray(calibration?.sampleKeys),
    sampleMode: calibration?.sampleMode || null,
    minSampleCount: calibration?.minSampleCount ?? null,
    feedbackRole: feedbackSpec?.role || null,
    feedbackScope: feedbackSpec?.feedbackScope || null,
    feedbackSurfaces,
    badgeEligible: feedbackSurfaces.includes(BADGE),
    diagnosticEligible: feedbackSurfaces.includes(DIAGNOSTIC),
    decisionGate: decisionHintEntry?.decisionGate || null,
    normalization: decisionHintEntry?.normalization || null,
    spikeHandling: decisionHintEntry?.spikeHandling || null,
    fusionMode: decisionHintEntry?.fusionMode || null,
    tuningSurfaces: asArray(decisionHintEntry?.tuningSurfaces),
    componentIds: asArray(definition?.componentIds),
    issueCodes: issues.map((entry) => entry.code),
    issues,
  };
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

function buildTuningQueues(rows = []) {
  return Object.values(SITE_PULL_PATTERN_TUNING_SURFACES).reduce((queues, surface) => {
    queues[surface] = rows
      .filter((row) => row.tuningSurfaces.includes(surface))
      .map((row) => row.id);
    return queues;
  }, {});
}

export function buildSitePullPatternCalibrationAuditReport({
  definitions = SITE_PULL_PATTERN_DEFINITIONS,
  requirements = SITE_PULL_PATTERN_REQUIREMENTS,
  calibrationSpecs = SITE_PULL_PATTERN_CALIBRATION,
  feedbackSpecs = SITE_PULL_PATTERN_FEEDBACK_SPEC,
  decisionHints = SITE_PULL_PATTERN_CALIBRATION_DECISION_HINTS,
} = {}) {
  const patternIds = uniqueSorted([
    ...Object.keys(definitions || {}),
    ...Object.keys(requirements || {}),
    ...Object.keys(calibrationSpecs || {}),
    ...Object.keys(feedbackSpecs || {}),
    ...Object.keys(decisionHints || {}),
  ]);
  const rows = patternIds.map((id) => buildRow({
    id,
    definitions,
    requirements,
    calibrationSpecs,
    feedbackSpecs,
    decisionHints,
  }));
  const issues = rows.flatMap((row) => row.issues.map((entry) => ({
    id: row.id,
    ...entry,
  })));
  const blockingIssues = issues.filter((entry) => entry.severity === 'error');

  return {
    version: SITE_PULL_PATTERN_CALIBRATION_AUDIT_VERSION,
    status: blockingIssues.length > 0 ? 'fail' : 'pass',
    summary: {
      patternCount: rows.length,
      blockingIssueCount: blockingIssues.length,
      warningIssueCount: issues.length - blockingIssues.length,
      bySensitivity: countBy(rows, 'sensitivity'),
      byVisibility: countBy(rows, 'visibility'),
      byFeedbackRole: countBy(rows, 'feedbackRole'),
      byDecisionGate: countBy(rows, 'decisionGate'),
    },
    rows,
    issues,
    blockingIssues,
    tuningQueues: buildTuningQueues(rows),
  };
}
