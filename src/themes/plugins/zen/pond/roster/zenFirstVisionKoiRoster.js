import { normalizeZenKoiRosterSnapshot } from './zenKoiRosterContract.js';
import { ZEN_KOI_ENTITY_KINDS } from './zenKoiRosterEntityKind.js';

const FIRST_VISION_KOI_COUNT = 5;
const FIRST_VISION_KOI_ARCHETYPES = Object.freeze([
  Object.freeze({ breedId: 'tancho_kohaku', paletteIndex: 13, slot: 'hero', quantile: 0.82 }),
  Object.freeze({ breedId: 'kohaku', paletteIndex: 0, slot: 'guardian', quantile: 0.74 }),
  Object.freeze({ breedId: 'showa', paletteIndex: 2, slot: 'guardian', quantile: 0.68 }),
  Object.freeze({ breedId: 'goshiki', paletteIndex: 12, slot: 'resident', quantile: 0.61 }),
  Object.freeze({ breedId: 'yamabuki_ogon', paletteIndex: 17, slot: 'resident', quantile: 0.55 }),
]);

function buildVisionKoiItem(index, count) {
  const ordinal = index + 1;
  const archetype = FIRST_VISION_KOI_ARCHETYPES[index % FIRST_VISION_KOI_ARCHETYPES.length];
  return {
    entityId: `first-vision-koi-${ordinal}`,
    domain: `first-vision-koi-${ordinal}.entropy`,
    entityKind: ZEN_KOI_ENTITY_KINDS.VISION,
    slot: archetype.slot,
    cohort: 'vision',
    policyStatus: 'allowed',
    presenceState: 'active',
    priority: 100 - index,
    risk: 0.08 + (index * 0.018),
    appearanceProfile: {
      seed: (0xC0FFEE + (index * 2654435761)) >>> 0,
      paletteIndex: archetype.paletteIndex,
      appearanceMode: 'off',
      colorMix: [],
      breedMatch: {
        id: archetype.breedId,
        score: 1,
      },
    },
    activityProfile: {
      persisted: false,
      quantile: archetype.quantile,
      boundDayIndex: null,
      rebindCount: 0,
    },
    formationProfile: {
      type: 'first_vision_orbit',
      slotIndex: index,
      slotCount: count,
      direction: 'clockwise',
      centerX: 0.5,
      centerY: 0.53,
      radiusX: 0.29,
      radiusY: 0.29,
      angularSpeed: 0.0075,
      phaseOffset: -Math.PI * 0.5,
      lookaheadRadians: 0.42,
      spawnDepth: 0.16,
    },
  };
}

export function buildZenFirstVisionKoiRosterSnapshot({
  koiCount = FIRST_VISION_KOI_COUNT,
} = {}) {
  const count = Math.max(1, Math.min(16, Math.floor(Number(koiCount) || FIRST_VISION_KOI_COUNT)));
  return normalizeZenKoiRosterSnapshot({
    policyId: 'zen_first_vision_koi_roster_v1',
    focusDomain: null,
    capacity: {
      interactiveTarget: count,
      interactiveMax: count,
    },
    items: Array.from({ length: count }, (_, index) => buildVisionKoiItem(index, count)),
  });
}

export {
  FIRST_VISION_KOI_COUNT,
};
