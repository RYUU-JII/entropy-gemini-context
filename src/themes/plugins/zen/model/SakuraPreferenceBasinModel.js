import { resolveSakuraPairwiseEvidencePolicy } from './SakuraPairwiseEvidencePolicy.js';
import { resolveSakuraHistoryDecisionType } from './SakuraLearningPolicy';
import {
    SAKURA_LEARNING_KEYSPACE_PROFILE,
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentDef,
} from './v2/SakuraLatentParamApi';
import { resolveSakuraLearningFactor } from './v2/SakuraLearningFactorPolicy';
import {
    isSakuraLearningEvidenceSemanticallyCompatible,
    SAKURA_GENERATION_SEMANTICS_ID,
} from './v2/SakuraLearningSemantics';
import {
    SAKURA_PREFERENCE_BASIN_MODEL_VERSION,
    SAKURA_PREFERENCE_BASIN_SHAPE,
    SAKURA_PREFERENCE_BASIN_STAGE,
    SAKURA_PREFERENCE_BASIN_VALUE_SPACE,
} from './SakuraPreferenceBasinContract';

export {
    SAKURA_PREFERENCE_BASIN_MODEL_VERSION,
    SAKURA_PREFERENCE_BASIN_SHAPE,
    SAKURA_PREFERENCE_BASIN_STAGE,
} from './SakuraPreferenceBasinContract';

const ESTABLISH_EVIDENCE_MIN = 3;
const STABLE_EVIDENCE_MIN = 8;
const STABLE_STD_DEV_MAX = 0.16;
const STABLE_ACCEPTED_WIDTH_MAX = 0.4;
const STABLE_CONSISTENCY_MIN = 0.7;
const STABLE_DIRECTIONAL_CONSISTENCY_MIN = 0.8;
const MONOTONIC_DIRECTION_BIAS_MIN = 0.75;
const MONOTONIC_DISTINCT_CENTER_MIN = 3;
const MONOTONIC_OBSERVED_SPAN_MIN = 0.32;
const MONOTONIC_WIDE_EVIDENCE_MIN = 3;
const WIDE_DECISIVE_GAP_MIN = 0.2;
const QUANTILE_EVIDENCE_MIN = 5;
const ACCEPTED_LOW_QUANTILE = 0.1;
const ACCEPTED_HIGH_QUANTILE = 0.9;
const INDIFFERENCE_EVIDENCE_MIN = 6;
const INDIFFERENCE_NEUTRAL_MIN = 5;
const INDIFFERENCE_NEUTRAL_RATE_MIN = 0.72;
const LEGACY_INDIFFERENCE_BROAD_GAP_MIN = 0.2;
const INDIFFERENCE_BROAD_NEUTRAL_MIN = 3;
const RECENT_CONTROLLED_EVIDENCE_WINDOW = 12;
const RECENT_BROAD_EVIDENCE_WINDOW = 6;
const RANGE_TOLERANCE = 1e-9;

const SUPPORTED_PROFILES = new Set(Object.values(SAKURA_LEARNING_KEYSPACE_PROFILE));

const WINNER_LABEL_BY_PICK = Object.freeze({
    A: 'A',
    B: 'B',
    WORSE_A: 'B',
    WORSE_B: 'A',
});

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const round = (value, digits = 6) => (
    Number.isFinite(value) ? Number(value.toFixed(digits)) : value
);

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const resolveWinnerLabel = (entry = {}) => (
    WINNER_LABEL_BY_PICK[String(entry?.picked || '').trim().toUpperCase()] || null
);

const resolveCandidateLatent = (candidate = null) => {
    if (isPlainObject(candidate?.modelInput?.latent)) {
        return candidate.modelInput.latent;
    }
    if (isPlainObject(candidate?.latent)) {
        return candidate.latent;
    }
    return null;
};

const requireModelInput = (input) => {
    if (!isPlainObject(input)) {
        throw new TypeError('ZEN_SAKURA_PREFERENCE_BASIN_INPUT_OBJECT_REQUIRED');
    }
    const {
        abHistory,
        factorKeys,
        learningKeyspaceProfile,
    } = input;
    if (!Array.isArray(abHistory)) {
        throw new TypeError('ZEN_SAKURA_PREFERENCE_BASIN_HISTORY_ARRAY_REQUIRED');
    }
    if (!Array.isArray(factorKeys) || !factorKeys.length) {
        throw new TypeError('ZEN_SAKURA_PREFERENCE_BASIN_FACTOR_KEYS_REQUIRED');
    }
    if (!SUPPORTED_PROFILES.has(learningKeyspaceProfile)) {
        throw new RangeError(
            `ZEN_SAKURA_PREFERENCE_BASIN_PROFILE_INVALID:${learningKeyspaceProfile ?? 'missing'}`,
        );
    }

    const normalizedFactorKeys = factorKeys.map((key, index) => {
        if (typeof key !== 'string' || !key.trim()) {
            throw new TypeError(`ZEN_SAKURA_PREFERENCE_BASIN_FACTOR_KEY_INVALID:index=${index}`);
        }
        return key.trim();
    });
    if (new Set(normalizedFactorKeys).size !== normalizedFactorKeys.length) {
        throw new Error('ZEN_SAKURA_PREFERENCE_BASIN_FACTOR_KEYS_DUPLICATE');
    }

    const allowedFactorKeys = new Set(listSakuraLearningLatentKeys({
        profile: learningKeyspaceProfile,
    }));
    normalizedFactorKeys.forEach((key) => {
        if (!allowedFactorKeys.has(key)) {
            throw new RangeError(`ZEN_SAKURA_PREFERENCE_BASIN_FACTOR_UNSUPPORTED:${key}`);
        }
    });
    abHistory.forEach((entry, index) => {
        if (!isPlainObject(entry)) {
            throw new TypeError(`ZEN_SAKURA_PREFERENCE_BASIN_HISTORY_ENTRY_INVALID:index=${index}`);
        }
    });

    return {
        abHistory,
        factorKeys: normalizedFactorKeys,
        learningKeyspaceProfile,
    };
};

const resolveLearningRange = (factorKey, learningKeyspaceProfile) => {
    const definition = resolveSakuraLearningLatentDef(factorKey, {
        profile: learningKeyspaceProfile,
    });
    const min = Number(definition?.min);
    const max = Number(definition?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        throw new Error(`ZEN_SAKURA_PREFERENCE_BASIN_RANGE_INVALID:${factorKey}`);
    }
    return {
        min,
        max,
        span: max - min,
        integer: definition?.integer === true,
    };
};

const rangesMatch = (left, right) => (
    Number(left?.min) === Number(right?.min)
    && Number(left?.max) === Number(right?.max)
    && Boolean(left?.integer) === Boolean(right?.integer)
);

/**
 * Reprojects compatible controlled legacy questions into the active learning
 * keyspace. The candidate values are not rewritten: projection is admitted
 * only when the factor's normalized range is identical in both profiles.
 */
export const projectSakuraPreferenceBasinHistory = ({
    abHistory = [],
    factorKeys = [],
    learningKeyspaceProfile,
} = {}) => {
    if (!Array.isArray(abHistory)) {
        throw new TypeError('ZEN_SAKURA_PREFERENCE_BASIN_HISTORY_ARRAY_REQUIRED');
    }
    if (!Array.isArray(factorKeys) || !factorKeys.length) {
        throw new TypeError('ZEN_SAKURA_PREFERENCE_BASIN_FACTOR_KEYS_REQUIRED');
    }
    if (!SUPPORTED_PROFILES.has(learningKeyspaceProfile)) {
        throw new RangeError(
            `ZEN_SAKURA_PREFERENCE_BASIN_PROFILE_INVALID:${learningKeyspaceProfile ?? 'missing'}`,
        );
    }

    const factorSet = new Set(factorKeys);
    const sourceProfileCounts = {};
    let projectedEntryCount = 0;
    let invalidatedEntryCount = 0;
    const invalidatedFactorCounts = {};
    const entries = abHistory.map((entry) => {
        const decisionType = resolveSakuraHistoryDecisionType(entry);
        const evidencePolicy = resolveSakuraPairwiseEvidencePolicy(entry);
        if (
            (
                decisionType !== 'decisive'
                && decisionType !== 'neutral'
                && decisionType !== 'abstain'
            )
            || !evidencePolicy.controlledAttribution
            || entry?.generationContext?.pairType !== 'isolation_pair'
        ) {
            return entry;
        }
        const changedFactors = entry.generationContext.changedFactors;
        const factorKey = changedFactors[0]?.id;
        if (!factorSet.has(factorKey)) {
            return entry;
        }

        const declaredSourceProfile = entry.generationContext.learningKeyspaceProfile;
        const sourceProfile = declaredSourceProfile;
        if (!SUPPORTED_PROFILES.has(sourceProfile)) {
            throw new Error(
                `ZEN_SAKURA_PREFERENCE_BASIN_SOURCE_PROFILE_REQUIRED:id=${entry.id ?? 'unknown'}:factor=${factorKey}`,
            );
        }
        sourceProfileCounts[sourceProfile] = (sourceProfileCounts[sourceProfile] || 0) + 1;
        if (!isSakuraLearningEvidenceSemanticallyCompatible({
            sourceGenerationSemantics: entry.generationContext.generationSemantics,
            targetGenerationSemantics: SAKURA_GENERATION_SEMANTICS_ID,
        })) {
            invalidatedEntryCount += 1;
            invalidatedFactorCounts[factorKey] = (invalidatedFactorCounts[factorKey] || 0) + 1;
            return null;
        }
        if (sourceProfile === learningKeyspaceProfile) {
            return entry;
        }

        const sourceDef = resolveSakuraLearningLatentDef(factorKey, { profile: sourceProfile });
        const targetDef = resolveSakuraLearningLatentDef(factorKey, {
            profile: learningKeyspaceProfile,
        });
        if (!sourceDef || !targetDef || !rangesMatch(sourceDef, targetDef)) {
            throw new Error(
                `ZEN_SAKURA_PREFERENCE_BASIN_PROJECTION_RANGE_MISMATCH:id=${entry.id ?? 'unknown'}:factor=${factorKey}:source=${sourceProfile}:target=${learningKeyspaceProfile}`,
            );
        }
        projectedEntryCount += 1;
        return {
            ...entry,
            generationContext: {
                ...entry.generationContext,
                learningKeyspaceProfile,
                preferenceBasinProjection: {
                    sourceProfile,
                    targetProfile: learningKeyspaceProfile,
                    rangeInvariant: true,
                },
            },
        };
    }).filter(Boolean);

    return {
        entries,
        projectedEntryCount,
        invalidatedEntryCount,
        invalidatedFactorCounts,
        sourceProfileCounts,
    };
};

const normalizeLearningValue = ({
    factorKey,
    value,
    range,
    historyEntryId,
    candidateLabel,
}) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new TypeError(
            `ZEN_SAKURA_PREFERENCE_BASIN_VALUE_REQUIRED:id=${historyEntryId ?? 'unknown'}:factor=${factorKey}:candidate=${candidateLabel}`,
        );
    }
    const tolerance = Math.max(RANGE_TOLERANCE, range.span * RANGE_TOLERANCE);
    if (numeric < range.min - tolerance || numeric > range.max + tolerance) {
        throw new RangeError(
            `ZEN_SAKURA_PREFERENCE_BASIN_VALUE_OUT_OF_RANGE:id=${historyEntryId ?? 'unknown'}:factor=${factorKey}:candidate=${candidateLabel}`,
        );
    }
    return clamp01((numeric - range.min) / range.span);
};

const quantile = (sortedValues, probability) => {
    if (!sortedValues.length) {
        return null;
    }
    const position = (sortedValues.length - 1) * probability;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lower = sortedValues[lowerIndex];
    const upper = sortedValues[upperIndex];
    if (lowerIndex === upperIndex) {
        return lower;
    }
    return lower + ((upper - lower) * (position - lowerIndex));
};

const mean = (values) => (
    values.reduce((sum, value) => sum + value, 0) / values.length
);

const resolvePreferenceShape = (directionBias, evidenceCount) => {
    if (!evidenceCount) {
        return SAKURA_PREFERENCE_BASIN_SHAPE.UNRESOLVED;
    }
    if (directionBias >= MONOTONIC_DIRECTION_BIAS_MIN) {
        return SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH;
    }
    if (directionBias <= -MONOTONIC_DIRECTION_BIAS_MIN) {
        return SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW;
    }
    return SAKURA_PREFERENCE_BASIN_SHAPE.INTERIOR;
};

const isMonotonicShape = (shape) => (
    shape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH
    || shape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW
);

const resolveRecentControlledEvidence = (decisiveEvidence, neutralEvidence) => (
    [
        ...decisiveEvidence.map((entry) => ({ ...entry, decisionType: 'decisive' })),
        ...neutralEvidence.map((entry) => ({ ...entry, decisionType: 'neutral' })),
    ]
        .sort((left, right) => (
            right.recency - left.recency
            || String(right.historyEntryId ?? '').localeCompare(
                String(left.historyEntryId ?? ''),
            )
        ))
        .slice(0, RECENT_CONTROLLED_EVIDENCE_WINDOW)
);

const resolveRecentBroadEvidence = (decisiveEvidence, neutralEvidence) => (
    [
        ...decisiveEvidence.map((entry) => ({ ...entry, decisionType: 'decisive' })),
        ...neutralEvidence.map((entry) => ({ ...entry, decisionType: 'neutral' })),
    ]
        .filter((entry) => entry.broadProbe)
        .sort((left, right) => (
            right.recency - left.recency
            || String(right.historyEntryId ?? '').localeCompare(
                String(left.historyEntryId ?? ''),
            )
        ))
        .slice(0, RECENT_BROAD_EVIDENCE_WINDOW)
);

const resolveStage = ({
    decisiveEvidenceCount,
    controlledEvidenceCount,
    neutralEvidenceCount,
    neutralRate,
    broadNeutralEvidenceCount,
    broadDecisiveEvidenceCount,
    indifferenceEvidenceMin,
    preferenceShape,
    directionalConsistency,
    distinctCenterCount,
    observedSpan,
    wideDecisiveEvidenceCount,
    winnerStdDev,
    acceptedWidth,
    consistency,
}) => {
    if (
        controlledEvidenceCount >= indifferenceEvidenceMin
        && neutralEvidenceCount >= INDIFFERENCE_NEUTRAL_MIN
        && neutralRate >= INDIFFERENCE_NEUTRAL_RATE_MIN
        && broadNeutralEvidenceCount >= INDIFFERENCE_BROAD_NEUTRAL_MIN
        && broadDecisiveEvidenceCount === 0
    ) {
        return SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT;
    }
    if (decisiveEvidenceCount < ESTABLISH_EVIDENCE_MIN) {
        return SAKURA_PREFERENCE_BASIN_STAGE.EXPLORE;
    }
    if (
        decisiveEvidenceCount >= STABLE_EVIDENCE_MIN
        && (
            (
                isMonotonicShape(preferenceShape)
                && directionalConsistency >= STABLE_DIRECTIONAL_CONSISTENCY_MIN
                && distinctCenterCount >= MONOTONIC_DISTINCT_CENTER_MIN
                && observedSpan >= MONOTONIC_OBSERVED_SPAN_MIN
                && wideDecisiveEvidenceCount >= MONOTONIC_WIDE_EVIDENCE_MIN
            )
            || (
                preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.INTERIOR
                && winnerStdDev <= STABLE_STD_DEV_MAX
                && acceptedWidth <= STABLE_ACCEPTED_WIDTH_MAX
                && consistency >= STABLE_CONSISTENCY_MIN
            )
        )
    ) {
        return SAKURA_PREFERENCE_BASIN_STAGE.STABLE;
    }
    return SAKURA_PREFERENCE_BASIN_STAGE.ESTABLISH;
};

const buildFactorBasinBase = ({
    factorKey,
    range,
    decisiveEvidence,
    neutralEvidence,
    abstainEvidence,
    recentControlledEvidence,
}) => {
    const evidenceCount = decisiveEvidence.length;
    const neutralEvidenceCount = neutralEvidence.length;
    const controlledEvidenceCount = evidenceCount + neutralEvidenceCount;
    const passCount = abstainEvidence.length;
    const bothGoodCount = neutralEvidence.filter((entry) => entry.picked === 'BOTH_GOOD').length;
    const broadNeutralEvidenceCount = neutralEvidence.filter((entry) => entry.broadProbe).length;
    const neutralRate = controlledEvidenceCount
        ? neutralEvidenceCount / controlledEvidenceCount
        : 0;
    const meanPairGapNorm = controlledEvidenceCount
        ? mean([
            ...decisiveEvidence.map((entry) => entry.gapNorm),
            ...neutralEvidence.map((entry) => entry.gapNorm),
        ])
        : 0;
    const recentDecisiveEvidenceCount = recentControlledEvidence.filter(
        (entry) => entry.decisionType === 'decisive',
    ).length;
    const recentNeutralEvidence = recentControlledEvidence.filter(
        (entry) => entry.decisionType === 'neutral',
    );
    const recentNeutralEvidenceCount = recentNeutralEvidence.length;
    const recentBroadEvidence = resolveRecentBroadEvidence(
        decisiveEvidence,
        neutralEvidence,
    );
    const recentBroadNeutralEvidenceCount = recentBroadEvidence.filter(
        (entry) => entry.decisionType === 'neutral',
    ).length;
    const recentBroadDecisiveEvidenceCount = recentBroadEvidence.filter(
        (entry) => entry.decisionType === 'decisive',
    ).length;
    const recentNeutralRate = recentControlledEvidence.length
        ? recentNeutralEvidenceCount / recentControlledEvidence.length
        : 0;
    return {
        factorKey,
        learningRange: {
            min: range.min,
            max: range.max,
            integer: range.integer,
        },
        evidenceCount,
        neutralEvidenceCount,
        controlledEvidenceCount,
        passCount,
        bothGoodCount,
        broadNeutralEvidenceCount,
        neutralRate: round(neutralRate),
        meanPairGapNorm: round(meanPairGapNorm),
        estimationEvidenceCount: recentDecisiveEvidenceCount,
        resolutionEvidenceCount: recentControlledEvidence.length,
        recentNeutralEvidenceCount,
        recentBroadEvidenceCount: recentBroadEvidence.length,
        recentBroadNeutralEvidenceCount,
        recentBroadDecisiveEvidenceCount,
        recentNeutralRate: round(recentNeutralRate),
    };
};

const buildEmptyFactorBasin = ({
    factorKey,
    range,
    decisiveEvidence = [],
    neutralEvidence = [],
    abstainEvidence = [],
}) => {
    const recentControlledEvidence = resolveRecentControlledEvidence(
        decisiveEvidence,
        neutralEvidence,
    );
    const base = buildFactorBasinBase({
        factorKey,
        range,
        decisiveEvidence,
        neutralEvidence,
        abstainEvidence,
        recentControlledEvidence,
    });
    const factorPolicy = resolveSakuraLearningFactor(factorKey);
    const indifferenceEvidenceMin = Math.max(
        INDIFFERENCE_EVIDENCE_MIN,
        factorPolicy.minEvidence,
    );
    const stage = resolveStage({
        decisiveEvidenceCount: 0,
        controlledEvidenceCount: base.resolutionEvidenceCount,
        neutralEvidenceCount: base.recentNeutralEvidenceCount,
        neutralRate: base.recentNeutralRate,
        broadNeutralEvidenceCount: base.recentBroadNeutralEvidenceCount,
        broadDecisiveEvidenceCount: base.recentBroadDecisiveEvidenceCount,
        indifferenceEvidenceMin,
        preferenceShape: SAKURA_PREFERENCE_BASIN_SHAPE.UNRESOLVED,
        directionalConsistency: 0,
        distinctCenterCount: 0,
        observedSpan: 0,
        wideDecisiveEvidenceCount: 0,
        winnerStdDev: Number.POSITIVE_INFINITY,
        acceptedWidth: Number.POSITIVE_INFINITY,
        consistency: 0,
    });
    return {
        ...base,
        winnerMean: null,
        winnerStdDev: null,
        acceptedLow: null,
        acceptedHigh: null,
        directionBias: 0,
        directionalConsistency: 0,
        basinConsistency: 0,
        consistency: 0,
        preferenceShape: SAKURA_PREFERENCE_BASIN_SHAPE.UNRESOLVED,
        distinctCenterCount: 0,
        observedSpan: 0,
        wideDecisiveEvidenceCount: 0,
        indifferenceEvidenceMin,
        indifferent: stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT,
        stage,
    };
};

const buildFactorBasin = ({ factorKey, range, evidence }) => {
    const decisiveEvidence = evidence?.decisive || [];
    const neutralEvidence = evidence?.neutral || [];
    const abstainEvidence = evidence?.abstain || [];
    if (!decisiveEvidence.length) {
        return buildEmptyFactorBasin({
            factorKey,
            range,
            neutralEvidence,
            abstainEvidence,
        });
    }

    const recentControlledEvidence = resolveRecentControlledEvidence(
        decisiveEvidence,
        neutralEvidence,
    );
    const estimationEvidence = recentControlledEvidence.filter(
        (entry) => entry.decisionType === 'decisive',
    );
    if (!estimationEvidence.length) {
        return buildEmptyFactorBasin({
            factorKey,
            range,
            decisiveEvidence,
            neutralEvidence,
            abstainEvidence,
        });
    }
    const orderedEvidence = [...estimationEvidence].sort((left, right) => (
        left.winner - right.winner
        || left.loser - right.loser
        || String(left.historyEntryId ?? '').localeCompare(String(right.historyEntryId ?? ''))
    ));
    const winnerValues = orderedEvidence.map((entry) => entry.winner);
    const winnerMean = mean(winnerValues);
    const winnerVariance = mean(
        winnerValues.map((value) => ((value - winnerMean) ** 2)),
    );
    const winnerStdDev = Math.sqrt(winnerVariance);
    const directionBias = mean(orderedEvidence.map((entry) => (
        Math.sign(entry.winner - entry.loser)
    )));
    const directionalConsistency = (1 + Math.abs(directionBias)) / 2;
    const preferenceShape = resolvePreferenceShape(directionBias, orderedEvidence.length);
    const distinctCenterCount = new Set(
        orderedEvidence.map((entry) => entry.center.toFixed(3)),
    ).size;
    const observedValues = orderedEvidence.flatMap((entry) => [entry.winner, entry.loser]);
    const observedSpan = Math.max(...observedValues) - Math.min(...observedValues);
    const wideDecisiveEvidenceCount = orderedEvidence.filter(
        (entry) => entry.gapNorm >= WIDE_DECISIVE_GAP_MIN,
    ).length;
    const useQuantiles = winnerValues.length >= QUANTILE_EVIDENCE_MIN;
    const interiorAcceptedLow = useQuantiles
        ? quantile(winnerValues, ACCEPTED_LOW_QUANTILE)
        : winnerValues[0];
    const interiorAcceptedHigh = useQuantiles
        ? quantile(winnerValues, ACCEPTED_HIGH_QUANTILE)
        : winnerValues[winnerValues.length - 1];
    const medianWinner = quantile(winnerValues, 0.5);
    const acceptedLow = preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH
        ? medianWinner
        : preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW
            ? 0
            : interiorAcceptedLow;
    const acceptedHigh = preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_HIGH
        ? Math.max(...observedValues)
        : preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW
            ? medianWinner
            : interiorAcceptedHigh;
    const resolvedAcceptedLow = preferenceShape === SAKURA_PREFERENCE_BASIN_SHAPE.MONOTONIC_LOW
        ? Math.min(...observedValues)
        : acceptedLow;
    const basinConsistency = mean(orderedEvidence.map((entry) => {
        const winnerDistance = Math.abs(entry.winner - winnerMean);
        const loserDistance = Math.abs(entry.loser - winnerMean);
        if (Math.abs(winnerDistance - loserDistance) <= RANGE_TOLERANCE) {
            return 0.5;
        }
        return winnerDistance < loserDistance ? 1 : 0;
    }));
    const consistency = isMonotonicShape(preferenceShape)
        ? directionalConsistency
        : basinConsistency;
    const acceptedWidth = acceptedHigh - resolvedAcceptedLow;

    const base = buildFactorBasinBase({
        factorKey,
        range,
        decisiveEvidence,
        neutralEvidence,
        abstainEvidence,
        recentControlledEvidence,
    });
    const factorPolicy = resolveSakuraLearningFactor(factorKey);
    const indifferenceEvidenceMin = Math.max(
        INDIFFERENCE_EVIDENCE_MIN,
        factorPolicy.minEvidence,
    );
    const stage = resolveStage({
        decisiveEvidenceCount: orderedEvidence.length,
        controlledEvidenceCount: base.resolutionEvidenceCount,
        neutralEvidenceCount: base.recentNeutralEvidenceCount,
        neutralRate: base.recentNeutralRate,
        broadNeutralEvidenceCount: base.recentBroadNeutralEvidenceCount,
        broadDecisiveEvidenceCount: base.recentBroadDecisiveEvidenceCount,
        indifferenceEvidenceMin,
        preferenceShape,
        directionalConsistency,
        distinctCenterCount,
        observedSpan,
        wideDecisiveEvidenceCount,
        winnerStdDev,
        acceptedWidth,
        consistency,
    });

    return {
        ...base,
        winnerMean: round(winnerMean),
        winnerStdDev: round(winnerStdDev),
        acceptedLow: round(resolvedAcceptedLow),
        acceptedHigh: round(acceptedHigh),
        directionBias: round(directionBias),
        directionalConsistency: round(directionalConsistency),
        basinConsistency: round(basinConsistency),
        consistency: round(consistency),
        preferenceShape,
        distinctCenterCount,
        observedSpan: round(observedSpan),
        wideDecisiveEvidenceCount,
        indifferenceEvidenceMin,
        indifferent: stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT,
        stage,
    };
};

const collectBasinEvidence = ({
    abHistory,
    factorKeys,
    learningKeyspaceProfile,
    rangesByFactor,
}) => {
    const factorSet = new Set(factorKeys);
    const evidenceByFactor = new Map(factorKeys.map((key) => [key, {
        decisive: [],
        neutral: [],
        abstain: [],
    }]));

    abHistory.forEach((entry, historyIndex) => {
        const decisionType = resolveSakuraHistoryDecisionType(entry);
        if (
            decisionType !== 'decisive'
            && decisionType !== 'neutral'
            && decisionType !== 'abstain'
        ) {
            return;
        }
        if (!resolveSakuraPairwiseEvidencePolicy(entry).preferenceBasinEligible) {
            return;
        }
        const context = entry.generationContext;
        if (context?.pairType !== 'isolation_pair') {
            return;
        }
        const changedFactors = context.changedFactors;
        const factorKey = changedFactors[0].id.trim();
        if (!factorSet.has(factorKey)) {
            return;
        }
        if (context.learningKeyspaceProfile !== learningKeyspaceProfile) {
            throw new Error(
                `ZEN_SAKURA_PREFERENCE_BASIN_PROFILE_MISMATCH:id=${entry.id ?? 'unknown'}:factor=${factorKey}`,
            );
        }

        const timestampRecency = Date.parse(entry.timestamp);
        const idRecency = Number(entry.id);
        const recency = Number.isFinite(timestampRecency)
            ? timestampRecency
            : Number.isFinite(idRecency)
                ? idRecency
                : abHistory.length - historyIndex;
        if (decisionType === 'abstain') {
            evidenceByFactor.get(factorKey).abstain.push({
                historyEntryId: entry.id ?? null,
                picked: String(entry.picked || '').trim().toUpperCase(),
                recency,
            });
            return;
        }

        const latentA = resolveCandidateLatent(entry.A);
        const latentB = resolveCandidateLatent(entry.B);
        if (!latentA || !latentB) {
            throw new Error(
                `ZEN_SAKURA_PREFERENCE_BASIN_LATENT_REQUIRED:id=${entry.id ?? 'unknown'}:factor=${factorKey}`,
            );
        }
        const range = rangesByFactor.get(factorKey);
        const valueA = normalizeLearningValue({
            factorKey,
            value: latentA[factorKey],
            range,
            historyEntryId: entry.id,
            candidateLabel: 'A',
        });
        const valueB = normalizeLearningValue({
            factorKey,
            value: latentB[factorKey],
            range,
            historyEntryId: entry.id,
            candidateLabel: 'B',
        });
        const gapNorm = Math.abs(valueA - valueB);
        if (gapNorm <= RANGE_TOLERANCE) {
            throw new Error(
                `ZEN_SAKURA_PREFERENCE_BASIN_ZERO_DELTA:id=${entry.id ?? 'unknown'}:factor=${factorKey}`,
            );
        }
        const declaredBroadProbe = context?.preferenceLearning?.broadProbe;
        const broadProbe = declaredBroadProbe === true
            || (
                typeof declaredBroadProbe !== 'boolean'
                && gapNorm >= LEGACY_INDIFFERENCE_BROAD_GAP_MIN
            );
        if (decisionType === 'neutral') {
            evidenceByFactor.get(factorKey).neutral.push({
                historyEntryId: entry.id ?? null,
                picked: String(entry.picked || '').trim().toUpperCase(),
                gapNorm,
                recency,
                broadProbe,
            });
            return;
        }
        const winnerLabel = resolveWinnerLabel(entry);
        if (!winnerLabel) {
            throw new Error(
                `ZEN_SAKURA_PREFERENCE_BASIN_DECISIVE_PICK_INVALID:id=${entry.id ?? 'unknown'}`,
            );
        }
        const winner = winnerLabel === 'A' ? valueA : valueB;
        const loser = winnerLabel === 'A' ? valueB : valueA;
        evidenceByFactor.get(factorKey).decisive.push({
            historyEntryId: entry.id ?? null,
            winner,
            loser,
            gapNorm,
            recency,
            center: (valueA + valueB) / 2,
            broadProbe,
        });
    });

    return evidenceByFactor;
};

export const buildSakuraPreferenceBasinModel = (input) => {
    const {
        abHistory,
        factorKeys,
        learningKeyspaceProfile,
    } = requireModelInput(input);
    const rangesByFactor = new Map(factorKeys.map((factorKey) => [
        factorKey,
        resolveLearningRange(factorKey, learningKeyspaceProfile),
    ]));
    const evidenceByFactor = collectBasinEvidence({
        abHistory,
        factorKeys,
        learningKeyspaceProfile,
        rangesByFactor,
    });
    const factors = factorKeys.map((factorKey) => buildFactorBasin({
        factorKey,
        range: rangesByFactor.get(factorKey),
        evidence: evidenceByFactor.get(factorKey),
    }));
    const coveredFactorCount = factors.filter((factor) => factor.controlledEvidenceCount > 0).length;
    const stableFactorCount = factors.filter(
        (factor) => factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.STABLE,
    ).length;
    const indifferentFactorCount = factors.filter(
        (factor) => factor.stage === SAKURA_PREFERENCE_BASIN_STAGE.INDIFFERENT,
    ).length;
    const resolvedFactorCount = stableFactorCount + indifferentFactorCount;
    const decisiveEvidenceCount = factors.reduce(
        (sum, factor) => sum + factor.evidenceCount,
        0,
    );
    const neutralEvidenceCount = factors.reduce(
        (sum, factor) => sum + factor.neutralEvidenceCount,
        0,
    );
    const abstainEvidenceCount = factors.reduce(
        (sum, factor) => sum + factor.passCount,
        0,
    );

    return {
        modelVersion: SAKURA_PREFERENCE_BASIN_MODEL_VERSION,
        learningKeyspaceProfile,
        valueSpace: SAKURA_PREFERENCE_BASIN_VALUE_SPACE,
        factorCount: factors.length,
        evidenceCount: decisiveEvidenceCount + neutralEvidenceCount,
        decisiveEvidenceCount,
        neutralEvidenceCount,
        abstainEvidenceCount,
        coveredFactorCount,
        stableFactorCount,
        indifferentFactorCount,
        resolvedFactorCount,
        coverage: round(coveredFactorCount / factors.length),
        stableFactorRatio: round(stableFactorCount / factors.length),
        indifferentFactorRatio: round(indifferentFactorCount / factors.length),
        resolvedFactorRatio: round(resolvedFactorCount / factors.length),
        factors,
    };
};
