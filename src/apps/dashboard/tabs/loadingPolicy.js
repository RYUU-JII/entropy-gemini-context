import { hasDeclaredThemeWidget } from '../../../themes/core/surfaceDescriptor.js';
import {
  EXPERIMENT_LAB_SECTION_IDS,
  getExperimentLabReadinessProfile,
} from './experiment/experimentLabCatalog.js';
import { resolveMainWidgetThemeId } from './main/themeRegistry.js';

export const DASHBOARD_LOADING_CLASSES = Object.freeze({
  BOOT_CRITICAL: 'boot-critical',
  STANDARD: 'standard',
  VISUAL_HEAVY: 'visual-heavy',
});

export const DASHBOARD_TAB_READINESS_SCOPES = Object.freeze({
  TAB_ROOT: 'tab-root',
  LAB_SECTION: 'lab-section',
});

export const DASHBOARD_TAB_PRELOAD_SCOPES = Object.freeze({
  NONE: 'none',
  MODULE: 'module',
  CRITICAL: 'critical',
});

export const DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES = Object.freeze({
  NONE: 0,
  LOW: 100,
  NORMAL: 200,
  HIGH: 300,
});

export const DASHBOARD_TAB_ASYNC_BOUNDARY_IDS = Object.freeze({
  EXPERIMENT_LAB_SECTION: 'experiment-lab-section',
  MAIN_SESSION_SUMMARY_AI: 'main-session-summary-ai',
  SCHEDULE_SPECIAL_SESSION: 'schedule-special-session',
  SITES_NOTEBOOK_TARGET: 'sites-notebook-target',
  SETTINGS_SAFETY: 'settings-safety',
  SETTINGS_WORKSPACE: 'settings-workspace',
  SETTINGS_PROTECTION: 'settings-protection',
  TOOLS_SELECTED_ARTIFACT_CONTROLLER: 'tools-selected-artifact-controller',
  TOOLS_STORAGE_SUPPORT: 'tools-storage-support',
});

export const DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS = Object.freeze({
  SITES_SNAPSHOT: 'sites-snapshot',
  TOOLS_DISCLOSURE_SNAPSHOT: 'tools-disclosure-snapshot',
});

export const DASHBOARD_TAB_LOADING_FRAME_IDS = Object.freeze({
  CANVAS: 'canvas',
  SPLIT: 'split',
  STACK: 'stack',
  ARTIFACT_WORKSPACE: 'artifact-workspace',
});

const PREFERENCE_PROTOCOL_HYDRATION = Object.freeze(['preference', 'protocol']);
const PREFERENCE_PROTOCOL_ANALYSIS_HYDRATION = Object.freeze([
  'preference',
  'protocol',
  'analysis',
]);
const NO_THEME_WIDGETS = Object.freeze([]);
const NO_ASYNC_BOUNDARIES = Object.freeze([]);
const NO_BOOT_DATA_PRELOADS = Object.freeze([]);
const NO_ANALYSIS_PROJECTIONS = Object.freeze([]);
const CYCLE_ANALYSIS_PROJECTIONS = Object.freeze(['cycle']);
const MAIN_ANALYSIS_PROJECTIONS = Object.freeze(['cycle', 'status']);
const MAIN_BASE_THEME_WIDGETS = Object.freeze([
  'SignalScanner',
  'CoreStatus',
]);
const MAIN_THEME_WIDGETS = Object.freeze([
  ...MAIN_BASE_THEME_WIDGETS,
  'HomeBriefCard',
]);
const MAIN_ZEN_THEME_WIDGETS = Object.freeze([
  ...MAIN_BASE_THEME_WIDGETS,
  'PressureRail',
  'RhythmMarker',
]);
const TOOLS_CRITICAL_THEME_WIDGETS = Object.freeze([
  'ArtifactIcons',
  'ArtifactPanel',
  'ArtifactCanvas',
  'ArtifactGalleryVisual',
]);
const PREVIEW_THEME_WIDGETS = Object.freeze(['FilterTest']);
const SITES_THEME_WIDGETS = Object.freeze([
  'SitesRegistry',
]);
const SITES_NOTEBOOK_THEME_WIDGETS = Object.freeze([
  'SitesTargetPanel',
]);

function resolveSitesThemeWidgetTypes({ surfaceId } = {}) {
  return surfaceId === DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SITES_NOTEBOOK_TARGET
    ? SITES_NOTEBOOK_THEME_WIDGETS
    : SITES_THEME_WIDGETS;
}

function resolveSitesReadinessProfile({ surfaceId = '' } = {}) {
  return Object.freeze({ surfaceId: surfaceId || 'sites' });
}

function resolveExperimentReadinessProfile({ surfaceId, themeId } = {}) {
  const profile = getExperimentLabReadinessProfile(
    surfaceId || EXPERIMENT_LAB_SECTION_IDS.HOME,
  );
  return Object.freeze({
    ...profile,
    widgetTypes: resolveDeclaredThemeWidgetTypes(themeId, profile.widgetTypes),
  });
}

function resolveMainThemeWidgetTypes({ themeId } = {}) {
  if (!themeId) return MAIN_THEME_WIDGETS;
  return resolveMainWidgetThemeId(themeId) === 'zen'
    ? MAIN_ZEN_THEME_WIDGETS
    : MAIN_THEME_WIDGETS;
}

function hasThemeWidget(themeId, widgetType) {
  return !!(themeId && widgetType && hasDeclaredThemeWidget(themeId, widgetType));
}

function resolveDeclaredThemeWidgetTypes(themeId, widgetTypes) {
  const cleanWidgetTypes = [...new Set(
    (Array.isArray(widgetTypes) ? widgetTypes : [])
      .filter((widgetType) => typeof widgetType === 'string' && widgetType.trim()),
  )];
  if (!themeId) return cleanWidgetTypes;
  return cleanWidgetTypes.filter((widgetType) => hasThemeWidget(themeId, widgetType));
}

const DASHBOARD_TAB_LOADING_POLICY_CATALOG = Object.freeze({
  main: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.BOOT_CRITICAL,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.CANVAS,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.NONE,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.NONE,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NONE,
    bootDataPreloadIds: NO_BOOT_DATA_PRELOADS,
    routePreload: true,
    allowedAsyncBoundaryIds: Object.freeze([
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.MAIN_SESSION_SUMMARY_AI,
    ]),
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_ANALYSIS_HYDRATION,
    analysisProjections: MAIN_ANALYSIS_PROJECTIONS,
    resolveThemeWidgetTypes: resolveMainThemeWidgetTypes,
    resolveWidgetThemeId: resolveMainWidgetThemeId,
  }),
  experiment: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.VISUAL_HEAVY,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.LAB_SECTION,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.CANVAS,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.MODULE,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.NONE,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NONE,
    bootDataPreloadIds: NO_BOOT_DATA_PRELOADS,
    routePreload: false,
    allowedAsyncBoundaryIds: Object.freeze([
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.EXPERIMENT_LAB_SECTION,
    ]),
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    resolveReadinessProfile: resolveExperimentReadinessProfile,
    resolveThemeWidgetTypes: (context = {}) => (
      resolveExperimentReadinessProfile(context).widgetTypes
    ),
  }),
  sites: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.STANDARD,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.SPLIT,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.CRITICAL,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.CRITICAL,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NORMAL,
    bootDataPreloadIds: Object.freeze([
      DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS.SITES_SNAPSHOT,
    ]),
    routePreload: true,
    allowedAsyncBoundaryIds: Object.freeze([
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SITES_NOTEBOOK_TARGET,
    ]),
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    resolveReadinessProfile: resolveSitesReadinessProfile,
    resolveThemeWidgetTypes: resolveSitesThemeWidgetTypes,
  }),
  schedule: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.STANDARD,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.CANVAS,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.MODULE,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.MODULE,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.HIGH,
    bootDataPreloadIds: NO_BOOT_DATA_PRELOADS,
    routePreload: true,
    allowedAsyncBoundaryIds: Object.freeze([
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SCHEDULE_SPECIAL_SESSION,
    ]),
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_ANALYSIS_HYDRATION,
    analysisProjections: CYCLE_ANALYSIS_PROJECTIONS,
    resolveThemeWidgetTypes: () => NO_THEME_WIDGETS,
  }),
  filter: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.STANDARD,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.SPLIT,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.NONE,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.NONE,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NONE,
    bootDataPreloadIds: NO_BOOT_DATA_PRELOADS,
    routePreload: false,
    allowedAsyncBoundaryIds: NO_ASYNC_BOUNDARIES,
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    resolveThemeWidgetTypes: () => PREVIEW_THEME_WIDGETS,
  }),
  tools: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.VISUAL_HEAVY,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.ARTIFACT_WORKSPACE,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.CRITICAL,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.CRITICAL,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.LOW,
    bootDataPreloadIds: Object.freeze([
      DASHBOARD_TAB_BOOT_DATA_PRELOAD_IDS.TOOLS_DISCLOSURE_SNAPSHOT,
    ]),
    routePreload: true,
    allowedAsyncBoundaryIds: Object.freeze([
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.TOOLS_SELECTED_ARTIFACT_CONTROLLER,
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.TOOLS_STORAGE_SUPPORT,
    ]),
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    resolveThemeWidgetTypes: ({ themeId } = {}) => (
      resolveDeclaredThemeWidgetTypes(themeId, TOOLS_CRITICAL_THEME_WIDGETS)
    ),
    resolveDeferredThemeWidgetTypes: () => NO_THEME_WIDGETS,
  }),
  settings: Object.freeze({
    className: DASHBOARD_LOADING_CLASSES.STANDARD,
    readinessScope: DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    loadingFrameId: DASHBOARD_TAB_LOADING_FRAME_IDS.SPLIT,
    intentPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.MODULE,
    bootPreloadScope: DASHBOARD_TAB_PRELOAD_SCOPES.NONE,
    bootPreloadPriority: DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NONE,
    bootDataPreloadIds: NO_BOOT_DATA_PRELOADS,
    routePreload: true,
    allowedAsyncBoundaryIds: Object.freeze([
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_SAFETY,
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_WORKSPACE,
      DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_PROTECTION,
    ]),
    allowSemanticFallback: false,
    hydrationKeys: PREFERENCE_PROTOCOL_ANALYSIS_HYDRATION,
    analysisProjections: CYCLE_ANALYSIS_PROJECTIONS,
    resolveThemeWidgetTypes: () => NO_THEME_WIDGETS,
  }),
});

function resolveWidgetTypes(policy, resolverField, context) {
  if (!policy) return [];
  const primaryResolver = policy[resolverField];
  const fallbackResolver = policy.resolveThemeWidgetTypes;
  const widgetTypes = typeof primaryResolver === 'function'
    ? primaryResolver(context)
    : typeof fallbackResolver === 'function'
      ? fallbackResolver(context)
      : [];
  return Array.isArray(widgetTypes)
    ? [...new Set(widgetTypes.filter(
        (widgetType) => typeof widgetType === 'string' && widgetType.trim(),
      ))]
    : [];
}

export function getDashboardTabLoadingPolicyDefinition(tabId) {
  if (typeof tabId !== 'string') return null;
  return DASHBOARD_TAB_LOADING_POLICY_CATALOG[tabId] || null;
}

export function getDashboardTabThemeWidgetTypes(tabId, context = {}) {
  return resolveWidgetTypes(
    getDashboardTabLoadingPolicyDefinition(tabId),
    'resolveThemeWidgetTypes',
    context,
  );
}

export function getDashboardTabHydrationKeys(tabId, context = {}) {
  const policy = getDashboardTabLoadingPolicyDefinition(tabId);
  if (!policy) return [];
  const profile = typeof policy.resolveReadinessProfile === 'function'
    ? policy.resolveReadinessProfile(context)
    : null;
  const hydrationKeys = profile?.hydrationKeys || policy.hydrationKeys;
  return Array.isArray(hydrationKeys)
    ? [...new Set(hydrationKeys.filter((key) => typeof key === 'string' && key.trim()))]
    : [];
}

export function getDashboardTabReadinessProfile(tabId, context = {}) {
  const policy = getDashboardTabLoadingPolicyDefinition(tabId);
  if (!policy) return null;
  const resolvedProfile = typeof policy.resolveReadinessProfile === 'function'
    ? policy.resolveReadinessProfile(context)
    : null;
  return Object.freeze({
    scope: policy.readinessScope || DASHBOARD_TAB_READINESS_SCOPES.TAB_ROOT,
    surfaceId: resolvedProfile?.surfaceId || tabId,
    hydrationKeys: getDashboardTabHydrationKeys(tabId, context),
    analysisProjections: policy.analysisProjections || NO_ANALYSIS_PROJECTIONS,
    widgetTypes: getDashboardTabThemeWidgetTypes(tabId, context),
  });
}

export function getDashboardTabLoadingFrameId(tabId) {
  return getDashboardTabLoadingPolicyDefinition(tabId)?.loadingFrameId
    || DASHBOARD_TAB_LOADING_FRAME_IDS.STACK;
}

export function getDashboardTabLoadingTestId(tabId) {
  return getDashboardTabLoadingPolicyDefinition(tabId)
    ? `${tabId}-tab-loading`
    : `${String(tabId || 'dashboard-tab')}-loading`;
}

export function getDashboardTabIntentPreloadScope(tabId) {
  return getDashboardTabLoadingPolicyDefinition(tabId)?.intentPreloadScope
    || DASHBOARD_TAB_PRELOAD_SCOPES.NONE;
}

export function getDashboardTabBootPreloadScope(tabId) {
  return getDashboardTabLoadingPolicyDefinition(tabId)?.bootPreloadScope
    || DASHBOARD_TAB_PRELOAD_SCOPES.NONE;
}

export function getDashboardTabBootPreloadPriority(tabId) {
  const priority = Number(
    getDashboardTabLoadingPolicyDefinition(tabId)?.bootPreloadPriority,
  );
  return Number.isFinite(priority)
    ? priority
    : DASHBOARD_TAB_BOOT_PRELOAD_PRIORITIES.NONE;
}

export function getDashboardTabBootDataPreloadIds(tabId) {
  const preloadIds = getDashboardTabLoadingPolicyDefinition(tabId)?.bootDataPreloadIds;
  return Array.isArray(preloadIds) ? [...preloadIds] : [];
}

export function getDashboardTabDeferredThemeWidgetTypes(tabId, context = {}) {
  const policy = getDashboardTabLoadingPolicyDefinition(tabId);
  if (typeof policy?.resolveDeferredThemeWidgetTypes !== 'function') return [];
  return resolveWidgetTypes(policy, 'resolveDeferredThemeWidgetTypes', context);
}

export function getDashboardTabAllowedAsyncBoundaryIds(tabId) {
  const boundaryIds = getDashboardTabLoadingPolicyDefinition(tabId)?.allowedAsyncBoundaryIds;
  return Array.isArray(boundaryIds) ? [...boundaryIds] : [];
}

export function isDashboardTabAsyncBoundaryAllowed(tabId, boundaryId) {
  if (typeof boundaryId !== 'string' || !boundaryId.trim()) return false;
  return getDashboardTabAllowedAsyncBoundaryIds(tabId).includes(boundaryId.trim());
}

export function resolveDashboardTabWidgetThemeId(tabId, themeId) {
  const policy = getDashboardTabLoadingPolicyDefinition(tabId);
  return typeof policy?.resolveWidgetThemeId === 'function'
    ? policy.resolveWidgetThemeId(themeId)
    : themeId;
}
