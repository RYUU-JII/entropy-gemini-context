import { buildStatsDashboardPolicyInput, buildStatsDashboardPolicyFingerprint } from '../../analysis/policySnapshot.js';

// Sites is a current-policy workspace, not a policy-preview query. A supplied
// policy is a consistency precondition, never a replacement for owner settings.
export function requireCurrentSitesPolicy(policyInput, settingsSnapshot) {
  const policy = buildStatsDashboardPolicyInput(settingsSnapshot);
  const policyFingerprint = buildStatsDashboardPolicyFingerprint(policy);
  if (policyInput !== null && policyInput !== undefined
    && buildStatsDashboardPolicyFingerprint(policyInput) !== policyFingerprint) {
    throw createSitesPolicyChangedError(policyFingerprint);
  }
  return policy;
}

export function createSitesPolicyChangedError(policyFingerprint) {
  const error = new Error('STATS_SITES_POLICY_CHANGED');
  error.code = 'STATS_SITES_POLICY_CHANGED';
  error.policyFingerprint = policyFingerprint;
  return error;
}
