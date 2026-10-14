export const ZEN_WEATHER_AUTHORITY_VERSION = 1;

export const ZEN_WEATHER_AUTHORITY_MODES = Object.freeze({
    PROCEDURAL_EVENT: 'procedural_event_v1',
    FIXED_LAB: 'fixed_lab_v1',
    CEREMONY_CLEAR: 'ceremony_clear_v1',
});

const WEATHER_AUTHORITY_MODE_SET = new Set(
    Object.values(ZEN_WEATHER_AUTHORITY_MODES),
);

const DEFAULT_FIXED_CLOUD_COVER = 0.38;
const DEFAULT_FIXED_RAIN_INTENSITY = 0;

const clamp01 = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(1, Math.max(0, numeric));
};

const normalizeMode = (value) => {
    if (value === null || value === undefined || value === '') {
        return ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB;
    }
    if (typeof value !== 'string' || !WEATHER_AUTHORITY_MODE_SET.has(value)) {
        throw new Error(`ZEN_WEATHER_AUTHORITY_MODE_INVALID:${String(value)}`);
    }
    return value;
};

export const buildZenWeatherAuthoritySnapshot = ({
    mode = ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB,
    fixedCloudCover = DEFAULT_FIXED_CLOUD_COVER,
    fixedRainIntensity = DEFAULT_FIXED_RAIN_INTENSITY,
} = {}) => {
    const normalizedMode = normalizeMode(mode);
    if (normalizedMode !== ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB) {
        return Object.freeze({
            version: ZEN_WEATHER_AUTHORITY_VERSION,
            mode: normalizedMode,
        });
    }
    return Object.freeze({
        version: ZEN_WEATHER_AUTHORITY_VERSION,
        mode: normalizedMode,
        fixedCloudCover: clamp01(fixedCloudCover, DEFAULT_FIXED_CLOUD_COVER),
        fixedRainIntensity: clamp01(fixedRainIntensity, DEFAULT_FIXED_RAIN_INTENSITY),
    });
};

export const normalizeZenWeatherAuthority = (candidate = null) => {
    if (candidate !== null && (typeof candidate !== 'object' || Array.isArray(candidate))) {
        throw new Error('ZEN_WEATHER_AUTHORITY_INVALID');
    }
    const source = candidate || {};
    const version = source.version;
    if (
        version !== null
        && version !== undefined
        && Number(version) !== ZEN_WEATHER_AUTHORITY_VERSION
    ) {
        throw new Error(`ZEN_WEATHER_AUTHORITY_VERSION_INVALID:${String(version)}`);
    }
    return buildZenWeatherAuthoritySnapshot(source);
};

export const DEFAULT_ZEN_WEATHER_AUTHORITY = buildZenWeatherAuthoritySnapshot();

export const ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES = Object.freeze({
    REALITY: 'reality',
    CEREMONY_MIDDAY: 'ceremony_midday',
});

export const ZEN_SCENE_CEREMONY_PRESENTATION_HOUR = 13;

const FIXED_LAB_ENVIRONMENT_POLICY = Object.freeze({
    weatherAuthorityMode: ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB,
    presentationHour: null,
});

const REALITY_ENVIRONMENT_POLICY = Object.freeze({
    weatherAuthorityMode: ZEN_WEATHER_AUTHORITY_MODES.PROCEDURAL_EVENT,
    presentationHour: null,
});

const CEREMONY_ENVIRONMENT_POLICY = Object.freeze({
    weatherAuthorityMode: ZEN_WEATHER_AUTHORITY_MODES.CEREMONY_CLEAR,
    presentationHour: ZEN_SCENE_CEREMONY_PRESENTATION_HOUR,
});

export const resolveZenSceneEnvironmentPolicy = (options = {}) => {
    const environmentMode = Object.prototype.hasOwnProperty.call(options, 'environmentMode')
        ? options.environmentMode
        : null;
    if (environmentMode === null) {
        return FIXED_LAB_ENVIRONMENT_POLICY;
    }
    if (environmentMode === ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES.REALITY) {
        return REALITY_ENVIRONMENT_POLICY;
    }
    if (
        environmentMode
        === ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES.CEREMONY_MIDDAY
    ) {
        return CEREMONY_ENVIRONMENT_POLICY;
    }
    throw new Error(
        `ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODE_INVALID:${String(environmentMode)}`,
    );
};
