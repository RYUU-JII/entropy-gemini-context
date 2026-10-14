import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildTextRhythmFilterPatch,
  buildSocialMetricOptionsForScope,
  CONFIG_DEFAULT_FILTER_SETTINGS,
  materializeFilterSettings,
  normalizeSocialMetricOptions,
  normalizeSocialMetricScope,
  hasActiveSocialMetricOptions,
} from '../../../../domains/settings/config/index.js';
import {
  buildTextShadowValue,
  getCategoryEntries,
  getSettingEntry,
  SETTING_METADATA,
  SETTINGS_CATEGORY_ORDER,
  valueForStorage,
} from '../../../../domains/settings/config/settingsConfig.js';
import { isExperimentalSettingsEnabled } from '../../../../platform/browser/dev/settingsExperimentalFlag.js';
import { buildProtectionPreviewSettings } from './protectionPreviewScenarios.js';

const EMPTY_CATEGORY_STATS = Object.freeze([]);
const INACTIVE_PREVIEW_SETTINGS = materializeFilterSettings(CONFIG_DEFAULT_FILTER_SETTINGS);

function buildTextRhythmPatch(nextChecked) {
  return buildTextRhythmFilterPatch(nextChecked);
}

function buildStoredValuePatch(value) {
  return { value };
}

function requireFilterSettingsSetter(setFilterSettings) {
  if (typeof setFilterSettings !== 'function') {
    throw new Error('FILTER_SETTINGS_EDITOR_SETTER_REQUIRED');
  }
  return setFilterSettings;
}

function requireKnownFilterSettingKey(key) {
  const normalizedKey = typeof key === 'string' ? key.trim() : '';
  if (!normalizedKey || !SETTING_METADATA[normalizedKey]) {
    throw new Error(`FILTER_SETTINGS_EDITOR_UNKNOWN_KEY:${normalizedKey || 'missing'}`);
  }
  return normalizedKey;
}

function requireFilterSettingMetadata(key, meta) {
  const settingKey = requireKnownFilterSettingKey(key);
  const canonicalMeta = SETTING_METADATA[settingKey];
  if (meta !== canonicalMeta) {
    throw new Error(`FILTER_SETTINGS_EDITOR_METADATA_MISMATCH:${settingKey}`);
  }
  return {
    settingKey,
    meta: canonicalMeta,
  };
}

function assertKnownFilterSettingsPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('FILTER_SETTINGS_EDITOR_PATCH_INVALID');
  }
  Object.keys(patch).forEach(requireKnownFilterSettingKey);
  return patch;
}

function mergeFilterSettingsPatch(baseSettings, patch) {
  const knownPatch = assertKnownFilterSettingsPatch(patch);
  const base = baseSettings && typeof baseSettings === 'object'
    ? baseSettings
    : CONFIG_DEFAULT_FILTER_SETTINGS;
  const next = { ...base };
  Object.entries(knownPatch).forEach(([entryKey, entryValue]) => {
    const current = getSettingEntry(base, entryKey);
    if (entryValue && typeof entryValue === 'object') {
      next[entryKey] = { ...current, ...entryValue };
    } else {
      next[entryKey] = {
        ...current,
        ...buildStoredValuePatch(entryValue),
      };
    }
  });
  return next;
}

function requireFilterSettingControl(settingKey, meta, expectedControl) {
  if (meta.control !== expectedControl) {
    throw new Error(`FILTER_SETTINGS_EDITOR_CONTROL_MISMATCH:${settingKey}:${expectedControl}`);
  }
}

export function useFilterSettingsEditor({
  filterSettings,
  isActive,
  setFilterSettings,
  themeProfile,
}) {
  const [localSettings, setLocalSettings] = useState(filterSettings || {});
  const [selectedCategory, setSelectedCategory] = useState(SETTINGS_CATEGORY_ORDER[0]?.key);
  const [previewScenarioId, setPreviewScenarioId] = useState('live');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const prefersDarkPreview = useMemo(
    () => themeProfile?.previewMode === 'dark',
    [themeProfile?.previewMode],
  );
  const [previewPlatformId, setPreviewPlatformId] = useState(prefersDarkPreview ? 'default-dark' : 'default');

  useEffect(() => {
    setPreviewPlatformId(prefersDarkPreview ? 'default-dark' : 'default');
  }, [prefersDarkPreview]);

  useEffect(() => {
    if (!isActive) return undefined;
    setLocalSettings(filterSettings || {});
    return undefined;
  }, [filterSettings, isActive]);

  const updateSettings = useCallback((patch) => {
    const knownPatch = assertKnownFilterSettingsPatch(patch);
    const commitFilterSettings = requireFilterSettingsSetter(setFilterSettings);
    commitFilterSettings((prev) => {
      return mergeFilterSettingsPatch(prev, knownPatch);
    });
  }, [setFilterSettings]);

  const handleToggle = useCallback((key, meta, nextChecked) => {
    const {
      settingKey,
    } = requireFilterSettingMetadata(key, meta);
    if (settingKey === 'textRhythm') {
      setLocalSettings((prev) => {
        const patch = buildTextRhythmPatch(nextChecked);
        const nextSettings = { ...prev };
        Object.entries(patch).forEach(([patchKey, patchValue]) => {
          const currentEntry = getSettingEntry(prev, patchKey);
          nextSettings[patchKey] = { ...currentEntry, ...patchValue };
        });
        return nextSettings;
      });
      updateSettings(buildTextRhythmPatch(nextChecked));
      return;
    }

    setLocalSettings((prev) => {
      const current = getSettingEntry(prev, settingKey);
      const nextEntry = { ...current, isActive: nextChecked };
      const nextSettings = { ...prev, [settingKey]: nextEntry };

      if (nextChecked) {
        if (settingKey === 'temporal' && nextSettings.saturation?.isActive) {
          nextSettings.saturation = { ...nextSettings.saturation, isActive: false };
        }
        if (settingKey === 'saturation' && nextSettings.temporal?.isActive) {
          nextSettings.temporal = { ...nextSettings.temporal, isActive: false };
        }
      }

      return nextSettings;
    });

    const patch = { [settingKey]: { isActive: nextChecked } };
    if (nextChecked) {
      if (settingKey === 'temporal') patch.saturation = { isActive: false };
      if (settingKey === 'saturation') patch.temporal = { isActive: false };
    }
    updateSettings(patch);
  }, [updateSettings]);

  const handleValueInput = useCallback((key, meta, nextValue) => {
    const {
      settingKey,
      meta: settingMeta,
    } = requireFilterSettingMetadata(key, meta);
    requireFilterSettingControl(settingKey, settingMeta, 'range');
    const finalValue = valueForStorage(settingKey, settingMeta, nextValue);
    const patch = buildStoredValuePatch(finalValue);
    setLocalSettings((prev) => {
      const current = getSettingEntry(prev, settingKey);
      return { ...prev, [settingKey]: { ...current, ...patch } };
    });
  }, []);

  const handleValueCommit = useCallback((key, meta, nextValue) => {
    const {
      settingKey,
      meta: settingMeta,
    } = requireFilterSettingMetadata(key, meta);
    requireFilterSettingControl(settingKey, settingMeta, 'range');
    const finalValue = valueForStorage(settingKey, settingMeta, nextValue);
    const patch = buildStoredValuePatch(finalValue);
    setLocalSettings((prev) => {
      const current = getSettingEntry(prev, settingKey);
      return { ...prev, [settingKey]: { ...current, ...patch } };
    });
    updateSettings({ [settingKey]: patch });
  }, [updateSettings]);

  const handleShadowChange = useCallback((key, meta, nextLevel, nextColorKey) => {
    const {
      settingKey,
      meta: settingMeta,
    } = requireFilterSettingMetadata(key, meta);
    requireFilterSettingControl(settingKey, settingMeta, 'shadow');
    const nextValue = buildTextShadowValue(nextLevel, nextColorKey);
    setLocalSettings((prev) => {
      const current = getSettingEntry(prev, settingKey);
      return { ...prev, [settingKey]: { ...current, value: nextValue } };
    });
    updateSettings({ [settingKey]: { value: nextValue } });
  }, [updateSettings]);

  const handleCompoundChange = useCallback((key, meta, optionKey, nextChecked) => {
    const {
      settingKey,
      meta: settingMeta,
    } = requireFilterSettingMetadata(key, meta);
    requireFilterSettingControl(settingKey, settingMeta, 'socialMetricScope');

    const buildNextSocialMetricOptions = (currentValue) => {
      const currentOptions = normalizeSocialMetricOptions(currentValue);
      if (optionKey === 'scope') {
        if (nextChecked === 'off') {
          return {
            ...currentOptions,
            feedbackCounts: false,
            viewCounts: false,
            audienceCounts: false,
          };
        }
        return buildSocialMetricOptionsForScope(
          normalizeSocialMetricScope(nextChecked),
          { timeSignals: currentOptions.timeSignals },
        );
      }
      if (optionKey === 'timeSignals' && typeof nextChecked === 'boolean') {
        return {
          ...currentOptions,
          timeSignals: nextChecked,
        };
      }
      throw new Error(`FILTER_SETTINGS_EDITOR_SOCIAL_METRIC_ACTION_INVALID:${optionKey || 'missing'}`);
    };

    setLocalSettings((prev) => {
      const current = getSettingEntry(prev, settingKey);
      const nextValue = buildNextSocialMetricOptions(current?.value);
      return {
        ...prev,
        [settingKey]: {
          ...current,
          isActive: hasActiveSocialMetricOptions(nextValue),
          value: nextValue,
        },
      };
    });

    const commitFilterSettings = requireFilterSettingsSetter(setFilterSettings);
    commitFilterSettings((prev) => {
      const current = getSettingEntry(prev, settingKey);
      const nextValue = buildNextSocialMetricOptions(current?.value);
      return mergeFilterSettingsPatch(prev, {
        [settingKey]: {
          isActive: hasActiveSocialMetricOptions(nextValue),
          value: nextValue,
        },
      });
    });
  }, [setFilterSettings]);

  const previewSettings = useMemo(() => {
    if (!isActive) return INACTIVE_PREVIEW_SETTINGS;
    return buildProtectionPreviewSettings(localSettings, previewScenarioId);
  }, [isActive, localSettings, previewScenarioId]);

  const showExperimental = useMemo(
    () => (isActive ? isExperimentalSettingsEnabled() : false),
    [isActive],
  );

  const categoryStats = useMemo(() => {
    if (!isActive) return EMPTY_CATEGORY_STATS;
    return SETTINGS_CATEGORY_ORDER.map((catDef) => {
      const entries = getCategoryEntries(catDef.key, showExperimental);
      const total = entries.length;
      const active = entries.filter(([key]) => getSettingEntry(localSettings, key)?.isActive).length;
      return { ...catDef, total, active };
    }).filter((cat) => cat.total > 0);
  }, [isActive, localSettings, showExperimental]);

  return {
    advancedOpen,
    categoryStats,
    handleShadowChange,
    handleCompoundChange,
    handleToggle,
    handleValueCommit,
    handleValueInput,
    localSettings,
    previewPlatformId,
    previewScenarioId,
    previewSettings,
    selectedCategory,
    setAdvancedOpen,
    setPreviewPlatformId,
    setPreviewScenarioId,
    setSelectedCategory,
    showExperimental,
  };
}

export default useFilterSettingsEditor;
