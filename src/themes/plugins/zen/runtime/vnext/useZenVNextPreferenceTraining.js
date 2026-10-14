import { useCallback, useEffect, useRef, useState } from 'react';
import {
    isVNextPreferenceModelStale,
    normalizeVNextPreferenceModel,
} from '../../model/vnext/index.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);

const warnPreferenceTraining = (message, error = null) => {
    if (!import.meta?.env?.DEV || typeof console === 'undefined' || typeof console.warn !== 'function') {
        return;
    }
    if (error) {
        console.warn(`[useZenVNextPreferenceTraining] ${message}`, error);
        return;
    }
    console.warn(`[useZenVNextPreferenceTraining] ${message}`);
};

const createPreferenceTrainingError = (
    code = 'ZEN_VNEXT_PREFERENCE_TRAINING_FAILED',
    message = 'VNext preference training failed.',
    details = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    return error;
};

const resolveTrainingAttemptKey = ({
    abTrialCount = 0,
    preferenceModel = null,
} = {}) => ([
    Math.max(0, Math.floor(Number(abTrialCount || 0))),
    Math.max(0, Math.floor(Number(preferenceModel?.sampleCount || 0))),
    Math.max(0, Math.floor(Number(preferenceModel?.trainedAt || 0))),
    String(preferenceModel?.training?.factorSignature || ''),
].join('|'));

export function useZenVNextPreferenceTraining({
    feedbackStore,
    preferenceModelStore,
    trainerWorkerClient,
    preferenceModel,
    abTrialCount,
    setAbTrialCount,
    setReliabilityState,
    setReliabilityHint,
    setPreferenceModel,
    autoTrainMinTrials = 10,
} = {}) {
    const [isTrainingPreference, setIsTrainingPreference] = useState(false);
    const lastAutoTrainingFailureKeyRef = useRef('');

    const trainPreferenceModel = useCallback(async ({
        force = false,
    } = {}) => {
        if (isTrainingPreference && !force) {
            return null;
        }
        const attemptKey = resolveTrainingAttemptKey({
            abTrialCount,
            preferenceModel,
        });
        if (!force && lastAutoTrainingFailureKeyRef.current === attemptKey) {
            return null;
        }
        setIsTrainingPreference(true);
        try {
            const trials = await feedbackStore.listTrials();
            if (!force && (!Array.isArray(trials) || trials.length < autoTrainMinTrials)) {
                return null;
            }
            const payload = {
                engineMode: 'vnext',
                trials: Array.isArray(trials) ? trials : [],
                existingModel: preferenceModel || null,
                epochs: 180,
                learningRate: 0.11,
                l2: 0.0008,
            };
            const trained = await trainerWorkerClient.train(payload);
            const nextModel = trained?.model || null;
            if (!nextModel || typeof nextModel !== 'object' || Array.isArray(nextModel)) {
                throw createPreferenceTrainingError(
                    'ZEN_VNEXT_PREFERENCE_TRAINER_RESULT_MODEL_INVALID',
                    'VNext preference trainer worker returned malformed model.',
                    {
                        expectedShape: '{ model: Object }',
                        actualShape: Array.isArray(nextModel) ? 'array' : typeof nextModel,
                    },
                );
            }
            const normalized = normalizeVNextPreferenceModel(nextModel);
            await preferenceModelStore.setModel(normalized);
            setPreferenceModel(normalized);
            lastAutoTrainingFailureKeyRef.current = '';
            return normalized;
        } catch (error) {
            if (!force) {
                lastAutoTrainingFailureKeyRef.current = attemptKey;
            }
            warnPreferenceTraining('Failed to train preference model.', error);
            return null;
        } finally {
            setIsTrainingPreference(false);
        }
    }, [
        abTrialCount,
        autoTrainMinTrials,
        feedbackStore,
        isTrainingPreference,
        preferenceModel,
        preferenceModelStore,
        setPreferenceModel,
        trainerWorkerClient,
    ]);

    useEffect(() => {
        let cancelled = false;

        const bootstrapFeedbackState = async () => {
            try {
                const [trials, reliabilityState, storedModel] = await Promise.all([
                    feedbackStore.listTrials(),
                    feedbackStore.getReliabilityState(),
                    preferenceModelStore.getModel(),
                ]);
                if (cancelled) {
                    return;
                }
                setAbTrialCount(Array.isArray(trials) ? trials.length : 0);
                if (storedModel) {
                    setPreferenceModel(normalizeVNextPreferenceModel(storedModel));
                }
                if (reliabilityState && Number.isFinite(Number(reliabilityState.value))) {
                    setReliabilityState(reliabilityState);
                    setReliabilityHint(clamp01(Number(reliabilityState.value)));
                    return;
                }
                const computed = await feedbackStore.recomputeReliability();
                if (!cancelled && computed && Number.isFinite(Number(computed.value))) {
                    setReliabilityState(computed);
                    setReliabilityHint(clamp01(Number(computed.value)));
                }
            } catch (error) {
                warnPreferenceTraining('Failed to bootstrap feedback reliability state.', error);
            }
        };

        bootstrapFeedbackState();
        return () => {
            cancelled = true;
        };
    }, [
        feedbackStore,
        preferenceModelStore,
        setAbTrialCount,
        setPreferenceModel,
        setReliabilityHint,
        setReliabilityState,
    ]);

    useEffect(() => {
        if (isTrainingPreference || abTrialCount < autoTrainMinTrials) {
            return;
        }
        const shouldRetrain = !preferenceModel || isVNextPreferenceModelStale({
            model: preferenceModel,
            trialCount: abTrialCount,
            minTrials: autoTrainMinTrials,
        });
        if (!shouldRetrain) {
            return;
        }
        trainPreferenceModel();
    }, [abTrialCount, autoTrainMinTrials, isTrainingPreference, preferenceModel, trainPreferenceModel]);

    return {
        isTrainingPreference,
        trainPreferenceModel,
    };
}
