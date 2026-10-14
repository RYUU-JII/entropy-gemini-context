function isRestrictedAt(runtimeSnapshot) {
  const source = runtimeSnapshot?.scope?.temporalPolicy?.source;
  if (!['base', 'schedule', 'manual'].includes(source)) {
    throw new Error('FILTER_INDICATOR_TEMPORAL_POLICY_REQUIRED');
  }
  return source === 'schedule';
}

export function createProtectionRuntimePolicy() {
  return { isRestrictedAt };
}
