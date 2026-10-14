import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
    I18N_DEFAULT_NAMESPACE,
    I18N_FALLBACK_LANGUAGE,
    I18N_NAMESPACES,
} from './metadata.js';
import { I18N_RESOURCES } from './resources.js';
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

if (hasDom) {
    i18n.use(LanguageDetector);
}

i18n
    .use(initReactI18next)
    .init({
        resources: I18N_RESOURCES,
        fallbackLng: I18N_FALLBACK_LANGUAGE,
        defaultNS: I18N_DEFAULT_NAMESPACE,
        ns: I18N_NAMESPACES,
        lng: hasDom ? undefined : extensionUiLanguage,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        // Context Glue: This enables "key_context" lookup
        contextSeparator: '_',
    });

const initialLanguage = applyDocumentLanguage(
    i18n?.resolvedLanguage || i18n?.language || extensionUiLanguage || I18N_FALLBACK_LANGUAGE
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
