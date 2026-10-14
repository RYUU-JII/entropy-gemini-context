import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  I18N_DEFAULT_NAMESPACE,
  I18N_FALLBACK_LANGUAGE,
  I18N_NAMESPACES,
} from './metadata.js';
import { createDashboardBootstrapI18nResources } from './dashboardResources.js';
import { setRuntimeLanguage } from '../domains/settings/i18n/runtimeLanguageState.js';
import { getUILanguage } from '../platform/chrome/ChromeService.js';
import RuntimeLanguageRepository from '../platform/storage/settings/RuntimeLanguageRepository.js';

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
const runtimeLanguageStore = RuntimeLanguageRepository.getInstance();
const extensionUiLanguage = (() => {
  try {
    return getUILanguage() || undefined;
  } catch (error) {
    console.error('[i18n] Failed to read extension UI language.', error);
  }
  return undefined;
})();

function applyDocumentLanguage(language) {
  const normalized = setRuntimeLanguage(language);
  if (hasDom && document?.documentElement) {
    document.documentElement.lang = normalized;
  }
  return normalized;
}

async function hydrateInitialRuntimeLanguage() {
  const fallbackLanguage = extensionUiLanguage || I18N_FALLBACK_LANGUAGE;
  if (!hasDom) return fallbackLanguage;
  try {
    return await runtimeLanguageStore.get(fallbackLanguage);
  } catch (error) {
    console.error('[i18n] Failed to hydrate dashboard runtime language.', error);
    return fallbackLanguage;
  }
}

const hydratedLanguage = await hydrateInitialRuntimeLanguage();

await i18n.use(initReactI18next).init({
  resources: createDashboardBootstrapI18nResources(),
  fallbackLng: I18N_FALLBACK_LANGUAGE,
  defaultNS: I18N_DEFAULT_NAMESPACE,
  ns: I18N_NAMESPACES,
  lng: hydratedLanguage,
  interpolation: {
    escapeValue: false,
  },
  contextSeparator: '_',
});

const initialLanguage = applyDocumentLanguage(
  i18n?.resolvedLanguage || i18n?.language || hydratedLanguage,
);

if (!initialLanguage) {
  applyDocumentLanguage(I18N_FALLBACK_LANGUAGE);
}

i18n.on('languageChanged', (nextLanguage) => {
  applyDocumentLanguage(nextLanguage);
});

runtimeLanguageStore.subscribe((language) => {
  if (i18n.resolvedLanguage === language) return;
  void i18n.changeLanguage(language).catch((error) => {
    console.error('[i18n] Failed to apply committed runtime language.', error);
  });
});

export default i18n;
