import { veilCardSchema } from '../artifactCards/schemas/veilCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React from 'react';
import { useVeilArtifactSettingsFamily } from '@/apps/dashboard/hooks/artifactSettings/useVeilArtifactSettingsFamily.js';
import { useArtifactFamilyProtocolSlice } from '@/apps/dashboard/hooks/artifactSettings/useArtifactFamilyProtocolSlice.js';
import { useArtifactSettingsCommands } from '@/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectVeilSettings = (state) => ({
  socialMetricsSetting: state.filterSettings.socialMetrics,
  shortFormBlockSetting: state.filterSettings.shortFormBlock,
  setFilterSettings: state.setFilterSettings,
  setGateConfig: state.setGateConfig,
});

export default function SelectedVeilArtifactController({ children, presentation, isActive = true }) {
  const settings = useArtifactFamilyProtocolSlice(selectVeilSettings, isActive);
  const commands = useArtifactSettingsCommands(settings);
  const family = useVeilArtifactSettingsFamily({ ...settings, ...commands });
  const controller = useProtectionArtifactsControlPlane({ artifactId: 'veil', ...family }, isActive);
  const cardController = useSelectedArtifactCard(controller, presentation, isActive, veilCardSchema);
  return children(cardController);
}
