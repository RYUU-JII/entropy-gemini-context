import { clampPhenotype } from '../BonsaiGenetics';
import {
    deriveMapElitesDescriptor,
    getMapElitesEntries,
    scoreMapElitesQuality,
    upsertMapElitesArchive,
} from '../MapElitesArchive';
import { DPP_ARCHETYPE_METHOD, selectDppArchetypeSet } from '../ArchetypeDpp';
import { ExplicitConstraintModel } from '../bonsai/constraints/ExplicitConstraintModel';
import { RandomFactorModel } from '../bonsai/factors/RandomFactorModel';
import { CandidateScoreModel } from '../bonsai/scoring/CandidateScoreModel';
import { BonsaiCandidateEvaluator } from '../bonsai/evaluation/BonsaiCandidateEvaluator';
import {
    applySakuraPreferenceBasinFixedFactorValues,
    clampSakuraLatentByLearningRange,
    listSakuraLearningLatentExcludedKeys,
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentDef,
    resolveSakuraLearningLatentProfile,
} from './SakuraLatentParamApi';
import {
    createRandomSakuraLatent,
    mutateSakuraLatent,
    validateSakuraLatent,
} from './SakuraLatentSchema';
import { compileSakuraPhenotypeFromLatent } from './SakuraCompiler';
import { normalizeSakuraOptimizationResult } from './SakuraOptimizationResult';
import {
    applySakuraPreferenceBasinPenalty,
    buildSakuraOptimizationPairwiseLatent,
    buildSakuraStableBasinGuideLatent,
    requireSakuraOptimizationBasinGuidance,
    scoreSakuraPreferenceBasinAffinity,
} from './SakuraPreferenceBasinObjective';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const RANDOM_IMMIGRANT_RATE = 0.08;
const IMMIGRANT_RANDOM_RESET_RATE = 0.18;
const MAP_ELITES_DEFAULT_BINS_X = 8;
const MAP_ELITES_DEFAULT_BINS_Y = 8;
const MAP_ELITES_DEFAULT_DIVERSE_TOP_K = 12;
const MIN_OBJECTIVE_IMPROVEMENT = 0.0004;
const createSakuraOptimizationError = (
    code = 'ZEN_SAKURA_OPTIMIZATION_FAILED',
    message = 'Sakura latent optimization failed.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.name = 'SakuraOptimizationError';
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};
const requireOptimizationBaseLatent = (
    baseLatent = null,
    learningKeyspaceProfile = null,
) => {
    try {
        const canonicalBaseLatent = validateSakuraLatent(baseLatent, {
            code: 'ZEN_SAKURA_OPTIMIZATION_BASE_LATENT_INVALID',
            label: 'Sakura optimization base latent',
            details: {
                learningKeyspaceProfile,
            },
        });
        return applySakuraPreferenceBasinFixedFactorValues(
            clampSakuraLatentByLearningRange(canonicalBaseLatent, {
                profile: learningKeyspaceProfile,
            }),
            { profile: learningKeyspaceProfile },
        );
    } catch (error) {
        throw createSakuraOptimizationError(
            error?.code || 'ZEN_SAKURA_OPTIMIZATION_BASE_LATENT_INVALID',
            error?.message || 'Sakura optimization requires a canonical base latent.',
            error?.details || {
                learningKeyspaceProfile,
            },
            error instanceof Error ? error : null,
        );
    }
};

const stabilizeLearningLatent = (
    latent = {},
    anchorLatent = {},
    learningLatentExcludedKeys = [],
    learningKeyspaceProfile = null,
) => {
    const next = clampSakuraLatentByLearningRange(latent, {
        profile: learningKeyspaceProfile,
    });
    const anchor = clampSakuraLatentByLearningRange(anchorLatent, {
        profile: learningKeyspaceProfile,
    });
    learningLatentExcludedKeys.forEach((key) => {
        if (Number.isFinite(Number(anchor?.[key]))) {
            next[key] = Number(anchor[key]);
        }
    });
    return clampSakuraLatentByLearningRange(next, {
        profile: learningKeyspaceProfile,
    });
};

const normalizeObjectiveMode = (value) => (
    value === 'neural' || value === 'pairwise' || value === 'blended' || value === 'rule' || value === 'adaptive'
        ? value
        : 'blended'
);

const resolveAdaptiveReliability = (reliabilityHint = 0) => {
    const safeHint = clamp01(reliabilityHint);
    return clamp01((Math.pow(safeHint, 1.24) * 0.84) + (safeHint * 0.16));
};

const resolveAdaptiveObjectiveScore = (scores = {}, reliabilityHint = 0) => {
    const safeReliability = resolveAdaptiveReliability(reliabilityHint);
    const ruleScore = Number(scores?.rule);
    const pairwiseScore = Number(scores?.pairwise);
    const blendedScore = Number(scores?.blended);
    const fallbackObjective = Number(scores?.objective);
    const safeRule = Number.isFinite(ruleScore)
        ? ruleScore
        : (Number.isFinite(blendedScore) ? blendedScore : (Number.isFinite(fallbackObjective) ? fallbackObjective : 0));
    const personalized = Number.isFinite(pairwiseScore)
        ? pairwiseScore
        : (Number.isFinite(blendedScore) ? blendedScore : safeRule);
    return clamp01((safeRule * (1 - safeReliability)) + (personalized * safeReliability));
};

const resolveObjectiveScore = (entry, mode = 'blended', options = {}) => {
    const scores = entry?.scores || {};
    if (mode === 'adaptive') {
        const basinAdjustedObjective = Number(scores?.objective);
        const basinAffinity = Number(scores?.preferenceBasin);
        if (Number.isFinite(basinAdjustedObjective) && Number.isFinite(basinAffinity)) {
            return clamp01(basinAdjustedObjective);
        }
        return resolveAdaptiveObjectiveScore(scores, options?.reliabilityHint);
    }
    if (mode === 'rule') {
        const rule = Number(scores.rule);
        if (Number.isFinite(rule)) {
            return rule;
        }
    }
    if (mode === 'pairwise') {
        const pairwise = Number(scores.pairwise);
        if (Number.isFinite(pairwise)) {
            return pairwise;
        }
    }
    if (mode === 'neural') {
        const neural = Number(scores.neural);
        if (Number.isFinite(neural)) {
            return neural;
        }
    }
    const blended = Number(scores.blended);
    if (Number.isFinite(blended)) {
        return blended;
    }
    const objective = Number(scores.objective);
    return Number.isFinite(objective) ? objective : 0;
};

const scoreForSelection = (entry, objectiveMode = 'blended', options = {}) => {
    const objectiveScore = resolveObjectiveScore(entry, objectiveMode, options);
    const noveltyScore = Number(entry?.scores?.novelty ?? 0);
    if (objectiveMode === 'rule') {
        const ruleScore = Number(entry?.scores?.rule ?? 0);
        return (ruleScore * 0.95) + (noveltyScore * 0.05);
    }
    if (objectiveMode === 'adaptive') {
        const adaptiveReliability = resolveAdaptiveReliability(options?.reliabilityHint);
        const noveltyWeight = clamp(0.14 - (adaptiveReliability * 0.08), 0.06, 0.14);
        return (objectiveScore * (1 - noveltyWeight)) + (noveltyScore * noveltyWeight);
    }
    return (objectiveScore * 0.9) + (noveltyScore * 0.1);
};

const isCandidateFeasible = (entry) => {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    const pass = entry?.feasibility?.pass;
    if (typeof pass === 'boolean') {
        return pass;
    }
    return true;
};

const descriptorDistance = (a, b) => {
    if (!a || !b) {
        return 0;
    }
    const dx = Number(a.x ?? 0.5) - Number(b.x ?? 0.5);
    const dy = Number(a.y ?? 0.5) - Number(b.y ?? 0.5);
    return Math.sqrt((dx * dx) + (dy * dy));
};

const resolveCandidateDescriptor = (entry) => {
    if (entry?.descriptor?.x !== undefined && entry?.descriptor?.y !== undefined) {
        return entry.descriptor;
    }
    return deriveMapElitesDescriptor(entry);
};

const calculatePopulationDiversity = (entries = []) => {
    const candidates = Array.isArray(entries) ? entries : [];
    if (candidates.length < 2) {
        return 0;
    }
    const descriptors = candidates
        .map((entry) => resolveCandidateDescriptor(entry))
        .filter((descriptor) => Number.isFinite(descriptor?.x) && Number.isFinite(descriptor?.y));
    if (descriptors.length < 2) {
        return 0;
    }

    const avgNearest = descriptors.reduce((acc, baseDescriptor, baseIndex) => {
        let nearest = Infinity;
        descriptors.forEach((candidateDescriptor, candidateIndex) => {
            if (baseIndex === candidateIndex) {
                return;
            }
            const distance = descriptorDistance(baseDescriptor, candidateDescriptor);
            if (distance < nearest) {
                nearest = distance;
            }
        });
        return acc + (Number.isFinite(nearest) ? nearest : 0);
    }, 0) / descriptors.length;

    return clamp(avgNearest, 0, 1);
};

const selectDiverseArchiveEntries = (entries, desiredCount = MAP_ELITES_DEFAULT_DIVERSE_TOP_K) => {
    if (!entries?.length) {
        return [];
    }
    const sorted = [...entries].sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0));
    const selected = [sorted[0]];
    while (selected.length < desiredCount && selected.length < sorted.length) {
        let best = null;
        let bestDiversityScore = -1;
        for (let index = 1; index < sorted.length; index += 1) {
            const candidate = sorted[index];
            if (selected.includes(candidate)) {
                continue;
            }
            const nearestDistance = selected.reduce(
                (acc, entry) => Math.min(acc, descriptorDistance(entry.descriptor, candidate.descriptor)),
                Infinity,
            );
            const quality = Number(candidate.quality ?? 0);
            const diversityScore = (nearestDistance * 0.68) + (quality * 0.32);
            if (diversityScore > bestDiversityScore) {
                bestDiversityScore = diversityScore;
                best = candidate;
            }
        }
        if (!best) {
            break;
        }
        selected.push(best);
    }
    return selected;
};

const crossoverLatent = (
    latentA = {},
    latentB = {},
    learningLatentKeys = [],
    learningLatentExcludedKeys = [],
    learningKeyspaceProfile = null,
    rng = Math.random,
) => {
    const randomFn = typeof rng === 'function' ? rng : Math.random;
    const a = clampSakuraLatentByLearningRange(latentA, {
        profile: learningKeyspaceProfile,
    });
    const b = clampSakuraLatentByLearningRange(latentB, {
        profile: learningKeyspaceProfile,
    });
    const out = {};

    learningLatentKeys.forEach((key) => {
        const def = resolveSakuraLearningLatentDef(key, {
            profile: learningKeyspaceProfile,
        });
        const av = Number(a[key]);
        const bv = Number(b[key]);
        let next;
        if (randomFn() < 0.35) {
            next = randomFn() < 0.5 ? av : bv;
        } else {
            const t = clamp01(0.18 + (randomFn() * 0.64));
            next = av + ((bv - av) * t);
        }
        const clamped = clamp(next, def.min, def.max);
        out[key] = def.integer ? Math.round(clamped) : clamped;
    });

    return stabilizeLearningLatent(
        out,
        a,
        learningLatentExcludedKeys,
        learningKeyspaceProfile,
    );
};

const evaluateLatentCandidate = ({
    evaluator,
    latent,
    seed,
    baselinePhenotype,
    referenceFeatures,
    objectiveMode = 'blended',
    reliabilityHint = 0,
    learningKeyspaceProfile = null,
    preferenceBasinGuidance = null,
    preferenceBasinBaseLatent = null,
}) => {
    const phenotype = compileSakuraPhenotypeFromLatent(latent);
    const pairwiseScoringLatent = preferenceBasinGuidance
        ? buildSakuraOptimizationPairwiseLatent({
            latent,
            baseLatent: preferenceBasinBaseLatent,
            guidance: preferenceBasinGuidance,
        })
        : latent;
    const candidate = evaluator.evaluate({
        seed,
        phenotype,
        referenceFeatures,
        baselinePhenotype,
        modelInput: { latent: pairwiseScoringLatent },
        preflightReject: true,
    });
    if (!candidate) {
        return null;
    }
    const objectiveScore = resolveObjectiveScore(candidate, objectiveMode, {
        reliabilityHint,
    });
    const basinAssessment = preferenceBasinGuidance
        ? scoreSakuraPreferenceBasinAffinity({
            latent,
            guidance: preferenceBasinGuidance,
        })
        : null;
    const basinAdjustment = basinAssessment
        ? applySakuraPreferenceBasinPenalty({
            baseObjective: objectiveScore,
            affinity: basinAssessment.affinity,
            support: basinAssessment.support,
            reliabilityHint,
        })
        : {
            objective: objectiveScore,
            penalty: 0,
            penaltyWeight: 0,
        };
    return {
        ...candidate,
        scores: {
            ...(candidate?.scores || {}),
            objectiveBase: round(objectiveScore),
            preferenceBasin: basinAssessment ? round(basinAssessment.affinity) : null,
            preferenceBasinInsideRatio: basinAssessment
                ? round(basinAssessment.insideRatio)
                : null,
            preferenceBasinPenalty: round(basinAdjustment.penalty),
            preferenceBasinPenaltyWeight: round(basinAdjustment.penaltyWeight),
            objective: round(basinAdjustment.objective),
        },
        latent: clampSakuraLatentByLearningRange(latent, {
            profile: learningKeyspaceProfile,
        }),
    };
};

const pickMapElitesParentLatent = ({
    archiveEntries,
    defaultLatent,
    mutationScale,
    mutationBoost = 1,
    diversityFloor = 0.08,
    explorationBias = 0,
    randomModel,
    learningLatentKeys = [],
    learningLatentExcludedKeys = [],
    learningKeyspaceProfile = null,
}) => {
    const safeExplorationBias = clamp01(explorationBias);
    const rng = () => randomModel.next();
    if (!archiveEntries.length) {
        return stabilizeLearningLatent(mutateSakuraLatent(defaultLatent, {
            intensity: clamp(
                mutationScale * (1.04 + (safeExplorationBias * 0.22)) * mutationBoost,
                0.05,
                0.34,
            ),
            mutationRate: clamp(0.86 + (safeExplorationBias * 0.08), 0.78, 0.96),
            rng,
        }), defaultLatent, learningLatentExcludedKeys, learningKeyspaceProfile);
    }

    const topSlice = Math.max(1, Math.floor(archiveEntries.length * 0.35));
    const randomChance = clamp(
        RANDOM_IMMIGRANT_RATE * (1 + (safeExplorationBias * 1.1)) * mutationBoost,
        0.06,
        0.58,
    );
    const roll = randomModel.next();
    const pickRandom = () => randomModel.pick(archiveEntries, archiveEntries[0]);
    const pickTop = () => randomModel.pick(archiveEntries.slice(0, topSlice), archiveEntries[0]);

    if (roll < randomChance) {
        if (randomModel.chance(0.5)) {
            return stabilizeLearningLatent(mutateSakuraLatent(defaultLatent, {
                intensity: clamp(
                    mutationScale * (1.08 + diversityFloor * 0.4 + (safeExplorationBias * 0.18)) * mutationBoost,
                    0.06,
                    0.36,
                ),
                mutationRate: clamp(0.9 + (safeExplorationBias * 0.08), 0.82, 0.98),
                rng,
            }), defaultLatent, learningLatentExcludedKeys, learningKeyspaceProfile);
        }
        return stabilizeLearningLatent(
            createRandomSakuraLatent(rng),
            defaultLatent,
            learningLatentExcludedKeys,
            learningKeyspaceProfile,
        );
    }

    const parentA = roll < 0.56 ? pickRandom() : pickTop();
    let childLatent = parentA?.latent || defaultLatent;
    if (archiveEntries.length > 1 && randomModel.chance(0.52)) {
        const parentB = randomModel.chance(0.7) ? pickTop() : pickRandom();
        childLatent = crossoverLatent(
            parentA?.latent || defaultLatent,
            parentB?.latent || defaultLatent,
            learningLatentKeys,
            learningLatentExcludedKeys,
            learningKeyspaceProfile,
            rng,
        );
    }

    childLatent = mutateSakuraLatent(childLatent, {
        intensity: clamp(
            mutationScale * (0.9 + (safeExplorationBias * 0.16) + randomModel.range(0, 0.35)) * mutationBoost,
            0.05,
            0.34,
        ),
        mutationRate: clamp(0.8 + (safeExplorationBias * 0.1) + randomModel.range(0, 0.16), 0.64, 0.98),
        rng,
    });

    if (randomModel.chance(clamp(
        IMMIGRANT_RANDOM_RESET_RATE * (1 + (safeExplorationBias * 0.9)) * mutationBoost,
        0.12,
        0.62,
    ))) {
        childLatent = randomModel.chance(0.46)
            ? stabilizeLearningLatent(
                createRandomSakuraLatent(rng),
                defaultLatent,
                learningLatentExcludedKeys,
                learningKeyspaceProfile,
            )
            : stabilizeLearningLatent(mutateSakuraLatent(defaultLatent, {
                intensity: clamp(mutationScale * 1.1, 0.08, 0.36),
                mutationRate: 0.92,
                rng,
            }), defaultLatent, learningLatentExcludedKeys, learningKeyspaceProfile);
    }
    return stabilizeLearningLatent(
        childLatent,
        defaultLatent,
        learningLatentExcludedKeys,
        learningKeyspaceProfile,
    );
};

export const optimizeSakuraLatentDesign = ({
    treeType = 'sakura',
    species,
    stage,
    width,
    height,
    topologyHeight,
    brain,
    pairwiseBrain,
    objectiveMode = 'adaptive',
    basePhenotype: _basePhenotype = null,
    baseLatent = null,
    referenceFeatures = [],
    populationSize = 24,
    generations = 3,
    eliteCount = 4,
    mutationIntensity = 0.16,
    binsX = MAP_ELITES_DEFAULT_BINS_X,
    binsY = MAP_ELITES_DEFAULT_BINS_Y,
    diverseTopK = MAP_ELITES_DEFAULT_DIVERSE_TOP_K,
    reliabilityHint = 0,
    learningKeyspaceProfile = null,
    preferenceBasinGuidance = null,
    onProgress,
} = {}) => {
    if (treeType !== 'sakura' || !species || !width || !height) {
        return null;
    }

    const safeObjectiveMode = normalizeObjectiveMode(objectiveMode);
    const safeReliabilityHint = clamp01(reliabilityHint);
    const adaptiveReliability = resolveAdaptiveReliability(safeReliabilityHint);
    const explorationBias = clamp01(1 - adaptiveReliability);
    const resolvedLearningKeyspaceProfile = resolveSakuraLearningLatentProfile(
        learningKeyspaceProfile,
    );
    const learningLatentKeys = listSakuraLearningLatentKeys({
        profile: resolvedLearningKeyspaceProfile,
    });
    const learningLatentExcludedKeys = listSakuraLearningLatentExcludedKeys({
        profile: resolvedLearningKeyspaceProfile,
    });
    if (!learningLatentKeys.length) {
        return null;
    }
    const safeBinsX = Math.max(2, Math.floor(binsX));
    const safeBinsY = Math.max(2, Math.floor(binsY));
    const totalCells = safeBinsX * safeBinsY;
    const defaultLatent = requireOptimizationBaseLatent(
        baseLatent,
        resolvedLearningKeyspaceProfile,
    );
    const canonicalBasinGuidance = safeObjectiveMode === 'adaptive'
        ? requireSakuraOptimizationBasinGuidance(preferenceBasinGuidance, {
            learningKeyspaceProfile: resolvedLearningKeyspaceProfile,
        })
        : null;
    const optimizationFrozenKeys = canonicalBasinGuidance
        ? Array.from(new Set([
            ...learningLatentExcludedKeys,
            ...canonicalBasinGuidance.unresolvedFactorKeys,
        ]))
        : learningLatentExcludedKeys;
    const basinGuideLatent = canonicalBasinGuidance
        ? stabilizeLearningLatent(
            buildSakuraStableBasinGuideLatent({
                baseLatent: defaultLatent,
                guidance: canonicalBasinGuidance,
            }),
            defaultLatent,
            optimizationFrozenKeys,
            resolvedLearningKeyspaceProfile,
        )
        : defaultLatent;
    const defaultPhenotype = clampPhenotype(
        compileSakuraPhenotypeFromLatent(defaultLatent),
    );
    const safePopulation = Math.max(12, populationSize);
    const safeGenerations = Math.max(1, generations);
    const safeElite = Math.max(2, Math.min(eliteCount, Math.floor(safePopulation * 0.2)));
    const internalReferenceFeatures = [...(referenceFeatures || [])];

    const randomModel = new RandomFactorModel();
    const scoreModel = new CandidateScoreModel({
        brain,
        pairwiseBrain,
        continuityEnabled: false,
        objectiveMode: safeObjectiveMode === 'adaptive' ? 'pairwise' : safeObjectiveMode,
    });
    const constraintModel = new ExplicitConstraintModel({
        baselinePhenotype: defaultPhenotype,
    });
    const evaluator = new BonsaiCandidateEvaluator({
        treeType: 'sakura',
        species,
        stageProfiles: stage,
        width,
        height,
        topologyHeight,
        referenceFeatures: internalReferenceFeatures,
        scoreModel,
        constraintModel,
        baselinePhenotype: defaultPhenotype,
    });

    const rng = () => randomModel.next();
    const archive = {};
    const generationLog = [];
    let bestCandidate = null;
    let bestObjective = Number.NEGATIVE_INFINITY;
    let stagnationCount = 0;

    for (let generation = 0; generation < safeGenerations; generation += 1) {
        if (typeof onProgress === 'function') {
            onProgress(generation / safeGenerations);
        }

        const reliabilityMutationScale = 1 + (explorationBias * 0.24);
        const decaySlope = 0.32 + (explorationBias * 0.08);
        const adaptiveIntensity = clamp(
            mutationIntensity * reliabilityMutationScale * (1 - (generation / safeGenerations) * decaySlope),
            mutationIntensity * (0.5 + (explorationBias * 0.1)),
            mutationIntensity * (1.15 + (explorationBias * 0.18)),
        );

        const archiveEntriesBefore = getMapElitesEntries(archive);
        const archiveDiversity = calculatePopulationDiversity(archiveEntriesBefore);
        const diversityFloor = clamp(0.07 + adaptiveIntensity * 0.11, 0.06, 0.2);
        const diversityPressure = clamp(
            (diversityFloor - archiveDiversity) / Math.max(0.001, diversityFloor),
            0,
            1,
        );
        const mutationBoost = 1
            + (0.35 * diversityPressure)
            + (explorationBias * 0.24)
            + (stagnationCount >= 2 ? 0.22 : 0);
        const generation0GuidedRatio = clamp(
            0.88 - (explorationBias * 0.28),
            0.56,
            0.9,
        );

        const evaluated = [];
        for (let index = 0; index < safePopulation; index += 1) {
            let latent;
            if (generation === 0 && index === 0) {
                latent = defaultLatent;
            } else if (generation === 0 && index === 1 && canonicalBasinGuidance) {
                latent = basinGuideLatent;
            } else if (generation === 0 && index < Math.floor(safePopulation * generation0GuidedRatio)) {
                const guidedParent = canonicalBasinGuidance && index % 2 === 1
                    ? basinGuideLatent
                    : defaultLatent;
                latent = mutateSakuraLatent(guidedParent, {
                    intensity: clamp(adaptiveIntensity * (0.62 + randomModel.range(0, 0.75)), 0.05, 0.34),
                    mutationRate: clamp(0.84 + (explorationBias * 0.1), 0.74, 0.96),
                    rng,
                });
            } else if (generation === 0) {
                latent = createRandomSakuraLatent(rng);
            } else {
                latent = pickMapElitesParentLatent({
                    archiveEntries: archiveEntriesBefore,
                    defaultLatent,
                    mutationScale: adaptiveIntensity,
                    mutationBoost,
                    diversityFloor,
                    explorationBias,
                    randomModel,
                    learningLatentKeys,
                    learningLatentExcludedKeys: optimizationFrozenKeys,
                    learningKeyspaceProfile: resolvedLearningKeyspaceProfile,
                });
            }
            latent = stabilizeLearningLatent(
                latent,
                defaultLatent,
                optimizationFrozenKeys,
                resolvedLearningKeyspaceProfile,
            );

            const candidate = evaluateLatentCandidate({
                evaluator,
                latent,
                seed: randomModel.randomSeed(),
                baselinePhenotype: defaultPhenotype,
                referenceFeatures: internalReferenceFeatures,
                objectiveMode: safeObjectiveMode,
                reliabilityHint: safeReliabilityHint,
                learningKeyspaceProfile: resolvedLearningKeyspaceProfile,
                preferenceBasinGuidance: canonicalBasinGuidance,
                preferenceBasinBaseLatent: defaultLatent,
            });
            if (!candidate) {
                continue;
            }
            if (!isCandidateFeasible(candidate)) {
                continue;
            }

            upsertMapElitesArchive({
                archive,
                candidate,
                binsX: safeBinsX,
                binsY: safeBinsY,
            });

            evaluated.push({
                ...candidate,
                __objective: resolveObjectiveScore(candidate, safeObjectiveMode, {
                    reliabilityHint: safeReliabilityHint,
                }),
                __selection: scoreForSelection(candidate, safeObjectiveMode, {
                    reliabilityHint: safeReliabilityHint,
                }),
            });
        }

        if (!evaluated.length) {
            continue;
        }

        evaluated.sort((a, b) => (b.__objective || 0) - (a.__objective || 0));
        const top = evaluated[0];
        const bottom = evaluated[evaluated.length - 1];
        const meanObjective = evaluated.reduce((acc, entry) => acc + (entry.__objective || 0), 0) / evaluated.length;
        const topObjective = Number(top.__objective || 0);
        if (topObjective > bestObjective + MIN_OBJECTIVE_IMPROVEMENT) {
            bestObjective = topObjective;
            bestCandidate = top;
            stagnationCount = 0;
        } else {
            stagnationCount += 1;
        }

        if (internalReferenceFeatures.length < 50) {
            const eliteFeatures = evaluated.slice(0, 2).map((entry) => ({ ...(entry.analysis.features || {}) }));
            internalReferenceFeatures.push(...eliteFeatures);
        }

        const archiveEntries = getMapElitesEntries(archive);
        if (!archiveEntries.length) {
            throw createSakuraOptimizationError(
                'ZEN_SAKURA_OPTIMIZATION_ARCHIVE_ENTRY_REQUIRED',
                'Sakura latent optimization archive lost its canonical top candidate.',
                {
                    generation,
                    objectiveMode: safeObjectiveMode,
                },
            );
        }
        const archiveTop = archiveEntries[0];
        const archiveTopQuality = Number(archiveTop.quality ?? scoreMapElitesQuality(archiveTop));

        generationLog.push({
            generation,
            topScore: round(top.scores?.blended || 0),
            topObjective: round(topObjective),
            topContinuity: round(top.feasibility?.continuityScore || 0),
            meanScore: round(meanObjective),
            meanBlendedScore: round(
                evaluated.reduce((acc, entry) => acc + (Number(entry.scores?.blended) || 0), 0) / evaluated.length,
            ),
            bottomScore: round(bottom.scores?.blended || 0),
            populationDiversity: round(calculatePopulationDiversity(evaluated)),
            archiveDiversity: round(archiveDiversity),
            diversityFloor: round(diversityFloor),
            mutationBoost: round(mutationBoost, 3),
            explorationBias: round(explorationBias, 3),
            adaptiveReliability: round(adaptiveReliability, 3),
            generation0GuidedRatio: round(generation0GuidedRatio, 3),
            stagnationCount,
            topFactors: top.analysis?.evaluation?.strongest?.slice(0, 3) || [],
            weakFactors: top.analysis?.evaluation?.weakest?.slice(0, 3) || [],
            archiveFilled: archiveEntries.length,
            archiveFillRatio: round(archiveEntries.length / Math.max(1, totalCells), 3),
            archiveTopQuality: round(archiveTopQuality),
        });
    }

    const archiveEntries = getMapElitesEntries(archive);
    if (!archiveEntries.length) {
        throw createSakuraOptimizationError(
            'ZEN_SAKURA_OPTIMIZATION_ARCHIVE_EMPTY',
            'Sakura latent optimization produced no archive entries.',
            {
                objectiveMode: safeObjectiveMode,
                generations: safeGenerations,
            },
        );
    }
    if (!bestCandidate) {
        throw createSakuraOptimizationError(
            'ZEN_SAKURA_OPTIMIZATION_BEST_CANDIDATE_REQUIRED',
            'Sakura latent optimization lost its canonical best candidate.',
            {
                objectiveMode: safeObjectiveMode,
                archiveEntries: archiveEntries.length,
            },
        );
    }

    const diverseArchiveEntries = selectDiverseArchiveEntries(
        archiveEntries,
        Math.max(6, diverseTopK),
    );
    const diverseTop = [
        bestCandidate,
        ...diverseArchiveEntries.filter((entry) => entry !== bestCandidate),
    ].slice(0, Math.max(6, diverseTopK));
    const archetypeSet = selectDppArchetypeSet({
        entries: diverseTop,
        desiredCount: Math.min(3, Math.max(1, diverseTop.length)),
        scoreForSelection: (entry) => scoreForSelection(entry, safeObjectiveMode, {
            reliabilityHint: safeReliabilityHint,
        }),
        resolveDescriptor: resolveCandidateDescriptor,
        descriptorDistance,
    });
    if (!archetypeSet.length) {
        throw createSakuraOptimizationError(
            'ZEN_SAKURA_OPTIMIZATION_ARCHETYPE_SET_EMPTY',
            'Sakura latent optimization produced no canonical archetype set.',
            {
                objectiveMode: safeObjectiveMode,
                archiveEntries: archiveEntries.length,
                diverseTop: diverseTop.length,
            },
        );
    }
    const recommendedCandidate = archetypeSet[0];
    const leaderboard = Array.from(new Set([bestCandidate, ...archiveEntries]))
        .map((entry) => ({
            ...entry,
            __objective: resolveObjectiveScore(entry, safeObjectiveMode, {
                reliabilityHint: safeReliabilityHint,
            }),
            __selection: scoreForSelection(entry, safeObjectiveMode, {
                reliabilityHint: safeReliabilityHint,
            }),
        }))
        .sort((a, b) => (b.__selection || 0) - (a.__selection || 0))
        .slice(0, Math.max(8, safeElite * 2));
    const filledCells = archiveEntries.length;
    const latestTop = generationLog[generationLog.length - 1];
    if (!latestTop) {
        throw createSakuraOptimizationError(
            'ZEN_SAKURA_OPTIMIZATION_GENERATION_LOG_REQUIRED',
            'Sakura latent optimization requires generation log output.',
            {
                objectiveMode: safeObjectiveMode,
                archiveEntries: archiveEntries.length,
            },
        );
    }

    const rawResult = {
        bestCandidate,
        recommendedCandidate,
        leaderboard,
        diverseTop,
        archetypeSet,
        archetype: {
            method: DPP_ARCHETYPE_METHOD,
            count: archetypeSet.length,
            poolCount: diverseTop.length,
        },
        objectiveMode: safeObjectiveMode,
        generationLog,
        mapElites: {
            mode: 'latent_map_elites',
            binsX: safeBinsX,
            binsY: safeBinsY,
            filledCells,
            totalCells,
            fillRatio: round(filledCells / Math.max(1, totalCells), 3),
            diverseTopCount: diverseTop.length,
        },
        objective: {
            mode: safeObjectiveMode,
            reliabilityHint: round(safeReliabilityHint, 3),
            adaptiveReliability: round(adaptiveReliability, 3),
            topScore: round(latestTop.topObjective || 0),
        },
        learningKeyspaceProfile: resolvedLearningKeyspaceProfile,
        latent: {
            best: bestCandidate?.latent ? { ...bestCandidate.latent } : null,
            recommended: recommendedCandidate?.latent ? { ...recommendedCandidate.latent } : null,
        },
    };
    return normalizeSakuraOptimizationResult(rawResult, {
        learningKeyspaceProfile: resolvedLearningKeyspaceProfile,
        maxGenerationLogEntries: 18,
        maxArchetypeSetEntries: 6,
    });
};
