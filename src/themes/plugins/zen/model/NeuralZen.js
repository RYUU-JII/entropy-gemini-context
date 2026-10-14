import { TREE_FEATURE_KEYS } from './TreeAnalyzer';
import {
    createZenThemeModelState,
    requireZenThemeModelStateValue,
    ZEN_THEME_MODEL_STATE_KEYS,
} from '@/themes/plugins/zen/state/ZenThemeModelState.js';
import { createZenModelSaveCoordinator } from '@/themes/plugins/zen/runtime/createZenThemeModelRuntime.js';
import {
    NEURAL_SKELETON_POOLED_SIZE,
    averagePoolNeuralPreferenceSkeleton,
} from './NeuralPreferenceEncoding';

export const NEURAL_ZEN_MODEL_VERSION = 3;
export const NEURAL_ZEN_SCALAR_INPUT_SIZE = 22;
export const NEURAL_ZEN_DEFAULT_HIDDEN_SIZE = 32;
export const NEURAL_ZEN_WEIGHT_DECAY = 0.0001;

const MODEL_VERSION = NEURAL_ZEN_MODEL_VERSION;
const DEFAULT_BRAIN_STORAGE_KEY = ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_TRAINING_LOG;
const SAVE_DEBOUNCE_MS = 600;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const createNeuralZenStateError = (code, message, details = null, cause = null) => {
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

const EMPTY_POOLED_SKELETON = Object.freeze(Array(NEURAL_SKELETON_POOLED_SIZE).fill(0));

export class NeuralZen {
    constructor(options = {}) {
        if (Object.prototype.hasOwnProperty.call(options, 'storageKey')) {
            throw new Error('ZEN_NEURAL_MODEL_STORAGE_KEY_OVERRIDE_FORBIDDEN');
        }
        this.zenThemeModelState = options?.zenThemeModelState || createZenThemeModelState({
            modelStateStore: options?.modelStateStore,
            profileGenerationLease: options?.profileGenerationLease,
        });
        this.modelSaveCoordinator = options?.modelSaveCoordinator || createZenModelSaveCoordinator();
        this.featureKeys = [...TREE_FEATURE_KEYS];
        if (this.featureKeys.length !== NEURAL_ZEN_SCALAR_INPUT_SIZE) {
            throw new Error(
                `ZEN_NEURAL_MODEL_SCALAR_INPUT_SIZE_INVALID:${this.featureKeys.length}`,
            );
        }
        this.inputSize = this.featureKeys.length + NEURAL_SKELETON_POOLED_SIZE;
        const hiddenSize = options.hiddenSize ?? NEURAL_ZEN_DEFAULT_HIDDEN_SIZE;
        if (!Number.isSafeInteger(hiddenSize) || hiddenSize <= 0) {
            throw new RangeError('ZEN_NEURAL_MODEL_HIDDEN_SIZE_INVALID');
        }
        this.hiddenSize = hiddenSize;
        this.outputSize = 1;
        const learningRate = options.learningRate ?? 0.03;
        if (!Number.isFinite(learningRate) || learningRate <= 0) {
            throw new RangeError('ZEN_NEURAL_MODEL_LEARNING_RATE_INVALID');
        }
        this.learningRate = learningRate;
        this.storageKey = DEFAULT_BRAIN_STORAGE_KEY;

        this.weights1 = null;
        this.weights2 = null;
        this.bias1 = null;
        this.bias2 = null;

        this.trainingSteps = 0;
        this.avgAbsError = 0;
        this.saveTimer = null;
        this.saveQueued = false;
        this.isLoaded = false;
        this.loadPromise = null;

        this.initialize(); // Ensure not null before async load
        this.modelSaveCoordinator.flushPending();
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    sigmoidDerivative(sigmoidOutput) {
        return sigmoidOutput * (1 - sigmoidOutput);
    }

    vectorize(input) {
        // Input can be just features or full analysis object.
        const features = input.features || input;
        const skeleton = input.skeleton;

        const scalarVec = this.featureKeys.map((key) => {
            const value = Number(features[key]);
            return Number.isFinite(value) ? value : 0;
        });

        const gridVec = skeleton === null
            || typeof skeleton === 'undefined'
            || skeleton.length === 0
            ? EMPTY_POOLED_SKELETON
            : averagePoolNeuralPreferenceSkeleton(skeleton);

        return scalarVec.concat(gridVec);
    }

    initialize() {
        const initRange1 = Math.sqrt(6 / (this.inputSize + this.hiddenSize));
        const initRange2 = Math.sqrt(6 / (this.hiddenSize + this.outputSize));

        this.weights1 = Array.from({ length: this.inputSize }, () => (
            Array.from({ length: this.hiddenSize }, () => (Math.random() * 2 - 1) * initRange1)
        ));

        this.weights2 = Array.from({ length: this.hiddenSize }, () => (
            Array.from({ length: this.outputSize }, () => (Math.random() * 2 - 1) * initRange2)
        ));

        this.bias1 = Array.from({ length: this.hiddenSize }, () => 0);
        this.bias2 = Array.from({ length: this.outputSize }, () => 0);
        this.trainingSteps = 0;
        this.avgAbsError = 0;
    }

    isStateValid(state) {
        try {
            requireZenThemeModelStateValue(
                DEFAULT_BRAIN_STORAGE_KEY,
                JSON.stringify(state),
            );
        } catch (_) {
            return false;
        }
        if (!Array.isArray(state.featureKeys) || state.featureKeys.length !== this.featureKeys.length) {
            return false;
        }
        for (let index = 0; index < this.featureKeys.length; index += 1) {
            if (state.featureKeys[index] !== this.featureKeys[index]) {
                return false;
            }
        }
        if (
            state.version !== MODEL_VERSION
            || state.inputSize !== this.inputSize
            || state.hiddenSize !== this.hiddenSize
        ) {
            return false;
        }
        if (!Array.isArray(state.w1) || state.w1.length !== this.inputSize) return false;
        if (!Array.isArray(state.w2) || state.w2.length !== this.hiddenSize) return false;
        if (!Array.isArray(state.b1) || state.b1.length !== this.hiddenSize) return false;
        if (!Array.isArray(state.b2) || state.b2.length !== this.outputSize) return false;
        return true;
    }

    forward(inputs) {
        const hiddenRaw = this.bias1.map((bias, hiddenIndex) => {
            let sum = bias;
            for (let inputIndex = 0; inputIndex < this.inputSize; inputIndex += 1) {
                sum += inputs[inputIndex] * this.weights1[inputIndex][hiddenIndex];
            }
            return sum;
        });

        const hidden = hiddenRaw.map((raw) => this.sigmoid(raw));

        const outputRaw = this.bias2.map((bias, outputIndex) => {
            let sum = bias;
            for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
                sum += hidden[hiddenIndex] * this.weights2[hiddenIndex][outputIndex];
            }
            return sum;
        });

        const output = outputRaw.map((raw) => this.sigmoid(raw));
        return { hidden, output };
    }

    predict(features) {
        const inputs = this.vectorize(features);
        const { output } = this.forward(inputs);
        return clamp01(output[0]);
    }

    predictDetailed(features) {
        const inputs = this.vectorize(features);
        const { hidden, output } = this.forward(inputs);
        const score = clamp01(output[0]);
        return {
            score,
            // Confidence should increase as prediction moves away from 0.5.
            confidence: clamp01(Math.abs(score - 0.5) * 2),
            inputs,
            hidden,
        };
    }

    train(features, target, options = {}) {
        const inputs = this.vectorize(features);
        const targetValue = clamp01(Number.isFinite(target) ? target : 0.5);
        const sampleWeight = Number.isFinite(options.sampleWeight) ? options.sampleWeight : 1;
        const lr = this.learningRate * Math.max(0.05, sampleWeight);

        const { hidden, output } = this.forward(inputs);
        const prediction = output[0];

        const error = targetValue - prediction;
        const dOutput = error * this.sigmoidDerivative(prediction);

        const dHidden = hidden.map((hiddenValue, hiddenIndex) => {
            const backprop = dOutput * this.weights2[hiddenIndex][0];
            return backprop * this.sigmoidDerivative(hiddenValue);
        });

        for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
            this.weights2[hiddenIndex][0] += lr * (
                (dOutput * hidden[hiddenIndex])
                - (NEURAL_ZEN_WEIGHT_DECAY * this.weights2[hiddenIndex][0])
            );
        }
        this.bias2[0] += lr * dOutput;

        for (let inputIndex = 0; inputIndex < this.inputSize; inputIndex += 1) {
            for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
                this.weights1[inputIndex][hiddenIndex] += lr * (
                    (dHidden[hiddenIndex] * inputs[inputIndex])
                    - (NEURAL_ZEN_WEIGHT_DECAY * this.weights1[inputIndex][hiddenIndex])
                );
            }
        }

        for (let hiddenIndex = 0; hiddenIndex < this.hiddenSize; hiddenIndex += 1) {
            this.bias1[hiddenIndex] += lr * dHidden[hiddenIndex];
        }

        this.trainingSteps += 1;
        const absErr = Math.abs(error);
        this.avgAbsError = this.avgAbsError === 0
            ? absErr
            : (this.avgAbsError * 0.95 + absErr * 0.05);

        if (this.isLoaded) {
            this.save();
        }
        return error;
    }

    trainBatch(samples = [], options = {}) {
        let accError = 0;
        let count = 0;
        samples.forEach((sample) => {
            if (!sample || !sample.features) return;
            const target = Number.isFinite(sample.target) ? sample.target : 0.5;
            const sampleWeight = Number.isFinite(sample.weight) ? sample.weight : 1;
            const err = this.train(sample.features, target, {
                sampleWeight: sampleWeight * (options.weightMultiplier || 1),
            });
            if (Number.isFinite(err)) {
                accError += Math.abs(err);
                count += 1;
            }
        });
        return {
            count,
            meanAbsError: count ? accError / count : 0,
        };
    }

    async persistState() {
        const stringifyWithPrecision = (obj, precision = 5) => JSON.stringify(obj, (key, value) => {
            if (typeof value === 'number') {
                return Number(value.toFixed(precision));
            }
            return value;
        });

        const state = {
            version: MODEL_VERSION,
            inputSize: this.inputSize,
            hiddenSize: this.hiddenSize,
            featureKeys: this.featureKeys,
            trainingSteps: this.trainingSteps,
            avgAbsError: this.avgAbsError,
            w1: this.weights1,
            w2: this.weights2,
            b1: this.bias1,
            b2: this.bias2,
        };

        const data = stringifyWithPrecision(state);
        await this.zenThemeModelState.setValue(this.storageKey, data);
        return data;
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
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            const current = await this.zenThemeModelState.getValueForBootstrap(this.storageKey);

            if (current !== null && current !== undefined) {
                let state = null;
                try {
                    state = JSON.parse(current);
                } catch (error) {
                    throw createNeuralZenStateError(
                        'ZEN_NEURAL_MODEL_STATE_JSON_INVALID',
                        `NeuralZen state '${this.storageKey}' contains invalid JSON.`,
                        { storageKey: this.storageKey },
                        error,
                    );
                }
                if (!this.isStateValid(state)) {
                    throw createNeuralZenStateError(
                        'ZEN_NEURAL_MODEL_STATE_INVALID',
                        `NeuralZen state '${this.storageKey}' failed validation.`,
                        { storageKey: this.storageKey },
                    );
                }
                this.weights1 = state.w1;
                this.weights2 = state.w2;
                this.bias1 = state.b1;
                this.bias2 = state.b2;
                this.trainingSteps = state.trainingSteps;
                this.avgAbsError = state.avgAbsError;
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
        return {
            version: MODEL_VERSION,
            inputSize: this.inputSize,
            hiddenSize: this.hiddenSize,
            trainingSteps: this.trainingSteps,
            avgAbsError: Number(this.avgAbsError.toFixed(6)),
        };
    }
}
