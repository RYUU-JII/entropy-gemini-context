import {
    createZenThemeModelState,
    requireZenThemeModelStateValue,
    ZEN_THEME_MODEL_STATE_KEYS,
} from '@/themes/plugins/zen/state/ZenThemeModelState.js';
import { createZenModelSaveCoordinator } from '@/themes/plugins/zen/runtime/createZenThemeModelRuntime.js';
import { TREE_FEATURE_KEYS } from './TreeAnalyzer';
import {
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentDef,
    resolveSakuraLearningLatentProfile,
    resolveSakuraLatentTierIndexMap,
} from './v2/SakuraLatentParamApi';
import {
    SAKURA_PAIRWISE_INPUT_BASIS,
    SAKURA_PAIRWISE_MODEL_VERSION,
    SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID,
} from './SakuraPairwisePredictionContract.js';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from './v2/SakuraLearningSemantics.js';

export {
    SAKURA_PAIRWISE_INPUT_BASIS,
    SAKURA_PAIRWISE_MODEL_VERSION,
    SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID,
} from './SakuraPairwisePredictionContract.js';
const MODEL_VERSION = SAKURA_PAIRWISE_MODEL_VERSION;
const DEFAULT_MODEL_STORAGE_KEY = ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_PAIRWISE_GP;
const SAVE_DEBOUNCE_MS = 600;
const MIN_TEMPERATURE = 0.65;
const MAX_TEMPERATURE = 3.2;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TEMPERATURE_LR = 0.005;
const NEAR_TIE_INFO_DAMP_MIN = 0.08;
const NEAR_TIE_INFO_DAMP_MAX = 0.3;
const NEAR_TIE_STEP_DAMP_MIN = 0.18;
const NEAR_TIE_STEP_DAMP_MAX = 0.42;
const NEAR_TIE_RELEVANCE_DAMP = 0.22;
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const clampTemperature = (value) => clamp(value, MIN_TEMPERATURE, MAX_TEMPERATURE);
const createPairwiseModelStateError = (code, message, details = null, cause = null) => {
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
const surfaceAsyncPersistError = (error) => {
    queueMicrotask(() => {
        throw error;
    });
};
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const sigmoid = (value) => {
    const x = Number.isFinite(value) ? value : 0;
    if (x >= 12) {
        return 0.999994;
    }
    if (x <= -12) {
        return 0.000006;
    }
    return 1 / (1 + Math.exp(-x));
};

const entropy01 = (probability) => {
    const p = clamp01(probability);
    const q = 1 - p;
    const safeP = Math.max(1e-9, p);
    const safeQ = Math.max(1e-9, q);
    return -((safeP * Math.log(safeP)) + (safeQ * Math.log(safeQ)));
};

const logisticVarianceScale = (variance) => Math.sqrt(1 + (Math.PI * Math.max(0, variance) / 8));

const dot = (left = [], right = []) => {
    const size = Math.min(left.length, right.length);
    let acc = 0;
    for (let index = 0; index < size; index += 1) {
        acc += (Number(left[index]) || 0) * (Number(right[index]) || 0);
    }
    return acc;
};

const hash32 = (seed = 0, value = 0) => {
    let x = (Number(seed) >>> 0) ^ 0x9e3779b9;
    x = (x + ((Number(value) + 1) * 0x85ebca6b)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
};

const createSeededRandom = (seed = 1) => {
    let state = Number(seed) >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let next = Math.imul(state ^ (state >>> 15), 1 | state);
        next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
        return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
};

const sampleStandardNormal = (randomFn = Math.random) => {
    let u = 0;
    let v = 0;
    while (u <= 1e-12) {
        u = clamp01(randomFn());
    }
    while (v <= 1e-12) {
        v = clamp01(randomFn());
    }
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const buildGroupDefinitions = (latentKeys = []) => {
    const groupedIndices = resolveSakuraLatentTierIndexMap(latentKeys);
    const baseBasisByGroup = {
        trunk: 18,
        scaffold: 16,
        twig: 15,
        leaf: 14,
        misc: 10,
    };
    return Object.entries(groupedIndices)
        .filter(([, keyIndices]) => keyIndices.length > 0)
        .map(([id, keyIndices]) => ({
            id,
            keyIndices,
            basisCount: clamp(
                Math.round((baseBasisByGroup[id] || 12) + (keyIndices.length * 0.35)),
                8,
                28,
            ),
        }));
};

const normalizeLatentValue = (key, rawValue, learningKeyspaceProfile) => {
    const def = resolveSakuraLearningLatentDef(key, {
        profile: learningKeyspaceProfile,
    });
    if (!def) {
        throw createPairwiseModelStateError(
            'ZEN_PAIRWISE_LEARNING_LATENT_DEF_REQUIRED',
            `Pairwise GP learning definition is missing for '${key}'.`,
            { key, learningKeyspaceProfile },
        );
    }
    const min = Number(def.min);
    const max = Number(def.max);
    const span = Math.max(1e-6, max - min);
    const fallback = Number.isFinite(def.default) ? Number(def.default) : min;
    const value = Number.isFinite(rawValue) ? Number(rawValue) : fallback;
    const normalized01 = clamp((value - min) / span, 0, 1);
    return normalized01 * 2 - 1;
};

const resolveLatentCandidate = (input = null) => {
    if (!input || typeof input !== 'object') {
        return null;
    }
    if (input?.latent && typeof input.latent === 'object') {
        return input.latent;
    }
    return input;
};

const countFiniteLatentValues = (candidate = null, latentKeys = []) => (
    latentKeys.reduce((count, key) => (
        Number.isFinite(Number(candidate?.[key])) ? count + 1 : count
    ), 0)
);

export class SakuraAdditivePairwiseGPModel {
    constructor(options = {}) {
        if (Object.prototype.hasOwnProperty.call(options, 'storageKey')) {
            throw new Error('ZEN_PAIRWISE_MODEL_STORAGE_KEY_OVERRIDE_FORBIDDEN');
        }
        this.zenThemeModelState = options?.zenThemeModelState || createZenThemeModelState({
            modelStateStore: options?.modelStateStore,
            profileGenerationLease: options?.profileGenerationLease,
        });
        this.modelSaveCoordinator = options?.modelSaveCoordinator || createZenModelSaveCoordinator();
        this.mode = 'additive_gp_live';
        this.generationSemantics = SAKURA_GENERATION_SEMANTICS_ID;
        this.learningKeyspaceProfile = resolveSakuraLearningLatentProfile(
            options?.learningKeyspaceProfile,
        );
        this.latentKeys = listSakuraLearningLatentKeys({
            profile: this.learningKeyspaceProfile,
        });
        this.featureKeys = [...TREE_FEATURE_KEYS];
        this.latentSize = this.latentKeys.length;
        this.groupDefs = buildGroupDefinitions(this.latentKeys);

        this.learningRate = Number.isFinite(options.learningRate) ? options.learningRate : 1;
        this.priorPrecision = Number.isFinite(options.priorPrecision) ? Math.max(1e-5, options.priorPrecision) : 1.5;
        this.storageKey = DEFAULT_MODEL_STORAGE_KEY;
        this.temperature = clampTemperature(
            Number.isFinite(options.temperature) ? Number(options.temperature) : DEFAULT_TEMPERATURE,
        );
        this.temperatureLearningRate = clamp(
            Number.isFinite(options.temperatureLearningRate)
                ? Number(options.temperatureLearningRate)
                : DEFAULT_TEMPERATURE_LR,
            0.0001,
            0.05,
        );
        this.basisSeed = Number.isFinite(options.basisSeed)
            ? Number(options.basisSeed) >>> 0
            : hash32(Date.now(), this.latentSize);

        this.groupBasis = [];
        this.inputSize = 0;
        this.weights = [];
        this.precision = [];
        this.axisRelevance = [];

        this.trainingPairs = 0;
        this.avgPairLoss = 0;
        this.avgPredictiveVariance = 0;
        this.rawCalibrationError = 0;
        this.calibratedCalibrationError = 0;
        this.calibrationSamples = 0;

        this.saveTimer = null;
        this.saveQueued = false;
        this.isLoaded = false;
        this.loadPromise = null;

        this.initializeBasis();
        this.initialize();
        this.modelSaveCoordinator.flushPending();
    }

    initializeBasis() {
        this.groupBasis = this.groupDefs.map((group, groupIndex) => {
            const randomFn = createSeededRandom(hash32(this.basisSeed, groupIndex + 1));
            const frequencies = Array.from({ length: group.basisCount }, () => (
                Array.from({ length: group.keyIndices.length }, () => sampleStandardNormal(randomFn))
            ));
            const phases = Array.from(
                { length: group.basisCount },
                () => randomFn() * Math.PI * 2,
            );
            return {
                id: group.id,
                keyIndices: [...group.keyIndices],
                basisCount: group.basisCount,
                frequencies,
                phases,
            };
        });
        this.inputSize = 1 + this.groupBasis.reduce(
            (acc, group) => acc + group.basisCount + 1,
            0,
        );
    }

    initialize() {
        this.weights = Array.from({ length: this.inputSize }, () => 0);
        this.precision = Array.from({ length: this.inputSize }, () => this.priorPrecision);
        this.axisRelevance = Array.from({ length: this.latentSize }, () => 1);
        this.trainingPairs = 0;
        this.avgPairLoss = 0;
        this.avgPredictiveVariance = 0;
        this.rawCalibrationError = 0;
        this.calibratedCalibrationError = 0;
        this.calibrationSamples = 0;
        this.temperature = clampTemperature(this.temperature || DEFAULT_TEMPERATURE);
    }

    restoreBasis(state) {
        this.basisSeed = state.basisSeed;
        this.groupBasis = state.groupBasis.map((group) => ({
            id: group.id,
            keyIndices: [...group.keyIndices],
            basisCount: group.basisCount,
            frequencies: group.frequencies.map((row) => [...row]),
            phases: [...group.phases],
        }));
    }

    restorePosterior(state) {
        this.trainingPairs = state.trainingPairs;
        this.avgPairLoss = state.avgPairLoss;
        this.avgPredictiveVariance = state.avgPredictiveVariance;
        this.temperature = state.temperature;
        this.temperatureLearningRate = state.temperatureLearningRate;
        this.rawCalibrationError = state.rawCalibrationError;
        this.calibratedCalibrationError = state.calibratedCalibrationError;
        this.calibrationSamples = state.calibrationSamples;
        this.priorPrecision = state.priorPrecision;
        this.learningRate = state.learningRate;
        this.weights = [...state.weights];
        this.precision = [...state.precision];
        this.axisRelevance = [...state.axisRelevance];
        this.restoreBasis(state);
    }

    isStateValid(state) {
        try {
            requireZenThemeModelStateValue(
                DEFAULT_MODEL_STORAGE_KEY,
                JSON.stringify(state),
            );
        } catch (_) {
            return false;
        }
        if (state.mode !== this.mode) {
            return false;
        }
        if (state.version !== MODEL_VERSION) {
            return false;
        }
        if (state.generationSemantics !== this.generationSemantics) {
            return false;
        }
        if (state.learningKeyspaceProfile !== this.learningKeyspaceProfile) {
            return false;
        }
        if (
            !Array.isArray(state.latentKeys)
            || state.latentKeys.length !== this.latentKeys.length
            || state.latentKeys.some((key, index) => key !== this.latentKeys[index])
        ) {
            return false;
        }
        if (!Array.isArray(state.weights) || state.weights.length !== this.inputSize) {
            return false;
        }
        if (!Array.isArray(state.precision) || state.precision.length !== this.inputSize) {
            return false;
        }
        if (!Array.isArray(state.axisRelevance) || state.axisRelevance.length !== this.latentSize) {
            return false;
        }
        if (!Array.isArray(state.groupBasis) || state.groupBasis.length !== this.groupBasis.length) {
            return false;
        }
        for (let index = 0; index < this.groupBasis.length; index += 1) {
            const expectedGroup = this.groupBasis[index];
            const savedGroup = state.groupBasis[index];
            if (savedGroup?.id !== expectedGroup.id) {
                return false;
            }
            if (savedGroup?.basisCount !== expectedGroup.basisCount) {
                return false;
            }
            if (
                !Array.isArray(savedGroup?.keyIndices)
                || savedGroup.keyIndices.length !== expectedGroup.keyIndices.length
            ) {
                return false;
            }
            for (let keyIndex = 0; keyIndex < expectedGroup.keyIndices.length; keyIndex += 1) {
                if (savedGroup.keyIndices[keyIndex] !== expectedGroup.keyIndices[keyIndex]) {
                    return false;
                }
            }
            if (
                !Array.isArray(savedGroup?.frequencies)
                || savedGroup.frequencies.length !== expectedGroup.frequencies.length
            ) {
                return false;
            }
            if (
                !Array.isArray(savedGroup?.phases)
                || savedGroup.phases.length !== expectedGroup.phases.length
            ) {
                return false;
            }
            for (let freqIndex = 0; freqIndex < expectedGroup.frequencies.length; freqIndex += 1) {
                if (
                    !Array.isArray(savedGroup.frequencies[freqIndex])
                    || savedGroup.frequencies[freqIndex].length !== expectedGroup.frequencies[freqIndex].length
                ) {
                    return false;
                }
            }
        }
        return state.precision.every((value) => value > 0)
            && state.axisRelevance.every((value) => value >= 0.05 && value <= 4)
            && state.temperature >= MIN_TEMPERATURE
            && state.temperature <= MAX_TEMPERATURE
            && state.temperatureLearningRate >= 0.0001
            && state.temperatureLearningRate <= 0.05
            && state.priorPrecision > 0
            && state.learningRate > 0
            && state.avgPairLoss >= 0
            && state.avgPredictiveVariance >= 0
            && state.rawCalibrationError >= 0
            && state.rawCalibrationError <= 1
            && state.calibratedCalibrationError >= 0
            && state.calibratedCalibrationError <= 1;
    }

    resolveLatentVector(input = null) {
        const latentCandidate = resolveLatentCandidate(input);
        const finiteCount = countFiniteLatentValues(latentCandidate, this.latentKeys);
        const forceResolve = Boolean(input?.latent && typeof input.latent === 'object');
        if (!forceResolve && finiteCount < Math.min(6, this.latentSize)) {
            return null;
        }
        return this.latentKeys.map((key) => normalizeLatentValue(
            key,
            latentCandidate?.[key],
            this.learningKeyspaceProfile,
        ));
    }

    resolveFeatureVector(input = null) {
        const featureCandidate = resolveFallbackFeatures(input);
        if (!featureCandidate || typeof featureCandidate !== 'object') {
            return null;
        }
        return this.featureKeys.map((key) => {
            const value = Number(featureCandidate[key]);
            if (!Number.isFinite(value)) {
                return 0;
            }
            return clamp(value, -2, 2) * 0.5;
        });
    }

    buildInputVectorFromLatent(latentVector = null) {
        if (!Array.isArray(latentVector) || latentVector.length !== this.latentSize) {
            return null;
        }
        const out = [1];
        this.groupBasis.forEach((group) => {
            // Keep the random-feature map stationary. Axis relevance is learned
            // as a diagnostic signal, but feeding it back into this projection
            // would move every previously trained basis after each answer.
            const groupInputs = group.keyIndices.map((latentIndex) => (
                latentVector[latentIndex]
            ));
            const groupMean = groupInputs.length
                ? groupInputs.reduce((acc, value) => acc + value, 0) / groupInputs.length
                : 0;
            out.push(groupMean);
            const normFactor = Math.sqrt(2 / Math.max(1, group.basisCount));
            group.frequencies.forEach((omega, basisIndex) => {
                const projection = dot(omega, groupInputs);
                out.push(normFactor * Math.cos(projection + Number(group.phases[basisIndex] || 0)));
            });
        });
        return out;
    }

    buildInputVectorFromFeatures(featureVector = null) {
        const out = [1];
        this.groupBasis.forEach((group) => {
            const reduced = group.keyIndices.length
                ? group.keyIndices.reduce((acc, latentIndex, index) => {
                    const featureValue = Number(featureVector?.[(latentIndex + index) % this.featureKeys.length] || 0);
                    return acc + featureValue;
                }, 0) / group.keyIndices.length
                : 0;
            out.push(reduced);
            const normFactor = Math.sqrt(2 / Math.max(1, group.basisCount));
            for (let basisIndex = 0; basisIndex < group.basisCount; basisIndex += 1) {
                const seededFeature = Number(
                    featureVector?.[(basisIndex + group.keyIndices.length) % this.featureKeys.length] || 0,
                );
                out.push(normFactor * Math.cos(seededFeature + Number(group.phases[basisIndex] || 0)));
            }
        });
        return out;
    }

    vectorize(input = null) {
        const latentVector = this.resolveLatentVector(input);
        if (latentVector) {
            return {
                inputVector: this.buildInputVectorFromLatent(latentVector),
                latentVector,
                hasLatent: true,
            };
        }
        const featureVector = this.resolveFeatureVector(input);
        if (featureVector) {
            return {
                inputVector: this.buildInputVectorFromFeatures(featureVector),
                latentVector: null,
                hasLatent: false,
            };
        }
        return {
            inputVector: this.buildInputVectorFromFeatures(null),
            latentVector: null,
            hasLatent: false,
        };
    }

    diffVector(inputA, inputB) {
        const left = this.vectorize(inputA);
        const right = this.vectorize(inputB);
        const diff = left.inputVector.map((value, index) => value - right.inputVector[index]);
        return {
            inputVector: diff,
            latentA: left.latentVector,
            latentB: right.latentVector,
            hasLatent: Boolean(left.latentVector && right.latentVector),
        };
    }

    predictiveFromInputVector(inputVector = [], options = {}) {
        const meanLogit = dot(this.weights, inputVector);
        const variance = inputVector.reduce((acc, value, index) => {
            const precision = Math.max(1e-6, Number(this.precision[index]) || this.priorPrecision);
            return acc + ((value * value) / precision);
        }, 0);
        const rawLogit = meanLogit / logisticVarianceScale(variance);
        const rawScore = clamp01(sigmoid(rawLogit));
        const applyCalibration = options?.applyCalibration !== false;
        const temperature = clampTemperature(this.temperature || DEFAULT_TEMPERATURE);
        const calibratedLogit = applyCalibration
            ? rawLogit / temperature
            : rawLogit;
        const score = clamp01(sigmoid(calibratedLogit));
        return {
            score,
            rawScore,
            logit: calibratedLogit,
            rawLogit,
            meanLogit,
            variance,
            temperature,
        };
    }

    predict(input = null) {
        return this.predictDetailed(input).score;
    }

    predictDetailed(input = null) {
        const encoded = this.vectorize(input);
        const predictive = this.predictiveFromInputVector(encoded.inputVector);
        const entropy = entropy01(predictive.score);
        const entropyConfidence = clamp01(1 - (entropy / Math.log(2)));
        const varianceConfidence = clamp01(1 / (1 + predictive.variance));
        const confidence = clamp01((entropyConfidence * 0.68) + (varianceConfidence * 0.32));
        return {
            score: predictive.score,
            rawScore: predictive.rawScore,
            confidence,
            logit: predictive.logit,
            rawLogit: predictive.rawLogit,
            variance: predictive.variance,
            temperature: predictive.temperature,
            hasLatent: encoded.hasLatent,
        };
    }

    compare(inputA, inputB) {
        const diff = this.diffVector(inputA, inputB);
        return this.predictiveFromInputVector(diff.inputVector).score;
    }

    sampleUtility(input = null, options = {}) {
        const encoded = this.vectorize(input);
        const predictive = this.predictiveFromInputVector(encoded.inputVector, {
            applyCalibration: false,
        });
        const randomFn = typeof options?.randomFn === 'function' ? options.randomFn : Math.random;
        const sample = predictive.meanLogit
            + Math.sqrt(Math.max(1e-8, predictive.variance)) * sampleStandardNormal(randomFn);
        return {
            sample,
            mean: predictive.meanLogit,
            variance: predictive.variance,
            hasLatent: encoded.hasLatent,
        };
    }

    updateAxisRelevance(latentA = null, latentB = null, signal = 0) {
        if (!Array.isArray(latentA) || !Array.isArray(latentB)) {
            return;
        }
        const safeSignal = clamp(Math.abs(signal), 0, 2);
        for (let index = 0; index < this.latentSize; index += 1) {
            const diff = Math.abs((Number(latentA[index]) || 0) - (Number(latentB[index]) || 0));
            const target = clamp(0.05 + (diff * safeSignal), 0.05, 4);
            this.axisRelevance[index] = clamp(
                this.axisRelevance[index] * 0.985 + target * 0.015,
                0.05,
                4,
            );
        }
    }

    trainPair(preferredInput, otherInput, options = {}) {
        const diff = this.diffVector(preferredInput, otherInput);
        const predictive = this.predictiveFromInputVector(diff.inputVector);
        const sampleWeight = Number.isFinite(options.sampleWeight) ? Math.max(0.05, options.sampleWeight) : 1;
        const targetProbability = clamp01(
            Number.isFinite(options?.targetProbability)
                ? Number(options.targetProbability)
                : 1,
        );
        const uncertaintyBoost = clamp01(
            Number.isFinite(options?.uncertaintyBoost)
                ? Number(options.uncertaintyBoost)
                : 0,
        );
        const probabilityRaw = clamp01(predictive.rawScore);
        const probabilityCalibrated = clamp01(predictive.score);
        const error = targetProbability - probabilityRaw;
        const fisher = Math.max(1e-6, probabilityRaw * (1 - probabilityRaw));
        const nearTieTarget = Math.abs(targetProbability - 0.5) <= 0.001;
        const infoScale = clamp01(1 - (nearTieTarget ? uncertaintyBoost * 0.8 : uncertaintyBoost * 0.32));
        const tieInfoDamping = nearTieTarget
            ? clamp(0.08 + (uncertaintyBoost * 0.18), NEAR_TIE_INFO_DAMP_MIN, NEAR_TIE_INFO_DAMP_MAX)
            : 1;
        const tieStepDamping = nearTieTarget
            ? clamp(0.22 + (uncertaintyBoost * 0.2), NEAR_TIE_STEP_DAMP_MIN, NEAR_TIE_STEP_DAMP_MAX)
            : 1;

        for (let index = 0; index < this.inputSize; index += 1) {
            const x = Number(diff.inputVector[index]) || 0;
            if (x === 0) {
                continue;
            }
            const info = sampleWeight * fisher * x * x * Math.max(0.05, infoScale) * tieInfoDamping;
            this.precision[index] += info;
            const naturalStep = (
                sampleWeight
                * error
                * x
                * tieStepDamping
            ) / Math.max(1e-6, this.precision[index]);
            this.weights[index] += this.learningRate * naturalStep;
            if (nearTieTarget && uncertaintyBoost > 0) {
                const precisionScale = Math.max(
                    0.76,
                    1 - (uncertaintyBoost * 0.11 * Math.min(1, Math.abs(x))),
                );
                this.precision[index] = Math.max(
                    this.priorPrecision * 0.25,
                    this.precision[index] * precisionScale,
                );
            }
        }

        const loss = -(
            (targetProbability * Math.log(Math.max(1e-6, probabilityRaw)))
            + ((1 - targetProbability) * Math.log(Math.max(1e-6, 1 - probabilityRaw)))
        );
        const calibratedLoss = -(
            (targetProbability * Math.log(Math.max(1e-6, probabilityCalibrated)))
            + ((1 - targetProbability) * Math.log(Math.max(1e-6, 1 - probabilityCalibrated)))
        );
        this.trainingPairs += 1;
        this.avgPairLoss = this.avgPairLoss === 0
            ? loss
            : (this.avgPairLoss * 0.95 + loss * 0.05);
        this.avgPredictiveVariance = this.avgPredictiveVariance === 0
            ? predictive.variance
            : (this.avgPredictiveVariance * 0.95 + predictive.variance * 0.05);
        const rawCalError = Math.abs(targetProbability - probabilityRaw);
        const calibratedCalError = Math.abs(targetProbability - probabilityCalibrated);
        this.rawCalibrationError = this.rawCalibrationError === 0
            ? rawCalError
            : (this.rawCalibrationError * 0.95 + rawCalError * 0.05);
        this.calibratedCalibrationError = this.calibratedCalibrationError === 0
            ? calibratedCalError
            : (this.calibratedCalibrationError * 0.95 + calibratedCalError * 0.05);
        this.calibrationSamples += 1;
        this.updateAxisRelevance(
            diff.latentA,
            diff.latentB,
            Math.abs(error) * sampleWeight * (nearTieTarget ? NEAR_TIE_RELEVANCE_DAMP : 1),
        );

        if (Number.isFinite(predictive.rawLogit) && Math.abs(predictive.rawLogit) > 1e-6) {
            const temperature = clampTemperature(this.temperature || DEFAULT_TEMPERATURE);
            const tempGrad = (probabilityCalibrated - targetProbability)
                * (-predictive.rawLogit / Math.max(1e-6, temperature * temperature));
            const tieScale = nearTieTarget ? 0.55 : 1;
            const tempStep = this.temperatureLearningRate * sampleWeight * tieScale;
            this.temperature = clampTemperature(temperature - (tempStep * tempGrad));
        }

        if (this.isLoaded) {
            this.save();
        }
        return {
            probability: probabilityCalibrated,
            probabilityRaw,
            loss,
            calibratedLoss,
            margin: predictive.logit,
            rawMargin: predictive.rawLogit,
            variance: predictive.variance,
            targetProbability,
            uncertaintyBoost,
            temperature: this.temperature,
        };
    }

    async persistState() {
        const state = {
            version: MODEL_VERSION,
            mode: this.mode,
            generationSemantics: this.generationSemantics,
            learningKeyspaceProfile: this.learningKeyspaceProfile,
            latentKeys: this.latentKeys,
            trainingPairs: this.trainingPairs,
            avgPairLoss: this.avgPairLoss,
            avgPredictiveVariance: this.avgPredictiveVariance,
            temperature: this.temperature,
            temperatureLearningRate: this.temperatureLearningRate,
            rawCalibrationError: this.rawCalibrationError,
            calibratedCalibrationError: this.calibratedCalibrationError,
            calibrationSamples: this.calibrationSamples,
            priorPrecision: this.priorPrecision,
            learningRate: this.learningRate,
            basisSeed: this.basisSeed,
            weights: this.weights,
            precision: this.precision,
            axisRelevance: this.axisRelevance,
            groupBasis: this.groupBasis,
        };
        await this.zenThemeModelState.setValue(this.storageKey, JSON.stringify(state));
        return state;
    }

    flushSave() {
        this.modelSaveCoordinator.unregisterPending(this);
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.saveQueued = false;
        return this.persistState();
    }

    discardPendingSaveForProfileMutation() {
        this.modelSaveCoordinator.unregisterPending(this);
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.saveQueued = false;
    }

    scheduleSave() {
        this.saveQueued = true;
        this.modelSaveCoordinator.registerPending(this);
        if (this.saveTimer) {
            return;
        }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            if (!this.saveQueued) {
                return;
            }
            this.saveQueued = false;
            this.modelSaveCoordinator.unregisterPending(this);
            void this.persistState().catch(surfaceAsyncPersistError);
        }, SAVE_DEBOUNCE_MS);
    }

    save(options = {}) {
        if (options?.immediate) {
            return this.flushSave();
        }
        this.scheduleSave();
        return Promise.resolve();
    }

    async load() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = (async () => {
            const raw = await this.zenThemeModelState.getValueForBootstrap(this.storageKey);

            if (raw !== null && raw !== undefined) {
                let state = null;
                try {
                    state = JSON.parse(raw);
                } catch (error) {
                    throw createPairwiseModelStateError(
                        'ZEN_PAIRWISE_MODEL_STATE_JSON_INVALID',
                        `Pairwise GP state '${this.storageKey}' contains invalid JSON.`,
                        { storageKey: this.storageKey },
                        error,
                    );
                }
                try {
                    requireZenThemeModelStateValue(
                        DEFAULT_MODEL_STORAGE_KEY,
                        JSON.stringify(state),
                    );
                } catch (error) {
                    throw createPairwiseModelStateError(
                        'ZEN_PAIRWISE_MODEL_STATE_INVALID',
                        `Pairwise GP state '${this.storageKey}' failed validation.`,
                        { storageKey: this.storageKey },
                        error,
                    );
                }

                if (!this.isStateValid(state)) {
                    throw createPairwiseModelStateError(
                        'ZEN_PAIRWISE_MODEL_STATE_INVALID',
                        `Pairwise GP state '${this.storageKey}' failed current-profile validation.`,
                        { storageKey: this.storageKey },
                    );
                }

                this.restorePosterior(state);
                this.isLoaded = true;
                return;
            }

            this.initialize();
            this.isLoaded = true;
            await this.save({ immediate: true });
        })();

        return this.loadPromise;
    }

    reset() {
        this.initialize();
        return this.save({ immediate: true });
    }

    getMeta() {
        const sortedRelevance = this.axisRelevance
            .map((value, index) => ({
                key: this.latentKeys[index],
                relevance: round(value, 4),
            }))
            .sort((left, right) => Number(right.relevance) - Number(left.relevance));
        const activeDimensions = sortedRelevance.filter((entry) => Number(entry.relevance) > 0.12).length;
        const prunedDimensions = sortedRelevance.filter((entry) => Number(entry.relevance) < 0.08).length;
        return {
            mode: this.mode,
            version: MODEL_VERSION,
            generationSemantics: this.generationSemantics,
            inputBasis: SAKURA_PAIRWISE_INPUT_BASIS,
            predictionContractId: SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID,
            structuralDescriptorRole: 'acquisition_only_not_model_input',
            legacyTreeFeatureFallbackEnabled: true,
            learningKeyspaceProfile: this.learningKeyspaceProfile,
            latentSize: this.latentSize,
            inputSize: this.inputSize,
            effectivePairBasisSize: Math.max(0, this.inputSize - 1),
            groupCount: this.groupBasis.length,
            trainingPairs: this.trainingPairs,
            avgPairLoss: round(this.avgPairLoss),
            avgPredictiveVariance: round(this.avgPredictiveVariance),
            temperature: round(this.temperature, 4),
            rawCalibrationError: round(this.rawCalibrationError),
            calibratedCalibrationError: round(this.calibratedCalibrationError),
            calibrationSamples: this.calibrationSamples,
            activeDimensions,
            prunedDimensions,
            topRelevantLatents: sortedRelevance.slice(0, 6),
        };
    }
}
