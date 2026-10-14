import {
    clamp,
    clamp01,
    mean,
    pearsonCorrelation,
    round,
} from './ZenReportMath';

const DEFAULT_BIN_COUNT = 5;
const DEFAULT_MIN_SAMPLES_PER_FACTOR = 6;
const DEFAULT_MIN_ACTIVE_BINS = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.9;
const DEFAULT_MIN_EFFECT_MAGNITUDE = 0.08;

const resolvePreferredLabel = (entry = {}) => {
    const picked = String(entry?.picked || '').toUpperCase();
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

const isIsolationEntry = (entry = {}) => {
    const context = entry?.generationContext || {};
    const changedFactors = Array.isArray(context?.changedFactors)
        ? context.changedFactors
        : [];
    const pairType = String(context?.pairType || '').toLowerCase();
    if (pairType === 'isolation_pair') {
        return changedFactors.length === 1;
    }
    return changedFactors.length === 1;
};

const collectIsolationInterventions = (abHistory = []) => {
    const history = Array.isArray(abHistory) ? abHistory : [];
    const factorMap = new Map();
    let totalIsolationSamples = 0;

    history.forEach((entry) => {
        const preferredLabel = resolvePreferredLabel(entry);
        if (!preferredLabel || !isIsolationEntry(entry)) {
            return;
        }
        const context = entry?.generationContext || {};
        const changedFactors = Array.isArray(context?.changedFactors)
            ? context.changedFactors
            : [];
        const factor = changedFactors[0];
        const factorId = typeof factor?.id === 'string' ? factor.id.trim() : '';
        if (!factorId) {
            return;
        }
        const a = Number(factor?.a);
        const b = Number(factor?.b);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return;
        }
        const chosenValue = preferredLabel === 'A' ? a : b;
        const otherValue = preferredLabel === 'A' ? b : a;
        const span = Math.max(1e-6, Math.abs(a - b));
        const signedEffect = clamp((chosenValue - otherValue) / span, -1, 1);
        const center = (a + b) / 2;
        const sampleWeight = clamp(
            Number(entry?.weights?.pairwise ?? entry?.weights?.neutral ?? 1),
            0.1,
            2,
        );

        if (!factorMap.has(factorId)) {
            factorMap.set(factorId, {
                id: factorId,
                label: typeof factor?.label === 'string' && factor.label.trim()
                    ? factor.label.trim()
                    : factorId,
                samples: [],
            });
        }
        factorMap.get(factorId).samples.push({
            center,
            effect: signedEffect,
            weight: sampleWeight,
        });
        totalIsolationSamples += 1;
    });

    return { factorMap, totalIsolationSamples };
};

const buildAteCurve = (factorEntry = {}, binCount = DEFAULT_BIN_COUNT) => {
    const samples = Array.isArray(factorEntry?.samples)
        ? factorEntry.samples.filter((row) => (
            Number.isFinite(row?.center) && Number.isFinite(row?.effect)
        ))
        : [];
    if (!samples.length) {
        return null;
    }

    const safeBinCount = Math.max(3, Math.floor(Number.isFinite(binCount) ? binCount : DEFAULT_BIN_COUNT));
    const minCenter = Math.min(...samples.map((row) => row.center));
    const maxCenter = Math.max(...samples.map((row) => row.center));
    const centerSpan = Math.max(1e-6, maxCenter - minCenter);

    const bins = Array.from({ length: safeBinCount }, () => ({
        weightedEffect: 0,
        totalWeight: 0,
        count: 0,
    }));

    samples.forEach((row) => {
        const normalized = clamp01((row.center - minCenter) / centerSpan);
        const index = Math.min(safeBinCount - 1, Math.floor(normalized * safeBinCount));
        const bucket = bins[index];
        bucket.weightedEffect += row.effect * row.weight;
        bucket.totalWeight += row.weight;
        bucket.count += 1;
    });

    const weightedMean = (() => {
        const totalWeight = samples.reduce((acc, row) => acc + row.weight, 0);
        if (totalWeight <= 1e-9) {
            return 0;
        }
        const totalEffect = samples.reduce((acc, row) => acc + (row.effect * row.weight), 0);
        return totalEffect / totalWeight;
    })();

    const curve = bins.map((bucket) => (
        bucket.totalWeight > 1e-9
            ? bucket.weightedEffect / bucket.totalWeight
            : weightedMean
    ));
    const counts = bins.map((bucket) => bucket.count);
    const nonEmptyBins = counts.filter((count) => count > 0).length;
    const meanAbsEffect = mean(samples.map((row) => Math.abs(row.effect)));

    return {
        id: factorEntry.id,
        label: factorEntry.label,
        samples: samples.length,
        binCount: safeBinCount,
        nonEmptyBins,
        meanEffect: round(weightedMean, 4),
        meanAbsEffect: round(meanAbsEffect, 4),
        counts,
        curve: curve.map((value) => round(value, 4)),
    };
};

const detectRedundantPairs = (factorCurves = [], options = {}) => {
    const curves = Array.isArray(factorCurves) ? factorCurves : [];
    const minSamplesPerFactor = Math.max(
        2,
        Math.floor(Number.isFinite(options?.minSamplesPerFactor)
            ? options.minSamplesPerFactor
            : DEFAULT_MIN_SAMPLES_PER_FACTOR),
    );
    const minActiveBins = Math.max(
        2,
        Math.floor(Number.isFinite(options?.minActiveBins)
            ? options.minActiveBins
            : DEFAULT_MIN_ACTIVE_BINS),
    );
    const minEffectMagnitude = clamp(
        Number.isFinite(options?.minEffectMagnitude)
            ? options.minEffectMagnitude
            : DEFAULT_MIN_EFFECT_MAGNITUDE,
        0.02,
        1,
    );
    const similarityThreshold = clamp(
        Number.isFinite(options?.similarityThreshold)
            ? options.similarityThreshold
            : DEFAULT_SIMILARITY_THRESHOLD,
        0.5,
        0.99,
    );

    const eligible = curves.filter((entry) => (
        Number(entry?.samples || 0) >= minSamplesPerFactor
        && Number(entry?.nonEmptyBins || 0) >= minActiveBins
        && Number(entry?.meanAbsEffect || 0) >= minEffectMagnitude
    ));

    const redundantPairs = [];
    for (let row = 0; row < eligible.length; row += 1) {
        for (let col = row + 1; col < eligible.length; col += 1) {
            const left = eligible[row];
            const right = eligible[col];
            const correlation = pearsonCorrelation(left.curve, right.curve);
            const corrSimilarity = clamp01((correlation + 1) * 0.5);
            const meanCurveGap = mean(
                left.curve.map((value, index) => Math.abs(value - Number(right.curve?.[index] ?? value))),
            );
            const gapSimilarity = clamp01(1 - (meanCurveGap / 1.2));
            const sampleBalance = clamp01(
                Math.min(left.samples, right.samples) / Math.max(1, Math.max(left.samples, right.samples)),
            );
            const effectBalance = clamp01(
                1 - Math.abs(Number(left.meanAbsEffect || 0) - Number(right.meanAbsEffect || 0)),
            );
            const similarity = (
                (corrSimilarity * 0.62)
                + (gapSimilarity * 0.24)
                + (sampleBalance * 0.08)
                + (effectBalance * 0.06)
            );
            if (similarity < similarityThreshold) {
                continue;
            }
            redundantPairs.push({
                aId: left.id,
                aLabel: left.label,
                bId: right.id,
                bLabel: right.label,
                similarity: round(similarity, 4),
                curveCorrelation: round(correlation, 4),
                meanCurveGap: round(meanCurveGap, 4),
                sampleFloor: Math.min(left.samples, right.samples),
            });
        }
    }

    redundantPairs.sort((left, right) => (
        Number(right.similarity || 0) - Number(left.similarity || 0)
    ));

    return {
        redundantPairs,
        thresholds: {
            minSamplesPerFactor,
            minActiveBins,
            minEffectMagnitude: round(minEffectMagnitude, 3),
            similarityThreshold: round(similarityThreshold, 3),
        },
    };
};

export const buildFactorRedundancyDiagnostics = ({
    abHistory = [],
    binCount = DEFAULT_BIN_COUNT,
    minSamplesPerFactor = DEFAULT_MIN_SAMPLES_PER_FACTOR,
    minActiveBins = DEFAULT_MIN_ACTIVE_BINS,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    minEffectMagnitude = DEFAULT_MIN_EFFECT_MAGNITUDE,
} = {}) => {
    const { factorMap, totalIsolationSamples } = collectIsolationInterventions(abHistory);
    const factorCurves = [...factorMap.values()]
        .map((entry) => buildAteCurve(entry, binCount))
        .filter(Boolean)
        .sort((left, right) => Number(right.samples || 0) - Number(left.samples || 0));

    const detection = detectRedundantPairs(factorCurves, {
        minSamplesPerFactor,
        minActiveBins,
        similarityThreshold,
        minEffectMagnitude,
    });

    return {
        totalIsolationSamples,
        factorCurves,
        redundantPairs: detection.redundantPairs,
        thresholds: {
            ...detection.thresholds,
            binCount: Math.max(3, Math.floor(Number.isFinite(binCount) ? binCount : DEFAULT_BIN_COUNT)),
        },
    };
};
