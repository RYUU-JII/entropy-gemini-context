import { MEMORY_PURGE_RECENT_HISTORY_WINDOW_MS } from '../backgroundKernelRuntimeConfig.js';

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeTrigger(value) {
  return value === 'SESSION_END' ? 'SESSION_END' : 'SITE_EXIT';
}

function requireMemoryPurgeArtifactFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
}

export function createBackgroundMemoryPurgeArtifactRunner({
  settingsService,
  settingsCache,
  resolveProtectionRuntime,
  cleanupRecentBlockedHistory,
  syncBlockedBookmarks,
  recentHistoryWindowMs = MEMORY_PURGE_RECENT_HISTORY_WINDOW_MS,
} = {}) {
  if (!settingsService || typeof settingsService.ensureSettingsCache !== 'function') {
    throw new Error('MEMORY_PURGE_ARTIFACT_RUNNER_SETTINGS_SERVICE_REQUIRED');
  }
  if (!settingsCache || typeof settingsCache !== 'object') {
    throw new Error('MEMORY_PURGE_ARTIFACT_RUNNER_SETTINGS_CACHE_REQUIRED');
  }
  if (typeof resolveProtectionRuntime !== 'function') {
    throw new Error('MEMORY_PURGE_ARTIFACT_RUNNER_RUNTIME_RESOLVER_REQUIRED');
  }
  requireMemoryPurgeArtifactFunction(
    cleanupRecentBlockedHistory,
    'MEMORY_PURGE_ARTIFACT_RUNNER_RECENT_HISTORY_CLEANUP_REQUIRED',
  );
  requireMemoryPurgeArtifactFunction(
    syncBlockedBookmarks,
    'MEMORY_PURGE_ARTIFACT_RUNNER_BOOKMARK_SYNC_REQUIRED',
  );

  async function run({
    hostname = '',
    trigger = 'SITE_EXIT',
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname) return { skipped: 'missing_hostname' };

    await settingsService.ensureSettingsCache();
    const shouldCleanupHistory = !!settingsCache.historyCleanupForBlocked;
    const shouldSyncBookmarks = !!settingsCache.concealBlockedBookmarks;
    if (!shouldCleanupHistory && !shouldSyncBookmarks) {
      return { skipped: 'memory_purge_disabled' };
    }

    const runtime = await resolveProtectionRuntime(normalizedHostname, {
      now,
      directTriggers: [normalizeTrigger(trigger)],
      forceSnapshot: true,
    });
    if (runtime?.plan?.artifacts?.memoryPurge !== 'cleanup') {
      return { skipped: 'artifact_not_cleanup', runtime };
    }

    const [history, bookmarks] = await Promise.all([
      shouldCleanupHistory
        ? cleanupRecentBlockedHistory({ windowMs: recentHistoryWindowMs })
        : Promise.resolve([]),
      shouldSyncBookmarks
        ? syncBlockedBookmarks()
        : Promise.resolve({ destroyed: [] }),
    ]);

    return { runtime, history, bookmarks };
  }

  return {
    run,
  };
}

export default createBackgroundMemoryPurgeArtifactRunner;
