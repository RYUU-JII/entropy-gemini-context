export const FILTER_SETTINGS_CHANGED_KEY_PREFIX = 'filterSettings.';

export const PROTECTION_FEATURE_CATALOG = Object.freeze([
  Object.freeze({ key: 'blur' }),
  Object.freeze({ key: 'brightness' }),
  Object.freeze({ key: 'contrast' }),
  Object.freeze({ key: 'colorSaturation' }),
  Object.freeze({ key: 'clickDelay' }),
  Object.freeze({ key: 'ensoGate' }),
  Object.freeze({ key: 'scrollFriction' }),
  Object.freeze({ key: 'saturation' }),
  // Policy preference consumed by the visual coordinator, not a standalone effect.
  Object.freeze({ key: 'fullscreenVisualRelaxation', kind: 'policy' }),
  Object.freeze({ key: 'temporal' }),
  Object.freeze({ key: 'videoSkipGuard' }),
  Object.freeze({ key: 'shortFormBlock' }),
  Object.freeze({ key: 'infiniteScrollGuard' }),
  Object.freeze({ key: 'textRhythm' }),
  Object.freeze({ key: 'textShadow' }),
  Object.freeze({ key: 'socialMetrics' }),
  Object.freeze({ key: 'socialEngagement' }),
  Object.freeze({ key: 'socialExposure' }),
  Object.freeze({ key: 'hideIcons' }),
  Object.freeze({ key: 'inputDelay' }),
  Object.freeze({ key: 'inputVisualBrake' }),
  Object.freeze({ key: 'navigationButtonLock' }),
]);

export const FEATURE_KEYS = Object.freeze(PROTECTION_FEATURE_CATALOG.map((entry) => entry.key));
export const FEATURE_KEY_SET = new Set(FEATURE_KEYS);
const POLICY_FEATURE_KEYS = new Set(PROTECTION_FEATURE_CATALOG.filter((entry) => entry.kind === 'policy').map((entry) => entry.key));

export function isPolicyFeatureKey(key) {
  return POLICY_FEATURE_KEYS.has(key);
}

export function isEffectFeatureKey(key) {
  return FEATURE_KEY_SET.has(key) && !POLICY_FEATURE_KEYS.has(key);
}

export function isKnownFeatureKey(key) {
  return typeof key === 'string' && FEATURE_KEY_SET.has(key);
}

export function toFilterSettingsFeatureChangedKey(featureKey) {
  if (!isKnownFeatureKey(featureKey)) return null;
  return `${FILTER_SETTINGS_CHANGED_KEY_PREFIX}${featureKey}`;
}

export function parseFilterSettingsFeatureChangedKey(changedKey) {
  if (typeof changedKey !== 'string') return null;
  const normalized = changedKey.trim();
  if (!normalized.startsWith(FILTER_SETTINGS_CHANGED_KEY_PREFIX)) return null;

  const featureKey = normalized.slice(FILTER_SETTINGS_CHANGED_KEY_PREFIX.length);
  return isKnownFeatureKey(featureKey) ? featureKey : null;
}

export function isFilterSettingsFeatureChangedKey(changedKey) {
  return !!parseFilterSettingsFeatureChangedKey(changedKey);
}

export function collectFeatureKeysFromChangedKeys(changedKeys = []) {
  if (!Array.isArray(changedKeys)) return [];
  const unique = new Set();
  changedKeys.forEach((changedKey) => {
    const featureKey = parseFilterSettingsFeatureChangedKey(changedKey);
    if (featureKey) unique.add(featureKey);
  });
  return Array.from(unique);
}
