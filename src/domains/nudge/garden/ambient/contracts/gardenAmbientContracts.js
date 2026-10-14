export const GARDEN_AMBIENT_TONES = Object.freeze([
  'calm',
  'clear',
  'watchful',
  'overcast',
  'recovery',
]);

export const GARDEN_AMBIENT_CEREMONIES = Object.freeze([
  'none',
  'daily_blossom',
  'dawn_ripple',
  'clear_air',
  'returning_light',
]);

export const GARDEN_AMBIENT_SURFACES = Object.freeze([
  'shell',
  'overview',
  'popup',
  'garden',
]);

export const GARDEN_AMBIENT_TIERS = Object.freeze([
  'quiet',
  'accent',
  'ceremony',
]);

export const DEFAULT_GARDEN_AMBIENT_TONE = 'calm';
export const DEFAULT_GARDEN_AMBIENT_CEREMONY = 'none';
export const DEFAULT_GARDEN_AMBIENT_SURFACE = 'shell';
export const DEFAULT_GARDEN_AMBIENT_TIER = 'quiet';

const TONE_SET = new Set(GARDEN_AMBIENT_TONES);
const CEREMONY_SET = new Set(GARDEN_AMBIENT_CEREMONIES);
const SURFACE_SET = new Set(GARDEN_AMBIENT_SURFACES);
const TIER_SET = new Set(GARDEN_AMBIENT_TIERS);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clampUnit(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim())));
}

export function isGardenAmbientTone(value) {
  return typeof value === 'string' && TONE_SET.has(value);
}

export function isGardenAmbientCeremony(value) {
  return typeof value === 'string' && CEREMONY_SET.has(value);
}

export function isGardenAmbientSurface(value) {
  return typeof value === 'string' && SURFACE_SET.has(value);
}

export function isGardenAmbientTier(value) {
  return typeof value === 'string' && TIER_SET.has(value);
}

export function normalizeGardenAmbientTone(value, fallback = DEFAULT_GARDEN_AMBIENT_TONE) {
  return isGardenAmbientTone(value) ? value : fallback;
}

export function normalizeGardenAmbientCeremony(value, fallback = DEFAULT_GARDEN_AMBIENT_CEREMONY) {
  return isGardenAmbientCeremony(value) ? value : fallback;
}

export function normalizeGardenAmbientSurface(value, fallback = DEFAULT_GARDEN_AMBIENT_SURFACE) {
  return isGardenAmbientSurface(value) ? value : fallback;
}

export function normalizeGardenAmbientTier(value, fallback = DEFAULT_GARDEN_AMBIENT_TIER) {
  return isGardenAmbientTier(value) ? value : fallback;
}

export function normalizeGardenAmbientAccents(rawAccents) {
  const source = isPlainObject(rawAccents) ? rawAccents : {};
  return {
    petals: clampUnit(source.petals, 0),
    ripples: clampUnit(source.ripples, 0),
    haze: clampUnit(source.haze, 0),
    glow: clampUnit(source.glow, 0),
  };
}

export function buildEmptyGardenAmbientSnapshot() {
  return {
    version: 1,
    cycleKey: '',
    tone: DEFAULT_GARDEN_AMBIENT_TONE,
    ceremony: {
      id: DEFAULT_GARDEN_AMBIENT_CEREMONY,
      eligible: false,
    },
    accents: normalizeGardenAmbientAccents({}),
    reasonCodes: [],
    meta: {
      source: 'unset',
      generatedAt: 0,
    },
  };
}

export function normalizeGardenAmbientSnapshot(rawSnapshot) {
  const source = isPlainObject(rawSnapshot) ? rawSnapshot : {};
  const ceremony = isPlainObject(source.ceremony) ? source.ceremony : {};
  const meta = isPlainObject(source.meta) ? source.meta : {};

  return {
    version: 1,
    cycleKey: normalizeString(source.cycleKey, ''),
    tone: normalizeGardenAmbientTone(source.tone),
    ceremony: {
      id: normalizeGardenAmbientCeremony(ceremony.id),
      eligible: ceremony.eligible === true,
    },
    accents: normalizeGardenAmbientAccents(source.accents),
    reasonCodes: normalizeStringList(source.reasonCodes),
    meta: {
      source: normalizeString(meta.source, 'unset'),
      generatedAt: Number.isFinite(Number(meta.generatedAt)) ? Number(meta.generatedAt) : 0,
    },
  };
}

export function buildGardenAmbientSurfaceState(rawState = {}) {
  const source = isPlainObject(rawState) ? rawState : {};
  return {
    surface: normalizeGardenAmbientSurface(source.surface),
    cycleKey: normalizeString(source.cycleKey, ''),
    tone: normalizeGardenAmbientTone(source.tone),
    ceremony: normalizeGardenAmbientCeremony(source.ceremony),
    tier: normalizeGardenAmbientTier(source.tier),
    accents: normalizeGardenAmbientAccents(source.accents),
    reasonCodes: normalizeStringList(source.reasonCodes),
    meta: isPlainObject(source.meta) ? { ...source.meta } : {},
  };
}
