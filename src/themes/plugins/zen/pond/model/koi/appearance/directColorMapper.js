import {
    clamp,
    rgbToHsl,
    hslToRgb,
    hexToRgb,
    rgbToHex,
    mixHex,
    luma,
} from './colorMath.js';
import { normalizeColorMix } from './faviconPaletteExtractor.js';

const ensureContrast = (bodyColor, detailColor) => {
    if (!detailColor) return detailColor;
    const bodyLuma = luma(bodyColor);
    const detailLuma = luma(detailColor);
    if (Math.abs(bodyLuma - detailLuma) >= 0.2) {
        return detailColor;
    }

    const detailHsl = rgbToHsl(hexToRgb(detailColor));
    detailHsl.l = bodyLuma > 0.55
        ? clamp(detailHsl.l - 0.28, 0.08, 0.7)
        : clamp(detailHsl.l + 0.28, 0.28, 0.94);
    return rgbToHex(hslToRgb(detailHsl));
};

const tuneRoleColorAggressive = (hex, role) => {
    const hsl = rgbToHsl(hexToRgb(hex));
    const next = { ...hsl };
    const isAchromatic = next.s <= 0.14;

    if (role === 'body') {
        if (isAchromatic) {
            next.s = clamp(next.s, 0, 0.09);
            next.l = clamp(next.l, 0.04, 0.96);
        } else {
            next.s = clamp(next.s, 0.45, 1);
            next.l = clamp(next.l, 0.16, 0.84);
        }
    } else if (role === 'pattern') {
        if (isAchromatic) {
            next.s = clamp(next.s, 0, 0.09);
            next.l = clamp(next.l, 0.03, 0.97);
        } else {
            next.s = clamp(next.s, 0.4, 1);
            next.l = clamp(next.l, 0.12, 0.88);
        }
    } else if (role === 'secondary') {
        if (isAchromatic) {
            next.s = clamp(next.s, 0, 0.11);
            next.l = clamp(next.l, 0.04, 0.92);
        } else {
            next.s = clamp(next.s, 0.36, 1);
            next.l = clamp(next.l, 0.1, 0.78);
        }
    } else if (role === 'accent') {
        if (isAchromatic) {
            next.s = clamp(next.s, 0, 0.13);
            next.l = clamp(next.l, 0.05, 0.88);
        } else {
            next.s = clamp(next.s, 0.35, 1);
            next.l = clamp(next.l, 0.08, 0.72);
        }
    }

    return rgbToHex(hslToRgb(next));
};

const buildDirectKoiColorsFromColorMix = (candidate) => {
    const mix = normalizeColorMix(candidate);
    if (!mix) return null;

    const bodyBase = tuneRoleColorAggressive(mix[0].hex, 'body');
    const patternBase = ensureContrast(bodyBase, tuneRoleColorAggressive(mix[1].hex, 'pattern'));
    const secondaryBase = mix.length >= 3
        ? ensureContrast(bodyBase, tuneRoleColorAggressive(mix[2].hex, 'secondary'))
        : null;
    const accentBase = tuneRoleColorAggressive((mix.length >= 3 ? mix[2].hex : mix[1].hex), 'accent');
    const supportWeight = clamp(Number(mix[1]?.weight || 0), 0, 1);
    const finPatternBlend = clamp(0.03 + (supportWeight * 0.04), 0.03, 0.08);
    const tailPatternBlend = clamp(finPatternBlend + 0.04, 0.07, 0.14);

    return Object.freeze({
        mix,
        mixCount: mix.length,
        body: bodyBase,
        pattern: patternBase,
        secondary: secondaryBase,
        accent: ensureContrast(bodyBase, accentBase),
        fin: mixHex(bodyBase, patternBase, finPatternBlend),
        tail: mixHex(bodyBase, patternBase, tailPatternBlend),
    });
};

export {
    buildDirectKoiColorsFromColorMix,
};
