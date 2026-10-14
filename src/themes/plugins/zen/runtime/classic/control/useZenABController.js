import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    round,
    clamp01,
    randomSeed,
    SPECIAL_QUERY,
    DECISION_MODE,
    buildScalarStats,
    clonePair,
} from '../../../model/ABControllerUtils';
import {
    resolveQuestionGenerationProfile,
} from '../../../model/QuestionQualityMonitor';
import {
    buildRedundancyGuidance,
    buildSakuraExpressionGuidance,
    pickDuelingThompsonCandidates,
    resolveChangedFactorIds,
    resolveChangedTierIds,
    resolveSakuraPairComparabilityScore,
    resolveSakuraPairExpressionDiversityCredit,
} from '../../../model/ABPairSelection';
import {
    createPackedABPair,
} from '../../../model/ZenABCandidatePacking';
import {
    buildABCandidateSlateFromEvaluatedCandidates,
    buildABCandidateSlateFromPairPool,
    buildABSourcePairPoolFromEvaluatedCandidates,
    buildABWorkerCandidateSpecsFromTrials,
    isABControlledAttributionPair,
    isABStructuralDiscoveryPair,
    scoreABPairAcquisition,
} from '../../../model/ABCandidateSlate';
import {
    buildABPairExposureLedger,
    buildABPairRenderSignature,
    buildABPairSignature,
    resolveABPairExposure,
} from '../../../model/ABPairSignature';
import {
    normalizeTrialSpec,
    ZEN_AB_CANDIDATE_EVALUATION_PROFILE,
    ZEN_AB_CANDIDATE_GENERATION_DETAIL,
    ZEN_AB_CANDIDATE_OBJECTIVE_MODE,
} from '@/themes/plugins/zen/contracts/TrialContract';
import {
    compileSakuraPhenotypeFromLatent,
} from '../../../model/v2/SakuraCompiler';
import {
    DEFAULT_REDUNDANCY_TUNING,
} from '../../../model/ZenCoreConfig';
import { ZenABTrialWorkerClient } from '../../../model/ZenABTrialWorkerClient';
import { WorkerExecutionController } from '../../../model/WorkerExecutionController';
import { WORKER_FALLBACK_POLICY } from '../../../model/SakuraV2Runtime';
import {
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    WORKER_RUNTIME_TASK_TYPE,
} from '../../../../../../platform/workers/runtime/index.js';
import { useZenABFeedbackHandlers } from './useZenABFeedbackHandlers';
import { useZenABQuestionQualityState } from './useZenABQuestionQualityState';
import {
    SAKURA_LEARNING_FACTOR_CATALOG,
    listSakuraActiveLearningFactorKeys,
} from '../../../model/v2/SakuraLearningFactorPolicy';
import {
    resolveSakuraLearningLatentProfile,
} from '../../../model/v2/SakuraLatentParamApi';
import {
    SAKURA_PREFERENCE_BASIN_STAGE,
    buildSakuraPreferenceBasinModel,
    projectSakuraPreferenceBasinHistory,
} from '../../../model/SakuraPreferenceBasinModel';
import {
    resolveSakuraPreferenceLearningFocus,
} from '../../../model/SakuraPreferenceLearningPolicy';
import {
    requireSakuraABQuestionLane,
    resolveSakuraABQuestionLaneHistoryCursor,
    resolveSakuraABQuestionLanePolicy,
    SAKURA_AB_QUESTION_LANE,
} from '../../../model/SakuraABQuestionLanePolicy';
import {
    resolveSakuraPairwiseEvidencePolicy,
} from '../../../model/SakuraPairwiseEvidencePolicy.js';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from '../../../model/v2/SakuraLearningSemantics.js';
import {
    requireSakuraMacroSpineGuideV1,
} from '../../../model/sakura/sakuraMacroSpineGuide.js';
import {
    createSakuraMacroSpineGuideConditionV1,
} from '../../../model/sakura/sakuraMacroSpineGuideCondition.js';
import {
    requireSakuraSpineReferenceFamilyV1,
} from '../../../model/sakura/sakuraSpineReferenceFamily.js';
import {
    createSakuraSpineReferenceFamilyConditionV1,
} from '../../../model/sakura/sakuraSpineReferenceFamilyCondition.js';
import {
    resolveSakuraABFormQuestionPlan,
} from '../../../model/SakuraABFormQuestionPolicy.js';
import {
    BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX,
    resolveBonsaiStructuralScreenDistanceV1,
} from '../../../model/bonsai/rendering/BonsaiStructuralComparisonPlan.js';
import {
    buildSakuraMorphologyPreferencePosterior,
    summarizeSakuraMorphologyDiscoveryCoverage,
} from '../../../model/SakuraMorphologyPreferencePosterior.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const hasOwn = (value, key) => Boolean(
    value
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key)
);
const resolvePreferenceSchedulerRoundIndex = (abHistory = []) => {
    const eligibleHistory = (Array.isArray(abHistory) ? abHistory : []).filter((entry) => (
        String(entry?.query?.kind || entry?.generationContext?.queryKind || '').toLowerCase()
        !== 'anchor'
        && entry?.generationContext?.pairType === 'isolation_pair'
        && resolveSakuraPairwiseEvidencePolicy(entry).preferenceBasinEligible
    ));
    const persistedRoundIndices = eligibleHistory
        .map((entry) => entry?.generationContext?.preferenceLearning?.schedulerRoundIndex)
        .filter((value) => Number.isSafeInteger(value) && value >= 0);
    return persistedRoundIndices.length
        ? Math.max(...persistedRoundIndices) + 1
        : eligibleHistory.length;
};
export const resolvePreferenceSpatialProbeOrdinals = (
    abHistory = [],
    factorKeys = [],
) => {
    const factorSet = new Set(factorKeys);
    const stateByFactor = Object.fromEntries(factorKeys.map((key) => [key, {
        legacyCount: 0,
        maxPersistedOrdinal: null,
    }]));
    (Array.isArray(abHistory) ? abHistory : []).forEach((entry) => {
        const queryKind = String(
            entry?.query?.kind || entry?.generationContext?.queryKind || '',
        ).toLowerCase();
        const context = entry?.generationContext;
        if (
            queryKind === 'anchor'
            || context?.pairType !== 'isolation_pair'
            || !resolveSakuraPairwiseEvidencePolicy(entry).preferenceBasinEligible
        ) {
            return;
        }
        const factorKey = context.changedFactors[0]?.id;
        if (!factorSet.has(factorKey)) {
            return;
        }
        const preferenceLearning = context.preferenceLearning;
        if (hasOwn(preferenceLearning, 'spatialProbeOrdinal')) {
            const ordinal = preferenceLearning.spatialProbeOrdinal;
            if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
                throw new Error(
                    `ZEN_SAKURA_PREFERENCE_SPATIAL_PROBE_ORDINAL_INVALID:factor=${factorKey}`,
                );
            }
            stateByFactor[factorKey].maxPersistedOrdinal = Math.max(
                stateByFactor[factorKey].maxPersistedOrdinal ?? -1,
                ordinal,
            );
            return;
        }
        stateByFactor[factorKey].legacyCount += 1;
    });
    return Object.fromEntries(factorKeys.map((key) => {
        const state = stateByFactor[key];
        return [
            key,
            state.maxPersistedOrdinal === null
                ? state.legacyCount
                : state.maxPersistedOrdinal + 1,
        ];
    }));
};
export const resolvePreferenceAbstainStreakCounts = (
    abHistory = [],
    factorKeys = [],
) => {
    const factorSet = new Set(factorKeys);
    const counts = Object.fromEntries(factorKeys.map((key) => [key, 0]));
    const streakClosed = new Set();
    (Array.isArray(abHistory) ? abHistory : []).forEach((entry) => {
        const queryKind = String(
            entry?.query?.kind || entry?.generationContext?.queryKind || '',
        ).toLowerCase();
        const context = entry?.generationContext;
        if (
            queryKind === 'anchor'
            || context?.pairType !== 'isolation_pair'
            || !resolveSakuraPairwiseEvidencePolicy(entry).preferenceBasinEligible
        ) {
            return;
        }
        const factorKey = context.changedFactors[0]?.id;
        if (!factorSet.has(factorKey) || streakClosed.has(factorKey)) {
            return;
        }
        if (String(entry?.picked || '').trim().toUpperCase() === 'PASS') {
            counts[factorKey] += 1;
            return;
        }
        streakClosed.add(factorKey);
    });
    return counts;
};
const buildPreferenceLearningState = ({
    abHistory = [],
    learningKeyspaceProfile = null,
} = {}) => {
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    const factorKeys = listSakuraActiveLearningFactorKeys();
    const projection = projectSakuraPreferenceBasinHistory({
        abHistory,
        factorKeys,
        learningKeyspaceProfile: profile,
    });
    const basin = buildSakuraPreferenceBasinModel({
        abHistory: projection.entries,
        factorKeys,
        learningKeyspaceProfile: profile,
    });
    const basinFactorsByKey = Object.fromEntries(
        basin.factors.map((factor) => [factor.factorKey, {
            ...factor,
            stable: factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE
                || factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT,
            indifferent: factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT,
        }]),
    );
    const schedulerRoundIndex = resolvePreferenceSchedulerRoundIndex(abHistory);
    const coverageCounts = Object.fromEntries(
        basin.factors.map((factor) => [
            factor.factorKey,
            factor.resolutionEvidenceCount,
        ]),
    );
    const spatialProbeOrdinals = resolvePreferenceSpatialProbeOrdinals(
        abHistory,
        factorKeys,
    );
    const abstainStreakCounts = resolvePreferenceAbstainStreakCounts(
        abHistory,
        factorKeys,
    );
    const focus = resolveSakuraPreferenceLearningFocus({
        factorCatalog: SAKURA_LEARNING_FACTOR_CATALOG,
        basinSummary: { factors: basinFactorsByKey },
        coverageCounts,
        spatialProbeOrdinals,
        abstainStreakCounts,
        roundIndex: schedulerRoundIndex,
    });
    const focusedBasin = basinFactorsByKey[focus.focusFactor];
    return Object.freeze({
        ...focus,
        learningKeyspaceProfile: profile,
        activeFactorCount: factorKeys.length,
        schedulerRoundIndex,
        focusEvidenceCount: focusedBasin?.resolutionEvidenceCount || 0,
        focusBasinStage: focusedBasin?.stage || SAKURA_PREFERENCE_BASIN_STAGE.EXPLORE,
        basinCoverage: basin.coverage,
        stableFactorRatio: basin.stableFactorRatio,
        indifferentFactorRatio: basin.indifferentFactorRatio,
        resolvedFactorRatio: basin.resolvedFactorRatio,
        projectedLegacyEntryCount: projection.projectedEntryCount,
    });
};
const LOW_QUALITY_RESAMPLE_MAX = 2;
const LOW_QUALITY_INFO_FLOOR_MAX = 0.82;
const LOW_QUALITY_CLARITY_FLOOR_MAX = 0.62;
const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);
const warnABController = (message, error = null) => {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') {
        return;
    }
    if (error) {
        console.warn(`[useZenABController] ${message}`, error);
        return;
    }
    console.warn(`[useZenABController] ${message}`);
};
const createABGenerationError = (
    code = 'ZEN_AB_GENERATION_FAILED',
    message = 'Zen A/B generation failed.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.name = 'ZenABGenerationError';
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};
const shouldPreserveABGenerationError = (error) => {
    const code = String(error?.code || '').trim();
    return Boolean(
        error instanceof Error
        && code
        && code.startsWith('ZEN_AB_')
        && !code.startsWith('ZEN_AB_TRIAL_WORKER_')
    );
};
const toABGenerationError = (
    error,
    {
        code = 'ZEN_AB_GENERATION_FAILED',
        message = 'Zen A/B generation failed.',
        details = null,
    } = {},
) => {
    if (shouldPreserveABGenerationError(error)) {
        return error;
    }
    const rawMessage = String(error?.message || error || '').trim();
    const resolvedMessage = rawMessage
        ? `${message} ${rawMessage}`.trim()
        : message;
    return createABGenerationError(
        code,
        resolvedMessage,
        details,
        error instanceof Error ? error : null,
    );
};
export function useZenABController({
    width,
    height,
    treeType,
    currentPhenotype,
    spineGuide = null,
    spineReferenceFamily = null,
    currentLatent = null,
    abHistory = [],
    redundancyTuning = DEFAULT_REDUNDANCY_TUNING,
    abExplorationIntensity,
    collectCandidate,
    trainCandidate,
    trainPairwisePreference,
    setFactorTraceLog,
    setAbHistory,
    setAbGeneratedSamples,
    buildABCharacteristicSample,
    scoreABPairInformativeness,
    brain = null,
    pairwiseBrain = null,
    evaluationStageProfiles = [],
    topologyHeight = null,
    experimental,
    isCollectionMode,
    enableAbGeneration = Boolean(experimental && isCollectionMode),
    abQueryTuning = null,
    learningKeyspaceProfile = null,
    workerFallbackPolicy = WORKER_FALLBACK_POLICY.STRICT,
    abPlanReady = true,
    buildV2Plan = null,
    onABResolved = null,
}) {
    const activeSpineGuide = useMemo(
        () => (spineGuide ? requireSakuraMacroSpineGuideV1(spineGuide) : null),
        [spineGuide],
    );
    const spineGuideCondition = useMemo(
        () => (activeSpineGuide
            ? createSakuraMacroSpineGuideConditionV1(activeSpineGuide)
            : null),
        [activeSpineGuide],
    );
    const spineGuideConditionKey = spineGuideCondition?.conditionId || 'spine_guide:none';
    const activeSpineReferenceFamily = useMemo(
        () => (spineReferenceFamily
            ? requireSakuraSpineReferenceFamilyV1(spineReferenceFamily)
            : null),
        [spineReferenceFamily],
    );
    const spineReferenceFamilyCondition = useMemo(
        () => {
            if (activeSpineGuide && activeSpineReferenceFamily) {
                throw new Error('ZEN_AB_SPINE_CONDITION_CONFLICT');
            }
            return activeSpineReferenceFamily
                ? createSakuraSpineReferenceFamilyConditionV1(activeSpineReferenceFamily)
                : null;
        },
        [activeSpineGuide, activeSpineReferenceFamily],
    );
    const spineReferenceFamilyConditionKey = (
        spineReferenceFamilyCondition?.conditionId || 'spine_reference_family:none'
    );
    const [abPair, setAbPair] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [abRoundCount, setAbRoundCount] = useState(0);
    const [generationError, setGenerationError] = useState(null);
    const generatingABRef = useRef(false);
    const retryGenerationTimerRef = useRef(null);
    const anchorPairRef = useRef(null);
    const generationErrorRef = useRef(null);
    const abTrialWorkerRef = useRef(null);
    const modelPersistStateRef = useRef({
        lastScheduledAt: 0,
    });
    const {
        bestWorstInterval,
        anchorInterval,
        minSpecialRound,
        specialStrength,
        sessionCalibration,
        anchorStatsRef,
        questionQualityRef,
        questionQuality,
        resetAnchorStats,
        updateAnchorCalibration,
        calibrationWeight,
        updateQuestionQuality,
    } = useZenABQuestionQualityState({
        abQueryTuning,
    });
    const getAbTrialWorker = useCallback(() => {
        if (!abTrialWorkerRef.current) {
            abTrialWorkerRef.current = new ZenABTrialWorkerClient();
        }
        return abTrialWorkerRef.current;
    }, []);
    const disposeAbTrialWorker = useCallback(() => {
        if (!abTrialWorkerRef.current) {
            return;
        }
        abTrialWorkerRef.current.dispose();
        abTrialWorkerRef.current = null;
    }, []);
    const abTrialExecution = useMemo(
        () => new WorkerExecutionController({
            workerId: 'zen_ab_trial',
            runtimeTaskType: WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL,
            runtimeContext: WORKER_RUNTIME_CONTEXT.UI,
            runtimeLane: WORKER_RUNTIME_LANE.COMPUTE,
            runtimePriority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
            fallbackPolicy: workerFallbackPolicy,
            maxConsecutiveFailures: 3,
            circuitOpenMs: 15000,
        }),
        [],
    );
    useEffect(() => {
        abTrialExecution.setFallbackPolicy(workerFallbackPolicy);
    }, [abTrialExecution, workerFallbackPolicy]);
    const generationStateRef = useRef({
        ticket: 0,
        requestTag: null,
    });
    const spineGuideConditionKeyRef = useRef(spineGuideConditionKey);
    const spineReferenceFamilyConditionKeyRef = useRef(
        spineReferenceFamilyConditionKey,
    );
    const clearRetryGenerationTimer = useCallback(() => {
        if (retryGenerationTimerRef.current) {
            clearTimeout(retryGenerationTimerRef.current);
            retryGenerationTimerRef.current = null;
        }
    }, []);
    const clearGenerationError = useCallback(() => {
        generationErrorRef.current = null;
        setGenerationError(null);
    }, []);
    const surfaceGenerationError = useCallback((error, options = {}) => {
        const surfaced = toABGenerationError(error, options);
        generationErrorRef.current = surfaced;
        setGenerationError(surfaced);
        return surfaced;
    }, []);
    const cancelActiveGeneration = useCallback((reason = 'ZEN_AB_GENERATION_INVALIDATED', options = {}) => {
        clearRetryGenerationTimer();
        const currentTag = generationStateRef.current.requestTag;
        generationStateRef.current = {
            ticket: generationStateRef.current.ticket + 1,
            requestTag: null,
        };
        const abTrialWorker = abTrialWorkerRef.current;
        if (currentTag && abTrialWorker) {
            abTrialWorker.cancelTaggedRequests(currentTag, {
                hard: options?.hard !== false,
                reason,
            });
        }
        if (options?.clearFlags !== false) {
            generatingABRef.current = false;
            setIsGenerating(false);
        }
    }, [clearRetryGenerationTimer]);
    useEffect(() => () => {
        cancelActiveGeneration('ZEN_AB_CONTROLLER_DISPOSED', {
            hard: true,
            clearFlags: false,
        });
        clearRetryGenerationTimer();
        disposeAbTrialWorker();
    }, [cancelActiveGeneration, clearRetryGenerationTimer, disposeAbTrialWorker]);
    const abHistoryRef = useRef(abHistory);
    abHistoryRef.current = abHistory;
    const setAbHistorySynchronous = useCallback((updater) => {
        const nextHistory = typeof updater === 'function'
            ? updater(abHistoryRef.current)
            : updater;
        if (!Array.isArray(nextHistory)) {
            throw new TypeError('ZEN_SAKURA_AB_HISTORY_ARRAY_REQUIRED');
        }
        abHistoryRef.current = nextHistory;
        setAbHistory(nextHistory);
        return nextHistory;
    }, [setAbHistory]);

    const appendGeneratedSamples = useCallback((pair) => {
        if (!pair?.A || !pair?.B) {
            return;
        }
        const generatedSamples = [
            buildABCharacteristicSample(pair.A, treeType, pair.generationContext, 'A'),
            buildABCharacteristicSample(pair.B, treeType, pair.generationContext, 'B'),
        ].filter(Boolean);
        if (generatedSamples.length) {
            setAbGeneratedSamples((prev) => [...generatedSamples, ...prev].slice(0, 400));
        }
    }, [buildABCharacteristicSample, treeType, setAbGeneratedSamples]);

    const hydratePairTopology = useCallback((pair = null) => {
        if (!pair || typeof pair !== 'object') {
            return pair;
        }
        const pairSignature = pair.pairSignature || buildABPairSignature(pair);
        const renderSignature = pair.renderSignature || buildABPairRenderSignature(pair);
        return {
            ...pair,
            pairSignature,
            renderSignature,
            generationContext: {
                ...(pair.generationContext || {}),
                pairSignature,
                renderSignature,
            },
        };
    }, []);

    const scheduleModelPersistSync = useCallback(() => {
        const nowTs = Date.now();
        if ((nowTs - Number(modelPersistStateRef.current.lastScheduledAt || 0)) < 1600) {
            return;
        }
        modelPersistStateRef.current.lastScheduledAt = nowTs;
        const enqueuePersist = (runner) => {
            if (typeof runner !== 'function') {
                return;
            }
            if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(() => {
                    void runner().catch((error) => {
                        warnABController('Failed to persist model state in idle callback.', error);
                    });
                }, { timeout: 1200 });
                return;
            }
            setTimeout(() => {
                void runner().catch((error) => {
                    warnABController('Failed to persist model state in timeout fallback.', error);
                });
            }, 48);
        };
        if (typeof pairwiseBrain?.persistState === 'function') {
            enqueuePersist(() => pairwiseBrain.persistState());
        }
        if (typeof brain?.persistState === 'function') {
            enqueuePersist(() => brain.persistState());
        }
    }, [pairwiseBrain, brain]);

    const flushLearningModels = useCallback(async (options = {}) => {
        const runners = [
            {
                id: 'pairwise',
                model: pairwiseBrain,
                storageKey: pairwiseBrain?.storageKey || null,
            },
            {
                id: 'neural',
                model: brain,
                storageKey: brain?.storageKey || null,
            },
        ]
            .filter((entry) => entry.model)
            .map((entry) => {
                const { model } = entry;
                const runner = (() => {
                    if (typeof model.flushSave === 'function') {
                        return () => model.flushSave();
                    }
                    if (typeof model.save === 'function') {
                        return () => model.save({ immediate: true });
                    }
                    if (typeof model.persistState === 'function') {
                        return () => model.persistState();
                    }
                    return null;
                })();
                return runner ? { ...entry, runner } : null;
            })
            .filter(Boolean);

        if (!runners.length) {
            return true;
        }

        try {
            await Promise.all(runners.map((entry) => entry.runner()));
            modelPersistStateRef.current.lastScheduledAt = Date.now();
            return true;
        } catch (error) {
            surfaceGenerationError(error, {
                code: 'ZEN_AB_MODEL_FLUSH_FAILED',
                message: 'Zen A/B generation blocked because the learning model state could not be flushed before worker scoring.',
                details: {
                    reason: typeof options?.reason === 'string' ? options.reason : 'ab_feedback',
                    queryKind: typeof options?.queryKind === 'string' ? options.queryKind : null,
                    modelIds: runners.map((entry) => entry.id),
                    storageKeys: runners.reduce((acc, entry) => {
                        if (entry.storageKey) {
                            acc[entry.id] = entry.storageKey;
                        }
                        return acc;
                    }, {}),
                },
            });
            return false;
        }
    }, [pairwiseBrain, brain, surfaceGenerationError]);

    const generateABPair = useCallback(async (options = {}) => {
        const schedulerBaseRoundCount = Number.isFinite(options.roundBase)
            ? options.roundBase
            : abRoundCount;
        if (!enableAbGeneration || !width || !height || generatingABRef.current || !abPlanReady) {
            return false;
        }
        const previousRequestTag = generationStateRef.current.requestTag;
        const activeWorker = abTrialWorkerRef.current;
        if (previousRequestTag && activeWorker) {
            activeWorker.cancelTaggedRequests(previousRequestTag, {
                hard: true,
                reason: 'ZEN_AB_GENERATION_PREEMPTED',
            });
        }
        const generationTicket = generationStateRef.current.ticket + 1;
        const generationRequestTag = `zen_ab_generation_${generationTicket}`;
        generationStateRef.current = {
            ticket: generationTicket,
            requestTag: generationRequestTag,
        };
        const isGenerationActive = () => (
            generationStateRef.current.ticket === generationTicket
        );
        generatingABRef.current = true;
        setIsGenerating(true);
        let plannedRoundIndex = null;

        try {
            clearGenerationError();
            scheduleModelPersistSync();
            if (!isGenerationActive()) {
                return false;
            }
            if (treeType !== 'sakura') {
                throw createABGenerationError(
                    'ZEN_AB_GENERATION_SPECIES_UNSUPPORTED',
                    'Zen A/B generation requires the canonical Sakura profile.',
                    {
                        treeType: treeType ?? null,
                        owner: 'zen_ab_controller',
                    },
                );
            }

            const sourcePlanningHistory = hasOwn(options, 'historyOverride')
                ? options.historyOverride
                : abHistoryRef.current;
            const diagnosticPlanningHistory = Array.isArray(sourcePlanningHistory)
                ? sourcePlanningHistory
                : [];
            const planningHistory = diagnosticPlanningHistory.filter((entry) => (
                entry?.generationContext?.generationSemantics
                    === SAKURA_GENERATION_SEMANTICS_ID
            ));
            const questionLaneHistoryCursor = resolveSakuraABQuestionLaneHistoryCursor(
                planningHistory,
            );
            plannedRoundIndex = questionLaneHistoryCursor.roundOrdinal + 1;
            const planningPreferenceLearningState = buildPreferenceLearningState({
                abHistory: planningHistory,
                learningKeyspaceProfile,
            });
            const requestedQuestionLanePolicy = resolveSakuraABQuestionLanePolicy({
                roundIndex: plannedRoundIndex,
                discoveryOrdinal: questionLaneHistoryCursor.discoveryOrdinal,
            });
            const planningExpressionGuidance = buildSakuraExpressionGuidance(
                planningHistory,
                learningKeyspaceProfile,
            );
            const planningPairExposureLedger = buildABPairExposureLedger(planningHistory, {
                windowSize: 96,
                includeAnchors: false,
            });
            const planningMorphologyPosterior = buildSakuraMorphologyPreferencePosterior(
                diagnosticPlanningHistory,
            );
            const planningMorphologyPosteriorMeta = planningMorphologyPosterior.getMeta();
            const planningMorphologyCoverage = summarizeSakuraMorphologyDiscoveryCoverage(
                planningHistory,
            );

            const basePlanIntensity = 0.16 + (abExplorationIntensity * 0.22);
            const generationProfile = resolveQuestionGenerationProfile({
                baseIntensity: basePlanIntensity,
                questionQuality: questionQualityRef.current.summary,
            });
            const redundancyGuidance = buildRedundancyGuidance(
                planningHistory,
                treeType,
                redundancyTuning,
                learningKeyspaceProfile,
            );
            const createPair = (candidateA, candidateB, generationContext = { mode: 'learn_mode' }) => (
                createPackedABPair(candidateA, candidateB, generationContext)
            );

            const qualityRetryLimit = clamp(
                Math.round(Number(options?.qualityRetryLimit ?? LOW_QUALITY_RESAMPLE_MAX)),
                0,
                4,
            );
            const preferenceStage = planningPreferenceLearningState.stage;
            const stableConfirmation = preferenceStage === 'stable_confirmation';
            const basinEstablishment = preferenceStage === 'establish';
            const qualityInfoFloor = clamp(
                (stableConfirmation ? 0.38 : basinEstablishment ? 0.46 : 0.52)
                    + (Number(generationProfile.pressure || 0) * 0.12),
                0.34,
                LOW_QUALITY_INFO_FLOOR_MAX,
            );
            const qualityClarityFloor = clamp(
                (stableConfirmation ? 0.12 : basinEstablishment ? 0.17 : 0.21)
                    + (Number(generationProfile.pressure || 0) * 0.16),
                0.1,
                LOW_QUALITY_CLARITY_FLOOR_MAX,
            );

            const scoreAttemptPool = async (attemptIndex = 0) => {
                if (!isGenerationActive()) {
                    return null;
                }
                const attemptIntensity = clamp(
                    Number(generationProfile.intensity || basePlanIntensity)
                    * (1 + Math.min(0.42, attemptIndex * 0.16)),
                    Number(generationProfile.intensity || basePlanIntensity),
                    0.88,
                );
                const trialCount = Math.max(
                    6,
                    Math.min(
                        24,
                        Math.round((7 + (abExplorationIntensity * 8)) * generationProfile.trialBoost + (attemptIndex * 4)),
                    ),
                );
                const trialSpecs = [];

                for (let trial = 0; trial < trialCount; trial += 1) {
                    if (!isGenerationActive()) {
                        return null;
                    }
                    const planInput = {
                        basePhenotype: currentPhenotype,
                        baseLatent: options?.baseLatent ?? null,
                        treeType,
                        intensity: attemptIntensity,
                        roundIndex: plannedRoundIndex + trial + (attemptIndex * 37),
                        roundBase: plannedRoundIndex,
                        trialIndex: trial,
                        attemptIndex,
                        questionLane: requestedQuestionLanePolicy.questionLane,
                        forcePairType: requestedQuestionLanePolicy.questionLane
                            === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
                            ? null
                            : requestedQuestionLanePolicy.pairType,
                        focusKey: requestedQuestionLanePolicy.questionLane
                            === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
                            ? planningPreferenceLearningState.focusFactor
                            : null,
                        targetPairGapNorm: requestedQuestionLanePolicy.questionLane
                            === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
                            ? clamp(
                                planningPreferenceLearningState.targetPairGapNorm
                                * (1 + (attemptIndex * 0.45)),
                                planningPreferenceLearningState.targetPairGapNorm,
                                0.42,
                            )
                            : null,
                        targetPairCenterNorm: requestedQuestionLanePolicy.questionLane
                            === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
                            ? planningPreferenceLearningState.targetPairCenterNorm
                            : null,
                        preferenceLearning: requestedQuestionLanePolicy.questionLane
                            === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
                            ? planningPreferenceLearningState
                            : null,
                        availableFocusKeys: requestedQuestionLanePolicy.questionLane
                            === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
                            ? [planningPreferenceLearningState.focusFactor]
                            : null,
                        qualityProfile: generationProfile,
                        diversityGuidance: planningExpressionGuidance,
                    };
                    const injectedV2Plan = typeof buildV2Plan === 'function'
                        ? buildV2Plan(planInput)
                        : null;
                    const v2Plan = injectedV2Plan;
                    const phenotypePair = v2Plan?.phenotypePair;
                    const latentPair = v2Plan?.latentPair;
                    if (
                        !phenotypePair?.phenotypeA
                        || !phenotypePair?.phenotypeB
                        || !latentPair?.latentA
                        || !latentPair?.latentB
                    ) {
                        continue;
                    }
                    const planPairType = v2Plan?.pairType
                        || phenotypePair?.context?.pairType
                        || latentPair?.context?.pairType
                        || null;
                    const questionLanePolicy = planPairType === 'sobol_cold_start'
                        ? resolveSakuraABQuestionLanePolicy({
                            roundIndex: plannedRoundIndex,
                            coldStart: true,
                        })
                        : requestedQuestionLanePolicy;
                    const isStructuralDiscoveryQuestion = (
                        questionLanePolicy.questionLane
                        === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
                    );
                    if (
                        !isStructuralDiscoveryQuestion
                        && planPairType !== questionLanePolicy.pairType
                    ) {
                        throw createABGenerationError(
                            'ZEN_AB_QUESTION_LANE_PAIR_TYPE_MISMATCH',
                            'Zen A/B question lane produced an incompatible pair type.',
                            {
                                questionLane: questionLanePolicy.questionLane,
                                expectedPairType: questionLanePolicy.pairType,
                                receivedPairType: planPairType,
                                trialIndex: trial,
                            },
                        );
                    }
                    const planStrategy = isStructuralDiscoveryQuestion
                        ? questionLanePolicy.strategy
                        : v2Plan?.strategy;
                    if (!isStructuralDiscoveryQuestion && planStrategy !== questionLanePolicy.strategy) {
                        throw createABGenerationError(
                            'ZEN_AB_QUESTION_LANE_STRATEGY_MISMATCH',
                            'Zen A/B question lane produced an incompatible strategy.',
                            {
                                questionLane: questionLanePolicy.questionLane,
                                expectedStrategy: questionLanePolicy.strategy,
                                receivedStrategy: planStrategy || null,
                                trialIndex: trial,
                            },
                        );
                    }
                    const sharedSeedBase = questionLanePolicy.sharedSeed === true;
                    const seedA = randomSeed();
                    const seedB = sharedSeedBase ? seedA : randomSeed();
                    const formQuestionPlan = resolveSakuraABFormQuestionPlan({
                        questionLane: questionLanePolicy.questionLane,
                        trialIndex: trial,
                        roundIndex: plannedRoundIndex + attemptIndex,
                        sharedVariantSeed: seedA,
                        history: planningHistory,
                    });
                    const plannedLatentA = { ...latentPair.latentA };
                    const plannedLatentB = isStructuralDiscoveryQuestion
                        ? { ...latentPair.latentA }
                        : { ...latentPair.latentB };
                    const planContext = phenotypePair?.context && typeof phenotypePair.context === 'object'
                        ? phenotypePair.context
                        : {};
                    const generationContext = {
                        ...planContext,
                        questionLane: questionLanePolicy.questionLane,
                        pairType: questionLanePolicy.pairType,
                        sharedSeedPolicy: 'shared',
                        sharedSeedApplied: true,
                        formQuestionPolicyId: formQuestionPlan.policyId,
                        formQuestionRelation: formQuestionPlan.relation,
                        targetFormIdA: formQuestionPlan.formIdA,
                        targetFormIdB: formQuestionPlan.formIdB,
                        formVariantSeedA: formQuestionPlan.formVariantSeedA,
                        formVariantSeedB: formQuestionPlan.formVariantSeedB,
                        ...(isStructuralDiscoveryQuestion ? {
                            latentComparisonRole: 'shared_condition_for_form_coverage',
                            changedFactors: [],
                            changedTierIds: [],
                            focusCount: 0,
                        } : {}),
                        ...(spineGuideCondition ? {
                            spineGuideConditionId: spineGuideCondition.conditionId,
                            spineGuideRole: spineGuideCondition.role,
                            spineGuideId: spineGuideCondition.guideId,
                            spineGuideAdherence: spineGuideCondition.adherence,
                        } : {}),
                        ...(spineReferenceFamilyCondition ? {
                            spineReferenceFamilyConditionId:
                                spineReferenceFamilyCondition.conditionId,
                            spineReferenceFamilyRole: spineReferenceFamilyCondition.role,
                            spineReferenceFamilyId: spineReferenceFamilyCondition.familyId,
                            spineReferenceGuideId:
                                spineReferenceFamilyCondition.referenceGuideId,
                            spineReferenceLikeness: spineReferenceFamilyCondition.likeness,
                            spineReferenceVariationPolicyId:
                                spineReferenceFamilyCondition.variationPolicyId,
                        } : {}),
                    };
                    try {
                        trialSpecs.push(normalizeTrialSpec({
                            trialIndex: trial,
                            questionLane: questionLanePolicy.questionLane,
                            strategy: planStrategy,
                            sharedSeedApplied: sharedSeedBase,
                            seedA,
                            seedB,
                            latentA: plannedLatentA,
                            latentB: plannedLatentB,
                            formIdA: formQuestionPlan.formIdA,
                            formVariantSeedA: formQuestionPlan.formVariantSeedA,
                            formIdB: formQuestionPlan.formIdB,
                            formVariantSeedB: formQuestionPlan.formVariantSeedB,
                            context: generationContext,
                        }, {
                            index: trial,
                            spineGuide: activeSpineGuide,
                            spineReferenceFamily: activeSpineReferenceFamily,
                        }));
                    } catch (contractError) {
                        warnABController('Trial spec normalization failed; skipping malformed candidate.', contractError);
                        continue;
                    }
                }

                if (!trialSpecs.length) {
                    return {
                        selected: null,
                        admissionFailure: {
                            stage: 'trial_planning',
                            questionLane: requestedQuestionLanePolicy.questionLane,
                            plannedTrialCount: trialCount,
                            validTrialCount: 0,
                            focusFactor:
                                planningPreferenceLearningState.focusFactor,
                        },
                    };
                }
                const questionLanes = Array.from(new Set(
                    trialSpecs.map((trial) => requireSakuraABQuestionLane(trial?.questionLane)),
                ));
                if (questionLanes.length !== 1) {
                    throw createABGenerationError(
                        'ZEN_AB_QUESTION_LANE_BATCH_MIXED',
                        'Zen A/B trial batch mixed incompatible question lanes.',
                        { questionLanes },
                    );
                }
                const questionLane = questionLanes[0];
                const morphologyCoverageLane = (
                    questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
                );
                if (!isGenerationActive()) {
                    return null;
                }

                const pool = [];
                const maxSlateCandidates = Math.max(6, Math.min(18, trialCount + 4));
                const workerCandidateBatch = buildABWorkerCandidateSpecsFromTrials(trialSpecs, {
                    maxCandidates: maxSlateCandidates,
                });
                const workerExecution = await abTrialExecution.execute({
                    runWorker: async () => {
                        const abTrialWorker = getAbTrialWorker();
                        const useCandidateBatch = workerCandidateBatch.candidates.length >= 2;
                        const workerResult = await abTrialWorker.evaluateTrialBatch({
                            treeType,
                            width,
                            height,
                            topologyHeight,
                            stageProfiles: evaluationStageProfiles,
                            evaluationProfile: ZEN_AB_CANDIDATE_EVALUATION_PROFILE,
                            generationDetail: ZEN_AB_CANDIDATE_GENERATION_DETAIL,
                            objectiveMode: ZEN_AB_CANDIDATE_OBJECTIVE_MODE,
                            learningKeyspaceProfile,
                            ...(activeSpineGuide ? { spineGuide: activeSpineGuide } : {}),
                            ...(activeSpineReferenceFamily ? {
                                spineReferenceFamily: activeSpineReferenceFamily,
                            } : {}),
                            candidateMode: useCandidateBatch ? 'candidate_slate' : 'pair_trials',
                            trials: useCandidateBatch ? [] : trialSpecs,
                            candidates: useCandidateBatch ? workerCandidateBatch.candidates : [],
                        }, {
                            requestTag: generationRequestTag,
                        });
                        if (
                            !Array.isArray(workerResult?.entries)
                            || !Array.isArray(workerResult?.candidates)
                        ) {
                            throw new Error('ZEN_AB_TRIAL_WORKER_UNAVAILABLE');
                        }
                        return workerResult;
                    },
                    meta: {
                        trialCount: trialSpecs.length,
                        candidateCount: workerCandidateBatch.candidateCount,
                        roundBase: plannedRoundIndex,
                        attemptIndex,
                    },
                });
                if (!isGenerationActive()) {
                    return null;
                }
                if (!workerExecution?.ok) {
                    return {
                        strictWorkerFailure: true,
                        workerError: workerExecution?.error || null,
                        workerMode: workerExecution?.mode || null,
                    };
                }
                const workerEntries = Array.isArray(workerExecution?.result?.entries)
                    ? workerExecution.result.entries
                    : null;
                const workerCandidates = Array.isArray(workerExecution?.result?.candidates)
                    ? workerExecution.result.candidates
                    : null;

                const pushPoolEntry = (entry = null, fallbackSpec = null) => {
                    const candidateA = entry?.candidateA
                        ? { ...entry.candidateA }
                        : null;
                    const candidateB = entry?.candidateB
                        ? { ...entry.candidateB }
                        : null;
                    if (!candidateA || !candidateB) {
                        return;
                    }
                    if (
                        (!candidateA.phenotype || typeof candidateA.phenotype !== 'object')
                        && candidateA?.latent
                        && typeof candidateA.latent === 'object'
                    ) {
                        candidateA.phenotype = compileSakuraPhenotypeFromLatent(candidateA.latent);
                    }
                    if (
                        (!candidateB.phenotype || typeof candidateB.phenotype !== 'object')
                        && candidateB?.latent
                        && typeof candidateB.latent === 'object'
                    ) {
                        candidateB.phenotype = compileSakuraPhenotypeFromLatent(candidateB.latent);
                    }
                    const pair = createPair(
                        candidateA,
                        candidateB,
                        entry?.context || fallbackSpec?.context || null,
                    );
                    pair.generationContext = {
                        ...(pair.generationContext || {}),
                        sharedSeedApplied: Boolean(entry?.sharedSeedApplied ?? fallbackSpec?.sharedSeedApplied),
                        redundancy: {
                            pairCount: redundancyGuidance.diagnostics?.redundantPairs?.length || 0,
                            blockedFactors: redundancyGuidance.blockedFactorIds.slice(0, 8),
                        },
                    };
                    const strategy = entry?.strategy || fallbackSpec?.strategy || 'isolate';
                    const initialScore = scoreABPairInformativeness(pair, strategy);
                    pool.push({
                        pair,
                        strategy,
                        score: initialScore,
                    });
                };

                const trialByIndex = new Map(
                    trialSpecs.map((trial) => [Number(trial?.trialIndex), trial]),
                );
                let sourcePairReconstructionDiagnostics = null;
                if (workerEntries && workerEntries.length > 0) {
                    workerEntries.forEach((entry) => {
                        const trialIndex = Number(entry?.trialIndex);
                        pushPoolEntry(entry, trialByIndex.get(trialIndex) || null);
                    });
                } else if (workerCandidates?.length) {
                    const reconstructedSourcePairs = buildABSourcePairPoolFromEvaluatedCandidates(
                        workerCandidates,
                        { trialSpecs },
                    );
                    sourcePairReconstructionDiagnostics = reconstructedSourcePairs.diagnostics;
                    reconstructedSourcePairs.entries.forEach((entry) => {
                        pushPoolEntry(
                            entry,
                            trialByIndex.get(Number(entry?.sourceTrialIndex)) || null,
                        );
                    });
                } else {
                    throw new Error('ZEN_AB_STRUCTURAL_WORKER_EMPTY_RESULT');
                }

                const evaluatedCandidateSlate = workerCandidates?.length
                    ? buildABCandidateSlateFromEvaluatedCandidates(workerCandidates, {
                        sourcePairCount: trialSpecs.length,
                        duplicateCandidateCount: workerCandidateBatch.duplicateCount,
                        maxCandidates: maxSlateCandidates,
                    })
                    : null;

                if (!pool.length) {
                    return {
                        selected: null,
                        admissionFailure: {
                            stage: 'source_pair_reconstruction',
                            questionLane,
                            validTrialCount: trialSpecs.length,
                            workerEntryCount: workerEntries?.length || 0,
                            workerCandidateCount: workerCandidates?.length || 0,
                            sourcePairReconstruction:
                                sourcePairReconstructionDiagnostics,
                        },
                    };
                }
                if (!isGenerationActive()) {
                    return null;
                }

                const slate = evaluatedCandidateSlate?.candidateCount >= 2
                    ? evaluatedCandidateSlate
                    : buildABCandidateSlateFromPairPool(pool, {
                        maxCandidates: maxSlateCandidates,
                    });
                const isPairAdmittedForQuestionLane = (pair = null) => {
                    const context = pair?.generationContext || {};
                    if (context?.questionLane !== questionLane) {
                        return false;
                    }
                    if (questionLane === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN) {
                        return context?.pairType === 'isolation_pair'
                            && isABControlledAttributionPair(pair);
                    }
                    if (questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY) {
                        return isABStructuralDiscoveryPair(pair);
                    }
                    if (questionLane === SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START) {
                        return context?.pairType === 'sobol_cold_start'
                            && context?.coldStart === true
                            && isABControlledAttributionPair(pair);
                    }
                    return false;
                };
                const invalidLaneEntries = pool.filter((entry) => (
                    !isPairAdmittedForQuestionLane(entry?.pair)
                ));
                if (invalidLaneEntries.length) {
                    throw createABGenerationError(
                        'ZEN_AB_QUESTION_LANE_POOL_ADMISSION_FAILED',
                        'Zen A/B source pair violated its question-lane contract.',
                        {
                            questionLane,
                            invalidPairCount: invalidLaneEntries.length,
                            sourcePairCount: pool.length,
                            pairTypes: Array.from(new Set(invalidLaneEntries.map(
                                (entry) => entry?.pair?.generationContext?.pairType || null,
                            ))),
                        },
                    );
                }
                const distanceEvaluatedPool = pool.map((entry) => ({
                    ...entry,
                    structuralScreenDistance: resolveBonsaiStructuralScreenDistanceV1(
                        entry?.pair?.A?.structuralComparisonPlan,
                        entry?.pair?.B?.structuralComparisonPlan,
                        {
                            minimumVisibleDistancePx:
                                BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX,
                        },
                    ),
                }));
                const candidatePairPool = distanceEvaluatedPool.filter((entry) => (
                    entry.structuralScreenDistance.passed
                ));
                if (!candidatePairPool.length) {
                    const visibleDistances = distanceEvaluatedPool.map((entry) => (
                        Number(entry.structuralScreenDistance.visibleDistancePx || 0)
                    ));
                    return {
                        selected: null,
                        admissionFailure: {
                            stage: 'visible_distance_admission',
                            questionLane,
                            evaluatedPairCount: distanceEvaluatedPool.length,
                            admittedPairCount: 0,
                            minimumVisibleDistancePx:
                                BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX,
                            maximumVisibleDistancePx: visibleDistances.length
                                ? round(Math.max(...visibleDistances), 3)
                                : null,
                            focusFactor:
                                planningPreferenceLearningState.focusFactor,
                        },
                    };
                }
                const slateDiagnostics = {
                    enabled: true,
                    questionLane,
                    selectionMode: questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
                        ? 'structural_discovery_source_pair'
                        : questionLane === SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START
                            ? 'sobol_cold_start_source_pair'
                            : 'controlled_source_pair',
                    latticeSelectionEnabled: false,
                    latticeRetiredReason: 'source_pair_preserves_form_and_variant_attribution',
                    sourcePairCount: Number(slate?.sourcePairCount || pool.length),
                    sourceEvaluatedPairCount: pool.length,
                    admittedPairCount: candidatePairPool.length,
                    controlledPairCount: candidatePairPool.filter((entry) => (
                        isABControlledAttributionPair(entry?.pair)
                    )).length,
                    discoveryPairCount: candidatePairPool.filter((entry) => (
                        isABStructuralDiscoveryPair(entry?.pair)
                    )).length,
                    rejectedSourcePairCount: distanceEvaluatedPool.length
                        - candidatePairPool.length,
                    visibleDistanceGate: {
                        screenSpace: candidatePairPool[0].structuralScreenDistance.screenSpace,
                        minimumVisibleDistancePx: BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX,
                        evaluatedPairCount: distanceEvaluatedPool.length,
                        admittedPairCount: candidatePairPool.length,
                        rejectedPairCount: distanceEvaluatedPool.length
                            - candidatePairPool.length,
                    },
                    morphologyCoverage: planningMorphologyCoverage,
                    morphologyPreference: planningMorphologyPosteriorMeta,
                    sourcePairReconstruction: sourcePairReconstructionDiagnostics,
                    candidateCount: Number(slate?.candidateCount || 0),
                    pairCount: candidatePairPool.length,
                    duplicateCandidateCount: Number(slate?.duplicateCount || 0),
                    maxCandidates: Number(slate?.maxCandidates || 0),
                    workerCandidateMode: Boolean(evaluatedCandidateSlate?.candidateCount >= 2),
                    plannedCandidateCount: Number(workerCandidateBatch?.candidateCount || 0),
                    plannedDuplicateCandidateCount: Number(workerCandidateBatch?.duplicateCount || 0),
                };

                const scalarStats = buildScalarStats(candidatePairPool.map((entry) => Number(entry?.score?.scalarGapRaw)));
                const scalarGapFloor = Number(generationProfile.minScalarGap || 0);
                const preferenceScalarFloor = stableConfirmation
                    ? 0.02
                    : basinEstablishment
                        ? 0.035
                        : 0.055;
                const scalarGapHardFloor = morphologyCoverageLane
                    ? 0
                    : clamp(
                        Math.min(
                            preferenceScalarFloor,
                            scalarGapFloor + Number(generationProfile.pressure || 0) * 0.01,
                        ),
                        0.015,
                        0.08,
                    );
                const morphologyFloor = morphologyCoverageLane
                    ? 0
                    : clamp(
                        (stableConfirmation ? 0.025 : basinEstablishment ? 0.04 : 0.06)
                            + (Number(generationProfile.pressure || 0) * 0.025),
                        0.02,
                        0.1,
                    );
                const comparabilityFloor = clamp(
                    0.34 + (Number(generationProfile.pressure || 0) * 0.18),
                    0.34,
                    0.58,
                );
                const rescoredPool = candidatePairPool.map((entry) => {
                    const baseScore = scoreABPairInformativeness(entry.pair, entry.strategy, {
                        sessionScalarStats: scalarStats,
                    });
                    const exposure = resolveABPairExposure(entry.pair, planningPairExposureLedger);
                    const repeatPenalty = exposure.exposed
                        ? clamp(
                            0.62 - Math.min(0.42, Math.max(0, Number(exposure.age || 0)) * 0.02),
                            0.18,
                            0.62,
                        )
                        : 0;
                    const changedFactorIds = resolveChangedFactorIds(entry.pair);
                    const changedTierIds = resolveChangedTierIds(entry.pair);
                    const redundancyPenalty = changedFactorIds.length
                        ? changedFactorIds.reduce(
                            (acc, factorId) => Math.max(acc, Number(redundancyGuidance.factorPenalty?.[factorId] || 0)),
                            0,
                        )
                        : 0;
                    const redundancyBlocked = changedFactorIds.length > 0
                        && changedFactorIds.every((factorId) => redundancyGuidance.blockedFactorIds.includes(factorId));
                    const comparabilityScore = resolveSakuraPairComparabilityScore(entry.pair);
                    const expressionDiversityCredit = resolveSakuraPairExpressionDiversityCredit(
                        entry.pair,
                        planningExpressionGuidance,
                    );
                    const morphologyPreferencePrediction = (
                        planningMorphologyPosterior.compareDetailed(
                            entry.pair.A,
                            entry.pair.B,
                        )
                    );
                    const morphologyPreferenceUncertainty = clamp01(
                        1 - (Math.abs(
                            Number(morphologyPreferencePrediction.probabilityA) - 0.5,
                        ) * 2),
                    );
                    const complexityPenalty = Math.max(
                        0,
                        (Math.max(0, changedFactorIds.length - 4) * 0.06)
                        + (Math.max(0, changedTierIds.length - 2) * 0.09),
                    );
                    const clarityScore = clamp01(
                        (Number(baseScore?.scalarGapRaw || 0) * 1.6)
                        + (Number(baseScore?.morphologySpan || 0) * 0.8)
                        + (Number(baseScore?.backboneSpan || 0) * 0.95)
                        + (Number(baseScore?.neuralGap || 0) * 0.6),
                    );
                    const gapPenalty = Math.max(
                        0,
                        scalarGapHardFloor - Number(baseScore?.scalarGapRaw || 0),
                    );
                    const morphologyPenalty = Math.max(
                        0,
                        morphologyFloor - Number(baseScore?.morphologySpan || 0),
                    );
                    const acquisitionScore = scoreABPairAcquisition({
                        baseInfoScore: clamp01(
                            Number(baseScore?.infoScore || 0)
                            + (morphologyPreferenceUncertainty * 0.08),
                        ),
                        comparabilityScore,
                        expressionDiversityCredit,
                        clarityScore,
                        generationPressure: Number(generationProfile.pressure || 0),
                        gapPenalty,
                        morphologyPenalty,
                        complexityPenalty,
                        redundancyPenalty,
                        redundancyPenaltyScale: Number(redundancyGuidance?.tuning?.penaltyScale || 0.22),
                        repeatPenalty,
                    });
                    return {
                        ...entry,
                        score: {
                            ...baseScore,
                            clarityScore: round(clarityScore, 4),
                            changedFactorIds,
                            changedTierIds,
                            comparabilityScore: round(comparabilityScore, 4),
                            expressionDiversityCredit: round(expressionDiversityCredit, 4),
                            redundancyPenalty: round(redundancyPenalty, 4),
                            redundancyBlocked,
                            pairSignature: exposure.signature,
                            recentPairRepeat: Boolean(exposure.exposed),
                            recentPairAge: Number.isFinite(Number(exposure.age))
                                ? Math.max(0, Math.floor(Number(exposure.age)))
                                : null,
                            repeatPenalty: round(repeatPenalty, 4),
                            scalarGapHardFloor: round(scalarGapHardFloor, 4),
                            morphologyFloor: round(morphologyFloor, 4),
                            comparabilityFloor: round(comparabilityFloor, 4),
                            morphologyPenalty: round(morphologyPenalty, 4),
                            complexityPenalty: round(complexityPenalty, 4),
                            structuralScreenDistance: entry.structuralScreenDistance,
                            visibleDistancePx: entry.structuralScreenDistance.visibleDistancePx,
                            morphologyPreferencePrediction,
                            morphologyPreferenceUncertainty: round(
                                morphologyPreferenceUncertainty,
                                4,
                            ),
                            acquisitionScore: round(acquisitionScore, 4),
                            qualityAdjustedInfo: round(acquisitionScore, 4),
                        },
                    };
                });
                const thompsonPairing = pickDuelingThompsonCandidates({
                    pool: rescoredPool,
                    pairwiseBrain,
                });
                slateDiagnostics.duelingThompsonCandidateAvailable = Boolean(
                    thompsonPairing?.best && thompsonPairing?.challenger,
                );
                slateDiagnostics.duelingThompsonSummary = thompsonPairing?.summary || null;

                rescoredPool.sort((left, right) => {
                    const leftQualityInfo = Number(left.score.qualityAdjustedInfo ?? left.score.infoScore ?? 0);
                    const rightQualityInfo = Number(right.score.qualityAdjustedInfo ?? right.score.infoScore ?? 0);
                    if (rightQualityInfo !== leftQualityInfo) {
                        return rightQualityInfo - leftQualityInfo;
                    }
                    const leftOrderConflict = Number(left.score.orderConflict || 0);
                    const rightOrderConflict = Number(right.score.orderConflict || 0);
                    if (leftOrderConflict !== rightOrderConflict) {
                        return leftOrderConflict - rightOrderConflict;
                    }
                    const leftDisagreement = Number(left.score.disagreement || 0);
                    const rightDisagreement = Number(right.score.disagreement || 0);
                    if (leftDisagreement !== rightDisagreement) {
                        return leftDisagreement - rightDisagreement;
                    }
                    if (right.score.scalarGapRaw !== left.score.scalarGapRaw) {
                        return right.score.scalarGapRaw - left.score.scalarGapRaw;
                    }
                    if (right.score.comparabilityScore !== left.score.comparabilityScore) {
                        return right.score.comparabilityScore - left.score.comparabilityScore;
                    }
                    if (right.score.morphologySpan !== left.score.morphologySpan) {
                        return right.score.morphologySpan - left.score.morphologySpan;
                    }
                    if (left.score.redundancyPenalty !== right.score.redundancyPenalty) {
                        return left.score.redundancyPenalty - right.score.redundancyPenalty;
                    }
                    return 0;
                });

                const gapFilteredPool = rescoredPool.filter((entry) => (
                    Number(entry?.score?.scalarGapRaw || 0) >= scalarGapHardFloor
                ));
                const morphologyFilteredPool = gapFilteredPool.filter((entry) => (
                    Number(entry?.score?.morphologySpan || 0) >= morphologyFloor
                ));
                const redundancyFilteredPool = morphologyFilteredPool.filter((entry) => !entry?.score?.redundancyBlocked);
                const comparabilityFilteredPool = redundancyFilteredPool.filter((entry) => (
                    Number(entry?.score?.comparabilityScore || 0) >= comparabilityFloor
                ));
                const repeatFilteredPool = comparabilityFilteredPool.filter((entry) => (
                    !entry?.score?.recentPairRepeat
                ));
                const finalistSource = comparabilityFilteredPool.length
                    ? (repeatFilteredPool.length ? repeatFilteredPool : comparabilityFilteredPool)
                    : (redundancyFilteredPool.length
                        ? redundancyFilteredPool
                        : (morphologyFilteredPool.length
                            ? morphologyFilteredPool
                            : (gapFilteredPool.length ? gapFilteredPool : rescoredPool)));
                const finalistPool = finalistSource
                    .slice()
                    .sort((left, right) => (
                        Number(right?.score?.expressionDiversityCredit || 0)
                        - Number(left?.score?.expressionDiversityCredit || 0)
                    ))
                    .slice(0, Math.min(4, finalistSource.length))
                    .sort((left, right) => (
                        Number(right?.score?.qualityAdjustedInfo ?? right?.score?.infoScore ?? 0)
                        - Number(left?.score?.qualityAdjustedInfo ?? left?.score?.infoScore ?? 0)
                    ))
                    .slice(0, Math.min(3, finalistSource.length));
                const selectedIndex = generationProfile.preferTopCandidate
                    ? 0
                    : Math.floor(Math.random() * Math.min(2, finalistPool.length));
                const selected = finalistPool[selectedIndex] || rescoredPool[0];
                if (!isGenerationActive()) {
                    return null;
                }

                return {
                    questionLane,
                    rescoredPool,
                    finalistPool,
                    selectedIndex,
                    selected,
                    slateDiagnostics,
                    scalarGapHardFloor,
                    morphologyFloor,
                    comparabilityFloor,
                };
            };

            let selectedAttempt = null;
            let workerStrictFailure = false;
            let workerStrictFailureError = null;
            let workerStrictFailureMode = null;
            let qualityAutoPassCount = 0;
            const qualityAutoPassEvents = [];
            const selectionAttemptDiagnostics = [];
            for (let attemptIndex = 0; attemptIndex <= qualityRetryLimit; attemptIndex += 1) {
                if (!isGenerationActive()) {
                    return false;
                }
                const attempt = await scoreAttemptPool(attemptIndex);
                if (!isGenerationActive()) {
                    return false;
                }
                if (attempt?.strictWorkerFailure) {
                    workerStrictFailure = true;
                    workerStrictFailureError = attempt?.workerError instanceof Error
                        ? attempt.workerError
                        : null;
                    workerStrictFailureMode = typeof attempt?.workerMode === 'string'
                        ? attempt.workerMode
                        : null;
                    break;
                }
                if (!attempt?.selected) {
                    if (attempt?.admissionFailure) {
                        selectionAttemptDiagnostics.push({
                            attemptIndex,
                            ...attempt.admissionFailure,
                        });
                    }
                    continue;
                }
                const selectedInfo = Number(attempt?.selected?.score?.qualityAdjustedInfo ?? attempt?.selected?.score?.infoScore ?? 0);
                const selectedScalarGap = Number(attempt?.selected?.score?.scalarGapRaw || 0);
                const selectedMorphology = Number(attempt?.selected?.score?.morphologySpan || 0);
                const selectedComparability = Number(attempt?.selected?.score?.comparabilityScore || 0);
                const selectedClarity = Number(attempt?.selected?.score?.clarityScore || 0);
                const qualitySafe = (
                    selectedInfo >= qualityInfoFloor
                    && selectedScalarGap >= Number(attempt?.scalarGapHardFloor || 0)
                    && selectedMorphology >= Number(attempt?.morphologyFloor || 0)
                    && selectedComparability >= Number(attempt?.comparabilityFloor || 0)
                    && selectedClarity >= qualityClarityFloor
                );
                selectedAttempt = {
                    ...attempt,
                    attemptIndex,
                    qualitySafe,
                    selectedInfo,
                    selectedScalarGap,
                    selectedMorphology,
                    selectedComparability,
                    selectedClarity,
                };
                if (qualitySafe || attemptIndex >= qualityRetryLimit) {
                    break;
                }

                qualityAutoPassCount += 1;
                qualityAutoPassEvents.push({
                    infoScore: selectedInfo,
                    scalarGapRaw: selectedScalarGap,
                });
            }
            if (!isGenerationActive()) {
                return false;
            }
            if (workerStrictFailure) {
                throw createABGenerationError(
                    'ZEN_AB_GENERATION_STRICT_WORKER_FAILURE',
                    'Zen A/B generation failed because the strict worker path did not produce a result.',
                    {
                        treeType,
                        roundBase: plannedRoundIndex,
                        pressure: round(Number(generationProfile.pressure || 0), 4),
                        workerMode: workerStrictFailureMode,
                        workerErrorCode: workerStrictFailureError?.code || null,
                    },
                    workerStrictFailureError,
                );
            }

            qualityAutoPassEvents.forEach((event) => {
                updateQuestionQuality({
                    decision: 'pass',
                    queryKind: SPECIAL_QUERY.PAIRWISE,
                    infoScore: event.infoScore,
                    scalarGapRaw: event.scalarGapRaw,
                    reactionMs: 0,
                    timestamp: Date.now(),
                });
            });

            if (!selectedAttempt?.selected) {
                throw createABGenerationError(
                    'ZEN_AB_GENERATION_NO_SELECTED_PAIR',
                    'Zen A/B generation failed because no canonical comparison pair survived selection.',
                    {
                        treeType,
                        roundBase: plannedRoundIndex,
                        qualityRetryLimit,
                        pressure: round(Number(generationProfile.pressure || 0), 4),
                        questionLane: requestedQuestionLanePolicy.questionLane,
                        focusFactor: planningPreferenceLearningState.focusFactor,
                        attempts: selectionAttemptDiagnostics,
                    },
                );
            }

            const rescoredPool = selectedAttempt.rescoredPool;
            const finalistPool = selectedAttempt.finalistPool;
            const selectedIndex = selectedAttempt.selectedIndex;
            const selected = selectedAttempt.selected;
            const selectedPair = selected.pair;
            const questionLane = requireSakuraABQuestionLane(selectedAttempt.questionLane);
            const selectedQualitySafe = Boolean(selectedAttempt.qualitySafe);
            const nextRoundIndex = schedulerBaseRoundCount + 1;
            const qualityContext = {
                questionLane,
                stage: generationProfile.stage,
                pressure: round(generationProfile.pressure, 3),
                minScalarGap: round(generationProfile.minScalarGap, 4),
                qualityGate: {
                    enabled: true,
                    infoFloor: round(qualityInfoFloor, 4),
                    clarityFloor: round(qualityClarityFloor, 4),
                    comparabilityFloor: round(Number(selectedAttempt?.comparabilityFloor || 0), 4),
                    retryLimit: qualityRetryLimit,
                    retriesUsed: selectedAttempt.attemptIndex,
                    autoPasses: qualityAutoPassCount,
                    passed: selectedQualitySafe,
                },
                forceIsolation: questionLane === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN,
                disableSpecial: Boolean(generationProfile.disableSpecial),
                redundancy: {
                    pairCount: redundancyGuidance.diagnostics?.redundantPairs?.length || 0,
                    blockedFactorCount: redundancyGuidance.blockedFactorIds.length,
                    blockedFactors: redundancyGuidance.blockedFactorIds.slice(0, 4),
                    recentPairRepeatCount: rescoredPool.filter((entry) => entry?.score?.recentPairRepeat).length,
                    exposureWindowSize: planningPairExposureLedger.windowSize,
                    slate: selectedAttempt.slateDiagnostics,
                    tuning: {
                        similarityThreshold: Number(redundancyGuidance?.tuning?.similarityThreshold || 0),
                        blockThreshold: Number(redundancyGuidance?.tuning?.blockThreshold || 0),
                        penaltyScale: Number(redundancyGuidance?.tuning?.penaltyScale || 0),
                    },
                },
                expression: {
                    underexploredTiers: (planningExpressionGuidance?.underexploredTierIds || []).slice(0, 3),
                    tierCounts: planningExpressionGuidance?.tierCounts || {},
                },
                learningObjectives: {
                    active: questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
                        ? 'morphology_coverage'
                        : 'latent_and_morphology_preference',
                    morphologyEvidenceCount: planningMorphologyCoverage.evidenceCount,
                    proposalEvidenceCount: planningMorphologyCoverage.proposalAdmittedCount,
                    proposalFormCounts: planningMorphologyCoverage.proposalCounts,
                    proposalCoverageRatio:
                        planningMorphologyCoverage.proposalCoverageRatio,
                    proposalNormalizedEntropy:
                        planningMorphologyCoverage.proposalNormalizedEntropy,
                    realizedPrimaryEvidenceCount:
                        planningMorphologyCoverage.realizedPrimaryAdmittedCount,
                    realizedPrimaryUnclassifiedCount:
                        planningMorphologyCoverage.realizedPrimaryUnclassifiedCount,
                    realizedPrimaryUnsupportedCount:
                        planningMorphologyCoverage.realizedPrimaryUnsupportedCount,
                    realizedPrimaryFormCounts:
                        planningMorphologyCoverage.realizedPrimaryCounts,
                    realizedPrimaryCoverageRatio:
                        planningMorphologyCoverage.realizedPrimaryCoverageRatio,
                    realizedPrimaryNormalizedEntropy:
                        planningMorphologyCoverage.realizedPrimaryNormalizedEntropy,
                    realizedMembershipEvidenceCount:
                        planningMorphologyCoverage.realizedMembershipEvidenceCount,
                    realizedMembershipHitCount:
                        planningMorphologyCoverage.realizedMembershipHitCount,
                    realizedMembershipFormCounts:
                        planningMorphologyCoverage.realizedMembershipCounts,
                    realizedMembershipCoverageRatio:
                        planningMorphologyCoverage.realizedMembershipCoverageRatio,
                    realizedMembershipNormalizedEntropy:
                        planningMorphologyCoverage.realizedMembershipNormalizedEntropy,
                    targetAcceptanceEligibleCount:
                        planningMorphologyCoverage.targetAcceptanceEligibleCount,
                    targetAcceptanceAcceptedCount:
                        planningMorphologyCoverage.targetAcceptanceAcceptedCount,
                    targetAcceptanceRate:
                        planningMorphologyCoverage.targetAcceptanceRate,
                    perFormTargetAcceptance:
                        planningMorphologyCoverage.perFormTargetAcceptance,
                    globalPreferenceConfidence:
                        planningMorphologyPosteriorMeta.globalConfidence,
                    perFormPreferenceConfidence:
                        planningMorphologyPosteriorMeta.perFormConfidence,
                    morphologyPreferenceAdmissibility:
                        planningMorphologyPosteriorMeta.admissibility,
                    morphologyPreferenceCalibration:
                        planningMorphologyPosteriorMeta.calibration,
                    minimumVisibleDistancePx:
                        BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX,
                },
                preferenceLearning: planningPreferenceLearningState,
            };
            const specialEnabled = (
                nextRoundIndex >= minSpecialRound
                && !options.disableSpecial
                && !generationProfile.disableSpecial
                && questionLane !== SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
            );
            const wantsAnchor = specialEnabled && nextRoundIndex % anchorInterval === 0;
            const wantsBestWorst = specialEnabled && !wantsAnchor && nextRoundIndex % bestWorstInterval === 0;
            if (!isGenerationActive()) {
                return false;
            }

            if (wantsAnchor) {
                const shouldRefreshAnchor = (
                    !anchorPairRef.current?.pair
                    || (
                        anchorStatsRef.current.total >= 6
                        && anchorStatsRef.current.consistency < 0.55
                    )
                );
                if (shouldRefreshAnchor) {
                    const anchorSeedPair = clonePair(finalistPool[0]?.pair || rescoredPool[0]?.pair);
                    const hydratedAnchorSeedPair = hydratePairTopology(anchorSeedPair);
                    anchorPairRef.current = {
                        id: `anchor_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                        createdAtRound: nextRoundIndex,
                        pair: hydratedAnchorSeedPair,
                        selection: finalistPool[0]?.score || rescoredPool[0]?.score || null,
                    };
                    resetAnchorStats();
                }
                const anchorBase = clonePair(anchorPairRef.current.pair);
                const anchorPair = {
                    ...anchorBase,
                    generationContext: {
                        ...(anchorBase.generationContext || {}),
                        mode: 'learn_mode',
                        queryKind: SPECIAL_QUERY.ANCHOR,
                        decisionMode: DECISION_MODE.BETTER,
                        queryWeight: round(0.48 * specialStrength, 3),
                        prompt: 'calibration_anchor',
                        anchorId: anchorPairRef.current.id,
                        scheduler: {
                            bestWorstInterval,
                            anchorInterval,
                            specialStrength,
                        },
                        selection: {
                            ...(anchorPairRef.current.selection || {}),
                            anchorConsistency: round(anchorStatsRef.current.consistency, 4),
                        },
                        questionQuality: qualityContext,
                    },
                };
                if (!isGenerationActive()) {
                    return false;
                }
                setAbPair(anchorPair);
                return true;
            }

            if (wantsBestWorst && rescoredPool.length >= 2) {
                const primary = finalistPool[0] || rescoredPool[0];
                const secondary = finalistPool[1] || rescoredPool[1];
                const cycleId = `bw_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                const firstPairBase = hydratePairTopology(clonePair(primary.pair));
                const secondPairBase = hydratePairTopology(clonePair(secondary.pair));
                const firstPair = {
                    ...firstPairBase,
                    generationContext: {
                        ...(firstPairBase.generationContext || {}),
                        mode: 'learn_mode',
                        queryKind: SPECIAL_QUERY.BEST_WORST,
                        bwStage: 'best',
                        bwCycleId: cycleId,
                        decisionMode: DECISION_MODE.BETTER,
                        queryWeight: round(1.06 * specialStrength, 3),
                        prompt: 'pick_best',
                        scheduler: {
                            bestWorstInterval,
                            anchorInterval,
                            specialStrength,
                        },
                        selection: {
                            mode: 'active_bw',
                            poolSize: rescoredPool.length,
                            finalistSize: finalistPool.length,
                            chosenFinalistIndex: 0,
                            ...primary.score,
                        },
                        questionQuality: qualityContext,
                        nextStage: {
                            pair: secondPairBase,
                            selection: {
                                mode: 'active_bw_followup',
                                poolSize: rescoredPool.length,
                                finalistSize: finalistPool.length,
                                chosenFinalistIndex: 1,
                                ...secondary.score,
                            },
                        },
                    },
                };
                if (!isGenerationActive()) {
                    return false;
                }
                appendGeneratedSamples(firstPair);
                setAbPair(firstPair);
                return true;
            }

            const pair = hydratePairTopology({
                ...selectedPair,
                generationContext: {
                    ...(selectedPair.generationContext || {}),
                    queryKind: SPECIAL_QUERY.PAIRWISE,
                    decisionMode: DECISION_MODE.BETTER,
                    queryWeight: 1,
                    scheduler: {
                        bestWorstInterval,
                        anchorInterval,
                        specialStrength,
                    },
                    selection: {
                        mode: 'active_ab',
                        poolSize: rescoredPool.length,
                        finalistSize: finalistPool.length,
                        chosenFinalistIndex: selectedIndex,
                        ...selected.score,
                    },
                    questionQuality: qualityContext,
                },
            });
            if (!isGenerationActive()) {
                return false;
            }
            appendGeneratedSamples(pair);
            setAbPair(pair);
            return true;
        } catch (error) {
            if (!isGenerationActive()) {
                return false;
            }
            clearRetryGenerationTimer();
            setAbPair(null);
            surfaceGenerationError(error, {
                code: 'ZEN_AB_GENERATION_FAILED',
                message: 'Zen A/B generation failed.',
                details: {
                    treeType,
                    roundBase: plannedRoundIndex,
                },
            });
            return false;
        } finally {
            if (generationStateRef.current.ticket === generationTicket) {
                generationStateRef.current = {
                    ticket: generationTicket,
                    requestTag: null,
                };
                generatingABRef.current = false;
                setIsGenerating(false);
            }
        }
    }, [
        width,
        height,
        enableAbGeneration,
        abRoundCount,
        redundancyTuning,
        abExplorationIntensity,
        currentPhenotype,
        currentLatent,
        activeSpineGuide,
        spineGuideCondition,
        activeSpineReferenceFamily,
        spineReferenceFamilyCondition,
        treeType,
        scoreABPairInformativeness,
        brain,
        pairwiseBrain,
        evaluationStageProfiles,
        topologyHeight,
        appendGeneratedSamples,
        updateQuestionQuality,
        resetAnchorStats,
        bestWorstInterval,
        anchorInterval,
        minSpecialRound,
        specialStrength,
        learningKeyspaceProfile,
        workerFallbackPolicy,
        abPlanReady,
        buildV2Plan,
        getAbTrialWorker,
        abTrialExecution,
        scheduleModelPersistSync,
        hydratePairTopology,
        clearGenerationError,
        clearRetryGenerationTimer,
        surfaceGenerationError,
    ]);

    const advanceAfterRound = useCallback(async (nextRoundCount) => {
        setAbRoundCount(nextRoundCount);
        const created = await generateABPair({ roundBase: nextRoundCount });
        if (!created) {
            setAbPair(null);
        }
    }, [generateABPair]);

    const {
        chooseABCandidate,
        handleABBothGood,
        handleABPass,
    } = useZenABFeedbackHandlers({
        abPair,
        abRoundCount,
        isGenerating,
        collectCandidate,
        treeType,
        trainCandidate,
        trainPairwisePreference,
        pairwiseBrain,
        setFactorTraceLog,
        setAbHistory: setAbHistorySynchronous,
        generateABPair,
        flushLearningModels,
        calibrationWeight,
        sessionCalibration,
        appendGeneratedSamples,
        updateAnchorCalibration,
        updateQuestionQuality,
        onABResolved,
        bestWorstInterval,
        anchorInterval,
        specialStrength,
        setAbPair,
        setAbRoundCount,
        advanceAfterRound,
    });

    useEffect(() => {
        if (spineGuideConditionKeyRef.current === spineGuideConditionKey) {
            return;
        }
        spineGuideConditionKeyRef.current = spineGuideConditionKey;
        anchorPairRef.current = null;
        cancelActiveGeneration('ZEN_AB_SPINE_GUIDE_CHANGED', {
            hard: true,
        });
        setAbPair(null);
        clearGenerationError();
    }, [
        spineGuideConditionKey,
        cancelActiveGeneration,
        clearGenerationError,
    ]);

    useEffect(() => {
        if (
            spineReferenceFamilyConditionKeyRef.current
            === spineReferenceFamilyConditionKey
        ) {
            return;
        }
        spineReferenceFamilyConditionKeyRef.current = spineReferenceFamilyConditionKey;
        anchorPairRef.current = null;
        cancelActiveGeneration('ZEN_AB_SPINE_REFERENCE_FAMILY_CHANGED', {
            hard: true,
        });
        setAbPair(null);
        clearGenerationError();
    }, [
        spineReferenceFamilyConditionKey,
        cancelActiveGeneration,
        clearGenerationError,
    ]);

    useEffect(() => {
        if (!enableAbGeneration || !width || !height) {
            cancelActiveGeneration('ZEN_AB_GENERATION_PAUSED', {
                hard: true,
            });
            return;
        }

        if (!abPair && !generatingABRef.current && abPlanReady) {
            void generateABPair().then((created) => {
                if (
                    created
                    || generationErrorRef.current
                    || !enableAbGeneration
                    || !abPlanReady
                ) {
                    return;
                }
                if (retryGenerationTimerRef.current || generatingABRef.current) {
                    return;
                }
                retryGenerationTimerRef.current = setTimeout(() => {
                    retryGenerationTimerRef.current = null;
                    if (
                        enableAbGeneration
                        && abPlanReady
                        && !generationErrorRef.current
                        && !generatingABRef.current
                    ) {
                        void generateABPair();
                    }
                }, 180);
            }).catch(() => {
                if (generationErrorRef.current) {
                    return;
                }
                if (retryGenerationTimerRef.current || generatingABRef.current) {
                    return;
                }
                retryGenerationTimerRef.current = setTimeout(() => {
                    retryGenerationTimerRef.current = null;
                    if (
                        enableAbGeneration
                        && abPlanReady
                        && !generationErrorRef.current
                        && !generatingABRef.current
                    ) {
                        void generateABPair();
                    }
                }, 220);
            });
            return;
        }

        if (abPair) {
            clearRetryGenerationTimer();
        }
    }, [
        enableAbGeneration,
        width,
        height,
        abRoundCount,
        abPair,
        abPlanReady,
        generateABPair,
        cancelActiveGeneration,
        clearRetryGenerationTimer,
    ]);

    useEffect(() => {
        if (enableAbGeneration && isCollectionMode) {
            return;
        }
        cancelActiveGeneration('ZEN_AB_COLLECTION_MODE_DISABLED', {
            hard: true,
        });
        setAbPair(null);
        clearGenerationError();
        disposeAbTrialWorker();
    }, [enableAbGeneration, isCollectionMode, cancelActiveGeneration, clearGenerationError, disposeAbTrialWorker]);

    return {
        abPair,
        setAbPair,
        isGenerating,
        abRoundCount,
        setAbRoundCount,
        generationError,
        generateABPair,
        chooseABCandidate,
        handleABBothGood,
        handleABPass,
        sessionCalibration,
        questionQuality,
    };
}
