import { FEATURE_KEYS } from '../../../protocol/contracts/featureKeys.js';
import {
  CLASS_POLICY_MATRIX,
  validateClassPolicyMatrix,
} from '../../../protocol/policy/classPolicyMatrix.js';
import { PROTECTION_REASON_CODES } from '../../../protocol/contracts/reasonCodes.js';

function resolveFeatureEnabled({
  featureKey,
  featureConfig,
  classPolicy,
  mainActivation,
}) {
  const enabledByFilter = !!featureConfig?.isActive;
  const enabledByPolicy = !!classPolicy?.features?.[featureKey]?.enabledByDefault;
  return mainActivation && enabledByFilter && enabledByPolicy;
}

function buildFailClosedActivation(reasonCode = PROTECTION_REASON_CODES.INVALID_SCOPE) {
  const features = {};
  FEATURE_KEYS.forEach((featureKey) => {
    features[featureKey] = {
      enabled: false,
      reason: reasonCode,
    };
  });
  return {
    main: false,
    features,
    reasonCodes: [reasonCode],
    failClosed: true,
  };
}

export function createProtectionPolicyEvaluator({ classPolicyMatrix = CLASS_POLICY_MATRIX } = {}) {
  const matrixValidation = validateClassPolicyMatrix(classPolicyMatrix);
  if (!matrixValidation.ok) {
    console.warn('[PolicyEvaluator] Invalid class policy matrix:', matrixValidation.errors);
  }

  function evaluatePolicy({
    domainClassId,
    shouldApply,
    filters,
    reason,
  } = {}) {
    if (!matrixValidation.ok) {
      return buildFailClosedActivation(PROTECTION_REASON_CODES.INVALID_SCOPE);
    }

    const classPolicy = classPolicyMatrix?.[domainClassId];
    if (!classPolicy) {
      return buildFailClosedActivation(PROTECTION_REASON_CODES.INVALID_SCOPE);
    }

    const mainActivation = !!shouldApply && !!classPolicy.mainActivationDefault;
    const safeReason = typeof reason === 'string' && reason.trim().length > 0
      ? reason
      : PROTECTION_REASON_CODES.UNMANAGED;

    const features = {};
    FEATURE_KEYS.forEach((featureKey) => {
      const enabled = resolveFeatureEnabled({
        featureKey,
        featureConfig: filters?.[featureKey],
        classPolicy,
        mainActivation,
      });

      features[featureKey] = {
        enabled,
        reason: enabled ? safeReason : PROTECTION_REASON_CODES.MAIN_INACTIVE,
      };
    });

    return {
      main: mainActivation,
      features,
      reasonCodes: [safeReason],
      failClosed: false,
    };
  }

  return {
    evaluatePolicy,
  };
}
