import { resolveDomainUsageRecording } from '../../../settings/config/dataCollectionPolicy.js';

// Historical facts remain intact. Current Sites/protection reads admit only
// the domains permitted now, so revocation cannot surface stale usage as live.
export function resolveRecordingProjectionDomains(statsRange, policy) {
  const domains = new Set();
  for (const day of Object.values(statsRange.dates)) {
    for (const domain of Object.keys(day.domains)) domains.add(domain);
  }
  return Array.from(domains).filter((domain) => resolveDomainUsageRecording(domain, policy).enabled);
}
