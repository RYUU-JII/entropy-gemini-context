import { compileSakuraPhenotypeFromLatent } from './SakuraCompiler';
import {
    resolveSakuraLearningLatentProfile,
} from './SakuraLatentParamApi';
import { validateSakuraLatent } from './SakuraLatentSchema';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const clamp01 = (value) => clamp(value, 0, 1);
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
);
const createSakuraOptimizationResultError = (
    code = 'ZEN_SAKURA_OPTIMIZATION_RESULT_INVALID',
    message = 'Sakura optimization result is invalid.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.name = 'SakuraOptimizationResultError';
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

export const resolveSakuraObjectiveMode = (value, fallback = 'adaptive') => (
    value === 'neural' || value === 'pairwise' || value === 'blended' || value === 'rule' || value === 'adaptive'
        ? value
        : fallback
);

const sanitizeScores = (scores = {}) => ({
    rule: round(Number(scores?.rule || 0)),
    neural: round(Number(scores?.neural || 0.5)),
    pairwise: round(Number(scores?.pairwise || 0.5)),
    pairwiseRaw: round(Number(scores?.pairwiseRaw ?? scores?.pairwise ?? 0.5)),
    pairwiseCalibrated: round(Number(scores?.pairwiseCalibrated ?? scores?.pairwise ?? 0.5)),
    novelty: round(Number(scores?.novelty || 0.5)),
    blended: round(Number(scores?.blended ?? scores?.objective ?? 0)),
    objectiveBase: round(Number(scores?.objectiveBase ?? scores?.objective ?? 0)),
    preferenceBasin: round(Number(scores?.preferenceBasin ?? 0)),
    preferenceBasinInsideRatio: round(Number(scores?.preferenceBasinInsideRatio ?? 0)),
    preferenceBasinPenalty: round(Number(scores?.preferenceBasinPenalty ?? 0)),
    preferenceBasinPenaltyWeight: round(Number(scores?.preferenceBasinPenaltyWeight ?? 0)),
    objective: round(Number(scores?.objective ?? scores?.blended ?? 0)),
});

const sanitizeAnalysis = (analysis = null) => {
    if (!isPlainObject(analysis)) {
        return null;
    }
    const evaluation = analysis?.evaluation || {};
    return {
        evaluation: {
            ruleScore: round(Number(evaluation?.ruleScore || 0)),
            noveltyScore: round(Number(evaluation?.noveltyScore || 0.5)),
            strongest: Array.isArray(evaluation?.strongest) ? evaluation.strongest.slice(0, 6) : [],
            weakest: Array.isArray(evaluation?.weakest) ? evaluation.weakest.slice(0, 6) : [],
        },
    };
};

const sanitizeDescriptor = (descriptor = null) => {
    if (!isPlainObject(descriptor)) {
        return null;
    }
    return {
        x: round(Number(descriptor?.x || 0)),
        y: round(Number(descriptor?.y || 0)),
    };
};

const requireObjectiveMode = (value, details = null) => {
    const objectiveMode = resolveSakuraObjectiveMode(value, null);
    if (objectiveMode) {
        return objectiveMode;
    }
    throw createSakuraOptimizationResultError(
        'ZEN_SAKURA_OPTIMIZATION_OBJECTIVE_MODE_REQUIRED',
        'Sakura optimization result requires a canonical objective mode.',
        details,
    );
};

const requireCandidateSeed = (seed = null, details = null) => {
    const numericSeed = Number(seed);
    if (Number.isFinite(numericSeed)) {
        return Math.floor(numericSeed);
    }
    throw createSakuraOptimizationResultError(
        'ZEN_SAKURA_OPTIMIZATION_CANDIDATE_SEED_REQUIRED',
        'Sakura optimization candidate requires a finite seed.',
        {
            ...(details && typeof details === 'object' ? details : {}),
            seed,
        },
    );
};

const requireCanonicalLatent = (latent = null, details = null) => {
    try {
        return validateSakuraLatent(latent, {
            code: 'ZEN_SAKURA_OPTIMIZATION_LATENT_INVALID',
            label: 'Sakura optimization latent',
            details,
        });
    } catch (error) {
        throw createSakuraOptimizationResultError(
            error?.code || 'ZEN_SAKURA_OPTIMIZATION_LATENT_INVALID',
            error?.message || 'Sakura optimization latent is invalid.',
            error?.details || details,
            error instanceof Error ? error : null,
        );
    }
};

const requireCandidate = (candidate = null, options = {}) => {
    const candidateRole = safeString(options?.candidateRole, 'candidate');
    const details = {
        candidateRole,
        learningKeyspaceProfile: options?.learningKeyspaceProfile || null,
    };
    if (!isPlainObject(candidate)) {
        throw createSakuraOptimizationResultError(
            'ZEN_SAKURA_OPTIMIZATION_CANDIDATE_REQUIRED',
            `Sakura optimization ${candidateRole} must be a plain object.`,
            details,
        );
    }
    const seed = requireCandidateSeed(candidate?.seed, details);
    const latent = requireCanonicalLatent(candidate?.latent, details);
    return {
        seed,
        dna: isPlainObject(candidate?.dna) ? { ...candidate.dna } : null,
        phenotype: compileSakuraPhenotypeFromLatent(latent),
        latent,
        scores: sanitizeScores(candidate?.scores || {}),
        analysis: sanitizeAnalysis(candidate?.analysis || candidate?.metric || null),
        descriptor: sanitizeDescriptor(candidate?.descriptor || null),
        archetypeMeta: isPlainObject(candidate?.archetypeMeta) ? { ...candidate.archetypeMeta } : null,
    };
};

const requireLatentBag = (latentBag = null, options = {}) => {
    const details = {
        learningKeyspaceProfile: options?.learningKeyspaceProfile || null,
    };
    if (!isPlainObject(latentBag)) {
        throw createSakuraOptimizationResultError(
            'ZEN_SAKURA_OPTIMIZATION_LATENT_BAG_REQUIRED',
            'Sakura optimization result requires a canonical latent bag.',
            details,
        );
    }
    return {
        best: requireCanonicalLatent(latentBag?.best, {
            ...details,
            candidateRole: 'bestCandidate',
            latentRole: 'best',
        }),
        recommended: requireCanonicalLatent(latentBag?.recommended, {
            ...details,
            candidateRole: 'recommendedCandidate',
            latentRole: 'recommended',
        }),
    };
};

export const normalizeSakuraOptimizationCandidate = (candidate = null, options = {}) => {
    const learningKeyspaceProfile = resolveSakuraLearningLatentProfile(options?.learningKeyspaceProfile);
    return requireCandidate(candidate, {
        learningKeyspaceProfile,
        candidateRole: options?.candidateRole,
    });
};

const sanitizeGenerationLogEntry = (entry = {}) => ({
    generation: Number.isFinite(Number(entry?.generation)) ? Math.max(0, Math.floor(Number(entry.generation))) : 0,
    topScore: round(Number(entry?.topScore || 0)),
    topObjective: round(Number(entry?.topObjective || 0)),
    topContinuity: round(Number(entry?.topContinuity || 0)),
    meanScore: round(Number(entry?.meanScore || 0)),
    meanBlendedScore: round(Number(entry?.meanBlendedScore || 0)),
    bottomScore: round(Number(entry?.bottomScore || 0)),
    populationDiversity: round(Number(entry?.populationDiversity || 0)),
    archiveDiversity: round(Number(entry?.archiveDiversity || 0)),
    diversityFloor: round(Number(entry?.diversityFloor || 0)),
    mutationBoost: round(Number(entry?.mutationBoost || 0), 3),
    stagnationCount: Number.isFinite(Number(entry?.stagnationCount))
        ? Math.max(0, Math.floor(Number(entry.stagnationCount)))
        : 0,
    archiveFilled: Number.isFinite(Number(entry?.archiveFilled))
        ? Math.max(0, Math.floor(Number(entry.archiveFilled)))
        : 0,
    archiveFillRatio: round(Number(entry?.archiveFillRatio || 0), 3),
    archiveTopQuality: round(Number(entry?.archiveTopQuality || 0)),
    topFactors: Array.isArray(entry?.topFactors) ? entry.topFactors.slice(0, 4) : [],
    weakFactors: Array.isArray(entry?.weakFactors) ? entry.weakFactors.slice(0, 4) : [],
});

const sanitizeMapElites = (mapElites = null) => {
    if (!isPlainObject(mapElites)) {
        return null;
    }
    return {
        mode: safeString(mapElites?.mode, 'latent_map_elites'),
        binsX: Number.isFinite(Number(mapElites?.binsX)) ? Math.max(2, Math.floor(Number(mapElites.binsX))) : 8,
        binsY: Number.isFinite(Number(mapElites?.binsY)) ? Math.max(2, Math.floor(Number(mapElites.binsY))) : 8,
        filledCells: Number.isFinite(Number(mapElites?.filledCells))
            ? Math.max(0, Math.floor(Number(mapElites.filledCells)))
            : 0,
        totalCells: Number.isFinite(Number(mapElites?.totalCells))
            ? Math.max(1, Math.floor(Number(mapElites.totalCells)))
            : 64,
        fillRatio: round(clamp01(Number(mapElites?.fillRatio || 0)), 3),
        diverseTopCount: Number.isFinite(Number(mapElites?.diverseTopCount))
            ? Math.max(0, Math.floor(Number(mapElites.diverseTopCount)))
            : 0,
    };
};

export const normalizeSakuraOptimizationResult = (result = null, options = {}) => {
    if (!isPlainObject(result)) {
        return null;
    }
    const learningKeyspaceProfile = resolveSakuraLearningLatentProfile(
        options?.learningKeyspaceProfile || result?.learningKeyspaceProfile || null,
    );
    const maxGenerationLogEntries = Number.isFinite(Number(options?.maxGenerationLogEntries))
        ? Math.max(1, Math.floor(Number(options.maxGenerationLogEntries)))
        : 18;
    const maxArchetypeSetEntries = Number.isFinite(Number(options?.maxArchetypeSetEntries))
        ? Math.max(1, Math.floor(Number(options.maxArchetypeSetEntries)))
        : 6;

    const objectiveMode = requireObjectiveMode(result?.objectiveMode, {
        learningKeyspaceProfile,
    });
    const bestCandidate = normalizeSakuraOptimizationCandidate(result?.bestCandidate, {
        learningKeyspaceProfile,
        candidateRole: 'bestCandidate',
    });
    const recommendedCandidate = normalizeSakuraOptimizationCandidate(result?.recommendedCandidate, {
        learningKeyspaceProfile,
        candidateRole: 'recommendedCandidate',
    });
    const archetypeSet = (Array.isArray(result?.archetypeSet) ? result.archetypeSet : [])
        .map((entry, index) => normalizeSakuraOptimizationCandidate(entry, {
            learningKeyspaceProfile,
            candidateRole: `archetypeSet[${index}]`,
        }))
        .slice(0, maxArchetypeSetEntries);
    const latent = requireLatentBag(result?.latent, {
        learningKeyspaceProfile,
    });

    return {
        bestCandidate,
        recommendedCandidate,
        objectiveMode,
        learningKeyspaceProfile,
        generationLog: Array.isArray(result?.generationLog)
            ? result.generationLog.map((entry) => sanitizeGenerationLogEntry(entry)).slice(0, maxGenerationLogEntries)
            : [],
        mapElites: sanitizeMapElites(result?.mapElites || null),
        archetype: isPlainObject(result?.archetype)
            ? {
                method: safeString(result.archetype?.method, 'dpp_greedy_anchor'),
                count: Number.isFinite(Number(result.archetype?.count))
                    ? Math.max(0, Math.floor(Number(result.archetype.count)))
                    : archetypeSet.length,
                poolCount: Number.isFinite(Number(result.archetype?.poolCount))
                    ? Math.max(0, Math.floor(Number(result.archetype.poolCount)))
                    : archetypeSet.length,
            }
            : {
                method: 'dpp_greedy_anchor',
                count: archetypeSet.length,
                poolCount: archetypeSet.length,
            },
        archetypeSet,
        latent,
    };
};
