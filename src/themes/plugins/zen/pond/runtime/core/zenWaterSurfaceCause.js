const requireFinite = (value, fieldName) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_WATER_SURFACE_CAUSE_MISSING:${fieldName}`);
    }
    return numeric;
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const DEFAULT_SURFACE_CAUSE = Object.freeze({
    waterClarity: 0.64,
    reflectionStability: 0.72,
    spatialStability: 0.58,
    detailStability: 0.44,
    temporalStability: 0.46,
});

const resolveTuningCause = (tuning, fieldName, fallback) => {
    if (!tuning || !Object.prototype.hasOwnProperty.call(tuning, fieldName)) return fallback;
    return requireFinite(tuning[fieldName], `tuning.${fieldName}`);
};

export const resolveZenWaterSurfaceCause = ({
    tuning = null,
    envState = null,
} = {}) => {
    const reflectionStability = clampNumber(
        resolveTuningCause(
            tuning,
            'waterReflectionStability',
            DEFAULT_SURFACE_CAUSE.reflectionStability,
        ),
        0,
        1,
    );
    const wind = Object.freeze({
        intensity: clampNumber(
            requireFinite(envState?.windIntensity, 'envState.windIntensity'),
            0.08,
            1,
        ),
        direction: requireFinite(envState?.windDirection, 'envState.windDirection'),
        gustEnvelope: clampNumber(
            requireFinite(envState?.gustEnvelope, 'envState.gustEnvelope'),
            0,
            1,
        ),
    });
    const stability = Object.freeze({
        spatial: clampNumber(
            resolveTuningCause(
                tuning,
                'waterReflectionSpatialStability',
                DEFAULT_SURFACE_CAUSE.spatialStability,
            ),
            0,
            1,
        ),
        detail: clampNumber(
            resolveTuningCause(
                tuning,
                'waterReflectionDetailStability',
                DEFAULT_SURFACE_CAUSE.detailStability,
            ),
            0,
            1,
        ),
        temporal: clampNumber(
            resolveTuningCause(
                tuning,
                'waterReflectionTemporalStability',
                DEFAULT_SURFACE_CAUSE.temporalStability,
            ),
            0,
            1,
        ),
    });
    return Object.freeze({
        wind,
        waterClarity: clampNumber(
            resolveTuningCause(
                tuning,
                'envWaterClarity',
                DEFAULT_SURFACE_CAUSE.waterClarity,
            ),
            0,
            1,
        ),
        reflectionStability,
        stability,
    });
};
