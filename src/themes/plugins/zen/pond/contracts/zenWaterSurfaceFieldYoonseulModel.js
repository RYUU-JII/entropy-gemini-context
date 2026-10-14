export const ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID =
    'orthographic_scatter_v1';

export const ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL = Object.freeze({
    id: ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID,
    topViewBlendMin: 0.94,
    topViewBlendMax: 1,
    coverageRoughnessScale: 2.7,
    coverageRoughnessBias: 0.065,
    coverageRoughnessMin: 0.2,
    coverageRoughnessMax: 0.38,
    coverageWeightUnfocused: 0.34,
    coverageWeightFocused: 0.24,
    coverageCurvatureMin: 0.9,
    coverageCurvatureMax: 1.1,
    // Lift the existing continuous glint footprint, rather than shrinking it
    // into point sparkles or adding a separately animated fleck population.
    crossingLumaMin: 0.008,
    crossingLumaMax: 0.12,
    specularGain: 0.52,
    peakCompression: 1.8,
    crossingBaseGain: 0.018,
    crossingCurvatureGain: 0.024,
    // At oblique solar angles, reveal the same GGX shoulder only where the
    // actual wave reflects substantially more than a flat surface would.
    obliqueResponseStart: 0.18,
    obliqueResponseFull: 0.76,
    relativeShoulderMin: 1.6,
    relativeShoulderMax: 4.5,
    // RGBA8's neutral curvature decodes to +/-1/255, so reject that floor.
    shoulderCurvatureMin: 0.006,
    shoulderCurvatureMax: 0.024,
    shoulderFragmentGain: 0.085,
    shoulderCurvatureGain: 0.02,
});

export const readZenWaterSurfaceFieldYoonseulModelId = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error(
                'ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID_MISSING',
            );
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error(
            'ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID_TYPE_INVALID',
        );
    }
    if (value !== ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID) {
        throw new Error(
            `ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL_ID_UNSUPPORTED:${value}`,
        );
    }
    return value;
};
