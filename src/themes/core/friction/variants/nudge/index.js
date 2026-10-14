import { clinicalNudgeVariant } from './clinical.js';
import { cyberpunkNudgeVariant } from './cyberpunk.js';
import { entropyNudgeVariant } from './entropy.js';
import { matrixNudgeVariant } from './matrix.js';
import { scpNudgeVariant } from './scp.js';
import { zenNudgeVariant } from './zen.js';

const NUDGE_VARIANT_REGISTRY = Object.freeze({
  [entropyNudgeVariant.id]: entropyNudgeVariant,
  [cyberpunkNudgeVariant.id]: cyberpunkNudgeVariant,
  [matrixNudgeVariant.id]: matrixNudgeVariant,
  [clinicalNudgeVariant.id]: clinicalNudgeVariant,
  [scpNudgeVariant.id]: scpNudgeVariant,
  [zenNudgeVariant.id]: zenNudgeVariant,
});

function hexToRgb(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { r: 255, g: 255, b: 255 };

  const rgbMatch = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]) || 255,
      g: Number(rgbMatch[2]) || 255,
      b: Number(rgbMatch[3]) || 255,
    };
  }

  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) {
    return { r: 255, g: 255, b: 255 };
  }

  const normalized = hex.length === 3
    ? hex.split('').map((ch) => `${ch}${ch}`).join('')
    : hex;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function withAlpha(color, alpha) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveStyleVariant(themeId, requestedStyle) {
  if (requestedStyle && NUDGE_VARIANT_REGISTRY[requestedStyle]) {
    return requestedStyle;
  }
  if (NUDGE_VARIANT_REGISTRY[themeId]) {
    return themeId;
  }
  return entropyNudgeVariant.id;
}

export function resolveNudgeVariant({
  themeId,
  friction,
  profile,
  colors,
}) {
  const requestedStyle = typeof friction?.nudgeStyle === 'string'
    ? friction.nudgeStyle.trim()
    : '';
  const styleVariant = resolveStyleVariant(themeId, requestedStyle);
  const variant = NUDGE_VARIANT_REGISTRY[styleVariant] || entropyNudgeVariant;
  const profilePreset = typeof profile?.nudgePreset === 'string'
    ? profile.nudgePreset.trim()
    : '';

  const primary = colors?.accent || '#ff3b30';
  const secondary = colors?.accentSecondary || primary;

  return {
    themeId,
    styleVariant: variant.styleVariant || styleVariant,
    hudVariant: variant.hudVariant || null,
    presetId: profilePreset || variant.presetId || 'default',
    shape: variant.shape || null,
    beam: typeof variant.beam === 'boolean' ? variant.beam : null,
    trailAlpha: Number.isFinite(Number(variant.trailAlpha)) ? Number(variant.trailAlpha) : null,
    motion: variant.motion && typeof variant.motion === 'object'
      ? { ...variant.motion }
      : null,
    palette: {
      primary,
      secondary,
      tertiary: colors?.accentTertiary || colors?.accentSecondary || '#22d3ee',
      text: colors?.text || '#f8fafc',
      background: colors?.background || '#0b0f14',
      glow: colors?.accentRing || withAlpha(primary, 0.35),
      ...(variant.palette && typeof variant.palette === 'object' ? variant.palette : {}),
    },
  };
}
