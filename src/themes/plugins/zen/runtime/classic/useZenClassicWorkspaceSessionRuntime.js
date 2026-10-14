import { useMemo } from 'react';

import {
    TOPOLOGY_REFERENCE_HEIGHT,
    createAssetCache,
    ZEN_ASSET_CACHE_VERSION,
} from '../../model/ZenCoreConfig';
import { useZenBonsaiSceneStore } from '../../pond/state/stores/useZenBonsaiSceneStore.js';
import { useZenClassicViewPreferences } from '../../state/classic/useZenClassicViewPreferences.js';
import { useZenClassicWorkspaceState } from '../../state/classic/useZenClassicWorkspaceState.js';
import { useZenBonsaiMaterializationRuntime } from '../../bonsai/runtime/useZenBonsaiMaterializationRuntime.js';
import {
    buildZenBonsaiMaterializationKey,
} from '../../bonsai/state/ZenBonsaiMaterializationContract.js';
import {
    resolveZenBonsaiPresentationMode,
} from '../../model/ZenBonsaiPresentationPolicy.js';
import { useZenClassicAnalysisRuntime } from './useZenClassicAnalysisRuntime';
import { useZenLearningLab } from './useZenLearningLab';
import { supportsZenBonsaiClassicLearning } from '../../model/ZenBonsaiModelCatalog.js';
import { resolveZenClassicLabRuntimePolicy } from '../lab/zenLabRuntimePolicy.js';
import {
    resolveZenClassicExperimentBonsaiGrowthModel,
    resolveZenClassicExperimentBonsaiLineageMode,
} from './zenClassicWorkspaceRuntimeConfig.js';

export function useZenClassicWorkspaceSessionRuntime({
    experimental = false,
    labRuntimeActive = experimental,
    renderWidth = 1,
    renderHeight = 1,
    bonsaiLifecycleInput = null,
    bonsaiGrowthModel = null,
} = {}) {
    const publishPondBioticSignal = useZenBonsaiSceneStore((state) => state.publishPondBioticSignal);
    const workspaceState = useZenClassicWorkspaceState();
    const viewPreferences = useZenClassicViewPreferences();
    const labRuntimePolicy = useMemo(() => resolveZenClassicLabRuntimePolicy({
        experimental,
        surfaceActive: labRuntimeActive,
        isCollectionMode: workspaceState.isCollectionMode,
    }), [experimental, labRuntimeActive, workspaceState.isCollectionMode]);
    const resolvedBonsaiGrowthModel = useMemo(() => resolveZenClassicExperimentBonsaiGrowthModel({
        requestedModel: bonsaiGrowthModel,
        allowExperimentSurface: labRuntimePolicy.allowExperimentSurface,
    }), [bonsaiGrowthModel, labRuntimePolicy.allowExperimentSurface]);
    const classicLearningEnabled = supportsZenBonsaiClassicLearning(resolvedBonsaiGrowthModel);
    const learningLab = useZenLearningLab('base', {
        enabled: labRuntimePolicy.allowLearningModelLoad && classicLearningEnabled,
        learningKeyspaceProfile: workspaceState.learningKeyspaceProfile,
    });
    const bonsaiLifecycleRuntime = useZenBonsaiMaterializationRuntime(bonsaiLifecycleInput);
    const activePairwiseMeta = useMemo(
        () => learningLab.activePairwiseBrain?.getMeta?.() || null,
        [learningLab.activePairwiseBrain, learningLab.pairwiseTrainingCount],
    );
    const activePairwiseTrainingCount = Number.isFinite(Number(activePairwiseMeta?.trainingPairs))
        ? Math.max(0, Math.floor(Number(activePairwiseMeta.trainingPairs)))
        : learningLab.pairwiseTrainingCount;
    const assetCache = useMemo(() => createAssetCache(), [ZEN_ASSET_CACHE_VERSION]);
    const analysisRuntime = useZenClassicAnalysisRuntime({
        treeType: workspaceState.treeType,
        currentPhenotype: workspaceState.currentPhenotype,
        spineGuide: workspaceState.spineGuide,
        spineReferenceFamily: workspaceState.spineReferenceFamily,
        treeSeed: workspaceState.treeSeed,
        structureDepth: workspaceState.structureDepth,
        experimental,
        canopyDistributionTuning: workspaceState.canopyDistributionTuning,
        isSakuraV2Enabled: true,
        trainingCount: learningLab.trainingCount,
        activePairwiseTrainingCount,
        brain: learningLab.brain,
        activePairwiseBrain: learningLab.activePairwiseBrain,
        activePairwiseMeta,
        abHistory: learningLab.abHistory,
        learningLatentKeys: workspaceState.learningLatentKeys,
        learningKeyspaceProfile: workspaceState.learningKeyspaceProfile,
        likedCollection: learningLab.likedCollection,
        referenceCutoffMs: learningLab.referenceCutoffMs,
        analysisWidth: renderWidth,
        analysisHeight: renderHeight,
        publishPondBioticSignal,
        bonsaiLifeState: bonsaiLifecycleRuntime.lifeState,
        bonsaiGrowthModel: resolvedBonsaiGrowthModel,
        classic2LineageMode: resolveZenClassicExperimentBonsaiLineageMode(),
        classic2StructureMode: workspaceState.structureMode,
        classic2IdentityRevision: workspaceState.identityRevision,
        classic2CanonicalLatent: workspaceState.sakuraV2Latent,
        classic2CanonicalLatentVersion: workspaceState.sakuraV2LatentState.version,
        analysisEnabled: (
            workspaceState.profileReady === true
            &&
            labRuntimePolicy.allowExperimentSurface === true
            && bonsaiLifecycleRuntime.materializationReady === true
        ),
        candidatePreparationEnabled: workspaceState.profileReady === true
            && labRuntimePolicy.allowExperimentSurface === true,
    });
    const bonsaiRendererIdentity = useMemo(() => {
        if (
            bonsaiLifecycleRuntime.materializationReady !== true
            || analysisRuntime.modelMaterializationReady !== true
        ) {
            return null;
        }
        return Object.freeze({
            inputSignature: bonsaiLifecycleRuntime.inputSignature,
            bonsaiMaterializationKey: buildZenBonsaiMaterializationKey({
                inputSignature: bonsaiLifecycleRuntime.inputSignature,
                evidenceSignature: bonsaiLifecycleRuntime.materialization.evidenceSignature,
                lifeSignature: bonsaiLifecycleRuntime.lifeSignature,
                presentationMode: resolveZenBonsaiPresentationMode(bonsaiLifecycleInput),
                modelId: analysisRuntime.bonsaiGrowthModel,
                modelMode: analysisRuntime.modelMode,
                modelTopologyFingerprint: analysisRuntime.modelFingerprint,
                modelIdentityFingerprint: analysisRuntime.modelIdentityFingerprint,
                modelCommitSignature: analysisRuntime.modelCommittedRequestSignature,
                modelStateRevision: analysisRuntime.modelStateRevision,
            }),
        });
    }, [
        analysisRuntime.modelCommittedRequestSignature,
        analysisRuntime.modelFingerprint,
        analysisRuntime.modelIdentityFingerprint,
        analysisRuntime.modelMaterializationReady,
        analysisRuntime.modelMode,
        analysisRuntime.modelStateRevision,
        bonsaiLifecycleInput,
        bonsaiLifecycleRuntime.inputSignature,
        bonsaiLifecycleRuntime.lifeSignature,
        bonsaiLifecycleRuntime.materialization,
        bonsaiLifecycleRuntime.materializationReady,
    ]);

    return {
        labRuntimePolicy,
        workspaceState,
        viewPreferences,
        learningRuntime: {
            ...learningLab,
            activePairwiseMeta,
            activePairwiseTrainingCount,
            topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
        },
        bonsaiLifecycleRuntime,
        bonsaiRendererIdentity,
        analysisRuntime,
        assetCache,
    };
}

export default useZenClassicWorkspaceSessionRuntime;
