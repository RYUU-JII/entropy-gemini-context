export function createArtifactDisclosureBootstrap({
  progressionService,
  getSettingsSnapshot,
} = {}) {
  if (
    !progressionService
    || typeof progressionService.initializeArtifactDisclosure !== 'function'
    || typeof progressionService.observeProtectedSiteRegistration !== 'function'
  ) {
    throw new Error('ARTIFACT_DISCLOSURE_BOOTSTRAP_SERVICE_REQUIRED');
  }
  if (typeof getSettingsSnapshot !== 'function') {
    throw new Error('ARTIFACT_DISCLOSURE_BOOTSTRAP_SETTINGS_OWNER_REQUIRED');
  }
  async function initialize() {
    const result = await progressionService.initializeArtifactDisclosure();
    const settings = getSettingsSnapshot();
    if (!Array.isArray(settings.blockedUrls)) {
      throw new Error('ARTIFACT_DISCLOSURE_BLOCKED_URLS_REQUIRED');
    }
    await progressionService.observeProtectedSiteRegistration({
      protectedSiteCount: new Set(settings.blockedUrls).size,
    });
    return result;
  }

  return Object.freeze({ initialize });
}

export default createArtifactDisclosureBootstrap;
