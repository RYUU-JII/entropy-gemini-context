import { normalizeVideoSkipGuardValue } from '../../../../domains/settings/config/videoSkipGuard.js';
import { useCallback, useMemo } from 'react';

import {
  CANONICAL_SCROLL_FRICTION_PROFILE,
  CONFIG_DEFAULT_FILTER_SETTINGS,
} from '../../../../domains/settings/config/index.js';
import {
  assertArtifactFamilyConfig,
  createArtifactBinaryChildHandlers,
  createArtifactBinaryChildState,
  resolveToggleChecked,
} from './shared.js';

const BINARY_CONFIG_SCHEMA = Object.freeze({ enabled: 'boolean' });
const BRAKE_CONFIG_SCHEMA = Object.freeze({
  clickPause: BINARY_CONFIG_SCHEMA,
  scrollFriction: BINARY_CONFIG_SCHEMA,
  inputVisualBrake: BINARY_CONFIG_SCHEMA,
  skipFriction: BINARY_CONFIG_SCHEMA,
});

export function useBrakeArtifactSettingsFamily({
  videoSkipGuardSetting,
  clickDelaySetting,
  scrollFrictionSetting,
  inputVisualBrakeSetting,
  updateFilterEntry,
  updateNormalizedFilterSettings,
}) {
  const videoSkipGuardEnabled = videoSkipGuardSetting.isActive;

  const handleVideoSkipGuardToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateNormalizedFilterSettings((base) => {
      const current = base.videoSkipGuard || CONFIG_DEFAULT_FILTER_SETTINGS.videoSkipGuard;
      return {
        ...base,
        videoSkipGuard: {
          ...current,
          isActive: nextActive,
          value: normalizeVideoSkipGuardValue(current.value),
        },
      };
    });
  }, [updateNormalizedFilterSettings]);

  const clickPauseEnabled = !!clickDelaySetting?.isActive;
  const scrollFrictionEnabled = !!scrollFrictionSetting?.isActive;
  const inputVisualBrakeEnabled = !!inputVisualBrakeSetting?.isActive;

  const handleClickPauseToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateNormalizedFilterSettings((base) => {
      const clickDelay = base.clickDelay || CONFIG_DEFAULT_FILTER_SETTINGS.clickDelay;
      return {
        ...base,
        clickDelay: { ...clickDelay, isActive: nextActive },
      };
    });
  }, [updateNormalizedFilterSettings]);

  const handleScrollFrictionToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateNormalizedFilterSettings((base) => {
      const current = base.scrollFriction || CONFIG_DEFAULT_FILTER_SETTINGS.scrollFriction;
      return {
        ...base,
        scrollFriction: {
          ...current,
          isActive: nextActive,
          value: CANONICAL_SCROLL_FRICTION_PROFILE.delayMs,
        },
      };
    });
  }, [updateNormalizedFilterSettings]);

  const handleInputVisualBrakeToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateFilterEntry('inputVisualBrake', { isActive: nextActive, value: true });
  }, [updateFilterEntry]);

  const applyBrakeConfig = useCallback((config = {}) => {
    assertArtifactFamilyConfig(config, 'brake', BRAKE_CONFIG_SCHEMA);
    return updateNormalizedFilterSettings((base) => {
      const clickDelay = base.clickDelay || CONFIG_DEFAULT_FILTER_SETTINGS.clickDelay;
      const scrollFriction = base.scrollFriction || CONFIG_DEFAULT_FILTER_SETTINGS.scrollFriction;
      const inputVisualBrake = base.inputVisualBrake || CONFIG_DEFAULT_FILTER_SETTINGS.inputVisualBrake;
      const hasClickPauseConfig = config.clickPause && typeof config.clickPause === 'object';
      const hasScrollFrictionConfig = config.scrollFriction && typeof config.scrollFriction === 'object';
      const hasInputVisualBrakeConfig = config.inputVisualBrake && typeof config.inputVisualBrake === 'object';

      return {
        ...base,
        videoSkipGuard: config.skipFriction
          ? { ...base.videoSkipGuard, isActive: config.skipFriction.enabled }
          : base.videoSkipGuard,
        clickDelay: hasClickPauseConfig
          ? {
              ...clickDelay,
              isActive: !!config.clickPause.enabled,
            }
          : clickDelay,
        scrollFriction: hasScrollFrictionConfig
          ? {
              ...scrollFriction,
              isActive: !!config.scrollFriction.enabled,
              value: CANONICAL_SCROLL_FRICTION_PROFILE.delayMs,
            }
          : scrollFriction,
        inputVisualBrake: hasInputVisualBrakeConfig
          ? {
              ...inputVisualBrake,
              isActive: !!config.inputVisualBrake.enabled,
              value: true,
            }
          : inputVisualBrake,
      };
    });
  }, [updateNormalizedFilterSettings]);

  const artifactFamily = useMemo(() => Object.freeze({
    enabled: clickPauseEnabled || scrollFrictionEnabled || inputVisualBrakeEnabled || videoSkipGuardEnabled,
    children: Object.freeze({
      skipFriction: createArtifactBinaryChildState({ enabled: videoSkipGuardEnabled }),
      clickPause: createArtifactBinaryChildState({
        enabled: clickPauseEnabled,
      }),
      scrollFriction: createArtifactBinaryChildState({
        enabled: scrollFrictionEnabled,
      }),
      inputVisualBrake: createArtifactBinaryChildState({
        enabled: inputVisualBrakeEnabled,
      }),
    }),
  }), [
    videoSkipGuardEnabled,
    clickPauseEnabled,
    inputVisualBrakeEnabled,
    scrollFrictionEnabled,
  ]);

  const artifactFamilyHandlers = useMemo(() => Object.freeze({
    commitConfig: applyBrakeConfig,
    children: Object.freeze({
      skipFriction: createArtifactBinaryChildHandlers({ toggle: handleVideoSkipGuardToggle }),
      clickPause: createArtifactBinaryChildHandlers({
        toggle: handleClickPauseToggle,
      }),
      scrollFriction: createArtifactBinaryChildHandlers({
        toggle: handleScrollFrictionToggle,
      }),
      inputVisualBrake: createArtifactBinaryChildHandlers({
        toggle: handleInputVisualBrakeToggle,
      }),
    }),
  }), [
    handleVideoSkipGuardToggle,
    applyBrakeConfig,
    handleClickPauseToggle,
    handleInputVisualBrakeToggle,
    handleScrollFrictionToggle,
  ]);

  return {
    artifactFamily,
    artifactFamilyHandlers,
  };
}

export default useBrakeArtifactSettingsFamily;
