import { createNudgeTerminalEffectCoordinator } from '../../../../domains/tracking/background/NudgeTerminalEffectCoordinator.js';
import { createNudgeCyclePolicy } from '../../../../domains/tracking/background/trackingMessagePolicies/nudgeCyclePolicy.js';

export function createBackgroundKernelNudgeTerminalEffectBindings({
  settingsService,
  schedulePostCommitSettingsEffects,
  runtimeFlagRepository,
  trackingProtectionService,
  readPendingEntries,
  markStageCompleted,
  markStageFailed,
} = {}) {
  if (!trackingProtectionService || typeof trackingProtectionService.recordRecoveryOutcome !== 'function') {
    throw new Error('BACKGROUND_NUDGE_TERMINAL_TRACKING_OWNER_REQUIRED');
  }
  const policy = createNudgeCyclePolicy({
    settingsService,
    schedulePostCommitSettingsEffects,
    runtimeFlagRepository,
  });
  return createNudgeTerminalEffectCoordinator({
    readPendingEntries,
    markStageCompleted,
    markStageFailed,
    persistGlobalSentinelOutcomeDecision: policy.persistGlobalSentinelOutcomeDecision,
    persistNudgeStayDecision: policy.persistNudgeStayDecision,
    isNudgeStayReason: policy.isNudgeStayReason,
    trackProtectionRecoveryResolved: (payload) => trackingProtectionService.recordRecoveryOutcome({
      ...payload,
      outcome: payload?.reason === 'leave' ? 'leave' : 'stay',
    }),
    trackProtectionRecoveryAborted: (payload) => trackingProtectionService.recordRecoveryOutcome({
      ...payload,
      outcome: 'aborted',
    }),
  });
}
