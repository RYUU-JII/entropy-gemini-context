const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const normalizeHexColor = (candidate) => {
    if (typeof candidate !== 'string') return null;
    const trimmed = candidate.trim();
    const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split('');
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    const longMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (longMatch) {
        return `#${longMatch[1].toUpperCase()}`;
    }
    return null;
};

const hexToRgb = (hex) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return { r: 0, g: 0, b: 0 };
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
    };
};

const parseHexColorSafe = (candidate, fallback = '#000000') => {
    const resolved = normalizeHexColor(candidate) || normalizeHexColor(fallback) || '#000000';
    return {
        hex: resolved,
        r: Number.parseInt(resolved.slice(1, 3), 16),
        g: Number.parseInt(resolved.slice(3, 5), 16),
        b: Number.parseInt(resolved.slice(5, 7), 16),
    };
};

const rgbToHex = ({ r, g, b }) => {
    const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = ({ r, g, b }) => {
    const nr = clamp(r / 255, 0, 1);
    const ng = clamp(g / 255, 0, 1);
    const nb = clamp(b / 255, 0, 1);
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const delta = max - min;

    let h = 0;
    if (delta > 1e-6) {
        if (max === nr) {
            h = ((ng - nb) / delta) % 6;
        } else if (max === ng) {
            h = (nb - nr) / delta + 2;
        } else {
            h = (nr - ng) / delta + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
    }

    const l = (max + min) * 0.5;
    const s = delta <= 1e-6 ? 0 : delta / (1 - Math.abs((2 * l) - 1));
    return { h, s, l };
};

const hslToRgb = ({ h, s, l }) => {
    const hue = ((Number(h) % 360) + 360) % 360;
    const sat = clamp(s, 0, 1);
    const light = clamp(l, 0, 1);
    const c = (1 - Math.abs((2 * light) - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = light - (c / 2);

    let rp = 0;
    let gp = 0;
    let bp = 0;

    if (hue < 60) {
        rp = c;
        gp = x;
    } else if (hue < 120) {
        rp = x;
        gp = c;
    } else if (hue < 180) {
        gp = c;
        bp = x;
    } else if (hue < 240) {
        gp = x;
        bp = c;
    } else if (hue < 300) {
        rp = x;
        bp = c;
    } else {
        rp = c;
        bp = x;
    }

    return {
        r: Math.round((rp + m) * 255),
        g: Math.round((gp + m) * 255),
        b: Math.round((bp + m) * 255),
    };
};

const mixHex = (hexA, hexB, ratio) => {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const t = clamp(ratio, 0, 1);
    return rgbToHex({
        r: a.r + ((b.r - a.r) * t),
        g: a.g + ((b.g - a.g) * t),
        b: a.b + ((b.b - a.b) * t),
    });
};

const toLinearChannel = (value) => {
    const c = clamp(value / 255, 0, 1);
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luma = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * toLinearChannel(r))
        + (0.7152 * toLinearChannel(g))
        + (0.0722 * toLinearChannel(b));
};

const colorDistanceRgb = (a, b) => {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
};

const rgbToLab = ({ r, g, b }) => {
    const sr = toLinearChannel(r);
    const sg = toLinearChannel(g);
    const sb = toLinearChannel(b);

    const x = (0.4124564 * sr + 0.3575761 * sg + 0.1804375 * sb) / 0.95047;
    const y = (0.2126729 * sr + 0.7151522 * sg + 0.072175 * sb) / 1;
    const z = (0.0193339 * sr + 0.119192 * sg + 0.9503041 * sb) / 1.08883;

    const f = (value) => (value > 0.008856 ? value ** (1 / 3) : ((7.787 * value) + (16 / 116)));
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    return {
        l: (116 * fy) - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz),
    };
};

const hexToLab = (hex) => rgbToLab(hexToRgb(hex));

const deltaE76 = (hexA, hexB) => {
    const a = hexToLab(hexA);
    const b = hexToLab(hexB);
    const dl = a.l - b.l;
    const da = a.a - b.a;
    const db = a.b - b.b;
    return Math.sqrt((dl * dl) + (da * da) + (db * db));
};

const isAchromaticHex = (hex, threshold = 0.12) => {
    const { s } = rgbToHsl(hexToRgb(hex));
    return s <= threshold;
};

const isDarkHex = (hex, threshold = 0.12) => luma(hex) <= threshold;
const isLightHex = (hex, threshold = 0.86) => luma(hex) >= threshold;

export {
    clamp,
    normalizeHexColor,
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    mixHex,
    luma,
    colorDistanceRgb,
    deltaE76,
    isAchromaticHex,
    isDarkHex,
    isLightHex,
    parseHexColorSafe,
};
