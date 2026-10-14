export const MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE = 2;

export const PROFILE_COMPATIBILITY_RECOVERY_CONTRACT = (
  'profile_compatibility_recovery_v1'
);
export const PROFILE_COMPATIBILITY_RECOVERY_KIND = 'profile_contract_reset';
export const PROFILE_COMPATIBILITY_RECOVERY_ACTION = 'full_reset';
export const PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED = (
  'MODEL_STATE_PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED'
);
export const PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED = (
  'MODEL_STATE_PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED'
);

export const PROFILE_COMPATIBILITY_RESET_REASONS = Object.freeze({
  BASELINE_MISSING: 'baseline_missing',
  BASELINE_BEHIND: 'baseline_behind',
  PROFILE_HEADER_MISSING: 'profile_header_missing',
});

const RECOVERY_KEYS = Object.freeze([
  'contract',
  'kind',
  'failureCode',
  'recoveryAction',
  'reason',
  'expectedBaseline',
  'observedBaseline',
]);

const isPlainObject = (value) => Boolean(
  value && typeof value === 'object' && !Array.isArray(value)
);

const hasExactKeys = (value, expectedKeys) => {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
};

const isBaseline = (value) => Number.isSafeInteger(value) && value >= 1;

const hasValidObservedBaselineRelation = ({
  reason,
  observedBaseline,
  expectedBaseline,
}) => {
  if (reason === PROFILE_COMPATIBILITY_RESET_REASONS.BASELINE_BEHIND) {
    return isBaseline(observedBaseline) && observedBaseline < expectedBaseline;
  }
  return observedBaseline === null;
};

export function normalizeProfileCompatibilityRecovery(value) {
  if (
    !hasExactKeys(value, RECOVERY_KEYS)
    || value.contract !== PROFILE_COMPATIBILITY_RECOVERY_CONTRACT
    || value.kind !== PROFILE_COMPATIBILITY_RECOVERY_KIND
    || value.failureCode !== PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED
    || value.recoveryAction !== PROFILE_COMPATIBILITY_RECOVERY_ACTION
    || !Object.values(PROFILE_COMPATIBILITY_RESET_REASONS).includes(value.reason)
    || value.expectedBaseline !== MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE
    || (
      value.observedBaseline !== null
      && !isBaseline(value.observedBaseline)
    )
    || !hasValidObservedBaselineRelation(value)
  ) {
    throw new Error('PROFILE_COMPATIBILITY_RECOVERY_CONTRACT_INVALID');
  }
  return Object.freeze({
    contract: PROFILE_COMPATIBILITY_RECOVERY_CONTRACT,
    kind: PROFILE_COMPATIBILITY_RECOVERY_KIND,
    failureCode: PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED,
    recoveryAction: PROFILE_COMPATIBILITY_RECOVERY_ACTION,
    reason: value.reason,
    expectedBaseline: value.expectedBaseline,
    observedBaseline: value.observedBaseline,
  });
}

export function createProfileCompatibilityRecovery({
  observedBaseline = null,
  reason,
} = {}) {
  return normalizeProfileCompatibilityRecovery({
    contract: PROFILE_COMPATIBILITY_RECOVERY_CONTRACT,
    kind: PROFILE_COMPATIBILITY_RECOVERY_KIND,
    failureCode: PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED,
    recoveryAction: PROFILE_COMPATIBILITY_RECOVERY_ACTION,
    reason,
    expectedBaseline: MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE,
    observedBaseline,
  });
}

export function createProfileCompatibilityResetRequiredError(options = {}) {
  const profileCompatibilityRecovery = createProfileCompatibilityRecovery(options);
  const error = new Error(PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED);
  error.code = PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED;
  error.profileCompatibilityRecovery = profileCompatibilityRecovery;
  return error;
}

export function createProfileCompatibilityDowngradeBlockedError({
  observedBaseline,
} = {}) {
  if (
    !isBaseline(observedBaseline)
    || observedBaseline <= MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE
  ) {
    throw new Error('PROFILE_COMPATIBILITY_DOWNGRADE_INPUT_INVALID');
  }
  const error = new Error(PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED);
  error.code = PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED;
  error.expectedBaseline = MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE;
  error.observedBaseline = observedBaseline;
  return error;
}

export function resolveProfileCompatibilityRecovery(error) {
  if (
    !error
    || typeof error !== 'object'
    || !Object.prototype.hasOwnProperty.call(error, 'profileCompatibilityRecovery')
  ) {
    return null;
  }
  const recovery = normalizeProfileCompatibilityRecovery(
    error.profileCompatibilityRecovery,
  );
  if (
    error.code !== recovery.failureCode
    || error.message !== recovery.failureCode
  ) {
    throw new Error('PROFILE_COMPATIBILITY_RECOVERY_ERROR_MISMATCH');
  }
  return recovery;
}
