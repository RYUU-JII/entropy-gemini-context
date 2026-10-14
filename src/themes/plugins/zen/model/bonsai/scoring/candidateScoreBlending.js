const lerp = (a, b, t) => a + ((b - a) * t);
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const estimateNeuralReliability = ({ trainingSteps = 0, avgAbsError = 0 } = {}) => {
    const stepSignal = clamp01(trainingSteps / 96);
    const errorSignal = clamp01(1 - (avgAbsError / 0.42));
    return clamp01((stepSignal * 0.58) + (errorSignal * 0.42));
};

const estimatePairwiseReliability = ({ trainingPairs = 0, avgPairLoss = 0 } = {}) => {
    const stepSignal = clamp01(trainingPairs / 140);
    const lossSignal = clamp01(1 - (avgPairLoss / 1.1));
    return clamp01((stepSignal * 0.56) + (lossSignal * 0.44));
};

const resolveAdaptiveTrustSignal = ({
    trainingSteps = 0,
    pairwisePairs = 0,
    neuralConfidence = 0.5,
    pairwiseConfidence = 0.5,
    neuralAvgError = 0,
    pairwiseAvgLoss = 0,
} = {}) => {
    const neuralStepSignal = clamp01(trainingSteps / 48);
    const pairwiseStepSignal = clamp01(pairwisePairs / 40);
    const neuralQuality = clamp01(1 - (neuralAvgError / 0.42));
    const pairwiseQuality = clamp01(1 - (pairwiseAvgLoss / 1.05));
    return {
        neural: clamp01(
            (neuralStepSignal * 0.7)
            + (neuralQuality * 0.16)
            + (clamp01(neuralConfidence) * 0.14),
        ),
        pairwise: clamp01(
            (pairwiseStepSignal * 0.7)
            + (pairwiseQuality * 0.16)
            + (clamp01(pairwiseConfidence) * 0.14),
        ),
    };
};

export const resolveBlendWeights = ({
    trainingSteps = 0,
    pairwisePairs = 0,
    neuralConfidence = 0.5,
    pairwiseConfidence = 0.5,
    neuralAvgError = 0,
    pairwiseAvgLoss = 0,
    referenceCount = 0,
} = {}) => {
    const neuralBase = trainingSteps >= 60 ? 0.42 : trainingSteps >= 24 ? 0.34 : 0.24;
    const pairwiseBase = pairwisePairs >= 100
        ? 0.3
        : pairwisePairs >= 30
            ? 0.22
            : pairwisePairs >= 8
                ? 0.14
                : 0.06;

    const neuralReliability = estimateNeuralReliability({
        trainingSteps,
        avgAbsError: neuralAvgError,
    });
    const pairwiseReliability = estimatePairwiseReliability({
        trainingPairs: pairwisePairs,
        avgPairLoss: pairwiseAvgLoss,
    });

    const neuralAlignment = 1 - (Math.abs(clamp01(neuralConfidence) - neuralReliability) * 0.22);
    const pairwiseAlignment = 1 - (
        Math.abs(clamp01(pairwiseConfidence) - pairwiseReliability) * 0.24
    );

    const confidenceAdjustedNeural = neuralBase
        * lerp(0.45, 1.1, clamp01((neuralConfidence * 0.55) + (neuralReliability * 0.45)))
        * neuralAlignment;
    const confidenceAdjustedPairwise = pairwiseBase
        * lerp(0.4, 1.08, clamp01((pairwiseConfidence * 0.55) + (pairwiseReliability * 0.45)))
        * pairwiseAlignment;
    const uncertainty = 1 - ((neuralReliability + pairwiseReliability) / 2);
    const novelty = clamp01(0.1 + (uncertainty * 0.08) + (referenceCount < 8 ? 0.03 : 0));
    const ruleFloor = 0.16 + (uncertainty * 0.14);
    const rule = Math.max(
        ruleFloor,
        1 - confidenceAdjustedNeural - novelty - confidenceAdjustedPairwise,
    );
    const sum = rule + confidenceAdjustedNeural + novelty + confidenceAdjustedPairwise;

    return {
        rule: rule / sum,
        neural: confidenceAdjustedNeural / sum,
        novelty: novelty / sum,
        pairwise: confidenceAdjustedPairwise / sum,
        reliability: {
            neural: round(neuralReliability, 3),
            pairwise: round(pairwiseReliability, 3),
        },
    };
};

export const blendScores = ({
    rule,
    neural,
    pairwise = 0,
    novelty,
    trainingSteps,
    pairwisePairs,
    neuralConfidence,
    pairwiseConfidence,
    neuralAvgError,
    pairwiseAvgLoss,
    referenceCount = 0,
}) => {
    const weights = resolveBlendWeights({
        trainingSteps,
        pairwisePairs,
        neuralConfidence,
        pairwiseConfidence,
        neuralAvgError,
        pairwiseAvgLoss,
        referenceCount,
    });

    const blended = Math.min(
        1,
        Math.max(
            0,
            (rule * weights.rule)
            + (neural * weights.neural)
            + (pairwise * weights.pairwise)
            + (novelty * weights.novelty),
        ),
    );

    return {
        rule,
        neural,
        pairwise,
        novelty,
        blended,
        weights,
        modelConfidence: {
            neural: round(neuralConfidence ?? 0.5, 3),
            pairwise: round(pairwiseConfidence ?? 0.5, 3),
        },
    };
};

export const resolveAdaptiveObjectiveWeights = ({
    trainingSteps = 0,
    pairwisePairs = 0,
    neuralConfidence = 0.5,
    pairwiseConfidence = 0.5,
    neuralAvgError = 0,
    pairwiseAvgLoss = 0,
    referenceCount = 0,
} = {}) => {
    const trust = resolveAdaptiveTrustSignal({
        trainingSteps,
        pairwisePairs,
        neuralConfidence,
        pairwiseConfidence,
        neuralAvgError,
        pairwiseAvgLoss,
    });
    const preferenceReliability = clamp01((trust.pairwise * 0.64) + (trust.neural * 0.36));
    const rawPreference = 0.36 + (preferenceReliability * 0.42);
    const rawRule = clamp(0.32 - (preferenceReliability * 0.16), 0.14, 0.32);
    const rawNovelty = clamp(
        0.18 - (preferenceReliability * 0.08) + (referenceCount < 8 ? 0.02 : 0),
        0.08,
        0.2,
    );
    const pairwiseShare = clamp(
        0.52 + (trust.pairwise * 0.22) - (trust.neural * 0.06),
        0.46,
        0.78,
    );
    const neuralShare = 1 - pairwiseShare;
    const total = rawPreference + rawRule + rawNovelty;
    const preferenceWeight = rawPreference / total;
    return {
        rule: rawRule / total,
        novelty: rawNovelty / total,
        pairwise: preferenceWeight * pairwiseShare,
        neural: preferenceWeight * neuralShare,
        reliability: {
            neural: round(trust.neural, 3),
            pairwise: round(trust.pairwise, 3),
            preference: round(preferenceReliability, 3),
        },
    };
};

export const scoreAdaptiveObjective = ({
    rule = 0,
    neural = 0.5,
    pairwise = 0.5,
    novelty = 0.5,
    trainingSteps = 0,
    pairwisePairs = 0,
    neuralConfidence = 0.5,
    pairwiseConfidence = 0.5,
    neuralAvgError = 0,
    pairwiseAvgLoss = 0,
    referenceCount = 0,
} = {}) => {
    const weights = resolveAdaptiveObjectiveWeights({
        trainingSteps,
        pairwisePairs,
        neuralConfidence,
        pairwiseConfidence,
        neuralAvgError,
        pairwiseAvgLoss,
        referenceCount,
    });
    return {
        score: clamp01(
            (rule * weights.rule)
            + (neural * weights.neural)
            + (pairwise * weights.pairwise)
            + (novelty * weights.novelty),
        ),
        weights,
    };
};
