import {
  I18N_DEFAULT_NAMESPACE,
  I18N_FALLBACK_LANGUAGE,
} from '../../../i18n/metadata.js';
import { POPUP_I18N_RESOURCES } from '../../../i18n/popupResources.js';
import {
  runtimeGetUILanguage,
} from '../../../platform/chrome/popupBrowserClient.js';
import { normalizeRuntimeLanguage } from './language.js';
import { createRuntimeResourceTranslator } from './resourceTranslator.js';

let reportedExtensionLanguageReadFailure = false;

function resolveSupportedLanguage(value) {
  const normalized = normalizeRuntimeLanguage(value, '');
  return POPUP_I18N_RESOURCES[normalized] ? normalized : null;
}

function resolveLanguage() {
  const globalLanguage = resolveSupportedLanguage(globalThis?.__ENTROPY_LANG__);
  if (globalLanguage) return globalLanguage;

  const documentLanguage = resolveSupportedLanguage(
    typeof document !== 'undefined' ? document?.documentElement?.lang : '',
  );
  if (documentLanguage) return documentLanguage;

  try {
    const extensionLanguage = resolveSupportedLanguage(runtimeGetUILanguage());
    if (extensionLanguage) return extensionLanguage;
  } catch (error) {
    if (!reportedExtensionLanguageReadFailure) {
      reportedExtensionLanguageReadFailure = true;
      console.error('[popup-i18n] Failed to read runtime extension UI language.', error);
    }
  }

  const browserLanguage = resolveSupportedLanguage(
    typeof navigator !== 'undefined' ? navigator?.language : '',
  );
  return browserLanguage || I18N_FALLBACK_LANGUAGE;
}

const popupRuntimeTranslator = createRuntimeResourceTranslator({
  resources: POPUP_I18N_RESOURCES,
  fallbackLanguage: I18N_FALLBACK_LANGUAGE,
  defaultNamespace: I18N_DEFAULT_NAMESPACE,
  normalizeLanguage: (language) => normalizeRuntimeLanguage(
    language,
    I18N_FALLBACK_LANGUAGE,
  ),
  resolveLanguage,
  diagnosticLabel: 'popup-i18n',
});

export function tRuntime(key, options = {}) {
  return popupRuntimeTranslator.translate(key, options);
}
