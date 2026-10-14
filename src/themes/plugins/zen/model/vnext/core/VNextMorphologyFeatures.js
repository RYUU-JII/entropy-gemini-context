const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

export const resolveVNextMorphologyFeatures = (topology = null) => {
    const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
    if (!nodes.length) {
        return {
            firstSplitHeightNorm: 0,
            spreadRatio: 0,
            trunkDominance: 0,
            taperConsistency: 0,
            branchComplexity: 0,
            padBandingScore: 0,
            padSeparationScore: 0,
            negativeSpaceScore: 0,
        };
    }
    const points = [];
    let totalLength = 0;
    let trunkLength = 0;
    let branchOrderGe2Count = 0;
    let firstSplitY = Infinity;
    const nodeById = new Map();
    nodes.forEach((node) => {
        if (node && typeof node.id === 'string') {
            nodeById.set(node.id, node);
        }
        const p0 = Array.isArray(node?.p0) ? node.p0 : null;
        const p1 = Array.isArray(node?.p1) ? node.p1 : null;
        if (p0 && p0.length >= 2) {
            points.push({ x: toNumber(p0[0]), y: toNumber(p0[1]) });
        }
        if (p1 && p1.length >= 2) {
            points.push({ x: toNumber(p1[0]), y: toNumber(p1[1]) });
        }
        const length = Math.max(0, toNumber(node?.length, 0));
        totalLength += length;
        if (toNumber(node?.order, 0) <= 0) {
            trunkLength += length;
        }
        if (toNumber(node?.order, 0) >= 2) {
            branchOrderGe2Count += 1;
        }
        if (toNumber(node?.order, 0) >= 1 && p0 && p0.length >= 2) {
            firstSplitY = Math.min(firstSplitY, toNumber(p0[1], Infinity));
        }
    });

    const minX = Math.min(...points.map((entry) => entry.x));
    const maxX = Math.max(...points.map((entry) => entry.x));
    const minY = Math.min(...points.map((entry) => entry.y));
    const maxY = Math.max(...points.map((entry) => entry.y));
    const widthSpan = Math.max(1e-6, maxX - minX);
    const heightSpan = Math.max(1e-6, maxY - minY);
    const spreadRatio = clamp01(widthSpan / Math.max(1e-6, heightSpan * 1.6));
    const firstSplitHeightNorm = Number.isFinite(firstSplitY)
        ? clamp01((firstSplitY - minY) / heightSpan)
        : 0;
    let taperComparisons = 0;
    let taperPass = 0;
    nodes.forEach((node) => {
        const parentId = typeof node?.parentId === 'string' ? node.parentId : null;
        if (!parentId) {
            return;
        }
        const parent = nodeById.get(parentId);
        if (!parent) {
            return;
        }
        const parentRadius = Math.max(0, toNumber(parent?.radius1, parent?.radius0));
        const childRadius = Math.max(0, toNumber(node?.radius0, node?.radius1));
        if (parentRadius <= 0 || childRadius <= 0) {
            return;
        }
        taperComparisons += 1;
        if (childRadius <= (parentRadius * 1.03)) {
            taperPass += 1;
        }
    });

    const terminalPoints = nodes
        .filter((node) => Array.isArray(node?.children) && !node.children.length)
        .map((node) => ({
            x: toNumber(node?.p1?.[0], 0),
            y: toNumber(node?.p1?.[1], 0),
            order: toNumber(node?.order, 0),
        }));
    const fallbackPoints = nodes
        .filter((node) => toNumber(node?.order, 0) >= 1)
        .map((node) => ({
            x: toNumber(node?.p1?.[0], 0),
            y: toNumber(node?.p1?.[1], 0),
            order: toNumber(node?.order, 0),
        }));
    const canopyPoints = terminalPoints.length ? terminalPoints : fallbackPoints;
    const bandCount = 8;
    const bands = Array.from({ length: bandCount }, () => 0);
    let midBandCount = 0;
    let corridorCount = 0;
    let sideLeftCount = 0;
    let sideRightCount = 0;
    canopyPoints.forEach((point) => {
        const xNorm = clamp(((point.x - minX) / widthSpan) * 2 - 1, -1, 1);
        const yNorm = clamp01((point.y - minY) / heightSpan);
        const bandIndex = Math.max(0, Math.min(
            bandCount - 1,
            Math.floor(yNorm * bandCount),
        ));
        bands[bandIndex] += 1;
        if (yNorm >= 0.22 && yNorm <= 0.92) {
            midBandCount += 1;
            if (Math.abs(xNorm) <= 0.18) {
                corridorCount += 1;
            } else if (xNorm < -0.18) {
                sideLeftCount += 1;
            } else if (xNorm > 0.18) {
                sideRightCount += 1;
            }
        }
    });
    const meanBand = bands.reduce((acc, value) => acc + value, 0) / Math.max(1, bands.length);
    let peaks = 0;
    let valleys = 0;
    for (let index = 1; index < bands.length - 1; index += 1) {
        const prev = bands[index - 1];
        const current = bands[index];
        const next = bands[index + 1];
        if (current >= prev && current >= next && current >= (meanBand * 1.05)) {
            peaks += 1;
        }
        if (current <= prev && current <= next && current <= (meanBand * 0.72)) {
            valleys += 1;
        }
    }
    let maxGap = 0;
    let currentGap = 0;
    for (let index = 1; index < bands.length - 1; index += 1) {
        if (bands[index] <= (meanBand * 0.32)) {
            currentGap += 1;
        } else {
            maxGap = Math.max(maxGap, currentGap);
            currentGap = 0;
        }
    }
    maxGap = Math.max(maxGap, currentGap);
    const peakScore = clamp01(1 - (Math.abs(peaks - 3) / 3));
    const valleyScore = clamp01(valleys / 2.4);
    const padBandingScore = clamp01((peakScore * 0.62) + (valleyScore * 0.38));
    const padSeparationScore = clamp01((valleyScore * 0.58) + clamp01(maxGap / 2.5) * 0.42);

    const corridorRatio = corridorCount / Math.max(1, midBandCount);
    const corridorScore = clamp01(1 - (Math.abs(corridorRatio - 0.08) / 0.32));
    const sideTotal = sideLeftCount + sideRightCount;
    const sideBalance = clamp01(1 - (Math.abs(sideLeftCount - sideRightCount) / Math.max(1, sideTotal)));
    const negativeSpaceScore = clamp01((corridorScore * 0.72) + (sideBalance * 0.28));

    return {
        firstSplitHeightNorm: round(firstSplitHeightNorm, 6),
        spreadRatio: round(spreadRatio, 6),
        trunkDominance: round(clamp01(trunkLength / Math.max(1e-6, totalLength)), 6),
        taperConsistency: round(taperComparisons > 0 ? (taperPass / taperComparisons) : 0, 6),
        branchComplexity: round(clamp01(branchOrderGe2Count / Math.max(1, nodes.length)), 6),
        padBandingScore: round(padBandingScore, 6),
        padSeparationScore: round(padSeparationScore, 6),
        negativeSpaceScore: round(negativeSpaceScore, 6),
    };
};
