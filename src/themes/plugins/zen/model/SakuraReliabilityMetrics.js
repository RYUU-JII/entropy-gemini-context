import {
    isSakuraDecisiveHistoryEntry,
    resolveSakuraHistoryDecisionType,
} from './SakuraLearningPolicy';
import { resolveSakuraPairwiseEvidencePolicy } from './SakuraPairwiseEvidencePolicy.js';
import {
    SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID,
} from './SakuraPairwisePredictionContract.js';
import {
    SAKURA_PREFERENCE_BASIN_STAGE,
    buildSakuraPreferenceBasinModel,
    projectSakuraPreferenceBasinHistory,
} from './SakuraPreferenceBasinModel';
import {
    SAKURA_LEARNING_FACTOR_CATALOG,
} from './v2/SakuraLearningFactorPolicy';
import { resolveSakuraLearningLatentProfile } from './v2/SakuraLatentParamApi';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const CANONICAL_PAIRWISE_PREDICTION_SOURCE = 'pairwise_compare_pre_feedback';
const PREDICTIVE_VALIDATION_WINDOW = 160;
const PAIRWISE_RANDOM_BASELINE_LOG_LOSS = Math.log(2);
const PAIRWISE_EXCESS_LOSS_DECAY = 2;
const PAIRWISE_LOG_LOSS_EPSILON = 1e-6;

const hasOwn = (value, key) => (
    value !== null
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key)
);

const resolvePreferredLabel = (entry = {}) => {
    const picked = String(entry?.picked || '').toUpperCase();
    if (picked === 'A' || picked === 'B') {
        return picked;
    }
    if (picked === 'WORSE_A') {
        return 'B';
    }
    if (picked === 'WORSE_B') {
        return 'A';
    }
    return null;
};

const resolveCanonicalPairwiseProbabilityA = (entry = {}) => {
    const prediction = entry?.prediction;
    if (prediction === null || typeof prediction === 'undefined') {
        return null;
    }
    if (typeof prediction !== 'object' || Array.isArray(prediction)) {
        throw new TypeError('ZEN_SAKURA_PAIRWISE_PREDICTION_OBJECT_REQUIRED');
    }
    if (!hasOwn(prediction, 'pairwiseProbabilityA')) {
        throw new TypeError('ZEN_SAKURA_PAIRWISE_PROBABILITY_A_REQUIRED');
    }
    if (prediction.source !== CANONICAL_PAIRWISE_PREDICTION_SOURCE) {
        throw new TypeError('ZEN_SAKURA_PAIRWISE_PREDICTION_SOURCE_INVALID');
    }
    const probabilityA = Number(prediction.pairwiseProbabilityA);
    if (!Number.isFinite(probabilityA) || probabilityA < 0 || probabilityA > 1) {
        throw new RangeError('ZEN_SAKURA_PAIRWISE_PROBABILITY_A_INVALID');
    }
    return probabilityA;
};

const hasCurrentPairwisePredictionContract = (entry = {}) => {
    const prediction = entry?.prediction;
    if (prediction === null || typeof prediction === 'undefined') {
        return false;
    }
    resolveCanonicalPairwiseProbabilityA(entry);
    if (!hasOwn(prediction, 'modelContractId')) {
        return false;
    }
    if (typeof prediction.modelContractId !== 'string' || !prediction.modelContractId.trim()) {
        throw new TypeError('ZEN_SAKURA_PAIRWISE_PREDICTION_MODEL_CONTRACT_INVALID');
    }
    return prediction.modelContractId === SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID;
};

const resolveLegacyPairwiseProbabilityA = (entry = {}, preferredLabel = null) => {
    const scoreA = Number(
        entry?.A?.pairwiseCalibratedScore
        ?? entry?.A?.pairwiseScore
        ?? entry?.A?.pairwise
        ?? Number.NaN,
    );
    const scoreB = Number(
        entry?.B?.pairwiseCalibratedScore
        ?? entry?.B?.pairwiseScore
        ?? entry?.B?.pairwise
        ?? Number.NaN,
    );
    if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
        return clamp01(0.5 + ((scoreA - scoreB) * 0.5));
    }
    const scoreDelta = Number(entry?.scoreDelta?.pairwise);
    if (!Number.isFinite(scoreDelta) || !preferredLabel) {
        return null;
    }
    const signedDelta = preferredLabel === 'A' ? scoreDelta : -scoreDelta;
    return clamp01(0.5 + (signedDelta * 0.5));
};

const buildPredictiveSample = ({
    entry,
    preferredLabel,
    probabilityA,
    probabilitySource,
}) => {
    const label = preferredLabel === 'A' ? 1 : 0;
    const prediction = probabilityA >= 0.5 ? 1 : 0;
    const confidence = Math.max(probabilityA, 1 - probabilityA);
    return {
        score: clamp01(probabilityA),
        label,
        confidence: clamp01(confidence),
        correct: prediction === label ? 1 : 0,
        probabilitySource,
        historyEntryId: entry?.id ?? null,
    };
};

const buildCanonicalPredictiveWindow = (
    abHistory = [],
    { learningKeyspaceProfile = null } = {},
) => {
    const history = Array.isArray(abHistory) ? abHistory : [];
    return history.map((entry) => {
        const queryKind = String(
            entry?.query?.kind || entry?.generationContext?.queryKind || '',
        ).trim().toLowerCase();
        if (queryKind === 'anchor') {
            return null;
        }
        const decisionType = resolveSakuraHistoryDecisionType(entry);
        if (
            decisionType !== 'decisive'
            && decisionType !== 'neutral'
            && decisionType !== 'abstain'
        ) {
            return null;
        }
        if (
            learningKeyspaceProfile
            && entry?.generationContext?.learningKeyspaceProfile !== learningKeyspaceProfile
        ) {
            return null;
        }
        if (!resolveSakuraPairwiseEvidencePolicy(entry).predictiveGateEligible) {
            return null;
        }
        if (!hasCurrentPairwisePredictionContract(entry)) {
            return null;
        }
        return {
            entry,
            decisionType,
            preferredLabel: decisionType === 'decisive'
                ? resolvePreferredLabel(entry)
                : null,
        };
    }).filter(Boolean).slice(0, PREDICTIVE_VALIDATION_WINDOW);
};

export const buildSakuraPredictiveSamples = (abHistory = [], options = {}) => (
    buildCanonicalPredictiveWindow(abHistory, options)
        .filter((row) => row.decisionType === 'decisive' && row.preferredLabel)
        .map(({ entry, preferredLabel }) => {
            const probabilityA = resolveCanonicalPairwiseProbabilityA(entry);
            if (!Number.isFinite(probabilityA)) {
                return null;
            }
            return buildPredictiveSample({
                entry,
                preferredLabel,
                probabilityA,
                probabilitySource: CANONICAL_PAIRWISE_PREDICTION_SOURCE,
            });
        }).filter(Boolean)
);

export const buildSakuraTieCalibrationSamples = (abHistory = [], options = {}) => (
    buildCanonicalPredictiveWindow(abHistory, options)
        .filter((row) => row.decisionType === 'neutral')
        .map(({ entry }) => {
            const probabilityA = resolveCanonicalPairwiseProbabilityA(entry);
            if (!Number.isFinite(probabilityA)) {
                return null;
            }
            return {
                score: clamp01(probabilityA),
                targetProbability: 0.5,
                absoluteError: Math.abs(probabilityA - 0.5),
                squaredError: (probabilityA - 0.5) ** 2,
                probabilitySource: CANONICAL_PAIRWISE_PREDICTION_SOURCE,
                historyEntryId: entry?.id ?? null,
            };
        })
        .filter(Boolean)
);

export const computeSakuraTieCalibrationError = (samples = []) => {
    const rows = Array.isArray(samples)
        ? samples.filter((entry) => Number.isFinite(entry?.absoluteError))
        : [];
    if (!rows.length) {
        return NaN;
    }
    return rows.reduce((sum, entry) => sum + entry.absoluteError, 0) / rows.length;
};

const clampLogLossProbability = (value) => Math.min(
    1 - PAIRWISE_LOG_LOSS_EPSILON,
    Math.max(PAIRWISE_LOG_LOSS_EPSILON, Number(value)),
);

export const computeSakuraControlledPairwiseLogLoss = ({
    predictiveSamples = [],
    tieCalibrationSamples = [],
} = {}) => {
    const decisiveRows = (Array.isArray(predictiveSamples) ? predictiveSamples : [])
        .filter((sample) => (
            Number.isFinite(Number(sample?.score))
            && (sample?.label === 0 || sample?.label === 1)
        ));
    const tieRows = (Array.isArray(tieCalibrationSamples) ? tieCalibrationSamples : [])
        .filter((sample) => Number.isFinite(Number(sample?.score)));
    const losses = [
        ...decisiveRows.map((sample) => {
            const probabilityA = clampLogLossProbability(sample.score);
            return sample.label === 1
                ? -Math.log(probabilityA)
                : -Math.log(1 - probabilityA);
        }),
        ...tieRows.map((sample) => {
            const probabilityA = clampLogLossProbability(sample.score);
            return -(
                (0.5 * Math.log(probabilityA))
                + (0.5 * Math.log(1 - probabilityA))
            );
        }),
    ];
    if (!losses.length) {
        return Number.NaN;
    }
    return losses.reduce((sum, value) => sum + value, 0) / losses.length;
};

const buildSakuraPredictiveWindowDiagnostics = (abHistory = [], options = {}) => {
    const rows = buildCanonicalPredictiveWindow(abHistory, options);
    return {
        count: rows.length,
        decisiveCount: rows.filter((row) => row.decisionType === 'decisive').length,
        tieResponseCount: rows.filter((row) => row.decisionType === 'neutral').length,
        abstainCount: rows.filter((row) => row.decisionType === 'abstain').length,
    };
};

const buildLegacyEligiblePredictiveRows = (abHistory = []) => {
    const history = Array.isArray(abHistory) ? abHistory : [];
    return history.map((entry) => {
        if (!isSakuraDecisiveHistoryEntry(entry)) {
            return null;
        }
        const queryKind = String(entry?.query?.kind || entry?.generationContext?.queryKind || '').toLowerCase();
        if (queryKind === 'anchor') {
            return null;
        }
        const preferredLabel = resolvePreferredLabel(entry);
        return preferredLabel ? { entry, preferredLabel } : null;
    }).filter(Boolean).slice(0, PREDICTIVE_VALIDATION_WINDOW);
};

export const buildSakuraLegacyPredictiveSamples = (abHistory = []) => (
    buildLegacyEligiblePredictiveRows(abHistory).map(({ entry, preferredLabel }) => {
        // Entries carrying the canonical direct-comparison prediction belong to
        // the canonical metric only. The legacy projection is retained solely
        // to diagnose pre-contract history; it must never feed the gate.
        if (entry?.prediction !== null && typeof entry?.prediction !== 'undefined') {
            resolveCanonicalPairwiseProbabilityA(entry);
            return null;
        }
        const probabilityA = resolveLegacyPairwiseProbabilityA(entry, preferredLabel);
        if (!Number.isFinite(probabilityA)) {
            return null;
        }
        return buildPredictiveSample({
            entry,
            preferredLabel,
            probabilityA,
            probabilitySource: 'legacy_singleton_score_projection',
        });
    }).filter(Boolean)
);

export const computeSakuraBinaryAuc = (samples = []) => {
    const rows = Array.isArray(samples)
        ? samples.filter((entry) => Number.isFinite(entry?.score) && (entry?.label === 0 || entry?.label === 1))
        : [];
    if (!rows.length) {
        return NaN;
    }
    const positives = rows.filter((entry) => entry.label === 1).length;
    const negatives = rows.length - positives;
    if (!positives || !negatives) {
        return NaN;
    }
    const sorted = [...rows].sort((left, right) => left.score - right.score);
    let rank = 1;
    let positiveRankSum = 0;
    for (let index = 0; index < sorted.length;) {
        let cursor = index + 1;
        while (cursor < sorted.length && sorted[cursor].score === sorted[index].score) {
            cursor += 1;
        }
        const tieCount = cursor - index;
        const avgRank = (rank + (rank + tieCount - 1)) / 2;
        for (let tieIndex = index; tieIndex < cursor; tieIndex += 1) {
            if (sorted[tieIndex].label === 1) {
                positiveRankSum += avgRank;
            }
        }
        rank += tieCount;
        index = cursor;
    }
    return (positiveRankSum - ((positives * (positives + 1)) / 2)) / (positives * negatives);
};

export const computeSakuraExpectedCalibrationError = (samples = [], bins = 10) => {
    const rows = Array.isArray(samples)
        ? samples.filter((entry) => Number.isFinite(entry?.score) && (entry?.label === 0 || entry?.label === 1))
        : [];
    const safeBins = Math.max(2, Math.round(Number.isFinite(bins) ? bins : 10));
    if (!rows.length) {
        return NaN;
    }
    const histogram = Array.from({ length: safeBins }, () => ({
        count: 0,
        confidenceSum: 0,
        correctSum: 0,
    }));
    rows.forEach((entry) => {
        const score = clamp01(entry.score);
        const confidence = Math.max(score, 1 - score);
        const prediction = score >= 0.5 ? 1 : 0;
        const correct = prediction === entry.label ? 1 : 0;
        const index = Math.min(safeBins - 1, Math.floor(confidence * safeBins));
        const bucket = histogram[index];
        bucket.count += 1;
        bucket.confidenceSum += confidence;
        bucket.correctSum += correct;
    });
    return histogram.reduce((acc, bucket) => {
        if (!bucket.count) {
            return acc;
        }
        const avgConfidence = bucket.confidenceSum / bucket.count;
        const avgAccuracy = bucket.correctSum / bucket.count;
        return acc + (Math.abs(avgAccuracy - avgConfidence) * (bucket.count / rows.length));
    }, 0);
};

const resolveControlledCoverageFactorIds = (entry = {}) => {
    if (!isSakuraDecisiveHistoryEntry(entry)) {
        return [];
    }
    const context = entry?.generationContext;
    const changedFactors = Array.isArray(context?.changedFactors)
        ? context.changedFactors
            .map((factor) => (typeof factor?.id === 'string' ? factor.id.trim() : ''))
            .filter(Boolean)
        : [];
    const controlledIsolation = context?.pairType === 'isolation_pair'
        && resolveSakuraPairwiseEvidencePolicy(entry).preferenceBasinEligible;
    return controlledIsolation ? changedFactors : [];
};

export const resolveSakuraFactorCoverage = ({
    abHistory = [],
    factorKeys = [],
} = {}) => {
    const history = Array.isArray(abHistory) ? abHistory : [];
    const requestedFactorKeys = Array.isArray(factorKeys)
        ? Array.from(new Set(
            factorKeys
                .filter((key) => typeof key === 'string' && key.trim())
                .map((key) => key.trim()),
        ))
        : [];
    const discoveredFactorKeys = Array.from(new Set(
        history
            .flatMap((entry) => resolveControlledCoverageFactorIds(entry))
            .filter(Boolean),
    ));
    const keys = requestedFactorKeys.length ? requestedFactorKeys : discoveredFactorKeys;
    const counts = keys.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
    let eligiblePairCount = 0;
    let rejectedPairCount = 0;
    history.forEach((entry) => {
        if (!isSakuraDecisiveHistoryEntry(entry)) {
            return;
        }
        const controlledFactorIds = resolveControlledCoverageFactorIds(entry);
        if (!controlledFactorIds.length) {
            rejectedPairCount += 1;
            return;
        }
        eligiblePairCount += 1;
        const uniqueFactorIds = new Set(controlledFactorIds);
        uniqueFactorIds.forEach((factorId) => {
            if (Object.prototype.hasOwnProperty.call(counts, factorId)) {
                counts[factorId] += 1;
            }
        });
    });
    const coverageValues = keys.map((key) => Number(counts[key]) || 0);
    const minCoverage = coverageValues.length ? Math.min(...coverageValues) : 0;
    const averageCoverage = coverageValues.length
        ? coverageValues.reduce((acc, value) => acc + value, 0) / coverageValues.length
        : 0;
    return {
        factorKeys: keys,
        counts,
        totalFactors: keys.length,
        minCoverage,
        averageCoverage,
        eligiblePairCount,
        rejectedPairCount,
    };
};

const ACTIVE_FACTOR_POLICY_BY_KEY = new Map(
    SAKURA_LEARNING_FACTOR_CATALOG
        .filter((factor) => factor.status === 'active' && factor.blocked === false)
        .map((factor) => [factor.key, factor]),
);

const buildSakuraPreferenceBasinMetrics = ({
    abHistory,
    factorKeys,
    learningKeyspaceProfile,
}) => {
    const requestedKeySet = new Set(Array.isArray(factorKeys) ? factorKeys : []);
    const policies = Array.from(ACTIVE_FACTOR_POLICY_BY_KEY.values()).filter(
        (factor) => requestedKeySet.has(factor.key),
    );
    if (!policies.length) {
        return null;
    }
    const activeFactorKeys = policies.map((factor) => factor.key);
    const profile = resolveSakuraLearningLatentProfile(learningKeyspaceProfile);
    const projection = projectSakuraPreferenceBasinHistory({
        abHistory,
        factorKeys: activeFactorKeys,
        learningKeyspaceProfile: profile,
    });
    const model = buildSakuraPreferenceBasinModel({
        abHistory: projection.entries,
        factorKeys: activeFactorKeys,
        learningKeyspaceProfile: profile,
    });
    const policyByKey = new Map(policies.map((factor) => [factor.key, factor]));
    const weighted = model.factors.reduce((acc, factor) => {
        const policy = policyByKey.get(factor.factorKey);
        const weight = Math.max(
            0.05,
            Number(policy?.observability || 0) * Number(policy?.proposalWeight || 0),
        );
        const targetEvidence = Math.max(1, Number(policy?.minEvidence || 1));
        acc.weight += weight;
        acc.evidence += Math.min(1, factor.resolutionEvidenceCount / targetEvidence) * weight;
        if (factor.stage !== SAKURA_PREFERENCE_BASIN_STAGE.EXPLORE) {
            acc.established += weight;
        }
        if (factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE) {
            acc.stable += weight;
        }
        if (
            factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE
            || factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT
        ) {
            acc.resolved += weight;
        }
        if (factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT) {
            acc.indifferent += weight;
        }
        return acc;
    }, {
        weight: 0,
        evidence: 0,
        established: 0,
        stable: 0,
        resolved: 0,
        indifferent: 0,
    });
    const totalWeight = Math.max(1e-6, weighted.weight);
    const factorCoverage = resolveSakuraFactorCoverage({
        abHistory: projection.entries,
        factorKeys: activeFactorKeys,
    });

    return {
        ...model,
        factors: model.factors.map((factor) => ({
            ...factor,
            stable: factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE,
            resolved: factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE
                || factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT,
            minEvidence: policyByKey.get(factor.factorKey)?.minEvidence || 1,
        })),
        evidenceProgress: weighted.evidence / totalWeight,
        establishedFactorRatio: weighted.established / totalWeight,
        stableFactorRatio: weighted.stable / totalWeight,
        resolvedFactorRatio: weighted.resolved / totalWeight,
        indifferentFactorRatio: weighted.indifferent / totalWeight,
        projectedLegacyEntryCount: projection.projectedEntryCount,
        sourceProfileCounts: projection.sourceProfileCounts,
        factorCoverage,
    };
};

export const computeSakuraReliabilityMetrics = ({
    trainingCount = 0,
    pairwiseTrainingCount = 0,
    neuralMeta = null,
    pairwiseMeta = null,
    abHistory = [],
    factorKeys = [],
    learningKeyspaceProfile = null,
} = {}) => {
    const neuralSteps = Math.max(0, Math.floor(trainingCount));
    const globalPairwiseSteps = Math.max(0, Math.floor(pairwiseTrainingCount));
    const neuralError = Math.max(0, Number(neuralMeta?.avgAbsError || 0));
    const globalPairwiseLoss = Math.max(0, Number(pairwiseMeta?.avgPairLoss || 0));
    const neuralReliability = clamp01(
        (Math.min(1, neuralSteps / 160) * 0.6)
        + (Math.max(0, 1 - (neuralError / 0.45)) * 0.4),
    );
    const globalPairwiseVolume = Math.min(1, globalPairwiseSteps / 120);
    const globalPairwiseExcessLoss = Math.max(
        0,
        globalPairwiseLoss - PAIRWISE_RANDOM_BASELINE_LOG_LOSS,
    );
    const globalPairwiseLossQuality = Math.exp(
        -PAIRWISE_EXCESS_LOSS_DECAY * globalPairwiseExcessLoss,
    );
    const globalPairwiseReliability = clamp01(
        globalPairwiseVolume * globalPairwiseLossQuality,
    );
    const resolvedLearningKeyspaceProfile = resolveSakuraLearningLatentProfile(
        learningKeyspaceProfile,
    );
    const predictiveSamples = buildSakuraPredictiveSamples(abHistory, {
        learningKeyspaceProfile: factorKeys.length
            ? resolvedLearningKeyspaceProfile
            : null,
    });
    const predictiveWindow = buildSakuraPredictiveWindowDiagnostics(abHistory, {
        learningKeyspaceProfile: factorKeys.length
            ? resolvedLearningKeyspaceProfile
            : null,
    });
    const tieCalibrationSamples = buildSakuraTieCalibrationSamples(abHistory, {
        learningKeyspaceProfile: factorKeys.length
            ? resolvedLearningKeyspaceProfile
            : null,
    });
    const tieCalibrationError = computeSakuraTieCalibrationError(tieCalibrationSamples);
    const pairwiseSteps = predictiveSamples.length + tieCalibrationSamples.length;
    const pairwiseLoss = computeSakuraControlledPairwiseLogLoss({
        predictiveSamples,
        tieCalibrationSamples,
    });
    const pairwiseVolume = Math.min(1, pairwiseSteps / 120);
    // This is the optimize-gate population: controlled, non-anchor questions
    // with an exact pre-feedback prediction. Discovery may train the latent GP,
    // but it cannot inflate either this volume or this loss quality.
    const pairwiseExcessLoss = Number.isFinite(pairwiseLoss)
        ? Math.max(0, pairwiseLoss - PAIRWISE_RANDOM_BASELINE_LOG_LOSS)
        : Number.POSITIVE_INFINITY;
    const pairwiseLossQuality = Number.isFinite(pairwiseLoss)
        ? clamp01(
            (PAIRWISE_RANDOM_BASELINE_LOG_LOSS - pairwiseLoss)
            / PAIRWISE_RANDOM_BASELINE_LOG_LOSS,
        )
        : 0;
    // Readiness requires both enough current-contract evidence and genuine
    // predictive skill over a p=0.5 model. Taking the weaker term prevents
    // either sample volume or apparent calibration from hiding no-skill output.
    const pairwiseReliability = Math.min(pairwiseVolume, pairwiseLossQuality);
    const predictiveAuc = computeSakuraBinaryAuc(predictiveSamples);
    const predictiveEce = computeSakuraExpectedCalibrationError(predictiveSamples, 10);
    const predictiveAccuracy = predictiveSamples.length
        ? predictiveSamples.reduce((acc, entry) => acc + entry.correct, 0) / predictiveSamples.length
        : NaN;
    const legacyPredictiveSamples = buildSakuraLegacyPredictiveSamples(abHistory);
    const legacyPredictiveAuc = computeSakuraBinaryAuc(legacyPredictiveSamples);
    const legacyPredictiveEce = computeSakuraExpectedCalibrationError(legacyPredictiveSamples, 10);
    const legacyPredictiveAccuracy = legacyPredictiveSamples.length
        ? legacyPredictiveSamples.reduce((acc, entry) => acc + entry.correct, 0) / legacyPredictiveSamples.length
        : NaN;
    const positivePredictiveSamples = predictiveSamples.filter((sample) => sample.label === 1).length;
    const negativePredictiveSamples = predictiveSamples.length - positivePredictiveSamples;
    const predictiveLabelBalance = predictiveSamples.length
        ? (Math.min(positivePredictiveSamples, negativePredictiveSamples) * 2) / predictiveSamples.length
        : 0;
    const preferenceBasin = buildSakuraPreferenceBasinMetrics({
        abHistory,
        factorKeys,
        learningKeyspaceProfile,
    });
    const factorCoverage = preferenceBasin?.factorCoverage
        || resolveSakuraFactorCoverage({ abHistory, factorKeys });
    return {
        neuralSteps,
        pairwiseSteps,
        neuralError,
        pairwiseLoss,
        pairwiseExcessLoss,
        pairwiseLossQuality,
        neuralReliability,
        pairwiseReliability,
        globalPairwiseSteps,
        globalPairwiseLoss,
        globalPairwiseExcessLoss,
        globalPairwiseLossQuality,
        globalPairwiseReliability,
        predictiveWindow,
        predictiveSamples,
        predictiveAuc,
        predictiveEce,
        predictiveAccuracy,
        positivePredictiveSamples,
        negativePredictiveSamples,
        predictiveLabelBalance,
        tieCalibrationSamples,
        tieCalibrationResponseCount: predictiveWindow.tieResponseCount,
        tieCalibrationError,
        legacyPredictiveSamples,
        legacyPredictiveAuc,
        legacyPredictiveEce,
        legacyPredictiveAccuracy,
        factorCoverage,
        preferenceBasin,
    };
};
