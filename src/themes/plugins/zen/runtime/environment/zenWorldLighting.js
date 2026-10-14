import {
    resolveZenWorldCloudPhase,
    resolveZenWorldCloudSeed,
    sampleZenWorldCloudDensity,
} from './zenWorldCloudField.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const requireNumber = (environment, field) => {
    const value = environment[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_WORLD_LIGHTING_FIELD_REQUIRED:${field}`);
    }
    return value;
};

// The narrow cloud cadence samples only an existing sky field and numeric light
// channels. It performs no solar/weather resolution, palette parsing, or I/O.
export const sampleZenWorldCloudLighting = (environment, timestampMs) => {
    const phases = resolveZenWorldCloudPhase(requireNumber(environment, 'cloudSeed'), timestampMs);
    const sunDensity = sampleZenWorldCloudDensity({
        seed: environment.cloudSeed,
        phaseX: phases.cloudPhaseX,
        phaseY: phases.cloudPhaseY,
        threshold: requireNumber(environment, 'cloudThreshold'),
        density: requireNumber(environment, 'cloudDensity'),
        directionX: requireNumber(environment, 'sunDirectionX'),
        directionY: requireNumber(environment, 'sunDirectionY'),
        directionZ: requireNumber(environment, 'sunDirectionZ'),
    });
    const sunTransmission = 1 - sunDensity * 0.94;
    const directSunlight = requireNumber(environment, 'clearDirectSunlight') * sunTransmission;
    const diffuseSkylight = requireNumber(environment, 'diffuseSkylight');
    const moonlight = requireNumber(environment, 'moonlight');
    return {
        ...phases,
        sunTransmission,
        directSunlight,
        diffuseSkylight,
        sceneBrightness: clamp(directSunlight + diffuseSkylight + moonlight * 0.18, 0, 1.35),
        lightIntensity: directSunlight + diffuseSkylight + moonlight * 0.18,
        causticsIntensity: directSunlight,
        cloudOcclusion: sunTransmission,
    };
};

export const resolveZenWorldLighting = ({ environment, worldId, timestampMs }) => {
    const elevation = clamp(requireNumber(environment, 'solarElevation'), 0, 1);
    const daylight = clamp(requireNumber(environment, 'daylight'), 0, 1);
    const cloudCover = clamp(requireNumber(environment, 'cloudCover'), 0, 1);
    const airHaze = clamp(requireNumber(environment, 'airHaze'), 0, 1);
    const channels = {
        ...environment,
        cloudSeed: resolveZenWorldCloudSeed(worldId),
        cloudThreshold: 1.06 - cloudCover * 1.12,
        cloudDensity: 0.65 + cloudCover * 0.35,
        clearDirectSunlight: daylight * Math.pow(elevation, 0.48) * 1.2 * (1 - airHaze * 0.24),
        diffuseSkylight: daylight * (0.11 + Math.sqrt(elevation) * 0.09 + cloudCover * 0.1),
    };
    return { ...channels, ...sampleZenWorldCloudLighting(channels, timestampMs) };
};
