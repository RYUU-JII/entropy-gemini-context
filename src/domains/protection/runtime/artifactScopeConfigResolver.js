function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergePlainObjects(base, override) {
  const safeBase = isPlainObject(base) ? base : {};
  const safeOverride = isPlainObject(override) ? override : {};
  const keys = new Set([
    ...Object.keys(safeBase),
    ...Object.keys(safeOverride),
  ]);

  return Array.from(keys).reduce((acc, key) => {
    const baseValue = safeBase[key];
    const overrideValue = safeOverride[key];

    if (overrideValue === undefined) {
      acc[key] = baseValue;
      return acc;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      acc[key] = mergePlainObjects(baseValue, overrideValue);
      return acc;
    }

    acc[key] = overrideValue;
    return acc;
  }, {});
}

function selectArtifactScopeOverride({
  artifactId = '',
  childId = '',
  artifactScopeConfigs = {},
  scopeKey = '',
} = {}) {
  if (!scopeKey) return null;
  const scopeConfig = artifactScopeConfigs?.[scopeKey];
  if (!isPlainObject(scopeConfig)) return null;
  const artifactConfig = scopeConfig?.[artifactId];
  if (!isPlainObject(artifactConfig)) return null;
  const childConfig = artifactConfig?.[childId];
  return isPlainObject(childConfig) ? childConfig : null;
}

export function resolveArtifactScopeConfig({
  artifactId = '',
  childId = '',
  artifactConfig = {},
  artifactScopeConfigs = {},
  scopeKey = '',
  fallbackConfig = {},
} = {}) {
  const baseConfig = mergePlainObjects(fallbackConfig, artifactConfig);
  const scopeOverride = selectArtifactScopeOverride({
    artifactId,
    childId,
    artifactScopeConfigs,
    scopeKey,
  });
  const effectiveConfig = mergePlainObjects(baseConfig, scopeOverride);

  return {
    effectiveConfig,
    provenance: {
      artifactId,
      childId,
      scopeKey,
      source: scopeOverride ? 'scope_override' : 'artifact_default',
      hasScopeOverride: !!scopeOverride,
    },
  };
}
