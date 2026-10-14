import {
    assertCanonicalThemeId,
    createThemeIdError,
} from '../ids.js';
import { clinicalThemeManifest } from '../../plugins/clinical/manifest.js';
import { cyberpunkThemeManifest } from '../../plugins/cyberpunk/manifest.js';
import { entropyThemeManifest } from '../../plugins/entropy/manifest.js';
import { matrixThemeManifest } from '../../plugins/matrix/manifest.js';
import { scpThemeManifest } from '../../plugins/scp/manifest.js';
import { zenThemeManifest } from '../../plugins/zen/manifest.js';

const THEME_PLUGIN_LIST = Object.freeze([
    matrixThemeManifest,
    entropyThemeManifest,
    cyberpunkThemeManifest,
    clinicalThemeManifest,
    scpThemeManifest,
    zenThemeManifest,
]);

const THEME_PLUGIN_MAP = Object.freeze(
    THEME_PLUGIN_LIST.reduce((acc, manifest) => {
        acc[manifest.id] = manifest;
        return acc;
    }, {}),
);

export const THEME_PLUGIN_ERROR_CODES = Object.freeze({
    MISSING: 'THEME_PLUGIN_MISSING',
});

export function getThemePluginList() {
    return THEME_PLUGIN_LIST;
}

export function getThemePluginMap() {
    return THEME_PLUGIN_MAP;
}

export function assertThemePluginId(themeId, context = 'theme plugin runtime') {
    const resolvedThemeId = assertCanonicalThemeId(themeId, context);
    if (THEME_PLUGIN_MAP[resolvedThemeId]) {
        return resolvedThemeId;
    }

    throw createThemeIdError(
        THEME_PLUGIN_ERROR_CODES.MISSING,
        `[ThemePlugin] ${context} references an unregistered theme plugin.`,
        {
            themeId: resolvedThemeId,
            context,
            registeredThemeIds: Object.keys(THEME_PLUGIN_MAP),
        },
    );
}

export function getThemePluginStrict(themeId, context = 'theme plugin runtime') {
    return THEME_PLUGIN_MAP[assertThemePluginId(themeId, context)];
}
