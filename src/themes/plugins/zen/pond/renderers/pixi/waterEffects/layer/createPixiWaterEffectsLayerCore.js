import { clamp as clampValue } from '../../../../model/koi/koiMotion.js';
import { createPixiWaterMaterialProjectionResolver } from '../../pixiWaterMaterialProjectionResolver.js';
import {
    nowMs,
    smoothTowards,
} from '../../pixiWaterEffectsMath.js';
import {
    updateAtmospherePass,
    updateCausticPass,
    updateCanopyPass,
} from '../passes/index.js';
import {
    canBakeCanvasTextures,
    clearSharedWaterTextureCache,
    ensureSharedWaterTextureCacheGeneration,
    releaseSharedWaterTextureEntry,
} from '../../pixiWaterEffectsTextureCache.js';
import {
    createWaterEffectsInitMetrics,
    resolveWaterEffectsTextureSizes,
} from './initUtils.js';
import { createNoopWaterEffectsLayer } from './noopLayer.js';
import {
    ZEN_POND_KOMOREBI_MAXIMUM_ALPHA,
    ZEN_POND_CANOPY_TRANSFER_MODEL_ID,
} from '../../../../contracts/zenPondCanopyMaterial.js';
import { createWaterEffectsTextureBundle } from './textureBundle.js';
import { resolveWaterEffectsFeatureFlags } from './featureFlags.js';
import { applyWaterMaterialBaseStatePass } from './materialBasePass.js';
import { createWaterEffectsSpriteState } from './spriteState.js';
import { resolveZenCanopyLightTransferShaderSources } from '../passes/zenCanopyLightTransferShaderDialect.js';
import {
    applyTemporalStateSnapshot,
    buildTemporalStateSnapshot,
    destroyWaterEffectsDisplayObjects,
} from './lifecycle.js';
import {
    resolveWaterFrameContract,
    resolveWaterStartupGates,
} from './frameCompute.js';
import {
    buildTopShadowHiddenProbe,
    buildTopShadowProbe,
} from './probeBuilder.js';
import {
    applyWaterLightingState,
    resolveWaterLightChannels,
} from './lightingUtils.js';
import {
    applyWaterEffectsVisibility,
    countVisibleCloudsInViewport,
    hideAllWaterEffects,
} from './visibilityUtils.js';
import { measureSlowOverlayBakeSafety } from '../../pixiSlowOverlayBakeSafety.js';
import { resolveZenRendererDebugTogglesForControlState } from '../../../../contracts/zenRendererDebugToggles.js';
import {
    ZEN_POND_BENTHIC_DETAIL_ALPHA_SCALE,
    ZEN_POND_BENTHIC_MATERIAL_OWNER_ID,
    ZEN_POND_BENTHIC_PRIMARY_ALPHA_SCALE,
    ZEN_POND_BENTHIC_SOURCE_SPRITE_COUNT,
} from '../../../../contracts/zenPondBenthicMaterial.js';

const FRAME_MS_BASE = 16.6667;
const MIST_TEXTURE_SIZE = 512;
const DRIFT_WRAP_BASE_SPAN = 16384;
const toFinite = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const buildWaterMaterialBaseGateSignature = ({
    causticGate = 0,
    cloudReflectionComputeEnabled = false,
    atmosphereGate = 0,
    stagedCausticGate = 0,
    benthicGate = 0,
    surfaceOpticsGate = 0,
    stagedBenthicGate = 0,
} = {}) => [
    causticGate,
    cloudReflectionComputeEnabled ? 1 : 0,
    atmosphereGate,
    stagedCausticGate,
    benthicGate,
    surfaceOpticsGate,
    stagedBenthicGate,
].map((value) => String(toFinite(value, 0))).join('|');

export const createPixiWaterEffectsLayerCore = ({
    width,
    height,
    webGLVersion,
    sceneGenerationKey = '',
    cloudReflectionsEnabled = true,
    textureCausticsEnabled = true,
    rendererDebugToggles = null,
    rendererDebugTogglesRef = null,
    textureGenerators = null,
    sunlightStrategy = null,
}) => {
    if (!width || !height) return createNoopWaterEffectsLayer('invalid_viewport');
    const textureBakeSupported = canBakeCanvasTextures();
    const generationKey = String(sceneGenerationKey || '');
    const resolveEffectDebugToggles = () => {
        const refToggles = rendererDebugTogglesRef?.current;
        const toggleSource = refToggles && typeof refToggles === 'object'
            ? refToggles
            : rendererDebugToggles;
        return resolveZenRendererDebugTogglesForControlState({
            toggles: toggleSource,
        });
    };
    const initialEffectDebugToggles = resolveEffectDebugToggles();
    const featureFlags = resolveWaterEffectsFeatureFlags({
        initialEffectDebugToggles,
        textureBakeSupported,
        cloudReflectionsEnabled,
        textureCausticsEnabled,
    });
    const {
        surfaceOpticsToggleEnabled,
        rgbSplitToggleEnabled,
        yoonseulToggleEnabled,
        benthicToggleEnabled,
        causticsToggleEnabled,
        godRaysToggleEnabled,
        cloudReflectionToggleEnabled,
        atmosphereToggleEnabled,
        komorebiToggleEnabled,
        anyLayerFeatureEnabled,
    } = featureFlags;
    if (
        !sunlightStrategy
        || typeof sunlightStrategy.lacyKomorebi !== 'boolean'
    ) {
        throw new Error('ZEN_POND_SUNLIGHT_STRATEGY_REQUIRED');
    }
    const canopyModel = sunlightStrategy.lacyKomorebi ? 'lacy' : 'layered';
    const komorebiRequested = initialEffectDebugToggles.komorebiEnabled !== false;
    const komorebiMaximumAlpha = ZEN_POND_KOMOREBI_MAXIMUM_ALPHA;
    ensureSharedWaterTextureCacheGeneration(generationKey);

    const initStartedMs = nowMs();
    const {
        pebbleTextureSize,
        pebbleDetailTextureSize,
        causticTextureSize,
        skyReflectionTextureSize,
    } = resolveWaterEffectsTextureSizes();
    const initMetrics = createWaterEffectsInitMetrics({
        textureSizes: {
            pebbleTextureSize,
            pebbleDetailTextureSize,
            causticTextureSize,
            skyReflectionTextureSize,
        },
        debugToggles: featureFlags.debugToggles,
        cloudReflectionToggleEnabled,
    });
    if (!anyLayerFeatureEnabled) {
        return {
            ...createNoopWaterEffectsLayer('no_features_enabled'),
            initMetrics: {
                ...initMetrics,
                skippedNoFeatures: true,
                totalMs: Math.max(0, nowMs() - initStartedMs),
            },
        };
    }
    // Reject unsupported context input before acquiring any layer textures.
    resolveZenCanopyLightTransferShaderSources(webGLVersion);
    const textureBundle = createWaterEffectsTextureBundle({
        generationKey,
        textureSizes: {
            pebbleTextureSize,
            pebbleDetailTextureSize,
            causticTextureSize,
            skyReflectionTextureSize,
        },
        initMetrics,
        cloudReflectionToggleEnabled,
        benthicToggleEnabled,
        causticsToggleEnabled,
        godRaysToggleEnabled,
        atmosphereToggleEnabled,
        komorebiToggleEnabled,
        canopyModel,
        textureGenerators,
    });
    const { sharedCacheKey } = textureBundle;
    const canopyFieldMetrics = initMetrics.canopyField || {
        modelId: null,
        gapCount: 0,
        foliageLobeCount: 0,
        shadeCoverageRatio: 0,
        sunlightCoverageRatio: 0,
    };
    const spriteState = createWaterEffectsSpriteState({
        width,
        height,
        webGLVersion,
        cloudReflectionToggleEnabled,
        textures: textureBundle.textures,
        pebbleDetailTextureSize,
        causticTextureSize,
    });
    const {
        pebbleSprite,
        pebbleDetailSprite,
        refractedGuideSprite,
        waterAtmosphereSprite,
        topShadowPrimarySprite,
        causticLayerPrimary,
        causticLayerSecondary,
        cloudReflectionPrimaryStates,
        cloudReflectionDetailStates,
        benthicObjects,
        refractedSurfaceObjects,
        cloudReflectionObjects,
        topShadowObjects,
        surfaceObjects,
        displayObjects,
        topShadowDriftState,
        causticDriftState,
        atmosphereDriftState,
        frame: initialFrame,
        bootElapsedMs: initialBootElapsedMs,
        sunlightIntensityState: initialSunlightIntensityState,
    } = spriteState;
    const slowOverlayBakeSafety = measureSlowOverlayBakeSafety({
        refractedSurfaceObjects,
        cloudReflectionObjects,
    });
    let frame = initialFrame;
    let bootElapsedMs = initialBootElapsedMs;
    let sunlightIntensityState = initialSunlightIntensityState;
    let topShadowPrimaryAlphaState = 0;
    let topShadowStretchState = 1;
    let komorebiAlphaState = 0;
    let canopyPendingDeltaFrames = 0;
    let atmospherePendingDeltaFrames = 0;
    let previousCanopyGate = null;
    let previousAtmosphereGate = null;
    let previousKomorebiEnabled = null;
    let canopyTransferProbe = null;
    let lastTopShadowProbe = null;
    let cachedMaterialBaseState = null;
    let cachedMaterialBaseGateSignature = '';

    const resolveMaterialProjection = createPixiWaterMaterialProjectionResolver();

    const tick = (deltaMs = FRAME_MS_BASE, frameState = null, frameChannels = null, updateOptions = null) => {
        const safeDeltaMs = clampValue(Number(deltaMs) || FRAME_MS_BASE, 4, 66.6667);
        const deltaFrames = safeDeltaMs / FRAME_MS_BASE;
        canopyPendingDeltaFrames += deltaFrames;
        atmospherePendingDeltaFrames += deltaFrames;
        bootElapsedMs += safeDeltaMs;
        frame += deltaFrames;
        const fullUpdate = updateOptions?.fullUpdate !== false || !lastTopShadowProbe;
        const forcePassUpdate = !lastTopShadowProbe || updateOptions?.forceUpdate === true;
        const effectRevealProgress = clampValue(Number(updateOptions?.effectRevealProgress), 0, 1);
        const canonicalSurfaceFieldActive = updateOptions?.canonicalSurfaceFieldActive === true;
        const effectDebugToggles = resolveEffectDebugToggles();
        const layerEffectsEnabled = (
            effectDebugToggles.waterEffectsEnabled !== false
            && effectDebugToggles.waterLayerEffectsEnabled !== false
        );

        if (!layerEffectsEnabled) {
            canopyPendingDeltaFrames = 0;
            atmospherePendingDeltaFrames = 0;
            previousCanopyGate = null;
            previousAtmosphereGate = null;
            topShadowPrimaryAlphaState = 0;
            topShadowStretchState = 1;
            komorebiAlphaState = 0;
            lastTopShadowProbe = buildTopShadowHiddenProbe(
                'effects_disabled',
                {
                    benthicOwnerId:
                        ZEN_POND_BENTHIC_MATERIAL_OWNER_ID,
                    benthicSourceSpriteCount:
                        ZEN_POND_BENTHIC_SOURCE_SPRITE_COUNT,
                    benthicPrimaryAlphaScale:
                        ZEN_POND_BENTHIC_PRIMARY_ALPHA_SCALE,
                    benthicDetailAlphaScale:
                        ZEN_POND_BENTHIC_DETAIL_ALPHA_SCALE,
                },
            );
            cachedMaterialBaseState = null;
            cachedMaterialBaseGateSignature = '';
            hideAllWaterEffects({
                topShadowPrimarySprite,
                pebbleSprite,
                pebbleDetailSprite,
                refractedGuideSprite,
                waterAtmosphereSprite,
                causticLayerPrimary,
                causticLayerSecondary,
                cloudReflectionObjects,
            });
            return lastTopShadowProbe;
        }

        const {
            sharedChannels,
            waterTemporalProjection,
            materialProjection,
        } = resolveWaterFrameContract({
            frameState,
            frameChannels,
            resolveMaterialProjection,
        });
        const {
            unifiedBottomVisibility,
            unifiedBottomContrast,
            unifiedTurbidity,
            unifiedScatter,
            unifiedTransmittance,
            unifiedCloudReflectionFactor,
            unifiedCloudOcclusion,
            unifiedCloudiness,
            unifiedCloudDensity,
            unifiedWindIntensity,
            unifiedWaveEnergy,
            unifiedRoughness,
            unifiedLightAmount,
            causticResponse,
            sunOp,
            causOp,
            godRayGain,
            godRayDensity,
            godRayPulse,
            causticLayerGain,
            causticDensityGain,
            topShadowMasterGain,
            topShadowGateBoost,
            topShadowWeatherFloor,
            topShadowDaytimeFloor,
            topShadowPrimaryAlphaMax,
            pebbleOpacityScale,
            veilOpacityScale,
            hazeOpacityScale,
            atmosphereOpacityScale,
            daylight,
            sceneBrightness,
            daylightCurve,
            nightBlend,
            sunsetFactor,
            cloudShapeVariance,
            cloudCoverageCenter,
            cloudDriftRate,
            cloudDetailScale,
            cloudAverageSize,
            envMoonlight,
            moonlitNightLift,
            sunAngle,
            windDirection,
            isClearWeather,
            clearSkyReflectionBoost,
            cloudCover,
        } = materialProjection;
        const startupGates = resolveWaterStartupGates({
            surfaceOpticsToggleEnabled,
            rgbSplitToggleEnabled,
            yoonseulToggleEnabled,
            benthicToggleEnabled,
            causticsToggleEnabled,
            cloudReflectionToggleEnabled,
            godRaysToggleEnabled,
            atmosphereToggleEnabled,
            effectDebugToggles,
        });
        const {
            rgbSplitGate,
            yoonseulGate,
        } = startupGates;
        const stagedBenthicGate = startupGates.stagedBenthicGate * effectRevealProgress;
        const stagedCausticGate = canonicalSurfaceFieldActive
            ? 0
            : startupGates.stagedCausticGate * effectRevealProgress;
        const stagedCloudGate = startupGates.stagedCloudGate * effectRevealProgress;
        const stagedRayGate = startupGates.stagedRayGate * effectRevealProgress;
        const surfaceOpticsGate = startupGates.surfaceOpticsGate * effectRevealProgress;
        const benthicGate = startupGates.benthicGate * effectRevealProgress;
        const causticGate = canonicalSurfaceFieldActive
            ? 0
            : startupGates.causticGate * effectRevealProgress;
        const highlightsGate = 0;
        const cloudReflectionToggleGate = startupGates.cloudReflectionToggleGate * effectRevealProgress;
        const cloudReflectionComputeEnabled = (
            startupGates.cloudReflectionComputeEnabled === true
            && effectRevealProgress > 0.001
        );
        const godRaysGate = startupGates.godRaysGate * effectRevealProgress;
        if (godRaysGate <= 0) canopyPendingDeltaFrames = 0;
        const atmosphereGate = startupGates.atmosphereGate * effectRevealProgress;
        const komorebiEnabled = komorebiToggleEnabled && effectDebugToggles.komorebiEnabled !== false;
        const atmosphereFullUpdate = forcePassUpdate
            || updateOptions?.atmosphereFullUpdate === true
            || atmosphereGate !== previousAtmosphereGate;
        const topShadowFullUpdate = forcePassUpdate
            || updateOptions?.topShadowFullUpdate === true
            || godRaysGate !== previousCanopyGate
            || komorebiEnabled !== previousKomorebiEnabled;
        const probeFullUpdate = fullUpdate
            || updateOptions?.probeFullUpdate === true
            || updateOptions?.cloudReflectionFullUpdate === true
            || atmosphereFullUpdate || topShadowFullUpdate;
        previousCanopyGate = godRaysGate;
        previousAtmosphereGate = atmosphereGate;
        previousKomorebiEnabled = komorebiEnabled;
        if (atmosphereGate <= 0) atmospherePendingDeltaFrames = 0;
        void rgbSplitGate;
        void yoonseulGate;
        const clearNoonExposure = isClearWeather
            ? clampValue(
                Math.pow(daylightCurve, 1.22)
                * Math.pow(1 - unifiedCloudiness, 1.35)
                * Math.pow(unifiedCloudOcclusion, 1.1),
                0,
                1,
            )
            : 0;
        const clearNoonSuppression = clampValue(1 - clearNoonExposure * 0.94, 0.06, 1);
        const clearNoonReflectionSuppression = clampValue(1 - clearNoonExposure * 0.42, 0.52, 1);

        const temporalSunlightBreathingRaw = Number(waterTemporalProjection?.sunlightBreathing);
        const breathing = Number.isFinite(temporalSunlightBreathingRaw)
            ? clampValue(temporalSunlightBreathingRaw, 0.86, 1.14)
            : 1;
        const sunlightIntensityTarget = Math.max(
            0,
            breathing * sunOp * godRayPulse * (0.04 + unifiedLightAmount * 0.18 + daylightCurve * 0.88),
        );
        if (sunlightIntensityState <= 1e-4) {
            sunlightIntensityState = sunlightIntensityTarget;
        } else {
            sunlightIntensityState = smoothTowards(
                sunlightIntensityState,
                sunlightIntensityTarget,
                deltaFrames,
                18,
            );
        }
        const sunlightIntensity = sunlightIntensityState;
        const temporalFlowTransport = clampValue(
            Number(waterTemporalProjection?.flowTransport ?? 0.34),
            0.08,
            0.92,
        );
        const temporalDirectionalDrift = clampValue(
            Number(waterTemporalProjection?.directionalDrift ?? 0),
            -0.24,
            0.24,
        );
        const temporalDirectionalAngle = Number.isFinite(Number(waterTemporalProjection?.directionalAngle))
            ? Number(waterTemporalProjection.directionalAngle)
            : 0;
        const materialBaseGateSignature = buildWaterMaterialBaseGateSignature({
            causticGate,
            cloudReflectionComputeEnabled,
            atmosphereGate,
            stagedCausticGate,
            benthicGate,
            surfaceOpticsGate,
            stagedBenthicGate,
        });
        const runMaterialBaseUpdate = (
            fullUpdate
            || !cachedMaterialBaseState
            || materialBaseGateSignature !== cachedMaterialBaseGateSignature
        );
        const materialBaseState = runMaterialBaseUpdate
            ? applyWaterMaterialBaseStatePass({
                causticGate,
                cloudReflectionComputeEnabled,
                atmosphereGate,
                causOp,
                causticResponse,
                causticLayerGain,
                sunlightIntensity,
                daylightCurve,
                causticDensityGain,
                stagedCausticGate,
                causticLayerPrimary,
                causticLayerSecondary,
                unifiedWaveEnergy,
                unifiedRoughness,
                temporalFlowTransport,
                unifiedTransmittance,
                unifiedTurbidity,
                benthicGate,
                surfaceOpticsGate,
                sceneBrightness,
                moonlitNightLift,
                unifiedBottomVisibility,
                pebbleOpacityScale,
                stagedBenthicGate,
                pebbleSprite,
                pebbleDetailSprite,
                unifiedBottomContrast,
            })
            : cachedMaterialBaseState;
        if (runMaterialBaseUpdate) {
            cachedMaterialBaseState = materialBaseState;
            cachedMaterialBaseGateSignature = materialBaseGateSignature;
        }
        const {
            causticPerceptual,
            sunForCaustics,
        } = materialBaseState;

        const lightState = resolveWaterLightChannels({
            sharedChannels,
        });
        const lightChannels = lightState.lightChannels;
        const {
            veilTint,
            hazeTint,
            veilBaseAlpha,
            hazeBaseAlpha,
            hazeAntiBloom,
        } = applyWaterLightingState({
            lightChannels,
            nightBlend,
            daylightCurve,
            moonlitNightLift,
            unifiedTurbidity,
            unifiedScatter,
            causticPerceptual,
            pebbleSprite,
            pebbleDetailSprite,
            causticLayerPrimary,
            causticLayerSecondary,
            refractedGuideSprite,
        });

        let primaryAlphaMax = lastTopShadowProbe?.topShadowPrimaryAlphaMax ?? lastTopShadowProbe?.primaryAlphaMax ?? 0;
        let weatherGate = lastTopShadowProbe?.weatherGate ?? 0;
        let canopyShadeGate = lastTopShadowProbe?.canopyShadeGate ?? 0;
        let canopySunElevationGate = lastTopShadowProbe?.canopySunElevationGate ?? 0;
        let topShadowGate = lastTopShadowProbe?.topShadowGate ?? 0;
        let baseOpTarget = lastTopShadowProbe?.baseOpTarget ?? 0;
        let topShadowGainCurve = lastTopShadowProbe?.topShadowGainCurve ?? 0;
        let topShadowDensityCurve = lastTopShadowProbe?.topShadowDensityCurve ?? 0;
        let topShadowShadowGain = lastTopShadowProbe?.topShadowShadowGain ?? 0;
        // This layer owns submerged material and canopy only. The canonical
        // surface filter owns sky reflection after the benthic refraction.
        const mirrorStrength = 0;
        const cloudReflectionGate = 0;
        const cloudShapeSignal = 0;
        const skyReflectionSignal = 0;
        const cloudReflectionBase = 0;
        const cloudReflectionPrimaryAlphaBase = 0;
        const cloudReflectionDetailAlphaBase = 0;
        const activeCloudRatio = 0;
        const activePrimaryCount = 0;
        const activeDetailCount = 0;
        const cloudScalePrimary = 0;
        const cloudScaleDetail = 0;
        const driftGain = 0;
        const needsBenthicOrOpticsSignal = benthicGate > 0 || surfaceOpticsGate > 0;
        const benthicVisibility = needsBenthicOrOpticsSignal
            ? clampValue(
                (1 - mirrorStrength * (0.12 + daylightCurve * 0.08))
                * (0.68 + unifiedTransmittance * 0.52),
                0,
                1,
            )
            : 0;
        if (benthicGate > 0) {
            const benthicDetailLift = clampValue(
                0.008 + (1 - mirrorStrength) * 0.014 + unifiedWaveEnergy * 0.006,
                0.004,
                0.03,
            );
            const basePebbleAlpha = Number(materialBaseState?.pebbleAlpha);
            const basePebbleDetailAlpha = Number(materialBaseState?.pebbleDetailAlpha);
            pebbleSprite.alpha = clampValue(
                (Number.isFinite(basePebbleAlpha) ? basePebbleAlpha : pebbleSprite.alpha) * benthicVisibility,
                0,
                0.82,
            ) * ZEN_POND_BENTHIC_PRIMARY_ALPHA_SCALE;
            pebbleDetailSprite.alpha = clampValue(
                (Number.isFinite(basePebbleDetailAlpha) ? basePebbleDetailAlpha : pebbleDetailSprite.alpha)
                * (benthicVisibility * 0.96)
                + benthicDetailLift,
                0,
                0.28,
            ) * ZEN_POND_BENTHIC_DETAIL_ALPHA_SCALE;
        } else {
            pebbleSprite.alpha = 0;
            pebbleDetailSprite.alpha = 0;
        }
        if (refractedGuideSprite && surfaceOpticsGate > 0) {
            refractedGuideSprite.alpha = clampValue(
                (0.012 + unifiedWaveEnergy * 0.042 + (1 - unifiedCloudOcclusion) * 0.02)
                * (0.62 + benthicVisibility * 0.58),
                0,
                0.095,
            );
        } else if (refractedGuideSprite) {
            refractedGuideSprite.alpha = 0;
        }
        if (atmosphereFullUpdate) {
            const atmosphereDeltaFrames = atmospherePendingDeltaFrames;
            atmospherePendingDeltaFrames = 0;
            if (atmosphereGate > 0) {
                updateAtmospherePass({
                    frame,
                    deltaFrames: atmosphereDeltaFrames,
                    sharedChannels,
                    veilTint,
                    hazeTint,
                    veilBaseAlpha,
                    hazeBaseAlpha,
                    hazeAntiBloom,
                    veilOpacityScale,
                    hazeOpacityScale,
                    mirrorStrength,
                    unifiedTurbidity,
                    unifiedScatter,
                    clearNoonSuppression,
                    atmosphereOpacityScale,
                    atmosphereGate,
                    sunAngle,
                    temporalDirectionalAngle,
                    temporalDirectionalDrift,
                    temporalFlowTransport,
                    unifiedWindIntensity,
                    atmosphereDriftState,
                    mistTextureSize: MIST_TEXTURE_SIZE,
                    waterAtmosphereSprite,
                });
            } else {
                waterAtmosphereSprite.alpha = 0;
                waterAtmosphereSprite.visible = false;
            }
        }
        if (topShadowFullUpdate) {
            // This pass is sparse. Its easing consumes elapsed scene time,
            // including frames where only the other water passes ran.
            const canopyDeltaFrames = canopyPendingDeltaFrames;
            canopyPendingDeltaFrames = 0;
            if (godRaysGate > 0) {
                const topShadowPass = updateCanopyPass({
                    frame,
                    deltaFrames: canopyDeltaFrames,
                    visibleWorldBounds: updateOptions.visibleWorldBounds,
                    shadowLight: sharedChannels.shadowLight,
                    unifiedWindIntensity,
                    godRaysGate,
                    stagedRayGate,
                    topShadowPrimarySprite,
                    topShadowDriftState,
                    topShadowPrimaryAlphaState,
                    komorebiEnabled,
                });
                canopyTransferProbe = topShadowPass;
                primaryAlphaMax = topShadowPass.primaryAlphaMax;
                canopyShadeGate = topShadowPass.canopyShadeGate;
                canopySunElevationGate = topShadowPass.canopySunElevationGate;
                komorebiAlphaState = topShadowPass.komorebiAlphaState;
                weatherGate = topShadowPass.weatherGate;
                topShadowGate = topShadowPass.topShadowGate;
                baseOpTarget = topShadowPass.baseOpTarget;
                topShadowGainCurve = topShadowPass.topShadowGainCurve;
                topShadowDensityCurve = topShadowPass.topShadowDensityCurve;
                topShadowShadowGain = topShadowPass.topShadowShadowGain;
                topShadowPrimaryAlphaState = topShadowPass.topShadowPrimaryAlphaState;
                topShadowStretchState = topShadowPass.topShadowStretchState;
            } else {
                primaryAlphaMax = 0;
                canopyShadeGate = 0;
                canopySunElevationGate = 0;
                komorebiAlphaState = 0;
                canopyTransferProbe = null;
                weatherGate = 0;
                topShadowGate = 0;
                baseOpTarget = 0;
                topShadowGainCurve = 0;
                topShadowDensityCurve = 0;
                topShadowShadowGain = 0;
                topShadowPrimaryAlphaState = 0;
                topShadowStretchState = 1;
                topShadowPrimarySprite.alpha = 0;
                topShadowPrimarySprite.visible = false;
            }
        }

        applyWaterEffectsVisibility({
            pebbleSprite,
            pebbleDetailSprite,
            refractedGuideSprite,
            waterAtmosphereSprite,
            causticLayerPrimary,
            causticLayerSecondary,
            cloudReflectionObjects,
        });

        if (causticGate > 0) {
            updateCausticPass({
                frame,
                deltaFrames,
                sunAngle,
                temporalDirectionalAngle,
                temporalDirectionalDrift,
                temporalFlowTransport,
                unifiedWaveEnergy,
                unifiedWindIntensity,
                causticTextureSize,
                causticLayerPrimary,
                causticLayerSecondary,
                causticDriftState,
                driftWrapBaseSpan: DRIFT_WRAP_BASE_SPAN,
            });
        }
        if (probeFullUpdate) {
            const topShadowVisible = Boolean(topShadowPrimarySprite?.visible);
            const {
                cloudVisibleCount,
                cloudOnscreenCount,
            } = countVisibleCloudsInViewport({
                cloudReflectionComputeEnabled,
                cloudReflectionObjects,
                width,
                height,
            });
            lastTopShadowProbe = buildTopShadowProbe({
                topShadowVisible,
                godRaysGate,
                stagedRayGate,
                daylightCurve,
                sunOp,
                sunlightIntensity,
                godRayGain,
                godRayDensity,
                godRayPulse,
                canopyShadeGate,
                canopySunElevationGate,
                komorebiModelId: canopyFieldMetrics.modelId,
                komorebiRequested,
                komorebiActive: topShadowVisible && komorebiAlphaState > 0.001,
                komorebiTextureAllocated: godRaysToggleEnabled || komorebiToggleEnabled,
                komorebiTextureBuildMs: initMetrics.cache.hit
                    ? 0 : initMetrics.textureBuildMs.canopyField,
                komorebiTextureBakeSupported: textureBakeSupported,
                komorebiReason: (
                    komorebiRequested && !textureBakeSupported
                        ? 'texture_bake_unavailable'
                        : (!komorebiRequested
                            ? 'disabled'
                            : (!topShadowVisible
                                ? 'canopy_hidden'
                                : (komorebiAlphaState <= 0.001 ? 'direct_light_absent' : null)))
                ),
                komorebiAlpha: topShadowVisible ? komorebiAlphaState : 0,
                canopyTransferModelId: ZEN_POND_CANOPY_TRANSFER_MODEL_ID,
                canopyTransferProbe,
                komorebiMaximumAlpha,
                komorebiGapCount: canopyFieldMetrics.gapCount,
                komorebiCoverageRatio: canopyFieldMetrics.sunlightCoverageRatio,
                canopyShadeCoverageRatio: canopyFieldMetrics.shadeCoverageRatio,
                canopyFoliageLobeCount: canopyFieldMetrics.foliageLobeCount,
                weatherGate,
                topShadowGate,
                topShadowGainCurve,
                topShadowDensityCurve,
                topShadowShadowGain,
                topShadowMasterGain,
                topShadowGateBoost,
                topShadowWeatherFloor,
                topShadowDaytimeFloor,
                primaryAlphaMax,
                baseOpTarget,
                topShadowPrimaryAlphaState,
                surfaceOpticsGate,
                benthicGate,
                causticGate,
                highlightsGate,
                cloudReflectionToggleGate,
                cloudReflectionComputeEnabled,
                atmosphereGate,
                mirrorStrength,
                cloudReflectionGate,
                cloudShapeSignal,
                skyReflectionSignal,
                cloudReflectionBase,
                cloudReflectionPrimaryAlphaBase,
                cloudReflectionDetailAlphaBase,
                activeCloudRatio,
                activePrimaryCount,
                activeDetailCount,
                cloudVisibleCount,
                cloudOnscreenCount,
                cloudScalePrimary,
                cloudScaleDetail,
                driftGain,
                atmosphereAlpha: waterAtmosphereSprite.alpha,
                refractedGuideAlpha: refractedGuideSprite?.alpha || 0,
                causticPrimaryAlpha: causticLayerPrimary.alpha,
                causticSecondaryAlpha: causticLayerSecondary.alpha,
                highlightPrimaryAlpha: 0,
                highlightMicroAlpha: 0,
                bottomVisibility: unifiedBottomVisibility,
                pebbleAlpha: pebbleSprite.alpha,
                pebbleDetailAlpha: pebbleDetailSprite.alpha,
                benthicOwnerId:
                    ZEN_POND_BENTHIC_MATERIAL_OWNER_ID,
                benthicSourceSpriteCount:
                    ZEN_POND_BENTHIC_SOURCE_SPRITE_COUNT,
                benthicVisibleSpriteCount:
                    Number(pebbleSprite.visible)
                    + Number(pebbleDetailSprite.visible),
                benthicPrimaryAlphaScale:
                    ZEN_POND_BENTHIC_PRIMARY_ALPHA_SCALE,
                benthicDetailAlphaScale:
                    ZEN_POND_BENTHIC_DETAIL_ALPHA_SCALE,
                textureBakeSupported,
                materialBaseFullUpdate: runMaterialBaseUpdate,
                slowOverlayFullBakeSafe: slowOverlayBakeSafety.fullOverlaySafe,
                cloudReflectionBakeSafe: slowOverlayBakeSafety.cloudOnlySafe,
                effectRevealProgress,
            });
        }
        return lastTopShadowProbe;
    };

    const destroy = () => {
        destroyWaterEffectsDisplayObjects(displayObjects);
        releaseSharedWaterTextureEntry(sharedCacheKey);
    };

    const getTemporalState = () => buildTemporalStateSnapshot({
        frame,
        bootElapsedMs,
        atmosphereDriftState,
        toFinite,
    });

    const setTemporalState = (nextState = null) => {
        const nextTemporalState = applyTemporalStateSnapshot({
            nextState,
            frame,
            bootElapsedMs,
            atmosphereDriftState,
            toFinite,
        });
        frame = nextTemporalState.frame;
        bootElapsedMs = nextTemporalState.bootElapsedMs;
    };

    return {
        displayObjects,
        benthicObjects,
        refractedSurfaceObjects,
        cloudReflectionObjects,
        topShadowObjects,
        surfaceObjects,
        resize: (nextWidth, nextHeight) => {
            width = nextWidth;
            height = nextHeight;
            for (const sprite of [...benthicObjects, ...refractedSurfaceObjects, ...surfaceObjects]) {
                sprite.width = width;
                sprite.height = height;
            }
            // Canopy geometry consumes the next frame's canonical visible bounds.
        },
        initMetrics: {
            ...initMetrics,
            totalMs: Math.max(0, nowMs() - initStartedMs),
        },
        getTopShadowProbe: () => lastTopShadowProbe,
        getTemporalState,
        setTemporalState,
        tick,
        destroy,
    };
};

export { clearSharedWaterTextureCache };
