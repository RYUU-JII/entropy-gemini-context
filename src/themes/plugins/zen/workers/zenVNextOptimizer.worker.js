import {
    normalizeVNextOptimizerPayloadV1,
    normalizeVNextOptimizationResult,
    optimizeVNextFactorPopulation,
    ZEN_ENGINE_MODE,
} from '@/themes/plugins/zen/api/researchLearning.js';
import { serializeZenWorkerError } from '../model/ZenWorkerError.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const optimizeWithPayload = (payload = {}, requestId = null) => {
    const safePayload = normalizeVNextOptimizerPayloadV1(payload);
    const seed = Number.isFinite(safePayload.seed)
        ? Math.floor(safePayload.seed)
        : Math.floor(Date.now() % 100000);
    const result = optimizeVNextFactorPopulation({
        seed,
        baseFactors: safePayload.baseFactors || safePayload.factors || null,
        preferenceProfile: safePayload.preferenceProfile,
        preferenceModel: safePayload.preferenceModel,
        populationSize: safePayload.populationSize,
        generations: safePayload.generations,
        eliteCount: safePayload.eliteCount,
        mutationIntensity: clamp(safePayload.mutationIntensity, 0.02, 0.45),
        reliabilityHint: safePayload.reliabilityHint,
        constraints: safePayload.constraints && typeof safePayload.constraints === 'object'
            ? safePayload.constraints
            : {},
        options: safePayload.options && typeof safePayload.options === 'object'
            ? safePayload.options
            : {},
    });
    if (Number.isFinite(requestId)) {
        self.postMessage({
            type: 'PROGRESS',
            id: requestId,
            progress: 1,
        });
    }
    return normalizeVNextOptimizationResult({
        ...result,
        engineMode: ZEN_ENGINE_MODE.VNEXT,
    });
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
        if (type !== 'OPTIMIZE') {
            self.postMessage({
                type: 'ERROR',
                id,
                error: serializeZenWorkerError(
                    new Error(`Unknown worker message type: ${String(type || 'UNKNOWN')}`),
                    {
                        fallbackCode: 'ZEN_VNEXT_OPTIMIZER_WORKER_MESSAGE_TYPE_INVALID',
                        fallbackMessage: 'Zen VNext optimizer worker received an unsupported request.',
                        details: {
                            requestType: String(type || 'UNKNOWN'),
                        },
                    },
                ),
            });
            return;
        }
        const result = optimizeWithPayload(message?.payload || {}, id);
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
                fallbackCode: 'ZEN_VNEXT_OPTIMIZER_WORKER_ERROR',
                fallbackMessage: 'Zen VNext optimizer worker failed.',
                details: {
                    requestType: 'OPTIMIZE',
                },
            }),
        });
    }
};

self.postMessage({ type: 'READY' });
