import { createTrackingMessageHandler } from '../../../../domains/tracking/background/TrackingMessageHandler.js';
import { createBackgroundKernelActionDebugBindings } from './backgroundKernelActionDebugBindings.js';
import { createBackgroundKernelActionNudgeBindings } from './backgroundKernelActionNudgeBindings.js';
import { createBackgroundKernelActionPolicyBindings } from './backgroundKernelActionPolicyBindings.js';
import { createBackgroundKernelActionProtectionBindings } from './backgroundKernelActionProtectionBindings.js';
import { createBackgroundKernelActionStatsBindings } from './backgroundKernelActionStatsBindings.js';
import { createBackgroundKernelActionStorageBindings } from './backgroundKernelActionStorageBindings.js';

function requireActionOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName];
}

export function createBackgroundKernelActionHandler({
  progressionService,
  statsRuntimeService,
  statsAnalysisQueryService,
  statsTrendQueryService,
  statsRepository,
  tabTimeTracker,
  settingsService,
  settingsCache,
  settingsPersistence,
  broadcastSettingsUpdate,
  schedulePostCommitSettingsEffects,
  runtimeFlagRepository,
  getProtectionRuntimeSnapshot,
  refreshProtectionRuntimeSnapshot,
  interventionLedger,
  requestTabClosure,
  storageSupportBindings,
  readProfileMutationLifecycle,
  cleanupBlockedHistory,
  previewBlockedHistory,
  previewBlockedBookmarks,
  exportBlockedBookmarksHtml,
  faviconService,
  bootPrewarmService,
  zenPairwiseGpService,
  tacticalLogger,
  cycleStateManager,
  markNudgeAborted,
  markNudgePresented,
  markNudgeEpisodeCompleted,
  markNudgeResolved,
  scheduleNudgeTerminalOutboxDrain,
  trackingProtectionService,
  gateInterstitialController,
  contentScriptOrchestrator,
  maybeTriggerProtectionNudge,
  sentinelProtocolTimeline,
  specialSessionRuntime,
  checkScheduleStatus, endScheduleOccurrence, runManualSessionMutation,
  browserPort,
} = {}) {
  const getProtectionRuntimeTelemetryContext = requireActionOwnerMethod(
    trackingProtectionService,
    'getProtectionRuntimeTelemetryContext',
    'BACKGROUND_ACTION_TRACKING_PROTECTION_SERVICE_REQUIRED',
  ).bind(trackingProtectionService);
  const getGateInterstitialSession = requireActionOwnerMethod(
    gateInterstitialController,
    'getGateInterstitialSession',
    'BACKGROUND_ACTION_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
  );
  const closeGateInterstitialProtectedTab = requireActionOwnerMethod(
    gateInterstitialController,
    'closeGateInterstitialProtectedTab',
    'BACKGROUND_ACTION_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
  );
  const submitGateInterstitialDecision = requireActionOwnerMethod(
    gateInterstitialController,
    'submitGateInterstitialDecision',
    'BACKGROUND_ACTION_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
  );
  const releaseIsolationSessions = requireActionOwnerMethod(
    gateInterstitialController,
    'releaseIsolationSessions',
    'BACKGROUND_ACTION_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
  );

  const actionPolicyBindings = createBackgroundKernelActionPolicyBindings({
    settingsService,
    settingsCache,
    settingsPersistence,
    schedulePostCommitSettingsEffects,
    runtimeFlagRepository,
    tacticalLogger,
    browserPort,
  });
  const actionStatsBindings = createBackgroundKernelActionStatsBindings({
    statsRuntimeService,
    statsAnalysisQueryService,
    statsTrendQueryService,
    tabTimeTracker,
    faviconService,
  });
  const actionProtectionBindings = createBackgroundKernelActionProtectionBindings({
    progressionService,
    cycleStateManager,
    getProtectionRuntimeSnapshot,
    getProtectionRuntimeTelemetryContext,
    getGateInterstitialSession,
    closeGateInterstitialProtectedTab,
    refreshProtectionRuntimeSnapshot,
    settingsCache,
    settingsService,
    submitGateInterstitialDecision,
    tabTimeTracker,
    statsRuntimeService,
    interventionLedger,
  });
  const actionStorageBindings = createBackgroundKernelActionStorageBindings({
    storageSupportBindings,
    readProfileMutationLifecycle,
    statsRepository,
    cleanupBlockedHistory,
    previewBlockedHistory,
    previewBlockedBookmarks,
    exportBlockedBookmarksHtml,
    settingsService,
    tabTimeTracker,
    statsRuntimeService,
  });
  const actionDebugBindings = createBackgroundKernelActionDebugBindings({
    faviconService,
    bootPrewarmService,
    statsRuntimeService,
    tabTimeTracker,
    zenPairwiseGpService,
    contentScriptOrchestrator,
    maybeTriggerProtectionNudge,
    sentinelProtocolTimeline,
    browserPort,
  });
  const actionNudgeBindings = createBackgroundKernelActionNudgeBindings({
    cycleStateManager,
    requestTabClosure,
    markNudgeAborted,
    markNudgePresented,
    markNudgeEpisodeCompleted,
    markNudgeResolved,
    scheduleNudgeTerminalOutboxDrain,
    trackingProtectionService,
    browserPort,
  });

  return createTrackingMessageHandler({
    ...actionPolicyBindings,
    ...actionStatsBindings,
    ...actionProtectionBindings,
    ...actionStorageBindings,
    ...actionDebugBindings,
    ...actionNudgeBindings,
    indicatorNavigation: { browserPort },
    specialSession: {
      specialSessionRuntime,
      checkScheduleStatus, endScheduleOccurrence, runManualSessionMutation,
      broadcastSettingsUpdate,
      releaseIsolationSessions,
    },
  });
}
