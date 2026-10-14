import { requireCoolingCurve } from '../../../domains/settings/config/coolingCurvePolicy.js';
import {
  DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
  normalizeGlobalCapNotifyOnExceeded,
  normalizeGlobalGoal,
  normalizeProductRulesMode,
  normalizeSiteGoalMeta,
  normalizeSiteGoals,
  normalizeSiteRuleTimeline,
  normalizeUrlList,
  resolveMemoryPurgeSettings,
} from '../../../domains/settings/config/siteRules.js';
import {
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetCatalog,
} from '../../../domains/protection/catalog/presetContract.js';
import { normalizeFilteringMode } from '../../../domains/settings/config/blockingPolicy.js';
import { normalizeIndicatorConfig } from '../../../domains/settings/config/indicator.js';
import { applyFilterSettingsMutationPatch } from '../../../domains/settings/config/filterSettingsMutation.js';
import { normalizeGateConfig } from '../../../domains/settings/config/gateConfig.js';
import { requireTabManagement } from '../../../domains/settings/config/tabManagement.js';
import { normalizeStoredNudgeConfig } from '../../../domains/settings/config/nudgeConfig.js';
import {
  DEFAULT_NOTIFICATIONS_CONFIG,
  normalizeNotificationsConfig,
} from '../../../domains/settings/config/notificationsConfig.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from '../../../domains/settings/config/debugConfig.js';
import {
  DEFAULT_ARTIFACT_CONTROL_STATE,
  normalizeArtifactControlState,
} from '../../../domains/settings/config/artifactControlState.js';
import {
  normalizeSolarLocationProfile,
  SOLAR_LOCATION_STORAGE_KEY,
} from '../../../domains/settings/config/solarLocation.js';
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
  SCHEDULE_PLAN_SCHEMA_VERSION,
  normalizeSchedulePlan,
} from '../../../domains/schedule/core/schedulePlan.js';
import { normalizeDomain } from '../../../lib/domain.js';

export const DEFAULT_SCHEDULE = Object.freeze({
  schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
  days: [0, 1, 2, 3, 4, 5, 6],
  blocks: [],
  startMin: 0,
  endMin: 1440,
});

export const PROTOCOL_SETTINGS_ERROR_CODES = Object.freeze({
  FILTER_SETTINGS_PAYLOAD_INVALID: 'PROTOCOL_FILTER_SETTINGS_PAYLOAD_INVALID',
  WRITE_FAILED: 'PROTOCOL_SETTINGS_WRITE_FAILED',
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function describeProtocolValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function requireProtocolFilterSettingsPayload(value, { source = 'protocol' } = {}) {
  if (isPlainObject(value)) return value;
  const error = new Error(PROTOCOL_SETTINGS_ERROR_CODES.FILTER_SETTINGS_PAYLOAD_INVALID);
  error.code = PROTOCOL_SETTINGS_ERROR_CODES.FILTER_SETTINGS_PAYLOAD_INVALID;
  error.key = 'filterSettings';
  error.source = typeof source === 'string' && source.trim() ? source.trim() : 'protocol';
  error.valueType = describeProtocolValueType(value);
  throw error;
}

export function requireProtocolSyncSuccess(result, fallbackCode = PROTOCOL_SETTINGS_ERROR_CODES.WRITE_FAILED) {
  if (!result?.error) return result;
  if (result.error instanceof Error) throw result.error;
  const code = typeof result.error === 'string' && result.error.trim()
    ? result.error.trim()
    : fallbackCode;
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function areValuesEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!areValuesEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i += 1) {
      const key = aKeys[i];
      if (key !== bKeys[i]) return false;
      if (!areValuesEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

export function normalizeSchedule(raw) {
  const source = raw && typeof raw === 'object' ? raw : DEFAULT_SCHEDULE;
  const normalized = normalizeSchedulePlan({
    schemaVersion: source.schemaVersion,
    days: source.days,
    windows: source.blocks,
    startMin: source.startMin,
    endMin: source.endMin,
  }, {
    requireNonEmptyDays: true,
    createMissingWindowIds: false,
  });

  return {
    schemaVersion: normalized.schemaVersion,
    days: [...normalized.days],
    blocks: normalized.windows.map((block) => ({ ...block })),
    startMin: normalized.startMin,
    endMin: normalized.endMin,
  };
}

export function requireCanonicalSchedule(raw) {
  if (!isPlainObject(raw)) throw new Error('PROTOCOL_SCHEDULE_CONTRACT_INVALID');
  const expectedKeys = [
    'schemaVersion',
    'days',
    'blocks',
    'startMin',
    'endMin',
  ];
  if (
    Object.keys(raw).length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(raw, key))
  ) throw new Error('PROTOCOL_SCHEDULE_CONTRACT_INVALID');
  const normalized = normalizeSchedule(raw);
  if (!areValuesEqual(raw, normalized)) {
    throw new Error('PROTOCOL_SCHEDULE_CONTRACT_INVALID');
  }
  return normalized;
}

export function buildScheduleSettingsPatch(schedule) {
  const normalized = normalizeSchedule(schedule);
  return {
    relaxationSchedule: {
      schemaVersion: normalized.schemaVersion,
      days: [...normalized.days],
      blocks: normalized.blocks.map((block) => ({ ...block })),
      startMin: normalized.startMin,
      endMin: normalized.endMin,
    },
  };
}

export function buildSiteRulePendingKeys({ type = 'blocked', goalMinutes = null } = {}) {
  const keys = [type === 'allowed' ? 'allowedUrls' : 'blockedUrls', 'siteRuleTimeline'];
  const normalizedGoalMinutes = Math.floor(Number(goalMinutes));
  if (type !== 'allowed' && Number.isFinite(normalizedGoalMinutes) && normalizedGoalMinutes > 0) {
    keys.push('siteGoals', 'siteGoalMeta');
  }
  return keys;
}

export function buildSiteRuleRemovalPendingKeys({ type = null } = {}) {
  const keys = [];
  if (type !== 'allowed') {
    keys.push(
      'blockedUrls',
      'siteGoals',
      'siteGoalMeta',
      'siteRuleTimeline',
      'protectionPresetAssignments',
    );
  }
  if (type !== 'blocked') {
    keys.push('allowedUrls', 'siteRuleTimeline');
  }
  return Array.from(new Set(keys));
}

export function buildSiteRuleUpdatePendingKeys(input = {}) {
  const keys = [];
  const source = input && typeof input === 'object' ? input : {};
  if (Object.prototype.hasOwnProperty.call(source, 'goalMinutes')) {
    keys.push('siteGoals', 'siteGoalMeta');
  }
  if (Object.prototype.hasOwnProperty.call(source, 'presetId')) {
    keys.push('protectionPresetAssignments');
  }
  return Array.from(new Set(keys));
}

export function buildSiteRuleMovePendingKeys({
  fromType = 'blocked',
  toType = 'allowed',
  goalMinutes = null,
} = {}) {
  const keys = ['siteRuleTimeline'];

  if (fromType !== 'allowed') {
    keys.push('blockedUrls', 'siteGoals', 'siteGoalMeta', 'siteRuleTimeline', 'protectionPresetAssignments');
  }
  if (fromType !== 'blocked') {
    keys.push('allowedUrls');
  }

  keys.push(...buildSiteRulePendingKeys({ type: toType, goalMinutes }));

  return Array.from(new Set(keys));
}

export function buildProtectionPresetPendingKeys({
  includeAssignments = false,
} = {}) {
  const keys = ['protectionPresetCatalog'];
  if (includeAssignments) {
    keys.push('protectionPresetAssignments');
  }
  return keys;
}

export function buildProtocolSyncResult({
  changedKeys = [],
  version = null,
  applied = {},
  propagation = null,
  error = null,
    committed,
    committedResult,
    reconciliation,
  committedItems,
} = {}) {
  const hasVersion = version !== null && version !== undefined && version !== '';
  return {
    changedKeys: Array.isArray(changedKeys) ? [...changedKeys] : [],
    version: hasVersion && Number.isFinite(Number(version))
      ? Math.max(0, Math.floor(Number(version)))
      : null,
    applied: {
      refreshed: !!applied?.refreshed,
      syncScripts: !!applied?.syncScripts,
      broadcast: !!applied?.broadcast,
    },
    error: error || null,
    // Preserve the background owner's completion receipt. A storage ACK alone
    // does not say that registration, receiver readiness or apply succeeded.
    ...(propagation === null ? {} : { propagation }),
    ...(typeof committed === 'boolean' ? { committed } : {}),
    ...(committedResult === undefined ? {} : { committedResult }),
    ...(reconciliation === undefined ? {} : { reconciliation }),
    ...(committedItems === undefined ? {} : { committedItems }),
  };
}

export function buildProtocolCommandResult(result = {}, extra = {}) {
  return {
    ...buildProtocolSyncResult(result),
    ...extra,
  };
}

export function buildProtocolSettingsPatch(currentState, rawPatch = {}) {
  if (Object.hasOwn(rawPatch, 'globalFrictionLevel')) throw new Error('GLOBAL_FRICTION_LEVEL_RETIRED_PROFILE_RESET_REQUIRED');
  const payload = rawPatch && typeof rawPatch === 'object' && !Array.isArray(rawPatch)
    ? rawPatch
    : {};
  const statePatch = {};
  const settingsPatch = {};
  const normalizedSettingsPatch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'blockedUrls')) {
    const resolved = normalizeUrlList(payload.blockedUrls, []);
    normalizedSettingsPatch.blockedUrls = resolved;
    if (!areValuesEqual(currentState.blockedUrls, resolved)) {
      statePatch.blockedUrls = resolved;
      settingsPatch.blockedUrls = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'allowedUrls')) {
    const resolved = normalizeUrlList(payload.allowedUrls, []);
    normalizedSettingsPatch.allowedUrls = resolved;
    if (!areValuesEqual(currentState.allowedUrls, resolved)) {
      statePatch.allowedUrls = resolved;
      settingsPatch.allowedUrls = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'trackingExcludedUrls')) {
    const resolved = normalizeUrlList(payload.trackingExcludedUrls, []);
    normalizedSettingsPatch.trackingExcludedUrls = resolved;
    if (!areValuesEqual(currentState.trackingExcludedUrls, resolved)) {
      statePatch.trackingExcludedUrls = resolved;
      settingsPatch.trackingExcludedUrls = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'filteringMode')) {
    const resolved = normalizeFilteringMode(payload.filteringMode);
    normalizedSettingsPatch.filteringMode = resolved;
    if (!areValuesEqual(currentState.filteringMode, resolved)) {
      statePatch.filteringMode = resolved;
      settingsPatch.filteringMode = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'siteGoals')) {
    const resolved = normalizeSiteGoals(payload.siteGoals);
    normalizedSettingsPatch.siteGoals = resolved;
    if (!areValuesEqual(currentState.siteGoals, resolved)) {
      statePatch.siteGoals = resolved;
      settingsPatch.siteGoals = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'siteGoalMeta')) {
    const resolved = normalizeSiteGoalMeta(payload.siteGoalMeta);
    normalizedSettingsPatch.siteGoalMeta = resolved;
    if (!areValuesEqual(currentState.siteGoalMeta, resolved)) {
      statePatch.siteGoalMeta = resolved;
      settingsPatch.siteGoalMeta = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'siteRuleTimeline')) {
    const resolved = normalizeSiteRuleTimeline(payload.siteRuleTimeline);
    normalizedSettingsPatch.siteRuleTimeline = resolved;
    if (!areValuesEqual(currentState.siteRuleTimeline, resolved)) {
      statePatch.siteRuleTimeline = resolved;
      settingsPatch.siteRuleTimeline = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'protectionPresetCatalog')) {
    const resolved = normalizeProtectionPresetCatalog(payload.protectionPresetCatalog);
    normalizedSettingsPatch.protectionPresetCatalog = resolved;
    if (!areValuesEqual(currentState.protectionPresetCatalog, resolved)) {
      statePatch.protectionPresetCatalog = resolved;
      settingsPatch.protectionPresetCatalog = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'protectionPresetAssignments')) {
    const resolved = normalizeProtectionPresetAssignments(payload.protectionPresetAssignments);
    normalizedSettingsPatch.protectionPresetAssignments = resolved;
    if (!areValuesEqual(currentState.protectionPresetAssignments, resolved)) {
      statePatch.protectionPresetAssignments = resolved;
      settingsPatch.protectionPresetAssignments = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'rulesMode')) {
    const resolved = normalizeProductRulesMode(payload.rulesMode);
    normalizedSettingsPatch.rulesMode = resolved;
    if (!areValuesEqual(currentState.rulesMode, resolved)) {
      statePatch.rulesMode = resolved;
      settingsPatch.rulesMode = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'coolingCurve')) {
    const resolved = requireCoolingCurve(payload.coolingCurve);
    normalizedSettingsPatch.coolingCurve = resolved;
    if (!areValuesEqual(currentState.coolingCurve, resolved)) {
      statePatch.coolingCurve = resolved;
      settingsPatch.coolingCurve = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'globalGoal')) {
    const resolved = normalizeGlobalGoal(payload.globalGoal);
    normalizedSettingsPatch.globalGoal = resolved;
    if (!areValuesEqual(currentState.globalGoal, resolved)) {
      statePatch.globalGoal = resolved;
      settingsPatch.globalGoal = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'globalCapNotifyOnExceeded')) {
    const resolved = normalizeGlobalCapNotifyOnExceeded(
      payload.globalCapNotifyOnExceeded,
      currentState.globalCapNotifyOnExceeded ?? DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    );
    normalizedSettingsPatch.globalCapNotifyOnExceeded = resolved;
    if (!areValuesEqual(currentState.globalCapNotifyOnExceeded, resolved)) {
      statePatch.globalCapNotifyOnExceeded = resolved;
      settingsPatch.globalCapNotifyOnExceeded = resolved;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'historyCleanupForBlocked')
    || Object.prototype.hasOwnProperty.call(payload, 'concealBlockedBookmarks')
    || Object.prototype.hasOwnProperty.call(payload, 'tabEvaporationForBlocked')
    || Object.prototype.hasOwnProperty.call(payload, 'tabEvaporationTimeoutMinutes')
  ) {
    const memoryPurgeSettings = resolveMemoryPurgeSettings(payload, currentState);

    normalizedSettingsPatch.historyCleanupForBlocked = memoryPurgeSettings.historyCleanupForBlocked;
    if (!areValuesEqual(currentState.historyCleanupForBlocked, memoryPurgeSettings.historyCleanupForBlocked)) {
      statePatch.historyCleanupForBlocked = memoryPurgeSettings.historyCleanupForBlocked;
      settingsPatch.historyCleanupForBlocked = memoryPurgeSettings.historyCleanupForBlocked;
    }

    normalizedSettingsPatch.concealBlockedBookmarks = memoryPurgeSettings.concealBlockedBookmarks;
    if (!areValuesEqual(currentState.concealBlockedBookmarks, memoryPurgeSettings.concealBlockedBookmarks)) {
      statePatch.concealBlockedBookmarks = memoryPurgeSettings.concealBlockedBookmarks;
      settingsPatch.concealBlockedBookmarks = memoryPurgeSettings.concealBlockedBookmarks;
    }

    normalizedSettingsPatch.tabEvaporationForBlocked = memoryPurgeSettings.tabEvaporationForBlocked;
    if (!areValuesEqual(currentState.tabEvaporationForBlocked, memoryPurgeSettings.tabEvaporationForBlocked)) {
      statePatch.tabEvaporationForBlocked = memoryPurgeSettings.tabEvaporationForBlocked;
      settingsPatch.tabEvaporationForBlocked = memoryPurgeSettings.tabEvaporationForBlocked;
    }

    normalizedSettingsPatch.tabEvaporationTimeoutMinutes = memoryPurgeSettings.tabEvaporationTimeoutMinutes;
    if (!areValuesEqual(currentState.tabEvaporationTimeoutMinutes, memoryPurgeSettings.tabEvaporationTimeoutMinutes)) {
      statePatch.tabEvaporationTimeoutMinutes = memoryPurgeSettings.tabEvaporationTimeoutMinutes;
      settingsPatch.tabEvaporationTimeoutMinutes = memoryPurgeSettings.tabEvaporationTimeoutMinutes;
    }
  }

  if (Object.hasOwn(payload, 'tabManagement')) {
    const resolved = requireTabManagement(payload.tabManagement);
    normalizedSettingsPatch.tabManagement = resolved;
    if (!areValuesEqual(currentState.tabManagement, resolved)) {
      statePatch.tabManagement = resolved;
      settingsPatch.tabManagement = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'gateConfig')) {
    const resolved = normalizeGateConfig(payload.gateConfig, {
      defaults: currentState.gateConfig,
    });
    normalizedSettingsPatch.gateConfig = resolved;
    if (!areValuesEqual(currentState.gateConfig, resolved)) {
      statePatch.gateConfig = resolved;
      settingsPatch.gateConfig = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'nudgeConfig')) {
    const resolved = normalizeStoredNudgeConfig(payload.nudgeConfig, {
      defaults: currentState.nudgeConfig,
    });
    normalizedSettingsPatch.nudgeConfig = resolved;
    if (!areValuesEqual(currentState.nudgeConfig, resolved)) {
      statePatch.nudgeConfig = resolved;
      settingsPatch.nudgeConfig = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notificationsConfig')) {
    const resolved = normalizeNotificationsConfig(payload.notificationsConfig, {
      defaults: currentState.notificationsConfig || DEFAULT_NOTIFICATIONS_CONFIG,
    });
    normalizedSettingsPatch.notificationsConfig = resolved;
    if (!areValuesEqual(currentState.notificationsConfig, resolved)) {
      statePatch.notificationsConfig = resolved;
      settingsPatch.notificationsConfig = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'debugConfig')) {
    const resolved = normalizeDebugConfig(payload.debugConfig, {
      defaults: currentState.debugConfig || DEFAULT_DEBUG_CONFIG,
    });
    normalizedSettingsPatch.debugConfig = resolved;
    if (!areValuesEqual(currentState.debugConfig, resolved)) {
      statePatch.debugConfig = resolved;
      settingsPatch.debugConfig = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'filterSettings')) {
    const resolved = applyFilterSettingsMutationPatch(currentState.filterSettings, requireProtocolFilterSettingsPayload(
      payload.filterSettings,
      { source: 'protocol.patch' },
    ));
    normalizedSettingsPatch.filterSettings = resolved;
    if (!areValuesEqual(currentState.filterSettings, resolved)) {
      statePatch.filterSettings = resolved;
      settingsPatch.filterSettings = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'artifactControlState')) {
    const resolved = normalizeArtifactControlState(payload.artifactControlState, {
      defaults: currentState.artifactControlState || DEFAULT_ARTIFACT_CONTROL_STATE,
    });
    normalizedSettingsPatch.artifactControlState = resolved;
    if (!areValuesEqual(currentState.artifactControlState, resolved)) {
      statePatch.artifactControlState = resolved;
      settingsPatch.artifactControlState = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'indicatorConfig')) {
    const merged = {
      ...currentState.indicatorConfig,
      ...(payload.indicatorConfig && typeof payload.indicatorConfig === 'object'
        ? payload.indicatorConfig
        : {}),
    };
    const resolved = normalizeIndicatorConfig(merged);
    normalizedSettingsPatch.indicatorConfig = resolved;
    if (!areValuesEqual(currentState.indicatorConfig, resolved)) {
      statePatch.indicatorConfig = resolved;
      settingsPatch.indicatorConfig = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'insightsMode')) {
    const resolvedInsightsMode = normalizeInsightsMode(
      payload.insightsMode,
      currentState.insightsMode || INSIGHTS_MODES.OFF,
    );
    normalizedSettingsPatch.insightsMode = resolvedInsightsMode;
    if (!areValuesEqual(currentState.insightsMode, resolvedInsightsMode)) {
      statePatch.insightsMode = resolvedInsightsMode;
      settingsPatch.insightsMode = resolvedInsightsMode;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'dataCollectionMode')
  ) {
    const resolvedDataCollectionMode = normalizeDataCollectionMode(
      payload.dataCollectionMode,
      currentState.dataCollectionMode || DEFAULT_DATA_COLLECTION_MODE,
    );
    normalizedSettingsPatch.dataCollectionMode = resolvedDataCollectionMode;
    if (!areValuesEqual(currentState.dataCollectionMode, resolvedDataCollectionMode)) {
      statePatch.dataCollectionMode = resolvedDataCollectionMode;
      settingsPatch.dataCollectionMode = resolvedDataCollectionMode;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'precisionInsightsMode')) {
    const resolved = normalizePrecisionInsightsMode(
      payload.precisionInsightsMode,
      currentState.precisionInsightsMode || DEFAULT_PRECISION_INSIGHTS_MODE,
    );
    normalizedSettingsPatch.precisionInsightsMode = resolved;
    if (!areValuesEqual(currentState.precisionInsightsMode, resolved)) {
      statePatch.precisionInsightsMode = resolved;
      settingsPatch.precisionInsightsMode = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'precisionInsightsSignals')) {
    const resolved = normalizePrecisionInsightsSignals(
      payload.precisionInsightsSignals,
      currentState.precisionInsightsSignals || DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    );
    normalizedSettingsPatch.precisionInsightsSignals = resolved;
    if (!areValuesEqual(currentState.precisionInsightsSignals, resolved)) {
      statePatch.precisionInsightsSignals = resolved;
      settingsPatch.precisionInsightsSignals = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'insightsConsent')) {
    const resolved = normalizeInsightsConsent(
      payload.insightsConsent,
      currentState.insightsConsent || INSIGHTS_CONSENT.UNSET,
    );
    normalizedSettingsPatch.insightsConsent = resolved;
    if (!areValuesEqual(currentState.insightsConsent, resolved)) {
      statePatch.insightsConsent = resolved;
      settingsPatch.insightsConsent = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'permissionMode')) {
    if (payload.permissionMode !== 'selective') {
      throw new Error('PERMISSION_MODE_CONTRACT_INVALID');
    }
    const resolved = 'selective';
    normalizedSettingsPatch.permissionMode = resolved;
    if (!areValuesEqual(currentState.permissionMode, resolved)) {
      statePatch.permissionMode = resolved;
      settingsPatch.permissionMode = resolved;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, SOLAR_LOCATION_STORAGE_KEY)) {
    const resolved = normalizeSolarLocationProfile(
      payload[SOLAR_LOCATION_STORAGE_KEY],
      currentState.solarLocationProfile,
    );
    normalizedSettingsPatch[SOLAR_LOCATION_STORAGE_KEY] = resolved;
    if (!areValuesEqual(currentState.solarLocationProfile, resolved)) {
      statePatch.solarLocationProfile = resolved;
      settingsPatch[SOLAR_LOCATION_STORAGE_KEY] = resolved;
    }
  }

  const hasSchedulePatch = (
    Object.prototype.hasOwnProperty.call(payload, 'schedule')
    || Object.prototype.hasOwnProperty.call(payload, 'relaxationSchedule')
  );

  if (hasSchedulePatch) {
    const resolvedSchedule = Object.prototype.hasOwnProperty.call(payload, 'schedule')
      ? requireCanonicalSchedule(payload.schedule)
      : requireCanonicalSchedule(payload.relaxationSchedule);

    Object.assign(normalizedSettingsPatch, buildScheduleSettingsPatch(resolvedSchedule));
    if (!areValuesEqual(currentState.schedule, resolvedSchedule)) {
      statePatch.schedule = resolvedSchedule;
      Object.assign(settingsPatch, buildScheduleSettingsPatch(resolvedSchedule));
    }
  }

  return {
    statePatch,
    settingsPatch,
    normalizedSettingsPatch,
  };
}
