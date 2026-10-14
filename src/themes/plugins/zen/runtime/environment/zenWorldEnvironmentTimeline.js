import { resolveZenWorldSolar } from './zenWorldSolar.js';
import { resolveZenWorldLunar } from './zenWorldLunar.js';
import { resolveZenWorldLighting } from './zenWorldLighting.js';
import { DEFAULT_ZEN_WORLD_SOLAR_COORDINATES, DEFAULT_ZEN_WORLD_ID } from './zenWorldEnvironmentAuthority.js';
import {
    resolveZenAmbientPalette,
} from './zenWorldMaterialPalette.js';
import {
    resolveZenWorldAmbientGrammar,
} from './zenWorldAmbientGrammar.js';
import {
    ZEN_WEATHER_AUTHORITY_MODES,
    normalizeZenWeatherAuthority,
} from './zenWorldWeatherAuthority.js';
import {
    ZEN_WEATHER_EVENT_KINDS,
    ZEN_WEATHER_EVENT_PHASES,
    resolveZenWeatherEventState,
} from './zenWorldWeatherEventDirector.js';

export const TIME_OF_DAY_KEYFRAMES = [
    {
        time: 0.0, // Midnight
        solarAnchor: { type: 'fixed', hour: 0.0 },
        name: 'Midnight',
        koiActivity: 0.3, // Sleeping/Resting, very slow
        fireflies: 1.0, // Max fireflies
        petals: 0.2, // Fewer falling petals
    },
    {
        time: 5.5, // Dawn
        solarAnchor: { type: 'sunrise_offset', hours: 0.2 },
        name: 'Dawn',
        koiActivity: 0.8, // Waking up
        fireflies: 0.2, // Fading out
        petals: 0.8,
    },
    {
        time: 8.0, // Morning
        solarAnchor: { type: 'day_progress', progress: 0.2 },
        name: 'Morning',
        koiActivity: 1.2, // Very active, feeding time
        fireflies: 0.0,
        petals: 1.0,
    },
    {
        time: 12.0, // Noon
        solarAnchor: { type: 'day_progress', progress: 0.5 },
        name: 'Noon',
        koiActivity: 0.92, // Midday baseline stays alert while still calmer than morning feed
        fireflies: 0.0,
        petals: 1.0,
    },
    {
        time: 16.25, // Clear Afternoon
        solarAnchor: { type: 'day_progress', progress: 0.82 },
        name: 'Clear Afternoon',
        koiActivity: 0.9, // Getting active again
        fireflies: 0.0,
        petals: 1.0,
    },
    {
        time: 17.65, // Late Afternoon
        solarAnchor: { type: 'sunset_offset', hours: -1.05 },
        name: 'Late Afternoon',
        koiActivity: 0.94,
        fireflies: 0.0,
        petals: 0.9,
    },
    {
        time: 19.05, // Sunset
        solarAnchor: { type: 'sunset_offset', hours: 0.35 },
        name: 'Sunset',
        koiActivity: 1.0, // Evening feeding
        fireflies: 0.4, // Starting to appear
        petals: 0.6,
    },
    {
        time: 21.2, // Night
        solarAnchor: { type: 'sunset_offset', hours: 2.5 },
        name: 'Night',
        koiActivity: 0.5, // Slowing down for sleep
        fireflies: 0.8, // Active
        petals: 0.3,
    },
    {
        time: 24.0, // Loop back to midnight
        solarAnchor: { type: 'fixed', hour: 24.0 },
        name: 'Midnight',
        koiActivity: 0.3,
        fireflies: 1.0,
        petals: 0.2,
    }
];

const TAU = Math.PI * 2;
const DEFAULT_CLOUDINESS = 0.38;

// Helper to interpolate between two colors in '#RRGGBB' or 'rgba(R, G, B, A)' strings
function lerpColor(c1, c2, t) {
    const parseC = (str) => {
        if (str.startsWith('#')) {
            return {
                r: parseInt(str.slice(1, 3), 16),
                g: parseInt(str.slice(3, 5), 16),
                b: parseInt(str.slice(5, 7), 16),
                a: 1.0
            };
        }
        if (str.startsWith('rgba')) {
            const parts = str.match(/[\d.]+/g).map(Number);
            return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] };
        }
        return { r: 0, g: 0, b: 0, a: 1 };
    };

    const pc1 = parseC(c1);
    const pc2 = parseC(c2);

    const r = Math.round(pc1.r + (pc2.r - pc1.r) * t);
    const g = Math.round(pc1.g + (pc2.g - pc1.g) * t);
    const b = Math.round(pc1.b + (pc2.b - pc1.b) * t);
    const a = pc1.a + (pc2.a - pc1.a) * t;

    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);

const normalizeHour = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return clamp(numeric, 0, 24);
};

const resolveDayLengthHours = (sunriseHour, sunsetHour, fallback = 12) => {
    const sunrise = Number(sunriseHour);
    const sunset = Number(sunsetHour);
    const fallbackLength = clamp(fallback, 0, 24);
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return fallbackLength;
    let delta = sunset - sunrise;
    if (delta < 0) delta += 24;
    return clamp(delta, 0, 24);
};

const smoothstep = (edge0, edge1, x) => {
    if (edge0 === edge1) return x < edge0 ? 0 : 1;
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

const fract = (value) => value - Math.floor(value);

const hashUnit = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return fract(x);
};

const noise1D = (x) => {
    const i0 = Math.floor(x);
    const i1 = i0 + 1;
    const f = x - i0;
    const u = f * f * (3 - 2 * f);
    const a = hashUnit(i0);
    const b = hashUnit(i1);
    return a + (b - a) * u;
};

const resolveSolarAnchorHour = (anchor = null, solarTimeline = null, fallbackHour = 0) => {
    const type = typeof anchor?.type === 'string' ? anchor.type : 'fixed';
    const sunriseHour = normalizeHour(solarTimeline?.sunriseHour, 6);
    const sunsetHour = normalizeHour(solarTimeline?.sunsetHour, 18);
    const seasonalDayLength = resolveDayLengthHours(
        sunriseHour,
        sunsetHour,
        solarTimeline?.seasonalDayLength,
    );
    if (type === 'sunrise_offset') {
        return normalizeHour(sunriseHour + (Number(anchor.hours) || 0), fallbackHour);
    }
    if (type === 'sunset_offset') {
        return normalizeHour(sunsetHour + (Number(anchor.hours) || 0), fallbackHour);
    }
    if (type === 'day_progress') {
        return normalizeHour(
            sunriseHour + seasonalDayLength * clamp(anchor.progress, 0, 1),
            fallbackHour,
        );
    }
    return normalizeHour(anchor?.hour ?? fallbackHour, fallbackHour);
};

export const resolveSolarRelativeTimeOfDayKeyframes = (solarTimeline = null) => {
    const resolvedFrames = TIME_OF_DAY_KEYFRAMES.map((frame) => ({
        ...frame,
        time: resolveSolarAnchorHour(frame.solarAnchor, solarTimeline, frame.time),
    }));
    for (let i = 1; i < resolvedFrames.length; i += 1) {
        if (i === resolvedFrames.length - 1) {
            resolvedFrames[i] = {
                ...resolvedFrames[i],
                time: 24,
            };
            continue;
        }
        const previousTime = Number(resolvedFrames[i - 1].time);
        const currentTime = Number(resolvedFrames[i].time);
        if (Number.isFinite(previousTime) && Number.isFinite(currentTime) && currentTime <= previousTime) {
            resolvedFrames[i] = {
                ...resolvedFrames[i],
                time: Math.min(23.95, previousTime + 0.05),
            };
        }
    }
    return resolvedFrames;
};

const resolveWeatherEnvelope = ({
    time,
    dayIndex = 0,
    dayOfYear = 172,
    daylight,
    lunar,
    weatherAuthority = null,
}) => {
    const weatherHour = dayIndex * 24 + time;
    const authority = normalizeZenWeatherAuthority(weatherAuthority);
    let cloudCover = DEFAULT_CLOUDINESS;
    let rainIntensity = 0;
    let precipitationPotential = 0;
    let weatherRegime = 'fixed_lab';
    let weatherEventScheduled = false;
    let weatherEventActive = false;
    let weatherEventId = '';
    let weatherEventKind = ZEN_WEATHER_EVENT_KINDS.NONE;
    let weatherEventPhase = ZEN_WEATHER_EVENT_PHASES.AMBIENT;
    let weatherEventProgress = 0;
    let weatherEventPhaseProgress = 0;
    let weatherEventStartHour = null;
    let weatherEventEndHour = null;
    let weatherFrontWeight = 0;
    let weatherGustBoost = 0;
    let weatherHazeBoost = 0;
    let postRainWeight = 0;
    let guaranteedRainDay = false;
    let seasonalWetness = 0;

    if (authority.mode === ZEN_WEATHER_AUTHORITY_MODES.PROCEDURAL_EVENT) {
        const eventState = resolveZenWeatherEventState({
            time,
            dayIndex,
            dayOfYear,
        });
        cloudCover = eventState.cloudCover;
        rainIntensity = eventState.rainIntensity;
        precipitationPotential = eventState.precipitationPotential;
        weatherRegime = eventState.weatherRegime;
        weatherEventScheduled = eventState.weatherEventScheduled;
        weatherEventActive = eventState.weatherEventActive;
        weatherEventId = eventState.weatherEventId;
        weatherEventKind = eventState.weatherEventKind;
        weatherEventPhase = eventState.weatherEventPhase;
        weatherEventProgress = eventState.weatherEventProgress;
        weatherEventPhaseProgress = eventState.weatherEventPhaseProgress;
        weatherEventStartHour = eventState.weatherEventStartHour;
        weatherEventEndHour = eventState.weatherEventEndHour;
        weatherFrontWeight = eventState.weatherFrontWeight;
        weatherGustBoost = eventState.weatherGustBoost;
        weatherHazeBoost = eventState.weatherHazeBoost;
        postRainWeight = eventState.postRainWeight;
        guaranteedRainDay = eventState.guaranteedRainDay;
        seasonalWetness = eventState.seasonalWetness;
    } else if (authority.mode === ZEN_WEATHER_AUTHORITY_MODES.CEREMONY_CLEAR) {
        cloudCover = 0.12;
        weatherRegime = 'ceremony_clear';
    } else if (authority.mode === ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB) {
        cloudCover = authority.fixedCloudCover;
        rainIntensity = authority.fixedRainIntensity;
        precipitationPotential = rainIntensity;
        weatherRegime = 'fixed_lab';
        if (rainIntensity >= 0.015) {
            weatherEventScheduled = true;
            weatherEventActive = true;
            weatherEventId = 'zen_weather_lab:rain';
            weatherEventKind = ZEN_WEATHER_EVENT_KINDS.STEADY_RAIN;
            weatherEventPhase = ZEN_WEATHER_EVENT_PHASES.RAIN;
            weatherEventProgress = 0.5;
            weatherEventPhaseProgress = 0.5;
            weatherFrontWeight = rainIntensity * 0.5;
            weatherGustBoost = rainIntensity * 0.3;
            weatherHazeBoost = rainIntensity * 0.4;
        }
    } else {
        throw new Error(`ZEN_WEATHER_AUTHORITY_MODE_UNHANDLED:${String(authority.mode)}`);
    }
    const overcastWeight = smoothstep(0.56, 0.82, cloudCover);
    const weatherKind = rainIntensity >= 0.08
        ? 'rain'
        : (overcastWeight >= 0.5 ? 'overcast' : 'clear');

    // The real moon lights the world only while it is up; a low moon is
    // dimmed by the longer air path.
    const { moonAge, moonIllumination } = lunar;
    const moonAltitudeDeg = lunar.moonAltitudeRadians * 180 / Math.PI;
    const moonAboveHorizon = smoothstep(-1, 10, moonAltitudeDeg)
        * (0.6 + 0.4 * Math.sin(Math.max(0, lunar.moonAltitudeRadians)));
    const moonlight = clamp01(
        (1 - daylight)
        * moonIllumination
        * moonAboveHorizon
        * (0.08 + (1 - cloudCover) * 0.34),
    );
    const weatherWindBase = clamp(
        0.14
        + noise1D(weatherHour * 0.021 + 5.4) * 0.58,
        0.08,
        1,
    );
    const windSpeed = clamp(
        weatherWindBase * 0.62
        + cloudCover * 0.38
        + rainIntensity * 0.06
        + weatherFrontWeight * 0.12,
        0.08,
        1,
    );
    const windDirection = (
        noise1D(weatherHour * 0.006 + 21.7) * TAU
        + (noise1D(weatherHour * 0.019 + 64.2) - 0.5) * 0.82
        + TAU
    ) % TAU;
    const gustEnvelope = clamp(
        0.16
        + windSpeed * 0.48
        + Math.abs(noise1D(weatherHour * 0.047 + 37.6) - 0.5) * 0.58
        + weatherGustBoost * 0.18,
        0,
        1,
    );
    const haze = clamp(
        0.025
        + rainIntensity * 0.08
        + weatherHazeBoost * 0.1
        - postRainWeight * 0.05
        + (1 - daylight) * 0.08,
        0.015,
        0.8,
    );

    return {
        cloudCover,
        overcastWeight,
        rainIntensity,
        precipitationPotential,
        weatherKind,
        weatherAuthorityMode: authority.mode,
        weatherRegime,
        weatherEventScheduled,
        weatherEventActive,
        weatherEventId,
        weatherEventKind,
        weatherEventPhase,
        weatherEventProgress,
        weatherEventPhaseProgress,
        weatherEventStartHour,
        weatherEventEndHour,
        weatherFrontWeight,
        weatherGustBoost,
        weatherHazeBoost,
        postRainWeight,
        guaranteedRainDay,
        seasonalWetness,
        windSpeed,
        windDirection,
        gustEnvelope,
        haze,
        moonAge,
        moonIllumination,
        moonlight,
    };
};

const toneWaterPalette = (palette, { moonlight, nightBlend }) => {
    return palette.map((color) => {
        const moonTinted = lerpColor(color, 'rgba(74, 98, 152, 1.0)', nightBlend * moonlight * 0.42);
        return lerpColor(moonTinted, 'rgba(30, 40, 56, 1.0)', nightBlend * 0.12);
    });
};

export const resolveZenEnvironmentColorProjection = ({
    time = 12,
    sunriseHour = 6,
    sunsetHour = 18,
    daylight = 1,
    night = 0,
    solarElevation = 1,
    noonWeight = 0,
    cloudCover = 0.38,
    moonlight = 0,
    moonIllumination = 0,
    temporalNightTintStrength = 1,
} = {}) => {
    const ambientChromaticState = resolveZenWorldAmbientGrammar({
        hour: time,
        sunriseHour,
        sunsetHour,
        daylight,
        nightDepth: night,
        solarElevation,
        noonWeight,
    });
    const ambientPalette = resolveZenAmbientPalette(ambientChromaticState);
    const lightColor = ambientPalette.lightColor;
    const temporalTintColor = lerpColor(
        lightColor,
        'rgba(154, 170, 224, 1.0)',
        clamp(
            ambientChromaticState.nightDepth
            * (0.2 + clamp01(moonIllumination) * 0.52)
            * clamp(temporalNightTintStrength, 0.8, 1.2),
            0,
            1,
        ),
    );
    const waterPalette = toneWaterPalette(ambientPalette.water, {
        cloudCover: clamp01(cloudCover),
        moonlight: clamp01(moonlight),
        nightBlend: ambientChromaticState.nightDepth,
    });

    return Object.freeze({
        ambientChromaticState,
        lightColor,
        temporalTintColor,
        lightColorRgb: Object.freeze(lightColor.match(/[\d.]+/g).slice(0, 3).map(Number)),
        temporalTintRgb: Object.freeze(temporalTintColor.match(/[\d.]+/g).slice(0, 3).map(Number)),
        waterPalette: Object.freeze(waterPalette),
    });
};

export function getCurrentEnvironment(currentHour, options = {}) {
    const time = ((currentHour % 24) + 24) % 24;
    // This direct authoring entry has a declared reference geography/calendar.
    // Runtime callers provide their authority's complete context and solar sample.
    const year = options.year ?? 2026;
    const dayOfYear = options.dayOfYear ?? 172;
    const dayIndex = options.dayIndex ?? Math.floor(Date.UTC(year, 0, dayOfYear) / 86400000);
    const timeContext = options.timeContext ?? {
        hour: time, year, dayOfYear, dayIndex, timestampMs: dayIndex * 86400000 + time * 3600000,
    };
    const solar = options.solarChannels ?? resolveZenWorldSolar({
        timeContext,
        solarCoordinates: options.solarCoordinates ?? DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
        solarTimeZone: options.solarTimeZone ?? 'UTC',
    }).channels;
    const keyframeBounds = solar.solarDayState === 'normal'
        ? solar
        : { sunriseHour: 0, sunsetHour: 24, seasonalDayLength: 24 };
    const keyframes = resolveSolarRelativeTimeOfDayKeyframes(keyframeBounds);
    let left = keyframes[0];
    let right = keyframes[1];
    for (let index = 0; index < keyframes.length - 1; index += 1) {
        if (time >= keyframes[index].time && time < keyframes[index + 1].time) {
            left = keyframes[index]; right = keyframes[index + 1]; break;
        }
    }
    const progress = right.time === left.time ? 0 : (time - left.time) / (right.time - left.time);
    const eased = progress * progress * (3 - 2 * progress);
    const interpolate = (field) => left[field] + (right[field] - left[field]) * eased;
    const lunar = options.lunarChannels ?? resolveZenWorldLunar({
        timeContext,
        solarCoordinates: options.solarCoordinates ?? DEFAULT_ZEN_WORLD_SOLAR_COORDINATES,
    }).channels;
    const weather = resolveWeatherEnvelope({
        time, dayIndex: timeContext.dayIndex, dayOfYear: timeContext.dayOfYear,
        daylight: solar.daylight, lunar, weatherAuthority: options.weatherAuthority,
    });
    const colorProjection = resolveZenEnvironmentColorProjection({
        time, ...solar,
        cloudCover: weather.cloudCover,
        moonlight: weather.moonlight,
        moonIllumination: weather.moonIllumination,
        temporalNightTintStrength: 1,
    });
    const environment = {
        time,
        name: left.name,
        ...solar,
        ...colorProjection,
        koiActivity: clamp(interpolate('koiActivity') * (0.86 + solar.daylight * 0.24), 0.12, 1.5),
        shadowLength: clamp(8 * Math.cos(solar.solarAltitudeRadians) / Math.max(0.12, solar.sunDirectionZ), 2, 60),
        fireflies: clamp(interpolate('fireflies') * solar.nightDepth, 0, 1.2),
        petals: interpolate('petals'),
        cloudCover: weather.cloudCover,
        overcastWeight: weather.overcastWeight,
        rainIntensity: weather.rainIntensity,
        precipitationPotential: weather.precipitationPotential,
        weatherKind: weather.weatherKind,
        weatherAuthorityMode: weather.weatherAuthorityMode,
        weatherRegime: weather.weatherRegime,
        weatherEventScheduled: weather.weatherEventScheduled,
        weatherEventActive: weather.weatherEventActive,
        weatherEventId: weather.weatherEventId,
        weatherEventKind: weather.weatherEventKind,
        weatherEventPhase: weather.weatherEventPhase,
        weatherEventProgress: weather.weatherEventProgress,
        weatherEventPhaseProgress: weather.weatherEventPhaseProgress,
        weatherEventStartHour: weather.weatherEventStartHour,
        weatherEventEndHour: weather.weatherEventEndHour,
        weatherFrontWeight: weather.weatherFrontWeight,
        weatherGustBoost: weather.weatherGustBoost,
        weatherHazeBoost: weather.weatherHazeBoost,
        postRainWeight: weather.postRainWeight,
        guaranteedRainDay: weather.guaranteedRainDay,
        seasonalWetness: weather.seasonalWetness,
        cloudReflection: weather.cloudCover * solar.daylight,
        clearSkyReflectionBoost: 1,
        temporalNightTintStrength: 1,
        windIntensity: weather.windSpeed,
        windDirection: weather.windDirection,
        gustEnvelope: weather.gustEnvelope,
        cloudDrift: weather.windSpeed,
        airHaze: weather.haze,
        haze: weather.haze,
        moonAge: weather.moonAge,
        moonPhase: weather.moonIllumination,
        moonlight: weather.moonlight,
        moonIllumination: weather.moonIllumination,
        moonAltitudeRadians: lunar.moonAltitudeRadians,
        moonAzimuthSouthRadians: lunar.moonAzimuthSouthRadians,
        moonParallacticAngle: lunar.moonParallacticAngle,
        moonBrightLimbAngle: lunar.moonBrightLimbAngle,
    };
    return resolveZenWorldLighting({
        environment,
        worldId: options.worldId ?? DEFAULT_ZEN_WORLD_ID,
        timestampMs: timeContext.timestampMs,
    });
}
