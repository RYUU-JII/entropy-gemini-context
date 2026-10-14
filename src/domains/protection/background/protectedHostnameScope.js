import { buildDomainHashCandidates, isDomainInHashList } from '../../../platform/security/domainRuleMatcher.js';
import { resolveProtectionScope } from './protocol/engine/ProtectionScopeResolver.js';

// Shared by live protected-tab inventory and confirmed consumption facts.
// Classification is owned by ProtectionScopeResolver, including hashed rules,
// schedules and isolation exceptions; consumers do not reconstruct it.
export async function resolveProtectedHostnameScope(hostname, settings, now, specialSession, skippedOccurrenceId = null) {
  if (typeof hostname !== 'string' || !hostname) throw new Error('PROTECTED_HOSTNAME_REQUIRED');
  const secret = settings.domainHmacSecret || '';
  const candidates = secret ? await buildDomainHashCandidates(hostname, secret) : null;
  return resolveProtectionScope({
    hostname,
    now,
    blockedUrls: settings.blockedUrls,
    allowedUrls: settings.allowedUrls,
    filteringMode: settings.filteringMode,
    relaxationSchedule: settings.relaxationSchedule,
    specialSession,
    skippedOccurrenceId,
    blockedByHash: await isDomainInHashList(hostname, settings.blockedUrlHashes, secret, candidates),
    allowedByHash: await isDomainInHashList(hostname, settings.allowedUrlHashes, secret, candidates),
  });
}
