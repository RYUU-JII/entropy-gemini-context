import { flareCardSchema } from '../artifactCards/schemas/flareCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React from 'react';
import { useFlareArtifactSettingsFamily } from '@/apps/dashboard/hooks/artifactSettings/useFlareArtifactSettingsFamily.js';
import { useArtifactFamilyProtocolSlice } from '@/apps/dashboard/hooks/artifactSettings/useArtifactFamilyProtocolSlice.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectFlareSettings = (state) => ({
  globalGoal: state.globalGoal,
  nudgeConfig: state.nudgeConfig,
  siteGoals: state.siteGoals,
  blockedUrls: state.blockedUrls,
  protectionPresetAssignments: state.protectionPresetAssignments,
  dataCollectionMode: state.dataCollectionMode,
  insightsConsent: state.insightsConsent,
  trackingExcludedUrls: state.trackingExcludedUrls,
});

export default function SelectedFlareArtifactController({ children, presentation, isActive = true }) {
  const settings = useArtifactFamilyProtocolSlice(selectFlareSettings, isActive);
  const family = useFlareArtifactSettingsFamily(settings);
  const controller = useProtectionArtifactsControlPlane({ artifactId: 'flare', ...family }, isActive);
  const cardController = useSelectedArtifactCard(controller, presentation, isActive, flareCardSchema);
  return children(cardController);
}
