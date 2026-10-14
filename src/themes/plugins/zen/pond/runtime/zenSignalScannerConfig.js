import {
    ZEN_QUALITY_MODES,
    normalizeZenQualityMode,
    resolveZenMainTargetFps,
    ZEN_GRAPHICS_BUDGETS,
} from '../../runtime/zenRenderQuality.js';
import { clamp as clampValue } from '../model/koi/koiMotion.js';
import { LilyPad } from '../world/decor/decorLilyPad.js';
import { WaterLilyBloom } from '../world/decor/decorWaterLilyBloom.js';
import { ZenIrisCluster } from '../world/decor/decorZenIrisCluster.js';
import {
    createZenSeededRandom,
    pickZenIndex,
} from '../../shared/zenSeededRandom.js';

const TAU = Math.PI * 2;
const ZEN_IRIS_CLUSTER_GENERATION_ENABLED = false;
const DEFAULT_IRIS_DENSITY = 0;

const CANONICAL_QUALITY_PROFILE = Object.freeze({
    simHz: 60,
    maxCatchUpSteps: 12,
    densityScale: 1,
    maxSurfaceDisturbances: 12,
    surfaceFieldLongEdge: 384,
    rainRippleBudget: 36,
    maxGlimmers: 24,
    glimmerDensityScale: 1.5,
    glimmerCleanupEveryFrames: 100,
    effectIntensityScale: 1,
    cadenceTier: 'canonical',
    enableGinrinSparkle: false,
    ginrinSparkleScale: 0,
    fishShadowEnabled: true,
    fishShadowBlur: 3,
    fishShadowCadence: 2,
    fishShadowOpacity: 0.22,
    fishShadowScale: 0.9,
    fishShadowIncludeFins: true,
});

const createQualityProfile = (qualityMode, overrides = null) => Object.freeze({
    qualityMode,
    ...CANONICAL_QUALITY_PROFILE,
    targetFps: resolveZenMainTargetFps(qualityMode),
    dprCap: ZEN_GRAPHICS_BUDGETS[qualityMode].pixelRatioCap,
    renderPixelBudget: ZEN_GRAPHICS_BUDGETS[qualityMode].maxRenderPixels,
    waterSurfaceResolutionScale: ZEN_GRAPHICS_BUDGETS[qualityMode].waterSurfaceResolutionScale,
    ...(overrides && typeof overrides === 'object' ? overrides : {}),
});

const QUALITY_PROFILES = Object.freeze({
    [ZEN_QUALITY_MODES.LOW]: createQualityProfile(ZEN_QUALITY_MODES.LOW, {
        maxSurfaceDisturbances: 8,
        surfaceFieldLongEdge: 256,
        rainRippleBudget: 16,
        maxGlimmers: 12,
        glimmerDensityScale: 0.9,
        glimmerCleanupEveryFrames: 120,
        cadenceTier: 'low',
    }),
    [ZEN_QUALITY_MODES.BALANCED]: createQualityProfile(ZEN_QUALITY_MODES.BALANCED, {
        maxSurfaceDisturbances: 10,
        surfaceFieldLongEdge: 320,
        rainRippleBudget: 24,
        maxGlimmers: 18,
        glimmerDensityScale: 1.15,
        glimmerCleanupEveryFrames: 110,
        cadenceTier: 'balanced',
    }),
    [ZEN_QUALITY_MODES.FULL]: createQualityProfile(ZEN_QUALITY_MODES.FULL),
});

const DEFAULT_QUALITY_PROFILE = QUALITY_PROFILES[ZEN_QUALITY_MODES.FULL];

const resolveQualityMode = (qualityMode = ZEN_QUALITY_MODES.FULL) => (
    normalizeZenQualityMode(qualityMode, ZEN_QUALITY_MODES.FULL)
);

const scaleCount = (count, scale, minimum = 0) => {
    const numeric = Number(count);
    const base = Number.isFinite(numeric) ? numeric : minimum;
    return Math.max(minimum, Math.round(base * scale));
};

const buildStaticLayoutSeedKey = ({
    sceneGenerationKey = '',
    width,
    height,
    count,
    flowerChance = 0.65,
    scope = 'layout',
} = {}) => (
    [
        'zen_static_layout_v1',
        scope,
        typeof sceneGenerationKey === 'string' ? sceneGenerationKey.trim() : '',
        Math.max(1, Math.round(Number(width) || 0)),
        Math.max(1, Math.round(Number(height) || 0)),
        Math.max(0, Math.floor(Number(count) || 0)),
        clampValue(Number(flowerChance), 0, 1, 0.65).toFixed(3),
    ].join('|')
);

const pickFromList = (rng, items = []) => items[pickZenIndex(rng, items.length)] || null;

const isIrisPlacementValid = (candidateIris, existingIrises, lilyPads) => {
    const cX = Number(candidateIris.x) || 0;
    const cY = Number(candidateIris.y) || 0;
    const cSize = Math.max(8, Number(candidateIris.size) || 18);

    for (let i = 0; i < existingIrises.length; i += 1) {
        const other = existingIrises[i];
        if (!other) continue;
        const oX = Number(other.x) || 0;
        const oY = Number(other.y) || 0;
        const oSize = Math.max(8, Number(other.size) || 18);
        if (Math.hypot(cX - oX, cY - oY) < (cSize + oSize) * 0.92) {
            return false;
        }
    }

    return !isPointInsideAnyPad(cX, cY, lilyPads, 0.015);
};

// Share of placement attempts that grow off an existing pad rather than
// sampling the colony ellipse. Reach is expressed as a fraction of the summed
// radii, so both ends are guaranteed overlaps (1.0 would be a bare touch) while
// staying clear of the 0.52 stacking floor enforced below.
const RHIZOME_ATTACH_RATE = 0.88;
const RHIZOME_REACH_MIN = 0.6;
const RHIZOME_REACH_MAX = 0.95;
// How far a runner will travel to claim a colony sample, in summed radii. Past
// this the sample is treated as open water and seeds a new stand instead.
const RHIZOME_SEARCH_REACH = 4.2;
const RHIZOME_BEARING_SPREAD = 2.2;

const isPadPlacementValid = (candidatePad, existingPads) => {
    const cX = Number(candidatePad.x) || 0;
    const cY = Number(candidatePad.y) || 0;
    const cSize = Math.max(8, Number(candidatePad.size) || 24);

    for (let i = 0; i < existingPads.length; i += 1) {
        const other = existingPads[i];
        if (!other) continue;
        const oX = Number(other.x) || 0;
        const oY = Number(other.y) || 0;
        const oSize = Math.max(8, Number(other.size) || 24);

        const centerDist = Math.hypot(cX - oX, cY - oY);
        const centerMin = (cSize + oSize) * 0.52;
        if (centerDist < centerMin) return false;
    }
    return true;
};

const buildClusteredLilyPadsOnly = ({
    width,
    height,
    count,
    sceneGenerationKey = '',
}) => {
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (!safeCount || !width || !height) return [];

    const rng = createZenSeededRandom(
        buildStaticLayoutSeedKey({
            sceneGenerationKey,
            width,
            height,
            count: safeCount,
            scope: 'pads',
        }),
    );
    const pads = [];
    const minDim = Math.max(80, Math.min(width, height));
    // Constrain centers, not complete discs: mature pads may straddle the
    // aperture while young pads still have a little breathing room.
    const margin = Math.max(12, minDim * 0.02);

    // Colony seeds on a jittered grid rather than uniform-random points.
    // Purely random seeds clump, which left whole regions of a wide pond bare
    // no matter how many pads were requested. One seed per cell guarantees the
    // stands reach across the surface while the jitter keeps them irregular.
    // Colonies are also stretched and rotated rather than round: real stands
    // run along a shoreline or a current, and circular blobs read as confetti.
    const desiredClusters = Math.max(1, Math.min(10, Math.round(1 + Math.sqrt(safeCount) * 0.72)));
    const usableW = Math.max(1, width - margin * 2);
    const usableH = Math.max(1, height - margin * 2);
    const clusterCols = Math.max(1, Math.round(Math.sqrt(desiredClusters * (usableW / usableH))));
    const clusterRows = Math.max(1, Math.ceil(desiredClusters / clusterCols));
    const cellW = usableW / clusterCols;
    const cellH = usableH / clusterRows;
    const clusters = [];
    for (let row = 0; row < clusterRows; row += 1) {
        for (let col = 0; col < clusterCols; col += 1) {
            clusters.push({
                x: margin + (col + 0.16 + rng() * 0.68) * cellW,
                y: margin + (row + 0.16 + rng() * 0.68) * cellH,
                // Sized off its own cell so a stand fills the space it owns
                // regardless of pond aspect ratio.
                spread: Math.min(cellW, cellH) * (0.52 + rng() * 0.46),
                elongation: 0.44 + rng() * 0.9,
                axis: rng() * Math.PI,
            });
        }
    }

    for (let i = 0; i < safeCount; i += 1) {
        // Mixed-age colony: a mature canopy plus a tail of young pads still
        // sizing up. The young ones slot into the gaps the mature pads leave,
        // which fills the surface without inflating the overall pad scale.
        const baseSize = rng() < 0.36
            ? 12 + rng() * 13
            : 25 + rng() * 20;
        const placementProfiles = [
            { sizeScale: 1, attempts: 44 },
            { sizeScale: 0.92, attempts: 32 },
            { sizeScale: 0.84, attempts: 28 },
            { sizeScale: 0.74, attempts: 22 },
        ];
        let selectedPad = null;

        for (let profileIdx = 0; profileIdx < placementProfiles.length && !selectedPad; profileIdx += 1) {
            const profile = placementProfiles[profileIdx];
            // Floor lowered from 18 so the young-pad tail survives instead of
            // being clamped back up into the mature band.
            const resolvedSize = Math.max(10, baseSize * profile.sizeScale);
            for (let attempt = 0; attempt < profile.attempts; attempt += 1) {
                // Nymphaea spreads by rhizome: a new pad pushes up beside its
                // parent and rides over it, so a stand is a raft of overlapping
                // discs rather than a scatter of separate ones.
                //
                // The validity rule below only *permits* overlap; nothing here
                // used to seek it, and rejection sampling against a loose
                // minimum is exactly how you build a Poisson-disc set -- the
                // most evenly-spaced arrangement there is. Measured on the old
                // path: 15% of pads touched any neighbour and the median
                // nearest-neighbour distance was 1.37x the summed radii, i.e. a
                // clear gap around almost every pad.
                //
                // Attaching most pads to an already-placed parent at a reach
                // that is always shorter than the summed radii makes the
                // overlap structural instead of accidental. The colony sampling
                // still runs for the rest, which is what keeps the stands
                // spread across the pond instead of collapsing into one raft.
                //
                // The parent is the pad nearest the colony sample rather than
                // any pad at all. Attaching to a globally random parent
                // snowballs: whichever pad is picked first keeps winning, the
                // stand collapses onto it, and pond coverage drops. Anchoring
                // the attachment to where the colony sampling already wanted a
                // pad lets every cluster grow its own raft.
                const cluster = pickFromList(rng, clusters);
                const theta = rng() * Math.PI * 2;
                const radius = cluster.spread * Math.pow(rng(), 0.62);
                const localX = Math.cos(theta) * radius;
                const localY = Math.sin(theta) * radius * cluster.elongation;
                const cosA = Math.cos(cluster.axis);
                const sinA = Math.sin(cluster.axis);
                const jitter = (rng() - 0.5) * minDim * 0.03;
                const seedX = clampValue(
                    cluster.x + (localX * cosA) - (localY * sinA) + jitter,
                    margin,
                    width - margin,
                );
                const seedY = clampValue(
                    cluster.y + (localX * sinA) + (localY * cosA) + jitter,
                    margin,
                    height - margin,
                );

                let parent = null;
                if (pads.length > 0 && rng() < RHIZOME_ATTACH_RATE) {
                    let bestDistance = Infinity;
                    for (let padIdx = 0; padIdx < pads.length; padIdx += 1) {
                        const candidate = pads[padIdx];
                        const distance = Math.hypot(
                            seedX - candidate.x,
                            seedY - candidate.y,
                        );
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            parent = candidate;
                        }
                    }
                    // Out of runner range: this sample belongs to open water,
                    // not to the nearest stand.
                    if (bestDistance > (parent.size + resolvedSize) * RHIZOME_SEARCH_REACH) {
                        parent = null;
                    }
                }

                let x = seedX;
                let y = seedY;
                if (parent) {
                    // Grow toward the colony sample so the raft still drifts
                    // the way the stand was shaped, with a wide bearing spread
                    // so it does not become a straight chain.
                    const bearing = Math.atan2(seedY - parent.y, seedX - parent.x)
                        + (rng() - 0.5) * RHIZOME_BEARING_SPREAD;
                    const reach = (parent.size + resolvedSize) * (
                        RHIZOME_REACH_MIN
                        + rng() * (RHIZOME_REACH_MAX - RHIZOME_REACH_MIN)
                    );
                    x = clampValue(
                        parent.x + Math.cos(bearing) * reach,
                        margin,
                        width - margin,
                    );
                    y = clampValue(
                        parent.y + Math.sin(bearing) * reach,
                        margin,
                        height - margin,
                    );
                }
                const candidatePad = new LilyPad(x, y, resolvedSize, 0, {
                    hasFlower: false,
                    rng,
                });
                if (isPadPlacementValid(candidatePad, pads)) {
                    selectedPad = candidatePad;
                    break;
                }
            }
        }

        // Strict placement: do not force an overlapping fallback candidate.
        if (selectedPad) pads.push(selectedPad);
    }

    // Stable Y ordering for natural depth progression.
    pads.sort((a, b) => {
        const yOrder = (Number(a.y) || 0) - (Number(b.y) || 0);
        if (Math.abs(yOrder) > 0.1) return yOrder;
        return (Number(a.x) || 0) - (Number(b.x) || 0);
    });

    return pads;
};

const isPointInsideAnyPad = (x, y, lilyPads, marginScale = 0.02) => {
    for (let i = 0; i < lilyPads.length; i += 1) {
        const pad = lilyPads[i];
        if (!pad || typeof pad.containsWorldPoint !== 'function') continue;
        const padSize = Math.max(8, Number(pad.size) || 24);
        if (pad.containsWorldPoint(x, y, padSize * marginScale)) return true;
    }
    return false;
};

const wrapAngleSigned = (angle) => {
    const raw = Number(angle) || 0;
    let wrapped = ((raw % TAU) + TAU) % TAU;
    if (wrapped > Math.PI) wrapped -= TAU;
    return wrapped;
};

const resolveNearestPadAnalysis = (x, y, lilyPads) => {
    let nearestPad = null;
    let nearestCenterDistance = Infinity;
    let nearestEdgeDistance = Infinity;
    let secondNearestEdgeDistance = Infinity;
    let nearbyPadCount = 0;
    for (let i = 0; i < lilyPads.length; i += 1) {
        const pad = lilyPads[i];
        if (!pad) continue;
        const padX = Number(pad.x) || 0;
        const padY = Number(pad.y) || 0;
        const padSize = Math.max(8, Number(pad.size) || 24);
        const centerDistance = Math.hypot(x - padX, y - padY);
        const edgeDistance = Math.max(0, centerDistance - padSize);
        if (centerDistance < (padSize * 2.2)) nearbyPadCount += 1;
        if (edgeDistance < nearestEdgeDistance) {
            secondNearestEdgeDistance = nearestEdgeDistance;
            nearestPad = pad;
            nearestCenterDistance = centerDistance;
            nearestEdgeDistance = edgeDistance;
        } else if (edgeDistance < secondNearestEdgeDistance) {
            secondNearestEdgeDistance = edgeDistance;
        }
    }

    let inNearestNotchGap = false;
    if (nearestPad) {
        const padX = Number(nearestPad.x) || 0;
        const padY = Number(nearestPad.y) || 0;
        const padSize = Math.max(8, Number(nearestPad.size) || 24);
        const rotation = Number(nearestPad.currentRotation ?? nearestPad.rotation) || 0;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const dx = x - padX;
        const dy = y - padY;
        const localX = dx * cosR + dy * sinR;
        const localY = -dx * sinR + dy * cosR;
        const localAngleSigned = wrapAngleSigned(Math.atan2(localY, localX));
        const notchHalfAngle = clampValue(Number(nearestPad.notchAngle) || 0.28, 0.12, 0.95);
        const inNotchCone = Math.abs(localAngleSigned) <= (notchHalfAngle * 1.08);
        const notchRadialMin = padSize * 0.2;
        const notchRadialMax = padSize * 1.08;
        inNearestNotchGap = inNotchCone
            && nearestCenterDistance >= notchRadialMin
            && nearestCenterDistance <= notchRadialMax;
    }

    return {
        pad: nearestPad,
        centerDistance: nearestCenterDistance,
        edgeDistance: nearestEdgeDistance,
        secondEdgeDistance: secondNearestEdgeDistance,
        nearbyPadCount,
        inNearestNotchGap,
    };
};

const pickClosestNeighborPad = (sourcePad, lilyPads) => {
    if (!sourcePad) return null;
    let closest = null;
    let closestDistance = Infinity;
    const sourceX = Number(sourcePad.x) || 0;
    const sourceY = Number(sourcePad.y) || 0;
    for (let i = 0; i < lilyPads.length; i += 1) {
        const pad = lilyPads[i];
        if (!pad || pad === sourcePad) continue;
        const distance = Math.hypot((Number(pad.x) || 0) - sourceX, (Number(pad.y) || 0) - sourceY);
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = pad;
        }
    }
    return closest;
};

const sampleWaterLilyRootCandidate = ({
    width,
    height,
    lilyPads,
    margin,
    minDim,
    rng,
}) => {
    if (!Array.isArray(lilyPads) || lilyPads.length === 0) return null;

    let x = 0;
    let y = 0;
    let sampleMode = 'ring';
    const mode = rng();
    if (mode < 0.52 && lilyPads.length > 1) {
        sampleMode = 'between';
        const padA = pickFromList(rng, lilyPads);
        const padB = pickClosestNeighborPad(padA, lilyPads) || pickFromList(rng, lilyPads);
        const midX = (((Number(padA?.x) || 0) + (Number(padB?.x) || 0)) * 0.5);
        const midY = (((Number(padA?.y) || 0) + (Number(padB?.y) || 0)) * 0.5);
        const jitter = minDim * (0.015 + rng() * 0.032);
        const angle = rng() * Math.PI * 2;
        x = midX + (Math.cos(angle) * jitter);
        y = midY + (Math.sin(angle) * jitter);
    } else if (mode < 0.86) {
        sampleMode = 'notch';
        const pad = pickFromList(rng, lilyPads);
        const padX = Number(pad?.x) || 0;
        const padY = Number(pad?.y) || 0;
        const padSize = Math.max(8, Number(pad?.size) || 24);
        const rotation = Number(pad?.currentRotation ?? pad?.rotation) || 0;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const notchHalfAngle = clampValue(Number(pad?.notchAngle) || 0.28, 0.12, 0.95);
        const localAngle = (rng() * 2 - 1) * notchHalfAngle * (0.74 + rng() * 0.3);
        const localRadius = padSize * (0.26 + rng() * 0.72);
        const localX = Math.cos(localAngle) * localRadius;
        const localY = Math.sin(localAngle) * localRadius;
        x = padX + (localX * cosR) - (localY * sinR);
        y = padY + (localX * sinR) + (localY * cosR);
    } else {
        sampleMode = 'ring';
        const pad = pickFromList(rng, lilyPads);
        const padSize = Math.max(8, Number(pad?.size) || 24);
        const angle = rng() * Math.PI * 2;
        const radial = padSize * (1.04 + (rng() * 1.14));
        x = (Number(pad?.x) || 0) + (Math.cos(angle) * radial);
        y = (Number(pad?.y) || 0) + (Math.sin(angle) * radial * 0.92);
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < margin || x > (width - margin) || y < margin || y > (height - margin)) return null;
    if (isPointInsideAnyPad(x, y, lilyPads, 0.015)) return null;

    const nearest = resolveNearestPadAnalysis(x, y, lilyPads);
    if (!nearest.pad || !Number.isFinite(nearest.centerDistance)) return null;
    const nearPadSize = Math.max(8, Number(nearest.pad.size) || 24);
    const betweenPads = nearest.secondEdgeDistance < Math.max(20, nearPadSize * 0.98);
    const hasNearbyPads = nearest.nearbyPadCount >= 2;
    const edgeBandClose = nearest.edgeDistance <= (nearPadSize * 0.5);

    if (sampleMode === 'notch') {
        if (!nearest.inNearestNotchGap) return null;
    } else {
        const minGap = Math.max(2, nearPadSize * 0.03);
        const maxGap = Math.max(24, nearPadSize * 0.98 + (minDim * 0.045));
        if (nearest.edgeDistance < minGap || nearest.edgeDistance > maxGap) return null;
        if (!(betweenPads || hasNearbyPads || edgeBandClose)) return null;
        if (sampleMode === 'between' && !(betweenPads || hasNearbyPads)) return null;
    }

    return {
        x,
        y,
        nearestPad: nearest.pad,
        nearestEdgeDistance: nearest.edgeDistance,
        inNotchGap: nearest.inNearestNotchGap,
        sampleMode,
    };
};

const buildWaterLilyBlooms = ({
    width,
    height,
    flowerChance = 0.65,
    lilyPads = [],
    sceneGenerationKey = '',
    count = 0,
}) => {
    if (!Array.isArray(lilyPads) || lilyPads.length === 0) return [];
    const rng = createZenSeededRandom(
        buildStaticLayoutSeedKey({
            sceneGenerationKey,
            width,
            height,
            count,
            flowerChance,
            scope: 'blooms',
        }),
    );
    const minDim = Math.max(80, Math.min(width, height));
    const margin = Math.max(24, minDim * 0.06);
    const safeFlowerChance = clampValue(flowerChance, 0, 1);
    const targetCount = Math.max(0, Math.min(
        lilyPads.length,
        Math.round((lilyPads.length * safeFlowerChance) * 0.95),
    ));
    if (!targetCount) return [];

    const blooms = [];
    const maxAttempts = Math.max(260, targetCount * 240);
    let attempts = 0;
    while (blooms.length < targetCount && attempts < maxAttempts) {
        attempts += 1;
        const candidate = sampleWaterLilyRootCandidate({
            width,
            height,
            lilyPads,
            margin,
            minDim,
            rng,
        });
        if (!candidate) continue;

        const nearestPadSize = Math.max(8, Number(candidate.nearestPad?.size) || 24);
        const minRootSpacing = candidate.inNotchGap
            ? Math.max(14, nearestPadSize * 0.46)
            : Math.max(18, nearestPadSize * 0.68);
        let overlapsExisting = false;
        for (let i = 0; i < blooms.length; i += 1) {
            const other = blooms[i];
            const distance = Math.hypot((Number(other.x) || 0) - candidate.x, (Number(other.y) || 0) - candidate.y);
            if (distance < minRootSpacing) {
                overlapsExisting = true;
                break;
            }
        }
        if (overlapsExisting) continue;

        const baseSize = nearestPadSize * (
            candidate.inNotchGap
                ? (0.36 + rng() * 0.22)
                : (0.44 + rng() * 0.3)
        );
        const outwardAngle = Math.atan2(
            candidate.y - (Number(candidate.nearestPad?.y) || 0),
            candidate.x - (Number(candidate.nearestPad?.x) || 0),
        );
        const stemAngle = outwardAngle + ((rng() - 0.5) * 1.2);
        const stemLength = clampValue(
            (baseSize * (0.12 + rng() * 0.24))
                + (candidate.nearestEdgeDistance * (candidate.inNotchGap ? 0.12 : 0.22)),
            baseSize * 0.1,
            baseSize * 0.62,
        );

        blooms.push(new WaterLilyBloom(candidate.x, candidate.y, baseSize, {
            stemAngle,
            stemLength,
            rng,
        }));
    }

    // Fill remainder with a relaxed ring placement pass so waterLily count does not collapse to zero
    // on small layouts or strict notch/inter-pad rejection runs.
    if (blooms.length < targetCount) {
        const fillAttemptsMax = Math.max(180, (targetCount - blooms.length) * 120);
        let fillAttempts = 0;
        while (blooms.length < targetCount && fillAttempts < fillAttemptsMax) {
            fillAttempts += 1;
            const pad = pickFromList(rng, lilyPads);
            if (!pad) continue;
            const padX = Number(pad.x) || 0;
            const padY = Number(pad.y) || 0;
            const padSize = Math.max(8, Number(pad.size) || 24);
            const angle = rng() * TAU;
            const radial = padSize * (0.92 + rng() * 0.84);
            const x = clampValue(padX + (Math.cos(angle) * radial), margin, width - margin);
            const y = clampValue(padY + (Math.sin(angle) * radial * 0.92), margin, height - margin);
            if (isPointInsideAnyPad(x, y, lilyPads, 0.01)) continue;

            const minRootSpacing = Math.max(12, padSize * 0.42);
            let overlapsExisting = false;
            for (let i = 0; i < blooms.length; i += 1) {
                const other = blooms[i];
                const distance = Math.hypot((Number(other.x) || 0) - x, (Number(other.y) || 0) - y);
                if (distance < minRootSpacing) {
                    overlapsExisting = true;
                    break;
                }
            }
            if (overlapsExisting) continue;

            const baseSize = padSize * (0.34 + rng() * 0.24);
            const stemAngle = angle + ((rng() - 0.5) * 0.8);
            const stemLength = clampValue(
                baseSize * (0.14 + rng() * 0.2),
                baseSize * 0.1,
                baseSize * 0.48,
            );
            blooms.push(new WaterLilyBloom(x, y, baseSize, {
                stemAngle,
                stemLength,
                rng,
            }));
        }
    }

    if (targetCount > 0 && blooms.length === 0) {
        const fallbackPad = lilyPads[0];
        if (fallbackPad) {
            const padX = Number(fallbackPad.x) || (width * 0.5);
            const padY = Number(fallbackPad.y) || (height * 0.5);
            const padSize = Math.max(8, Number(fallbackPad.size) || 24);
            const fallbackAngle = Number(fallbackPad.currentRotation ?? fallbackPad.rotation) || 0;
            const x = clampValue(
                padX + (Math.cos(fallbackAngle) * padSize * 1.16),
                margin,
                width - margin,
            );
            const y = clampValue(
                padY + (Math.sin(fallbackAngle) * padSize * 1.02),
                margin,
                height - margin,
            );
            blooms.push(new WaterLilyBloom(x, y, padSize * 0.4, {
                stemAngle: fallbackAngle,
                stemLength: padSize * 0.16,
                rng,
            }));
        }
    }

    return blooms;
};

const buildZenIrisClusters = ({
    width,
    height,
    count = DEFAULT_IRIS_DENSITY,
    lilyPads = [],
    sceneGenerationKey = '',
}) => {
    if (!ZEN_IRIS_CLUSTER_GENERATION_ENABLED) return [];

    const countValue = Number(count);
    const safeCount = Math.max(
        0,
        Math.min(14, Math.round(Number.isFinite(countValue) ? countValue : DEFAULT_IRIS_DENSITY)),
    );
    if (!safeCount || !width || !height) return [];

    const rng = createZenSeededRandom(
        buildStaticLayoutSeedKey({
            sceneGenerationKey,
            width,
            height,
            count: safeCount,
            flowerChance: 0.65,
            scope: 'iris',
        }),
    );
    const minDim = Math.max(80, Math.min(width, height));
    const margin = Math.max(22, minDim * 0.055);
    const targetCount = safeCount;
    const clusters = [];
    const maxAttempts = Math.max(160, targetCount * 70);

    for (let attempt = 0; clusters.length < targetCount && attempt < maxAttempts; attempt += 1) {
        const edgeRoll = rng();
        const edgeInset = margin * (0.35 + rng() * 0.8);
        let x = 0;
        let y = 0;
        let growthAngle = -Math.PI * 0.5;
        if (edgeRoll < 0.44) {
            x = margin + rng() * Math.max(1, width - margin * 2);
            y = height - edgeInset - rng() * minDim * 0.08;
            growthAngle = -Math.PI * 0.5 + ((rng() - 0.5) * 0.14);
        } else if (edgeRoll < 0.68) {
            x = edgeInset + rng() * minDim * 0.035;
            y = margin + rng() * Math.max(1, height - margin * 2);
            growthAngle = 0 + ((rng() - 0.5) * 0.14);
        } else if (edgeRoll < 0.9) {
            x = width - edgeInset - rng() * minDim * 0.035;
            y = margin + rng() * Math.max(1, height - margin * 2);
            growthAngle = Math.PI + ((rng() - 0.5) * 0.14);
        } else {
            const pad = pickFromList(rng, lilyPads);
            if (!pad) continue;
            const padSize = Math.max(8, Number(pad.size) || 24);
            const angle = rng() * TAU;
            const radius = padSize * (1.34 + rng() * 0.7);
            x = (Number(pad.x) || width * 0.5) + Math.cos(angle) * radius;
            y = (Number(pad.y) || height * 0.5) + Math.sin(angle) * radius * 0.9;
            growthAngle = Math.atan2((Number(pad.y) || height * 0.5) - y, (Number(pad.x) || width * 0.5) - x)
                + ((rng() - 0.5) * 0.14);
        }

        x = clampValue(x, margin * 0.42, width - margin * 0.42);
        y = clampValue(y, margin * 0.42, height - margin * 0.32);
        const size = clampValue(minDim * (0.034 + rng() * 0.026), 12, 31);
        const candidate = new ZenIrisCluster(x, y, size, {
            growthAngle,
            rng,
        });
        if (isIrisPlacementValid(candidate, clusters, lilyPads)) {
            clusters.push(candidate);
        }
    }

    clusters.sort((a, b) => {
        const yOrder = (Number(a.y) || 0) - (Number(b.y) || 0);
        if (Math.abs(yOrder) > 0.1) return yOrder;
        return (Number(a.x) || 0) - (Number(b.x) || 0);
    });
    return clusters;
};

const buildClusteredPondLayout = ({
    width,
    height,
    count,
    irisDensity = DEFAULT_IRIS_DENSITY,
    flowerChance = 0.65,
    sceneGenerationKey = '',
}) => {
    const lilyPads = buildClusteredLilyPadsOnly({
        width,
        height,
        count,
        sceneGenerationKey,
    });
    const waterLilyBlooms = buildWaterLilyBlooms({
        width,
        height,
        flowerChance,
        lilyPads,
        sceneGenerationKey,
        count,
    });
    const zenIrisClusters = ZEN_IRIS_CLUSTER_GENERATION_ENABLED
        ? buildZenIrisClusters({
            width,
            height,
            lilyPads,
            sceneGenerationKey,
            count: irisDensity,
        })
        : [];
    return {
        lilyPads,
        waterLilyBlooms,
        zenIrisClusters,
    };
};

const buildClusteredLilyPads = ({
    width,
    height,
    count,
    flowerChance = 0.65,
    sceneGenerationKey = '',
}) => {
    return buildClusteredPondLayout({
        width,
        height,
        count,
        flowerChance,
        sceneGenerationKey,
    }).lilyPads;
};

export {
    QUALITY_PROFILES,
    DEFAULT_QUALITY_PROFILE,
    resolveQualityMode,
    scaleCount,
    buildClusteredPondLayout,
    buildClusteredLilyPads,
};
