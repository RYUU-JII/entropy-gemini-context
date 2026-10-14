export const ZEN_WATER_REFLECTION_ALGORITHMS = Object.freeze({
    GGX: 'ggx',
    LOOPED_CAUSTIC: 'looped_caustic',
    PHASE_NOISE: 'phase_noise',
    LIMITED_WAVES: 'limited_waves',
    YOONSEUL_GLINT: 'yoonseul_glint',
    SLOPE_LOBE: 'slope_lobe',
    STOCHASTIC_SLOPE_SPECTRUM: 'stochastic_slope_spectrum',
    SURFACE_FIELD: 'surface_field',
});

export const DEFAULT_ZEN_WATER_REFLECTION_ALGORITHM = ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD;

export const ZEN_WATER_REFLECTION_ALGORITHM_OPTIONS = Object.freeze([
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.GGX, label: 'GGX' },
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC, label: 'Looped Caustic' },
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.PHASE_NOISE, label: 'Phase Noise' },
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.LIMITED_WAVES, label: 'Limited Waves' },
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.YOONSEUL_GLINT, label: 'Yoonseul Glint' },
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.SLOPE_LOBE, label: 'Slope Lobe' },
    {
        value: ZEN_WATER_REFLECTION_ALGORITHMS.STOCHASTIC_SLOPE_SPECTRUM,
        label: 'Stochastic Slope Spectrum',
    },
    { value: ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD, label: 'Canonical Surface Field' },
]);

const WATER_REFLECTION_ALGORITHM_MODE = Object.freeze({
    [ZEN_WATER_REFLECTION_ALGORITHMS.GGX]: 0,
    [ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC]: 1,
    [ZEN_WATER_REFLECTION_ALGORITHMS.PHASE_NOISE]: 2,
    [ZEN_WATER_REFLECTION_ALGORITHMS.LIMITED_WAVES]: 3,
    [ZEN_WATER_REFLECTION_ALGORITHMS.YOONSEUL_GLINT]: 4,
    [ZEN_WATER_REFLECTION_ALGORITHMS.SLOPE_LOBE]: 5,
    [ZEN_WATER_REFLECTION_ALGORITHMS.STOCHASTIC_SLOPE_SPECTRUM]: 6,
    [ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD]: 7,
});

export const normalizeZenWaterReflectionAlgorithm = (
    value,
) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (Object.values(ZEN_WATER_REFLECTION_ALGORITHMS).includes(normalized)) {
        return normalized;
    }
    throw new Error(`ZEN_WATER_REFLECTION_ALGORITHM_INVALID:${normalized || 'missing'}`);
};

export const isZenWaterSurfaceFieldAlgorithm = (value) => (
    normalizeZenWaterReflectionAlgorithm(value) === ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD
);

export const resolveZenWaterReflectionAlgorithmMode = (value) => (
    WATER_REFLECTION_ALGORITHM_MODE[normalizeZenWaterReflectionAlgorithm(value)]
);
