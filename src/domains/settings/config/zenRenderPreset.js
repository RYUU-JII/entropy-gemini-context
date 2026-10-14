export const ZEN_RENDER_PRESET_STORAGE_KEY = 'zen_render_preset';
export const ZEN_RENDER_PRESET_IDS = Object.freeze({ FULL: 'full', BALANCED: 'balanced', LOW: 'low' });
export const DEFAULT_ZEN_RENDER_PRESET = ZEN_RENDER_PRESET_IDS.FULL;

export function requireZenRenderPreset(value) {
  if (!Object.values(ZEN_RENDER_PRESET_IDS).includes(value)) {
    throw new Error(`ZEN_RENDER_PRESET_INVALID:${String(value)}`);
  }
  return value;
}
