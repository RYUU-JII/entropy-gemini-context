import {
    normalizeZenHomeGardenBedLayoutFrame,
    normalizeZenHomeGardenBedProjection,
    ZEN_HOME_GARDEN_BED_RENDER_SPACE,
} from '../model/bonsai/rendering/zenHomeGardenBedProjectionContract.js';
import {
    resolveZenBonsaiCanvasCssExtent,
    resolveZenBonsaiCanvasPixelExtent,
} from './zenBonsaiCanvasMetrics.js';

const MAX_CANVAS_PIXEL_RATIO = 3;

const requireNonNegativeExtent = (value, field) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error(`ZEN_HOME_GARDEN_BED_PROJECTION_${field}_INVALID`);
    }
    return numeric;
};

const requirePositiveExtent = (value, field) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error(`ZEN_HOME_GARDEN_BED_PROJECTION_${field}_INVALID`);
    }
    return numeric;
};

const requireObject = (value, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`ZEN_HOME_GARDEN_BED_PROJECTION_${field}_REQUIRED`);
    }
    return value;
};

const resolvePixelEdge = (value, pixelRatio) => Math.max(
    0,
    Math.round(requireNonNegativeExtent(value, 'PIXEL_EDGE') * pixelRatio),
);

// Expanded surfaces must cover their rounded scene edges and reserved rim.
// The shared backing-store owner floors integer CSS extents at the given DPR;
// allocate enough whole CSS pixels before handing it that surface.
const resolveCoveringCssExtent = (extent, requiredPixelExtent, pixelRatio) => {
    const cssExtent = Math.max(Math.ceil(extent), Math.ceil(requiredPixelExtent / pixelRatio));
    return resolveZenBonsaiCanvasPixelExtent(cssExtent, pixelRatio) < requiredPixelExtent
        ? cssExtent + 1
        : cssExtent;
};

export const resolveZenOrdinaryBonsaiCanvasSurface = ({
    sceneWidth,
    sceneHeight,
    pixelRatio,
} = {}) => {
    const cssWidth = resolveZenBonsaiCanvasCssExtent(sceneWidth);
    const cssHeight = resolveZenBonsaiCanvasCssExtent(sceneHeight);
    const pixelWidth = resolveZenBonsaiCanvasPixelExtent(cssWidth, pixelRatio);
    const pixelHeight = resolveZenBonsaiCanvasPixelExtent(cssHeight, pixelRatio);
    return Object.freeze({
        expanded: false,
        cssWidth,
        cssHeight,
        cssOffsetX: 0,
        cssOffsetY: 0,
        pixelWidth,
        pixelHeight,
        scenePixelWidth: pixelWidth,
        scenePixelHeight: pixelHeight,
        projection: null,
    });
};

export function resolveZenHomeGardenBedCanvasProjection({
    pixelRatio = 1,
    layoutFrame = null,
} = {}) {
    const dpr = Math.min(
        MAX_CANVAS_PIXEL_RATIO,
        requirePositiveExtent(pixelRatio, 'DEVICE_PIXEL_RATIO'),
    );
    const normalizedLayoutFrame = normalizeZenHomeGardenBedLayoutFrame(layoutFrame);
    const surfaceSize = requireObject(normalizedLayoutFrame.surfaceSize, 'CSS_SURFACE_SIZE');
    const sceneViewport = requireObject(normalizedLayoutFrame.sceneViewport, 'CSS_SCENE_VIEWPORT');
    const sceneCssX = requireNonNegativeExtent(sceneViewport.x, 'CSS_SCENE_X');
    const sceneCssY = requireNonNegativeExtent(sceneViewport.y, 'CSS_SCENE_Y');
    const sceneCssWidth = requirePositiveExtent(sceneViewport.width, 'CSS_SCENE_WIDTH');
    const sceneCssHeight = requirePositiveExtent(sceneViewport.height, 'CSS_SCENE_HEIGHT');
    const sceneCssRight = sceneCssX + sceneCssWidth;
    const sceneCssBottom = sceneCssY + sceneCssHeight;
    const boundaryOvershootDevicePx = resolvePixelEdge(normalizedLayoutFrame.boundaryOvershootCssPx, dpr);
    const scenePixelLeft = resolvePixelEdge(sceneCssX, dpr);
    const scenePixelTop = resolvePixelEdge(sceneCssY, dpr);
    const scenePixelRight = resolvePixelEdge(sceneCssRight, dpr);
    const scenePixelBottom = resolvePixelEdge(sceneCssBottom, dpr);
    const surfaceCssWidth = resolveCoveringCssExtent(
        requirePositiveExtent(surfaceSize.width, 'CSS_SURFACE_WIDTH'),
        scenePixelRight + boundaryOvershootDevicePx, dpr,
    );
    const surfaceCssHeight = resolveCoveringCssExtent(
        requirePositiveExtent(surfaceSize.height, 'CSS_SURFACE_HEIGHT'),
        scenePixelBottom, dpr,
    );
    const surfacePixelWidth = resolveZenBonsaiCanvasPixelExtent(surfaceCssWidth, dpr);
    const surfacePixelHeight = resolveZenBonsaiCanvasPixelExtent(surfaceCssHeight, dpr);
    const scenePixelWidth = scenePixelRight - scenePixelLeft;
    const scenePixelHeight = scenePixelBottom - scenePixelTop;
    if (scenePixelWidth <= 0 || scenePixelHeight <= 0) {
        throw new Error('ZEN_HOME_GARDEN_BED_PROJECTION_DEVICE_SCENE_EMPTY');
    }
    const bedInsetLeftDevicePx = resolvePixelEdge(normalizedLayoutFrame.bedInsetLeftCssPx, dpr);
    // Quantize the shared edge once. Rounding three adjacent lengths separately
    // can allocate one extra device pixel at fractional browser scales.
    const leftIntrusionDevicePx = resolvePixelEdge(
        Number((normalizedLayoutFrame.bedInsetLeftCssPx
            + normalizedLayoutFrame.boundaryOvershootCssPx
            + normalizedLayoutFrame.leftIntrusionCssPx).toFixed(6)), dpr,
    ) - bedInsetLeftDevicePx - boundaryOvershootDevicePx;
    const projection = normalizeZenHomeGardenBedProjection({
        coordinateSpace: ZEN_HOME_GARDEN_BED_RENDER_SPACE,
        support: normalizedLayoutFrame.support,
        rearPaperEdge: normalizedLayoutFrame.rearPaperEdge === null ? null : {
            topX: normalizedLayoutFrame.rearPaperEdge.topX * dpr,
            // The backing surface can round outward by a fraction of a CSS px.
            // Extrapolate the same line to its actual device-pixel height.
            bottomX: (normalizedLayoutFrame.rearPaperEdge.topX
                + (normalizedLayoutFrame.rearPaperEdge.bottomX - normalizedLayoutFrame.rearPaperEdge.topX)
                * (surfacePixelHeight / dpr) / surfaceSize.height) * dpr,
        },
        boundaryOvershootDevicePx,
        leftIntrusionDevicePx,
        bedInsetLeftDevicePx,
        surfaceSize: {
            width: surfacePixelWidth,
            height: surfacePixelHeight,
        },
        sceneViewport: {
            x: scenePixelLeft,
            y: scenePixelTop,
            width: scenePixelWidth,
            height: scenePixelHeight,
        },
    });

    return Object.freeze({
        expanded: true,
        cssWidth: surfaceCssWidth,
        cssHeight: surfaceCssHeight,
        cssOffsetX: -sceneCssX,
        cssOffsetY: -sceneCssY,
        pixelWidth: surfacePixelWidth,
        pixelHeight: surfacePixelHeight,
        scenePixelWidth,
        scenePixelHeight,
        projection,
    });
}

export default resolveZenHomeGardenBedCanvasProjection;
