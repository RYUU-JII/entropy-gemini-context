import {
  FRICTION_INTENSITY_BANDS,
  CONFIG_DEFAULT_FILTER_SETTINGS,
  materializeFilterSettings,
  normalizeFilterSettings,
} from '../../../../domains/settings/config/index.js';

export const PROTECTION_PREVIEW_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'live', labelKey: 'filter.scenario_live', defaultLabel: 'Live' }),
  Object.freeze({ id: 'near_target', labelKey: 'filter.scenario_near', defaultLabel: 'Near target' }),
  Object.freeze({ id: 'over_target', labelKey: 'filter.scenario_over', defaultLabel: 'Over target' }),
]);

export const PROTECTION_LANE_KEYS = Object.freeze({
  reward: Object.freeze(['socialMetrics', 'saturation', 'brightness', 'contrast', 'colorSaturation']),
  pace: Object.freeze(['clickDelay', 'scrollFriction']),
  friction: Object.freeze(['blur', 'textRhythm']),
  advanced: Object.freeze(['inputDelay', 'temporal']),
});

function cloneSetting(settings, key) {
  const normalized = settings && typeof settings === 'object' ? settings[key] : null;
  const fallback = CONFIG_DEFAULT_FILTER_SETTINGS[key] || { isActive: false, value: '' };
  return {
    ...fallback,
    ...(normalized && typeof normalized === 'object' ? normalized : {}),
  };
}

function enableCanonicalBinary(settings, key) {
  const current = cloneSetting(settings, key);
  settings[key] = {
    ...current,
    isActive: true,
  };
}

function enableSocialMetrics(settings, options = {}) {
  const current = cloneSetting(settings, 'socialMetrics');
  settings.socialMetrics = {
    ...current,
    isActive: true,
    value: {
      feedbackCounts: true,
      viewCounts: true,
      timeSignals: true,
      audienceCounts: true,
      ...(current?.value && typeof current.value === 'object' ? current.value : {}),
      ...(options && typeof options === 'object' ? options : {}),
    },
  };
}

export function buildProtectionPreviewSettings(filterSettings, scenarioId = 'live') {
  const next = normalizeFilterSettings(filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS);
  const scenario = typeof scenarioId === 'string' ? scenarioId.trim().toLowerCase() : 'live';

  if (scenario === 'near_target') {
    enableSocialMetrics(next, { timeSignals: false });
    enableCanonicalBinary(next, 'saturation');
    enableCanonicalBinary(next, 'clickDelay');
    return materializeFilterSettings(next);
  }

  if (scenario === 'over_target') {
    enableSocialMetrics(next, { timeSignals: true });
    enableCanonicalBinary(next, 'saturation');
    enableCanonicalBinary(next, 'clickDelay');
    enableCanonicalBinary(next, 'scrollFriction');
    enableCanonicalBinary(next, 'blur');
    enableCanonicalBinary(next, 'textRhythm');
    return materializeFilterSettings(next, { band: FRICTION_INTENSITY_BANDS.REINFORCED });
  }

  return materializeFilterSettings(next);
}

export function summarizeProtectionPreviewLanes(filterSettings) {
  const normalized = filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS;

  const countActive = (keys) => keys.reduce((count, key) => (
    normalized?.[key]?.isActive ? count + 1 : count
  ), 0);

  return {
    reward: countActive(PROTECTION_LANE_KEYS.reward),
    pace: countActive(PROTECTION_LANE_KEYS.pace),
    friction: countActive(PROTECTION_LANE_KEYS.friction),
    advanced: countActive(PROTECTION_LANE_KEYS.advanced),
    activeFilterCount: Object.entries(normalized)
      .filter(([key, entry]) => key !== 'socialEngagement' && key !== 'socialExposure' && entry?.isActive)
      .length,
  };
}
