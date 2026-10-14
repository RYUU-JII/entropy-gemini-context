const MODE_AUTO = 'auto';
const MODE_PRESET = 'preset';
const MODE_MANUAL = 'manual';
const WORLD_ZEN_POND = 'zen_pond';
const WORLD_COSMIC_KOI = 'cosmic_koi';

const AUTO_REFERENCE = Object.freeze({
  id: 'auto_local',
  label: 'Local Daylight',
  latitude: 35.6,
  longitude: 0,
  timezone: '',
  worldId: WORLD_ZEN_POND,
});

export const SOLAR_LOCATION_MODES = Object.freeze({
  AUTO: MODE_AUTO,
  PRESET: MODE_PRESET,
  MANUAL: MODE_MANUAL,
});

export const SOLAR_LOCATION_WORLD_IDS = Object.freeze({
  ZEN_POND: WORLD_ZEN_POND,
  COSMIC_KOI: WORLD_COSMIC_KOI,
});

const PRESET_DEFINITIONS = [
  { id: 'seoul_kr', label: 'Seoul, KR', regionCode: 'KR', latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul', worldId: WORLD_ZEN_POND },
  { id: 'tokyo_jp', label: 'Tokyo, JP', regionCode: 'JP', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', worldId: WORLD_ZEN_POND },
  { id: 'los_angeles_us', label: 'Los Angeles, US', regionCode: 'US', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles', worldId: WORLD_ZEN_POND },
  { id: 'new_york_us', label: 'New York, US', regionCode: 'US', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', worldId: WORLD_ZEN_POND },
  { id: 'london_gb', label: 'London, GB', regionCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', worldId: WORLD_ZEN_POND },
  { id: 'sydney_au', label: 'Sydney, AU', regionCode: 'AU', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', worldId: WORLD_ZEN_POND },
  { id: 'somewhere_in_space', label: 'Somewhere in Space', labelKey: 'solar_location.preset_somewhere_in_space', regionCode: 'ZZ', latitude: 0, longitude: 0, timezone: 'Etc/UTC', worldId: WORLD_COSMIC_KOI, autoMatch: false },
];

export const SOLAR_LOCATION_PRESETS = Object.freeze(
  PRESET_DEFINITIONS.map((preset) => Object.freeze({ ...preset }))
);

const PRESET_MAP = new Map(SOLAR_LOCATION_PRESETS.map((preset) => [preset.id, preset]));
const TIMEZONE_PRESET_MAP = new Map(
  SOLAR_LOCATION_PRESETS
    .filter((preset) => preset.autoMatch !== false && typeof preset.timezone === 'string' && preset.timezone.trim())
    .map((preset) => [preset.timezone, preset])
);
const DEFAULT_PRESET_ID = SOLAR_LOCATION_PRESETS[0]?.id || 'seoul_kr';
const PRESET_ID_BY_LOCALE_REGION = Object.freeze({
  AU: 'sydney_au',
  GB: 'london_gb',
  JP: 'tokyo_jp',
  KR: 'seoul_kr',
  UK: 'london_gb',
  US: 'new_york_us',
});

export const SOLAR_LOCATION_STORAGE_KEY = 'solar_location_profile';

const DEFAULT_PRESET = PRESET_MAP.get(DEFAULT_PRESET_ID) || SOLAR_LOCATION_PRESETS[0] || {
  id: 'seoul_kr',
  label: 'Seoul, KR',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
  worldId: WORLD_ZEN_POND,
};

const clamp = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const normalizeCoordinate = (value, min, max, fallback) => {
  const clamped = clamp(value, min, max, fallback);
  return Math.round(clamped * 1_000_000) / 1_000_000;
};

const normalizeMode = (value, fallback = MODE_AUTO) => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === MODE_AUTO || raw === MODE_PRESET || raw === MODE_MANUAL) return raw;
  return fallback === MODE_PRESET || fallback === MODE_MANUAL ? fallback : MODE_AUTO;
};

const normalizeLabel = (value, fallback) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || fallback;
};

const normalizeTimezone = (value, fallback) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || fallback;
};

const normalizeWorldId = (value, fallback = WORLD_ZEN_POND) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || fallback;
};

const createAutoProfile = () => ({
  mode: MODE_AUTO,
  presetId: '',
  label: AUTO_REFERENCE.label,
  latitude: AUTO_REFERENCE.latitude,
  longitude: AUTO_REFERENCE.longitude,
  timezone: '',
  worldId: AUTO_REFERENCE.worldId,
});

export const DEFAULT_SOLAR_LOCATION_PROFILE = Object.freeze({
  ...createAutoProfile(),
});

export function resolveSolarLocationPresetById(presetId) {
  if (typeof presetId !== 'string') return null;
  return PRESET_MAP.get(presetId.trim()) || null;
}

export function resolveSolarLocationPresetByTimeZone(timeZone) {
  if (typeof timeZone !== 'string') return null;
  return TIMEZONE_PRESET_MAP.get(timeZone.trim()) || null;
}

const readBrowserTimeZone = () => {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return '';
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions()?.timeZone;
    return normalizeTimezone(timeZone, '');
  } catch (_error) {
    return '';
  }
};

const readBrowserLocales = () => {
  if (typeof navigator === 'undefined') return [];
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  const language = typeof navigator.language === 'string' ? navigator.language : '';
  return [...languages, language].filter(Boolean);
};

const resolveLocaleRegion = (locales = []) => {
  const source = Array.isArray(locales) ? locales : [locales];
  for (const locale of source) {
    const raw = typeof locale === 'string' ? locale.trim() : '';
    if (!raw) continue;
    const parts = raw.replace(/_/g, '-').split('-').filter(Boolean);
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const part = parts[index];
      if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
    }
  }
  return '';
};

const resolveTimeZoneOffsetMinutes = (timeZone, date = new Date()) => {
  const zone = normalizeTimezone(timeZone, '');
  if (!zone || typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return null;
  const targetDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(targetDate).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const asUtcMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    if (!Number.isFinite(asUtcMs)) return null;
    return Math.round((asUtcMs - targetDate.getTime()) / 60000);
  } catch (_error) {
    return null;
  }
};

const resolveApproximateLongitudeForTimeZone = (timeZone, date) => {
  const offsetMinutes = resolveTimeZoneOffsetMinutes(timeZone, date);
  if (!Number.isFinite(offsetMinutes)) return AUTO_REFERENCE.longitude;
  return normalizeCoordinate((offsetMinutes / 60) * 15, -180, 180, AUTO_REFERENCE.longitude);
};

const resolveApproximateLongitudeForLocalOffset = (options = null) => {
  const source = options && typeof options === 'object' ? options : {};
  const explicitOffset = Number(
    source.timeZoneOffsetMinutes ?? source.timezoneOffsetMinutes,
  );
  if (Number.isFinite(explicitOffset)) {
    return normalizeCoordinate((-explicitOffset / 60) * 15, -180, 180, AUTO_REFERENCE.longitude);
  }
  const date = source.date instanceof Date && !Number.isNaN(source.date.getTime())
    ? source.date
    : new Date();
  if (typeof date.getTimezoneOffset !== 'function') {
    return AUTO_REFERENCE.longitude;
  }
  const offsetMinutes = date.getTimezoneOffset();
  if (!Number.isFinite(offsetMinutes)) {
    return AUTO_REFERENCE.longitude;
  }
  return normalizeCoordinate((-offsetMinutes / 60) * 15, -180, 180, AUTO_REFERENCE.longitude);
};

const formatAutoReferenceLabel = (timeZone) => {
  const zone = normalizeTimezone(timeZone, '');
  if (!zone) return AUTO_REFERENCE.label;
  const lastSegment = zone.split('/').pop();
  return lastSegment ? lastSegment.replace(/_/g, ' ') : zone;
};

export function resolveSolarLocationAutoReference(options = null) {
  const source = options && typeof options === 'object' ? options : {};
  const hasExplicitTimeZone = Object.prototype.hasOwnProperty.call(source, 'timeZone');
  const timeZone = normalizeTimezone(source.timeZone, '')
    || (hasExplicitTimeZone ? '' : readBrowserTimeZone());
  const presetByTimeZone = resolveSolarLocationPresetByTimeZone(timeZone);
  if (presetByTimeZone) {
    return {
      mode: MODE_AUTO,
      presetId: presetByTimeZone.id,
      label: presetByTimeZone.label,
      latitude: presetByTimeZone.latitude,
      longitude: presetByTimeZone.longitude,
      timezone: presetByTimeZone.timezone,
      worldId: normalizeWorldId(presetByTimeZone.worldId, WORLD_ZEN_POND),
    };
  }

  if (timeZone) {
    return {
      mode: MODE_AUTO,
      presetId: '',
      label: formatAutoReferenceLabel(timeZone),
      latitude: AUTO_REFERENCE.latitude,
      longitude: resolveApproximateLongitudeForTimeZone(timeZone, source.date),
      timezone: timeZone,
      worldId: AUTO_REFERENCE.worldId,
    };
  }

  const localeRegion = resolveLocaleRegion(source.locales || source.locale || readBrowserLocales());
  const localePreset = resolveSolarLocationPresetById(PRESET_ID_BY_LOCALE_REGION[localeRegion]);
  if (localePreset) {
    return {
      mode: MODE_AUTO,
      presetId: localePreset.id,
      label: localePreset.label,
      latitude: localePreset.latitude,
      longitude: localePreset.longitude,
      timezone: localePreset.timezone,
      worldId: normalizeWorldId(localePreset.worldId, WORLD_ZEN_POND),
    };
  }

  return {
    mode: MODE_AUTO,
    presetId: '',
    label: AUTO_REFERENCE.label,
    latitude: AUTO_REFERENCE.latitude,
    longitude: resolveApproximateLongitudeForLocalOffset(source),
    timezone: '',
    worldId: AUTO_REFERENCE.worldId,
  };
}

export function normalizeSolarLocationProfile(raw, fallback = DEFAULT_SOLAR_LOCATION_PROFILE) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackProfile = fallback && typeof fallback === 'object'
    ? { ...DEFAULT_SOLAR_LOCATION_PROFILE, ...fallback }
    : { ...DEFAULT_SOLAR_LOCATION_PROFILE };

  const mode = normalizeMode(source.mode, normalizeMode(fallbackProfile.mode, MODE_AUTO));
  if (mode === MODE_AUTO) return createAutoProfile();

  const presetIdCandidate = typeof source.presetId === 'string' ? source.presetId : fallbackProfile.presetId;
  const preset = resolveSolarLocationPresetById(presetIdCandidate)
    || resolveSolarLocationPresetById(fallbackProfile.presetId)
    || DEFAULT_PRESET;

  if (mode === MODE_PRESET) {
    return {
      mode,
      presetId: preset.id,
      label: preset.label,
      latitude: preset.latitude,
      longitude: preset.longitude,
      timezone: preset.timezone,
      worldId: normalizeWorldId(preset.worldId, WORLD_ZEN_POND),
    };
  }

  const latFallback = Number.isFinite(Number(fallbackProfile.latitude))
    ? Number(fallbackProfile.latitude)
    : preset.latitude;
  const lonFallback = Number.isFinite(Number(fallbackProfile.longitude))
    ? Number(fallbackProfile.longitude)
    : preset.longitude;

  return {
    mode,
    presetId: preset.id,
    label: normalizeLabel(source.label, fallbackProfile.label || preset.label),
    latitude: normalizeCoordinate(source.latitude, -90, 90, latFallback),
    longitude: normalizeCoordinate(source.longitude, -180, 180, lonFallback),
    timezone: normalizeTimezone(source.timezone, fallbackProfile.timezone || preset.timezone),
    worldId: normalizeWorldId(source.worldId, fallbackProfile.worldId || preset.worldId || WORLD_ZEN_POND),
  };
}

export function resolveSolarCoordinatesFromProfile(profile, options = null) {
  const normalized = normalizeSolarLocationProfile(profile);
  const resolved = normalized.mode === MODE_AUTO
    ? resolveSolarLocationAutoReference(options)
    : normalized;
  return {
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    label: resolved.label,
    timezone: resolved.timezone,
    source: normalized.mode,
    presetId: resolved.presetId,
    worldId: normalizeWorldId(resolved.worldId, WORLD_ZEN_POND),
  };
}
