import { FEATURE_KEYS } from '../../../protocol/contracts/featureKeys.js';

function toStableHash(value) {
  const json = JSON.stringify(stableSerializeFeatureValue(value)) || '';
  let hash = 5381;
  for (let i = 0; i < json.length; i += 1) {
    hash = ((hash << 5) + hash) + json.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

function stableSerializeFeatureValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => stableSerializeFeatureValue(entry));
  }
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSerializeFeatureValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function cloneFilterConfig(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  if (Array.isArray(entry)) return [...entry];
  return { ...entry };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNonNegativeInteger(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('PROTECTION_POLICY_COMPILER_REVISION_INVALID');
  }
  return value;
}

function requireCompilerInput({ filters, activation, revision }) {
  if (!isPlainObject(filters)) {
    throw new Error('PROTECTION_POLICY_COMPILER_FILTERS_REQUIRED');
  }
  if (!isPlainObject(activation)) {
    throw new Error('PROTECTION_POLICY_COMPILER_ACTIVATION_REQUIRED');
  }
  if (!isPlainObject(activation.features)) {
    throw new Error('PROTECTION_POLICY_COMPILER_ACTIVATION_FEATURES_REQUIRED');
  }
  return {
    filters,
    activationFeatures: activation.features,
    revision: requireNonNegativeInteger(revision),
  };
}

function readActivationEnabled(activationFeatures, featureKey) {
  if (!Object.prototype.hasOwnProperty.call(activationFeatures, featureKey)) {
    return false;
  }
  const entry = activationFeatures[featureKey];
  if (!isPlainObject(entry)) {
    throw new Error(`PROTECTION_POLICY_COMPILER_ACTIVATION_FEATURE_INVALID:${featureKey}`);
  }
  if (typeof entry.enabled !== 'boolean') {
    throw new Error(`PROTECTION_POLICY_COMPILER_ACTIVATION_ENABLED_INVALID:${featureKey}`);
  }
  return entry.enabled;
}

export function createProtectionPolicyCompiler() {
  function compilePolicy({
    filters,
    activation,
    revision,
  } = {}) {
    const input = requireCompilerInput({ filters, activation, revision });
    const compiledFeatures = {};
    const featureHashes = {};
    const featureRevisions = {};

    FEATURE_KEYS.forEach((featureKey) => {
      const source = cloneFilterConfig(input.filters[featureKey]);
      const enabled = readActivationEnabled(input.activationFeatures, featureKey);

      const compiled = source && typeof source === 'object'
        ? { ...source, isActive: enabled }
        : { isActive: enabled, value: source };

      compiledFeatures[featureKey] = compiled;
      featureHashes[featureKey] = toStableHash(compiled);
      featureRevisions[featureKey] = input.revision;
    });

    return {
      compiledFeatures,
      featureHashes,
      featureRevisions,
    };
  }

  return {
    compilePolicy,
  };
}
