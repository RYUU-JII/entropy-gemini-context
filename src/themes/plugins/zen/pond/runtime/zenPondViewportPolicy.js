import { ZEN_GRAPHICS_BUDGETS } from '../../runtime/zenRenderQuality.js';
import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';

// Logical geometry is independent of CSS pixels and backing-store resolution.
// Keep object sizes/heights stable while allowing the water window to change shape.
export const ZEN_POND_RESIZE_SETTLE_MS = 200;
export const ZEN_POND_MAX_DPR = ZEN_GRAPHICS_BUDGETS.full.pixelRatioCap;
export const ZEN_POND_WORLD_SHORT_EDGE = 720;
export const ZEN_POND_RENDER_PIXEL_BUDGET = ZEN_GRAPHICS_BUDGETS.full.maxRenderPixels;

const positive = (value, label) => {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`ZEN_POND_VIEWPORT_POLICY_INVALID:${label}`);
    }
    return value;
};

export const resolveZenPondViewportLayout = ({ width, height }) => {
    positive(width, 'width');
    positive(height, 'height');
    const scale = ZEN_POND_WORLD_SHORT_EDGE / Math.min(width, height);
    const worldWidth = Math.round(width * scale);
    const worldHeight = Math.round(height * scale);
    return Object.freeze({
        width: worldWidth,
        height: worldHeight,
        aspect: width / height,
        // Both composition and optical consumers use this same water rectangle.
        bounds: Object.freeze({ x: 0, y: 0, width: worldWidth, height: worldHeight }),
    });
};

export const resolveZenPondRenderResolution = ({ width, height, devicePixelRatio, dprCap, maxRenderPixels = ZEN_POND_RENDER_PIXEL_BUDGET }) => (
    resolveRasterResolution({ cssWidth: width, cssHeight: height, devicePixelRatio,
        pixelRatioCap: dprCap, maxRenderPixels }).effectivePixelRatio
);

export const resolveZenPondFieldSize = ({ width, height, longEdge }) => {
    positive(width, 'field_width');
    positive(height, 'field_height');
    positive(longEdge, 'field_quality');
    // Retain the former 16:9 quality tier's cell budget at every panel aspect.
    const scale = Math.min(1, Math.sqrt((longEdge * longEdge * 9 / 16) / (width * height)));
    return Object.freeze({
        width: Math.max(1, Math.floor(width * scale)),
        height: Math.max(1, Math.floor(height * scale)),
    });
};

export const resolveZenPondWorldResolution = ({ worldWidth, worldHeight, width, height, resolution, maxRenderPixels = ZEN_POND_RENDER_PIXEL_BUDGET }) => (
    Math.min(
        resolution * Math.max(width / worldWidth, height / worldHeight),
        Math.sqrt(positive(maxRenderPixels, 'pixel_budget') / (worldWidth * worldHeight)),
    )
);
