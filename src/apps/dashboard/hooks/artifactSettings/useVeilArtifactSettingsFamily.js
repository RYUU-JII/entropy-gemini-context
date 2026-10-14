import { useCallback, useMemo } from 'react';

import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  buildSocialMetricOptionsForScope,
  hasActiveSocialMetricOptions,
  normalizeSocialMetricOptions,
  normalizeSocialMetricScope,
  resolveSocialMetricScope,
} from '../../../../domains/settings/config/index.js';
import {
  assertArtifactFamilyConfig,
  createArtifactBinaryChildHandlers,
  createArtifactBinaryChildState,
  createArtifactChoiceChildHandlers,
  createArtifactChoiceChildState,
  resolveToggleChecked,
} from './shared.js';

const BINARY_CONFIG_SCHEMA = Object.freeze({ enabled: 'boolean' });
const VEIL_CONFIG_SCHEMA = Object.freeze({
  socialMetrics: Object.freeze({ enabled: 'boolean', scope: 'string' }),
  timeSignals: BINARY_CONFIG_SCHEMA,
  shortformBlock: BINARY_CONFIG_SCHEMA,
});

export function useVeilArtifactSettingsFamily({
  socialMetricsSetting,
  shortFormBlockSetting,
  updateSocialMetricsSetting,
  updateNormalizedFilterSettings,
}) {
  const socialMetricOptions = useMemo(
    () => normalizeSocialMetricOptions(socialMetricsSetting?.value),
    [socialMetricsSetting?.value],
  );
  const socialMetricScope = useMemo(
    () => resolveSocialMetricScope(socialMetricOptions),
    [socialMetricOptions],
  );

  const veilSocialMetricsEnabled = !!socialMetricsSetting?.isActive
    && (
      socialMetricOptions.feedbackCounts
      || socialMetricOptions.viewCounts
      || socialMetricOptions.audienceCounts
    );
  const veilTimeSignalsEnabled = !!socialMetricsSetting?.isActive && socialMetricOptions.timeSignals;
  const shortFormBlockEnabled = shortFormBlockSetting.isActive;

  const handleShortFormBlockToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateNormalizedFilterSettings((base) => {
      const current = base.shortFormBlock || CONFIG_DEFAULT_FILTER_SETTINGS.shortFormBlock;
      return {
        ...base,
        shortFormBlock: {
          ...current,
          isActive: nextActive,
        },
      };
    });
  }, [updateNormalizedFilterSettings]);

  const handleVeilSocialMetricsToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateSocialMetricsSetting((current) => {
      const currentOptions = normalizeSocialMetricOptions(current?.value);
      const nextOptions = nextActive
        ? buildSocialMetricOptionsForScope(resolveSocialMetricScope(currentOptions), {
          timeSignals: currentOptions.timeSignals,
        })
        : {
          ...currentOptions,
          feedbackCounts: false,
          viewCounts: false,
          audienceCounts: false,
        };
      return {
        isActive: hasActiveSocialMetricOptions(nextOptions),
        value: nextOptions,
      };
    });
  }, [updateSocialMetricsSetting]);

  const handleVeilSocialMetricScopeChange = useCallback((nextScope) => {
    const scope = normalizeSocialMetricScope(nextScope);
    return updateSocialMetricsSetting((current) => {
      const currentOptions = normalizeSocialMetricOptions(current?.value);
      const nextOptions = buildSocialMetricOptionsForScope(scope, {
        timeSignals: currentOptions.timeSignals,
      });
      return {
        isActive: true,
        value: nextOptions,
      };
    });
  }, [updateSocialMetricsSetting]);

  const handleVeilTimeSignalsToggle = useCallback((nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    return updateSocialMetricsSetting((current) => {
      const currentOptions = normalizeSocialMetricOptions(current?.value);
      const nextOptions = {
        ...currentOptions,
        timeSignals: nextActive,
      };
      return {
        isActive: hasActiveSocialMetricOptions(nextOptions),
        value: nextOptions,
      };
    });
  }, [updateSocialMetricsSetting]);

  const applyVeilConfig = useCallback((config = {}) => {
    assertArtifactFamilyConfig(config, 'veil', VEIL_CONFIG_SCHEMA);
    return updateNormalizedFilterSettings((base) => {
      const currentSocialMetrics = base.socialMetrics || CONFIG_DEFAULT_FILTER_SETTINGS.socialMetrics;
      const currentMetricOptions = normalizeSocialMetricOptions(currentSocialMetrics.value);
      const hasSocialMetricsConfig = !!config.socialMetrics
        && typeof config.socialMetrics === 'object'
        && !Array.isArray(config.socialMetrics);
      const hasTimeSignalsConfig = !!config.timeSignals
        && typeof config.timeSignals === 'object'
        && !Array.isArray(config.timeSignals);
      let nextMetricOptions = currentMetricOptions;

      if (hasSocialMetricsConfig || hasTimeSignalsConfig) {
        const requestedScope = hasSocialMetricsConfig
          ? normalizeSocialMetricScope(config.socialMetrics.scope)
          : resolveSocialMetricScope(currentMetricOptions);
        nextMetricOptions = buildSocialMetricOptionsForScope(requestedScope, {
          timeSignals: hasTimeSignalsConfig
            ? config.timeSignals.enabled === true
            : currentMetricOptions.timeSignals,
        });
        if (hasSocialMetricsConfig && config.socialMetrics.enabled !== true) {
          nextMetricOptions = {
            ...nextMetricOptions,
            feedbackCounts: false,
            viewCounts: false,
            audienceCounts: false,
          };
        }
      }

      return {
        ...base,
        socialMetrics: hasSocialMetricsConfig || hasTimeSignalsConfig
          ? {
              ...currentSocialMetrics,
              isActive: hasActiveSocialMetricOptions(nextMetricOptions),
              value: nextMetricOptions,
            }
          : currentSocialMetrics,
        shortFormBlock: config.shortformBlock
          ? { ...base.shortFormBlock, isActive: config.shortformBlock.enabled }
          : base.shortFormBlock,
      };
    });
  }, [updateNormalizedFilterSettings]);

  const artifactFamily = useMemo(() => Object.freeze({
    enabled: veilSocialMetricsEnabled || veilTimeSignalsEnabled || shortFormBlockEnabled,
    children: Object.freeze({
      socialMetrics: createArtifactChoiceChildState({
        enabled: veilSocialMetricsEnabled,
        value: socialMetricScope,
      }),
      timeSignals: createArtifactBinaryChildState({
        enabled: veilTimeSignalsEnabled,
      }),
      shortformBlock: createArtifactBinaryChildState({ enabled: shortFormBlockEnabled }),
    }),
  }), [
    socialMetricOptions.audienceCounts,
    socialMetricOptions.feedbackCounts,
    socialMetricOptions.viewCounts,
    shortFormBlockEnabled,
    socialMetricScope,
    veilSocialMetricsEnabled,
    veilTimeSignalsEnabled,
  ]);

  const artifactFamilyHandlers = useMemo(() => Object.freeze({
    commitConfig: applyVeilConfig,
    children: Object.freeze({
      socialMetrics: createArtifactChoiceChildHandlers({
        toggle: handleVeilSocialMetricsToggle,
        setValue: handleVeilSocialMetricScopeChange,
      }),
      timeSignals: createArtifactBinaryChildHandlers({
        toggle: handleVeilTimeSignalsToggle,
      }),
      shortformBlock: createArtifactBinaryChildHandlers({ toggle: handleShortFormBlockToggle }),
    }),
  }), [
    applyVeilConfig,
    handleShortFormBlockToggle,
    handleVeilSocialMetricScopeChange,
    handleVeilSocialMetricsToggle,
    handleVeilTimeSignalsToggle,
  ]);

  return {
    artifactFamily,
    artifactFamilyHandlers,
  };
}

export default useVeilArtifactSettingsFamily;
