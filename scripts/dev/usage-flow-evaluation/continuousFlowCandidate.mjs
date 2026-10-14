import { validateFlowModelTrace } from './flowModelTraceContract.mjs';

// Provisional evaluation policy, not calibrated behavior or production defaults.
// The linear control and convex candidate differ only in recovery curvature.
export const FLOW_CANDIDATE_CONFIG = Object.freeze({
  massScale: 30,
  recoveryMs: 180_000,
  // A reviewed value below the gamma=0.5 boundary, whose continuous-drive
  // equilibrium has an unbounded right slope at the onset of retained memory.
  curvature: 0.25,
});

export { FLOW_CANDIDATE_SOURCE_FILES } from './flowEvaluationSources.mjs';

function fail(detail) {
  throw new Error(`FLOW_CANDIDATE_INVALID:${detail}`);
}

function requireNumber(value, detail, { minimum = 0, exclusive = false, maximum = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || (exclusive ? value <= minimum : value < minimum) || value > maximum) fail(detail);
  return value;
}

function requirePressure(pressure) {
  return requireNumber(pressure, 'pressure', { maximum: 1 });
}

function requireRecoveryConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('recovery_config_shape');
  requireNumber(config.recoveryMs, 'recovery_ms', { exclusive: true });
  requireNumber(config.curvature, 'curvature');
}

export function validateFlowCandidateConfig(config) {
  const keys = ['massScale', 'recoveryMs', 'curvature'];
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('config_shape');
  const actual = Reflect.ownKeys(config);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail('config_shape');
  for (const key of actual) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(config, key), 'value')) fail('config_shape');
  }
  requireNumber(config.massScale, 'mass_scale', { exclusive: true });
  requireRecoveryConfig(config);
}

function recoveryCoordinate(pressure, curvature) {
  const coordinate = pressure + curvature * pressure * pressure;
  if (!Number.isFinite(coordinate)) fail('recovery_coordinate_overflow');
  return coordinate;
}

/** Bounded jump with J(a, J(b, p)) = J(a+b, p), up to floating-point rounding. */
export function addFlowMass(pressure, mass, massScale) {
  requirePressure(pressure);
  requireNumber(mass, 'mass');
  requireNumber(massScale, 'mass_scale', { exclusive: true });
  if (mass === 0 || pressure === 1) return pressure;
  // An overflowing positive mass/scale ratio has the well-defined limit gain=1.
  const gain = -Math.expm1(-mass / massScale);
  const result = pressure + (1 - pressure) * gain;
  requirePressure(result);
  return result;
}

/** Wall-memory aging, not evidence of rest, reading, visibility, or attention. */
export function recoverFlowPressure(pressure, elapsedMs, config) {
  requirePressure(pressure);
  requireNumber(elapsedMs, 'elapsed_ms');
  requireRecoveryConfig(config);
  const { recoveryMs, curvature } = config;
  if (elapsedMs === 0 || pressure === 0) return pressure;
  const coordinate = recoveryCoordinate(pressure, curvature);
  const aged = Math.max(0, coordinate - elapsedMs / recoveryMs);
  if (aged === 0) return 0;
  const discriminant = 1 + 4 * curvature * aged;
  if (!Number.isFinite(discriminant)) fail('recovery_inverse_overflow');
  const result = 2 * aged / (1 + Math.sqrt(discriminant));
  requirePressure(result);
  return result;
}

export function flowRecoveryTimeMs(pressure, config) {
  requirePressure(pressure);
  requireRecoveryConfig(config);
  const { recoveryMs, curvature } = config;
  const result = recoveryCoordinate(pressure, curvature) * recoveryMs;
  if (!Number.isFinite(result)) fail('recovery_time_overflow');
  return result;
}

/**
 * Evaluation-only candidate at the confirmed measured-progression boundary.
 * Each surface retains its own unit; this is not a content-equivalence measure.
 * No callback bonus, gap-derived dwell, pressure threshold or decision feeds
 * back into measurements. Quality is summarized separately and never weights
 * pressure. Only p is recovery state: saturated input cannot hide extra debt.
 *
 * Source and availability are not upstream admission proofs at this boundary.
 * Their meaning remains unrepresented. Non-forward events advance the same
 * wall-memory clock but add no feed mass. This does not infer observed rest or
 * reconstruct writing, input coverage, media watching, or intervention exposure.
 */
export function replayContinuousFlowCandidate(trace, {
  variant = 'bounded_convex',
  config = FLOW_CANDIDATE_CONFIG,
} = {}) {
  validateFlowModelTrace(trace);
  validateFlowCandidateConfig(config);
  if (!['bounded_linear', 'bounded_convex'].includes(variant)) fail('variant');
  const effectiveConfig = Object.freeze({
    massScale: config.massScale,
    recoveryMs: config.recoveryMs,
    curvature: variant === 'bounded_linear' ? 0 : config.curvature,
  });
  let pressure = 0;
  let cursorMs = trace.startMs;
  let observedUnits = 0;
  let qualityMass = 0;
  let forwardEvents = 0;
  const curve = [];
  const unrepresented = new Set();

  function append(at, eventIndex, eventKind, advanceEvent = null) {
    pressure = recoverFlowPressure(pressure, at - cursorMs, effectiveConfig);
    cursorMs = at;
    if (advanceEvent !== null) {
      const mass = trace.surfaceMode === 'continuous'
        ? advanceEvent.screenfuls
        : advanceEvent.itemTransitions;
      pressure = addFlowMass(pressure, mass, effectiveConfig.massScale);
      observedUnits += mass;
      qualityMass += mass * advanceEvent.quality;
      if (!Number.isFinite(observedUnits) || !Number.isFinite(qualityMass)) fail('measurement_overflow');
      forwardEvents += 1;
    }
    const meanDetectorQuality = observedUnits > 0 ? qualityMass / observedUnits : null;
    if (meanDetectorQuality !== null) requireNumber(meanDetectorQuality, 'quality_mean', { maximum: 1 });
    const row = {
      at,
      eventIndex,
      eventKind,
      observationKind: advanceEvent === null ? 'reconcile' : 'advance',
      pressure,
      remainingRecoveryMs: flowRecoveryTimeMs(pressure, effectiveConfig),
      observedUnits,
      meanDetectorQuality,
    };
    curve.push(row);
    return row;
  }

  append(trace.startMs, -1, 'start');
  trace.events.forEach((event, eventIndex) => {
    let advanceEvent = null;
    if (event.kind === 'advance') {
      unrepresented.add('source_provenance');
      if (event.direction === 'forward') advanceEvent = event;
      else unrepresented.add('backward_intent');
    } else if (event.kind === 'availability') {
      unrepresented.add('visibility_and_measurement_availability');
    } else if (event.kind === 'input') {
      unrepresented.add('input_activity');
    } else {
      unrepresented.add('supply_to_full_runtime');
    }
    append(event.at, eventIndex, event.kind, advanceEvent);
  });
  const terminal = append(trace.endMs, trace.events.length, 'end');
  return {
    modelId: variant,
    config: effectiveConfig,
    unit: trace.surfaceMode === 'continuous' ? 'screenfuls' : 'item_transitions',
    scope: {
      entry: 'confirmed_measured_forward_progression',
      runtimeStatus: 'evaluation_only_no_runtime_consumer',
      policy: 'provisional_unvalidated_constants',
      curvatureGuidance: 'default_below_0_5_keeps_continuous_drive_onset_slope_finite',
      intervention: 'disabled_no_decision_feedback',
      pressureMeaning: 'bounded_memory_of_declared_surface_units_not_intention_or_harm_probability',
      qualityMeaning: 'mass_weighted_detector_quality_not_pressure_coefficient',
      interval: 'half_open_input_order_preserved_for_equal_timestamps',
      nonAdvanceEvents: 'zero_feed_mass_wall_memory_aging_only',
      silence: 'wall_memory_aging_not_observed_rest',
      admission: 'source_and_availability_not_interpreted_at_confirmed_boundary',
      observationLimits: 'input_duration_shared_draft_media_watch_and_intervention_exposure_unmeasured',
      emptyTraceMeaning: 'no_confirmed_forward_evidence_not_a_healthy_behavior_classification',
    },
    evidence: {
      status: forwardEvents > 0 ? 'partial_confirmed_advance_replay' : 'no_confirmed_forward_advances',
      confirmedForwardAdvanceEvents: forwardEvents,
      totalTraceEvents: trace.events.length,
    },
    representedChannels: forwardEvents > 0
      ? ['confirmed_forward_advancement', 'detector_quality_summary', 'surface_native_forward_units', 'wall_time_pressure_recovery']
      : [],
    unrepresentedChannels: [...unrepresented].sort(),
    curve,
    terminal,
  };
}
