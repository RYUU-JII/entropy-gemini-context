import { FEATURE_KEYS } from '../contracts/featureKeys.js';
import { DOMAIN_CLASS_IDS } from '../scope/classCatalog.js';

function buildFeaturePolicy(enabledByDefault) {
  const value = {};
  FEATURE_KEYS.forEach((featureKey) => {
    value[featureKey] = Object.freeze({ enabledByDefault: !!enabledByDefault });
  });
  return Object.freeze(value);
}

function buildClassPolicy(mainActivationDefault, featureEnabledDefault) {
  return Object.freeze({
    mainActivationDefault: !!mainActivationDefault,
    features: buildFeaturePolicy(featureEnabledDefault),
  });
}

export const CLASS_POLICY_MATRIX = Object.freeze({
  blocked: buildClassPolicy(true, true),
  managed: buildClassPolicy(false, false),
  allowed: buildClassPolicy(false, false),
  unmanaged: buildClassPolicy(false, false),
});

export function validateClassPolicyMatrix(matrix = CLASS_POLICY_MATRIX) {
  const errors = [];

  DOMAIN_CLASS_IDS.forEach((classId) => {
    if (!matrix[classId]) {
      errors.push(`MISSING_CLASS:${classId}`);
      return;
    }

    FEATURE_KEYS.forEach((featureKey) => {
      if (!matrix[classId]?.features?.[featureKey]) {
        errors.push(`MISSING_FEATURE_POLICY:${classId}:${featureKey}`);
      }
    });
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}
