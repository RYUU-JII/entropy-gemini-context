import {
    getDefaultFactorVectorV2,
    normalizeFactorVectorV2,
} from '../factors/FactorSchemaV2';

const createVNextOptimizationResultError = (
    code = 'ZEN_VNEXT_OPTIMIZATION_RESULT_INVALID',
    message = 'VNext optimization result is invalid.',
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
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const toInteger = (value, fallback = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return Math.max(0, Math.floor(fallback));
    }
    return Math.max(0, Math.floor(number));
};

const sanitizeScores = (scores = {}) => ({
    rule: round(Number(scores?.rule || 0), 6),
    preference: round(Number(scores?.preference || 0), 6),
    novelty: round(Number(scores?.novelty || 0), 6),
    objective: round(Number(scores?.objective || 0), 6),
    baseObjective: round(Number(scores?.baseObjective || scores?.objective || 0), 6),
    noveltyPenalty: round(Number(scores?.noveltyPenalty || 0), 6),
    noveltyBonus: round(Number(scores?.noveltyBonus || 0), 6),
});

const sanitizeCandidate = (entry = null) => {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const seed = Number(entry?.seed);
    if (!Number.isFinite(seed)) {
        return null;
    }
    const factors = normalizeFactorVectorV2({
        ...getDefaultFactorVectorV2(),
        ...(entry?.factors || {}),
    });
    return {
        seed: Math.floor(seed),
        factors,
        scores: sanitizeScores(entry?.scores || {}),
        diagnostics: entry?.diagnostics && typeof entry.diagnostics === 'object'
            ? {
                nodeCount: Math.max(0, Math.floor(Number(entry.diagnostics?.nodeCount || 0))),
                stepCount: Math.max(0, Math.floor(Number(entry.diagnostics?.stepCount || 0))),
                deadwoodCount: Math.max(0, Math.floor(Number(entry.diagnostics?.deadwoodCount || 0))),
                pruneCount: Math.max(0, Math.floor(Number(entry.diagnostics?.pruneCount || 0))),
            }
            : null,
    };
};

const requireCandidate = (entry, field) => {
    const normalized = sanitizeCandidate(entry);
    if (normalized) {
        return normalized;
    }
    throw createVNextOptimizationResultError(
        'ZEN_VNEXT_OPTIMIZATION_RESULT_INVALID',
        `VNext optimization result requires a canonical ${field}.`,
        {
            field,
        },
    );
};

const sanitizeGenerationLogEntry = (entry = {}) => ({
    generation: toInteger(entry?.generation, 0),
    topObjective: round(Number(entry?.topObjective || 0), 6),
    meanObjective: round(Number(entry?.meanObjective || 0), 6),
    diversity: clamp01(Number(entry?.diversity || 0)),
    explorationCount: toInteger(entry?.explorationCount, 0),
    exploitationCount: toInteger(entry?.exploitationCount, 0),
    noveltyFloor: clamp01(Number(entry?.noveltyFloor || 0)),
});

const sanitizeRecommendationExplanation = (entry = null) => {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const weights = entry?.weights && typeof entry.weights === 'object'
        ? {
            reliability: clamp01(Number(entry.weights?.reliability || 0)),
            qualityWeight: clamp01(Number(entry.weights?.qualityWeight || 0)),
            diversityWeight: clamp01(Number(entry.weights?.diversityWeight || 0)),
        }
        : null;
    return {
        strategy: typeof entry.strategy === 'string' && entry.strategy.trim()
            ? entry.strategy.trim()
            : 'unknown',
        summary: typeof entry.summary === 'string' && entry.summary.trim()
            ? entry.summary.trim()
            : '',
        weights,
        poolSize: toInteger(entry.poolSize, 0),
        selectedSeed: Number.isFinite(Number(entry.selectedSeed))
            ? Math.floor(Number(entry.selectedSeed))
            : null,
        selectedScore: round(Number(entry.selectedScore || 0), 6),
        selectedQuality: round(Number(entry.selectedQuality || 0), 6),
        selectedDiversity: round(Number(entry.selectedDiversity || 0), 6),
        selectedNovelty: round(Number(entry.selectedNovelty || 0), 6),
        selectedDistanceFromBest: round(Number(entry.selectedDistanceFromBest || 0), 6),
    };
};

const sanitizeSearchPolicy = (entry = null) => {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    return {
        reliability: clamp01(Number(entry?.reliability || 0)),
        noveltyFloor: clamp01(Number(entry?.noveltyFloor || 0)),
        noveltyPenaltyGain: clamp(Number(entry?.noveltyPenaltyGain || 0), 0, 1),
        explorationCount: toInteger(entry?.explorationCount, 0),
        exploitationCount: toInteger(entry?.exploitationCount, 0),
        topWindow: toInteger(entry?.topWindow, 0),
        explorationMutationScale: clamp(Number(entry?.explorationMutationScale || 0), 0, 3),
        exploitationMutationScale: clamp(Number(entry?.exploitationMutationScale || 0), 0, 3),
        restartProbability: clamp01(Number(entry?.restartProbability || 0)),
        baseIntensity: clamp(Number(entry?.baseIntensity || 0), 0, 1),
    };
};

export const normalizeVNextOptimizationResult = (raw = null) => {
    if (!raw || typeof raw !== 'object') {
        throw createVNextOptimizationResultError(
            'ZEN_VNEXT_OPTIMIZATION_RESULT_INVALID',
            'VNext optimization result payload must be an object.',
        );
    }
    const bestCandidate = requireCandidate(raw?.bestCandidate, 'bestCandidate');
    const recommendedCandidate = requireCandidate(raw?.recommendedCandidate, 'recommendedCandidate');
    const archive = Array.isArray(raw?.archive)
        ? raw.archive.map((entry) => sanitizeCandidate(entry)).filter(Boolean).slice(0, 12)
        : [];
    return {
        engineMode: 'vnext',
        objectiveMode: 'adaptive',
        bestCandidate,
        recommendedCandidate,
        archive,
        generationLog: Array.isArray(raw?.generationLog)
            ? raw.generationLog.map((entry) => sanitizeGenerationLogEntry(entry)).slice(0, 24)
            : [],
        recommendationExplanation: sanitizeRecommendationExplanation(raw?.recommendationExplanation),
        searchPolicy: sanitizeSearchPolicy(raw?.searchPolicy),
    };
};
