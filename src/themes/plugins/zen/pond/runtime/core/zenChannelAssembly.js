import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { resolveSunlightResponseProfile } from '../sunlightProfile.js';

const EMPTY_OBJECT = Object.freeze({});

const resolveSafeObject = (value) => (
    value && typeof value === 'object' ? value : EMPTY_OBJECT
);

const clamp01 = (value, fallback = 0) => clampValue(Number(value ?? fallback), 0, 1);

const requireFiniteChannelSource = (value, fieldName) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_FRAME_CHANNEL_SOURCE_MISSING:${fieldName}`);
    }
    return numeric;
};

export const resolveZenEffectIntensityScale = ({
    qualityProfile = null,
    effectIntensityScale = null,
} = {}) => {
    // null is an omitted authoring override, not an explicit request for zero.
    const explicitScale = effectIntensityScale === null ? Number.NaN : Number(effectIntensityScale);
    if (Number.isFinite(explicitScale)) {
        return clampValue(explicitScale, 0, 2);
    }
    const qualityScale = Number(qualityProfile?.effectIntensityScale);
    if (Number.isFinite(qualityScale)) {
        return clampValue(qualityScale, 0, 2);
    }
    return 1;
};

export const resolveZenLightingProfile = ({
    tuning = null,
    envState = null,
    qualityProfile = null,
    effectIntensityScale = null,
} = {}) => {
    const resolvedEffectIntensityScale = resolveZenEffectIntensityScale({
        qualityProfile,
        effectIntensityScale,
    });
    return {
        lightingProfile: resolveSunlightResponseProfile({
            tuning,
            envState,
            intensityScale: resolvedEffectIntensityScale,
        }),
        effectIntensityScale: resolvedEffectIntensityScale,
    };
};

export const buildZenFrameEnv = ({
    envState = null,
    coreEnv = null,
} = {}) => {
    const safeEnvState = resolveSafeObject(envState);
    const safeCoreEnv = resolveSafeObject(coreEnv);
    const daylight = safeCoreEnv.daylight;
    const cloudiness = safeCoreEnv.cloudCover;
    const overcastWeight = safeCoreEnv.overcastWeight;
    const rainIntensity = clamp01(safeCoreEnv.rainIntensity, 0);
    const weatherFrontWeight = clamp01(safeCoreEnv.weatherFrontWeight, 0);
    const postRainWeight = clamp01(safeCoreEnv.postRainWeight, 0);
    const lightAmount = safeCoreEnv.lightAmount;
    const sceneBrightness = safeCoreEnv.sceneBrightness;
    const diurnalPhase = safeCoreEnv.diurnalPhase;
    const nightDepth = safeCoreEnv.nightDepth;
    const envWaterClarity = clamp01(safeCoreEnv.envWaterClarity, 0.64);
    const waterTurbidity = clamp01(1 - envWaterClarity, 1 - envWaterClarity);
    const transmittance = clamp01(1 - waterTurbidity, 1 - waterTurbidity);
    const scatter = clamp01(waterTurbidity, waterTurbidity);
    const bottomVisibility = clamp01(transmittance, transmittance);
    const cloudOcclusion = safeCoreEnv.sunTransmission;
    const windIntensity = clampValue(
        requireFiniteChannelSource(safeCoreEnv.windIntensity, 'coreEnv.windIntensity'),
        0.08,
        1,
    );
    const gustEnvelope = clampValue(
        requireFiniteChannelSource(safeCoreEnv.gustEnvelope, 'coreEnv.gustEnvelope'),
        0,
        1,
    );
    const moonlight = safeEnvState.moonlight;
    const sunAngle = safeEnvState.sunAngle;
    const windDirection = requireFiniteChannelSource(
        safeCoreEnv.windDirection,
        'coreEnv.windDirection',
    );
    const clearSkyReflectionBoost = safeEnvState.clearSkyReflectionBoost;
    const lightColor = safeEnvState.lightColor;
    const temporalTintColor = safeEnvState.temporalTintColor;

    return {
        daylight,
        cloudCover: cloudiness,
        cloudiness,
        overcastWeight,
        rainIntensity,
        weatherFrontWeight,
        postRainWeight,
        weatherRegime: safeCoreEnv.weatherRegime,
        weatherKind: safeEnvState.weatherKind,
        weatherEventScheduled: safeCoreEnv.weatherEventScheduled === true,
        weatherEventActive: safeCoreEnv.weatherEventActive === true,
        weatherEventId: safeCoreEnv.weatherEventId,
        weatherEventKind: safeCoreEnv.weatherEventKind,
        weatherEventPhase: safeCoreEnv.weatherEventPhase,
        weatherEventProgress: clamp01(safeCoreEnv.weatherEventProgress, 0),
        weatherEventPhaseProgress: clamp01(safeCoreEnv.weatherEventPhaseProgress, 0),
        guaranteedRainDay: safeCoreEnv.guaranteedRainDay === true,
        cloudOcclusion,
        windIntensity,
        gustEnvelope,
        windDirection,
        lightAmount,
        sceneBrightness,
        diurnalPhase,
        nightDepth,
        night: safeCoreEnv.night,
        solarElevation: safeCoreEnv.solarElevation,
        directSunlight: safeCoreEnv.directSunlight,
        diffuseSkylight: safeCoreEnv.diffuseSkylight,
        sunTransmission: safeCoreEnv.sunTransmission,
        noonWeight: safeCoreEnv.noonWeight,
        solarAltitudeRadians: safeCoreEnv.solarAltitudeRadians,
        sunDirectionX: safeCoreEnv.sunDirectionX,
        sunDirectionY: safeCoreEnv.sunDirectionY,
        sunDirectionZ: safeCoreEnv.sunDirectionZ,
        airHaze: safeCoreEnv.airHaze,
        cloudSeed: safeEnvState.cloudSeed,
        cloudPhaseX: safeEnvState.cloudPhaseX,
        cloudPhaseY: safeEnvState.cloudPhaseY,
        cloudThreshold: safeEnvState.cloudThreshold,
        cloudDensity: safeEnvState.cloudDensity,
        ambientChromaticState: safeEnvState.ambientChromaticState,
        waterPalette: safeEnvState.waterPalette,
        envWaterClarity,
        waterTurbidity,
        transmittance,
        scatter,
        bottomVisibility,
        moonlight,
        sunAngle,
        clearSkyReflectionBoost,
        lightColor,
        temporalTintColor,
        lightColorRgb: safeEnvState.lightColorRgb,
        temporalTintRgb: safeEnvState.temporalTintRgb,
    };
};

export const buildZenDerivedChannels = ({
    frameEnv = null,
    coreEnv = null,
    lightingProfile = null,
    waterDerivation = null,
} = {}) => {
    const safeFrameEnv = resolveSafeObject(frameEnv);
    const safeCoreEnv = resolveSafeObject(coreEnv);
    const safeLightingProfile = resolveSafeObject(lightingProfile);
    const safeWaterDerivation = resolveSafeObject(waterDerivation);
    const lighting = resolveSafeObject(safeWaterDerivation.lighting);
    const surface = resolveSafeObject(safeWaterDerivation.surface);
    const waterMedium = resolveSafeObject(safeWaterDerivation.waterMedium);
    const bottom = resolveSafeObject(safeWaterDerivation.bottom);
    const atmosphere = resolveSafeObject(safeWaterDerivation.atmosphere);
    const biotic = resolveSafeObject(safeWaterDerivation.biotic);
    const lightLinked = resolveSafeObject(safeLightingProfile.lightLinked);

    return {
        lighting: {
            daylightEnvelope: safeFrameEnv.daylight,
            daylight: safeFrameEnv.daylight,
            lightAmount: safeFrameEnv.lightAmount,
            sceneBrightness: safeFrameEnv.sceneBrightness,
            diurnalPhase: safeFrameEnv.diurnalPhase,
            nightDepth: safeFrameEnv.nightDepth,
            moonlight: safeFrameEnv.moonlight,
            directSunlight: safeFrameEnv.directSunlight,
            diffuseSkylight: safeFrameEnv.diffuseSkylight,
            sunTransmission: safeFrameEnv.sunTransmission,
            noonWeight: safeFrameEnv.noonWeight,
            solarAltitudeRadians: safeFrameEnv.solarAltitudeRadians,
            sunDirectionX: safeFrameEnv.sunDirectionX,
            sunDirectionY: safeFrameEnv.sunDirectionY,
            sunDirectionZ: safeFrameEnv.sunDirectionZ,
            directLight: lighting.directLight,
            ambientLight: lighting.ambientLight,
            causticStrength: lighting.causticStrength ?? safeLightingProfile.causticStrength,
            sunlightResponse: safeLightingProfile.responseCurve,
        },
        atmosphere: {
            airHaze: safeFrameEnv.airHaze,
            cloudCover: safeCoreEnv.cloudCover ?? safeFrameEnv.cloudCover,
            cloudiness: safeCoreEnv.cloudiness ?? safeFrameEnv.cloudiness,
            overcastWeight: safeCoreEnv.overcastWeight ?? safeFrameEnv.overcastWeight,
            rainIntensity: safeCoreEnv.rainIntensity ?? safeFrameEnv.rainIntensity,
            weatherFrontWeight: safeCoreEnv.weatherFrontWeight ?? safeFrameEnv.weatherFrontWeight,
            postRainWeight: safeCoreEnv.postRainWeight ?? safeFrameEnv.postRainWeight,
            weatherRegime: safeCoreEnv.weatherRegime ?? safeFrameEnv.weatherRegime,
            weatherEventScheduled: (
                safeCoreEnv.weatherEventScheduled
                ?? safeFrameEnv.weatherEventScheduled
            ),
            weatherEventActive: safeCoreEnv.weatherEventActive ?? safeFrameEnv.weatherEventActive,
            weatherEventId: safeCoreEnv.weatherEventId ?? safeFrameEnv.weatherEventId,
            weatherEventKind: safeCoreEnv.weatherEventKind ?? safeFrameEnv.weatherEventKind,
            weatherEventPhase: safeCoreEnv.weatherEventPhase ?? safeFrameEnv.weatherEventPhase,
            weatherEventProgress: (
                safeCoreEnv.weatherEventProgress
                ?? safeFrameEnv.weatherEventProgress
            ),
            weatherEventPhaseProgress: (
                safeCoreEnv.weatherEventPhaseProgress
                ?? safeFrameEnv.weatherEventPhaseProgress
            ),
            guaranteedRainDay: safeCoreEnv.guaranteedRainDay ?? safeFrameEnv.guaranteedRainDay,
            cloudOcclusion: safeCoreEnv.cloudOcclusion ?? safeFrameEnv.cloudOcclusion,
            windIntensity: safeCoreEnv.windIntensity ?? safeFrameEnv.windIntensity,
            gustEnvelope: safeCoreEnv.gustEnvelope ?? safeFrameEnv.gustEnvelope,
            windDirection: safeFrameEnv.windDirection,
            clearSkyReflectionBoost: safeFrameEnv.clearSkyReflectionBoost,
            lightColor: safeFrameEnv.lightColor,
            temporalTintColor: safeFrameEnv.temporalTintColor,
            lightColorRgb: safeFrameEnv.lightColorRgb,
            temporalTintRgb: safeFrameEnv.temporalTintRgb,
            reflectionFactor: atmosphere.reflectionFactor,
            mirrorFactor: atmosphere.mirrorFactor,
        },
        waterMedium: {
            clarity: safeCoreEnv.envWaterClarity ?? safeFrameEnv.envWaterClarity,
            turbidity: waterMedium.turbidity ?? safeFrameEnv.waterTurbidity,
            transmittance: waterMedium.transmittance ?? safeFrameEnv.transmittance,
            scatter: waterMedium.scatter ?? safeFrameEnv.scatter,
            veilDensity: waterMedium.veilDensity,
            hazeDensity: waterMedium.hazeDensity,
            bottomVisibility: bottom.visibility ?? safeFrameEnv.bottomVisibility,
            bottomContrast: bottom.contrast,
            pebbleExposure: bottom.pebbleExposure,
        },
        surface: {
            waveEnergy: surface.waveEnergy,
            roughness: surface.roughness,
            reflectionStability: surface.reflectionStability,
            phaseRate: surface.phaseRate,
            gravityWaveEnergy: surface.gravityWaveEnergy,
            capillaryWaveEnergy: surface.capillaryWaveEnergy,
            directionalSpread: surface.directionalSpread,
            spatialStability: surface.spatialStability,
            detailStability: surface.detailStability,
            temporalStability: surface.temporalStability,
            speedMultiplier: surface.speedMultiplier,
            rippleScale: surface.rippleScale,
            rippleIrregularity: surface.rippleIrregularity,
            refractionScale: surface.refractionScale,
            refractionDensity: surface.refractionDensity,
            refractionAnisotropy: surface.refractionAnisotropy,
            refractionJitter: surface.refractionJitter,
            refractionMicroScale: surface.refractionMicroScale,
            specularResponse: lighting.specularResponse,
            reflectionFactor: atmosphere.reflectionFactor,
            mirrorFactor: atmosphere.mirrorFactor,
            surfaceLightResponse: safeLightingProfile.surfaceGain,
            causticResponseScale: safeLightingProfile.causticResponseScale,
            rippleMotionGain: safeLightingProfile.rippleMotionScale,
            shimmerGain: safeLightingProfile.shimmerGain,
            refractionDrive: safeLightingProfile.refractionDrive,
            surfaceSheenGain: lightLinked.surfaceSheenGain,
            surfaceSparkleGain: lightLinked.surfaceSparkleGain,
        },
        biotic: {
            bonsaiPetalSupply: biotic.bonsaiPetalSupply,
            bonsaiBloomSupply: biotic.bonsaiBloomSupply,
            bonsaiPetalFallSupply: biotic.bonsaiPetalFallSupply,
            bonsaiPetalCapacity: biotic.bonsaiPetalCapacity,
            bonsaiBloomRatio: biotic.bonsaiBloomRatio,
            bonsaiPetalFallLimit: biotic.bonsaiPetalFallLimit,
            bonsaiLeafBudSignal: biotic.bonsaiLeafBudSignal,
            bonsaiBudSignal: biotic.bonsaiBudSignal,
            bonsaiPreviewPetalRate: biotic.bonsaiPreviewPetalRate,
            bonsaiRippleVitality: biotic.bonsaiRippleVitality,
            glimmerDensityGain: lightLinked.glimmerDensityGain ?? safeLightingProfile.glimmerDensityGain,
            ecosystemResponse: safeLightingProfile.responseCurve,
            daylightResponse: safeLightingProfile.daylight,
        },
    };
};
