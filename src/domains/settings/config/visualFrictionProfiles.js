import { requireFrictionIntensityBand } from './frictionIntensityBands.js';

// Persisted Lens values are integer strengths. This owner alone maps them to CSS.
export const VISUAL_FRICTION_CONTROLS = Object.freeze({
  blur: Object.freeze({ defaultStrength: 20, maximum: 8, unit: 'px' }),
  saturation: Object.freeze({ defaultStrength: 70, maximum: 1, unit: '' }),
  brightness: Object.freeze({ defaultStrength: 20, maximum: 0.3, unit: '' }),
  contrast: Object.freeze({ defaultStrength: 20, maximum: 0.7, unit: '' }),
  colorSaturation: Object.freeze({ defaultStrength: 45, maximum: 1, unit: '' }),
});
export const VISUAL_FRICTION_FEATURE_KEYS = Object.freeze(Object.keys(VISUAL_FRICTION_CONTROLS));
export const MEDIA_VISUAL_FEATURE_KEYS = Object.freeze(['blur', 'brightness', 'contrast', 'colorSaturation']);
const BAND_SCALE = Object.freeze({ relaxed: 0.6, normal: 1, reinforced: 1.35 });
const MEDIA_VISUAL_CSS_FUNCTIONS = Object.freeze({ blur: 'blur', brightness: 'brightness', contrast: 'contrast', colorSaturation: 'saturate' });

export function isVisualFrictionProfileKey(key) {
  return Object.hasOwn(VISUAL_FRICTION_CONTROLS, key);
}

export function requireVisualFrictionStrength(value) {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error('VISUAL_FRICTION_STRENGTH_INVALID');
  return value;
}

export function requireVisualFrictionScale(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== 'priority|strengthPermille'
    || !Number.isInteger(value.strengthPermille) || value.strengthPermille < 0 || value.strengthPermille > 1000
    || !Number.isInteger(value.priority)) throw new Error('VISUAL_FRICTION_SCALE_INVALID');
  return value;
}

export function normalizeVisualFrictionSetting(key, entry) {
  if (!isVisualFrictionProfileKey(key)) throw new Error('VISUAL_FRICTION_PROFILE_KEY_INVALID:' + key);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || typeof entry.isActive !== 'boolean'
    || Object.keys(entry).length !== 2 || !Object.hasOwn(entry, 'value')) {
    throw new Error('VISUAL_FRICTION_SETTING_INVALID:' + key);
  }
  return { isActive: entry.isActive, value: requireVisualFrictionStrength(entry.value) };
}

export function getVisualFrictionProfile(key, band, strength = VISUAL_FRICTION_CONTROLS[key]?.defaultStrength, strengthPermille = 1000) {
  if (!isVisualFrictionProfileKey(key)) throw new Error('VISUAL_FRICTION_PROFILE_KEY_INVALID:' + key);
  const control = VISUAL_FRICTION_CONTROLS[key];
  const selectedBand = requireFrictionIntensityBand(band);
  if (!Number.isInteger(strengthPermille) || strengthPermille < 0 || strengthPermille > 1000) throw new Error('VISUAL_FRICTION_SCALE_INVALID');
  const scaledStrength = Math.round(requireVisualFrictionStrength(strength) * strengthPermille / 1000);
  const effectiveStrength = Math.min(100, Math.round(scaledStrength * BAND_SCALE[selectedBand]));
  const amount = control.maximum * effectiveStrength / 100;
  const value = key === 'blur' ? Number(amount.toFixed(3)) + 'px' : Number((1 - amount).toFixed(3));
  return Object.freeze({ value, strength, effectiveStrength });
}

export const VISUAL_FRICTION_PROFILES = Object.freeze(Object.fromEntries(VISUAL_FRICTION_FEATURE_KEYS.map(key => [
  key, Object.freeze(Object.fromEntries(Object.keys(BAND_SCALE).map(band => [band, getVisualFrictionProfile(key, band)]))),
])));

export function requireVisualFrictionEntry(key, entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.isActive !== 'boolean') throw new Error('VISUAL_FRICTION_ENTRY_INVALID:' + key);
  for (const field of ['level', 'step', 'effectBand', 'intensityAdjustment']) {
    if (Object.hasOwn(entry, field)) throw new Error('VISUAL_FRICTION_ENTRY_FIELD_INVALID:' + key + ':' + field);
  }
  const scale = Object.hasOwn(entry, 'frictionModifierScale') ? requireVisualFrictionScale(entry.frictionModifierScale).strengthPermille : 1000;
  const profile = getVisualFrictionProfile(key, entry.band, requireVisualFrictionStrength(entry.strength), scale);
  if (!Object.is(entry.value, profile.value) || entry.effectiveStrength !== profile.effectiveStrength) throw new Error('VISUAL_FRICTION_ENTRY_VALUE_MISMATCH:' + key);
  return entry;
}

export function buildMediaVisualFilterValue(filters) {
  const parts = [];
  for (const key of MEDIA_VISUAL_FEATURE_KEYS) {
    const entry = filters[key];
    if (!entry?.isActive) continue;
    requireVisualFrictionEntry(key, entry);
    parts.push(MEDIA_VISUAL_CSS_FUNCTIONS[key] + '(' + entry.value + ')');
  }
  return parts.join(' ');
}
