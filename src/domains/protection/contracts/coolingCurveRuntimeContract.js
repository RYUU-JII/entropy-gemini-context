import { COOLING_CURVE_PRESET_IDS } from '../../settings/config/coolingCurvePolicy.js';

/** Quantized background projection. Content never receives the budget ratio. */
export function requireCoolingCurveRuntimeState(value) {
  const keys = ['state', 'step', 'ended', 'preset'];
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== keys.sort().join('|')
    || !['active', 'no_budget', 'no_basis'].includes(value.state)
    || !Number.isInteger(value.step) || value.step < 0 || value.step > 16
    || typeof value.ended !== 'boolean' || !COOLING_CURVE_PRESET_IDS.includes(value.preset)
    || (value.state === 'active' ? value.ended !== (value.step === 16) : value.step !== 0 || value.ended)) {
    throw new Error('COOLING_CURVE_RUNTIME_STATE_INVALID');
  }
  return value;
}

// An absent runtime read model has no curve projection. Present metadata is strict.
export function normalizeOptionalCoolingCurveRuntimeState(value) {
  return value === null || value === undefined ? null : { ...requireCoolingCurveRuntimeState(value) };
}
