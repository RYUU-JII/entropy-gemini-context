export function describeSettingsError(error) {
  return {
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
    message: typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : String(error || 'UNKNOWN_ERROR'),
    name: typeof error?.name === 'string' && error.name.trim() ? error.name.trim() : null,
  };
}

export function logSettingsFlowFailure(stage, details = {}, error) {
  const errorDetails = describeSettingsError(error);
  const changedKeys = Array.isArray(details?.changedKeys) && details.changedKeys.length > 0
    ? details.changedKeys.join(',')
    : '(none)';
  const itemKeys = Array.isArray(details?.itemKeys) && details.itemKeys.length > 0
    ? details.itemKeys.join(',')
    : '(none)';
  console.error(
    `[SETTINGS_FLOW][SettingsService][${stage}] actionReason=${details?.actionReason || 'settings_change'} changedKeys=${changedKeys} itemKeys=${itemKeys} code=${errorDetails.code || 'n/a'} name=${errorDetails.name || 'n/a'} message=${errorDetails.message}`,
  );
}

export function buildPostCommitSettingsEffectPlan({
  shouldRefresh = false,
  shouldAutoPurge = false,
  shouldSyncBlockedBookmarks = false,
  shouldRunRuntimeAdapters = false,
  shouldSyncScripts = false,
  shouldBroadcast = false,
} = {}) {
  return {
    shouldRefresh: shouldRefresh === true,
    shouldAutoPurge: shouldAutoPurge === true,
    shouldSyncBlockedBookmarks: shouldSyncBlockedBookmarks === true,
    shouldRunRuntimeAdapters: shouldRunRuntimeAdapters === true,
    shouldSyncScripts: shouldSyncScripts === true,
    shouldBroadcast: shouldBroadcast === true,
  };
}

export function hasPostCommitSettingsWork(plan = {}) {
  return Boolean(
    plan.shouldRefresh
    || plan.shouldAutoPurge
    || plan.shouldSyncBlockedBookmarks
    || plan.shouldRunRuntimeAdapters
    || plan.shouldSyncScripts
    || plan.shouldBroadcast
  );
}
