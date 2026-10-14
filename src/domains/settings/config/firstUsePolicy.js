import { INSIGHTS_CONSENT } from './insightsMode.js';
import { DATA_COLLECTION_MODES, PRECISION_INSIGHTS_MODES } from './dataCollectionPolicy.js';
import { buildLocalUsagePolicyPatch } from './localUsagePolicy.js';

export const FIRST_USE_POLICY_KEYS = Object.freeze([
  'dataCollectionMode', 'precisionInsightsMode', 'precisionInsightsSignals', 'insightsMode', 'insightsConsent',
]);

// Evaluated against the latest settings inside the serialized mutation owner.
// A stale first-use document cannot overwrite a choice made in another document.
export function buildFirstUsePolicyPatch(snapshot, recordProtectedSites) {
  if (typeof recordProtectedSites !== 'boolean') throw new Error('FIRST_USE_RECORDING_CHOICE_INVALID');
  if (snapshot.insightsConsent !== INSIGHTS_CONSENT.UNSET) throw new Error('FIRST_USE_ALREADY_COMPLETED');
  return buildLocalUsagePolicyPatch({
    dataCollectionMode: recordProtectedSites ? DATA_COLLECTION_MODES.PROTECTED_SITES : DATA_COLLECTION_MODES.OFF,
    precisionInsightsMode: PRECISION_INSIGHTS_MODES.OFF,
    precisionInsightsSignals: snapshot.precisionInsightsSignals,
  });
}
