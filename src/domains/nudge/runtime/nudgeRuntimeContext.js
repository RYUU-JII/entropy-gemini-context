import {
  DEFAULT_THEME_ID,
  assertCanonicalThemeId,
  canonicalizeThemeIdInput,
} from '../../../themes/core/ids.js';
import {
  DEFAULT_RUNTIME_LANGUAGE,
  normalizeRuntimeLanguage,
} from '../../settings/i18n/language.js';

export const DEFAULT_NUDGE_VARIANT_ID = 'default';
const INVALID_NUDGE_THEME_ID = '__invalid_nudge_theme_id__';

export function assertNudgeRuntimeThemeId(themeId, context = 'nudge runtime theme') {
  return assertCanonicalThemeId(themeId, context);
}

function normalizeVariantId(value, fallback = DEFAULT_NUDGE_VARIANT_ID) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return normalized;
}

function hasThemeIdCandidate(value) {
  if (typeof value === 'string') return Boolean(value.trim());
  return value !== undefined && value !== null;
}

function canonicalizeNudgeThemeIdCandidate(
  value,
  fallback,
  boundary,
) {
  if (!hasThemeIdCandidate(value)) return fallback;
  const canonicalThemeId = canonicalizeThemeIdInput(value, INVALID_NUDGE_THEME_ID);
  if (canonicalThemeId === INVALID_NUDGE_THEME_ID) {
    assertNudgeRuntimeThemeId(value, boundary);
  }
  return assertNudgeRuntimeThemeId(canonicalThemeId, boundary);
}

export function normalizeNudgeRuntimeContext(raw, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackThemeId = canonicalizeNudgeThemeIdCandidate(
    fallback?.themeId,
    DEFAULT_THEME_ID,
    'nudge runtime fallback theme',
  );
  const themeId = canonicalizeNudgeThemeIdCandidate(
    source.themeId,
    fallbackThemeId,
    'nudge runtime theme input',
  );
  const language = normalizeRuntimeLanguage(
    source.language,
    normalizeRuntimeLanguage(fallback?.language, DEFAULT_RUNTIME_LANGUAGE),
  );

  return assertNudgeRuntimeContext({
    themeId,
    language,
    variantId: normalizeVariantId(source.variantId, normalizeVariantId(fallback?.variantId, themeId)),
  }, 'nudge runtime context canonicalized input');
}

export function assertNudgeRuntimeContext(context, boundary = 'nudge runtime context') {
  const source = context && typeof context === 'object' ? context : {};
  const themeId = assertNudgeRuntimeThemeId(source.themeId, boundary);
  const language = normalizeRuntimeLanguage(source.language, DEFAULT_RUNTIME_LANGUAGE);

  return {
    themeId,
    language,
    variantId: normalizeVariantId(source.variantId, themeId),
  };
}
