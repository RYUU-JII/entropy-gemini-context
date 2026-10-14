import { resolveZenEnvFrame } from './core/zenEnvCore.js';

const ZEN_WATER_FRAME_INPUT_KEYS = new Set([
    'tuning',
    'envState',
    'qualityProfile',
    'effectIntensityScale',
    'worldProfile',
    'worldPolicy',
]);
const PREDECESSOR_TUNING_KEYS = new Set([
    'waterRippleScale',
    'waterSpeedMultiplier',
    'refractionScale',
    'refractionJitter',
    'surfaceHighlightOpacity',
    'yoonseulIntensity',
    'weatherDynamics',
    'cloudCountDensity',
    'cloudCoverageBias',
    'cloudCoverageVariance',
    'cloudDriftSpeed',
    'moonlightBoost',
    'nightDarkness',
]);

const assertReleaseV1WaterFrameInput = (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('ZEN_WATER_FRAME_INPUT_INVALID');
    }
    const predecessorInputKey = Object.keys(input).find((key) => !ZEN_WATER_FRAME_INPUT_KEYS.has(key));
    if (predecessorInputKey) {
        throw new Error(`ZEN_WATER_FRAME_PREDECESSOR_FIELD_FORBIDDEN:${predecessorInputKey}`);
    }
    if (input.tuning && (typeof input.tuning !== 'object' || Array.isArray(input.tuning))) {
        throw new Error('ZEN_WATER_FRAME_TUNING_INVALID');
    }
    const predecessorTuningKey = Object.keys(input.tuning || {})
        .find((key) => PREDECESSOR_TUNING_KEYS.has(key));
    if (predecessorTuningKey) {
        throw new Error(`ZEN_WATER_FRAME_PREDECESSOR_TUNING_FORBIDDEN:${predecessorTuningKey}`);
    }
};

export const resolveZenWaterFrameState = (input = {}) => {
    assertReleaseV1WaterFrameInput(input);
    const {
        tuning = null,
        envState = null,
        qualityProfile = null,
        effectIntensityScale = null,
        worldProfile = null,
        worldPolicy = null,
    } = input;
    return resolveZenEnvFrame({
        tuning,
        envState,
        qualityProfile,
        effectIntensityScale,
        worldProfile,
        worldPolicy,
    });
};
