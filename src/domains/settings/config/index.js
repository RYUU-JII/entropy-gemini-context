import {
  normalizeInputDelayMs,
} from './inputDelayLevelSemantics.js';
import {
  DEFAULT_INFINITE_SCROLL_GUARD_VALUE,
  normalizeInfiniteScrollGuardValue,
} from './infiniteScrollGuard.js';
import {
  DEFAULT_VIDEO_SKIP_GUARD_VALUE,
  normalizeVideoSkipGuardValue,
} from './videoSkipGuard.js';
import {
  DEFAULT_AUDIO_DULLING_VALUE,
  normalizeAudioDullingValue,
} from './audioDulling.js';
import {
  CANONICAL_CLICK_DELAY_PROFILE,
  CANONICAL_SCROLL_FRICTION_PROFILE,
  isCanonicalBinaryFilterKey,
  normalizeCanonicalBinaryFilterEntry,
} from './canonicalBinaryFilterProfiles.js';
import { formatCssRatio, getGrayscaleAmountFromSaturationValue } from './filterValueSemantics.js';
import { FRICTION_INTENSITY_BANDS, getFrictionIntensityOrdinal } from './frictionIntensityBands.js';
import { isAdaptiveFrictionFeatureKey, materializeAdaptiveFrictionEntry } from './adaptiveFrictionProfiles.js';
import { requireVisualFrictionEntry, isVisualFrictionProfileKey, normalizeVisualFrictionSetting, VISUAL_FRICTION_CONTROLS } from './visualFrictionProfiles.js';
import { isPolicyFeatureKey } from '../../protection/protocol/features/featureCatalog.js';
import { DEFAULT_ENSO_INTERVAL_PRESET, normalizeEnsoGateEntry } from './ensoIntervalPolicy.js';

export { ENSO_INTERVAL_PRESETS, DEFAULT_ENSO_INTERVAL_PRESET, resolveEnsoIntervalMs, normalizeEnsoGateEntry } from './ensoIntervalPolicy.js';

export * from './filterValueSemantics.js';
export * from './frictionIntensityBands.js';
export * from './visualFrictionProfiles.js';
export * from './adaptiveFrictionProfiles.js';

export {
  CANONICAL_BINARY_FILTER_VALUE_BY_KEY,
  CANONICAL_CLICK_DELAY_PROFILE,
  CANONICAL_SCROLL_FRICTION_PROFILE,
  getCanonicalBinaryFilterValue,
  isCanonicalBinaryFilterKey,
  normalizeCanonicalBinaryFilterEntry,
} from './canonicalBinaryFilterProfiles.js';

export { TEXT_RHYTHM_RUNTIME_PROFILES, getTextRhythmRuntimeProfile, requireTextRhythmShuffleProfile, requireTextRhythmRuntimeProfile } from './textRhythmProfile.js';

export {
  AUDIO_DULLING_CAPTURE_MODES,
  AUDIO_DULLING_PRESETS,
  DEFAULT_AUDIO_DULLING_VALUE,
  normalizeAudioDullingValue,
} from './audioDulling.js';

export {
  DEFAULT_SOCIAL_METRIC_SCOPE,
  SOCIAL_METRIC_SCOPES,
  buildSocialMetricOptionsForScope,
  normalizeSocialMetricScope,
  resolveSocialMetricScope,
} from './socialMetricScope.js';

export const CONFIG_DEFAULT_CLICK_DELAY_MS = CANONICAL_CLICK_DELAY_PROFILE.delayMs;
export const CONFIG_DEFAULT_SCROLL_FRICTION_MS = CANONICAL_SCROLL_FRICTION_PROFILE.delayMs;

export const CONFIG_DEFAULT_TEXT_SHADOW_VALUE = '0 1px 0 rgba(0,0,0,0.25)';

export const CONFIG_DEFAULT_INPUT_DELAY_MS = 320;
export const SOCIAL_METRIC_OPTION_DEFAULTS = Object.freeze({
  feedbackCounts: true,
  viewCounts: true,
  timeSignals: false,
  audienceCounts: true,
});

export function buildRootVisualFilterValue(filters = {}) {
  const source = filters && typeof filters === 'object' ? filters : {};
  const saturationSource = source.saturation;
  const saturation = saturationSource || null;
  const parts = [];

  if (saturation?.isActive) {
    requireVisualFrictionEntry('saturation', saturation);
    const grayscaleAmount = getGrayscaleAmountFromSaturationValue(saturation.value);
    if (grayscaleAmount > 0) {
      parts.push(`grayscale(${formatCssRatio(grayscaleAmount)})`);
    }
  }

  return parts.join(' ').trim();
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function normalizeSocialMetricOptions(rawValue, fallback = SOCIAL_METRIC_OPTION_DEFAULTS) {
  const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
  return {
    feedbackCounts: coerceBoolean(source.feedbackCounts, fallback.feedbackCounts),
    viewCounts: coerceBoolean(source.viewCounts, fallback.viewCounts),
    timeSignals: coerceBoolean(source.timeSignals, fallback.timeSignals),
    audienceCounts: coerceBoolean(source.audienceCounts, fallback.audienceCounts),
  };
}

export function hasActiveSocialMetricOptions(options) {
  const normalized = normalizeSocialMetricOptions(options);
  return Object.values(normalized).some(Boolean);
}

export function resolveSocialMetricVisibilityFromSetting(rawSetting = {}) {
  const socialMetricsEntry = rawSetting && typeof rawSetting === 'object' && !Array.isArray(rawSetting)
    ? rawSetting
    : {};
  const options = normalizeSocialMetricOptions(socialMetricsEntry.value);
  const isActive = socialMetricsEntry.isActive === true && hasActiveSocialMetricOptions(options);
  const engagement = isActive && (options.feedbackCounts || options.audienceCounts);
  const exposure = isActive && (options.viewCounts || options.timeSignals);
  const activeMetricKeys = isActive
    ? Object.entries(options)
      .filter(([, enabled]) => !!enabled)
      .map(([key]) => key)
    : [];

  return {
    isActive,
    options,
    engagement,
    exposure,
    feedbackCounts: isActive && options.feedbackCounts,
    viewCounts: isActive && options.viewCounts,
    timeSignals: isActive && options.timeSignals,
    audienceCounts: isActive && options.audienceCounts,
    activeMetricKeys,
  };
}

export function resolveSocialMetricVisibilityState(rawSettings = {}) {
  const normalizedSettings = normalizeFilterSettings(rawSettings || {});
  return resolveSocialMetricVisibilityFromSetting(normalizedSettings.socialMetrics);
}

function deriveSocialMetricsEntry(source = {}, fallback) {
  const current = source.socialMetrics;
  const hasStructuredOptions =
    current?.value && typeof current.value === 'object' && !Array.isArray(current.value);

  const value = normalizeSocialMetricOptions(
    hasStructuredOptions ? current.value : fallback?.value,
    SOCIAL_METRIC_OPTION_DEFAULTS,
  );

  const isActive = typeof current?.isActive === 'boolean'
    ? current.isActive
    : !!fallback?.isActive;

  return {
    isActive,
    value,
  };
}

export function normalizeFilterSettings(partial = {}) {
  const source = partial && typeof partial === 'object' ? { ...partial } : {};
  const merged = {};
  for (const [key, def] of Object.entries(CONFIG_DEFAULT_FILTER_SETTINGS)) {
    const current = source[key];
    if (key === 'socialMetrics') {
      merged[key] = deriveSocialMetricsEntry(source, def);
      continue;
    }
    const isActive = typeof current?.isActive === 'boolean' ? current.isActive : def.isActive;
    const value = current?.value !== undefined ? current.value : def.value;

    if (isVisualFrictionProfileKey(key)) {
      merged[key] = normalizeVisualFrictionSetting(key, current === undefined ? def : current);
      continue;
    }

    if (key === 'ensoGate') {
      merged[key] = normalizeEnsoGateEntry(current === undefined ? def : current);
      continue;
    }

    if (isCanonicalBinaryFilterKey(key)) {
      merged[key] = normalizeCanonicalBinaryFilterEntry(
        key,
        typeof current === 'undefined' ? def : current,
        def,
      );
      continue;
    }

    if (key === 'infiniteScrollGuard') {
      merged[key] = { isActive, value: normalizeInfiniteScrollGuardValue(value) };
      continue;
    }

    if (key === 'videoSkipGuard') {
      merged[key] = { isActive, value: normalizeVideoSkipGuardValue(value) };
      continue;
    }

    if (key === 'audioDulling') {
      merged[key] = { isActive, value: normalizeAudioDullingValue(value) };
      continue;
    }

    if (key === 'inputDelay') {
      merged[key] = { isActive, value: normalizeInputDelayMs(value, def.value) };
      continue;
    }

    if (key === 'hideIcons') {
      merged[key] = { isActive: false, value: false };
      continue;
    }

    merged[key] = { isActive, value };
  }

  for (const [key, value] of Object.entries(source)) {
    if (!(key in merged)) {
      throw new Error(`FILTER_SETTINGS_KEY_UNKNOWN:${key}`);
    }
  }

  const socialMetrics = merged.socialMetrics || deriveSocialMetricsEntry(source, CONFIG_DEFAULT_FILTER_SETTINGS.socialMetrics);
  const socialMetricOptions = normalizeSocialMetricOptions(socialMetrics.value);
  const socialMetricsActive = !!socialMetrics.isActive && hasActiveSocialMetricOptions(socialMetricOptions);

  merged.socialMetrics = {
    ...socialMetrics,
    isActive: socialMetricsActive,
    value: socialMetricOptions,
  };
  merged.socialEngagement = {
    ...(merged.socialEngagement || CONFIG_DEFAULT_FILTER_SETTINGS.socialEngagement),
    isActive: socialMetricsActive && (socialMetricOptions.feedbackCounts || socialMetricOptions.audienceCounts),
    value: '',
  };
  merged.socialExposure = {
    ...(merged.socialExposure || CONFIG_DEFAULT_FILTER_SETTINGS.socialExposure),
    isActive: socialMetricsActive && (socialMetricOptions.viewCounts || socialMetricOptions.timeSignals),
    value: '',
  };

  return merged;
}

export function materializeFilterSettings(partial = {}, {
  band = FRICTION_INTENSITY_BANDS.NORMAL,
} = {}) {
  const normalized = normalizeFilterSettings(partial);
  return Object.fromEntries(Object.entries(normalized).map(([key, entry]) => [
    key,
    isAdaptiveFrictionFeatureKey(key)
      ? materializeAdaptiveFrictionEntry(key, entry, band)
      : { ...entry },
  ]));
}

function buildFilterEffectEntry(key, normalizedEntry, materializedEntry) {
  const normalized = normalizedEntry && typeof normalizedEntry === 'object' && !Array.isArray(normalizedEntry)
    ? normalizedEntry
    : {};
  const materialized = materializedEntry && typeof materializedEntry === 'object' && !Array.isArray(materializedEntry)
    ? materializedEntry
    : {};
  const isActive = normalized.isActive === true;

  if (isAdaptiveFrictionFeatureKey(key)) {
    return Object.freeze({
      key,
      kind: 'profile',
      isActive,
      enabled: isActive,
      band: materialized.band,
      value: materialized.value,
      intensityRatio: isActive ? (isVisualFrictionProfileKey(key)
        ? materialized.effectiveStrength / 100 : getFrictionIntensityOrdinal(materialized.band) / 3) : 0,
    });
  }

  if (key === 'socialMetrics') {
    const options = normalizeSocialMetricOptions(normalized.value);
    const activeOptionKeys = isActive
      ? Object.keys(options).filter((optionKey) => options[optionKey])
      : [];
    return Object.freeze({
      key,
      kind: 'options',
      isActive,
      enabled: isActive,
      options: Object.freeze(options),
      activeOptionKeys: Object.freeze(activeOptionKeys),
      intensityRatio: activeOptionKeys.length / Object.keys(options).length,
      value: Object.freeze(options),
    });
  }

  return Object.freeze({
    key,
    kind: 'value',
    isActive,
    enabled: isActive,
    value: materialized.value,
    intensityRatio: isActive ? 1 : 0,
  });
}

export function buildFilterEffectSnapshot(partial = {}) {
  const normalized = normalizeFilterSettings(partial || CONFIG_DEFAULT_FILTER_SETTINGS);
  const materialized = materializeFilterSettings(normalized);
  const filters = Object.keys(normalized).reduce((acc, key) => {
    acc[key] = buildFilterEffectEntry(key, normalized[key], materialized[key]);
    return acc;
  }, {});
  const activeFilterKeys = Object.keys(filters).filter((key) => !isPolicyFeatureKey(key) && filters[key].isActive === true);

  return Object.freeze({
    normalized: Object.freeze(normalized),
    materialized: Object.freeze(materialized),
    filters: Object.freeze(filters),
    activeFilterKeys: Object.freeze(activeFilterKeys),
    activeFilters: Object.freeze(activeFilterKeys.map((key) => filters[key])),
  });
}

export function buildTextRhythmFilterPatch(nextChecked) {
  return {
    textRhythm: {
      isActive: nextChecked === true,
      value: true,
    },
  };
}

export const CONFIG_DEFAULT_FILTER_SETTINGS = {
  blur: { isActive: false, value: VISUAL_FRICTION_CONTROLS.blur.defaultStrength },
  clickDelay: { isActive: false, value: CANONICAL_CLICK_DELAY_PROFILE.delayMs },
  ensoGate: { isActive: true, value: DEFAULT_ENSO_INTERVAL_PRESET },
  scrollFriction: { isActive: false, value: CANONICAL_SCROLL_FRICTION_PROFILE.delayMs },
  saturation: { isActive: false, value: VISUAL_FRICTION_CONTROLS.saturation.defaultStrength },
  brightness: { isActive: true, value: VISUAL_FRICTION_CONTROLS.brightness.defaultStrength },
  contrast: { isActive: false, value: VISUAL_FRICTION_CONTROLS.contrast.defaultStrength },
  colorSaturation: { isActive: true, value: VISUAL_FRICTION_CONTROLS.colorSaturation.defaultStrength },
  fullscreenVisualRelaxation: { isActive: true, value: true },
  temporal: { isActive: false, value: true },
  videoSkipGuard: { isActive: false, value: { ...DEFAULT_VIDEO_SKIP_GUARD_VALUE } },
  audioDulling: { isActive: false, value: { ...DEFAULT_AUDIO_DULLING_VALUE } },
  shortFormBlock: { isActive: false, value: '' },
  infiniteScrollGuard: { isActive: false, value: { ...DEFAULT_INFINITE_SCROLL_GUARD_VALUE } },
  textRhythm: { isActive: true, value: true },
  textShadow: { isActive: false, value: CONFIG_DEFAULT_TEXT_SHADOW_VALUE },
  socialMetrics: { isActive: false, value: { ...SOCIAL_METRIC_OPTION_DEFAULTS } },
  socialEngagement: { isActive: false, value: '' },
  socialExposure: { isActive: false, value: '' },
  hideIcons: { isActive: false, value: false },
  inputDelay: { isActive: false, value: CONFIG_DEFAULT_INPUT_DELAY_MS },
  inputVisualBrake: { isActive: false, value: true },
  navigationButtonLock: { isActive: false, value: true },
};
