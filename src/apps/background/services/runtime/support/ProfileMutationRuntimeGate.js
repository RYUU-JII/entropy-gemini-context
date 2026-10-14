import {
  PROFILE_RESET_LIFECYCLE_STATUS,
  isProfileResetWriteAdmissionClosed,
  normalizeProfileResetLifecycleState,
  resolveProfileResetGeneration,
} from '../../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';

function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
  return value;
}

function requireLabel(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('PROFILE_MUTATION_RUNTIME_ADMISSION_LABEL_INVALID');
  }
  return value;
}

function requireResetId(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('PROFILE_MUTATION_RUNTIME_ADMISSION_RESET_ID_INVALID');
  }
  return value;
}

function createAdmissionClosedError({ label, resetId, phase, lifecycle = null }) {
  const error = new Error(
    `PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED:${label}:${phase}:${resetId || 'unknown'}`,
  );
  error.code = 'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED';
  error.label = label;
  error.phase = phase;
  error.resetId = resetId;
  error.lifecycle = lifecycle;
  return error;
}

function createAdmissionGenerationChangedError({
  label,
  expectedProfileGeneration,
  observedProfileGeneration,
  expectedFenceRevision,
  observedFenceRevision,
}) {
  const error = new Error(
    `PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED:${label}`,
  );
  error.code = 'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED';
  if (expectedProfileGeneration !== undefined) {
    error.expectedProfileGeneration = expectedProfileGeneration;
  }
  if (observedProfileGeneration !== undefined) {
    error.observedProfileGeneration = observedProfileGeneration;
  }
  if (expectedFenceRevision !== undefined) {
    error.expectedFenceRevision = expectedFenceRevision;
  }
  if (observedFenceRevision !== undefined) {
    error.observedFenceRevision = observedFenceRevision;
  }
  return error;
}

export function createProfileMutationRuntimeGate({
  readLifecycle,
} = {}) {
  const readOwnedLifecycle = requireFunction(
    readLifecycle,
    'PROFILE_MUTATION_RUNTIME_LIFECYCLE_READER_REQUIRED',
  );
  let phase = 'open';
  let closedResetId = null;
  let fenceRevision = 0;
  let activeLeaseCount = 0;
  let drainWaiters = [];
  const capturedAdmissions = new WeakSet();

  function settleDrainWaiters() {
    if (activeLeaseCount !== 0 || drainWaiters.length === 0) return;
    const waiters = drainWaiters;
    drainWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  function rejectLocalAdmission(label) {
    if (phase === 'open') return;
    throw createAdmissionClosedError({
      label,
      resetId: closedResetId,
      phase,
    });
  }

  function assertFenceRevision({ label, expectedFenceRevision }) {
    if (fenceRevision === expectedFenceRevision) return;
    throw createAdmissionGenerationChangedError({
      label,
      expectedFenceRevision,
      observedFenceRevision: fenceRevision,
    });
  }

  function acquireLocal({ label: rawLabel } = {}) {
    const label = requireLabel(rawLabel);
    rejectLocalAdmission(label);
    activeLeaseCount += 1;
    let released = false;
    return () => {
      if (released) {
        throw new Error(`PROFILE_MUTATION_RUNTIME_LEASE_ALREADY_RELEASED:${label}`);
      }
      released = true;
      activeLeaseCount -= 1;
      if (activeLeaseCount < 0) {
        throw new Error('PROFILE_MUTATION_RUNTIME_LEASE_COUNT_INVALID');
      }
      settleDrainWaiters();
    };
  }

  async function acquire({ label: rawLabel } = {}) {
    const label = requireLabel(rawLabel);
    rejectLocalAdmission(label);
    const expectedFenceRevision = fenceRevision;

    const lifecycle = await readOwnedLifecycle();
    rejectLocalAdmission(label);
    assertFenceRevision({ label, expectedFenceRevision });
    if (isProfileResetWriteAdmissionClosed(lifecycle)) {
      throw createAdmissionClosedError({
        label,
        resetId: lifecycle.resetId,
        phase: lifecycle.status,
        lifecycle,
      });
    }

    // acquireLocal performs the final synchronous phase check. Together with
    // the revision comparison above, a close -> reopen ABA during the durable
    // read cannot admit pre-close ingress into the reopened generation.
    return acquireLocal({ label });
  }

  async function capture({ label: rawLabel } = {}) {
    const label = requireLabel(rawLabel);
    rejectLocalAdmission(label);
    const expectedFenceRevision = fenceRevision;
    const lifecycle = await readOwnedLifecycle();
    rejectLocalAdmission(label);
    assertFenceRevision({ label, expectedFenceRevision });
    if (isProfileResetWriteAdmissionClosed(lifecycle)) {
      throw createAdmissionClosedError({
        label,
        resetId: lifecycle.resetId,
        phase: lifecycle.status,
        lifecycle,
      });
    }
    const admission = Object.freeze({
      label,
      profileGeneration: resolveProfileResetGeneration(lifecycle),
      fenceRevision: expectedFenceRevision,
    });
    capturedAdmissions.add(admission);
    return admission;
  }

  async function acquireCaptured({ admission } = {}) {
    if (!admission || !capturedAdmissions.has(admission)) {
      throw new Error('PROFILE_MUTATION_RUNTIME_CAPTURED_ADMISSION_INVALID');
    }
    capturedAdmissions.delete(admission);
    rejectLocalAdmission(admission.label);
    assertFenceRevision({
      label: admission.label,
      expectedFenceRevision: admission.fenceRevision,
    });
    const lifecycle = await readOwnedLifecycle();
    rejectLocalAdmission(admission.label);
    assertFenceRevision({
      label: admission.label,
      expectedFenceRevision: admission.fenceRevision,
    });
    if (isProfileResetWriteAdmissionClosed(lifecycle)) {
      throw createAdmissionClosedError({
        label: admission.label,
        resetId: lifecycle.resetId,
        phase: lifecycle.status,
        lifecycle,
      });
    }
    const observedProfileGeneration = resolveProfileResetGeneration(lifecycle);
    if (observedProfileGeneration !== admission.profileGeneration) {
      throw createAdmissionGenerationChangedError({
        label: admission.label,
        expectedProfileGeneration: admission.profileGeneration,
        observedProfileGeneration,
      });
    }
    return acquireLocal({ label: admission.label });
  }

  async function runCaptured({ admission, task } = {}) {
    const admittedTask = requireFunction(
      task,
      'PROFILE_MUTATION_RUNTIME_ADMITTED_TASK_REQUIRED',
    );
    const release = await acquireCaptured({ admission });
    try {
      return await admittedTask();
    } finally {
      release();
    }
  }

  async function runAdmitted({ label, task } = {}) {
    const admittedTask = requireFunction(
      task,
      'PROFILE_MUTATION_RUNTIME_ADMITTED_TASK_REQUIRED',
    );
    const release = await acquire({ label });
    try {
      return await admittedTask();
    } finally {
      release();
    }
  }

  function runAdmittedLocal({ label, task } = {}) {
    const admittedTask = requireFunction(
      task,
      'PROFILE_MUTATION_RUNTIME_ADMITTED_TASK_REQUIRED',
    );
    const release = acquireLocal({ label });
    return Promise.resolve()
      .then(admittedTask)
      .finally(release);
  }

  function closeAndDrain({ resetId, recovered = false } = {}) {
    const nextResetId = requireResetId(resetId);
    if (typeof recovered !== 'boolean') {
      throw new Error('PROFILE_MUTATION_RUNTIME_GATE_RECOVERY_FLAG_INVALID');
    }
    if (phase === 'failed' && recovered === true) {
      if (activeLeaseCount !== 0) {
        throw new Error('PROFILE_MUTATION_RUNTIME_GATE_RECOVERY_WITH_ACTIVE_LEASES');
      }
      fenceRevision += 1;
      phase = 'draining';
      closedResetId = nextResetId;
      return Promise.resolve();
    }
    if (phase !== 'open') {
      throw new Error(
        `PROFILE_MUTATION_RUNTIME_GATE_ALREADY_CLOSED:${phase}:${closedResetId || 'unknown'}`,
      );
    }
    fenceRevision += 1;
    phase = 'draining';
    closedResetId = nextResetId;
    if (activeLeaseCount === 0) return Promise.resolve();
    return new Promise((resolve) => {
      drainWaiters.push(resolve);
    });
  }

  function sealForRuntimeReload({ lifecycle } = {}) {
    const normalized = normalizeProfileResetLifecycleState(lifecycle);
    if (phase !== 'draining') {
      throw new Error(`PROFILE_MUTATION_RUNTIME_GATE_RELOAD_SEAL_NOT_DRAINING:${phase}`);
    }
    if (activeLeaseCount !== 0) {
      throw new Error('PROFILE_MUTATION_RUNTIME_GATE_RELOAD_SEAL_WITH_ACTIVE_LEASES');
    }
    if (
      normalized.status !== PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE
      || normalized.resetId !== closedResetId
    ) {
      throw new Error('PROFILE_MUTATION_RUNTIME_GATE_RELOAD_SEAL_GENERATION_INVALID');
    }
    fenceRevision += 1;
    phase = 'reload_pending';
  }

  function failClosed({ resetId } = {}) {
    const failedResetId = requireResetId(resetId);
    if (phase !== 'draining' || closedResetId !== failedResetId) {
      throw new Error('PROFILE_MUTATION_RUNTIME_GATE_FAILURE_GENERATION_INVALID');
    }
    if (activeLeaseCount !== 0) {
      throw new Error('PROFILE_MUTATION_RUNTIME_GATE_FAILURE_WITH_ACTIVE_LEASES');
    }
    fenceRevision += 1;
    phase = 'failed';
  }

  function getSnapshot() {
    return Object.freeze({
      phase,
      closedResetId,
      activeLeaseCount,
    });
  }

  return Object.freeze({
    acquireLocal,
    acquire,
    capture,
    acquireCaptured,
    runCaptured,
    runAdmitted,
    runAdmittedLocal,
    closeAndDrain,
    sealForRuntimeReload,
    failClosed,
    getSnapshot,
  });
}

export default createProfileMutationRuntimeGate;
