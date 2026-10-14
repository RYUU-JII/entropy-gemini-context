import { barrierCardSchema } from '../artifactCards/schemas/barrierCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React from 'react';
import { useBarrierArtifactSettingsFamily } from '@/apps/dashboard/hooks/artifactSettings/useBarrierArtifactSettingsFamily.js';
import { useArtifactFamilyProtocolSlice } from '@/apps/dashboard/hooks/artifactSettings/useArtifactFamilyProtocolSlice.js';
import { useArtifactSettingsCommands } from '@/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectBarrierSettings = (state) => ({
  ensoGateSetting: state.filterSettings.ensoGate,
  textRhythmSetting: state.filterSettings.textRhythm,
  normalizedGateSettings: { detourSpreadGuard: state.gateConfig.detourSpreadGuard },
  tabManagement: state.tabManagement,
  setFilterSettings: state.setFilterSettings,
  setGateConfig: state.setGateConfig,
  setTabManagement: state.setTabManagement,
});

export default function SelectedBarrierArtifactController({ children, presentation, isActive = true }) {
  const settings = useArtifactFamilyProtocolSlice(selectBarrierSettings, isActive);
  const commands = useArtifactSettingsCommands(settings);
  const family = useBarrierArtifactSettingsFamily({ ...settings, ...commands });
  const controller = useProtectionArtifactsControlPlane({ artifactId: 'barrier', ...family }, isActive);
  const cardController = useSelectedArtifactCard(controller, presentation, isActive, barrierCardSchema);
  return children(cardController);
}
