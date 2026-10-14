import enCommon from './locales/en/common.js';
import koCommon from './locales/ko/common.js';
import enGuidance from './locales/en/guidance.js';
import koGuidance from './locales/ko/guidance.js';

export const POPUP_I18N_RESOURCES = Object.freeze({
  en: Object.freeze({
    common: enCommon,
    guidance: enGuidance,
  }),
  ko: Object.freeze({
    common: koCommon,
    guidance: koGuidance,
  }),
});

export function createPopupI18nResources() {
  return Object.fromEntries(
    Object.entries(POPUP_I18N_RESOURCES).map(([language, namespaces]) => [
      language,
      { ...namespaces },
    ]),
  );
}
