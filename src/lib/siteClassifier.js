import { normalizeDomain } from './domain.js';
import { isHostnameInSiteList } from './siteIdentity.js';
import { FILTERING_MODES, normalizeFilteringMode } from '../domains/settings/config/blockingPolicy.js';

export const SITE_CATEGORY = {
  BLOCKED: 'blocked',
  ALLOWED: 'allowed',
  UNMANAGED: 'unmanaged',
};

export function getSiteCategory(hostname, lists = {}) {
  const domain = normalizeDomain(hostname);
  if (!domain) return SITE_CATEGORY.UNMANAGED;

  const blocked = Array.isArray(lists.blockedUrls) ? lists.blockedUrls : [];
  const allowed = Array.isArray(lists.allowedUrls) ? lists.allowedUrls : [];
  const filteringMode = normalizeFilteringMode(lists.filteringMode ?? FILTERING_MODES.BLOCKLIST);

  if (filteringMode === FILTERING_MODES.ALLOWLIST) {
    return isHostnameInSiteList(domain, allowed) ? SITE_CATEGORY.ALLOWED : SITE_CATEGORY.BLOCKED;
  }

  if (isHostnameInSiteList(domain, blocked)) return SITE_CATEGORY.BLOCKED;
  if (isHostnameInSiteList(domain, allowed)) return SITE_CATEGORY.ALLOWED;
  return SITE_CATEGORY.UNMANAGED;
}
