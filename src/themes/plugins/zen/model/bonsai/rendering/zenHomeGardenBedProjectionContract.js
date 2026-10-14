export const ZEN_HOME_GARDEN_BED_LAYOUT_SPACE = 'css-pixel';
export const ZEN_HOME_GARDEN_BED_RENDER_SPACE = 'device-pixel';
export const ZEN_HOME_GARDEN_BED_BOUNDARY_OVERSHOOT_CSS_PX = 1;
export const ZEN_HOME_GARDEN_BED_LEFT_INTRUSION_CSS_PX = 28;
// Browser grid fractions and independently serialized decimal extents may
// differ by a few floating-point ULPs at a shared edge, not by a visible pixel.
const COORDINATE_EPSILON = 0.000001;

const requireObject = (value, prefix, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_${field}_REQUIRED`);
    }
    return value;
};

const requireExtent = (value, prefix, field, { allowZero = false } = {}) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || (allowZero ? numeric < 0 : numeric <= 0)) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_${field}_INVALID`);
    }
    return numeric;
};

const normalizeRearPaperEdge = (contract, prefix) => {
    if (contract.support === 'planter') return null;
    const edge = requireObject(contract.rearPaperEdge, prefix, 'REAR_PAPER_EDGE');
    if (![edge.topX, edge.bottomX].every(Number.isFinite)) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_REAR_PAPER_EDGE_INVALID`);
    }
    return Object.freeze({ topX: edge.topX, bottomX: edge.bottomX });
};

const normalizeSurfaceContract = (source, {
    prefix,
    coordinateSpace,
    boundaryField,
    intrusionField,
    insetField,
} = {}) => {
    const contract = requireObject(source, prefix, 'CONTRACT');
    if (!['planter', 'frame-seam'].includes(contract.support)) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_SUPPORT_INVALID`);
    }
    if (contract.coordinateSpace !== coordinateSpace) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_SPACE_INVALID`);
    }
    const surfaceSize = requireObject(contract.surfaceSize, prefix, 'SURFACE_SIZE');
    const sceneViewport = requireObject(contract.sceneViewport, prefix, 'SCENE_VIEWPORT');
    const surfaceWidth = requireExtent(surfaceSize.width, prefix, 'SURFACE_WIDTH');
    const surfaceHeight = requireExtent(surfaceSize.height, prefix, 'SURFACE_HEIGHT');
    const sceneX = requireExtent(sceneViewport.x, prefix, 'SCENE_X', { allowZero: true });
    const sceneY = requireExtent(sceneViewport.y, prefix, 'SCENE_Y', { allowZero: true });
    const sceneWidth = requireExtent(sceneViewport.width, prefix, 'SCENE_WIDTH');
    const sceneHeight = requireExtent(sceneViewport.height, prefix, 'SCENE_HEIGHT');
    const boundaryOvershoot = requireExtent(
        contract[boundaryField],
        prefix,
        boundaryField.replace(/([A-Z])/gu, '_$1').toUpperCase(),
        { allowZero: true },
    );
    const leftIntrusion = requireExtent(
        contract[intrusionField],
        prefix,
        intrusionField.replace(/([A-Z])/gu, '_$1').toUpperCase(),
        { allowZero: true },
    );
    const bedInsetLeft = requireExtent(contract[insetField], prefix, insetField, { allowZero: true });

    if (sceneX + sceneWidth - surfaceWidth > COORDINATE_EPSILON
        || sceneY + sceneHeight - surfaceHeight > COORDINATE_EPSILON) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_SCENE_EXCEEDS_SURFACE`);
    }
    if (
        bedInsetLeft + boundaryOvershoot + leftIntrusion - sceneX > COORDINATE_EPSILON
        || boundaryOvershoot - (surfaceWidth - sceneX - sceneWidth) > COORDINATE_EPSILON
    ) {
        throw new Error(`ZEN_HOME_GARDEN_BED_${prefix}_OVERSHOOT_EXCEEDS_FRAME`);
    }

    return {
        contract,
        boundaryOvershoot,
        leftIntrusion,
        bedInsetLeft,
        surfaceWidth,
        surfaceHeight,
        sceneX,
        sceneY,
        sceneWidth,
        sceneHeight,
    };
};

export function normalizeZenHomeGardenBedLayoutFrame(layoutFrame = null) {
    const normalized = normalizeSurfaceContract(layoutFrame, {
        prefix: 'LAYOUT',
        coordinateSpace: ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
        boundaryField: 'boundaryOvershootCssPx',
        intrusionField: 'leftIntrusionCssPx',
        insetField: 'bedInsetLeftCssPx',
    });
    if (typeof normalized.contract.layoutMode !== 'string' || !normalized.contract.layoutMode) {
        throw new Error('ZEN_HOME_GARDEN_BED_LAYOUT_MODE_REQUIRED');
    }
    return Object.freeze({
        coordinateSpace: ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
        layoutMode: normalized.contract.layoutMode,
        support: normalized.contract.support,
        rearPaperEdge: normalizeRearPaperEdge(normalized.contract, 'LAYOUT'),
        boundaryOvershootCssPx: normalized.boundaryOvershoot,
        leftIntrusionCssPx: normalized.leftIntrusion,
        bedInsetLeftCssPx: normalized.bedInsetLeft,
        surfaceSize: Object.freeze({
            width: normalized.surfaceWidth,
            height: normalized.surfaceHeight,
        }),
        sceneViewport: Object.freeze({
            x: normalized.sceneX,
            y: normalized.sceneY,
            width: normalized.sceneWidth,
            height: normalized.sceneHeight,
        }),
    });
}

export function normalizeZenHomeGardenBedProjection(projection = null) {
    const normalized = normalizeSurfaceContract(projection, {
        prefix: 'PROJECTION',
        coordinateSpace: ZEN_HOME_GARDEN_BED_RENDER_SPACE,
        boundaryField: 'boundaryOvershootDevicePx',
        intrusionField: 'leftIntrusionDevicePx',
        insetField: 'bedInsetLeftDevicePx',
    });
    return Object.freeze({
        coordinateSpace: ZEN_HOME_GARDEN_BED_RENDER_SPACE,
        support: normalized.contract.support,
        rearPaperEdge: normalizeRearPaperEdge(normalized.contract, 'PROJECTION'),
        boundaryOvershootDevicePx: normalized.boundaryOvershoot,
        leftIntrusionDevicePx: normalized.leftIntrusion,
        bedInsetLeftDevicePx: normalized.bedInsetLeft,
        surfaceSize: Object.freeze({
            width: normalized.surfaceWidth,
            height: normalized.surfaceHeight,
        }),
        sceneViewport: Object.freeze({
            x: normalized.sceneX,
            y: normalized.sceneY,
            width: normalized.sceneWidth,
            height: normalized.sceneHeight,
        }),
    });
}
