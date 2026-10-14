import {
    buildZenDerivedChannels,
    buildZenFrameEnv,
    resolveZenLightingProfile,
} from './zenChannelAssembly.js';
import { buildZenFrameContract, resolveSafeObject } from './zenFrameContract.js';
import { selectZenEnvCause } from './zenCauseModel.js';
import {
    DEFAULT_ZEN_POND_WORLD_ID,
    resolveZenPondWorldPolicy,
    resolveZenPondWorldProfile,
} from './zenPondWorldProfile.js';
import { projectZenPondTuningV1 } from '../../contracts/zenPondTuningContract.js';
import { resolveZenWaterDerivationState } from '../zenWaterDerivation.js';
import { resolveZenWaterSurfaceCause } from './zenWaterSurfaceCause.js';

const resolveFrameWorldContext = ({
    worldProfile = null,
    worldPolicy = null,
} = {}) => {
    const profile = resolveZenPondWorldProfile(
        typeof worldProfile?.id === 'string'
            ? worldProfile.id
            : DEFAULT_ZEN_POND_WORLD_ID,
    );
    return {
        worldProfile: profile,
        worldPolicy: (
            worldPolicy
            && typeof worldPolicy === 'object'
            && worldPolicy.id === profile.id
        )
            ? worldPolicy
            : resolveZenPondWorldPolicy(profile),
    };
};

export const resolveZenEnvFrame = ({
    tuning = null,
    envState = null,
    qualityProfile = null,
    effectIntensityScale = null,
    worldProfile = null,
    worldPolicy = null,
} = {}) => {
    const rawTuning = resolveSafeObject(tuning);
    const safeTuning = projectZenPondTuningV1(rawTuning);
    const safeEnvState = resolveSafeObject(envState);
    const safeQualityProfile = resolveSafeObject(qualityProfile);
    const worldContext = resolveFrameWorldContext({ worldProfile, worldPolicy });
    const cause = selectZenEnvCause(safeTuning);
    const normalizedTuning = {
        ...safeTuning,
        envCloudiness: cause.envCloudiness,
        envRainIntensity: cause.envRainIntensity,
        envWaterClarity: cause.envWaterClarity,
    };
    const lightingResolution = resolveZenLightingProfile({
        tuning: normalizedTuning,
        envState: safeEnvState,
        qualityProfile: safeQualityProfile,
        effectIntensityScale,
    });
    const resolvedEffectIntensityScale = lightingResolution.effectIntensityScale;
    const lightingProfile = lightingResolution.lightingProfile;
    const waterSurfaceCause = resolveZenWaterSurfaceCause({
        tuning: normalizedTuning,
        envState: safeEnvState,
    });
    const waterDerivation = resolveZenWaterDerivationState({
        tuning: normalizedTuning,
        envState: safeEnvState,
        qualityProfile: safeQualityProfile,
        waterSurfaceCause,
    });
    const frameEnv = buildZenFrameEnv({
        envState: safeEnvState,
        coreEnv: waterDerivation.coreEnv,
    });
    const channels = buildZenDerivedChannels({
        frameEnv,
        coreEnv: waterDerivation.coreEnv,
        lightingProfile,
        waterDerivation,
    });
    return buildZenFrameContract({
        normalizedTuning,
        cause: {
            ...cause,
            waterSurface: waterSurfaceCause,
        },
        envState: safeEnvState,
        qualityProfile: safeQualityProfile,
        effectIntensityScale: resolvedEffectIntensityScale,
        quality: {
            profile: safeQualityProfile,
            effectIntensityScale: resolvedEffectIntensityScale,
        },
        channels,
        temporal: {},
        frameEnv,
        worldProfile: worldContext.worldProfile,
        worldPolicy: worldContext.worldPolicy,
    });
};
