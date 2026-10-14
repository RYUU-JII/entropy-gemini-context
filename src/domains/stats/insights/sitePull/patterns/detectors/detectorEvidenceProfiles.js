function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function requireSitePullDetectorEvidenceProfile(profile, profileId) {
  if (isObjectRecord(profile)) return profile;
  throw new Error(`SITE_PULL_DETECTOR_EVIDENCE_PROFILE_MISSING:${profileId}`);
}
