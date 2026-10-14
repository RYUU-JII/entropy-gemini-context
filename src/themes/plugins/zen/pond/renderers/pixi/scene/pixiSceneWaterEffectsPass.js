import {
    BASE_SCENE_CADENCE_PROFILE,
    resolvePixiSceneWaterPassPlan,
} from '../pixiSceneCadencePolicy.js';
import { resolvePixiSceneEffectRenderPlan } from '../pixiSceneWorldPolicy.js';
import {
    readZenWaterSurfaceFieldRainModelId,
} from '../../../contracts/zenWaterSurfaceFieldRainModel.js';
import {
    readZenWaterSurfaceFieldYoonseulModelId,
} from '../../../contracts/zenWaterSurfaceFieldYoonseulModel.js';
import {
    readZenPondBenthicMaterialOwnerId,
} from '../../../contracts/zenPondBenthicMaterial.js';
import {
    readZenPondCausticReceiverModelId,
    readZenPondCausticPresentationModelId,
    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS,
} from '../../../contracts/zenPondCausticPresentation.js';

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(4));
};

const readUniformNumber = (uniforms, key, fallback = 0) => {
    const numeric = Number(uniforms?.[key]);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const readUniformBoolean = (uniforms, key) => (
    readUniformNumber(uniforms, key, 0) > 0.5
);

const buildWaterEffectsDisabledProbe = (reason = 'water_effects_disabled') => ({
    visible: false,
    topShadowVisible: false,
    cloudsVisible: false,
    cloudsOnscreenVisible: false,
    textureBakeSupported: true,
    reason,
    godRaysGate: 0,
    stagedRayGate: 0,
    surfaceOpticsGate: 0,
    benthicGate: 0,
    causticGate: 0,
    highlightsGate: 0,
    cloudReflectionToggleGate: 0,
    cloudReflectionComputeEnabled: false,
    atmosphereGate: 0,
    komorebiModelId: null,
    komorebiRequested: false,
    komorebiActive: false,
    komorebiAlpha: 0,
    komorebiMaximumAlpha: 0,
    komorebiTextureAllocated: false,
    komorebiTextureSize: 0,
    komorebiRawTextureBytes: 0,
    komorebiTextureBuildMs: null,
    komorebiMaskCoverageRatio: 0,
    komorebiMaskPatchCount: 0,
    komorebiDrawCount: 0,
    komorebiTextureBakeSupported: false,
    komorebiReason: reason,
    komorebiDaylightGate: 0,
    komorebiDirectLightGate: 0,
    komorebiWeatherGate: 0,
    daylightCurve: 0,
    sunOp: 0,
    sunlightIntensity: 0,
    baseOpTarget: 0,
    primaryAlpha: 0,
    shadowAlpha: 0,
    combinedAlpha: 0,
    mirrorStrength: 0,
    bottomVisibility: 0,
    pebbleAlpha: 0,
    pebbleDetailAlpha: 0,
    benthicOwnerId: null,
    benthicSourceSpriteCount: 0,
    benthicVisibleSpriteCount: 0,
    benthicPrimaryAlphaScale: 0,
    benthicDetailAlphaScale: 0,
    refractedGuideAlpha: 0,
    causticPrimaryAlpha: 0,
    causticSecondaryAlpha: 0,
    highlightPrimaryAlpha: 0,
    highlightMicroAlpha: 0,
    atmosphereAlpha: 0,
    materialBaseFullUpdate: false,
    surfaceUniformFullUpdate: false,
    surfaceFieldYoonseulModelId: null,
    yoonseulTopViewBlendMin: 0,
    yoonseulTopViewBlendMax: 0,
    yoonseulCoverageRoughnessMin: 0,
    yoonseulCoverageRoughnessMax: 0,
    yoonseulCoverageWeightUnfocused: 0,
    yoonseulCoverageWeightFocused: 0,
    surfaceNormalEnabled: false,
    screenRefractionEnabled: false,
    surfaceReflectionEnabled: false,
    surfaceFieldCausticModelId: null,
    surfaceFieldCausticsRequested: false,
    surfaceFieldCausticsEnabled: false,
    surfaceFieldCausticsSuppressed: false,
    surfaceFieldCausticRequestedStrength: 0,
    surfaceFieldCausticStrength: 0,
    surfaceFieldCausticDrawCount: 0,
    surfaceFieldCausticFieldTextureFetchesPerPixel: 0,
    surfaceFieldCausticGateOff: 0,
    surfaceFieldCausticGateOn: 0,
    surfaceFieldCausticGateTransitionCount: 0,
    koiWakeDisturbanceRequested: false,
    tapDisturbanceRequested: false,
    petalDisturbanceRequested: false,
    surfaceFieldDisturbanceSourceCounts: null,
});

export const updateSceneWaterEffectsPass = ({
    frameCount,
    renderTimeMs = null,
    visibleWorldBounds,
    deltaMs,
    frameContractTuning,
    waterFrameState,
    frameChannels,
    backgroundFxController,
    waterEffectsLayer,
    ensureWaterSurfaceFilter,
    optimizationProfile = null,
    surfaceEffectsEnabled,
    surfaceEffectsRequested = surfaceEffectsEnabled,
    surfaceEffectsDeferredForFirstFrame = false,
    waterSurfaceFilter,
    surfaceFilters = null,
    surfaceFilterContainer = null,
    surfaceFilterAreaSize = null,
    effectIntensityScale,
    effectRevealProgress = 1,
    effectDebugToggles = null,
    sceneCadenceProfile = null,
    waterPassProbeState = null,
    worldPolicy = null,
    waterReflectionAlgorithm = null,
    canonicalSurfaceFieldActive = false,
    surfaceFieldProbe = null,
    waterLayerApplyState = null,
}) => {
    const effectPlan = resolvePixiSceneEffectRenderPlan(worldPolicy || waterFrameState);
    const waterPassPlan = resolvePixiSceneWaterPassPlan({
        frameCount,
        renderTimeMs,
        previousRenderTimeMs: waterPassProbeState?.lastCadenceRenderTimeMs,
        forceUpdate: !waterPassProbeState?.lastWaterEffectsProbe,
        sceneCadenceProfile: sceneCadenceProfile || BASE_SCENE_CADENCE_PROFILE,
    });
    if (waterPassProbeState) {
        // Cadence history advances on every render, even when probe publication
        // is skipped. Otherwise a sampled probe would replay old due slots.
        waterPassProbeState.lastCadenceRenderTimeMs = renderTimeMs;
    }
    const layerEffectsEnabled = (
        optimizationProfile?.water?.layerEffectsEnabled === true
        && effectPlan.waterLayer
    );
    const hasWaterLayerApplyState = Boolean(
        waterLayerApplyState
        && typeof waterLayerApplyState === 'object',
    );
    const waterLayerApplyStatus = hasWaterLayerApplyState
        ? waterLayerApplyState.status
        : (layerEffectsEnabled ? 'missing' : 'disabled');
    const waterLayerApplyReady = (
        hasWaterLayerApplyState !== true
            ? layerEffectsEnabled !== true
            : (layerEffectsEnabled !== true
                ? waterLayerApplyStatus === 'disabled'
                : (
                waterLayerApplyState?.ready === true
                && waterLayerApplyState?.requested === true
                && waterLayerApplyState?.requestedSignature
                    === waterLayerApplyState?.activeSignature
                ))
    );
    const activeLayerEffectsEnabled = (
        layerEffectsEnabled
        && waterLayerApplyReady
    );
    const resolvedSurfaceEffectsEnabled = (
        surfaceEffectsEnabled === true
        && effectPlan.waterSurfaceFilter
    );
    const requestedSurfaceEffectsEnabled = (
        surfaceEffectsRequested === true
        && effectPlan.waterSurfaceFilter
    );
    const shouldSampleProbe = (
        !waterPassProbeState
        || !waterPassProbeState.lastWaterEffectsProbe
        || waterPassProbeState.lastLayerEffectsEnabled !== layerEffectsEnabled
        || waterPassProbeState.lastSurfaceEffectsEnabled !== resolvedSurfaceEffectsEnabled
        || waterPassProbeState.lastCanonicalSurfaceFieldActive !== canonicalSurfaceFieldActive
        || waterPassProbeState.lastWaterLayerApplyGeneration
            !== waterLayerApplyState?.generation
        || waterPassProbeState.lastWaterLayerApplyStatus
            !== waterLayerApplyStatus
        || waterPassPlan.runWaterProbeUpdate
    );
    const backgroundFxStartMs = shouldSampleProbe ? nowMs() : 0;
    backgroundFxController.update(frameChannels, {
        fullUpdate: waterPassPlan.runFullBackgroundUpdate,
        dynamicUpdate: waterPassPlan.runBackgroundDynamicUpdate,
        worldPolicy: worldPolicy || waterFrameState?.worldPolicy,
    });
    const backgroundFxTickMs = shouldSampleProbe
        ? Math.max(0, nowMs() - backgroundFxStartMs)
        : Number(waterPassProbeState?.lastTimings?.backgroundFxTickMs) || 0;
    let waterEffectsTickMs = 0;
    const waterEffectsProbe = activeLayerEffectsEnabled
        ? (() => {
            const waterEffectsStartMs = shouldSampleProbe ? nowMs() : 0;
            const probe = waterEffectsLayer.tick(deltaMs, waterFrameState, frameChannels, {
                visibleWorldBounds,
                fullUpdate: waterPassPlan.runFullEffectsUpdate,
                cloudReflectionFullUpdate: waterPassPlan.runCloudReflectionUpdate,
                atmosphereFullUpdate: waterPassPlan.runAtmosphereUpdate,
                topShadowFullUpdate: waterPassPlan.runTopShadowUpdate,
                probeFullUpdate: waterPassPlan.runWaterProbeUpdate,
                effectRevealProgress,
                canonicalSurfaceFieldActive,
            });
            waterEffectsTickMs = shouldSampleProbe
                ? Math.max(0, nowMs() - waterEffectsStartMs)
                : Number(waterPassProbeState?.lastTimings?.waterEffectsTickMs) || 0;
            return probe;
        })()
        : null;
    if (resolvedSurfaceEffectsEnabled) {
        ensureWaterSurfaceFilter(
            optimizationProfile,
            worldPolicy || waterFrameState?.worldPolicy,
            waterReflectionAlgorithm,
        );
    }

    let waterSurfaceFilterTickMs = 0;
    let waterSurfaceReflectionProbe = null;
    if (
        resolvedSurfaceEffectsEnabled
        && waterSurfaceFilter
        && surfaceFilters
        && surfaceFilterContainer
        && surfaceFilterAreaSize
    ) {
        if (surfaceFilterContainer.filters !== surfaceFilters) {
            surfaceFilterContainer.filters = surfaceFilters;
        }
        const waterSurfaceStartMs = shouldSampleProbe ? nowMs() : 0;
        const filterUpdateProbe = waterSurfaceFilter.update(
            deltaMs,
            surfaceFilterAreaSize.width,
            surfaceFilterAreaSize.height,
            frameContractTuning,
            effectIntensityScale,
            waterFrameState,
            frameChannels,
            effectDebugToggles,
            surfaceFilterAreaSize,
            {
                fullUpdate: waterPassPlan.runSurfaceUniformUpdate,
            },
        );
        waterSurfaceFilterTickMs = shouldSampleProbe
            ? Math.max(0, nowMs() - waterSurfaceStartMs)
            : Number(waterPassProbeState?.lastTimings?.waterSurfaceFilterTickMs) || 0;
        const uniforms = waterSurfaceFilter.uniforms || {};
        if (canonicalSurfaceFieldActive && waterSurfaceFilter.usesCanonicalSurfaceField === true) {
            const canonicalProbe = filterUpdateProbe || waterSurfaceFilter.lastProbe || {};
            const fieldTime = Number(surfaceFieldProbe?.time) || 0;
            const previousFieldTime = Number(waterPassProbeState?.lastYoonseulTime);
            waterSurfaceReflectionProbe = {
                ...canonicalProbe,
                time: fieldTime,
                timeDelta: Number.isFinite(previousFieldTime)
                    ? Math.max(0, fieldTime - previousFieldTime)
                    : 0,
                waterTime: fieldTime,
            };
        } else {
            const yoonseulTime = readUniformNumber(uniforms, 'uYoonseulTime');
            const previousYoonseulTime = Number(waterPassProbeState?.lastYoonseulTime);
            const yoonseulTimeDelta = Number.isFinite(previousYoonseulTime)
                ? Math.max(0, yoonseulTime - previousYoonseulTime)
                : 0;
            const yoonseulIntensity = readUniformNumber(uniforms, 'uYoonseulIntensity');
            const yoonseulOpacity = readUniformNumber(uniforms, 'uYoonseulOpacity');
            waterSurfaceReflectionProbe = {
                pipelineMode: typeof waterSurfaceFilter.pipelineMode === 'string'
                    ? waterSurfaceFilter.pipelineMode
                    : '',
                algorithmMode: readUniformNumber(uniforms, 'uYoonseulAlgorithmMode'),
                stability: readUniformNumber(uniforms, 'uYoonseulStability'),
                spatialStability: readUniformNumber(uniforms, 'uYoonseulSpatialStability'),
                detailStability: readUniformNumber(uniforms, 'uYoonseulDetailStability'),
                temporalStability: readUniformNumber(uniforms, 'uYoonseulTemporalStability'),
                softKnee: readUniformNumber(uniforms, 'uYoonseulSoftKnee'),
                time: yoonseulTime,
                timeDelta: yoonseulTimeDelta,
                waterTime: readUniformNumber(uniforms, 'uTime'),
                intensity: yoonseulIntensity,
                opacity: yoonseulOpacity,
                drive: yoonseulIntensity * yoonseulOpacity,
                patchScale: readUniformNumber(uniforms, 'uYoonseulPatchScale'),
                motion: readUniformNumber(uniforms, 'uYoonseulMotion'),
                flickerAmount: readUniformNumber(uniforms, 'uYoonseulFlickerAmount'),
                temporalCoherence: readUniformNumber(uniforms, 'uYoonseulTemporalCoherence'),
                lowBand: readUniformNumber(uniforms, 'uYoonseulLowBand'),
                microBand: readUniformNumber(uniforms, 'uYoonseulMicroBand'),
                glintStability: readUniformNumber(uniforms, 'uYoonseulGlintStability'),
                beatDamping: readUniformNumber(uniforms, 'uYoonseulBeatDamping'),
                yoonseulEnabled: readUniformBoolean(uniforms, 'uYoonseulEnabled'),
                surfaceOpticsEnabled: readUniformBoolean(uniforms, 'uSurfaceOpticsEnabled'),
                surfaceNormalEnabled: readUniformBoolean(uniforms, 'uSurfaceNormalEnabled'),
                screenRefractionEnabled: readUniformBoolean(uniforms, 'uScreenRefractionEnabled'),
                surfaceReflectionEnabled: readUniformBoolean(uniforms, 'uSurfaceReflectionEnabled'),
                rgbSplitEnabled: readUniformBoolean(uniforms, 'uRgbSplitEnabled'),
                surfaceFieldReady: readUniformBoolean(uniforms, 'uSurfaceFieldReady'),
                surfaceFieldCausticsEnabled: readUniformBoolean(uniforms, 'uSurfaceFieldCausticsEnabled'),
            };
        }
    } else if (surfaceFilterContainer?.filters) {
        surfaceFilterContainer.filters = null;
    }

    const previousProbe = waterPassProbeState?.lastWaterEffectsProbe || null;
    if (!shouldSampleProbe && previousProbe && typeof previousProbe === 'object') {
        return {
            lastWaterEffectsProbe: previousProbe,
            waterPassPlan,
        };
    }

    const rawWaterEffectsProbe = (
        waterEffectsProbe && typeof waterEffectsProbe === 'object'
            ? waterEffectsProbe
            : (activeLayerEffectsEnabled && typeof waterEffectsLayer.getTopShadowProbe === 'function'
                ? waterEffectsLayer.getTopShadowProbe()
                : (
                    waterLayerApplyReady !== true
                    && typeof waterLayerApplyState?.activeSignature === 'string'
                    && waterLayerApplyState.activeSignature
                    && previousProbe
                        ? previousProbe
                        : null
                ))
    );
    const resolveWaterLayerProbeReason = () => {
        if (waterLayerApplyStatus === 'failed') {
            return layerEffectsEnabled
                ? 'water_layer_apply_failed'
                : 'water_layer_disable_failed';
        }
        if (layerEffectsEnabled) {
            if (waterLayerApplyStatus === 'loading') {
                return 'water_layer_apply_pending';
            }
            if (waterLayerApplyStatus === 'missing') {
                return 'water_layer_apply_state_missing';
            }
            if (waterLayerApplyReady !== true) {
                return 'water_layer_signature_mismatch';
            }
            return 'water_layer_probe_unavailable';
        }
        if (!effectPlan.waterLayer) {
            return 'world_policy_water_layer_disabled';
        }
        return optimizationProfile?.water?.effectsEnabled === true
            ? 'water_layer_effects_disabled'
            : 'water_effects_disabled';
    };
    const lastWaterEffectsProbe = (
        rawWaterEffectsProbe && typeof rawWaterEffectsProbe === 'object'
            ? rawWaterEffectsProbe
            : buildWaterEffectsDisabledProbe(
                resolveWaterLayerProbeReason(),
            )
    );

    const nextProbe = (
        lastWaterEffectsProbe && typeof lastWaterEffectsProbe === 'object'
            ? {
                ...lastWaterEffectsProbe,
                reason: (
                    waterLayerApplyReady !== true
                    && (
                        layerEffectsEnabled
                        || waterLayerApplyStatus === 'failed'
                    )
                        ? resolveWaterLayerProbeReason()
                        : lastWaterEffectsProbe.reason
                ),
                backgroundFxTickMs: roundMs(backgroundFxTickMs),
                waterEffectsTickMs: roundMs(waterEffectsTickMs),
                waterSurfaceFilterTickMs: roundMs(waterSurfaceFilterTickMs),
                surfacePipelineMode: typeof waterSurfaceReflectionProbe?.pipelineMode === 'string'
                    ? waterSurfaceReflectionProbe.pipelineMode
                    : '',
                effectRevealProgress: roundMs(effectRevealProgress),
                waterReflectionAlgorithmMode: roundMs(waterSurfaceReflectionProbe?.algorithmMode),
                waterReflectionStability: roundMs(waterSurfaceReflectionProbe?.stability),
                waterReflectionSpatialStability: roundMs(waterSurfaceReflectionProbe?.spatialStability),
                waterReflectionDetailStability: roundMs(waterSurfaceReflectionProbe?.detailStability),
                waterReflectionTemporalStability: roundMs(waterSurfaceReflectionProbe?.temporalStability),
                waterReflectionSoftKnee: roundMs(waterSurfaceReflectionProbe?.softKnee),
                yoonseulTime: roundMs(waterSurfaceReflectionProbe?.time),
                yoonseulTimeDelta: roundMs(waterSurfaceReflectionProbe?.timeDelta),
                yoonseulWaterTime: roundMs(waterSurfaceReflectionProbe?.waterTime),
                yoonseulIntensity: roundMs(waterSurfaceReflectionProbe?.intensity),
                yoonseulOpacity: roundMs(waterSurfaceReflectionProbe?.opacity),
                yoonseulDrive: roundMs(waterSurfaceReflectionProbe?.drive),
                surfaceFieldRainVisibilityDrive: roundMs(
                    waterSurfaceReflectionProbe?.rainRippleVisibilityDrive,
                ),
                yoonseulFocus: roundMs(waterSurfaceReflectionProbe?.focus),
                surfaceMaterialRoughness: roundMs(waterSurfaceReflectionProbe?.roughness),
                surfacePhaseRate: roundMs(waterSurfaceReflectionProbe?.phaseRate),
                yoonseulPatchScale: roundMs(waterSurfaceReflectionProbe?.patchScale),
                yoonseulMotion: roundMs(waterSurfaceReflectionProbe?.motion),
                yoonseulFlickerAmount: roundMs(waterSurfaceReflectionProbe?.flickerAmount),
                yoonseulTemporalCoherence: roundMs(waterSurfaceReflectionProbe?.temporalCoherence),
                yoonseulLowBand: roundMs(waterSurfaceReflectionProbe?.lowBand),
                yoonseulMicroBand: roundMs(waterSurfaceReflectionProbe?.microBand),
                yoonseulGlintStability: roundMs(waterSurfaceReflectionProbe?.glintStability),
                yoonseulBeatDamping: roundMs(waterSurfaceReflectionProbe?.beatDamping),
                yoonseulEnabled: waterSurfaceReflectionProbe?.yoonseulEnabled === true,
                cloudReflectionEnabled: waterSurfaceReflectionProbe?.cloudReflectionEnabled === true,
                cloudReflectionSourceOwner: canonicalSurfaceFieldActive ? 'surface_field' : null,
                cloudFieldSeed: waterSurfaceReflectionProbe?.cloudFieldSeed,
                cloudFieldTextureCount: roundMs(waterSurfaceReflectionProbe?.cloudFieldTextureCount),
                cloudFieldTextureBytes: roundMs(waterSurfaceReflectionProbe?.cloudFieldTextureBytes),
                cloudReflectionAdditionalPasses: roundMs(waterSurfaceReflectionProbe?.cloudReflectionAdditionalPasses),
                sunTransmission: roundMs(waterSurfaceReflectionProbe?.sunTransmission),
                directSunlight: roundMs(waterSurfaceReflectionProbe?.directSunlight),
                diffuseSkylight: roundMs(waterSurfaceReflectionProbe?.diffuseSkylight),
                sceneBrightness: roundMs(waterSurfaceReflectionProbe?.sceneBrightness),
                benthicOwnerId:
                    readZenPondBenthicMaterialOwnerId(
                        lastWaterEffectsProbe?.benthicOwnerId,
                        {
                            required: (
                                Number(
                                    lastWaterEffectsProbe
                                        ?.benthicSourceSpriteCount,
                                ) > 0
                                || Number(
                                    lastWaterEffectsProbe?.benthicGate,
                                ) > 0
                            ),
                        },
                    ),
                benthicSourceSpriteCount: Math.max(
                    0,
                    Math.floor(
                        Number(
                            lastWaterEffectsProbe
                                ?.benthicSourceSpriteCount,
                        ) || 0,
                    ),
                ),
                benthicVisibleSpriteCount: Math.max(
                    0,
                    Math.floor(
                        Number(
                            lastWaterEffectsProbe
                                ?.benthicVisibleSpriteCount,
                        ) || 0,
                    ),
                ),
                benthicPrimaryAlphaScale: roundMs(
                    lastWaterEffectsProbe?.benthicPrimaryAlphaScale,
                ),
                benthicDetailAlphaScale: roundMs(
                    lastWaterEffectsProbe?.benthicDetailAlphaScale,
                ),
                surfaceOpticsEnabled: waterSurfaceReflectionProbe?.surfaceOpticsEnabled === true,
                surfaceNormalEnabled: waterSurfaceReflectionProbe?.surfaceNormalEnabled === true,
                screenRefractionEnabled: waterSurfaceReflectionProbe?.screenRefractionEnabled === true,
                surfaceReflectionEnabled: waterSurfaceReflectionProbe?.surfaceReflectionEnabled === true,
                rgbSplitEnabled: waterSurfaceReflectionProbe?.rgbSplitEnabled === true,
                surfaceFieldActive: canonicalSurfaceFieldActive === true,
                surfaceFieldReady: surfaceFieldProbe?.active === true,
                surfaceFieldYoonseulModelId:
                    readZenWaterSurfaceFieldYoonseulModelId(
                        waterSurfaceReflectionProbe?.yoonseulModelId,
                        {
                            required: (
                                canonicalSurfaceFieldActive === true
                                && waterSurfaceReflectionProbe
                                    ?.yoonseulEnabled === true
                            ),
                        },
                    ),
                yoonseulTopViewBlendMin: roundMs(
                    waterSurfaceReflectionProbe?.yoonseulTopViewBlendMin,
                ),
                yoonseulTopViewBlendMax: roundMs(
                    waterSurfaceReflectionProbe?.yoonseulTopViewBlendMax,
                ),
                yoonseulCoverageRoughnessMin: roundMs(
                    waterSurfaceReflectionProbe
                        ?.yoonseulCoverageRoughnessMin,
                ),
                yoonseulCoverageRoughnessMax: roundMs(
                    waterSurfaceReflectionProbe
                        ?.yoonseulCoverageRoughnessMax,
                ),
                yoonseulCoverageWeightUnfocused: roundMs(
                    waterSurfaceReflectionProbe
                        ?.yoonseulCoverageWeightUnfocused,
                ),
                yoonseulCoverageWeightFocused: roundMs(
                    waterSurfaceReflectionProbe
                        ?.yoonseulCoverageWeightFocused,
                ),
                surfaceFieldRainModelId: readZenWaterSurfaceFieldRainModelId(
                    surfaceFieldProbe?.rainModelId,
                    {
                        required: (
                            canonicalSurfaceFieldActive === true
                            || surfaceFieldProbe?.active === true
                        ),
                    },
                ),
                surfaceFieldCausticModelId:
                    readZenPondCausticPresentationModelId(
                        surfaceFieldProbe?.causticModelId,
                        {
                            required: (
                                surfaceFieldProbe
                                    ?.causticsRequested === true
                            ),
                        },
                    ),
                surfaceFieldCausticsRequested:
                    surfaceFieldProbe?.causticsRequested === true,
                surfaceFieldCausticsEnabled:
                    surfaceFieldProbe?.causticsEnabled === true,
                surfaceFieldCausticsSuppressed:
                    surfaceFieldProbe?.causticsSuppressed === true,
                surfaceFieldCausticRequestedStrength: roundMs(
                    surfaceFieldProbe
                        ?.causticRequestedStrength,
                ),
                surfaceFieldCausticStrength: roundMs(surfaceFieldProbe?.causticStrength),
                surfaceFieldCausticDrawCount: Math.max(
                    0,
                    Math.floor(
                        Number(
                            surfaceFieldProbe?.causticDrawCount,
                        ) || 0,
                    ),
                ),
                surfaceFieldCausticFieldTextureFetchesPerPixel:
                    Math.max(
                        0,
                        Math.floor(
                            Number(
                                surfaceFieldProbe
                                    ?.causticFieldTextureFetchesPerPixel,
                            ) || 0,
                        ),
                    ),
                surfaceFieldCausticReceiverModelId:
                    readZenPondCausticReceiverModelId(
                        surfaceFieldProbe
                            ?.causticReceiverModelId,
                        {
                            required: (
                                surfaceFieldProbe
                                    ?.causticModelId
                                === ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS
                                    .CONNECTED_SUNWEB
                                && surfaceFieldProbe
                                    ?.causticsRequested === true
                            ),
                        },
                    ),
                surfaceFieldCausticReceiverTextureFetchesPerPixel:
                    Math.max(
                        0,
                        Math.floor(
                            Number(
                                surfaceFieldProbe
                                    ?.causticReceiverTextureFetchesPerPixel,
                            ) || 0,
                        ),
                    ),
                surfaceFieldCausticTotalTextureFetchesPerPixel:
                    Math.max(
                        0,
                        Math.floor(
                            Number(
                                surfaceFieldProbe
                                    ?.causticTotalTextureFetchesPerPixel,
                            ) || 0,
                        ),
                    ),
                surfaceFieldCausticGateOff: roundMs(
                    surfaceFieldProbe?.causticGateOff,
                ),
                surfaceFieldCausticGateOn: roundMs(
                    surfaceFieldProbe?.causticGateOn,
                ),
                surfaceFieldCausticGateTransitionCount:
                    Math.max(
                        0,
                        Math.floor(
                            Number(
                                surfaceFieldProbe
                                    ?.causticGateTransitionCount,
                            ) || 0,
                        ),
                    ),
                surfaceFieldWidth: Math.max(0, Math.floor(Number(surfaceFieldProbe?.width) || 0)),
                surfaceFieldHeight: Math.max(0, Math.floor(Number(surfaceFieldProbe?.height) || 0)),
                surfaceFieldCadenceTier: typeof surfaceFieldProbe?.cadenceTier === 'string'
                    ? surfaceFieldProbe.cadenceTier
                    : '',
                surfaceFieldDisturbanceCount: Math.max(0, Math.floor(Number(surfaceFieldProbe?.disturbanceCount) || 0)),
                surfaceFieldDisturbanceCandidateCount: Math.max(
                    0,
                    Math.floor(Number(surfaceFieldProbe?.disturbanceCandidateCount) || 0),
                ),
                surfaceFieldDisturbanceDroppedCount: Math.max(
                    0,
                    Math.floor(Number(surfaceFieldProbe?.disturbanceDroppedCount) || 0),
                ),
                koiWakeDisturbanceRequested:
                    effectDebugToggles
                        ?.koiWakeDisturbanceEnabled === true,
                tapDisturbanceRequested:
                    effectDebugToggles
                        ?.tapDisturbanceEnabled === true,
                petalDisturbanceRequested:
                    effectDebugToggles
                        ?.petalDisturbanceEnabled === true,
                surfaceFieldDisturbanceSourceCounts:
                    surfaceFieldProbe
                        ?.disturbanceSourceCounts
                    && typeof surfaceFieldProbe
                        .disturbanceSourceCounts === 'object'
                        ? {
                            candidate: {
                                ...surfaceFieldProbe
                                    .disturbanceSourceCounts
                                    .candidate,
                            },
                            selected: {
                                ...surfaceFieldProbe
                                    .disturbanceSourceCounts
                                    .selected,
                            },
                            dropped: {
                                ...surfaceFieldProbe
                                    .disturbanceSourceCounts
                                    .dropped,
                            },
                        }
                        : null,
                surfaceFieldRainIntensity: roundMs(surfaceFieldProbe?.rainIntensity),
                surfaceFieldRainRippleTargetBudget: Math.max(
                    0,
                    Math.floor(Number(surfaceFieldProbe?.rainRippleTargetBudget) || 0),
                ),
                surfaceFieldRainRippleCellCount: Math.max(
                    0,
                    Math.floor(Number(surfaceFieldProbe?.rainRippleCellCount) || 0),
                ),
                surfaceFieldRainCandidateEvaluationsPerPixel: Math.max(
                    0,
                    Math.floor(Number(surfaceFieldProbe?.rainCandidateEvaluationsPerPixel) || 0),
                ),
                weatherRegime: typeof frameChannels?.weatherRegime === 'string'
                    ? frameChannels.weatherRegime
                    : '',
                weatherEventScheduled: frameChannels?.weatherEventScheduled === true,
                weatherEventActive: frameChannels?.weatherEventActive === true,
                weatherEventId: typeof frameChannels?.weatherEventId === 'string'
                    ? frameChannels.weatherEventId
                    : '',
                weatherEventKind: typeof frameChannels?.weatherEventKind === 'string'
                    ? frameChannels.weatherEventKind
                    : '',
                weatherEventPhase: typeof frameChannels?.weatherEventPhase === 'string'
                    ? frameChannels.weatherEventPhase
                    : '',
                weatherEventProgress: roundMs(frameChannels?.weatherEventProgress),
                weatherEventPhaseProgress: roundMs(
                    frameChannels?.weatherEventPhaseProgress,
                ),
                weatherFrontWeight: roundMs(frameChannels?.weatherFrontWeight),
                postRainWeight: roundMs(frameChannels?.postRainWeight),
                guaranteedRainDay: frameChannels?.guaranteedRainDay === true,
                surfaceFieldSubmitMs: roundMs(surfaceFieldProbe?.submitMs),
                surfaceEffectsEnabled: resolvedSurfaceEffectsEnabled,
                surfaceEffectsRequested: requestedSurfaceEffectsEnabled,
                surfaceEffectsDeferredForFirstFrame: (
                    requestedSurfaceEffectsEnabled === true
                    && resolvedSurfaceEffectsEnabled !== true
                    && surfaceEffectsDeferredForFirstFrame === true
                ),
                waterLayerRequested: layerEffectsEnabled,
                waterLayerApplyReady,
                waterLayerApplyStatus,
                waterLayerRequestedSignature:
                    typeof waterLayerApplyState?.requestedSignature === 'string'
                        ? waterLayerApplyState.requestedSignature
                        : '',
                waterLayerActiveSignature:
                    typeof waterLayerApplyState?.activeSignature === 'string'
                        ? waterLayerApplyState.activeSignature
                        : '',
                waterLayerApplyGeneration: Math.max(
                    0,
                    Math.floor(Number(waterLayerApplyState?.generation) || 0),
                ),
                waterLayerApplyError:
                    typeof waterLayerApplyState?.error === 'string'
                        ? waterLayerApplyState.error
                        : '',
                waterLayerRetainedActive: (
                    waterLayerApplyReady !== true
                    && typeof waterLayerApplyState?.activeSignature === 'string'
                    && waterLayerApplyState.activeSignature !== ''
                ),
                cadenceTier: sceneCadenceProfile?.tier || BASE_SCENE_CADENCE_PROFILE.tier,
                fullBackgroundUpdate: waterPassPlan.runFullBackgroundUpdate,
                backgroundDynamicUpdate: waterPassPlan.runBackgroundDynamicUpdate,
                fullEffectsUpdate: waterPassPlan.runFullEffectsUpdate,
                surfaceUniformFullUpdate: waterSurfaceFilter?._lastSurfaceUniformFullUpdate === true,
                cloudReflectionFullUpdate: waterPassPlan.runCloudReflectionUpdate,
                atmosphereFullUpdate: waterPassPlan.runAtmosphereUpdate,
                topShadowFullUpdate: waterPassPlan.runTopShadowUpdate,
                probeFullUpdate: waterPassPlan.runWaterProbeUpdate,
            }
            : lastWaterEffectsProbe
    );
    if (waterPassProbeState && typeof waterPassProbeState === 'object') {
        waterPassProbeState.lastWaterEffectsProbe = nextProbe;
        waterPassProbeState.lastTimings = {
            backgroundFxTickMs: roundMs(backgroundFxTickMs),
            waterEffectsTickMs: roundMs(waterEffectsTickMs),
            waterSurfaceFilterTickMs: roundMs(waterSurfaceFilterTickMs),
        };
        waterPassProbeState.lastLayerEffectsEnabled = layerEffectsEnabled;
        waterPassProbeState.lastSurfaceEffectsEnabled = resolvedSurfaceEffectsEnabled;
        waterPassProbeState.lastCanonicalSurfaceFieldActive = canonicalSurfaceFieldActive;
        waterPassProbeState.lastWaterLayerApplyGeneration =
            waterLayerApplyState?.generation;
        waterPassProbeState.lastWaterLayerApplyStatus = waterLayerApplyStatus;
        if (waterSurfaceReflectionProbe && typeof waterSurfaceReflectionProbe === 'object') {
            waterPassProbeState.lastYoonseulTime = waterSurfaceReflectionProbe.time;
        }
    }

    return {
        lastWaterEffectsProbe: nextProbe,
        waterPassPlan,
    };
};
