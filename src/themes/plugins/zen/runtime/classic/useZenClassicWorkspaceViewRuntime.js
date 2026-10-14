import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation';
import {
    MAIN_TARGET_FPS,
    MIN_AB_RENDER_SIZE,
    STAGES,
} from '../../model/ZenCoreConfig';
import { formatPercent } from '../../model/ZenReportMath';
import {
    DEFAULT_ZEN_BONSAI_POT_STYLE,
    ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE,
} from '../../model/ZenPotRenderer.js';
import { useZenClassicPresentationModel } from '../../presentation/classic/useZenClassicPresentationModel.js';
import { useZenLabTreeRenderer } from '../useZenLabTreeRenderer.js';
import {
    ZEN_BONSAI_MAIN_RENDER_OWNERS,
} from '../zenBonsaiMainRendererOwnership.js';
import {
    resolveZenClassicBonsaiPixelRatioCap,
    resolveZenClassicBonsaiCadenceContext,
    resolveZenClassicBonsaiRenderBackend,
    resolveZenClassicBonsaiRenderLoopMode,
    resolveZenClassicBonsaiTargetFps,
    resolveZenClassicCameraPreset,
    resolveZenClassicExperimentGardenBedLayoutFrame,
    resolveZenClassicLabInspectorVisible,
    resolveZenClassicMainRenderQuality,
    resolveZenClassicWorkspaceLayoutClassName,
} from './zenClassicWorkspaceRuntimeConfig';
import { useZenLatentControlController } from './useZenLatentControlController.js';
import { useZenReportController } from './useZenReportController.js';

export function useZenClassicWorkspaceViewRuntime({
    experimental = false,
    embedded = false,
    homeEmbedded = false,
    solarLocationProfile = null,
    bonsaiGrowthLabControls = null,
    refs,
    dimensions,
    sessionRuntime,
    interactionRuntime,
} = {}) {
    const { t } = useAppTranslation('main');
    const {
        canvasRef,
        containerRef,
        abCanvasRefA,
        abCanvasRefB,
        abContainerRefA,
        abContainerRefB,
        mainViewportRef,
        frameId,
        treeCacheRef,
        lastCacheKey,
    } = refs;
    const {
        renderWidth,
        renderHeight,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
    } = dimensions;
    const {
        workspaceState,
        viewPreferences,
        learningRuntime,
        analysisRuntime,
        assetCache,
        bonsaiLifecycleRuntime,
        bonsaiRendererIdentity,
    } = sessionRuntime;
    const {
        labRuntimePolicy,
        coldStartRuntime,
        abRuntime,
        modeRuntime,
        actionRuntime,
        classicLearningEnabled,
    } = interactionRuntime;
    const {
        treeType,
        treeSeed,
        isCollectionMode: requestedCollectionMode,
        sakuraV2Latent,
        learningAnchorLatent,
        learningLatentKeys,
        currentPhenotype,
        spineGuideDraft,
        spineGuideEnabled,
        spineGuideEditorOpen,
        spineGuideMode,
        spineGuideAdherence,
        spineReferenceLikeness,
        commitSpineGuideStroke,
        moveSpineGuideAnchor,
        setSpineGuideMode,
        setSpineGuideAdherence,
        setSpineReferenceLikeness,
        toggleSpineGuideEditor,
        enableSpineGuide,
        disableSpineGuide,
        resetSpineGuide,
    } = workspaceState;
    const isCollectionMode = classicLearningEnabled && requestedCollectionMode;
    const {
        likedCollection,
        abHistory,
        optimizationLog,
        brain,
        activePairwiseBrain,
        trainingCount,
        activePairwiseTrainingCount,
        topologyReferenceHeight,
    } = learningRuntime;
    const {
        analyzedCandidate,
        analysisStage,
        currentGrowthStage,
        treeTopology,
        species,
        bonsaiGrowthModel,
        sakuraV2Gate,
    } = analysisRuntime;
    const bonsaiLifeState = bonsaiLifecycleRuntime?.lifeState || null;
    const {
        coldStartPreparing,
        coldStartReady,
        coldStartPoolSize,
        coldStartRequested,
        coldStartAvailable,
        requestColdStartPreparation,
        clearColdStartPreparation,
        abErrorState,
    } = coldStartRuntime;
    const {
        abPair,
        isGenerating,
        abRoundCount,
        chooseABCandidate,
        handleABBothGood,
        handleABPass,
        sessionCalibration,
        questionQuality,
    } = abRuntime;
    const {
        abEntryGuardActive,
        handleExperimentModeChange,
    } = modeRuntime;
    const {
        latestOptimization,
        isOptimizing,
        optimizeProgress,
        optimizeErrorState,
        handleApplyArchetype,
        handleApplyToMain,
        handleReRoll,
        handleOptimize,
        handleReApplyBest,
        handleHardReset,
        handleHardResetRandom,
        handleSyncLearningAnchor,
    } = actionRuntime;

    const presentationModel = useZenClassicPresentationModel({
        analyzedCandidate,
        treeType,
        learningLatentKeys,
        sakuraV2Latent,
        learningAnchorLatent,
        questionQuality,
        isCollectionMode,
        abPair,
        abRoundCount,
        isGenerating,
        coldStartReady,
        coldStartPreparing,
        coldStartPoolSize,
        abErrorState,
        abEntryGuardActive,
        sakuraV2Gate,
        isOptimizing,
        optimizeProgress,
        renderWidth,
        renderHeight,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
        t,
    });
    const experimentGardenBedLayoutFrame = useMemo(() => (
        experimental && !isCollectionMode
            ? resolveZenClassicExperimentGardenBedLayoutFrame({
                width: renderWidth,
                height: renderHeight,
            })
            : null
    ), [experimental, isCollectionMode, renderHeight, renderWidth]);
    const experimentPotStyle = experimentGardenBedLayoutFrame
        ? ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE
        : (experimental ? DEFAULT_ZEN_BONSAI_POT_STYLE : null);

    const candidateRendererOptions = {
        mainRendererOwner: ZEN_BONSAI_MAIN_RENDER_OWNERS.LAB_PREVIEW,
        bonsaiMaterializationKey: bonsaiRendererIdentity?.bonsaiMaterializationKey || null,
        inputSignature: bonsaiRendererIdentity?.inputSignature || null,
        canvasRef,
        width: renderWidth,
        height: renderHeight,
        frameIdRef: frameId,
        treeCacheRef,
        lastCacheKeyRef: lastCacheKey,
        treeType,
        treeSeed,
        currentPhenotype,
        currentStage: currentGrowthStage || STAGES.BLOOM,
        treeTopology,
        bonsaiLifeState,
        species,
        assetCache,
        mainTargetFps: resolveZenClassicBonsaiTargetFps({
            embedded,
            homeEmbedded,
            defaultTargetFps: MAIN_TARGET_FPS,
        }),
        mainCadenceContext: resolveZenClassicBonsaiCadenceContext({
            embedded,
            homeEmbedded,
        }),
        pixelRatioCap: resolveZenClassicBonsaiPixelRatioCap({
            homeEmbedded,
        }),
        renderLoopMode: resolveZenClassicBonsaiRenderLoopMode({
            homeEmbedded,
        }),
        renderBackend: resolveZenClassicBonsaiRenderBackend({
            homeEmbedded,
            modelId: bonsaiGrowthModel,
        }),
        enableMainRender: (
            labRuntimePolicy?.allowExperimentSurface === true
            && bonsaiRendererIdentity !== null
        ),
        isCollectionMode,
        enableAbPreviewRender: labRuntimePolicy?.allowAbPreviewRender === true,
        abPair,
        abCanvasRefA,
        abCanvasRefB,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
        minABRenderSize: MIN_AB_RENDER_SIZE,
        analysisStage,
        topologyReferenceHeight,
        hidePot: false,
        potStyleOverride: experimentPotStyle,
        homeGardenBedLayoutFrame: experimentGardenBedLayoutFrame,
        gardenBedMaterialStyle: experimentGardenBedLayoutFrame
            ? viewPreferences.gardenBedMaterialStyle
            : null,
        showBackboneDebug: viewPreferences.showBackboneDebug,
        showBranchTierDebug: viewPreferences.showBranchTierDebug,
        renderMode: viewPreferences.renderMode,
        mainRenderQuality: resolveZenClassicMainRenderQuality({
            experimental,
            isCollectionMode,
        }),
        solarLocationProfile,
        cameraPreset: resolveZenClassicCameraPreset({
            experimental,
            embedded,
            homeEmbedded,
            gardenBedPreview: experimentGardenBedLayoutFrame !== null,
        }),
    };
    const renderScope = useMemo(() => ({
        treeSeed,
        treeType,
        profileEpoch: workspaceState.profileEpoch,
        modelId: bonsaiGrowthModel,
        modelMode: analysisRuntime.modelMode,
        species,
        canvasRef,
    }), [
        treeSeed,
        treeType,
        workspaceState.profileEpoch,
        bonsaiGrowthModel,
        analysisRuntime.modelMode,
        species,
        canvasRef,
    ]);
    const acceptedRenderRef = useRef(null);
    const acceptedRender = acceptedRenderRef.current;
    const canPresentScene = labRuntimePolicy?.allowExperimentSurface === true
        && workspaceState.profileReady === true
        && !isCollectionMode;
    const currentSceneReady = canPresentScene
        && analysisRuntime.modelMaterializationReady === true
        && analysisRuntime.modelProjectionPending !== true
        && bonsaiRendererIdentity !== null
        && treeTopology !== null;
    const retainAcceptedScene = canPresentScene
        && typeof workspaceState.profileEpoch === 'string'
        && workspaceState.profileEpoch.length > 0
        && analysisRuntime.modelProjectionPending === true
        && analysisRuntime.modelMaterializationReady !== true
        && acceptedRender !== null
        && acceptedRender.scope === renderScope
        && acceptedRender.canvas === canvasRef.current
        && acceptedRender.options.treeTopology === treeTopology
        && typeof acceptedRender.requestSignature === 'string'
        && acceptedRender.requestSignature === analysisRuntime.modelCommittedRequestSignature;
    // A pending PROJECT keeps the complete accepted scene, including its life and
    // materialization identity. Never label the old topology with the new request.
    // Only committed renders may replace this component-local presentation record.
    useLayoutEffect(() => {
        if (currentSceneReady) {
            acceptedRenderRef.current = {
                scope: renderScope,
                canvas: canvasRef.current,
                requestSignature: analysisRuntime.modelCommittedRequestSignature,
                options: candidateRendererOptions,
            };
        } else if (!retainAcceptedScene) {
            acceptedRenderRef.current = null;
        }
    });
    useZenLabTreeRenderer(retainAcceptedScene
        ? acceptedRender.options
        : candidateRendererOptions);

    const {
        learningReport,
        handleCopyLearningReport,
        handleCopyDeepLearningReport,
        questionQualityWarning,
    } = useZenReportController({
        brain,
        pairwiseBrain: activePairwiseBrain,
        abHistory,
        abRoundCount,
        trainingCount,
        pairwiseTrainingCount: activePairwiseTrainingCount,
        sessionCalibration,
        latestOptimization,
        sakuraV2Gate,
        redundancyTuning: workspaceState.redundancyTuning,
        treeType,
        optimizationLog,
        likedCollection,
        currentPhenotype,
        analyzedCandidate,
        scoreView: presentationModel.scoreView,
    });
    const {
        handleBranchDetailControlChange,
        handleApplyLatentAxisPreset,
        activeLatentPresetIds,
    } = useZenLatentControlController({
        sakuraV2Latent,
        commitSakuraV2Latent: workspaceState.commitSakuraV2Latent,
    });

    return {
        shellProps: {
            containerRef,
            experimental,
            embedded,
            homeEmbedded,
        },
        controlBarProps: {
            experimental,
            isCollectionMode,
            classicLearningEnabled,
            classicLearningUnavailableLabel: t('core_status.plume_classic_learning_unavailable'),
            bonsaiGrowthLabControls,
            onExperimentModeChange: handleExperimentModeChange,
            ...presentationModel.controlBarState,
            formatPercent,
            trunkSandboxMode: viewPreferences.trunkSandboxMode,
            applyToMainLabel: t('core_status.apply_to_main'),
            applyToMainTitle: t('core_status.apply_confirm'),
            onApplyToMain: handleApplyToMain,
            onReRoll: handleReRoll,
            onOptimize: classicLearningEnabled ? handleOptimize : null,
            isOptimizing,
            optimizeProgress,
            onSyncLearningAnchor: classicLearningEnabled ? handleSyncLearningAnchor : null,
            showAdvancedControls: viewPreferences.showAdvancedControls,
            onToggleAdvancedControls: viewPreferences.handleToggleAdvancedControls,
            latestOptimization: classicLearningEnabled ? latestOptimization : null,
            onReApplyBest: classicLearningEnabled ? handleReApplyBest : null,
            onHardReset: classicLearningEnabled ? handleHardReset : null,
            onHardResetRandom: classicLearningEnabled ? handleHardResetRandom : null,
            showInsight: classicLearningEnabled && viewPreferences.showInsight,
            onToggleInsight: classicLearningEnabled ? viewPreferences.handleToggleInsight : null,
            showBackboneDebug: viewPreferences.showBackboneDebug,
            onToggleBackboneDebug: viewPreferences.handleToggleBackboneDebug,
            showBranchTierDebug: viewPreferences.showBranchTierDebug,
            onToggleBranchTierDebug: viewPreferences.handleToggleBranchTierDebug,
            onToggleRenderMode: viewPreferences.handleToggleRenderMode,
            coldStartAvailable,
            coldStartRequested,
            coldStartPreparing,
            coldStartReady,
            coldStartPoolSize,
            onPrepareColdStart: requestColdStartPreparation,
            onClearColdStart: clearColdStartPreparation,
            questionQualityWarning,
            errorState: optimizeErrorState,
            spineGuideEnabled,
            spineGuideAnchorCount: spineGuideDraft?.anchors?.length || 0,
            spineGuideMode,
            spineGuideAdherence,
            spineReferenceLikeness,
            onToggleSpineGuideEditor: classicLearningEnabled
                ? (spineGuideEnabled ? toggleSpineGuideEditor : enableSpineGuide)
                : null,
        },
        workspaceLayoutClassName: resolveZenClassicWorkspaceLayoutClassName({
            experimental,
            isCollectionMode,
        }),
        viewportBaseProps: {
            mainViewportRef,
            experimental,
            embedded,
            isCollectionMode,
            canvasRef,
            abPair,
            isGenerating,
            abContainerRefA,
            abContainerRefB,
            chooseABCandidate,
            abCanvasRefA,
            abCanvasRefB,
            ...presentationModel.viewportState,
            formatPercent,
            handleABBothGood,
            handleABPass,
            abErrorState,
            spineGuideEditor: {
                open: classicLearningEnabled && spineGuideEditorOpen,
                width: renderWidth,
                height: renderHeight,
                guide: spineGuideDraft,
                enabled: spineGuideEnabled,
                mode: spineGuideMode,
                adherence: spineGuideAdherence,
                likeness: spineReferenceLikeness,
                onCommitStroke: commitSpineGuideStroke,
                onMoveAnchor: moveSpineGuideAnchor,
                onModeChange: setSpineGuideMode,
                onAdherenceChange: setSpineGuideAdherence,
                onLikenessChange: setSpineReferenceLikeness,
                onEnable: enableSpineGuide,
                onDisable: disableSpineGuide,
                onReset: resetSpineGuide,
                onClose: toggleSpineGuideEditor,
            },
        },
        showLatentControlPanel: resolveZenClassicLabInspectorVisible({
            experimental,
            isCollectionMode,
            hasGrowthControls: Boolean(bonsaiGrowthLabControls),
            showAdvancedControls: viewPreferences.showAdvancedControls,
        }),
        latentControlPanelProps: {
            latentState: sakuraV2Latent,
            activeLatentPresetIds,
            onApplyLatentAxisPreset: handleApplyLatentAxisPreset,
            onBranchDetailControlChange: handleBranchDetailControlChange,
            bonsaiGrowthLabControls,
            showShapeControls: classicLearningEnabled && viewPreferences.showAdvancedControls,
            gardenBedMaterialStyle: viewPreferences.gardenBedMaterialStyle,
            onGardenBedMaterialStyleChange: viewPreferences.handleGardenBedMaterialStyleChange,
        },
        workspacePanelsProps: {
            experimental,
            showAdvancedControls: classicLearningEnabled && viewPreferences.showAdvancedControls,
            showInsight: classicLearningEnabled && viewPreferences.showInsight,
            learningReport,
            formatPercent,
            onCopyLearningReport: handleCopyLearningReport,
            onCopyDeepLearningReport: handleCopyDeepLearningReport,
            latestOptimization: classicLearningEnabled ? latestOptimization : null,
            isCollectionMode,
            treeSeed,
            onApplyArchetype: classicLearningEnabled ? handleApplyArchetype : null,
        },
    };
}

export default useZenClassicWorkspaceViewRuntime;
