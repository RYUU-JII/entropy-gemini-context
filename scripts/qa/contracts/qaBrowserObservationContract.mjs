const OBSERVATIONS = new Set(['document', 'animation', 'foreground']);

export function normalizeQaBrowserObservation(raw, { parameters, browserRequirements, supportedModes }) {
  if (raw === undefined || raw === null) return null;
  const fixed = OBSERVATIONS.has(raw);
  if (!fixed && (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || Object.keys(raw).sort().join(',') !== 'parameter,values'
    || typeof raw.parameter !== 'string' || parameters[raw.parameter]?.type !== 'enum'
    || !raw.values || typeof raw.values !== 'object' || Array.isArray(raw.values)
    || Object.keys(raw.values).sort().join(',') !== [...parameters[raw.parameter].values].sort().join(',')
    || !Object.values(raw.values).every((value) => OBSERVATIONS.has(value)))) {
    throw new Error('QA_TARGET_BROWSER_OBSERVATION_INVALID');
  }
  const documentOnly = fixed ? raw === 'document'
    : Object.values(raw.values).every((value) => value === 'document');
  // Document liveness is read-only and grants no initial focus. Native frame
  // and foreground experiments retain their stricter agent/presentation scope.
  if (browserRequirements?.authentication !== 'persistent'
    || browserRequirements.documentVisibility !== 'visible_required'
    || browserRequirements.targetActivation !== 'active'
    || browserRequirements.osFocus !== 'never'
    || !['headed_required', 'physical_gpu_required'].includes(browserRequirements.rendering)
    || (documentOnly
      ? !['background', 'foreground'].includes(browserRequirements.defaultPresentation)
      : browserRequirements.defaultPresentation !== 'foreground'
        || supportedModes.length !== 1 || supportedModes[0] !== 'agent')) {
    throw new Error('QA_TARGET_FOREGROUND_OBSERVATION_CONFLICT');
  }
  if (fixed) return raw;
  return Object.freeze({ parameter: raw.parameter, values: Object.freeze({ ...raw.values }) });
}

// The compiler resolves the declaration once. Runtime owners never infer
// observation semantics from target IDs, protocol names or scope parameters.
export function resolveQaBrowserObservation(policy, parameters) {
  if (policy === null || OBSERVATIONS.has(policy)) return policy;
  const value = policy?.values?.[parameters[policy.parameter]];
  if (!OBSERVATIONS.has(value)) throw new Error('QA_BROWSER_OBSERVATION_UNRESOLVED');
  return value;
}
