import {
    VNEXT_FACTOR_KEYS_V2,
    getDefaultFactorVectorV2,
    getFactorSchemaDefV2,
    normalizeFactorVectorV2,
} from '../factors/FactorSchemaV2';
import { scoreVNextPreferenceModel } from './VNextPreferenceModel';

const DAY_MS = 24 * 60 * 60 * 1000;

const createVNextComparePairPolicyError = (
    code = 'ZEN_VNEXT_COMPARE_PAIR_INVALID',
    message = 'VNext compare pair selection is invalid.',
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(Number(value)) ? Number(value) : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const normalizeCandidate = (candidate = null, origin = 'archive') => {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const seed = Number(candidate?.seed);
    if (!Number.isFinite(seed)) {
        return null;
    }
    return {
        seed: Math.floor(seed),
        origin,
        factors: normalizeFactorVectorV2({
            ...getDefaultFactorVectorV2(),
            ...(candidate?.factors || {}),
        }),
        scores: {
            objective: clamp01(toNumber(candidate?.scores?.objective, 0)),
        },
    };
};

const buildCandidateKey = (candidate = {}) => (
    `${candidate.seed}|${VNEXT_FACTOR_KEYS_V2.map((key) => round(toNumber(candidate?.factors?.[key], 0), 4)).join(',')}`
);

const dedupeCandidates = (candidates = []) => {
    const byKey = new Map();
    (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
        const normalized = normalizeCandidate(candidate, candidate?.origin || 'archive');
        if (!normalized) {
            return;
        }
        const key = buildCandidateKey(normalized);
        const existing = byKey.get(key);
        if (!existing || toNumber(normalized?.scores?.objective, 0) > toNumber(existing?.scores?.objective, 0)) {
            byKey.set(key, normalized);
        }
    });
    return [...byKey.values()];
};

const createFactorCoverageMap = ({
    feedbackTrials = [],
} = {}) => {
    const normalizedTrials = Array.isArray(feedbackTrials)
        ? feedbackTrials.filter((entry) => entry && typeof entry === 'object')
        : [];
    const latestTrialAt = normalizedTrials.reduce((acc, entry) => (
        Math.max(acc, Math.floor(toNumber(entry?.createdAt, 0)))
    ), 0);
    const coverage = VNEXT_FACTOR_KEYS_V2.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});

    normalizedTrials.forEach((entry) => {
        const candidateA = normalizeFactorVectorV2({
            ...getDefaultFactorVectorV2(),
            ...(entry?.candidateA?.factors || {}),
        });
        const candidateB = normalizeFactorVectorV2({
            ...getDefaultFactorVectorV2(),
            ...(entry?.candidateB?.factors || {}),
        });
        const ageDays = latestTrialAt > 0
            ? Math.max(0, (latestTrialAt - Math.floor(toNumber(entry?.createdAt, latestTrialAt))) / DAY_MS)
            : 0;
        const recencyWeight = clamp(
            0.6 + (Math.exp(-ageDays / 24) * 0.4),
            0.6,
            1,
        );
        VNEXT_FACTOR_KEYS_V2.forEach((key) => {
            const def = getFactorSchemaDefV2(key);
            const span = Math.max(1e-6, Number(def?.max ?? 1) - Number(def?.min ?? 0));
            const delta = Math.abs(toNumber(candidateA[key], 0) - toNumber(candidateB[key], 0)) / span;
            coverage[key] += delta * recencyWeight;
        });
    });

    return coverage;
};

export const resolveVNextCompareLearningFocus = ({
    feedbackTrials = [],
    preferenceModel = null,
} = {}) => {
    const coverage = createFactorCoverageMap({
        feedbackTrials,
    });
    const weights = Array.isArray(preferenceModel?.weights) ? preferenceModel.weights : [];
    const maxAbsWeight = weights.length
        ? weights.reduce((acc, value) => Math.max(acc, Math.abs(toNumber(value, 0))), 0)
        : 0;
    const focusEntries = VNEXT_FACTOR_KEYS_V2.map((key, index) => {
        const coverageValue = Math.max(0, toNumber(coverage[key], 0));
        const coverageNorm = clamp01(coverageValue / 1.9);
        const modelWeightNorm = maxAbsWeight > 1e-9
            ? clamp01(Math.abs(toNumber(weights[index], 0)) / maxAbsWeight)
            : 0.35;
        return {
            key,
            coverage: round(coverageValue, 6),
            coverageNorm: round(coverageNorm, 6),
            modelWeightNorm: round(modelWeightNorm, 6),
            focusWeight: round(clamp(
                0.22
                + ((1 - coverageNorm) * 0.58)
                + (modelWeightNorm * 0.2),
                0.18,
                1,
            ), 6),
        };
    }).sort((a, b) => {
        const focusDiff = Number(b.focusWeight) - Number(a.focusWeight);
        if (focusDiff !== 0) {
            return focusDiff;
        }
        return String(a.key).localeCompare(String(b.key));
    });
    return {
        byKey: focusEntries.reduce((acc, entry) => {
            acc[entry.key] = entry;
            return acc;
        }, {}),
        topFactors: focusEntries.slice(0, 6),
        coverage,
    };
};

const createFocusedVariants = ({
    anchor = null,
    focusEntries = [],
} = {}) => {
    if (!anchor) {
        return [];
    }
    const variants = [];
    focusEntries.slice(0, 1).forEach((entry, index) => {
        const key = entry?.key;
        const def = getFactorSchemaDefV2(key);
        if (!def) {
            return;
        }
        const current = toNumber(anchor?.factors?.[key], def.default);
        const span = Math.max(1e-6, Number(def.max) - Number(def.min));
        const delta = span * Math.max(0.1, 0.18 - (index * 0.025));
        const directions = current >= (def.max - delta)
            ? [-1]
            : current <= (def.min + delta)
                ? [1]
                : [-1, 1];
        directions.forEach((direction, directionIndex) => {
            const nextValue = clamp(current + (delta * direction), def.min, def.max);
            if (Math.abs(nextValue - current) < 1e-3) {
                return;
            }
            variants.push({
                seed: Math.floor(anchor.seed + ((index + 1) * 101) + (direction > 0 ? 17 : 43) + directionIndex),
                origin: 'synthetic',
                factors: normalizeFactorVectorV2({
                    ...anchor.factors,
                    [key]: nextValue,
                }),
                scores: {
                    objective: clamp01(toNumber(anchor?.scores?.objective, 0) * 0.985),
                },
            });
        });
    });
    return variants;
};

const resolvePoolFocusFactors = ({
    pool = [],
    learningFocus = null,
} = {}) => {
    const safePool = Array.isArray(pool) ? pool.filter(Boolean) : [];
    if (safePool.length < 2) {
        return (learningFocus?.topFactors || []).slice(0, 4);
    }
    return VNEXT_FACTOR_KEYS_V2.map((key) => {
        const def = getFactorSchemaDefV2(key);
        const span = Math.max(1e-6, Number(def?.max ?? 1) - Number(def?.min ?? 0));
        let minValue = Infinity;
        let maxValue = -Infinity;
        safePool.forEach((candidate) => {
            const value = toNumber(candidate?.factors?.[key], 0);
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
        });
        const availability = clamp01((maxValue - minValue) / span);
        return {
            key,
            availability: round(availability, 6),
            focusWeight: round(toNumber(learningFocus?.byKey?.[key]?.focusWeight, 0.5), 6),
            score: round(availability * toNumber(learningFocus?.byKey?.[key]?.focusWeight, 0.5), 6),
        };
    }).filter((entry) => entry.score > 1e-4).sort((left, right) => {
        const diff = Number(right.score) - Number(left.score);
        if (diff !== 0) {
            return diff;
        }
        return String(left.key).localeCompare(String(right.key));
    }).slice(0, 4);
};

const analyzePair = ({
    candidateA = null,
    candidateB = null,
    learningFocus = null,
    preferenceModel = null,
} = {}) => {
    if (!candidateA || !candidateB) {
        return null;
    }
    const totalFocusWeight = (learningFocus?.topFactors || []).reduce((acc, entry) => (
        acc + toNumber(entry?.focusWeight, 0)
    ), 0) || VNEXT_FACTOR_KEYS_V2.length;
    const predictedA = scoreVNextPreferenceModel({
        model: preferenceModel,
        factors: candidateA.factors,
    });
    const predictedB = scoreVNextPreferenceModel({
        model: preferenceModel,
        factors: candidateB.factors,
    });
    const predictedMargin = Math.abs(predictedA - predictedB);
    const uncertainty = clamp01(1 - (predictedMargin / 0.24));
    const factorContributions = VNEXT_FACTOR_KEYS_V2.map((key) => {
        const def = getFactorSchemaDefV2(key);
        const span = Math.max(1e-6, Number(def?.max ?? 1) - Number(def?.min ?? 0));
        const delta = Math.abs(toNumber(candidateA?.factors?.[key], 0) - toNumber(candidateB?.factors?.[key], 0)) / span;
        const focusWeight = toNumber(learningFocus?.byKey?.[key]?.focusWeight, 0.5);
        return {
            key,
            delta: round(delta, 6),
            weightedDelta: round(delta * focusWeight, 6),
        };
    }).filter((entry) => entry.delta > 1e-4).sort((left, right) => (
        Number(right.weightedDelta) - Number(left.weightedDelta)
    ));
    const totalWeightedDelta = factorContributions.reduce((acc, entry) => acc + toNumber(entry.weightedDelta, 0), 0);
    const weightedContrast = totalWeightedDelta / Math.max(1e-6, totalFocusWeight);
    const dominantWeightedDelta = factorContributions
        .slice(0, 2)
        .reduce((acc, entry) => acc + toNumber(entry.weightedDelta, 0), 0);
    const isolation = totalWeightedDelta > 1e-6
        ? clamp01(dominantWeightedDelta / totalWeightedDelta)
        : 0;
    const preferredFocusKeys = new Set(
        (learningFocus?.topFactors || []).slice(0, 2).map((entry) => entry?.key).filter(Boolean),
    );
    const focusAlignment = totalWeightedDelta > 1e-6
        ? clamp01(
            factorContributions.reduce((acc, entry) => (
                acc + (preferredFocusKeys.has(entry.key) ? toNumber(entry.weightedDelta, 0) : 0)
            ), 0) / totalWeightedDelta,
        )
        : 0;
    const distinctFactorCount = factorContributions.filter((entry) => toNumber(entry.delta, 0) >= 0.06).length;
    const contrastSignal = clamp01(weightedContrast / 0.14);
    const separationFit = clamp01(1 - (Math.max(0, distinctFactorCount - 4) / 7));
    const qualityScore = clamp01(
        ((toNumber(candidateA?.scores?.objective, 0) + toNumber(candidateB?.scores?.objective, 0)) * 0.35)
        + (Math.min(toNumber(candidateA?.scores?.objective, 0), toNumber(candidateB?.scores?.objective, 0)) * 0.3),
    );
    const syntheticCount = [candidateA?.origin, candidateB?.origin].filter((origin) => origin === 'synthetic').length;
    const originScore = syntheticCount === 0
        ? 1
        : (syntheticCount === 1 ? 0.8 : 0.68);
    const score = clamp01(
        (uncertainty * 0.34)
        + (contrastSignal * 0.24)
        + (isolation * 0.12)
        + (focusAlignment * 0.16)
        + (qualityScore * 0.08)
        + (originScore * 0.04)
        + (separationFit * 0.02),
    );
    return {
        score: round(score, 6),
        predictedMargin: round(predictedMargin, 6),
        uncertainty: round(uncertainty, 6),
        weightedContrast: round(weightedContrast, 6),
        isolation: round(isolation, 6),
        focusAlignment: round(focusAlignment, 6),
        qualityScore: round(qualityScore, 6),
        originScore: round(originScore, 6),
        distinctFactorCount,
        topFactors: factorContributions.slice(0, 4),
    };
};

const orderSelectedPair = ({
    candidateA = null,
    candidateB = null,
} = {}) => {
    const pair = [candidateA, candidateB].filter(Boolean).sort((left, right) => {
        const objectiveDiff = toNumber(right?.scores?.objective, 0) - toNumber(left?.scores?.objective, 0);
        if (Math.abs(objectiveDiff) > 1e-9) {
            return objectiveDiff;
        }
        return toNumber(left?.seed, 0) - toNumber(right?.seed, 0);
    });
    return {
        candidateA: pair[0] || null,
        candidateB: pair[1] || null,
    };
};

export const resolveVNextActiveComparePair = ({
    optimization = null,
    feedbackTrials = [],
    preferenceModel = null,
} = {}) => {
    const learningFocus = resolveVNextCompareLearningFocus({
        feedbackTrials,
        preferenceModel,
    });
    const bestCandidate = normalizeCandidate(optimization?.bestCandidate, 'best');
    const recommendedCandidate = normalizeCandidate(optimization?.recommendedCandidate, 'recommended');
    if (!bestCandidate || !recommendedCandidate) {
        throw createVNextComparePairPolicyError(
            'ZEN_VNEXT_COMPARE_PAIR_OPTIMIZATION_INVALID',
            'VNext compare selection requires canonical bestCandidate and recommendedCandidate.',
        );
    }
    const archiveCandidates = Array.isArray(optimization?.archive)
        ? optimization.archive.map((entry) => normalizeCandidate(entry, 'archive')).filter(Boolean)
        : [];
    const anchor = bestCandidate;
    const realPool = dedupeCandidates([
        bestCandidate,
        recommendedCandidate,
        ...archiveCandidates,
    ]);

    const findBestPair = (pool = []) => {
        let bestPair = null;
        for (let leftIndex = 0; leftIndex < pool.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < pool.length; rightIndex += 1) {
                const left = pool[leftIndex];
                const right = pool[rightIndex];
                const diagnostics = analyzePair({
                    candidateA: left,
                    candidateB: right,
                    learningFocus,
                    preferenceModel,
                });
                if (!diagnostics || diagnostics.weightedContrast < 0.025) {
                    continue;
                }
                if (!bestPair || diagnostics.score > toNumber(bestPair?.diagnostics?.score, 0)) {
                    bestPair = {
                        candidateA: left,
                        candidateB: right,
                        diagnostics,
                    };
                }
            }
        }
        return bestPair;
    };

    const bestRealPair = findBestPair(realPool);
    const realPoolFocusFactors = resolvePoolFocusFactors({
        pool: realPool,
        learningFocus,
    });
    const hasSufficientRealPair = Boolean(
        bestRealPair
        && (
            toNumber(bestRealPair?.diagnostics?.focusAlignment, 0) >= 0.45
            || toNumber(bestRealPair?.diagnostics?.weightedContrast, 0) >= 0.08
            || toNumber(bestRealPair?.diagnostics?.score, 0) >= 0.7
        )
    );

    let bestPair = bestRealPair;
    if (!hasSufficientRealPair) {
        const syntheticCandidates = createFocusedVariants({
            anchor,
            focusEntries: learningFocus.topFactors,
        });
        const pool = dedupeCandidates([
            ...realPool,
            ...syntheticCandidates,
        ]);
        const poolFocusFactors = resolvePoolFocusFactors({
            pool,
            learningFocus,
        });
        bestPair = findBestPair(pool);
        if (bestPair) {
            bestPair.focusFactors = poolFocusFactors;
        }
    }

    if (!bestPair) {
        throw createVNextComparePairPolicyError(
            'ZEN_VNEXT_COMPARE_PAIR_UNRESOLVED',
            'VNext compare selection did not produce a canonical pair.',
        );
    }

    if (hasSufficientRealPair) {
        const orderedReal = orderSelectedPair(bestRealPair);
        return {
            candidateA: orderedReal.candidateA,
            candidateB: orderedReal.candidateB,
            diagnostics: {
                strategy: 'active_archive',
                focusFactors: realPoolFocusFactors,
                ...bestRealPair.diagnostics,
            },
        };
    }
    const ordered = orderSelectedPair(bestPair);
    const strategy = ordered?.candidateA?.origin === 'synthetic' || ordered?.candidateB?.origin === 'synthetic'
        ? 'active_synthetic'
        : 'active_archive';
    return {
        candidateA: ordered.candidateA,
        candidateB: ordered.candidateB,
        diagnostics: {
            strategy,
            focusFactors: bestPair?.focusFactors || learningFocus.topFactors.slice(0, 4),
            ...bestPair.diagnostics,
        },
    };
};
