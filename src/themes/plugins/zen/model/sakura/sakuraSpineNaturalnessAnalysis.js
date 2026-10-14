import {
    sampleSakuraMacroSpineShapeAtArcNorm,
} from './sakuraMacroSpineGuide';

export const SAKURA_SPINE_NATURALNESS_ANALYSIS_VERSION = 1;
export const SAKURA_SPINE_NATURALNESS_ANALYSIS_POLICY = Object.freeze({
    policyId: 'sakura_spine_structural_naturalness_v1',
    sampleCount: 129,
    supportTurnThresholdDeg: 0.65,
    highTurnPeakThresholdDeg: 5,
    highTurnTotalThresholdDeg: 9,
    impulseEffectiveSupportMax: 1.45,
    impulseSupportArcRatioMax: 0.025,
    straightTurnThresholdDeg: 0.35,
    longStraightAfterHighTurnArcRatio: 0.12,
    turnConcentrationWindowArcRatio: 0.04,
    zigzagMinEventCount: 3,
    zigzagMagnitudeCvMax: 0.2,
    zigzagSpacingCvMax: 0.25,
    fidelitySampleCount: 129,
    fidelityPointRmsToleranceNorm: 0.002,
    fidelityPointMaxToleranceNorm: 0.006,
    fidelityTangentRmsToleranceDeg: 1.25,
    fidelityTangentMaxToleranceDeg: 4,
});

const EPSILON = 1e-9;
const RAD_TO_DEG = 180 / Math.PI;

const isObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const normalizeAngle = (value) => {
    let angle = Number(value) || 0;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
};

const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);

const mean = (values) => (
    values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0
);

const rootMeanSquare = (values) => Math.sqrt(mean(values.map((value) => value ** 2)));

const standardDeviation = (values) => {
    if (!values.length) return 0;
    const average = mean(values);
    return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

const coefficientOfVariation = (values) => {
    const average = mean(values);
    return average > EPSILON ? standardDeviation(values) / average : 0;
};

const quantile = (values, position) => {
    if (!values.length) return 0;
    const ordered = [...values].sort((left, right) => left - right);
    const index = clamp(position, 0, 1) * (ordered.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return ordered[lower];
    const t = index - lower;
    return ordered[lower] + ((ordered[upper] - ordered[lower]) * t);
};

const requirePolicy = (policy) => {
    if (!isObject(policy)) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_POLICY_REQUIRED');
    }
    const positiveFields = [
        'supportTurnThresholdDeg',
        'highTurnPeakThresholdDeg',
        'highTurnTotalThresholdDeg',
        'impulseEffectiveSupportMax',
        'impulseSupportArcRatioMax',
        'straightTurnThresholdDeg',
        'longStraightAfterHighTurnArcRatio',
        'turnConcentrationWindowArcRatio',
        'zigzagMinEventCount',
        'zigzagMagnitudeCvMax',
        'zigzagSpacingCvMax',
        'fidelityPointRmsToleranceNorm',
        'fidelityPointMaxToleranceNorm',
        'fidelityTangentRmsToleranceDeg',
        'fidelityTangentMaxToleranceDeg',
    ];
    positiveFields.forEach((field) => {
        if (!Number.isFinite(Number(policy[field])) || Number(policy[field]) <= 0) {
            throw new Error(`ZEN_SAKURA_SPINE_NATURALNESS_POLICY_INVALID:${field}`);
        }
    });
    ['sampleCount', 'fidelitySampleCount'].forEach((field) => {
        if (!Number.isSafeInteger(policy[field]) || policy[field] < 17) {
            throw new Error(`ZEN_SAKURA_SPINE_NATURALNESS_POLICY_INVALID:${field}`);
        }
    });
    if (!Number.isSafeInteger(policy.zigzagMinEventCount) || policy.zigzagMinEventCount < 3) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_POLICY_INVALID:zigzagMinEventCount');
    }
    return policy;
};

const requirePointSeries = (points) => {
    if (!Array.isArray(points) || points.length < 3) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_POINTS_REQUIRED');
    }
    const normalized = points.map((point, index) => {
        const x = Number(point?.x);
        const y = Number(point?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(`ZEN_SAKURA_SPINE_NATURALNESS_POINT_INVALID:${index}`);
        }
        return { x, y };
    });
    const totalArc = normalized.slice(1).reduce((sum, point, index) => (
        sum + distance(normalized[index], point)
    ), 0);
    if (totalArc <= EPSILON) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_ARC_INVALID');
    }
    return normalized;
};

const resamplePolylineAtUniformArc = (points, count) => {
    const source = requirePointSeries(points);
    const stations = [{ index: 0, arc: 0 }];
    let totalArc = 0;
    source.slice(1).forEach((point, index) => {
        totalArc += distance(source[index], point);
        stations.push({ index: index + 1, arc: totalArc });
    });
    let rightIndex = 1;
    return Array.from({ length: count }, (_, sampleIndex) => {
        const targetArc = totalArc * (sampleIndex / (count - 1));
        while (
            rightIndex < stations.length - 1
            && stations[rightIndex].arc < targetArc - EPSILON
        ) {
            rightIndex += 1;
        }
        const right = stations[rightIndex];
        const left = stations[Math.max(0, rightIndex - 1)];
        const span = Math.max(EPSILON, right.arc - left.arc);
        const t = clamp((targetArc - left.arc) / span, 0, 1);
        return {
            x: source[left.index].x + ((source[right.index].x - source[left.index].x) * t),
            y: source[left.index].y + ((source[right.index].y - source[left.index].y) * t),
            arcNorm: sampleIndex / (count - 1),
        };
    });
};

const resolveTurnSamples = (points) => points.slice(1, -1).map((point, offset) => {
    const index = offset + 1;
    const previous = points[index - 1];
    const next = points[index + 1];
    const incomingAngle = Math.atan2(point.y - previous.y, point.x - previous.x);
    const outgoingAngle = Math.atan2(next.y - point.y, next.x - point.x);
    const signedTurnRad = normalizeAngle(outgoingAngle - incomingAngle);
    const localArc = (
        distance(previous, point)
        + distance(point, next)
    ) * 0.5;
    return {
        index,
        arcNorm: index / (points.length - 1),
        signedTurnRad,
        absTurnRad: Math.abs(signedTurnRad),
        curvature: signedTurnRad / Math.max(EPSILON, localArc),
    };
});

const createTurnEvents = ({ turns, pointCount, policy }) => {
    const supportThreshold = Number(policy.supportTurnThresholdDeg) / RAD_TO_DEG;
    const groups = [];
    turns.forEach((turn) => {
        if (turn.absTurnRad < supportThreshold) return;
        const sign = Math.sign(turn.signedTurnRad);
        const previous = groups.at(-1);
        if (
            previous
            && previous.sign === sign
            && turn.index === previous.lastIndex + 1
        ) {
            previous.samples.push(turn);
            previous.lastIndex = turn.index;
            return;
        }
        groups.push({
            sign,
            firstIndex: turn.index,
            lastIndex: turn.index,
            samples: [turn],
        });
    });

    const peakThresholdRad = Number(policy.highTurnPeakThresholdDeg) / RAD_TO_DEG;
    const totalThresholdRad = Number(policy.highTurnTotalThresholdDeg) / RAD_TO_DEG;
    return groups.map((group, index) => {
        const totalAbsTurnRad = group.samples.reduce(
            (sum, sample) => sum + sample.absTurnRad,
            0,
        );
        const peakTurnRad = Math.max(...group.samples.map((sample) => sample.absTurnRad));
        const effectiveSupportSamples = totalAbsTurnRad / Math.max(EPSILON, peakTurnRad);
        const supportArcRatio = (
            group.lastIndex - group.firstIndex + 1
        ) / (pointCount - 1);
        const highTurn = peakTurnRad >= peakThresholdRad
            || totalAbsTurnRad >= totalThresholdRad;
        const singleSampleImpulse = highTurn
            && effectiveSupportSamples <= Number(policy.impulseEffectiveSupportMax)
            && supportArcRatio <= Number(policy.impulseSupportArcRatioMax);
        return Object.freeze({
            index,
            sign: group.sign,
            startArcNorm: group.firstIndex / (pointCount - 1),
            endArcNorm: group.lastIndex / (pointCount - 1),
            centerArcNorm: (
                group.firstIndex + group.lastIndex
            ) / (2 * (pointCount - 1)),
            activeSampleCount: group.samples.length,
            effectiveSupportSamples,
            supportArcRatio,
            totalTurnDeg: totalAbsTurnRad * RAD_TO_DEG,
            peakTurnDeg: peakTurnRad * RAD_TO_DEG,
            highTurn,
            classification: !highTurn
                ? 'minor_turn'
                : (singleSampleImpulse
                    ? 'single_sample_impulse'
                    : 'finite_support_joint'),
        });
    });
};

const resolveTurnConcentration = ({ turns, pointCount, policy }) => {
    const totalAbsTurnRad = turns.reduce((sum, turn) => sum + turn.absTurnRad, 0);
    if (totalAbsTurnRad <= EPSILON) {
        return Object.freeze({
            totalAbsTurnDeg: 0,
            peakTurnDeg: 0,
            peakTurnShare: 0,
            windowArcRatio: Number(policy.turnConcentrationWindowArcRatio),
            maxWindowTurnShare: 0,
            maxWindowCenterArcNorm: 0,
        });
    }
    const windowSamples = Math.max(
        1,
        Math.round(Number(policy.turnConcentrationWindowArcRatio) * (pointCount - 1)),
    );
    let maximumWindowTurn = 0;
    let maximumWindowStart = 0;
    turns.forEach((_, index) => {
        const windowTurn = turns.slice(index, index + windowSamples).reduce(
            (sum, turn) => sum + turn.absTurnRad,
            0,
        );
        if (windowTurn > maximumWindowTurn) {
            maximumWindowTurn = windowTurn;
            maximumWindowStart = index;
        }
    });
    const peakTurnRad = Math.max(...turns.map((turn) => turn.absTurnRad));
    return Object.freeze({
        totalAbsTurnDeg: totalAbsTurnRad * RAD_TO_DEG,
        peakTurnDeg: peakTurnRad * RAD_TO_DEG,
        peakTurnShare: peakTurnRad / totalAbsTurnRad,
        windowArcRatio: Number(policy.turnConcentrationWindowArcRatio),
        maxWindowTurnShare: maximumWindowTurn / totalAbsTurnRad,
        maxWindowCenterArcNorm: clamp(
            (maximumWindowStart + (windowSamples * 0.5) + 1) / (pointCount - 1),
            0,
            1,
        ),
    });
};

const resolveStraightAfterHighTurn = ({ turns, events, pointCount, policy }) => {
    const highEvents = events.filter((event) => event.highTurn);
    const straightThreshold = Number(policy.straightTurnThresholdDeg) / RAD_TO_DEG;
    let longest = null;
    highEvents.forEach((event, eventIndex) => {
        const startTurnIndex = Math.round(event.endArcNorm * (pointCount - 1));
        let cursor = turns.findIndex((turn) => turn.index > startTurnIndex);
        if (cursor < 0) return;
        const firstStraightIndex = cursor;
        while (cursor < turns.length && turns[cursor].absTurnRad <= straightThreshold) {
            cursor += 1;
        }
        const straightSampleCount = cursor - firstStraightIndex;
        if (!straightSampleCount) return;
        const nextHighEvent = highEvents[eventIndex + 1] || null;
        const run = {
            startArcNorm: turns[firstStraightIndex].arcNorm,
            endArcNorm: turns[cursor - 1].arcNorm,
            arcRatio: (straightSampleCount + 1) / (pointCount - 1),
            boundedByHighTurn: Boolean(
                nextHighEvent
                && nextHighEvent.startArcNorm
                    <= turns[Math.min(cursor, turns.length - 1)].arcNorm + EPSILON
            ),
        };
        if (!longest || run.arcRatio > longest.arcRatio) longest = run;
    });
    const resolved = longest || {
        startArcNorm: 0,
        endArcNorm: 0,
        arcRatio: 0,
        boundedByHighTurn: false,
    };
    return Object.freeze({
        ...resolved,
        sharpStraightSharpDetected: (
            resolved.boundedByHighTurn
            && resolved.arcRatio >= Number(policy.longStraightAfterHighTurnArcRatio)
        ),
    });
};

const resolveAlternatingEqualZigzag = ({ events, policy }) => {
    const highEvents = events.filter((event) => event.highTurn);
    let best = null;
    highEvents.forEach((event, startIndex) => {
        const chain = [event];
        for (let index = startIndex + 1; index < highEvents.length; index += 1) {
            if (highEvents[index].sign === chain.at(-1).sign) break;
            chain.push(highEvents[index]);
        }
        if (chain.length < Number(policy.zigzagMinEventCount)) return;
        const magnitudes = chain.map((entry) => entry.totalTurnDeg);
        const spacing = chain.slice(1).map((entry, index) => (
            entry.centerArcNorm - chain[index].centerArcNorm
        ));
        const magnitudeCv = coefficientOfVariation(magnitudes);
        const spacingCv = coefficientOfVariation(spacing);
        const magnitudeScore = clamp(
            1 - (magnitudeCv / Number(policy.zigzagMagnitudeCvMax)),
            0,
            1,
        );
        const spacingScore = clamp(
            1 - (spacingCv / Number(policy.zigzagSpacingCvMax)),
            0,
            1,
        );
        const score = Math.sqrt(magnitudeScore * spacingScore);
        const candidate = {
            eventCount: chain.length,
            startArcNorm: chain[0].startArcNorm,
            endArcNorm: chain.at(-1).endArcNorm,
            magnitudeCv,
            spacingCv,
            score,
        };
        if (!best || candidate.eventCount > best.eventCount || (
            candidate.eventCount === best.eventCount && candidate.score > best.score
        )) {
            best = candidate;
        }
    });
    const resolved = best || {
        eventCount: 0,
        startArcNorm: 0,
        endArcNorm: 0,
        magnitudeCv: 0,
        spacingCv: 0,
        score: 0,
    };
    return Object.freeze({
        ...resolved,
        detected: (
            resolved.eventCount >= Number(policy.zigzagMinEventCount)
            && resolved.magnitudeCv <= Number(policy.zigzagMagnitudeCvMax)
            && resolved.spacingCv <= Number(policy.zigzagSpacingCvMax)
        ),
    });
};

const resolveCurvatureDynamics = (turns) => {
    const rates = turns.slice(1).map((turn, index) => {
        const previous = turns[index];
        const arcStep = Math.max(EPSILON, turn.arcNorm - previous.arcNorm);
        return (turn.curvature - previous.curvature) / arcStep;
    });
    const jerks = rates.slice(1).map((rate, index) => {
        const arcStep = Math.max(
            EPSILON,
            turns[index + 2].arcNorm - turns[index + 1].arcNorm,
        );
        return (rate - rates[index]) / arcStep;
    });
    const absoluteCurvature = turns.map((turn) => Math.abs(turn.curvature));
    const absoluteRates = rates.map(Math.abs);
    const absoluteJerks = jerks.map(Math.abs);
    return Object.freeze({
        curvatureAbsP95: quantile(absoluteCurvature, 0.95),
        curvatureAbsMax: Math.max(0, ...absoluteCurvature),
        curvatureRateAbsP95: quantile(absoluteRates, 0.95),
        curvatureRateAbsMax: Math.max(0, ...absoluteRates),
        curvatureJerkAbsP95: quantile(absoluteJerks, 0.95),
        curvatureJerkAbsMax: Math.max(0, ...absoluteJerks),
        units: Object.freeze({
            curvature: 'coordinate_norm^-1',
            curvatureRate: 'coordinate_norm^-1_per_arc_norm',
            curvatureJerk: 'coordinate_norm^-1_per_arc_norm^2',
        }),
    });
};

const cubicPoint = (segment, t) => {
    const u = 1 - t;
    return {
        x: (u ** 3 * segment.startX)
            + (3 * u * u * t * segment.cp1X)
            + (3 * u * t * t * segment.cp2X)
            + (t ** 3 * segment.endX),
        y: (u ** 3 * segment.startY)
            + (3 * u * u * t * segment.cp1Y)
            + (3 * u * t * t * segment.cp2Y)
            + (t ** 3 * segment.endY),
    };
};

const requireEmittedSpans = (spans) => {
    if (!Array.isArray(spans) || !spans.length) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_EMITTED_SPANS_REQUIRED');
    }
    return spans.map((span, index) => {
        const geometry = span?.branchSegment;
        if (!isObject(geometry)) {
            throw new Error(`ZEN_SAKURA_SPINE_NATURALNESS_EMITTED_SPAN_INVALID:${index}`);
        }
        [
            'startX',
            'startY',
            'cp1X',
            'cp1Y',
            'cp2X',
            'cp2Y',
            'endX',
            'endY',
        ].forEach((field) => {
            if (!Number.isFinite(Number(geometry[field]))) {
                throw new Error(
                    `ZEN_SAKURA_SPINE_NATURALNESS_EMITTED_SPAN_INVALID:${index}.${field}`,
                );
            }
        });
        return geometry;
    });
};

const sampleEmittedSpans = ({ spans, scale, count }) => {
    const geometries = requireEmittedSpans(spans);
    const resolvedScale = Number(scale);
    if (!Number.isFinite(resolvedScale) || resolvedScale <= 0) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_EMITTED_SCALE_INVALID');
    }
    const samplesPerSpan = Math.max(8, Math.ceil((count * 2) / geometries.length));
    const root = cubicPoint(geometries[0], 0);
    const dense = [];
    geometries.forEach((geometry, geometryIndex) => {
        for (let sampleIndex = 0; sampleIndex <= samplesPerSpan; sampleIndex += 1) {
            if (geometryIndex > 0 && sampleIndex === 0) continue;
            const point = cubicPoint(geometry, sampleIndex / samplesPerSpan);
            dense.push({
                x: (point.x - root.x) / resolvedScale,
                y: (point.y - root.y) / resolvedScale,
            });
        }
    });
    return resamplePolylineAtUniformArc(dense, count);
};

const resolveSampleHeading = (points, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    return Math.atan2(next.y - previous.y, next.x - previous.x);
};

export const analyzeSakuraGuideEmissionFidelityV1 = ({
    shape,
    emittedSpans,
    emittedScale,
    policy = SAKURA_SPINE_NATURALNESS_ANALYSIS_POLICY,
} = {}) => {
    const resolvedPolicy = requirePolicy(policy);
    const count = resolvedPolicy.fidelitySampleCount;
    if (!isObject(shape) || !Array.isArray(shape.segments) || !shape.segments.length) {
        throw new Error('ZEN_SAKURA_SPINE_NATURALNESS_SHAPE_REQUIRED');
    }
    const guidePoints = sampleEmittedSpans({
        spans: shape.segments.map((segment) => ({ branchSegment: segment })),
        scale: 1,
        count,
    });
    const emittedPoints = sampleEmittedSpans({
        spans: emittedSpans,
        scale: emittedScale,
        count,
    });
    const pointDistances = guidePoints.map((point, index) => (
        distance(point, emittedPoints[index])
    ));
    const tangentDeltasDeg = guidePoints.map((_, index) => Math.abs(normalizeAngle(
        resolveSampleHeading(emittedPoints, index)
        - resolveSampleHeading(guidePoints, index),
    )) * RAD_TO_DEG);
    const pointRmsNorm = rootMeanSquare(pointDistances);
    const pointMaxNorm = Math.max(...pointDistances);
    const tangentRmsDeg = rootMeanSquare(tangentDeltasDeg);
    const tangentMaxDeg = Math.max(...tangentDeltasDeg);
    return Object.freeze({
        version: SAKURA_SPINE_NATURALNESS_ANALYSIS_VERSION,
        sampleCount: count,
        pointRmsNorm,
        pointMaxNorm,
        tangentRmsDeg,
        tangentMaxDeg,
        endpointDistanceNorm: pointDistances.at(-1),
        driftDetected: (
            pointRmsNorm > resolvedPolicy.fidelityPointRmsToleranceNorm
            || pointMaxNorm > resolvedPolicy.fidelityPointMaxToleranceNorm
            || tangentRmsDeg > resolvedPolicy.fidelityTangentRmsToleranceDeg
            || tangentMaxDeg > resolvedPolicy.fidelityTangentMaxToleranceDeg
        ),
    });
};

export const analyzeSakuraSpinePointSeriesV1 = ({
    points,
    policy = SAKURA_SPINE_NATURALNESS_ANALYSIS_POLICY,
} = {}) => {
    const resolvedPolicy = requirePolicy(policy);
    const sampledPoints = resamplePolylineAtUniformArc(points, resolvedPolicy.sampleCount);
    const turns = resolveTurnSamples(sampledPoints);
    const events = createTurnEvents({
        turns,
        pointCount: sampledPoints.length,
        policy: resolvedPolicy,
    });
    const highEvents = events.filter((event) => event.highTurn);
    const impulseEvents = highEvents.filter(
        (event) => event.classification === 'single_sample_impulse',
    );
    const finiteSupportJoints = highEvents.filter(
        (event) => event.classification === 'finite_support_joint',
    );
    const straightAfterHighTurn = resolveStraightAfterHighTurn({
        turns,
        events,
        pointCount: sampledPoints.length,
        policy: resolvedPolicy,
    });
    const alternatingEqualZigzag = resolveAlternatingEqualZigzag({
        events,
        policy: resolvedPolicy,
    });
    return Object.freeze({
        version: SAKURA_SPINE_NATURALNESS_ANALYSIS_VERSION,
        policyId: resolvedPolicy.policyId,
        sampleCount: sampledPoints.length,
        semantics: Object.freeze({
            finiteSupportJoint: 'localized turn carried by more than one effective sample',
            singleSampleImpulse: 'high turn concentrated below the finite-support window',
            flagsAreDiagnosticOnly: true,
        }),
        turnConcentration: resolveTurnConcentration({
            turns,
            pointCount: sampledPoints.length,
            policy: resolvedPolicy,
        }),
        curvatureDynamics: resolveCurvatureDynamics(turns),
        turnEvents: Object.freeze(events),
        finiteSupportJointCount: finiteSupportJoints.length,
        singleSampleImpulseCount: impulseEvents.length,
        straightAfterHighTurn,
        alternatingEqualZigzag,
        flags: Object.freeze({
            singleSampleImpulseDetected: impulseEvents.length > 0,
            sharpStraightSharpDetected: straightAfterHighTurn.sharpStraightSharpDetected,
            alternatingEqualZigzagDetected: alternatingEqualZigzag.detected,
        }),
    });
};

export const analyzeSakuraMacroSpineNaturalnessV1 = ({
    shape,
    emittedSpans = null,
    emittedScale = null,
    policy = SAKURA_SPINE_NATURALNESS_ANALYSIS_POLICY,
} = {}) => {
    const resolvedPolicy = requirePolicy(policy);
    const points = Array.from({ length: resolvedPolicy.sampleCount }, (_, index) => {
        const sample = sampleSakuraMacroSpineShapeAtArcNorm(
            shape,
            index / (resolvedPolicy.sampleCount - 1),
        );
        return { x: sample.x, y: sample.y };
    });
    const structure = analyzeSakuraSpinePointSeriesV1({ points, policy: resolvedPolicy });
    const fidelity = emittedSpans === null
        ? Object.freeze({ available: false, driftDetected: false })
        : Object.freeze({
            available: true,
            ...analyzeSakuraGuideEmissionFidelityV1({
                shape,
                emittedSpans,
                emittedScale,
                policy: resolvedPolicy,
            }),
        });
    return Object.freeze({
        ...structure,
        fidelity,
        flags: Object.freeze({
            ...structure.flags,
            guideEmissionDriftDetected: fidelity.driftDetected,
        }),
    });
};
