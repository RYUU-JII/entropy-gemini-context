import { I18N_SUPPORTED_LOCALES } from './metadata.js';

// Each generated dictionary has its own async boundary. The locale JSON and
// generator remain the copy owners; this module owns only resource admission.
const NAMESPACE_LOADERS = Object.freeze({
  filter: Object.freeze({
    en: () => import('./locales/en/filter.js'),
    ko: () => import('./locales/ko/filter.js'),
  }),
  sites: Object.freeze({
    en: () => import('./locales/en/sites.js'),
    ko: () => import('./locales/ko/sites.js'),
  }),
  schedule: Object.freeze({
    en: () => import('./locales/en/schedule.js'),
    ko: () => import('./locales/ko/schedule.js'),
  }),
  settings: Object.freeze({
    en: () => import('./locales/en/settings.js'),
    ko: () => import('./locales/ko/settings.js'),
  }),
  tools: Object.freeze({
    en: () => import('./locales/en/tools.js'),
    ko: () => import('./locales/ko/tools.js'),
  }),
});

export async function loadDashboardDeferredI18nNamespace(namespace) {
  if (typeof namespace !== 'string' || !Object.hasOwn(NAMESPACE_LOADERS, namespace)) {
    throw new Error(`DASHBOARD_I18N_NAMESPACE_NOT_DECLARED:${String(namespace)}`);
  }
  const loaders = NAMESPACE_LOADERS[namespace];
  if (Object.keys(loaders).length !== I18N_SUPPORTED_LOCALES.length
    || I18N_SUPPORTED_LOCALES.some((language) => typeof loaders[language] !== 'function')) {
    throw new Error(`DASHBOARD_I18N_NAMESPACE_LOADER_LOCALES_INVALID:${namespace}`);
  }
  const entries = await Promise.all(I18N_SUPPORTED_LOCALES.map(async (language) => {
    const module = await loaders[language]();
    return [language, module.default];
  }));
  return Object.fromEntries(entries);
}
