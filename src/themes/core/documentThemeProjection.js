import { injectCSSVariables, injectCustomCSS } from './utils.js';
import { assertThemeDefinitionId, getThemeDefinition } from './catalog.js';

function hasDocumentRoot() {
  return typeof document !== 'undefined' && !!document.documentElement;
}

// Explicit presentation only: preference reads, mirrors and events belong to
// documentTheme.js, not to a fixture's selected theme.
export function applyDocumentThemeProjection(themeId) {
  const resolvedThemeId = assertThemeDefinitionId(themeId, 'document theme apply');
  const themeDefinition = getThemeDefinition(resolvedThemeId);
  if (hasDocumentRoot()) {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedThemeId);
    if (themeDefinition?.toCSSVariables) {
      injectCSSVariables(root, themeDefinition.toCSSVariables());
    }
    injectCustomCSS(themeDefinition?.customCSS || '');
  }
  return resolvedThemeId;
}

export function initializeDocumentThemeProjection(themeId) {
  const appliedTheme = applyDocumentThemeProjection(themeId);
  if (hasDocumentRoot()) {
    document.documentElement.removeAttribute('data-shape');
  }
  return { theme: appliedTheme };
}
