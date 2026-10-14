import { clinicalGatekeeperVariant } from './clinical.js';
import { cyberpunkGatekeeperVariant } from './cyberpunk.js';
import { entropyGatekeeperVariant } from './entropy.js';
import { matrixGatekeeperVariant } from './matrix.js';
import { scpGatekeeperVariant } from './scp.js';
import { zenGatekeeperVariant } from './zen.js';

const GATEKEEPER_VARIANT_REGISTRY = Object.freeze({
  [entropyGatekeeperVariant.id]: entropyGatekeeperVariant,
  [cyberpunkGatekeeperVariant.id]: cyberpunkGatekeeperVariant,
  [matrixGatekeeperVariant.id]: matrixGatekeeperVariant,
  [clinicalGatekeeperVariant.id]: clinicalGatekeeperVariant,
  [scpGatekeeperVariant.id]: scpGatekeeperVariant,
  [zenGatekeeperVariant.id]: zenGatekeeperVariant,
});

const VALID_GATEKEEPER_COPY_VARIANTS = new Set(['default', 'zen']);

function requireVariantString(variant, key) {
  const value = variant?.[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  throw new Error(`[gatekeeperVariant] ${variant?.id || 'unknown'} is missing ${key}.`);
}

function resolveStyleVariant(themeId, requestedStyle) {
  if (requestedStyle && GATEKEEPER_VARIANT_REGISTRY[requestedStyle]) {
    return requestedStyle;
  }
  if (GATEKEEPER_VARIANT_REGISTRY[themeId]) {
    return themeId;
  }
  return entropyGatekeeperVariant.id;
}

export function resolveGatekeeperVariant({
  themeId,
  friction,
  colors,
}) {
  const requestedStyle = typeof friction?.gatekeeperStyle === 'string'
    ? friction.gatekeeperStyle.trim()
    : '';
  const styleVariant = resolveStyleVariant(themeId, requestedStyle);
  const variant = GATEKEEPER_VARIANT_REGISTRY[styleVariant] || entropyGatekeeperVariant;

  const requestedCopy = typeof friction?.gatekeeperCopy === 'string'
    ? friction.gatekeeperCopy.trim()
    : '';
  const copyVariant = VALID_GATEKEEPER_COPY_VARIANTS.has(requestedCopy)
    ? requestedCopy
    : variant.defaultCopyVariant;

  return {
    themeId,
    styleVariant,
    copyVariant,
    rendererId: requireVariantString(variant, 'rendererId'),
    interstitialRendererId: requireVariantString(variant, 'interstitialRendererId'),
    unlockPattern: variant.unlockPattern,
    colors,
  };
}
