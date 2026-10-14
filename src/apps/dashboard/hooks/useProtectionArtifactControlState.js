function freezeChildState(childState = {}, suppressed = false) {
  const source = childState && typeof childState === 'object' ? childState : {};
  if (!Object.prototype.hasOwnProperty.call(source, 'enabled')) {
    return Object.freeze({ ...source });
  }
  const configuredEnabled = !!source.enabled;
  return Object.freeze({
    ...source,
    configuredEnabled,
    enabled: configuredEnabled && !suppressed,
  });
}

export function decorateArtifactFamilyWithControlState(familyState, { suspended, globallyPaused }) {
  if (!familyState || typeof suspended !== 'boolean' || typeof globallyPaused !== 'boolean') {
    throw new Error('ARTIFACT_FAMILY_CONTROL_PROJECTION_INVALID');
  }
  const suppressed = suspended || globallyPaused;
  return Object.freeze({
    ...familyState,
    children: Object.freeze(Object.fromEntries(Object.entries(familyState.children)
      .map(([childId, child]) => [childId, freezeChildState(child, suppressed)]))),
    configuredEnabled: familyState.enabled,
    enabled: familyState.enabled && !suppressed,
    suspended,
    globallyPaused,
    controlSuppressed: suppressed,
  });
}
