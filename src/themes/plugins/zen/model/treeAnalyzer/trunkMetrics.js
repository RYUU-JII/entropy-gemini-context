import { SakuraTrunkSplineModel } from '../bonsai/generation/SakuraTrunkSplineModel';
import {
    EPS,
    clamp01,
    degToRad,
    distance,
    mean,
    normalizeAngleDelta,
    normalizeAroundTarget,
    round,
    safeDiv,
    stdDev,
} from './metricsMath';

export const isTrunkOrderSegment = (segment = {}) => {
    const order = Number(segment?.branchOrder);
    const name = String(segment?.branchOrderName || '').toLowerCase();
    return order === 0 || name === 'trunk';
};

const selectMainTrunkChain = (branchSegments = [], maxDepth = 8) => {
    const allSegments = Array.isArray(branchSegments) ? branchSegments : [];
    if (!allSegments.length) {
        return [];
    }

    const preferred = allSegments.filter((segment) => isTrunkOrderSegment(segment));
    const segments = preferred.length >= 2 ? preferred : allSegments;

    const root = segments
        .filter((segment) => segment.depth === 1 && (segment.parentId === null || segment.parentId === undefined))
        .sort((left, right) => ((right.width * right.length) - (left.width * left.length)))[0];
    if (!root) {
        return [];
    }

    const childrenByParent = new Map();
    segments.forEach((segment) => {
        if (segment.parentId === null || segment.parentId === undefined) {
            return;
        }
        if (!childrenByParent.has(segment.parentId)) {
            childrenByParent.set(segment.parentId, []);
        }
        childrenByParent.get(segment.parentId).push(segment);
    });

    const chain = [root];
    let current = root;
    while (chain.length < Math.max(1, Math.round(maxDepth))) {
        const candidates = (childrenByParent.get(current.id) || [])
            .filter((segment) => segment.depth === current.depth + 1);
        if (!candidates.length) {
            break;
        }

        const widthBase = Math.max(EPS, Number(current.width) || 1);
        const lengthBase = Math.max(EPS, Number(current.length) || 1);
        const next = [...candidates].sort((left, right) => {
            const score = (segment) => {
                const widthRatio = clamp01((Number(segment.width) || 0) / widthBase);
                const lengthRatio = clamp01((Number(segment.length) || 0) / lengthBase);
                const angleDelta = Math.abs(normalizeAngleDelta(
                    Number(segment.angle || 0) - Number(current.angle || 0),
                ));
                const angleContinuity = 1 - clamp01(angleDelta / (Math.PI * 0.75));
                const continuationBias = (
                    Number.isFinite(segment?.start?.x)
                    && Number.isFinite(segment?.start?.y)
                    && Number.isFinite(current?.end?.x)
                    && Number.isFinite(current?.end?.y)
                )
                    ? clamp01(
                        1 - (
                            distance(segment.start, current.end)
                            / Math.max(1, Number(current.length || 0) * 0.24)
                        ),
                    )
                    : 0.5;
                const trunkOrderBoost = isTrunkOrderSegment(segment) ? 0.1 : 0;
                return (
                    widthRatio * 0.42
                    + lengthRatio * 0.34
                    + angleContinuity * 0.18
                    + continuationBias * 0.06
                    + trunkOrderBoost
                );
            };
            return score(right) - score(left);
        })[0];

        if (!next) {
            break;
        }
        chain.push(next);
        current = next;
    }

    return chain;
};

const resolveTrunkDepthLimit = (topology) => Math.max(
    1,
    Math.round(Number(
        topology?.trunkDepthModel?.trunkSegmentLimit
        || topology?.trunkSpline?.trunkSegmentLimit
        || 1,
    ) || 1),
);

const collectTrunkGuideEntries = (topology, depthLimit = null) => {
    const resolvedDepthLimit = Number.isFinite(Number(depthLimit))
        ? Math.max(1, Math.round(Number(depthLimit)))
        : resolveTrunkDepthLimit(topology);
    const entries = [];
    for (let depth = 1; depth <= resolvedDepthLimit; depth += 1) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(
            topology?.trunkSpline,
            depth,
            resolvedDepthLimit,
        );
        if (!sample) {
            continue;
        }
        entries.push({
            depth,
            ...sample,
        });
    }
    return entries;
};

export const resolveTrunkDynamics = (topology, branchSegments = []) => {
    const depthLimit = resolveTrunkDepthLimit(topology);
    const entries = collectTrunkGuideEntries(topology, depthLimit);
    const targetDepth = Math.max(8, Math.min(36, entries.length || depthLimit || 12));
    const chain = selectMainTrunkChain(branchSegments, targetDepth);
    if (chain.length < 2) {
        return {
            chain,
            meanOffsetAbsRad: 0,
            offsetStdRad: 0,
            flipDensity: 0,
            curveMean: 0,
            curveStd: 0,
            netLeanRad: 0,
            leanAbsNorm: 0,
            leanBalance: 0.5,
            sweepScore: 0.5,
            smoothness: 0.5,
            continuity: 0.5,
        };
    }

    const offsets = [];
    for (let i = 1; i < chain.length; i += 1) {
        offsets.push(normalizeAngleDelta(Number(chain[i].angle || 0) - Number(chain[i - 1].angle || 0)));
    }

    const absOffsets = offsets.map((value) => Math.abs(value));
    const significantSigns = offsets.map((offset) => (
        Math.abs(offset) >= degToRad(1.8) ? Math.sign(offset) : 0
    ));
    let flips = 0;
    let previousSign = 0;
    let significantCount = 0;
    significantSigns.forEach((sign) => {
        if (sign === 0) {
            return;
        }
        significantCount += 1;
        if (previousSign !== 0 && previousSign !== sign) {
            flips += 1;
        }
        previousSign = sign;
    });

    const flipDensity = safeDiv(flips, Math.max(1, significantCount - 1), 0);
    const meanOffsetAbsRad = mean(absOffsets);
    const offsetStdRad = stdDev(absOffsets);
    const netLeanRad = offsets.reduce((acc, value) => acc + value, 0);
    const leanAbsNorm = clamp01(Math.abs(netLeanRad) / degToRad(68));
    const leanBalance = normalizeAroundTarget(Math.abs(netLeanRad), degToRad(14), degToRad(20));
    const curveSamples = chain.map((segment) => Math.abs(Number(segment?.curveRatio || 0)));
    const curveMean = mean(curveSamples);
    const curveStd = stdDev(curveSamples);
    const sweepScore = normalizeAroundTarget(meanOffsetAbsRad, degToRad(10), degToRad(9));
    const smoothness = clamp01(1 - safeDiv(offsetStdRad, degToRad(8.5), 1));
    const continuity = clamp01(1 - safeDiv(flipDensity, 0.72, 1));

    return {
        chain,
        meanOffsetAbsRad,
        offsetStdRad,
        flipDensity,
        curveMean,
        curveStd,
        netLeanRad,
        leanAbsNorm,
        leanBalance,
        sweepScore,
        smoothness,
        continuity,
    };
};

export const resolveBackboneMetrics = (topology, branchSegments) => {
    const depthLimit = resolveTrunkDepthLimit(topology);
    const entries = collectTrunkGuideEntries(topology, depthLimit);
    if (!entries.length) {
        return null;
    }

    const chain = selectMainTrunkChain(branchSegments, Math.max(entries.length, depthLimit));
    if (!chain.length) {
        return null;
    }

    const depthLogs = chain.map((segment) => {
        const entryIndex = Math.max(0, Math.min(entries.length - 1, segment.depth - 1));
        const entry = entries[entryIndex] || null;
        const targetAngle = Number(entry?.angle);
        const actualAngle = Number(segment.angle);
        const angleErrorDeg = (
            Number.isFinite(targetAngle)
            && Number.isFinite(actualAngle)
        )
            ? Math.abs(normalizeAngleDelta(actualAngle - targetAngle)) * (180 / Math.PI)
            : null;
        const actualCurveRatio = Math.abs(Number(segment.curveRatio) || 0);
        const targetCurveRatio = Math.abs(Number(entry?.curveRatio) || 0);
        const curveError = Math.abs(actualCurveRatio - targetCurveRatio);
        return {
            depth: segment.depth,
            angleErrorDeg: Number.isFinite(angleErrorDeg) ? round(angleErrorDeg, 2) : null,
            curveError: round(curveError, 4),
            actualCurveRatio: round(actualCurveRatio, 4),
            targetCurveRatio: round(targetCurveRatio, 4),
        };
    });

    const angleErrors = depthLogs
        .map((log) => Number(log?.angleErrorDeg))
        .filter((value) => Number.isFinite(value));
    const curveErrors = depthLogs
        .map((log) => Number(log?.curveError))
        .filter((value) => Number.isFinite(value));

    const angleErrorMeanDeg = angleErrors.length ? mean(angleErrors) : null;
    const curveErrorMean = curveErrors.length ? mean(curveErrors) : null;
    const alignmentScore = Number.isFinite(angleErrorMeanDeg)
        ? clamp01(1 - (angleErrorMeanDeg / 48))
        : 0.5;
    const curveMatchScore = Number.isFinite(curveErrorMean)
        ? clamp01(1 - (curveErrorMean / 0.24))
        : 0.5;
    const depthErrorStd = angleErrors.length > 1 ? stdDev(angleErrors) : 0;
    const depthStability = clamp01(1 - (depthErrorStd / 22));
    const depthAlignFor = (depth) => {
        const row = depthLogs.find((log) => Number(log?.depth) === depth);
        if (!row || !Number.isFinite(Number(row.angleErrorDeg))) {
            return alignmentScore;
        }
        return clamp01(1 - (Number(row.angleErrorDeg) / 52));
    };

    return {
        alignmentScore: round(alignmentScore, 4),
        curveMatchScore: round(curveMatchScore, 4),
        depthStability: round(depthStability, 4),
        depth1Alignment: round(depthAlignFor(1), 4),
        depth2Alignment: round(depthAlignFor(2), 4),
        angleErrorMeanDeg: Number.isFinite(angleErrorMeanDeg) ? round(angleErrorMeanDeg, 2) : null,
        curveErrorMean: Number.isFinite(curveErrorMean) ? round(curveErrorMean, 4) : null,
        depthCount: depthLogs.length,
        depthLogs: depthLogs
            .slice(0, 6)
            .map((log) => ({
                depth: Number(log.depth),
                angleErrorDeg: Number.isFinite(Number(log.angleErrorDeg))
                    ? Number(log.angleErrorDeg)
                    : null,
                curveError: Number(log.curveError),
            })),
    };
};
