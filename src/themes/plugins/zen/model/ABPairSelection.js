import {
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentProfile,
} from './v2/SakuraLatentParamApi';
import { resolveSakuraLatentTierId } from './v2/SakuraLatentTierRegistry';
import { buildFactorRedundancyDiagnostics } from './FactorRedundancyDiagnostics';
import { resolvePrimaryCandidateScalarScore } from './ZenCoreScoring';
import {
    DEFAULT_REDUNDANCY_TUNING,
    clampRedundancyTuning,
} from './ZenCoreConfig';
import { clamp01, round } from './ABControllerUtils';
import { SAKURA_V2_REDUNDANCY_HISTORY_LIMIT } from './ZenLearningConstants';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const DUELING_THOMPSON_MIN_POOL = 6;
const SAKURA_PAIR_TYPE_IDS = Object.freeze([
    'isolation_pair',
    'mixed_pair',
    'diversity_pair',
    'form_discovery_pair',
    'dueling_thompson',
]);

export const resolveChangedFactorIds = (pair = null) => {
    const changedFactors = Array.isArray(pair?.generationContext?.changedFactors)
        ? pair.generationContext.changedFactors
        : [];
    return Array.from(new Set(
        changedFactors
            .map((factor) => (typeof factor?.id === 'string' ? factor.id.trim() : null))
            .filter(Boolean),
    ));
};

export const resolveChangedTierIds = (pair = null) => {
    const explicitTierIds = Array.isArray(pair?.generationContext?.changedTierIds)
        ? pair.generationContext.changedTierIds
            .map((tierId) => (typeof tierId === 'string' ? tierId.trim() : null))
            .filter(Boolean)
        : [];
    if (explicitTierIds.length) {
        return Array.from(new Set(explicitTierIds));
    }
    return Array.from(new Set(
        resolveChangedFactorIds(pair).map((factorId) => resolveSakuraLatentTierId(factorId)),
    ));
};

export const resolveSakuraPairChangeMeta = (pair = null) => {
    const factorIds = resolveChangedFactorIds(pair);
    const tierIds = resolveChangedTierIds(pair);
    const pairType = String(pair?.generationContext?.pairType || '').trim().toLowerCase() || 'unknown';
    const sharedSeedApplied = Boolean(
        pair?.generationContext?.sharedSeedApplied
        || pair?.generationContext?.sharedSeedPolicy === 'shared',
    );
    return {
        factorIds,
        tierIds,
        factorCount: factorIds.length,
        tierCount: tierIds.length,
        pairType,
        sharedSeedApplied,
    };
};

const isAnchorHistoryEntry = (entry = {}) => (
    String(entry?.query?.kind || entry?.generationContext?.queryKind || '').trim().toLowerCase() === 'anchor'
);

const resolveHistoryChangedFactorIds = (entry = {}) => {
    const changedFactors = Array.isArray(entry?.generationContext?.changedFactors)
        ? entry.generationContext.changedFactors
        : [];
    return Array.from(new Set(
        changedFactors
            .map((factor) => (typeof factor?.id === 'string' ? factor.id.trim() : null))
            .filter(Boolean),
    ));
};

const resolveHistoryChangedTierIds = (entry = {}) => {
    const explicitTierIds = Array.isArray(entry?.generationContext?.changedTierIds)
        ? entry.generationContext.changedTierIds
            .map((tierId) => (typeof tierId === 'string' ? tierId.trim() : null))
            .filter(Boolean)
        : [];
    if (explicitTierIds.length) {
        return Array.from(new Set(explicitTierIds));
    }
    return Array.from(new Set(
        resolveHistoryChangedFactorIds(entry).map((factorId) => resolveSakuraLatentTierId(factorId)),
    ));
};

export const buildSakuraExpressionGuidance = (
    abHistory = [],
    learningKeyspaceProfile = null,
) => {
    const learningKeys = listSakuraLearningLatentKeys({
        profile: resolveSakuraLearningLatentProfile(learningKeyspaceProfile),
    });
    const activeTierIds = Array.from(new Set(
        learningKeys.map((key) => resolveSakuraLatentTierId(key)),
    ));
    const tierCounts = activeTierIds.reduce((acc, tierId) => {
        acc[tierId] = 0;
        return acc;
    }, {});
    const pairTypeCounts = SAKURA_PAIR_TYPE_IDS.reduce((acc, pairType) => {
        acc[pairType] = 0;
        return acc;
    }, {});
    const history = Array.isArray(abHistory) ? abHistory : [];

    history.forEach((entry) => {
        if (isAnchorHistoryEntry(entry)) {
            return;
        }
        const pairType = String(entry?.generationContext?.pairType || '').trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(pairTypeCounts, pairType)) {
            pairTypeCounts[pairType] += 1;
        }
        resolveHistoryChangedTierIds(entry).forEach((tierId) => {
            if (Object.prototype.hasOwnProperty.call(tierCounts, tierId)) {
                tierCounts[tierId] += 1;
            }
        });
    });

    const maxTierCount = Math.max(0, ...Object.values(tierCounts));
    const maxPairTypeCount = Math.max(0, ...Object.values(pairTypeCounts));
    const tierNeedById = activeTierIds.reduce((acc, tierId) => {
        acc[tierId] = maxTierCount <= 0
            ? 1
            : clamp01((maxTierCount - Number(tierCounts[tierId] || 0)) / maxTierCount);
        return acc;
    }, {});
    const pairTypeNeedById = SAKURA_PAIR_TYPE_IDS.reduce((acc, pairType) => {
        acc[pairType] = maxPairTypeCount <= 0
            ? 1
            : clamp01((maxPairTypeCount - Number(pairTypeCounts[pairType] || 0)) / maxPairTypeCount);
        return acc;
    }, {});
    const underexploredTierIds = [...activeTierIds].sort((left, right) => {
        const delta = Number(tierCounts[left] || 0) - Number(tierCounts[right] || 0);
        if (delta !== 0) {
            return delta;
        }
        return left.localeCompare(right);
    });

    return {
        activeTierIds,
        tierCounts,
        tierNeedById,
        underexploredTierIds,
        pairTypeCounts,
        pairTypeNeedById,
    };
};

export const resolveSakuraPairComparabilityScore = (pair = null) => {
    const meta = resolveSakuraPairChangeMeta(pair);
    const pairType = meta.pairType;
    if (pairType === 'dueling_thompson') {
        return 0.62;
    }
    const factorScore = (() => {
        if (pairType === 'form_discovery_pair') {
            return meta.factorCount === 0 ? 1 : 0;
        }
        if (pairType === 'isolation_pair') {
            if (meta.factorCount === 1) return 1;
            if (meta.factorCount === 2) return 0.58;
            return meta.factorCount === 0 ? 0.12 : 0.24;
        }
        if (pairType === 'mixed_pair') {
            if (meta.factorCount >= 2 && meta.factorCount <= 3) return 0.94;
            if (meta.factorCount === 1 || meta.factorCount === 4) return 0.62;
            return meta.factorCount === 0 ? 0.18 : 0.28;
        }
        if (pairType === 'diversity_pair') {
            if (meta.factorCount >= 4 && meta.factorCount <= 6) return 0.9;
            if (meta.factorCount >= 2 && meta.factorCount <= 7) return 0.64;
            return meta.factorCount === 0 ? 0.2 : 0.34;
        }
        return clamp01(meta.factorCount / 4);
    })();
    const tierScore = (() => {
        if (pairType === 'form_discovery_pair') {
            return meta.tierCount === 0 ? 1 : 0;
        }
        if (pairType === 'isolation_pair') {
            return meta.tierCount === 1 ? 1 : 0.24;
        }
        if (pairType === 'mixed_pair') {
            if (meta.tierCount <= 1) return 0.92;
            if (meta.tierCount === 2) return 0.78;
            return 0.34;
        }
        if (pairType === 'diversity_pair') {
            if (meta.tierCount <= 2) return 0.86;
            if (meta.tierCount === 3) return 0.58;
            return 0.28;
        }
        return clamp01(1 - Math.max(0, meta.tierCount - 1) * 0.25);
    })();
    const seedScore = meta.sharedSeedApplied
        ? 1
        : (pairType === 'diversity_pair' ? 0.64 : 0.82);
    const contextTarget = clamp(
        Number(pair?.generationContext?.comparabilityTarget ?? 0.6),
        0.2,
        1,
    );
    return round(clamp01(
        (factorScore * 0.36)
        + (tierScore * 0.3)
        + (seedScore * 0.12)
        + (contextTarget * 0.22),
    ), 4);
};

export const resolveSakuraPairExpressionDiversityCredit = (
    pair = null,
    guidance = null,
) => {
    const meta = resolveSakuraPairChangeMeta(pair);
    const tierNeedById = guidance?.tierNeedById || {};
    const pairTypeNeedById = guidance?.pairTypeNeedById || {};
    const tierNeed = meta.tierIds.length
        ? meta.tierIds.reduce((acc, tierId) => acc + Number(tierNeedById[tierId] || 0), 0) / meta.tierIds.length
        : 0;
    const pairTypeNeed = Number(pairTypeNeedById[meta.pairType] || 0);
    const structureBreadth = clamp01(meta.factorCount / 5);
    return round(clamp01(
        (tierNeed * 0.64)
        + (pairTypeNeed * 0.18)
        + (structureBreadth * 0.18),
    ), 4);
};

const resolvePairwiseCandidateInput = (candidate = null) => {
    if (candidate?.modelInput && typeof candidate.modelInput === 'object') {
        return candidate.modelInput;
    }
    const latent = candidate?.latent;
    const features = candidate?.metric?.features;
    if (latent && typeof latent === 'object') {
        return {
            latent: { ...latent },
            features: features && typeof features === 'object' ? { ...features } : null,
        };
    }
    if (features && typeof features === 'object') {
        return features;
    }
    return null;
};

const buildPairwiseCandidateSignature = (candidate = null) => {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const latent = candidate?.modelInput?.latent || candidate?.latent;
    const latentSignature = latent && typeof latent === 'object'
        ? Object.keys(latent)
            .sort()
            .slice(0, 18)
            .map((key) => `${key}:${round(Number(latent[key]), 4)}`)
            .join('|')
        : null;
    const seed = Number.isFinite(Number(candidate?.seed))
        ? Number(candidate.seed)
        : null;
    const scalarScore = round(resolvePrimaryCandidateScalarScore(candidate?.scores), 4);
    return [
        seed === null ? 'na' : seed,
        latentSignature || 'no_latent',
        scalarScore,
    ].join('#');
};

export const pickDuelingThompsonCandidates = ({
    pool = [],
    pairwiseBrain = null,
} = {}) => {
    if (!Array.isArray(pool) || pool.length < 1) {
        return null;
    }
    if (typeof pairwiseBrain?.sampleUtility !== 'function') {
        return null;
    }

    const uniqueCandidates = new Map();
    pool.forEach((entry) => {
        ['A', 'B'].forEach((label) => {
            const candidate = entry?.pair?.[label];
            const signature = buildPairwiseCandidateSignature(candidate);
            if (!candidate || !signature || uniqueCandidates.has(signature)) {
                return;
            }
            uniqueCandidates.set(signature, candidate);
        });
    });
    if (uniqueCandidates.size < DUELING_THOMPSON_MIN_POOL) {
        return null;
    }

    const sampled = Array.from(uniqueCandidates.values())
        .map((candidate) => {
            const input = resolvePairwiseCandidateInput(candidate);
            if (!input) {
                return null;
            }
            const draw = pairwiseBrain.sampleUtility(input);
            const sampledValue = Number(draw?.sample);
            if (!Number.isFinite(sampledValue)) {
                return null;
            }
            return {
                candidate,
                sampledValue,
                variance: Math.max(0, Number(draw?.variance || 0)),
                mean: Number.isFinite(Number(draw?.mean)) ? Number(draw.mean) : sampledValue,
            };
        })
        .filter(Boolean);
    if (sampled.length < 2) {
        return null;
    }

    sampled.sort((left, right) => right.sampledValue - left.sampledValue);
    const best = sampled[0];
    const challenger = sampled[1];
    const sampleGap = Math.max(0, Number(best.sampledValue) - Number(challenger.sampledValue));
    const avgVariance = (Number(best.variance || 0) + Number(challenger.variance || 0)) * 0.5;
    return {
        best: best.candidate,
        challenger: challenger.candidate,
        summary: {
            poolSize: sampled.length,
            sampleGap: round(sampleGap, 4),
            avgVariance: round(avgVariance, 4),
            bestMean: round(Number(best.mean || 0), 4),
            challengerMean: round(Number(challenger.mean || 0), 4),
        },
    };
};

export const buildRedundancyGuidance = (
    abHistory = [],
    treeType = 'sakura',
    redundancyTuning = DEFAULT_REDUNDANCY_TUNING,
    learningKeyspaceProfile = null,
) => {
    const tuning = clampRedundancyTuning(redundancyTuning || DEFAULT_REDUNDANCY_TUNING);
    const diagnostics = buildFactorRedundancyDiagnostics({
        abHistory: Array.isArray(abHistory) ? abHistory.slice(0, SAKURA_V2_REDUNDANCY_HISTORY_LIMIT) : [],
        minSamplesPerFactor: 6,
        minActiveBins: 3,
        similarityThreshold: tuning.similarityThreshold,
        minEffectMagnitude: 0.08,
        binCount: 5,
    });
    const factorPenalty = {};
    (diagnostics?.redundantPairs || []).forEach((pair) => {
        const similarity = clamp01(Number(pair?.similarity || 0));
        const support = clamp01(Number(pair?.sampleFloor || 0) / 14);
        const penalty = clamp((similarity * 0.7) + (support * 0.3), 0, 1);
        if (typeof pair?.aId === 'string' && pair.aId.trim()) {
            factorPenalty[pair.aId] = Math.max(Number(factorPenalty[pair.aId] || 0), penalty);
        }
        if (typeof pair?.bId === 'string' && pair.bId.trim()) {
            factorPenalty[pair.bId] = Math.max(Number(factorPenalty[pair.bId] || 0), penalty);
        }
    });
    const blockedFactorIds = Object.entries(factorPenalty)
        .filter(([, value]) => Number(value || 0) >= tuning.blockThreshold)
        .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
        .map(([factorId]) => factorId);
    const focusBase = treeType === 'sakura'
        ? listSakuraLearningLatentKeys({
            profile: resolveSakuraLearningLatentProfile(learningKeyspaceProfile),
        })
        : [];
    const availableFocusKeys = focusBase.filter((key) => !blockedFactorIds.includes(key));

    return {
        diagnostics,
        factorPenalty,
        blockedFactorIds,
        availableFocusKeys: availableFocusKeys.length ? availableFocusKeys : focusBase,
        tuning,
    };
};
