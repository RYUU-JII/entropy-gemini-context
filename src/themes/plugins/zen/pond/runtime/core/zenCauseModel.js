import { createDefaultSignalTuning } from '../../../../../core/data/signalTuning.js';

const clampNumber = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value, fallback) => clampNumber(value, 0, 1, fallback);

const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const assertNoPredecessorCauseFields = (tuning) => {
    if (!isPlainObject(tuning)) return;
    for (const field of ['physicsTimeSec', 'physicsDeltaSec']) {
        if (Object.prototype.hasOwnProperty.call(tuning, field)) {
            throw new Error(`ZEN_ENV_CAUSE_PREDECESSOR_FIELD_FORBIDDEN:${field}`);
        }
    }
    if (isPlainObject(tuning.physics)) {
        for (const field of ['debugUseTimeSlider', 'debugTimeHour']) {
            if (Object.prototype.hasOwnProperty.call(tuning.physics, field)) {
                throw new Error(`ZEN_ENV_CAUSE_PREDECESSOR_FIELD_FORBIDDEN:physics.${field}`);
            }
        }
    }
};

const resolveCauseSource = (tuning = null) => {
    const safeTuning = isPlainObject(tuning) ? tuning : {};
    assertNoPredecessorCauseFields(safeTuning);
    return {
        tuning: safeTuning,
    };
};

const normalizeCauseDefaults = (defaults = null) => {
    const source = isPlainObject(defaults)
        ? defaults
        : DEFAULT_ZEN_ENV_CAUSE_FALLBACK;
    return {
        envCloudiness: clamp01(
            source.envCloudiness,
            0.38,
        ),
        envRainIntensity: clamp01(
            source.envRainIntensity,
            0,
        ),
        envWaterClarity: clamp01(
            source.envWaterClarity,
            0.64,
        ),
    };
};

const resolveCauseBoundaryInput = (tuning = null, defaults = null) => {
    const normalizedDefaults = normalizeCauseDefaults(defaults);
    const source = resolveCauseSource(tuning);
    return {
        tuning: source.tuning,
        defaults: normalizedDefaults,
    };
};

export const selectZenEnvCause = (tuning = null, defaults = null) => {
    const boundary = resolveCauseBoundaryInput(tuning, defaults);
    const sourceTuning = boundary.tuning;
    const sourceDefaults = boundary.defaults;
    return normalizeCauseDefaults({
        ...sourceDefaults,
        envCloudiness: sourceTuning.envCloudiness,
        envRainIntensity: sourceTuning.envRainIntensity,
        envWaterClarity: sourceTuning.envWaterClarity,
    });
};

const DEFAULT_ZEN_ENV_CAUSE_FALLBACK = Object.freeze({
    envCloudiness: 0.38,
    envRainIntensity: 0,
    envWaterClarity: 0.64,
});

export const DEFAULT_ZEN_ENV_CAUSE = Object.freeze(
    selectZenEnvCause(createDefaultSignalTuning(), DEFAULT_ZEN_ENV_CAUSE_FALLBACK),
);
