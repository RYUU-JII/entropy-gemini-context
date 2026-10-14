import {
    clamp,
    clamp01,
    distance2,
    lerp,
    round,
    signedCentered,
    toNumber,
    vecNormalize2,
} from './VNextGrowthMath';

const TWO_PI = Math.PI * 2;

const dot2 = (a = [0, 1, 0], b = [0, 1, 0]) => (
    (toNumber(a?.[0], 0) * toNumber(b?.[0], 0))
    + (toNumber(a?.[1], 0) * toNumber(b?.[1], 0))
);

const smoothstep = (value = 0) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};

const catmullRom = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1)
        + ((-p0 + p2) * t)
        + ((2 * p0 - (5 * p1) + (4 * p2) - p3) * t2)
        + ((-p0 + (3 * p1) - (3 * p2) + p3) * t3)
    );
};

const catmullRomDeriv = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    return 0.5 * (
        (-p0 + p2)
        + (2 * (2 * p0 - (5 * p1) + (4 * p2) - p3) * t)
        + (3 * (-p0 + (3 * p1) - (3 * p2) + p3) * t2)
    );
};

const toControlIndex = (index, count) => clamp(index, 0, Math.max(0, count - 1));

const evaluateSplinePoint = (controlPoints = [], u = 0) => {
    if (!Array.isArray(controlPoints) || controlPoints.length < 2) {
        return null;
    }
    const clampedU = clamp01(u);
    const segmentCount = controlPoints.length - 1;
    const scaled = clampedU * segmentCount;
    const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled));
    const localT = scaled - segmentIndex;
    const p0 = controlPoints[toControlIndex(segmentIndex - 1, controlPoints.length)];
    const p1 = controlPoints[toControlIndex(segmentIndex, controlPoints.length)];
    const p2 = controlPoints[toControlIndex(segmentIndex + 1, controlPoints.length)];
    const p3 = controlPoints[toControlIndex(segmentIndex + 2, controlPoints.length)];
    const scale = Math.max(1, segmentCount);
    const x = catmullRom(p0.position[0], p1.position[0], p2.position[0], p3.position[0], localT);
    const y = catmullRom(p0.position[1], p1.position[1], p2.position[1], p3.position[1], localT);
    const dx = catmullRomDeriv(p0.position[0], p1.position[0], p2.position[0], p3.position[0], localT) * scale;
    const dy = catmullRomDeriv(p0.position[1], p1.position[1], p2.position[1], p3.position[1], localT) * scale;
    return {
        t: clampedU,
        position: [x, y, 0],
        heading: vecNormalize2([dx, dy, 0]),
    };
};

const interpolateArcSample = (left = null, right = null, mix = 0, arcNorm = 0) => {
    if (!left && !right) {
        return null;
    }
    if (!left) {
        return {
            ...right,
            arcNorm,
        };
    }
    if (!right) {
        return {
            ...left,
            arcNorm,
        };
    }
    const t = clamp01(mix);
    const x = lerp(left.position[0], right.position[0], t);
    const y = lerp(left.position[1], right.position[1], t);
    const dx = lerp(left.heading[0], right.heading[0], t);
    const dy = lerp(left.heading[1], right.heading[1], t);
    return {
        position: [x, y, 0],
        heading: vecNormalize2([dx, dy, 0]),
        arcNorm,
    };
};

const resampleSpineByArc = ({
    controlPoints = [],
    segmentCount = 6,
} = {}) => {
    const safeSegmentCount = Math.max(1, Math.floor(toNumber(segmentCount, 6)));
    const rawCount = Math.max(96, safeSegmentCount * 24);
    const rawSamples = [];
    let arcLength = 0;
    let previous = null;
    for (let index = 0; index < rawCount; index += 1) {
        const sample = evaluateSplinePoint(controlPoints, index / Math.max(1, rawCount - 1));
        if (!sample) {
            continue;
        }
        if (previous) {
            arcLength += distance2(sample.position, previous.position);
        }
        rawSamples.push({
            ...sample,
            arcLength,
        });
        previous = sample;
    }
    if (!rawSamples.length) {
        return [];
    }
    if (arcLength <= 1e-6) {
        return rawSamples.slice(0, safeSegmentCount + 1).map((sample, index) => ({
            ...sample,
            progress: clamp01(index / Math.max(1, safeSegmentCount)),
        }));
    }

    const samples = [];
    let cursor = 1;
    for (let index = 0; index <= safeSegmentCount; index += 1) {
        const arcNorm = index / Math.max(1, safeSegmentCount);
        const targetArc = arcLength * arcNorm;
        while (cursor < rawSamples.length && rawSamples[cursor].arcLength < targetArc) {
            cursor += 1;
        }
        const left = rawSamples[Math.max(0, cursor - 1)];
        const right = rawSamples[Math.min(rawSamples.length - 1, cursor)];
        const span = Math.max(1e-6, toNumber(right?.arcLength, targetArc) - toNumber(left?.arcLength, targetArc));
        const mix = clamp01((targetArc - toNumber(left?.arcLength, targetArc)) / span);
        const interpolated = interpolateArcSample(left, right, mix, arcNorm);
        samples.push({
            ...interpolated,
            progress: arcNorm,
        });
    }
    return samples;
};

const resolveNominalBackboneHeight = ({
    backbone = {},
    segmentCount = 6,
    boundsHeight = 420,
} = {}) => {
    const safeCount = Math.max(1, Math.floor(toNumber(segmentCount, 6)));
    let total = 0;
    for (let index = 0; index < safeCount; index += 1) {
        const progress = clamp01((index + 1) / safeCount);
        total += Math.max(
            4,
            toNumber(backbone.baseLength, 42)
            * lerp(1.08, 0.54, Math.pow(progress, 0.9))
            * lerp(0.92, 1.06, clamp01(backbone.vigor)),
        );
    }
    return clamp(total, boundsHeight * 0.34, boundsHeight * 0.96);
};

const CANDIDATE_OFFSET_SCALES = Object.freeze([-1.28, -0.96, -0.64, -0.32, 0, 0.32, 0.64, 0.96, 1.28]);
const SEEK_ATTRACTOR = 'seek';
const AVOID_ATTRACTOR = 'avoid';

const resolveLeanDriftX = ({
    backbone = {},
    xOffset = 0,
    width = 420,
    progress = 0,
} = {}) => (
    xOffset
    + (toNumber(backbone.lean, 0) * width * 0.22 * Math.pow(clamp01(progress), 1.12))
);

const createAttractor = ({
    id = 'attractor',
    kind = SEEK_ATTRACTOR,
    progress = 0.5,
    position = [0, 0, 0],
    weight = 0.2,
    radiusX = 20,
    progressRadius = 0.16,
} = {}) => ({
    id,
    kind,
    progress: clamp01(progress),
    position: [
        toNumber(position?.[0], 0),
        toNumber(position?.[1], 0),
        0,
    ],
    weight: clamp(toNumber(weight, 0.2), 0.02, 1),
    radiusX: Math.max(4, toNumber(radiusX, 20)),
    progressRadius: clamp(toNumber(progressRadius, 0.16), 0.06, 0.44),
});

const resolveBackboneAttractors = ({
    trunkIndex = 0,
    runtime = {},
    sampleRandom,
    backbone = {},
    xOffset = 0,
    width = 420,
    totalHeight = 220,
    maxSpan = 40,
    curveEnergy = 0.5,
    training = 0.5,
    apexSoftness = 0.5,
    firstSplitHeightRatio = 0.42,
} = {}) => {
    const crownOpenness = clamp01(runtime?.budField?.crownOpenness ?? runtime?.budField?.openness);
    const negativeSpaceTarget = clamp01(runtime?.budField?.negativeSpaceTarget);
    const primarySweep = clamp01(backbone.primarySweep ?? curveEnergy);
    const counterSweep = clamp01(backbone.counterSweep ?? curveEnergy);
    const apexReach = clamp01(backbone.apexReach ?? apexSoftness);
    const voidRespect = clamp01(backbone.voidRespect ?? negativeSpaceTarget);
    const dominantSign = (sampleRandom?.(`backbone_attractor_sign_${trunkIndex}`, 0) || 0.5) < 0.5 ? -1 : 1;
    const counterSign = dominantSign * -1;
    const primaryProgress = lerp(0.34, 0.48, clamp01((curveEnergy * 0.62) + (primarySweep * 0.38)));
    const counterProgress = lerp(
        Math.max(primaryProgress + 0.14, 0.6),
        0.78,
        clamp01((apexSoftness * 0.42) + (counterSweep * 0.58)),
    );
    const apexProgress = 0.98;
    const baseProgress = Math.max(0.14, Math.min(0.22, (firstSplitHeightRatio * 0.4) + 0.08));
    const voidProgress = lerp(0.46, 0.64, clamp01((crownOpenness * 0.56) + (voidRespect * 0.44)));

    const baseX = resolveLeanDriftX({
        backbone,
        xOffset,
        width,
        progress: baseProgress,
    });
    const primaryX = clamp(
        resolveLeanDriftX({
            backbone,
            xOffset,
            width,
            progress: primaryProgress,
        })
        + (dominantSign * maxSpan * lerp(0.12, 0.9, primarySweep) * lerp(0.92, 1.12, training)),
        xOffset - maxSpan,
        xOffset + maxSpan,
    );
    const counterX = clamp(
        resolveLeanDriftX({
            backbone,
            xOffset,
            width,
            progress: counterProgress,
        })
        + (counterSign * maxSpan * lerp(0.04, 0.56, counterSweep) * lerp(0.74, 1.02, training)),
        xOffset - maxSpan,
        xOffset + maxSpan,
    );
    const apexSign = apexSoftness > 0.64 ? dominantSign : (Math.sign(toNumber(backbone.lean, 0)) || dominantSign);
    const apexX = clamp(
        resolveLeanDriftX({
            backbone,
            xOffset,
            width,
            progress: apexProgress,
        })
        + (apexSign * maxSpan * lerp(0.02, 0.34, apexReach)),
        xOffset - maxSpan,
        xOffset + maxSpan,
    );
    const voidX = clamp(
        resolveLeanDriftX({
            backbone,
            xOffset,
            width,
            progress: voidProgress,
        })
        + (dominantSign * maxSpan * lerp(0.04, 0.26, voidRespect)),
        xOffset - maxSpan,
        xOffset + maxSpan,
    );

    return [
        createAttractor({
            id: 'base_anchor',
            kind: SEEK_ATTRACTOR,
            progress: baseProgress,
            position: [baseX, totalHeight * baseProgress, 0],
            weight: 0.28,
            radiusX: maxSpan * 0.18,
            progressRadius: 0.2,
        }),
        createAttractor({
            id: 'movement_primary',
            kind: SEEK_ATTRACTOR,
            progress: primaryProgress,
            position: [primaryX, totalHeight * primaryProgress, 0],
            weight: lerp(0.18, 0.32, primarySweep),
            radiusX: maxSpan * lerp(0.22, 0.32, primarySweep),
            progressRadius: 0.16,
        }),
        createAttractor({
            id: 'movement_counter',
            kind: SEEK_ATTRACTOR,
            progress: counterProgress,
            position: [counterX, totalHeight * counterProgress, 0],
            weight: lerp(0.06, 0.22, counterSweep),
            radiusX: maxSpan * lerp(0.18, 0.28, counterSweep),
            progressRadius: 0.18,
        }),
        createAttractor({
            id: 'void_guard',
            kind: AVOID_ATTRACTOR,
            progress: voidProgress,
            position: [voidX, totalHeight * voidProgress, 0],
            weight: lerp(0.04, 0.16, clamp01((negativeSpaceTarget * 0.34) + (voidRespect * 0.66))),
            radiusX: maxSpan * lerp(0.12, 0.34, clamp01((crownOpenness * 0.38) + (voidRespect * 0.62))),
            progressRadius: 0.16,
        }),
        createAttractor({
            id: 'apex_target',
            kind: SEEK_ATTRACTOR,
            progress: apexProgress,
            position: [apexX, totalHeight * apexProgress, 0],
            weight: lerp(0.24, 0.4, Math.max(apexReach, training)),
            radiusX: maxSpan * lerp(0.16, 0.24, apexReach),
            progressRadius: 0.12,
        }),
    ];
};

const resolveAttractorReferenceX = ({
    attractors = [],
    progress = 0,
    fallbackX = 0,
} = {}) => {
    let weightedX = 0;
    let totalWeight = 0;
    attractors.forEach((attractor) => {
        if (attractor?.kind !== SEEK_ATTRACTOR) {
            return;
        }
        const progressFit = clamp01(
            1 - (Math.abs(progress - toNumber(attractor.progress, progress)) / Math.max(0.06, toNumber(attractor.progressRadius, 0.16))),
        );
        if (progressFit <= 0) {
            return;
        }
        const weight = toNumber(attractor.weight, 0.2) * progressFit;
        weightedX += toNumber(attractor?.position?.[0], fallbackX) * weight;
        totalWeight += weight;
    });
    return totalWeight > 1e-6 ? (weightedX / totalWeight) : fallbackX;
};

const resolveAttractorContributions = ({
    attractors = [],
    progress = 0,
    position = [0, 0, 0],
} = {}) => (
    attractors.reduce((acc, attractor) => {
        const progressFit = clamp01(
            1 - (Math.abs(progress - toNumber(attractor.progress, progress)) / Math.max(0.06, toNumber(attractor.progressRadius, 0.16))),
        );
        if (progressFit <= 0) {
            return acc;
        }
        const dx = Math.abs(toNumber(position?.[0], 0) - toNumber(attractor?.position?.[0], 0));
        const xFit = clamp01(1 - (dx / Math.max(4, toNumber(attractor.radiusX, 16))));
        const weight = toNumber(attractor.weight, 0.2);
        if (attractor.kind === SEEK_ATTRACTOR) {
            acc[`attractor_${attractor.id}`] = round(weight * progressFit * xFit * 0.26, 6);
        } else {
            const proximity = clamp01(1 - (dx / Math.max(4, toNumber(attractor.radiusX, 16))));
            acc[`attractor_${attractor.id}`] = round(-weight * progressFit * proximity * 0.22, 6);
        }
        return acc;
    }, {})
);

const resolveFutureAttractorPotential = ({
    attractors = [],
    progress = 0,
    position = [0, 0, 0],
    maxSpan = 40,
} = {}) => {
    const futureSeek = attractors.filter((attractor) => (
        attractor?.kind === SEEK_ATTRACTOR
        && toNumber(attractor.progress, 0) > (progress + 0.04)
    ));
    if (!futureSeek.length) {
        return 0;
    }
    const next = futureSeek[0];
    const distance = Math.abs(toNumber(position?.[0], 0) - toNumber(next?.position?.[0], 0));
    return round(
        clamp01(1 - (distance / Math.max(10, maxSpan * 1.28))) * 0.12,
        6,
    );
};

const resolveFinalAttractorCompletion = ({
    controlPoints = [],
    attractors = [],
    maxSpan = 40,
} = {}) => {
    if (!controlPoints.length || !attractors.length) {
        return 0;
    }
    return attractors.reduce((acc, attractor) => {
        const nearest = controlPoints.reduce((best, point) => {
            const pointProgress = toNumber(point?.progress, 0);
            const progressDistance = Math.abs(pointProgress - toNumber(attractor.progress, 0));
            if (!best || progressDistance < best.progressDistance) {
                return {
                    point,
                    progressDistance,
                };
            }
            return best;
        }, null);
        if (!nearest?.point) {
            return acc;
        }
        const dx = Math.abs(
            toNumber(nearest.point?.position?.[0], 0)
            - toNumber(attractor?.position?.[0], 0),
        );
        const xFit = clamp01(1 - (dx / Math.max(8, Math.max(maxSpan * 0.22, toNumber(attractor.radiusX, 16)))));
        const progressFit = clamp01(
            1 - (nearest.progressDistance / Math.max(0.08, toNumber(attractor.progressRadius, 0.16))),
        );
        if (attractor.kind === SEEK_ATTRACTOR) {
            return acc + (toNumber(attractor.weight, 0.2) * progressFit * xFit * 0.22);
        }
        return acc - (toNumber(attractor.weight, 0.2) * progressFit * xFit * 0.18);
    }, 0);
};

const resolveSpanExpressionScore = ({
    controlPoints = [],
    curveEnergy = 0.5,
    maxSpan = 40,
} = {}) => {
    if (!controlPoints.length) {
        return 0;
    }
    const xs = controlPoints.map((point) => toNumber(point?.position?.[0], 0));
    const span = Math.max(...xs) - Math.min(...xs);
    const normalizedSpan = span / Math.max(1, maxSpan * 2);
    const target = lerp(0.16, 0.82, clamp01(curveEnergy));
    return round(
        clamp01(1 - (Math.abs(normalizedSpan - target) / 0.76)) * 0.16,
        6,
    );
};

const selectBeamStates = ({
    states = [],
    beamWidth = 3,
    maxSpan = 40,
} = {}) => {
    const sorted = [...states].sort((left, right) => Number(right.beamScore) - Number(left.beamScore));
    const selected = [];
    const minSpacing = Math.max(6, maxSpan * 0.18);
    sorted.forEach((state) => {
        if (selected.length >= beamWidth) {
            return;
        }
        const lastPoint = state?.controlPoints?.[state.controlPoints.length - 1];
        const x = toNumber(lastPoint?.position?.[0], 0);
        const isDistinct = selected.every((entry) => {
            const entryPoint = entry?.controlPoints?.[entry.controlPoints.length - 1];
            return Math.abs(toNumber(entryPoint?.position?.[0], 0) - x) >= minSpacing;
        });
        if (isDistinct) {
            selected.push(state);
        }
    });
    if (selected.length < beamWidth) {
        sorted.forEach((state) => {
            if (selected.length >= beamWidth) {
                return;
            }
            if (!selected.includes(state)) {
                selected.push(state);
            }
        });
    }
    return selected;
};

export const buildVNextBackboneSpineModel = ({
    trunkIndex = 0,
    runtime,
    constraints,
    occupancyField,
    lightField,
    styleField,
    sampleRandom,
} = {}) => {
    const backbone = runtime?.backbone || {};
    const bounds = runtime?.bounds || constraints?.bounds || { width: 420, height: 420 };
    const width = Math.max(120, toNumber(bounds?.width, 420));
    const height = Math.max(120, toNumber(bounds?.height, 420));
    const trunkCount = Math.max(1, Math.floor(toNumber(backbone.trunkCount, 1)));
    const trunkT = trunkCount <= 1 ? 0.5 : (trunkIndex / Math.max(1, trunkCount - 1));
    const xOffset = (trunkT - 0.5) * clamp01(backbone.spread) * 82;
    const curveEnergy = clamp01(backbone.curveEnergy);
    const training = clamp01(backbone.trainingIntensity);
    const apexSoftness = clamp01(backbone.apexSoftness ?? runtime?.sakura?.apexSoftness);
    const firstSplitHeightRatio = clamp01(backbone.firstSplitHeightRatio);
    const primarySweep = clamp01(backbone.primarySweep ?? curveEnergy);
    const counterSweep = clamp01(backbone.counterSweep ?? curveEnergy);
    const sweepExpression = clamp01((primarySweep * 0.58) + (counterSweep * 0.42));
    const movementExpression = clamp01((curveEnergy * 0.58) + (sweepExpression * 0.42));
    const lightSeeking = clamp01(runtime?.descriptors?.lightSeeking);
    const segmentCount = Math.max(4, Math.floor(toNumber(backbone.segmentCount, 8)));
    const knotCount = clamp(
        Math.round(
            lerp(4, 8, (movementExpression * 0.54) + (training * 0.18) + (apexSoftness * 0.1))
            + lerp(0, 1.4, clamp01((segmentCount - 4) / 8)),
        ),
        4,
        8,
    );
    const baseHeading = vecNormalize2([
        toNumber(backbone.lean, 0) + ((trunkT - 0.5) * 0.18),
        1,
        0,
    ]);
    const totalHeight = resolveNominalBackboneHeight({
        backbone,
        segmentCount,
        boundsHeight: height,
    });
    const maxSpan = (width * 0.5)
        * lerp(0.12, 0.38, movementExpression)
        * lerp(1, 0.82, clamp01((trunkCount - 1) / 2));
    const corridorBase = maxSpan * lerp(0.3, 0.76, movementExpression);
    const wavePhase = (sampleRandom?.(`backbone_spine_phase_${trunkIndex}`, 0) || 0) * TWO_PI;
    const waveFreq = lerp(0.76, 2.28, clamp01((curveEnergy * 0.54) + (sweepExpression * 0.46)))
        + (sampleRandom?.(`backbone_spine_freq_${trunkIndex}`, 0) || 0) * 0.34;
    const waveAmp = maxSpan * lerp(0.14, 0.62, movementExpression) * lerp(0.9, 1.14, training);
    const beamWidth = clamp(
        Math.round(lerp(2, 5, (movementExpression * 0.56) + (training * 0.22) + (apexSoftness * 0.22))),
        2,
        5,
    );
    const attractors = resolveBackboneAttractors({
        trunkIndex,
        runtime,
        sampleRandom,
        backbone,
        xOffset,
        width,
        totalHeight,
        maxSpan,
        curveEnergy,
        training,
        apexSoftness,
        firstSplitHeightRatio,
    });
    const rootPoint = {
        index: 0,
        progress: 0,
        position: [xOffset, 0, 0],
        heading: baseHeading,
        contributions: {},
        score: 0,
    };
    let beam = [{
        controlPoints: [rootPoint],
        totalScore: 0,
        beamScore: 0,
    }];

    for (let knotIndex = 1; knotIndex < knotCount; knotIndex += 1) {
        const progress = knotIndex / Math.max(1, knotCount - 1);
        const easedProgress = smoothstep(progress);
        const targetY = totalHeight * easedProgress;
        const leanDrift = resolveLeanDriftX({
            backbone,
            xOffset,
            width,
            progress,
        });
        const waveTarget = Math.sin((easedProgress * Math.PI * waveFreq) + wavePhase)
            * waveAmp
            * (0.2 + (easedProgress * 0.8));
        const lowerStability = clamp01(
            1 - (progress / Math.max(0.18, firstSplitHeightRatio * 0.92)),
        );
        const expandedStates = [];

        beam.forEach((state, stateIndex) => {
            const previous = state.controlPoints[state.controlPoints.length - 1];
            const previousPrevious = state.controlPoints.length >= 2
                ? state.controlPoints[state.controlPoints.length - 2]
                : null;
            const previousDeltaX = previousPrevious
                ? (previous.position[0] - previousPrevious.position[0])
                : 0;
            const predictedX = clamp(
                previous.position[0] + (previousDeltaX * lerp(0.3, 1.02, movementExpression)),
                xOffset - maxSpan,
                xOffset + maxSpan,
            );
            const attractorTargetX = resolveAttractorReferenceX({
                attractors,
                progress,
                fallbackX: leanDrift,
            });
            const referenceX = clamp(
                (leanDrift * 0.14)
                + (predictedX * 0.28)
                + ((attractorTargetX + waveTarget) * 0.58),
                xOffset - maxSpan,
                xOffset + maxSpan,
            );
            const corridorWidth = lerp(corridorBase * 0.54, corridorBase * 1.34, easedProgress)
                * lerp(0.92, 1.18, training)
                * lerp(0.94, 1.16, movementExpression);

            CANDIDATE_OFFSET_SCALES.forEach((offsetScale, candidateIndex) => {
                const jitter = signedCentered(
                    sampleRandom?.(`backbone_spine_knot_${trunkIndex}_${knotIndex}_${stateIndex}`, candidateIndex) || 0.5,
                ) * corridorWidth * 0.18;
                const x = clamp(
                    referenceX + (offsetScale * corridorWidth) + jitter,
                    xOffset - maxSpan,
                    xOffset + maxSpan,
                );
                const position = [x, targetY, 0];
                const heading = vecNormalize2([
                    x - previous.position[0],
                    Math.max(1, targetY - previous.position[1]),
                    0,
                ]);
                const light = lightField?.sampleWithPhototropism({
                    position,
                    heading,
                    bounds,
                    phototropismGain: lightSeeking,
                }) || { lightAlign: 0.5 };
                const style = styleField?.sample({
                    position,
                    heading,
                    bounds,
                }) || { styleAlign: 0.5, massBalance: 0.5 };
                const occupancy = occupancyField?.sampleDensity(position, lerp(18, 44, curveEnergy)) || 0;
                const nearestPriorDistance = state.controlPoints.length > 2
                    ? state.controlPoints.slice(0, -1).reduce(
                        (nearest, point) => Math.min(nearest, distance2(position, point.position)),
                        Number.POSITIVE_INFINITY,
                    )
                    : Number.POSITIVE_INFINITY;
                const selfCrowding = Number.isFinite(nearestPriorDistance) && nearestPriorDistance < Math.max(8, corridorWidth * 0.9)
                    ? clamp01(1 - (nearestPriorDistance / Math.max(8, corridorWidth * 0.9)))
                    : 0;
                const continuity = clamp01((dot2(heading, previous.heading) + 1) * 0.5);
                const guidance = clamp01(
                    1 - (Math.abs(x - referenceX) / Math.max(6, corridorWidth * 1.24)),
                );
                const memoryTarget = leanDrift + (previousDeltaX * lerp(0.5, 0.94, curveEnergy));
                const memoryAlign = clamp01(
                    1 - (Math.abs(x - memoryTarget) / Math.max(10, corridorWidth * 1.4)),
                );
                const deviationNorm = clamp01(
                    Math.abs(x - leanDrift) / Math.max(1, maxSpan),
                );
                const desiredDeviation = clamp01(
                    (movementExpression * (0.22 + (easedProgress * 0.66)))
                    + (training * 0.08),
                );
                const expressionFit = clamp01(
                    1 - (Math.abs(deviationNorm - desiredDeviation) / 0.74),
                );
                const verticalLift = clamp01((heading[1] - 0.36) / 0.64);
                const lowerStabilityPenalty = lowerStability
                    * clamp01(Math.abs(x - xOffset) / Math.max(1, maxSpan))
                    * lerp(1.02, 0.26, training)
                    * lerp(1, 0.58, movementExpression);
                const attractorContributions = resolveAttractorContributions({
                    attractors,
                    progress,
                    position,
                });
                const contributions = {
                    trunk_light: round(light.lightAlign * 0.16, 6),
                    trunk_style: round(style.styleAlign * 0.2, 6),
                    trunk_balance: round(style.massBalance * 0.16, 6),
                    trunk_continuity: round(continuity * lerp(0.22, 0.08, movementExpression), 6),
                    trunk_guidance: round(guidance * 0.16, 6),
                    trunk_memory: round(memoryAlign * 0.08, 6),
                    trunk_expression: round(expressionFit * 0.16, 6),
                    trunk_vertical: round(verticalLift * 0.06, 6),
                    trunk_occupancy_penalty: round(-occupancy * 0.24, 6),
                    trunk_self_crowding_penalty: round(-selfCrowding * 0.1, 6),
                    trunk_lower_stability_penalty: round(-lowerStabilityPenalty * 0.1, 6),
                    ...attractorContributions,
                };
                const localScore = Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0);
                const totalScore = state.totalScore + localScore;
                const futurePotential = resolveFutureAttractorPotential({
                    attractors,
                    progress,
                    position,
                    maxSpan,
                });
                expandedStates.push({
                    controlPoints: [
                        ...state.controlPoints,
                        {
                            index: knotIndex,
                            progress,
                            position,
                            heading,
                            contributions,
                            score: round(localScore, 6),
                            candidateCount: CANDIDATE_OFFSET_SCALES.length,
                            seedKey: `backbone_spine_knot_${trunkIndex}_${knotIndex}_${stateIndex}`,
                            randomValue: sampleRandom?.(`backbone_spine_knot_${trunkIndex}_${knotIndex}_${stateIndex}`, candidateIndex) || 0.5,
                        },
                    ],
                    totalScore,
                    beamScore: round(totalScore + futurePotential, 6),
                });
            });
        });

        beam = selectBeamStates({
            states: expandedStates,
            beamWidth,
            maxSpan,
        });
    }

    const finalized = beam.map((state) => ({
        ...state,
        finalScore: round(
            state.totalScore
            + resolveFinalAttractorCompletion({
                controlPoints: state.controlPoints,
                attractors,
                maxSpan,
            })
            + resolveSpanExpressionScore({
                controlPoints: state.controlPoints,
                curveEnergy,
                maxSpan,
            }),
            6,
        ),
    }));
    finalized.sort((left, right) => Number(right.finalScore) - Number(left.finalScore));
    const best = finalized[0] || {
        controlPoints: [rootPoint],
        totalScore: 0,
        finalScore: 0,
    };

    return {
        xOffset,
        totalHeight,
        beamWidth,
        attractors,
        controlPoints: best.controlPoints,
        samples: resampleSpineByArc({
            controlPoints: best.controlPoints,
            segmentCount,
        }),
        guideSamples: resampleSpineByArc({
            controlPoints: best.controlPoints,
            segmentCount: Math.max(18, segmentCount * 3),
        }),
    };
};
