/**
 * Zen sky structure over the world sky palette: the ichimonji-bokashi band at
 * the panel's top edge and the clear-night star field. Both read only the
 * canonical environment and the sky viewport; tree, growth and health cannot
 * change them. Positions are fixed in CSS pixels from the sky's top-left, so a
 * resize reveals more or less of the same sky instead of reshuffling it.
 */

const STAR_CELL_CSS = 64;
// The panel reads from ground (bottom) to open sky (top): candidates are kept
// densest at the frame's top edge and thin with depth toward the ground haze,
// about 4.6 stars per cell at the top, 1.5 at mid-panel and none below 0.86.
const STAR_CANDIDATES_PER_CELL = 5;
const STAR_TOP_PROBABILITY = 0.92;
const STAR_DENSITY_EXPONENT = 1.6;
const STAR_LOWEST_FRACTION = 0.86;
const STAR_SALT = 0x5a17;
// Brightness is heavily skewed: most stars are faint points. Only the bright
// tail twinkles, slowly; the rest are part of the baked sky.
const STAR_BRIGHTNESS_EXPONENT = 3.2;
export const ZEN_SKY_TWINKLE_BRIGHTNESS = 0.62;
const STAR_HALO_RADII = 3.4;
const STAR_TINTS = Object.freeze([
    Object.freeze([244, 242, 255]),
    Object.freeze([255, 243, 230]),
    Object.freeze([230, 238, 255]),
]);
const BAND_HEIGHT = 0.2;

const smooth = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
};

function hashUnit(x, y, k, salt) {
    let n = Math.imul(x ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(y ^ 0x9e3779b9, 0x85ebca6b)
        ^ Math.imul(k + salt, 0xc2b2ae35);
    n ^= n >>> 15; n = Math.imul(n, 0x2c1b3c6d);
    n ^= n >>> 12; n = Math.imul(n, 0x297a2d39);
    n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
}

function requireUnit(environment, field) {
    const value = environment?.[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_SKY_ENVIRONMENT_FIELD_INVALID:${field}`);
    }
    return value;
}

function requireViewport(viewport, pixelRatio) {
    if (!viewport || ![viewport.x, viewport.y, viewport.width, viewport.height].every(Number.isFinite)
        || !(viewport.width > 0) || !(viewport.height > 0)) {
        throw new Error('ZEN_SKY_VIEWPORT_INVALID');
    }
    if (!(pixelRatio > 0) || !Number.isFinite(pixelRatio)) throw new Error('ZEN_SKY_PIXEL_RATIO_INVALID');
}

const starFields = new Map();
const STAR_FIELD_CACHE_LIMIT = 4;

/**
 * Stars in device pixels relative to the sky viewport origin. The field is a
 * pure function of the viewport size and pixel ratio.
 */
export function resolveZenSkyStarField(viewport, pixelRatio) {
    requireViewport(viewport, pixelRatio);
    const key = `${viewport.width}x${viewport.height}@${pixelRatio}`;
    const cached = starFields.get(key);
    if (cached) return cached;
    const cssWidth = viewport.width / pixelRatio, cssHeight = viewport.height / pixelRatio, stars = [];
    for (let cy = 0; cy * STAR_CELL_CSS < cssHeight; cy++) {
        for (let cx = 0; cx * STAR_CELL_CSS < cssWidth; cx++) {
            for (let k = 0; k < STAR_CANDIDATES_PER_CELL; k++) {
                const x = (cx + hashUnit(cx, cy, k, STAR_SALT + 1)) * STAR_CELL_CSS;
                const y = (cy + hashUnit(cx, cy, k, STAR_SALT + 2)) * STAR_CELL_CSS;
                const height = y / cssHeight;
                if (x >= cssWidth || height >= STAR_LOWEST_FRACTION) continue;
                const keep = STAR_TOP_PROBABILITY * (1 - height) ** STAR_DENSITY_EXPONENT;
                if (hashUnit(cx, cy, k, STAR_SALT) >= keep) continue;
                const brightness = hashUnit(cx, cy, k, STAR_SALT + 3) ** STAR_BRIGHTNESS_EXPONENT;
                stars.push(Object.freeze({
                    x: x * pixelRatio,
                    y: y * pixelRatio,
                    height,
                    brightness,
                    radius: (0.45 + brightness * 0.9) * pixelRatio,
                    tint: STAR_TINTS[Math.floor(hashUnit(cx, cy, k, STAR_SALT + 4) * STAR_TINTS.length)],
                    twinkles: brightness > ZEN_SKY_TWINKLE_BRIGHTNESS,
                    phase: hashUnit(cx, cy, k, STAR_SALT + 5) * Math.PI * 2,
                    rate: 0.55 + hashUnit(cx, cy, k, STAR_SALT + 6) * 0.7,
                }));
            }
        }
    }
    const field = Object.freeze(stars);
    if (starFields.size >= STAR_FIELD_CACHE_LIMIT) starFields.delete(starFields.keys().next().value);
    starFields.set(key, field);
    return field;
}

/** Star light from the canonical world: night, cloud, rain and moon. */
export function resolveZenSkyStarLight(environment) {
    const nightDepth = requireUnit(environment, 'nightDepth');
    const cloudCover = requireUnit(environment, 'cloudCover');
    const rainIntensity = requireUnit(environment, 'rainIntensity');
    const moonlight = requireUnit(environment, 'moonlight');
    return Object.freeze({
        nightDepth,
        moonlight,
        clarity: (1 - smooth(0.25, 0.8, cloudCover)) * (1 - smooth(0, 0.08, rainIntensity)),
    });
}

/** Rest alpha: bright stars appear first in deepening twilight. */
export function resolveZenSkyStarAlpha(star, light) {
    if (light.clarity <= 0) return 0;
    const faint = 1 - star.brightness;
    const appear = smooth(0.45 + 0.4 * faint, 0.75 + 0.25 * faint, light.nightDepth);
    // A bright moon washes out faint stars, not the bright ones.
    const moonWash = 1 - Math.min(1, light.moonlight * 1.6) * faint * 0.85;
    const horizon = 1 - smooth(0.55, 0.92, star.height);
    return (0.22 + 0.66 * star.brightness) * appear * light.clarity * moonWash * horizon;
}

/** Slow scintillation of a twinkling star, as a multiplier in [0.58, 1]. */
export function resolveZenSkyStarTwinkle(star, timeSec) {
    if (!Number.isFinite(timeSec)) throw new Error('ZEN_SKY_TWINKLE_TIME_INVALID');
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * star.rate * Math.PI * 2 * 0.35 + star.phase);
    return 1 - 0.42 * pulse * pulse;
}

const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(4)})`;

export function drawZenSkyStar(ctx, star, x, y, alpha) {
    if (star.twinkles) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, star.radius * STAR_HALO_RADII);
        halo.addColorStop(0, rgba(star.tint, alpha * 0.32));
        halo.addColorStop(1, rgba(star.tint, 0));
        ctx.fillStyle = halo;
        const extent = star.radius * STAR_HALO_RADII;
        ctx.fillRect(x - extent, y - extent, extent * 2, extent * 2);
    }
    ctx.fillStyle = rgba(star.tint, alpha);
    ctx.beginPath();
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Who owns the sky's moving bodies, the twinkling stars and the moon:
 * `rest` is a static bake with no live owner, so it keeps the bright stars at
 * rest and leaves the moon out (a baked moon would go stale); `omit` leaves
 * both to per-frame layers; `animated` paints both at `timeSec`.
 */
export const ZEN_SKY_CELESTIAL_MODES = Object.freeze(['rest', 'omit', 'animated']);

export function requireZenSkyCelestialOwnership(value) {
    if (!value || !ZEN_SKY_CELESTIAL_MODES.includes(value.mode)
        || (value.mode === 'animated' && !Number.isFinite(value.timeSec))) {
        throw new Error('ZEN_SKY_CELESTIAL_OWNERSHIP_INVALID');
    }
    return value;
}

/** Paint the star field into a sky viewport; see `ZEN_SKY_CELESTIAL_MODES`. */
export function drawZenSkyStars(ctx, { viewport, pixelRatio, environmentState, celestial }) {
    requireZenSkyCelestialOwnership(celestial);
    const light = resolveZenSkyStarLight(environmentState);
    if (light.clarity <= 0 || light.nightDepth <= 0.45) return 0;
    let drawn = 0;
    for (const star of resolveZenSkyStarField(viewport, pixelRatio)) {
        if (star.twinkles && celestial.mode === 'omit') continue;
        let alpha = resolveZenSkyStarAlpha(star, light);
        if (alpha < 0.01) continue;
        if (star.twinkles && celestial.mode === 'animated') alpha *= resolveZenSkyStarTwinkle(star, celestial.timeSec);
        drawZenSkyStar(ctx, star, star.x, star.y, alpha);
        drawn++;
    }
    return drawn;
}

function parseRgb(color) {
    const hex = /^#([\da-f]{6})$/iu.exec(color);
    if (hex) return [0, 2, 4].map(offset => Number.parseInt(hex[1].slice(offset, offset + 2), 16));
    const rgb = /^rgba?\(([^)]+)\)$/iu.exec(color);
    const channels = rgb ? rgb[1].split(',').slice(0, 3).map(Number) : [];
    if (channels.length !== 3 || !channels.every(Number.isFinite)) throw new Error(`ZEN_SKY_COLOR_INVALID:${String(color)}`);
    return channels;
}

/**
 * Ichimonji bokashi: the zenith's own pigment, slightly deeper with a faint
 * indigo lean, strongest at the frame edge and gone by a fifth of the sky.
 */
export function drawZenSkyBokashiBand(ctx, { width, height, skyTop, nightDepth }) {
    const [red, green, blue] = parseRgb(skyTop);
    const lightness = (Math.max(red, green, blue) + Math.min(red, green, blue)) / 2;
    const loss = 0.075 + 0.05 * nightDepth;
    const band = [red * 0.94, green * 0.97, blue * 1.02]
        .map(value => Math.round(Math.max(0, Math.min(255, value * (1 - loss) + (value - lightness) * 0.12))));
    const strength = 0.55 + 0.25 * nightDepth;
    const gradient = ctx.createLinearGradient(0, 0, 0, height * BAND_HEIGHT);
    gradient.addColorStop(0, rgba(band, strength));
    gradient.addColorStop(0.32, rgba(band, strength * 0.78));
    gradient.addColorStop(1, rgba(band, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height * BAND_HEIGHT);
}
