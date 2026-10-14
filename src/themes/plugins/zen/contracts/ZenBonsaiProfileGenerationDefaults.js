export const ZEN_BONSAI_TOPOLOGY_REFERENCE_HEIGHT = 360;

export const ZEN_BONSAI_STRUCTURE_MODE = Object.freeze({
    BONSAI: 'bonsai',
    TREE: 'tree',
});
export const ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION = Object.freeze({
    localRatio: 0.62,
    globalNodeCap: 2,
    repairBudgetScale: 0.45,
    minPerAnchor: 1,
    branchAffinitySigmaPx: 12,
    maxGapPx: 12,
});

const clampRange = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const clampIntRange = (value, min, max, fallback) => Math.round(
    clampRange(value, min, max, fallback),
);

export const clampZenBonsaiCanopyDistribution = (value = {}) => Object.freeze({
    localRatio: Number(clampRange(
        value?.localRatio,
        0.4,
        0.85,
        ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION.localRatio,
    ).toFixed(3)),
    globalNodeCap: clampIntRange(
        value?.globalNodeCap,
        1,
        5,
        ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION.globalNodeCap,
    ),
    repairBudgetScale: Number(clampRange(
        value?.repairBudgetScale,
        0,
        1,
        ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION.repairBudgetScale,
    ).toFixed(3)),
    minPerAnchor: clampIntRange(
        value?.minPerAnchor,
        0,
        4,
        ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION.minPerAnchor,
    ),
    branchAffinitySigmaPx: Number(clampRange(
        value?.branchAffinitySigmaPx,
        4,
        28,
        ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION.branchAffinitySigmaPx,
    ).toFixed(1)),
    maxGapPx: Number(clampRange(
        value?.maxGapPx,
        4,
        30,
        ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION.maxGapPx,
    ).toFixed(1)),
});
