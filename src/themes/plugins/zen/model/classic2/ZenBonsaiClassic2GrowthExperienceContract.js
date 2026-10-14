export const ZEN_BONSAI_CLASSIC2_GROWTH_EXPERIENCE_CONTRACT_VERSION =
    'classic2_growth_experience_release_v1';

export const ZEN_BONSAI_CLASSIC2_GROWTH_REFERENCE_SEED = 478;

export const ZEN_BONSAI_CLASSIC2_GROWTH_CHECKPOINTS = Object.freeze([
    12,
    24,
    42,
    55,
    70,
    82,
    92,
    100,
]);

export const ZEN_BONSAI_CLASSIC2_ACTIVATION_CHECKPOINTS = Object.freeze([
    18,
    58,
    92,
]);

const range = (min, max) => Object.freeze({ min, max });
const checkpoint = ({
    rootLengthRatio,
    rootWidthRatio,
    rootBaseToTrunkRatio,
    trunkLengthRatio,
    trunkWidthRatio,
    scaffoldBornRatio,
    twigBornRatio,
    carrierBornRatio,
    blossomPresentation = null,
    activationPixelDelta,
}) => Object.freeze({
    rootLengthRatio: range(...rootLengthRatio),
    rootWidthRatio: range(...rootWidthRatio),
    rootBaseToTrunkRatio: range(...rootBaseToTrunkRatio),
    trunkLengthRatio: range(...trunkLengthRatio),
    trunkWidthRatio: range(...trunkWidthRatio),
    scaffoldBornRatio: range(...scaffoldBornRatio),
    twigBornRatio: range(...twigBornRatio),
    carrierBornRatio: range(...carrierBornRatio),
    blossomPresentation: blossomPresentation === null
        ? null
        : Object.freeze(Object.fromEntries(
            Object.entries(blossomPresentation).map(([activation, target]) => [
                activation,
                Object.freeze({
                    renderedFlowers: range(...target.renderedFlowers),
                    budRatio: range(...target.budRatio),
                    halfOpenRatio: range(...target.halfOpenRatio),
                    fullRatio: range(...target.fullRatio),
                }),
            ]),
        )),
    activationPixelDelta: Object.freeze({
        meanRgbDeltaMin: activationPixelDelta[0],
        changedPixelRatioMin: activationPixelDelta[1],
    }),
});

// Product-reference envelopes are normalized against the immutable candidate
// topology recorded by the release development-lineage contract. Growth 92
// remains near-display; growth 100 is the only complete structural and blossom
// endpoint. Every candidate branch and carrier is mature at that endpoint, and
// structural carrier birth remains activation-invariant.
export const ZEN_BONSAI_CLASSIC2_GROWTH_EXPERIENCE_TARGETS = Object.freeze({
    12: checkpoint({
        rootLengthRatio: [0.94, 1],
        rootWidthRatio: [0.2, 0.25],
        rootBaseToTrunkRatio: [1.08, 1.16],
        trunkLengthRatio: [0.04, 0.06],
        trunkWidthRatio: [0.025, 0.045],
        scaffoldBornRatio: [0, 0],
        twigBornRatio: [0, 0],
        carrierBornRatio: [0, 0.04],
        activationPixelDelta: [0.04, 0.0005],
    }),
    24: checkpoint({
        rootLengthRatio: [0.98, 1],
        rootWidthRatio: [0.27, 0.31],
        rootBaseToTrunkRatio: [1.13, 1.21],
        trunkLengthRatio: [0.15, 0.2],
        trunkWidthRatio: [0.085, 0.12],
        scaffoldBornRatio: [0.02, 0.08],
        twigBornRatio: [0, 0.02],
        carrierBornRatio: [0, 0.03],
        activationPixelDelta: [0.03, 0.0005],
    }),
    42: checkpoint({
        rootLengthRatio: [0.99, 1],
        rootWidthRatio: [0.52, 0.56],
        rootBaseToTrunkRatio: [1.17, 1.24],
        trunkLengthRatio: [0.41, 0.47],
        trunkWidthRatio: [0.33, 0.39],
        scaffoldBornRatio: [0.18, 0.3],
        twigBornRatio: [0.01, 0.08],
        carrierBornRatio: [0, 0.03],
        activationPixelDelta: [0.22, 0.002],
    }),
    55: checkpoint({
        rootLengthRatio: [0.99, 1],
        rootWidthRatio: [0.75, 0.8],
        rootBaseToTrunkRatio: [1.2, 1.27],
        trunkLengthRatio: [0.53, 0.59],
        trunkWidthRatio: [0.58, 0.65],
        scaffoldBornRatio: [0.38, 0.58],
        twigBornRatio: [0.08, 0.18],
        carrierBornRatio: [0.02, 0.08],
        activationPixelDelta: [1.5, 0.005],
    }),
    70: checkpoint({
        rootLengthRatio: [0.99, 1],
        rootWidthRatio: [0.87, 0.92],
        rootBaseToTrunkRatio: [1.22, 1.29],
        trunkLengthRatio: [0.68, 0.75],
        trunkWidthRatio: [0.8, 0.86],
        scaffoldBornRatio: [0.7, 0.88],
        twigBornRatio: [0.32, 0.48],
        carrierBornRatio: [0.16, 0.28],
        blossomPresentation: {
            18: { renderedFlowers: [108, 120], budRatio: [0.8, 0.88], halfOpenRatio: [0.12, 0.2], fullRatio: [0, 0.02] },
            58: { renderedFlowers: [108, 120], budRatio: [0.6, 0.72], halfOpenRatio: [0.25, 0.38], fullRatio: [0.01, 0.08] },
            92: { renderedFlowers: [108, 120], budRatio: [0.3, 0.45], halfOpenRatio: [0.25, 0.38], fullRatio: [0.25, 0.38] },
        },
        activationPixelDelta: [1.5, 0.015],
    }),
    82: checkpoint({
        rootLengthRatio: [0.99, 1],
        rootWidthRatio: [0.95, 0.99],
        rootBaseToTrunkRatio: [1.24, 1.3],
        trunkLengthRatio: [0.82, 0.88],
        trunkWidthRatio: [0.94, 0.99],
        scaffoldBornRatio: [1, 1],
        twigBornRatio: [0.68, 0.82],
        carrierBornRatio: [0.42, 0.56],
        blossomPresentation: {
            18: { renderedFlowers: [275, 290], budRatio: [0.7, 0.82], halfOpenRatio: [0.18, 0.3], fullRatio: [0, 0.02] },
            58: { renderedFlowers: [275, 290], budRatio: [0.45, 0.58], halfOpenRatio: [0.34, 0.46], fullRatio: [0.05, 0.14] },
            92: { renderedFlowers: [275, 290], budRatio: [0.15, 0.28], halfOpenRatio: [0.2, 0.3], fullRatio: [0.48, 0.62] },
        },
        activationPixelDelta: [2, 0.025],
    }),
    92: checkpoint({
        rootLengthRatio: [0.99, 1],
        rootWidthRatio: [0.98, 1],
        rootBaseToTrunkRatio: [1.24, 1.3],
        trunkLengthRatio: [0.94, 1],
        trunkWidthRatio: [0.98, 1],
        scaffoldBornRatio: [1, 1],
        twigBornRatio: [0.94, 1],
        carrierBornRatio: [0.9, 1],
        blossomPresentation: {
            18: { renderedFlowers: [585, 600], budRatio: [0.66, 0.78], halfOpenRatio: [0.22, 0.34], fullRatio: [0, 0.02] },
            58: { renderedFlowers: [585, 600], budRatio: [0.39, 0.52], halfOpenRatio: [0.38, 0.5], fullRatio: [0.08, 0.16] },
            92: { renderedFlowers: [585, 600], budRatio: [0.06, 0.15], halfOpenRatio: [0.1, 0.2], fullRatio: [0.7, 0.8] },
        },
        activationPixelDelta: [3, 0.05],
    }),
    100: checkpoint({
        rootLengthRatio: [0.99, 1],
        rootWidthRatio: [0.99, 1],
        rootBaseToTrunkRatio: [1.24, 1.3],
        trunkLengthRatio: [0.99, 1],
        trunkWidthRatio: [0.99, 1],
        scaffoldBornRatio: [1, 1],
        twigBornRatio: [1, 1],
        carrierBornRatio: [1, 1],
        blossomPresentation: {
            18: { renderedFlowers: [585, 600], budRatio: [0.63, 0.74], halfOpenRatio: [0.26, 0.37], fullRatio: [0, 0.02] },
            58: { renderedFlowers: [585, 600], budRatio: [0.28, 0.41], halfOpenRatio: [0.43, 0.55], fullRatio: [0.12, 0.23] },
            92: { renderedFlowers: [585, 600], budRatio: [0.03, 0.1], halfOpenRatio: [0, 0.03], fullRatio: [0.88, 0.97] },
        },
        activationPixelDelta: [3, 0.05],
    }),
});

export const resolveZenBonsaiClassic2GrowthExperienceTarget = (growthCheckpoint) => {
    const checkpointValue = Number(growthCheckpoint);
    const target = ZEN_BONSAI_CLASSIC2_GROWTH_EXPERIENCE_TARGETS[checkpointValue];
    if (!target) {
        throw new Error('ZEN_BONSAI_CLASSIC2_GROWTH_EXPERIENCE_CHECKPOINT_UNSUPPORTED');
    }
    return target;
};

export const resolveZenBonsaiClassic2BlossomPresentationTarget = ({
    growthCheckpoint,
    activationCheckpoint,
} = {}) => {
    const target = resolveZenBonsaiClassic2GrowthExperienceTarget(growthCheckpoint);
    const blossomTarget = target.blossomPresentation?.[Number(activationCheckpoint)];
    if (!blossomTarget) {
        throw new Error('ZEN_BONSAI_CLASSIC2_ACTIVATION_CHECKPOINT_UNSUPPORTED');
    }
    return blossomTarget;
};
