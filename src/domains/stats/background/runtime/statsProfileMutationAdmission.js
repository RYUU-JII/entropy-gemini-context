import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';

export const STATS_PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
  QUIESCE_FAILED: 'quiesce_failed',
});

export function createStatsProfileMutationError(code, phase = null) {
  const error = new Error(phase ? `${code}:${phase}` : code);
  error.code = code;
  if (phase) error.phase = phase;
  return error;
}

function requireStatsProfileMutationOperation(operation) {
  if (
    operation !== PROFILE_RESET_LIFECYCLE_OPERATIONS.FULL_RESET
    && operation !== PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT
  ) {
    throw createStatsProfileMutationError('STATS_PROFILE_MUTATION_OPERATION_INVALID');
  }
  return operation;
}

export function createStatsProfileMutationAdmissionOwner() {
  let phase = STATS_PROFILE_MUTATION_PHASES.OPEN;
  let operation = null;

  function assertOpen() {
    if (phase !== STATS_PROFILE_MUTATION_PHASES.OPEN) {
      throw createStatsProfileMutationError(
        'STATS_PROFILE_MUTATION_ADMISSION_CLOSED',
        phase,
      );
    }
  }

  function beginQuiesce(nextOperation) {
    const normalizedOperation = requireStatsProfileMutationOperation(nextOperation);
    if (operation !== null && operation !== normalizedOperation) {
      throw createStatsProfileMutationError('STATS_PROFILE_MUTATION_OPERATION_CHANGED');
    }
    if (phase === STATS_PROFILE_MUTATION_PHASES.QUIESCING) return 'in_progress';
    if (phase === STATS_PROFILE_MUTATION_PHASES.QUIESCED) return 'complete';
    if (
      phase !== STATS_PROFILE_MUTATION_PHASES.OPEN
      && phase !== STATS_PROFILE_MUTATION_PHASES.QUIESCE_FAILED
    ) {
      throw createStatsProfileMutationError(
        'STATS_PROFILE_MUTATION_PHASE_INVALID',
        phase,
      );
    }
    operation = normalizedOperation;
    phase = STATS_PROFILE_MUTATION_PHASES.QUIESCING;
    return 'started';
  }

  function completeQuiesce() {
    if (phase !== STATS_PROFILE_MUTATION_PHASES.QUIESCING) {
      throw createStatsProfileMutationError(
        'STATS_PROFILE_MUTATION_QUIESCE_COMPLETION_INVALID',
        phase,
      );
    }
    phase = STATS_PROFILE_MUTATION_PHASES.QUIESCED;
  }

  function failQuiesce() {
    if (phase === STATS_PROFILE_MUTATION_PHASES.QUIESCING) {
      phase = STATS_PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
    }
  }

  function assertQuiesced() {
    if (phase !== STATS_PROFILE_MUTATION_PHASES.QUIESCED) {
      throw createStatsProfileMutationError(
        'STATS_TERMINAL_PROFILE_MUTATION_RESET_REQUIRES_QUIESCED',
        phase,
      );
    }
  }

  return Object.freeze({
    assertOpen,
    assertQuiesced,
    beginQuiesce,
    completeQuiesce,
    failQuiesce,
    getPhase: () => phase,
  });
}
