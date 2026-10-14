import {
    DEFAULT_ZEN_WORLD_TIME_CONTEXT,
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
    requireZenWorldEnvironmentAuthority,
} from '../../../../runtime/environment/zenWorldEnvironmentAuthority.js';
import {
    resolveZenRealtimeSyncIntervalMs,
} from '../../../../runtime/environment/zenWorldEnvironmentKernel.js';
import {
    buildZenPondWorldEnvironmentAuthority,
    projectZenPondEnvironment,
    projectZenWorldEnvironmentRuntimeTarget,
} from '../../../runtime/core/zenPondEnvironmentProjection.js';

export const DEFAULT_RUNTIME_TIME_CONTEXT = DEFAULT_ZEN_WORLD_TIME_CONTEXT;

export const buildRuntimeEnvAuthoritySnapshot = (candidate = null) => (
    candidate === null || candidate === undefined
        ? buildZenPondWorldEnvironmentAuthority()
        : requireZenWorldEnvironmentAuthority(candidate)
);

export const normalizeRuntimeEnvAuthority = requireZenWorldEnvironmentAuthority;
export { projectZenWorldEnvironmentRuntimeTarget };
export const resolveWorkerEnvironmentState = projectZenPondEnvironment;

export const resolveWorkerClockEnvAuthority = (envAuthority) => (
    requireZenWorldEnvironmentAuthority(envAuthority)
);

export const resolveWorkerClockEnvironmentState = ({
    tuning = null,
    envAuthority,
    now = null,
} = {}) => (
    projectZenPondEnvironment({
        tuning,
        authority: requireZenWorldEnvironmentAuthority(envAuthority),
        now,
    })
);

export const resolveWorkerClockSyncIntervalMs = ({
    envAuthority,
    documentVisible = true,
} = {}) => {
    const authority = requireZenWorldEnvironmentAuthority(envAuthority);
    return resolveZenRealtimeSyncIntervalMs({
        timeContext: authority.timeContext,
        documentVisible,
        solarSyncEnabled: (
            authority.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
        ),
    });
};
