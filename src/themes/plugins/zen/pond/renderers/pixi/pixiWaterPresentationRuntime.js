import { createPixiSceneBackgroundFxController } from './pixiSceneBackgroundFxController.js';
import { createWaterEffectSpriteBinder } from './pixiSceneGraphLifecycle.js';
import {
    PixiWaterSurfaceFilter,
    resolvePixiWaterSurfaceFilterResolutionScale,
} from './pixiWaterSurfaceFilter.js';
import { PixiWaterSurfaceFieldFilter } from './waterSurfaceField/PixiWaterSurfaceFieldFilter.js';
import {
    resolvePixiWaterSurfacePipelineMode,
} from './pixiWaterSurfaceFeatureUniforms.js';
import { resolvePixiFrameChannels } from './pixiFrameChannels.js';
import { createPixiWaterTemporalProjection } from './pixiWaterTemporalProjection.js';
import {
    createNoopPixiWaterEffectsLayer,
    loadPixiWaterEffectsLayerFactory,
} from './pixiWaterEffectsLayerLoader.js';
import {
    createPixiWaterEffectsLayerTransition,
} from './pixiWaterEffectsLayerTransition.js';
import { nowMs } from './pixiWaterEffectsMath.js';
import { updateSceneWaterEffectsPass } from './scene/pixiSceneWaterEffectsPass.js';
import { createZenPondOptimizationProfileResolver } from '../../runtime/core/zenPondOptimizationMaster.js';
import {
    resolvePixiSceneEffectRenderPlan,
    resolvePixiSceneEntityRenderPlan,
} from './pixiSceneWorldPolicy.js';
import {
    isZenWaterSurfaceFieldAlgorithm,
    normalizeZenWaterReflectionAlgorithm,
} from '../../contracts/zenWaterReflectionAlgorithms.js';
import { ZenWaterSurfaceField } from './waterSurfaceField/ZenWaterSurfaceField.js';
import { ZenWaterBenthicCausticOverlay } from './waterSurfaceField/ZenWaterBenthicCausticOverlay.js';
import { ZenWaterConnectedCausticOverlay } from './waterSurfaceField/ZenWaterConnectedCausticOverlay.js';
import { ZenWaterLightTransport, bindZenWaterLightTransport } from './waterSurfaceField/ZenWaterLightTransport.js';

const CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : false
);
const EMPTY_OBJECT = Object.freeze({});
const roundTimingMs = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric)
        ? Math.max(0, Number(numeric.toFixed(1)))
        : null;
};
const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

export const resolveCanonicalSurfaceFieldDemand = ({
    optimizationProfile = null,
    worldPolicy = null,
    waterReflectionAlgorithm = null,
    surfaceEffectsEnabled = null,
} = {}) => {
    const selected = isZenWaterSurfaceFieldAlgorithm(waterReflectionAlgorithm);
    const effectPlan = resolvePixiSceneEffectRenderPlan(worldPolicy);
    const surfaceRequested = (
        optimizationProfile?.water?.surfaceEffectsEnabled === true
        && effectPlan.waterSurfaceFilter
    );
    const surfaceActive = typeof surfaceEffectsEnabled === 'boolean'
        ? surfaceEffectsEnabled && effectPlan.waterSurfaceFilter
        : surfaceRequested;
    const causticsRequested = (
        optimizationProfile?.water?.layerEffectsEnabled === true
        && optimizationProfile?.debugToggles?.causticsEnabled === true
        && effectPlan.waterCaustics
    );
    return Object.freeze({
        selected,
        surfaceRequested: selected && surfaceRequested,
        surfaceActive: selected && surfaceActive,
        causticsRequested: selected && causticsRequested,
        fieldRequested: selected && (surfaceRequested || causticsRequested),
        fieldActive: selected && (surfaceActive || causticsRequested),
    });
};

export const createPixiWaterFrameSnapshotResolver = ({
    frameStateRef = null,
} = {}) => {
    let cachedWaterFrameState = null;
    let cachedFrameChannels = null;

    const applyFrameEnvPresentationOverrides = (waterFrameState, frameChannels) => {
        if (!frameChannels || typeof frameChannels !== 'object') return frameChannels;
        const sourceFrameEnv = frameChannels.frameEnv && typeof frameChannels.frameEnv === 'object'
            ? frameChannels.frameEnv
            : EMPTY_OBJECT;
        const sourceEnvState = waterFrameState?.envState && typeof waterFrameState.envState === 'object'
            ? waterFrameState.envState
            : EMPTY_OBJECT;
        const shadowLength = Number(sourceFrameEnv.shadowLength ?? sourceEnvState.shadowLength);
        if (!Number.isFinite(shadowLength)) {
            return frameChannels;
        }
        return {
            ...frameChannels,
            frameEnv: {
                ...sourceFrameEnv,
                shadowLength,
            },
        };
    };

    const resolveAuthoritativeWaterFrameState = () => {
        const authoritativeFrameState = frameStateRef?.current;
        if (authoritativeFrameState && typeof authoritativeFrameState === 'object' && authoritativeFrameState.channels) {
            return authoritativeFrameState;
        }
        throw new Error('ZEN_PIXI_FRAME_CONTRACT_MISSING');
    };

    const resolve = () => {
        const waterFrameState = resolveAuthoritativeWaterFrameState();
        if (cachedWaterFrameState === waterFrameState && cachedFrameChannels) {
            return {
                waterFrameState,
                frameChannels: cachedFrameChannels,
                cacheHit: true,
            };
        }
        const baseFrameChannels = resolvePixiFrameChannels({
            frameState: waterFrameState,
        });
        const frameChannels = applyFrameEnvPresentationOverrides(waterFrameState, baseFrameChannels);
        cachedWaterFrameState = waterFrameState;
        cachedFrameChannels = frameChannels;
        return {
            waterFrameState,
            frameChannels,
            cacheHit: false,
        };
    };

    const invalidate = () => {
        cachedWaterFrameState = null;
        cachedFrameChannels = null;
    };

    return {
        resolve,
        invalidate,
    };
};

export const createPixiWaterPresentationRuntime = ({
    renderer,
    sceneWidth,
    sceneHeight,
    qualityProfile,
    sceneGenerationKey = '',
    sceneCadenceProfile = null,
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
    waterSurfaceFilterContainer = null,
    surfaceBenthicLightContainer = null,
    waterSurfaceSourceContainer = null,
    waterSurfaceGuideContainer = null,
    waterSurfaceFilterAreaSize = null,
    waterCloudReflectionSourceContainer,
    waterSurfaceContainer,
    ripplesContainer = null,
    topShadowContainer,
    waterBenthicContainer,
    floorMaterialContainer,
    frameStateRef,
    surfaceDisturbancesRef = null,
    rendererDebugToggles = null,
    rendererDebugTogglesRef = null,
    visualRenderPlan,
    prepareCanopyBeforeFirstDraw = null,
    isDisposed = null,
} = {}) => {
    if (!visualRenderPlan?.waterTextures || !visualRenderPlan?.sunlight) {
        throw new Error('ZEN_POND_WATER_VISUAL_RENDER_PLAN_REQUIRED');
    }
    let disposed = false;
    const isRuntimeDisposed = () => disposed || (typeof isDisposed === 'function' && isDisposed() === true);

    const effectiveRendererDebugTogglesRef = {
        current: null,
    };
    const resolveCachedOptimizationProfile = createZenPondOptimizationProfileResolver();
    const resolveOptimizationProfile = () => {
        const optimizationProfile = resolveCachedOptimizationProfile({
            qualityProfile,
            rendererDebugToggles: rendererDebugTogglesRef?.current || rendererDebugToggles,
        });
        effectiveRendererDebugTogglesRef.current = optimizationProfile.debugToggles;
        return optimizationProfile;
    };
    const initialOptimizationProfile = resolveOptimizationProfile();
    const effectIntensityScale = clampNumber(initialOptimizationProfile?.effectIntensityScale, 0, 2, 1);

    const backgroundFxController = createPixiSceneBackgroundFxController({
        width: sceneWidth,
        height: sceneHeight,
        qualityProfile,
        sceneGenerationKey,
        resolveDepthTexture,
        waterPaletteRef,
        ownedTextures,
        baseWaterSprite,
        depthMultiplySprite,
        depthSoftSprite,
        tintMultiplySprite,
        tintSoftSprite,
        tintScreenSprite,
    });

    const {
        attachWaterEffectSprites,
        detachWaterEffectSprites,
    } = createWaterEffectSpriteBinder({
        webGLVersion: renderer.context.webGLVersion,
        floorMaterialContainer,
        waterBenthicContainer,
        waterSurfaceSourceContainer,
        waterSurfaceGuideContainer,
        waterCloudReflectionSourceContainer,
        waterSurfaceContainer,
        topShadowContainer,
    });

    const frameSnapshotResolver = createPixiWaterFrameSnapshotResolver({
        frameStateRef,
    });
    const waterTemporalProjection = createPixiWaterTemporalProjection({
        seed: sceneGenerationKey,
    });
    const noopWaterEffectsLayer = createNoopPixiWaterEffectsLayer();
    let waterEffectsLayer = noopWaterEffectsLayer;
    let preservedWaterEffectsTemporalState = null;
    let waterSurfaceFilter = null;
    let waterSurfaceField = null;
    let benthicCausticOverlay = null;
    let waterLightTransport = null;
    const koiCausticReceiver = { active: false, texture: null, uniforms: null, width: sceneWidth, height: sceneHeight };
    let surfaceFilters = null;
    let lastWaterEffectsProbe = null;
    let lastPublishedWaterLayerFailureGeneration = -1;
    let currentWorldPolicy = null;
    let currentWaterReflectionAlgorithm = null;
    const waterPassProbeState = {
        lastCadenceRenderTimeMs: null,
        lastWaterEffectsProbe: null,
        lastTimings: null,
    };

    const hasWaterEffectsLayerFeatures = (optimizationProfile = null, worldPolicy = null) => {
        const effectPlan = resolvePixiSceneEffectRenderPlan(worldPolicy);
        return (
            optimizationProfile?.water?.layerEffectsEnabled === true
            && effectPlan.waterLayer
        );
    };
    const hasWaterSurfaceFilterFeatures = (optimizationProfile = null, worldPolicy = null) => {
        const effectPlan = resolvePixiSceneEffectRenderPlan(worldPolicy);
        return (
            optimizationProfile?.water?.surfaceEffectsEnabled === true
            && effectPlan.waterSurfaceFilter
        );
    };

    const destroyWaterSurfaceFilter = () => {
        if (waterSurfaceFilterContainer) {
            waterSurfaceFilterContainer.filters = null;
        }
        if (waterSurfaceFilter) {
            waterSurfaceFilter.destroy();
            waterSurfaceFilter = null;
        }
        surfaceFilters = null;
    };

    const destroyWaterSurfaceField = () => {
        if (waterLightTransport) {
            if (waterSurfaceFilter?.usesCanonicalSurfaceField) bindZenWaterLightTransport(waterSurfaceFilter.uniforms, null);
            waterLightTransport.destroy();
            waterLightTransport = null;
        }
        if (waterSurfaceFilter?.usesCanonicalSurfaceField === true) {
            waterSurfaceFilter.clearSurfaceFieldTexture();
        }
        if (benthicCausticOverlay) {
            benthicCausticOverlay.destroy();
            benthicCausticOverlay = null;
        }
        if (waterSurfaceField) {
            waterSurfaceField.destroy();
            waterSurfaceField = null;
        }
    };

    const ensureWaterSurfaceField = () => {
        if (waterSurfaceField) return waterSurfaceField;
        waterSurfaceField = new ZenWaterSurfaceField({
            renderer,
            width: sceneWidth,
            height: sceneHeight,
            qualityProfile,
        });
        createBenthicOverlay();
        return waterSurfaceField;
    };

    const createBenthicOverlay = () => {
        const BenthicCausticOverlayClass = visualRenderPlan.sunlight.connectedCaustics
            ? ZenWaterConnectedCausticOverlay
            : ZenWaterBenthicCausticOverlay;
        benthicCausticOverlay = new BenthicCausticOverlayClass({
            webGLVersion: renderer.context.webGLVersion,
            container: surfaceBenthicLightContainer,
            width: sceneWidth,
            height: sceneHeight,
            ...(
                visualRenderPlan.sunlight.connectedCaustics
                    ? {
                        bathymetryField:
                            bathymetryFieldRef?.current,
                    }
                    : {}
            ),
        });
    };

    const ensureWaterSurfaceFilter = (
        optimizationProfile = null,
        worldPolicy = currentWorldPolicy,
        waterReflectionAlgorithm = null,
    ) => {
        if (!hasWaterSurfaceFilterFeatures(optimizationProfile, worldPolicy)) {
            return;
        }
        const pipelineMode = resolvePixiWaterSurfacePipelineMode(
            optimizationProfile?.debugToggles,
        );
        const resolvedWaterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
            waterReflectionAlgorithm,
        );
        const resolutionScale = resolvePixiWaterSurfaceFilterResolutionScale(qualityProfile);
        if (waterSurfaceFilter) {
            if (
                waterSurfaceFilter.pipelineMode !== pipelineMode
                || waterSurfaceFilter.waterReflectionAlgorithm !== resolvedWaterReflectionAlgorithm
            ) {
                destroyWaterSurfaceFilter();
            } else {
                waterSurfaceFilter.setResolutionScale(resolutionScale);
                return;
            }
        }
        if (waterSurfaceFilter) {
            waterSurfaceFilter.setResolutionScale(resolutionScale);
            return;
        }
        const WaterSurfaceFilterClass = isZenWaterSurfaceFieldAlgorithm(resolvedWaterReflectionAlgorithm)
            ? PixiWaterSurfaceFieldFilter
            : PixiWaterSurfaceFilter;
        waterSurfaceFilter = new WaterSurfaceFilterClass(sceneWidth, sceneHeight, {
            webGLVersion: renderer.context.webGLVersion,
            effectDebugToggles: optimizationProfile?.debugToggles,
            waterReflectionAlgorithm: resolvedWaterReflectionAlgorithm,
        });
        waterSurfaceFilter.setResolutionScale(resolutionScale);
        waterSurfaceFilter.padding = 0;
        if ('autoFit' in waterSurfaceFilter) {
            waterSurfaceFilter.autoFit = false;
        }
        surfaceFilters = [waterSurfaceFilter];
    };

    const destroyActiveWaterEffectsLayer = ({ preserveTemporalState = true } = {}) => {
        if (waterEffectsLayer === noopWaterEffectsLayer) return;
        preservedWaterEffectsTemporalState = preserveTemporalState === true
            ? waterEffectsLayer.getTemporalState?.() || preservedWaterEffectsTemporalState
            : null;
        waterEffectsLayer.destroy();
        detachWaterEffectSprites();
        waterEffectsLayer = noopWaterEffectsLayer;
        waterPassProbeState.lastWaterEffectsProbe = null;
        waterPassProbeState.lastTimings = null;
    };

    const resolveWaterEffectsRevealProgress = () => {
        if (waterEffectsLayer === noopWaterEffectsLayer) return 0;
        return 1;
    };

    const buildWaterEffectsLayer = (
        createPixiWaterEffectsLayer,
        optimizationProfile = null,
    ) => (
        createPixiWaterEffectsLayer({
            width: sceneWidth,
            height: sceneHeight,
            webGLVersion: renderer.context.webGLVersion,
            sceneGenerationKey,
            cloudReflectionsEnabled: optimizationProfile?.debugToggles?.cloudReflectionEnabled === true,
            rendererDebugToggles: optimizationProfile?.debugToggles || initialOptimizationProfile.debugToggles,
            rendererDebugTogglesRef: effectiveRendererDebugTogglesRef,
            textureCausticsEnabled: !isZenWaterSurfaceFieldAlgorithm(
                currentWaterReflectionAlgorithm,
            ),
            textureGenerators: visualRenderPlan.waterTextures,
            sunlightStrategy: visualRenderPlan.sunlight,
        })
    );

    const buildWaterLayerSignature = (optimizationProfile = null) => {
        const assetSignature = typeof optimizationProfile?.water?.layerAssetSignature === 'string'
            ? optimizationProfile.water.layerAssetSignature
            : '';
        const canonicalField = isZenWaterSurfaceFieldAlgorithm(
            currentWaterReflectionAlgorithm,
        );
        return `${assetSignature}|surface_field:${canonicalField ? 1 : 0}`;
    };

    const waterEffectsLayerTransition = createPixiWaterEffectsLayerTransition({
        loadFactory: loadPixiWaterEffectsLayerFactory,
        buildLayer: (createPixiWaterEffectsLayer, context = null) => (
            buildWaterEffectsLayer(
                createPixiWaterEffectsLayer,
                context?.optimizationProfile,
            )
        ),
        activateLayer: (nextWaterEffectsLayer, {
            signature: nextLayerSignature = '',
        } = {}) => {
            const previousWaterEffectsLayer = waterEffectsLayer;
            const cleanupLayer = (layer, errors) => {
                try {
                    layer?.destroy?.();
                } catch (cleanupError) {
                    errors.push(cleanupError);
                }
            };
            const buildActivationError = (
                errors,
                message,
                activeSignature = null,
            ) => {
                const activationError = new AggregateError(errors, message);
                if (typeof activeSignature === 'string') {
                    activationError.waterLayerActiveSignature =
                        activeSignature;
                }
                return activationError;
            };
            try {
                if (previousWaterEffectsLayer !== noopWaterEffectsLayer) {
                    preservedWaterEffectsTemporalState = (
                        previousWaterEffectsLayer.getTemporalState?.()
                        || preservedWaterEffectsTemporalState
                    );
                }
                if (preservedWaterEffectsTemporalState) {
                    nextWaterEffectsLayer.setTemporalState?.(
                        preservedWaterEffectsTemporalState,
                    );
                }
            } catch (error) {
                const errors = [error];
                cleanupLayer(nextWaterEffectsLayer, errors);
                throw buildActivationError(
                    errors,
                    'ZEN_PIXI_WATER_EFFECTS_LAYER_TEMPORAL_STATE_APPLY_FAILED',
                );
            }
            try {
                attachWaterEffectSprites(nextWaterEffectsLayer);
            } catch (error) {
                const errors = [error];
                try {
                    detachWaterEffectSprites();
                } catch (detachError) {
                    errors.push(detachError);
                }
                if (previousWaterEffectsLayer !== noopWaterEffectsLayer) {
                    try {
                        attachWaterEffectSprites(previousWaterEffectsLayer);
                    } catch (rollbackError) {
                        errors.push(rollbackError);
                        try {
                            detachWaterEffectSprites();
                        } catch (detachError) {
                            errors.push(detachError);
                        }
                        cleanupLayer(nextWaterEffectsLayer, errors);
                        cleanupLayer(previousWaterEffectsLayer, errors);
                        waterEffectsLayer = noopWaterEffectsLayer;
                        throw buildActivationError(
                            errors,
                            'ZEN_PIXI_WATER_EFFECTS_LAYER_ATTACH_ROLLBACK_FAILED',
                            '',
                        );
                    }
                }
                waterEffectsLayer = previousWaterEffectsLayer;
                cleanupLayer(nextWaterEffectsLayer, errors);
                throw buildActivationError(
                    errors,
                    'ZEN_PIXI_WATER_EFFECTS_LAYER_ATTACH_FAILED',
                );
            }
            waterEffectsLayer = nextWaterEffectsLayer;
            waterPassProbeState.lastWaterEffectsProbe = null;
            waterPassProbeState.lastTimings = null;
            if (previousWaterEffectsLayer !== noopWaterEffectsLayer) {
                try {
                    previousWaterEffectsLayer.destroy();
                } catch (error) {
                    const committedError = new Error(
                        'ZEN_PIXI_WATER_EFFECTS_LAYER_PREVIOUS_DESTROY_FAILED:'
                        + String(error?.message || error || 'unknown'),
                    );
                    committedError.waterLayerActiveSignature =
                        nextLayerSignature;
                    throw committedError;
                }
            }
        },
        deactivateLayer: ({ preserveTemporalState = true } = {}) => {
            destroyActiveWaterEffectsLayer({ preserveTemporalState });
        },
        isDisposed: isRuntimeDisposed,
    });

    const syncWaterEffectsLayerForOptimization = (optimizationProfile = null, worldPolicy = null) => {
        const resolvedOptimizationProfile = optimizationProfile || resolveOptimizationProfile();
        if (!hasWaterEffectsLayerFeatures(resolvedOptimizationProfile, worldPolicy)) {
            waterEffectsLayerTransition.disable();
            return null;
        }
        const nextLayerSignature = buildWaterLayerSignature(resolvedOptimizationProfile);
        return waterEffectsLayerTransition.request({
            signature: nextLayerSignature,
            context: {
                optimizationProfile: resolvedOptimizationProfile,
            },
        });
    };

    const syncWaterEffectsLayerForRuntimeParams = async () => {
        const optimizationProfile = resolveOptimizationProfile();
        const {
            waterFrameState,
        } = frameSnapshotResolver.resolve();
        const worldPolicy = waterFrameState?.worldPolicy || null;
        currentWaterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
            waterFrameState?.tuning?.waterReflectionAlgorithm,
        );
        currentWorldPolicy = worldPolicy;
        const layerRequested = hasWaterEffectsLayerFeatures(
            optimizationProfile,
            worldPolicy,
        );
        const expectedLayerSignature = layerRequested
            ? buildWaterLayerSignature(optimizationProfile)
            : '';
        const layerApplyPromise = syncWaterEffectsLayerForOptimization(
            optimizationProfile,
            worldPolicy,
        );
        if (layerApplyPromise) {
            await layerApplyPromise;
        }
        const applyState = waterEffectsLayerTransition.snapshot();
        if (
            layerRequested
            && (
                applyState.ready !== true
                || applyState.requestedSignature !== expectedLayerSignature
                || applyState.activeSignature !== expectedLayerSignature
            )
        ) {
            throw new Error(
                'ZEN_PIXI_WATER_EFFECTS_LAYER_APPLY_INCOMPLETE:'
                + `${applyState.status}:expected=${expectedLayerSignature}:`
                + `requested=${applyState.requestedSignature}:`
                + `active=${applyState.activeSignature}`,
            );
        }
        if (!layerRequested && applyState.status !== 'disabled') {
            throw new Error(
                `ZEN_PIXI_WATER_EFFECTS_LAYER_DISABLE_INCOMPLETE:${applyState.status}`,
            );
        }
        return applyState;
    };

    const prepareFirstFrameAssets = async () => {
        const prepareStartedMs = nowMs();
        const snapshotResolveStartedMs = prepareStartedMs;
        const optimizationProfile = resolveOptimizationProfile();
        const {
            waterFrameState,
        } = frameSnapshotResolver.resolve();
        const snapshotResolvedMs = nowMs();
        const worldPolicy = waterFrameState?.worldPolicy || null;
        const waterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
            waterFrameState?.tuning?.waterReflectionAlgorithm,
        );
        currentWaterReflectionAlgorithm = waterReflectionAlgorithm;
        currentWorldPolicy = worldPolicy;
        const layerFeaturesEnabled = hasWaterEffectsLayerFeatures(optimizationProfile, worldPolicy);
        const surfaceFeaturesEnabled = hasWaterSurfaceFilterFeatures(optimizationProfile, worldPolicy);
        const canonicalFieldDemand = resolveCanonicalSurfaceFieldDemand({
            optimizationProfile,
            worldPolicy,
            waterReflectionAlgorithm,
        });
        const layerRequestStartedMs = nowMs();
        const layerLoadPromise = syncWaterEffectsLayerForOptimization(optimizationProfile, worldPolicy);
        const layerRequestSettledMs = nowMs();
        const surfaceFilterStartedMs = layerRequestSettledMs;
        if (surfaceFeaturesEnabled) {
            ensureWaterSurfaceFilter(optimizationProfile, worldPolicy, waterReflectionAlgorithm);
        }
        const surfaceFilterSettledMs = nowMs();
        const surfaceFieldStartedMs = surfaceFilterSettledMs;
        if (canonicalFieldDemand.fieldRequested) {
            ensureWaterSurfaceField();
        }
        const surfaceFieldSettledMs = nowMs();
        const layerAwaitStartedMs = surfaceFieldSettledMs;
        if (layerLoadPromise && typeof layerLoadPromise.then === 'function') {
            await layerLoadPromise;
        }
        const layerAwaitSettledMs = nowMs();
        const waterLayerApplyState = waterEffectsLayerTransition.snapshot();
        if (
            layerFeaturesEnabled
            && waterLayerApplyState.ready !== true
            && !isRuntimeDisposed()
        ) {
            throw new Error(
                `ZEN_PIXI_WATER_EFFECTS_LAYER_UNAVAILABLE_FOR_FIRST_FRAME:${waterLayerApplyState.status}`,
            );
        }
        if (CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED && typeof prepareCanopyBeforeFirstDraw === 'function') {
            if (isRuntimeDisposed() || !layerFeaturesEnabled || waterLayerApplyState.ready !== true
                || waterEffectsLayer.topShadowObjects?.length !== 1) {
                throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_READY_LAYER_REQUIRED');
            }
            prepareCanopyBeforeFirstDraw(waterEffectsLayer.topShadowObjects[0].shader);
        }
        const layerInitMetrics = waterEffectsLayer?.initMetrics;
        const layerBottleneck = layerInitMetrics?.bottleneck;
        const layerTransitionTimings = waterLayerApplyState?.timings;
        const prepareSettledMs = nowMs();
        return {
            waterLayerRequested: layerFeaturesEnabled === true,
            waterLayerReady: layerFeaturesEnabled !== true || waterLayerApplyState.ready === true,
            waterLayerApply: waterLayerApplyState,
            surfaceFilterRequested: surfaceFeaturesEnabled === true,
            surfaceFilterReady: surfaceFeaturesEnabled !== true || waterSurfaceFilter !== null,
            surfaceFieldRequested: canonicalFieldDemand.fieldRequested,
            surfaceFieldReady: (
                canonicalFieldDemand.fieldRequested !== true
                || waterSurfaceField !== null
            ),
            preparationTimings: Object.freeze({
                totalMs: roundTimingMs(prepareSettledMs - prepareStartedMs),
                snapshotResolveMs: roundTimingMs(snapshotResolvedMs - snapshotResolveStartedMs),
                layerRequestMs: roundTimingMs(layerRequestSettledMs - layerRequestStartedMs),
                surfaceFilterEnsureMs: roundTimingMs(surfaceFilterSettledMs - surfaceFilterStartedMs),
                surfaceFieldEnsureMs: roundTimingMs(surfaceFieldSettledMs - surfaceFieldStartedMs),
                layerAwaitMs: roundTimingMs(layerAwaitSettledMs - layerAwaitStartedMs),
                layerTransitionTotalMs: roundTimingMs(layerTransitionTimings?.totalMs),
                layerFactoryLoadMs: roundTimingMs(layerTransitionTimings?.loadFactoryMs),
                layerBuildMs: roundTimingMs(layerTransitionTimings?.buildLayerMs),
                layerActivateMs: roundTimingMs(layerTransitionTimings?.activateLayerMs),
                layerInitTotalMs: roundTimingMs(layerInitMetrics?.totalMs),
                layerTextureBuildTotalMs: roundTimingMs(layerInitMetrics?.textureBuildTotalMs),
                layerTextureSetupMs: roundTimingMs(layerInitMetrics?.textureSetupMs),
                pebbleTextureBuildMs: roundTimingMs(
                    layerInitMetrics?.textureBuildMs?.pebbleTexture,
                ),
                pebbleDetailTextureBuildMs: roundTimingMs(
                    layerInitMetrics?.textureBuildMs?.pebbleTextureDetail,
                ),
                causticTextureBuildMs: roundTimingMs(
                    layerInitMetrics?.textureBuildMs?.causticTexture,
                ),
                mistTextureBuildMs: roundTimingMs(
                    layerInitMetrics?.textureBuildMs?.mistTexture,
                ),
                topShadowTextureBuildMs: roundTimingMs(
                    layerInitMetrics?.textureBuildMs?.topShadowShadowTexture,
                ),
                skyReflectionTextureBuildMs: roundTimingMs(
                    layerInitMetrics?.textureBuildMs?.skyReflectionWashTexture,
                ),
                layerTextureCacheHit: typeof layerInitMetrics?.cache?.hit === 'boolean'
                    ? layerInitMetrics.cache.hit
                    : null,
                layerTextureBottleneckStage: typeof layerBottleneck?.stage === 'string'
                    ? layerBottleneck.stage
                    : null,
                layerTextureBottleneckMs: roundTimingMs(layerBottleneck?.ms),
            }),
        };
    };

    const beginFrame = ({
        deltaMs,
        frameCount = 0,
    } = {}) => {
        const optimizationProfile = resolveOptimizationProfile();
        const {
            waterFrameState,
            frameChannels,
            cacheHit,
        } = frameSnapshotResolver.resolve();
        const worldPolicy = waterFrameState?.worldPolicy || null;
        const waterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
            waterFrameState?.tuning?.waterReflectionAlgorithm,
        );
        const canonicalSurfaceFieldSelected = isZenWaterSurfaceFieldAlgorithm(
            waterReflectionAlgorithm,
        );
        currentWaterReflectionAlgorithm = waterReflectionAlgorithm;
        currentWorldPolicy = worldPolicy;
        const layerFeaturesEnabled = hasWaterEffectsLayerFeatures(optimizationProfile, worldPolicy);
        const surfaceFeaturesEnabled = hasWaterSurfaceFilterFeatures(optimizationProfile, worldPolicy);
        const canonicalFieldDemand = resolveCanonicalSurfaceFieldDemand({
            optimizationProfile,
            worldPolicy,
            waterReflectionAlgorithm,
        });
        const surfaceEffectsDeferredForFirstFrame = (
            surfaceFeaturesEnabled === true
            && Math.max(0, Math.floor(Number(frameCount) || 0)) <= 1
        );

        const preFrameWaterLayerApplyState =
            waterEffectsLayerTransition.snapshot();
        const expectedLayerSignature = layerFeaturesEnabled
            ? buildWaterLayerSignature(optimizationProfile)
            : '';
        const failedTransitionStillCurrent = (
            preFrameWaterLayerApplyState.failed === true
            && (
                layerFeaturesEnabled
                    ? (
                        preFrameWaterLayerApplyState.requested === true
                        && preFrameWaterLayerApplyState.requestedSignature
                            === expectedLayerSignature
                    )
                    : (
                        preFrameWaterLayerApplyState.requested !== true
                        && preFrameWaterLayerApplyState.requestedSignature === ''
                    )
            )
        );
        let waterLayerApplyPromise = null;
        let waterLayerSyncError = null;
        if (!failedTransitionStillCurrent) {
            try {
                waterLayerApplyPromise = syncWaterEffectsLayerForOptimization(
                    optimizationProfile,
                    worldPolicy,
                );
            } catch (error) {
                waterLayerSyncError = error;
            }
        }
        if (waterLayerApplyPromise) {
            waterLayerApplyPromise.catch(() => {
                // The transition owns the failure state. The next frame throws it
                // synchronously while worker control callers await this same Promise.
            });
        }
        const waterLayerApplyState = waterEffectsLayerTransition.snapshot();
        if (waterLayerSyncError && waterLayerApplyState.failed !== true) {
            throw waterLayerSyncError;
        }
        if (
            waterLayerApplyState.failed === true
            && lastPublishedWaterLayerFailureGeneration
                === waterLayerApplyState.generation
        ) {
            throw new Error(
                `ZEN_PIXI_WATER_EFFECTS_LAYER_APPLY_FAILED:${waterLayerApplyState.error}`,
            );
        }
        if (surfaceFeaturesEnabled && surfaceEffectsDeferredForFirstFrame !== true) {
            ensureWaterSurfaceFilter(
                optimizationProfile,
                worldPolicy,
                waterReflectionAlgorithm,
            );
        } else {
            if (waterSurfaceFilterContainer) {
                waterSurfaceFilterContainer.filters = null;
            }
            if (!surfaceFeaturesEnabled) destroyWaterSurfaceFilter();
        }
        if (canonicalFieldDemand.fieldRequested) {
            ensureWaterSurfaceField();
        } else {
            destroyWaterSurfaceField();
        }
        if (ripplesContainer) {
            ripplesContainer.visible = (
                canonicalSurfaceFieldSelected !== true
                && resolvePixiSceneEntityRenderPlan(worldPolicy).ripples
            );
        }

        const layerTemporalProjectionRequired = (
            layerFeaturesEnabled
            || (surfaceFeaturesEnabled && !canonicalSurfaceFieldSelected)
        );
        if (layerTemporalProjectionRequired) {
            const nextWaterTemporalProjection = waterTemporalProjection.update({
                deltaMs,
                frameState: waterFrameState,
                frameChannels,
            });
            frameChannels.waterTemporalProjection = nextWaterTemporalProjection;
        } else {
            frameChannels.waterTemporalProjection = null;
        }

        return {
            optimizationProfile,
            effectDebugToggles: optimizationProfile?.debugToggles || EMPTY_OBJECT,
            surfaceEffectsEnabled: surfaceFeaturesEnabled && surfaceEffectsDeferredForFirstFrame !== true,
            surfaceEffectsRequested: surfaceFeaturesEnabled,
            surfaceEffectsDeferredForFirstFrame,
            waterFrameState,
            frameChannels,
            frameContractTuning: waterFrameState?.tuning || EMPTY_OBJECT,
            frameChannelsCacheHit: cacheHit,
            waterReflectionAlgorithm,
            canonicalSurfaceFieldSelected,
            waterLayerApplyState,
        };
    };

    const runEffectsPass = ({
        frameCount,
        renderTimeMs = null,
        visibleWorldBounds,
        deltaMs,
        frameState,
        frameChannels,
        frameContractTuning = EMPTY_OBJECT,
        optimizationProfile = null,
        surfaceEffectsEnabled = false,
        surfaceEffectsRequested = surfaceEffectsEnabled,
        surfaceEffectsDeferredForFirstFrame = false,
        effectDebugToggles = null,
        waterLayerApplyState = null,
    } = {}) => {
        const waterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
            frameContractTuning?.waterReflectionAlgorithm,
        );
        const canonicalFieldDemand = resolveCanonicalSurfaceFieldDemand({
            optimizationProfile,
            worldPolicy: frameState?.worldPolicy,
            waterReflectionAlgorithm,
            surfaceEffectsEnabled,
        });
        const canonicalSurfaceFieldActive = canonicalFieldDemand.fieldActive;
        let surfaceFieldProbe = null;
        koiCausticReceiver.active = false;
        koiCausticReceiver.texture = null;
        koiCausticReceiver.uniforms = null;
        koiCausticReceiver.width = sceneWidth;
        koiCausticReceiver.height = sceneHeight;
        if (canonicalSurfaceFieldActive) {
            if (
                canonicalFieldDemand.surfaceActive
                && !waterSurfaceFilter?.usesCanonicalSurfaceField
            ) {
                throw new Error('ZEN_PIXI_WATER_SURFACE_FIELD_FILTER_MISSING');
            }
            if (!surfaceDisturbancesRef || !Array.isArray(surfaceDisturbancesRef.current)) {
                throw new Error('ZEN_PIXI_WATER_SURFACE_DISTURBANCE_SOURCE_MISSING');
            }
            const surfaceField = ensureWaterSurfaceField();
            surfaceFieldProbe = surfaceField.update({
                deltaMs,
                frameCount,
                frameState,
                frameChannels,
                disturbances: surfaceDisturbancesRef.current,
            });
            if (canonicalFieldDemand.surfaceActive) {
                waterSurfaceFilter.setSurfaceFieldTexture(surfaceField.texture);
                waterSurfaceFilter.uniforms.uSurfaceFieldMap = surfaceField.domain.map;
                waterSurfaceFilter.applyFeatureToggleUniforms(effectDebugToggles);
            }
            benthicCausticOverlay.shader.uniforms.uSurfaceFieldMap = surfaceField.domain.map;
            const causticProbe = benthicCausticOverlay.update({
                texture: surfaceField.texture,
                frameState,
                frameChannels,
                enabled: canonicalFieldDemand.causticsRequested,
                intensityScale: clampNumber(
                    optimizationProfile?.effectIntensityScale,
                    0,
                    2,
                    effectIntensityScale,
                ),
            });
            if (causticProbe.active && visualRenderPlan.sunlight.connectedCaustics) {
                koiCausticReceiver.active = true;
                koiCausticReceiver.texture = surfaceField.texture;
                koiCausticReceiver.uniforms = benthicCausticOverlay.shader.uniforms;
            }
            surfaceFieldProbe = {
                ...surfaceFieldProbe,
                causticModelId: causticProbe.modelId,
                causticsRequested:
                    causticProbe.requested === true,
                causticsEnabled: causticProbe.active === true,
                causticsSuppressed:
                    causticProbe.suppressed === true,
                causticRequestedStrength:
                    causticProbe.requestedStrength,
                causticStrength: causticProbe.strength,
                causticDrawCount: causticProbe.drawCount,
                causticFieldTextureFetchesPerPixel:
                    causticProbe.fieldTextureFetchesPerPixel,
                causticReceiverModelId:
                    causticProbe.receiverModelId,
                causticReceiverTextureFetchesPerPixel:
                    causticProbe
                        .receiverTextureFetchesPerPixel,
                causticTotalTextureFetchesPerPixel:
                    causticProbe.totalTextureFetchesPerPixel,
                causticGateOff: causticProbe.gateOff,
                causticGateOn: causticProbe.gateOn,
                causticGateTransitionCount:
                    causticProbe.gateTransitionCount,
            };
        } else {
            if (
                waterSurfaceFilter?.usesCanonicalSurfaceField
                === true
            ) {
                waterSurfaceFilter.clearSurfaceFieldTexture();
            }
            benthicCausticOverlay?.disable?.();
        }
        const waterPassResult = updateSceneWaterEffectsPass({
            frameCount,
            renderTimeMs,
            visibleWorldBounds,
            deltaMs,
            frameContractTuning,
            waterFrameState: frameState,
            frameChannels,
            backgroundFxController,
            waterEffectsLayer,
            ensureWaterSurfaceFilter,
            optimizationProfile,
            surfaceEffectsEnabled,
            surfaceEffectsRequested,
            surfaceEffectsDeferredForFirstFrame,
            waterSurfaceFilter,
            surfaceFilters,
            surfaceFilterContainer: waterSurfaceFilterContainer,
            surfaceFilterAreaSize: waterSurfaceFilterAreaSize,
            effectIntensityScale,
            effectRevealProgress: resolveWaterEffectsRevealProgress(),
            effectDebugToggles,
            sceneCadenceProfile,
            waterPassProbeState,
            worldPolicy: frameState?.worldPolicy,
            waterReflectionAlgorithm,
            canonicalSurfaceFieldActive,
            surfaceFieldProbe,
            waterLayerApplyState: (
                waterLayerApplyState
                || waterEffectsLayerTransition.snapshot()
            ),
        });
        // The existing layer cadence must publish canopy pose/admission first.
        // All consumers borrow the same snapshot before the world draw, including
        // the koi uniforms already handed to entity sync by reference.
        if (canonicalSurfaceFieldActive) {
            const canopy = waterEffectsLayer.topShadowObjects[0] ?? null;
            if (canopy && !waterLightTransport) waterLightTransport = new ZenWaterLightTransport(renderer);
            if (waterLightTransport) waterLightTransport.update(canopy, visibleWorldBounds, sceneWidth, sceneHeight);
            bindZenWaterLightTransport(benthicCausticOverlay.shader.uniforms, waterLightTransport);
            if (canonicalFieldDemand.surfaceActive) bindZenWaterLightTransport(waterSurfaceFilter.uniforms, waterLightTransport);
        }
        lastWaterEffectsProbe = waterPassResult.lastWaterEffectsProbe;
        if (lastWaterEffectsProbe) {
            const transportActive = canonicalSurfaceFieldActive && waterLightTransport?.active === true;
            lastWaterEffectsProbe.waterLightTransportActive = transportActive;
            lastWaterEffectsProbe.waterLightTransportDrawCount = canonicalSurfaceFieldActive ? (waterLightTransport?.drawCount ?? 0) : 0;
            lastWaterEffectsProbe.waterLightTransportTextureBytes = waterLightTransport
                ? waterLightTransport.texture.width * waterLightTransport.texture.height * 4 : 0;
            lastWaterEffectsProbe.surfaceFieldTextureWidth = surfaceFieldProbe?.textureWidth ?? 0;
            lastWaterEffectsProbe.surfaceFieldTextureHeight = surfaceFieldProbe?.textureHeight ?? 0;
            lastWaterEffectsProbe.waterLightTransportSurfaceReads = transportActive && canonicalFieldDemand.surfaceActive ? 1 : 0;
            lastWaterEffectsProbe.waterLightTransportCausticReads = transportActive && surfaceFieldProbe?.causticsEnabled ? 2 : 0;
            lastWaterEffectsProbe.surfaceFieldCausticTotalTextureFetchesPerPixel = surfaceFieldProbe?.causticsEnabled
                ? surfaceFieldProbe.causticTotalTextureFetchesPerPixel + lastWaterEffectsProbe.waterLightTransportCausticReads : 0;
        }
        if (waterLayerApplyState?.failed === true) {
            lastPublishedWaterLayerFailureGeneration =
                waterLayerApplyState.generation;
        }
        if (lastWaterEffectsProbe && typeof lastWaterEffectsProbe === 'object') {
            lastWaterEffectsProbe.waterBenthicContainerAlpha = Number(waterBenthicContainer?.alpha) || 0;
            lastWaterEffectsProbe.frameBottomVisibility = Number(frameChannels?.bottomVisibility) || 0;
            lastWaterEffectsProbe.frameSceneBrightness = Number(frameChannels?.sceneBrightness) || 0;
            lastWaterEffectsProbe.frameDaylight = Number(frameChannels?.daylight) || 0;
        }
        return {
            lastWaterEffectsProbe,
            waterPassPlan: waterPassResult.waterPassPlan,
            koiCausticReceiver,
            surfaceMaterialLightingActive: (
                canonicalFieldDemand.surfaceActive === true
                && waterSurfaceFilter?.usesCanonicalSurfaceField === true
                && waterSurfaceFilterContainer?.filters?.includes(waterSurfaceFilter) === true
            ),
        };
    };

    const dispose = () => {
        disposed = true;
        koiCausticReceiver.active = false;
        koiCausticReceiver.texture = null;
        koiCausticReceiver.uniforms = null;
        const cleanupErrors = [];
        const cleanup = (operation) => {
            try {
                operation();
            } catch (error) {
                cleanupErrors.push(error);
            }
        };
        cleanup(() => waterEffectsLayerTransition.dispose());
        cleanup(() => destroyWaterSurfaceField());
        cleanup(() => backgroundFxController.destroy());
        cleanup(() => waterTemporalProjection.dispose());
        cleanup(() => destroyWaterSurfaceFilter());
        cleanup(() => frameSnapshotResolver.invalidate());
        if (cleanupErrors.length > 0) {
            throw new AggregateError(
                cleanupErrors,
                'ZEN_PIXI_WATER_PRESENTATION_DISPOSE_FAILED',
            );
        }
    };

    return {
        prepareFirstFrameAssets,
        resizeWorld: (width, height) => {
            sceneWidth = width;
            sceneHeight = height;
            backgroundFxController.resize(width, height);
            if (waterEffectsLayer !== noopWaterEffectsLayer) waterEffectsLayer.resize(width, height);
            if (waterSurfaceField) {
                waterSurfaceField.resize(width, height);
                benthicCausticOverlay.destroy();
                createBenthicOverlay();
            }
            frameSnapshotResolver.invalidate();
        },
        beginFrame,
        runEffectsPass,
        dispose,
        getLastWaterEffectsProbe: () => lastWaterEffectsProbe,
        getWaterEffectsLayerApplyState: waterEffectsLayerTransition.snapshot,
        syncWaterEffectsLayerForRuntimeParams,
        resolveOptimizationProfile,
        hasWaterEffectsLayerFeatures,
        hasWaterSurfaceFilterFeatures,
    };
};
