import {
    clamp,
    lerp,
} from './sakuraMath';

const resolveTierArcModel = ({
    gene,
    tier,
}) => {
    if (tier === 'scaffold') {
        const angleBase = clamp(gene.scaffoldTierBranchAngle ?? gene.branchAngleBase ?? 0.68, 0.1, 1.5);
        const angleVar = lerp(0.06, 0.92, clamp(gene.scaffoldTierAngleVar ?? 0.25, 0, 1));
        return { angleBase, angleVar };
    }
    if (tier === 'twig') {
        const angleBase = clamp(gene.twigTierBranchAngle ?? gene.branchAngleBase ?? 0.82, 0.1, 1.5);
        const angleVar = lerp(0.04, 0.82, clamp(gene.twigTierAngleVar ?? 0.4, 0, 1));
        return { angleBase, angleVar };
    }
    return {
        angleBase: clamp(gene.trunkTierBranchAngle ?? gene.branchAngleBase ?? 0.52, 0.1, 1.5),
        angleVar: lerp(0.02, 0.92, clamp(gene.trunkTierAngleVar ?? 0.15, 0, 1)),
    };
};

export const createSakuraTierModelRegistry = ({
    gene = {},
} = {}) => {
    const trunkArc = resolveTierArcModel({ gene, tier: 'trunk' });
    const scaffoldArc = resolveTierArcModel({ gene, tier: 'scaffold' });
    const twigArc = resolveTierArcModel({ gene, tier: 'twig' });

    const trunkModel = Object.freeze({
        arc: trunkArc,
        angleGuard: {
            angleVarNorm: clamp(gene.trunkTierAngleVar ?? 0.15, 0, 1),
            angleBase: trunkArc.angleBase,
            branchAngleVar: clamp(gene.branchAngleVar ?? 0.35, 0.05, 1),
        },
    });
    const scaffoldModel = Object.freeze({
        arc: scaffoldArc,
        angleGuard: {
            angleVarNorm: clamp(gene.scaffoldTierAngleVar ?? 0.25, 0, 1),
            angleBase: scaffoldArc.angleBase,
            branchAngleVar: scaffoldArc.angleVar,
        },
        twigSpawn: {
            nodeTwigProb: clamp(Number(gene.scaffoldNodeTwigProb ?? 0.72), 0.08, 0.98),
        },
    });
    const twigModel = Object.freeze({
        arc: twigArc,
        angleGuard: {
            angleVarNorm: clamp(gene.twigTierAngleVar ?? 0.4, 0, 1),
            angleBase: twigArc.angleBase,
            branchAngleVar: twigArc.angleVar,
        },
        branching: {
            branchingProb: clamp(
                Number(gene.twigTierBranchingProb ?? gene.branchingProb ?? 0.35),
                0,
                1,
            ),
            nodeBudgetCap: Math.max(6, Math.round(Number(gene.twigNodeBudgetCap ?? 20))),
        },
    });

    return Object.freeze({
        trunk: trunkModel,
        scaffold: scaffoldModel,
        twig: twigModel,
    });
};
