const CONTINUOUS_FIELDS = Object.freeze([
    'daylight', 'night', 'nightDepth', 'solarElevation', 'solarAltitudeRadians',
    'sunAngle', 'sunDirectionX', 'sunDirectionY', 'sunDirectionZ', 'noonWeight',
    'directSunlight', 'diffuseSkylight', 'clearDirectSunlight', 'sunTransmission',
    'sceneBrightness', 'lightIntensity', 'causticsIntensity', 'shadowLength',
    'cloudCover', 'overcastWeight', 'cloudOcclusion', 'cloudPhaseX', 'cloudPhaseY',
    'cloudThreshold', 'cloudDensity', 'airHaze', 'rainIntensity', 'moonlight',
    'windIntensity', 'windDirection', 'gustEnvelope',
]);

export const projectZenWorldEnvironmentRuntimeTarget = (environment) => {
    if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_TARGET_REQUIRED');
    }
    const target = { ...environment };
    for (const field of CONTINUOUS_FIELDS) {
        if (typeof environment[field] !== 'number' || !Number.isFinite(environment[field])) {
            throw new Error(`ZEN_WORLD_ENVIRONMENT_TARGET_FIELD_REQUIRED:${field}`);
        }
        target[field] = Number(environment[field].toFixed(6));
    }
    if (!Number.isInteger(environment.cloudSeed) || environment.cloudSeed < 0 || environment.cloudSeed > 0xffffffff) {
        throw new Error('ZEN_WORLD_ENVIRONMENT_TARGET_CLOUD_SEED_INVALID');
    }
    for (const field of ['lightColorRgb', 'temporalTintRgb']) {
        const channels = environment[field];
        if (!Array.isArray(channels) || channels.length !== 3
            || channels.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 255)) {
            throw new Error(`ZEN_WORLD_ENVIRONMENT_TARGET_COLOR_INVALID:${field}`);
        }
        target[field] = Object.freeze([...channels]);
    }
    return target;
};
