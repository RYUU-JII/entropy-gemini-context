const clamp01 = (value) => Math.min(1, Math.max(0, value));

export const NEURAL_SKELETON_SOURCE_SIDE = 32;
export const NEURAL_SKELETON_POOLED_SIDE = 8;
export const NEURAL_SKELETON_SOURCE_SIZE = (
    NEURAL_SKELETON_SOURCE_SIDE * NEURAL_SKELETON_SOURCE_SIDE
);
export const NEURAL_SKELETON_POOLED_SIZE = (
    NEURAL_SKELETON_POOLED_SIDE * NEURAL_SKELETON_POOLED_SIDE
);

const NEURAL_SKELETON_POOL_STRIDE = (
    NEURAL_SKELETON_SOURCE_SIDE / NEURAL_SKELETON_POOLED_SIDE
);
const NEURAL_SKELETON_POOL_AREA = (
    NEURAL_SKELETON_POOL_STRIDE * NEURAL_SKELETON_POOL_STRIDE
);

const requireFiniteNumber = (value, field) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new TypeError(`ZEN_NEURAL_PREFERENCE_${field}_FINITE_REQUIRED`);
    }
    return numeric;
};

const resolveRuleScore = (ruleScore) => (
    ruleScore === null || typeof ruleScore === 'undefined'
        ? null
        : clamp01(requireFiniteNumber(ruleScore, 'RULE_SCORE'))
);

const resolveBlend = (blend) => clamp01(requireFiniteNumber(blend, 'BLEND'));

const resolveResidualGain = (residualGain) => Math.max(
    1e-6,
    requireFiniteNumber(residualGain, 'RESIDUAL_GAIN'),
);

export const averagePoolNeuralPreferenceSkeleton = (skeleton) => {
    if (!Array.isArray(skeleton) && !ArrayBuffer.isView(skeleton)) {
        throw new TypeError('ZEN_NEURAL_PREFERENCE_SKELETON_VECTOR_REQUIRED');
    }
    if (skeleton.length !== NEURAL_SKELETON_SOURCE_SIZE) {
        throw new RangeError(
            `ZEN_NEURAL_PREFERENCE_SKELETON_SIZE_INVALID:${skeleton.length}`,
        );
    }

    const pooled = new Array(NEURAL_SKELETON_POOLED_SIZE);
    for (let pooledRow = 0; pooledRow < NEURAL_SKELETON_POOLED_SIDE; pooledRow += 1) {
        for (let pooledColumn = 0; pooledColumn < NEURAL_SKELETON_POOLED_SIDE; pooledColumn += 1) {
            let sum = 0;
            const sourceRowStart = pooledRow * NEURAL_SKELETON_POOL_STRIDE;
            const sourceColumnStart = pooledColumn * NEURAL_SKELETON_POOL_STRIDE;
            for (let rowOffset = 0; rowOffset < NEURAL_SKELETON_POOL_STRIDE; rowOffset += 1) {
                for (
                    let columnOffset = 0;
                    columnOffset < NEURAL_SKELETON_POOL_STRIDE;
                    columnOffset += 1
                ) {
                    const sourceIndex = (
                        ((sourceRowStart + rowOffset) * NEURAL_SKELETON_SOURCE_SIDE)
                        + sourceColumnStart
                        + columnOffset
                    );
                    const value = Number(skeleton[sourceIndex]);
                    if (!Number.isFinite(value)) {
                        throw new TypeError(
                            `ZEN_NEURAL_PREFERENCE_SKELETON_VALUE_FINITE_REQUIRED:index=${sourceIndex}`,
                        );
                    }
                    sum += value;
                }
            }
            pooled[(pooledRow * NEURAL_SKELETON_POOLED_SIDE) + pooledColumn] = (
                sum / NEURAL_SKELETON_POOL_AREA
            );
        }
    }
    return pooled;
};

export const NEURAL_RULE_DECOUPLE_BLEND = 0.65;
export const NEURAL_RULE_RESIDUAL_GAIN = 0.9;

export const encodeNeuralPreferenceTarget = ({
    targetScore = 0.5,
    ruleScore = null,
    blend = NEURAL_RULE_DECOUPLE_BLEND,
    residualGain = NEURAL_RULE_RESIDUAL_GAIN,
} = {}) => {
    const safeTarget = clamp01(requireFiniteNumber(targetScore, 'TARGET_SCORE'));
    const safeRule = resolveRuleScore(ruleScore);
    if (safeRule === null) {
        return safeTarget;
    }
    const safeBlend = resolveBlend(blend);
    const safeGain = resolveResidualGain(residualGain);
    const residualTarget = clamp01(0.5 + ((safeTarget - safeRule) * safeGain));
    return clamp01(
        (safeTarget * (1 - safeBlend))
        + (residualTarget * safeBlend),
    );
};

export const decodeNeuralPreferenceScore = ({
    neuralScore = 0.5,
    ruleScore = null,
    blend = NEURAL_RULE_DECOUPLE_BLEND,
    residualGain = NEURAL_RULE_RESIDUAL_GAIN,
} = {}) => {
    const safeNeural = clamp01(requireFiniteNumber(neuralScore, 'NEURAL_SCORE'));
    const safeRule = resolveRuleScore(ruleScore);
    if (safeRule === null) {
        return safeNeural;
    }
    const safeBlend = resolveBlend(blend);
    const safeGain = resolveResidualGain(residualGain);
    const directWeight = 1 - safeBlend;
    const projectEncodedScore = (target) => clamp01(
        (target * directWeight)
        + (clamp01(0.5 + ((target - safeRule) * safeGain)) * safeBlend),
    );

    // The residual branch is clamped before it is blended, so the inverse is
    // piecewise. Project scores outside the encoder's reachable range back to
    // the matching target boundary instead of extrapolating through the clamp.
    const encodedAtZero = projectEncodedScore(0);
    const encodedAtOne = projectEncodedScore(1);
    if (safeNeural <= encodedAtZero) {
        return 0;
    }
    if (safeNeural >= encodedAtOne) {
        return 1;
    }

    const lowerResidualBoundary = clamp01(safeRule - (0.5 / safeGain));
    const upperResidualBoundary = clamp01(safeRule + (0.5 / safeGain));
    const encodedAtLowerBoundary = projectEncodedScore(lowerResidualBoundary);
    const encodedAtUpperBoundary = projectEncodedScore(upperResidualBoundary);

    if (safeNeural < encodedAtLowerBoundary) {
        return clamp01(safeNeural / directWeight);
    }
    if (safeNeural > encodedAtUpperBoundary) {
        return clamp01((safeNeural - safeBlend) / directWeight);
    }

    const residualSlope = directWeight + (safeBlend * safeGain);
    const residualOffset = safeBlend * (0.5 - (safeGain * safeRule));
    return clamp01((safeNeural - residualOffset) / residualSlope);
};
