import { normalizeThemeId } from '@/themes/core/ids.js';
import {
  getThemeWidgetChunkState,
  preloadThemeWidgetChunk,
} from '@/themes/core/registry/index.js';
import { withDynamicImportRecovery } from '@/platform/extension/dynamicImportRecovery.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';
import { assertThemeWidgetPreloadAck } from './themeWidgetPreloadContract.js';
import { preloadDashboardTabI18nResources } from '@/i18n/dashboardResources.js';
import { preloadArtifactGalleryRuntime } from '@/themes/core/tools/artifactGalleryPreparation.js';
import { preloadToolsInitialArtifact } from '../tabs/tools/preloadToolsInitialArtifact.js';
import { throwIfDashboardPreloadAborted } from './dashboardPreloadAdmission.js';

import {
  DASHBOARD_TAB_PRELOAD_SCOPES,
  getDashboardTabBootPreloadScope,
  getDashboardTabIntentPreloadScope,
  getDashboardTabLoader,
  getDashboardTabThemeWidgetTypes,
  isDashboardTabEnabled,
  resolveDashboardTabWidgetThemeId,
} from '../tabs/registry.js';

const tabModulePreloadCache = new Map();
const tabModuleComponentCache = new Map();
const getDashboardTabRecoveryBoundaryId = (tabId) => `dashboard-tab:${tabId}`;
const PRELOAD_ERROR_CODES = Object.freeze({
  intent: Object.freeze({
    targetUnavailable: 'DASHBOARD_TAB_INTENT_TARGET_UNAVAILABLE',
    invalidScope: 'DASHBOARD_TAB_INTENT_PRELOAD_SCOPE_INVALID',
    themeRequired: 'DASHBOARD_TAB_INTENT_THEME_ID_REQUIRED',
  }),
  boot: Object.freeze({
    targetUnavailable: 'DASHBOARD_TAB_BOOT_TARGET_UNAVAILABLE',
    invalidScope: 'DASHBOARD_TAB_BOOT_PRELOAD_SCOPE_INVALID',
    themeRequired: 'DASHBOARD_TAB_BOOT_THEME_ID_REQUIRED',
  }),
});

export function preloadDashboardTabModule(tabId, { source = 'render' } = {}) {
  const loader = getDashboardTabLoader(tabId);
  if (typeof loader !== 'function') {
    recordDashboardTabEntryStage(tabId, 'module:error', {
      code: 'DASHBOARD_TAB_LOADER_MISSING',
      source,
    });
    return Promise.reject(new Error(`DASHBOARD_TAB_LOADER_MISSING:${String(tabId || '')}`));
  }
  if (tabModuleComponentCache.has(tabId)) {
    recordDashboardTabEntryStage(tabId, 'module:cache', {
      cacheStatus: 'hit',
      source,
    });
    const cachedPromise = tabModulePreloadCache.get(tabId);
    if (!cachedPromise) {
      return Promise.reject(new Error(
        `DASHBOARD_TAB_MODULE_CACHE_RECORD_INVALID:${String(tabId || '')}`,
      ));
    }
    return cachedPromise;
  }
  if (tabModulePreloadCache.has(tabId)) {
    recordDashboardTabEntryStage(tabId, 'module:cache', {
      cacheStatus: 'join',
      source,
    });
    return tabModulePreloadCache.get(tabId);
  }
  recordDashboardTabEntryStage(tabId, 'module:cache', {
    cacheStatus: 'miss',
    source,
  });
  const loadWithRecovery = withDynamicImportRecovery(loader, {
    boundaryId: getDashboardTabRecoveryBoundaryId(tabId),
  });
  const preloadPromise = Promise.resolve()
    .then(() => Promise.all([
      loadWithRecovery(),
      preloadDashboardTabI18nResources(tabId),
    ]))
    .then(([loadedModule]) => {
      if (typeof loadedModule?.default !== 'function') {
        throw new Error(`DASHBOARD_TAB_MODULE_DEFAULT_EXPORT_MISSING:${String(tabId || '')}`);
      }
      tabModuleComponentCache.set(tabId, loadedModule.default);
      recordDashboardTabEntryStage(tabId, 'module:ready', { source });
      return loadedModule;
    })
    .catch((error) => {
      tabModulePreloadCache.delete(tabId);
      tabModuleComponentCache.delete(tabId);
      recordDashboardTabEntryStage(tabId, 'module:error', {
        code: error?.code || 'DASHBOARD_TAB_MODULE_LOAD_FAILED',
        message: error?.message || String(error),
        source,
      });
      throw error;
    });
  tabModulePreloadCache.set(tabId, preloadPromise);
  return preloadPromise;
}

export function getPreloadedDashboardTabComponent(tabId) {
  const component = tabModuleComponentCache.get(tabId) || null;
  if (component) {
    recordDashboardTabEntryStage(tabId, 'module:cache', {
      cacheStatus: 'hit',
      source: 'component-read',
    });
  }
  return component;
}

async function preloadDashboardTabDependencies({
  tabId,
  themeId,
  context = {},
  scope,
  errorCodes,
  source,
  signal = null,
} = {}) {
  throwIfDashboardPreloadAborted(signal);
  if (!isDashboardTabEnabled(tabId, context)) {
    throw new Error(`${errorCodes.targetUnavailable}:${String(tabId || '')}`);
  }
  if (scope === DASHBOARD_TAB_PRELOAD_SCOPES.NONE) {
    return Object.freeze({ tabId, scope, moduleLoaded: false, widgetTypes: [] });
  }

  if (scope === DASHBOARD_TAB_PRELOAD_SCOPES.MODULE) {
    await preloadDashboardTabModule(tabId, { source });
    throwIfDashboardPreloadAborted(signal);
    return Object.freeze({ tabId, scope, moduleLoaded: true, widgetTypes: [] });
  }

  if (scope !== DASHBOARD_TAB_PRELOAD_SCOPES.CRITICAL) {
    throw new Error(`${errorCodes.invalidScope}:${String(scope || '')}`);
  }

  const widgetTypes = getDashboardTabThemeWidgetTypes(tabId, { themeId });
  if (widgetTypes.length > 0 && !themeId) {
    throw new Error(`${errorCodes.themeRequired}:${String(tabId || '')}`);
  }
  const widgetThemeId = widgetTypes.length > 0
    ? normalizeThemeId(resolveDashboardTabWidgetThemeId(tabId, themeId), themeId)
    : themeId;
  const modulePromise = preloadDashboardTabModule(tabId, { source });
  await Promise.all([
    modulePromise,
    ...(tabId === 'tools' ? [preloadArtifactGalleryRuntime(widgetThemeId)] : []),
    ...(tabId === 'tools' ? [preloadToolsInitialArtifact(widgetThemeId, { signal })] : []),
    ...widgetTypes.map(async (widgetType) => {
      const ack = await preloadThemeWidgetChunk(widgetThemeId, widgetType);
      return assertThemeWidgetPreloadAck({
        ack,
        chunkState: getThemeWidgetChunkState(widgetThemeId, widgetType),
        themeId: widgetThemeId,
        widgetType,
      });
    }),
  ]);
  throwIfDashboardPreloadAborted(signal);
  return Object.freeze({
    tabId,
    scope,
    moduleLoaded: true,
    widgetTypes: Object.freeze([...widgetTypes]),
  });
}

export function preloadDashboardTabIntent({ tabId, themeId, context = {}, signal = null } = {}) {
  return preloadDashboardTabDependencies({
    tabId,
    themeId,
    context,
    scope: getDashboardTabIntentPreloadScope(tabId),
    errorCodes: PRELOAD_ERROR_CODES.intent,
    source: 'intent',
    signal,
  });
}

export function preloadDashboardTabBoot({ tabId, themeId, context = {}, signal = null } = {}) {
  return preloadDashboardTabDependencies({
    tabId,
    themeId,
    context,
    scope: getDashboardTabBootPreloadScope(tabId),
    errorCodes: PRELOAD_ERROR_CODES.boot,
    source: 'boot',
    signal,
  });
}

export function resetDashboardTabModulePreloadCache() {
  tabModulePreloadCache.clear();
  tabModuleComponentCache.clear();
}
