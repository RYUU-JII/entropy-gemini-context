import {
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
    requireZenWorldEnvironmentAuthority,
} from '../environment/zenWorldEnvironmentAuthority.js';
import {
    resolveZenRealtimeSyncIntervalMs,
    sampleZenWorldEnvironment,
} from '../environment/zenWorldEnvironmentKernel.js';
import {
    projectZenWorldEnvironmentRuntimeTarget,
} from '../environment/zenWorldEnvironmentRuntimeTarget.js';
import {
    projectZenBonsaiEnvironment,
} from '../environment/zenBonsaiEnvironmentProjection.js';
import {
    resolveZenBonsaiEnvironmentBakeSignature,
    resolveZenBonsaiEnvironmentSignature,
} from '../zenBonsaiEnvironmentSignatures.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const resolveFallbackSolarPhase = (envState = null) => {
    const daylight = Number(envState?.daylight);
    const night = Number(envState?.night);
    if (Number.isFinite(night) && night >= 0.62) return 'night';
    if (Number.isFinite(daylight) && daylight >= 0.62) return 'day';
    return 'twilight';
};

const normalizeCoordinatesForDiagnostics = (coordinates = null) => {
    if (!isObject(coordinates)) return null;
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
        latitude,
        longitude,
        label: typeof coordinates.label === 'string' ? coordinates.label : '',
        source: typeof coordinates.source === 'string' ? coordinates.source : '',
        presetId: typeof coordinates.presetId === 'string' ? coordinates.presetId : '',
    };
};

export const normalizeBonsaiWorkerEnvAuthority = requireZenWorldEnvironmentAuthority;
export const normalizeBonsaiWorkerEnvironmentSnapshot = projectZenWorldEnvironmentRuntimeTarget;

export const shouldBakeBonsaiWorkerEnvironmentIntoStaticLayers = (envAuthority = null) => (
    normalizeBonsaiWorkerEnvAuthority(envAuthority).clockMode
    === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
);

export const resolveBonsaiWorkerClockEnvAuthority = (envAuthority = null, options = null) => {
    const normalized = normalizeBonsaiWorkerEnvAuthority(envAuthority);
    const snapshot = sampleZenWorldEnvironment({
        authority: normalized,
        now: options?.now ?? null,
    });
    return snapshot.authority;
};

export const resolveBonsaiWorkerClockEnvironmentState = ({
    envAuthority = null,
    now = null,
} = {}) => {
    const worldSnapshot = sampleZenWorldEnvironment({
        authority: normalizeBonsaiWorkerEnvAuthority(envAuthority),
        now,
    });
    const projection = projectZenBonsaiEnvironment(worldSnapshot);
    return {
        worldSnapshot,
        projection,
        envAuthority: worldSnapshot.authority,
        envState: projection.dynamicTarget,
        solarState: worldSnapshot.solar.state,
    };
};

export const resolveBonsaiWorkerClockSyncIntervalMs = ({
    envAuthority = null,
    documentVisible = true,
} = {}) => {
    const normalized = normalizeBonsaiWorkerEnvAuthority(envAuthority);
    return resolveZenRealtimeSyncIntervalMs({
        timeContext: normalized.timeContext,
        documentVisible,
        solarSyncEnabled: (
            normalized.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
        ),
    });
};

export const buildBonsaiWorkerEnvironmentRenderSignature = ({
    envAuthority = null,
    envState = null,
} = {}) => {
    const authority = normalizeBonsaiWorkerEnvAuthority(envAuthority);
    return [
        authority.authoritySignature,
        resolveZenBonsaiEnvironmentSignature(envState),
    ].join('|');
};

export const buildBonsaiWorkerStaticLayerEnvironmentSignature = ({
    envState = null,
} = {}) => resolveZenBonsaiEnvironmentBakeSignature(envState);

export const buildBonsaiWorkerEnvironmentDiagnostics = ({
    envAuthority = null,
    envState = null,
    solarState = null,
    environmentRuntimeConfigSignature = '',
} = {}) => {
    const timeContext = isObject(envAuthority?.timeContext) ? envAuthority.timeContext : {};
    const phase = typeof solarState?.phase === 'string' && solarState.phase
        ? solarState.phase
        : resolveFallbackSolarPhase(envState);
    const timeZone = typeof timeContext.timeZone === 'string' && timeContext.timeZone
        ? timeContext.timeZone
        : (typeof envAuthority?.solarTimeZone === 'string' ? envAuthority.solarTimeZone : '');

    return {
        hour: Number(timeContext.hour),
        timestampMs: Number(timeContext.timestampMs),
        timeZone,
        solarSyncEnabled: (
            envAuthority?.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
        ),
        solarPhase: phase,
        daylight: toFiniteNumber(envState?.daylight, NaN),
        night: toFiniteNumber(envState?.night, NaN),
        solarElevation: toFiniteNumber(envState?.solarElevation, NaN),
        lightIntensity: toFiniteNumber(envState?.lightIntensity, NaN),
        solarDaylightStrength: toFiniteNumber(solarState?.daylightStrength, NaN),
        solarAltitudeDeg: toFiniteNumber(solarState?.position?.altitudeDeg, NaN),
        solarCoordinates: normalizeCoordinatesForDiagnostics(envAuthority?.solarCoordinates),
        environmentRuntimeConfigSignature,
        workerClockOwned: (
            envAuthority?.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
        ),
    };
};
