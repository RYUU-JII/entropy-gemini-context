import { requireNudgeGoalEnds, hasEnabledGoalEnd, isGoalEndEnabled } from '../../settings/config/nudgeConfig.js';
import { normalizeDomain } from '../../../lib/domain.js';
import { requireFurinActivityDate, requireFurinDailyReceipt } from '../../../platform/storage/nudge/furinDailyReceiptContract.js';
import { isArtifactState } from '../../protection/contracts/protectionContracts.js';
import { resolveDomainUsageRecording, resolveSitesRecordingPolicy } from '../../settings/config/dataCollectionPolicy.js';
import { INSIGHTS_CONSENT } from '../../settings/config/insightsMode.js';
import { decideFurinDailyDelivery } from './session/furinDailyPolicy.js';

/** Passive admission projection from one fresh runtime read. A ready goal takes
 * the next behavioral opportunity before an optional periodic Enso. */
export function projectReadyGoalPriority({ hostname, activityDay, runtimeSnapshot, settings, dailyReceipt }) {
  requireNudgeGoalEnds(settings?.nudgeConfig?.goalEnds);
  if (typeof hostname !== 'string' || !hostname || normalizeDomain(hostname) !== hostname
    || !activityDay || activityDay.basis !== 'activity-day'
    || !Number.isInteger(activityDay.resetHour) || activityDay.resetHour < 0 || activityDay.resetHour > 23
    || !Number.isSafeInteger(activityDay.activeMs) || activityDay.activeMs < 0
    || !runtimeSnapshot?.policy || !runtimeSnapshot?.dispatch || !runtimeSnapshot?.plan?.artifacts
    || !['siteGoalMinutes', 'globalCapLimitMs', 'globalCapBlockedMs'].every(key => (
      Number.isSafeInteger(runtimeSnapshot.policy[key]) && runtimeSnapshot.policy[key] >= 0))
    || !Number.isSafeInteger(runtimeSnapshot.policy.siteGoalMinutes * 60_000)
    || !['isBlockedDomain', 'shouldApply'].every(key => typeof runtimeSnapshot.dispatch[key] === 'boolean')
    || !isArtifactState(runtimeSnapshot.plan.artifacts.sentinelFlare)
    || !Object.values(INSIGHTS_CONSENT).includes(settings.insightsConsent)
    || !Array.isArray(settings.blockedUrls) || !Array.isArray(settings.trackingExcludedUrls)
    || !settings.siteGoals || typeof settings.siteGoals !== 'object' || Array.isArray(settings.siteGoals)
    || !settings.protectionPresetAssignments?.sitePresetIds) {
    throw new Error('READY_GOAL_PRIORITY_FACTS_REQUIRED');
  }
  requireFurinActivityDate(activityDay.dateStr);
  if (dailyReceipt !== null) requireFurinDailyReceipt(dailyReceipt);
  const siteRecording = resolveDomainUsageRecording(hostname, settings).enabled;
  const globalRecording = resolveSitesRecordingPolicy(settings).globalCapAvailable;
  const unavailable = { goalReady: false, reason: null };
  if (!hasEnabledGoalEnd(settings.nudgeConfig) || !runtimeSnapshot.dispatch.isBlockedDomain
    || !runtimeSnapshot.dispatch.shouldApply || runtimeSnapshot.plan.artifacts.sentinelFlare === 'disabled') {
    return unavailable;
  }
  const { siteGoalMinutes, globalCapLimitMs, globalCapBlockedMs } = runtimeSnapshot.policy;
  if (isGoalEndEnabled(settings.nudgeConfig, 'global') && globalRecording && globalCapLimitMs > 0 && globalCapBlockedMs >= globalCapLimitMs
    && decideFurinDailyDelivery(dailyReceipt, { dateStr: activityDay.dateStr, hostname, protocolScope: 'global' }).eligible) {
    return { goalReady: true, reason: 'global_goal_ready' };
  }
  if (isGoalEndEnabled(settings.nudgeConfig, 'site') && siteRecording && siteGoalMinutes > 0 && activityDay.activeMs >= siteGoalMinutes * 60_000
    && decideFurinDailyDelivery(dailyReceipt, { dateStr: activityDay.dateStr, hostname, protocolScope: 'site' }).eligible) {
    return { goalReady: true, reason: 'site_goal_ready' };
  }
  return unavailable;
}
