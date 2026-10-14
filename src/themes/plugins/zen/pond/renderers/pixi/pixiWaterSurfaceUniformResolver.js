import { assertPixiFrameContract } from './pixiFrameChannels.js';
import { resolvePixiWaterSurfaceFeatureUniforms } from './pixiWaterSurfaceFeatureUniforms.js';
import { applyPixiWaterSurfaceOpticsUniforms } from './pixiWaterSurfaceOpticsUniformResolver.js';
import { applyPixiWaterYoonseulUniforms } from './pixiWaterYoonseulUniformResolver.js';

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const clampNumberOrZero = (value, min, max, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const resolveNonNegativeNumber = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, numeric);
};

const applyClampValue = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return clampNumber(numeric, min, max, fallback);
};

const WATER_SURFACE_TIME_WRAP_SECONDS = 8192;
const YOONSEUL_TIME_WRAP_SECONDS = 8192;

const roundSignatureValue = (value, digits = 4, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(fallback);
    return numeric.toFixed(digits);
};

const buildSurfaceFeatureUniformSignature = (effectDebugToggles = null) => {
    const featureUniforms = resolvePixiWaterSurfaceFeatureUniforms(effectDebugToggles);
    return [
        featureUniforms.pipelineMode,
        featureUniforms.surfaceNormalEnabled > 0.5 ? 1 : 0,
        featureUniforms.screenRefractionEnabled > 0.5 ? 1 : 0,
        featureUniforms.surfaceReflectionEnabled > 0.5 ? 1 : 0,
        featureUniforms.rgbSplitEnabled > 0.5 ? 1 : 0,
        featureUniforms.yoonseulEnabled > 0.5 ? 1 : 0,
        featureUniforms.surfaceFieldCausticsEnabled > 0.5 ? 1 : 0,
    ];
};

const buildSurfaceStaticUniformSignature = ({
    safeWidth = 1,
    safeHeight = 1,
    filterOriginX = 0,
    filterOriginY = 0,
    worldWidth = 1,
    worldHeight = 1,
    safeIntensityScale = 1,
    effectDebugToggles = null,
    currentTuning = null,
    surfaceStaticChannels = null,
} = {}) => [
    roundSignatureValue(safeWidth, 2, 1),
    roundSignatureValue(safeHeight, 2, 1),
    roundSignatureValue(filterOriginX, 2, 0),
    roundSignatureValue(filterOriginY, 2, 0),
    roundSignatureValue(worldWidth, 2, 1),
    roundSignatureValue(worldHeight, 2, 1),
    roundSignatureValue(safeIntensityScale, 4, 1),
    ...buildSurfaceFeatureUniformSignature(effectDebugToggles),
    String(currentTuning?.waterReflectionAlgorithm || ''),
    roundSignatureValue(currentTuning?.waterReflectionStability, 4, -1),
    roundSignatureValue(currentTuning?.waterReflectionSpatialStability, 4, -1),
    roundSignatureValue(currentTuning?.waterReflectionDetailStability, 4, -1),
    roundSignatureValue(currentTuning?.waterReflectionTemporalStability, 4, -1),
    roundSignatureValue(currentTuning?.waterReflectionSoftKnee, 4, -1),
    roundSignatureValue(surfaceStaticChannels?.surfaceSheenGain, 4, 0),
    roundSignatureValue(surfaceStaticChannels?.surfaceSparkleGain, 4, 0),
    roundSignatureValue(surfaceStaticChannels?.sunAngle, 4, 0),
    roundSignatureValue(surfaceStaticChannels?.windDirection, 4, 0),
    roundSignatureValue(surfaceStaticChannels?.sceneBrightness, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.daylightCurve, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.nightCurve, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.cloudiness, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.cloudOcclusion, 4, 0.84),
    roundSignatureValue(surfaceStaticChannels?.transmittance, 4, 0.7),
    roundSignatureValue(surfaceStaticChannels?.turbidity, 4, 0.42),
    roundSignatureValue(surfaceStaticChannels?.waveEnergy, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.roughness, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.specularResponse, 4, 0.5),
    roundSignatureValue(surfaceStaticChannels?.directLight, 4, 0.82),
].join('|');

const wrapPositiveTime = (value, wrapSeconds) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    const wrapped = numeric % wrapSeconds;
    return wrapped < 0 ? wrapped + wrapSeconds : wrapped;
};

const resolveSharedWaterSurfaceChannels = (frameChannels = null) => (
    frameChannels && typeof frameChannels === 'object'
        ? frameChannels
        : null
);

export const applyPixiWaterSurfaceFilterUpdate = function (
    deltaMs,
    width,
    height,
    currentTuning,
    intensityScale = 1.0,
    frameState = null,
    frameChannels = null,
    effectDebugToggles = null,
    filterRegion = null,
    updateOptions = null,
) {
// 1. Time progression
const safeDeltaMs = clampNumberOrZero(deltaMs, 0.5, 48, 16.6667);
const safeIntensityScale = clampNumber(intensityScale, 0, 2, 1);
this.applyFeatureToggleUniforms(effectDebugToggles);
const featureUniforms = resolvePixiWaterSurfaceFeatureUniforms(effectDebugToggles);
const surfaceOpticsUniformsEnabled = featureUniforms.surfaceOpticsEnabled > 0.5;
const resolvedFrameState = assertPixiFrameContract(frameState);
const sharedChannels = resolveSharedWaterSurfaceChannels(frameChannels);
if (!sharedChannels || sharedChannels.channels !== resolvedFrameState.channels) {
    throw new Error('ZEN_PIXI_WATER_SURFACE_FRAME_CONTRACT_MISSING');
}
const derivedChannels = resolvedFrameState.channels;
const unifiedSurface = derivedChannels?.surface || null;
const unifiedAtmosphere = derivedChannels?.atmosphere || null;
const waterTemporalProjection = sharedChannels.waterTemporalProjection || null;
const unifiedIllumination = derivedChannels?.lighting || null;
const unifiedWaveEnergy = clampNumber(unifiedSurface?.waveEnergy, 0, 1, 0.5);
const unifiedRoughness = clampNumber(unifiedSurface?.roughness, 0, 1, 0.5);
const unifiedTransmittance = clampNumber(
    sharedChannels.transmittance,
    0,
    1,
    0.7,
);
const unifiedTurbidity = clampNumber(
    sharedChannels.waterTurbidity,
    0,
    1,
    0.42,
);
const unifiedSpecularResponse = clampNumber(
    unifiedSurface?.specularResponse ?? unifiedIllumination?.specularResponse,
    0,
    1,
    0.5,
);
const unifiedDirectLight = clampNumber(
    unifiedIllumination?.directLight ?? unifiedIllumination?.direct,
    0,
    1.6,
    0.82,
);
const surfaceSheenGain = clampNumber(
    unifiedSurface?.surfaceSheenGain,
    0,
    1.6,
    0,
);
const surfaceSparkleGain = clampNumber(
    unifiedSurface?.surfaceSparkleGain,
    0,
    1.6,
    0,
);
const cloudCoverChannel = clampNumber(
    sharedChannels.cloudCover,
    0,
    1,
    0.5,
);
const cloudOcclusionChannel = clampNumber(
    sharedChannels.cloudOcclusion,
    0.18,
    1,
    0.84,
);
const windIntensityChannel = clampNumber(
    sharedChannels.windIntensity,
    0.08,
    1,
    0.4,
);
const flowPulseAmount = clampNumber(
    0.18
    + windIntensityChannel * 0.24
    + unifiedWaveEnergy * 0.22
    + (1 - cloudOcclusionChannel) * 0.16,
    0.12,
    0.82,
    0.34,
);
this.uniforms.uFlowMix = 0;
const flowTransport = clampNumber(
    waterTemporalProjection?.flowTransport,
    0.08,
    0.92,
    0.2 + unifiedWaveEnergy * 0.08,
);
this.uniforms.uFlowTransport = flowTransport;
const spectralSpread = clampNumber(
    0.22
    + unifiedWaveEnergy * 0.42
    + windIntensityChannel * 0.18
    + flowTransport * 0.16
    + (1 - cloudOcclusionChannel) * 0.12,
    0.08,
    0.96,
    0.46,
);
const spectralPeak = clampNumber(
    0.78
    + (1 - unifiedRoughness) * 0.22
    + unifiedWaveEnergy * 0.18
    - flowTransport * 0.08
    + (1 - cloudCoverChannel) * 0.06,
    0.55,
    1.45,
    0.92,
);
this.uniforms.uSpectralSpread = spectralSpread;
this.uniforms.uSpectralPeak = spectralPeak;
const temporalFlowRate = Number(waterTemporalProjection?.flowRate);
const flowRateFallback = clampNumber(this._smoothedFlowRate, 0.18, 1.45, 0.52);
const flowRate = clampNumber(
    Number.isFinite(temporalFlowRate) ? temporalFlowRate : flowRateFallback,
    0.18,
    1.45,
    flowRateFallback,
);
this._smoothedFlowRate = flowRate;
this._timeCounter = wrapPositiveTime(
    this._timeCounter + safeDeltaMs * 0.001 * flowRate,
    WATER_SURFACE_TIME_WRAP_SECONDS,
);
this.uniforms.uTime = this._timeCounter;
const temporalYoonseulRate = Number(waterTemporalProjection?.yoonseulRate);
const yoonseulRateFallback = clampNumber(this._smoothedYoonseulRate, 0.32, 1.28, 0.5);
const yoonseulRate = clampNumber(
    Number.isFinite(temporalYoonseulRate) ? temporalYoonseulRate : yoonseulRateFallback,
    0.32,
    1.28,
    yoonseulRateFallback,
);
this._smoothedYoonseulRate = yoonseulRate;
this._yoonseulTimeCounter = wrapPositiveTime(
    this._yoonseulTimeCounter + safeDeltaMs * 0.001 * yoonseulRate,
    YOONSEUL_TIME_WRAP_SECONDS,
);
this.uniforms.uYoonseulTime = this._yoonseulTimeCounter;
const pondDriftSpeed = clampNumber(
    0.00022 + unifiedWaveEnergy * 0.0011 + unifiedRoughness * 0.0005,
    0.00018,
    0.0022,
    0.00085,
);
const driftSpeed = pondDriftSpeed;
this.uniforms.uSpeed[0] = driftSpeed * 0.86;
this.uniforms.uSpeed[1] = driftSpeed * 1.08;

// 2. Resolution for correct aspect ratio scaling
const safeWidth = Math.max(1, resolveNonNegativeNumber(width, this.uniforms.uResolution[0] || 1));
const safeHeight = Math.max(1, resolveNonNegativeNumber(height, this.uniforms.uResolution[1] || 1));
const filterOriginX = resolveNonNegativeNumber(filterRegion?.x, 0);
const filterOriginY = resolveNonNegativeNumber(filterRegion?.y, 0);
const worldWidth = Math.max(
    1,
    resolveNonNegativeNumber(filterRegion?.worldWidth, filterOriginX + safeWidth),
);
const worldHeight = Math.max(
    1,
    resolveNonNegativeNumber(filterRegion?.worldHeight, filterOriginY + safeHeight),
);
const daylight = clampNumber(
    sharedChannels.daylight,
    0,
    1,
    0.5,
);
const moonlight = clampNumber(sharedChannels.moonlight, 0, 1, 0);
const cloudiness = clampNumber(
    sharedChannels.cloudiness,
    0,
    1,
    cloudCoverChannel,
);
const lightAmount = clampNumber(
    sharedChannels.lightAmount,
    0,
    1,
    0.5,
);
const sceneBrightness = Number(sharedChannels.sceneBrightness);
if (!Number.isFinite(sceneBrightness)) {
    throw new Error('ZEN_PIXI_WATER_SURFACE_SCENE_BRIGHTNESS_REQUIRED');
}
const diurnalPhase = clampNumber(
    sharedChannels.diurnalPhase,
    0,
    1,
    daylight,
);
const nightDepth = clampNumber(
    sharedChannels.nightDepth,
    0,
    1,
    1 - diurnalPhase,
);
const daylightCurve = diurnalPhase;
const nightCurve = nightDepth;
const sunAngle = Number(sharedChannels.sunAngle);
const windDirection = Number(sharedChannels.windDirection);
if (!Number.isFinite(sunAngle)) {
    throw new Error('ZEN_PIXI_WATER_SURFACE_SUN_ANGLE_MISSING');
}
if (!Number.isFinite(windDirection)) {
    throw new Error('ZEN_PIXI_WATER_SURFACE_WIND_DIRECTION_MISSING');
}
const surfaceStaticSignature = buildSurfaceStaticUniformSignature({
    safeWidth,
    safeHeight,
    filterOriginX,
    filterOriginY,
    worldWidth,
    worldHeight,
    safeIntensityScale,
    effectDebugToggles,
    currentTuning,
    surfaceStaticChannels: {
        surfaceSheenGain,
        surfaceSparkleGain,
        sunAngle,
        windDirection,
        sceneBrightness,
        daylightCurve,
        nightCurve,
        cloudiness,
        cloudOcclusion: cloudOcclusionChannel,
        transmittance: unifiedTransmittance,
        turbidity: unifiedTurbidity,
        waveEnergy: unifiedWaveEnergy,
        roughness: unifiedRoughness,
        specularResponse: unifiedSpecularResponse,
        directLight: unifiedDirectLight,
    },
});
const runStaticUniformUpdate = (
    updateOptions?.fullUpdate !== false
    || this._surfaceUniformStaticApplied !== true
    || this._surfaceUniformStaticSignature !== surfaceStaticSignature
);
this._lastSurfaceUniformFullUpdate = runStaticUniformUpdate;
if (!runStaticUniformUpdate) {
    return;
}
this._surfaceUniformStaticApplied = true;
this._surfaceUniformStaticSignature = surfaceStaticSignature;
this.uniforms.uResolution[0] = safeWidth;
this.uniforms.uResolution[1] = safeHeight;
this.uniforms.uFilterOrigin[0] = filterOriginX;
this.uniforms.uFilterOrigin[1] = filterOriginY;
this.uniforms.uWorldResolution[0] = worldWidth;
this.uniforms.uWorldResolution[1] = worldHeight;

// 3. Scale / Refraction Strength and Water Ripple Size
const baseScale = applyClampValue(unifiedSurface?.rippleScale, 1, 15, 8.4);
this.uniforms.uWaterScale = baseScale * 1.18;

const irregularityControl = applyClampValue(unifiedSurface?.rippleIrregularity, 0, 2.4, 0.72);
this.uniforms.uIrregularity = clampNumber(
    irregularityControl * 0.68 * (0.72 + unifiedRoughness * 0.55),
    0,
    2,
    0.68,
);
const moonCurve = clampNumber(Math.pow(moonlight, 0.9), 0, 1, moonlight);
this.uniforms.uCurrentDir[0] = Math.cos(windDirection);
this.uniforms.uCurrentDir[1] = Math.sin(windDirection);

if (surfaceOpticsUniformsEnabled) {
    applyPixiWaterSurfaceOpticsUniforms(this, {
        unifiedSurface,
        unifiedAtmosphere,
        unifiedWaveEnergy,
        unifiedRoughness,
        unifiedTransmittance,
        unifiedTurbidity,
        unifiedSpecularResponse,
        unifiedDirectLight,
        cloudCoverChannel,
        cloudOcclusionChannel,
        windIntensityChannel,
        flowPulseAmount,
        flowTransport,
        safeIntensityScale,
        sceneBrightness,
        cloudiness,
        daylightCurve,
        nightCurve,
        moonCurve,
        surfaceSheenGain,
        baseScale,
        waterTemporal: waterTemporalProjection,
        sharedChannels,
    });
}

applyPixiWaterYoonseulUniforms(this, {
    unifiedSpecularResponse,
    unifiedDirectLight,
    unifiedRoughness,
    unifiedWaveEnergy,
    sceneBrightness,
    cloudCoverChannel,
    cloudOcclusionChannel,
    windIntensityChannel,
    flowTransport,
    surfaceSparkleGain,
    waterTemporal: waterTemporalProjection,
    currentTuning,
    sunAngle,
    sharedChannels,
    daylightCurve,
    moonlight,
    moonCurve,
    nightCurve,
    flowPulseAmount,
});
};
