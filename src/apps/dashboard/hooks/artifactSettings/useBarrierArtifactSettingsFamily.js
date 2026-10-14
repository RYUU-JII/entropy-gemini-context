import { useCallback, useMemo } from 'react';
import { permissionsRequestStrict } from '@/platform/chrome/ChromeService.js';
import { normalizeTabManagement } from '@/domains/settings/config/tabManagement.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
} from '../../../../domains/settings/config/index.js';
import {
  DEFAULT_GATE_CONFIG,
  normalizeGateMaxProtectedTabs,
} from '../../../../domains/settings/config/gateConfig.js';
import { normalizeEnsoGateEntry, resolveEnsoIntervalMs } from '../../../../domains/settings/config/ensoIntervalPolicy.js';
import {
  assertArtifactFamilyConfig,
  buildTextRhythmPatch,
  createArtifactBinaryChildHandlers,
  createArtifactBinaryChildState,
  createArtifactChoiceChildHandlers,
  createArtifactChoiceChildState,
  resolveToggleChecked,
} from './shared.js';

const BINARY_CONFIG_SCHEMA = Object.freeze({ enabled: 'boolean' });
const BARRIER_CONFIG_SCHEMA = Object.freeze({
  intentThreshold: Object.freeze({ enabled: 'boolean', interval: 'string' }),
  textRhythm: BINARY_CONFIG_SCHEMA,
  detourSpreadGuard: Object.freeze({ enabled: 'boolean', maxProtectedTabs: 'number' }),
});

export function useBarrierArtifactSettingsFamily({
  ensoGateSetting,
  textRhythmSetting,
  normalizedGateSettings,
  tabManagement,
  updateNormalizedFilterSettings,
  updateNormalizedGateConfig,
  updateTabManagement,
}) {
  const { t } = useAppTranslation('tools');
  const groupProtectedTabs = normalizeTabManagement(tabManagement).groupProtectedTabs;
  const intentThresholdEnabled = ensoGateSetting.isActive;
  const ensoIntervalPreset = normalizeEnsoGateEntry(ensoGateSetting).value;
  const textRhythmEnabled = !!textRhythmSetting?.isActive;
  const detourSpreadGuardSetting = normalizedGateSettings?.detourSpreadGuard || DEFAULT_GATE_CONFIG.detourSpreadGuard;
  const detourSpreadGuardEnabled = !!detourSpreadGuardSetting?.enabled;
  const detourSpreadGuardMaxProtectedTabs = normalizeGateMaxProtectedTabs(
    detourSpreadGuardSetting.maxProtectedTabs,
  );
  const handleBarrierIntentThresholdToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateNormalizedFilterSettings((base) => {
      const current = normalizeEnsoGateEntry(base.ensoGate);
      return {
        ...base,
        ensoGate: {
          ...current,
          isActive: nextActive,
        },
      };
    });
  }, [updateNormalizedFilterSettings]);

  const handleBarrierIntentIntervalChange = useCallback((value) => {
    resolveEnsoIntervalMs(value);
    return updateNormalizedFilterSettings((base) => ({
      ...base,
      ensoGate: { ...base.ensoGate, value },
    }));
  }, [updateNormalizedFilterSettings]);

  const handleTextRhythmToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateNormalizedFilterSettings((base) => ({
      ...base,
      ...buildTextRhythmPatch(nextActive),
    }));
  }, [updateNormalizedFilterSettings]);

  const handleDetourSpreadGuardToggle = useCallback((nextValue) => (
    updateNormalizedGateConfig((base) => ({
      ...base,
      detourSpreadGuard: {
        ...(base?.detourSpreadGuard || DEFAULT_GATE_CONFIG.detourSpreadGuard),
        enabled: resolveToggleChecked(nextValue),
        maxProtectedTabs: normalizeGateMaxProtectedTabs(
          base?.detourSpreadGuard?.maxProtectedTabs
            ?? detourSpreadGuardMaxProtectedTabs,
        ),
      },
    }))
  ), [detourSpreadGuardMaxProtectedTabs, updateNormalizedGateConfig]);

  const handleDetourSpreadGuardMaxProtectedTabsChange = useCallback((nextMaxProtectedTabs) => {
    const maxProtectedTabs = normalizeGateMaxProtectedTabs(nextMaxProtectedTabs);
    return updateNormalizedGateConfig((base) => {
      const current = base?.detourSpreadGuard || DEFAULT_GATE_CONFIG.detourSpreadGuard;
      return {
        ...base,
        detourSpreadGuard: {
          ...current,
          enabled: current.enabled,
          maxProtectedTabs,
        },
      };
    });
  }, [updateNormalizedGateConfig]);

  const handleGroupProtectedTabsToggle = useCallback(async (nextValue) => {
    const enabled = resolveToggleChecked(nextValue);
    // Invoke the browser request before the first await to retain the gesture.
    if (enabled && await permissionsRequestStrict({ permissions: ['tabGroups'] }) !== true) {
      throw new Error(t('artifacts.barrier.tab_management.permission_denied'));
    }
    return updateTabManagement({ groupProtectedTabs: enabled });
  }, [t, updateTabManagement]);

  const applyBarrierConfig = useCallback(async (config = {}) => {
    assertArtifactFamilyConfig(config, 'barrier', BARRIER_CONFIG_SCHEMA);
    if (config.detourSpreadGuard) {
      normalizeGateMaxProtectedTabs(config.detourSpreadGuard.maxProtectedTabs);
    }
    const filterResult = await updateNormalizedFilterSettings((base) => {
      const next = { ...base };
      if (config.intentThreshold) {
        resolveEnsoIntervalMs(config.intentThreshold.interval);
        next.ensoGate = { ...base.ensoGate, isActive: config.intentThreshold.enabled, value: config.intentThreshold.interval };
      }
      if (config.textRhythm) {
        Object.assign(next, buildTextRhythmPatch(config.textRhythm.enabled));
      }
      return next;
    });

    if (config.detourSpreadGuard && typeof config.detourSpreadGuard === 'object') {
      return updateNormalizedGateConfig((base) => ({
        ...base,
        detourSpreadGuard: {
          ...(base?.detourSpreadGuard || DEFAULT_GATE_CONFIG.detourSpreadGuard),
          enabled: config.detourSpreadGuard.enabled === true,
          maxProtectedTabs: normalizeGateMaxProtectedTabs(
            config.detourSpreadGuard.maxProtectedTabs,
          ),
        },
      }));
    }
    return filterResult;
  }, [
    updateNormalizedFilterSettings,
    updateNormalizedGateConfig,
  ]);

  const artifactFamily = useMemo(() => Object.freeze({
    enabled: intentThresholdEnabled || textRhythmEnabled || detourSpreadGuardEnabled,
    // A browser presentation setting, deliberately outside intervention children.
    tabManagement: Object.freeze({ groupProtectedTabs }),
    children: Object.freeze({
      intentThreshold: createArtifactChoiceChildState({ enabled: intentThresholdEnabled, value: ensoIntervalPreset }),
      textRhythm: createArtifactBinaryChildState({
        enabled: textRhythmEnabled,
      }),
      detourSpreadGuard: createArtifactChoiceChildState({
        enabled: detourSpreadGuardEnabled,
        value: detourSpreadGuardMaxProtectedTabs,
      }),
    }),
  }), [
    detourSpreadGuardEnabled,
    detourSpreadGuardMaxProtectedTabs,
    groupProtectedTabs,
    intentThresholdEnabled,
    ensoIntervalPreset,
    textRhythmEnabled,
  ]);

  const artifactFamilyHandlers = useMemo(() => Object.freeze({
    commitConfig: applyBarrierConfig,
    tabManagement: Object.freeze({ toggle: handleGroupProtectedTabsToggle }),
    children: Object.freeze({
      intentThreshold: createArtifactChoiceChildHandlers({ toggle: handleBarrierIntentThresholdToggle, setValue: handleBarrierIntentIntervalChange }),
      textRhythm: createArtifactBinaryChildHandlers({
        toggle: handleTextRhythmToggle,
      }),
      detourSpreadGuard: createArtifactChoiceChildHandlers({
        toggle: handleDetourSpreadGuardToggle,
        setValue: handleDetourSpreadGuardMaxProtectedTabsChange,
      }),
    }),
  }), [
    applyBarrierConfig,
    handleDetourSpreadGuardMaxProtectedTabsChange,
    handleDetourSpreadGuardToggle,
    handleGroupProtectedTabsToggle,
    handleBarrierIntentThresholdToggle,
    handleBarrierIntentIntervalChange,
    handleTextRhythmToggle,
  ]);

  return {
    artifactFamily,
    artifactFamilyHandlers,
  };
}

export default useBarrierArtifactSettingsFamily;
