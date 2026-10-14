import {
    buildG15Scene,
} from './ZenBonsaiG15Scene.js';

export const ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT = 'zen-bonsai-g15-render-plan-v1';
export const ZEN_BONSAI_G15_RENDER_PLAN_VERSION = 1;
export const ZEN_BONSAI_G15_CAMERA_FIT_MODES = Object.freeze({
    CONTAIN: 'contain',
    ROOTED_ABOVE_GROUND: 'rooted_above_ground',
});
export const ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES = Object.freeze({
    STRUCTURAL_MASS: 'structural_mass',
});

const ZEN_BONSAI_G15_CAMERA_FIT_MODE_VALUES = new Set(
    Object.values(ZEN_BONSAI_G15_CAMERA_FIT_MODES),
);
const ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODE_VALUES = new Set(
    Object.values(ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES),
);

const validatedPlans = new WeakSet();

const isObject = (value) => Boolean(
    value && typeof value === 'object' && !Array.isArray(value),
);

const deepFreeze = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) {
        return value;
    }
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => {
        deepFreeze(value[key], seen);
    });
    return Object.freeze(value);
};

const requirePositiveInteger = (value, field) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) {
        throw new Error(`ZEN_BONSAI_G15_RENDER_PLAN_${field}_INVALID`);
    }
    return number;
};

const requireNonNegativeInteger = (value, field) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) {
        throw new Error(`ZEN_BONSAI_G15_RENDER_PLAN_${field}_INVALID`);
    }
    return number;
};

const requireFiniteNumber = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new Error(`ZEN_BONSAI_G15_RENDER_PLAN_${field}_INVALID`);
    }
    return number;
};

const requireNonNegativeNumber = (value, field) => {
    const number = requireFiniteNumber(value, field);
    if (number < 0) {
        throw new Error(`ZEN_BONSAI_G15_RENDER_PLAN_${field}_INVALID`);
    }
    return number;
};

const requirePositiveNumber = (value, field) => {
    const number = requireFiniteNumber(value, field);
    if (!(number > 0)) {
        throw new Error(`ZEN_BONSAI_G15_RENDER_PLAN_${field}_INVALID`);
    }
    return number;
};

const requireCameraFitMode = (value) => {
    const fitMode = value ?? ZEN_BONSAI_G15_CAMERA_FIT_MODES.CONTAIN;
    if (!ZEN_BONSAI_G15_CAMERA_FIT_MODE_VALUES.has(fitMode)) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_CAMERA_FIT_MODE_INVALID');
    }
    return fitMode;
};

const freezeHorizontalComposition = (value) => {
    if (value === null || value === undefined) return null;
    const mode = value?.mode;
    if (!ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODE_VALUES.has(mode)) {
        throw new Error(
            'ZEN_BONSAI_G15_RENDER_PLAN_HORIZONTAL_COMPOSITION_MODE_INVALID',
        );
    }
    return Object.freeze({
        mode,
        targetViewportX: requireFiniteNumber(
            value?.targetViewportX,
            'HORIZONTAL_COMPOSITION_TARGET_X',
        ),
        maximumRootShiftPx: requireNonNegativeNumber(
            value?.maximumRootShiftPx,
            'HORIZONTAL_COMPOSITION_MAXIMUM_ROOT_SHIFT',
        ),
    });
};

const hashText = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

const freezeSurface = (surface) => {
    if (!isObject(surface) || !isObject(surface.treeViewport)) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_SURFACE_REQUIRED');
    }
    const pixelWidth = requirePositiveInteger(surface.pixelWidth, 'SURFACE_WIDTH');
    const pixelHeight = requirePositiveInteger(surface.pixelHeight, 'SURFACE_HEIGHT');
    const treeViewport = Object.freeze({
        x: requireNonNegativeInteger(surface.treeViewport.x, 'VIEWPORT_X'),
        y: requireNonNegativeInteger(surface.treeViewport.y, 'VIEWPORT_Y'),
        width: requirePositiveInteger(surface.treeViewport.width, 'VIEWPORT_WIDTH'),
        height: requirePositiveInteger(surface.treeViewport.height, 'VIEWPORT_HEIGHT'),
    });
    if (
        treeViewport.x + treeViewport.width > pixelWidth
        || treeViewport.y + treeViewport.height > pixelHeight
    ) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_VIEWPORT_EXCEEDS_SURFACE');
    }
    return Object.freeze({
        pixelWidth,
        pixelHeight,
        treeViewport,
        clipTreePaint: surface.clipTreePaint === true,
    });
};

/**
 * The planting-surface owner describes the ground the nebari lays roots on, in
 * the same scene-local pixels as the command stream. Home passes the garden
 * bed's soil plane; a scene with only the built-in pot passes nothing and the
 * scene builder derives the plane from that pot.
 */
const freezeGroundPlane = (value) => {
    if (value === null || value === undefined) return null;
    if (!isObject(value) || !isObject(value.center)) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_GROUND_PLANE_INVALID');
    }
    return Object.freeze({
        center: Object.freeze({
            x: requireFiniteNumber(value.center.x, 'GROUND_PLANE_CENTER_X'),
            y: requireFiniteNumber(value.center.y, 'GROUND_PLANE_CENTER_Y'),
        }),
        halfWidth: requirePositiveNumber(value.halfWidth, 'GROUND_PLANE_HALF_WIDTH'),
        frontDepth: requirePositiveNumber(value.frontDepth, 'GROUND_PLANE_FRONT_DEPTH'),
        rearDepth: requirePositiveNumber(value.rearDepth, 'GROUND_PLANE_REAR_DEPTH'),
        drawSoil: value.drawSoil === true,
    });
};

const freezeSceneOptions = ({
    includeBackground = false,
    includePot = true,
    cameraAnchor = null,
    groundPlane = null,
} = {}) => Object.freeze({
    includeBackground: includeBackground === true,
    includePot: includePot === true,
    groundPlane: freezeGroundPlane(groundPlane),
    cameraAnchor: cameraAnchor === null
        ? null
        : Object.freeze({
            fitMode: requireCameraFitMode(cameraAnchor?.fitMode),
            horizontalComposition: freezeHorizontalComposition(
                cameraAnchor?.horizontalComposition,
            ),
            world: Object.freeze({
                x: requireFiniteNumber(cameraAnchor?.world?.x, 'CAMERA_ANCHOR_WORLD_X'),
                y: requireFiniteNumber(cameraAnchor?.world?.y, 'CAMERA_ANCHOR_WORLD_Y'),
                z: requireFiniteNumber(cameraAnchor?.world?.z ?? 0, 'CAMERA_ANCHOR_WORLD_Z'),
            }),
            viewport: Object.freeze({
                x: requireFiniteNumber(cameraAnchor?.viewport?.x, 'CAMERA_ANCHOR_VIEWPORT_X'),
                y: requireFiniteNumber(cameraAnchor?.viewport?.y, 'CAMERA_ANCHOR_VIEWPORT_Y'),
            }),
        }),
});

export const resolveZenBonsaiG15TopologySignature = (topology) => {
    if (
        !isObject(topology)
        || topology.engine !== 'g15_4'
        || topology.isG15 !== true
        || !isObject(topology.graph)
        || !Array.isArray(topology.graph.nodes)
        || !Array.isArray(topology.graph.segments)
        || !Array.isArray(topology.graph.events)
    ) {
        throw new Error('ZEN_BONSAI_G15_TOPOLOGY_REQUIRED');
    }
    const signatureSource = JSON.stringify({
        engine: topology.engine,
        seed: topology.seed,
        phenotype: topology.phenotype,
        graph: topology.graph,
        sceneConfig: topology.sceneConfig,
    });
    if (typeof signatureSource !== 'string' || !signatureSource) {
        throw new Error('ZEN_BONSAI_G15_TOPOLOGY_SIGNATURE_SOURCE_INVALID');
    }
    return `g15_4:${hashText(signatureSource)}`;
};

const createPlanSignature = ({
    topologySignature,
    surface,
    sceneOptions,
    sceneSignature,
}) => `g15-plan:${hashText(JSON.stringify({
    topologySignature,
    surface,
    sceneOptions,
    sceneSignature,
}))}`;

export const createZenBonsaiG15RenderPlanV1 = ({
    topology,
    sourceTopologySignature = null,
    surface,
    includePot = true,
    includeBackground = false,
    cameraAnchor = null,
    groundPlane = null,
} = {}) => {
    const topologySignature = resolveZenBonsaiG15TopologySignature(topology);
    if (
        sourceTopologySignature !== null
        && sourceTopologySignature !== topologySignature
    ) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_TOPOLOGY_SIGNATURE_MISMATCH');
    }
    const resolvedSurface = freezeSurface(surface);
    const sceneOptions = freezeSceneOptions({
        includeBackground,
        includePot,
        cameraAnchor,
        groundPlane,
    });
    const scene = buildG15Scene({
        g15Topology: topology,
        width: resolvedSurface.pixelWidth,
        height: resolvedSurface.pixelHeight,
        options: sceneOptions,
    });
    if (
        !isObject(scene)
        || typeof scene.signature !== 'string'
        || !scene.signature
        || !Array.isArray(scene.commands)
        || scene.width !== resolvedSurface.pixelWidth
        || scene.height !== resolvedSurface.pixelHeight
    ) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_SCENE_INVALID');
    }
    const signature = createPlanSignature({
        topologySignature,
        surface: resolvedSurface,
        sceneOptions,
        sceneSignature: scene.signature,
    });
    const plan = deepFreeze({
        contract: ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT,
        version: ZEN_BONSAI_G15_RENDER_PLAN_VERSION,
        coordinateSpace: 'canvas-device',
        source: Object.freeze({
            topologySignature,
            sceneSignature: scene.signature,
        }),
        surface: resolvedSurface,
        options: sceneOptions,
        scene,
        bounds: Object.freeze({
            contract: 'zen-bonsai-g15-render-bounds-v1',
            source: 'g15-scene-command-viewport',
            minX: 0,
            minY: 0,
            maxX: resolvedSurface.pixelWidth,
            maxY: resolvedSurface.pixelHeight,
            width: resolvedSurface.pixelWidth,
            height: resolvedSurface.pixelHeight,
        }),
        bakeSignature: `g15-bake:${scene.signature}`,
        signature,
    });
    validatedPlans.add(plan);
    return plan;
};

export const requireZenBonsaiG15RenderPlanV1 = (plan, {
    topology,
} = {}) => {
    if (isObject(plan) && validatedPlans.has(plan)) {
        return plan;
    }
    if (
        !isObject(plan)
        || plan.contract !== ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT
        || plan.version !== ZEN_BONSAI_G15_RENDER_PLAN_VERSION
        || plan.coordinateSpace !== 'canvas-device'
        || !isObject(plan.source)
        || typeof plan.source.topologySignature !== 'string'
        || !plan.source.topologySignature
        || !isObject(plan.options)
    ) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_INVALID');
    }
    if (!topology) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_TOPOLOGY_REQUIRED');
    }
    const rebuilt = createZenBonsaiG15RenderPlanV1({
        topology,
        sourceTopologySignature: plan.source.topologySignature,
        surface: plan.surface,
        includePot: plan.options.includePot,
        includeBackground: plan.options.includeBackground,
        cameraAnchor: plan.options.cameraAnchor,
        groundPlane: plan.options.groundPlane,
    });
    if (
        plan.signature !== rebuilt.signature
        || plan.bakeSignature !== rebuilt.bakeSignature
        || plan.source.sceneSignature !== rebuilt.source.sceneSignature
        || JSON.stringify(plan) !== JSON.stringify(rebuilt)
    ) {
        throw new Error('ZEN_BONSAI_G15_RENDER_PLAN_SIGNATURE_MISMATCH');
    }
    return rebuilt;
};

export default createZenBonsaiG15RenderPlanV1;
