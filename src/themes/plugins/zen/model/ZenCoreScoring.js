import { AB_EXPLORATION_STRATEGY } from './ExplorationAB';
import { TREE_FEATURE_KEYS } from './TreeAnalyzer';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from './bonsai/evaluation/bonsaiCandidateEvaluationProfile';
import { AB_GENERATION_MODE } from './ZenCoreConfig';

export {
    blendScores,
    resolveAdaptiveObjectiveWeights,
    resolveBlendWeights,
    scoreAdaptiveObjective,
} from './bonsai/scoring/candidateScoreBlending';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const round = (value, digits = 3) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);
const meanStd = (values = []) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return { mean: 0, std: 0 };
    }
    const meanValue = finite.reduce((acc, value) => acc + value, 0) / finite.length;
    const variance = finite.reduce((acc, value) => {
        const diff = value - meanValue;
        return acc + (diff * diff);
    }, 0) / Math.max(1, finite.length);
    return {
        mean: meanValue,
        std: Math.sqrt(Math.max(0, variance)),
    };
};
const normalizeSessionSignal = (value, sessionStats = null) => {
    if (!Number.isFinite(value)) {
        return 0.5;
    }
    const meanValue = Number(sessionStats?.mean);
    const stdValue = Number(sessionStats?.std);
    if (!Number.isFinite(meanValue) || !Number.isFinite(stdValue) || stdValue < 1e-6) {
        return 0.5;
    }
    const z = (value - meanValue) / stdValue;
    return clamp01(0.5 + (z / 4));
};

export const resolvePrimaryCandidateScalarScore = (scores = {}) => {
    const objective = Number(scores?.objective);
    if (Number.isFinite(objective)) {
        return clamp01(objective);
    }
    const blended = Number(scores?.blended);
    if (Number.isFinite(blended)) {
        return clamp01(blended);
    }
    const pairwise = Number(scores?.pairwise);
    if (Number.isFinite(pairwise)) {
        return clamp01(pairwise);
    }
    const neural = Number(scores?.neural);
    if (Number.isFinite(neural)) {
        return clamp01(neural);
    }
    const rule = Number(scores?.rule);
    return clamp01(Number.isFinite(rule) ? rule : 0.5);
};

export const buildABCharacteristicSample = (candidate, treeType, context = {}, side = null) => {
    const metric = candidate?.metric;
    if (!metric) {
        return null;
    }

    const crossingRate = metric?.factors?.crossingRate;
    return {
        id: `${Date.now()}_${candidate.seed}_${Math.floor(Math.random() * 1000000)}`,
        treeType,
        seed: candidate.seed,
        side,
        generationMode: context?.mode || AB_GENERATION_MODE,
        generationPreset: context?.presetId || null,
        changedFactors: Array.isArray(context?.changedFactors) ? context.changedFactors.map((item) => item.id) : [],
        createdAt: new Date().toISOString(),
        sizePresence: finiteOrNull(metric?.factors?.scalePresence),
        verticalRatio: finiteOrNull(metric?.factors?.verticalRatio),
        branchCount: finiteOrNull(metric?.structural?.branchCount),
        bloomRatio: finiteOrNull(metric?.factors?.bloomRatio),
        crossingCleanliness: Number.isFinite(crossingRate) ? clamp01(1 - crossingRate) : null,
        foliageDensity: finiteOrNull(metric?.density?.ratio),
    };
};

const mean = (values) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return 0;
    }
    return finite.reduce((acc, value) => acc + value, 0) / finite.length;
};

const readBackboneSignal = (metric = {}) => {
    const factors = metric?.factors?.backboneMetrics || {};
    const features = metric?.features || {};
    const alignment = finiteOrNull(Number(factors?.alignment ?? features?.backboneHarmony));
    const curveConsistency = finiteOrNull(
        Number(factors?.curveConsistency ?? features?.backboneHarmony),
    );
    const depth1Alignment = finiteOrNull(
        Number(factors?.depth1Alignment ?? features?.backboneHarmony),
    );
    const depth2Alignment = finiteOrNull(
        Number(factors?.depth2Alignment ?? features?.backboneHarmony),
    );
    const angleErrorMeanDeg = finiteOrNull(Number(factors?.angleErrorMeanDeg));
    return {
        alignment,
        curveConsistency,
        depth1Alignment,
        depth2Alignment,
        angleErrorMeanDeg,
    };
};

const featureDistance = (featuresA = {}, featuresB = {}) => {
    if (!featuresA || !featuresB) {
        return 0;
    }
    const mse = TREE_FEATURE_KEYS.reduce((acc, key) => {
        const a = Number(featuresA[key]);
        const b = Number(featuresB[key]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return acc;
        }
        const diff = a - b;
        return acc + (diff * diff);
    }, 0) / Math.max(1, TREE_FEATURE_KEYS.length);
    return Math.sqrt(mse);
};

const structuralVectorDistance = (metricA = null, metricB = null) => {
    const vectorA = metricA?.structuralMorphology?.descriptor?.vector;
    const vectorB = metricB?.structuralMorphology?.descriptor?.vector;
    if (!vectorA || !vectorB) {
        throw new Error('ZEN_AB_STRUCTURAL_MORPHOLOGY_VECTOR_REQUIRED');
    }
    const sharedKeys = Object.keys(vectorA).filter((key) => (
        Number.isFinite(Number(vectorA[key]))
        && Number.isFinite(Number(vectorB[key]))
    ));
    if (!sharedKeys.length) {
        throw new Error('ZEN_AB_STRUCTURAL_MORPHOLOGY_VECTOR_EMPTY');
    }
    const mse = sharedKeys.reduce((sum, key) => {
        const delta = Number(vectorA[key]) - Number(vectorB[key]);
        return sum + (delta * delta);
    }, 0) / sharedKeys.length;
    return Math.sqrt(mse);
};

export const scoreABPairInformativeness = (pair, strategy, options = {}) => {
    const a = pair?.A?.scores || {};
    const b = pair?.B?.scores || {};
    const structuralProfile = (
        pair?.A?.metric?.evaluationProfile
        === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
        && pair?.B?.metric?.evaluationProfile
        === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
    );
    const neuralGap = structuralProfile
        ? 0
        : Math.abs((a.neural ?? 0.5) - (b.neural ?? 0.5));
    const pairwiseGap = Math.abs((a.pairwise ?? 0.5) - (b.pairwise ?? 0.5));
    const modelGap = structuralProfile
        ? pairwiseGap
        : (neuralGap * 0.54) + (pairwiseGap * 0.46);
    const uncertainty = clamp01(1 - (modelGap / 0.28));
    const disagreement = structuralProfile
        ? 0
        : clamp01(mean([
            Math.abs((a.neural ?? 0) - (a.pairwise ?? 0)),
            Math.abs((b.neural ?? 0) - (b.pairwise ?? 0)),
        ]) / 0.35);
    const neuralPref = Math.sign((a.neural ?? 0) - (b.neural ?? 0));
    const pairwisePref = Math.sign((a.pairwise ?? 0) - (b.pairwise ?? 0));
    const orderConflict = !structuralProfile
        && neuralPref !== 0
        && pairwisePref !== 0
        && neuralPref !== pairwisePref
        ? 1
        : 0;
    const alignment = clamp01(1 - disagreement);
    const directionAgreement = orderConflict ? 0 : 1;
    const calibrationPenalty = clamp01((disagreement * 0.72) + (orderConflict ? 0.28 : 0));
    const rawStructuralDistance = structuralProfile
        ? structuralVectorDistance(pair?.A?.metric, pair?.B?.metric)
        : null;
    const noveltySpan = structuralProfile
        ? clamp01(rawStructuralDistance / 0.32)
        : clamp01(Math.abs((a.novelty ?? 0) - (b.novelty ?? 0)) / 0.4);
    const scalarGapRaw = Math.abs(
        resolvePrimaryCandidateScalarScore(a) - resolvePrimaryCandidateScalarScore(b),
    );
    const scalarSessionStats = options?.sessionScalarStats
        || meanStd([
            Number(options?.sessionScalarGapA),
            Number(options?.sessionScalarGapB),
        ]);
    const scalarAux = normalizeSessionSignal(scalarGapRaw, scalarSessionStats);
    const morphologySpan = clamp01(
        structuralProfile
            ? rawStructuralDistance / 0.32
            : featureDistance(pair?.A?.metric?.features, pair?.B?.metric?.features) / 0.35,
    );
    const backboneA = readBackboneSignal(pair?.A?.metric);
    const backboneB = readBackboneSignal(pair?.B?.metric);
    const backboneDepthDelta = clamp01(mean([
        Math.abs((backboneA.depth1Alignment ?? 0.5) - (backboneB.depth1Alignment ?? 0.5)),
        Math.abs((backboneA.depth2Alignment ?? 0.5) - (backboneB.depth2Alignment ?? 0.5)),
    ]) / 0.32);
    const backboneGlobalDelta = clamp01(mean([
        Math.abs((backboneA.alignment ?? 0.5) - (backboneB.alignment ?? 0.5)),
        Math.abs((backboneA.curveConsistency ?? 0.5) - (backboneB.curveConsistency ?? 0.5)),
    ]) / 0.35);
    const backboneErrorDelta = clamp01(
        Math.abs((backboneA.angleErrorMeanDeg ?? 0) - (backboneB.angleErrorMeanDeg ?? 0)) / 24,
    );
    const hasBackboneSignal = (
        Number.isFinite(backboneA.alignment)
        || Number.isFinite(backboneA.depth1Alignment)
        || Number.isFinite(backboneB.alignment)
        || Number.isFinite(backboneB.depth1Alignment)
    );
    const backboneSpan = hasBackboneSignal
        ? clamp01(
            (backboneDepthDelta * 0.62)
            + (backboneGlobalDelta * 0.3)
            + (backboneErrorDelta * 0.08),
        )
        : 0;
    const strategyBias = strategy === AB_EXPLORATION_STRATEGY.DISCOVER ? 0.06 : 0;
    const infoScore = structuralProfile
        ? clamp01(
            (uncertainty * 0.3)
            + (morphologySpan * 0.38)
            + (scalarAux * 0.18)
            + strategyBias
        )
        : clamp01(
            uncertainty * 0.32
            + alignment * 0.2
            + directionAgreement * 0.12
            + noveltySpan * 0.04
            + morphologySpan * 0.12
            + scalarAux * 0.08
            + backboneSpan * 0.12
            + strategyBias
            - calibrationPenalty * 0.11
        );

    return {
        infoScore: round(infoScore, 4),
        uncertainty: round(uncertainty, 4),
        disagreement: round(disagreement, 4),
        orderConflict,
        alignment: round(alignment, 4),
        directionAgreement: round(directionAgreement, 4),
        calibrationPenalty: round(calibrationPenalty, 4),
        noveltySpan: round(noveltySpan, 4),
        morphologySpan: round(morphologySpan, 4),
        backboneSpan: round(backboneSpan, 4),
        backboneDepthDelta: round(backboneDepthDelta, 4),
        backboneGlobalDelta: round(backboneGlobalDelta, 4),
        backboneErrorDelta: round(backboneErrorDelta, 4),
        neuralGap: round(neuralGap, 4),
        pairwiseGap: round(pairwiseGap, 4),
        scalarGapRaw: round(scalarGapRaw, 4),
        scalarAux: round(scalarAux, 4),
        evaluationProfile: structuralProfile
            ? BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
            : BONSAI_CANDIDATE_EVALUATION_PROFILE.FULL,
    };
};

export const resolvePhenotypeProfile = (_phenotypeOrEnabled) => 'base';
