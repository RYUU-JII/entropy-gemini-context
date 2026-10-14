import { createTrackingBrowserEventHandlers } from '../../../../domains/tracking/background/trackingBrowserEventHandlers.js';
import { createTrackingTickRunner } from '../../../../domains/tracking/background/trackingTickRunner.js';
import { createBackgroundKernelTrackingBrowserPort } from './backgroundKernelTrackingBrowserPort.js';
import { MEMORY_PURGE_RECENT_HISTORY_WINDOW_MS, TRACKING_INTERVAL_MS } from './backgroundKernelRuntimeConfig.js';
import { getInterventionAdmissionService } from '../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import { createTrackingEnsoCadenceBridge } from '../../../../domains/tracking/background/trackingEnsoCadenceBridge.js';
import { createCoolingCurveStepRefreshCoordinator } from '../../../../domains/protection/background/runtime/CoolingCurveStepRefreshCoordinator.js';

const TRACKING_RUNTIME_STATE_METHODS = [
  'observeGateEntryPresence',
  'noteGateActiveNavigation', 'noteGateForegroundTab',
  'noteGateForegroundBlur', 'noteGateTabClosed',
  'noteFeedFlowTabNavigation', 'noteFeedFlowTabClosed',
];

function bindTrackingRuntimeStateMethods(owner) {
  return Object.fromEntries(TRACKING_RUNTIME_STATE_METHODS.map((methodName) => [
    methodName,
    typeof owner?.[methodName] === 'function' ? owner[methodName].bind(owner) : null,
  ]));
}

export function createBackgroundKernelTrackingBrowserBindings({
  tabTimeTracker,
  statsTickRuntimeService,
  statsRuntimeService,
  checkScheduleStatus,
  checkGlobalCapStatus,
  trackingProtectionService,
  frictionBootstrapCoordinator,
  syncManagedContentScripts,
  maybeTriggerProtectionNudge,
  flushTacticalLogsWrapper,
  getInitPromise,
  runProfileMutationAdmittedTask,
  captureProfileMutationRuntimeAdmission,
  runCapturedProfileMutationRuntimeTask,
  runNudgePendingSweep,
  clearNudgeWindowBlurTimer,
  cycleStateManager,
  backgroundBehaviorPolicy,
  recordCLSEShortDwell,
  faviconService,
  sendProtectionUpdate,
  handleWindowBlurNudgeAbort,
  maybeDeleteHistoryForUrl,
  cleanupRecentBlockedHistory,
  runMemoryPurgeArtifactCleanup,
  sweepStaleTabs,
  nudgeWindowBlurController,
  protectionDispatcher,
  gateInterstitialController,
  protectionRuntimeStateCoordinator,
  observeGateSitePresence,
  contentScriptOrchestrator,
  waitForSettingsPropagationIdle,
  tacticalLogger,
  browserPort = createBackgroundKernelTrackingBrowserPort(),
  sessionStore,
  statsRuntimeHealthLedger,
  contentProtectionSync,
  runCLSEHeartbeat,
} = {}) {
    const { checkCoolingCurveSteps } = createCoolingCurveStepRefreshCoordinator({
      trackingProtectionService, sendProtectionUpdate, syncManagedContentScripts,
      frictionBootstrapCoordinator,
      refreshFrictionBootstrapForHostname: protectionDispatcher?.refreshFrictionBootstrapForHostname,
    });
    const ensoCadenceBridge = createTrackingEnsoCadenceBridge({ admission: getInterventionAdmissionService(), tracker: tabTimeTracker, windowIdNone: browserPort.windowIdNone });
    const { runTick, quiesceForProfileMutation } = createTrackingTickRunner({
      TabTimeTracker: tabTimeTracker,
      trackingIntervalMs: TRACKING_INTERVAL_MS,
      loadStatsCache: statsRuntimeService.loadStatsCache,
      checkScheduleStatus,
    checkGlobalCapStatus,
    checkCoolingCurveSteps,
    maybeTriggerProtectionNudge,
    runStatsMutationBatch: statsRuntimeService.runStatsMutationBatch,
    flushTacticalLogsWrapper,
    getTacticalBuffer: tacticalLogger?.getTacticalBuffer,
    browserPort,
    statsRuntimeHealthLedger,
    observeGateEntryPresence: protectionRuntimeStateCoordinator.observeGateEntryPresence,
    ensoCadenceBridge,
  });

  const trackingBrowserEventHandlers = createTrackingBrowserEventHandlers({
    getInitPromise,
    runProfileMutationAdmittedTask,
    captureProfileMutationRuntimeAdmission,
    runCapturedProfileMutationRuntimeTask,
    runTick,
    runNudgePendingSweep,
    clearNudgeWindowBlurTimer,
    cycleStateManager,
    TabTimeTracker: tabTimeTracker,
    tickRuntimeService: statsTickRuntimeService,
    shouldCollectBehaviorForHostname: backgroundBehaviorPolicy.shouldCollectBehaviorForHostname,
    shouldCollectBehaviorForActiveTab: backgroundBehaviorPolicy.shouldCollectBehaviorForActiveTab,
    recordCLSEShortDwell,
    faviconService, sendProtectionUpdate, maybeTriggerProtectionNudge,
    handleWindowBlurNudgeAbort,
    maybeDeleteHistoryForUrl,
    cleanupRecentBlockedHistory,
    runMemoryPurgeArtifactCleanup,
    sweepStaleTabs,
    recentHistorySweepWindowMs: MEMORY_PURGE_RECENT_HISTORY_WINDOW_MS,
    nudgeWindowBlurController, protectionDispatcher, gateInterstitialController,
    ...bindTrackingRuntimeStateMethods(protectionRuntimeStateCoordinator),
    observeGateSitePresence,
    contentScriptOrchestrator,
    waitForSettingsPropagationIdle,
    flushTacticalLogsWrapper,
    tacticalLogger,
    browserPort, sessionStore, statsRuntimeHealthLedger,
    contentProtectionSync,
    runCLSEHeartbeat,
    ensoCadenceBridge,
  });

  return { ...trackingBrowserEventHandlers, runTick, quiesceForProfileMutation,
    observeEnsoIdleState: async (transition) => {
      if (transition.prevState !== 'locked' && transition.nextState !== 'locked') return;
      const receipt = { ...getInterventionAdmissionService().captureEnsoCadenceBoundary(transition.timestamp), expectedTabId: null };
      await ensoCadenceBridge.settle(receipt);
      await ensoCadenceBridge.refresh(receipt);
    },
  };
}
