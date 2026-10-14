import { assertPixiFrameContract } from '../pixiFrameChannels.js';
import { resolveZenWaterReflectionAlgorithmMode } from '../../../contracts/zenWaterReflectionAlgorithms.js';
import {
    ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL,
    ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID,
} from '../../../contracts/zenWaterSurfaceFieldYoonseulModel.js';

import { ZEN_WATER_SKY_REFLECTION_BUDGET } from '../pixiWaterSkyReflectionBudget.js';

const RAIN_RIPPLE_VISIBILITY_START = 0.04;
const RAIN_RIPPLE_VISIBILITY_FULL = 0.48;

const clampNumber = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error('ZEN_PIXI_SURFACE_FIELD_PRESENTATION_VALUE_MISSING');
    }
    return Math.min(max, Math.max(min, numeric));
};

const requireFinite = (value, fieldName) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_PIXI_SURFACE_FIELD_PRESENTATION_CHANNEL_MISSING:${fieldName}`);
    }
    return numeric;
};

const normalizeVec3 = (x, y, z) => {
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length <= 1e-6) {
        throw new Error('ZEN_PIXI_SURFACE_FIELD_SUN_DIRECTION_INVALID');
    }
    return [x / length, y / length, z / length];
};

const smoothstepNumber = (edge0, edge1, value) => {
    const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

export const resolveZenRainRippleVisibilityDrive = (rainIntensity) => {
    const rain = clampNumber(rainIntensity, 0, 1);
    // The field already owns rain density and impact amplitude. This curve only
    // keeps drizzle visible through the overcast presentation gate while
    // preserving the established steady-rain and storm ceilings.
    const presence = smoothstepNumber(
        RAIN_RIPPLE_VISIBILITY_START,
        RAIN_RIPPLE_VISIBILITY_FULL,
        rain,
    );
    return presence * (0.07 + rain * 0.2);
};

export const applyPixiWaterSurfaceFieldUniforms = (filter, {
    width,
    height,
    currentTuning = null,
    intensityScale = 1,
    frameState = null,
    frameChannels = null,
    filterRegion = null,
} = {}) => {
    const resolvedFrameState = assertPixiFrameContract(frameState);
    if (!frameChannels || frameChannels.channels !== resolvedFrameState.channels) {
        throw new Error('ZEN_PIXI_WATER_SURFACE_FRAME_CONTRACT_MISSING');
    }
    const channels = resolvedFrameState.channels;
    const lighting = channels.lighting;
    const atmosphere = channels.atmosphere;
    const waterMedium = channels.waterMedium;
    const surface = channels.surface;
    const safeWidth = Math.max(1, requireFinite(width, 'filter.width'));
    const safeHeight = Math.max(1, requireFinite(height, 'filter.height'));
    const originX = Number.isFinite(Number(filterRegion?.x)) ? Math.max(0, Number(filterRegion.x)) : 0;
    const originY = Number.isFinite(Number(filterRegion?.y)) ? Math.max(0, Number(filterRegion.y)) : 0;
    const worldWidth = Number.isFinite(Number(filterRegion?.worldWidth))
        ? Math.max(1, Number(filterRegion.worldWidth))
        : safeWidth;
    const worldHeight = Number.isFinite(Number(filterRegion?.worldHeight))
        ? Math.max(1, Number(filterRegion.worldHeight))
        : safeHeight;

    filter.uniforms.uResolution[0] = safeWidth;
    filter.uniforms.uResolution[1] = safeHeight;
    filter.uniforms.uFilterOrigin[0] = originX;
    filter.uniforms.uFilterOrigin[1] = originY;
    filter.uniforms.uWorldResolution[0] = worldWidth;
    filter.uniforms.uWorldResolution[1] = worldHeight;

    const env = resolvedFrameState.frameEnv;
    const sunDirection = normalizeVec3(
        requireFinite(env.sunDirectionX, 'frameEnv.sunDirectionX'),
        requireFinite(env.sunDirectionY, 'frameEnv.sunDirectionY'),
        requireFinite(env.sunDirectionZ, 'frameEnv.sunDirectionZ'),
    );
    filter.uniforms.uSunDir[0] = sunDirection[0];
    filter.uniforms.uSunDir[1] = sunDirection[1];
    filter.uniforms.uSunDir[2] = sunDirection[2];

    const daylight = clampNumber(lighting.diurnalPhase, 0, 1);
    const nightDepth = clampNumber(lighting.nightDepth, 0, 1);
    const moonlight = clampNumber(lighting.moonlight, 0, 1);
    const directLight = clampNumber(lighting.directSunlight, 0, 1.25);
    const diffuseSkylight = clampNumber(lighting.diffuseSkylight, 0, 0.5);
    const sceneBrightness = Math.max(0, requireFinite(lighting.sceneBrightness, 'lighting.sceneBrightness'));
    const cloudiness = clampNumber(atmosphere.cloudiness, 0, 1);
    const transmittance = clampNumber(waterMedium.transmittance, 0, 1);
    const turbidity = clampNumber(waterMedium.turbidity, 0, 1);
    const roughness = clampNumber(surface.roughness, 0, 1);
    const reflectionStability = clampNumber(surface.reflectionStability, 0, 1);
    const waveEnergy = clampNumber(surface.waveEnergy, 0, 1);
    const specularResponse = clampNumber(surface.specularResponse, 0, 1);
    const sparkleGain = clampNumber(surface.surfaceSparkleGain, 0, 1.6);
    const rainIntensity = clampNumber(atmosphere.rainIntensity, 0, 1);
    const safeIntensityScale = clampNumber(intensityScale, 0, 2);

    const lightChannels = frameChannels.lightChannels;
    const lightR = clampNumber(requireFinite(lightChannels?.r, 'lightChannels.r'), 0, 255) / 255;
    const lightG = clampNumber(requireFinite(lightChannels?.g, 'lightChannels.g'), 0, 255) / 255;
    const lightB = clampNumber(requireFinite(lightChannels?.b, 'lightChannels.b'), 0, 255) / 255;
    const moonCurve = Math.pow(moonlight, 0.9);
    const sunEnergy = directLight * 11.2;
    filter.uniforms.uSunColor[0] = lightR * sunEnergy;
    filter.uniforms.uSunColor[1] = lightG * sunEnergy;
    filter.uniforms.uSunColor[2] = lightB * sunEnergy;
    // Display visibility of an unlit material is a presentation response,
    // separate from physical irradiance and from the canonical night phase.
    const twilightWeight = clampNumber(env?.ambientChromaticState?.twilightWeight, 0, 1);
    const nightWeight = clampNumber(env?.ambientChromaticState?.nightWeight, 0, 1);
    const twilightFactor = twilightWeight * (1 - nightWeight);
    // Solar night-depth reaches almost zero before direct light is available
    // at the horizon. Bridge that interval to avoid a black dip at dawn/dusk.
    const horizonVisibility = (1 - smoothstepNumber(0, 0.18, sunDirection[2])) * (1 - nightWeight) * 0.26;
    const twilightVisibility = twilightFactor * 0.5 + horizonVisibility;
    // A bounded silver-blue night response makes pale living material readable
    // while dark pigment retains the pond's depth. This display response never
    // feeds caustics or directional shadows; the world's moon scalar is shared.
    const nightVisibility = nightDepth * (0.18 + moonlight * 0.14);
    filter.uniforms.uMaterialLight[0] = directLight * lightR + diffuseSkylight * 0.84 + twilightVisibility * lightR + nightVisibility * 1.02;
    filter.uniforms.uMaterialLight[1] = directLight * lightG + diffuseSkylight * 0.93 + twilightVisibility * lightG + nightVisibility * 1.12;
    filter.uniforms.uMaterialLight[2] = directLight * lightB + diffuseSkylight + twilightVisibility * lightB + nightVisibility * 1.86;
    filter.uniforms.uMoonlitMaterialMix = nightDepth * 0.88;
    filter.uniforms.uMoonlitSkyStrength = nightDepth * (0.06 + moonlight * 0.16) * (1 - cloudiness * 0.5);
    filter.uniforms.uCloudPhase[0] = requireFinite(env.cloudPhaseX, 'frameEnv.cloudPhaseX');
    filter.uniforms.uCloudPhase[1] = requireFinite(env.cloudPhaseY, 'frameEnv.cloudPhaseY');
    filter.uniforms.uCloudThreshold = requireFinite(env.cloudThreshold, 'frameEnv.cloudThreshold');
    filter.uniforms.uCloudDensity = requireFinite(env.cloudDensity, 'frameEnv.cloudDensity');
    filter.uniforms.uDiffuseSkylight = diffuseSkylight;
    filter.uniforms.uAirHaze = requireFinite(env.airHaze, 'frameEnv.airHaze');

    // Radiance already contains cloud transmission. The lobe only consumes
    // material response here, rather than multiplying the weather gate again.
    const yoonseulIntensity = clampNumber(
        (specularResponse * 0.98 + (1 - roughness) * 0.16) * safeIntensityScale, 0, 2,
    );
    const yoonseulOpacity = clampNumber(0.68 + sparkleGain * 0.58, 0, 2.4);
    const yoonseulFocus = clampNumber(
        specularResponse * 0.48 + (directLight / 1.6) * 0.34 + sparkleGain * 0.18,
        0,
        1,
    );
    filter.uniforms.uYoonseulIntensity = yoonseulIntensity;
    filter.uniforms.uYoonseulOpacity = yoonseulOpacity;
    filter.uniforms.uYoonseulFocus = yoonseulFocus;
    filter.uniforms.uSurfaceRoughness = roughness;
    const rainRippleVisibilityDrive = resolveZenRainRippleVisibilityDrive(
        rainIntensity,
    );
    filter.uniforms.uRainRippleVisibilityDrive = rainRippleVisibilityDrive;

    const reflectionFactor = clampNumber(surface.reflectionFactor, 0, 1.6);
    const mirrorFactor = clampNumber(surface.mirrorFactor, 0, 1.2);
    const calmOpticsGate = clampNumber(
        (1 - roughness * 0.5)
        * (0.62 + transmittance * 0.38)
        * (0.72 + specularResponse * 0.28),
        0,
        1,
    );
    const skyReflectionDrive = clampNumber(
        reflectionFactor * 0.34
        + mirrorFactor * 0.26
        + (1 - cloudiness) * daylight * 0.18
        + moonCurve * 0.06,
        0,
        1.4,
    );
    const duskWeight = Number.isFinite(Number(env?.ambientChromaticState?.duskWeight))
        ? clampNumber(env.ambientChromaticState.duskWeight, 0, 1)
        : 0;
    const warmthWeight = Number.isFinite(Number(env?.ambientChromaticState?.warmth))
        ? clampNumber(env.ambientChromaticState.warmth, 0, 1)
        : 0;
    const duskFactor = Math.max(duskWeight, warmthWeight * 0.8);
    const sunsetWeight = clampNumber(Math.max(duskFactor, (1 - daylight) * (1 - nightDepth) * 2.5), 0, 1);

    const duskReflectionBoost = sunsetWeight * 0.028 * (1 - cloudiness * 0.6);
    const reflectionStrength = clampNumber(
        (0.022 + (skyReflectionDrive + duskReflectionBoost) * 0.075)
        * calmOpticsGate
        * (0.82 + safeIntensityScale * 0.18),
        0.012,
        0.135,
    );
    const skyGrey = clampNumber(0.34 + cloudiness * 0.3 + moonCurve * 0.08, 0, 1);
    const skyBlue = clampNumber(0.5 + daylight * 0.34 + moonCurve * 0.18, 0, 1.1);
    const skyWarmth = clampNumber(daylight * (1 - cloudiness * 0.48) + moonCurve * 0.14, 0, 1);

    const baseReflectR = clampNumber(0.42 + skyWarmth * 0.24 + skyGrey * 0.12, 0, 1.15);
    const baseReflectG = clampNumber(0.52 + skyWarmth * 0.18 + skyGrey * 0.16, 0, 1.15);
    const baseReflectB = clampNumber(0.62 + skyBlue * 0.2 + skyGrey * 0.12, 0, 1.18);

    const duskReflectR = clampNumber(0.72 * lightR + 0.22, 0, 1.15);
    const duskReflectG = clampNumber(0.58 * lightG + 0.18, 0, 1.15);
    const duskReflectB = clampNumber(0.50 * lightB + 0.26, 0, 1.18);

    filter.uniforms.uSurfaceReflectionColor[0] = baseReflectR * (1 - sunsetWeight) + duskReflectR * sunsetWeight;
    filter.uniforms.uSurfaceReflectionColor[1] = baseReflectG * (1 - sunsetWeight) + duskReflectG * sunsetWeight;
    filter.uniforms.uSurfaceReflectionColor[2] = baseReflectB * (1 - sunsetWeight) + duskReflectB * sunsetWeight;
    filter.uniforms.uSurfaceReflectionStrength = reflectionStrength;

    // Broad illumination is already applied by uMaterialLight. The remaining
    // light color serves view-dependent sky reflection and local rain glints.
    filter.uniforms.uSurfaceSheenColor[0] = lightR;
    filter.uniforms.uSurfaceSheenColor[1] = lightG;
    filter.uniforms.uSurfaceSheenColor[2] = lightB;

    const refractionVisibility = clampNumber((0.34 + transmittance * 0.62) * 0.9, 0.2, 1);
    filter.uniforms.uRefractionVisibility = refractionVisibility;
    filter.uniforms.uRefractionMix = clampNumber(
        0.11 + (1 - refractionVisibility) * 0.25 + turbidity * 0.055 + waveEnergy * 0.035,
        0.08,
        0.36,
    );

    return {
        pipelineMode: filter.pipelineMode,
        algorithmMode: resolveZenWaterReflectionAlgorithmMode(currentTuning?.waterReflectionAlgorithm),
        stability: reflectionStability,
        spatialStability: surface.spatialStability,
        detailStability: surface.detailStability,
        temporalStability: surface.temporalStability,
        phaseRate: surface.phaseRate,
        intensity: yoonseulIntensity,
        opacity: yoonseulOpacity,
        drive: yoonseulIntensity * yoonseulOpacity,
        yoonseulModelId: ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID,
        yoonseulTopViewBlendMin:
            ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.topViewBlendMin,
        yoonseulTopViewBlendMax:
            ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.topViewBlendMax,
        yoonseulCoverageRoughnessMin:
            ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageRoughnessMin,
        yoonseulCoverageRoughnessMax:
            ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageRoughnessMax,
        yoonseulCoverageWeightUnfocused:
            ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageWeightUnfocused,
        yoonseulCoverageWeightFocused:
            ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageWeightFocused,
        rainRippleVisibilityDrive,
        cloudReflectionEnabled: filter.uniforms.uCloudReflectionEnabled > 0.5,
        cloudFieldSeed: env.cloudSeed,
        cloudFieldTextureCount: ZEN_WATER_SKY_REFLECTION_BUDGET.textureCount,
        cloudFieldTextureBytes: ZEN_WATER_SKY_REFLECTION_BUDGET.textureBytes,
        cloudReflectionAdditionalPasses: ZEN_WATER_SKY_REFLECTION_BUDGET.additionalRenderPasses,
        sunTransmission: lighting.sunTransmission,
        directSunlight: directLight,
        diffuseSkylight,
        sceneBrightness,
        focus: yoonseulFocus,
        roughness,
        yoonseulEnabled: filter.uniforms.uYoonseulEnabled > 0.5,
        surfaceOpticsEnabled: filter.uniforms.uSurfaceOpticsEnabled > 0.5,
        surfaceNormalEnabled: filter.uniforms.uSurfaceNormalEnabled > 0.5,
        screenRefractionEnabled: filter.uniforms.uScreenRefractionEnabled > 0.5,
        surfaceReflectionEnabled: filter.uniforms.uSurfaceReflectionEnabled > 0.5,
        rgbSplitEnabled: filter.uniforms.uRgbSplitEnabled > 0.5,
        surfaceFieldReady: filter.uniforms.uSurfaceFieldReady > 0.5,
        surfaceFieldCausticsEnabled: filter.surfaceFieldCausticsEnabled === true,
    };
};
