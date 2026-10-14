import { SAKURA_GENERATION_DETAIL } from '../../sakura/sakuraGenerationDetail';
import { BonsaiStructuralScoutEvaluator } from './BonsaiStructuralScoutEvaluator';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from './bonsaiCandidateEvaluationProfile';
import {
    DEFAULT_BONSAI_CANDIDATE_STAGE_SEED_OFFSET,
    resolveBonsaiCandidateTopologySeed,
} from './bonsaiCandidateTopologySeed';
import {
    createSakuraMacroSpineGuideConditionV1,
} from '../../sakura/sakuraMacroSpineGuideCondition';
import {
    requireSakuraSpineReferenceFamilyV1,
} from '../../sakura/sakuraSpineReferenceFamily';
import {
    createSakuraSpineReferenceFamilyConditionV1,
} from '../../sakura/sakuraSpineReferenceFamilyCondition';
import {
    createBonsaiMorphologyEvidenceV1,
} from '../morphology/BonsaiMorphologyEvidenceContract';
import {
    createBonsaiStructuralComparisonPlanV1,
    measureBonsaiStructuralComparisonSceneBoundsV1,
} from '../rendering/BonsaiStructuralComparisonPlan';
import {
    requireSakuraSingleRootFormCompositionProvenanceV1,
} from '../../sakura/sakuraSingleRootFormCompositionAdapter';

const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const normalizeStageProfiles = (stageProfiles) => {
    const profiles = (Array.isArray(stageProfiles) ? stageProfiles : [])
        .map((entry, index) => ({
            id: entry?.id || `stage_${index + 1}`,
            stage: entry?.stage || entry,
        }))
        .filter((entry) => entry.stage && typeof entry.stage === 'object');
    if (!profiles.length) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_STAGE_REQUIRED');
    }
    return profiles;
};

const resolvePrimaryStageIndex = (stageProfiles) => {
    const bloomIndex = stageProfiles.findIndex((entry) => (
        entry.id === 'stage_bloom' || entry.id === 'bloom'
    ));
    return bloomIndex >= 0 ? bloomIndex : stageProfiles.length - 1;
};

const cloneModelInput = (modelInput, structuralFeatures) => {
    if (!modelInput || typeof modelInput !== 'object' || Array.isArray(modelInput)) {
        return { features: { ...structuralFeatures } };
    }
    const latent = modelInput.latent && typeof modelInput.latent === 'object'
        ? { ...modelInput.latent }
        : null;
    return {
        ...modelInput,
        features: { ...structuralFeatures },
        ...(latent ? { latent } : {}),
    };
};

const buildStructuralMetric = ({ descriptor, classification }) => {
    const features = { ...descriptor.vector };
    const branchCount = Number(descriptor?.topology?.trunkSegmentCount || 0)
        + Number(descriptor?.topology?.scaffoldSegmentCount || 0);
    return {
        evaluationProfile: BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT,
        featureOrder: Object.keys(features),
        features,
        structural: {
            branchCount,
            trunkSegmentCount: Number(descriptor?.topology?.trunkSegmentCount || 0),
            primaryScaffoldCount: Number(descriptor?.topology?.primaryScaffoldCount || 0),
            scaffoldSegmentCount: Number(descriptor?.topology?.scaffoldSegmentCount || 0),
            structuralTipCount: Number(descriptor?.topology?.structuralTipCount || 0),
            width: Number(descriptor?.bounds?.width || 0),
            height: Number(descriptor?.bounds?.height || 0),
        },
        factors: {
            primaryFormId: classification?.primaryFormId || null,
            primaryFormScore: round(Number(classification?.primaryScore || 0)),
        },
        density: null,
        evaluation: {
            profile: BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT,
            ruleScore: 0.5,
            noveltyScore: 0.5,
            prior: 'neutral_structural_prior',
        },
        structuralMorphology: {
            descriptor,
            classification,
        },
    };
};

export class BonsaiStructuralCandidateEvaluator {
    constructor({
        treeType,
        species,
        stageProfiles,
        topologyHeight,
        stageSeedOffset = DEFAULT_BONSAI_CANDIDATE_STAGE_SEED_OFFSET,
        scoreModel = null,
    } = {}) {
        this.treeType = treeType;
        this.species = species;
        this.stageProfiles = normalizeStageProfiles(stageProfiles);
        this.topologyHeight = Number(topologyHeight);
        this.stageSeedOffset = Number(stageSeedOffset);
        this.scoreModel = scoreModel;
        if (!Number.isFinite(this.topologyHeight) || this.topologyHeight <= 0) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_HEIGHT_REQUIRED');
        }
        if (!Number.isFinite(this.stageSeedOffset) || this.stageSeedOffset <= 0) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_STAGE_SEED_OFFSET_INVALID');
        }
    }

    evaluate({
        seed,
        phenotype,
        modelInput = null,
        generationOptions = null,
    } = {}) {
        if (generationOptions?.spineGuide && generationOptions?.spineReferenceFamily) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_SPINE_CONDITION_CONFLICT');
        }
        const spineReferenceFamily = generationOptions?.spineReferenceFamily
            ? requireSakuraSpineReferenceFamilyV1(generationOptions.spineReferenceFamily)
            : null;
        const primaryStageIndex = resolvePrimaryStageIndex(this.stageProfiles);
        const primaryProfile = this.stageProfiles[primaryStageIndex];
        const topologySeed = resolveBonsaiCandidateTopologySeed({
            candidateSeed: seed,
            stageProfileIndex: primaryStageIndex,
            stageSeedOffset: this.stageSeedOffset,
        });
        const scout = new BonsaiStructuralScoutEvaluator({
            treeType: this.treeType,
            species: this.species,
            stage: primaryProfile.stage,
            topologyHeight: this.topologyHeight,
        }).evaluate({
            seed: topologySeed,
            phenotype,
            latent: modelInput?.latent || null,
            generationOptions,
        });
        const spineGuideCondition = generationOptions?.spineGuide
            ? createSakuraMacroSpineGuideConditionV1(generationOptions.spineGuide)
            : null;
        const spineReferenceFamilyCondition = spineReferenceFamily
            ? createSakuraSpineReferenceFamilyConditionV1(spineReferenceFamily)
            : null;
        const spineReferenceVariantGuideId = spineReferenceFamily
            ? scout.topology?.trunkDepthModel?.spineReferenceVariantGuideId
            : null;
        if (
            spineReferenceFamily
            && (
                typeof spineReferenceVariantGuideId !== 'string'
                || !spineReferenceVariantGuideId.trim()
                || scout.topology?.trunkDepthModel?.spineReferenceFamilyId
                    !== spineReferenceFamilyCondition.familyId
                || scout.topology?.trunkDepthModel?.spineReferenceGuideId
                    !== spineReferenceFamilyCondition.referenceGuideId
                || Number(scout.topology?.trunkDepthModel?.spineReferenceLikeness)
                    !== spineReferenceFamilyCondition.likeness
                || scout.topology?.trunkDepthModel?.spineReferenceVariationPolicyId
                    !== spineReferenceFamilyCondition.variationPolicyId
            )
        ) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_SPINE_REFERENCE_PROVENANCE_INVALID');
        }
        const formCompositionProvenance = scout.topology?.formCompositionProvenance
            ? requireSakuraSingleRootFormCompositionProvenanceV1(
                scout.topology.formCompositionProvenance,
            )
            : null;
        const formInputRequested = Boolean(
            generationOptions?.formCompositionPrior
            || generationOptions?.formId,
        );
        if (formInputRequested !== Boolean(formCompositionProvenance)) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_FORM_PROVENANCE_REQUIRED');
        }
        if (
            formCompositionProvenance
            && generationOptions?.formId
            && generationOptions.formId !== formCompositionProvenance.formId
        ) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_CANDIDATE_FORM_PROVENANCE_MISMATCH');
        }
        const morphologyEvidence = createBonsaiMorphologyEvidenceV1({
            descriptor: scout.structuralMorphology.descriptor,
            targetFormId: formCompositionProvenance?.formId || null,
        });
        const structuralSceneBounds = measureBonsaiStructuralComparisonSceneBoundsV1({
            topology: scout.topology,
            species: this.species,
            strictStructural: true,
        });
        const structuralComparisonPlan = createBonsaiStructuralComparisonPlanV1({
            topology: scout.topology,
            sceneBounds: structuralSceneBounds,
            strictStructural: true,
        });
        const analysis = buildStructuralMetric(scout.structuralMorphology);
        const candidateModelInput = cloneModelInput(modelInput, analysis.features);
        const normalizedStages = [{
            id: primaryProfile.id,
            weight: 1,
            stage: primaryProfile.stage,
            analysis,
        }];
        const scoring = this.scoreModel
            ? this.scoreModel.scoreCandidate({
                normalizedStages,
                aggregatedAnalysis: analysis,
                pairwiseInput: candidateModelInput,
                referenceCount: 0,
                continuityScore: 1,
                warningScore: 0,
            })
            : {
                scores: {
                    rule: 0.5,
                    neural: 0.5,
                    pairwise: 0.5,
                    pairwiseRaw: 0.5,
                    pairwiseCalibrated: 0.5,
                    novelty: 0.5,
                    blended: 0.5,
                    objective: 0.5,
                },
                brainMeta: null,
                pairwiseMeta: null,
                stageModelScores: [],
            };

        return {
            seed: Math.floor(Number(seed)),
            phenotype,
            topology: scout.topology,
            render: {
                source: 'bonsai_structural_candidate_evaluator_v1',
                evaluationProfile: BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT,
                generationDetail: SAKURA_GENERATION_DETAIL.STRUCTURAL_SCOUT,
                seed: Math.floor(Number(seed)),
                topologySeed,
                stageSeedOffset: this.stageSeedOffset,
                stageProfileIndex: primaryStageIndex,
                stageProfileId: primaryProfile.id,
                topologyReferenceHeight: this.topologyHeight,
                stage: { ...primaryProfile.stage },
                ...(generationOptions?.spineGuide
                    ? {
                        spineGuide: generationOptions.spineGuide,
                        spineGuideConditionId: spineGuideCondition.conditionId,
                        spineGuideRole: spineGuideCondition.role,
                        spineGuideId: spineGuideCondition.guideId,
                        spineGuideAdherence: spineGuideCondition.adherence,
                    }
                    : {}),
                ...(spineReferenceFamily
                    ? {
                        spineReferenceFamily,
                        spineReferenceFamilyConditionId:
                            spineReferenceFamilyCondition.conditionId,
                        spineReferenceFamilyRole: spineReferenceFamilyCondition.role,
                        spineReferenceFamilyId: spineReferenceFamilyCondition.familyId,
                        spineReferenceGuideId:
                            spineReferenceFamilyCondition.referenceGuideId,
                        spineReferenceLikeness: spineReferenceFamilyCondition.likeness,
                        spineReferenceVariationPolicyId:
                            spineReferenceFamilyCondition.variationPolicyId,
                        spineReferenceVariantGuideId,
                    }
                    : {}),
                ...(formCompositionProvenance
                    ? { formComposition: { ...formCompositionProvenance } }
                    : {}),
            },
            analysis,
            metric: analysis,
            morphologyEvidence,
            structuralComparisonPlan,
            modelInput: candidateModelInput,
            scores: scoring.scores,
            brainMeta: scoring.brainMeta,
            pairwiseMeta: scoring.pairwiseMeta,
            stageModelScores: scoring.stageModelScores,
            feasibility: {
                pass: true,
                passProbability: 1,
                continuityScore: 1,
                threshold: 0,
                hardGate: {
                    pass: true,
                    passProbability: 1,
                    warningScore: 0,
                    failedRules: [],
                    signals: {
                        branchCount: analysis.structural.branchCount,
                        trunkSegmentCount: analysis.structural.trunkSegmentCount,
                        scaffoldSegmentCount: analysis.structural.scaffoldSegmentCount,
                    },
                },
                failedRules: [],
            },
        };
    }
}
