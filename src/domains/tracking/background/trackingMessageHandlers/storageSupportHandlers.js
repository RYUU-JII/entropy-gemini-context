import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import {
  createProfileMutationResponseHandoffFromLifecycle,
} from '../../../../platform/messaging/contracts/profileMutationResponseHandoff.js';
import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';

function isStorageSupportPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireStorageSupportPlainObject(value, errorCode) {
  if (!isStorageSupportPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireStorageSupportArray(value, errorCode) {
  if (!Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireStorageResetResult(value, expectedReset, errorCode) {
  const payload = requireStorageSupportPlainObject(value, errorCode);
  if (payload.reset !== expectedReset) {
    throw new Error(errorCode);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'warnings')
    && !Array.isArray(payload.warnings)
  ) {
    throw new Error(errorCode);
  }
  return payload;
}

function buildStorageResetResponse(result, profileMutationHandoff) {
  return Array.isArray(result.warnings) && result.warnings.length > 0
    ? { success: true, warnings: result.warnings, profileMutationHandoff }
    : { success: true, profileMutationHandoff };
}

function requireStorageSupportActionResult(value, requestedTask) {
  const payload = requireStorageSupportPlainObject(
    value,
    'STORAGE_SUPPORT_ACTION_RESULT_INVALID',
  );
  const normalizedRequestedTask = typeof requestedTask === 'string' ? requestedTask.trim() : '';
  if (payload.task !== normalizedRequestedTask) {
    throw new Error('STORAGE_SUPPORT_ACTION_TASK_MISMATCH');
  }
  return payload;
}

function requireNonEmptyStorageSupportString(value, errorCode) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(errorCode);
  }
  return value;
}

function resolveExpectedClosedResetId(request) {
  if (
    request === null
    || typeof request !== 'object'
    || !Object.prototype.hasOwnProperty.call(request, 'profileMutationRecovery')
  ) {
    return null;
  }

  const recovery = request.profileMutationRecovery;
  const prototype = recovery !== null && typeof recovery === 'object'
    ? Object.getPrototypeOf(recovery)
    : null;
  const isPlainObject = recovery !== null
    && typeof recovery === 'object'
    && (prototype === Object.prototype || prototype === null);
  if (
    !isPlainObject
    || Reflect.ownKeys(recovery).length !== 1
    || !Object.prototype.hasOwnProperty.call(recovery, 'expectedResetId')
  ) {
    throw new Error('PROFILE_MUTATION_RECOVERY_CONTRACT_INVALID');
  }

  const expectedResetId = recovery.expectedResetId;
  if (
    typeof expectedResetId !== 'string'
    || !expectedResetId
    || expectedResetId.trim() !== expectedResetId
  ) {
    throw new Error('PROFILE_MUTATION_RECOVERY_CONTRACT_INVALID');
  }
  return expectedResetId;
}

function requireNonNegativeStorageSupportNumber(value, errorCode) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(errorCode);
  }
  return numeric;
}

function requireNonEmptyStorageSupportDomain(value, errorCode) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(errorCode);
  }
  return value.trim().toLowerCase();
}

function requireHistorySummaryItems(value, errorCode) {
  return requireStorageSupportArray(value, errorCode).map((item) => {
    const payload = requireStorageSupportPlainObject(item, errorCode);
    return {
      ...payload,
      domain: requireNonEmptyStorageSupportDomain(payload.domain, errorCode),
      count: requireNonNegativeStorageSupportNumber(payload.count, errorCode),
    };
  });
}

function requireBookmarkSummaryItems(value, errorCode) {
  return requireStorageSupportArray(value, errorCode).map((item) => {
    const payload = requireStorageSupportPlainObject(item, errorCode);
    return {
      ...payload,
      domain: requireNonEmptyStorageSupportDomain(payload.domain, errorCode),
      count: requireNonNegativeStorageSupportNumber(payload.count, errorCode),
      bookmarkCount: requireNonNegativeStorageSupportNumber(payload.bookmarkCount, errorCode),
    };
  });
}

function requireBlockedBookmarksBackupResult(value) {
  const payload = requireStorageSupportPlainObject(
    value,
    'EXPORT_BLOCKED_BOOKMARKS_HTML_RESULT_INVALID',
  );
  return {
    html: requireNonEmptyStorageSupportString(
      payload.html,
      'EXPORT_BLOCKED_BOOKMARKS_HTML_HTML_INVALID',
    ),
    filename: requireNonEmptyStorageSupportString(
      payload.filename,
      'EXPORT_BLOCKED_BOOKMARKS_HTML_FILENAME_INVALID',
    ),
    count: requireNonNegativeStorageSupportNumber(
      payload.count,
      'EXPORT_BLOCKED_BOOKMARKS_HTML_COUNT_INVALID',
    ),
    domains: requireNonNegativeStorageSupportNumber(
      payload.domains,
      'EXPORT_BLOCKED_BOOKMARKS_HTML_DOMAINS_INVALID',
    ),
  };
}

function readConfirmMemoryPurgeResult(result) {
  const payload = requireStorageSupportPlainObject(
    result,
    'MEMORY_PURGE_CONFIRM_RESULT_INVALID',
  );
  const version = Number(payload.version);
  if (!Number.isFinite(version)) {
    throw new Error('MEMORY_PURGE_CONFIRM_VERSION_INVALID');
  }
  return {
    items: requireHistorySummaryItems(payload.items, 'MEMORY_PURGE_CONFIRM_ITEMS_INVALID'),
    changedKeys: requireStorageSupportArray(payload.changedKeys, 'MEMORY_PURGE_CONFIRM_CHANGED_KEYS_INVALID'),
    version,
    applied: requireStorageSupportPlainObject(payload.applied, 'MEMORY_PURGE_CONFIRM_APPLIED_INVALID'),
  };
}

function requireStorageSupportOwner(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireStorageSupportTabTimeTracker(tabTimeTracker) {
  if (!tabTimeTracker || typeof tabTimeTracker.resetState !== 'function') {
    throw new Error('STORAGE_SUPPORT_TAB_TIME_TRACKER_OWNER_REQUIRED');
  }
  return tabTimeTracker;
}

export function createStorageProfileMutationActionHandlers({
  authorizeDestructiveRuntimeAction,
  readSettingsSnapshot,
  readProfileMutationLifecycle,
  importStorageSnapshot,
  resetAppData,
} = {}) {
  const authorizeDestructiveAction = requireStorageSupportOwner(
    authorizeDestructiveRuntimeAction,
    'STORAGE_SUPPORT_DESTRUCTIVE_AUTH_OWNER_REQUIRED',
  );
  const readSettingsForAuth = requireStorageSupportOwner(
    readSettingsSnapshot,
    'STORAGE_SUPPORT_SETTINGS_READ_OWNER_REQUIRED',
  );
  const readMutationLifecycle = requireStorageSupportOwner(
    readProfileMutationLifecycle,
    'STORAGE_SUPPORT_PROFILE_MUTATION_LIFECYCLE_READ_OWNER_REQUIRED',
  );
  const importSnapshot = requireStorageSupportOwner(
    importStorageSnapshot,
    'STORAGE_SUPPORT_IMPORT_SNAPSHOT_OWNER_REQUIRED',
  );
  const resetApp = requireStorageSupportOwner(
    resetAppData,
    'STORAGE_SUPPORT_RESET_APP_OWNER_REQUIRED',
  );

  return Object.freeze({
    [MESSAGE_ACTIONS.RESET_APP_DATA]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const auth = await authorizeDestructiveAction({
          action: MESSAGE_ACTIONS.RESET_APP_DATA,
          request,
          sender,
          readSettingsSnapshot: readSettingsForAuth,
        });
        if (!auth.authorized) {
          return { success: false, error: auth.error };
        }
        const expectedClosedResetId = resolveExpectedClosedResetId(request);
        const result = requireStorageResetResult(
          await resetApp({
            expectedClosedResetId,
          }),
          'app',
          'RESET_APP_RESULT_INVALID',
        );
        const profileMutationHandoff = createProfileMutationResponseHandoffFromLifecycle(
          await readMutationLifecycle(),
          { expectedOperation: PROFILE_RESET_LIFECYCLE_OPERATIONS.FULL_RESET },
        );
        return buildStorageResetResponse(result, profileMutationHandoff);
      },
      (error) => ({ success: false, error: error?.message || 'RESET_APP_FAILED' }),
    ),

    [MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const auth = await authorizeDestructiveAction({
          action: MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
          request,
          sender,
          readSettingsSnapshot: readSettingsForAuth,
        });
        if (!auth.authorized) {
          return { success: false, error: auth.error };
        }

        const expectedClosedResetId = resolveExpectedClosedResetId(request);
        if (Object.hasOwn(request, 'importSecrets')) throw new Error('STORAGE_SNAPSHOT_PLAINTEXT_OPTIONS_UNSUPPORTED');
        const result = await importSnapshot({
          snapshot: request?.snapshot,
          mode: request?.mode,
          backupPassphrase: request?.backupPassphrase,
          restorePassphrase: request?.restorePassphrase,
          expectedClosedResetId,
        });
        const profileMutationHandoff = createProfileMutationResponseHandoffFromLifecycle(
          await readMutationLifecycle(),
          { expectedOperation: PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT },
        );
        return {
          success: true,
          result: requireStorageSupportPlainObject(result, 'STORAGE_SNAPSHOT_IMPORT_RESULT_INVALID'),
          profileMutationHandoff,
        };
      },
      (error) => ({ success: false, error: error?.message || 'IMPORT_STORAGE_SNAPSHOT_FAILED' }),
    ),
  });
}

export function createStorageSupportActionHandlers({
  authorizeDestructiveRuntimeAction,
  readSettingsSnapshot,
  readProfileMutationLifecycle,
  clearAllStatsDays,
  cleanupBlockedHistory,
  confirmMemoryPurge,
  exportStorageSnapshot,
  exportBlockedBookmarksHtml,
  getStorageInspectorSnapshot,
  importStorageSnapshot,
  previewBlockedBookmarks,
  previewBlockedHistory,
  resetAnalyticsData,
  resetAppData,
  loadStatsCache,
  runStatsReset,
  runStorageSupportAction,
  tabTimeTracker,
} = {}) {
  const profileMutationActionHandlers = createStorageProfileMutationActionHandlers({
    authorizeDestructiveRuntimeAction,
    readSettingsSnapshot,
    readProfileMutationLifecycle,
    importStorageSnapshot,
    resetAppData,
  });
  const authorizeDestructiveAction = requireStorageSupportOwner(
    authorizeDestructiveRuntimeAction,
    'STORAGE_SUPPORT_DESTRUCTIVE_AUTH_OWNER_REQUIRED',
  );
  const readSettingsForAuth = requireStorageSupportOwner(
    readSettingsSnapshot,
    'STORAGE_SUPPORT_SETTINGS_READ_OWNER_REQUIRED',
  );
  const clearStatsDays = requireStorageSupportOwner(clearAllStatsDays, 'STORAGE_SUPPORT_CLEAR_STATS_OWNER_REQUIRED');
  const cleanupHistory = requireStorageSupportOwner(cleanupBlockedHistory, 'STORAGE_SUPPORT_CLEANUP_HISTORY_OWNER_REQUIRED');
  const confirmPurge = requireStorageSupportOwner(confirmMemoryPurge, 'STORAGE_SUPPORT_CONFIRM_MEMORY_PURGE_OWNER_REQUIRED');
  const exportSnapshot = requireStorageSupportOwner(exportStorageSnapshot, 'STORAGE_SUPPORT_EXPORT_SNAPSHOT_OWNER_REQUIRED');
  const exportBookmarksHtml = requireStorageSupportOwner(
    exportBlockedBookmarksHtml,
    'STORAGE_SUPPORT_EXPORT_BOOKMARKS_OWNER_REQUIRED',
  );
  const readStorageInspectorSnapshot = requireStorageSupportOwner(
    getStorageInspectorSnapshot,
    'STORAGE_SUPPORT_INSPECTOR_OWNER_REQUIRED',
  );
  const previewBookmarks = requireStorageSupportOwner(
    previewBlockedBookmarks,
    'STORAGE_SUPPORT_PREVIEW_BOOKMARKS_OWNER_REQUIRED',
  );
  const previewHistory = requireStorageSupportOwner(
    previewBlockedHistory,
    'STORAGE_SUPPORT_PREVIEW_HISTORY_OWNER_REQUIRED',
  );
  const resetAnalytics = requireStorageSupportOwner(resetAnalyticsData, 'STORAGE_SUPPORT_RESET_ANALYTICS_OWNER_REQUIRED');
  const loadStats = requireStorageSupportOwner(loadStatsCache, 'STORAGE_SUPPORT_LOAD_STATS_OWNER_REQUIRED');
  const runExclusiveStatsReset = requireStorageSupportOwner(
    runStatsReset,
    'STORAGE_SUPPORT_RUN_STATS_RESET_OWNER_REQUIRED',
  );
  const runSupportAction = requireStorageSupportOwner(
    runStorageSupportAction,
    'STORAGE_SUPPORT_RUN_ACTION_OWNER_REQUIRED',
  );
  const resolvedTabTimeTracker = requireStorageSupportTabTimeTracker(tabTimeTracker);
  const handlers = {};

  handlers[MESSAGE_ACTIONS.DEBUG_RESET_STATS] = (request, sender, sendResponse) => runAsyncHandler(
    sendResponse,
    async () => {
      const auth = await authorizeDestructiveAction({
        action: MESSAGE_ACTIONS.DEBUG_RESET_STATS,
        request,
        sender,
        readSettingsSnapshot: readSettingsForAuth,
      });
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      await runExclusiveStatsReset(async () => {
        await clearStatsDays();
        await resolvedTabTimeTracker.resetState();
      });
      await loadStats(Date.now());
      return { success: true };
    },
    (error) => ({ success: false, error: error?.message || 'DEBUG_RESET_STATS_FAILED' }),
  );

  Object.assign(handlers, {

    [MESSAGE_ACTIONS.RESET_ANALYTICS_DATA]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const auth = await authorizeDestructiveAction({
          action: MESSAGE_ACTIONS.RESET_ANALYTICS_DATA,
          request,
          sender,
          readSettingsSnapshot: readSettingsForAuth,
        });
        if (!auth.authorized) {
          return { success: false, error: auth.error };
        }
        const result = requireStorageResetResult(
          await resetAnalytics(),
          'analytics',
          'RESET_ANALYTICS_RESULT_INVALID',
        );
        return buildStorageResetResponse(result);
      },
      (error) => ({ success: false, error: error?.message || 'RESET_ANALYTICS_FAILED' }),
    ),

    ...profileMutationActionHandlers,

    [MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const auth = await authorizeDestructiveAction({
          action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT,
          request,
          sender,
          readSettingsSnapshot: readSettingsForAuth,
        });
        if (!auth.authorized) {
          return { success: false, error: auth.error };
        }

        if (Object.hasOwn(request, 'includeSecrets')) throw new Error('STORAGE_SNAPSHOT_PLAINTEXT_OPTIONS_UNSUPPORTED');
        const snapshot = await exportSnapshot({ backupPassphrase: request?.backupPassphrase });
        return {
          success: true,
          snapshot: requireStorageSupportPlainObject(snapshot, 'STORAGE_SNAPSHOT_EXPORT_RESULT_INVALID'),
        };
      },
      (error) => ({ success: false, error: error?.message || 'EXPORT_STORAGE_SNAPSHOT_FAILED' }),
    ),

    [MESSAGE_ACTIONS.GET_STORAGE_INSPECTOR_SNAPSHOT]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const snapshot = await readStorageInspectorSnapshot();
        return {
          success: true,
          snapshot: requireStorageSupportPlainObject(snapshot, 'STORAGE_INSPECTOR_SNAPSHOT_INVALID'),
        };
      },
      (error) => ({ success: false, error: error?.message || 'GET_STORAGE_INSPECTOR_SNAPSHOT_FAILED' }),
    ),

    [MESSAGE_ACTIONS.RUN_STORAGE_SUPPORT_ACTION]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const auth = await authorizeDestructiveAction({
          action: MESSAGE_ACTIONS.RUN_STORAGE_SUPPORT_ACTION,
          request,
          sender,
          readSettingsSnapshot: readSettingsForAuth,
        });
        if (!auth.authorized) {
          return { success: false, error: auth.error };
        }

        const result = await runSupportAction({
          task: request?.task,
        });
        return {
          success: true,
          result: requireStorageSupportActionResult(result, request?.task),
        };
      },
      (error) => ({ success: false, error: error?.message || 'RUN_STORAGE_SUPPORT_ACTION_FAILED' }),
    ),

    [MESSAGE_ACTIONS.CLEANUP_BLOCKED_HISTORY]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const auth = await authorizeDestructiveAction({
          action: MESSAGE_ACTIONS.CLEANUP_BLOCKED_HISTORY,
          request,
          sender,
          readSettingsSnapshot: readSettingsForAuth,
        });
        if (!auth.authorized) {
          return { success: false, error: auth.error };
        }
        if (request?.enableAfterCleanup) {
          const result = readConfirmMemoryPurgeResult(await confirmPurge({ sender }));
          return {
            success: true,
            items: result.items,
            changedKeys: result.changedKeys,
            version: result.version,
            applied: result.applied,
          };
        }
        const items = await cleanupHistory();
        return {
          success: true,
          items: requireHistorySummaryItems(items, 'CLEANUP_BLOCKED_HISTORY_ITEMS_INVALID'),
        };
      },
      (error) => ({ success: false, error: error?.message || 'CLEANUP_BLOCKED_HISTORY_FAILED' }),
    ),

    [MESSAGE_ACTIONS.PREVIEW_BLOCKED_HISTORY]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const items = await previewHistory();
        return {
          success: true,
          items: requireHistorySummaryItems(items, 'PREVIEW_BLOCKED_HISTORY_ITEMS_INVALID'),
        };
      },
      (error) => ({ success: false, error: error?.message || 'PREVIEW_BLOCKED_HISTORY_FAILED' }),
    ),

    [MESSAGE_ACTIONS.PREVIEW_BLOCKED_BOOKMARKS]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const items = await previewBookmarks();
        return {
          success: true,
          items: requireBookmarkSummaryItems(items, 'PREVIEW_BLOCKED_BOOKMARKS_ITEMS_INVALID'),
        };
      },
      (error) => ({ success: false, error: error?.message || 'PREVIEW_BLOCKED_BOOKMARKS_FAILED' }),
    ),

    [MESSAGE_ACTIONS.EXPORT_BLOCKED_BOOKMARKS_HTML]: (_request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const backup = await exportBookmarksHtml();
        return {
          success: true,
          backup: requireBlockedBookmarksBackupResult(backup),
        };
      },
      (error) => ({ success: false, error: error?.message || 'EXPORT_BLOCKED_BOOKMARKS_HTML_FAILED' }),
    ),
  });

  return handlers;
}
