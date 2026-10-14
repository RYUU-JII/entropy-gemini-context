import { VALID_TAB_EVAPORATION_TIMEOUTS } from '../../../../domains/settings/config/siteRules.js';
import { isEchoArtifactMutationSuppressed } from '../../../../domains/protection/runtime/echoArtifactMutationPolicy.js';

function requireBackgroundAdapterFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
}

function requireBackgroundAdapterOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
}

function requireBackgroundAdapterOwner(owner, errorCode) {
  if (!owner || typeof owner !== 'object') {
    throw new Error(errorCode);
  }
}

function requireHistorySettingsList(settingsCache, key, errorCode) {
  if (!Array.isArray(settingsCache?.[key])) {
    throw new Error(errorCode);
  }
}

function requireHistorySettingsBoolean(settingsCache, key, errorCode) {
  if (typeof settingsCache?.[key] !== 'boolean') {
    throw new Error(errorCode);
  }
}

export function createNudgeSessionBindings({
  reconcileNudgeDebtSessionBase,
  sweepExpiredPendingNudgesBase,
  abortNudgesForTabBase,
  markNudgeEpisodeCompletedBase,
  markNudgeResolvedBase,
  markNudgeAbortedBase,
} = {}) {
  requireBackgroundAdapterFunction(
    reconcileNudgeDebtSessionBase,
    'BACKGROUND_NUDGE_DEBT_SESSION_RECONCILIATION_REQUIRED',
  );
  requireBackgroundAdapterFunction(
    sweepExpiredPendingNudgesBase,
    'BACKGROUND_NUDGE_DEBT_SWEEP_BASE_REQUIRED',
  );
  requireBackgroundAdapterFunction(
    abortNudgesForTabBase,
    'BACKGROUND_NUDGE_DEBT_ABORT_TAB_BASE_REQUIRED',
  );
  requireBackgroundAdapterFunction(
    markNudgeResolvedBase,
    'BACKGROUND_NUDGE_DEBT_RESOLVE_BASE_REQUIRED',
  );
  requireBackgroundAdapterFunction(
    markNudgeEpisodeCompletedBase,
    'BACKGROUND_NUDGE_EPISODE_COMPLETE_BASE_REQUIRED',
  );
  requireBackgroundAdapterFunction(
    markNudgeAbortedBase,
    'BACKGROUND_NUDGE_DEBT_ABORT_KEY_BASE_REQUIRED',
  );

  return {
    reconcileNudgeDebtSession: reconcileNudgeDebtSessionBase,
    sweepExpiredPendingNudges: sweepExpiredPendingNudgesBase,
    abortNudgesForTab: abortNudgesForTabBase,
    markNudgeResolved: markNudgeResolvedBase,
    markNudgeEpisodeCompleted: markNudgeEpisodeCompletedBase,
    markNudgeAborted: markNudgeAbortedBase,
  };
}

export function createHistoryHandlers({
  settingsService,
  settingsCache,
  scanBlockedHistory,
  cleanupBlockedHistory,
  cleanupRecentBlockedHistory,
  previewBlockedHistory,
  previewBlockedBookmarks,
  exportBlockedBookmarksHtml,
  syncBlockedBookmarks,
  maybeDeleteHistoryForUrl,
  sweepStaleTabs,
  hasPendingTabEvaporationSettings,
} = {}) {
  requireBackgroundAdapterOwnerMethod(
    settingsService,
    'ensureSettingsCache',
    'BACKGROUND_HISTORY_SETTINGS_SERVICE_REQUIRED',
  );
  requireBackgroundAdapterOwner(settingsCache, 'BACKGROUND_HISTORY_SETTINGS_CACHE_REQUIRED');
  requireHistorySettingsList(
    settingsCache,
    'blockedUrls',
    'BACKGROUND_HISTORY_BLOCKED_URLS_REQUIRED',
  );
  requireHistorySettingsBoolean(
    settingsCache,
    'historyCleanupForBlocked',
    'BACKGROUND_HISTORY_CLEANUP_TOGGLE_REQUIRED',
  );
  requireHistorySettingsBoolean(
    settingsCache,
    'concealBlockedBookmarks',
    'BACKGROUND_BOOKMARK_CONCEAL_TOGGLE_REQUIRED',
  );
  requireBackgroundAdapterFunction(scanBlockedHistory, 'BACKGROUND_HISTORY_SCAN_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(cleanupBlockedHistory, 'BACKGROUND_HISTORY_CLEANUP_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(
    cleanupRecentBlockedHistory,
    'BACKGROUND_HISTORY_RECENT_CLEANUP_OWNER_REQUIRED',
  );
  requireBackgroundAdapterFunction(previewBlockedHistory, 'BACKGROUND_HISTORY_PREVIEW_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(previewBlockedBookmarks, 'BACKGROUND_BOOKMARK_PREVIEW_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(exportBlockedBookmarksHtml, 'BACKGROUND_BOOKMARK_EXPORT_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(syncBlockedBookmarks, 'BACKGROUND_BOOKMARK_SYNC_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(maybeDeleteHistoryForUrl, 'BACKGROUND_HISTORY_DELETE_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(sweepStaleTabs, 'BACKGROUND_TAB_EVAPORATION_SWEEP_OWNER_REQUIRED');
  requireBackgroundAdapterFunction(hasPendingTabEvaporationSettings, 'BACKGROUND_TAB_EVAPORATION_PROPAGATION_OWNER_REQUIRED');

  const getBlockedUrls = () => (
    settingsCache.blockedUrls
  );

  const ensureBlockedUrls = async () => {
    await settingsService.ensureSettingsCache();
    return getBlockedUrls();
  };

  function captureEchoMutationPolicy(consentKey = null) {
    if (isEchoArtifactMutationSuppressed(settingsCache)
      || (consentKey !== null && settingsCache[consentKey] !== true)) return null;
    requireBackgroundAdapterOwnerMethod(settingsService, 'getSettingsChangeVersion', 'BACKGROUND_ECHO_SETTINGS_VERSION_REQUIRED');
    const version = settingsService.getSettingsChangeVersion();
    if (!Number.isSafeInteger(version) || version < 0) throw new Error('BACKGROUND_ECHO_SETTINGS_VERSION_INVALID');
    const blockedUrls = [...getBlockedUrls()];
    return {
      blockedUrls,
      isCurrent: () => settingsService.getSettingsChangeVersion() === version
        && !isEchoArtifactMutationSuppressed(settingsCache)
        && (consentKey === null || settingsCache[consentKey] === true)
        && JSON.stringify(getBlockedUrls()) === JSON.stringify(blockedUrls),
    };
  }

  return {
    scanBlockedHistory: async ({ deleteUrls = false } = {}) => {
      await settingsService.ensureSettingsCache();
      if (!deleteUrls) return scanBlockedHistory({ deleteUrls, blockedUrls: getBlockedUrls() });
      const policy = captureEchoMutationPolicy();
      if (policy === null) return [];
      return scanBlockedHistory({ deleteUrls, ...policy });
    },
    cleanupBlockedHistory: async ({ requireEnabledConsent = false } = {}) => {
      await settingsService.ensureSettingsCache();
      if (typeof requireEnabledConsent !== 'boolean') throw new Error('BACKGROUND_ECHO_HISTORY_CONSENT_POLICY_INVALID');
      const policy = captureEchoMutationPolicy(requireEnabledConsent ? 'historyCleanupForBlocked' : null);
      if (policy === null) return [];
      return cleanupBlockedHistory(policy.blockedUrls, { isCurrent: policy.isCurrent });
    },
    previewBlockedHistory: async () => previewBlockedHistory(await ensureBlockedUrls()),
    previewBlockedBookmarks: async () => {
      await settingsService.ensureSettingsCache();
      return previewBlockedBookmarks(getBlockedUrls());
    },
    exportBlockedBookmarksHtml: async () => {
      await settingsService.ensureSettingsCache();
      return exportBlockedBookmarksHtml(getBlockedUrls());
    },
    cleanupRecentBlockedHistory: async ({ windowMs } = {}) => {
      await settingsService.ensureSettingsCache();
      const policy = captureEchoMutationPolicy('historyCleanupForBlocked');
      if (policy === null) return [];
      return cleanupRecentBlockedHistory({
        ...policy,
        windowMs,
      });
    },
    syncBlockedBookmarks: async () => {
      await settingsService.ensureSettingsCache();
      const policy = captureEchoMutationPolicy('concealBlockedBookmarks');
      if (policy === null) {
        return syncBlockedBookmarks({
          blockedUrls: getBlockedUrls(),
          enabled: false,
          suppressed: isEchoArtifactMutationSuppressed(settingsCache),
        });
      }
      return syncBlockedBookmarks({
        ...policy,
        enabled: true,
      });
    },
    maybeDeleteHistoryForUrl: async (url) => {
      if (!url) return;
      await settingsService.ensureSettingsCache();
      const policy = captureEchoMutationPolicy('historyCleanupForBlocked');
      if (policy === null) return;
      await maybeDeleteHistoryForUrl(url, settingsCache, { isCurrent: policy.isCurrent });
    },
    sweepStaleTabs: async () => {
      await settingsService.ensureSettingsCache();
      requireHistorySettingsBoolean(settingsCache, 'tabEvaporationForBlocked', 'BACKGROUND_TAB_EVAPORATION_TOGGLE_REQUIRED');
      requireHistorySettingsList(settingsCache, 'blockedUrls', 'BACKGROUND_HISTORY_BLOCKED_URLS_REQUIRED');
      if (!settingsCache.tabEvaporationForBlocked || getBlockedUrls().length === 0
        || isEchoArtifactMutationSuppressed(settingsCache)) {
        return { status: 'disabled', evaporated: [], failures: [] };
      }
      if (hasPendingTabEvaporationSettings()) {
        return { status: 'settings_pending', evaporated: [], failures: [] };
      }
      const timeoutMinutes = settingsCache.tabEvaporationTimeoutMinutes;
      if (!VALID_TAB_EVAPORATION_TIMEOUTS.includes(timeoutMinutes)) throw new Error('BACKGROUND_TAB_EVAPORATION_TIMEOUT_INVALID');
      requireBackgroundAdapterOwnerMethod(settingsService, 'getSettingsChangeVersion', 'BACKGROUND_TAB_EVAPORATION_SETTINGS_VERSION_REQUIRED');
      const version = settingsService.getSettingsChangeVersion();
      if (!Number.isSafeInteger(version) || version < 0) throw new Error('BACKGROUND_TAB_EVAPORATION_SETTINGS_VERSION_INVALID');
      const blockedUrls = [...getBlockedUrls()];
      return sweepStaleTabs({
        timeoutMs: timeoutMinutes * 60 * 1000,
        blockedUrls,
        isCurrent: () => settingsService.getSettingsChangeVersion() === version
          && !hasPendingTabEvaporationSettings()
          && !isEchoArtifactMutationSuppressed(settingsCache)
          && settingsCache.tabEvaporationForBlocked === true
          && settingsCache.tabEvaporationTimeoutMinutes === timeoutMinutes
          && JSON.stringify(getBlockedUrls()) === JSON.stringify(blockedUrls),
      });
    },
  };
}
