import {
  I18N_FALLBACK_LANGUAGE,
  I18N_SUPPORTED_LOCALES,
} from '../../../i18n/metadata.js';
import { getUILanguage } from '../../../platform/chrome/ChromeService.js';
import { normalizeRuntimeLanguage } from './language.js';

const supportedLanguages = new Set(I18N_SUPPORTED_LOCALES);
let reportedExtensionLanguageReadFailure = false;

function normalizeLanguage(value) {
  return normalizeRuntimeLanguage(value, I18N_FALLBACK_LANGUAGE);
}

export function resolveRuntimeUiLanguage() {
  const globalLanguage = normalizeLanguage(globalThis?.__ENTROPY_LANG__);
  if (supportedLanguages.has(globalLanguage)) return globalLanguage;

  const documentLanguage = normalizeLanguage(
    typeof document !== 'undefined' ? document?.documentElement?.lang : '',
  );
  if (supportedLanguages.has(documentLanguage)) return documentLanguage;

  try {
    const extensionLanguage = normalizeLanguage(getUILanguage());
    if (supportedLanguages.has(extensionLanguage)) return extensionLanguage;
  } catch (error) {
    if (!reportedExtensionLanguageReadFailure) {
      reportedExtensionLanguageReadFailure = true;
      console.error('[i18n] Failed to read runtime extension UI language.', error);
    }
  }

  const browserLanguage = normalizeLanguage(
    typeof navigator !== 'undefined' ? navigator?.language : '',
  );
  if (supportedLanguages.has(browserLanguage)) return browserLanguage;

  return I18N_FALLBACK_LANGUAGE;
}
