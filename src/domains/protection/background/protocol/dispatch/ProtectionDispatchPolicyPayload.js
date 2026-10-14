import { requireCoolingCurveRuntimeState } from '../../../contracts/coolingCurveRuntimeContract.js';

export const DEFAULT_PROTECTION_POLICY_PAYLOAD = Object.freeze({
  mode: null,
  reason: 'unknown',
  hardBlockWindow: false,
  stepDelta: 0,
  siteGoalMinutes: 0,
  protocolBudgetRole: 'reference',
  protocolTargetMinutes: 0,
  protocolTargetSource: 'none',
  referenceTargetMinutes: 0,
  referenceTargetSource: 'none',
  globalCapExceeded: false,
  globalCapBlockedMs: 0,
  globalCapLimitMs: 0,
  isAllowedWindow: false,
  coolingCurve: null,
});

const PROTECTION_POLICY_PAYLOAD_KEYS = new Set(
  Object.keys(DEFAULT_PROTECTION_POLICY_PAYLOAD),
);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function failPolicyField(fieldName) {
  throw new Error(`PROTECTION_DISPATCH_POLICY_FIELD_INVALID:${fieldName}`);
}

function readNullablePolicyString(policy, fieldName) {
  const value = policy[fieldName];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    failPolicyField(fieldName);
  }
  return value;
}

function readPolicyString(policy, fieldName) {
  const value = policy[fieldName];
  if (typeof value !== 'string' || !value.trim()) {
    failPolicyField(fieldName);
  }
  return value;
}

function readPolicyBoolean(policy, fieldName) {
  const value = policy[fieldName];
  if (typeof value !== 'boolean') {
    failPolicyField(fieldName);
  }
  return value;
}

function readPolicyNonNegativeInteger(policy, fieldName) {
  const value = policy[fieldName];
  if (!Number.isInteger(value) || value < 0) {
    failPolicyField(fieldName);
  }
  return value;
}

export function buildProtectionPolicyPayload(policy = null) {
  if (policy === null || policy === undefined) {
    return { ...DEFAULT_PROTECTION_POLICY_PAYLOAD };
  }
  if (!isPlainObject(policy)) {
    throw new Error('PROTECTION_DISPATCH_POLICY_INVALID');
  }
  const unknownField = Object.keys(policy)
    .find((fieldName) => !PROTECTION_POLICY_PAYLOAD_KEYS.has(fieldName));
  if (unknownField) {
    failPolicyField(unknownField);
  }

  return {
    mode: readNullablePolicyString(policy, 'mode'),
    reason: readPolicyString(policy, 'reason'),
    hardBlockWindow: readPolicyBoolean(policy, 'hardBlockWindow'),
    stepDelta: readPolicyNonNegativeInteger(policy, 'stepDelta'),
    siteGoalMinutes: readPolicyNonNegativeInteger(policy, 'siteGoalMinutes'),
    protocolBudgetRole: readPolicyString(policy, 'protocolBudgetRole'),
    protocolTargetMinutes: readPolicyNonNegativeInteger(policy, 'protocolTargetMinutes'),
    protocolTargetSource: readPolicyString(policy, 'protocolTargetSource'),
    referenceTargetMinutes: readPolicyNonNegativeInteger(policy, 'referenceTargetMinutes'),
    referenceTargetSource: readPolicyString(policy, 'referenceTargetSource'),
    globalCapExceeded: readPolicyBoolean(policy, 'globalCapExceeded'),
    globalCapBlockedMs: readPolicyNonNegativeInteger(policy, 'globalCapBlockedMs'),
    globalCapLimitMs: readPolicyNonNegativeInteger(policy, 'globalCapLimitMs'),
    isAllowedWindow: readPolicyBoolean(policy, 'isAllowedWindow'),
    coolingCurve: { ...requireCoolingCurveRuntimeState(policy.coolingCurve) },
  };
}
