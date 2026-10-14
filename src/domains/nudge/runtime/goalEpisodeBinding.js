import { requireNudgeGoalEnds } from '../../settings/config/nudgeConfig.js';
import { normalizeDomain } from '../../../lib/domain.js';
import { getProtectedCollectionDomains, resolveDomainUsageRecording, resolveSitesRecordingPolicy } from '../../settings/config/dataCollectionPolicy.js';
import { requireFurinActivityDate } from '../../../platform/storage/nudge/furinDailyReceiptContract.js';
import { INSIGHTS_CONSENT } from '../../settings/config/insightsMode.js';
import { isArtifactState } from '../../protection/contracts/protectionContracts.js';

const KEYS = ['version', 'key', 'runId', 'tabId', 'documentId', 'profileGeneration', 'hostname', 'dateStr', 'resetHour',
  'purpose', 'coveredScopes', 'siteTargetMs', 'globalTargetMs', 'policySignature'].sort();
const text = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const positive = value => Number.isSafeInteger(value) && value > 0;

export function requireGoalEpisodeBinding(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== KEYS.join('|') || value.version !== 1
    || !['key', 'runId', 'documentId', 'profileGeneration', 'hostname', 'policySignature'].every(key => text(value[key]))
    || !Number.isInteger(value.tabId) || value.tabId < 0
    || normalizeDomain(value.hostname) !== value.hostname
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateStr)
    || !Number.isInteger(value.resetHour) || value.resetHour < 0 || value.resetHour > 23
    || !Array.isArray(value.coveredScopes)
    || !['site', 'global', 'global|site'].includes(value.coveredScopes.join('|'))
    || value.purpose !== (value.coveredScopes[0] === 'global' ? 'global_goal' : 'site_goal')
    || (value.coveredScopes.includes('site') ? !positive(value.siteTargetMs) : value.siteTargetMs !== null)
    || (value.coveredScopes.includes('global') ? !positive(value.globalTargetMs) : value.globalTargetMs !== null)) {
    throw new Error('GOAL_EPISODE_BINDING_INVALID');
  }
  requireFurinActivityDate(value.dateStr);
  if (value.key !== `${value.dateStr}|${value.coveredScopes[0] === 'global' ? '__global_protocol__' : value.hostname}`) {
    throw new Error('GOAL_EPISODE_BINDING_KEY_MISMATCH');
  }
  return Object.freeze({ ...value, coveredScopes: Object.freeze([...value.coveredScopes]) });
}

function requireCurrentFacts({ hostname, activityDay, runtimeSnapshot, settings, profileGeneration }) {
  requireNudgeGoalEnds(settings?.nudgeConfig?.goalEnds);
  if (!text(profileGeneration) || !text(hostname) || normalizeDomain(hostname) !== hostname
    || !activityDay || !/^\d{4}-\d{2}-\d{2}$/.test(activityDay.dateStr)
    || !Number.isInteger(activityDay.resetHour) || activityDay.resetHour < 0 || activityDay.resetHour > 23
    || !Number.isSafeInteger(activityDay.activeMs) || activityDay.activeMs < 0
    || !runtimeSnapshot?.policy || !runtimeSnapshot?.dispatch || !runtimeSnapshot?.plan?.artifacts
    || !['siteGoalMinutes', 'globalCapLimitMs', 'globalCapBlockedMs'].every(key => (
      Number.isSafeInteger(runtimeSnapshot.policy[key]) && runtimeSnapshot.policy[key] >= 0))
    || !['isBlockedDomain', 'shouldApply'].every(key => typeof runtimeSnapshot.dispatch[key] === 'boolean')
    || !isArtifactState(runtimeSnapshot.plan.artifacts.sentinelFlare)
    || !Array.isArray(settings.blockedUrls)
    || !Object.values(INSIGHTS_CONSENT).includes(settings.insightsConsent)
    || !settings.siteGoals || typeof settings.siteGoals !== 'object' || Array.isArray(settings.siteGoals)
    || !settings.protectionPresetAssignments?.sitePresetIds || !Array.isArray(settings.trackingExcludedUrls)) {
    throw new Error('GOAL_EPISODE_CURRENT_FACTS_REQUIRED');
  }
  requireFurinActivityDate(activityDay.dateStr);
}

export function projectGoalEpisodePolicySignature({ hostname, coveredScopes, settings, protected: protectedHost, applying, flareEligible }) {
  if (!['site', 'global', 'global|site'].includes(coveredScopes?.join('|'))
    || ![protectedHost, applying, flareEligible].every(value => typeof value === 'boolean')) throw new Error('GOAL_EPISODE_POLICY_FACTS_REQUIRED');
  const recording = resolveDomainUsageRecording(hostname, settings);
  return JSON.stringify({
    recordingMode: settings.dataCollectionMode,
    recordingConsent: settings.insightsConsent,
    hostRecording: coveredScopes.includes('site') ? recording.enabled : null,
    globalRecording: coveredScopes.includes('global') ? resolveSitesRecordingPolicy(settings).globalCapAvailable : null,
    globalRecordingDomains: coveredScopes.includes('global')
      ? getProtectedCollectionDomains(settings).filter(domain => resolveDomainUsageRecording(domain, settings).enabled).sort() : null,
    goalEnds: Object.fromEntries(coveredScopes.map(scope => [scope, requireNudgeGoalEnds(settings.nudgeConfig.goalEnds)[scope]])),
    protected: protectedHost,
    applying,
    flareEligible,
  });
}

function projectCurrentBinding({ hostname, activityDay, runtimeSnapshot, settings, profileGeneration, key, runId, tabId, documentId, coveredScopes }) {
  requireCurrentFacts({ hostname, activityDay, runtimeSnapshot, settings, profileGeneration });
  const policySignature = projectGoalEpisodePolicySignature({ hostname, coveredScopes, settings,
    protected: runtimeSnapshot.dispatch.isBlockedDomain, applying: runtimeSnapshot.dispatch.shouldApply,
    flareEligible: runtimeSnapshot.plan.artifacts.sentinelFlare !== 'disabled' });
  return {
    version: 1, key, runId, tabId, documentId, profileGeneration, hostname,
    dateStr: activityDay.dateStr, resetHour: activityDay.resetHour,
    purpose: coveredScopes[0] === 'global' ? 'global_goal' : 'site_goal', coveredScopes,
    siteTargetMs: coveredScopes.includes('site') ? runtimeSnapshot.policy.siteGoalMinutes * 60_000 : null,
    globalTargetMs: coveredScopes.includes('global') ? runtimeSnapshot.policy.globalCapLimitMs : null,
    policySignature,
  };
}

export function createGoalEpisodeBinding({ triggerTarget, protocolClaim, ...facts }) {
  if (!['site', 'global'].includes(protocolClaim?.protocolScope)) throw new Error('GOAL_EPISODE_PROTOCOL_SCOPE_REQUIRED');
  const combined = triggerTarget?.episode?.mode === 'combined_goals';
  const coveredScopes = combined ? ['global', 'site'] : protocolClaim?.protocolScope === 'global' ? ['global'] : ['site'];
  if ((combined && (triggerTarget.source !== 'global_protocol'
    || protocolClaim?.protocolScope !== 'global'
    || triggerTarget.episode.coveredScopes?.join('|') !== 'global|site'))
    || (!combined && triggerTarget?.source !== (coveredScopes[0] === 'global' ? 'global_protocol' : 'site_goal'))) {
    throw new Error('GOAL_EPISODE_CANDIDATE_INVALID');
  }
  const binding = requireGoalEpisodeBinding(projectCurrentBinding({ ...facts, coveredScopes }));
  if (triggerTarget.targetMs !== (coveredScopes[0] === 'global' ? binding.globalTargetMs : binding.siteTargetMs)
    || (combined && (triggerTarget.episode.siteTargetMs !== binding.siteTargetMs
      || triggerTarget.episode.globalTargetMs !== binding.globalTargetMs))) {
    throw new Error('GOAL_EPISODE_CANDIDATE_TARGET_MISMATCH');
  }
  const admission = evaluateGoalEpisodeBinding(binding, facts);
  if (!admission.valid) throw new Error(`GOAL_EPISODE_CANDIDATE_INELIGIBLE:${admission.reason}`);
  return binding;
}

/** Relevant semantic values, never a global settings revision or content-side
 * budget calculation. Any changed covered goal requires a fresh episode. */
export function evaluateGoalEpisodeBinding(value, facts) {
  const binding = requireGoalEpisodeBinding(value);
  const current = projectCurrentBinding({ ...facts, hostname: binding.hostname, key: binding.key,
    runId: binding.runId, tabId: binding.tabId, documentId: binding.documentId, coveredScopes: binding.coveredScopes });
  if (current.profileGeneration !== binding.profileGeneration) return { valid: false, reason: 'profile_generation_changed' };
  if (current.dateStr !== binding.dateStr || current.resetHour !== binding.resetHour) return { valid: false, reason: 'activity_day_basis_changed' };
  if (current.siteTargetMs !== binding.siteTargetMs || current.globalTargetMs !== binding.globalTargetMs) return { valid: false, reason: 'goal_values_changed' };
  if (current.policySignature !== binding.policySignature) return { valid: false, reason: 'goal_policy_changed' };
  const policy = JSON.parse(current.policySignature);
  if ((binding.coveredScopes.includes('site') && !policy.hostRecording)
    || (binding.coveredScopes.includes('global') && !policy.globalRecording)
    || !Object.values(policy.goalEnds).every(enabled => enabled === true) || !policy.protected || !policy.applying || !policy.flareEligible) {
    return { valid: false, reason: 'goal_policy_unavailable' };
  }
  if ((binding.siteTargetMs !== null && facts.activityDay.activeMs < binding.siteTargetMs)
    || (binding.globalTargetMs !== null && facts.runtimeSnapshot.policy.globalCapBlockedMs < binding.globalTargetMs)) {
    return { valid: false, reason: 'goal_not_attained' };
  }
  return { valid: true, reason: 'goal_binding_current' };
}

export function areGoalEpisodeBindingsEqual(left, right) {
  const a = requireGoalEpisodeBinding(left), b = requireGoalEpisodeBinding(right);
  return KEYS.every(key => key === 'coveredScopes' ? a[key].join('|') === b[key].join('|') : a[key] === b[key]);
}
