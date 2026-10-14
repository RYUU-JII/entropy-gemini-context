import { gateCardSchema } from '../artifactCards/schemas/gateCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React from 'react';
import { useGateArtifactSettingsFamily } from '@/apps/dashboard/hooks/artifactSettings/useGateArtifactSettingsFamily.js';
import { useArtifactFamilyProtocolSlice } from '@/apps/dashboard/hooks/artifactSettings/useArtifactFamilyProtocolSlice.js';
import { useArtifactSettingsCommands } from '@/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectGateSettings = (state) => ({
  normalizedGateSettings: { entryCheckpoint: state.gateConfig.entryCheckpoint, returnGuard: state.gateConfig.returnGuard },
  setFilterSettings: state.setFilterSettings,
  setGateConfig: state.setGateConfig,
});

export default function SelectedGateArtifactController({ children, presentation, isActive = true }) {
  const settings = useArtifactFamilyProtocolSlice(selectGateSettings, isActive);
  const commands = useArtifactSettingsCommands(settings);
  const family = useGateArtifactSettingsFamily({ ...settings, ...commands });
  const controller = useProtectionArtifactsControlPlane({ artifactId: 'gate', ...family }, isActive);
  const cardController = useSelectedArtifactCard(controller, presentation, isActive, gateCardSchema);
  return children(cardController);
}
