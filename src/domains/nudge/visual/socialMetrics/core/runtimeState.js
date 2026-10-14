import { resolveSocialMetricVisibilityFromSetting } from '../../../../settings/config/index.js';
import { getMetricGroupForFilterKey } from '../contracts/socialMetricContracts.js';
import {
  createCompiledSocialMetricPlans,
  createSocialMetricSignature,
} from './compiledScanPlan.js';

export function createSocialMetricRuntimeState({
  socialMetricsSetting,
  hostname,
  targetProfile = null,
  resolveTextPatterns,
} = {}) {
  const visibility = resolveSocialMetricVisibilityFromSetting(socialMetricsSetting);
  const engagementActive = visibility.engagement;
  const exposureActive = visibility.exposure;
  const activeMetricKeys = visibility.activeMetricKeys.length > 0
    ? visibility.activeMetricKeys
    : [
      ...(engagementActive ? ['feedbackCounts', 'audienceCounts'] : []),
      ...(exposureActive ? ['viewCounts', 'timeSignals'] : []),
    ];
  const compiled = createCompiledSocialMetricPlans({
    hostname,
    activeMetricKeys,
    targetProfile,
    resolveTextPatterns,
  });
  const activeScanGroups = compiled.plans.map((plan) => ({
    group: plan.group,
    filterKeys: plan.filterKeys.filter((key) => getMetricGroupForFilterKey(key) === plan.group),
  }));
  const signature = createSocialMetricSignature({
    host: compiled.host,
    engagementActive,
    exposureActive,
    rootSelector: compiled.rootSelector,
    plans: compiled.plans,
  });

  return {
    visibility,
    engagementActive,
    exposureActive,
    activeMetricKeys,
    compiled,
    activeScanGroups,
    signature,
    hasPlans: compiled.plans.length > 0,
  };
}
