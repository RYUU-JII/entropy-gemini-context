export const buildSakuraTrunkPassInput = ({
    shared = {},
    request = {},
} = {}) => {
    const {
        trunkSegmentLimit,
        trunkPathPlan,
        createFallbackRandom,
    } = shared;
    const {
        structuralMaxDepth,
        nextRandomFn,
        hooks = {},
    } = request;

    return {
        limits: {
            trunkSegmentLimit,
            structuralMaxDepth,
        },
        trunkPolicy: {
            trunkPathPlan,
        },
        random: {
            createFallbackRandom,
            nextRandomFn,
        },
        hooks,
    };
};
