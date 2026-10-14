import { brakeCardSchema } from '../artifactCards/schemas/brakeCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React from 'react';
import { useBrakeArtifactSettingsFamily } from '@/apps/dashboard/hooks/artifactSettings/useBrakeArtifactSettingsFamily.js';
import { useArtifactFamilyProtocolSlice } from '@/apps/dashboard/hooks/artifactSettings/useArtifactFamilyProtocolSlice.js';
import { useArtifactSettingsCommands } from '@/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectBrakeSettings = (state) => ({
  clickDelaySetting: state.filterSettings.clickDelay,
  scrollFrictionSetting: state.filterSettings.scrollFriction,
  inputVisualBrakeSetting: state.filterSettings.inputVisualBrake,
  videoSkipGuardSetting: state.filterSettings.videoSkipGuard,
  setFilterSettings: state.setFilterSettings,
  setGateConfig: state.setGateConfig,
});

export default function SelectedBrakeArtifactController({ children, presentation, isActive = true }) {
  const settings = useArtifactFamilyProtocolSlice(selectBrakeSettings, isActive);
  const commands = useArtifactSettingsCommands(settings);
  const family = useBrakeArtifactSettingsFamily({ ...settings, ...commands });
  const controller = useProtectionArtifactsControlPlane({ artifactId: 'brake', ...family }, isActive);
  const cardController = useSelectedArtifactCard(controller, presentation, isActive, brakeCardSchema);
  return children(cardController);
}
