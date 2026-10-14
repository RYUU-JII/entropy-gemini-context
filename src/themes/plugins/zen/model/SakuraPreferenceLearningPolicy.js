import {
    SAKURA_PREFERENCE_BASIN_SHAPE,
} from './SakuraPreferenceBasinContract';

const ACTIVE_FACTOR_STATUS = 'active';
const VALID_FACTOR_STATUSES = new Set(['active', 'excluded', 'candidate']);

export const SAKURA_PREFERENCE_LEARNING_STAGE = Object.freeze({
    EXPLORE: 'explore',
    ESTABLISH: 'establish',
    STABLE_CONFIRMATION: 'stable_confirmation',
    BROAD_PROBE: 'broad_probe',
});

export const SAKURA_PREFERENCE_SELECTION_REASON = Object.freeze({
    UNDERCOVERED: 'undercovered',
    UNSTABLE: 'unstable',
    STABLE_CONFIRMATION: 'stable_confirmation',
    ABSTAIN_RECOVERY: 'abstain_recovery',
});

export const SAKURA_PREFERENCE_ABSTAIN_DEFER_STREAK = 3;

export const SAKURA_PREFERENCE_PAIR_GAP_NORM_RANGES = Object.freeze({
    [SAKURA_PREFERENCE_LEARNING_STAGE.EXPLORE]: Object.freeze({
        min: 0.2,
        max: 0.28,
    }),
    [SAKURA_PREFERENCE_LEARNING_STAGE.ESTABLISH]: Object.freeze({
        min: 0.12,
        max: 0.18,
    }),
    [SAKURA_PREFERENCE_LEARNING_STAGE.STABLE_CONFIRMATION]: Object.freeze({
        min: 0.06,
        max: 0.1,
    }),
    [SAKURA_PREFERENCE_LEARNING_STAGE.BROAD_PROBE]: Object.freeze({
        min: 0.2,
        max: 0.28,
    }),
});

export const DEFAULT_SAKURA_PREFERENCE_BROAD_PROBE_INTERVAL = 12;

// A fixed low-discrepancy lattice makes each factor visit materially different
// regions of its learning range. Varying only the A/B gap around the current
// latent cannot distinguish a local preference from a monotonic one.
export const SAKURA_PREFERENCE_SPATIAL_PROBE_CENTER_NORMS = Object.freeze([
    0.16,
    0.5,
    0.84,
]);

export const SAKURA_PREFERENCE_CENTER_STRATEGY = Object.freeze({
    GLOBAL_PROBE: 'global_probe',
    MONOTONIC_LADDER: 'monotonic_ladder',
    INTERIOR_BRACKET: 'interior_bracket',
    BASIN_BOUNDARY: 'basin_boundary',
});

const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const failPolicyContract = (code, detail, details = null) => {
    const error = new Error(`[SakuraPreferenceLearningPolicy] ${code}: ${detail}`);
    error.code = code;
    if (isPlainObject(details)) {
        error.details = details;
    }
    throw error;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundGap = (value) => Number(value.toFixed(4));

const validateRoundIndex = (roundIndex) => {
    if (!Number.isSafeInteger(roundIndex) || roundIndex < 0) {
        failPolicyContract(
            'SAKURA_PREFERENCE_ROUND_INDEX_INVALID',
            'roundIndex must be a non-negative safe integer.',
            { roundIndex },
        );
    }
};

const validateBroadProbeInterval = (broadProbeInterval) => {
    if (!Number.isSafeInteger(broadProbeInterval) || broadProbeInterval < 1) {
        failPolicyContract(
            'SAKURA_PREFERENCE_BROAD_PROBE_INTERVAL_INVALID',
            'broadProbeInterval must be a positive safe integer.',
            { broadProbeInterval },
        );
    }
};

const resolveActiveFactors = (factorCatalog) => {
    if (!Array.isArray(factorCatalog) || factorCatalog.length === 0) {
        failPolicyContract(
            'SAKURA_PREFERENCE_FACTOR_CATALOG_REQUIRED',
            'factorCatalog must be a non-empty array.',
        );
    }

    const seenKeys = new Set();
    const activeFactors = [];

    factorCatalog.forEach((factor, index) => {
        if (!isPlainObject(factor)) {
            failPolicyContract(
                'SAKURA_PREFERENCE_FACTOR_INVALID',
                `factorCatalog[${index}] must be a plain object.`,
                { index },
            );
        }
        if (typeof factor.key !== 'string' || !factor.key || factor.key.trim() !== factor.key) {
            failPolicyContract(
                'SAKURA_PREFERENCE_FACTOR_KEY_INVALID',
                `factorCatalog[${index}].key must be a non-empty canonical key.`,
                { index, key: factor.key },
            );
        }
        if (seenKeys.has(factor.key)) {
            failPolicyContract(
                'SAKURA_PREFERENCE_FACTOR_KEY_DUPLICATE',
                `factorCatalog contains duplicate key '${factor.key}'.`,
                { key: factor.key },
            );
        }
        seenKeys.add(factor.key);

        if (
            !VALID_FACTOR_STATUSES.has(factor.status)
            || typeof factor.blocked !== 'boolean'
            || ((factor.status === ACTIVE_FACTOR_STATUS) === factor.blocked)
        ) {
            failPolicyContract(
                'SAKURA_PREFERENCE_FACTOR_ADMISSION_INVALID',
                `factor '${factor.key}' has an invalid status/blocked admission state.`,
                { key: factor.key },
            );
        }

        if (factor.status !== ACTIVE_FACTOR_STATUS || factor.blocked) {
            return;
        }
        if (!Number.isSafeInteger(factor.minEvidence) || factor.minEvidence < 1) {
            failPolicyContract(
                'SAKURA_PREFERENCE_FACTOR_MIN_EVIDENCE_INVALID',
                `active factor '${factor.key}' must declare a positive minEvidence.`,
                { key: factor.key, minEvidence: factor.minEvidence },
            );
        }
        if (
            !Number.isFinite(factor.latePairGapNorm)
            || factor.latePairGapNorm < 0
            || factor.latePairGapNorm > 1
        ) {
            failPolicyContract(
                'SAKURA_PREFERENCE_FACTOR_PAIR_GAP_INVALID',
                `active factor '${factor.key}' must declare latePairGapNorm within [0, 1].`,
                { key: factor.key, latePairGapNorm: factor.latePairGapNorm },
            );
        }
        activeFactors.push(factor);
    });

    if (activeFactors.length === 0) {
        failPolicyContract(
            'SAKURA_PREFERENCE_ACTIVE_FACTOR_REQUIRED',
            'factorCatalog must contain at least one admitted active factor.',
        );
    }

    return activeFactors;
};

const resolveFactorEvidence = ({
    activeFactors,
    basinSummary,
    coverageCounts,
    spatialProbeOrdinals,
    abstainStreakCounts,
}) => {
    if (!isPlainObject(basinSummary) || !isPlainObject(basinSummary.factors)) {
        failPolicyContract(
            'SAKURA_PREFERENCE_BASIN_SUMMARY_REQUIRED',
            'basinSummary.factors must be a plain object.',
        );
    }
    if (!isPlainObject(coverageCounts)) {
        failPolicyContract(
            'SAKURA_PREFERENCE_COVERAGE_COUNTS_REQUIRED',
            'coverageCounts must be a plain object.',
        );
    }
    if (!isPlainObject(spatialProbeOrdinals)) {
        failPolicyContract(
            'SAKURA_PREFERENCE_SPATIAL_PROBE_ORDINALS_REQUIRED',
            'spatialProbeOrdinals must be a plain object.',
        );
    }
    if (!isPlainObject(abstainStreakCounts)) {
        failPolicyContract(
            'SAKURA_PREFERENCE_ABSTAIN_STREAK_COUNTS_REQUIRED',
            'abstainStreakCounts must be a plain object.',
        );
    }

    return activeFactors.map((factor, catalogIndex) => {
        const basin = basinSummary.factors[factor.key];
        if (!isPlainObject(basin)) {
            failPolicyContract(
                'SAKURA_PREFERENCE_BASIN_FACTOR_REQUIRED',
                `basinSummary.factors is missing active factor '${factor.key}'.`,
                { key: factor.key },
            );
        }
        if (typeof basin.stable !== 'boolean') {
            failPolicyContract(
                'SAKURA_PREFERENCE_BASIN_STABILITY_INVALID',
                `basinSummary.factors['${factor.key}'].stable must be boolean.`,
                { key: factor.key, stable: basin.stable },
            );
        }
        if (
            Object.prototype.hasOwnProperty.call(basin, 'indifferent')
            && typeof basin.indifferent !== 'boolean'
        ) {
            failPolicyContract(
                'SAKURA_PREFERENCE_BASIN_INDIFFERENCE_INVALID',
                `basinSummary.factors['${factor.key}'].indifferent must be boolean when provided.`,
                { key: factor.key, indifferent: basin.indifferent },
            );
        }

        const coverage = coverageCounts[factor.key];
        if (!Number.isSafeInteger(coverage) || coverage < 0) {
            failPolicyContract(
                'SAKURA_PREFERENCE_COVERAGE_COUNT_INVALID',
                `coverageCounts['${factor.key}'] must be a non-negative safe integer.`,
                { key: factor.key, coverage },
            );
        }
        const spatialProbeOrdinal = spatialProbeOrdinals[factor.key];
        if (!Number.isSafeInteger(spatialProbeOrdinal) || spatialProbeOrdinal < 0) {
            failPolicyContract(
                'SAKURA_PREFERENCE_SPATIAL_PROBE_ORDINAL_INVALID',
                `spatialProbeOrdinals['${factor.key}'] must be a non-negative safe integer.`,
                { key: factor.key, spatialProbeOrdinal },
            );
        }
        const abstainStreak = abstainStreakCounts[factor.key];
        if (!Number.isSafeInteger(abstainStreak) || abstainStreak < 0) {
            failPolicyContract(
                'SAKURA_PREFERENCE_ABSTAIN_STREAK_INVALID',
                `abstainStreakCounts['${factor.key}'] must be a non-negative safe integer.`,
                { key: factor.key, abstainStreak },
            );
        }

        return {
            factor,
            basin,
            indifferent: basin.indifferent === true,
            coverage,
            coverageRatio: coverage / factor.minEvidence,
            spatialProbeOrdinal,
            abstainStreak,
            deferredAfterAbstain: abstainStreak >= SAKURA_PREFERENCE_ABSTAIN_DEFER_STREAK,
            catalogIndex,
        };
    });
};

const selectRoundRobin = (candidates, roundIndex) => {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        failPolicyContract(
            'SAKURA_PREFERENCE_SELECTION_POOL_EMPTY',
            'selection candidate pool must not be empty.',
        );
    }
    return candidates[roundIndex % candidates.length];
};

const selectFocusFactor = (factorEvidence, roundIndex) => {
    const undercovered = factorEvidence.filter((entry) => (
        !entry.indifferent
        && !entry.deferredAfterAbstain
        && entry.coverage < entry.factor.minEvidence
    ));
    if (undercovered.length > 0) {
        const lowestCoverageRatio = Math.min(...undercovered.map((entry) => entry.coverageRatio));
        const tied = undercovered.filter((entry) => entry.coverageRatio === lowestCoverageRatio);
        return {
            ...selectRoundRobin(tied, roundIndex),
            selectionReason: SAKURA_PREFERENCE_SELECTION_REASON.UNDERCOVERED,
            stage: SAKURA_PREFERENCE_LEARNING_STAGE.EXPLORE,
        };
    }

    const unstable = factorEvidence.filter((entry) => (
        !entry.indifferent && !entry.deferredAfterAbstain && !entry.basin.stable
    ));
    if (unstable.length > 0) {
        return {
            ...selectRoundRobin(unstable, roundIndex),
            selectionReason: SAKURA_PREFERENCE_SELECTION_REASON.UNSTABLE,
            stage: SAKURA_PREFERENCE_LEARNING_STAGE.ESTABLISH,
        };
    }

    const stableConfirmationPool = factorEvidence.filter(
        (entry) => !entry.indifferent && !entry.deferredAfterAbstain,
    );
    const abstainRecoveryPool = factorEvidence.filter((entry) => entry.deferredAfterAbstain);
    if (!stableConfirmationPool.length && abstainRecoveryPool.length) {
        return {
            ...selectRoundRobin(abstainRecoveryPool, roundIndex),
            selectionReason: SAKURA_PREFERENCE_SELECTION_REASON.ABSTAIN_RECOVERY,
            stage: SAKURA_PREFERENCE_LEARNING_STAGE.EXPLORE,
        };
    }
    return {
        ...selectRoundRobin(
            stableConfirmationPool.length ? stableConfirmationPool : factorEvidence,
            roundIndex,
        ),
        selectionReason: SAKURA_PREFERENCE_SELECTION_REASON.STABLE_CONFIRMATION,
        stage: SAKURA_PREFERENCE_LEARNING_STAGE.STABLE_CONFIRMATION,
    };
};

const selectBroadProbeFocus = (factorEvidence, broadProbeIndex) => {
    const indifferent = factorEvidence.filter((entry) => entry.indifferent);
    const abstainRecovery = factorEvidence.filter((entry) => entry.deferredAfterAbstain);
    const indifferenceCandidates = factorEvidence.filter((entry) => (
        !entry.indifferent
        && Number(entry.basin.recentNeutralEvidenceCount || 0) >= 2
        && Number(entry.basin.recentNeutralRate || 0) >= 0.6
    ));
    const minimumBroadNeutralCount = indifferenceCandidates.length
        ? Math.min(...indifferenceCandidates.map(
            (entry) => Number(entry.basin.broadNeutralEvidenceCount || 0),
        ))
        : 0;
    const qualificationPool = indifferenceCandidates.filter(
        (entry) => Number(entry.basin.broadNeutralEvidenceCount || 0) === minimumBroadNeutralCount,
    );
    // Broad questions first finish factors that already look user-indifferent;
    // otherwise three confirmations would be diluted across all 25 factors.
    // Once qualification is complete, existing indifferent factors receive
    // the independent drift-recheck lane.
    const pool = qualificationPool.length
        ? qualificationPool
        : abstainRecovery.length
            ? abstainRecovery
        : indifferent.length
            ? indifferent
            : factorEvidence;
    const selected = selectRoundRobin(pool, broadProbeIndex);
    const selectionReason = selected.deferredAfterAbstain
        ? SAKURA_PREFERENCE_SELECTION_REASON.ABSTAIN_RECOVERY
        : selected.indifferent || selected.basin.stable
        ? SAKURA_PREFERENCE_SELECTION_REASON.STABLE_CONFIRMATION
        : selected.coverage < selected.factor.minEvidence
            ? SAKURA_PREFERENCE_SELECTION_REASON.UNDERCOVERED
            : SAKURA_PREFERENCE_SELECTION_REASON.UNSTABLE;
    return {
        ...selected,
        selectionReason,
        stage: selected.coverage < selected.factor.minEvidence
            ? SAKURA_PREFERENCE_LEARNING_STAGE.EXPLORE
            : selected.basin.stable
                ? SAKURA_PREFERENCE_LEARNING_STAGE.STABLE_CONFIRMATION
                : SAKURA_PREFERENCE_LEARNING_STAGE.ESTABLISH,
    };
};

const resolveTargetPairGapNorm = ({ factor, stage, broadProbe, wideSpatialProbe }) => {
    const baseGap = factor.latePairGapNorm;
    if (broadProbe) {
        const broadRange = SAKURA_PREFERENCE_PAIR_GAP_NORM_RANGES[
            SAKURA_PREFERENCE_LEARNING_STAGE.BROAD_PROBE
        ];
        return roundGap(clamp(baseGap + 0.18, 0.24, broadRange.max));
    }
    if (wideSpatialProbe) {
        return roundGap(clamp(baseGap + 0.14, 0.22, 0.24));
    }
    if (stage === SAKURA_PREFERENCE_LEARNING_STAGE.EXPLORE) {
        const range = SAKURA_PREFERENCE_PAIR_GAP_NORM_RANGES[stage];
        return roundGap(clamp(baseGap + 0.16, range.min, range.max));
    }
    if (stage === SAKURA_PREFERENCE_LEARNING_STAGE.ESTABLISH) {
        const range = SAKURA_PREFERENCE_PAIR_GAP_NORM_RANGES[stage];
        return roundGap(clamp(baseGap + 0.06, range.min, range.max));
    }
    if (stage === SAKURA_PREFERENCE_LEARNING_STAGE.STABLE_CONFIRMATION) {
        const range = SAKURA_PREFERENCE_PAIR_GAP_NORM_RANGES[stage];
        return roundGap(clamp(baseGap, range.min, range.max));
    }
    failPolicyContract(
        'SAKURA_PREFERENCE_LEARNING_STAGE_INVALID',
        `Unsupported learning stage '${String(stage)}'.`,
        { stage },
    );
};

const readOptionalRatio = (value) => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
        ? value
        : null
);

const resolveStableBasinBoundaryCenterNorm = (basin = {}, spatialProbeOrdinal = 0) => {
    const acceptedLow = readOptionalRatio(basin.acceptedLow);
    const acceptedHigh = readOptionalRatio(basin.acceptedHigh);
    if (
        acceptedLow !== null
        && acceptedHigh !== null
        && acceptedHigh >= acceptedLow
    ) {
        if (basin.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH) {
            return roundGap(acceptedLow);
        }
        if (basin.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW) {
            return roundGap(acceptedHigh);
        }
        return roundGap(spatialProbeOrdinal % 2 === 0 ? acceptedLow : acceptedHigh);
    }
    const winnerMean = readOptionalRatio(basin.winnerMean);
    return winnerMean !== null
        ? roundGap(winnerMean)
        : null;
};

const resolveGlobalProbeCenterNorm = (spatialProbeOrdinal) => (
    SAKURA_PREFERENCE_SPATIAL_PROBE_CENTER_NORMS[
        spatialProbeOrdinal % SAKURA_PREFERENCE_SPATIAL_PROBE_CENTER_NORMS.length
    ]
);

const resolveEstablishmentCenterNorm = (selection) => {
    const ordinal = selection.spatialProbeOrdinal;
    const winnerMean = readOptionalRatio(selection.basin.winnerMean);
    if (selection.basin.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH) {
        return [0.34, 0.58, 0.82][ordinal % 3];
    }
    if (selection.basin.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW) {
        return [0.66, 0.42, 0.18][ordinal % 3];
    }
    if (
        selection.basin.preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.INTERIOR
        && winnerMean !== null
    ) {
        return [
            clamp(winnerMean - 0.16, 0.16, 0.84),
            clamp(winnerMean, 0.16, 0.84),
            clamp(winnerMean + 0.16, 0.16, 0.84),
        ][ordinal % 3];
    }
    return resolveGlobalProbeCenterNorm(ordinal);
};

const resolveTargetPairCenter = ({ selection, broadProbe }) => {
    if (!broadProbe && selection.stage === SAKURA_PREFERENCE_LEARNING_STAGE.STABLE_CONFIRMATION) {
        const stableCenter = resolveStableBasinBoundaryCenterNorm(
            selection.basin,
            selection.spatialProbeOrdinal,
        );
        if (stableCenter !== null) {
            return {
                targetPairCenterNorm: stableCenter,
                centerStrategy: SAKURA_PREFERENCE_CENTER_STRATEGY.BASIN_BOUNDARY,
            };
        }
    }
    if (!broadProbe && selection.stage === SAKURA_PREFERENCE_LEARNING_STAGE.ESTABLISH) {
        const shape = selection.basin.preferenceShape;
        return {
            targetPairCenterNorm: roundGap(resolveEstablishmentCenterNorm(selection)),
            centerStrategy: shape === SAKURA_PREFERENCE_BASIN_SHAPE.INTERIOR
                ? SAKURA_PREFERENCE_CENTER_STRATEGY.INTERIOR_BRACKET
                : shape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH
                    || shape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW
                    ? SAKURA_PREFERENCE_CENTER_STRATEGY.MONOTONIC_LADDER
                    : SAKURA_PREFERENCE_CENTER_STRATEGY.GLOBAL_PROBE,
        };
    }
    return {
        targetPairCenterNorm: resolveGlobalProbeCenterNorm(selection.spatialProbeOrdinal),
        centerStrategy: SAKURA_PREFERENCE_CENTER_STRATEGY.GLOBAL_PROBE,
    };
};

/**
 * Selects the next controlled single-factor preference question.
 *
 * roundIndex is the zero-based index of the question being planned. A broad probe
 * keeps the selected factor isolated and only widens the total normalized A-B gap.
 */
export const resolveSakuraPreferenceLearningFocus = ({
    factorCatalog,
    basinSummary,
    coverageCounts,
    spatialProbeOrdinals,
    abstainStreakCounts,
    roundIndex,
    broadProbeInterval = DEFAULT_SAKURA_PREFERENCE_BROAD_PROBE_INTERVAL,
} = {}) => {
    validateRoundIndex(roundIndex);
    validateBroadProbeInterval(broadProbeInterval);

    const activeFactors = resolveActiveFactors(factorCatalog);
    const factorEvidence = resolveFactorEvidence({
        activeFactors,
        basinSummary,
        coverageCounts,
        spatialProbeOrdinals,
        abstainStreakCounts,
    });
    const broadProbe = ((roundIndex + 1) % broadProbeInterval) === 0;
    const broadProbeIndex = Math.max(
        0,
        Math.floor((roundIndex + 1) / broadProbeInterval) - 1,
    );
    const selection = broadProbe
        ? selectBroadProbeFocus(factorEvidence, broadProbeIndex)
        : selectFocusFactor(factorEvidence, roundIndex);
    const stage = broadProbe
        ? SAKURA_PREFERENCE_LEARNING_STAGE.BROAD_PROBE
        : selection.stage;
    // Keep three spatially wide decisive samples inside the basin model's
    // recent-12 window even after the initial explore evidence ages out.
    // This is deliberately separate from broadProbe, whose only job is
    // confirming user indifference.
    const wideSpatialProbe = Boolean(
        !broadProbe
        && selection.stage === SAKURA_PREFERENCE_LEARNING_STAGE.ESTABLISH
        && selection.spatialProbeOrdinal % 4 === 3
    );
    const center = resolveTargetPairCenter({
        selection,
        broadProbe,
    });

    return {
        focusFactor: selection.factor.key,
        selectionReason: selection.selectionReason,
        stage,
        targetPairGapNorm: resolveTargetPairGapNorm({
            factor: selection.factor,
            stage: selection.stage,
            broadProbe,
            wideSpatialProbe,
        }),
        targetPairCenterNorm: center.targetPairCenterNorm,
        centerStrategy: center.centerStrategy,
        spatialProbeOrdinal: selection.spatialProbeOrdinal,
        abstainStreak: selection.abstainStreak,
        deferredAfterAbstain: selection.deferredAfterAbstain,
        wideSpatialProbe,
        broadProbe,
    };
};
