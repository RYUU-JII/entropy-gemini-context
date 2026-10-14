import { SAKURA_BRANCH_ORDER } from './shapePriorModel';

export const SAKURA_ROLE_TIER = Object.freeze({
    TRUNK_MAIN: 'trunkMain',
    BRANCH_MAIN: 'branchMain',
    BRANCH_SIDE: 'branchSide',
    TWIG_MAIN: 'twigMain',
    TWIG_SIDE: 'twigSide',
});

export class SakuraBranchRoleModel {
    static classify({
        branchOrder = SAKURA_BRANCH_ORDER.TRUNK,
        forceTerminalTwig = false,
    } = {}) {
        const isTrunk = branchOrder === SAKURA_BRANCH_ORDER.TRUNK;
        const isTerminalTwigOrder = branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG;
        const isTwig = isTerminalTwigOrder || !!forceTerminalTwig;
        const isSecondary = branchOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH;
        return {
            branchOrder,
            isTrunk,
            isTwig,
            isSecondary,
            isBranch: !isTrunk && !isTwig,
        };
    }

    static resolveTier({
        branchOrder = SAKURA_BRANCH_ORDER.TRUNK,
        isContinuation = true,
        forceTerminalTwig = false,
    } = {}) {
        const role = SakuraBranchRoleModel.classify({
            branchOrder,
            forceTerminalTwig,
        });
        if (role.isTrunk && isContinuation) return SAKURA_ROLE_TIER.TRUNK_MAIN;
        if (role.isTwig) return isContinuation ? SAKURA_ROLE_TIER.TWIG_MAIN : SAKURA_ROLE_TIER.TWIG_SIDE;
        return isContinuation ? SAKURA_ROLE_TIER.BRANCH_MAIN : SAKURA_ROLE_TIER.BRANCH_SIDE;
    }
}
