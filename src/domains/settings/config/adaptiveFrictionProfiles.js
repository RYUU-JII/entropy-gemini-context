import { FRICTION_INTENSITY_BANDS, requireFrictionIntensityBand } from './frictionIntensityBands.js';
import { getVisualFrictionProfile, isVisualFrictionProfileKey, requireVisualFrictionEntry, requireVisualFrictionScale, VISUAL_FRICTION_FEATURE_KEYS } from './visualFrictionProfiles.js';
import { getTextRhythmRuntimeProfile, requireTextRhythmRuntimeProfile } from './textRhythmProfile.js';

export const ADAPTIVE_FRICTION_FEATURE_KEYS = Object.freeze([...VISUAL_FRICTION_FEATURE_KEYS, 'textRhythm']);

export function isAdaptiveFrictionFeatureKey(key) {
  return ADAPTIVE_FRICTION_FEATURE_KEYS.includes(key);
}

export function materializeAdaptiveFrictionEntry(key, entry, band = FRICTION_INTENSITY_BANDS.NORMAL) {
  if (!isAdaptiveFrictionFeatureKey(key)) throw new Error(`ADAPTIVE_FRICTION_KEY_INVALID:${key}`);
  if (!entry || typeof entry !== 'object' || typeof entry.isActive !== 'boolean') {
    throw new Error(`ADAPTIVE_FRICTION_ENTRY_INVALID:${key}`);
  }
  for (const field of ['level', 'step', 'effectBand', 'intensityAdjustment']) {
    if (Object.hasOwn(entry, field)) throw new Error(`ADAPTIVE_FRICTION_ENTRY_FIELD_INVALID:${key}:${field}`);
  }
  const selectedBand = requireFrictionIntensityBand(band);
  if (isVisualFrictionProfileKey(key)) {
    const scale = Object.hasOwn(entry, 'frictionModifierScale') ? requireVisualFrictionScale(entry.frictionModifierScale).strengthPermille : 1000;
    const profile = getVisualFrictionProfile(key, selectedBand, entry.value, scale);
    return { ...entry, ...profile, band: selectedBand };
  }
  return {
    ...entry,
    band: selectedBand,
    value: getTextRhythmRuntimeProfile(selectedBand),
  };
}

export function requireAdaptiveFrictionEntry(key, entry) {
  if (isVisualFrictionProfileKey(key)) return requireVisualFrictionEntry(key, entry);
  if (key !== 'textRhythm' || !entry || typeof entry.isActive !== 'boolean') {
    throw new Error(`ADAPTIVE_FRICTION_ENTRY_INVALID:${key}`);
  }
  for (const field of ['level', 'step', 'effectBand', 'intensityAdjustment']) {
    if (Object.hasOwn(entry, field)) throw new Error(`ADAPTIVE_FRICTION_ENTRY_FIELD_INVALID:${key}:${field}`);
  }
  const profile = requireTextRhythmRuntimeProfile(entry.value);
  if (profile.band !== requireFrictionIntensityBand(entry.band)) {
    throw new Error('ADAPTIVE_FRICTION_ENTRY_BAND_MISMATCH:textRhythm');
  }
  return entry;
}
