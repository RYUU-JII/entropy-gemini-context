import {
    DEFAULT_ZEN_WEATHER_AUTHORITY,
    normalizeZenWeatherAuthority,
} from './zenWorldWeatherAuthority.js';
import { getRealtimeClockContext } from './zenWorldClock.js';

export const ZEN_WORLD_ENVIRONMENT_AUTHORITY_CONTRACT = 'zen.world.environment.authority';
export const ZEN_WORLD_ENVIRONMENT_AUTHORITY_VERSION = 2;
export const ZEN_WORLD_ENVIRONMENT_MODEL_REVISION = 'solar3.weather3.cloud1.light2.chroma2';
export const DEFAULT_ZEN_WORLD_ID = 'zen_pond';
export const DEFAULT_ZEN_WORLD_SOLAR_COORDINATES = Object.freeze({ latitude: 35.6, longitude: 0 });

export const ZEN_WORLD_ENVIRONMENT_CLOCK_MODES = Object.freeze({
    REALTIME: 'realtime',
    FIXED: 'fixed',
});

export const DEFAULT_ZEN_WORLD_TIME_CONTEXT = Object.freeze({
    hour: 12,
    dayOfYear: 172,
    dayIndex: Math.floor(Date.UTC(2026, 5, 21) / 86400000),
    year: 2026,
    timestampMs: Date.UTC(2026, 5, 21, 12, 0, 0, 0),
});

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const requireWorldId = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_WORLD_ID_REQUIRED');
    }
    return value.trim();
};

const normalizeTimeZone = (value) => {
    if (value === null || value === undefined || value === '') return 'UTC';
    if (typeof value !== 'string') {
        throw new Error('ZEN_WORLD_ENVIRONMENT_TIME_ZONE_INVALID');
    }
    const zone = value.trim();
    return zone.length === 0 ? 'UTC' : zone;
};

const clampNumber = (value, min, max, errorCode) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(errorCode);
    return Math.min(max, Math.max(min, numeric));
};

const normalizeTimeContext = (timeContext = null) => {
    if (!isObject(timeContext)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_TIME_CONTEXT_REQUIRED');
    }
    const timestampMs = Number(timeContext.timestampMs);
    if (!Number.isFinite(timestampMs)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_TIMESTAMP_REQUIRED');
    }
    return Object.freeze({
        hour: Number(clampNumber(
            timeContext.hour,
            0,
            24,
            'ZEN_WORLD_ENVIRONMENT_HOUR_REQUIRED',
        ).toFixed(4)),
        dayOfYear: Math.floor(clampNumber(
            timeContext.dayOfYear,
            1,
            366,
            'ZEN_WORLD_ENVIRONMENT_DAY_OF_YEAR_REQUIRED',
        )),
        dayIndex: Math.floor(clampNumber(
            timeContext.dayIndex,
            -10_000_000,
            10_000_000,
            'ZEN_WORLD_ENVIRONMENT_DAY_INDEX_REQUIRED',
        )),
        year: Math.floor(clampNumber(
            timeContext.year,
            2000,
            2400,
            'ZEN_WORLD_ENVIRONMENT_YEAR_REQUIRED',
        )),
        timestampMs: Math.floor(timestampMs),
    });
};

const normalizeSolarCoordinates = (solarCoordinates = null) => {
    if (!isObject(solarCoordinates)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_SOLAR_COORDINATES_INVALID');
    }
    const latitude = clampNumber(
        solarCoordinates.latitude,
        -90,
        90,
        'ZEN_WORLD_ENVIRONMENT_SOLAR_LATITUDE_REQUIRED',
    );
    const longitude = clampNumber(
        solarCoordinates.longitude,
        -180,
        180,
        'ZEN_WORLD_ENVIRONMENT_SOLAR_LONGITUDE_REQUIRED',
    );
    return Object.freeze({
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
    });
};

const buildWeatherSignature = (weatherAuthority) => ([
    `weather:v${weatherAuthority.version}`,
    weatherAuthority.mode,
    Number.isFinite(Number(weatherAuthority.fixedCloudCover))
        ? Number(weatherAuthority.fixedCloudCover).toFixed(4)
        : '',
    Number.isFinite(Number(weatherAuthority.fixedRainIntensity))
        ? Number(weatherAuthority.fixedRainIntensity).toFixed(4)
        : '',
].join(':'));

const buildAuthoritySignature = ({
    worldId,
    clockMode,
    timeContext,
    solarCoordinates,
    solarTimeZone,
    weatherAuthority,
    modelRevision,
}) => ([
    `zen_world_environment_authority_v${ZEN_WORLD_ENVIRONMENT_AUTHORITY_VERSION}`,
    modelRevision,
    worldId,
    clockMode,
    clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED
        ? [
            'fixed',
            timeContext.timestampMs,
            timeContext.year,
            timeContext.dayOfYear,
            timeContext.dayIndex,
            timeContext.hour.toFixed(4),
        ].join(':')
        : 'worker_clock',
    solarTimeZone,
    solarCoordinates
        ? `${solarCoordinates.latitude.toFixed(6)},${solarCoordinates.longitude.toFixed(6)}`
        : 'no_solar_coordinates',
    buildWeatherSignature(weatherAuthority),
].join('|'));

const hasSameContractValue = (candidate, canonical) => {
    if (candidate === canonical) return true;
    if (!isObject(candidate) || !isObject(canonical)) return false;
    const candidateKeys = Object.keys(candidate).sort();
    const canonicalKeys = Object.keys(canonical).sort();
    if (
        candidateKeys.length !== canonicalKeys.length
        || candidateKeys.some((key, index) => key !== canonicalKeys[index])
    ) {
        return false;
    }
    return canonicalKeys.every((key) => {
        const candidateValue = candidate[key];
        const canonicalValue = canonical[key];
        return isObject(canonicalValue)
            ? hasSameContractValue(candidateValue, canonicalValue)
            : candidateValue === canonicalValue;
    });
};

export const buildZenWorldEnvironmentAuthority = ({
    worldId,
    timeContext = DEFAULT_ZEN_WORLD_TIME_CONTEXT,
    solarCoordinates = DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    solarTimeZone = '',
    clockMode = ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME,
    weatherAuthority = DEFAULT_ZEN_WEATHER_AUTHORITY,
    modelRevision = ZEN_WORLD_ENVIRONMENT_MODEL_REVISION,
} = {}) => {
    if (modelRevision !== ZEN_WORLD_ENVIRONMENT_MODEL_REVISION) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_MODEL_REVISION_INVALID');
    }
    if (!Object.values(ZEN_WORLD_ENVIRONMENT_CLOCK_MODES).includes(clockMode)) {
        throw new Error(`ZEN_WORLD_ENVIRONMENT_CLOCK_MODE_INVALID:${String(clockMode)}`);
    }
    const normalizedWorldId = requireWorldId(worldId);
    const normalizedCoordinates = normalizeSolarCoordinates(solarCoordinates);
    const normalizedTimeZone = normalizeTimeZone(solarTimeZone);
    if (!Number.isFinite(timeContext?.timestampMs)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_TIMESTAMP_REQUIRED');
    }
    const normalizedTimeContext = normalizeTimeContext(getRealtimeClockContext({
        now: timeContext.timestampMs,
        timeZone: normalizedTimeZone,
    }));
    const normalizedWeatherAuthority = normalizeZenWeatherAuthority(weatherAuthority);
    const authoritySignature = buildAuthoritySignature({
        worldId: normalizedWorldId,
        clockMode,
        timeContext: normalizedTimeContext,
        solarCoordinates: normalizedCoordinates,
        solarTimeZone: normalizedTimeZone,
        weatherAuthority: normalizedWeatherAuthority,
        modelRevision,
    });
    return Object.freeze({
        contract: ZEN_WORLD_ENVIRONMENT_AUTHORITY_CONTRACT,
        version: ZEN_WORLD_ENVIRONMENT_AUTHORITY_VERSION,
        worldId: normalizedWorldId,
        modelRevision,
        clockMode,
        timeContext: normalizedTimeContext,
        solarCoordinates: normalizedCoordinates,
        solarTimeZone: normalizedTimeZone,
        weatherAuthority: normalizedWeatherAuthority,
        authoritySignature,
    });
};

export const requireZenWorldEnvironmentAuthority = (candidate) => {
    if (!isObject(candidate)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_AUTHORITY_REQUIRED');
    }
    if (
        candidate.contract !== ZEN_WORLD_ENVIRONMENT_AUTHORITY_CONTRACT
        || candidate.version !== ZEN_WORLD_ENVIRONMENT_AUTHORITY_VERSION
    ) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_AUTHORITY_CONTRACT_INVALID');
    }
    const canonical = buildZenWorldEnvironmentAuthority(candidate);
    if (candidate.authoritySignature !== canonical.authoritySignature) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_AUTHORITY_SIGNATURE_INVALID');
    }
    if (!hasSameContractValue(candidate, canonical)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_AUTHORITY_NON_CANONICAL');
    }
    return canonical;
};

export const sampleZenWorldEnvironmentAuthorityClock = (
    authority,
    timeContext,
) => {
    const requiredAuthority = requireZenWorldEnvironmentAuthority(authority);
    return buildZenWorldEnvironmentAuthority({
        ...requiredAuthority,
        timeContext,
    });
};
