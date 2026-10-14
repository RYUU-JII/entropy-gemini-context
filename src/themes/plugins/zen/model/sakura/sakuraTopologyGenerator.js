import {
    DEFAULT_SAKURA_Phenotype,
    clampPhenotype,
} from '../BonsaiGenetics';
import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import {
    createStructuralNodeRandom,
    resolveStructuralSeed,
} from '../bonsai/random/StructuralHashRandom';
import {
    assertSakuraGenerationDetail,
    SAKURA_GENERATION_DETAIL,
} from './sakuraGenerationDetail';
import { clamp } from './sakuraMath';
import { resolveSakuraMorphologyProfile } from './sakuraMorphologyProfile';
import { resolveSakuraTopologyPlan } from './sakuraTopologyPlan';
import {
    resolveSakuraTrunkGeminiParamsFromGene,
    resolveSakuraTrunkGeminiRootAngle,
    resolveSakuraTrunkGeminiSegmentLength,
} from './sakuraTrunkGeminiParams';
import {
    createSakuraTrunkPathPlanV1,
    resolveSakuraTrunkMacroPhysicalGeometrySpansV1,
} from './sakuraTrunkPathPlan';
import { SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY } from './sakuraMacroSpineGuide';
import { createSakuraScaffoldArcStationPlan } from './sakuraScaffoldArcStationPlan';
import {
    createSakuraTrunkMacroLineage,
    createSakuraTrunkMacroRenderAttestation,
} from './sakuraTrunkMacroLineageContract';
import {
    createSakuraSingleRootFormTrunkIntentConstraintV1,
    createSakuraSingleRootFormCompositionProvenanceV1,
    resolveSakuraSingleRootFormCompositionInputV1,
} from './sakuraSingleRootFormCompositionAdapter';
import {
    getSakuraPotDimensions,
    SAKURA_CONFIG,
} from './sakuraSpeciesRuntimeContract.js';
export { getSakuraPotDimensions, SAKURA_CONFIG };

const normalizePhenotype = (phenotype) => (
    clampPhenotype(phenotype ?? DEFAULT_SAKURA_Phenotype)
);

const nextRandom = (nodeRandom, decisionType) => {
    if (typeof nodeRandom?.next === 'function') {
        const value = Number(nodeRandom.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return 0.5;
};

export const generateSakuraTopology = ({
    rng,
    currentStage,
    height,
    phenotype = DEFAULT_SAKURA_Phenotype,
    spineGuide = null,
    spineReferenceFamily = null,
    formCompositionPrior = null,
    formId = null,
    formVariantSeed = null,
    trunkAdaptiveSubdivisionPolicy = undefined,
    generationDetail = SAKURA_GENERATION_DETAIL.FULL,
    createBranchGenerator,
    createCanopyBloomLayer = null,
} = {}) => {
    const resolvedGenerationDetail = assertSakuraGenerationDetail(generationDetail);
    if (typeof createBranchGenerator !== 'function') {
        throw new Error('ZEN_SAKURA_BRANCH_GENERATOR_REQUIRED');
    }
    if (
        resolvedGenerationDetail === SAKURA_GENERATION_DETAIL.FULL
        && typeof createCanopyBloomLayer !== 'function'
    ) {
        throw new Error('ZEN_SAKURA_FULL_CANOPY_GENERATOR_REQUIRED');
    }

    const baseGene = normalizePhenotype(phenotype);
    const structuralSeed = resolveStructuralSeed(rng, 0);
    const formCompositionPlan = resolveSakuraSingleRootFormCompositionInputV1({
        formCompositionPrior,
        formId,
        formVariantSeed,
        structuralSeed,
        baseGene,
    });
    const gene = formCompositionPlan?.effectiveGene || baseGene;
    const formTrunkIntentConstraint = formCompositionPlan
        ? createSakuraSingleRootFormTrunkIntentConstraintV1(formCompositionPlan)
        : null;
    const topologyRandom = createStructuralNodeRandom({
        seed: structuralSeed,
        parentNodeId: 'root',
        depth: 0,
        nodeRole: 'topology',
        nodeSlot: 0,
        decisionType: 'sakura',
    });
    const morphologyRandom = topologyRandom.fork({
        depth: 0,
        nodeRole: 'morphology',
        nodeSlot: 0,
        decisionType: 'morphology_profile',
    });
    const morphologyProfile = resolveSakuraMorphologyProfile({
        gene,
        morphologyRandom,
        nextRandom,
    });
    const topologyPlan = resolveSakuraTopologyPlan({
        gene,
        currentStage,
        height,
        topologyRandom,
        morphologyProfile,
        nextRandom,
        formCompositionPlan,
    });
    const {
        canopyBloomDensity,
        canopyBloomRadius,
        canopyMaxDepth,
        learningProgress,
        maxRelativeBendDeg,
        priorStrength,
        scaffoldMaxDepth,
        scaffoldStrength,
        structuralMaxDepth,
        trunkRootWidth,
        trunkScaffoldStationSpecs,
        twigMaxDepth,
        twigUpwardBiasProb,
    } = topologyPlan;
    const trunkGeminiParams = resolveSakuraTrunkGeminiParamsFromGene(gene);
    const fallbackTrunkTargetHeight = height * 0.92;
    const trunkHeightControl = Number(trunkGeminiParams.maxHeight);
    const trunkTargetHeight = clamp(
        Number.isFinite(trunkHeightControl)
            ? trunkHeightControl
            : fallbackTrunkTargetHeight,
        200,
        500,
    );
    const rootLen = clamp(
        resolveSakuraTrunkGeminiSegmentLength({
            targetHeight: trunkTargetHeight,
            segments: SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.base,
        }),
        0.08,
        96,
    );
    const rootWidth = trunkRootWidth;
    const rootBranchRandom = topologyRandom.fork({
        depth: 1,
        nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.TRUNK),
        nodeSlot: 0,
        decisionType: 'root_branch',
    });
    const rootBaseAngle = resolveSakuraTrunkGeminiRootAngle();
    const trunkPathPlan = createSakuraTrunkPathPlanV1({
        gene,
        trunkGeminiParams,
        structuralMaxDepth,
        rootState: {
            currentDepth: 1,
            currentX: 0,
            currentY: 0,
            length: rootLen,
            width: rootWidth,
            parentAngle: rootBaseAngle,
            lastDir: 1,
            trunkMainDepth: 1,
            trunkBaseWidth: rootWidth,
            trunkSegmentLength: rootLen,
        },
        rootNodeRandom: topologyRandom.fork({
            depth: 1,
            nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.TRUNK),
            nodeSlot: 0,
            decisionType: 'root_branch',
        }),
        trunkTargetHeight,
        spineGuide,
        spineReferenceFamily,
        formTrunkIntentConstraint,
        ...(trunkAdaptiveSubdivisionPolicy === undefined
            ? {}
            : { adaptiveSubdivisionPolicy: trunkAdaptiveSubdivisionPolicy }),
    });
    const effectiveTrunkSegmentLimit = trunkPathPlan.trunkSegmentLimit;
    const effectiveStructuralMaxDepth = trunkPathPlan.structuralMaxDepth;
    const effectiveRootSpan = trunkPathPlan.spans[0];
    const scaffoldStationPlan = createSakuraScaffoldArcStationPlan({
        guideShapeId: trunkPathPlan.guideShapeId,
        placements: trunkScaffoldStationSpecs,
    });
    const generateBranch = createBranchGenerator({
        gene,
        currentStage,
        topologyRandom,
        morphologyProfile,
        scaffoldStrength,
        trunkSegmentLimit: effectiveTrunkSegmentLimit,
        twigMaxDepth,
        scaffoldMaxDepth,
        structuralMaxDepth: effectiveStructuralMaxDepth,
        trunkPathPlan,
        scaffoldStationPlan,
        formCompositionPlan,
        maxRelativeBendDeg,
        learningProgress,
        priorStrength,
        twigUpwardBiasProb,
        nextRandom,
        config: SAKURA_CONFIG,
        trunkTargetHeight,
    });
    const root = generateBranch({
        currentDepth: effectiveRootSpan.currentDepth,
        currentX: effectiveRootSpan.currentX,
        currentY: effectiveRootSpan.currentY,
        length: effectiveRootSpan.length,
        width: effectiveRootSpan.width,
        parentAngle: effectiveRootSpan.parentAngle,
        lastDir: effectiveRootSpan.lastDir,
        orderRunDepth: 0,
        branchOrder: SAKURA_BRANCH_ORDER.TRUNK,
        twigLevel: 0,
        nodeRandom: rootBranchRandom,
        trunkMainDepth: 1,
        scaffoldDepth: 0,
        twigDepth: 0,
        trunkBaseWidth: rootWidth,
        trunkSegmentLength: effectiveRootSpan.trunkSegmentLength,
    });

    if (resolvedGenerationDetail === SAKURA_GENERATION_DETAIL.FULL) {
        const addCanopyBloomLayer = createCanopyBloomLayer({
            currentStage,
            canopyBloomDensity,
            canopyBloomRadius,
            nextRandom,
            config: SAKURA_CONFIG,
        });
        addCanopyBloomLayer(root, topologyRandom.fork({
            depth: 0,
            nodeRole: 'canopy',
            nodeSlot: 0,
            decisionType: 'canopy',
        }));
    }

    root.initialAngle = effectiveRootSpan.parentAngle;
    root.visualPhenotype = {
        potScale: gene.potScale,
        trunkOffsetX: gene.trunkOffsetX,
        windMemory: gene.windMemory,
        morphologyProfile,
    };
    root.speciesType = 'sakura';
    root.geneProfile = {
        silhouetteTarget: gene.silhouetteTarget,
        speciesCharacter: gene.speciesCharacter,
        seasonalBloomBias: gene.seasonalBloomBias,
    };
    if (formCompositionPlan) {
        root.formCompositionPlan = formCompositionPlan;
        root.formCompositionProvenance = (
            createSakuraSingleRootFormCompositionProvenanceV1(formCompositionPlan)
        );
    }
    root.trunkDepthModel = {
        canopyMaxDepth,
        structuralMaxDepth: effectiveStructuralMaxDepth,
        trunkPlannerId: trunkPathPlan.plannerId,
        trunkGuideId: trunkPathPlan.guideId,
        trunkGuideShapeId: trunkPathPlan.guideShapeId,
        trunkMorphologyIntentPlanId: trunkPathPlan.morphologyIntentPlanId,
        trunkMorphologyIntentPlannerId: trunkPathPlan.morphologyIntentPlannerId,
        trunkAdaptivePolicyId: trunkPathPlan.adaptiveDiscretization.policyId,
        trunkAdaptiveSpanCount: trunkPathPlan.adaptiveDiscretization.spanCount,
        trunkAdaptiveTargetAdjacentArcRatio:
            trunkPathPlan.adaptiveDiscretization.targetAdjacentArcRatio,
        trunkAdaptiveAchievedMaxAdjacentArcRatio:
            trunkPathPlan.adaptiveDiscretization.achievedMaxAdjacentArcRatio,
        trunkAdaptiveArcBalanceLimitedByHardCap:
            trunkPathPlan.adaptiveDiscretization.arcBalanceLimitedByHardCap,
        trunkSegmentLimit: effectiveTrunkSegmentLimit,
        trunkScaffoldStationCount: scaffoldStationPlan.stations.length,
        scaffoldMaxDepth,
        twigMaxDepth,
        ...(formCompositionPlan ? {
            formCompositionPlanId: formCompositionPlan.planId,
            formCompositionFormId: formCompositionPlan.sourcePrior.formId,
            formCompositionVariantSeed: formCompositionPlan.sourcePrior.variantSeed,
        } : {}),
        ...(trunkPathPlan.spineReferenceFamily ? {
            spineReferenceFamilyId: trunkPathPlan.spineReferenceFamily.familyId,
            spineReferenceGuideId: trunkPathPlan.spineReferenceFamily.referenceGuideId,
            spineReferenceLikeness: trunkPathPlan.spineReferenceFamily.likeness,
            spineReferenceVariationPolicyId:
                trunkPathPlan.spineReferenceFamily.variationPolicyId,
            spineReferenceVariantGuideId:
                trunkPathPlan.spineReferenceFamily.variantGuideId,
        } : {}),
    };
    root.trunkMacroLineage = createSakuraTrunkMacroLineage({
        guideShapeId: trunkPathPlan.guideShapeId,
        arcLength: trunkPathPlan.adaptiveDiscretization.totalArcNorm * trunkTargetHeight,
        baseWidth: rootWidth,
    });
    root.trunkMacroRenderAttestation = createSakuraTrunkMacroRenderAttestation({
        guideShapeId: trunkPathPlan.guideShapeId,
        physicalTrunkSpans: resolveSakuraTrunkMacroPhysicalGeometrySpansV1(trunkPathPlan),
    });
    if (trunkPathPlan.spineReferenceFamily) {
        root.spineReferenceFamily = { ...trunkPathPlan.spineReferenceFamily };
    }
    return root;
};
