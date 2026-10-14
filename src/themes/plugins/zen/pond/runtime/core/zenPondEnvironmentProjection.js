import { selectZenEnvCause } from './zenCauseModel.js';
import {
    DEFAULT_ZEN_POND_WORLD_ID,
    normalizeZenPondWorldId,
    resolveZenPondWorldPolicy,
    resolveZenPondWorldProfile,
} from './zenPondWorldProfile.js';
import {
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
    DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    buildZenWorldEnvironmentAuthority,
    requireZenWorldEnvironmentAuthority,
} from '../../../runtime/environment/zenWorldEnvironmentAuthority.js';
import {
    sampleZenWorldEnvironment,
} from '../../../runtime/environment/zenWorldEnvironmentKernel.js';
import {
    projectZenPondEnvironmentDynamicTarget,
} from './zenPondEnvironmentDynamicTarget.js';
import { projectZenPondTuningV1 } from '../../contracts/zenPondTuningContract.js';
import {
    projectZenWorldEnvironmentRuntimeTarget,
} from '../../../runtime/environment/zenWorldEnvironmentRuntimeTarget.js';

export const ZEN_POND_ENVIRONMENT_PROJECTION_CONTRACT = 'zen.pond.environment.projection';
export const ZEN_POND_ENVIRONMENT_PROJECTION_VERSION = 2;

export {
    projectZenWorldEnvironmentRuntimeTarget,
} from '../../../runtime/environment/zenWorldEnvironmentRuntimeTarget.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const quantize = (value, scale = 100) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'na';
    return String(Math.round(numeric * scale));
};

export const buildZenPondEnvironmentDynamicSignature = ({
    authority,
    target,
} = {}) => {
    const requiredAuthority = requireZenWorldEnvironmentAuthority(authority);
    if (!isObject(target)) {
        throw new Error('ZEN_POND_ENVIRONMENT_DYNAMIC_TARGET_REQUIRED');
    }
    return [
        `zen_pond_environment_dynamic_v${ZEN_POND_ENVIRONMENT_PROJECTION_VERSION}`,
        requiredAuthority.authoritySignature,
        typeof target.weatherEventId === 'string' ? target.weatherEventId : '',
        typeof target.weatherEventPhase === 'string' ? target.weatherEventPhase : '',
        quantize(target.daylight),
        quantize(target.night),
        quantize(target.solarElevation),
        quantize(target.lightIntensity),
        quantize(target.cloudCover),
        quantize(target.sunTransmission, 10000),
        quantize(target.directSunlight, 10000),
        quantize(target.diffuseSkylight, 10000),
        quantize(target.cloudPhaseX, 100000),
        quantize(target.cloudPhaseY, 100000),
        quantize(target.rainIntensity),
        quantize(target.postRainWeight),
        quantize(target.windIntensity),
        quantize(target.windDirection, 1000),
        quantize(target.gustEnvelope),
        quantize(target.petals, 20),
        quantize(target.fireflies, 20),
        quantize(target.koiActivity, 20),
    ].join('|');
};

export const buildZenPondWorldEnvironmentAuthority = ({
    worldId = null,
    timeContext,
    solarCoordinates = DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    solarTimeZone = '',
    solarSyncEnabled = true,
    weatherAuthority,
} = {}) => buildZenWorldEnvironmentAuthority({
    worldId: normalizeZenPondWorldId(
        worldId || solarCoordinates?.worldId || DEFAULT_ZEN_POND_WORLD_ID,
        DEFAULT_ZEN_POND_WORLD_ID,
    ),
    timeContext,
    solarCoordinates,
    solarTimeZone,
    clockMode: solarSyncEnabled === false
        ? ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED
        : ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME,
    weatherAuthority,
});

export const projectZenPondEnvironment = ({
    tuning = null,
    authority,
    causeChannelTuning = null,
    envCause = null,
    now = null,
} = {}) => {
    const requiredAuthority = requireZenWorldEnvironmentAuthority(authority);
    const normalizedWorldId = normalizeZenPondWorldId(requiredAuthority.worldId);
    if (normalizedWorldId !== requiredAuthority.worldId) {
        throw new Error('ZEN_POND_ENVIRONMENT_WORLD_ID_NON_CANONICAL');
    }
    const resolvedCauseChannelTuning = isObject(causeChannelTuning)
        ? causeChannelTuning
        : projectZenPondTuningV1(isObject(tuning) ? tuning : {});
    const resolvedEnvCause = isObject(envCause)
        ? envCause
        : selectZenEnvCause(resolvedCauseChannelTuning);
    const worldSnapshot = sampleZenWorldEnvironment({
        authority: requiredAuthority,
        now,
    });
    const dynamicTarget = projectZenPondEnvironmentDynamicTarget(worldSnapshot);
    const worldProfile = resolveZenPondWorldProfile(normalizedWorldId);
    const worldPolicy = resolveZenPondWorldPolicy(worldProfile);
    const projection = Object.freeze({
        contract: ZEN_POND_ENVIRONMENT_PROJECTION_CONTRACT,
        version: ZEN_POND_ENVIRONMENT_PROJECTION_VERSION,
        sourceAuthorityRevision: worldSnapshot.identity.authorityRevision,
        sourceSampleId: worldSnapshot.identity.sampleId,
        dynamicTarget,
        dynamicSignature: buildZenPondEnvironmentDynamicSignature({
            authority: worldSnapshot.authority,
            target: dynamicTarget,
        }),
        bakeSignature: 'zen_pond_environment_bake:none',
    });
    return Object.freeze({
        worldSnapshot,
        projection,
        causeChannelTuning: resolvedCauseChannelTuning,
        envCause: resolvedEnvCause,
        envAuthority: worldSnapshot.authority,
        worldProfile,
        worldPolicy,
        timeContext: worldSnapshot.timeContext,
        solarState: worldSnapshot.solar.state,
        envState: dynamicTarget,
    });
};
