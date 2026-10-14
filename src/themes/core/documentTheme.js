import { applyDocumentThemeProjection } from './documentThemeProjection.js';
import {
  getDefaultThemeId,
  resolveThemeDefinitionId,
} from './catalog.js';
import {
  dispatchThemePreferenceChange,
  getCurrentThemePreference,
  readThemePreferenceMirror,
  writeThemePreferenceMirror,
} from './state/themePreferenceRepository.js';

function hasDocumentRoot() {
  return typeof document !== 'undefined' && !!document.documentElement;
}

export function applyDocumentTheme(themeId) {
  const defaultThemeId = getDefaultThemeId();
  const resolvedThemeId = applyDocumentThemeProjection(themeId);

  writeThemePreferenceMirror(resolvedThemeId, defaultThemeId);
  dispatchThemePreferenceChange(resolvedThemeId, defaultThemeId);
  return resolvedThemeId;
}

export function getCurrentDocumentTheme(fallback = getDefaultThemeId()) {
  if (!hasDocumentRoot()) return resolveThemeDefinitionId(fallback, getDefaultThemeId());
  return getCurrentThemePreference(fallback);
}

function finalizeDocumentThemeInitialization(appliedTheme) {
  if (hasDocumentRoot()) {
    document.documentElement.removeAttribute('data-shape');
  }
  return { theme: appliedTheme };
}

export function initializeDocumentThemeForThemeId(themeId) {
  const appliedTheme = applyDocumentTheme(themeId);
  return finalizeDocumentThemeInitialization(appliedTheme);
}

export function initializeDocumentTheme(fallback = getDefaultThemeId()) {
  return initializeDocumentThemeForThemeId(readThemePreferenceMirror(fallback), fallback);
}
