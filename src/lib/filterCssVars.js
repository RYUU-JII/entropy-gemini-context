import { buildMediaVisualFilterValue, isVisualFrictionProfileKey, requireVisualFrictionEntry } from '../domains/settings/config/visualFrictionProfiles.js';
import { requireTextRhythmRuntimeProfile } from '../domains/settings/config/textRhythmProfile.js';

const ROOT_VISUAL_DEFAULTS = {
  blur: '0px',
  saturation: '1',
  brightness: '1',
  contrast: '1',
  colorSaturation: '1',
  mediaFilter: 'none',
  temporal: '0',
};

const ROOT_TEXT_DEFAULTS = {
  textBlur: '0px',
  textShadow: 'none',
  textOpacity: '1',
};

export const ROOT_VISUAL_VAR_NAMES = {
  blur: '--f-blur',
  saturation: '--f-saturation',
  brightness: '--f-brightness',
  contrast: '--f-contrast',
  colorSaturation: '--f-color-saturation',
  mediaFilter: '--f-media-filter',
  temporal: '--f-temporal',
};

export const ROOT_TEXT_VAR_NAMES = {
  textBlur: '--f-text-blur',
  textShadow: '--f-text-shadow',
  textOpacity: '--f-text-opacity',
};

export const PREVIEW_VISUAL_VAR_NAMES = {
  blur: '--preview-media-blur',
  saturation: '--preview-saturation',
  brightness: '--preview-brightness',
  contrast: '--preview-contrast',
  colorSaturation: '--preview-color-saturation',
  mediaFilter: '--preview-media-filter',
  temporal: '--preview-temporal',
  hideIcons: '--preview-hide-icons',
};

export const PREVIEW_TEXT_VAR_NAMES = {
  textShadow: '--preview-text-shadow',
  textOpacity: '--preview-text-opacity',
};

export const PREVIEW_VISUAL_DEFAULTS = { ...ROOT_VISUAL_DEFAULTS };

export const PREVIEW_TEXT_DEFAULTS = {
  textShadow: 'none',
  textOpacity: '1',
};

function resolveValue(entry, fallback) {
  if (!entry?.isActive) return fallback;
  const value = entry.value;
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function resolveFilterValue(key, entry, fallback) {
  if (!entry?.isActive) return fallback;
  if (isVisualFrictionProfileKey(key)) requireVisualFrictionEntry(key, entry);
  return resolveValue(entry, fallback);
}

function resolveOpacityValue(value, fallback) {
  const raw = parseFloat(String(value));
  if (!Number.isFinite(raw)) return fallback;
  const clamped = Math.max(0, Math.min(1, raw));
  return String(clamped);
}

function buildVarMap(varNames, entries) {
  const vars = {};
  Object.entries(entries).forEach(([key, value]) => {
    const varName = varNames?.[key];
    if (!varName) return;
    vars[varName] = value;
  });
  return vars;
}

export function getVisualFilterVars(settings, { varNames = ROOT_VISUAL_VAR_NAMES, defaults = ROOT_VISUAL_DEFAULTS } = {}) {
  const blurEntry = settings?.blur;
  const saturationEntry = settings?.saturation;
  const brightnessEntry = settings?.brightness;
  const contrastEntry = settings?.contrast;
  const colorSaturationEntry = settings?.colorSaturation;
  const mediaFilter = buildMediaVisualFilterValue(settings);

  return buildVarMap(varNames, {
    blur: resolveFilterValue('blur', blurEntry, defaults.blur),
    saturation: resolveFilterValue('saturation', saturationEntry, defaults.saturation),
    brightness: resolveFilterValue('brightness', brightnessEntry, defaults.brightness),
    contrast: resolveFilterValue('contrast', contrastEntry, defaults.contrast),
    colorSaturation: resolveFilterValue('colorSaturation', colorSaturationEntry, defaults.colorSaturation),
    mediaFilter: mediaFilter.length > 0 ? mediaFilter : defaults.mediaFilter,
    temporal: settings?.temporal?.isActive ? '1' : '0',
    hideIcons: settings?.hideIcons?.isActive ? 'none' : 'block',
  });
}

export function getTextFilterVars(settings, { varNames = ROOT_TEXT_VAR_NAMES, defaults = ROOT_TEXT_DEFAULTS } = {}) {
  const textRhythm = settings?.textRhythm;
  const profile = textRhythm?.isActive
    ? requireTextRhythmRuntimeProfile(textRhythm.value)
    : null;
  return buildVarMap(varNames, {
    textBlur: profile?.textBlur || defaults.textBlur,
    textShadow: resolveValue(settings?.textShadow, defaults.textShadow),
    textOpacity: profile
      ? resolveOpacityValue(profile.textOpacity, defaults.textOpacity)
      : defaults.textOpacity,
  });
}
