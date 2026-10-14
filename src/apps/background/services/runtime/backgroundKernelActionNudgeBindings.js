export function createBackgroundKernelActionNudgeBindings({
  cycleStateManager,
  requestTabClosure,
  markNudgeAborted,
  markNudgePresented,
  markNudgeEpisodeCompleted,
  markNudgeResolved,
  scheduleNudgeTerminalOutboxDrain,
  trackingProtectionService,
  browserPort,
} = {}) {
  return {
    nudgeCycle: {
      acceptResetRecommendation: () => cycleStateManager.acceptResetRecommendation(),
      dismissResetRecommendation: () => cycleStateManager.dismissResetRecommendation(),
      getCycleState: () => cycleStateManager.getPublicState(),
      markNudgeAborted,
      markNudgePresented,
      markNudgeEpisodeCompleted,
      markNudgeResolved,
      scheduleNudgeTerminalOutboxDrain,
      requestTabClosure,
      browserPort,
      setResetHour: (nextHour) => cycleStateManager.setResetHour(nextHour),
      trackProtectionRecoveryAborted: (payload) => trackingProtectionService.recordRecoveryOutcome({
        ...payload,
        outcome: 'aborted',
      }),
      trackProtectionRecoveryPresented: (payload) => (
        trackingProtectionService.recordRecoveryPresented(payload)
      ),
      trackProtectionRecoveryResolved: (payload) => trackingProtectionService.recordRecoveryOutcome({
        ...payload,
        outcome: payload?.reason === 'leave' ? 'leave' : 'stay',
      }),
    },
  };
}
