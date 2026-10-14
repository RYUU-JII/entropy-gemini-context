const DEFAULT_WATER_PALETTE_ID = 'zen_garden';

const WATER_PALETTE_PRESETS = Object.freeze({
    zen_garden: Object.freeze({
        id: 'zen_garden',
        label: 'Zen Garden',
        // Natural pond pigments are authored as readable midtones. Their depth
        // and hue survive the shared lighting pass without a cyan substrate.
        clear: ['#467F68', '#3A6B56', '#2A4F3E'],
        algae: ['#6A7940', '#53642E', '#384721'],
        deep: ['#74654D', '#5A4B37', '#403224'],
        calibration: Object.freeze({
            saturationScale: 1,
            lightnessScale: 1,
            sheenScale: 1,
        }),
        composition: Object.freeze({
            baseBlendWeight: 0.34,
            depthStrengthBias: 0.16,
            contourDensityBias: -0.12,
            sedimentAmountBias: 0.28,
            mineralTint: '#84A7BB',
            mineralStrength: 0.08,
            thermalTint: '#7DA26A',
            thermalStrength: 0.24,
        }),
    }),
    ramune_soda: Object.freeze({
        id: 'ramune_soda',
        label: 'Ramune Soda',
        clear: ['#8DF3FF', '#5ADBF8', '#2EB7E3'],
        algae: ['#76E0EE', '#48C2E0', '#2A98C3'],
        deep: ['#4E92AE', '#336B87', '#1F465D'],
        calibration: Object.freeze({
            saturationScale: 0.9,
            lightnessScale: 0.64,
            sheenScale: 0.72,
        }),
        composition: Object.freeze({
            baseBlendWeight: 0.52,
            depthStrengthBias: -0.06,
            contourDensityBias: 0.24,
            sedimentAmountBias: -0.36,
            mineralTint: '#7DBBCE',
            mineralStrength: 0.3,
            thermalTint: '#9AC6A0',
            thermalStrength: 0.08,
        }),
    }),
    summer_lagoon: Object.freeze({
        id: 'summer_lagoon',
        label: 'Summer Lagoon',
        clear: ['#7FF7D5', '#48DDB9', '#27B897'],
        algae: ['#65E3BF', '#3FC79F', '#23927B'],
        deep: ['#3E9D86', '#2C7564', '#1D4C42'],
        calibration: Object.freeze({
            saturationScale: 0.92,
            lightnessScale: 0.66,
            sheenScale: 0.74,
        }),
        composition: Object.freeze({
            baseBlendWeight: 0.48,
            depthStrengthBias: 0.02,
            contourDensityBias: 0.08,
            sedimentAmountBias: -0.08,
            mineralTint: '#78B7C6',
            mineralStrength: 0.18,
            thermalTint: '#88B477',
            thermalStrength: 0.14,
        }),
    }),
    sapphire_pool: Object.freeze({
        id: 'sapphire_pool',
        label: 'Sapphire Pool',
        clear: ['#6BD6FF', '#3EAFF1', '#277DCC'],
        algae: ['#5BC4F0', '#2E97D3', '#216BA7'],
        deep: ['#3A7BA8', '#28597C', '#183A57'],
        calibration: Object.freeze({
            saturationScale: 0.94,
            lightnessScale: 0.68,
            sheenScale: 0.78,
        }),
        composition: Object.freeze({
            baseBlendWeight: 0.56,
            depthStrengthBias: -0.1,
            contourDensityBias: 0.32,
            sedimentAmountBias: -0.4,
            mineralTint: '#82C3D8',
            mineralStrength: 0.36,
            thermalTint: '#97B8A1',
            thermalStrength: 0.06,
        }),
    }),
    emerald_glass: Object.freeze({
        id: 'emerald_glass',
        label: 'Emerald Glass',
        clear: ['#8AE9C8', '#58CCAB', '#34987F'],
        algae: ['#78D8B6', '#45B691', '#2C856C'],
        deep: ['#4F9F89', '#367563', '#214A40'],
        calibration: Object.freeze({
            saturationScale: 0.93,
            lightnessScale: 0.7,
            sheenScale: 0.8,
        }),
        composition: Object.freeze({
            baseBlendWeight: 0.5,
            depthStrengthBias: 0.04,
            contourDensityBias: 0.12,
            sedimentAmountBias: -0.14,
            mineralTint: '#8ABFCA',
            mineralStrength: 0.22,
            thermalTint: '#8FB97D',
            thermalStrength: 0.12,
        }),
    }),
});

const WATER_PALETTE_OPTIONS = Object.freeze(
    Object.values(WATER_PALETTE_PRESETS).map((entry) => Object.freeze({
        value: entry.id,
        label: entry.label,
    })),
);

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const normalizeHexColor = (hex) => {
    if (typeof hex !== 'string') return '#000000';
    const trimmed = hex.trim();
    const match = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (match) return `#${match[1].toUpperCase()}`;
    return '#000000';
};

const hexToRgb = (hex) => {
    const normalized = normalizeHexColor(hex);
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
    };
};

const rgbToHex = (r, g, b) => {
    const channelToHex = (value) => {
        const clamped = clamp(Math.round(value), 0, 255);
        return clamped.toString(16).padStart(2, '0');
    };
    return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase();
};

const mixHex = (a, b, t) => {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const ratio = clamp(t, 0, 1);
    return rgbToHex(
        ca.r + (cb.r - ca.r) * ratio,
        ca.g + (cb.g - ca.g) * ratio,
        ca.b + (cb.b - ca.b) * ratio,
    );
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
    const s = delta <= 1e-6 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    return { h, s, l };
};

const hslToRgb = ({ h, s, l }) => {
    const hue = ((Number(h) % 360) + 360) % 360;
    const sat = clamp(s, 0, 1);
    const light = clamp(l, 0, 1);
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = light - c / 2;

    let rPrime = 0;
    let gPrime = 0;
    let bPrime = 0;
    if (hue < 60) {
        rPrime = c; gPrime = x; bPrime = 0;
    } else if (hue < 120) {
        rPrime = x; gPrime = c; bPrime = 0;
    } else if (hue < 180) {
        rPrime = 0; gPrime = c; bPrime = x;
    } else if (hue < 240) {
        rPrime = 0; gPrime = x; bPrime = c;
    } else if (hue < 300) {
        rPrime = x; gPrime = 0; bPrime = c;
    } else {
        rPrime = c; gPrime = 0; bPrime = x;
    }

    return {
        r: Math.round((rPrime + m) * 255),
        g: Math.round((gPrime + m) * 255),
        b: Math.round((bPrime + m) * 255),
    };
};

const adjustColor = (hex, saturationScale = 1, lightnessScale = 1) => {
    const hsl = rgbToHsl(hexToRgb(hex));
    const next = {
        h: hsl.h,
        s: clamp(hsl.s * saturationScale, 0, 1),
        l: clamp(hsl.l * lightnessScale, 0, 1),
    };
    const rgb = hslToRgb(next);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
};

const hexToRgba = (hex, alpha = 1) => {
    const rgb = hexToRgb(hex);
    const resolvedAlpha = clamp(alpha, 0, 1);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${resolvedAlpha})`;
};

const normalizeWaterClarity = (candidate) => {
    if (candidate === 'algae' || candidate === 'deep') return candidate;
    return 'clear';
};

const resolveWaterPalettePreset = (candidate) => {
    const key = typeof candidate === 'string' ? candidate.trim() : '';
    return WATER_PALETTE_PRESETS[key] || WATER_PALETTE_PRESETS[DEFAULT_WATER_PALETTE_ID];
};

const DEFAULT_WATER_PALETTE_CALIBRATION = Object.freeze({
    saturationScale: 1,
    lightnessScale: 1,
    sheenScale: 1,
});

const DEFAULT_WATER_PALETTE_COMPOSITION = Object.freeze({
    baseBlendWeight: 0.42,
    depthStrengthBias: 0,
    contourDensityBias: 0,
    sedimentAmountBias: 0,
    mineralTint: '#84AFC3',
    mineralStrength: 0.16,
    thermalTint: '#86AB74',
    thermalStrength: 0.12,
});

const resolveWaterPaletteComposition = (composition = null) => {
    const source = composition && typeof composition === 'object'
        ? composition
        : DEFAULT_WATER_PALETTE_COMPOSITION;
    return {
        baseBlendWeight: clamp(
            source.baseBlendWeight,
            0.1,
            0.85,
        ),
        depthStrengthBias: clamp(
            source.depthStrengthBias,
            -0.8,
            0.8,
        ),
        contourDensityBias: clamp(
            source.contourDensityBias,
            -0.8,
            0.8,
        ),
        sedimentAmountBias: clamp(
            source.sedimentAmountBias,
            -0.8,
            0.8,
        ),
        mineralTint: normalizeHexColor(source.mineralTint || DEFAULT_WATER_PALETTE_COMPOSITION.mineralTint),
        mineralStrength: clamp(
            source.mineralStrength,
            0,
            0.65,
        ),
        thermalTint: normalizeHexColor(source.thermalTint || DEFAULT_WATER_PALETTE_COMPOSITION.thermalTint),
        thermalStrength: clamp(
            source.thermalStrength,
            0,
            0.65,
        ),
    };
};

const buildWaterPaletteRenderState = ({
    paletteId,
    waterClarity,
    clarityBlend = 1,
    vignetteStrength = 0.48,
} = {}) => {
    const preset = resolveWaterPalettePreset(paletteId);
    const clarityKey = normalizeWaterClarity(waterClarity);
    const blend = clamp(clarityBlend, 0, 1);
    const calibration = preset.calibration || DEFAULT_WATER_PALETTE_CALIBRATION;
    const composition = resolveWaterPaletteComposition(preset.composition);
    const calibratedSatScale = clamp(calibration.saturationScale, 0.4, 1.4);
    const calibratedLitScale = clamp(calibration.lightnessScale, 0.35, 1.4);
    const calibratedSheenScale = clamp(calibration.sheenScale, 0.4, 1.2);
    const sat = clamp(calibratedSatScale, 0.2, 2.2);
    const lit = clamp(calibratedLitScale, 0.2, 1.8);
    // Palette stops are material pigment for every preset. The live surface
    // pass owns day/night lighting; baking that light here would attenuate the
    // default pond twice and tie its appearance to the React mount's clock.
    const baseSourceStops = preset.clear;
    const targetStops = preset[clarityKey] || preset.clear;

    const gradientStops = baseSourceStops.map((sourceColor, index) => {
        const targetColor = targetStops[index] || sourceColor;
        return adjustColor(
            mixHex(sourceColor, targetColor, blend),
            sat,
            lit,
        );
    });

    const centerColor = gradientStops[0] || '#1C2B35';
    const middleColor = gradientStops[1] || centerColor;
    const edgeColor = gradientStops[2] || middleColor;
    const vignetteOpacity = clamp(0.24 + clamp(vignetteStrength, 0, 1) * 0.62, 0.18, 0.88);
    const sheenStartMix = clamp(0.86 * calibratedSheenScale, 0.4, 0.92);
    const sheenMidMix = clamp(0.68 * calibratedSheenScale, 0.25, 0.84);
    const sheenEndMix = clamp(0.55 * calibratedSheenScale, 0.2, 0.74);
    const sheenStartAlpha = clamp(0.085 * calibratedSheenScale, 0.02, 0.11);
    const sheenEndAlpha = clamp(0.04 * calibratedSheenScale, 0.01, 0.06);

    return Object.freeze({
        presetId: preset.id,
        gradientStops,
        vignetteInner: hexToRgba(mixHex(centerColor, '#000000', 0.18), 0),
        vignetteOuter: hexToRgba(mixHex(edgeColor, '#000000', 0.72), vignetteOpacity),
        sheenStart: hexToRgba(mixHex(centerColor, '#FFFFFF', sheenStartMix), sheenStartAlpha),
        sheenMid: hexToRgba(mixHex(middleColor, '#FFFFFF', sheenMidMix), 0),
        sheenEnd: hexToRgba(mixHex(edgeColor, '#FFFFFF', sheenEndMix), sheenEndAlpha),
        baseBlendWeight: composition.baseBlendWeight,
        depthStrengthBias: composition.depthStrengthBias,
        contourDensityBias: composition.contourDensityBias,
        sedimentAmountBias: composition.sedimentAmountBias,
        mineralTint: composition.mineralTint,
        mineralStrength: composition.mineralStrength,
        thermalTint: composition.thermalTint,
        thermalStrength: composition.thermalStrength,
    });
};

export {
    DEFAULT_WATER_PALETTE_ID,
    WATER_PALETTE_PRESETS,
    WATER_PALETTE_OPTIONS,
    resolveWaterPalettePreset,
    buildWaterPaletteRenderState,
};
