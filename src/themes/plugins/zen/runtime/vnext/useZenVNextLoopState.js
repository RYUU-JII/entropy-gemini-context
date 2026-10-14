import { useCallback, useState } from 'react';
import {
    getDefaultFactorVectorV2,
    normalizeFactorVectorV2,
    normalizeVNextPreferenceModel,
} from '../../model/vnext/index.js';
import { createZenUiErrorState } from '../zenUiErrorState.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const createZenVNextLoopStateError = (
    code = 'ZEN_VNEXT_LOOP_STATE_INVALID',
    message = 'VNext loop state is invalid.',
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

export function useZenVNextLoopState({
    feedbackStore,
    preferenceModelStore,
    isAutoCompareRunning = false,
    loopActionMessage = '',
    setLoopActionMessage = () => {},
    seed,
    factors,
    reliabilityHint,
    setSeed,
    setFactors,
    setReliabilityHint,
    setAbTrialCount,
    setReliabilityState,
    setPreferenceModel,
    setComparePair,
    setLatestOptimization,
    setErrorState,
} = {}) {
    const [loopPayloadText, setLoopPayloadText] = useState('');
    const [isMaintainingLoop, setIsMaintainingLoop] = useState(false);

    const beginLoopAction = useCallback(() => {
        if (isMaintainingLoop || isAutoCompareRunning) {
            return false;
        }
        setIsMaintainingLoop(true);
        setLoopActionMessage('');
        if (typeof setErrorState === 'function') {
            setErrorState(null);
        }
        return true;
    }, [isAutoCompareRunning, isMaintainingLoop, setErrorState]);

    const handleResetPreferenceModel = useCallback(async () => {
        if (!beginLoopAction()) {
            return;
        }
        try {
            await preferenceModelStore.clearModel();
            setPreferenceModel(null);
            setLoopActionMessage('Preference model cleared.');
        } catch (error) {
            if (typeof setErrorState === 'function') {
                setErrorState(createZenUiErrorState(error, {
                    fallbackCode: 'ZEN_VNEXT_RESET_MODEL_ERROR',
                    fallbackMessage: 'VNext preference model reset failed.',
                }));
            }
        } finally {
            setIsMaintainingLoop(false);
        }
    }, [beginLoopAction, preferenceModelStore, setErrorState, setPreferenceModel]);

    const handleClearFeedbackTrials = useCallback(async () => {
        if (!beginLoopAction()) {
            return;
        }
        try {
            const [reliability] = await Promise.all([
                feedbackStore.clearAll(),
                preferenceModelStore.clearModel(),
            ]);
            setAbTrialCount(0);
            setReliabilityState(reliability || null);
            setReliabilityHint(clamp01(Number(reliability?.value || 0.24)));
            setPreferenceModel(null);
            setComparePair(null);
            setLatestOptimization(null);
            setLoopActionMessage('A/B trial history and preference model cleared.');
        } catch (error) {
            if (typeof setErrorState === 'function') {
                setErrorState(createZenUiErrorState(error, {
                    fallbackCode: 'ZEN_VNEXT_CLEAR_TRIALS_ERROR',
                    fallbackMessage: 'VNext A/B trial reset failed.',
                }));
            }
        } finally {
            setIsMaintainingLoop(false);
        }
    }, [
        beginLoopAction,
        feedbackStore,
        preferenceModelStore,
        setAbTrialCount,
        setComparePair,
        setErrorState,
        setLatestOptimization,
        setPreferenceModel,
        setReliabilityHint,
        setReliabilityState,
    ]);

    const handleExportLoopState = useCallback(async () => {
        if (!beginLoopAction()) {
            return;
        }
        try {
            const [feedbackSnapshot, storedModel] = await Promise.all([
                feedbackStore.exportSnapshot(),
                preferenceModelStore.getModel(),
            ]);
            const payload = {
                version: 1,
                exportedAt: Date.now(),
                state: {
                    seed,
                    factors,
                    reliabilityHint,
                    trials: feedbackSnapshot?.trials || [],
                    reliabilityState: feedbackSnapshot?.reliability || null,
                    preferenceModel: storedModel || null,
                },
            };
            const serialized = JSON.stringify(payload, null, 2);
            setLoopPayloadText(serialized);
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(serialized);
                setLoopActionMessage('Loop state exported and copied to clipboard.');
            } else {
                setLoopActionMessage('Loop state exported to text area.');
            }
        } catch (error) {
            if (typeof setErrorState === 'function') {
                setErrorState(createZenUiErrorState(error, {
                    fallbackCode: 'ZEN_VNEXT_EXPORT_LOOP_STATE_ERROR',
                    fallbackMessage: 'VNext loop state export failed.',
                }));
            }
        } finally {
            setIsMaintainingLoop(false);
        }
    }, [
        beginLoopAction,
        factors,
        feedbackStore,
        preferenceModelStore,
        reliabilityHint,
        seed,
        setErrorState,
    ]);

    const handleImportLoopState = useCallback(async () => {
        if (!beginLoopAction()) {
            return;
        }
        try {
            const raw = JSON.parse(String(loopPayloadText || '').trim() || '{}');
            const state = raw?.state && typeof raw.state === 'object' ? raw.state : raw;
            if (!state || typeof state !== 'object') {
                throw createZenVNextLoopStateError(
                    'ZEN_VNEXT_LOOP_PAYLOAD_INVALID',
                    'Invalid loop payload.',
                );
            }

            const replaced = await feedbackStore.replaceTrials(Array.isArray(state.trials) ? state.trials : []);
            const replacedReliability = replaced?.reliability || state?.reliabilityState || null;
            setReliabilityState(replacedReliability);
            const nextReliability = clamp01(Number(
                replaced?.reliability?.value
                ?? state?.reliabilityState?.value
                ?? state?.reliabilityHint
                ?? reliabilityHint
            ));
            setAbTrialCount(Math.max(0, Math.floor(Number(replaced?.trialCount || 0))));
            setReliabilityHint(nextReliability);

            const hasImportedModel = Boolean(
                state?.preferenceModel
                && typeof state.preferenceModel === 'object'
                && !Array.isArray(state.preferenceModel)
            );
            const importedModel = hasImportedModel
                ? normalizeVNextPreferenceModel(state.preferenceModel)
                : null;
            if (importedModel) {
                await preferenceModelStore.setModel(importedModel);
                setPreferenceModel(importedModel);
            } else {
                await preferenceModelStore.clearModel();
                setPreferenceModel(null);
            }

            const importedSeed = Number(state?.seed);
            if (Number.isFinite(importedSeed)) {
                setSeed(Math.floor(importedSeed));
            }
            if (state?.factors && typeof state.factors === 'object') {
                setFactors(normalizeFactorVectorV2({
                    ...getDefaultFactorVectorV2(),
                    ...(state.factors || {}),
                }));
            }
            setComparePair(null);
            setLatestOptimization(null);
            setLoopActionMessage('Loop state imported.');
        } catch (error) {
            if (typeof setErrorState === 'function') {
                setErrorState(createZenUiErrorState(error, {
                    fallbackCode: 'ZEN_VNEXT_IMPORT_LOOP_STATE_ERROR',
                    fallbackMessage: 'VNext loop state import failed.',
                }));
            }
        } finally {
            setIsMaintainingLoop(false);
        }
    }, [
        beginLoopAction,
        feedbackStore,
        loopPayloadText,
        preferenceModelStore,
        reliabilityHint,
        setAbTrialCount,
        setComparePair,
        setErrorState,
        setFactors,
        setLatestOptimization,
        setPreferenceModel,
        setReliabilityHint,
        setReliabilityState,
        setSeed,
    ]);

    const handleRefreshLoopState = useCallback(async () => {
        if (!beginLoopAction()) {
            return;
        }
        try {
            const [trials, reliability, model] = await Promise.all([
                feedbackStore.listTrials(),
                feedbackStore.recomputeReliability(),
                preferenceModelStore.getModel(),
            ]);
            setAbTrialCount(Array.isArray(trials) ? trials.length : 0);
            setReliabilityState(reliability || null);
            setReliabilityHint(clamp01(Number(reliability?.value || 0)));
            setPreferenceModel(model ? normalizeVNextPreferenceModel(model) : null);
            setLoopActionMessage('Loop state refreshed.');
        } catch (error) {
            if (typeof setErrorState === 'function') {
                setErrorState(createZenUiErrorState(error, {
                    fallbackCode: 'ZEN_VNEXT_REFRESH_LOOP_STATE_ERROR',
                    fallbackMessage: 'VNext loop state refresh failed.',
                }));
            }
        } finally {
            setIsMaintainingLoop(false);
        }
    }, [
        beginLoopAction,
        feedbackStore,
        preferenceModelStore,
        setAbTrialCount,
        setErrorState,
        setPreferenceModel,
        setReliabilityHint,
        setReliabilityState,
    ]);

    return {
        loopPayloadText,
        setLoopPayloadText,
        loopActionMessage,
        isMaintainingLoop,
        handleResetPreferenceModel,
        handleClearFeedbackTrials,
        handleExportLoopState,
        handleImportLoopState,
        handleRefreshLoopState,
    };
}
