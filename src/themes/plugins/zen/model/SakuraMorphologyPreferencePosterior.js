import {
    BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT,
    requireBonsaiMorphologyEvidenceV1,
} from './bonsai/morphology/BonsaiMorphologyEvidenceContract.js';
import {
    BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS,
} from './bonsai/morphology/BonsaiFormReachabilityPolicy.js';
import {
    BONSAI_STRUCTURAL_VECTOR_KEYS,
} from './bonsai/morphology/BonsaiStructuralDescriptorModel.js';
import {
    requireSakuraABQuestionLane,
    SAKURA_AB_QUESTION_LANE,
} from './SakuraABQuestionLanePolicy.js';
import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from './v2/SakuraLearningSemantics.js';
import {
    createSakuraABHistoryChronologicalReplay,
} from './SakuraABHistoryOrderContract.js';

export const SAKURA_MORPHOLOGY_PREFERENCE_POSTERIOR_VERSION = 1;
export const SAKURA_MORPHOLOGY_PREFERENCE_POSTERIOR_ID = (
    'sakura_morphology_preference_global_per_form_diagonal_laplace_v1'
);
export const SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_VERSION = 1;
export const SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_ID = (
    'sakura_morphology_preference_chronological_prequential_v1'
);

export const SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY = Object.freeze({
    globalWarmupPairs: 24,
    globalMinimumHeldoutPairs: 8,
    perFormWarmupPairs: 12,
    perFormMinimumHeldoutPairs: 6,
    maximumBrierScore: 0.23,
    maximumLogLoss: 0.693,
    minimumDirectionalAccuracy: 0.6,
    minimumBrierImprovement: 0.02,
});

export const SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION = Object.freeze({
    LABEL_UNUSABLE: 'label_unusable',
    MORPHOLOGY_EVIDENCE_MISSING: 'morphology_evidence_missing',
    QUESTION_LANE_MISSING: 'question_lane_missing',
    QUERY_KIND_ANCHOR: 'query_kind_anchor',
    GENERATION_SEMANTICS_MISMATCH: 'generation_semantics_mismatch',
    DISCOVERY_TARGET_INVALID: 'discovery_target_invalid',
    DISCOVERY_PRIMARY_UNCLASSIFIED: 'discovery_primary_unclassified',
    DISCOVERY_PRIMARY_UNSUPPORTED: 'discovery_primary_unsupported',
    DISCOVERY_REQUIRES_CROSS_TARGET: 'discovery_requires_cross_target',
    DISCOVERY_REQUIRES_CROSS_PRIMARY: 'discovery_requires_cross_primary',
    DISCOVERY_TARGET_MEMBERSHIP_REJECTED: 'discovery_target_membership_rejected',
    PREFERENCE_TARGET_INVALID: 'preference_target_invalid',
    PREFERENCE_PRIMARY_UNCLASSIFIED: 'preference_primary_unclassified',
    PREFERENCE_PRIMARY_UNSUPPORTED: 'preference_primary_unsupported',
    PREFERENCE_REQUIRES_SAME_TARGET: 'preference_requires_same_target',
    PREFERENCE_REQUIRES_SAME_PRIMARY: 'preference_requires_same_primary',
    PREFERENCE_PRIMARY_TARGET_MISMATCH: 'preference_primary_target_mismatch',
    PREFERENCE_TARGET_MEMBERSHIP_REJECTED: 'preference_target_membership_rejected',
});

const PRIOR_PRECISION = 2.5;
const GLOBAL_LEARNING_RATE = 0.72;
const PER_FORM_LEARNING_RATE = 0.58;
const FORM_BIAS_LEARNING_RATE = 0.52;
const MIN_SAMPLE_WEIGHT = 0.05;
const MAX_SAMPLE_WEIGHT = 3;
const SUPPORTED_FORM_SET = new Set(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS);
const EPSILON = 1e-9;
const LOG_LOSS_BASELINE = Math.log(2);
const REJECTION_REASONS = Object.freeze(
    Object.values(SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION),
);

const clamp = (value, minimum, maximum) => (
    Math.min(maximum, Math.max(minimum, Number(value) || 0))
);
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const sigmoid = (value) => {
    const x = clamp(value, -16, 16);
    return 1 / (1 + Math.exp(-x));
};
const dot = (left, right) => left.reduce(
    (sum, value, index) => sum + (value * right[index]),
    0,
);
const zeroVector = () => BONSAI_STRUCTURAL_VECTOR_KEYS.map(() => 0);
const priorPrecisionVector = () => BONSAI_STRUCTURAL_VECTOR_KEYS.map(() => PRIOR_PRECISION);
const hasOwn = (value, key) => Boolean(
    value
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key)
);
const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
);
const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};

const resolveCandidateEvidence = (candidate) => {
    const evidence = candidate?.morphologyEvidence;
    if (!evidence) return null;
    return requireBonsaiMorphologyEvidenceV1(evidence);
};

const vectorizeEvidence = (evidence) => BONSAI_STRUCTURAL_VECTOR_KEYS.map(
    (key) => Number(evidence.vector[key]),
);

const resolveRealizedPrimaryFormId = (evidence) => {
    const formId = evidence.classification.primaryFormId;
    return SUPPORTED_FORM_SET.has(formId) ? formId : null;
};

const resolveHistoryPreference = (entry) => {
    const picked = String(entry?.picked || '').trim().toUpperCase();
    if (picked === 'A') return { preferred: 'A', target: 1, targetA: 1 };
    if (picked === 'B') return { preferred: 'B', target: 1, targetA: 0 };
    if (picked === 'WORSE_A') return { preferred: 'B', target: 1, targetA: 0 };
    if (picked === 'WORSE_B') return { preferred: 'A', target: 1, targetA: 1 };
    if (picked === 'BOTH_GOOD') return { preferred: null, target: 0.5, targetA: 0.5 };
    return null;
};

const resolveSampleWeight = (entry, target) => {
    const explicit = Number(
        entry?.weights?.morphology
        ?? entry?.weights?.pairwise
        ?? entry?.weights?.pairwiseTie
        ?? entry?.weights?.collection
        ?? 1,
    );
    const base = clamp(explicit, MIN_SAMPLE_WEIGHT, MAX_SAMPLE_WEIGHT);
    return target === 0.5 ? base * 0.28 : base;
};

const createAxisState = () => ({
    mean: zeroVector(),
    precision: priorPrecisionVector(),
    evidenceCount: 0,
});

const createRejectionCounts = () => Object.fromEntries(
    REJECTION_REASONS.map((reason) => [reason, 0]),
);

const createAdmissibilityState = () => ({
    historyEntryCount: 0,
    labeledEntryCount: 0,
    admittedPairCount: 0,
    rejectedPairCount: 0,
    globalCrossFormPairCount: 0,
    perFormSamePrimaryPairCount: 0,
    perFormAdmittedCounts: Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, 0]),
    ),
    rejectionCounts: createRejectionCounts(),
});

const createCalibrationAccumulator = ({ scope, formId = null, warmupPairs, minimumHeldoutPairs }) => ({
    scope,
    formId,
    warmupPairs,
    minimumHeldoutPairs,
    predictionCount: 0,
    warmupPredictionCount: 0,
    heldoutPredictionCount: 0,
    directionalPredictionCount: 0,
    directionalCorrectCount: 0,
    brierTotal: 0,
    logLossTotal: 0,
    varianceTotal: 0,
});

const createCalibrationState = () => ({
    global: createCalibrationAccumulator({
        scope: 'global_cross_form',
        warmupPairs: SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.globalWarmupPairs,
        minimumHeldoutPairs:
            SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.globalMinimumHeldoutPairs,
    }),
    perForm: Object.fromEntries(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [
        formId,
        createCalibrationAccumulator({
            scope: 'per_form_same_primary',
            formId,
            warmupPairs: SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.perFormWarmupPairs,
            minimumHeldoutPairs:
                SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.perFormMinimumHeldoutPairs,
        }),
    ])),
});

const recordPrequentialPrediction = (accumulator, {
    probabilityA,
    targetA,
    variance,
    priorTrainingPairCount,
}) => {
    accumulator.predictionCount += 1;
    if (priorTrainingPairCount < accumulator.warmupPairs) {
        accumulator.warmupPredictionCount += 1;
        return;
    }
    const probability = clamp(probabilityA, EPSILON, 1 - EPSILON);
    const target = clamp(targetA, 0, 1);
    accumulator.heldoutPredictionCount += 1;
    accumulator.brierTotal += (probability - target) ** 2;
    accumulator.logLossTotal += -(
        (target * Math.log(probability))
        + ((1 - target) * Math.log(1 - probability))
    );
    accumulator.varianceTotal += Math.max(0, Number(variance) || 0);
    if (target === 0 || target === 1) {
        accumulator.directionalPredictionCount += 1;
        if (
            (target === 1 && probability > 0.5)
            || (target === 0 && probability < 0.5)
        ) {
            accumulator.directionalCorrectCount += 1;
        }
    }
};

const resolveCalibrationConfidence = ({
    brierScore,
    logLoss,
    directionalAccuracy,
    heldoutPredictionCount,
    minimumHeldoutPairs,
}) => {
    const sampleAdequacy = clamp(
        heldoutPredictionCount / Math.max(1, minimumHeldoutPairs),
        0,
        1,
    );
    const brierQuality = brierScore === null
        ? 0
        : clamp((0.25 - brierScore) / 0.25, 0, 1);
    const logLossQuality = logLoss === null
        ? 0
        : clamp((LOG_LOSS_BASELINE - logLoss) / LOG_LOSS_BASELINE, 0, 1);
    const directionalQuality = directionalAccuracy === null
        ? 0
        : clamp((directionalAccuracy - 0.5) / 0.5, 0, 1);
    return round(sampleAdequacy * (
        (brierQuality * 0.45)
        + (logLossQuality * 0.35)
        + (directionalQuality * 0.2)
    ), 4);
};

const summarizeCalibrationAccumulator = (accumulator) => {
    const heldoutCount = accumulator.heldoutPredictionCount;
    const directionalCount = accumulator.directionalPredictionCount;
    const brierScore = heldoutCount > 0
        ? accumulator.brierTotal / heldoutCount
        : null;
    const logLoss = heldoutCount > 0
        ? accumulator.logLossTotal / heldoutCount
        : null;
    const averageVariance = heldoutCount > 0
        ? accumulator.varianceTotal / heldoutCount
        : null;
    const directionalAccuracy = directionalCount > 0
        ? accumulator.directionalCorrectCount / directionalCount
        : null;
    const roundedBrierScore = brierScore === null ? null : round(brierScore);
    const roundedBrierImprovement = roundedBrierScore === null
        ? null
        : round(0.25 - roundedBrierScore);
    const roundedLogLoss = logLoss === null ? null : round(logLoss);
    const roundedDirectionalAccuracy = directionalAccuracy === null
        ? null
        : round(directionalAccuracy);
    const warmupComplete = accumulator.warmupPredictionCount >= accumulator.warmupPairs;
    const heldoutComplete = heldoutCount >= accumulator.minimumHeldoutPairs;
    const metricsPass = Boolean(
        heldoutComplete
        && roundedBrierScore
            <= SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.maximumBrierScore
        && roundedBrierImprovement
            >= SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.minimumBrierImprovement
        && roundedLogLoss
            < SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.maximumLogLoss
        && roundedDirectionalAccuracy !== null
        && roundedDirectionalAccuracy
            >= SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.minimumDirectionalAccuracy
    );
    const confidence = resolveCalibrationConfidence({
        brierScore: roundedBrierScore,
        logLoss: roundedLogLoss,
        directionalAccuracy: roundedDirectionalAccuracy,
        heldoutPredictionCount: heldoutCount,
        minimumHeldoutPairs: accumulator.minimumHeldoutPairs,
    });
    const status = !warmupComplete
        ? 'warming'
        : !heldoutComplete
            ? 'collecting'
            : metricsPass
                ? 'ready'
                : 'failed';
    return Object.freeze({
        scope: accumulator.scope,
        formId: accumulator.formId,
        status,
        ready: metricsPass,
        warmupPairs: accumulator.warmupPairs,
        minimumHeldoutPairs: accumulator.minimumHeldoutPairs,
        predictionCount: accumulator.predictionCount,
        warmupPredictionCount: accumulator.warmupPredictionCount,
        heldoutPredictionCount: heldoutCount,
        brierScore: roundedBrierScore,
        brierImprovement: roundedBrierImprovement,
        logLoss: roundedLogLoss,
        directionalPredictionCount: directionalCount,
        directionalAccuracy: roundedDirectionalAccuracy,
        averageVariance: averageVariance === null ? null : round(averageVariance),
        confidence,
    });
};

const requireCount = (value, field) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`ZEN_SAKURA_MORPHOLOGY_DIAGNOSTIC_COUNT_INVALID:${field}`);
    }
    return value;
};

const requireNullableMetric = (value, field, { minimum = -Infinity, maximum = Infinity } = {}) => {
    if (value === null) return null;
    if (
        typeof value !== 'number'
        || !Number.isFinite(value)
        || value < minimum
        || value > maximum
    ) {
        throw new Error(`ZEN_SAKURA_MORPHOLOGY_DIAGNOSTIC_METRIC_INVALID:${field}`);
    }
    return value;
};

export const requireSakuraMorphologyPreferenceAdmissibilityV1 = (value) => {
    const keys = [
        'historyEntryCount',
        'labeledEntryCount',
        'admittedPairCount',
        'rejectedPairCount',
        'globalCrossFormPairCount',
        'perFormSamePrimaryPairCount',
        'perFormAdmittedCounts',
        'rejectionCounts',
    ];
    if (!hasExactKeys(value, keys)) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_ADMISSIBILITY_KEYS_INVALID');
    }
    const counts = Object.fromEntries(keys.slice(0, 6).map((field) => [
        field,
        requireCount(value[field], field),
    ]));
    if (
        !hasExactKeys(value.perFormAdmittedCounts, BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS)
        || !hasExactKeys(value.rejectionCounts, REJECTION_REASONS)
    ) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_ADMISSIBILITY_COUNTER_KEYS_INVALID');
    }
    const perFormAdmittedCounts = Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [
            formId,
            requireCount(value.perFormAdmittedCounts[formId], `perForm.${formId}`),
        ]),
    );
    const rejectionCounts = Object.fromEntries(REJECTION_REASONS.map((reason) => [
        reason,
        requireCount(value.rejectionCounts[reason], `rejection.${reason}`),
    ]));
    if (
        counts.labeledEntryCount > counts.historyEntryCount
        || counts.admittedPairCount + counts.rejectedPairCount !== counts.historyEntryCount
        || counts.globalCrossFormPairCount + counts.perFormSamePrimaryPairCount
            !== counts.admittedPairCount
        || Object.values(perFormAdmittedCounts).reduce((sum, count) => sum + count, 0)
            !== counts.perFormSamePrimaryPairCount
        || Object.values(rejectionCounts).reduce((sum, count) => sum + count, 0)
            !== counts.rejectedPairCount
    ) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_ADMISSIBILITY_COUNTS_INVALID');
    }
    return Object.freeze({
        ...counts,
        perFormAdmittedCounts: Object.freeze(perFormAdmittedCounts),
        rejectionCounts: Object.freeze(rejectionCounts),
    });
};

const requireCalibrationScope = (value, { expectedScope, expectedFormId }) => {
    const keys = [
        'scope',
        'formId',
        'status',
        'ready',
        'warmupPairs',
        'minimumHeldoutPairs',
        'predictionCount',
        'warmupPredictionCount',
        'heldoutPredictionCount',
        'brierScore',
        'brierImprovement',
        'logLoss',
        'directionalPredictionCount',
        'directionalAccuracy',
        'averageVariance',
        'confidence',
    ];
    if (!hasExactKeys(value, keys)) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_CALIBRATION_SCOPE_KEYS_INVALID');
    }
    if (
        value.scope !== expectedScope
        || value.formId !== expectedFormId
        || !['warming', 'collecting', 'ready', 'failed'].includes(value.status)
        || typeof value.ready !== 'boolean'
    ) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_CALIBRATION_SCOPE_INVALID');
    }
    const counts = {
        warmupPairs: requireCount(value.warmupPairs, 'warmupPairs'),
        minimumHeldoutPairs: requireCount(
            value.minimumHeldoutPairs,
            'minimumHeldoutPairs',
        ),
        predictionCount: requireCount(value.predictionCount, 'predictionCount'),
        warmupPredictionCount: requireCount(
            value.warmupPredictionCount,
            'warmupPredictionCount',
        ),
        heldoutPredictionCount: requireCount(
            value.heldoutPredictionCount,
            'heldoutPredictionCount',
        ),
        directionalPredictionCount: requireCount(
            value.directionalPredictionCount,
            'directionalPredictionCount',
        ),
    };
    const expectedWarmupPairs = expectedScope === 'global_cross_form'
        ? SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.globalWarmupPairs
        : SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.perFormWarmupPairs;
    const expectedMinimumHeldoutPairs = expectedScope === 'global_cross_form'
        ? SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.globalMinimumHeldoutPairs
        : SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.perFormMinimumHeldoutPairs;
    const brierScore = requireNullableMetric(value.brierScore, 'brierScore', {
        minimum: 0,
        maximum: 1,
    });
    const brierImprovement = requireNullableMetric(
        value.brierImprovement,
        'brierImprovement',
        { minimum: -0.75, maximum: 0.25 },
    );
    const logLoss = requireNullableMetric(value.logLoss, 'logLoss', { minimum: 0 });
    const directionalAccuracy = requireNullableMetric(
        value.directionalAccuracy,
        'directionalAccuracy',
        { minimum: 0, maximum: 1 },
    );
    const averageVariance = requireNullableMetric(
        value.averageVariance,
        'averageVariance',
        { minimum: 0 },
    );
    const confidence = requireNullableMetric(value.confidence, 'confidence', {
        minimum: 0,
        maximum: 1,
    });
    const expectedConfidence = resolveCalibrationConfidence({
        brierScore,
        logLoss,
        directionalAccuracy,
        heldoutPredictionCount: counts.heldoutPredictionCount,
        minimumHeldoutPairs: counts.minimumHeldoutPairs,
    });
    const warmupComplete = counts.warmupPredictionCount >= counts.warmupPairs;
    const heldoutComplete = counts.heldoutPredictionCount >= counts.minimumHeldoutPairs;
    const metricsPass = Boolean(
        heldoutComplete
        && brierScore
            <= SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.maximumBrierScore
        && brierImprovement
            >= SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.minimumBrierImprovement
        && logLoss < SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.maximumLogLoss
        && directionalAccuracy !== null
        && directionalAccuracy
            >= SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_POLICY.minimumDirectionalAccuracy
    );
    const expectedStatus = !warmupComplete
        ? 'warming'
        : !heldoutComplete
            ? 'collecting'
            : metricsPass
                ? 'ready'
                : 'failed';
    if (
        counts.predictionCount
            !== counts.warmupPredictionCount + counts.heldoutPredictionCount
        || counts.warmupPairs !== expectedWarmupPairs
        || counts.minimumHeldoutPairs !== expectedMinimumHeldoutPairs
        || counts.warmupPredictionCount > counts.warmupPairs
        || counts.directionalPredictionCount > counts.heldoutPredictionCount
        || (counts.heldoutPredictionCount === 0) !== (brierScore === null)
        || (counts.heldoutPredictionCount === 0) !== (brierImprovement === null)
        || (counts.heldoutPredictionCount === 0) !== (logLoss === null)
        || (counts.heldoutPredictionCount === 0) !== (averageVariance === null)
        || (counts.directionalPredictionCount === 0) !== (directionalAccuracy === null)
        || (
            brierScore !== null
            && brierImprovement !== round(0.25 - brierScore)
        )
        || value.status !== expectedStatus
        || value.ready !== metricsPass
        || confidence !== expectedConfidence
    ) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_CALIBRATION_SCOPE_COUNTS_INVALID');
    }
    return Object.freeze({
        scope: expectedScope,
        formId: expectedFormId,
        status: value.status,
        ready: value.ready,
        ...counts,
        brierScore,
        brierImprovement,
        logLoss,
        directionalAccuracy,
        averageVariance,
        confidence,
    });
};

export const requireSakuraMorphologyPreferenceCalibrationV1 = (value) => {
    if (!hasExactKeys(value, [
        'version',
        'calibrationId',
        'global',
        'perForm',
        'readyPerFormCount',
    ])) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_CALIBRATION_KEYS_INVALID');
    }
    if (
        value.version !== SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_VERSION
        || value.calibrationId !== SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_ID
        || !hasExactKeys(value.perForm, BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS)
    ) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_CALIBRATION_CONTRACT_INVALID');
    }
    const global = requireCalibrationScope(value.global, {
        expectedScope: 'global_cross_form',
        expectedFormId: null,
    });
    const perForm = Object.fromEntries(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [
        formId,
        requireCalibrationScope(value.perForm[formId], {
            expectedScope: 'per_form_same_primary',
            expectedFormId: formId,
        }),
    ]));
    const readyPerFormCount = requireCount(value.readyPerFormCount, 'readyPerFormCount');
    if (
        readyPerFormCount !== Object.values(perForm).filter((entry) => entry.ready).length
    ) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_CALIBRATION_READY_COUNT_INVALID');
    }
    return Object.freeze({
        version: SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_VERSION,
        calibrationId: SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_ID,
        global,
        perForm: Object.freeze(perForm),
        readyPerFormCount,
    });
};

const updateAxis = ({
    state,
    diff,
    residual,
    curvature,
    sampleWeight,
    learningRate,
}) => {
    diff.forEach((value, index) => {
        const weightedCurvature = sampleWeight * curvature * value * value;
        const denominator = state.precision[index] + weightedCurvature;
        state.mean[index] += (
            learningRate
            * sampleWeight
            * residual
            * value
        ) / Math.max(1e-8, denominator);
        state.precision[index] += weightedCurvature;
    });
    state.evidenceCount += 1;
};

const resolveEntryQuestionLane = (entry) => {
    const queryLane = hasOwn(entry?.query, 'questionLane')
        ? requireSakuraABQuestionLane(entry.query.questionLane)
        : null;
    const contextLane = hasOwn(entry?.generationContext, 'questionLane')
        ? requireSakuraABQuestionLane(entry.generationContext.questionLane)
        : null;
    if (queryLane && contextLane && queryLane !== contextLane) {
        throw new Error('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_QUESTION_LANE_MISMATCH');
    }
    return queryLane || contextLane;
};

const hasCurrentGenerationSemantics = (entry, evidenceA, evidenceB) => {
    const claimedSemantics = [
        entry?.generationContext?.generationSemantics,
        entry?.A?.generationSemantics,
        entry?.A?.render?.generationSemantics,
        entry?.B?.generationSemantics,
        entry?.B?.render?.generationSemantics,
    ].filter((value) => value !== null && value !== undefined);
    return (
        evidenceA.generationSemantics === SAKURA_GENERATION_SEMANTICS_ID
        && evidenceB.generationSemantics === SAKURA_GENERATION_SEMANTICS_ID
        && claimedSemantics.every((value) => value === SAKURA_GENERATION_SEMANTICS_ID)
    );
};

const targetMembershipAccepted = (evidence) => {
    if (!SUPPORTED_FORM_SET.has(evidence.targetFormId)) return false;
    const membership = evidence.classification.memberships.find(
        (entry) => entry.id === evidence.targetFormId,
    );
    return Boolean(
        membership
        && membership.score >= evidence.classification.threshold
    );
};

const rejectedAdmission = (reason, details = {}) => Object.freeze({
    admitted: false,
    reason,
    ...details,
});

export const resolveSakuraMorphologyPreferenceHistoryAdmission = (entry) => {
    const evidenceA = resolveCandidateEvidence(entry?.A);
    const evidenceB = resolveCandidateEvidence(entry?.B);
    const preference = resolveHistoryPreference(entry);
    if (!preference) {
        return rejectedAdmission(
            SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.LABEL_UNUSABLE,
        );
    }
    if (!evidenceA || !evidenceB) {
        return rejectedAdmission(
            SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.MORPHOLOGY_EVIDENCE_MISSING,
        );
    }
    const questionLane = resolveEntryQuestionLane(entry);
    if (!questionLane) {
        return rejectedAdmission(
            SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.QUESTION_LANE_MISSING,
        );
    }
    const queryKind = String(
        entry?.query?.kind
        || entry?.generationContext?.queryKind
        || '',
    ).trim().toLowerCase();
    if (queryKind === 'anchor') {
        return rejectedAdmission(
            SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.QUERY_KIND_ANCHOR,
            { questionLane },
        );
    }
    if (!hasCurrentGenerationSemantics(entry, evidenceA, evidenceB)) {
        return rejectedAdmission(
            SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.GENERATION_SEMANTICS_MISMATCH,
            { questionLane },
        );
    }

    const targetFormA = evidenceA.targetFormId;
    const targetFormB = evidenceB.targetFormId;
    const primaryFormA = evidenceA.classification.primaryFormId;
    const primaryFormB = evidenceB.classification.primaryFormId;
    if (questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY) {
        if (!SUPPORTED_FORM_SET.has(targetFormA) || !SUPPORTED_FORM_SET.has(targetFormB)) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.DISCOVERY_TARGET_INVALID,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (targetFormA === targetFormB) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.DISCOVERY_REQUIRES_CROSS_TARGET,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (primaryFormA === null || primaryFormB === null) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.DISCOVERY_PRIMARY_UNCLASSIFIED,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (!SUPPORTED_FORM_SET.has(primaryFormA) || !SUPPORTED_FORM_SET.has(primaryFormB)) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.DISCOVERY_PRIMARY_UNSUPPORTED,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (primaryFormA === primaryFormB) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.DISCOVERY_REQUIRES_CROSS_PRIMARY,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (!targetMembershipAccepted(evidenceA) || !targetMembershipAccepted(evidenceB)) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.DISCOVERY_TARGET_MEMBERSHIP_REJECTED,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        return Object.freeze({
            admitted: true,
            scope: 'global_cross_form',
            formId: null,
            questionLane,
            targetFormA,
            targetFormB,
            primaryFormA,
            primaryFormB,
            evidenceA,
            evidenceB,
            preference,
        });
    }

    if (
        questionLane === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
        || questionLane === SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START
    ) {
        if (!SUPPORTED_FORM_SET.has(targetFormA) || !SUPPORTED_FORM_SET.has(targetFormB)) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.PREFERENCE_TARGET_INVALID,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (targetFormA !== targetFormB) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.PREFERENCE_REQUIRES_SAME_TARGET,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (primaryFormA === null || primaryFormB === null) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.PREFERENCE_PRIMARY_UNCLASSIFIED,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (!SUPPORTED_FORM_SET.has(primaryFormA) || !SUPPORTED_FORM_SET.has(primaryFormB)) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.PREFERENCE_PRIMARY_UNSUPPORTED,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (primaryFormA !== primaryFormB) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.PREFERENCE_REQUIRES_SAME_PRIMARY,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (primaryFormA !== targetFormA) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION.PREFERENCE_PRIMARY_TARGET_MISMATCH,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        if (!targetMembershipAccepted(evidenceA) || !targetMembershipAccepted(evidenceB)) {
            return rejectedAdmission(
                SAKURA_MORPHOLOGY_ADMISSIBILITY_REJECTION
                    .PREFERENCE_TARGET_MEMBERSHIP_REJECTED,
                { questionLane, targetFormA, targetFormB, primaryFormA, primaryFormB },
            );
        }
        return Object.freeze({
            admitted: true,
            scope: 'per_form_same_primary',
            formId: primaryFormA,
            questionLane,
            targetFormA,
            targetFormB,
            primaryFormA,
            primaryFormB,
            evidenceA,
            evidenceB,
            preference,
        });
    }

    throw new Error(`ZEN_SAKURA_MORPHOLOGY_PREFERENCE_LANE_UNSUPPORTED:${questionLane}`);
};

export class SakuraMorphologyPreferencePosterior {
    constructor() {
        this.version = SAKURA_MORPHOLOGY_PREFERENCE_POSTERIOR_VERSION;
        this.posteriorId = SAKURA_MORPHOLOGY_PREFERENCE_POSTERIOR_ID;
        this.evidenceContract = BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT;
        this.global = createAxisState();
        this.perForm = Object.fromEntries(
            BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, createAxisState()]),
        );
        this.formBias = Object.fromEntries(
            BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, {
                mean: 0,
                precision: PRIOR_PRECISION,
                evidenceCount: 0,
            }]),
        );
        this.trainingPairCount = 0;
        this.crossFormPairCount = 0;
        this.sameFormPairCount = 0;
        this.tiePairCount = 0;
        this.admissibility = createAdmissibilityState();
        this.calibration = createCalibrationState();
    }

    resolveScore(evidence) {
        const resolved = requireBonsaiMorphologyEvidenceV1(evidence);
        const vector = vectorizeEvidence(resolved);
        const formId = resolveRealizedPrimaryFormId(resolved);
        const globalScore = dot(this.global.mean, vector);
        const perFormScore = formId ? dot(this.perForm[formId].mean, vector) : 0;
        const formBiasScore = formId ? this.formBias[formId].mean : 0;
        return {
            score: globalScore + perFormScore + formBiasScore,
            globalScore,
            perFormScore,
            formBiasScore,
            vector,
            formId,
            evidence: resolved,
        };
    }

    compare(leftCandidate, rightCandidate) {
        return this.compareDetailed(leftCandidate, rightCandidate).probabilityA;
    }

    compareDetailed(leftCandidate, rightCandidate) {
        const evidenceA = resolveCandidateEvidence(leftCandidate);
        const evidenceB = resolveCandidateEvidence(rightCandidate);
        if (!evidenceA || !evidenceB) {
            throw new Error('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_EVIDENCE_REQUIRED');
        }
        const left = this.resolveScore(evidenceA);
        const right = this.resolveScore(evidenceB);
        const globalDiff = left.vector.map((value, index) => value - right.vector[index]);
        const sameForm = Boolean(left.formId && left.formId === right.formId);
        const utilityA = left.globalScore + (
            sameForm ? left.perFormScore : left.formBiasScore
        );
        const utilityB = right.globalScore + (
            sameForm ? right.perFormScore : right.formBiasScore
        );
        let variance = globalDiff.reduce((sum, value, index) => (
            sum + ((value * value) / this.global.precision[index])
        ), 0);
        if (sameForm) {
            variance += globalDiff.reduce((sum, value, index) => (
                sum + ((value * value) / this.perForm[left.formId].precision[index])
            ), 0);
        } else {
            if (left.formId) variance += 1 / this.formBias[left.formId].precision;
            if (right.formId) variance += 1 / this.formBias[right.formId].precision;
        }
        return Object.freeze({
            probabilityA: round(sigmoid(utilityA - utilityB)),
            utilityA: round(utilityA),
            utilityB: round(utilityB),
            variance: round(variance),
            formA: left.formId,
            formB: right.formId,
            relation: sameForm
                ? 'within_form'
                : 'cross_form',
        });
    }

    trainPair(candidateA, candidateB, {
        preferred = 'A',
        target = 1,
        sampleWeight = 1,
    } = {}) {
        const evidenceA = resolveCandidateEvidence(candidateA);
        const evidenceB = resolveCandidateEvidence(candidateB);
        if (!evidenceA || !evidenceB) {
            throw new Error('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_EVIDENCE_REQUIRED');
        }
        if (preferred !== 'A' && preferred !== 'B' && preferred !== null) {
            throw new Error('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_LABEL_INVALID');
        }
        const resolvedTarget = Number(target);
        if (!Number.isFinite(resolvedTarget) || resolvedTarget < 0 || resolvedTarget > 1) {
            throw new Error('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_TARGET_INVALID');
        }
        const weight = clamp(sampleWeight, MIN_SAMPLE_WEIGHT, MAX_SAMPLE_WEIGHT);
        const left = this.resolveScore(evidenceA);
        const right = this.resolveScore(evidenceB);
        const orientedA = preferred === 'B' ? right : left;
        const orientedB = preferred === 'B' ? left : right;
        const diff = orientedA.vector.map((value, index) => value - orientedB.vector[index]);
        const sameForm = Boolean(
            orientedA.formId
            && orientedA.formId === orientedB.formId
        );
        if (sameForm) {
            if (
                left.evidence.targetFormId !== right.evidence.targetFormId
                || left.evidence.targetFormId !== left.formId
                || !targetMembershipAccepted(left.evidence)
                || !targetMembershipAccepted(right.evidence)
            ) {
                throw new Error(
                    'ZEN_SAKURA_MORPHOLOGY_PREFERENCE_PER_FORM_SCOPE_INVALID',
                );
            }
        } else if (
            !orientedA.formId
            || !orientedB.formId
            || !SUPPORTED_FORM_SET.has(left.evidence.targetFormId)
            || !SUPPORTED_FORM_SET.has(right.evidence.targetFormId)
            || left.evidence.targetFormId === right.evidence.targetFormId
            || !targetMembershipAccepted(left.evidence)
            || !targetMembershipAccepted(right.evidence)
        ) {
            throw new Error(
                'ZEN_SAKURA_MORPHOLOGY_PREFERENCE_GLOBAL_SCOPE_INVALID',
            );
        }
        const orientedUtilityA = orientedA.globalScore + (
            sameForm ? orientedA.perFormScore : orientedA.formBiasScore
        );
        const orientedUtilityB = orientedB.globalScore + (
            sameForm ? orientedB.perFormScore : orientedB.formBiasScore
        );
        const probability = sigmoid(orientedUtilityA - orientedUtilityB);
        const residual = resolvedTarget - probability;
        const curvature = Math.max(0.02, probability * (1 - probability));

        if (sameForm) {
            updateAxis({
                state: this.perForm[orientedA.formId],
                diff,
                residual,
                curvature,
                sampleWeight: weight,
                learningRate: PER_FORM_LEARNING_RATE,
            });
            this.sameFormPairCount += 1;
        } else {
            updateAxis({
                state: this.global,
                diff,
                residual,
                curvature,
                sampleWeight: weight,
                learningRate: GLOBAL_LEARNING_RATE,
            });
            const updateBias = (formId, direction) => {
                const state = this.formBias[formId];
                const weightedCurvature = weight * curvature;
                state.mean += (
                    FORM_BIAS_LEARNING_RATE
                    * weight
                    * residual
                    * direction
                ) / Math.max(1e-8, state.precision + weightedCurvature);
                state.precision += weightedCurvature;
                state.evidenceCount += 1;
            };
            updateBias(orientedA.formId, 1);
            updateBias(orientedB.formId, -1);
            this.crossFormPairCount += 1;
        }
        this.trainingPairCount += 1;
        if (resolvedTarget === 0.5) this.tiePairCount += 1;
        return this;
    }

    replay(history = []) {
        if (!Array.isArray(history)) {
            throw new TypeError('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_HISTORY_ARRAY_REQUIRED');
        }
        createSakuraABHistoryChronologicalReplay(history).forEach((entry) => {
            this.admissibility.historyEntryCount += 1;
            if (resolveHistoryPreference(entry)) {
                this.admissibility.labeledEntryCount += 1;
            }
            const admission = resolveSakuraMorphologyPreferenceHistoryAdmission(entry);
            if (!admission.admitted) {
                this.admissibility.rejectedPairCount += 1;
                this.admissibility.rejectionCounts[admission.reason] += 1;
                return;
            }
            this.admissibility.admittedPairCount += 1;
            const prediction = this.compareDetailed(
                { morphologyEvidence: admission.evidenceA },
                { morphologyEvidence: admission.evidenceB },
            );
            if (admission.scope === 'global_cross_form') {
                this.admissibility.globalCrossFormPairCount += 1;
                recordPrequentialPrediction(this.calibration.global, {
                    probabilityA: prediction.probabilityA,
                    targetA: admission.preference.targetA,
                    variance: prediction.variance,
                    priorTrainingPairCount: this.crossFormPairCount,
                });
            } else {
                this.admissibility.perFormSamePrimaryPairCount += 1;
                this.admissibility.perFormAdmittedCounts[admission.formId] += 1;
                recordPrequentialPrediction(this.calibration.perForm[admission.formId], {
                    probabilityA: prediction.probabilityA,
                    targetA: admission.preference.targetA,
                    variance: prediction.variance,
                    priorTrainingPairCount: this.perForm[admission.formId].evidenceCount,
                });
            }
            this.trainPair(
                { morphologyEvidence: admission.evidenceA },
                { morphologyEvidence: admission.evidenceB },
                {
                    preferred: admission.preference.preferred,
                    target: admission.preference.target,
                    sampleWeight: resolveSampleWeight(entry, admission.preference.target),
                },
            );
        });
        return this;
    }

    getMeta() {
        const perFormEvidenceCounts = Object.fromEntries(
            BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [
                formId,
                this.perForm[formId].evidenceCount,
            ]),
        );
        const globalCalibration = summarizeCalibrationAccumulator(this.calibration.global);
        const perFormCalibration = Object.fromEntries(
            BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [
                formId,
                summarizeCalibrationAccumulator(this.calibration.perForm[formId]),
            ]),
        );
        const perFormConfidence = Object.fromEntries(
            BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [
                formId,
                perFormCalibration[formId].confidence,
            ]),
        );
        const rejectionCounts = Object.freeze({ ...this.admissibility.rejectionCounts });
        const perFormAdmittedCounts = Object.freeze({
            ...this.admissibility.perFormAdmittedCounts,
        });
        const rejectedTotal = Object.values(rejectionCounts).reduce(
            (sum, count) => sum + count,
            0,
        );
        if (
            rejectedTotal !== this.admissibility.rejectedPairCount
            || this.admissibility.admittedPairCount + this.admissibility.rejectedPairCount
                !== this.admissibility.historyEntryCount
            || this.admissibility.globalCrossFormPairCount
                + this.admissibility.perFormSamePrimaryPairCount
                !== this.admissibility.admittedPairCount
        ) {
            throw new Error('ZEN_SAKURA_MORPHOLOGY_PREFERENCE_ADMISSIBILITY_COUNTS_INVALID');
        }
        const admissibility = requireSakuraMorphologyPreferenceAdmissibilityV1({
            historyEntryCount: this.admissibility.historyEntryCount,
            labeledEntryCount: this.admissibility.labeledEntryCount,
            admittedPairCount: this.admissibility.admittedPairCount,
            rejectedPairCount: this.admissibility.rejectedPairCount,
            globalCrossFormPairCount: this.admissibility.globalCrossFormPairCount,
            perFormSamePrimaryPairCount:
                this.admissibility.perFormSamePrimaryPairCount,
            perFormAdmittedCounts,
            rejectionCounts,
        });
        const calibration = requireSakuraMorphologyPreferenceCalibrationV1({
            version: SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_VERSION,
            calibrationId: SAKURA_MORPHOLOGY_PREFERENCE_CALIBRATION_ID,
            global: globalCalibration,
            perForm: Object.freeze(perFormCalibration),
            readyPerFormCount: BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.filter(
                (formId) => perFormCalibration[formId].ready,
            ).length,
        });
        return Object.freeze({
            version: this.version,
            posteriorId: this.posteriorId,
            evidenceContract: this.evidenceContract,
            trainingPairCount: this.trainingPairCount,
            crossFormPairCount: this.crossFormPairCount,
            sameFormPairCount: this.sameFormPairCount,
            tiePairCount: this.tiePairCount,
            globalEvidenceCount: this.global.evidenceCount,
            globalConfidence: globalCalibration.confidence,
            perFormEvidenceCounts: Object.freeze(perFormEvidenceCounts),
            perFormConfidence: Object.freeze(perFormConfidence),
            admissibility,
            calibration,
        });
    }
}

export const buildSakuraMorphologyPreferencePosterior = (history = []) => (
    new SakuraMorphologyPreferencePosterior().replay(history)
);

export const summarizeSakuraMorphologyPreferencePrequential = (history = []) => {
    const meta = buildSakuraMorphologyPreferencePosterior(history).getMeta();
    return Object.freeze({
        version: meta.calibration.version,
        calibrationId: meta.calibration.calibrationId,
        admissibility: meta.admissibility,
        global: meta.calibration.global,
        perForm: meta.calibration.perForm,
        readyPerFormCount: meta.calibration.readyPerFormCount,
    });
};

export const summarizeSakuraMorphologyCoverage = (candidates = []) => {
    if (!Array.isArray(candidates)) {
        throw new TypeError('ZEN_SAKURA_MORPHOLOGY_COVERAGE_CANDIDATES_ARRAY_REQUIRED');
    }
    const createCounts = () => Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, 0]),
    );
    const summarizeCounts = (counts, admittedCount) => {
        const probabilities = BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => (
            admittedCount > 0 ? counts[formId] / admittedCount : 0
        ));
        const entropy = probabilities.reduce((sum, probability) => (
            probability > 0 ? sum - (probability * Math.log(probability)) : sum
        ), 0);
        const maxEntropy = Math.log(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length);
        return {
            ratio: round(
                BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS
                    .filter((formId) => counts[formId] > 0).length
                / BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length,
                4,
            ),
            entropy: round(maxEntropy > 0 ? entropy / maxEntropy : 0, 4),
        };
    };
    const proposalCounts = createCounts();
    const realizedPrimaryCounts = createCounts();
    const realizedMembershipCounts = createCounts();
    const perFormTargetAcceptance = Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, {
            eligibleCount: 0,
            acceptedCount: 0,
            rate: 0,
        }]),
    );
    let evidenceCount = 0;
    let proposalAdmittedCount = 0;
    let realizedPrimaryAdmittedCount = 0;
    let realizedPrimaryUnclassifiedCount = 0;
    let realizedPrimaryUnsupportedCount = 0;
    let realizedMembershipEvidenceCount = 0;
    let realizedMembershipHitCount = 0;
    let targetAcceptanceEligibleCount = 0;
    let targetAcceptanceAcceptedCount = 0;
    candidates.forEach((candidate) => {
        const evidence = resolveCandidateEvidence(candidate);
        if (!evidence) return;
        evidenceCount += 1;

        const targetFormId = evidence.targetFormId;
        if (SUPPORTED_FORM_SET.has(targetFormId)) {
            proposalCounts[targetFormId] += 1;
            proposalAdmittedCount += 1;
            targetAcceptanceEligibleCount += 1;
            const formAcceptance = perFormTargetAcceptance[targetFormId];
            formAcceptance.eligibleCount += 1;
            const targetMembership = evidence.classification.memberships.find(
                (entry) => entry.id === targetFormId,
            );
            if (
                targetMembership
                && targetMembership.score >= evidence.classification.threshold
            ) {
                targetAcceptanceAcceptedCount += 1;
                formAcceptance.acceptedCount += 1;
            }
        }

        const primaryFormId = evidence.classification.primaryFormId;
        if (SUPPORTED_FORM_SET.has(primaryFormId)) {
            realizedPrimaryCounts[primaryFormId] += 1;
            realizedPrimaryAdmittedCount += 1;
        } else if (primaryFormId === null) {
            realizedPrimaryUnclassifiedCount += 1;
        } else {
            realizedPrimaryUnsupportedCount += 1;
        }

        let candidateMembershipHitCount = 0;
        evidence.classification.memberships.forEach((membership) => {
            if (
                SUPPORTED_FORM_SET.has(membership.id)
                && membership.score >= evidence.classification.threshold
            ) {
                realizedMembershipCounts[membership.id] += 1;
                realizedMembershipHitCount += 1;
                candidateMembershipHitCount += 1;
            }
        });
        if (candidateMembershipHitCount > 0) {
            realizedMembershipEvidenceCount += 1;
        }
    });
    BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.forEach((formId) => {
        const entry = perFormTargetAcceptance[formId];
        entry.rate = round(
            entry.eligibleCount > 0 ? entry.acceptedCount / entry.eligibleCount : 0,
            4,
        );
        Object.freeze(entry);
    });
    const proposal = summarizeCounts(proposalCounts, proposalAdmittedCount);
    const realizedPrimary = summarizeCounts(
        realizedPrimaryCounts,
        realizedPrimaryAdmittedCount,
    );
    const realizedMembership = summarizeCounts(
        realizedMembershipCounts,
        realizedMembershipHitCount,
    );
    return Object.freeze({
        supportedFormCount: BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length,
        evidenceCount,
        proposalAdmittedCount,
        proposalCounts: Object.freeze(proposalCounts),
        proposalCoverageRatio: proposal.ratio,
        proposalNormalizedEntropy: proposal.entropy,
        realizedPrimaryAdmittedCount,
        realizedPrimaryUnclassifiedCount,
        realizedPrimaryUnsupportedCount,
        realizedPrimaryCounts: Object.freeze(realizedPrimaryCounts),
        realizedPrimaryCoverageRatio: realizedPrimary.ratio,
        realizedPrimaryNormalizedEntropy: realizedPrimary.entropy,
        realizedMembershipEvidenceCount,
        realizedMembershipHitCount,
        realizedMembershipCounts: Object.freeze(realizedMembershipCounts),
        realizedMembershipCoverageRatio: realizedMembership.ratio,
        realizedMembershipNormalizedEntropy: realizedMembership.entropy,
        targetAcceptanceEligibleCount,
        targetAcceptanceAcceptedCount,
        targetAcceptanceRate: round(
            targetAcceptanceEligibleCount > 0
                ? targetAcceptanceAcceptedCount / targetAcceptanceEligibleCount
                : 0,
            4,
        ),
        perFormTargetAcceptance: Object.freeze(perFormTargetAcceptance),
    });
};

export const summarizeSakuraMorphologyDiscoveryCoverage = (history = []) => {
    if (!Array.isArray(history)) {
        throw new TypeError('ZEN_SAKURA_MORPHOLOGY_COVERAGE_HISTORY_ARRAY_REQUIRED');
    }
    const discoveryCandidates = [];
    history.forEach((entry) => {
        if (entry?.generationContext?.generationSemantics !== SAKURA_GENERATION_SEMANTICS_ID) {
            throw new Error('ZEN_SAKURA_MORPHOLOGY_COVERAGE_GENERATION_SEMANTICS_MISMATCH');
        }
        const questionLane = resolveEntryQuestionLane(entry);
        if (questionLane !== SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY) return;
        discoveryCandidates.push(entry?.A, entry?.B);
    });
    return summarizeSakuraMorphologyCoverage(discoveryCandidates.filter(Boolean));
};
