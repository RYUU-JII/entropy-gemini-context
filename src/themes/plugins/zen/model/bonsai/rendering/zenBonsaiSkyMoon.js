/**
 * The real moon on the Zen sky panel, placed by the shared sky panel
 * projection (south-facing elevation view: horizon behind the garden bed at
 * the bottom, zenith at the top, east left, west right). Position, phase and the
 * tilt of the bright limb come from the canonical world's lunar channels;
 * weather only veils it. The disc stays a small, paper-toned mark.
 */

import {
    projectZenSkyPanelPoint,
    resolveZenSkyPanelMoon,
} from '../../../runtime/environment/zenWorldSkyPanelProjection.js';

const DEG = Math.PI / 180;
const MOON_RADIUS_CSS = 10;
const NIGHT_TINT = Object.freeze([246, 241, 226]);
const LOW_TINT = Object.freeze([240, 210, 170]);
const DAY_TINT = Object.freeze([250, 251, 253]);
// Near-side maria in a north-up disc frame (x right, y down, unit radius), as
// seen from the northern hemisphere: Imbrium upper left, Crisium near the
// right limb. They are only a faint hint at this size.
const MARIA = Object.freeze([
    [-0.3, -0.4, 0.3], [0.17, -0.36, 0.18], [0.3, -0.06, 0.23], [0.66, -0.28, 0.13],
    [0.55, 0.17, 0.15], [0.34, 0.36, 0.11], [-0.58, -0.04, 0.34], [-0.2, 0.36, 0.18],
].map(Object.freeze));

const smooth = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((value, index) => Math.round(value + (b[index] - value) * t));

function requireUnit(environment, field) {
    const value = environment?.[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_SKY_MOON_ENVIRONMENT_FIELD_INVALID:${field}`);
    }
    return value;
}

function requireAngle(environment, field) {
    const value = environment?.[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_SKY_MOON_ENVIRONMENT_FIELD_INVALID:${field}`);
    }
    return value;
}

/**
 * The visible moon in device pixels relative to the sky viewport origin, or
 * null when it is set, outside the panel's span or hidden by weather.
 */
export function resolveZenSkyMoon(environment, viewport, pixelRatio) {
    if (!viewport || !(viewport.width > 0) || !(viewport.height > 0)) throw new Error('ZEN_SKY_MOON_VIEWPORT_INVALID');
    if (!(pixelRatio > 0) || !Number.isFinite(pixelRatio)) throw new Error('ZEN_SKY_MOON_PIXEL_RATIO_INVALID');
    const altitude = requireAngle(environment, 'moonAltitudeRadians');
    requireAngle(environment, 'moonAzimuthSouthRadians');
    const parallactic = requireAngle(environment, 'moonParallacticAngle');
    const limb = requireAngle(environment, 'moonBrightLimbAngle');
    const fraction = requireUnit(environment, 'moonIllumination');
    const night = requireUnit(environment, 'nightDepth');
    const cloud = requireUnit(environment, 'cloudCover');
    const rain = requireUnit(environment, 'rainIntensity');
    const radius = MOON_RADIUS_CSS * pixelRatio;
    const altitudeDeg = altitude / DEG;
    const place = projectZenSkyPanelPoint(resolveZenSkyPanelMoon(environment));
    const x = viewport.width * place.u;
    if (altitudeDeg < -2 || x < -radius || x > viewport.width + radius) return null;

    const rainVeil = 1 - smooth(0, 0.1, rain);
    // Thin cloud keeps the disc bright and widens its glow; only thick cloud hides it.
    const discClarity = (1 - smooth(0.55, 0.98, cloud)) * rainVeil;
    const haloClarity = (1 - smooth(0.75, 1, cloud)) * rainVeil;
    const low = 1 - smooth(4, 18, altitudeDeg);
    // A pale day moon only when a good part of it is lit.
    const dayDisc = 0.34 * smooth(0.15, 0.6, fraction);
    const nightWeight = smooth(0.25, 0.8, night);
    const discAlpha = (dayDisc + (0.94 - dayDisc) * nightWeight) * (1 - 0.25 * low * nightWeight) * discClarity;
    const haloAlpha = 0.16 * nightWeight * fraction ** 0.8 * haloClarity;
    if (discAlpha < 0.01 && haloAlpha < 0.005) return null;

    // Thin cloud spreads the moon's glow into a wider corona.
    const haloRadius = radius * (4.5 + 4 * smooth(0.15, 0.7, cloud));
    // Zenith-referenced angles are anticlockwise; screen y points down.
    const limbZenith = limb - parallactic;
    return Object.freeze({
        x,
        y: viewport.height * place.v,
        radius,
        fraction,
        limbRotation: Math.atan2(-Math.cos(limbZenith), -Math.sin(limbZenith)),
        northRotation: parallactic,
        discAlpha,
        haloAlpha,
        haloRadius,
        earthshine: 0.07 * nightWeight * (1 - smooth(0.15, 0.45, fraction)) * discClarity,
        tint: Object.freeze(mix(mix(DAY_TINT, NIGHT_TINT, nightWeight), LOW_TINT, low * nightWeight)),
    });
}

const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(4)})`;

// The lit part in a frame whose +x points at the bright limb: the limb
// semicircle closed by the terminator, a half-ellipse of half-width
// (2k - 1)r that bulges sunward for a crescent and away for a gibbous moon.
function traceLitRegion(ctx, radius, fraction) {
    const bulge = (2 * fraction - 1) * radius;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    if (Math.abs(bulge) < 1e-3) ctx.lineTo(0, -radius);
    else if (bulge > 0) ctx.ellipse(0, 0, bulge, radius, 0, Math.PI / 2, Math.PI * 1.5, false);
    else ctx.ellipse(0, 0, -bulge, radius, 0, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
}

/** Paint a resolved moon centred at (x, y): halo, earthshine, lit disc. */
export function paintZenSkyMoon(ctx, moon, x, y) {
    const { radius, tint } = moon;
    if (moon.haloAlpha > 0) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, moon.haloRadius);
        halo.addColorStop(0, rgba(tint, moon.haloAlpha));
        halo.addColorStop(0.3, rgba(tint, moon.haloAlpha * 0.42));
        halo.addColorStop(1, rgba(tint, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(x - moon.haloRadius, y - moon.haloRadius, moon.haloRadius * 2, moon.haloRadius * 2);
    }
    ctx.save();
    try {
        ctx.translate(x, y);
        if (moon.earthshine > 0) {
            ctx.fillStyle = rgba(tint, moon.earthshine);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        if (moon.fraction < 0.005 || moon.discAlpha <= 0) return;
        ctx.rotate(moon.limbRotation);
        traceLitRegion(ctx, radius, moon.fraction);
        ctx.clip();
        ctx.fillStyle = rgba(tint, moon.discAlpha);
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.rotate(moon.northRotation - moon.limbRotation);
        const mare = tint.map((value, index) => Math.round(value * [0.8, 0.81, 0.86][index]));
        for (const [mx, my, mr] of MARIA) {
            const cx = mx * radius, cy = my * radius, r = mr * radius;
            const shade = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            shade.addColorStop(0, rgba(mare, moon.discAlpha * 0.5));
            shade.addColorStop(1, rgba(mare, 0));
            ctx.fillStyle = shade;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
    } finally {
        ctx.restore();
    }
}

/** The extent a painted moon covers around its centre, in device pixels. */
export const resolveZenSkyMoonExtent = moon => Math.ceil(Math.max(moon.haloRadius, moon.radius) + 2);
