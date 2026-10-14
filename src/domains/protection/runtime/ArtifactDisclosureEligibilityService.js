import {
  CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS,
  normalizeCanonicalArtifactPreferenceMap,
} from './canonicalArtifactRuntimeBinding.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function requireArtifactDisclosureRuntimeEligibilitySnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw new Error('ARTIFACT_DISCLOSURE_RUNTIME_ELIGIBILITY_SNAPSHOT_REQUIRED');
  }

  const entriesByFamilyId = snapshot.entriesByFamilyId;
  if (!isPlainObject(entriesByFamilyId)) {
    throw new Error('ARTIFACT_DISCLOSURE_RUNTIME_ELIGIBILITY_ENTRIES_REQUIRED');
  }

  const familyIds = Object.keys(entriesByFamilyId);
  if (
    familyIds.length !== CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.length
    || CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.some(
      (familyId) => !Object.prototype.hasOwnProperty.call(entriesByFamilyId, familyId),
    )
  ) {
    throw new Error('ARTIFACT_DISCLOSURE_RUNTIME_ELIGIBILITY_COVERAGE_INVALID');
  }

  CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.forEach((familyId) => {
    const entry = entriesByFamilyId[familyId];
    if (!isPlainObject(entry) || entry.familyId !== familyId) {
      throw new Error(`ARTIFACT_DISCLOSURE_RUNTIME_ELIGIBILITY_ENTRY_INVALID:${familyId}`);
    }
    if (typeof entry.runtimeEligible !== 'boolean') {
      throw new Error(`ARTIFACT_DISCLOSURE_RUNTIME_ELIGIBILITY_VALUE_INVALID:${familyId}`);
    }
  });

  return snapshot;
}

export function applyArtifactDisclosureEligibilityToPreferences(
  rawArtifacts = {},
  artifactDisclosureSnapshot,
) {
  const normalizedArtifacts = normalizeCanonicalArtifactPreferenceMap(rawArtifacts);
  const snapshot = requireArtifactDisclosureRuntimeEligibilitySnapshot(
    artifactDisclosureSnapshot,
  );

  return CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.reduce((acc, familyId) => {
    const preference = normalizedArtifacts[familyId];
    acc[familyId] = snapshot.entriesByFamilyId[familyId].runtimeEligible
      ? preference
      : {
          ...preference,
          enabled: false,
          autoTrigger: false,
        };
    return acc;
  }, {});
}
