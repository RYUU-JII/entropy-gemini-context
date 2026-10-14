import {
    ZEN_POND_CANOPY_SHADE_MAXIMUM_ALPHA,
} from '../../contracts/zenPondCanopyMaterial.js';
import { clamp as clampValue } from '../../model/koi/koiMotion.js';

export const createPixiWaterMaterialProjectionResolver = () => {
    let cachedMaterialProjectionRef = null;
    let cachedMaterialProjectionState = null;
    return (resolvedFrameState, frameChannels = null) => {
        const sharedChannels = frameChannels && typeof frameChannels === 'object'
            ? frameChannels
            : null;
        if (!sharedChannels) return null;
        if (cachedMaterialProjectionRef === resolvedFrameState && cachedMaterialProjectionState) {
            return cachedMaterialProjectionState;
        }
        const channelGroups = resolvedFrameState?.channels || {};
        const atmosphereChannel = channelGroups?.atmosphere || {};
        const waterMediumChannel = channelGroups?.waterMedium || {};
        const surfaceChannel = channelGroups?.surface || {};
        const frameEnv = resolvedFrameState?.frameEnv || {};
        const unifiedBottomVisibility = clampValue(Number(sharedChannels.bottomVisibility), 0, 1);
        const unifiedBottomContrast = Number(waterMediumChannel?.bottomContrast ?? 0.5);
        const unifiedTurbidity = clampValue(Number(sharedChannels.waterTurbidity), 0, 1);
        const unifiedScatter = clampValue(Number(sharedChannels.scatter), 0, 1);
        const unifiedTransmittance = clampValue(Number(sharedChannels.transmittance), 0, 1);
        const unifiedCloudReflectionFactor = Number(atmosphereChannel?.reflectionFactor ?? 0.4);
        const unifiedCloudCover = clampValue(
            Number(sharedChannels.cloudCover),
            0,
            1,
        );
        const unifiedCloudiness = clampValue(
            Number(sharedChannels.cloudiness),
            0,
            1,
        );
        const unifiedCloudOcclusion = clampValue(
            Number(sharedChannels.cloudOcclusion),
            0,
            1,
        );
        const unifiedCloudDensity = frameEnv.cloudDensity;
        const unifiedWindIntensity = clampValue(
            Number(sharedChannels.windIntensity),
            0.08,
            1,
        );
        const unifiedWaveEnergy = Number(surfaceChannel?.waveEnergy ?? 0.5);
        const unifiedRoughness = Number(surfaceChannel?.roughness ?? 0.5);
        const unifiedLightAmount = clampValue(
            Number(sharedChannels.lightAmount),
            0,
            1.35,
        );
        const causticResponse = 1;
        const godRayGain = 1;
        const godRayDensity = 1;
        const godRayPulse = 1;
        const causticLayerGain = 1;
        const causticDensityGain = 1;
        const topShadowMasterGain = clampValue(0.9 + unifiedLightAmount * 0.22, 0, 3);
        const topShadowGateBoost = 1;
        const topShadowWeatherFloor = clampValue(0.1 + unifiedCloudiness * 0.16, 0, 1);
        const topShadowDaytimeFloor = clampValue(0.16 + unifiedLightAmount * 0.12, 0, 1);
        const topShadowShadowGainScale = 1;
        const topShadowPrimaryAlphaMax = clampValue(
            0.3 + unifiedLightAmount * 0.12,
            0,
            ZEN_POND_CANOPY_SHADE_MAXIMUM_ALPHA,
        );
        const pebbleOpacityScale = 1;
        const veilOpacityScale = 1;
        const hazeOpacityScale = 1;
        const atmosphereOpacityScale = clampValue(veilOpacityScale * 0.58 + hazeOpacityScale * 0.42, 0, 2);
        const daylight = clampValue(
            Number(sharedChannels.daylight),
            0,
            1,
        );
        const sceneBrightness = frameEnv.sceneBrightness;
        const nightDepth = frameEnv.nightDepth;
        const directSunlight = frameEnv.directSunlight;
        const diffuseSkylight = frameEnv.diffuseSkylight;
        const sunTransmission = frameEnv.sunTransmission;
        const noonWeight = frameEnv.noonWeight;
        const sunOp = directSunlight * 1.2;
        const causOp = directSunlight * unifiedTransmittance;
        const daylightCurve = daylight;
        const nightBlend = nightDepth;
        const sunsetFactor = frameEnv.ambientChromaticState.duskWeight;
        const cloudShapeVariance = clampValue(
            0.18 + unifiedWindIntensity * 0.34 + (1 - unifiedCloudOcclusion) * 0.28,
            0,
            1,
        );
        const cloudCoverageCenter = clampValue(
            unifiedCloudiness,
            0,
            1,
        );
        const cloudDriftRate = clampValue(
            0.24 + unifiedWindIntensity * 0.96,
            0.05,
            2.2,
        );
        const cloudDetailScale = clampValue(0.88 + unifiedCloudiness * 0.52, 0.6, 2.6);
        const cloudAverageSize = clampValue(0.84 + (1 - unifiedCloudiness) * 0.58, 0.5, 2.8);
        const envMoonlight = clampValue(Number(sharedChannels.moonlight), 0, 1);
        const moonlightCurve = envMoonlight;
        const moonlitNightLift = envMoonlight;
        const sunAngle = Number(sharedChannels.sunAngle ?? frameEnv.sunAngle);
        const windDirection = Number(sharedChannels.windDirection ?? frameEnv.windDirection);
        const isClearWeather = frameEnv.weatherKind === 'clear';
        const clearSkyReflectionBoost = clampValue(
            Number(sharedChannels.clearSkyReflectionBoost),
            1,
            2,
        );
        const cloudCover = unifiedCloudCover;
        const refractionMicroScale = clampValue(Number(surfaceChannel?.refractionMicroScale ?? 1), 0.5, 3.2);
        const refractionJitter = clampValue(Number(surfaceChannel?.refractionJitter ?? 1), 0, 2.5);
        const waterRippleScale = clampValue(Number(surfaceChannel?.rippleScale ?? 8.4), 1, 15);

        cachedMaterialProjectionRef = resolvedFrameState;
        cachedMaterialProjectionState = {
            unifiedBottomVisibility,
            unifiedBottomContrast,
            unifiedTurbidity,
            unifiedScatter,
            unifiedTransmittance,
            unifiedCloudReflectionFactor,
            unifiedCloudCover,
            unifiedCloudiness,
            unifiedCloudOcclusion,
            unifiedCloudDensity,
            unifiedWindIntensity,
            unifiedWaveEnergy,
            unifiedRoughness,
            unifiedLightAmount,
            causticResponse,
            sunOp,
            causOp,
            godRayGain,
            godRayDensity,
            godRayPulse,
            causticLayerGain,
            causticDensityGain,
            topShadowMasterGain,
            topShadowGateBoost,
            topShadowWeatherFloor,
            topShadowDaytimeFloor,
            topShadowShadowGainScale,
            topShadowPrimaryAlphaMax,
            pebbleOpacityScale,
            veilOpacityScale,
            hazeOpacityScale,
            atmosphereOpacityScale,
            daylight,
            sceneBrightness,
            directSunlight,
            diffuseSkylight,
            sunTransmission,
            noonWeight,
            airHaze: frameEnv.airHaze,
            solarAltitudeRadians: frameEnv.solarAltitudeRadians,
            sunDirectionX: frameEnv.sunDirectionX,
            sunDirectionY: frameEnv.sunDirectionY,
            sunDirectionZ: frameEnv.sunDirectionZ,
            daylightCurve,
            nightBlend,
            sunsetFactor,
            cloudShapeVariance,
            cloudCoverageCenter,
            cloudDriftRate,
            cloudDetailScale,
            cloudAverageSize,
            envMoonlight,
            moonlightCurve,
            moonlitNightLift,
            sunAngle,
            windDirection,
            isClearWeather,
            clearSkyReflectionBoost,
            cloudCover,
            refractionMicroScale,
            refractionJitter,
            waterRippleScale,
        };
        return cachedMaterialProjectionState;
    };

};
