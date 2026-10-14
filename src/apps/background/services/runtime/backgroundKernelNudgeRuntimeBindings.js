import {
  sweepExpiredPendingNudges as sweepExpiredPendingNudgesBase,
} from '../../../../domains/nudge/runtime/session/nudgeSessionGateState.js';
import {
  abortNudgesForTab as abortNudgesForTabBase,
} from '../../../../domains/tracking/background/nudgeManagerAbortTabState.js';
import {
  markNudgeAborted as markNudgeAbortedBase,
} from '../../../../domains/tracking/background/nudgeManagerAbortKeyState.js';
import {
  markNudgePresented,
} from '../../../../domains/tracking/background/nudgeManagerPresentationState.js';
import {
  markNudgeDayEpisodeCompleted as markNudgeEpisodeCompletedBase,
} from '../../../../domains/nudge/runtime/session/nudgeSessionEpisodeState.js';
import {
  markNudgeResolved as markNudgeResolvedBase,
} from '../../../../domains/tracking/background/nudgeManagerResolutionState.js';
import {
  markNudgeTerminalOutboxStageFailed,
  markNudgeTerminalOutboxStageCompleted,
  readPendingNudgeTerminalOutboxEntries,
} from '../../../../domains/nudge/runtime/session/nudgeTerminalOutboxState.js';
import {
  reconcileNudgeDebtSession as reconcileNudgeDebtSessionBase,
} from '../../../../domains/nudge/runtime/session/nudgeDebtSessionReconciliation.js';
import { createNudgeWindowBlurController } from '../../../../domains/tracking/background/NudgeWindowBlurController.js';
import { createNudgeSessionBindings } from './backgroundKernelAdapters.js';

export function createBackgroundKernelNudgeRuntimeBindings({
  settingsService,
  settingsCache,
  stopNudgeForTab,
} = {}) {
  const nudgeSessionBindings = createNudgeSessionBindings({
    reconcileNudgeDebtSessionBase,
    sweepExpiredPendingNudgesBase,
    abortNudgesForTabBase,
    markNudgeEpisodeCompletedBase,
    markNudgeResolvedBase,
    markNudgeAbortedBase,
  });
  const nudgeWindowBlurController = createNudgeWindowBlurController({
    ensureSettingsCache: () => settingsService.ensureSettingsCache(),
    getNudgeConfig: () => settingsCache?.nudgeConfig,
    stopNudgeForTab,
  });

  return {
    ...nudgeSessionBindings,
    markNudgePresented,
    markNudgeTerminalOutboxStageFailed,
    markNudgeTerminalOutboxStageCompleted,
    readPendingNudgeTerminalOutboxEntries,
    nudgeWindowBlurController,
  };
}
