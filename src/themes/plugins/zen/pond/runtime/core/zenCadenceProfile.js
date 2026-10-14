const createSceneCadenceProfile = ({
    tier,
    textureCachePruneEveryFrames,
    water,
    ambientSimulation,
    ambientRender,
    staticRender,
    readability,
} = {}) => Object.freeze({
    tier,
    textureCachePruneEveryFrames,
    water: Object.freeze({
        ...water,
    }),
    ambient: Object.freeze({
        simulation: Object.freeze({
            ...ambientSimulation,
        }),
        render: Object.freeze({
            ...ambientRender,
        }),
    }),
    static: Object.freeze({
        render: Object.freeze({
            ...staticRender,
        }),
    }),
    readability: Object.freeze({
        ...readability,
    }),
});

const ZEN_SCENE_CADENCE_BASE_HZ = 60;
const ZEN_SCENE_CADENCE_BASE_FRAME_MS = 1000 / ZEN_SCENE_CADENCE_BASE_HZ;

const BASE_SCENE_CADENCE_PROFILE = createSceneCadenceProfile({
    tier: 'canonical',
    textureCachePruneEveryFrames: 36,
    water: {
        backgroundFullUpdateEveryFrames: 30,
        backgroundFullPhase: 0,
        backgroundDynamicUpdateEveryFrames: 6,
        backgroundDynamicPhase: 0,
        effectsFullUpdateEveryFrames: 6,
        effectsFullPhase: 0,
        surfaceUniformFullUpdateEveryFrames: 6,
        surfaceUniformFullPhase: 3,
        cloudReflectionFullUpdateEveryFrames: 12,
        cloudReflectionFullPhase: 2,
        atmosphereFullUpdateEveryFrames: 6,
        atmosphereFullPhase: 4,
        topShadowFullUpdateEveryFrames: 8,
        topShadowFullPhase: 6,
        probeFullUpdateEveryFrames: 12,
        probeFullPhase: 9,
    },
    ambientSimulation: {
        particlesEveryFrames: 3,
        particlesPhase: 0,
        petalsEveryFrames: 2,
        petalsPhase: 0,
        glimmersEveryFrames: 4,
        glimmersPhase: 2,
        plantsEveryFrames: 5,
        plantsPhase: 2,
        maxAccumulatedStepSec: 0.12,
    },
    ambientRender: {
        particlesEveryFrames: 3,
        particlesPhase: 0,
        petalsEveryFrames: 2,
        petalsPhase: 0,
        glimmersEveryFrames: 4,
        glimmersPhase: 2,
        plantsEveryFrames: 5,
        plantsPhase: 2,
    },
    staticRender: {
        rocksEveryFrames: 12,
        rocksPhase: 0,
    },
    readability: {
        lilyMaskRefreshEveryFrames: 96,
        benthicMaskRefreshEveryFrames: 144,
    },
});

const BALANCED_SCENE_CADENCE_PROFILE = createSceneCadenceProfile({
    tier: 'balanced',
    textureCachePruneEveryFrames: 48,
    water: {
        backgroundFullUpdateEveryFrames: 60,
        backgroundFullPhase: 0,
        backgroundDynamicUpdateEveryFrames: 10,
        backgroundDynamicPhase: 0,
        effectsFullUpdateEveryFrames: 8,
        effectsFullPhase: 0,
        surfaceUniformFullUpdateEveryFrames: 10,
        surfaceUniformFullPhase: 5,
        cloudReflectionFullUpdateEveryFrames: 18,
        cloudReflectionFullPhase: 5,
        atmosphereFullUpdateEveryFrames: 10,
        atmosphereFullPhase: 4,
        topShadowFullUpdateEveryFrames: 12,
        topShadowFullPhase: 8,
        probeFullUpdateEveryFrames: 18,
        probeFullPhase: 11,
    },
    ambientSimulation: {
        particlesEveryFrames: 4,
        particlesPhase: 0,
        petalsEveryFrames: 2,
        petalsPhase: 1,
        glimmersEveryFrames: 6,
        glimmersPhase: 3,
        plantsEveryFrames: 6,
        plantsPhase: 3,
        maxAccumulatedStepSec: 0.14,
    },
    ambientRender: {
        particlesEveryFrames: 4,
        particlesPhase: 0,
        petalsEveryFrames: 2,
        petalsPhase: 1,
        glimmersEveryFrames: 6,
        glimmersPhase: 3,
        plantsEveryFrames: 6,
        plantsPhase: 3,
    },
    staticRender: {
        rocksEveryFrames: 18,
        rocksPhase: 0,
    },
    readability: {
        lilyMaskRefreshEveryFrames: 128,
        benthicMaskRefreshEveryFrames: 192,
    },
});

const LOW_SCENE_CADENCE_PROFILE = createSceneCadenceProfile({
    tier: 'low',
    textureCachePruneEveryFrames: 60,
    water: {
        backgroundFullUpdateEveryFrames: 90,
        backgroundFullPhase: 0,
        backgroundDynamicUpdateEveryFrames: 15,
        backgroundDynamicPhase: 0,
        effectsFullUpdateEveryFrames: 12,
        effectsFullPhase: 0,
        surfaceUniformFullUpdateEveryFrames: 15,
        surfaceUniformFullPhase: 7,
        cloudReflectionFullUpdateEveryFrames: 24,
        cloudReflectionFullPhase: 7,
        atmosphereFullUpdateEveryFrames: 15,
        atmosphereFullPhase: 5,
        topShadowFullUpdateEveryFrames: 18,
        topShadowFullPhase: 9,
        probeFullUpdateEveryFrames: 24,
        probeFullPhase: 13,
    },
    ambientSimulation: {
        particlesEveryFrames: 6,
        particlesPhase: 0,
        petalsEveryFrames: 2,
        petalsPhase: 1,
        glimmersEveryFrames: 8,
        glimmersPhase: 4,
        plantsEveryFrames: 8,
        plantsPhase: 3,
        maxAccumulatedStepSec: 0.18,
    },
    ambientRender: {
        particlesEveryFrames: 6,
        particlesPhase: 0,
        petalsEveryFrames: 2,
        petalsPhase: 1,
        glimmersEveryFrames: 8,
        glimmersPhase: 4,
        plantsEveryFrames: 8,
        plantsPhase: 3,
    },
    staticRender: {
        rocksEveryFrames: 24,
        rocksPhase: 0,
    },
    readability: {
        lilyMaskRefreshEveryFrames: 160,
        benthicMaskRefreshEveryFrames: 240,
    },
});

const SCENE_CADENCE_PROFILE_BY_TIER = Object.freeze({
    canonical: BASE_SCENE_CADENCE_PROFILE,
    full: BASE_SCENE_CADENCE_PROFILE,
    balanced: BALANCED_SCENE_CADENCE_PROFILE,
    low: LOW_SCENE_CADENCE_PROFILE,
});

const normalizeFrameCount = (frameCount) => {
    const numeric = Number(frameCount);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
};

const normalizeCadenceTimeMs = (timeMs) => {
    if (timeMs === null || timeMs === undefined || timeMs === '') {
        return null;
    }
    const numeric = Number(timeMs);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
};

const resolveRequiredCadenceTimeMs = (clockName, ...candidates) => {
    for (const candidate of candidates) {
        const timeMs = normalizeCadenceTimeMs(candidate);
        if (timeMs !== null) return timeMs;
    }
    throw new Error(`[zen-cadence] ${clockName} is required for time-based cadence`);
};

const resolveCadenceClockFrame = ({ timeMs = null } = {}) => {
    const resolvedTimeMs = normalizeCadenceTimeMs(timeMs);
    if (resolvedTimeMs === null) {
        throw new Error('[zen-cadence] timeMs is required for time-based cadence');
    }
    const zeroBasedFrame = Math.round(
        (resolvedTimeMs - ZEN_SCENE_CADENCE_BASE_FRAME_MS)
        / ZEN_SCENE_CADENCE_BASE_FRAME_MS,
    );
    return Math.max(0, zeroBasedFrame);
};

const shouldRunCadenceFrame = (frameCount, cadenceFrames = 1, phase = 0) => {
    const cadence = Math.max(1, Math.round(Number(cadenceFrames) || 1));
    if (cadence <= 1) return true;
    const safeFrameCount = normalizeFrameCount(frameCount);
    const safePhase = ((Math.round(Number(phase) || 0) % cadence) + cadence) % cadence;
    return (safeFrameCount % cadence) === safePhase;
};

const shouldRunCadenceClock = ({
    timeMs = null,
    cadenceFrames = 1,
    phase = 0,
} = {}) => {
    const cadence = Math.max(1, Math.round(Number(cadenceFrames) || 1));
    if (cadence <= 1) return true;
    const clockFrame = resolveCadenceClockFrame({ timeMs });
    const safePhase = ((Math.round(Number(phase) || 0) % cadence) + cadence) % cadence;
    return (clockFrame % cadence) === safePhase;
};

const resolveZenSceneCadenceProfile = (qualityProfile = null) => {
    const tier = typeof qualityProfile?.cadenceTier === 'string'
        ? qualityProfile.cadenceTier.trim()
        : '';
    return SCENE_CADENCE_PROFILE_BY_TIER[tier] || BASE_SCENE_CADENCE_PROFILE;
};

const shouldRunCadenceInterval = ({
    previousClockFrame,
    clockFrame,
    cadenceFrames,
    phase,
}) => {
    const cadence = Math.max(1, Math.round(Number(cadenceFrames) || 1));
    const safePhase = ((Math.round(Number(phase) || 0) % cadence) + cadence) % cadence;
    // Crossing one or many due slots admits one update. Sampling the exact
    // modulo slot can starve a pass when rendering skips canonical frames.
    return Math.floor((clockFrame - safePhase) / cadence)
        > Math.floor((previousClockFrame - safePhase) / cadence);
};

const shouldRunCadenceClockInterval = ({
    timeMs,
    previousTimeMs,
    cadenceFrames = 1,
    phase = 0,
}) => {
    const clockFrame = resolveCadenceClockFrame({ timeMs });
    if (previousTimeMs === null) return true;
    if (typeof previousTimeMs !== 'number' || !Number.isFinite(previousTimeMs) || previousTimeMs < 0) {
        throw new Error('[zen-cadence] previousTimeMs must be null or a finite nonnegative clock');
    }
    if (timeMs < previousTimeMs) return true;
    return shouldRunCadenceInterval({
        clockFrame,
        previousClockFrame: resolveCadenceClockFrame({ timeMs: previousTimeMs }),
        cadenceFrames,
        phase,
    });
};

const resolveZenSceneWaterPassPlan = ({
    frameCount = 0,
    timeMs = null,
    renderTimeMs = null,
    previousRenderTimeMs = null,
    forceUpdate = false,
    sceneCadenceProfile = BASE_SCENE_CADENCE_PROFILE,
} = {}) => {
    const safeFrameCount = normalizeFrameCount(frameCount);
    const cadenceTimeMs = resolveRequiredCadenceTimeMs('renderTimeMs', timeMs, renderTimeMs);
    if (previousRenderTimeMs !== null && previousRenderTimeMs !== undefined
        && (typeof previousRenderTimeMs !== 'number'
            || !Number.isFinite(previousRenderTimeMs) || previousRenderTimeMs < 0)) {
        throw new Error('[zen-cadence] previousRenderTimeMs must be a finite nonnegative clock');
    }
    const previousTimeMs = previousRenderTimeMs === undefined ? null : previousRenderTimeMs;
    if (safeFrameCount <= 1 || previousTimeMs === null
        || cadenceTimeMs < previousTimeMs || forceUpdate === true) {
        return {
            runFullBackgroundUpdate: true,
            runBackgroundDynamicUpdate: true,
            runFullEffectsUpdate: true,
            runSurfaceUniformUpdate: true,
            runCloudReflectionUpdate: true,
            runAtmosphereUpdate: true,
            runTopShadowUpdate: true,
            runWaterProbeUpdate: true,
        };
    }
    const waterCadence = sceneCadenceProfile?.water || BASE_SCENE_CADENCE_PROFILE.water;
    const clockFrame = resolveCadenceClockFrame({ timeMs: cadenceTimeMs });
    const previousClockFrame = resolveCadenceClockFrame({ timeMs: previousTimeMs });
    return {
        runFullBackgroundUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.backgroundFullUpdateEveryFrames,
            phase: waterCadence.backgroundFullPhase,
        }),
        runBackgroundDynamicUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.backgroundDynamicUpdateEveryFrames,
            phase: waterCadence.backgroundDynamicPhase,
        }),
        runFullEffectsUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.effectsFullUpdateEveryFrames,
            phase: waterCadence.effectsFullPhase,
        }),
        runSurfaceUniformUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.surfaceUniformFullUpdateEveryFrames,
            phase: waterCadence.surfaceUniformFullPhase,
        }),
        runCloudReflectionUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.cloudReflectionFullUpdateEveryFrames,
            phase: waterCadence.cloudReflectionFullPhase,
        }),
        runAtmosphereUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.atmosphereFullUpdateEveryFrames,
            phase: waterCadence.atmosphereFullPhase,
        }),
        runTopShadowUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.topShadowFullUpdateEveryFrames,
            phase: waterCadence.topShadowFullPhase,
        }),
        runWaterProbeUpdate: shouldRunCadenceInterval({
            clockFrame, previousClockFrame,
            cadenceFrames: waterCadence.probeFullUpdateEveryFrames,
            phase: waterCadence.probeFullPhase,
        }),
    };
};

const resolveZenSceneAmbientSimulationPlan = ({
    frameCount = 0,
    timeMs = null,
    simTimeMs = null,
    sceneCadenceProfile = BASE_SCENE_CADENCE_PROFILE,
} = {}) => {
    const safeFrameCount = normalizeFrameCount(frameCount);
    const simulationCadence = sceneCadenceProfile?.ambient?.simulation || BASE_SCENE_CADENCE_PROFILE.ambient.simulation;
    const cadenceTimeMs = resolveRequiredCadenceTimeMs('simTimeMs', timeMs, simTimeMs);
    if (safeFrameCount <= 1) {
        return {
            runParticles: true,
            runPetals: true,
            runGlimmers: true,
            runPlants: true,
            maxAccumulatedStepSec: Number(simulationCadence.maxAccumulatedStepSec) || 0.09,
        };
    }
    return {
        runParticles: shouldRunCadenceClock({
            timeMs: cadenceTimeMs,
            cadenceFrames: simulationCadence.particlesEveryFrames,
            phase: simulationCadence.particlesPhase,
        }),
        runPetals: shouldRunCadenceClock({
            timeMs: cadenceTimeMs,
            cadenceFrames: simulationCadence.petalsEveryFrames,
            phase: simulationCadence.petalsPhase,
        }),
        runGlimmers: shouldRunCadenceClock({
            timeMs: cadenceTimeMs,
            cadenceFrames: simulationCadence.glimmersEveryFrames,
            phase: simulationCadence.glimmersPhase,
        }),
        runPlants: shouldRunCadenceClock({
            timeMs: cadenceTimeMs,
            cadenceFrames: simulationCadence.plantsEveryFrames,
            phase: simulationCadence.plantsPhase,
        }),
        maxAccumulatedStepSec: Number(simulationCadence.maxAccumulatedStepSec) || 0.09,
    };
};

const resolveZenSceneAmbientRenderPlan = ({
    frameCount = 0,
    timeMs = null,
    renderTimeMs = null,
    previousRenderTimeMs,
    sceneCadenceProfile = BASE_SCENE_CADENCE_PROFILE,
} = {}) => {
    const safeFrameCount = normalizeFrameCount(frameCount);
    const cadenceTimeMs = resolveRequiredCadenceTimeMs('renderTimeMs', timeMs, renderTimeMs);
    if (safeFrameCount <= 1) {
        return {
            runParticlesSync: true,
            runPetalsSync: true,
            runGlimmersSync: true,
            runPlantsSync: true,
        };
    }
    const renderCadence = sceneCadenceProfile?.ambient?.render || BASE_SCENE_CADENCE_PROFILE.ambient.render;
    return {
        runParticlesSync: shouldRunCadenceClockInterval({
            timeMs: cadenceTimeMs,
            previousTimeMs: previousRenderTimeMs,
            cadenceFrames: renderCadence.particlesEveryFrames,
            phase: renderCadence.particlesPhase,
        }),
        runPetalsSync: shouldRunCadenceClockInterval({
            timeMs: cadenceTimeMs,
            previousTimeMs: previousRenderTimeMs,
            cadenceFrames: renderCadence.petalsEveryFrames,
            phase: renderCadence.petalsPhase,
        }),
        runGlimmersSync: shouldRunCadenceClockInterval({
            timeMs: cadenceTimeMs,
            previousTimeMs: previousRenderTimeMs,
            cadenceFrames: renderCadence.glimmersEveryFrames,
            phase: renderCadence.glimmersPhase,
        }),
        runPlantsSync: shouldRunCadenceClockInterval({
            timeMs: cadenceTimeMs,
            previousTimeMs: previousRenderTimeMs,
            cadenceFrames: renderCadence.plantsEveryFrames,
            phase: renderCadence.plantsPhase,
        }),
    };
};

const resolveZenSceneStaticRenderPlan = ({
    frameCount = 0,
    timeMs = null,
    renderTimeMs = null,
    previousRenderTimeMs,
    sceneCadenceProfile = BASE_SCENE_CADENCE_PROFILE,
} = {}) => {
    const safeFrameCount = normalizeFrameCount(frameCount);
    const cadenceTimeMs = resolveRequiredCadenceTimeMs('renderTimeMs', timeMs, renderTimeMs);
    if (safeFrameCount <= 1) {
        return {
            runRocksSync: true,
        };
    }
    const staticCadence = sceneCadenceProfile?.static?.render || BASE_SCENE_CADENCE_PROFILE.static.render;
    return {
        runRocksSync: shouldRunCadenceClockInterval({
            timeMs: cadenceTimeMs,
            previousTimeMs: previousRenderTimeMs,
            cadenceFrames: staticCadence.rocksEveryFrames,
            phase: staticCadence.rocksPhase,
        }),
    };
};

export {
    BASE_SCENE_CADENCE_PROFILE,
    resolveZenSceneAmbientRenderPlan,
    resolveZenSceneAmbientSimulationPlan,
    resolveZenSceneCadenceProfile,
    resolveZenSceneStaticRenderPlan,
    resolveZenSceneWaterPassPlan,
    resolveCadenceClockFrame,
    shouldRunCadenceFrame,
    shouldRunCadenceClock,
    shouldRunCadenceClockInterval,
    ZEN_SCENE_CADENCE_BASE_FRAME_MS,
    ZEN_SCENE_CADENCE_BASE_HZ,
};
