import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { resolveZenPondShadowLight } from '../../runtime/zenPondShadowProjection.js';
const REQUIRED_FRAME_CHANNEL_FIELDS = Object.freeze({
    lighting: Object.freeze([
        'daylightEnvelope',
        'moonlight',
        'lightAmount',
        'sceneBrightness',
        'diurnalPhase',
        'nightDepth',
        'directLight',
        'ambientLight',
        'directSunlight',
        'diffuseSkylight',
        'sunTransmission',
    ]),
    atmosphere: Object.freeze([
        'cloudCover',
        'cloudiness',
        'overcastWeight',
        'rainIntensity',
        'weatherFrontWeight',
        'postRainWeight',
        'cloudOcclusion',
        'windIntensity',
        'gustEnvelope',
        'windDirection',
        'clearSkyReflectionBoost',
        'reflectionFactor',
    ]),
    waterMedium: Object.freeze([
        'clarity',
        'turbidity',
        'transmittance',
        'scatter',
        'bottomVisibility',
        'bottomContrast',
    ]),
    surface: Object.freeze([
        'waveEnergy',
        'roughness',
        'reflectionStability',
        'phaseRate',
        'gravityWaveEnergy',
        'capillaryWaveEnergy',
        'directionalSpread',
        'spatialStability',
        'detailStability',
        'temporalStability',
        'rippleScale',
        'rippleIrregularity',
        'refractionScale',
        'refractionDensity',
        'refractionAnisotropy',
        'refractionMicroScale',
        'refractionJitter',
        'specularResponse',
        'surfaceSheenGain',
        'surfaceSparkleGain',
    ]),
    biotic: Object.freeze([]),
});
const REQUIRED_FRAME_ENV_FIELDS = Object.freeze([
    'sunAngle',
    'sunDirectionX',
    'sunDirectionY',
    'sunDirectionZ',
    'cloudSeed',
    'cloudPhaseX',
    'cloudPhaseY',
    'cloudThreshold',
    'cloudDensity',
    'airHaze',
]);

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const assertFiniteChannelField = (channel, channelName, fieldName) => {
    const value = Number(channel?.[fieldName]);
    if (!Number.isFinite(value)) {
        throw new Error(`ZEN_PIXI_FRAME_CONTRACT_FIELD_MISSING:${channelName}.${fieldName}`);
    }
};

export const assertPixiFrameContract = (frameState = null) => {
    if (!isObject(frameState) || !isObject(frameState.channels) || !isObject(frameState.frameEnv)) {
        throw new Error('ZEN_PIXI_FRAME_CONTRACT_MISSING');
    }
    for (let i = 0; i < REQUIRED_FRAME_ENV_FIELDS.length; i += 1) {
        const fieldName = REQUIRED_FRAME_ENV_FIELDS[i];
        const value = Number(frameState.frameEnv[fieldName]);
        if (!Number.isFinite(value)) {
            throw new Error(`ZEN_PIXI_FRAME_CONTRACT_FIELD_MISSING:frameEnv.${fieldName}`);
        }
    }
    const channelNames = Object.keys(REQUIRED_FRAME_CHANNEL_FIELDS);
    for (let i = 0; i < channelNames.length; i += 1) {
        const channelName = channelNames[i];
        const channel = frameState.channels[channelName];
        if (!isObject(channel)) {
            throw new Error(`ZEN_PIXI_FRAME_CONTRACT_CHANNEL_MISSING:${channelName}`);
        }
        const fields = REQUIRED_FRAME_CHANNEL_FIELDS[channelName];
        for (let j = 0; j < fields.length; j += 1) {
            assertFiniteChannelField(channel, channelName, fields[j]);
        }
    }
    return frameState;
};

const resolvePixiFrameChannels = ({
    frameState = null,
} = {}) => {
    const resolvedFrameState = assertPixiFrameContract(frameState);
    const frameEnv = resolvedFrameState.frameEnv;
    const channelGroups = resolvedFrameState.channels;
    const lightingChannel = channelGroups.lighting;
    const atmosphereChannel = channelGroups.atmosphere;
    const waterMediumChannel = channelGroups.waterMedium;
    const surfaceChannel = channelGroups.surface;

    const daylight = clampValue(Number(lightingChannel.daylightEnvelope), 0, 1);
    const moonlight = clampValue(Number(lightingChannel.moonlight), 0, 1);
    const cloudiness = clampValue(
        Number(
            atmosphereChannel.cloudiness
            ?? atmosphereChannel.cloudCover
        ),
        0,
        1,
    );
    const cloudCover = cloudiness;
    const overcastWeight = clampValue(
        Number(atmosphereChannel.overcastWeight),
        0,
        1,
    );
    const rainIntensity = clampValue(
        Number(atmosphereChannel.rainIntensity),
        0,
        1,
    );
    const weatherFrontWeight = clampValue(
        Number(atmosphereChannel.weatherFrontWeight),
        0,
        1,
    );
    const postRainWeight = clampValue(
        Number(atmosphereChannel.postRainWeight),
        0,
        1,
    );
    const cloudOcclusion = clampValue(
        Number(atmosphereChannel.cloudOcclusion),
        0.18,
        1,
    );
    const windIntensity = clampValue(
        Number(atmosphereChannel.windIntensity),
        0.08,
        1,
    );
    const gustEnvelope = clampValue(
        Number(atmosphereChannel.gustEnvelope),
        0,
        1,
    );

    const lightAmount = clampValue(Number(lightingChannel.lightAmount), 0, 1);
    const sceneBrightness = Number(lightingChannel.sceneBrightness);
    const diurnalPhase = clampValue(
        Number(lightingChannel.diurnalPhase),
        0,
        1,
    );
    const nightDepth = clampValue(
        Number(lightingChannel.nightDepth),
        0,
        1,
    );

    const envWaterClarity = clampValue(
        Number(waterMediumChannel.clarity),
        0,
        1,
    );
    const waterTurbidity = clampValue(
        Number(waterMediumChannel.turbidity),
        0,
        1,
    );
    const transmittance = clampValue(
        Number(waterMediumChannel.transmittance),
        0,
        1,
    );
    const scatter = clampValue(
        Number(waterMediumChannel.scatter),
        0,
        1,
    );
    const bottomVisibility = clampValue(
        Number(waterMediumChannel.bottomVisibility),
        0,
        1,
    );

    const directLight = Number(lightingChannel.directLight);
    const ambientLight = Number(lightingChannel.ambientLight);

    const requireRgb = (value, field) => {
        if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
            throw new Error(`ZEN_PIXI_FRAME_COLOR_REQUIRED:${field}`);
        }
        return { r: value[0], g: value[1], b: value[2] };
    };
    const lightColor = frameEnv.lightColor;
    const lightChannels = requireRgb(frameEnv.lightColorRgb, 'lightColorRgb');
    const sceneChromaChannels = requireRgb(frameEnv.temporalTintRgb, 'temporalTintRgb');
    const clearSkyReflectionBoost = clampValue(
        Number(atmosphereChannel.clearSkyReflectionBoost),
        1,
        2,
    );
    const sunAngle = Number(frameEnv.sunAngle);
    const windDirection = Number(atmosphereChannel.windDirection);

    return {
        channels: channelGroups,
        shadowLight: resolveZenPondShadowLight({
            sunDirectionX: frameEnv.sunDirectionX,
            sunDirectionY: frameEnv.sunDirectionY,
            sunDirectionZ: frameEnv.sunDirectionZ,
            directSunlight: lightingChannel.directSunlight,
            diffuseSkylight: lightingChannel.diffuseSkylight,
            lightChannels,
        }),
        lightingChannel,
        botanicalMaterialLighting: resolvedFrameState.envState?.botanicalMaterialLighting,
        atmosphereChannel,
        waterMediumChannel,
        surfaceChannel,
        frameEnv,
        daylight,
        moonlight,
        cloudCover,
        overcastWeight,
        rainIntensity,
        weatherFrontWeight,
        postRainWeight,
        weatherRegime: atmosphereChannel.weatherRegime,
        weatherEventScheduled: atmosphereChannel.weatherEventScheduled === true,
        weatherEventActive: atmosphereChannel.weatherEventActive === true,
        weatherEventId: atmosphereChannel.weatherEventId,
        weatherEventKind: atmosphereChannel.weatherEventKind,
        weatherEventPhase: atmosphereChannel.weatherEventPhase,
        weatherEventProgress: clampValue(
            Number(atmosphereChannel.weatherEventProgress),
            0,
            1,
        ),
        weatherEventPhaseProgress: clampValue(
            Number(atmosphereChannel.weatherEventPhaseProgress),
            0,
            1,
        ),
        guaranteedRainDay: atmosphereChannel.guaranteedRainDay === true,
        cloudOcclusion,
        cloudiness,
        windIntensity,
        gustEnvelope,
        lightAmount,
        sceneBrightness,
        diurnalPhase,
        nightDepth,
        envWaterClarity,
        waterTurbidity,
        transmittance,
        scatter,
        bottomVisibility,
        directLight,
        ambientLight,
        isClearWeather: cloudiness <= 0.3,
        lightColor,
        lightChannels,
        sceneChromaChannels,
        clearSkyReflectionBoost,
        sunAngle,
        windDirection,
    };
};

export {
    resolvePixiFrameChannels,
};
