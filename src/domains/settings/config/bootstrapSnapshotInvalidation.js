import { parseFilterSettingsFeatureChangedKey } from '../../protection/protocol/features/featureCatalog.js';
import { EARLY_APPLY_FILTER_KEYS } from './frictionPipeline.js';
import { isHostnameInSiteList } from '../../../lib/siteIdentity.js';

// Change metadata, never stored settings or a second policy source.
export const BOOTSTRAP_HOST_SETTING_KEYS = new Set(['siteGoals', 'siteGoalMeta', 'siteRuleTimeline']);
const PREFIX = 'bootstrapHostChange:';
const FULL_FILTER_CHANGE_KEY = 'bootstrapFullFilterChange';
const NON_BOOTSTRAP_KEYS = new Set([
  'tabManagement',
  'indicatorConfig', 'debugConfig', 'insightsConsent', 'dataCollectionMode',
  'precisionInsightsMode', 'precisionInsightsSignals', 'trackingExcludedUrls',
  'historyCleanupForBlocked', 'concealBlockedBookmarks', 'notificationsConfig',
  'sentinelStayDecisions', 'filterSettings.audioDulling',
]);
const GLOBAL_KEYS = new Set([
  'blockedUrls', 'allowedUrls', 'filteringMode', 'artifactControlState',
  'relaxationSchedule', 'protectionPresetCatalog', 'protectionPresetAssignments',
  'globalGoal', 'coolingCurve', 'rulesMode', 'permissionMode', 'permissionRefresh',
  'gateConfig', 'nudgeConfig',
]);

export function createBootstrapHostChangedKey(settingKey, domains) {
  if (!BOOTSTRAP_HOST_SETTING_KEYS.has(settingKey) || (domains !== null && !Array.isArray(domains))) {
    throw new Error('BOOTSTRAP_HOST_CHANGE_INVALID');
  }
  return `${PREFIX}${settingKey}:${encodeURIComponent(JSON.stringify(domains))}`;
}

export function isBootstrapHostChangedKey(key) {
  return typeof key === 'string' && key.startsWith(PREFIX);
}

export function parseBootstrapHostChangedKey(key) {
  if (!isBootstrapHostChangedKey(key)) return null;
  const separator = key.indexOf(':', PREFIX.length);
  const settingKey = key.slice(PREFIX.length, separator);
  let domains;
  try {
    domains = JSON.parse(decodeURIComponent(key.slice(separator + 1)));
  } catch (cause) {
    throw new Error('BOOTSTRAP_HOST_CHANGE_INVALID', { cause });
  }
  if (!BOOTSTRAP_HOST_SETTING_KEYS.has(settingKey)
    || (domains !== null && (!Array.isArray(domains)
      || domains.some((domain) => typeof domain !== 'string' || !domain.trim())))) {
    throw new Error('BOOTSTRAP_HOST_CHANGE_INVALID');
  }
  return { settingKey, domains };
}

export function isBootstrapSnapshotChangedKey(key) {
  return key === FULL_FILTER_CHANGE_KEY || isBootstrapHostChangedKey(key);
}

export function mergeBootstrapSnapshotChangedKeys(first, second) {
  const keys = new Set([...first, ...second]);
  for (const batch of [first, second]) {
    if (batch.includes('filterSettings') && !batch.some(parseFilterSettingsFeatureChangedKey)
      && [...keys].some(parseFilterSettingsFeatureChangedKey)) keys.add(FULL_FILTER_CHANGE_KEY);
    for (const settingKey of BOOTSTRAP_HOST_SETTING_KEYS) {
      const hasScopedMetadata = [...keys].some((key) => key.startsWith(`${PREFIX}${settingKey}:`));
      if (hasScopedMetadata && batch.includes(settingKey) && !batch.some((key) => key.startsWith(`${PREFIX}${settingKey}:`))) {
        keys.add(createBootstrapHostChangedKey(settingKey, null));
      }
    }
  }
  return [...keys];
}

export function getBootstrapSnapshotInvalidation(changedKeys) {
  if (!Array.isArray(changedKeys) || changedKeys.length === 0) return { scope: 'all', domains: [] };
  if (changedKeys.includes(FULL_FILTER_CHANGE_KEY)) return { scope: 'all', domains: [] };
  const hostChanges = new Map();
  for (const key of changedKeys.filter(isBootstrapHostChangedKey)) {
    const { settingKey, domains } = parseBootstrapHostChangedKey(key);
    if (!changedKeys.includes(settingKey)) throw new Error('BOOTSTRAP_HOST_CHANGE_WITHOUT_SETTING_KEY');
    if (domains === null) return { scope: 'all', domains: [] };
    hostChanges.set(settingKey, [...(hostChanges.get(settingKey) || []), ...domains]);
  }
  const featureKeys = changedKeys.map(parseFilterSettingsFeatureChangedKey).filter(Boolean);
  const domains = new Set();
  for (const key of changedKeys) {
    if (GLOBAL_KEYS.has(key)) return { scope: 'all', domains: [] };
    if (key === 'filterSettings' && featureKeys.length === 0) return { scope: 'all', domains: [] };
    if (EARLY_APPLY_FILTER_KEYS.has(parseFilterSettingsFeatureChangedKey(key))) {
      return { scope: 'all', domains: [] };
    }
    if (BOOTSTRAP_HOST_SETTING_KEYS.has(key)) {
      // An explicit whole-key reconcile carries no per-host commit metadata.
      if (!hostChanges.has(key)) return { scope: 'all', domains: [] };
      hostChanges.get(key).forEach((domain) => domains.add(domain));
      continue;
    }
    if (key === 'filterSettings' || parseFilterSettingsFeatureChangedKey(key)
      || isBootstrapSnapshotChangedKey(key) || NON_BOOTSTRAP_KEYS.has(key)) continue;
    // Undeclared runtime/global changes cannot silently retain a stale early plan.
    return { scope: 'all', domains: [] };
  }
  return { scope: domains.size > 0 ? 'hosts' : 'none', domains: [...domains] };
}

export function isBootstrapHostnameAffected(hostname, invalidation) {
  return invalidation.scope === 'all'
    || isHostnameInSiteList(hostname, invalidation.domains);
}
