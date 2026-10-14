import {
    clampPhenotype,
    crossoverPhenotype,
    getDefaultPhenotype,
    mutatePhenotype,
    randomPhenotype,
} from '../../BonsaiGenetics';
import {
    clamp,
    createEvaluatorEngines,
    evaluatePopulation,
    calculatePopulationDiversity,
    scoreForSelection,
    normalizeObjectiveMode,
    RANDOM_IMMIGRANT_RATE,
    IMMIGRANT_RANDOM_RESET_RATE,
    MIN_OBJECTIVE_IMPROVEMENT,
    OPTIMIZATION_PROTOCOL_STEPS,
} from './shared';

export const optimizeTreeDesignSingle = ({
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
    onProgress,
}) => {
    if (!species || !width || !height) {
        return null;
    }

    const safeObjectiveMode = normalizeObjectiveMode(objectiveMode);
    const defaultPhenotype = clampPhenotype(basePhenotype || getDefaultPhenotype(treeType));
    const safePopulation = Math.max(8, populationSize);
    const safeGenerations = Math.max(1, generations);
    const safeElite = Math.max(2, Math.min(eliteCount, Math.floor(safePopulation * 0.16)));
    const explorationQuota = Math.max(1, Math.floor(safePopulation * 0.1));
    const internalReferenceFeatures = [...(referenceFeatures || [])];
    const {
        randomModel,
        constraintModel,
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
    let population = Array.from({ length: safePopulation }, (_, index) => {
        const seed = randomModel.randomSeed();
        if (index === 0) {
            return { seed, phenotype: defaultPhenotype };
        }
        if (index <= explorationQuota) {
            return {
                seed,
                phenotype: mutatePhenotype(defaultPhenotype, {
                    intensity: clamp(mutationIntensity * 1.25, 0.06, 0.34),
                    mutationRate: 0.9,
                    rng,
                }),
            };
        }
        if (index < safePopulation - 1) {
            return {
                seed,
                phenotype: mutatePhenotype(defaultPhenotype, {
                    intensity: clamp(
                        mutationIntensity * (0.62 + randomModel.range(0, 0.7)),
                        0.05,
                        0.3,
                    ),
                    mutationRate: 0.84,
                    rng,
                }),
            };
        }
        return { seed, phenotype: randomPhenotype(treeType, rng) };
    });

    let bestCandidate = null;
    let bestObjective = Number.NEGATIVE_INFINITY;
    let stagnationCount = 0;
    let lastEvaluated = [];
    const generationLog = [];

    for (let generation = 0; generation < safeGenerations; generation += 1) {
        if (onProgress) {
            onProgress(generation / safeGenerations);
        }

        const adaptiveIntensity = clamp(
            mutationIntensity * (1.0 - (generation / safeGenerations) * 0.4),
            mutationIntensity * 0.55,
            mutationIntensity * 1.05,
        );

        const evaluatedAll = evaluatePopulation({
            population,
            evaluator,
            referenceFeatures: internalReferenceFeatures,
            baselinePhenotype: defaultPhenotype,
            objectiveMode: safeObjectiveMode,
        }).sort((a, b) => (b.__objective || 0) - (a.__objective || 0));
        const evaluated = evaluatedAll.filter((entry) => entry.__feasible);
        lastEvaluated = evaluated;

        if (!evaluated.length) {
            break;
        }

        const top = evaluated[0];
        const bottom = evaluated[evaluated.length - 1];
        const populationDiversity = calculatePopulationDiversity(evaluated);
        const diversityFloor = clamp(
            0.11 + adaptiveIntensity * 0.12,
            0.09,
            0.21,
        );
        const diversityPressure = clamp(
            (diversityFloor - populationDiversity) / Math.max(0.001, diversityFloor),
            0,
            1,
        );
        const mutationBoost = 1 + 0.32 * diversityPressure + (stagnationCount >= 2 ? 0.22 : 0);
        const eliteDiversityFloor = clamp(
            0.08 + adaptiveIntensity * 0.08 + diversityPressure * 0.10,
            0.08,
            0.18,
        );
        const immigrantRate = clamp(
            RANDOM_IMMIGRANT_RATE * mutationBoost,
            0.05,
            0.34,
        );
        const immigrantResetRate = clamp(
            IMMIGRANT_RANDOM_RESET_RATE * mutationBoost,
            0.1,
            0.5,
        );

        const topObjective = top.__objective || 0;
        const meanObjective = evaluated.reduce((acc, cur) => acc + (cur.__objective || 0), 0) / evaluated.length;
        if (topObjective > bestObjective + MIN_OBJECTIVE_IMPROVEMENT) {
            bestObjective = topObjective;
            bestCandidate = top;
            stagnationCount = 0;
        } else {
            stagnationCount += 1;
        }

        if (internalReferenceFeatures.length < 50) {
            const eliteFeatures = evaluated.slice(0, 2).map(
                (entry) => ({ ...(entry.analysis.features || {}) }),
            );
            internalReferenceFeatures.push(...eliteFeatures);
        }

        generationLog.push({
            generation,
            topScore: Number((top.scores?.blended || 0).toFixed(4)),
            topObjective: Number(topObjective.toFixed(4)),
            topContinuity: Number((top.feasibility?.continuityScore || 0).toFixed(4)),
            meanScore: Number(meanObjective.toFixed(4)),
            meanBlendedScore: Number((
                evaluated.reduce((acc, entry) => acc + (Number(entry.scores?.blended) || 0), 0)
                    / evaluated.length
            ).toFixed(4)),
            bottomScore: Number((bottom.scores?.blended || 0).toFixed(4)),
            populationDiversity: Number(populationDiversity.toFixed(4)),
            feasibleCount: evaluated.length,
            feasibleRate: Number((evaluated.length / Math.max(1, evaluatedAll.length)).toFixed(4)),
            diversityFloor: Number(diversityFloor.toFixed(4)),
            mutationBoost: Number(mutationBoost.toFixed(3)),
            stagnationCount,
            topFactors: top.analysis.evaluation?.strongest?.slice(0, 3) || [],
            weakFactors: top.analysis.evaluation?.weakest?.slice(0, 3) || [],
        });

        const elites = constraintModel.selectDiverseCandidates(
            evaluated,
            safeElite,
            eliteDiversityFloor,
        );

        if (generation < safeGenerations - 1) {
            const nextPopulation = elites.map((entry) => ({
                seed: entry.seed,
                phenotype: entry.phenotype,
            }));

            while (nextPopulation.length < safePopulation) {
                const scoreSelector = (entry) => entry.__selection || scoreForSelection(entry, safeObjectiveMode);
                const parentA = randomModel.pickTournament(elites, scoreSelector, 4) || top;
                const parentB = randomModel.pickTournament(elites, scoreSelector, 4) || top;

                const mutationScale = clamp(
                    adaptiveIntensity * (0.82 + randomModel.range(0, 0.35)) * mutationBoost,
                    mutationIntensity * 0.45,
                    mutationIntensity * 1.38,
                );

                let childPhenotype;
                if (randomModel.chance(0.65)) {
                    childPhenotype = crossoverPhenotype(parentA.phenotype, parentB.phenotype, {
                        blend: 0.4,
                        rng,
                    });
                    childPhenotype = mutatePhenotype(childPhenotype, {
                        intensity: mutationScale,
                        mutationRate: clamp(0.82 + randomModel.range(0, 0.14), 0.72, 0.96),
                        rng,
                    });
                } else {
                    childPhenotype = mutatePhenotype(parentA.phenotype, {
                        intensity: mutationScale * 1.08,
                        mutationRate: clamp(0.8 + randomModel.range(0, 0.16), 0.7, 0.96),
                        rng,
                    });
                }

                if (randomModel.chance(immigrantRate)) {
                    childPhenotype = mutatePhenotype(defaultPhenotype, {
                        intensity: clamp(
                            mutationScale * (1.16 + randomModel.range(0, 0.52)),
                            mutationIntensity * 0.8,
                            0.34,
                        ),
                        mutationRate: 0.9,
                        rng,
                    });
                    if (randomModel.chance(immigrantResetRate)) {
                        childPhenotype = randomPhenotype(treeType, rng);
                    }
                }

                nextPopulation.push({
                    seed: randomModel.randomSeed(),
                    phenotype: childPhenotype,
                });
            }

            population = nextPopulation;
        }
    }

    if (!bestCandidate) {
        return null;
    }

    const leaderboard = [...lastEvaluated]
        .sort((a, b) => (b.__objective || 0) - (a.__objective || 0))
        .slice(0, Math.max(8, safeElite * 2));

    return {
        bestCandidate,
        leaderboard,
        objectiveMode: safeObjectiveMode,
        generationLog,
        protocol: OPTIMIZATION_PROTOCOL_STEPS,
    };
};
