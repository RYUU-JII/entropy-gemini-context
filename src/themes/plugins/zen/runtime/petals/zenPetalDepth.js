// One emitter, three virtual depth layers. Only the surface layer intersects
// the pond plane; a large foreground petal must never become a water object.
export const ZEN_PETAL_BLUR_RADII = Object.freeze([0, 0.4, 0.8, 1.2, 1.6, 2, 2.4]);
export const ZEN_PETAL_DEPTH_LAYERS = Object.freeze({ BACKGROUND:'background', SURFACE:'surface', FOREGROUND:'foreground' });
const SURFACE_START = 0.2;
const SURFACE_END = 0.72;
const FOCUS_APPROACH_PX = 180;

export const resolveZenPetalDepthLayer = (depth) => {
    if (!Number.isFinite(depth) || depth < 0 || depth > 1) throw new Error('ZEN_PETAL_DEPTH_INVALID');
    return depth < SURFACE_START ? ZEN_PETAL_DEPTH_LAYERS.BACKGROUND
        : depth <= SURFACE_END ? ZEN_PETAL_DEPTH_LAYERS.SURFACE : ZEN_PETAL_DEPTH_LAYERS.FOREGROUND;
};

export const resolveZenPetalBaseSize = (depth, variation) => {
    const layer = resolveZenPetalDepthLayer(depth);
    if (!Number.isFinite(variation) || variation < 0 || variation > 1) throw new Error('ZEN_PETAL_SIZE_VARIATION_INVALID');
    if (layer === ZEN_PETAL_DEPTH_LAYERS.BACKGROUND) return 5.2 + variation * 1.4;
    if (layer === ZEN_PETAL_DEPTH_LAYERS.SURFACE) return 5 + variation * .8;
    return 9 + variation * 5;
};

export const resolveZenPetalDepthProjection = (depth, remainingY) => {
    const layer = resolveZenPetalDepthLayer(depth);
    if (!Number.isFinite(remainingY)) throw new Error('ZEN_PETAL_DEPTH_INVALID');
    if (layer === ZEN_PETAL_DEPTH_LAYERS.BACKGROUND) {
        const distance = 1 - depth / SURFACE_START;
        return { scale: .9 - distance * .12, motionScale: .9 - distance * .18,
            blurIndex: 0 };
    }
    if (layer === ZEN_PETAL_DEPTH_LAYERS.FOREGROUND) {
        const distance = (depth - SURFACE_END) / (1 - SURFACE_END);
        const perspective = distance * distance;
        // Size and screen motion carry depth across most of the field. Only
        // petals crossing the closest camera slice leave the focal range.
        const focus = Math.max(0, Math.min(1, (depth - .94) / .06));
        const focusWeight = focus * focus * (3 - 2 * focus);
        return { scale: 1.25 + perspective * 1.15, motionScale: 1.15 + perspective * .75,
            blurIndex: Math.round(focusWeight * (ZEN_PETAL_BLUR_RADII.length - 1)) };
    }
    const t = Math.max(0, Math.min(1, remainingY / FOCUS_APPROACH_PX));
    const approach = t * t * (3 - 2 * t);
    const offset = ((depth - SURFACE_START) / (SURFACE_END - SURFACE_START) * 2 - 1) * approach;
    return {
        scale: 1 + offset * .1,
        motionScale: 1 + offset * .06,
        blurIndex: 0,
    };
};
