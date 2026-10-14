import { ZEN_RENDER_PRESET_IDS, requireZenRenderPreset } from '@/domains/settings/config/zenRenderPreset.js';

export const ZEN_QUALITY_MODES = ZEN_RENDER_PRESET_IDS;

export const DEFAULT_ZEN_QUALITY_MODE = ZEN_QUALITY_MODES.FULL;

export function normalizeZenQualityMode(value, fallback = DEFAULT_ZEN_QUALITY_MODE) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (Object.values(ZEN_QUALITY_MODES).includes(normalized)) return normalized;
  const fallbackNormalized = typeof fallback === 'string' ? fallback.trim().toLowerCase() : '';
  if (Object.values(ZEN_QUALITY_MODES).includes(fallbackNormalized)) return fallbackNormalized;
  return DEFAULT_ZEN_QUALITY_MODE;
}

// Graphics and frame rate are independent policy axes, bundled into three
// explicit user presets. No hardware guess or automatic quality transition.
const FRAME_RATE_POLICIES = Object.freeze({ smooth: 60, power_saver: 30 });
const RENDER_PRESETS = Object.freeze({
  full: Object.freeze({ graphicsQuality: 'full', frameRatePolicy: 'smooth' }),
  balanced: Object.freeze({ graphicsQuality: 'balanced', frameRatePolicy: 'smooth' }),
  low: Object.freeze({ graphicsQuality: 'low', frameRatePolicy: 'power_saver' }),
});
export const ZEN_GRAPHICS_BUDGETS = Object.freeze({
  full: Object.freeze({ pixelRatioCap: 1.25, maxRenderPixels: 1920 * 1080, waterSurfaceResolutionScale: 0.82 }),
  balanced: Object.freeze({ pixelRatioCap: 1, maxRenderPixels: 1600 * 900, waterSurfaceResolutionScale: 0.68 }),
  low: Object.freeze({ pixelRatioCap: 1, maxRenderPixels: 1280 * 720, waterSurfaceResolutionScale: 0.55 }),
});

export function resolveZenRenderPreset(preset = DEFAULT_ZEN_QUALITY_MODE) {
  return RENDER_PRESETS[requireZenRenderPreset(preset)];
}

export function resolveZenMainTargetFps(preset = DEFAULT_ZEN_QUALITY_MODE) {
  return FRAME_RATE_POLICIES[resolveZenRenderPreset(preset).frameRatePolicy];
}
