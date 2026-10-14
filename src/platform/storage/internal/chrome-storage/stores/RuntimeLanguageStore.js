import {
  addChromeStorageChangedListener,
  removeChromeStorageChangedListener,
} from '../storageChangeBus.js';
import { RUNTIME_LANGUAGE_STORAGE_KEY } from '../../../../../domains/settings/i18n/constants.js';
import { normalizeRuntimeLanguage, requireCanonicalRuntimeLanguage } from '../../../../../domains/settings/i18n/language.js';
import { STORAGE_LOCAL_DOC_KEYS } from '../storageKeyRegistry.js';
import SettingsStore from './SettingsStore.js';
import { I18N_SUPPORTED_LOCALES } from '../../../../../i18n/metadata.js';

const DEFAULT_RUNTIME_LANGUAGE = 'en';
const SUPPORTED_RUNTIME_LANGUAGES = new Set(I18N_SUPPORTED_LOCALES);

function resolveRuntimeLanguage(value, fallback = DEFAULT_RUNTIME_LANGUAGE) {
  const normalizedFallback = normalizeRuntimeLanguage(fallback, DEFAULT_RUNTIME_LANGUAGE);
  const canonicalFallback = SUPPORTED_RUNTIME_LANGUAGES.has(normalizedFallback)
    ? normalizedFallback
    : DEFAULT_RUNTIME_LANGUAGE;
  const normalized = normalizeRuntimeLanguage(value, canonicalFallback);
  return SUPPORTED_RUNTIME_LANGUAGES.has(normalized) ? normalized : canonicalFallback;
}

function requireStoredRuntimeLanguage(value) {
  return requireCanonicalRuntimeLanguage(value);
}

function extractRuntimeLanguageFromUiDocument(documentValue, fallback = DEFAULT_RUNTIME_LANGUAGE) {
  if (!documentValue || typeof documentValue !== 'object' || Array.isArray(documentValue)) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(documentValue, RUNTIME_LANGUAGE_STORAGE_KEY)) {
    return null;
  }
  return requireStoredRuntimeLanguage(documentValue[RUNTIME_LANGUAGE_STORAGE_KEY]);
}

export class RuntimeLanguageStore {
  static getInstance() {
    if (!RuntimeLanguageStore.instance) {
      RuntimeLanguageStore.instance = new RuntimeLanguageStore();
    }
    return RuntimeLanguageStore.instance;
  }

  constructor({
    settingsStore = SettingsStore.getInstance(),
  } = {}) {
    this.settingsStore = settingsStore;
  }

  async get(fallback = DEFAULT_RUNTIME_LANGUAGE) {
    const normalizedFallback = resolveRuntimeLanguage(fallback, DEFAULT_RUNTIME_LANGUAGE);
    const next = await this.settingsStore.get({
      [RUNTIME_LANGUAGE_STORAGE_KEY]: undefined,
    });
    const currentValue = next?.[RUNTIME_LANGUAGE_STORAGE_KEY];
    if (typeof currentValue === 'undefined') return normalizedFallback;
    return requireStoredRuntimeLanguage(currentValue);
  }

  subscribe(listener, { emitCurrent = false, fallback = DEFAULT_RUNTIME_LANGUAGE } = {}) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    const normalizedFallback = resolveRuntimeLanguage(fallback, DEFAULT_RUNTIME_LANGUAGE);
    const handleStorageChange = (changes = {}, areaName) => {
      if (areaName !== 'local') return;

      if (changes?.[STORAGE_LOCAL_DOC_KEYS.UI]) {
        const nextLanguage = extractRuntimeLanguageFromUiDocument(
          changes[STORAGE_LOCAL_DOC_KEYS.UI]?.newValue,
          normalizedFallback,
        );
        const previousLanguage = extractRuntimeLanguageFromUiDocument(
          changes[STORAGE_LOCAL_DOC_KEYS.UI]?.oldValue,
          normalizedFallback,
        );
        if (nextLanguage || previousLanguage) {
          listener(nextLanguage || normalizedFallback);
        }
        return;
      }

    };

    addChromeStorageChangedListener(handleStorageChange);

    if (emitCurrent) {
      void this.get(normalizedFallback)
        .then((language) => listener(language))
        .catch((error) => {
          console.error('[i18n] Failed to hydrate runtime language from storage.', error);
        });
    }

    return () => {
      removeChromeStorageChangedListener(handleStorageChange);
    };
  }
}

export default RuntimeLanguageStore;
