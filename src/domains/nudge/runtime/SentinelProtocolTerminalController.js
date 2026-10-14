import {
  resolveGlobalSentinelTerminalOutcome,
} from '../nudge/nudgeGameGlobalTerminalOutcome.js';
import { GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS } from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import {
  NUDGE_SCENE_PHASES,
} from '../nudge/nudgeGameScene.js';
import {
  createNudgeTerminalSequenceState,
  getNudgeTerminalSequenceTotalMs,
} from '../nudge/nudgeGameTerminalSequence.js';
import {
  SENTINEL_PROTOCOL_TIMER_KEYS,
} from './SentinelProtocolTimerController.js';
import {
  SENTINEL_OUTCOME_REASONS,
} from './sentinelOutcomeContract.js';

export const SENTINEL_PROTOCOL_GLOBAL_RIFT_INVITE_MS = 30_000;

export function createSentinelProtocolTerminalController({
  timerController = null,
  riftInviteMs = SENTINEL_PROTOCOL_GLOBAL_RIFT_INVITE_MS,
  onTerminalSequenceChange = null,
  onClearRitualReveal = null,
  onClearRitualWatch = null,
  onSetScenePhase = null,
  onUpdatePresentation = null,
  onSetRiftAutoMs = null,
  onFocusRiftInvite = null,
  onRestoreMedia = null,
  onMarkResolved = null,
  onResolutionFailed = null,
  onStopHost = null,
  onNavigateAway = null,
  onNavigateRoom = null,
  onRoomNavigationFailed = null,
  onTerminalStageFailed = null,
  getRecoveryDashboardUrl = () => '',
  getRunId = () => null,
  getAdmissionLease = () => null,
  getRiftHandoff = () => null,
} = {}) {
  let terminalSequenceState = null;
  let activeProtocolOutcome = null;
  let globalRiftInviteOpen = false;
  let terminalEpoch = 0;

  function clearTerminalSequenceTimer() {
    timerController?.clearTimeout?.(SENTINEL_PROTOCOL_TIMER_KEYS.TERMINAL_SEQUENCE);
  }

  function clearGlobalRiftInviteTimer() {
    timerController?.clearTimeout?.(SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_RIFT_INVITE);
  }

  function clearTerminalSequence({
    clearEntities = false,
    notifyWorker = true,
  } = {}) {
    clearTerminalSequenceTimer();
    terminalSequenceState = null;
    onTerminalSequenceChange?.(null, {
      clearEntities,
      notifyWorker,
    });
  }

  function reportTerminalStageFailure(stage, error, { stale = false } = {}) {
    onTerminalStageFailed?.({ stage, error, stale });
    return {
      failed: true,
      failureStage: stage,
      error: String(error?.message || error),
      ...(stale ? { stale: true } : {}),
    };
  }

  function stopTerminalHost(epoch, failure = null) {
    if (epoch !== terminalEpoch) {
      return {
        stopped: false,
        stale: true,
        ...(failure ? reportTerminalStageFailure(failure.stage, failure.error, { stale: true }) : {}),
      };
    }
    let cleanupError = null;
    try {
      onStopHost?.();
    } catch (error) {
      cleanupError = error;
    }
    // Report after stop so its ordinary state reset cannot erase the failure.
    // That exact stop can also advance the epoch before throwing; its cleanup
    // failure remains owned here and must never trigger an automatic retry.
    const priorFailure = failure ? reportTerminalStageFailure(failure.stage, failure.error) : {};
    return cleanupError
      ? { stopped: false, ...priorFailure, ...reportTerminalStageFailure('cleanup', cleanupError) }
      : { stopped: true, ...priorFailure };
  }

  async function restoreAndResolveTerminalOutcome(epoch, terminalOutcome) {
    try {
      onRestoreMedia?.(terminalOutcome.mediaRestoreMode);
    } catch (error) {
      return {
        resolved: false,
        failure: { stage: 'media_restore', error },
      };
    }
    if (epoch !== terminalEpoch) return { resolved: false, stale: true };
    let resolved;
    try {
      resolved = (await onMarkResolved?.(terminalOutcome.outcomeReason)) === true;
    } catch (error) {
      return {
        resolved: false,
        failure: { stage: 'resolution', error },
      };
    }
    if (epoch !== terminalEpoch) return { resolved: false, stale: true };
    if (!resolved) {
      onResolutionFailed?.({
        outcome: terminalOutcome.outcome,
        outcomeReason: terminalOutcome.outcomeReason,
      });
    }
    return { resolved };
  }

  async function finalizeGlobalTerminalOutcome(outcome, {
    navigateAfterSuccess = false,
  } = {}) {
    const epoch = terminalEpoch;
    const admissionLease = getAdmissionLease();
    const terminalOutcome = resolveGlobalSentinelTerminalOutcome(outcome);
    const recoveryDashboardUrl = getRecoveryDashboardUrl?.() || '';
    activeProtocolOutcome = outcome;
    globalRiftInviteOpen = false;
    clearGlobalRiftInviteTimer();
    const resolution = await restoreAndResolveTerminalOutcome(epoch, terminalOutcome);
    const cleanup = stopTerminalHost(epoch, resolution.failure);
    const result = { ...terminalOutcome, resolved: resolution.resolved, ...cleanup };
    if (!cleanup.stopped) return result;
    if (resolution.resolved && navigateAfterSuccess && outcome === 'success') {
      const navigationEpoch = terminalEpoch;
      try {
        await onNavigateAway?.({ recoveryDashboardUrl, admissionLease });
      } catch (error) {
        return {
          ...result,
          ...reportTerminalStageFailure('navigation', error, { stale: navigationEpoch !== terminalEpoch }),
        };
      }
    }
    return result;
  }

  function showGlobalRiftInvite() {
    const epoch = terminalEpoch;
    // Both the host and selected worker use Date.now epoch milliseconds for
    // game presentation. A worker's performance.now origin is not this clock.
    const startedAtMs = Date.now();
    if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
      throw new Error('nudge_scene_phase_started_at_invalid');
    }
    clearTerminalSequence({ clearEntities: true });
    clearGlobalRiftInviteTimer();
    activeProtocolOutcome = 'success';
    globalRiftInviteOpen = false;
    onSetRiftAutoMs?.(riftInviteMs);
    onSetScenePhase?.(NUDGE_SCENE_PHASES.RIFT, { startedAtMs });
    onUpdatePresentation?.();
    const scheduledAtMs = Date.now();
    if (!Number.isFinite(scheduledAtMs) || scheduledAtMs < 0) {
      throw new Error('nudge_scene_phase_started_at_invalid');
    }
    timerController?.scheduleTimeout?.(
      SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_RIFT_INVITE,
      () => {
        if (epoch !== terminalEpoch || activeProtocolOutcome !== 'success') return;
        globalRiftInviteOpen = true;
        onUpdatePresentation?.();
        onFocusRiftInvite?.();
        timerController?.scheduleTimeout?.(
          SENTINEL_PROTOCOL_TIMER_KEYS.GLOBAL_RIFT_INVITE,
          () => {
            if (epoch !== terminalEpoch || !globalRiftInviteOpen) return;
            // An unanswered invitation returns to the paused page. Navigation
            // remains reserved for the explicit action after space has formed.
            return finalizeGlobalTerminalOutcome('success');
          },
          riftInviteMs,
        );
      },
      Math.max(0, startedAtMs + GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS - scheduledAtMs),
    );
    return true;
  }

  async function enterGlobalRift() {
    if (!globalRiftInviteOpen || activeProtocolOutcome !== 'success') return false;
    const epoch = terminalEpoch;
    const admissionLease = getAdmissionLease();
    const terminalOutcome = resolveGlobalSentinelTerminalOutcome('success');
    globalRiftInviteOpen = false;
    clearGlobalRiftInviteTimer();
    let runId = null;
    let riftHandoff = null;
    let riftHandoffCaptured = false;
    try {
      runId = getRunId?.();
      riftHandoff = getRiftHandoff?.();
      riftHandoffCaptured = true;
    } catch (error) {
      onRoomNavigationFailed?.({
        error: String(error?.message || error || 'room_478_handoff_capture_failed'),
      });
    }
    const resolution = await restoreAndResolveTerminalOutcome(epoch, terminalOutcome);
    if (epoch !== terminalEpoch) {
      stopTerminalHost(epoch, resolution.failure);
      return false;
    }
    let roomNavigated = false;
    let navigationFailure = null;
    if (resolution.resolved && riftHandoffCaptured) {
      try {
        roomNavigated = await onNavigateRoom?.({
          runId,
          admissionLease,
          ...(riftHandoff && typeof riftHandoff === 'object' ? riftHandoff : {}),
        }) === true;
      } catch (error) {
        navigationFailure = { stage: 'navigation', error };
      }
      if (epoch !== terminalEpoch) {
        stopTerminalHost(epoch, navigationFailure);
        return roomNavigated;
      }
      if (!roomNavigated && !navigationFailure) onRoomNavigationFailed?.({ error: 'room_478_navigation_rejected' });
    }
    // Keep the original fracture until navigation acknowledgement. Cleanup is
    // outside the navigation catch and attempted once, including failure paths.
    const cleanup = stopTerminalHost(epoch, resolution.failure || navigationFailure);
    return roomNavigated && cleanup.stopped;
  }

  function completeGlobalTerminalSequence(outcome) {
    clearTerminalSequence({ clearEntities: true });
    if (outcome === 'success') {
      showGlobalRiftInvite();
      return true;
    }
    return finalizeGlobalTerminalOutcome(outcome);
  }

  function startGlobalTerminalSequence(outcome, {
    blocked = false,
    now = Date.now(),
  } = {}) {
    if (blocked || terminalSequenceState) return null;
    const epoch = terminalEpoch;
    const sequence = createNudgeTerminalSequenceState({
      outcome,
      now,
    });
    onClearRitualReveal?.();
    onClearRitualWatch?.();
    activeProtocolOutcome = outcome;
    terminalSequenceState = sequence;
    onTerminalSequenceChange?.(sequence, {
      clearEntities: false,
      notifyWorker: true,
    });
    onSetScenePhase?.(sequence.scenePhase);
    onUpdatePresentation?.();
    timerController?.scheduleTimeout?.(
      SENTINEL_PROTOCOL_TIMER_KEYS.TERMINAL_SEQUENCE,
      () => {
        if (epoch !== terminalEpoch || terminalSequenceState !== sequence) return;
        return completeGlobalTerminalSequence(outcome);
      },
      getNudgeTerminalSequenceTotalMs(sequence),
    );
    return sequence;
  }

  function resolveProtocolOutcomeReason(fallbackReason = 'stay') {
    if (activeProtocolOutcome === 'success') {
      return SENTINEL_OUTCOME_REASONS.GLOBAL_COLLAPSE_SUCCESS;
    }
    if (activeProtocolOutcome === 'failure') {
      return SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE;
    }
    return fallbackReason;
  }

  function reset({
    clearTerminal = false,
    clearEntities = false,
    notifyWorker = false,
  } = {}) {
    terminalEpoch += 1;
    clearTerminalSequenceTimer();
    clearGlobalRiftInviteTimer();
    terminalSequenceState = null;
    activeProtocolOutcome = null;
    globalRiftInviteOpen = false;
    if (clearTerminal) {
      onTerminalSequenceChange?.(null, {
        clearEntities,
        notifyWorker,
      });
    }
  }

  return {
    clearTerminalSequenceTimer,
    clearGlobalRiftInviteTimer,
    clearTerminalSequence,
    finalizeGlobalTerminalOutcome,
    showGlobalRiftInvite,
    enterGlobalRift,
    completeGlobalTerminalSequence,
    startGlobalTerminalSequence,
    resolveProtocolOutcomeReason,
    reset,
    getTerminalSequenceState() {
      return terminalSequenceState;
    },
    getActiveProtocolOutcome() {
      return activeProtocolOutcome;
    },
    isGlobalRiftInviteOpen() {
      return globalRiftInviteOpen;
    },
    isTerminalSequenceActive() {
      return !!terminalSequenceState;
    },
  };
}
