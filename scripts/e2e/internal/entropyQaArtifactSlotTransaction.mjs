import fs from 'node:fs/promises';
import path from 'node:path';

function requireAbsoluteDistinctPath(value, code, seen) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${code}:${String(value || '')}`);
  }
  const normalized = path.normalize(value);
  if (seen.has(normalized)) throw new Error(`${code}_DUPLICATE:${normalized}`);
  seen.add(normalized);
  return normalized;
}

function createTransactionFailure(code, cause, stage) {
  const error = new Error(code, { cause });
  error.code = code;
  error.stage = stage;
  return error;
}

export async function publishEntropyQaArtifactSlotTransaction({
  slotDir,
  stagingDir,
  retiredDir,
  retireExisting,
} = {}, {
  rename = fs.rename,
  remove = fs.rm,
} = {}) {
  if (typeof rename !== 'function' || typeof remove !== 'function') {
    throw new Error('ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_OPERATIONS_INVALID');
  }
  if (typeof retireExisting !== 'boolean') {
    throw new Error('ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_RETIRE_POLICY_INVALID');
  }
  const seen = new Set();
  const canonicalSlotDir = requireAbsoluteDistinctPath(
    slotDir,
    'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_SLOT_INVALID',
    seen,
  );
  const preparedStagingDir = requireAbsoluteDistinctPath(
    stagingDir,
    'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_STAGING_INVALID',
    seen,
  );
  const preservedRetiredDir = requireAbsoluteDistinctPath(
    retiredDir,
    'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_RETIRED_INVALID',
    seen,
  );
  let retired = false;
  let published = false;
  try {
    if (retireExisting) {
      await rename(canonicalSlotDir, preservedRetiredDir);
      retired = true;
    }
    await rename(preparedStagingDir, canonicalSlotDir);
    published = true;
  } catch (cause) {
    const publishFailure = createTransactionFailure(
      'ENTROPY_QA_ARTIFACT_SLOT_PUBLISH_FAILED',
      cause,
      'artifact_slot_publish',
    );
    if (!retired || published) throw publishFailure;
    try {
      await rename(preservedRetiredDir, canonicalSlotDir);
      retired = false;
    } catch (rollbackCause) {
      const rollbackFailure = createTransactionFailure(
        'ENTROPY_QA_ARTIFACT_SLOT_ROLLBACK_FAILED',
        rollbackCause,
        'artifact_slot_rollback',
      );
      const transactionFailure = new AggregateError(
        [publishFailure, rollbackFailure],
        'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_RECOVERY_FAILED',
      );
      transactionFailure.code = 'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_RECOVERY_FAILED';
      transactionFailure.stage = 'artifact_slot_rollback';
      transactionFailure.recovery = Object.freeze({
        status: 'retired_slot_preserved',
        retiredSlotPreserved: true,
      });
      throw transactionFailure;
    }
    throw publishFailure;
  }
  if (retired) {
    try {
      await remove(preservedRetiredDir, { recursive: true, force: false });
      retired = false;
    } catch (cause) {
      const cleanupFailure = createTransactionFailure(
        'ENTROPY_QA_ARTIFACT_SLOT_RETIRED_CLEANUP_FAILED',
        cause,
        'artifact_slot_retired_cleanup',
      );
      cleanupFailure.recovery = Object.freeze({
        status: 'published_slot_active_retired_slot_preserved',
        retiredSlotPreserved: true,
      });
      throw cleanupFailure;
    }
  }
  return Object.freeze({
    status: 'artifact_slot_published',
    previousSlotRetired: retireExisting,
    published,
  });
}
