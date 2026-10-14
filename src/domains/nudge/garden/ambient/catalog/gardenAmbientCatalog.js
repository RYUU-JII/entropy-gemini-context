import {
  GARDEN_AMBIENT_CEREMONIES,
  GARDEN_AMBIENT_SURFACES,
  GARDEN_AMBIENT_TONES,
  normalizeGardenAmbientAccents,
  normalizeGardenAmbientCeremony,
  normalizeGardenAmbientSurface,
  normalizeGardenAmbientTier,
  normalizeGardenAmbientTone,
} from '../contracts/gardenAmbientContracts.js';

function buildToneDefinition(id, definition = {}) {
  return {
    id: normalizeGardenAmbientTone(id),
    label: typeof definition.label === 'string' ? definition.label : id,
    description: typeof definition.description === 'string' ? definition.description : '',
    defaultAccents: normalizeGardenAmbientAccents(definition.defaultAccents),
  };
}

function buildCeremonyDefinition(id, definition = {}) {
  const allowedSurfaces = Array.isArray(definition.allowedSurfaces)
    ? definition.allowedSurfaces.map((surface) => normalizeGardenAmbientSurface(surface)).filter(Boolean)
    : [];

  return {
    id: normalizeGardenAmbientCeremony(id),
    label: typeof definition.label === 'string' ? definition.label : id,
    description: typeof definition.description === 'string' ? definition.description : '',
    allowedSurfaces: allowedSurfaces.length ? Array.from(new Set(allowedSurfaces)) : GARDEN_AMBIENT_SURFACES.slice(),
    tier: normalizeGardenAmbientTier(definition.tier),
    singleRunPerCycle: definition.singleRunPerCycle !== false,
    maxDurationMs: Number.isFinite(Number(definition.maxDurationMs)) ? Math.max(0, Number(definition.maxDurationMs)) : 0,
    defaultAccents: normalizeGardenAmbientAccents(definition.defaultAccents),
  };
}

export const GARDEN_AMBIENT_TONE_CATALOG = Object.freeze({
  calm: buildToneDefinition('calm', {
    label: 'Calm',
    description: 'Neutral baseline with barely visible pond motion.',
  }),
  clear: buildToneDefinition('clear', {
    label: 'Clear',
    description: 'A slightly brighter, more open state for steady days.',
    defaultAccents: { glow: 0.2 },
  }),
  watchful: buildToneDefinition('watchful', {
    label: 'Watchful',
    description: 'Still restrained, but a touch tighter and more alert.',
    defaultAccents: { ripples: 0.2 },
  }),
  overcast: buildToneDefinition('overcast', {
    label: 'Overcast',
    description: 'A dimmer, heavier tone without becoming punitive.',
    defaultAccents: { haze: 0.3 },
  }),
  recovery: buildToneDefinition('recovery', {
    label: 'Recovery',
    description: 'A gentler clearing state that suggests return and reset.',
    defaultAccents: { glow: 0.15, ripples: 0.15 },
  }),
});

export const GARDEN_AMBIENT_CEREMONY_CATALOG = Object.freeze({
  none: buildCeremonyDefinition('none', {
    label: 'None',
    description: 'No one-shot ceremony is scheduled for this cycle.',
    allowedSurfaces: GARDEN_AMBIENT_SURFACES,
    tier: 'quiet',
    singleRunPerCycle: false,
  }),
  daily_blossom: buildCeremonyDefinition('daily_blossom', {
    label: 'Daily Blossom',
    description: 'A single blossom drift on first meaningful entry after reset.',
    allowedSurfaces: ['shell', 'overview', 'garden'],
    tier: 'ceremony',
    singleRunPerCycle: true,
    maxDurationMs: 2600,
    defaultAccents: { petals: 0.75, glow: 0.15 },
  }),
  dawn_ripple: buildCeremonyDefinition('dawn_ripple', {
    label: 'Dawn Ripple',
    description: 'A calm opening ripple for stable mornings or gentle resets.',
    allowedSurfaces: ['overview', 'garden'],
    tier: 'accent',
    singleRunPerCycle: true,
    maxDurationMs: 1800,
    defaultAccents: { ripples: 0.65 },
  }),
  clear_air: buildCeremonyDefinition('clear_air', {
    label: 'Clear Air',
    description: 'A subtle atmospheric clearing used after sustained steadiness.',
    allowedSurfaces: ['shell', 'overview', 'popup', 'garden'],
    tier: 'accent',
    singleRunPerCycle: true,
    maxDurationMs: 1400,
    defaultAccents: { glow: 0.2, haze: 0.05 },
  }),
  returning_light: buildCeremonyDefinition('returning_light', {
    label: 'Returning Light',
    description: 'A quiet light return intended for recovery arcs rather than celebration.',
    allowedSurfaces: ['shell', 'overview', 'garden'],
    tier: 'ceremony',
    singleRunPerCycle: true,
    maxDurationMs: 2200,
    defaultAccents: { glow: 0.5, ripples: 0.2 },
  }),
});

export function getGardenAmbientToneDefinition(toneId) {
  const normalized = normalizeGardenAmbientTone(toneId);
  return GARDEN_AMBIENT_TONE_CATALOG[normalized] || GARDEN_AMBIENT_TONE_CATALOG.calm;
}

export function getGardenAmbientCeremonyDefinition(ceremonyId) {
  const normalized = normalizeGardenAmbientCeremony(ceremonyId);
  return GARDEN_AMBIENT_CEREMONY_CATALOG[normalized] || GARDEN_AMBIENT_CEREMONY_CATALOG.none;
}

export function validateGardenAmbientCatalog() {
  const toneIds = Object.keys(GARDEN_AMBIENT_TONE_CATALOG);
  const ceremonyIds = Object.keys(GARDEN_AMBIENT_CEREMONY_CATALOG);

  return {
    ok:
      GARDEN_AMBIENT_TONES.every((toneId) => toneIds.includes(toneId))
      && GARDEN_AMBIENT_CEREMONIES.every((ceremonyId) => ceremonyIds.includes(ceremonyId)),
    missingTones: GARDEN_AMBIENT_TONES.filter((toneId) => !toneIds.includes(toneId)),
    missingCeremonies: GARDEN_AMBIENT_CEREMONIES.filter((ceremonyId) => !ceremonyIds.includes(ceremonyId)),
  };
}
