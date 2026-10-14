const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const DECISIVE_PICKS = new Set(['A', 'B', 'WORSE_A', 'WORSE_B']);
const NEUTRAL_PICKS = new Set(['BOTH_GOOD']);
const ABSTAIN_PICKS = new Set(['PASS']);

const saturate = (value, halfLife = 1) => {
    const safeValue = Math.max(0, Number(value) || 0);
    const safeHalfLife = Math.max(1, Number(halfLife) || 1);
    return clamp01(1 - Math.exp(-safeValue / safeHalfLife));
};

const resolveQueryKind = (entry = {}) => (
    String(entry?.query?.kind || entry?.generationContext?.queryKind || '').trim().toLowerCase()
);

const resolvePicked = (entry = {}) => (
    String(entry?.picked || '').trim().toUpperCase()
);

export const resolveSakuraHistoryDecisionType = (entry = {}) => {
    if (resolveQueryKind(entry) === 'anchor') {
        return 'anchor';
    }
    const picked = resolvePicked(entry);
    if (NEUTRAL_PICKS.has(picked)) {
        return 'neutral';
    }
    if (ABSTAIN_PICKS.has(picked)) {
        return 'abstain';
    }
    if (DECISIVE_PICKS.has(picked)) {
        return 'decisive';
    }
    return 'other';
};

export const isSakuraNeutralHistoryEntry = (entry = {}) => (
    resolveSakuraHistoryDecisionType(entry) === 'neutral'
);

export const isSakuraDecisiveHistoryEntry = (entry = {}) => (
    resolveSakuraHistoryDecisionType(entry) === 'decisive'
);

export const summarizeSakuraABHistory = (abHistory = []) => {
    const history = Array.isArray(abHistory) ? abHistory : [];
    return history.reduce((acc, entry) => {
        const type = resolveSakuraHistoryDecisionType(entry);
        if (type === 'anchor') {
            acc.anchorCount += 1;
            return acc;
        }
        if (type === 'decisive') {
            acc.decisiveCount += 1;
            acc.totalNonAnchorCount += 1;
            return acc;
        }
        if (type === 'neutral') {
            acc.neutralCount += 1;
            acc.totalNonAnchorCount += 1;
            return acc;
        }
        if (type === 'abstain') {
            acc.abstainCount += 1;
            acc.totalNonAnchorCount += 1;
            return acc;
        }
        acc.otherCount += 1;
        if (resolveQueryKind(entry)) {
            acc.totalNonAnchorCount += 1;
        }
        return acc;
    }, {
        decisiveCount: 0,
        neutralCount: 0,
        abstainCount: 0,
        anchorCount: 0,
        otherCount: 0,
        totalNonAnchorCount: 0,
    });
};

export const resolveSakuraGeneratorLearningProgress = ({
    trainingCount = 0,
    pairwiseTrainingCount = 0,
    neuralMeta = null,
    pairwiseMeta = null,
    abHistory = [],
} = {}) => {
    const historySummary = summarizeSakuraABHistory(abHistory);
    const decisiveSignal = saturate(historySummary.decisiveCount, 8);
    const pairwiseSignal = saturate(pairwiseTrainingCount, 16);
    const neuralSignal = saturate(trainingCount, 20);
    const neuralQuality = Number.isFinite(Number(neuralMeta?.avgAbsError))
        ? clamp01(1 - (Number(neuralMeta.avgAbsError) / 0.42))
        : 0.5;
    const pairwiseQuality = Number.isFinite(Number(pairwiseMeta?.avgPairLoss))
        ? clamp01(1 - (Number(pairwiseMeta.avgPairLoss) / 1.05))
        : 0.5;
    const modelSignal = clamp01((pairwiseQuality * 0.58) + (neuralQuality * 0.42));
    const neutralRatio = historySummary.totalNonAnchorCount > 0
        ? historySummary.neutralCount / historySummary.totalNonAnchorCount
        : 0;
    const neutralPenalty = clamp01((neutralRatio - 0.42) / 0.38) * 0.12;
    let progress = (
        0.22
        + (decisiveSignal * 0.36)
        + (pairwiseSignal * 0.22)
        + (neuralSignal * 0.1)
        + (modelSignal * 0.1)
    );
    if (historySummary.decisiveCount === 0) {
        progress *= 0.8;
    }
    progress = clamp01(progress - neutralPenalty);

    return {
        progress: Number(progress.toFixed(3)),
        progressPercent: Math.round(progress * 100),
        decisiveCount: historySummary.decisiveCount,
        neutralCount: historySummary.neutralCount,
        abstainCount: historySummary.abstainCount,
        totalNonAnchorCount: historySummary.totalNonAnchorCount,
        neutralRatio: Number(neutralRatio.toFixed(3)),
        signals: {
            decisive: Number(decisiveSignal.toFixed(3)),
            pairwise: Number(pairwiseSignal.toFixed(3)),
            neural: Number(neuralSignal.toFixed(3)),
            model: Number(modelSignal.toFixed(3)),
        },
    };
};
