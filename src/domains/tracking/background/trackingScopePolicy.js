import {
  FILTERING_MODES,
  resolveDomainBlockState,
  resolveFilteringModeBySchedule,
} from '../../settings/config/blockingPolicy.js';
import { shouldCollectDomainUsage } from '../../settings/config/dataCollectionPolicy.js';

export const SITE_CATEGORY = {
  BLOCKED: 'blocked',
  ALLOWED: 'allowed',
  UNMANAGED: 'unmanaged',
};

export function resolveStatsCategoryIdFromModeState(modeState) {
  if (modeState?.isBlockedDomain) return 'blocked';
  if (modeState?.isAllowedListed) return 'allowed';
  return 'other';
}

export function resolveTimedFilteringMode(settings, now = Date.now()) {
  return resolveFilteringModeBySchedule({
    filteringMode: settings?.filteringMode || FILTERING_MODES.BLOCKLIST,
    schedule: settings?.relaxationSchedule,
    ts: now,
  });
}

export function getSiteCategory(hostname, settings, now = Date.now()) {
  if (!hostname) return SITE_CATEGORY.UNMANAGED;
  const filteringMode = resolveTimedFilteringMode(settings, now);
  const modeState = resolveDomainBlockState({
    hostname,
    blockedUrls: settings?.blockedUrls,
    allowedUrls: settings?.allowedUrls,
    filteringMode,
  });
  if (modeState.isBlockedDomain) return SITE_CATEGORY.BLOCKED;
  if (modeState.isAllowedListed) return SITE_CATEGORY.ALLOWED;
  return SITE_CATEGORY.UNMANAGED;
}

export function shouldTrackHostname(hostname, settings) {
  return shouldCollectDomainUsage(hostname, settings);
}
