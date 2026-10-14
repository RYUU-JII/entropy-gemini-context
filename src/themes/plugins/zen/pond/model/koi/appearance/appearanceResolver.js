import { PALETTES } from '../constants.js';
import {
    clamp,
    mixHex,
    luma,
    hexToRgb,
    parseHexColorSafe,
    colorDistanceRgb,
    rgbToHsl,
    isAchromaticHex,
} from './colorMath.js';
import { normalizeColorMix, hashColorMix } from './faviconPaletteExtractor.js';
import { buildDirectKoiColorsFromColorMix } from './directColorMapper.js';
import { matchKoiBreedFromColorMix } from './breedMatcher.js';

const KOI_APPEARANCE_RESOLVER_VERSION = 'koi_appearance_v1';
const KOI_COLOR_STRATEGIES = Object.freeze({
    OFF: 'off',
    DIRECT: 'direct',
    HYBRID: 'hybrid',
    BREED: 'breed',
});
const DEFAULT_KOI_COLOR_STRATEGY = KOI_COLOR_STRATEGIES.HYBRID;

const normalizeKoiColorStrategy = (candidate) => {
    const value = String(candidate || DEFAULT_KOI_COLOR_STRATEGY).trim().toLowerCase();
    if (value === KOI_COLOR_STRATEGIES.OFF) return KOI_COLOR_STRATEGIES.OFF;
    if (value === KOI_COLOR_STRATEGIES.DIRECT) return KOI_COLOR_STRATEGIES.DIRECT;
    if (value === KOI_COLOR_STRATEGIES.BREED) return KOI_COLOR_STRATEGIES.BREED;
    return KOI_COLOR_STRATEGIES.HYBRID;
};

const ensurePaletteIndex = (candidate, palettePool) => {
    const pool = Array.isArray(palettePool) ? palettePool : [];
    if (!pool.length) return 0;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(pool.length - 1, Math.floor(parsed)));
};

const buildPaletteDrivenColors = (palette) => {
    if (!palette) return null;
    const body = palette.body;
    const pattern = palette.pattern || palette.accent || body;
    const secondary = palette.secondary || null;
    const accent = palette.accent || pattern;
    const fin = palette.fin || body;
    const tail = palette.tail || fin;
    return {
        body,
        pattern,
        secondary,
        accent,
        fin,
        tail,
    };
};

const resolveBodyBlendWeight = (baseWeight, mix) => {
    const weight = clamp(baseWeight, 0, 1);
    const dominantWeight = clamp(Number(mix?.[0]?.weight || 0), 0, 1);
    const dominantHex = mix?.[0]?.hex || null;
    if (dominantWeight < 0.72 || !dominantHex || isAchromaticHex(dominantHex, 0.16)) {
        return weight;
    }
    const damp = clamp(0.68 - ((dominantWeight - 0.72) * 1.25), 0.32, 0.68);
    return clamp(weight * damp, 0.05, weight);
};

const blendColorRoles = (directColors, breedColors, breedWeight, mix = null) => {
    if (!directColors && !breedColors) return null;
    if (!directColors) return breedColors;
    if (!breedColors) return directColors;
    const w = clamp(breedWeight, 0, 1);
    const merge = (key) => {
        const directHex = directColors[key];
        const breedHex = breedColors[key];
        if (!directHex && !breedHex) return null;
        if (!directHex) return breedHex;
        if (!breedHex) return directHex;
        const roleWeight = key === 'body'
            ? resolveBodyBlendWeight(w, mix)
            : w;
        return mixHex(directHex, breedHex, roleWeight);
    };

    return {
        body: merge('body'),
        pattern: merge('pattern'),
        secondary: merge('secondary'),
        accent: merge('accent'),
        fin: merge('fin'),
        tail: merge('tail'),
    };
};

const alignDirectColorsToBreedPattern = (directColors, breedColors, mix = null) => {
    if (!directColors || !breedColors) return directColors || breedColors || null;
    const next = { ...directColors };
    if (!next.body || !next.pattern || !breedColors.body || !breedColors.pattern) {
        return next;
    }

    const dominantWeight = clamp(Number(mix?.[0]?.weight || 0), 0, 1);
    const dominantHex = mix?.[0]?.hex || null;
    const supportHex = mix?.[1]?.hex || null;
    if (dominantWeight >= 0.68) return next;
    if (
        dominantHex
        && supportHex
        && !isAchromaticHex(dominantHex, 0.14)
        && isAchromaticHex(supportHex, 0.18)
    ) {
        return next;
    }

    const paletteBodyLuma = luma(breedColors.body);
    const palettePatternLuma = luma(breedColors.pattern);
    const directBodyLuma = luma(next.body);
    const directPatternLuma = luma(next.pattern);

    const paletteBodyIsLighter = paletteBodyLuma >= palettePatternLuma;
    const directBodyIsLighter = directBodyLuma >= directPatternLuma;
    if (paletteBodyIsLighter === directBodyIsLighter) return next;

    next.body = directColors.pattern;
    next.pattern = directColors.body;
    return next;
};

const hashSliceToUnit = (hash, offset = 0) => {
    const normalized = typeof hash === 'string'
        ? hash.trim().toLowerCase()
        : '';
    if (!/^[0-9a-f]{8}$/.test(normalized)) return 0;
    const start = ((Math.floor(offset) % 6) + 6) % 6;
    const slice = normalized.slice(start, start + 2);
    const value = Number.parseInt(slice, 16);
    return Number.isFinite(value) ? (value / 255) : 0;
};

const seedToUnit = (seed, mix, offset = 0) => {
    const numericSeed = Number(seed);
    if (Number.isFinite(numericSeed)) {
        const seed32 = (numericSeed >>> 0);
        const salt = (Math.floor(offset) >>> 0) * 2654435761;
        const mixed = (Math.imul(seed32 ^ salt, 1664525) + 1013904223) >>> 0;
        return mixed / 4294967295;
    }
    return hashSliceToUnit(hashColorMix(mix), offset);
};

const isWarmRedHex = (hex) => {
    if (!hex) return false;
    const { h, s, l } = rgbToHsl(hexToRgb(hex));
    const isRedHue = h <= 26 || h >= 346;
    return isRedHue && s >= 0.34 && l >= 0.14 && l <= 0.86;
};

const applyRedVariant = (colors, mix, breedMatch, variationSeed = null) => {
    if (!colors || !mix || !mix.length) return colors || null;
    const dominantHex = mix?.[0]?.hex || null;
    const dominantWeight = clamp(Number(mix?.[0]?.weight || 0), 0, 1);
    if (!dominantHex || dominantWeight < 0.58 || !isWarmRedHex(dominantHex)) {
        return colors;
    }

    const breedId = String(breedMatch?.id || '');
    const isRedLineage = /(kohaku|sanke|showa|tancho|aka_bekko|benigoi|goromo|goshiki)/.test(breedId);
    const chance = clamp(
        (isRedLineage ? 0.18 : 0.1) + ((dominantWeight - 0.6) * 0.5),
        0.08,
        0.42,
    );
    const roll = seedToUnit(variationSeed, mix, 9);
    if (roll > chance) return colors;

    const redTarget = '#D80E20';
    const darkRedTarget = '#B30B17';
    const boost = clamp(0.12 + (seedToUnit(variationSeed, mix, 13) * 0.18), 0.12, 0.3);
    const patternBase = colors.pattern || dominantHex;
    const accentBase = colors.accent || patternBase;
    const bodyBase = colors.body || dominantHex;

    return {
        ...colors,
        body: isWarmRedHex(bodyBase)
            ? mixHex(bodyBase, redTarget, boost * 0.28)
            : bodyBase,
        pattern: mixHex(patternBase, redTarget, boost),
        accent: mixHex(accentBase, darkRedTarget, boost * 0.66),
    };
};

const applyFinTailBodyBias = (colors, mix, mode) => {
    if (!colors || !colors.body) return colors || null;
    const body = colors.body;
    const pattern = colors.pattern || colors.accent || body;
    if (!pattern) return { ...colors };

    const colorSeparation = clamp(
        colorDistanceRgb(hexToRgb(body), hexToRgb(pattern)) / 180,
        0,
        1,
    );
    const bodyLuma = luma(body);
    const bodyAchromatic = isAchromaticHex(body, 0.16);
    const patternAchromatic = isAchromaticHex(pattern, 0.16);
    const supportWeight = clamp(Number(mix?.[1]?.weight || 0), 0, 1);
    const roll = hashSliceToUnit(hashColorMix(mix), 2);
    const rareLift = roll >= 0.94 ? 0.03 : 0;
    const modeBias = mode === KOI_COLOR_STRATEGIES.BREED
        ? 0.006
        : (mode === KOI_COLOR_STRATEGIES.HYBRID ? 0.004 : 0);
    let basePatternBlend = (0.008 + (supportWeight * 0.028) + modeBias + rareLift) * colorSeparation;
    if (supportWeight < 0.2) {
        basePatternBlend *= 0.55;
    }
    if (bodyAchromatic && !patternAchromatic) {
        if (bodyLuma >= 0.78) basePatternBlend *= 0.28;
        else if (bodyLuma <= 0.22) basePatternBlend *= 0.42;
    }
    const patternBlendFin = clamp(
        basePatternBlend,
        0,
        0.12,
    );
    const patternBlendTail = clamp(patternBlendFin + 0.015, 0.005, 0.16);
    const finSource = colors.fin || body;
    const tailSource = colors.tail || finSource || body;
    const bodyAnchoredFin = mixHex(body, finSource, bodyAchromatic ? 0.04 : 0.1);
    const tailAnchorSource = bodyAchromatic ? finSource : tailSource;
    const bodyAnchoredTail = mixHex(body, tailAnchorSource, bodyAchromatic ? 0.06 : 0.16);

    return {
        ...colors,
        fin: mixHex(bodyAnchoredFin, pattern, patternBlendFin),
        tail: mixHex(bodyAnchoredTail, pattern, patternBlendTail),
    };
};

const buildResolverResult = ({
    strategy,
    mode,
    mix,
    fallbackPaletteIndex,
    directColors,
    paletteIndex = fallbackPaletteIndex,
    patternStyleOverride = null,
    breedMatch = null,
    colors = directColors,
    variationSeed = null,
    enforceFinTailColorParity = true,
}) => {
    const normalizedMix = normalizeColorMix(mix);
    const variedColors = applyRedVariant(colors || null, normalizedMix, breedMatch, variationSeed);
    const finTailBiasedColors = applyFinTailBodyBias(variedColors || null, normalizedMix, mode);
    let normalizedColors = finTailBiasedColors;
    if (enforceFinTailColorParity && finTailBiasedColors) {
        const syncedFin = parseHexColorSafe(
            finTailBiasedColors.fin,
            finTailBiasedColors.body || '#FFFFFF',
        ).hex;
        normalizedColors = {
            ...finTailBiasedColors,
            fin: syncedFin,
            tail: syncedFin,
        };
    }
    return Object.freeze({
        strategy: normalizeKoiColorStrategy(strategy),
        mode,
        confidence: clamp(Number(breedMatch?.score || 0), 0, 1),
        paletteIndex,
        patternStyleOverride,
        mix: normalizedMix,
        mixCount: normalizedMix?.length || 0,
        colors: normalizedColors,
        breedMatch: breedMatch
            ? Object.freeze({
                id: breedMatch.id,
                score: clamp(Number(breedMatch.score || 0), 0, 1),
                algoVersion: KOI_APPEARANCE_RESOLVER_VERSION,
            })
            : null,
        colorMixHash: hashColorMix(normalizedMix),
        resolverVersion: KOI_APPEARANCE_RESOLVER_VERSION,
    });
};

const resolveKoiAppearanceVisualProfile = ({
    colorMix,
    strategy = DEFAULT_KOI_COLOR_STRATEGY,
    palettePool = PALETTES.elegant,
    fallbackPaletteIndex = 0,
    hintBreedId = null,
    variationSeed = null,
} = {}) => {
    const normalizedStrategy = normalizeKoiColorStrategy(strategy);
    const mix = normalizeColorMix(colorMix);
    const directColors = buildDirectKoiColorsFromColorMix(mix);
    const resolvedFallbackPaletteIndex = ensurePaletteIndex(fallbackPaletteIndex, palettePool);

    if (!mix || !directColors || normalizedStrategy === KOI_COLOR_STRATEGIES.OFF) {
        return buildResolverResult({
            strategy: normalizedStrategy,
            mode: KOI_COLOR_STRATEGIES.OFF,
            mix,
            fallbackPaletteIndex: resolvedFallbackPaletteIndex,
            directColors: null,
            colors: null,
            paletteIndex: resolvedFallbackPaletteIndex,
            variationSeed,
        });
    }

    const breedMatch = matchKoiBreedFromColorMix(mix, {
        palettePool,
        hintBreedId,
    });
    const breedPaletteIndex = ensurePaletteIndex(breedMatch?.index, palettePool);
    const breedPalette = Array.isArray(palettePool) ? palettePool[breedPaletteIndex] : null;
    const breedColors = buildPaletteDrivenColors(breedPalette);
    const breedScore = clamp(Number(breedMatch?.score || 0), 0, 1);
    const alignedDirectColors = alignDirectColorsToBreedPattern(directColors, breedColors, mix);

    const HIGH_CONFIDENCE = 0.82;
    const MID_CONFIDENCE = 0.62;

    if (normalizedStrategy === KOI_COLOR_STRATEGIES.DIRECT || !breedMatch) {
        return buildResolverResult({
            strategy: normalizedStrategy,
            mode: KOI_COLOR_STRATEGIES.DIRECT,
            mix,
            fallbackPaletteIndex: resolvedFallbackPaletteIndex,
            directColors,
            colors: directColors,
            paletteIndex: resolvedFallbackPaletteIndex,
            breedMatch,
            variationSeed,
        });
    }

    if (normalizedStrategy === KOI_COLOR_STRATEGIES.BREED) {
        if (breedScore < MID_CONFIDENCE) {
            return buildResolverResult({
                strategy: normalizedStrategy,
                mode: KOI_COLOR_STRATEGIES.DIRECT,
                mix,
                fallbackPaletteIndex: resolvedFallbackPaletteIndex,
                directColors,
                colors: directColors,
                paletteIndex: resolvedFallbackPaletteIndex,
                breedMatch,
                variationSeed,
            });
        }
        return buildResolverResult({
            strategy: normalizedStrategy,
            mode: KOI_COLOR_STRATEGIES.BREED,
            mix,
            fallbackPaletteIndex: resolvedFallbackPaletteIndex,
            directColors,
            colors: blendColorRoles(alignedDirectColors, breedColors, 0.55, mix),
            paletteIndex: breedPaletteIndex,
            patternStyleOverride: breedPalette?.style || null,
            breedMatch,
            variationSeed,
        });
    }

    if (breedScore >= HIGH_CONFIDENCE) {
        const blendWeight = 0.38;
        return buildResolverResult({
            strategy: normalizedStrategy,
            mode: KOI_COLOR_STRATEGIES.BREED,
            mix,
            fallbackPaletteIndex: resolvedFallbackPaletteIndex,
            directColors,
            colors: blendColorRoles(alignedDirectColors, breedColors, blendWeight, mix),
            paletteIndex: breedPaletteIndex,
            patternStyleOverride: breedPalette?.style || null,
            breedMatch,
            variationSeed,
        });
    }

    if (breedScore >= MID_CONFIDENCE) {
        const scoreRatio = (breedScore - MID_CONFIDENCE) / (HIGH_CONFIDENCE - MID_CONFIDENCE);
        const blendWeight = clamp(0.2 + (scoreRatio * 0.18), 0.2, 0.38);
        return buildResolverResult({
            strategy: normalizedStrategy,
            mode: KOI_COLOR_STRATEGIES.HYBRID,
            mix,
            fallbackPaletteIndex: resolvedFallbackPaletteIndex,
            directColors,
            colors: blendColorRoles(alignedDirectColors, breedColors, blendWeight, mix),
            paletteIndex: breedPaletteIndex,
            patternStyleOverride: breedPalette?.style || null,
            breedMatch,
            variationSeed,
        });
    }

    return buildResolverResult({
        strategy: normalizedStrategy,
        mode: KOI_COLOR_STRATEGIES.DIRECT,
        mix,
        fallbackPaletteIndex: resolvedFallbackPaletteIndex,
        directColors,
        colors: directColors,
        paletteIndex: resolvedFallbackPaletteIndex,
        breedMatch,
        variationSeed,
    });
};

export {
    KOI_APPEARANCE_RESOLVER_VERSION,
    KOI_COLOR_STRATEGIES,
    DEFAULT_KOI_COLOR_STRATEGY,
    normalizeKoiColorStrategy,
    resolveKoiAppearanceVisualProfile,
};
