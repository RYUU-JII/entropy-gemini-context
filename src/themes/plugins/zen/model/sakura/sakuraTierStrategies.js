import { lerp } from './sakuraMath';

export const SAKURA_TIER = Object.freeze({
    TRUNK: 'trunk',
    SCAFFOLD: 'scaffold',
    TWIG: 'twig',
});

export const resolveSakuraTier = ({
    isTrunk = false,
    isTwig = false,
} = {}) => {
    if (isTrunk) {
        return SAKURA_TIER.TRUNK;
    }
    if (isTwig) {
        return SAKURA_TIER.TWIG;
    }
    return SAKURA_TIER.SCAFFOLD;
};

export const createSakuraTierStrategies = ({
    morphologyProfile,
} = {}) => ({
    [SAKURA_TIER.TRUNK]: {
        resolveRoleDepth: ({ state }) => ({
            roleDepth: state.trunkMainDepth,
            roleDepthLimit: state.trunkSegmentLimit,
        }),
        resolveScale: () => ({
            branchWidthScale: 1,
            twigStartScale: 1,
        }),
    },
    [SAKURA_TIER.SCAFFOLD]: {
        resolveRoleDepth: ({ state }) => ({
            roleDepth: state.scaffoldDepth,
            roleDepthLimit: state.scaffoldMaxDepth,
        }),
        resolveScale: () => ({
            branchWidthScale: lerp(1.04, 0.72, morphologyProfile.branchFineness),
            twigStartScale: 1,
        }),
    },
    [SAKURA_TIER.TWIG]: {
        resolveRoleDepth: ({ state }) => ({
            roleDepth: state.twigDepth,
            roleDepthLimit: state.twigMaxDepth,
        }),
        resolveScale: () => ({
            branchWidthScale: lerp(1.04, 0.72, morphologyProfile.branchFineness),
            twigStartScale: lerp(1, 0.84, morphologyProfile.twigStartShortness),
        }),
    },
});
