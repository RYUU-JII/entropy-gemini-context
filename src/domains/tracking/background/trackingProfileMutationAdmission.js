import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
} from '../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';

export const TRACKING_PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
  QUIESCE_FAILED: 'quiesce_failed',
});

export function createTrackingProfileMutationError(code, phase = null) {
  const error = new Error(phase ? `${code}:${phase}` : code);
  error.code = code;
  if (phase) error.phase = phase;
  return error;
}

function requireProfileMutationOperation(operation) {
  if (
    operation !== PROFILE_RESET_LIFECYCLE_OPERATIONS.FULL_RESET
    && operation !== PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT
  ) {
    throw createTrackingProfileMutationError(
      'TRACKING_PROFILE_MUTATION_OPERATION_INVALID',
    );
  }
  return operation;
}

export function createTrackingProfileMutationAdmissionOwner() {
  let phase = TRACKING_PROFILE_MUTATION_PHASES.OPEN;
  let operation = null;

  function assertOpen() {
    if (phase !== TRACKING_PROFILE_MUTATION_PHASES.OPEN) {
      throw createTrackingProfileMutationError(
        'TRACKING_PROFILE_MUTATION_ADMISSION_CLOSED',
        phase,
      );
    }
  }

  function assertDrainingOrQuiesced() {
    if (
      phase !== TRACKING_PROFILE_MUTATION_PHASES.QUIESCING
      && phase !== TRACKING_PROFILE_MUTATION_PHASES.QUIESCED
    ) {
      throw createTrackingProfileMutationError(
        'TRACKING_PROFILE_MUTATION_DRAIN_REQUIRES_CLOSED_ADMISSION',
        phase,
      );
    }
  }

  function assertQuiesced() {
    if (phase !== TRACKING_PROFILE_MUTATION_PHASES.QUIESCED) {
      throw createTrackingProfileMutationError(
        'TRACKING_TERMINAL_PROFILE_MUTATION_RESET_REQUIRES_QUIESCED',
        phase,
      );
    }
  }

  function beginQuiesce(nextOperation) {
    const normalizedOperation = requireProfileMutationOperation(nextOperation);
    if (operation !== null && operation !== normalizedOperation) {
      throw createTrackingProfileMutationError(
        'TRACKING_PROFILE_MUTATION_OPERATION_CHANGED',
      );
    }
    if (phase === TRACKING_PROFILE_MUTATION_PHASES.QUIESCING) return 'in_progress';
    if (phase === TRACKING_PROFILE_MUTATION_PHASES.QUIESCED) return 'complete';
    if (
      phase !== TRACKING_PROFILE_MUTATION_PHASES.OPEN
      && phase !== TRACKING_PROFILE_MUTATION_PHASES.QUIESCE_FAILED
    ) {
      throw createTrackingProfileMutationError(
        'TRACKING_PROFILE_MUTATION_PHASE_INVALID',
        phase,
      );
    }
    operation = normalizedOperation;
    phase = TRACKING_PROFILE_MUTATION_PHASES.QUIESCING;
    return 'started';
  }

  function completeQuiesce() {
    if (phase !== TRACKING_PROFILE_MUTATION_PHASES.QUIESCING) {
      throw createTrackingProfileMutationError(
        'TRACKING_PROFILE_MUTATION_QUIESCE_COMPLETION_INVALID',
        phase,
      );
    }
    phase = TRACKING_PROFILE_MUTATION_PHASES.QUIESCED;
  }

  function failQuiesce() {
    if (phase === TRACKING_PROFILE_MUTATION_PHASES.QUIESCING) {
      phase = TRACKING_PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
    }
  }

  return Object.freeze({
    assertDrainingOrQuiesced,
    assertOpen,
    assertQuiesced,
    beginQuiesce,
    completeQuiesce,
    failQuiesce,
    getPhase: () => phase,
  });
}
