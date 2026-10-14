import { shouldRunTrackingBoundaryAdapter } from '../../../../../domains/settings/config/settingsUpdateKeys.js';

export function createTrackingPolicyMutationOwner({ runStatsMutationBatch, sealActiveSegment, primeActiveTrackingBoundary }) {
  for (const owner of [runStatsMutationBatch, sealActiveSegment, primeActiveTrackingBoundary]) {
    if (typeof owner !== 'function') throw new Error('TRACKING_POLICY_MUTATION_BOUNDARY_OWNER_REQUIRED');
  }
  return ({ commit }) => {
    if (typeof commit !== 'function') throw new Error('TRACKING_POLICY_MUTATION_COMMIT_REQUIRED');
    return runStatsMutationBatch(async ({ now, dateStr }) => {
      // No settings write/fence may precede this old-policy durable foreground
      // ACK. The existing live cursor resumes at the same admitted boundary.
      await sealActiveSegment(now, { reopen: true, skipCacheLoad: true, dateStr,
        reason: 'settings_policy_transition' });
      // Revoked recording retires the cursor. Settings never open a closed
      // source; a fresh ordinary foreground observation owns that admission.
      // The callback runs only after canonical cache publication. A failed
      // readback must not reenter cache hydration from this settings writer.
      return commit(now, () => primeActiveTrackingBoundary(now));
    });
  };
}

export function shouldPrimeTrackingBoundary(changedKeys = []) {
  return shouldRunTrackingBoundaryAdapter(changedKeys);
}

export async function primeTrackingBoundaryForSettingsChange({
  changedKeys = [],
  primeActiveTrackingBoundary,
} = {}) {
  if (
    shouldPrimeTrackingBoundary(changedKeys)
    && typeof primeActiveTrackingBoundary === 'function'
  ) {
    await primeActiveTrackingBoundary({ changedKeys });
  }
}
