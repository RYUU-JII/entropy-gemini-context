import {
  DEFAULT_ARTIFACT_CONTROL_STATE,
  normalizeArtifactControlState,
} from '../../settings/config/artifactControlState.js';
import {
  CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS,
  normalizeCanonicalArtifactPreferenceMap,
} from './canonicalArtifactRuntimeBinding.js';

function resolveArtifactPreferenceDefaults(preference = {}) {
  const source = preference && typeof preference === 'object' ? preference : {};
  return {
    enabled: source.enabled === true,
    autoTrigger: typeof source.autoTrigger === 'boolean' ? source.autoTrigger : true,
  };
}

export function describeArtifactControlStateForFamily(rawControlState, familyId) {
  const normalized = normalizeArtifactControlState(rawControlState, {
    defaults: DEFAULT_ARTIFACT_CONTROL_STATE,
  });
  const suspended = typeof familyId === 'string' && familyId.trim()
    ? !!normalized.familySuspensions[familyId]
    : false;
  const globallyPaused = !!normalized.globalPaused;
  return {
    globallyPaused,
    suspended,
    suppressed: globallyPaused || suspended,
  };
}

export function applyArtifactControlStateToPreferences(rawArtifacts = {}, rawControlState) {
  const normalizedArtifacts = normalizeCanonicalArtifactPreferenceMap(rawArtifacts);
  const normalizedControlState = normalizeArtifactControlState(rawControlState, {
    defaults: DEFAULT_ARTIFACT_CONTROL_STATE,
  });

  return CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.reduce((acc, familyId) => {
    const basePreference = resolveArtifactPreferenceDefaults(normalizedArtifacts[familyId]);
    const { suppressed } = describeArtifactControlStateForFamily(normalizedControlState, familyId);
    acc[familyId] = suppressed
      ? {
          ...basePreference,
          enabled: false,
          autoTrigger: false,
        }
      : basePreference;
    return acc;
  }, {});
}
