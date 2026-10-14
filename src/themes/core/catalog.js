import {
  assertCanonicalThemeId,
  DEFAULT_THEME_ID,
  normalizeThemeId,
} from './ids.js';
import { ClinicalTheme } from '../plugins/clinical/theme.js';
import { CyberpunkTheme } from '../plugins/cyberpunk/theme.js';
import { EntropyTheme } from '../plugins/entropy/theme.js';
import { MatrixTheme } from '../plugins/matrix/theme.js';
import { SCPTheme } from '../plugins/scp/theme.js';
import { ZenTheme } from '../plugins/zen/theme.js';

const THEME_DEFINITION_LIST = Object.freeze([
  MatrixTheme,
  EntropyTheme,
  CyberpunkTheme,
  ClinicalTheme,
  SCPTheme,
  ZenTheme,
]);

const THEME_DEFINITION_MAP = Object.freeze(
  THEME_DEFINITION_LIST.reduce((acc, themeDefinition) => {
    if (acc[themeDefinition.id]) {
      throw new Error(`THEME_DEFINITION_DUPLICATE:${themeDefinition.id}`);
    }
    acc[themeDefinition.id] = themeDefinition;
    return acc;
  }, {}),
);

export const THEME_ID_MAP = Object.freeze(
  THEME_DEFINITION_LIST.reduce((acc, themeDefinition) => {
    acc[themeDefinition.id] = themeDefinition.id;
    return acc;
  }, {}),
);

const THEME_CATALOG_ENTRIES = Object.freeze(
  THEME_DEFINITION_LIST.map((themeDefinition) => {
    const colors = themeDefinition.tokens?.colors || {};
    return Object.freeze({
      id: themeDefinition.id,
      name: themeDefinition.meta?.name || themeDefinition.name || themeDefinition.id,
      description: themeDefinition.meta?.description || '',
      previewColors: Object.freeze({
        primary: colors.primary || colors.accent || colors.accentSecondary || '',
        accent: colors.accent || colors.accentSecondary || colors.accentTertiary || colors.primary || '',
        surface: colors.surface || colors.surfaceSunken || colors.background || '',
      }),
    });
  }),
);

const THEME_CATALOG_MAP = Object.freeze(
  THEME_CATALOG_ENTRIES.reduce((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {}),
);

const DEFAULT_CATALOG_THEME_ID = THEME_DEFINITION_MAP[DEFAULT_THEME_ID]
  ? DEFAULT_THEME_ID
  : (THEME_DEFINITION_LIST[0]?.id || DEFAULT_THEME_ID);

export const THEME_CATALOG_ERROR_CODES = Object.freeze({
  DEFINITION_MISSING: 'THEME_DEFINITION_MISSING',
});

export const THEME_CATALOG = THEME_CATALOG_ENTRIES;

function createThemeCatalogError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details && typeof details === 'object' ? { ...details } : {};
  return error;
}

export function getDefaultThemeId() {
  return DEFAULT_CATALOG_THEME_ID;
}

export function resolveThemeDefinitionId(
  themeId,
  fallback = DEFAULT_CATALOG_THEME_ID,
) {
  const normalizedFallback = normalizeThemeId(fallback, DEFAULT_CATALOG_THEME_ID);
  const resolvedFallback = THEME_DEFINITION_MAP[normalizedFallback]
    ? normalizedFallback
    : DEFAULT_CATALOG_THEME_ID;
  const normalizedThemeId = normalizeThemeId(themeId, resolvedFallback);
  return THEME_DEFINITION_MAP[normalizedThemeId] ? normalizedThemeId : resolvedFallback;
}

export function hasThemeDefinition(themeId) {
  const normalizedThemeId = normalizeThemeId(themeId, '');
  return !!(normalizedThemeId && THEME_DEFINITION_MAP[normalizedThemeId]);
}

export function assertThemeDefinitionId(themeId, context = 'theme definition runtime') {
  const resolvedThemeId = assertCanonicalThemeId(themeId, context);
  if (THEME_DEFINITION_MAP[resolvedThemeId]) {
    return resolvedThemeId;
  }

  throw createThemeCatalogError(
    THEME_CATALOG_ERROR_CODES.DEFINITION_MISSING,
    `[ThemeCatalog] ${context} references a theme without a definition.`,
    {
      themeId: resolvedThemeId,
      context,
    },
  );
}

export function getThemeDefinition(themeId) {
  return THEME_DEFINITION_MAP[assertThemeDefinitionId(themeId, 'theme definition lookup')];
}

export function getThemeCatalog() {
  return THEME_CATALOG_ENTRIES;
}

export function getThemeCatalogEntry(themeId) {
  return THEME_CATALOG_MAP[assertThemeDefinitionId(themeId, 'theme catalog entry lookup')];
}
