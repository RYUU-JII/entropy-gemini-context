import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProtocolStore } from '../stores/useProtocolStore.js';
import { useArtifactDisclosureSnapshot } from '../artifacts/useArtifactDisclosureSnapshot.js';
import { revalidateArtifactDisclosureForRegistrationPolicy } from '../artifacts/artifactDisclosureSnapshotResource.js';
import { buildSiteRegistrationJourneySnapshot } from '../../../domains/progression/policy/siteRegistrationJourneyPolicy.js';

// Dashboard consumers share the progression query resource and hydrated policy
// projection. Neither a tab visit nor this hook commits a journey milestone.
export function useSiteRegistrationJourney({ enabled = true, revalidateOnEnable = false } = {}) {
  const policy = useProtocolStore(useShallow((state) => ({
    loaded: state.loaded,
    error: state.loadError,
    blockedUrls: state.blockedUrls,
    allowedUrls: state.allowedUrls,
    initialize: state.initialize,
  })));
  const disclosure = useArtifactDisclosureSnapshot({ enabled, revalidateOnEnable });
  useEffect(() => {
    if (!enabled || !policy.loaded) return;
    // The query resource publishes rejection; a failed read remains an explicit
    // retryable owner state rather than an unhandled effect promise.
    void revalidateArtifactDisclosureForRegistrationPolicy(policy.blockedUrls).catch(() => undefined);
  }, [enabled, policy.blockedUrls, policy.loaded]);
  const refresh = useCallback(async () => {
    if (!policy.loaded) await policy.initialize();
    return disclosure.refresh();
  }, [disclosure.refresh, policy.initialize, policy.loaded]);
  const projection = useMemo(() => {
    if (!policy.loaded || disclosure.loading || disclosure.error || disclosure.snapshot === null) {
      return { snapshot: null, error: null, milestones: null };
    }
    try {
      if (!Array.isArray(policy.blockedUrls)) throw new Error('SITE_REGISTRATION_JOURNEY_PROTECTED_DOMAINS_REQUIRED');
      if (!Array.isArray(policy.allowedUrls)) throw new Error('SITE_REGISTRATION_JOURNEY_ALLOWED_DOMAINS_REQUIRED');
      const milestones = disclosure.snapshot.registrationJourneyMilestones;
      if (!milestones || typeof milestones !== 'object') throw new Error('SITE_REGISTRATION_JOURNEY_MILESTONES_REQUIRED');
      return {
        snapshot: buildSiteRegistrationJourneySnapshot({
          unlockProgress: disclosure.snapshot.unlockProgress,
          protectedSiteCount: new Set(policy.blockedUrls).size,
          allowedSiteCount: new Set(policy.allowedUrls).size,
          ...milestones,
        }),
        error: null,
        milestones,
      };
    } catch (error) {
      return { snapshot: null, error, milestones: null };
    }
  }, [disclosure.error, disclosure.loading, disclosure.snapshot, policy.allowedUrls, policy.blockedUrls, policy.loaded]);
  const error = policy.error || disclosure.error || projection.error;
  return {
    snapshot: projection.snapshot,
    milestones: projection.milestones,
    error,
    loading: !error && (policy.loaded !== true || disclosure.loading || projection.snapshot === null),
    refresh,
  };
}

export default useSiteRegistrationJourney;
