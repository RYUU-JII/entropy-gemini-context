import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    buildABCharacteristicSample,
    scoreABPairInformativeness,
} from '../../model/ZenCoreScoring';
import { resolveSakuraV2ClassicColdStartEnabled } from '../../model/SakuraV2Runtime';
import { supportsZenBonsaiClassicLearning } from '../../model/ZenBonsaiModelCatalog.js';
import { createZenUiErrorState } from '../zenUiErrorState.js';
import { useSakuraV2ABPlanning } from './control/useSakuraV2ABPlanning.js';
import { useZenABController } from './control/useZenABController.js';
import { useZenABKeyboardShortcuts } from './control/useZenABKeyboardShortcuts.js';
import { useZenClassicActionController } from './control/useZenClassicActionController.js';
import { useZenModeController } from './control/useZenModeController.js';
import { resolveZenClassicLabRuntimePolicy } from '../lab/zenLabRuntimePolicy.js';
import {
    resolveZenABGenerationReadiness,
} from '../lab/zenABGenerationReadiness.js';

const AB_MODE_ENTRY_GUARD_MS = 1000;

export function useZenClassicWorkspaceInteractionRuntime({
    experimental = false,
    labRuntimeActive = experimental,
    renderWidth = 1,
    renderHeight = 1,
    sessionRuntime,
} = {}) {
    const {
        workspaceState,
        learningRuntime,
        analysisRuntime,
        viewPreferences,
    } = sessionRuntime;
    const {
        treeType,
        treeSeed,
        setTreeSeed,
        structureMode,
        structureDepth,
        setStructureMode,
        setStructureDepth,
        currentPhenotype,
        spineGuide,
        spineReferenceFamily,
        isCollectionMode,
        setIsCollectionMode,
        abExplorationIntensity,
        setAbExplorationIntensity,
        abQueryTuning,
        setAbQueryTuning,
        redundancyTuning,
        setRedundancyTuning,
        setCanopyDistributionTuning,
        sakuraV2Flags,
        setSakuraV2Flags,
        sakuraV2Latent,
        learningAnchorLatent,
        learningKeyspaceProfile,
        workerFallbackPolicy,
        commitSakuraV2Latent,
        applyDraftToMain,
    } = workspaceState;
    const {
        loaded: learningLoaded,
        abHistory,
        optimizationLog,
        setOptimizationLog,
        setAbHistory,
        setFactorTraceLog,
        setAbGeneratedSamples,
        brain,
        activePairwiseBrain,
        trainingCount,
        activePairwiseTrainingCount,
        collectCandidate,
        trainCandidate,
        trainPairwisePreference,
        resetLearningCore,
        topologyReferenceHeight,
    } = learningRuntime;
    const {
        sakuraV2Gate,
        evaluationStageProfiles,
        effectiveReferenceFeatures,
        species,
        evaluateCandidate,
        analyzedCandidate,
        learningProgress,
        canopyDistributionProfile,
        setAnalysisPhenotype,
    } = analysisRuntime;
    const classicLearningEnabled = supportsZenBonsaiClassicLearning(analysisRuntime.bonsaiGrowthModel);
    const isSakuraV2ColdStartEnabled = useMemo(
        () => resolveSakuraV2ClassicColdStartEnabled(sakuraV2Flags),
        [sakuraV2Flags],
    );
    const [coldStartRequested, setColdStartRequested] = useState(false);
    const labRuntimePolicy = useMemo(() => resolveZenClassicLabRuntimePolicy({
        experimental,
        surfaceActive: labRuntimeActive,
        isCollectionMode,
        enableColdStart: isSakuraV2ColdStartEnabled,
        coldStartRequested,
        classicLearningEnabled,
    }), [
        experimental,
        labRuntimeActive,
        isCollectionMode,
        isSakuraV2ColdStartEnabled,
        coldStartRequested,
        classicLearningEnabled,
    ]);
    const {
        buildSakuraV2ABPlan,
        clearSakuraSobolPool,
        coldStartEligible,
        coldStartPreparing,
        coldStartReady,
        coldStartPoolSize,
        coldStartError,
    } = useSakuraV2ABPlanning({
        treeType,
        currentPhenotype,
        sakuraV2Latent,
        learningAnchorLatent,
        sakuraV2Flags,
        isSakuraV2Enabled: isSakuraV2ColdStartEnabled,
        enableColdStart: labRuntimePolicy.allowColdStart,
        activePairwiseTrainingCount,
        abHistory,
        evaluationStageProfiles,
        width: renderWidth,
        height: renderHeight,
        topologyHeight: topologyReferenceHeight,
        referenceFeatures: effectiveReferenceFeatures,
        commitSakuraV2Latent,
        resetLearningCore,
        setTreeSeed,
        persistTreeSeed: null,
        setSakuraV2Flags,
        learningKeyspaceProfile,
    });
    const abGenerationReadiness = useMemo(
        () => resolveZenABGenerationReadiness({
            profileReady: workspaceState.profileReady,
            treeType,
            learningLoaded,
            coldStartReady,
        }),
        [
            workspaceState.profileReady,
            treeType,
            learningLoaded,
            coldStartReady,
        ],
    );
    useEffect(() => {
        if (labRuntimePolicy.allowExperimentSurface && isCollectionMode && coldStartEligible) {
            return;
        }
        setColdStartRequested(false);
    }, [coldStartEligible, isCollectionMode, labRuntimePolicy.allowExperimentSurface]);
    const requestColdStartPreparation = useCallback(() => {
        if (!labRuntimePolicy.allowCollectionRuntime || !coldStartEligible) {
            return false;
        }
        setColdStartRequested(true);
        return true;
    }, [coldStartEligible, labRuntimePolicy.allowCollectionRuntime]);
    const clearColdStartPreparation = useCallback(() => {
        setColdStartRequested(false);
        clearSakuraSobolPool();
    }, [clearSakuraSobolPool]);
    const handleSakuraV2ABResolved = useCallback((event = {}) => {
        if (event?.queryKind === 'anchor' || treeType !== 'sakura') {
            return;
        }
        const winnerLatent = event?.winner?.latent;
        if (!winnerLatent || typeof winnerLatent !== 'object') {
            return;
        }
        const winnerSeed = Number(event?.winner?.seed);
        if (Number.isSafeInteger(winnerSeed)) {
            setTreeSeed(winnerSeed);
        }
        commitSakuraV2Latent(winnerLatent, { syncLearningAnchor: true });
    }, [treeType, setTreeSeed, commitSakuraV2Latent]);
    const {
        abPair,
        setAbPair,
        isGenerating,
        abRoundCount,
        setAbRoundCount,
        generationError,
        chooseABCandidate,
        handleABBothGood,
        handleABPass,
        sessionCalibration,
        questionQuality,
    } = useZenABController({
        width: renderWidth,
        height: renderHeight,
        treeType,
        currentPhenotype,
        spineGuide,
        spineReferenceFamily,
        currentLatent: sakuraV2Latent,
        abHistory,
        redundancyTuning,
        abExplorationIntensity,
        collectCandidate,
        trainCandidate,
        trainPairwisePreference,
        setFactorTraceLog,
        setAbHistory,
        setAbGeneratedSamples,
        buildABCharacteristicSample,
        scoreABPairInformativeness,
        brain,
        pairwiseBrain: activePairwiseBrain,
        evaluationStageProfiles,
        topologyHeight: topologyReferenceHeight,
        experimental,
        isCollectionMode,
        enableAbGeneration: labRuntimePolicy.allowAbGeneration,
        abQueryTuning,
        learningKeyspaceProfile,
        workerFallbackPolicy,
        abPlanReady: abGenerationReadiness.ready,
        buildV2Plan: buildSakuraV2ABPlan,
        onABResolved: handleSakuraV2ABResolved,
    });
    const {
        abEntryGuardActive,
        handleExperimentModeChange,
        resetExperimentMode,
    } = useZenModeController({
        isCollectionMode,
        setIsCollectionMode,
        setAbPair,
        guardMs: AB_MODE_ENTRY_GUARD_MS,
        allowCollection: classicLearningEnabled,
    });
    const {
        latestOptimization,
        isOptimizing,
        optimizeProgress,
        optimizeError,
        handleApplyArchetype,
        handleApplyToMain,
        handleReRoll,
        handleOptimize,
        handleReApplyBest,
        handleHardReset,
        handleHardResetRandom,
        handleSyncLearningAnchor,
    } = useZenClassicActionController({
        classicLearningEnabled,
        treeType,
        treeSeed,
        setTreeSeed,
        structureMode,
        structureDepth,
        setStructureMode,
        setStructureDepth,
        isCollectionMode,
        setAbExplorationIntensity,
        setAbQueryTuning,
        setRedundancyTuning,
        setCanopyDistributionTuning,
        setSakuraV2Flags,
        sakuraV2Latent,
        learningAnchorLatent,
        learningKeyspaceProfile,
        workerFallbackPolicy,
        commitSakuraV2Latent,
        applyDraftToMain,
        learningProgress,
        canopyDistributionProfile,
        spineGenerationConditionId:
            workspaceState.generationInputs?.spineGenerationConditionId ?? null,
        currentPhenotype,
        setAnalysisPhenotype,
        sakuraV2Gate,
        species,
        evaluationStageProfiles,
        effectiveReferenceFeatures,
        analyzedCandidate,
        brain,
        activePairwiseBrain,
        trainingCount,
        activePairwiseTrainingCount,
        optimizationLog,
        setOptimizationLog,
        abRoundCount,
        setAbRoundCount,
        setAbPair,
        resetLearningCore,
        clearSakuraSobolPool,
        resetExperimentMode,
        renderWidth,
        renderHeight,
        setShowInsight: viewPreferences.setShowInsight,
    });
    const abErrorState = useMemo(() => {
        if (!isCollectionMode) {
            return null;
        }
        if (coldStartError instanceof Error) {
            return createZenUiErrorState(coldStartError, {
                fallbackCode: 'ZEN_SAKURA_COLD_START_FAILED',
                fallbackMessage: 'Sakura cold-start planning failed.',
                details: {
                    owner: 'classic_ab_cold_start',
                },
            });
        }
        if (generationError instanceof Error) {
            return createZenUiErrorState(generationError, {
                fallbackCode: 'ZEN_AB_GENERATION_FAILED',
                fallbackMessage: 'Zen A/B generation failed.',
                details: {
                    owner: 'classic_ab_generation',
                },
            });
        }
        return null;
    }, [isCollectionMode, coldStartError, generationError]);
    const optimizeErrorState = useMemo(() => {
        if (!(optimizeError instanceof Error)) {
            return null;
        }
        return createZenUiErrorState(optimizeError, {
            fallbackCode: 'ZEN_OPTIMIZATION_FAILED',
            fallbackMessage: 'Zen optimization failed.',
            details: {
                owner: 'classic_optimize',
            },
        });
    }, [optimizeError]);

    useZenABKeyboardShortcuts({
        enabled: labRuntimePolicy.allowAbGeneration && !abEntryGuardActive,
        abPair,
        isGenerating,
        onChoose: chooseABCandidate,
        onPass: handleABPass,
        onBothGood: handleABBothGood,
    });

    return {
        classicLearningEnabled,
        labRuntimePolicy,
        coldStartRuntime: {
            buildSakuraV2ABPlan,
            clearSakuraSobolPool,
            requestColdStartPreparation,
            clearColdStartPreparation,
            coldStartRequested,
            coldStartAvailable: Boolean(labRuntimePolicy.allowCollectionRuntime && coldStartEligible),
            coldStartPreparing,
            coldStartReady,
            coldStartPoolSize,
            coldStartError,
            abErrorState,
        },
        abRuntime: {
            generationReadiness: abGenerationReadiness,
            abPair,
            isGenerating,
            abRoundCount,
            generationError,
            chooseABCandidate,
            handleABBothGood,
            handleABPass,
            sessionCalibration,
            questionQuality,
            abErrorState,
        },
        modeRuntime: {
            abEntryGuardActive,
            handleExperimentModeChange,
        },
        actionRuntime: {
            latestOptimization,
            isOptimizing,
            optimizeProgress,
            optimizeError,
            optimizeErrorState,
            handleApplyArchetype,
            handleApplyToMain,
            handleReRoll,
            handleOptimize,
            handleReApplyBest,
            handleHardReset,
            handleHardResetRandom,
            handleSyncLearningAnchor,
        },
    };
}

export default useZenClassicWorkspaceInteractionRuntime;
