import {
  MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE,
  PROFILE_COMPATIBILITY_RESET_REASONS,
  createProfileCompatibilityDowngradeBlockedError,
  createProfileCompatibilityResetRequiredError,
} from './ProfileCompatibilityContract.js';

export const MODEL_STATE_PROFILE_EPOCH_ROW_KEY = '__model_state_profile_epoch__';
export const MODEL_STATE_PROFILE_EPOCH_KIND = 'model_state_profile_epoch';
export const MODEL_STATE_PROFILE_EPOCH_CONTRACT = 'model_state_profile_epoch_v1';
export const MODEL_STATE_INITIAL_PROFILE_EPOCH = 'profile_epoch:initial:v1';

const PROFILE_EPOCH_KEYS = Object.freeze([
  'kind',
  'contract',
  'profileEpoch',
  'developmentBaseline',
]);
const PRE_BASELINE_PROFILE_EPOCH_KEYS = Object.freeze([
  'kind',
  'contract',
  'profileEpoch',
]);

const hasExactKeys = (value, expectedKeys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
};

export const requireModelStateProfileEpochId = (
  value,
  errorCode = 'MODEL_STATE_PROFILE_EPOCH_INVALID',
) => {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(errorCode);
  }
  return value;
};

export const normalizeModelStateProfileEpoch = (value) => {
  if (hasExactKeys(value, PRE_BASELINE_PROFILE_EPOCH_KEYS)) {
    if (
      value.kind !== MODEL_STATE_PROFILE_EPOCH_KIND
      || value.contract !== MODEL_STATE_PROFILE_EPOCH_CONTRACT
    ) {
      throw new Error('MODEL_STATE_PROFILE_EPOCH_CONTRACT_INVALID');
    }
    requireModelStateProfileEpochId(value.profileEpoch);
    throw createProfileCompatibilityResetRequiredError({
      observedBaseline: null,
      reason: PROFILE_COMPATIBILITY_RESET_REASONS.BASELINE_MISSING,
    });
  }
  if (!hasExactKeys(value, PROFILE_EPOCH_KEYS)) {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_CONTRACT_INVALID');
  }
  if (
    value.kind !== MODEL_STATE_PROFILE_EPOCH_KIND
    || value.contract !== MODEL_STATE_PROFILE_EPOCH_CONTRACT
  ) {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_CONTRACT_INVALID');
  }
  const profileEpoch = requireModelStateProfileEpochId(value.profileEpoch);
  if (!Number.isSafeInteger(value.developmentBaseline) || value.developmentBaseline < 1) {
    throw new Error('MODEL_STATE_PROFILE_EPOCH_CONTRACT_INVALID');
  }
  if (value.developmentBaseline < MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE) {
    throw createProfileCompatibilityResetRequiredError({
      observedBaseline: value.developmentBaseline,
      reason: PROFILE_COMPATIBILITY_RESET_REASONS.BASELINE_BEHIND,
    });
  }
  if (value.developmentBaseline > MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE) {
    throw createProfileCompatibilityDowngradeBlockedError({
      observedBaseline: value.developmentBaseline,
    });
  }
  return Object.freeze({
    kind: MODEL_STATE_PROFILE_EPOCH_KIND,
    contract: MODEL_STATE_PROFILE_EPOCH_CONTRACT,
    profileEpoch,
    developmentBaseline: MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE,
  });
};

export const createModelStateProfileEpoch = (profileEpoch) => (
  normalizeModelStateProfileEpoch({
    kind: MODEL_STATE_PROFILE_EPOCH_KIND,
    contract: MODEL_STATE_PROFILE_EPOCH_CONTRACT,
    profileEpoch,
    developmentBaseline: MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE,
  })
);
