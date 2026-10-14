import { requireZenPetalAppearance } from '../../../runtime/petals/zenPetalMaterial.js';
import { resolveZenPondRenderResolution, resolveZenPondWorldResolution, ZEN_POND_MAX_DPR } from '../../runtime/zenPondViewportPolicy.js';
import {
    BLEND_MODES,
    Container,
    installZenPixiProgramDiagnostics,
    RenderTexture,
    Sprite,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import {
    createZenPondPixiRendererAdmissionDiagnostics,
    createZenPondPixiRendererHost,
} from './createZenPondPixiRendererHost.js';
import { createPixiKoiTextureCache } from './pixiKoiTextureCache.js';
import { resolveFishShadowProfile } from './pixiSceneHelpers.js';
import {
    syncSceneEntitiesPass,
    updateSceneReadabilityPass,
} from './scene/index.js';
import {
    createGlimmerTexture,
    createParticleTexture,
    createPetalTexture,
    createRingTexture,
} from './pixiSceneTextureFactories.js';
import { createPixiSurfaceSourceBakeRuntime } from './pixiSurfaceSourceBakeRuntime.js';
import { createPixiDecorBakeRuntime } from './pixiDecorBakeRuntime.js';
import {
    bindPixiViewToBackgroundHost,
    createZenPixiSceneGraph,
    unbindPixiViewFromBackgroundHost,
} from './pixiSceneGraphLifecycle.js';
import {
    applyPixiSceneGraphWorldPolicy,
    buildPixiSceneWorldPolicySignature,
} from './pixiSceneWorldPolicy.js';
import { createPixiSceneWorldBackgroundDriver } from './pixiSceneWorldBackgroundDriver.js';
import {
    BASE_SCENE_CADENCE_PROFILE,
    resolvePixiSceneCadenceProfile,
    resolvePixiSceneStaticPassPlan,
    shouldRunCadenceClockInterval,
} from './pixiSceneCadencePolicy.js';
import { createPixiWaterPresentationRuntime } from './pixiWaterPresentationRuntime.js';
import {
    resolveZenCoverTransform,
    resolveZenVisibleWorldBounds,
    resolveZenWorldFilterSize,
} from '../../runtime/zenCoverMath.js';
import { applyZenPixiSceneViewport } from './zenPixiSceneViewport.js';
import { createPixiGpuFrameTimer } from './telemetry/pixiGpuFrameTimer.js';
import { createPixiFirstRenderTextureUploadProbe } from './telemetry/pixiFirstRenderTextureUploadProbe.js';
import { createPixiFirstTickRenderCallProbe } from './telemetry/pixiFirstTickRenderCallProbe.js';
import { createZenCanopyPreparationResearch } from './telemetry/zenCanopyPreparationResearch.js';
import {
    compileZenPondVisualRenderPlan,
} from './visualProfiles/compileZenPondVisualRenderPlan.js';

const ZEN_PIXI_GPU_FRAME_TIMER_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);
const ZEN_PIXI_PROGRAM_DIAGNOSTICS_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);
const ZEN_PIXI_FIRST_TICK_RENDER_CALL_PROBE_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);
const ZEN_PIXI_CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : false
);
const GPU_FRAME_TIMER_BUILD_DISABLED_SNAPSHOT = Object.freeze({
    enabled: false,
    supported: false,
    api: null,
    reason: 'build_capability_disabled',
    pendingQueryCount: 0,
    sampleCount: 0,
    disjointCount: 0,
    droppedFrameCount: 0,
    failedQueryCount: 0,
    lastGpuMs: null,
    avgGpuMs: null,
    minGpuMs: null,
    maxGpuMs: null,
});
const createBuildScopedPixiGpuFrameTimer = (options) => {
    if (ZEN_PIXI_GPU_FRAME_TIMER_BUILD_ENABLED) {
        return createPixiGpuFrameTimer(options);
    }
    return Object.freeze({
        begin: () => false,
        end: () => false,
        snapshot: () => GPU_FRAME_TIMER_BUILD_DISABLED_SNAPSHOT,
        dispose: () => false,
    });
};

const createNoopScene = (reason = null, admissionDiagnostics = null) => Object.freeze({
    active: false,
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
    getRendererAdmissionDiagnostics: admissionDiagnostics ? () => admissionDiagnostics.snapshot() : undefined,
    tick: () => { },
    dispose: () => { },
});
const NOOP_SCENE = createNoopScene();
const nowMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
};
const roundMetricMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(4));
};
const EMPTY_TICK_STAGE_METRICS = Object.freeze({
    beginFrameMs: 0,
    readabilityMs: 0,
    waterPassMs: 0,
    backgroundFxTickMs: 0,
    waterEffectsTickMs: 0,
    waterSurfaceFilterTickMs: 0,
    surfaceFieldSubmitMs: 0,
    cloudReflectionBakeMs: 0,
    staticBaseBakeMs: 0,
    entitySyncMs: 0,
    texturePruneFrame: false,
});
const EMPTY_RENDER_ENTITY_REF = Object.freeze({ current: Object.freeze([]) });
const SCENE_READABILITY_ALPHA = Object.freeze({
    plantCastShadows: 1,
    rockCastShadows: 0.96,
    fish: 1,
    lilyPads: 1,
    waterLilyBlooms: 1,
    zenIrisClusters: 1,
    rocks: 1,
    waterBenthic: 0.96,
    ripples: 0.9,
});

const POND_TEXTURE_CACHE_POLICIES = Object.freeze({
    rock: Object.freeze({
        maxEntries: 90,
        retentionMs: 8000,
    }),
    lilyPad: Object.freeze({
        maxEntries: 140,
        retentionMs: 9000,
    }),
    waterLilyBloom: Object.freeze({
        maxEntries: 90,
        retentionMs: 7000,
    }),
    zenIrisCluster: Object.freeze({
        maxEntries: 80,
        retentionMs: 8000,
    }),
});

const resolveRendererDprCap = (qualityProfile = null) => {
    if (!Number.isFinite(qualityProfile?.dprCap) || qualityProfile.dprCap <= 0) {
        throw new Error('ZEN_POND_QUALITY_DPR_CAP_REQUIRED');
    }
    return Math.min(ZEN_POND_MAX_DPR, qualityProfile.dprCap);
};

const resolveSceneAntialias = () => true;

export const mountZenPixiSceneRenderer = ({
    backgroundHost,
    width,
    height,
    viewportWidth = width,
    viewportHeight = height,
    devicePixelRatio,
    view: providedView = null,
    shouldAnimate,
    qualityProfile,
    resolveDepthTexture,
    waterPaletteRef,
    fishRef,
    bathymetryFieldRef,
    hoveredDomainRef,
    lockedTargetRef,
    selectedFishUidRef,
    frameStateRef,
    surfaceDisturbancesRef,
    lilyPadsRef,
    waterLilyRef,
    zenIrisClustersRef,
    particlesRef,
    petalsRef,
    glimmersRef,
    rocksRef,
    sceneGenerationKey = '',
    rendererDebugToggles = null,
    rendererDebugTogglesRef = null,
    visualProfile,
    useTicker = true,
}) => {
    if (!backgroundHost || !width || !height || !shouldAnimate) {
        return createNoopScene('invalid_mount_args');
    }
    const initialFrameState = frameStateRef?.current;
    if (!initialFrameState || typeof initialFrameState !== 'object' || !initialFrameState.channels) {
        return createNoopScene('frame_contract_missing');
    }
    let sceneWidth = Math.max(1, Math.round(Number(width) || 1));
    let sceneHeight = Math.max(1, Math.round(Number(height) || 1));
    let viewportWidthPx = Math.max(1, Math.round(Number(viewportWidth) || sceneWidth));
    let viewportHeightPx = Math.max(1, Math.round(Number(viewportHeight) || sceneHeight));

    const initStartedMs = nowMs();
    const sceneCadenceProfile = resolvePixiSceneCadenceProfile(qualityProfile);
    const visualRenderPlan = compileZenPondVisualRenderPlan(visualProfile);

    let app = null;
    const rendererDprCap = resolveRendererDprCap(qualityProfile);
    let rendererDevicePixelRatio = Number(devicePixelRatio);
    let rendererResolution = resolveZenPondRenderResolution({
        width: viewportWidthPx, height: viewportHeightPx,
        devicePixelRatio,
        dprCap: rendererDprCap,
        maxRenderPixels: qualityProfile.renderPixelBudget,
    });
    const antialiasEnabled = resolveSceneAntialias(qualityProfile);
    const admissionDiagnostics = ZEN_PIXI_PROGRAM_DIAGNOSTICS_BUILD_ENABLED && qualityProfile?.telemetry?.enabled === true
        ? createZenPondPixiRendererAdmissionDiagnostics({ nowMs })
        : null;
    try {
        app = createZenPondPixiRendererHost({
            width: viewportWidthPx,
            height: viewportHeightPx,
            view: providedView || undefined,
            antialias: antialiasEnabled,
            backgroundAlpha: 0,
            autoDensity: true,
            resolution: rendererResolution,
            autoStart: false,
        }, admissionDiagnostics);
    } catch (error) {
        return createNoopScene(`application_create_failed:${String(error?.message || error || 'unknown')}`, admissionDiagnostics);
    }

    // Until the scene is returned, this mount owns every completed allocation.
    const mountRollback = [() => app.destroy(true, { children: true })];
    let disposed = false;
    try {
    const view = app?.view;
    if (!view) {
        mountRollback.pop();
        app?.destroy(true, { children: true });
        return createNoopScene('application_view_missing');
    }

    let programDiagnostics = null;
    if (ZEN_PIXI_PROGRAM_DIAGNOSTICS_BUILD_ENABLED && qualityProfile?.telemetry?.enabled === true) {
        programDiagnostics = installZenPixiProgramDiagnostics(app.renderer, { enabled: true, nowMs });
        mountRollback.push(() => programDiagnostics.dispose());
    }

    mountRollback.push(() => unbindPixiViewFromBackgroundHost({ backgroundHost, view }));
    bindPixiViewToBackgroundHost({
        backgroundHost,
        view,
    });
    const gpuFrameTimer = createBuildScopedPixiGpuFrameTimer({
        renderer: app.renderer,
        enabled: qualityProfile?.telemetry?.enabled === true,
    });
    mountRollback.push(() => gpuFrameTimer.dispose());
    const firstRenderTextureUploadProbe = createPixiFirstRenderTextureUploadProbe({
        renderer: app.renderer,
        enabled: qualityProfile?.telemetry?.enabled === true,
    });
    mountRollback.push(() => firstRenderTextureUploadProbe.dispose());
    const firstTickRenderCallProbe = ZEN_PIXI_FIRST_TICK_RENDER_CALL_PROBE_BUILD_ENABLED
        ? createPixiFirstTickRenderCallProbe({
            renderer: app.renderer,
            enabled: qualityProfile?.telemetry?.enabled === true,
        })
        : null;
    if (firstTickRenderCallProbe) mountRollback.push(() => firstTickRenderCallProbe.dispose());

    const worldRoot = new Container();
    mountRollback.push(() => { if (!worldRoot.destroyed) worldRoot.destroy({ children: true }); });
    const screenRoot = new Container();
    mountRollback.push(() => { if (!screenRoot.destroyed) screenRoot.destroy({ children: true }); });
    app.stage.addChild(screenRoot);

    const worldFilterSize = resolveZenWorldFilterSize({
        worldWidth: sceneWidth,
        worldHeight: sceneHeight,
    });
    const worldRenderTextureResolution = resolveZenPondWorldResolution({
        worldWidth: sceneWidth, worldHeight: sceneHeight,
        width: viewportWidthPx, height: viewportHeightPx, resolution: rendererResolution,
        maxRenderPixels: qualityProfile.renderPixelBudget,
    });
    const worldRenderTexture = RenderTexture.create({
        width: worldFilterSize.width,
        height: worldFilterSize.height,
        resolution: worldRenderTextureResolution,
    });
    mountRollback.push(() => { if (!worldRenderTexture.destroyed) worldRenderTexture.destroy(true); });
    const compositeSprite = new Sprite(worldRenderTexture);
    mountRollback.push(() => { if (!compositeSprite.destroyed) compositeSprite.destroy(); });
    compositeSprite.x = 0;
    compositeSprite.y = 0;
    compositeSprite.width = worldFilterSize.width;
    compositeSprite.height = worldFilterSize.height;
    screenRoot.addChild(compositeSprite);

    const ownedTextures = new Set();
    mountRollback.push((cleanup) => {
        for (const texture of ownedTextures) {
            if (texture && !texture.destroyed) cleanup(() => texture.destroy(true));
        }
        ownedTextures.clear();
    });
    const sceneGraph = createZenPixiSceneGraph({
        rootContainer: worldRoot,
        width: sceneWidth,
        height: sceneHeight,
        sceneReadabilityAlpha: SCENE_READABILITY_ALPHA,
        worldPolicy: initialFrameState.worldPolicy,
        ownedTextures,
    });
    const {
        waterSurfaceFilterContainer,
        surfaceBenthicLightContainer,
        waterSurfaceSourceContainer,
        waterSurfaceGuideContainer,
        surfaceSourceGraph,
        waterCloudReflectionContainer,
        waterCloudReflectionSourceContainer,
        backgroundContainer,
        depthContainer,
        rockCastShadowContainer,
        rocksContainer,
        waterBenthicContainer,
        floorMaterialContainer,
        fishContainer,
        waterSurfaceContainer,
        particlesContainer,
        plantCastShadowContainer,
        lilyPadsContainer,
        waterLilyBloomsContainer,
        zenIrisClustersContainer,
        ripplesContainer,
        petalsContainer,
        glimmersContainer,
        topShadowContainer,
        cosmicBackgroundContainer,
        cosmicBackgroundSprite,
        baseWaterSprite,
        depthMultiplySprite,
        depthSoftSprite,
        cloudReflectionBakeBaseSprite,
        tintMultiplySprite,
        tintSoftSprite,
        tintScreenSprite,
        waterSurfaceFilterAreaSize,
        syncWaterSurfaceFilterArea,
    } = sceneGraph;
    const rockCastBakeRuntime = createPixiDecorBakeRuntime({
        renderer: app.renderer, width: sceneWidth, height: sceneHeight,
        container: rockCastShadowContainer, shadow: true,
    });
    mountRollback.push(() => rockCastBakeRuntime.destroy());
    const rockMaterialBakeRuntime = createPixiDecorBakeRuntime({
        renderer: app.renderer, width: sceneWidth, height: sceneHeight,
        container: rocksContainer, shadow: false,
    });
    mountRollback.push(() => rockMaterialBakeRuntime.destroy());
    const staticBaseBakeRuntime = createPixiSurfaceSourceBakeRuntime({
        renderer: app.renderer,
        width: sceneWidth,
        height: sceneHeight,
        surfaceFilterContainer: waterSurfaceFilterContainer,
        requiredSourceContainer: floorMaterialContainer,
        sourceContainers: surfaceSourceGraph.staticBaseSources,
        dynamicContainers: [
            ...surfaceSourceGraph.dynamicSources,
            ...surfaceSourceGraph.slowOverlaySources,
        ],
    });
    mountRollback.push(() => staticBaseBakeRuntime.destroy());
    const cloudReflectionBakeRuntime = createPixiSurfaceSourceBakeRuntime({
        renderer: app.renderer,
        width: sceneWidth,
        height: sceneHeight,
        surfaceFilterContainer: waterSurfaceFilterContainer,
        renderContainer: waterCloudReflectionSourceContainer,
        spriteParentContainer: waterCloudReflectionContainer,
        spriteInsertIndex: 0,
        bakedSpriteBlendMode: BLEND_MODES.SCREEN ?? BLEND_MODES.NORMAL,
        requiredSourceContainer: waterCloudReflectionSourceContainer,
        sourceContainers: surfaceSourceGraph.cloudReflectionSources,
        beforeRender: () => {
            cloudReflectionBakeBaseSprite.visible = true;
        },
        afterRender: () => {
            cloudReflectionBakeBaseSprite.visible = false;
        },
    });
    mountRollback.push(() => cloudReflectionBakeRuntime.destroy());
    let worldPolicySignature = buildPixiSceneWorldPolicySignature(initialFrameState.worldPolicy);
    const syncSceneGraphWorldPolicy = (worldPolicy = null) => {
        const nextSignature = buildPixiSceneWorldPolicySignature(worldPolicy);
        if (nextSignature === worldPolicySignature) return;
        applyPixiSceneGraphWorldPolicy({
            graph: sceneGraph,
            worldPolicy,
        });
        staticBaseBakeRuntime.invalidate({ restoreSources: false });
        cloudReflectionBakeRuntime.invalidate({ restoreSources: false });
        rockCastBakeRuntime.invalidate({ restoreSources: false });
        rockMaterialBakeRuntime.invalidate({ restoreSources: false });
        worldPolicySignature = nextSignature;
    };
    let visibleWorldBounds = {
        x: 0,
        y: 0,
        width: sceneWidth,
        height: sceneHeight,
    };

    const applyCompositeViewportTransform = () => {
        const transform = resolveZenCoverTransform({
            worldWidth: sceneWidth,
            worldHeight: sceneHeight,
            viewportWidth: viewportWidthPx,
            viewportHeight: viewportHeightPx,
        });
        compositeSprite.scale.set(transform.scale, transform.scale);
        compositeSprite.position.set(transform.offsetX, transform.offsetY);
        visibleWorldBounds = resolveZenVisibleWorldBounds({
            worldWidth: sceneWidth,
            worldHeight: sceneHeight,
            viewportWidth: viewportWidthPx,
            viewportHeight: viewportHeightPx,
        });
        syncWaterSurfaceFilterArea(visibleWorldBounds);
        return {
            scale: transform.scale,
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
            visibleWorldBounds,
        };
    };
    applyCompositeViewportTransform();

    let lastWaterEffectsProbe = null;
    let frameCount = 0;
    let renderTimeMs = 0;
    let firstRenderTextureUploadSnapshot = null;
    let firstTickRenderCallSnapshot = null;
    const setStartupPhase = (phase) => {
        programDiagnostics?.setDiagnosticPhase(phase);
        if (firstRenderTextureUploadSnapshot === null) firstRenderTextureUploadProbe.setPhase(phase);
        if (firstTickRenderCallSnapshot === null) firstTickRenderCallProbe?.setPhase(phase);
    };
    const prepareCanopyBeforeFirstDraw = ZEN_PIXI_CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED
        ? createZenCanopyPreparationResearch({
            renderer: app.renderer,
            canopyPreparation: qualityProfile?.telemetry?.canopyPreparation,
            telemetryEnabled: qualityProfile?.telemetry?.enabled === true,
            setStartupPhase,
            isBeforeFirstDraw: () => !disposed && useTicker === false && frameCount === 0,
        })
        : null;

    const worldBackgroundDriver = createPixiSceneWorldBackgroundDriver({
        sceneWidth,
        sceneHeight,
        sceneGenerationKey,
        ownedTextures,
        cosmicBackgroundContainer,
        cosmicBackgroundSprite,
    });
    mountRollback.push(() => worldBackgroundDriver.dispose());
    const ringTextureCache = new Map();
    const particleTextureCache = new Map();
    const petalTextureCache = new Map();
    const lilyPadTextureCache = new Map();
    const waterLilyBloomTextureCache = new Map();
    const zenIrisClusterTextureCache = new Map();
    const rockTextureCache = new Map();
    let glimmerTextureRecord = null;

    const koiTextureCache = createPixiKoiTextureCache();
    mountRollback.push(() => koiTextureCache.dispose());
    const pixiFishPool = new Map();
    const ripplePool = new Map();
    const particlePool = new Map();
    const lilyPadPool = new Map();
    const waterLilyBloomPool = new Map();
    const zenIrisClusterPool = new Map();
    const petalPool = new Map();
    const glimmerPool = new Map();
    const rockPool = new Map();
    const lilyPadCastShadowPool = new Map();
    const waterLilyCastShadowPool = new Map();
    const zenIrisCastShadowPool = new Map();
    const rockCastShadowPool = new Map();
    const aliveScratch = {
        rocks: new Set(),
        fish: new Set(),
        particles: new Set(),
        lilyPads: new Set(),
        waterLilyBlooms: new Set(),
        zenIrisClusters: new Set(),
        ripples: new Set(),
        petals: new Set(),
        glimmers: new Set(),
    };
    const waterPresentationRuntime = createPixiWaterPresentationRuntime({
        renderer: app.renderer,
        sceneWidth,
        sceneHeight,
        qualityProfile,
        sceneGenerationKey,
        sceneCadenceProfile,
        resolveDepthTexture,
        waterPaletteRef,
        bathymetryFieldRef,
        ownedTextures,
        baseWaterSprite,
        depthMultiplySprite,
        depthSoftSprite,
        tintMultiplySprite,
        tintSoftSprite,
        tintScreenSprite,
        waterSurfaceFilterContainer,
        surfaceBenthicLightContainer,
        waterSurfaceSourceContainer,
        waterSurfaceGuideContainer,
        waterCloudReflectionSourceContainer,
        waterSurfaceContainer,
        ripplesContainer,
        topShadowContainer,
        waterBenthicContainer,
        floorMaterialContainer,
        waterSurfaceFilterAreaSize,
        frameStateRef,
        surfaceDisturbancesRef,
        rendererDebugToggles,
        rendererDebugTogglesRef,
        visualRenderPlan,
        ...(prepareCanopyBeforeFirstDraw ? { prepareCanopyBeforeFirstDraw } : {}),
        isDisposed: () => disposed,
    });
    mountRollback.push(() => waterPresentationRuntime.dispose());
    const getRingTextureRecord = (lineWidth) => {
        const key = clampValue(Number(lineWidth) || 1.2, 0.7, 2.8).toFixed(2);
        const cached = ringTextureCache.get(key);
        if (cached) return cached;
        const created = createRingTexture(ownedTextures, Number(key));
        ringTextureCache.set(key, created);
        return created;
    };

    const getParticleTextureRecord = (colorTriplet) => {
        const key = typeof colorTriplet === 'string' ? colorTriplet : '197,214,222';
        const cached = particleTextureCache.get(key);
        if (cached) return cached;
        const created = createParticleTexture(ownedTextures, key);
        particleTextureCache.set(key, created);
        return created;
    };

    const getPetalTextureRecord = (baseColor, shapeType, materialLighting) => {
        requireZenPetalAppearance({ color: baseColor, shapeType });
        const key = `${baseColor}|${shapeType}`;
        const cached = petalTextureCache.get(key);
        if (cached) {
            cached.setMaterialLighting(materialLighting);
            return cached;
        }
        const created = createPetalTexture(ownedTextures, baseColor, shapeType, materialLighting);
        petalTextureCache.set(key, created);
        return created;
    };

    const getGlimmerTextureRecord = () => {
        if (glimmerTextureRecord) return glimmerTextureRecord;
        glimmerTextureRecord = createGlimmerTexture(ownedTextures);
        return glimmerTextureRecord;
    };

    const onTick = (deltaMs = 16.6667) => {
        if (disposed) return EMPTY_TICK_STAGE_METRICS;
        const numericDeltaMs = Number(deltaMs);
        const frameDeltaMs = Number.isFinite(numericDeltaMs) && numericDeltaMs >= 0
            ? numericDeltaMs
            : 16.6667;
        frameCount += 1;
        const previousRenderTimeMs = frameCount <= 1 ? null : renderTimeMs;
        renderTimeMs += frameDeltaMs;
        const beginFrameStartMs = nowMs();
        setStartupPhase('begin_frame');
        const beginFrameResult = waterPresentationRuntime.beginFrame({
            deltaMs: frameDeltaMs,
            frameCount,
        });
        const beginFrameEndMs = nowMs();
        const {
            optimizationProfile,
            effectDebugToggles,
            surfaceEffectsEnabled,
            surfaceEffectsRequested,
            surfaceEffectsDeferredForFirstFrame,
            waterFrameState,
            frameChannels,
            frameContractTuning,
            canonicalSurfaceFieldSelected,
            waterLayerApplyState,
        } = beginFrameResult;
        const fishShadowProfile = resolveFishShadowProfile(
            qualityProfile,
            optimizationProfile,
            waterFrameState?.worldPolicy,
        );
        syncSceneGraphWorldPolicy(waterFrameState?.worldPolicy);
        if (canonicalSurfaceFieldSelected && ripplesContainer) {
            ripplesContainer.visible = false;
        }
        worldBackgroundDriver.sync({
            worldPolicy: waterFrameState?.worldPolicy,
            frameChannels,
            deltaMs: frameDeltaMs,
        });
        const readabilityStartMs = nowMs();
        updateSceneReadabilityPass({
            renderTimeMs,
            fishContainer,
            lilyPadsContainer,
            waterLilyBloomsContainer,
            zenIrisClustersContainer,
            rocksContainer,
            waterBenthicContainer,
            ripplesContainer,
            waterFrameState,
            frameChannels,
            sceneReadabilityAlpha: SCENE_READABILITY_ALPHA,
            sceneCadenceProfile,
        });
        const readabilityEndMs = nowMs();

        const waterPassStartMs = nowMs();
        setStartupPhase('water_effects');
        const waterPassResult = waterPresentationRuntime.runEffectsPass({
            frameCount,
            renderTimeMs,
            visibleWorldBounds,
            deltaMs: frameDeltaMs,
            frameContractTuning,
            frameState: waterFrameState,
            frameChannels,
            optimizationProfile,
            surfaceEffectsEnabled,
            surfaceEffectsRequested,
            surfaceEffectsDeferredForFirstFrame,
            effectDebugToggles,
            waterLayerApplyState,
        });
        lastWaterEffectsProbe = waterPassResult.lastWaterEffectsProbe;
        const waterPassEndMs = nowMs();
        const cloudReflectionBakeStartMs = nowMs();
        setStartupPhase('cloud_bake');
        const shouldValidateCloudReflectionBake = (
            frameCount <= 1
            || waterPassResult.waterPassPlan.runCloudReflectionUpdate
        );
        const cloudReflectionBakeResult = cloudReflectionBakeRuntime.refresh({
            enabled: (
                surfaceEffectsEnabled === true
                && lastWaterEffectsProbe?.cloudReflectionBakeSafe === true
            ),
            force: false,
            validateCache: shouldValidateCloudReflectionBake,
        });
        if (lastWaterEffectsProbe && typeof lastWaterEffectsProbe === 'object') {
            lastWaterEffectsProbe.cloudReflectionBakeActive = cloudReflectionBakeResult.active === true;
            lastWaterEffectsProbe.cloudReflectionBakeFullUpdate = cloudReflectionBakeResult.refreshed === true;
            lastWaterEffectsProbe.cloudReflectionBakeReason = cloudReflectionBakeResult.reason;
        }
        const cloudReflectionBakeEndMs = nowMs();
        const textureCachePruneEveryFrames = Math.max(
            1,
            Math.round(
                Number(sceneCadenceProfile?.textureCachePruneEveryFrames)
                || BASE_SCENE_CADENCE_PROFILE.textureCachePruneEveryFrames,
            ),
        );
        const shouldPrunePondTextureCache = shouldRunCadenceClockInterval({
            timeMs: renderTimeMs,
            previousTimeMs: previousRenderTimeMs,
            cadenceFrames: textureCachePruneEveryFrames,
            phase: textureCachePruneEveryFrames - 1,
        });
        const staticPassPlan = resolvePixiSceneStaticPassPlan({
            frameCount,
            renderTimeMs,
            previousRenderTimeMs,
            sceneCadenceProfile,
        });

        const entitySyncStartMs = nowMs();
        setStartupPhase('entity_sync');
        const entitySyncResult = syncSceneEntitiesPass({
            webGLVersion: app.renderer.context.webGLVersion,
            frameChannels,
            koiCausticReceiver: waterPassResult.koiCausticReceiver,
            surfaceMaterialLightingActive: waterPassResult.surfaceMaterialLightingActive,
            frameCount,
            renderTimeMs,
            previousRenderTimeMs,
            visibleWorldBounds,
            worldPolicy: waterFrameState?.worldPolicy,
            sceneCadenceProfile,
            shouldPrunePondTextureCache,
            ownedTextures,
            fishRef,
            bathymetryFieldRef,
            particlesRef,
            lilyPadsRef,
            waterLilyRef,
            zenIrisClustersRef,
            surfaceDisturbancesRef: canonicalSurfaceFieldSelected
                ? EMPTY_RENDER_ENTITY_REF
                : surfaceDisturbancesRef,
            petalsRef,
            glimmersRef,
            rocksRef,
            hoveredDomainRef,
            lockedTargetRef,
            selectedFishUidRef,
            rendererDebugToggles,
            rendererDebugTogglesRef,
            fishShadowProfile,
            koiTextureCache,
            pixiFishPool,
            fishContainer,
            particlePool,
            particlesContainer,
            getParticleTextureRecord,
            lilyPadPool,
            lilyPadsContainer,
            lilyPadCastShadowPool,
            plantCastShadowContainer,
            lilyPadTextureCache,
            lilyPadTextureCachePolicy: POND_TEXTURE_CACHE_POLICIES.lilyPad,
            waterLilyBloomPool,
            waterLilyBloomsContainer,
            waterLilyCastShadowPool,
            waterLilyBloomTextureCache,
            waterLilyBloomTextureCachePolicy: POND_TEXTURE_CACHE_POLICIES.waterLilyBloom,
            zenIrisClusterPool,
            zenIrisClustersContainer,
            zenIrisCastShadowPool,
            zenIrisClusterTextureCache,
            zenIrisClusterTextureCachePolicy: POND_TEXTURE_CACHE_POLICIES.zenIrisCluster,
            ripplePool,
            ripplesContainer,
            getRingTextureRecord,
            petalPool,
            petalsContainer,
            getPetalTextureRecord,
            glimmerPool,
            glimmersContainer,
            getGlimmerTextureRecord,
            rockPool,
            rocksContainer,
            rockCastShadowPool,
            rockCastShadowContainer,
            rockTextureCache,
            rockTextureCachePolicy: POND_TEXTURE_CACHE_POLICIES.rock,
            aliveScratch,
            visualRenderPlan,
        });
        const entitySyncEndMs = nowMs();
        const shouldValidateStaticBaseBake = (
            frameCount <= 1
            || shouldPrunePondTextureCache === true
            || staticPassPlan.runRocksSync !== false
            || waterPassResult.waterPassPlan.runFullEffectsUpdate
            || waterPassResult.waterPassPlan.runFullBackgroundUpdate
            || waterPassResult.waterPassPlan.runBackgroundDynamicUpdate
        );
        const staticBaseBakeStartMs = nowMs();
        setStartupPhase('floor_bake');
        const staticBaseBakeResult = staticBaseBakeRuntime.refresh({
            // The material filter is static even when live surface optics are
            // disabled. Cache its result rather than running it every frame.
            enabled: surfaceEffectsEnabled === true || Array.isArray(floorMaterialContainer.filters),
            // Cadence admits validation; only changed source inputs rebake.
            force: false,
            validateCache: shouldValidateStaticBaseBake,
        });
        const floorBaseBakeEndMs = nowMs();
        const validateDecorCache = shouldPrunePondTextureCache || staticPassPlan.runRocksSync;
        setStartupPhase('rock_shadow_bake');
        rockCastBakeRuntime.refresh({ validateCache: validateDecorCache });
        const rockCastBakeEndMs = nowMs();
        setStartupPhase('rock_material_bake');
        rockMaterialBakeRuntime.refresh({ validateCache: validateDecorCache });
        const rockMaterialBakeEndMs = nowMs();
        if (lastWaterEffectsProbe && typeof lastWaterEffectsProbe === 'object') {
            lastWaterEffectsProbe.staticBaseBakeActive = staticBaseBakeResult.active === true;
            lastWaterEffectsProbe.staticBaseBakeFullUpdate = staticBaseBakeResult.refreshed === true;
            lastWaterEffectsProbe.staticBaseBakeReason = staticBaseBakeResult.reason;
        }
        const staticBaseBakeEndMs = nowMs();

        return {
            beginFrameMs: roundMetricMs(beginFrameEndMs - beginFrameStartMs),
            readabilityMs: roundMetricMs(readabilityEndMs - readabilityStartMs),
            waterPassMs: roundMetricMs(waterPassEndMs - waterPassStartMs),
            backgroundFxTickMs: roundMetricMs(lastWaterEffectsProbe?.backgroundFxTickMs),
            waterEffectsTickMs: roundMetricMs(lastWaterEffectsProbe?.waterEffectsTickMs),
            waterSurfaceFilterTickMs: roundMetricMs(lastWaterEffectsProbe?.waterSurfaceFilterTickMs),
            surfaceFieldSubmitMs: roundMetricMs(lastWaterEffectsProbe?.surfaceFieldSubmitMs),
            cloudReflectionBakeMs: roundMetricMs(cloudReflectionBakeEndMs - cloudReflectionBakeStartMs),
            staticBaseBakeMs: roundMetricMs(staticBaseBakeEndMs - staticBaseBakeStartMs),
            floorBaseBakeMs: roundMetricMs(floorBaseBakeEndMs - staticBaseBakeStartMs),
            rockCastBakeMs: roundMetricMs(rockCastBakeEndMs - floorBaseBakeEndMs),
            rockMaterialBakeMs: roundMetricMs(rockMaterialBakeEndMs - rockCastBakeEndMs),
            entitySyncMs: roundMetricMs(entitySyncEndMs - entitySyncStartMs),
            texturePruneFrame: shouldPrunePondTextureCache === true,
            koiRender: entitySyncResult?.koiRender || null,
        };

    };

    const renderSceneFrame = () => {
        const worldRenderStartMs = nowMs();
        setStartupPhase('world_render');
        app.renderer.render(worldRoot, {
            renderTexture: worldRenderTexture,
            clear: true,
        });
        const worldRenderEndMs = nowMs();
        setStartupPhase('stage_render');
        app.renderer.render(app.stage);
        const stageRenderEndMs = nowMs();
        return {
            worldRenderMs: roundMetricMs(worldRenderEndMs - worldRenderStartMs),
            stageRenderMs: roundMetricMs(stageRenderEndMs - worldRenderEndMs),
            renderMs: roundMetricMs(stageRenderEndMs - worldRenderStartMs),
        };
    };

    const tick = (deltaMs = 16.6667) => {
        if (disposed) return null;
        // The update owns GPU bake passes too; observe before its first upload.
        const observeFirstTick = firstRenderTextureUploadSnapshot === null;
        const observeFirstRenderCalls = firstTickRenderCallProbe !== null && firstTickRenderCallSnapshot === null;
        // onTick submits surface-field and bake passes as well as CPU work.
        // One query covers all GPU submissions owned by this Pond frame.
        let gpuTimerStarted = false;
        const updateStartMs = nowMs();
        let stageMs;
        let updateEndMs;
        let renderTimings;
        try {
            if (observeFirstRenderCalls) firstTickRenderCallProbe.start();
            if (observeFirstTick) firstRenderTextureUploadProbe.start();
            gpuTimerStarted = gpuFrameTimer.begin();
            stageMs = onTick(deltaMs);
            updateEndMs = nowMs();
            renderTimings = renderSceneFrame();
        } finally {
            try {
                if (gpuTimerStarted) gpuFrameTimer.end();
            } finally {
                try {
                    if (observeFirstTick) firstRenderTextureUploadSnapshot = firstRenderTextureUploadProbe.finish();
                } finally {
                    if (observeFirstRenderCalls) firstTickRenderCallSnapshot = firstTickRenderCallProbe.finish();
                }
            }
        }
        const renderEndMs = nowMs();
        const metrics = {
            updateMs: Math.max(0, updateEndMs - updateStartMs),
            renderMs: Math.max(0, Number(renderTimings.renderMs) || (renderEndMs - updateEndMs)),
            worldRenderMs: Math.max(0, Number(renderTimings.worldRenderMs) || 0),
            stageRenderMs: Math.max(0, Number(renderTimings.stageRenderMs) || 0),
            frameMs: Math.max(0, renderEndMs - updateStartMs),
            gpuTiming: gpuFrameTimer.snapshot(),
            textureUploads: firstRenderTextureUploadSnapshot,
            stageMs,
            koiRender: stageMs?.koiRender || null,
            waterEffects: lastWaterEffectsProbe,
            ...(ZEN_PIXI_FIRST_TICK_RENDER_CALL_PROBE_BUILD_ENABLED
                ? { renderCalls: firstTickRenderCallSnapshot }
                : {}),
        };
        return metrics;
    };

    const setViewport = ({
        width: nextWidth,
        height: nextHeight,
        devicePixelRatio: nextDevicePixelRatio,
    } = {}) => {
        if (disposed) return false;
        const result = applyZenPixiSceneViewport({
            renderer: app.renderer,
            worldRenderTexture,
            worldFilterSize,
            currentViewport: {
                width: viewportWidthPx,
                height: viewportHeightPx,
                devicePixelRatio: rendererDevicePixelRatio,
                resolution: rendererResolution,
            },
            nextViewport: {
                width: nextWidth,
                height: nextHeight,
                devicePixelRatio: nextDevicePixelRatio,
            },
            dprCap: rendererDprCap,
            maxRenderPixels: qualityProfile.renderPixelBudget,
        });
        viewportWidthPx = result.width;
        viewportHeightPx = result.height;
        rendererDevicePixelRatio = result.devicePixelRatio;
        rendererResolution = result.resolution;
        // Commit the new camera inputs before deriving cover/crop geometry.
        if (result.changed) applyCompositeViewportTransform();
        return result.changed;
    };
    const resize = ({
        width: nextWidth,
        height: nextHeight,
        devicePixelRatio: nextDevicePixelRatio = rendererDevicePixelRatio,
    } = {}) => setViewport({
        width: nextWidth,
        height: nextHeight,
        devicePixelRatio: nextDevicePixelRatio,
    });

    let tickerRafId = null;
    let tickerTimeoutId = null;
    let tickerLastFrameMs = nowMs();
    const cancelTickerLoop = () => {
        if (tickerRafId !== null && typeof globalThis.cancelAnimationFrame === 'function') {
            globalThis.cancelAnimationFrame(tickerRafId);
        }
        if (tickerTimeoutId !== null) {
            clearTimeout(tickerTimeoutId);
        }
        tickerRafId = null;
        tickerTimeoutId = null;
    };
    mountRollback.push(cancelTickerLoop);
    const tickerStep = (frameNowMs = nowMs()) => {
        if (disposed) return;
        const resolvedNowMs = Number.isFinite(Number(frameNowMs))
            ? Number(frameNowMs)
            : nowMs();
        const rawDeltaMs = resolvedNowMs - tickerLastFrameMs;
        const deltaMs = Number.isFinite(rawDeltaMs) && rawDeltaMs > 0
            ? rawDeltaMs
            : 16.6667;
        tickerLastFrameMs = resolvedNowMs;
        tick(deltaMs);
        if (disposed) return;
        if (typeof globalThis.requestAnimationFrame === 'function') {
            tickerRafId = globalThis.requestAnimationFrame(tickerStep);
            return;
        }
        tickerTimeoutId = setTimeout(() => tickerStep(nowMs()), 16);
    };
    if (useTicker) {
        tickerLastFrameMs = nowMs();
        if (typeof globalThis.requestAnimationFrame === 'function') {
            tickerRafId = globalThis.requestAnimationFrame(tickerStep);
        } else {
            tickerTimeoutId = setTimeout(() => tickerStep(nowMs()), 16);
        }
    }

    const scene = {
        active: true,
        getRendererAdmissionDiagnostics: app.getRendererAdmissionDiagnostics,
        getFirstTickRenderCallDiagnostics: ZEN_PIXI_FIRST_TICK_RENDER_CALL_PROBE_BUILD_ENABLED
            ? () => firstTickRenderCallSnapshot
            : undefined,
        prepareFirstFrameAssets: waterPresentationRuntime.prepareFirstFrameAssets,
        getProgramCompilationDiagnostics: programDiagnostics?.getStartupDiagnostics,
        finishProgramCompilationDiagnostics: programDiagnostics?.finishStartupDiagnostics,
        syncWaterEffectsLayerForRuntimeParams:
            waterPresentationRuntime.syncWaterEffectsLayerForRuntimeParams,
        getWaterEffectsLayerApplyState:
            waterPresentationRuntime.getWaterEffectsLayerApplyState,
        tick,
        setViewport,
        resizeWorld: ({ width, height }) => {
            if (disposed) throw new Error('ZEN_POND_REFLOW_RENDERER_DISPOSED');
            sceneWidth = width;
            sceneHeight = height;
            worldFilterSize.width = width;
            worldFilterSize.height = height;
            sceneGraph.resizeWorld(width, height);
            staticBaseBakeRuntime.resize(width, height);
            cloudReflectionBakeRuntime.resize(width, height);
            rockCastBakeRuntime.resize(width, height);
            rockMaterialBakeRuntime.resize(width, height);
            waterPresentationRuntime.resizeWorld(width, height);
            worldBackgroundDriver.resizeWorld(width, height);
            worldRenderTexture.resize(width, height, true);
            compositeSprite.width = width;
            compositeSprite.height = height;
            setViewport({ width: viewportWidthPx, height: viewportHeightPx, devicePixelRatio: rendererDevicePixelRatio });
            applyCompositeViewportTransform();
        },
        resize,
        dispose: ({ preserveCanvasContext = false } = {}) => {
            if (disposed) return;
            disposed = true;
            const cleanupErrors = [];
            const cleanup = (operation) => {
                try {
                    operation();
                } catch (error) {
                    cleanupErrors.push(error);
                }
            };
            cleanup(() => worldBackgroundDriver.dispose());
            cleanup(cancelTickerLoop);

            for (const pixiFish of pixiFishPool.values()) {
                cleanup(() => pixiFish.destroy());
            }
            pixiFishPool.clear();
            cleanup(() => koiTextureCache.dispose());

            for (const pool of [
                ripplePool,
                particlePool,
                lilyPadPool,
                waterLilyBloomPool,
                zenIrisClusterPool,
                petalPool,
                glimmerPool,
                rockPool,
                lilyPadCastShadowPool,
                waterLilyCastShadowPool,
                zenIrisCastShadowPool,
                rockCastShadowPool,
            ]) {
                for (const entry of pool.values()) {
                    if (entry?.container) {
                        cleanup(() => entry.container.destroy({
                            children: true,
                        }));
                    } else if (entry?.sprite) {
                        cleanup(() => entry.sprite.destroy());
                    } else if (entry?.destroy) {
                        cleanup(() => entry.destroy());
                    }
                }
                pool.clear();
            }

            cleanup(() => waterPresentationRuntime.dispose());
            cleanup(() => gpuFrameTimer.dispose());
            cleanup(() => firstRenderTextureUploadProbe.dispose());
            if (firstTickRenderCallProbe) cleanup(() => firstTickRenderCallProbe.dispose());
            cleanup(() => cloudReflectionBakeRuntime.destroy());
            cleanup(() => rockCastBakeRuntime.destroy());
            cleanup(() => rockMaterialBakeRuntime.destroy());
            cleanup(() => staticBaseBakeRuntime.destroy());
            cleanup(() => worldRoot.destroy({ children: true }));

            for (const texture of ownedTextures) {
                if (texture && !texture.destroyed) {
                    cleanup(() => texture.destroy(true));
                }
            }
            ownedTextures.clear();
            ringTextureCache.clear();
            particleTextureCache.clear();
            petalTextureCache.clear();
            lilyPadTextureCache.clear();
            waterLilyBloomTextureCache.clear();
            zenIrisClusterTextureCache.clear();
            rockTextureCache.clear();
            glimmerTextureRecord = null;

            if (worldRenderTexture && !worldRenderTexture.destroyed) {
                cleanup(() => worldRenderTexture.destroy(true));
            }
            if (
                preserveCanvasContext === true
                && app?.renderer?.context?.extensions
            ) {
                app.renderer.context.extensions.loseContext = null;
            }
            if (programDiagnostics) cleanup(() => programDiagnostics.dispose());
            cleanup(() => app.destroy(!preserveCanvasContext, { children: true }));
            cleanup(() => unbindPixiViewFromBackgroundHost({
                backgroundHost,
                view,
            }));
            if (cleanupErrors.length > 0) {
                throw new AggregateError(
                    cleanupErrors,
                    'ZEN_PIXI_SCENE_DISPOSE_FAILED',
                );
            }
        },
    };
    mountRollback.length = 0;
    return scene;
    } catch (error) {
        disposed = true;
        const errors = [error];
        const cleanup = (operation) => {
            try {
                operation();
            } catch (cleanupError) {
                errors.push(cleanupError);
            }
        };
        for (let index = mountRollback.length - 1; index >= 0; index -= 1) {
            cleanup(() => mountRollback[index](cleanup));
        }
        if (errors.length > 1) {
            const failure = new AggregateError(errors, 'ZEN_PIXI_SCENE_MOUNT_FAILED', { cause: error });
            failure.code = 'ZEN_PIXI_SCENE_MOUNT_FAILED';
            throw failure;
        }
        throw error;
    }
};
