import {
    Phenotype_FACTOR_DEFS,
    LEARNING_Phenotype_FACTOR_KEYS,
    getBuiltInDefaultPhenotype,
} from './BonsaiGenetics';
import { TREE_FEATURE_KEYS } from './TreeAnalyzer';
import { deriveMapElitesDescriptor, descriptorToCell } from './MapElitesArchive';
import { buildFactorRedundancyDiagnostics } from './FactorRedundancyDiagnostics';
import {
    SAKURA_V2_REPORT_RECENT_LIMIT,
    SAKURA_V2_DEEP_HISTORY_LIMIT,
    SAKURA_V2_LOOP_WINDOW_SIZE,
    SAKURA_V2_CALIBRATION_WINDOW_SIZE,
} from './ZenLearningConstants';
import {
    clamp01,
    clamp,
    round,
    toDisplayLabel,
    mean,
    stdDev,
    quantile,
    pearsonCorrelation,
    formatPercent,
} from './ZenReportMath';
import {
    SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY,
} from './sakura/sakuraMacroSpineGuide';

const normalizeRedundancyTuning = (value = {}) => ({
    similarityThreshold: clamp(Number(value?.similarityThreshold ?? 0.9), 0.75, 0.97),
    blockThreshold: clamp(Number(value?.blockThreshold ?? 0.82), 0.6, 0.95),
    penaltyScale: clamp(Number(value?.penaltyScale ?? 0.22), 0.05, 0.4),
});
const formatGateRequirementValue = (requirement = {}) => {
    const current = requirement?.current === null || requirement?.current === undefined
        ? Number.NaN
        : Number(requirement.current);
    const target = requirement?.target === null || requirement?.target === undefined
        ? Number.NaN
        : Number(requirement.target);
    if (requirement?.comparison === 'min_count') {
        return `${Math.max(0, Math.floor(current || 0))}/${Math.max(0, Math.floor(target || 0))}`;
    }
    if (requirement?.comparison === 'min_ratio') {
        return `${Math.round((current || 0) * 100)}%/${Math.round((target || 0) * 100)}%`;
    }
    if (requirement?.comparison === 'max_error') {
        return Number.isFinite(current)
            ? `${current.toFixed(3)}/<=${Number.isFinite(target) ? target.toFixed(3) : '-'}`
            : `N/A/<=${Number.isFinite(target) ? target.toFixed(3) : '-'}`;
    }
    return `${Math.round(Number(requirement?.progressPercent || 0))}%`;
};
const formatGateRequirementLine = (requirement = {}) => (
    `${requirement?.label || requirement?.id || 'Unknown'}: ${formatGateRequirementValue(requirement)} (${Math.round(Number(requirement?.progressPercent || 0))}% progress)`
);
const resolvePickedToken = (entry = {}) => String(entry?.picked || '').toUpperCase();
const isPassPicked = (entry = {}) => resolvePickedToken(entry) === 'PASS';
const isBothGoodPicked = (entry = {}) => resolvePickedToken(entry) === 'BOTH_GOOD';
const isNeutralPicked = (entry = {}) => isPassPicked(entry) || isBothGoodPicked(entry);
const resolvePreferredLabel = (entry = {}) => {
    const picked = resolvePickedToken(entry);
    if (picked === 'A' || picked === 'B') {
        return picked;
    }
    if (picked === 'WORSE_A') {
        return 'B';
    }
    if (picked === 'WORSE_B') {
        return 'A';
    }
    return null;
};
const resolvePairwiseProbabilityA = (entry = {}, scoreField = 'pairwiseScore') => {
    const scoreA = Number(entry?.A?.[scoreField] ?? Number.NaN);
    const scoreB = Number(entry?.B?.[scoreField] ?? Number.NaN);
    if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
        return clamp01(0.5 + ((scoreA - scoreB) * 0.5));
    }
    return null;
};
const resolvePreferredProbability = (entry = {}, options = {}) => {
    const preferRaw = options?.preferRaw === true;
    const preferredLabel = resolvePreferredLabel(entry);
    if (!preferredLabel) {
        return null;
    }

    let probabilityA = null;
    if (preferRaw) {
        probabilityA = resolvePairwiseProbabilityA(entry, 'pairwiseRawScore');
        if (!Number.isFinite(probabilityA)) {
            probabilityA = resolvePairwiseProbabilityA(entry, 'pairwiseScore');
        }
    } else {
        probabilityA = resolvePairwiseProbabilityA(entry, 'pairwiseCalibratedScore');
        if (!Number.isFinite(probabilityA)) {
            probabilityA = resolvePairwiseProbabilityA(entry, 'pairwiseScore');
        }
    }

    if (!Number.isFinite(probabilityA)) {
        const scoreDeltaKey = preferRaw ? 'pairwiseRaw' : 'pairwiseCalibrated';
        const scoreDelta = Number(entry?.scoreDelta?.[scoreDeltaKey] ?? entry?.scoreDelta?.pairwise);
        if (!Number.isFinite(scoreDelta)) {
            return null;
        }
        const signedDelta = preferredLabel === 'A' ? scoreDelta : -scoreDelta;
        probabilityA = clamp01(0.5 + (signedDelta * 0.5));
    }

    return preferredLabel === 'A'
        ? clamp01(probabilityA)
        : clamp01(1 - probabilityA);
};
const computePairwiseCalibrationError = (entries = [], options = {}) => {
    const probabilities = (Array.isArray(entries) ? entries : [])
        .map((entry) => resolvePreferredProbability(entry, options))
        .filter((value) => Number.isFinite(value));
    if (!probabilities.length) {
        return {
            error: null,
            samples: 0,
        };
    }
    return {
        error: mean(probabilities.map((value) => Math.abs(1 - value))),
        samples: probabilities.length,
    };
};

export const buildLearningReport = ({
    abHistory = [],
    abRoundCount = 0,
    trainingCount = 0,
    pairwiseTrainingCount = 0,
    sessionCalibration = null,
    latestOptimization = null,
    sakuraV2Gate = null,
    redundancyTuning = null,
} = {}) => {
    const recent = (Array.isArray(abHistory) ? abHistory : []).slice(0, SAKURA_V2_REPORT_RECENT_LIMIT);
    const compared = recent.filter((entry) => !isNeutralPicked(entry));
    const passCount = recent.filter((entry) => isPassPicked(entry)).length;
    const bothGoodCount = recent.filter((entry) => isBothGoodPicked(entry)).length;
    const passRate = recent.length > 0 ? passCount / recent.length : 0;
    const bothGoodRate = recent.length > 0 ? bothGoodCount / recent.length : 0;
    const weakGapCount = compared.filter((entry) => (
        Math.abs(Number(entry?.scoreDelta?.blended || 0)) < 0.03
    )).length;
    const weakGapRate = compared.length > 0 ? weakGapCount / compared.length : 0;
    const avgInfoScore = compared.length > 0
        ? compared.reduce((acc, entry) => acc + Number(entry?.query?.infoScore || 0), 0) / compared.length
        : 0;
    const drift = Number.isFinite(sessionCalibration?.drift)
        ? Math.max(0, Math.min(1, Number(sessionCalibration.drift)))
        : weakGapRate;
    const latestGain = Number.isFinite(Number(latestOptimization?.optimizeGain))
        ? Number(latestOptimization?.optimizeGain)
        : null;
    const reliabilitySatisfied = Boolean(sakuraV2Gate?.reliabilitySatisfied);
    const optimizeReady = Boolean(sakuraV2Gate?.canOptimize);
    const gateProgressPercent = Number.isFinite(sakuraV2Gate?.progressPercent)
        ? sakuraV2Gate.progressPercent
        : 0;
    const gateBasin = sakuraV2Gate?.basin || {};
    const gatePredictive = sakuraV2Gate?.predictive || {};
    const gateRequirements = Array.isArray(sakuraV2Gate?.requirements)
        ? sakuraV2Gate.requirements
        : [];
    const gateBottleneck = sakuraV2Gate?.bottleneck || null;
    const controlledPairwiseRequirement = gateRequirements.find(
        (requirement) => requirement?.id === 'pairwise_model',
    ) || null;
    const controlledPairwiseSteps = Number(
        controlledPairwiseRequirement?.details?.steps?.current || 0,
    );
    const controlledPairwiseStepTarget = Number(
        controlledPairwiseRequirement?.details?.steps?.target || 0,
    );
    const normalizedRedundancyTuning = normalizeRedundancyTuning(redundancyTuning || {});
    const redundancyDiagnostics = buildFactorRedundancyDiagnostics({
        abHistory: recent,
        minSamplesPerFactor: 6,
        minActiveBins: 3,
        similarityThreshold: normalizedRedundancyTuning.similarityThreshold,
        minEffectMagnitude: 0.08,
        binCount: 5,
    });
    const redundancyPairs = redundancyDiagnostics?.redundantPairs || [];
    const topRedundantPair = redundancyPairs[0] || null;
    const qualityWarnings = [];
    const alerts = [];
    const actions = [];

    if (!optimizeReady) {
        alerts.push(`Reliability gate is locked (${gateProgressPercent}% complete).`);
        actions.push('Run more A/B rounds before optimizing.');
        if (!gateBasin?.evidenceSatisfied) {
            actions.push(
                `Collect clearer controlled evidence for the preference basin (${Math.round(Number(gateBasin?.evidenceProgress || 0) * 100)}% / ${Math.round(Number(sakuraV2Gate?.thresholds?.minBasinEvidenceProgress || 0) * 100)}%).`,
            );
        }
        if (!gateBasin?.stableSatisfied) {
            actions.push(
                `Confirm several stable style regions (${Math.round(Number(gateBasin?.stableFactorRatio || 0) * 100)}% / ${Math.round(Number(sakuraV2Gate?.thresholds?.minStableFactorRatio || 0) * 100)}%).`,
            );
        }
        if (!gateBasin?.resolvedSatisfied) {
            actions.push(
                `Resolve remaining factors as either preferred regions or repeated broad-gap indifference (${Math.round(Number(gateBasin?.resolvedFactorRatio || 0) * 100)}% / ${Math.round(Number(sakuraV2Gate?.thresholds?.minResolvedFactorRatio || 0) * 100)}%).`,
            );
        }
        if (!gatePredictive?.sampleCountSatisfied || !gatePredictive?.labelBalanceSatisfied) {
            actions.push('Keep A/B labels balanced and collect enough pre-feedback pairwise predictions.');
        }
        if (!gatePredictive?.aucSatisfied) {
            qualityWarnings.push(
                `Active-query AUC is low (${gatePredictive?.auc ?? '-'}); this is diagnostic because acquisition intentionally samples uncertain boundaries.`,
            );
        }
        if (!gatePredictive?.eceSatisfied) {
            actions.push(
                `Lower calibration error (ECE ${gatePredictive?.ece ?? '-'} / target ${sakuraV2Gate?.thresholds?.maxEce ?? 0.1}).`,
            );
        }
        if (
            gatePredictive?.tieCalibrationApplicable
            && !gatePredictive?.tieCalibrationSatisfied
        ) {
            actions.push(
                `Repair BOTH_GOOD tie calibration (error ${gatePredictive?.tieCalibrationError ?? '-'} / target ${sakuraV2Gate?.thresholds?.maxTieCalibrationError ?? 0.16}).`,
            );
        }
    }
    if (optimizeReady && !reliabilitySatisfied) {
        alerts.push('Soft unlock is active; continue calibration to reach full reliability.');
        actions.push('Continue low-ambiguity isolation rounds to improve AUC/ECE before long optimize runs.');
    }
    if (weakGapRate >= 0.55) {
        alerts.push('Preference signal is noisy (many low-contrast choices).');
        actions.push('Use PASS aggressively for weak pairs; select only clear winners.');
    }
    if (passRate <= 0.01 && compared.length >= 20) {
        alerts.push('PASS usage is near zero, which can overfit weak preferences.');
        actions.push('Skip ambiguous comparisons instead of turning weak guesses into preference labels.');
    }
    if (bothGoodRate >= 0.3 && recent.length >= 12) {
        alerts.push('BOTH_GOOD usage is high, indicating low-separability queries.');
        actions.push('Increase A/B delta so comparisons produce stronger directional preference.');
    }
    if (latestGain !== null && latestGain <= 0) {
        alerts.push('Last optimize step did not improve objective direction.');
        actions.push('Collect new rounds first, then re-run optimize once signal stabilizes.');
    }
    if (redundancyPairs.length > 0) {
        alerts.push(`Potential redundant factor axes detected (${redundancyPairs.length}).`);
        actions.push('Run isolation rounds on non-overlapping axes and reduce duplicate factor emphasis.');
        if (topRedundantPair?.aLabel && topRedundantPair?.bLabel) {
            qualityWarnings.push(
                `질문 품질 경고: ${topRedundantPair.aLabel} <-> ${topRedundantPair.bLabel} 축이 중복되어 비중복 축 우선 질문으로 전환합니다.`,
            );
        }
    }
    if (!actions.length) {
        actions.push('Current signal is coherent. Optimize and save the result as Main.');
    }

    const diagnosis = alerts.length
        ? alerts.join(' ')
        : 'Learning signal is stable and optimization direction looks aligned.';
    const reportLines = [
        'Sakura V2 Learning Report',
        `Rounds: ${abRoundCount}`,
        `Global model updates N/P: ${trainingCount}/${pairwiseTrainingCount}`,
        `Controlled pairwise gate samples: ${controlledPairwiseSteps}/${controlledPairwiseStepTarget}`,
        `Optimize readiness: ${gateProgressPercent}%`,
        `Gate bottleneck: ${gateBottleneck ? formatGateRequirementLine(gateBottleneck) : 'None'}`,
        ...gateRequirements.map((requirement) => `Gate requirement - ${formatGateRequirementLine(requirement)}`),
        `Model gate reliability N/P: ${formatPercent(sakuraV2Gate?.neuralReliability || 0, 1)} / ${formatPercent(sakuraV2Gate?.pairwiseReliability || 0, 1)}`,
        `Canonical predictive ECE: ${gatePredictive?.ece ?? 'N/A'} (target <= ${sakuraV2Gate?.thresholds?.maxEce ?? 'N/A'})`,
        `PASS rate (recent): ${formatPercent(passRate, 1)}`,
        `BOTH_GOOD rate (recent): ${formatPercent(bothGoodRate, 1)}`,
        `BOTH_GOOD calibration: ${gatePredictive?.tieCalibrationError ?? 'N/A'} (${Number(gatePredictive?.tieSamples || 0)}/${Number(gatePredictive?.tieResponses || 0)} valid/recent)`,
        `Weak-gap rate (recent): ${formatPercent(weakGapRate, 1)}`,
        `Average info score: ${avgInfoScore.toFixed(3)}`,
        `Anchor drift: ${formatPercent(drift, 1)}`,
        `Redundant pairs: ${redundancyPairs.length}`,
        `Redundancy threshold: sim >= ${normalizedRedundancyTuning.similarityThreshold.toFixed(2)}`,
        `Latest optimize gain: ${latestGain === null ? 'N/A' : formatPercent(latestGain, 1)}`,
        `Diagnosis: ${diagnosis}`,
        'Recommended actions:',
        ...actions.map((action, index) => `${index + 1}. ${action}`),
    ];

    return {
        rounds: abRoundCount,
        passRate,
        bothGoodRate,
        weakGapRate,
        avgInfoScore,
        drift,
        latestGain,
        diagnosis,
        qualityWarnings,
        actions,
        redundancy: {
            pairCount: redundancyPairs.length,
            topPair: topRedundantPair ? {
                aLabel: topRedundantPair.aLabel,
                bLabel: topRedundantPair.bLabel,
                similarity: Number(topRedundantPair.similarity || 0),
                curveCorrelation: Number(topRedundantPair.curveCorrelation || 0),
            } : null,
            thresholds: {
                ...(redundancyDiagnostics?.thresholds || {}),
                blockThreshold: round(normalizedRedundancyTuning.blockThreshold, 3),
                penaltyScale: round(normalizedRedundancyTuning.penaltyScale, 3),
            },
            isolationSamples: Number(redundancyDiagnostics?.totalIsolationSamples || 0),
        },
        text: reportLines.join('\n'),
    };
};

export const buildDeepLearningReportText = ({
    brain = null,
    pairwiseBrain = null,
    abHistory = [],
    treeType = 'sakura',
    optimizationLog = [],
    likedCollection = [],
    pairwiseTrainingCount = 0,
    sakuraV2Gate = null,
    redundancyTuning = null,
    currentPhenotype = {},
    analyzedCandidate = null,
    scoreView = null,
} = {}) => {
    const brainMeta = brain?.getMeta?.() || { trainingSteps: 0, avgAbsError: 0 };
    const pairwiseMeta = pairwiseBrain?.getMeta?.() || { trainingPairs: 0, avgPairLoss: 0 };
    const activePairwiseMode = String(pairwiseMeta?.mode || '').toLowerCase();
    const activePairwiseLabel = activePairwiseMode.includes('additive_gp')
        ? 'Pairwise(GP live)'
        : 'Pairwise(Live)';
    const history = (Array.isArray(abHistory) ? abHistory : [])
        .filter((entry) => !entry?.treeType || entry.treeType === treeType)
        .slice(0, SAKURA_V2_DEEP_HISTORY_LIMIT);
    const totalRounds = history.length;
    const windowSize = Math.min(SAKURA_V2_LOOP_WINDOW_SIZE, totalRounds);
    const recentWindow = history.slice(0, windowSize);
    const passCount = recentWindow.filter((entry) => isPassPicked(entry)).length;
    const bothGoodCount = recentWindow.filter((entry) => isBothGoodPicked(entry)).length;
    const passRate = windowSize > 0 ? passCount / windowSize : 0;
    const bothGoodRate = windowSize > 0 ? bothGoodCount / windowSize : 0;
    const directionalWindow = recentWindow.filter((entry) => !isNeutralPicked(entry));

    let disagreementCount = 0;
    let disagreementSamples = 0;
    directionalWindow.forEach((entry) => {
        const neural = Number(entry?.scoreDelta?.neural);
        const pairwise = Number(entry?.scoreDelta?.pairwise);
        if (!Number.isFinite(neural) || !Number.isFinite(pairwise)) {
            return;
        }
        const neuralSign = Math.sign(neural);
        const pairwiseSign = Math.sign(pairwise);
        if (!neuralSign || !pairwiseSign) {
            return;
        }
        disagreementSamples += 1;
        if (neuralSign !== pairwiseSign) {
            disagreementCount += 1;
        }
    });
    const disagreementRate = disagreementSamples > 0 ? disagreementCount / disagreementSamples : 0;

    const infoSeries = recentWindow
        .map((entry) => Number(entry?.query?.infoScore))
        .filter((value) => Number.isFinite(value));
    const meanInfoScore = infoSeries.length ? mean(infoSeries) : 0;
    const uncertaintySeriesNewestFirst = infoSeries.map((value) => clamp01(1 - value));
    const uncertaintySeriesChronological = [...uncertaintySeriesNewestFirst].reverse();
    const earlyUncertainty = uncertaintySeriesChronological.length
        ? mean(uncertaintySeriesChronological.slice(0, Math.min(10, uncertaintySeriesChronological.length)))
        : null;
    const recentUncertainty = uncertaintySeriesChronological.length
        ? mean(uncertaintySeriesChronological.slice(-Math.min(10, uncertaintySeriesChronological.length)))
        : null;
    const uncertaintyDelta = (
        Number.isFinite(earlyUncertainty)
        && Number.isFinite(recentUncertainty)
    )
        ? (recentUncertainty - earlyUncertainty)
        : null;
    const uncertaintyDeadband = 0.03;
    const uncertaintyTrend = uncertaintyDelta === null
        ? 'flat'
        : uncertaintyDelta <= -uncertaintyDeadband
            ? 'improving'
            : uncertaintyDelta >= uncertaintyDeadband
                ? 'worsening'
                : 'flat';
    const normalizedRedundancyTuning = normalizeRedundancyTuning(redundancyTuning || {});

    const optimizeEntries = (Array.isArray(optimizationLog) ? optimizationLog : [])
        .filter((entry) => entry?.treeType === treeType);
    const latestOptimize = optimizeEntries[0] || null;
    const optimizeAttempts = optimizeEntries.length;
    const bestScore = Number(latestOptimize?.bestScore);
    const preOptimizeScore = Number(latestOptimize?.preOptimizeScore);
    const optimizeGain = (
        Number.isFinite(bestScore)
        && Number.isFinite(preOptimizeScore)
    )
        ? (bestScore - preOptimizeScore)
        : null;
    const roundsAtOptimize = Number(latestOptimize?.abRoundCountAtOptimize);
    const roundsSinceOptimize = Number.isFinite(roundsAtOptimize)
        ? Math.max(0, totalRounds - roundsAtOptimize)
        : null;

    const correlationSamples = (Array.isArray(likedCollection) ? likedCollection : [])
        .filter((entry) => entry?.type === treeType && entry?.features && entry?.scores)
        .slice(-180);
    const featureSeries = TREE_FEATURE_KEYS.reduce((acc, key) => {
        acc[key] = correlationSamples.map((entry) => Number(entry.features?.[key]));
        return acc;
    }, {});
    const scoredVariances = TREE_FEATURE_KEYS
        .map((key) => ({
            key,
            spread: stdDev(featureSeries[key]),
        }))
        .filter((item) => Number.isFinite(item.spread) && item.spread > 0.01)
        .sort((left, right) => right.spread - left.spread)
        .slice(0, 8);
    const selectedKeys = scoredVariances.map((item) => item.key);
    const labels = selectedKeys.map((key, index) => ({
        key,
        short: String(index + 1),
        full: toDisplayLabel(key),
    }));
    const matrix = selectedKeys.map((rowKey) => (
        selectedKeys.map((colKey) => (
            round(pearsonCorrelation(featureSeries[rowKey], featureSeries[colKey]), 2)
        ))
    ));

    const blendedScores = correlationSamples.map((entry) => Number(entry.scores?.blended));
    const ruleScores = correlationSamples.map((entry) => Number(entry.scores?.rule));
    const neuralScores = correlationSamples.map((entry) => Number(entry.scores?.neural));
    const pairwiseScores = correlationSamples.map((entry) => Number(entry.scores?.pairwise));
    const impacts = selectedKeys
        .map((key) => {
            const values = featureSeries[key];
            return {
                key,
                label: toDisplayLabel(key),
                toBlended: round(pearsonCorrelation(values, blendedScores), 2),
                toRule: round(pearsonCorrelation(values, ruleScores), 2),
                toNeural: round(pearsonCorrelation(values, neuralScores), 2),
                toPairwise: round(pearsonCorrelation(values, pairwiseScores), 2),
            };
        })
        .sort((left, right) => Math.abs(right.toBlended) - Math.abs(left.toBlended));

    const absCorrSeries = [];
    for (let rowIndex = 0; rowIndex < labels.length; rowIndex += 1) {
        for (let colIndex = rowIndex + 1; colIndex < labels.length; colIndex += 1) {
            const corr = Number(matrix?.[rowIndex]?.[colIndex]);
            if (Number.isFinite(corr)) {
                absCorrSeries.push(Math.abs(corr));
            }
        }
    }
    const duplicateCorrelationThreshold = clamp(
        Math.max(0.95, quantile(absCorrSeries, 0.95, 0.95) - 0.01),
        0.95,
        0.99,
    );
    const duplicateCorrelations = [];
    for (let rowIndex = 0; rowIndex < labels.length; rowIndex += 1) {
        for (let colIndex = rowIndex + 1; colIndex < labels.length; colIndex += 1) {
            const corr = Number(matrix?.[rowIndex]?.[colIndex]);
            if (!Number.isFinite(corr) || Math.abs(corr) < duplicateCorrelationThreshold) {
                continue;
            }
            duplicateCorrelations.push({
                a: labels[rowIndex].full,
                b: labels[colIndex].full,
                corr: round(corr, 2),
            });
        }
    }
    duplicateCorrelations.sort((left, right) => Math.abs(right.corr) - Math.abs(left.corr));

    const factorRedundancy = buildFactorRedundancyDiagnostics({
        abHistory: history,
        minSamplesPerFactor: 6,
        minActiveBins: 3,
        similarityThreshold: normalizedRedundancyTuning.similarityThreshold,
        minEffectMagnitude: 0.08,
        binCount: 5,
    });
    const ateRedundantPairs = factorRedundancy.redundantPairs || [];

    const permutationRows = (() => {
        const maxAbs = impacts.length
            ? Math.max(...impacts.map((row) => Math.abs(Number(row?.toBlended || 0))))
            : 0;
        return impacts.map((row) => ({
            ...row,
            rawImpact: maxAbs > 0 ? Math.abs(Number(row.toBlended || 0)) / maxAbs : 0,
        }));
    })();
    const permutationValues = permutationRows
        .map((row) => Number(row?.rawImpact))
        .filter((value) => Number.isFinite(value));
    const permutationQ75 = quantile(permutationValues, 0.75, 0);
    const permutationQ25 = quantile(permutationValues, 0.25, 0);
    const permutationIQR = Math.max(0, permutationQ75 - permutationQ25);
    const permutationCollapseThreshold = clamp(
        Math.max(0.14, (permutationQ75 * 0.66) - (permutationIQR * 0.1)),
        0.14,
        0.26,
    );
    const permutationMaxImpact = permutationValues.length ? Math.max(...permutationValues) : 0;
    const permutationCollapse = permutationRows.length >= 4
        && permutationMaxImpact < permutationCollapseThreshold;

    const accepted = (Array.isArray(likedCollection) ? likedCollection : [])
        .filter((entry) => entry?.type === treeType && entry?.phenotype)
        .slice(-260);
    const cellCounts = new Map();
    accepted.forEach((entry) => {
        const descriptor = deriveMapElitesDescriptor({
            phenotype: entry?.phenotype,
            analysis: {
                features: entry?.features || {},
                factors: entry?.factors || {},
            },
        });
        const cell = descriptorToCell(descriptor, 8, 8);
        const key = cell?.key || '0:0';
        cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    });
    const probabilities = accepted.length
        ? [...cellCounts.values()].map((count) => count / accepted.length)
        : [];
    const entropy = probabilities.reduce((acc, p) => acc - p * Math.log2(Math.max(1e-9, p)), 0);
    const diversityEntropy = accepted.length ? clamp01(entropy / Math.log2(64)) : 0;
    const diversityFillRatio = accepted.length ? clamp01(cellCounts.size / 64) : 0;
    const diversityEntropyWarnThreshold = clamp(
        0.32 + (diversityFillRatio * 0.22),
        0.32,
        0.56,
    );
    const diversityCollapse = accepted.length >= 36
        && diversityEntropy < diversityEntropyWarnThreshold;

    const calibrationWindowSize = Math.min(SAKURA_V2_CALIBRATION_WINDOW_SIZE, totalRounds);
    const pairwiseCalibrationWindow = history.slice(0, calibrationWindowSize).filter((entry) => {
        if (isNeutralPicked(entry)) {
            return false;
        }
        const queryKind = String(entry?.query?.kind || entry?.generationContext?.queryKind || '').toLowerCase();
        return queryKind !== 'anchor';
    });
    const pairwiseCalibrationRawHistory = computePairwiseCalibrationError(pairwiseCalibrationWindow, {
        preferRaw: true,
    });
    const pairwiseCalibrationCalibratedHistory = computePairwiseCalibrationError(pairwiseCalibrationWindow, {
        preferRaw: false,
    });
    const rawCalibrationErrorMeta = Number(pairwiseMeta?.rawCalibrationError);
    const calibratedCalibrationErrorMeta = Number(pairwiseMeta?.calibratedCalibrationError);
    const calibrationSamplesMeta = Number.isFinite(Number(pairwiseMeta?.calibrationSamples))
        ? Math.max(0, Math.floor(Number(pairwiseMeta?.calibrationSamples)))
        : 0;
    const pairwiseCalibrationErrorRaw = (
        calibrationSamplesMeta > 0 && Number.isFinite(rawCalibrationErrorMeta)
    )
        ? rawCalibrationErrorMeta
        : pairwiseCalibrationRawHistory.error;
    const pairwiseCalibrationError = (
        calibrationSamplesMeta > 0 && Number.isFinite(calibratedCalibrationErrorMeta)
    )
        ? calibratedCalibrationErrorMeta
        : pairwiseCalibrationCalibratedHistory.error;
    const pairwiseCalibrationSamples = calibrationSamplesMeta > 0
        ? calibrationSamplesMeta
        : Math.max(pairwiseCalibrationRawHistory.samples, pairwiseCalibrationCalibratedHistory.samples);
    const pairwiseCalibrationWarnThreshold = clamp(
        0.1 + ((1 - clamp01(pairwiseTrainingCount / 220)) * 0.16),
        0.1,
        0.3,
    );

    const reliabilitySignal = clamp01((
        Number(sakuraV2Gate?.neuralReliability || 0)
        + Number(sakuraV2Gate?.pairwiseReliability || 0)
    ) / 2);
    const identifiabilityScore = clamp01(
        (clamp01(meanInfoScore / 0.7) * 0.34)
        + ((1 - clamp01(disagreementRate / 0.65)) * 0.33)
        + (reliabilitySignal * 0.33),
    );
    const isolationCoverage = labels.length ? clamp01(labels.length / 8) : 0;
    const axisPurity = clamp01(1 - disagreementRate);

    const v2Alerts = [];
    if (duplicateCorrelations.length > 0) {
        const sample = duplicateCorrelations[0];
        v2Alerts.push(`High feature correlation >= ${duplicateCorrelationThreshold.toFixed(2)} detected (e.g. ${sample.a} vs ${sample.b}, r=${sample.corr}).`);
    }
    if (ateRedundantPairs.length > 0) {
        const sample = ateRedundantPairs[0];
        v2Alerts.push(`ATE curve similarity >= ${factorRedundancy.thresholds.similarityThreshold.toFixed(2)} detected (e.g. ${sample.aLabel} vs ${sample.bLabel}, sim=${sample.similarity.toFixed(2)}).`);
    }
    if (permutationCollapse) {
        v2Alerts.push(`Normalized score correlation collapsed (max ${permutationMaxImpact.toFixed(2)} < adaptive threshold ${permutationCollapseThreshold.toFixed(2)}).`);
    }
    if (
        Number.isFinite(pairwiseCalibrationError)
        && pairwiseCalibrationSamples >= 18
        && pairwiseCalibrationError > pairwiseCalibrationWarnThreshold
    ) {
        v2Alerts.push(
            `Candidate-score pick MAE is high (${pairwiseCalibrationError.toFixed(3)} > ${pairwiseCalibrationWarnThreshold.toFixed(3)}).`
            + `${Number.isFinite(pairwiseCalibrationErrorRaw) ? ` Raw ${pairwiseCalibrationErrorRaw.toFixed(3)}.` : ''}`,
        );
    }
    if (diversityCollapse) {
        v2Alerts.push(`Accepted candidate diversity is low (entropy ${diversityEntropy.toFixed(3)} < ${diversityEntropyWarnThreshold.toFixed(3)}).`);
    }
    if (!sakuraV2Gate?.canOptimize && optimizeEntries.length > 0) {
        v2Alerts.push('Optimization happened before reliability gate was unlocked.');
    }

    const frictions = [];
    if (disagreementRate > 0.42 && disagreementSamples >= 12) {
        frictions.push({
            title: 'Neural vs Pairwise conflict',
            detail: `Direction conflict ${(disagreementRate * 100).toFixed(0)}% in recent rounds.`,
            action: 'Run a tighter isolation batch before optimizing to align preference direction.',
        });
    }
    if (!sakuraV2Gate?.canOptimize && optimizeEntries.length > 0) {
        frictions.push({
            title: 'Optimize while gate locked',
            detail: 'Optimization was executed before reliability gate unlock.',
            action: 'Keep session in LEARN until reliability rises, then run optimize.',
        });
    }
    if (passRate > 0.34 && windowSize >= 12) {
        frictions.push({
            title: 'High PASS ratio',
            detail: `PASS ${(passRate * 100).toFixed(0)}% in last ${windowSize} rounds.`,
            action: 'Narrow A/B distance and force clearer pairwise decisions.',
        });
    }
    if (bothGoodRate > 0.28 && windowSize >= 12) {
        frictions.push({
            title: 'High BOTH_GOOD ratio',
            detail: `BOTH_GOOD ${(bothGoodRate * 100).toFixed(0)}% in last ${windowSize} rounds.`,
            action: 'Widen pair delta for clearer directional learning updates.',
        });
    }

    let loopStatus = 'Collecting';
    if (totalRounds >= 20 && !latestOptimize && sakuraV2Gate?.canOptimize) {
        loopStatus = 'Ready';
    } else if (latestOptimize && Number.isFinite(optimizeGain) && optimizeGain < 0) {
        loopStatus = 'Misaligned';
    } else if (latestOptimize && Number.isFinite(optimizeGain) && optimizeGain < 0.012) {
        loopStatus = 'Stagnant';
    } else if (latestOptimize && Number.isFinite(optimizeGain) && optimizeGain >= 0.012) {
        loopStatus = 'Healthy';
    }

    const builtInBaselinePhenotype = getBuiltInDefaultPhenotype(treeType);
    const phenotypeRows = LEARNING_Phenotype_FACTOR_KEYS.map((key) => {
        const def = Phenotype_FACTOR_DEFS[key];
        const span = Math.max(1e-6, Number(def?.max) - Number(def?.min));
        const current = Number(currentPhenotype?.[key]);
        const baseline = Number(builtInBaselinePhenotype?.[key]);
        return {
            key,
            label: toDisplayLabel(key),
            deltaNorm: Number.isFinite(current) && Number.isFinite(baseline)
                ? (current - baseline) / span
                : 0,
        };
    });
    const phenotypeStronger = [...phenotypeRows].sort((a, b) => b.deltaNorm - a.deltaNorm).slice(0, 3);
    const phenotypeWeaker = [...phenotypeRows].sort((a, b) => a.deltaNorm - b.deltaNorm).slice(0, 3);

    const strongestFactors = analyzedCandidate?.metric?.evaluation?.strongest || [];
    const weakestFactors = analyzedCandidate?.metric?.evaluation?.weakest || [];

    const matrixLines = (() => {
        if (!labels.length) {
            return ['N/A'];
        }
        const header = ['#', ...labels.map((item) => item.short)].join('\t');
        const rows = labels.map((row, rowIndex) => (
            `${row.short}\t${(matrix[rowIndex] || []).map((value) => Number(value).toFixed(2)).join('\t')}`
        ));
        const legend = labels.map((item) => `${item.short}. ${item.full}`);
        return [header, ...rows, ...legend];
    })();
    const gateRequirements = Array.isArray(sakuraV2Gate?.requirements)
        ? sakuraV2Gate.requirements
        : [];
    const gateBottleneck = sakuraV2Gate?.bottleneck || null;
    const canonicalPredictiveEce = sakuraV2Gate?.predictive?.ece === null
        || sakuraV2Gate?.predictive?.ece === undefined
        ? Number.NaN
        : Number(sakuraV2Gate.predictive.ece);
    const canonicalPredictiveEceTarget = sakuraV2Gate?.thresholds?.maxEce === null
        || sakuraV2Gate?.thresholds?.maxEce === undefined
        ? Number.NaN
        : Number(sakuraV2Gate.thresholds.maxEce);
    const pairwiseMetaCalibrationSamples = Math.max(
        0,
        Math.floor(Number(pairwiseMeta?.calibrationSamples || 0)),
    );
    const pairwiseMetaRawCalibrationError = pairwiseMeta?.rawCalibrationError === null
        || pairwiseMeta?.rawCalibrationError === undefined
        ? Number.NaN
        : Number(pairwiseMeta.rawCalibrationError);
    const pairwiseMetaCalibratedCalibrationError = pairwiseMeta?.calibratedCalibrationError === null
        || pairwiseMeta?.calibratedCalibrationError === undefined
        ? Number.NaN
        : Number(pairwiseMeta.calibratedCalibrationError);
    const pairwiseMetaCalibrationSummary = (
        pairwiseMetaCalibrationSamples > 0
        && Number.isFinite(pairwiseMetaRawCalibrationError)
        && Number.isFinite(pairwiseMetaCalibratedCalibrationError)
    )
        ? `${pairwiseMetaRawCalibrationError.toFixed(3)}->${pairwiseMetaCalibratedCalibrationError.toFixed(3)} (n=${pairwiseMetaCalibrationSamples})`
        : `N/A (n=${pairwiseMetaCalibrationSamples})`;
    const questionLaneCounts = history.reduce((counts, entry) => {
        const lane = entry?.generationContext?.questionLane || 'legacy_controlled';
        counts[lane] = (counts[lane] || 0) + 1;
        return counts;
    }, {});
    const deepLines = [
        `Redundancy tuning: sim >= ${normalizedRedundancyTuning.similarityThreshold.toFixed(2)} | block >= ${normalizedRedundancyTuning.blockThreshold.toFixed(2)} | penalty ${normalizedRedundancyTuning.penaltyScale.toFixed(2)}`,
        'Adaptive Blend Weights',
        `Rule: ${(scoreView?.weights?.rule ?? 0).toFixed(2)}`,
        `Neural: ${(scoreView?.weights?.neural ?? 0).toFixed(2)}`,
        `Pairwise: ${(scoreView?.weights?.pairwise ?? 0).toFixed(2)}`,
        `Novelty: ${(scoreView?.weights?.novelty ?? 0).toFixed(2)}`,
        `Confidence N ${(scoreView?.modelConfidence?.neural ?? 0.5).toFixed(2)} / P ${(scoreView?.modelConfidence?.pairwise ?? 0.5).toFixed(2)} | Adaptive blend trust N ${(scoreView?.weights?.reliability?.neural ?? 0.5).toFixed(2)} / P ${(scoreView?.weights?.reliability?.pairwise ?? 0.5).toFixed(2)}`,
        'Sakura V2 Diagnostics (M4)',
        'LEARN',
        `Heuristic learning signal: ${(identifiabilityScore * 100).toFixed(0)}%`,
        `Canonical predictive ECE: ${Number.isFinite(canonicalPredictiveEce) ? canonicalPredictiveEce.toFixed(3) : '-'} (target <= ${Number.isFinite(canonicalPredictiveEceTarget) ? canonicalPredictiveEceTarget.toFixed(3) : '-'})`,
        `Candidate-score pick MAE raw/cal: ${Number.isFinite(pairwiseCalibrationErrorRaw) ? pairwiseCalibrationErrorRaw.toFixed(3) : '-'} / ${Number.isFinite(pairwiseCalibrationError) ? pairwiseCalibrationError.toFixed(3) : '-'} (diagnostic threshold <= ${pairwiseCalibrationWarnThreshold.toFixed(3)})`,
        `Uncertainty: ${Number.isFinite(recentUncertainty) ? recentUncertainty.toFixed(3) : '-'} (db ${uncertaintyDeadband.toFixed(3)})`,
        `Diversity Entropy: ${(diversityEntropy * 100).toFixed(0)}% / ${(diversityEntropyWarnThreshold * 100).toFixed(0)}%`,
        `Recent window ${windowSize} | Feature slots ${(isolationCoverage * 100).toFixed(0)}% | Model agreement ${(axisPurity * 100).toFixed(0)}% | Diversity fill ${(diversityFillRatio * 100).toFixed(0)}%`,
        `Adaptive thresholds: Corr ${duplicateCorrelationThreshold.toFixed(2)} | Normalized corr ${permutationCollapseThreshold.toFixed(2)} (max ${permutationMaxImpact.toFixed(2)})`,
        `Optimize gate: ${sakuraV2Gate?.canOptimize ? 'Ready' : 'Locked'} | Uncertainty trend: ${uncertaintyTrend}${Number.isFinite(uncertaintyDelta) ? ` (${uncertaintyDelta > 0 ? '+' : ''}${uncertaintyDelta.toFixed(3)})` : ''}`,
        'Optimize Gate Breakdown',
        `Bottleneck: ${gateBottleneck ? formatGateRequirementLine(gateBottleneck) : 'None'}`,
        ...(gateRequirements.length
            ? gateRequirements.map(formatGateRequirementLine)
            : ['Gate requirements unavailable.']),
        'Alerts',
        ...(v2Alerts.length ? v2Alerts : ['No active diagnostics alerts.']),
        'Learning Loop Feedback (N→1)',
        `${loopStatus}`,
        `Rounds: ${totalRounds}`,
        `Optimize tries: ${optimizeAttempts}`,
        `PASS rate: ${(passRate * 100).toFixed(0)}%`,
        `BOTH_GOOD rate: ${(bothGoodRate * 100).toFixed(0)}%`,
        `Disagreement: ${(disagreementRate * 100).toFixed(0)}%`,
        `Info score: ${Number.isFinite(meanInfoScore) ? meanInfoScore.toFixed(2) : '-'}`,
        `Gain: ${Number.isFinite(optimizeGain) ? `${optimizeGain >= 0 ? '+' : ''}${(optimizeGain * 100).toFixed(1)}%` : '-'}`,
        `${loopStatus === 'Misaligned' ? 'Current optimize output conflicts with learning direction or reliability state.' : 'Learning loop is progressing within expected direction.'}${latestOptimize?.optimizeSpace ? ` Last optimize path: ${latestOptimize.optimizeSpace}.` : ''}${Number.isFinite(roundsSinceOptimize) ? ` Rounds since optimize: ${roundsSinceOptimize}.` : ''}`,
        'Friction Points',
        ...(frictions.length
            ? frictions.flatMap((row) => ([
                row.title,
                row.detail,
                `Action: ${row.action}`,
            ]))
            : ['No major friction detected in current loop.']),
        'Phenotype Baseline Delta (vs built-in)',
        'Stronger',
        ...phenotypeStronger.map((row) => `${row.label}: ${row.deltaNorm >= 0 ? '+' : ''}${row.deltaNorm.toFixed(3)}`),
        'Weaker',
        ...phenotypeWeaker.map((row) => `${row.label}: ${row.deltaNorm >= 0 ? '+' : ''}${row.deltaNorm.toFixed(3)}`),
        'Current Composition Judgment (factor)',
        'Strong Top3',
        ...strongestFactors.slice(0, 3).map((row) => `${row.label}: ${((Number(row?.score) || 0) * 100).toFixed(0)}%`),
        'Weak Top3',
        ...weakestFactors.slice(0, 3).map((row) => `${row.label}: ${((Number(row?.score) || 0) * 100).toFixed(0)}%`),
        'Feature Correlation Matrix',
        `N=${correlationSamples.length}`,
        ...matrixLines,
        'Top blended influence (corr)',
        ...impacts.slice(0, 6).map((row) => (
            `${row.label}: B ${row.toBlended >= 0 ? '+' : ''}${row.toBlended.toFixed(2)} / R ${row.toRule >= 0 ? '+' : ''}${row.toRule.toFixed(2)} / N ${row.toNeural >= 0 ? '+' : ''}${row.toNeural.toFixed(2)} / P ${row.toPairwise >= 0 ? '+' : ''}${row.toPairwise.toFixed(2)}`
        )),
        'Normalized Score Correlation (not permutation importance)',
        `N=${correlationSamples.length}`,
        ...permutationRows.slice(0, 6).map((row) => `${row.label}\n${row.rawImpact.toFixed(4)}`),
        'Isolation ATE Redundancy',
        `Isolation samples: ${factorRedundancy.totalIsolationSamples}`,
        `Curves: ${factorRedundancy.factorCurves.length} | bins ${factorRedundancy.thresholds.binCount} | min n ${factorRedundancy.thresholds.minSamplesPerFactor}`,
        `Threshold: sim >= ${factorRedundancy.thresholds.similarityThreshold.toFixed(2)} | min |effect| ${factorRedundancy.thresholds.minEffectMagnitude.toFixed(2)}`,
        ...(ateRedundantPairs.length
            ? ateRedundantPairs.slice(0, 6).map((row) => (
                `${row.aLabel} vs ${row.bLabel}: sim ${Number(row.similarity).toFixed(3)} | corr ${Number(row.curveCorrelation).toFixed(2)} | gap ${Number(row.meanCurveGap).toFixed(2)} | n>=${row.sampleFloor}`
            ))
            : ['No strong ATE-curve redundancy detected.']),
        'Pairwise Learning Contract',
        `Input basis: ${Number(pairwiseMeta?.latentSize || 0)}D canonical latent -> ${Number(pairwiseMeta?.effectivePairBasisSize || 0)}D effective RFF`,
        `Prediction evidence contract: ${pairwiseMeta?.predictionContractId || 'missing (legacy predictions excluded)'}`,
        'Structural descriptor: pair acquisition only; not a GP training input',
        `Trunk discretization: adaptive min ${SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.min} / base ${SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.base} / soft ${SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.soft} / hard ${SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.hard} | emitted count is not a GP axis`,
        `Evidence lanes: basin ${Number(questionLaneCounts.preference_basin || 0)} | discovery ${Number(questionLaneCounts.structural_discovery || 0)} | cold-start ${Number(questionLaneCounts.sobol_cold_start || 0)} | legacy ${Number(questionLaneCounts.legacy_controlled || 0)}`,
        'Basin/gate evidence: controlled preference and cold-start only',
        'Model Meta',
        `Neural steps ${brainMeta.trainingSteps || 0} | avgAbsError ${(Number(brainMeta.avgAbsError || 0)).toFixed(6)}`,
        `${activePairwiseLabel} pairs ${pairwiseMeta.trainingPairs || 0} | avgPairLoss ${(Number(pairwiseMeta.avgPairLoss || 0)).toFixed(6)} | avgVar ${(Number(pairwiseMeta?.avgPredictiveVariance || 0)).toFixed(6)} | temp ${(Number(pairwiseMeta?.temperature || 1)).toFixed(3)} | cal(raw->cal) ${pairwiseMetaCalibrationSummary}`,
    ];

    return deepLines.join('\n');
};
