function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
  return value;
}

function resolveNamedErrorCode(error, fallbackCode) {
  if (
    typeof error?.code === 'string'
    && error.code.trim()
    && error.code.trim() === error.code
  ) {
    return error.code;
  }
  return fallbackCode;
}

function buildCLSERuntimeMessageFailure(error, {
  taskStarted,
  responseCommitStarted,
} = {}) {
  if (responseCommitStarted) {
    return Object.freeze({
      received: false,
      reason: 'response_commit_failed',
      error: 'CLSE_PROFILE_MUTATION_RUNTIME_RESPONSE_COMMIT_FAILED',
    });
  }
  if (taskStarted) {
    return Object.freeze({
      received: false,
      reason: 'collector_task_failed',
      error: resolveNamedErrorCode(
        error,
        'CLSE_PROFILE_MUTATION_RUNTIME_TASK_FAILED',
      ),
    });
  }
  return Object.freeze({
    received: false,
    reason: 'profile_mutation_admission_rejected',
    error: resolveNamedErrorCode(
      error,
      'CLSE_PROFILE_MUTATION_RUNTIME_ADMISSION_FAILED',
    ),
  });
}

export function createCLSEProfileMutationRuntimeAdmission({
  captureAdmission,
  runCapturedTask,
} = {}) {
  return Object.freeze({
    captureAdmission: requireFunction(
      captureAdmission,
      'CLSE_PROFILE_MUTATION_RUNTIME_CAPTURE_REQUIRED',
    ),
    runCapturedTask: requireFunction(
      runCapturedTask,
      'CLSE_PROFILE_MUTATION_RUNTIME_RUN_CAPTURED_REQUIRED',
    ),
  });
}

export function requireCLSEProfileMutationRuntimeAdmission(owner) {
  if (
    !owner
    || typeof owner.captureAdmission !== 'function'
    || typeof owner.runCapturedTask !== 'function'
  ) {
    throw new Error('CLSE_PROFILE_MUTATION_RUNTIME_ADMISSION_REQUIRED');
  }
  return owner;
}

/**
 * The capture call intentionally happens before the first Promise turn. That
 * pins a Chrome ingress to the generation observed at listener arrival; the
 * shared runtime gate then either leases that exact generation or rejects it.
 */
export function runCLSEProfileMutationIngress(owner, {
  label,
  task,
} = {}) {
  const admissionOwner = requireCLSEProfileMutationRuntimeAdmission(owner);
  const admittedTask = requireFunction(
    task,
    'CLSE_PROFILE_MUTATION_RUNTIME_TASK_REQUIRED',
  );
  const admissionPromise = admissionOwner.captureAdmission({ label });
  return Promise.resolve(admissionPromise).then((admission) => (
    admissionOwner.runCapturedTask({ admission, task: admittedTask })
  ));
}

/** Response-bearing runtime.onMessage ingress keeps its Chrome channel open
 * while the admitted task and successful response commit share one lease. */
export function runCLSEProfileMutationMessageIngress(owner, {
  label,
  task,
  sendResponse,
} = {}) {
  const responseOwner = requireFunction(
    sendResponse,
    'CLSE_PROFILE_MUTATION_RUNTIME_RESPONSE_OWNER_REQUIRED',
  );
  const responseTask = requireFunction(
    task,
    'CLSE_PROFILE_MUTATION_RUNTIME_TASK_REQUIRED',
  );
  let taskStarted = false;
  let responseCommitStarted = false;
  const pending = runCLSEProfileMutationIngress(owner, {
    label,
    task: async () => {
      taskStarted = true;
      const response = await responseTask();
      responseCommitStarted = true;
      responseOwner(response);
      return response;
    },
  });
  void pending.catch((error) => {
    const failureResponse = buildCLSERuntimeMessageFailure(error, {
      taskStarted,
      responseCommitStarted,
    });
    console.error('[CLSE] Runtime message ingress failed:', {
      label,
      reason: failureResponse.reason,
      error: failureResponse.error,
    }, error);
    try {
      responseOwner(failureResponse);
    } catch (responseError) {
      console.error('[CLSE] Runtime failure response commit failed:', {
        label,
        error: 'CLSE_PROFILE_MUTATION_RUNTIME_FAILURE_RESPONSE_COMMIT_FAILED',
      }, responseError);
    }
  });
  return true;
}

export default createCLSEProfileMutationRuntimeAdmission;
