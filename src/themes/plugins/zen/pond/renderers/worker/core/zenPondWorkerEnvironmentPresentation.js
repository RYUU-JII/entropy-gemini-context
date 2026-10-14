import {
    normalizeRuntimeEnvAuthority,
    resolveWorkerClockEnvironmentState,
    resolveWorkerClockSyncIntervalMs,
} from './zenPondWorkerEnvironment.js';
import {
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
} from '../../../../runtime/environment/zenWorldEnvironmentAuthority.js';
import { projectZenWorldEnvironmentRuntimeTarget } from '../../../../runtime/environment/zenWorldEnvironmentRuntimeTarget.js';
import { sampleZenWorldCloudLighting } from '../../../../runtime/environment/zenWorldLighting.js';
import { resolveZenWorldBotanicalMaterialLighting } from '../../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';

const ENV_FRAME_APPLY_INTERVAL_MS = 100;
const ENV_TARGET_LERP_MS = 30000;
const ENV_TARGET_REFRESH_INTERVAL_SCALE = 1;
const ENV_TARGET_REFRESH_ACTIVE_MIN_MS = 30000;
const ENV_TARGET_REFRESH_ACTIVE_MAX_MS = 60 * 1000;
const ENV_TARGET_REFRESH_HIDDEN_MIN_MS = 60 * 1000;
const ENV_TARGET_REFRESH_HIDDEN_MAX_MS = 120 * 1000;

export const ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS = Object.freeze({
    continuous: Object.freeze([
        'directSunlight',
        'clearDirectSunlight',
        'diffuseSkylight',
        'sunTransmission',
        'sceneBrightness',
        'nightDepth',
        'noonWeight',
        'solarAltitudeRadians',
        'sunDirectionX',
        'sunDirectionY',
        'sunDirectionZ',
        'cloudThreshold',
        'cloudDensity',
        'airHaze',
        'daylight',
        'night',
        'moonlight',
        'moonPhase',
        'cloudCover',
        'overcastWeight',
        'rainIntensity',
        'precipitationPotential',
        'weatherEventProgress',
        'weatherEventPhaseProgress',
        'weatherFrontWeight',
        'weatherGustBoost',
        'weatherHazeBoost',
        'postRainWeight',
        'seasonalWetness',
        'cloudOcclusion',
        'solarElevation',
        'lightIntensity',
        'causticsIntensity',
        'shadowLength',
        'windIntensity',
        'gustEnvelope',
        'cloudDrift',
        'haze',
        'petals',
        'fireflies',
        'koiActivity',
        'cloudReflection',
        'clearSkyReflectionBoost',
        'seasonalDayLength',
        'seasonalLatitude',
        'sunriseHour',
        'sunsetHour',
    ]),
    angular: Object.freeze([
        'sunAngle',
        'windDirection',
    ]),
    cyclicHours: Object.freeze([
        'time',
    ]),
    cyclicUnits: Object.freeze(['cloudPhaseX', 'cloudPhaseY']),
    colors: Object.freeze(['lightColorRgb', 'temporalTintRgb']),
    chromatic: Object.freeze(['daylight', 'nightDepth', 'dawnWeight', 'duskWeight', 'warmth', 'lowSun', 'noonWeight', 'twilightWeight', 'nightWeight']),
    stepped: Object.freeze([
        'botanicalMaterialLighting',
        'cloudSeed',
        'name',
        'weatherKind',
        'weatherAuthorityMode',
        'weatherRegime',
        'weatherEventScheduled',
        'weatherEventActive',
        'weatherEventId',
        'weatherEventKind',
        'weatherEventPhase',
        'weatherEventStartHour',
        'weatherEventEndHour',
        'guaranteedRainDay',
        'moonAge',
        'lightColor',
        'temporalTintColor',
        'waterPalette',
    ]),
    nonInterpolated: Object.freeze([
        'dayIndex',
        'dayOfYear',
        'year',
    ]),
});

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

export const createEnvironmentRuntimeState = () => ({
    currentEnv: null,
    targetEnv: null,
    targetSignature: '',
    lastTargetRefreshAtMs: 0,
    nextTargetRefreshAtMs: 0,
    lastApplyAtMs: 0,
});

export const normalizeRuntimeEnv = (env) => {
    const target = projectZenWorldEnvironmentRuntimeTarget(env);
    // Realm-local paint functions are compiled at the existing slow target seam,
    // never sent over IPC or resolved by entity motion/render frames.
    return { ...target, botanicalMaterialLighting: resolveZenWorldBotanicalMaterialLighting(target) };
};

export const ensureEnvironmentRuntime = (state) => {
    if (!isObject(state?.environmentRuntime)) {
        state.environmentRuntime = createEnvironmentRuntimeState();
    }
    return state.environmentRuntime;
};

export const resolveZenPondWorkerEnvironmentTarget = ({
    tuning = null,
    envAuthority = null,
} = {}) => {
    const resolved = resolveWorkerClockEnvironmentState({
        tuning,
        envAuthority,
    });
    const nextAuthority = normalizeRuntimeEnvAuthority(resolved?.envAuthority);
    const nextEnv = normalizeRuntimeEnv(resolved?.envState);
    return {
        envAuthority: nextAuthority,
        env: nextEnv,
        signature: resolved?.projection?.dynamicSignature || '',
    };
};

const shouldSnapEnvironmentPresentation = ({
    envRuntime = null,
    previousEnvAuthority = null,
    nextEnvAuthority = null,
    firstFrameAckEmitted = false,
} = {}) => {
    if (!isObject(envRuntime?.currentEnv)) return true;
    if (firstFrameAckEmitted !== true) return true;
    if (previousEnvAuthority?.clockMode !== nextEnvAuthority?.clockMode) return true;
    if (nextEnvAuthority?.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED) return true;
    if (previousEnvAuthority?.worldId !== nextEnvAuthority?.worldId) return true;
    if (previousEnvAuthority?.solarTimeZone !== nextEnvAuthority?.solarTimeZone) return true;
    return false;
};

export const setZenPondEnvironmentPresentationTarget = ({
    envRuntime = null,
    previousEnvAuthority = null,
    nextTarget = null,
    firstFrameAckEmitted = false,
} = {}) => {
    if (!isObject(envRuntime)) {
        throw new Error('ZEN_POND_ENV_PRESENTATION_RUNTIME_MISSING');
    }
    if (!isObject(nextTarget?.env) || !isObject(nextTarget?.envAuthority)) {
        throw new Error('ZEN_POND_ENV_TARGET_MISSING');
    }
    const snapPresentation = shouldSnapEnvironmentPresentation({
        envRuntime,
        previousEnvAuthority,
        nextEnvAuthority: nextTarget.envAuthority,
        firstFrameAckEmitted,
    });
    envRuntime.targetEnv = nextTarget.env;
    envRuntime.targetSignature = nextTarget.signature;
    envRuntime.lastTargetRefreshAtMs = 0;
    envRuntime.nextTargetRefreshAtMs = 0;
    envRuntime.currentEnv = snapPresentation
        ? nextTarget.env
        : envRuntime.currentEnv;
    return {
        currentEnv: envRuntime.currentEnv,
        snapped: snapPresentation,
    };
};

const lerpNumber = (current, target, alpha) => {
    if (target === null) return null;
    if (current === null) return target;
    const currentNumber = Number(current);
    const targetNumber = Number(target);
    if (!Number.isFinite(targetNumber)) return target;
    if (!Number.isFinite(currentNumber)) return targetNumber;
    return currentNumber + ((targetNumber - currentNumber) * alpha);
};

const lerpAngle = (current, target, alpha) => {
    const currentNumber = Number(current);
    const targetNumber = Number(target);
    if (!Number.isFinite(targetNumber)) return target;
    if (!Number.isFinite(currentNumber)) return targetNumber;
    const delta = Math.atan2(
        Math.sin(targetNumber - currentNumber),
        Math.cos(targetNumber - currentNumber),
    );
    return currentNumber + delta * alpha;
};

const lerpCyclicHour = (current, target, alpha) => {
    const currentNumber = Number(current);
    const targetNumber = Number(target);
    if (!Number.isFinite(targetNumber)) return target;
    if (!Number.isFinite(currentNumber)) return targetNumber;
    const delta = ((((targetNumber - currentNumber) % 24) + 36) % 24) - 12;
    return ((currentNumber + (delta * alpha)) % 24 + 24) % 24;
};

export const interpolateZenPondEnvironmentTarget = (
    currentEnv,
    targetEnv,
    alpha = 1,
) => {
    if (!isObject(currentEnv) || !isObject(targetEnv)) {
        throw new Error('ZEN_POND_ENV_INTERPOLATION_TARGET_REQUIRED');
    }
    const amount = clamp(alpha, 0, 1);
    const target = targetEnv;
    const current = currentEnv;
    const next = {
        ...target,
    };
    for (const key of ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS.continuous) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            next[key] = lerpNumber(current[key], target[key], amount);
        }
    }
    for (const key of ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS.angular) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            next[key] = lerpAngle(current[key], target[key], amount);
        }
    }
    for (const key of ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS.cyclicHours) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            next[key] = lerpCyclicHour(current[key], target[key], amount);
        }
    }
    for (const key of ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS.cyclicUnits) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            const delta = ((target[key] - current[key] + 1.5) % 1) - 0.5;
            next[key] = ((current[key] + delta * amount) % 1 + 1) % 1;
        }
    }
    for (const key of ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS.colors) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            next[key] = target[key].map((value, index) => lerpNumber(current[key][index], value, amount));
        }
    }
    if (target.ambientChromaticState) {
        next.ambientChromaticState = { ...target.ambientChromaticState };
        for (const key of ZEN_POND_ENVIRONMENT_INTERPOLATION_FIELDS.chromatic) {
            next.ambientChromaticState[key] = lerpNumber(current.ambientChromaticState[key], target.ambientChromaticState[key], amount);
        }
    }
    return next;
};

const resolveNextEnvironmentRefreshAtMs = ({
    timestampMs = 0,
    envAuthority = null,
    active = true,
} = {}) => {
    if (envAuthority?.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED) {
        return Number.POSITIVE_INFINITY;
    }
    const intervalMs = resolveWorkerClockSyncIntervalMs({
        envAuthority,
        documentVisible: active === true,
    });
    const scaledIntervalMs = Math.max(
        1000,
        Number(intervalMs) || 60000,
    ) * ENV_TARGET_REFRESH_INTERVAL_SCALE;
    const refreshIntervalMs = active === true
        ? clamp(scaledIntervalMs, ENV_TARGET_REFRESH_ACTIVE_MIN_MS, ENV_TARGET_REFRESH_ACTIVE_MAX_MS)
        : clamp(scaledIntervalMs, ENV_TARGET_REFRESH_HIDDEN_MIN_MS, ENV_TARGET_REFRESH_HIDDEN_MAX_MS);
    return Math.max(0, Number(timestampMs) || 0) + refreshIntervalMs;
};

export const updateZenPondEnvironmentPresentation = ({
    envRuntime = null,
    tuning = null,
    envAuthority = null,
    active = true,
    timestampMs = 0,
    worldTimestampMs = Date.now(),
} = {}) => {
    if (!isObject(envRuntime)) {
        throw new Error('ZEN_POND_ENV_PRESENTATION_RUNTIME_MISSING');
    }
    const nowMs = Math.max(0, Number(timestampMs) || 0);
    let targetChanged = false;
    let currentAuthority = envAuthority;
    if (
        !envRuntime.targetEnv
        || nowMs >= Number(envRuntime.nextTargetRefreshAtMs || 0)
    ) {
        const nextTarget = resolveZenPondWorkerEnvironmentTarget({
            tuning,
            envAuthority,
        });
        targetChanged = nextTarget.signature !== envRuntime.targetSignature;
        envRuntime.targetEnv = nextTarget.env;
        envRuntime.targetSignature = nextTarget.signature;
        envRuntime.lastTargetRefreshAtMs = nowMs;
        envRuntime.nextTargetRefreshAtMs = resolveNextEnvironmentRefreshAtMs({
            timestampMs: nowMs,
            envAuthority: nextTarget.envAuthority,
            active,
        });
        currentAuthority = nextTarget.envAuthority;
    }

    if (
        !targetChanged
        && envRuntime.lastApplyAtMs > 0
        && (nowMs - envRuntime.lastApplyAtMs) < ENV_FRAME_APPLY_INTERVAL_MS
    ) {
        return {
            applied: false,
            envAuthority: currentAuthority,
            env: envRuntime.currentEnv,
            targetChanged,
        };
    }

    const deltaMs = envRuntime.lastApplyAtMs > 0
        ? Math.max(0, nowMs - envRuntime.lastApplyAtMs)
        : ENV_FRAME_APPLY_INTERVAL_MS;
    envRuntime.lastApplyAtMs = nowMs;
    const alpha = 1 - Math.exp(-deltaMs / ENV_TARGET_LERP_MS);
    envRuntime.currentEnv = envRuntime.currentEnv
        ? interpolateZenPondEnvironmentTarget(
            envRuntime.currentEnv,
            envRuntime.targetEnv,
            alpha,
        )
        : envRuntime.targetEnv;
    const cloudEpoch = currentAuthority.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED
        ? currentAuthority.timeContext.timestampMs : worldTimestampMs;
    // Sample the PRESENTED descriptor, not the future macro target. CPU sun
    // visibility and the GPU reflected ray now see identical density/phase.
    // This is a four-texel lookup; no solar solver, schema or palette work.
    envRuntime.currentEnv = {
        ...envRuntime.currentEnv,
        ...sampleZenWorldCloudLighting(envRuntime.currentEnv, cloudEpoch),
    };
    return {
        applied: true,
        envAuthority: currentAuthority,
        env: envRuntime.currentEnv,
        targetChanged,
    };
};
