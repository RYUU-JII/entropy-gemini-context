import { getSolarState } from '@/lib/solarCalculations.js';
import { getRealtimeClockContext } from './zenWorldClock.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
// Screen +X is right, +Y is down: east -> left, south -> up, west -> right.
// Rotate the shared world light, never the astronomical azimuth or altitude.
const ZEN_WORLD_SOLAR_SCREEN_ROTATION = Math.PI / 2;
const smoothstep = (from, to, value) => {
    const t = clamp01((value - from) / (to - from));
    return t * t * (3 - 2 * t);
};

export const resolveZenSolarDayPhaseFromAltitude = (altitudeDeg) => {
    if (!Number.isFinite(altitudeDeg)) throw new Error('ZEN_SOLAR_ALTITUDE_REQUIRED');
    const daylight = smoothstep(-9, 1.5, altitudeDeg);
    return Object.freeze({ daylight, nightDepth: 1 - daylight });
};

export const resolveZenWorldSolar = ({ timeContext, solarCoordinates, solarTimeZone }) => {
    if (!Number.isFinite(timeContext?.timestampMs) || !solarCoordinates) {
        throw new Error('ZEN_WORLD_SOLAR_INPUT_REQUIRED');
    }
    const solarState = getSolarState(
        new Date(timeContext.timestampMs), solarCoordinates.latitude, solarCoordinates.longitude,
    );
    if (!solarState) throw new Error('ZEN_WORLD_SOLAR_SAMPLE_INVALID');
    const altitude = solarState.position.altitudeRad;
    const { daylight, nightDepth } = resolveZenSolarDayPhaseFromAltitude(solarState.position.altitudeDeg);
    const solarDay = solarState.day;
    const hourOf = (date) => getRealtimeClockContext({ now: date, timeZone: solarTimeZone }).hour;
    const solarNoonHour = hourOf(solarDay.solarNoon);
    const normal = solarDay.state === 'normal';
    const sunAngle = solarState.position.azimuthSouthRad + Math.PI + ZEN_WORLD_SOLAR_SCREEN_ROTATION;
    const horizontal = Math.cos(altitude);
    const distanceToNoonHours = Math.abs(timeContext.timestampMs - solarDay.solarNoon.getTime()) / 3600000;
    const noonWeight = solarDay.daylightHours > 0
        ? daylight * (1 - smoothstep(0.18, 0.72, distanceToNoonHours / (solarDay.daylightHours * 0.5)))
        : 0;
    return {
        solarState,
        channels: {
            daylight,
            night: nightDepth,
            nightDepth,
            solarElevation: Math.max(0, Math.sin(altitude)),
            solarAltitudeRadians: altitude,
            // Astronomical, never rotated: measured from south toward west.
            sunAzimuthSouthRadians: solarState.position.azimuthSouthRad,
            sunAngle,
            sunDirectionX: Math.cos(sunAngle) * horizontal,
            sunDirectionY: Math.sin(sunAngle) * horizontal,
            sunDirectionZ: Math.sin(altitude),
            sunriseHour: normal ? hourOf(solarDay.sunrise) : null,
            sunsetHour: normal ? hourOf(solarDay.sunset) : null,
            solarNoonHour,
            solarDayState: solarDay.state,
            seasonalDayLength: solarDay.daylightHours,
            seasonalLatitude: solarCoordinates.latitude,
            noonWeight,
        },
    };
};
