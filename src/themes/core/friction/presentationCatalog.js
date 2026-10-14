import { DEFAULT_THEME_ID, THEME_IDS, normalizeThemeId } from '../ids.js';
import { clinicalFrictionPresentation } from '../../plugins/clinical/frictionPresentation.js';
import { cyberpunkFrictionPresentation } from '../../plugins/cyberpunk/frictionPresentation.js';
import { entropyFrictionPresentation } from '../../plugins/entropy/frictionPresentation.js';
import { matrixFrictionPresentation } from '../../plugins/matrix/frictionPresentation.js';
import { scpFrictionPresentation } from '../../plugins/scp/frictionPresentation.js';
import { zenFrictionPresentation } from '../../plugins/zen/frictionPresentation.js';

const REQUIRED_COLOR_KEYS = Object.freeze([
    'accent',
    'accentSecondary',
    'accentTertiary',
    'accentRing',
    'text',
    'background',
]);

const FRICTION_PRESENTATION_MAP = Object.freeze({
    [THEME_IDS.MATRIX]: matrixFrictionPresentation,
    [THEME_IDS.ENTROPY]: entropyFrictionPresentation,
    [THEME_IDS.CYBERPUNK]: cyberpunkFrictionPresentation,
    [THEME_IDS.CLINICAL]: clinicalFrictionPresentation,
    [THEME_IDS.SCP]: scpFrictionPresentation,
    [THEME_IDS.ZEN]: zenFrictionPresentation,
});

function assertFrictionPresentation(themeId, presentation) {
    if (!presentation || presentation.themeId !== themeId) {
        throw new Error(`FRICTION_PRESENTATION_CONTRACT_INVALID:${themeId}:themeId`);
    }
    if (typeof presentation.profile?.nudgePreset !== 'string' || !presentation.profile.nudgePreset.trim()) {
        throw new Error(`FRICTION_PRESENTATION_CONTRACT_INVALID:${themeId}:nudgePreset`);
    }
    if (!presentation.profile.friction || typeof presentation.profile.friction !== 'object') {
        throw new Error(`FRICTION_PRESENTATION_CONTRACT_INVALID:${themeId}:friction`);
    }
    for (const key of REQUIRED_COLOR_KEYS) {
        if (typeof presentation.colors?.[key] !== 'string' || !presentation.colors[key].trim()) {
            throw new Error(`FRICTION_PRESENTATION_CONTRACT_INVALID:${themeId}:colors.${key}`);
        }
    }
    return presentation;
}

for (const [themeId, presentation] of Object.entries(FRICTION_PRESENTATION_MAP)) {
    assertFrictionPresentation(themeId, presentation);
}

export function getThemeFrictionPresentation(themeId) {
    const resolvedThemeId = normalizeThemeId(themeId, DEFAULT_THEME_ID);
    const presentation = FRICTION_PRESENTATION_MAP[resolvedThemeId];
    if (!presentation) {
        throw new Error(`FRICTION_PRESENTATION_MISSING:${resolvedThemeId}`);
    }
    return presentation;
}
