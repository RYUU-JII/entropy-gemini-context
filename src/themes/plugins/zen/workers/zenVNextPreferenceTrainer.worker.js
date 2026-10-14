import {
    normalizeVNextPreferenceTrainingPayloadV1,
    normalizeVNextPreferenceModel,
    trainVNextPreferenceModel,
    ZEN_ENGINE_MODE,
} from '@/themes/plugins/zen/api/researchLearning.js';
import { serializeZenWorkerError } from '../model/ZenWorkerError.js';

const trainWithPayload = (payload = {}, requestId = null) => {
    const safePayload = normalizeVNextPreferenceTrainingPayloadV1(payload);
    const model = trainVNextPreferenceModel({
        trials: safePayload.trials,
        existingModel: safePayload.existingModel,
        epochs: safePayload.epochs,
        learningRate: safePayload.learningRate,
        l2: safePayload.l2,
    });
    if (Number.isFinite(requestId)) {
        self.postMessage({
            type: 'PROGRESS',
            id: requestId,
            progress: 1,
        });
    }
    return {
        engineMode: ZEN_ENGINE_MODE.VNEXT,
        model: normalizeVNextPreferenceModel(model),
    };
};

self.onmessage = async (event) => {
    const message = event?.data || {};
    const type = message?.type;
    const id = Number(message?.id);
    try {
        if (type === 'PING') {
            self.postMessage({ type: 'READY' });
            return;
        }
        if (type !== 'TRAIN') {
            self.postMessage({
                type: 'ERROR',
                id,
                error: serializeZenWorkerError(
                    new Error(`Unknown worker message type: ${String(type || 'UNKNOWN')}`),
                    {
                        fallbackCode: 'ZEN_VNEXT_PREFERENCE_TRAINER_WORKER_MESSAGE_TYPE_INVALID',
                        fallbackMessage: 'Zen VNext preference trainer worker received an unsupported request.',
                        details: {
                            requestType: String(type || 'UNKNOWN'),
                        },
                    },
                ),
            });
            return;
        }
        const result = trainWithPayload(message?.payload || {}, id);
        self.postMessage({
            type: 'RESULT',
            id,
            result,
        });
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            id,
            error: serializeZenWorkerError(error, {
                fallbackCode: 'ZEN_VNEXT_PREFERENCE_TRAINER_WORKER_ERROR',
                fallbackMessage: 'Zen VNext preference trainer worker failed.',
                details: {
                    requestType: 'TRAIN',
                },
            }),
        });
    }
};

self.postMessage({ type: 'READY' });
