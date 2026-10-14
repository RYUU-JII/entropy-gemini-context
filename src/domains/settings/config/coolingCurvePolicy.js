export const COOLING_CURVE_PRESET_IDS = Object.freeze(['gentle', 'standard', 'steep']);
export const COOLING_CURVE_FAMILY_IDS = Object.freeze(['lens', 'veil', 'brake', 'barrier']);
export const COOLING_CURVE_FAMILY_MODES = Object.freeze(['curve', 'fixed']);
export const DEFAULT_COOLING_CURVE = Object.freeze({
  preset: 'standard',
  families: Object.freeze({ lens: 'curve', veil: 'curve', brake: 'fixed', barrier: 'curve' }),
  advanced: null,
});

function invalid(field) { throw new Error(`COOLING_CURVE_SETTING_INVALID:${field}`); }
function exact(value, keys, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) invalid(field);
}

export function requireCoolingCurve(value) {
  exact(value, ['preset', 'families', 'advanced'], 'shape');
  if (!COOLING_CURVE_PRESET_IDS.includes(value.preset)) invalid('preset');
  exact(value.families, COOLING_CURVE_FAMILY_IDS, 'families');
  for (const family of COOLING_CURVE_FAMILY_IDS) {
    if (!COOLING_CURVE_FAMILY_MODES.includes(value.families[family])) invalid(`families.${family}`);
  }
  if (value.advanced !== null) {
    exact(value.advanced, ['startPercent', 'acceleration'], 'advanced');
    if (!Number.isInteger(value.advanced.startPercent) || value.advanced.startPercent < 5 || value.advanced.startPercent > 60) invalid('advanced.startPercent');
    if (!Number.isInteger(value.advanced.acceleration) || value.advanced.acceleration < 50 || value.advanced.acceleration > 200) invalid('advanced.acceleration');
  }
  return { preset: value.preset, families: { ...value.families }, advanced: value.advanced === null ? null : { ...value.advanced } };
}

/** The settings-default boundary admits an absent key; present values are exact. */
export function normalizeCoolingCurve(value) {
  return requireCoolingCurve(value === undefined ? DEFAULT_COOLING_CURVE : value);
}

export function resolveCoolingCurvePosture(value) {
  const { preset } = requireCoolingCurve(value);
  return { gentle: 'gentle', standard: 'balanced', steep: 'strict' }[preset];
}

export function setCoolingCurvePreset(current, preset) {
  return requireCoolingCurve({ ...requireCoolingCurve(current), preset, advanced: null });
}
export function setCoolingCurveFamilyMode(current, family, mode) {
  if (!COOLING_CURVE_FAMILY_IDS.includes(family)) invalid('family');
  const curve = requireCoolingCurve(current);
  return requireCoolingCurve({ ...curve, families: { ...curve.families, [family]: mode } });
}
export function setCoolingCurveAdvanced(current, advanced) {
  return requireCoolingCurve({ ...requireCoolingCurve(current), advanced });
}

export function applyCoolingCurveCommand(value, current) {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'operation')) return requireCoolingCurve(value);
  if (value.operation === 'set_preset') {
    exact(value, ['operation', 'preset'], 'command');
    return setCoolingCurvePreset(current, value.preset);
  }
  if (value.operation === 'set_family_mode') {
    exact(value, ['operation', 'family', 'mode'], 'command');
    return setCoolingCurveFamilyMode(current, value.family, value.mode);
  }
  if (value.operation === 'set_advanced') {
    exact(value, ['operation', 'advanced'], 'command');
    return setCoolingCurveAdvanced(current, value.advanced);
  }
  invalid('command.operation');
}
