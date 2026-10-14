import {
  getPendingNudgeTerminalOutboxStages,
  NUDGE_TERMINAL_OUTBOX_STAGES,
} from '../../nudge/runtime/session/nudgeTerminalOutboxContract.js';

function requireFunction(fn, errorCode) {
  if (typeof fn !== 'function') throw new Error(errorCode);
  return fn;
}

function describeFailureCode(error, fallback) {
  const candidates = [error?.code, error?.message];
  for (const candidate of candidates) {
    if (
      typeof candidate === 'string'
      && /^[A-Z][A-Z0-9_.:-]{0,119}$/.test(candidate)
    ) return candidate;
  }
  return fallback;
}

const PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
  QUIESCE_FAILED: 'quiesce_failed',
});

export function createNudgeTerminalEffectCoordinator({
  readPendingEntries,
  markStageCompleted,
  markStageFailed,
  persistGlobalSentinelOutcomeDecision,
  persistNudgeStayDecision,
  isNudgeStayReason,
  trackProtectionRecoveryResolved,
  trackProtectionRecoveryAborted,
  consoleRef = console,
} = {}) {
  const readPending = requireFunction(
    readPendingEntries,
    'NUDGE_TERMINAL_OUTBOX_READ_OWNER_REQUIRED',
  );
  const completeStage = requireFunction(
    markStageCompleted,
    'NUDGE_TERMINAL_OUTBOX_COMPLETE_OWNER_REQUIRED',
  );
  const failStage = requireFunction(
    markStageFailed,
    'NUDGE_TERMINAL_OUTBOX_FAILURE_OWNER_REQUIRED',
  );
  const persistGlobalOutcome = requireFunction(
    persistGlobalSentinelOutcomeDecision,
    'NUDGE_TERMINAL_GLOBAL_OUTCOME_OWNER_REQUIRED',
  );
  const persistStayDecision = requireFunction(
    persistNudgeStayDecision,
    'NUDGE_TERMINAL_STAY_DECISION_OWNER_REQUIRED',
  );
  const isStayReason = requireFunction(
    isNudgeStayReason,
    'NUDGE_TERMINAL_STAY_REASON_OWNER_REQUIRED',
  );
  const trackResolved = requireFunction(
    trackProtectionRecoveryResolved,
    'NUDGE_TERMINAL_RESOLVED_TRACKING_OWNER_REQUIRED',
  );
  const trackAborted = requireFunction(
    trackProtectionRecoveryAborted,
    'NUDGE_TERMINAL_ABORTED_TRACKING_OWNER_REQUIRED',
  );

  let drainPromise = null;
  let drainRequested = false;
  let profileMutationPhase = PROFILE_MUTATION_PHASES.OPEN;
  let profileMutationQuiescePromise = null;

  function assertProfileMutationAdmissionOpen() {
    if (profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN) {
      throw new Error(
        `NUDGE_TERMINAL_EFFECT_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`,
      );
    }
  }

  function buildCanonicalRequest(entry) {
    return {
      key: entry.key,
      runId: entry.runId,
      reason: entry.reason,
      durationMs: entry.durationMs,
      ...(entry.hostname ? { hostname: entry.hostname } : {}),
    };
  }

  async function runStage(entry, stage) {
    if (stage === NUDGE_TERMINAL_OUTBOX_STAGES.RECOVERY_TRACKING) {
      const trackingOwner = entry.status === 'resolved' ? trackResolved : trackAborted;
      await trackingOwner({
        key: entry.key,
        hostname: entry.hostname,
        runId: entry.runId,
        tabId: entry.tabId,
        now: entry.committedAt,
        reason: entry.reason,
        durationMs: entry.durationMs,
      });
      return;
    }
    if (stage === NUDGE_TERMINAL_OUTBOX_STAGES.GLOBAL_OUTCOME) {
      await persistGlobalOutcome(buildCanonicalRequest(entry), {
        runId: entry.runId,
        tabId: entry.tabId,
        now: entry.committedAt,
      });
      return;
    }
    if (stage === NUDGE_TERMINAL_OUTBOX_STAGES.STAY_DECISION) {
      if (isStayReason(entry.reason)) {
        await persistStayDecision(buildCanonicalRequest(entry), entry.committedAt);
      }
      return;
    }
    throw new Error(`NUDGE_TERMINAL_OUTBOX_STAGE_UNKNOWN:${String(stage)}`);
  }

  async function processEntry(entry) {
    let current = entry;
    let completedStages = 0;
    let failedStages = 0;
    for (const stage of getPendingNudgeTerminalOutboxStages(current)) {
      try {
        await runStage(current, stage);
        const checkpoint = await completeStage(current.runId, {
          key: current.key,
          tabId: current.tabId,
          status: current.status,
          stage,
          now: Date.now(),
        });
        if (
          checkpoint?.outcome !== 'completed'
          && checkpoint?.outcome !== 'already_completed'
        ) {
          throw new Error(checkpoint?.reason || 'NUDGE_TERMINAL_OUTBOX_STAGE_REJECTED');
        }
        current = checkpoint.entry;
        completedStages += 1;
      } catch (error) {
        failedStages += 1;
        const failureCode = describeFailureCode(
          error,
          'NUDGE_TERMINAL_OUTBOX_STAGE_FAILED',
        );
        try {
          const failure = await failStage(current.runId, {
            key: current.key,
            tabId: current.tabId,
            status: current.status,
            stage,
            code: failureCode,
            now: Date.now(),
          });
          if (failure?.entry) current = failure.entry;
        } catch (checkpointError) {
          consoleRef?.warn?.(
            '[NudgeTerminalEffectCoordinator] failed to checkpoint stage failure',
            checkpointError,
          );
        }
      }
    }
    return { completedStages, failedStages };
  }

  async function runDrainLoop() {
    const summary = {
      entries: 0,
      completedStages: 0,
      failedStages: 0,
    };
    do {
      drainRequested = false;
      const entries = await readPending();
      summary.entries += entries.length;
      for (const entry of entries) {
        const result = await processEntry(entry);
        summary.completedStages += result.completedStages;
        summary.failedStages += result.failedStages;
      }
    } while (drainRequested);
    return summary;
  }

  function ensureDrainScheduled() {
    drainRequested = true;
    if (!drainPromise) {
      drainPromise = Promise.resolve()
        .then(runDrainLoop)
        .finally(() => {
          drainPromise = null;
          if (drainRequested && profileMutationPhase === PROFILE_MUTATION_PHASES.OPEN) {
            ensureDrainScheduled();
          } else if (profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN) {
            drainRequested = false;
          }
        });
      void drainPromise.catch((error) => {
        consoleRef?.warn?.('[NudgeTerminalEffectCoordinator] drain failed', error);
      });
    }
    return { status: 'scheduled' };
  }

  function scheduleDrain() {
    assertProfileMutationAdmissionOpen();
    return ensureDrainScheduled();
  }

  async function drainPendingEffects() {
    scheduleDrain();
    return drainPromise;
  }

  function quiesceForProfileMutation() {
    if (profileMutationPhase === PROFILE_MUTATION_PHASES.QUIESCING) {
      return profileMutationQuiescePromise;
    }
    if (profileMutationPhase === PROFILE_MUTATION_PHASES.QUIESCED) {
      return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }
    if (
      profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN
      && profileMutationPhase !== PROFILE_MUTATION_PHASES.QUIESCE_FAILED
    ) {
      return Promise.reject(new Error(
        `NUDGE_TERMINAL_EFFECT_PROFILE_MUTATION_PHASE_INVALID:${profileMutationPhase}`,
      ));
    }

    profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCING;
    ensureDrainScheduled();
    const admittedDrain = drainPromise;
    profileMutationQuiescePromise = admittedDrain.then(() => {
      profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCED;
      return Object.freeze({ quiesced: true, reused: false });
    }).catch((cause) => {
      profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
      const error = new Error('NUDGE_TERMINAL_EFFECT_PROFILE_MUTATION_QUIESCE_FAILED');
      error.code = 'NUDGE_TERMINAL_EFFECT_PROFILE_MUTATION_QUIESCE_FAILED';
      error.cause = cause;
      throw error;
    });
    return profileMutationQuiescePromise;
  }

  return {
    scheduleDrain,
    drainPendingEffects,
    quiesceForProfileMutation,
  };
}
