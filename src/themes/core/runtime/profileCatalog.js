import {
  assertCanonicalThemeId,
  createThemeIdError,
  THEME_IDS,
} from '../ids.js';
import { clinicalThemeProfileDefinition } from '../../plugins/clinical/profile.js';
import { cyberpunkThemeProfileDefinition } from '../../plugins/cyberpunk/profile.js';
import { entropyThemeProfileDefinition } from '../../plugins/entropy/profile.js';
import { matrixThemeProfileDefinition } from '../../plugins/matrix/profile.js';
import { scpThemeProfileDefinition } from '../../plugins/scp/profile.js';
import { zenThemeProfileDefinition } from '../../plugins/zen/profile.js';
import { createThemeProfile } from './createThemeManifest.js';

const THEME_PROFILE_DEFINITION_MAP = Object.freeze({
  [THEME_IDS.MATRIX]: matrixThemeProfileDefinition,
  [THEME_IDS.ENTROPY]: entropyThemeProfileDefinition,
  [THEME_IDS.CYBERPUNK]: cyberpunkThemeProfileDefinition,
  [THEME_IDS.CLINICAL]: clinicalThemeProfileDefinition,
  [THEME_IDS.SCP]: scpThemeProfileDefinition,
  [THEME_IDS.ZEN]: zenThemeProfileDefinition,
});

const THEME_PROFILE_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(THEME_PROFILE_DEFINITION_MAP).map(([themeId, profile]) => [
      themeId,
      createThemeProfile(themeId, profile),
    ]),
  ),
);

export const THEME_PROFILE_ERROR_CODES = Object.freeze({
  MISSING: 'THEME_PROFILE_MISSING',
});

export function getThemeProfileMap() {
  return THEME_PROFILE_MAP;
}

export function getThemeProfileStrict(themeId, context = 'theme profile runtime') {
  const resolvedThemeId = assertCanonicalThemeId(themeId, context);
  const profile = THEME_PROFILE_MAP[resolvedThemeId];
  if (profile) return profile;

  throw createThemeIdError(
    THEME_PROFILE_ERROR_CODES.MISSING,
    `[ThemeProfile] ${context} references an unregistered theme profile.`,
    {
      themeId: resolvedThemeId,
      context,
      registeredThemeIds: Object.keys(THEME_PROFILE_MAP),
    },
  );
}
