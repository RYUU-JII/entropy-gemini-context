import {
  FILTERING_MODES,
  resolveDomainBlockState,
} from '../../../../domains/settings/config/blockingPolicy.js';
import { resolveScheduleRuntimePolicy } from '../../../../domains/schedule/core/scheduleRuntimePolicy.js';
import {
  isPrecisionInsightsSignalEnabledForHostname,
} from '../../../../domains/settings/config/dataCollectionPolicy.js';

export function createBackgroundBehaviorPolicy({
  settingsCache,
  getActiveHostname,
  getSpecialSessionState,
  getSkippedOccurrenceId,
} = {}) {
  if (!settingsCache || typeof settingsCache !== 'object' || Array.isArray(settingsCache)) {
    throw new Error('BACKGROUND_BEHAVIOR_POLICY_SETTINGS_CACHE_REQUIRED');
  }
  if (typeof getActiveHostname !== 'function') {
    throw new Error('BACKGROUND_BEHAVIOR_POLICY_ACTIVE_HOSTNAME_OWNER_REQUIRED');
  }

  for (const [owner, fn] of Object.entries({ getSpecialSessionState, getSkippedOccurrenceId })) {
    if (typeof fn !== 'function') throw new Error(`BACKGROUND_BEHAVIOR_POLICY_TEMPORAL_OWNER_REQUIRED:${owner}`);
  }

  function resolveTemporalPolicy(settings, now) {
    return resolveScheduleRuntimePolicy({ schedule: settings.relaxationSchedule,
      specialSession: getSpecialSessionState(), skippedOccurrenceId: getSkippedOccurrenceId(), now });
  }
  function resolveRulesAwareFilteringMode(settings = settingsCache, now = Date.now()) {
    return resolveTemporalPolicy(settings, now).mode === 'isolation' ? FILTERING_MODES.ALLOWLIST : settings.filteringMode;
  }

  function isBlockedHostname(hostname, now = Date.now()) {
    if (!hostname) return false;
    const policy = resolveTemporalPolicy(settingsCache, now);
    return resolveDomainBlockState({
      hostname,
      blockedUrls: settingsCache.blockedUrls,
      allowedUrls: settingsCache.allowedUrls,
      temporaryAllowedUrls: policy.isolationSession.temporaryAllowedHosts,
      filteringMode: policy.mode === 'isolation' ? FILTERING_MODES.ALLOWLIST : settingsCache.filteringMode,
    }).isBlockedDomain;
  }

  function shouldCollectBehaviorForActiveTab(signalId = '') {
    return isPrecisionInsightsSignalEnabledForHostname(getActiveHostname(), settingsCache, signalId);
  }

  function shouldCollectBehaviorForHostname(hostname, signalId = '') {
    return isPrecisionInsightsSignalEnabledForHostname(hostname, settingsCache, signalId);
  }

  return {
    resolveRulesAwareFilteringMode,
    isBlockedHostname,
    shouldCollectBehaviorForActiveTab,
    shouldCollectBehaviorForHostname,
  };
}

export default createBackgroundBehaviorPolicy;
