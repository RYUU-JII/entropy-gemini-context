import {
    SAKURA_PREFERENCE_BASIN_MODEL_VERSION,
    SAKURA_PREFERENCE_BASIN_VALUE_SPACE,
} from './SakuraPreferenceBasinContract';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const DEFAULT_SAKURA_RELIABILITY_THRESHOLDS = Object.freeze({
    minBasinEvidenceProgress: 0.72,
    minEstablishedFactorRatio: 0.6,
    minResolvedFactorRatio: 0.6,
    minStableFactorRatio: 0.12,
    minPredictiveSamples: 40,
    minPredictiveLabelBalance: 0.35,
    minAuc: 0.62,
    maxEce: 0.14,
    minTieCalibrationSamples: 4,
    maxTieCalibrationError: 0.16,
    minPairwiseSteps: 72,
    minPairwiseReliability: 0.58,
    minNeuralStepsDiagnostic: 24,
    minNeuralReliabilityDiagnostic: 0.45,
});

export const evaluateSakuraReliabilityPolicy = ({
    metrics = {},
    thresholds = DEFAULT_SAKURA_RELIABILITY_THRESHOLDS,
} = {}) => {
    const resolvedThresholds = {
        ...DEFAULT_SAKURA_RELIABILITY_THRESHOLDS,
        ...(thresholds || {}),
    };
    const factorCoverage = metrics?.factorCoverage || {};
    const basin = metrics?.preferenceBasin || {};
    const basinEvidenceProgress = clamp01(Number(basin?.evidenceProgress || 0));
    const establishedFactorRatio = clamp01(Number(basin?.establishedFactorRatio || 0));
    const resolvedFactorRatio = clamp01(Number(basin?.resolvedFactorRatio || 0));
    const stableFactorRatio = clamp01(Number(basin?.stableFactorRatio || 0));
    const basinContractSatisfied = (
        basin?.modelVersion === SAKURA_PREFERENCE_BASIN_MODEL_VERSION
        && typeof basin?.learningKeyspaceProfile === 'string'
        && basin.learningKeyspaceProfile.length > 0
        && basin?.valueSpace === SAKURA_PREFERENCE_BASIN_VALUE_SPACE
    );
    const basinEvidenceSatisfied = (
        Number(basin?.factorCount || 0) > 0
        && basinEvidenceProgress >= resolvedThresholds.minBasinEvidenceProgress
    );
    const basinEstablishedSatisfied = (
        establishedFactorRatio >= resolvedThresholds.minEstablishedFactorRatio
    );
    const basinResolvedSatisfied = resolvedFactorRatio >= resolvedThresholds.minResolvedFactorRatio;
    const basinStableSatisfied = stableFactorRatio >= resolvedThresholds.minStableFactorRatio;
    const basinSatisfied = (
        basinContractSatisfied
        && basinEvidenceSatisfied
        && basinResolvedSatisfied
        && basinStableSatisfied
    );

    const predictiveAuc = Number(metrics?.predictiveAuc);
    const predictiveEce = Number(metrics?.predictiveEce);
    const predictiveAccuracy = Number(metrics?.predictiveAccuracy);
    const predictiveSamples = Array.isArray(metrics?.predictiveSamples)
        ? metrics.predictiveSamples
        : [];
    const tieCalibrationSamples = Array.isArray(metrics?.tieCalibrationSamples)
        ? metrics.tieCalibrationSamples
        : [];
    const tieCalibrationResponseCount = Math.max(
        0,
        Number(metrics?.tieCalibrationResponseCount || 0),
    );
    const tieCalibrationError = Number(metrics?.tieCalibrationError);
    const predictiveLabelBalance = clamp01(Number(metrics?.predictiveLabelBalance || 0));
    const sampleCountSatisfied = predictiveSamples.length >= resolvedThresholds.minPredictiveSamples;
    const labelBalanceSatisfied = (
        predictiveLabelBalance >= resolvedThresholds.minPredictiveLabelBalance
    );
    const aucSatisfied = Number.isFinite(predictiveAuc) && predictiveAuc >= resolvedThresholds.minAuc;
    const eceSatisfied = Number.isFinite(predictiveEce) && predictiveEce <= resolvedThresholds.maxEce;
    const tieCalibrationApplicable = (
        tieCalibrationResponseCount >= resolvedThresholds.minTieCalibrationSamples
    );
    const tieCalibrationSampleCountSatisfied = (
        tieCalibrationSamples.length >= resolvedThresholds.minTieCalibrationSamples
    );
    const tieCalibrationSatisfied = (
        !tieCalibrationApplicable
        || (
            tieCalibrationSampleCountSatisfied
            && Number.isFinite(tieCalibrationError)
            && tieCalibrationError <= resolvedThresholds.maxTieCalibrationError
        )
    );
    const predictiveReliabilitySatisfied = (
        sampleCountSatisfied
        && labelBalanceSatisfied
        && eceSatisfied
        && tieCalibrationSatisfied
    );
    // Acquisition deliberately seeks uncertain boundary pairs. Their online
    // AUC can remain near 0.5 even when the posterior and calibration improve,
    // so AUC is diagnostic until an acquisition-independent audit stream owns
    // it. It must not become another asymptotic unlock gate.

    const neuralSteps = Number(metrics?.neuralSteps || 0);
    const pairwiseSteps = Number(metrics?.pairwiseSteps || 0);
    const neuralReliability = Number(metrics?.neuralReliability || 0);
    const pairwiseReliability = Number(metrics?.pairwiseReliability || 0);
    const pairwiseModelSatisfied = (
        pairwiseSteps >= resolvedThresholds.minPairwiseSteps
        && pairwiseReliability >= resolvedThresholds.minPairwiseReliability
    );
    const neuralDiagnosticSatisfied = (
        neuralSteps >= resolvedThresholds.minNeuralStepsDiagnostic
        && neuralReliability >= resolvedThresholds.minNeuralReliabilityDiagnostic
    );
    // The neural model is a secondary diagnostic/ranking signal. Optimization
    // admission is owned by controlled basin evidence and controlled,
    // pre-feedback pairwise validation rather than global GP update volume.
    const modelReliabilitySatisfied = pairwiseModelSatisfied;
    const reliabilitySatisfied = basinSatisfied && predictiveReliabilitySatisfied;
    const canOptimize = reliabilitySatisfied && modelReliabilitySatisfied;

    const basinEvidenceGateProgress = clamp01(
        basinEvidenceProgress / Math.max(1e-6, resolvedThresholds.minBasinEvidenceProgress),
    );
    const basinStableProgress = clamp01(
        stableFactorRatio / Math.max(1e-6, resolvedThresholds.minStableFactorRatio),
    );
    const basinResolvedProgress = clamp01(
        resolvedFactorRatio / Math.max(1e-6, resolvedThresholds.minResolvedFactorRatio),
    );
    const sampleProgress = clamp01(
        predictiveSamples.length / Math.max(1, resolvedThresholds.minPredictiveSamples),
    );
    const labelBalanceProgress = clamp01(
        predictiveLabelBalance / Math.max(1e-6, resolvedThresholds.minPredictiveLabelBalance),
    );
    const eceProgress = Number.isFinite(predictiveEce)
        ? (predictiveEce <= resolvedThresholds.maxEce
            ? 1
            : clamp(resolvedThresholds.maxEce / Math.max(1e-6, predictiveEce), 0, 1))
        : 0;
    const tieCalibrationSampleProgress = tieCalibrationApplicable
        ? clamp01(
            tieCalibrationSamples.length
            / Math.max(1, resolvedThresholds.minTieCalibrationSamples),
        )
        : 1;
    const tieCalibrationErrorProgress = tieCalibrationApplicable
        ? (Number.isFinite(tieCalibrationError)
            ? (tieCalibrationError <= resolvedThresholds.maxTieCalibrationError
                ? 1
                : clamp(
                    resolvedThresholds.maxTieCalibrationError
                    / Math.max(1e-6, tieCalibrationError),
                    0,
                    1,
                ))
            : 0)
        : 1;
    const tieCalibrationProgress = Math.min(
        tieCalibrationSampleProgress,
        tieCalibrationErrorProgress,
    );
    const pairwiseStepProgress = clamp01(
        pairwiseSteps / Math.max(1, resolvedThresholds.minPairwiseSteps),
    );
    const pairwiseReliabilityProgress = clamp01(
        pairwiseReliability / Math.max(1e-6, resolvedThresholds.minPairwiseReliability),
    );
    const pairwiseModelProgress = Math.min(
        pairwiseStepProgress,
        pairwiseReliabilityProgress,
    );
    const rawRequirements = [
        {
            id: 'basin_contract',
            label: 'Basin contract',
            progress: basinContractSatisfied ? 1 : 0,
            satisfied: basinContractSatisfied,
            current: basinContractSatisfied ? 1 : 0,
            target: 1,
            comparison: 'contract',
        },
        {
            id: 'basin_evidence',
            label: 'Basin evidence',
            progress: basinEvidenceGateProgress,
            satisfied: basinEvidenceSatisfied,
            current: basinEvidenceProgress,
            target: resolvedThresholds.minBasinEvidenceProgress,
            comparison: 'min_ratio',
        },
        {
            id: 'basin_resolved',
            label: 'Resolved factors',
            progress: basinResolvedProgress,
            satisfied: basinResolvedSatisfied,
            current: resolvedFactorRatio,
            target: resolvedThresholds.minResolvedFactorRatio,
            comparison: 'min_ratio',
        },
        {
            id: 'basin_stable',
            label: 'Stable factors',
            progress: basinStableProgress,
            satisfied: basinStableSatisfied,
            current: stableFactorRatio,
            target: resolvedThresholds.minStableFactorRatio,
            comparison: 'min_ratio',
        },
        {
            id: 'predictive_samples',
            label: 'Predictive samples',
            progress: sampleProgress,
            satisfied: sampleCountSatisfied,
            current: predictiveSamples.length,
            target: resolvedThresholds.minPredictiveSamples,
            comparison: 'min_count',
        },
        {
            id: 'predictive_label_balance',
            label: 'Label balance',
            progress: labelBalanceProgress,
            satisfied: labelBalanceSatisfied,
            current: predictiveLabelBalance,
            target: resolvedThresholds.minPredictiveLabelBalance,
            comparison: 'min_ratio',
        },
        {
            id: 'predictive_calibration',
            label: 'Predictive ECE',
            progress: eceProgress,
            satisfied: eceSatisfied,
            current: Number.isFinite(predictiveEce) ? predictiveEce : null,
            target: resolvedThresholds.maxEce,
            comparison: 'max_error',
        },
        {
            id: 'tie_calibration',
            label: 'BOTH_GOOD calibration',
            progress: tieCalibrationProgress,
            satisfied: tieCalibrationSatisfied,
            current: tieCalibrationApplicable && Number.isFinite(tieCalibrationError)
                ? tieCalibrationError
                : null,
            target: resolvedThresholds.maxTieCalibrationError,
            comparison: 'max_error',
            applicable: tieCalibrationApplicable,
        },
        {
            id: 'pairwise_model',
            label: 'Controlled pairwise model',
            progress: pairwiseModelProgress,
            satisfied: pairwiseModelSatisfied,
            current: pairwiseModelProgress,
            target: 1,
            comparison: 'progress',
            details: {
                steps: {
                    current: pairwiseSteps,
                    target: resolvedThresholds.minPairwiseSteps,
                    progress: pairwiseStepProgress,
                },
                reliability: {
                    current: pairwiseReliability,
                    target: resolvedThresholds.minPairwiseReliability,
                    progress: pairwiseReliabilityProgress,
                },
            },
        },
    ];
    const minimumRequirementProgress = Math.min(
        ...rawRequirements.map((requirement) => clamp01(requirement.progress)),
    );
    const bottleneckIds = rawRequirements
        .filter((requirement) => clamp01(requirement.progress) === minimumRequirementProgress)
        .map((requirement) => requirement.id);
    const requirements = rawRequirements.map((requirement) => ({
        ...requirement,
        progress: Number(clamp01(requirement.progress).toFixed(3)),
        progressPercent: Math.round(clamp01(requirement.progress) * 100),
        current: Number.isFinite(requirement.current)
            ? Number(requirement.current.toFixed(3))
            : null,
        target: Number.isFinite(requirement.target)
            ? Number(requirement.target.toFixed(3))
            : null,
    }));
    const bottleneckRequirements = requirements.filter((requirement) => (
        bottleneckIds.includes(requirement.id)
    ));

    // Readiness is a bottleneck contract, not an average score. An average can
    // sit near 75% while one indispensable signal is still missing and gives
    // the false impression that more identical rounds will eventually unlock it.
    let progress = minimumRequirementProgress;
    if (canOptimize) {
        progress = 1;
    }
    const progressPercent = Math.round(progress * 100);

    return {
        canOptimize,
        reliabilitySatisfied,
        predictiveReliabilitySatisfied,
        modelReliabilitySatisfied,
        pairwiseModelSatisfied,
        neuralDiagnosticSatisfied,
        progress: Number(progress.toFixed(3)),
        progressPercent,
        requirements,
        bottleneck: canOptimize ? null : bottleneckRequirements[0] || null,
        bottleneckIds: canOptimize ? [] : bottleneckIds,
        neuralReliability: Number(neuralReliability.toFixed(3)),
        pairwiseReliability: Number(pairwiseReliability.toFixed(3)),
        predictive: {
            samples: predictiveSamples.length,
            positiveSamples: Number(metrics?.positivePredictiveSamples || 0),
            negativeSamples: Number(metrics?.negativePredictiveSamples || 0),
            labelBalance: Number(predictiveLabelBalance.toFixed(3)),
            auc: Number.isFinite(predictiveAuc) ? Number(predictiveAuc.toFixed(3)) : null,
            ece: Number.isFinite(predictiveEce) ? Number(predictiveEce.toFixed(3)) : null,
            accuracy: Number.isFinite(predictiveAccuracy) ? Number(predictiveAccuracy.toFixed(3)) : null,
            sampleCountSatisfied,
            labelBalanceSatisfied,
            aucSatisfied,
            eceSatisfied,
            windowCount: Number(metrics?.predictiveWindow?.count || 0),
            windowDecisiveCount: Number(metrics?.predictiveWindow?.decisiveCount || 0),
            windowAbstainCount: Number(metrics?.predictiveWindow?.abstainCount || 0),
            tieResponses: tieCalibrationResponseCount,
            tieSamples: tieCalibrationSamples.length,
            tieCalibrationError: Number.isFinite(tieCalibrationError)
                ? Number(tieCalibrationError.toFixed(3))
                : null,
            tieCalibrationApplicable,
            tieCalibrationSampleCountSatisfied,
            tieCalibrationSatisfied,
        },
        basin: {
            modelVersion: Number(basin?.modelVersion || 0),
            learningKeyspaceProfile: basin?.learningKeyspaceProfile || null,
            valueSpace: basin?.valueSpace || null,
            factorCount: Number(basin?.factorCount || 0),
            evidenceCount: Number(basin?.evidenceCount || 0),
            evidenceProgress: Number(basinEvidenceProgress.toFixed(3)),
            establishedFactorRatio: Number(establishedFactorRatio.toFixed(3)),
            resolvedFactorRatio: Number(resolvedFactorRatio.toFixed(3)),
            stableFactorRatio: Number(stableFactorRatio.toFixed(3)),
            indifferentFactorRatio: Number(Number(basin?.indifferentFactorRatio || 0).toFixed(3)),
            coveredFactorCount: Number(basin?.coveredFactorCount || 0),
            stableFactorCount: Number(basin?.stableFactorCount || 0),
            indifferentFactorCount: Number(basin?.indifferentFactorCount || 0),
            resolvedFactorCount: Number(basin?.resolvedFactorCount || 0),
            projectedLegacyEntryCount: Number(basin?.projectedLegacyEntryCount || 0),
            evidenceSatisfied: basinEvidenceSatisfied,
            contractSatisfied: basinContractSatisfied,
            establishedSatisfied: basinEstablishedSatisfied,
            resolvedSatisfied: basinResolvedSatisfied,
            stableSatisfied: basinStableSatisfied,
            satisfied: basinSatisfied,
            factors: Array.isArray(basin?.factors) ? basin.factors : [],
        },
        coverage: {
            totalFactors: Number(factorCoverage?.totalFactors || 0),
            minCoverage: Number(factorCoverage?.minCoverage || 0),
            averageCoverage: Number(Number(factorCoverage?.averageCoverage || 0).toFixed(2)),
            eligiblePairs: Number(factorCoverage?.eligiblePairCount || 0),
            rejectedPairs: Number(factorCoverage?.rejectedPairCount || 0),
            counts: factorCoverage?.counts || {},
            satisfied: basinEvidenceSatisfied,
        },
        thresholds: {
            ...resolvedThresholds,
        },
    };
};
