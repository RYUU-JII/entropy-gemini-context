const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value, fallback = 0) => clampNumber(value, 0, 1, fallback);

export const resolvePixiYoonseulModel = ({
    unifiedSpecularResponse,
    unifiedDirectLight,
    unifiedRoughness,
    unifiedWaveEnergy,
    sceneBrightness,
    cloudCover,
    cloudOcclusion,
    windIntensity,
    flowTransport = 0,
    surfaceSparkleGain = 1,
    waterTemporal = null,
} = {}) => {
    const specularResponse = clamp01(unifiedSpecularResponse, 0.5);
    const directLight = clampNumber(unifiedDirectLight, 0, 1.6, 0.82);
    const roughness = clamp01(unifiedRoughness, 0.5);
    const waveEnergy = clamp01(unifiedWaveEnergy, 0.5);
    const brightness = Math.max(0, Number(sceneBrightness) || 0.5);
    const cloudCoverClamped = clamp01(cloudCover, 0.5);
    const cloudOcclusionClamped = clampNumber(cloudOcclusion, 0.18, 1, 0.84);
    const windIntensityClamped = clampNumber(windIntensity, 0.08, 1, 0.4);
    const flowTransportClamped = clampNumber(flowTransport, 0.08, 0.92, 0.2);
    const sparkleGain = clampNumber(surfaceSparkleGain, 0, 1.4, 1);

    const yoonseulIntensityBase = clampNumber(
        specularResponse * (0.62 + directLight * 0.36)
        + (1 - roughness) * 0.16,
        0.08,
        1.85,
        0.9,
    );
    const brightnessGain = clampNumber(0.12 + brightness * 0.94, 0.12, 1.06, 0.6);
    const yoonseulIntensity = clampNumber(
        yoonseulIntensityBase * brightnessGain,
        0,
        2,
        yoonseulIntensityBase,
    );
    const yoonseulSharpness = clampNumber(
        0.64
        + (1 - roughness) * 1.12
        + specularResponse * 0.2
        - waveEnergy * 0.16,
        0.4,
        2.4,
        1.1,
    );
    const yoonseulPatchScale = clampNumber(
        1.26 - waveEnergy * 0.52 + roughness * 0.22 + cloudCoverClamped * 0.08,
        0.5,
        2.6,
        1.0,
    );
    const yoonseulMotion = clampNumber(
        0.34 + waveEnergy * 0.74 + windIntensityClamped * 0.42 + flowTransportClamped * 0.08,
        0.24,
        1.62,
        0.86,
    );

    const temporalFlickerDrive = clampNumber(
        waterTemporal?.flickerDrive,
        0.08,
        0.92,
        Number.NaN,
    );
    const yoonseulFlickerAmount = clampNumber(
        Number.isFinite(temporalFlickerDrive)
            ? temporalFlickerDrive
            : (
                0.14
                + windIntensityClamped * 0.18
                + (1 - cloudOcclusionClamped) * 0.1
                + waveEnergy * 0.1
            ),
        0.06,
        0.48,
        0.24,
    );
    const temporalShimmerExcitation = clampNumber(
        waterTemporal?.shimmerExcitation,
        0,
        1,
        Number.NaN,
    );
    const yoonseulTemporalCoherence = clampNumber(
        0.86
        - windIntensityClamped * 0.22
        - waveEnergy * 0.14
        + cloudCoverClamped * 0.08,
        0.12,
        0.95,
        0.38,
    ) - (Number.isFinite(temporalShimmerExcitation) ? temporalShimmerExcitation * 0.12 : 0);
    const yoonseulTemporalCoherenceClamped = clampNumber(
        yoonseulTemporalCoherence,
        0.12,
        0.95,
        0.38,
    );
    const yoonseulLowBand = clampNumber(
        waterTemporal?.highlightLowBand,
        0.06,
        0.94,
        0.5,
    );
    const yoonseulMicroBand = clampNumber(
        waterTemporal?.highlightMicroBand,
        0.04,
        0.98,
        0.5,
    );
    const yoonseulGlintStability = clampNumber(
        waterTemporal?.glintStability,
        0.24,
        0.96,
        clampNumber(
            0.56
            + (1 - windIntensityClamped) * 0.16
            + cloudOcclusionClamped * 0.12
            + (1 - waveEnergy) * 0.08
            - flowTransportClamped * 0.08,
            0.24,
            0.96,
            0.62,
        ),
    );
    const yoonseulBeatDamping = clampNumber(
        0.34
        + cloudCoverClamped * 0.26
        + (1 - cloudOcclusionClamped) * 0.24
        + (1 - specularResponse) * 0.18,
        0.22,
        0.88,
        0.58,
    );
    const surfaceSparkleOpacity = (
        0.04
        + brightness * 0.96
        - cloudCoverClamped * 0.16
        + (1 - cloudOcclusionClamped) * 0.06
    );
    const yoonseulOpacity = clampNumber(
        surfaceSparkleOpacity
        * (0.32 + brightness * 1.12)
        * (0.68 + sparkleGain * 0.58),
        0,
        2.4,
        0.9,
    );

    return {
        yoonseulIntensity,
        yoonseulSharpness,
        yoonseulPatchScale,
        yoonseulMotion,
        yoonseulFlickerAmount,
        yoonseulTemporalCoherence: yoonseulTemporalCoherenceClamped,
        yoonseulLowBand,
        yoonseulMicroBand,
        yoonseulGlintStability,
        yoonseulBeatDamping,
        yoonseulOpacity,
    };
};
