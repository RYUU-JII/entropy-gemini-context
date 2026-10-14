const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

export const DPP_ARCHETYPE_METHOD = 'dpp_greedy_anchor';

const defaultDescriptorDistance = (a, b) => {
    if (!a || !b) {
        return 0;
    }
    const dx = Number(a.x ?? 0.5) - Number(b.x ?? 0.5);
    const dy = Number(a.y ?? 0.5) - Number(b.y ?? 0.5);
    return Math.sqrt((dx * dx) + (dy * dy));
};

const buildDppKernel = (entries = [], descriptorDistance = defaultDescriptorDistance) => {
    const candidates = Array.isArray(entries) ? entries : [];
    const distances = [];
    for (let row = 0; row < candidates.length; row += 1) {
        for (let col = row + 1; col < candidates.length; col += 1) {
            distances.push(
                descriptorDistance(candidates[row].descriptor, candidates[col].descriptor),
            );
        }
    }

    const sortedDistances = distances
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    const medianDistance = sortedDistances.length
        ? sortedDistances[Math.floor(sortedDistances.length / 2)]
        : 0.2;
    const sigma = clamp(medianDistance, 0.08, 0.65);

    return candidates.map((rowEntry, row) => candidates.map((colEntry, col) => {
        const rowSelection = clamp01(Number(rowEntry.__selection ?? 0));
        const colSelection = clamp01(Number(colEntry.__selection ?? 0));
        const rowQuality = 0.5 + (rowSelection * 0.9);
        const colQuality = 0.5 + (colSelection * 0.9);
        const distance = descriptorDistance(rowEntry.descriptor, colEntry.descriptor);
        const similarity = Math.exp(-((distance * distance) / (2 * sigma * sigma)));
        const base = rowQuality * colQuality * similarity;
        return row === col ? base + 1e-6 : base;
    }));
};

const determinant = (matrix = []) => {
    const size = Array.isArray(matrix) ? matrix.length : 0;
    if (!size) {
        return 0;
    }
    if (size === 1) {
        return Number(matrix[0]?.[0] ?? 0);
    }

    const work = matrix.map((row) => row.map((value) => Number(value) || 0));
    let sign = 1;
    let det = 1;
    for (let col = 0; col < size; col += 1) {
        let pivotRow = col;
        let pivotAbs = Math.abs(work[col][col]);
        for (let row = col + 1; row < size; row += 1) {
            const candidateAbs = Math.abs(work[row][col]);
            if (candidateAbs > pivotAbs) {
                pivotAbs = candidateAbs;
                pivotRow = row;
            }
        }
        if (pivotAbs <= 1e-12) {
            return 0;
        }
        if (pivotRow !== col) {
            [work[col], work[pivotRow]] = [work[pivotRow], work[col]];
            sign *= -1;
        }

        const pivot = work[col][col];
        det *= pivot;
        for (let row = col + 1; row < size; row += 1) {
            const factor = work[row][col] / pivot;
            if (!Number.isFinite(factor) || Math.abs(factor) <= 1e-15) {
                continue;
            }
            for (let k = col; k < size; k += 1) {
                work[row][k] -= factor * work[col][k];
            }
        }
    }
    return det * sign;
};

const buildSubmatrix = (matrix = [], indices = []) => (
    indices.map((row) => indices.map((col) => Number(matrix?.[row]?.[col] ?? 0)))
);

const annotateArchetypeSet = (entries = [], descriptorDistance = defaultDescriptorDistance) => {
    const candidates = Array.isArray(entries) ? entries : [];
    return candidates.map((entry, index) => {
        const distances = candidates
            .map((other, otherIndex) => (
                otherIndex === index
                    ? null
                    : descriptorDistance(entry?.descriptor, other?.descriptor)
            ))
            .filter((value) => Number.isFinite(value));
        const minDistance = distances.length ? Math.min(...distances) : 0;
        const meanDistance = distances.length
            ? distances.reduce((acc, value) => acc + value, 0) / distances.length
            : 0;
        return {
            ...entry,
            archetypeMeta: {
                rank: index + 1,
                minDistance: round(minDistance, 3),
                meanDistance: round(meanDistance, 3),
            },
        };
    });
};

export const selectDppArchetypeSet = ({
    entries = [],
    desiredCount = 3,
    scoreForSelection = () => 0,
    resolveDescriptor = (entry) => entry?.descriptor || null,
    descriptorDistance = defaultDescriptorDistance,
    qualityBoostScale = 0.04,
} = {}) => {
    const candidates = (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
            ...entry,
            descriptor: resolveDescriptor(entry),
            __selection: Number.isFinite(entry?.__selection)
                ? Number(entry.__selection)
                : Number(scoreForSelection(entry) || 0),
        }))
        .filter((entry) => Number.isFinite(entry?.descriptor?.x) && Number.isFinite(entry?.descriptor?.y))
        .sort((a, b) => Number(b.__selection || 0) - Number(a.__selection || 0));

    if (!candidates.length) {
        return [];
    }

    const safeDesiredCount = Number.isFinite(desiredCount) ? Math.floor(desiredCount) : 3;
    const targetCount = Math.max(1, Math.min(safeDesiredCount, candidates.length));
    if (targetCount === 1) {
        return annotateArchetypeSet([candidates[0]], descriptorDistance);
    }

    const kernel = buildDppKernel(candidates, descriptorDistance);
    const selectedIndices = [0];
    while (selectedIndices.length < targetCount) {
        let bestIndex = -1;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let candidateIndex = 1; candidateIndex < candidates.length; candidateIndex += 1) {
            if (selectedIndices.includes(candidateIndex)) {
                continue;
            }
            const subset = [...selectedIndices, candidateIndex];
            const subsetDet = determinant(buildSubmatrix(kernel, subset));
            const logDet = Math.log(Math.max(1e-12, subsetDet));
            const qualityBoost = clamp01(Number(candidates[candidateIndex].__selection || 0))
                * qualityBoostScale;
            const objective = logDet + qualityBoost;
            if (objective > bestScore) {
                bestScore = objective;
                bestIndex = candidateIndex;
            }
        }
        if (bestIndex < 0) {
            break;
        }
        selectedIndices.push(bestIndex);
    }

    return annotateArchetypeSet(
        selectedIndices.map((index) => candidates[index]),
        descriptorDistance,
    );
};
