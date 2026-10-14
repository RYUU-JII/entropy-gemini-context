import {
  FILTERING_MODES,
  resolveDomainBlockState,
} from '../../../../settings/config/blockingPolicy.js';
import {
  SPECIAL_SESSION_MODES,
} from '../../../../settings/config/specialSession.js';
import { normalizeDomain } from '../../../../../lib/domain.js';
import { resolveScheduleRuntimePolicy } from '../../../../schedule/core/scheduleRuntimePolicy.js';
import { resolveDomainClassByRules } from '../../../protocol/scope/resolverRules.js';

export function resolveProtectionScope({
  hostname,
  now = Date.now(),
  blockedUrls = [],
  allowedUrls = [],
  filteringMode = FILTERING_MODES.BLOCKLIST,
  relaxationSchedule = null,
  specialSession = null,
  skippedOccurrenceId = null,
  capExceeded = false,
  blockedByHash = null,
  allowedByHash = null,
} = {}) {
  const normalizedHostname = normalizeDomain(hostname);
  const normalizedBlockedUrls = Array.isArray(blockedUrls) ? blockedUrls : [];
  const normalizedAllowedUrls = Array.isArray(allowedUrls) ? allowedUrls : [];
  const temporalPolicy = resolveScheduleRuntimePolicy({ schedule: relaxationSchedule,
    specialSession, skippedOccurrenceId, capExceeded, now });
  const activeSpecialSession = temporalPolicy.isolationSession;
  const temporaryAllowedUrls = activeSpecialSession.active
    && activeSpecialSession.mode === SPECIAL_SESSION_MODES.ISOLATION
    ? activeSpecialSession.temporaryAllowedHosts
    : [];

  const effectiveFilteringMode = temporalPolicy.mode === 'isolation' ? FILTERING_MODES.ALLOWLIST : filteringMode;

  const modeState = resolveDomainBlockState({
    hostname: normalizedHostname,
    blockedUrls: normalizedBlockedUrls,
    allowedUrls: normalizedAllowedUrls,
    temporaryAllowedUrls,
    filteringMode: effectiveFilteringMode,
    blockedByHash,
    allowedByHash,
  });

  const classResolution = resolveDomainClassByRules(modeState);

  return {
    ok: !!classResolution.ok,
    error: classResolution.error || null,
    hostname: normalizedHostname,
    scopeRevision: 1,
    matchedRuleId: classResolution.matchedRuleId || null,
    domainClassId: classResolution.domainClassId || null,
    filteringMode: modeState.filteringMode,
    isBlockedDomain: !!modeState.isBlockedDomain,
    isBlockedListed: !!modeState.isBlockedListed,
    isAllowedListed: !!modeState.isAllowedListed,
    relaxationSchedule,
    specialSession: activeSpecialSession,
    temporalPolicy,
    rankedCandidates: classResolution.rankedCandidates || [],
  };
}

export function createProtectionScopeResolver(defaults = {}) {
  function resolveScope(hostname, options = {}) {
    return resolveProtectionScope({
      ...defaults,
      ...options,
      hostname,
    });
  }

  return {
    resolveScope,
  };
}
