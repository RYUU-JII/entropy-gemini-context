export function createConfirmMemoryPurgeHandler({
  cleanupBlockedHistory,
  settingsService,
} = {}) {
  return async ({ sender } = {}) => {
    const items = await cleanupBlockedHistory();
    const result = await settingsService.applySettingsChange({
      actionReason: 'confirm_memory_purge',
      items: { historyCleanupForBlocked: true },
      sender,
      persist: true,
      emitSettingsUpdated: false,
      invalidateFilterCache: false,
      refreshForBroadcast: false,
      reportBroadcastAsRefresh: false,
    }).catch(() => {
      throw new Error('SETTINGS_WRITE_FAILED');
    });

    return {
      items,
      changedKeys: result?.changedKeys || [],
      version: Number(result?.version) || 0,
      applied: result?.applied || {
        refreshed: false,
        syncScripts: false,
        broadcast: false,
      },
    };
  };
}

export default createConfirmMemoryPurgeHandler;
