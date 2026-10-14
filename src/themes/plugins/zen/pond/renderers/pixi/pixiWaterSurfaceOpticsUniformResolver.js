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

const clamp01 = (value, fallback = 0) => clampNumber(value, 0, 1, fallback);

const applyClampValue = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return clampNumber(numeric, min, max, fallback);
};

const clampRefraction = (value) => clampNumber(value, 0, 0.065, 0);

const WATER_REFRACTION_STRENGTH = 0.46;
const WATER_REFRACTION_VISIBILITY_STRENGTH = 0.9;

export const applyPixiWaterSurfaceOpticsUniforms = (filter, context = {}) => {
    const {
        unifiedSurface = null,
        unifiedAtmosphere = null,
        unifiedWaveEnergy = 0.5,
        unifiedRoughness = 0.5,
        unifiedTransmittance = 0.7,
        unifiedTurbidity = 0.42,
        unifiedSpecularResponse = 0.5,
        unifiedDirectLight = 0.82,
        cloudCoverChannel = 0.5,
        cloudOcclusionChannel = 0.84,
        windIntensityChannel = 0.4,
        flowPulseAmount = 0.34,
        flowTransport = 0.34,
        safeIntensityScale = 1,
        sceneBrightness = 0.5,
        cloudiness = 0.5,
        daylightCurve = 0.5,
        nightCurve = 0.5,
        moonCurve = 0,
        surfaceSheenGain = 0,
        baseScale = 8.4,
        sharedChannels = null,
    } = context;

    const refractionControl = applyClampValue(unifiedSurface?.refractionScale, 0, 2.4, 0.14);
    const refractionDensity = applyClampValue(unifiedSurface?.refractionDensity, 0.55, 2.4, 1.0);
    const refractionAnisotropy = applyClampValue(unifiedSurface?.refractionAnisotropy, 0, 1, 0.35);
    const refractionMicroScale = applyClampValue(unifiedSurface?.refractionMicroScale, 0.5, 3.2, 1.0);
    const refractionJitter = applyClampValue(unifiedSurface?.refractionJitter, 0, 2.5, 1.0);
    filter.uniforms.uRefractionDensity = refractionDensity;
    filter.uniforms.uRefractionAnisotropy = refractionAnisotropy;
    filter.uniforms.uRefractionMicroScale = refractionMicroScale;
    filter.uniforms.uRefractionJitter = refractionJitter;

    const rippleTightness = clamp01((baseScale - 1.0) / 14.0);
    const turbulencePulse = clampNumber(
        context.waterTemporal?.turbulencePulse,
        0.52,
        1.64,
        1,
    );
    const gustBase = (
        0.36
        + flowPulseAmount * (0.16 + flowTransport * 0.08)
        + unifiedWaveEnergy * 0.18
        + windIntensityChannel * 0.14
        + flowTransport * 0.06
    ) * turbulencePulse;

    const turbulence = clampNumberOrZero(
        gustBase
        + rippleTightness * 0.11
        + clamp01(refractionControl / 2) * 0.05
        + refractionJitter * 0.05
        + unifiedRoughness * 0.1,
        0.06 + flowTransport * 0.03,
        0.72 + flowTransport * 0.16,
        0.28 + flowTransport * 0.08,
    );
    filter.uniforms.uTurbulence = turbulence;

    const reflectionFactor = clampNumber(
        unifiedAtmosphere?.reflectionFactor,
        0,
        1.6,
        cloudCoverChannel * (0.16 + sceneBrightness * 0.56),
    );
    const mirrorFactor = clampNumber(
        unifiedAtmosphere?.mirrorFactor,
        0,
        1.2,
        (1 - cloudCoverChannel) * sceneBrightness,
    );
    const calmOpticsGate = clampNumber(
        (1 - unifiedRoughness * 0.5)
        * (0.62 + unifiedTransmittance * 0.38)
        * (0.72 + unifiedSpecularResponse * 0.28),
        0,
        1,
        0.62,
    );
    const skyReflectionDrive = clampNumber(
        reflectionFactor * 0.34
        + mirrorFactor * 0.26
        + (1 - cloudiness) * daylightCurve * 0.18
        + moonCurve * 0.06,
        0,
        1.4,
        0.32,
    );

    const duskWeight = clampNumber(sharedChannels?.frameEnv?.ambientChromaticState?.duskWeight, 0, 1, 0);
    const warmthWeight = clampNumber(sharedChannels?.frameEnv?.ambientChromaticState?.warmth, 0, 1, 0);
    const duskFactor = Math.max(duskWeight, warmthWeight * 0.8);
    const sunsetWeight = clampNumber(Math.max(duskFactor, (1 - daylightCurve) * (1 - nightCurve) * 2.5), 0, 1, 0);

    const rawLightChannels = sharedChannels?.lightChannels;
    const hasLight = (
        rawLightChannels
        && Number.isFinite(Number(rawLightChannels.r))
        && Number.isFinite(Number(rawLightChannels.g))
        && Number.isFinite(Number(rawLightChannels.b))
    );
    const lightR = hasLight ? clampNumber(rawLightChannels.r, 0, 255, 255) / 255 : 0.92;
    const lightG = hasLight ? clampNumber(rawLightChannels.g, 0, 255, 255) / 255 : 0.62;
    const lightB = hasLight ? clampNumber(rawLightChannels.b, 0, 255, 255) / 255 : 0.48;

    const rawChromaChannels = sharedChannels?.sceneChromaChannels;
    const hasChroma = (
        rawChromaChannels
        && Number.isFinite(Number(rawChromaChannels.r))
        && Number.isFinite(Number(rawChromaChannels.g))
        && Number.isFinite(Number(rawChromaChannels.b))
    );
    const chromaR = hasChroma ? clampNumber(rawChromaChannels.r, 0, 255, 255) / 255 : 0.65;
    const chromaG = hasChroma ? clampNumber(rawChromaChannels.g, 0, 255, 255) / 255 : 0.45;
    const chromaB = hasChroma ? clampNumber(rawChromaChannels.b, 0, 255, 255) / 255 : 0.55;

    const duskReflectR = clampNumber(0.68 * lightR + 0.32 * chromaR, 0, 1.15, 0.82);
    const duskReflectG = clampNumber(0.62 * lightG + 0.38 * chromaG, 0, 1.15, 0.58);
    const duskReflectB = clampNumber(0.50 * lightB + 0.50 * chromaB, 0, 1.18, 0.52);

    const duskReflectionBoost = sunsetWeight * 0.028 * (1 - cloudiness * 0.6);
    const surfaceReflectionStrength = clampNumber(
        (0.022 + (skyReflectionDrive + duskReflectionBoost) * 0.075)
        * calmOpticsGate
        * (0.82 + safeIntensityScale * 0.18),
        0.012,
        0.135,
        0.055,
    );
    const skyGrey = clampNumber(0.34 + cloudiness * 0.3 + moonCurve * 0.08, 0, 1, 0.44);
    const skyBlue = clampNumber(0.5 + daylightCurve * 0.34 + moonCurve * 0.18, 0, 1.1, 0.72);
    const skyWarmth = clampNumber(
        daylightCurve * (1 - cloudiness * 0.48) + moonCurve * 0.14,
        0,
        1,
        0.5,
    );
    const baseReflectR = clampNumber(
        0.42 + skyWarmth * 0.24 + skyGrey * 0.12,
        0,
        1.15,
        0.64,
    );
    const baseReflectG = clampNumber(
        0.52 + skyWarmth * 0.18 + skyGrey * 0.16,
        0,
        1.15,
        0.76,
    );
    const baseReflectB = clampNumber(
        0.62 + skyBlue * 0.2 + skyGrey * 0.12,
        0,
        1.18,
        0.86,
    );
    filter.uniforms.uSurfaceReflectionColor[0] = baseReflectR * (1 - sunsetWeight) + duskReflectR * sunsetWeight;
    filter.uniforms.uSurfaceReflectionColor[1] = baseReflectG * (1 - sunsetWeight) + duskReflectG * sunsetWeight;
    filter.uniforms.uSurfaceReflectionColor[2] = baseReflectB * (1 - sunsetWeight) + duskReflectB * sunsetWeight;
    filter.uniforms.uSurfaceReflectionStrength = surfaceReflectionStrength;

    const clearDirectSheen = clampNumber(
        daylightCurve
        * (0.48 + unifiedDirectLight * 0.34)
        * (0.52 + cloudOcclusionChannel * 0.48)
        * (0.62 + unifiedTransmittance * 0.38),
        0,
        1.2,
        0,
    );
    const overcastDiffuseSheen = clampNumber(
        daylightCurve
        * cloudiness
        * (1 - cloudOcclusionChannel)
        * (0.18 + unifiedTransmittance * 0.22),
        0,
        0.32,
        0,
    );
    const surfaceSheenIntensity = clampNumber(
        surfaceSheenGain
        * (0.28 + clearDirectSheen * 0.84 + overcastDiffuseSheen * 0.36)
        * (0.76 + safeIntensityScale * 0.24)
        * (1 - nightCurve * 0.82),
        0,
        1.25,
        0,
    );
    const clearDayGoldGate = clampNumber(
        Math.pow(daylightCurve, 1.08)
        * Math.pow(1 - cloudiness, 1.22)
        * Math.pow(cloudOcclusionChannel, 0.82)
        * (0.5 + unifiedDirectLight * 0.28)
        * (0.62 + unifiedTransmittance * 0.38)
        * (1 - nightCurve * 0.96),
        0,
        1.25,
        0,
    );
    const surfaceGoldLift = clampNumber(
        surfaceSheenGain
        * clearDayGoldGate
        * (0.86 + safeIntensityScale * 0.22),
        0,
        1.05,
        0,
    );
    const surfaceSheenClarity = clampNumber(
        0.28
        + unifiedTransmittance * 0.34
        + cloudOcclusionChannel * 0.22
        + (1 - cloudiness) * 0.12
        - unifiedTurbidity * 0.12,
        0,
        1,
        0.62,
    );
    const sheenWarmth = clampNumber(
        0.38
        + daylightCurve * 0.36
        + (1 - cloudiness) * 0.14
        - nightCurve * 0.22,
        0,
        1,
        0.52,
    );
    const sheenOvercastCool = clampNumber(cloudiness * (1 - cloudOcclusionChannel) * 0.32, 0, 0.32, 0);
    filter.uniforms.uSurfaceSheenColor[0] = clampNumber(
        0.64 + sheenWarmth * 0.34 + sheenOvercastCool * 0.08,
        0,
        1.25,
        1,
    );
    filter.uniforms.uSurfaceSheenColor[1] = clampNumber(
        0.7 + sheenWarmth * 0.24 + sheenOvercastCool * 0.14,
        0,
        1.25,
        0.95,
    );
    filter.uniforms.uSurfaceSheenColor[2] = clampNumber(
        0.7 + (1 - sheenWarmth) * 0.16 + sheenOvercastCool * 0.18 - surfaceGoldLift * 0.12,
        0,
        1.25,
        0.82,
    );
    filter.uniforms.uSurfaceSheenIntensity = surfaceSheenIntensity;
    filter.uniforms.uSurfaceSheenClarity = surfaceSheenClarity;
    filter.uniforms.uSurfaceGoldLift = surfaceGoldLift;

    const scaleCoupling = 6.6 / Math.max(1.0, baseScale);
    const microCompression = clampNumber(1 / Math.sqrt(refractionMicroScale), 0.55, 1.2, 1.0);
    const depthCoupling = clampNumber(
        0.64
        + unifiedWaveEnergy * 0.16
        + (1 - unifiedRoughness) * 0.12
        + flowTransport * 0.08,
        0.42,
        1.16,
        0.78,
    );
    const refractionPresence = refractionControl <= 0.0001
        ? 0
        : clampNumber(0.38 + refractionControl * 0.95, 0, 3.0, 0.52);
    const rawDistortion = 0.017
        * refractionPresence
        * safeIntensityScale
        * depthCoupling
        * (0.86 + refractionJitter * 0.28)
        * (1 + flowTransport * 0.12)
        * (0.72 + unifiedWaveEnergy * 0.52)
        * microCompression
        * WATER_REFRACTION_STRENGTH;
    const turbulenceDistortionGain = 0.9 + turbulence * 0.18 + refractionJitter * 0.08;
    const distortionX = rawDistortion * scaleCoupling * turbulenceDistortionGain;
    const distortionY = rawDistortion * scaleCoupling * turbulenceDistortionGain;
    filter.uniforms.uScale[0] = clampRefraction(distortionX);
    filter.uniforms.uScale[1] = clampRefraction(distortionY);
    const refractionVisibility = clampNumber(
        (0.34 + unifiedTransmittance * 0.62) * WATER_REFRACTION_VISIBILITY_STRENGTH,
        0.2,
        1,
        0.82,
    );
    filter.uniforms.uRefractionVisibility = refractionVisibility;
    filter.uniforms.uRefractionMix = clampNumber(
        0.11
        + (1 - refractionVisibility) * 0.25
        + unifiedTurbidity * 0.055
        + unifiedWaveEnergy * 0.035,
        0.08,
        0.36,
        0.2,
    );
};
