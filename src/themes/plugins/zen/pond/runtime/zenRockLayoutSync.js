import { clamp as clampValue } from '../model/koi/koiMotion.js';
import { HeroRock, getZenRockCollisionRadius as getRockCollisionRadius } from '../world/decor/decorHeroRock.js';
import {
    createZenSeededRandom,
    sampleZenRange,
} from '../../shared/zenSeededRandom.js';

export const ZEN_ROCK_LAYOUT_KEY_PROP = '__zenRockLayoutKey';

const ROCK_LAYOUT_VERSION = 'v1';
const ROCK_VARIANT_WEIGHTS = Object.freeze([
    { id: 'hero', weight: 1.15 },
    { id: 'slab', weight: 1.0 },
    { id: 'flat', weight: 0.92 },
    { id: 'ridge', weight: 0.84 },
    { id: 'cluster', weight: 0.78 },
]);
const ROCK_CENTER_EXCLUSION = Object.freeze({
    xMin: 0.34,
    xMax: 0.66,
    yMin: 0.22,
    yMax: 0.82,
});

const sampleRange = (rng, min, max) => sampleZenRange(rng, min, max);

const pickWeightedVariant = (rng) => {
    let total = 0;
    for (let i = 0; i < ROCK_VARIANT_WEIGHTS.length; i += 1) {
        total += ROCK_VARIANT_WEIGHTS[i].weight;
    }
    const target = rng() * total;
    let cursor = 0;
    for (let i = 0; i < ROCK_VARIANT_WEIGHTS.length; i += 1) {
        const item = ROCK_VARIANT_WEIGHTS[i];
        cursor += item.weight;
        if (target <= cursor) return item.id;
    }
    return ROCK_VARIANT_WEIGHTS[ROCK_VARIANT_WEIGHTS.length - 1].id;
};

export const buildZenRockLayoutKey = ({
    width,
    height,
    tuning,
    qualityProfile,
    rockSeedSalt = 0,
}) => {
    const density = clampValue(Number(tuning?.rockDensity ?? 1), 0, 2).toFixed(2);
    const clusterBias = clampValue(Number(tuning?.rockClusterBias ?? 0.46), 0, 1).toFixed(2);
    const sizeVariance = clampValue(Number(tuning?.rockSizeVariance ?? 1), 0.4, 1.9).toFixed(2);
    const toneVariance = clampValue(Number(tuning?.rockToneVariance ?? 0.8), 0, 2).toFixed(2);
    const qualityDensity = clampValue(Number(qualityProfile?.densityScale ?? 1), 0.2, 2).toFixed(2);
    const seedKey = Math.abs(Math.round(Number(rockSeedSalt) || 0)).toString(36);
    const w = Math.max(1, Math.round(Number(width) / 24));
    const h = Math.max(1, Math.round(Number(height) / 24));
    return `${ROCK_LAYOUT_VERSION}|${w}x${h}|d${density}|c${clusterBias}|s${sizeVariance}|t${toneVariance}|q${qualityDensity}|r${seedKey}`;
};

const isInsideCenterExclusion = (x, y, width, height) => {
    const nx = x / Math.max(1, width);
    const ny = y / Math.max(1, height);
    return (
        nx >= ROCK_CENTER_EXCLUSION.xMin
        && nx <= ROCK_CENTER_EXCLUSION.xMax
        && ny >= ROCK_CENTER_EXCLUSION.yMin
        && ny <= ROCK_CENTER_EXCLUSION.yMax
    );
};

const canPlaceRock = (candidate, rocks, width, height, options = null) => {
    const spacingMultiplier = clampValue(Number(options?.spacingMultiplier ?? 1.04), 0.72, 1.4);
    const edgePadding = clampValue(Number(options?.edgePadding ?? 16), 4, 40);
    const minMargin = clampValue(Number(options?.minMargin ?? 36), 8, 48);
    const enforceCenterExclusion = options?.enforceCenterExclusion !== false;
    const { x, y, size, variant } = candidate;
    const candidateRadius = getRockCollisionRadius(size, variant);
    const margin = Math.max(minMargin, candidateRadius + edgePadding);
    if (x < margin || x > (width - margin) || y < margin || y > (height - margin)) return false;
    if (enforceCenterExclusion && isInsideCenterExclusion(x, y, width, height)) return false;

    for (let i = 0; i < rocks.length; i += 1) {
        const other = rocks[i];
        if (!other) continue;
        const dx = x - (Number(other.x) || 0);
        const dy = y - (Number(other.y) || 0);
        const otherRadius = getRockCollisionRadius(other.size, other.variant);
        const minDist = (candidateRadius + otherRadius) * spacingMultiplier;
        if ((dx * dx) + (dy * dy) < (minDist * minDist)) return false;
    }
    return true;
};

export const buildZenRockLayout = ({
    width,
    height,
    tuning,
    qualityProfile,
    layoutKey,
    entityRandom = null,
}) => {
    if (entityRandom !== null && typeof entityRandom !== 'function') {
        throw new Error('ZEN_ROCK_ENTITY_RANDOM_INVALID');
    }
    const rockRandom = entityRandom === null
        ? createZenSeededRandom(`zen-pond-rock-layout-v1|${layoutKey}`)
        : entityRandom;
    const rng = createZenSeededRandom(layoutKey);
    const density = clampValue(Number(tuning?.rockDensity ?? 1), 0, 2);
    const clusterBias = clampValue(Number(tuning?.rockClusterBias ?? 0.46), 0, 1);
    const sizeVariance = clampValue(Number(tuning?.rockSizeVariance ?? 1), 0.4, 1.9);
    const toneVariance = clampValue(Number(tuning?.rockToneVariance ?? 0.8), 0, 2);
    const qualityDensity = clampValue(Number(qualityProfile?.densityScale ?? 1), 0.2, 2);
    const minDim = Math.max(80, Math.min(width, height));
    const compactPondGain = clampValue((260 - minDim) / 220, 0, 1);

    const areaScale = clampValue(Math.sqrt((width * height) / (920 * 520)), 0.62, 2.2);
    const baseCount = Math.round((1.3 + areaScale * 2.2) * (0.48 + density * 0.96) * (0.72 + qualityDensity * 0.34));
    const rockCount = density <= 0.001 ? 0 : Math.max(1, Math.min(14, baseCount));
    const primarySizeDensityScale = clampValue(1.03 - density * 0.07, 0.86, 1.03);
    const secondarySizeDensityScale = clampValue(1.02 - density * 0.15, 0.72, 1.02);
    const secondarySizeFloor = clampValue(34 + compactPondGain * 12 + density * 3.6, 34, 56);

    const mirrorLeft = rng() < 0.5;
    const anchorX = width * (mirrorLeft ? sampleRange(rng, 0.14, 0.29) : sampleRange(rng, 0.71, 0.86));
    const anchorY = height * sampleRange(rng, 0.34, 0.66);
    const spreadX = width * sampleRange(rng, 0.09, 0.2 + clusterBias * 0.16);
    const spreadY = height * sampleRange(rng, 0.12, 0.2 + clusterBias * 0.1);
    const axis = sampleRange(rng, -Math.PI * 0.24, Math.PI * 0.24) + (mirrorLeft ? 0 : Math.PI);

    const rocks = [];
    for (let i = 0; i < rockCount; i += 1) {
        const isPrimary = i === 0;
        const sizeBase = isPrimary
            ? sampleRange(rng, 112, 178) * primarySizeDensityScale
            : sampleRange(rng, 48, 122)
                * clampValue(0.99 - i * (0.028 + density * 0.007), 0.66, 1.0)
                * secondarySizeDensityScale;
        const size = isPrimary
            ? clampValue(sizeBase * sizeVariance, 92, 232)
            : clampValue(sizeBase * sizeVariance, secondarySizeFloor, 196);
        const variant = isPrimary && rng() < 0.45 ? 'hero' : pickWeightedVariant(rng);
        const depthOffset = (isPrimary ? 0 : 1) * sampleRange(rng, -0.18, 0.24);
        const radial = isPrimary
            ? sampleRange(rng, 0, 0.1)
            : sampleRange(rng, 0.22, 0.96);
        const orbitAngle = axis + sampleRange(rng, -Math.PI * 0.52, Math.PI * 0.52);
        const eccentricX = Math.cos(orbitAngle) * spreadX * radial;
        const eccentricY = Math.sin(orbitAngle) * spreadY * radial + (height * depthOffset * 0.08);
        const jitterX = sampleRange(rng, -18, 18);
        const jitterY = sampleRange(rng, -20, 20);
        const candidate = {
            x: anchorX + eccentricX + jitterX,
            y: anchorY + eccentricY + jitterY,
            size,
            variant,
        };

        let placed = false;
        const strictSpacing = clampValue(1.04 - Math.max(0, density - 0.9) * 0.12, 0.86, 1.04);
        const strictEdgePadding = clampValue(16 - Math.max(0, density - 1.0) * 7, 8, 16);
        const strictCenterExclusion = !(density >= 1.35 && !isPrimary);
        for (let attempt = 0; attempt < 36 && !placed; attempt += 1) {
            if (canPlaceRock(candidate, rocks, width, height, {
                spacingMultiplier: strictSpacing,
                edgePadding: strictEdgePadding,
                minMargin: 18,
                enforceCenterExclusion: strictCenterExclusion,
            })) {
                const toneCenter = 0.5 + (sampleRange(rng, -0.5, 0.5) * toneVariance * 0.38);
                const patternStrength = candidate.variant === 'hero'
                    ? sampleRange(rng, 0.08, 0.24)
                    : (candidate.variant === 'ridge'
                        ? sampleRange(rng, 0.28, 0.6)
                        : sampleRange(rng, 0.12, 0.42));
                const rock = new HeroRock(
                    candidate.x,
                    candidate.y,
                    candidate.size,
                    {
                        random: rockRandom,
                        variant: candidate.variant,
                        shapeSeed: rng() * Math.PI * 2,
                        roughness: clampValue(sampleRange(rng, 0.24, 0.62) * (0.9 + sizeVariance * 0.1), 0.16, 0.9),
                        ridgeStrength: clampValue(sampleRange(rng, 0.08, 0.48), 0, 0.82),
                        edgeChip: clampValue(sampleRange(rng, 0.04, 0.24), 0, 0.48),
                        flattening: clampValue(sampleRange(rng, 0.82, 1.26), 0.62, 1.5),
                        patternStrength,
                        angularity: clampValue(sampleRange(rng, 0.12, 0.48), 0.06, 0.64),
                        chunkiness: clampValue(sampleRange(rng, 0.16, 0.54), 0.08, 0.72),
                        asymmetry: clampValue(sampleRange(rng, 0.04, 0.16), 0, 0.24),
                        tone: clampValue(toneCenter, 0, 1),
                    },
                );
                rocks.push(rock);
                placed = true;
                break;
            }

            const retryAngle = axis + sampleRange(rng, -Math.PI, Math.PI);
            const retryRadius = sampleRange(rng, 0.08, 1);
            candidate.x = anchorX + Math.cos(retryAngle) * spreadX * retryRadius + sampleRange(rng, -14, 14);
            candidate.y = anchorY + Math.sin(retryAngle) * spreadY * retryRadius + sampleRange(rng, -14, 14);
        }

        // High density fallback: try smaller "filler" rocks with relaxed spacing.
        if (!placed && !isPrimary && density > 0.9) {
            for (let attempt = 0; attempt < 34 && !placed; attempt += 1) {
                const relaxedCandidate = {
                    x: sampleRange(rng, width * 0.08, width * 0.92),
                    y: sampleRange(rng, height * 0.08, height * 0.92),
                    size: clampValue(
                        candidate.size * sampleRange(rng, 0.72, 0.9),
                        Math.max(34, secondarySizeFloor * 0.9),
                        108,
                    ),
                    variant: pickWeightedVariant(rng),
                };
                if (!canPlaceRock(relaxedCandidate, rocks, width, height, {
                    spacingMultiplier: 0.78,
                    edgePadding: 5,
                    minMargin: 10,
                    enforceCenterExclusion: density < 1.55,
                })) {
                    continue;
                }

                const toneCenter = 0.5 + (sampleRange(rng, -0.5, 0.5) * toneVariance * 0.34);
                const fillerRock = new HeroRock(
                    relaxedCandidate.x,
                    relaxedCandidate.y,
                    relaxedCandidate.size,
                    {
                        random: rockRandom,
                        variant: relaxedCandidate.variant,
                        shapeSeed: rng() * Math.PI * 2,
                        roughness: clampValue(sampleRange(rng, 0.22, 0.56), 0.16, 0.88),
                        ridgeStrength: clampValue(sampleRange(rng, 0.06, 0.4), 0, 0.72),
                        edgeChip: clampValue(sampleRange(rng, 0.04, 0.2), 0, 0.42),
                        flattening: clampValue(sampleRange(rng, 0.86, 1.22), 0.62, 1.5),
                        patternStrength: clampValue(sampleRange(rng, 0.08, 0.34), 0.02, 0.62),
                        angularity: clampValue(sampleRange(rng, 0.1, 0.4), 0.06, 0.56),
                        chunkiness: clampValue(sampleRange(rng, 0.14, 0.46), 0.08, 0.66),
                        asymmetry: clampValue(sampleRange(rng, 0.03, 0.13), 0, 0.2),
                        tone: clampValue(toneCenter, 0, 1),
                    },
                );
                rocks.push(fillerRock);
                placed = true;
            }
        }
    }

    const hasHeroScaleRock = rocks.some((rock) => (Number(rock?.size) || 0) >= 118);
    if (density > 0.001 && !hasHeroScaleRock) {
        if (rocks.length === 0) {
            const fallbackX = clampValue(anchorX, width * 0.12, width * 0.88);
            const fallbackY = clampValue(anchorY, height * 0.2, height * 0.8);
            rocks.push(new HeroRock(fallbackX, fallbackY, 132, {
                random: rockRandom,
                variant: 'hero',
                patternStrength: 0.14,
            }));
        } else {
            let largestIndex = 0;
            for (let i = 1; i < rocks.length; i += 1) {
                if ((Number(rocks[i]?.size) || 0) > (Number(rocks[largestIndex]?.size) || 0)) {
                    largestIndex = i;
                }
            }
            const baseRock = rocks[largestIndex];
            const heroSize = Math.max(132, Number(baseRock?.size) || 132);
            rocks[largestIndex] = new HeroRock(
                Number(baseRock?.x) || anchorX,
                Number(baseRock?.y) || anchorY,
                heroSize,
                {
                    random: rockRandom,
                    variant: 'hero',
                    patternStrength: 0.14,
                    angularity: 0.24,
                    chunkiness: 0.28,
                    asymmetry: 0.08,
                    tone: clampValue(Number(baseRock?.tone ?? 0.5), 0, 1),
                    shapeSeed: rng() * Math.PI * 2,
                },
            );
        }
    }
    rocks[ZEN_ROCK_LAYOUT_KEY_PROP] = layoutKey;
    return rocks;
};
