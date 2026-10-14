import {
    NeuralZen,
    optimizeSakuraLatentDesign,
    SakuraAdditivePairwiseGPModel,
    SakuraSpecies,
} from '@/themes/plugins/zen/api/researchLearning.js';
import { normalizeSakuraOptimizationResult } from '@/themes/plugins/zen/model/v2/SakuraOptimizationResult.js';
import {
    requireSakuraOptimizationBasinGuidance,
} from '@/themes/plugins/zen/model/v2/SakuraPreferenceBasinObjective.js';
import ZenWorkerModelRepository from '@/themes/plugins/zen/state/ZenWorkerModelRepository.js';
import { createZenThemeModelRuntime } from '@/themes/plugins/zen/runtime/createZenThemeModelRuntime.js';
import {
    createZenWorkerProfileGenerationLease,
} from '../contracts/ZenWorkerProfileGenerationContract.js';
import { serializeZenWorkerError } from '../model/ZenWorkerError.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const clamp01 = (value) => clamp(value, 0, 1);
const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
);
let workerModelRepository = null;
let workerProfileGenerationLease = null;
const admitWorkerProfileGeneration = (profileGeneration) => {
    if (workerModelRepository === null) {
        workerModelRepository = new ZenWorkerModelRepository({ profileGeneration });
    }
    if (workerProfileGenerationLease === null) {
        workerProfileGenerationLease = createZenWorkerProfileGenerationLease({
            modelRepository: workerModelRepository,
        });
    }
    return workerProfileGenerationLease.admit(profileGeneration);
};

const sanitizeOptimizationResult = (result = null) => {
    const normalized = normalizeSakuraOptimizationResult(result, {
        learningKeyspaceProfile: safeString(result?.learningKeyspaceProfile),
        maxGenerationLogEntries: 18,
        maxArchetypeSetEntries: 6,
    });
    if (!normalized) {
        throw new Error('ZEN_OPTIMIZER_WORKER_RESULT_REQUIRED');
    }
    return normalized;
};

const resolveObjectiveMode = (value) => (
    value === 'neural' || value === 'pairwise' || value === 'blended' || value === 'rule' || value === 'adaptive'
        ? value
        : 'adaptive'
);

const createOptimizationModels = async (payload = {}) => {
    if (workerModelRepository === null) {
        throw new Error('ZEN_OPTIMIZER_WORKER_MODEL_REPOSITORY_REQUIRED');
    }
    const objectiveMode = resolveObjectiveMode(payload?.objectiveMode);
    const zenThemeModelRuntime = createZenThemeModelRuntime({
        modelStateStore: workerModelRepository,
    });
    const { zenThemeModelState, modelSaveCoordinator } = zenThemeModelRuntime;
    let brain = null;
    let pairwiseBrain = null;

    if (objectiveMode === 'neural' || objectiveMode === 'blended') {
        brain = new NeuralZen({
            zenThemeModelState,
            modelSaveCoordinator,
        });
        await brain.load();
    }

    if (objectiveMode === 'pairwise' || objectiveMode === 'blended' || objectiveMode === 'adaptive') {
        pairwiseBrain = new SakuraAdditivePairwiseGPModel({
            learningKeyspaceProfile: safeString(payload?.learningKeyspaceProfile),
            zenThemeModelState,
            modelSaveCoordinator,
        });
        await pairwiseBrain.load();
    }

    return {
        brain,
        pairwiseBrain,
        objectiveMode,
    };
};

const optimizeWithPayload = async (
    payload = {},
    requestId = null,
    profileGeneration = null,
) => {
    const { brain, pairwiseBrain, objectiveMode } = await createOptimizationModels(payload);
    const learningKeyspaceProfile = safeString(payload?.learningKeyspaceProfile);
    const preferenceBasinGuidance = objectiveMode === 'adaptive'
        ? requireSakuraOptimizationBasinGuidance(payload?.preferenceBasinGuidance, {
            learningKeyspaceProfile,
        })
        : null;
    const stageProfiles = Array.isArray(payload?.stage)
        ? payload.stage.map((entry) => ({
            id: safeString(entry?.id, 'stage_bloom'),
            stage: isPlainObject(entry?.stage) ? { ...entry.stage } : null,
            weight: Number.isFinite(Number(entry?.weight)) ? Math.max(0, Number(entry.weight)) : 1,
        }))
        : [];
    const result = optimizeSakuraLatentDesign({
        treeType: 'sakura',
        species: SakuraSpecies,
        stage: stageProfiles,
        width: Math.max(1, Math.floor(Number(payload?.width || 0))),
        height: Math.max(1, Math.floor(Number(payload?.height || 0))),
        topologyHeight: Number.isFinite(Number(payload?.topologyHeight))
            ? Number(payload.topologyHeight)
            : undefined,
        brain,
        pairwiseBrain,
        objectiveMode,
        baseDNA: isPlainObject(payload?.baseDNA) ? payload.baseDNA : null,
        baseLatent: isPlainObject(payload?.baseLatent) ? payload.baseLatent : null,
        referenceFeatures: Array.isArray(payload?.referenceFeatures) ? payload.referenceFeatures : [],
        populationSize: Number.isFinite(Number(payload?.populationSize))
            ? Math.max(8, Math.floor(Number(payload.populationSize)))
            : 24,
        generations: Number.isFinite(Number(payload?.generations))
            ? Math.max(1, Math.floor(Number(payload.generations)))
            : 3,
        eliteCount: Number.isFinite(Number(payload?.eliteCount))
            ? Math.max(2, Math.floor(Number(payload.eliteCount)))
            : 4,
        mutationIntensity: Number.isFinite(Number(payload?.mutationIntensity))
            ? clamp(Number(payload.mutationIntensity), 0.04, 0.4)
            : 0.16,
        binsX: Number.isFinite(Number(payload?.binsX)) ? Math.max(2, Math.floor(Number(payload.binsX))) : 8,
        binsY: Number.isFinite(Number(payload?.binsY)) ? Math.max(2, Math.floor(Number(payload.binsY))) : 8,
        diverseTopK: Number.isFinite(Number(payload?.diverseTopK))
            ? Math.max(4, Math.floor(Number(payload.diverseTopK)))
            : 12,
        reliabilityHint: Number.isFinite(Number(payload?.reliabilityHint))
            ? clamp01(Number(payload.reliabilityHint))
            : 0,
        learningKeyspaceProfile,
        preferenceBasinGuidance,
        onProgress: (value) => {
            if (!Number.isFinite(requestId)) {
                return;
            }
            self.postMessage({
                type: 'PROGRESS',
                id: requestId,
                profileGeneration,
                progress: clamp01(Number(value)),
            });
        },
    });

    return sanitizeOptimizationResult(result);
};

self.onmessage = async (event) => {
    const message = event?.data || {};
    const type = message?.type;
    const id = Number(message?.id);
    let admittedProfileGeneration = null;
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
                        fallbackCode: 'ZEN_OPTIMIZER_WORKER_MESSAGE_TYPE_INVALID',
                        fallbackMessage: 'Zen optimizer worker received an unsupported request.',
                        details: {
                            requestType: String(type || 'UNKNOWN'),
                        },
                    },
                ),
            });
            return;
        }
        admittedProfileGeneration = await admitWorkerProfileGeneration(
            message?.payload?.profileGeneration,
        );
        const result = await optimizeWithPayload(
            message?.payload || {},
            id,
            admittedProfileGeneration,
        );
        self.postMessage({
            type: 'RESULT',
            id,
            profileGeneration: admittedProfileGeneration,
            result,
        });
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            id,
            profileGeneration: admittedProfileGeneration
                || safeString(message?.payload?.profileGeneration, null),
            error: serializeZenWorkerError(error, {
                fallbackCode: 'ZEN_OPTIMIZER_WORKER_ERROR',
                fallbackMessage: 'Zen optimizer worker failed.',
                details: {
                    requestType: 'OPTIMIZE',
                },
            }),
        });
    }
};

self.postMessage({ type: 'READY' });
