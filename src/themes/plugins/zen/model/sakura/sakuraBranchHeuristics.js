import {
    clamp,
    lerp,
} from './sakuraMath';
import { nextRandom } from './sakuraRandomUtils';
import { resolveSakuraTwigOpenForkBias } from './sakuraTwigSilhouettePolicy';

export const resolveTierContext = ({
    tierStrategies,
    isTrunk,
    isTwig,
    branchState,
}) => {
    const strategy = tierStrategies[isTrunk ? 'trunk' : (isTwig ? 'twig' : 'scaffold')];
    const {
        roleDepth,
        roleDepthLimit,
    } = strategy.resolveRoleDepth({ state: branchState });
    const {
        branchWidthScale,
        twigStartScale,
    } = strategy.resolveScale();
    return {
        roleDepth,
        roleDepthLimit,
        progress: roleDepth / Math.max(1, roleDepthLimit),
        branchWidthScale,
        twigStartScale,
    };
};

export const resolveDynamicLengthMult = ({
    branchConfig,
    localRandom,
    configIndex,
    gene,
    progress,
}) => {
    const internodeJitter = 1 + (
        nextRandom(localRandom, `config_${configIndex}_internode_jitter`) - 0.5
    ) * gene.internodeVariance;
    const canopyShape = lerp(
        1.12 - progress * 0.22,
        0.88 + (1 - progress) * 0.2,
        gene.canopyShapeBias,
    );
    const tipShrink = progress > 0.7 ? 0.9 : 1;
    const heightConstraint = 1 - progress * 0.14;
    return branchConfig.lenMult * internodeJitter * canopyShape * heightConstraint * tipShrink;
};

export const resolveChildAttachT = ({
    branchConfig,
    localRandom,
    configIndex,
    isTrunk,
    continuationDefault = 1,
}) => {
    const forcedAttachT = Number(branchConfig.forceAttachT);
    if (Number.isFinite(forcedAttachT)) {
        return clamp(forcedAttachT, 0, 1);
    }
    if (branchConfig.isContinuation) {
        return continuationDefault;
    }
    if (isTrunk) {
        return clamp(
            0.6 + nextRandom(localRandom, `config_${configIndex}_child_attach`) * 0.3,
            0.56,
            0.96,
        );
    }
    return clamp(
        0.72 + nextRandom(localRandom, `config_${configIndex}_child_attach`) * 0.2,
        0.68,
        0.96,
    );
};

const resolveTwigBranchBand = (twigDepth = 1) => {
    if (twigDepth <= 1) {
        return { min: 1, max: 2 };
    }
    if (twigDepth === 2) {
        return { min: 1, max: 3 };
    }
    return { min: 2, max: 3 };
};

export const resolveTwigBranchCount = ({
    localRandom,
    twigDepth,
    twigBranchingProb,
    width,
    childBudget,
}) => {
    const twigBand = resolveTwigBranchBand(twigDepth);
    const budgetCap = Number.isFinite(Number(childBudget))
        ? Math.max(0, Math.floor(Number(childBudget)))
        : Number.POSITIVE_INFINITY;
    const bandMaxWithBudget = Math.min(twigBand.max, budgetCap);
    if (bandMaxWithBudget <= 0) {
        return { branchCount: 0, minRequired: 0 };
    }
    const bandMinWithBudget = Math.min(twigBand.min, bandMaxWithBudget);
    const forkBias = resolveSakuraTwigOpenForkBias(twigDepth);
    const preferTwoChance = clamp(
        forkBias + (twigBranchingProb * 0.24),
        0.32,
        0.92,
    );
    let branchCount = nextRandom(localRandom, `twig_depth_${twigDepth}_prefer_two`) < preferTwoChance ? 2 : 1;
    if (bandMaxWithBudget >= 3) {
        const widthNorm = clamp((width - 0.18) / 0.42, 0, 1);
        const tripleDepthBias = twigDepth <= 1 ? 0.04 : (twigDepth === 2 ? 0.12 : 0.2);
        const tripleChance = clamp(
            tripleDepthBias + (twigBranchingProb * 0.18) + (widthNorm * 0.08),
            0.02,
            0.42,
        );
        if (nextRandom(localRandom, `twig_depth_${twigDepth}_triple`) < tripleChance) {
            branchCount = 3;
        }
    }
    return {
        branchCount: clamp(branchCount, bandMinWithBudget, bandMaxWithBudget),
        minRequired: bandMinWithBudget,
    };
};
