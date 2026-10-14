import {
    Phenotype_FACTOR_DEFS,
    LEARNING_Phenotype_FACTOR_KEYS,
    clampPhenotype,
} from '../../BonsaiGenetics';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const safeSpan = (def) => Math.max(1e-6, (def?.max ?? 1) - (def?.min ?? 0));
const sigmoid = (value) => {
    const x = Number.isFinite(value) ? value : 0;
    if (x >= 12) {
        return 0.999994;
    }
    if (x <= -12) {
        return 0.000006;
    }
    return 1 / (1 + Math.exp(-x));
};

export const DEFAULT_MIN_ELITE_DISTANCE = 0.08; // Relaxed
export const DEFAULT_CONTINUITY_PASS_THRESHOLD = 0.25; // Relaxed to allow more gen0 survival

export const CONTINUITY_Phenotype_WEIGHTS = {
    widthBase: 1.7,
    widthTaper: 1.25,
    lengthBase: 1.15,
    branchingProb: 1.0,
    branchChaos: 0.95,
    branchAngleBase: 0.85,
    curvatureBase: 0.9,
    curvatureStrength: 0.9,
    curvatureDepthDecay: 0.82,
    verticalBias: 0.78,
    droopMiddle: 0.7,
    droopTip: 0.7,
    flowerChance: 1.5,
    foliageMin: 1.1,
    foliageVar: 1.0,
    seasonalBloomBias: 1.0,
    bloomClusterBias: 1.0,
    noiseStrength: 0.72,
    noiseScale: 0.68,
};

export class ExplicitConstraintModel {
    constructor({
        baselinePhenotype = null,
        continuityWeights = CONTINUITY_Phenotype_WEIGHTS,
        minEliteDistance = DEFAULT_MIN_ELITE_DISTANCE,
        continuityPassThreshold = DEFAULT_CONTINUITY_PASS_THRESHOLD,
    } = {}) {
        this.baselinePhenotype = baselinePhenotype ? clampPhenotype(baselinePhenotype) : null;
        this.continuityWeights = continuityWeights || CONTINUITY_Phenotype_WEIGHTS;
        this.minEliteDistance = Number.isFinite(minEliteDistance)
            ? Math.max(0, minEliteDistance)
            : DEFAULT_MIN_ELITE_DISTANCE;
        this.continuityPassThreshold = clamp01(continuityPassThreshold);
    }

    setBaselinePhenotype(phenotype) {
        this.baselinePhenotype = phenotype ? clampPhenotype(phenotype) : null;
        return this.baselinePhenotype;
    }

    phenotypeDistance(phenotypeA, phenotypeB) {
        const a = clampPhenotype(phenotypeA || {});
        const b = clampPhenotype(phenotypeB || {});
        const mse = LEARNING_Phenotype_FACTOR_KEYS.reduce((acc, key) => {
            const def = Phenotype_FACTOR_DEFS[key];
            const span = safeSpan(def);
            const diff = (Number(a[key]) - Number(b[key])) / span;
            return acc + (diff * diff);
        }, 0) / Math.max(1, LEARNING_Phenotype_FACTOR_KEYS.length);
        return Math.sqrt(mse);
    }

    scorePhenotypeContinuity(candidatePhenotype, baselinePhenotype = this.baselinePhenotype) {
        if (!baselinePhenotype) {
            return 1;
        }
        const current = clampPhenotype(candidatePhenotype || {});
        const baseline = clampPhenotype(baselinePhenotype || {});
        let weightedDiff = 0;
        let totalWeight = 0;

        LEARNING_Phenotype_FACTOR_KEYS.forEach((key) => {
            const def = Phenotype_FACTOR_DEFS[key];
            const span = safeSpan(def);
            const diff = Math.abs((Number(current[key]) - Number(baseline[key])) / span);
            const weight = this.continuityWeights[key] || 0.5;
            weightedDiff += diff * weight;
            totalWeight += weight;
        });

        const normalizedDiff = weightedDiff / Math.max(1e-6, totalWeight);
        return clamp01(1 - normalizedDiff);
    }

    predictPassProbability(continuityScore, threshold = this.continuityPassThreshold) {
        const safeScore = clamp01(Number(continuityScore));
        const safeThreshold = clamp01(Number(threshold));
        const margin = 0.08;
        return clamp01(sigmoid((safeScore - safeThreshold) / margin));
    }

    evaluateFeasibility(candidatePhenotype, baselinePhenotype = this.baselinePhenotype) {
        const continuityScore = this.scorePhenotypeContinuity(candidatePhenotype, baselinePhenotype);
        const threshold = this.continuityPassThreshold;
        const passProbability = this.predictPassProbability(continuityScore, threshold);
        return {
            pass: continuityScore >= threshold,
            passProbability,
            continuityScore,
            threshold,
        };
    }

    selectDiverseCandidates(candidates = [], desiredCount = 0, minDistance = this.minEliteDistance) {
        if (!Array.isArray(candidates) || !candidates.length || desiredCount <= 0) {
            return [];
        }
        const safeDistance = Number.isFinite(minDistance)
            ? Math.max(0, minDistance)
            : this.minEliteDistance;
        const selected = [];

        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const isDistinct = selected.every(
                (entry) => this.phenotypeDistance(entry.phenotype, candidate.phenotype) >= safeDistance,
            );
            if (!isDistinct) {
                continue;
            }
            selected.push(candidate);
            if (selected.length >= desiredCount) {
                return selected;
            }
        }

        for (let index = 0; index < candidates.length && selected.length < desiredCount; index += 1) {
            const candidate = candidates[index];
            if (!selected.includes(candidate)) {
                selected.push(candidate);
            }
        }

        return selected.slice(0, desiredCount);
    }
}
