import {
  I18N_DEFAULT_NAMESPACE,
  I18N_FALLBACK_LANGUAGE,
} from '../../../i18n/metadata.js';
import { BACKGROUND_I18N_RESOURCES } from '../../../i18n/backgroundResources.js';
import { getUILanguage } from '../../../platform/chrome/ChromeService.js';
import { normalizeRuntimeLanguage } from './language.js';
import { createRuntimeResourceTranslator } from './resourceTranslator.js';

const reportedExtensionLanguageReadFailures = new Set();

function normalizeLanguage(value) {
  return normalizeRuntimeLanguage(value, I18N_FALLBACK_LANGUAGE);
}

function resolveLanguage() {
  const globalLanguage = normalizeRuntimeLanguage(globalThis?.__ENTROPY_LANG__, '');
  if (BACKGROUND_I18N_RESOURCES[globalLanguage]) return globalLanguage;

  try {
    const extensionLanguage = normalizeRuntimeLanguage(getUILanguage(), '');
    if (BACKGROUND_I18N_RESOURCES[extensionLanguage]) return extensionLanguage;
  } catch (error) {
    const errorMessage = String(error?.message || error);
    if (!reportedExtensionLanguageReadFailures.has(errorMessage)) {
      reportedExtensionLanguageReadFailures.add(errorMessage);
      console.error('[background-i18n] Failed to read extension UI language.', error);
    }
  }

  const browserLanguage = normalizeRuntimeLanguage(
    typeof navigator !== 'undefined' ? navigator?.language : '',
    '',
  );
  if (BACKGROUND_I18N_RESOURCES[browserLanguage]) return browserLanguage;

  return I18N_FALLBACK_LANGUAGE;
}

const backgroundRuntimeTranslator = createRuntimeResourceTranslator({
  resources: BACKGROUND_I18N_RESOURCES,
  fallbackLanguage: I18N_FALLBACK_LANGUAGE,
  defaultNamespace: I18N_DEFAULT_NAMESPACE,
  normalizeLanguage,
  resolveLanguage,
  diagnosticLabel: 'background-i18n',
});

export function tBackgroundRuntime(key, options = {}) {
  return backgroundRuntimeTranslator.translate(key, options);
}

export function tBackgroundRuntimeWithLanguage(language, key, options = {}) {
  return backgroundRuntimeTranslator.translateWithLanguage(language, key, options);
}

export function getBackgroundRuntimeLanguage() {
  return resolveLanguage();
}
