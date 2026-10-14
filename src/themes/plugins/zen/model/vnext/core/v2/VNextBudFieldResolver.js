import {
    buildTopContributions,
    clamp01,
    distance2,
    lerp,
    rotate2D,
    round,
    signedCentered,
    toNumber,
    vecLerp,
} from './VNextGrowthMath';

const dot2 = (a = [0, 1, 0], b = [0, 1, 0]) => (
    (toNumber(a?.[0], 0) * toNumber(b?.[0], 0))
    + (toNumber(a?.[1], 0) * toNumber(b?.[1], 0))
);

const createBudContributionScore = (contributions = {}) => (
    Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0)
);

const fitTarget = (value = 0, target = 0.5, radius = 0.24) => (
    clamp01(1 - (Math.abs(toNumber(value, target) - target) / Math.max(0.06, radius)))
);

const serializeBudSite = (site = {}) => ({
    id: site?.id || 'candidate',
    guideProgress: round(toNumber(site?.guideProgress, 0), 6),
    quality: round(toNumber(site?.quality, 0), 6),
    sideSign: Math.sign(toNumber(site?.sideSign, 0)) || 1,
    position: [
        round(toNumber(site?.position?.[0], 0), 4),
        round(toNumber(site?.position?.[1], 0), 4),
        0,
    ],
    parentNodeId: site?.parentNodeId || 'root',
    trunkIndex: Math.max(0, Math.floor(toNumber(site?.trunkIndex, 0))),
});

const emitBudCandidateEvents = ({
    sites = [],
    pushEvent,
} = {}) => {
    (Array.isArray(sites) ? sites : []).forEach((site) => {
        pushEvent?.(Math.floor(toNumber(site?.segmentIndex, 0)), 'ACTION_SELECTED', {
            action: 'bud_candidate',
            phase: 'scaffold',
            candidateCount: 1,
            scoreTotal: round(toNumber(site?.score, 0), 6),
            topPositive: buildTopContributions(site?.contributions || {}, { positive: true }),
            topNegative: buildTopContributions(site?.contributions || {}, { positive: false }),
        }, {
            nodeId: site?.parentNodeId || null,
            seedKey: site?.seedKey || '',
            randomValue: Number.isFinite(Number(site?.randomValue)) ? Number(site.randomValue) : null,
            contributions: site?.contributions || {},
        });
    });
};

const scoreBudCandidate = ({
    id = 'candidate',
    parentNodeId = null,
    trunkIndex = 0,
    segmentIndex = 0,
    anchor = [0, 0, 0],
    heading = [0, 1, 0],
    sideSign = 1,
    guideIndex = 0,
    guideProgress = 0,
    localTurn = 0,
    counterCurveFit = 0.5,
    seedKey = '',
    randomValue = 0.5,
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
} = {}) => {
    const budField = runtime?.budField || {};
    const sakura = runtime?.sakura || {};
    const bounds = runtime?.bounds || constraints?.bounds || { width: 420, height: 420 };
    const light = lightField?.sampleWithPhototropism({
        position: anchor,
        heading,
        bounds,
        phototropismGain: budField.phototropism,
    }) || { lightAlign: 0.5, openSkyGain: 0.5 };
    const style = styleField?.sample({
        position: anchor,
        heading,
        bounds,
    }) || {
        styleAlign: 0.5,
        massBalance: 0.5,
    };
    const occupancy = occupancyField?.sampleDensity(anchor, lerp(24, 72, budField.spaceAvoidGain)) || 0;
    const distanceFromBase = distance2(anchor, [0, 0, 0]);
    const heightNorm = clamp01(toNumber(anchor?.[1], 0) / Math.max(1, bounds.height || 420));
    const reachNorm = clamp01(Math.abs(toNumber(anchor?.[0], 0)) / Math.max(24, (bounds.width || 420) * 0.34));
    const opennessBoost = clamp01((1 - occupancy) * lerp(budField.openness, 1, clamp01(sakura.crownOpenness)));
    const heightEnvelope = fitTarget(heightNorm, 0.48, 0.42);
    const innerSupport = fitTarget(reachNorm, 0.28, 0.34);
    const contributions = {
        bud_light: round(light.lightAlign * 0.26, 6),
        bud_style: round(style.styleAlign * 0.22, 6),
        bud_balance: round(style.massBalance * 0.14, 6),
        bud_openness: round(opennessBoost * 0.18, 6),
        bud_height_band: round(heightEnvelope * 0.08, 6),
        bud_inner_support: round(innerSupport * 0.06, 6),
        bud_curve_shoulder: round(clamp01(localTurn) * 0.12, 6),
        bud_counterbalance: round(clamp01(counterCurveFit) * 0.1, 6),
        bud_species: round(clamp01(sakura.speciesCharacter) * 0.06, 6),
        bud_density_penalty: round(-occupancy * 0.18, 6),
        bud_distance_penalty: round(
            -clamp01(Math.abs(distanceFromBase - (bounds.height * 0.42)) / Math.max(60, bounds.height * 0.5)) * 0.06,
            6,
        ),
    };
    const quality = clamp01(createBudContributionScore(contributions) + 0.26);
    if (quality < 0.2) {
        return null;
    }
    return {
        id,
        parentNodeId,
        trunkIndex,
        segmentIndex,
        attachT: round(clamp01(guideProgress), 6),
        guideIndex,
        guideProgress: round(clamp01(guideProgress), 6),
        position: anchor,
        heading,
        sideSign,
        parentProgress: round(clamp01(guideProgress), 6),
        heightNorm: round(heightNorm, 6),
        reachNorm: round(reachNorm, 6),
        quality: round(quality, 6),
        score: round(createBudContributionScore(contributions), 6),
        contributions,
        vigor: clamp01(0.44 + (light.openSkyGain * 0.22) + ((1 - occupancy) * 0.18)),
        seedKey,
        randomValue,
    };
};

const extractLocalMaxima = ({
    candidates = [],
    targetCount = 8,
} = {}) => {
    const groups = new Map();
    (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
        const key = `${candidate?.trunkIndex ?? 0}:${Math.sign(toNumber(candidate?.sideSign, 0)) || 1}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(candidate);
    });

    const maxima = [];
    groups.forEach((group) => {
        group.sort((left, right) => (
            Number(left?.guideProgress || 0) - Number(right?.guideProgress || 0)
        ));
        group.forEach((candidate, index) => {
            const neighbors = group.slice(Math.max(0, index - 2), Math.min(group.length, index + 3))
                .filter((entry) => entry !== candidate);
            const neighborBest = neighbors.reduce((best, entry) => Math.max(best, toNumber(entry?.quality, 0)), 0);
            if (toNumber(candidate?.quality, 0) >= (neighborBest - 1e-6) || toNumber(candidate?.quality, 0) >= 0.82) {
                maxima.push(candidate);
            }
        });
    });

    const desired = Math.max(12, targetCount * 3);
    if (maxima.length >= desired) {
        return maxima;
    }
    const seen = new Set(maxima.map((entry) => entry.id));
    [...(Array.isArray(candidates) ? candidates : [])]
        .sort((left, right) => Number(right?.quality || 0) - Number(left?.quality || 0))
        .forEach((candidate) => {
            if (maxima.length >= desired || seen.has(candidate.id)) {
                return;
            }
            maxima.push(candidate);
            seen.add(candidate.id);
        });
    return maxima;
};

const thinCandidatesByPoisson = ({
    candidates = [],
    runtime,
    targetCount = 8,
} = {}) => {
    const budField = runtime?.budField || {};
    const minSpatialSpacing = lerp(12, 26, clamp01(budField.spaceAvoidGain));
    const minArcSpacing = lerp(0.028, 0.072, clamp01(budField.spaceAvoidGain));
    const retained = [];
    let rejectedByThinning = 0;
    const sorted = [...(Array.isArray(candidates) ? candidates : [])]
        .sort((left, right) => Number(right?.quality || 0) - Number(left?.quality || 0));

    for (const candidate of sorted) {
        const collision = retained.some((entry) => {
            if (Number(entry?.trunkIndex || 0) !== Number(candidate?.trunkIndex || 0)) {
                return false;
            }
            const arcDelta = Math.abs(toNumber(entry?.guideProgress, 0) - toNumber(candidate?.guideProgress, 0));
            const spatialDistance = distance2(entry?.position, candidate?.position);
            const sameParent = String(entry?.parentNodeId || '') === String(candidate?.parentNodeId || '');
            const sameSide = (Math.sign(toNumber(entry?.sideSign, 0)) || 1) === (Math.sign(toNumber(candidate?.sideSign, 0)) || 1);
            const arcFloor = sameSide ? minArcSpacing : (minArcSpacing * 0.56);
            const spatialFloor = sameSide ? minSpatialSpacing : (minSpatialSpacing * 0.58);
            return (
                spatialDistance < spatialFloor
                || arcDelta < arcFloor
                || (sameParent && arcDelta < (minArcSpacing * 1.08))
            );
        });
        if (collision) {
            rejectedByThinning += 1;
            continue;
        }
        retained.push(candidate);
        if (retained.length >= Math.max(targetCount * 5, targetCount + 14)) {
            break;
        }
    }

    return {
        retained,
        rejectedByThinning,
    };
};

const buildSegmentSlotCandidates = ({
    backboneRecords = [],
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
    sampleRandom,
} = {}) => {
    const budField = runtime?.budField || {};
    const slots = [0.42, 0.68, 0.86];
    const rawCandidates = [];

    (Array.isArray(backboneRecords) ? backboneRecords : []).forEach((record) => {
        if (!record || record.progress < 0.16 || record.progress > 0.96) {
            return;
        }
        const slotLimit = record.progress > 0.72 ? 2 : 3;
        slots.slice(0, slotLimit).forEach((attachT, slotIndex) => {
            [1, -1].forEach((sideSeed, sideIndex) => {
                const anchor = vecLerp(record.p0, record.p1, attachT);
                const outward = sideSeed * (record.lateralBias || 1);
                const baseAngleDeg = lerp(
                    budField.branchAngleMeanDeg * 0.72,
                    budField.branchAngleMeanDeg * 1.08,
                    clamp01(slotIndex / Math.max(1, slots.length - 1)),
                );
                const seedKey = `bud_angle_${record.nodeId}_${slotIndex}`;
                const randomValue = sampleRandom?.(seedKey, sideIndex) || 0.5;
                const jitterDeg = signedCentered(randomValue) * budField.branchAngleVarDeg;
                const heading = rotate2D(
                    record.heading,
                    ((outward * baseAngleDeg) + jitterDeg) * Math.PI / 180,
                );
                const counterCurveFit = outward === (Math.sign(-toNumber(anchor?.[0], 0)) || outward) ? 1 : 0.42;
                const candidate = scoreBudCandidate({
                    id: `${record.nodeId}_bud_${slotIndex}_${sideIndex}`,
                    parentNodeId: record.nodeId,
                    trunkIndex: record.trunkIndex,
                    segmentIndex: record.segmentIndex,
                    anchor,
                    heading,
                    sideSign: outward,
                    guideIndex: slotIndex,
                    guideProgress: record.progress,
                    localTurn: 0.2,
                    counterCurveFit,
                    seedKey,
                    randomValue,
                    occupancyField,
                    lightField,
                    styleField,
                    runtime,
                    constraints,
                });
                if (candidate) {
                    rawCandidates.push(candidate);
                }
            });
        });
    });

    return {
        rawCandidates,
        strategy: 'segment_slots',
    };
};

const buildSpineFieldCandidates = ({
    backboneGuides = [],
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
    sampleRandom,
} = {}) => {
    const budField = runtime?.budField || {};
    const rawCandidates = [];

    (Array.isArray(backboneGuides) ? backboneGuides : []).forEach((guide) => {
        const samples = Array.isArray(guide?.samples) ? guide.samples : [];
        for (let sampleIndex = 1; sampleIndex < Math.max(1, samples.length - 1); sampleIndex += 1) {
            const previous = samples[sampleIndex - 1];
            const sample = samples[sampleIndex];
            const next = samples[sampleIndex + 1];
            if (!sample || !previous || !next) {
                continue;
            }
            const progress = clamp01(toNumber(sample?.progress, 0));
            if (progress < 0.12 || progress > 0.98 || !sample?.parentNodeId) {
                continue;
            }
            const turnSignal = clamp01(
                ((1 - dot2(previous?.heading, next?.heading)) * 0.72)
                + (Math.abs(toNumber(next?.heading?.[0], 0) - toNumber(previous?.heading?.[0], 0)) * 0.28),
            );

            [1, -1].forEach((sideSeed, sideIndex) => {
                const resolvedSide = sideSeed * (Math.sign(toNumber(sample?.lateralBias, 0)) || 1);
                const heightBias = fitTarget(progress, 0.48, 0.44);
                const baseAngleDeg = lerp(
                    budField.branchAngleMeanDeg * 0.72,
                    budField.branchAngleMeanDeg * 1.12,
                    clamp01((progress * 0.68) + (heightBias * 0.32)),
                );
                const curveLiftDeg = lerp(0, 10, turnSignal);
                const angleScales = turnSignal > 0.14 || progress > 0.58
                    ? [0.88, 1.12]
                    : [1];
                angleScales.forEach((angleScale, variantIndex) => {
                    const seedKey = `bud_field_angle_${guide?.trunkIndex ?? 0}_${sampleIndex}_${variantIndex}`;
                    const randomValue = sampleRandom?.(seedKey, sideIndex) || 0.5;
                    const jitterDeg = signedCentered(randomValue) * budField.branchAngleVarDeg * 0.42;
                    const heading = rotate2D(
                        sample.heading,
                        ((resolvedSide * ((baseAngleDeg + curveLiftDeg) * angleScale)) + jitterDeg) * Math.PI / 180,
                    );
                    const counterCurveSign = Math.sign(-toNumber(sample?.position?.[0], 0))
                        || Math.sign(-toNumber(sample?.heading?.[0], 0))
                        || resolvedSide;
                    const counterCurveFit = counterCurveSign === resolvedSide ? 1 : 0.26;
                    const candidate = scoreBudCandidate({
                        id: `guide_${guide?.trunkIndex ?? 0}_${sampleIndex}_${sideIndex}_${variantIndex}`,
                        parentNodeId: sample.parentNodeId,
                        trunkIndex: guide?.trunkIndex ?? 0,
                        segmentIndex: Math.max(0, Math.floor(toNumber(sample?.segmentIndex, 0))),
                        anchor: sample.position,
                        heading,
                        sideSign: resolvedSide,
                        guideIndex: sampleIndex,
                        guideProgress: progress,
                        localTurn: turnSignal,
                        counterCurveFit,
                        seedKey,
                        randomValue,
                        occupancyField,
                        lightField,
                        styleField,
                        runtime,
                        constraints,
                    });
                    if (candidate) {
                        rawCandidates.push(candidate);
                    }
                });
            });
        }
    });

    return {
        rawCandidates,
        strategy: 'spine_field_maxima',
    };
};

export const resolveVNextBudField = ({
    backboneRecords = [],
    backboneGuides = [],
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
    sampleRandom,
    pushEvent,
} = {}) => {
    const budField = runtime?.budField || {};
    const targetCount = Math.max(3, Math.floor(toNumber(budField.targetCount, 8)));
    const fieldMode = Array.isArray(backboneGuides) && backboneGuides.some((entry) => Array.isArray(entry?.samples) && entry.samples.length > 2)
        ? buildSpineFieldCandidates({
            backboneGuides,
            occupancyField,
            lightField,
            styleField,
            runtime,
            constraints,
            sampleRandom,
        })
        : buildSegmentSlotCandidates({
            backboneRecords,
            occupancyField,
            lightField,
            styleField,
            runtime,
            constraints,
            sampleRandom,
        });

    const rawCandidates = Array.isArray(fieldMode?.rawCandidates) ? fieldMode.rawCandidates : [];
    const maxima = extractLocalMaxima({
        candidates: rawCandidates,
        targetCount,
    });
    const thinning = thinCandidatesByPoisson({
        candidates: maxima,
        runtime,
        targetCount,
    });
    const sites = thinning.retained
        .sort((left, right) => Number(right.quality) - Number(left.quality))
        .slice(0, Math.max(targetCount * 4, targetCount + 12));

    emitBudCandidateEvents({
        sites,
        pushEvent,
    });

    return {
        sites,
        debug: {
            strategy: fieldMode.strategy,
            rawCandidateCount: rawCandidates.length,
            maximaCount: maxima.length,
            retainedCount: thinning.retained.length,
            rejectedByThinning: thinning.rejectedByThinning,
            topCandidates: sites.slice(0, 6).map((site) => serializeBudSite(site)),
        },
    };
};
