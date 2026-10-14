import { resolveZenWaterFrameState } from '../../../runtime/zenWaterFrameState.js';
import {
    resolveZenPondWorldPolicy,
    resolveZenPondWorldProfile,
} from '../../../runtime/core/zenPondWorldProfile.js';

const resolveRuntimeWorldContext = (envAuthority = null) => {
    const worldProfile = resolveZenPondWorldProfile(envAuthority?.worldId);
    return {
        worldProfile,
        worldPolicy: resolveZenPondWorldPolicy(worldProfile),
    };
};

export const resolveWorkerRuntimeFrameState = ({
    tuning = null,
    envState = null,
    qualityProfile = null,
    effectIntensityScale = 1,
    envAuthority = null,
} = {}) => {
    const worldContext = resolveRuntimeWorldContext(envAuthority);
    return resolveZenWaterFrameState({
        tuning,
        envState,
        qualityProfile,
        effectIntensityScale,
        worldProfile: worldContext.worldProfile,
        worldPolicy: worldContext.worldPolicy,
    });
};
