import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
  PROFILE_RESET_LIFECYCLE_STATUS,
  normalizeProfileResetLifecycleState,
} from '../../storage/runtime/ProfileResetLifecycleRepository.js';

export const PROFILE_MUTATION_RESPONSE_HANDOFF_CONTRACT = (
  'profile_mutation_response_handoff_v1'
);

const EXACT_HANDOFF_KEYS = Object.freeze([
  'contract',
  'operation',
  'resetId',
]);

function createHandoffError(reason) {
  const error = new Error(`PROFILE_MUTATION_RESPONSE_HANDOFF_INVALID:${reason}`);
  error.code = 'PROFILE_MUTATION_RESPONSE_HANDOFF_INVALID';
  error.reason = reason;
  return error;
}

function hasExactHandoffKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Reflect.ownKeys(value).length !== EXACT_HANDOFF_KEYS.length) return false;
  const actual = Object.keys(value).sort();
  const expected = [...EXACT_HANDOFF_KEYS].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

export function normalizeProfileMutationResponseHandoff(value) {
  if (!hasExactHandoffKeys(value)) throw createHandoffError('shape');
  if (value.contract !== PROFILE_MUTATION_RESPONSE_HANDOFF_CONTRACT) {
    throw createHandoffError('contract');
  }
  if (!Object.values(PROFILE_RESET_LIFECYCLE_OPERATIONS).includes(value.operation)) {
    throw createHandoffError('operation');
  }
  if (
    typeof value.resetId !== 'string'
    || !value.resetId
    || value.resetId.trim() !== value.resetId
  ) {
    throw createHandoffError('reset_id');
  }
  return Object.freeze({
    contract: value.contract,
    operation: value.operation,
    resetId: value.resetId,
  });
}

export function createProfileMutationResponseHandoffFromLifecycle(
  lifecycle,
  { expectedOperation } = {},
) {
  if (lifecycle === null) {
    const error = new Error('PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_NOT_COMPLETE');
    error.code = 'PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_NOT_COMPLETE';
    error.lifecycle = null;
    throw error;
  }
  const normalized = normalizeProfileResetLifecycleState(lifecycle);
  if (normalized.status !== PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE) {
    const error = new Error('PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_NOT_COMPLETE');
    error.code = 'PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_NOT_COMPLETE';
    error.lifecycle = normalized;
    throw error;
  }
  if (normalized.operation !== expectedOperation) {
    const error = new Error('PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_MISMATCH');
    error.code = 'PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_MISMATCH';
    error.lifecycle = normalized;
    error.expectedOperation = expectedOperation;
    throw error;
  }
  return normalizeProfileMutationResponseHandoff({
    contract: PROFILE_MUTATION_RESPONSE_HANDOFF_CONTRACT,
    operation: normalized.operation,
    resetId: normalized.resetId,
  });
}

export function areProfileMutationResponseHandoffsEqual(left, right) {
  const normalizedLeft = normalizeProfileMutationResponseHandoff(left);
  const normalizedRight = normalizeProfileMutationResponseHandoff(right);
  return normalizedLeft.contract === normalizedRight.contract
    && normalizedLeft.operation === normalizedRight.operation
    && normalizedLeft.resetId === normalizedRight.resetId;
}

export default normalizeProfileMutationResponseHandoff;
