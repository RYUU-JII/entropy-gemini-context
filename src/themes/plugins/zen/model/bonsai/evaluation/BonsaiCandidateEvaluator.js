import { SeededRandom } from '../../SeededRandom';
import { TREE_FEATURE_KEYS, TreeAnalyzer } from '../../TreeAnalyzer';
import { HardFeasibilityGateModel } from '../constraints/HardFeasibilityGateModel';
import { BonsaiFormClassifier } from '../morphology/BonsaiFormClassifier';
import { BonsaiStructuralDescriptorModel } from '../morphology/BonsaiStructuralDescriptorModel';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from './bonsaiCandidateEvaluationProfile';
import {
    DEFAULT_BONSAI_CANDIDATE_STAGE_SEED_OFFSET,
    resolveBonsaiCandidateTopologySeed,
} from './bonsaiCandidateTopologySeed';

const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const normalizeStageProfiles = (stageProfiles) => {
    const raw = Array.isArray(stageProfiles) && stageProfiles.length
        ? stageProfiles.map((entry, index) => ({
            id: entry?.id || `stage_${index + 1}`,
            stage: entry?.stage || entry,
            weight: Number.isFinite(entry?.weight) ? Math.max(0, entry.weight) : 1,
        }))
        : [{ id: 'stage_primary', stage: stageProfiles, weight: 1 }];

    const totalWeight = raw.reduce((acc, entry) => acc + entry.weight, 0);
    if (totalWeight <= 0) {
        return raw.map((entry) => ({ ...entry, weight: 1 / raw.length }));
    }
    return raw.map((entry) => ({ ...entry, weight: entry.weight / totalWeight }));
};

const buildMergedAnalysis = (normalizedStages, primaryStage) => {
    const aggregatedFeatures = {};
    TREE_FEATURE_KEYS.forEach((key) => {
        aggregatedFeatures[key] = round(
            normalizedStages.reduce(
                (acc, entry) => acc + (Number(entry.analysis.features?.[key]) || 0) * entry.weight,
                0,
            ),
            4,
        );
    });

    const ruleScore = normalizedStages.reduce(
        (acc, entry) => acc + (Number(entry.analysis.evaluation?.ruleScore) || 0) * entry.weight,
        0,
    );
    const noveltyScore = normalizedStages.reduce(
        (acc, entry) => acc + (Number(entry.analysis.evaluation?.noveltyScore) || 0.5) * entry.weight,
        0,
    );
    const bloomRatio = normalizedStages.reduce(
        (acc, entry) => acc + (Number(entry.analysis.factors?.bloomRatio) || 0) * entry.weight,
        0,
    );

    return {
        ...primaryStage.analysis,
        features: aggregatedFeatures,
        factors: {
            ...(primaryStage.analysis.factors || {}),
            bloomRatio: round(bloomRatio, 4),
        },
        evaluation: {
            ...(primaryStage.analysis.evaluation || {}),
            ruleScore: round(ruleScore, 4),
            noveltyScore: round(noveltyScore, 4),
        },
        stageBreakdown: normalizedStages.map((entry) => ({
            id: entry.id,
            weight: round(entry.weight, 3),
            ruleScore: round(entry.analysis.evaluation?.ruleScore ?? 0, 4),
            noveltyScore: round(entry.analysis.evaluation?.noveltyScore ?? 0.5, 4),
        })),
    };
};
const buildCandidateModelInput = (modelInput = null, mergedAnalysis = null) => {
    const fallbackFeatures = mergedAnalysis?.features && typeof mergedAnalysis.features === 'object'
        ? { ...mergedAnalysis.features }
        : {};
    if (!modelInput || typeof modelInput !== 'object') {
        return { features: fallbackFeatures };
    }
    const features = modelInput?.features && typeof modelInput.features === 'object'
        ? { ...modelInput.features }
        : fallbackFeatures;
    const latent = modelInput?.latent && typeof modelInput.latent === 'object'
        ? { ...modelInput.latent }
        : null;
    return {
        ...modelInput,
        features,
        ...(latent ? { latent } : {}),
    };
};

export class BonsaiCandidateEvaluator {
    constructor({
        treeType,
        species,
        stageProfiles,
        width,
        height,
        topologyHeight,
        stageSeedOffset = DEFAULT_BONSAI_CANDIDATE_STAGE_SEED_OFFSET,
        referenceFeatures = [],
        scoreModel = null,
        constraintModel = null,
        baselinePhenotype = null,
        hardGateModel = null,
    } = {}) {
        this.treeType = treeType;
        this.species = species;
        this.stageProfiles = normalizeStageProfiles(stageProfiles);
        this.width = width;
        this.height = height;
        this.topologyHeight = topologyHeight;
        this.stageSeedOffset = stageSeedOffset;
        this.referenceFeatures = Array.isArray(referenceFeatures) ? referenceFeatures : [];
        this.scoreModel = scoreModel;
        this.constraintModel = constraintModel;
        this.baselinePhenotype = baselinePhenotype;
        this.hardGateModel = hardGateModel || new HardFeasibilityGateModel({ treeType });
    }

    evaluate({
        seed,
        phenotype,
        referenceFeatures = this.referenceFeatures,
        baselinePhenotype = this.baselinePhenotype,
        preflightReject = false,
        modelInput = null,
        generationOptions = null,
    } = {}) {
        if (!this.species || !this.width || !this.height) {
            return null;
        }

        const continuityScore = this.constraintModel
            ? this.constraintModel.scorePhenotypeContinuity(phenotype, baselinePhenotype)
            : 1;
        const continuityFeasibility = this.constraintModel
            ? this.constraintModel.evaluateFeasibility(phenotype, baselinePhenotype)
            : {
                pass: true,
                passProbability: 1,
                continuityScore,
                threshold: 0,
            };
        const preflightStage = this.stageProfiles.find((entry) => (
            entry?.id === 'stage_bloom' || entry?.id === 'bloom'
        )) || this.stageProfiles[this.stageProfiles.length - 1];
        const preflightHardGate = this.hardGateModel
            ? this.hardGateModel.evaluatePreflightPhenotype({
                phenotype,
                stage: preflightStage?.stage || null,
                continuityFeasibility,
            })
            : {
                pass: true,
                passProbability: 1,
                failedRules: [],
                signals: null,
            };
        if (preflightReject && (!continuityFeasibility?.pass || !preflightHardGate?.pass)) {
            return null;
        }

        const stableHeight = Number.isFinite(this.topologyHeight)
            ? this.topologyHeight
            : this.height;
        const potHeight = Number(this.species?.getPotDimensions?.(phenotype)?.height);
        if (!Number.isFinite(potHeight) || potHeight <= 0) {
            throw new Error('ZEN_BONSAI_CANDIDATE_POT_HEIGHT_REQUIRED');
        }
        const evaluateStageProfile = (profile, index) => {
            const stageSeed = resolveBonsaiCandidateTopologySeed({
                candidateSeed: seed,
                stageProfileIndex: index,
                stageSeedOffset: this.stageSeedOffset,
            });
            const rng = new SeededRandom(stageSeed);
            const topology = this.species.generateTopology(
                rng,
                profile.stage,
                stableHeight || 300,
                phenotype,
                generationOptions && typeof generationOptions === 'object'
                    ? generationOptions
                    : {},
            );
            const treeAnalysis = TreeAnalyzer.analyze(topology, this.width, this.height, {
                species: this.treeType,
                referenceFeatures,
            });
            if (!treeAnalysis?.features) {
                return null;
            }
            const structuralDescriptor = BonsaiStructuralDescriptorModel.analyze(topology, {
                potHeight,
            });
            const analysis = {
                ...treeAnalysis,
                structuralMorphology: {
                    descriptor: structuralDescriptor,
                    classification: BonsaiFormClassifier.classify(structuralDescriptor),
                },
            };
            return {
                id: profile.id,
                weight: profile.weight,
                stage: profile.stage,
                topology,
                analysis,
            };
        };
        const primaryStageIndex = this.stageProfiles.findIndex((entry) => (
            entry?.id === 'stage_bloom' || entry?.id === 'bloom'
        ));
        const resolvedPrimaryStageIndex = primaryStageIndex >= 0
            ? primaryStageIndex
            : Math.max(0, this.stageProfiles.length - 1);
        const primaryProfile = this.stageProfiles[resolvedPrimaryStageIndex];
        const primaryCandidate = evaluateStageProfile(primaryProfile, resolvedPrimaryStageIndex);
        if (!primaryCandidate) {
            return null;
        }
        if (preflightReject && this.hardGateModel) {
            const quickHardGate = this.hardGateModel.evaluate({
                topology: primaryCandidate.topology,
                analysis: primaryCandidate.analysis,
                stage: primaryCandidate.stage,
            });
            if (!quickHardGate?.pass) {
                return null;
            }
        }

        const stageCandidates = [primaryCandidate];
        this.stageProfiles.forEach((profile, index) => {
            if (index === resolvedPrimaryStageIndex) {
                return;
            }
            const evaluated = evaluateStageProfile(profile, index);
            if (evaluated) {
                stageCandidates.push(evaluated);
            }
        });

        if (!stageCandidates.length) {
            return null;
        }

        const stageWeightSum = stageCandidates.reduce((acc, entry) => acc + entry.weight, 0) || 1;
        const normalizedStages = stageCandidates.map((entry) => ({
            ...entry,
            weight: entry.weight / stageWeightSum,
        }));
        const primaryStage = normalizedStages.find((entry) => entry.id === 'stage_bloom')
            || normalizedStages.find((entry) => entry.id === 'bloom')
            || normalizedStages[normalizedStages.length - 1];

        const mergedAnalysis = buildMergedAnalysis(normalizedStages, primaryStage);
        mergedAnalysis.evaluationProfile = BONSAI_CANDIDATE_EVALUATION_PROFILE.FULL;
        mergedAnalysis.evaluation = {
            ...(mergedAnalysis.evaluation || {}),
            profile: BONSAI_CANDIDATE_EVALUATION_PROFILE.FULL,
        };
        const hardGate = this.hardGateModel
            ? this.hardGateModel.evaluate({
                topology: primaryStage?.topology || null,
                analysis: mergedAnalysis,
                stage: primaryStage?.stage || null,
            })
            : {
                pass: true,
                passProbability: 1,
                failedRules: [],
                warningScore: 0,
                signals: null,
            };
        const continuityPass = Boolean(continuityFeasibility?.pass);
        const hardPass = Boolean(hardGate?.pass) && Boolean(preflightHardGate?.pass);
        const combinedPass = continuityPass && hardPass;
        const combinedPassProbability = round(
            clamp01(
                Number(continuityFeasibility?.passProbability ?? 1)
                * Number(preflightHardGate?.passProbability ?? 1)
                * Number(hardGate?.passProbability ?? 1),
            ),
            4,
        );
        const failedRules = [
            ...(continuityPass ? [] : [{
                id: 'continuity_threshold',
                continuityScore: round(continuityFeasibility?.continuityScore ?? continuityScore, 4),
                threshold: round(continuityFeasibility?.threshold ?? 0, 4),
            }]),
            ...((Array.isArray(preflightHardGate?.failedRules) ? preflightHardGate.failedRules : []).map((entry) => ({
                ...entry,
            }))),
            ...((Array.isArray(hardGate?.failedRules) ? hardGate.failedRules : []).map((entry) => ({
                ...entry,
            }))),
        ];
        const candidateModelInput = buildCandidateModelInput(modelInput, mergedAnalysis);
        const scoring = this.scoreModel
            ? this.scoreModel.scoreCandidate({
                normalizedStages,
                aggregatedAnalysis: mergedAnalysis,
                pairwiseInput: candidateModelInput,
                referenceCount: Array.isArray(referenceFeatures) ? referenceFeatures.length : 0,
                continuityScore,
                warningScore: hardGate?.warningScore || 0, // [NEW] Pass the penalty
            })
            : { scores: { rule: 0, neural: 0.5, pairwise: 0.5, novelty: 0.5, blended: 0.5 } };

        return {
            seed,
            phenotype,
            topology: primaryStage.topology,
            render: {
                source: 'bonsai_candidate_evaluator_v1',
                evaluationProfile: BONSAI_CANDIDATE_EVALUATION_PROFILE.FULL,
                generationDetail: 'full',
                seed,
                topologySeed: resolveBonsaiCandidateTopologySeed({
                    candidateSeed: seed,
                    stageProfileIndex: resolvedPrimaryStageIndex,
                    stageSeedOffset: this.stageSeedOffset,
                }),
                stageSeedOffset: this.stageSeedOffset,
                stageProfileIndex: resolvedPrimaryStageIndex,
                stageProfileId: primaryProfile?.id || primaryStage?.id || null,
                topologyReferenceHeight: stableHeight || 300,
                stage: primaryProfile?.stage && typeof primaryProfile.stage === 'object'
                    ? { ...primaryProfile.stage }
                    : null,
            },
            analysis: mergedAnalysis,
            metric: mergedAnalysis,
            modelInput: candidateModelInput,
            scores: scoring.scores,
            brainMeta: scoring.brainMeta,
            pairwiseMeta: scoring.pairwiseMeta,
            stageModelScores: scoring.stageModelScores,
            feasibility: {
                pass: combinedPass,
                passProbability: combinedPassProbability,
                continuityScore: round(continuityFeasibility?.continuityScore ?? continuityScore, 4),
                threshold: round(continuityFeasibility?.threshold ?? 0, 4),
                hardGate: {
                    pass: hardPass,
                    passProbability: round(hardGate?.passProbability ?? 1, 4),
                    warningScore: round(hardGate?.warningScore ?? 0, 4),
                    preflight: {
                        pass: Boolean(preflightHardGate?.pass),
                        passProbability: round(preflightHardGate?.passProbability ?? 1, 4),
                        failedRules: Array.isArray(preflightHardGate?.failedRules) ? preflightHardGate.failedRules : [],
                        signals: preflightHardGate?.signals || null,
                    },
                    failedRules: Array.isArray(hardGate?.failedRules) ? hardGate.failedRules : [],
                    signals: hardGate?.signals || null,
                },
                failedRules,
            },
        };
    }
}
