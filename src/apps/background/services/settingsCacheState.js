import { DEFAULT_COOLING_CURVE, requireCoolingCurve } from '../../../domains/settings/config/coolingCurvePolicy.js';
import { ZEN_RENDER_PRESET_STORAGE_KEY, DEFAULT_ZEN_RENDER_PRESET, requireZenRenderPreset } from '../../../domains/settings/config/zenRenderPreset.js';
import { DEFAULT_TAB_MANAGEMENT, normalizeTabManagement } from '../../../domains/settings/config/tabManagement.js';
import {
  DEFAULT_INDICATOR_CONFIG,
  normalizeIndicatorConfig,
} from '../../../domains/settings/config/indicator.js';
import {
  DEFAULT_GATE_CONFIG,
  normalizeGateConfig,
} from '../../../domains/settings/config/gateConfig.js';
import {
  DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
  DEFAULT_RULES_MODE,
  MEMORY_PURGE_SETTINGS_DEFAULTS,
  requireGlobalGoal,
  normalizeGlobalCapNotifyOnExceeded,
  normalizeProductRulesMode,
  resolveMemoryPurgeSettings,
  normalizeSiteGoalMeta,
  normalizeSiteRuleTimeline,
  normalizeSiteGoals,
  normalizeUrlList,
} from '../../../domains/settings/config/siteRules.js';
import { normalizeSentinelStayDecisions } from '../../../domains/settings/config/sentinelStayDecisions.js';
import {
  DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
  DEFAULT_PROTECTION_PRESET_CATALOG,
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetCatalog,
} from '../../../domains/protection/catalog/presetContract.js';
import {
  DEFAULT_RELAXATION_SCHEDULE,
  FILTERING_MODES,
  normalizeFilteringMode,
  normalizeRelaxationSchedule,
} from '../../../domains/settings/config/blockingPolicy.js';
import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
} from '../../../domains/settings/config/index.js';
import {
  DEFAULT_SOLAR_LOCATION_PROFILE,
  normalizeSolarLocationProfile,
  SOLAR_LOCATION_STORAGE_KEY,
} from '../../../domains/settings/config/solarLocation.js';
import {
  DEFAULT_ARTIFACT_CONTROL_STATE,
  requireArtifactControlState,
} from '../../../domains/settings/config/artifactControlState.js';
import {
  INSIGHTS_CONSENT,
  INSIGHTS_MODES,
  normalizeInsightsConsent,
  normalizeInsightsMode,
} from '../../../domains/settings/config/insightsMode.js';
import {
  DEFAULT_DATA_COLLECTION_MODE,
  DEFAULT_PRECISION_INSIGHTS_SIGNALS,
  DEFAULT_PRECISION_INSIGHTS_MODE,
  normalizeDataCollectionMode,
  normalizePrecisionInsightsSignals,
  normalizePrecisionInsightsMode,
} from '../../../domains/settings/config/dataCollectionPolicy.js';
import {
  DEFAULT_NUDGE_PROTOCOL,
  DEFAULT_NUDGE_RUNTIME_ASSET,
  DEFAULT_NUDGE_SETTINGS,
  DEFAULT_NUDGE_RUNTIME_TUNING,
  normalizeStoredNudgeConfig,
  hasEnabledGoalEnd,
  normalizeNudgeRuntimeConfig,
} from '../../../domains/settings/config/nudgeConfig.js';
import {
  DEFAULT_NOTIFICATIONS_CONFIG,
  normalizeNotificationsConfig,
} from '../../../domains/settings/config/notificationsConfig.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from '../../../domains/settings/config/debugConfig.js';
import {
  DEFAULT_SIDEBAR_DISPLAY_MODE,
  normalizeSidebarDisplayMode,
} from '../../../domains/settings/config/sidebarDisplayMode.js';
import {
  CYCLE_SETTINGS_KEY,
  readCycleSettingsRecord,
} from '../../../platform/storage/runtime/cycleStateStorageContracts.js';

const LOCAL_SETTINGS_DEFAULTS = {
  tabManagement: DEFAULT_TAB_MANAGEMENT,
  filterSettings: CONFIG_DEFAULT_FILTER_SETTINGS,
  relaxationSchedule: DEFAULT_RELAXATION_SCHEDULE,
  filteringMode: FILTERING_MODES.BLOCKLIST,
  indicatorConfig: DEFAULT_INDICATOR_CONFIG,
  debugConfig: DEFAULT_DEBUG_CONFIG,
  nudgeConfig: DEFAULT_NUDGE_SETTINGS,
  notificationsConfig: DEFAULT_NOTIFICATIONS_CONFIG,
  artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE,
  rulesMode: DEFAULT_RULES_MODE,
  globalCapNotifyOnExceeded: DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
  coolingCurve: DEFAULT_COOLING_CURVE,
  protectionPresetCatalog: DEFAULT_PROTECTION_PRESET_CATALOG,
  protectionPresetAssignments: DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
  siteGoalMeta: {},
  siteRuleTimeline: {},
  trackingExcludedUrls: [],
  insightsConsent: INSIGHTS_CONSENT.UNSET,
  insightsMode: INSIGHTS_MODES.OFF,
  dataCollectionMode: DEFAULT_DATA_COLLECTION_MODE,
  precisionInsightsMode: DEFAULT_PRECISION_INSIGHTS_MODE,
  precisionInsightsSignals: DEFAULT_PRECISION_INSIGHTS_SIGNALS,
  permissionMode: 'selective',
  historyCleanupForBlocked: undefined,
  concealBlockedBookmarks: undefined,
  tabEvaporationForBlocked: undefined,
  tabEvaporationTimeoutMinutes: undefined,
  gateConfig: DEFAULT_GATE_CONFIG,
  [SOLAR_LOCATION_STORAGE_KEY]: DEFAULT_SOLAR_LOCATION_PROFILE,
  domainHmacSecret: undefined,
  blockedUrlHashes: undefined,
  allowedUrlHashes: undefined,
  siteGoalHashes: undefined,
  sidebarDisplayMode: DEFAULT_SIDEBAR_DISPLAY_MODE,
  [ZEN_RENDER_PRESET_STORAGE_KEY]: DEFAULT_ZEN_RENDER_PRESET,
  [CYCLE_SETTINGS_KEY]: undefined,
};

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function describeSettingsValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function requirePlainSettingsCacheValue(key, value) {
  if (isPlainObject(value)) return value;
  const error = new Error('SETTINGS_MALFORMED_VALUE');
  error.code = 'SETTINGS_MALFORMED_VALUE';
  error.key = key;
  error.valueType = describeSettingsValueType(value);
  throw error;
}

function getDefaultNudgeConfig() {
  return {
    ...DEFAULT_NUDGE_RUNTIME_TUNING,
    ...DEFAULT_NUDGE_SETTINGS,
    asset: DEFAULT_NUDGE_RUNTIME_ASSET,
    protocol: DEFAULT_NUDGE_PROTOCOL,
  };
}

function normalizeHashList(value) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry) => typeof entry === 'string' && entry.trim());
}

function normalizeHashMap(value) {
  if (!value || typeof value !== 'object') return undefined;
  return { ...value };
}

export function createDefaultSettingsCache() {
  return {
    blockedUrls: [],
    allowedUrls: [],
    trackingExcludedUrls: [],
    filterSettings: normalizeFilterSettings(CONFIG_DEFAULT_FILTER_SETTINGS),
    filteringMode: FILTERING_MODES.BLOCKLIST,
    globalGoal: 0,
    globalCapNotifyOnExceeded: DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    siteGoals: {},
    siteGoalMeta: {},
    siteRuleTimeline: {},
    sentinelStayDecisions: {},
    ...MEMORY_PURGE_SETTINGS_DEFAULTS,
    relaxationSchedule: { ...DEFAULT_RELAXATION_SCHEDULE },
    indicatorConfig: { ...DEFAULT_INDICATOR_CONFIG },
    debugConfig: DEFAULT_DEBUG_CONFIG,
    nudgeConfig: DEFAULT_NUDGE_SETTINGS,
    notificationsConfig: DEFAULT_NOTIFICATIONS_CONFIG,
    rulesMode: DEFAULT_RULES_MODE,
    coolingCurve: DEFAULT_COOLING_CURVE,
    protectionPresetCatalog: DEFAULT_PROTECTION_PRESET_CATALOG,
    protectionPresetAssignments: DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
    gateConfig: normalizeGateConfig(DEFAULT_GATE_CONFIG),
    tabManagement: normalizeTabManagement(DEFAULT_TAB_MANAGEMENT),
    artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE,
    insightsConsent: INSIGHTS_CONSENT.UNSET,
    insightsMode: INSIGHTS_MODES.OFF,
    dataCollectionMode: DEFAULT_DATA_COLLECTION_MODE,
    precisionInsightsMode: DEFAULT_PRECISION_INSIGHTS_MODE,
    precisionInsightsSignals: DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    permissionMode: 'selective',
    solarLocationProfile: DEFAULT_SOLAR_LOCATION_PROFILE,
    domainHmacSecret: undefined,
    blockedUrlHashes: undefined,
    allowedUrlHashes: undefined,
    siteGoalHashes: undefined,
    sidebarDisplayMode: DEFAULT_SIDEBAR_DISPLAY_MODE,
    [ZEN_RENDER_PRESET_STORAGE_KEY]: DEFAULT_ZEN_RENDER_PRESET,
    [CYCLE_SETTINGS_KEY]: undefined,
  };
}

export function buildSettingsCacheDefaults() {
  return {
    ...LOCAL_SETTINGS_DEFAULTS,
    blockedUrls: [],
    allowedUrls: [],
    trackingExcludedUrls: [],
    globalGoal: 0,
    globalCapNotifyOnExceeded: DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    coolingCurve: DEFAULT_COOLING_CURVE,
    rulesMode: DEFAULT_RULES_MODE,
    siteGoals: {},
    siteGoalMeta: {},
    siteRuleTimeline: {},
    sentinelStayDecisions: {},
    insightsConsent: INSIGHTS_CONSENT.UNSET,
    insightsMode: INSIGHTS_MODES.OFF,
    dataCollectionMode: DEFAULT_DATA_COLLECTION_MODE,
    precisionInsightsMode: DEFAULT_PRECISION_INSIGHTS_MODE,
    precisionInsightsSignals: DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    protectionPresetCatalog: DEFAULT_PROTECTION_PRESET_CATALOG,
    protectionPresetAssignments: DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
    historyCleanupForBlocked: undefined,
    concealBlockedBookmarks: undefined,
    tabEvaporationForBlocked: undefined,
    tabEvaporationTimeoutMinutes: undefined,
    gateConfig: DEFAULT_GATE_CONFIG,
    artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE,
    notificationsConfig: DEFAULT_NOTIFICATIONS_CONFIG,
    debugConfig: DEFAULT_DEBUG_CONFIG,
    sidebarDisplayMode: DEFAULT_SIDEBAR_DISPLAY_MODE,
    [ZEN_RENDER_PRESET_STORAGE_KEY]: DEFAULT_ZEN_RENDER_PRESET,
  };
}

export function applySettingsCacheItems(settingsCache, items = {}) {
  if (Object.hasOwn(items, 'globalFrictionLevel')) throw new Error('GLOBAL_FRICTION_LEVEL_RETIRED_PROFILE_RESET_REQUIRED');
  if (!settingsCache || typeof settingsCache !== 'object') {
    throw new Error('SETTINGS_CACHE_STATE_REQUIRED');
  }

  if ('blockedUrls' in items) {
    settingsCache.blockedUrls = normalizeUrlList(items.blockedUrls, []);
  }
  if ('allowedUrls' in items) {
    settingsCache.allowedUrls = normalizeUrlList(items.allowedUrls, []);
  }
  if ('trackingExcludedUrls' in items) {
    settingsCache.trackingExcludedUrls = normalizeUrlList(items.trackingExcludedUrls, []);
  }
  if ('filterSettings' in items) {
    settingsCache.filterSettings = normalizeFilterSettings(
      requirePlainSettingsCacheValue('filterSettings', items.filterSettings)
    );
  }
  if ('artifactControlState' in items) {
    settingsCache.artifactControlState = requireArtifactControlState(items.artifactControlState);
  }
  if ('filteringMode' in items) {
    const filteringMode = typeof items.filteringMode === 'string' ? items.filteringMode.trim() : '';
    settingsCache.filteringMode = normalizeFilteringMode(filteringMode || FILTERING_MODES.BLOCKLIST);
  }

  if ('globalGoal' in items) {
    settingsCache.globalGoal = requireGlobalGoal(items.globalGoal);
  }
  if ('globalCapNotifyOnExceeded' in items) {
    settingsCache.globalCapNotifyOnExceeded = normalizeGlobalCapNotifyOnExceeded(
      items.globalCapNotifyOnExceeded,
      settingsCache.globalCapNotifyOnExceeded ?? DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    );
  }
  if ('coolingCurve' in items) {
    settingsCache.coolingCurve = requireCoolingCurve(items.coolingCurve);
  }
  if ('rulesMode' in items) {
    settingsCache.rulesMode = normalizeProductRulesMode(items.rulesMode);
  }
  if ('siteGoals' in items) {
    settingsCache.siteGoals = normalizeSiteGoals(items.siteGoals);
  }
  if ('siteGoalMeta' in items) {
    settingsCache.siteGoalMeta = normalizeSiteGoalMeta(items.siteGoalMeta);
  }
  if ('siteRuleTimeline' in items) {
    settingsCache.siteRuleTimeline = normalizeSiteRuleTimeline(items.siteRuleTimeline);
  }
  if ('sentinelStayDecisions' in items) {
    settingsCache.sentinelStayDecisions = normalizeSentinelStayDecisions(items.sentinelStayDecisions);
  }
  if ('protectionPresetCatalog' in items) {
    settingsCache.protectionPresetCatalog = normalizeProtectionPresetCatalog(items.protectionPresetCatalog);
  }
  if ('protectionPresetAssignments' in items) {
    settingsCache.protectionPresetAssignments = normalizeProtectionPresetAssignments(items.protectionPresetAssignments);
  }
  if (
    'historyCleanupForBlocked' in items
    || 'concealBlockedBookmarks' in items
    || 'tabEvaporationForBlocked' in items
    || 'tabEvaporationTimeoutMinutes' in items
  ) {
    const memoryPurgeSettings = resolveMemoryPurgeSettings(items, settingsCache);
    settingsCache.historyCleanupForBlocked = memoryPurgeSettings.historyCleanupForBlocked;
    settingsCache.concealBlockedBookmarks = memoryPurgeSettings.concealBlockedBookmarks;
    settingsCache.tabEvaporationForBlocked = memoryPurgeSettings.tabEvaporationForBlocked;
    settingsCache.tabEvaporationTimeoutMinutes = memoryPurgeSettings.tabEvaporationTimeoutMinutes;
  }
  if ('gateConfig' in items) {
    settingsCache.gateConfig = normalizeGateConfig(items.gateConfig, {
      defaults: settingsCache.gateConfig || DEFAULT_GATE_CONFIG,
    });
  }
  if (Object.hasOwn(items, 'tabManagement')) {
    settingsCache.tabManagement = normalizeTabManagement(items.tabManagement);
  }
  const hasRelaxationSchedule = Object.prototype.hasOwnProperty.call(items, 'relaxationSchedule');

  if (hasRelaxationSchedule) {
    const normalizedRelaxationSchedule = normalizeRelaxationSchedule(
      items.relaxationSchedule,
      settingsCache.relaxationSchedule || DEFAULT_RELAXATION_SCHEDULE
    );

    settingsCache.relaxationSchedule = normalizedRelaxationSchedule;
  }
  if ('indicatorConfig' in items) {
    settingsCache.indicatorConfig = normalizeIndicatorConfig(items.indicatorConfig);
  }
  if ('debugConfig' in items) {
    settingsCache.debugConfig = normalizeDebugConfig(items.debugConfig, {
      defaults: settingsCache.debugConfig || DEFAULT_DEBUG_CONFIG,
    });
  }
  if ('nudgeConfig' in items) {
    settingsCache.nudgeConfig = normalizeStoredNudgeConfig(items.nudgeConfig);
  }
  if ('notificationsConfig' in items) {
    settingsCache.notificationsConfig = normalizeNotificationsConfig(items.notificationsConfig, {
      defaults: settingsCache.notificationsConfig || DEFAULT_NOTIFICATIONS_CONFIG,
    });
  }
  if ('insightsMode' in items) {
    settingsCache.insightsMode = normalizeInsightsMode(
      items.insightsMode,
      settingsCache.insightsMode || INSIGHTS_MODES.OFF,
    );
  }
  if ('dataCollectionMode' in items) {
    const dataCollectionMode = normalizeDataCollectionMode(
      items.dataCollectionMode,
      settingsCache.dataCollectionMode || DEFAULT_DATA_COLLECTION_MODE,
    );
    settingsCache.dataCollectionMode = dataCollectionMode;
  }
  if ('precisionInsightsMode' in items) {
    settingsCache.precisionInsightsMode = normalizePrecisionInsightsMode(
      items.precisionInsightsMode,
      settingsCache.precisionInsightsMode || DEFAULT_PRECISION_INSIGHTS_MODE,
    );
  }
  if ('precisionInsightsSignals' in items) {
    settingsCache.precisionInsightsSignals = normalizePrecisionInsightsSignals(
      items.precisionInsightsSignals,
      settingsCache.precisionInsightsSignals || DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    );
  }
  if ('insightsConsent' in items) {
    settingsCache.insightsConsent = normalizeInsightsConsent(
      items.insightsConsent,
      settingsCache.insightsConsent || INSIGHTS_CONSENT.UNSET,
    );
  }
  if ('permissionMode' in items) {
    if (items.permissionMode !== 'selective') {
      throw new Error('PERMISSION_MODE_CONTRACT_INVALID');
    }
    settingsCache.permissionMode = 'selective';
  }
  if (ZEN_RENDER_PRESET_STORAGE_KEY in items) {
    settingsCache[ZEN_RENDER_PRESET_STORAGE_KEY] = requireZenRenderPreset(items[ZEN_RENDER_PRESET_STORAGE_KEY]);
  }
  if ('sidebarDisplayMode' in items) {
    settingsCache.sidebarDisplayMode = normalizeSidebarDisplayMode(
      items.sidebarDisplayMode,
      settingsCache.sidebarDisplayMode || DEFAULT_SIDEBAR_DISPLAY_MODE,
    );
  }
  if (CYCLE_SETTINGS_KEY in items) {
    const cycleSettings = items[CYCLE_SETTINGS_KEY];
    settingsCache[CYCLE_SETTINGS_KEY] = typeof cycleSettings === 'undefined'
      ? undefined
      : readCycleSettingsRecord(cycleSettings);
  }
  if (SOLAR_LOCATION_STORAGE_KEY in items) {
    settingsCache.solarLocationProfile = normalizeSolarLocationProfile(
      items[SOLAR_LOCATION_STORAGE_KEY],
      settingsCache.solarLocationProfile || DEFAULT_SOLAR_LOCATION_PROFILE
    );
  }
  if ('domainHmacSecret' in items) {
    settingsCache.domainHmacSecret =
      typeof items.domainHmacSecret === 'string' && items.domainHmacSecret.trim()
        ? items.domainHmacSecret.trim()
        : undefined;
  }
  if ('blockedUrlHashes' in items) {
    settingsCache.blockedUrlHashes = normalizeHashList(items.blockedUrlHashes);
  }
  if ('allowedUrlHashes' in items) {
    settingsCache.allowedUrlHashes = normalizeHashList(items.allowedUrlHashes);
  }
  if ('siteGoalHashes' in items) {
    settingsCache.siteGoalHashes = normalizeHashMap(items.siteGoalHashes);
  }
}

export function mergeNudgeRuntimeConfig(partial) {
  const defaults = getDefaultNudgeConfig();
  const src = normalizeStoredNudgeConfig(partial, { defaults });

  return normalizeNudgeRuntimeConfig(
    {
      ...defaults,
      ...src,
      enabled: hasEnabledGoalEnd(src),
    },
    { defaults },
  );
}
