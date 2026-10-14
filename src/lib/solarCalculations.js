/**
 * Solar Calculations Utility
 *
 * Local-first solar helpers powered by SunCalc.
 * - getSunTimes: sunrise/sunset for a date and coordinates
 * - getSolarPosition: altitude/azimuth at a specific moment
 * - getSolarState: normalized reusable envelope for future render systems
 */

import SunCalc from './vendor/suncalcLite.js';

const DEG = 180 / Math.PI;
const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_MS = 1000;
const MAX_SOLAR_CACHE_SIZE = 256;

export const DEFAULT_SUNRISE_MIN = 7 * 60; // 07:00
export const DEFAULT_SUNSET_MIN = 18 * 60; // 18:00

const SOLAR_PHASES = Object.freeze({
  NIGHT: 'night',
  ASTRONOMICAL_TWILIGHT: 'astronomical_twilight',
  NAUTICAL_TWILIGHT: 'nautical_twilight',
  CIVIL_TWILIGHT: 'civil_twilight',
  DAY: 'day',
});

const sunTimesCache = new Map();
const solarPositionCache = new Map();
const solarDayCache = new Map();

const trimCache = (cache) => {
  while (cache.size > MAX_SOLAR_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
};

const setCacheEntry = (cache, key, value) => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  trimCache(cache);
  return value;
};

const toCacheCoord = (value) => Number(value).toFixed(4);
const resolveDayBucket = (date) => Math.floor(date.getTime() / DAY_MS);
const resolveSecondBucket = (date) => Math.floor(date.getTime() / SECOND_MS);

const cloneSunTimes = (times) => {
  if (!times) return null;
  return {
    sunrise: new Date(times.sunriseMs),
    sunset: new Date(times.sunsetMs),
  };
};

const clamp = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

const toDate = (value) => {
  const resolved = value instanceof Date ? value : new Date(value);
  return Number.isNaN(resolved.getTime()) ? null : resolved;
};

export function normalizeLatitude(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return clamp(fallback, -90, 90);
  return clamp(raw, -90, 90);
}

export function normalizeLongitude(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return clamp(fallback, -180, 180);
  return clamp(raw, -180, 180);
}

export function getSunTimes(date, lat, lon) {
  const targetDate = toDate(date);
  if (!targetDate) return null;

  const latitude = normalizeLatitude(lat, NaN);
  const longitude = normalizeLongitude(lon, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const sunTimesCacheKey = `${resolveDayBucket(targetDate)}|${toCacheCoord(latitude)}|${toCacheCoord(longitude)}`;
  if (sunTimesCache.has(sunTimesCacheKey)) {
    return cloneSunTimes(sunTimesCache.get(sunTimesCacheKey));
  }

  const times = SunCalc.getTimes(targetDate, latitude, longitude);
  const sunrise = times?.sunrise instanceof Date && !Number.isNaN(times.sunrise.getTime())
    ? times.sunrise
    : null;
  const sunset = times?.sunset instanceof Date && !Number.isNaN(times.sunset.getTime())
    ? times.sunset
    : null;

  if (!sunrise || !sunset) return null;

  const cached = setCacheEntry(sunTimesCache, sunTimesCacheKey, {
    sunriseMs: sunrise.getTime(),
    sunsetMs: sunset.getTime(),
  });
  return cloneSunTimes(cached);
}

export function getMinutesFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

export function resolveSolarPhaseByAltitude(altitudeDeg) {
  const altitude = Number(altitudeDeg);
  if (!Number.isFinite(altitude)) return SOLAR_PHASES.NIGHT;
  if (altitude >= 0) return SOLAR_PHASES.DAY;
  if (altitude >= -6) return SOLAR_PHASES.CIVIL_TWILIGHT;
  if (altitude >= -12) return SOLAR_PHASES.NAUTICAL_TWILIGHT;
  if (altitude >= -18) return SOLAR_PHASES.ASTRONOMICAL_TWILIGHT;
  return SOLAR_PHASES.NIGHT;
}

export function getSolarPosition(date, lat, lon) {
  const targetDate = toDate(date);
  if (!targetDate) return null;

  const latitude = normalizeLatitude(lat, NaN);
  const longitude = normalizeLongitude(lon, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const positionCacheKey = `${resolveSecondBucket(targetDate)}|${toCacheCoord(latitude)}|${toCacheCoord(longitude)}`;
  if (solarPositionCache.has(positionCacheKey)) {
    return { ...solarPositionCache.get(positionCacheKey) };
  }

  const position = SunCalc.getPosition(targetDate, latitude, longitude);
  if (!position || !Number.isFinite(position.altitude) || !Number.isFinite(position.azimuth)) {
    return null;
  }

  const altitudeRad = position.altitude;
  const azimuthSouthRad = position.azimuth;
  const altitudeDeg = altitudeRad * DEG;
  const azimuthSouthDeg = azimuthSouthRad * DEG;
  const azimuthNorthDeg = (azimuthSouthDeg + 180 + 360) % 360;

  const resolved = {
    altitudeRad,
    azimuthSouthRad,
    altitudeDeg,
    azimuthSouthDeg,
    azimuthNorthDeg,
    phase: resolveSolarPhaseByAltitude(altitudeDeg),
  };
  setCacheEntry(solarPositionCache, positionCacheKey, resolved);
  return { ...resolved };
}

function resolveDaylightStrength(altitudeDeg) {
  const altitude = Number(altitudeDeg);
  if (!Number.isFinite(altitude)) return 0;
  return clamp((altitude + 6) / 66, 0, 1);
}

/** An actual solar day, including explicit polar states and uncapped length. */
export function getSolarDay(date, lat, lon) {
  const targetDate = toDate(date);
  if (!targetDate || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('SOLAR_DAY_INPUT_INVALID');
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('SOLAR_DAY_COORDINATES_INVALID');
  }
  // Anchor the calculation at this longitude's noon. Calling getTimes near
  // midnight must not select different transits depending on cache warm-up.
  const localDay = Math.floor((targetDate.getTime() + lon * 240000) / DAY_MS);
  const key = `${localDay}|${toCacheCoord(lat)}|${toCacheCoord(lon)}`;
  let cached = solarDayCache.get(key);
  if (!cached) {
    const referenceDate = new Date((localDay + 0.5) * DAY_MS - lon * 240000);
    const times = SunCalc.getTimes(referenceDate, lat, lon);
    const solarNoonMs = times.solarNoon.getTime();
    if (!Number.isFinite(solarNoonMs)) throw new Error('SOLAR_DAY_NOON_INVALID');
    const sunriseMs = times.sunrise.getTime();
    const sunsetMs = times.sunset.getTime();
    const normal = Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs);
    const noonAltitude = SunCalc.getPosition(new Date(solarNoonMs), lat, lon).altitude * DEG;
    cached = setCacheEntry(solarDayCache, key, {
      state: normal ? 'normal' : (noonAltitude > -0.833 ? 'polar_day' : 'polar_night'),
      sunriseMs: normal ? sunriseMs : null,
      sunsetMs: normal ? sunsetMs : null,
      solarNoonMs,
      daylightHours: normal ? (sunsetMs - sunriseMs) / 3600000 : (noonAltitude > -0.833 ? 24 : 0),
    });
  }
  return {
    state: cached.state,
    sunrise: cached.sunriseMs === null ? null : new Date(cached.sunriseMs),
    sunset: cached.sunsetMs === null ? null : new Date(cached.sunsetMs),
    solarNoon: new Date(cached.solarNoonMs),
    daylightHours: cached.daylightHours,
  };
}

export function getSolarState(date, lat, lon) {
  const targetDate = toDate(date);
  if (!targetDate) return null;

  const day = getSolarDay(targetDate, lat, lon);
  const times = day.state === 'normal' ? { sunrise: day.sunrise, sunset: day.sunset } : null;
  const position = getSolarPosition(targetDate, lat, lon);
  if (!position) return null;

  return {
    timestampMs: targetDate.getTime(),
    coordinates: {
      latitude: normalizeLatitude(lat),
      longitude: normalizeLongitude(lon),
    },
    phase: position.phase,
    daylightStrength: resolveDaylightStrength(position.altitudeDeg),
    position,
    times,
    day,
  };
}

export { SOLAR_PHASES };
