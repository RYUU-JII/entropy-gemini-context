const EMPTY_OBJECT = Object.freeze({});

export const resolveSafeObject = (value) => {
    return value && typeof value === 'object' ? value : EMPTY_OBJECT;
};

export const buildZenFrameContract = ({
    normalizedTuning = null,
    cause = null,
    envState = null,
    qualityProfile = null,
    effectIntensityScale = null,
    quality = null,
    channels = null,
    temporal = null,
    frameEnv = null,
    worldProfile = null,
    worldPolicy = null,
} = {}) => {
    const safeNormalizedTuning = resolveSafeObject(normalizedTuning);
    const safeQualityProfile = resolveSafeObject(qualityProfile);
    const safeQuality = resolveSafeObject(quality);
    const safeWorldProfile = resolveSafeObject(worldProfile);
    const safeWorldPolicy = resolveSafeObject(worldPolicy);
    return {
        // Renderer/runtime consumers must use sanitized channel-contract tuning only.
        tuning: safeNormalizedTuning,
        normalizedTuning: safeNormalizedTuning,
        cause: resolveSafeObject(cause),
        envState: resolveSafeObject(envState),
        quality: (
            safeQualityProfile !== EMPTY_OBJECT
            || safeQuality !== EMPTY_OBJECT
            || Number.isFinite(Number(effectIntensityScale))
        )
            ? {
                ...safeQuality,
                profile: safeQualityProfile,
                effectIntensityScale,
            }
            : EMPTY_OBJECT,
        qualityProfile: safeQualityProfile,
        effectIntensityScale,
        channels: resolveSafeObject(channels),
        temporal: resolveSafeObject(temporal),
        frameEnv: resolveSafeObject(frameEnv),
        worldProfile: safeWorldProfile,
        worldPolicy: safeWorldPolicy,
    };
};
