import {
    VNEXT_FACTOR_KEYS_V2,
    getDefaultFactorVectorV2,
    normalizeFactorVectorV2,
} from '../factors/FactorSchemaV2';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(Number(value)) ? Number(value) : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const sigmoid = (z) => 1 / (1 + Math.exp(-clamp(toNumber(z, 0), -30, 30)));
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENCY_HALF_LIFE_DAYS = 21;

export const ZEN_VNEXT_PREFERENCE_MODEL_VERSION = 1;
export const ZEN_VNEXT_PREFERENCE_MODEL_STORAGE_KEY = 'zen_vnext_preference_model_v1';
export const ZEN_VNEXT_PREFERENCE_FACTOR_SIGNATURE = VNEXT_FACTOR_KEYS_V2.join('|');

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const toObject = (value) => (isPlainObject(value) ? value : {});
const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

const PREFERENCE_MODEL_KEYS = Object.freeze([
    'version',
    'bias',
    'weights',
    'featureKeys',
    'trainedAt',
    'sampleCount',
    'metrics',
    'training',
]);
const PREFERENCE_MODEL_METRIC_KEYS = Object.freeze([
    'loss',
    'accuracy',
    'meanMargin',
    'weightSum',
]);
const PREFERENCE_MODEL_TRAINING_KEYS = Object.freeze([
    'sourceTrialCount',
    'uniquePairCount',
    'repeatPairCount',
    'manualTrialCount',
    'autoTrialCount',
    'latestTrialAt',
    'datasetWeightSum',
    'meanSampleWeight',
    'factorSignature',
]);

const normalizeCandidate = (candidate = {}) => {
    const safe = toObject(candidate);
    return {
        seed: Number.isFinite(Number(safe.seed)) ? Math.floor(Number(safe.seed)) : null,
        factors: normalizeFactorVectorV2({
            ...getDefaultFactorVectorV2(),
            ...(toObject(safe.factors)),
        }),
    };
};

const serializeCandidateForPairKey = (candidate = {}) => {
    const normalized = normalizeCandidate(candidate);
    const factorToken = VNEXT_FACTOR_KEYS_V2
        .map((key) => `${key}:${round(toNumber(normalized?.factors?.[key], 0), 4).toFixed(4)}`)
        .join(',');
    return `${normalized.seed ?? 'null'}|${factorToken}`;
};

const resolveTrialPairKey = ({
    candidateA = {},
    candidateB = {},
} = {}) => (
    [
        serializeCandidateForPairKey(candidateA),
        serializeCandidateForPairKey(candidateB),
    ].sort().join('::')
);

const normalizeTrialContext = (context = {}) => {
    const safe = toObject(context);
    return {
        loopMode: safe.loopMode === 'auto' ? 'auto' : 'manual',
        reliabilityAtPrepare: Number.isFinite(Number(safe.reliabilityAtPrepare))
            ? clamp01(Number(safe.reliabilityAtPrepare))
            : null,
        modelSampleCountAtPrepare: Number.isFinite(Number(safe.modelSampleCountAtPrepare))
            ? Math.max(0, Math.floor(Number(safe.modelSampleCountAtPrepare)))
            : 0,
        modelAccuracyAtPrepare: Number.isFinite(Number(safe.modelAccuracyAtPrepare))
            ? clamp01(Number(safe.modelAccuracyAtPrepare))
            : 0,
    };
};

const normalizeTrial = (trial = {}) => {
    const safe = toObject(trial);
    const candidateA = normalizeCandidate(safe.candidateA);
    const candidateB = normalizeCandidate(safe.candidateB);
    return {
        id: typeof safe.id === 'string' ? safe.id : '',
        createdAt: Math.max(0, Math.floor(toNumber(safe.createdAt, 0))),
        chosen: String(safe.chosen || 'A').toUpperCase() === 'B' ? 'B' : 'A',
        pairKey: typeof safe.pairKey === 'string' && safe.pairKey.trim()
            ? safe.pairKey.trim()
            : resolveTrialPairKey({ candidateA, candidateB }),
        candidateA,
        candidateB,
        context: normalizeTrialContext(safe.context),
    };
};

const normalizeTrialList = (trials = []) => (
    (Array.isArray(trials) ? trials : [])
        .map((entry) => normalizeTrial(entry))
        .sort((a, b) => {
            const diff = Number(a.createdAt) - Number(b.createdAt);
            if (diff !== 0) {
                return diff;
            }
            return String(a.id).localeCompare(String(b.id));
        })
);

const factorVectorToArray = (factors = {}) => (
    VNEXT_FACTOR_KEYS_V2.map((key) => clamp01(toNumber(factors?.[key], 0)))
);

export const scoreVNextPreferenceModel = ({
    model = null,
    factors = {},
} = {}) => {
    if (model === null || model === undefined) {
        return 0.5;
    }
    const safeModel = normalizeVNextPreferenceModel(model);
    const weights = safeModel.weights;
    const input = factorVectorToArray(factors);
    const bias = toNumber(safeModel.bias, 0);
    const dot = input.reduce((acc, value, index) => acc + (value * toNumber(weights[index], 0)), bias);
    return clamp01(sigmoid(dot));
};

export const normalizeVNextPreferenceModel = (raw = null) => {
    if (!hasExactKeys(raw, PREFERENCE_MODEL_KEYS)) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_FIELDS_INVALID');
    }
    if (raw.version !== ZEN_VNEXT_PREFERENCE_MODEL_VERSION) {
        throw new Error(`ZEN_VNEXT_PREFERENCE_MODEL_VERSION_INVALID:${raw.version ?? 'missing'}`);
    }
    if (!Array.isArray(raw.featureKeys)
        || raw.featureKeys.length !== VNEXT_FACTOR_KEYS_V2.length
        || raw.featureKeys.some((key, index) => key !== VNEXT_FACTOR_KEYS_V2[index])) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_FEATURE_CONTRACT_INVALID');
    }
    if (!Array.isArray(raw.weights)
        || raw.weights.length !== VNEXT_FACTOR_KEYS_V2.length
        || !raw.weights.every(isFiniteNumber)) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_WEIGHTS_INVALID');
    }
    if (!isFiniteNumber(raw.bias)
        || !isNonNegativeInteger(raw.trainedAt)
        || !isNonNegativeInteger(raw.sampleCount)) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_SCALARS_INVALID');
    }
    if (!hasExactKeys(raw.metrics, PREFERENCE_MODEL_METRIC_KEYS)
        || !Object.values(raw.metrics).every(isFiniteNumber)
        || raw.metrics.loss < 0
        || raw.metrics.accuracy < 0
        || raw.metrics.accuracy > 1
        || raw.metrics.meanMargin < 0
        || raw.metrics.meanMargin > 1
        || raw.metrics.weightSum < 0) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_METRICS_INVALID');
    }
    const training = raw.training;
    if (!hasExactKeys(training, PREFERENCE_MODEL_TRAINING_KEYS)
        || ![
            training.sourceTrialCount,
            training.uniquePairCount,
            training.repeatPairCount,
            training.manualTrialCount,
            training.autoTrialCount,
            training.latestTrialAt,
        ].every(isNonNegativeInteger)
        || !isFiniteNumber(training.datasetWeightSum)
        || training.datasetWeightSum < 0
        || !isFiniteNumber(training.meanSampleWeight)
        || training.meanSampleWeight < 0
        || training.factorSignature !== ZEN_VNEXT_PREFERENCE_FACTOR_SIGNATURE
        || training.sourceTrialCount !== raw.sampleCount
        || (training.manualTrialCount + training.autoTrialCount) !== training.sourceTrialCount
        || training.uniquePairCount > training.sourceTrialCount
        || training.repeatPairCount > training.uniquePairCount) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_TRAINING_INVALID');
    }
    return {
        version: ZEN_VNEXT_PREFERENCE_MODEL_VERSION,
        bias: raw.bias,
        weights: [...raw.weights],
        featureKeys: [...VNEXT_FACTOR_KEYS_V2],
        trainedAt: raw.trainedAt,
        sampleCount: raw.sampleCount,
        metrics: { ...raw.metrics },
        training: { ...training },
    };
};

const createPreferenceTrainingMetadata = (summary, sourceTrialCount) => ({
    sourceTrialCount,
    uniquePairCount: summary.uniquePairCount,
    repeatPairCount: summary.repeatPairCount,
    manualTrialCount: summary.manualTrialCount,
    autoTrialCount: summary.autoTrialCount,
    latestTrialAt: summary.latestTrialAt,
    datasetWeightSum: summary.totalWeight,
    meanSampleWeight: summary.meanSampleWeight,
    factorSignature: summary.factorSignature,
});

export const buildVNextPreferenceDataset = ({
    trials = [],
} = {}) => {
    const normalized = normalizeTrialList(trials);
    const pairCounts = normalized.reduce((acc, entry) => {
        const nextCount = (acc.get(entry.pairKey) || 0) + 1;
        acc.set(entry.pairKey, nextCount);
        return acc;
    }, new Map());
    const latestTrialAt = normalized.reduce((acc, entry) => Math.max(acc, entry.createdAt), 0);
    const manualTrialCount = normalized.reduce((acc, entry) => (
        acc + (entry?.context?.loopMode === 'auto' ? 0 : 1)
    ), 0);
    const autoTrialCount = Math.max(0, normalized.length - manualTrialCount);

    const entries = normalized.map((entry) => {
        const vectorA = factorVectorToArray(entry.candidateA.factors);
        const vectorB = factorVectorToArray(entry.candidateB.factors);
        const diff = vectorA.map((value, index) => value - vectorB[index]);
        const target = entry.chosen === 'A' ? 1 : 0;
        const pairRepeatCount = Math.max(1, Math.floor(toNumber(pairCounts.get(entry.pairKey), 1)));
        const ageDays = latestTrialAt > 0
            ? Math.max(0, (latestTrialAt - entry.createdAt) / DAY_MS)
            : 0;
        const recencyWeight = clamp(
            0.58 + (Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS) * 0.42),
            0.58,
            1,
        );
        const repeatWeight = 1 / Math.sqrt(pairRepeatCount);
        const reliabilityWeight = entry?.context?.reliabilityAtPrepare == null
            ? 0.88
            : (0.76 + (clamp01(entry.context.reliabilityAtPrepare) * 0.24));
        const loopWeight = entry?.context?.loopMode === 'auto' ? 0.92 : 1;
        const modelGuidanceStrength = clamp01(entry?.context?.modelAccuracyAtPrepare)
            * clamp01(toNumber(entry?.context?.modelSampleCountAtPrepare, 0) / 120);
        const antiEchoWeight = 1 - (
            modelGuidanceStrength
            * (entry?.context?.loopMode === 'auto' ? 0.14 : 0.07)
        );
        const weight = clamp(
            recencyWeight * repeatWeight * reliabilityWeight * loopWeight * antiEchoWeight,
            0.12,
            1.15,
        );
        return {
            x: diff,
            y: target,
            weight: round(weight, 6),
            pairKey: entry.pairKey,
            createdAt: entry.createdAt,
            id: entry.id,
        };
    });

    const totalWeight = entries.reduce((acc, entry) => acc + toNumber(entry.weight, 0), 0);
    return {
        entries,
        summary: {
            trialCount: normalized.length,
            uniquePairCount: pairCounts.size,
            repeatPairCount: [...pairCounts.values()].filter((count) => count >= 2).length,
            manualTrialCount,
            autoTrialCount,
            latestTrialAt,
            totalWeight: round(totalWeight, 6),
            meanSampleWeight: normalized.length
                ? round(totalWeight / normalized.length, 6)
                : 0,
            factorSignature: ZEN_VNEXT_PREFERENCE_FACTOR_SIGNATURE,
        },
    };
};

export const isVNextPreferenceModelStale = ({
    model = null,
    trialCount = 0,
    minTrials = 10,
    toleratedLag = null,
} = {}) => {
    const safeTrialCount = Math.max(0, Math.floor(toNumber(trialCount, 0)));
    const safeMinTrials = Math.max(1, Math.floor(toNumber(minTrials, 10)));
    if (safeTrialCount < safeMinTrials) {
        return false;
    }
    if (model === null || model === undefined) {
        return true;
    }
    if (!isPlainObject(model)) {
        throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_STATE_INVALID');
    }
    const normalized = normalizeVNextPreferenceModel(model);
    const sourceTrialCount = Math.max(0, Math.floor(toNumber(
        normalized?.training?.sourceTrialCount,
        normalized?.sampleCount,
    )));
    const allowedLag = toleratedLag == null
        ? Math.max(4, Math.min(18, Math.floor(Math.max(safeMinTrials, sourceTrialCount, 1) * 0.25)))
        : Number.isFinite(Number(toleratedLag))
        ? Math.max(1, Math.floor(Number(toleratedLag)))
        : Math.max(4, Math.min(18, Math.floor(Math.max(safeMinTrials, sourceTrialCount, 1) * 0.25)));
    return (
        sourceTrialCount <= 0
        || safeTrialCount > (sourceTrialCount + allowedLag)
    );
};

const evaluateModelOnDataset = ({ weights = [], bias = 0, dataset = [] } = {}) => {
    if (!Array.isArray(dataset) || !dataset.length) {
        return {
            loss: 0,
            accuracy: 0,
            meanMargin: 0,
            weightSum: 0,
        };
    }
    let lossAcc = 0;
    let correct = 0;
    let marginAcc = 0;
    let weightAcc = 0;
    dataset.forEach((entry) => {
        const linear = entry.x.reduce((acc, value, index) => acc + (value * toNumber(weights[index], 0)), bias);
        const prob = clamp01(sigmoid(linear));
        const y = clamp01(toNumber(entry.y, 0));
        const weight = Math.max(1e-6, toNumber(entry.weight, 1));
        const eps = 1e-9;
        const logLoss = -((y * Math.log(Math.max(eps, prob))) + ((1 - y) * Math.log(Math.max(eps, 1 - prob))));
        lossAcc += logLoss * weight;
        const pred = prob >= 0.5 ? 1 : 0;
        if (pred === y) {
            correct += weight;
        }
        marginAcc += (Math.abs(prob - 0.5) * 2) * weight;
        weightAcc += weight;
    });
    const sampleWeight = Math.max(1e-6, weightAcc);
    return {
        loss: round(lossAcc / sampleWeight, 6),
        accuracy: clamp01(correct / sampleWeight),
        meanMargin: round(marginAcc / sampleWeight, 6),
        weightSum: round(sampleWeight, 6),
    };
};

export const trainVNextPreferenceModel = ({
    trials = [],
    existingModel = null,
    epochs = 180,
    learningRate = 0.11,
    l2 = 0.0008,
} = {}) => {
    const { entries: dataset, summary } = buildVNextPreferenceDataset({ trials });
    const featureCount = VNEXT_FACTOR_KEYS_V2.length;
    if (!dataset.length) {
        return normalizeVNextPreferenceModel({
            version: ZEN_VNEXT_PREFERENCE_MODEL_VERSION,
            bias: 0,
            weights: Array.from({ length: featureCount }, () => 0),
            featureKeys: [...VNEXT_FACTOR_KEYS_V2],
            trainedAt: Date.now(),
            sampleCount: 0,
            metrics: {
                loss: 0,
                accuracy: 0,
                meanMargin: 0,
                weightSum: 0,
            },
            training: createPreferenceTrainingMetadata(summary, 0),
        });
    }

    const normalizedExisting = existingModel
        ? normalizeVNextPreferenceModel(existingModel)
        : null;
    const weights = normalizedExisting?.weights?.length === featureCount
        ? normalizedExisting.weights.map((value) => toNumber(value, 0))
        : Array.from({ length: featureCount }, () => 0);
    let bias = toNumber(normalizedExisting?.bias, 0);
    const safeEpochs = Math.max(20, Math.floor(toNumber(epochs, 180)));
    const safeLr = clamp(toNumber(learningRate, 0.11), 0.001, 0.5);
    const safeL2 = clamp(toNumber(l2, 0.0008), 0, 0.2);

    for (let epoch = 0; epoch < safeEpochs; epoch += 1) {
        const gradW = Array.from({ length: featureCount }, () => 0);
        let gradB = 0;
        let totalWeight = 0;
        dataset.forEach((entry) => {
            const linear = entry.x.reduce((acc, value, index) => acc + (value * weights[index]), bias);
            const prob = sigmoid(linear);
            const error = prob - toNumber(entry.y, 0);
            const weight = Math.max(1e-6, toNumber(entry.weight, 1));
            for (let index = 0; index < featureCount; index += 1) {
                gradW[index] += weight * error * entry.x[index];
            }
            gradB += weight * error;
            totalWeight += weight;
        });
        const n = Math.max(1e-6, totalWeight);
        for (let index = 0; index < featureCount; index += 1) {
            const meanGrad = (gradW[index] / n) + (safeL2 * weights[index]);
            weights[index] -= safeLr * meanGrad;
        }
        bias -= safeLr * (gradB / n);
    }

    const metrics = evaluateModelOnDataset({
        weights,
        bias,
        dataset,
    });
    return normalizeVNextPreferenceModel({
        version: ZEN_VNEXT_PREFERENCE_MODEL_VERSION,
        bias,
        weights,
        featureKeys: [...VNEXT_FACTOR_KEYS_V2],
        trainedAt: Date.now(),
        sampleCount: dataset.length,
        metrics,
        training: createPreferenceTrainingMetadata(summary, dataset.length),
    });
};
