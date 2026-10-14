import { PROTECTION_LANE_IDS } from '../contracts/laneIds.js';
import {
  getCanonicalBinaryFilterValue,
} from '../../settings/config/canonicalBinaryFilterProfiles.js';
import { VISUAL_FRICTION_CONTROLS } from '../../settings/config/visualFrictionProfiles.js';
const {
  REWARD,
  PACE,
  FRICTION,
  ADVANCED,
} = PROTECTION_LANE_IDS;

function createTogglePatch(isActive, value = '') {
  return { isActive, value };
}

function createCanonicalBinaryPatch(key, isActive = true) {
  return { isActive, value: getCanonicalBinaryFilterValue(key) };
}

function createVisualStrengthPatch(key) {
  return { isActive: true, value: VISUAL_FRICTION_CONTROLS[key].defaultStrength };
}

export const FILTER_CAPABILITY_CATALOG = Object.freeze({
  [REWARD]: Object.freeze({
    0: Object.freeze({}),
    1: Object.freeze({
      socialEngagement: createTogglePatch(true, ''),
      socialExposure: createTogglePatch(true, ''),
    }),
    2: Object.freeze({
      socialEngagement: createTogglePatch(true, ''),
      socialExposure: createTogglePatch(true, ''),
      colorSaturation: createVisualStrengthPatch('colorSaturation'),
    }),
    3: Object.freeze({
      socialEngagement: createTogglePatch(true, ''),
      socialExposure: createTogglePatch(true, ''),
      colorSaturation: createVisualStrengthPatch('colorSaturation'),
    }),
  }),
  [PACE]: Object.freeze({
    0: Object.freeze({}),
    1: Object.freeze({
      clickDelay: createCanonicalBinaryPatch('clickDelay'),
    }),
    2: Object.freeze({
      clickDelay: createCanonicalBinaryPatch('clickDelay'),
      scrollFriction: createCanonicalBinaryPatch('scrollFriction'),
    }),
    3: Object.freeze({
      clickDelay: createCanonicalBinaryPatch('clickDelay'),
      scrollFriction: createCanonicalBinaryPatch('scrollFriction'),
    }),
  }),
  [FRICTION]: Object.freeze({
    0: Object.freeze({}),
    1: Object.freeze({
      brightness: createVisualStrengthPatch('brightness'),
    }),
    2: Object.freeze({
      brightness: createVisualStrengthPatch('brightness'),
      textRhythm: createCanonicalBinaryPatch('textRhythm'),
    }),
    3: Object.freeze({
      brightness: createVisualStrengthPatch('brightness'),
      textRhythm: createCanonicalBinaryPatch('textRhythm'),
    }),
  }),
  [ADVANCED]: Object.freeze({
    0: Object.freeze({}),
    1: Object.freeze({
      textRhythm: createCanonicalBinaryPatch('textRhythm'),
    }),
    2: Object.freeze({
      textRhythm: createCanonicalBinaryPatch('textRhythm'),
      textShadow: createTogglePatch(true, '1px 1px 2px rgba(0,0,0,0.35)'),
    }),
    3: Object.freeze({
      textRhythm: createCanonicalBinaryPatch('textRhythm'),
      textShadow: createTogglePatch(true, '1px 1px 3px rgba(0,0,0,0.5)'),
    }),
  }),
});

export function getFilterCapabilityPatch(laneId, intensity = 0) {
  return FILTER_CAPABILITY_CATALOG?.[laneId]?.[intensity] || {};
}
