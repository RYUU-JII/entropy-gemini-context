import { resolveZenHomeGardenBedMaterialPreset } from './zenHomeGardenBedGeometry.js';
import {
    drawZenHomeGardenBedContactShadow,
} from './zenHomeGardenBedRenderer.js';
import { tintZenBonsaiPalette } from './zenBonsaiInkTint.js';
import { ZEN_HOME_GARDEN_BED_RENDER_SPACE } from './zenHomeGardenBedProjectionContract.js';
import { resolveZenEnvironmentShellMaterials } from '../../../presentation/environment/zenEnvironmentShellMaterials.js';

const MATERIAL_STYLE = 'polished_granite';
const MATERIAL_PALETTE = resolveZenHomeGardenBedMaterialPreset(MATERIAL_STYLE).palette;
// The renderer retains immutable environment objects between material updates.
// Resolving a motion frame must not re-project all shell contrast/material roles.
const palettes = new WeakMap();

export function resolveZenHomeFrameSeamPalette(environmentState, mapSurfaceColor) {
    if (typeof mapSurfaceColor !== 'function') throw Error('ZEN_HOME_FRAME_SEAM_SURFACE_MAPPER');
    const cached = palettes.get(environmentState);
    if (cached?.mapSurfaceColor === mapSurfaceColor) return cached.palette;
    const shell = resolveZenEnvironmentShellMaterials(environmentState);
    const palette = Object.freeze({
        ...tintZenBonsaiPalette(MATERIAL_PALETTE, mapSurfaceColor),
        // Every exposed frame plane shares the architectural material; soil
        // and moss retain their own world light. Do not tint shell colors twice.
        frameTop: shell.layers.l3Top,
        frameFront: shell.layers.l3Bottom,
        frameInner: shell.boundaries.borderMuted,
        rimGlow: shell.layers.l3Bottom,
    });
    palettes.set(environmentState, { mapSurfaceColor, palette });
    return palette;
}

function beginPolygonPath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
}

function requireFrameSeamGeometry(geometry) {
    if (geometry?.support !== 'frame-seam'
        || geometry.coordinateSpace !== ZEN_HOME_GARDEN_BED_RENDER_SPACE) {
        throw Error('ZEN_HOME_FRAME_SEAM_RENDER_GEOMETRY');
    }
    return geometry;
}

export function drawZenHomeFrameSeamBack(ctx, geometry, palette, root) {
    if (!root || !Number.isFinite(root.x) || !Number.isFinite(root.y)) {
        throw Error('ZEN_HOME_FRAME_SEAM_RENDER_ROOT');
    }
    const { polygons } = requireFrameSeamGeometry(geometry);
    ctx.save();
    try {
        for (const [polygon, color] of [
            [polygons.outerTop, palette.frameTop],
            [polygons.opening, palette.frameInner],
            [polygons.soil, palette.soil],
        ]) {
            ctx.fillStyle = color;
            beginPolygonPath(ctx, polygon);
            ctx.fill();
        }
        // Keep the existing moss lip and recessed soil. Granite's black wash
        // and mineral flecks no longer repaint the architectural top plane.
        beginPolygonPath(ctx, polygons.soil);
        ctx.clip();
        ctx.lineWidth = Math.max(3, geometry.topPlaneDepth * 0.22);
        ctx.strokeStyle = palette.mossToneA;
        beginPolygonPath(ctx, polygons.opening);
        ctx.stroke();
        ctx.lineWidth = Math.max(1.5, geometry.topPlaneDepth * 0.1);
        ctx.strokeStyle = palette.mossToneB;
        beginPolygonPath(ctx, polygons.opening);
        ctx.stroke();
    } finally {
        ctx.restore();
    }
    drawZenHomeGardenBedContactShadow(ctx, { geometry: { ...geometry, plantingAnchor: root } });
}

export function drawZenHomeFrameSeamFront(ctx, geometry, palette) {
    const { polygons } = requireFrameSeamGeometry(geometry);
    ctx.save();
    try {
        ctx.fillStyle = palette.frameTop;
        beginPolygonPath(ctx, polygons.frontRim);
        ctx.fill();
        ctx.fillStyle = palette.frameFront;
        beginPolygonPath(ctx, polygons.frontFace);
        ctx.fill();
        ctx.fillRect(geometry.frontBottomLeftX, geometry.frontBottomY - 0.5,
            geometry.frontBottomRightX - geometry.frontBottomLeftX, 2.5);

        // Keep the existing top bevel while leaving the frame face unmarked.
        beginPolygonPath(ctx, polygons.frontRim);
        ctx.clip();
        ctx.strokeStyle = palette.rimGlow;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(polygons.frontRim[3].x, polygons.frontRim[3].y);
        ctx.lineTo(polygons.frontRim[2].x, polygons.frontRim[2].y);
        ctx.stroke();
    } finally {
        ctx.restore();
    }
}
