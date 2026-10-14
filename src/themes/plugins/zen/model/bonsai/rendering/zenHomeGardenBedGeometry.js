import {
    normalizeZenHomeGardenBedProjection,
    ZEN_HOME_GARDEN_BED_RENDER_SPACE,
} from './zenHomeGardenBedProjectionContract.js';
import { resolveZenHomeFrameSeamMesh } from './zenHomeFrameSeamGeometry.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const ZEN_HOME_GARDEN_BED_GEOMETRY = Object.freeze({
    frontRiseRatio: 0.093,
    topPlaneDepthRatio: 0.065,
    railWidthRatio: 0.018,
    rearRailDepthRatio: 0.012,
    frontRimDepthRatio: 0.014,
    innerWallWidthRatio: 0.008,
    soilRecessRatio: 0.01,
    plantingDepthRatio: 0.58,
    leftFrontDropRatio: 0.01,
});

export const ZEN_HOME_GARDEN_BED_COLORS = Object.freeze({
    frameTop: '#B4AFA3',
    frameFront: '#98938A',
    frameInner: '#87827A',
    soil: '#4A4137',
});

export const ZEN_HOME_GARDEN_BED_MATERIAL_STYLES = Object.freeze({
    GLAZED_CERAMIC: 'glazed_ceramic',
    POLISHED_GRANITE: 'polished_granite',
    CHARRED_WOOD: 'charred_wood',
    WET_SLATE: 'wet_slate',
});

export const DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE = ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.GLAZED_CERAMIC;

const ZEN_HOME_GARDEN_BED_MATERIAL_STYLE_VALUES = new Set(
    Object.values(ZEN_HOME_GARDEN_BED_MATERIAL_STYLES),
);

export const requireZenHomeGardenBedMaterialStyle = (styleId) => {
    if (!ZEN_HOME_GARDEN_BED_MATERIAL_STYLE_VALUES.has(styleId)) {
        throw new Error(`ZEN_HOME_GARDEN_BED_MATERIAL_STYLE_INVALID:${String(styleId)}`);
    }
    return styleId;
};

/**
 * Bed materials, pitched as a support rather than a subject.
 *
 * The bed sits under the one thing the screen is about, so it holds the middle
 * of the value range: darker than the sky, lighter than the tree. Its former
 * near-white glaze made it the brightest object in the frame and pulled the
 * eye straight off the bonsai. Specular white is gone for the same reason it
 * left the wood — these values are painted by the scene's light at draw time,
 * so nothing here may bake in a highlight of its own.
 */
export const ZEN_HOME_GARDEN_BED_MATERIAL_PRESETS = Object.freeze({
    [ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.GLAZED_CERAMIC]: Object.freeze({
        id: 'glazed_ceramic',
        name: 'Glazed Ceramic',
        palette: Object.freeze({
            frameTop: '#BCB7AB',
            frameFront: '#9E998F',
            frameInner: '#8B867D',
            soil: '#463E35',
            soilLight: '#605547',
            rimGlow: 'rgba(238, 236, 228, 0.14)',
            glazeWash: 'rgba(206, 208, 200, 0.09)',
            crackleColor: 'rgba(74, 70, 62, 0.13)',
            speckleLight: 'rgba(238, 236, 228, 0.12)',
            speckleDark: 'rgba(58, 52, 44, 0.13)',
        }),
    }),
    [ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.POLISHED_GRANITE]: Object.freeze({
        id: 'polished_granite',
        name: 'Polished Granite',
        palette: Object.freeze({
            frameTop: '#8E908C',
            frameFront: '#71736F',
            frameInner: '#5B5D59',
            soil: '#433A2F',
            soilLight: '#5E5346',
            rimGlow: 'rgba(232, 234, 230, 0.12)',
            mossToneA: '#616B4C',
            mossToneB: '#4F573C',
            speckleLight: 'rgba(236, 238, 234, 0.16)',
            speckleDark: 'rgba(30, 32, 30, 0.26)',
        }),
    }),
    [ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.CHARRED_WOOD]: Object.freeze({
        id: 'charred_wood',
        name: 'Charred Wood',
        palette: Object.freeze({
            frameTop: '#454039',
            frameFront: '#2E2A26',
            frameInner: '#221F1C',
            soil: '#5F5346',
            soilLight: '#847462',
            rimGlow: 'rgba(226, 220, 208, 0.1)',
            sandRippleLight: 'rgba(226, 220, 208, 0.13)',
            sandRippleDark: 'rgba(48, 40, 32, 0.22)',
            woodGrainLight: 'rgba(120, 112, 102, 0.13)',
            woodGrainDark: 'rgba(16, 14, 12, 0.32)',
        }),
    }),
    [ZEN_HOME_GARDEN_BED_MATERIAL_STYLES.WET_SLATE]: Object.freeze({
        id: 'wet_slate',
        name: 'Wet Slate',
        palette: Object.freeze({
            frameTop: '#565B5E',
            frameFront: '#3F4346',
            frameInner: '#2F3336',
            soil: '#332B22',
            soilLight: '#4E4335',
            rimGlow: 'rgba(214, 222, 226, 0.11)',
            insetShadow: 'rgba(14, 16, 19, 0.46)',
            wetSheen: 'rgba(190, 206, 218, 0.2)',
            speckleLight: 'rgba(210, 220, 228, 0.14)',
            speckleDark: 'rgba(18, 21, 24, 0.24)',
        }),
    }),
});

export const resolveZenHomeGardenBedMaterialPreset = (styleId) => {
    const key = String(styleId || '').trim();
    return ZEN_HOME_GARDEN_BED_MATERIAL_PRESETS[key] || ZEN_HOME_GARDEN_BED_MATERIAL_PRESETS[DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE];
};

const freezePoint = (x, y) => Object.freeze({ x, y });

/**
 * Describes the bed's soil surface at the planting point, in the scene-local
 * pixels the tree command stream is drawn in.
 *
 * The tree renderer translates by `sceneViewport` before executing its command
 * stream, so anything that has to meet the soil — the nebari above all — needs
 * the ground expressed in that same space. `frontDepth` / `rearDepth` are how
 * far the visible soil runs toward and away from the viewer at the trunk, held
 * back from the rim so surface roots tuck under it instead of crossing it.
 */
export const ZEN_HOME_GARDEN_BED_SOIL_MARGIN_RATIO = 0.82;

export function resolveZenHomeGardenBedGroundPlane({ geometry, viewport = geometry?.sceneViewport } = {}) {
    if (!geometry || typeof geometry !== 'object') {
        throw new Error('ZEN_HOME_GARDEN_BED_GROUND_PLANE_GEOMETRY_REQUIRED');
    }
    const { plantingAnchor } = geometry;
    const sceneViewport = viewport;
    const depthRatio = ZEN_HOME_GARDEN_BED_GEOMETRY.plantingDepthRatio;
    const localX = plantingAnchor.x - sceneViewport.x;
    const localY = plantingAnchor.y - sceneViewport.y;
    const leftX = geometry.soilRearLeftX
        + ((geometry.soilFrontLeftX - geometry.soilRearLeftX) * depthRatio)
        - sceneViewport.x;
    const rightX = geometry.soilRearRightX
        + ((geometry.soilFrontRightX - geometry.soilRearRightX) * depthRatio)
        - sceneViewport.x;
    const halfWidth = Math.max(
        6,
        Math.min(
            localX - leftX,
            rightX - localX,
            localX,
            sceneViewport.width - localX,
        ),
    );
    const margin = ZEN_HOME_GARDEN_BED_SOIL_MARGIN_RATIO;
    return Object.freeze({
        center: freezePoint(localX, localY),
        halfWidth,
        frontDepth: Math.max(
            2,
            (geometry.soilFrontY - plantingAnchor.y) * margin,
        ),
        rearDepth: Math.max(
            1.5,
            (plantingAnchor.y - geometry.soilRearY) * margin,
        ),
        // The bed paints and textures its own soil; the nebari must not
        // double-dress it.
        drawSoil: false,
    });
}

const freezePolygon = (points) => Object.freeze(points.map((point) => freezePoint(point.x, point.y)));

const interpolatePoint = (from, to, amount) => ({
    x: from.x + ((to.x - from.x) * amount),
    y: from.y + ((to.y - from.y) * amount),
});

const projectBedPoint = ({ rearLeft, rearRight, frontLeft, frontRight }, u, v) => {
    const rear = interpolatePoint(rearLeft, rearRight, clamp(u, 0, 1));
    const front = interpolatePoint(frontLeft, frontRight, clamp(u, 0, 1));
    return interpolatePoint(rear, front, clamp(v, 0, 1));
};

const interpolateProjectedQuad = (quad, u, v) => {
    const rear = interpolatePoint(quad[0], quad[1], clamp(u, 0, 1));
    const front = interpolatePoint(quad[3], quad[2], clamp(u, 0, 1));
    return interpolatePoint(rear, front, clamp(v, 0, 1));
};

export function resolveZenHomeGardenBedDeviceMesh({
    projection,
} = {}) {
    const resolvedProjection = normalizeZenHomeGardenBedProjection(projection);
    if (resolvedProjection.support === 'frame-seam') return resolveZenHomeFrameSeamMesh(resolvedProjection);
    const width = resolvedProjection.surfaceSize.width;
    const height = resolvedProjection.surfaceSize.height;
    const sceneViewport = resolvedProjection.sceneViewport;
    const sceneRight = sceneViewport.x + sceneViewport.width;
    const sceneBottom = sceneViewport.y + sceneViewport.height;
    const leftIntrusion = resolvedProjection.leftIntrusionDevicePx;
    const hasLeftBridge = leftIntrusion > 0;
    const frontRise = sceneViewport.height * ZEN_HOME_GARDEN_BED_GEOMETRY.frontRiseRatio;
    const topPlaneDepth = clamp(
        sceneViewport.height * ZEN_HOME_GARDEN_BED_GEOMETRY.topPlaneDepthRatio,
        sceneViewport.height * 0.05,
        sceneViewport.height * 0.08,
    );
    const railWidth = clamp(
        sceneViewport.width * ZEN_HOME_GARDEN_BED_GEOMETRY.railWidthRatio,
        sceneViewport.width * 0.014,
        sceneViewport.width * 0.024,
    );
    const rearRailDepth = clamp(
        sceneViewport.height * ZEN_HOME_GARDEN_BED_GEOMETRY.rearRailDepthRatio,
        sceneViewport.height * 0.008,
        sceneViewport.height * 0.016,
    );
    const frontRimDepth = clamp(
        sceneViewport.height * ZEN_HOME_GARDEN_BED_GEOMETRY.frontRimDepthRatio,
        sceneViewport.height * 0.01,
        sceneViewport.height * 0.018,
    );
    const innerWallWidth = clamp(
        sceneViewport.width * ZEN_HOME_GARDEN_BED_GEOMETRY.innerWallWidthRatio,
        sceneViewport.width * 0.006,
        sceneViewport.width * 0.012,
    );
    const soilRecess = clamp(
        sceneViewport.height * ZEN_HOME_GARDEN_BED_GEOMETRY.soilRecessRatio,
        sceneViewport.height * 0.008,
        sceneViewport.height * 0.013,
    );
    const frontTopY = sceneBottom - frontRise;
    const topPlaneRearY = frontTopY - topPlaneDepth;
    const leftFrontDrop = hasLeftBridge
        ? clamp(
            sceneViewport.height * ZEN_HOME_GARDEN_BED_GEOMETRY.leftFrontDropRatio,
            topPlaneDepth * 0.06,
            topPlaneDepth * 0.16,
        )
        : 0;
    const bedInsetLeft = resolvedProjection.bedInsetLeftDevicePx;
    const frontOuterLeftX = bedInsetLeft + resolvedProjection.boundaryOvershootDevicePx;
    const frontOuterRightX = width - resolvedProjection.boundaryOvershootDevicePx;
    const rearOuterLeftX = hasLeftBridge
        ? frontOuterLeftX + leftIntrusion
        : sceneViewport.x;
    const outerPlane = {
        rearLeft: freezePoint(rearOuterLeftX, topPlaneRearY),
        rearRight: freezePoint(sceneRight, topPlaneRearY),
        frontLeft: freezePoint(frontOuterLeftX, frontTopY + leftFrontDrop),
        frontRight: freezePoint(frontOuterRightX, frontTopY + leftFrontDrop),
    };
    const rimU = clamp(railWidth / sceneViewport.width, 0.004, 0.12);
    const innerWallU = clamp(innerWallWidth / sceneViewport.width, 0.002, 0.08);
    const rearOpeningV = clamp(rearRailDepth / topPlaneDepth, 0.04, 0.42);
    const frontOpeningV = clamp(1 - (frontRimDepth / topPlaneDepth), 0.58, 0.96);
    const soilStepV = clamp(soilRecess / topPlaneDepth, 0.02, 0.24);
    const soilRearV = clamp(rearOpeningV + soilStepV, rearOpeningV, frontOpeningV);
    const soilFrontV = clamp(frontOpeningV + soilStepV, soilRearV, 0.985);
    const soilU = clamp(rimU + innerWallU, rimU, 0.22);
    const opening = freezePolygon([
        projectBedPoint(outerPlane, rimU, rearOpeningV),
        projectBedPoint(outerPlane, 1 - rimU, rearOpeningV),
        projectBedPoint(outerPlane, 1 - rimU, frontOpeningV),
        projectBedPoint(outerPlane, rimU, frontOpeningV),
    ]);
    const soil = freezePolygon([
        projectBedPoint(outerPlane, soilU, soilRearV),
        projectBedPoint(outerPlane, 1 - soilU, soilRearV),
        projectBedPoint(outerPlane, 1 - soilU, soilFrontV),
        projectBedPoint(outerPlane, soilU, soilFrontV),
    ]);
    const outerTop = freezePolygon([
        outerPlane.rearLeft,
        outerPlane.rearRight,
        outerPlane.frontRight,
        outerPlane.frontLeft,
    ]);
    const frontRim = freezePolygon([
        opening[3],
        opening[2],
        outerPlane.frontRight,
        outerPlane.frontLeft,
    ]);
    const frontFace = freezePolygon([
        outerPlane.frontLeft,
        outerPlane.frontRight,
        freezePoint(width, height),
        freezePoint(frontOuterLeftX, height),
    ]);
    const projectedPlantingAnchor = interpolateProjectedQuad(
        soil,
        0.5,
        ZEN_HOME_GARDEN_BED_GEOMETRY.plantingDepthRatio,
    );
    const plantingAnchor = freezePoint(
        projectedPlantingAnchor.x,
        projectedPlantingAnchor.y,
    );

    if (
        opening[0].x >= opening[1].x
        || opening[3].x >= opening[2].x
        || soil[0].x >= soil[1].x
        || soil[3].x >= soil[2].x
    ) {
        throw new Error('ZEN_HOME_GARDEN_BED_PROJECTED_MESH_INVALID');
    }

    return Object.freeze({
        coordinateSpace: ZEN_HOME_GARDEN_BED_RENDER_SPACE,
        support: 'planter',
        viewportWidth: width,
        viewportHeight: height,
        sceneViewport,
        leftIntrusion,
        bedInsetLeft,
        frontRise,
        frontTopY,
        leftFrontDrop,
        topPlaneDepth,
        topPlaneRearY,
        rearOuterLeftX: outerPlane.rearLeft.x,
        rearOuterRightX: outerPlane.rearRight.x,
        frontOuterLeftX: outerPlane.frontLeft.x,
        frontOuterRightX: outerPlane.frontRight.x,
        frontBottomLeftX: frontOuterLeftX,
        frontBottomRightX: width,
        frontBottomY: height,
        frontRimDepth,
        frontRimInnerY: opening[3].y,
        openingRearY: opening[0].y,
        openingRearLeftX: opening[0].x,
        openingRearRightX: opening[1].x,
        openingFrontLeftX: opening[3].x,
        openingFrontRightX: opening[2].x,
        soilRearY: soil[0].y,
        soilRearLeftX: soil[0].x,
        soilRearRightX: soil[1].x,
        soilFrontY: soil[3].y,
        soilFrontLeftX: soil[3].x,
        soilFrontRightX: soil[2].x,
        plantingAnchor,
        polygons: Object.freeze({
            outerTop,
            opening,
            soil,
            frontRim,
            frontFace,
        }),
    });
}

// The background and soil retain sceneViewport. Only Plume's transparent tree
// layer can use the extra left paint space; its right/top limits remain fixed.
export function resolveZenHomeGardenBedCanopyViewport(geometry) {
    const { sceneViewport, bedInsetLeft } = geometry;
    // Frame-seam support includes a physical left footing outside the old tree
    // slot, even when its wide transparent canopy extension has been removed.
    // Keep that complete shared planting seam in the camera's coordinate space.
    return geometry.support === 'frame-seam' || bedInsetLeft > 0
        ? Object.freeze({ x: 0, y: sceneViewport.y, width: sceneViewport.x + sceneViewport.width, height: sceneViewport.height })
        : sceneViewport;
}
