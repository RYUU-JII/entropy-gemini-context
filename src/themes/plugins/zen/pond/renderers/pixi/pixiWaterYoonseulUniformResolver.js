import { resolvePixiYoonseulModel } from './pixiWaterYoonseulModel.js';
import {
    ZEN_WATER_REFLECTION_ALGORITHMS,
    normalizeZenWaterReflectionAlgorithm,
    resolveZenWaterReflectionAlgorithmMode,
} from '../../contracts/zenWaterReflectionAlgorithms.js';

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const resolveReflectionStability = (algorithm, value) => {
    const fallback = algorithm === ZEN_WATER_REFLECTION_ALGORITHMS.GGX ? 0 : 0.72;
    return clampNumber(value, 0, 1, fallback);
};

const resolveReflectionStabilityAxis = (algorithm, value, fallback) => {
    if (algorithm === ZEN_WATER_REFLECTION_ALGORITHMS.GGX) return 0;
    return clampNumber(value, 0, 1, fallback);
};

const resolveReflectionSoftKnee = (value) => clampNumber(value, 0, 1, 0);

const parseLightColor = (lightColor) => {
    if (typeof lightColor !== 'string') return null;
    const match = lightColor.match(/[\d.]+/g);
    if (!Array.isArray(match) || match.length < 3) return null;
    const r = clampNumber(Number(match[0]) || 0, 0, 255, 255) / 255;
    const g = clampNumber(Number(match[1]) || 0, 0, 255, 255) / 255;
    const b = clampNumber(Number(match[2]) || 0, 0, 255, 255) / 255;
    return [r, g, b];
};

const normalizeVec3 = (x, y, z, fallback = [0.2, 0.1, 1.0]) => {
    const nx = Number(x);
    const ny = Number(y);
    const nz = Number(z);
    const len = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(len) || len <= 1e-6) return fallback;
    return [nx / len, ny / len, nz / len];
};

export const applyPixiWaterYoonseulUniforms = (filter, context = {}) => {
    const {
        unifiedSpecularResponse = 0.5,
        unifiedDirectLight = 0.82,
        unifiedRoughness = 0.5,
        unifiedWaveEnergy = 0.5,
        sceneBrightness = 0.5,
        cloudCoverChannel = 0.5,
        cloudOcclusionChannel = 0.84,
        windIntensityChannel = 0.4,
        flowTransport = 0.34,
        surfaceSparkleGain = 0,
        waterTemporal = null,
        currentTuning = null,
        sunAngle = Math.PI / 4,
        sharedChannels = null,
        daylightCurve = 0.5,
        moonlight = 0,
        moonCurve = 0,
        nightCurve = 0.5,
        flowPulseAmount = 0.34,
    } = context;

    const yoonseulModel = resolvePixiYoonseulModel({
        unifiedSpecularResponse,
        unifiedDirectLight,
        unifiedRoughness,
        unifiedWaveEnergy,
        sceneBrightness,
        cloudCover: cloudCoverChannel,
        cloudOcclusion: cloudOcclusionChannel,
        windIntensity: windIntensityChannel,
        flowTransport,
        surfaceSparkleGain,
        waterTemporal,
    });
    const waterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
        currentTuning?.waterReflectionAlgorithm,
    );
    const waterReflectionAlgorithmMode = resolveZenWaterReflectionAlgorithmMode(
        waterReflectionAlgorithm,
    );
    const waterReflectionStability = resolveReflectionStability(
        waterReflectionAlgorithm,
        currentTuning?.waterReflectionStability,
    );
    const waterReflectionSpatialStability = resolveReflectionStabilityAxis(
        waterReflectionAlgorithm,
        currentTuning?.waterReflectionSpatialStability,
        waterReflectionStability,
    );
    const waterReflectionDetailStability = resolveReflectionStabilityAxis(
        waterReflectionAlgorithm,
        currentTuning?.waterReflectionDetailStability,
        waterReflectionStability,
    );
    const waterReflectionTemporalStability = resolveReflectionStabilityAxis(
        waterReflectionAlgorithm,
        currentTuning?.waterReflectionTemporalStability,
        waterReflectionStability,
    );
    const waterReflectionSoftKnee = resolveReflectionSoftKnee(currentTuning?.waterReflectionSoftKnee);

    const rawSunDirX = Math.cos(sunAngle - Math.PI * 0.18) * 0.85;
    const rawSunDirY = Math.sin(sunAngle - Math.PI * 0.18) * 0.65;
    const sunDir = normalizeVec3(rawSunDirX, rawSunDirY, 1.18, [0.24, 0.12, 0.96]);
    filter.uniforms.uSunDir[0] = sunDir[0];
    filter.uniforms.uSunDir[1] = sunDir[1];
    filter.uniforms.uSunDir[2] = sunDir[2];

    const lightColorInput = typeof sharedChannels?.lightColor === 'string'
        ? sharedChannels.lightColor
        : '';
    const sharedLightChannels = sharedChannels?.lightChannels;
    let parsedLight = null;
    if (
        sharedLightChannels
        && Number.isFinite(Number(sharedLightChannels.r))
        && Number.isFinite(Number(sharedLightChannels.g))
        && Number.isFinite(Number(sharedLightChannels.b))
    ) {
        parsedLight = [
            clampNumber(sharedLightChannels.r, 0, 255, 255) / 255,
            clampNumber(sharedLightChannels.g, 0, 255, 255) / 255,
            clampNumber(sharedLightChannels.b, 0, 255, 255) / 255,
        ];
        filter._cachedLightColorInput = '';
        filter._cachedLightColor = null;
    } else if (lightColorInput) {
        if (lightColorInput === filter._cachedLightColorInput) {
            parsedLight = filter._cachedLightColor;
        } else {
            parsedLight = parseLightColor(lightColorInput);
            filter._cachedLightColorInput = lightColorInput;
            filter._cachedLightColor = parsedLight;
        }
    } else {
        filter._cachedLightColorInput = '';
        filter._cachedLightColor = null;
    }

    const baseSunR = 1.0;
    const baseSunG = 0.97;
    const baseSunB = 0.9;
    const tintMix = clampNumber(0.2 + daylightCurve * 0.64 + moonlight * 0.16, 0.16, 1, 0.48);
    const lightR = parsedLight ? parsedLight[0] : baseSunR;
    const lightG = parsedLight ? parsedLight[1] : baseSunG;
    const lightB = parsedLight ? parsedLight[2] : baseSunB;
    const moonTintMix = clampNumber(nightCurve * (0.16 + moonCurve * 0.44), 0, 0.66, 0.24);
    const moonTintR = 0.78;
    const moonTintG = 0.86;
    const moonTintB = 1.0;
    const mixedSunR = (baseSunR * (1 - tintMix)) + (lightR * tintMix);
    const mixedSunG = (baseSunG * (1 - tintMix)) + (lightG * tintMix);
    const mixedSunB = (baseSunB * (1 - tintMix)) + (lightB * tintMix);
    const sunR = (mixedSunR * (1 - moonTintMix)) + (moonTintR * moonTintMix);
    const sunG = (mixedSunG * (1 - moonTintMix)) + (moonTintG * moonTintMix);
    const sunB = (mixedSunB * (1 - moonTintMix)) + (moonTintB * moonTintMix);
    const sunEnergyBase = 0.04 + daylightCurve * 11.2 + moonlight * 0.34;
    const nightEnergyScale = 1 - nightCurve * 0.72 + moonCurve * 0.12;
    const sunEnergy = sunEnergyBase * nightEnergyScale;
    filter.uniforms.uSunColor[0] = sunR * sunEnergy;
    filter.uniforms.uSunColor[1] = sunG * sunEnergy;
    filter.uniforms.uSunColor[2] = sunB * sunEnergy;

    filter.uniforms.uYoonseulIntensity = yoonseulModel.yoonseulIntensity;
    filter.uniforms.uYoonseulSharpness = yoonseulModel.yoonseulSharpness;
    filter.uniforms.uYoonseulPatchScale = yoonseulModel.yoonseulPatchScale;
    filter.uniforms.uYoonseulMotion = yoonseulModel.yoonseulMotion;
    filter.uniforms.uYoonseulOpacity = yoonseulModel.yoonseulOpacity;
    filter.uniforms.uYoonseulFlickerAmount = yoonseulModel.yoonseulFlickerAmount;
    filter.uniforms.uYoonseulTemporalCoherence = yoonseulModel.yoonseulTemporalCoherence;
    filter.uniforms.uYoonseulLowBand = yoonseulModel.yoonseulLowBand;
    filter.uniforms.uYoonseulMicroBand = yoonseulModel.yoonseulMicroBand;
    filter.uniforms.uYoonseulGlintStability = yoonseulModel.yoonseulGlintStability;
    filter.uniforms.uYoonseulBeatDamping = yoonseulModel.yoonseulBeatDamping;
    filter.uniforms.uYoonseulAlgorithmMode = waterReflectionAlgorithmMode;
    filter.uniforms.uYoonseulStability = waterReflectionStability;
    filter.uniforms.uYoonseulSpatialStability = waterReflectionSpatialStability;
    filter.uniforms.uYoonseulDetailStability = waterReflectionDetailStability;
    filter.uniforms.uYoonseulTemporalStability = waterReflectionTemporalStability;
    filter.uniforms.uYoonseulSoftKnee = waterReflectionSoftKnee;
    filter.uniforms.uFlowPulseAmount = flowPulseAmount;
};
