import { ZEN_SHADOW_SENTINEL_ROLE } from '../../model/koi/zenKoiPresentationRole.js';

// An autonomous invitation silhouette, not a pigment variant or a solar cast.
// Reuse the pond's coverage material, even when ordinary fish shadows are off.
export const ZEN_SHADOW_SENTINEL_RENDER_PROFILE = Object.freeze({
    enabled: true, blur: 2, cadence: 1, opacity: 0.28, scale: 1, includeFins: true,
});
export const ZEN_SHADOW_SENTINEL_PROJECTION = Object.freeze({
    offsetX: 0, offsetY: 0, penumbra: 1.8,
});

export const isZenKoiShadowSentinel = fishInfo => (
    fishInfo?.appearanceProfile?.presentationRole === ZEN_SHADOW_SENTINEL_ROLE
);

export function resolveZenShadowSentinelOpacity(sharedLightState) {
    const nightDepth = sharedLightState?.nightDepth;
    if (!Number.isFinite(nightDepth) || nightDepth < 0 || nightDepth > 1) {
        throw new Error('ZEN_SHADOW_SENTINEL_LIGHT_REQUIRED');
    }
    return 0.28 + nightDepth * 0.06;
}

export function applyZenKoiShadowSentinelPresentation(pixiFish, shadowSentinel, opacity, materialPresence = 1) {
    pixiFish.bodyRope.visible = !shadowSentinel;
    pixiFish.tail.visible = !shadowSentinel;
    pixiFish.bodyRope.alpha = materialPresence;
    pixiFish.tail.alpha = materialPresence;
    for (const fin of [pixiFish.finMainL, pixiFish.finMainR, pixiFish.finSubL, pixiFish.finSubR]) {
        fin.alpha = shadowSentinel ? opacity : opacity * (1 - materialPresence) + materialPresence;
        if (shadowSentinel) fin.tint = 0x000000;
        else if (materialPresence < 1) {
            const tint = fin.tint;
            fin.tint = (Math.round(((tint >> 16) & 255) * materialPresence) << 16)
                | (Math.round(((tint >> 8) & 255) * materialPresence) << 8)
                | Math.round((tint & 255) * materialPresence);
        }
    }
}
