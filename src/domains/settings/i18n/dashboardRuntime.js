import {
  I18N_DEFAULT_NAMESPACE,
  I18N_FALLBACK_LANGUAGE,
} from '../../../i18n/metadata.js';
import { DASHBOARD_BOOTSTRAP_I18N_RESOURCES } from '../../../i18n/dashboardResources.js';
import { getUILanguage } from '../../../platform/chrome/ChromeService.js';
import { createRuntimeResourceTranslator } from './resourceTranslator.js';
import { normalizeRuntimeLanguage } from './language.js';

const FALLBACK_LANGUAGE = I18N_FALLBACK_LANGUAGE;
const DASHBOARD_RUNTIME_RESOURCES = DASHBOARD_BOOTSTRAP_I18N_RESOURCES;
let reportedExtensionLanguageReadFailure = false;

function normalizeLanguage(value) {
  return normalizeRuntimeLanguage(value, FALLBACK_LANGUAGE);
}

function resolveLanguage() {
  const globalLang = normalizeLanguage(globalThis?.__ENTROPY_LANG__);
  if (DASHBOARD_RUNTIME_RESOURCES[globalLang]) return globalLang;

  const documentLang = normalizeLanguage(
    typeof document !== 'undefined' ? document?.documentElement?.lang : '',
  );
  if (DASHBOARD_RUNTIME_RESOURCES[documentLang]) return documentLang;

  try {
    const extensionLanguage = normalizeLanguage(getUILanguage());
    if (DASHBOARD_RUNTIME_RESOURCES[extensionLanguage]) return extensionLanguage;
  } catch (error) {
    if (!reportedExtensionLanguageReadFailure) {
      reportedExtensionLanguageReadFailure = true;
      console.error('[dashboard-i18n] Failed to read runtime extension UI language.', error);
    }
  }

  const browserLanguage = normalizeLanguage(
    typeof navigator !== 'undefined' ? navigator?.language : '',
  );
  if (DASHBOARD_RUNTIME_RESOURCES[browserLanguage]) return browserLanguage;

  return FALLBACK_LANGUAGE;
}

const dashboardRuntimeTranslator = createRuntimeResourceTranslator({
  resources: DASHBOARD_RUNTIME_RESOURCES,
  fallbackLanguage: FALLBACK_LANGUAGE,
  defaultNamespace: I18N_DEFAULT_NAMESPACE,
  normalizeLanguage,
  resolveLanguage,
  diagnosticLabel: 'dashboard-i18n',
});

export function tDashboardRuntime(key, options = {}) {
  return dashboardRuntimeTranslator.translate(key, options);
}
