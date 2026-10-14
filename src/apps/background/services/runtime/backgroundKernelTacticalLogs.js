export function createFlushTacticalLogsWrapper({
  tacticalLogger,
  getActiveTabInfo,
  buildBackgroundContext,
  readFilterSettings,
} = {}) {
  if (!tacticalLogger || typeof tacticalLogger.flushTacticalLogs !== 'function') {
    throw new Error('BACKGROUND_TACTICAL_LOGGER_REQUIRED');
  }
  if (typeof getActiveTabInfo !== 'function') {
    throw new Error('BACKGROUND_TACTICAL_LOG_ACTIVE_TAB_OWNER_REQUIRED');
  }
  if (typeof buildBackgroundContext !== 'function') {
    throw new Error('BACKGROUND_TACTICAL_LOG_CONTEXT_OWNER_REQUIRED');
  }
  if (typeof readFilterSettings !== 'function') {
    throw new Error('BACKGROUND_TACTICAL_LOG_FILTER_SETTINGS_OWNER_REQUIRED');
  }

  return async function flushBackgroundTacticalLogs({
    reason = 'heartbeat',
    requireSuccess = false,
  } = {}) {
    const result = await tacticalLogger.flushTacticalLogs({
      reason,
      activeTabInfo: getActiveTabInfo(),
      buildBackgroundContext,
      readFilterSettings,
    });
    if (requireSuccess && result?.ok !== true) {
      throw new Error(result?.error || 'TACTICAL_LOG_FLUSH_FAILED');
    }
    return result;
  };
}

export default createFlushTacticalLogsWrapper;
