import {
    requireZenWorldEnvironmentAuthority,
} from './zenWorldEnvironmentAuthority.js';

export const ZEN_WORLD_ENVIRONMENT_SNAPSHOT_CONTRACT = 'zen.world.environment.snapshot';
export const ZEN_WORLD_ENVIRONMENT_SNAPSHOT_VERSION = 2;

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
    return value;
};

const requireFinite = (value, fieldName) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_WORLD_ENVIRONMENT_SNAPSHOT_FIELD_REQUIRED:${fieldName}`);
    }
    return numeric;
};

export const buildZenWorldEnvironmentSnapshot = ({
    authority,
    timeContext,
    solarState,
    environment,
} = {}) => {
    const requiredAuthority = requireZenWorldEnvironmentAuthority(authority);
    if (!isObject(timeContext) || !isObject(environment)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_SNAPSHOT_INPUT_REQUIRED');
    }
    for (const field of [
        'daylight', 'night', 'nightDepth', 'noonWeight', 'solarAltitudeRadians',
        'sunDirectionX', 'sunDirectionY', 'sunDirectionZ', 'directSunlight',
        'diffuseSkylight', 'sunTransmission', 'sceneBrightness', 'clearDirectSunlight',
        'cloudSeed', 'cloudPhaseX', 'cloudPhaseY', 'cloudThreshold', 'cloudDensity', 'airHaze',
    ]) requireFinite(environment[field], field);
    if (environment.nightDepth !== environment.night || Math.abs(environment.daylight + environment.night - 1) > 1e-9) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_DAY_PHASE_INCONSISTENT');
    }
    const sampledAtMs = Math.floor(requireFinite(timeContext.timestampMs, 'timeContext.timestampMs'));
    const sampleId = `${requiredAuthority.authoritySignature}|sample:${sampledAtMs}`;
    return deepFreeze({
        contract: ZEN_WORLD_ENVIRONMENT_SNAPSHOT_CONTRACT,
        version: ZEN_WORLD_ENVIRONMENT_SNAPSHOT_VERSION,
        identity: {
            authorityRevision: requiredAuthority.authoritySignature,
            sampleId,
            sampledAtMs,
        },
        authority: requiredAuthority,
        timeContext: { ...timeContext },
        solar: {
            enabled: true,
            timeZone: requiredAuthority.solarTimeZone,
            coordinates: requiredAuthority.solarCoordinates,
            state: solarState,
        },
        environment: { ...environment },
    });
};

export const requireZenWorldEnvironmentSnapshot = (candidate) => {
    if (
        !isObject(candidate)
        || candidate.contract !== ZEN_WORLD_ENVIRONMENT_SNAPSHOT_CONTRACT
        || candidate.version !== ZEN_WORLD_ENVIRONMENT_SNAPSHOT_VERSION
        || !isObject(candidate.identity)
        || !isObject(candidate.authority)
        || !isObject(candidate.timeContext)
        || !isObject(candidate.environment)
    ) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_SNAPSHOT_REQUIRED');
    }
    requireZenWorldEnvironmentAuthority(candidate.authority);
    if (candidate.identity.authorityRevision !== candidate.authority.authoritySignature) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_SNAPSHOT_AUTHORITY_REVISION_INVALID');
    }
    const sampledAtMs = requireFinite(candidate.identity.sampledAtMs, 'identity.sampledAtMs');
    const expectedSampleId = `${candidate.authority.authoritySignature}|sample:${Math.floor(sampledAtMs)}`;
    if (candidate.identity.sampleId !== expectedSampleId) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_SNAPSHOT_ID_INVALID');
    }
    return candidate;
};
