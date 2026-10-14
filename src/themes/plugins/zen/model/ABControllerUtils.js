export const round = (value, digits = 3) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

export const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const randomSeed = () => Math.floor(Math.random() * 1000000);

export const safeLabel = (value) => (value === 'B' ? 'B' : 'A');

export const invertLabel = (value) => (safeLabel(value) === 'A' ? 'B' : 'A');

export const SPECIAL_QUERY = {
    PAIRWISE: 'pairwise',
    BEST_WORST: 'best_worst',
    ANCHOR: 'anchor',
};

export const DECISION_MODE = {
    BETTER: 'pick_better',
    WORSE: 'pick_worse',
};

export const DEFAULT_QUERY_TUNING = {
    bestWorstInterval: 5,
    anchorInterval: 9,
    minSpecialRound: 4,
    specialStrength: 1,
};

const clampRange = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
};

const clampIntRange = (value, min, max, fallback) => Math.round(
    clampRange(value, min, max, fallback),
);

export const sanitizeQueryTuning = (value = {}) => ({
    bestWorstInterval: clampIntRange(
        value?.bestWorstInterval,
        3,
        16,
        DEFAULT_QUERY_TUNING.bestWorstInterval,
    ),
    anchorInterval: clampIntRange(
        value?.anchorInterval,
        5,
        20,
        DEFAULT_QUERY_TUNING.anchorInterval,
    ),
    minSpecialRound: clampIntRange(
        value?.minSpecialRound,
        1,
        20,
        DEFAULT_QUERY_TUNING.minSpecialRound,
    ),
    specialStrength: Number(
        clampRange(
            value?.specialStrength,
            0.6,
            1.6,
            DEFAULT_QUERY_TUNING.specialStrength,
        ).toFixed(2),
    ),
});

export const buildScalarStats = (values = []) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return { mean: 0, std: 0 };
    }
    const mean = finite.reduce((acc, value) => acc + value, 0) / finite.length;
    const variance = finite.reduce((acc, value) => {
        const diff = value - mean;
        return acc + (diff * diff);
    }, 0) / Math.max(1, finite.length);
    return {
        mean,
        std: Math.sqrt(Math.max(0, variance)),
    };
};

const cloneCandidateForPair = (candidate) => {
    if (!candidate) {
        return null;
    }
    const modelInput = candidate?.modelInput && typeof candidate.modelInput === 'object'
        ? {
            ...candidate.modelInput,
            ...(candidate.modelInput?.features && typeof candidate.modelInput.features === 'object'
                ? { features: { ...candidate.modelInput.features } }
                : {}),
            ...(candidate.modelInput?.latent && typeof candidate.modelInput.latent === 'object'
                ? { latent: { ...candidate.modelInput.latent } }
                : {}),
        }
        : candidate?.modelInput;
    const render = candidate?.render && typeof candidate.render === 'object'
        ? {
            ...candidate.render,
            ...(candidate.render?.stage && typeof candidate.render.stage === 'object'
                ? { stage: { ...candidate.render.stage } }
                : {}),
        }
        : candidate?.render;
    return {
        ...candidate,
        phenotype: candidate?.phenotype ? { ...candidate.phenotype } : candidate?.phenotype,
        metric: candidate?.metric ? { ...candidate.metric } : candidate?.metric,
        modelInput,
        render,
        scores: candidate?.scores ? { ...candidate.scores } : candidate?.scores,
    };
};

export const clonePair = (pair) => ({
    A: cloneCandidateForPair(pair?.A),
    B: cloneCandidateForPair(pair?.B),
    createdAt: Date.now(),
    pairSignature: pair?.pairSignature || null,
    renderSignature: pair?.renderSignature || null,
    generationContext: pair?.generationContext ? { ...pair.generationContext } : {},
});
