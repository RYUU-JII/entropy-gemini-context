import { I18N_SUPPORTED_LOCALES } from '../../../i18n/metadata.js';

export const DEFAULT_RUNTIME_LANGUAGE = 'en';

export function requireCanonicalRuntimeLanguage(value) {
  if (typeof value !== 'string' || !I18N_SUPPORTED_LOCALES.includes(value)) {
    throw new Error('RUNTIME_LANGUAGE_STORED_CONTRACT_INVALID');
  }
  return value;
}

export function normalizeRuntimeLanguage(value, fallback = DEFAULT_RUNTIME_LANGUAGE) {
  const fallbackCode = String(fallback || DEFAULT_RUNTIME_LANGUAGE)
    .split('-')[0]
    .trim()
    .toLowerCase() || DEFAULT_RUNTIME_LANGUAGE;
  const normalized = String(value || '')
    .split('-')[0]
    .trim()
    .toLowerCase();
  return normalized || fallbackCode;
}
