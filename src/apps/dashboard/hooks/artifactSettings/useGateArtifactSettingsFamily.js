import { useCallback, useMemo } from 'react';

import {
  DEFAULT_GATE_CONFIG,
} from '../../../../domains/settings/config/gateConfig.js';
import {
  assertArtifactFamilyConfig,
  createArtifactBinaryChildHandlers,
  createArtifactBinaryChildState,
  resolveToggleChecked,
} from './shared.js';

const BINARY_CONFIG_SCHEMA = Object.freeze({ enabled: 'boolean' });
const GATE_CONFIG_SCHEMA = Object.freeze({
  entryCheckpoint: BINARY_CONFIG_SCHEMA,
  returnGuard: BINARY_CONFIG_SCHEMA,
});

export function useGateArtifactSettingsFamily({
  normalizedGateSettings,
  updateNormalizedGateConfig,
}) {
  const entryCheckpointSetting = normalizedGateSettings.entryCheckpoint || DEFAULT_GATE_CONFIG.entryCheckpoint;
  const returnGuardSetting = normalizedGateSettings.returnGuard || DEFAULT_GATE_CONFIG.returnGuard;

  const entryCheckpointEnabled = !!entryCheckpointSetting?.enabled;
  const returnGuardEnabled = !!returnGuardSetting?.enabled;

  const updateGateChildConfig = useCallback(async (key, patchOrUpdater) => (
    updateNormalizedGateConfig((base) => {
      const current = base?.[key] || DEFAULT_GATE_CONFIG[key] || { enabled: false };
      const nextPatch = typeof patchOrUpdater === 'function'
        ? patchOrUpdater(current, base)
        : patchOrUpdater;
      return {
        ...base,
        [key]: {
          ...current,
          ...(nextPatch && typeof nextPatch === 'object' ? nextPatch : {}),
        },
      };
    })
  ), [updateNormalizedGateConfig]);

  const handleGateEntryCheckpointToggle = useCallback((nextValue) => (
    updateGateChildConfig('entryCheckpoint', {
      enabled: resolveToggleChecked(nextValue),
    })
  ), [updateGateChildConfig]);

  const handleGateReturnGuardToggle = useCallback((nextValue) => (
    updateGateChildConfig('returnGuard', {
      enabled: resolveToggleChecked(nextValue),
    })
  ), [updateGateChildConfig]);

  const applyGateConfig = useCallback(async (config = {}) => {
    assertArtifactFamilyConfig(config, 'gate', GATE_CONFIG_SCHEMA);
    const next = await updateNormalizedGateConfig((base) => ({
      ...base,
      entryCheckpoint: config.entryCheckpoint
        ? {
            ...base.entryCheckpoint,
            enabled: config.entryCheckpoint.enabled,
          }
        : base.entryCheckpoint,
      returnGuard: config.returnGuard
        ? {
            ...base.returnGuard,
            enabled: config.returnGuard.enabled,
          }
        : base.returnGuard,
    }));
    return next;
  }, [updateNormalizedGateConfig]);

  const artifactFamily = useMemo(() => Object.freeze({
    enabled: entryCheckpointEnabled || returnGuardEnabled,
    children: Object.freeze({
      entryCheckpoint: createArtifactBinaryChildState({
        enabled: entryCheckpointEnabled,
      }),
      returnGuard: createArtifactBinaryChildState({
        enabled: returnGuardEnabled,
      }),
    }),
  }), [
    entryCheckpointEnabled,
    returnGuardEnabled,
  ]);

  const artifactFamilyHandlers = useMemo(() => Object.freeze({
    commitConfig: applyGateConfig,
    children: Object.freeze({
      entryCheckpoint: createArtifactBinaryChildHandlers({
        toggle: handleGateEntryCheckpointToggle,
      }),
      returnGuard: createArtifactBinaryChildHandlers({
        toggle: handleGateReturnGuardToggle,
      }),
    }),
  }), [
    applyGateConfig,
    handleGateEntryCheckpointToggle,
    handleGateReturnGuardToggle,
  ]);

  return {
    artifactFamily,
    artifactFamilyHandlers,
  };
}

export default useGateArtifactSettingsFamily;
