import { createPackedKoiShadowTexture } from './packShadow.js';

export const createShadowBakeApi = ({ createTextureFromRgba8, createCanvas } = {}) => ({
    drawBodyShadowTexture(fishInfo, size, bakeData) {
        if (!bakeData?.bodyPathData?.path) throw new Error('ZEN_KOI_SHADOW_SHAPE_REQUIRED');
        const { w, h, bodyPathData } = bakeData;
        const { canvas, ctx } = createCanvas(w, h, 1);
        if (!ctx) throw new Error('ZEN_KOI_SHADOW_CONTEXT_REQUIRED');
        // A single neutral silhouette: opacity/light belongs to live material,
        // not a darker baked core underneath an independently blurred halo.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fill(bodyPathData.path);
        return createPackedKoiShadowTexture(canvas, createCanvas, createTextureFromRgba8);
    },
});
