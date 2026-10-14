import { useMemo } from 'react';
import { hasEnabledGoalEnd, isGoalEndEnabled } from '../../../../domains/settings/config/nudgeConfig.js';
import { createArtifactBinaryChildState } from './shared.js';
import { buildFurinTargetFeedback } from '../../utils/furinTargetFeedback.js';
import { buildFurinTimeAvailability } from '../../utils/furinTimeAvailability.js';

// Settings owns goal-end activation. Tools retains only this selected-family
// projection; family suspension stays on the independent control-plane owner.
export function useFlareArtifactSettingsFamily({
  globalGoal, nudgeConfig, siteGoals, blockedUrls, protectionPresetAssignments,
  dataCollectionMode, insightsConsent, trackingExcludedUrls,
}) {
  const enabled = hasEnabledGoalEnd(nudgeConfig);
  const siteEnabled = isGoalEndEnabled(nudgeConfig, 'site');
  const globalEnabled = isGoalEndEnabled(nudgeConfig, 'global');
  const goalEnds = useMemo(() => Object.freeze({ site: siteEnabled, global: globalEnabled }), [siteEnabled, globalEnabled]);
  const admittedTargets = useMemo(() => ({
    globalGoal: globalEnabled ? globalGoal : 0, siteGoals: siteEnabled ? siteGoals : {},
  }), [globalEnabled, globalGoal, siteEnabled, siteGoals]);
  const targetFeedback = useMemo(() => buildFurinTargetFeedback(admittedTargets), [admittedTargets]);
  const timeAvailability = useMemo(() => buildFurinTimeAvailability({
    ...admittedTargets, blockedUrls, protectionPresetAssignments,
    dataCollectionMode, insightsConsent, trackingExcludedUrls,
  }), [admittedTargets, blockedUrls, protectionPresetAssignments,
    dataCollectionMode, insightsConsent, trackingExcludedUrls]);
  const artifactFamily = useMemo(() => Object.freeze({
    enabled, goalEnds,
    children: Object.freeze({ sentinelFlare: createArtifactBinaryChildState({ enabled, goalEnds, targetFeedback, timeAvailability }) }),
  }), [enabled, goalEnds, targetFeedback, timeAvailability]);
  const artifactFamilyHandlers = useMemo(() => Object.freeze({ children: Object.freeze({}) }), []);
  return { artifactFamily, artifactFamilyHandlers };
}

export default useFlareArtifactSettingsFamily;
