import { clamp as clampValue } from '../model/koi/koiMotion.js';
import { scaleCount } from './zenSignalScannerConfig.js';
import { resolveZenWaterFrameState } from './zenWaterFrameState.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const assertZenAmbientPopulationFrameState = (frameState = null) => {
    if (!isObject(frameState)) {
        throw new Error('ZEN_AMBIENT_POPULATION_FRAME_STATE_MISSING');
    }
    if (!isObject(frameState.channels)) {
        throw new Error('ZEN_AMBIENT_POPULATION_FRAME_CHANNELS_MISSING');
    }
    if (!isObject(frameState.frameEnv)) {
        throw new Error('ZEN_AMBIENT_POPULATION_FRAME_ENV_MISSING');
    }
    if (!isObject(frameState.tuning)) {
        throw new Error('ZEN_AMBIENT_POPULATION_FRAME_TUNING_MISSING');
    }
    if (!isObject(frameState.qualityProfile)) {
        throw new Error('ZEN_AMBIENT_POPULATION_FRAME_QUALITY_MISSING');
    }
    return frameState;
};

export const resolveZenAmbientCapacityCount = (value, step = 1, cap = null) => {
    const numeric = Math.max(0, Math.floor(Number(value) || 0));
    if (numeric <= 0) return 0;
    const resolvedStep = Math.max(1, Math.floor(Number(step) || 1));
    const capacity = Math.ceil(numeric / resolvedStep) * resolvedStep;
    const hasCap = cap !== null && cap !== undefined;
    const numericCap = hasCap ? Number(cap) : NaN;
    return hasCap && Number.isFinite(numericCap) && numericCap >= 0
        ? Math.min(Math.floor(numericCap), capacity)
        : capacity;
};

const resolveTargetsFromPopulationPlan = ({
    populationPlan,
    renderParticles = true,
    renderGlimmers = true,
} = {}) => {
    const qualityProfile = populationPlan?.frameState?.qualityProfile || {};
    return {
        populationPlan,
        targets: {
            particles: renderParticles ? populationPlan.partCount : 0,
            glimmers: renderGlimmers
                ? resolveZenAmbientCapacityCount(
                    populationPlan.glimmerCount,
                    3,
                    qualityProfile.maxGlimmers,
                )
                : 0,
        },
    };
};

export const resolveZenAmbientPopulationPlanFromFrameState = ({
    frameState,
} = {}) => {
    const resolvedFrameState = assertZenAmbientPopulationFrameState(frameState);
    const tuning = resolvedFrameState.tuning;
    const qualityProfile = resolvedFrameState.qualityProfile;
    const resolvedEnvState = resolvedFrameState.envState || {};
    const partCount = scaleCount(tuning?.particleDensity ?? 45, qualityProfile?.densityScale, 12);
    const channelGroups = resolvedFrameState?.channels || {};
    const bioticChannel = channelGroups?.biotic || {};
    const lightingChannel = channelGroups?.lighting || {};
    const surfaceChannel = channelGroups?.surface || {};

    const sunlightResponse = clampValue(
        lightingChannel?.sunlightResponse ?? bioticChannel?.ecosystemResponse,
        0,
        1,
    );
    const sunlightSurfaceGain = clampValue(
        Number(surfaceChannel?.surfaceLightResponse ?? 1) / 1.6,
        0,
        1.25,
    );
    const sunlightSurfaceBoost = clampValue(0.42 + sunlightSurfaceGain * 0.58, 0.42, 1.0);
    const glimmerLightBoost = clampValue(
        0.5 + clampValue(lightingChannel?.daylightEnvelope ?? bioticChannel?.daylightResponse, 0, 1) * 0.5,
        0.5,
        1.0,
    );
    const glimmerDensityScale = clampValue(
        Number(qualityProfile?.densityScale) * Number(qualityProfile?.glimmerDensityScale ?? 1),
        0.12,
        3,
    );
    const firefliesGain = clampValue(Number(resolvedEnvState?.fireflies), 0, 1);
    const glimmerDensityBoost = 0.28 + (firefliesGain * 0.72);
    const sunlightResponseBoost = clampValue(0.28 + sunlightResponse * 0.72, 0.28, 1.0);
    const sunlightDensityResponse = clampValue(
        bioticChannel?.glimmerDensityGain ?? sunlightResponseBoost,
        0.18,
        2.8,
    );
    const sunlightDensityBoost = glimmerDensityBoost
        * glimmerLightBoost
        * sunlightSurfaceBoost
        * (0.72 + sunlightResponse * 0.95)
        * clampValue(sunlightDensityResponse, 0.18, 2.8);
    const glimmerBase = scaleCount(tuning?.pollenDensity ?? 15, glimmerDensityScale, 1);
    const glimmerCountRaw = Math.floor(glimmerBase * sunlightDensityBoost);
    const glimmerCap = Math.max(0, Math.floor(Number(qualityProfile?.maxGlimmers) || 0));
    const glimmerCount = glimmerCap > 0
        ? Math.min(glimmerCountRaw, glimmerCap)
        : 0;

    return {
        frameState: resolvedFrameState,
        envState: resolvedEnvState,
        partCount,
        glimmerCount,
    };
};

export const resolveZenAmbientPopulationTargetsFromFrameState = ({
    frameState,
    renderParticles = true,
    renderGlimmers = true,
} = {}) => resolveTargetsFromPopulationPlan({
    populationPlan: resolveZenAmbientPopulationPlanFromFrameState({
        frameState,
    }),
    renderParticles,
    renderGlimmers,
});

export const resolveZenAmbientPopulationPlanFromInputs = ({
    tuning,
    qualityProfile,
    envState = null,
    effectIntensityScale = Number(qualityProfile?.effectIntensityScale) || 1,
    worldProfile = null,
    worldPolicy = null,
} = {}) => {
    const frameState = resolveZenWaterFrameState({
        tuning,
        envState,
        qualityProfile,
        effectIntensityScale,
        worldProfile,
        worldPolicy,
    });
    return resolveZenAmbientPopulationPlanFromFrameState({
        frameState,
    });
};

export const resolveZenAmbientPopulationTargetsFromInputs = ({
    tuning,
    qualityProfile,
    envState = null,
    effectIntensityScale = Number(qualityProfile?.effectIntensityScale) || 1,
    worldProfile = null,
    worldPolicy = null,
    renderParticles = true,
    renderGlimmers = true,
} = {}) => resolveTargetsFromPopulationPlan({
    populationPlan: resolveZenAmbientPopulationPlanFromInputs({
        tuning,
        qualityProfile,
        envState,
        effectIntensityScale,
        worldProfile,
        worldPolicy,
    }),
    renderParticles,
    renderGlimmers,
});
