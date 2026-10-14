import { isFilterSettingsFeatureChangedKey } from '../../protection/protocol/features/featureCatalog.js';
import { CYCLE_SETTINGS_KEY } from '../../../platform/storage/runtime/cycleStateStorageContracts.js';
import { getBootstrapSnapshotInvalidation } from './bootstrapSnapshotInvalidation.js';

const SETTINGS_CACHE_REFRESH_KEYS = new Set([
  'tabManagement',
  'blockedUrls',
  'allowedUrls',
  'trackingExcludedUrls',
  'filterSettings',
  'artifactControlState',
  'filteringMode',
  'globalGoal',
  'globalCapNotifyOnExceeded',
  'coolingCurve',
  'rulesMode',
  'siteGoals',
  'siteGoalMeta',
  'siteRuleTimeline',
  'sentinelStayDecisions',
  'protectionPresetCatalog',
  'protectionPresetAssignments',
  'historyCleanupForBlocked',
  'concealBlockedBookmarks',
  'tabEvaporationForBlocked',
  'tabEvaporationTimeoutMinutes',
  'gateConfig',
  'relaxationSchedule',
  'indicatorConfig',
  'debugConfig',
  'nudgeConfig',
  'notificationsConfig',
  'insightsMode',
  'insightsConsent',
  'dataCollectionMode',
  'precisionInsightsMode',
  'precisionInsightsSignals',
  'permissionMode',
  'permissionRefresh',
  'solar_location_profile',
  'domainHmacSecret',
  'blockedUrlHashes',
  'allowedUrlHashes',
  'siteGoalHashes',
  CYCLE_SETTINGS_KEY,
]);

const CONTENT_SCRIPT_SYNC_KEYS = new Set([
  'blockedUrls',
  'allowedUrls',
  'permissionMode',
  'permissionRefresh',
]);

const PROTECTION_BROADCAST_KEYS = new Set([
  'blockedUrls',
  'allowedUrls',
  'filteringMode',
  'filterSettings',
  'artifactControlState',
  'relaxationSchedule',
  'siteGoals',
  'siteGoalMeta',
  'siteRuleTimeline',
  'protectionPresetCatalog',
  'protectionPresetAssignments',
  'globalGoal',
  'coolingCurve',
  'rulesMode',
  'insightsConsent',
  'dataCollectionMode',
  'precisionInsightsMode',
  'precisionInsightsSignals',
  'trackingExcludedUrls',
  'indicatorConfig',
  'debugConfig',
  'nudgeConfig',
  'gateConfig',
  'historyCleanupForBlocked',
  'concealBlockedBookmarks',
]);


const TRACKING_RUNTIME_ADAPTER_KEYS = new Set([
  'blockedUrls',
  'insightsConsent',
  'dataCollectionMode',
  'precisionInsightsMode',
  'precisionInsightsSignals',
  'protectionPresetAssignments',
  'siteGoals',
  'trackingExcludedUrls',
]);

const CLSE_RUNTIME_ADAPTER_KEYS = new Set([
  'clse_enabled',
  'clse_sensitivity_scale',
  'clse_alert_cooldown_ms',
]);

const RUNTIME_SETTINGS_ADAPTER_KEYS = new Set([
  'tabManagement',
  'gateConfig',
  'filteringMode',
  'relaxationSchedule',
  'allowedUrls',
  'permissionRefresh',
  'artifactControlState',
  'tabEvaporationForBlocked',
  'tabEvaporationTimeoutMinutes',
  ...TRACKING_RUNTIME_ADAPTER_KEYS,
  ...CLSE_RUNTIME_ADAPTER_KEYS,
]);

export const FULL_SETTINGS_RECONCILE_CHANGED_KEYS = Object.freeze(Array.from(new Set([
  ...SETTINGS_CACHE_REFRESH_KEYS,
  ...CONTENT_SCRIPT_SYNC_KEYS,
  ...PROTECTION_BROADCAST_KEYS,
  ...RUNTIME_SETTINGS_ADAPTER_KEYS,
])));

function hasAnyChangedKey(changedKeys, keySet) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) return true;
  return changedKeys.some((key) => keySet.has(key));
}

export function normalizeChangedKeys(keys) {
  if (!Array.isArray(keys)) return [];
  const unique = new Set();
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const trimmed = key.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

export function shouldRefreshSettingsCache(changedKeys) {
  return hasAnyChangedKey(changedKeys, SETTINGS_CACHE_REFRESH_KEYS);
}

export function shouldSyncManagedContentScripts(changedKeys) {
  return hasAnyChangedKey(changedKeys, CONTENT_SCRIPT_SYNC_KEYS);
}

export function shouldRunTrackingBoundaryAdapter(changedKeys) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) return false;
  return changedKeys.some((key) => TRACKING_RUNTIME_ADAPTER_KEYS.has(key));
}

export function shouldRunRuntimeSettingsAdapters(changedKeys) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) return false;
  return changedKeys.some((key) => RUNTIME_SETTINGS_ADAPTER_KEYS.has(key));
}

export function shouldBroadcastProtection(changedKeys) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) return true;
  return changedKeys.some(
    (key) => PROTECTION_BROADCAST_KEYS.has(key) || isFilterSettingsFeatureChangedKey(key)
  );
}

export function shouldSyncPrepaintVisualAfterBroadcast(changedKeys) {
  return getBootstrapSnapshotInvalidation(changedKeys).scope !== 'none';
}

export function shouldInvalidateFilterSettingsCache(changedKeys) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) return true;
  return changedKeys.some(
    (key) => key === 'filterSettings' || isFilterSettingsFeatureChangedKey(key)
  );
}

export const SETTINGS_UPDATE_KEYSETS = Object.freeze({
  SETTINGS_CACHE_REFRESH_KEYS,
  CONTENT_SCRIPT_SYNC_KEYS,
  PROTECTION_BROADCAST_KEYS,
  TRACKING_RUNTIME_ADAPTER_KEYS,
  CLSE_RUNTIME_ADAPTER_KEYS,
  RUNTIME_SETTINGS_ADAPTER_KEYS,
});
