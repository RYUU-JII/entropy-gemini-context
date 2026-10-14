import {
  resolveSitesRecordingPolicy,
  resolveTimeCapAvailability,
} from '../../../domains/settings/config/dataCollectionPolicy.js';
import { buildFurinTargetFeedback } from './furinTargetFeedback.js';
import { normalizeSiteGoals } from '../../../domains/settings/config/siteRules.js';
import { normalizeDomain } from '../../../lib/domain.js';

const REASONS = new Set(['no_sites', 'unconfigured', 'mode_off', 'consent_required',
  'excluded', 'global_only', 'site_only', 'global_and_site']);

// A read-only explanation of the configured time boundaries. Runtime engagement,
// foreground admission and daily intervention receipts retain their own owners.
export function buildFurinTimeAvailability(settings) {
  const targets = buildFurinTargetFeedback(settings);
  if (!Array.isArray(settings.blockedUrls) || !Array.isArray(settings.trackingExcludedUrls)) {
    throw new Error('FURIN_TIME_RECORDING_SCOPE_REQUIRED');
  }
  const recording = resolveSitesRecordingPolicy(settings);
  // Recording policy also includes historical goal/preset owners; Furin runtime
  // dispatch requires an actual blocked-domain scope, so those cannot add targets.
  const protectedDomains = [...new Set(settings.blockedUrls.map(normalizeDomain))];
  const siteGoals = normalizeSiteGoals(settings.siteGoals);
  const availableDomains = protectedDomains.filter(domain => resolveTimeCapAvailability(domain, settings).available);
  const availableSiteTargetCount = availableDomains.filter(domain => Object.hasOwn(siteGoals, domain)).length;
  const configuredSiteTargetCount = protectedDomains.filter(domain => Object.hasOwn(siteGoals, domain)).length;
  const globalTargetMinutes = recording.globalCapAvailable && availableDomains.length > 0 ? targets.globalTargetMinutes : 0;
  let reason;
  if (protectedDomains.length === 0) reason = 'no_sites';
  else if (recording.effectiveScope === 'off') reason = recording.reason;
  else if (targets.globalTargetMinutes === 0 && configuredSiteTargetCount === 0) reason = 'unconfigured';
  else if (globalTargetMinutes > 0) reason = availableSiteTargetCount > 0 ? 'global_and_site' : 'global_only';
  else reason = availableSiteTargetCount > 0 ? 'site_only' : 'excluded';

  return Object.freeze({ reason, globalTargetMinutes, siteTargetCount: availableSiteTargetCount });
}

export function requireFurinTimeAvailability(value) {
  if (!value || !REASONS.has(value.reason)
    || !Number.isInteger(value.globalTargetMinutes) || value.globalTargetMinutes < 0
    || !Number.isInteger(value.siteTargetCount) || value.siteTargetCount < 0) {
    throw new Error('FURIN_TIME_AVAILABILITY_INVALID');
  }
  return value;
}
