import {
    ZEN_ENGINE_MODE,
    resolveZenEngineMode,
} from '../../ZenEngineMode';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(Number(value)) ? Number(value) : 0, 0, 1);
const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const VNEXT_FORBIDDEN_PAYLOAD_KEYS = new Set([
    'baseDNA',
    'baseLatent',
    'learningKeyspaceProfile',
    'pairwiseModelStorageKey',
    'neuralModelStorageKey',
    'brain',
    'pairwiseBrain',
]);

const VNEXT_OPTIMIZER_REQUEST_KEYS_V1 = new Set([
    'engineMode',
    'seed',
    'factors',
    'baseFactors',
    'preferenceProfile',
    'preferenceModel',
    'populationSize',
    'generations',
    'eliteCount',
    'mutationIntensity',
    'reliabilityHint',
    'constraints',
    'options',
]);

const VNEXT_PREFERENCE_TRAINING_REQUEST_KEYS_V1 = new Set([
    'engineMode',
    'trials',
    'existingModel',
    'epochs',
    'learningRate',
    'l2',
]);

const toObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {}
);

export const assertVNextOptimizerPayload = (payload = {}) => {
    const safe = toObject(payload);
    const mode = Object.prototype.hasOwnProperty.call(safe, 'engineMode')
        ? resolveZenEngineMode(safe.engineMode)
        : ZEN_ENGINE_MODE.VNEXT;
    if (mode !== ZEN_ENGINE_MODE.VNEXT) {
        throw new Error('[VNextEngineBoundary] Invalid engineMode for vnext optimizer payload');
    }

    const forbidden = Object.keys(safe).filter((key) => VNEXT_FORBIDDEN_PAYLOAD_KEYS.has(key));
    if (forbidden.length) {
        throw new Error(`[VNextEngineBoundary] Forbidden payload keys for vnext optimizer: ${forbidden.join(', ')}`);
    }

    return {
        ...safe,
        engineMode: ZEN_ENGINE_MODE.VNEXT,
    };
};

const pickKnownKeys = (value = {}) => {
    const safe = toObject(value);
    return Object.keys(safe).reduce((acc, key) => {
        if (VNEXT_OPTIMIZER_REQUEST_KEYS_V1.has(key)) {
            acc[key] = safe[key];
        }
        return acc;
    }, {});
};

export const normalizeVNextOptimizerPayloadV1 = (payload = {}) => {
    const safe = assertVNextOptimizerPayload(payload);
    const known = pickKnownKeys(safe);
    const preferenceProfile = toObject(known.preferenceProfile);
    const preferenceModel = toObject(known.preferenceModel);

    return {
        engineMode: ZEN_ENGINE_MODE.VNEXT,
        seed: Math.floor(toNumber(known.seed, 0)),
        factors: toObject(known.factors),
        baseFactors: toObject(known.baseFactors),
        preferenceProfile: {
            factors: toObject(preferenceProfile.factors),
            style: toObject(preferenceProfile.style),
            weights: toObject(preferenceProfile.weights),
        },
        preferenceModel,
        populationSize: Math.max(8, Math.floor(toNumber(known.populationSize, 18))),
        generations: Math.max(1, Math.floor(toNumber(known.generations, 4))),
        eliteCount: Math.max(2, Math.floor(toNumber(known.eliteCount, 4))),
        mutationIntensity: clamp(toNumber(known.mutationIntensity, 0.14), 0.02, 0.45),
        reliabilityHint: clamp01(known.reliabilityHint),
        constraints: toObject(known.constraints),
        options: toObject(known.options),
    };
};

export const normalizeVNextPreferenceTrainingPayloadV1 = (payload = {}) => {
    const safe = assertVNextOptimizerPayload(payload);
    const known = Object.keys(toObject(safe)).reduce((acc, key) => {
        if (VNEXT_PREFERENCE_TRAINING_REQUEST_KEYS_V1.has(key)) {
            acc[key] = safe[key];
        }
        return acc;
    }, {});
    const safeTrials = Array.isArray(known.trials)
        ? known.trials.filter((entry) => entry && typeof entry === 'object').slice(-2000)
        : [];
    return {
        engineMode: ZEN_ENGINE_MODE.VNEXT,
        trials: safeTrials,
        existingModel: toObject(known.existingModel),
        epochs: Math.max(20, Math.floor(toNumber(known.epochs, 180))),
        learningRate: clamp(toNumber(known.learningRate, 0.11), 0.001, 0.5),
        l2: clamp(toNumber(known.l2, 0.0008), 0, 0.2),
    };
};
