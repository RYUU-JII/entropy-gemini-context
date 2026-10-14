import {
    projectZenSkyPanelPoint,
    resolveZenSkyPanelLightDirection,
    resolveZenSkyPanelSun,
} from '../../runtime/environment/zenWorldSkyPanelProjection.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
const clamp01 = (value) => clamp(value, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const withAlphaColor = (color, alpha = 1) => {
    const resolvedAlpha = clamp01(alpha);
    const raw = typeof color === 'string' ? color.trim() : '';
    if (!raw) {
        return `rgba(255,244,224,${resolvedAlpha})`;
    }

    if (raw.startsWith('#')) {
        const value = raw.slice(1);
        if (value.length === 3) {
            const r = Number.parseInt(`${value[0]}${value[0]}`, 16);
            const g = Number.parseInt(`${value[1]}${value[1]}`, 16);
            const b = Number.parseInt(`${value[2]}${value[2]}`, 16);
            return `rgba(${r},${g},${b},${resolvedAlpha})`;
        }
        if (value.length === 6) {
            const r = Number.parseInt(value.slice(0, 2), 16);
            const g = Number.parseInt(value.slice(2, 4), 16);
            const b = Number.parseInt(value.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${resolvedAlpha})`;
        }
    }

    const channelMatch = raw.match(/[\d.]+/g);
    if (channelMatch && channelMatch.length >= 3) {
        const [r, g, b] = channelMatch.slice(0, 3).map((entry) => Math.round(toNumber(entry, 0)));
        return `rgba(${r},${g},${b},${resolvedAlpha})`;
    }

    return `rgba(255,244,224,${resolvedAlpha})`;
};

export const resolveSakuraRenderLighting = (environmentState = null) => {
    if (!environmentState || typeof environmentState !== 'object') throw new Error('ZEN_BONSAI_LIGHTING_REQUIRED');
    for (const field of ['sunAngle', 'solarElevation', 'daylight', 'nightDepth',
        'directSunlight', 'diffuseSkylight', 'sceneBrightness', 'shadowLength',
        'solarAltitudeRadians', 'sunAzimuthSouthRadians']) {
        if (!Number.isFinite(environmentState[field])) throw new Error(`ZEN_BONSAI_LIGHTING_FIELD_REQUIRED:${field}`);
    }
    const { sunAngle, solarElevation, daylight, shadowLength, lightColor } = environmentState;
    const night = environmentState.nightDepth;
    const lightIntensity = environmentState.sceneBrightness;
    const direct = environmentState.directSunlight;
    const diffuse = environmentState.diffuseSkylight;
    // The bonsai panel is the sky panel's south-facing elevation view: the sun
    // takes the same place and in-panel light direction as the moon.
    const sun = resolveZenSkyPanelSun(environmentState);
    const { x: lightDirX, y: lightDirY } = resolveZenSkyPanelLightDirection(sun);
    const { u: sunPositionX, v: sunPositionY } = projectZenSkyPanelPoint(sun);
    const sunArcProgress = clamp01((lightDirX + 1) * 0.5);
    const shadowDirX = -lightDirX;
    const shadowDirY = -lightDirY;

    return {
        sunAngle,
        sunArcProgress,
        solarElevation,
        daylight,
        night,
        lightIntensity,
        shadowLength,
        lightColor,
        sunPositionX,
        sunPositionY,
        lightDirX,
        lightDirY,
        shadowDirX,
        shadowDirY,
        shadowAngle: Math.atan2(shadowDirY, shadowDirX),
        shadowReach: 4 + (shadowLength * 0.24 * (0.78 + ((1 - solarElevation) * 0.42))),
        shadowStretch: clamp(0.84 + ((1 - solarElevation) * 0.58), 0.84, 1.42),
        glowAlpha: clamp(direct * 0.36, 0, 0.58),
        ambientWashAlpha: clamp(diffuse * 0.45, 0, 0.18),
        highlightAlpha: clamp(direct * 0.3 + diffuse * 0.08, 0, 0.4),
        shadowAlpha: clamp(direct * (0.1 + (1 - solarElevation) * 0.08), 0, 0.22),
        blossomShadowAlpha: clamp(direct * 0.12, 0, 0.2),
    };
};
