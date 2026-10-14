import { createExperimentDashboardTabEntry } from '@dashboard-experiment-tab-entry';
import { createFilterDashboardTabEntry } from '@dashboard-filter-tab-entry';
import { getTabIcons } from '../../../themes/core/data/tabIcons.jsx';
import { withDynamicImportRecovery } from '../../../platform/extension/dynamicImportRecovery.js';
import { throwIfDashboardPreloadAborted } from '../loading/dashboardPreloadAdmission.js';
import {
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS,
  DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES,
  DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS,
  DASHBOARD_TAB_PRELOAD_SCOPES,
  getDashboardTabAllowedAsyncBoundaryIds as getPolicyAllowedAsyncBoundaryIds,
  getDashboardTabBootDataPreloadIds as getPolicyBootDataPreloadIds,
  getDashboardTabBootPreloadPriority as getPolicyBootPreloadPriority,
  getDashboardTabDeferredThemeWidgetTypes as getPolicyDeferredThemeWidgetTypes,
  getDashboardTabBootPreloadScope as getPolicyBootPreloadScope,
  getDashboardTabHydrationKeys as getPolicyHydrationKeys,
  getDashboardTabIntentPreloadScope as getPolicyIntentPreloadScope,
  getDashboardTabLoadingFrameId as getPolicyLoadingFrameId,
  getDashboardTabLoadingPolicyDefinition,
  getDashboardTabReadinessProfile as getPolicyReadinessProfile,
  getDashboardTabThemeWidgetTypes as getPolicyThemeWidgetTypes,
  isDashboardTabAsyncBoundaryAllowed as isPolicyAsyncBoundaryAllowed,
  resolveDashboardTabWidgetThemeId as resolvePolicyWidgetThemeId,
} from './loadingPolicy.js';

export {
  DASHBOARD_LOADING_CLASSES,
  DASHBOARD_TAB_LOADING_FRAME_IDS,
  DASHBOARD_TAB_READINESS_SCOPES,
} from './loadingPolicy.js';
export { DASHBOARD_TAB_PRELOAD_SCOPES };
export { DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES };
export { DASHBOARD_TAB_ASYNC_BOUNDARY_IDS };
export { DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS };

const PORTRAIT_VISIBLE_TAB_IDS = Object.freeze([
  'main',
  'sites',
  'schedule',
  'tools',
  'settings',
]);
const FALLBACK_TAB_CANDIDATES = Object.freeze(['sites', 'main']);

const loadSitesTabDataPreloaderModule = withDynamicImportRecovery(
  () => import('./sites/preloadSitesTabData.js'),
  { boundaryId: 'dashboard-tab-data:sites-snapshot' },
);
const loadToolsDisclosurePreloaderModule = withDynamicImportRecovery(
  () => import('../artifacts/artifactDisclosureSnapshotResource.js'),
  { boundaryId: 'dashboard-tab-data:tools-disclosure-snapshot' },
);
const DASHBOARD_TAB_BOOT_DATA_PRELOADERS = Object.freeze({
  [DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS.SITES_SNAPSHOT]: async ({
    preferredDomain = null,
    signal = null,
  } = {}) => {
    const loadedModule = await loadSitesTabDataPreloaderModule();
    if (typeof loadedModule?.preloadSitesTabData !== 'function') {
      throw new Error(
        'DASHBOARD_TAB_BOOT_DATA_PRELOADER_EXPORT_MISSING:sites-snapshot',
      );
    }
    return loadedModule.preloadSitesTabData({ preferredDomain, signal });
  },
  [DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS.TOOLS_DISCLOSURE_SNAPSHOT]: async ({ signal = null } = {}) => {
    throwIfDashboardPreloadAborted(signal);
    const loadedModule = await loadToolsDisclosurePreloaderModule();
    throwIfDashboardPreloadAborted(signal);
    if (typeof loadedModule?.readArtifactDisclosureSnapshotResource !== 'function') {
      throw new Error(
        'DASHBOARD_TAB_BOOT_DATA_PRELOADER_EXPORT_MISSING:tools-disclosure-snapshot',
      );
    }
    const snapshot = await loadedModule.readArtifactDisclosureSnapshotResource();
    throwIfDashboardPreloadAborted(signal);
    return snapshot;
  },
});

const EXPERIMENT_DASHBOARD_TAB_ENTRY = createExperimentDashboardTabEntry({
  loadingPolicy: getDashboardTabLoadingPolicyDefinition('experiment'),
});
const FILTER_DASHBOARD_TAB_ENTRY = createFilterDashboardTabEntry({
  loadingPolicy: getDashboardTabLoadingPolicyDefinition('filter'),
});

const dashboardTabRegistry = {
  main: Object.freeze({
    id: 'main',
    load: () => import('./main/MainTab.jsx'),
    keepAlive: true,
    portraitVisible: true,
    ...getDashboardTabLoadingPolicyDefinition('main'),
    titleKey: 'main.title',
    navKey: 'main.nav',
    descriptionKey: 'main.desc',
  }),
  ...(EXPERIMENT_DASHBOARD_TAB_ENTRY
    ? { experiment: EXPERIMENT_DASHBOARD_TAB_ENTRY }
    : {}),
  sites: Object.freeze({
    id: 'sites',
    load: () => import('./sites/SitesTab.jsx'),
    portraitVisible: true,
    ...getDashboardTabLoadingPolicyDefinition('sites'),
    titleKey: 'sites.title',
    navKey: 'sites.nav',
    descriptionKey: 'sites.desc',
  }),
  schedule: Object.freeze({
    id: 'schedule',
    load: () => import('./schedule/ScheduleTab.jsx'),
    portraitVisible: true,
    ...getDashboardTabLoadingPolicyDefinition('schedule'),
    titleKey: 'schedule.title',
    navKey: 'schedule.nav',
    descriptionKey: 'schedule.desc',
  }),
  ...(FILTER_DASHBOARD_TAB_ENTRY
    ? { filter: FILTER_DASHBOARD_TAB_ENTRY }
    : {}),
  tools: Object.freeze({
    id: 'tools',
    load: () => import('./tools/ToolsTab.jsx'),
    keepAlive: true,
    portraitVisible: true,
    ...getDashboardTabLoadingPolicyDefinition('tools'),
    titleKey: 'tools.title',
    navKey: 'tools.nav',
    descriptionKey: 'tools.desc',
  }),
  settings: Object.freeze({
    id: 'settings',
    load: () => import('./settings/SettingsTab.jsx'),
    portraitVisible: true,
    ...getDashboardTabLoadingPolicyDefinition('settings'),
    titleKey: 'settings.title',
    navKey: 'settings.nav',
    descriptionKey: 'settings.desc',
  }),
};

const DASHBOARD_TAB_REGISTRY = Object.freeze(dashboardTabRegistry);

export const DASHBOARD_TAB_IDS = Object.freeze(Object.keys(DASHBOARD_TAB_REGISTRY));

export const DASHBOARD_TAB_COMPONENT_LOADERS = Object.freeze(
  DASHBOARD_TAB_IDS.reduce((acc, tabId) => {
    acc[tabId] = DASHBOARD_TAB_REGISTRY[tabId].load;
    return acc;
  }, {}),
);

export const DASHBOARD_LOADING_POLICY = Object.freeze(
  DASHBOARD_TAB_IDS.reduce((acc, tabId) => {
    const entry = DASHBOARD_TAB_REGISTRY[tabId];
    acc[tabId] = Object.freeze({
      className: entry.className,
      bootPreloadPriority: entry.bootPreloadPriority,
      bootPreloadScope: entry.bootPreloadScope,
      bootDataPreloadIds: getPolicyBootDataPreloadIds(tabId),
      routePreload: entry.routePreload,
      readinessScope: entry.readinessScope,
      loadingFrameId: entry.loadingFrameId,
      intentPreloadScope: entry.intentPreloadScope,
      allowedAsyncBoundaryIds: getPolicyAllowedAsyncBoundaryIds(tabId),
      allowSemanticFallback: entry.allowSemanticFallback,
      hydrationKeys: entry.hydrationKeys,
      themeWidgetTypes: getPolicyThemeWidgetTypes(tabId),
    });
    return acc;
  }, {}),
);

function ensureTabIds(tabIds) {
  return Array.isArray(tabIds) ? tabIds.filter((id) => typeof id === 'string' && id) : [];
}

export function getDashboardTabRegistryEntry(tabId) {
  if (typeof tabId !== 'string') return null;
  return DASHBOARD_TAB_REGISTRY[tabId] || null;
}

export function isKnownDashboardTabId(tabId) {
  return typeof tabId === 'string' && Object.prototype.hasOwnProperty.call(DASHBOARD_TAB_REGISTRY, tabId);
}

export function isDashboardTabEnabled(tabId, context = {}) {
  const entry = getDashboardTabRegistryEntry(tabId);
  if (!entry) return false;
  if (typeof entry.isEnabled !== 'function') return true;
  return entry.isEnabled(context) !== false;
}

export function getDashboardDefaultTabId() {
  return 'main';
}

export function filterTabIdsByMode(tabIds) {
  return ensureTabIds(tabIds);
}

export function filterTabsByViewport(tabs, isPortrait) {
  if (!Array.isArray(tabs)) return [];
  if (!isPortrait) return tabs;
  return tabs.filter((tab) => PORTRAIT_VISIBLE_TAB_IDS.includes(tab?.id));
}

export function getDashboardEnabledTabIds(context = {}) {
  return DASHBOARD_TAB_IDS.filter((tabId) => isDashboardTabEnabled(tabId, context));
}

function requireDashboardTabCopyValue(t, tabId, field, key) {
  if (typeof t !== 'function') {
    throw new Error(`DASHBOARD_TAB_ROUTE_COPY_REQUIRED:${tabId}:${field}`);
  }
  const value = t(key);
  if (typeof value !== 'string' || !value.trim() || value.trim() === key) {
    throw new Error(`DASHBOARD_TAB_ROUTE_COPY_REQUIRED:${tabId}:${field}`);
  }
  return value.trim();
}

export function buildDashboardTabs({
  themeId,
  t,
  tabIds = null,
  context = {},
} = {}) {
  const icons = getTabIcons(themeId);
  const baseTabIds = Array.isArray(tabIds)
    ? ensureTabIds(tabIds).filter((tabId) => isDashboardTabEnabled(tabId, context))
    : getDashboardEnabledTabIds(context);
  const resolvedTabIds = filterTabIdsByMode(baseTabIds);

  return resolvedTabIds.map((tabId) => {
    const entry = getDashboardTabRegistryEntry(tabId);
    const navIcon = icons[tabId];
    if (!navIcon) {
      throw new Error(`DASHBOARD_TAB_ICON_REQUIRED:${tabId}`);
    }
    return {
      id: tabId,
      navIcon,
      navLabel: requireDashboardTabCopyValue(t, tabId, 'navLabel', entry.navKey),
      title: requireDashboardTabCopyValue(t, tabId, 'title', entry.titleKey),
      description: requireDashboardTabCopyValue(t, tabId, 'description', entry.descriptionKey),
    };
  });
}

export function resolvePolicyFallbackTabId(tabIds, {
  preferredFallbackTabId = null,
} = {}) {
  const safeTabIds = ensureTabIds(tabIds);
  if (!safeTabIds.length) return getDashboardDefaultTabId();

  const candidates = [
    preferredFallbackTabId,
    getDashboardDefaultTabId(),
    ...FALLBACK_TAB_CANDIDATES,
    safeTabIds[0],
  ];

  const resolved = candidates.find((tabId) => safeTabIds.includes(tabId));
  return resolved || safeTabIds[0] || getDashboardDefaultTabId();
}

export function resolveAccessibleTabId(targetTabId, tabIds, options = {}) {
  const safeTabIds = ensureTabIds(tabIds);
  if (!safeTabIds.length) return getDashboardDefaultTabId();
  if (typeof targetTabId === 'string' && safeTabIds.includes(targetTabId)) {
    return targetTabId;
  }
  return resolvePolicyFallbackTabId(safeTabIds, options);
}

export function getDashboardTabLoader(tabId) {
  return getDashboardTabRegistryEntry(tabId)?.load || null;
}

function normalizeTabIds(tabIds = DASHBOARD_TAB_IDS) {
  if (!Array.isArray(tabIds)) return [...DASHBOARD_TAB_IDS];
  return ensureTabIds(tabIds);
}

export function getDashboardBootPreloadTabIds(tabIds = DASHBOARD_TAB_IDS, context = {}) {
  return normalizeTabIds(tabIds)
    .map((tabId, index) => ({ tabId, index }))
    .filter(({ tabId }) => (
      isDashboardTabEnabled(tabId, context)
      && (
        getPolicyBootPreloadScope(tabId) !== DASHBOARD_TAB_PRELOAD_SCOPES.NONE
        || getPolicyBootDataPreloadIds(tabId).length > 0
      )
    ))
    .sort((left, right) => (
      getPolicyBootPreloadPriority(right.tabId)
      - getPolicyBootPreloadPriority(left.tabId)
      || left.index - right.index
    ))
    .map(({ tabId }) => tabId);
}

export function shouldDashboardTabKeepAlive(tabId) {
  return !!getDashboardTabRegistryEntry(tabId)?.keepAlive;
}

export function shouldDashboardTabPreloadOnRoute(tabId) {
  return !!getDashboardTabRegistryEntry(tabId)?.routePreload;
}

export function getDashboardTabLoadingPolicy(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? DASHBOARD_LOADING_POLICY[tabId] || null
    : null;
}

export function getDashboardTabThemeWidgetTypes(tabId, context = {}) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyThemeWidgetTypes(tabId, context)
    : [];
}

export function getDashboardTabHydrationKeys(tabId, context = {}) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyHydrationKeys(tabId, context)
    : [];
}

export function getDashboardTabReadinessProfile(tabId, context = {}) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyReadinessProfile(tabId, context)
    : null;
}

export function getDashboardTabLoadingFrameId(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyLoadingFrameId(tabId)
    : getPolicyLoadingFrameId('');
}

export function getDashboardTabIntentPreloadScope(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyIntentPreloadScope(tabId)
    : getPolicyIntentPreloadScope('');
}

export function getDashboardTabBootPreloadScope(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyBootPreloadScope(tabId)
    : getPolicyBootPreloadScope('');
}

export function getDashboardTabBootPreloadPriority(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyBootPreloadPriority(tabId)
    : DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NONE;
}

export function getDashboardTabBootDataPreloadIds(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyBootDataPreloadIds(tabId)
    : [];
}

export function getDashboardTabBootDataPreloadEntries(tabId, context = {}) {
  return getDashboardTabBootDataPreloadIds(tabId).map((preloadId) => {
    const runPreload = DASHBOARD_TAB_BOOT_DATA_PRELOADERS[preloadId];
    if (typeof runPreload !== 'function') {
      throw new Error(`DASHBOARD_TAB_BOOT_DATA_PRELOADER_MISSING:${preloadId}`);
    }
    return Object.freeze({
      id: preloadId,
      run: ({ signal = null } = {}) => runPreload({ ...context, signal }),
    });
  });
}

export function getDashboardTabDeferredThemeWidgetTypes(tabId, context = {}) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyDeferredThemeWidgetTypes(tabId, context)
    : [];
}

export function getDashboardTabAllowedAsyncBoundaryIds(tabId) {
  return getDashboardTabRegistryEntry(tabId)
    ? getPolicyAllowedAsyncBoundaryIds(tabId)
    : [];
}

export function isDashboardTabAsyncBoundaryAllowed(tabId, boundaryId) {
  return !!getDashboardTabRegistryEntry(tabId)
    && isPolicyAsyncBoundaryAllowed(tabId, boundaryId);
}

export function resolveDashboardTabWidgetThemeId(tabId, themeId) {
  return getDashboardTabRegistryEntry(tabId)
    ? resolvePolicyWidgetThemeId(tabId, themeId)
    : themeId;
}

export default DASHBOARD_TAB_REGISTRY;
