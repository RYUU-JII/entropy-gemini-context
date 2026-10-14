import {
    ZEN_QUALITY_MODES,
    resolveZenMainTargetFps,
} from './zenRenderQuality.js';

export const ZEN_BONSAI_CADENCE_CONTEXTS = Object.freeze({
    WORKSPACE: 'workspace',
    EMBEDDED: 'embedded',
    HOME_EMBEDDED: 'home-embedded',
});

const BONSAI_RENDER_QUALITY_TO_CADENCE_QUALITY = Object.freeze({
    [ZEN_QUALITY_MODES.FULL]: ZEN_QUALITY_MODES.FULL,
    [ZEN_QUALITY_MODES.BALANCED]: ZEN_QUALITY_MODES.BALANCED,
    [ZEN_QUALITY_MODES.LOW]: ZEN_QUALITY_MODES.LOW,
    draft: ZEN_QUALITY_MODES.LOW,
    preview: ZEN_QUALITY_MODES.BALANCED,
});
const BONSAI_CADENCE_CONTEXT_VALUES = new Set(Object.values(ZEN_BONSAI_CADENCE_CONTEXTS));

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const resolvePositiveInteger = (value, fallback) => {
    const numeric = Math.round(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const createBonsaiCadenceProfile = ({
    qualityMode,
    cadenceTier,
    targetFps,
    simHz = 60,
    maxCatchUpSteps = 30,
    windSampleEveryFrames = 4,
    environmentRefreshIntervalScale = 1,
    environmentActiveRefreshMinMs = 10000,
    environmentActiveRefreshMaxMs = 300000,
    environmentHiddenRefreshMinMs = 120000,
    environmentHiddenRefreshMaxMs = 600000,
    presentationEasing = 0.16,
} = {}) => Object.freeze({
    qualityMode,
    cadenceTier,
    targetFps,
    simHz,
    maxCatchUpSteps,
    wind: Object.freeze({
        sampleEveryFrames: windSampleEveryFrames,
    }),
    environment: Object.freeze({
        refreshIntervalScale: environmentRefreshIntervalScale,
        activeRefreshMinMs: environmentActiveRefreshMinMs,
        activeRefreshMaxMs: environmentActiveRefreshMaxMs,
        hiddenRefreshMinMs: environmentHiddenRefreshMinMs,
        hiddenRefreshMaxMs: environmentHiddenRefreshMaxMs,
    }),
    presentation: Object.freeze({
        easing: presentationEasing,
    }),
});

export const ZEN_BONSAI_CADENCE_PROFILES = Object.freeze({
    [ZEN_QUALITY_MODES.FULL]: createBonsaiCadenceProfile({
        qualityMode: ZEN_QUALITY_MODES.FULL,
        cadenceTier: 'canonical',
        targetFps: 60,
        simHz: 60,
        maxCatchUpSteps: 30,
        windSampleEveryFrames: 4,
        environmentRefreshIntervalScale: 1,
    }),
    [ZEN_QUALITY_MODES.BALANCED]: createBonsaiCadenceProfile({
        qualityMode: ZEN_QUALITY_MODES.BALANCED,
        cadenceTier: 'balanced',
        targetFps: resolveZenMainTargetFps(ZEN_QUALITY_MODES.BALANCED),
        simHz: 60,
        maxCatchUpSteps: 24,
        windSampleEveryFrames: 5,
        environmentRefreshIntervalScale: 1.25,
    }),
    [ZEN_QUALITY_MODES.LOW]: createBonsaiCadenceProfile({
        qualityMode: ZEN_QUALITY_MODES.LOW,
        cadenceTier: 'low',
        targetFps: 30,
        simHz: 60,
        maxCatchUpSteps: 18,
        windSampleEveryFrames: 6,
        environmentRefreshIntervalScale: 1.5,
    }),
    [ZEN_BONSAI_CADENCE_CONTEXTS.EMBEDDED]: createBonsaiCadenceProfile({
        qualityMode: ZEN_QUALITY_MODES.FULL,
        cadenceTier: ZEN_BONSAI_CADENCE_CONTEXTS.EMBEDDED,
        targetFps: 45,
        simHz: 60,
        maxCatchUpSteps: 20,
        windSampleEveryFrames: 5,
        environmentRefreshIntervalScale: 1.25,
    }),
    [ZEN_BONSAI_CADENCE_CONTEXTS.HOME_EMBEDDED]: createBonsaiCadenceProfile({
        qualityMode: ZEN_QUALITY_MODES.FULL,
        cadenceTier: ZEN_BONSAI_CADENCE_CONTEXTS.HOME_EMBEDDED,
        targetFps: 36,
        simHz: 60,
        maxCatchUpSteps: 18,
        windSampleEveryFrames: 5,
        environmentRefreshIntervalScale: 1.5,
        presentationEasing: 0.18,
    }),
});

export const DEFAULT_ZEN_BONSAI_CADENCE_PROFILE = ZEN_BONSAI_CADENCE_PROFILES[ZEN_QUALITY_MODES.FULL];

export const resolveZenBonsaiCadenceQualityMode = (qualityMode = ZEN_QUALITY_MODES.FULL) => {
    const normalized = typeof qualityMode === 'string' ? qualityMode.trim() : '';
    const resolved = BONSAI_RENDER_QUALITY_TO_CADENCE_QUALITY[normalized];
    if (!resolved) {
        throw new Error(`ZEN_BONSAI_CADENCE_QUALITY_INVALID:${normalized || 'missing'}`);
    }
    return resolved;
};

export const resolveZenBonsaiCadenceContext = (cadenceContext = ZEN_BONSAI_CADENCE_CONTEXTS.WORKSPACE) => {
    const normalized = typeof cadenceContext === 'string' ? cadenceContext.trim() : '';
    if (!BONSAI_CADENCE_CONTEXT_VALUES.has(normalized)) {
        throw new Error(`ZEN_BONSAI_CADENCE_CONTEXT_INVALID:${normalized || 'missing'}`);
    }
    return normalized;
};

export const resolveZenBonsaiCadenceProfile = ({
    qualityMode = ZEN_QUALITY_MODES.FULL,
    targetFps = null,
    cadenceContext = ZEN_BONSAI_CADENCE_CONTEXTS.WORKSPACE,
} = {}) => {
    const resolvedContext = resolveZenBonsaiCadenceContext(cadenceContext);
    const resolvedQualityMode = resolveZenBonsaiCadenceQualityMode(qualityMode);
    const baseProfile = resolvedContext === ZEN_BONSAI_CADENCE_CONTEXTS.WORKSPACE
        ? ZEN_BONSAI_CADENCE_PROFILES[resolvedQualityMode]
        : ZEN_BONSAI_CADENCE_PROFILES[resolvedContext];
    const requestedTargetFps = Number(targetFps);
    const resolvedTargetFps = Number.isFinite(requestedTargetFps) && requestedTargetFps > 0
        ? Math.round(clampNumber(requestedTargetFps, 1, 120, baseProfile.targetFps))
        : baseProfile.targetFps;

    if (resolvedTargetFps === baseProfile.targetFps && resolvedQualityMode === baseProfile.qualityMode) {
        return baseProfile;
    }

    return Object.freeze({
        ...baseProfile,
        qualityMode: resolvedQualityMode,
        targetFps: resolvedTargetFps,
    });
};

export const resolveZenBonsaiCadenceEnvironmentRefreshIntervalMs = ({
    cadenceProfile = DEFAULT_ZEN_BONSAI_CADENCE_PROFILE,
    baseIntervalMs = 60000,
    active = true,
} = {}) => {
    const profile = cadenceProfile || DEFAULT_ZEN_BONSAI_CADENCE_PROFILE;
    const environment = profile.environment || DEFAULT_ZEN_BONSAI_CADENCE_PROFILE.environment;
    const intervalMs = Number(baseIntervalMs);
    if (intervalMs === Number.POSITIVE_INFINITY) {
        return Number.POSITIVE_INFINITY;
    }
    const scaledIntervalMs = Math.max(
        1000,
        Number.isFinite(intervalMs) ? intervalMs : 60000,
    ) * Math.max(0.25, Number(environment.refreshIntervalScale) || 1);
    const minMs = active === true
        ? environment.activeRefreshMinMs
        : environment.hiddenRefreshMinMs;
    const maxMs = active === true
        ? environment.activeRefreshMaxMs
        : environment.hiddenRefreshMaxMs;
    return Math.round(clampNumber(scaledIntervalMs, minMs, maxMs, minMs));
};

export const resolveZenBonsaiCadenceWindSampleEveryFrames = (
    cadenceProfile = DEFAULT_ZEN_BONSAI_CADENCE_PROFILE,
) => resolvePositiveInteger(
    cadenceProfile?.wind?.sampleEveryFrames,
    DEFAULT_ZEN_BONSAI_CADENCE_PROFILE.wind.sampleEveryFrames,
);
