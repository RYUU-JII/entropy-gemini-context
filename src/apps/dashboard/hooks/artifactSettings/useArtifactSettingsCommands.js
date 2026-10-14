import { useCallback, useMemo } from 'react';
import { normalizeFilterSettings, normalizeSocialMetricOptions, hasActiveSocialMetricOptions } from '@/domains/settings/config/index.js';
import { normalizeGateConfig } from '@/domains/settings/config/gateConfig.js';
import { normalizeTabManagement, requireTabManagement } from '@/domains/settings/config/tabManagement.js';

// Mutations always read the current canonical value in the store updater. A
// selected family never commits a partial read projection as the whole config.
export function useArtifactSettingsCommands({ setFilterSettings, setGateConfig, setTabManagement }) {
  const updateNormalizedFilterSettings = useCallback((updater) => {
    const result = setFilterSettings((current) => {
      if (!current || typeof updater !== 'function') throw new Error('ARTIFACT_FILTER_UPDATE_INVALID');
      return normalizeFilterSettings(updater(normalizeFilterSettings(current)));
    });
    return Promise.resolve(result).then((acknowledgement) => {
      if (acknowledgement?.error) throw acknowledgement.error;
      return acknowledgement;
    });
  }, [setFilterSettings]);
  const updateFilterEntry = useCallback((key, patchOrUpdater) => updateNormalizedFilterSettings((base) => {
    const current = base[key];
    if (!current) throw new Error(`ARTIFACT_FILTER_ENTRY_MISSING:${key}`);
    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(current, base) : patchOrUpdater;
    return { ...base, [key]: { ...current, ...patch } };
  }), [updateNormalizedFilterSettings]);
  const updateSocialMetricsSetting = useCallback((updater) => updateNormalizedFilterSettings((base) => {
    const current = base.socialMetrics;
    const patch = updater({ ...current, value: normalizeSocialMetricOptions(current.value) });
    const value = normalizeSocialMetricOptions(patch.value);
    const isActive = typeof patch.isActive === 'boolean' ? patch.isActive : hasActiveSocialMetricOptions(value);
    return { ...base, socialMetrics: { ...current, ...patch, value, isActive } };
  }), [updateNormalizedFilterSettings]);
  const updateNormalizedGateConfig = useCallback(async (updater) => {
    let committed;
    const result = await setGateConfig((current) => {
      if (!current || typeof updater !== 'function') throw new Error('ARTIFACT_GATE_UPDATE_INVALID');
      const base = normalizeGateConfig(current);
      committed = normalizeGateConfig(updater(base), { defaults: base });
      return committed;
    });
    if (result?.error) throw result.error;
    return committed;
  }, [setGateConfig]);
  const updateTabManagement = useCallback(async (next) => {
    if (typeof setTabManagement !== 'function') throw new Error('TAB_MANAGEMENT_SETTINGS_OWNER_REQUIRED');
    const result = await setTabManagement((current) => requireTabManagement(
      typeof next === 'function' ? next(normalizeTabManagement(current)) : next,
    ));
    if (result?.error) throw result.error;
    return result;
  }, [setTabManagement]);
  return useMemo(() => ({ updateFilterEntry, updateNormalizedFilterSettings, updateSocialMetricsSetting, updateNormalizedGateConfig, updateTabManagement }),
    [updateFilterEntry, updateNormalizedFilterSettings, updateSocialMetricsSetting, updateNormalizedGateConfig, updateTabManagement]);
}
