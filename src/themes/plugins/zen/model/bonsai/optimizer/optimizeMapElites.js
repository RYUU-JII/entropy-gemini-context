import {
    clampPhenotype,
    crossoverPhenotype,
    getDefaultPhenotype,
    mutatePhenotype,
    randomPhenotype,
} from '../../BonsaiGenetics';
import {
    getMapElitesEntries,
    scoreMapElitesQuality,
    upsertMapElitesArchive,
} from '../../MapElitesArchive';
import { DPP_ARCHETYPE_METHOD, selectDppArchetypeSet } from '../../ArchetypeDpp';
import {
    clamp,
    createEvaluatorEngines,
    calculatePopulationDiversity,
    resolveObjectiveScore,
    scoreForSelection,
    isCandidateFeasible,
    selectDiverseArchiveEntries,
    resolveCandidateDescriptor,
    descriptorDistance,
    pickRecommendedCandidate,
    buildMapElitesBootstrapPool,
    normalizeObjectiveMode,
    RANDOM_IMMIGRANT_RATE,
    MAP_ELITES_MIN_FILLED_CELLS,
    MAP_ELITES_RESCUE_ATTEMPTS,
    MIN_OBJECTIVE_IMPROVEMENT,
    OPTIMIZATION_PROTOCOL_STEPS,
} from './shared';

const pickMapElitesParentPhenotype = ({
    archiveEntries,
    defaultPhenotype,
    treeType,
    mutationScale,
    randomModel,
    mutationBoost = 1,
    diversityFloor = 0.08,
}) => {
    const rng = () => randomModel.next();
    if (!archiveEntries.length) {
        return mutatePhenotype(defaultPhenotype, {
            intensity: clamp(mutationScale * 1.04 * mutationBoost, 0.05, 0.34),
            mutationRate: 0.86,
            rng,
        });
    }

    const topSlice = Math.max(1, Math.floor(archiveEntries.length * 0.35));
    const randomChance = clamp(
        RANDOM_IMMIGRANT_RATE * mutationBoost,
        0.06,
        0.42,
    );
    const roll = randomModel.next();
    const pickRandom = () => randomModel.pick(archiveEntries, archiveEntries[0]);
    const pickTop = () => randomModel.pick(archiveEntries.slice(0, topSlice), archiveEntries[0]);

    if (roll < randomChance) {
        return randomModel.chance(0.5)
            ? mutatePhenotype(defaultPhenotype, {
                intensity: clamp(
                    mutationScale * (1.08 + diversityFloor * 0.4) * mutationBoost,
                    0.06,
                    0.36,
                ),
                mutationRate: 0.9,
                rng,
            })
            : randomPhenotype(treeType, rng);
    }

    const parentA = roll < 0.56 ? pickRandom() : pickTop();
    let childPhenotype = parentA.phenotype;
    if (archiveEntries.length > 1 && randomModel.chance(0.52)) {
        const parentB = randomModel.chance(0.7) ? pickTop() : pickRandom();
        childPhenotype = crossoverPhenotype(parentA.phenotype, parentB.phenotype, {
            blend: 0.42,
            rng,
        });
    }

    return mutatePhenotype(childPhenotype, {
        intensity: clamp(
            mutationScale * (0.9 + randomModel.range(0, 0.35)) * mutationBoost,
            0.05,
            0.34,
        ),
        mutationRate: 0.8 + randomModel.range(0, 0.16),
        rng,
    });
};

export const optimizeTreeDesignMapElites = ({
    treeType,
    species,
    stage,
    width,
    height,
    topologyHeight,
    brain,
    pairwiseBrain,
    objectiveMode = 'blended',
    basePhenotype,
    referenceFeatures = [],
    populationSize = 24,
    generations = 3,
    eliteCount = 4,
    mutationIntensity = 0.16,
    binsX,
    binsY,
    diverseTopK,
    onProgress,
}) => {
    if (!species || !width || !height) {
        return null;
    }

    const safeObjectiveMode = normalizeObjectiveMode(objectiveMode);
    const safeBinsX = Math.max(2, Math.floor(binsX));
    const safeBinsY = Math.max(2, Math.floor(binsY));
    const totalCells = safeBinsX * safeBinsY;
    const defaultPhenotype = clampPhenotype(basePhenotype || getDefaultPhenotype(treeType));
    const safePopulation = Math.max(12, populationSize);
    const safeGenerations = Math.max(1, generations);
    const safeElite = Math.max(2, Math.min(eliteCount, Math.floor(safePopulation * 0.2)));
    const internalReferenceFeatures = [...(referenceFeatures || [])];

    const {
        randomModel,
        evaluator,
    } = createEvaluatorEngines({
        treeType,
        species,
        stage,
        width,
        height,
        topologyHeight,
        brain,
        pairwiseBrain,
        objectiveMode: safeObjectiveMode,
        defaultPhenotype,
        referenceFeatures: internalReferenceFeatures,
    });

    const rng = () => randomModel.next();
    const archive = {};
    const generationLog = [];
    let bestCandidate = null;
    let bestObjective = Number.NEGATIVE_INFINITY;
    let stagnationCount = 0;
    const bootstrapPool = buildMapElitesBootstrapPool({
        defaultPhenotype,
        randomModel,
        desiredCount: Math.max(4, Math.min(safePopulation - 1, 6)),
    });

    for (let generation = 0; generation < safeGenerations; generation += 1) {
        if (onProgress) {
            onProgress(generation / safeGenerations);
        }

        const adaptiveIntensity = clamp(
            mutationIntensity * (1.0 - (generation / safeGenerations) * 0.38),
            mutationIntensity * 0.52,
            mutationIntensity * 1.12,
        );

        const archiveEntriesBefore = getMapElitesEntries(archive);
        const archiveDiversity = calculatePopulationDiversity(archiveEntriesBefore);
        const diversityFloor = clamp(
            0.07 + adaptiveIntensity * 0.11,
            0.06,
            0.2,
        );
        const diversityPressure = clamp(
            (diversityFloor - archiveDiversity) / Math.max(0.001, diversityFloor),
            0,
            1,
        );
        const mutationBoost = 1 + 0.35 * diversityPressure + (stagnationCount >= 2 ? 0.22 : 0);

        const evaluated = [];
        for (let index = 0; index < safePopulation; index += 1) {
            const seed = randomModel.randomSeed();
            let phenotype;
            if (generation === 0 && index === 0) {
                phenotype = defaultPhenotype;
            } else if (generation === 0 && index - 1 < bootstrapPool.length) {
                phenotype = bootstrapPool[index - 1];
            } else if (generation === 0 && index < Math.floor(safePopulation * 0.85)) {
                phenotype = mutatePhenotype(defaultPhenotype, {
                    intensity: clamp(adaptiveIntensity * (0.62 + randomModel.range(0, 0.75)), 0.05, 0.34),
                    mutationRate: 0.86,
                    rng,
                });
            } else if (generation === 0) {
                phenotype = randomPhenotype(treeType, rng);
            } else {
                phenotype = pickMapElitesParentPhenotype({
                    archiveEntries: archiveEntriesBefore,
                    defaultPhenotype,
                    treeType,
                    mutationScale: adaptiveIntensity,
                    mutationBoost,
                    diversityFloor,
                    randomModel,
                });
            }

            const candidate = evaluator.evaluate({
                seed,
                phenotype,
                referenceFeatures: internalReferenceFeatures,
                baselinePhenotype: defaultPhenotype,
                preflightReject: true,
            });
            if (!candidate || !isCandidateFeasible(candidate)) {
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
                __objective: resolveObjectiveScore(candidate, safeObjectiveMode),
                __selection: scoreForSelection(candidate, safeObjectiveMode),
            });
        }

        if (!evaluated.length) {
            continue;
        }

        evaluated.sort((a, b) => (b.__objective || 0) - (a.__objective || 0));
        const top = evaluated[0];
        const bottom = evaluated[evaluated.length - 1];
        const meanObjective = evaluated.reduce((acc, cur) => acc + (cur.__objective || 0), 0) / evaluated.length;

        if (internalReferenceFeatures.length < 50) {
            const eliteFeatures = evaluated.slice(0, 2).map((entry) => ({ ...(entry.analysis.features || {}) }));
            internalReferenceFeatures.push(...eliteFeatures);
        }

        const archiveEntries = getMapElitesEntries(archive);
        const archiveTop = archiveEntries[0] || top;
        const topObjective = archiveTop.__objective || resolveObjectiveScore(archiveTop, safeObjectiveMode);
        const archiveTopQuality = Number(archiveTop.quality ?? scoreMapElitesQuality(archiveTop));
        if (topObjective > bestObjective + MIN_OBJECTIVE_IMPROVEMENT) {
            bestObjective = topObjective;
            bestCandidate = archiveTop;
            stagnationCount = 0;
        } else {
            stagnationCount += 1;
        }

        generationLog.push({
            generation,
            topScore: Number((top.scores?.blended || 0).toFixed(4)),
            topObjective: Number(topObjective.toFixed(4)),
            topContinuity: Number((top.feasibility?.continuityScore || 0).toFixed(4)),
            meanScore: Number(meanObjective.toFixed(4)),
            meanBlendedScore: Number(
                (evaluated.reduce(
                    (acc, candidate) => acc + (Number(candidate.scores?.blended) || 0),
                    0,
                ) / evaluated.length).toFixed(4),
            ),
            bottomScore: Number((bottom.scores?.blended || 0).toFixed(4)),
            populationDiversity: Number(calculatePopulationDiversity(evaluated).toFixed(4)),
            archiveDiversity: Number(archiveDiversity.toFixed(4)),
            diversityFloor: Number(diversityFloor.toFixed(4)),
            mutationBoost: Number(mutationBoost.toFixed(3)),
            stagnationCount,
            topFactors: top.analysis?.evaluation?.strongest?.slice(0, 3) || [],
            weakFactors: top.analysis?.evaluation?.weakest?.slice(0, 3) || [],
            archiveFilled: archiveEntries.length,
            archiveFillRatio: Number((archiveEntries.length / Math.max(1, totalCells)).toFixed(3)),
            archiveTopQuality: Number(archiveTopQuality.toFixed(4)),
        });
    }

    let archiveEntries = getMapElitesEntries(archive);
    if (archiveEntries.length < MAP_ELITES_MIN_FILLED_CELLS) {
        const rescuePool = buildMapElitesBootstrapPool({
            defaultPhenotype,
            randomModel,
            desiredCount: Math.max(8, 12),
        });
        for (let attempt = 0; attempt < MAP_ELITES_RESCUE_ATTEMPTS; attempt += 1) {
            const seed = randomModel.randomSeed();
            const base = rescuePool[attempt % rescuePool.length] || defaultPhenotype;
            const phenotype = mutatePhenotype(base, {
                intensity: clamp(mutationIntensity * (1.18 + randomModel.range(0, 0.52)), 0.12, 0.42),
                mutationRate: clamp(0.86 + randomModel.range(0, 0.1), 0.82, 0.98),
                rng,
            });
            const candidate = evaluator.evaluate({
                seed,
                phenotype,
                referenceFeatures: internalReferenceFeatures,
                baselinePhenotype: defaultPhenotype,
                preflightReject: true,
            });
            if (!candidate || !isCandidateFeasible(candidate)) {
                continue;
            }
            upsertMapElitesArchive({
                archive,
                candidate,
                binsX: safeBinsX,
                binsY: safeBinsY,
            });
            archiveEntries = getMapElitesEntries(archive);
            if (archiveEntries.length >= MAP_ELITES_MIN_FILLED_CELLS) {
                break;
            }
        }
    }

    if (archiveEntries.length < MAP_ELITES_MIN_FILLED_CELLS) {
        const softRescuePool = buildMapElitesBootstrapPool({
            defaultPhenotype,
            randomModel,
            desiredCount: Math.max(10, 18),
        });
        for (let attempt = 0; attempt < MAP_ELITES_RESCUE_ATTEMPTS; attempt += 1) {
            const seed = randomModel.randomSeed();
            const base = softRescuePool[attempt % softRescuePool.length] || defaultPhenotype;
            const phenotype = mutatePhenotype(base, {
                intensity: clamp(mutationIntensity * (1.16 + randomModel.range(0, 0.62)), 0.16, 0.48),
                mutationRate: clamp(0.84 + randomModel.range(0, 0.12), 0.8, 0.99),
                rng,
            });
            const candidate = evaluator.evaluate({
                seed,
                phenotype,
                referenceFeatures: internalReferenceFeatures,
                baselinePhenotype: defaultPhenotype,
                preflightReject: false,
            });
            if (!candidate) {
                continue;
            }
            upsertMapElitesArchive({
                archive,
                candidate,
                binsX: safeBinsX,
                binsY: safeBinsY,
            });
            archiveEntries = getMapElitesEntries(archive);
            if (archiveEntries.length >= MAP_ELITES_MIN_FILLED_CELLS) {
                break;
            }
        }
    }

    if (!archiveEntries.length) {
        return null;
    }

    const feasibleArchiveEntries = archiveEntries.filter((entry) => isCandidateFeasible(entry));
    const diverseSource = feasibleArchiveEntries.length >= MAP_ELITES_MIN_FILLED_CELLS
        ? feasibleArchiveEntries
        : archiveEntries;
    if (!bestCandidate) {
        bestCandidate = feasibleArchiveEntries[0] || archiveEntries[0];
    }

    const diverseTop = selectDiverseArchiveEntries(diverseSource, Math.max(6, diverseTopK));
    const archetypeSet = selectDppArchetypeSet({
        entries: diverseTop,
        desiredCount: Math.min(3, Math.max(1, diverseTop.length)),
        scoreForSelection: (entry) => scoreForSelection(entry, safeObjectiveMode),
        resolveDescriptor: resolveCandidateDescriptor,
        descriptorDistance,
    });
    const recommendedCandidate = archetypeSet[0]
        || pickRecommendedCandidate(diverseTop, safeObjectiveMode)
        || bestCandidate;
    const leaderboard = [...diverseSource]
        .map((entry) => ({
            ...entry,
            __objective: resolveObjectiveScore(entry, safeObjectiveMode),
            __selection: scoreForSelection(entry, safeObjectiveMode),
        }))
        .sort((a, b) => (b.__selection || 0) - (a.__selection || 0))
        .slice(0, Math.max(8, safeElite * 2));
    const filledCells = archiveEntries.length;
    const latestTop = generationLog[generationLog.length - 1] || {};

    return {
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
        protocol: OPTIMIZATION_PROTOCOL_STEPS,
        mapElites: {
            mode: 'map_elites',
            binsX: safeBinsX,
            binsY: safeBinsY,
            filledCells,
            totalCells,
            fillRatio: Number((filledCells / Math.max(1, totalCells)).toFixed(3)),
            diverseTopCount: diverseTop.length,
        },
        objective: {
            mode: safeObjectiveMode,
            topScore: Number((latestTop.topObjective || 0).toFixed(4)),
        },
    };
};
