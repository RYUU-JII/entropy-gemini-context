// Shared world-light projection for bonsai bark, attached blossoms and detached
// petals. Keep authored pigment identity separate from the displayed material.
const identity = color => color;
export const ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING = Object.freeze({
    signature: 'botanical-material-day-v1', night: 0, moon: 0,
    mapWoodColor: identity, mapFlowerColor: identity,
});

const unit = value => Number.isFinite(value) && value >= 0 && value <= 1;
const quantize = value => Math.round(value * 20) / 20;
const channel = value => Math.max(0, Math.min(255, Math.round(value)));
const hex = value => channel(value).toString(16).padStart(2, '0');

function parse(color) {
    if (typeof color !== 'string') throw Error('ZEN_BOTANICAL_MATERIAL_COLOR');
    const hexadecimal = /^#([\da-f]{6})([\da-f]{2})?$/i.exec(color);
    if (hexadecimal) return {
        rgb: [0, 2, 4].map(index => parseInt(hexadecimal[1].slice(index, index + 2), 16)),
        suffix: hexadecimal[2] || '', alpha: null,
    };
    const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(color);
    if (rgba) return { rgb: rgba.slice(1, 4).map(Number), suffix: '', alpha: rgba[4] };
    throw Error(`ZEN_BOTANICAL_MATERIAL_COLOR:${color}`);
}

function mapper(night, moon, flower) {
    const colors = new Map(), silver = Math.sqrt(moon);
    return color => {
        if (colors.has(color)) return colors.get(color);
        const parsed = parse(color), [r, g, b] = parsed.rgb;
        const value = r * .2126 + g * .7152 + b * .0722;
        const relief = Math.max(0, (value / 255 - .12) / .88) ** .7;
        const key = (10 + 100 * silver) * relief;
        const target = flower
            // Moonlit blossoms keep about half of their pink: night sakura must
            // still read as flowers against the dark sky, not as grey cotton.
            ? [.95, .98, 1.05].map((tint, index) => value * (.84 + .16 * silver) * tint + (parsed.rgb[index] - value) * .5)
            : [.75, .90, 1.15].map((tint, index) => value * tint + key * [.90, 1, 1.10][index]);
        const rgb = parsed.rgb.map((source, index) => channel(source + (target[index] - source) * night));
        const result = parsed.alpha === null ? '#' + rgb.map(hex).join('') + parsed.suffix
            : `rgba(${rgb.join(',')},${parsed.alpha})`;
        colors.set(color, result);
        return result;
    };
}

// Local pigment projection only. The canonical world already attenuates moonlight
// for moon phase and clouds; this seam invents neither a moon bearing nor weather.
// Match the existing coarse material grain (0.05); retain one atlas per material.
export function resolveZenWorldBotanicalMaterialLighting(environmentState) {
    for (const field of ['nightDepth', 'moonlight']) {
        if (!environmentState || !unit(environmentState[field])) throw Error(`ZEN_BOTANICAL_MATERIAL_LIGHTING_REQUIRED:${field}`);
    }
    const night = quantize(environmentState.nightDepth), moon = quantize(environmentState.moonlight);
    if (night === 0) return ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING;
    return Object.freeze({
        signature: `botanical-material-night-v1:${night}:${moon}`, night, moon,
        mapWoodColor: mapper(night, moon, false), mapFlowerColor: mapper(night, moon, true),
    });
}

export function requireZenWorldBotanicalMaterialLighting(lighting) {
    if (!lighting || typeof lighting.signature !== 'string' || !lighting.signature
        || !unit(lighting.night) || !unit(lighting.moon)
        || typeof lighting.mapWoodColor !== 'function' || typeof lighting.mapFlowerColor !== 'function') {
        throw Error('ZEN_BOTANICAL_MATERIAL_LIGHTING');
    }
    return lighting;
}

// Map paint and gradient stops without changing paths, matrices, alpha, order or
// image copies. Native gradients remain native objects accepted by Canvas/Pixi.
export function createZenBotanicalMaterialContext(context, mapColor) {
    if (!context || typeof mapColor !== 'function') throw Error('ZEN_BOTANICAL_MATERIAL_CONTEXT');
    const methods = new Map();
    return new Proxy(context, {
        get(target, key) {
            const value = Reflect.get(target, key, target);
            if (typeof value !== 'function') return value;
            if (!methods.has(key)) {
                const bound = value.bind(target);
                methods.set(key, key === 'createLinearGradient' || key === 'createRadialGradient'
                    ? (...args) => {
                        const gradient = bound(...args), add = gradient.addColorStop.bind(gradient);
                        gradient.addColorStop = (offset, color) => add(offset, mapColor(color));
                        return gradient;
                    } : bound);
            }
            return methods.get(key);
        },
        set(target, key, value) {
            return Reflect.set(target, key,
                (key === 'fillStyle' || key === 'strokeStyle') && typeof value === 'string' ? mapColor(value) : value,
                target);
        },
    });
}
