import {
    VNEXT_FACTOR_KEYS_V2,
    getDefaultFactorVectorV2,
    getFactorSchemaDefV2,
    normalizeFactorVectorV2,
} from '../factors/FactorSchemaV2';
import { runZenBonsaiEngineVNext } from '../ZenBonsaiEngineVNext';
import { scoreVNextPreferenceModel } from './VNextPreferenceModel';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const createDeterministicRandom = (seed = 1) => {
    let state = (Math.floor(toNumber(seed, 1)) >>> 0) || 1;
    return () => {
        state ^= (state << 13);
        state ^= (state >>> 17);
        state ^= (state << 5);
        return ((state >>> 0) / 4294967296);
    };
};

const pick = (list = [], rand = Math.random) => {
    if (!Array.isArray(list) || !list.length) {
        return null;
    }
    const index = Math.min(list.length - 1, Math.floor(rand() * list.length));
    return list[index];
};

const mutateFactors = (factors = {}, rand = Math.random, intensity = 0.12) => {
    const next = { ...factors };
    VNEXT_FACTOR_KEYS_V2.forEach((key) => {
        const def = getFactorSchemaDefV2(key);
        if (!def) {
            return;
        }
        const current = toNumber(next[key], def.default);
        const span = Math.max(1e-6, Number(def.max) - Number(def.min));
        const mutationGate = clamp01((0.22 + (intensity * 0.78)) * (def.integer ? 0.5 : 1));
        if (rand() > mutationGate) {
            return;
        }
        const direction = (rand() * 2) - 1;
        const delta = direction * span * clamp(intensity, 0.02, 0.4) * (0.3 + (rand() * 0.9));
        next[key] = current + delta;
    });
    return normalizeFactorVectorV2(next);
};

const crossoverFactors = (a = {}, b = {}, rand = Math.random) => {
    const child = {};
    VNEXT_FACTOR_KEYS_V2.forEach((key) => {
        child[key] = rand() < 0.5 ? a[key] : b[key];
    });
    return normalizeFactorVectorV2(child);
};

const factorDistance = (a = {}, b = {}) => {
    const deltas = VNEXT_FACTOR_KEYS_V2.map((key) => {
        const da = toNumber(a?.[key], 0);
        const db = toNumber(b?.[key], 0);
        const def = getFactorSchemaDefV2(key);
        const span = Math.max(1e-6, Number(def?.max ?? 1) - Number(def?.min ?? 0));
        return Math.abs((da - db) / span);
    });
    if (!deltas.length) {
        return 0;
    }
    return deltas.reduce((acc, value) => acc + value, 0) / deltas.length;
};

const resolvePreferenceWeights = (profile = null) => {
    const raw = profile?.weights && typeof profile.weights === 'object'
        ? profile.weights
        : {};
    const normalized = {};
    let sum = 0;
    VNEXT_FACTOR_KEYS_V2.forEach((key) => {
        const fallback = (
            key === 'crown_openness' || key === 'blossom_bias'
                ? 1.45
                : (key === 'trunk_movement' || key === 'branch_spread' || key === 'ramification'
                    ? 1.2
                    : 1)
        );
        const weight = Math.max(0, toNumber(raw?.[key], fallback));
        normalized[key] = weight;
        sum += weight;
    });
    if (sum <= 1e-9) {
        const unit = 1 / Math.max(1, VNEXT_FACTOR_KEYS_V2.length);
        VNEXT_FACTOR_KEYS_V2.forEach((key) => {
            normalized[key] = unit;
        });
        return normalized;
    }
    VNEXT_FACTOR_KEYS_V2.forEach((key) => {
        normalized[key] /= sum;
    });
    return normalized;
};

const resolvePreferenceFactorSimilarity = ({
    candidateFactors = {},
    preferenceProfile = null,
} = {}) => {
    const target = preferenceProfile?.factors && typeof preferenceProfile.factors === 'object'
        ? preferenceProfile.factors
        : null;
    if (!target) {
        return 0.5;
    }
    const weights = resolvePreferenceWeights(preferenceProfile);
    const weightedDiff = VNEXT_FACTOR_KEYS_V2.reduce((acc, key) => {
        const def = getFactorSchemaDefV2(key);
        const span = Math.max(1e-6, Number(def?.max ?? 1) - Number(def?.min ?? 0));
        const targetValue = toNumber(target?.[key], toNumber(candidateFactors?.[key], 0));
        const candidateValue = toNumber(candidateFactors?.[key], targetValue);
        const diff = Math.abs((candidateValue - targetValue) / span);
        return acc + (diff * toNumber(weights?.[key], 0));
    }, 0);
    return clamp01(1 - weightedDiff);
};

const resolvePreferenceStyleAffinity = ({
    result = {},
    preferenceProfile = null,
} = {}) => {
    const target = preferenceProfile?.style && typeof preferenceProfile.style === 'object'
        ? preferenceProfile.style
        : null;
    if (!target) {
        return 0.5;
    }
    const deadwoodTarget = clamp01(toNumber(target?.deadwoodRatio, 0.08));
    const nodeTarget = Math.max(1, toNumber(target?.nodeCount, 92));
    const deadwoodRatio = clamp01(toNumber(result?.features?.deadwoodRatio, deadwoodTarget));
    const nodeCount = Math.max(1, toNumber(result?.features?.nodeCount, nodeTarget));
    const deadwoodFit = clamp01(1 - (Math.abs(deadwoodRatio - deadwoodTarget) / 0.35));
    const nodeFit = clamp01(1 - (Math.abs(nodeCount - nodeTarget) / Math.max(24, nodeTarget)));
    return clamp01((deadwoodFit * 0.45) + (nodeFit * 0.55));
};

const resolvePreferenceScore = ({
    candidateFactors = {},
    result = {},
    preferenceProfile = null,
    preferenceModel = null,
} = {}) => {
    const learned = scoreVNextPreferenceModel({
        model: preferenceModel,
        factors: candidateFactors,
    });
    const factorSimilarity = resolvePreferenceFactorSimilarity({
        candidateFactors,
        preferenceProfile,
    });
    const styleAffinity = resolvePreferenceStyleAffinity({
        result,
        preferenceProfile,
    });
    const heuristic = clamp01((factorSimilarity * 0.72) + (styleAffinity * 0.28));
    const hasLearnedModel = preferenceModel
        && Array.isArray(preferenceModel.weights)
        && preferenceModel.weights.length > 0;
    if (!hasLearnedModel) {
        return heuristic;
    }
    return clamp01((learned * 0.78) + (heuristic * 0.22));
};

export const blendVNextObjectiveScore = ({
    rule = 0,
    preference = 0,
    novelty = 0,
    reliabilityHint = 0,
} = {}) => {
    const reliability = clamp01(reliabilityHint);
    const noveltyWeight = clamp(0.14 - (reliability * 0.09), 0.04, 0.14);
    const blendedBase = (
        (clamp01(rule) * (1 - reliability))
        + (clamp01(preference) * reliability)
    );
    return clamp01(
        (blendedBase * (1 - noveltyWeight))
        + (clamp01(novelty) * noveltyWeight),
    );
};

const resolveRecommendationWeights = (reliabilityHint = 0) => {
    const reliability = clamp01(reliabilityHint);
    const qualityWeight = clamp(0.78 + (reliability * 0.12), 0.78, 0.9);
    const diversityWeight = 1 - qualityWeight;
    return {
        reliability,
        qualityWeight: round(qualityWeight, 6),
        diversityWeight: round(diversityWeight, 6),
    };
};

export const resolveVNextSearchPolicy = ({
    reliabilityHint = 0,
    populationSize = 18,
    eliteCount = 4,
    mutationIntensity = 0.14,
} = {}) => {
    const reliability = clamp01(reliabilityHint);
    const popSize = Math.max(8, Math.floor(toNumber(populationSize, 18)));
    const elite = Math.max(2, Math.min(popSize - 1, Math.floor(toNumber(eliteCount, 4))));
    const survivors = Math.max(1, popSize - elite);
    const explorationRatio = clamp(0.52 - (reliability * 0.3), 0.2, 0.52);
    const explorationCount = Math.max(2, Math.min(survivors - 1, Math.floor(survivors * explorationRatio)));
    const exploitationCount = Math.max(1, survivors - explorationCount);
    const baseIntensity = clamp(toNumber(mutationIntensity, 0.14), 0.02, 0.45);
    return {
        reliability: round(reliability, 6),
        noveltyFloor: round(clamp(0.22 - (reliability * 0.16), 0.05, 0.22), 6),
        noveltyPenaltyGain: round(clamp(0.28 - (reliability * 0.16), 0.1, 0.28), 6),
        explorationCount,
        exploitationCount,
        topWindow: Math.max(elite + 2, Math.floor(popSize * (0.4 + ((1 - reliability) * 0.2)))),
        explorationMutationScale: round(clamp(1.28 + ((1 - reliability) * 0.34), 1.2, 1.62), 6),
        exploitationMutationScale: round(clamp(0.72 + (reliability * 0.2), 0.72, 0.92), 6),
        restartProbability: round(clamp(0.32 - (reliability * 0.18), 0.12, 0.32), 6),
        baseIntensity: round(baseIntensity, 6),
    };
};

const applyNoveltyFloor = ({
    objective = 0,
    novelty = 0,
    searchPolicy = null,
} = {}) => {
    const safeObjective = clamp01(objective);
    const safeNovelty = clamp01(novelty);
    const floor = clamp01(toNumber(searchPolicy?.noveltyFloor, 0.1));
    const penaltyGain = clamp(toNumber(searchPolicy?.noveltyPenaltyGain, 0.16), 0.05, 0.4);
    const shortage = Math.max(0, floor - safeNovelty);
    const penalty = shortage * penaltyGain;
    const bonus = safeNovelty > floor
        ? Math.min(0.025, (safeNovelty - floor) * 0.06)
        : 0;
    const adjusted = clamp01(safeObjective - penalty + bonus);
    return {
        adjusted,
        penalty: round(penalty, 6),
        bonus: round(bonus, 6),
        floor: round(floor, 6),
    };
};

const alignObjectiveWithReliability = ({
    objective = 0,
    rule = 0,
    preference = 0,
    reliabilityHint = 0,
} = {}) => {
    const safeObjective = clamp01(objective);
    const safeRule = clamp01(rule);
    const safePreference = clamp01(preference);
    const reliability = clamp01(reliabilityHint);
    const midpoint = (safeRule + safePreference) * 0.5;
    const delta = safePreference - safeRule;
    if (Math.abs(delta) <= 1e-9) {
        return safeObjective;
    }
    const wantsPreferenceSide = reliability >= 0.5;
    const preferenceIsUpperSide = delta >= 0;
    const requiresUpperSide = wantsPreferenceSide
        ? preferenceIsUpperSide
        : !preferenceIsUpperSide;
    const onDesiredSide = requiresUpperSide
        ? safeObjective >= midpoint
        : safeObjective <= midpoint;
    if (onDesiredSide) {
        return safeObjective;
    }
    const strength = clamp01(Math.abs((reliability * 2) - 1));
    const target = wantsPreferenceSide ? safePreference : safeRule;
    const pulled = safeObjective + ((target - safeObjective) * strength);
    return requiresUpperSide
        ? Math.max(pulled, midpoint)
        : Math.min(pulled, midpoint);
};

const selectRecommendedCandidate = ({
    scored = [],
    reliabilityHint = 0,
} = {}) => {
    if (!Array.isArray(scored) || !scored.length) {
        return {
            candidate: null,
            explanation: null,
        };
    }
    if (scored.length === 1) {
        return {
            candidate: scored[0],
            explanation: {
                strategy: 'single_candidate',
                summary: 'Only one candidate available; selected by default.',
            },
        };
    }
    const best = scored[0];
    const weights = resolveRecommendationWeights(reliabilityHint);
    const qualityWeight = toNumber(weights.qualityWeight, 0.82);
    const diversityWeight = toNumber(weights.diversityWeight, 0.18);
    const pool = scored.slice(1, Math.min(scored.length, 10));
    let selected = null;
    let selectedScore = -Infinity;
    let selectedQuality = 0;
    let selectedDiversity = 0;
    let selectedNovelty = 0;
    let selectedDistance = 0;

    pool.forEach((entry) => {
        const quality = clamp01(toNumber(entry?.scores?.objective, 0));
        const novelty = clamp01(toNumber(entry?.scores?.novelty, 0));
        const distanceFromBest = factorDistance(entry?.factors || {}, best?.factors || {});
        const diversification = clamp01((distanceFromBest * 0.68) + (novelty * 0.32));
        const recommendation = (quality * qualityWeight) + (diversification * diversityWeight);
        if (recommendation > selectedScore) {
            selectedScore = recommendation;
            selected = entry;
            selectedQuality = quality;
            selectedDiversity = diversification;
            selectedNovelty = novelty;
            selectedDistance = distanceFromBest;
        }
    });

    const winner = selected || scored[1] || best;
    return {
        candidate: winner,
        explanation: {
            strategy: 'quality_diversity_tradeoff',
            summary: 'Recommended by balancing objective quality and diversification from current best.',
            weights,
            poolSize: pool.length,
            selectedSeed: Number.isFinite(Number(winner?.seed)) ? Math.floor(Number(winner.seed)) : null,
            selectedScore: round(selectedScore > -Infinity ? selectedScore : 0, 6),
            selectedQuality: round(selectedQuality, 6),
            selectedDiversity: round(selectedDiversity, 6),
            selectedNovelty: round(selectedNovelty, 6),
            selectedDistanceFromBest: round(selectedDistance, 6),
        },
    };
};

const resolveRuleScoreFromVNextOutput = (result = {}) => {
    const nodeCount = toNumber(result?.features?.nodeCount, 0);
    const deadwoodRatio = clamp01(toNumber(result?.features?.deadwoodRatio, 0));
    const firstSplitHeightNorm = clamp01(toNumber(result?.features?.firstSplitHeightNorm, 0));
    const spreadRatio = clamp01(toNumber(result?.features?.spreadRatio, 0));
    const trunkDominance = clamp01(toNumber(result?.features?.trunkDominance, 0));
    const taperConsistency = clamp01(toNumber(result?.features?.taperConsistency, 0));
    const branchComplexity = clamp01(toNumber(result?.features?.branchComplexity, 0));
    const padBandingScore = clamp01(toNumber(result?.features?.padBandingScore, 0));
    const padSeparationScore = clamp01(toNumber(result?.features?.padSeparationScore, 0));
    const negativeSpaceScore = clamp01(toNumber(result?.features?.negativeSpaceScore, 0));
    const pruneCount = Math.max(0, Math.floor(toNumber(result?.diagnostics?.pruneCount, 0)));
    const stepCount = Math.max(1, Math.floor(toNumber(result?.diagnostics?.stepCount, 1)));
    const structureFill = clamp01(1 - (Math.abs(nodeCount - 56) / 56));
    const deadwoodTarget = clamp01(1 - (Math.abs(deadwoodRatio - 0.06) / 0.2));
    const pruningRhythm = clamp01(1 - (Math.abs((pruneCount / stepCount) - 0.24) / 0.45));
    const firstSplitScore = clamp01(1 - (Math.abs(firstSplitHeightNorm - 0.62) / 0.34));
    const spreadScore = clamp01(1 - (Math.abs(spreadRatio - 0.34) / 0.32));
    const trunkDominanceScore = clamp01(1 - (Math.abs(trunkDominance - 0.34) / 0.24));
    const complexityScore = clamp01(1 - (Math.abs(branchComplexity - 0.24) / 0.25));
    return clamp01(
        (structureFill * 0.14)
        + (firstSplitScore * 0.14)
        + (trunkDominanceScore * 0.14)
        + (taperConsistency * 0.12)
        + (spreadScore * 0.08)
        + (complexityScore * 0.06)
        + (padBandingScore * 0.1)
        + (padSeparationScore * 0.08)
        + (negativeSpaceScore * 0.08)
        + (pruningRhythm * 0.04)
        + (deadwoodTarget * 0.02),
    );
};

const scoreCandidate = ({
    candidate,
    seedBase,
    reliabilityHint = 0,
    preferenceProfile = null,
    preferenceModel = null,
    constraints = {},
    options = {},
    population = [],
    searchPolicy = null,
} = {}) => {
    const seed = Math.floor(toNumber(seedBase, 0) + toNumber(candidate.seedOffset, 0));
    const result = runZenBonsaiEngineVNext({
        seed,
        factors: candidate.factors,
        constraints,
        options: {
            traceLevel: 'compact',
            ...options,
        },
    });
    const rule = resolveRuleScoreFromVNextOutput(result);
    const preference = resolvePreferenceScore({
        candidateFactors: candidate?.factors || {},
        result,
        preferenceProfile,
        preferenceModel,
    });
    const diversity = population.length
        ? population.reduce((acc, entry) => acc + factorDistance(candidate.factors, entry.factors), 0) / population.length
        : 0.5;
    const morphologyNovelty = clamp01(
        (Math.abs(clamp01(toNumber(result?.features?.firstSplitHeightNorm, 0)) - 0.62) * 0.34)
        + (Math.abs(clamp01(toNumber(result?.features?.spreadRatio, 0)) - 0.34) * 0.33)
        + (Math.abs(clamp01(toNumber(result?.features?.branchComplexity, 0)) - 0.24) * 0.33),
    );
    const novelty = clamp01((diversity * 0.74) + (morphologyNovelty * 0.26));
    const baseObjective = blendVNextObjectiveScore({
        rule,
        preference,
        novelty,
        reliabilityHint,
    });
    const noveltyAdjusted = applyNoveltyFloor({
        objective: baseObjective,
        novelty,
        searchPolicy,
    });
    const alignedObjective = alignObjectiveWithReliability({
        objective: noveltyAdjusted.adjusted,
        rule,
        preference,
        reliabilityHint,
    });
    return {
        ...candidate,
        seed,
        scores: {
            rule: round(rule),
            preference: round(preference),
            novelty: round(novelty),
            objective: round(alignedObjective),
            baseObjective: round(baseObjective),
            noveltyPenalty: round(noveltyAdjusted.penalty),
            noveltyBonus: round(noveltyAdjusted.bonus),
        },
        diagnostics: result?.diagnostics || null,
    };
};

const createInitialPopulation = ({
    rand,
    baseFactors,
    populationSize,
    mutationIntensity,
} = {}) => {
    const base = normalizeFactorVectorV2({
        ...getDefaultFactorVectorV2(),
        ...(baseFactors || {}),
    });
    const out = [{
        factors: base,
        seedOffset: 0,
    }];
    for (let index = 1; index < populationSize; index += 1) {
        out.push({
            factors: mutateFactors(base, rand, mutationIntensity * (0.9 + (rand() * 0.5))),
            seedOffset: index * 17,
        });
    }
    return out;
};

export const optimizeVNextFactorPopulation = ({
    seed = 0,
    baseFactors = null,
    preferenceProfile = null,
    preferenceModel = null,
    populationSize = 18,
    generations = 4,
    eliteCount = 4,
    mutationIntensity = 0.14,
    reliabilityHint = 0,
    constraints = {},
    options = {},
} = {}) => {
    const popSize = Math.max(8, Math.floor(toNumber(populationSize, 18)));
    const genCount = Math.max(1, Math.floor(toNumber(generations, 4)));
    const elite = Math.max(2, Math.min(popSize - 1, Math.floor(toNumber(eliteCount, 4))));
    const intensity = clamp(toNumber(mutationIntensity, 0.14), 0.02, 0.45);
    const rand = createDeterministicRandom(seed || 1);
    const searchPolicy = resolveVNextSearchPolicy({
        reliabilityHint,
        populationSize: popSize,
        eliteCount: elite,
        mutationIntensity: intensity,
    });
    const generationLog = [];
    const baseNormalized = normalizeFactorVectorV2({
        ...getDefaultFactorVectorV2(),
        ...(baseFactors || {}),
    });

    let population = createInitialPopulation({
        rand,
        baseFactors: baseNormalized,
        populationSize: popSize,
        mutationIntensity: intensity,
    });

    for (let generation = 0; generation < genCount; generation += 1) {
        const scored = population.map((candidate) => scoreCandidate({
            candidate,
            seedBase: seed + (generation * 1009),
            reliabilityHint,
            preferenceProfile,
            preferenceModel,
            constraints,
            options,
            population,
            searchPolicy,
        }));
        scored.sort((a, b) => Number(b?.scores?.objective || 0) - Number(a?.scores?.objective || 0));

        const top = scored[0];
        const meanObjective = scored.reduce((acc, entry) => acc + toNumber(entry?.scores?.objective, 0), 0) / scored.length;
        const diversity = scored.length > 1
            ? scored.reduce((acc, entry) => acc + factorDistance(entry.factors, top.factors), 0) / scored.length
            : 0;
        generationLog.push({
            generation,
            topObjective: round(top?.scores?.objective || 0),
            meanObjective: round(meanObjective),
            diversity: round(diversity),
            explorationCount: searchPolicy.explorationCount,
            exploitationCount: searchPolicy.exploitationCount,
            noveltyFloor: searchPolicy.noveltyFloor,
        });

        const next = scored.slice(0, elite).map((entry) => ({
            factors: entry.factors,
            seedOffset: toNumber(entry.seedOffset, 0),
        }));

        const topPool = scored.slice(0, Math.min(scored.length, Math.max(elite + 2, searchPolicy.topWindow)));
        const widePool = scored.slice(0, Math.min(scored.length, Math.max(elite + 4, 10)));
        const tailPool = scored.slice(Math.max(0, scored.length - Math.max(4, Math.floor(scored.length * 0.45))));

        const pushMutatedFromParents = ({
            parentA,
            parentB,
            mutationScale = 1,
            allowRestart = false,
        } = {}) => {
            let mixed = crossoverFactors(parentA?.factors || {}, parentB?.factors || {}, rand);
            if (allowRestart && rand() < toNumber(searchPolicy.restartProbability, 0.2)) {
                mixed = mutateFactors(baseNormalized, rand, intensity * 1.55);
            }
            const mutated = mutateFactors(
                mixed,
                rand,
                intensity * mutationScale * (0.88 + (rand() * 0.62)),
            );
            next.push({
                factors: mutated,
                seedOffset: Math.floor(rand() * 100000),
            });
        };

        const exploitationTarget = Math.min(popSize, next.length + searchPolicy.exploitationCount);
        while (next.length < exploitationTarget) {
            const parentA = pick(topPool, rand) || scored[0];
            const parentB = pick(widePool, rand) || scored[0];
            pushMutatedFromParents({
                parentA,
                parentB,
                mutationScale: toNumber(searchPolicy.exploitationMutationScale, 0.82),
                allowRestart: false,
            });
        }

        while (next.length < popSize) {
            const parentA = pick(widePool, rand) || scored[0];
            const parentB = pick(tailPool, rand) || pick(scored, rand) || scored[0];
            pushMutatedFromParents({
                parentA,
                parentB,
                mutationScale: toNumber(searchPolicy.explorationMutationScale, 1.32),
                allowRestart: true,
            });
        }
        population = next;
    }

    const finalScored = population.map((candidate) => scoreCandidate({
        candidate,
        seedBase: seed + 99991,
        reliabilityHint,
        preferenceProfile,
        preferenceModel,
        constraints,
        options,
        population,
        searchPolicy,
    }));
    finalScored.sort((a, b) => Number(b?.scores?.objective || 0) - Number(a?.scores?.objective || 0));
    const recommendation = selectRecommendedCandidate({
        scored: finalScored,
        reliabilityHint,
    });

    return {
        bestCandidate: finalScored[0] || null,
        recommendedCandidate: recommendation?.candidate || null,
        recommendationExplanation: recommendation?.explanation || null,
        archive: finalScored.slice(0, 12),
        generationLog,
        searchPolicy,
    };
};
