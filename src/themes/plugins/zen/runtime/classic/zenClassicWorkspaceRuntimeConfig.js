import {
    ZEN_BONSAI_CADENCE_CONTEXTS,
    resolveZenBonsaiCadenceProfile,
} from '../zenBonsaiCadenceProfile.js';
import {
    ZEN_BONSAI_MODEL_IDS,
    ZEN_BONSAI_MODEL_SURFACES,
    resolveZenBonsaiModelForSurface,
} from '../../model/ZenBonsaiModelCatalog.js';
import {
    ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE,
} from '../../model/ZenPotStyleIds.js';
import {
    ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
} from '../../model/bonsai/rendering/zenHomeGardenBedProjectionContract.js';
import {
    ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES,
} from './zenBonsaiClassic2LineageRuntimeMode.js';
import {
    ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP,
} from '../zenMainWorkerRenderBudget.js';

const DEFAULT_BONSAI_PIXEL_RATIO_CAP = 2;
const HOME_BONSAI_GROWTH_MODEL = ZEN_BONSAI_MODEL_IDS.PLUME;
const BONSAI_RENDER_LOOP_MODES = Object.freeze({
    CONTINUOUS: 'continuous',
    DIRTY: 'dirty',
});
const BONSAI_RENDER_BACKENDS = Object.freeze({
    CANVAS_2D: 'canvas2d',
    PIXI: 'pixi',
    PIXI_G15: 'pixi_g15',
    PIXI_PLUME: 'pixi_plume',
});
const MIN_MEASURED_RENDER_EXTENT = 2;

const resolvePositiveDimension = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

export function resolveZenClassicWorkspaceLayoutClassName({
    experimental = false,
    isCollectionMode = false,
} = {}) {
    if (!experimental) {
        return 'flex-1 min-h-0 min-w-0 flex flex-col';
    }
    if (isCollectionMode) {
        return 'flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden';
    }
    return 'flex-1 min-h-0 min-w-0 flex flex-col gap-1.5 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_252px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden';
}

export function resolveZenClassicLabInspectorVisible({
    experimental = false,
    isCollectionMode = false,
    hasGrowthControls = false,
    showAdvancedControls = false,
} = {}) {
    return Boolean(
        experimental
        && !isCollectionMode
        && (hasGrowthControls || showAdvancedControls),
    );
}

export function resolveZenClassicRenderSurfaceMeasurement({
    viewportWidth = 0,
    viewportHeight = 0,
    containerWidth = 0,
    containerHeight = 0,
} = {}) {
    const resolvedViewportWidth = resolvePositiveDimension(viewportWidth);
    const resolvedViewportHeight = resolvePositiveDimension(viewportHeight);
    const resolvedContainerWidth = resolvePositiveDimension(containerWidth);
    const resolvedContainerHeight = resolvePositiveDimension(containerHeight);
    const measuredWidth = resolvedViewportWidth > 0 ? resolvedViewportWidth : resolvedContainerWidth;
    const measuredHeight = resolvedViewportHeight > 0 ? resolvedViewportHeight : resolvedContainerHeight;
    const isMeasured = (
        measuredWidth >= MIN_MEASURED_RENDER_EXTENT
        && measuredHeight >= MIN_MEASURED_RENDER_EXTENT
    );

    return {
        renderWidth: isMeasured ? measuredWidth : 1,
        renderHeight: isMeasured ? measuredHeight : 1,
        isMeasured,
    };
}

export function resolveZenClassicExperimentGardenBedLayoutFrame({
    width = 0,
    height = 0,
} = {}) {
    const surfaceWidth = resolvePositiveDimension(width);
    const surfaceHeight = resolvePositiveDimension(height);
    if (
        surfaceWidth < MIN_MEASURED_RENDER_EXTENT
        || surfaceHeight < MIN_MEASURED_RENDER_EXTENT
    ) {
        return null;
    }
    return Object.freeze({
        coordinateSpace: ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
        layoutMode: 'lab-preview',
        boundaryOvershootCssPx: 0,
        leftIntrusionCssPx: 0,
        support: 'planter',
        bedInsetLeftCssPx: 0,
        surfaceSize: Object.freeze({
            width: surfaceWidth,
            height: surfaceHeight,
        }),
        sceneViewport: Object.freeze({
            x: 0,
            y: 0,
            width: surfaceWidth,
            height: surfaceHeight,
        }),
    });
}

export function resolveZenClassicMainRenderQuality({
    experimental = false,
    isCollectionMode = false,
} = {}) {
    return experimental && !isCollectionMode ? 'preview' : 'full';
}

export function resolveZenClassicHomeBonsaiGrowthModel() {
    return resolveZenBonsaiModelForSurface({
        surface: ZEN_BONSAI_MODEL_SURFACES.HOME,
        requestedModel: HOME_BONSAI_GROWTH_MODEL,
    });
}

export function resolveZenClassicHomeBonsaiLineageMode({
    ephemeralPresentationScene = false,
} = {}) {
    return ephemeralPresentationScene
        ? ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
        : ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.DURABLE_MAIN;
}

export function resolveZenClassicExperimentBonsaiLineageMode() {
    return ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW;
}

export function resolveZenClassicExperimentBonsaiGrowthModel({
    requestedModel,
    allowExperimentSurface = false,
} = {}) {
    if (allowExperimentSurface !== true) {
        throw new Error('ZEN_BONSAI_EXPERIMENT_SURFACE_REQUIRED');
    }
    return resolveZenBonsaiModelForSurface({
        surface: ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
        requestedModel,
    });
}

export function resolveZenClassicBonsaiCadenceContext({
    embedded = false,
    homeEmbedded = false,
} = {}) {
    if (homeEmbedded) {
        return ZEN_BONSAI_CADENCE_CONTEXTS.HOME_EMBEDDED;
    }
    if (embedded) {
        return ZEN_BONSAI_CADENCE_CONTEXTS.EMBEDDED;
    }
    return ZEN_BONSAI_CADENCE_CONTEXTS.WORKSPACE;
}

export function resolveZenClassicCameraPreset({
    experimental = false,
    embedded = false,
    homeEmbedded = false,
    frameVariant = 'card',
    gardenBedPreview = false,
} = {}) {
    if (gardenBedPreview) {
        return 'home-frame-garden-bed';
    }
    if (experimental) {
        return 'workspace';
    }
    if (homeEmbedded) {
        return frameVariant === 'slab-aperture'
            ? 'home-frame-garden-bed'
            : 'home-embedded';
    }
    if (embedded) {
        return 'embedded';
    }
    return 'workspace';
}

export function resolveZenClassicHomePotStyle({
    homeEmbedded = false,
    frameVariant = 'card',
} = {}) {
    return homeEmbedded && frameVariant === 'slab-aperture'
        ? ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE
        : null;
}

export function resolveZenClassicBonsaiTargetFps({
    embedded = false,
    homeEmbedded = false,
    defaultTargetFps = 60,
} = {}) {
    const resolvedTargetFps = Number(defaultTargetFps);
    const safeTargetFps = Number.isFinite(resolvedTargetFps) && resolvedTargetFps > 0
        ? resolvedTargetFps
        : 60;
    const cadenceProfile = resolveZenBonsaiCadenceProfile({
        cadenceContext: resolveZenClassicBonsaiCadenceContext({
            embedded,
            homeEmbedded,
        }),
    });
    return Math.min(cadenceProfile.targetFps, safeTargetFps);
}

export function resolveZenClassicBonsaiPixelRatioCap({
    homeEmbedded = false,
} = {}) {
    return homeEmbedded
        ? ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP
        : DEFAULT_BONSAI_PIXEL_RATIO_CAP;
}

export function resolveZenClassicBonsaiRenderLoopMode() {
    return BONSAI_RENDER_LOOP_MODES.CONTINUOUS;
}

export function resolveZenClassicBonsaiRenderBackend({
    homeEmbedded = false,
    modelId = null,
} = {}) {
    if (modelId === ZEN_BONSAI_MODEL_IDS.PLUME) {
        return BONSAI_RENDER_BACKENDS.PIXI_PLUME;
    }
    if (modelId === ZEN_BONSAI_MODEL_IDS.G15_4) {
        // G15.4 has its own Pixi backend: same plan, same command stream, same
        // brush — baked once into sprites so a frame is a few limb rotations
        // rather than a full repaint of every ribbon.
        return BONSAI_RENDER_BACKENDS.PIXI_G15;
    }
    return homeEmbedded
        ? BONSAI_RENDER_BACKENDS.PIXI
        : BONSAI_RENDER_BACKENDS.CANVAS_2D;
}
