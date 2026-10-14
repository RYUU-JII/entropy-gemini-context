export const INTERVENTION_ADMISSION_RUNTIME_ENABLED = false;

function rejectDisabledCapability() {
  throw new Error('INTERVENTION_ADMISSION_BUILD_CAPABILITY_DISABLED');
}

export const sharedInterventionAdmissionRuntime = Object.freeze({
  enabled: false,
  getSnapshot: () => Object.freeze({
    enabled: false,
    reason: 'build_capability_disabled',
  }),
  subscribe: rejectDisabledCapability,
  getShadowSnapshot: rejectDisabledCapability,
  subscribeShadow: rejectDisabledCapability,
  disposeShadow: rejectDisabledCapability,
  getConsumptionProfile: rejectDisabledCapability,
  observeConsumptionEvidence: rejectDisabledCapability,
  reserveCandidate: rejectDisabledCapability,
  reserveEnso: rejectDisabledCapability,
  present: rejectDisabledCapability,
  abort: rejectDisabledCapability,
  release: rejectDisabledCapability,
  setContext: rejectDisabledCapability,
});

export default sharedInterventionAdmissionRuntime;
