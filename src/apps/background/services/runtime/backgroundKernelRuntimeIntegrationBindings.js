import { createTrackingRuntimeCoordinator } from '../../../../domains/tracking/background/trackingRuntimeCoordinator.js';
import { createHistoryHandlers } from './backgroundKernelAdapters.js';
import { createLazyBackgroundHistoryIntegrations } from './backgroundKernelLazyHistoryIntegrations.js';

export function createBackgroundKernelRuntimeIntegrationBindings({
  settingsService,
  settingsCache,
  getGlobalCapState,
  broadcastSettingsUpdate,
  sweepExpiredPendingNudges,
  protectionDispatcher,
  runtimeFlagRepository,
  notificationService,
  globalCapSessionKey,
  contentScriptOrchestrator,
  hasPendingTabEvaporationSettings,
  browserPort,
} = {}) {
  const runtimeCoordinator = createTrackingRuntimeCoordinator({
    settingsService,
    settingsCache,
    getGlobalCapState,
    broadcastSettingsUpdate,
    sweepExpiredPendingNudges,
    contentScriptRuntimeSync: contentScriptOrchestrator,
    protectionDispatcher,
    runtimeFlagRepository,
    notificationService,
    globalCapSessionKey,
    publishScheduleRuntimeState: (message) => browserPort.runtimeSendMessage(message),
  });
  const historyIntegrations = createLazyBackgroundHistoryIntegrations();
  const historyHandlers = createHistoryHandlers({
    settingsService,
    settingsCache,
    scanBlockedHistory: historyIntegrations.scanBlockedHistory,
    cleanupBlockedHistory: historyIntegrations.cleanupBlockedHistory,
    cleanupRecentBlockedHistory: historyIntegrations.cleanupRecentBlockedHistory,
    previewBlockedHistory: historyIntegrations.previewBlockedHistory,
    previewBlockedBookmarks: historyIntegrations.previewBlockedBookmarks,
    exportBlockedBookmarksHtml: historyIntegrations.exportBlockedBookmarksHtml,
    syncBlockedBookmarks: historyIntegrations.syncBlockedBookmarks,
    maybeDeleteHistoryForUrl: historyIntegrations.maybeDeleteHistoryForUrl,
    sweepStaleTabs: historyIntegrations.sweepStaleTabs,
    hasPendingTabEvaporationSettings,
  });

  return {
    ...runtimeCoordinator,
    ...historyHandlers,
    resetTabEvaporation: historyIntegrations.resetTabEvaporation,
  };
}
