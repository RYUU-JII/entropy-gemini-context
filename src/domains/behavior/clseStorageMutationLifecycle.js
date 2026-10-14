function requireLifecycleFunction(fn, errorCode) {
  if (typeof fn !== 'function') throw new Error(errorCode);
  return fn;
}

function createRecoveryError(code, cause) {
  const error = new Error(code);
  error.code = code;
  error.cause = cause;
  return error;
}

async function runRecoveryStep(task, errorCode) {
  try {
    await task();
    return null;
  } catch (cause) {
    return createRecoveryError(errorCode, cause);
  }
}

/**
 * One fail-loud lifecycle for build-selected CLSE storage mutations that may
 * replace the baseline epoch. The primary mutation error remains canonical;
 * a recovery failure is attached without hiding it. A successful mutation
 * cannot be reported when baseline reload or required runtime resume fails.
 */
export async function runCLSEStorageMutationLifecycle({
  mutationTask,
  quiesce,
  reloadBaseline,
  resume,
} = {}) {
  requireLifecycleFunction(mutationTask, 'CLSE_STORAGE_MUTATION_TASK_REQUIRED');
  requireLifecycleFunction(quiesce, 'CLSE_STORAGE_MUTATION_QUIESCE_REQUIRED');
  requireLifecycleFunction(reloadBaseline, 'CLSE_STORAGE_MUTATION_RELOAD_REQUIRED');
  requireLifecycleFunction(resume, 'CLSE_STORAGE_MUTATION_RESUME_REQUIRED');

  let result;
  let primaryError = null;
  try {
    await quiesce();
    result = await mutationTask();
  } catch (error) {
    primaryError = error;
  }

  let recoveryError = await runRecoveryStep(
    reloadBaseline,
    'CLSE_STORAGE_MUTATION_BASELINE_RELOAD_FAILED',
  );
  if (recoveryError === null) {
    recoveryError = await runRecoveryStep(
      resume,
      'CLSE_STORAGE_MUTATION_RUNTIME_RESUME_FAILED',
    );
  }

  if (primaryError) {
    if (recoveryError) primaryError.clseStorageRecoveryError = recoveryError;
    throw primaryError;
  }
  if (recoveryError) throw recoveryError;
  return result;
}
