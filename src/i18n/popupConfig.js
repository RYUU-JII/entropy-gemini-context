import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  I18N_DEFAULT_NAMESPACE,
  I18N_FALLBACK_LANGUAGE,
} from './metadata.js';
import { createPopupI18nResources } from './popupResources.js';
import { setRuntimeLanguage } from '../domains/settings/i18n/runtimeLanguageState.js';
import {
  runtimeGetUILanguage,
} from '../platform/chrome/popupBrowserClient.js';
import RuntimeLanguageRepository from '../platform/storage/settings/RuntimeLanguageRepository.js';

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
const runtimeLanguageStore = RuntimeLanguageRepository.getInstance();

function readExtensionUiLanguage() {
  try {
    return runtimeGetUILanguage() || undefined;
  } catch (error) {
    console.error('[popup-i18n] Failed to read extension UI language.', error);
    return undefined;
  }
}

function applyDocumentLanguage(language) {
  const normalized = setRuntimeLanguage(language);
  if (hasDom && document?.documentElement) {
    document.documentElement.lang = normalized;
  }
  return normalized;
}

async function hydrateInitialRuntimeLanguage() {
  const fallbackLanguage = readExtensionUiLanguage() || I18N_FALLBACK_LANGUAGE;
  if (!hasDom) return fallbackLanguage;

  try {
    return await runtimeLanguageStore.get(fallbackLanguage);
  } catch (error) {
    console.error('[popup-i18n] Failed to hydrate runtime language.', error);
    return fallbackLanguage;
  }
}

const hydratedLanguage = await hydrateInitialRuntimeLanguage();

await i18n.use(initReactI18next).init({
  resources: createPopupI18nResources(),
  fallbackLng: I18N_FALLBACK_LANGUAGE,
  defaultNS: I18N_DEFAULT_NAMESPACE,
  ns: [I18N_DEFAULT_NAMESPACE, 'guidance'],
  lng: hydratedLanguage,
  interpolation: {
    escapeValue: false,
  },
  contextSeparator: '_',
});

const initialLanguage = applyDocumentLanguage(
  i18n?.resolvedLanguage || i18n?.language || hydratedLanguage,
);

i18n.on('languageChanged', (nextLanguage) => {
  applyDocumentLanguage(nextLanguage);
});

runtimeLanguageStore.subscribe((language) => {
  if (i18n.resolvedLanguage === language) return;
  void i18n.changeLanguage(language).catch((error) => {
    console.error('[popup-i18n] Failed to apply committed runtime language.', error);
  });
});

export default i18n;
