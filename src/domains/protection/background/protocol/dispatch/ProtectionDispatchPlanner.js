import {
  FILTERING_MODES,
  resolveFilteringModeBySchedule,
} from '../../../../settings/config/blockingPolicy.js';
import {
  getHostname,
} from '../../../../../lib/index.js';
import { isHostnameInSiteList } from '../../../../../lib/siteIdentity.js';
import { isBootstrapSnapshotChangedKey } from '../../../../settings/config/bootstrapSnapshotInvalidation.js';
import {
  collectFeatureKeysFromChangedKeys,
  isFilterSettingsFeatureChangedKey,
} from '../../../protocol/features/featureCatalog.js';

export const DISPATCH_PLANNER_FULL_BROADCAST_KEYS = Object.freeze([
  'app_language',
  'filterSettings',
  'artifactControlState',
  'relaxationSchedule',
  'filteringMode',
  'siteGoalMeta',
  'siteRuleTimeline',
  'protectionPresetCatalog',
  'protectionPresetAssignments',
  'coolingCurve',
  'indicatorConfig',
  'globalGoal',
  'rulesMode',
  'insightsConsent',
  'dataCollectionMode',
  'precisionInsightsMode',
  'precisionInsightsSignals',
  'trackingExcludedUrls',
  'runtime.global_sentinel_outcome',
  'runtime.special_session',
  'nudgeConfig',
  'gateConfig',
  'debugConfig',
  'historyCleanupForBlocked',
  'concealBlockedBookmarks',
]);

export const DISPATCH_PLANNER_DOMAIN_SCOPED_KEYS = Object.freeze([
  'blockedUrls',
  'allowedUrls',
  'siteGoals',
]);

export const DISPATCH_PLANNER_NON_CONTENT_CHANGED_KEYS = Object.freeze([
  'filterSettings.audioDulling',
]);

const FULL_BROADCAST_KEY_SET = new Set(DISPATCH_PLANNER_FULL_BROADCAST_KEYS);
const DOMAIN_SCOPED_KEY_SET = new Set(DISPATCH_PLANNER_DOMAIN_SCOPED_KEYS);
const NON_CONTENT_CHANGED_KEY_SET = new Set(DISPATCH_PLANNER_NON_CONTENT_CHANGED_KEYS);

const KNOWN_BROADCAST_KEYS = new Set([
  'filterSettings',
  ...DISPATCH_PLANNER_FULL_BROADCAST_KEYS,
  ...DISPATCH_PLANNER_DOMAIN_SCOPED_KEYS,
]);

export const DISPATCH_PLANNER_RECONCILIATION_INTERVAL_MS = 3 * 60_000;

function isWebUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function isKnownChangedKey(key) {
  if (NON_CONTENT_CHANGED_KEY_SET.has(key)) return true;
  if (KNOWN_BROADCAST_KEYS.has(key)) return true;
  return isFilterSettingsFeatureChangedKey(key);
}

export function normalizeChangedKeys(changedKeys) {
  if (!Array.isArray(changedKeys)) return [];
  const unique = new Set();
  changedKeys.forEach((key) => {
    if (typeof key !== 'string') return;
    const normalized = key.trim();
    if (!normalized) return;
    unique.add(normalized);
  });
  return Array.from(unique);
}

function findUnknownChangedKeys(changedKeys = []) {
  return changedKeys.filter((key) => !isKnownChangedKey(key));
}

function findNonContentChangedKeys(changedKeys = []) {
  return changedKeys.filter((key) => NON_CONTENT_CHANGED_KEY_SET.has(key) || isBootstrapSnapshotChangedKey(key));
}

function isAllowlistMode(settingsCache, now) {
  const relaxationSchedule = settingsCache?.relaxationSchedule;

  return resolveFilteringModeBySchedule({
    filteringMode: settingsCache?.filteringMode || FILTERING_MODES.BLOCKLIST,
    schedule: relaxationSchedule,
    ts: now,
  }) === FILTERING_MODES.ALLOWLIST;
}

export function createProtectionDispatchPlanner({
  reconciliationIntervalMs = DISPATCH_PLANNER_RECONCILIATION_INTERVAL_MS,
} = {}) {
  let lastReconciliationFullSweepAt = 0;

  function commitSuccessfulFullSweep({ broadcastMode = '', now = null } = {}) {
    if (broadcastMode !== 'full') return false;
    const committedAt = Number(now);
    if (!Number.isFinite(committedAt) || committedAt < 0) {
      throw new Error('PROTECTION_DISPATCH_RECONCILIATION_TIMESTAMP_INVALID');
    }
    lastReconciliationFullSweepAt = Math.max(
      lastReconciliationFullSweepAt,
      Math.floor(committedAt),
    );
    return true;
  }

  function buildQueryPlan({ changedKeys = null, now = Date.now() } = {}) {
    const normalizedKeys = normalizeChangedKeys(changedKeys);
    const nonContentChangedKeys = findNonContentChangedKeys(normalizedKeys);
    const contentChangedKeys = normalizedKeys.filter((key) => !nonContentChangedKeys.includes(key));
    const hasInputChangedKeys = normalizedKeys.length > 0;
    const hasChangedKeys = contentChangedKeys.length > 0;
    const hasOnlyNonContentChangedKeys = hasInputChangedKeys && !hasChangedKeys;
    const unknownChangedKeys = findUnknownChangedKeys(contentChangedKeys);
    const plannerUncertain = unknownChangedKeys.length > 0;
    const reconciliationDue = (now - lastReconciliationFullSweepAt) >= reconciliationIntervalMs;
    const changedFeatureKeys = collectFeatureKeysFromChangedKeys(contentChangedKeys);
    const hasFeatureScopedChanges = changedFeatureKeys.length > 0;
    const isFeatureScopedOnly = hasChangedKeys
      && contentChangedKeys.every(
        (key) => key === 'filterSettings' || isFilterSettingsFeatureChangedKey(key)
      );
    const isFilterSettingsOnly = hasChangedKeys
      && contentChangedKeys.every((key) => key === 'filterSettings');
    const isFeatureTargeted = isFeatureScopedOnly && hasFeatureScopedChanges;

    return {
      now,
      normalizedKeys,
      contentChangedKeys,
      nonContentChangedKeys,
      hasInputChangedKeys,
      hasChangedKeys,
      hasOnlyNonContentChangedKeys,
      unknownChangedKeys,
      plannerUncertain,
      reconciliationDue,
      changedFeatureKeys,
      hasFeatureScopedChanges,
      isFeatureScopedOnly,
      isFilterSettingsOnly,
      isFeatureTargeted,
      queryNoTabs: hasOnlyNonContentChangedKeys,
      queryActiveOnly: !hasOnlyNonContentChangedKeys
        && (isFilterSettingsOnly || isFeatureTargeted)
        && !plannerUncertain
        && !reconciliationDue,
    };
  }

  function finalizePlan({
    tabs = [],
    settingsCache = {},
    lastProtectionContextByTab = new Map(),
    queryPlan = null,
  } = {}) {
    const plan = queryPlan || buildQueryPlan();
    const webTabs = (Array.isArray(tabs) ? tabs : []).filter((tab) => (
      Number.isInteger(tab?.id)
      && tab.id >= 0
      && isWebUrl(tab?.url)
      && tab.discarded !== true
    ));

    const isDomainScopedOnly = plan.hasChangedKeys
      && plan.normalizedKeys.every((key) => DOMAIN_SCOPED_KEY_SET.has(key));
    const hasDomainScopedChanges = plan.hasChangedKeys
      && plan.normalizedKeys.some((key) => DOMAIN_SCOPED_KEY_SET.has(key));
    const hasFullBroadcastChanges = plan.hasChangedKeys
      && plan.normalizedKeys.some((key) => key !== 'filterSettings' && FULL_BROADCAST_KEY_SET.has(key));

    const needsAllowlistSafeFull = (isAllowlistMode(settingsCache, plan.now) && hasDomainScopedChanges);

    let messageTargets = webTabs;
    let broadcastMode = 'full';
    const plannerReasons = [];

    if (plan.hasOnlyNonContentChangedKeys) {
      plannerReasons.push('non_content_changed_keys');
      broadcastMode = 'none';
      messageTargets = [];
    } else if (plan.plannerUncertain) {
      plannerReasons.push('unknown_changed_keys');
      broadcastMode = 'full';
    } else if (plan.reconciliationDue) {
      plannerReasons.push('periodic_reconciliation');
      broadcastMode = 'full';
    } else if (!plan.hasChangedKeys) {
      plannerReasons.push('missing_changed_keys');
      broadcastMode = 'full';
    } else if (hasFullBroadcastChanges) {
      plannerReasons.push('full_broadcast_key_changed');
      broadcastMode = 'full';
    } else if (needsAllowlistSafeFull) {
      plannerReasons.push('allowlist_domain_change');
      broadcastMode = 'full';
    } else if (plan.isFeatureTargeted) {
      broadcastMode = 'feature-targeted';
      messageTargets = webTabs.filter((tab) => tab?.active);
    } else if (plan.isFilterSettingsOnly) {
      // Keep runtime settings propagation cheap:
      // push immediately to active tabs, and let tab activation/update paths
      // refresh background tabs lazily without requiring page reload.
      broadcastMode = 'active-only';
      messageTargets = webTabs.filter((tab) => tab?.active);
    } else if (isDomainScopedOnly || hasDomainScopedChanges) {
      const managedDomains = [
        ...(Array.isArray(settingsCache?.blockedUrls) ? settingsCache.blockedUrls : []),
        ...(Array.isArray(settingsCache?.allowedUrls) ? settingsCache.allowedUrls : []),
      ];

      messageTargets = webTabs.filter((tab) => {
        const hostname = getHostname(tab.url);
        if (hostname && isHostnameInSiteList(hostname, managedDomains)) return true;

        const previous = lastProtectionContextByTab?.get?.(tab.id);
        if (previous?.isBlockedDomain) return true;
        if (previous?.hostname && isHostnameInSiteList(previous.hostname, managedDomains)) return true;
        return false;
      });
      broadcastMode = 'domain-scoped';
    } else {
      plannerReasons.push('fallback_full');
      broadcastMode = 'full';
    }

    return {
      ...plan,
      webTabs,
      messageTargets,
      broadcastMode,
      plannerReasons,
    };
  }

  return {
    buildQueryPlan,
    commitSuccessfulFullSweep,
    finalizePlan,
  };
}
