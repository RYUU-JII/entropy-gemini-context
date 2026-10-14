// Read-only guidance; the background registration command owns admission.
export function projectMainSiteRegistrationAvailability(snapshot) {
  if (snapshot === null) return null;
  if (snapshot.contract !== 'site_registration_journey_v1') throw new Error('MAIN_SITE_REGISTRATION_JOURNEY_REQUIRED');
  const { mode, protectedSiteCount: count, limit, available, nextIncreaseDay, nextLimit } = snapshot;
  return { mode, count, limit, available, nextIncreaseDay, nextLimit };
}
