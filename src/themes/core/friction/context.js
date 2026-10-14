import { normalizeThemeId } from '../ids.js';
import { getThemeFrictionPresentation } from './presentationCatalog.js';

export function getThemeColors(themeId) {
  return getThemeFrictionPresentation(themeId).colors;
}

export function resolveFrictionProfile(themeId) {
  return getThemeFrictionPresentation(themeId).profile.friction;
}

export function createFrictionThemeContext(themeId) {
  const presentation = getThemeFrictionPresentation(themeId);
  const resolvedThemeId = normalizeThemeId(themeId, presentation.themeId);
  return {
    themeId: resolvedThemeId,
    profile: presentation.profile,
    colors: presentation.colors,
    friction: presentation.profile.friction,
  };
}
