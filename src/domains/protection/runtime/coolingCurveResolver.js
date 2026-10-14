import { normalizeDomain } from '../../../lib/domain.js';
import { requireCoolingCurve } from '../../settings/config/coolingCurvePolicy.js';
import { requireCoolingCurveRuntimeState } from '../contracts/coolingCurveRuntimeContract.js';
export { requireCoolingCurveRuntimeState } from '../contracts/coolingCurveRuntimeContract.js';
import { COOLING_CURVE_PRESETS, COOLING_CURVE_SLOTS, COOLING_CURVE_FINAL_APPROACH, COOLING_CURVE_STEPS } from '../catalog/coolingCurvePresets.js';
import { COOLING_CURVE_FEATURE_BINDINGS } from './canonicalArtifactRuntimeBinding.js';
import { FRICTION_MODIFIER_OPERATIONS, FRICTION_MODIFIER_PRIORITIES, FRICTION_MODIFIER_SCOPE_KINDS,
  FRICTION_MODIFIER_SOURCES, FRICTION_MODIFIER_TARGETS, normalizeFrictionModifierIntent,
  createFilterIntensityModifier, createFrictionStrengthScaleModifier, createFrictionSuspendModifier } from './frictionModifierResolver.js';

function exact(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

export function requireCoolingCurvePlan(value) {
  if (!exact(value, ['modifiers', 'coolingCurve', 'controlledFeatureKeys']) || !Array.isArray(value.modifiers)
    || !Array.isArray(value.controlledFeatureKeys) || new Set(value.controlledFeatureKeys).size !== value.controlledFeatureKeys.length
    || value.controlledFeatureKeys.some(key => !Object.hasOwn(COOLING_CURVE_FEATURE_BINDINGS, key))) {
    throw new Error('COOLING_CURVE_PLAN_INVALID');
  }
  const state = requireCoolingCurveRuntimeState(value.coolingCurve);
  if (state.state !== 'active' && (value.modifiers.length !== 0 || value.controlledFeatureKeys.length !== 0)) {
    throw new Error('COOLING_CURVE_INACTIVE_PLAN_INVALID');
  }
  for (const intent of value.modifiers) {
    const modifier = normalizeFrictionModifierIntent(intent);
    const expected = ['id', 'source', 'operation', 'scope', 'target', 'delta', 'active', 'priority', 'expiresAt',
      ...(modifier.operation === FRICTION_MODIFIER_OPERATIONS.SCALE_STRENGTH ? ['strengthPermille'] : [])];
    if (!exact(intent, expected) || modifier.source !== FRICTION_MODIFIER_SOURCES.COOLING_CURVE
      || modifier.priority !== FRICTION_MODIFIER_PRIORITIES.COOLING_CURVE || !modifier.active || modifier.expiresAt !== null
      || modifier.scope.kind !== FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN
      || modifier.target.kind !== FRICTION_MODIFIER_TARGETS.FEATURE_KEYS || modifier.target.featureKeys.length !== 1
      || modifier.target.featureKeys.some(key => !value.controlledFeatureKeys.includes(key))) {
      throw new Error('COOLING_CURVE_MODIFIER_INVALID');
    }
  }
  return value;
}

function smoothstep(onset, full, value) {
  const t = Math.max(0, Math.min(1, (value - onset) / (full - onset)));
  return t * t * (3 - 2 * t);
}

function quantizeWarpedProgress(warped, ended) {
  const scaled = warped * COOLING_CURVE_STEPS;
  const nearest = Math.round(scaled);
  // Canonicalize arithmetic noise at exact mathematical step boundaries. This
  // is bounded to four floating-point ULPs, far below usage-clock precision.
  const exactBoundary = Math.abs(scaled - nearest) <= Number.EPSILON * Math.max(1, scaled) * 4;
  return ended ? COOLING_CURVE_STEPS : Math.min(COOLING_CURVE_STEPS - 1, Math.floor(exactBoundary ? nearest : scaled));
}

/** BudgetSnapshotReader owns the ratio. This owner only quantizes that admitted
 * input; raw progress never appears in the returned content-facing projection. */
export function resolveCoolingCurve({ hostname, budgetRatio, siteGoalMinutes, recordingAvailable, coolingCurve }) {
  const setting = requireCoolingCurve(coolingCurve);
  if (typeof hostname !== 'string' || !hostname || normalizeDomain(hostname) !== hostname
    || !Number.isSafeInteger(siteGoalMinutes) || siteGoalMinutes < 0 || typeof recordingAvailable !== 'boolean'
    || (budgetRatio !== null && (typeof budgetRatio !== 'number' || !Number.isFinite(budgetRatio) || budgetRatio < 0))) {
    throw new Error('COOLING_CURVE_INPUT_INVALID');
  }
  const state = siteGoalMinutes === 0 ? 'no_budget' : !recordingAvailable ? 'no_basis' : 'active';
  if (state !== 'active') return requireCoolingCurvePlan({ modifiers: [], controlledFeatureKeys: [],
    coolingCurve: { state, step: 0, ended: false, preset: setting.preset } });
  if (budgetRatio === null) throw new Error('COOLING_CURVE_BUDGET_RATIO_REQUIRED');
  const parameters = setting.advanced === null ? COOLING_CURVE_PRESETS[setting.preset] : setting.advanced;
  const start = parameters.startPercent / 100, acceleration = parameters.acceleration / 100;
  const warped = Math.max(0, Math.min(1, (budgetRatio - start) / (1 - start))) ** acceleration;
  const ended = budgetRatio >= 1;
  const step = quantizeWarpedProgress(warped, ended), quantized = step / COOLING_CURVE_STEPS;
  const finalApproach = ended || quantized >= COOLING_CURVE_FINAL_APPROACH.onset;
  const modifiers = [], controlledFeatureKeys = [];
  for (const [featureKey, binding] of Object.entries(COOLING_CURVE_FEATURE_BINDINGS)) {
    if (setting.families[binding.family] !== 'curve') continue;
    controlledFeatureKeys.push(featureKey);
    const window = COOLING_CURVE_SLOTS[binding.slot];
    const fraction = smoothstep(window.onset, window.full, quantized);
    const common = { id: `cooling_curve:${featureKey}`, source: FRICTION_MODIFIER_SOURCES.COOLING_CURVE,
      priority: FRICTION_MODIFIER_PRIORITIES.COOLING_CURVE,
      scope: { kind: FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN, hostname }, featureKeys: [featureKey] };
    if (fraction === 0) {
      modifiers.push(createFrictionSuspendModifier(common));
      continue;
    }
    if (binding.form === 'strength_scale') modifiers.push(createFrictionStrengthScaleModifier({ ...common,
      id: `${common.id}:scale`, strengthPermille: Math.round(fraction * 1000) }));
    // Binary children own no strength band; their sole curve actuation is onset.
    if (binding.form !== 'binary_onset' && finalApproach) modifiers.push(createFilterIntensityModifier({
      ...common, id: `${common.id}:final`, delta: 1 }));
    else if (binding.form === 'band' && fraction < 0.5) modifiers.push(createFilterIntensityModifier({
      ...common, id: `${common.id}:ramp`, delta: -1 }));
  }
  return requireCoolingCurvePlan({ modifiers, controlledFeatureKeys,
    coolingCurve: { state, step, ended, preset: setting.preset } });
}
