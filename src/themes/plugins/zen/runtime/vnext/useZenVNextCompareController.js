import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getDefaultFactorVectorV2,
    normalizeFactorVectorV2,
    normalizeVNextOptimizationResult,
    resolveVNextActiveComparePair,
    runZenBonsaiEngineVNextWithAnalysis,
} from '../../model/vnext/index.js';
import { createZenUiErrorState } from '../zenUiErrorState.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const createCompareEpisodeId = () => (
    `vnext_ep_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
);

const createZenVNextCompareControllerError = (
    code = 'ZEN_VNEXT_COMPARE_CONTROLLER_INVALID',
    message = 'Zen VNEXT compare controller state is invalid.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

const requireCanonicalVNextOptimizationResult = (result, phase = 'optimize') => {
    try {
        return normalizeVNextOptimizationResult(result);
    } catch (error) {
        throw createZenVNextCompareControllerError(
            error?.code || 'ZEN_VNEXT_COMPARE_OPTIMIZATION_RESULT_INVALID',
            error?.message || `VNext ${phase} requires a canonical optimization result.`,
            {
                phase,
            },
            error,
        );
    }
};

export function useZenVNextCompareController({
    seed,
    factors,
    reliabilityHint,
    preferenceModel,
    autoCompareMaxRounds,
    setAutoCompareMaxRounds,
    autoCompareStopReliability,
    comparePair,
    setComparePair,
    setSeed,
    setFactors,
    setReliabilityHint,
    setLatestOptimization,
    setAbTrialCount,
    setReliabilityState,
    setErrorState,
    setLoopActionMessage,
    workerClient,
    feedbackStore,
    resolvePreferenceProfile,
    trainPreferenceModel,
    constraints,
    options,
} = {}) {
    const [isPreparingCompare, setIsPreparingCompare] = useState(false);
    const [isSubmittingCompare, setIsSubmittingCompare] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizeProgress, setOptimizeProgress] = useState(0);
    const [isAutoCompareRunning, setIsAutoCompareRunning] = useState(false);
    const [autoCompareEpisodeId, setAutoCompareEpisodeId] = useState('');
    const [autoCompareRound, setAutoCompareRound] = useState(0);
    const [autoCompareCompleted, setAutoCompareCompleted] = useState(0);
    const autoCompareSessionRef = useRef({
        running: false,
        episodeId: '',
        nextRound: 0,
        completed: 0,
        maxRounds: 0,
    });
    const optimizeProgressTimerRef = useRef(null);
    const mountedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            autoCompareSessionRef.current.running = false;
            if (optimizeProgressTimerRef.current) {
                clearTimeout(optimizeProgressTimerRef.current);
                optimizeProgressTimerRef.current = null;
            }
        };
    }, []);

    const setSafeErrorState = useCallback((value) => {
        if (mountedRef.current && typeof setErrorState === 'function') {
            setErrorState(value);
        }
    }, [setErrorState]);

    const setSafeLoopActionMessage = useCallback((value) => {
        if (mountedRef.current && typeof setLoopActionMessage === 'function') {
            setLoopActionMessage(value);
        }
    }, [setLoopActionMessage]);

    const handleOptimize = useCallback(async () => {
        if (isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning) {
            return;
        }
        setIsOptimizing(true);
        setOptimizeProgress(0);
        setSafeErrorState(null);
        setComparePair(null);
        try {
            const payload = {
                engineMode: 'vnext',
                seed,
                baseFactors: factors,
                preferenceProfile: resolvePreferenceProfile(),
                preferenceModel: preferenceModel || undefined,
                reliabilityHint,
                populationSize: 16,
                generations: 4,
                eliteCount: 4,
                mutationIntensity: 0.14,
                constraints,
                options,
            };
            const optimized = await workerClient.optimize(payload, {
                onProgress: (value) => {
                    if (mountedRef.current) {
                        setOptimizeProgress(clamp01(value));
                    }
                },
            });
            if (!mountedRef.current) return;
            const nextResult = requireCanonicalVNextOptimizationResult(optimized, 'optimize');
            setLatestOptimization(nextResult);
            const candidate = nextResult.recommendedCandidate;
            if (!Number.isFinite(Number(candidate?.seed))) {
                throw createZenVNextCompareControllerError(
                    'ZEN_VNEXT_COMPARE_RECOMMENDED_CANDIDATE_INVALID',
                    'VNext optimize requires a canonical recommended candidate seed.',
                    {
                        phase: 'optimize',
                    },
                );
            }
            const nextSeed = Math.floor(Number(candidate.seed));
            const nextFactors = normalizeFactorVectorV2(candidate?.factors || {});
            setSeed(nextSeed);
            setFactors(nextFactors);
            setOptimizeProgress(1);
        } catch (error) {
            if (!mountedRef.current) return;
            setSafeErrorState(createZenUiErrorState(error, {
                fallbackCode: 'ZEN_VNEXT_OPTIMIZE_ERROR',
                fallbackMessage: 'VNext optimize failed.',
                details: {
                    phase: 'optimize',
                },
            }));
        } finally {
            if (!mountedRef.current) return;
            setIsOptimizing(false);
            if (optimizeProgressTimerRef.current) {
                clearTimeout(optimizeProgressTimerRef.current);
            }
            optimizeProgressTimerRef.current = setTimeout(() => {
                optimizeProgressTimerRef.current = null;
                if (mountedRef.current) {
                    setOptimizeProgress(0);
                }
            }, 200);
        }
    }, [
        constraints,
        factors,
        isAutoCompareRunning,
        isOptimizing,
        isPreparingCompare,
        isSubmittingCompare,
        options,
        preferenceModel,
        reliabilityHint,
        resolvePreferenceProfile,
        seed,
        setComparePair,
        setFactors,
        setLatestOptimization,
        setSafeErrorState,
        setSeed,
        workerClient,
    ]);

    const prepareComparePair = useCallback(async ({
        entry = 'manual',
        episodeId = null,
        roundId = null,
        allowWhileSubmitting = false,
    } = {}) => {
        if (isOptimizing || isPreparingCompare || (!allowWhileSubmitting && isSubmittingCompare)) {
            return null;
        }
        setIsPreparingCompare(true);
        setSafeErrorState(null);
        try {
            const payload = {
                engineMode: 'vnext',
                seed,
                baseFactors: factors,
                preferenceProfile: resolvePreferenceProfile(),
                preferenceModel: preferenceModel || undefined,
                reliabilityHint,
                populationSize: 12,
                generations: 3,
                eliteCount: 3,
                mutationIntensity: 0.14,
                constraints,
                options,
            };
            const [optimized, feedbackTrials] = await Promise.all([
                workerClient.optimize(payload),
                feedbackStore.listTrials(),
            ]);
            if (!mountedRef.current) return null;
            const nextResult = requireCanonicalVNextOptimizationResult(optimized, 'prepare_compare');
            setLatestOptimization(nextResult);
            const pair = resolveVNextActiveComparePair({
                optimization: nextResult,
                feedbackTrials,
                preferenceModel: preferenceModel || null,
            });
            if (!pair?.candidateA || !pair?.candidateB) {
                throw createZenVNextCompareControllerError(
                    'ZEN_VNEXT_COMPARE_SELECTION_FAILED',
                    'VNext compare selection failed.',
                    {
                        phase: 'prepare_compare',
                    },
                );
            }
            const outputA = runZenBonsaiEngineVNextWithAnalysis({
                seed: pair.candidateA.seed,
                factors: pair.candidateA.factors,
                constraints,
                options,
            });
            const outputB = runZenBonsaiEngineVNextWithAnalysis({
                seed: pair.candidateB.seed,
                factors: pair.candidateB.factors,
                constraints,
                options,
            });
            const resolvedRound = Number.isFinite(Number(roundId))
                ? Math.max(1, Math.floor(Number(roundId)))
                : null;
            const meta = {
                entry: entry === 'auto' ? 'auto' : 'manual',
                episodeId: typeof episodeId === 'string' && episodeId.trim() ? episodeId.trim() : null,
                roundId: resolvedRound,
                createdAt: Date.now(),
                reliabilityHintAtPrepare: clamp01(reliabilityHint),
                modelSampleCount: Math.max(0, Math.floor(Number(preferenceModel?.sampleCount || 0))),
                modelAccuracy: clamp01(Number(preferenceModel?.metrics?.accuracy || 0)),
                selectionStrategy: typeof pair?.diagnostics?.strategy === 'string'
                    ? pair.diagnostics.strategy
                    : 'unknown',
                selectionTopFactors: Array.isArray(pair?.diagnostics?.topFactors)
                    ? pair.diagnostics.topFactors.map((entry) => entry?.key).filter(Boolean).slice(0, 4)
                    : [],
                selectionFocusFactors: Array.isArray(pair?.diagnostics?.focusFactors)
                    ? pair.diagnostics.focusFactors.map((entry) => entry?.key).filter(Boolean).slice(0, 4)
                    : [],
                selectionPredictedMargin: toNumber(pair?.diagnostics?.predictedMargin, 0),
                selectionUncertainty: toNumber(pair?.diagnostics?.uncertainty, 0),
                selectionWeightedContrast: toNumber(pair?.diagnostics?.weightedContrast, 0),
                selectionIsolation: toNumber(pair?.diagnostics?.isolation, 0),
            };
            setComparePair({
                candidateA: pair.candidateA,
                candidateB: pair.candidateB,
                outputA,
                outputB,
                meta,
            });
            return {
                pair,
                meta,
            };
        } catch (error) {
            if (!mountedRef.current) return null;
            setSafeErrorState(createZenUiErrorState(error, {
                fallbackCode: 'ZEN_VNEXT_COMPARE_PREPARE_ERROR',
                fallbackMessage: 'VNext compare preparation failed.',
                details: {
                    phase: 'prepare_compare',
                },
            }));
            return null;
        } finally {
            if (mountedRef.current) {
                setIsPreparingCompare(false);
            }
        }
    }, [
        constraints,
        factors,
        feedbackStore,
        isOptimizing,
        isPreparingCompare,
        isSubmittingCompare,
        options,
        preferenceModel,
        reliabilityHint,
        resolvePreferenceProfile,
        seed,
        setComparePair,
        setLatestOptimization,
        setSafeErrorState,
        workerClient,
    ]);

    const handlePrepareCompare = useCallback(async () => {
        if (isAutoCompareRunning) {
            return;
        }
        await prepareComparePair({
            entry: 'manual',
        });
    }, [isAutoCompareRunning, prepareComparePair]);

    const stopAutoCompareSession = useCallback((message = 'Auto A/B stopped.') => {
        autoCompareSessionRef.current = {
            running: false,
            episodeId: '',
            nextRound: 0,
            completed: 0,
            maxRounds: 0,
        };
        if (!mountedRef.current) return;
        setIsAutoCompareRunning(false);
        setAutoCompareEpisodeId('');
        setAutoCompareRound(0);
        setAutoCompareCompleted(0);
        setSafeLoopActionMessage(message);
    }, [setSafeLoopActionMessage]);

    const handleStartAutoCompare = useCallback(async () => {
        if (isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning) {
            return;
        }
        const reliabilityTarget = clamp01(toNumber(autoCompareStopReliability, 0.7));
        if (clamp01(reliabilityHint) >= reliabilityTarget) {
            setSafeLoopActionMessage(`Auto A/B skipped: reliability target already reached (${Math.round(reliabilityTarget * 100)}%).`);
            return;
        }
        const maxRounds = clamp(Math.floor(toNumber(autoCompareMaxRounds, 16)), 1, 200);
        setAutoCompareMaxRounds(maxRounds);
        const episodeId = createCompareEpisodeId();
        autoCompareSessionRef.current = {
            running: true,
            episodeId,
            nextRound: 1,
            completed: 0,
            maxRounds,
        };
        setIsAutoCompareRunning(true);
        setAutoCompareEpisodeId(episodeId);
        setAutoCompareRound(1);
        setAutoCompareCompleted(0);
        setSafeLoopActionMessage(`Auto A/B started (${episodeId}).`);
        setSafeErrorState(null);
        if (comparePair) {
            setComparePair((prev) => (prev ? {
                ...prev,
                meta: {
                    ...(prev.meta || {}),
                    entry: 'auto',
                    episodeId,
                    roundId: 1,
                    createdAt: Date.now(),
                    reliabilityHintAtPrepare: clamp01(reliabilityHint),
                    modelSampleCount: Math.max(0, Math.floor(Number(preferenceModel?.sampleCount || 0))),
                    modelAccuracy: clamp01(Number(preferenceModel?.metrics?.accuracy || 0)),
                },
            } : prev));
            return;
        }
        const prepared = await prepareComparePair({
            entry: 'auto',
            episodeId,
            roundId: 1,
        });
        if (!mountedRef.current) return;
        if (!prepared) {
            stopAutoCompareSession('Auto A/B aborted: failed to prepare first pair.');
        }
    }, [
        autoCompareMaxRounds,
        autoCompareStopReliability,
        comparePair,
        isAutoCompareRunning,
        isOptimizing,
        isPreparingCompare,
        isSubmittingCompare,
        preferenceModel,
        prepareComparePair,
        reliabilityHint,
        setAutoCompareMaxRounds,
        setComparePair,
        setSafeErrorState,
        setSafeLoopActionMessage,
        stopAutoCompareSession,
    ]);

    const handleStopAutoCompare = useCallback(() => {
        stopAutoCompareSession('Auto A/B stopped by user.');
    }, [stopAutoCompareSession]);

    const handleDismissCompare = useCallback(() => {
        setComparePair(null);
        if (isAutoCompareRunning) {
            stopAutoCompareSession('Auto A/B stopped: compare card dismissed.');
        }
    }, [isAutoCompareRunning, setComparePair, stopAutoCompareSession]);

    const handleChooseCompare = useCallback(async (choice = 'A') => {
        if (!comparePair || isSubmittingCompare) {
            return;
        }
        const normalizedChoice = String(choice).toUpperCase() === 'B' ? 'B' : 'A';
        setIsSubmittingCompare(true);
        try {
            const chosenCandidate = normalizedChoice === 'B'
                ? comparePair.candidateB
                : comparePair.candidateA;
            const resultPayload = await feedbackStore.appendTrial({
                createdAt: Date.now(),
                chosen: normalizedChoice,
                candidateA: comparePair.candidateA,
                candidateB: comparePair.candidateB,
                context: {
                    mode: 'vnext',
                    seed,
                    stage: 'mature',
                    presetId: null,
                    loopMode: comparePair?.meta?.entry === 'auto' ? 'auto' : 'manual',
                    episodeId: comparePair?.meta?.episodeId || null,
                    roundId: Number.isFinite(Number(comparePair?.meta?.roundId))
                        ? Math.max(1, Math.floor(Number(comparePair.meta.roundId)))
                        : null,
                    preparedAt: Number.isFinite(Number(comparePair?.meta?.createdAt))
                        ? Math.max(0, Math.floor(Number(comparePair.meta.createdAt)))
                        : null,
                    reliabilityAtPrepare: clamp01(toNumber(comparePair?.meta?.reliabilityHintAtPrepare, reliabilityHint)),
                    modelSampleCountAtPrepare: Math.max(0, Math.floor(toNumber(comparePair?.meta?.modelSampleCount, 0))),
                    modelAccuracyAtPrepare: clamp01(toNumber(comparePair?.meta?.modelAccuracy, 0)),
                },
            });
            if (!mountedRef.current) return;
            const nextReliability = clamp01(Number(resultPayload?.reliability?.value || reliabilityHint));
            setReliabilityState(resultPayload?.reliability || null);
            setReliabilityHint(nextReliability);
            setAbTrialCount(Math.max(0, Math.floor(Number(resultPayload?.trialCount || 0))));
            if (chosenCandidate && Number.isFinite(Number(chosenCandidate.seed))) {
                setSeed(Math.floor(Number(chosenCandidate.seed)));
            }
            if (chosenCandidate?.factors) {
                setFactors(normalizeFactorVectorV2({
                    ...getDefaultFactorVectorV2(),
                    ...(chosenCandidate.factors || {}),
                }));
            }
            setComparePair(null);
            await trainPreferenceModel();
            if (!mountedRef.current) return;
            const session = autoCompareSessionRef.current;
            if (session?.running) {
                session.completed = Math.max(0, Number(session.completed || 0)) + 1;
                setAutoCompareCompleted(session.completed);
                const reliabilityTarget = clamp01(toNumber(autoCompareStopReliability, 0.7));
                if (nextReliability >= reliabilityTarget) {
                    stopAutoCompareSession(`Auto A/B stopped: reliability target reached (${Math.round(reliabilityTarget * 100)}%).`);
                    return;
                }
                const reachedLimit = session.maxRounds > 0 && session.completed >= session.maxRounds;
                if (reachedLimit) {
                    stopAutoCompareSession(`Auto A/B completed ${session.completed} rounds.`);
                } else {
                    const nextRound = session.completed + 1;
                    session.nextRound = nextRound;
                    setAutoCompareRound(nextRound);
                    const prepared = await prepareComparePair({
                        entry: 'auto',
                        episodeId: session.episodeId,
                        roundId: nextRound,
                        allowWhileSubmitting: true,
                    });
                    if (!mountedRef.current) return;
                    if (!prepared) {
                        stopAutoCompareSession('Auto A/B stopped: failed to prepare next pair.');
                    }
                }
            }
        } catch (error) {
            if (!mountedRef.current) return;
            setSafeErrorState(createZenUiErrorState(error, {
                fallbackCode: 'ZEN_VNEXT_COMPARE_SAVE_ERROR',
                fallbackMessage: 'VNext compare feedback save failed.',
                details: {
                    phase: 'save_compare_feedback',
                },
            }));
            if (autoCompareSessionRef.current?.running) {
                stopAutoCompareSession('Auto A/B stopped: failed while saving feedback.');
            }
        } finally {
            if (mountedRef.current) {
                setIsSubmittingCompare(false);
            }
        }
    }, [
        autoCompareStopReliability,
        comparePair,
        feedbackStore,
        isSubmittingCompare,
        prepareComparePair,
        reliabilityHint,
        seed,
        setAbTrialCount,
        setComparePair,
        setFactors,
        setReliabilityHint,
        setReliabilityState,
        setSafeErrorState,
        setSeed,
        stopAutoCompareSession,
        trainPreferenceModel,
    ]);

    return {
        isPreparingCompare,
        isSubmittingCompare,
        isOptimizing,
        optimizeProgress,
        isAutoCompareRunning,
        autoCompareEpisodeId,
        autoCompareRound,
        autoCompareCompleted,
        handleOptimize,
        handlePrepareCompare,
        handleStartAutoCompare,
        handleStopAutoCompare,
        handleDismissCompare,
        handleChooseCompare,
    };
}
