import { createPackedKoiShadowTexture } from './packShadow.js';
import { ZEN_KOI_SHADOW_PADDING } from '../../../contracts/zenKoiShadowMaterial.js';

// Two authored webs share one packed coverage texture and one live mesh.
// Each frame has its own full padding, preventing cross-family blur leakage.
export const createZenKoiFinShadowAtlas = ({ main, sub, createCanvas, createTextureFromRgba8 }) => {
    if (!main || !sub) throw new Error('ZEN_KOI_FIN_SHADOW_SHAPE_REQUIRED');
    const pad = ZEN_KOI_SHADOW_PADDING;
    const gap = pad * 2;
    const { canvas, ctx } = createCanvas(main.width + gap + sub.width, Math.max(main.height, sub.height), 1);
    if (!ctx) throw new Error('ZEN_KOI_FIN_SHADOW_CONTEXT_REQUIRED');
    ctx.drawImage(main, 0, 0);
    ctx.drawImage(sub, main.width + gap, 0);
    const texture = createPackedKoiShadowTexture(canvas, createCanvas, createTextureFromRgba8);
    const frames = Object.freeze([
        Object.freeze({ x: 0, y: 0, width: main.width + gap, height: main.height + gap }),
        Object.freeze({ x: main.width + gap, y: 0, width: sub.width + gap, height: sub.height + gap }),
    ]);
    return { texture, frames };
};
