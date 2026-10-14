import { materializeFilterSettings } from './index.js';
import { VISUAL_FRICTION_FEATURE_KEYS } from './visualFrictionProfiles.js';

// Visual/text filters safe for early style application.
export const EARLY_APPLY_VISUAL_FILTER_KEYS = new Set([
  ...VISUAL_FRICTION_FEATURE_KEYS,
  'textRhythm',
  'textShadow',
]);

// Input/interaction filters safe for early listener wiring.
export const EARLY_APPLY_RUNTIME_FILTER_KEYS = new Set([
  'clickDelay',
  'ensoGate',
  'scrollFriction',
  'inputVisualBrake',
  'navigationButtonLock',
]);

// Heavy runtime filters remain controller-driven on full content bootstrap.
export const CONTROLLER_ONLY_RUNTIME_FILTER_KEYS = new Set([
  'videoSkipGuard',
  'shortFormBlock',
  'infiniteScrollGuard',
]);

// Extension-context runtime filters are decided by the protection pipeline but
// owned by background/offscreen pages rather than content-script managers.
export const EXTENSION_CONTEXT_RUNTIME_FILTER_KEYS = new Set();

export const EARLY_APPLY_FILTER_KEYS = new Set([
  ...EARLY_APPLY_VISUAL_FILTER_KEYS,
  ...EARLY_APPLY_RUNTIME_FILTER_KEYS,
]);

export function buildFrictionFilters(rawFilters) {
  return materializeFilterSettings(rawFilters || {});
}

export function pickFiltersByKeys(filters, keys) {
  if (!filters || typeof filters !== 'object') return {};
  if (!keys || keys.size === 0) return { ...filters };
  const picked = {};
  for (const key of Object.keys(filters)) {
    if (keys.has(key)) picked[key] = filters[key];
  }
  return picked;
}

export function buildEarlyFrictionFilters(rawFilters) {
  return pickFiltersByKeys(buildFrictionFilters(rawFilters), EARLY_APPLY_FILTER_KEYS);
}

export function buildEarlyVisualFrictionFilters(rawFilters) {
  return pickFiltersByKeys(buildFrictionFilters(rawFilters), EARLY_APPLY_VISUAL_FILTER_KEYS);
}

export function buildEarlyRuntimeFrictionFilters(rawFilters) {
  return pickFiltersByKeys(buildFrictionFilters(rawFilters), EARLY_APPLY_RUNTIME_FILTER_KEYS);
}

export function pickEarlyRuntimeCompiledFeatures(compiledFeatures) {
  return pickFiltersByKeys(compiledFeatures, EARLY_APPLY_RUNTIME_FILTER_KEYS);
}
