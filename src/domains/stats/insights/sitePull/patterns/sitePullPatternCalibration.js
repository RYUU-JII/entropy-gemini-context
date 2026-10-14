import {
  clamp,
  clamp01,
  toNumber,
} from '../sitePullMath.js';
import {
  SITE_PULL_PATTERN_DECISION_QUALITY_VERSION,
  buildSitePullPatternDecisionQuality,
} from './sitePullPatternDecisionQuality.js';

export const SITE_PULL_PATTERN_CALIBRATION_VERSION = 'site-pull-pattern-calibration-v1';

export const SITE_PULL_PATTERN_CALIBRATION_VISIBILITY = Object.freeze({
  VISIBLE: 'visible',
  SUPPORTING: 'supporting',
  SHADOW: 'shadow',
});

export const SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY = Object.freeze({
  STATE: 'state',
  CONSERVATIVE: 'conservative',
  NORMAL: 'normal',
  CONTEXT: 'context',
  EXPLORATORY: 'exploratory',
});

const { VISIBLE, SUPPORTING, SHADOW } = SITE_PULL_PATTERN_CALIBRATION_VISIBILITY;
const {
  STATE,
  CONSERVATIVE,
  NORMAL,
  CONTEXT,
  EXPLORATORY,
} = SITE_PULL_PATTERN_CALIBRATION_SENSITIVITY;
const SITE_PULL_PATTERN_CALIBRATION_RESULT_STATUSES = new Set([
  'accepted',
  'rejected',
  'shadow',
  'supporting',
]);

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function calibrationSpec({
  sensitivity = NORMAL,
  visibility = VISIBLE,
  scoreMeaning = 'local_intensity',
  minScore = 0,
  minConfidence = 0.3,
  minEvidenceStrength = 0,
  minSampleCount = 0,
  sampleKeys = [],
  sampleMode = 'max',
  missingDataBehavior = 'requirements_reject',
  explanationKey = null,
} = {}) {
  return Object.freeze({
    sensitivity,
    visibility,
    scoreMeaning,
    minScore,
    minConfidence,
    minEvidenceStrength,
    minSampleCount,
    sampleKeys: freezeArray(sampleKeys),
    sampleMode,
    missingDataBehavior,
    explanationKey,
  });
}

export const SITE_PULL_PATTERN_CALIBRATION = Object.freeze({
  no_activity: calibrationSpec({
    sensitivity: STATE,
    minConfidence: 0,
    scoreMeaning: 'exclusive_state',
    missingDataBehavior: 'not_applicable',
  }),
  insufficient_data: calibrationSpec({
    sensitivity: STATE,
    minConfidence: 0,
    scoreMeaning: 'data_quality_state',
    missingDataBehavior: 'show_low_confidence_state',
  }),
  steady: calibrationSpec({
    sensitivity: STATE,
    minConfidence: 0.35,
    scoreMeaning: 'fallback_state',
  }),
  goal_exceeded: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.55,
    sampleKeys: ['usageRatio'],
    minSampleCount: 1,
    scoreMeaning: 'goal_overrun_intensity',
  }),
  goal_exceeded_repeated: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.55,
    sampleKeys: ['overLimitDays'],
    minSampleCount: 3,
    scoreMeaning: 'repeated_goal_overrun_intensity',
  }),
  goal_missing: calibrationSpec({
    sensitivity: CONTEXT,
    minConfidence: 0.35,
    sampleKeys: ['activityEvidenceCount'],
    minSampleCount: 1,
    scoreMeaning: 'setup_gap',
  }),
  goal_kept: calibrationSpec({
    sensitivity: STATE,
    minConfidence: 0.45,
    sampleKeys: ['meaningfulGoalProgressScore'],
    minSampleCount: 1,
    scoreMeaning: 'goal_adherence_margin',
  }),
  time_heavy_today: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.5,
    sampleKeys: ['todayMs'],
    minSampleCount: 5 * 60_000,
    scoreMeaning: 'time_pressure_profile_strength',
  }),
  personal_spike: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.35,
    sampleKeys: ['personalSpikeChannelCount'],
    minSampleCount: 1,
    scoreMeaning: 'personal_baseline_anomaly',
  }),
  deep_immersion: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.58,
    sampleKeys: ['sustainedBlockMs'],
    minSampleCount: 30 * 60_000,
    scoreMeaning: 'long_session_context_strength',
  }),
  focused_block: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.55,
    sampleKeys: ['sustainedBlockMs'],
    minSampleCount: 20 * 60_000,
    scoreMeaning: 'sustained_block_strength',
  }),
  session_depth_spike: calibrationSpec({
    sensitivity: CONSERVATIVE,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['sessionDepthChannelCount'],
    minSampleCount: 1,
    scoreMeaning: 'personal_session_depth_anomaly',
  }),
  checking_pattern: calibrationSpec({
    sensitivity: NORMAL,
    minConfidence: 0.45,
    sampleKeys: ['todayVisits'],
    minSampleCount: 1,
    scoreMeaning: 'checking_loop_subscore',
  }),
  checking_pattern_proxy: calibrationSpec({
    sensitivity: EXPLORATORY,
    visibility: SUPPORTING,
    minConfidence: 0.35,
    sampleKeys: ['activeHoursToday'],
    minSampleCount: 1,
    scoreMeaning: 'hourly_checking_proxy',
    missingDataBehavior: 'proxy_when_entry_unavailable',
  }),
  visit_spike: calibrationSpec({
    sensitivity: NORMAL,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['todayVisits'],
    minSampleCount: 1,
    scoreMeaning: 'personal_visit_anomaly',
  }),
  reentry_spike: calibrationSpec({
    sensitivity: CONSERVATIVE,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['todayRevisitWithin10m'],
    minSampleCount: 1,
    scoreMeaning: 'personal_reentry_anomaly',
  }),
  quick_return_loop: calibrationSpec({
    sensitivity: CONTEXT,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['todaySwitchBackWithin10m', 'todaySwitchIns'],
    sampleMode: 'min',
    minSampleCount: 2,
    scoreMeaning: 'quick_return_impulse_support',
    explanationKey: 'quick_return_impulse_observed',
  }),
  switch_churn_loop: calibrationSpec({
    sensitivity: NORMAL,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['todaySwitchChurn'],
    minSampleCount: 8,
    scoreMeaning: 'switch_churn_loop_strength',
  }),
  checking_carousel: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.35,
    sampleKeys: ['todayVisits'],
    minSampleCount: 2,
    scoreMeaning: 'composite_checking_loop_strength',
  }),
  session_fragmentation: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.5,
    sampleKeys: ['sessionCount', 'shortSessionCount'],
    sampleMode: 'min',
    minSampleCount: 4,
    scoreMeaning: 'short_session_fragmentation_strength',
  }),
  protected_route_return: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.55,
    sampleKeys: ['incomingCount', 'incomingReturnWithin10m', 'protectedReturnScore'],
    sampleMode: 'min',
    minSampleCount: 0.55,
    scoreMeaning: 'route_pressure_protected_return_strength',
  }),
  domain_pair_loop: calibrationSpec({
    sensitivity: CONTEXT,
    minConfidence: 0.45,
    sampleKeys: ['topPairCount', 'pairLoopScore'],
    sampleMode: 'max',
    minSampleCount: 2,
    scoreMeaning: 'route_pressure_pair_loop_strength',
  }),
  loop_route_hint: calibrationSpec({
    sensitivity: NORMAL,
    visibility: SHADOW,
    minConfidence: 0.45,
    sampleKeys: ['count', 'distinctEdgeCount', 'routePressureScore'],
    sampleMode: 'max',
    minSampleCount: 3,
    scoreMeaning: 'route_pressure_multi_edge_strength',
  }),
  habitual_entry: calibrationSpec({
    sensitivity: NORMAL,
    minConfidence: 0.45,
    sampleKeys: ['typedEntrances'],
    minSampleCount: 2,
    scoreMeaning: 'direct_entry_share',
  }),
  reload_checking: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.45,
    sampleKeys: ['reloads'],
    minSampleCount: 2,
    scoreMeaning: 'reload_checking_share',
  }),
  new_tab_loop: calibrationSpec({
    sensitivity: CONTEXT,
    visibility: SHADOW,
    minConfidence: 0.45,
    sampleKeys: ['newTabEntrances', 'newTabScore'],
    sampleMode: 'max',
    minSampleCount: 2,
    scoreMeaning: 'new_tab_queue_support_signal',
  }),
  duplicate_tab_entry: calibrationSpec({
    sensitivity: CONTEXT,
    visibility: SHADOW,
    minConfidence: 0.45,
    sampleKeys: ['duplicateTabEntrances', 'maxSameDomainOpenTabs', 'duplicateTabScore'],
    sampleMode: 'max',
    minSampleCount: 2,
    scoreMeaning: 'same_domain_tab_queue_support_signal',
  }),
  tab_queue_pattern: calibrationSpec({
    sensitivity: CONTEXT,
    minConfidence: 0.45,
    sampleKeys: ['tabQueueScore', 'tabQueueChannelCount'],
    sampleMode: 'min',
    minSampleCount: 0.58,
    scoreMeaning: 'tab_queue_profile_strength',
  }),
  tab_hoarding_context: calibrationSpec({
    sensitivity: CONTEXT,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['highOpenTabEntrances', 'maxOpenTabs', 'broadTabContextScore'],
    sampleMode: 'max',
    minSampleCount: 2,
    scoreMeaning: 'browser_tab_context_support_signal',
  }),
  background_residency: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.5,
    sampleKeys: ['todayBackgroundResidencyMs', 'weeklyBackgroundResidencyMs'],
    sampleMode: 'max',
    minSampleCount: 15 * 60_000,
    scoreMeaning: 'background_residency_profile_strength',
  }),
  feed_skimming: calibrationSpec({
    sensitivity: EXPLORATORY,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['feedSkimSignals', 'skimScore'],
    sampleMode: 'max',
    minSampleCount: 1,
    scoreMeaning: 'feed_skim_support_signal',
  }),
  feed_loop_pattern: calibrationSpec({
    sensitivity: CONTEXT,
    minConfidence: 0.35,
    sampleKeys: ['corroboratingEvidenceFamilyCount'],
    sampleMode: 'max',
    minSampleCount: 2,
    scoreMeaning: 'content_flow_profile_strength',
  }),
  fast_scroll_bursts: calibrationSpec({
    sensitivity: EXPLORATORY,
    visibility: SHADOW,
    minConfidence: 0.35,
    sampleKeys: ['fastScrollBursts', 'scrollSpikeBursts', 'scrollVelocityScore'],
    sampleMode: 'max',
    minSampleCount: 1,
    scoreMeaning: 'scroll_velocity_support_signal',
  }),
  daily_habit: calibrationSpec({
    sensitivity: NORMAL,
    minConfidence: 0.5,
    sampleKeys: ['activeDays', 'habitConsistencyScore'],
    sampleMode: 'max',
    minSampleCount: 4,
    scoreMeaning: 'habit_consistency_profile_strength',
  }),
  rising_trend: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.5,
    sampleKeys: ['trendRatio', 'personalTrendAnomalyScore'],
    sampleMode: 'max',
    minSampleCount: 1.01,
    scoreMeaning: 'trend_pressure_profile_strength',
  }),
  late_night_binge: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.45,
    sampleKeys: ['nightMsToday', 'nightPressureScore'],
    sampleMode: 'max',
    minSampleCount: 15 * 60_000,
    scoreMeaning: 'night_pressure_profile_strength',
  }),
  late_night: calibrationSpec({
    sensitivity: NORMAL,
    visibility: SHADOW,
    minConfidence: 0.4,
    sampleKeys: ['nightMsToday'],
    minSampleCount: 1,
    scoreMeaning: 'night_pressure_context',
  }),
  intervention_resistance_loop: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.45,
    sampleKeys: ['frictionShown', 'reenteredWithin30m'],
    sampleMode: 'min',
    minSampleCount: 2,
    scoreMeaning: 'selected_cohort_repeated_reentry_intensity',
  }),
  intervention_reentry: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.45,
    sampleKeys: ['reenteredWithin30m'],
    sampleMode: 'max',
    minSampleCount: 1,
    scoreMeaning: 'intervention_outcome_reentry_strength',
  }),
  intervention_recovery: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.45,
    sampleKeys: ['left'],
    sampleMode: 'min',
    minSampleCount: 1,
    scoreMeaning: 'observed_leave_choice_count',
  }),
  controlled_brief_check: calibrationSpec({
    sensitivity: CONSERVATIVE,
    minConfidence: 0.5,
    sampleKeys: ['todayMs', 'visitOrSessionCount', 'controlledBriefScore'],
    sampleMode: 'max',
    minSampleCount: 1,
    scoreMeaning: 'measured_brevity_strength',
  }),
});

function sampleValue(pattern, spec) {
  const values = spec.sampleKeys.map((key) => toNumber(pattern?.evidence?.[key]));
  if (values.length === 0) return 0;
  if (spec.sampleMode === 'sum') {
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (spec.sampleMode === 'min') {
    return Math.min(...values);
  }
  return Math.max(...values);
}

function resolvePresentation(pattern, spec) {
  const presentation = {
    ...(pattern?.presentation || {}),
  };
  if (spec.visibility === SITE_PULL_PATTERN_CALIBRATION_VISIBILITY.SUPPORTING) {
    presentation.slot = 'supporting';
  }
  if (spec.visibility === SITE_PULL_PATTERN_CALIBRATION_VISIBILITY.SHADOW) {
    presentation.slot = 'shadow';
  }
  return presentation;
}

function buildFailures(pattern, spec, metrics) {
  const failures = [];
  if (metrics.confidence < spec.minConfidence) {
    failures.push(`confidence>=${spec.minConfidence}`);
  }
  if (metrics.score < spec.minScore) {
    failures.push(`score>=${spec.minScore}`);
  }
  if (metrics.evidenceStrength < spec.minEvidenceStrength) {
    failures.push(`evidenceStrength>=${spec.minEvidenceStrength}`);
  }
  if (spec.sampleKeys.length > 0 && metrics.sampleCount < spec.minSampleCount) {
    failures.push(`sample(${spec.sampleKeys.join('|')})>=${spec.minSampleCount}`);
  }
  return failures;
}

export function getSitePullPatternCalibration(id) {
  return SITE_PULL_PATTERN_CALIBRATION[id] || null;
}

function requireCalibrationResultStatus(result) {
  const status = typeof result?.status === 'string' ? result.status : '';
  if (!SITE_PULL_PATTERN_CALIBRATION_RESULT_STATUSES.has(status)) {
    throw new Error(`SITE_PULL_PATTERN_CALIBRATION_RESULT_STATUS_INVALID:${status || 'missing'}`);
  }
  return status;
}

export function calibrateSitePullPatternSignal(pattern) {
  if (!pattern?.id) {
    return {
      status: 'rejected',
      pattern: null,
      rejection: {
        id: '',
        reason: 'calibration_failed',
        failures: ['id'],
        source: pattern?.source || null,
        level: pattern?.level || null,
        category: pattern?.category || null,
      },
      row: {
        id: '',
        status: 'rejected',
        failures: ['id'],
      },
    };
  }

  const spec = getSitePullPatternCalibration(pattern.id);
  if (!spec) {
    return {
      status: 'rejected',
      pattern: null,
      rejection: {
        id: pattern.id,
        reason: 'missing_pattern_calibration',
        failures: ['calibration'],
        source: pattern.source || null,
        level: pattern.level || null,
        category: pattern.category || null,
      },
      row: {
        id: pattern.id,
        status: 'rejected',
        failures: ['calibration'],
      },
    };
  }

  const metrics = {
    score: clamp(toNumber(pattern.score), 0, 100),
    confidence: clamp01(pattern.confidence),
    sampleCount: sampleValue(pattern, spec),
  };
  const decisionQuality = buildSitePullPatternDecisionQuality(pattern, spec, metrics);
  metrics.evidenceStrength = decisionQuality.score;
  const failures = buildFailures(pattern, spec, metrics);
  const status = failures.length > 0
    ? 'rejected'
    : spec.visibility === SITE_PULL_PATTERN_CALIBRATION_VISIBILITY.SHADOW
      ? 'shadow'
      : spec.visibility === SITE_PULL_PATTERN_CALIBRATION_VISIBILITY.SUPPORTING
        ? 'supporting'
        : 'accepted';
  const calibration = {
    version: SITE_PULL_PATTERN_CALIBRATION_VERSION,
    decisionQualityVersion: SITE_PULL_PATTERN_DECISION_QUALITY_VERSION,
    status,
    sensitivity: spec.sensitivity,
    visibility: spec.visibility,
    scoreMeaning: spec.scoreMeaning,
    missingDataBehavior: spec.missingDataBehavior,
    evidenceStrength: Number(metrics.evidenceStrength.toFixed(4)),
    decisionQuality,
    sampleCount: Number(metrics.sampleCount.toFixed(4)),
    minScore: spec.minScore,
    minConfidence: spec.minConfidence,
    minEvidenceStrength: spec.minEvidenceStrength,
    minSampleCount: spec.minSampleCount,
    sampleKeys: [...spec.sampleKeys],
    sampleMode: spec.sampleMode,
    ...(spec.explanationKey ? { explanationKey: spec.explanationKey } : {}),
    ...(failures.length > 0 ? { failures } : {}),
  };
  const row = {
    id: pattern.id,
    status,
    sensitivity: spec.sensitivity,
    visibility: spec.visibility,
    scoreMeaning: spec.scoreMeaning,
    score: metrics.score,
    confidence: Number(metrics.confidence.toFixed(4)),
    evidenceStrength: Number(metrics.evidenceStrength.toFixed(4)),
    decisionQualityStatus: decisionQuality.status,
    decisionQualityScore: decisionQuality.score,
    sampleCount: Number(metrics.sampleCount.toFixed(4)),
    failures,
  };

  if (failures.length > 0) {
    return {
      status,
      pattern: null,
      rejection: {
        id: pattern.id,
        reason: 'calibration_failed',
        failures,
        source: pattern.source || null,
        level: pattern.level || null,
        category: pattern.category || null,
      },
      row,
    };
  }

  return {
    status,
    pattern: {
      ...pattern,
      presentation: resolvePresentation(pattern, spec),
      calibration,
    },
    rejection: null,
    row,
  };
}

function buildSummary(results = []) {
  return results.reduce((summary, result) => {
    const key = requireCalibrationResultStatus(result);
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
}

export function calibrateSitePullPatternSignals(patterns = []) {
  const results = (Array.isArray(patterns) ? patterns : [])
    .map((pattern) => calibrateSitePullPatternSignal(pattern));
  return {
    version: SITE_PULL_PATTERN_CALIBRATION_VERSION,
    patterns: results.map((result) => result.pattern).filter(Boolean),
    rejectedPatterns: results.map((result) => result.rejection).filter(Boolean),
    rows: results.map((result) => result.row).filter(Boolean),
    summary: buildSummary(results),
  };
}
