import {
  createCanonicalKoiAppearance,
  resolveCanonicalKoiBodyMaterialTones,
} from '../../../api/landingKoi.js';

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function freezeRecords(records) {
  return Object.freeze(records.map((record) => Object.freeze(record)));
}

function freezeKoiRecords(records) {
  return Object.freeze(records.map((record) => Object.freeze({
    ...record,
    palette: Object.freeze({ ...record.palette }),
    pattern: freezeRecords(record.pattern),
  })));
}

function requireKoiColor(value, field, koiId) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`ZEN_LANDING_KOI_${String(koiId).toUpperCase()}_${field}_REQUIRED`);
  }
  return value.trim();
}

function createLandingKoi({
  appearanceSeed,
  paletteIndex,
  ...motion
}) {
  const random = createSeededRandom(appearanceSeed);
  const appearance = createCanonicalKoiAppearance({
    profile: {
      seed: appearanceSeed,
      paletteIndex,
    },
    seed: appearanceSeed,
    rng: random,
  });
  const koiId = motion.id;
  const bodyMaterial = resolveCanonicalKoiBodyMaterialTones(appearance.colorBody);
  const patternColor = appearance.colorPattern;
  const secondaryColor = appearance.colorSecondary;
  const pattern = Array.isArray(appearance.patternMarks)
    ? appearance.patternMarks.map((mark) => ({
      at: mark.t,
      side: mark.side,
      length: Math.max(0.045, Math.min(0.24, mark.scale * mark.scaleX * 0.24)),
      width: Math.max(0.36, Math.min(1.12, mark.scale * mark.scaleY * 1.34)),
      rotation: mark.rotation,
      colorRole: mark.color === 'secondary' ? 'secondary' : 'pattern',
    }))
    : [];

  return {
    ...motion,
    appearanceSeed,
    appearanceSignature: appearance.patternSignature,
    palette: {
      body: requireKoiColor(bodyMaterial.body, 'BODY_COLOR', koiId),
      highlight: requireKoiColor(bodyMaterial.headHighlight, 'HIGHLIGHT_COLOR', koiId),
      shade: requireKoiColor(bodyMaterial.tailShade, 'SHADE_COLOR', koiId),
      pattern: patternColor
        ? requireKoiColor(patternColor, 'PATTERN_COLOR', koiId)
        : requireKoiColor(appearance.colorBody, 'PATTERN_COLOR', koiId),
      secondary: secondaryColor
        ? requireKoiColor(secondaryColor, 'SECONDARY_COLOR', koiId)
        : null,
      accent: requireKoiColor(appearance.eyeColor, 'EYE_COLOR', koiId),
      fin: requireKoiColor(appearance.colorFin, 'FIN_COLOR', koiId),
    },
    pattern,
  };
}

function createPetals() {
  const random = createSeededRandom(0x5a454e31);
  return freezeRecords(Array.from({ length: 13 }, (_, index) => ({
    x: 0.06 + (random() * 0.88),
    y: 0.48 + (random() * 0.49),
    phase: random() * Math.PI * 2,
    scale: 0.58 + (random() * 0.68),
    drift: 0.45 + (random() * 0.8),
    rotation: random() * Math.PI * 2,
    delay: index / 13,
  })));
}

function createWaterThreads() {
  const random = createSeededRandom(0x504f4e44);
  return freezeRecords(Array.from({ length: 17 }, (_, index) => ({
    y: 0.46 + (random() * 0.48),
    phase: random() * Math.PI * 2,
    length: 0.025 + (random() * 0.085),
    x: 0.04 + (random() * 0.9),
    amplitude: 0.7 + (random() * 1.7),
    tilt: -0.18 + (random() * 0.36),
    weight: 0.45 + (random() * 0.9),
    cadence: 0.55 + (random() * 0.85),
  })));
}

function createCausticRibbons() {
  const random = createSeededRandom(0x43415553);
  return freezeRecords(Array.from({ length: 15 }, () => ({
    x: 0.04 + (random() * 0.9),
    y: 0.47 + (random() * 0.48),
    phase: random() * Math.PI * 2,
    length: 0.045 + (random() * 0.12),
    bend: -0.55 + (random() * 1.1),
    rotation: -0.52 + (random() * 1.04),
    weight: 0.7 + (random() * 1.5),
    cadence: 0.44 + (random() * 0.72),
    intensity: 0.42 + (random() * 0.58),
  })));
}

function createRefractionBands() {
  const random = createSeededRandom(0x52454652);
  return freezeRecords(Array.from({ length: 9 }, (_, index) => ({
    y: 0.425 + (random() * 0.54),
    phase: random() * Math.PI * 2,
    amplitude: 0.0025 + (random() * 0.0065),
    cadence: 0.26 + (random() * 0.48),
    width: 7 + (random() * 19),
    opacity: 0.3 + (random() * 0.55),
    polarity: index % 3 === 0 ? -1 : 1,
  })));
}

function createBenthicPatches() {
  const random = createSeededRandom(0x42454e54);
  return freezeRecords(Array.from({ length: 10 }, (_, index) => ({
    x: 0.05 + (random() * 0.9),
    y: 0.5 + (random() * 0.46),
    radiusX: 0.035 + (random() * 0.09),
    radiusY: 0.012 + (random() * 0.038),
    rotation: -0.7 + (random() * 1.4),
    opacity: 0.28 + (random() * 0.52),
    tone: index % 3,
  })));
}

function createBenthicGrains() {
  const random = createSeededRandom(0x47524149);
  return freezeRecords(Array.from({ length: 34 }, () => ({
    x: 0.035 + (random() * 0.93),
    y: 0.47 + (random() * 0.5),
    radius: 0.45 + (random() * 1.5),
    opacity: 0.15 + (random() * 0.42),
  })));
}

export const ZEN_LANDING_PETALS = createPetals();
export const ZEN_LANDING_WATER_THREADS = createWaterThreads();
export const ZEN_LANDING_CAUSTIC_RIBBONS = createCausticRibbons();
export const ZEN_LANDING_REFRACTION_BANDS = createRefractionBands();
export const ZEN_LANDING_BENTHIC_PATCHES = createBenthicPatches();
export const ZEN_LANDING_BENTHIC_GRAINS = createBenthicGrains();

export const ZEN_LANDING_KOI = freezeKoiRecords([
  createLandingKoi({
    id: 'ivory-guardian',
    appearanceSeed: 0x4b4f4931,
    paletteIndex: 0,
    x: 0.26,
    y: 0.7,
    scale: 0.86,
    phase: 0.4,
    speed: 0.62,
    orbitX: 0.055,
    orbitY: 0.026,
    orbitTilt: -0.17,
    depth: 0.16,
    glide: 0.86,
    wake: 0.78,
  }),
  createLandingKoi({
    id: 'ember-resident',
    appearanceSeed: 0x4b4f4932,
    paletteIndex: 9,
    x: 0.5,
    y: 0.83,
    scale: 0.68,
    phase: 2.7,
    speed: 0.48,
    orbitX: 0.04,
    orbitY: 0.021,
    orbitTilt: 0.12,
    depth: 0.25,
    glide: 0.62,
    wake: 0.52,
  }),
  createLandingKoi({
    id: 'smoke-scout',
    appearanceSeed: 0x4b4f4933,
    paletteIndex: 21,
    x: 0.74,
    y: 0.66,
    scale: 0.76,
    phase: 4.5,
    speed: 0.55,
    orbitX: 0.066,
    orbitY: 0.018,
    orbitTilt: -0.08,
    depth: 0.32,
    glide: 0.74,
    wake: 0.66,
  }),
]);
