import {
  addChromeStorageChangedListener,
  removeChromeStorageChangedListener,
} from '../internal/chrome-storage/storageChangeBus.js';
import ProfileResetLifecycleStore, {
  PROFILE_RESET_LIFECYCLE_STORAGE_KEY,
} from '../internal/chrome-storage/stores/ProfileResetLifecycleStore.js';
import {
  MODEL_STATE_INITIAL_PROFILE_EPOCH,
} from '../model/ProfileEpochContract.js';

export const PROFILE_RESET_LIFECYCLE_CONTRACT = 'profile_reset_lifecycle_v1';
export const PROFILE_RESET_LIFECYCLE_STATUS = Object.freeze({
  RESETTING: 'resetting',
  COMMITTED: 'committed',
  COMPLETE: 'complete',
  FAILED: 'failed',
});
export const PROFILE_RESET_LIFECYCLE_OPERATIONS = Object.freeze({
  FULL_RESET: 'full_reset',
  SNAPSHOT_IMPORT: 'snapshot_import',
});

const EXACT_LIFECYCLE_KEYS = Object.freeze([
  'contract',
  'resetId',
  'operation',
  'status',
  'startedAt',
  'completedAt',
  'failureCode',
]);

const lifecycleWriteAttempts = new WeakMap();

export function getProfileResetLifecycleWriteAttempt(error, repository) {
  const owned = lifecycleWriteAttempts.get(error);
  if (!owned || owned.repository !== repository) return null;
  return owned.attempt;
}

function areLifecycleStatesEqual(left, right) {
  if (left === null || right === null) return left === right;
  return EXACT_LIFECYCLE_KEYS.every((key) => left[key] === right[key]);
}

async function writeInitialResetLifecycle(repository, next, previousLifecycle) {
  try {
    await repository.lifecycleStore.write(next);
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause), { cause });
    // Only a downstream write attempt owns this receipt. Validation/admission
    // failures must never make the coordinator terminate an open runtime.
    lifecycleWriteAttempts.set(error, {
      repository,
      attempt: Object.freeze({ lifecycle: next, previousLifecycle }),
    });
    throw error;
  }
  return next;
}

const hasExactKeys = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...EXACT_LIFECYCLE_KEYS].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
};

const isNonNegativeSafeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

const createLifecycleContractError = (reason) => {
  const error = new Error(`PROFILE_RESET_LIFECYCLE_STATE_INVALID:${reason}`);
  error.code = 'PROFILE_RESET_LIFECYCLE_STATE_INVALID';
  error.reason = reason;
  return error;
};

export function normalizeProfileResetLifecycleState(value) {
  if (!hasExactKeys(value)) throw createLifecycleContractError('shape');
  if (value.contract !== PROFILE_RESET_LIFECYCLE_CONTRACT) {
    throw createLifecycleContractError('contract');
  }
  if (typeof value.resetId !== 'string' || !value.resetId.trim()) {
    throw createLifecycleContractError('reset_id');
  }
  if (!Object.values(PROFILE_RESET_LIFECYCLE_OPERATIONS).includes(value.operation)) {
    throw createLifecycleContractError('operation');
  }
  if (!Object.values(PROFILE_RESET_LIFECYCLE_STATUS).includes(value.status)) {
    throw createLifecycleContractError('status');
  }
  if (!isNonNegativeSafeInteger(value.startedAt)) {
    throw createLifecycleContractError('started_at');
  }

  if (
    value.status === PROFILE_RESET_LIFECYCLE_STATUS.RESETTING
    || value.status === PROFILE_RESET_LIFECYCLE_STATUS.COMMITTED
  ) {
    if (value.completedAt !== null || value.failureCode !== null) {
      throw createLifecycleContractError('active_terminal_fields');
    }
  } else {
    if (
      !isNonNegativeSafeInteger(value.completedAt)
      || value.completedAt < value.startedAt
    ) {
      throw createLifecycleContractError('completed_at');
    }
    if (value.status === PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE) {
      if (value.failureCode !== null) {
        throw createLifecycleContractError('complete_failure_code');
      }
    } else if (typeof value.failureCode !== 'string' || !value.failureCode.trim()) {
      throw createLifecycleContractError('failure_code');
    }
  }

  return Object.freeze({
    contract: value.contract,
    resetId: value.resetId,
    operation: value.operation,
    status: value.status,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
    failureCode: value.failureCode,
  });
}

export const resolveProfileResetGeneration = (lifecycle) => (
  lifecycle === null
    ? MODEL_STATE_INITIAL_PROFILE_EPOCH
    : normalizeProfileResetLifecycleState(lifecycle).resetId
);

export const isProfileResetWriteAdmissionClosed = (lifecycle) => {
  if (lifecycle === null) return false;
  const normalized = normalizeProfileResetLifecycleState(lifecycle);
  return normalized.status !== PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE;
};

const createResetId = (startedAt) => {
  const cryptoApi = globalThis?.crypto;
  if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
    throw new Error('PROFILE_RESET_LIFECYCLE_RANDOM_UUID_UNAVAILABLE');
  }
  return `profile-reset:${startedAt}:${cryptoApi.randomUUID()}`;
};

const createAdmissionError = (code, lifecycle) => {
  const suffix = lifecycle ? `:${lifecycle.status}` : '';
  const error = new Error(`${code}${suffix}`);
  error.code = code;
  error.lifecycle = lifecycle;
  return error;
};

export class ProfileResetLifecycleRepository {
  static getInstance() {
    if (!ProfileResetLifecycleRepository.instance) {
      ProfileResetLifecycleRepository.instance = new ProfileResetLifecycleRepository();
    }
    return ProfileResetLifecycleRepository.instance;
  }

  constructor({
    lifecycleStore = ProfileResetLifecycleStore.getInstance(),
    createResetId: createResetIdOwner = createResetId,
    addChangedListener = addChromeStorageChangedListener,
    removeChangedListener = removeChromeStorageChangedListener,
  } = {}) {
    if (
      !lifecycleStore
      || typeof lifecycleStore.readOptional !== 'function'
      || typeof lifecycleStore.write !== 'function'
    ) {
      throw new Error('PROFILE_RESET_LIFECYCLE_STORE_REQUIRED');
    }
    if (typeof createResetIdOwner !== 'function') {
      throw new Error('PROFILE_RESET_LIFECYCLE_ID_OWNER_REQUIRED');
    }
    this.lifecycleStore = lifecycleStore;
    this.createResetId = createResetIdOwner;
    this.addChangedListener = addChangedListener;
    this.removeChangedListener = removeChangedListener;
    this.mutationTail = Promise.resolve();
  }

  enqueueMutation(task) {
    const queued = this.mutationTail.then(task, task);
    this.mutationTail = queued.catch(() => undefined);
    return queued;
  }

  async read() {
    const result = await this.lifecycleStore.readOptional();
    if (!result || typeof result.found !== 'boolean') {
      throw new Error('PROFILE_RESET_LIFECYCLE_READ_RESULT_INVALID');
    }
    return result.found
      ? normalizeProfileResetLifecycleState(result.value)
      : null;
  }

  beginReset({
    operation,
    startedAt = Date.now(),
    resetId = null,
  } = {}) {
    return this.enqueueMutation(async () => {
      if (!isNonNegativeSafeInteger(startedAt)) {
        throw new Error('PROFILE_RESET_LIFECYCLE_STARTED_AT_INVALID');
      }
      const current = await this.read();
      if (
        current?.status === PROFILE_RESET_LIFECYCLE_STATUS.RESETTING
        || current?.status === PROFILE_RESET_LIFECYCLE_STATUS.COMMITTED
      ) {
        throw createAdmissionError('PROFILE_RESET_ALREADY_IN_PROGRESS', current);
      }
      const next = normalizeProfileResetLifecycleState({
        contract: PROFILE_RESET_LIFECYCLE_CONTRACT,
        resetId: resetId || this.createResetId(startedAt),
        operation,
        status: PROFILE_RESET_LIFECYCLE_STATUS.RESETTING,
        startedAt,
        completedAt: null,
        failureCode: null,
      });
      return writeInitialResetLifecycle(this, next, current);
    });
  }

  recoverInterruptedReset({
    operation,
    startedAt = Date.now(),
    resetId = null,
  } = {}) {
    return this.enqueueMutation(async () => {
      if (!isNonNegativeSafeInteger(startedAt)) {
        throw new Error('PROFILE_RESET_LIFECYCLE_STARTED_AT_INVALID');
      }
      const current = await this.read();
      if (current === null || current.status === PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE) {
        throw createAdmissionError('PROFILE_RESET_RECOVERY_NOT_REQUIRED', current);
      }
      const next = normalizeProfileResetLifecycleState({
        contract: PROFILE_RESET_LIFECYCLE_CONTRACT,
        resetId: resetId || this.createResetId(startedAt),
        operation,
        status: PROFILE_RESET_LIFECYCLE_STATUS.RESETTING,
        startedAt,
        completedAt: null,
        failureCode: null,
      });
      return writeInitialResetLifecycle(this, next, current);
    });
  }

  failResetWriteAttempt({ error, completedAt = Date.now(), failureCode } = {}) {
    return this.enqueueMutation(async () => {
      const ownedAttempt = lifecycleWriteAttempts.get(error);
      if (!ownedAttempt || ownedAttempt.repository !== this) {
        throw new Error('PROFILE_RESET_LIFECYCLE_WRITE_ATTEMPT_REQUIRED');
      }
      lifecycleWriteAttempts.delete(error);
      const { lifecycle: attempted, previousLifecycle } = ownedAttempt.attempt;
      const current = await this.read();
      if (
        !areLifecycleStatesEqual(current, attempted)
        && !areLifecycleStatesEqual(current, previousLifecycle)
      ) {
        throw createAdmissionError('PROFILE_RESET_LIFECYCLE_WRITE_ATTEMPT_STALE', current);
      }
      const failed = normalizeProfileResetLifecycleState({
        ...attempted,
        status: PROFILE_RESET_LIFECYCLE_STATUS.FAILED,
        completedAt,
        failureCode,
      });
      await this.lifecycleStore.write(failed);
      return failed;
    });
  }

  commitReset({ resetId } = {}) {
    return this.transitionReset({
      resetId,
      completedAt: null,
      status: PROFILE_RESET_LIFECYCLE_STATUS.COMMITTED,
      failureCode: null,
      expectedStatuses: [PROFILE_RESET_LIFECYCLE_STATUS.RESETTING],
    });
  }

  completeReset({ resetId, completedAt = Date.now() } = {}) {
    return this.transitionReset({
      resetId,
      completedAt,
      status: PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE,
      failureCode: null,
      expectedStatuses: [PROFILE_RESET_LIFECYCLE_STATUS.COMMITTED],
    });
  }

  failReset({ resetId, completedAt = Date.now(), failureCode } = {}) {
    return this.transitionReset({
      resetId,
      completedAt,
      status: PROFILE_RESET_LIFECYCLE_STATUS.FAILED,
      failureCode,
      expectedStatuses: [
        PROFILE_RESET_LIFECYCLE_STATUS.RESETTING,
        PROFILE_RESET_LIFECYCLE_STATUS.COMMITTED,
      ],
    });
  }

  transitionReset({
    resetId,
    completedAt,
    status,
    failureCode,
    expectedStatuses,
  }) {
    return this.enqueueMutation(async () => {
      const current = await this.read();
      if (
        current === null
        || !Array.isArray(expectedStatuses)
        || !expectedStatuses.includes(current.status)
        || current.resetId !== resetId
      ) {
        throw createAdmissionError('PROFILE_RESET_LIFECYCLE_TRANSITION_STALE', current);
      }
      const next = normalizeProfileResetLifecycleState({
        ...current,
        status,
        completedAt,
        failureCode,
      });
      await this.lifecycleStore.write(next);
      return next;
    });
  }

  async assertWriteAdmission({ expectedResetId = null } = {}) {
    const lifecycle = await this.read();
    if (isProfileResetWriteAdmissionClosed(lifecycle)) {
      throw createAdmissionError('PROFILE_RESET_WRITE_ADMISSION_CLOSED', lifecycle);
    }
    if (resolveProfileResetGeneration(lifecycle) !== expectedResetId) {
      throw createAdmissionError('PROFILE_RESET_GENERATION_STALE', lifecycle);
    }
    return lifecycle;
  }

  waitForWriteAdmission() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe = null;

      const cleanup = () => {
        if (typeof unsubscribe !== 'function') return;
        const release = unsubscribe;
        unsubscribe = null;
        release();
      };
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        try {
          cleanup();
        } catch (cleanupError) {
          if (error instanceof Error) error.cleanupError = cleanupError;
        }
        reject(error);
      };
      const resolveWhenOpen = (lifecycle) => {
        if (settled || isProfileResetWriteAdmissionClosed(lifecycle)) return;
        settled = true;
        try {
          cleanup();
          resolve(lifecycle);
        } catch (error) {
          reject(error);
        }
      };

      try {
        const releaseSubscription = this.subscribe((nextLifecycle) => {
          try {
            resolveWhenOpen(nextLifecycle);
          } catch (error) {
            rejectOnce(error);
          }
        });
        unsubscribe = releaseSubscription;
        if (settled) cleanup();
      } catch (error) {
        rejectOnce(error);
        return;
      }

      void this.read().then(resolveWhenOpen).catch(rejectOnce);
    });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('PROFILE_RESET_LIFECYCLE_LISTENER_REQUIRED');
    }
    const handleStorageChange = (changes = {}, areaName = '') => {
      if (
        areaName !== 'local'
        || !Object.prototype.hasOwnProperty.call(
          changes,
          PROFILE_RESET_LIFECYCLE_STORAGE_KEY,
        )
      ) {
        return;
      }
      const change = changes[PROFILE_RESET_LIFECYCLE_STORAGE_KEY] || {};
      const next = change.newValue === undefined
        ? null
        : normalizeProfileResetLifecycleState(change.newValue);
      const previous = change.oldValue === undefined
        ? null
        : normalizeProfileResetLifecycleState(change.oldValue);
      listener(next, previous);
    };
    if (this.addChangedListener(handleStorageChange) !== true) {
      throw new Error('PROFILE_RESET_LIFECYCLE_SUBSCRIPTION_UNAVAILABLE');
    }
    return () => {
      if (this.removeChangedListener(handleStorageChange) !== true) {
        throw new Error('PROFILE_RESET_LIFECYCLE_UNSUBSCRIBE_FAILED');
      }
    };
  }
}

export default ProfileResetLifecycleRepository;
