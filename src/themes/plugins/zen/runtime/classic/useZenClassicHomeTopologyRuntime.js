import { useEffect, useMemo } from 'react';

import { SeededRandom } from '../../model/SeededRandom.js';
import { TreeAnalyzer } from '../../model/TreeAnalyzer.js';
import {
    STAGES,
} from '../../model/ZenBonsaiStageContract.js';
import {
    clampCanopyDistributionTuning,
    TOPOLOGY_REFERENCE_HEIGHT,
} from '../../model/ZenCoreConfigOptimizationTuning.js';
import {
    resolveHomeSpecies,
} from '../../model/ZenBonsaiHomeSpeciesRegistry.js';
import {
    resolveZenBonsaiPondBioticSignal,
} from '../../model/zenBonsaiPondBioticSignal.js';
import {
    resolveZenBonsaiGrowthProjection,
} from '../../model/ZenBonsaiGrowthProjection.js';
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
import {
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
} from '../../contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
    validateSakuraSpineGenerationConditionIdV1,
} from '../../contracts/SakuraSpineGenerationConditionContract.js';
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
import { useZenBonsaiClassic2LineageRuntime } from './useZenBonsaiClassic2LineageRuntime.js';
import {
    resolveZenBonsaiClassic2WoodClockPolicyForLineageMode,
} from './zenBonsaiClassic2LineageRuntimeMode.js';
import {
    resolveZenClassicDisplayGrowthStage,
} from './zenClassicGrowthStageProjection.js';

const HOME_SPINE_GENERATION_OPTIONS = Object.freeze({
    spineGuide: null,
});
const HOME_SPINE_GENERATION_CONDITION_ID = resolveSakuraSpineGenerationConditionIdV1({});

const requireCanonicalGenerationInputs = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANONICAL_GENERATION_INPUTS_REQUIRED');
    }
    const learningProgress = Number(value.learningProgress);
    if (!Number.isFinite(learningProgress) || learningProgress < 0 || learningProgress > 1) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANONICAL_LEARNING_PROGRESS_INVALID');
    }
    if (
        !value.canopyDistributionProfile
        || typeof value.canopyDistributionProfile !== 'object'
        || Array.isArray(value.canopyDistributionProfile)
    ) {
        throw new Error('ZEN_BONSAI_CLASSIC2_CANONICAL_CANOPY_PROFILE_REQUIRED');
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'spineGenerationConditionId')) {
        throw new Error('ZEN_BONSAI_CLASSIC2_SPINE_GENERATION_CONDITION_ID_REQUIRED');
    }
    const spineConditionId = value.spineGenerationConditionId;
    if (!validateSakuraSpineGenerationConditionIdV1(spineConditionId)) {
        throw new Error('ZEN_BONSAI_CLASSIC2_SPINE_GENERATION_CONDITION_ID_INVALID');
    }
    return Object.freeze({
        learningProgress,
        canopyDistributionProfile: clampCanopyDistributionTuning(
            value.canopyDistributionProfile,
        ),
        spineGenerationConditionId: spineConditionId,
    });
};

export function useZenClassicHomeTopologyRuntime({
    treeType,
    currentPhenotype,
    treeSeed,
    structureDepth,
    bonsaiLifeState = null,
    bonsaiGrowthModel = ZEN_BONSAI_MODEL_IDS.PLUME,
    classic2LineageMode,
    classic2StructureMode,
    classic2IdentityRevision,
    classic2CanonicalLatent,
    classic2CanonicalLatentVersion,
    classic2ProfileEpoch,
    classic2CanonicalTreeIdentity,
    classic2CanonicalGenerationInputs,
    bootTraceContext = null,
    onFirstVisualMilestone = null,
    enabled = true,
    candidatePreparationEnabled = enabled,
    publishPondBioticSignal = null,
} = {}) {
    const resolvedBonsaiGrowthModel = requireZenBonsaiModelAdmission({
        surface: ZEN_BONSAI_MODEL_SURFACES.HOME,
        modelId: bonsaiGrowthModel,
    });
    const isClassic2 = resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.CLASSIC2;
    const isG15 = resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.G15_4;
    const isPlume = resolvedBonsaiGrowthModel === ZEN_BONSAI_MODEL_IDS.PLUME;
    const usesDirectTopology = isG15 || isPlume;

    if (isClassic2) {
        if (
            candidatePreparationEnabled
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
            && (!Number.isSafeInteger(classic2IdentityRevision) || classic2IdentityRevision < 1)
        ) {
            throw new Error('ZEN_BONSAI_CLASSIC2_IDENTITY_REVISION_REQUIRED');
        }
        if (
            candidatePreparationEnabled
            && (
                !classic2CanonicalTreeIdentity
                || typeof classic2CanonicalTreeIdentity !== 'object'
                || Array.isArray(classic2CanonicalTreeIdentity)
            )
        ) {
            throw new Error('ZEN_BONSAI_HOME_CANONICAL_TREE_IDENTITY_REQUIRED');
        }
    }

    // Materialization normalizes life/phenotype into fresh objects on boot
    // snapshot release. Compare the small generation inputs by value before
    // invoking the kernel; graph generation and plan building follow once.
    const g15GenerationKey = isG15 && (enabled || candidatePreparationEnabled)
        ? JSON.stringify({ seed: treeSeed, lifeState: bonsaiLifeState, phenotype: currentPhenotype })
        : null;
    const g15Topology = useMemo(() => (
        g15GenerationKey === null ? null : generateG15Topology(JSON.parse(g15GenerationKey))
    ), [g15GenerationKey]);
    const plumeModel = useZenBonsaiPlumeTopology({
        lifetimeEnabled: isPlume,
        enabled: isPlume && (enabled || candidatePreparationEnabled),
        seed: treeSeed,
        lifeState: bonsaiLifeState,
        phenotype: currentPhenotype,
    });
    const plumeTopology = plumeModel.topology;
    const directTopology = isPlume ? plumeTopology : g15Topology;
    const directIdentityPrefix = isPlume ? 'plume' : 'g15';
    const directGraphContract = isPlume
        ? 'zen_bonsai_plume_topology_v1'
        : 'g15_4_typed_developmental_scheduler_v39';
    const directGenerationContract = isPlume
        ? 'plume_direct_generation_v1'
        : 'g15_4_direct_generation_v1';

    const canonicalGenerationInputs = useMemo(
        () => (
            candidatePreparationEnabled && isClassic2
                ? requireCanonicalGenerationInputs(classic2CanonicalGenerationInputs)
                : null
        ),
        [candidatePreparationEnabled, classic2CanonicalGenerationInputs, isClassic2],
    );
    const species = useMemo(
        () => {
            if (!candidatePreparationEnabled) return null;
            if (isPlume) return ZenBonsaiPlumeSpecies;
            if (isG15) return ZenBonsaiG15Species;
            return resolveHomeSpecies(treeType);
        },
        [candidatePreparationEnabled, isG15, isPlume, treeType],
    );
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
            learningProgress: canonicalGenerationInputs?.learningProgress,
            canopyDistributionProfile: canonicalGenerationInputs?.canopyDistributionProfile,
        }),
        [
            bonsaiLifeState,
            canonicalGenerationInputs,
            structureDepth,
        ],
    );
    const currentGrowthStage = useMemo(
        () => resolveZenBonsaiClassic2RenderStage({
            stage: currentGrowthStageBase,
            structureDepth,
            growthProjection,
        }),
        [currentGrowthStageBase, growthProjection, structureDepth],
    );
    const displayCandidateStage = useMemo(
        () => (
            canonicalGenerationInputs
                ? resolveZenBonsaiClassic2DisplayCandidateStage({
                    baseStage: STAGES.BLOOM,
                    structureDepth,
                    learningProgress: canonicalGenerationInputs.learningProgress,
                    canopyDistributionProfile:
                        canonicalGenerationInputs.canopyDistributionProfile,
                })
                : null
        ),
        [canonicalGenerationInputs, structureDepth],
    );
    const candidateTopology = useMemo(() => {
        if (!candidatePreparationEnabled || !isClassic2) {
            return null;
        }
        return species.generateTopology(
            new SeededRandom(treeSeed),
            displayCandidateStage,
            TOPOLOGY_REFERENCE_HEIGHT,
            currentPhenotype,
            HOME_SPINE_GENERATION_OPTIONS,
        );
    }, [
        candidatePreparationEnabled,
        currentPhenotype,
        displayCandidateStage,
        isClassic2,
        species,
        treeSeed,
    ]);
    const classic2TreeIdentity = useMemo(() => {
        if (!isClassic2 || !classic2CanonicalTreeIdentity) {
            return null;
        }
        if (
            classic2CanonicalTreeIdentity?.generationInputs?.spineGenerationConditionId
            !== HOME_SPINE_GENERATION_CONDITION_ID
        ) {
            throw new Error(
                'ZEN_BONSAI_CLASSIC2_SPINE_GENERATION_CONDITION_IDENTITY_MISMATCH',
            );
        }
        return classic2CanonicalTreeIdentity;
    }, [classic2CanonicalTreeIdentity, isClassic2]);
    const classic2WoodClockPolicy = (
        !isClassic2 || classic2LineageMode === null || classic2LineageMode === undefined
            ? null
            : resolveZenBonsaiClassic2WoodClockPolicyForLineageMode(classic2LineageMode)
    );
    const classic2LineageRuntime = useZenBonsaiClassic2LineageRuntime({
        enabled: enabled && isClassic2,
        mode: classic2LineageMode,
        topology: candidateTopology,
        treeIdentity: classic2TreeIdentity,
        profileEpoch: classic2ProfileEpoch,
        lifeState: bonsaiLifeState,
        bootTraceContext,
        onFirstVisualMilestone,
    });
    const treeTopology = useMemo(() => {
        if (!enabled) {
            return null;
        }
        if (usesDirectTopology) {
            return directTopology;
        }
        if (!classic2LineageRuntime.ready) {
            return null;
        }
        return projectZenBonsaiClassic2DevelopmentTopology({
            topology: candidateTopology,
            lifeState: bonsaiLifeState,
            projection: growthProjection,
            lineageState: classic2LineageRuntime.state,
            lineageRenderBinding: classic2LineageRuntime.renderBinding,
            requireLineage: true,
            woodClockPolicy: classic2WoodClockPolicy,
        }).topology;
    }, [
        bonsaiLifeState,
        candidateTopology,
        classic2LineageRuntime.ready,
        classic2LineageRuntime.renderBinding,
        classic2LineageRuntime.state,
        classic2WoodClockPolicy,
        enabled,
        directTopology,
        growthProjection,
        usesDirectTopology,
    ]);
    const visibleTreeAnalysis = useMemo(
        () => (
            treeTopology && isClassic2
                ? TreeAnalyzer.analyze(
                    treeTopology,
                    TOPOLOGY_REFERENCE_HEIGHT,
                    TOPOLOGY_REFERENCE_HEIGHT,
                    { species: treeType, referenceFeatures: [] },
                )
                : null
        ),
        [isClassic2, treeTopology, treeType],
    );

    useEffect(() => {
        if (typeof publishPondBioticSignal !== 'function') {
            return;
        }
        if (isPlume) {
            const signal = resolveZenBonsaiPlumeBioticSignal({
                topology: plumeTopology,
                source: 'zen_plume_home_visible_tree',
            });
            if (signal) publishPondBioticSignal(signal);
            return;
        }
        if (usesDirectTopology) {
            const signal = resolveZenBonsaiPondBioticSignal({
                lifeState: bonsaiLifeState,
                source: isPlume ? 'zen_plume_home_visible_tree' : 'zen_g15_home_visible_tree',
                engine: resolvedBonsaiGrowthModel,
                stageId: 'bloom',
                seasonSpanDays: 7,
            });
            if (signal) {
                publishPondBioticSignal(signal);
            }
            return;
        }
        const signal = resolveZenBonsaiPondBioticSignal({
            analysis: visibleTreeAnalysis,
            lifeState: bonsaiLifeState,
            source: 'zen_classic_home_visible_tree',
            engine: 'classic2',
            stageId: 'bloom',
            seasonSpanDays: 7,
        });
        if (signal) {
            publishPondBioticSignal(signal);
        }
    }, [
        bonsaiLifeState,
        isPlume,
        plumeTopology,
        resolvedBonsaiGrowthModel,
        usesDirectTopology,
        publishPondBioticSignal,
        visibleTreeAnalysis,
    ]);

    return {
        currentGrowthStage: usesDirectTopology
            ? Object.freeze({ stage: STAGES.BLOOM, progress: 1.0, growthProjection })
            : currentGrowthStage,
        species,
        treeTopology,
        modelId: resolvedBonsaiGrowthModel,
        modelState: usesDirectTopology ? null : classic2LineageRuntime.state,
        modelReady: usesDirectTopology ? directTopology !== null : classic2LineageRuntime.ready,
        modelMaterializationReady: usesDirectTopology
            ? directTopology !== null && (!isPlume || !plumeModel.pending)
            : classic2LineageRuntime.materializationReady,
        modelProjectionPending: isPlume && plumeModel.pending,
        modelStatus: usesDirectTopology
            ? (directTopology === null ? 'preparing' : (isPlume && plumeModel.pending ? 'projecting' : 'ready'))
            : classic2LineageRuntime.status,
        modelMode: usesDirectTopology ? 'direct_product' : classic2LineageRuntime.mode,
        modelFingerprint: usesDirectTopology
            ? `${directIdentityPrefix}_seed_${treeSeed}`
            : classic2LineageRuntime.treeFingerprint,
        modelIdentityFingerprint: usesDirectTopology
            ? `${directIdentityPrefix}_identity_${treeSeed}`
            : classic2LineageRuntime.treeIdentityFingerprint,
        modelRequestSignature: isPlume ? plumeModel.requestKey : (usesDirectTopology ? null : classic2LineageRuntime.requestSignature),
        modelCommittedRequestSignature: usesDirectTopology
            ? (isPlume ? plumeModel.acceptedKey : directGenerationContract)
            : classic2LineageRuntime.committedRequestSignature,
        modelStateRevision: usesDirectTopology ? 1 : classic2LineageRuntime.stateRevision,
        modelGraphContract: usesDirectTopology
            ? directGraphContract
            : ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
        classic2LineageState: usesDirectTopology ? null : classic2LineageRuntime.state,
        classic2LineageReady: usesDirectTopology ? true : classic2LineageRuntime.ready,
        classic2LineageMaterializationReady: usesDirectTopology ? true : classic2LineageRuntime.materializationReady,
        classic2LineageStatus: usesDirectTopology ? 'ready' : classic2LineageRuntime.status,
        classic2LineageMode: usesDirectTopology ? null : classic2LineageRuntime.mode,
        classic2LineageFingerprint: usesDirectTopology ? `${directIdentityPrefix}_seed_${treeSeed}` : classic2LineageRuntime.treeFingerprint,
        classic2LineageIdentityFingerprint: usesDirectTopology ? `${directIdentityPrefix}_identity_${treeSeed}` : classic2LineageRuntime.treeIdentityFingerprint,
        classic2LineageRequestSignature: usesDirectTopology ? null : classic2LineageRuntime.requestSignature,
        classic2LineageCommittedRequestSignature: usesDirectTopology ? null : classic2LineageRuntime.committedRequestSignature,
        classic2LineageStateRevision: usesDirectTopology ? 1 : classic2LineageRuntime.stateRevision,
        classic2CandidateGraphContract: usesDirectTopology ? directGraphContract : ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
    };
}

export default useZenClassicHomeTopologyRuntime;
