import { useCallback, useMemo } from 'react';
import { normalizeVisualFrictionSetting, requireVisualFrictionStrength } from '../../../../domains/settings/config/visualFrictionProfiles.js';
import { assertArtifactFamilyConfig, createArtifactBinaryChildHandlers, createArtifactBinaryChildState, resolveToggleChecked } from './shared.js';

const FEATURE_BY_CHILD = Object.freeze({ grayscale: 'saturation', blur: 'blur', brightness: 'brightness', contrast: 'contrast', saturation: 'colorSaturation' });
const STRENGTH_SCHEMA = Object.freeze({ enabled: 'boolean', strength: 'number' });
const LENS_CONFIG_SCHEMA = Object.freeze({ ...Object.fromEntries(Object.keys(FEATURE_BY_CHILD).map(key => [key, STRENGTH_SCHEMA])), fullscreenVisualRelaxation: Object.freeze({ enabled: 'boolean' }) });

export function useLensArtifactSettingsFamily({ blurSetting, saturationSetting, brightnessSetting, contrastSetting, colorSaturationSetting, fullscreenVisualRelaxationSetting, updateFilterEntry, updateNormalizedFilterSettings }) {
  const settings = useMemo(() => ({ blur: blurSetting, saturation: saturationSetting, brightness: brightnessSetting, contrast: contrastSetting, colorSaturation: colorSaturationSetting }), [blurSetting, saturationSetting, brightnessSetting, contrastSetting, colorSaturationSetting]);
  const lensEnabled = Object.values(settings).some(entry => entry.isActive);
  const handleFullscreenVisualRelaxationToggle = useCallback(nextValue => updateFilterEntry('fullscreenVisualRelaxation', { isActive: resolveToggleChecked(nextValue) }), [updateFilterEntry]);
  const applyLensConfig = useCallback((config = {}) => {
    assertArtifactFamilyConfig(config, 'lens', LENS_CONFIG_SCHEMA);
    for (const [child, entry] of Object.entries(config)) if (child !== 'fullscreenVisualRelaxation') requireVisualFrictionStrength(entry.strength);
    return updateNormalizedFilterSettings(base => {
      const next = { ...base };
      for (const [child, feature] of Object.entries(FEATURE_BY_CHILD)) {
        if (config[child]) next[feature] = { isActive: config[child].enabled, value: config[child].strength };
      }
      if (config.fullscreenVisualRelaxation) next.fullscreenVisualRelaxation = { isActive: config.fullscreenVisualRelaxation.enabled, value: true };
      return next;
    });
  }, [updateNormalizedFilterSettings]);
  const artifactFamily = useMemo(() => Object.freeze({
    enabled: lensEnabled,
    fullscreenVisualRelaxation: createArtifactBinaryChildState({ enabled: fullscreenVisualRelaxationSetting.isActive, eligible: lensEnabled, hidden: false }),
    children: Object.freeze(Object.fromEntries(Object.entries(FEATURE_BY_CHILD).map(([child, feature]) => {
      const entry = normalizeVisualFrictionSetting(feature, settings[feature]);
      return [child, Object.freeze({ controlMode: 'range', enabled: entry.isActive, value: entry.value, min: 0, max: 100 })];
    }))),
  }), [lensEnabled, fullscreenVisualRelaxationSetting, settings]);
  const artifactFamilyHandlers = useMemo(() => Object.freeze({
    commitConfig: applyLensConfig,
    fullscreenVisualRelaxation: createArtifactBinaryChildHandlers({ toggle: handleFullscreenVisualRelaxationToggle }),
    children: Object.freeze(Object.fromEntries(Object.entries(FEATURE_BY_CHILD).map(([child, feature]) => [child, Object.freeze({
      controlMode: 'range',
      toggle: nextValue => updateFilterEntry(feature, { isActive: resolveToggleChecked(nextValue) }),
      setValue: value => updateFilterEntry(feature, { value: requireVisualFrictionStrength(value) }),
    })]))),
  }), [applyLensConfig, handleFullscreenVisualRelaxationToggle, updateFilterEntry]);
  return { artifactFamily, artifactFamilyHandlers };
}
export default useLensArtifactSettingsFamily;
