import {
  I18N_FALLBACK_LANGUAGE,
  I18N_SUPPORTED_LOCALES,
} from '../../../i18n/metadata.js';
import { normalizeRuntimeLanguage } from './language.js';

const SUPPORTED_RUNTIME_LANGUAGES = new Set(I18N_SUPPORTED_LOCALES);

export function setRuntimeLanguage(language) {
  const normalized = normalizeRuntimeLanguage(language, I18N_FALLBACK_LANGUAGE);
  const resolved = SUPPORTED_RUNTIME_LANGUAGES.has(normalized)
    ? normalized
    : I18N_FALLBACK_LANGUAGE;
  globalThis.__ENTROPY_LANG__ = resolved;
  return resolved;
}
