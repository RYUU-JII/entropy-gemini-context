import { clampPhenotype } from '../../BonsaiGenetics';
import { ExplicitConstraintModel } from '../constraints/ExplicitConstraintModel';
import { RandomFactorModel } from '../factors/RandomFactorModel';
import { CandidateScoreModel } from '../scoring/CandidateScoreModel';
import { BonsaiCandidateEvaluator } from '../evaluation/BonsaiCandidateEvaluator';
import { deriveMapElitesDescriptor } from '../../MapElitesArchive';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clamp01 = (value) => clamp(value, 0, 1);

export const OPTIMIZATION_PROTOCOL_STEPS = [
    {
        id: 'baseline',
        title: '기준선 측정',
        action: '현재 트리의 rule/neural/combined 점수를 기록하고 약점 요인(weak factors)을 확인한다.',
    },
    {
        id: 'explore',
        title: '탐색 생성',
        action: '다수 후보를 생성해 상위/하위 트리를 함께 본다. 상위만 보면 과적합이 빨라진다.',
    },
    {
        id: 'label',
        title: '사람 라벨 학습',
        action: 'A/B 후보를 동시에 보고 더 아름답다고 판단한 개체를 선택해 학습 신호로 반영한다.',
    },
    {
        id: 'optimize',
        title: '세대 최적화',
        action: '엘리트 보존 + 교차/변이를 2~4세대 반복해 최고점을 갱신한다.',
    },
    {
        id: 'validate',
        title: '검증',
        action: '새로 얻은 상위 개체를 이전 베스트와 비교해 미학 요인이 일관되게 개선됐는지 확인한다.',
    },
];

export const RANDOM_IMMIGRANT_RATE = 0.08;
export const IMMIGRANT_RANDOM_RESET_RATE = 0.18;
export const MAP_ELITES_DEFAULT_BINS_X = 8;
export const MAP_ELITES_DEFAULT_BINS_Y = 8;
export const MAP_ELITES_DEFAULT_DIVERSE_TOP_K = 12;
export const MAP_ELITES_MIN_FILLED_CELLS = 2; // Reduced from 3 to ease start
export const MAP_ELITES_RESCUE_ATTEMPTS = 24; // Reduced from 72 to save computation
export const MIN_OBJECTIVE_IMPROVEMENT = 0.0004;

const MAP_ELITES_BOOTSTRAP_PRESETS = Object.freeze([
    {
        trunkStyle: 0.08,
        curvatureStrength: 0.14,
        curvatureBase: 0.1,
        branchChaos: 0.08,
        branchAngleBase: 0.28,
        verticalBias: 0.14,
        silhouetteTarget: 0.16,
        canopyBloomDensity: 0.08,
        canopyBloomRadius: 0.3,
        canopyLayerBalance: 0.18,
        flowerChance: 0.08,
        rootAsymmetry: -0.28,
    },
    {
        trunkStyle: 0.1,
        curvatureStrength: 0.22,
        curvatureBase: 0.14,
        branchChaos: 0.18,
        branchAngleBase: 0.35,
        verticalBias: 0.2,
        silhouetteTarget: 0.86,
        canopyBloomDensity: 0.84,
        canopyBloomRadius: 1.08,
        canopyLayerBalance: 0.86,
        flowerChance: 0.86,
        rootAsymmetry: 0.24,
    },
    {
        trunkStyle: 0.92,
        curvatureStrength: 1.9,
        curvatureBase: 0.74,
        branchChaos: 0.84,
        branchAngleBase: 1.2,
        verticalBias: 0.82,
        silhouetteTarget: 0.2,
        canopyBloomDensity: 0.12,
        canopyBloomRadius: 0.34,
        canopyLayerBalance: 0.22,
        flowerChance: 0.14,
        rootAsymmetry: -0.24,
    },
    {
        trunkStyle: 0.9,
        curvatureStrength: 2.08,
        curvatureBase: 0.78,
        branchChaos: 0.9,
        branchAngleBase: 1.26,
        verticalBias: 0.88,
        silhouetteTarget: 0.9,
        canopyBloomDensity: 0.88,
        canopyBloomRadius: 1.12,
        canopyLayerBalance: 0.9,
        flowerChance: 0.9,
        rootAsymmetry: 0.3,
    },
    {
        trunkStyle: 0.24,
        curvatureStrength: 1.08,
        curvatureBase: 0.42,
        branchChaos: 0.34,
        branchAngleBase: 0.62,
        verticalBias: 0.58,
        silhouetteTarget: 0.76,
        canopyBloomDensity: 0.32,
        canopyBloomRadius: 0.98,
        canopyLayerBalance: 0.68,
        flowerChance: 0.66,
        rootAsymmetry: 0.14,
    },
    {
        trunkStyle: 0.76,
        curvatureStrength: 0.86,
        curvatureBase: 0.56,
        branchChaos: 0.72,
        branchAngleBase: 0.94,
        verticalBias: 0.36,
        silhouetteTarget: 0.34,
        canopyBloomDensity: 0.72,
        canopyBloomRadius: 0.42,
        canopyLayerBalance: 0.32,
        flowerChance: 0.26,
        rootAsymmetry: -0.18,
    },
]);

export const normalizeObjectiveMode = (value) => (
    value === 'neural' || value === 'pairwise' || value === 'blended' || value === 'rule' || value === 'adaptive'
        ? value
        : 'blended'
);

export const resolveAdaptiveReliability = (reliabilityHint = 0) => {
    const safeHint = clamp01(Number.isFinite(Number(reliabilityHint)) ? Number(reliabilityHint) : 0);
    return clamp01((Math.pow(safeHint, 1.24) * 0.84) + (safeHint * 0.16));
};

const jitterPresetValue = (value, randomModel, amount = 0.06) => (
    Number(value) + randomModel.range(-amount, amount)
);

const buildMapElitesBootstrapPhenotype = ({
    defaultPhenotype = {},
    preset = {},
    randomModel,
    jitter = 0.06,
}) => {
    const merged = {
        ...defaultPhenotype,
    };
    Object.entries(preset || {}).forEach(([key, value]) => {
        merged[key] = jitterPresetValue(value, randomModel, jitter);
    });
    return clampPhenotype(merged);
};

export const buildMapElitesBootstrapPool = ({
    defaultPhenotype,
    randomModel,
    desiredCount = 0,
}) => {
    if (!Number.isFinite(desiredCount) || desiredCount <= 0) {
        return [];
    }
    const presets = randomModel.shuffle(MAP_ELITES_BOOTSTRAP_PRESETS);
    const pool = [];
    for (let index = 0; index < desiredCount; index += 1) {
        const preset = presets[index % presets.length];
        pool.push(buildMapElitesBootstrapPhenotype({
            defaultPhenotype,
            preset,
            randomModel,
            jitter: 0.08,
        }));
    }
    return pool;
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

export const resolveObjectiveScore = (entry, mode = 'blended', options = {}) => {
    const scores = entry?.scores || {};
    if (mode === 'adaptive') {
        return resolveAdaptiveObjectiveScore(scores, options?.reliabilityHint);
    }
    if (mode === 'pairwise') {
        const pairwiseScore = Number(scores.pairwise);
        if (Number.isFinite(pairwiseScore)) {
            return pairwiseScore;
        }
    }
    if (mode === 'neural') {
        const neuralScore = Number(scores.neural);
        if (Number.isFinite(neuralScore)) {
            return neuralScore;
        }
    }
    const blendedScore = Number(scores.blended);
    if (Number.isFinite(blendedScore)) {
        return blendedScore;
    }
    const objectiveScore = Number(scores.objective);
    return Number.isFinite(objectiveScore) ? objectiveScore : 0;
};

export const resolveCandidateDescriptor = (entry) => {
    if (entry?.descriptor?.x !== undefined && entry?.descriptor?.y !== undefined) {
        return entry.descriptor;
    }
    return deriveMapElitesDescriptor(entry);
};

export const descriptorDistance = (a, b) => {
    if (!a || !b) {
        return 0;
    }
    const dx = Number(a.x ?? 0.5) - Number(b.x ?? 0.5);
    const dy = Number(a.y ?? 0.5) - Number(b.y ?? 0.5);
    return Math.sqrt((dx * dx) + (dy * dy));
};

export const calculatePopulationDiversity = (entries = []) => {
    const candidates = Array.isArray(entries) ? entries : [];
    if (candidates.length < 2) {
        return 0;
    }

    const descriptors = candidates
        .map((entry) => {
            const descriptor = resolveCandidateDescriptor(entry);
            return Number.isFinite(descriptor?.x) && Number.isFinite(descriptor?.y)
                ? descriptor
                : null;
        })
        .filter(Boolean);

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

    // Scale up diversity score to reward any spread, since cells are limited
    return clamp(avgNearest * 1.5, 0, 1);
};

export const selectDiverseArchiveEntries = (
    entries,
    desiredCount = MAP_ELITES_DEFAULT_DIVERSE_TOP_K,
) => {
    if (!entries?.length) {
        return [];
    }
    const sorted = [...entries].sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0));
    const selected = [sorted[0]];
    while (selected.length < desiredCount && selected.length < sorted.length) {
        let best = null;
        let bestDiversityScore = -1;
        for (let i = 1; i < sorted.length; i += 1) {
            const candidate = sorted[i];
            if (selected.includes(candidate)) {
                continue;
            }
            const nearestDistance = selected.reduce(
                (acc, entry) => Math.min(
                    acc,
                    descriptorDistance(entry.descriptor, candidate.descriptor),
                ),
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

export const scoreForSelection = (entry, objectiveMode = 'blended', options = {}) => {
    const objectiveScore = resolveObjectiveScore(entry, objectiveMode, options);
    const noveltyScore = Number(entry?.scores?.novelty ?? 0);
    // Increase weight of objectiveScore in selection since all valid trees now pass
    if (objectiveMode === 'rule') {
        const ruleScore = Number(entry?.scores?.rule ?? 0);
        return (ruleScore * 0.95) + (noveltyScore * 0.05);
    }
    if (objectiveMode === 'adaptive') {
        const adaptiveReliability = resolveAdaptiveReliability(options?.reliabilityHint);
        const noveltyWeight = clamp(0.14 - (adaptiveReliability * 0.08), 0.06, 0.14);
        return (objectiveScore * (1 - noveltyWeight)) + (noveltyScore * noveltyWeight);
    }
    return (objectiveScore * 0.95) + (noveltyScore * 0.05);
};

export const isCandidateFeasible = (entry) => {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    const pass = entry?.feasibility?.pass;
    if (typeof pass === 'boolean') {
        return pass;
    }
    return true;
};

export const pickRecommendedCandidate = (entries, objectiveMode = 'blended', options = {}) => {
    if (!entries?.length) {
        return null;
    }
    return [...entries]
        .sort((a, b) => {
            const objectiveScoreA = scoreForSelection(a, objectiveMode, options);
            const objectiveScoreB = scoreForSelection(b, objectiveMode, options);
            return objectiveScoreB - objectiveScoreA;
        })[0];
};

export const createEvaluatorEngines = ({
    treeType,
    species,
    stage,
    width,
    height,
    topologyHeight,
    brain,
    pairwiseBrain,
    objectiveMode = 'blended',
    defaultPhenotype,
    referenceFeatures,
}) => {
    const randomModel = new RandomFactorModel();
    const constraintModel = new ExplicitConstraintModel({
        baselinePhenotype: defaultPhenotype,
    });
    const scoreModel = new CandidateScoreModel({
        brain,
        pairwiseBrain,
        continuityEnabled: false,
        objectiveMode: objectiveMode === 'adaptive' ? 'pairwise' : objectiveMode,
    });
    const evaluator = new BonsaiCandidateEvaluator({
        treeType,
        species,
        stageProfiles: stage,
        width,
        height,
        topologyHeight,
        referenceFeatures,
        scoreModel,
        constraintModel,
        baselinePhenotype: defaultPhenotype,
    });
    return {
        randomModel,
        constraintModel,
        evaluator,
    };
};

export const evaluatePopulation = ({
    population,
    evaluator,
    referenceFeatures,
    baselinePhenotype,
    objectiveMode = 'blended',
    reliabilityHint = 0,
}) => population
    .map((entry) => evaluator.evaluate({
        seed: entry.seed,
        phenotype: entry.phenotype,
        referenceFeatures,
        baselinePhenotype,
        preflightReject: true,
    }))
    .filter(Boolean)
    .map((entry) => ({
        ...entry,
        __objective: resolveObjectiveScore(entry, objectiveMode, { reliabilityHint }),
        __selection: scoreForSelection(entry, objectiveMode, { reliabilityHint }),
        __feasible: isCandidateFeasible(entry),
    }));
