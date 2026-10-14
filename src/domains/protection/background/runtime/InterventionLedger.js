import {
  INTERVENTION_LEDGER_CAPACITY,
  INTERVENTION_PHASES,
} from '../../contracts/interventionLedgerContract.js';

const REQUIRED_REPOSITORY_METHODS = Object.freeze([
  'append',
  'readRecent',
  'readState',
]);

function requireRepository(interventionLedgerRepository) {
  const missingMethod = REQUIRED_REPOSITORY_METHODS
    .find((method) => typeof interventionLedgerRepository?.[method] !== 'function');
  if (missingMethod) {
    throw new Error(`INTERVENTION_LEDGER_REPOSITORY_METHOD_REQUIRED:${missingMethod}`);
  }
  return interventionLedgerRepository;
}

function requireFunction(value, errorCode) {
  if (typeof value !== 'function') {
    throw new Error(errorCode);
  }
  return value;
}

function toErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : String(error || 'UNKNOWN_ERROR');
}

function summarizeDrafts(drafts) {
  return drafts.map((draft) => ({
    surfaceId: draft?.surfaceId ?? null,
    phase: draft?.phase ?? null,
  }));
}

/**
 * Single background-owned record of every interruption the app offers, shows,
 * suppresses, or resolves.
 *
 * Step 1 is write-only observation: nothing in this module decides whether an
 * intervention happens. Cooldown, causal exemption, and saturation policy read
 * from here in later steps, which is why every write is serialized and
 * sequence-stamped rather than best-effort appended.
 */
export function createInterventionLedger({
  interventionLedgerRepository,
  recordDiagnostic,
  runProfileMutationAdmittedTask,
} = {}) {
  const repository = requireRepository(interventionLedgerRepository);
  const recordLedgerDiagnostic = requireFunction(
    recordDiagnostic,
    'INTERVENTION_LEDGER_DIAGNOSTICS_REQUIRED',
  );
  const runAdmittedTask = requireFunction(
    runProfileMutationAdmittedTask,
    'INTERVENTION_LEDGER_PROFILE_MUTATION_RUNTIME_TASK_OWNER_REQUIRED',
  );

  function normalizeDrafts(draftOrDrafts) {
    const drafts = Array.isArray(draftOrDrafts) ? draftOrDrafts : [draftOrDrafts];
    if (!drafts.length) {
      throw new Error('INTERVENTION_LEDGER_APPEND_DRAFTS_REQUIRED');
    }
    return drafts;
  }

  async function record(draftOrDrafts) {
    const drafts = normalizeDrafts(draftOrDrafts);
    const ownedTask = runAdmittedTask({
      label: `intervention_ledger:append:${drafts.length}`,
      task: () => repository.append(drafts),
    });
    if (!ownedTask || typeof ownedTask.then !== 'function') {
      throw new Error('INTERVENTION_LEDGER_PROFILE_MUTATION_RUNTIME_TASK_INVALID');
    }
    return ownedTask;
  }

  /**
   * Fire-and-forget write for call sites on an intervention's critical path.
   * A ledger failure must never cancel the intervention it is observing, but it
   * must never disappear either: failures surface as a diagnostic.
   */
  function recordDetached(draftOrDrafts) {
    let pending;
    try {
      pending = record(draftOrDrafts);
    } catch (error) {
      recordLedgerDiagnostic('intervention_ledger_record_rejected', {
        drafts: summarizeDrafts(normalizeDrafts(draftOrDrafts)),
        error: toErrorMessage(error),
      });
      return;
    }
    void pending.catch((error) => {
      recordLedgerDiagnostic('intervention_ledger_record_failed', {
        drafts: summarizeDrafts(normalizeDrafts(draftOrDrafts)),
        error: toErrorMessage(error),
      });
    });
  }

  function readRecent(options = {}) {
    return repository.readRecent(options);
  }

  function readState() {
    return repository.readState();
  }

  return Object.freeze({
    capacity: INTERVENTION_LEDGER_CAPACITY,
    phases: INTERVENTION_PHASES,
    readRecent,
    readState,
    record,
    recordDetached,
  });
}

export default createInterventionLedger;
