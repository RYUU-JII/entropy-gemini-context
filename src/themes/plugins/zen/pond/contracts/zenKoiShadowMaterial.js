// Logical texture/world units shared by cold coverage baking and live meshes.
// This contract must stay independent from Pixi and renderer implementations.
export const ZEN_KOI_SHADOW_RADII = Object.freeze([0.65, 3, 7]);
export const ZEN_KOI_SHADOW_PADDING = 16;

export function writeZenKoiShadowWeights(target, penumbra) {
    if (!Number.isFinite(penumbra) || penumbra < 0) throw new Error('ZEN_KOI_SHADOW_PENUMBRA_REQUIRED');
    const [near, middle, far] = ZEN_KOI_SHADOW_RADII;
    const first = Math.max(0, Math.min(1, (penumbra - near) / (middle - near)));
    const second = Math.max(0, Math.min(1, (penumbra - middle) / (far - middle)));
    target[0] = 1 - first; target[1] = first * (1 - second); target[2] = second;
}
