import {
    resolveSakuraRenderLighting,
} from '../../sakura/sakuraRenderLighting.js';
import {
    resolveZenAmbientPalette,
} from '../../../runtime/environment/zenWorldMaterialPalette.js';
import {
    resolveZenBonsaiPresentationStyle,
} from './zenBonsaiPresentationStyle.js';

/**
 * Runtime ink tint for the Zen bonsai.
 *
 * The tree is drawn in neutral ink values and painted here in whatever light
 * the world is currently in. Keeping the two apart is deliberate:
 *
 * - the render plan stays light-independent, so it is not rebuilt (and later,
 *   not re-baked into Pixi textures) every time the sun moves;
 * - the scene's light is applied per paint, which is where it belongs.
 *
 * Contrast is guaranteed rather than hoped for. The tint always pushes the
 * tree *away* from the value of the sky behind it, in whichever direction has
 * more headroom: dark ink against a bright day sky, a lifted moonlit grey
 * against a night one. That is why a fixed ink palette cannot be used — a
 * black tree disappears at midnight.
 */

const NEUTRAL_LIGHT = Object.freeze({ r: 255, g: 244, b: 224 });
const NEUTRAL_GROUND = Object.freeze({ r: 232, g: 227, b: 215 });

// How far a colour may travel from its neutral ink value toward the scene's
// light and shadow anchors. Full commitment would make the tree a coloured
// silhouette and lose the ink identity; none of it would leave the sticker.
const TINT_STRENGTH = 0.58;
// The blossoms are the composition's single point of chroma. They still stand
// in the same light, but they surrender less of themselves to it than the wood
// does, or there is no accent left to carry.
const ACCENT_TINT_STRENGTH = 0.26;
// Minimum luminance gap the tree keeps from the sky value behind it.
const MINIMUM_GROUND_SEPARATION = 0.3;
// Beyond this the tree would read as glowing rather than as ink.
const MAXIMUM_LIFT = 0.46;

const clamp = (value, min, max) => Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min),
);
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (start, end, amount) => start + ((end - start) * amount);

const parseColor = (value) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return null;
    if (raw.startsWith('#')) {
        const body = raw.slice(1);
        if (body.length === 3) {
            return {
                r: Number.parseInt(`${body[0]}${body[0]}`, 16),
                g: Number.parseInt(`${body[1]}${body[1]}`, 16),
                b: Number.parseInt(`${body[2]}${body[2]}`, 16),
                a: 1,
            };
        }
        if (body.length === 6) {
            return {
                r: Number.parseInt(body.slice(0, 2), 16),
                g: Number.parseInt(body.slice(2, 4), 16),
                b: Number.parseInt(body.slice(4, 6), 16),
                a: 1,
            };
        }
        return null;
    }
    const channels = raw.match(/[\d.]+/gu);
    if (!channels || channels.length < 3) return null;
    return {
        r: Number(channels[0]) || 0,
        g: Number(channels[1]) || 0,
        b: Number(channels[2]) || 0,
        a: channels.length >= 4 ? clamp01(Number(channels[3])) : 1,
    };
};

const channelHex = (value) => clamp(Math.round(value), 0, 255)
    .toString(16)
    .padStart(2, '0');

// Opaque colours come back as hex because downstream sprite painters parse
// hex only; alpha-bearing colours keep the rgba form they arrived in.
const formatColor = ({ r, g, b, a }) => (
    a >= 0.999
        ? `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`
        : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Number(a.toFixed(3))})`
);

// The blossom painter bakes one sprite per distinct colour, so a continuously
// drifting accent would grow that cache all day. Quantizing the accent bounds
// it to a handful of sprites and stops the blossoms shimmering as the light
// creeps. The wood tint feeds no cache and stays continuous.
const ACCENT_QUANTUM = 8;
const quantize = (value) => Math.round(value / ACCENT_QUANTUM) * ACCENT_QUANTUM;

const luminanceOf = ({ r, g, b }) => clamp01(
    ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) / 255,
);

/**
 * Normalizes a material colour to unit luminance.
 *
 * Albedo multiplies the light, so an un-normalized brown would darken the wood
 * as well as tinting it, and the value structure the strokes carry would be
 * lost. Dividing the material by its own luminance leaves a pure hue shift.
 */
const normalizeAlbedo = (value) => {
    const parsed = parseColor(value);
    if (!parsed) return null;
    const luminance = Math.max(0.02, luminanceOf(parsed));
    return {
        r: (parsed.r / 255) / luminance,
        g: (parsed.g / 255) / luminance,
        b: (parsed.b / 255) / luminance,
    };
};

const applyAlbedo = (channelValue, albedoChannel) => (
    albedoChannel === undefined ? channelValue : channelValue * albedoChannel
);

// Pushes a colour away from its own grey without moving its value.
const saturateChannel = (channelValue, grey, amount) => (
    grey + ((channelValue - grey) * amount)
);

/**
 * One resolved description of the light this scene is painted in. The backdrop
 * and the tree both read it, so they cannot drift into different weather.
 */
export const resolveZenBonsaiScenePalette = (environmentState = null) => {
    const lighting = resolveSakuraRenderLighting(environmentState);
    const palette = resolveZenAmbientPalette(
        environmentState?.ambientChromaticState || {
            hour: environmentState?.time,
            sunriseHour: environmentState?.sunriseHour,
            sunsetHour: environmentState?.sunsetHour,
            daylight: lighting.daylight,
            nightDepth: lighting.night,
            solarElevation: lighting.solarElevation,
        },
    );
    return { lighting, palette };
};

const resolveAnchors = (environmentState) => {
    const { lighting, palette } = resolveZenBonsaiScenePalette(environmentState);
    const light = parseColor(palette?.lightColor || lighting?.lightColor)
        || { ...NEUTRAL_LIGHT, a: 1 };
    // The tree stands against the lower sky, so that is the value it has to
    // separate itself from — not the zenith.
    const ground = parseColor(palette?.bonsai?.skyLow)
        || parseColor(palette?.bonsai?.skyMid)
        || { ...NEUTRAL_GROUND, a: 1 };
    const groundLuminance = luminanceOf(ground);

    // Push away from the ground value into whichever side has more room.
    const headroomDown = groundLuminance;
    const headroomUp = 1 - groundLuminance;
    const goesDark = headroomDown >= headroomUp;
    const separation = Math.min(
        MINIMUM_GROUND_SEPARATION,
        goesDark ? headroomDown : headroomUp,
    );

    // Ink sits between a shadow anchor and a light anchor. Against a bright
    // sky both anchors drop below it; against a night sky both rise, and the
    // tree becomes a pale wash rather than an invisible black shape.
    const shadowAnchor = goesDark
        ? { r: ground.r * 0.16, g: ground.g * 0.17, b: ground.b * 0.2 }
        : {
            r: lerp(ground.r, light.r, 0.22),
            g: lerp(ground.g, light.g, 0.22),
            b: lerp(ground.b, light.b, 0.26),
        };
    const lightAnchor = goesDark
        ? {
            r: lerp(ground.r, light.r, 0.42),
            g: lerp(ground.g, light.g, 0.42),
            b: lerp(ground.b, light.b, 0.38),
        }
        : {
            // Lifted against a dark sky the tree is silvered ink, not a
            // glowing X-ray, so the bright end of the range stays well short
            // of the light source itself.
            r: lerp(ground.r, light.r, 0.58),
            g: lerp(ground.g, light.g, 0.58),
            b: lerp(ground.b, light.b, 0.55),
        };

    const lift = goesDark ? 0 : clamp(separation, 0, MAXIMUM_LIFT);

    // Ordinary objects get ordinary light. The pair above is bent to keep the
    // tree legible against its sky, which means every value it produces sits
    // clear of that sky — correct for the subject, wrong for a garden bed,
    // which would then glow at midnight. These anchors instead follow how much
    // light there actually is, so the bed simply goes dark when the sun does.
    const exposure = clamp(0.26 + (lighting.daylight * 0.74), 0.26, 1);
    const surfaceShadow = {
        r: ground.r * 0.15 * exposure,
        g: ground.g * 0.16 * exposure,
        b: ground.b * 0.19 * exposure,
    };
    const surfaceLight = {
        r: lerp(ground.r, light.r, 0.52) * exposure,
        g: lerp(ground.g, light.g, 0.52) * exposure,
        b: lerp(ground.b, light.b, 0.48) * exposure,
    };

    return {
        shadowAnchor,
        lightAnchor,
        surfaceShadow,
        surfaceLight,
        goesDark,
        lift,
        exposure,
        signature: [
            'ink-tint',
            Math.round(groundLuminance * 100),
            goesDark ? 'dark' : 'lift',
            Math.round(lift * 100),
            Math.round(luminanceOf(light) * 100),
        ].join(':'),
    };
};

/**
 * Builds the paint-time colour map for one frame's light.
 *
 * `mapColor` is memoized because a scene command stream repeats a handful of
 * distinct colours across a thousand commands; the cache turns per-command
 * parsing into a few dozen conversions per frame.
 */
// The tint is now resolved every painted frame, so the last result is kept.
// The worker only replaces `environmentState` on an environment tick, which
// makes object identity an exact and very cheap cache key: between ticks the
// light has not changed, and re-deriving it sixty times a second would re-parse
// the same few dozen colours for nothing.
let cachedTintKey = null;
let cachedTintStrength = null;
let cachedTintStyle = null;
let cachedTint = null;

export const resolveZenBonsaiInkTint = ({
    environmentState = null,
    presentationStyle = null,
    strength = null,
} = {}) => {
    const style = resolveZenBonsaiPresentationStyle(presentationStyle);
    const amount = clamp01(strength === null ? style.tintStrength : strength);
    if (cachedTint && cachedTintKey === environmentState && cachedTintStrength === amount
        && cachedTintStyle === style.id) {
        return cachedTint;
    }
    const anchors = resolveAnchors(environmentState);
    const albedo = normalizeAlbedo(style.woodAlbedo);
    const accentSaturation = Number(style.accentSaturation) || 1;

    /**
     * @param mapAmount  how far this subject travels toward the scene anchors
     * @param liftAmount how far it is pushed clear of the sky value
     * @param step       quantum, for subjects whose colour feeds a sprite cache
     */
    const buildMap = (mapAmount, liftAmount, pair, {
        step = 0,
        material = null,
        saturation = 1,
    } = {}) => {
        const cache = new Map();
        const snap = step > 0
            ? (value) => Math.round(value / step) * step
            : (value) => value;
        return (value) => {
            if (typeof value !== 'string' || !value) return value;
            const cached = cache.get(value);
            if (cached !== undefined) return cached;
            const source = parseColor(value);
            if (!source) {
                cache.set(value, value);
                return value;
            }
            // Value carries the structure; the anchors supply the colour.
            const inkValue = clamp01(luminanceOf(source) + liftAmount);
            const channel = (from, shadow, light, albedoChannel) => lerp(
                from,
                applyAlbedo(lerp(shadow, light, inkValue), albedoChannel),
                mapAmount,
            );
            let red = channel(source.r, pair.shadow.r, pair.light.r, material?.r);
            let green = channel(source.g, pair.shadow.g, pair.light.g, material?.g);
            let blue = channel(source.b, pair.shadow.b, pair.light.b, material?.b);
            if (saturation !== 1) {
                const grey = (red + green + blue) / 3;
                red = saturateChannel(red, grey, saturation);
                green = saturateChannel(green, grey, saturation);
                blue = saturateChannel(blue, grey, saturation);
            }
            const result = formatColor({
                r: snap(clamp(red, 0, 255)),
                g: snap(clamp(green, 0, 255)),
                b: snap(clamp(blue, 0, 255)),
                a: source.a,
            });
            cache.set(value, result);
            return result;
        };
    };

    const accentAmount = clamp01(style.accentTintStrength);
    const subjectPair = { shadow: anchors.shadowAnchor, light: anchors.lightAnchor };
    const surfacePair = { shadow: anchors.surfaceShadow, light: anchors.surfaceLight };

    const resolved = Object.freeze({
        signature: `${anchors.signature}:${style.id}:${Math.round(amount * 100)}`,
        style: style.id,
        goesDark: anchors.goesDark,
        // The tree, which the lift exists for.
        mapColor: buildMap(amount, anchors.lift, subjectPair, { material: albedo }),
        // Blossoms: same light, lighter touch, quantized because the blossom
        // painter bakes one sprite per distinct colour and a continuously
        // drifting accent would grow that cache all day.
        mapAccentColor: buildMap(accentAmount, anchors.lift * 0.5, subjectPair, {
            step: ACCENT_QUANTUM,
            saturation: accentSaturation,
        }),
        // The canopy wash: an implied mass behind the blossoms, not a subject
        // of its own. The lift exists to keep a subject legible against a sky
        // that might match it — a low-alpha wash has no such fight to win, and
        // lifting it anyway is what turned it into a pale blob precisely when
        // the night sky gave the lift the most room to push into. Same hue
        // treatment as the blossoms, but left to follow the anchors' own
        // day/night drift rather than being shoved clear of them.
        mapMassColor: buildMap(accentAmount, 0, subjectPair, {
            step: ACCENT_QUANTUM,
            saturation: accentSaturation,
        }),
        // Everything that is simply an object standing in this light — the
        // garden bed, the paper's own mid tone. The lift is the tree's rule for
        // staying clear of the sky; applying it here just makes a slab glow at
        // midnight.
        // The bed and the paper are lit objects, not the subject: no albedo of
        // the tree's, and no lift.
        mapSurfaceColor: buildMap(amount, 0, surfacePair),
    });
    cachedTintKey = environmentState;
    cachedTintStrength = amount;
    cachedTintStyle = style.id;
    cachedTint = resolved;
    return resolved;
};

/**
 * Paints a whole palette object in the scene's light.
 *
 * The garden bed draws itself with direct canvas gradients rather than through
 * the command stream, so it cannot go through the executor's per-command map.
 * Mapping its palette once before it draws puts it in the same light as the
 * tree without touching any of its drawing code.
 */
export const tintZenBonsaiPalette = (palette, mapColor) => {
    if (!palette || typeof palette !== 'object' || typeof mapColor !== 'function') {
        return palette;
    }
    const tinted = {};
    Object.entries(palette).forEach(([key, value]) => {
        tinted[key] = typeof value === 'string' ? mapColor(value) : value;
    });
    return Object.freeze(tinted);
};

export default resolveZenBonsaiInkTint;
