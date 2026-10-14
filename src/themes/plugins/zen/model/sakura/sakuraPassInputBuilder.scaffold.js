export const buildSakuraScaffoldPassInput = ({
    shared = {},
    request = {},
} = {}) => {
    const {
        morphologyProfile,
        tierStrategies,
        tierModels,
        scaffoldTierGene,
        scaffoldRootGene,
        scaffoldArcModel,
        trunkSegmentLimit,
        lengthRatioByTier,
        widthReductionByTier,
        trunkPathPlan,
        scaffoldStationPlan,
        scaffoldRuntime,
        scaffoldRootLengthBase,
        scaffoldRootWidthBase,
        formScaffoldComposition,
        createFallbackRandom,
        topologyRandom,
    } = shared;
    const {
        scaffoldStrength,
        twigMaxDepth,
        scaffoldMaxDepth,
        structuralMaxDepth,
        trunkInternodeDecay,
        trunkWidthDecay,
        trunkTargetHeight,
        nextRandomFn,
        hooks = {},
    } = request;

    return {
        context: {
            morphologyProfile,
            scaffoldStrength,
        },
        tiers: {
            tierStrategies,
            tierModels,
            scaffoldTierGene,
            scaffoldRootGene,
            scaffoldArcModel,
        },
        limits: {
            trunkSegmentLimit,
            scaffoldMaxDepth,
            twigMaxDepth,
            structuralMaxDepth,
        },
        decay: {
            trunkInternodeDecay,
            trunkWidthDecay,
            lengthRatioByTier,
            widthReductionByTier,
        },
        schedule: {
            trunkPathPlan,
            scaffoldStationPlan,
            trunkTargetHeight,
        },
        runtime: {
            scaffoldRuntime,
            scaffoldRootLengthBase,
            scaffoldRootWidthBase,
            formScaffoldComposition,
        },
        random: {
            nextRandomFn,
            createFallbackRandom,
            topologyRandom,
        },
        hooks,
    };
};
