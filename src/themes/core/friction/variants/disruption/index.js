import { clinicalDisruptionVariant } from './clinical.js';
import { cyberpunkDisruptionVariant } from './cyberpunk.js';
import { entropyDisruptionVariant } from './entropy.js';
import { matrixDisruptionVariant } from './matrix.js';
import { scpDisruptionVariant } from './scp.js';
import { zenDisruptionVariant } from './zen.js';

const DISRUPTION_VARIANT_REGISTRY = Object.freeze({
  [entropyDisruptionVariant.id]: entropyDisruptionVariant,
  [cyberpunkDisruptionVariant.id]: cyberpunkDisruptionVariant,
  [matrixDisruptionVariant.id]: matrixDisruptionVariant,
  [clinicalDisruptionVariant.id]: clinicalDisruptionVariant,
  [scpDisruptionVariant.id]: scpDisruptionVariant,
  [zenDisruptionVariant.id]: zenDisruptionVariant,
});

function toRgbChannels(value, fallback = '255,255,255') {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (!raw) return fallback;

  const rgbMatch = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) return `${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]}`;

  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return fallback;

  const normalized = hex.length === 3
    ? hex.split('').map((ch) => `${ch}${ch}`).join('')
    : hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return fallback;
  return `${r},${g},${b}`;
}

function resolveStyleVariant(themeId, requestedStyle) {
  if (requestedStyle && DISRUPTION_VARIANT_REGISTRY[requestedStyle]) {
    return requestedStyle;
  }
  if (DISRUPTION_VARIANT_REGISTRY[themeId]) {
    return themeId;
  }
  return entropyDisruptionVariant.id;
}

export function resolveDisruptionVariant({
  themeId,
  friction,
  colors,
}) {
  const requestedStyle = typeof friction?.disruptionStyle === 'string'
    ? friction.disruptionStyle.trim()
    : '';
  const styleVariant = resolveStyleVariant(themeId, requestedStyle);
  const variant = DISRUPTION_VARIANT_REGISTRY[styleVariant] || entropyDisruptionVariant;
  const {
    id: _id,
    rendererId: variantRendererId,
    ...tuning
  } = variant;

  return {
    themeId,
    styleVariant,
    rendererId: variantRendererId || 'signal_disruption',
    flashColor: colors?.text || '#f8fafc',
    layerAChannels: toRgbChannels(colors?.accent, '255,0,0'),
    layerBChannels: toRgbChannels(colors?.accentSecondary, '0,255,255'),
    ...tuning,
  };
}
