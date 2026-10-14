import i18n from 'i18next';
import { I18N_SUPPORTED_LOCALES } from './metadata.js';

import enCommon from './locales/en/common.js';
import enDashboard from './locales/en/dashboard.js';
import enMain from './locales/en/main.js';
import enTheme from './locales/en/theme.js';

import koCommon from './locales/ko/common.js';
import koDashboard from './locales/ko/dashboard.js';
import koMain from './locales/ko/main.js';
import koTheme from './locales/ko/theme.js';
import enGuidance from './locales/en/guidance.js';
import koGuidance from './locales/ko/guidance.js';

export const DASHBOARD_BOOTSTRAP_I18N_RESOURCES = Object.freeze({
  en: Object.freeze({
    common: enCommon,
    dashboard: enDashboard,
    main: enMain,
    theme: enTheme,
    guidance: enGuidance,
  }),
  ko: Object.freeze({
    common: koCommon,
    dashboard: koDashboard,
    main: koMain,
    theme: koTheme,
    guidance: koGuidance,
  }),
});

export function createDashboardBootstrapI18nResources() {
  return Object.fromEntries(
    Object.entries(DASHBOARD_BOOTSTRAP_I18N_RESOURCES).map(([language, namespaces]) => [
      language,
      { ...namespaces },
    ]),
  );
}

// Shell/Common/Main/Theme are resident. These dependencies include nested
// dialogs, theme widgets, and labs, not just each tab root's default namespace.
const DASHBOARD_TAB_DEFERRED_NAMESPACES = Object.freeze({
  main: Object.freeze(['sites', 'tools']),
  sites: Object.freeze(['sites', 'filter', 'tools']),
  schedule: Object.freeze(['schedule']),
  filter: Object.freeze(['filter', 'tools', 'settings']),
  tools: Object.freeze(['tools']),
  settings: Object.freeze(['settings']),
  experiment: Object.freeze(['tools', 'settings']),
});

function requireNamespaceResources(namespace, resources) {
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) {
    throw new Error(`DASHBOARD_I18N_NAMESPACE_RESOURCES_INVALID:${namespace}`);
  }
  if (Object.keys(resources).length !== I18N_SUPPORTED_LOCALES.length) {
    throw new Error(`DASHBOARD_I18N_NAMESPACE_LOCALES_INVALID:${namespace}`);
  }
  for (const language of I18N_SUPPORTED_LOCALES) {
    const resource = resources[language];
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)
      || Object.keys(resource).length === 0) {
      throw new Error(`DASHBOARD_I18N_NAMESPACE_RESOURCE_INVALID:${language}:${namespace}`);
    }
  }
  return resources;
}

export function createDashboardI18nResourceAdmission({
  i18nInstance,
  loadDeferredNamespace,
} = {}) {
  if (!i18nInstance || typeof i18nInstance !== 'object'
    || typeof loadDeferredNamespace !== 'function') {
    throw new Error('DASHBOARD_I18N_RESOURCE_ADMISSION_OWNER_REQUIRED');
  }
  const namespacePromises = new Map();
  const tabPromises = new Map();

  const preloadNamespace = (namespace) => {
    if (namespacePromises.has(namespace)) return namespacePromises.get(namespace);
    const promise = Promise.resolve()
      .then(() => loadDeferredNamespace(namespace))
      .then((loadedResources) => {
        const resources = requireNamespaceResources(namespace, loadedResources);
        if (typeof i18nInstance.addResourceBundle !== 'function') {
          throw new Error('DASHBOARD_I18N_RESOURCE_REGISTRATION_NOT_READY');
        }
        for (const language of I18N_SUPPORTED_LOCALES) {
          i18nInstance.addResourceBundle(language, namespace, resources[language], true, false);
        }
      })
      .catch((error) => {
        namespacePromises.delete(namespace);
        throw error;
      });
    namespacePromises.set(namespace, promise);
    return promise;
  };

  return (tabId) => {
    if (typeof tabId !== 'string' || !Object.hasOwn(DASHBOARD_TAB_DEFERRED_NAMESPACES, tabId)) {
      return Promise.reject(new Error(`DASHBOARD_I18N_TAB_NOT_DECLARED:${String(tabId)}`));
    }
    if (tabPromises.has(tabId)) return tabPromises.get(tabId);
    const promise = Promise.all(
      DASHBOARD_TAB_DEFERRED_NAMESPACES[tabId].map(preloadNamespace),
    ).then(() => undefined).catch((error) => {
      tabPromises.delete(tabId);
      throw error;
    });
    tabPromises.set(tabId, promise);
    return promise;
  };
}

export const preloadDashboardTabI18nResources = createDashboardI18nResourceAdmission({
  i18nInstance: i18n,
  loadDeferredNamespace: (namespace) => import('./dashboardDeferredResources.js')
    .then(({ loadDashboardDeferredI18nNamespace }) => {
      if (typeof loadDashboardDeferredI18nNamespace !== 'function') {
        throw new Error('DASHBOARD_I18N_DEFERRED_NAMESPACE_OWNER_MISSING');
      }
      return loadDashboardDeferredI18nNamespace(namespace);
    }),
});
