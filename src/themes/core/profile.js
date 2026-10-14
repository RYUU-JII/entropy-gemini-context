import {
    getThemeProfileMap,
    getThemeProfileStrict,
} from './runtime/profileCatalog.js';

export const THEME_PROFILES = Object.freeze(
    { ...getThemeProfileMap() },
);

export function getThemeProfile(themeId) {
    return getThemeProfileStrict(themeId, 'theme profile lookup');
}
