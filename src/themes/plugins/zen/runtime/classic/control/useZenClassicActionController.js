import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useConfirmDialog, useToast } from '@/ui-kit';
import { summarizePhenotype } from '../../../model/BonsaiGenetics';
import {
    getStructureDepthRange,
    clampStructureDepth,
    OPTIMIZER_MODE,
    DEFAULT_AB_EXPLORATION_INTENSITY,
    DEFAULT_AB_QUERY_TUNING,
    DEFAULT_REDUNDANCY_TUNING,
    DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    persistABQueryTuning,
    persistRedundancyTuning,
    persistCanopyDistributionTuning,
    OBJECTIVE_MODE,
    TOPOLOGY_REFERENCE_HEIGHT,
} from '../../../model/ZenCoreConfig';
import {
    DEFAULT_SAKURA_V2_FLAGS,
    persistSakuraV2Flags,
} from '../../../model/SakuraV2Runtime';
import {
    getDefaultSakuraLatent,
    mutateSakuraLatent,
} from '../../../model/v2/SakuraLatentSchema';
import { normalizeSakuraOptimizationResult } from '../../../model/v2/SakuraOptimizationResult';
import { ZenLatentOptimizerWorkerClient } from '../../../model/ZenLatentOptimizerWorkerClient';
import { WorkerExecutionController } from '../../../model/WorkerExecutionController';
import {
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    WORKER_RUNTIME_TASK_TYPE,
} from '../../../../../../platform/workers/runtime/index.js';
import { compileSakuraPhenotypeFromLatent } from '../../../model/v2/SakuraCompiler';
import {
    createSakuraOptimizationBasinGuidance,
} from '../../../model/v2/SakuraPreferenceBasinObjective';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? Number(value) : 0));
const createZenOptimizationError = (
    code = 'ZEN_OPTIMIZATION_FAILED',
    message = 'Zen optimization failed.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.name = 'ZenOptimizationError';
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};
const shouldPreserveOptimizationError = (error) => {
    const code = typeof error?.code === 'string'
        ? error.code.trim()
        : '';
    if (!code) {
        return false;
    }
    return code.startsWith('ZEN_OPTIMIZATION_') || code.startsWith('ZEN_SAKURA_');
};
const toZenOptimizationError = (
    error,
    {
        code = 'ZEN_OPTIMIZATION_FAILED',
        message = 'Zen optimization failed.',
        details = null,
    } = {},
) => {
    if (error instanceof Error && shouldPreserveOptimizationError(error)) {
        return error;
    }
    const rawMessage = String(error?.message || error || '').trim();
    return createZenOptimizationError(
        code,
        rawMessage ? `${message} ${rawMessage}`.trim() : message,
        details,
        error instanceof Error ? error : null,
    );
};
const requireCanonicalOptimizationResult = (result = null, options = {}) => {
    try {
        const normalized = normalizeSakuraOptimizationResult(result, {
            learningKeyspaceProfile: options?.learningKeyspaceProfile,
            maxGenerationLogEntries: 18,
            maxArchetypeSetEntries: 6,
        });
        if (normalized) {
            return normalized;
        }
    } catch (error) {
        throw toZenOptimizationError(error, {
            code: 'ZEN_OPTIMIZATION_RESULT_INVALID',
            message: 'Zen optimization returned an invalid canonical result.',
            details: {
                source: options?.source || null,
                learningKeyspaceProfile: options?.learningKeyspaceProfile || null,
            },
        });
    }
    throw createZenOptimizationError(
        'ZEN_OPTIMIZATION_RESULT_REQUIRED',
        'Zen optimization returned no canonical result.',
        {
            source: options?.source || null,
            learningKeyspaceProfile: options?.learningKeyspaceProfile || null,
        },
    );
};

export function resolveZenOptimizeTuning({
    gateProgress = 0,
} = {}) {
    const reliabilityProgress = clamp01(gateProgress);
    const reliabilityHint = clamp01(
        (Math.pow(reliabilityProgress, 1.12) * 0.86) + (reliabilityProgress * 0.14),
    );
    const populationSize = Math.max(
        28,
        Math.min(40, Math.round(38 - (reliabilityHint * 8))),
    );
    const generations = Math.max(
        3,
        Math.min(5, Math.round(3 + (reliabilityHint * 2))),
    );
    const eliteCount = Math.max(
        4,
        Math.min(7, Math.round(populationSize * 0.16)),
    );
    const mutationIntensity = Number(
        (0.32 - (reliabilityHint * 0.14)).toFixed(3),
    );
    const diverseTopK = Math.max(
        10,
        Math.min(14, Math.round(14 - (reliabilityHint * 4))),
    );
    return {
        reliabilityProgress,
        reliabilityHint,
        populationSize,
        generations,
        eliteCount,
        mutationIntensity,
        diverseTopK,
        bins: reliabilityHint < 0.45 ? 9 : 8,
    };
}

export function normalizeZenOptimizationArchetypeSet(entries = []) {
    return (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
            seed: Number(entry?.seed),
            phenotype: entry?.phenotype ? { ...entry.phenotype } : null,
            latent: entry?.latent ? { ...entry.latent } : null,
            scores: entry?.scores ? {
                objective: Number(entry.scores.objective ?? entry.scores.blended ?? 0),
                blended: Number(entry.scores.blended ?? entry.scores.objective ?? 0),
                pairwise: Number(entry.scores.pairwise ?? 0),
                neural: Number(entry.scores.neural ?? 0),
                novelty: Number(entry.scores.novelty ?? 0),
            } : {},
            descriptor: entry?.descriptor ? {
                x: Number(entry.descriptor.x ?? 0),
                y: Number(entry.descriptor.y ?? 0),
            } : null,
            archetypeMeta: entry?.archetypeMeta ? { ...entry.archetypeMeta } : null,
        }))
        .filter((entry) => Number.isFinite(entry.seed) && entry.phenotype && entry.latent);
}

export function useZenClassicActionController({
    classicLearningEnabled = true,
    treeType = 'sakura',
    treeSeed = 0,
    setTreeSeed,
    structureMode = 'tree',
    structureDepth = 6,
    setStructureMode,
    setStructureDepth,
    isCollectionMode = false,
    setAbExplorationIntensity,
    setAbQueryTuning,
    setRedundancyTuning,
    setCanopyDistributionTuning,
    setSakuraV2Flags,
    sakuraV2Latent = null,
    learningAnchorLatent = null,
    learningKeyspaceProfile = null,
    workerFallbackPolicy = null,
    commitSakuraV2Latent,
    applyDraftToMain,
    learningProgress = 0,
    canopyDistributionProfile = null,
    spineGenerationConditionId = null,
    currentPhenotype = null,
    setAnalysisPhenotype,
    sakuraV2Gate = null,
    species = null,
    evaluationStageProfiles = [],
    effectiveReferenceFeatures = [],
    analyzedCandidate = null,
    brain = null,
    activePairwiseBrain = null,
    trainingCount = 0,
    activePairwiseTrainingCount = 0,
    optimizationLog = [],
    setOptimizationLog,
    abRoundCount = 0,
    setAbRoundCount,
    setAbPair,
    resetLearningCore,
    clearSakuraSobolPool,
    resetExperimentMode,
    renderWidth = 0,
    renderHeight = 0,
    setShowInsight,
} = {}) {
    const { t } = useAppTranslation('main');
    const { confirm } = useConfirmDialog();
    const toast = useToast();
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizeProgress, setOptimizeProgress] = useState(0);
    const [optimizeError, setOptimizeError] = useState(null);
    const latentOptimizerWorkerRef = useRef(null);
    const classicLearningEnabledRef = useRef(classicLearningEnabled);
    classicLearningEnabledRef.current = classicLearningEnabled;
    const getLatentOptimizerWorker = useCallback(() => {
        if (!latentOptimizerWorkerRef.current) {
            latentOptimizerWorkerRef.current = new ZenLatentOptimizerWorkerClient();
        }
        return latentOptimizerWorkerRef.current;
    }, []);
    const disposeLatentOptimizerWorker = useCallback(() => {
        if (!latentOptimizerWorkerRef.current) {
            return;
        }
        latentOptimizerWorkerRef.current.dispose();
        latentOptimizerWorkerRef.current = null;
    }, []);
    const optimizeExecution = useMemo(
        () => new WorkerExecutionController({
            workerId: 'zen_optimize',
            runtimeTaskType: WORKER_RUNTIME_TASK_TYPE.ZEN_OPTIMIZE,
            runtimeContext: WORKER_RUNTIME_CONTEXT.UI,
            runtimeLane: WORKER_RUNTIME_LANE.COMPUTE,
            runtimePriority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
            fallbackPolicy: workerFallbackPolicy,
            maxConsecutiveFailures: 2,
            circuitOpenMs: 20000,
        }),
        [],
    );

    useEffect(() => {
        optimizeExecution.setFallbackPolicy(workerFallbackPolicy);
    }, [optimizeExecution, workerFallbackPolicy]);

    useEffect(() => () => {
        disposeLatentOptimizerWorker();
    }, [disposeLatentOptimizerWorker]);
    useEffect(() => {
        if (!classicLearningEnabled) disposeLatentOptimizerWorker();
    }, [classicLearningEnabled, disposeLatentOptimizerWorker]);

    const latestOptimization = useMemo(
        () => optimizationLog.find((entry) => entry?.treeType === treeType) || null,
        [optimizationLog, treeType],
    );
    const clearOptimizeError = useCallback(() => {
        setOptimizeError(null);
    }, []);
    const surfaceOptimizeError = useCallback((error, options = {}) => {
        const surfaced = toZenOptimizationError(error, options);
        setOptimizeError(surfaced);
        return surfaced;
    }, []);

    const applyCandidate = useCallback((candidate, options = {}) => {
        if (!classicLearningEnabledRef.current) return;
        if (!candidate) {
            return;
        }
        const { syncLearningAnchor = true } = options;
        const resolvedSeed = Number.parseInt(String(candidate.seed ?? ''), 10);
        if (!Number.isFinite(resolvedSeed)) {
            return;
        }
        setTreeSeed(resolvedSeed);
        const hasSakuraLatent = (
            treeType === 'sakura'
            && candidate?.latent
            && typeof candidate.latent === 'object'
        );
        if (!hasSakuraLatent) {
            return;
        }
        commitSakuraV2Latent(candidate.latent, {
            syncPhenotype: false,
            syncLearningAnchor,
        });
    }, [treeType, setTreeSeed, commitSakuraV2Latent]);

    const handleApplyArchetype = useCallback((entry) => {
        if (!Number.isFinite(Number(entry?.seed))) {
            return;
        }
        const hasLatent = entry?.latent && typeof entry.latent === 'object';
        if (!hasLatent) {
            toast.error(t('core_status.toast.archetype_missing_latent'));
            return;
        }
        setAbPair(null);
        applyCandidate({
            seed: Number(entry.seed),
            latent: entry.latent,
        });
    }, [
        applyCandidate,
        setAbPair,
        t,
        toast,
    ]);

    const handleReRoll = useCallback(() => {
        const newSeed = Math.floor(Math.random() * 100000);
        setTreeSeed(newSeed);
        setAbPair(null);

        if (isCollectionMode) {
            const nextLatent = mutateSakuraLatent(sakuraV2Latent, {
                intensity: 0.12,
                mutationRate: 0.74,
            });
            commitSakuraV2Latent(nextLatent, {
                syncPhenotype: false,
                syncLearningAnchor: false,
            });
        }
    }, [
        isCollectionMode,
        sakuraV2Latent,
        setTreeSeed,
        setAbPair,
        commitSakuraV2Latent,
    ]);

    const handleApplyToMain = useCallback(async () => {
        clearOptimizeError();
        const shouldApply = await confirm({
            title: t('core_status.dialog.apply_main_title'),
            description: t('core_status.apply_confirm'),
            confirmLabel: t('core_status.apply_to_main'),
            cancelLabel: t('common:action.cancel'),
        });
        if (!shouldApply) {
            return;
        }
        try {
            if (typeof applyDraftToMain !== 'function') {
                throw new Error('ZEN_BONSAI_AUTHORING_DRAFT_APPLY_OWNER_REQUIRED');
            }
            await applyDraftToMain({
                generationInputs: {
                    learningProgress,
                    canopyDistributionProfile,
                    spineGenerationConditionId,
                },
            });
            toast.success(t('core_status.toast.applied_to_main'));
        } catch (error) {
            surfaceOptimizeError(error, {
                code: 'ZEN_MAIN_APPLY_FAILED',
                message: 'Failed to apply the current bonsai to the main tab.',
                details: {
                    treeType,
                    seed: treeSeed,
                    structureMode,
                    structureDepth,
                },
            });
        }
    }, [
        clearOptimizeError,
        applyDraftToMain,
        canopyDistributionProfile,
        confirm,
        learningProgress,
        spineGenerationConditionId,
        structureDepth,
        structureMode,
        surfaceOptimizeError,
        t,
        toast,
        treeSeed,
        treeType,
    ]);

    const handleOptimize = useCallback(async () => {
        if (!classicLearningEnabledRef.current) {
            throw new Error('ZEN_BONSAI_CLASSIC_LEARNING_UNSUPPORTED');
        }
        if (isOptimizing) {
            return;
        }
        if (!renderWidth || !renderHeight) {
            return;
        }
        if (!sakuraV2Gate?.canOptimize) {
            const progressPercent = Math.max(0, Math.round(Number(sakuraV2Gate?.progressPercent || 0)));
            toast.warning(`신뢰도 게이트 잠김 (${progressPercent}%). LEARN을 더 진행해 주세요.`);
            return;
        }

        let preferenceBasinGuidance;
        try {
            preferenceBasinGuidance = createSakuraOptimizationBasinGuidance({
                preferenceBasin: sakuraV2Gate.basin,
                learningKeyspaceProfile,
            });
        } catch (error) {
            surfaceOptimizeError(error, {
                code: 'ZEN_SAKURA_OPTIMIZATION_BASIN_GUIDANCE_INVALID',
                message: 'Stable preference-basin guidance is invalid.',
                details: { learningKeyspaceProfile },
            });
            return;
        }

        const tuning = resolveZenOptimizeTuning({
            gateProgress: sakuraV2Gate?.progress ?? 0,
        });
        const resolvedObjectiveMode = OBJECTIVE_MODE.ADAPTIVE;
        const optimizeOptions = {
            treeType,
            species,
            stage: evaluationStageProfiles,
            width: renderWidth,
            height: renderHeight,
            topologyHeight: TOPOLOGY_REFERENCE_HEIGHT,
            brain,
            pairwiseBrain: activePairwiseBrain,
            objectiveMode: resolvedObjectiveMode,
            basePhenotype: currentPhenotype,
            referenceFeatures: effectiveReferenceFeatures,
            populationSize: tuning.populationSize,
            generations: tuning.generations,
            eliteCount: tuning.eliteCount,
            mutationIntensity: tuning.mutationIntensity,
            binsX: tuning.bins,
            binsY: tuning.bins,
            diverseTopK: tuning.diverseTopK,
            learningKeyspaceProfile: preferenceBasinGuidance.learningKeyspaceProfile,
            reliabilityHint: tuning.reliabilityHint,
        };
        const workerPayload = {
            objectiveMode: resolvedObjectiveMode,
            learningKeyspaceProfile: preferenceBasinGuidance.learningKeyspaceProfile,
            reliabilityHint: tuning.reliabilityHint,
            preferenceBasinGuidance,
            stage: evaluationStageProfiles,
            width: renderWidth,
            height: renderHeight,
            topologyHeight: TOPOLOGY_REFERENCE_HEIGHT,
            basePhenotype: currentPhenotype,
            baseLatent: learningAnchorLatent,
            referenceFeatures: effectiveReferenceFeatures,
            populationSize: optimizeOptions.populationSize,
            generations: optimizeOptions.generations,
            eliteCount: optimizeOptions.eliteCount,
            mutationIntensity: optimizeOptions.mutationIntensity,
            binsX: optimizeOptions.binsX,
            binsY: optimizeOptions.binsY,
            diverseTopK: optimizeOptions.diverseTopK,
        };

        setIsOptimizing(true);
        setOptimizeProgress(0);
        try {
            clearOptimizeError();
            if (typeof activePairwiseBrain?.persistState === 'function') {
                try {
                    await activePairwiseBrain.persistState();
                } catch (cause) {
                    const persistError = new Error(
                        'Zen optimization requires the latest pairwise model to be durably persisted before worker scoring.',
                        { cause },
                    );
                    persistError.code = 'ZEN_OPTIMIZATION_PAIRWISE_PERSIST_FAILED';
                    throw persistError;
                }
            }
            if (!classicLearningEnabledRef.current) return;
            const workerExecution = await optimizeExecution.execute({
                runWorker: async () => {
                    const latentOptimizerWorker = getLatentOptimizerWorker();
                    const workerResult = await latentOptimizerWorker.optimize(
                        workerPayload,
                        {
                            onProgress: (value) => setOptimizeProgress(clamp01(value)),
                        },
                    );
                    if (!workerResult || typeof workerResult !== 'object') {
                        throw new Error('ZEN_OPTIMIZER_WORKER_UNAVAILABLE');
                    }
                    return workerResult;
                },
                meta: {
                    generations: optimizeOptions.generations,
                    populationSize: optimizeOptions.populationSize,
                    workerPolicy: workerFallbackPolicy,
                },
            });
            if (!classicLearningEnabledRef.current) return;
            if (!workerExecution?.ok) {
                const workerError = workerExecution?.error || new Error('ZEN_OPTIMIZATION_WORKER_EXECUTION_FAILED');
                surfaceOptimizeError(workerError, {
                    code: 'ZEN_OPTIMIZATION_WORKER_EXECUTION_FAILED',
                    message: 'Zen optimization worker execution failed.',
                    details: {
                        mode: workerExecution?.mode || null,
                        workerPolicy: workerFallbackPolicy,
                        workerErrorCode: typeof workerError?.code === 'string'
                            ? workerError.code
                            : null,
                    },
                });
                return;
            }

            const result = requireCanonicalOptimizationResult(workerExecution.result, {
                learningKeyspaceProfile,
                source: workerExecution?.mode || null,
            });
            setOptimizeProgress(1);

            const best = result.recommendedCandidate;
            const optimizeScoreMode = result.objectiveMode || resolvedObjectiveMode;
            const optimizeScore = Number(
                (optimizeScoreMode === OBJECTIVE_MODE.ADAPTIVE
                    ? best.scores?.objective
                    : best.scores?.[optimizeScoreMode])
                ?? best.scores?.objective
                ?? best.scores?.blended
                ?? 0,
            );
            const preOptimizeScoreView = analyzedCandidate?.scores || {};
            const preOptimizeBlendedScore = Number(preOptimizeScoreView?.blended ?? 0);
            const preOptimizeObjectiveScore = Number(
                (resolvedObjectiveMode === OBJECTIVE_MODE.ADAPTIVE
                    ? preOptimizeScoreView?.objective
                    : preOptimizeScoreView?.[resolvedObjectiveMode])
                ?? preOptimizeScoreView?.objective
                ?? preOptimizeScoreView?.blended
                ?? 0,
            );
            const fillText = result?.mapElites
                ? `\nArchive Fill: ${result.mapElites.filledCells}/${result.mapElites.totalCells} (${Math.round(result.mapElites.fillRatio * 100)}%)`
                : '';
            const msg = t('core_status.optimize_confirm', {
                score: (optimizeScore * 100).toFixed(0),
                fillText,
            }) || `Optimization Complete!\n\nNew Score: ${(optimizeScore * 100).toFixed(0)}%${fillText}\n\nApply this new design?`;
            const shouldApply = await confirm({
                title: t('core_status.dialog.optimize_apply_title'),
                description: msg,
                confirmLabel: t('core_status.apply_now'),
                cancelLabel: t('common:action.cancel'),
            });
            if (!classicLearningEnabledRef.current) return;
            if (shouldApply) {
                applyCandidate(best, { persistSeed: true });
            }

            const archetypeSet = normalizeZenOptimizationArchetypeSet(result?.archetypeSet);
            setOptimizationLog((prev) => [
                {
                    id: Date.now(),
                    treeType,
                    bestSeed: best.seed,
                    bestPhenotype: best.phenotype,
                    bestLatent: best.latent,
                    bestScore: optimizeScore,
                    preOptimizeScore: preOptimizeObjectiveScore,
                    preOptimizeBlendedScore,
                    optimizeGain: optimizeScore - preOptimizeObjectiveScore,
                    optimizeMode: optimizeScoreMode,
                    optimizerMode: OPTIMIZER_MODE,
                    optimizeSpace: 'canonical_latent',
                    learningKeyspaceProfileAtOptimize: learningKeyspaceProfile,
                    optimizeReliabilityHint: tuning.reliabilityHint,
                    optimizePopulationSize: optimizeOptions.populationSize,
                    optimizeGenerations: optimizeOptions.generations,
                    optimizeMutationIntensity: optimizeOptions.mutationIntensity,
                    abRoundCountAtOptimize: abRoundCount,
                    trainingCountAtOptimize: trainingCount,
                    pairwiseTrainingCountAtOptimize: activePairwiseTrainingCount,
                    sakuraV2ModeAtOptimize: 'latent_v2',
                    structureDepth,
                    mapElites: result.mapElites || null,
                    archetypeMethod: result?.archetype?.method || 'dpp_greedy_anchor',
                    archetypeSet,
                    recommendationSource: 'diverse_recommended',
                    topFactors: best?.analysis?.evaluation?.strongest || [],
                    weakFactors: best?.analysis?.evaluation?.weakest || [],
                    phenotypeSummary: summarizePhenotype(best.phenotype),
                    generations: result.generationLog,
                    timestamp: new Date().toISOString(),
                },
                ...prev,
            ].slice(0, 20));
        } catch (error) {
            surfaceOptimizeError(error, {
                code: 'ZEN_OPTIMIZATION_FAILED',
                message: 'Zen optimization failed.',
                details: {
                    treeType,
                    learningKeyspaceProfile: learningKeyspaceProfile || null,
                },
            });
        } finally {
            disposeLatentOptimizerWorker();
            setIsOptimizing(false);
            setOptimizeProgress(0);
        }
    }, [
        isOptimizing,
        renderWidth,
        renderHeight,
        sakuraV2Gate,
        treeType,
        species,
        evaluationStageProfiles,
        brain,
        activePairwiseBrain,
        currentPhenotype,
        effectiveReferenceFeatures,
        learningKeyspaceProfile,
        learningAnchorLatent,
        workerFallbackPolicy,
        optimizeExecution,
        getLatentOptimizerWorker,
        disposeLatentOptimizerWorker,
        analyzedCandidate,
        applyCandidate,
        setOptimizationLog,
        abRoundCount,
        trainingCount,
        activePairwiseTrainingCount,
        structureDepth,
        clearOptimizeError,
        confirm,
        surfaceOptimizeError,
        t,
        toast,
    ]);

    const handleReApplyBest = useCallback(() => {
        if (!latestOptimization || latestOptimization.treeType !== treeType) {
            return;
        }
        clearOptimizeError();

        const bestSeed = Number.isFinite(latestOptimization.bestSeed)
            ? Number(latestOptimization.bestSeed)
            : treeSeed;
        const hasBestLatent = (
            treeType === 'sakura'
            && latestOptimization?.bestLatent
            && typeof latestOptimization.bestLatent === 'object'
        );
        if (hasBestLatent) {
            setAbPair(null);
            applyCandidate({
                seed: bestSeed,
                latent: latestOptimization.bestLatent,
            }, {
                persistSeed: true,
            });
            return;
        }

        surfaceOptimizeError(createZenOptimizationError(
            'ZEN_OPTIMIZATION_REAPPLY_LATENT_REQUIRED',
            'Zen re-apply requires canonical bestLatent from the latest optimization result.',
            {
                treeType,
                bestSeed,
            },
        ));
    }, [
        clearOptimizeError,
        latestOptimization,
        surfaceOptimizeError,
        treeType,
        treeSeed,
        setAbPair,
        applyCandidate,
    ]);

    const runHardReset = useCallback(async ({
        randomizeLatent = false,
    } = {}) => {
        const resetLabel = randomizeLatent
            ? t('core_status.reset_label_random_anchor')
            : t('core_status.reset_label_standard_anchor');
        const ok = await confirm({
            title: t('core_status.dialog.hard_reset_title', { label: resetLabel }),
            description: t('core_status.dialog.hard_reset_description'),
            confirmLabel: t('core_status.dialog.hard_reset_confirm'),
            cancelLabel: t('common:action.cancel'),
            danger: true,
        });
        if (!ok) {
            return;
        }

        const resetSeed = Math.floor(Math.random() * 1000000);
        const resetMode = 'tree';
        const depthRange = getStructureDepthRange(resetMode);
        const resetDepth = clampStructureDepth(6, depthRange.min, depthRange.max);
        const defaultFlags = {
            ...DEFAULT_SAKURA_V2_FLAGS,
            learningKeyspaceProfile,
        };

        const resetLatentBase = getDefaultSakuraLatent();
        const resetLatent = randomizeLatent
            ? mutateSakuraLatent(resetLatentBase, {
                intensity: 0.72,
                mutationRate: 0.98,
            })
            : resetLatentBase;
        const resetLatentState = commitSakuraV2Latent(resetLatent, {
            syncPhenotype: false,
            syncLearningAnchor: true,
        });
        const resetPhenotype = compileSakuraPhenotypeFromLatent(
            resetLatentState?.latent || resetLatent,
        );

        resetLearningCore();
        setAbExplorationIntensity(DEFAULT_AB_EXPLORATION_INTENSITY);
        setAbQueryTuning(DEFAULT_AB_QUERY_TUNING);
        setRedundancyTuning(DEFAULT_REDUNDANCY_TUNING);
        setCanopyDistributionTuning(DEFAULT_CANOPY_DISTRIBUTION_TUNING);
        setSakuraV2Flags(defaultFlags);
        clearSakuraSobolPool();
        setOptimizationLog([]);
        setAnalysisPhenotype(resetPhenotype);
        setTreeSeed(resetSeed);
        setStructureMode(resetMode);
        setStructureDepth(resetDepth);
        setShowInsight(false);
        setAbRoundCount(0);
        resetExperimentMode();

        persistABQueryTuning(treeType, DEFAULT_AB_QUERY_TUNING);
        persistRedundancyTuning(treeType, DEFAULT_REDUNDANCY_TUNING);
        persistCanopyDistributionTuning(treeType, DEFAULT_CANOPY_DISTRIBUTION_TUNING);
        persistSakuraV2Flags(defaultFlags);
        toast.success(t('core_status.toast.hard_reset_complete', { label: resetLabel }));
    }, [
        treeType,
        learningKeyspaceProfile,
        commitSakuraV2Latent,
        resetLearningCore,
        setAbExplorationIntensity,
        setAbQueryTuning,
        setRedundancyTuning,
        setCanopyDistributionTuning,
        setSakuraV2Flags,
        clearSakuraSobolPool,
        setOptimizationLog,
        setAnalysisPhenotype,
        setTreeSeed,
        setStructureMode,
        setStructureDepth,
        setShowInsight,
        setAbRoundCount,
        resetExperimentMode,
        confirm,
        t,
        toast,
    ]);

    const handleHardReset = useCallback(() => {
        void runHardReset({ randomizeLatent: false });
    }, [runHardReset]);

    const handleHardResetRandom = useCallback(() => {
        void runHardReset({ randomizeLatent: true });
    }, [runHardReset]);

    const handleSyncLearningAnchor = useCallback(() => {
        commitSakuraV2Latent(sakuraV2Latent, {
            syncPhenotype: false,
            syncLearningAnchor: true,
        });
    }, [commitSakuraV2Latent, sakuraV2Latent]);

    return {
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
    };
}

export default useZenClassicActionController;
