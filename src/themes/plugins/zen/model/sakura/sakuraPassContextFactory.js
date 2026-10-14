import { ShapePriorModel } from '../bonsai/generation/shapePriorModel';
import { GrowthDecayPolicyModel } from '../bonsai/generation/growthDecayPolicyModel';
import { clamp } from './sakuraMath';
import { createSakuraTierStrategies } from './sakuraTierStrategies';
import { createSakuraTierModelRegistry } from './sakuraTierModelRegistry';
import { resolveSakuraGlobalRuntimeParams } from './sakuraRuntimeParams.global';
import { resolveSakuraScaffoldRuntimeParams } from './sakuraRuntimeParams.scaffold';
import { resolveSakuraTwigRuntimeParams } from './sakuraRuntimeParams.twig';
import { buildSakuraTrunkPassInput } from './sakuraPassInputBuilder.trunk';
import { buildSakuraScaffoldPassInput } from './sakuraPassInputBuilder.scaffold';
import { buildSakuraTwigPassInput } from './sakuraPassInputBuilder.twig';

export const createSakuraPassContextFactory = (context = {}) => {
    const {
        gene,
        topologyRandom,
        morphologyProfile,
        trunkSegmentLimit,
        trunkPathPlan,
        scaffoldStationPlan,
        formCompositionPlan = null,
    } = context;

    const tierStrategies = createSakuraTierStrategies({ morphologyProfile });
    const lengthRatioByTier = GrowthDecayPolicyModel.getSakuraLengthRatioByTier(gene);
    const widthReductionByTier = GrowthDecayPolicyModel.getSakuraWidthReductionByTier(gene);

    const scaffoldRuntime = resolveSakuraScaffoldRuntimeParams(gene);
    const twigRuntime = resolveSakuraTwigRuntimeParams(gene);
    const globalRuntime = resolveSakuraGlobalRuntimeParams(gene);

    const tierModels = createSakuraTierModelRegistry({ gene });
    const scaffoldArcModel = tierModels.scaffold.arc;
    const twigArcModel = tierModels.twig.arc;
    const tierModelByTier = Object.freeze({
        trunk: tierModels.trunk.angleGuard,
        scaffold: tierModels.scaffold.angleGuard,
        twig: tierModels.twig.angleGuard,
    });
    const scaffoldTierGene = {
        ...gene,
        branchAngleBase: scaffoldArcModel.angleBase,
        branchAngleVar: scaffoldArcModel.angleVar,
    };
    const twigTierGene = {
        ...gene,
        branchAngleBase: twigArcModel.angleBase,
        branchAngleVar: twigArcModel.angleVar,
    };
    const scaffoldRootGene = {
        ...scaffoldTierGene,
        trunkTierBranchAngle: scaffoldArcModel.angleBase,
        trunkTierAngleVar: tierModelByTier.scaffold.angleVarNorm,
    };

    const scaffoldNodeTwigProb = scaffoldRuntime.twigSpawn.nodeProb;
    const twigNodeBudgetCapBase = twigRuntime.nodeBudgetCap;
    const twigSpawnMinWidthBase = twigRuntime.spawnMinWidth;
    const vigorSignal = globalRuntime.vigor;
    const scaffoldRootLengthBase = clamp(
        Number(scaffoldRootGene.lengthBase) || 1,
        0.08,
        3.2,
    );
    const scaffoldRootWidthBase = clamp(
        Number(scaffoldRootGene.widthBase) || 1,
        0.08,
        3.2,
    );
    const branchChaos = clamp(Number(twigTierGene.branchChaos) || 0.5, 0, 1);
    const verticalBias = clamp(Number(twigTierGene.verticalBias) || 0.5, 0, 1);
    const trunkStyle = clamp(Number(twigTierGene.trunkStyle) || 0.5, 0, 1);
    const trunkBackboneLockStrength = clamp(
        Number(twigTierGene.trunkBackboneLockStrength) || 0.5,
        0,
        1,
    );
    const twigNodeBloomChance = clamp(Number(twigTierGene.twigNodeBloomChance) || 0, 0, 1);
    const scaffoldUpperCoverage = scaffoldRuntime.distribution.upperCoverage;

    const createFallbackRandom = ({
        depth,
        order,
        nodeSlot,
        decisionType,
    }) => topologyRandom.fork({
        depth,
        nodeRole: ShapePriorModel.resolveSakuraOrderName(order),
        nodeSlot,
        decisionType,
    });

    const trunkPassShared = {
        trunkSegmentLimit,
        trunkPathPlan,
        createFallbackRandom,
    };

    const scaffoldPassShared = {
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
        formScaffoldComposition: formCompositionPlan?.scaffold || null,
        createFallbackRandom,
        topologyRandom,
    };

    const twigPassShared = {
        morphologyProfile,
        tierModels,
        tierModelByTier,
        tierStrategies,
        twigTierGene,
        trunkSegmentLimit,
        lengthRatioByTier,
        widthReductionByTier,
        scaffoldNodeTwigProb,
        twigNodeBudgetCapBase,
        twigSpawnMinWidthBase,
        vigorSignal,
        branchChaos,
        verticalBias,
        trunkStyle,
        trunkBackboneLockStrength,
        twigNodeBloomChance,
        scaffoldUpperCoverage,
        formScaffoldComposition: formCompositionPlan?.scaffold || null,
        createFallbackRandom,
    };

    const buildTrunkPassInput = (request = {}) => (
        buildSakuraTrunkPassInput({
            shared: trunkPassShared,
            request,
        })
    );

    const buildScaffoldPassInput = (request = {}) => (
        buildSakuraScaffoldPassInput({
            shared: scaffoldPassShared,
            request,
        })
    );

    const buildTwigPassInput = (request = {}) => (
        buildSakuraTwigPassInput({
            shared: twigPassShared,
            request,
        })
    );

    return {
        buildTrunkPassInput,
        buildScaffoldPassInput,
        buildTwigPassInput,
    };
};
