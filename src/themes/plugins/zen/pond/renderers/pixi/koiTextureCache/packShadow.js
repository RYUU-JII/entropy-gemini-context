import { ZEN_KOI_SHADOW_PADDING, ZEN_KOI_SHADOW_RADII } from '../../../contracts/zenKoiShadowMaterial.js';

// RGB contains three complete prefiltered coverage fields; opaque alpha keeps
// them as data under Pixi's premultiplied texture upload. Called only at bake.
export function packKoiShadowCoverage(source, createCanvas) {
    const padding = ZEN_KOI_SHADOW_PADDING;
    const width = source.width + 2 * padding, height = source.height + 2 * padding;
    // The only raster surface is read after each unchanged blur. The completed
    // opaque coverage data is uploaded directly without a second output Canvas.
    const scratch = createCanvas(width, height, 1, { alpha: true, willReadFrequently: true });
    if (!scratch.ctx) throw new Error('ZEN_KOI_SHADOW_PACK_CONTEXT_REQUIRED');
    const packed = new Uint8Array(width * height * 4);
    const bounds = new Float32Array(width * 6);
    for (let i = 0; i < bounds.length; i += 2) {
        bounds[i] = height;
        bounds[i + 1] = -1;
    }
    for (let channel = 0; channel < ZEN_KOI_SHADOW_RADII.length; channel++) {
        scratch.ctx.clearRect(0, 0, width, height);
        scratch.ctx.filter = `blur(${ZEN_KOI_SHADOW_RADII[channel]}px)`;
        scratch.ctx.drawImage(source, padding, padding);
        scratch.ctx.filter = 'none';
        const coverage = scratch.ctx.getImageData(0, 0, width, height).data;
        // Derive column support while each coverage byte is already in hand.
        // Row order gives the last occupied y without another image scan.
        for (let y = 0; y < height; y++) {
            let i = y * width * 4;
            for (let x = 0; x < width; x++, i += 4) {
                const alpha = coverage[i + 3];
                packed[i + channel] = alpha;
                if (channel === 0) packed[i + 3] = 255;
                if (alpha > 1) {
                    const bound = x * 6 + channel * 2;
                    if (bounds[bound + 1] < 0) bounds[bound] = y;
                    bounds[bound + 1] = y;
                }
            }
        }
    }
    // Per-column support for each band lets a bent rope discard the enormous
    // transparent rectangle. Keeping that rectangle folded inside a C-turn
    // causes overlapping triangles and dark radial streaks.
    for (let i = 0; i < bounds.length; i += 2) {
        const low = bounds[i], high = bounds[i + 1];
        bounds[i] = high < 0 ? 0.5 : Math.max(0, low - 1) / height;
        bounds[i + 1] = high < 0 ? 0.5 : Math.min(height, high + 2) / height;
    }
    return { kind: 'rgba8', data: packed, width, height, zenKoiShadowBounds: bounds };
}

export function createPackedKoiShadowTexture(source, createCanvas, createTextureFromRgba8) {
    const packed = packKoiShadowCoverage(source, createCanvas);
    const texture = createTextureFromRgba8(packed);
    texture.zenKoiShadowBounds = packed.zenKoiShadowBounds;
    return texture;
}
