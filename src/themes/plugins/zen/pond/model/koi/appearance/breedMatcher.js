import {
    clamp,
    deltaE76,
    rgbToHsl,
    hexToRgb,
    isAchromaticHex,
    isDarkHex,
    isLightHex,
} from './colorMath.js';
import { normalizeColorMix } from './faviconPaletteExtractor.js';
import { getKoiBreedCatalog } from './breedCatalog.js';

const getRoleColors = (entry) => {
    const list = [
        entry?.colors?.body,
        entry?.colors?.pattern,
        entry?.colors?.secondary,
        entry?.colors?.accent,
    ].filter(Boolean);
    return [...new Set(list)];
};

const calcWeightedSetDistance = (mix, roleColors) => {
    const fallback = 80;
    let weightedDelta = 0;
    mix.forEach((entry) => {
        let best = Number.POSITIVE_INFINITY;
        roleColors.forEach((hex) => {
            const delta = deltaE76(entry.hex, hex);
            if (delta < best) best = delta;
        });
        const resolved = Number.isFinite(best) ? best : fallback;
        weightedDelta += resolved * entry.weight;
    });
    return weightedDelta;
};

const estimatePaletteAchromaticWeight = (entry) => {
    const style = String(entry?.style || '');
    const bodyWeight = style === 'solid' ? 0.9 : 0.5;
    const patternWeight = entry?.colors?.pattern ? (entry?.colors?.secondary ? 0.3 : 0.4) : 0;
    const secondaryWeight = entry?.colors?.secondary ? 0.2 : 0;
    const total = bodyWeight + patternWeight + secondaryWeight || 1;

    let weight = 0;
    if (entry?.colors?.body && isAchromaticHex(entry.colors.body)) weight += bodyWeight;
    if (entry?.colors?.pattern && isAchromaticHex(entry.colors.pattern)) weight += patternWeight;
    if (entry?.colors?.secondary && isAchromaticHex(entry.colors.secondary)) weight += secondaryWeight;
    return weight / total;
};

const hasRedLike = (hex) => {
    const { h, s, l } = rgbToHsl(hexToRgb(hex));
    const isRedHue = h <= 30 || h >= 345;
    return isRedHue && s >= 0.35 && l >= 0.15 && l <= 0.85;
};

const getMixSignature = (mix) => {
    const achromaticWeight = mix
        .filter((entry) => isAchromaticHex(entry.hex))
        .reduce((sum, entry) => sum + entry.weight, 0);
    const blackWeight = mix
        .filter((entry) => isDarkHex(entry.hex))
        .reduce((sum, entry) => sum + entry.weight, 0);
    const whiteWeight = mix
        .filter((entry) => isLightHex(entry.hex))
        .reduce((sum, entry) => sum + entry.weight, 0);
    const redWeight = mix
        .filter((entry) => hasRedLike(entry.hex))
        .reduce((sum, entry) => sum + entry.weight, 0);

    return {
        achromaticWeight,
        blackWeight,
        whiteWeight,
        redWeight,
    };
};

const getPaletteSignature = (entry) => {
    const roleColors = getRoleColors(entry);
    const achromatic = roleColors.filter((hex) => isAchromaticHex(hex)).length / Math.max(1, roleColors.length);
    const black = roleColors.some((hex) => isDarkHex(hex)) ? 1 : 0;
    const white = roleColors.some((hex) => isLightHex(hex)) ? 1 : 0;
    const red = roleColors.some((hex) => hasRedLike(hex)) ? 1 : 0;
    return {
        achromaticWeight: achromatic,
        blackWeight: black,
        whiteWeight: white,
        redWeight: red,
    };
};

const calcStyleCompatibility = (entry, mixCount) => {
    const style = String(entry?.style || '');
    if (mixCount >= 3) {
        if (
            style === 'patches-dual'
            || style === 'patches-spots'
            || style === 'tancho-spots'
            || style === 'tancho-dual'
            || style === 'checkered'
        ) return 1;
        return 0.72;
    }

    if (style === 'solid') return 0.6;
    if (style === 'patches' || style === 'patches-bold' || style === 'tancho') return 1;
    if (style === 'spots') return 0.9;
    return 0.82;
};

const scoreBreedEntry = (entry, mix, { hintBreedId = null } = {}) => {
    const roleColors = getRoleColors(entry);
    if (!roleColors.length) return 0;

    const weightedDelta = calcWeightedSetDistance(mix, roleColors);
    const colorScore = clamp(1 - (weightedDelta / 88), 0, 1);
    const mixCountScore = clamp(1 - (Math.abs(mix.length - roleColors.length) / 3), 0, 1);
    const styleScore = calcStyleCompatibility(entry, mix.length);

    const mixSig = getMixSignature(mix);
    const paletteSig = getPaletteSignature(entry);
    const achromaticDistance = Math.abs(mixSig.achromaticWeight - estimatePaletteAchromaticWeight(entry));
    const achromaticScore = clamp(1 - achromaticDistance, 0, 1);

    let score = (0.68 * colorScore) + (0.12 * mixCountScore) + (0.12 * achromaticScore) + (0.08 * styleScore);

    if ((mixSig.blackWeight >= 0.16) === (paletteSig.blackWeight > 0.5)) {
        score += 0.03;
    } else {
        score -= 0.03;
    }

    if ((mixSig.whiteWeight >= 0.16) === (paletteSig.whiteWeight > 0.5)) {
        score += 0.03;
    } else {
        score -= 0.025;
    }

    if ((mixSig.redWeight >= 0.22) === (paletteSig.redWeight > 0.5)) {
        score += 0.04;
    } else if (mixSig.redWeight >= 0.22 || paletteSig.redWeight > 0.5) {
        score -= 0.03;
    }

    if (hintBreedId && entry.id === hintBreedId) {
        score += 0.02;
    }

    return clamp(score, 0, 1);
};

const matchKoiBreedFromColorMix = (candidate, options = {}) => {
    const mix = normalizeColorMix(candidate);
    if (!mix) return null;

    const catalog = getKoiBreedCatalog(options.palettePool);
    if (!catalog.length) return null;

    const scored = catalog
        .map((entry) => ({
            ...entry,
            score: scoreBreedEntry(entry, mix, options),
        }))
        .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) return null;

    return {
        id: best.id,
        index: best.index,
        name: best.name,
        style: best.style,
        score: best.score,
        palette: best.palette,
        topMatches: scored.slice(0, 3).map((entry) => ({
            id: entry.id,
            index: entry.index,
            score: entry.score,
        })),
    };
};

export {
    matchKoiBreedFromColorMix,
};
