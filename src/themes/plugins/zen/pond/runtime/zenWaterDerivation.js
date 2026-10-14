import { clamp as clampValue } from '../model/koi/koiMotion.js';

const toNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toFiniteOrNull = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const clamp01 = (value, fallback = 0) => clampValue(toNumber(value, fallback), 0, 1);

const requireFiniteCause = (source, fieldName) => {
    const numeric = Number(source?.[fieldName]);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_WATER_CAUSE_MISSING:${fieldName}`);
    }
    return numeric;
};

export const resolveZenWaterDerivationState = ({
    tuning = null,
    envState = null,
    qualityProfile = null,
    waterSurfaceCause = null,
} = {}) => {
    const safeTuning = tuning || {};
    const safeEnv = envState || {};
    const safeQuality = qualityProfile || {};
    if (!waterSurfaceCause || typeof waterSurfaceCause !== 'object') {
        throw new Error('ZEN_WATER_SURFACE_CAUSE_MISSING');
    }

    // The world target already owns solar phase and atmospheric attenuation.
    // Pond derives material/surface responses, never a second day or light model.
    const daylight = safeEnv.daylight;
    const night = safeEnv.night;
    const nightDepth = safeEnv.nightDepth;
    const solarElevation = safeEnv.solarElevation;
    const moonlight = safeEnv.moonlight;
    const directSunlight = safeEnv.directSunlight;
    const diffuseSkylight = safeEnv.diffuseSkylight;
    const sunTransmission = safeEnv.sunTransmission;
    const sceneBrightness = safeEnv.sceneBrightness;
    const noonWeight = safeEnv.noonWeight;
    const solarAltitudeRadians = safeEnv.solarAltitudeRadians;
    const sunDirectionX = safeEnv.sunDirectionX;
    const sunDirectionY = safeEnv.sunDirectionY;
    const sunDirectionZ = safeEnv.sunDirectionZ;
    const airHaze = safeEnv.airHaze;
    const cloudiness = safeEnv.cloudCover;
    const cloudCover = cloudiness;
    const overcastWeight = safeEnv.overcastWeight;
    const rainIntensity = clamp01(toNumber(safeEnv.rainIntensity, 0));
    const weatherFrontWeight = clamp01(toNumber(safeEnv.weatherFrontWeight, 0));
    const postRainWeight = clamp01(toNumber(safeEnv.postRainWeight, 0));
    const cloudOcclusion = sunTransmission;
    const lightAmount = sceneBrightness;
    const diurnalPhase = daylight;

    const envWaterClarity = clamp01(requireFiniteCause(waterSurfaceCause, 'waterClarity'));
    const waterTurbidity = clamp01(1 - envWaterClarity);
    const transmittance = clamp01(1 - waterTurbidity);
    const scatter = clamp01(waterTurbidity);
    const turbidity = waterTurbidity;
    const bottomVisibility = transmittance;

    const windIntensity = clampValue(
        requireFiniteCause(waterSurfaceCause.wind, 'intensity'),
        0.08,
        1,
    );
    const windDirection = requireFiniteCause(waterSurfaceCause.wind, 'direction');
    const gustEnvelope = clamp01(requireFiniteCause(waterSurfaceCause.wind, 'gustEnvelope'));
    const bonsaiPetalCapacity = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiPetalCapacity) ?? 0,
    );
    const bonsaiBloomRatio = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiBloomRatio) ?? bonsaiPetalCapacity,
    );
    const bonsaiPetalFallLimit = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiPetalFallLimit) ?? bonsaiPetalCapacity,
    );
    const bonsaiLeafBudSignal = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiLeafBudSignal) ?? 0,
    );
    const bonsaiBudSignal = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiBudSignal) ?? 0,
    );
    const bonsaiPreviewPetalRate = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiPreviewPetalRate) ?? 0,
    );
    const bonsaiRippleVitality = clamp01(
        toFiniteOrNull(safeTuning.sceneBonsaiRippleVitality) ?? 0,
    );
    const effectivePetalCapacity = bonsaiPetalCapacity;
    const effectiveBloomRatio = bonsaiBloomRatio;
    const effectivePetalFallLimit = bonsaiPetalFallLimit;

    const pondDepthStrength = 0.6;
    const reflectionStability = clamp01(
        requireFiniteCause(waterSurfaceCause, 'reflectionStability'),
    );
    const spatialStability = clamp01(
        requireFiniteCause(waterSurfaceCause.stability, 'spatial'),
    );
    const detailStability = clamp01(
        requireFiniteCause(waterSurfaceCause.stability, 'detail'),
    );
    const temporalStability = clamp01(
        requireFiniteCause(waterSurfaceCause.stability, 'temporal'),
    );

    const waveEnergy = clamp01(
        0.12
        + windIntensity * 0.58
        + gustEnvelope * 0.16
        + rainIntensity * 0.12
        + postRainWeight * 0.025,
    );
    const roughness = clamp01(
        0.1
        + windIntensity * 0.4
        + gustEnvelope * 0.18
        + (1 - detailStability) * 0.12
        + (1 - reflectionStability) * 0.1
        + rainIntensity * 0.16
        + postRainWeight * 0.035,
    );
    const phaseRate = clampValue(
        (0.24 + windIntensity * 0.56 + gustEnvelope * 0.16)
        * (1.06 - temporalStability * 0.16),
        0.24,
        1.18,
    );
    const gravityWaveEnergy = clamp01(
        0.08 + waveEnergy * 0.72 + windIntensity * 0.18,
    );
    const capillaryWaveEnergy = clamp01(
        0.05
        + windIntensity * 0.26
        + gustEnvelope * 0.34
        + roughness * 0.2
        + (1 - detailStability) * 0.12
        + rainIntensity * 0.4
        + postRainWeight * 0.06,
    );
    const directionalSpread = clamp01(
        0.16
        + gustEnvelope * 0.34
        + (1 - spatialStability) * 0.3
        + (1 - reflectionStability) * 0.12
        + rainIntensity * 0.18,
    );

    const specularResponse = clamp01(
        reflectionStability * 0.6
        + (1 - roughness) * 0.4,
    );

    // Independent comparison modes consume these as projections; they do not drive the field.
    const waterSpeedMultiplier = clampValue(phaseRate * 1.45, 0.1, 5);
    const rippleIrregularity = clampValue(directionalSpread * 2.4, 0, 2.4);
    const rippleScale = clampValue(
        5.8 + gravityWaveEnergy * 2.8 + capillaryWaveEnergy * 1.4,
        4,
        12,
    );
    const refractionScale = clampValue(0.08 + roughness * 0.11, 0.05, 0.32);
    const refractionDensity = clampValue(0.72 + gravityWaveEnergy * 0.46, 0.5, 1.4);
    const refractionAnisotropy = clampValue(0.16 + directionalSpread * 0.52, 0, 1);
    const refractionJitter = clampValue(0.28 + roughness * 1.34, 0, 2.5);
    const refractionMicroScale = clampValue(0.68 + capillaryWaveEnergy * 0.72, 0.5, 1.5);
    const highlightOpacity = clamp01(0.48 + specularResponse * 0.52);
    const highlightFlutterSpeed = clampValue(phaseRate, 0.24, 1.18);

    const reflectionFactor = clamp01(diffuseSkylight);
    const mirrorFactor = clamp01(directSunlight);

    const pebbleExposure = 0.46;
    const bottomContrast = clamp01(
        clamp01(pondDepthStrength / 2.4)
        * (0.42 + transmittance * 0.44 + (1 - roughness) * 0.14),
    );

    const effectIntensityScale = clampValue(toNumber(safeQuality.effectIntensityScale, 1), 0, 2);
    return {
        coreEnv: {
            daylight,
            night,
            lightAmount,
            sceneBrightness,
            diurnalPhase,
            nightDepth,
            solarElevation,
            directSunlight,
            diffuseSkylight,
            sunTransmission,
            noonWeight,
            solarAltitudeRadians,
            sunDirectionX,
            sunDirectionY,
            sunDirectionZ,
            airHaze,
            cloudiness,
            cloudCover,
            overcastWeight,
            rainIntensity,
            weatherFrontWeight,
            postRainWeight,
            weatherRegime: safeEnv.weatherRegime,
            weatherEventScheduled: safeEnv.weatherEventScheduled === true,
            weatherEventActive: safeEnv.weatherEventActive === true,
            weatherEventId: safeEnv.weatherEventId,
            weatherEventKind: safeEnv.weatherEventKind,
            weatherEventPhase: safeEnv.weatherEventPhase,
            weatherEventProgress: clamp01(safeEnv.weatherEventProgress),
            weatherEventPhaseProgress: clamp01(safeEnv.weatherEventPhaseProgress),
            guaranteedRainDay: safeEnv.guaranteedRainDay === true,
            cloudOcclusion,
            envWaterClarity,
            waterTurbidity,
            windIntensity,
            windDirection,
            gustEnvelope,
            effectIntensityScale,
        },
        lighting: {
            directLight: directSunlight,
            ambientLight: diffuseSkylight,
            specularResponse,
            moonlight,
            causticStrength: directSunlight * transmittance,
        },
        surface: {
            roughness,
            waveEnergy,
            reflectionStability,
            phaseRate,
            gravityWaveEnergy,
            capillaryWaveEnergy,
            directionalSpread,
            spatialStability,
            detailStability,
            temporalStability,
            speedMultiplier: waterSpeedMultiplier,
            rippleScale,
            rippleIrregularity,
            refractionScale,
            refractionDensity,
            refractionAnisotropy,
            refractionJitter,
            refractionMicroScale,
            highlightOpacity,
            highlightFlutterSpeed,
        },
        waterMedium: {
            turbidity,
            scatter,
            transmittance,
            veilDensity: turbidity,
            hazeDensity: scatter,
        },
        bottom: {
            visibility: bottomVisibility,
            contrast: bottomContrast,
            pebbleExposure,
        },
        atmosphere: {
            reflectionFactor,
            mirrorFactor,
        },
        biotic: {
            bonsaiPetalSupply: bonsaiPetalCapacity,
            bonsaiBloomSupply: bonsaiBloomRatio,
            bonsaiPetalFallSupply: bonsaiPetalFallLimit,
            bonsaiPetalCapacity: effectivePetalCapacity,
            bonsaiBloomRatio: effectiveBloomRatio,
            bonsaiPetalFallLimit: effectivePetalFallLimit,
            bonsaiLeafBudSignal,
            bonsaiBudSignal,
            bonsaiPreviewPetalRate,
            bonsaiRippleVitality,
        },
    };
};
