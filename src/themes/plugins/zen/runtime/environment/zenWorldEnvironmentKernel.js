import { getCurrentEnvironment } from './zenWorldEnvironmentTimeline.js';
import { getRealtimeClockContext } from './zenWorldClock.js';
import { DEFAULT_ZEN_WEATHER_AUTHORITY } from './zenWorldWeatherAuthority.js';
import {
    DEFAULT_ZEN_WORLD_ID,
    DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
    requireZenWorldEnvironmentAuthority,
    sampleZenWorldEnvironmentAuthorityClock,
} from './zenWorldEnvironmentAuthority.js';
import { buildZenWorldEnvironmentSnapshot } from './zenWorldEnvironmentSnapshot.js';
import { resolveZenWorldSolar } from './zenWorldSolar.js';
import { resolveZenWorldLunar } from './zenWorldLunar.js';

export { resolveZenSolarDayPhaseFromAltitude } from './zenWorldSolar.js';
export { sampleZenWorldCloudLighting } from './zenWorldLighting.js';

export const resolveZenRealtimeClockContext = (timeZone = '', options = null) => (
    getRealtimeClockContext({ timeZone, ...(options === null ? {} : options) })
);

export const resolveZenWorldEnvironmentSampleAuthority = (authority, { now = null } = {}) => {
    const required = requireZenWorldEnvironmentAuthority(authority);
    if (required.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED) return required;
    const timeContext = resolveZenRealtimeClockContext(
        required.solarTimeZone, now === null ? null : { now },
    );
    return sampleZenWorldEnvironmentAuthorityClock(required, timeContext);
};

export const resolveZenCanonicalTimeContext = ({ timeContext, solarTimeZone = 'UTC' }) => {
    if (!Number.isFinite(timeContext?.timestampMs)) throw new Error('ZEN_WORLD_TIMESTAMP_REQUIRED');
    return resolveZenRealtimeClockContext(solarTimeZone, { now: timeContext.timestampMs });
};

export const resolveZenRealtimeSyncIntervalMs = ({
    timeContext = null,
    environment = null,
    documentVisible = true,
    solarSyncEnabled = true,
} = {}) => {
    if (!documentVisible) return 120000;
    if (!solarSyncEnabled) return 60000;
    if (environment) {
        const altitude = environment.solarAltitudeRadians * 180 / Math.PI;
        return altitude > -12 && altitude < 12 ? 10000 : 60000;
    }
    // React's clock-only owner has no solar sample. A stable cadence here avoids
    // maintaining another set of sunrise/sunset hours outside the solar owner.
    if (timeContext !== null && !Number.isFinite(timeContext.hour)) throw new Error('ZEN_CLOCK_HOUR_INVALID');
    return 60000;
};

export const resolveZenSolarState = ({
    timeContext,
    solarCoordinates = DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    solarTimeZone = 'UTC',
}) => resolveZenWorldSolar({ timeContext, solarCoordinates, solarTimeZone }).solarState;

const resolveZenEnvironmentStateFromCanonicalTimeContext = ({
    timeContext,
    solarCoordinates = DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    solarTimeZone = 'UTC',
    weatherAuthority = DEFAULT_ZEN_WEATHER_AUTHORITY,
    worldId = DEFAULT_ZEN_WORLD_ID,
}) => {
    const { solarState, channels } = resolveZenWorldSolar({ timeContext, solarCoordinates, solarTimeZone });
    const lunar = resolveZenWorldLunar({ timeContext, solarCoordinates });
    const envState = getCurrentEnvironment(timeContext.hour, {
        timeContext,
        solarChannels: channels,
        lunarChannels: lunar.channels,
        weatherAuthority,
        worldId,
    });
    return { timeContext, solarState, envState };
};

// Direct authoring entry. The runtime sampling owner below accepts only a
// signed authority; Pond material tuning never participates in world sampling.
export const resolveZenEnvironmentState = ({
    timeContext,
    solarCoordinates = DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    solarTimeZone = 'UTC',
    weatherAuthority = DEFAULT_ZEN_WEATHER_AUTHORITY,
    worldId = DEFAULT_ZEN_WORLD_ID,
}) => resolveZenEnvironmentStateFromCanonicalTimeContext({
    timeContext: resolveZenCanonicalTimeContext({ timeContext, solarTimeZone }),
    solarCoordinates,
    solarTimeZone,
    weatherAuthority,
    worldId,
});

export const sampleZenWorldEnvironment = ({ authority, now = null }) => {
    const sampledAuthority = resolveZenWorldEnvironmentSampleAuthority(authority, { now });
    const timeContext = resolveZenCanonicalTimeContext({
        timeContext: sampledAuthority.timeContext,
        solarTimeZone: sampledAuthority.solarTimeZone,
    });
    const resolved = resolveZenEnvironmentStateFromCanonicalTimeContext({
        timeContext,
        solarCoordinates: sampledAuthority.solarCoordinates,
        solarTimeZone: sampledAuthority.solarTimeZone,
        weatherAuthority: sampledAuthority.weatherAuthority,
        worldId: sampledAuthority.worldId,
    });
    return buildZenWorldEnvironmentSnapshot({
        authority: sampledAuthority,
        timeContext,
        solarState: resolved.solarState,
        environment: resolved.envState,
    });
};
