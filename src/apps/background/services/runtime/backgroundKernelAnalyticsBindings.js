function requireAnalyticsFunction(fn, errorCode) {
  if (typeof fn !== 'function') throw new Error(errorCode);
}

function requireAnalyticsOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') throw new Error(errorCode);
}

export function createBackgroundKernelAnalyticsBindings({
  statsTickRuntimeService,
  nudgeWindowBlurController,
  onIdleStateChange,
  setupIdleDetection,
  runProfileMutationAdmittedTask,
  maybeDeleteHistoryForUrl,
  observeEnsoIdleState = null,
} = {}) {
  [
    'primeLoadedDayForRollover',
    'resolveColdStartRecoveryDate',
    'runStatsMutationBatch',
    'settlePreviousDayForRollover',
  ].forEach((methodName) => {
    requireAnalyticsOwnerMethod(
      statsTickRuntimeService,
      methodName,
      'BACKGROUND_ANALYTICS_TICK_RUNTIME_REQUIRED',
    );
  });
  requireAnalyticsOwnerMethod(nudgeWindowBlurController, 'clear', 'BACKGROUND_ANALYTICS_NUDGE_WINDOW_BLUR_REQUIRED');
  requireAnalyticsOwnerMethod(
    nudgeWindowBlurController,
    'handleWindowBlurAbort',
    'BACKGROUND_ANALYTICS_NUDGE_WINDOW_BLUR_REQUIRED',
  );
  requireAnalyticsFunction(onIdleStateChange, 'BACKGROUND_ANALYTICS_IDLE_STATE_OWNER_REQUIRED');
  requireAnalyticsFunction(setupIdleDetection, 'BACKGROUND_ANALYTICS_IDLE_SETUP_REQUIRED');
  requireAnalyticsFunction(
    runProfileMutationAdmittedTask,
    'BACKGROUND_ANALYTICS_PROFILE_MUTATION_ADMISSION_REQUIRED',
  );
  requireAnalyticsFunction(maybeDeleteHistoryForUrl, 'BACKGROUND_ANALYTICS_HISTORY_DELETE_REQUIRED');

  const handleIdleStateChange = async (transition) => {
    await observeEnsoIdleState?.(transition);
    return statsTickRuntimeService.runStatsMutationBatch(
      ({ now }) => onIdleStateChange({ ...transition, timestamp: now }),
    );
  };

  return {
    setupIdleDetection: () => setupIdleDetection(handleIdleStateChange, {
      runAdmittedTask: runProfileMutationAdmittedTask,
    }),
    handleHistoryVisited: async (entry) => {
      await maybeDeleteHistoryForUrl(entry?.url);
    },
    rolloverLifecycle: Object.freeze({
      primeLoadedDay: (context) => statsTickRuntimeService.primeLoadedDayForRollover(context),
      resolveColdStartRecoveryDate: (context) => statsTickRuntimeService.resolveColdStartRecoveryDate(context),
      settlePreviousDay: (context) => statsTickRuntimeService.settlePreviousDayForRollover(context),
    }),
    clearNudgeWindowBlurTimer: () => {
      nudgeWindowBlurController.clear();
    },
    handleWindowBlurNudgeAbort: async (tabId, now = Date.now()) => {
      await nudgeWindowBlurController.handleWindowBlurAbort(tabId, now);
    },
  };
}
