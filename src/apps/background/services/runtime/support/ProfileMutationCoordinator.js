import {
  getProfileResetLifecycleWriteAttempt,
  isProfileResetWriteAdmissionClosed,
  resolveProfileResetGeneration,
} from '../../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';

const lifecycleWriteFailures = new WeakMap();

export function getProfileMutationLifecycleWriteFailure(error) {
  return lifecycleWriteFailures.get(error) || null;
}

function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
  return value;
}

function normalizeParticipants(participants) {
  if (!Array.isArray(participants)) {
    throw new Error('PROFILE_MUTATION_PARTICIPANTS_REQUIRED');
  }
  return Object.freeze(participants.map((participant, index) => {
    if (!participant || typeof participant !== 'object') {
      throw new Error(`PROFILE_MUTATION_PARTICIPANT_INVALID:${index}`);
    }
    return Object.freeze({
      name: typeof participant.name === 'string' && participant.name.trim()
        ? participant.name.trim()
        : `participant:${index}`,
      quiesce: requireFunction(
        participant.quiesceForProfileMutation,
        `PROFILE_MUTATION_PARTICIPANT_QUIESCE_REQUIRED:${index}`,
      ).bind(participant),
    });
  }));
}

function createWaveError(code, failures) {
  const error = new Error(code);
  error.code = code;
  error.failures = failures.map(({ name, reason }) => ({
    name,
    error: reason instanceof Error ? reason.message : String(reason || code),
  }));
  error.cause = failures[0]?.reason;
  return error;
}

async function runParticipantSequence(participants, method, context, errorCode) {
  const failures = [];
  // Participant order is an ownership dependency order. Producers quiesce
  // before the queues and stores they can still reach. Every participant is
  // still attempted so a failed predecessor cannot leave later owners open.
  for (const participant of participants) {
    try {
      await participant[method](context);
    } catch (reason) {
      failures.push({ name: participant.name, reason });
    }
  }
  if (failures.length > 0) throw createWaveError(errorCode, failures);
}

function createLifecycleFailureCode(error) {
  return String(
    error?.code
    || error?.message
    || 'PROFILE_MUTATION_FAILED',
  );
}

function normalizeExpectedClosedResetId(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('PROFILE_MUTATION_RECOVERY_GENERATION_INVALID');
  }
  return value;
}

export function createProfileMutationCoordinator({
  lifecycleRepository,
  participants = [],
  runtimeAdmissionGate,
  getRuntimeReadinessPromise,
  now = () => Date.now(),
} = {}) {
  if (
    !lifecycleRepository
    || typeof lifecycleRepository.read !== 'function'
    || typeof lifecycleRepository.beginReset !== 'function'
    || typeof lifecycleRepository.recoverInterruptedReset !== 'function'
    || typeof lifecycleRepository.commitReset !== 'function'
    || typeof lifecycleRepository.completeReset !== 'function'
    || typeof lifecycleRepository.failReset !== 'function'
  ) {
    throw new Error('PROFILE_MUTATION_LIFECYCLE_REPOSITORY_REQUIRED');
  }
  requireFunction(
    getRuntimeReadinessPromise,
    'PROFILE_MUTATION_RUNTIME_READINESS_OWNER_REQUIRED',
  );
  if (
    !runtimeAdmissionGate
    || typeof runtimeAdmissionGate.closeAndDrain !== 'function'
    || typeof runtimeAdmissionGate.sealForRuntimeReload !== 'function'
    || typeof runtimeAdmissionGate.failClosed !== 'function'
    || typeof runtimeAdmissionGate.getSnapshot !== 'function'
  ) {
    throw new Error('PROFILE_MUTATION_RUNTIME_ADMISSION_GATE_REQUIRED');
  }
  requireFunction(now, 'PROFILE_MUTATION_CLOCK_REQUIRED');
  const ownedParticipants = normalizeParticipants(participants);
  let operationTail = Promise.resolve();
  let activeMutationPromise = null;

  function assertRuntimeMutationCanBegin(expectedClosedResetId) {
    const snapshot = runtimeAdmissionGate.getSnapshot();
    if (
      !snapshot
      || typeof snapshot !== 'object'
      || Array.isArray(snapshot)
      || typeof snapshot.phase !== 'string'
      || (snapshot.closedResetId !== null && typeof snapshot.closedResetId !== 'string')
    ) {
      throw new Error('PROFILE_MUTATION_RUNTIME_GATE_SNAPSHOT_INVALID');
    }
    if (snapshot.phase === 'open') return;
    if (
      snapshot.phase === 'failed'
      && expectedClosedResetId !== null
      && snapshot.closedResetId === expectedClosedResetId
    ) {
      return;
    }

    const code = snapshot.phase === 'draining' || snapshot.phase === 'reload_pending'
      ? 'PROFILE_MUTATION_RUNTIME_TERMINAL_HANDOFF_PENDING'
      : 'PROFILE_MUTATION_RUNTIME_RECOVERY_GATE_MISMATCH';
    const error = new Error(code);
    error.code = code;
    error.runtimeGate = snapshot;
    error.expectedClosedResetId = expectedClosedResetId;
    throw error;
  }

  function enqueue(operation) {
    const queued = operationTail.then(operation, operation);
    operationTail = queued.catch(() => undefined);
    return queued;
  }

  async function beginLifecycle(operation, expectedClosedResetId) {
    const startedAt = now();
    const current = await lifecycleRepository.read();
    if (isProfileResetWriteAdmissionClosed(current)) {
      if (expectedClosedResetId === null) {
        throw new Error('PROFILE_MUTATION_RECOVERY_GENERATION_REQUIRED');
      }
      if (current.resetId !== expectedClosedResetId) {
        throw new Error('PROFILE_MUTATION_RECOVERY_GENERATION_STALE');
      }
      return {
        lifecycle: await lifecycleRepository.recoverInterruptedReset({
          operation,
          startedAt,
        }),
        recovered: true,
      };
    }
    if (expectedClosedResetId !== null) {
      throw new Error('PROFILE_MUTATION_RECOVERY_GENERATION_STALE');
    }
    return {
      lifecycle: await lifecycleRepository.beginReset({ operation, startedAt }),
      recovered: false,
    };
  }

  async function drainOpenRuntimeInitialization() {
    const lifecycle = await lifecycleRepository.read();
    if (isProfileResetWriteAdmissionClosed(lifecycle)) return;
    const readinessPromise = getRuntimeReadinessPromise();
    if (
      readinessPromise !== null
      && typeof readinessPromise?.then !== 'function'
    ) {
      throw new Error('PROFILE_MUTATION_RUNTIME_READINESS_PROMISE_INVALID');
    }
    if (readinessPromise) {
      await readinessPromise.then(
        () => undefined,
        () => undefined,
      );
    }
  }

  async function quiesceFailedLifecycleWrite(error, attempt) {
    const { lifecycle, previousLifecycle } = attempt;
    const context = Object.freeze({
      operation: lifecycle.operation,
      resetId: lifecycle.resetId,
      recovered: isProfileResetWriteAdmissionClosed(previousLifecycle),
    });
    const failures = [];
    let runtimeGateClosed = false;
    let runtimeGateFailed = false;
    let failedLifecycle = null;
    try {
      const drain = runtimeAdmissionGate.closeAndDrain(context);
      runtimeGateClosed = true;
      await drain;
    } catch (cause) {
      failures.push(Object.freeze({ stage: 'runtime_drain', cause }));
    }
    try {
      await runParticipantSequence(
        ownedParticipants,
        'quiesce',
        context,
        'PROFILE_MUTATION_QUIESCE_FAILED',
      );
    } catch (cause) {
      failures.push(Object.freeze({ stage: 'quiesce', cause }));
    }
    try {
      failedLifecycle = await lifecycleRepository.failResetWriteAttempt({
        error,
        completedAt: now(),
        failureCode: createLifecycleFailureCode(error),
      });
    } catch (cause) {
      failures.push(Object.freeze({ stage: 'failure_fence', cause }));
    }
    if (runtimeGateClosed) {
      try {
        runtimeAdmissionGate.failClosed({ resetId: lifecycle.resetId });
        runtimeGateFailed = true;
      } catch (cause) {
        failures.push(Object.freeze({ stage: 'runtime_gate', cause }));
      }
    }
    lifecycleWriteFailures.set(error, Object.freeze({
      attemptedLifecycle: lifecycle,
      previousLifecycle,
      failedLifecycle,
      failures: Object.freeze(failures),
      reloadRequired: failedLifecycle === null || !runtimeGateFailed,
    }));
  }

  function runExclusiveMutation({
    operation,
    task,
    expectedClosedResetId = null,
  } = {}) {
    const mutationTask = requireFunction(task, 'PROFILE_MUTATION_TASK_REQUIRED');
    const recoveryGeneration = normalizeExpectedClosedResetId(expectedClosedResetId);
    if (activeMutationPromise !== null) {
      const error = new Error('PROFILE_MUTATION_ALREADY_ACTIVE');
      error.code = 'PROFILE_MUTATION_ALREADY_ACTIVE';
      return Promise.reject(error);
    }
    const mutationPromise = enqueue(async () => {
      // The old runtime becomes permanently terminal once a completed profile
      // generation is waiting for reload. Reject another destructive command
      // before it can write a new durable lifecycle over that handoff. A failed
      // runtime may retry only the exact generation it previously closed.
      assertRuntimeMutationCanBegin(recoveryGeneration);
      await drainOpenRuntimeInitialization();
      let lifecycle;
      let recovered;
      try {
        ({ lifecycle, recovered } = await beginLifecycle(operation, recoveryGeneration));
      } catch (error) {
        const attempt = getProfileResetLifecycleWriteAttempt(error, lifecycleRepository);
        if (attempt !== null) await quiesceFailedLifecycleWrite(error, attempt);
        throw error;
      }
      const context = Object.freeze({
        operation: lifecycle.operation,
        resetId: lifecycle.resetId,
        recovered,
      });
      let runtimeGateClosed = false;
      let value;
      let complete;
      try {
        const runtimeDrain = runtimeAdmissionGate.closeAndDrain({
          resetId: lifecycle.resetId,
          recovered,
        });
        runtimeGateClosed = true;
        await runtimeDrain;
        await runParticipantSequence(
          ownedParticipants,
          'quiesce',
          context,
          'PROFILE_MUTATION_QUIESCE_FAILED',
        );
        value = await mutationTask({ lifecycle, recovered });
        await lifecycleRepository.commitReset({
          resetId: lifecycle.resetId,
        });
        complete = await lifecycleRepository.completeReset({
          resetId: lifecycle.resetId,
          completedAt: now(),
        });
      } catch (error) {
        const primary = error instanceof Error ? error : new Error(String(error));
        try {
          await lifecycleRepository.failReset({
            resetId: lifecycle.resetId,
            completedAt: now(),
            failureCode: createLifecycleFailureCode(primary),
          });
        } catch (fenceError) {
          primary.profileMutationFenceFailure = {
            code: 'PROFILE_MUTATION_FAILURE_COMMIT_FAILED',
            error: fenceError instanceof Error ? fenceError.message : String(fenceError),
          };
        }
        if (runtimeGateClosed) {
          try {
            runtimeAdmissionGate.failClosed({ resetId: lifecycle.resetId });
          } catch (gateError) {
            primary.profileMutationRuntimeGateFailure = {
              code: 'PROFILE_MUTATION_RUNTIME_GATE_FAILURE_COMMIT_FAILED',
              error: gateError instanceof Error ? gateError.message : String(gateError),
            };
          }
        }
        throw primary;
      }

      // A full profile generation replacement is terminal for the current
      // JavaScript lifetime. The response transport performs the runtime reload;
      // no old participant or ingress gate is rebound to the completed generation.
      runtimeAdmissionGate.sealForRuntimeReload({ lifecycle: complete });
      return Object.freeze({ value, lifecycle: complete, recovered });
    });
    activeMutationPromise = mutationPromise;
    void mutationPromise.then(
      () => {
        if (activeMutationPromise === mutationPromise) activeMutationPromise = null;
      },
      () => {
        if (activeMutationPromise === mutationPromise) activeMutationPromise = null;
      },
    );
    return mutationPromise;
  }

  function runStableRead({ task } = {}) {
    const readTask = requireFunction(task, 'PROFILE_MUTATION_STABLE_READ_TASK_REQUIRED');
    return enqueue(async () => {
      const before = await lifecycleRepository.read();
      if (isProfileResetWriteAdmissionClosed(before)) {
        const error = new Error('PROFILE_MUTATION_STABLE_READ_ADMISSION_CLOSED');
        error.code = 'PROFILE_MUTATION_STABLE_READ_ADMISSION_CLOSED';
        error.lifecycle = before;
        throw error;
      }
      const generation = resolveProfileResetGeneration(before);
      const value = await readTask({ lifecycle: before });
      const after = await lifecycleRepository.read();
      if (
        isProfileResetWriteAdmissionClosed(after)
        || resolveProfileResetGeneration(after) !== generation
      ) {
        const error = new Error('PROFILE_MUTATION_STABLE_READ_GENERATION_CHANGED');
        error.code = 'PROFILE_MUTATION_STABLE_READ_GENERATION_CHANGED';
        error.before = before;
        error.after = after;
        throw error;
      }
      return value;
    });
  }

  return Object.freeze({
    runExclusiveMutation,
    runStableRead,
  });
}

export default createProfileMutationCoordinator;
