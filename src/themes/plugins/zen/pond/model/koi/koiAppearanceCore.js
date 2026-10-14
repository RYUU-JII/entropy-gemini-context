import { PALETTES, pickElegantPaletteIndexByRatio } from './constants.js';
import {
    DEFAULT_KOI_COLOR_STRATEGY,
    normalizeColorMix,
    normalizeKoiColorStrategy,
    resolveKoiAppearanceVisualProfile,
} from './koiFaviconColorProfile.js';
import { parseHexColorSafe } from './appearance/colorMath.js';
import { createKoiPatternBlueprint } from './koiPatternBlueprint.js';
import { normalizeZenKoiPresentationRole } from './zenKoiPresentationRole.js';

const normalizeBreedMatch = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return null;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id) return null;
    const score = Number(candidate.score);
    return {
        id,
        score: Number.isFinite(score) ? score : 0,
    };
};

const fallbackHashString = (value) => {
    const input = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

function areColorMixesEqual(a, b) {
    if (!Array.isArray(a) && !Array.isArray(b)) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;

    for (let index = 0; index < a.length; index += 1) {
        if (a[index]?.hex !== b[index]?.hex) return false;
        const aw = Number(a[index]?.weight || 0);
        const bw = Number(b[index]?.weight || 0);
        if (Math.abs(aw - bw) > 1e-6) return false;
    }
    return true;
}

export function normalizeKoiAppearanceProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const seedValue = Number(profile.seed);
    const seed = Number.isFinite(seedValue) ? (seedValue >>> 0) : null;
    if (seed === null) return null;

    const paletteIndexValue = Number(profile.paletteIndex);
    const paletteIndex = Number.isFinite(paletteIndexValue)
        ? Math.max(0, Math.floor(paletteIndexValue))
        : null;
    const colorMix = normalizeColorMix(profile.colorMix);
    const appearanceMode = normalizeKoiColorStrategy(
        profile.appearanceMode || DEFAULT_KOI_COLOR_STRATEGY,
    );
    const breedMatch = normalizeBreedMatch(profile.breedMatch);

    return {
        seed,
        paletteIndex,
        colorMix,
        appearanceMode,
        breedMatch,
        presentationRole: normalizeZenKoiPresentationRole(profile.presentationRole),
    };
}

export function areKoiAppearanceProfilesEqual(a, b) {
    const left = normalizeKoiAppearanceProfile(a);
    const right = normalizeKoiAppearanceProfile(b);
    if (!left && !right) return true;
    if (!left || !right) return false;
    if (left.seed !== right.seed) return false;
    if (left.paletteIndex !== right.paletteIndex) return false;
    if (left.presentationRole !== right.presentationRole) return false;
    if (!areColorMixesEqual(left.colorMix, right.colorMix)) return false;
    if (left.appearanceMode !== right.appearanceMode) return false;
    const leftBreed = normalizeBreedMatch(left.breedMatch);
    const rightBreed = normalizeBreedMatch(right.breedMatch);
    if (!leftBreed && !rightBreed) return true;
    if (!leftBreed || !rightBreed) return false;
    if (leftBreed.id !== rightBreed.id) return false;
    return Math.abs(Number(leftBreed.score) - Number(rightBreed.score)) <= 1e-6;
}

export function resolveKoiAppearanceSeed({
    profile = null,
    domain = '',
    statusKey = 'safe',
    flowSeed = 0,
    hashString = null,
    randomFn = Math.random,
} = {}) {
    const normalizedProfile = normalizeKoiAppearanceProfile(profile);
    if (normalizedProfile) {
        return Number(normalizedProfile.seed) >>> 0;
    }
    const hash = typeof hashString === 'function' ? hashString : fallbackHashString;
    const base = domain
        ? hash(`${domain}|${statusKey}`)
        : hash(String(flowSeed));
    const noise = Math.floor((typeof randomFn === 'function' ? randomFn() : Math.random()) * 0xffffff);
    return (base + noise) >>> 0;
}

export function createCanonicalKoiAppearance({
    profile = null,
    seed = 1,
    rng = Math.random,
} = {}) {
    const normalizedProfile = normalizeKoiAppearanceProfile(profile);
    const palettePool = Array.isArray(PALETTES.elegant) ? PALETTES.elegant : [];
    const requestedPaletteIndex = Number(normalizedProfile?.paletteIndex);
    const hasPaletteIndex = Number.isFinite(requestedPaletteIndex);
    const randomPaletteIndex = pickElegantPaletteIndexByRatio(rng());
    const paletteIndex = hasPaletteIndex
        ? Math.max(0, Math.min(palettePool.length - 1, Math.floor(requestedPaletteIndex)))
        : randomPaletteIndex;

    const appearanceMode = normalizeKoiColorStrategy(
        normalizedProfile?.appearanceMode || DEFAULT_KOI_COLOR_STRATEGY,
    );
    const resolvedAppearance = resolveKoiAppearanceVisualProfile({
        colorMix: normalizedProfile?.colorMix,
        strategy: appearanceMode,
        palettePool,
        fallbackPaletteIndex: paletteIndex,
        hintBreedId: normalizedProfile?.breedMatch?.id,
        variationSeed: normalizedProfile?.seed ?? seed,
    });
    const resolvedPaletteIndex = Number.isFinite(Number(resolvedAppearance?.paletteIndex))
        ? Math.max(0, Math.min(palettePool.length - 1, Math.floor(Number(resolvedAppearance.paletteIndex))))
        : paletteIndex;

    const palette = palettePool[resolvedPaletteIndex] || palettePool[paletteIndex] || palettePool[0] || {};
    const colors = resolvedAppearance?.colors || null;
    const scaleType = palette?.scaleType === 'doitsu' ? 'doitsu' : 'wagoi';
    const doitsuMode = scaleType === 'doitsu'
        ? (palette?.doitsuMode || 'mirror')
        : null;
    const isGinrin = Boolean(palette?.ginrin);
    const ginrinDensityRaw = Number(palette?.ginrinDensity);
    const ginrinDensity = Number.isFinite(ginrinDensityRaw)
        ? Math.max(0.4, Math.min(1.6, ginrinDensityRaw))
        : 1;

    let patternStyle = resolvedAppearance?.patternStyleOverride || palette?.style || 'patches';
    if (!resolvedAppearance?.patternStyleOverride) {
        if (colors?.mixCount >= 3) {
            if (patternStyle === 'solid' || patternStyle === 'tancho') {
                patternStyle = 'patches-dual';
            }
        } else if (colors?.mixCount === 2 && patternStyle === 'solid') {
            patternStyle = 'patches';
        }
    }

    const colorSecondary = colors
        ? (colors.secondary || null)
        : (palette.secondary || null);
    const patternBlueprint = createKoiPatternBlueprint({
        patternStyle,
        colorSecondary,
        palette,
        rng,
    });

    return {
        seed: Number(seed) >>> 0,
        variant: 'elegant',
        palette,
        dynamicFaviconColors: colors,
        appearanceResolverMeta: resolvedAppearance || null,
        scaleType,
        doitsuMode,
        isGinrin,
        ginrinDensity,
        colorBody: colors?.body || palette.body,
        colorPattern: colors?.pattern || palette.pattern,
        colorSecondary,
        colorAccent: colors?.accent || palette.accent,
        colorFin: parseHexColorSafe(colors?.fin || palette.fin || '#FFFFFF', '#FFFFFF').hex,
        colorTail: parseHexColorSafe(colors?.fin || palette.fin || '#FFFFFF', '#FFFFFF').hex,
        eyeColor: palette.eye || '#2E2E2E',
        finStyle: 'flowing',
        patternStyle,
        patternMarks: patternBlueprint.marks,
        patternSignature: patternBlueprint.signature,
        patternCandidateCount: patternBlueprint.candidateCount,
        patternBlueprintMeta: {
            version: patternBlueprint.version,
            family: patternBlueprint.family,
            score: patternBlueprint.score,
            selectedCandidateIndex: patternBlueprint.selectedCandidateIndex,
            candidateCount: patternBlueprint.candidateCount,
        },
        resolvedProfile: {
            seed: Number(normalizedProfile?.seed ?? seed) >>> 0,
            paletteIndex: resolvedPaletteIndex,
            colorMix: normalizeColorMix(normalizedProfile?.colorMix),
            appearanceMode,
            breedMatch: normalizeBreedMatch(resolvedAppearance?.breedMatch || normalizedProfile?.breedMatch),
            presentationRole: normalizedProfile?.presentationRole ?? null,
        },
    };
}
