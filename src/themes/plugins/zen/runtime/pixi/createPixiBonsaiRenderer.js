import {
    Application,
    BaseTexture,
    Container,
    Geometry,
    Graphics,
    Mesh,
    MIPMAP_MODES,
    SCALE_MODES,
    Shader,
    Sprite,
    Texture,
} from '@/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js';

import {
    createAssetCache,
    resolveRenderSpecies,
} from '../../model/ZenCoreConfigAssetCache.js';
import {
    SAKURA_CONFIG,
} from '../../model/sakura/sakuraSpeciesRuntimeContract.js';
import { BranchGeometryModel } from '../../model/bonsai/geometry/branchGeometryModel.js';
import {
    SAKURA_BRANCH_ORDER,
} from '../../model/bonsai/generation/shapePriorModel.js';
import {
    SAKURA_RENDER_LAYERS,
} from '../../model/sakura/sakuraRenderer.js';
import {
    createSakuraBranchLayerRenderer,
    SAKURA_BRANCH_DETAIL_PROFILES,
    SAKURA_TREE_CONTENT_LAYERS,
} from '../../model/sakura/sakuraRenderBranchLayer.js';
import {
    resolveSakuraEffectiveBranchWindState,
} from '../../model/sakura/sakuraBranchMotionModel.js';
import { resolveSakuraRenderLighting } from '../../model/sakura/sakuraRenderLighting.js';
import {
    requireSakuraRenderPlanV1,
    resolveSakuraRenderPlanAttachmentV1,
    resolveSakuraRenderPlanRecordPoseV1,
    SAKURA_RENDER_PLAN_MOTION_MODE,
} from '../../model/sakura/sakuraRenderPlan.js';
import {
    resolveSakuraLifeAppearanceProfile,
} from '../../model/sakura/sakuraLifeMood.js';
import {
    resolveZenBonsaiActivationBakePresentation,
} from '../../model/bonsai/presentation/ZenBonsaiActivationPresentation.js';
import {
    ZEN_HOME_GARDEN_BED_RENDER_SPACE,
} from '../../model/bonsai/rendering/zenHomeGardenBedProjectionContract.js';
import {
    ZEN_BONSAI_WORKER_RENDER_BACKENDS,
    resolveZenBonsaiWorkerRendererLabel,
} from '../worker/zenBonsaiWorkerProtocol.js';
import {
    queuePixiTextureDisposal,
} from '../../shared/pixiDeferredTextureDisposal.js';
import {
    registerPixiBonsaiBranchRecord,
} from './pixiBonsaiBranchRigIdentity.js';
import {
    collectPixiBonsaiRenderPlanChildren,
    resolvePixiBonsaiRenderPlanSubtreeSummary,
    summarizePixiBonsaiBranchWidthProfile,
    shouldBakePixiBonsaiRenderPlanSubtree,
} from './pixiBonsaiBranchRigMotionPolicy.js';
import {
    applyPixiBonsaiBranchRigPresentation,
    applyPixiBonsaiBranchSpriteTransform,
    applyPixiBonsaiSpritePresentation,
    resetPixiBonsaiBranchRigPresentationCache,
    resetPixiBonsaiSpriteTransform,
} from './pixiBonsaiDisplayObjectState.js';
import { observeSakuraPixiActualAlphaV1 } from './sakuraPixiActualAlphaObserver.js';
import { createZenRainPixiMesh } from '../rain/createZenRainPixiMesh.js';
import { resolveZenBonsaiRainInputs, resolveZenBonsaiRainPresentation } from '../rain/zenRainStreakRuntime.js';
import { resolveZenHomeGardenBedDeviceMesh } from '../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import { hashStringFNV1a } from '../../shared/zenSeededRandom.js';

const RENDERER_NAME = resolveZenBonsaiWorkerRendererLabel(
    ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI,
);

const TEXTURE_SAMPLE_OPTIONS = Object.freeze({
    scaleMode: SCALE_MODES.LINEAR,
    mipmap: MIPMAP_MODES.OFF,
    anisotropicLevel: 0,
    resolution: 1,
});

const PIXI_BONSAI_LAYER_IDS = Object.freeze({
    BACK: 'back',
    FRONT: 'front',
});

const PIXI_BONSAI_LAYER_ORDER = Object.freeze([
    PIXI_BONSAI_LAYER_IDS.BACK,
    PIXI_BONSAI_LAYER_IDS.FRONT,
]);

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.min(max, Math.max(min, toNumber(value, min)));
const clamp01 = (value) => clamp(value, 0, 1);
const clampPixelExtent = (value) => Math.max(1, Math.round(toNumber(value, 1)));

export const resolvePixiBonsaiSceneViewportOffset = (scene = null) => {
    const projection = scene?.renderOptions?.homeGardenBedProjection || null;
    if (projection === null) {
        return Object.freeze({ x: 0, y: 0 });
    }
    if (projection.coordinateSpace !== ZEN_HOME_GARDEN_BED_RENDER_SPACE) {
        throw new Error('ZEN_BONSAI_PIXI_SCENE_VIEWPORT_SPACE_INVALID');
    }
    const x = Number(projection?.sceneViewport?.x);
    const y = Number(projection?.sceneViewport?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
        throw new Error('ZEN_BONSAI_PIXI_SCENE_VIEWPORT_OFFSET_INVALID');
    }
    return Object.freeze({ x, y });
};

export const resolvePixiBonsaiSceneViewportClip = (scene = null) => {
    const projection = scene?.renderOptions?.homeGardenBedProjection || null;
    if (projection === null) {
        return null;
    }
    if (projection.coordinateSpace !== ZEN_HOME_GARDEN_BED_RENDER_SPACE) {
        throw new Error('ZEN_BONSAI_PIXI_SCENE_VIEWPORT_SPACE_INVALID');
    }
    const x = Number(projection?.sceneViewport?.x);
    const y = Number(projection?.sceneViewport?.y);
    const width = Number(projection?.sceneViewport?.width);
    const height = Number(projection?.sceneViewport?.height);
    if (
        !Number.isFinite(x)
        || !Number.isFinite(y)
        || !Number.isFinite(width)
        || !Number.isFinite(height)
        || x < 0
        || y < 0
        || width <= 0
        || height <= 0
    ) {
        throw new Error('ZEN_BONSAI_PIXI_SCENE_VIEWPORT_CLIP_INVALID');
    }
    return Object.freeze({ x, y, width, height });
};

const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);
const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};
const roundRatio = (value, digits = 3) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Number(numeric.toFixed(digits));
};
const WHITE_TINT = 0xffffff;
// The mask owns its geometry. Weak keys let disposed renderers release it.
const viewportClipByMask = new WeakMap();

export const applyPixiBonsaiSceneViewportClip = ({
    branchRigRoot,
    branchRigMask,
    scene = null,
} = {}) => {
    if (!branchRigRoot || !branchRigMask) {
        throw new Error('ZEN_BONSAI_PIXI_SCENE_VIEWPORT_MASK_TARGET_MISSING');
    }
    const sceneViewportClip = resolvePixiBonsaiSceneViewportClip(scene);
    const previous = viewportClipByMask.get(branchRigMask);
    if (previous
        && previous.root === branchRigRoot
        && branchRigRoot.mask === (sceneViewportClip ? branchRigMask : null)
        && previous.clip?.x === sceneViewportClip?.x
        && previous.clip?.y === sceneViewportClip?.y
        && previous.clip?.width === sceneViewportClip?.width
        && previous.clip?.height === sceneViewportClip?.height) {
        return previous.clip;
    }
    branchRigMask.clear();
    branchRigRoot.mask = null;
    if (sceneViewportClip) {
        branchRigMask
            .beginFill(WHITE_TINT, 1)
            .drawRect(
                sceneViewportClip.x,
                sceneViewportClip.y,
                sceneViewportClip.width,
                sceneViewportClip.height,
            )
            .endFill();
        branchRigRoot.mask = branchRigMask;
    }
    viewportClipByMask.set(branchRigMask, { root: branchRigRoot, clip: sceneViewportClip });
    return sceneViewportClip;
};

const BRANCH_ORDER_LABELS = Object.freeze({
    [SAKURA_BRANCH_ORDER.TRUNK]: 'trunk',
    [SAKURA_BRANCH_ORDER.PRIMARY_BRANCH]: 'primary',
    [SAKURA_BRANCH_ORDER.SECONDARY_BRANCH]: 'secondary',
    [SAKURA_BRANCH_ORDER.TERMINAL_TWIG]: 'twig',
});

const resolveBranchOrderLabel = (branchOrder) => {
    const order = Number.isFinite(Number(branchOrder))
        ? Number(branchOrder)
        : SAKURA_BRANCH_ORDER.TRUNK;
    return BRANCH_ORDER_LABELS[order] || `order_${order}`;
};
const parseColorChannels = (value) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
        return null;
    }
    if (raw.startsWith('#')) {
        const hex = raw.slice(1);
        if (hex.length === 3) {
            return [
                Number.parseInt(`${hex[0]}${hex[0]}`, 16),
                Number.parseInt(`${hex[1]}${hex[1]}`, 16),
                Number.parseInt(`${hex[2]}${hex[2]}`, 16),
            ];
        }
        if (hex.length === 6) {
            return [
                Number.parseInt(hex.slice(0, 2), 16),
                Number.parseInt(hex.slice(2, 4), 16),
                Number.parseInt(hex.slice(4, 6), 16),
            ];
        }
    }
    const channels = raw.match(/[\d.]+/g);
    if (channels && channels.length >= 3) {
        return channels.slice(0, 3).map((channel) => clamp(Number(channel) || 0, 0, 255));
    }
    return null;
};

const colorToInt = (channels = null) => {
    if (!Array.isArray(channels) || channels.length < 3) {
        return WHITE_TINT;
    }
    const [r, g, b] = channels.map((channel) => clamp(Math.round(channel), 0, 255));
    return (r << 16) + (g << 8) + b;
};

const intToChannels = (color) => {
    const value = Math.max(0, Math.min(WHITE_TINT, Math.round(Number(color) || WHITE_TINT)));
    return [
        (value >> 16) & 255,
        (value >> 8) & 255,
        value & 255,
    ];
};

const mixColor = (fromColor, toColor, amount = 0) => {
    const t = clamp01(amount);
    const from = intToChannels(fromColor);
    const to = intToChannels(toColor);
    return colorToInt(from.map((channel, index) => channel + ((to[index] - channel) * t)));
};

const lerp = (from, to, amount = 0) => from + ((to - from) * clamp01(amount));

const createPresentationState = () => ({
    initialized: false,
    backTint: WHITE_TINT,
    frontTint: WHITE_TINT,
    branchTint: WHITE_TINT,
    terminalTint: WHITE_TINT,
    backAlpha: 1,
    frontAlpha: 1,
    branchAlpha: 1,
});

export const resolvePixiBonsaiRuntimePresentation = (scene = {}) => {
    const environmentState = scene?.renderOptions?.environmentState || scene?.environmentState || {};
    const lifeState = scene?.renderOptions?.lifeState || {};
    const activationPresentation = scene?.renderOptions?.activationPresentation || null;
    const lightTint = colorToInt(parseColorChannels(environmentState?.lightColor));
    const daylight = clamp01(environmentState?.daylight ?? 0.78);
    const night = clamp01(environmentState?.night ?? (1 - daylight));
    const cloudCover = clamp01(environmentState?.cloudCover ?? 0);
    const overcastWeight = clamp01(environmentState?.overcastWeight ?? 0);
    const rainIntensity = clamp01(environmentState?.rainIntensity ?? 0);
    const postRainWeight = clamp01(environmentState?.postRainWeight ?? 0);
    const lightIntensity = clamp(Number(environmentState?.lightIntensity) || 0.92, 0.04, 1.6);
    const lifeAppearance = resolveSakuraLifeAppearanceProfile(lifeState, {
        activationPresentation,
    });
    const lightDeficit = clamp01((0.94 - lightIntensity) / 0.72);
    const weatherShade = clamp01(
        (cloudCover * 0.5)
        + (overcastWeight * 0.28)
        + (rainIntensity * 0.08)
        + (lightDeficit * 0.18)
        - (postRainWeight * 0.06),
    );
    const weatherLightTint = mixColor(
        lightTint,
        0x9eafb3,
        weatherShade * 0.4,
    );
    const lightMix = clamp(
        0.04
        + (night * 0.14)
        + ((1 - daylight) * 0.04)
        + (weatherShade * 0.11),
        0.03,
        0.3,
    );
    const backTint = mixColor(WHITE_TINT, weatherLightTint, lightMix * 0.58);
    const frontTint = mixColor(WHITE_TINT, weatherLightTint, lightMix * 0.82);
    const branchLightTint = mixColor(WHITE_TINT, weatherLightTint, lightMix);
    const dryTint = 0xc2a37a;
    const foliageDryTint = 0xf0dfca;
    const branchTint = mixColor(branchLightTint, dryTint, lifeAppearance.runtimeBranchDryTint);
    const terminalTint = lifeAppearance.hasActivationPresentation
        ? mixColor(
            0xd2c3ad,
            WHITE_TINT,
            clamp01(0.18 + (lifeAppearance.activationRatio * 0.82)),
        )
        : WHITE_TINT;

    return {
        backTint: mixColor(backTint, foliageDryTint, lifeAppearance.runtimeFoliageDryTint * 0.42),
        frontTint,
        branchTint,
        terminalTint,
        backAlpha: lifeAppearance.runtimeBackAlpha,
        frontAlpha: 1,
        branchAlpha: lifeAppearance.runtimeBranchAlpha,
    };
};

export const resolvePixiBonsaiRuntimeBranchSag = (scene = {}) => {
    return requireSakuraRenderPlanV1(scene?.renderPlan).presentation.runtime.lifeBranchSag;
};

const stepPresentationState = (presentationState, target) => {
    const amount = presentationState.initialized ? 0.16 : 1;
    presentationState.backTint = mixColor(presentationState.backTint, target.backTint, amount);
    presentationState.frontTint = mixColor(presentationState.frontTint, target.frontTint, amount);
    presentationState.branchTint = mixColor(presentationState.branchTint, target.branchTint, amount);
    presentationState.terminalTint = mixColor(
        presentationState.terminalTint,
        target.terminalTint,
        amount,
    );
    presentationState.backAlpha = lerp(presentationState.backAlpha, target.backAlpha, amount);
    presentationState.frontAlpha = lerp(presentationState.frontAlpha, target.frontAlpha, amount);
    presentationState.branchAlpha = lerp(presentationState.branchAlpha, target.branchAlpha, amount);
    presentationState.initialized = true;
    return presentationState;
};

const createBonsaiBakeCanvas = (width, height) => {
    const resolvedWidth = clampPixelExtent(width);
    const resolvedHeight = clampPixelExtent(height);

    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(resolvedWidth, resolvedHeight);
    }

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = resolvedWidth;
        canvas.height = resolvedHeight;
        return canvas;
    }

    throw new Error('ZEN_BONSAI_PIXI_BAKE_CANVAS_UNAVAILABLE');
};

const createBonsaiBakeAssetCache = () => createAssetCache({
    createCanvas: (width, height) => createBonsaiBakeCanvas(width, height),
});

const createTextureFromBakeCanvas = (canvas) => {
    const baseTexture = new BaseTexture(canvas, TEXTURE_SAMPLE_OPTIONS);
    if (typeof baseTexture.update === 'function') {
        baseTexture.update();
    }
    return new Texture(baseTexture);
};

const destroyTexture = (texture = null) => {
    if (!texture || texture === Texture.EMPTY || typeof texture.destroy !== 'function') {
        return;
    }
    queuePixiTextureDisposal(texture, { destroyBase: true });
};

const configureCanvasQuality = (ctx) => {
    if (!ctx) {
        return;
    }
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = 'high';
    }
};

const resetCanvasContext = (ctx, width, height) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
};

const createLayerState = (id) => ({
    id,
    canvas: null,
    ctx: null,
    texture: null,
    sprite: null,
    width: 0,
    height: 0,
    displayWidth: 0,
    displayHeight: 0,
    resolutionScale: 1,
    signature: '',
});

const createLayerSignature = (scene, sizeState, layerId, resolutionScale = 1) => {
    const signature = scene?.staticLayerSignatures?.[layerId];
    if (typeof signature !== 'string' || !signature) {
        throw new Error(`ZEN_BONSAI_PIXI_STATIC_LAYER_SIGNATURE_MISSING:${layerId}`);
    }
    const scale = Math.max(0.1, Math.min(1, Number(resolutionScale) || 1));
    return [
        layerId,
        signature,
        clampPixelExtent(sizeState?.pixelWidth),
        clampPixelExtent(sizeState?.pixelHeight),
        `scale:${Number(scale.toFixed(3))}`,
    ].join('|');
};

const resolvePixiBonsaiLayerDebug = (layers) => PIXI_BONSAI_LAYER_ORDER.map((id) => ({
    id,
    cached: Boolean(layers[id]?.signature),
    width: layers[id]?.width || 0,
    height: layers[id]?.height || 0,
    displayWidth: layers[id]?.displayWidth || 0,
    displayHeight: layers[id]?.displayHeight || 0,
    resolutionScale: layers[id]?.resolutionScale || 1,
}));

const createPixiBonsaiLayerDisplayObject = (id) => {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0, 0);
    return sprite;
};

const resetSpriteTransform = (sprite = null) => {
    resetPixiBonsaiSpriteTransform(sprite);
};

const resetLayerSpriteTransform = (layer = null) => {
    const sprite = layer?.sprite || null;
    resetSpriteTransform(sprite);
    if (!sprite) {
        return;
    }
    const displayWidth = clampPixelExtent(layer?.displayWidth || layer?.width || 1);
    const displayHeight = clampPixelExtent(layer?.displayHeight || layer?.height || 1);
    sprite.width = displayWidth;
    sprite.height = displayHeight;
};

const createBranchRigDiagnosticBucket = () => ({
    records: 0,
    liveRecords: 0,
    groupedSubtrees: 0,
    canvasPixels: 0,
    maxCanvasPixels: 0,
    bakeMs: 0,
    metricsMs: 0,
    canvasMs: 0,
    drawMs: 0,
    textureMs: 0,
});

const createBranchRigBuildDiagnostics = () => ({
    records: 0,
    liveRecords: 0,
    groupedSubtrees: 0,
    canvasPixels: 0,
    maxCanvasPixels: 0,
    maxCanvasRecord: null,
    bakeMs: 0,
    metricsMs: 0,
    canvasMs: 0,
    drawMs: 0,
    textureMs: 0,
    byDepth: {},
    byOrder: {},
    topByBakeMs: [],
    topByCanvasPixels: [],
});

const createBranchRigRecordDiagnosticSample = (diagnostic = {}) => ({
    depth: diagnostic.depth,
    branchOrder: diagnostic.branchOrder,
    branchOrderLabel: diagnostic.branchOrderLabel,
    branchDetailProfile: diagnostic.branchDetailProfile,
    subtreeBaked: diagnostic.subtreeBaked === true,
    width: diagnostic.width,
    height: diagnostic.height,
    canvasPixels: diagnostic.canvasPixels,
    terminalCount: diagnostic.terminalCount,
    childBranchCount: diagnostic.childBranchCount,
    subtreeBranchCount: diagnostic.subtreeBranchCount,
    subtreeTerminalCount: diagnostic.subtreeTerminalCount,
    subtreeMaxDepth: diagnostic.subtreeMaxDepth,
    bakeMs: roundMs(diagnostic.bakeMs),
});

const updateBranchRigDiagnosticBucket = (bucket, diagnostic = {}) => {
    bucket.records += 1;
    if (diagnostic.subtreeBaked === true) {
        bucket.groupedSubtrees += 1;
    } else {
        bucket.liveRecords += 1;
    }
    bucket.canvasPixels += diagnostic.canvasPixels || 0;
    bucket.maxCanvasPixels = Math.max(bucket.maxCanvasPixels, diagnostic.canvasPixels || 0);
    bucket.bakeMs += diagnostic.bakeMs || 0;
    bucket.metricsMs += diagnostic.metricsMs || 0;
    bucket.canvasMs += diagnostic.canvasMs || 0;
    bucket.drawMs += diagnostic.drawMs || 0;
    bucket.textureMs += diagnostic.textureMs || 0;
};

const pushBranchRigTopDiagnostic = (list, diagnostic, key) => {
    list.push(createBranchRigRecordDiagnosticSample(diagnostic));
    list.sort((a, b) => (Number(b?.[key]) || 0) - (Number(a?.[key]) || 0));
    if (list.length > 5) {
        list.length = 5;
    }
};

const recordBranchRigBuildDiagnostic = (diagnostics, diagnostic = null) => {
    if (!diagnostics || !diagnostic) {
        return;
    }
    const depthKey = String(Math.max(1, Math.round(Number(diagnostic.depth) || 1)));
    const orderKey = diagnostic.branchOrderLabel || resolveBranchOrderLabel(diagnostic.branchOrder);
    diagnostics.records += 1;
    if (diagnostic.subtreeBaked === true) {
        diagnostics.groupedSubtrees += 1;
    } else {
        diagnostics.liveRecords += 1;
    }
    diagnostics.canvasPixels += diagnostic.canvasPixels || 0;
    diagnostics.bakeMs += diagnostic.bakeMs || 0;
    diagnostics.metricsMs += diagnostic.metricsMs || 0;
    diagnostics.canvasMs += diagnostic.canvasMs || 0;
    diagnostics.drawMs += diagnostic.drawMs || 0;
    diagnostics.textureMs += diagnostic.textureMs || 0;
    if ((diagnostic.canvasPixels || 0) > diagnostics.maxCanvasPixels) {
        diagnostics.maxCanvasPixels = diagnostic.canvasPixels || 0;
        diagnostics.maxCanvasRecord = createBranchRigRecordDiagnosticSample(diagnostic);
    }
    if (!diagnostics.byDepth[depthKey]) {
        diagnostics.byDepth[depthKey] = createBranchRigDiagnosticBucket();
    }
    if (!diagnostics.byOrder[orderKey]) {
        diagnostics.byOrder[orderKey] = createBranchRigDiagnosticBucket();
    }
    updateBranchRigDiagnosticBucket(diagnostics.byDepth[depthKey], diagnostic);
    updateBranchRigDiagnosticBucket(diagnostics.byOrder[orderKey], diagnostic);
    pushBranchRigTopDiagnostic(diagnostics.topByBakeMs, diagnostic, 'bakeMs');
    pushBranchRigTopDiagnostic(diagnostics.topByCanvasPixels, diagnostic, 'canvasPixels');
};

const finalizeBranchRigDiagnosticBucket = (bucket = {}) => ({
    records: bucket.records || 0,
    liveRecords: bucket.liveRecords || 0,
    groupedSubtrees: bucket.groupedSubtrees || 0,
    canvasMegapixels: roundRatio((bucket.canvasPixels || 0) / 1000000),
    maxCanvasMegapixels: roundRatio((bucket.maxCanvasPixels || 0) / 1000000),
    bakeMs: roundMs(bucket.bakeMs),
    metricsMs: roundMs(bucket.metricsMs),
    canvasMs: roundMs(bucket.canvasMs),
    drawMs: roundMs(bucket.drawMs),
    textureMs: roundMs(bucket.textureMs),
});

const formatBranchRigBucketRow = (label, bucket = {}) => {
    const finalized = finalizeBranchRigDiagnosticBucket(bucket);
    return [
        String(label),
        `records=${finalized.records}`,
        `live=${finalized.liveRecords}`,
        `grouped=${finalized.groupedSubtrees}`,
        `mp=${finalized.canvasMegapixels}`,
        `maxMp=${finalized.maxCanvasMegapixels}`,
        `bake=${finalized.bakeMs}`,
        `draw=${finalized.drawMs}`,
        `texture=${finalized.textureMs}`,
    ].join(' ');
};

const formatBranchRigRecordRow = (record = {}) => [
    `depth=${record.depth}`,
    `order=${record.branchOrderLabel}`,
    `profile=${record.branchDetailProfile || SAKURA_BRANCH_DETAIL_PROFILES.FULL}`,
    `subtree=${record.subtreeBaked === true ? 'yes' : 'no'}`,
    `size=${record.width}x${record.height}`,
    `pixels=${record.canvasPixels}`,
    `terminals=${record.terminalCount}`,
    `children=${record.childBranchCount}`,
    `subtreeBranches=${record.subtreeBranchCount}`,
    `subtreeTerminals=${record.subtreeTerminalCount}`,
    `subtreeMaxDepth=${record.subtreeMaxDepth}`,
    `bake=${record.bakeMs}`,
].join(' ');

const finalizeBranchRigBuildDiagnostics = (diagnostics = null) => {
    if (!diagnostics) {
        return null;
    }
    const sortedDepthEntries = Object.entries(diagnostics.byDepth)
        .sort(([left], [right]) => Number(left) - Number(right));
    const sortedOrderEntries = Object.entries(diagnostics.byOrder)
        .sort(([left], [right]) => String(left).localeCompare(String(right)));
    return {
        records: diagnostics.records,
        liveRecords: diagnostics.liveRecords,
        groupedSubtrees: diagnostics.groupedSubtrees,
        canvasMegapixels: roundRatio(diagnostics.canvasPixels / 1000000),
        maxCanvasRecord: diagnostics.maxCanvasRecord,
        timings: {
            bakeMs: roundMs(diagnostics.bakeMs),
            metricsMs: roundMs(diagnostics.metricsMs),
            canvasMs: roundMs(diagnostics.canvasMs),
                drawMs: roundMs(diagnostics.drawMs),
                textureMs: roundMs(diagnostics.textureMs),
        },
        byDepth: Object.fromEntries(
            sortedDepthEntries.map(([key, bucket]) => [
                key,
                finalizeBranchRigDiagnosticBucket(bucket),
            ]),
        ),
        byDepthRows: sortedDepthEntries.map(([key, bucket]) => formatBranchRigBucketRow(`depth=${key}`, bucket)),
        byOrder: Object.fromEntries(
            sortedOrderEntries.map(([key, bucket]) => [
                key,
                finalizeBranchRigDiagnosticBucket(bucket),
            ]),
        ),
        byOrderRows: sortedOrderEntries.map(([key, bucket]) => formatBranchRigBucketRow(`order=${key}`, bucket)),
        topByBakeMs: diagnostics.topByBakeMs,
        topByBakeRows: diagnostics.topByBakeMs.map(formatBranchRigRecordRow),
        topByCanvasPixels: diagnostics.topByCanvasPixels,
        topByCanvasRows: diagnostics.topByCanvasPixels.map(formatBranchRigRecordRow),
    };
};

const resolveFallbackMotionCamera = (sizeState = {}) => {
    const canvasWidth = clampPixelExtent(sizeState?.pixelWidth);
    const canvasHeight = clampPixelExtent(sizeState?.pixelHeight);
    return {
        scale: 1,
        offsetX: canvasWidth * 0.5,
        offsetY: Math.max(32, canvasHeight - 44),
    };
};

const createBranchRigState = () => ({
    signature: '',
    rootRecord: null,
    records: [],
    recordByNodeKey: new Map(),
    diagnostics: null,
    presentationTint: null,
    presentationTerminalTint: null,
    presentationTintApplied: false,
});

const destroyBranchRig = (rig) => {
    rig.records.forEach((record) => {
        if (record.sprite) {
            record.sprite.texture = Texture.EMPTY;
            if (record.sprite.parent && typeof record.sprite.parent.removeChild === 'function') {
                record.sprite.parent.removeChild(record.sprite);
            }
            if (typeof record.sprite.destroy === 'function') {
                record.sprite.destroy();
            }
        }
        if (record.terminalSprite) {
            record.terminalSprite.texture = Texture.EMPTY;
            if (record.terminalSprite.parent && typeof record.terminalSprite.parent.removeChild === 'function') {
                record.terminalSprite.parent.removeChild(record.terminalSprite);
            }
            if (typeof record.terminalSprite.destroy === 'function') {
                record.terminalSprite.destroy();
            }
        }
        destroyTexture(record.texture);
        destroyTexture(record.terminalTexture);
    });
    rig.signature = '';
    rig.rootRecord = null;
    rig.records = [];
    rig.recordByNodeKey = new Map();
    rig.diagnostics = null;
};

const createBranchRigSignature = (scene) => {
    if (typeof scene?.branchRigSignature !== 'string' || !scene.branchRigSignature) {
        throw new Error('ZEN_BONSAI_PIXI_BRANCH_RIG_SIGNATURE_MISSING');
    }
    return [
        'branch_rig',
        scene.branchRigSignature,
    ].join('|');
};

const resolveBranchRigBakeMetrics = (planRecord) => {
    const renderNode = planRecord?.node || {};
    const length = Math.max(1, toNumber(renderNode?.length, 1));
    const width = Math.max(0.5, toNumber(renderNode?.width, 1));
    const curveExtent = Math.max(
        Math.abs(toNumber(renderNode?.curve, 0)),
        Math.abs(toNumber(renderNode?.curveIn, 0)),
        Math.abs(toNumber(renderNode?.curveOut, 0)),
    );
    const terminalReach = Array.isArray(planRecord?.terminals)
        ? planRecord.terminals.reduce((maxReach, terminalRecord) => Math.max(
            maxReach,
            Math.abs(toNumber(terminalRecord?.bakeDistance, 0))
                + Math.max(
                    toNumber(terminalRecord?.bakePaintRadius, 0),
                    toNumber(terminalRecord?.paintRadius, 0),
                ),
        ), 0)
        : 0;
    const padding = Math.ceil(Math.max(46, width * 8, terminalReach + 24));
    const canvasWidth = clampPixelExtent(length + (curveExtent * 2) + (terminalReach * 1.25) + (padding * 2));
    const canvasHeight = clampPixelExtent((curveExtent * 2) + (terminalReach * 2) + (width * 14) + (padding * 2));

    return {
        width: canvasWidth,
        height: canvasHeight,
        startX: padding + curveExtent,
        startY: canvasHeight * 0.5,
    };
};

const measureBranchRigSubtreeBounds = ({
    record,
} = {}) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const updatePoint = (x, y, radius = 0) => {
        const safeRadius = Math.max(0, toNumber(radius, 0));
        minX = Math.min(minX, x - safeRadius);
        minY = Math.min(minY, y - safeRadius);
        maxX = Math.max(maxX, x + safeRadius);
        maxY = Math.max(maxY, y + safeRadius);
    };

    const walk = (currentRecord, x, y, angle) => {
        const pose = resolveSakuraRenderPlanRecordPoseV1({
            record: currentRecord,
            startX: x,
            startY: y,
            baseAngle: angle,
            motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.NONE,
        });
        const renderNode = currentRecord.node;
        const segment = pose.segment;
        const branchRadius = Math.max(1.6, toNumber(renderNode?.width, 1) * 0.9);
        const sampleCount = 9;
        for (let index = 0; index <= sampleCount; index += 1) {
            const point = BranchGeometryModel.pointAt(segment, index / sampleCount);
            updatePoint(point.x, point.y, branchRadius);
        }

        currentRecord.terminals.forEach((terminalRecord) => {
            if (!terminalRecord.bakeLifeVisual) return;
            const terminalBase = resolveSakuraRenderPlanAttachmentV1({
                pose,
                attachT: terminalRecord.attachT,
                hasAttachT: true,
            });
            const dist = toNumber(terminalRecord.bakeDistance, 0);
            const tipAngle = terminalBase.angle
                + toNumber(terminalRecord.terminal?.angle, 0);
            updatePoint(
                terminalBase.x + (Math.cos(tipAngle) * dist),
                terminalBase.y + (Math.sin(tipAngle) * dist),
                Math.max(
                    toNumber(terminalRecord.bakePaintRadius, 0),
                    toNumber(terminalRecord.paintRadius, 0),
                ),
            );
        });

        collectPixiBonsaiRenderPlanChildren(currentRecord).forEach((child) => {
            const attach = resolveSakuraRenderPlanAttachmentV1({
                pose,
                attachT: child.attachT,
                hasAttachT: child.hasAttachT,
            });
            walk(
                child.child,
                attach.x,
                attach.y,
                attach.angle + toNumber(child.angleOffset, 0),
            );
        });
    };

    walk(record, 0, 0, 0);

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        return null;
    }
    return {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
    };
};

const resolveBranchRigSubtreeBakeMetrics = (record) => {
    const renderNode = record?.node || {};
    const bounds = measureBranchRigSubtreeBounds({
        record,
    });
    if (!bounds) {
        return resolveBranchRigBakeMetrics(record);
    }
    const width = Math.max(0.5, toNumber(renderNode?.width, 1));
    const padding = Math.ceil(Math.max(34, width * 7));
    return {
        width: clampPixelExtent(bounds.width + (padding * 2)),
        height: clampPixelExtent(bounds.height + (padding * 2)),
        startX: padding - bounds.minX,
        startY: padding - bounds.minY,
    };
};

const createBranchSegmentBakeRecord = (record, { subtreeBaked = false } = {}) => {
    if (subtreeBaked) return record;
    return Object.freeze({
        ...record,
        children: Object.freeze([]),
    });
};

const bakeBranchRigRecord = ({
    planRecord,
    scene,
    assetCache,
    staticBaseAngle = -Math.PI / 2,
}) => {
    const recordStartedAtMs = nowPerfMs();
    const renderNode = planRecord.node;
    const depth = planRecord.depth;
    const subtreeBaked = shouldBakePixiBonsaiRenderPlanSubtree(planRecord);
    const branchOrder = Number.isFinite(Number(renderNode?.branchOrder))
        ? Number(renderNode.branchOrder)
        : SAKURA_BRANCH_ORDER.TRUNK;
    const useTwigSilhouetteProfile = (
        subtreeBaked
        && branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG
    );
    const subtreeSummary = subtreeBaked
        ? resolvePixiBonsaiRenderPlanSubtreeSummary({
            record: planRecord,
        })
        : null;
    const metricsStartedAtMs = nowPerfMs();
    const metrics = subtreeBaked
        ? resolveBranchRigSubtreeBakeMetrics(planRecord)
        : resolveBranchRigBakeMetrics(planRecord);
    const metricsEndedAtMs = nowPerfMs();
    const branchDetailProfile = useTwigSilhouetteProfile
        ? SAKURA_BRANCH_DETAIL_PROFILES.TWIG_SILHOUETTE
        : SAKURA_BRANCH_DETAIL_PROFILES.FULL;
    const bakeRecord = createBranchSegmentBakeRecord(planRecord, {
        subtreeBaked,
    });
    const bakeContentLayer = (renderTreeContent, label) => {
        const canvasStartedAtMs = nowPerfMs();
        const canvas = createBonsaiBakeCanvas(metrics.width, metrics.height);
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            throw new Error(`ZEN_BONSAI_PIXI_BRANCH_RIG_CONTEXT_UNAVAILABLE:${label}`);
        }
        configureCanvasQuality(ctx);
        resetCanvasContext(ctx, metrics.width, metrics.height);
        const canvasEndedAtMs = nowPerfMs();

        const drawSegment = createSakuraBranchLayerRenderer({
            ctx,
            assetCache,
            config: SAKURA_CONFIG,
            frameCount: 0,
            wind: null,
            lighting: resolveSakuraRenderLighting(
                scene.renderOptions.environmentState,
            ),
            renderTreeContent,
            freezeBranchMotion: true,
            deferBranchSagToRuntime: true,
            showBranchTierDebug: scene?.renderOptions?.showBranchTierDebug === true,
            lifeState: scene?.renderOptions?.lifeState || null,
            activationPresentation: resolveZenBonsaiActivationBakePresentation(
                scene?.renderOptions?.activationPresentation || null,
            ),
            growthProjection: scene?.renderOptions?.growthProjection || null,
            branchDetailProfile,
            renderPlan: scene.renderPlan,
            renderPlanRoot: bakeRecord,
            renderPlanPresentation: 'bake',
        });
        const drawStartedAtMs = nowPerfMs();
        drawSegment(
            bakeRecord,
            metrics.startX,
            metrics.startY,
            0,
            0,
            depth,
        );
        const drawEndedAtMs = nowPerfMs();

        const textureStartedAtMs = nowPerfMs();
        const texture = createTextureFromBakeCanvas(canvas);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0, 0);
        sprite.pivot.set(metrics.startX, metrics.startY);
        sprite.roundPixels = false;
        const textureEndedAtMs = nowPerfMs();
        return {
            canvas,
            texture,
            sprite,
            canvasMs: canvasEndedAtMs - canvasStartedAtMs,
            drawMs: drawEndedAtMs - drawStartedAtMs,
            textureMs: textureEndedAtMs - textureStartedAtMs,
            endedAtMs: textureEndedAtMs,
        };
    };
    const terminalCount = bakeRecord.terminals.filter(
        (terminal) => terminal.bakeLifeVisual !== null,
    ).length;
    const childBranchCount = bakeRecord.children.length;
    const shouldBakeTerminalLayer = (
        terminalCount > 0
        || subtreeBaked
        || childBranchCount <= 0
    );
    const woodBake = bakeContentLayer(SAKURA_TREE_CONTENT_LAYERS.WOOD, 'wood');
    const terminalBake = shouldBakeTerminalLayer
        ? bakeContentLayer(SAKURA_TREE_CONTENT_LAYERS.TERMINALS, 'terminals')
        : null;
    const textureEndedAtMs = terminalBake
        ? Math.max(woodBake.endedAtMs, terminalBake.endedAtMs)
        : woodBake.endedAtMs;
    const widthProfile = summarizePixiBonsaiBranchWidthProfile(renderNode);

    return {
        planRecord,
        node: planRecord.node,
        renderNode,
        depth,
        staticBaseAngle,
        subtreeBaked,
        childLinks: [],
        canvas: woodBake.canvas,
        texture: woodBake.texture,
        sprite: woodBake.sprite,
        terminalCanvas: terminalBake?.canvas || null,
        terminalTexture: terminalBake?.texture || null,
        terminalSprite: terminalBake?.sprite || null,
        startX: metrics.startX,
        startY: metrics.startY,
        bakeDiagnostics: {
            depth: Math.max(1, Math.round(Number(depth) || 1)),
            branchOrder,
            branchOrderLabel: resolveBranchOrderLabel(branchOrder),
            branchDetailProfile,
            widthProfile,
            subtreeBaked,
            contentLayers: shouldBakeTerminalLayer ? ['wood', 'terminals'] : ['wood'],
            width: metrics.width,
            height: metrics.height,
            canvasPixels: metrics.width * metrics.height * (shouldBakeTerminalLayer ? 2 : 1),
            terminalCount,
            childBranchCount,
            subtreeBranchCount: subtreeSummary?.branchCount ?? 1,
            subtreeTerminalCount: subtreeSummary?.terminalCount ?? terminalCount,
            subtreeMaxDepth: subtreeSummary?.maxDepth ?? Math.max(1, Math.round(Number(depth) || 1)),
            metricsMs: metricsEndedAtMs - metricsStartedAtMs,
            canvasMs: woodBake.canvasMs + (terminalBake?.canvasMs || 0),
            drawMs: woodBake.drawMs + (terminalBake?.drawMs || 0),
            textureMs: woodBake.textureMs + (terminalBake?.textureMs || 0),
            bakeMs: textureEndedAtMs - recordStartedAtMs,
        },
    };
};

const buildBranchRigRecords = ({
    rig,
    rootContainer,
    scene,
    assetCache,
}) => {
    const renderPlan = requireSakuraRenderPlanV1(scene?.renderPlan);
    const diagnostics = createBranchRigBuildDiagnostics();
    const walk = (planRecord, baseAngle = -Math.PI / 2) => {
        const record = bakeBranchRigRecord({
            planRecord,
            scene,
            assetCache,
            staticBaseAngle: baseAngle,
        });
        recordBranchRigBuildDiagnostic(diagnostics, record.bakeDiagnostics);
        rig.records.push(record);
        registerPixiBonsaiBranchRecord({
            recordByNodeKey: rig.recordByNodeKey,
            node: planRecord.node,
            record,
        });
        rootContainer.addChild(record.sprite);

        if (record.subtreeBaked) {
            return record;
        }

        const staticPose = resolveSakuraRenderPlanRecordPoseV1({
            record: planRecord,
            startX: 0,
            startY: 0,
            baseAngle,
            motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.NONE,
        });
        collectPixiBonsaiRenderPlanChildren(planRecord).forEach((child) => {
            const attach = resolveSakuraRenderPlanAttachmentV1({
                pose: staticPose,
                attachT: child.attachT,
                hasAttachT: child.hasAttachT,
            });
            const childRecord = walk(
                child.child,
                attach.angle + child.angleOffset,
            );
            if (childRecord) {
                record.childLinks.push({
                    record: childRecord,
                    hasAttachT: child.hasAttachT,
                    attachT: child.attachT,
                    angleOffset: child.angleOffset,
                });
            }
        });
        return record;
    };

    rig.rootRecord = walk(
        renderPlan.root,
        renderPlan.rootAngle,
    );
    rig.records.forEach((record) => {
        if (record?.terminalSprite) {
            rootContainer.addChild(record.terminalSprite);
        }
    });
    return finalizeBranchRigBuildDiagnostics(diagnostics);
};

const updateBranchRigSprites = ({
    rig,
    scene,
    sizeState,
    frameCount = 0,
    windState = null,
}) => {
    if (!rig?.rootRecord || !scene?.renderPlan) {
        return;
    }
    const renderPlan = requireSakuraRenderPlanV1(scene.renderPlan);
    const trunkOffsetX = renderPlan.anchor.trunkOffsetX;
    const trunkBaseY = renderPlan.anchor.trunkBaseY;
    const fallbackCamera = resolveFallbackMotionCamera(sizeState);
    const camera = scene?.camera || fallbackCamera;
    const cameraScale = Math.max(0.01, toNumber(camera?.scale, fallbackCamera.scale));
    const cameraOffsetX = toNumber(camera?.offsetX, fallbackCamera.offsetX);
    const cameraOffsetY = toNumber(camera?.offsetY, fallbackCamera.offsetY);
    const lifeState = scene?.renderOptions?.lifeState || null;
    const branchMotionWindState = resolveSakuraEffectiveBranchWindState({
        wind: windState,
        lifeState,
    });
    const lifeBranchSag = resolvePixiBonsaiRuntimeBranchSag(scene);

    const applyRecord = (record, x, y, angle) => {
        if (!record?.node || record.node.type !== 'branch') {
            return;
        }
        const pose = resolveSakuraRenderPlanRecordPoseV1({
            record: record.planRecord,
            startX: x,
            startY: y,
            baseAngle: angle,
            frameCount,
            windState: branchMotionWindState,
            lifeBranchSag,
            subtreeBaked: record.subtreeBaked === true,
            motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
        });
        if (record.sprite) {
            applyPixiBonsaiBranchSpriteTransform(record, {
                x: cameraOffsetX + (x * cameraScale),
                y: cameraOffsetY + (y * cameraScale),
                rotation: pose.resolvedAngle,
                scale: cameraScale,
            });
        }
        if (record.subtreeBaked === true) {
            return;
        }

        const childLinks = Array.isArray(record.childLinks) ? record.childLinks : [];
        childLinks.forEach((child) => {
            if (!child?.record) {
                return;
            }
            const attach = resolveSakuraRenderPlanAttachmentV1({
                pose,
                attachT: child.attachT,
                hasAttachT: child.hasAttachT,
            });
            applyRecord(
                child.record,
                attach.x,
                attach.y,
                attach.angle + toNumber(child.angleOffset, 0),
            );
        });
    };

    applyRecord(
        rig.rootRecord,
        trunkOffsetX,
        trunkBaseY,
        renderPlan.rootAngle,
    );
};

export function createPixiBonsaiRenderer({ canvas } = {}) {
    if (!canvas) {
        throw new Error('ZEN_BONSAI_PIXI_CANVAS_MISSING');
    }

    let app = null;
    let root = null;
    let branchRigRoot = null;
    let branchRigMask = null;
    let assetCache = null;
    let rain = null;
    let disposed = false;
    const layers = Object.fromEntries(PIXI_BONSAI_LAYER_ORDER.map((id) => [id, createLayerState(id)]));
    const branchRig = createBranchRigState();
    const presentationState = createPresentationState();

    const ensureApp = (sizeState) => {
        if (app) return;

        app = new Application({
            view: canvas,
            width: clampPixelExtent(sizeState?.pixelWidth),
            height: clampPixelExtent(sizeState?.pixelHeight),
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: false,
            autoStart: false,
            resolution: 1,
            zenPondSpriteBatchDialect: true,
            zenPondTilingSpriteDialect: true,
        });
        if (typeof app.stop === 'function') {
            app.stop();
        }

        root = new Container();

        const backLayer = layers[PIXI_BONSAI_LAYER_IDS.BACK];
        backLayer.sprite = createPixiBonsaiLayerDisplayObject(PIXI_BONSAI_LAYER_IDS.BACK);
        backLayer.sprite.position.set(0, 0);
        backLayer.sprite.roundPixels = false;
        root.addChild(backLayer.sprite);

        rain = createZenRainPixiMesh({
            pixi: { Container, Geometry, Mesh, Shader }, renderer: app.renderer, parent: root,
        });

        branchRigRoot = new Container();
        root.addChild(branchRigRoot);

        branchRigMask = new Graphics();
        root.addChild(branchRigMask);

        const frontLayer = layers[PIXI_BONSAI_LAYER_IDS.FRONT];
        frontLayer.sprite = createPixiBonsaiLayerDisplayObject(PIXI_BONSAI_LAYER_IDS.FRONT);
        frontLayer.sprite.position.set(0, 0);
        frontLayer.sprite.roundPixels = false;
        root.addChild(frontLayer.sprite);
        app.stage.addChild(root);
    };

    const ensureLayerSurface = (layer, sizeState = {}, {
        resolutionScale = 1,
    } = {}) => {
        const displayWidth = clampPixelExtent(sizeState.pixelWidth);
        const displayHeight = clampPixelExtent(sizeState.pixelHeight);
        const scale = Math.max(0.1, Math.min(1, Number(resolutionScale) || 1));
        const width = clampPixelExtent(displayWidth * scale);
        const height = clampPixelExtent(displayHeight * scale);
        const shouldRebuild = !layer.canvas
            || !layer.ctx
            || !layer.texture
            || layer.width !== width
            || layer.height !== height
            || layer.displayWidth !== displayWidth
            || layer.displayHeight !== displayHeight
            || Math.abs((Number(layer.resolutionScale) || 1) - scale) > 0.001;

        if (!shouldRebuild) {
            return layer.ctx;
        }

        if (layer.sprite) {
            layer.sprite.texture = Texture.EMPTY;
        }
        destroyTexture(layer.texture);
        layer.canvas = createBonsaiBakeCanvas(width, height);
        layer.ctx = layer.canvas.getContext('2d', { alpha: true });
        if (!layer.ctx) {
            throw new Error(`ZEN_BONSAI_PIXI_LAYER_CONTEXT_UNAVAILABLE:${layer.id}`);
        }
        configureCanvasQuality(layer.ctx);
        layer.texture = createTextureFromBakeCanvas(layer.canvas);
        layer.width = width;
        layer.height = height;
        layer.displayWidth = displayWidth;
        layer.displayHeight = displayHeight;
        layer.resolutionScale = scale;
        layer.signature = '';

        if (layer.sprite) {
            layer.sprite.texture = layer.texture;
            resetLayerSpriteTransform(layer);
        }

        return layer.ctx;
    };

    const ensureAssetCache = () => {
        if (!assetCache) {
            assetCache = createBonsaiBakeAssetCache();
        }
        return assetCache;
    };

    const ensureBranchRig = ({
        scene,
    } = {}) => {
        if (!branchRigRoot) {
            throw new Error('ZEN_BONSAI_PIXI_BRANCH_RIG_ROOT_MISSING');
        }
        if (typeof scene?.sceneSignature !== 'string' || !scene.sceneSignature) {
            throw new Error('ZEN_BONSAI_PIXI_SCENE_SIGNATURE_MISSING');
        }
        const nextSignature = createBranchRigSignature(scene);
        if (branchRig.signature === nextSignature) {
            return {
                rebuilt: false,
                deferred: false,
                ready: true,
                records: branchRig.records.length,
                groupedSubtrees: branchRig.records.filter((record) => record.subtreeBaked).length,
                diagnostics: branchRig.diagnostics,
            };
        }
        const nextRig = createBranchRigState();
        let nextDiagnostics = null;
        try {
            nextDiagnostics = buildBranchRigRecords({
                rig: nextRig,
                rootContainer: branchRigRoot,
                scene,
                assetCache: ensureAssetCache(),
            });
        } catch (error) {
            destroyBranchRig(nextRig);
            throw error;
        }
        const previousRig = {
            signature: branchRig.signature,
            rootRecord: branchRig.rootRecord,
            records: branchRig.records,
            recordByNodeKey: branchRig.recordByNodeKey,
        };
        branchRig.records = nextRig.records;
        branchRig.rootRecord = nextRig.rootRecord;
        branchRig.recordByNodeKey = nextRig.recordByNodeKey;
        branchRig.diagnostics = nextDiagnostics;
        branchRig.signature = nextSignature;
        resetPixiBonsaiBranchRigPresentationCache(branchRig);
        destroyBranchRig(previousRig);
        return {
            rebuilt: true,
            deferred: false,
            ready: true,
            records: branchRig.records.length,
            groupedSubtrees: branchRig.records.filter((record) => record.subtreeBaked).length,
            diagnostics: branchRig.diagnostics,
        };
    };

    const resize = (sizeState = {}) => {
        if (!app || disposed) return;
        const width = clampPixelExtent(sizeState.pixelWidth);
        const height = clampPixelExtent(sizeState.pixelHeight);
        if (app.renderer.width !== width || app.renderer.height !== height) {
            app.renderer.resize(width, height);
        }
    };

    const bakeLayer = ({
        layer,
        scene,
        sizeState,
        frameCount,
        windState,
        renderLayer,
        renderTreeContent,
        freezeBranchMotion,
        resolutionScale = 1,
    }) => {
        const ctx = ensureLayerSurface(layer, sizeState, { resolutionScale });
        const width = clampPixelExtent(layer.width);
        const height = clampPixelExtent(layer.height);
        const scale = Math.max(0.1, Math.min(1, Number(layer.resolutionScale) || 1));
        resetCanvasContext(ctx, width, height);
        if (scale !== 1) {
            ctx.scale(scale, scale);
        }

        const species = resolveRenderSpecies(scene.treeType || 'sakura');
        species.render({
            ctx,
            topology: scene.topology,
            frameCount,
            currentStage: scene.currentStage,
            assetCache: ensureAssetCache(),
            wind: windState,
            camera: scene.camera || null,
            options: {
                ...(scene.renderOptions || {}),
                renderPlan: scene.renderPlan,
                renderLayer,
                ...(renderTreeContent ? { renderTreeContent } : {}),
                ...(freezeBranchMotion === true ? { freezeBranchMotion: true } : {}),
            },
        });

        if (typeof layer.texture?.baseTexture?.update === 'function') {
            layer.texture.baseTexture.update();
        }
    };

    const renderStaticLayer = ({
        scene,
        sizeState,
        frameCount,
        windState,
        layerId,
        renderLayer,
        renderTreeContent,
        freezeBranchMotion,
        resolutionScale = 1,
    }) => {
        if (typeof scene?.sceneSignature !== 'string' || !scene.sceneSignature) {
            throw new Error('ZEN_BONSAI_PIXI_SCENE_SIGNATURE_MISSING');
        }
        const layer = layers[layerId];
        const nextSignature = createLayerSignature(scene, sizeState, layerId, resolutionScale);
        if (layer.signature === nextSignature) {
            return false;
        }
        bakeLayer({
            layer,
            scene,
            sizeState,
            frameCount,
            windState,
            renderLayer,
            renderTreeContent,
            freezeBranchMotion,
            resolutionScale,
        });
        layer.signature = nextSignature;
        return true;
    };

    const render = ({
        scene,
        sizeState,
        frameCount = 0,
        windState = null,
    } = {}) => {
        const renderStartedAtMs = nowPerfMs();
        if (disposed || !scene?.topology) {
            return {
                renderer: RENDERER_NAME,
                rendered: false,
                timing: {
                    totalMs: roundMs(nowPerfMs() - renderStartedAtMs),
                },
            };
        }
        requireSakuraRenderPlanV1(scene.renderPlan);

        const ensureAppStartMs = nowPerfMs();
        ensureApp(sizeState);
        const ensureAppEndMs = nowPerfMs();
        const resizeStartMs = nowPerfMs();
        resize(sizeState);
        const resizeEndMs = nowPerfMs();

        const backLayerStartMs = nowPerfMs();
        const rebakedBack = renderStaticLayer({
            scene,
            sizeState,
            frameCount,
            windState,
            layerId: PIXI_BONSAI_LAYER_IDS.BACK,
            renderLayer: SAKURA_RENDER_LAYERS.BACK,
        });
        const backLayerEndMs = nowPerfMs();
        const branchRigStartMs = nowPerfMs();
        const branchRigResult = ensureBranchRig({
            scene,
        });
        const branchRigEndMs = nowPerfMs();
        const branchRigReady = branchRigResult.ready === true;
        const frontLayerStartMs = nowPerfMs();
        const rebakedFront = renderStaticLayer({
            scene,
            sizeState,
            frameCount,
            windState,
            layerId: PIXI_BONSAI_LAYER_IDS.FRONT,
            renderLayer: SAKURA_RENDER_LAYERS.FRONT,
        });
        const frontLayerEndMs = nowPerfMs();
        const spriteResetStartMs = nowPerfMs();
        PIXI_BONSAI_LAYER_ORDER.forEach((id) => {
            resetLayerSpriteTransform(layers[id]);
        });
        const spriteResetEndMs = nowPerfMs();
        const branchSpritesStartMs = nowPerfMs();
        const sceneViewportClip = applyPixiBonsaiSceneViewportClip({
            branchRigRoot,
            branchRigMask,
            scene,
        });
        if (branchRigReady) {
            const sceneViewportOffset = resolvePixiBonsaiSceneViewportOffset(scene);
            branchRigRoot.position.set(sceneViewportOffset.x, sceneViewportOffset.y);
            updateBranchRigSprites({
                rig: branchRig,
                scene,
                sizeState,
                frameCount,
                windState,
            });
        }
        const branchSpritesEndMs = nowPerfMs();
        const presentationStartMs = nowPerfMs();
        const presentation = stepPresentationState(
            presentationState,
            resolvePixiBonsaiRuntimePresentation(scene),
        );
        applyPixiBonsaiSpritePresentation(layers[PIXI_BONSAI_LAYER_IDS.BACK].sprite, {
            tint: presentation.backTint,
            alpha: presentation.backAlpha,
        });
        applyPixiBonsaiSpritePresentation(layers[PIXI_BONSAI_LAYER_IDS.FRONT].sprite, {
            tint: presentation.frontTint,
            alpha: presentation.frontAlpha,
        });
        if (branchRigReady) {
            applyPixiBonsaiBranchRigPresentation({
                rig: branchRig,
                rootContainer: branchRigRoot,
                tint: presentation.branchTint,
                terminalTint: presentation.terminalTint,
                alpha: presentation.branchAlpha,
            });
        }
        branchRigRoot.visible = branchRigReady;
        const presentationEndMs = nowPerfMs();

        const rainOptions = scene.renderOptions;
        const rainGeometry = rainOptions.homeGardenBedProjection
            ? resolveZenHomeGardenBedDeviceMesh({ projection: rainOptions.homeGardenBedProjection })
            : null;
        rain.container.scale.set(sizeState.pixelRatio);
        rain.setInputs(resolveZenBonsaiRainInputs({
            presentation: resolveZenBonsaiRainPresentation(rainGeometry, sizeState.pixelWidth, sizeState.pixelHeight),
            seed: hashStringFNV1a(scene.renderPlan.source.topologySignature), options: rainOptions, ...sizeState,
        }));
        rain.update(frameCount / 60);

        const pixiRenderStartMs = nowPerfMs();
        app.renderer.render(app.stage);
        const pixiRenderEndMs = nowPerfMs();

        return {
            renderer: RENDERER_NAME,
            rendered: true,
            layered: true,
            timing: {
                ensureAppMs: roundMs(ensureAppEndMs - ensureAppStartMs),
                resizeMs: roundMs(resizeEndMs - resizeStartMs),
                backLayerMs: roundMs(backLayerEndMs - backLayerStartMs),
                branchRigMs: roundMs(branchRigEndMs - branchRigStartMs),
                frontLayerMs: roundMs(frontLayerEndMs - frontLayerStartMs),
                spriteResetMs: roundMs(spriteResetEndMs - spriteResetStartMs),
                branchSpritesMs: roundMs(branchSpritesEndMs - branchSpritesStartMs),
                presentationMs: roundMs(presentationEndMs - presentationStartMs),
                pixiRenderMs: roundMs(pixiRenderEndMs - pixiRenderStartMs),
                totalMs: roundMs(pixiRenderEndMs - renderStartedAtMs),
            },
            branchRig: {
                records: branchRigResult.records,
                groupedSubtrees: branchRigResult.groupedSubtrees,
                rebuilt: branchRigResult.rebuilt,
                deferred: branchRigResult.deferred,
                ready: branchRigReady,
                diagnostics: branchRigResult.diagnostics || null,
            },
            staticLayersRebaked: rebakedBack || rebakedFront,
            staticLayerRebakes: {
                [PIXI_BONSAI_LAYER_IDS.BACK]: rebakedBack,
                [PIXI_BONSAI_LAYER_IDS.FRONT]: rebakedFront,
            },
            presentation: {
                backTint: presentation.backTint,
                frontTint: presentation.frontTint,
                branchTint: presentation.branchTint,
                terminalTint: presentation.terminalTint,
                branchAlpha: Number(presentation.branchAlpha.toFixed(3)),
            },
            sceneViewportClip,
            layers: resolvePixiBonsaiLayerDebug(layers),
        };
    };

    const observeActualAlpha = ({
        request,
        scene,
        frameSequence = 0,
        frameCount = 0,
    } = {}) => {
        if (disposed || !app) {
            throw new Error('ZEN_BONSAI_PIXI_ALPHA_OBSERVER_DISPOSED');
        }
        return observeSakuraPixiActualAlphaV1({
            request,
            renderer: app.renderer,
            treeRoot: branchRigRoot,
            viewportOrigin: resolvePixiBonsaiSceneViewportOffset(scene),
            frameSequence,
            frameCount,
        });
    };

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        rain?.dispose();
        rain = null;
        destroyBranchRig(branchRig);
        PIXI_BONSAI_LAYER_ORDER.forEach((id) => {
            const layer = layers[id];
            if (layer.sprite) {
                layer.sprite.texture = Texture.EMPTY;
            }
            destroyTexture(layer.texture);
            layer.texture = null;
            layer.canvas = null;
            layer.ctx = null;
            layer.width = 0;
            layer.height = 0;
            layer.signature = '';
        });
        assetCache = null;
        if (app && typeof app.destroy === 'function') {
            app.destroy(true, {
                children: true,
                texture: true,
                baseTexture: true,
            });
        }
        app = null;
        root = null;
        branchRigRoot = null;
        branchRigMask = null;
        PIXI_BONSAI_LAYER_ORDER.forEach((id) => {
            layers[id].sprite = null;
        });
    };

    return {
        renderer: RENDERER_NAME,
        render,
        observeActualAlpha,
        resize,
        resume() {
            branchRig.signature = '';
        },
        dispose,
    };
}
