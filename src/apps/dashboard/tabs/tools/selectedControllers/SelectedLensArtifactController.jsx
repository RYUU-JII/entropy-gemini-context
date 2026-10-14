import { lensCardSchema } from '../artifactCards/schemas/lensCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React from 'react';
import { useLensArtifactSettingsFamily } from '@/apps/dashboard/hooks/artifactSettings/useLensArtifactSettingsFamily.js';
import { useArtifactFamilyProtocolSlice } from '@/apps/dashboard/hooks/artifactSettings/useArtifactFamilyProtocolSlice.js';
import { useArtifactSettingsCommands } from '@/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectLensSettings = (state) => ({
  blurSetting: state.filterSettings.blur,
  saturationSetting: state.filterSettings.saturation,
  brightnessSetting: state.filterSettings.brightness,
  contrastSetting: state.filterSettings.contrast,
  colorSaturationSetting: state.filterSettings.colorSaturation,
  fullscreenVisualRelaxationSetting: state.filterSettings.fullscreenVisualRelaxation,
  setFilterSettings: state.setFilterSettings,
  setGateConfig: state.setGateConfig,
});

export default function SelectedLensArtifactController({ children, presentation, isActive = true }) {
  const settings = useArtifactFamilyProtocolSlice(selectLensSettings, isActive);
  const commands = useArtifactSettingsCommands(settings);
  const family = useLensArtifactSettingsFamily({ ...settings, ...commands });
  const controller = useProtectionArtifactsControlPlane({ artifactId: 'lens', ...family }, isActive);
  const cardController = useSelectedArtifactCard(controller, presentation, isActive, lensCardSchema);
  return children(cardController);
}
