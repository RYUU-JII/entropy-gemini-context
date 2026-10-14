export const FRICTION_INTENSITY_BANDS = Object.freeze({
  RELAXED: 'relaxed',
  NORMAL: 'normal',
  REINFORCED: 'reinforced',
});

export const FRICTION_INTENSITY_BAND_IDS = Object.freeze(Object.values(FRICTION_INTENSITY_BANDS));

export function requireFrictionIntensityBand(band) {
  if (!FRICTION_INTENSITY_BAND_IDS.includes(band)) {
    throw new Error(`FRICTION_INTENSITY_BAND_INVALID:${String(band)}`);
  }
  return band;
}

// Deltas are policy intents, never persisted user levels or cumulative state.
export function requireFrictionIntensityDelta(delta) {
  if (!Number.isInteger(delta) || delta < -1 || delta > 1) {
    throw new Error('FRICTION_INTENSITY_DELTA_INVALID');
  }
  return delta;
}

export function resolveFrictionIntensityBand(delta) {
  requireFrictionIntensityDelta(delta);
  if (delta < 0) return FRICTION_INTENSITY_BANDS.RELAXED;
  if (delta > 0) return FRICTION_INTENSITY_BANDS.REINFORCED;
  return FRICTION_INTENSITY_BANDS.NORMAL;
}

// Ordinals are presentation-only; they never select runtime physical values.
export function getFrictionIntensityOrdinal(band) {
  return FRICTION_INTENSITY_BAND_IDS.indexOf(requireFrictionIntensityBand(band)) + 1;
}
