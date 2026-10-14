import { useCallback, useEffect, useMemo, useState } from 'react';
import { SeededRandom } from '../../model/SeededRandom';
import {
    STAGES,
    CANONICAL_LEARNING_STAGE,
    withStructureDepth,
    createEvaluationStageProfiles,
    createCanonicalEvaluationStageProfiles,
    DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    clampCanopyDistributionTuning,
    OBJECTIVE_MODE,
    TOPOLOGY_REFERENCE_HEIGHT,
    resolveSpecies,
} from '../../model/ZenCoreConfig';
import { resolveSakuraGeneratorLearningProgress } from '../../model/SakuraLearningPolicy';
import { CandidateScoreModel } from '../../model/bonsai/scoring/CandidateScoreModel';
import { BonsaiCandidateEvaluator } from '../../model/bonsai/evaluation/BonsaiCandidateEvaluator';
import { resolveZenBonsaiPondBioticSignal } from '../../model/zenBonsaiPondBioticSignal.js';
import {
    resolveZenBonsaiGrowthProjection,
} from '../../model/ZenBonsaiGrowthProjection.js';
import { resolveSakuraV2ReliabilityGate } from '../../model/SakuraV2Runtime';
import {
    projectZenBonsaiClassic2DevelopmentTopology,
    resolveZenBonsaiClassic2DisplayCandidateStage,
    resolveZenBonsaiClassic2RenderStage,
} from '../../model/classic2/ZenBonsaiClassic2DevelopmentModel.js';
import {
    ZEN_BONSAI_MODEL_IDS,
    ZEN_BONSAI_MODEL_SURFACES,
    requireZenBonsaiModelAdmission,
} from '../../model/ZenBonsaiModelCatalog.js';
import { useZenBonsaiClassic2LineageRuntime } from './useZenBonsaiClassic2LineageRuntime.js';
import {
    resolveZenBonsaiClassic2WoodClockPolicyForLineageMode,
} from './zenBonsaiClassic2LineageRuntimeMode.js';
import {
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
} from '../../contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
    resolveSakuraSpineGenerationConditionIdV1,
} from '../../model/sakura/sakuraSpineGenerationCondition.js';
import {
    ZenBonsaiG15Species,
    generateG15Topology,
} from '../../model/bonsai/g15/ZenBonsaiG15Species.js';
import { ZenBonsaiPlumeSpecies } from '../../model/bonsai/plume/ZenBonsaiPlumeSpeciesDescriptor.js';
import { resolveZenBonsaiPlumeBioticSignal } from '../../model/bonsai/plume/ZenBonsaiPlumeBioticSignal.js';
import { useZenBonsaiPlumeTopology } from './useZenBonsaiPlumeTopology.js';
import {
    resolveZenClassicDisplayGrowthStage,
} from './zenClassicGrowthStageProjection.js';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? Number(value) : 0));

export function useZenClassicAnalysisRuntime({
    treeType,
    currentPhenotype,
    spineGuide = null,
    spineReferenceFamily = null,
    treeSeed,
    structureDepth,
    experimental = false,
    canopyDistributionTuning = null,
    isSakuraV2Enabled = true,
    trainingCount = 0,
    activePairwiseTrainingCount = 0,
    brain = null,
    activePairwiseBrain = null,
    activePairwiseMeta = null,
    abHistory = [],
    learningLatentKeys = [],
    learningKeyspaceProfile = null,
    likedCollection = [],
    referenceCutoffMs = 0,
    analysisWidth = 1,
    analysisHeight = 1,
    publishPondBioticSignal = null,
    bonsaiLifeState = null,
    bonsaiGrowthModel = ZEN_BONSAI_MODEL_IDS.CLASSIC2,
    classic2LineageMode = null,
    classic2LineageRepository = null,
    classic2StructureMode = null,
    classic2IdentityRevision = null,
    classic2CanonicalLatent = null,
    classic2CanonicalLatentVersion = null,
    classic2ProfileEpoch = null,
    classic2CanonicalTreeIdentity = null,
    classic2CanonicalGenerationInputs = null,
    bootTraceContext = null,
    onFirstVisualMilestone = null,
    analysisEnabled = true,
    candidatePreparationEnabled = analysisEnabled,
}) {
    if (spineGuide && spineReferenceFamily) {
        throw new Error('ZEN_CLASSIC_SPINE_GENERATION_CONDITION_CONFLICT');
    }
    const resolvedBonsaiGrowthModel = requireZenBonsaiModelAdmission({
        surface: ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
        modelId: bonsaiGrowthModel,
    });
    const classic2WoodClockPolicy = classic2LineageMode === null
        ? null
        : resolveZenBonsaiClassic2WoodClockPolicyForLineageMode(classic2LineageMode);
    if (
        candidatePreparationEnabled
        && resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.CLASSIC2
        && (
            !classic2CanonicalLatent
            || typeof classic2CanonicalLatent !== 'object'
            || Array.isArray(classic2CanonicalLatent)
            || classic2CanonicalLatentVersion === null
            || classic2CanonicalLatentVersion === undefined
        )
    ) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANONICAL_LATENT_REQUIRED');
    }
    if (
        candidatePreparationEnabled
        && resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.CLASSIC2
        && (!Number.isSafeInteger(classic2IdentityRevision) || classic2IdentityRevision < 1)
    ) {
        throw new Error('ZEN_BONSAI_CLASSIC2_IDENTITY_REVISION_REQUIRED');
    }
    const sakuraV2Gate = useMemo(() => resolveSakuraV2ReliabilityGate({
        trainingCount,
        pairwiseTrainingCount: activePairwiseTrainingCount,
        neuralMeta: brain?.getMeta?.() || null,
        pairwiseMeta: activePairwiseMeta,
        abHistory,
        factorKeys: treeType === 'sakura' ? learningLatentKeys : [],
        learningKeyspaceProfile,
    }), [
        trainingCount,
        activePairwiseTrainingCount,
        brain,
        activePairwiseMeta,
        abHistory,
        treeType,
        learningLatentKeys,
        learningKeyspaceProfile,
    ]);
    const sakuraGenerationLearningState = useMemo(() => resolveSakuraGeneratorLearningProgress({
        trainingCount,
        pairwiseTrainingCount: activePairwiseTrainingCount,
        neuralMeta: brain?.getMeta?.() || null,
        pairwiseMeta: activePairwiseMeta,
        abHistory,
    }), [
        trainingCount,
        activePairwiseTrainingCount,
        brain,
        activePairwiseMeta,
        abHistory,
    ]);
    const [analysisPhenotype, setAnalysisPhenotype] = useState(currentPhenotype);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnalysisPhenotype(currentPhenotype);
        }, 350);
        return () => clearTimeout(timer);
    }, [currentPhenotype]);

    const isG15 = resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.G15_4;
    const isPlume = resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.PLUME;
    const plumeModel = useZenBonsaiPlumeTopology({
        lifetimeEnabled: isPlume,
        enabled: isPlume && candidatePreparationEnabled,
        seed: treeSeed,
        lifeState: bonsaiLifeState,
        phenotype: currentPhenotype,
    });
    const plumeTopology = plumeModel.topology;
    const species = useMemo(() => {
        if (isPlume) return ZenBonsaiPlumeSpecies;
        if (isG15) return ZenBonsaiG15Species;
        return resolveSpecies(treeType);
    }, [isG15, isPlume, treeType]);
    const useCanonicalLearningStage = Boolean(experimental && treeType === 'sakura');
    const inferredLearningProgress = useMemo(
        () => (
            treeType === 'sakura' && isSakuraV2Enabled
                ? clamp01(sakuraGenerationLearningState?.progress ?? 0)
                : clamp01(sakuraV2Gate?.progress ?? 0)
        ),
        [
            treeType,
            isSakuraV2Enabled,
            sakuraGenerationLearningState?.progress,
            sakuraV2Gate?.progress,
        ],
    );
    const learningProgress = useMemo(() => {
        if (classic2CanonicalGenerationInputs === null) {
            return inferredLearningProgress;
        }
        const value = Number(classic2CanonicalGenerationInputs?.learningProgress);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error('ZEN_BONSAI_CLASSIC2_CANONICAL_LEARNING_PROGRESS_INVALID');
        }
        return value;
    }, [classic2CanonicalGenerationInputs, inferredLearningProgress]);
    const canopyDistributionProfile = useMemo(
        () => clampCanopyDistributionTuning(
            classic2CanonicalGenerationInputs === null
                ? (canopyDistributionTuning || DEFAULT_CANOPY_DISTRIBUTION_TUNING)
                : classic2CanonicalGenerationInputs?.canopyDistributionProfile,
        ),
        [canopyDistributionTuning, classic2CanonicalGenerationInputs],
    );
    const evaluationStageProfiles = useMemo(
        () => {
            const baseProfiles = useCanonicalLearningStage
                ? createCanonicalEvaluationStageProfiles(structureDepth)
                : createEvaluationStageProfiles(structureDepth);
            return baseProfiles.map((entry) => ({
                ...entry,
                stage: {
                    ...(entry.stage || {}),
                    learningProgress,
                    canopyTuning: canopyDistributionProfile,
                },
            }));
        },
        [structureDepth, learningProgress, useCanonicalLearningStage, canopyDistributionProfile],
    );
    const analysisStage = useMemo(
        () => ({
            ...(useCanonicalLearningStage
                ? withStructureDepth(CANONICAL_LEARNING_STAGE, structureDepth)
                : withStructureDepth(STAGES.BLOOM, structureDepth)),
            learningProgress,
            canopyTuning: canopyDistributionProfile,
        }),
        [structureDepth, learningProgress, useCanonicalLearningStage, canopyDistributionProfile],
    );
    const referenceFeatures = useMemo(
        () => likedCollection
            .filter((entry) => entry?.type === treeType)
            .filter((entry) => {
                if (!referenceCutoffMs) {
                    return true;
                }
                const idAsTime = Number.isFinite(entry?.id) ? Number(entry.id) : NaN;
                if (Number.isFinite(idAsTime)) {
                    return idAsTime >= referenceCutoffMs;
                }
                const timestamp = Date.parse(entry?.timestamp || '');
                return Number.isFinite(timestamp) && timestamp >= referenceCutoffMs;
            })
            .slice(-40)
            .map((entry) => ({
                features: entry.features,
                factors: entry.factors,
                density: entry.density,
                structural: entry.structural,
            })),
        [likedCollection, treeType, referenceCutoffMs],
    );
    const effectiveReferenceFeatures = referenceFeatures;
    const candidateObjectiveMode = (
        treeType === 'sakura'
        && isSakuraV2Enabled
    )
        ? OBJECTIVE_MODE.ADAPTIVE
        : OBJECTIVE_MODE.BLENDED;
    const candidateScoreModel = useMemo(() => new CandidateScoreModel({
        brain,
        pairwiseBrain: activePairwiseBrain,
        disableLearning: false,
        continuityEnabled: false,
        objectiveMode: candidateObjectiveMode,
    }), [brain, activePairwiseBrain, candidateObjectiveMode]);
    const spineGenerationOptions = useMemo(() => (
        spineReferenceFamily
            ? Object.freeze({ spineReferenceFamily })
            : Object.freeze({ spineGuide })
    ), [spineGuide, spineReferenceFamily]);
    const spineGenerationConditionId = useMemo(() => (
        resolveSakuraSpineGenerationConditionIdV1({
            spineGuide,
            spineReferenceFamily,
        })
    ), [spineGuide, spineReferenceFamily]);
    const candidateEvaluator = useMemo(() => {
        // The Classic feature/learning evaluator has no Plume graph contract.
        if (!analysisEnabled || isPlume) {
            return null;
        }
        return new BonsaiCandidateEvaluator({
            treeType,
            species,
            stageProfiles: evaluationStageProfiles,
            width: analysisWidth,
            height: analysisHeight,
            topologyHeight: TOPOLOGY_REFERENCE_HEIGHT,
            referenceFeatures: effectiveReferenceFeatures,
            scoreModel: candidateScoreModel,
        });
    }, [
        analysisEnabled,
        isPlume,
        treeType,
        species,
        evaluationStageProfiles,
        analysisWidth,
        analysisHeight,
        effectiveReferenceFeatures,
        candidateScoreModel,
    ]);
    const evaluateCandidate = useCallback((seed, phenotype, refs = effectiveReferenceFeatures, options = {}) => {
        if (!candidateEvaluator) {
            return null;
        }
        return candidateEvaluator.evaluate({
            seed,
            phenotype,
            referenceFeatures: refs,
            ...((options && typeof options === 'object') ? options : {}),
        });
    }, [candidateEvaluator, effectiveReferenceFeatures]);
    const analyzedCandidate = useMemo(
        () => (
            analysisEnabled
                ? evaluateCandidate(
                    treeSeed,
                    analysisPhenotype,
                    effectiveReferenceFeatures,
                    { generationOptions: spineGenerationOptions },
                )
                : null
        ),
        [
            activePairwiseTrainingCount,
            analysisEnabled,
            analysisPhenotype,
            effectiveReferenceFeatures,
            evaluateCandidate,
            spineGenerationOptions,
            trainingCount,
            treeSeed,
        ],
    );

    useEffect(() => {
        if (typeof publishPondBioticSignal !== 'function') {
            return;
        }
        if (isPlume) {
            const signal = resolveZenBonsaiPlumeBioticSignal({
                topology: plumeTopology,
                source: 'zen_plume_workspace',
            });
            if (signal) publishPondBioticSignal(signal);
            return;
        }
        const signal = resolveZenBonsaiPondBioticSignal({
            analysis: analysisEnabled ? analyzedCandidate?.analysis : null,
            lifeState: bonsaiLifeState,
            source: isPlume ? 'zen_plume_workspace' : 'zen_classic_workspace',
            engine: isPlume ? 'plume' : 'classic',
            stageId: 'bloom',
            seasonSpanDays: 7,
        });
        if (signal) {
            publishPondBioticSignal(signal);
        }
    }, [analysisEnabled, publishPondBioticSignal, analyzedCandidate?.analysis, bonsaiLifeState, isPlume, plumeTopology]);

    const growthProjection = useMemo(
        () => resolveZenBonsaiGrowthProjection({
            lifeState: bonsaiLifeState,
            structureDepth,
        }),
        [bonsaiLifeState, structureDepth],
    );
    const currentGrowthStageBase = useMemo(
        () => resolveZenClassicDisplayGrowthStage({
            baseStage: STAGES.BLOOM,
            lifeState: bonsaiLifeState,
            structureDepth,
            learningProgress,
            canopyDistributionProfile,
        }),
        [bonsaiLifeState, structureDepth, learningProgress, canopyDistributionProfile],
    );
    const currentGrowthStage = useMemo(() => {
        if (resolvedBonsaiGrowthModel !== ZEN_BONSAI_MODEL_IDS.CLASSIC2) {
            return currentGrowthStageBase;
        }
        return resolveZenBonsaiClassic2RenderStage({
            stage: currentGrowthStageBase,
            structureDepth,
            growthProjection,
        });
    }, [currentGrowthStageBase, growthProjection, resolvedBonsaiGrowthModel, structureDepth]);
    const classic2DisplayCandidateStage = useMemo(
        () => resolveZenBonsaiClassic2DisplayCandidateStage({
            baseStage: STAGES.BLOOM,
            structureDepth,
            learningProgress,
            canopyDistributionProfile,
        }),
        [canopyDistributionProfile, learningProgress, structureDepth],
    );
    const candidateTopology = useMemo(() => {
        if (!candidatePreparationEnabled) {
            return null;
        }
        if (isPlume) {
            return plumeTopology;
        }
        if (isG15) {
            return generateG15Topology({
                seed: treeSeed,
                lifeState: bonsaiLifeState,
                phenotype: currentPhenotype,
            });
        }
        const rng = new SeededRandom(treeSeed);
        const generationStage = resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.CLASSIC2
            ? classic2DisplayCandidateStage
            : currentGrowthStage;
        return species.generateTopology(
            rng,
            generationStage,
            TOPOLOGY_REFERENCE_HEIGHT,
            currentPhenotype,
            spineGenerationOptions,
        );
    }, [
        bonsaiLifeState,
        candidatePreparationEnabled,
        classic2DisplayCandidateStage,
        currentGrowthStage,
        currentPhenotype,
        isG15,
        isPlume,
        plumeTopology,
        resolvedBonsaiGrowthModel,
        species,
        spineGenerationOptions,
        treeSeed,
    ]);
    const classic2TreeIdentity = useMemo(() => {
        if (classic2CanonicalTreeIdentity) {
            const canonicalConditionId = (
                classic2CanonicalTreeIdentity
                    ?.generationInputs
                    ?.spineGenerationConditionId
            );
            if (canonicalConditionId !== spineGenerationConditionId) {
                throw new Error(
                    'ZEN_BONSAI_CLASSIC2_SPINE_GENERATION_CONDITION_IDENTITY_MISMATCH',
                );
            }
            return classic2CanonicalTreeIdentity;
        }
        return Object.freeze({
            contract: 'zen_bonsai_classic2_candidate_identity_v1',
            identityRevision: classic2IdentityRevision,
            treeType,
            treeSeed,
            structureDepth,
            structureMode: classic2StructureMode,
            topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
            candidateGraphContract: ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
            canonicalLatent: Object.freeze({
                version: classic2CanonicalLatentVersion,
                values: classic2CanonicalLatent,
            }),
            generationInputs: Object.freeze({
                learningProgress,
                canopyDistributionProfile,
                spineGenerationConditionId,
            }),
        });
    }, [
        canopyDistributionProfile,
        classic2CanonicalLatent,
        classic2CanonicalLatentVersion,
        classic2CanonicalTreeIdentity,
        classic2IdentityRevision,
        classic2StructureMode,
        learningProgress,
        spineGenerationConditionId,
        structureDepth,
        treeSeed,
        treeType,
    ]);
    const classic2LineageRuntime = useZenBonsaiClassic2LineageRuntime({
        enabled: analysisEnabled
            && resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.CLASSIC2,
        mode: classic2LineageMode,
        topology: candidateTopology,
        treeIdentity: classic2TreeIdentity,
        profileEpoch: classic2ProfileEpoch,
        lifeState: bonsaiLifeState,
        repository: classic2LineageRepository,
        bootTraceContext,
        onFirstVisualMilestone,
    });
    const topologyRuntime = useMemo(() => {
        if (!analysisEnabled) {
            return {
                treeTopology: null,
            };
        }
        if (resolvedBonsaiGrowthModel !== ZEN_BONSAI_MODEL_IDS.CLASSIC2) {
            return {
                treeTopology: candidateTopology,
            };
        }
        if (!classic2LineageRuntime.ready) {
            return {
                treeTopology: null,
            };
        }
        const projected = projectZenBonsaiClassic2DevelopmentTopology({
            topology: candidateTopology,
            lifeState: bonsaiLifeState,
            projection: growthProjection,
            lineageState: classic2LineageRuntime.state,
            lineageRenderBinding: classic2LineageRuntime.renderBinding,
            requireLineage: true,
            woodClockPolicy: classic2WoodClockPolicy,
        }).topology;
        return {
            treeTopology: projected,
        };
    }, [
        analysisEnabled,
        candidateTopology,
        resolvedBonsaiGrowthModel,
        bonsaiLifeState,
        growthProjection,
        classic2LineageRuntime.ready,
        classic2LineageRuntime.renderBinding,
        classic2LineageRuntime.state,
        classic2WoodClockPolicy,
    ]);
    const { treeTopology } = topologyRuntime;
    const usesDirectTopology = resolvedBonsaiGrowthModel !== ZEN_BONSAI_MODEL_IDS.CLASSIC2;
    const directTopologyReady = analysisEnabled && candidateTopology !== null;

    return {
        sakuraV2Gate,
        learningProgress,
        canopyDistributionProfile,
        evaluationStageProfiles,
        analysisStage,
        effectiveReferenceFeatures,
        species,
        evaluateCandidate,
        analyzedCandidate,
        currentGrowthStage,
        bonsaiGrowthModel: resolvedBonsaiGrowthModel,
        modelState: usesDirectTopology ? null : classic2LineageRuntime.state,
        modelReady: usesDirectTopology ? directTopologyReady : classic2LineageRuntime.ready,
        modelMaterializationReady: usesDirectTopology
            ? directTopologyReady && (!isPlume || !plumeModel.pending)
            : classic2LineageRuntime.materializationReady,
        modelProjectionPending: isPlume && plumeModel.pending,
        modelStatus: usesDirectTopology
            ? (directTopologyReady ? (isPlume && plumeModel.pending ? 'projecting' : 'ready') : 'preparing')
            : classic2LineageRuntime.status,
        modelMode: usesDirectTopology
            ? (isG15 || isPlume ? 'direct_product' : 'direct_comparison')
            : classic2LineageRuntime.mode,
        modelFingerprint: usesDirectTopology
            ? `${resolvedBonsaiGrowthModel}_seed_${treeSeed}`
            : classic2LineageRuntime.treeFingerprint,
        modelIdentityFingerprint: usesDirectTopology
            ? `${resolvedBonsaiGrowthModel}_identity_${treeSeed}`
            : classic2LineageRuntime.treeIdentityFingerprint,
        modelRequestSignature: usesDirectTopology
            ? (isPlume ? plumeModel.requestKey : null)
            : classic2LineageRuntime.requestSignature,
        modelCommittedRequestSignature: usesDirectTopology
            ? (isPlume ? plumeModel.acceptedKey : `${resolvedBonsaiGrowthModel}_direct_generation_v1`)
            : classic2LineageRuntime.committedRequestSignature,
        modelStateRevision: usesDirectTopology ? 1 : classic2LineageRuntime.stateRevision,
        classic2LineageState: classic2LineageRuntime.state,
        classic2LineageReady: classic2LineageRuntime.ready,
        classic2LineageMaterializationReady: classic2LineageRuntime.materializationReady,
        classic2LineageStatus: classic2LineageRuntime.status,
        classic2LineageMode: classic2LineageRuntime.mode,
        classic2WoodClockPolicy,
        classic2LineageFingerprint: classic2LineageRuntime.treeFingerprint,
        classic2LineageIdentityFingerprint: classic2LineageRuntime.treeIdentityFingerprint,
        classic2LineageRequestSignature: classic2LineageRuntime.requestSignature,
        classic2LineageCommittedRequestSignature: classic2LineageRuntime.committedRequestSignature,
        classic2LineageStateRevision: classic2LineageRuntime.stateRevision,
        classic2CultivationHistorySignature: classic2LineageRuntime.cultivationHistorySignature,
        classic2LineageDiagnostics: classic2LineageRuntime.diagnostics,
        treeTopology,
        setAnalysisPhenotype,
    };
}

export default useZenClassicAnalysisRuntime;
