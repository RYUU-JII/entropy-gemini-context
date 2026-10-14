import {
    ZEN_HOME_GARDEN_BED_RENDER_SPACE,
} from './zenHomeGardenBedProjectionContract.js';
import {
    DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    resolveZenHomeGardenBedMaterialPreset,
} from './zenHomeGardenBedGeometry.js';

const requireGeometry = (geometry) => {
    if (
        geometry?.coordinateSpace !== ZEN_HOME_GARDEN_BED_RENDER_SPACE
        || !geometry?.polygons
        || !geometry?.plantingAnchor
        || !geometry?.sceneViewport
    ) {
        throw new Error('ZEN_HOME_GARDEN_BED_RENDER_GEOMETRY_REQUIRED');
    }
    return geometry;
};

const requirePalette = (palette, materialStyle = DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE) => {
    const preset = resolveZenHomeGardenBedMaterialPreset(materialStyle);
    return {
        ...preset.palette,
        ...(palette || {}),
    };
};

const beginPolygonPath = (ctx, points) => {
    if (!Array.isArray(points) || points.length < 3) {
        throw new Error('ZEN_HOME_GARDEN_BED_RENDER_POLYGON_INVALID');
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.closePath();
};

const fillPolygon = (ctx, points) => {
    beginPolygonPath(ctx, points);
    ctx.fill();
};

const interpolatePoint = (from, to, t) => ({
    x: from.x + ((to.x - from.x) * t),
    y: from.y + ((to.y - from.y) * t),
});

/* -------------------------------------------------------------------------- */
/* MATERIAL-SPECIFIC CANVAS PROCEDURAL DETAILS                                */
/* -------------------------------------------------------------------------- */

const drawGlazedCeramicDetails = (ctx, geometry, palette, isFrontLayer) => {
    const { polygons } = geometry;
    ctx.save();
    if (!isFrontLayer) {
        // Glassy specular gradient wash over outerTop
        beginPolygonPath(ctx, polygons.outerTop);
        ctx.clip();
        const topGrad = ctx.createLinearGradient(
            polygons.outerTop[0].x, polygons.outerTop[0].y,
            polygons.outerTop[3].x, polygons.outerTop[3].y,
        );
        topGrad.addColorStop(0, palette.rimGlow || 'rgba(238, 236, 228, 0.14)');
        topGrad.addColorStop(0.35, palette.glazeWash || 'rgba(215, 225, 220, 0.18)');
        topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);

        // Crackle glaze lines (빙렬)
        ctx.strokeStyle = palette.crackleColor || 'rgba(90, 85, 75, 0.12)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        [0.18, 0.42, 0.65, 0.85].forEach((u) => {
            const p1 = interpolatePoint(polygons.outerTop[0], polygons.outerTop[1], u);
            const p2 = interpolatePoint(polygons.outerTop[3], polygons.outerTop[2], u + 0.04);
            ctx.moveTo(p1.x, p1.y);
            ctx.quadraticCurveTo(
                (p1.x + p2.x) * 0.5 + 6,
                (p1.y + p2.y) * 0.5 - 2,
                p2.x, p2.y,
            );
        });
        ctx.stroke();
    } else {
        // High-gloss specular highlight on front rim bevel
        beginPolygonPath(ctx, polygons.frontRim);
        ctx.clip();
        const rimGrad = ctx.createLinearGradient(
            0, geometry.frontRimInnerY,
            0, geometry.frontTopY,
        );
        rimGrad.addColorStop(0, palette.glazeWash || 'rgba(228, 226, 218, 0.06)');
        rimGrad.addColorStop(0.5, palette.rimGlow || 'rgba(238, 236, 228, 0.14)');
        rimGrad.addColorStop(1, 'rgba(228, 226, 218, 0.04)');
        ctx.fillStyle = rimGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);

        ctx.restore();
        ctx.save();
        // Front face glazed wash
        beginPolygonPath(ctx, polygons.frontFace);
        ctx.clip();
        const frontGrad = ctx.createLinearGradient(
            0, geometry.frontTopY,
            0, geometry.frontBottomY,
        );
        frontGrad.addColorStop(0, 'rgba(228, 226, 218, 0.07)');
        frontGrad.addColorStop(0.25, 'rgba(228, 226, 218, 0.02)');
        frontGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
        ctx.fillStyle = frontGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);
    }
    ctx.restore();
};

const drawPolishedGraniteDetails = (ctx, geometry, palette, isFrontLayer) => {
    const { polygons } = geometry;
    ctx.save();
    if (!isFrontLayer) {
        // Granite mineral speckles (quartz & mica dots) on outerTop
        beginPolygonPath(ctx, polygons.outerTop);
        ctx.clip();

        // Subtle granite base gradient
        const topGrad = ctx.createLinearGradient(
            polygons.outerTop[0].x, polygons.outerTop[0].y,
            polygons.outerTop[3].x, polygons.outerTop[3].y,
        );
        topGrad.addColorStop(0, 'rgba(232, 234, 230, 0.07)');
        topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);

        // Mineral speckles
        const width = geometry.viewportWidth;
        const height = geometry.viewportHeight;
        for (let i = 0; i < 45; i += 1) {
            const x = (i * 37) % width;
            const y = geometry.topPlaneRearY + ((i * 19) % (geometry.frontTopY - geometry.topPlaneRearY + 10));
            ctx.fillStyle = (i % 2 === 0)
                ? (palette.speckleLight || 'rgba(236, 238, 234, 0.16)')
                : (palette.speckleDark || 'rgba(25, 28, 26, 0.32)');
            ctx.beginPath();
            ctx.arc(x, y, (i % 3 === 0) ? 1.2 : 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.save();
        // Organic moss lip border around opening inside soil
        beginPolygonPath(ctx, polygons.soil);
        ctx.clip();
        ctx.lineWidth = Math.max(3, geometry.topPlaneDepth * 0.22);
        ctx.strokeStyle = palette.mossToneA || '#687B4A';
        beginPolygonPath(ctx, polygons.opening);
        ctx.stroke();

        ctx.lineWidth = Math.max(1.5, geometry.topPlaneDepth * 0.1);
        ctx.strokeStyle = palette.mossToneB || '#526537';
        beginPolygonPath(ctx, polygons.opening);
        ctx.stroke();
    } else {
        // Chiseled chamfer edge highlight on front rim
        beginPolygonPath(ctx, polygons.frontRim);
        ctx.clip();
        ctx.strokeStyle = palette.rimGlow || 'rgba(232, 234, 230, 0.12)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(polygons.frontRim[3].x, polygons.frontRim[3].y);
        ctx.lineTo(polygons.frontRim[2].x, polygons.frontRim[2].y);
        ctx.stroke();

        ctx.restore();
        ctx.save();
        beginPolygonPath(ctx, polygons.frontFace);
        ctx.clip();
        const width = geometry.viewportWidth;
        for (let i = 0; i < 30; i += 1) {
            const x = (i * 41) % width;
            const y = geometry.frontTopY + ((i * 23) % (geometry.frontBottomY - geometry.frontTopY));
            ctx.fillStyle = (i % 2 === 0)
                ? (palette.speckleLight || 'rgba(236, 238, 234, 0.16)')
                : (palette.speckleDark || 'rgba(25, 28, 26, 0.32)');
            ctx.beginPath();
            ctx.arc(x, y, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
};

const drawCharredWoodDetails = (ctx, geometry, palette, isFrontLayer) => {
    const { polygons } = geometry;
    ctx.save();
    if (!isFrontLayer) {
        // Timber grain on outerTop
        beginPolygonPath(ctx, polygons.outerTop);
        ctx.clip();

        ctx.strokeStyle = palette.woodGrainDark || 'rgba(15, 12, 10, 0.35)';
        ctx.lineWidth = 1.2;
        [0.2, 0.4, 0.6, 0.8].forEach((v) => {
            const p1 = interpolatePoint(polygons.outerTop[0], polygons.outerTop[3], v);
            const p2 = interpolatePoint(polygons.outerTop[1], polygons.outerTop[2], v);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });

        ctx.restore();
        ctx.save();

        // Karesansui Raked Sand Ripples across the soil surface
        beginPolygonPath(ctx, polygons.soil);
        ctx.clip();
        const center = geometry.plantingAnchor;
        ctx.strokeStyle = palette.sandRippleLight || 'rgba(235, 225, 210, 0.16)';
        ctx.lineWidth = 1;
        [15, 28, 42, 58, 75].forEach((radius) => {
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, radius * 1.8, radius * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
    } else {
        // Charred timber vertical grain on frontFace
        beginPolygonPath(ctx, polygons.frontFace);
        ctx.clip();
        ctx.strokeStyle = palette.woodGrainDark || 'rgba(15, 12, 10, 0.35)';
        ctx.lineWidth = 1;
        const step = Math.max(12, geometry.viewportWidth / 24);
        for (let x = 0; x < geometry.viewportWidth; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, geometry.frontTopY);
            ctx.lineTo(x + 4, geometry.frontBottomY);
            ctx.stroke();
        }
    }
    ctx.restore();
};

const drawWetSlateDetails = (ctx, geometry, palette, isFrontLayer) => {
    const { polygons } = geometry;
    ctx.save();
    if (!isFrontLayer) {
        // Slate base texture
        beginPolygonPath(ctx, polygons.outerTop);
        ctx.clip();
        const topGrad = ctx.createLinearGradient(
            polygons.outerTop[0].x, polygons.outerTop[0].y,
            polygons.outerTop[3].x, polygons.outerTop[3].y,
        );
        topGrad.addColorStop(0, 'rgba(226, 220, 208, 0.06)');
        topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);

        ctx.restore();
        ctx.save();
        // Deep inset drop shadow on opening/soil polygon
        beginPolygonPath(ctx, polygons.soil);
        ctx.clip();

        const shadowGrad = ctx.createLinearGradient(
            0, geometry.soilRearY,
            0, geometry.soilFrontY,
        );
        shadowGrad.addColorStop(0, palette.insetShadow || 'rgba(10, 12, 15, 0.52)');
        shadowGrad.addColorStop(0.35, 'rgba(10, 12, 15, 0.18)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);
    } else {
        // Moisture sheen highlight along front rim
        beginPolygonPath(ctx, polygons.frontRim);
        ctx.clip();
        ctx.fillStyle = palette.wetSheen || 'rgba(200, 220, 235, 0.32)';
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);

        ctx.restore();
        ctx.save();
        beginPolygonPath(ctx, polygons.frontFace);
        ctx.clip();
        const frontGrad = ctx.createLinearGradient(
            0, geometry.frontTopY,
            0, geometry.frontBottomY,
        );
        frontGrad.addColorStop(0, 'rgba(214, 222, 226, 0.05)');
        frontGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        ctx.fillStyle = frontGrad;
        ctx.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);
    }
    ctx.restore();
};

/* -------------------------------------------------------------------------- */
/* MAIN PUBLIC LAYER DRAWING FUNCTIONS                                       */
/* -------------------------------------------------------------------------- */

export function drawZenHomeGardenBedBackLayer(ctx, {
    geometry,
    palette,
    materialStyle = DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
} = {}) {
    const resolvedGeometry = requireGeometry(geometry);
    const resolvedPalette = requirePalette(palette, materialStyle);

    ctx.save();
    ctx.fillStyle = resolvedPalette.frameTop;
    fillPolygon(ctx, resolvedGeometry.polygons.outerTop);

    ctx.fillStyle = resolvedPalette.frameInner;
    fillPolygon(ctx, resolvedGeometry.polygons.opening);

    ctx.fillStyle = resolvedPalette.soil;
    fillPolygon(ctx, resolvedGeometry.polygons.soil);
    ctx.restore();

    switch (materialStyle) {
    case 'polished_granite':
        drawPolishedGraniteDetails(ctx, resolvedGeometry, resolvedPalette, false);
        break;
    case 'charred_wood':
        drawCharredWoodDetails(ctx, resolvedGeometry, resolvedPalette, false);
        break;
    case 'wet_slate':
        drawWetSlateDetails(ctx, resolvedGeometry, resolvedPalette, false);
        break;
    case 'glazed_ceramic':
    default:
        drawGlazedCeramicDetails(ctx, resolvedGeometry, resolvedPalette, false);
        break;
    }
}

export function drawZenHomeGardenBedContactShadow(ctx, {
    geometry,
    lighting = null,
} = {}) {
    const resolvedGeometry = requireGeometry(geometry);
    const sceneViewport = resolvedGeometry.sceneViewport;
    const plantingAnchor = resolvedGeometry.plantingAnchor;
    const shadowDirX = Number(lighting?.shadowDirX) || 0;
    const shadowDirY = Number(lighting?.shadowDirY) || 0;
    const radiusX = Math.max(10, sceneViewport.width * 0.085);
    const radiusY = Math.max(3, sceneViewport.height * 0.018);
    const centerX = plantingAnchor.x + (shadowDirX * radiusX * 0.18);
    const centerY = plantingAnchor.y + (shadowDirY * radiusY * 0.24);

    ctx.save();
    beginPolygonPath(ctx, resolvedGeometry.polygons.soil);
    ctx.clip();
    ctx.translate(centerX, centerY);
    ctx.scale(1, radiusY / radiusX);
    const shadow = ctx.createRadialGradient(0, 0, radiusX * 0.06, 0, 0, radiusX);
    shadow.addColorStop(0, 'rgba(36, 27, 19, 0.24)');
    shadow.addColorStop(0.54, 'rgba(44, 33, 23, 0.12)');
    shadow.addColorStop(1, 'rgba(44, 33, 23, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
    ctx.restore();
}

export function drawZenHomeGardenBedFrontLayer(ctx, {
    geometry,
    palette,
    frontColor,
    materialStyle = DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
} = {}) {
    const resolvedGeometry = requireGeometry(geometry);
    const resolvedPalette = requirePalette(palette, materialStyle);
    const resolvedFrontColor = frontColor || resolvedPalette.frameFront;

    ctx.save();
    ctx.fillStyle = resolvedPalette.frameTop;
    fillPolygon(ctx, resolvedGeometry.polygons.frontRim);

    ctx.fillStyle = resolvedFrontColor;
    fillPolygon(ctx, resolvedGeometry.polygons.frontFace);
    ctx.fillRect(
        resolvedGeometry.frontBottomLeftX,
        resolvedGeometry.frontBottomY - 0.5,
        resolvedGeometry.frontBottomRightX - resolvedGeometry.frontBottomLeftX,
        2.5,
    );
    ctx.restore();

    switch (materialStyle) {
    case 'polished_granite':
        drawPolishedGraniteDetails(ctx, resolvedGeometry, resolvedPalette, true);
        break;
    case 'charred_wood':
        drawCharredWoodDetails(ctx, resolvedGeometry, resolvedPalette, true);
        break;
    case 'wet_slate':
        drawWetSlateDetails(ctx, resolvedGeometry, resolvedPalette, true);
        break;
    case 'glazed_ceramic':
    default:
        drawGlazedCeramicDetails(ctx, resolvedGeometry, resolvedPalette, true);
        break;
    }
}
