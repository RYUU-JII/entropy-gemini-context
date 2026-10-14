import {
    resolveSakuraRenderLighting,
    withAlphaColor,
} from '../../sakura/sakuraRenderLighting.js';
import {
    mixZenAmbientCurveColor,
    resolveZenWorldWeatherSkyPalette,
} from '../../../runtime/environment/zenWorldMaterialPalette.js';
import {
    drawZenSkyBokashiBand,
    drawZenSkyStars,
    requireZenSkyCelestialOwnership,
} from './zenBonsaiNightSky.js';
import { paintZenSkyMoon, resolveZenSkyMoon } from './zenBonsaiSkyMoon.js';

const clamp = (value, min, max) => Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min),
);

const resolveViewport = (ctx, sceneViewport) => {
    const width = Number(sceneViewport?.width);
    const height = Number(sceneViewport?.height);
    return Object.freeze({
        x: Math.max(0, Number(sceneViewport?.x) || 0),
        y: Math.max(0, Number(sceneViewport?.y) || 0),
        width: Math.max(1, Number.isFinite(width) ? width : Number(ctx?.canvas?.width) || 1),
        height: Math.max(1, Number.isFinite(height) ? height : Number(ctx?.canvas?.height) || 1),
    });
};

const skyGlows = new WeakMap();
const resolveSkyGlow = palette => {
    const cached = skyGlows.get(palette);
    if (cached) return cached;
    const night = palette.nightDepth;
    const warm = mixZenAmbientCurveColor('#ffedc9', '#ffc498', palette.warmth);
    const glow = Object.freeze({
        color: mixZenAmbientCurveColor(warm, '#94a4d0', night),
        alpha: (0.11 + palette.warmth * 0.05) * (1 - night) + 0.075 * night,
    });
    skyGlows.set(palette, glow);
    return glow;
};

/**
 * Model-neutral Zen sky. World time/weather own the light and palette;
 * tree position, growth and health cannot change the atmosphere.
 * `pixelRatio` sizes the CSS-anchored star field and the moon; `celestial`
 * names the owner of the twinkling stars and the moon
 * (see `ZEN_SKY_CELESTIAL_MODES`).
 */
export function drawZenBonsaiOpenAirBackdrop(ctx, {
    environmentState = null,
    sceneViewport = null,
    pixelRatio,
    celestial,
} = {}) {
    if (!ctx) {
        throw new Error('ZEN_BONSAI_OPEN_AIR_BACKDROP_CONTEXT_REQUIRED');
    }
    if (!(pixelRatio > 0) || !Number.isFinite(pixelRatio)) {
        throw new Error('ZEN_BONSAI_OPEN_AIR_BACKDROP_PIXEL_RATIO_REQUIRED');
    }
    requireZenSkyCelestialOwnership(celestial);
    const viewport = resolveViewport(ctx, sceneViewport);
    const lighting = resolveSakuraRenderLighting(environmentState);
    const palette = resolveZenWorldWeatherSkyPalette(environmentState);
    const { cloudCover, rainIntensity } = environmentState;
    const glowTransmission = 1 - Math.min(1, cloudCover * 0.72 + rainIntensity * 0.28) * 0.7;
    const sunX = viewport.width * lighting.sunPositionX;
    const sunY = viewport.height * lighting.sunPositionY;
    const horizonY = viewport.height * 0.76;

    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width, viewport.height);
    ctx.clip();

    const sky = ctx.createLinearGradient(0, 0, 0, viewport.height);
    sky.addColorStop(0, palette.bonsai.skyTop);
    sky.addColorStop(0.52, palette.bonsai.skyMid);
    sky.addColorStop(1, palette.bonsai.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const daylightWash = ctx.createLinearGradient(
        sunX - (viewport.width * 0.12),
        sunY,
        viewport.width - (sunX * 0.16),
        viewport.height,
    );
    daylightWash.addColorStop(
        0,
        withAlphaColor(lighting.lightColor, (lighting.ambientWashAlpha + 0.035) * glowTransmission),
    );
    daylightWash.addColorStop(0.48, 'rgba(255,255,255,0)');
    daylightWash.addColorStop(1, withAlphaColor(palette.bonsai.skyLow, 0.04));
    ctx.fillStyle = daylightWash;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const glow = resolveSkyGlow(palette);

    // Diffuse night illumination is a sky wash, not a simulated moon position.
    const glowX = sunX;
    const glowY = sunY * (1 - lighting.night) + viewport.height * 0.24 * lighting.night;
    const celestialGlow = ctx.createRadialGradient(
        glowX,
        glowY,
        0,
        glowX,
        glowY,
        Math.max(viewport.width * 0.65, viewport.height * 0.38),
    );
    celestialGlow.addColorStop(
        0,
        withAlphaColor(lighting.lightColor, (0.09 * lighting.night + lighting.glowAlpha * 0.36) * glowTransmission),
    );
    celestialGlow.addColorStop(0.54, withAlphaColor(glow.color, glow.alpha * glowTransmission));
    celestialGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = celestialGlow;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const horizon = ctx.createLinearGradient(0, horizonY - viewport.height * 0.22, 0, viewport.height);
    horizon.addColorStop(0, 'rgba(255,255,255,0)');
    const horizonHazeAlpha = clamp(
        0.05 + (cloudCover * 0.08) + (palette.twilightWeight * 0.03),
        0.04,
        0.16,
    );
    horizon.addColorStop(
        0.48,
        withAlphaColor(
            palette.bonsai.skyLow,
            horizonHazeAlpha,
        ),
    );
    horizon.addColorStop(1, withAlphaColor(palette.bonsai.skyLow, 0.16));
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Broad veils preserve the architectural plane; no cloud sprites or new
    // animation loop. The existing environment update rebakes this back layer.
    for (const center of [0.24, 0.46]) {
        const veil = ctx.createLinearGradient(
            0, viewport.height * (center - 0.16),
            viewport.width * 0.12, viewport.height * (center + 0.16),
        );
        veil.addColorStop(0, 'rgba(255,255,255,0)');
        veil.addColorStop(0.5, withAlphaColor(palette.bonsai.skyLow, cloudCover * (0.2 - lighting.night * 0.1)));
        veil.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, viewport.width, viewport.height);
    }

    // The panel's top edge carries the zenith's own deeper pigment, and a
    // clear night carries stars; both stay inside the same baked layer.
    drawZenSkyBokashiBand(ctx, {
        width: viewport.width,
        height: viewport.height,
        skyTop: palette.bonsai.skyTop,
        nightDepth: environmentState.nightDepth,
    });
    drawZenSkyStars(ctx, { viewport, pixelRatio, environmentState, celestial });
    if (celestial.mode === 'animated') {
        const moon = resolveZenSkyMoon(environmentState, viewport, pixelRatio);
        if (moon) paintZenSkyMoon(ctx, moon, moon.x, moon.y);
    }

    ctx.restore();
}

export default drawZenBonsaiOpenAirBackdrop;
