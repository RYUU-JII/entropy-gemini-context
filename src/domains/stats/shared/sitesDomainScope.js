import { isHostnameInList } from '../../../lib/domain.js';
import { resolveDomainUsageRecording } from '../../settings/config/dataCollectionPolicy.js';
import { requireSitesSiteDetailDomain } from '../contracts/sitesSiteDetailContracts.js';

function normalizeKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Managed rows aggregate admitted observations under their most specific rule.
export function resolveSitesRegistryDomain(domain, { blockedTargets = [], allowedTargets = [] } = {}) {
  const normalizedDomain = normalizeKey(domain);
  if (!normalizedDomain) return '';
  const managedTargets = [...new Set([...blockedTargets, ...allowedTargets].map(normalizeKey).filter(Boolean))];
  const matches = managedTargets.filter((target) => isHostnameInList(normalizedDomain, [target]))
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
  return matches.length > 0 ? matches[0] : normalizedDomain;
}

// Selection preserves a denied requested hostname. Folding it to an admitted
// parent first would change both the displayed recording state and action target.
export function resolveSitesSelectionDomain(domain, policy) {
  const requestedDomain = requireSitesSiteDetailDomain(domain);
  if (!resolveDomainUsageRecording(requestedDomain, policy).enabled) return requestedDomain;
  return resolveSitesRegistryDomain(requestedDomain, {
    blockedTargets: policy.blockedUrls,
    allowedTargets: policy.allowedUrls,
  });
}
